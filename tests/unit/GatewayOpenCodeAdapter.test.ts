import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { OpenCodeAdapter } from '../../src/gateway/opencodeAdapter.js';
import { mapOpenCodeEvent, newMapperState } from '../../src/gateway/opencodeMapper.js';
import type { PublishedEvent, SandboxEndpoint, SessionRef } from '../../src/gateway/types.js';

const SID = 'ses_abc';
const PER = 'per_1';
const auth = `Basic ${Buffer.from('opencode:s3cret').toString('base64')}`;

// Shapes copied from a real `opencode serve` 1.18.35 run.
const sse = (type: string, properties: object) => `data: ${JSON.stringify({ id: 'evt_x', type, properties })}\n\n`;
const asked = { id: PER, sessionID: SID, permission: 'bash', patterns: ['echo hi > /tmp/x'], metadata: { command: 'echo hi > /tmp/x' }, always: ['echo *'], tool: { messageID: 'msg_a', callID: 'call1' } };
const toolPart = (status: string, extra: object = {}) => ({ id: 'prt_t', messageID: 'msg_a', sessionID: SID, type: 'tool', tool: 'bash', callID: 'call1', state: { status, input: { command: 'echo hi > /tmp/x' }, ...extra } });

interface Fake { url: string; calls: Array<{ method: string; url: string; body: any; auth?: string }>; close: () => Promise<void>; pushEvent: (s: string) => void; endStream: () => void; replyStatus: number }

