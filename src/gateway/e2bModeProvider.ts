import crypto from 'node:crypto';
import type { E2BLike } from '../sandbox/e2bRuntime.js';
import type { Mode } from './types.js';
import type { SandboxAcquire, SandboxProvider } from './sessionService.js';

/** E2B sandbox that can also receive files (the SDK has `sandbox.files.write`). */
export interface E2BModeLike extends E2BLike {
  files: { write(path: string, data: string): Promise<unknown> };
}

/** Where the sandbox's LLM traffic goes. Should be the gateway's own proxy with a per-user token, never a real key. */
export interface LlmEndpoint { baseUrl: string; apiKey: string; model: string }

export interface LaunchContext { secret: string; llm: LlmEndpoint; port: number }

/** How to start one upstream (OpenCode or Hermes) inside an E2B template that already has it installed. */
export interface ModeLaunch {
  /** E2B template with the upstream preinstalled and pinned. There is no install step at boot. */
  template: string;
  port: number;
  healthPath: string;
  /** Header value that authenticates against the upstream (also used for the health probe). */
  authorization(secret: string): string;
  files(ctx: LaunchContext): Record<string, string>;
  command: string;
  cwd: string;
  envs(ctx: LaunchContext): Record<string, string>;
}

const WORKSPACE = '/home/user/workspace';

/** OpenCode `serve`. Config + env follow audit-opencode.md (VERIFIED against 1.18.35). */
export function opencodeLaunch(template: string): ModeLaunch {
  const cfgPath = '/home/user/opencode.json';
  return {
    template, port: 4096, healthPath: '/global/health', cwd: WORKSPACE,
    authorization: (secret) => `Basic ${Buffer.from(`opencode:${secret}`).toString('base64')}`,
    command: 'opencode serve --port 4096 --hostname 0.0.0.0',
    files: ({ llm }) => ({
      [cfgPath]: JSON.stringify({
        $schema: 'https://opencode.ai/config.json', share: 'disabled', autoupdate: false,
        model: `gateway/${llm.model}`, small_model: `gateway/${llm.model}`,
        provider: { gateway: { npm: '@ai-sdk/openai-compatible', name: 'gateway', options: { baseURL: llm.baseUrl, apiKey: llm.apiKey }, models: { [llm.model]: { name: llm.model, tool_call: true } } } },
        permission: { bash: 'ask', edit: 'ask', external_directory: { '*': 'deny' } },
      }, null, 2),
    }),
    envs: ({ secret }) => ({
      OPENCODE_SERVER_PASSWORD: secret, OPENCODE_CONFIG: cfgPath, HOME: '/home/user/oc-home',
      OPENCODE_DISABLE_SHARE: '1', OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_MODELS_FETCH: '1',
      OPENCODE_DISABLE_EXTERNAL_SKILLS: '1', OPENCODE_DISABLE_DEFAULT_PLUGINS: '1', OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
    }),
  };
}

/** Hermes `gateway run` with the API server on. Env names follow audit-hermes.md (VERIFIED: the API_SERVER_* ones). */
export function hermesLaunch(template: string): ModeLaunch {
  const home = '/tmp/hh'; // HERMES_HOME must be short (unix socket path limit)
  return {
    template, port: 8642, healthPath: '/health', cwd: WORKSPACE,
    authorization: (secret) => `Bearer ${secret}`,
    command: 'hermes gateway run',
    files: ({ llm }) => ({
      [`${home}/config.yaml`]: ['model:', `  default: ${JSON.stringify(llm.model)}`, '  provider: custom', `  base_url: ${JSON.stringify(llm.baseUrl)}`, `  api_key: ${JSON.stringify(llm.apiKey)}`, ''].join('\n'),
    }),
    envs: ({ secret, port }) => ({
      HERMES_HOME: home, API_SERVER_ENABLED: 'true', API_SERVER_KEY: secret, API_SERVER_PORT: String(port), API_SERVER_HOST: '0.0.0.0',
      HERMES_CUA_TELEMETRY: '0', HERMES_DISABLE_PLUGINS: '1', HERMES_DISABLE_LAZY_INSTALLS: '1',
    }),
  };
}

