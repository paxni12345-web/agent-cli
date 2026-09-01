"use strict";
/**
 * Advanced Caching System
 * Multi-tier caching, cache invalidation, distributed cache, and cache warming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributedCacheManager = exports.cacheWarmerManager = exports.multiTierCacheManager = exports.cacheManager = exports.DistributedCacheManager = exports.CacheWarmerManager = exports.MultiTierCacheManager = exports.CacheManager = exports.OperationStatus = exports.OperationType = exports.NodeStatus = exports.EvictionPolicy = void 0;
const EventBus_1 = require("../core/EventBus");
var EvictionPolicy;
(function (EvictionPolicy) {
    EvictionPolicy["LRU"] = "lru";
    EvictionPolicy["LFU"] = "lfu";
    EvictionPolicy["FIFO"] = "fifo";
    EvictionPolicy["TTL"] = "ttl";
})(EvictionPolicy || (exports.EvictionPolicy = EvictionPolicy = {}));
var NodeStatus;
(function (NodeStatus) {
    NodeStatus["Active"] = "active";
    NodeStatus["Syncing"] = "syncing";
    NodeStatus["Failed"] = "failed";
})(NodeStatus || (exports.NodeStatus = NodeStatus = {}));
var OperationType;
(function (OperationType) {
    OperationType["Get"] = "get";
    OperationType["Set"] = "set";
    OperationType["Delete"] = "delete";
    OperationType["Clear"] = "clear";
    OperationType["Invalidate"] = "invalidate";
})(OperationType || (exports.OperationType = OperationType = {}));
var OperationStatus;
(function (OperationStatus) {
    OperationStatus["Success"] = "success";
    OperationStatus["Miss"] = "miss";
    OperationStatus["Error"] = "error";
})(OperationStatus || (exports.OperationStatus = OperationStatus = {}));
/**
 * Cache Manager
 */
