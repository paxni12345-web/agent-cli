/**
 * Error Middleware for API Gateway
 * Provides comprehensive error handling middleware with logging, recovery, and user-friendly responses
 */
import { ErrorContext, RetryConfig } from './ErrorHandling';
import { APIRequest, APIResponse, RequestContext, Middleware } from './APIGateway';
/**
 * Global Error Handler Middleware
 */
export declare class ErrorHandlerMiddleware {
    private readonly errorLogger;
    private readonly includeStackTrace;
    constructor(options?: {
        includeStackTrace?: boolean;
    });
    /**
     * Create error handling middleware
     */
    create(): Middleware;
    /**
     * Handle error and create appropriate response
     */
    private handleError;
    /**
     * Normalize error to Error instance
     */
    private normalizeError;
    /**
     * Determine error severity
     */
    private determineSeverity;
}
/**
 * Async Error Wrapper
 */
export declare function asyncErrorHandler(handler: (request: APIRequest, context: RequestContext) => Promise<APIResponse>): (request: APIRequest, context: RequestContext) => Promise<APIResponse>;
/**
 * Timeout Middleware
 */
export declare class TimeoutMiddleware {
    private readonly timeoutMs;
    constructor(timeoutMs?: number);
    create(): Middleware;
}
/**
 * Retry Middleware
 */
export declare class RetryMiddleware {
    private readonly config;
    constructor(config?: Partial<RetryConfig>);
    create(): Middleware;
}
/**
 * Circuit Breaker Middleware Factory
 */
export declare class CircuitBreakerMiddleware {
    private readonly manager;
    private readonly serviceExtractor;
    constructor(serviceExtractor?: (request: APIRequest) => string);
    create(): Middleware;
    private defaultServiceExtractor;
}
/**
 * Error Recovery Middleware
 */
export declare class ErrorRecoveryMiddleware {
    create(): Middleware;
}
/**
 * Request Validation Error Handler
 */
export declare class ValidationErrorHandler {
    static create(): Middleware;
}
/**
 * Database Error Handler
 */
export declare class DatabaseErrorHandler {
    static create(): Middleware;
}
/**
 * Not Found Handler
 */
export declare class NotFoundHandler {
    static create(resourceName?: string): Middleware;
}
/**
 * Rate Limit Error Handler with enhanced headers
 */
export declare class RateLimitErrorHandler {
    static create(): Middleware;
}
/**
 * External Service Error Handler with Circuit Breaker
 */
export declare class ExternalServiceErrorHandler {
    private readonly circuitBreakerManager;
    constructor();
    create(): Middleware;
}
/**
 * Comprehensive Error Middleware Stack
 */
export declare class ErrorMiddlewareStack {
    /**
     * Create complete error handling middleware stack
     */
    static create(options?: {
        timeout?: number;
        retry?: Partial<RetryConfig>;
        includeStackTrace?: boolean;
        enableCircuitBreaker?: boolean;
        enableRecovery?: boolean;
    }): Middleware[];
}
/**
 * Error Metrics Collector
 */
export declare class ErrorMetricsCollector {
    private metrics;
    /**
     * Record error occurrence
     */
    record(error: Error, context: ErrorContext): void;
    /**
     * Get error metrics
     */
    getMetrics(filter?: {
        errorType?: string;
        path?: string;
    }): ErrorMetric[];
    /**
     * Clear metrics
     */
    clear(): void;
}
export interface ErrorMetric {
    errorType: string;
    path: string;
    count: number;
    lastOccurrence: Date;
    statusCode: number;
}
/**
 * Singleton instances
 */
export declare const errorMetricsCollector: ErrorMetricsCollector;
//# sourceMappingURL=ErrorMiddleware.d.ts.map