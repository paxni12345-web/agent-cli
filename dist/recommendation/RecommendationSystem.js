"use strict";
/**
 * Recommendation Engine System
 * Collaborative filtering, content-based filtering, hybrid recommendations, and personalization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.personalizationManager = exports.abTestManager = exports.recommendationEngineManager = exports.PersonalizationManager = exports.ABTestManager = exports.RecommendationEngineManager = exports.ABTestStatus = exports.InteractionType = exports.EngineType = void 0;
const EventBus_1 = require("../core/EventBus");
var EngineType;
(function (EngineType) {
    EngineType["Collaborative"] = "collaborative";
    EngineType["ContentBased"] = "content_based";
    EngineType["Hybrid"] = "hybrid";
    EngineType["DeepLearning"] = "deep_learning";
})(EngineType || (exports.EngineType = EngineType = {}));
var InteractionType;
(function (InteractionType) {
    InteractionType["View"] = "view";
    InteractionType["Click"] = "click";
    InteractionType["Purchase"] = "purchase";
    InteractionType["Rating"] = "rating";
    InteractionType["Like"] = "like";
    InteractionType["Dislike"] = "dislike";
    InteractionType["Share"] = "share";
})(InteractionType || (exports.InteractionType = InteractionType = {}));
var ABTestStatus;
(function (ABTestStatus) {
    ABTestStatus["Draft"] = "draft";
    ABTestStatus["Running"] = "running";
    ABTestStatus["Completed"] = "completed";
})(ABTestStatus || (exports.ABTestStatus = ABTestStatus = {}));
/**
 * Recommendation Engine Manager
 */
