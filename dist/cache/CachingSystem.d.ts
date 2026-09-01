/**
 * Advanced Caching System
 * Multi-tier caching, cache invalidation, distributed cache, and cache warming
 */
export interface CacheEntry<T = any> {
    key: string;
    value: T;
    ttl?: number;
    createdAt: Date;
    expiresAt?: Date;
    hits: number;
    size: number;
    tags: string[];
    metadata: Record<string, any>;
}
export interface CacheConfig {
    maxSize: number;
    maxEntries: number;
    defaultTTL: number;
    evictionPolicy: EvictionPolicy;
    compression: boolean;
    persistToDisk: boolean;
}
export declare enum EvictionPolicy {
    LRU = "lru",
    LFU = "lfu",
    FIFO = "fifo",
    TTL = "ttl"
}
export interface CacheStatistics {
    hits: number;
    misses: number;
    hitRate: number;
    entries: number;
    size: number;
    evictions: number;
}
export interface CacheTier {
    name: string;
    level: number;
    cache: Map<string, CacheEntry>;
    config: CacheConfig;
    statistics: CacheStatistics;
}
export interface InvalidationRule {
    id: string;
    pattern: string;
    tags?: string[];
    condition?: (entry: CacheEntry) => boolean;
    createdAt: Date;
}
export interface CacheWarmer {
    id: string;
    name: string;
    keys: string[];
    loader: (key: string) => Promise<any>;
    schedule?: string;
    enabled: boolean;
    lastRun?: Date;
}
export interface DistributedCacheNode {
    id: string;
    host: string;
    port: number;
    status: NodeStatus;
    load: number;
    keys: Set<string>;
    lastHeartbeat: Date;
}
export declare enum NodeStatus {
    Active = "active",
    Syncing = "syncing",
    Failed = "failed"
}
export interface CacheOperation {
    id: string;
    type: OperationType;
    key: string;
    status: OperationStatus;
    duration?: number;
    timestamp: Date;
}
export declare enum OperationType {
    Get = "get",
    Set = "set",
    Delete = "delete",
    Clear = "clear",
    Invalidate = "invalidate"
}
export declare enum OperationStatus {
    Success = "success",
    Miss = "miss",
    Error = "error"
}
export interface CachePattern {
    pattern: string;
    ttl?: number;
    tags?: string[];
}
export interface CacheQuery {
    tags?: string[];
    pattern?: string;
    minHits?: number;
    maxAge?: number;
}
/**
 * Cache Manager
 */
export declare class CacheManager {
    private cache;
    private config;
    private statistics;
    private accessOrder;
    private operations;
    constructor(config?: Partial<CacheConfig>);
    /**
     * Get value from cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set value in cache
     */
    set<T>(key: string, value: T, options?: {
        ttl?: number;
        tags?: string[];
    }): Promise<void>;
    /**
     * Delete from cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Clear cache
     */
    clear(): Promise<void>;
    /**
     * Check if key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Get multiple keys
     */
    getMany<T>(keys: string[]): Promise<Map<string, T>>;
    /**
     * Set multiple keys
     */
    setMany<T>(entries: Map<string, T>, options?: {
        ttl?: number;
        tags?: string[];
    }): Promise<void>;
    /**
     * Query cache entries
     */
    query(query: CacheQuery): CacheEntry[];
    /**
     * Invalidate by tags
     */
    invalidateByTags(tags: string[]): Promise<number>;
    /**
     * Invalidate by pattern
     */
    invalidateByPattern(pattern: string): Promise<number>;
    /**
     * Get statistics
     */
    getStatistics(): CacheStatistics;
    /**
     * Get entry metadata
     */
    getEntry(key: string): CacheEntry | undefined;
    /**
     * List all keys
     */
    keys(): string[];
    private shouldEvict;
    private evict;
    private findLFUKey;
    private findOldestKey;
    private findExpiredKey;
    private updateAccessOrder;
    private removeFromAccessOrder;
    private calculateSize;
    private updateHitRate;
    private recordOperation;
    private generateOperationId;
}
/**
 * Multi-Tier Cache Manager
 */
export declare class MultiTierCacheManager {
    private tiers;
    /**
     * Add tier
     */
    addTier(name: string, config?: Partial<CacheConfig>): CacheTier;
    /**
     * Get from cache (checks all tiers)
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set in cache (writes to all tiers)
     */
    set<T>(key: string, value: T, options?: {
        ttl?: number;
        tags?: string[];
    }): Promise<void>;
    /**
     * Delete from all tiers
     */
    delete(key: string): Promise<void>;
    /**
     * Get tier
     */
    getTier(name: string): CacheTier | undefined;
    /**
     * List tiers
     */
    listTiers(): CacheTier[];
    /**
     * Get statistics for all tiers
     */
    getStatistics(): Record<string, CacheStatistics>;
    private promote;
}
/**
 * Cache Warmer
 */
export declare class CacheWarmerManager {
    private warmers;
    private cacheManager;
    constructor(cacheManager: CacheManager);
    /**
     * Register warmer
     */
    registerWarmer(warmer: Omit<CacheWarmer, 'id'>): CacheWarmer;
    /**
     * Run warmer
     */
    runWarmer(warmerId: string): Promise<number>;
    /**
     * Run all warmers
     */
    runAllWarmers(): Promise<number>;
    /**
     * Get warmer
     */
    getWarmer(warmerId: string): CacheWarmer | undefined;
    /**
     * List warmers
     */
    listWarmers(): CacheWarmer[];
    private generateWarmerId;
}
/**
 * Distributed Cache Manager
 */
export declare class DistributedCacheManager {
    private nodes;
    private localCache;
    constructor(localCache: CacheManager);
    /**
     * Add node
     */
    addNode(node: Omit<DistributedCacheNode, 'id' | 'status' | 'load' | 'keys' | 'lastHeartbeat'>): DistributedCacheNode;
    /**
     * Get from distributed cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set in distributed cache
     */
    set<T>(key: string, value: T, options?: {
        ttl?: number;
        tags?: string[];
    }): Promise<void>;
    /**
     * Delete from distributed cache
     */
    delete(key: string): Promise<void>;
    /**
     * Get node
     */
    getNode(nodeId: string): DistributedCacheNode | undefined;
    /**
     * List nodes
     */
    listNodes(): DistributedCacheNode[];
    /**
     * Remove node
     */
    removeNode(nodeId: string): void;
    private selectNode;
    private findNodeWithKey;
    private fetchFromNode;
    private hashKey;
    private generateNodeId;
}
/**
 * Singleton instances
 */
export declare const cacheManager: CacheManager;
export declare const multiTierCacheManager: MultiTierCacheManager;
export declare const cacheWarmerManager: CacheWarmerManager;
export declare const distributedCacheManager: DistributedCacheManager;
//# sourceMappingURL=CachingSystem.d.ts.map