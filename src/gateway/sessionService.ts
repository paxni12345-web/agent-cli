import { randomUUID } from 'node:crypto';
import type {
  AgentAdapter, ApprovalChoice, ApprovalStore, Backend, EventBus, Mode, PublishedEvent,
  SandboxEndpoint, SessionRef,
} from './types.js';
import type { BudgetService } from './budget.js';

export type SandboxAcquire =
  | { kind: 'ready'; endpoint: SandboxEndpoint }
  | { kind: 'starting' }
  | { kind: 'busy' }
  | { kind: 'failed'; message: string };

export interface SandboxProvider {
  /** One sandbox per user and mode. Must not block while a machine boots. */
  acquire(userId: string, mode: Mode): Promise<SandboxAcquire>;
}

export const DEFAULT_MODE_BACKEND: Record<Mode, Backend> = {
  chat: 'direct-llm', code: 'opencode', work: 'hermes', agent: 'hermes',
};

export interface SessionServiceDeps {
  adapters: Partial<Record<Backend, AgentAdapter>>;
  modeBackend?: Record<Mode, Backend>;
  sandboxes: SandboxProvider;
  bus: EventBus;
  approvals: ApprovalStore;
  budget: BudgetService;
  /** Approval choices the gateway is willing to offer. Default: once and deny only. */
  allowedChoices?: ApprovalChoice[];
  now?: () => number;
}

export type CreateResult =
  | { kind: 'created'; ref: SessionRef }
  | { kind: 'starting' | 'busy' }
  | { kind: 'budget'; }
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; message: string };

interface Live { ref: SessionRef; ep: SandboxEndpoint; abort: AbortController }

export class SessionService {
  private readonly live = new Map<string, Live>();
  private readonly modeBackend: Record<Mode, Backend>;
  private readonly allowed: ApprovalChoice[];
  private readonly now: () => number;

  constructor(private readonly d: SessionServiceDeps) {
    this.modeBackend = d.modeBackend ?? DEFAULT_MODE_BACKEND;
    this.allowed = d.allowedChoices ?? ['once', 'deny'];
    this.now = d.now ?? Date.now;
  }

  async create(userId: string, mode: Mode): Promise<CreateResult> {
    const backend = this.modeBackend[mode];
    const adapter = this.d.adapters[backend];
    if (!adapter) return { kind: 'unavailable', message: `backend "${backend}" is not available for mode "${mode}"` };
    if (this.d.budget.check(userId).exceeded) return { kind: 'budget' };
    const sb = await this.d.sandboxes.acquire(userId, mode);
    if (sb.kind !== 'ready') return sb.kind === 'failed' ? { kind: 'failed', message: sb.message } : { kind: sb.kind };
    const ref: SessionRef = { id: randomUUID(), userId, mode, backend, createdAt: this.now() };
    try {
      ref.upstreamId = (await adapter.createSession(sb.endpoint, ref)).upstreamId;
    } catch (err) {
      return { kind: 'failed', message: (err as Error).message };
    }
    const live: Live = { ref, ep: sb.endpoint, abort: new AbortController() };
    this.live.set(ref.id, live);
    void this.pump(live, adapter);
    return { kind: 'created', ref };
  }

  /** The session if it exists AND belongs to the user (others get the same "not found"). */
  get(userId: string, sessionId: string): Live | null {
    const l = this.live.get(sessionId);
    return l && l.ref.userId === userId ? l : null;
  }

  adapterFor(l: Live): AgentAdapter { return this.d.adapters[l.ref.backend]!; }

  async send(l: Live, text: string, model?: string): Promise<'ok' | 'budget'> {
    if (this.d.budget.check(l.ref.userId).exceeded) return 'budget';
    await this.adapterFor(l).send(l.ep, l.ref, { text, model });
    return 'ok';
  }

  async stop(l: Live): Promise<void> { await this.adapterFor(l).stop(l.ep, l.ref); }

  async close(l: Live): Promise<void> {
    try { await this.adapterFor(l).stop(l.ep, l.ref); } catch { /* best effort */ }
    l.abort.abort();
    this.live.delete(l.ref.id);
    this.d.bus.close(l.ref.id);
  }

  async approve(l: Live, approvalId: string, choice: ApprovalChoice): Promise<'resolved' | 'already_resolved' | 'not_found' | 'forbidden' | 'invalid_choice' | 'expired'> {
    const stored = this.d.approvals.get(approvalId);
    if (!stored || stored.sessionId !== l.ref.id) return 'not_found';
    const outcome = this.d.approvals.resolve(approvalId, choice, l.ref.userId);
    if (outcome === 'resolved') {
      try {
        await this.adapterFor(l).approve(l.ep, l.ref, stored.approval, choice);
      } catch (err) {
        // The store already recorded the decision (first writer wins), so a retry would be refused:
        // tell the client loudly instead of leaving the run silently stuck.
        this.d.bus.publish(l.ref.id, { type: 'error', code: 'approval_delivery_failed', message: (err as Error).message, retryable: false });
        throw err;
      }
    }
    return outcome;
  }

  /** Adapter events -> gateway bus, with approvals stored and usage booked against the budget. */
  private async pump(l: Live, adapter: AgentAdapter): Promise<void> {
    const { ref } = l;
    const publish = (e: PublishedEvent) => this.d.bus.publish(ref.id, e);
    try {
      for await (const raw of adapter.events(l.ep, ref, l.abort.signal)) {
        const e = this.rewrite(ref, raw);
        if (!e) continue;
        if (e.type === 'approval.requested') this.d.approvals.put(ref.id, ref.userId, e.approval);
        publish(e);
        if (e.type === 'usage') {
          const s = this.d.budget.record(ref.userId, ref.id, e.usage, e.cumulative);
          if (s.exceeded) {
            publish({ type: 'error', code: 'budget_exceeded', message: 'Daily budget reached; the running task was stopped', retryable: false });
            try { await adapter.stop(l.ep, ref); } catch { /* best effort */ }
          }
        }
      }
    } catch (err) {
      if (!l.abort.signal.aborted) publish({ type: 'error', code: 'adapter_failed', message: (err as Error).message, retryable: true });
    }
  }

  /** Namespaces approval ids per session and strips choices the gateway does not offer. */
  private rewrite(ref: SessionRef, e: PublishedEvent): PublishedEvent | null {
    const prefix = `${ref.id}.`;
    if (e.type === 'approval.requested') {
      const choices = e.approval.choices.filter((c) => this.allowed.includes(c));
      if (!choices.includes('deny')) choices.push('deny');
      return { type: 'approval.requested', approval: { ...e.approval, id: e.approval.id.startsWith(prefix) ? e.approval.id : prefix + e.approval.id, choices } };
    }
    if (e.type === 'approval.resolved') {
      return { ...e, approvalId: e.approvalId.startsWith(prefix) ? e.approvalId : prefix + e.approvalId };
    }
    return e;
  }
}
