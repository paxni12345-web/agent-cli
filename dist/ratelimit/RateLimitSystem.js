"use strict";
/**
 * API Rate Limiting and Throttling System
 * Advanced rate limiting, request throttling, quota management, and traffic control
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreakerManager = exports.quotaManager = exports.throttleManager = exports.rateLimitManager = exports.CircuitBreakerManager = exports.QuotaManager = exports.ThrottleManager = exports.RateLimitManager = exports.BackpressureActionType = exports.BackpressureStrategy = exports.ActionType = exports.RuleOperator = exports.CircuitState = exports.AlertType = exports.ScopeLevel = exports.QuotaType = exports.RequestStatus = exports.ThrottleStrategy = exports.LimitScope = exports.RateLimitAlgorithm = void 0;
const EventBus_1 = require("../core/EventBus");
var RateLimitAlgorithm;
(function (RateLimitAlgorithm) {
    RateLimitAlgorithm["TokenBucket"] = "token_bucket";
    RateLimitAlgorithm["LeakyBucket"] = "leaky_bucket";
    RateLimitAlgorithm["FixedWindow"] = "fixed_window";
    RateLimitAlgorithm["SlidingWindow"] = "sliding_window";
    RateLimitAlgorithm["SlidingLog"] = "sliding_log";
})(RateLimitAlgorithm || (exports.RateLimitAlgorithm = RateLimitAlgorithm = {}));
var LimitScope;
(function (LimitScope) {
    LimitScope["Global"] = "global";
    LimitScope["PerUser"] = "per_user";
    LimitScope["PerIP"] = "per_ip";
    LimitScope["PerAPIKey"] = "per_api_key";
    LimitScope["PerEndpoint"] = "per_endpoint";
})(LimitScope || (exports.LimitScope = LimitScope = {}));
var ThrottleStrategy;
(function (ThrottleStrategy) {
    ThrottleStrategy["Reject"] = "reject";
    ThrottleStrategy["Queue"] = "queue";
    ThrottleStrategy["Delay"] = "delay";
    ThrottleStrategy["Adaptive"] = "adaptive";
})(ThrottleStrategy || (exports.ThrottleStrategy = ThrottleStrategy = {}));
var RequestStatus;
(function (RequestStatus) {
    RequestStatus["Pending"] = "pending";
    RequestStatus["Queued"] = "queued";
    RequestStatus["Processing"] = "processing";
    RequestStatus["Completed"] = "completed";
    RequestStatus["Rejected"] = "rejected";
    RequestStatus["TimedOut"] = "timed_out";
})(RequestStatus || (exports.RequestStatus = RequestStatus = {}));
var QuotaType;
(function (QuotaType) {
    QuotaType["Requests"] = "requests";
    QuotaType["Bandwidth"] = "bandwidth";
    QuotaType["Compute"] = "compute";
    QuotaType["Storage"] = "storage";
    QuotaType["Custom"] = "custom";
})(QuotaType || (exports.QuotaType = QuotaType = {}));
var ScopeLevel;
(function (ScopeLevel) {
    ScopeLevel["Global"] = "global";
    ScopeLevel["User"] = "user";
    ScopeLevel["Organization"] = "organization";
    ScopeLevel["Plan"] = "plan";
})(ScopeLevel || (exports.ScopeLevel = ScopeLevel = {}));
var AlertType;
(function (AlertType) {
    AlertType["Email"] = "email";
    AlertType["Webhook"] = "webhook";
    AlertType["SMS"] = "sms";
    AlertType["Notification"] = "notification";
})(AlertType || (exports.AlertType = AlertType = {}));
var CircuitState;
(function (CircuitState) {
    CircuitState["Closed"] = "closed";
    CircuitState["Open"] = "open";
    CircuitState["HalfOpen"] = "half_open";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
var RuleOperator;
(function (RuleOperator) {
    RuleOperator["Equals"] = "equals";
    RuleOperator["NotEquals"] = "not_equals";
    RuleOperator["Contains"] = "contains";
    RuleOperator["StartsWith"] = "starts_with";
    RuleOperator["EndsWith"] = "ends_with";
    RuleOperator["GreaterThan"] = "greater_than";
    RuleOperator["LessThan"] = "less_than";
    RuleOperator["In"] = "in";
    RuleOperator["Matches"] = "matches";
})(RuleOperator || (exports.RuleOperator = RuleOperator = {}));
var ActionType;
(function (ActionType) {
    ActionType["Allow"] = "allow";
    ActionType["Deny"] = "deny";
    ActionType["RateLimit"] = "rate_limit";
    ActionType["Throttle"] = "throttle";
    ActionType["Redirect"] = "redirect";
    ActionType["ModifyHeaders"] = "modify_headers";
})(ActionType || (exports.ActionType = ActionType = {}));
var BackpressureStrategy;
(function (BackpressureStrategy) {
    BackpressureStrategy["DropOldest"] = "drop_oldest";
    BackpressureStrategy["DropNewest"] = "drop_newest";
    BackpressureStrategy["Reject"] = "reject";
    BackpressureStrategy["Slow"] = "slow";
})(BackpressureStrategy || (exports.BackpressureStrategy = BackpressureStrategy = {}));
var BackpressureActionType;
(function (BackpressureActionType) {
    BackpressureActionType["ReduceThroughput"] = "reduce_throughput";
    BackpressureActionType["RejectRequests"] = "reject_requests";
    BackpressureActionType["EnableCaching"] = "enable_caching";
    BackpressureActionType["ScaleOut"] = "scale_out";
    BackpressureActionType["Alert"] = "alert";
})(BackpressureActionType || (exports.BackpressureActionType = BackpressureActionType = {}));
/**
 * Rate Limit Manager
 */
