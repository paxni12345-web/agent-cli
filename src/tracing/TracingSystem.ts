/**
 * Distributed Tracing System
 * OpenTelemetry-compatible distributed tracing, span management, and trace analysis
 */

import { eventBus } from '../core/EventBus';

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

export enum TraceStatus {
  OK = 'ok',
  Error = 'error',
  Timeout = 'timeout',
  Cancelled = 'cancelled',
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

export enum SpanKind {
  Internal = 'internal',
  Server = 'server',
  Client = 'client',
  Producer = 'producer',
  Consumer = 'consumer',
}

export enum SpanStatus {
  Unset = 'unset',
  OK = 'ok',
  Error = 'error',
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

export enum ExporterType {
  Console = 'console',
  OTLP = 'otlp',
  Jaeger = 'jaeger',
  Zipkin = 'zipkin',
  Datadog = 'datadog',
  NewRelic = 'newrelic',
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

export enum ProcessorType {
  Simple = 'simple',
  Batch = 'batch',
  Filtering = 'filtering',
  Sampling = 'sampling',
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

export enum SamplingType {
  Always = 'always',
  Never = 'never',
  Probability = 'probability',
  RateLimiting = 'rate_limiting',
  ParentBased = 'parent_based',
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
export class TracerManager {
  private tracers: Map<string, Tracer> = new Map();
  private activeSpans: Map<string, Span> = new Map();

  /**
   * Create tracer
   */
  createTracer(config: Omit<Tracer, 'id'>): Tracer {
    const tracer: Tracer = {
      ...config,
      id: this.generateTracerId(),
    };

    this.tracers.set(tracer.id, tracer);

    eventBus.emitSync('tracing.tracer_created', tracer, 'TracerManager');

    return tracer;
  }

  /**
   * Start span
   */
  startSpan(
    tracerId: string,
    operationName: string,
    context?: TracingContext,
    attributes?: Record<string, any>
  ): Span {
    const tracer = this.tracers.get(tracerId);

    if (!tracer || !tracer.enabled) {
      throw new Error('Tracer not found or disabled');
    }

    const span: Span = {
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

    eventBus.emitSync('tracing.span_started', span, 'TracerManager');

    return span;
  }

  /**
   * End span
   */
  endSpan(spanId: string, status?: SpanStatus): void {
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

    eventBus.emitSync('tracing.span_ended', span, 'TracerManager');
  }

  /**
   * Add span event
   */
  addSpanEvent(spanId: string, name: string, attributes?: Record<string, any>): void {
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
  setSpanAttributes(spanId: string, attributes: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      Object.assign(span.attributes, attributes);
    }
  }

  /**
   * Get tracer
   */
  getTracer(tracerId: string): Tracer | undefined {
    return this.tracers.get(tracerId);
  }

  /**
   * List tracers
   */
  listTracers(): Tracer[] {
    return Array.from(this.tracers.values());
  }

  private processSpan(span: Span): void {
    // Mock span processing
    // In production, this would apply processors and export to configured backends
  }

  private generateTracerId(): string {
    return `tracer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSpanInternalId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateTraceId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private generateSpanId(): string {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

/**
 * Trace Storage
 */
export class TraceStorage {
  private traces: Map<string, Trace> = new Map();
  private spans: Map<string, Span> = new Map();

  /**
   * Store trace
   */
  storeTrace(trace: Trace): void {
    this.traces.set(trace.traceId, trace);

    for (const span of trace.spans) {
      this.spans.set(span.spanId, span);
    }

    eventBus.emitSync('tracing.trace_stored', trace, 'TraceStorage');
  }

  /**
   * Store span
   */
  storeSpan(span: Span): void {
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
    } else {
      trace.spans.push(span);
      this.updateTrace(trace);
    }
  }

  /**
   * Get trace
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get span
   */
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Query traces
   */
  queryTraces(query: TraceQuery): Trace[] {
    let traces = Array.from(this.traces.values());

    if (query.traceIds) {
      traces = traces.filter(t => query.traceIds!.includes(t.traceId));
    }

    if (query.serviceNames) {
      traces = traces.filter(t => query.serviceNames!.includes(t.serviceName));
    }

    if (query.operationNames) {
      traces = traces.filter(t => query.operationNames!.includes(t.operationName));
    }

    if (query.status) {
      traces = traces.filter(t => t.status === query.status);
    }

    if (query.minDuration) {
      traces = traces.filter(t => t.duration >= query.minDuration!);
    }

    if (query.maxDuration) {
      traces = traces.filter(t => t.duration <= query.maxDuration!);
    }

    if (query.startTime) {
      traces = traces.filter(t => t.startTime >= query.startTime!);
    }

    if (query.endTime) {
      traces = traces.filter(t => t.endTime <= query.endTime!);
    }

    traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    if (query.limit) {
      traces = traces.slice(0, query.limit);
    }

    return traces;
  }

  private updateTrace(trace: Trace): void {
    const sortedSpans = trace.spans.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    trace.startTime = sortedSpans[0].startTime;

    const endTimes = sortedSpans
      .filter(s => s.endTime)
      .map(s => s.endTime!.getTime());

    if (endTimes.length > 0) {
      trace.endTime = new Date(Math.max(...endTimes));
      trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    }

    const hasError = trace.spans.some(s => s.status === SpanStatus.Error);
    trace.status = hasError ? TraceStatus.Error : TraceStatus.OK;
  }

  private generateTraceInternalId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Trace Analyzer
 */
export class TraceAnalyzer {
  private storage: TraceStorage;

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  /**
   * Analyze trace
   */
  analyzeTrace(traceId: string): TraceAnalysis {
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
  buildDependencyGraph(traces: Trace[]): DependencyGraph {
    const serviceMap = new Map<string, ServiceNode>();
    const dependencyMap = new Map<string, ServiceDependency>();

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
  calculateMetrics(traces: Trace[], startTime: Date, endTime: Date): TraceMetrics {
    const byService = new Map<string, ServiceTraceMetrics>();
    const byOperation = new Map<string, OperationMetrics>();

    let totalSpans = 0;
    let successCount = 0;
    const latencies: number[] = [];

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

  private findCriticalPath(trace: Trace): Span[] {
    // Simple critical path: spans without children, sorted by duration
    const childSpanIds = new Set(trace.spans.map(s => s.parentSpanId).filter(Boolean));
    const leafSpans = trace.spans.filter(s => !childSpanIds.has(s.spanId));

    return leafSpans.sort((a, b) => (b.duration || 0) - (a.duration || 0)).slice(0, 5);
  }

  private calculateServiceBreakdown(trace: Trace): Map<string, ServiceMetrics> {
    const breakdown = new Map<string, ServiceMetrics>();

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

  private identifyBottlenecks(trace: Trace): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
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

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }
}

/**
 * W3C Trace Context Propagator
 */
export class W3CTracePropagator implements Propagator {
  inject(context: TracingContext, carrier: Record<string, string>): void {
    carrier['traceparent'] = `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, '0')}`;

    if (context.traceState) {
      carrier['tracestate'] = context.traceState;
    }
  }

  extract(carrier: Record<string, string>): TracingContext | null {
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

/**
 * Singleton instances
 */
export const tracerManager = new TracerManager();
export const traceStorage = new TraceStorage();
export const traceAnalyzer = new TraceAnalyzer(traceStorage);
export const w3cPropagator = new W3CTracePropagator();
