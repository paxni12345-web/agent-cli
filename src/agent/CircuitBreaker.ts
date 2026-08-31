/**
 * Circuit Breaker - Prevents repeated failures from overwhelming the system
 *
 * Implements the circuit breaker pattern to protect against cascading failures.
 * When a tool fails repeatedly, the circuit "opens" and prevents further calls
 * for a cooldown period.
 */

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
      failureThreshold: config?.failureThreshold || 5,
      cooldownMs: config?.cooldownMs || 60000, // 1 minute
      successThreshold: config?.successThreshold || 2,
    };
  }

  /**
   * Check if circuit is open for a given tool
   */
  isOpen(toolName: string): boolean {
    const until = this.openUntil.get(toolName);

    if (until && Date.now() < until) {
      return true;
    }

    // Circuit can close after cooldown
    if (until && Date.now() >= until) {
      this.openUntil.delete(toolName);
      return false;
    }

    return false;
  }

  /**
   * Record a failure for a tool
   */
  recordFailure(toolName: string): void {
    const count = (this.failures.get(toolName) || 0) + 1;
    this.failures.set(toolName, count);

    // Reset success counter
    this.successes.delete(toolName);

    if (count >= this.config.failureThreshold) {
      // Open circuit
      this.openUntil.set(toolName, Date.now() + this.config.cooldownMs);
      console.warn(`[CircuitBreaker] Circuit opened for '${toolName}' due to ${count} consecutive failures`);
    }
  }

  /**
   * Record a success for a tool
   */
  recordSuccess(toolName: string): void {
    const wasOpen = this.isOpen(toolName);

    if (wasOpen) {
      // Track successes to close circuit
      const count = (this.successes.get(toolName) || 0) + 1;
      this.successes.set(toolName, count);

      if (count >= this.config.successThreshold) {
        // Close circuit
        this.reset(toolName);
        console.info(`[CircuitBreaker] Circuit closed for '${toolName}' after ${count} successful calls`);
      }
    } else {
      // Normal operation - reset failure counter
      this.failures.delete(toolName);
    }
  }

  /**
   * Reset circuit for a tool
   */
  reset(toolName: string): void {
    this.failures.delete(toolName);
    this.successes.delete(toolName);
    this.openUntil.delete(toolName);
  }

  /**
   * Get current state of a tool's circuit
   */
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

  /**
   * Get stats for all tools
   */
  getStats(): Map<string, { failures: number; open: boolean }> {
    const stats = new Map<string, { failures: number; open: boolean }>();

    for (const [tool, failures] of this.failures.entries()) {
      stats.set(tool, {
        failures,
        open: this.isOpen(tool),
      });
    }

    return stats;
  }
}
