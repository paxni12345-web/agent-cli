"use strict";
/**
 * Resource Management System
 * Quotas, limits, throttling, usage tracking
 * Multi-tenant resource allocation, overages, billing integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceManager = void 0;
const events_1 = require("events");
// ============================================================================
// Resource Manager
// ============================================================================
class ResourceManager extends events_1.EventEmitter {
    config;
    resources = new Map();
    quotas = new Map();
    throttles = new Map();
    tenants = new Map();
    usageRecords = [];
    violations = [];
    allocations = new Map();
    constructor(config = {}) {
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
    registerResource(name, type, unit, options = {}) {
        const resource = {
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
    getResource(id) {
        return this.resources.get(id);
    }
    getResourceByName(name) {
        return Array.from(this.resources.values()).find(r => r.name === name);
    }
    // ========================================================================
    // Quota Management
    // ========================================================================
    setQuota(resourceId, limit, options = {}) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            throw new Error(`Resource not found: ${resourceId}`);
        }
        const quota = {
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
    checkQuota(resourceId, amount, tenantId) {
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
                }
                else {
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
    getQuotasForResource(resourceId, tenantId) {
        return Array.from(this.quotas.values()).filter(q => q.resourceId === resourceId && (!tenantId || q.tenantId === tenantId));
    }
    // ========================================================================
    // Usage Tracking
    // ========================================================================
    recordUsage(resourceId, amount, options = {}) {
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
        let cost;
        if (resource.metadata.billable && resource.metadata.costPerUnit) {
            cost = amount * resource.metadata.costPerUnit;
        }
        const record = {
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
    recordViolation(resourceId, attempted, tenantId) {
        const quotas = this.getQuotasForResource(resourceId, tenantId);
        if (quotas.length === 0)
            return;
        const quota = quotas[0];
        const violation = {
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
    setThrottle(resourceId, strategy, limit, window, options = {}) {
        if (!this.config.enableThrottling) {
            throw new Error('Throttling is not enabled');
        }
        const throttle = {
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
    checkThrottle(resourceId, tenantId) {
        const throttles = Array.from(this.throttles.values()).filter(t => t.resourceId === resourceId && t.enabled && (!tenantId || t.tenantId === tenantId));
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
    checkFixedWindow(throttle, now) {
        const windowStart = Math.floor(now / throttle.window) * throttle.window;
        const recentRequests = throttle.state.requests.filter(t => t >= windowStart);
        if (recentRequests.length >= throttle.limit) {
            return false;
        }
        throttle.state.requests = [...recentRequests, now];
        return true;
    }
    checkSlidingWindow(throttle, now) {
        const cutoff = now - throttle.window;
        const recentRequests = throttle.state.requests.filter(t => t > cutoff);
        if (recentRequests.length >= throttle.limit) {
            return false;
        }
        throttle.state.requests = [...recentRequests, now];
        return true;
    }
    checkTokenBucket(throttle, now) {
        // Refill tokens
        const elapsed = now - throttle.state.lastRefill;
        const refillAmount = (elapsed / throttle.window) * throttle.limit;
        throttle.state.tokens = Math.min(throttle.burstLimit || throttle.limit, throttle.state.tokens + refillAmount);
        throttle.state.lastRefill = now;
        if (throttle.state.tokens < 1) {
            return false;
        }
        throttle.state.tokens--;
        return true;
    }
    checkLeakyBucket(throttle, now) {
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
    createTenant(name, tier) {
        if (!this.config.enableMultiTenant) {
            throw new Error('Multi-tenant is not enabled');
        }
        const tenant = {
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
    getTenant(id) {
        return this.tenants.get(id);
    }
    suspendTenant(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            tenant.metadata.suspended = true;
            this.emit('tenant:suspended', { tenant });
        }
    }
    resumeTenant(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            tenant.metadata.suspended = false;
            this.emit('tenant:resumed', { tenant });
        }
    }
    // ========================================================================
    // Reporting
    // ========================================================================
    generateUsageReport(options) {
        const { tenantId, startDate, endDate } = options;
        const filteredRecords = this.usageRecords.filter(r => r.timestamp >= startDate &&
            r.timestamp <= endDate &&
            (!tenantId || r.tenantId === tenantId));
        const resourceStats = new Map();
        for (const record of filteredRecords) {
            const resource = this.resources.get(record.resourceId);
            if (!resource)
                continue;
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
            const resourceRecords = filteredRecords.filter(r => r.resourceId === stats.resourceId);
            stats.averageUsage = stats.totalUsage / resourceRecords.length;
            const quotas = this.getQuotasForResource(stats.resourceId, tenantId);
            if (quotas.length > 0) {
                stats.quotaLimit = quotas[0].limit;
                stats.utilizationPercentage = (stats.totalUsage / quotas[0].limit) * 100;
            }
        }
        const totalCost = Array.from(resourceStats.values()).reduce((sum, stats) => sum + (stats.cost || 0), 0);
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
    calculateResetTime(period) {
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
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredQuotas();
            this.cleanupOldUsageRecords();
        }, 3600000); // Every hour
    }
    cleanupExpiredQuotas() {
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
    cleanupOldUsageRecords() {
        const thirtyDaysAgo = Date.now() - 2592000000;
        this.usageRecords = this.usageRecords.filter(r => r.timestamp > thirtyDaysAgo);
        this.violations = this.violations.filter(v => v.timestamp > thirtyDaysAgo);
    }
    generateId() {
        return `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getStats() {
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
exports.ResourceManager = ResourceManager;
// ============================================================================
// Export
// ============================================================================
exports.default = ResourceManager;
