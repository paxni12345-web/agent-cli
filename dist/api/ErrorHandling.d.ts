/**
 * Comprehensive Error Handling System for API Gateway
 * Includes custom error classes, error middleware, logging, retry logic, and circuit breaker
 */
import { APIResponse, RequestContext } from './APIGateway';
/**
 * Base API Error class with additional context
 */
export declare class APIError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    readonly timestamp: Date;
    readonly requestId?: string;
    readonly details?: Record<string, any>;
    constructor(message: string, statusCode?: number, code?: string, isOperational?: boolean, details?: Record<string, any>);
    toJSON(): Record<string, any>;
}
/**
 * Validation Error - 400 Bad Request
 */
export declare class ValidationError extends APIError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * Authentication Error - 401 Unauthorized
 */
export declare class AuthenticationError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Authorization Error - 403 Forbidden
 */
export declare class AuthorizationError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Not Found Error - 404 Not Found
 */
export declare class NotFoundError extends APIError {
    constructor(resource?: string, details?: Record<string, any>);
}
/**
 * Conflict Error - 409 Conflict
 */
export declare class ConflictError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Rate Limit Error - 429 Too Many Requests
 */
export declare class RateLimitError extends APIError {
    readonly retryAfter?: Date;
    constructor(message?: string, retryAfter?: Date, details?: Record<string, any>);
    toJSON(): Record<string, any>;
}
/**
 * Service Unavailable Error - 503
 */
export declare class ServiceUnavailableError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Gateway Timeout Error - 504
 */
export declare class GatewayTimeoutError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Database Error - 500
 */
export declare class DatabaseError extends APIError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * External Service Error - 502 Bad Gateway
 */
export declare class ExternalServiceError extends APIError {
    constructor(service: string, message?: string, details?: Record<string, any>);
}
/**
 * Circuit Breaker Open Error
 */
export declare class CircuitBreakerOpenError extends APIError {
    constructor(service: string, details?: Record<string, any>);
}
/**
 * Error context for logging
 */
export interface ErrorContext {
    requestId?: string;
    userId?: string;
    path?: string;
    method?: string;
    ip?: string;
    userAgent?: string;
    timestamp: Date;
    duration?: number;
    additionalData?: Record<string, any>;
}
/**
 * Error Logger with structured logging
 */
export declare class ErrorLogger {
    private static instance;
    private errorLog;
    private readonly maxLogSize;
    private constructor();
    static getInstance(): ErrorLogger;
    /**
     * Log error with context
     */
    log(error: Error, context: ErrorContext, severity?: ErrorSeverity): void;
    /**
     * Sanitize stack trace to remove sensitive information
     */
    private sanitizeStackTrace;
    /**
     * Console log based on severity
     */
    private consoleLog;
    /**
     * Get error logs
     */
    getLogs(filter?: {
        severity?: ErrorSeverity;
        limit?: number;
    }): ErrorLogEntry[];
    /**
     * Clear logs
     */
    clear(): void;
}
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export interface ErrorLogEntry {
    error: {
        name: string;
        message: string;
        stack?: string;
        code?: string;
        statusCode: number;
    };
    context: ErrorContext;
    severity: ErrorSeverity;
    timestamp: Date;
}
/**
 * Error Response Builder
 */
export declare class ErrorResponseBuilder {
    /**
     * Build user-friendly error response
     */
    static build(error: Error, context?: RequestContext, includeStack?: boolean): APIResponse;
    /**
     * Get user-friendly error message
     */
    private static getUserFriendlyMessage;
}
/**
 * Retry Configuration
 */
export interface RetryConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors?: string[];
    retryableStatusCodes?: number[];
}
/**
 * Retry Handler with exponential backoff
 */
export declare class RetryHandler {
    private static readonly DEFAULT_CONFIG;
    /**
     * Execute function with retry logic
     */
    static execute<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>;
    /**
     * Check if error is retryable
     */
    private static isRetryableError;
    private static sleep;
}
/**
 * Circuit Breaker State
 */
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
    monitoringPeriod: number;
}
/**
 * Circuit Breaker Statistics
 */
export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
}
/**
 * Circuit Breaker for downstream services
 */
export declare class CircuitBreaker {
    private state;
    private failures;
    private successes;
    private consecutiveFailures;
    private consecutiveSuccesses;
    private lastFailureTime?;
    private nextAttemptTime?;
    private totalRequests;
    private totalFailures;
    private totalSuccesses;
    private readonly config;
    private readonly serviceName;
    private static readonly DEFAULT_CONFIG;
    constructor(serviceName: string, config?: Partial<CircuitBreakerConfig>);
    /**
     * Execute function with circuit breaker protection
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Execute function with timeout
     */
    private executeWithTimeout;
    /**
     * Handle successful execution
     */
    private onSuccess;
    /**
     * Handle failed execution
     */
    private onFailure;
    /**
     * Open the circuit
     */
    private open;
    /**
     * Check if should attempt reset
     */
    private shouldAttemptReset;
    /**
     * Reset circuit breaker
     */
    private reset;
    /**
     * Get circuit breaker statistics
     */
    getStats(): CircuitBreakerStats;
    /**
     * Manually reset circuit breaker
     */
    forceReset(): void;
    /**
     * Get current state
     */
    getState(): CircuitState;
}
/**
 * Circuit Breaker Manager
 */
export declare class CircuitBreakerManager {
    private static instance;
    private breakers;
    private constructor();
    static getInstance(): CircuitBreakerManager;
    /**
     * Get or create circuit breaker for service
     */
    getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    /**
     * Get all circuit breakers
     */
    getAllBreakers(): Map<string, CircuitBreaker>;
    /**
     * Get circuit breaker statistics for all services
     */
    getAllStats(): Record<string, CircuitBreakerStats>;
    /**
     * Reset all circuit breakers
     */
    resetAll(): void;
}
/**
 * Error Recovery Strategies
 */
export declare class ErrorRecoveryStrategy {
    /**
     * Attempt recovery for common error scenarios
     */
    static attemptRecovery(error: Error, context: ErrorContext): Promise<boolean>;
    /**
     * Get fallback response for error
     */
    static getFallbackResponse(error: Error, context?: RequestContext): APIResponse | null;
}
/**
 * Singleton instances
 */
export declare const errorLogger: ErrorLogger;
export declare const circuitBreakerManager: CircuitBreakerManager;
//# sourceMappingURL=ErrorHandling.d.ts.map