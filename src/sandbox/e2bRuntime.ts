import crypto from 'crypto';
import type { AcquireResult, ModelSettings, SandboxHandle, SandboxRuntime } from './runtime.js';

/** The slice of the E2B SDK that this runtime touches (so tests can fake it). */
export interface E2BLike {
  sandboxId: string;
  trafficAccessToken?: string;
  getHost(port: number): string;
  isRunning(): Promise<boolean>;
  setTimeout(timeoutMs: number): Promise<void>;
  kill(): Promise<unknown>;
  commands: { run(cmd: string, opts?: Record<string, unknown>): Promise<unknown> };
}

export interface E2BRuntimeOptions {
  apiKey: string;
  /** Optional custom template that already has the app built at APP_DIR (skips the install step). */
  template?: string;
  repoUrl: string;
  ref: string;
  idleMs: number;
  bootTimeoutMs: number;
  maxSandboxes: number;
  agentPort?: number;
  model: () => ModelSettings | null;
  create?: (opts: { template?: string; apiKey: string; timeoutMs: number; metadata: Record<string, string> }) => Promise<E2BLike>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const APP_DIR = '/home/user/agent';
const WORKSPACE_DIR = '/home/user/workspace';
const SAFE_ARG = /^[A-Za-z0-9_./:@+-]+$/;
const FAILURE_COOLDOWN_MS = 30_000;
const RECHECK_MS = 30_000;
const EXTEND_MS = 60_000;

interface Entry {
  state: 'starting' | 'ready' | 'failed';
  sandbox?: E2BLike;
  handle?: SandboxHandle;
  error?: string;
  failedAt?: number;
  checkedAt: number;
  extendedAt: number;
}

export class E2BSandboxRuntime implements SandboxRuntime {
  private entries = new Map<string, Entry>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly port: number;

  constructor(private readonly options: E2BRuntimeOptions) {
    if (!options.apiKey) throw new Error('E2B_API_KEY is required for sandbox mode');
    if (!SAFE_ARG.test(options.repoUrl) || !SAFE_ARG.test(options.ref)) throw new Error('AGENT_SANDBOX_REPO / AGENT_SANDBOX_REF contain unsupported characters');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.port = options.agentPort ?? 8080;
  }

  async acquire(uid: string): Promise<AcquireResult> {
    const entry = this.entries.get(uid);
    const t = this.now();
    if (entry?.state === 'starting') return { kind: 'starting' };
    if (entry?.state === 'failed') {
      if (t - (entry.failedAt ?? 0) < FAILURE_COOLDOWN_MS) return { kind: 'failed', message: entry.error ?? 'The sandbox could not start' };
      this.entries.delete(uid);
    } else if (entry?.state === 'ready' && entry.sandbox && entry.handle) {
      if (t - entry.checkedAt > RECHECK_MS) {
        entry.checkedAt = t;
        const alive = await entry.sandbox.isRunning().catch(() => false);
        if (!alive) this.entries.delete(uid);
        else return this.ready(entry, t);
      } else {
        return this.ready(entry, t);
      }
    }
    if (this.entries.size >= this.options.maxSandboxes) return { kind: 'busy' };
    const fresh: Entry = { state: 'starting', checkedAt: t, extendedAt: t };
    this.entries.set(uid, fresh);
    void this.boot(uid, fresh);
    return { kind: 'starting' };
  }

  async stop(uid: string): Promise<void> {
    const entry = this.entries.get(uid);
    this.entries.delete(uid);
    await entry?.sandbox?.kill().catch(() => undefined);
  }

  private ready(entry: Entry, t: number): AcquireResult {
    if (t - entry.extendedAt > EXTEND_MS) {
      entry.extendedAt = t;
      void entry.sandbox?.setTimeout(this.options.idleMs).catch(() => undefined);
    }
    return { kind: 'ready', handle: entry.handle as SandboxHandle };
  }

