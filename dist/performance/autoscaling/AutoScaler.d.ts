/**
 * AutoScaler - Predictive auto-scaling with ML-based forecasting
 * Horizontal pod autoscaling, cost optimization, and load prediction
 */
import { EventEmitter } from 'events';
export interface ScalingTarget {
    id: string;
    name: string;
    type: 'pod' | 'instance' | 'function' | 'container';
    minReplicas: number;
    maxReplicas: number;
    currentReplicas: number;
    desiredReplicas: number;
    metrics: ResourceMetrics;
}
export interface ResourceMetrics {
    cpu: number;
    memory: number;
    requests: number;
    latency: number;
    errorRate: number;
    queueDepth: number;
    customMetrics: Map<string, number>;
}
export interface ScalingPolicy {
    id: string;
    name: string;
    targetId: string;
    triggers: ScalingTrigger[];
    cooldownPeriod: number;
    enabled: boolean;
}
export interface ScalingTrigger {
    metric: string;
    threshold: number;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    duration: number;
    scaleDirection: 'up' | 'down';
    scaleAmount: number;
}
export interface ScalingEvent {
    id: string;
    timestamp: Date;
    targetId: string;
    fromReplicas: number;
    toReplicas: number;
    reason: string;
    triggerMetric?: string;
    triggerValue?: number;
    duration?: number;
    cost?: number;
}
export interface PredictionModel {
    id: string;
    type: 'linear' | 'arima' | 'lstm' | 'prophet';
    accuracy: number;
    trained: Date;
    parameters: any;
}
export interface LoadForecast {
    timestamp: Date;
    predictedLoad: number;
    predictedCPU: number;
    predictedMemory: number;
    confidence: number;
    recommendedReplicas: number;
}
export interface CostOptimization {
    currentCost: number;
    optimizedCost: number;
    savings: number;
    recommendations: CostRecommendation[];
}
export interface CostRecommendation {
    type: 'scale_down' | 'right_size' | 'spot_instance' | 'reserved';
    description: string;
    impact: number;
    implementation: string;
}
export declare class AutoScaler extends EventEmitter {
    private targets;
    private policies;
    private events;
    private models;
    private metricsHistory;
    private forecastCache;
    constructor();
    registerTarget(target: ScalingTarget): void;
    addPolicy(policy: ScalingPolicy): void;
    evaluateScaling(targetId: string): Promise<void>;
    private evaluateTrigger;
    private getMetricValue;
    private executeScaling;
    private applyScaling;
    private calculateScalingCost;
    predictLoad(targetId: string, horizon?: number): Promise<LoadForecast[]>;
    private trainModel;
    private calculateTrend;
    private generateForecasts;
    private calculateRecommendedReplicas;
    optimizeCost(targetId: string): Promise<CostOptimization>;
    private calculateCurrentCost;
    private getLastScalingEvent;
    private startMonitoring;
    updateMetrics(targetId: string, metrics: Partial<ResourceMetrics>): void;
    getScalingHistory(targetId: string, limit?: number): ScalingEvent[];
    getStatistics(targetId?: string): any;
    getTarget(targetId: string): ScalingTarget | null;
    listTargets(): ScalingTarget[];
    getPolicy(policyId: string): ScalingPolicy | null;
    listPolicies(): ScalingPolicy[];
    enablePolicy(policyId: string): void;
    disablePolicy(policyId: string): void;
}
export default AutoScaler;
//# sourceMappingURL=AutoScaler.d.ts.map