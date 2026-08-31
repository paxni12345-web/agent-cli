/**
 * Observability and Monitoring System
 * Metrics collection, distributed tracing, logging aggregation, and alerting
 */

import { eventBus } from '../core/EventBus';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  unit?: string;
}

export enum MetricType {
  Counter = 'counter',
  Gauge = 'gauge',
  Histogram = 'histogram',
  Summary = 'summary',
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

export enum SpanStatus {
  OK = 'ok',
  Error = 'error',
  Cancelled = 'cancelled',
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

export enum LogLevel {
  Trace = 'trace',
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  Fatal = 'fatal',
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

export enum ComparisonOperator {
  GreaterThan = 'gt',
  GreaterThanOrEqual = 'gte',
  LessThan = 'lt',
  LessThanOrEqual = 'lte',
  Equal = 'eq',
  NotEqual = 'ne',
}

export enum AggregationType {
  Average = 'avg',
  Sum = 'sum',
  Min = 'min',
  Max = 'max',
  Count = 'count',
}

export enum AlertSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum AlertStatus {
  Active = 'active',
  Resolved = 'resolved',
  Acknowledged = 'acknowledged',
  Muted = 'muted',
}

export interface NotificationChannel {
  type: ChannelType;
  config: Record<string, any>;
}

export enum ChannelType {
  Email = 'email',
  Slack = 'slack',
  PagerDuty = 'pagerduty',
  Webhook = 'webhook',
  SMS = 'sms',
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

export enum PanelType {
  Graph = 'graph',
  SingleStat = 'single_stat',
  Table = 'table',
  Heatmap = 'heatmap',
  Gauge = 'gauge',
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

export enum HealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Unhealthy = 'unhealthy',
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
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private series: Map<string, MetricSeries> = new Map();

  /**
   * Record metric
   */
  record(metric: Metric): void {
    const key = this.getMetricKey(metric.name, metric.tags);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);

    // Update series
    this.updateSeries(metric);

    eventBus.emitSync('metrics.recorded', metric, 'MetricsCollector');
  }

