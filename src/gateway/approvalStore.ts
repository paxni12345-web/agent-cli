import type { ApprovalChoice, ApprovalRequest, ApprovalStore, ResolveOutcome, StoredApproval } from './types.js';

export interface InMemoryApprovalStoreOptions {
  /** Approvals older than this are treated as expired. Default 10 minutes. */
  ttlMs?: number;
  now?: () => number;
}

/**
 * Pending-approval registry. `resolve` is synchronous on purpose: JavaScript runs it to completion,
 * so the first caller wins and every later caller sees `already_resolved` (no double approvals).
 * A database-backed store must keep the same guarantee with a conditional update.
 */
export class InMemoryApprovalStore implements ApprovalStore {
  private readonly items = new Map<string, StoredApproval>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(opts: InMemoryApprovalStoreOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 10 * 60 * 1000;
    this.now = opts.now ?? Date.now;
  }

  put(sessionId: string, userId: string, a: ApprovalRequest): void {
    if (this.items.has(a.id)) return; // idempotent: upstream may re-announce the same request
    this.items.set(a.id, { sessionId, userId, approval: a });
  }

  get(approvalId: string): StoredApproval | null {
    return this.items.get(approvalId) ?? null;
  }

  private expired(item: StoredApproval): boolean {
    return this.now() - item.approval.createdAt > this.ttlMs;
  }

  resolve(approvalId: string, choice: ApprovalChoice, byUserId: string): ResolveOutcome {
    const item = this.items.get(approvalId);
    if (!item) return 'not_found';
    if (item.userId !== byUserId) return 'forbidden';
    if (item.resolved) return 'already_resolved';
    if (this.expired(item)) return 'expired';
    if (!item.approval.choices.includes(choice)) return 'invalid_choice';
    item.resolved = { choice, byUserId, at: this.now() };
    return 'resolved';
  }

  pending(userId: string): ApprovalRequest[] {
    const out: ApprovalRequest[] = [];
    for (const item of this.items.values()) {
      if (item.userId === userId && !item.resolved && !this.expired(item)) out.push(item.approval);
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  }
}
