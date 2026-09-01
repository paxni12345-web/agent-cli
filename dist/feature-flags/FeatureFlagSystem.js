"use strict";
/**
 * Feature Flag and Configuration Management System
 * A/B testing, feature toggles, remote configuration, and experimentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteConfigManager = exports.abTestManager = exports.featureFlagManager = exports.RemoteConfigManager = exports.ABTestManager = exports.FeatureFlagManager = exports.ExperimentStatus = exports.EvaluationReason = exports.RuleOperator = exports.FlagType = void 0;
const EventBus_1 = require("../core/EventBus");
var FlagType;
(function (FlagType) {
    FlagType["Boolean"] = "boolean";
    FlagType["String"] = "string";
    FlagType["Number"] = "number";
    FlagType["JSON"] = "json";
    FlagType["Multivariate"] = "multivariate";
})(FlagType || (exports.FlagType = FlagType = {}));
var RuleOperator;
(function (RuleOperator) {
    RuleOperator["Equals"] = "equals";
    RuleOperator["NotEquals"] = "not_equals";
    RuleOperator["Contains"] = "contains";
    RuleOperator["NotContains"] = "not_contains";
    RuleOperator["GreaterThan"] = "greater_than";
    RuleOperator["LessThan"] = "less_than";
    RuleOperator["In"] = "in";
    RuleOperator["NotIn"] = "not_in";
    RuleOperator["Matches"] = "matches";
})(RuleOperator || (exports.RuleOperator = RuleOperator = {}));
var EvaluationReason;
(function (EvaluationReason) {
    EvaluationReason["Targeting"] = "targeting";
    EvaluationReason["Rollout"] = "rollout";
    EvaluationReason["Default"] = "default";
    EvaluationReason["Disabled"] = "disabled";
    EvaluationReason["Error"] = "error";
})(EvaluationReason || (exports.EvaluationReason = EvaluationReason = {}));
var ExperimentStatus;
(function (ExperimentStatus) {
    ExperimentStatus["Draft"] = "draft";
    ExperimentStatus["Running"] = "running";
    ExperimentStatus["Paused"] = "paused";
    ExperimentStatus["Completed"] = "completed";
})(ExperimentStatus || (exports.ExperimentStatus = ExperimentStatus = {}));
/**
 * Feature Flag Manager
 */
