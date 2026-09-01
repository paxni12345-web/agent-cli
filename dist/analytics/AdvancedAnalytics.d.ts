/**
 * Advanced Analytics & Business Intelligence System
 * Real-time analytics, predictive analytics, and data insights
 *
 * Part of 350K lines goal
 */
import { EventEmitter } from 'events';
export interface AnalyticsConfig {
    enableRealtime: boolean;
    enablePredictive: boolean;
    enableAnomalyDetection: boolean;
    dataRetentionDays: number;
    aggregationInterval: number;
}
export interface Metric {
    id: string;
    name: string;
    type: MetricType;
    value: number;
    unit: string;
    tags: Record<string, string>;
    timestamp: Date;
    metadata?: Record<string, any>;
}
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export interface Event {
    id: string;
    name: string;
    type: EventType;
    properties: Record<string, any>;
    userId?: string;
    sessionId?: string;
    timestamp: Date;
}
export type EventType = 'page_view' | 'click' | 'conversion' | 'error' | 'custom';
export interface Funnel {
    id: string;
    name: string;
    steps: FunnelStep[];
    conversionRate: number;
    totalUsers: number;
    createdAt: Date;
}
export interface FunnelStep {
    name: string;
    event: string;
    users: number;
    conversionRate: number;
    averageTime: number;
}
export interface Cohort {
    id: string;
    name: string;
    criteria: CohortCriteria;
    users: string[];
    size: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CohortCriteria {
    conditions: Condition[];
    timeRange?: TimeRange;
}
export interface Condition {
    field: string;
    operator: ConditionOperator;
    value: any;
}
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface Dashboard {
    id: string;
    name: string;
    widgets: Widget[];
    layout: DashboardLayout;
    filters: DashboardFilter[];
    createdAt: Date;
    updatedAt: Date;
}
export interface Widget {
    id: string;
    type: WidgetType;
    title: string;
    query: AnalyticsQuery;
    visualization: VisualizationType;
    position: WidgetPosition;
    refresh: number;
}
export type WidgetType = 'metric' | 'chart' | 'table' | 'map' | 'text';
export type VisualizationType = 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'table';
export interface WidgetPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface DashboardLayout {
    columns: number;
    rowHeight: number;
}
export interface DashboardFilter {
    field: string;
    operator: string;
    value: any;
}
export interface AnalyticsQuery {
    metrics: string[];
    dimensions?: string[];
    filters?: QueryFilter[];
    timeRange: TimeRange;
    groupBy?: string[];
    orderBy?: OrderBy[];
    limit?: number;
}
export interface QueryFilter {
    field: string;
    operator: string;
    value: any;
}
export interface OrderBy {
    field: string;
    direction: 'asc' | 'desc';
}
export interface QueryResult {
    data: DataPoint[];
    metadata: QueryMetadata;
}
export interface DataPoint {
    timestamp: Date;
    values: Record<string, number>;
    dimensions?: Record<string, string>;
}
export interface QueryMetadata {
    query: AnalyticsQuery;
    executionTime: number;
    dataPoints: number;
    cached: boolean;
}
export interface PredictionModel {
    id: string;
    name: string;
    type: ModelType;
    algorithm: Algorithm;
    features: string[];
    target: string;
    accuracy: number;
    trainedAt: Date;
    version: number;
}
export type ModelType = 'regression' | 'classification' | 'clustering' | 'forecasting';
export type Algorithm = 'linear_regression' | 'logistic_regression' | 'random_forest' | 'xgboost' | 'neural_network' | 'arima' | 'prophet';
export interface Prediction {
    id: string;
    modelId: string;
    input: Record<string, any>;
    prediction: any;
    confidence: number;
    timestamp: Date;
}
export interface Forecast {
    id: string;
    metric: string;
    predictions: ForecastPoint[];
    confidence: ConfidenceInterval[];
    accuracy: number;
    generatedAt: Date;
}
export interface ForecastPoint {
    timestamp: Date;
    value: number;
}
export interface ConfidenceInterval {
    timestamp: Date;
    lower: number;
    upper: number;
}
export interface Anomaly {
    id: string;
    metric: string;
    value: number;
    expected: number;
    deviation: number;
    severity: AnomalySeverity;
    timestamp: Date;
    resolved: boolean;
}
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export interface Report {
    id: string;
    name: string;
    type: ReportType;
    schedule?: ReportSchedule;
    query: AnalyticsQuery;
    format: ReportFormat;
    recipients: string[];
    createdAt: Date;
}
export type ReportType = 'summary' | 'detailed' | 'executive' | 'custom';
export type ReportFormat = 'pdf' | 'csv' | 'excel' | 'html';
export interface ReportSchedule {
    frequency: ScheduleFrequency;
    time: string;
    timezone: string;
}
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export declare class AdvancedAnalyticsManager extends EventEmitter {
    private config;
    private metrics;
    private events;
    private funnels;
    private cohorts;
    private dashboards;
    private models;
    private anomalies;
    private reports;
    constructor(config?: Partial<AnalyticsConfig>);
    trackMetric(name: string, value: number, type?: MetricType, tags?: Record<string, string>): Metric;
    trackEvent(name: string, type: EventType, properties?: Record<string, any>, userId?: string, sessionId?: string): Event;
    createFunnel(name: string, steps: string[]): Funnel;
    private calculateFunnelMetrics;
    createCohort(name: string, criteria: CohortCriteria): Cohort;
    private findUsersMatchingCriteria;
    private evaluateCondition;
    createDashboard(name: string, layout: DashboardLayout): Dashboard;
    addWidget(dashboardId: string, widget: Omit<Widget, 'id'>): Widget;
    query(query: AnalyticsQuery): Promise<QueryResult>;
    private groupData;
    trainModel(name: string, type: ModelType, algorithm: Algorithm, features: string[], target: string): PredictionModel;
    predict(modelId: string, input: Record<string, any>): Prediction;
    private calculatePrediction;
    forecast(metric: string, periods: number): Forecast;
    private checkForAnomalies;
    createReport(name: string, type: ReportType, query: AnalyticsQuery, format: ReportFormat): Report;
    generateReport(reportId: string): Promise<any>;
    private generateId;
    getMetricStats(metric: string): {
        count: number;
        sum: number;
        mean: number;
        min: number;
        max: number;
        latest: number;
    } | null;
    getStats(): {
        metrics: number;
        events: number;
        funnels: number;
        cohorts: number;
        dashboards: number;
        models: number;
        anomalies: number;
        reports: number;
    };
}
//# sourceMappingURL=AdvancedAnalytics.d.ts.map