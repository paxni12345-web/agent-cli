/**
 * API Rate Limiting and Throttling System
 * Advanced rate limiting, request throttling, quota management, and traffic control
 */

import { eventBus } from '../core/EventBus';

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

export enum RateLimitAlgorithm {
  TokenBucket = 'token_bucket',
  LeakyBucket = 'leaky_bucket',
  FixedWindow = 'fixed_window',
  SlidingWindow = 'sliding_window',
  SlidingLog = 'sliding_log',
}

export interface RateLimit {
  requests: number;
  period: number; // milliseconds
  burst?: number;
}

export enum LimitScope {
  Global = 'global',
  PerUser = 'per_user',
  PerIP = 'per_ip',
  PerAPIKey = 'per_api_key',
  PerEndpoint = 'per_endpoint',
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // milliseconds
  limit: number;
}

export interface ThrottleConfig {
  id: string;
  name: string;
  strategy: ThrottleStrategy;
  maxConcurrent: number;
  queueSize: number;
  timeout: number; // milliseconds
  priority: boolean;
  enabled: boolean;
  createdAt: Date;
}

export enum ThrottleStrategy {
  Reject = 'reject',
  Queue = 'queue',
  Delay = 'delay',
  Adaptive = 'adaptive',
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

export enum RequestStatus {
  Pending = 'pending',
  Queued = 'queued',
  Processing = 'processing',
  Completed = 'completed',
  Rejected = 'rejected',
  TimedOut = 'timed_out',
}

export interface Quota {
  id: string;
  name: string;
  type: QuotaType;
  limit: number;
  period: number; // milliseconds
  scope: QuotaScope;
  enabled: boolean;
  alerts?: QuotaAlert[];
  createdAt: Date;
}

export enum QuotaType {
  Requests = 'requests',
  Bandwidth = 'bandwidth',
  Compute = 'compute',
  Storage = 'storage',
  Custom = 'custom',
}

export interface QuotaScope {
  level: ScopeLevel;
  identifier?: string;
}

export enum ScopeLevel {
  Global = 'global',
  User = 'user',
  Organization = 'organization',
  Plan = 'plan',
}

export interface QuotaAlert {
  threshold: number; // percentage
  actions: AlertAction[];
}

export interface AlertAction {
  type: AlertType;
  config: Record<string, any>;
}

export enum AlertType {
  Email = 'email',
  Webhook = 'webhook',
  SMS = 'sms',
  Notification = 'notification',
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

export enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half_open',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // milliseconds
  resetTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
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

export enum RuleOperator {
  Equals = 'equals',
  NotEquals = 'not_equals',
  Contains = 'contains',
  StartsWith = 'starts_with',
  EndsWith = 'ends_with',
  GreaterThan = 'greater_than',
  LessThan = 'less_than',
  In = 'in',
  Matches = 'matches',
}

export interface TrafficAction {
  type: ActionType;
  config: Record<string, any>;
}

export enum ActionType {
  Allow = 'allow',
  Deny = 'deny',
  RateLimit = 'rate_limit',
  Throttle = 'throttle',
  Redirect = 'redirect',
  ModifyHeaders = 'modify_headers',
}

export interface BackpressureConfig {
  enabled: boolean;
  strategy: BackpressureStrategy;
  thresholds: BackpressureThresholds;
  actions: BackpressureAction[];
}

export enum BackpressureStrategy {
  DropOldest = 'drop_oldest',
  DropNewest = 'drop_newest',
  Reject = 'reject',
  Slow = 'slow',
}

export interface BackpressureThresholds {
  queueSize: number;
  cpuPercent: number;
  memoryPercent: number;
  latency: number; // milliseconds
}

export interface BackpressureAction {
  type: BackpressureActionType;
  config: Record<string, any>;
}

export enum BackpressureActionType {
  ReduceThroughput = 'reduce_throughput',
  RejectRequests = 'reject_requests',
  EnableCaching = 'enable_caching',
  ScaleOut = 'scale_out',
  Alert = 'alert',
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
  topBlockedClients: Array<{ clientId: string; blocked: number }>;
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
export class RateLimitManager {
  private limiters: Map<string, RateLimiter> = new Map();
  private buckets: Map<string, TokenBucket> = new Map();
  private windows: Map<string, SlidingWindow> = new Map();

  /**
   * Create rate limiter
   */
  createLimiter(config: Omit<RateLimiter, 'id' | 'createdAt'>): RateLimiter {
    const limiter: RateLimiter = {
      ...config,
      id: this.generateLimiterId(),
      createdAt: new Date(),
    };

    this.limiters.set(limiter.id, limiter);

    eventBus.emitSync('ratelimit.limiter_created', limiter, 'RateLimitManager');

    return limiter;
  }

