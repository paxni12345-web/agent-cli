/**
 * Recommendation Engine System
 * Collaborative filtering, content-based filtering, hybrid recommendations, and personalization
 */

import { eventBus } from '../core/EventBus';

export interface RecommendationEngine {
  id: string;
  name: string;
  type: EngineType;
  config: EngineConfig;
  model?: RecommendationModel;
  statistics: EngineStatistics;
  createdAt: Date;
}

export enum EngineType {
  Collaborative = 'collaborative',
  ContentBased = 'content_based',
  Hybrid = 'hybrid',
  DeepLearning = 'deep_learning',
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

export enum InteractionType {
  View = 'view',
  Click = 'click',
  Purchase = 'purchase',
  Rating = 'rating',
  Like = 'like',
  Dislike = 'dislike',
  Share = 'share',
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

export enum ABTestStatus {
  Draft = 'draft',
  Running = 'running',
  Completed = 'completed',
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
export class RecommendationEngineManager {
  private engines: Map<string, RecommendationEngine> = new Map();
  private interactions: Map<string, Interaction[]> = new Map();
  private items: Map<string, Item> = new Map();

  /**
   * Create engine
   */
  createEngine(engine: Omit<RecommendationEngine, 'id' | 'statistics' | 'createdAt'>): RecommendationEngine {
    const fullEngine: RecommendationEngine = {
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

    eventBus.emitSync('recommendation.engine_created', fullEngine, 'RecommendationEngineManager');

    return fullEngine;
  }

  /**
   * Train engine
   */
  async trainEngine(engineId: string): Promise<void> {
    const engine = this.engines.get(engineId);

    if (!engine) {
      throw new Error(`Engine not found: ${engineId}`);
    }

    const model: RecommendationModel = {
      userItemMatrix: new Map(),
      itemFeatures: new Map(),
      userProfiles: new Map(),
      itemSimilarities: new Map(),
      trainedAt: new Date(),
    };

    // Build user-item matrix
    for (const [userId, interactions] of this.interactions) {
      const itemRatings = new Map<string, number>();

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

    eventBus.emitSync('recommendation.engine_trained', { engineId }, 'RecommendationEngineManager');
  }

  /**
   * Get recommendations
   */
  async recommend(engineId: string, userId: string, options: {
    limit?: number;
    excludeItems?: string[];
    context?: Record<string, any>;
  } = {}): Promise<Recommendation> {
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

    let recommendedItems: RecommendedItem[] = [];

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

    const recommendation: Recommendation = {
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

    eventBus.emitSync('recommendation.generated', recommendation, 'RecommendationEngineManager');

    return recommendation;
  }

  /**
   * Record interaction
   */
  recordInteraction(interaction: Interaction): void {
    if (!this.interactions.has(interaction.userId)) {
      this.interactions.set(interaction.userId, []);
    }

    this.interactions.get(interaction.userId)!.push(interaction);

    eventBus.emitSync('recommendation.interaction_recorded', interaction, 'RecommendationEngineManager');
  }

  /**
   * Add item
   */
  addItem(item: Item): void {
    this.items.set(item.id, item);
    eventBus.emitSync('recommendation.item_added', item, 'RecommendationEngineManager');
  }

  /**
   * Get engine
   */
  getEngine(engineId: string): RecommendationEngine | undefined {
    return this.engines.get(engineId);
  }

  /**
   * List engines
   */
  listEngines(): RecommendationEngine[] {
    return Array.from(this.engines.values());
  }

  /**
   * Get similar items
   */
  getSimilarItems(engineId: string, itemId: string, limit: number = 10): RecommendedItem[] {
    const engine = this.engines.get(engineId);

    if (!engine || !engine.model) {
      return [];
    }

    const similarities = engine.model.itemSimilarities.get(itemId);

    if (!similarities) {
      return [];
    }

    const items: RecommendedItem[] = Array.from(similarities.entries())
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

  private async collaborativeFiltering(
    engine: RecommendationEngine,
    userId: string,
    excludeItems: Set<string>
  ): Promise<RecommendedItem[]> {
    const model = engine.model!;
    const userRatings = model.userItemMatrix.get(userId);

    if (!userRatings) {
      return this.getFallbackRecommendations(excludeItems);
    }

    // Find similar users
    const similarUsers = this.findSimilarUsers(userId, model);

    // Aggregate recommendations from similar users
    const itemScores = new Map<string, number>();

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

  private async contentBasedFiltering(
    engine: RecommendationEngine,
    userId: string,
    excludeItems: Set<string>
  ): Promise<RecommendedItem[]> {
    const model = engine.model!;
    const userProfile = model.userProfiles.get(userId);

    if (!userProfile || userProfile.features.length === 0) {
      return this.getFallbackRecommendations(excludeItems);
    }

    const itemScores = new Map<string, number>();

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

  private async hybridFiltering(
    engine: RecommendationEngine,
    userId: string,
    excludeItems: Set<string>
  ): Promise<RecommendedItem[]> {
    const collaborativeItems = await this.collaborativeFiltering(engine, userId, excludeItems);
    const contentItems = await this.contentBasedFiltering(engine, userId, excludeItems);

    // Merge scores
    const itemScores = new Map<string, { collaborative: number; content: number }>();

    for (const item of collaborativeItems) {
      itemScores.set(item.itemId, { collaborative: item.score, content: 0 });
    }

    for (const item of contentItems) {
      const existing = itemScores.get(item.itemId);
      if (existing) {
        existing.content = item.score;
      } else {
        itemScores.set(item.itemId, { collaborative: 0, content: item.score });
      }
    }

    // Weighted combination
    const hybridItems: RecommendedItem[] = [];

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

  private findSimilarUsers(userId: string, model: RecommendationModel, limit: number = 10): Map<string, number> {
    const userRatings = model.userItemMatrix.get(userId);

    if (!userRatings) {
      return new Map();
    }

    const similarities = new Map<string, number>();

    for (const [otherUserId, otherRatings] of model.userItemMatrix) {
      if (otherUserId === userId) continue;

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

  private userSimilarity(ratingsA: Map<string, number>, ratingsB: Map<string, number>): number {
    const commonItems: string[] = [];

    for (const itemId of ratingsA.keys()) {
      if (ratingsB.has(itemId)) {
        commonItems.push(itemId);
      }
    }

    if (commonItems.length === 0) {
      return 0;
    }

    const vectorA = commonItems.map(id => ratingsA.get(id)!);
    const vectorB = commonItems.map(id => ratingsB.get(id)!);

    return this.cosineSimilarity(vectorA, vectorB);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
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

  private calculateItemSimilarities(model: RecommendationModel): void {
    const itemIds = Array.from(this.items.keys());

    for (let i = 0; i < itemIds.length; i++) {
      const itemA = itemIds[i];
      const similarities = new Map<string, number>();

      for (let j = 0; j < itemIds.length; j++) {
        if (i === j) continue;

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

  private itemSimilarityByRatings(itemA: string, itemB: string, model: RecommendationModel): number {
    const ratingsA: number[] = [];
    const ratingsB: number[] = [];

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

  private extractItemFeatures(model: RecommendationModel): void {
    for (const [itemId, item] of this.items) {
      const features: number[] = [];

      // Extract features from tags and category
      const allTags = new Set<string>();
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

  private buildUserProfile(userId: string, interactions: Interaction[]): UserProfile {
    const preferences = new Map<string, number>();
    const segments: string[] = [];
    const features: number[] = [];

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
    const allCategories = new Set<string>();
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

  private interactionToRating(interaction: Interaction): number {
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

  private applyDiversity(items: RecommendedItem[], config: EngineConfig): RecommendedItem[] {
    // Simple diversity: penalize items from same category
    const seenCategories = new Set<string>();

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

  private applyNovelty(items: RecommendedItem[], config: EngineConfig): RecommendedItem[] {
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

  private getFallbackRecommendations(excludeItems: Set<string>): RecommendedItem[] {
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

  private generateEngineId(): string {
    return `engine_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * A/B Test Manager
 */
export class ABTestManager {
  private tests: Map<string, ABTest> = new Map();
  private engineManager: RecommendationEngineManager;

  constructor(engineManager: RecommendationEngineManager) {
    this.engineManager = engineManager;
  }

  /**
   * Create A/B test
   */
  createTest(test: Omit<ABTest, 'id'>): ABTest {
    const fullTest: ABTest = {
      ...test,
      id: this.generateTestId(),
    };

    this.tests.set(fullTest.id, fullTest);

    eventBus.emitSync('recommendation.ab_test_created', fullTest, 'ABTestManager');

    return fullTest;
  }

  /**
   * Get variant for user
   */
  getVariant(testId: string, userId: string): ABVariant | undefined {
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
  trackImpression(testId: string, variantId: string): void {
    const test = this.tests.get(testId);

    if (!test) return;

    const variant = test.variants.find(v => v.id === variantId);

    if (variant) {
      variant.metrics.impressions++;
    }
  }

  /**
   * Track click
   */
  trackClick(testId: string, variantId: string): void {
    const test = this.tests.get(testId);

    if (!test) return;

    const variant = test.variants.find(v => v.id === variantId);

    if (variant) {
      variant.metrics.clicks++;
      variant.metrics.ctr = variant.metrics.clicks / variant.metrics.impressions;
    }
  }

  /**
   * Track conversion
   */
  trackConversion(testId: string, variantId: string): void {
    const test = this.tests.get(testId);

    if (!test) return;

    const variant = test.variants.find(v => v.id === variantId);

    if (variant) {
      variant.metrics.conversions++;
      variant.metrics.conversionRate = variant.metrics.conversions / variant.metrics.impressions;
    }
  }

  /**
   * Get test results
   */
  getResults(testId: string): ABTestResults | undefined {
    const test = this.tests.get(testId);

    if (!test) return undefined;

    // Find winner (highest conversion rate)
    let winner: ABVariant | undefined;
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
  getTest(testId: string): ABTest | undefined {
    return this.tests.get(testId);
  }

  /**
   * List tests
   */
  listTests(filter?: { status?: ABTestStatus }): ABTest[] {
    let tests = Array.from(this.tests.values());

    if (filter?.status) {
      tests = tests.filter(t => t.status === filter.status);
    }

    return tests;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  private calculateConfidence(variants: ABVariant[]): number {
    // Simplified confidence calculation
    if (variants.length < 2) return 0;

    const totalImpressions = variants.reduce((sum, v) => sum + v.metrics.impressions, 0);

    if (totalImpressions < 100) return 0;

    return Math.min(totalImpressions / 1000, 0.95) * 100;
  }

  private generateTestId(): string {
    return `abtest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Personalization Manager
 */
export class PersonalizationManager {
  private rules: Map<string, PersonalizationRule> = new Map();
  private engineManager: RecommendationEngineManager;

  constructor(engineManager: RecommendationEngineManager) {
    this.engineManager = engineManager;
  }

  /**
   * Add rule
   */
  addRule(rule: PersonalizationRule): void {
    this.rules.set(rule.id, rule);
    eventBus.emitSync('recommendation.rule_added', rule, 'PersonalizationManager');
  }

  /**
   * Apply rules to recommendations
   */
  applyRules(userId: string, recommendations: RecommendedItem[]): RecommendedItem[] {
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
  getRule(ruleId: string): PersonalizationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * List rules
   */
  listRules(): PersonalizationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Remove rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    eventBus.emitSync('recommendation.rule_removed', { ruleId }, 'PersonalizationManager');
  }
}

/**
 * Singleton instances
 */
export const recommendationEngineManager = new RecommendationEngineManager();
export const abTestManager = new ABTestManager(recommendationEngineManager);
export const personalizationManager = new PersonalizationManager(recommendationEngineManager);
