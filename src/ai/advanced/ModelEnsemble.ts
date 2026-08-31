/**
 * ModelEnsemble - Multi-model voting and ensemble strategies
 * Advanced ensemble learning for AI model orchestration
 */

import { EventEmitter } from 'events';

export interface Model {
  id: string;
  name: string;
  provider: string;
  weight: number;
  performance: ModelPerformance;
  config: ModelConfig;
}

export interface ModelPerformance {
  accuracy: number;
  latency: number;
  cost: number;
  reliability: number;
  lastUpdated: Date;
}

export interface ModelConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface EnsembleStrategy {
  type: 'voting' | 'weighted' | 'cascade' | 'dynamic';
  minModels: number;
  maxModels: number;
  threshold: number;
}

export interface EnsembleResult {
  response: string;
  confidence: number;
  modelContributions: ModelContribution[];
  metadata: EnsembleMetadata;
}

export interface ModelContribution {
  modelId: string;
  response: string;
  confidence: number;
  weight: number;
  latency: number;
}

export interface EnsembleMetadata {
  strategy: string;
  modelsUsed: number;
  totalLatency: number;
  totalCost: number;
  agreementScore: number;
}

export class ModelEnsemble extends EventEmitter {
  private models: Map<string, Model> = new Map();
  private strategy: EnsembleStrategy;
  private performanceHistory: Map<string, ModelPerformance[]> = new Map();
  private isActive: boolean = false;

  constructor(strategy: EnsembleStrategy) {
    super();
    this.strategy = strategy;
  }

  /**
   * Register a model in the ensemble
   */
  public registerModel(model: Model): void {
    this.models.set(model.id, model);
    this.performanceHistory.set(model.id, []);
    this.emit('model:registered', model);
  }

