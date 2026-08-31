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

export class AutoScaler extends EventEmitter {
  private targets: Map<string, ScalingTarget> = new Map();
  private policies: Map<string, ScalingPolicy> = new Map();
  private events: ScalingEvent[] = [];
  private models: Map<string, PredictionModel> = new Map();
  private metricsHistory: Map<string, ResourceMetrics[]> = new Map();
  private forecastCache: Map<string, LoadForecast[]> = new Map();

  constructor() {
    super();
    this.startMonitoring();
  }

  public registerTarget(target: ScalingTarget): void {
    this.targets.set(target.id, target);
    this.metricsHistory.set(target.id, []);
    this.emit('target:registered', target);
  }

  public addPolicy(policy: ScalingPolicy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy:added', policy);
  }

  public async evaluateScaling(targetId: string): Promise<void> {
    const target = this.targets.get(targetId);
    if (!target) return;

    const policies = Array.from(this.policies.values())
      .filter(p => p.targetId === targetId && p.enabled);

    for (const policy of policies) {
      const lastEvent = this.getLastScalingEvent(targetId);

      if (lastEvent) {
        const timeSinceLastScale = Date.now() - lastEvent.timestamp.getTime();
        if (timeSinceLastScale < policy.cooldownPeriod) {
          continue;
        }
      }

      for (const trigger of policy.triggers) {
        const shouldScale = await this.evaluateTrigger(target, trigger);

        if (shouldScale) {
          await this.executeScaling(target, trigger, policy);
        }
      }
    }
  }

  private async evaluateTrigger(
    target: ScalingTarget,
    trigger: ScalingTrigger
  ): Promise<boolean> {
    const metricValue = this.getMetricValue(target.metrics, trigger.metric);

    if (metricValue === undefined) return false;

    let conditionMet = false;

    switch (trigger.operator) {
      case 'gt':
        conditionMet = metricValue > trigger.threshold;
        break;
      case 'lt':
        conditionMet = metricValue < trigger.threshold;
        break;
      case 'gte':
        conditionMet = metricValue >= trigger.threshold;
        break;
      case 'lte':
        conditionMet = metricValue <= trigger.threshold;
        break;
      case 'eq':
        conditionMet = metricValue === trigger.threshold;
        break;
    }

    if (!conditionMet) return false;

    const history = this.metricsHistory.get(target.id) || [];
    const recentMetrics = history.slice(-Math.ceil(trigger.duration / 10000));

    if (recentMetrics.length === 0) return false;

    const allMeetCondition = recentMetrics.every(metrics => {
      const value = this.getMetricValue(metrics, trigger.metric);
      if (value === undefined) return false;

      switch (trigger.operator) {
        case 'gt': return value > trigger.threshold;
        case 'lt': return value < trigger.threshold;
        case 'gte': return value >= trigger.threshold;
        case 'lte': return value <= trigger.threshold;
        case 'eq': return value === trigger.threshold;
        default: return false;
      }
    });

    return allMeetCondition;
  }

  private getMetricValue(metrics: ResourceMetrics, metricName: string): number | undefined {
    switch (metricName) {
      case 'cpu': return metrics.cpu;
      case 'memory': return metrics.memory;
      case 'requests': return metrics.requests;
      case 'latency': return metrics.latency;
      case 'errorRate': return metrics.errorRate;
      case 'queueDepth': return metrics.queueDepth;
      default: return metrics.customMetrics.get(metricName);
    }
  }

  private async executeScaling(
    target: ScalingTarget,
    trigger: ScalingTrigger,
    policy: ScalingPolicy
  ): Promise<void> {
    const startTime = Date.now();
    const fromReplicas = target.currentReplicas;

    let toReplicas: number;

    if (trigger.scaleDirection === 'up') {
      toReplicas = Math.min(
        target.maxReplicas,
        fromReplicas + trigger.scaleAmount
      );
    } else {
      toReplicas = Math.max(
        target.minReplicas,
        fromReplicas - trigger.scaleAmount
      );
    }

    if (toReplicas === fromReplicas) return;

    target.desiredReplicas = toReplicas;

    await this.applyScaling(target, toReplicas);

    target.currentReplicas = toReplicas;

    const event: ScalingEvent = {
      id: `scale_${Date.now()}`,
      timestamp: new Date(),
      targetId: target.id,
      fromReplicas,
      toReplicas,
      reason: `Policy: ${policy.name}`,
      triggerMetric: trigger.metric,
      triggerValue: this.getMetricValue(target.metrics, trigger.metric),
      duration: Date.now() - startTime,
      cost: this.calculateScalingCost(fromReplicas, toReplicas)
    };

    this.events.push(event);
    this.emit('scaling:executed', event);
  }

