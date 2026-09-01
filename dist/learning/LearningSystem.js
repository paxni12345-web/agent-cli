"use strict";
/**
 * Learning and Adaptation System
 * Reinforcement Learning from Human Feedback (RLHF)
 * Few-shot, Meta-learning, Transfer learning, Online learning
 * Preference learning, Curriculum learning, Active learning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningSystem = void 0;
const events_1 = require("events");
// ============================================================================
// Learning and Adaptation System
// ============================================================================
class LearningSystem extends events_1.EventEmitter {
    feedback = [];
    examples = new Map();
    preferences = [];
    rewardHistory = [];
    policies = new Map();
    curriculum = new Map();
    transferKnowledge = new Map();
    config;
    // RLHF components
    rewardModel;
    valueFunction = new Map();
    qTable = new Map();
    // Meta-learning
    metaParameters = new Map();
    taskEmbeddings = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            learningRate: 0.01,
            discountFactor: 0.99,
            explorationRate: 0.1,
            batchSize: 32,
            updateFrequency: 100,
            enableRLHF: true,
            enableFewShot: true,
            enableMetaLearning: true,
            enableTransfer: true,
            enableCurriculum: true,
            enableActive: true,
            ...config,
        };
        this.rewardModel = new RewardModel();
        this.initializeDefaultPolicy();
    }
    // ========================================================================
    // Reinforcement Learning from Human Feedback (RLHF)
    // ========================================================================
    async learnFromFeedback(feedback) {
        this.feedback.push(feedback);
        this.emit('feedback:received', { feedback });
        // Update reward model
        await this.updateRewardModel(feedback);
        // Generate reward signal
        const reward = this.computeReward(feedback);
        const signal = {
            taskId: feedback.taskId,
            action: 'perform_task',
            reward,
            state: feedback.context,
            nextState: feedback.context,
            terminal: true,
        };
        this.rewardHistory.push(signal);
        // Update policy if enough feedback accumulated
        if (this.feedback.length % this.config.updateFrequency === 0) {
            await this.updatePolicy();
        }
        this.emit('feedback:processed', { feedback, reward });
    }
    async updateRewardModel(feedback) {
        // Train reward model on feedback
        this.rewardModel.train(feedback);
        this.emit('reward_model:updated', { feedback });
    }
    computeReward(feedback) {
        switch (feedback.type) {
            case 'positive':
                return feedback.rating ? feedback.rating / 5 : 1.0;
            case 'negative':
                return feedback.rating ? (feedback.rating - 5) / 5 : -1.0;
            case 'correction':
                return -0.5; // Moderate penalty, but provides learning signal
            case 'neutral':
            default:
                return 0.0;
        }
    }
    async updatePolicy() {
        this.emit('policy:update:start');
        const currentPolicy = this.getCurrentPolicy();
        const updates = await this.computePolicyGradient();
        // Apply updates
        for (const [param, gradient] of updates.entries()) {
            const currentValue = currentPolicy.parameters.get(param) || 0;
            const newValue = currentValue + this.config.learningRate * gradient;
            currentPolicy.parameters.set(param, newValue);
        }
        // Evaluate new policy
        const performance = await this.evaluatePolicy(currentPolicy);
        currentPolicy.performance = performance;
        const policyUpdate = {
            id: this.generateId(),
            before: this.clonePolicy(currentPolicy),
            after: currentPolicy,
            improvement: performance - currentPolicy.performance,
            timestamp: Date.now(),
        };
        this.emit('policy:updated', { update: policyUpdate });
    }
    async computePolicyGradient() {
        const gradients = new Map();
        // Simplified policy gradient computation
        const recentRewards = this.rewardHistory.slice(-this.config.batchSize);
        const avgReward = recentRewards.reduce((sum, r) => sum + r.reward, 0) / recentRewards.length;
        // Update parameters based on reward
        gradients.set('temperature', avgReward * 0.1);
        gradients.set('exploration', -avgReward * 0.05);
        gradients.set('confidence_threshold', avgReward * 0.1);
        return gradients;
    }
    // ========================================================================
    // Few-Shot Learning
    // ========================================================================
    async fewShotLearn(prompt) {
        this.emit('few_shot:start', { prompt });
        // Select most relevant examples
        const selectedExamples = await this.selectRelevantExamples(prompt.examples, prompt.query, prompt.similarityThreshold);
        // Adapt model based on examples
        const adapted = await this.adaptFromExamples(selectedExamples);
        // Generate output
        const output = await this.generateWithExamples(prompt.query, selectedExamples);
        this.emit('few_shot:complete', { output });
        return output;
    }
    async selectRelevantExamples(examples, query, threshold) {
        const scored = examples.map(ex => ({
            example: ex,
            similarity: this.computeSimilarity(ex.input, query),
        }));
        return scored
            .filter(s => s.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)
            .map(s => s.example);
    }
    computeSimilarity(input1, input2) {
        // Simplified similarity computation
        const str1 = JSON.stringify(input1).toLowerCase();
        const str2 = JSON.stringify(input2).toLowerCase();
        const words1 = new Set(str1.split(/\s+/));
        const words2 = new Set(str2.split(/\s+/));
        const intersection = Array.from(words1).filter(w => words2.has(w)).length;
        const union = words1.size + words2.size - intersection;
        return union > 0 ? intersection / union : 0;
    }
    async adaptFromExamples(examples) {
        // Fine-tune on examples
        for (const example of examples) {
            this.examples.set(example.id, example);
        }
        this.emit('examples:adapted', { count: examples.length });
    }
    async generateWithExamples(query, examples) {
        // Use examples as context for generation
        // In production, this would prompt an LLM with the examples
        return {
            result: 'Generated output based on examples',
            confidence: 0.8,
            examplesUsed: examples.length,
        };
    }
    // ========================================================================
    // Meta-Learning (Learning to Learn)
    // ========================================================================
    async metaLearn(task) {
        this.emit('meta_learning:start', { task });
        const initialPerformance = await this.evaluateOnExamples(task.testExamples);
        // Inner loop: adapt to task
        for (let step = 0; step < task.adaptationSteps; step++) {
            await this.innerLoopUpdate(task.trainExamples);
        }
        const finalPerformance = await this.evaluateOnExamples(task.testExamples);
        // Outer loop: update meta-parameters
        await this.outerLoopUpdate(task, finalPerformance - initialPerformance);
        const result = {
            taskId: task.id,
            initialPerformance,
            finalPerformance,
            adaptationSteps: task.adaptationSteps,
            convergence: finalPerformance > 0.8,
            learnedParameters: new Map(this.metaParameters),
        };
        this.emit('meta_learning:complete', { result });
        return result;
    }
    async innerLoopUpdate(examples) {
        // Fast adaptation on task-specific examples
        for (const example of examples) {
            // Compute gradient and update
            const loss = this.computeLoss(example);
            // Update task-specific parameters
        }
    }
    async outerLoopUpdate(task, improvement) {
        // Update meta-parameters to improve adaptation
        for (const [param, value] of this.metaParameters.entries()) {
            const gradient = improvement * 0.01; // Simplified
            this.metaParameters.set(param, value + gradient);
        }
        // Store task embedding
        this.taskEmbeddings.set(task.id, this.computeTaskEmbedding(task));
    }
    computeTaskEmbedding(task) {
        // Compute embedding representing task characteristics
        return [
            task.trainExamples.length,
            task.adaptationSteps,
            this.computeAvgDifficulty(task.trainExamples),
        ];
    }
    computeAvgDifficulty(examples) {
        return examples.reduce((sum, ex) => sum + (1 - ex.quality), 0) / examples.length;
    }
    // ========================================================================
    // Transfer Learning
    // ========================================================================
    async transferKnowledgeFrom(sourceTask, targetTask) {
        this.emit('transfer:start', { sourceTask, targetTask });
        // Compute task similarity
        const similarity = this.computeTaskSimilarity(sourceTask, targetTask);
        // Identify transferable knowledge
        const transferable = await this.identifyTransferableKnowledge(sourceTask, targetTask, similarity);
        // Apply transfer
        await this.applyTransfer(targetTask, transferable);
        const context = {
            sourceTask,
            targetTask,
            similarity,
            transferableKnowledge: transferable,
        };
        this.transferKnowledge.set(targetTask, transferable);
        this.emit('transfer:complete', { context });
        return context;
    }
    computeTaskSimilarity(task1, task2) {
        const emb1 = this.taskEmbeddings.get(task1) || [0, 0, 0];
        const emb2 = this.taskEmbeddings.get(task2) || [0, 0, 0];
        // Cosine similarity
        const dot = emb1.reduce((sum, val, i) => sum + val * emb2[i], 0);
        const norm1 = Math.sqrt(emb1.reduce((sum, val) => sum + val * val, 0));
        const norm2 = Math.sqrt(emb2.reduce((sum, val) => sum + val * val, 0));
        return norm1 * norm2 > 0 ? dot / (norm1 * norm2) : 0;
    }
    async identifyTransferableKnowledge(sourceTask, targetTask, similarity) {
        const components = [];
        // Parameters that transfer well
        components.push({
            type: 'parameter',
            name: 'learning_rate',
            value: this.config.learningRate,
            transferability: similarity,
        });
        // Strategies that might transfer
        components.push({
            type: 'strategy',
            name: 'exploration_strategy',
            value: 'epsilon-greedy',
            transferability: similarity * 0.8,
        });
        // Patterns from source task
        components.push({
            type: 'pattern',
            name: 'common_patterns',
            value: this.extractPatterns(sourceTask),
            transferability: similarity * 0.6,
        });
        return components.filter(c => c.transferability > 0.3);
    }
    extractPatterns(taskId) {
        // Extract common patterns from task examples
        return ['pattern1', 'pattern2'];
    }
    async applyTransfer(targetTask, knowledge) {
        for (const component of knowledge) {
            switch (component.type) {
                case 'parameter':
                    // Apply parameter to target task
                    break;
                case 'strategy':
                    // Apply strategy to target task
                    break;
                case 'pattern':
                    // Use pattern for target task
                    break;
            }
        }
        this.emit('transfer:applied', { targetTask, components: knowledge.length });
    }
    // ========================================================================
    // Curriculum Learning
    // ========================================================================
    async createCurriculum(taskFamily, examples) {
        this.emit('curriculum:create:start', { taskFamily });
        // Sort examples by difficulty
        const sorted = examples.sort((a, b) => (1 - a.quality) - (1 - b.quality));
        // Create stages
        const stages = [];
        const stageSize = Math.ceil(sorted.length / 5);
        for (let i = 0; i < 5; i++) {
            const stageExamples = sorted.slice(i * stageSize, (i + 1) * stageSize);
            const avgDifficulty = this.computeAvgDifficulty(stageExamples);
            const stage = {
                id: this.generateId(),
                level: i + 1,
                name: `Stage ${i + 1}`,
                difficulty: avgDifficulty,
                prerequisites: i > 0 ? [stages[i - 1].id] : [],
                tasks: stageExamples,
                masteryThreshold: 0.8,
                currentMastery: 0,
            };
            stages.push(stage);
            this.curriculum.set(stage.id, stage);
        }
        this.emit('curriculum:created', { stages: stages.length });
        return stages;
    }
    async trainOnCurriculum(curriculumId, maxEpochs = 10) {
        this.emit('curriculum:train:start', { curriculumId });
        const progress = {
            curriculumId,
            completedStages: [],
            currentStage: 0,
            overallMastery: 0,
            epochs: 0,
        };
        const stages = Array.from(this.curriculum.values()).sort((a, b) => a.level - b.level);
        for (const stage of stages) {
            let mastery = 0;
            let epoch = 0;
            while (mastery < stage.masteryThreshold && epoch < maxEpochs) {
                mastery = await this.trainOnStage(stage);
                epoch++;
                progress.epochs++;
            }
            stage.currentMastery = mastery;
            if (mastery >= stage.masteryThreshold) {
                progress.completedStages.push(stage.id);
                progress.currentStage++;
            }
            else {
                break; // Failed to master stage
            }
        }
        progress.overallMastery = this.computeOverallMastery(stages);
        this.emit('curriculum:train:complete', { progress });
        return progress;
    }
    async trainOnStage(stage) {
        let correct = 0;
        for (const example of stage.tasks) {
            const prediction = await this.predict(example.input);
            if (this.isCorrect(prediction, example.output)) {
                correct++;
            }
        }
        return correct / stage.tasks.length;
    }
    computeOverallMastery(stages) {
        if (stages.length === 0)
            return 0;
        return stages.reduce((sum, s) => sum + s.currentMastery, 0) / stages.length;
    }
    // ========================================================================
    // Active Learning
    // ========================================================================
    async selectQueriesForLabeling(candidates, budget) {
        this.emit('active_learning:start', { candidates: candidates.length, budget });
        const queries = [];
        for (const candidate of candidates) {
            const uncertainty = await this.estimateUncertainty(candidate);
            const informativeness = await this.estimateInformativeness(candidate);
            const priority = this.computeAcquisitionScore(uncertainty, informativeness, 'uncertainty');
            queries.push({
                id: this.generateId(),
                candidate,
                uncertainty,
                informativeness,
                priority,
                acquisitionFunction: 'uncertainty',
            });
        }
        // Select top queries by priority
        const selected = queries
            .sort((a, b) => b.priority - a.priority)
            .slice(0, budget);
        this.emit('active_learning:selected', { queries: selected.length });
        return selected;
    }
    async estimateUncertainty(candidate) {
        // Estimate model uncertainty on this candidate
        // Could use ensemble disagreement, entropy, etc.
        return Math.random(); // Simplified
    }
    async estimateInformativeness(candidate) {
        // Estimate how much we would learn from labeling this
        return Math.random(); // Simplified
    }
    computeAcquisitionScore(uncertainty, informativeness, strategy) {
        switch (strategy) {
            case 'uncertainty':
                return uncertainty;
            case 'diversity':
                return informativeness;
            case 'expected_improvement':
                return uncertainty * informativeness;
            default:
                return uncertainty;
        }
    }
    // ========================================================================
    // Preference Learning
    // ========================================================================
    async learnFromPreference(preference) {
        this.preferences.push(preference);
        this.emit('preference:received', { preference });
        // Update reward model based on preference
        this.rewardModel.trainOnPreference(preference);
        // Update policy if enough preferences accumulated
        if (this.preferences.length % this.config.updateFrequency === 0) {
            await this.updatePolicyFromPreferences();
        }
        this.emit('preference:processed', { preference });
    }
    async updatePolicyFromPreferences() {
        const recentPrefs = this.preferences.slice(-this.config.batchSize);
        // Aggregate preferences into policy updates
        const updates = this.aggregatePreferences(recentPrefs);
        // Apply updates to policy
        const currentPolicy = this.getCurrentPolicy();
        for (const [param, value] of updates.entries()) {
            currentPolicy.parameters.set(param, value);
        }
        this.emit('policy:updated:from:preferences');
    }
    aggregatePreferences(preferences) {
        const aggregated = new Map();
        // Simplified aggregation
        const avgStrength = preferences.reduce((sum, p) => sum + p.strength, 0) / preferences.length;
        aggregated.set('preference_weight', avgStrength);
        return aggregated;
    }
    // ========================================================================
    // Online Learning
    // ========================================================================
    async onlineUpdate(example) {
        this.emit('online:update:start', { example });
        // Store example
        this.examples.set(example.id, example);
        // Immediate update (no batching)
        await this.incrementalUpdate(example);
        this.emit('online:update:complete', { example });
    }
    async incrementalUpdate(example) {
        // Perform single-example gradient update
        const loss = this.computeLoss(example);
        const gradient = this.computeGradient(example, loss);
        // Update parameters
        const policy = this.getCurrentPolicy();
        for (const [param, grad] of gradient.entries()) {
            const current = policy.parameters.get(param) || 0;
            policy.parameters.set(param, current - this.config.learningRate * grad);
        }
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    initializeDefaultPolicy() {
        const policy = {
            name: 'default',
            parameters: new Map([
                ['temperature', 0.7],
                ['exploration', 0.1],
                ['confidence_threshold', 0.5],
            ]),
            performance: 0.5,
            confidence: 0.5,
        };
        this.policies.set('default', policy);
    }
    getCurrentPolicy() {
        return this.policies.get('default');
    }
    async evaluatePolicy(policy) {
        // Evaluate policy performance
        const recentRewards = this.rewardHistory.slice(-100);
        if (recentRewards.length === 0)
            return 0.5;
        return recentRewards.reduce((sum, r) => sum + r.reward, 0) / recentRewards.length;
    }
    clonePolicy(policy) {
        return {
            name: policy.name,
            parameters: new Map(policy.parameters),
            performance: policy.performance,
            confidence: policy.confidence,
        };
    }
    async evaluateOnExamples(examples) {
        let correct = 0;
        for (const example of examples) {
            const prediction = await this.predict(example.input);
            if (this.isCorrect(prediction, example.output)) {
                correct++;
            }
        }
        return correct / examples.length;
    }
    async predict(input) {
        // Make prediction
        return { prediction: 'result' };
    }
    isCorrect(prediction, expected) {
        return JSON.stringify(prediction) === JSON.stringify(expected);
    }
    computeLoss(example) {
        // Compute loss for example
        return 1 - example.quality;
    }
    computeGradient(example, loss) {
        // Compute gradient
        return new Map([
            ['temperature', loss * 0.1],
            ['exploration', loss * 0.05],
        ]);
    }
    generateId() {
        return `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    // ========================================================================
    // Public Query Methods
    // ========================================================================
    getFeedback() {
        return [...this.feedback];
    }
    getExamples() {
        return Array.from(this.examples.values());
    }
    getPreferences() {
        return [...this.preferences];
    }
    getPolicy(name = 'default') {
        return this.policies.get(name);
    }
    getCurriculum() {
        return Array.from(this.curriculum.values());
    }
    getTransferredKnowledge(taskId) {
        return this.transferKnowledge.get(taskId) || [];
    }
}
exports.LearningSystem = LearningSystem;
// ============================================================================
// Reward Model
// ============================================================================
class RewardModel {
    weights = new Map();
    train(feedback) {
        // Train reward model on feedback
        const features = this.extractFeatures(feedback);
        const target = this.feedbackToReward(feedback);
        // Update weights (simplified)
        for (const [feature, value] of features.entries()) {
            const current = this.weights.get(feature) || 0;
            this.weights.set(feature, current + 0.01 * (target - this.predict(features)));
        }
    }
    trainOnPreference(preference) {
        // Train on pairwise preference
        const features1 = this.extractFeaturesFromOption(preference.option1);
        const features2 = this.extractFeaturesFromOption(preference.option2);
        const reward1 = this.predict(features1);
        const reward2 = this.predict(features2);
        // Update to make preferred option have higher reward
        if (preference.preferred === 'option1' && reward1 <= reward2) {
            this.adjustWeights(features1, 0.01);
            this.adjustWeights(features2, -0.01);
        }
        else if (preference.preferred === 'option2' && reward2 <= reward1) {
            this.adjustWeights(features2, 0.01);
            this.adjustWeights(features1, -0.01);
        }
    }
    predict(features) {
        let sum = 0;
        for (const [feature, value] of features.entries()) {
            sum += (this.weights.get(feature) || 0) * value;
        }
        return sum;
    }
    extractFeatures(feedback) {
        return new Map([
            ['task_completed', 1.0],
            ['user_rating', feedback.rating || 0],
            ['has_comment', feedback.comment ? 1.0 : 0],
        ]);
    }
    extractFeaturesFromOption(option) {
        return new Map([
            ['quality', Math.random()],
            ['complexity', Math.random()],
        ]);
    }
    feedbackToReward(feedback) {
        if (feedback.type === 'positive')
            return 1.0;
        if (feedback.type === 'negative')
            return -1.0;
        return 0.0;
    }
    adjustWeights(features, delta) {
        for (const [feature, value] of features.entries()) {
            const current = this.weights.get(feature) || 0;
            this.weights.set(feature, current + delta * value);
        }
    }
}
// ============================================================================
// Export
// ============================================================================
exports.default = LearningSystem;
