import type { Usage } from './types.js';

export interface BudgetSummary {
  day: string;
  tokensUsed: number;
  tokenLimit: number;
  costMicroUsd: number;
  costLimitMicroUsd: number | null;
  remainingTokens: number;
  exceeded: boolean;
}

export interface BudgetService {
  /** Is the user still allowed to start or continue work today? */
  check(userId: string): BudgetSummary;
  /**
   * Book usage reported by an upstream. `cumulative` usage is a running total for the session, so only the
   * increase since the previous report is booked. Returns the summary after booking.
   */
  record(userId: string, sessionId: string, usage: Usage, cumulative: boolean): BudgetSummary;
  summary(userId: string): BudgetSummary;
}

export interface InMemoryBudgetOptions {
  dailyTokenLimit?: number;
  /** Optional hard cap in micro-USD (1 USD = 1_000_000), computed from the price table below. */
  dailyCostLimitMicroUsd?: number | null;
  /** Price per million tokens in micro-USD. Defaults to 0 (cost tracking off). */
  priceInPerMTokMicroUsd?: number;
  priceOutPerMTokMicroUsd?: number;
  now?: () => Date;
}

/** Per-user daily budget (UTC day). Durable storage must keep the same record() semantics. */
export class InMemoryBudgetService implements BudgetService {
  private readonly days = new Map<string, { tokens: number; cost: number }>();
  private readonly lastCumulative = new Map<string, Usage>();
  private readonly tokenLimit: number;
  private readonly costLimit: number | null;
  private readonly priceIn: number;
  private readonly priceOut: number;
  private readonly now: () => Date;

  constructor(opts: InMemoryBudgetOptions = {}) {
    this.tokenLimit = opts.dailyTokenLimit ?? 200_000;
    this.costLimit = opts.dailyCostLimitMicroUsd ?? null;
    this.priceIn = opts.priceInPerMTokMicroUsd ?? 0;
    this.priceOut = opts.priceOutPerMTokMicroUsd ?? 0;
    this.now = opts.now ?? (() => new Date());
  }

  private day(): string { return this.now().toISOString().slice(0, 10); }

  summary(userId: string): BudgetSummary {
    const day = this.day();
    const d = this.days.get(`${userId}|${day}`) ?? { tokens: 0, cost: 0 };
    const exceeded = d.tokens >= this.tokenLimit || (this.costLimit !== null && d.cost >= this.costLimit);
    return {
      day, tokensUsed: d.tokens, tokenLimit: this.tokenLimit, costMicroUsd: Math.round(d.cost),
      costLimitMicroUsd: this.costLimit, remainingTokens: Math.max(0, this.tokenLimit - d.tokens), exceeded,
    };
  }

  check(userId: string): BudgetSummary { return this.summary(userId); }

  record(userId: string, sessionId: string, usage: Usage, cumulative: boolean): BudgetSummary {
    let delta = usage;
    if (cumulative) {
      const prev = this.lastCumulative.get(sessionId);
      this.lastCumulative.set(sessionId, usage);
      if (prev) {
        delta = {
          inputTokens: Math.max(0, usage.inputTokens - prev.inputTokens),
          outputTokens: Math.max(0, usage.outputTokens - prev.outputTokens),
          totalTokens: Math.max(0, usage.totalTokens - prev.totalTokens),
        };
      }
    }
    const key = `${userId}|${this.day()}`;
    const d = this.days.get(key) ?? { tokens: 0, cost: 0 };
    d.tokens += delta.totalTokens;
    d.cost += (delta.inputTokens * this.priceIn + delta.outputTokens * this.priceOut) / 1_000_000;
    this.days.set(key, d);
    return this.summary(userId);
  }
}