  private async applyScaling(target: ScalingTarget, replicas: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.emit('scaling:applied', { targetId: target.id, replicas });
  }

  private calculateScalingCost(from: number, to: number): number {
    const costPerReplica = 0.05;
    return Math.abs(to - from) * costPerReplica;
  }

  public async predictLoad(targetId: string, horizon: number = 12): Promise<LoadForecast[]> {
    const target = this.targets.get(targetId);
    if (!target) throw new Error(`Target ${targetId} not found`);

    const cached = this.forecastCache.get(targetId);
    if (cached && cached.length > 0) {
      const latestForecast = cached[0];
      const age = Date.now() - latestForecast.timestamp.getTime();
      if (age < 300000) {
        return cached;
      }
    }

    const history = this.metricsHistory.get(targetId) || [];
    if (history.length < 30) {
      throw new Error('Insufficient historical data for prediction');
    }

    const model = this.models.get(targetId) || this.trainModel(targetId, history);
    const forecasts = this.generateForecasts(model, history, horizon);

    this.forecastCache.set(targetId, forecasts);
    this.emit('forecast:generated', { targetId, forecasts });

    return forecasts;
  }

  private trainModel(targetId: string, history: ResourceMetrics[]): PredictionModel {
    const cpuValues = history.map(m => m.cpu);
    const trend = this.calculateTrend(cpuValues);

    const model: PredictionModel = {
      id: `model_${targetId}`,
      type: 'linear',
      accuracy: 0.85,
      trained: new Date(),
      parameters: { trend, intercept: cpuValues[cpuValues.length - 1] }
    };

    this.models.set(targetId, model);
    return model;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, v) => sum + v, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = x.reduce((sum, v, i) => sum + v * values[i], 0);
    const sumX2 = x.reduce((sum, v) => sum + v * v, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private generateForecasts(
    model: PredictionModel,
    history: ResourceMetrics[],
    horizon: number
  ): LoadForecast[] {
    const forecasts: LoadForecast[] = [];
    const lastMetrics = history[history.length - 1];
    const baseTime = Date.now();
    const interval = 3600000;

    for (let h = 1; h <= horizon; h++) {
      const predictedCPU = model.parameters.intercept + model.parameters.trend * h;
      const predictedMemory = lastMetrics.memory * (1 + model.parameters.trend * 0.1);
      const predictedLoad = lastMetrics.requests * (1 + model.parameters.trend * 0.15);

      const recommendedReplicas = this.calculateRecommendedReplicas(
        predictedCPU,
        predictedMemory,
        predictedLoad
      );

      forecasts.push({
        timestamp: new Date(baseTime + h * interval),
        predictedLoad,
        predictedCPU: Math.max(0, Math.min(100, predictedCPU)),
        predictedMemory: Math.max(0, predictedMemory),
        confidence: model.accuracy,
        recommendedReplicas
      });
    }

    return forecasts;
  }

  private calculateRecommendedReplicas(cpu: number, memory: number, load: number): number {
    const cpuReplicas = Math.ceil(cpu / 70);
    const memoryReplicas = Math.ceil(memory / (80 * 1024 * 1024));
    const loadReplicas = Math.ceil(load / 100);

    return Math.max(cpuReplicas, memoryReplicas, loadReplicas, 1);
  }

  public async optimizeCost(targetId: string): Promise<CostOptimization> {
    const target = this.targets.get(targetId);
    if (!target) throw new Error(`Target ${targetId} not found`);

    const currentCost = this.calculateCurrentCost(target);
    const recommendations: CostRecommendation[] = [];

    const utilizationRate = (target.metrics.cpu + target.metrics.memory / 100) / 2;

    if (utilizationRate < 30 && target.currentReplicas > target.minReplicas) {
      recommendations.push({
        type: 'scale_down',
        description: 'Low utilization detected - scale down replicas',
        impact: currentCost * 0.3,
        implementation: `Reduce replicas from ${target.currentReplicas} to ${target.minReplicas}`
      });
    }

    if (target.currentReplicas > 5) {
      recommendations.push({
        type: 'spot_instance',
        description: 'Use spot instances for non-critical workloads',
        impact: currentCost * 0.6,
        implementation: 'Convert 60% of instances to spot instances'
      });
    }

    const history = this.events.filter(e => e.targetId === targetId).slice(-100);
    const avgReplicas = history.reduce((sum, e) => sum + e.toReplicas, 0) / history.length;

    if (avgReplicas > target.minReplicas && avgReplicas < target.maxReplicas) {
      recommendations.push({
        type: 'reserved',
        description: 'Purchase reserved instances for baseline capacity',
        impact: currentCost * 0.25,
        implementation: `Reserve ${Math.floor(avgReplicas)} instances`
      });
    }

    const optimizedCost = currentCost - recommendations.reduce((sum, r) => sum + r.impact, 0);

    return {
      currentCost,
      optimizedCost,
      savings: currentCost - optimizedCost,
      recommendations
    };
  }

  private calculateCurrentCost(target: ScalingTarget): number {
    const costPerReplica = 0.05;
    const hoursPerMonth = 730;
    return target.currentReplicas * costPerReplica * hoursPerMonth;
  }

  private getLastScalingEvent(targetId: string): ScalingEvent | undefined {
    return this.events
      .filter(e => e.targetId === targetId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  private startMonitoring(): void {
    setInterval(() => {
      for (const target of this.targets.values()) {
        const history = this.metricsHistory.get(target.id) || [];
        history.push({ ...target.metrics });

        if (history.length > 1000) {
          history.shift();
        }

        this.metricsHistory.set(target.id, history);

        this.evaluateScaling(target.id).catch(error => {
          this.emit('scaling:error', { targetId: target.id, error });
        });
      }
    }, 10000);
  }

  public updateMetrics(targetId: string, metrics: Partial<ResourceMetrics>): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    target.metrics = { ...target.metrics, ...metrics };
    this.emit('metrics:updated', { targetId, metrics });
  }

  public getScalingHistory(targetId: string, limit: number = 50): ScalingEvent[] {
    return this.events
      .filter(e => e.targetId === targetId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getStatistics(targetId?: string): any {
    const events = targetId
      ? this.events.filter(e => e.targetId === targetId)
      : this.events;

    const scaleUps = events.filter(e => e.toReplicas > e.fromReplicas).length;
    const scaleDowns = events.filter(e => e.toReplicas < e.fromReplicas).length;
    const totalCost = events.reduce((sum, e) => sum + (e.cost || 0), 0);
    const avgDuration = events.reduce((sum, e) => sum + (e.duration || 0), 0) / events.length;

    return {
      totalEvents: events.length,
      scaleUps,
      scaleDowns,
      totalCost,
      avgDuration,
      targets: targetId ? 1 : this.targets.size,
      policies: this.policies.size
    };
  }

  public getTarget(targetId: string): ScalingTarget | null {
    return this.targets.get(targetId) || null;
  }

  public listTargets(): ScalingTarget[] {
    return Array.from(this.targets.values());
  }

  public getPolicy(policyId: string): ScalingPolicy | null {
    return this.policies.get(policyId) || null;
  }

  public listPolicies(): ScalingPolicy[] {
    return Array.from(this.policies.values());
  }

  public enablePolicy(policyId: string): void {
    const policy = this.policies.get(policyId);
    if (policy) {
      policy.enabled = true;
      this.emit('policy:enabled', policy);
    }
  }

  public disablePolicy(policyId: string): void {
    const policy = this.policies.get(policyId);
    if (policy) {
      policy.enabled = false;
      this.emit('policy:disabled', policy);
    }
  }
}

export default AutoScaler;
