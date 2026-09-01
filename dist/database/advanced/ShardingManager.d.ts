/**
 * ShardingManager - Horizontal database sharding management
 * Handles consistent hashing, shard rebalancing, and cross-shard queries
 */
import { EventEmitter } from 'events';
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
export declare class ShardingManager extends EventEmitter {
    private shards;
    private strategy;
    private hashRing;
    private rebalanceTasks;
    private keyDirectory;
    constructor(strategy?: Partial<ShardingStrategy>);
    /**
     * Add shard to cluster
     */
    addShard(shard: Shard): void;
    /**
     * Remove shard from cluster
     */
    removeShard(shardId: string): Promise<void>;
    /**
     * Add shard to consistent hash ring
     */
    private addToHashRing;
    /**
     * Remove shard from hash ring
     */
    private removeFromHashRing;
    /**
     * Get shard for key using consistent hashing
     */
    getShardForKey(key: string): string;
    /**
     * Consistent hash shard selection
     */
    private getShardConsistentHash;
    /**
     * Range-based shard selection
     */
    private getShardRange;
    /**
     * Directory-based shard selection
     */
    private getShardDirectory;
    /**
     * Geo-based shard selection
     */
    private getShardGeo;
    /**
     * Select replica shards
     */
    private selectReplicas;
    /**
     * Hash function
     */
    private hash;
    /**
     * Execute cross-shard query
     */
    executeCrossShardQuery(sql: string, shardIds?: string[]): Promise<CrossShardQuery>;
    /**
     * Execute query on single shard
     */
    private executeOnShard;
    /**
     * Aggregate cross-shard results
     */
    private aggregateResults;
    /**
     * Check if rebalancing needed
     */
    private needsRebalancing;
    /**
     * Schedule rebalance
     */
    private scheduleRebalance;
    /**
     * Rebalance shards
     */
    private rebalance;
    /**
     * Execute rebalance task
     */
    private executeRebalance;
    /**
     * Migrate shard data
     */
    private migrateShard;
    /**
     * Health check all shards
     */
    healthCheck(): Promise<Map<string, boolean>>;
    /**
     * Get shard statistics
     */
    getStatistics(): any;
    /**
     * Get shard by ID
     */
    getShard(shardId: string): Shard | null;
    /**
     * List all shards
     */
    listShards(): Shard[];
    /**
     * Get rebalance tasks
     */
    getRebalanceTasks(): RebalanceTask[];
}
export default ShardingManager;
//# sourceMappingURL=ShardingManager.d.ts.map