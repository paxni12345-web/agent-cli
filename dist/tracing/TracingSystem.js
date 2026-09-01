"use strict";
/**
 * Distributed Tracing System
 * OpenTelemetry-compatible distributed tracing, span management, and trace analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.w3cPropagator = exports.traceAnalyzer = exports.traceStorage = exports.tracerManager = exports.W3CTracePropagator = exports.TraceAnalyzer = exports.TraceStorage = exports.TracerManager = exports.SamplingType = exports.ProcessorType = exports.ExporterType = exports.SpanStatus = exports.SpanKind = exports.TraceStatus = void 0;
const EventBus_1 = require("../core/EventBus");
var TraceStatus;
(function (TraceStatus) {
    TraceStatus["OK"] = "ok";
    TraceStatus["Error"] = "error";
    TraceStatus["Timeout"] = "timeout";
    TraceStatus["Cancelled"] = "cancelled";
})(TraceStatus || (exports.TraceStatus = TraceStatus = {}));
var SpanKind;
(function (SpanKind) {
    SpanKind["Internal"] = "internal";
    SpanKind["Server"] = "server";
    SpanKind["Client"] = "client";
    SpanKind["Producer"] = "producer";
    SpanKind["Consumer"] = "consumer";
})(SpanKind || (exports.SpanKind = SpanKind = {}));
var SpanStatus;
(function (SpanStatus) {
    SpanStatus["Unset"] = "unset";
    SpanStatus["OK"] = "ok";
    SpanStatus["Error"] = "error";
})(SpanStatus || (exports.SpanStatus = SpanStatus = {}));
var ExporterType;
(function (ExporterType) {
    ExporterType["Console"] = "console";
    ExporterType["OTLP"] = "otlp";
    ExporterType["Jaeger"] = "jaeger";
    ExporterType["Zipkin"] = "zipkin";
    ExporterType["Datadog"] = "datadog";
    ExporterType["NewRelic"] = "newrelic";
})(ExporterType || (exports.ExporterType = ExporterType = {}));
var ProcessorType;
(function (ProcessorType) {
    ProcessorType["Simple"] = "simple";
    ProcessorType["Batch"] = "batch";
    ProcessorType["Filtering"] = "filtering";
    ProcessorType["Sampling"] = "sampling";
})(ProcessorType || (exports.ProcessorType = ProcessorType = {}));
var SamplingType;
(function (SamplingType) {
    SamplingType["Always"] = "always";
    SamplingType["Never"] = "never";
    SamplingType["Probability"] = "probability";
    SamplingType["RateLimiting"] = "rate_limiting";
    SamplingType["ParentBased"] = "parent_based";
})(SamplingType || (exports.SamplingType = SamplingType = {}));
/**
 * Tracer Manager
 */
