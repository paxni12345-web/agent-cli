/**
 * API Gateway and Rate Limiting
 * API management, rate limiting, throttling, quota management, and API analytics
 */
import { AuthenticationSystem, RBACSystem, AuditLogger } from '../security/MEGA_SecurityAuthentication';
import { ValidationError } from './ErrorHandling';
export interface APIEndpoint {
    id: string;
    path: string;
    method: HTTPMethod;
    handler: EndpointHandler;
    middleware: Middleware[];
    rateLimit?: RateLimitConfig;
    authentication?: AuthenticationConfig;
    authorization?: AuthorizationConfig;
    validation?: ValidationConfig;
    caching?: CachingConfig;
    documentation?: EndpointDocumentation;
    tags: string[];
}
export declare enum HTTPMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    OPTIONS = "OPTIONS",
    HEAD = "HEAD"
}
export type EndpointHandler = (request: APIRequest, context: RequestContext) => Promise<APIResponse>;
export type Middleware = (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => Promise<APIResponse>;
export interface APIRequest {
    method: HTTPMethod;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    params: Record<string, string>;
    body: any;
    ip: string;
    userAgent?: string;
}
export interface APIResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: any;
}
export interface RequestContext {
    requestId: string;
    userId?: string;
    startTime: number;
    metadata: Record<string, any>;
}
export interface RateLimitConfig {
    strategy: RateLimitStrategy;
    limit: number;
    window: number;
    burst?: number;
    keyGenerator?: (request: APIRequest) => string;
}
export declare enum RateLimitStrategy {
    FixedWindow = "fixed_window",
    SlidingWindow = "sliding_window",
    TokenBucket = "token_bucket",
    LeakyBucket = "leaky_bucket"
}
export interface AuthenticationConfig {
    type: 'bearer' | 'basic' | 'api_key' | 'oauth';
    required: boolean;
    schemes?: string[];
}
export interface AuthorizationConfig {
    roles?: string[];
    permissions?: string[];
    custom?: (request: APIRequest, context: RequestContext) => Promise<boolean>;
}
export interface ValidationConfig {
    body?: ValidationSchema;
    query?: ValidationSchema;
    params?: ValidationSchema;
    headers?: ValidationSchema;
}
export interface ValidationSchema {
    type: 'object' | 'array' | 'string' | 'number' | 'boolean';
    properties?: Record<string, ValidationSchema>;
    required?: string[];
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    format?: 'email' | 'url' | 'phone' | 'uuid' | 'ip' | 'date' | 'json';
    items?: ValidationSchema;
    enum?: any[];
    zodSchema?: z.ZodSchema;
}
export interface CachingConfig {
    enabled: boolean;
    ttl: number;
    keyGenerator?: (request: APIRequest) => string;
    vary?: string[];
}
export interface EndpointDocumentation {
    summary: string;
    description?: string;
    parameters?: ParameterDocumentation[];
    requestBody?: RequestBodyDocumentation;
    responses: Record<number, ResponseDocumentation>;
    examples?: ExampleDocumentation[];
}
export interface ParameterDocumentation {
    name: string;
    in: 'path' | 'query' | 'header';
    description?: string;
    required: boolean;
    schema: ValidationSchema;
}
export interface RequestBodyDocumentation {
    description?: string;
    required: boolean;
    schema: ValidationSchema;
}
export interface ResponseDocumentation {
    description: string;
    schema?: ValidationSchema;
}
export interface ExampleDocumentation {
    name: string;
    request: Partial<APIRequest>;
    response: APIResponse;
}
export interface RateLimitState {
    key: string;
    count: number;
    resetAt: Date;
    tokens?: number;
}
export interface APIMetrics {
    endpoint: string;
    method: HTTPMethod;
    requestCount: number;
    errorCount: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    statusCodes: Record<number, number>;
    timestamp: Date;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface SanitizationConfig {
    allowHTML?: boolean;
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
}
/**
 * Input Sanitizer - Prevents XSS, SQL Injection, Command Injection, Path Traversal
 */
export declare class InputSanitizer {
    /**
     * Sanitize string input to prevent XSS attacks
     */
    static sanitizeHTML(input: string, config?: SanitizationConfig): string;
    /**
     * Prevent SQL injection by escaping dangerous characters
     */
    static sanitizeSQL(input: string): string;
    /**
     * Prevent command injection by removing dangerous shell characters
     */
    static sanitizeCommand(input: string): string;
    /**
     * Prevent path traversal attacks
     */
    static sanitizePath(input: string): string;
    /**
     * Sanitize object recursively
     */
    static sanitizeObject(obj: any, config?: SanitizationConfig): any;
    /**
     * Validate and sanitize email
     */
    static sanitizeEmail(email: string): string | null;
    /**
     * Validate and sanitize URL
     */
    static sanitizeURL(url: string): string | null;
}
/**
 * Request Validator - Comprehensive validation with Zod schemas
 */
export declare class RequestValidator {
    /**
     * Validate request against validation config
     */
    static validate(request: APIRequest, config: ValidationConfig): ValidationError[];
    /**
     * Validate value against schema
     */
    private static validateValue;
    /**
     * Validate type
     */
    private static validateType;
    /**
     * Validate string
     */
    private static validateString;
    /**
     * Validate number
     */
    private static validateNumber;
    /**
     * Validate array
     */
    private static validateArray;
    /**
     * Validate object
     */
    private static validateObject;
    /**
     * Validate format
     */
    private static validateFormat;
    /**
     * Create Zod schema from ValidationSchema
     */
    static createZodSchema(schema: ValidationSchema): z.ZodSchema;
}
export interface QuotaConfig {
    userId: string;
    limit: number;
    period: 'hour' | 'day' | 'month';
    used: number;
    resetAt: Date;
}
/**
 * API Gateway
 */
export declare class APIGateway {
    private endpoints;
    private rateLimiter;
    private cache;
    private metrics;
    private globalMiddleware;
    private authSystem;
    private rbacSystem;
    private auditLogger;
    private errorHandler;
    private circuitBreakerManager;
    constructor(authSystem?: AuthenticationSystem, rbacSystem?: RBACSystem, auditLogger?: AuditLogger, options?: {
        enableErrorHandling?: boolean;
        errorHandlingOptions?: {
            timeout?: number;
            retry?: {
                maxAttempts?: number;
                initialDelay?: number;
            };
            includeStackTrace?: boolean;
            enableCircuitBreaker?: boolean;
            enableRecovery?: boolean;
        };
    });
    /**
     * Register endpoint
     */
    registerEndpoint(endpoint: Omit<APIEndpoint, 'id'>): APIEndpoint;
    /**
     * Remove endpoint
     */
    removeEndpoint(endpointId: string): void;
    /**
     * Handle request with comprehensive error handling
     */
    handleRequest(request: APIRequest): Promise<APIResponse>;
    /**
     * Add global middleware
     */
    use(middleware: Middleware): void;
    /**
     * Get metrics
     */
    getMetrics(filter?: {
        endpoint?: string;
        method?: HTTPMethod;
    }): APIMetrics[];
    /**
     * Get authentication system
     */
    getAuthSystem(): AuthenticationSystem;
    /**
     * Get RBAC system
     */
    getRBACSystem(): RBACSystem;
    /**
     * Get audit logger
     */
    getAuditLogger(): AuditLogger;
    /**
     * Get circuit breaker manager
     */
    getCircuitBreakerManager(): import("./ErrorHandling").CircuitBreakerManager;
    /**
     * Get error logger
     */
    getErrorLogger(): import("./ErrorHandling").ErrorLogger;
    /**
     * Get error metrics
     */
    getErrorMetrics(filter?: {
        errorType?: string;
        path?: string;
    }): import("./ErrorMiddleware").ErrorMetric[];
    /**
     * Execute with retry logic
     */
    executeWithRetry<T>(fn: () => Promise<T>, config?: {
        maxAttempts?: number;
        initialDelay?: number;
        maxDelay?: number;
    }): Promise<T>;
    /**
     * Execute with circuit breaker
     */
    executeWithCircuitBreaker<T>(serviceName: string, fn: () => Promise<T>, config?: {
        failureThreshold?: number;
        resetTimeout?: number;
    }): Promise<T>;
    /**
     * List endpoints
     */
    listEndpoints(filter?: {
        tags?: string[];
    }): APIEndpoint[];
    /**
     * Generate OpenAPI specification
     */
    generateOpenAPISpec(): OpenAPISpec;
    private findEndpoint;
    private matchPath;
    private extractParams;
    private validateRequest;
    /**
     * Determine error severity for logging
     */
    private determineErrorSeverity;
    /**
     * Create error response from APIError
     */
    private createErrorResponseFromAPIError;
    /**
     * Get user-friendly error message
     */
    private getUserFriendlyErrorMessage;
    /**
     * Sanitize stack trace
     */
    private sanitizeStackTrace;
    private authenticate;
    private authorize;
    private buildMiddlewareChain;
    private createErrorResponse;
    /**
     * Get error code from status code
     */
    private getErrorCodeFromStatus;
    private defaultRateLimitKey;
    private defaultCacheKey;
    private generateEndpointId;
    private generateRequestId;
}
/**
 * Rate Limiter
 */
export declare class RateLimiter {
    private states;
    /**
     * Check rate limit
     */
    checkLimit(key: string, config: RateLimitConfig): Promise<boolean>;
    /**
     * Get rate limit state
     */
    getState(key: string): RateLimitState | undefined;
    /**
     * Reset rate limit
     */
    reset(key: string): void;
    private checkFixedWindow;
    private checkSlidingWindow;
    private checkTokenBucket;
    private checkLeakyBucket;
}
/**
 * API Cache
 */
export declare class APICache {
    private cache;
    get(key: string): Promise<APIResponse | null>;
    set(key: string, response: APIResponse, ttl: number): Promise<void>;
    clear(): void;
}
/**
 * Metrics Collector
 */
export declare class MetricsCollector {
    private metrics;
    private latencies;
    record(endpoint: APIEndpoint, request: APIRequest, response: APIResponse, duration: number): void;
    getMetrics(filter?: {
        endpoint?: string;
        method?: HTTPMethod;
    }): APIMetrics[];
    clear(): void;
}
/**
 * Quota Manager
 */
export declare class QuotaManager {
    private quotas;
    /**
     * Set quota
     */
    setQuota(userId: string, limit: number, period: QuotaConfig['period']): QuotaConfig;
    /**
     * Check quota
     */
    checkQuota(userId: string): boolean;
    /**
     * Increment usage
     */
    incrementUsage(userId: string): void;
    /**
     * Get quota
     */
    getQuota(userId: string): QuotaConfig | undefined;
    private calculateResetTime;
}
export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
    };
    paths: Record<string, any>;
}
/**
 * Singleton instances
 */