class CacheManager {
    cache = new Map();
    config;
    statistics;
    accessOrder = [];
    operations = new Map();
    constructor(config = {}) {
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
    async get(key) {
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
        EventBus_1.eventBus.emitSync('cache.hit', { key }, 'CacheManager');
        return entry.value;
    }
    /**
     * Set value in cache
     */
    async set(key, value, options = {}) {
        const operation = this.recordOperation(OperationType.Set, key);
        const startTime = Date.now();
        const size = this.calculateSize(value);
        const ttl = options.ttl ?? this.config.defaultTTL;
        // Check if we need to evict
        while (this.shouldEvict(size)) {
            this.evict();
        }
        const entry = {
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
        EventBus_1.eventBus.emitSync('cache.set', { key, size }, 'CacheManager');
    }
    /**
     * Delete from cache
     */
    async delete(key) {
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
        EventBus_1.eventBus.emitSync('cache.deleted', { key }, 'CacheManager');
        return true;
    }
    /**
     * Clear cache
     */
    async clear() {
        const operation = this.recordOperation(OperationType.Clear, '*');
        this.cache.clear();
        this.accessOrder = [];
        this.statistics.entries = 0;
        this.statistics.size = 0;
        operation.status = OperationStatus.Success;
        EventBus_1.eventBus.emitSync('cache.cleared', {}, 'CacheManager');
    }
    /**
     * Check if key exists
     */
    async has(key) {
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
    async getMany(keys) {
        const result = new Map();
        for (const key of keys) {
            const value = await this.get(key);
            if (value !== null) {
                result.set(key, value);
            }
        }
        return result;
    }
    /**
     * Set multiple keys
     */
    async setMany(entries, options = {}) {
        for (const [key, value] of entries) {
            await this.set(key, value, options);
        }
    }
    /**
     * Query cache entries
     */
    query(query) {
        let entries = Array.from(this.cache.values());
        if (query.tags && query.tags.length > 0) {
            entries = entries.filter(e => query.tags.some(tag => e.tags.includes(tag)));
        }
        if (query.pattern) {
            const regex = new RegExp(query.pattern);
            entries = entries.filter(e => regex.test(e.key));
        }
        if (query.minHits !== undefined) {
            entries = entries.filter(e => e.hits >= query.minHits);
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
    async invalidateByTags(tags) {
        const operation = this.recordOperation(OperationType.Invalidate, `tags:${tags.join(',')}`);
        let count = 0;
        for (const [key, entry] of this.cache) {
            if (tags.some(tag => entry.tags.includes(tag))) {
                await this.delete(key);
                count++;
            }
        }
        operation.status = OperationStatus.Success;
        EventBus_1.eventBus.emitSync('cache.invalidated', { tags, count }, 'CacheManager');
        return count;
    }
    /**
     * Invalidate by pattern
     */
    async invalidateByPattern(pattern) {
        const operation = this.recordOperation(OperationType.Invalidate, `pattern:${pattern}`);
        const regex = new RegExp(pattern);
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            await this.delete(key);
        }
        operation.status = OperationStatus.Success;
        EventBus_1.eventBus.emitSync('cache.invalidated', { pattern, count: keysToDelete.length }, 'CacheManager');
        return keysToDelete.length;
    }
    /**
     * Get statistics
     */
    getStatistics() {
        return { ...this.statistics };
    }
    /**
     * Get entry metadata
     */
    getEntry(key) {
        return this.cache.get(key);
    }
    /**
     * List all keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    shouldEvict(newSize) {
        return (this.statistics.entries >= this.config.maxEntries ||
            this.statistics.size + newSize > this.config.maxSize);
    }
    evict() {
        let keyToEvict;
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
    findLFUKey() {
        let minHits = Infinity;
        let keyToEvict;
        for (const [key, entry] of this.cache) {
            if (entry.hits < minHits) {
                minHits = entry.hits;
                keyToEvict = key;
            }
        }
        return keyToEvict;
    }
    findOldestKey() {
        let oldest;
        let keyToEvict;
        for (const [key, entry] of this.cache) {
            if (!oldest || entry.createdAt < oldest) {
                oldest = entry.createdAt;
                keyToEvict = key;
            }
        }
        return keyToEvict;
    }
    findExpiredKey() {
        const now = new Date();
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt && entry.expiresAt < now) {
                return key;
            }
        }
        return this.findOldestKey();
    }
    updateAccessOrder(key) {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }
    removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }
    calculateSize(value) {
        return JSON.stringify(value).length;
    }
    updateHitRate() {
        const total = this.statistics.hits + this.statistics.misses;
        this.statistics.hitRate = total > 0 ? (this.statistics.hits / total) * 100 : 0;
    }
    recordOperation(type, key) {
        const operation = {
            id: this.generateOperationId(),
            type,
            key,
            status: OperationStatus.Success,
            timestamp: new Date(),
        };
        this.operations.set(operation.id, operation);
        return operation;
    }
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.CacheManager = CacheManager;
/**
 * Multi-Tier Cache Manager
 */
class MultiTierCacheManager {
    tiers = [];
    /**
     * Add tier
     */
    addTier(name, config = {}) {
        const tier = {
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
        EventBus_1.eventBus.emitSync('cache.tier_added', tier, 'MultiTierCacheManager');
        return tier;
    }
    /**
     * Get from cache (checks all tiers)
     */
    async get(key) {
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
            }
            else {
                tier.statistics.misses++;
            }
        }
        return null;
    }
    /**
     * Set in cache (writes to all tiers)
     */
    async set(key, value, options = {}) {
        for (const tier of this.tiers) {
            const size = JSON.stringify(value).length;
            const ttl = options.ttl ?? tier.config.defaultTTL;
            const entry = {
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
        EventBus_1.eventBus.emitSync('cache.multi_tier_set', { key }, 'MultiTierCacheManager');
    }
    /**
     * Delete from all tiers
     */
    async delete(key) {
        for (const tier of this.tiers) {
            const entry = tier.cache.get(key);
            if (entry) {
                tier.cache.delete(key);
                tier.statistics.entries--;
                tier.statistics.size -= entry.size;
            }
        }
        EventBus_1.eventBus.emitSync('cache.multi_tier_deleted', { key }, 'MultiTierCacheManager');
    }
    /**
     * Get tier
     */
    getTier(name) {
        return this.tiers.find(t => t.name === name);
    }
    /**
     * List tiers
     */
    listTiers() {
        return [...this.tiers];
    }
    /**
     * Get statistics for all tiers
     */
    getStatistics() {
        const stats = {};
        for (const tier of this.tiers) {
            stats[tier.name] = { ...tier.statistics };
        }
        return stats;
    }
    async promote(key, entry, fromLevel) {
        for (let i = 0; i < fromLevel; i++) {
            const tier = this.tiers[i];
            tier.cache.set(key, { ...entry });
            tier.statistics.entries++;
            tier.statistics.size += entry.size;
        }
    }
}
exports.MultiTierCacheManager = MultiTierCacheManager;
/**
 * Cache Warmer
 */
class CacheWarmerManager {
    warmers = new Map();
    cacheManager;
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
    }
    /**
     * Register warmer
     */
    registerWarmer(warmer) {
        const fullWarmer = {
            ...warmer,
            id: this.generateWarmerId(),
        };
        this.warmers.set(fullWarmer.id, fullWarmer);
        EventBus_1.eventBus.emitSync('cache.warmer_registered', fullWarmer, 'CacheWarmerManager');
        return fullWarmer;
    }
    /**
     * Run warmer
     */
    async runWarmer(warmerId) {
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
            }
            catch (error) {
                // Log error but continue
            }
        }
        warmer.lastRun = new Date();
        EventBus_1.eventBus.emitSync('cache.warmer_completed', { warmerId, count }, 'CacheWarmerManager');
        return count;
    }
    /**
     * Run all warmers
     */
    async runAllWarmers() {
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
    getWarmer(warmerId) {
        return this.warmers.get(warmerId);
    }
    /**
     * List warmers
     */
    listWarmers() {
        return Array.from(this.warmers.values());
    }
    generateWarmerId() {
        return `warmer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.CacheWarmerManager = CacheWarmerManager;
/**
 * Distributed Cache Manager
 */
class DistributedCacheManager {
    nodes = new Map();
    localCache;
    constructor(localCache) {
        this.localCache = localCache;
    }
    /**
     * Add node
     */
    addNode(node) {
        const fullNode = {
            ...node,
            id: this.generateNodeId(),
            status: NodeStatus.Active,
            load: 0,
            keys: new Set(),
            lastHeartbeat: new Date(),
        };
        this.nodes.set(fullNode.id, fullNode);
        EventBus_1.eventBus.emitSync('cache.node_added', fullNode, 'DistributedCacheManager');
        return fullNode;
    }
    /**
     * Get from distributed cache
     */
    async get(key) {
        // Try local cache first
        const localValue = await this.localCache.get(key);
        if (localValue !== null) {
            return localValue;
        }
        // Find node with key
        const node = this.findNodeWithKey(key);
        if (node) {
            // Mock remote fetch
            const value = await this.fetchFromNode(node, key);
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
    async set(key, value, options = {}) {
        // Set in local cache
        await this.localCache.set(key, value, options);
        // Distribute to nodes
        const node = this.selectNode(key);
        if (node) {
            node.keys.add(key);
            node.load = node.keys.size;
        }
        EventBus_1.eventBus.emitSync('cache.distributed_set', { key, nodeId: node?.id }, 'DistributedCacheManager');
    }
    /**
     * Delete from distributed cache
     */
    async delete(key) {
        await this.localCache.delete(key);
        for (const node of this.nodes.values()) {
            node.keys.delete(key);
            node.load = node.keys.size;
        }
        EventBus_1.eventBus.emitSync('cache.distributed_deleted', { key }, 'DistributedCacheManager');
    }
    /**
     * Get node
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    /**
     * List nodes
     */
    listNodes() {
        return Array.from(this.nodes.values());
    }
    /**
     * Remove node
     */
    removeNode(nodeId) {
        this.nodes.delete(nodeId);
        EventBus_1.eventBus.emitSync('cache.node_removed', { nodeId }, 'DistributedCacheManager');
    }
    selectNode(key) {
        // Simple hash-based selection
        const activeNodes = Array.from(this.nodes.values()).filter(n => n.status === NodeStatus.Active);
        if (activeNodes.length === 0) {
            return undefined;
        }
        const hash = this.hashKey(key);
        return activeNodes[hash % activeNodes.length];
    }
    findNodeWithKey(key) {
        for (const node of this.nodes.values()) {
            if (node.keys.has(key)) {
                return node;
            }
        }
        return undefined;
    }
    async fetchFromNode(node, key) {
        // Mock remote fetch
        await new Promise(resolve => setTimeout(resolve, 10));
        return null;
    }
    hashKey(key) {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DistributedCacheManager = DistributedCacheManager;
/**
 * Singleton instances
 */
exports.cacheManager = new CacheManager();
exports.multiTierCacheManager = new MultiTierCacheManager();
exports.cacheWarmerManager = new CacheWarmerManager(exports.cacheManager);
exports.distributedCacheManager = new DistributedCacheManager(exports.cacheManager);
