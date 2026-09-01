/**
 * Resource Management System
 * Quotas, limits, throttling, usage tracking
 * Multi-tenant resource allocation, overages, billing integration
 */
import { EventEmitter } from 'events';
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
export type ResourceType = 'compute' | 'storage' | 'network' | 'api_calls' | 'database' | 'memory' | 'bandwidth' | 'requests' | 'custom';
export type ResourceUnit = 'bytes' | 'requests' | 'calls' | 'hours' | 'seconds' | 'count' | 'percentage' | 'custom';
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
export declare class ResourceManager extends EventEmitter {
    private config;
    private resources;
    private quotas;
    private throttles;
    private tenants;
    private usageRecords;
    private violations;
    private allocations;
    constructor(config?: Partial<ResourceManagerConfig>);
    registerResource(name: string, type: ResourceType, unit: ResourceUnit, options?: Partial<Resource>): Resource;
    getResource(id: string): Resource | undefined;
    getResourceByName(name: string): Resource | undefined;
    setQuota(resourceId: string, limit: number, options?: QuotaOptions): Quota;
    checkQuota(resourceId: string, amount: number, tenantId?: string): QuotaCheckResult;
    private getQuotasForResource;
    recordUsage(resourceId: string, amount: number, options?: UsageOptions): UsageRecord;
    private recordViolation;
    setThrottle(resourceId: string, strategy: ThrottleStrategy, limit: number, window: number, options?: ThrottleOptions): Throttle;
    checkThrottle(resourceId: string, tenantId?: string): ThrottleCheckResult;
    private checkFixedWindow;
    private checkSlidingWindow;
    private checkTokenBucket;
    private checkLeakyBucket;
    createTenant(name: string, tier: TenantTier): Tenant;
    getTenant(id: string): Tenant | undefined;
    suspendTenant(tenantId: string): void;
    resumeTenant(tenantId: string): void;
    generateUsageReport(options: ReportOptions): UsageReport;
    private calculateResetTime;
    private startCleanupTimer;
    private cleanupExpiredQuotas;
    private cleanupOldUsageRecords;
    private generateId;
    getStats(): ResourceStats;
}
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
export default ResourceManager;
//# sourceMappingURL=ResourceManager.d.ts.map