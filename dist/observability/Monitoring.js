"use strict";
/**
 * Monitoring & Observability - Metrics, logging, and tracing
 * Integration with Prometheus, Grafana, and OpenTelemetry
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthChecker = exports.tracer = exports.logger = exports.metrics = exports.HealthChecker = exports.Tracer = exports.StructuredLogger = exports.MetricsCollector = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Metrics Collector
 */
class MetricsCollector {
    metrics = new Map();
    counters = new Map();
    gauges = new Map();
    /**
     * Increment a counter metric
     */
    incrementCounter(name, value = 1, labels) {
        const key = this.getMetricKey(name, labels);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
        this.recordMetric({
            name,
            type: 'counter',
            value: current + value,
            labels,
            timestamp: new Date(),
        });
    }
    /**
     * Set a gauge metric
     */
    setGauge(name, value, labels) {
        const key = this.getMetricKey(name, labels);
        this.gauges.set(key, value);
        this.recordMetric({
            name,
            type: 'gauge',
            value,
            labels,
            timestamp: new Date(),
        });
    }
    /**
     * Record a histogram value
     */
    recordHistogram(name, value, labels) {
        this.recordMetric({
            name,
            type: 'histogram',
            value,
            labels,
            timestamp: new Date(),
        });
    }
    /**
     * Get metric values
     */
    getMetrics(name) {
        if (name) {
            return this.metrics.get(name) || [];
        }
        const allMetrics = [];
        for (const metrics of this.metrics.values()) {
            allMetrics.push(...metrics);
        }
        return allMetrics;
    }
    /**
     * Export metrics in Prometheus format
     */
    exportPrometheus() {
        let output = '';
        // Export counters
        for (const [key, value] of this.counters) {
            const [name, labelsStr] = key.split('|');
            output += `${name}${labelsStr ? `{${labelsStr}}` : ''} ${value}\n`;
        }
        // Export gauges
        for (const [key, value] of this.gauges) {
            const [name, labelsStr] = key.split('|');
            output += `${name}${labelsStr ? `{${labelsStr}}` : ''} ${value}\n`;
        }
        return output;
    }
    /**
     * Clear all metrics
     */
    clear() {
        this.metrics.clear();
        this.counters.clear();
        this.gauges.clear();
    }
    recordMetric(metric) {
        if (!this.metrics.has(metric.name)) {
            this.metrics.set(metric.name, []);
        }
        const metrics = this.metrics.get(metric.name);
        metrics.push(metric);
        // Keep only last 1000 entries per metric
        if (metrics.length > 1000) {
            metrics.shift();
        }
        EventBus_1.eventBus.emitSync('metrics.recorded', metric, 'MetricsCollector');
    }
    getMetricKey(name, labels) {
        if (!labels)
            return name;
        const labelsStr = Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        return `${name}|${labelsStr}`;
    }
}
exports.MetricsCollector = MetricsCollector;
/**
 * Structured Logger
 */
class StructuredLogger {
    logs = [];
    maxLogs = 10000;
    minLevel = 'info';
    constructor(minLevel) {
        if (minLevel) {
            this.minLevel = minLevel;
        }
    }
    debug(message, context) {
        this.log('debug', message, context);
    }
    info(message, context) {
        this.log('info', message, context);
    }
    warn(message, context) {
        this.log('warn', message, context);
    }
    error(message, error, context) {
        this.log('error', message, { ...context, error });
    }
    fatal(message, error, context) {
        this.log('fatal', message, { ...context, error });
    }
    log(level, message, context) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
            level,
            message,
            timestamp: new Date(),
            context,
            traceId: context?.traceId,
            spanId: context?.spanId,
        };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        // Also output to console
        this.outputToConsole(entry);
        EventBus_1.eventBus.emitSync('log.created', entry, 'StructuredLogger');
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
        const minIndex = levels.indexOf(this.minLevel);
        const levelIndex = levels.indexOf(level);
        return levelIndex >= minIndex;
    }
    outputToConsole(entry) {
        const timestamp = entry.timestamp.toISOString();
        const levelUpper = entry.level.toUpperCase().padEnd(5);
        let output = `[${timestamp}] ${levelUpper} ${entry.message}`;
        if (entry.context) {
            output += ` ${JSON.stringify(entry.context)}`;
        }
        if (entry.error) {
            output += `\n${entry.error.stack || entry.error.message}`;
        }
        if (entry.level === 'error' || entry.level === 'fatal') {
            console.error(output);
        }
        else if (entry.level === 'warn') {
            console.warn(output);
        }
        else {
            console.log(output);
        }
    }
    /**
     * Get logs with optional filtering
     */
    getLogs(filter) {
        let logs = [...this.logs];
        if (filter?.level) {
            logs = logs.filter((l) => l.level === filter.level);
        }
        if (filter?.since) {
            logs = logs.filter((l) => l.timestamp >= filter.since);
        }
        if (filter?.search) {
            const search = filter.search.toLowerCase();
            logs = logs.filter((l) => l.message.toLowerCase().includes(search) ||
                JSON.stringify(l.context).toLowerCase().includes(search));
        }
        return logs;
    }
    /**
     * Export logs as JSON
     */
    exportJSON() {
        return JSON.stringify(this.logs, null, 2);
    }
    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
    }
}
exports.StructuredLogger = StructuredLogger;
/**
 * Distributed Tracing
 */