export declare const apiGateway: APIGateway;
export declare const quotaManager: QuotaManager;
/**
 * Validation Middleware Factory
 */
export declare class ValidationMiddleware {
    /**
     * Create validation middleware from schema
     */
    static create(config: ValidationConfig): Middleware;
    /**
     * Create sanitization middleware
     */
    static createSanitizer(config?: SanitizationConfig): Middleware;
    /**
     * Create rate limiting middleware per endpoint
     */
    static createRateLimiter(config: RateLimitConfig): Middleware;
    /**
     * Create XSS protection middleware
     */
    static createXSSProtection(): Middleware;
    /**
     * Create SQL injection protection middleware
     */
    static createSQLInjectionProtection(): Middleware;
    /**
     * Create command injection protection middleware
     */
    static createCommandInjectionProtection(): Middleware;
    /**
     * Create path traversal protection middleware
     */
    static createPathTraversalProtection(): Middleware;
    /**
     * Create comprehensive security middleware (combines all protections)
     */
    static createSecurityMiddleware(config?: {
        rateLimiting?: RateLimitConfig;
        sanitization?: SanitizationConfig;
    }): Middleware[];
}
/**
 * Helper functions to create common validation schemas
 */
export declare const ValidationSchemas: {
    /**
     * Email validation schema
     */
    email: () => ValidationSchema;
    /**
     * URL validation schema
     */
    url: () => ValidationSchema;
    /**
     * Phone validation schema
     */
    phone: () => ValidationSchema;
    /**
     * UUID validation schema
     */
    uuid: () => ValidationSchema;
    /**
     * Integer with range
     */
    integer: (min?: number, max?: number) => ValidationSchema;
    /**
     * String with length constraints
     */
    string: (minLength?: number, maxLength?: number, pattern?: string) => ValidationSchema;
    /**
     * Array with constraints
     */
    array: (items?: ValidationSchema, minLength?: number, maxLength?: number) => ValidationSchema;
    /**
     * Object with properties
     */
    object: (properties: Record<string, ValidationSchema>, required?: string[]) => ValidationSchema;
    /**
     * Enum validation
     */
    enum: <T extends string | number>(values: T[]) => ValidationSchema;
};
//# sourceMappingURL=APIGateway.d.ts.map