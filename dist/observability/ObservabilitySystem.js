"use strict";
/**
 * Observability and Monitoring System
 * Metrics collection, distributed tracing, logging aggregation, and alerting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthMonitor = exports.alertManager = exports.logAggregator = exports.distributedTracer = exports.metricsCollector = exports.HealthMonitor = exports.AlertManager = exports.LogAggregator = exports.DistributedTracer = exports.MetricsCollector = exports.HealthStatus = exports.PanelType = exports.ChannelType = exports.AlertStatus = exports.AlertSeverity = exports.AggregationType = exports.ComparisonOperator = exports.LogLevel = exports.SpanStatus = exports.MetricType = void 0;
const EventBus_1 = require("../core/EventBus");
var MetricType;
(function (MetricType) {
    MetricType["Counter"] = "counter";
    MetricType["Gauge"] = "gauge";
    MetricType["Histogram"] = "histogram";
    MetricType["Summary"] = "summary";
})(MetricType || (exports.MetricType = MetricType = {}));
var SpanStatus;
(function (SpanStatus) {
    SpanStatus["OK"] = "ok";
    SpanStatus["Error"] = "error";
    SpanStatus["Cancelled"] = "cancelled";
})(SpanStatus || (exports.SpanStatus = SpanStatus = {}));
var LogLevel;
(function (LogLevel) {
    LogLevel["Trace"] = "trace";
    LogLevel["Debug"] = "debug";
    LogLevel["Info"] = "info";
    LogLevel["Warn"] = "warn";
    LogLevel["Error"] = "error";
    LogLevel["Fatal"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var ComparisonOperator;
(function (ComparisonOperator) {
    ComparisonOperator["GreaterThan"] = "gt";
    ComparisonOperator["GreaterThanOrEqual"] = "gte";
    ComparisonOperator["LessThan"] = "lt";
    ComparisonOperator["LessThanOrEqual"] = "lte";
    ComparisonOperator["Equal"] = "eq";
    ComparisonOperator["NotEqual"] = "ne";
})(ComparisonOperator || (exports.ComparisonOperator = ComparisonOperator = {}));
var AggregationType;
(function (AggregationType) {
    AggregationType["Average"] = "avg";
    AggregationType["Sum"] = "sum";
    AggregationType["Min"] = "min";
    AggregationType["Max"] = "max";
    AggregationType["Count"] = "count";
})(AggregationType || (exports.AggregationType = AggregationType = {}));
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["Critical"] = "critical";
    AlertSeverity["High"] = "high";
    AlertSeverity["Medium"] = "medium";
    AlertSeverity["Low"] = "low";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["Active"] = "active";
    AlertStatus["Resolved"] = "resolved";
    AlertStatus["Acknowledged"] = "acknowledged";
    AlertStatus["Muted"] = "muted";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
var ChannelType;
(function (ChannelType) {
    ChannelType["Email"] = "email";
    ChannelType["Slack"] = "slack";
    ChannelType["PagerDuty"] = "pagerduty";
    ChannelType["Webhook"] = "webhook";
    ChannelType["SMS"] = "sms";
})(ChannelType || (exports.ChannelType = ChannelType = {}));
var PanelType;
(function (PanelType) {
    PanelType["Graph"] = "graph";
    PanelType["SingleStat"] = "single_stat";
    PanelType["Table"] = "table";
    PanelType["Heatmap"] = "heatmap";
    PanelType["Gauge"] = "gauge";
})(PanelType || (exports.PanelType = PanelType = {}));
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["Healthy"] = "healthy";
    HealthStatus["Degraded"] = "degraded";
    HealthStatus["Unhealthy"] = "unhealthy";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
/**
 * Metrics Collector
 */
