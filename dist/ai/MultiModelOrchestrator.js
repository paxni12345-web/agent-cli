"use strict";
/**
 * Multi-Model Orchestrator - Intelligently route tasks to the best AI model
 * Supports multiple providers with automatic fallback and cost optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrator = exports.MultiModelOrchestrator = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Orchestrates multiple AI models with intelligent routing
 */
class MultiModelOrchestrator {
    models = new Map();
    requestHistory = [];
    maxHistorySize = 1000;
    /**
     * Register a model configuration
     */
    registerModel(name, config) {
        this.models.set(name, config);
        EventBus_1.eventBus.emitSync('orchestrator.model_registered', { name, modelName: config.modelName }, 'MultiModelOrchestrator');
    }
    /**
     * Unregister a model
     */
    unregisterModel(name) {
        this.models.delete(name);
        EventBus_1.eventBus.emitSync('orchestrator.model_unregistered', { name }, 'MultiModelOrchestrator');
    }
    /**
     * Intelligently route a request to the best model
     */
    async route(request, requirements) {
        const decision = this.selectModel(request, requirements);
        EventBus_1.eventBus.emitSync('orchestrator.routing_decision', {
            selected: decision.selectedModel,
            reason: decision.reason,
            fallbacks: decision.fallbackModels,
        }, 'MultiModelOrchestrator');
        // Try primary model
        try {
            return await this.executeWithModel(decision.selectedModel, request);
        }
        catch (error) {
            // Try fallbacks
            for (const fallbackName of decision.fallbackModels) {
                try {
                    EventBus_1.eventBus.emitSync('orchestrator.fallback', {
                        from: decision.selectedModel,
                        to: fallbackName,
                        error: error instanceof Error ? error.message : String(error),
                    }, 'MultiModelOrchestrator');
                    return await this.executeWithModel(fallbackName, request);
                }
                catch (fallbackError) {
                    // Continue to next fallback
                    continue;
                }
            }
            // All models failed
            throw new Error(`All models failed. Primary: ${error instanceof Error ? error.message : error}`);
        }
    }
    /**
     * Select the best model based on requirements
     */
    selectModel(request, requirements) {
        if (this.models.size === 0) {
            throw new Error('No models registered');
        }
        const reqs = {
            reasoning: requirements?.reasoning ?? 50,
            speed: requirements?.speed ?? 50,
            costSensitivity: requirements?.costSensitivity ?? 50,
            contextLength: requirements?.contextLength ?? 4000,
            requiresMultimodal: requirements?.requiresMultimodal ?? false,
        };
        // Calculate score for each model
        const scores = [];
        for (const [name, config] of this.models) {
            // Check if model meets basic requirements
            if (reqs.requiresMultimodal && !config.capabilities.multimodal) {
                continue;
            }
            if (reqs.contextLength > config.capabilities.contextWindow) {
                continue;
            }
            // Calculate weighted score
            let score = 0;
            // Reasoning capability match
            const reasoningDiff = Math.abs(config.capabilities.reasoning - reqs.reasoning);
            score += (100 - reasoningDiff) * 0.3;
            // Speed match
            const speedDiff = Math.abs(config.capabilities.speed - reqs.speed);
            score += (100 - speedDiff) * 0.2;
            // Cost efficiency
            score +=
                config.capabilities.costEfficiency *
                    (reqs.costSensitivity / 100) *
                    0.3;
            // Recent success rate
            const successRate = this.getSuccessRate(name);
            score += successRate * 0.2;
            scores.push({ name, score, config });
        }
        if (scores.length === 0) {
            throw new Error('No suitable model found for requirements');
        }
        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);
        const selected = scores[0];
        const fallbacks = scores.slice(1, 4).map((s) => s.name);
        // Estimate cost and time
        const estimatedTokens = this.estimateTokens(request);
        const estimatedCost = (estimatedTokens.input * selected.config.costPerToken.input +
            estimatedTokens.output * selected.config.costPerToken.output) /
            1_000_000;
        const estimatedTime = this.estimateLatency(selected.name);
        return {
            selectedModel: selected.name,
            reason: this.generateReason(selected.name, selected.config, reqs),
            estimatedCost,
            estimatedTime,
            fallbackModels: fallbacks,
        };
    }
    /**
     * Execute request with specific model
     */
    async executeWithModel(modelName, request) {
        const config = this.models.get(modelName);
        if (!config) {
            throw new Error(`Model ${modelName} not found`);
        }
        const startTime = Date.now();
        let success = false;
        try {
            const response = await config.provider.chat(request);
            success = true;
            // Record success
            this.recordRequest(modelName, success, Date.now() - startTime);
            return response;
        }
        catch (error) {
            // Record failure
            this.recordRequest(modelName, success, Date.now() - startTime);
            throw error;
        }
    }
    /**
     * Get model statistics
     */
    getModelStats(modelName) {
        const requests = this.requestHistory.filter((r) => r.model === modelName);
        if (requests.length === 0) {
            return { totalRequests: 0, successRate: 100, avgLatency: 0 };
        }
        const successes = requests.filter((r) => r.success).length;
        const avgLatency = requests.reduce((sum, r) => sum + r.latency, 0) / requests.length;
        return {
            totalRequests: requests.length,
            successRate: (successes / requests.length) * 100,
            avgLatency,
        };
    }
    /**
     * List all registered models
     */
    listModels() {
        return Array.from(this.models.entries()).map(([name, config]) => ({
            name,
            modelName: config.modelName,
            capabilities: config.capabilities,
            stats: this.getModelStats(name),
        }));
    }
    /**
     * Clear request history
     */
    clearHistory() {
        this.requestHistory = [];
    }
    recordRequest(model, success, latency) {
        this.requestHistory.push({
            model,
            success,
            latency,
            timestamp: new Date(),
        });
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory.shift();
        }
    }
    getSuccessRate(modelName) {
        const recentRequests = this.requestHistory
            .filter((r) => r.model === modelName)
            .slice(-20); // Last 20 requests
        if (recentRequests.length === 0) {
            return 100; // Assume good if no history
        }
        const successes = recentRequests.filter((r) => r.success).length;
        return (successes / recentRequests.length) * 100;
    }
    estimateLatency(modelName) {
        const stats = this.getModelStats(modelName);
        return stats.avgLatency || 2000; // Default 2s if no history
    }
    estimateTokens(request) {
        // Rough estimation: ~4 chars per token
        const inputChars = request.messages.reduce((sum, msg) => sum + String(msg.content).length, 0);
        return {
            input: Math.ceil(inputChars / 4),
            output: 500, // Assume average response
        };
    }
    generateReason(modelName, config, requirements) {
        const reasons = [];
        if (requirements.reasoning > 70 && config.capabilities.reasoning > 80) {
            reasons.push('high reasoning capability');
        }
        if (requirements.speed > 70 && config.capabilities.speed > 80) {
            reasons.push('fast response time');
        }
        if (requirements.costSensitivity > 70 &&
            config.capabilities.costEfficiency > 80) {
            reasons.push('cost efficient');
        }
        if (requirements.requiresMultimodal && config.capabilities.multimodal) {
            reasons.push('multimodal support');
        }
        if (reasons.length === 0) {
            reasons.push('best overall match');
        }
        return `Selected ${modelName}: ${reasons.join(', ')}`;
    }
}
exports.MultiModelOrchestrator = MultiModelOrchestrator;
/**
 * Singleton instance
 */
exports.orchestrator = new MultiModelOrchestrator();
