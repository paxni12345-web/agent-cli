import { randomUUID } from 'node:crypto';
import { Channel } from './directLlmAdapter.js';
import { choiceToDecision, mapOpenClawEvent, newOpenClawState, type OpenClawFrame, type OpenClawMapperState } from './openclawMapper.js';
import type { AgentAdapter, ApprovalChoice, ApprovalRequest, PublishedEvent, SandboxEndpoint, SendInput, SessionRef } from './types.js';

/** Minimal socket the adapter needs; the default is Node's global WebSocket, tests pass a fake. */
export interface OcSocket {
  send(data: string): void;
  close(): void;
  onmessage: ((data: string) => void) | null;
  onclose: (() => void) | null;
}
export type OcSocketFactory = (url: string, headers: Record<string, string>) => Promise<OcSocket>;

export interface OpenClawAdapterOptions {
  socketFactory?: OcSocketFactory;
  callTimeoutMs?: number;
  now?: () => number;
}

const defaultFactory: OcSocketFactory = (url, headers) => new Promise((resolve, reject) => {
  const WS = (globalThis as any).WebSocket;
  if (!WS) { reject(new Error('This Node.js has no global WebSocket (needs Node 22+)')); return; }
  const ws = new WS(url, { headers }); // undici accepts {headers}; the browser API does not
  const sock: OcSocket = {
    send: (d) => ws.send(d), close: () => ws.close(), onmessage: null, onclose: null,
  };
  ws.onmessage = (m: { data: unknown }) => sock.onmessage?.(String(m.data));
  ws.onclose = () => sock.onclose?.();
  ws.onerror = () => reject(new Error('Could not open the OpenClaw WebSocket'));
  ws.onopen = () => resolve(sock);
});

type Reply = { ok: boolean; payload?: any; error?: { message?: string } | string };

/** One WebSocket connection speaking OpenClaw's req/res/event frames. */
class Client {
  private n = 0;
  private readonly pending = new Map<string, (r: Reply) => void>();
  onEvent: (f: OpenClawFrame) => void = () => undefined;
  onClosed: () => void = () => undefined;
  constructor(private readonly sock: OcSocket, private readonly label: string, private readonly timeoutMs: number) {
    sock.onmessage = (data) => {
      let f: any;
      try { f = JSON.parse(data); } catch { return; }
      if (f.type === 'res') { const p = this.pending.get(f.id); if (p) { this.pending.delete(f.id); p(f); } }
      else if (f.type === 'event') this.onEvent({ event: f.event, payload: f.payload });
    };
    sock.onclose = () => { for (const p of this.pending.values()) p({ ok: false, error: 'connection closed' }); this.pending.clear(); this.onClosed(); };
  }
  call(method: string, params: unknown): Promise<Reply> {
    const id = `${this.label}${++this.n}`;
    return new Promise((resolve) => {
      const t = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, error: `${method} timed out` }); }, this.timeoutMs);
      this.pending.set(id, (r) => { clearTimeout(t); resolve(r); });
      this.sock.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }
  close(): void { this.sock.close(); }
}

const errText = (r: Reply): string => (typeof r.error === 'string' ? r.error : r.error?.message ?? 'unknown error');

interface Live { sender: Client; approver: Client; out: Channel<PublishedEvent>; st: OpenClawMapperState; sessionKey: string }

/**
 * Work mode on OpenClaw. Approvals only work over the WebSocket protocol with TWO connections (audit-openclaw.md):
 * the sender (chat.send, operator.approvals) and an approver (operator.admin + cap exec-approvals), because OpenClaw
 * never offers a run's approvals back to its own sender. Needs `tools.exec.mode:"ask"` in the sandbox config.
 */
export class OpenClawAdapter implements AgentAdapter {
  readonly backend = 'openclaw' as const;
  private readonly sessions = new Map<string, Live>();
  private readonly factory: OcSocketFactory;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(o: OpenClawAdapterOptions = {}) {
    this.factory = o.socketFactory ?? defaultFactory;
    this.timeoutMs = o.callTimeoutMs ?? 10_000;
    this.now = o.now ?? Date.now;
  }

