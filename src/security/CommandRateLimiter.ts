/**
 * CommandRateLimiter — bounded command execution per session and per minute.
 *
 * An autonomous agent in a loop can issue commands far faster than a human
 * reviewer can notice. This limiter caps how many commands may run in a
 * sliding window and how many may run in total for one session, so a runaway
 * loop degrades into a clear error instead of hammering the machine.
 *
 * The clock is injectable so tests are deterministic.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Remaining executions in the current window. */
  remaining: number;
  /** Milliseconds until the window resets (0 when allowed with budget left). */
  retryAfterMs: number;
  reason: string;
}

export interface CommandRateLimiterOptions {
  /** Max commands allowed per window (default 60). */
  maxPerWindow?: number;
  /** Window length in milliseconds (default 60000). */
  windowMs?: number;
  /** Max commands for the whole session; 0 disables the cap (default 500). */
  maxPerSession?: number;
  /** Injectable clock, for tests. */
  now?: () => number;
}

export class CommandRateLimiter {
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly maxPerSession: number;
  private readonly now: () => number;

  private windowStartedAt = 0;
  private windowCount = 0;
  private sessionCount = 0;

  constructor(options: CommandRateLimiterOptions = {}) {
    this.maxPerWindow = Math.max(1, options.maxPerWindow ?? 60);
    this.windowMs = Math.max(1000, options.windowMs ?? 60_000);
    this.maxPerSession = Math.max(0, options.maxPerSession ?? 500);
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Record one command attempt and decide whether it may proceed.
   * A denied attempt still consumes window budget, so a retry storm cannot
   * be used to probe the limit.
   */
  check(): RateLimitDecision {
    const t = this.now();

    if (t - this.windowStartedAt >= this.windowMs) {
      this.windowStartedAt = t;
      this.windowCount = 0;
    }

    if (this.maxPerSession > 0 && this.sessionCount >= this.maxPerSession) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: 0,
        reason:
          `Session command limit reached (${this.maxPerSession}). ` +
          'Stop issuing commands and report what you have completed so far.',
      };
    }

    this.windowCount++;
    this.sessionCount++;

    if (this.windowCount > this.maxPerWindow) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, this.windowStartedAt + this.windowMs - t),
        reason:
          `Command rate limit exceeded (${this.maxPerWindow} per ${Math.round(this.windowMs / 1000)}s). ` +
          'Slow down: batch your inspection or explain what you are looking for.',
      };
    }

    return {
      allowed: true,
      remaining: this.maxPerWindow - this.windowCount,
      retryAfterMs: 0,
      reason: 'within rate limit',
    };
  }

  /** Counters for reporting. */
  stats(): { sessionCount: number; windowCount: number; maxPerWindow: number; maxPerSession: number } {
    return {
      sessionCount: this.sessionCount,
      windowCount: this.windowCount,
      maxPerWindow: this.maxPerWindow,
      maxPerSession: this.maxPerSession,
    };
  }

  /** Reset between runs (a new user task gets a fresh budget). */
  reset(): void {
    this.windowStartedAt = 0;
    this.windowCount = 0;
    this.sessionCount = 0;
  }
}
