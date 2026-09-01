"use strict";
/**
 * ModelEnsemble - Multi-model voting and ensemble strategies
 * Advanced ensemble learning for AI model orchestration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnsembleFactory = exports.ModelEnsemble = void 0;
const events_1 = require("events");
class ModelEnsemble extends events_1.EventEmitter {
    models = new Map();
    strategy;
    performanceHistory = new Map();
    isActive = false;
    constructor(strategy) {
        super();
        this.strategy = strategy;
    }
    /**
     * Register a model in the ensemble
     */
    registerModel(model) {
        this.models.set(model.id, model);
        this.performanceHistory.set(model.id, []);
        this.emit('model:registered', model);
    }
    /**
     * Unregister a model from the ensemble
     */
    unregisterModel(modelId) {
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
    async executeVoting(prompt, options) {
        const startTime = Date.now();
        const contributions = [];
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
                };
            }
            catch (error) {
                this.emit('model:error', { modelId: model.id, error });
                return null;
            }
        });
        const results = (await Promise.all(promises)).filter(r => r !== null);
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
    async executeWeighted(prompt, options) {
        const startTime = Date.now();
        const contributions = [];
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
                };
            }
            catch (error) {
                this.emit('model:error', { modelId: model.id, error });
                return null;
            }
        });
        const results = (await Promise.all(promises)).filter(r => r !== null);
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
    async executeCascade(prompt, options) {
        const startTime = Date.now();
        const contributions = [];
        // Sort models by performance
        const sortedModels = this.sortModelsByPerformance();
        for (const model of sortedModels) {
            const modelStart = Date.now();
            try {
                const response = await this.invokeModel(model, prompt, options);
                const latency = Date.now() - modelStart;
                const contribution = {
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
            }
            catch (error) {
                this.emit('model:error', { modelId: model.id, error });
                continue;
            }
        }
        const bestResult = contributions.reduce((best, current) => current.confidence > best.confidence ? current : best);
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
    async executeDynamic(prompt, options) {
        // Analyze prompt to determine best strategy
        const promptAnalysis = this.analyzePrompt(prompt);
        if (promptAnalysis.complexity === 'high') {
            return this.executeVoting(prompt, options);
        }
        else if (promptAnalysis.requiresSpeed) {
            return this.executeCascade(prompt, options);
        }
        else {
            return this.executeWeighted(prompt, options);
        }
    }
    /**
     * Select models for voting based on diversity
     */
    selectModelsForVoting() {
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
    selectModelsForWeighting() {
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
    sortModelsByPerformance() {
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
    calculatePerformanceScore(model) {
        const p = model.performance;
        return (p.accuracy * 0.4 +
            (1 - p.latency / 10000) * 0.2 +
            (1 - p.cost / 100) * 0.2 +
            p.reliability * 0.2);
    }
    /**
     * Invoke a single model
     */
    async invokeModel(model, prompt, options) {
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
    applyVotingLogic(contributions) {
        if (contributions.length === 0) {
            throw new Error('No contributions to vote on');
        }
        // Group similar responses
        const responseGroups = this.groupSimilarResponses(contributions);
        // Find majority response
        const majorityGroup = responseGroups.reduce((max, group) => group.length > max.length ? group : max);
        const avgConfidence = majorityGroup.reduce((sum, c) => sum + c.confidence, 0) / majorityGroup.length;
        return {
            response: majorityGroup[0].response,
            confidence: avgConfidence
        };
    }
    /**
     * Apply weighted combination
     */
    applyWeightedCombination(contributions) {
        if (contributions.length === 0) {
            throw new Error('No contributions to combine');
        }
        // Weight responses by model weight and confidence
        const weightedScores = contributions.map(c => ({
            response: c.response,
            score: c.weight * c.confidence
        }));
        const best = weightedScores.reduce((max, current) => current.score > max.score ? current : max);
        return {
            response: best.response,
            confidence: best.score
        };
    }
    /**
     * Group similar responses using simple similarity
     */
    groupSimilarResponses(contributions) {
        const groups = [];
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
    calculateSimilarity(response1, response2) {
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
    calculateTotalCost(contributions) {
        return contributions.reduce((sum, c) => {
            const model = this.models.get(c.modelId);
            return sum + (model?.performance.cost || 0);
        }, 0);
    }
    /**
     * Calculate agreement score among models
     */
    calculateAgreementScore(contributions) {
        if (contributions.length < 2)
            return 1.0;
        let totalSimilarity = 0;
        let comparisons = 0;
        for (let i = 0; i < contributions.length; i++) {
            for (let j = i + 1; j < contributions.length; j++) {
                totalSimilarity += this.calculateSimilarity(contributions[i].response, contributions[j].response);
                comparisons++;
            }
        }
        return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
    }
    /**
     * Analyze prompt characteristics
     */
    analyzePrompt(prompt) {
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
    updateModelPerformance(modelId, performance) {
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
    getModelStats(modelId) {
        const history = this.performanceHistory.get(modelId) || [];
        if (history.length === 0)
            return null;
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
    async optimizeModelSelection() {
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
    getStatus() {
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
    start() {
        this.isActive = true;
        this.emit('ensemble:started');
    }
    /**
     * Stop ensemble
     */
    stop() {
        this.isActive = false;
        this.emit('ensemble:stopped');
    }
    /**
     * Reset ensemble
     */
    reset() {
        this.models.clear();
        this.performanceHistory.clear();
        this.isActive = false;
        this.emit('ensemble:reset');
    }
}
exports.ModelEnsemble = ModelEnsemble;
/**
 * Ensemble factory for common configurations
 */
class EnsembleFactory {
    static createVotingEnsemble(minModels = 3) {
        return new ModelEnsemble({
            type: 'voting',
            minModels,
            maxModels: 5,
            threshold: 0.8
        });
    }
    static createWeightedEnsemble(maxModels = 3) {
        return new ModelEnsemble({
            type: 'weighted',
            minModels: 2,
            maxModels,
            threshold: 0.7
        });
    }
    static createCascadeEnsemble(threshold = 0.9) {
        return new ModelEnsemble({
            type: 'cascade',
            minModels: 1,
            maxModels: 5,
            threshold
        });
    }
    static createDynamicEnsemble() {
        return new ModelEnsemble({
            type: 'dynamic',
            minModels: 2,
            maxModels: 5,
            threshold: 0.8
        });
    }
}
exports.EnsembleFactory = EnsembleFactory;
exports.default = ModelEnsemble;