  private async open(ep: SandboxEndpoint, label: string, scopes: string[], caps: string[]): Promise<Client> {
    const url = `${ep.baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/`;
    const sock = await this.factory(url, { ...ep.headers });
    const client = new Client(sock, label, this.timeoutMs);
    // The server speaks first with connect.challenge; the connect request answers it.
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('OpenClaw did not send connect.challenge')), this.timeoutMs);
      client.onEvent = (f) => { if (f.event === 'connect.challenge') { clearTimeout(t); resolve(); } };
      client.onClosed = () => { clearTimeout(t); reject(new Error('OpenClaw closed the connection during handshake')); };
    });
    const r = await client.call('connect', {
      minProtocol: 4, maxProtocol: 4,
      client: { id: 'gateway-client', version: '0.0.1', platform: 'linux', mode: 'backend' },
      role: 'operator', scopes, caps, commands: [], permissions: {}, auth: { token: ep.secret }, locale: 'en-US', userAgent: `agent-cli-gateway-${label}`,
    });
    if (!r.ok) { client.close(); throw new Error(`OpenClaw connect (${label}) refused: ${errText(r)}`); }
    client.onEvent = () => undefined; client.onClosed = () => undefined;
    return client;
  }

  async createSession(ep: SandboxEndpoint, ref: SessionRef): Promise<{ upstreamId: string }> {
    const approver = await this.open(ep, 'APPROVER', ['operator.read', 'operator.write', 'operator.approvals', 'operator.admin'], ['exec-approvals']);
    let sender: Client;
    try {
      sender = await this.open(ep, 'SENDER', ['operator.read', 'operator.write', 'operator.approvals'], []);
    } catch (err) { approver.close(); throw err; }
    const sessionKey = ref.id; // INFERRED: any string works as a session key
    const live: Live = { sender, approver, out: new Channel(), st: newOpenClawState(sessionKey), sessionKey };
    const feed = (f: OpenClawFrame) => { for (const e of mapOpenClawEvent(f, live.st, this.now)) live.out.push(e); };
    sender.onEvent = feed; approver.onEvent = feed;
    let lost = false;
    const onClosed = () => {
      if (lost) return; lost = true;
      live.out.push({ type: 'error', code: 'upstream_stream_lost', message: 'The connection to the agent was lost', retryable: false });
      live.out.push({ type: 'status', status: 'failed' });
      live.out.end();
    };
    sender.onClosed = onClosed; approver.onClosed = onClosed;
    this.sessions.set(ref.id, live);
    return { upstreamId: sessionKey };
  }

  private live(ref: SessionRef): Live {
    const l = this.sessions.get(ref.id);
    if (!l) throw new Error('OpenClaw session is not connected');
    return l;
  }

  async send(_ep: SandboxEndpoint, ref: SessionRef, input: SendInput): Promise<void> {
    const l = this.live(ref);
    const r = await l.sender.call('chat.send', { sessionKey: l.sessionKey, message: input.text, idempotencyKey: randomUUID() });
    if (!r.ok) throw new Error(`OpenClaw chat.send failed: ${errText(r)}`);
  }

  async *events(_ep: SandboxEndpoint, ref: SessionRef, signal: AbortSignal): AsyncGenerator<PublishedEvent> {
    const l = this.live(ref);
    try {
      yield* l.out.drain(signal);
    } finally {
      l.sender.onClosed = () => undefined; l.approver.onClosed = () => undefined;
      l.sender.close(); l.approver.close();
      this.sessions.delete(ref.id);
    }
  }

  async approve(_ep: SandboxEndpoint, ref: SessionRef, a: ApprovalRequest, choice: ApprovalChoice): Promise<void> {
    const l = this.live(ref);
    const r = await l.approver.call('exec.approval.resolve', { id: a.upstreamId, decision: choiceToDecision(choice) });
    // Already answered or timed out upstream => idempotent success (wording of the error is INFERRED).
    if (!r.ok && !/not found|unknown|already|resolved|expired/i.test(errText(r))) throw new Error(`OpenClaw approval failed: ${errText(r)}`);
  }

  /** `chat.abort` is INFERRED from the protocol naming and was not exercised against a real gateway. */
  async stop(_ep: SandboxEndpoint, ref: SessionRef): Promise<void> {
    const l = this.sessions.get(ref.id);
    if (!l) return;
    await l.sender.call('chat.abort', { sessionKey: l.sessionKey });
  }

  async health(): Promise<boolean> { return true; }
}
