/**
 * Advanced Caching System
 * Multi-tier caching, cache invalidation, distributed cache, and cache warming
 */

import { eventBus } from '../core/EventBus';

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

export enum EvictionPolicy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  TTL = 'ttl',
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

export enum NodeStatus {
  Active = 'active',
  Syncing = 'syncing',
  Failed = 'failed',
}

export interface CacheOperation {
  id: string;
  type: OperationType;
  key: string;
  status: OperationStatus;
  duration?: number;
  timestamp: Date;
}

export enum OperationType {
  Get = 'get',
  Set = 'set',
  Delete = 'delete',
  Clear = 'clear',
  Invalidate = 'invalidate',
}

export enum OperationStatus {
  Success = 'success',
  Miss = 'miss',
  Error = 'error',
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
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private statistics: CacheStatistics;
  private accessOrder: string[] = [];
  private operations: Map<string, CacheOperation> = new Map();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      defaultTTL: 3600000, // 1 hour
      evictionPolicy: EvictionPolicy.LRU,
      compression: false,
      persistToDisk: false,
      ...config,
    };

    this.statistics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      entries: 0,
      size: 0,
      evictions: 0,
    };
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const operation = this.recordOperation(OperationType.Get, key);
    const startTime = Date.now();

    const entry = this.cache.get(key);

    if (!entry) {
      this.statistics.misses++;
      this.updateHitRate();
      operation.status = OperationStatus.Miss;
      operation.duration = Date.now() - startTime;
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      this.statistics.misses++;
      this.statistics.entries--;
      this.updateHitRate();
      operation.status = OperationStatus.Miss;
      operation.duration = Date.now() - startTime;
      return null;
    }

    entry.hits++;
    this.statistics.hits++;
    this.updateHitRate();
    this.updateAccessOrder(key);

    operation.status = OperationStatus.Success;
    operation.duration = Date.now() - startTime;

    eventBus.emitSync('cache.hit', { key }, 'CacheManager');

    return entry.value;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: { ttl?: number; tags?: string[] } = {}): Promise<void> {
    const operation = this.recordOperation(OperationType.Set, key);
    const startTime = Date.now();

    const size = this.calculateSize(value);
    const ttl = options.ttl ?? this.config.defaultTTL;

    // Check if we need to evict
    while (this.shouldEvict(size)) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: new Date(),
      expiresAt: ttl ? new Date(Date.now() + ttl) : undefined,
      hits: 0,
      size,
      tags: options.tags || [],
      metadata: {},
    };

    this.cache.set(key, entry);
    this.statistics.entries++;
    this.statistics.size += size;
    this.updateAccessOrder(key);

    operation.status = OperationStatus.Success;
    operation.duration = Date.now() - startTime;

    eventBus.emitSync('cache.set', { key, size }, 'CacheManager');
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    const operation = this.recordOperation(OperationType.Delete, key);
    const entry = this.cache.get(key);

    if (!entry) {
      operation.status = OperationStatus.Miss;
      return false;
    }

    this.cache.delete(key);
    this.statistics.entries--;
    this.statistics.size -= entry.size;
    this.removeFromAccessOrder(key);

    operation.status = OperationStatus.Success;

    eventBus.emitSync('cache.deleted', { key }, 'CacheManager');

    return true;
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    const operation = this.recordOperation(OperationType.Clear, '*');

    this.cache.clear();
    this.accessOrder = [];
    this.statistics.entries = 0;
    this.statistics.size = 0;

    operation.status = OperationStatus.Success;

    eventBus.emitSync('cache.cleared', {}, 'CacheManager');
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt && entry.expiresAt < new Date()) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get multiple keys
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple keys
   */
  async setMany<T>(entries: Map<string, T>, options: { ttl?: number; tags?: string[] } = {}): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
  }

  /**
   * Query cache entries
   */
  query(query: CacheQuery): CacheEntry[] {
    let entries = Array.from(this.cache.values());

    if (query.tags && query.tags.length > 0) {
      entries = entries.filter(e => query.tags!.some(tag => e.tags.includes(tag)));
    }

    if (query.pattern) {
      const regex = new RegExp(query.pattern);
      entries = entries.filter(e => regex.test(e.key));
    }

    if (query.minHits !== undefined) {
      entries = entries.filter(e => e.hits >= query.minHits!);
    }

    if (query.maxAge !== undefined) {
      const cutoff = new Date(Date.now() - query.maxAge);
      entries = entries.filter(e => e.createdAt >= cutoff);
    }

    return entries;
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const operation = this.recordOperation(OperationType.Invalidate, `tags:${tags.join(',')}`);

    let count = 0;

    for (const [key, entry] of this.cache) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        await this.delete(key);
        count++;
      }
    }

    operation.status = OperationStatus.Success;

    eventBus.emitSync('cache.invalidated', { tags, count }, 'CacheManager');

    return count;
  }

  /**
   * Invalidate by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    const operation = this.recordOperation(OperationType.Invalidate, `pattern:${pattern}`);

    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    operation.status = OperationStatus.Success;

    eventBus.emitSync('cache.invalidated', { pattern, count: keysToDelete.length }, 'CacheManager');

    return keysToDelete.length;
  }

  /**
   * Get statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get entry metadata
   */
  getEntry(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }

  /**
   * List all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private shouldEvict(newSize: number): boolean {
    return (
      this.statistics.entries >= this.config.maxEntries ||
      this.statistics.size + newSize > this.config.maxSize
    );
  }

  private evict(): void {
    let keyToEvict: string | undefined;

    switch (this.config.evictionPolicy) {
      case EvictionPolicy.LRU:
        keyToEvict = this.accessOrder[0];
        break;

      case EvictionPolicy.LFU:
        keyToEvict = this.findLFUKey();
        break;

      case EvictionPolicy.FIFO:
        keyToEvict = this.findOldestKey();
        break;

      case EvictionPolicy.TTL:
        keyToEvict = this.findExpiredKey();
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.statistics.evictions++;
    }
  }

  private findLFUKey(): string | undefined {
    let minHits = Infinity;
    let keyToEvict: string | undefined;

    for (const [key, entry] of this.cache) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  private findOldestKey(): string | undefined {
    let oldest: Date | undefined;
    let keyToEvict: string | undefined;

    for (const [key, entry] of this.cache) {
      if (!oldest || entry.createdAt < oldest) {
        oldest = entry.createdAt;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  private findExpiredKey(): string | undefined {
    const now = new Date();

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        return key;
      }
    }

    return this.findOldestKey();
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  private updateHitRate(): void {
    const total = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = total > 0 ? (this.statistics.hits / total) * 100 : 0;
  }

  private recordOperation(type: OperationType, key: string): CacheOperation {
    const operation: CacheOperation = {
      id: this.generateOperationId(),
      type,
      key,
      status: OperationStatus.Success,
      timestamp: new Date(),
    };

    this.operations.set(operation.id, operation);

    return operation;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Multi-Tier Cache Manager
 */