/**
 * OpenClaw gateway. VERIFIED in a run of 2026.9.9: port 18789, open /health, OPENCLAW_CONFIG_PATH + OPENCLAW_STATE_DIR,
 * token auth, `tools.exec.mode:"ask"`, `update.checkOnStart` / `update.auto.enabled`, `gateway.controlUi.enabled`.
 * NOT verified (config schema is strict, so a wrong key makes the gateway refuse to start and boot fails visibly):
 * the `gateway run` command line, `gateway.auth.token`, `gateway.bind`, and the custom-provider block under `models`.
 */
export function openclawLaunch(template: string): ModeLaunch {
  const cfgPath = '/home/user/openclaw.json';
  return {
    template, port: 18789, healthPath: '/health', cwd: WORKSPACE,
    authorization: (secret) => `Bearer ${secret}`,
    command: 'openclaw gateway run',
    files: ({ llm, secret }) => ({
      [cfgPath]: JSON.stringify({
        gateway: { bind: 'lan', auth: { mode: 'token', token: secret }, controlUi: { enabled: false } },
        tools: { exec: { mode: 'ask' } },
        update: { checkOnStart: false, auto: { enabled: false } },
        plugins: { allow: [] },
        models: { providers: { gateway: { baseUrl: llm.baseUrl, apiKey: llm.apiKey, api: 'openai-completions', models: [{ id: llm.model, name: llm.model }] } } },
        agents: { defaults: { model: { primary: `gateway/${llm.model}` }, workspace: WORKSPACE } },
      }, null, 2),
    }),
    envs: () => ({ OPENCLAW_CONFIG_PATH: cfgPath, OPENCLAW_STATE_DIR: '/home/user/oc-state', HOME: '/home/user' }),
  };
}

export interface E2BModeProviderOptions {
  apiKey: string;
  /** Modes without an entry are reported as not configured. */
  launches: Partial<Record<Mode, ModeLaunch>>;
  llm(userId: string, mode: Mode): LlmEndpoint | null;
  idleMs: number;
  bootTimeoutMs: number;
  maxSandboxes: number;
  create?: (opts: { template: string; apiKey: string; timeoutMs: number; metadata: Record<string, string> }) => Promise<E2BModeLike>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  healthPollMs?: number;
}

interface Entry {
  state: 'starting' | 'ready' | 'failed';
  sandbox?: E2BModeLike;
  endpoint?: SandboxAcquire & { kind: 'ready' };
  error?: string;
  failedAt?: number;
  checkedAt: number;
  extendedAt: number;
}

const FAILURE_COOLDOWN_MS = 30_000;
const RECHECK_MS = 30_000;
const EXTEND_MS = 60_000;

