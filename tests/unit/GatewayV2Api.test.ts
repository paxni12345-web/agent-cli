import express from 'express';
import type { Server } from 'http';
import { InMemoryApprovalStore } from '../../src/gateway/approvalStore.js';
import { InMemoryBudgetService } from '../../src/gateway/budget.js';
import { InMemoryEventBus } from '../../src/gateway/eventBus.js';
import { SessionService, type SandboxAcquire } from '../../src/gateway/sessionService.js';
import { createV2Router } from '../../src/gateway/v2Router.js';
import type { AgentAdapter, ApprovalChoice, ApprovalRequest, PublishedEvent, SandboxEndpoint } from '../../src/gateway/types.js';

/** Scripted adapter: tests push upstream events and inspect what the gateway asked of it. */
class FakeAdapter implements AgentAdapter {
  readonly backend = 'opencode' as const;
  sent: string[] = [];
  approved: Array<{ upstreamId: string; choice: ApprovalChoice }> = [];
  stopped = 0;
  failApprove = false;
  private queue: PublishedEvent[] = [];
  private wake: (() => void) | null = null;
  emit(e: PublishedEvent) { this.queue.push(e); this.wake?.(); }
  async createSession() { return { upstreamId: 'up-1' }; }
  async send(_ep: SandboxEndpoint, _ref: unknown, input: { text: string }) { this.sent.push(input.text); }
  async *events(_ep: SandboxEndpoint, _ref: unknown, signal: AbortSignal): AsyncGenerator<PublishedEvent> {
    while (!signal.aborted) {
      while (this.queue.length) yield this.queue.shift()!;
      await new Promise<void>((r) => { this.wake = r; signal.addEventListener('abort', () => r(), { once: true }); });
    }
  }
  async approve(_ep: SandboxEndpoint, _ref: unknown, a: ApprovalRequest, choice: ApprovalChoice) {
    if (this.failApprove) throw new Error('upstream down');
    this.approved.push({ upstreamId: a.upstreamId, choice });
  }
  async stop() { this.stopped += 1; }
  async health() { return true; }
  listFiles = async () => [{ path: 'a.ts', type: 'file' as const }];
  readFile = async () => ({ content: 'x', truncated: false });
}

const ENDPOINT: SandboxEndpoint = { baseUrl: 'http://sandbox', secret: 's', sandboxId: 'sb' };
const tokens: Record<string, { uid: string } | null> = { a: { uid: 'user-a' }, b: { uid: 'user-b' }, none: null };

let server: Server;
let base: string;
let adapter: FakeAdapter;
let acquire: SandboxAcquire;
let budget: InMemoryBudgetService;
let bus: InMemoryEventBus;