export class MultiTierCacheManager {
  private tiers: CacheTier[] = [];

  /**
   * Add tier
   */
  addTier(name: string, config: Partial<CacheConfig> = {}): CacheTier {
    const tier: CacheTier = {
      name,
      level: this.tiers.length,
      cache: new Map(),
      config: {
        maxSize: 50 * 1024 * 1024,
        maxEntries: 5000,
        defaultTTL: 3600000,
        evictionPolicy: EvictionPolicy.LRU,
        compression: false,
        persistToDisk: false,
        ...config,
      },
      statistics: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        entries: 0,
        size: 0,
        evictions: 0,
      },
    };

    this.tiers.push(tier);
    this.tiers.sort((a, b) => a.level - b.level);

    eventBus.emitSync('cache.tier_added', tier, 'MultiTierCacheManager');

    return tier;
  }

  /**
   * Get from cache (checks all tiers)
   */
  async get<T>(key: string): Promise<T | null> {
    for (const tier of this.tiers) {
      const entry = tier.cache.get(key);

      if (entry) {
        // Check expiration
        if (entry.expiresAt && entry.expiresAt < new Date()) {
          tier.cache.delete(key);
          continue;
        }

        tier.statistics.hits++;
        entry.hits++;

        // Promote to higher tiers
        await this.promote(key, entry, tier.level);

        return entry.value;
      } else {
        tier.statistics.misses++;
      }
    }

    return null;
  }

  /**
   * Set in cache (writes to all tiers)
   */
  async set<T>(key: string, value: T, options: { ttl?: number; tags?: string[] } = {}): Promise<void> {
    for (const tier of this.tiers) {
      const size = JSON.stringify(value).length;
      const ttl = options.ttl ?? tier.config.defaultTTL;

      const entry: CacheEntry<T> = {
        key,
        value,
        ttl,
        createdAt: new Date(),
        expiresAt: ttl ? new Date(Date.now() + ttl) : undefined,
        hits: 0,
        size,
        tags: options.tags || [],
        metadata: {},
      };

      tier.cache.set(key, entry);
      tier.statistics.entries++;
      tier.statistics.size += size;
    }

    eventBus.emitSync('cache.multi_tier_set', { key }, 'MultiTierCacheManager');
  }

  /**
   * Delete from all tiers
   */
  async delete(key: string): Promise<void> {
    for (const tier of this.tiers) {
      const entry = tier.cache.get(key);

      if (entry) {
        tier.cache.delete(key);
        tier.statistics.entries--;
        tier.statistics.size -= entry.size;
      }
    }

    eventBus.emitSync('cache.multi_tier_deleted', { key }, 'MultiTierCacheManager');
  }

  /**
   * Get tier
   */
  getTier(name: string): CacheTier | undefined {
    return this.tiers.find(t => t.name === name);
  }

  /**
   * List tiers
   */
  listTiers(): CacheTier[] {
    return [...this.tiers];
  }

  /**
   * Get statistics for all tiers
   */
  getStatistics(): Record<string, CacheStatistics> {
    const stats: Record<string, CacheStatistics> = {};

    for (const tier of this.tiers) {
      stats[tier.name] = { ...tier.statistics };
    }

    return stats;
  }

  private async promote<T>(key: string, entry: CacheEntry<T>, fromLevel: number): Promise<void> {
    for (let i = 0; i < fromLevel; i++) {
      const tier = this.tiers[i];
      tier.cache.set(key, { ...entry });
      tier.statistics.entries++;
      tier.statistics.size += entry.size;
    }
  }
}

