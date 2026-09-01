/**
 * API Rate Limiting and Throttling System
 * Advanced rate limiting, request throttling, quota management, and traffic control
 */
export interface RateLimiter {
    id: string;
    name: string;
    algorithm: RateLimitAlgorithm;
    limits: RateLimit[];
    scope: LimitScope;
    enabled: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
}
export declare enum RateLimitAlgorithm {
    TokenBucket = "token_bucket",
    LeakyBucket = "leaky_bucket",
    FixedWindow = "fixed_window",
    SlidingWindow = "sliding_window",
    SlidingLog = "sliding_log"
}
export interface RateLimit {
    requests: number;
    period: number;
    burst?: number;
}
export declare enum LimitScope {
    Global = "global",
    PerUser = "per_user",
    PerIP = "per_ip",
    PerAPIKey = "per_api_key",
    PerEndpoint = "per_endpoint"
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
    limit: number;
}
export interface ThrottleConfig {
    id: string;
    name: string;
    strategy: ThrottleStrategy;
    maxConcurrent: number;
    queueSize: number;
    timeout: number;
    priority: boolean;
    enabled: boolean;
    createdAt: Date;
}
export declare enum ThrottleStrategy {
    Reject = "reject",
    Queue = "queue",
    Delay = "delay",
    Adaptive = "adaptive"
}
export interface Request {
    id: string;
    clientId: string;
    endpoint: string;
    method: string;
    ip: string;
    apiKey?: string;
    priority?: number;
    timestamp: Date;
    metadata: Record<string, any>;
}
export interface RequestState {
    request: Request;
    status: RequestStatus;
    queuedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
}
export declare enum RequestStatus {
    Pending = "pending",
    Queued = "queued",
    Processing = "processing",
    Completed = "completed",
    Rejected = "rejected",
    TimedOut = "timed_out"
}
export interface Quota {
    id: string;
    name: string;
    type: QuotaType;
    limit: number;
    period: number;
    scope: QuotaScope;
    enabled: boolean;
    alerts?: QuotaAlert[];
    createdAt: Date;
}
export declare enum QuotaType {
    Requests = "requests",
    Bandwidth = "bandwidth",
    Compute = "compute",
    Storage = "storage",
    Custom = "custom"
}
export interface QuotaScope {
    level: ScopeLevel;
    identifier?: string;
}
export declare enum ScopeLevel {
    Global = "global",
    User = "user",
    Organization = "organization",
    Plan = "plan"
}
export interface QuotaAlert {
    threshold: number;
    actions: AlertAction[];
}
export interface AlertAction {
    type: AlertType;
    config: Record<string, any>;
}
export declare enum AlertType {
    Email = "email",
    Webhook = "webhook",
    SMS = "sms",
    Notification = "notification"
}
export interface QuotaUsage {
    quotaId: string;
    identifier: string;
    used: number;
    limit: number;
    percentage: number;
    resetAt: Date;
    exceeded: boolean;
}
export interface CircuitBreaker {
    id: string;
    name: string;
    endpoint: string;
    state: CircuitState;
    config: CircuitBreakerConfig;
    metrics: CircuitMetrics;
    lastStateChange: Date;
    createdAt: Date;
}
export declare enum CircuitState {
    Closed = "closed",
    Open = "open",
    HalfOpen = "half_open"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
    monitoringPeriod: number;
}
export interface CircuitMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rejectedRequests: number;
    averageResponseTime: number;
    lastFailure?: Date;
}
export interface TrafficPattern {
    id: string;
    name: string;
    rules: TrafficRule[];
    actions: TrafficAction[];
    priority: number;
    enabled: boolean;
    createdAt: Date;
}
export interface TrafficRule {
    field: string;
    operator: RuleOperator;
    value: any;
}
export declare enum RuleOperator {
    Equals = "equals",
    NotEquals = "not_equals",
    Contains = "contains",
    StartsWith = "starts_with",
    EndsWith = "ends_with",
    GreaterThan = "greater_than",
    LessThan = "less_than",
    In = "in",
    Matches = "matches"
}
export interface TrafficAction {
    type: ActionType;
    config: Record<string, any>;
}
export declare enum ActionType {
    Allow = "allow",
    Deny = "deny",
    RateLimit = "rate_limit",
    Throttle = "throttle",
    Redirect = "redirect",
    ModifyHeaders = "modify_headers"
}
export interface BackpressureConfig {
    enabled: boolean;
    strategy: BackpressureStrategy;
    thresholds: BackpressureThresholds;
    actions: BackpressureAction[];
}
export declare enum BackpressureStrategy {
    DropOldest = "drop_oldest",
    DropNewest = "drop_newest",
    Reject = "reject",
    Slow = "slow"
}
export interface BackpressureThresholds {
    queueSize: number;
    cpuPercent: number;
    memoryPercent: number;
    latency: number;
}
export interface BackpressureAction {
    type: BackpressureActionType;
    config: Record<string, any>;
}
export declare enum BackpressureActionType {
    ReduceThroughput = "reduce_throughput",
    RejectRequests = "reject_requests",
    EnableCaching = "enable_caching",
    ScaleOut = "scale_out",
    Alert = "alert"
}
export interface RateLimitStats {
    period: {
        start: Date;
        end: Date;
    };
    totalRequests: number;
    allowedRequests: number;
    blockedRequests: number;
    byClient: Map<string, ClientStats>;
    byEndpoint: Map<string, EndpointStats>;
    topBlockedClients: Array<{
        clientId: string;
        blocked: number;
    }>;
}
export interface ClientStats {
    clientId: string;
    requests: number;
    allowed: number;
    blocked: number;
    quotaUsage: number;
}
export interface EndpointStats {
    endpoint: string;
    requests: number;
    allowed: number;
    blocked: number;
    averageLatency: number;
}
/**
 * Rate Limit Manager
 */
