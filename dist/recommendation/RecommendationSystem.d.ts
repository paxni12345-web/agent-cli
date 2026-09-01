/**
 * Recommendation Engine System
 * Collaborative filtering, content-based filtering, hybrid recommendations, and personalization
 */
export interface RecommendationEngine {
    id: string;
    name: string;
    type: EngineType;
    config: EngineConfig;
    model?: RecommendationModel;
    statistics: EngineStatistics;
    createdAt: Date;
}
export declare enum EngineType {
    Collaborative = "collaborative",
    ContentBased = "content_based",
    Hybrid = "hybrid",
    DeepLearning = "deep_learning"
}
export interface EngineConfig {
    minSimilarity: number;
    maxRecommendations: number;
    diversityWeight: number;
    noveltyWeight: number;
    popularityWeight: number;
}
export interface RecommendationModel {
    userItemMatrix: Map<string, Map<string, number>>;
    itemFeatures: Map<string, number[]>;
    userProfiles: Map<string, UserProfile>;
    itemSimilarities: Map<string, Map<string, number>>;
    trainedAt: Date;
}
export interface UserProfile {
    userId: string;
    preferences: Map<string, number>;
    interactions: Interaction[];
    segments: string[];
    features: number[];
}
export interface Interaction {
    userId: string;
    itemId: string;
    type: InteractionType;
    rating?: number;
    timestamp: Date;
    context?: Record<string, any>;
}
export declare enum InteractionType {
    View = "view",
    Click = "click",
    Purchase = "purchase",
    Rating = "rating",
    Like = "like",
    Dislike = "dislike",
    Share = "share"
}
export interface Item {
    id: string;
    title: string;
    category: string;
    tags: string[];
    features: Record<string, any>;
    metadata: Record<string, any>;
    popularity: number;
    createdAt: Date;
}
export interface Recommendation {
    userId: string;
    items: RecommendedItem[];
    strategy: string;
    context?: Record<string, any>;
    generatedAt: Date;
}
export interface RecommendedItem {
    itemId: string;
    score: number;
    reason: string;
    rank: number;
}
export interface EngineStatistics {
    totalRecommendations: number;
    averageScore: number;
    coverageRate: number;
    diversityScore: number;
    noveltyScore: number;
}
export interface SimilarityMetric {
    name: string;
    calculate: (a: number[], b: number[]) => number;
}
export interface ABTest {
    id: string;
    name: string;
    variants: ABVariant[];
    status: ABTestStatus;
    startDate: Date;
    endDate?: Date;
    results?: ABTestResults;
}
export declare enum ABTestStatus {
    Draft = "draft",
    Running = "running",
    Completed = "completed"
}
export interface ABVariant {
    id: string;
    name: string;
    engineId: string;
    allocation: number;
    metrics: VariantMetrics;
}
export interface VariantMetrics {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
}
export interface ABTestResults {
    winner?: string;
    confidence: number;
    variants: ABVariant[];
}
export interface PersonalizationRule {
    id: string;
    name: string;
    condition: (user: UserProfile) => boolean;
    boost: number;
    items?: string[];
    categories?: string[];
}
/**
 * Recommendation Engine Manager
 */
export declare class RecommendationEngineManager {
    private engines;
    private interactions;
    private items;
    /**
     * Create engine
     */
    createEngine(engine: Omit<RecommendationEngine, 'id' | 'statistics' | 'createdAt'>): RecommendationEngine;
    /**
     * Train engine
     */
    trainEngine(engineId: string): Promise<void>;
    /**
     * Get recommendations
     */
    recommend(engineId: string, userId: string, options?: {
        limit?: number;
        excludeItems?: string[];
        context?: Record<string, any>;
    }): Promise<Recommendation>;
    /**
     * Record interaction
     */
    recordInteraction(interaction: Interaction): void;
    /**
     * Add item
     */
    addItem(item: Item): void;
    /**
     * Get engine
     */
    getEngine(engineId: string): RecommendationEngine | undefined;
    /**
     * List engines
     */
    listEngines(): RecommendationEngine[];
    /**
     * Get similar items
     */
    getSimilarItems(engineId: string, itemId: string, limit?: number): RecommendedItem[];
    private collaborativeFiltering;
    private contentBasedFiltering;
    private hybridFiltering;
    private findSimilarUsers;
    private userSimilarity;
    private cosineSimilarity;
    private calculateItemSimilarities;
    private itemSimilarityByRatings;
    private extractItemFeatures;
    private buildUserProfile;
    private interactionToRating;
    private applyDiversity;
    private applyNovelty;
    private getFallbackRecommendations;
    private generateEngineId;
}
/**
 * A/B Test Manager
 */
export declare class ABTestManager {
    private tests;
    private engineManager;
    constructor(engineManager: RecommendationEngineManager);
    /**
     * Create A/B test
     */
    createTest(test: Omit<ABTest, 'id'>): ABTest;
    /**
     * Get variant for user
     */
    getVariant(testId: string, userId: string): ABVariant | undefined;
    /**
     * Track impression
     */
    trackImpression(testId: string, variantId: string): void;
    /**
     * Track click
     */
    trackClick(testId: string, variantId: string): void;
    /**
     * Track conversion
     */
    trackConversion(testId: string, variantId: string): void;
    /**
     * Get test results
     */
    getResults(testId: string): ABTestResults | undefined;
    /**
     * Get test
     */
    getTest(testId: string): ABTest | undefined;
    /**
     * List tests
     */
    listTests(filter?: {
        status?: ABTestStatus;
    }): ABTest[];
    private hashUserId;
    private calculateConfidence;
    private generateTestId;
}
/**
 * Personalization Manager
 */
export declare class PersonalizationManager {
    private rules;
    private engineManager;
    constructor(engineManager: RecommendationEngineManager);
    /**
     * Add rule
     */
    addRule(rule: PersonalizationRule): void;
    /**
     * Apply rules to recommendations
     */
    applyRules(userId: string, recommendations: RecommendedItem[]): RecommendedItem[];
    /**
     * Get rule
     */
    getRule(ruleId: string): PersonalizationRule | undefined;
    /**
     * List rules
     */
    listRules(): PersonalizationRule[];
    /**
     * Remove rule
     */
    removeRule(ruleId: string): void;
}
/**
 * Singleton instances
 */
export declare const recommendationEngineManager: RecommendationEngineManager;
export declare const abTestManager: ABTestManager;
export declare const personalizationManager: PersonalizationManager;
//# sourceMappingURL=RecommendationSystem.d.ts.map