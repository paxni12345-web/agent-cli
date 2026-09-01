/**
 * Advanced Caching System
 * Multi-tier caching with Redis, memory, distributed cache support
 * Cache warming, invalidation strategies, TTL management
 */
import { EventEmitter } from 'events';
export interface CacheManagerConfig {
    enableMemoryCache: boolean;
    enableRedisCache: boolean;
    enableDistributedCache: boolean;
    defaultTTL: number;
    maxMemorySize: number;
    evictionPolicy: EvictionPolicy;
    compressionThreshold: number;
    enableCompression: boolean;
}
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'lifo' | 'random' | 'ttl';
export interface CacheEntry<T = any> {
    key: string;
    value: T;
    metadata: CacheMetadata;
    compressed: boolean;
    size: number;
    tags: Set<string>;
}
export interface CacheMetadata {
    createdAt: number;
    expiresAt?: number;
    lastAccessed: number;
    accessCount: number;
    hitCount: number;
    missCount: number;
    ttl?: number;
}
export interface CacheLayer {
    name: string;
    type: CacheLayerType;
    priority: number;
    enabled: boolean;
    stats: CacheLayerStats;
}
export type CacheLayerType = 'memory' | 'redis' | 'distributed' | 'disk';
export interface CacheLayerStats {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    keys: number;
}
export interface CachePattern {
    pattern: string;
    ttl?: number;
    tags?: string[];
    warmOnStart?: boolean;
    invalidateOn?: InvalidationTrigger[];
}
export interface InvalidationTrigger {
    type: TriggerType;
    condition: string;
    action: InvalidationAction;
}
export type TriggerType = 'time' | 'event' | 'dependency' | 'manual';
export type InvalidationAction = 'delete' | 'refresh' | 'tag';
export interface CacheWarmingStrategy {
    id: string;
    name: string;
    pattern: string;
    loader: () => Promise<Map<string, any>>;
    schedule?: string;
    priority: number;
    enabled: boolean;
}
export interface CacheOperation {
    id: string;
    type: OperationType;
    key: string;
    layer: CacheLayerType;
    timestamp: number;
    duration: number;
    hit: boolean;
}
export type OperationType = 'get' | 'set' | 'delete' | 'clear' | 'warm';
export interface CacheInvalidationRule {
    id: string;
    pattern: RegExp;
    dependencies: string[];
    cascading: boolean;
    ttl?: number;
}
export declare class CacheManager extends EventEmitter {
    private config;
    private memoryCache;
    private layers;
    private patterns;
    private warmingStrategies;
    private invalidationRules;
    private operations;
    private lruList;
    private lfuMap;
    private currentMemorySize;
    constructor(config?: Partial<CacheManagerConfig>);
    get<T = any>(key: string): Promise<T | null>;
    set<T = any>(key: string, value: T, options?: SetOptions): Promise<void>;
    delete(key: string): Promise<void>;
    clear(pattern?: string): Promise<void>;
    private setInMemory;
    private evict;
    private updateEvictionStructures;
    private findLFUKey;
    private findExpiringSoonestKey;
    private getFromRedis;
    private setInRedis;
    private deleteFromRedis;
    private clearRedis;
    private getFromDistributed;
    private setInDistributed;
    private deleteFromDistributed;
    private clearDistributed;
    registerWarmingStrategy(strategy: Omit<CacheWarmingStrategy, 'id'>): CacheWarmingStrategy;
    warmCache(strategyId?: string): Promise<void>;
    registerInvalidationRule(rule: Omit<CacheInvalidationRule, 'id'>): CacheInvalidationRule;
    invalidate(key: string, cascading?: boolean): Promise<void>;
    invalidateByTag(tag: string): Promise<void>;
    invalidateByPattern(pattern: string): Promise<void>;
    registerPattern(pattern: CachePattern): void;
    getPatternForKey(key: string): CachePattern | undefined;
    private shouldCompress;
    private compress;
    private decompress;
    private initializeLayers;
    private isExpired;
    private updateAccessMetadata;
    /**
     * Records a cache operation for monitoring and statistics.
     * Maintains a bounded list of recent operations.
     * @param type - Type of operation (get, set, delete, etc.)
     * @param key - Cache key
     * @param layer - Cache layer (memory, redis, distributed)
     * @param duration - Operation duration in milliseconds
     * @param hit - Whether the operation was a cache hit
     */
    private recordOperation;
    private calculateSize;
    private startCleanupTimer;
    private cleanupExpired;
    private generateId;
    getMany<T = any>(keys: string[]): Promise<Map<string, T>>;
    setMany<T = any>(entries: Map<string, T>, options?: SetOptions): Promise<void>;
    deleteMany(keys: string[]): Promise<void>;
    getStats(): CacheStats;
    getLayerStats(type: CacheLayerType): CacheLayerStats | undefined;
    getRecentOperations(count?: number): CacheOperation[];
    getOrSet<T>(key: string, loader: () => Promise<T>, options?: SetOptions): Promise<T>;
    memoize<T>(fn: (...args: any[]) => Promise<T>, keyGenerator: (...args: any[]) => string, options?: SetOptions): Promise<(...args: any[]) => Promise<T>>;
    touch(key: string, ttl?: number): Promise<void>;
    exists(key: string): Promise<boolean>;
    ttl(key: string): Promise<number | null>;
    keys(pattern?: string): Promise<string[]>;
}
interface SetOptions {
    ttl?: number;
    tags?: string[];
    layer?: CacheLayerType;
}
interface CacheStats {
    layers: Array<{
        name: string;
        type: CacheLayerType;
        enabled: boolean;
        hits: number;
        misses: number;
        evictions: number;
        size: number;
        keys: number;
        hitRate: number;
    }>;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    memoryUsage: number;
    memoryLimit: number;
    memoryUsagePercent: number;
    totalKeys: number;
    warmingStrategies: number;
    invalidationRules: number;
    recentOperations: CacheOperation[];
}
export default CacheManager;
//# sourceMappingURL=CacheManager.d.ts.map