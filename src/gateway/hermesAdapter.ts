import { randomUUID } from 'node:crypto';
import type {
  AgentAdapter, ApprovalChoice, ApprovalRequest, PublishedEvent, SandboxEndpoint, SendInput, SessionRef,
} from './types.js';
import { mapHermesEvent, newHermesState, type HermesRawEvent } from './hermesMapper.js';
import { parseSse } from './opencodeAdapter.js';

export interface HermesAdapterOptions {
  fetchImpl?: typeof fetch;
  reconnectMs?: number;
  /** Consecutive failed (re)connects of one run's stream before the run is reported lost. Default 5. */
  maxReconnects?: number;
  now?: () => number;
}

interface SessionState {
  queue: PublishedEvent[];
  wake: (() => void) | null;
  currentRunId?: string;
  activeRuns: number;
  stop: AbortController;
}

const bearer = (ep: SandboxEndpoint, json = false): Record<string, string> => ({
  authorization: `Bearer ${ep.secret}`,
  ...(json ? { 'content-type': 'application/json' } : {}),
});

/**
 * Hermes: one `run` = one turn. The conversation is kept by passing the same `session_id` on every run.
 * Run streams are read by background tasks started in send(); events() drains a per-session queue,
 * so a turn started before anybody subscribed is not lost.
 */
export class HermesAdapter implements AgentAdapter {
  readonly backend = 'hermes' as const;
  private readonly f: typeof fetch;
  private readonly reconnectMs: number;
  private readonly maxReconnects: number;
  private readonly now: () => number;
  private readonly sessions = new Map<string, SessionState>();

  constructor(opts: HermesAdapterOptions = {}) {
    this.f = opts.fetchImpl ?? fetch;
    this.reconnectMs = opts.reconnectMs ?? 1000;
    this.maxReconnects = opts.maxReconnects ?? 5;
    this.now = opts.now ?? Date.now;
  }

  private st(id: string): SessionState {
    let s = this.sessions.get(id);
    if (!s) { s = { queue: [], wake: null, activeRuns: 0, stop: new AbortController() }; this.sessions.set(id, s); }
    return s;
  }

  private push(s: SessionState, e: PublishedEvent): void {
    s.queue.push(e);
    s.wake?.();
  }

  private async call(ep: SandboxEndpoint, method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<Response> {
    const res = await this.f(`${ep.baseUrl}${path}`, {
      method, headers: bearer(ep, body !== undefined), body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok && !okStatuses.includes(res.status)) throw new Error(`Hermes ${method} ${path} failed: ${res.status}`);
    return res;
  }

  /** Hermes has no explicit session object: the id we hand out is the `session_id` used on every run. */
  async createSession(): Promise<{ upstreamId: string }> {
    return { upstreamId: `gw-${randomUUID()}` };
  }

  async send(ep: SandboxEndpoint, ref: SessionRef, input: SendInput): Promise<void> {
    if (!ref.upstreamId) throw new Error('session has no upstreamId');
    const res = await this.call(ep, 'POST', '/v1/runs', {
      input: input.text, session_id: ref.upstreamId, ...(input.model ? { model: input.model } : {}),
    });
    const j = (await res.json()) as { run_id?: string };
    if (!j.run_id) throw new Error('Hermes /v1/runs returned no run_id');
    const s = this.st(ref.id);
    s.currentRunId = j.run_id;
    s.activeRuns += 1;
    this.push(s, { type: 'status', status: 'running' });
    void this.readRun(ep, s, j.run_id).finally(() => { s.activeRuns -= 1; s.wake?.(); });
  }

  private async readRun(ep: SandboxEndpoint, s: SessionState, runId: string): Promise<void> {
    const st = newHermesState(runId);
    let lastSeq = -1;
    let failures = 0;
    while (!st.terminal && !s.stop.signal.aborted) {
      try {
        const headers = { ...bearer(ep), ...(lastSeq >= 0 ? { 'last-event-id': String(lastSeq) } : {}) };
        const res = await this.f(`${ep.baseUrl}/v1/runs/${encodeURIComponent(runId)}/events`, { headers, signal: s.stop.signal });
        if (!res.ok || !res.body) throw new Error(`Hermes events failed: ${res.status}`);
        failures = 0;
        const decoder = new TextDecoder();
        const buf = { text: '' };
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
          for (const raw of parseSse(buf, decoder.decode(chunk, { stream: true }))) {
            const ev = raw as HermesRawEvent;
            if (typeof ev.seq === 'number') { if (ev.seq <= lastSeq) continue; lastSeq = ev.seq; }
            for (const out of mapHermesEvent(ev, st, this.now)) this.push(s, out);
          }
          if (st.terminal) break;
        }
      } catch (err) {
        if (s.stop.signal.aborted) return;
        failures += 1;
        if (failures > this.maxReconnects) {
          this.push(s, { type: 'error', code: 'upstream_stream_lost', message: (err as Error).message, retryable: true });
          this.push(s, { type: 'status', status: 'failed' });
          return;
        }
      }
      if (!st.terminal) await new Promise((r) => setTimeout(r, this.reconnectMs));
    }
  }

  async *events(_ep: SandboxEndpoint, ref: SessionRef, signal: AbortSignal): AsyncGenerator<PublishedEvent> {
    const s = this.st(ref.id);
    try {
      while (!signal.aborted) {
        while (s.queue.length) yield s.queue.shift()!;
        if (signal.aborted) return;
        await new Promise<void>((resolve) => {
          s.wake = resolve;
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
        s.wake = null;
      }
    } finally {
      s.wake = null;
      if (s.activeRuns === 0 && s.queue.length === 0) this.sessions.delete(ref.id);
    }
  }

  async approve(ep: SandboxEndpoint, ref: SessionRef, a: ApprovalRequest, choice: ApprovalChoice): Promise<void> {
    const runId = (a.detail?.runId as string | undefined) ?? this.sessions.get(ref.id)?.currentRunId;
    if (!runId) throw new Error('approval has no run id');
    // 404/409: run finished or approval already answered => idempotent success.
    await this.call(ep, 'POST', `/v1/runs/${encodeURIComponent(runId)}/approval`, { choice, request_id: a.upstreamId }, [404, 409]);
    const s = this.sessions.get(ref.id);
    if (s) {
      this.push(s, { type: 'approval.resolved', approvalId: a.id, choice });
      this.push(s, { type: 'status', status: 'running' });
    }
  }

  async stop(ep: SandboxEndpoint, ref: SessionRef): Promise<void> {
    const runId = this.sessions.get(ref.id)?.currentRunId;
    if (!runId) return;
    await this.call(ep, 'POST', `/v1/runs/${encodeURIComponent(runId)}/stop`, undefined, [404, 409]);
  }

  async health(ep: SandboxEndpoint): Promise<boolean> {
    try { return (await this.f(`${ep.baseUrl}/health`, { headers: bearer(ep) })).ok; } catch { return false; }
  }
}
