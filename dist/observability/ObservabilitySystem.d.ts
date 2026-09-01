/**
 * Observability and Monitoring System
 * Metrics collection, distributed tracing, logging aggregation, and alerting
 */
export interface Metric {
    name: string;
    type: MetricType;
    value: number;
    timestamp: Date;
    tags: Record<string, string>;
    unit?: string;
}
export declare enum MetricType {
    Counter = "counter",
    Gauge = "gauge",
    Histogram = "histogram",
    Summary = "summary"
}
export interface MetricSeries {
    name: string;
    points: MetricPoint[];
    tags: Record<string, string>;
}
export interface MetricPoint {
    timestamp: Date;
    value: number;
}
export interface Trace {
    traceId: string;
    spans: Span[];
    duration: number;
    startTime: Date;
    endTime: Date;
    serviceName: string;
}
export interface Span {
    spanId: string;
    traceId: string;
    parentSpanId?: string;
    operationName: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    tags: Record<string, string>;
    logs: SpanLog[];
    status: SpanStatus;
}
export declare enum SpanStatus {
    OK = "ok",
    Error = "error",
    Cancelled = "cancelled"
}
export interface SpanLog {
    timestamp: Date;
    fields: Record<string, any>;
}
export interface LogEntry {
    id: string;
    level: LogLevel;
    message: string;
    timestamp: Date;
    service: string;
    source: string;
    traceId?: string;
    spanId?: string;
    fields: Record<string, any>;
}
export declare enum LogLevel {
    Trace = "trace",
    Debug = "debug",
    Info = "info",
    Warn = "warn",
    Error = "error",
    Fatal = "fatal"
}
export interface Alert {
    id: string;
    name: string;
    condition: AlertCondition;
    severity: AlertSeverity;
    status: AlertStatus;
    notifications: NotificationChannel[];
    metadata: AlertMetadata;
    triggeredAt?: Date;
    resolvedAt?: Date;
}
export interface AlertCondition {
    metric: string;
    operator: ComparisonOperator;
    threshold: number;
    duration: number;
    aggregation?: AggregationType;
}
export declare enum ComparisonOperator {
    GreaterThan = "gt",
    GreaterThanOrEqual = "gte",
    LessThan = "lt",
    LessThanOrEqual = "lte",
    Equal = "eq",
    NotEqual = "ne"
}
export declare enum AggregationType {
    Average = "avg",
    Sum = "sum",
    Min = "min",
    Max = "max",
    Count = "count"
}
export declare enum AlertSeverity {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low"
}
export declare enum AlertStatus {
    Active = "active",
    Resolved = "resolved",
    Acknowledged = "acknowledged",
    Muted = "muted"
}
export interface NotificationChannel {
    type: ChannelType;
    config: Record<string, any>;
}
export declare enum ChannelType {
    Email = "email",
    Slack = "slack",
    PagerDuty = "pagerduty",
    Webhook = "webhook",
    SMS = "sms"
}
export interface AlertMetadata {
    createdBy: string;
    updatedBy?: string;
    tags: string[];
    annotations: Record<string, string>;
}
export interface Dashboard {
    id: string;
    name: string;
    description?: string;
    panels: Panel[];
    variables: DashboardVariable[];
    refresh: number;
    timeRange: TimeRange;
    createdAt: Date;
    updatedAt: Date;
}
export interface Panel {
    id: string;
    title: string;
    type: PanelType;
    query: MetricQuery;
    visualization: VisualizationConfig;
    position: PanelPosition;
}
export declare enum PanelType {
    Graph = "graph",
    SingleStat = "single_stat",
    Table = "table",
    Heatmap = "heatmap",
    Gauge = "gauge"
}
export interface MetricQuery {
    metric: string;
    aggregation?: AggregationType;
    groupBy?: string[];
    filters?: Record<string, string>;
}
export interface VisualizationConfig {
    colors?: string[];
    thresholds?: number[];
    format?: string;
    decimals?: number;
}
export interface PanelPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface DashboardVariable {
    name: string;
    type: 'query' | 'custom' | 'interval';
    query?: string;
    values?: string[];
    defaultValue: string;
}
export interface TimeRange {
    from: Date | string;
    to: Date | string;
}
export interface HealthCheck {
    service: string;
    status: HealthStatus;
    checks: ComponentHealth[];
    timestamp: Date;
}
export declare enum HealthStatus {
    Healthy = "healthy",
    Degraded = "degraded",
    Unhealthy = "unhealthy"
}
export interface ComponentHealth {
    name: string;
    status: HealthStatus;
    message?: string;
    responseTime?: number;
}
/**
 * Metrics Collector
 */