class Tracer {
    spans = new Map();
    activeSpans = new Map(); // threadId -> spanId
    /**
     * Start a new trace
     */
    startTrace(name, attributes) {
        const traceId = this.generateId();
        const spanId = this.generateId();
        const span = {
            traceId,
            spanId,
            name,
            startTime: new Date(),
            status: 'ok',
            attributes: attributes || {},
            events: [],
        };
        this.spans.set(spanId, span);
        this.setActiveSpan(spanId);
        EventBus_1.eventBus.emitSync('trace.started', span, 'Tracer');
        return span;
    }
    /**
     * Start a child span
     */
    startSpan(name, attributes) {
        const parentSpanId = this.getActiveSpanId();
        const parentSpan = parentSpanId ? this.spans.get(parentSpanId) : null;
        const spanId = this.generateId();
        const span = {
            traceId: parentSpan?.traceId || this.generateId(),
            spanId,
            parentSpanId,
            name,
            startTime: new Date(),
            status: 'ok',
            attributes: attributes || {},
            events: [],
        };
        this.spans.set(spanId, span);
        this.setActiveSpan(spanId);
        return span;
    }
    /**
     * End a span
     */
    endSpan(spanId, status) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.endTime = new Date();
        span.duration = span.endTime.getTime() - span.startTime.getTime();
        if (status) {
            span.status = status;
        }
        // Set parent as active if exists
        if (span.parentSpanId) {
            this.setActiveSpan(span.parentSpanId);
        }
        EventBus_1.eventBus.emitSync('trace.ended', span, 'Tracer');
    }
    /**
     * Add event to span
     */
    addEvent(spanId, name, attributes) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.events.push({
            name,
            timestamp: new Date(),
            attributes,
        });
    }
    /**
     * Set span attribute
     */
    setAttribute(spanId, key, value) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.attributes[key] = value;
    }
    /**
     * Get span
     */
    getSpan(spanId) {
        return this.spans.get(spanId);
    }
    /**
     * Get all spans for a trace
     */
    getTrace(traceId) {
        return Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
    }
    /**
     * Export traces in OpenTelemetry format
     */
    exportOpenTelemetry() {
        return Array.from(this.spans.values()).map((span) => ({
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId,
            name: span.name,
            startTimeUnixNano: span.startTime.getTime() * 1_000_000,
            endTimeUnixNano: span.endTime ? span.endTime.getTime() * 1_000_000 : undefined,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
                key,
                value: { stringValue: String(value) },
            })),
            events: span.events.map((event) => ({
                timeUnixNano: event.timestamp.getTime() * 1_000_000,
                name: event.name,
                attributes: event.attributes
                    ? Object.entries(event.attributes).map(([key, value]) => ({
                        key,
                        value: { stringValue: String(value) },
                    }))
                    : [],
            })),
            status: { code: span.status === 'ok' ? 1 : 2 },
        }));
    }
    generateId() {
        return Math.random().toString(36).substr(2, 16);
    }
    getActiveSpanId() {
        return this.activeSpans.get('main');
    }
    setActiveSpan(spanId) {
        this.activeSpans.set('main', spanId);
    }
}
exports.Tracer = Tracer;
class HealthChecker {
    checks = new Map();
    /**
     * Register a health check
     */
    register(check) {
        this.checks.set(check.name, check);
    }
    /**
     * Run all health checks
     */
    async runAll() {
        const results = {};
        let allHealthy = true;
        for (const [name, check] of this.checks) {
            const startTime = Date.now();
            try {
                const timeout = check.timeout || 5000;
                const result = await Promise.race([
                    check.check(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
                ]);
                results[name] = {
                    status: result ? 'ok' : 'error',
                    duration: Date.now() - startTime,
                };
                if (!result) {
                    allHealthy = false;
                }
            }
            catch (error) {
                results[name] = {
                    status: 'error',
                    duration: Date.now() - startTime,
                    error: error instanceof Error ? error.message : String(error),
                };
                allHealthy = false;
            }
        }
        return {
            healthy: allHealthy,
            checks: results,
        };
    }
    /**
     * Run a specific health check
     */
    async run(name) {
        const check = this.checks.get(name);
        if (!check) {
            throw new Error(`Health check ${name} not found`);
        }
        return check.check();
    }
}
exports.HealthChecker = HealthChecker;
/**
 * Singleton instances
 */
exports.metrics = new MetricsCollector();
exports.logger = new StructuredLogger();
exports.tracer = new Tracer();
exports.healthChecker = new HealthChecker();
