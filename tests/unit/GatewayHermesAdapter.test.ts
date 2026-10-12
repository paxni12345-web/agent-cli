import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { HermesAdapter } from '../../src/gateway/hermesAdapter.js';
import { mapHermesEvent, newHermesState } from '../../src/gateway/hermesMapper.js';
import type { PublishedEvent, SandboxEndpoint, SessionRef } from '../../src/gateway/types.js';

const RUN = 'run_1';
const KEY = 'k'.repeat(20);

// Shapes of tool.started / approval.request copied from a real Hermes run.
const started = { event: 'tool.started', run_id: RUN, tool: 'terminal', preview: 'rm -rf /tmp/x', seq: 0 };
const approvalReq = { command: 'rm -rf /tmp/x', pattern_key: 'delete in root path', description: 'delete in root path', allow_permanent: true, allow_session: true, request_id: 'req1', event: 'approval.request', run_id: RUN, choices: ['once', 'session', 'always', 'deny'], seq: 1 };
const sse = (e: { seq?: number; [k: string]: unknown }) => `${e.seq !== undefined ? `id: ${e.seq}\n` : ''}data: ${JSON.stringify(e)}\n\n`;

interface Fake { url: string; calls: Array<{ method: string; url: string; body: any; auth?: string; lastEventId?: string }>; close: () => Promise<void>; push: (s: string) => void; endStreams: () => void; approvalStatus: number }

