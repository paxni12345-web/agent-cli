import { E2BModeSandboxProvider, hermesLaunch, opencodeLaunch, type E2BModeLike } from '../../src/gateway/e2bModeProvider.js';
import { createGatewayFromEnv } from '../../src/gateway/mount.js';
import type { SandboxAcquire } from '../../src/gateway/sessionService.js';

interface Fake extends E2BModeLike { runs: Array<{ cmd: string; opts: any }>; written: Record<string, string>; killed: number; alive: boolean }

function fakeSandbox(extra: Partial<Fake> = {}): Fake {
  const f: Fake = {
    sandboxId: 'sb-1', trafficAccessToken: 'traffic', runs: [], written: {}, killed: 0, alive: true,
    getHost: (port) => `${port}-sb-1.e2b.test`,
    isRunning: async () => f.alive,
    setTimeout: async () => undefined,
    kill: async () => { f.killed += 1; },
    commands: { run: async (cmd: string, opts?: Record<string, unknown>) => { f.runs.push({ cmd, opts }); return {}; } },
    files: { write: async (path: string, data: string) => { f.written[path] = data; } },
    ...extra,
  };
  return f;
}

const llm = { baseUrl: 'https://proxy.test/v1', apiKey: 'proxy-token', model: 'm1' };
const until = async (fn: () => Promise<SandboxAcquire>, pred: (r: SandboxAcquire) => boolean): Promise<SandboxAcquire> => {
  for (let i = 0; i < 100; i += 1) { const r = await fn(); if (pred(r)) return r; await new Promise((x) => setTimeout(x, 5)); }
  throw new Error('timed out');
};

function make(over: Partial<ConstructorParameters<typeof E2BModeSandboxProvider>[0]> = {}) {
  const boxes: Fake[] = [];
  const healthCalls: Array<{ url: string; headers: Record<string, string> }> = [];
  const p = new E2BModeSandboxProvider({
    apiKey: 'k', launches: { code: opencodeLaunch('tpl-oc'), agent: hermesLaunch('tpl-hm') }, llm: () => llm,
    idleMs: 1000, bootTimeoutMs: 1000, maxSandboxes: 2, healthPollMs: 1,
    create: async () => { const b = fakeSandbox(); boxes.push(b); return b; },
    fetchImpl: (async (url: string, init: any) => { healthCalls.push({ url, headers: init.headers }); return { ok: true } as Response; }) as unknown as typeof fetch,
    ...over,
  });
  return { p, boxes, healthCalls };
}