beforeEach(async () => {
  adapter = new FakeAdapter();
  acquire = { kind: 'ready', endpoint: ENDPOINT };
  budget = new InMemoryBudgetService({ dailyTokenLimit: 100 });
  bus = new InMemoryEventBus();
  const approvals = new InMemoryApprovalStore();
  const service = new SessionService({
    adapters: { opencode: adapter, hermes: adapter }, sandboxes: { acquire: async () => acquire }, bus, approvals, budget,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v2', createV2Router({
    authenticate: async (req, res) => {
      const who = tokens[req.header('authorization')?.replace('Bearer ', '') ?? 'none'];
      if (!who) { res.status(401).json({ error: 'Unauthorized' }); return null; }
      return who;
    },
    service, bus, approvals, budget, maxInputChars: 50, heartbeatMs: 60_000,
    models: { default: 'iris-parallel', allowed: ['iris-parallel', 'iris-dream'] },
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api/v2`;
});
afterEach(async () => {
  const s = server;
  s.closeAllConnections?.();
  await new Promise<void>((resolve) => s.close(() => resolve()));
});

const call = (who: string, path: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
const post = (who: string, path: string, body: unknown) => call(who, path, { method: 'POST', body: JSON.stringify(body) });
async function create(who = 'a', mode = 'code'): Promise<string> {
  const r = await post(who, '/sessions', { mode });
  expect(r.status).toBe(201);
  return ((await r.json()) as { id: string }).id;
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/** Reads SSE frames until `stop` matches; aborts the connection afterwards. */
async function readSse(who: string, id: string, stop: (e: any) => boolean, headers: Record<string, string> = {}): Promise<Array<{ id: string; event: string; data: any }>> {
  const ac = new AbortController();
  const res = await call(who, `/sessions/${id}/events`, { headers, signal: ac.signal });
  const frames: Array<{ id: string; event: string; data: any }> = [];
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += decoder.decode(chunk, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        if (block.startsWith(':')) continue;
        const f: any = {};
        for (const line of block.split('\n')) { const k = line.slice(0, line.indexOf(':')); f[k] = line.slice(line.indexOf(':') + 2); }
        frames.push({ id: f.id, event: f.event, data: JSON.parse(f.data) });
        if (stop(frames.at(-1)!.data)) { ac.abort(); return frames; }
      }
    }
  } catch { /* aborted */ }
  return frames;
}

describe('v2 sessions', () => {
  it('requires authentication and a valid mode', async () => {
    expect((await call('none', '/usage')).status).toBe(401);
    expect((await post('a', '/sessions', { mode: 'nope' })).status).toBe(400);
  });

  it('maps sandbox states to HTTP statuses', async () => {
    acquire = { kind: 'starting' };
    const starting = await post('a', '/sessions', { mode: 'code' });
    expect(starting.status).toBe(202);
    acquire = { kind: 'busy' };
    const busy = await post('a', '/sessions', { mode: 'code' });
    expect(busy.status).toBe(429);
    expect(busy.headers.get('retry-after')).toBe('10');
    acquire = { kind: 'failed', message: 'boom' };
    expect((await post('a', '/sessions', { mode: 'code' })).status).toBe(502);
  });

  it('501 when the backend for a mode has no adapter (chat has none yet)', async () => {
    expect((await post('a', '/sessions', { mode: 'chat' })).status).toBe(501);
  });

  it('refuses to start when the daily budget is used up', async () => {
    budget.record('user-a', 's', { inputTokens: 60, outputTokens: 60, totalTokens: 120 }, false);
    const r = await post('a', '/sessions', { mode: 'code' });
    expect(r.status).toBe(429);
    expect(((await r.json()) as any).budget.exceeded).toBe(true);
  });

  it("another user cannot see or use someone else's session", async () => {
    const id = await create('a');
    expect((await post('b', `/sessions/${id}/messages`, { text: 'hi' })).status).toBe(404);
    expect((await call('b', `/sessions/${id}/events`)).status).toBe(404);
    expect((await call('a', '/sessions/not-a-uuid/files')).status).toBe(404);
  });

  it('validates and forwards messages', async () => {
    const id = await create();
    expect((await post('a', `/sessions/${id}/messages`, { text: '  ' })).status).toBe(400);
    expect((await post('a', `/sessions/${id}/messages`, { text: 'x'.repeat(51) })).status).toBe(413);
    expect((await post('a', `/sessions/${id}/messages`, { text: 'hello' })).status).toBe(202);
    expect(adapter.sent).toEqual(['hello']);
  });

  it('refuses the /yolo command that would switch approvals off', async () => {
    const id = await create();
    for (const text of ['/yolo', ' /YOLO on', 'please /yolo now']) {
      expect((await post('a', `/sessions/${id}/messages`, { text })).status).toBe(400);
    }
    expect(adapter.sent).toEqual([]);
    expect((await post('a', `/sessions/${id}/messages`, { text: 'what is yolo?' })).status).toBe(202);
  });

  it('a message is refused once the budget is exhausted', async () => {
    const id = await create();
    budget.record('user-a', 's', { inputTokens: 0, outputTokens: 0, totalTokens: 100 }, false);
    expect((await post('a', `/sessions/${id}/messages`, { text: 'hi' })).status).toBe(429);
    expect(adapter.sent).toEqual([]);
  });
});

describe('v2 events (SSE)', () => {
  it('streams events with seq ids and resumes after Last-Event-ID', async () => {
    const id = await create();
    adapter.emit({ type: 'status', status: 'running' });
    adapter.emit({ type: 'message.delta', messageId: 'm', text: 'hi' });
    adapter.emit({ type: 'status', status: 'completed' });
    await tick();
    const all = await readSse('a', id, (e) => e.type === 'status' && e.status === 'completed');
    expect(all.map((f) => [f.id, f.event])).toEqual([['1', 'status'], ['2', 'message.delta'], ['3', 'status']]);
    expect(all[1].data).toMatchObject({ seq: 2, sessionId: id, text: 'hi' });
    const resumed = await readSse('a', id, (e) => e.seq === 3, { 'last-event-id': '2' });
    expect(resumed.map((f) => f.id)).toEqual(['3']);
  });
});

describe('v2 approvals', () => {
  const asked: PublishedEvent = { type: 'approval.requested', approval: { id: 'per_1', upstreamId: 'per_1', kind: 'shell', summary: 'rm -rf x', choices: ['once', 'session', 'always', 'deny'], createdAt: Date.now() } };

  it('offers only once/deny, namespaces the id, resolves once, and relays to the upstream', async () => {
    const id = await create();
    adapter.emit(asked);
    await tick();
    const [req] = await readSse('a', id, (e) => e.type === 'approval.requested');
    const approval = req.data.approval;
    expect(approval.id).toBe(`${id}.per_1`);
    expect(approval.choices).toEqual(['once', 'deny']);

    expect(((await call('a', '/approvals/pending').then((r) => r.json())) as any).approvals).toHaveLength(1);
    expect((await post('a', `/sessions/${id}/approvals/${approval.id}`, { choice: 'always' })).status).toBe(400);
    expect((await post('b', `/sessions/${id}/approvals/${approval.id}`, { choice: 'once' })).status).toBe(404);
    expect((await post('a', `/sessions/${id}/approvals/${approval.id}`, { choice: 'once' })).status).toBe(200);
    expect((await post('a', `/sessions/${id}/approvals/${approval.id}`, { choice: 'deny' })).status).toBe(409);
    expect(adapter.approved).toEqual([{ upstreamId: 'per_1', choice: 'once' }]);
    expect(((await call('a', '/approvals/pending').then((r) => r.json())) as any).approvals).toHaveLength(0);
  });

  it('upstream resolved events get the same namespaced id', async () => {
    const id = await create();
    adapter.emit({ type: 'approval.resolved', approvalId: 'per_9', choice: 'deny' });
    await tick();
    const [f] = await readSse('a', id, (e) => e.type === 'approval.resolved');
    expect(f.data.approvalId).toBe(`${id}.per_9`);
  });

  it('a failed delivery to the upstream is reported on the stream and as a 502', async () => {
    const id = await create();
    adapter.emit(asked);
    await tick();
    adapter.failApprove = true;
    const r = await post('a', `/sessions/${id}/approvals/${id}.per_1`, { choice: 'once' });
    expect(r.status).toBe(502);
    const frames = await readSse('a', id, (e) => e.type === 'error');
    expect(frames.at(-1)!.data.code).toBe('approval_delivery_failed');
  });
});

describe('v2 budget during a run', () => {
  it('books usage, and stops the run with budget_exceeded when the cap is crossed', async () => {
    const id = await create();
    adapter.emit({ type: 'usage', cumulative: false, usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 } });
    await tick();
    const usage = (await call('a', '/usage').then((r) => r.json())) as any;
    expect(usage).toMatchObject({ tokensUsed: 40, tokenLimit: 100, remainingTokens: 60, exceeded: false });
    adapter.emit({ type: 'usage', cumulative: false, usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 } });
    const frames = await readSse('a', id, (e) => e.type === 'error');
    expect(frames.at(-1)!.data.code).toBe('budget_exceeded');
    expect(adapter.stopped).toBeGreaterThanOrEqual(1);
  });

  it('cumulative usage only books the increase', async () => {
    await create();
    adapter.emit({ type: 'usage', cumulative: true, usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } });
    adapter.emit({ type: 'usage', cumulative: true, usage: { inputTokens: 8, outputTokens: 12, totalTokens: 20 } });
    await tick();
    expect(((await call('a', '/usage').then((r) => r.json())) as any).tokensUsed).toBe(20);
  });
});

describe('v2 files and lifecycle', () => {
  it('lists and reads files, rejecting traversal and absolute paths', async () => {
    const id = await create();
    expect(((await call('a', `/sessions/${id}/files?path=src`).then((r) => r.json())) as any).files).toHaveLength(1);
    expect((await call('a', `/sessions/${id}/file?path=a.ts`)).status).toBe(200);
    expect((await call('a', `/sessions/${id}/file?path=../etc/passwd`)).status).toBe(400);
    expect((await call('a', `/sessions/${id}/file?path=/etc/passwd`)).status).toBe(400);
    expect((await call('a', `/sessions/${id}/files?path=a/../../b`)).status).toBe(400);
  });

  it('stop and delete reach the upstream; a deleted session is gone', async () => {
    const id = await create();
    expect((await post('a', `/sessions/${id}/stop`, {})).status).toBe(200);
    expect(adapter.stopped).toBe(1);
    expect((await call('a', `/sessions/${id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await post('a', `/sessions/${id}/messages`, { text: 'hi' })).status).toBe(404);
  });

  it('lists allowed models and refuses any other model', async () => {
    const m = (await (await call('a', '/models')).json()) as { default: string; models: string[] };
    expect(m).toEqual({ default: 'iris-parallel', models: ['iris-parallel', 'iris-dream'] });
    expect((await call('nobody', '/models')).status).toBe(401);
    const id = await create();
    const bad = await post('a', `/sessions/${id}/messages`, { text: 'hi', model: 'some-expensive-model' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { models: string[] }).models).toContain('iris-dream');
    expect((await post('a', `/sessions/${id}/messages`, { text: 'hi', model: 'iris-dream' })).status).toBe(202);
  });
});
