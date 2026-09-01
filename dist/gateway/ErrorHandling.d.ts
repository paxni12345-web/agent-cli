/**
 * COMPREHENSIVE ERROR HANDLING SYSTEM
 * Custom error classes, middleware, logging, and recovery strategies
 */
import { EventEmitter } from 'events';
export declare class APIGatewayError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    readonly context?: Record<string, any>;
    readonly timestamp: Date;
    readonly requestId?: string;
    constructor(message: string, statusCode?: number, code?: string, isOperational?: boolean, context?: Record<string, any>, requestId?: string);
    toJSON(): {
        name: string;
        message: string;
        statusCode: number;
        code: string;
        timestamp: string;
        requestId: string | undefined;
        context: Record<string, any> | undefined;
    };
}
export declare class ValidationError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class AuthenticationError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class AuthorizationError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class NotFoundError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class RateLimitError extends APIGatewayError {
    readonly retryAfter: number;
    constructor(message: string, retryAfter: number, context?: Record<string, any>, requestId?: string);
}
export declare class TimeoutError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class ServiceUnavailableError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class BadGatewayError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class CircuitBreakerOpenError extends ServiceUnavailableError {
    constructor(service: string, requestId?: string);
}
export declare class PayloadTooLargeError extends APIGatewayError {
    constructor(message: string, maxSize: number, actualSize: number, requestId?: string);
}
export declare class ConflictError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>, requestId?: string);
}
export declare class UpstreamError extends APIGatewayError {
    readonly upstreamService: string;
    readonly upstreamStatus?: number;
    constructor(message: string, upstreamService: string, upstreamStatus?: number, requestId?: string);
}
export interface ErrorContext {
    requestId: string;
    method: string;
    path: string;
    ip: string;
    userAgent: string;
    userId?: string;
    timestamp: Date;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
}
export interface ErrorLog {
    id: string;
    error: APIGatewayError | Error;
    context: ErrorContext;
    stackTrace: string;
    sanitizedStackTrace: string;
    timestamp: Date;
    severity: ErrorSeverity;
}
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export declare class StackTraceSanitizer {
    private static readonly SENSITIVE_PATTERNS;
    private static readonly INTERNAL_PATHS;
    static sanitize(stackTrace: string): string;
    static filterInternalFrames(stackTrace: string): string;
    static getRelevantFrames(stackTrace: string, limit?: number): string;
}
export declare class ErrorLogger extends EventEmitter {
    private errorLogs;
    private readonly maxLogs;
    constructor(maxLogs?: number);
    log(error: Error, context: ErrorContext): ErrorLog;
    private determineSeverity;
    private sanitizeContext;
    private sanitizeHeaders;
    private sanitizeObject;
    getLogs(filter?: {
        severity?: ErrorSeverity;
        since?: Date;
        limit?: number;
    }): ErrorLog[];
    getStats(): {
        total: number;
        bySeverity: Record<ErrorSeverity, number>;
        recent: number;
    };
    private generateId;
}
export declare class ErrorResponseFormatter {
    static format(error: Error, requestId: string, includeStack?: boolean): {
        error: {
            code: string;
            message: string;
            statusCode: number;
            timestamp: string;
            requestId: string;
            details?: any;
            stack?: string;
        };
    };
    private static getUserFriendlyMessage;
}
export interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: string[];
    retryableStatusCodes: number[];
}
export declare class RetryStrategy {
    private static readonly DEFAULT_CONFIG;
    static executeWithRetry<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>;
    private static isRetryable;
    private static calculateDelay;
    private static sleep;
}
export interface CircuitBreakerOptions {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    halfOpenRequests: number;
    monitoringPeriod: number;
    volumeThreshold: number;
}
export type CircuitState = 'closed' | 'open' | 'half_open';
export interface CircuitBreakerMetrics {
    state: CircuitState;
    failures: number;
    successes: number;
    totalRequests: number;
    lastFailureTime?: Date;
    lastStateChange: Date;
    nextAttempt?: Date;
    halfOpenAttempts: number;
}
export declare class EnhancedCircuitBreaker extends EventEmitter {
    private metrics;
    private readonly options;
    private readonly serviceName;
    constructor(serviceName: string, options?: Partial<CircuitBreakerOptions>);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    private transitionToOpen;
    private transitionToHalfOpen;
    private transitionToClosed;
    getMetrics(): CircuitBreakerMetrics;
    reset(): void;
    forceOpen(): void;
}
export interface RecoveryStrategy {
    name: string;
    canHandle: (error: Error) => boolean;
    recover: (error: Error, context: any) => Promise<any>;
}
export declare class ErrorRecoveryManager {
    private strategies;
    registerStrategy(strategy: RecoveryStrategy): void;
    attemptRecovery(error: Error, context: any): Promise<{
        recovered: boolean;
        result?: any;
        strategy?: string;
    }>;
}
export declare const CacheRecoveryStrategy: RecoveryStrategy;
export declare const FallbackServiceStrategy: RecoveryStrategy;
export declare const DefaultResponseStrategy: RecoveryStrategy;
//# sourceMappingURL=ErrorHandling.d.ts.map