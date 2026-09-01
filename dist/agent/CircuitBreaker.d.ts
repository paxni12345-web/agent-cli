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
export declare class CircuitBreaker {
    private failures;
    private successes;
    private openUntil;
    private config;
    constructor(config?: Partial<CircuitBreakerConfig>);
    /**
     * Check if circuit is open for a given tool
     */
    isOpen(toolName: string): boolean;
    /**
     * Record a failure for a tool
     */
    recordFailure(toolName: string): void;
    /**
     * Record a success for a tool
     */
    recordSuccess(toolName: string): void;
    /**
     * Reset circuit for a tool
     */
    reset(toolName: string): void;
    /**
     * Get current state of a tool's circuit
     */
    getState(toolName: string): {
        open: boolean;
        failures: number;
        cooldownRemaining: number;
    };
    /**
     * Get stats for all tools
     */
    getStats(): Map<string, {
        failures: number;
        open: boolean;
    }>;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map