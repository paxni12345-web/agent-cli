"use strict";
/**
 * Advanced Caching System
 * Multi-tier caching with Redis, memory, distributed cache support
 * Cache warming, invalidation strategies, TTL management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const events_1 = require("events");
// ============================================================================
// Cache Manager
// ============================================================================
class CacheManager extends events_1.EventEmitter {
    config;
    memoryCache = new Map();
    layers = new Map();
    patterns = new Map();
    warmingStrategies = new Map();
    invalidationRules = new Map();
    operations = [];
    lruList = [];
    lfuMap = new Map();
    currentMemorySize = 0;
    constructor(config = {}) {
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
    async get(key) {
        const startTime = Date.now();
        let hit = false;
        let layer = 'memory';
        try {
            // Try memory cache first
            if (this.config.enableMemoryCache) {
                const entry = this.memoryCache.get(key);
                if (entry && !this.isExpired(entry)) {
                    this.updateAccessMetadata(entry);
                    this.recordOperation('get', key, 'memory', Date.now() - startTime, true);
                    hit = true;
                    return entry.value;
                }
            }
            // Try Redis cache
            if (this.config.enableRedisCache) {
                const value = await this.getFromRedis(key);
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
                const value = await this.getFromDistributed(key);
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
        }
        catch (error) {
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
    async set(key, value, options = {}) {
        const startTime = Date.now();
        try {
            const ttl = options.ttl || this.config.defaultTTL;
            const tags = new Set(options.tags || []);
            const compressed = this.shouldCompress(value);
            const entry = {
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
        }
        catch (error) {
            this.emit('cache:error', { operation: 'set', key, error });
            throw error;
        }
    }
    async delete(key) {
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
        }
        catch (error) {
            this.emit('cache:error', { operation: 'delete', key, error });
            throw error;
        }
    }
    async clear(pattern) {
        try {
            if (pattern) {
                const regex = new RegExp(pattern);
                const keysToDelete = Array.from(this.memoryCache.keys()).filter(k => regex.test(k));
                for (const key of keysToDelete) {
                    await this.delete(key);
                }
            }
            else {
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
        }
        catch (error) {
            this.emit('cache:error', { operation: 'clear', error });
            throw error;
        }
    }
    // ========================================================================
    // Memory Cache Operations
    // ========================================================================
    async setInMemory(key, entry) {
        // Check if we need to evict
        while (this.currentMemorySize + entry.size > this.config.maxMemorySize &&
            this.memoryCache.size > 0) {
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
    async evict() {
        let keyToEvict;
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
    updateEvictionStructures(key) {
        // Update LRU
        this.lruList = this.lruList.filter(k => k !== key);
        this.lruList.push(key);
        // Update LFU
        this.lfuMap.set(key, (this.lfuMap.get(key) || 0) + 1);
    }
    findLFUKey() {
        let minFreq = Infinity;
        let lfuKey;
        for (const [key, freq] of this.lfuMap.entries()) {
            if (freq < minFreq) {
                minFreq = freq;
                lfuKey = key;
            }
        }
        return lfuKey;
    }
    findExpiringSoonestKey() {
        let earliestExpiry = Infinity;
        let ttlKey;
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
    async getFromRedis(key) {
        // Simulate Redis get - implement actual Redis in production
        this.emit('redis:get', { key });
        return null;
    }
    async setInRedis(key, entry) {
        // Simulate Redis set - implement actual Redis in production
        this.emit('redis:set', { key });
    }
    async deleteFromRedis(key) {
        // Simulate Redis delete - implement actual Redis in production
        this.emit('redis:delete', { key });
    }
    async clearRedis() {
        // Simulate Redis clear - implement actual Redis in production
        this.emit('redis:clear');
    }
    // ========================================================================
    // Distributed Cache Operations
    // ========================================================================
    async getFromDistributed(key) {
        // Simulate distributed cache get - implement actual distributed cache in production
        this.emit('distributed:get', { key });
        return null;
    }
    async setInDistributed(key, entry) {
        // Simulate distributed cache set - implement actual distributed cache in production
        this.emit('distributed:set', { key });
    }
    async deleteFromDistributed(key) {
        // Simulate distributed cache delete - implement actual distributed cache in production
        this.emit('distributed:delete', { key });
    }
    async clearDistributed() {
        // Simulate distributed cache clear - implement actual distributed cache in production
        this.emit('distributed:clear');
    }
    // ========================================================================
    // Cache Warming
    // ========================================================================
    registerWarmingStrategy(strategy) {
        const full = {
            ...strategy,
            id: this.generateId(),
        };
        this.warmingStrategies.set(full.id, full);
        this.emit('warming:registered', { strategy: full });
        return full;
    }
    async warmCache(strategyId) {
        const strategies = strategyId
            ? [this.warmingStrategies.get(strategyId)].filter(Boolean)
            : Array.from(this.warmingStrategies.values()).filter(s => s.enabled);
        for (const strategy of strategies) {
            try {
                const data = await strategy.loader();
                for (const [key, value] of data.entries()) {
                    await this.set(key, value);
                }
                this.emit('warming:completed', { strategy });
            }
            catch (error) {
                this.emit('warming:error', { strategy, error });
            }
        }
    }
    // ========================================================================
    // Cache Invalidation
    // ========================================================================
    registerInvalidationRule(rule) {
        const full = {
            ...rule,
            id: this.generateId(),
        };
        this.invalidationRules.set(full.id, full);
        this.emit('invalidation:rule:registered', { rule: full });
        return full;
    }
    async invalidate(key, cascading = true) {
        await this.delete(key);
        if (cascading) {
            // Find and invalidate dependent keys
            for (const rule of this.invalidationRules.values()) {
                if (rule.cascading && rule.dependencies.includes(key)) {
                    const keysToInvalidate = Array.from(this.memoryCache.keys()).filter(k => rule.pattern.test(k));
                    for (const dependentKey of keysToInvalidate) {
                        await this.delete(dependentKey);
                    }
                }
            }
        }
        this.emit('cache:invalidate', { key, cascading });
    }
    async invalidateByTag(tag) {
        const keysToInvalidate = [];
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
    async invalidateByPattern(pattern) {
        const regex = new RegExp(pattern);
        const keysToInvalidate = Array.from(this.memoryCache.keys()).filter(k => regex.test(k));
        for (const key of keysToInvalidate) {
            await this.delete(key);
        }
        this.emit('cache:invalidate:pattern', { pattern, count: keysToInvalidate.length });
    }
    // ========================================================================
    // Cache Patterns
    // ========================================================================
    registerPattern(pattern) {
        this.patterns.set(pattern.pattern, pattern);
        this.emit('pattern:registered', { pattern });
    }
    getPatternForKey(key) {
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
    shouldCompress(value) {
        if (!this.config.enableCompression)
            return false;
        const size = this.calculateSize(value);
        return size > this.config.compressionThreshold;
    }
    compress(value) {
        // Simplified compression - use proper compression in production (e.g., zlib)
        const json = JSON.stringify(value);
        return {
            __compressed: true,
            data: Buffer.from(json).toString('base64'),
        };
    }
    decompress(value) {
        if (!value || !value.__compressed)
            return value;
        const json = Buffer.from(value.data, 'base64').toString();
        return JSON.parse(json);
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    initializeLayers() {
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
    isExpired(entry) {
        if (!entry.metadata.expiresAt)
            return false;
        return Date.now() > entry.metadata.expiresAt;
    }
    updateAccessMetadata(entry) {
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
    recordOperation(type, key, layer, duration, hit) {
        try {
            const operation = {
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
                }
                else {
                    layerObj.stats.misses++;
                }
            }
        }
        catch (error) {
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
    calculateSize(value) {
        // Simplified size calculation
        const json = JSON.stringify(value);
        return Buffer.byteLength(json, 'utf8');
    }
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpired();
        }, 60000); // Every minute
    }
    cleanupExpired() {
        const expiredKeys = [];
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
    generateId() {
        return `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    // ========================================================================
    // Batch Operations
    // ========================================================================
    async getMany(keys) {
        const results = new Map();
        await Promise.all(keys.map(async (key) => {
            const value = await this.get(key);
            if (value !== null) {
                results.set(key, value);
            }
        }));
        return results;
    }
    async setMany(entries, options = {}) {
        await Promise.all(Array.from(entries.entries()).map(([key, value]) => this.set(key, value, options)));
    }
    async deleteMany(keys) {
        await Promise.all(keys.map(key => this.delete(key)));
    }
    // ========================================================================
    // Statistics & Monitoring
    // ========================================================================
    getStats() {
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
    getLayerStats(type) {
        return this.layers.get(type)?.stats;
    }
    getRecentOperations(count = 100) {
        return this.operations.slice(-count);
    }
    // ========================================================================
    // Advanced Features
    // ========================================================================
    async getOrSet(key, loader, options = {}) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await loader();
        await this.set(key, value, options);
        return value;
    }
    async memoize(fn, keyGenerator, options = {}) {
        return async (...args) => {
            const key = keyGenerator(...args);
            return this.getOrSet(key, () => fn(...args), options);
        };
    }
    async touch(key, ttl) {
        const entry = this.memoryCache.get(key);
        if (entry) {
            if (ttl) {
                entry.metadata.expiresAt = Date.now() + ttl;
                entry.metadata.ttl = ttl;
            }
            this.updateAccessMetadata(entry);
        }
    }
    async exists(key) {
        const entry = this.memoryCache.get(key);
        return entry ? !this.isExpired(entry) : false;
    }
    async ttl(key) {
        const entry = this.memoryCache.get(key);
        if (!entry || !entry.metadata.expiresAt)
            return null;
        const remaining = entry.metadata.expiresAt - Date.now();
        return remaining > 0 ? remaining : null;
    }
    async keys(pattern) {
        const allKeys = Array.from(this.memoryCache.keys());
        if (!pattern)
            return allKeys;
        const regex = new RegExp(pattern);
        return allKeys.filter(k => regex.test(k));
    }
}
exports.CacheManager = CacheManager;
// ============================================================================
// Export
// ============================================================================
exports.default = CacheManager;
