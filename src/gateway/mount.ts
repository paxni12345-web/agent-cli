import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { InMemoryApprovalStore } from './approvalStore.js';
import { InMemoryBudgetService } from './budget.js';
import { DirectLlmAdapter } from './directLlmAdapter.js';
import { E2BModeSandboxProvider, hermesLaunch, opencodeLaunch, openclawLaunch, type ModeLaunch } from './e2bModeProvider.js';
import { InMemoryEventBus } from './eventBus.js';
import { HermesAdapter } from './hermesAdapter.js';
import { createLlmProxyRouter, LlmTokenStore } from './llmProxy.js';
import { OpenClawAdapter } from './openclawAdapter.js';
import { OpenCodeAdapter } from './opencodeAdapter.js';
import { SessionService, type SandboxProvider } from './sessionService.js';
import type { AgentAdapter, Backend, Mode } from './types.js';
import { createV2Router, type V2Identity } from './v2Router.js';

export interface GatewayMountDeps {
  authenticate(req: Request, res: Response): Promise<V2Identity | null>;
  env?: NodeJS.ProcessEnv;
}

const int = (v: string | undefined, d: number): number => Number.parseInt(v ?? '', 10) || d;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds the /api/v2 router from environment variables, or returns null when GATEWAY_V2 is not "1".
 *
 * Chat needs only GATEWAY_LLM_BASE_URL + GATEWAY_LLM_MODEL (+ GATEWAY_LLM_API_KEY). Setting any
 * GATEWAY_TEMPLATE_CODE / _WORK / _AGENT also enables sandbox modes, which then require E2B_API_KEY,
 * GATEWAY_PUBLIC_URL (where sandboxes reach this server's LLM proxy) and a real GATEWAY_LLM_API_KEY: the key stays
 * here and sandboxes only get short-lived per-user tokens for the proxy.
 * Fails closed: a half-configured gateway throws instead of running without isolation.
 */
export function createGatewayFromEnv(deps: GatewayMountDeps): Router | null {
  const env = deps.env ?? process.env;
  if (env.GATEWAY_V2 !== '1') return null;

  const llmBase = env.GATEWAY_LLM_BASE_URL ?? '';
  const llmModel = env.GATEWAY_LLM_MODEL ?? '';
  const llmKey = env.GATEWAY_LLM_API_KEY ?? '';
  if (!llmBase || !llmModel) throw new Error('GATEWAY_V2=1 needs GATEWAY_LLM_BASE_URL and GATEWAY_LLM_MODEL');

  const models = [llmModel, env.GATEWAY_CHAT_MODEL ?? '', ...(env.GATEWAY_LLM_EXTRA_MODELS ?? '').split(',').map((m) => m.trim())]
    .filter(Boolean).filter((m, i, all) => all.indexOf(m) === i);
  const launches: Partial<Record<Mode, ModeLaunch>> = {};
  if (env.GATEWAY_TEMPLATE_CODE) launches.code = opencodeLaunch(env.GATEWAY_TEMPLATE_CODE);
  if (env.GATEWAY_TEMPLATE_WORK) launches.work = openclawLaunch(env.GATEWAY_TEMPLATE_WORK);
  if (env.GATEWAY_TEMPLATE_AGENT) launches.agent = hermesLaunch(env.GATEWAY_TEMPLATE_AGENT);
  const sandboxModes = Object.keys(launches).length > 0;

  const bus = new InMemoryEventBus();
  const approvals = new InMemoryApprovalStore();
  const budget = new InMemoryBudgetService({
    dailyTokenLimit: int(env.GATEWAY_DAILY_TOKENS, 200_000),
    dailyCostLimitMicroUsd: env.GATEWAY_DAILY_COST_MICRO_USD ? int(env.GATEWAY_DAILY_COST_MICRO_USD, 0) || null : null,
    priceInPerMTokMicroUsd: int(env.GATEWAY_PRICE_IN_MICRO_PER_MTOK, 0),
    priceOutPerMTokMicroUsd: int(env.GATEWAY_PRICE_OUT_MICRO_PER_MTOK, 0),
  });

  const adapters: Partial<Record<Backend, AgentAdapter>> = {
    // Chat runs in this process, so its key never enters a sandbox.
    'direct-llm': new DirectLlmAdapter({
      baseUrl: env.GATEWAY_CHAT_BASE_URL || llmBase, apiKey: env.GATEWAY_CHAT_API_KEY || llmKey,
      model: env.GATEWAY_CHAT_MODEL || llmModel,
    }),
  };
  const notEnabled: SandboxProvider = { acquire: async () => ({ kind: 'failed', message: 'This mode is not enabled' }) };
  let sandboxes: SandboxProvider = notEnabled;
  let proxiedBackends: Backend[] = [];
  const root = makeRouter();

  if (sandboxModes) {
    const e2bKey = env.E2B_API_KEY ?? '';
    const publicUrl = (env.GATEWAY_PUBLIC_URL ?? '').replace(/\/+$/, '');
    if (!e2bKey) throw new Error('GATEWAY_TEMPLATE_* needs E2B_API_KEY');
    if (!/^https:\/\/[^/]+/.test(publicUrl)) throw new Error('GATEWAY_TEMPLATE_* needs GATEWAY_PUBLIC_URL (https URL sandboxes use to reach this server)');
    if (!llmKey) throw new Error('GATEWAY_TEMPLATE_* needs GATEWAY_LLM_API_KEY (the real provider key; it stays on the server)');

    const tokens = new LlmTokenStore();
    // Public (token-authenticated) route for sandboxes. Mounted before the user-authenticated v2 routes.
    root.use('/llm', createLlmProxyRouter({
      tokens, budget, upstream: { baseUrl: llmBase, apiKey: llmKey }, allowedModels: models,
      maxOutputTokens: int(env.GATEWAY_LLM_MAX_OUTPUT_TOKENS, 8192),
    }));

    const egress = env.GATEWAY_SANDBOX_EGRESS === 'proxy-only';
    if (!egress) console.warn('[gateway] sandbox egress is OPEN (set GATEWAY_SANDBOX_EGRESS=proxy-only to restrict it to the LLM proxy)');
    const idleMs = int(env.AGENT_SANDBOX_IDLE_MINUTES, 30) * 60_000;
    sandboxes = new E2BModeSandboxProvider({
      apiKey: e2bKey, launches,
      llm: (userId) => ({ baseUrl: `${publicUrl}/api/v2/llm/v1`, apiKey: tokens.mint(userId, DAY_MS), model: llmModel }),
      idleMs, bootTimeoutMs: 10 * 60_000,
      maxSandboxes: int(env.GATEWAY_MAX_SANDBOXES, 3),
      egressAllowHosts: egress ? [new URL(publicUrl).hostname] : undefined,
    });
    adapters.opencode = new OpenCodeAdapter();
    adapters.hermes = new HermesAdapter();
    adapters.openclaw = new OpenClawAdapter();
    proxiedBackends = ['opencode', 'hermes', 'openclaw'];
  }

  const service = new SessionService({ adapters, sandboxes, bus, approvals, budget, proxiedBackends });
  root.use('/', createV2Router({ authenticate: deps.authenticate, service, bus, approvals, budget, ratePerMinute: int(env.GATEWAY_RATE_PER_MINUTE, 120),
    models: { default: env.GATEWAY_CHAT_MODEL || llmModel, allowed: models } }));
  return root;
}
