/**
 * DistributedCache - Multi-tier distributed caching system
 * Redis, Memcached support with intelligent cache strategies
 */
import { EventEmitter } from 'events';
export interface CacheConfig {
    type: 'memory' | 'redis' | 'memcached' | 'hybrid';
    ttl: number;
    maxSize: number;
    evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
    compressionEnabled: boolean;
    serializationFormat: 'json' | 'msgpack' | 'protobuf';
}
export interface CacheEntry {
    key: string;
    value: any;
    size: number;
    ttl: number;
    createdAt: Date;
    accessedAt: Date;
    accessCount: number;
    compressed: boolean;
}
export interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    evictions: number;
    hitRate: number;
    avgLatency: number;
    totalSize: number;
    entryCount: number;
}
export interface CacheLayer {
    name: string;
    type: string;
    capacity: number;
    currentSize: number;
    stats: CacheStats;
}
export interface WarmupTask {
    id: string;
    keys: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    startTime?: Date;
    endTime?: Date;
}
export declare class DistributedCache extends EventEmitter {
    private config;
    private cache;
    private stats;
    private layers;
    private warmupTasks;
    constructor(config?: Partial<CacheConfig>);
    private initializeLayers;
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    mget(keys: string[]): Promise<Map<string, any>>;
    mset(entries: Map<string, any>, ttl?: number): Promise<void>;
    clear(): Promise<void>;
    evict(requiredSize: number): Promise<void>;
    warmup(keys: string[], loader: (key: string) => Promise<any>): Promise<string>;
    invalidate(pattern: string): Promise<number>;
    refresh(key: string, loader: (key: string) => Promise<any>): Promise<void>;
    private isExpired;
    private serialize;
    private compress;
    private decompress;
    private getSize;
    private updateHitRate;
    private updateAvgLatency;
    getStats(): CacheStats;
    getLayer(name: string): CacheLayer | null;
    listLayers(): CacheLayer[];
    getWarmupTask(taskId: string): WarmupTask | null;
    keys(pattern?: string): Promise<string[]>;
    size(): Promise<number>;
    reset(): Promise<void>;
}
export declare class CacheCluster extends EventEmitter {
    private nodes;
    private hashRing;
    constructor(nodeCount?: number);
    private initializeNodes;
    private hash;
    private getNode;
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    getClusterStats(): any;
}
export default DistributedCache;
//# sourceMappingURL=DistributedCache.d.ts.map