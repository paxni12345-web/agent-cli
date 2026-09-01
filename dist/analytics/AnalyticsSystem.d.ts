/**
 * Analytics and Business Intelligence System
 * Data analytics, reporting, dashboards, and business metrics
 */
export interface AnalyticsEvent {
    id: string;
    name: string;
    category: string;
    properties: Record<string, any>;
    userId?: string;
    sessionId?: string;
    timestamp: Date;
    context: EventContext;
}
export interface EventContext {
    ip?: string;
    userAgent?: string;
    referrer?: string;
    url?: string;
    screen?: ScreenInfo;
    location?: GeoLocation;
}
export interface ScreenInfo {
    width: number;
    height: number;
    density: number;
}
export interface GeoLocation {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
}
export interface Metric {
    name: string;
    value: number;
    dimensions: Record<string, string>;
    timestamp: Date;
}
export interface Report {
    id: string;
    name: string;
    description?: string;
    type: ReportType;
    query: ReportQuery;
    schedule?: ReportSchedule;
    recipients: string[];
    format: ReportFormat;
    createdAt: Date;
    lastRun?: Date;
}
export declare enum ReportType {
    Standard = "standard",
    Custom = "custom",
    Realtime = "realtime"
}
export interface ReportQuery {
    metrics: string[];
    dimensions: string[];
    filters: ReportFilter[];
    dateRange: DateRange;
    limit?: number;
    orderBy?: OrderBy[];
}
export interface ReportFilter {
    field: string;
    operator: FilterOperator;
    value: any;
}
export declare enum FilterOperator {
    Equals = "eq",
    NotEquals = "ne",
    GreaterThan = "gt",
    LessThan = "lt",
    Contains = "contains",
    In = "in"
}
export interface DateRange {
    start: Date;
    end: Date;
    type?: 'relative' | 'absolute';
    relativePeriod?: RelativePeriod;
}
export declare enum RelativePeriod {
    Today = "today",
    Yesterday = "yesterday",
    Last7Days = "last_7_days",
    Last30Days = "last_30_days",
    ThisMonth = "this_month",
    LastMonth = "last_month",
    ThisYear = "this_year"
}
export interface OrderBy {
    field: string;
    direction: 'asc' | 'desc';
}
export declare enum ReportFormat {
    PDF = "pdf",
    CSV = "csv",
    Excel = "excel",
    JSON = "json"
}
export interface ReportSchedule {
    frequency: ScheduleFrequency;
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timezone: string;
}
export declare enum ScheduleFrequency {
    Hourly = "hourly",
    Daily = "daily",
    Weekly = "weekly",
    Monthly = "monthly"
}
export interface Dashboard {
    id: string;
    name: string;
    description?: string;
    widgets: Widget[];
    layout: DashboardLayout;
    filters: DashboardFilter[];
    shared: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Widget {
    id: string;
    type: WidgetType;
    title: string;
    query: ReportQuery;
    visualization: VisualizationConfig;
    position: WidgetPosition;
    refreshInterval?: number;
}
export declare enum WidgetType {
    LineChart = "line_chart",
    BarChart = "bar_chart",
    PieChart = "pie_chart",
    Table = "table",
    ScoreCard = "score_card",
    Funnel = "funnel",
    Heatmap = "heatmap",
    Map = "map"
}
export interface VisualizationConfig {
    colors?: string[];
    legend?: boolean;
    xAxis?: AxisConfig;
    yAxis?: AxisConfig;
    series?: SeriesConfig[];
}
export interface AxisConfig {
    label?: string;
    format?: string;
    min?: number;
    max?: number;
}
export interface SeriesConfig {
    name: string;
    color?: string;
    type?: 'line' | 'bar' | 'area';
}
export interface WidgetPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface DashboardLayout {
    columns: number;
    rows: number;
}
export interface DashboardFilter {
    field: string;
    type: 'select' | 'multiselect' | 'daterange' | 'text';
    options?: string[];
    defaultValue?: any;
}
export interface Segment {
    id: string;
    name: string;
    description?: string;
    conditions: SegmentCondition[];
    size?: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface SegmentCondition {
    field: string;
    operator: FilterOperator;
    value: any;
    logic?: 'and' | 'or';
}
export interface Funnel {
    id: string;
    name: string;
    steps: FunnelStep[];
    dateRange: DateRange;
    segments?: string[];
}
export interface FunnelStep {
    name: string;
    event: string;
    filters?: ReportFilter[];
    count?: number;
    conversionRate?: number;
}
export interface Cohort {
    id: string;
    name: string;
    definition: CohortDefinition;
    metrics: CohortMetrics;
    createdAt: Date;
}
export interface CohortDefinition {
    event: string;
    dateRange: DateRange;
    filters?: ReportFilter[];
}
export interface CohortMetrics {
    size: number;
    retention: RetentionData[];
    ltv?: number;
}
export interface RetentionData {
    period: number;
    users: number;
    percentage: number;
}
/**
 * Analytics Engine
 */
export declare class AnalyticsEngine {
    private events;
    private metrics;
    private maxEvents;
    /**
     * Track event
     */
    trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): void;
    /**
     * Track metric
     */
    trackMetric(metric: Metric): void;
    /**
     * Query events
     */
    queryEvents(query: EventQuery): AnalyticsEvent[];
    /**
     * Aggregate events
     */
    aggregateEvents(query: EventQuery, groupBy: string[], aggregation: AggregationType): AggregationResult[];
    /**
     * Get unique users
     */
    getUniqueUsers(dateRange: DateRange): number;
    /**
     * Calculate conversion rate
     */
    calculateConversionRate(startEvent: string, endEvent: string, dateRange: DateRange): number;
    /**
     * Get event timeline
     */
    getEventTimeline(eventName: string, dateRange: DateRange, interval: TimeInterval): TimelineData[];
    private getMetricKey;
    private getTimeKey;
    private getWeekKey;
    private generateEventId;
}
export interface EventQuery {
    name?: string;
    category?: string;
    userId?: string;
    dateRange?: DateRange;
    properties?: Record<string, any>;
    limit?: number;
}
export declare enum AggregationType {
    Count = "count",
    Sum = "sum",
    Average = "average",
    Min = "min",
    Max = "max"
}
export interface AggregationResult {
    dimensions: Record<string, string>;
    value: number;
}
export declare enum TimeInterval {
    Hour = "hour",
    Day = "day",
    Week = "week",
    Month = "month"
}
export interface TimelineData {
    timestamp: string;
    count: number;
}
/**
 * Report Generator
 */
export declare class ReportGenerator {
    private reports;
    private analyticsEngine;
    constructor(analyticsEngine: AnalyticsEngine);
    /**
     * Create report
     */
    createReport(report: Omit<Report, 'id' | 'createdAt'>): Report;
    /**
     * Generate report
     */
    generateReport(reportId: string): Promise<ReportData>;
    /**
     * Get report
     */
    getReport(reportId: string): Report | undefined;
    /**
     * List reports
     */
    listReports(): Report[];
    private applyFilter;
    private generateReportId;
}
export interface ReportData {
    reportId: string;
    name: string;
    generatedAt: Date;
    data: AggregationResult[];
    summary: Record<string, any>;
}
/**
 * Dashboard Manager
 */
export declare class DashboardManager {
    private dashboards;
    /**
     * Create dashboard
     */
    createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Dashboard;
    /**
     * Update dashboard
     */
    updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Dashboard;
    /**
     * Get dashboard
     */
    getDashboard(dashboardId: string): Dashboard | undefined;
    /**
     * List dashboards
     */
    listDashboards(filter?: {
        createdBy?: string;
        shared?: boolean;
    }): Dashboard[];
    /**
     * Delete dashboard
     */
    deleteDashboard(dashboardId: string): void;
    private generateDashboardId;
}
/**
 * Segment Manager
 */
export declare class SegmentManager {
    private segments;
    private analyticsEngine;
    constructor(analyticsEngine: AnalyticsEngine);
    /**
     * Create segment
     */
    createSegment(segment: Omit<Segment, 'id' | 'size' | 'createdAt' | 'updatedAt'>): Segment;
    /**
     * Get segment
     */
    getSegment(segmentId: string): Segment | undefined;
    /**
     * List segments
     */
    listSegments(): Segment[];
    /**
     * Check if user in segment
     */
    isUserInSegment(userId: string, segmentId: string): boolean;
    private calculateSegmentSize;
    private generateSegmentId;
}
/**
 * Singleton instances
 */
export declare const analyticsEngine: AnalyticsEngine;
export declare const reportGenerator: ReportGenerator;
export declare const dashboardManager: DashboardManager;
export declare const segmentManager: SegmentManager;
//# sourceMappingURL=AnalyticsSystem.d.ts.map