  /**
   * Unregister a model from the ensemble
   */
  public unregisterModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) {
      this.models.delete(modelId);
      this.performanceHistory.delete(modelId);
      this.emit('model:unregistered', model);
    }
  }

  /**
   * Execute ensemble inference with voting strategy
   */
  public async executeVoting(prompt: string, options?: any): Promise<EnsembleResult> {
    const startTime = Date.now();
    const contributions: ModelContribution[] = [];

    // Select models for voting
    const selectedModels = this.selectModelsForVoting();

    // Execute in parallel
    const promises = selectedModels.map(async (model) => {
      const modelStart = Date.now();
      try {
        const response = await this.invokeModel(model, prompt, options);
        const latency = Date.now() - modelStart;

        return {
          modelId: model.id,
          response: response.text,
          confidence: response.confidence,
          weight: model.weight,
          latency
        } as ModelContribution;
      } catch (error) {
        this.emit('model:error', { modelId: model.id, error });
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter(r => r !== null) as ModelContribution[];

    // Apply voting logic
    const votingResult = this.applyVotingLogic(results);

    const totalLatency = Date.now() - startTime;

    return {
      response: votingResult.response,
      confidence: votingResult.confidence,
      modelContributions: results,
      metadata: {
        strategy: 'voting',
        modelsUsed: results.length,
        totalLatency,
        totalCost: this.calculateTotalCost(results),
        agreementScore: this.calculateAgreementScore(results)
      }
    };
  }

  /**
   * Execute weighted ensemble strategy
   */
  public async executeWeighted(prompt: string, options?: any): Promise<EnsembleResult> {
    const startTime = Date.now();
    const contributions: ModelContribution[] = [];

    // Select models based on performance weights
    const selectedModels = this.selectModelsForWeighting();

    // Execute in parallel
    const promises = selectedModels.map(async (model) => {
      const modelStart = Date.now();
      try {
        const response = await this.invokeModel(model, prompt, options);
        const latency = Date.now() - modelStart;

        return {
          modelId: model.id,
          response: response.text,
          confidence: response.confidence,
          weight: model.weight,
          latency
        } as ModelContribution;
      } catch (error) {
        this.emit('model:error', { modelId: model.id, error });
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter(r => r !== null) as ModelContribution[];

    // Apply weighted combination
    const weightedResult = this.applyWeightedCombination(results);

    const totalLatency = Date.now() - startTime;

    return {
      response: weightedResult.response,
      confidence: weightedResult.confidence,
      modelContributions: results,
      metadata: {
        strategy: 'weighted',
        modelsUsed: results.length,
        totalLatency,
        totalCost: this.calculateTotalCost(results),
        agreementScore: this.calculateAgreementScore(results)
      }
    };
  }

  /**
   * Execute cascade strategy (try models in order until threshold met)
   */
  public async executeCascade(prompt: string, options?: any): Promise<EnsembleResult> {
    const startTime = Date.now();
    const contributions: ModelContribution[] = [];

    // Sort models by performance
    const sortedModels = this.sortModelsByPerformance();

    for (const model of sortedModels) {
      const modelStart = Date.now();
      try {
        const response = await this.invokeModel(model, prompt, options);
        const latency = Date.now() - modelStart;

        const contribution: ModelContribution = {
          modelId: model.id,
          response: response.text,
          confidence: response.confidence,
          weight: model.weight,
          latency
        };

        contributions.push(contribution);

        // Check if confidence threshold met
        if (response.confidence >= this.strategy.threshold) {
          break;
        }
      } catch (error) {
        this.emit('model:error', { modelId: model.id, error });
        continue;
      }
    }

    const bestResult = contributions.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    const totalLatency = Date.now() - startTime;

    return {
      response: bestResult.response,
      confidence: bestResult.confidence,
      modelContributions: contributions,
      metadata: {
        strategy: 'cascade',
        modelsUsed: contributions.length,
        totalLatency,
        totalCost: this.calculateTotalCost(contributions),
        agreementScore: 1.0
      }
    };
  }

  /**
   * Execute dynamic strategy (choose strategy based on context)
   */
  public async executeDynamic(prompt: string, options?: any): Promise<EnsembleResult> {
    // Analyze prompt to determine best strategy
    const promptAnalysis = this.analyzePrompt(prompt);

    if (promptAnalysis.complexity === 'high') {
      return this.executeVoting(prompt, options);
    } else if (promptAnalysis.requiresSpeed) {
      return this.executeCascade(prompt, options);
    } else {
      return this.executeWeighted(prompt, options);
    }
  }

  /**
   * Select models for voting based on diversity
   */
  private selectModelsForVoting(): Model[] {
    const models = Array.from(this.models.values());

    // Sort by performance and diversity
    return models
      .filter(m => m.performance.reliability > 0.8)
      .sort((a, b) => b.performance.accuracy - a.performance.accuracy)
      .slice(0, this.strategy.maxModels);
  }

  /**
   * Select models for weighting based on performance
   */
  private selectModelsForWeighting(): Model[] {
    const models = Array.from(this.models.values());

    // Normalize weights
    const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
    models.forEach(m => m.weight = m.weight / totalWeight);

    return models
      .filter(m => m.performance.reliability > 0.7)
      .slice(0, this.strategy.maxModels);
  }

  /**
   * Sort models by overall performance score
   */
  private sortModelsByPerformance(): Model[] {
    return Array.from(this.models.values())
      .sort((a, b) => {
        const scoreA = this.calculatePerformanceScore(a);
        const scoreB = this.calculatePerformanceScore(b);
        return scoreB - scoreA;
      });
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(model: Model): number {
    const p = model.performance;
    return (
      p.accuracy * 0.4 +
      (1 - p.latency / 10000) * 0.2 +
      (1 - p.cost / 100) * 0.2 +
      p.reliability * 0.2
    );
  }

  /**
   * Invoke a single model
   */
  private async invokeModel(model: Model, prompt: string, options?: any): Promise<any> {
    // Simulate model invocation (replace with actual API calls)
    return {
      text: `Response from ${model.name}`,
      confidence: 0.85 + Math.random() * 0.15,
      tokens: 150
    };
  }

  /**
   * Apply voting logic to combine results
   */
  private applyVotingLogic(contributions: ModelContribution[]): { response: string; confidence: number } {
    if (contributions.length === 0) {
      throw new Error('No contributions to vote on');
    }

    // Group similar responses
    const responseGroups = this.groupSimilarResponses(contributions);

    // Find majority response
    const majorityGroup = responseGroups.reduce((max, group) =>
      group.length > max.length ? group : max
    );

    const avgConfidence = majorityGroup.reduce((sum, c) => sum + c.confidence, 0) / majorityGroup.length;

    return {
      response: majorityGroup[0].response,
      confidence: avgConfidence
    };
  }

  /**
   * Apply weighted combination
   */
  private applyWeightedCombination(contributions: ModelContribution[]): { response: string; confidence: number } {
    if (contributions.length === 0) {
      throw new Error('No contributions to combine');
    }

    // Weight responses by model weight and confidence
    const weightedScores = contributions.map(c => ({
      response: c.response,
      score: c.weight * c.confidence
    }));

    const best = weightedScores.reduce((max, current) =>
      current.score > max.score ? current : max
    );

    return {
      response: best.response,
      confidence: best.score
    };
  }

  /**
   * Group similar responses using simple similarity
   */
  private groupSimilarResponses(contributions: ModelContribution[]): ModelContribution[][] {
    const groups: ModelContribution[][] = [];

    for (const contribution of contributions) {
      let foundGroup = false;

      for (const group of groups) {
        if (this.calculateSimilarity(contribution.response, group[0].response) > 0.7) {
          group.push(contribution);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        groups.push([contribution]);
      }
    }

    return groups;
  }

  /**
   * Calculate similarity between two responses
   */
  private calculateSimilarity(response1: string, response2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(response1.toLowerCase().split(/\s+/));
    const words2 = new Set(response2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate total cost of ensemble execution
   */
  private calculateTotalCost(contributions: ModelContribution[]): number {
    return contributions.reduce((sum, c) => {
      const model = this.models.get(c.modelId);
      return sum + (model?.performance.cost || 0);
    }, 0);
  }

  /**
   * Calculate agreement score among models
   */
  private calculateAgreementScore(contributions: ModelContribution[]): number {
    if (contributions.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < contributions.length; i++) {
      for (let j = i + 1; j < contributions.length; j++) {
        totalSimilarity += this.calculateSimilarity(
          contributions[i].response,
          contributions[j].response
        );
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
  }

  /**
   * Analyze prompt characteristics
   */
  private analyzePrompt(prompt: string): { complexity: string; requiresSpeed: boolean } {
    const wordCount = prompt.split(/\s+/).length;
    const hasComplexKeywords = /analyze|compare|explain|detailed|comprehensive/i.test(prompt);

    return {
      complexity: wordCount > 100 || hasComplexKeywords ? 'high' : 'low',
      requiresSpeed: /quick|fast|urgent/i.test(prompt)
    };
  }

  /**
   * Update model performance metrics
   */
  public updateModelPerformance(modelId: string, performance: Partial<ModelPerformance>): void {
    const model = this.models.get(modelId);
    if (model) {
      model.performance = { ...model.performance, ...performance, lastUpdated: new Date() };

      const history = this.performanceHistory.get(modelId) || [];
      history.push(model.performance);

      // Keep only last 100 records
      if (history.length > 100) {
        history.shift();
      }

      this.performanceHistory.set(modelId, history);
      this.emit('model:performance:updated', { modelId, performance: model.performance });
    }
  }

  /**
   * Get model statistics
   */
  public getModelStats(modelId: string): any {
    const history = this.performanceHistory.get(modelId) || [];
    if (history.length === 0) return null;

    return {
      avgAccuracy: history.reduce((sum, p) => sum + p.accuracy, 0) / history.length,
      avgLatency: history.reduce((sum, p) => sum + p.latency, 0) / history.length,
      avgCost: history.reduce((sum, p) => sum + p.cost, 0) / history.length,
      avgReliability: history.reduce((sum, p) => sum + p.reliability, 0) / history.length,
      samples: history.length
    };
  }

  /**
   * Optimize model selection based on historical performance
   */
  public async optimizeModelSelection(): Promise<void> {
    for (const [modelId, model] of this.models) {
      const stats = this.getModelStats(modelId);
      if (stats) {
        // Adjust weights based on performance
        const performanceScore = this.calculatePerformanceScore(model);
        model.weight = performanceScore;
      }
    }

    this.emit('models:optimized');
  }

  /**
   * Get ensemble status
   */
  public getStatus(): any {
    return {
      isActive: this.isActive,
      strategy: this.strategy,
      modelCount: this.models.size,
      models: Array.from(this.models.values()).map(m => ({
        id: m.id,
        name: m.name,
        weight: m.weight,
        performance: m.performance
      }))
    };
  }

  /**
   * Start ensemble
   */
  public start(): void {
    this.isActive = true;
    this.emit('ensemble:started');
  }

  /**
   * Stop ensemble
   */
  public stop(): void {
    this.isActive = false;
    this.emit('ensemble:stopped');
  }

  /**
   * Reset ensemble
   */
  public reset(): void {
    this.models.clear();
    this.performanceHistory.clear();
    this.isActive = false;
    this.emit('ensemble:reset');
  }
}

/**
 * Ensemble factory for common configurations
 */
export class EnsembleFactory {
  public static createVotingEnsemble(minModels: number = 3): ModelEnsemble {
    return new ModelEnsemble({
      type: 'voting',
      minModels,
      maxModels: 5,
      threshold: 0.8
    });
  }

  public static createWeightedEnsemble(maxModels: number = 3): ModelEnsemble {
    return new ModelEnsemble({
      type: 'weighted',
      minModels: 2,
      maxModels,
      threshold: 0.7
    });
  }

  public static createCascadeEnsemble(threshold: number = 0.9): ModelEnsemble {
    return new ModelEnsemble({
      type: 'cascade',
      minModels: 1,
      maxModels: 5,
      threshold
    });
  }

  public static createDynamicEnsemble(): ModelEnsemble {
    return new ModelEnsemble({
      type: 'dynamic',
      minModels: 2,
      maxModels: 5,
      threshold: 0.8
    });
  }
}

export default ModelEnsemble;