  private async boot(uid: string, entry: Entry): Promise<void> {
    let sandbox: E2BLike | undefined;
    try {
      const metadata = { app: 'agent-cli', user: crypto.createHash('sha256').update(uid).digest('hex').slice(0, 16) };
      const create = this.options.create ?? defaultCreate;
      sandbox = await create({ template: this.options.template, apiKey: this.options.apiKey, timeoutMs: this.options.idleMs, metadata });
      entry.sandbox = sandbox;

      await sandbox.commands.run('node --version', { timeoutMs: 20_000 }).catch(() => {
        throw new Error('The sandbox image has no Node.js; set E2B_TEMPLATE to a template with Node 20 or newer');
      });
      const installed = await sandbox.commands.run(`test -f ${APP_DIR}/dist/agent-server.js`, { timeoutMs: 20_000 }).then(() => true, () => false);
      if (!installed) {
        await sandbox.commands.run(
          `git clone --depth 1 --branch ${this.options.ref} ${this.options.repoUrl} ${APP_DIR} && cd ${APP_DIR} && npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/ && npm run build`,
          { timeoutMs: this.options.bootTimeoutMs },
        );
      }
      await sandbox.commands.run(`mkdir -p ${WORKSPACE_DIR}`, { timeoutMs: 20_000 });

      const token = crypto.randomBytes(32).toString('hex');
      await sandbox.commands.run(`node ${APP_DIR}/dist/agent-server.js`, {
        background: true,
        cwd: WORKSPACE_DIR,
        envs: { AGENT_SERVER_HOST: '0.0.0.0', PORT: String(this.port), AGENT_SERVER_API_KEY: token, NODE_ENV: 'production' },
      });

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (sandbox.trafficAccessToken) headers['e2b-traffic-access-token'] = sandbox.trafficAccessToken;
      const handle: SandboxHandle = { baseUrl: `https://${sandbox.getHost(this.port)}`, headers };

      await this.waitHealthy(handle);
      const model = this.options.model();
      if (model) await this.configureModel(handle, model);

      entry.handle = handle;
      entry.state = 'ready';
      const t = this.now();
      entry.checkedAt = t;
      entry.extendedAt = t;
    } catch (error) {
      entry.state = 'failed';
      entry.failedAt = this.now();
      entry.error = error instanceof Error ? error.message : 'The sandbox could not start';
      console.error(`[sandbox] boot failed: ${entry.error}`);
      await sandbox?.kill().catch(() => undefined);
      entry.sandbox = undefined;
    }
  }

  private async waitHealthy(handle: SandboxHandle): Promise<void> {
    const deadline = this.now() + Math.min(this.options.bootTimeoutMs, 120_000);
    while (this.now() < deadline) {
      try {
        const res = await this.fetchImpl(`${handle.baseUrl}/api/health`, { headers: handle.headers, signal: AbortSignal.timeout(5000) });
        if (res.ok) return;
      } catch { /* not up yet */ }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error('The agent inside the sandbox did not become ready in time');
  }

  private async configureModel(handle: SandboxHandle, model: ModelSettings): Promise<void> {
    const res = await this.fetchImpl(`${handle.baseUrl}/api/agent/settings`, {
      method: 'PUT',
      headers: { ...handle.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: model.provider, model: model.model, apiKey: model.apiKey, baseUrl: model.baseUrl, thinkingLevel: model.thinkingLevel }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Could not configure the model inside the sandbox (${res.status})`);
  }
}

async function defaultCreate(opts: { template?: string; apiKey: string; timeoutMs: number; metadata: Record<string, string> }): Promise<E2BLike> {
  const { Sandbox } = await import('e2b'); // loaded only when sandbox mode is on
  const base = { apiKey: opts.apiKey, timeoutMs: opts.timeoutMs, metadata: opts.metadata, allowInternetAccess: true };
  return (opts.template ? await Sandbox.create(opts.template, base) : await Sandbox.create(base)) as unknown as E2BLike;
}