class MetricsCollector {
    metrics = new Map();
    series = new Map();
    /**
     * Record metric
     */
    record(metric) {
        const key = this.getMetricKey(metric.name, metric.tags);
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        this.metrics.get(key).push(metric);
        // Update series
        this.updateSeries(metric);
        EventBus_1.eventBus.emitSync('metrics.recorded', metric, 'MetricsCollector');
    }
    /**
     * Increment counter
     */
    increment(name, value = 1, tags = {}) {
        this.record({
            name,
            type: MetricType.Counter,
            value,
            timestamp: new Date(),
            tags,
        });
    }
    /**
     * Set gauge
     */
    gauge(name, value, tags = {}) {
        this.record({
            name,
            type: MetricType.Gauge,
            value,
            timestamp: new Date(),
            tags,
        });
    }
    /**
     * Record histogram
     */
    histogram(name, value, tags = {}) {
        this.record({
            name,
            type: MetricType.Histogram,
            value,
            timestamp: new Date(),
            tags,
        });
    }
    /**
     * Query metrics
     */
    query(metricName, timeRange, tags) {
        const results = [];
        for (const [key, series] of this.series) {
            if (!series.name.includes(metricName)) {
                continue;
            }
            if (tags) {
                let matches = true;
                for (const [tagKey, tagValue] of Object.entries(tags)) {
                    if (series.tags[tagKey] !== tagValue) {
                        matches = false;
                        break;
                    }
                }
                if (!matches) {
                    continue;
                }
            }
            // Filter by time range
            const filteredPoints = series.points.filter(p => {
                const timestamp = p.timestamp.getTime();
                const from = typeof timeRange.from === 'string' ? new Date(timeRange.from) : timeRange.from;
                const to = typeof timeRange.to === 'string' ? new Date(timeRange.to) : timeRange.to;
                return timestamp >= from.getTime() && timestamp <= to.getTime();
            });
            if (filteredPoints.length > 0) {
                results.push({
                    name: series.name,
                    points: filteredPoints,
                    tags: series.tags,
                });
            }
        }
        return results;
    }
    /**
     * Aggregate metrics
     */
    aggregate(metricName, aggregation, timeRange) {
        const series = this.query(metricName, timeRange);
        const allValues = series.flatMap(s => s.points.map(p => p.value));
        switch (aggregation) {
            case AggregationType.Average:
                return allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
            case AggregationType.Sum:
                return allValues.reduce((sum, v) => sum + v, 0);
            case AggregationType.Min:
                return Math.min(...allValues);
            case AggregationType.Max:
                return Math.max(...allValues);
            case AggregationType.Count:
                return allValues.length;
            default:
                return 0;
        }
    }
    /**
     * Get metric statistics
     */
    getStatistics(metricName, timeRange) {
        const series = this.query(metricName, timeRange);
        const allValues = series.flatMap(s => s.points.map(p => p.value));
        const sorted = [...allValues].sort((a, b) => a - b);
        const mean = allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
        const variance = allValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / allValues.length;
        return {
            count: allValues.length,
            mean,
            min: Math.min(...allValues),
            max: Math.max(...allValues),
            stdDev: Math.sqrt(variance),
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
        };
    }
    updateSeries(metric) {
        const key = this.getMetricKey(metric.name, metric.tags);
        if (!this.series.has(key)) {
            this.series.set(key, {
                name: metric.name,
                points: [],
                tags: metric.tags,
            });
        }
        const series = this.series.get(key);
        series.points.push({
            timestamp: metric.timestamp,
            value: metric.value,
        });
        // Keep only last 1000 points
        if (series.points.length > 1000) {
            series.points.shift();
        }
    }
    getMetricKey(name, tags) {
        const tagStr = Object.entries(tags)
            .sort(([k1], [k2]) => k1.localeCompare(k2))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${tagStr}}`;
    }
}
exports.MetricsCollector = MetricsCollector;
/**
 * Distributed Tracer
 */
class DistributedTracer {
    traces = new Map();
    activeSpans = new Map();
    /**
     * Start trace
     */
    startTrace(serviceName, operationName) {
        const traceId = this.generateTraceId();
        const trace = {
            traceId,
            spans: [],
            duration: 0,
            startTime: new Date(),
            endTime: new Date(),
            serviceName,
        };
        this.traces.set(traceId, trace);
        // Start root span
        this.startSpan(traceId, operationName);
        return trace;
    }
    /**
     * Start span
     */
    startSpan(traceId, operationName, parentSpanId) {
        const trace = this.traces.get(traceId);
        if (!trace) {
            throw new Error(`Trace not found: ${traceId}`);
        }
        const span = {
            spanId: this.generateSpanId(),
            traceId,
            parentSpanId,
            operationName,
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            tags: {},
            logs: [],
            status: SpanStatus.OK,
        };
        trace.spans.push(span);
        this.activeSpans.set(span.spanId, span);
        return span;
    }
    /**
     * Finish span
     */
    finishSpan(spanId) {
        const span = this.activeSpans.get(spanId);
        if (!span) {
            return;
        }
        span.endTime = new Date();
        span.duration = span.endTime.getTime() - span.startTime.getTime();
        this.activeSpans.delete(spanId);
        // Check if trace is complete
        const trace = this.traces.get(span.traceId);
        if (trace && this.activeSpans.size === 0) {
            trace.endTime = new Date();
            trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
            EventBus_1.eventBus.emitSync('trace.completed', trace, 'DistributedTracer');
        }
    }
    /**
     * Add span tag
     */
    addTag(spanId, key, value) {
        const span = this.activeSpans.get(spanId);
        if (span) {
            span.tags[key] = value;
        }
    }
    /**
     * Log span event
     */
    logEvent(spanId, fields) {
        const span = this.activeSpans.get(spanId);
        if (span) {
            span.logs.push({
                timestamp: new Date(),
                fields,
            });
        }
    }
    /**
     * Set span status
     */
    setStatus(spanId, status) {
        const span = this.activeSpans.get(spanId);
        if (span) {
            span.status = status;
        }
    }
    /**
     * Get trace
     */
    getTrace(traceId) {
        return this.traces.get(traceId);
    }
    /**
     * Query traces
     */
    queryTraces(filter) {
        let traces = Array.from(this.traces.values());
        if (filter.serviceName) {
            traces = traces.filter(t => t.serviceName === filter.serviceName);
        }
        if (filter.minDuration) {
            traces = traces.filter(t => t.duration >= filter.minDuration);
        }
        if (filter.maxDuration) {
            traces = traces.filter(t => t.duration <= filter.maxDuration);
        }
        return traces;
    }
    generateTraceId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSpanId() {
        return `span_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DistributedTracer = DistributedTracer;
/**
 * Log Aggregator
 */
class LogAggregator {
    logs = [];
    maxLogs = 10000;
    /**
     * Log entry
     */
    log(entry) {
        const fullEntry = {
            ...entry,
            id: this.generateLogId(),
        };
        this.logs.push(fullEntry);
        // Maintain max size
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        EventBus_1.eventBus.emitSync('log.entry', fullEntry, 'LogAggregator');
    }
    /**
     * Query logs
     */
    query(filter) {
        let logs = [...this.logs];
        if (filter.level) {
            logs = logs.filter(l => l.level === filter.level);
        }
        if (filter.service) {
            logs = logs.filter(l => l.service === filter.service);
        }
        if (filter.traceId) {
            logs = logs.filter(l => l.traceId === filter.traceId);
        }
        if (filter.startTime) {
            logs = logs.filter(l => l.timestamp >= filter.startTime);
        }
        if (filter.endTime) {
            logs = logs.filter(l => l.timestamp <= filter.endTime);
        }
        if (filter.search) {
            logs = logs.filter(l => l.message.toLowerCase().includes(filter.search.toLowerCase()));
        }
        return logs;
    }
    /**
     * Get log statistics
     */
    getStatistics(timeRange) {
        const logs = this.query({
            startTime: typeof timeRange.from === 'string' ? new Date(timeRange.from) : timeRange.from,
            endTime: typeof timeRange.to === 'string' ? new Date(timeRange.to) : timeRange.to,
        });
        const byLevel = {
            [LogLevel.Trace]: 0,
            [LogLevel.Debug]: 0,
            [LogLevel.Info]: 0,
            [LogLevel.Warn]: 0,
            [LogLevel.Error]: 0,
            [LogLevel.Fatal]: 0,
        };
        for (const log of logs) {
            byLevel[log.level]++;
        }
        return {
            total: logs.length,
            byLevel,
        };
    }
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.LogAggregator = LogAggregator;
/**
 * Alert Manager
 */
class AlertManager {
    metricsCollector;
    alerts = new Map();
    evaluationInterval = 60000; // 1 minute
    constructor(metricsCollector) {
        this.metricsCollector = metricsCollector;
        this.startEvaluation();
    }
    /**
     * Create alert
     */
    createAlert(alert) {
        const fullAlert = {
            ...alert,
            id: this.generateAlertId(),
            status: AlertStatus.Active,
        };
        this.alerts.set(fullAlert.id, fullAlert);
        EventBus_1.eventBus.emitSync('alert.created', fullAlert, 'AlertManager');
        return fullAlert;
    }
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.status = AlertStatus.Acknowledged;
            EventBus_1.eventBus.emitSync('alert.acknowledged', alert, 'AlertManager');
        }
    }
    /**
     * Resolve alert
     */
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.status = AlertStatus.Resolved;
            alert.resolvedAt = new Date();
            EventBus_1.eventBus.emitSync('alert.resolved', alert, 'AlertManager');
        }
    }
    /**
     * List alerts
     */
    listAlerts(filter) {
        let alerts = Array.from(this.alerts.values());
        if (filter?.status) {
            alerts = alerts.filter(a => a.status === filter.status);
        }
        if (filter?.severity) {
            alerts = alerts.filter(a => a.severity === filter.severity);
        }
        return alerts;
    }
    /**
     * Start alert evaluation
     */
    startEvaluation() {
        setInterval(() => {
            this.evaluateAlerts();
        }, this.evaluationInterval);
    }
    /**
     * Evaluate all alerts
     */
    evaluateAlerts() {
        for (const alert of this.alerts.values()) {
            if (alert.status === AlertStatus.Muted) {
                continue;
            }
            this.evaluateAlert(alert);
        }
    }
    /**
     * Evaluate single alert
     */
    evaluateAlert(alert) {
        const timeRange = {
            from: new Date(Date.now() - alert.condition.duration),
            to: new Date(),
        };
        const value = this.metricsCollector.aggregate(alert.condition.metric, alert.condition.aggregation || AggregationType.Average, timeRange);
        const triggered = this.checkCondition(value, alert.condition);
        if (triggered && alert.status === AlertStatus.Active && !alert.triggeredAt) {
            alert.triggeredAt = new Date();
            this.sendNotifications(alert);
            EventBus_1.eventBus.emitSync('alert.triggered', alert, 'AlertManager');
        }
        else if (!triggered && alert.triggeredAt) {
            alert.triggeredAt = undefined;
            alert.resolvedAt = new Date();
            alert.status = AlertStatus.Resolved;
            EventBus_1.eventBus.emitSync('alert.auto_resolved', alert, 'AlertManager');
        }
    }
    checkCondition(value, condition) {
        switch (condition.operator) {
            case ComparisonOperator.GreaterThan:
                return value > condition.threshold;
            case ComparisonOperator.GreaterThanOrEqual:
                return value >= condition.threshold;
            case ComparisonOperator.LessThan:
                return value < condition.threshold;
            case ComparisonOperator.LessThanOrEqual:
                return value <= condition.threshold;
            case ComparisonOperator.Equal:
                return value === condition.threshold;
            case ComparisonOperator.NotEqual:
                return value !== condition.threshold;
            default:
                return false;
        }
    }
    sendNotifications(alert) {
        for (const channel of alert.notifications) {
            this.sendNotification(alert, channel);
        }
    }
    sendNotification(alert, channel) {
        // Mock notification sending
        EventBus_1.eventBus.emitSync('notification.sent', { alert, channel }, 'AlertManager');
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AlertManager = AlertManager;
/**
 * Health Monitor
 */
class HealthMonitor {
    healthChecks = new Map();
    /**
     * Register health check
     */
    registerHealthCheck(service, check) {
        // Store check function for later execution
    }
    /**
     * Check health
     */
    async checkHealth(service) {
        // Mock health check
        const checks = [
            { name: 'database', status: HealthStatus.Healthy, responseTime: 50 },
            { name: 'cache', status: HealthStatus.Healthy, responseTime: 10 },
            { name: 'api', status: HealthStatus.Healthy, responseTime: 100 },
        ];
        const overallStatus = checks.every(c => c.status === HealthStatus.Healthy)
            ? HealthStatus.Healthy
            : HealthStatus.Degraded;
        const healthCheck = {
            service,
            status: overallStatus,
            checks,
            timestamp: new Date(),
        };
        this.healthChecks.set(service, healthCheck);
        return healthCheck;
    }
    /**
     * Get health status
     */
    getHealthStatus(service) {
        return this.healthChecks.get(service);
    }
}
exports.HealthMonitor = HealthMonitor;
/**
 * Singleton instances
 */
exports.metricsCollector = new MetricsCollector();
exports.distributedTracer = new DistributedTracer();
exports.logAggregator = new LogAggregator();
exports.alertManager = new AlertManager(exports.metricsCollector);
exports.healthMonitor = new HealthMonitor();
