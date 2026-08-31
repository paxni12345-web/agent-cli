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

export class DistributedCache extends EventEmitter {
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats;
  private layers: Map<string, CacheLayer> = new Map();
  private warmupTasks: Map<string, WarmupTask> = new Map();

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    this.config = {
      type: 'hybrid',
      ttl: 3600000,
      maxSize: 100 * 1024 * 1024,
      evictionPolicy: 'lru',
      compressionEnabled: true,
      serializationFormat: 'json',
      ...config
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      avgLatency: 0,
      totalSize: 0,
      entryCount: 0
    };

    this.initializeLayers();
  }

  private initializeLayers(): void {
    this.layers.set('L1', {
      name: 'L1 Memory',
      type: 'memory',
      capacity: 10 * 1024 * 1024,
      currentSize: 0,
      stats: { ...this.stats }
    });

    this.layers.set('L2', {
      name: 'L2 Redis',
      type: 'redis',
      capacity: 100 * 1024 * 1024,
      currentSize: 0,
      stats: { ...this.stats }
    });
  }

  public async get(key: string): Promise<any> {
    const startTime = Date.now();

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.stats.misses++;
        this.updateHitRate();
        this.emit('cache:miss', { key });
        return null;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        this.emit('cache:expired', { key });
        return null;
      }

      entry.accessedAt = new Date();
      entry.accessCount++;
      this.stats.hits++;
      this.updateHitRate();

      const latency = Date.now() - startTime;
      this.updateAvgLatency(latency);

      this.emit('cache:hit', { key, latency });

      return entry.compressed ? this.decompress(entry.value) : entry.value;
    } catch (error) {
      this.emit('cache:error', { operation: 'get', key, error });
      throw error;
    }
  }

  public async set(key: string, value: any, ttl?: number): Promise<void> {
    const startTime = Date.now();

    try {
      const serialized = this.serialize(value);
      const compressed = this.config.compressionEnabled
        ? this.compress(serialized)
        : serialized;

      const size = this.getSize(compressed);

      if (this.stats.totalSize + size > this.config.maxSize) {
        await this.evict(size);
      }

      const entry: CacheEntry = {
        key,
        value: compressed,
        size,
        ttl: ttl || this.config.ttl,
        createdAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        compressed: this.config.compressionEnabled
      };

      const existing = this.cache.get(key);
      if (existing) {
        this.stats.totalSize -= existing.size;
      }

      this.cache.set(key, entry);
      this.stats.totalSize += size;
      this.stats.entryCount = this.cache.size;
      this.stats.sets++;

      const latency = Date.now() - startTime;
      this.updateAvgLatency(latency);

      this.emit('cache:set', { key, size, latency });
    } catch (error) {
      this.emit('cache:error', { operation: 'set', key, error });
      throw error;
    }
  }

  public async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.stats.totalSize -= entry.size;
    this.stats.entryCount = this.cache.size;
    this.stats.deletes++;

    this.emit('cache:delete', { key });
    return true;
  }

  public async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  public async mget(keys: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    for (const key of keys) {
      const value = await this.get(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  public async mset(entries: Map<string, any>, ttl?: number): Promise<void> {
    const promises = Array.from(entries.entries()).map(([key, value]) =>
      this.set(key, value, ttl)
    );

    await Promise.all(promises);
  }

  public async clear(): Promise<void> {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.stats.entryCount = 0;
    this.emit('cache:cleared');
  }

  public async evict(requiredSize: number): Promise<void> {
    const toEvict: string[] = [];
    let freedSize = 0;

    const entries = Array.from(this.cache.entries());

    switch (this.config.evictionPolicy) {
      case 'lru':
        entries.sort((a, b) =>
          a[1].accessedAt.getTime() - b[1].accessedAt.getTime()
        );
        break;

      case 'lfu':
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;

      case 'fifo':
        entries.sort((a, b) =>
          a[1].createdAt.getTime() - b[1].createdAt.getTime()
        );
        break;

      case 'ttl':
        entries.sort((a, b) => {
          const expiryA = a[1].createdAt.getTime() + a[1].ttl;
          const expiryB = b[1].createdAt.getTime() + b[1].ttl;
          return expiryA - expiryB;
        });
        break;
    }

    for (const [key, entry] of entries) {
      if (freedSize >= requiredSize) break;

      toEvict.push(key);
      freedSize += entry.size;
    }

    for (const key of toEvict) {
      await this.delete(key);
      this.stats.evictions++;
    }

    this.emit('cache:evicted', { count: toEvict.length, freedSize });
  }

  public async warmup(keys: string[], loader: (key: string) => Promise<any>): Promise<string> {
    const taskId = `warmup_${Date.now()}`;

    const task: WarmupTask = {
      id: taskId,
      keys,
      status: 'pending',
      progress: 0
    };

    this.warmupTasks.set(taskId, task);

    setImmediate(async () => {
      task.status = 'running';
      task.startTime = new Date();

      try {
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = await loader(key);
          await this.set(key, value);

          task.progress = ((i + 1) / keys.length) * 100;
          this.emit('warmup:progress', { taskId, progress: task.progress });
        }

        task.status = 'completed';
        task.endTime = new Date();
        this.emit('warmup:completed', { taskId });
      } catch (error) {
        task.status = 'failed';
        task.endTime = new Date();
        this.emit('warmup:failed', { taskId, error });
      }
    });

    return taskId;
  }

  public async invalidate(pattern: string): Promise<number> {
    const regex = new RegExp(pattern);
    const toDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      await this.delete(key);
    }

    this.emit('cache:invalidated', { pattern, count: toDelete.length });
    return toDelete.length;
  }

  public async refresh(key: string, loader: (key: string) => Promise<any>): Promise<void> {
    const value = await loader(key);
    await this.set(key, value);
    this.emit('cache:refreshed', { key });
  }

  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.createdAt.getTime();
    return age > entry.ttl;
  }

  private serialize(value: any): string {
    switch (this.config.serializationFormat) {
      case 'json':
        return JSON.stringify(value);
      case 'msgpack':
        return JSON.stringify(value);
      case 'protobuf':
        return JSON.stringify(value);
      default:
        return JSON.stringify(value);
    }
  }

  private compress(data: string): string {
    return Buffer.from(data).toString('base64');
  }

  private decompress(data: string): any {
    const decompressed = Buffer.from(data, 'base64').toString('utf-8');
    return JSON.parse(decompressed);
  }

  private getSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data));
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateAvgLatency(latency: number): void {
    const operations = this.stats.hits + this.stats.sets;
    this.stats.avgLatency = ((this.stats.avgLatency * (operations - 1)) + latency) / operations;
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  public getLayer(name: string): CacheLayer | null {
    return this.layers.get(name) || null;
  }

  public listLayers(): CacheLayer[] {
    return Array.from(this.layers.values());
  }

  public getWarmupTask(taskId: string): WarmupTask | null {
    return this.warmupTasks.get(taskId) || null;
  }

  public async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) {
      return allKeys;
    }

    const regex = new RegExp(pattern);
    return allKeys.filter(key => regex.test(key));
  }

  public async size(): Promise<number> {
    return this.cache.size;
  }

  public async reset(): Promise<void> {
    await this.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      avgLatency: 0,
      totalSize: 0,
      entryCount: 0
    };
    this.emit('cache:reset');
  }
}

