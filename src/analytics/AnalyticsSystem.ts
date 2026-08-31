/**
 * Analytics and Business Intelligence System
 * Data analytics, reporting, dashboards, and business metrics
 */

import { eventBus } from '../core/EventBus';

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

export enum ReportType {
  Standard = 'standard',
  Custom = 'custom',
  Realtime = 'realtime',
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

export enum FilterOperator {
  Equals = 'eq',
  NotEquals = 'ne',
  GreaterThan = 'gt',
  LessThan = 'lt',
  Contains = 'contains',
  In = 'in',
}

export interface DateRange {
  start: Date;
  end: Date;
  type?: 'relative' | 'absolute';
  relativePeriod?: RelativePeriod;
}

export enum RelativePeriod {
  Today = 'today',
  Yesterday = 'yesterday',
  Last7Days = 'last_7_days',
  Last30Days = 'last_30_days',
  ThisMonth = 'this_month',
  LastMonth = 'last_month',
  ThisYear = 'this_year',
}

export interface OrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  Excel = 'excel',
  JSON = 'json',
}

export interface ReportSchedule {
  frequency: ScheduleFrequency;
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone: string;
}

export enum ScheduleFrequency {
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
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

export enum WidgetType {
  LineChart = 'line_chart',
  BarChart = 'bar_chart',
  PieChart = 'pie_chart',
  Table = 'table',
  ScoreCard = 'score_card',
  Funnel = 'funnel',
  Heatmap = 'heatmap',
  Map = 'map',
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
export class AnalyticsEngine {
  private events: AnalyticsEvent[] = [];
  private metrics: Map<string, Metric[]> = new Map();
  private maxEvents: number = 100000;

  /**
   * Track event
   */
  trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): void {
    const fullEvent: AnalyticsEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Maintain max size
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    eventBus.emitSync('analytics.event_tracked', fullEvent, 'AnalyticsEngine');
  }

  /**
   * Track metric
   */
  trackMetric(metric: Metric): void {
    const key = this.getMetricKey(metric.name, metric.dimensions);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);

    // Keep only last 10000 points per metric
    const metricData = this.metrics.get(key)!;
    if (metricData.length > 10000) {
      metricData.shift();
    }

    eventBus.emitSync('analytics.metric_tracked', metric, 'AnalyticsEngine');
  }

  /**
   * Query events
   */
  queryEvents(query: EventQuery): AnalyticsEvent[] {
    let events = [...this.events];

    // Filter by name
    if (query.name) {
      events = events.filter(e => e.name === query.name);
    }

    // Filter by category
    if (query.category) {
      events = events.filter(e => e.category === query.category);
    }

    // Filter by user
    if (query.userId) {
      events = events.filter(e => e.userId === query.userId);
    }

    // Filter by date range
    if (query.dateRange) {
      events = events.filter(
        e =>
          e.timestamp >= query.dateRange!.start &&
          e.timestamp <= query.dateRange!.end
      );
    }

    // Filter by properties
    if (query.properties) {
      events = events.filter(e =>
        Object.entries(query.properties!).every(
          ([key, value]) => e.properties[key] === value
        )
      );
    }

    return events.slice(0, query.limit || 1000);
  }

  /**
   * Aggregate events
   */
  aggregateEvents(
    query: EventQuery,
    groupBy: string[],
    aggregation: AggregationType
  ): AggregationResult[] {
    const events = this.queryEvents(query);
    const groups = new Map<string, AnalyticsEvent[]>();

    // Group events
    for (const event of events) {
      const key = groupBy.map(field => event.properties[field] || 'unknown').join('|');

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(event);
    }

    // Aggregate
    const results: AggregationResult[] = [];

    for (const [key, groupEvents] of groups) {
      const dimensions = key.split('|');
      const dimensionValues: Record<string, string> = {};

      groupBy.forEach((field, i) => {
        dimensionValues[field] = dimensions[i];
      });

      let value: number;

      switch (aggregation) {
        case AggregationType.Count:
          value = groupEvents.length;
          break;

        case AggregationType.Sum:
          value = groupEvents.reduce((sum, e) => sum + (e.properties.value || 0), 0);
          break;

        case AggregationType.Average:
          value =
            groupEvents.reduce((sum, e) => sum + (e.properties.value || 0), 0) /
            groupEvents.length;
          break;

        case AggregationType.Min:
          value = Math.min(...groupEvents.map(e => e.properties.value || 0));
          break;

        case AggregationType.Max:
          value = Math.max(...groupEvents.map(e => e.properties.value || 0));
          break;

        default:
          value = groupEvents.length;
      }

      results.push({
        dimensions: dimensionValues,
        value,
      });
    }

    return results;
  }

