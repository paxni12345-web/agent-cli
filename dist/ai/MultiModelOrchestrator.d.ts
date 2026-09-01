/**
 * Multi-Model Orchestrator - Intelligently route tasks to the best AI model
 * Supports multiple providers with automatic fallback and cost optimization
 */
import { AIProvider } from '../providers/AIProvider';
import { ChatRequest, ChatResponse } from '../types';
export interface ModelCapability {
    reasoning: number;
    coding: number;
    speed: number;
    costEfficiency: number;
    contextWindow: number;
    multimodal: boolean;
}
export interface ModelConfig {
    provider: AIProvider;
    modelName: string;
    capabilities: ModelCapability;
    costPerToken: {
        input: number;
        output: number;
    };
    maxRetries: number;
    timeout: number;
}
export interface TaskRequirements {
    reasoning?: number;
    speed?: number;
    costSensitivity?: number;
    contextLength?: number;
    requiresMultimodal?: boolean;
}
export interface RoutingDecision {
    selectedModel: string;
    reason: string;
    estimatedCost: number;
    estimatedTime: number;
    fallbackModels: string[];
}
/**
 * Orchestrates multiple AI models with intelligent routing
 */
export declare class MultiModelOrchestrator {
    private models;
    private requestHistory;
    private maxHistorySize;
    /**
     * Register a model configuration
     */
    registerModel(name: string, config: ModelConfig): void;
    /**
     * Unregister a model
     */
    unregisterModel(name: string): void;
    /**
     * Intelligently route a request to the best model
     */
    route(request: ChatRequest, requirements?: TaskRequirements): Promise<ChatResponse>;
    /**
     * Select the best model based on requirements
     */
    selectModel(request: ChatRequest, requirements?: TaskRequirements): RoutingDecision;
    /**
     * Execute request with specific model
     */
    private executeWithModel;
    /**
     * Get model statistics
     */
    getModelStats(modelName: string): {
        totalRequests: number;
        successRate: number;
        avgLatency: number;
    };
    /**
     * List all registered models
     */
    listModels(): Array<{
        name: string;
        modelName: string;
        capabilities: ModelCapability;
        stats: ReturnType<typeof this.getModelStats>;
    }>;
    /**
     * Clear request history
     */
    clearHistory(): void;
    private recordRequest;
    private getSuccessRate;
    private estimateLatency;
    private estimateTokens;
    private generateReason;
}
/**
 * Singleton instance
 */
export declare const orchestrator: MultiModelOrchestrator;
//# sourceMappingURL=MultiModelOrchestrator.d.ts.map