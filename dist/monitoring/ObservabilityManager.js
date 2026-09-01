"use strict";
/**
 * Advanced Monitoring & Observability System
 * Distributed tracing, metrics collection, log aggregation
 * Health checks, alerting, incident management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityManager = void 0;
const events_1 = require("events");
// ============================================================================
// Observability Manager
// ============================================================================
class ObservabilityManager extends events_1.EventEmitter {
    config;
    spans = new Map();
    traces = new Map();
    metrics = new Map();
    logs = [];
    healthChecks = new Map();
    incidents = new Map();
    alerts = new Map();
    dependencies = new Map();
    activeSpans = new Map();
    resource;
    startTime = Date.now();
    constructor(config = {}) {
        super();
        this.config = {
            enableTracing: true,
            enableMetrics: true,
            enableLogging: true,
            samplingRate: 1.0,
            metricsInterval: 60000,
            logLevel: 'info',
            exporters: [],
            healthCheckInterval: 30000,
            ...config,
        };
        this.resource = {
            serviceName: 'agent-cli',
            serviceVersion: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            hostname: 'localhost',
            attributes: {},
        };
        this.startBackgroundTasks();
    }
    // ========================================================================
    // Distributed Tracing
    // ========================================================================
    startSpan(name, options = {}) {
        if (!this.config.enableTracing) {
            return this.createNoOpSpan(name);
        }
        // Apply sampling
        if (Math.random() > this.config.samplingRate) {
            return this.createNoOpSpan(name);
        }
        const span = {
            traceId: options.traceId || this.generateTraceId(),
            spanId: this.generateSpanId(),
            parentSpanId: options.parentSpanId,
            name,
            startTime: Date.now(),
            status: 'unset',
            attributes: options.attributes || {},
            events: [],
            links: options.links || [],
            kind: options.kind || 'internal',
            resource: this.resource,
        };
        this.spans.set(span.spanId, span);
        this.activeSpans.set(span.spanId, span);
        this.emit('span:start', { span });
        return span;
    }
    endSpan(spanId, status = 'ok') {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = status;
        this.activeSpans.delete(spanId);
        // Build trace if this is root span
        if (!span.parentSpanId) {
            this.buildTrace(span.traceId);
        }
        this.emit('span:end', { span });
        this.exportSpan(span);
    }
    addSpanEvent(spanId, name, attributes = {}) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.events.push({
            name,
            timestamp: Date.now(),
            attributes,
        });
    }
    setSpanAttributes(spanId, attributes) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        Object.assign(span.attributes, attributes);
    }
    buildTrace(traceId) {
        const traceSpans = Array.from(this.spans.values()).filter(s => s.traceId === traceId && s.endTime);
        if (traceSpans.length === 0)
            return;
        const rootSpan = traceSpans.find(s => !s.parentSpanId);
        if (!rootSpan)
            return;
        const trace = {
            traceId,
            spans: traceSpans,
            startTime: Math.min(...traceSpans.map(s => s.startTime)),
            endTime: Math.max(...traceSpans.map(s => s.endTime)),
            duration: 0,
            rootSpan,
            status: traceSpans.some(s => s.status === 'error') ? 'error' : 'ok',
        };
        trace.duration = trace.endTime - trace.startTime;
        this.traces.set(traceId, trace);
        this.emit('trace:complete', { trace });
        // Analyze dependencies
        this.analyzeDependencies(trace);
    }
    analyzeDependencies(trace) {
        for (const span of trace.spans) {
            if (span.kind === 'client' && span.attributes.peer_service) {
                const key = `${this.resource.serviceName}->${span.attributes.peer_service}`;
                let dep = this.dependencies.get(key);
                if (!dep) {
                    dep = {
                        source: this.resource.serviceName,
                        target: span.attributes.peer_service,
                        type: span.attributes.db_system ? 'database' : 'sync',
                        callCount: 0,
                        errorCount: 0,
                        avgLatency: 0,
                        lastSeen: Date.now(),
                    };
                    this.dependencies.set(key, dep);
                }
                dep.callCount++;
                if (span.status === 'error')
                    dep.errorCount++;
                dep.avgLatency = (dep.avgLatency * (dep.callCount - 1) + (span.duration || 0)) / dep.callCount;
                dep.lastSeen = Date.now();
            }
        }
    }
    createNoOpSpan(name) {
        return {
            traceId: '',
            spanId: '',
            name,
            startTime: Date.now(),
            status: 'unset',
            attributes: {},
            events: [],
            links: [],
            kind: 'internal',
            resource: this.resource,
        };
    }
    getTrace(traceId) {
        return this.traces.get(traceId);
    }
    searchTraces(query) {
        let results = Array.from(this.traces.values());
        if (query.serviceName) {
            results = results.filter(t => t.rootSpan.resource.serviceName === query.serviceName);
        }
        if (query.minDuration) {
            results = results.filter(t => t.duration >= query.minDuration);
        }
        if (query.maxDuration) {
            results = results.filter(t => t.duration <= query.maxDuration);
        }
        if (query.status) {
            results = results.filter(t => t.status === query.status);
        }
        if (query.startTime && query.endTime) {
            results = results.filter(t => t.startTime >= query.startTime && t.endTime <= query.endTime);
        }
        return results.slice(0, query.limit || 100);
    }
    // ========================================================================
    // Metrics Collection
    // ========================================================================
    recordMetric(metric) {
        if (!this.config.enableMetrics)
            return;
        const full = {
            ...metric,
            timestamp: Date.now(),
        };
        if (!this.metrics.has(metric.name)) {
            this.metrics.set(metric.name, []);
        }
        this.metrics.get(metric.name).push(full);
        this.emit('metric:recorded', { metric: full });
        // Check metric alerts
        this.checkMetricAlerts(full);
    }
    incrementCounter(name, value = 1, tags = {}) {
        this.recordMetric({
            name,
            type: 'counter',
            value,
            tags,
        });
    }
    setGauge(name, value, tags = {}) {
        this.recordMetric({
            name,
            type: 'gauge',
            value,
            tags,
        });
    }
    recordHistogram(name, value, tags = {}) {
        this.recordMetric({
            name,
            type: 'histogram',
            value,
            tags,
        });
    }
    getMetrics(name, startTime, endTime) {
        const metrics = this.metrics.get(name) || [];
        if (!startTime && !endTime) {
            return metrics;
        }
        return metrics.filter(m => {
            if (startTime && m.timestamp < startTime)
                return false;
            if (endTime && m.timestamp > endTime)
                return false;
            return true;
        });
    }
    aggregateMetrics(name, aggregation, windowSize) {
        const metrics = this.metrics.get(name) || [];
        if (metrics.length === 0)
            return [];
        const aggregations = [];
        const windows = this.createTimeWindows(metrics, windowSize);
        for (const [windowStart, windowMetrics] of windows) {
            const values = windowMetrics.map(m => m.value);
            let value;
            switch (aggregation) {
                case 'avg':
                    value = values.reduce((sum, v) => sum + v, 0) / values.length;
                    break;
                case 'sum':
                    value = values.reduce((sum, v) => sum + v, 0);
                    break;
                case 'min':
                    value = Math.min(...values);
                    break;
                case 'max':
                    value = Math.max(...values);
                    break;
                case 'count':
                    value = values.length;
                    break;
                case 'p50':
                    value = this.percentile(values, 0.5);
                    break;
                case 'p95':
                    value = this.percentile(values, 0.95);
                    break;
                case 'p99':
                    value = this.percentile(values, 0.99);
                    break;
                default:
                    value = 0;
            }
            aggregations.push({
                name,
                aggregation,
                value,
                windowStart,
                windowEnd: windowStart + windowSize,
                sampleCount: values.length,
            });
        }
        return aggregations;
    }
    createTimeWindows(metrics, windowSize) {
        const windows = new Map();
        for (const metric of metrics) {
            const windowStart = Math.floor(metric.timestamp / windowSize) * windowSize;
            if (!windows.has(windowStart)) {
                windows.set(windowStart, []);
            }
            windows.get(windowStart).push(metric);
        }
        return windows;
    }
    percentile(values, p) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[index] || 0;
    }
    // ========================================================================
    // Logging
    // ========================================================================
    log(level, message, attributes = {}) {
        if (!this.config.enableLogging)
            return;
        if (this.getLogLevelValue(level) < this.getLogLevelValue(this.config.logLevel)) {
            return;
        }
        const entry = {
            level,
            message,
            timestamp: Date.now(),
            attributes,
        };
        // Add trace context if available
        const activeSpan = Array.from(this.activeSpans.values())[0];
        if (activeSpan) {
            entry.traceId = activeSpan.traceId;
            entry.spanId = activeSpan.spanId;
        }
        this.logs.push(entry);
        this.emit('log:entry', { entry });
        // Keep only recent logs
        if (this.logs.length > 10000) {
            this.logs = this.logs.slice(-5000);
        }
        // Export log
        this.exportLog(entry);
    }
    trace(message, attributes) {
        this.log('trace', message, attributes);
    }
    debug(message, attributes) {
        this.log('debug', message, attributes);
    }
    info(message, attributes) {
        this.log('info', message, attributes);
    }
    warn(message, attributes) {
        this.log('warn', message, attributes);
    }
    error(message, error, attributes) {
        this.log('error', message, {
            ...attributes,
            error: error?.message,
            stack: error?.stack,
        });
    }
    fatal(message, error, attributes) {
        this.log('fatal', message, {
            ...attributes,
            error: error?.message,
            stack: error?.stack,
        });
    }
    getLogLevelValue(level) {
        const levels = {
            trace: 0,
            debug: 1,
            info: 2,
            warn: 3,
            error: 4,
            fatal: 5,
        };
        return levels[level];
    }
    searchLogs(query) {
        let results = [...this.logs];
        if (query.level) {
            results = results.filter(l => l.level === query.level);
        }
        if (query.message) {
            results = results.filter(l => l.message.includes(query.message));
        }
        if (query.traceId) {
            results = results.filter(l => l.traceId === query.traceId);
        }
        if (query.startTime && query.endTime) {
            results = results.filter(l => l.timestamp >= query.startTime && l.timestamp <= query.endTime);
        }
        return results.slice(0, query.limit || 100);
    }
    // ========================================================================
    // Health Checks
    // ========================================================================
    registerHealthCheck(check) {
        const full = {
            ...check,
            id: this.generateId(),
            enabled: check.enabled !== false,
        };
        this.healthChecks.set(full.id, full);
        this.emit('health_check:registered', { check: full });
        // Start checking immediately
        if (full.enabled) {
            this.runHealthCheck(full.id);
        }
        return full;
    }
    async runHealthCheck(checkId) {
        const check = this.healthChecks.get(checkId);
        if (!check || !check.enabled)
            return;
        const startTime = Date.now();
        try {
            const result = await this.runWithTimeout(check.check(), check.timeout);
            result.timestamp = Date.now();
            result.duration = result.timestamp - startTime;
            check.lastCheck = result;
            this.emit('health_check:result', { check, result });
            // Create incident if unhealthy
            if (!result.healthy) {
                this.createHealthIncident(check, result);
            }
        }
        catch (error) {
            const result = {
                healthy: false,
                status: 'unhealthy',
                message: error.message,
                timestamp: Date.now(),
                duration: Date.now() - startTime,
            };
            check.lastCheck = result;
            this.emit('health_check:error', { check, error });
            this.createHealthIncident(check, result);
        }
        // Schedule next check
        setTimeout(() => this.runHealthCheck(checkId), check.interval);
    }
    async getSystemHealth() {
        const checks = new Map();
        for (const [id, check] of this.healthChecks.entries()) {
            if (check.lastCheck) {
                checks.set(id, check.lastCheck);
            }
        }
        const allHealthy = Array.from(checks.values()).every(r => r.healthy);
        const anyUnhealthy = Array.from(checks.values()).some(r => !r.healthy);
        let status;
        if (allHealthy) {
            status = 'healthy';
        }
        else if (anyUnhealthy) {
            status = 'unhealthy';
        }
        else {
            status = 'degraded';
        }
        return {
            status,
            checks,
            timestamp: Date.now(),
            uptime: Date.now() - this.startTime,
        };
    }
    // ========================================================================
    // Incident Management
    // ========================================================================
    createIncident(incident) {
        const full = {
            ...incident,
            id: this.generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            timeline: [
                {
                    timestamp: Date.now(),
                    type: 'created',
                    actor: 'system',
                    message: 'Incident created',
                },
            ],
        };
        this.incidents.set(full.id, full);
        this.emit('incident:created', { incident: full });
        return full;
    }
    createHealthIncident(check, result) {
        // Check if incident already exists
        const existing = Array.from(this.incidents.values()).find(i => i.source === check.id && i.status !== 'closed');
        if (existing) {
            this.updateIncident(existing.id, {
                updatedAt: Date.now(),
            });
            return;
        }
        this.createIncident({
            title: `Health check failed: ${check.name}`,
            description: result.message || 'Health check returned unhealthy',
            severity: 'high',
            status: 'open',
            source: check.id,
            tags: ['health_check', check.type],
            relatedTraces: [],
            relatedLogs: [],
        });
    }
    updateIncident(incidentId, updates) {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident not found: ${incidentId}`);
        }
        Object.assign(incident, updates);
        incident.updatedAt = Date.now();
        if (updates.status) {
            incident.timeline.push({
                timestamp: Date.now(),
                type: 'status_change',
                actor: 'system',
                message: `Status changed to ${updates.status}`,
            });
        }
        this.emit('incident:updated', { incident });
    }
    resolveIncident(incidentId, resolution) {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident not found: ${incidentId}`);
        }
        incident.status = 'resolved';
        incident.resolvedAt = Date.now();
        incident.updatedAt = Date.now();
        incident.timeline.push({
            timestamp: Date.now(),
            type: 'resolved',
            actor: 'system',
            message: resolution,
        });
        this.emit('incident:resolved', { incident });
    }
    getIncident(incidentId) {
        return this.incidents.get(incidentId);
    }
    listIncidents(filter) {
        let incidents = Array.from(this.incidents.values());
        if (filter?.status) {
            incidents = incidents.filter(i => i.status === filter.status);
        }
        if (filter?.severity) {
            incidents = incidents.filter(i => i.severity === filter.severity);
        }
        return incidents.sort((a, b) => b.createdAt - a.createdAt);
    }
    // ========================================================================
    // Alerting
    // ========================================================================
    createAlert(alert) {
        const full = {
            ...alert,
            id: this.generateId(),
            triggerCount: 0,
        };
        this.alerts.set(full.id, full);
        this.emit('alert:created', { alert: full });
        return full;
    }
    checkMetricAlerts(metric) {
        for (const alert of this.alerts.values()) {
            if (!alert.enabled || alert.condition.type !== 'metric') {
                continue;
            }
            if (alert.condition.metric !== metric.name) {
                continue;
            }
            // Check cooldown
            if (alert.lastTriggered && Date.now() - alert.lastTriggered < alert.cooldown) {
                continue;
            }
            // Evaluate condition
            const shouldTrigger = this.evaluateAlertCondition(alert.condition, metric.value);
            if (shouldTrigger) {
                this.triggerAlert(alert, { metric });
            }
        }
    }
    evaluateAlertCondition(condition, value) {
        switch (condition.operator) {
            case 'gt':
                return value > condition.threshold;
            case 'gte':
                return value >= condition.threshold;
            case 'lt':
                return value < condition.threshold;
            case 'lte':
                return value <= condition.threshold;
            case 'eq':
                return value === condition.threshold;
            case 'neq':
                return value !== condition.threshold;
            default:
                return false;
        }
    }
    async triggerAlert(alert, context) {
        alert.lastTriggered = Date.now();
        alert.triggerCount++;
        this.emit('alert:triggered', { alert, context });
        // Send notifications
        for (const channel of alert.channels) {
            await this.sendAlertNotification(alert, channel, context);
        }
        // Create incident for critical/high severity
        if (alert.severity === 'critical' || alert.severity === 'high') {
            this.createIncident({
                title: `Alert triggered: ${alert.name}`,
                description: JSON.stringify(context),
                severity: alert.severity,
                status: 'open',
                source: alert.id,
                tags: ['alert'],
                relatedTraces: [],
                relatedLogs: [],
            });
        }
    }
    async sendAlertNotification(alert, channel, context) {
        this.emit('alert:notification:sent', { alert, channel, context });
    }
    // ========================================================================
    // Export
    // ========================================================================
    async exportSpan(span) {
        for (const exporter of this.config.exporters) {
            await this.exportToBackend(exporter, 'span', span);
        }
    }
    async exportLog(entry) {
        for (const exporter of this.config.exporters) {
            await this.exportToBackend(exporter, 'log', entry);
        }
    }
    async exportToBackend(exporter, type, data) {
        // In production, this would send to actual observability backends
        this.emit('export', { exporter, type, data });
    }
    // ========================================================================
    // Background Tasks
    // ========================================================================
    startBackgroundTasks() {
        // Start health checks
        setInterval(() => {
            for (const [id, check] of this.healthChecks.entries()) {
                if (check.enabled && !check.lastCheck) {
                    this.runHealthCheck(id);
                }
            }
        }, this.config.healthCheckInterval);
        // Metric aggregation
        setInterval(() => {
            this.performMetricAggregation();
        }, this.config.metricsInterval);
    }
    performMetricAggregation() {
        for (const [name] of this.metrics.entries()) {
            const aggregations = this.aggregateMetrics(name, 'avg', 60000);
            this.emit('metrics:aggregated', { name, aggregations });
        }
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    generateTraceId() {
        return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    generateSpanId() {
        return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    generateId() {
        return `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    runWithTimeout(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
        ]);
    }
    getDependencies() {
        return Array.from(this.dependencies.values());
    }
    getStats() {
        return {
            traces: this.traces.size,
            spans: this.spans.size,
            activeSpans: this.activeSpans.size,
            metrics: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.length, 0),
            logs: this.logs.length,
            healthChecks: this.healthChecks.size,
            incidents: this.incidents.size,
            alerts: this.alerts.size,
        };
    }
}
exports.ObservabilityManager = ObservabilityManager;
// ============================================================================
// Export
// ============================================================================
exports.default = ObservabilityManager;
