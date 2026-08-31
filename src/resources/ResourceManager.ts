/**
 * Resource Management System
 * Quotas, limits, throttling, usage tracking
 * Multi-tenant resource allocation, overages, billing integration
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ResourceManagerConfig {
  enableQuotas: boolean;
  enableThrottling: boolean;
  enableUsageTracking: boolean;
  enableMultiTenant: boolean;
  defaultQuotaPeriod: QuotaPeriod;
  warningThreshold: number;
  enforceHardLimits: boolean;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  unit: ResourceUnit;
  description?: string;
  metadata: ResourceMetadata;
}

export type ResourceType =
  | 'compute'
  | 'storage'
  | 'network'
  | 'api_calls'
  | 'database'
  | 'memory'
  | 'bandwidth'
  | 'requests'
  | 'custom';

export type ResourceUnit =
  | 'bytes'
  | 'requests'
  | 'calls'
  | 'hours'
  | 'seconds'
  | 'count'
  | 'percentage'
  | 'custom';

export interface ResourceMetadata {
  category?: string;
  tags: string[];
  billable: boolean;
  costPerUnit?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Quota {
  id: string;
  resourceId: string;
  tenantId?: string;
  limit: number;
  period: QuotaPeriod;
  hardLimit: boolean;
  warningThreshold: number;
  resetBehavior: ResetBehavior;
  metadata: QuotaMetadata;
  usage: QuotaUsage;
}

export type QuotaPeriod = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | 'lifetime';

export type ResetBehavior = 'reset' | 'rollover' | 'accumulate';

export interface QuotaMetadata {
  description?: string;
  createdAt: number;
  updatedAt: number;
  effectiveFrom?: number;
  effectiveUntil?: number;
}

export interface QuotaUsage {
  current: number;
  limit: number;
  percentage: number;
  remaining: number;
  resetAt: number;
  exceeded: boolean;
  firstUsedAt?: number;
  lastUsedAt?: number;
}

export interface UsageRecord {
  id: string;
  resourceId: string;
  tenantId?: string;
  userId?: string;
  amount: number;
  timestamp: number;
  metadata: UsageMetadata;
}

export interface UsageMetadata {
  context?: string;
  tags: string[];
  costIncurred?: number;
  [key: string]: any;
}

export interface Throttle {
  id: string;
  resourceId: string;
  tenantId?: string;
  strategy: ThrottleStrategy;
  limit: number;
  window: number;
  burstLimit?: number;
  enabled: boolean;
  state: ThrottleState;
}

export type ThrottleStrategy = 'fixed_window' | 'sliding_window' | 'token_bucket' | 'leaky_bucket';

export interface ThrottleState {
  tokens: number;
  lastRefill: number;
  requests: number[];
  blocked: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  tier: TenantTier;
  quotas: Map<string, Quota>;
  usage: Map<string, number>;
  metadata: TenantMetadata;
}

export type TenantTier = 'free' | 'basic' | 'pro' | 'enterprise' | 'custom';

export interface TenantMetadata {
  createdAt: number;
  updatedAt: number;
  contactEmail?: string;
  billingEnabled: boolean;
  suspended: boolean;
}

export interface ResourceAllocation {
  id: string;
  tenantId: string;
  resourceId: string;
  allocated: number;
  reserved: number;
  available: number;
  priority: AllocationPriority;
}

export type AllocationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface UsageReport {
  tenantId?: string;
  period: ReportPeriod;
  startDate: number;
  endDate: number;
  resources: Map<string, ResourceUsageStats>;
  totalCost?: number;
}

export interface ReportPeriod {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate: number;
  endDate: number;
}

export interface ResourceUsageStats {
  resourceId: string;
  resourceName: string;
  totalUsage: number;
  averageUsage: number;
  peakUsage: number;
  quotaLimit?: number;
  utilizationPercentage: number;
  exceedances: number;
  cost?: number;
}

export interface QuotaViolation {
  id: string;
  quotaId: string;
  tenantId?: string;
  timestamp: number;
  attempted: number;
  allowed: number;
  exceeded: number;
  action: ViolationAction;
}

export type ViolationAction = 'block' | 'allow' | 'warn' | 'throttle';

// ============================================================================
// Resource Manager
// ============================================================================

export class ResourceManager extends EventEmitter {
  private config: ResourceManagerConfig;
  private resources: Map<string, Resource> = new Map();
  private quotas: Map<string, Quota> = new Map();
  private throttles: Map<string, Throttle> = new Map();
  private tenants: Map<string, Tenant> = new Map();
  private usageRecords: UsageRecord[] = [];
  private violations: QuotaViolation[] = [];
  private allocations: Map<string, ResourceAllocation> = new Map();

  constructor(config: Partial<ResourceManagerConfig> = {}) {
    super();
    this.config = {
      enableQuotas: true,
      enableThrottling: true,
      enableUsageTracking: true,
      enableMultiTenant: false,
      defaultQuotaPeriod: 'month',
      warningThreshold: 80,
      enforceHardLimits: true,
      ...config,
    };

    this.startCleanupTimer();
  }

  // ========================================================================
  // Resource Management
  // ========================================================================

  public registerResource(
    name: string,
    type: ResourceType,
    unit: ResourceUnit,
    options: Partial<Resource> = {}
  ): Resource {
    const resource: Resource = {
      id: this.generateId(),
      name,
      type,
      unit,
      description: options.description,
      metadata: {
        category: options.metadata?.category,
        tags: options.metadata?.tags || [],
        billable: options.metadata?.billable ?? true,
        costPerUnit: options.metadata?.costPerUnit,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    this.resources.set(resource.id, resource);
    this.emit('resource:registered', { resource });

    return resource;
  }

  public getResource(id: string): Resource | undefined {
    return this.resources.get(id);
  }

  public getResourceByName(name: string): Resource | undefined {
    return Array.from(this.resources.values()).find(r => r.name === name);
  }

  // ========================================================================
  // Quota Management
  // ========================================================================

  public setQuota(
    resourceId: string,
    limit: number,
    options: QuotaOptions = {}
  ): Quota {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    const quota: Quota = {
      id: this.generateId(),
      resourceId,
      tenantId: options.tenantId,
      limit,
      period: options.period || this.config.defaultQuotaPeriod,
      hardLimit: options.hardLimit ?? this.config.enforceHardLimits,
      warningThreshold: options.warningThreshold || this.config.warningThreshold,
      resetBehavior: options.resetBehavior || 'reset',
      metadata: {
        description: options.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        effectiveFrom: options.effectiveFrom,
        effectiveUntil: options.effectiveUntil,
      },
      usage: {
        current: 0,
        limit,
        percentage: 0,
        remaining: limit,
        resetAt: this.calculateResetTime(options.period || this.config.defaultQuotaPeriod),
        exceeded: false,
      },
    };

    this.quotas.set(quota.id, quota);

    // Update tenant if multi-tenant enabled
    if (this.config.enableMultiTenant && options.tenantId) {
      const tenant = this.tenants.get(options.tenantId);
      if (tenant) {
        tenant.quotas.set(resourceId, quota);
      }
    }

    this.emit('quota:set', { quota });

    return quota;
  }

  public checkQuota(resourceId: string, amount: number, tenantId?: string): QuotaCheckResult {
    const quotas = this.getQuotasForResource(resourceId, tenantId);

    for (const quota of quotas) {
      if (quota.usage.current + amount > quota.limit) {
        if (quota.hardLimit) {
          return {
            allowed: false,
            quota,
            reason: 'Hard limit exceeded',
            remaining: quota.usage.remaining,
          };
        } else {
          return {
            allowed: true,
            quota,
            warning: 'Soft limit exceeded',
            remaining: quota.usage.remaining,
          };
        }
      }

      // Check warning threshold
      const newPercentage = ((quota.usage.current + amount) / quota.limit) * 100;
      if (newPercentage >= quota.warningThreshold && quota.usage.percentage < quota.warningThreshold) {
        this.emit('quota:warning', {
          quota,
          usage: quota.usage.current + amount,
          threshold: quota.warningThreshold,
        });
      }
    }

    return {
      allowed: true,
      remaining: quotas[0]?.usage.remaining,
    };
  }

  private getQuotasForResource(resourceId: string, tenantId?: string): Quota[] {
    return Array.from(this.quotas.values()).filter(
      q => q.resourceId === resourceId && (!tenantId || q.tenantId === tenantId)
    );
  }

  // ========================================================================
  // Usage Tracking
  // ========================================================================

  public recordUsage(
    resourceId: string,
    amount: number,
    options: UsageOptions = {}
  ): UsageRecord {
    if (!this.config.enableUsageTracking) {
      throw new Error('Usage tracking is not enabled');
    }

    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    // Check quota
    if (this.config.enableQuotas) {
      const quotaCheck = this.checkQuota(resourceId, amount, options.tenantId);
      if (!quotaCheck.allowed) {
        this.recordViolation(resourceId, amount, options.tenantId);
        throw new Error(`Quota exceeded: ${quotaCheck.reason}`);
      }
    }

    // Check throttle
    if (this.config.enableThrottling) {
      const throttleCheck = this.checkThrottle(resourceId, options.tenantId);
      if (!throttleCheck.allowed) {
        throw new Error('Rate limit exceeded');
      }
    }

    // Calculate cost
    let cost: number | undefined;
    if (resource.metadata.billable && resource.metadata.costPerUnit) {
      cost = amount * resource.metadata.costPerUnit;
    }

    const record: UsageRecord = {
      id: this.generateId(),
      resourceId,
      tenantId: options.tenantId,
      userId: options.userId,
      amount,
      timestamp: Date.now(),
      metadata: {
        context: options.context,
        tags: options.tags || [],
        costIncurred: cost,
        ...options.metadata,
      },
    };

    this.usageRecords.push(record);

    // Update quota usage
    const quotas = this.getQuotasForResource(resourceId, options.tenantId);
    for (const quota of quotas) {
      quota.usage.current += amount;
      quota.usage.percentage = (quota.usage.current / quota.limit) * 100;
      quota.usage.remaining = Math.max(0, quota.limit - quota.usage.current);
      quota.usage.exceeded = quota.usage.current > quota.limit;
      quota.usage.lastUsedAt = Date.now();

      if (!quota.usage.firstUsedAt) {
        quota.usage.firstUsedAt = Date.now();
      }
    }

    // Update tenant usage
    if (this.config.enableMultiTenant && options.tenantId) {
      const tenant = this.tenants.get(options.tenantId);
      if (tenant) {
        const currentUsage = tenant.usage.get(resourceId) || 0;
        tenant.usage.set(resourceId, currentUsage + amount);
      }
    }

    this.emit('usage:recorded', { record });

    return record;
  }

  private recordViolation(resourceId: string, attempted: number, tenantId?: string): void {
    const quotas = this.getQuotasForResource(resourceId, tenantId);
    if (quotas.length === 0) return;

    const quota = quotas[0];
    const violation: QuotaViolation = {
      id: this.generateId(),
      quotaId: quota.id,
      tenantId,
      timestamp: Date.now(),
      attempted,
      allowed: quota.usage.remaining,
      exceeded: attempted - quota.usage.remaining,
      action: quota.hardLimit ? 'block' : 'warn',
    };

    this.violations.push(violation);
    this.emit('quota:violation', { violation });
  }

  // ========================================================================
  // Throttling
  // ========================================================================

  public setThrottle(
    resourceId: string,
    strategy: ThrottleStrategy,
    limit: number,
    window: number,
    options: ThrottleOptions = {}
  ): Throttle {
    if (!this.config.enableThrottling) {
      throw new Error('Throttling is not enabled');
    }

    const throttle: Throttle = {
      id: this.generateId(),
      resourceId,
      tenantId: options.tenantId,
      strategy,
      limit,
      window,
      burstLimit: options.burstLimit,
      enabled: options.enabled !== false,
      state: {
        tokens: limit,
        lastRefill: Date.now(),
        requests: [],
        blocked: false,
      },
    };

    this.throttles.set(throttle.id, throttle);
    this.emit('throttle:set', { throttle });

    return throttle;
  }

  public checkThrottle(resourceId: string, tenantId?: string): ThrottleCheckResult {
    const throttles = Array.from(this.throttles.values()).filter(
      t => t.resourceId === resourceId && t.enabled && (!tenantId || t.tenantId === tenantId)
    );

    for (const throttle of throttles) {
      const now = Date.now();

      switch (throttle.strategy) {
        case 'fixed_window':
          if (!this.checkFixedWindow(throttle, now)) {
            return { allowed: false, throttle, retryAfter: throttle.window };
          }
          break;

        case 'sliding_window':
          if (!this.checkSlidingWindow(throttle, now)) {
            return { allowed: false, throttle, retryAfter: throttle.window };
          }
          break;

        case 'token_bucket':
          if (!this.checkTokenBucket(throttle, now)) {
            return { allowed: false, throttle };
          }
          break;

        case 'leaky_bucket':
          if (!this.checkLeakyBucket(throttle, now)) {
            return { allowed: false, throttle };
          }
          break;
      }
    }

    return { allowed: true };
  }

  private checkFixedWindow(throttle: Throttle, now: number): boolean {
    const windowStart = Math.floor(now / throttle.window) * throttle.window;
    const recentRequests = throttle.state.requests.filter(t => t >= windowStart);

    if (recentRequests.length >= throttle.limit) {
      return false;
    }

    throttle.state.requests = [...recentRequests, now];
    return true;
  }

  private checkSlidingWindow(throttle: Throttle, now: number): boolean {
    const cutoff = now - throttle.window;
    const recentRequests = throttle.state.requests.filter(t => t > cutoff);

    if (recentRequests.length >= throttle.limit) {
      return false;
    }

    throttle.state.requests = [...recentRequests, now];
    return true;
  }

  private checkTokenBucket(throttle: Throttle, now: number): boolean {
    // Refill tokens
    const elapsed = now - throttle.state.lastRefill;
    const refillAmount = (elapsed / throttle.window) * throttle.limit;
    throttle.state.tokens = Math.min(
      throttle.burstLimit || throttle.limit,
      throttle.state.tokens + refillAmount
    );
    throttle.state.lastRefill = now;

    if (throttle.state.tokens < 1) {
      return false;
    }

    throttle.state.tokens--;
    return true;
  }

  private checkLeakyBucket(throttle: Throttle, now: number): boolean {
    // Leak tokens
    const elapsed = now - throttle.state.lastRefill;
    const leakAmount = (elapsed / throttle.window) * throttle.limit;
    throttle.state.tokens = Math.max(0, throttle.state.tokens - leakAmount);
    throttle.state.lastRefill = now;

    if (throttle.state.tokens >= throttle.limit) {
      return false;
    }

    throttle.state.tokens++;
    return true;
  }

  // ========================================================================
  // Multi-Tenant Management
  // ========================================================================

  public createTenant(name: string, tier: TenantTier): Tenant {
    if (!this.config.enableMultiTenant) {
      throw new Error('Multi-tenant is not enabled');
    }

    const tenant: Tenant = {
      id: this.generateId(),
      name,
      tier,
      quotas: new Map(),
      usage: new Map(),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        billingEnabled: false,
        suspended: false,
      },
    };

    this.tenants.set(tenant.id, tenant);
    this.emit('tenant:created', { tenant });

    return tenant;
  }

  public getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  public suspendTenant(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.metadata.suspended = true;
      this.emit('tenant:suspended', { tenant });
    }
  }

  public resumeTenant(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.metadata.suspended = false;
      this.emit('tenant:resumed', { tenant });
    }
  }

  // ========================================================================
  // Reporting
  // ========================================================================

  public generateUsageReport(options: ReportOptions): UsageReport {
    const { tenantId, startDate, endDate } = options;

    const filteredRecords = this.usageRecords.filter(
      r =>
        r.timestamp >= startDate &&
        r.timestamp <= endDate &&
        (!tenantId || r.tenantId === tenantId)
    );

    const resourceStats = new Map<string, ResourceUsageStats>();

    for (const record of filteredRecords) {
      const resource = this.resources.get(record.resourceId);
      if (!resource) continue;

      let stats = resourceStats.get(record.resourceId);
      if (!stats) {
        stats = {
          resourceId: record.resourceId,
          resourceName: resource.name,
          totalUsage: 0,
          averageUsage: 0,
          peakUsage: 0,
          utilizationPercentage: 0,
          exceedances: 0,
        };
        resourceStats.set(record.resourceId, stats);
      }

      stats.totalUsage += record.amount;
      stats.peakUsage = Math.max(stats.peakUsage, record.amount);

      if (record.metadata.costIncurred) {
        stats.cost = (stats.cost || 0) + record.metadata.costIncurred;
      }
    }

    // Calculate averages
    for (const stats of resourceStats.values()) {
      const resourceRecords = filteredRecords.filter(
        r => r.resourceId === stats.resourceId
      );
      stats.averageUsage = stats.totalUsage / resourceRecords.length;

      const quotas = this.getQuotasForResource(stats.resourceId, tenantId);
      if (quotas.length > 0) {
        stats.quotaLimit = quotas[0].limit;
        stats.utilizationPercentage = (stats.totalUsage / quotas[0].limit) * 100;
      }
    }

    const totalCost = Array.from(resourceStats.values()).reduce(
      (sum, stats) => sum + (stats.cost || 0),
      0
    );

    return {
      tenantId,
      period: {
        type: 'custom',
        startDate,
        endDate,
      },
      startDate,
      endDate,
      resources: resourceStats,
      totalCost: totalCost > 0 ? totalCost : undefined,
    };
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private calculateResetTime(period: QuotaPeriod): number {
    const now = new Date();

    switch (period) {
      case 'minute':
        return now.getTime() + 60000;
      case 'hour':
        return now.getTime() + 3600000;
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      case 'week':
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday).getTime();
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      case 'year':
        return new Date(now.getFullYear() + 1, 0, 1).getTime();
      case 'lifetime':
        return Infinity;
      default:
        return now.getTime() + 2592000000; // 30 days
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredQuotas();
      this.cleanupOldUsageRecords();
    }, 3600000); // Every hour
  }

  private cleanupExpiredQuotas(): void {
    const now = Date.now();

    for (const quota of this.quotas.values()) {
      if (now >= quota.usage.resetAt) {
        // Reset quota based on behavior
        switch (quota.resetBehavior) {
          case 'reset':
            quota.usage.current = 0;
            break;
          case 'rollover':
            quota.usage.current = Math.max(0, quota.usage.current - quota.limit);
            break;
          case 'accumulate':
            // Don't reset
            break;
        }

        quota.usage.percentage = (quota.usage.current / quota.limit) * 100;
        quota.usage.remaining = Math.max(0, quota.limit - quota.usage.current);
        quota.usage.exceeded = quota.usage.current > quota.limit;
        quota.usage.resetAt = this.calculateResetTime(quota.period);

        this.emit('quota:reset', { quota });
      }
    }
  }

  private cleanupOldUsageRecords(): void {
    const thirtyDaysAgo = Date.now() - 2592000000;
    this.usageRecords = this.usageRecords.filter(r => r.timestamp > thirtyDaysAgo);
    this.violations = this.violations.filter(v => v.timestamp > thirtyDaysAgo);
  }

  private generateId(): string {
    return `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats(): ResourceStats {
    return {
      resources: this.resources.size,
      quotas: this.quotas.size,
      throttles: this.throttles.size,
      tenants: this.tenants.size,
      usageRecords: this.usageRecords.length,
      violations: this.violations.length,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface QuotaOptions {
  tenantId?: string;
  period?: QuotaPeriod;
  hardLimit?: boolean;
  warningThreshold?: number;
  resetBehavior?: ResetBehavior;
  description?: string;
  effectiveFrom?: number;
  effectiveUntil?: number;
}

interface UsageOptions {
  tenantId?: string;
  userId?: string;
  context?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface ThrottleOptions {
  tenantId?: string;
  burstLimit?: number;
  enabled?: boolean;
}

interface ReportOptions {
  tenantId?: string;
  startDate: number;
  endDate: number;
}

interface QuotaCheckResult {
  allowed: boolean;
  quota?: Quota;
  reason?: string;
  warning?: string;
  remaining?: number;
}

interface ThrottleCheckResult {
  allowed: boolean;
  throttle?: Throttle;
  retryAfter?: number;
}

interface ResourceStats {
  resources: number;
  quotas: number;
  throttles: number;
  tenants: number;
  usageRecords: number;
  violations: number;
}

// ============================================================================
// Export
// ============================================================================

export default ResourceManager;