  /**
   * Check rate limit
   */
  async checkLimit(limiterId: string, request: Request): Promise<RateLimitResult> {
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
  getLimiter(limiterId: string): RateLimiter | undefined {
    return this.limiters.get(limiterId);
  }

  /**
   * List limiters
   */
  listLimiters(): RateLimiter[] {
    return Array.from(this.limiters.values());
  }

  /**
   * Delete limiter
   */
  deleteLimiter(limiterId: string): void {
    this.limiters.delete(limiterId);
    eventBus.emitSync('ratelimit.limiter_deleted', { limiterId }, 'RateLimitManager');
  }

  private checkTokenBucket(limiter: RateLimiter, key: string): RateLimitResult {
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

  private checkSlidingWindow(limiter: RateLimiter, key: string): RateLimitResult {
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

  private checkFixedWindow(limiter: RateLimiter, key: string): RateLimitResult {
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

  private getLimitKey(limiter: RateLimiter, request: Request): string {
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

  private generateLimiterId(): string {
    return `limiter_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number;
  lastRefill: number;
}

interface SlidingWindow {
  requests: number[];
  limit: number;
  period: number;
}

/**
 * Throttle Manager
 */
export class ThrottleManager {
  private configs: Map<string, ThrottleConfig> = new Map();
  private queues: Map<string, RequestState[]> = new Map();
  private processing: Map<string, Set<string>> = new Map();

  /**
   * Create throttle config
   */
  createConfig(config: Omit<ThrottleConfig, 'id' | 'createdAt'>): ThrottleConfig {
    const fullConfig: ThrottleConfig = {
      ...config,
      id: this.generateConfigId(),
      createdAt: new Date(),
    };

    this.configs.set(fullConfig.id, fullConfig);

    eventBus.emitSync('throttle.config_created', fullConfig, 'ThrottleManager');

    return fullConfig;
  }

  /**
   * Throttle request
   */
  async throttle(configId: string, request: Request): Promise<RequestState> {
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

    const state: RequestState = {
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
  getConfig(configId: string): ThrottleConfig | undefined {
    return this.configs.get(configId);
  }

  /**
   * List configs
   */
  listConfigs(): ThrottleConfig[] {
    return Array.from(this.configs.values());
  }

  private async processRequest(configId: string, state: RequestState): Promise<RequestState> {
    const processingSet = this.processing.get(configId)!;
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

  private queueRequest(configId: string, state: RequestState, config: ThrottleConfig): RequestState {
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
      } else {
        queue.splice(insertIndex, 0, state);
      }
    } else {
      queue.push(state);
    }

    return state;
  }

  private processNextInQueue(configId: string): void {
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

  private generateConfigId(): string {
    return `throttle_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Quota Manager
 */
export class QuotaManager {
  private quotas: Map<string, Quota> = new Map();
  private usage: Map<string, Map<string, QuotaUsageData>> = new Map();

  /**
   * Create quota
   */
  createQuota(config: Omit<Quota, 'id' | 'createdAt'>): Quota {
    const quota: Quota = {
      ...config,
      id: this.generateQuotaId(),
      createdAt: new Date(),
    };

    this.quotas.set(quota.id, quota);

    eventBus.emitSync('quota.created', quota, 'QuotaManager');

    return quota;
  }

  /**
   * Check quota
   */
  checkQuota(quotaId: string, identifier: string, amount: number = 1): QuotaUsage {
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

    const usage: QuotaUsage = {
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
  getQuota(quotaId: string): Quota | undefined {
    return this.quotas.get(quotaId);
  }

  /**
   * List quotas
   */
  listQuotas(): Quota[] {
    return Array.from(this.quotas.values());
  }

  /**
   * Get usage
   */
  getUsage(quotaId: string, identifier: string): QuotaUsage | undefined {
    const quota = this.quotas.get(quotaId);
    if (!quota) return undefined;

    const usageMap = this.usage.get(quotaId);
    if (!usageMap) return undefined;

    const data = usageMap.get(identifier);
    if (!data) return undefined;

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

  private triggerAlert(quota: Quota, usage: QuotaUsage, alert: QuotaAlert): void {
    eventBus.emitSync('quota.alert_triggered', { quota, usage, alert }, 'QuotaManager');
  }

  private generateQuotaId(): string {
    return `quota_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

interface QuotaUsageData {
  used: number;
  resetAt: number;
}

/**
 * Circuit Breaker Manager
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Create circuit breaker
   */
  createBreaker(config: Omit<CircuitBreaker, 'id' | 'state' | 'metrics' | 'lastStateChange' | 'createdAt'>): CircuitBreaker {
    const breaker: CircuitBreaker = {
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

    eventBus.emitSync('circuit_breaker.created', breaker, 'CircuitBreakerManager');

    return breaker;
  }

  /**
   * Execute with circuit breaker
   */
  async execute<T>(breakerId: string, fn: () => Promise<T>): Promise<T> {
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
      } else {
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
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordFailure(breaker, duration);

      throw error;
    }
  }

  /**
   * Get breaker
   */
  getBreaker(breakerId: string): CircuitBreaker | undefined {
    return this.breakers.get(breakerId);
  }

  /**
   * List breakers
   */
  listBreakers(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  private recordSuccess(breaker: CircuitBreaker, duration: number): void {
    breaker.metrics.totalRequests++;
    breaker.metrics.successfulRequests++;
    this.updateAverageResponseTime(breaker, duration);

    if (breaker.state === CircuitState.HalfOpen) {
      if (breaker.metrics.successfulRequests >= breaker.config.successThreshold) {
        this.transitionTo(breaker, CircuitState.Closed);
      }
    }
  }

  private recordFailure(breaker: CircuitBreaker, duration: number): void {
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

  private transitionTo(breaker: CircuitBreaker, newState: CircuitState): void {
    const oldState = breaker.state;
    breaker.state = newState;
    breaker.lastStateChange = new Date();

    // Reset metrics on state transition
    if (newState === CircuitState.Closed) {
      breaker.metrics.failedRequests = 0;
      breaker.metrics.successfulRequests = 0;
    }

    eventBus.emitSync('circuit_breaker.state_changed', { breaker, oldState, newState }, 'CircuitBreakerManager');
  }

  private updateAverageResponseTime(breaker: CircuitBreaker, duration: number): void {
    const total = breaker.metrics.averageResponseTime * (breaker.metrics.totalRequests - 1) + duration;
    breaker.metrics.averageResponseTime = total / breaker.metrics.totalRequests;
  }

  private generateBreakerId(): string {
    return `breaker_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const rateLimitManager = new RateLimitManager();
export const throttleManager = new ThrottleManager();
export const quotaManager = new QuotaManager();
export const circuitBreakerManager = new CircuitBreakerManager();