export declare class MetricsCollector {
    private metrics;
    private series;
    /**
     * Record metric
     */
    record(metric: Metric): void;
    /**
     * Increment counter
     */
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    /**
     * Set gauge
     */
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    /**
     * Record histogram
     */
    histogram(name: string, value: number, tags?: Record<string, string>): void;
    /**
     * Query metrics
     */
    query(metricName: string, timeRange: TimeRange, tags?: Record<string, string>): MetricSeries[];
    /**
     * Aggregate metrics
     */
    aggregate(metricName: string, aggregation: AggregationType, timeRange: TimeRange): number;
    /**
     * Get metric statistics
     */
    getStatistics(metricName: string, timeRange: TimeRange): MetricStatistics;
    private updateSeries;
    private getMetricKey;
}
export interface MetricStatistics {
    count: number;
    mean: number;
    min: number;
    max: number;
    stdDev: number;
    p50: number;
    p95: number;
    p99: number;
}
/**
 * Distributed Tracer
 */
export declare class DistributedTracer {
    private traces;
    private activeSpans;
    /**
     * Start trace
     */
    startTrace(serviceName: string, operationName: string): Trace;
    /**
     * Start span
     */
    startSpan(traceId: string, operationName: string, parentSpanId?: string): Span;
    /**
     * Finish span
     */
    finishSpan(spanId: string): void;
    /**
     * Add span tag
     */
    addTag(spanId: string, key: string, value: string): void;
    /**
     * Log span event
     */
    logEvent(spanId: string, fields: Record<string, any>): void;
    /**
     * Set span status
     */
    setStatus(spanId: string, status: SpanStatus): void;
    /**
     * Get trace
     */
    getTrace(traceId: string): Trace | undefined;
    /**
     * Query traces
     */
    queryTraces(filter: {
        serviceName?: string;
        operationName?: string;
        minDuration?: number;
        maxDuration?: number;
        tags?: Record<string, string>;
    }): Trace[];
    private generateTraceId;
    private generateSpanId;
}
/**
 * Log Aggregator
 */
export declare class LogAggregator {
    private logs;
    private maxLogs;
    /**
     * Log entry
     */
    log(entry: Omit<LogEntry, 'id'>): void;
    /**
     * Query logs
     */
    query(filter: {
        level?: LogLevel;
        service?: string;
        traceId?: string;
        startTime?: Date;
        endTime?: Date;
        search?: string;
    }): LogEntry[];
    /**
     * Get log statistics
     */
    getStatistics(timeRange: TimeRange): LogStatistics;
    private generateLogId;
}
export interface LogStatistics {
    total: number;
    byLevel: Record<LogLevel, number>;
}
/**
 * Alert Manager
 */
export declare class AlertManager {
    private metricsCollector;
    private alerts;
    private evaluationInterval;
    constructor(metricsCollector: MetricsCollector);
    /**
     * Create alert
     */
    createAlert(alert: Omit<Alert, 'id' | 'status'>): Alert;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string): void;
    /**
     * Resolve alert
     */
    resolveAlert(alertId: string): void;
    /**
     * List alerts
     */
    listAlerts(filter?: {
        status?: AlertStatus;
        severity?: AlertSeverity;
    }): Alert[];
    /**
     * Start alert evaluation
     */
    private startEvaluation;
    /**
     * Evaluate all alerts
     */
    private evaluateAlerts;
    /**
     * Evaluate single alert
     */
    private evaluateAlert;
    private checkCondition;
    private sendNotifications;
    private sendNotification;
    private generateAlertId;
}
/**
 * Health Monitor
 */
export declare class HealthMonitor {
    private healthChecks;
    /**
     * Register health check
     */
    registerHealthCheck(service: string, check: () => Promise<ComponentHealth[]>): void;
    /**
     * Check health
     */
    checkHealth(service: string): Promise<HealthCheck>;
    /**
     * Get health status
     */
    getHealthStatus(service: string): HealthCheck | undefined;
}
/**
 * Singleton instances
 */
export declare const metricsCollector: MetricsCollector;
export declare const distributedTracer: DistributedTracer;
export declare const logAggregator: LogAggregator;
export declare const alertManager: AlertManager;
export declare const healthMonitor: HealthMonitor;
//# sourceMappingURL=ObservabilitySystem.d.ts.map