async function fake(initial: string[] = []): Promise<Fake> {
  const calls: Fake['calls'] = [];
  const streams = new Set<http.ServerResponse>();
  const state = { approvalStatus: 200 };
  const server = http.createServer((req, res) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => {
      let body: any; try { body = b ? JSON.parse(b) : undefined; } catch { body = b; }
      calls.push({ method: req.method!, url: req.url!, body, auth: req.headers.authorization, lastEventId: req.headers['last-event-id'] as string | undefined });
      if (req.headers.authorization !== `Bearer ${KEY}`) { res.writeHead(401).end(); return; }
      if (req.url === '/v1/runs' && req.method === 'POST') { res.writeHead(202, { 'content-type': 'application/json' }).end(JSON.stringify({ run_id: RUN, status: 'started' })); return; }
      if (req.url === `/v1/runs/${RUN}/events`) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(': open\n\n');
        streams.add(res);
        for (const e of initial) res.write(e);
        return;
      }
      if (req.url === `/v1/runs/${RUN}/approval`) { res.writeHead(state.approvalStatus, { 'content-type': 'application/json' }).end('{"resolved":1}'); return; }
      if (req.url === `/v1/runs/${RUN}/stop`) { res.writeHead(200, { 'content-type': 'application/json' }).end('{}'); return; }
      if (req.url === '/health') { res.writeHead(200).end('ok'); return; }
      res.writeHead(404).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`, calls,
    push: (s) => streams.forEach((r) => r.write(s)),
    endStreams: () => { streams.forEach((r) => r.end()); streams.clear(); },
    get approvalStatus() { return state.approvalStatus; }, set approvalStatus(v) { state.approvalStatus = v; },
    close: () => new Promise<void>((r) => { streams.forEach((x) => x.destroy()); server.close(() => r()); }),
  };
}

const ref: SessionRef = { id: 'g1', userId: 'u1', mode: 'agent', backend: 'hermes', upstreamId: 'gw-1', createdAt: 1 };
const ep = (url: string): SandboxEndpoint => ({ baseUrl: url, secret: KEY, sandboxId: 'sb' });

async function until(it: AsyncIterator<PublishedEvent>, pred: (e: PublishedEvent) => boolean): Promise<PublishedEvent[]> {
  const out: PublishedEvent[] = [];
  for (;;) {
    const r = await it.next();
    if (r.done) return out;
    out.push(r.value);
    if (pred(r.value)) return out;
  }
}

describe('mapHermesEvent (pure translation)', () => {
  const run = (evs: object[]) => { const st = newHermesState(RUN); return evs.flatMap((e) => mapHermesEvent(e as any, st, () => 7)); };

  it('approval.request becomes waiting_for_approval + approval with the offered choices', () => {
    const out = run([approvalReq]);
    expect(out[0]).toEqual({ type: 'status', status: 'waiting_for_approval' });
    expect(out[1]).toMatchObject({ type: 'approval.requested', approval: { id: 'req1', upstreamId: 'req1', kind: 'shell', summary: 'rm -rf /tmp/x', choices: ['once', 'session', 'always', 'deny'], createdAt: 7, detail: { runId: RUN } } });
  });

  it('only the choices Hermes offers are passed through (smart-denied commands)', () => {
    const out = run([{ ...approvalReq, choices: ['once', 'deny'] }]);
    expect((out[1] as any).approval.choices).toEqual(['once', 'deny']);
  });

  it('tools: ids are generated and completion matches the oldest open tool of the same name', () => {
    const out = run([started, { ...started, preview: 'ls' }, { event: 'tool.completed', tool: 'terminal', error: false, preview: 'ok' }, { event: 'tool.completed', tool: 'terminal', error: true, preview: 'bad' }]);
    expect(out.map((e) => e.type)).toEqual(['tool.started', 'tool.started', 'tool.finished', 'tool.finished']);
    expect(out[2]).toEqual({ type: 'tool.finished', toolId: `${RUN}:1`, ok: true, output: 'ok' });
    expect(out[3]).toEqual({ type: 'tool.finished', toolId: `${RUN}:2`, ok: false, output: 'bad' });
  });

  it('message.delta streams text; run.completed gives final text, usage and completed', () => {
    const out = run([{ event: 'message.delta', delta: 'he' }, { event: 'message.delta', delta: 'llo' }, { event: 'run.completed', output: 'hello', usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14, cache_read_tokens: 2, cache_write_tokens: 0 } }]);
    expect(out).toEqual([
      { type: 'message.delta', messageId: RUN, text: 'he' }, { type: 'message.delta', messageId: RUN, text: 'llo' },
      { type: 'message.done', messageId: RUN, text: 'hello' },
      { type: 'usage', cumulative: false, usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 } },
      { type: 'status', status: 'completed' },
    ]);
  });

  it('run.failed -> error + failed; run.cancelled/interrupted -> stopped; unknown events ignored', () => {
    expect(run([{ event: 'run.failed', error: 'boom' }])).toEqual([{ type: 'error', code: 'run_failed', message: 'boom', retryable: false }, { type: 'status', status: 'failed' }]);
    expect(run([{ event: 'run.cancelled' }])).toEqual([{ type: 'status', status: 'stopped' }]);
    expect(run([{ event: 'reasoning.available', text: 'x' }, { event: 'subagent.start' }])).toEqual([]);
  });

  it('approval.responded is deduplicated', () => {
    const out = run([{ event: 'approval.responded', request_id: 'req1', choice: 'once' }, { event: 'approval.responded', request_id: 'req1', choice: 'once' }]);
    expect(out.filter((e) => e.type === 'approval.resolved')).toHaveLength(1);
  });
});

describe('HermesAdapter against a fake Hermes server', () => {
  let srv: Fake;
  afterEach(async () => { await srv.close(); });

  it('createSession hands out a stable gateway-side session id; send posts a run with it', async () => {
    srv = await fake();
    const a = new HermesAdapter();
    const { upstreamId } = await a.createSession();
    expect(upstreamId).toMatch(/^gw-/);
    await a.send(ep(srv.url), { ...ref, upstreamId }, { text: 'hi', model: 'm1' });
    const post = srv.calls.find((c) => c.url === '/v1/runs')!;
    expect(post.auth).toBe(`Bearer ${KEY}`);
    expect(post.body).toEqual({ input: 'hi', session_id: upstreamId, model: 'm1' });
  });

  it('full turn: running -> tool -> approval -> approve -> completed, via the per-session queue', async () => {
    srv = await fake([sse(started), sse(approvalReq)]);
    const a = new HermesAdapter({ reconnectMs: 10 });
    const ac = new AbortController();
    const it = a.events(ep(srv.url), ref, ac.signal)[Symbol.asyncIterator]();
    await a.send(ep(srv.url), ref, { text: 'delete it' });
    const first = await until(it, (e) => e.type === 'approval.requested');
    expect(first.map((e) => e.type)).toEqual(['status', 'tool.started', 'status', 'approval.requested']);
    const approval = (first.at(-1) as any).approval;

    await a.approve(ep(srv.url), ref, approval, 'once');
    expect(srv.calls.find((c) => c.url === `/v1/runs/${RUN}/approval`)!.body).toEqual({ choice: 'once', request_id: 'req1' });
    srv.push(sse({ event: 'run.completed', run_id: RUN, seq: 2, output: 'done', usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 } }));
    const rest = await until(it, (e) => e.type === 'status' && e.status === 'completed');
    expect(rest.map((e) => e.type)).toEqual(['approval.resolved', 'status', 'message.done', 'usage', 'status']);
    ac.abort();
  });

  it('a turn started before anyone subscribed is not lost', async () => {
    srv = await fake([sse({ event: 'run.completed', run_id: RUN, seq: 0, output: 'x' })]);
    const a = new HermesAdapter();
    await a.send(ep(srv.url), ref, { text: 'go' });
    await new Promise((r) => setTimeout(r, 50));
    const ac = new AbortController();
    const out = await until(a.events(ep(srv.url), ref, ac.signal)[Symbol.asyncIterator](), (e) => e.type === 'status' && e.status === 'completed');
    expect(out.map((e) => e.type)).toEqual(['status', 'message.done', 'status']);
    ac.abort();
  });

  it('reconnects a dropped run stream with Last-Event-ID and does not repeat events', async () => {
    srv = await fake([sse(started)]);
    const a = new HermesAdapter({ reconnectMs: 10 });
    const ac = new AbortController();
    const it = a.events(ep(srv.url), ref, ac.signal)[Symbol.asyncIterator]();
    await a.send(ep(srv.url), ref, { text: 'go' });
    await until(it, (e) => e.type === 'tool.started');
    srv.endStreams();
    await new Promise((r) => setTimeout(r, 60));
    const eventCalls = srv.calls.filter((c) => c.url === `/v1/runs/${RUN}/events`);
    expect(eventCalls.length).toBeGreaterThanOrEqual(2);
    expect(eventCalls.at(-1)!.lastEventId).toBe('0');
    srv.push(sse(started)); // replayed seq 0 must be dropped
    srv.push(sse({ event: 'run.completed', run_id: RUN, seq: 1, output: 'ok' }));
    const rest = await until(it, (e) => e.type === 'status' && e.status === 'completed');
    expect(rest.filter((e) => e.type === 'tool.started')).toHaveLength(0);
    ac.abort();
  });

  it('reports a retryable error and failed status when the stream cannot be re-established', async () => {
    srv = await fake([sse(started)]);
    const a = new HermesAdapter({ reconnectMs: 5, maxReconnects: 2 });
    const ac = new AbortController();
    const it = a.events(ep(srv.url), ref, ac.signal)[Symbol.asyncIterator]();
    await a.send(ep(srv.url), ref, { text: 'go' });
    await until(it, (e) => e.type === 'tool.started');
    const closing = srv.close();
    const out = await until(it, (e) => e.type === 'status' && e.status === 'failed');
    expect(out.some((e) => e.type === 'error' && e.retryable)).toBe(true);
    ac.abort();
    await closing;
    srv = await fake(); // for afterEach
  });

  it('approve is idempotent on 404/409 and surfaces other failures; stop and health work', async () => {
    srv = await fake();
    const a = new HermesAdapter();
    const req = { id: 'req1', upstreamId: 'req1', kind: 'shell' as const, summary: 's', choices: ['once' as const], createdAt: 1, detail: { runId: RUN } };
    srv.approvalStatus = 409;
    await expect(a.approve(ep(srv.url), ref, req, 'deny')).resolves.toBeUndefined();
    srv.approvalStatus = 500;
    await expect(a.approve(ep(srv.url), ref, req, 'once')).rejects.toThrow(/500/);
    await a.send(ep(srv.url), ref, { text: 'go' });
    await a.stop(ep(srv.url), ref);
    expect(srv.calls.some((c) => c.url === `/v1/runs/${RUN}/stop` && c.method === 'POST')).toBe(true);
    expect(await a.health(ep(srv.url))).toBe(true);
    expect(await a.health({ ...ep(srv.url), secret: 'wrong-wrong-wrong-wrong' })).toBe(false);
  });
});
