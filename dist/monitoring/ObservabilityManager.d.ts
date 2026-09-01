/**
 * Advanced Monitoring & Observability System
 * Distributed tracing, metrics collection, log aggregation
 * Health checks, alerting, incident management
 */
import { EventEmitter } from 'events';
export interface ObservabilityConfig {
    enableTracing: boolean;
    enableMetrics: boolean;
    enableLogging: boolean;
    samplingRate: number;
    metricsInterval: number;
    logLevel: LogLevel;
    exporters: ExporterConfig[];
    healthCheckInterval: number;
}
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface ExporterConfig {
    type: 'jaeger' | 'zipkin' | 'prometheus' | 'datadog' | 'newrelic' | 'elasticsearch';
    endpoint: string;
    apiKey?: string;
    batchSize: number;
    flushInterval: number;
}
export interface Span {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: SpanStatus;
    attributes: Record<string, any>;
    events: SpanEvent[];
    links: SpanLink[];
    kind: SpanKind;
    resource: Resource;
}
export type SpanStatus = 'ok' | 'error' | 'unset';
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes: Record<string, any>;
}
export interface SpanLink {
    traceId: string;
    spanId: string;
    attributes: Record<string, any>;
}
export interface Resource {
    serviceName: string;
    serviceVersion: string;
    environment: string;
    hostname: string;
    attributes: Record<string, any>;
}
export interface Trace {
    traceId: string;
    spans: Span[];
    startTime: number;
    endTime: number;
    duration: number;
    rootSpan: Span;
    status: SpanStatus;
}
export interface Metric {
    name: string;
    type: MetricType;
    value: number;
    timestamp: number;
    tags: Record<string, string>;
    unit?: string;
}
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    traceId?: string;
    spanId?: string;
    attributes: Record<string, any>;
    error?: Error;
    stack?: string;
}
export interface HealthCheck {
    id: string;
    name: string;
    type: HealthCheckType;
    interval: number;
    timeout: number;
    retries: number;
    check: () => Promise<HealthCheckResult>;
    enabled: boolean;
    lastCheck?: HealthCheckResult;
}
export type HealthCheckType = 'liveness' | 'readiness' | 'startup';
export interface HealthCheckResult {
    healthy: boolean;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    timestamp: number;
    duration: number;
    details?: Record<string, any>;
}
export interface SystemHealth {
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: Map<string, HealthCheckResult>;
    timestamp: number;
    uptime: number;
}
export interface Incident {
    id: string;
    title: string;
    description: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    source: string;
    createdAt: number;
    updatedAt: number;
    resolvedAt?: number;
    assignee?: string;
    tags: string[];
    timeline: IncidentEvent[];
    relatedTraces: string[];
    relatedLogs: string[];
}
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export interface IncidentEvent {
    timestamp: number;
    type: 'created' | 'updated' | 'comment' | 'status_change' | 'assigned' | 'resolved';
    actor: string;
    message: string;
    metadata?: Record<string, any>;
}
export interface Alert {
    id: string;
    name: string;
    condition: AlertCondition;
    severity: IncidentSeverity;
    enabled: boolean;
    channels: AlertChannel[];
    cooldown: number;
    lastTriggered?: number;
    triggerCount: number;
}
export interface AlertCondition {
    type: 'metric' | 'trace' | 'log' | 'health';
    metric?: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
    threshold: number;
    duration: number;
    aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}
export interface AlertChannel {
    type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms';
    config: Record<string, any>;
}
export interface MetricAggregation {
    name: string;
    aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'p50' | 'p95' | 'p99';
    value: number;
    windowStart: number;
    windowEnd: number;
    sampleCount: number;
}
export interface ServiceDependency {
    source: string;
    target: string;
    type: 'sync' | 'async' | 'database' | 'cache' | 'queue';
    callCount: number;
    errorCount: number;
    avgLatency: number;
    lastSeen: number;
}
export declare class ObservabilityManager extends EventEmitter {
    private config;
    private spans;
    private traces;
    private metrics;
    private logs;
    private healthChecks;
    private incidents;
    private alerts;
    private dependencies;
    private activeSpans;
    private resource;
    private startTime;
    constructor(config?: Partial<ObservabilityConfig>);
    startSpan(name: string, options?: Partial<Span>): Span;
    endSpan(spanId: string, status?: SpanStatus): void;
    addSpanEvent(spanId: string, name: string, attributes?: Record<string, any>): void;
    setSpanAttributes(spanId: string, attributes: Record<string, any>): void;
    private buildTrace;
    private analyzeDependencies;
    private createNoOpSpan;
    getTrace(traceId: string): Trace | undefined;
    searchTraces(query: TraceQuery): Trace[];
    recordMetric(metric: Omit<Metric, 'timestamp'>): void;
    incrementCounter(name: string, value?: number, tags?: Record<string, string>): void;
    setGauge(name: string, value: number, tags?: Record<string, string>): void;
    recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
    getMetrics(name: string, startTime?: number, endTime?: number): Metric[];
    aggregateMetrics(name: string, aggregation: MetricAggregation['aggregation'], windowSize: number): MetricAggregation[];
    private createTimeWindows;
    private percentile;
    log(level: LogLevel, message: string, attributes?: Record<string, any>): void;
    trace(message: string, attributes?: Record<string, any>): void;
    debug(message: string, attributes?: Record<string, any>): void;
    info(message: string, attributes?: Record<string, any>): void;
    warn(message: string, attributes?: Record<string, any>): void;
    error(message: string, error?: Error, attributes?: Record<string, any>): void;
    fatal(message: string, error?: Error, attributes?: Record<string, any>): void;
    private getLogLevelValue;
    searchLogs(query: LogQuery): LogEntry[];
    registerHealthCheck(check: Omit<HealthCheck, 'id'>): HealthCheck;
    private runHealthCheck;
    getSystemHealth(): Promise<SystemHealth>;
    createIncident(incident: Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>): Incident;
    private createHealthIncident;
    updateIncident(incidentId: string, updates: Partial<Incident>): void;
    resolveIncident(incidentId: string, resolution: string): void;
    getIncident(incidentId: string): Incident | undefined;
    listIncidents(filter?: IncidentFilter): Incident[];
    createAlert(alert: Omit<Alert, 'id' | 'triggerCount'>): Alert;
    private checkMetricAlerts;
    private evaluateAlertCondition;
    private triggerAlert;
    private sendAlertNotification;
    private exportSpan;
    private exportLog;
    private exportToBackend;
    private startBackgroundTasks;
    private performMetricAggregation;
    private generateTraceId;
    private generateSpanId;
    private generateId;
    private runWithTimeout;
    getDependencies(): ServiceDependency[];
    getStats(): ObservabilityStats;
}
interface TraceQuery {
    serviceName?: string;
    minDuration?: number;
    maxDuration?: number;
    status?: SpanStatus;
    startTime?: number;
    endTime?: number;
    limit?: number;
}
interface LogQuery {
    level?: LogLevel;
    message?: string;
    traceId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
}
interface IncidentFilter {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
}
interface ObservabilityStats {
    traces: number;
    spans: number;
    activeSpans: number;
    metrics: number;
    logs: number;
    healthChecks: number;
    incidents: number;
    alerts: number;
}
export default ObservabilityManager;
//# sourceMappingURL=ObservabilityManager.d.ts.map