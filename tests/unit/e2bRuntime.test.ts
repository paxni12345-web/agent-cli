import { E2BSandboxRuntime, E2BLike, E2BRuntimeOptions } from '../../src/sandbox/e2bRuntime.js';
import type { AcquireResult } from '../../src/sandbox/runtime.js';

interface Fake extends E2BLike { commands_: string[]; killed: boolean; running: boolean }
let made: Fake[];
let nodeMissing = false;
let appInstalled = false;
let puts: { url: string; body: string }[];

function fakeSandbox(n: number): Fake {
  const f: Fake = {
    sandboxId: `sbx-${n}`, trafficAccessToken: `traffic-${n}`, commands_: [], killed: false, running: true,
    getHost: port => `${port}-sbx-${n}.e2b.test`,
    isRunning: async () => f.running,
    setTimeout: async () => undefined,
    kill: async () => { f.killed = true; },
    commands: {
      run: async (cmd: string) => {
        f.commands_.push(cmd);
        if (cmd === 'node --version' && nodeMissing) throw new Error('not found');
        if (cmd.startsWith('test -f') && !appInstalled) throw new Error('missing');
        return {};
      },
    },
  };
  return f;
}
const fetchImpl = (async (url: string, init?: RequestInit) => {
  if (String(url).endsWith('/api/health')) return { ok: true };
  puts.push({ url: String(url), body: String(init?.body ?? '') });
  return { ok: true, status: 200 };
}) as unknown as typeof fetch;

function runtime(extra: Partial<E2BRuntimeOptions> = {}) {
  return new E2BSandboxRuntime({
    apiKey: 'e2b-key', repoUrl: 'https://github.com/o/r.git', ref: 'main', idleMs: 60_000, bootTimeoutMs: 5000, maxSandboxes: 5,
    model: () => ({ provider: 'anthropic', model: 'm1', apiKey: 'sk-model' }),
    create: async () => { const f = fakeSandbox(made.length + 1); made.push(f); return f; },
    fetchImpl, ...extra,
  });
}
async function ready(rt: E2BSandboxRuntime, uid: string): Promise<AcquireResult> {
  let r = await rt.acquire(uid);
  for (let i = 0; i < 100 && r.kind === 'starting'; i++) { await new Promise(res => setTimeout(res, 5)); r = await rt.acquire(uid); }
  return r;
}

beforeEach(() => { made = []; puts = []; nodeMissing = false; appInstalled = false; });

describe('E2B sandbox runtime', () => {
  it('starts a sandbox in the background, installs the app and hands back credentials', async () => {
    const rt = runtime();
    expect((await rt.acquire('u1')).kind).toBe('starting');
    const r = await ready(rt, 'u1');
    expect(r.kind).toBe('ready');
    if (r.kind !== 'ready') return;
    expect(r.handle.baseUrl).toBe('https://8080-sbx-1.e2b.test');
    expect(r.handle.headers['e2b-traffic-access-token']).toBe('traffic-1');
    expect(r.handle.headers.Authorization).toMatch(/^Bearer [0-9a-f]{64}$/);
    expect(made[0].commands_.some(c => c.includes('git clone --depth 1 --branch main https://github.com/o/r.git'))).toBe(true);
    expect(made[0].commands_.some(c => c.includes('dist/agent-server.js') && !c.startsWith('test'))).toBe(true);
  });

  it('skips the install when the template already has the app, and configures the model', async () => {
    appInstalled = true;
    const rt = runtime();
    await ready(rt, 'u1');
    expect(made[0].commands_.some(c => c.includes('git clone'))).toBe(false);
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe('https://8080-sbx-1.e2b.test/api/agent/settings');
    expect(JSON.parse(puts[0].body)).toMatchObject({ provider: 'anthropic', model: 'm1', apiKey: 'sk-model' });
  });

  it('gives every user a separate sandbox with a separate token', async () => {
    const rt = runtime();
    const a = await ready(rt, 'u1');
    const b = await ready(rt, 'u2');
    expect(made).toHaveLength(2);
    if (a.kind === 'ready' && b.kind === 'ready') {
      expect(a.handle.baseUrl).not.toBe(b.handle.baseUrl);
      expect(a.handle.headers.Authorization).not.toBe(b.handle.headers.Authorization);
    }
    expect((await rt.acquire('u1')).kind).toBe('ready');
    expect(made).toHaveLength(2);
  });

  it('refuses new sandboxes beyond the cap', async () => {
    const rt = runtime({ maxSandboxes: 1 });
    await ready(rt, 'u1');
    expect((await rt.acquire('u2')).kind).toBe('busy');
  });

  it('reports a clear failure, kills the sandbox and waits before retrying', async () => {
    nodeMissing = true;
    const rt = runtime();
    const r = await ready(rt, 'u1');
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.message).toContain('Node.js');
    expect(made[0].killed).toBe(true);
    expect((await rt.acquire('u1')).kind).toBe('failed');
    expect(made).toHaveLength(1);
  });

  it('starts a new sandbox when the old one has gone away', async () => {
    let t = 0;
    const rt = runtime({ now: () => t });
    await ready(rt, 'u1');
    made[0].running = false;
    t += 60_000;
    expect((await rt.acquire('u1')).kind).toBe('starting');
    await ready(rt, 'u1');
    expect(made).toHaveLength(2);
  });

  it('stop() kills the sandbox', async () => {
    const rt = runtime();
    await ready(rt, 'u1');
    await rt.stop('u1');
    expect(made[0].killed).toBe(true);
  });

  it('rejects unsafe repo arguments and a missing key', () => {
    expect(() => runtime({ repoUrl: 'x; rm -rf /' })).toThrow();
    expect(() => runtime({ apiKey: '' })).toThrow();
  });
});
