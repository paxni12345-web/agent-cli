/**
 * MEGA PHASE 21: ADVANCED CACHING & REDIS CLUSTER
 * Multi-tier caching, Redis cluster, Cache strategies, Invalidation
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface CacheConfig {
    type: CacheType;
    ttl: number;
    maxSize: number;
    strategy: CacheStrategy;
    evictionPolicy: EvictionPolicy;
    compression: boolean;
    serialization: SerializationType;
}
export type CacheType = 'memory' | 'redis' | 'memcached' | 'hybrid';
export type CacheStrategy = 'cache_aside' | 'write_through' | 'write_back' | 'read_through';
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';
export type SerializationType = 'json' | 'msgpack' | 'protobuf';
export interface CacheEntry<T> {
    key: string;
    value: T;
    ttl: number;
    createdAt: Date;
    expiresAt: Date;
    accessCount: number;
    lastAccessed: Date;
    size: number;
    tags: string[];
}
export interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    evictions: number;
    size: number;
    memory: number;
    hitRate: number;
}
export interface CacheQuery {
    pattern?: string;
    tags?: string[];
    minTTL?: number;
    maxSize?: number;
}
export declare class CacheManager<T = any> extends EventEmitter {
    private config;
    private cache;
    private accessOrder;
    private stats;
    constructor(config?: Partial<CacheConfig>);
    get(key: string): Promise<T | null>;
    set(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;
    invalidate(query: CacheQuery): Promise<number>;
    private matchesQuery;
    private matchPattern;
    private evict;
    private evictLRU;
    private evictLFU;
    private evictFIFO;
    private evictTTL;
    private isExpired;
    private updateAccessOrder;
    private calculateSize;
    private updateHitRate;
    private startEvictionMonitor;
    private cleanExpired;
    getStats(): CacheStats;
}
export interface RedisClusterConfig {
    nodes: RedisNode[];
    maxRedirects: number;
    retryDelayOnFailover: number;
    retryDelayOnClusterDown: number;
    scaleReads: ScaleReadsMode;
    enableReadyCheck: boolean;
}
export interface RedisNode {
    host: string;
    port: number;
    password?: string;
}
export type ScaleReadsMode = 'master' | 'slave' | 'all';
export interface ClusterSlot {
    start: number;
    end: number;
    master: RedisNode;
    slaves: RedisNode[];
}
export interface RedisCommand {
    command: string;
    args: any[];
    slot?: number;
}
export declare class RedisClusterClient extends EventEmitter {
    private config;
    private slots;
    private connections;
    private ready;
    constructor(config?: Partial<RedisClusterConfig>);
    connect(): Promise<void>;
    private discoverTopology;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: SetOptions): Promise<string>;
    delete(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    hset(key: string, field: string, value: string): Promise<number>;
    hget(key: string, field: string): Promise<string | null>;
    hgetall(key: string): Promise<Record<string, string>>;
    lpush(key: string, ...values: string[]): Promise<number>;
    rpush(key: string, ...values: string[]): Promise<number>;
    lpop(key: string): Promise<string | null>;
    rpop(key: string): Promise<string | null>;
    sadd(key: string, ...members: string[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    zadd(key: string, score: number, member: string): Promise<number>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    private execute;
    private selectNode;
    private mockResponse;
    private calculateSlot;
    private crc16;
    private sleep;
    disconnect(): Promise<void>;
    getStats(): {
        ready: boolean;
        nodes: number;
        slots: number;
        connections: number;
    };
}
export interface SetOptions {
    ex?: number;
    px?: number;
    nx?: boolean;
    xx?: boolean;
}
export interface RedisConnection {
    node: RedisNode;
    connected: boolean;
    lastActivity: Date;
}
export interface InvalidationConfig {
    strategy: InvalidationStrategy;
    batchSize: number;
    interval: number;
}
export type InvalidationStrategy = 'ttl' | 'event' | 'manual' | 'hybrid';
export interface InvalidationEvent {
    type: InvalidationType;
    keys?: string[];
    patterns?: string[];
    tags?: string[];
    timestamp: Date;
}
export type InvalidationType = 'create' | 'update' | 'delete' | 'expire';
export declare class CacheInvalidator extends EventEmitter {
    private config;
    private pendingInvalidations;
    constructor(config?: Partial<InvalidationConfig>);
    invalidate(event: Omit<InvalidationEvent, 'timestamp'>): Promise<void>;
    private startInvalidationProcessor;
    private processInvalidations;
    private processEvent;
    private invalidateByEvent;
    getStats(): {
        pending: number;
    };
}
export declare class CompleteCachingSystem {
    memory: CacheManager;
    redis: RedisClusterClient;
    invalidator: CacheInvalidator;
    constructor();
    getOverallStats(): {
        memory: CacheStats;
        redis: {
            ready: boolean;
            nodes: number;
            slots: number;
            connections: number;
        };
        invalidator: {
            pending: number;
        };
    };
}
//# sourceMappingURL=MEGA_AdvancedCaching.d.ts.map