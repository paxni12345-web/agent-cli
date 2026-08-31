/**
 * ShardingManager - Horizontal database sharding management
 * Handles consistent hashing, shard rebalancing, and cross-shard queries
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface Shard {
  id: string;
  name: string;
  connection: ShardConnection;
  status: 'online' | 'offline' | 'maintenance' | 'degraded';
  weight: number;
  keyRange: KeyRange;
  statistics: ShardStatistics;
}

export interface ShardConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  maxConnections: number;
}

export interface KeyRange {
  start: string;
  end: string;
  type: 'hash' | 'range' | 'list';
}

export interface ShardStatistics {
  totalKeys: number;
  totalSize: number;
  queryCount: number;
  avgLatency: number;
  errorRate: number;
  lastHealthCheck: Date;
}

export interface ShardingStrategy {
  type: 'consistent_hash' | 'range' | 'directory' | 'geo';
  virtualNodes: number;
  replicationFactor: number;
  rebalanceThreshold: number;
}

export interface ShardKey {
  value: string;
  shard: string;
  replicas: string[];
}

export interface RebalanceTask {
  id: string;
  fromShard: string;
  toShard: string;
  keyRange: KeyRange;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  keysProcessed: number;
  totalKeys: number;
  startTime?: Date;
  endTime?: Date;
}

export interface CrossShardQuery {
  id: string;
  sql: string;
  shards: string[];
  results: Map<string, any[]>;
  aggregated?: any[];
  executionTime: number;
}

export class ShardingManager extends EventEmitter {
  private shards: Map<string, Shard> = new Map();
  private strategy: ShardingStrategy;
  private hashRing: Map<string, string> = new Map();
  private rebalanceTasks: Map<string, RebalanceTask> = new Map();
  private keyDirectory: Map<string, ShardKey> = new Map();

  constructor(strategy?: Partial<ShardingStrategy>) {
    super();
    this.strategy = {
      type: 'consistent_hash',
      virtualNodes: 150,
      replicationFactor: 2,
      rebalanceThreshold: 0.25,
      ...strategy
    };
  }

  /**
   * Add shard to cluster
   */
  public addShard(shard: Shard): void {
    this.shards.set(shard.id, shard);

    if (this.strategy.type === 'consistent_hash') {
      this.addToHashRing(shard);
    }

    this.emit('shard:added', shard);

    // Check if rebalancing needed
    if (this.needsRebalancing()) {
      this.scheduleRebalance();
    }
  }

  /**
   * Remove shard from cluster
   */
  public async removeShard(shardId: string): Promise<void> {
    const shard = this.shards.get(shardId);
    if (!shard) throw new Error(`Shard ${shardId} not found`);

    // Move data to other shards
    await this.migrateShard(shardId);

    this.shards.delete(shardId);

    if (this.strategy.type === 'consistent_hash') {
      this.removeFromHashRing(shard);
    }

    this.emit('shard:removed', shardId);
  }

  /**
   * Add shard to consistent hash ring
   */
  private addToHashRing(shard: Shard): void {
    for (let i = 0; i < this.strategy.virtualNodes; i++) {
      const virtualKey = `${shard.id}:${i}`;
      const hash = this.hash(virtualKey);
      this.hashRing.set(hash, shard.id);
    }

    // Sort ring by hash
    const sorted = new Map([...this.hashRing.entries()].sort());
    this.hashRing = sorted;
  }

  /**
   * Remove shard from hash ring
   */
  private removeFromHashRing(shard: Shard): void {
    const keysToRemove: string[] = [];

    for (const [hash, shardId] of this.hashRing) {
      if (shardId === shard.id) {
        keysToRemove.push(hash);
      }
    }

    keysToRemove.forEach(key => this.hashRing.delete(key));
  }

  /**
   * Get shard for key using consistent hashing
   */
  public getShardForKey(key: string): string {
    if (this.shards.size === 0) {
      throw new Error('No shards available');
    }

    switch (this.strategy.type) {
      case 'consistent_hash':
        return this.getShardConsistentHash(key);

      case 'range':
        return this.getShardRange(key);

      case 'directory':
        return this.getShardDirectory(key);

      case 'geo':
        return this.getShardGeo(key);

      default:
        return this.getShardConsistentHash(key);
    }
  }

  /**
   * Consistent hash shard selection
   */
  private getShardConsistentHash(key: string): string {
    const keyHash = this.hash(key);
    const ringKeys = Array.from(this.hashRing.keys());

    // Find first hash >= key hash
    for (const ringHash of ringKeys) {
      if (ringHash >= keyHash) {
        return this.hashRing.get(ringHash)!;
      }
    }

    // Wrap around to first shard
    return this.hashRing.get(ringKeys[0])!;
  }

  /**
   * Range-based shard selection
   */
  private getShardRange(key: string): string {
    for (const shard of this.shards.values()) {
      if (shard.keyRange.type === 'range') {
        if (key >= shard.keyRange.start && key < shard.keyRange.end) {
          return shard.id;
        }
      }
    }

    // Default to first shard
    return Array.from(this.shards.keys())[0];
  }

  /**
   * Directory-based shard selection
   */
  private getShardDirectory(key: string): string {
    const shardKey = this.keyDirectory.get(key);
    if (shardKey) {
      return shardKey.shard;
    }

    // Assign to least loaded shard
    const leastLoaded = Array.from(this.shards.values())
      .sort((a, b) => a.statistics.totalKeys - b.statistics.totalKeys)[0];

    const newShardKey: ShardKey = {
      value: key,
      shard: leastLoaded.id,
      replicas: this.selectReplicas(leastLoaded.id)
    };

    this.keyDirectory.set(key, newShardKey);
    return leastLoaded.id;
  }

  /**
   * Geo-based shard selection
   */
  private getShardGeo(key: string): string {
    // Extract geo info from key (simplified)
    const geoMatch = key.match(/^([a-z]{2}):/i);
    const region = geoMatch ? geoMatch[1].toLowerCase() : 'us';

    // Find shard in same region
    const regionShard = Array.from(this.shards.values())
      .find(s => s.name.toLowerCase().includes(region));

    return regionShard?.id || Array.from(this.shards.keys())[0];
  }

  /**
   * Select replica shards
   */
  private selectReplicas(primaryShardId: string): string[] {
    const replicas: string[] = [];
    const otherShards = Array.from(this.shards.values())
      .filter(s => s.id !== primaryShardId && s.status === 'online');

    for (let i = 0; i < Math.min(this.strategy.replicationFactor - 1, otherShards.length); i++) {
      replicas.push(otherShards[i].id);
    }

    return replicas;
  }

  /**
   * Hash function
   */
  private hash(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * Execute cross-shard query
   */
  public async executeCrossShardQuery(sql: string, shardIds?: string[]): Promise<CrossShardQuery> {
    const startTime = Date.now();
    const queryId = `xsq_${Date.now()}`;

    const targetShards = shardIds || Array.from(this.shards.keys());
    const results = new Map<string, any[]>();

    // Execute query on each shard in parallel
    const promises = targetShards.map(async (shardId) => {
      const shard = this.shards.get(shardId);
      if (!shard) return;

      try {
        const result = await this.executeOnShard(shard, sql);
        results.set(shardId, result);
      } catch (error) {
        this.emit('query:error', { shardId, error });
        results.set(shardId, []);
      }
    });

    await Promise.all(promises);

    // Aggregate results
    const aggregated = this.aggregateResults(sql, results);

    const query: CrossShardQuery = {
      id: queryId,
      sql,
      shards: targetShards,
      results,
      aggregated,
      executionTime: Date.now() - startTime
    };

    this.emit('query:completed', query);
    return query;
  }

  /**
   * Execute query on single shard
   */
  private async executeOnShard(shard: Shard, sql: string): Promise<any[]> {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));

    shard.statistics.queryCount++;

    return [
      { id: 1, data: `Result from ${shard.name}` },
      { id: 2, data: `More data from ${shard.name}` }
    ];
  }

  /**
   * Aggregate cross-shard results
   */
  private aggregateResults(sql: string, results: Map<string, any[]>): any[] {
    const allResults: any[] = [];

    for (const shardResults of results.values()) {
      allResults.push(...shardResults);
    }

    // Handle aggregation functions
    if (/count\s*\(/i.test(sql)) {
      return [{ count: allResults.length }];
    }

    if (/sum\s*\(/i.test(sql)) {
      const sum = allResults.reduce((acc, row) => acc + (row.value || 0), 0);
      return [{ sum }];
    }

    if (/avg\s*\(/i.test(sql)) {
      const sum = allResults.reduce((acc, row) => acc + (row.value || 0), 0);
      return [{ avg: sum / allResults.length }];
    }

    // Default: merge and return all results
    return allResults;
  }

  /**
   * Check if rebalancing needed
   */
  private needsRebalancing(): boolean {
    if (this.shards.size < 2) return false;

    const sizes = Array.from(this.shards.values()).map(s => s.statistics.totalKeys);
    const avg = sizes.reduce((sum, s) => sum + s, 0) / sizes.length;
    const maxDeviation = Math.max(...sizes.map(s => Math.abs(s - avg) / avg));

    return maxDeviation > this.strategy.rebalanceThreshold;
  }

  /**
   * Schedule rebalance
   */
  private scheduleRebalance(): void {
    setTimeout(() => this.rebalance(), 5000);
    this.emit('rebalance:scheduled');
  }

  /**
   * Rebalance shards
   */
  private async rebalance(): Promise<void> {
    this.emit('rebalance:started');

    const shards = Array.from(this.shards.values())
      .sort((a, b) => b.statistics.totalKeys - a.statistics.totalKeys);

    const mostLoaded = shards[0];
    const leastLoaded = shards[shards.length - 1];

    if (mostLoaded.statistics.totalKeys > leastLoaded.statistics.totalKeys * 1.5) {
      const task: RebalanceTask = {
        id: `rebal_${Date.now()}`,
        fromShard: mostLoaded.id,
        toShard: leastLoaded.id,
        keyRange: { start: '', end: '', type: 'hash' },
        status: 'pending',
        progress: 0,
        keysProcessed: 0,
        totalKeys: Math.floor(mostLoaded.statistics.totalKeys * 0.2)
      };

      this.rebalanceTasks.set(task.id, task);
      await this.executeRebalance(task);
    }

    this.emit('rebalance:completed');
  }

  /**
   * Execute rebalance task
   */
  private async executeRebalance(task: RebalanceTask): Promise<void> {
    task.status = 'running';
    task.startTime = new Date();

    const batchSize = 100;
    const batches = Math.ceil(task.totalKeys / batchSize);

    for (let i = 0; i < batches; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));

      task.keysProcessed += Math.min(batchSize, task.totalKeys - task.keysProcessed);
      task.progress = (task.keysProcessed / task.totalKeys) * 100;

      this.emit('rebalance:progress', task);
    }

    task.status = 'completed';
    task.endTime = new Date();
    task.progress = 100;

    // Update shard statistics
    const fromShard = this.shards.get(task.fromShard);
    const toShard = this.shards.get(task.toShard);

    if (fromShard && toShard) {
      fromShard.statistics.totalKeys -= task.totalKeys;
      toShard.statistics.totalKeys += task.totalKeys;
    }
  }

  /**
   * Migrate shard data
   */
  private async migrateShard(shardId: string): Promise<void> {
    const shard = this.shards.get(shardId);
    if (!shard) return;

    const targetShards = Array.from(this.shards.values())
      .filter(s => s.id !== shardId && s.status === 'online');

    if (targetShards.length === 0) {
      throw new Error('No target shards available for migration');
    }

    const keysPerShard = Math.ceil(shard.statistics.totalKeys / targetShards.length);

    for (let i = 0; i < targetShards.length; i++) {
      const task: RebalanceTask = {
        id: `migrate_${Date.now()}_${i}`,
        fromShard: shardId,
        toShard: targetShards[i].id,
        keyRange: { start: '', end: '', type: 'hash' },
        status: 'pending',
        progress: 0,
        keysProcessed: 0,
        totalKeys: keysPerShard
      };

      await this.executeRebalance(task);
    }

    this.emit('shard:migrated', shardId);
  }

  /**
   * Health check all shards
   */
  public async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const shard of this.shards.values()) {
      try {
        await this.executeOnShard(shard, 'SELECT 1');
        shard.status = 'online';
        shard.statistics.lastHealthCheck = new Date();
        results.set(shard.id, true);
      } catch (error) {
        shard.status = 'offline';
        results.set(shard.id, false);
        this.emit('shard:unhealthy', { shard, error });
      }
    }

    return results;
  }

  /**
   * Get shard statistics
   */
  public getStatistics(): any {
    const shards = Array.from(this.shards.values());

    return {
      totalShards: shards.length,
      onlineShards: shards.filter(s => s.status === 'online').length,
      totalKeys: shards.reduce((sum, s) => sum + s.statistics.totalKeys, 0),
      totalSize: shards.reduce((sum, s) => sum + s.statistics.totalSize, 0),
      avgLatency: shards.reduce((sum, s) => sum + s.statistics.avgLatency, 0) / shards.length,
      distribution: shards.map(s => ({
        id: s.id,
        name: s.name,
        keys: s.statistics.totalKeys,
        size: s.statistics.totalSize,
        status: s.status
      }))
    };
  }

  /**
   * Get shard by ID
   */
  public getShard(shardId: string): Shard | null {
    return this.shards.get(shardId) || null;
  }

  /**
   * List all shards
   */
  public listShards(): Shard[] {
    return Array.from(this.shards.values());
  }

  /**
   * Get rebalance tasks
   */
  public getRebalanceTasks(): RebalanceTask[] {
    return Array.from(this.rebalanceTasks.values());
  }
}

export default ShardingManager;
