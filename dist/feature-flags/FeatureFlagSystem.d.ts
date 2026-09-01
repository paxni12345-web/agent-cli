/**
 * Feature Flag and Configuration Management System
 * A/B testing, feature toggles, remote configuration, and experimentation
 */
export interface FeatureFlag {
    id: string;
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    type: FlagType;
    value?: any;
    targeting?: TargetingRules;
    variants?: FlagVariant[];
    rolloutPercentage: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum FlagType {
    Boolean = "boolean",
    String = "string",
    Number = "number",
    JSON = "json",
    Multivariate = "multivariate"
}
export interface TargetingRules {
    rules: TargetingRule[];
    operator: 'AND' | 'OR';
}
export interface TargetingRule {
    attribute: string;
    operator: RuleOperator;
    value: any;
}
export declare enum RuleOperator {
    Equals = "equals",
    NotEquals = "not_equals",
    Contains = "contains",
    NotContains = "not_contains",
    GreaterThan = "greater_than",
    LessThan = "less_than",
    In = "in",
    NotIn = "not_in",
    Matches = "matches"
}
export interface FlagVariant {
    id: string;
    key: string;
    value: any;
    weight: number;
    description?: string;
}
export interface UserContext {
    userId: string;
    email?: string;
    attributes: Record<string, any>;
}
export interface FlagEvaluation {
    flagKey: string;
    value: any;
    variant?: string;
    reason: EvaluationReason;
    timestamp: Date;
}
export declare enum EvaluationReason {
    Targeting = "targeting",
    Rollout = "rollout",
    Default = "default",
    Disabled = "disabled",
    Error = "error"
}
export interface Experiment {
    id: string;
    name: string;
    description: string;
    flagKey: string;
    variants: ExperimentVariant[];
    status: ExperimentStatus;
    allocation: AllocationStrategy;
    metrics: string[];
    startDate?: Date;
    endDate?: Date;
    createdAt: Date;
}
export declare enum ExperimentStatus {
    Draft = "draft",
    Running = "running",
    Paused = "paused",
    Completed = "completed"
}
export interface ExperimentVariant {
    id: string;
    key: string;
    name: string;
    allocation: number;
    isControl: boolean;
}
export interface AllocationStrategy {
    type: 'percentage' | 'user_id' | 'custom';
    seed?: string;
}
export interface MetricEvent {
    experimentId: string;
    variantId: string;
    userId: string;
    metricName: string;
    value: number;
    timestamp: Date;
}
export interface ExperimentResults {
    experimentId: string;
    variants: VariantResults[];
    winner?: string;
    confidence: number;
    startDate: Date;
    endDate: Date;
}
export interface VariantResults {
    variantId: string;
    key: string;
    users: number;
    conversions: number;
    conversionRate: number;
    averageValue: number;
    totalValue: number;
}
export interface RemoteConfig {
    id: string;
    key: string;
    value: any;
    type: string;
    environment: string;
    version: number;
    updatedAt: Date;
}
export interface ConfigSegment {
    id: string;
    name: string;
    conditions: TargetingRules;
    configs: Record<string, any>;
}
/**
 * Feature Flag Manager
 */
export declare class FeatureFlagManager {
    private flags;
    private evaluations;
    /**
     * Create feature flag
     */
    createFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): FeatureFlag;
    /**
     * Update feature flag
     */
    updateFlag(key: string, updates: Partial<FeatureFlag>): FeatureFlag;
    /**
     * Evaluate feature flag
     */
    evaluate(key: string, context: UserContext, defaultValue?: any): FlagEvaluation;
    /**
     * Get flag
     */
    getFlag(key: string): FeatureFlag | undefined;
    /**
     * List flags
     */
    listFlags(filter?: {
        enabled?: boolean;
        type?: FlagType;
    }): FeatureFlag[];
    /**
     * Delete flag
     */
    deleteFlag(key: string): void;
    /**
     * Get evaluation history
     */
    getEvaluationHistory(userId: string): FlagEvaluation[];
    private evaluateTargeting;
    private evaluateRule;
    private getTargetedValue;
    private selectVariant;
    private hashUserId;
    private createEvaluation;
    private recordEvaluation;
    private generateFlagId;
}
/**
 * A/B Test Manager
 */
export declare class ABTestManager {
    private experiments;
    private metrics;
    private flagManager;
    constructor(flagManager: FeatureFlagManager);
    /**
     * Create experiment
     */
    createExperiment(experiment: Omit<Experiment, 'id' | 'createdAt'>): Experiment;
    /**
     * Start experiment
     */
    startExperiment(experimentId: string): void;
    /**
     * Stop experiment
     */
    stopExperiment(experimentId: string): void;
    /**
     * Track metric
     */
    trackMetric(event: Omit<MetricEvent, 'timestamp'>): void;
    /**
     * Get experiment results
     */
    getResults(experimentId: string): ExperimentResults;
    /**
     * Get experiment
     */
    getExperiment(experimentId: string): Experiment | undefined;
    /**
     * List experiments
     */
    listExperiments(filter?: {
        status?: ExperimentStatus;
    }): Experiment[];
    private calculateConfidence;
    private generateExperimentId;
}
/**
 * Remote Config Manager
 */
export declare class RemoteConfigManager {
    private configs;
    private segments;
    /**
     * Set config
     */
    setConfig(config: Omit<RemoteConfig, 'id' | 'version' | 'updatedAt'>): RemoteConfig;
    /**
     * Get config
     */
    getConfig(key: string, environment: string, context?: UserContext): any;
    /**
     * Get all configs
     */
    getAllConfigs(environment: string, context?: UserContext): Record<string, any>;
    /**
     * Create segment
     */
    createSegment(segment: Omit<ConfigSegment, 'id'>): ConfigSegment;
    /**
     * Update segment
     */
    updateSegment(segmentId: string, updates: Partial<ConfigSegment>): ConfigSegment;
    /**
     * Delete segment
     */
    deleteSegment(segmentId: string): void;
    /**
     * List configs
     */
    listConfigs(environment?: string): RemoteConfig[];
    /**
     * List segments
     */
    listSegments(): ConfigSegment[];
    private evaluateSegmentConditions;
    private evaluateRule;
    private generateConfigId;
    private generateSegmentId;
}
/**
 * Singleton instances
 */
export declare const featureFlagManager: FeatureFlagManager;
export declare const abTestManager: ABTestManager;
export declare const remoteConfigManager: RemoteConfigManager;
//# sourceMappingURL=FeatureFlagSystem.d.ts.map