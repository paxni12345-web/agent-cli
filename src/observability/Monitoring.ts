/**
 * Monitoring & Observability - Metrics, logging, and tracing
 * Integration with Prometheus, Grafana, and OpenTelemetry
 */

import { eventBus } from '../core/EventBus';

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
  traceId?: string;
  spanId?: string;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'ok' | 'error';
  attributes: Record<string, any>;
  events: Array<{ name: string; timestamp: Date; attributes?: Record<string, any> }>;
}

/**
 * Metrics Collector
 */
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
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
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
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
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
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
  getMetrics(name?: string): Metric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }

    const allMetrics: Metric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
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
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
  }

  private recordMetric(metric: Metric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metrics = this.metrics.get(metric.name)!;
    metrics.push(metric);

    // Keep only last 1000 entries per metric
    if (metrics.length > 1000) {
      metrics.shift();
    }

    eventBus.emitSync('metrics.recorded', metric, 'MetricsCollector');
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;

    const labelsStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}|${labelsStr}`;
  }
}

/**
 * Structured Logger
 */
export class StructuredLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 10000;
  private minLevel: LogEntry['level'] = 'info';

  constructor(minLevel?: LogEntry['level']) {
    if (minLevel) {
      this.minLevel = minLevel;
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, { ...context, error });
  }

  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('fatal', message, { ...context, error });
  }

  private log(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
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

    eventBus.emitSync('log.created', entry, 'StructuredLogger');
  }

  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  private outputToConsole(entry: LogEntry): void {
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
    } else if (entry.level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filter?: {
    level?: LogEntry['level'];
    since?: Date;
    search?: string;
  }): LogEntry[] {
    let logs = [...this.logs];

    if (filter?.level) {
      logs = logs.filter((l) => l.level === filter.level);
    }

    if (filter?.since) {
      logs = logs.filter((l) => l.timestamp >= filter.since!);
    }

    if (filter?.search) {
      const search = filter.search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.message.toLowerCase().includes(search) ||
          JSON.stringify(l.context).toLowerCase().includes(search)
      );
    }

    return logs;
  }

  /**
   * Export logs as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }
}

/**
 * Distributed Tracing
 */
export class Tracer {
  private spans: Map<string, Span> = new Map();
  private activeSpans: Map<string, string> = new Map(); // threadId -> spanId

  /**
   * Start a new trace
   */
  startTrace(name: string, attributes?: Record<string, any>): Span {
    const traceId = this.generateId();
    const spanId = this.generateId();

    const span: Span = {
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

    eventBus.emitSync('trace.started', span, 'Tracer');

    return span;
  }

  /**
   * Start a child span
   */
  startSpan(name: string, attributes?: Record<string, any>): Span {
    const parentSpanId = this.getActiveSpanId();
    const parentSpan = parentSpanId ? this.spans.get(parentSpanId) : null;

    const spanId = this.generateId();
    const span: Span = {
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
  endSpan(spanId: string, status?: 'ok' | 'error'): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();

    if (status) {
      span.status = status;
    }

    // Set parent as active if exists
    if (span.parentSpanId) {
      this.setActiveSpan(span.parentSpanId);
    }

    eventBus.emitSync('trace.ended', span, 'Tracer');
  }

  /**
   * Add event to span
   */
  addEvent(spanId: string, name: string, attributes?: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.events.push({
      name,
      timestamp: new Date(),
      attributes,
    });
  }

  /**
   * Set span attribute
   */
  setAttribute(spanId: string, key: string, value: any): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.attributes[key] = value;
  }

  /**
   * Get span
   */
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans for a trace
   */
  getTrace(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
  }

  /**
   * Export traces in OpenTelemetry format
   */
  exportOpenTelemetry(): any[] {
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

  private generateId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  private getActiveSpanId(): string | undefined {
    return this.activeSpans.get('main');
  }

  private setActiveSpan(spanId: string): void {
    this.activeSpans.set('main', spanId);
  }
}

/**
 * Health Check System
 */
export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  timeout?: number;
}

export class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();

  /**
   * Register a health check
   */
  register(check: HealthCheck): void {
    this.checks.set(check.name, check);
  }

  /**
   * Run all health checks
   */
  async runAll(): Promise<{
    healthy: boolean;
    checks: Record<string, { status: 'ok' | 'error'; duration: number; error?: string }>;
  }> {
    const results: Record<string, any> = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      const startTime = Date.now();

      try {
        const timeout = check.timeout || 5000;
        const result = await Promise.race([
          check.check(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeout)
          ),
        ]);

        results[name] = {
          status: result ? 'ok' : 'error',
          duration: Date.now() - startTime,
        };

        if (!result) {
          allHealthy = false;
        }
      } catch (error) {
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
  async run(name: string): Promise<boolean> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check ${name} not found`);
    }

    return check.check();
  }
}

/**
 * Singleton instances
 */
export const metrics = new MetricsCollector();
export const logger = new StructuredLogger();
export const tracer = new Tracer();
export const healthChecker = new HealthChecker();