  /**
   * Increment counter
   */
  increment(name: string, value: number = 1, tags: Record<string, string> = {}): void {
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
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
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
  histogram(name: string, value: number, tags: Record<string, string> = {}): void {
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
  query(
    metricName: string,
    timeRange: TimeRange,
    tags?: Record<string, string>
  ): MetricSeries[] {
    const results: MetricSeries[] = [];

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
  aggregate(
    metricName: string,
    aggregation: AggregationType,
    timeRange: TimeRange
  ): number {
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
  getStatistics(metricName: string, timeRange: TimeRange): MetricStatistics {
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

  private updateSeries(metric: Metric): void {
    const key = this.getMetricKey(metric.name, metric.tags);

    if (!this.series.has(key)) {
      this.series.set(key, {
        name: metric.name,
        points: [],
        tags: metric.tags,
      });
    }

    const series = this.series.get(key)!;
    series.points.push({
      timestamp: metric.timestamp,
      value: metric.value,
    });

    // Keep only last 1000 points
    if (series.points.length > 1000) {
      series.points.shift();
    }
  }

  private getMetricKey(name: string, tags: Record<string, string>): string {
    const tagStr = Object.entries(tags)
      .sort(([k1], [k2]) => k1.localeCompare(k2))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `${name}{${tagStr}}`;
  }
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
export class DistributedTracer {
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, Span> = new Map();

  /**
   * Start trace
   */
  startTrace(serviceName: string, operationName: string): Trace {
    const traceId = this.generateTraceId();

    const trace: Trace = {
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
  startSpan(traceId: string, operationName: string, parentSpanId?: string): Span {
    const trace = this.traces.get(traceId);

    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    const span: Span = {
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
  finishSpan(spanId: string): void {
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

      eventBus.emitSync('trace.completed', trace, 'DistributedTracer');
    }
  }

  /**
   * Add span tag
   */
  addTag(spanId: string, key: string, value: string): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * Log span event
   */
  logEvent(spanId: string, fields: Record<string, any>): void {
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
  setStatus(spanId: string, status: SpanStatus): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      span.status = status;
    }
  }

  /**
   * Get trace
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Query traces
   */
  queryTraces(filter: {
    serviceName?: string;
    operationName?: string;
    minDuration?: number;
    maxDuration?: number;
    tags?: Record<string, string>;
  }): Trace[] {
    let traces = Array.from(this.traces.values());

    if (filter.serviceName) {
      traces = traces.filter(t => t.serviceName === filter.serviceName);
    }

    if (filter.minDuration) {
      traces = traces.filter(t => t.duration >= filter.minDuration!);
    }

    if (filter.maxDuration) {
      traces = traces.filter(t => t.duration <= filter.maxDuration!);
    }

    return traces;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Log Aggregator
 */
export class LogAggregator {
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000;

  /**
   * Log entry
   */
  log(entry: Omit<LogEntry, 'id'>): void {
    const fullEntry: LogEntry = {
      ...entry,
      id: this.generateLogId(),
    };

    this.logs.push(fullEntry);

    // Maintain max size
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    eventBus.emitSync('log.entry', fullEntry, 'LogAggregator');
  }

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
  }): LogEntry[] {
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
      logs = logs.filter(l => l.timestamp >= filter.startTime!);
    }

    if (filter.endTime) {
      logs = logs.filter(l => l.timestamp <= filter.endTime!);
    }

    if (filter.search) {
      logs = logs.filter(l =>
        l.message.toLowerCase().includes(filter.search!.toLowerCase())
      );
    }

    return logs;
  }

  /**
   * Get log statistics
   */
  getStatistics(timeRange: TimeRange): LogStatistics {
    const logs = this.query({
      startTime: typeof timeRange.from === 'string' ? new Date(timeRange.from) : timeRange.from,
      endTime: typeof timeRange.to === 'string' ? new Date(timeRange.to) : timeRange.to,
    });

    const byLevel: Record<LogLevel, number> = {
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

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

export interface LogStatistics {
  total: number;
  byLevel: Record<LogLevel, number>;
}

/**
 * Alert Manager
 */
export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private evaluationInterval: number = 60000; // 1 minute

  constructor(private metricsCollector: MetricsCollector) {
    this.startEvaluation();
  }

  /**
   * Create alert
   */
  createAlert(alert: Omit<Alert, 'id' | 'status'>): Alert {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      status: AlertStatus.Active,
    };

    this.alerts.set(fullAlert.id, fullAlert);

    eventBus.emitSync('alert.created', fullAlert, 'AlertManager');

    return fullAlert;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);

    if (alert) {
      alert.status = AlertStatus.Acknowledged;
      eventBus.emitSync('alert.acknowledged', alert, 'AlertManager');
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);

    if (alert) {
      alert.status = AlertStatus.Resolved;
      alert.resolvedAt = new Date();
      eventBus.emitSync('alert.resolved', alert, 'AlertManager');
    }
  }

  /**
   * List alerts
   */
  listAlerts(filter?: { status?: AlertStatus; severity?: AlertSeverity }): Alert[] {
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
  private startEvaluation(): void {
    setInterval(() => {
      this.evaluateAlerts();
    }, this.evaluationInterval);
  }

  /**
   * Evaluate all alerts
   */
  private evaluateAlerts(): void {
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
  private evaluateAlert(alert: Alert): void {
    const timeRange: TimeRange = {
      from: new Date(Date.now() - alert.condition.duration),
      to: new Date(),
    };

    const value = this.metricsCollector.aggregate(
      alert.condition.metric,
      alert.condition.aggregation || AggregationType.Average,
      timeRange
    );

    const triggered = this.checkCondition(value, alert.condition);

    if (triggered && alert.status === AlertStatus.Active && !alert.triggeredAt) {
      alert.triggeredAt = new Date();
      this.sendNotifications(alert);
      eventBus.emitSync('alert.triggered', alert, 'AlertManager');
    } else if (!triggered && alert.triggeredAt) {
      alert.triggeredAt = undefined;
      alert.resolvedAt = new Date();
      alert.status = AlertStatus.Resolved;
      eventBus.emitSync('alert.auto_resolved', alert, 'AlertManager');
    }
  }

  private checkCondition(value: number, condition: AlertCondition): boolean {
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

  private sendNotifications(alert: Alert): void {
    for (const channel of alert.notifications) {
      this.sendNotification(alert, channel);
    }
  }

  private sendNotification(alert: Alert, channel: NotificationChannel): void {
    // Mock notification sending
    eventBus.emitSync('notification.sent', { alert, channel }, 'AlertManager');
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Health Monitor
 */
export class HealthMonitor {
  private healthChecks: Map<string, HealthCheck> = new Map();

  /**
   * Register health check
   */
  registerHealthCheck(service: string, check: () => Promise<ComponentHealth[]>): void {
    // Store check function for later execution
  }

  /**
   * Check health
   */
  async checkHealth(service: string): Promise<HealthCheck> {
    // Mock health check
    const checks: ComponentHealth[] = [
      { name: 'database', status: HealthStatus.Healthy, responseTime: 50 },
      { name: 'cache', status: HealthStatus.Healthy, responseTime: 10 },
      { name: 'api', status: HealthStatus.Healthy, responseTime: 100 },
    ];

    const overallStatus = checks.every(c => c.status === HealthStatus.Healthy)
      ? HealthStatus.Healthy
      : HealthStatus.Degraded;

    const healthCheck: HealthCheck = {
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
  getHealthStatus(service: string): HealthCheck | undefined {
    return this.healthChecks.get(service);
  }
}

/**
 * Singleton instances
 */
export const metricsCollector = new MetricsCollector();
export const distributedTracer = new DistributedTracer();
export const logAggregator = new LogAggregator();
export const alertManager = new AlertManager(metricsCollector);
export const healthMonitor = new HealthMonitor();