/**
 * Cache Warmer
 */
export class CacheWarmerManager {
  private warmers: Map<string, CacheWarmer> = new Map();
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Register warmer
   */
  registerWarmer(warmer: Omit<CacheWarmer, 'id'>): CacheWarmer {
    const fullWarmer: CacheWarmer = {
      ...warmer,
      id: this.generateWarmerId(),
    };

    this.warmers.set(fullWarmer.id, fullWarmer);

    eventBus.emitSync('cache.warmer_registered', fullWarmer, 'CacheWarmerManager');

    return fullWarmer;
  }

  /**
   * Run warmer
   */
  async runWarmer(warmerId: string): Promise<number> {
    const warmer = this.warmers.get(warmerId);

    if (!warmer || !warmer.enabled) {
      return 0;
    }

    let count = 0;

    for (const key of warmer.keys) {
      try {
        const value = await warmer.loader(key);
        await this.cacheManager.set(key, value);
        count++;
      } catch (error) {
        // Log error but continue
      }
    }

    warmer.lastRun = new Date();

    eventBus.emitSync('cache.warmer_completed', { warmerId, count }, 'CacheWarmerManager');

    return count;
  }

  /**
   * Run all warmers
   */
  async runAllWarmers(): Promise<number> {
    let totalCount = 0;

    for (const warmer of this.warmers.values()) {
      if (warmer.enabled) {
        const count = await this.runWarmer(warmer.id);
        totalCount += count;
      }
    }

    return totalCount;
  }

