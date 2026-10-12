import { OpenClawAdapter, type OcSocket } from '../../src/gateway/openclawAdapter.js';
import { mapOpenClawEvent, newOpenClawState } from '../../src/gateway/openclawMapper.js';
import type { PublishedEvent, SandboxEndpoint, SessionRef } from '../../src/gateway/types.js';

const ep: SandboxEndpoint = { baseUrl: 'https://host:18789', secret: 'tok', sandboxId: 'sb', headers: { 'e2b-traffic-access-token': 'tt' } };
const ref: SessionRef = { id: 's1', userId: 'u', mode: 'work', backend: 'openclaw', createdAt: 0 };

describe('mapOpenClawEvent', () => {
  const run = (frames: Array<{ event: string; payload?: any }>) => {
    const st = newOpenClawState('s1');
    return frames.flatMap((f) => mapOpenClawEvent(f, st, () => 1000));
  };

  it('turns cumulative and incremental chat text into deltas, then done + completed', () => {
    const ev = run([
      { event: 'chat', payload: { state: 'delta', message: { content: [{ type: 'text', text: 'Hel' }] } } },
      { event: 'chat', payload: { state: 'delta', message: { content: [{ type: 'text', text: 'Hello' }] } } },
      { event: 'chat', payload: { state: 'delta', text: ' wor' } },
      { event: 'chat', payload: { state: 'final', message: { content: 'Hello wor' } } },
    ]);
    expect(ev.filter((e) => e.type === 'message.delta').map((e: any) => e.text)).toEqual(['Hel', 'lo', ' wor']);
    expect(ev.find((e) => e.type === 'message.done')).toMatchObject({ text: 'Hello wor' });
    expect(ev[ev.length - 1]).toEqual({ type: 'status', status: 'completed' });
  });

  it('maps tool start/end, including failures, and books usage as cumulative without repeats', () => {
    const ev = run([
      { event: 'agent', payload: { stream: 'item', data: { name: 'exec', phase: 'start', id: 't1' } } },
      { event: 'agent', payload: { stream: 'item', data: { name: 'exec', phase: 'end', id: 't1', status: 'completed' } } },
      { event: 'agent', payload: { stream: 'item', data: { name: 'write', phase: 'start' } } },
      { event: 'agent', payload: { stream: 'item', data: { name: 'write', phase: 'end', error: 'denied' } } },
      { event: 'agent', payload: { stream: 'usage', data: { outputTokens: 10 } } },
      { event: 'agent', payload: { stream: 'usage', data: { outputTokens: 10 } } },
      { event: 'agent', payload: { stream: 'usage', data: { outputTokens: 25 } } },
    ]);
    expect(ev.filter((e) => e.type === 'tool.started').map((e: any) => e.toolId)).toEqual(['t1', 'write#1']);
    expect(ev.filter((e) => e.type === 'tool.finished').map((e: any) => [e.toolId, e.ok])).toEqual([['t1', true], ['write#1', false]]);
    expect(ev.filter((e) => e.type === 'usage').map((e: any) => [e.cumulative, e.usage.outputTokens])).toEqual([[true, 10], [true, 25]]);
  });

  it('maps approvals, keeps deny available, and ignores other sessions', () => {
    const ev = run([
      { event: 'exec.approval.requested', payload: { id: 'a1', request: { command: 'touch x', cwd: '/w' }, allowedDecisions: ['allow-once', 'deny'] } },
      { event: 'exec.approval.requested', payload: { id: 'a2', sessionKey: 'other', request: { command: 'rm' } } },
      { event: 'exec.approval.resolved', payload: { id: 'a1', decision: 'allow-once' } },
    ]);
    const req = ev.find((e) => e.type === 'approval.requested') as any;
    expect(req.approval).toMatchObject({ id: 'a1', kind: 'shell', summary: 'touch x', choices: ['once', 'deny'] });
    expect(ev.filter((e) => e.type === 'approval.requested')).toHaveLength(1);
    expect(ev).toContainEqual({ type: 'approval.resolved', approvalId: 'a1', choice: 'once' });
    expect(ev.map((e) => e.type === 'status' && e.status).filter(Boolean)).toEqual(['waiting_for_approval', 'running']);
  });

  it('reports an error state as error + failed', () => {
    const ev = run([{ event: 'chat', payload: { state: 'error', errorMessage: 'bad key' } }]);
    expect(ev[0]).toMatchObject({ type: 'error', code: 'openclaw_error', message: 'bad key' });
    expect(ev[1]).toEqual({ type: 'status', status: 'failed' });
  });
});