/** One E2B sandbox per user and mode, booted without blocking the request. Same state machine as E2BSandboxRuntime. */
export class E2BModeSandboxProvider implements SandboxProvider {
  private readonly entries = new Map<string, Entry>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly o: E2BModeProviderOptions) {
    if (!o.apiKey) throw new Error('E2B_API_KEY is required for the gateway sandbox provider');
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.now = o.now ?? Date.now;
  }

  async acquire(userId: string, mode: Mode): Promise<SandboxAcquire> {
    const launch = this.o.launches[mode];
    if (!launch) return { kind: 'failed', message: `mode "${mode}" has no sandbox template configured` };
    const key = `${userId}|${mode}`;
    const t = this.now();
    const entry = this.entries.get(key);
    if (entry?.state === 'starting') return { kind: 'starting' };
    if (entry?.state === 'failed') {
      if (t - (entry.failedAt ?? 0) < FAILURE_COOLDOWN_MS) return { kind: 'failed', message: entry.error ?? 'The sandbox could not start' };
      this.entries.delete(key);
    } else if (entry?.state === 'ready' && entry.sandbox && entry.endpoint) {
      if (t - entry.checkedAt > RECHECK_MS) {
        entry.checkedAt = t;
        const alive = await entry.sandbox.isRunning().catch(() => false);
        if (!alive) this.entries.delete(key);
        else return this.ready(entry, t);
      } else {
        return this.ready(entry, t);
      }
    }
    if (this.entries.size >= this.o.maxSandboxes) return { kind: 'busy' };
    const llm = this.o.llm(userId, mode);
    if (!llm) return { kind: 'failed', message: 'No model is configured for sandboxes' };
    const fresh: Entry = { state: 'starting', checkedAt: t, extendedAt: t };
    this.entries.set(key, fresh);
    void this.boot(userId, mode, launch, llm, fresh);
    return { kind: 'starting' };
  }

  async stop(userId: string, mode: Mode): Promise<void> {
    const key = `${userId}|${mode}`;
    const entry = this.entries.get(key);
    this.entries.delete(key);
    await entry?.sandbox?.kill().catch(() => undefined);
  }

  private ready(entry: Entry, t: number): SandboxAcquire {
    if (t - entry.extendedAt > EXTEND_MS) {
      entry.extendedAt = t;
      void entry.sandbox?.setTimeout(this.o.idleMs).catch(() => undefined);
    }
    return entry.endpoint as SandboxAcquire;
  }

  private async boot(userId: string, mode: Mode, launch: ModeLaunch, llm: LlmEndpoint, entry: Entry): Promise<void> {
    let sandbox: E2BModeLike | undefined;
    try {
      const metadata = { app: 'agent-cli-gateway', mode, user: crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16) };
      sandbox = await (this.o.create ?? defaultCreate)({ template: launch.template, apiKey: this.o.apiKey, timeoutMs: this.o.idleMs, metadata });
      entry.sandbox = sandbox;
      const secret = crypto.randomBytes(32).toString('hex'); // a fresh secret per sandbox; only the gateway knows it
      const ctx: LaunchContext = { secret, llm, port: launch.port };
      await sandbox.commands.run(`mkdir -p ${launch.cwd}`, { timeoutMs: 20_000 });
      for (const [path, data] of Object.entries(launch.files(ctx))) await sandbox.files.write(path, data);
      await sandbox.commands.run(launch.command, { background: true, cwd: launch.cwd, envs: launch.envs(ctx) });

      const headers: Record<string, string> = {};
      if (sandbox.trafficAccessToken) headers['e2b-traffic-access-token'] = sandbox.trafficAccessToken;
      const baseUrl = `https://${sandbox.getHost(launch.port)}`;
      await this.waitHealthy(baseUrl, { ...headers, authorization: launch.authorization(secret) }, launch.healthPath);

      entry.endpoint = { kind: 'ready', endpoint: { baseUrl, secret, sandboxId: sandbox.sandboxId, headers } };
      entry.state = 'ready';
      const t = this.now();
      entry.checkedAt = t;
      entry.extendedAt = t;
    } catch (error) {
      entry.state = 'failed';
      entry.failedAt = this.now();
      entry.error = error instanceof Error ? error.message : 'The sandbox could not start';
      console.error(`[gateway-sandbox] boot failed (${mode}): ${entry.error}`);
      await sandbox?.kill().catch(() => undefined);
      entry.sandbox = undefined;
    }
  }

  private async waitHealthy(baseUrl: string, headers: Record<string, string>, path: string): Promise<void> {
    const deadline = this.now() + Math.min(this.o.bootTimeoutMs, 120_000);
    while (this.now() < deadline) {
      try {
        const res = await this.fetchImpl(`${baseUrl}${path}`, { headers, signal: AbortSignal.timeout(5000) });
        if (res.ok) return;
      } catch { /* not up yet */ }
      await new Promise((resolve) => setTimeout(resolve, this.o.healthPollMs ?? 1500));
    }
    throw new Error('The agent inside the sandbox did not become ready in time');
  }
}

async function defaultCreate(opts: { template: string; apiKey: string; timeoutMs: number; metadata: Record<string, string> }): Promise<E2BModeLike> {
  const { Sandbox } = await import('e2b'); // loaded only when the gateway is enabled
  // TODO(egress): allowInternetAccess stays true until an allow-list to the LLM proxy is set up; see ARCHITECTURE §5.
  return (await Sandbox.create(opts.template, { apiKey: opts.apiKey, timeoutMs: opts.timeoutMs, metadata: opts.metadata, allowInternetAccess: true })) as unknown as E2BModeLike;
}