export declare class RateLimitManager {
    private limiters;
    private buckets;
    private windows;
    /**
     * Create rate limiter
     */
    createLimiter(config: Omit<RateLimiter, 'id' | 'createdAt'>): RateLimiter;
    /**
     * Check rate limit
     */
    checkLimit(limiterId: string, request: Request): Promise<RateLimitResult>;
    /**
     * Get limiter
     */
    getLimiter(limiterId: string): RateLimiter | undefined;
    /**
     * List limiters
     */
    listLimiters(): RateLimiter[];
    /**
     * Delete limiter
     */
    deleteLimiter(limiterId: string): void;
    private checkTokenBucket;
    private checkSlidingWindow;
    private checkFixedWindow;
    private getLimitKey;
    private generateLimiterId;
}
/**
 * Throttle Manager
 */
export declare class ThrottleManager {
    private configs;
    private queues;
    private processing;
    /**
     * Create throttle config
     */
    createConfig(config: Omit<ThrottleConfig, 'id' | 'createdAt'>): ThrottleConfig;
    /**
     * Throttle request
     */
    throttle(configId: string, request: Request): Promise<RequestState>;
    /**
     * Get config
     */
    getConfig(configId: string): ThrottleConfig | undefined;
    /**
     * List configs
     */
    listConfigs(): ThrottleConfig[];
    private processRequest;
    private queueRequest;
    private processNextInQueue;
    private generateConfigId;
}
/**
 * Quota Manager
 */
export declare class QuotaManager {
    private quotas;
    private usage;
    /**
     * Create quota
     */
    createQuota(config: Omit<Quota, 'id' | 'createdAt'>): Quota;
    /**
     * Check quota
     */
    checkQuota(quotaId: string, identifier: string, amount?: number): QuotaUsage;
    /**
     * Get quota
     */
    getQuota(quotaId: string): Quota | undefined;
    /**
     * List quotas
     */
    listQuotas(): Quota[];
    /**
     * Get usage
     */
    getUsage(quotaId: string, identifier: string): QuotaUsage | undefined;
    private triggerAlert;
    private generateQuotaId;
}
/**
 * Circuit Breaker Manager
 */
export declare class CircuitBreakerManager {
    private breakers;
    /**
     * Create circuit breaker
     */
    createBreaker(config: Omit<CircuitBreaker, 'id' | 'state' | 'metrics' | 'lastStateChange' | 'createdAt'>): CircuitBreaker;
    /**
     * Execute with circuit breaker
     */
    execute<T>(breakerId: string, fn: () => Promise<T>): Promise<T>;
    /**
     * Get breaker
     */
    getBreaker(breakerId: string): CircuitBreaker | undefined;
    /**
     * List breakers
     */
    listBreakers(): CircuitBreaker[];
    private recordSuccess;
    private recordFailure;
    private transitionTo;
    private updateAverageResponseTime;
    private generateBreakerId;
}
/**
 * Singleton instances
 */
export declare const rateLimitManager: RateLimitManager;
export declare const throttleManager: ThrottleManager;
export declare const quotaManager: QuotaManager;
export declare const circuitBreakerManager: CircuitBreakerManager;
//# sourceMappingURL=RateLimitSystem.d.ts.map