class FeatureFlagManager {
    flags = new Map();
    evaluations = new Map();
    /**
     * Create feature flag
     */
    createFlag(flag) {
        const fullFlag = {
            ...flag,
            id: this.generateFlagId(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.flags.set(fullFlag.key, fullFlag);
        EventBus_1.eventBus.emitSync('feature_flag.created', fullFlag, 'FeatureFlagManager');
        return fullFlag;
    }
    /**
     * Update feature flag
     */
    updateFlag(key, updates) {
        const flag = this.flags.get(key);
        if (!flag) {
            throw new Error(`Feature flag not found: ${key}`);
        }
        Object.assign(flag, updates, { updatedAt: new Date() });
        EventBus_1.eventBus.emitSync('feature_flag.updated', flag, 'FeatureFlagManager');
        return flag;
    }
    /**
     * Evaluate feature flag
     */
    evaluate(key, context, defaultValue = false) {
        const flag = this.flags.get(key);
        if (!flag) {
            return this.createEvaluation(key, defaultValue, EvaluationReason.Error);
        }
        if (!flag.enabled) {
            return this.createEvaluation(key, defaultValue, EvaluationReason.Disabled);
        }
        // Check targeting rules
        if (flag.targeting && this.evaluateTargeting(flag.targeting, context)) {
            const value = this.getTargetedValue(flag, context);
            return this.createEvaluation(key, value, EvaluationReason.Targeting);
        }
        // Check rollout percentage
        if (flag.rolloutPercentage < 100) {
            const hash = this.hashUserId(context.userId, key);
            const inRollout = hash < flag.rolloutPercentage;
            if (!inRollout) {
                return this.createEvaluation(key, defaultValue, EvaluationReason.Rollout);
            }
        }
        // Return flag value
        const value = flag.type === FlagType.Multivariate
            ? this.selectVariant(flag, context)
            : flag.value ?? flag.enabled;
        const evaluation = this.createEvaluation(key, value, EvaluationReason.Default);
        this.recordEvaluation(context.userId, evaluation);
        return evaluation;
    }
    /**
     * Get flag
     */
    getFlag(key) {
        return this.flags.get(key);
    }
    /**
     * List flags
     */
    listFlags(filter) {
        let flags = Array.from(this.flags.values());
        if (filter?.enabled !== undefined) {
            flags = flags.filter(f => f.enabled === filter.enabled);
        }
        if (filter?.type) {
            flags = flags.filter(f => f.type === filter.type);
        }
        return flags;
    }
    /**
     * Delete flag
     */
    deleteFlag(key) {
        this.flags.delete(key);
        EventBus_1.eventBus.emitSync('feature_flag.deleted', { key }, 'FeatureFlagManager');
    }
    /**
     * Get evaluation history
     */
    getEvaluationHistory(userId) {
        return this.evaluations.get(userId) || [];
    }
    evaluateTargeting(rules, context) {
        const results = rules.rules.map(rule => this.evaluateRule(rule, context));
        return rules.operator === 'AND' ? results.every(r => r) : results.some(r => r);
    }
    evaluateRule(rule, context) {
        const attributeValue = context.attributes[rule.attribute];
        switch (rule.operator) {
            case RuleOperator.Equals:
                return attributeValue === rule.value;
            case RuleOperator.NotEquals:
                return attributeValue !== rule.value;
            case RuleOperator.Contains:
                return String(attributeValue).includes(String(rule.value));
            case RuleOperator.NotContains:
                return !String(attributeValue).includes(String(rule.value));
            case RuleOperator.GreaterThan:
                return attributeValue > rule.value;
            case RuleOperator.LessThan:
                return attributeValue < rule.value;
            case RuleOperator.In:
                return Array.isArray(rule.value) && rule.value.includes(attributeValue);
            case RuleOperator.NotIn:
                return Array.isArray(rule.value) && !rule.value.includes(attributeValue);
            case RuleOperator.Matches:
                return new RegExp(rule.value).test(String(attributeValue));
            default:
                return false;
        }
    }
    getTargetedValue(flag, context) {
        if (flag.type === FlagType.Multivariate && flag.variants) {
            return this.selectVariant(flag, context);
        }
        return flag.value ?? flag.enabled;
    }
    selectVariant(flag, context) {
        if (!flag.variants || flag.variants.length === 0) {
            return flag.value;
        }
        const hash = this.hashUserId(context.userId, flag.key);
        let cumulative = 0;
        for (const variant of flag.variants) {
            cumulative += variant.weight;
            if (hash < cumulative) {
                return variant.value;
            }
        }
        return flag.variants[flag.variants.length - 1].value;
    }
    hashUserId(userId, salt) {
        const str = userId + salt;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % 100;
    }
    createEvaluation(flagKey, value, reason) {
        return {
            flagKey,
            value,
            reason,
            timestamp: new Date(),
        };
    }
    recordEvaluation(userId, evaluation) {
        if (!this.evaluations.has(userId)) {
            this.evaluations.set(userId, []);
        }
        this.evaluations.get(userId).push(evaluation);
    }
    generateFlagId() {
        return `flag_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FeatureFlagManager = FeatureFlagManager;
/**
 * A/B Test Manager
 */
class ABTestManager {
    experiments = new Map();
    metrics = new Map();
    flagManager;
    constructor(flagManager) {
        this.flagManager = flagManager;
    }
    /**
     * Create experiment
     */
    createExperiment(experiment) {
        const fullExperiment = {
            ...experiment,
            id: this.generateExperimentId(),
            createdAt: new Date(),
        };
        this.experiments.set(fullExperiment.id, fullExperiment);
        // Create corresponding feature flag
        const variants = fullExperiment.variants.map(v => ({
            id: v.id,
            key: v.key,
            value: v.key,
            weight: v.allocation,
            description: v.name,
        }));
        this.flagManager.createFlag({
            key: fullExperiment.flagKey,
            name: fullExperiment.name,
            description: fullExperiment.description,
            enabled: fullExperiment.status === ExperimentStatus.Running,
            type: FlagType.Multivariate,
            variants,
            rolloutPercentage: 100,
        });
        EventBus_1.eventBus.emitSync('experiment.created', fullExperiment, 'ABTestManager');
        return fullExperiment;
    }
    /**
     * Start experiment
     */
    startExperiment(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experiment not found: ${experimentId}`);
        }
        experiment.status = ExperimentStatus.Running;
        experiment.startDate = new Date();
        this.flagManager.updateFlag(experiment.flagKey, { enabled: true });
        EventBus_1.eventBus.emitSync('experiment.started', experiment, 'ABTestManager');
    }
    /**
     * Stop experiment
     */
    stopExperiment(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experiment not found: ${experimentId}`);
        }
        experiment.status = ExperimentStatus.Completed;
        experiment.endDate = new Date();
        this.flagManager.updateFlag(experiment.flagKey, { enabled: false });
        EventBus_1.eventBus.emitSync('experiment.stopped', experiment, 'ABTestManager');
    }
    /**
     * Track metric
     */
    trackMetric(event) {
        const fullEvent = {
            ...event,
            timestamp: new Date(),
        };
        if (!this.metrics.has(event.experimentId)) {
            this.metrics.set(event.experimentId, []);
        }
        this.metrics.get(event.experimentId).push(fullEvent);
        EventBus_1.eventBus.emitSync('experiment.metric_tracked', fullEvent, 'ABTestManager');
    }
    /**
     * Get experiment results
     */
    getResults(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experiment not found: ${experimentId}`);
        }
        const metrics = this.metrics.get(experimentId) || [];
        const variantResults = [];
        for (const variant of experiment.variants) {
            const variantMetrics = metrics.filter(m => m.variantId === variant.id);
            const uniqueUsers = new Set(variantMetrics.map(m => m.userId)).size;
            const conversions = variantMetrics.length;
            const totalValue = variantMetrics.reduce((sum, m) => sum + m.value, 0);
            variantResults.push({
                variantId: variant.id,
                key: variant.key,
                users: uniqueUsers,
                conversions,
                conversionRate: uniqueUsers > 0 ? conversions / uniqueUsers : 0,
                averageValue: conversions > 0 ? totalValue / conversions : 0,
                totalValue,
            });
        }
        // Simple winner determination (highest conversion rate)
        const winner = variantResults.reduce((prev, current) => current.conversionRate > prev.conversionRate ? current : prev);
        return {
            experimentId,
            variants: variantResults,
            winner: winner.key,
            confidence: this.calculateConfidence(variantResults),
            startDate: experiment.startDate || new Date(),
            endDate: experiment.endDate || new Date(),
        };
    }
    /**
     * Get experiment
     */
    getExperiment(experimentId) {
        return this.experiments.get(experimentId);
    }
    /**
     * List experiments
     */
    listExperiments(filter) {
        let experiments = Array.from(this.experiments.values());
        if (filter?.status) {
            experiments = experiments.filter(e => e.status === filter.status);
        }
        return experiments;
    }
    calculateConfidence(results) {
        if (results.length < 2)
            return 0;
        const control = results.find(r => r.conversionRate > 0);
        if (!control)
            return 0;
        // Simplified confidence calculation
        const maxDiff = Math.max(...results.map(r => Math.abs(r.conversionRate - control.conversionRate)));
        return Math.min(maxDiff * 100, 99);
    }
    generateExperimentId() {
        return `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ABTestManager = ABTestManager;
/**
 * Remote Config Manager
 */
class RemoteConfigManager {
    configs = new Map();
    segments = new Map();
    /**
     * Set config
     */
    setConfig(config) {
        const existing = Array.from(this.configs.values()).find(c => c.key === config.key && c.environment === config.environment);
        const fullConfig = {
            ...config,
            id: existing?.id || this.generateConfigId(),
            version: (existing?.version || 0) + 1,
            updatedAt: new Date(),
        };
        this.configs.set(`${config.key}:${config.environment}`, fullConfig);
        EventBus_1.eventBus.emitSync('remote_config.updated', fullConfig, 'RemoteConfigManager');
        return fullConfig;
    }
    /**
     * Get config
     */
    getConfig(key, environment, context) {
        // Check segments first
        if (context) {
            for (const segment of this.segments.values()) {
                if (this.evaluateSegmentConditions(segment.conditions, context)) {
                    if (segment.configs[key] !== undefined) {
                        return segment.configs[key];
                    }
                }
            }
        }
        // Fall back to default config
        const config = this.configs.get(`${key}:${environment}`);
        return config?.value;
    }
    /**
     * Get all configs
     */
    getAllConfigs(environment, context) {
        const result = {};
        // Get base configs
        for (const [compositeKey, config] of this.configs) {
            if (config.environment === environment) {
                result[config.key] = config.value;
            }
        }
        // Apply segment overrides
        if (context) {
            for (const segment of this.segments.values()) {
                if (this.evaluateSegmentConditions(segment.conditions, context)) {
                    Object.assign(result, segment.configs);
                }
            }
        }
        return result;
    }
    /**
     * Create segment
     */
    createSegment(segment) {
        const fullSegment = {
            ...segment,
            id: this.generateSegmentId(),
        };
        this.segments.set(fullSegment.id, fullSegment);
        EventBus_1.eventBus.emitSync('remote_config.segment_created', fullSegment, 'RemoteConfigManager');
        return fullSegment;
    }
    /**
     * Update segment
     */
    updateSegment(segmentId, updates) {
        const segment = this.segments.get(segmentId);
        if (!segment) {
            throw new Error(`Segment not found: ${segmentId}`);
        }
        Object.assign(segment, updates);
        EventBus_1.eventBus.emitSync('remote_config.segment_updated', segment, 'RemoteConfigManager');
        return segment;
    }
    /**
     * Delete segment
     */
    deleteSegment(segmentId) {
        this.segments.delete(segmentId);
        EventBus_1.eventBus.emitSync('remote_config.segment_deleted', { segmentId }, 'RemoteConfigManager');
    }
    /**
     * List configs
     */
    listConfigs(environment) {
        let configs = Array.from(this.configs.values());
        if (environment) {
            configs = configs.filter(c => c.environment === environment);
        }
        return configs;
    }
    /**
     * List segments
     */
    listSegments() {
        return Array.from(this.segments.values());
    }
    evaluateSegmentConditions(rules, context) {
        const results = rules.rules.map(rule => this.evaluateRule(rule, context));
        return rules.operator === 'AND' ? results.every(r => r) : results.some(r => r);
    }
    evaluateRule(rule, context) {
        const attributeValue = context.attributes[rule.attribute];
        switch (rule.operator) {
            case RuleOperator.Equals:
                return attributeValue === rule.value;
            case RuleOperator.NotEquals:
                return attributeValue !== rule.value;
            case RuleOperator.Contains:
                return String(attributeValue).includes(String(rule.value));
            case RuleOperator.In:
                return Array.isArray(rule.value) && rule.value.includes(attributeValue);
            default:
                return false;
        }
    }
    generateConfigId() {
        return `config_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSegmentId() {
        return `segment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.RemoteConfigManager = RemoteConfigManager;
/**
 * Singleton instances
 */
exports.featureFlagManager = new FeatureFlagManager();
exports.abTestManager = new ABTestManager(exports.featureFlagManager);
exports.remoteConfigManager = new RemoteConfigManager();