class RateLimitManager {
    limiters = new Map();
    buckets = new Map();
    windows = new Map();
    /**
     * Create rate limiter
     */
    createLimiter(config) {
        const limiter = {
            ...config,
            id: this.generateLimiterId(),
            createdAt: new Date(),
        };
        this.limiters.set(limiter.id, limiter);
        EventBus_1.eventBus.emitSync('ratelimit.limiter_created', limiter, 'RateLimitManager');
        return limiter;
    }
    /**
     * Check rate limit
     */
    async checkLimit(limiterId, request) {
        const limiter = this.limiters.get(limiterId);
        if (!limiter || !limiter.enabled) {
            return {
                allowed: true,
                remaining: Infinity,
                resetAt: new Date(Date.now() + 3600000),
                limit: Infinity,
            };
        }
        const key = this.getLimitKey(limiter, request);
        switch (limiter.algorithm) {
            case RateLimitAlgorithm.TokenBucket:
                return this.checkTokenBucket(limiter, key);
            case RateLimitAlgorithm.SlidingWindow:
                return this.checkSlidingWindow(limiter, key);
            case RateLimitAlgorithm.FixedWindow:
                return this.checkFixedWindow(limiter, key);
            default:
                return {
                    allowed: true,
                    remaining: 0,
                    resetAt: new Date(),
                    limit: 0,
                };
        }
    }
    /**
     * Get limiter
     */
    getLimiter(limiterId) {
        return this.limiters.get(limiterId);
    }
    /**
     * List limiters
     */
    listLimiters() {
        return Array.from(this.limiters.values());
    }
    /**
     * Delete limiter
     */
    deleteLimiter(limiterId) {
        this.limiters.delete(limiterId);
        EventBus_1.eventBus.emitSync('ratelimit.limiter_deleted', { limiterId }, 'RateLimitManager');
    }
    checkTokenBucket(limiter, key) {
        const limit = limiter.limits[0];
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = {
                tokens: limit.requests,
                capacity: limit.burst || limit.requests,
                refillRate: limit.requests / limit.period,
                lastRefill: Date.now(),
            };
            this.buckets.set(key, bucket);
        }
        // Refill tokens
        const now = Date.now();
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = (timePassed * bucket.refillRate) / 1000;
        bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
        // Check if request is allowed
        const allowed = bucket.tokens >= 1;
        if (allowed) {
            bucket.tokens -= 1;
        }
        const resetAt = new Date(now + (1 - bucket.tokens) * (1000 / bucket.refillRate));
        return {
            allowed,
            remaining: Math.floor(bucket.tokens),
            resetAt,
            retryAfter: allowed ? undefined : Math.ceil((1 - bucket.tokens) * (1000 / bucket.refillRate)),
            limit: limit.requests,
        };
    }
    checkSlidingWindow(limiter, key) {
        const limit = limiter.limits[0];
        let window = this.windows.get(key);
        if (!window) {
            window = {
                requests: [],
                limit: limit.requests,
                period: limit.period,
            };
            this.windows.set(key, window);
        }
        const now = Date.now();
        const cutoff = now - limit.period;
        // Remove old requests
        window.requests = window.requests.filter(timestamp => timestamp > cutoff);
        const allowed = window.requests.length < limit.requests;
        if (allowed) {
            window.requests.push(now);
        }
        const resetAt = new Date(window.requests[0] + limit.period);
        return {
            allowed,
            remaining: limit.requests - window.requests.length,
            resetAt,
            retryAfter: allowed ? undefined : resetAt.getTime() - now,
            limit: limit.requests,
        };
    }
    checkFixedWindow(limiter, key) {
        const limit = limiter.limits[0];
        const now = Date.now();
        const windowStart = Math.floor(now / limit.period) * limit.period;
        const windowKey = `${key}:${windowStart}`;
        let window = this.windows.get(windowKey);
        if (!window) {
            window = {
                requests: [],
                limit: limit.requests,
                period: limit.period,
            };
            this.windows.set(windowKey, window);
        }
        const allowed = window.requests.length < limit.requests;
        if (allowed) {
            window.requests.push(now);
        }
        const resetAt = new Date(windowStart + limit.period);
        return {
            allowed,
            remaining: limit.requests - window.requests.length,
            resetAt,
            retryAfter: allowed ? undefined : resetAt.getTime() - now,
            limit: limit.requests,
        };
    }
    getLimitKey(limiter, request) {
        switch (limiter.scope) {
            case LimitScope.Global:
                return 'global';
            case LimitScope.PerUser:
                return `user:${request.clientId}`;
            case LimitScope.PerIP:
                return `ip:${request.ip}`;
            case LimitScope.PerAPIKey:
                return `key:${request.apiKey || 'none'}`;
            case LimitScope.PerEndpoint:
                return `endpoint:${request.endpoint}`;
            default:
                return 'default';
        }
    }
    generateLimiterId() {
        return `limiter_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.RateLimitManager = RateLimitManager;
/**
 * Throttle Manager
 */
class ThrottleManager {
    configs = new Map();
    queues = new Map();
    processing = new Map();
    /**
     * Create throttle config
     */
    createConfig(config) {
        const fullConfig = {
            ...config,
            id: this.generateConfigId(),
            createdAt: new Date(),
        };
        this.configs.set(fullConfig.id, fullConfig);
        EventBus_1.eventBus.emitSync('throttle.config_created', fullConfig, 'ThrottleManager');
        return fullConfig;
    }
    /**
     * Throttle request
     */
    async throttle(configId, request) {
        const config = this.configs.get(configId);
        if (!config || !config.enabled) {
            return {
                request,
                status: RequestStatus.Completed,
                startedAt: new Date(),
                completedAt: new Date(),
                duration: 0,
            };
        }
        const processingSet = this.processing.get(configId) || new Set();
        this.processing.set(configId, processingSet);
        const state = {
            request,
            status: RequestStatus.Pending,
        };
        // Check if can process immediately
        if (processingSet.size < config.maxConcurrent) {
            return this.processRequest(configId, state);
        }
        // Apply throttle strategy
        switch (config.strategy) {
            case ThrottleStrategy.Reject:
                state.status = RequestStatus.Rejected;
                return state;
            case ThrottleStrategy.Queue:
                return this.queueRequest(configId, state, config);
            case ThrottleStrategy.Delay:
                await new Promise(resolve => setTimeout(resolve, 100));
                return this.processRequest(configId, state);
            default:
                return this.processRequest(configId, state);
        }
    }
    /**
     * Get config
     */
    getConfig(configId) {
        return this.configs.get(configId);
    }
    /**
     * List configs
     */
    listConfigs() {
        return Array.from(this.configs.values());
    }
    async processRequest(configId, state) {
        const processingSet = this.processing.get(configId);
        processingSet.add(state.request.id);
        state.status = RequestStatus.Processing;
        state.startedAt = new Date();
        // Mock request processing
        await new Promise(resolve => setTimeout(resolve, 50));
        state.status = RequestStatus.Completed;
        state.completedAt = new Date();
        state.duration = state.completedAt.getTime() - state.startedAt.getTime();
        processingSet.delete(state.request.id);
        // Process next queued request
        this.processNextInQueue(configId);
        return state;
    }
    queueRequest(configId, state, config) {
        let queue = this.queues.get(configId);
        if (!queue) {
            queue = [];
            this.queues.set(configId, queue);
        }
        if (queue.length >= config.queueSize) {
            state.status = RequestStatus.Rejected;
            return state;
        }
        state.status = RequestStatus.Queued;
        state.queuedAt = new Date();
        if (config.priority) {
            // Priority queue - sort by request priority
            const priority = state.request.priority || 0;
            const insertIndex = queue.findIndex(s => (s.request.priority || 0) < priority);
            if (insertIndex === -1) {
                queue.push(state);
            }
            else {
                queue.splice(insertIndex, 0, state);
            }
        }
        else {
            queue.push(state);
        }
        return state;
    }
    processNextInQueue(configId) {
        const queue = this.queues.get(configId);
        const config = this.configs.get(configId);
        const processingSet = this.processing.get(configId);
        if (!queue || !config || !processingSet || queue.length === 0) {
            return;
        }
        if (processingSet.size < config.maxConcurrent) {
            const nextState = queue.shift();
            if (nextState) {
                this.processRequest(configId, nextState);
            }
        }
    }
    generateConfigId() {
        return `throttle_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ThrottleManager = ThrottleManager;
/**
 * Quota Manager
 */
class QuotaManager {
    quotas = new Map();
    usage = new Map();
    /**
     * Create quota
     */
    createQuota(config) {
        const quota = {
            ...config,
            id: this.generateQuotaId(),
            createdAt: new Date(),
        };
        this.quotas.set(quota.id, quota);
        EventBus_1.eventBus.emitSync('quota.created', quota, 'QuotaManager');
        return quota;
    }
    /**
     * Check quota
     */
    checkQuota(quotaId, identifier, amount = 1) {
        const quota = this.quotas.get(quotaId);
        if (!quota || !quota.enabled) {
            return {
                quotaId,
                identifier,
                used: 0,
                limit: Infinity,
                percentage: 0,
                resetAt: new Date(Date.now() + 3600000),
                exceeded: false,
            };
        }
        const usageMap = this.usage.get(quotaId) || new Map();
        this.usage.set(quotaId, usageMap);
        let data = usageMap.get(identifier);
        const now = Date.now();
        if (!data || now >= data.resetAt) {
            data = {
                used: 0,
                resetAt: now + quota.period,
            };
            usageMap.set(identifier, data);
        }
        data.used += amount;
        const usage = {
            quotaId,
            identifier,
            used: data.used,
            limit: quota.limit,
            percentage: (data.used / quota.limit) * 100,
            resetAt: new Date(data.resetAt),
            exceeded: data.used > quota.limit,
        };
        // Check alerts
        if (quota.alerts) {
            for (const alert of quota.alerts) {
                if (usage.percentage >= alert.threshold) {
                    this.triggerAlert(quota, usage, alert);
                }
            }
        }
        return usage;
    }
    /**
     * Get quota
     */
    getQuota(quotaId) {
        return this.quotas.get(quotaId);
    }
    /**
     * List quotas
     */
    listQuotas() {
        return Array.from(this.quotas.values());
    }
    /**
     * Get usage
     */
    getUsage(quotaId, identifier) {
        const quota = this.quotas.get(quotaId);
        if (!quota)
            return undefined;
        const usageMap = this.usage.get(quotaId);
        if (!usageMap)
            return undefined;
        const data = usageMap.get(identifier);
        if (!data)
            return undefined;
        return {
            quotaId,
            identifier,
            used: data.used,
            limit: quota.limit,
            percentage: (data.used / quota.limit) * 100,
            resetAt: new Date(data.resetAt),
            exceeded: data.used > quota.limit,
        };
    }
    triggerAlert(quota, usage, alert) {
        EventBus_1.eventBus.emitSync('quota.alert_triggered', { quota, usage, alert }, 'QuotaManager');
    }
    generateQuotaId() {
        return `quota_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.QuotaManager = QuotaManager;
/**
 * Circuit Breaker Manager
 */
class CircuitBreakerManager {
    breakers = new Map();
    /**
     * Create circuit breaker
     */
    createBreaker(config) {
        const breaker = {
            ...config,
            id: this.generateBreakerId(),
            state: CircuitState.Closed,
            metrics: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                rejectedRequests: 0,
                averageResponseTime: 0,
            },
            lastStateChange: new Date(),
            createdAt: new Date(),
        };
        this.breakers.set(breaker.id, breaker);
        EventBus_1.eventBus.emitSync('circuit_breaker.created', breaker, 'CircuitBreakerManager');
        return breaker;
    }
    /**
     * Execute with circuit breaker
     */
    async execute(breakerId, fn) {
        const breaker = this.breakers.get(breakerId);
        if (!breaker) {
            return fn();
        }
        // Check state
        if (breaker.state === CircuitState.Open) {
            // Check if should transition to half-open
            const timeSinceStateChange = Date.now() - breaker.lastStateChange.getTime();
            if (timeSinceStateChange >= breaker.config.resetTimeout) {
                this.transitionTo(breaker, CircuitState.HalfOpen);
            }
            else {
                breaker.metrics.rejectedRequests++;
                throw new Error('Circuit breaker is open');
            }
        }
        // Execute request
        const startTime = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            this.recordSuccess(breaker, duration);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.recordFailure(breaker, duration);
            throw error;
        }
    }
    /**
     * Get breaker
     */
    getBreaker(breakerId) {
        return this.breakers.get(breakerId);
    }
    /**
     * List breakers
     */
    listBreakers() {
        return Array.from(this.breakers.values());
    }
    recordSuccess(breaker, duration) {
        breaker.metrics.totalRequests++;
        breaker.metrics.successfulRequests++;
        this.updateAverageResponseTime(breaker, duration);
        if (breaker.state === CircuitState.HalfOpen) {
            if (breaker.metrics.successfulRequests >= breaker.config.successThreshold) {
                this.transitionTo(breaker, CircuitState.Closed);
            }
        }
    }
    recordFailure(breaker, duration) {
        breaker.metrics.totalRequests++;
        breaker.metrics.failedRequests++;
        breaker.metrics.lastFailure = new Date();
        this.updateAverageResponseTime(breaker, duration);
        const recentWindow = breaker.config.monitoringPeriod;
        const failureRate = breaker.metrics.failedRequests / breaker.metrics.totalRequests;
        if (failureRate >= breaker.config.failureThreshold) {
            this.transitionTo(breaker, CircuitState.Open);
        }
    }
    transitionTo(breaker, newState) {
        const oldState = breaker.state;
        breaker.state = newState;
        breaker.lastStateChange = new Date();
        // Reset metrics on state transition
        if (newState === CircuitState.Closed) {
            breaker.metrics.failedRequests = 0;
            breaker.metrics.successfulRequests = 0;
        }
        EventBus_1.eventBus.emitSync('circuit_breaker.state_changed', { breaker, oldState, newState }, 'CircuitBreakerManager');
    }
    updateAverageResponseTime(breaker, duration) {
        const total = breaker.metrics.averageResponseTime * (breaker.metrics.totalRequests - 1) + duration;
        breaker.metrics.averageResponseTime = total / breaker.metrics.totalRequests;
    }
    generateBreakerId() {
        return `breaker_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.CircuitBreakerManager = CircuitBreakerManager;
/**
 * Singleton instances
 */
exports.rateLimitManager = new RateLimitManager();
exports.throttleManager = new ThrottleManager();
exports.quotaManager = new QuotaManager();
exports.circuitBreakerManager = new CircuitBreakerManager();
