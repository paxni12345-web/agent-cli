import type { Request, Response, Router } from 'express';
import { InMemoryApprovalStore } from './approvalStore.js';
import { InMemoryBudgetService } from './budget.js';
import { InMemoryEventBus } from './eventBus.js';
import { E2BModeSandboxProvider, hermesLaunch, opencodeLaunch, type ModeLaunch } from './e2bModeProvider.js';
import { HermesAdapter } from './hermesAdapter.js';
import { OpenCodeAdapter } from './opencodeAdapter.js';
import { SessionService } from './sessionService.js';
import type { Mode } from './types.js';
import { createV2Router, type V2Identity } from './v2Router.js';

export interface GatewayMountDeps {
  authenticate(req: Request, res: Response): Promise<V2Identity | null>;
  env?: NodeJS.ProcessEnv;
}

const int = (v: string | undefined, d: number): number => Number.parseInt(v ?? '', 10) || d;

/**
 * Builds the /api/v2 router from environment variables, or returns null when GATEWAY_V2 is not "1".
 * Fails closed: asking for the gateway with missing sandbox or model settings throws instead of
 * running without isolation.
 */
export function createGatewayFromEnv(deps: GatewayMountDeps): Router | null {
  const env = deps.env ?? process.env;
  if (env.GATEWAY_V2 !== '1') return null;

  const e2bKey = env.E2B_API_KEY ?? '';
  if (!e2bKey) throw new Error('GATEWAY_V2=1 needs E2B_API_KEY');
  const llmBase = env.GATEWAY_LLM_BASE_URL ?? '';
  const llmModel = env.GATEWAY_LLM_MODEL ?? '';
  if (!llmBase || !llmModel) throw new Error('GATEWAY_V2=1 needs GATEWAY_LLM_BASE_URL and GATEWAY_LLM_MODEL');

  const launches: Partial<Record<Mode, ModeLaunch>> = {};
  if (env.GATEWAY_TEMPLATE_CODE) launches.code = opencodeLaunch(env.GATEWAY_TEMPLATE_CODE);
  if (env.GATEWAY_TEMPLATE_WORK) launches.work = hermesLaunch(env.GATEWAY_TEMPLATE_WORK);
  if (env.GATEWAY_TEMPLATE_AGENT) launches.agent = hermesLaunch(env.GATEWAY_TEMPLATE_AGENT);
  if (!Object.keys(launches).length) throw new Error('GATEWAY_V2=1 needs at least one of GATEWAY_TEMPLATE_CODE / _WORK / _AGENT');

  const bus = new InMemoryEventBus();
  const approvals = new InMemoryApprovalStore();
  const budget = new InMemoryBudgetService({
    dailyTokenLimit: int(env.GATEWAY_DAILY_TOKENS, 200_000),
    dailyCostLimitMicroUsd: env.GATEWAY_DAILY_COST_MICRO_USD ? int(env.GATEWAY_DAILY_COST_MICRO_USD, 0) || null : null,
    priceInPerMTokMicroUsd: int(env.GATEWAY_PRICE_IN_MICRO_PER_MTOK, 0),
    priceOutPerMTokMicroUsd: int(env.GATEWAY_PRICE_OUT_MICRO_PER_MTOK, 0),
  });
  const sandboxes = new E2BModeSandboxProvider({
    apiKey: e2bKey, launches,
    // v1: one shared endpoint/key. It ends up inside the sandbox, so it MUST be a proxy token, never a provider key.
    llm: () => ({ baseUrl: llmBase, apiKey: env.GATEWAY_LLM_API_KEY ?? 'unused', model: llmModel }),
    idleMs: int(env.AGENT_SANDBOX_IDLE_MINUTES, 30) * 60_000,
    bootTimeoutMs: 10 * 60_000,
    maxSandboxes: int(env.GATEWAY_MAX_SANDBOXES, 3),
  });
  const service = new SessionService({
    adapters: { opencode: new OpenCodeAdapter(), hermes: new HermesAdapter() },
    sandboxes, bus, approvals, budget,
  });
  return createV2Router({ authenticate: deps.authenticate, service, bus, approvals, budget, ratePerMinute: int(env.GATEWAY_RATE_PER_MINUTE, 120) });
}