/** Scripted OpenClaw gateway: answers `connect`, records every request, lets the test push events. */
function fakeGateway(opts: { refuse?: string[]; resolveReply?: (req: any) => any } = {}) {
  const sockets: Record<string, { sock: OcSocket; reqs: any[]; push(frame: unknown): void; drop(): void }> = {};
  const headersSeen: Array<Record<string, string>> = [];
  const factory = async (url: string, headers: Record<string, string>): Promise<OcSocket> => {
    headersSeen.push(headers);
    const sock: OcSocket = { send: () => undefined, close: () => undefined, onmessage: null, onclose: null };
    const reqs: any[] = [];
    let label = '';
    const push = (frame: unknown) => sock.onmessage?.(JSON.stringify(frame));
    sock.send = (d) => {
      const r = JSON.parse(d);
      reqs.push(r);
      if (r.method === 'connect') {
        label = r.params.userAgent.replace('agent-cli-gateway-', '');
        sockets[label] = { sock, reqs, push, drop: () => sock.onclose?.() };
        const refused = opts.refuse?.includes(label);
        setTimeout(() => push({ type: 'res', id: r.id, ok: !refused, ...(refused ? { error: { message: 'missing scope' } } : { payload: {} }) }), 0);
      } else if (r.method === 'exec.approval.resolve' && opts.resolveReply) {
        setTimeout(() => push({ type: 'res', id: r.id, ...opts.resolveReply!(r) }), 0);
      } else {
        setTimeout(() => push({ type: 'res', id: r.id, ok: true, payload: {} }), 0);
      }
    };
    setTimeout(() => push({ type: 'event', event: 'connect.challenge', payload: { nonce: 'n' } }), 0);
    expect(url).toBe('wss://host:18789/');
    return sock;
  };
  return { factory, sockets, headersSeen };
}

async function next<T>(it: AsyncIterator<T>, pred: (v: T) => boolean): Promise<T[]> {
  const out: T[] = [];
  for (;;) { const r = await it.next(); if (r.done) return out; out.push(r.value); if (pred(r.value)) return out; }
}

describe('OpenClawAdapter', () => {
  it('opens a sender without admin and an approver with admin + exec-approvals, over the E2B headers', async () => {
    const g = fakeGateway();
    const a = new OpenClawAdapter({ socketFactory: g.factory });
    const { upstreamId } = await a.createSession(ep, ref);
    expect(upstreamId).toBe('s1');
    const approver = g.sockets.APPROVER.reqs[0].params;
    const sender = g.sockets.SENDER.reqs[0].params;
    expect(approver.scopes).toContain('operator.admin');
    expect(approver.caps).toEqual(['exec-approvals']);
    expect(sender.scopes).toContain('operator.approvals');
    expect(sender.scopes).not.toContain('operator.admin');
    expect([approver.auth.token, sender.auth.token]).toEqual(['tok', 'tok']);
    expect(g.headersSeen.every((h) => h['e2b-traffic-access-token'] === 'tt')).toBe(true);
    const ac = new AbortController(); ac.abort();
    await a.events(ep, ref, ac.signal)[Symbol.asyncIterator]().next(); // ends at once and closes the sockets
  });

  it('fails createSession when a connection is refused', async () => {
    const g = fakeGateway({ refuse: ['APPROVER'] });
    await expect(new OpenClawAdapter({ socketFactory: g.factory }).createSession(ep, ref)).rejects.toThrow(/APPROVER\) refused: missing scope/);
  });

  it('send -> chat.send; approval raised on the approver is streamed and answered through the approver', async () => {
    const g = fakeGateway();
    const a = new OpenClawAdapter({ socketFactory: g.factory });
    await a.createSession(ep, ref);
    const ac = new AbortController();
    const it = a.events(ep, ref, ac.signal)[Symbol.asyncIterator]();
    await a.send(ep, ref, { text: 'write the proof file' });
    const sent = g.sockets.SENDER.reqs.find((r) => r.method === 'chat.send');
    expect(sent.params).toMatchObject({ sessionKey: 's1', message: 'write the proof file' });
    expect(typeof sent.params.idempotencyKey).toBe('string');

    g.sockets.APPROVER.push({ type: 'event', event: 'exec.approval.requested', payload: { id: 'ap1', request: { command: 'touch proof' }, allowedDecisions: ['allow-once', 'deny'] } });
    const seen = await next<PublishedEvent>(it, (e) => e.type === 'approval.requested');
    const approval = (seen.find((e) => e.type === 'approval.requested') as any).approval;
    await a.approve(ep, ref, approval, 'once');
    const resolve = g.sockets.APPROVER.reqs.find((r) => r.method === 'exec.approval.resolve');
    expect(resolve.params).toEqual({ id: 'ap1', decision: 'allow-once' });
    await expect(a.approve(ep, ref, approval, 'session' as any)).rejects.toThrow(/cannot honour/);
    ac.abort(); await it.return?.(undefined);
  });

  it('treats an "already resolved" reply as success and surfaces other approval errors', async () => {
    let msg = 'approval already resolved';
    const g = fakeGateway({ resolveReply: () => ({ ok: false, error: { message: msg } }) });
    const a = new OpenClawAdapter({ socketFactory: g.factory });
    await a.createSession(ep, ref);
    const approval = { id: 'x', upstreamId: 'x', kind: 'shell', summary: '', choices: ['once', 'deny'], createdAt: 0 } as any;
    await expect(a.approve(ep, ref, approval, 'deny')).resolves.toBeUndefined();
    msg = 'forbidden';
    await expect(a.approve(ep, ref, approval, 'deny')).rejects.toThrow(/forbidden/);
  });

  it('reports a lost connection as a non-retryable error and ends the stream', async () => {
    const g = fakeGateway();
    const a = new OpenClawAdapter({ socketFactory: g.factory });
    await a.createSession(ep, ref);
    const it = a.events(ep, ref, new AbortController().signal)[Symbol.asyncIterator]();
    g.sockets.SENDER.drop();
    const ev = await next<PublishedEvent>(it, () => false);
    expect(ev[0]).toMatchObject({ type: 'error', code: 'upstream_stream_lost', retryable: false });
    expect(ev[1]).toEqual({ type: 'status', status: 'failed' });
  });
});
