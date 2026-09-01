"use strict";
/**
 * AutoScaler - Predictive auto-scaling with ML-based forecasting
 * Horizontal pod autoscaling, cost optimization, and load prediction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoScaler = void 0;
const events_1 = require("events");
class AutoScaler extends events_1.EventEmitter {
    targets = new Map();
    policies = new Map();
    events = [];
    models = new Map();
    metricsHistory = new Map();
    forecastCache = new Map();
    constructor() {
        super();
        this.startMonitoring();
    }
    registerTarget(target) {
        this.targets.set(target.id, target);
        this.metricsHistory.set(target.id, []);
        this.emit('target:registered', target);
    }
    addPolicy(policy) {
        this.policies.set(policy.id, policy);
        this.emit('policy:added', policy);
    }
    async evaluateScaling(targetId) {
        const target = this.targets.get(targetId);
        if (!target)
            return;
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
    async evaluateTrigger(target, trigger) {
        const metricValue = this.getMetricValue(target.metrics, trigger.metric);
        if (metricValue === undefined)
            return false;
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
        if (!conditionMet)
            return false;
        const history = this.metricsHistory.get(target.id) || [];
        const recentMetrics = history.slice(-Math.ceil(trigger.duration / 10000));
        if (recentMetrics.length === 0)
            return false;
        const allMeetCondition = recentMetrics.every(metrics => {
            const value = this.getMetricValue(metrics, trigger.metric);
            if (value === undefined)
                return false;
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
    getMetricValue(metrics, metricName) {
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
    async executeScaling(target, trigger, policy) {
        const startTime = Date.now();
        const fromReplicas = target.currentReplicas;
        let toReplicas;
        if (trigger.scaleDirection === 'up') {
            toReplicas = Math.min(target.maxReplicas, fromReplicas + trigger.scaleAmount);
        }
        else {
            toReplicas = Math.max(target.minReplicas, fromReplicas - trigger.scaleAmount);
        }
        if (toReplicas === fromReplicas)
            return;
        target.desiredReplicas = toReplicas;
        await this.applyScaling(target, toReplicas);
        target.currentReplicas = toReplicas;
        const event = {
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
    async applyScaling(target, replicas) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.emit('scaling:applied', { targetId: target.id, replicas });
    }
    calculateScalingCost(from, to) {
        const costPerReplica = 0.05;
        return Math.abs(to - from) * costPerReplica;
    }
    async predictLoad(targetId, horizon = 12) {
        const target = this.targets.get(targetId);
        if (!target)
            throw new Error(`Target ${targetId} not found`);
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
    trainModel(targetId, history) {
        const cpuValues = history.map(m => m.cpu);
        const trend = this.calculateTrend(cpuValues);
        const model = {
            id: `model_${targetId}`,
            type: 'linear',
            accuracy: 0.85,
            trained: new Date(),
            parameters: { trend, intercept: cpuValues[cpuValues.length - 1] }
        };
        this.models.set(targetId, model);
        return model;
    }
    calculateTrend(values) {
        if (values.length < 2)
            return 0;
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const sumX = x.reduce((sum, v) => sum + v, 0);
        const sumY = values.reduce((sum, v) => sum + v, 0);
        const sumXY = x.reduce((sum, v, i) => sum + v * values[i], 0);
        const sumX2 = x.reduce((sum, v) => sum + v * v, 0);
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
    generateForecasts(model, history, horizon) {
        const forecasts = [];
        const lastMetrics = history[history.length - 1];
        const baseTime = Date.now();
        const interval = 3600000;
        for (let h = 1; h <= horizon; h++) {
            const predictedCPU = model.parameters.intercept + model.parameters.trend * h;
            const predictedMemory = lastMetrics.memory * (1 + model.parameters.trend * 0.1);
            const predictedLoad = lastMetrics.requests * (1 + model.parameters.trend * 0.15);
            const recommendedReplicas = this.calculateRecommendedReplicas(predictedCPU, predictedMemory, predictedLoad);
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
    calculateRecommendedReplicas(cpu, memory, load) {
        const cpuReplicas = Math.ceil(cpu / 70);
        const memoryReplicas = Math.ceil(memory / (80 * 1024 * 1024));
        const loadReplicas = Math.ceil(load / 100);
        return Math.max(cpuReplicas, memoryReplicas, loadReplicas, 1);
    }
    async optimizeCost(targetId) {
        const target = this.targets.get(targetId);
        if (!target)
            throw new Error(`Target ${targetId} not found`);
        const currentCost = this.calculateCurrentCost(target);
        const recommendations = [];
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
    calculateCurrentCost(target) {
        const costPerReplica = 0.05;
        const hoursPerMonth = 730;
        return target.currentReplicas * costPerReplica * hoursPerMonth;
    }
    getLastScalingEvent(targetId) {
        return this.events
            .filter(e => e.targetId === targetId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    }
    startMonitoring() {
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
    updateMetrics(targetId, metrics) {
        const target = this.targets.get(targetId);
        if (!target)
            return;
        target.metrics = { ...target.metrics, ...metrics };
        this.emit('metrics:updated', { targetId, metrics });
    }
    getScalingHistory(targetId, limit = 50) {
        return this.events
            .filter(e => e.targetId === targetId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }
    getStatistics(targetId) {
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
    getTarget(targetId) {
        return this.targets.get(targetId) || null;
    }
    listTargets() {
        return Array.from(this.targets.values());
    }
    getPolicy(policyId) {
        return this.policies.get(policyId) || null;
    }
    listPolicies() {
        return Array.from(this.policies.values());
    }
    enablePolicy(policyId) {
        const policy = this.policies.get(policyId);
        if (policy) {
            policy.enabled = true;
            this.emit('policy:enabled', policy);
        }
    }
    disablePolicy(policyId) {
        const policy = this.policies.get(policyId);
        if (policy) {
            policy.enabled = false;
            this.emit('policy:disabled', policy);
        }
    }
}
exports.AutoScaler = AutoScaler;
exports.default = AutoScaler;
