/**
 * API Gateway & Network Enhancement
 * Request routing, load balancing, rate limiting, caching
 * Authentication, authorization, request transformation
 * Comprehensive input validation and security middleware
 */
import { EventEmitter } from 'events';
import { ZodSchema } from 'zod';
/**
 * Base error class for all API Gateway errors
 */
export declare class APIGatewayError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    readonly context?: Record<string, any>;
    readonly timestamp: number;
    constructor(message: string, statusCode?: number, code?: string, isOperational?: boolean, context?: Record<string, any>);
}
/**
 * Validation error - 400 Bad Request
 */
export declare class ValidationError extends APIGatewayError {
    readonly errors: ValidationError[];
    constructor(message: string, errors?: any[], context?: Record<string, any>);
}
/**
 * Authentication error - 401 Unauthorized
 */
export declare class AuthenticationError extends APIGatewayError {
    constructor(message?: string, context?: Record<string, any>);
}
/**
 * Authorization error - 403 Forbidden
 */
export declare class AuthorizationError extends APIGatewayError {
    constructor(message?: string, context?: Record<string, any>);
}
/**
 * Not found error - 404 Not Found
 */
export declare class NotFoundError extends APIGatewayError {
    constructor(message?: string, context?: Record<string, any>);
}
/**
 * Rate limit error - 429 Too Many Requests
 */
export declare class RateLimitError extends APIGatewayError {
    readonly retryAfter: number;
    constructor(message: string | undefined, retryAfter: number, context?: Record<string, any>);
}
/**
 * Timeout error - 408 Request Timeout
 */
export declare class TimeoutError extends APIGatewayError {
    constructor(message?: string, context?: Record<string, any>);
}
/**
 * Circuit breaker error - 503 Service Unavailable
 */
export declare class CircuitBreakerError extends APIGatewayError {
    constructor(message?: string, context?: Record<string, any>);
}
/**
 * Upstream error - 502 Bad Gateway
 */
export declare class UpstreamError extends APIGatewayError {
    readonly upstreamStatus?: number;
    constructor(message?: string, upstreamStatus?: number, context?: Record<string, any>);
}
/**
 * Payload too large error - 413
 */
export declare class PayloadTooLargeError extends APIGatewayError {
    readonly maxSize: number;
    readonly actualSize: number;
    constructor(maxSize: number, actualSize: number, context?: Record<string, any>);
}
/**
 * Configuration error - 500 Internal Server Error (non-operational)
 */
export declare class ConfigurationError extends APIGatewayError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Service unavailable error - 503
 */
export declare class ServiceUnavailableError extends APIGatewayError {
    constructor(message?: string, context?: Record<string, any>);
}
export interface ErrorContext {
    requestId: string;
    method: string;
    path: string;
    ip: string;
    userId?: string;
    timestamp: number;
    userAgent?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
}
export interface ErrorLogEntry {
    level: 'error' | 'warn' | 'info';
    message: string;
    error: {
        name: string;
        message: string;
        code: string;
        statusCode: number;
        stack?: string;
        isOperational: boolean;
    };
    context: ErrorContext;
    timestamp: number;
}
/**
 * Error handler with logging and sanitization
 */
