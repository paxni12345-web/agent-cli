/**
 * Distributed Tracing System
 * OpenTelemetry-compatible distributed tracing, span management, and trace analysis
 */
export interface Trace {
    id: string;
    traceId: string;
    serviceName: string;
    operationName: string;
    spans: Span[];
    status: TraceStatus;
    duration: number;
    startTime: Date;
    endTime: Date;
    metadata: TraceMetadata;
}
export declare enum TraceStatus {
    OK = "ok",
    Error = "error",
    Timeout = "timeout",
    Cancelled = "cancelled"
}
export interface TraceMetadata {
    environment: string;
    version: string;
    user?: string;
    tags: Record<string, string>;
}
export interface Span {
    id: string;
    spanId: string;
    traceId: string;
    parentSpanId?: string;
    operationName: string;
    serviceName: string;
    kind: SpanKind;
    status: SpanStatus;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    attributes: Record<string, any>;
    events: SpanEvent[];
    links: SpanLink[];
}
export declare enum SpanKind {
    Internal = "internal",
    Server = "server",
    Client = "client",
    Producer = "producer",
    Consumer = "consumer"
}
export declare enum SpanStatus {
    Unset = "unset",
    OK = "ok",
    Error = "error"
}
export interface SpanEvent {
    timestamp: Date;
    name: string;
    attributes: Record<string, any>;
}
export interface SpanLink {
    traceId: string;
    spanId: string;
    attributes: Record<string, any>;
}
export interface TracingContext {
    traceId: string;
    spanId: string;
    traceFlags: number;
    traceState?: string;
}
export interface Tracer {
    id: string;
    name: string;
    version: string;
    serviceName: string;
    enabled: boolean;
    samplingRate: number;
    exporters: Exporter[];
    processors: SpanProcessor[];
}
export interface Exporter {
    id: string;
    type: ExporterType;
    config: ExporterConfig;
    enabled: boolean;
}
export declare enum ExporterType {
    Console = "console",
    OTLP = "otlp",
    Jaeger = "jaeger",
    Zipkin = "zipkin",
    Datadog = "datadog",
    NewRelic = "newrelic"
}
export interface ExporterConfig {
    endpoint?: string;
    headers?: Record<string, string>;
    timeout?: number;
    batchSize?: number;
    compression?: boolean;
}
export interface SpanProcessor {
    id: string;
    type: ProcessorType;
    config: ProcessorConfig;
}
export declare enum ProcessorType {
    Simple = "simple",
    Batch = "batch",
    Filtering = "filtering",
    Sampling = "sampling"
}
export interface ProcessorConfig {
    maxQueueSize?: number;
    maxExportBatchSize?: number;
    scheduledDelayMs?: number;
    exportTimeoutMs?: number;
    filter?: FilterConfig;
}
export interface FilterConfig {
    attributes?: Record<string, any>;
    operationNames?: string[];
    serviceNames?: string[];
}
export interface SamplingStrategy {
    type: SamplingType;
    rate: number;
    rules?: SamplingRule[];
}
export declare enum SamplingType {
    Always = "always",
    Never = "never",
    Probability = "probability",
    RateLimiting = "rate_limiting",
    ParentBased = "parent_based"
}
export interface SamplingRule {
    serviceName?: string;
    operationName?: string;
    attributes?: Record<string, any>;
    rate: number;
    priority: number;
}
export interface TraceQuery {
    traceIds?: string[];
    serviceNames?: string[];
    operationNames?: string[];
    status?: TraceStatus;
    minDuration?: number;
    maxDuration?: number;
    startTime?: Date;
    endTime?: Date;
    tags?: Record<string, string>;
    limit?: number;
}
export interface TraceAnalysis {
    traceId: string;
    criticalPath: Span[];
    totalDuration: number;
    criticalPathDuration: number;
    parallelism: number;
    serviceBreakdown: Map<string, ServiceMetrics>;
    bottlenecks: Bottleneck[];
}
export interface ServiceMetrics {
    serviceName: string;
    spanCount: number;
    totalDuration: number;
    selfDuration: number;
    percentage: number;
    errorCount: number;
}
export interface Bottleneck {
    span: Span;
    duration: number;
    percentage: number;
    reason: string;
}
export interface DependencyGraph {
    services: ServiceNode[];
    dependencies: ServiceDependency[];
    metrics: DependencyMetrics;
}
export interface ServiceNode {
    name: string;
    type: string;
    requestCount: number;
    errorCount: number;
    averageLatency: number;
}
export interface ServiceDependency {
    from: string;
    to: string;
    callCount: number;
    errorCount: number;
    averageLatency: number;
}
export interface DependencyMetrics {
    totalServices: number;
    totalCalls: number;
    averageLatency: number;
    errorRate: number;
}
export interface TraceMetrics {
    period: {
        start: Date;
        end: Date;
    };
    totalTraces: number;
    totalSpans: number;
    successRate: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    throughput: number;
    byService: Map<string, ServiceTraceMetrics>;
    byOperation: Map<string, OperationMetrics>;
}
export interface ServiceTraceMetrics {
    serviceName: string;
    traceCount: number;
    spanCount: number;
    errorCount: number;
    averageLatency: number;
}
export interface OperationMetrics {
    operationName: string;
    count: number;
    averageLatency: number;
    errorCount: number;
}
export interface Propagator {
    inject(context: TracingContext, carrier: Record<string, string>): void;
    extract(carrier: Record<string, string>): TracingContext | null;
}
/**
 * Tracer Manager
 */
