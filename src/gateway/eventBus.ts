import type { AgentEvent, EventBus, PublishedEvent } from './types.js';

export interface InMemoryEventBusOptions {
  /** Max buffered events per session for resume. Default 1000. */
  maxBuffered?: number;
  now?: () => number;
}

interface SessionState {
  seq: number;
  buffer: AgentEvent[];
  subscribers: Set<Subscriber>;
}

interface Subscriber {
  queue: AgentEvent[];
  wake: (() => void) | null;
  closed: boolean;
}

/**
 * Per-session event log with monotonic `seq`, a bounded replay buffer and live fan-out.
 * In-memory only: durable storage (e.g. approvals in the database) is layered on top by the caller.
 */
export class InMemoryEventBus implements EventBus {
  private readonly sessions = new Map<string, SessionState>();
  private readonly maxBuffered: number;
  private readonly now: () => number;

  constructor(opts: InMemoryEventBusOptions = {}) {
    this.maxBuffered = Math.max(1, opts.maxBuffered ?? 1000);
    this.now = opts.now ?? Date.now;
  }

  private state(sessionId: string): SessionState {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = { seq: 0, buffer: [], subscribers: new Set() };
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  publish(sessionId: string, e: PublishedEvent): AgentEvent {
    const s = this.state(sessionId);
    s.seq += 1;
    const event = { ...e, seq: s.seq, sessionId, at: this.now() } as AgentEvent;
    s.buffer.push(event);
    if (s.buffer.length > this.maxBuffered) s.buffer.splice(0, s.buffer.length - this.maxBuffered);
    for (const sub of s.subscribers) {
      sub.queue.push(event);
      sub.wake?.();
    }
    return event;
  }

  subscribe(sessionId: string, afterSeq: number, signal?: AbortSignal): AsyncIterable<AgentEvent> {
    return { [Symbol.asyncIterator]: () => this.iterate(sessionId, afterSeq, signal) };
  }

  private async *iterate(sessionId: string, afterSeq: number, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
    if (signal?.aborted) return;
    const s = this.state(sessionId);
    const sub: Subscriber = { queue: [], wake: null, closed: false };
    const oldest = s.buffer.length ? s.buffer[0].seq : s.seq + 1;
    if (afterSeq + 1 < oldest) {
      // The caller missed events that are no longer buffered.
      sub.queue.push({
        seq: afterSeq, sessionId, at: this.now(), type: 'error',
        code: 'resume_gap', message: `events before seq ${oldest} are no longer available`, retryable: false,
      });
    }
    for (const e of s.buffer) if (e.seq > afterSeq) sub.queue.push(e);
    s.subscribers.add(sub);
    const onAbort = () => { sub.closed = true; sub.wake?.(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      while (true) {
        while (sub.queue.length) yield sub.queue.shift()!;
        if (sub.closed) return;
        await new Promise<void>((resolve) => { sub.wake = resolve; });
        sub.wake = null;
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
      s.subscribers.delete(sub);
    }
  }

  close(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    for (const sub of s.subscribers) { sub.closed = true; sub.wake?.(); }
    this.sessions.delete(sessionId);
  }
}