export declare class ErrorHandler {
    private static isDevelopment;
    private static errorLogs;
    private static maxLogSize;
    /**
     * Handle error and return appropriate response
     */
    static handleError(error: any, context: ErrorContext): Response;
    /**
     * Normalize any error to APIGatewayError
     */
    private static normalizeError;
    /**
     * Create error response with sanitized stack trace
     */
    private static createErrorResponse;
    /**
     * Sanitize stack trace to remove sensitive information
     */
    private static sanitizeStackTrace;
    /**
     * Log error with full context
     */
    private static logError;
    /**
     * Format and log to console
     */
    private static logToConsole;
    /**
     * Get error logs with filtering
     */
    static getErrorLogs(options?: {
        level?: 'error' | 'warn' | 'info';
        code?: string;
        since?: number;
        limit?: number;
    }): ErrorLogEntry[];
    /**
     * Clear error logs
     */
    static clearErrorLogs(): void;
    /**
     * Check if error is retryable
     */
    static isRetryable(error: any): boolean;
    /**
     * Determine error recovery strategy
     */
    static getRecoveryStrategy(error: APIGatewayError): {
        action: 'retry' | 'fallback' | 'fail' | 'circuit_break';
        delay?: number;
        fallbackData?: any;
    };
}
export interface ValidationConfig {
    schema?: ZodSchema<any>;
    sanitize?: boolean;
    preventXSS?: boolean;
    preventSQLInjection?: boolean;
    preventCommandInjection?: boolean;
    preventPathTraversal?: boolean;
    customValidators?: ValidationRule[];
}
export interface ValidationRule {
    field: string;
    validator: (value: any) => boolean | Promise<boolean>;
    message: string;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
    code: string;
}
export interface SanitizationOptions {
    html?: boolean;
    sql?: boolean;
    command?: boolean;
    path?: boolean;
    trim?: boolean;
    lowercase?: boolean;
    uppercase?: boolean;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    sanitized?: any;
}
export declare const CommonSchemas: {
    email: any;
    phone: any;
    url: any;
    uuid: any;
    username: any;
    password: any;
    ipv4: any;
    ipv6: any;
    positiveInt: any;
    nonNegativeInt: any;
    dateISO: any;
    alphanumeric: any;
    slug: any;
    hexColor: any;
    creditCard: any;
    zipCode: any;
    safeString: any;
};
export interface GatewayConfig {
    port: number;
    host: string;
    enableSSL: boolean;
    enableCaching: boolean;
    enableRateLimiting: boolean;
    enableLoadBalancing: boolean;
    enableCircuitBreaker: boolean;
    enableCompression: boolean;
    enableCORS: boolean;
    enableSecurityHeaders: boolean;
    enableRequestLogging: boolean;
    timeout: number;
    maxRequestSize: number;
    corsOrigins: string[];
    compressionThreshold: number;
}
export interface Route {
    id: string;
    path: string;
    method: HttpMethod;
    target: RouteTarget;
    middleware: Middleware[];
    rateLimit?: RateLimitConfig;
    cache?: CacheConfig;
    auth?: AuthConfig;
    transform?: TransformConfig;
    retry?: RetryConfig;
    timeout?: number;
    validation?: ValidationConfig;
}
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export interface RouteTarget {
    type: 'upstream' | 'function' | 'static';
    upstream?: UpstreamConfig;
    handler?: RequestHandler;
    content?: any;
}
export interface UpstreamConfig {
    servers: UpstreamServer[];
    loadBalancing: LoadBalancingStrategy;
    healthCheck?: HealthCheckConfig;
    circuitBreaker?: CircuitBreakerConfig;
}
export interface UpstreamServer {
    id: string;
    url: string;
    weight: number;
    priority: number;
    maxConnections: number;
    currentConnections: number;
    healthy: boolean;
    lastHealthCheck?: number;
    metadata?: Record<string, any>;
}
export type LoadBalancingStrategy = 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'ip_hash' | 'random' | 'priority';
export interface HealthCheckConfig {
    interval: number;
    timeout: number;
    unhealthyThreshold: number;
    healthyThreshold: number;
    path: string;
    method: string;
    expectedStatus: number[];
}
export interface CircuitBreakerConfig {
    threshold: number;
    timeout: number;
    monitoringPeriod: number;
    fallbackResponse?: any;
}
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    strategy: 'sliding_window' | 'fixed_window' | 'token_bucket';
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
export interface CacheConfig {
    ttl: number;
    keyGenerator?: (req: Request) => string;
    condition?: (req: Request, res: Response) => boolean;
    varyBy?: string[];
    maxSize: number;
    storage: 'memory' | 'redis' | 'disk';
}
export interface AuthConfig {
    type: 'bearer' | 'basic' | 'apikey' | 'jwt' | 'oauth2';
    validator: (token: string) => Promise<boolean>;
    required: boolean;
    scopes?: string[];
}
export interface TransformConfig {
    request?: RequestTransform;
    response?: ResponseTransform;
}
export interface RequestTransform {
    headers?: Record<string, string | ((req: Request) => string)>;
    body?: (body: any) => any;
    query?: Record<string, string>;
}
export interface ResponseTransform {
    headers?: Record<string, string>;
    body?: (body: any) => any;
    status?: (status: number) => number;
}
export interface RetryConfig {
    maxAttempts: number;
    delay: number;
    backoff: 'fixed' | 'exponential' | 'linear';
    retryableStatuses: number[];
    retryableErrors: string[];
}
export interface Request {
    id: string;
    method: HttpMethod;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body?: any;
    params: Record<string, string>;
    ip: string;
    timestamp: number;
    metadata: Record<string, any>;
}
export interface Response {
    status: number;
    headers: Record<string, string>;
    body?: any;
    cached?: boolean;
    fromUpstream?: string;
}
export type Middleware = (req: Request, res: Response, next: () => Promise<void>) => Promise<void>;
export type RequestHandler = (req: Request) => Promise<Response>;
export interface CacheEntry {
    key: string;
    value: Response;
    timestamp: number;
    ttl: number;
    hits: number;
    size: number;
}
export interface RateLimitEntry {
    key: string;
    count: number;
    resetTime: number;
    tokens?: number;
    lastRefill?: number;
}
export interface CircuitBreakerState {
    serverId: string;
    state: 'closed' | 'open' | 'half_open';
    failures: number;
    lastFailure?: number;
    nextAttempt?: number;
}
export interface ProxyMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cachedResponses: number;
    rateLimited: number;
    averageLatency: number;
    requestsPerSecond: number;
    bytesIn: number;
    bytesOut: number;
    compressedResponses: number;
    compressionRatio: number;
}
export interface RequestLog {
    id: string;
    timestamp: number;
    method: HttpMethod;
    path: string;
    ip: string;
    userAgent?: string;
    status: number;
    latency: number;
    bytesIn: number;
    bytesOut: number;
    cached: boolean;
    compressed: boolean;
    error?: string;
}
export declare class ValidationMiddleware {
    /**
     * Validate request against schema and security rules
     */
    static validate(request: Request, config: ValidationConfig): Promise<ValidationResult>;
    /**
     * Check for XSS patterns
     */
    private static checkXSS;
    /**
     * Check for SQL injection patterns
     */
    private static checkSQLInjection;
    /**
     * Check for command injection patterns
     */
    private static checkCommandInjection;
    /**
     * Check for path traversal patterns
     */
    private static checkPathTraversal;
    /**
     * Sanitize request data
     */
    private static sanitizeRequest;
    /**
     * Sanitize HTML content
     */
    private static sanitizeHTML;
    /**
     * Sanitize SQL content
     */
    private static sanitizeSQL;
    /**
     * Sanitize command content
     */
    private static sanitizeCommand;
    /**
     * Sanitize path content
     */
    private static sanitizePath;
    /**
     * Get nested value from object
     */
    private static getNestedValue;
    /**
     * Get field value from request
     */
    private static getFieldValue;
    /**
     * Create validation middleware
     */
    static createMiddleware(config: ValidationConfig): Middleware;
}
export declare class APIGateway extends EventEmitter {
    private config;
    private routes;
    private cache;
    private rateLimits;
    private circuitBreakers;
    private server?;
    private metrics;
    private roundRobinIndex;
    private requestLogs;
    private maxLogSize;
    constructor(config?: Partial<GatewayConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    registerRoute(route: Omit<Route, 'id'>): Route;
    unregisterRoute(method: HttpMethod, path: string): void;
    getRoute(method: HttpMethod, path: string): Route | undefined;
    listRoutes(): Route[];
    private getRouteKey;
    private handleRequest;
    /**
     * Send error response (simplified version for early errors)
     */
    private sendErrorResponse;
    private parseRequest;
    private readRequestBody;
    private findRoute;
    private matchPath;
    private extractParams;
    private executeRoute;
    private proxyToUpstream;
    /**
     * Normalize upstream errors
     */
    private normalizeUpstreamError;
    /**
     * Check if upstream error is retryable
     */
    private isRetryableUpstreamError;
    private selectUpstreamServer;
    private selectRoundRobin;
    private selectLeastConnections;
    private selectWeightedRoundRobin;
    private selectPriority;
    private forwardRequest;
    private checkRateLimit;
    private checkFixedWindow;
    private checkSlidingWindow;
    private checkTokenBucket;
    /**
     * Create per-endpoint rate limiter
     */
    createRateLimiter(config: RateLimitConfig): Middleware;
    /**
     * Reset rate limit for a specific key
     */
    resetRateLimit(key: string): void;
    /**
     * Get rate limit status for a key
     */
    getRateLimitStatus(key: string): RateLimitEntry | undefined;
    private getCached;
    private cacheResponse;
    private getCacheKey;
    private evictCacheIfNeeded;
    private checkCircuitBreaker;
    private recordCircuitBreakerSuccess;
    private recordCircuitBreakerFailure;
    /**
     * Manually reset circuit breaker for a server
     */
    resetCircuitBreaker(serverId: string): void;
    /**
     * Get circuit breaker status for all servers
     */
    getCircuitBreakerStatus(): Map<string, CircuitBreakerState>;
    private checkAuth;
    private extractBearerToken;
    private extractBasicAuth;
    private transformRequest;
    private transformResponse;
    private sendFinalResponse;
    private sendResponse;
    private isRetryableError;
    private calculateRetryDelay;
    private delay;
    /**
     * Create retry middleware for routes
     */
    createRetryMiddleware(config: RetryConfig): Middleware;
    private initializeMetrics;
    private updateLatencyMetrics;
    private updateCompressionMetrics;
    private startMetricsCollection;
    getMetrics(): ProxyMetrics;
    /**
     * Get error logs
     */
    getErrorLogs(options?: {
        level?: 'error' | 'warn' | 'info';
        code?: string;
        since?: number;
        limit?: number;
    }): ErrorLogEntry[];
    /**
     * Clear error logs
     */
    clearErrorLogs(): void;
    /**
     * Get health status including error rates
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        uptime: number;
        metrics: ProxyMetrics;
        circuitBreakers: {
            serverId: string;
            state: string;
            failures: number;
        }[];
        errorRate: number;
        recentErrors: ErrorLogEntry[];
    };
    private generateId;
    clearCache(): void;
    resetMetrics(): void;
    private handleCORSPreflight;
    private addCORSHeaders;
    private isOriginAllowed;
    private addSecurityHeaders;
    private getBaseHeaders;
    private getAuthenticateHeader;
    private supportsCompression;
    private compressResponse;
    private logRequest;
    private formatLogMessage;
    private addRequestLog;
    getRequestLogs(options?: {
        limit?: number;
        status?: number;
        method?: HttpMethod;
        pathPattern?: string;
        since?: number;
    }): RequestLog[];
    clearRequestLogs(): void;
}
export declare const ValidationHelpers: {
    /**
     * Create a complete validation config with all security features
     */
    createSecureValidation(schema: ZodSchema<any>): ValidationConfig;
    /**
     * Create validation config for API endpoints
     */
    createAPIValidation(schema: ZodSchema<any>): ValidationConfig;
    /**
     * Create validation config for file operations
     */
    createFileValidation(schema: ZodSchema<any>): ValidationConfig;
    /**
     * Create rate limit config for different endpoint types
     */
    createRateLimit: {
        strict: () => RateLimitConfig;
        moderate: () => RateLimitConfig;
        lenient: () => RateLimitConfig;
        custom: (maxRequests: number, windowMs: number, strategy: RateLimitConfig["strategy"]) => RateLimitConfig;
        perUser: (maxRequests: number, windowMs: number) => RateLimitConfig;
        perEndpoint: (endpoint: string, maxRequests: number, windowMs: number) => RateLimitConfig;
    };
    /**
     * Common validation patterns
     */
    patterns: {
        email: (required?: boolean) => any;
        phone: (required?: boolean) => any;
        url: (required?: boolean) => any;
        username: (required?: boolean) => any;
        password: (required?: boolean) => any;
        stringWithLength: (min: number, max: number, required?: boolean) => any;
        numberInRange: (min: number, max: number, required?: boolean) => any;
        integerInRange: (min: number, max: number, required?: boolean) => any;
        array: (itemSchema: ZodSchema<any>, minLength?: number, maxLength?: number, required?: boolean) => any;
        enum: <T extends string>(values: T[], required?: boolean) => ZodSchema<T | undefined>;
        safeText: (maxLength?: number, required?: boolean) => any;
    };
};
export declare class APIHandlerFactory {
    /**
     * Create a complete production-ready API handler with all features
     */
    static createHandler(config: {
        schema?: ZodSchema<any>;
        auth?: AuthConfig;
        rateLimit?: RateLimitConfig;
        cache?: CacheConfig;
        handler: RequestHandler;
        middleware?: Middleware[];
    }): Route;
    /**
     * Create RESTful CRUD handlers for a resource
     */
    static createRESTHandlers<T>(config: {
        resource: string;
        schema: {
            create: ZodSchema<any>;
            update: ZodSchema<any>;
            query: ZodSchema<any>;
        };
        service: {
            list: (query: any) => Promise<T[]>;
            get: (id: string) => Promise<T | null>;
            create: (data: any) => Promise<T>;
            update: (id: string, data: any) => Promise<T>;
            delete: (id: string) => Promise<void>;
        };
        auth?: AuthConfig;
        rateLimit?: RateLimitConfig;
    }): Omit<Route, 'id'>[];
}
export declare class MiddlewareFactory {
    /**
     * Create logging middleware
     */
    static logger(): Middleware;
    /**
     * Create request ID middleware
     */
    static requestId(): Middleware;
    /**
     * Create timeout middleware
     */
    static timeout(ms: number): Middleware;
    /**
     * Create user context middleware
     */
    static userContext(): Middleware;
    /**
     * Create error handling middleware with recovery strategies
     */
    static errorHandler(options?: {
        enableRecovery?: boolean;
        fallbackData?: any;
    }): Middleware;
    /**
     * Create circuit breaker middleware
     */
    static circuitBreaker(config: {
        threshold: number;
        timeout: number;
        monitoringPeriod: number;
        fallbackResponse?: any;
    }): Middleware;
    /**
     * Create request size limit middleware
     */
    static sizeLimit(maxBytes: number): Middleware;
    /**
     * Create API key validation middleware
     */
    static apiKey(validKeys: Set<string>): Middleware;
    /**
     * Create response time header middleware
     */
    static responseTime(): Middleware;
    /**
     * Create CORS middleware
     */
    static cors(options?: {
        origins?: string[];
        methods?: string[];
        headers?: string[];
        credentials?: boolean;
    }): Middleware;
}
export default APIGateway;
export { APIGateway, ValidationMiddleware, CommonSchemas, APIGatewayError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, RateLimitError, TimeoutError, CircuitBreakerError, UpstreamError, PayloadTooLargeError, ConfigurationError, ServiceUnavailableError, ErrorHandler, ErrorContext, ErrorLogEntry, };
export declare class ErrorRecovery {
    /**
     * Execute with automatic retry and fallback
     */
    static executeWithRecovery<T>(fn: () => Promise<T>, options?: {
        maxRetries?: number;
        retryDelay?: number;
        backoff?: 'fixed' | 'exponential' | 'linear';
        fallback?: T;
        onRetry?: (attempt: number, error: Error) => void;
        shouldRetry?: (error: Error) => boolean;
    }): Promise<T>;
    /**
     * Execute with timeout
     */
    static executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, timeoutError?: Error): Promise<T>;
    /**
     * Execute with circuit breaker pattern
     */
    static createCircuitBreaker<T>(options: {
        threshold: number;
        timeout: number;
        monitoringPeriod: number;
        fallback?: T;
    }): (fn: () => Promise<T>) => Promise<T>;
    /**
     * Execute multiple operations with fallback chain
     */
    static executeWithFallbackChain<T>(operations: Array<() => Promise<T>>): Promise<T>;
    /**
     * Graceful degradation wrapper
     */
    static gracefulDegrade<T>(primary: () => Promise<T>, secondary: () => Promise<T>, tertiary?: T): Promise<T>;
}
export declare class ErrorMonitor {
    private static listeners;
    /**
     * Subscribe to error events
     */
    static onError(listener: (entry: ErrorLogEntry) => void): () => void;
    /**
     * Emit error event
     */
    static emitError(entry: ErrorLogEntry): void;
    /**
     * Check error thresholds and alert
     */
    static checkThresholds(options: {
        errorRateThreshold: number;
        timeWindowMs: number;
        onThresholdExceeded: (stats: {
            errorRate: number;
            totalErrors: number;
            totalRequests: number;
        }) => void;
    }): void;
    /**
     * Get error statistics
     */
    static getErrorStats(since?: number): {
        total: number;
        byCode: Record<string, number>;
        byLevel: Record<string, number>;
        byStatusCode: Record<number, number>;
    };
}
//# sourceMappingURL=APIGateway.d.ts.map