/**
 * Advanced Monitoring & Observability System
 * Distributed tracing, metrics collection, log aggregation
 * Health checks, alerting, incident management
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

// ============================================================================
// Observability Manager
// ============================================================================

export class ObservabilityManager extends EventEmitter {
  private config: ObservabilityConfig;
  private spans: Map<string, Span> = new Map();
  private traces: Map<string, Trace> = new Map();
  private metrics: Map<string, Metric[]> = new Map();
  private logs: LogEntry[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private dependencies: Map<string, ServiceDependency> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private resource: Resource;
  private startTime: number = Date.now();

  constructor(config: Partial<ObservabilityConfig> = {}) {
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

  public startSpan(name: string, options: Partial<Span> = {}): Span {
    if (!this.config.enableTracing) {
      return this.createNoOpSpan(name);
    }

    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return this.createNoOpSpan(name);
    }

    const span: Span = {
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

  public endSpan(spanId: string, status: SpanStatus = 'ok'): void {
    const span = this.spans.get(spanId);
    if (!span) return;

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

  public addSpanEvent(spanId: string, name: string, attributes: Record<string, any> = {}): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  public setSpanAttributes(spanId: string, attributes: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    Object.assign(span.attributes, attributes);
  }

  private buildTrace(traceId: string): void {
    const traceSpans = Array.from(this.spans.values()).filter(
      s => s.traceId === traceId && s.endTime
    );

    if (traceSpans.length === 0) return;

    const rootSpan = traceSpans.find(s => !s.parentSpanId);
    if (!rootSpan) return;

    const trace: Trace = {
      traceId,
      spans: traceSpans,
      startTime: Math.min(...traceSpans.map(s => s.startTime)),
      endTime: Math.max(...traceSpans.map(s => s.endTime!)),
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

  private analyzeDependencies(trace: Trace): void {
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
        if (span.status === 'error') dep.errorCount++;
        dep.avgLatency = (dep.avgLatency * (dep.callCount - 1) + (span.duration || 0)) / dep.callCount;
        dep.lastSeen = Date.now();
      }
    }
  }

  private createNoOpSpan(name: string): Span {
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

  public getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  public searchTraces(query: TraceQuery): Trace[] {
    let results = Array.from(this.traces.values());

    if (query.serviceName) {
      results = results.filter(t => t.rootSpan.resource.serviceName === query.serviceName);
    }

    if (query.minDuration) {
      results = results.filter(t => t.duration >= query.minDuration!);
    }

    if (query.maxDuration) {
      results = results.filter(t => t.duration <= query.maxDuration!);
    }

    if (query.status) {
      results = results.filter(t => t.status === query.status);
    }

    if (query.startTime && query.endTime) {
      results = results.filter(
        t => t.startTime >= query.startTime! && t.endTime <= query.endTime!
      );
    }

    return results.slice(0, query.limit || 100);
  }

  // ========================================================================
  // Metrics Collection
  // ========================================================================

  public recordMetric(metric: Omit<Metric, 'timestamp'>): void {
    if (!this.config.enableMetrics) return;

    const full: Metric = {
      ...metric,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    this.metrics.get(metric.name)!.push(full);
    this.emit('metric:recorded', { metric: full });

    // Check metric alerts
    this.checkMetricAlerts(full);
  }

  public incrementCounter(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      type: 'counter',
      value,
      tags,
    });
  }

  public setGauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      type: 'gauge',
      value,
      tags,
    });
  }

  public recordHistogram(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      type: 'histogram',
      value,
      tags,
    });
  }

  public getMetrics(name: string, startTime?: number, endTime?: number): Metric[] {
    const metrics = this.metrics.get(name) || [];

    if (!startTime && !endTime) {
      return metrics;
    }

    return metrics.filter(m => {
      if (startTime && m.timestamp < startTime) return false;
      if (endTime && m.timestamp > endTime) return false;
      return true;
    });
  }

  public aggregateMetrics(
    name: string,
    aggregation: MetricAggregation['aggregation'],
    windowSize: number
  ): MetricAggregation[] {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return [];

    const aggregations: MetricAggregation[] = [];
    const windows = this.createTimeWindows(metrics, windowSize);

    for (const [windowStart, windowMetrics] of windows) {
      const values = windowMetrics.map(m => m.value);
      let value: number;

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

  private createTimeWindows(metrics: Metric[], windowSize: number): Map<number, Metric[]> {
    const windows = new Map<number, Metric[]>();

    for (const metric of metrics) {
      const windowStart = Math.floor(metric.timestamp / windowSize) * windowSize;
      if (!windows.has(windowStart)) {
        windows.set(windowStart, []);
      }
      windows.get(windowStart)!.push(metric);
    }

    return windows;
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }

  // ========================================================================
  // Logging
  // ========================================================================

  public log(level: LogLevel, message: string, attributes: Record<string, any> = {}): void {
    if (!this.config.enableLogging) return;

    if (this.getLogLevelValue(level) < this.getLogLevelValue(this.config.logLevel)) {
      return;
    }

    const entry: LogEntry = {
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

  public trace(message: string, attributes?: Record<string, any>): void {
    this.log('trace', message, attributes);
  }

  public debug(message: string, attributes?: Record<string, any>): void {
    this.log('debug', message, attributes);
  }

  public info(message: string, attributes?: Record<string, any>): void {
    this.log('info', message, attributes);
  }

  public warn(message: string, attributes?: Record<string, any>): void {
    this.log('warn', message, attributes);
  }

  public error(message: string, error?: Error, attributes?: Record<string, any>): void {
    this.log('error', message, {
      ...attributes,
      error: error?.message,
      stack: error?.stack,
    });
  }

  public fatal(message: string, error?: Error, attributes?: Record<string, any>): void {
    this.log('fatal', message, {
      ...attributes,
      error: error?.message,
      stack: error?.stack,
    });
  }

  private getLogLevelValue(level: LogLevel): number {
    const levels: Record<LogLevel, number> = {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4,
      fatal: 5,
    };
    return levels[level];
  }

  public searchLogs(query: LogQuery): LogEntry[] {
    let results = [...this.logs];

    if (query.level) {
      results = results.filter(l => l.level === query.level);
    }

    if (query.message) {
      results = results.filter(l => l.message.includes(query.message!));
    }

    if (query.traceId) {
      results = results.filter(l => l.traceId === query.traceId);
    }

    if (query.startTime && query.endTime) {
      results = results.filter(
        l => l.timestamp >= query.startTime! && l.timestamp <= query.endTime!
      );
    }

    return results.slice(0, query.limit || 100);
  }

  // ========================================================================
  // Health Checks
  // ========================================================================

  public registerHealthCheck(check: Omit<HealthCheck, 'id'>): HealthCheck {
    const full: HealthCheck = {
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

  private async runHealthCheck(checkId: string): Promise<void> {
    const check = this.healthChecks.get(checkId);
    if (!check || !check.enabled) return;

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
    } catch (error) {
      const result: HealthCheckResult = {
        healthy: false,
        status: 'unhealthy',
        message: (error as Error).message,
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

  public async getSystemHealth(): Promise<SystemHealth> {
    const checks = new Map<string, HealthCheckResult>();

    for (const [id, check] of this.healthChecks.entries()) {
      if (check.lastCheck) {
        checks.set(id, check.lastCheck);
      }
    }

    const allHealthy = Array.from(checks.values()).every(r => r.healthy);
    const anyUnhealthy = Array.from(checks.values()).some(r => !r.healthy);

    let status: SystemHealth['status'];
    if (allHealthy) {
      status = 'healthy';
    } else if (anyUnhealthy) {
      status = 'unhealthy';
    } else {
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

  public createIncident(incident: Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>): Incident {
    const full: Incident = {
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

  private createHealthIncident(check: HealthCheck, result: HealthCheckResult): void {
    // Check if incident already exists
    const existing = Array.from(this.incidents.values()).find(
      i => i.source === check.id && i.status !== 'closed'
    );

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

  public updateIncident(incidentId: string, updates: Partial<Incident>): void {
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

  public resolveIncident(incidentId: string, resolution: string): void {
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

  public getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  public listIncidents(filter?: IncidentFilter): Incident[] {
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

  public createAlert(alert: Omit<Alert, 'id' | 'triggerCount'>): Alert {
    const full: Alert = {
      ...alert,
      id: this.generateId(),
      triggerCount: 0,
    };

    this.alerts.set(full.id, full);
    this.emit('alert:created', { alert: full });

    return full;
  }

  private checkMetricAlerts(metric: Metric): void {
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

  private evaluateAlertCondition(condition: AlertCondition, value: number): boolean {
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

  private async triggerAlert(alert: Alert, context: any): Promise<void> {
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

  private async sendAlertNotification(
    alert: Alert,
    channel: AlertChannel,
    context: any
  ): Promise<void> {
    this.emit('alert:notification:sent', { alert, channel, context });
  }

  // ========================================================================
  // Export
  // ========================================================================

  private async exportSpan(span: Span): Promise<void> {
    for (const exporter of this.config.exporters) {
      await this.exportToBackend(exporter, 'span', span);
    }
  }

  private async exportLog(entry: LogEntry): Promise<void> {
    for (const exporter of this.config.exporters) {
      await this.exportToBackend(exporter, 'log', entry);
    }
  }

  private async exportToBackend(
    exporter: ExporterConfig,
    type: string,
    data: any
  ): Promise<void> {
    // In production, this would send to actual observability backends
    this.emit('export', { exporter, type, data });
  }

  // ========================================================================
  // Background Tasks
  // ========================================================================

  private startBackgroundTasks(): void {
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

  private performMetricAggregation(): void {
    for (const [name] of this.metrics.entries()) {
      const aggregations = this.aggregateMetrics(name, 'avg', 60000);
      this.emit('metrics:aggregated', { name, aggregations });
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

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

  private generateId(): string {
    return `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private runWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      ),
    ]);
  }

  public getDependencies(): ServiceDependency[] {
    return Array.from(this.dependencies.values());
  }

  public getStats(): ObservabilityStats {
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

// ============================================================================
// Supporting Types
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export default ObservabilityManager;
