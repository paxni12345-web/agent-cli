"use strict";
/**
 * PHASE 7: MARKETPLACE & PLUGIN ECOSYSTEM
 * Plugin management, marketplace, and extension system
 *
 * Part of 350K lines goal - PHASE 7
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceManager = void 0;
const events_1 = require("events");
// ============================================================================
// Marketplace Manager
// ============================================================================
class MarketplaceManager extends events_1.EventEmitter {
    config;
    plugins = new Map();
    installed = new Map();
    reviews = new Map();
    purchases = new Map();
    collections = new Map();
    revenue = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            enablePublishing: true,
            enableReviews: true,
            enablePurchases: true,
            moderationRequired: true,
            commissionRate: 0.3, // 30%
            ...config,
        };
    }
    // ========================================================================
    // Plugin Publishing
    // ========================================================================
    async publishPlugin(plugin) {
        const fullPlugin = {
            id: this.generateId(),
            ...plugin,
            statistics: {
                downloads: 0,
                activeInstalls: 0,
                rating: 0,
                reviews: 0,
                lastWeekDownloads: 0,
            },
            status: this.config.moderationRequired ? 'pending' : 'published',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.plugins.set(fullPlugin.id, fullPlugin);
        this.reviews.set(fullPlugin.id, []);
        this.emit('plugin:published', { pluginId: fullPlugin.id });
        return fullPlugin;
    }
    async updatePlugin(pluginId, updates) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error('Plugin not found');
        }
        Object.assign(plugin, updates);
        plugin.updatedAt = new Date();
        this.emit('plugin:updated', { pluginId });
        return plugin;
    }
    async approvePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error('Plugin not found');
        }
        plugin.status = 'published';
        plugin.updatedAt = new Date();
        this.emit('plugin:approved', { pluginId });
    }
    // ========================================================================
    // Plugin Discovery & Search
    // ========================================================================
    searchPlugins(query, filters) {
        let results = Array.from(this.plugins.values());
        // Filter by status
        results = results.filter(p => p.status === 'published');
        // Text search
        if (query) {
            results = results.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) ||
                p.description.toLowerCase().includes(query.toLowerCase()) ||
                p.tags.some(t => t.toLowerCase().includes(query.toLowerCase())));
        }
        // Apply filters
        if (filters) {
            if (filters.category) {
                results = results.filter(p => p.category === filters.category);
            }
            if (filters.priceType) {
                results = results.filter(p => p.price.type === filters.priceType);
            }
            if (filters.minRating) {
                results = results.filter(p => p.statistics.rating >= filters.minRating);
            }
        }
        // Sort
        if (filters?.sortBy) {
            results = this.sortPlugins(results, filters.sortBy);
        }
        return results;
    }
    sortPlugins(plugins, sortBy) {
        switch (sortBy) {
            case 'downloads':
                return plugins.sort((a, b) => b.statistics.downloads - a.statistics.downloads);
            case 'rating':
                return plugins.sort((a, b) => b.statistics.rating - a.statistics.rating);
            case 'recent':
                return plugins.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            case 'name':
                return plugins.sort((a, b) => a.name.localeCompare(b.name));
            default:
                return plugins;
        }
    }
    getFeaturedPlugins() {
        return Array.from(this.plugins.values())
            .filter(p => p.status === 'published')
            .filter(p => p.statistics.rating >= 4.5)
            .slice(0, 10);
    }
    getTrendingPlugins() {
        return Array.from(this.plugins.values())
            .filter(p => p.status === 'published')
            .sort((a, b) => b.statistics.lastWeekDownloads - a.statistics.lastWeekDownloads)
            .slice(0, 10);
    }
    // ========================================================================
    // Plugin Installation & Management
    // ========================================================================
    async installPlugin(pluginId, userId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error('Plugin not found');
        }
        // Check if purchase required
        if (plugin.price.type !== 'free') {
            const hasPurchase = await this.verifyPurchase(pluginId, userId);
            if (!hasPurchase) {
                throw new Error('Plugin must be purchased first');
            }
        }
        const installed = {
            plugin,
            version: plugin.version,
            enabled: true,
            autoUpdate: true,
            installedAt: new Date(),
            settings: {},
        };
        this.installed.set(`${userId}:${pluginId}`, installed);
        // Update statistics
        plugin.statistics.downloads++;
        plugin.statistics.activeInstalls++;
        this.emit('plugin:installed', { pluginId, userId });
        return installed;
    }
    async uninstallPlugin(pluginId, userId) {
        const key = `${userId}:${pluginId}`;
        const installed = this.installed.get(key);
        if (!installed) {
            throw new Error('Plugin not installed');
        }
        this.installed.delete(key);
        // Update statistics
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.statistics.activeInstalls--;
        }
        this.emit('plugin:uninstalled', { pluginId, userId });
    }
    enablePlugin(pluginId, userId) {
        const key = `${userId}:${pluginId}`;
        const installed = this.installed.get(key);
        if (!installed) {
            throw new Error('Plugin not installed');
        }
        installed.enabled = true;
        this.emit('plugin:enabled', { pluginId, userId });
    }
    disablePlugin(pluginId, userId) {
        const key = `${userId}:${pluginId}`;
        const installed = this.installed.get(key);
        if (!installed) {
            throw new Error('Plugin not installed');
        }
        installed.enabled = false;
        this.emit('plugin:disabled', { pluginId, userId });
    }
    // ========================================================================
    // Reviews & Ratings
    // ========================================================================
    async submitReview(review) {
        const plugin = this.plugins.get(review.pluginId);
        if (!plugin) {
            throw new Error('Plugin not found');
        }
        const fullReview = {
            id: this.generateId(),
            ...review,
            helpful: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        if (!this.reviews.has(review.pluginId)) {
            this.reviews.set(review.pluginId, []);
        }
        this.reviews.get(review.pluginId).push(fullReview);
        // Update plugin statistics
        this.updatePluginRating(review.pluginId);
        this.emit('review:submitted', { reviewId: fullReview.id });
        return fullReview;
    }
    updatePluginRating(pluginId) {
        const plugin = this.plugins.get(pluginId);
        const reviews = this.reviews.get(pluginId);
        if (!plugin || !reviews || reviews.length === 0) {
            return;
        }
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        plugin.statistics.rating = totalRating / reviews.length;
        plugin.statistics.reviews = reviews.length;
    }
    async respondToReview(reviewId, pluginId, response, authorId) {
        const reviews = this.reviews.get(pluginId);
        if (!reviews) {
            throw new Error('Plugin not found');
        }
        const review = reviews.find(r => r.id === reviewId);
        if (!review) {
            throw new Error('Review not found');
        }
        review.response = {
            content: response,
            authorId,
            createdAt: new Date(),
        };
        review.updatedAt = new Date();
        this.emit('review:responded', { reviewId });
    }
    // ========================================================================
    // Purchases & Revenue
    // ========================================================================
    async purchasePlugin(pluginId, userId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error('Plugin not found');
        }
        if (plugin.price.type === 'free') {
            throw new Error('Plugin is free');
        }
        const purchase = {
            id: this.generateId(),
            pluginId,
            userId,
            type: 'purchase',
            amount: plugin.price.amount,
            currency: plugin.price.currency,
            status: 'completed',
            createdAt: new Date(),
        };
        if (!this.purchases.has(userId)) {
            this.purchases.set(userId, []);
        }
        this.purchases.get(userId).push(purchase);
        // Record revenue
        this.recordRevenue(plugin, purchase);
        this.emit('purchase:completed', { purchaseId: purchase.id });
        return purchase;
    }
    recordRevenue(plugin, purchase) {
        const key = `${plugin.id}:${plugin.author.id}`;
        let revenue = this.revenue.get(key);
        if (!revenue) {
            revenue = {
                pluginId: plugin.id,
                authorId: plugin.author.id,
                period: {
                    start: new Date(),
                    end: new Date(),
                },
                sales: 0,
                gross: 0,
                commission: 0,
                net: 0,
                payouts: [],
            };
            this.revenue.set(key, revenue);
        }
        revenue.sales++;
        revenue.gross += purchase.amount;
        revenue.commission = revenue.gross * this.config.commissionRate;
        revenue.net = revenue.gross - revenue.commission;
    }
    async verifyPurchase(pluginId, userId) {
        const purchases = this.purchases.get(userId);
        if (!purchases) {
            return false;
        }
        return purchases.some(p => p.pluginId === pluginId && p.status === 'completed');
    }
    // ========================================================================
    // Collections
    // ========================================================================
    createCollection(collection) {
        const fullCollection = {
            id: this.generateId(),
            ...collection,
            createdAt: new Date(),
        };
        this.collections.set(fullCollection.id, fullCollection);
        this.emit('collection:created', { collectionId: fullCollection.id });
        return fullCollection;
    }
    getFeaturedCollections() {
        return Array.from(this.collections.values()).filter(c => c.featured);
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    generateId() {
        return `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    getStats() {
        return {
            totalPlugins: this.plugins.size,
            publishedPlugins: Array.from(this.plugins.values()).filter(p => p.status === 'published').length,
            installedPlugins: this.installed.size,
            totalReviews: Array.from(this.reviews.values()).reduce((sum, reviews) => sum + reviews.length, 0),
            totalRevenue: Array.from(this.revenue.values()).reduce((sum, r) => sum + r.gross, 0),
            collections: this.collections.size,
        };
    }
}
exports.MarketplaceManager = MarketplaceManager;
