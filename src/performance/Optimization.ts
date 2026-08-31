/**
 * Performance Optimization System - Profiling, caching, and optimization
 * Memory management, CPU profiling, and performance monitoring
 */

import { eventBus } from '../core/EventBus';

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
export class PerformanceProfiler {
  private profiles: Map<string, ProfileResult> = new Map();
  private activeProfiles: Map<string, {
    startTime: number;
    startMemory: number;
    operations: number;
  }> = new Map();

  /**
   * Start profiling
   */
  start(name: string): void {
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
  incrementOps(name: string): void {
    const profile = this.activeProfiles.get(name);
    if (profile) {
      profile.operations++;
    }
  }

  /**
   * Stop profiling and get results
   */
  stop(name: string): ProfileResult | undefined {
    const profile = this.activeProfiles.get(name);
    if (!profile) return undefined;

    const duration = Date.now() - profile.startTime;
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const result: ProfileResult = {
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

    eventBus.emitSync('performance.profile_completed', result, 'PerformanceProfiler');

    return result;
  }

  /**
   * Get profile result
   */
  getProfile(name: string): ProfileResult | undefined {
    return this.profiles.get(name);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): ProfileResult[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
    this.activeProfiles.clear();
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
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

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

/**
 * LRU Cache with TTL support
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxSize = 1000, ttl = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
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
  set(key: K, value: V): void {
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
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete key
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
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
  size(): number {
    return this.cache.size;
  }
}

/**
 * Memory Pool for object reuse
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  private created = 0;
  private reused = 0;
  private destroyed = 0;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    maxSize = 100
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  /**
   * Acquire object from pool
   */
  acquire(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      this.reused++;
      return obj;
    }

    this.created++;
    return this.factory();
  }

  /**
   * Release object back to pool
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    } else {
      this.destroyed++;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number;
    created: number;
    reused: number;
    destroyed: number;
    reuseRate: number;
  } {
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
  clear(): void {
    this.pool = [];
  }
}

/**
 * Batch Processor for efficient bulk operations
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private processor: (items: T[]) => Promise<R[]>;
  private batchSize: number;
  private flushInterval: number;
  private timer?: NodeJS.Timeout;

  private processedCount = 0;
  private batchCount = 0;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    batchSize = 100,
    flushInterval = 1000
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
  }

  /**
   * Add item to queue
   */
  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push(item);

      if (this.queue.length >= this.batchSize) {
        this.flush().catch(reject);
      } else if (!this.timer) {
        this.timer = setTimeout(() => {
          this.flush().catch(reject);
        }, this.flushInterval);
      }
    });
  }

  /**
   * Process current batch
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.processor(batch);
      this.processedCount += batch.length;
      this.batchCount++;
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    queueSize: number;
    processedCount: number;
    batchCount: number;
    avgBatchSize: number;
  } {
    return {
      queueSize: this.queue.length,
      processedCount: this.processedCount,
      batchCount: this.batchCount,
      avgBatchSize: this.processedCount / this.batchCount || 0,
    };
  }
}

/**
 * Debouncer for rate limiting function calls
 */
export class Debouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Debounce a function call
   */
  debounce(key: string, fn: () => void, delay: number): void {
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
  cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Cancel specific key
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

/**
 * Throttler for rate limiting
 */
export class Throttler {
  private lastCalls: Map<string, number> = new Map();

  /**
   * Throttle a function call
   */
  throttle(key: string, fn: () => void, interval: number): void {
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
  isAllowed(key: string, interval: number): boolean {
    const lastCall = this.lastCalls.get(key);
    const now = Date.now();

    return !lastCall || now - lastCall >= interval;
  }

  /**
   * Reset throttle state
   */
  reset(key?: string): void {
    if (key) {
      this.lastCalls.delete(key);
    } else {
      this.lastCalls.clear();
    }
  }
}

/**
 * Memoization decorator
 */
export class Memoizer {
  private cache = new LRUCache<string, any>(1000, 300000); // 5 min TTL

  /**
   * Memoize a function
   */
  memoize<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      const key = JSON.stringify(args);
      const cached = this.cache.get(key);

      if (cached !== undefined) {
        return cached;
      }

      const result = fn(...args);
      this.cache.set(key, result);

      return result;
    }) as T;
  }

  /**
   * Clear memoization cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }
}

/**
 * Performance Optimizer
 */
export class PerformanceOptimizer {
  private profiler = new PerformanceProfiler();
  private recommendations: string[] = [];

  /**
   * Analyze performance and generate recommendations
   */
  analyze(profiles: ProfileResult[]): string[] {
    this.recommendations = [];

    for (const profile of profiles) {
      // Check execution time
      if (profile.duration > 1000) {
        this.recommendations.push(
          `${profile.name}: High execution time (${profile.duration}ms). Consider optimization or caching.`
        );
      }

      // Check memory usage
      if (profile.memory.delta > 10 * 1024 * 1024) {
        this.recommendations.push(
          `${profile.name}: High memory allocation (${(profile.memory.delta / (1024 * 1024)).toFixed(1)}MB). Check for memory leaks.`
        );
      }

      // Check operations per second
      if (profile.operations > 0 && profile.opsPerSecond < 100) {
        this.recommendations.push(
          `${profile.name}: Low throughput (${profile.opsPerSecond.toFixed(0)} ops/sec). Consider batching or parallelization.`
        );
      }
    }

    return this.recommendations;
  }

  /**
   * Get recommendations
   */
  getRecommendations(): string[] {
    return this.recommendations;
  }
}

/**
 * Singleton instances
 */
export const performanceProfiler = new PerformanceProfiler();
export const memoizer = new Memoizer();
export const debouncer = new Debouncer();
export const throttler = new Throttler();
export const performanceOptimizer = new PerformanceOptimizer();
