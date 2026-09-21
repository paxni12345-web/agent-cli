export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  successThreshold: number;
}

export class CircuitBreaker {
  private failures = new Map<string, number>();
  private successes = new Map<string, number>();
  private openUntil = new Map<string, number>();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      cooldownMs: config?.cooldownMs ?? 60000,
      successThreshold: config?.successThreshold ?? 2,
    };
  }

  isOpen(toolName: string): boolean {
    const until = this.openUntil.get(toolName);

    if (until === undefined) {
      return false;
    }

    if (Date.now() < until) {
      return true;
    }

    this.openUntil.delete(toolName);
    return false;
  }

  recordFailure(toolName: string): void {
    const count = (this.failures.get(toolName) || 0) + 1;
    this.failures.set(toolName, count);
    this.successes.delete(toolName);

    if (count >= this.config.failureThreshold) {
      this.openUntil.set(toolName, Date.now() + this.config.cooldownMs);
    }
  }

  recordSuccess(toolName: string): void {
    if (this.isOpen(toolName)) {
      const count = (this.successes.get(toolName) || 0) + 1;
      this.successes.set(toolName, count);

      if (count >= this.config.successThreshold) {
        this.reset(toolName);
      }
    } else {
      this.failures.delete(toolName);
    }
  }

  reset(toolName: string): void {
    this.failures.delete(toolName);
    this.successes.delete(toolName);
    this.openUntil.delete(toolName);
  }

  getState(toolName: string): {
    open: boolean;
    failures: number;
    cooldownRemaining: number;
  } {
    const open = this.isOpen(toolName);
    const failures = this.failures.get(toolName) || 0;
    const until = this.openUntil.get(toolName);
    const cooldownRemaining = until ? Math.max(0, until - Date.now()) : 0;

    return { open, failures, cooldownRemaining };
  }
}