export declare class TracerManager {
    private tracers;
    private activeSpans;
    /**
     * Create tracer
     */
    createTracer(config: Omit<Tracer, 'id'>): Tracer;
    /**
     * Start span
     */
    startSpan(tracerId: string, operationName: string, context?: TracingContext, attributes?: Record<string, any>): Span;
    /**
     * End span
     */
    endSpan(spanId: string, status?: SpanStatus): void;
    /**
     * Add span event
     */
    addSpanEvent(spanId: string, name: string, attributes?: Record<string, any>): void;
    /**
     * Set span attributes
     */
    setSpanAttributes(spanId: string, attributes: Record<string, any>): void;
    /**
     * Get tracer
     */
    getTracer(tracerId: string): Tracer | undefined;
    /**
     * List tracers
     */
    listTracers(): Tracer[];
    private processSpan;
    private generateTracerId;
    private generateSpanInternalId;
    private generateTraceId;
    private generateSpanId;
}
/**
 * Trace Storage
 */
export declare class TraceStorage {
    private traces;
    private spans;
    /**
     * Store trace
     */
    storeTrace(trace: Trace): void;
    /**
     * Store span
     */
    storeSpan(span: Span): void;
    /**
     * Get trace
     */
    getTrace(traceId: string): Trace | undefined;
    /**
     * Get span
     */
    getSpan(spanId: string): Span | undefined;
    /**
     * Query traces
     */
    queryTraces(query: TraceQuery): Trace[];
    private updateTrace;
    private generateTraceInternalId;
}
/**
 * Trace Analyzer
 */
export declare class TraceAnalyzer {
    private storage;
    constructor(storage: TraceStorage);
    /**
     * Analyze trace
     */
    analyzeTrace(traceId: string): TraceAnalysis;
    /**
     * Build dependency graph
     */
    buildDependencyGraph(traces: Trace[]): DependencyGraph;
    /**
     * Calculate metrics
     */
    calculateMetrics(traces: Trace[], startTime: Date, endTime: Date): TraceMetrics;
    private findCriticalPath;
    private calculateServiceBreakdown;
    private identifyBottlenecks;
    private percentile;
}
/**
 * W3C Trace Context Propagator
 */
export declare class W3CTracePropagator implements Propagator {
    inject(context: TracingContext, carrier: Record<string, string>): void;
    extract(carrier: Record<string, string>): TracingContext | null;
}
/**
 * Singleton instances
 */
export declare const tracerManager: TracerManager;
export declare const traceStorage: TraceStorage;
export declare const traceAnalyzer: TraceAnalyzer;
export declare const w3cPropagator: W3CTracePropagator;
//# sourceMappingURL=TracingSystem.d.ts.map