class TracerManager {
    tracers = new Map();
    activeSpans = new Map();
    /**
     * Create tracer
     */
    createTracer(config) {
        const tracer = {
            ...config,
            id: this.generateTracerId(),
        };
        this.tracers.set(tracer.id, tracer);
        EventBus_1.eventBus.emitSync('tracing.tracer_created', tracer, 'TracerManager');
        return tracer;
    }
    /**
     * Start span
     */
    startSpan(tracerId, operationName, context, attributes) {
        const tracer = this.tracers.get(tracerId);
        if (!tracer || !tracer.enabled) {
            throw new Error('Tracer not found or disabled');
        }
        const span = {
            id: this.generateSpanInternalId(),
            spanId: this.generateSpanId(),
            traceId: context?.traceId || this.generateTraceId(),
            parentSpanId: context?.spanId,
            operationName,
            serviceName: tracer.serviceName,
            kind: SpanKind.Internal,
            status: SpanStatus.Unset,
            startTime: new Date(),
            attributes: attributes || {},
            events: [],
            links: [],
        };
        this.activeSpans.set(span.id, span);
        EventBus_1.eventBus.emitSync('tracing.span_started', span, 'TracerManager');
        return span;
    }
    /**
     * End span
     */
    endSpan(spanId, status) {
        const span = this.activeSpans.get(spanId);
        if (!span) {
            return;
        }
        span.endTime = new Date();
        span.duration = span.endTime.getTime() - span.startTime.getTime();
        span.status = status || SpanStatus.OK;
        this.activeSpans.delete(spanId);
        // Process span through processors
        this.processSpan(span);
        EventBus_1.eventBus.emitSync('tracing.span_ended', span, 'TracerManager');
    }
    /**
     * Add span event
     */
    addSpanEvent(spanId, name, attributes) {
        const span = this.activeSpans.get(spanId);
        if (span) {
            span.events.push({
                timestamp: new Date(),
                name,
                attributes: attributes || {},
            });
        }
    }
    /**
     * Set span attributes
     */
    setSpanAttributes(spanId, attributes) {
        const span = this.activeSpans.get(spanId);
        if (span) {
            Object.assign(span.attributes, attributes);
        }
    }
    /**
     * Get tracer
     */
    getTracer(tracerId) {
        return this.tracers.get(tracerId);
    }
    /**
     * List tracers
     */
    listTracers() {
        return Array.from(this.tracers.values());
    }
    processSpan(span) {
        // Mock span processing
        // In production, this would apply processors and export to configured backends
    }
    generateTracerId() {
        return `tracer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSpanInternalId() {
        return `span_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateTraceId() {
        return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    generateSpanId() {
        return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
}
exports.TracerManager = TracerManager;
/**
 * Trace Storage
 */
class TraceStorage {
    traces = new Map();
    spans = new Map();
    /**
     * Store trace
     */
    storeTrace(trace) {
        this.traces.set(trace.traceId, trace);
        for (const span of trace.spans) {
            this.spans.set(span.spanId, span);
        }
        EventBus_1.eventBus.emitSync('tracing.trace_stored', trace, 'TraceStorage');
    }
    /**
     * Store span
     */
    storeSpan(span) {
        this.spans.set(span.spanId, span);
        // Build or update trace
        let trace = this.traces.get(span.traceId);
        if (!trace) {
            trace = {
                id: this.generateTraceInternalId(),
                traceId: span.traceId,
                serviceName: span.serviceName,
                operationName: span.operationName,
                spans: [span],
                status: TraceStatus.OK,
                duration: 0,
                startTime: span.startTime,
                endTime: span.endTime || new Date(),
                metadata: {
                    environment: 'production',
                    version: '1.0.0',
                    tags: {},
                },
            };
            this.traces.set(span.traceId, trace);
        }
        else {
            trace.spans.push(span);
            this.updateTrace(trace);
        }
    }
    /**
     * Get trace
     */
    getTrace(traceId) {
        return this.traces.get(traceId);
    }
    /**
     * Get span
     */
    getSpan(spanId) {
        return this.spans.get(spanId);
    }
    /**
     * Query traces
     */
    queryTraces(query) {
        let traces = Array.from(this.traces.values());
        if (query.traceIds) {
            traces = traces.filter(t => query.traceIds.includes(t.traceId));
        }
        if (query.serviceNames) {
            traces = traces.filter(t => query.serviceNames.includes(t.serviceName));
        }
        if (query.operationNames) {
            traces = traces.filter(t => query.operationNames.includes(t.operationName));
        }
        if (query.status) {
            traces = traces.filter(t => t.status === query.status);
        }
        if (query.minDuration) {
            traces = traces.filter(t => t.duration >= query.minDuration);
        }
        if (query.maxDuration) {
            traces = traces.filter(t => t.duration <= query.maxDuration);
        }
        if (query.startTime) {
            traces = traces.filter(t => t.startTime >= query.startTime);
        }
        if (query.endTime) {
            traces = traces.filter(t => t.endTime <= query.endTime);
        }
        traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        if (query.limit) {
            traces = traces.slice(0, query.limit);
        }
        return traces;
    }
    updateTrace(trace) {
        const sortedSpans = trace.spans.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        trace.startTime = sortedSpans[0].startTime;
        const endTimes = sortedSpans
            .filter(s => s.endTime)
            .map(s => s.endTime.getTime());
        if (endTimes.length > 0) {
            trace.endTime = new Date(Math.max(...endTimes));
            trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
        }
        const hasError = trace.spans.some(s => s.status === SpanStatus.Error);
        trace.status = hasError ? TraceStatus.Error : TraceStatus.OK;
    }
    generateTraceInternalId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TraceStorage = TraceStorage;
/**
 * Trace Analyzer
 */
class TraceAnalyzer {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    /**
     * Analyze trace
     */
    analyzeTrace(traceId) {
        const trace = this.storage.getTrace(traceId);
        if (!trace) {
            throw new Error(`Trace not found: ${traceId}`);
        }
        const criticalPath = this.findCriticalPath(trace);
        const criticalPathDuration = criticalPath.reduce((sum, s) => sum + (s.duration || 0), 0);
        const serviceBreakdown = this.calculateServiceBreakdown(trace);
        const bottlenecks = this.identifyBottlenecks(trace);
        return {
            traceId,
            criticalPath,
            totalDuration: trace.duration,
            criticalPathDuration,
            parallelism: trace.duration > 0 ? criticalPathDuration / trace.duration : 0,
            serviceBreakdown,
            bottlenecks,
        };
    }
    /**
     * Build dependency graph
     */
    buildDependencyGraph(traces) {
        const serviceMap = new Map();
        const dependencyMap = new Map();
        for (const trace of traces) {
            for (const span of trace.spans) {
                // Update service node
                let node = serviceMap.get(span.serviceName);
                if (!node) {
                    node = {
                        name: span.serviceName,
                        type: 'service',
                        requestCount: 0,
                        errorCount: 0,
                        averageLatency: 0,
                    };
                    serviceMap.set(span.serviceName, node);
                }
                node.requestCount++;
                if (span.status === SpanStatus.Error) {
                    node.errorCount++;
                }
                // Find parent to create dependency
                if (span.parentSpanId) {
                    const parent = trace.spans.find(s => s.spanId === span.parentSpanId);
                    if (parent && parent.serviceName !== span.serviceName) {
                        const key = `${parent.serviceName}->${span.serviceName}`;
                        let dep = dependencyMap.get(key);
                        if (!dep) {
                            dep = {
                                from: parent.serviceName,
                                to: span.serviceName,
                                callCount: 0,
                                errorCount: 0,
                                averageLatency: 0,
                            };
                            dependencyMap.set(key, dep);
                        }
                        dep.callCount++;
                        if (span.status === SpanStatus.Error) {
                            dep.errorCount++;
                        }
                    }
                }
            }
        }
        const totalCalls = Array.from(dependencyMap.values()).reduce((sum, d) => sum + d.callCount, 0);
        return {
            services: Array.from(serviceMap.values()),
            dependencies: Array.from(dependencyMap.values()),
            metrics: {
                totalServices: serviceMap.size,
                totalCalls,
                averageLatency: 0,
                errorRate: 0,
            },
        };
    }
    /**
     * Calculate metrics
     */
    calculateMetrics(traces, startTime, endTime) {
        const byService = new Map();
        const byOperation = new Map();
        let totalSpans = 0;
        let successCount = 0;
        const latencies = [];
        for (const trace of traces) {
            totalSpans += trace.spans.length;
            latencies.push(trace.duration);
            if (trace.status === TraceStatus.OK) {
                successCount++;
            }
            // Service metrics
            let serviceMetric = byService.get(trace.serviceName);
            if (!serviceMetric) {
                serviceMetric = {
                    serviceName: trace.serviceName,
                    traceCount: 0,
                    spanCount: 0,
                    errorCount: 0,
                    averageLatency: 0,
                };
                byService.set(trace.serviceName, serviceMetric);
            }
            serviceMetric.traceCount++;
            serviceMetric.spanCount += trace.spans.length;
            if (trace.status === TraceStatus.Error) {
                serviceMetric.errorCount++;
            }
            // Operation metrics
            let opMetric = byOperation.get(trace.operationName);
            if (!opMetric) {
                opMetric = {
                    operationName: trace.operationName,
                    count: 0,
                    averageLatency: 0,
                    errorCount: 0,
                };
                byOperation.set(trace.operationName, opMetric);
            }
            opMetric.count++;
            if (trace.status === TraceStatus.Error) {
                opMetric.errorCount++;
            }
        }
        latencies.sort((a, b) => a - b);
        return {
            period: { start: startTime, end: endTime },
            totalTraces: traces.length,
            totalSpans,
            successRate: traces.length > 0 ? successCount / traces.length : 0,
            p50Latency: this.percentile(latencies, 50),
            p95Latency: this.percentile(latencies, 95),
            p99Latency: this.percentile(latencies, 99),
            errorRate: traces.length > 0 ? (traces.length - successCount) / traces.length : 0,
            throughput: traces.length / ((endTime.getTime() - startTime.getTime()) / 1000),
            byService,
            byOperation,
        };
    }
    findCriticalPath(trace) {
        // Simple critical path: spans without children, sorted by duration
        const childSpanIds = new Set(trace.spans.map(s => s.parentSpanId).filter(Boolean));
        const leafSpans = trace.spans.filter(s => !childSpanIds.has(s.spanId));
        return leafSpans.sort((a, b) => (b.duration || 0) - (a.duration || 0)).slice(0, 5);
    }
    calculateServiceBreakdown(trace) {
        const breakdown = new Map();
        for (const span of trace.spans) {
            let metrics = breakdown.get(span.serviceName);
            if (!metrics) {
                metrics = {
                    serviceName: span.serviceName,
                    spanCount: 0,
                    totalDuration: 0,
                    selfDuration: 0,
                    percentage: 0,
                    errorCount: 0,
                };
                breakdown.set(span.serviceName, metrics);
            }
            metrics.spanCount++;
            metrics.totalDuration += span.duration || 0;
            if (span.status === SpanStatus.Error) {
                metrics.errorCount++;
            }
        }
        // Calculate percentages
        for (const metrics of breakdown.values()) {
            metrics.percentage = trace.duration > 0 ? (metrics.totalDuration / trace.duration) * 100 : 0;
        }
        return breakdown;
    }
    identifyBottlenecks(trace) {
        const bottlenecks = [];
        const threshold = trace.duration * 0.1; // 10% of total duration
        for (const span of trace.spans) {
            if (span.duration && span.duration > threshold) {
                bottlenecks.push({
                    span,
                    duration: span.duration,
                    percentage: (span.duration / trace.duration) * 100,
                    reason: 'High duration',
                });
            }
        }
        return bottlenecks.sort((a, b) => b.duration - a.duration);
    }
    percentile(values, p) {
        if (values.length === 0)
            return 0;
        const index = Math.ceil((p / 100) * values.length) - 1;
        return values[Math.max(0, Math.min(index, values.length - 1))];
    }
}
exports.TraceAnalyzer = TraceAnalyzer;
/**
 * W3C Trace Context Propagator
 */
class W3CTracePropagator {
    inject(context, carrier) {
        carrier['traceparent'] = `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, '0')}`;
        if (context.traceState) {
            carrier['tracestate'] = context.traceState;
        }
    }
    extract(carrier) {
        const traceparent = carrier['traceparent'];
        if (!traceparent) {
            return null;
        }
        const parts = traceparent.split('-');
        if (parts.length !== 4) {
            return null;
        }
        return {
            traceId: parts[1],
            spanId: parts[2],
            traceFlags: parseInt(parts[3], 16),
            traceState: carrier['tracestate'],
        };
    }
}
exports.W3CTracePropagator = W3CTracePropagator;
/**
 * Singleton instances
 */
exports.tracerManager = new TracerManager();
exports.traceStorage = new TraceStorage();
exports.traceAnalyzer = new TraceAnalyzer(exports.traceStorage);
exports.w3cPropagator = new W3CTracePropagator();