class RecommendationEngineManager {
    engines = new Map();
    interactions = new Map();
    items = new Map();
    /**
     * Create engine
     */
    createEngine(engine) {
        const fullEngine = {
            ...engine,
            id: this.generateEngineId(),
            statistics: {
                totalRecommendations: 0,
                averageScore: 0,
                coverageRate: 0,
                diversityScore: 0,
                noveltyScore: 0,
            },
            createdAt: new Date(),
        };
        this.engines.set(fullEngine.id, fullEngine);
        EventBus_1.eventBus.emitSync('recommendation.engine_created', fullEngine, 'RecommendationEngineManager');
        return fullEngine;
    }
    /**
     * Train engine
     */
    async trainEngine(engineId) {
        const engine = this.engines.get(engineId);
        if (!engine) {
            throw new Error(`Engine not found: ${engineId}`);
        }
        const model = {
            userItemMatrix: new Map(),
            itemFeatures: new Map(),
            userProfiles: new Map(),
            itemSimilarities: new Map(),
            trainedAt: new Date(),
        };
        // Build user-item matrix
        for (const [userId, interactions] of this.interactions) {
            const itemRatings = new Map();
            for (const interaction of interactions) {
                const rating = this.interactionToRating(interaction);
                itemRatings.set(interaction.itemId, rating);
            }
            model.userItemMatrix.set(userId, itemRatings);
        }
        // Build user profiles
        for (const [userId, interactions] of this.interactions) {
            const profile = this.buildUserProfile(userId, interactions);
            model.userProfiles.set(userId, profile);
        }
        // Calculate item similarities
        if (engine.type === EngineType.Collaborative || engine.type === EngineType.Hybrid) {
            this.calculateItemSimilarities(model);
        }
        // Extract item features for content-based filtering
        if (engine.type === EngineType.ContentBased || engine.type === EngineType.Hybrid) {
            this.extractItemFeatures(model);
        }
        engine.model = model;
        EventBus_1.eventBus.emitSync('recommendation.engine_trained', { engineId }, 'RecommendationEngineManager');
    }
    /**
     * Get recommendations
     */
    async recommend(engineId, userId, options = {}) {
        const engine = this.engines.get(engineId);
        if (!engine) {
            throw new Error(`Engine not found: ${engineId}`);
        }
        if (!engine.model) {
            throw new Error('Engine not trained');
        }
        const limit = options.limit || engine.config.maxRecommendations;
        const excludeItems = new Set(options.excludeItems || []);
        // Get user interactions
        const userInteractions = this.interactions.get(userId) || [];
        userInteractions.forEach(i => excludeItems.add(i.itemId));
        let recommendedItems = [];
        switch (engine.type) {
            case EngineType.Collaborative:
                recommendedItems = await this.collaborativeFiltering(engine, userId, excludeItems);
                break;
            case EngineType.ContentBased:
                recommendedItems = await this.contentBasedFiltering(engine, userId, excludeItems);
                break;
            case EngineType.Hybrid:
                recommendedItems = await this.hybridFiltering(engine, userId, excludeItems);
                break;
        }
        // Apply diversity and novelty
        recommendedItems = this.applyDiversity(recommendedItems, engine.config);
        recommendedItems = this.applyNovelty(recommendedItems, engine.config);
        // Rank and limit
        recommendedItems.sort((a, b) => b.score - a.score);
        recommendedItems = recommendedItems.slice(0, limit);
        recommendedItems.forEach((item, index) => (item.rank = index + 1));
        const recommendation = {
            userId,
            items: recommendedItems,
            strategy: engine.type,
            context: options.context,
            generatedAt: new Date(),
        };
        // Update statistics
        engine.statistics.totalRecommendations++;
        if (recommendedItems.length > 0) {
            const avgScore = recommendedItems.reduce((sum, item) => sum + item.score, 0) / recommendedItems.length;
            engine.statistics.averageScore = avgScore;
        }
        EventBus_1.eventBus.emitSync('recommendation.generated', recommendation, 'RecommendationEngineManager');
        return recommendation;
    }
    /**
     * Record interaction
     */
    recordInteraction(interaction) {
        if (!this.interactions.has(interaction.userId)) {
            this.interactions.set(interaction.userId, []);
        }
        this.interactions.get(interaction.userId).push(interaction);
        EventBus_1.eventBus.emitSync('recommendation.interaction_recorded', interaction, 'RecommendationEngineManager');
    }
    /**
     * Add item
     */
    addItem(item) {
        this.items.set(item.id, item);
        EventBus_1.eventBus.emitSync('recommendation.item_added', item, 'RecommendationEngineManager');
    }
    /**
     * Get engine
     */
    getEngine(engineId) {
        return this.engines.get(engineId);
    }
    /**
     * List engines
     */
    listEngines() {
        return Array.from(this.engines.values());
    }
    /**
     * Get similar items
     */
    getSimilarItems(engineId, itemId, limit = 10) {
        const engine = this.engines.get(engineId);
        if (!engine || !engine.model) {
            return [];
        }
        const similarities = engine.model.itemSimilarities.get(itemId);
        if (!similarities) {
            return [];
        }
        const items = Array.from(similarities.entries())
            .map(([id, score]) => ({
            itemId: id,
            score,
            reason: 'Similar to viewed item',
            rank: 0,
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        items.forEach((item, index) => (item.rank = index + 1));
        return items;
    }
    async collaborativeFiltering(engine, userId, excludeItems) {
        const model = engine.model;
        const userRatings = model.userItemMatrix.get(userId);
        if (!userRatings) {
            return this.getFallbackRecommendations(excludeItems);
        }
        // Find similar users
        const similarUsers = this.findSimilarUsers(userId, model);
        // Aggregate recommendations from similar users
        const itemScores = new Map();
        for (const [similarUserId, similarity] of similarUsers) {
            const theirRatings = model.userItemMatrix.get(similarUserId);
            if (theirRatings) {
                for (const [itemId, rating] of theirRatings) {
                    if (!excludeItems.has(itemId)) {
                        const currentScore = itemScores.get(itemId) || 0;
                        itemScores.set(itemId, currentScore + rating * similarity);
                    }
                }
            }
        }
        return Array.from(itemScores.entries()).map(([itemId, score]) => ({
            itemId,
            score,
            reason: 'Users like you also liked this',
            rank: 0,
        }));
    }
    async contentBasedFiltering(engine, userId, excludeItems) {
        const model = engine.model;
        const userProfile = model.userProfiles.get(userId);
        if (!userProfile || userProfile.features.length === 0) {
            return this.getFallbackRecommendations(excludeItems);
        }
        const itemScores = new Map();
        for (const [itemId, features] of model.itemFeatures) {
            if (!excludeItems.has(itemId)) {
                const similarity = this.cosineSimilarity(userProfile.features, features);
                itemScores.set(itemId, similarity);
            }
        }
        return Array.from(itemScores.entries()).map(([itemId, score]) => ({
            itemId,
            score,
            reason: 'Based on your interests',
            rank: 0,
        }));
    }
    async hybridFiltering(engine, userId, excludeItems) {
        const collaborativeItems = await this.collaborativeFiltering(engine, userId, excludeItems);
        const contentItems = await this.contentBasedFiltering(engine, userId, excludeItems);
        // Merge scores
        const itemScores = new Map();
        for (const item of collaborativeItems) {
            itemScores.set(item.itemId, { collaborative: item.score, content: 0 });
        }
        for (const item of contentItems) {
            const existing = itemScores.get(item.itemId);
            if (existing) {
                existing.content = item.score;
            }
            else {
                itemScores.set(item.itemId, { collaborative: 0, content: item.score });
            }
        }
        // Weighted combination
        const hybridItems = [];
        for (const [itemId, scores] of itemScores) {
            const hybridScore = scores.collaborative * 0.5 + scores.content * 0.5;
            hybridItems.push({
                itemId,
                score: hybridScore,
                reason: 'Personalized for you',
                rank: 0,
            });
        }
        return hybridItems;
    }
    findSimilarUsers(userId, model, limit = 10) {
        const userRatings = model.userItemMatrix.get(userId);
        if (!userRatings) {
            return new Map();
        }
        const similarities = new Map();
        for (const [otherUserId, otherRatings] of model.userItemMatrix) {
            if (otherUserId === userId)
                continue;
            const similarity = this.userSimilarity(userRatings, otherRatings);
            if (similarity > 0) {
                similarities.set(otherUserId, similarity);
            }
        }
        // Sort and limit
        const sorted = Array.from(similarities.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
        return new Map(sorted);
    }
    userSimilarity(ratingsA, ratingsB) {
        const commonItems = [];
        for (const itemId of ratingsA.keys()) {
            if (ratingsB.has(itemId)) {
                commonItems.push(itemId);
            }
        }
        if (commonItems.length === 0) {
            return 0;
        }
        const vectorA = commonItems.map(id => ratingsA.get(id));
        const vectorB = commonItems.map(id => ratingsB.get(id));
        return this.cosineSimilarity(vectorA, vectorB);
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length || a.length === 0) {
            return 0;
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        if (normA === 0 || normB === 0) {
            return 0;
        }
        return dotProduct / (normA * normB);
    }
    calculateItemSimilarities(model) {
        const itemIds = Array.from(this.items.keys());
        for (let i = 0; i < itemIds.length; i++) {
            const itemA = itemIds[i];
            const similarities = new Map();
            for (let j = 0; j < itemIds.length; j++) {
                if (i === j)
                    continue;
                const itemB = itemIds[j];
                // Calculate similarity based on user ratings
                const similarity = this.itemSimilarityByRatings(itemA, itemB, model);
                if (similarity > 0.3) {
                    similarities.set(itemB, similarity);
                }
            }
            model.itemSimilarities.set(itemA, similarities);
        }
    }
    itemSimilarityByRatings(itemA, itemB, model) {
        const ratingsA = [];
        const ratingsB = [];
        for (const userRatings of model.userItemMatrix.values()) {
            const ratingA = userRatings.get(itemA);
            const ratingB = userRatings.get(itemB);
            if (ratingA !== undefined && ratingB !== undefined) {
                ratingsA.push(ratingA);
                ratingsB.push(ratingB);
            }
        }
        if (ratingsA.length === 0) {
            return 0;
        }
        return this.cosineSimilarity(ratingsA, ratingsB);
    }
    extractItemFeatures(model) {
        for (const [itemId, item] of this.items) {
            const features = [];
            // Extract features from tags and category
            const allTags = new Set();
            for (const i of this.items.values()) {
                i.tags.forEach(tag => allTags.add(tag));
            }
            const tagArray = Array.from(allTags);
            for (const tag of tagArray) {
                features.push(item.tags.includes(tag) ? 1 : 0);
            }
            // Add popularity
            features.push(item.popularity);
            model.itemFeatures.set(itemId, features);
        }
    }
    buildUserProfile(userId, interactions) {
        const preferences = new Map();
        const segments = [];
        const features = [];
        // Aggregate preferences from interactions
        for (const interaction of interactions) {
            const item = this.items.get(interaction.itemId);
            if (item) {
                // Update category preferences
                const currentPref = preferences.get(item.category) || 0;
                preferences.set(item.category, currentPref + this.interactionToRating(interaction));
                // Update tag preferences
                for (const tag of item.tags) {
                    const currentTagPref = preferences.get(tag) || 0;
                    preferences.set(tag, currentTagPref + this.interactionToRating(interaction));
                }
            }
        }
        // Build feature vector
        const allCategories = new Set();
        for (const item of this.items.values()) {
            allCategories.add(item.category);
        }
        for (const category of allCategories) {
            features.push(preferences.get(category) || 0);
        }
        return {
            userId,
            preferences,
            interactions,
            segments,
            features,
        };
    }
    interactionToRating(interaction) {
        if (interaction.rating !== undefined) {
            return interaction.rating;
        }
        switch (interaction.type) {
            case InteractionType.Purchase:
                return 5;
            case InteractionType.Like:
                return 4;
            case InteractionType.Click:
                return 3;
            case InteractionType.Share:
                return 4;
            case InteractionType.View:
                return 2;
            case InteractionType.Dislike:
                return 1;
            default:
                return 2;
        }
    }
    applyDiversity(items, config) {
        // Simple diversity: penalize items from same category
        const seenCategories = new Set();
        for (const item of items) {
            const itemData = this.items.get(item.itemId);
            if (itemData) {
                if (seenCategories.has(itemData.category)) {
                    item.score *= 1 - config.diversityWeight;
                }
                seenCategories.add(itemData.category);
            }
        }
        return items;
    }
    applyNovelty(items, config) {
        for (const item of items) {
            const itemData = this.items.get(item.itemId);
            if (itemData) {
                // Boost newer items
                const ageInDays = (Date.now() - itemData.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                const noveltyBoost = Math.exp(-ageInDays / 30) * config.noveltyWeight;
                item.score *= 1 + noveltyBoost;
            }
        }
        return items;
    }
    getFallbackRecommendations(excludeItems) {
        // Return popular items as fallback
        const popularItems = Array.from(this.items.values())
            .filter(item => !excludeItems.has(item.id))
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 10);
        return popularItems.map((item, index) => ({
            itemId: item.id,
            score: item.popularity,
            reason: 'Popular item',
            rank: index + 1,
        }));
    }
    generateEngineId() {
        return `engine_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.RecommendationEngineManager = RecommendationEngineManager;
/**
 * A/B Test Manager
 */
class ABTestManager {
    tests = new Map();
    engineManager;
    constructor(engineManager) {
        this.engineManager = engineManager;
    }
    /**
     * Create A/B test
     */
    createTest(test) {
        const fullTest = {
            ...test,
            id: this.generateTestId(),
        };
        this.tests.set(fullTest.id, fullTest);
        EventBus_1.eventBus.emitSync('recommendation.ab_test_created', fullTest, 'ABTestManager');
        return fullTest;
    }
    /**
     * Get variant for user
     */
    getVariant(testId, userId) {
        const test = this.tests.get(testId);
        if (!test || test.status !== ABTestStatus.Running) {
            return undefined;
        }
        // Consistent hashing to assign user to variant
        const hash = this.hashUserId(userId);
        let cumulative = 0;
        for (const variant of test.variants) {
            cumulative += variant.allocation;
            if (hash < cumulative) {
                return variant;
            }
        }
        return test.variants[test.variants.length - 1];
    }
    /**
     * Track impression
     */
    trackImpression(testId, variantId) {
        const test = this.tests.get(testId);
        if (!test)
            return;
        const variant = test.variants.find(v => v.id === variantId);
        if (variant) {
            variant.metrics.impressions++;
        }
    }
    /**
     * Track click
     */
    trackClick(testId, variantId) {
        const test = this.tests.get(testId);
        if (!test)
            return;
        const variant = test.variants.find(v => v.id === variantId);
        if (variant) {
            variant.metrics.clicks++;
            variant.metrics.ctr = variant.metrics.clicks / variant.metrics.impressions;
        }
    }
    /**
     * Track conversion
     */
    trackConversion(testId, variantId) {
        const test = this.tests.get(testId);
        if (!test)
            return;
        const variant = test.variants.find(v => v.id === variantId);
        if (variant) {
            variant.metrics.conversions++;
            variant.metrics.conversionRate = variant.metrics.conversions / variant.metrics.impressions;
        }
    }
    /**
     * Get test results
     */
    getResults(testId) {
        const test = this.tests.get(testId);
        if (!test)
            return undefined;
        // Find winner (highest conversion rate)
        let winner;
        let maxConversionRate = 0;
        for (const variant of test.variants) {
            if (variant.metrics.conversionRate > maxConversionRate) {
                maxConversionRate = variant.metrics.conversionRate;
                winner = variant;
            }
        }
        return {
            winner: winner?.id,
            confidence: this.calculateConfidence(test.variants),
            variants: test.variants,
        };
    }
    /**
     * Get test
     */
    getTest(testId) {
        return this.tests.get(testId);
    }
    /**
     * List tests
     */
    listTests(filter) {
        let tests = Array.from(this.tests.values());
        if (filter?.status) {
            tests = tests.filter(t => t.status === filter.status);
        }
        return tests;
    }
    hashUserId(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % 100;
    }
    calculateConfidence(variants) {
        // Simplified confidence calculation
        if (variants.length < 2)
            return 0;
        const totalImpressions = variants.reduce((sum, v) => sum + v.metrics.impressions, 0);
        if (totalImpressions < 100)
            return 0;
        return Math.min(totalImpressions / 1000, 0.95) * 100;
    }
    generateTestId() {
        return `abtest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ABTestManager = ABTestManager;
/**
 * Personalization Manager
 */
class PersonalizationManager {
    rules = new Map();
    engineManager;
    constructor(engineManager) {
        this.engineManager = engineManager;
    }
    /**
     * Add rule
     */
    addRule(rule) {
        this.rules.set(rule.id, rule);
        EventBus_1.eventBus.emitSync('recommendation.rule_added', rule, 'PersonalizationManager');
    }
    /**
     * Apply rules to recommendations
     */
    applyRules(userId, recommendations) {
        const engine = this.engineManager.listEngines()[0];
        if (!engine || !engine.model) {
            return recommendations;
        }
        const userProfile = engine.model.userProfiles.get(userId);
        if (!userProfile) {
            return recommendations;
        }
        for (const rule of this.rules.values()) {
            if (rule.condition(userProfile)) {
                // Apply boost to matching items
                for (const item of recommendations) {
                    if (rule.items?.includes(item.itemId)) {
                        item.score *= 1 + rule.boost;
                    }
                    // Check category boost
                    // (Would need item category lookup)
                }
            }
        }
        return recommendations.sort((a, b) => b.score - a.score);
    }
    /**
     * Get rule
     */
    getRule(ruleId) {
        return this.rules.get(ruleId);
    }
    /**
     * List rules
     */
    listRules() {
        return Array.from(this.rules.values());
    }
    /**
     * Remove rule
     */
    removeRule(ruleId) {
        this.rules.delete(ruleId);
        EventBus_1.eventBus.emitSync('recommendation.rule_removed', { ruleId }, 'PersonalizationManager');
    }
}
exports.PersonalizationManager = PersonalizationManager;
/**
 * Singleton instances
 */
exports.recommendationEngineManager = new RecommendationEngineManager();
exports.abTestManager = new ABTestManager(exports.recommendationEngineManager);
exports.personalizationManager = new PersonalizationManager(exports.recommendationEngineManager);