  /**
   * Get unique users
   */
  getUniqueUsers(dateRange: DateRange): number {
    const events = this.queryEvents({ dateRange });
    const userIds = new Set(events.map(e => e.userId).filter(id => id !== undefined));
    return userIds.size;
  }

  /**
   * Calculate conversion rate
   */
  calculateConversionRate(
    startEvent: string,
    endEvent: string,
    dateRange: DateRange
  ): number {
    const startEvents = this.queryEvents({
      name: startEvent,
      dateRange,
    });

    const endEvents = this.queryEvents({
      name: endEvent,
      dateRange,
    });

    const startUsers = new Set(startEvents.map(e => e.userId).filter(id => id));
    const endUsers = new Set(endEvents.map(e => e.userId).filter(id => id));

    const converted = Array.from(startUsers).filter(userId => endUsers.has(userId));

    return startUsers.size > 0 ? (converted.length / startUsers.size) * 100 : 0;
  }

  /**
   * Get event timeline
   */
  getEventTimeline(
    eventName: string,
    dateRange: DateRange,
    interval: TimeInterval
  ): TimelineData[] {
    const events = this.queryEvents({ name: eventName, dateRange });
    const timeline = new Map<string, number>();

    for (const event of events) {
      const key = this.getTimeKey(event.timestamp, interval);
      timeline.set(key, (timeline.get(key) || 0) + 1);
    }

    return Array.from(timeline.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private getMetricKey(name: string, dimensions: Record<string, string>): string {
    const dimStr = Object.entries(dimensions)
      .sort(([k1], [k2]) => k1.localeCompare(k2))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `${name}{${dimStr}}`;
  }

  private getTimeKey(date: Date, interval: TimeInterval): string {
    switch (interval) {
      case TimeInterval.Hour:
        return date.toISOString().slice(0, 13);
      case TimeInterval.Day:
        return date.toISOString().slice(0, 10);
      case TimeInterval.Week:
        return this.getWeekKey(date);
      case TimeInterval.Month:
        return date.toISOString().slice(0, 7);
      default:
        return date.toISOString().slice(0, 10);
    }
  }

  private getWeekKey(date: Date): string {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil(days / 7);
    return `${date.getFullYear()}-W${week}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

export interface EventQuery {
  name?: string;
  category?: string;
  userId?: string;
  dateRange?: DateRange;
  properties?: Record<string, any>;
  limit?: number;
}

export enum AggregationType {
  Count = 'count',
  Sum = 'sum',
  Average = 'average',
  Min = 'min',
  Max = 'max',
}

export interface AggregationResult {
  dimensions: Record<string, string>;
  value: number;
}

export enum TimeInterval {
  Hour = 'hour',
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

export interface TimelineData {
  timestamp: string;
  count: number;
}

/**
 * Report Generator
 */
export class ReportGenerator {
  private reports: Map<string, Report> = new Map();
  private analyticsEngine: AnalyticsEngine;

  constructor(analyticsEngine: AnalyticsEngine) {
    this.analyticsEngine = analyticsEngine;
  }

  /**
   * Create report
   */
  createReport(report: Omit<Report, 'id' | 'createdAt'>): Report {
    const fullReport: Report = {
      ...report,
      id: this.generateReportId(),
      createdAt: new Date(),
    };

    this.reports.set(fullReport.id, fullReport);

    eventBus.emitSync('analytics.report_created', fullReport, 'ReportGenerator');

    return fullReport;
  }

  /**
   * Generate report
   */
  async generateReport(reportId: string): Promise<ReportData> {
    const report = this.reports.get(reportId);

    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    const data: ReportData = {
      reportId,
      name: report.name,
      generatedAt: new Date(),
      data: [],
      summary: {},
    };

    // Execute query
    const events = this.analyticsEngine.queryEvents({
      dateRange: report.query.dateRange,
    });

    // Apply filters
    let filteredEvents = events;

    for (const filter of report.query.filters) {
      filteredEvents = this.applyFilter(filteredEvents, filter);
    }

    // Group by dimensions and calculate metrics
    if (report.query.dimensions.length > 0) {
      data.data = this.analyticsEngine.aggregateEvents(
        { dateRange: report.query.dateRange },
        report.query.dimensions,
        AggregationType.Count
      );
    }

    // Calculate summary
    data.summary.totalEvents = filteredEvents.length;
    data.summary.uniqueUsers = this.analyticsEngine.getUniqueUsers(report.query.dateRange);

    return data;
  }

  /**
   * Get report
   */
  getReport(reportId: string): Report | undefined {
    return this.reports.get(reportId);
  }

  /**
   * List reports
   */
  listReports(): Report[] {
    return Array.from(this.reports.values());
  }

  private applyFilter(events: AnalyticsEvent[], filter: ReportFilter): AnalyticsEvent[] {
    switch (filter.operator) {
      case FilterOperator.Equals:
        return events.filter(e => e.properties[filter.field] === filter.value);

      case FilterOperator.NotEquals:
        return events.filter(e => e.properties[filter.field] !== filter.value);

      case FilterOperator.GreaterThan:
        return events.filter(e => e.properties[filter.field] > filter.value);

      case FilterOperator.LessThan:
        return events.filter(e => e.properties[filter.field] < filter.value);

      case FilterOperator.Contains:
        return events.filter(e =>
          String(e.properties[filter.field])
            .toLowerCase()
            .includes(String(filter.value).toLowerCase())
        );

      case FilterOperator.In:
        return events.filter(e => filter.value.includes(e.properties[filter.field]));

      default:
        return events;
    }
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
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
export class DashboardManager {
  private dashboards: Map<string, Dashboard> = new Map();

  /**
   * Create dashboard
   */
  createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Dashboard {
    const fullDashboard: Dashboard = {
      ...dashboard,
      id: this.generateDashboardId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set(fullDashboard.id, fullDashboard);

    eventBus.emitSync('analytics.dashboard_created', fullDashboard, 'DashboardManager');

    return fullDashboard;
  }

  /**
   * Update dashboard
   */
  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Dashboard {
    const dashboard = this.dashboards.get(dashboardId);

    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    Object.assign(dashboard, updates, { updatedAt: new Date() });

    eventBus.emitSync('analytics.dashboard_updated', dashboard, 'DashboardManager');

    return dashboard;
  }

  /**
   * Get dashboard
   */
  getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  /**
   * List dashboards
   */
  listDashboards(filter?: { createdBy?: string; shared?: boolean }): Dashboard[] {
    let dashboards = Array.from(this.dashboards.values());

    if (filter?.createdBy) {
      dashboards = dashboards.filter(d => d.createdBy === filter.createdBy);
    }

    if (filter?.shared !== undefined) {
      dashboards = dashboards.filter(d => d.shared === filter.shared);
    }

    return dashboards;
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(dashboardId: string): void {
    this.dashboards.delete(dashboardId);
    eventBus.emitSync('analytics.dashboard_deleted', { dashboardId }, 'DashboardManager');
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Segment Manager
 */
export class SegmentManager {
  private segments: Map<string, Segment> = new Map();
  private analyticsEngine: AnalyticsEngine;

  constructor(analyticsEngine: AnalyticsEngine) {
    this.analyticsEngine = analyticsEngine;
  }

  /**
   * Create segment
   */
  createSegment(segment: Omit<Segment, 'id' | 'size' | 'createdAt' | 'updatedAt'>): Segment {
    const fullSegment: Segment = {
      ...segment,
      id: this.generateSegmentId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Calculate segment size
    fullSegment.size = this.calculateSegmentSize(fullSegment);

    this.segments.set(fullSegment.id, fullSegment);

    eventBus.emitSync('analytics.segment_created', fullSegment, 'SegmentManager');

    return fullSegment;
  }

  /**
   * Get segment
   */
  getSegment(segmentId: string): Segment | undefined {
    return this.segments.get(segmentId);
  }

  /**
   * List segments
   */
  listSegments(): Segment[] {
    return Array.from(this.segments.values());
  }

  /**
   * Check if user in segment
   */
  isUserInSegment(userId: string, segmentId: string): boolean {
    const segment = this.segments.get(segmentId);

    if (!segment) {
      return false;
    }

    // Check all conditions
    return segment.conditions.every(condition => {
      const events = this.analyticsEngine.queryEvents({ userId });
      // Simplified check
      return events.length > 0;
    });
  }

  private calculateSegmentSize(segment: Segment): number {
    // Mock calculation
    return Math.floor(Math.random() * 10000);
  }

  private generateSegmentId(): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const analyticsEngine = new AnalyticsEngine();
export const reportGenerator = new ReportGenerator(analyticsEngine);
export const dashboardManager = new DashboardManager();
export const segmentManager = new SegmentManager(analyticsEngine);
