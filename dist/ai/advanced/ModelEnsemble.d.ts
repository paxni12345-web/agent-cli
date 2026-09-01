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
export declare class ModelEnsemble extends EventEmitter {
    private models;
    private strategy;
    private performanceHistory;
    private isActive;
    constructor(strategy: EnsembleStrategy);
    /**
     * Register a model in the ensemble
     */
    registerModel(model: Model): void;
    /**
     * Unregister a model from the ensemble
     */
    unregisterModel(modelId: string): void;
    /**
     * Execute ensemble inference with voting strategy
     */
    executeVoting(prompt: string, options?: any): Promise<EnsembleResult>;
    /**
     * Execute weighted ensemble strategy
     */
    executeWeighted(prompt: string, options?: any): Promise<EnsembleResult>;
    /**
     * Execute cascade strategy (try models in order until threshold met)
     */
    executeCascade(prompt: string, options?: any): Promise<EnsembleResult>;
    /**
     * Execute dynamic strategy (choose strategy based on context)
     */
    executeDynamic(prompt: string, options?: any): Promise<EnsembleResult>;
    /**
     * Select models for voting based on diversity
     */
    private selectModelsForVoting;
    /**
     * Select models for weighting based on performance
     */
    private selectModelsForWeighting;
    /**
     * Sort models by overall performance score
     */
    private sortModelsByPerformance;
    /**
     * Calculate overall performance score
     */
    private calculatePerformanceScore;
    /**
     * Invoke a single model
     */
    private invokeModel;
    /**
     * Apply voting logic to combine results
     */
    private applyVotingLogic;
    /**
     * Apply weighted combination
     */
    private applyWeightedCombination;
    /**
     * Group similar responses using simple similarity
     */
    private groupSimilarResponses;
    /**
     * Calculate similarity between two responses
     */
    private calculateSimilarity;
    /**
     * Calculate total cost of ensemble execution
     */
    private calculateTotalCost;
    /**
     * Calculate agreement score among models
     */
    private calculateAgreementScore;
    /**
     * Analyze prompt characteristics
     */
    private analyzePrompt;
    /**
     * Update model performance metrics
     */
    updateModelPerformance(modelId: string, performance: Partial<ModelPerformance>): void;
    /**
     * Get model statistics
     */
    getModelStats(modelId: string): any;
    /**
     * Optimize model selection based on historical performance
     */
    optimizeModelSelection(): Promise<void>;
    /**
     * Get ensemble status
     */
    getStatus(): any;
    /**
     * Start ensemble
     */
    start(): void;
    /**
     * Stop ensemble
     */
    stop(): void;
    /**
     * Reset ensemble
     */
    reset(): void;
}
/**
 * Ensemble factory for common configurations
 */
export declare class EnsembleFactory {
    static createVotingEnsemble(minModels?: number): ModelEnsemble;
    static createWeightedEnsemble(maxModels?: number): ModelEnsemble;
    static createCascadeEnsemble(threshold?: number): ModelEnsemble;
    static createDynamicEnsemble(): ModelEnsemble;
}
export default ModelEnsemble;
//# sourceMappingURL=ModelEnsemble.d.ts.map