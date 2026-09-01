/**
 * Advanced Analytics & Reporting System
 * Real-time analytics, custom dashboards, data visualization
 * Report generation, data aggregation, predictive analytics
 */
import { EventEmitter } from 'events';
export interface AnalyticsConfig {
    enableRealTime: boolean;
    enablePredictive: boolean;
    retentionDays: number;
    aggregationInterval: number;
    samplingRate: number;
}
export interface Metric {
    id: string;
    name: string;
    type: MetricType;
    value: number;
    timestamp: number;
    tags: Record<string, string>;
    metadata?: Record<string, any>;
}
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'rate' | 'percentage';
export interface TimeSeries {
    id: string;
    metric: string;
    dataPoints: DataPoint[];
    aggregation: AggregationType;
    interval: number;
    startTime: number;
    endTime: number;
}
export interface DataPoint {
    timestamp: number;
    value: number;
    tags?: Record<string, string>;
}
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p95' | 'p99';
export interface Dashboard {
    id: string;
    name: string;
    description: string;
    widgets: Widget[];
    layout: DashboardLayout;
    filters: DashboardFilter[];
    refreshInterval: number;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
}
export interface Widget {
    id: string;
    type: WidgetType;
    title: string;
    config: WidgetConfig;
    position: WidgetPosition;
    size: WidgetSize;
}
export type WidgetType = 'line_chart' | 'bar_chart' | 'pie_chart' | 'area_chart' | 'scatter_plot' | 'heatmap' | 'table' | 'metric' | 'gauge' | 'progress';
export interface WidgetConfig {
    metrics: string[];
    timeRange: TimeRange;
    aggregation: AggregationType;
    groupBy?: string[];
    filters?: Record<string, any>;
    colors?: string[];
    threshold?: Threshold;
}
export interface TimeRange {
    start: number;
    end: number;
    relative?: string;
}
export interface Threshold {
    warning: number;
    critical: number;
    direction: 'above' | 'below';
}
export interface WidgetPosition {
    x: number;
    y: number;
}
export interface WidgetSize {
    width: number;
    height: number;
}
export interface DashboardLayout {
    columns: number;
    rowHeight: number;
    compact: boolean;
}
export interface DashboardFilter {
    field: string;
    operator: FilterOperator;
    value: any;
}
export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
export interface Report {
    id: string;
    name: string;
    type: ReportType;
    schedule?: ReportSchedule;
    format: ReportFormat;
    recipients: string[];
    sections: ReportSection[];
    parameters: Record<string, any>;
    lastGenerated?: number;
    nextRun?: number;
}
export type ReportType = 'executive' | 'operational' | 'technical' | 'custom';
export type ReportFormat = 'pdf' | 'html' | 'csv' | 'json' | 'excel';
export interface ReportSchedule {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour: number;
    minute: number;
    timezone: string;
}
export interface ReportSection {
    id: string;
    title: string;
    type: 'chart' | 'table' | 'text' | 'metrics' | 'insights';
    content: any;
    order: number;
}
export interface Alert {
    id: string;
    name: string;
    condition: AlertCondition;
    severity: AlertSeverity;
    channels: AlertChannel[];
    enabled: boolean;
    lastTriggered?: number;
    triggerCount: number;
}
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export interface AlertCondition {
    metric: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
    threshold: number;
    duration: number;
    aggregation: AggregationType;
}
export interface AlertChannel {
    type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
    config: Record<string, any>;
}
export interface Anomaly {
    id: string;
    metric: string;
    timestamp: number;
    expectedValue: number;
    actualValue: number;
    deviation: number;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
}
export interface Prediction {
    id: string;
    metric: string;
    timestamp: number;
    predictedValue: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
    algorithm: string;
}
export interface Insight {
    id: string;
    type: 'trend' | 'correlation' | 'anomaly' | 'prediction' | 'recommendation';
    title: string;
    description: string;
    confidence: number;
    impact: 'low' | 'medium' | 'high';
    actionable: boolean;
    actions?: string[];
    timestamp: number;
}
export interface DataAggregation {
    id: string;
    metric: string;
    aggregations: Record<AggregationType, number>;
    groupBy?: Record<string, any>;
    timeRange: TimeRange;
    sampleSize: number;
}
export declare class AnalyticsManager extends EventEmitter {
    private config;
    private metrics;
    private dashboards;
    private reports;
    private alerts;
    private anomalies;
    private predictions;
    private insights;
    constructor(config?: Partial<AnalyticsConfig>);
    recordMetric(metric: Omit<Metric, 'id' | 'timestamp'>): void;
    incrementCounter(name: string, value?: number, tags?: Record<string, string>): void;
    setGauge(name: string, value: number, tags?: Record<string, string>): void;
    recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
    getMetrics(name: string, timeRange?: TimeRange): Metric[];
    getTimeSeries(metric: string, timeRange: TimeRange, aggregation: AggregationType, interval: number): TimeSeries;
    private aggregate;
    private percentile;
    createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard>;
    updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<Dashboard>;
    deleteDashboard(dashboardId: string): Promise<void>;
    getDashboard(dashboardId: string): Dashboard | undefined;
    listDashboards(): Dashboard[];
    renderDashboard(dashboardId: string): Promise<DashboardData>;
    private renderWidget;
    createReport(report: Omit<Report, 'id'>): Promise<Report>;
    generateReport(reportId: string): Promise<GeneratedReport>;
    private generateReportSection;
    private generateChartSection;
    private generateTableSection;
    private generateMetricsSection;
    private generateInsightsSection;
    private scheduleReport;
    createAlert(alert: Omit<Alert, 'id' | 'triggerCount'>): Promise<Alert>;
    private checkAlerts;
    private evaluateAlertCondition;
    private triggerAlert;
    private sendAlertNotification;
    private detectAnomalies;
    private standardDeviation;
    getAnomalies(metricName?: string): Anomaly[];
    predict(metricName: string, horizon: number): Promise<Prediction[]>;
    private linearRegression;
    getPredictions(metricName: string): Prediction[];
    generateInsight(insight: Omit<Insight, 'id' | 'timestamp'>): void;
    getInsights(type?: Insight['type']): Insight[];
    private startAggregationLoop;
    private performAggregation;
    private cleanupOldMetrics;
    calculateCorrelation(metric1: string, metric2: string): number;
    private pearsonCorrelation;
    getStats(): AnalyticsStats;
    private generateId;
}
interface DashboardData {
    dashboard: Dashboard;
    widgetData: Record<string, any>;
    lastUpdated: number;
}
interface GeneratedReport {
    id: string;
    reportId: string;
    name: string;
    format: ReportFormat;
    sections: GeneratedSection[];
    generatedAt: number;
    parameters: Record<string, any>;
}
interface GeneratedSection extends ReportSection {
    generatedContent: any;
}
interface AnalyticsStats {
    totalMetrics: number;
    uniqueMetricNames: number;
    dashboards: number;
    reports: number;
    alerts: number;
    activeAlerts: number;
    anomalies: number;
    insights: number;
}
export default AnalyticsManager;
//# sourceMappingURL=AnalyticsManager.d.ts.map