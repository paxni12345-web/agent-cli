/**
 * Analytics and Reporting System
 * Usage analytics, performance reports, dashboards, and insights
 */
export interface AnalyticsEvent {
    id: string;
    category: string;
    action: string;
    label?: string;
    value?: number;
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}
export interface Report {
    id: string;
    name: string;
    type: 'usage' | 'performance' | 'errors' | 'custom';
    period: {
        start: Date;
        end: Date;
    };
    data: any;
    generatedAt: Date;
}
export interface DashboardWidget {
    id: string;
    type: 'metric' | 'chart' | 'table' | 'timeline';
    title: string;
    query: AnalyticsQuery;
    refreshInterval?: number;
}
export interface AnalyticsQuery {
    category?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
    aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
    limit?: number;
}
export interface Metric {
    name: string;
    value: number;
    timestamp: Date;
    tags?: Record<string, string>;
}
export interface Insight {
    id: string;
    type: 'trend' | 'anomaly' | 'recommendation';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    confidence: number;
    timestamp: Date;
    data?: any;
}
/**
 * Analytics Tracker
 */
export declare class AnalyticsTracker {
    private events;
    private sessionId;
    constructor();
    /**
     * Track event
     */
    track(category: string, action: string, label?: string, value?: number, metadata?: Record<string, any>): AnalyticsEvent;
    /**
     * Query events
     */
    query(query: AnalyticsQuery): AnalyticsEvent[];
    /**
     * Get event count
     */
    count(query: AnalyticsQuery): number;
    /**
     * Get aggregated value
     */
    aggregate(query: AnalyticsQuery): number;
    /**
     * Group events by time period
     */
    groupByTime(query: AnalyticsQuery): Map<string, AnalyticsEvent[]>;
    /**
     * Get top actions
     */
    getTopActions(category: string, limit?: number): Array<{
        action: string;
        count: number;
    }>;
    /**
     * Clear old events
     */
    clearOld(olderThanDays: number): number;
    private generateEventId;
    private generateSessionId;
    private getTimeBucket;
}
/**
 * Report Generator
 */
export declare class ReportGenerator {
    private tracker;
    private reports;
    constructor(tracker: AnalyticsTracker);
    /**
     * Generate usage report
     */
    generateUsageReport(startDate: Date, endDate: Date): Report;
    /**
     * Generate performance report
     */
    generatePerformanceReport(startDate: Date, endDate: Date): Report;
    /**
     * Generate error report
     */
    generateErrorReport(startDate: Date, endDate: Date): Report;
    /**
     * Get report by ID
     */
    getReport(id: string): Report | undefined;
    /**
     * List all reports
     */
    listReports(type?: Report['type']): Report[];
    /**
     * Export report to JSON
     */
    exportJSON(reportId: string): string;
    /**
     * Export report to CSV
     */
    exportCSV(reportId: string): string;
    private generateReportId;
    private getTopCategories;
    private getTopActions;
    private getTimeline;
    private getAverageValue;
    private getPercentile;
    private getSlowest;
    private groupByAction;
}
/**
 * Dashboard Manager
 */
export declare class DashboardManager {
    private tracker;
    private widgets;
    constructor(tracker: AnalyticsTracker);
    /**
     * Add widget to dashboard
     */
    addWidget(widget: DashboardWidget): void;
    /**
     * Remove widget
     */
    removeWidget(widgetId: string): void;
    /**
     * Get widget data
     */
    getWidgetData(widgetId: string): any;
    /**
     * Get all widgets
     */
    getWidgets(): DashboardWidget[];
    /**
     * Create default dashboard
     */
    static createDefault(): DashboardWidget[];
}
/**
 * Insights Engine
 */
export declare class InsightsEngine {
    private tracker;
    private insights;
    constructor(tracker: AnalyticsTracker);
    /**
     * Analyze and generate insights
     */
    analyze(): Promise<Insight[]>;
    /**
     * Get insights
     */
    getInsights(filter?: {
        type?: Insight['type'];
        minConfidence?: number;
    }): Insight[];
    private detectTrends;
    private detectAnomalies;
    private generateRecommendations;
    private generateInsightId;
}
/**
 * Singleton instances
 */
export declare const analyticsTracker: AnalyticsTracker;
export declare const reportGenerator: ReportGenerator;
export declare const dashboardManager: DashboardManager;
export declare const insightsEngine: InsightsEngine;
//# sourceMappingURL=Analytics.d.ts.map