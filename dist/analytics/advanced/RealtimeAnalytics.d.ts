/**
 * RealtimeAnalytics - Real-time stream processing and analytics
 * Live dashboards, event correlation, and real-time aggregation
 */
import { EventEmitter } from 'events';
export interface StreamEvent {
    id: string;
    timestamp: Date;
    type: string;
    data: any;
    metadata: Record<string, any>;
}
export interface MetricAggregation {
    metric: string;
    value: number;
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
    timestamp: Date;
}
export interface TimeWindow {
    start: Date;
    end: Date;
    duration: number;
    type: 'tumbling' | 'sliding' | 'session';
}
export interface StreamQuery {
    id: string;
    name: string;
    filter?: (event: StreamEvent) => boolean;
    map?: (event: StreamEvent) => any;
    reduce?: (acc: any, event: StreamEvent) => any;
    window?: TimeWindow;
    output: string;
}
export interface Dashboard {
    id: string;
    name: string;
    widgets: Widget[];
    refreshInterval: number;
    lastUpdated: Date;
}
export interface Widget {
    id: string;
    type: 'chart' | 'table' | 'metric' | 'gauge';
    title: string;
    query: string;
    config: any;
    data?: any;
}
export interface Alert {
    id: string;
    name: string;
    condition: (metrics: MetricAggregation[]) => boolean;
    threshold: number;
    enabled: boolean;
    fired: boolean;
    lastFired?: Date;
}
export declare class RealtimeAnalytics extends EventEmitter {
    private streams;
    private queries;
    private dashboards;
    private alerts;
    private aggregations;
    private windowSize;
    constructor(windowSize?: number);
    /**
     * Ingest stream event
     */
    ingest(event: StreamEvent): void;
    /**
     * Process event through registered queries
     */
    private processEvent;
    /**
     * Aggregate event in time window
     */
    private aggregateInWindow;
    /**
     * Get window key for event
     */
    private getWindowKey;
    /**
     * Register stream query
     */
    registerQuery(query: StreamQuery): void;
    /**
     * Execute ad-hoc query
     */
    query(streamType: string, filter?: (event: StreamEvent) => boolean, timeRange?: {
        start: Date;
        end: Date;
    }): StreamEvent[];
    /**
     * Calculate metric aggregations
     */
    aggregate(streamType: string, metric: string, operation: 'sum' | 'avg' | 'min' | 'max' | 'count', groupBy?: string, timeRange?: {
        start: Date;
        end: Date;
    }): Map<string, number>;
    /**
     * Create dashboard
     */
    createDashboard(dashboard: Dashboard): void;
    /**
     * Update dashboard data
     */
    updateDashboard(dashboardId: string): void;
    /**
     * Execute widget query
     */
    private executeWidgetQuery;
    /**
     * Start dashboard auto-refresh
     */
    private startDashboardRefresh;
    /**
     * Register alert
     */
    registerAlert(alert: Alert): void;
    /**
     * Check alerts
     */
    private checkAlerts;
    /**
     * Event correlation
     */
    correlate(streamType1: string, streamType2: string, correlationKey: string, timeWindow?: number): Array<{
        event1: StreamEvent;
        event2: StreamEvent;
    }>;
    /**
     * Pattern detection
     */
    detectPattern(streamType: string, pattern: StreamEvent[], timeWindow?: number): StreamEvent[][];
    /**
     * Check if data matches pattern
     */
    private matchesPattern;
    /**
     * Calculate percentiles
     */
    percentile(streamType: string, metric: string, percentiles: number[]): Map<number, number>;
    /**
     * Anomaly detection using Z-score
     */
    detectAnomalies(streamType: string, metric: string, threshold?: number): StreamEvent[];
    /**
     * Clean old events
     */
    private cleanOldEvents;
    /**
     * Start processing loop
     */
    private startProcessing;
    /**
     * Get stream statistics
     */
    getStatistics(streamType?: string): any;
    /**
     * Calculate event rate
     */
    private calculateRate;
    /**
     * Export stream data
     */
    exportStream(streamType: string, format: 'json' | 'csv'): string;
    /**
     * Get dashboard
     */
    getDashboard(dashboardId: string): Dashboard | null;
    /**
     * List all dashboards
     */
    listDashboards(): Dashboard[];
}
export default RealtimeAnalytics;
//# sourceMappingURL=RealtimeAnalytics.d.ts.map