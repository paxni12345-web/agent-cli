/**
 * Performance Optimization System - Profiling, caching, and optimization
 * Memory management, CPU profiling, and performance monitoring
 */
export interface PerformanceMetric {
    name: string;
    value: number;
    unit: string;
    timestamp: Date;
    tags?: Record<string, string>;
}
export interface ProfileResult {
    name: string;
    duration: number;
    memory: {
        used: number;
        total: number;
        delta: number;
    };
    cpu: {
        user: number;
        system: number;
    };
    operations: number;
    opsPerSecond: number;
}
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
}
/**
 * Performance Profiler
 */
export declare class PerformanceProfiler {
    private profiles;
    private activeProfiles;
    /**
     * Start profiling
     */
    start(name: string): void;
    /**
     * Increment operation count
     */
    incrementOps(name: string): void;
    /**
     * Stop profiling and get results
     */
    stop(name: string): ProfileResult | undefined;
    /**
     * Get profile result
     */
    getProfile(name: string): ProfileResult | undefined;
    /**
     * Get all profiles
     */
    getAllProfiles(): ProfileResult[];
    /**
     * Clear all profiles
     */
    clear(): void;
    /**
     * Generate performance report
     */
    generateReport(): string;
    private formatBytes;
}
/**
 * LRU Cache with TTL support
 */
export declare class LRUCache<K, V> {
    private cache;
    private maxSize;
    private ttl;
    private hits;
    private misses;
    private evictions;
    constructor(maxSize?: number, ttl?: number);
    /**
     * Get value from cache
     */
    get(key: K): V | undefined;
    /**
     * Set value in cache
     */
    set(key: K, value: V): void;
    /**
     * Check if key exists
     */
    has(key: K): boolean;
    /**
     * Delete key
     */
    delete(key: K): boolean;
    /**
     * Clear cache
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get cache size
     */
    size(): number;
}
/**
 * Memory Pool for object reuse
 */
export declare class ObjectPool<T> {
    private pool;
    private factory;
    private reset;
    private maxSize;
    private created;
    private reused;
    private destroyed;
    constructor(factory: () => T, reset: (obj: T) => void, maxSize?: number);
    /**
     * Acquire object from pool
     */
    acquire(): T;
    /**
     * Release object back to pool
     */
    release(obj: T): void;
    /**
     * Get pool statistics
     */
    getStats(): {
        poolSize: number;
        created: number;
        reused: number;
        destroyed: number;
        reuseRate: number;
    };
    /**
     * Clear pool
     */
    clear(): void;
}
/**
 * Batch Processor for efficient bulk operations
 */
export declare class BatchProcessor<T, R> {
    private queue;
    private processor;
    private batchSize;
    private flushInterval;
    private timer?;
    private processedCount;
    private batchCount;
    constructor(processor: (items: T[]) => Promise<R[]>, batchSize?: number, flushInterval?: number);
    /**
     * Add item to queue
     */
    add(item: T): Promise<R>;
    /**
     * Process current batch
     */
    flush(): Promise<void>;
    /**
     * Get processor statistics
     */
    getStats(): {
        queueSize: number;
        processedCount: number;
        batchCount: number;
        avgBatchSize: number;
    };
}
/**
 * Debouncer for rate limiting function calls
 */
export declare class Debouncer {
    private timers;
    /**
     * Debounce a function call
     */
    debounce(key: string, fn: () => void, delay: number): void;
    /**
     * Cancel all pending calls
     */
    cancelAll(): void;
    /**
     * Cancel specific key
     */
    cancel(key: string): void;
}
/**
 * Throttler for rate limiting
 */
export declare class Throttler {
    private lastCalls;
    /**
     * Throttle a function call
     */
    throttle(key: string, fn: () => void, interval: number): void;
    /**
     * Check if call is allowed
     */
    isAllowed(key: string, interval: number): boolean;
    /**
     * Reset throttle state
     */
    reset(key?: string): void;
}
/**
 * Memoization decorator
 */
export declare class Memoizer {
    private cache;
    /**
     * Memoize a function
     */
    memoize<T extends (...args: any[]) => any>(fn: T): T;
    /**
     * Clear memoization cache
     */
    clear(): void;
    /**
     * Get cache stats
     */
    getStats(): CacheStats;
}
/**
 * Performance Optimizer
 */
export declare class PerformanceOptimizer {
    private profiler;
    private recommendations;
    /**
     * Analyze performance and generate recommendations
     */
    analyze(profiles: ProfileResult[]): string[];
    /**
     * Get recommendations
     */
    getRecommendations(): string[];
}
/**
 * Singleton instances
 */
export declare const performanceProfiler: PerformanceProfiler;
export declare const memoizer: Memoizer;
export declare const debouncer: Debouncer;
export declare const throttler: Throttler;
export declare const performanceOptimizer: PerformanceOptimizer;
//# sourceMappingURL=Optimization.d.ts.map