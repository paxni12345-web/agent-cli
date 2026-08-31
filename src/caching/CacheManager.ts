/**
 * Advanced Caching System
 * Multi-tier caching with Redis, memory, distributed cache support
 * Cache warming, invalidation strategies, TTL management
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

// ============================================================================
// Cache Manager
// ============================================================================

export class CacheManager extends EventEmitter {
  private config: CacheManagerConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private layers: Map<CacheLayerType, CacheLayer> = new Map();
  private patterns: Map<string, CachePattern> = new Map();
  private warmingStrategies: Map<string, CacheWarmingStrategy> = new Map();
  private invalidationRules: Map<string, CacheInvalidationRule> = new Map();
  private operations: CacheOperation[] = [];
  private lruList: string[] = [];
  private lfuMap: Map<string, number> = new Map();
  private currentMemorySize: number = 0;

  constructor(config: Partial<CacheManagerConfig> = {}) {
    super();
    this.config = {
      enableMemoryCache: true,
      enableRedisCache: false,
      enableDistributedCache: false,
      defaultTTL: 3600000,
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      evictionPolicy: 'lru',
      compressionThreshold: 1024,
      enableCompression: true,
      ...config,
    };

    this.initializeLayers();
    this.startCleanupTimer();
  }

  // ========================================================================
  // Core Cache Operations
  // ========================================================================

  public async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    let hit = false;
    let layer: CacheLayerType = 'memory';

    try {
      // Try memory cache first
      if (this.config.enableMemoryCache) {
        const entry = this.memoryCache.get(key);
        if (entry && !this.isExpired(entry)) {
          this.updateAccessMetadata(entry);
          this.recordOperation('get', key, 'memory', Date.now() - startTime, true);
          hit = true;
          return entry.value as T;
        }
      }

      // Try Redis cache
      if (this.config.enableRedisCache) {
        const value = await this.getFromRedis<T>(key);
        if (value !== null) {
          // Populate memory cache
          await this.set(key, value, { layer: 'memory' });
          this.recordOperation('get', key, 'redis', Date.now() - startTime, true);
          hit = true;
          return value;
        }
      }

      // Try distributed cache
      if (this.config.enableDistributedCache) {
        const value = await this.getFromDistributed<T>(key);
        if (value !== null) {
          // Populate lower layers
          await this.set(key, value, { layer: 'memory' });
          this.recordOperation('get', key, 'distributed', Date.now() - startTime, true);
          hit = true;
          return value;
        }
      }

      this.recordOperation('get', key, layer, Date.now() - startTime, false);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Cache get error for key ${key}:`, errorMessage);
      this.emit('cache:error', {
        operation: 'get',
        key,
        error: errorMessage
      });
      return null;
    }
  }

  public async set<T = any>(
    key: string,
    value: T,
    options: SetOptions = {}
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const tags = new Set(options.tags || []);
      const compressed = this.shouldCompress(value);

      const entry: CacheEntry<T> = {
        key,
        value: compressed ? this.compress(value) : value,
        metadata: {
          createdAt: Date.now(),
          expiresAt: ttl ? Date.now() + ttl : undefined,
          lastAccessed: Date.now(),
          accessCount: 0,
          hitCount: 0,
          missCount: 0,
          ttl,
        },
        compressed,
        size: this.calculateSize(value),
        tags,
      };

      // Set in appropriate layers
      const targetLayer = options.layer || 'memory';

      if (targetLayer === 'memory' && this.config.enableMemoryCache) {
        await this.setInMemory(key, entry);
      }

      if (targetLayer === 'redis' && this.config.enableRedisCache) {
        await this.setInRedis(key, entry);
      }

      if (targetLayer === 'distributed' && this.config.enableDistributedCache) {
        await this.setInDistributed(key, entry);
      }

      this.recordOperation('set', key, targetLayer, Date.now() - startTime, true);
      this.emit('cache:set', { key, layer: targetLayer });
    } catch (error) {
      this.emit('cache:error', { operation: 'set', key, error });
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Delete from all layers
      this.memoryCache.delete(key);
      this.lruList = this.lruList.filter(k => k !== key);
      this.lfuMap.delete(key);

      if (this.config.enableRedisCache) {
        await this.deleteFromRedis(key);
      }

      if (this.config.enableDistributedCache) {
        await this.deleteFromDistributed(key);
      }

      this.recordOperation('delete', key, 'memory', Date.now() - startTime, true);
      this.emit('cache:delete', { key });
    } catch (error) {
      this.emit('cache:error', { operation: 'delete', key, error });
      throw error;
    }
  }

  public async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        const regex = new RegExp(pattern);
        const keysToDelete = Array.from(this.memoryCache.keys()).filter(k =>
          regex.test(k)
        );
        for (const key of keysToDelete) {
          await this.delete(key);
        }
      } else {
        this.memoryCache.clear();
        this.lruList = [];
        this.lfuMap.clear();
        this.currentMemorySize = 0;

        if (this.config.enableRedisCache) {
          await this.clearRedis();
        }

        if (this.config.enableDistributedCache) {
          await this.clearDistributed();
        }
      }

      this.emit('cache:clear', { pattern });
    } catch (error) {
      this.emit('cache:error', { operation: 'clear', error });
      throw error;
    }
  }

  // ========================================================================
  // Memory Cache Operations
  // ========================================================================

  private async setInMemory<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Check if we need to evict
    while (
      this.currentMemorySize + entry.size > this.config.maxMemorySize &&
      this.memoryCache.size > 0
    ) {
      await this.evict();
    }

    // Remove old entry if exists
    const oldEntry = this.memoryCache.get(key);
    if (oldEntry) {
      this.currentMemorySize -= oldEntry.size;
    }

    // Add new entry
    this.memoryCache.set(key, entry);
    this.currentMemorySize += entry.size;

    // Update eviction policy structures
    this.updateEvictionStructures(key);

    const layer = this.layers.get('memory');
    if (layer) {
      layer.stats.keys = this.memoryCache.size;
      layer.stats.size = this.currentMemorySize;
    }
  }

  private async evict(): Promise<void> {
    let keyToEvict: string | undefined;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.lruList[0];
        break;

      case 'lfu':
        keyToEvict = this.findLFUKey();
        break;

      case 'fifo':
        keyToEvict = Array.from(this.memoryCache.keys())[0];
        break;

      case 'lifo':
        const keys = Array.from(this.memoryCache.keys());
        keyToEvict = keys[keys.length - 1];
        break;

      case 'random':
        const randomKeys = Array.from(this.memoryCache.keys());
        keyToEvict = randomKeys[Math.floor(Math.random() * randomKeys.length)];
        break;

      case 'ttl':
        keyToEvict = this.findExpiringSoonestKey();
        break;
    }

    if (keyToEvict) {
      const entry = this.memoryCache.get(keyToEvict);
      if (entry) {
        this.currentMemorySize -= entry.size;
      }
      this.memoryCache.delete(keyToEvict);
      this.lruList = this.lruList.filter(k => k !== keyToEvict);
      this.lfuMap.delete(keyToEvict);

      const layer = this.layers.get('memory');
      if (layer) {
        layer.stats.evictions++;
      }

      this.emit('cache:evict', { key: keyToEvict, policy: this.config.evictionPolicy });
    }
  }

  private updateEvictionStructures(key: string): void {
    // Update LRU
    this.lruList = this.lruList.filter(k => k !== key);
    this.lruList.push(key);

    // Update LFU
    this.lfuMap.set(key, (this.lfuMap.get(key) || 0) + 1);
  }

  private findLFUKey(): string | undefined {
    let minFreq = Infinity;
    let lfuKey: string | undefined;

    for (const [key, freq] of this.lfuMap.entries()) {
      if (freq < minFreq) {
        minFreq = freq;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  private findExpiringSoonestKey(): string | undefined {
    let earliestExpiry = Infinity;
    let ttlKey: string | undefined;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.metadata.expiresAt && entry.metadata.expiresAt < earliestExpiry) {
        earliestExpiry = entry.metadata.expiresAt;
        ttlKey = key;
      }
    }

    return ttlKey;
  }

  // ========================================================================
  // Redis Cache Operations
  // ========================================================================

  private async getFromRedis<T>(key: string): Promise<T | null> {
    // Simulate Redis get - implement actual Redis in production
    this.emit('redis:get', { key });
    return null;
  }

  private async setInRedis<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Simulate Redis set - implement actual Redis in production
    this.emit('redis:set', { key });
  }

  private async deleteFromRedis(key: string): Promise<void> {
    // Simulate Redis delete - implement actual Redis in production
    this.emit('redis:delete', { key });
  }

  private async clearRedis(): Promise<void> {
    // Simulate Redis clear - implement actual Redis in production
    this.emit('redis:clear');
  }

  // ========================================================================
  // Distributed Cache Operations
  // ========================================================================

  private async getFromDistributed<T>(key: string): Promise<T | null> {
    // Simulate distributed cache get - implement actual distributed cache in production
    this.emit('distributed:get', { key });
    return null;
  }

  private async setInDistributed<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Simulate distributed cache set - implement actual distributed cache in production
    this.emit('distributed:set', { key });
  }

  private async deleteFromDistributed(key: string): Promise<void> {
    // Simulate distributed cache delete - implement actual distributed cache in production
    this.emit('distributed:delete', { key });
  }

  private async clearDistributed(): Promise<void> {
    // Simulate distributed cache clear - implement actual distributed cache in production
    this.emit('distributed:clear');
  }

  // ========================================================================
  // Cache Warming
  // ========================================================================

  public registerWarmingStrategy(
    strategy: Omit<CacheWarmingStrategy, 'id'>
  ): CacheWarmingStrategy {
    const full: CacheWarmingStrategy = {
      ...strategy,
      id: this.generateId(),
    };

    this.warmingStrategies.set(full.id, full);
    this.emit('warming:registered', { strategy: full });

    return full;
  }

  public async warmCache(strategyId?: string): Promise<void> {
    const strategies = strategyId
      ? [this.warmingStrategies.get(strategyId)].filter(Boolean)
      : Array.from(this.warmingStrategies.values()).filter(s => s.enabled);

    for (const strategy of strategies as CacheWarmingStrategy[]) {
      try {
        const data = await strategy.loader();
        for (const [key, value] of data.entries()) {
          await this.set(key, value);
        }
        this.emit('warming:completed', { strategy });
      } catch (error) {
        this.emit('warming:error', { strategy, error });
      }
    }
  }

  // ========================================================================
  // Cache Invalidation
  // ========================================================================

  public registerInvalidationRule(
    rule: Omit<CacheInvalidationRule, 'id'>
  ): CacheInvalidationRule {
    const full: CacheInvalidationRule = {
      ...rule,
      id: this.generateId(),
    };

    this.invalidationRules.set(full.id, full);
    this.emit('invalidation:rule:registered', { rule: full });

    return full;
  }

  public async invalidate(key: string, cascading: boolean = true): Promise<void> {
    await this.delete(key);

    if (cascading) {
      // Find and invalidate dependent keys
      for (const rule of this.invalidationRules.values()) {
        if (rule.cascading && rule.dependencies.includes(key)) {
          const keysToInvalidate = Array.from(this.memoryCache.keys()).filter(k =>
            rule.pattern.test(k)
          );

          for (const dependentKey of keysToInvalidate) {
            await this.delete(dependentKey);
          }
        }
      }
    }

    this.emit('cache:invalidate', { key, cascading });
  }

  public async invalidateByTag(tag: string): Promise<void> {
    const keysToInvalidate: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.has(tag)) {
        keysToInvalidate.push(key);
      }
    }

    for (const key of keysToInvalidate) {
      await this.delete(key);
    }

    this.emit('cache:invalidate:tag', { tag, count: keysToInvalidate.length });
  }

  public async invalidateByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToInvalidate = Array.from(this.memoryCache.keys()).filter(k =>
      regex.test(k)
    );

    for (const key of keysToInvalidate) {
      await this.delete(key);
    }

    this.emit('cache:invalidate:pattern', { pattern, count: keysToInvalidate.length });
  }

  // ========================================================================
  // Cache Patterns
  // ========================================================================

  public registerPattern(pattern: CachePattern): void {
    this.patterns.set(pattern.pattern, pattern);
    this.emit('pattern:registered', { pattern });
  }

  public getPatternForKey(key: string): CachePattern | undefined {
    for (const [patternStr, pattern] of this.patterns.entries()) {
      if (new RegExp(patternStr).test(key)) {
        return pattern;
      }
    }
    return undefined;
  }

  // ========================================================================
  // Compression
  // ========================================================================

  private shouldCompress(value: any): boolean {
    if (!this.config.enableCompression) return false;
    const size = this.calculateSize(value);
    return size > this.config.compressionThreshold;
  }

  private compress(value: any): any {
    // Simplified compression - use proper compression in production (e.g., zlib)
    const json = JSON.stringify(value);
    return {
      __compressed: true,
      data: Buffer.from(json).toString('base64'),
    };
  }

  private decompress(value: any): any {
    if (!value || !value.__compressed) return value;
    const json = Buffer.from(value.data, 'base64').toString();
    return JSON.parse(json);
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private initializeLayers(): void {
    if (this.config.enableMemoryCache) {
      this.layers.set('memory', {
        name: 'Memory Cache',
        type: 'memory',
        priority: 1,
        enabled: true,
        stats: {
          hits: 0,
          misses: 0,
          evictions: 0,
          size: 0,
          keys: 0,
        },
      });
    }

    if (this.config.enableRedisCache) {
      this.layers.set('redis', {
        name: 'Redis Cache',
        type: 'redis',
        priority: 2,
        enabled: true,
        stats: {
          hits: 0,
          misses: 0,
          evictions: 0,
          size: 0,
          keys: 0,
        },
      });
    }

    if (this.config.enableDistributedCache) {
      this.layers.set('distributed', {
        name: 'Distributed Cache',
        type: 'distributed',
        priority: 3,
        enabled: true,
        stats: {
          hits: 0,
          misses: 0,
          evictions: 0,
          size: 0,
          keys: 0,
        },
      });
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.metadata.expiresAt) return false;
    return Date.now() > entry.metadata.expiresAt;
  }

  private updateAccessMetadata(entry: CacheEntry): void {
    entry.metadata.lastAccessed = Date.now();
    entry.metadata.accessCount++;
    entry.metadata.hitCount++;

    // Update LRU
    this.lruList = this.lruList.filter(k => k !== entry.key);
    this.lruList.push(entry.key);

    // Update LFU
    this.lfuMap.set(entry.key, (this.lfuMap.get(entry.key) || 0) + 1);

    const layer = this.layers.get('memory');
    if (layer) {
      layer.stats.hits++;
    }
  }

  /**
   * Records a cache operation for monitoring and statistics.
   * Maintains a bounded list of recent operations.
   * @param type - Type of operation (get, set, delete, etc.)
   * @param key - Cache key
   * @param layer - Cache layer (memory, redis, distributed)
   * @param duration - Operation duration in milliseconds
   * @param hit - Whether the operation was a cache hit
   */
  private recordOperation(
    type: OperationType,
    key: string,
    layer: CacheLayerType,
    duration: number,
    hit: boolean
  ): void {
    try {
      const operation: CacheOperation = {
        id: this.generateId(),
        type,
        key,
        layer,
        timestamp: Date.now(),
        duration,
        hit,
      };

      // Ensure operations array exists and is valid
      if (!Array.isArray(this.operations)) {
        this.operations = [];
      }

      this.operations.push(operation);

      // Keep only recent operations - improved memory management
      const MAX_OPERATIONS = 1000;
      if (this.operations.length > MAX_OPERATIONS) {
        // Use shift only when we're certain the array is not empty
        const removed = this.operations.shift();
        if (!removed) {
          // This should never happen, but log if it does
          console.warn('Failed to remove oldest operation from cache operations array');
        }
      }

      // Update layer stats
      const layerObj = this.layers.get(layer);
      if (layerObj) {
        if (hit) {
          layerObj.stats.hits++;
        } else {
          layerObj.stats.misses++;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to record cache operation:', errorMessage);
      this.emit('cache:record_operation_error', {
        type,
        key,
        layer,
        error: errorMessage
      });
    }
  }

  private calculateSize(value: any): number {
    // Simplified size calculation
    const json = JSON.stringify(value);
    return Buffer.byteLength(json, 'utf8');
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Every minute
  }

  private cleanupExpired(): void {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.emit('cache:cleanup', { expired: expiredKeys.length });
    }
  }

  private generateId(): string {
    return `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Batch Operations
  // ========================================================================

  public async getMany<T = any>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      keys.map(async key => {
        const value = await this.get<T>(key);
        if (value !== null) {
          results.set(key, value);
        }
      })
    );

    return results;
  }

  public async setMany<T = any>(
    entries: Map<string, T>,
    options: SetOptions = {}
  ): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) => this.set(key, value, options))
    );
  }

  public async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.delete(key)));
  }

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  public getStats(): CacheStats {
    const layers = Array.from(this.layers.values());
    const totalHits = layers.reduce((sum, l) => sum + l.stats.hits, 0);
    const totalMisses = layers.reduce((sum, l) => sum + l.stats.misses, 0);
    const hitRate = totalHits / (totalHits + totalMisses) || 0;

    return {
      layers: layers.map(l => ({
        name: l.name,
        type: l.type,
        enabled: l.enabled,
        ...l.stats,
        hitRate: l.stats.hits / (l.stats.hits + l.stats.misses) || 0,
      })),
      totalHits,
      totalMisses,
      hitRate,
      memoryUsage: this.currentMemorySize,
      memoryLimit: this.config.maxMemorySize,
      memoryUsagePercent: (this.currentMemorySize / this.config.maxMemorySize) * 100,
      totalKeys: this.memoryCache.size,
      warmingStrategies: this.warmingStrategies.size,
      invalidationRules: this.invalidationRules.size,
      recentOperations: this.operations.slice(-100),
    };
  }

  public getLayerStats(type: CacheLayerType): CacheLayerStats | undefined {
    return this.layers.get(type)?.stats;
  }

  public getRecentOperations(count: number = 100): CacheOperation[] {
    return this.operations.slice(-count);
  }

  // ========================================================================
  // Advanced Features
  // ========================================================================

  public async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    options: SetOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, options);
    return value;
  }

  public async memoize<T>(
    fn: (...args: any[]) => Promise<T>,
    keyGenerator: (...args: any[]) => string,
    options: SetOptions = {}
  ): Promise<(...args: any[]) => Promise<T>> {
    return async (...args: any[]): Promise<T> => {
      const key = keyGenerator(...args);
      return this.getOrSet(key, () => fn(...args), options);
    };
  }

  public async touch(key: string, ttl?: number): Promise<void> {
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (ttl) {
        entry.metadata.expiresAt = Date.now() + ttl;
        entry.metadata.ttl = ttl;
      }
      this.updateAccessMetadata(entry);
    }
  }

  public async exists(key: string): Promise<boolean> {
    const entry = this.memoryCache.get(key);
    return entry ? !this.isExpired(entry) : false;
  }

  public async ttl(key: string): Promise<number | null> {
    const entry = this.memoryCache.get(key);
    if (!entry || !entry.metadata.expiresAt) return null;

    const remaining = entry.metadata.expiresAt - Date.now();
    return remaining > 0 ? remaining : null;
  }

  public async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.memoryCache.keys());

    if (!pattern) return allKeys;

    const regex = new RegExp(pattern);
    return allKeys.filter(k => regex.test(k));
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export default CacheManager;
