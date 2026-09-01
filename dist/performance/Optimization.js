"use strict";
/**
 * Performance Optimization System - Profiling, caching, and optimization
 * Memory management, CPU profiling, and performance monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceOptimizer = exports.throttler = exports.debouncer = exports.memoizer = exports.performanceProfiler = exports.PerformanceOptimizer = exports.Memoizer = exports.Throttler = exports.Debouncer = exports.BatchProcessor = exports.ObjectPool = exports.LRUCache = exports.PerformanceProfiler = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Performance Profiler
 */
class PerformanceProfiler {
    profiles = new Map();
    activeProfiles = new Map();
    /**
     * Start profiling
     */
    start(name) {
        const memUsage = process.memoryUsage();
        this.activeProfiles.set(name, {
            startTime: Date.now(),
            startMemory: memUsage.heapUsed,
            operations: 0,
        });
    }
    /**
     * Increment operation count
     */
    incrementOps(name) {
        const profile = this.activeProfiles.get(name);
        if (profile) {
            profile.operations++;
        }
    }
    /**
     * Stop profiling and get results
     */
    stop(name) {
        const profile = this.activeProfiles.get(name);
        if (!profile)
            return undefined;
        const duration = Date.now() - profile.startTime;
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const result = {
            name,
            duration,
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                delta: memUsage.heapUsed - profile.startMemory,
            },
            cpu: {
                user: cpuUsage.user / 1000,
                system: cpuUsage.system / 1000,
            },
            operations: profile.operations,
            opsPerSecond: profile.operations / (duration / 1000),
        };
        this.profiles.set(name, result);
        this.activeProfiles.delete(name);
        EventBus_1.eventBus.emitSync('performance.profile_completed', result, 'PerformanceProfiler');
        return result;
    }
    /**
     * Get profile result
     */
    getProfile(name) {
        return this.profiles.get(name);
    }
    /**
     * Get all profiles
     */
    getAllProfiles() {
        return Array.from(this.profiles.values());
    }
    /**
     * Clear all profiles
     */
    clear() {
        this.profiles.clear();
        this.activeProfiles.clear();
    }
    /**
     * Generate performance report
     */
    generateReport() {
        let report = 'Performance Profile Report\n\n';
        const profiles = Array.from(this.profiles.values());
        if (profiles.length === 0) {
            return report + 'No profiles recorded';
        }
        report += 'Name                | Duration | Memory Δ | Ops/sec\n';
        report += '--------------------|----------|----------|----------\n';
        for (const profile of profiles) {
            const name = profile.name.padEnd(19);
            const duration = `${profile.duration}ms`.padEnd(8);
            const memDelta = this.formatBytes(profile.memory.delta).padEnd(8);
            const opsPerSec = profile.opsPerSecond.toFixed(0).padEnd(8);
            report += `${name} | ${duration} | ${memDelta} | ${opsPerSec}\n`;
        }
        return report;
    }
    formatBytes(bytes) {
        if (bytes < 1024)
            return `${bytes}B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
}
exports.PerformanceProfiler = PerformanceProfiler;
/**
 * LRU Cache with TTL support
 */
class LRUCache {
    cache = new Map();
    maxSize;
    ttl;
    hits = 0;
    misses = 0;
    evictions = 0;
    constructor(maxSize = 1000, ttl = 60000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }
    /**
     * Get value from cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        // Check TTL
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }
        // Move to end (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.hits++;
        return entry.value;
    }
    /**
     * Set value in cache
     */
    set(key, value) {
        // Remove if exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.evictions++;
        }
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
        });
    }
    /**
     * Check if key exists
     */
    has(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Delete key
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear cache
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits / (this.hits + this.misses) || 0,
            size: this.cache.size,
            maxSize: this.maxSize,
            evictions: this.evictions,
        };
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
}
exports.LRUCache = LRUCache;
/**
 * Memory Pool for object reuse
 */
class ObjectPool {
    pool = [];
    factory;
    reset;
    maxSize;
    created = 0;
    reused = 0;
    destroyed = 0;
    constructor(factory, reset, maxSize = 100) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize;
    }
    /**
     * Acquire object from pool
     */
    acquire() {
        if (this.pool.length > 0) {
            const obj = this.pool.pop();
            this.reused++;
            return obj;
        }
        this.created++;
        return this.factory();
    }
    /**
     * Release object back to pool
     */
    release(obj) {
        if (this.pool.length < this.maxSize) {
            this.reset(obj);
            this.pool.push(obj);
        }
        else {
            this.destroyed++;
        }
    }
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            poolSize: this.pool.length,
            created: this.created,
            reused: this.reused,
            destroyed: this.destroyed,
            reuseRate: this.reused / (this.created + this.reused) || 0,
        };
    }
    /**
     * Clear pool
     */
    clear() {
        this.pool = [];
    }
}
exports.ObjectPool = ObjectPool;
/**
 * Batch Processor for efficient bulk operations
 */
class BatchProcessor {
    queue = [];
    processor;
    batchSize;
    flushInterval;
    timer;
    processedCount = 0;
    batchCount = 0;
    constructor(processor, batchSize = 100, flushInterval = 1000) {
        this.processor = processor;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
    }
    /**
     * Add item to queue
     */
    add(item) {
        return new Promise((resolve, reject) => {
            this.queue.push(item);
            if (this.queue.length >= this.batchSize) {
                this.flush().catch(reject);
            }
            else if (!this.timer) {
                this.timer = setTimeout(() => {
                    this.flush().catch(reject);
                }, this.flushInterval);
            }
        });
    }
    /**
     * Process current batch
     */
    async flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        if (this.queue.length === 0)
            return;
        const batch = this.queue.splice(0, this.batchSize);
        try {
            await this.processor(batch);
            this.processedCount += batch.length;
            this.batchCount++;
        }
        catch (error) {
            console.error('Batch processing error:', error);
        }
    }
    /**
     * Get processor statistics
     */
    getStats() {
        return {
            queueSize: this.queue.length,
            processedCount: this.processedCount,
            batchCount: this.batchCount,
            avgBatchSize: this.processedCount / this.batchCount || 0,
        };
    }
}
exports.BatchProcessor = BatchProcessor;
/**
 * Debouncer for rate limiting function calls
 */
class Debouncer {
    timers = new Map();
    /**
     * Debounce a function call
     */
    debounce(key, fn, delay) {
        const existing = this.timers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        const timer = setTimeout(() => {
            fn();
            this.timers.delete(key);
        }, delay);
        this.timers.set(key, timer);
    }
    /**
     * Cancel all pending calls
     */
    cancelAll() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
    /**
     * Cancel specific key
     */
    cancel(key) {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }
    }
}
exports.Debouncer = Debouncer;
/**
 * Throttler for rate limiting
 */
class Throttler {
    lastCalls = new Map();
    /**
     * Throttle a function call
     */
    throttle(key, fn, interval) {
        const lastCall = this.lastCalls.get(key);
        const now = Date.now();
        if (!lastCall || now - lastCall >= interval) {
            fn();
            this.lastCalls.set(key, now);
        }
    }
    /**
     * Check if call is allowed
     */
    isAllowed(key, interval) {
        const lastCall = this.lastCalls.get(key);
        const now = Date.now();
        return !lastCall || now - lastCall >= interval;
    }
    /**
     * Reset throttle state
     */
    reset(key) {
        if (key) {
            this.lastCalls.delete(key);
        }
        else {
            this.lastCalls.clear();
        }
    }
}
exports.Throttler = Throttler;
/**
 * Memoization decorator
 */
class Memoizer {
    cache = new LRUCache(1000, 300000); // 5 min TTL
    /**
     * Memoize a function
     */
    memoize(fn) {
        return ((...args) => {
            const key = JSON.stringify(args);
            const cached = this.cache.get(key);
            if (cached !== undefined) {
                return cached;
            }
            const result = fn(...args);
            this.cache.set(key, result);
            return result;
        });
    }
    /**
     * Clear memoization cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache stats
     */
    getStats() {
        return this.cache.getStats();
    }
}
exports.Memoizer = Memoizer;
/**
 * Performance Optimizer
 */
class PerformanceOptimizer {
    profiler = new PerformanceProfiler();
    recommendations = [];
    /**
     * Analyze performance and generate recommendations
     */
    analyze(profiles) {
        this.recommendations = [];
        for (const profile of profiles) {
            // Check execution time
            if (profile.duration > 1000) {
                this.recommendations.push(`${profile.name}: High execution time (${profile.duration}ms). Consider optimization or caching.`);
            }
            // Check memory usage
            if (profile.memory.delta > 10 * 1024 * 1024) {
                this.recommendations.push(`${profile.name}: High memory allocation (${(profile.memory.delta / (1024 * 1024)).toFixed(1)}MB). Check for memory leaks.`);
            }
            // Check operations per second
            if (profile.operations > 0 && profile.opsPerSecond < 100) {
                this.recommendations.push(`${profile.name}: Low throughput (${profile.opsPerSecond.toFixed(0)} ops/sec). Consider batching or parallelization.`);
            }
        }
        return this.recommendations;
    }
    /**
     * Get recommendations
     */
    getRecommendations() {
        return this.recommendations;
    }
}
exports.PerformanceOptimizer = PerformanceOptimizer;
/**
 * Singleton instances
 */
exports.performanceProfiler = new PerformanceProfiler();
exports.memoizer = new Memoizer();
exports.debouncer = new Debouncer();
exports.throttler = new Throttler();
exports.performanceOptimizer = new PerformanceOptimizer();