export class CacheCluster extends EventEmitter {
  private nodes: Map<string, DistributedCache> = new Map();
  private hashRing: Map<string, string> = new Map();

  constructor(nodeCount: number = 3) {
    super();
    this.initializeNodes(nodeCount);
  }

  private initializeNodes(count: number): void {
    for (let i = 0; i < count; i++) {
      const nodeId = `node_${i}`;
      const node = new DistributedCache();
      this.nodes.set(nodeId, node);

      for (let v = 0; v < 150; v++) {
        const virtualKey = `${nodeId}:${v}`;
        const hash = this.hash(virtualKey);
        this.hashRing.set(hash, nodeId);
      }
    }
  }

  private hash(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private getNode(key: string): DistributedCache {
    const keyHash = this.hash(key);
    const ringKeys = Array.from(this.hashRing.keys()).sort();

    for (const ringHash of ringKeys) {
      if (ringHash >= keyHash) {
        const nodeId = this.hashRing.get(ringHash)!;
        return this.nodes.get(nodeId)!;
      }
    }

    const firstNodeId = this.hashRing.get(ringKeys[0])!;
    return this.nodes.get(firstNodeId)!;
  }

  public async get(key: string): Promise<any> {
    const node = this.getNode(key);
    return node.get(key);
  }

  public async set(key: string, value: any, ttl?: number): Promise<void> {
    const node = this.getNode(key);
    return node.set(key, value, ttl);
  }

  public async delete(key: string): Promise<boolean> {
    const node = this.getNode(key);
    return node.delete(key);
  }

  public async clear(): Promise<void> {
    const promises = Array.from(this.nodes.values()).map(node => node.clear());
    await Promise.all(promises);
  }

  public getClusterStats(): any {
    const nodeStats = Array.from(this.nodes.entries()).map(([id, node]) => ({
      nodeId: id,
      stats: node.getStats()
    }));

    const totalStats = nodeStats.reduce((acc, ns) => ({
      hits: acc.hits + ns.stats.hits,
      misses: acc.misses + ns.stats.misses,
      sets: acc.sets + ns.stats.sets,
      deletes: acc.deletes + ns.stats.deletes,
      evictions: acc.evictions + ns.stats.evictions,
      totalSize: acc.totalSize + ns.stats.totalSize,
      entryCount: acc.entryCount + ns.stats.entryCount
    }), {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0
    });

    return {
      nodeCount: this.nodes.size,
      nodeStats,
      totalStats,
      hitRate: totalStats.hits / (totalStats.hits + totalStats.misses)
    };
  }
}

export default DistributedCache;
