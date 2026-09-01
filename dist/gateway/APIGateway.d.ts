/**
 * PHASE 3: ADVANCED API GATEWAY & RATE LIMITING
 * Comprehensive API management, rate limiting, and traffic control
 *
 * Part of 350K lines goal - PHASE 3
 */
import { EventEmitter } from 'events';
import { ValidationConfig } from './ValidationMiddleware';
import { RetryConfig } from './ErrorHandling';
export interface GatewayConfig {
    port: number;
    host: string;
    enableRateLimiting: boolean;
    enableCaching: boolean;
    enableAuth: boolean;
    enableCompression: boolean;
    maxRequestSize: number;
    timeout: number;
    enableLogging: boolean;
    enableSecurityHeaders: boolean;
    corsOrigins?: string[];
    compressionLevel?: number;
    logFormat?: 'json' | 'text';
}
export interface APIRoute {
    id: string;
    path: string;
    method: HttpMethod;
    backend: Backend;
    middleware: Middleware[];
    rateLimit?: RateLimitConfig;
    cache?: CacheConfig;
    auth?: AuthConfig;
    transform?: TransformConfig;
    metadata: RouteMetadata;
}
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export interface Backend {
    type: BackendType;
    url?: string;
    service?: string;
    function?: string;
    timeout?: number;
    retries?: number;
    healthCheck?: HealthCheckConfig;
}
export type BackendType = 'http' | 'grpc' | 'lambda' | 'service';
export interface HealthCheckConfig {
    enabled: boolean;
    interval: number;
    timeout: number;
    path: string;
    healthyThreshold: number;
    unhealthyThreshold: number;
}
export interface Middleware {
    name: string;
    type: MiddlewareType;
    config: Record<string, any> | ValidationConfig;
    order: number;
}
export type MiddlewareType = 'auth' | 'rate_limit' | 'cache' | 'transform' | 'validate' | 'cors' | 'compression' | 'logging' | 'custom';
export interface RouteMetadata {
    name: string;
    description: string;
    version: string;
    tags: string[];
    deprecated?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface RateLimitConfig {
    strategy: RateLimitStrategy;
    limit: number;
    window: number;
    keyGenerator?: KeyGenerator;
    scope: RateLimitScope;
    burst?: number;
}
export type RateLimitStrategy = 'fixed_window' | 'sliding_window' | 'token_bucket' | 'leaky_bucket' | 'concurrent_requests';
export type KeyGenerator = (request: APIRequest) => string;
export type RateLimitScope = 'global' | 'user' | 'ip' | 'api_key' | 'custom';
export interface RateLimitState {
    key: string;
    count: number;
    resetAt: Date;
    tokens?: number;
    lastRefill?: Date;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
}
export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    varyBy?: string[];
    conditions?: CacheCondition[];
    invalidation?: InvalidationConfig;
}
export interface CacheCondition {
    type: 'status' | 'header' | 'method';
    value: any;
}
export interface InvalidationConfig {
    patterns?: string[];
    events?: string[];
    manual?: boolean;
}
export interface CacheEntry {
    key: string;
    value: any;
    headers: Record<string, string>;
    status: number;
    createdAt: Date;
    expiresAt: Date;
    hits: number;
}
export interface AuthConfig {
    type: AuthType;
    required: boolean;
    scopes?: string[];
    roles?: string[];
}
export type AuthType = 'api_key' | 'jwt' | 'oauth2' | 'basic' | 'custom';
export interface APIKey {
    id: string;
    key: string;
    name: string;
    scopes: string[];
    rateLimit?: RateLimitConfig;
    expiresAt?: Date;
    createdAt: Date;
    lastUsedAt?: Date;
}
export interface APIRequest {
    id: string;
    method: HttpMethod;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body?: any;
    ip: string;
    userAgent: string;
    timestamp: Date;
    metadata: RequestMetadata;
    rawBody?: Buffer;
    params?: Record<string, string>;
}
export interface RequestMetadata {
    userId?: string;
    apiKey?: string;
    sessionId?: string;
    traceId?: string;
}
export interface APIResponse {
    requestId: string;
    status: number;
    headers: Record<string, string>;
    body?: any;
    cached: boolean;
    duration: number;
    timestamp: Date;
    compressed?: boolean;
    size?: number;
}
export interface TransformConfig {
    request?: RequestTransform;
    response?: ResponseTransform;
}
export interface RequestTransform {
    addHeaders?: Record<string, string>;
    removeHeaders?: string[];
    modifyPath?: PathModification;
    modifyBody?: BodyModification;
}
export interface ResponseTransform {
    addHeaders?: Record<string, string>;
    removeHeaders?: string[];
    modifyBody?: BodyModification;
    filterFields?: string[];
}
export interface PathModification {
    type: 'rewrite' | 'prefix' | 'suffix';
    value: string;
}
export interface BodyModification {
    type: 'jsonpath' | 'template' | 'function';
    expression: string;
}
export interface TrafficPolicy {
    id: string;
    name: string;
    routes: string[];
    rules: TrafficRule[];
    enabled: boolean;
}
export interface TrafficRule {
    type: TrafficRuleType;
    condition: TrafficCondition;
    action: TrafficAction;
    priority: number;
}
export type TrafficRuleType = 'route' | 'redirect' | 'block' | 'throttle' | 'mirror' | 'ab_test';
export interface TrafficCondition {
    field: ConditionField;
    operator: string;
    value: any;
}
export type ConditionField = 'path' | 'header' | 'query' | 'ip' | 'time' | 'random';
export interface TrafficAction {
    type: string;
    config: Record<string, any>;
}
export interface APIMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    throughput: number;
    cacheHitRate: number;
}
export interface RouteMetrics {
    routeId: string;
    requests: number;
    errors: number;
    latencies: number[];
    statusCodes: Map<number, number>;
}
export interface LoadBalancerConfig {
    algorithm: LoadBalancingAlgorithm;
    healthCheck: boolean;
    sessionAffinity?: AffinityConfig;
}
export type LoadBalancingAlgorithm = 'round_robin' | 'least_connections' | 'weighted' | 'ip_hash' | 'random' | 'least_response_time';
export interface AffinityConfig {
    type: 'cookie' | 'header' | 'ip';
    key?: string;
    ttl?: number;
}
export interface CircuitBreakerConfig {
    enabled: boolean;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    halfOpenRequests: number;
}
export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half_open';
    failures: number;
    successes: number;
    lastFailure?: Date;
    nextAttempt?: Date;
}
export declare class APIGatewayManager extends EventEmitter {
    private config;
    private routes;
    private rateLimitStates;
    private cache;
    private apiKeys;
    private trafficPolicies;
    private circuitBreakers;
    private requests;
    private responses;
    private routeMetrics;
    private validationFactory;
    private errorLogger;
    private enhancedCircuitBreakers;
    private errorRecoveryManager;
    private retryConfig;
    constructor(config?: Partial<GatewayConfig>);
    private setupErrorRecovery;
    private setupErrorLogging;
    registerRoute(route: Omit<APIRoute, 'id'>): APIRoute;
    findRoute(method: HttpMethod, path: string): APIRoute | undefined;
    private matchPath;
    private extractPathParams;
    handleRequest(request: APIRequest): Promise<APIResponse>;
    private processRequest;
    private handleError;
    private getOrCreateCircuitBreaker;
    private attemptErrorRecovery;
    private checkRateLimit;
    private generateRateLimitKey;
    private getCachedResponse;
    private cacheResponse;
    private generateCacheKey;
    private applyMiddleware;
    private applyAuthMiddleware;
    private applyCorsMiddleware;
    private applyValidationMiddleware;
    private forwardToBackend;
    private forwardToHTTP;
    private forwardToService;
    private forwardToLambda;
    private forwardToGRPC;
    private isCircuitOpen;
    private recordCircuitBreakerSuccess;
    private recordCircuitBreakerFailure;
    private transformRequest;
    private transformResponse;
    createAPIKey(name: string, scopes: string[], expiresIn?: number): APIKey;
    private generateKey;
    private parseRequestBody;
    private addSecurityHeaders;
    private shouldCompressResponse;
    private compressResponse;
    private sanitizeErrorMessage;
    private logRequest;
    private logResponse;
    private logError;
    private sanitizeHeaders;
    private createResponse;
    private createErrorResponse;
    private getErrorCode;
    private updateMetrics;
    private generateId;
    private sleep;
    getMetrics(): APIMetrics;
    getStats(): {
        routes: number;
        rateLimitStates: number;
        cacheEntries: number;
        apiKeys: number;
        trafficPolicies: number;
        requests: number;
        responses: number;
        metrics: APIMetrics;
        errorStats: {
            total: number;
            bySeverity: Record<import("./ErrorHandling").ErrorSeverity, number>;
            recent: number;
        };
        circuitBreakers: {
            state: import("./ErrorHandling").CircuitState;
            failures: number;
            successes: number;
            totalRequests: number;
            lastFailureTime?: Date;
            lastStateChange: Date;
            nextAttempt?: Date;
            halfOpenAttempts: number;
            routeId: string;
        }[];
    };
    getErrorLogs(filter?: {
        severity?: 'low' | 'medium' | 'high' | 'critical';
        since?: Date;
        limit?: number;
    }): import("./ErrorHandling").ErrorLog[];
    getErrorStats(): {
        total: number;
        bySeverity: Record<import("./ErrorHandling").ErrorSeverity, number>;
        recent: number;
    };
    getCircuitBreakerStatus(routeId?: string): import("./ErrorHandling").CircuitBreakerMetrics | {
        state: import("./ErrorHandling").CircuitState;
        failures: number;
        successes: number;
        totalRequests: number;
        lastFailureTime?: Date;
        lastStateChange: Date;
        nextAttempt?: Date;
        halfOpenAttempts: number;
        routeId: string;
    }[] | null;
    resetCircuitBreaker(routeId: string): boolean;
    forceOpenCircuitBreaker(routeId: string): boolean;
    setRetryConfig(config: Partial<RetryConfig>): void;
    getRetryConfig(): Partial<RetryConfig>;
    getCorsHeaders(origin?: string): Record<string, string>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Record<string, boolean>;
        uptime: number;
        timestamp: Date;
    }>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=APIGateway.d.ts.map