  /**
   * Get warmer
   */
  getWarmer(warmerId: string): CacheWarmer | undefined {
    return this.warmers.get(warmerId);
  }

  /**
   * List warmers
   */
  listWarmers(): CacheWarmer[] {
    return Array.from(this.warmers.values());
  }

  private generateWarmerId(): string {
    return `warmer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Distributed Cache Manager
 */
export class DistributedCacheManager {
  private nodes: Map<string, DistributedCacheNode> = new Map();
  private localCache: CacheManager;

  constructor(localCache: CacheManager) {
    this.localCache = localCache;
  }

  /**
   * Add node
   */
  addNode(node: Omit<DistributedCacheNode, 'id' | 'status' | 'load' | 'keys' | 'lastHeartbeat'>): DistributedCacheNode {
    const fullNode: DistributedCacheNode = {
      ...node,
      id: this.generateNodeId(),
      status: NodeStatus.Active,
      load: 0,
      keys: new Set(),
      lastHeartbeat: new Date(),
    };

    this.nodes.set(fullNode.id, fullNode);

    eventBus.emitSync('cache.node_added', fullNode, 'DistributedCacheManager');

    return fullNode;
  }

  /**
   * Get from distributed cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try local cache first
    const localValue = await this.localCache.get<T>(key);

    if (localValue !== null) {
      return localValue;
    }

    // Find node with key
    const node = this.findNodeWithKey(key);

    if (node) {
      // Mock remote fetch
      const value = await this.fetchFromNode<T>(node, key);

      if (value !== null) {
        // Cache locally
        await this.localCache.set(key, value);
      }

      return value;
    }

    return null;
  }

  /**
   * Set in distributed cache
   */
  async set<T>(key: string, value: T, options: { ttl?: number; tags?: string[] } = {}): Promise<void> {
    // Set in local cache
    await this.localCache.set(key, value, options);

    // Distribute to nodes
    const node = this.selectNode(key);

    if (node) {
      node.keys.add(key);
      node.load = node.keys.size;
    }

    eventBus.emitSync('cache.distributed_set', { key, nodeId: node?.id }, 'DistributedCacheManager');
  }

  /**
   * Delete from distributed cache
   */
  async delete(key: string): Promise<void> {
    await this.localCache.delete(key);

    for (const node of this.nodes.values()) {
      node.keys.delete(key);
      node.load = node.keys.size;
    }

    eventBus.emitSync('cache.distributed_deleted', { key }, 'DistributedCacheManager');
  }

  /**
   * Get node
   */
  getNode(nodeId: string): DistributedCacheNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * List nodes
   */
  listNodes(): DistributedCacheNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Remove node
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    eventBus.emitSync('cache.node_removed', { nodeId }, 'DistributedCacheManager');
  }

  private selectNode(key: string): DistributedCacheNode | undefined {
    // Simple hash-based selection
    const activeNodes = Array.from(this.nodes.values()).filter(n => n.status === NodeStatus.Active);

    if (activeNodes.length === 0) {
      return undefined;
    }

    const hash = this.hashKey(key);
    return activeNodes[hash % activeNodes.length];
  }

  private findNodeWithKey(key: string): DistributedCacheNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.keys.has(key)) {
        return node;
      }
    }

    return undefined;
  }

  private async fetchFromNode<T>(node: DistributedCacheNode, key: string): Promise<T | null> {
    // Mock remote fetch
    await new Promise(resolve => setTimeout(resolve, 10));
    return null;
  }

  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const cacheManager = new CacheManager();
export const multiTierCacheManager = new MultiTierCacheManager();
export const cacheWarmerManager = new CacheWarmerManager(cacheManager);
export const distributedCacheManager = new DistributedCacheManager(cacheManager);