async function fake(initialEvents: string[] = []): Promise<Fake> {
  const calls: Fake['calls'] = [];
  const streams = new Set<http.ServerResponse>();
  const state = { replyStatus: 200 };
  const server = http.createServer((req, res) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => {
      let body: any; try { body = b ? JSON.parse(b) : undefined; } catch { body = b; }
      calls.push({ method: req.method!, url: req.url!, body, auth: req.headers.authorization });
      if (req.headers.authorization !== auth) { res.writeHead(401).end(); return; }
      if (req.url === '/event') {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        streams.add(res);
        for (const e of initialEvents) res.write(e);
        return;
      }
      if (req.url === '/session' && req.method === 'POST') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: SID })); return; }
      if (req.url?.endsWith('/prompt_async')) { res.writeHead(204).end(); return; }
      if (req.url === '/permission') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([asked, { ...asked, id: 'per_other', sessionID: 'ses_other' }])); return; }
      if (req.url?.startsWith('/permission/')) { res.writeHead(state.replyStatus).end('true'); return; }
      if (req.url?.endsWith('/abort')) { res.writeHead(200).end('true'); return; }
      if (req.url?.startsWith('/file/content')) { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ type: 'text', content: 'hello' })); return; }
      if (req.url?.startsWith('/file')) { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([{ name: 'a.ts', path: 'a.ts', absolute: '/w/a.ts', type: 'file', ignored: false }, { name: 'node_modules', path: 'node_modules', absolute: '/w/node_modules', type: 'directory', ignored: true }, { name: 'src', path: 'src', absolute: '/w/src', type: 'directory', ignored: false }])); return; }
      if (req.url === '/global/health') { res.writeHead(200).end('{}'); return; }
      res.writeHead(404).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`, calls,
    pushEvent: (s) => streams.forEach((r) => r.write(s)),
    endStream: () => { streams.forEach((r) => r.end()); streams.clear(); },
    get replyStatus() { return state.replyStatus; }, set replyStatus(v) { state.replyStatus = v; },
    close: () => new Promise<void>((r) => { streams.forEach((x) => x.destroy()); server.close(() => r()); }),
  };
}

const ref: SessionRef = { id: 'g1', userId: 'u1', mode: 'code', backend: 'opencode', upstreamId: SID, createdAt: 1 };
const ep = (url: string): SandboxEndpoint => ({ baseUrl: url, secret: 's3cret', sandboxId: 'sb1' });

async function collect(it: AsyncIterable<PublishedEvent>, until: (e: PublishedEvent) => boolean, ac: AbortController): Promise<PublishedEvent[]> {
  const out: PublishedEvent[] = [];
  for await (const e of it) { out.push(e); if (until(e)) { ac.abort(); break; } }
  return out;
}

describe('mapOpenCodeEvent (pure translation)', () => {
  const run = (evs: Array<[string, object]>) => {
    const st = newMapperState();
    return evs.flatMap(([t, p]) => mapOpenCodeEvent({ type: t, properties: p }, SID, st, () => 5));
  };

  it('ignores events of other sessions and noise', () => {
    expect(run([['session.status', { sessionID: 'ses_other', status: { type: 'busy' } }], ['server.heartbeat', {}], ['plugin.added', { id: 'x' }]])).toEqual([]);
  });

  it('permission.asked becomes waiting_for_approval + approval.requested with the command as summary', () => {
    const out = run([['permission.asked', asked]]);
    expect(out[0]).toEqual({ type: 'status', status: 'waiting_for_approval' });
    expect(out[1]).toMatchObject({ type: 'approval.requested', approval: { id: PER, upstreamId: PER, kind: 'shell', summary: 'echo hi > /tmp/x', choices: ['once', 'always', 'deny'], createdAt: 5 } });
  });

  it('tool lifecycle: one started, one finished, no duplicates on repeated snapshots', () => {
    const out = run([
      ['message.part.updated', { sessionID: SID, part: toolPart('pending'), time: 1 }],
      ['message.part.updated', { sessionID: SID, part: toolPart('running'), time: 2 }],
      ['message.part.updated', { sessionID: SID, part: toolPart('completed', { output: 'ok' }), time: 3 }],
      ['message.part.updated', { sessionID: SID, part: toolPart('completed', { output: 'ok' }), time: 4 }],
    ]);
    expect(out.filter((e) => e.type === 'tool.started')).toHaveLength(1);
    expect(out.filter((e) => e.type === 'tool.finished')).toEqual([{ type: 'tool.finished', toolId: 'call1', ok: true, output: 'ok' }]);
  });

  it('a failed tool maps to ok:false with the error text', () => {
    const out = run([['message.part.updated', { sessionID: SID, part: toolPart('error', { error: 'boom' }), time: 1 }]]);
    expect(out.at(-1)).toEqual({ type: 'tool.finished', toolId: 'call1', ok: false, output: 'boom' });
  });

  it('user message parts are not echoed as assistant text', () => {
    const out = run([
      ['message.updated', { sessionID: SID, info: { id: 'msg_u', role: 'user' } }],
      ['message.part.updated', { sessionID: SID, part: { id: 'prt_u', messageID: 'msg_u', type: 'text', text: 'hi', time: { start: 1, end: 2 } }, time: 1 }],
      ['message.part.delta', { sessionID: SID, messageID: 'msg_u', partID: 'prt_u', field: 'text', delta: 'hi' }],
    ]);
    expect(out).toEqual([]);
  });

  it('assistant text: deltas stream, completed part emits message.done once', () => {
    const part = { id: 'prt_a', messageID: 'msg_a', type: 'text', text: 'done', time: { start: 1, end: 2 } };
    const out = run([
      ['message.part.delta', { sessionID: SID, messageID: 'msg_a', partID: 'prt_a', field: 'text', delta: 'do' }],
      ['message.part.delta', { sessionID: SID, messageID: 'msg_a', partID: 'prt_a', field: 'text', delta: 'ne' }],
      ['message.part.updated', { sessionID: SID, part, time: 3 }],
      ['message.part.updated', { sessionID: SID, part, time: 4 }],
    ]);
    expect(out.map((e) => e.type)).toEqual(['message.delta', 'message.delta', 'message.done']);
  });

  it('step-finish becomes a non-cumulative usage event, once', () => {
    const part = { id: 'prt_s', messageID: 'msg_a', type: 'step-finish', reason: 'stop', cost: 0, tokens: { total: 0, input: 10, output: 5, reasoning: 2, cache: { read: 3, write: 0 } } };
    const out = run([['message.part.updated', { sessionID: SID, part, time: 1 }], ['message.part.updated', { sessionID: SID, part, time: 2 }]]);
    expect(out).toEqual([{ type: 'usage', cumulative: false, usage: { inputTokens: 13, outputTokens: 7, totalTokens: 20 } }]);
  });

  it('status: busy -> running, idle after work -> completed, idle on a fresh session -> nothing', () => {
    expect(run([['session.status', { sessionID: SID, status: { type: 'idle' } }]])).toEqual([]);
    const out = run([
      ['session.status', { sessionID: SID, status: { type: 'busy' } }],
      ['session.status', { sessionID: SID, status: { type: 'busy' } }],
      ['session.status', { sessionID: SID, status: { type: 'idle' } }],
    ]);
    expect(out).toEqual([{ type: 'status', status: 'running' }, { type: 'status', status: 'completed' }]);
  });

  it('permission.replied maps reject to deny and returns to running', () => {
    const out = run([['permission.asked', asked], ['permission.replied', { sessionID: SID, requestID: PER, reply: 'reject' }]]);
    expect(out.slice(2)).toEqual([{ type: 'approval.resolved', approvalId: PER, choice: 'deny' }, { type: 'status', status: 'running' }]);
  });

  it('session.error yields an error event and failed status', () => {
    const out = run([['session.error', { sessionID: SID, error: { name: 'APIError', data: { message: 'rate limited' } } }]]);
    expect(out).toEqual([{ type: 'error', code: 'APIError', message: 'rate limited', retryable: false }, { type: 'status', status: 'failed' }]);
  });
});

describe('OpenCodeAdapter against a fake OpenCode server', () => {
  let srv: Fake;
  afterEach(async () => { await srv.close(); });

  it('createSession and send use Basic auth and the documented bodies', async () => {
    srv = await fake();
    const a = new OpenCodeAdapter({ defaultModel: 'mock/mock-1' });
    expect(await a.createSession(ep(srv.url))).toEqual({ upstreamId: SID });
    await a.send(ep(srv.url), ref, { text: 'hello' });
    const send = srv.calls.find((c) => c.url.endsWith('/prompt_async'))!;
    expect(send.auth).toBe(auth);
    expect(send.body).toEqual({ parts: [{ type: 'text', text: 'hello' }], model: { providerID: 'mock', modelID: 'mock-1' } });
  });

  it('rejects a malformed model string and a wrong secret', async () => {
    srv = await fake();
    const a = new OpenCodeAdapter();
    await expect(a.send(ep(srv.url), ref, { text: 'x', model: 'nomodel' })).rejects.toThrow(/provider\/model/);
    await expect(a.createSession({ ...ep(srv.url), secret: 'wrong' })).rejects.toThrow(/401/);
  });

  it('events(): streams translated events, announces the pending approval once, and filters other sessions', async () => {
    srv = await fake([
      sse('server.connected', {}),
      sse('session.status', { sessionID: SID, status: { type: 'busy' } }),
      sse('permission.asked', asked),
      sse('session.status', { sessionID: 'ses_other', status: { type: 'idle' } }),
      sse('message.part.updated', { sessionID: SID, part: toolPart('completed', { output: 'ok' }), time: 3 }),
      sse('session.status', { sessionID: SID, status: { type: 'idle' } }),
    ]);
    const a = new OpenCodeAdapter();
    const ac = new AbortController();
    const out = await collect(a.events(ep(srv.url), ref, ac.signal), (e) => e.type === 'status' && e.status === 'completed', ac);
    expect(out.filter((e) => e.type === 'approval.requested')).toHaveLength(1); // GET /permission + SSE deduped
    expect(out.map((e) => e.type)).toEqual(expect.arrayContaining(['status', 'approval.requested', 'tool.started', 'tool.finished']));
    expect(out.at(-1)).toEqual({ type: 'status', status: 'completed' });
  });

  it('events(): reconnects after the stream drops', async () => {
    srv = await fake([sse('session.status', { sessionID: SID, status: { type: 'busy' } })]);
    const a = new OpenCodeAdapter({ reconnectMs: 10 });
    const ac = new AbortController();
    const it = a.events(ep(srv.url), ref, ac.signal)[Symbol.asyncIterator]();
    expect((await it.next()).value).toMatchObject({ type: 'approval.requested' }); // pending approval found on connect
    expect((await it.next()).value).toEqual({ type: 'status', status: 'running' });
    const pending = it.next(); // the generator only reconnects while a consumer is pulling
    await new Promise((r) => setTimeout(r, 20));
    srv.endStream();
    await new Promise((r) => setTimeout(r, 80));
    expect(srv.calls.filter((c) => c.url === '/event').length).toBeGreaterThanOrEqual(2);
    ac.abort();
    await pending;
  });

  it('approve maps choices to once/always/reject and is idempotent on 404/409', async () => {
    srv = await fake();
    const a = new OpenCodeAdapter();
    const req = { id: PER, upstreamId: PER, kind: 'shell' as const, summary: 's', choices: ['once' as const], createdAt: 1 };
    await a.approve(ep(srv.url), ref, req, 'once');
    await a.approve(ep(srv.url), ref, req, 'deny');
    srv.replyStatus = 409;
    await expect(a.approve(ep(srv.url), ref, req, 'always')).resolves.toBeUndefined();
    srv.replyStatus = 500;
    await expect(a.approve(ep(srv.url), ref, req, 'once')).rejects.toThrow(/500/);
    await expect(a.approve(ep(srv.url), ref, req, 'session')).rejects.toThrow(/cannot honour/);
    const replies = srv.calls.filter((c) => c.url === `/permission/${PER}/reply`).map((c) => c.body.reply);
    expect(replies).toEqual(['once', 'reject', 'always', 'once']);
  });

  it('stop, health, listFiles (hides ignored, maps dir) and readFile', async () => {
    srv = await fake();
    const a = new OpenCodeAdapter();
    await a.stop(ep(srv.url), ref);
    expect(srv.calls.some((c) => c.url === `/session/${SID}/abort` && c.method === 'POST')).toBe(true);
    expect(await a.health(ep(srv.url))).toBe(true);
    expect(await a.health({ ...ep(srv.url), secret: 'bad' })).toBe(false);
    expect(await a.listFiles!(ep(srv.url), ref, '.')).toEqual([{ path: 'a.ts', type: 'file' }, { path: 'src', type: 'dir' }]);
    expect(await a.readFile!(ep(srv.url), ref, 'a.ts')).toEqual({ content: 'hello', truncated: false });
  });
});
