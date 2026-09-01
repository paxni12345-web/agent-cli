/**
 * Monitoring & Observability - Metrics, logging, and tracing
 * Integration with Prometheus, Grafana, and OpenTelemetry
 */
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
    events: Array<{
        name: string;
        timestamp: Date;
        attributes?: Record<string, any>;
    }>;
}
/**
 * Metrics Collector
 */
export declare class MetricsCollector {
    private metrics;
    private counters;
    private gauges;
    /**
     * Increment a counter metric
     */
    incrementCounter(name: string, value?: number, labels?: Record<string, string>): void;
    /**
     * Set a gauge metric
     */
    setGauge(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Record a histogram value
     */
    recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Get metric values
     */
    getMetrics(name?: string): Metric[];
    /**
     * Export metrics in Prometheus format
     */
    exportPrometheus(): string;
    /**
     * Clear all metrics
     */
    clear(): void;
    private recordMetric;
    private getMetricKey;
}
/**
 * Structured Logger
 */
export declare class StructuredLogger {
    private logs;
    private maxLogs;
    private minLevel;
    constructor(minLevel?: LogEntry['level']);
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;
    fatal(message: string, error?: Error, context?: Record<string, any>): void;
    private log;
    private shouldLog;
    private outputToConsole;
    /**
     * Get logs with optional filtering
     */
    getLogs(filter?: {
        level?: LogEntry['level'];
        since?: Date;
        search?: string;
    }): LogEntry[];
    /**
     * Export logs as JSON
     */
    exportJSON(): string;
    /**
     * Clear all logs
     */
    clear(): void;
}
/**
 * Distributed Tracing
 */
export declare class Tracer {
    private spans;
    private activeSpans;
    /**
     * Start a new trace
     */
    startTrace(name: string, attributes?: Record<string, any>): Span;
    /**
     * Start a child span
     */
    startSpan(name: string, attributes?: Record<string, any>): Span;
    /**
     * End a span
     */
    endSpan(spanId: string, status?: 'ok' | 'error'): void;
    /**
     * Add event to span
     */
    addEvent(spanId: string, name: string, attributes?: Record<string, any>): void;
    /**
     * Set span attribute
     */
    setAttribute(spanId: string, key: string, value: any): void;
    /**
     * Get span
     */
    getSpan(spanId: string): Span | undefined;
    /**
     * Get all spans for a trace
     */
    getTrace(traceId: string): Span[];
    /**
     * Export traces in OpenTelemetry format
     */
    exportOpenTelemetry(): any[];
    private generateId;
    private getActiveSpanId;
    private setActiveSpan;
}
/**
 * Health Check System
 */
export interface HealthCheck {
    name: string;
    check: () => Promise<boolean>;
    timeout?: number;
}
export declare class HealthChecker {
    private checks;
    /**
     * Register a health check
     */
    register(check: HealthCheck): void;
    /**
     * Run all health checks
     */
    runAll(): Promise<{
        healthy: boolean;
        checks: Record<string, {
            status: 'ok' | 'error';
            duration: number;
            error?: string;
        }>;
    }>;
    /**
     * Run a specific health check
     */
    run(name: string): Promise<boolean>;
}
/**
 * Singleton instances
 */
export declare const metrics: MetricsCollector;
export declare const logger: StructuredLogger;
export declare const tracer: Tracer;
export declare const healthChecker: HealthChecker;
//# sourceMappingURL=Monitoring.d.ts.map