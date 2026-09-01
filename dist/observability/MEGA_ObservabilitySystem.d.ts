/**
 * MEGA PHASE 9: ADVANCED OBSERVABILITY & MONITORING SYSTEM
 * Complete monitoring, tracing, metrics, and alerting
 * Lines: 3000+
 */
import { EventEmitter } from 'events';
export interface TracingConfig {
    serviceName: string;
    environment: string;
    samplingRate: number;
    exporters: TracingExporter[];
    propagators: Propagator[];
    maxSpansPerTrace: number;
}
export type TracingExporter = 'jaeger' | 'zipkin' | 'otlp' | 'datadog' | 'newrelic';
export type Propagator = 'w3c' | 'b3' | 'jaeger' | 'datadog';
export interface Span {
    spanId: string;
    traceId: string;
    parentSpanId?: string;
    name: string;
    kind: SpanKind;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: SpanStatus;
    attributes: Map<string, any>;
    events: SpanEvent[];
    links: SpanLink[];
    resource: Resource;
}
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export interface SpanStatus {
    code: StatusCode;
    message?: string;
}
export type StatusCode = 'unset' | 'ok' | 'error';
export interface SpanEvent {
    name: string;
    timestamp: Date;
    attributes: Map<string, any>;
}
export interface SpanLink {
    spanId: string;
    traceId: string;
    attributes: Map<string, any>;
}
export interface Resource {
    serviceName: string;
    serviceVersion: string;
    environment: string;
    host: string;
    attributes: Map<string, any>;
}
export interface Trace {
    traceId: string;
    rootSpan: Span;
    spans: Span[];
    duration: number;
    serviceCalls: ServiceCall[];
    errors: TraceError[];
}
export interface ServiceCall {
    from: string;
    to: string;
    operation: string;
    duration: number;
    status: number;
}
export interface TraceError {
    spanId: string;
    message: string;
    stack?: string;
    timestamp: Date;
}
export declare class DistributedTracer extends EventEmitter {
    private config;
    private spans;
    private traces;
    private activeSpans;
    constructor(config?: Partial<TracingConfig>);
    startSpan(name: string, kind?: SpanKind, parentSpanId?: string): Span;
    endSpan(spanId: string, status?: SpanStatus): void;
    addEvent(spanId: string, name: string, attributes?: Map<string, any>): void;
    setAttribute(spanId: string, key: string, value: any): void;
    recordException(spanId: string, error: Error): void;
    private shouldSample;
    private findTraceId;
    private getResource;
    private exportSpan;
    private export;
    getTrace(traceId: string): Trace | undefined;
    private generateTraceId;
    private generateSpanId;
    getStats(): {
        totalSpans: number;
        activeSpans: number;
        totalTraces: number;
        avgSpansPerTrace: number;
    };
}
export interface MetricsConfig {
    prefix: string;
    tags: Map<string, string>;
    aggregationInterval: number;
    exporters: MetricsExporter[];
    defaultHistogramBuckets: number[];
}
export type MetricsExporter = 'prometheus' | 'statsd' | 'cloudwatch' | 'datadog' | 'graphite';
export interface Metric {
    name: string;
    type: MetricType;
    value: number | number[];
    timestamp: Date;
    tags: Map<string, string>;
    unit?: string;
}
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'timer';
export interface Counter {
    name: string;
    value: number;
    tags: Map<string, string>;
}
export interface Gauge {
    name: string;
    value: number;
    tags: Map<string, string>;
}
export interface Histogram {
    name: string;
    values: number[];
    buckets: number[];
    counts: Map<number, number>;
    tags: Map<string, string>;
}
export interface Summary {
    name: string;
    values: number[];
    quantiles: Map<number, number>;
    tags: Map<string, string>;
}
export interface Timer {
    name: string;
    startTime: Date;
    duration?: number;
    tags: Map<string, string>;
}
export declare class MetricsCollector extends EventEmitter {
    private config;
    private counters;
    private gauges;
    private histograms;
    private summaries;
    private timers;
    constructor(config?: Partial<MetricsConfig>);
    incrementCounter(name: string, value?: number, tags?: Map<string, string>): void;
    setGauge(name: string, value: number, tags?: Map<string, string>): void;
    recordHistogram(name: string, value: number, tags?: Map<string, string>): void;
    startTimer(name: string, tags?: Map<string, string>): string;
    stopTimer(timerId: string): number;
    time<T>(name: string, fn: () => T, tags?: Map<string, string>): T;
    timeAsync<T>(name: string, fn: () => Promise<T>, tags?: Map<string, string>): Promise<T>;
    private startAggregation;
    private aggregate;
    private exportMetrics;
    scrape(): string;
    private formatTags;
    private addPrefix;
    private mergeTags;
    private getKey;
    getStats(): {
        counters: number;
        gauges: number;
        histograms: number;
        timers: number;
    };
}
export interface LogConfig {
    level: LogLevel;
    format: LogFormat;
    outputs: LogOutput[];
    sampling: SamplingConfig;
    contextFields: string[];
}
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogFormat = 'json' | 'text' | 'structured';
export type LogOutput = 'console' | 'file' | 'syslog' | 'elasticsearch' | 'cloudwatch';
export interface SamplingConfig {
    enabled: boolean;
    rate: number;
    rules: SamplingRule[];
}
export interface SamplingRule {
    level: LogLevel;
    rate: number;
}
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context: Map<string, any>;
    traceId?: string;
    spanId?: string;
    error?: LogError;
    caller?: Caller;
}
export interface LogError {
    type: string;
    message: string;
    stack?: string;
}
export interface Caller {
    file: string;
    line: number;
    function: string;
}
export declare class Logger extends EventEmitter {
    private config;
    private context;
    constructor(config?: Partial<LogConfig>);
    trace(message: string, context?: Record<string, any>): void;
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;
    fatal(message: string, error?: Error, context?: Record<string, any>): void;
    private log;
    private shouldLog;
    private shouldSample;
    private write;
    private writeToOutput;
    private format;
    private formatJSON;
    private formatText;
    private formatStructured;
    withContext(context: Record<string, any>): Logger;
}
export interface AlertConfig {
    rules: AlertRule[];
    channels: AlertChannel[];
    grouping: GroupingConfig;
    throttling: ThrottlingConfig;
}
export interface AlertRule {
    id: string;
    name: string;
    condition: AlertCondition;
    severity: AlertSeverity;
    channels: string[];
    enabled: boolean;
}
export interface AlertCondition {
    metric: string;
    operator: Operator;
    threshold: number;
    duration: number;
}
export type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export interface AlertChannel {
    id: string;
    type: ChannelType;
    config: ChannelConfig;
    enabled: boolean;
}
export type ChannelType = 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms';
export interface ChannelConfig {
    [key: string]: any;
}
export interface GroupingConfig {
    enabled: boolean;
    by: string[];
    interval: number;
}
export interface ThrottlingConfig {
    enabled: boolean;
    interval: number;
    maxAlerts: number;
}
export interface Alert {
    id: string;
    ruleId: string;
    name: string;
    severity: AlertSeverity;
    message: string;
    value: number;
    threshold: number;
    state: AlertState;
    labels: Map<string, string>;
    annotations: Map<string, string>;
    startsAt: Date;
    endsAt?: Date;
    notifications: Notification[];
}
export type AlertState = 'pending' | 'firing' | 'resolved';
export interface Notification {
    id: string;
    channelId: string;
    sentAt: Date;
    status: NotificationStatus;
    error?: string;
}
export type NotificationStatus = 'pending' | 'sent' | 'failed';
export declare class AlertManager extends EventEmitter {
    private config;
    private rules;
    private channels;
    private alerts;
    private throttle;
    constructor(config?: Partial<AlertConfig>);
    evaluate(metric: string, value: number): Promise<void>;
    private evaluateCondition;
    private fireAlert;
    private shouldThrottle;
    private sendNotifications;
    private sendNotification;
    private deliverNotification;
    resolveAlert(alertId: string): void;
    getStats(): {
        totalAlerts: number;
        firingAlerts: number;
        resolvedAlerts: number;
        rules: number;
        channels: number;
    };
}
export declare class ObservabilitySystem {
    tracer: DistributedTracer;
    metrics: MetricsCollector;
    logger: Logger;
    alerts: AlertManager;
    constructor();
    getOverallStats(): {
        tracing: {
            totalSpans: number;
            activeSpans: number;
            totalTraces: number;
            avgSpansPerTrace: number;
        };
        metrics: {
            counters: number;
            gauges: number;
            histograms: number;
            timers: number;
        };
        alerts: {
            totalAlerts: number;
            firingAlerts: number;
            resolvedAlerts: number;
            rules: number;
            channels: number;
        };
    };
}
//# sourceMappingURL=MEGA_ObservabilitySystem.d.ts.map