describe('E2BModeSandboxProvider', () => {
  it('boots OpenCode: config file, hardened env, health probe with auth + traffic token, endpoint carries the secret', async () => {
    const { p, boxes, healthCalls } = make();
    expect((await p.acquire('u1', 'code')).kind).toBe('starting');
    const r = await until(() => p.acquire('u1', 'code'), (x) => x.kind === 'ready');
    if (r.kind !== 'ready') throw new Error('unreachable');
    const box = boxes[0];
    const start = box.runs.find((c) => c.cmd.startsWith('opencode serve'))!;
    expect(start.opts.background).toBe(true);
    expect(start.opts.envs).toMatchObject({ OPENCODE_DISABLE_SHARE: '1', OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_MODELS_FETCH: '1' });
    expect(start.opts.envs.OPENCODE_SERVER_PASSWORD).toBe(r.endpoint.secret);
    expect(r.endpoint.secret).toMatch(/^[0-9a-f]{64}$/);
    const cfg = JSON.parse(box.written['/home/user/opencode.json']);
    expect(cfg.permission).toMatchObject({ bash: 'ask', external_directory: { '*': 'deny' } });
    expect(cfg.provider.gateway.options).toEqual({ baseURL: llm.baseUrl, apiKey: llm.apiKey });
    expect(r.endpoint).toMatchObject({ baseUrl: 'https://4096-sb-1.e2b.test', sandboxId: 'sb-1', headers: { 'e2b-traffic-access-token': 'traffic' } });
    expect(healthCalls[0].url).toBe('https://4096-sb-1.e2b.test/global/health');
    expect(healthCalls[0].headers.authorization).toBe(`Basic ${Buffer.from(`opencode:${r.endpoint.secret}`).toString('base64')}`);
  });

  it('boots Hermes with a >=16 char key, short HERMES_HOME and its config', async () => {
    const { p, boxes } = make();
    await p.acquire('u1', 'agent');
    const r = await until(() => p.acquire('u1', 'agent'), (x) => x.kind === 'ready');
    if (r.kind !== 'ready') throw new Error('unreachable');
    const env = boxes[0].runs.find((c) => c.cmd === 'hermes gateway run')!.opts.envs;
    expect(env.API_SERVER_KEY).toBe(r.endpoint.secret);
    expect(env.API_SERVER_KEY.length).toBeGreaterThanOrEqual(16);
    expect(env.HERMES_HOME).toBe('/tmp/hh');
    expect(boxes[0].written['/tmp/hh/config.yaml']).toContain('base_url: "https://proxy.test/v1"');
  });

  it('reuses a ready sandbox per user+mode and keeps users apart', async () => {
    const { p, boxes } = make();
    await p.acquire('u1', 'code');
    const a = await until(() => p.acquire('u1', 'code'), (x) => x.kind === 'ready');
    const again = await p.acquire('u1', 'code');
    expect(again).toBe(a);
    await p.acquire('u2', 'code');
    await until(() => p.acquire('u2', 'code'), (x) => x.kind === 'ready');
    expect(boxes).toHaveLength(2);
    expect(((a as any).endpoint.secret)).not.toBe((await p.acquire('u2', 'code') as any).endpoint.secret);
  });

  it('caps the number of sandboxes', async () => {
    const { p } = make({ maxSandboxes: 1 });
    await p.acquire('u1', 'code');
    expect((await p.acquire('u2', 'code')).kind).toBe('busy');
  });

  it('reports unconfigured modes and a missing model without creating anything', async () => {
    const { p, boxes } = make();
    expect(await p.acquire('u1', 'work')).toEqual({ kind: 'failed', message: expect.stringContaining('no sandbox template') });
    const none = make({ llm: () => null });
    expect((await none.p.acquire('u1', 'code')).kind).toBe('failed');
    expect(boxes).toHaveLength(0);
    expect(none.boxes).toHaveLength(0);
  });

  it('a failed boot kills the sandbox, reports the error, and is cooled down before retrying', async () => {
    let t = 0;
    const box = fakeSandbox({ commands: { run: async (cmd: string) => { if (cmd.startsWith('opencode serve')) throw new Error('no such binary'); return {}; } } });
    const { p } = make({ create: async () => box, now: () => t });
    await p.acquire('u1', 'code');
    const r = await until(() => p.acquire('u1', 'code'), (x) => x.kind === 'failed');
    expect(r).toEqual({ kind: 'failed', message: 'no such binary' });
    expect(box.killed).toBe(1);
    t = 31_000;
    expect((await p.acquire('u1', 'code')).kind).toBe('starting'); // cooldown over: a new attempt
  });

  it('a sandbox that died is replaced; stop() kills it', async () => {
    let t = 0;
    const { p, boxes } = make({ now: () => t });
    await p.acquire('u1', 'code');
    await until(() => p.acquire('u1', 'code'), (x) => x.kind === 'ready');
    boxes[0].alive = false;
    t = 40_000;
    expect((await p.acquire('u1', 'code')).kind).toBe('starting');
    await p.stop('u1', 'code');
  });
});

describe('createGatewayFromEnv', () => {
  const auth = async () => ({ uid: 'u' });
  const base = { GATEWAY_V2: '1', E2B_API_KEY: 'k', GATEWAY_LLM_BASE_URL: 'https://p/v1', GATEWAY_LLM_MODEL: 'm', GATEWAY_TEMPLATE_CODE: 't' } as NodeJS.ProcessEnv;

  it('is off unless GATEWAY_V2=1', () => {
    expect(createGatewayFromEnv({ authenticate: auth, env: {} as NodeJS.ProcessEnv })).toBeNull();
  });
  it('fails closed on missing settings', () => {
    expect(() => createGatewayFromEnv({ authenticate: auth, env: { ...base, E2B_API_KEY: '' } })).toThrow(/E2B_API_KEY/);
    expect(() => createGatewayFromEnv({ authenticate: auth, env: { ...base, GATEWAY_LLM_MODEL: '' } })).toThrow(/GATEWAY_LLM/);
    expect(() => createGatewayFromEnv({ authenticate: auth, env: { ...base, GATEWAY_TEMPLATE_CODE: '' } })).toThrow(/GATEWAY_TEMPLATE/);
  });
  it('returns a router when configured', () => {
    expect(typeof createGatewayFromEnv({ authenticate: auth, env: base })).toBe('function');
  });
});
