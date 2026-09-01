"use strict";
/**
 * ShardingManager - Horizontal database sharding management
 * Handles consistent hashing, shard rebalancing, and cross-shard queries
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShardingManager = void 0;
const events_1 = require("events");
const crypto = __importStar(require("crypto"));
class ShardingManager extends events_1.EventEmitter {
    shards = new Map();
    strategy;
    hashRing = new Map();
    rebalanceTasks = new Map();
    keyDirectory = new Map();
    constructor(strategy) {
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
    addShard(shard) {
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
    async removeShard(shardId) {
        const shard = this.shards.get(shardId);
        if (!shard)
            throw new Error(`Shard ${shardId} not found`);
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
    addToHashRing(shard) {
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
    removeFromHashRing(shard) {
        const keysToRemove = [];
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
    getShardForKey(key) {
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
    getShardConsistentHash(key) {
        const keyHash = this.hash(key);
        const ringKeys = Array.from(this.hashRing.keys());
        // Find first hash >= key hash
        for (const ringHash of ringKeys) {
            if (ringHash >= keyHash) {
                return this.hashRing.get(ringHash);
            }
        }
        // Wrap around to first shard
        return this.hashRing.get(ringKeys[0]);
    }
    /**
     * Range-based shard selection
     */
    getShardRange(key) {
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
    getShardDirectory(key) {
        const shardKey = this.keyDirectory.get(key);
        if (shardKey) {
            return shardKey.shard;
        }
        // Assign to least loaded shard
        const leastLoaded = Array.from(this.shards.values())
            .sort((a, b) => a.statistics.totalKeys - b.statistics.totalKeys)[0];
        const newShardKey = {
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
    getShardGeo(key) {
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
    selectReplicas(primaryShardId) {
        const replicas = [];
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
    hash(key) {
        return crypto.createHash('md5').update(key).digest('hex');
    }
    /**
     * Execute cross-shard query
     */
    async executeCrossShardQuery(sql, shardIds) {
        const startTime = Date.now();
        const queryId = `xsq_${Date.now()}`;
        const targetShards = shardIds || Array.from(this.shards.keys());
        const results = new Map();
        // Execute query on each shard in parallel
        const promises = targetShards.map(async (shardId) => {
            const shard = this.shards.get(shardId);
            if (!shard)
                return;
            try {
                const result = await this.executeOnShard(shard, sql);
                results.set(shardId, result);
            }
            catch (error) {
                this.emit('query:error', { shardId, error });
                results.set(shardId, []);
            }
        });
        await Promise.all(promises);
        // Aggregate results
        const aggregated = this.aggregateResults(sql, results);
        const query = {
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
    async executeOnShard(shard, sql) {
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
    aggregateResults(sql, results) {
        const allResults = [];
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
    needsRebalancing() {
        if (this.shards.size < 2)
            return false;
        const sizes = Array.from(this.shards.values()).map(s => s.statistics.totalKeys);
        const avg = sizes.reduce((sum, s) => sum + s, 0) / sizes.length;
        const maxDeviation = Math.max(...sizes.map(s => Math.abs(s - avg) / avg));
        return maxDeviation > this.strategy.rebalanceThreshold;
    }
    /**
     * Schedule rebalance
     */
    scheduleRebalance() {
        setTimeout(() => this.rebalance(), 5000);
        this.emit('rebalance:scheduled');
    }
    /**
     * Rebalance shards
     */
    async rebalance() {
        this.emit('rebalance:started');
        const shards = Array.from(this.shards.values())
            .sort((a, b) => b.statistics.totalKeys - a.statistics.totalKeys);
        const mostLoaded = shards[0];
        const leastLoaded = shards[shards.length - 1];
        if (mostLoaded.statistics.totalKeys > leastLoaded.statistics.totalKeys * 1.5) {
            const task = {
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
    async executeRebalance(task) {
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
    async migrateShard(shardId) {
        const shard = this.shards.get(shardId);
        if (!shard)
            return;
        const targetShards = Array.from(this.shards.values())
            .filter(s => s.id !== shardId && s.status === 'online');
        if (targetShards.length === 0) {
            throw new Error('No target shards available for migration');
        }
        const keysPerShard = Math.ceil(shard.statistics.totalKeys / targetShards.length);
        for (let i = 0; i < targetShards.length; i++) {
            const task = {
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
    async healthCheck() {
        const results = new Map();
        for (const shard of this.shards.values()) {
            try {
                await this.executeOnShard(shard, 'SELECT 1');
                shard.status = 'online';
                shard.statistics.lastHealthCheck = new Date();
                results.set(shard.id, true);
            }
            catch (error) {
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
    getStatistics() {
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
    getShard(shardId) {
        return this.shards.get(shardId) || null;
    }
    /**
     * List all shards
     */
    listShards() {
        return Array.from(this.shards.values());
    }
    /**
     * Get rebalance tasks
     */
    getRebalanceTasks() {
        return Array.from(this.rebalanceTasks.values());
    }
}
exports.ShardingManager = ShardingManager;
exports.default = ShardingManager;
