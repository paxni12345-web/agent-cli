/**
 * Feature Flag and Configuration Management System
 * A/B testing, feature toggles, remote configuration, and experimentation
 */

import { eventBus } from '../core/EventBus';

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

export enum FlagType {
  Boolean = 'boolean',
  String = 'string',
  Number = 'number',
  JSON = 'json',
  Multivariate = 'multivariate',
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

export enum RuleOperator {
  Equals = 'equals',
  NotEquals = 'not_equals',
  Contains = 'contains',
  NotContains = 'not_contains',
  GreaterThan = 'greater_than',
  LessThan = 'less_than',
  In = 'in',
  NotIn = 'not_in',
  Matches = 'matches',
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

export enum EvaluationReason {
  Targeting = 'targeting',
  Rollout = 'rollout',
  Default = 'default',
  Disabled = 'disabled',
  Error = 'error',
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

export enum ExperimentStatus {
  Draft = 'draft',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
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
export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private evaluations: Map<string, FlagEvaluation[]> = new Map();

  /**
   * Create feature flag
   */
  createFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): FeatureFlag {
    const fullFlag: FeatureFlag = {
      ...flag,
      id: this.generateFlagId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.flags.set(fullFlag.key, fullFlag);

    eventBus.emitSync('feature_flag.created', fullFlag, 'FeatureFlagManager');

    return fullFlag;
  }

  /**
   * Update feature flag
   */
  updateFlag(key: string, updates: Partial<FeatureFlag>): FeatureFlag {
    const flag = this.flags.get(key);

    if (!flag) {
      throw new Error(`Feature flag not found: ${key}`);
    }

    Object.assign(flag, updates, { updatedAt: new Date() });

    eventBus.emitSync('feature_flag.updated', flag, 'FeatureFlagManager');

    return flag;
  }

  /**
   * Evaluate feature flag
   */
  evaluate(key: string, context: UserContext, defaultValue: any = false): FlagEvaluation {
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
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * List flags
   */
  listFlags(filter?: { enabled?: boolean; type?: FlagType }): FeatureFlag[] {
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
  deleteFlag(key: string): void {
    this.flags.delete(key);
    eventBus.emitSync('feature_flag.deleted', { key }, 'FeatureFlagManager');
  }

  /**
   * Get evaluation history
   */
  getEvaluationHistory(userId: string): FlagEvaluation[] {
    return this.evaluations.get(userId) || [];
  }

  private evaluateTargeting(rules: TargetingRules, context: UserContext): boolean {
    const results = rules.rules.map(rule => this.evaluateRule(rule, context));

    return rules.operator === 'AND' ? results.every(r => r) : results.some(r => r);
  }

  private evaluateRule(rule: TargetingRule, context: UserContext): boolean {
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

  private getTargetedValue(flag: FeatureFlag, context: UserContext): any {
    if (flag.type === FlagType.Multivariate && flag.variants) {
      return this.selectVariant(flag, context);
    }

    return flag.value ?? flag.enabled;
  }

  private selectVariant(flag: FeatureFlag, context: UserContext): any {
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

  private hashUserId(userId: string, salt: string): number {
    const str = userId + salt;
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return Math.abs(hash) % 100;
  }

  private createEvaluation(flagKey: string, value: any, reason: EvaluationReason): FlagEvaluation {
    return {
      flagKey,
      value,
      reason,
      timestamp: new Date(),
    };
  }

  private recordEvaluation(userId: string, evaluation: FlagEvaluation): void {
    if (!this.evaluations.has(userId)) {
      this.evaluations.set(userId, []);
    }

    this.evaluations.get(userId)!.push(evaluation);
  }

  private generateFlagId(): string {
    return `flag_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * A/B Test Manager
 */
export class ABTestManager {
  private experiments: Map<string, Experiment> = new Map();
  private metrics: Map<string, MetricEvent[]> = new Map();
  private flagManager: FeatureFlagManager;

  constructor(flagManager: FeatureFlagManager) {
    this.flagManager = flagManager;
  }

  /**
   * Create experiment
   */
  createExperiment(experiment: Omit<Experiment, 'id' | 'createdAt'>): Experiment {
    const fullExperiment: Experiment = {
      ...experiment,
      id: this.generateExperimentId(),
      createdAt: new Date(),
    };

    this.experiments.set(fullExperiment.id, fullExperiment);

    // Create corresponding feature flag
    const variants: FlagVariant[] = fullExperiment.variants.map(v => ({
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

    eventBus.emitSync('experiment.created', fullExperiment, 'ABTestManager');

    return fullExperiment;
  }

  /**
   * Start experiment
   */
  startExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    experiment.status = ExperimentStatus.Running;
    experiment.startDate = new Date();

    this.flagManager.updateFlag(experiment.flagKey, { enabled: true });

    eventBus.emitSync('experiment.started', experiment, 'ABTestManager');
  }

  /**
   * Stop experiment
   */
  stopExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    experiment.status = ExperimentStatus.Completed;
    experiment.endDate = new Date();

    this.flagManager.updateFlag(experiment.flagKey, { enabled: false });

    eventBus.emitSync('experiment.stopped', experiment, 'ABTestManager');
  }

  /**
   * Track metric
   */
  trackMetric(event: Omit<MetricEvent, 'timestamp'>): void {
    const fullEvent: MetricEvent = {
      ...event,
      timestamp: new Date(),
    };

    if (!this.metrics.has(event.experimentId)) {
      this.metrics.set(event.experimentId, []);
    }

    this.metrics.get(event.experimentId)!.push(fullEvent);

    eventBus.emitSync('experiment.metric_tracked', fullEvent, 'ABTestManager');
  }

  /**
   * Get experiment results
   */
  getResults(experimentId: string): ExperimentResults {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    const metrics = this.metrics.get(experimentId) || [];
    const variantResults: VariantResults[] = [];

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
    const winner = variantResults.reduce((prev, current) =>
      current.conversionRate > prev.conversionRate ? current : prev
    );

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
  getExperiment(experimentId: string): Experiment | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * List experiments
   */
  listExperiments(filter?: { status?: ExperimentStatus }): Experiment[] {
    let experiments = Array.from(this.experiments.values());

    if (filter?.status) {
      experiments = experiments.filter(e => e.status === filter.status);
    }

    return experiments;
  }

  private calculateConfidence(results: VariantResults[]): number {
    if (results.length < 2) return 0;

    const control = results.find(r => r.conversionRate > 0);
    if (!control) return 0;

    // Simplified confidence calculation
    const maxDiff = Math.max(...results.map(r => Math.abs(r.conversionRate - control.conversionRate)));
    return Math.min(maxDiff * 100, 99);
  }

  private generateExperimentId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Remote Config Manager
 */
export class RemoteConfigManager {
  private configs: Map<string, RemoteConfig> = new Map();
  private segments: Map<string, ConfigSegment> = new Map();

  /**
   * Set config
   */
  setConfig(config: Omit<RemoteConfig, 'id' | 'version' | 'updatedAt'>): RemoteConfig {
    const existing = Array.from(this.configs.values()).find(
      c => c.key === config.key && c.environment === config.environment
    );

    const fullConfig: RemoteConfig = {
      ...config,
      id: existing?.id || this.generateConfigId(),
      version: (existing?.version || 0) + 1,
      updatedAt: new Date(),
    };

    this.configs.set(`${config.key}:${config.environment}`, fullConfig);

    eventBus.emitSync('remote_config.updated', fullConfig, 'RemoteConfigManager');

    return fullConfig;
  }

  /**
   * Get config
   */
  getConfig(key: string, environment: string, context?: UserContext): any {
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
  getAllConfigs(environment: string, context?: UserContext): Record<string, any> {
    const result: Record<string, any> = {};

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
  createSegment(segment: Omit<ConfigSegment, 'id'>): ConfigSegment {
    const fullSegment: ConfigSegment = {
      ...segment,
      id: this.generateSegmentId(),
    };

    this.segments.set(fullSegment.id, fullSegment);

    eventBus.emitSync('remote_config.segment_created', fullSegment, 'RemoteConfigManager');

    return fullSegment;
  }

  /**
   * Update segment
   */
  updateSegment(segmentId: string, updates: Partial<ConfigSegment>): ConfigSegment {
    const segment = this.segments.get(segmentId);

    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    Object.assign(segment, updates);

    eventBus.emitSync('remote_config.segment_updated', segment, 'RemoteConfigManager');

    return segment;
  }

  /**
   * Delete segment
   */
  deleteSegment(segmentId: string): void {
    this.segments.delete(segmentId);
    eventBus.emitSync('remote_config.segment_deleted', { segmentId }, 'RemoteConfigManager');
  }

  /**
   * List configs
   */
  listConfigs(environment?: string): RemoteConfig[] {
    let configs = Array.from(this.configs.values());

    if (environment) {
      configs = configs.filter(c => c.environment === environment);
    }

    return configs;
  }

  /**
   * List segments
   */
  listSegments(): ConfigSegment[] {
    return Array.from(this.segments.values());
  }

  private evaluateSegmentConditions(rules: TargetingRules, context: UserContext): boolean {
    const results = rules.rules.map(rule => this.evaluateRule(rule, context));
    return rules.operator === 'AND' ? results.every(r => r) : results.some(r => r);
  }

  private evaluateRule(rule: TargetingRule, context: UserContext): boolean {
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

  private generateConfigId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSegmentId(): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const featureFlagManager = new FeatureFlagManager();
export const abTestManager = new ABTestManager(featureFlagManager);
export const remoteConfigManager = new RemoteConfigManager();
