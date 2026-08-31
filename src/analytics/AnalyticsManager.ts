/**
 * Advanced Analytics & Reporting System
 * Real-time analytics, custom dashboards, data visualization
 * Report generation, data aggregation, predictive analytics
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type MetricType =
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'summary'
  | 'rate'
  | 'percentage';

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

export type WidgetType =
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'area_chart'
  | 'scatter_plot'
  | 'heatmap'
  | 'table'
  | 'metric'
  | 'gauge'
  | 'progress';

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
  relative?: string; // e.g., "last_1h", "last_24h", "last_7d"
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

// ============================================================================
// Analytics Manager
// ============================================================================

export class AnalyticsManager extends EventEmitter {
  private config: AnalyticsConfig;
  private metrics: Map<string, Metric[]> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private reports: Map<string, Report> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private anomalies: Anomaly[] = [];
  private predictions: Map<string, Prediction[]> = new Map();
  private insights: Insight[] = [];

  constructor(config: Partial<AnalyticsConfig> = {}) {
    super();
    this.config = {
      enableRealTime: true,
      enablePredictive: true,
      retentionDays: 90,
      aggregationInterval: 60000, // 1 minute
      samplingRate: 1.0,
      ...config,
    };

    this.startAggregationLoop();
  }

  // ========================================================================
  // Metrics Collection
  // ========================================================================

  public recordMetric(metric: Omit<Metric, 'id' | 'timestamp'>): void {
    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    const full: Metric = {
      ...metric,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    this.metrics.get(metric.name)!.push(full);
    this.emit('metric:recorded', { metric: full });

    // Check for alerts
    this.checkAlerts(full);

    // Detect anomalies if enabled
    if (this.config.enablePredictive) {
      this.detectAnomalies(metric.name);
    }
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

  public getMetrics(name: string, timeRange?: TimeRange): Metric[] {
    const metrics = this.metrics.get(name) || [];

    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(
      m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  // ========================================================================
  // Time Series Analysis
  // ========================================================================

  public getTimeSeries(
    metric: string,
    timeRange: TimeRange,
    aggregation: AggregationType,
    interval: number
  ): TimeSeries {
    const metrics = this.getMetrics(metric, timeRange);

    // Group by interval
    const buckets = new Map<number, Metric[]>();
    for (const m of metrics) {
      const bucket = Math.floor(m.timestamp / interval) * interval;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(m);
    }

    // Aggregate each bucket
    const dataPoints: DataPoint[] = [];
    for (const [timestamp, bucketMetrics] of buckets.entries()) {
      const value = this.aggregate(bucketMetrics.map(m => m.value), aggregation);
      dataPoints.push({ timestamp, value });
    }

    return {
      id: this.generateId(),
      metric,
      dataPoints: dataPoints.sort((a, b) => a.timestamp - b.timestamp),
      aggregation,
      interval,
      startTime: timeRange.start,
      endTime: timeRange.end,
    };
  }

  private aggregate(values: number[], type: AggregationType): number {
    if (values.length === 0) return 0;

    switch (type) {
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);
      case 'avg':
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'p50':
        return this.percentile(values, 0.5);
      case 'p95':
        return this.percentile(values, 0.95);
      case 'p99':
        return this.percentile(values, 0.99);
      default:
        return 0;
    }
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }

  // ========================================================================
  // Dashboard Management
  // ========================================================================

  public async createDashboard(
    dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> {
    const full: Dashboard = {
      ...dashboard,
      id: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.dashboards.set(full.id, full);
    this.emit('dashboard:created', { dashboard: full });

    return full;
  }

  public async updateDashboard(
    dashboardId: string,
    updates: Partial<Dashboard>
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    Object.assign(dashboard, updates);
    dashboard.updatedAt = Date.now();

    this.emit('dashboard:updated', { dashboard });

    return dashboard;
  }

  public async deleteDashboard(dashboardId: string): Promise<void> {
    this.dashboards.delete(dashboardId);
    this.emit('dashboard:deleted', { dashboardId });
  }

  public getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  public listDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  public async renderDashboard(dashboardId: string): Promise<DashboardData> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const widgetData: Record<string, any> = {};

    for (const widget of dashboard.widgets) {
      widgetData[widget.id] = await this.renderWidget(widget);
    }

    return {
      dashboard,
      widgetData,
      lastUpdated: Date.now(),
    };
  }

  private async renderWidget(widget: Widget): Promise<any> {
    const data: any[] = [];

    for (const metricName of widget.config.metrics) {
      const timeSeries = this.getTimeSeries(
        metricName,
        widget.config.timeRange,
        widget.config.aggregation,
        this.config.aggregationInterval
      );

      data.push({
        metric: metricName,
        data: timeSeries.dataPoints,
      });
    }

    return {
      type: widget.type,
      title: widget.title,
      data,
    };
  }

  // ========================================================================
  // Report Generation
  // ========================================================================

  public async createReport(report: Omit<Report, 'id'>): Promise<Report> {
    const full: Report = {
      ...report,
      id: this.generateId(),
    };

    this.reports.set(full.id, full);

    if (full.schedule) {
      this.scheduleReport(full);
    }

    this.emit('report:created', { report: full });

    return full;
  }

  public async generateReport(reportId: string): Promise<GeneratedReport> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    this.emit('report:generate:start', { report });

    const sections: GeneratedSection[] = [];

    for (const section of report.sections) {
      const content = await this.generateReportSection(section, report);
      sections.push({
        ...section,
        generatedContent: content,
      });
    }

    const generated: GeneratedReport = {
      id: this.generateId(),
      reportId: report.id,
      name: report.name,
      format: report.format,
      sections,
      generatedAt: Date.now(),
      parameters: report.parameters,
    };

    report.lastGenerated = generated.generatedAt;

    this.emit('report:generated', { report: generated });

    return generated;
  }

  private async generateReportSection(
    section: ReportSection,
    report: Report
  ): Promise<any> {
    switch (section.type) {
      case 'chart':
        return this.generateChartSection(section);
      case 'table':
        return this.generateTableSection(section);
      case 'metrics':
        return this.generateMetricsSection(section);
      case 'insights':
        return this.generateInsightsSection();
      case 'text':
        return section.content;
      default:
        return null;
    }
  }

  private async generateChartSection(section: ReportSection): Promise<any> {
    // Generate chart data
    return {
      type: 'chart',
      data: [],
    };
  }

  private async generateTableSection(section: ReportSection): Promise<any> {
    // Generate table data
    return {
      type: 'table',
      rows: [],
    };
  }

  private async generateMetricsSection(section: ReportSection): Promise<any> {
    // Generate metrics summary
    const summaries: any[] = [];

    for (const [name, metrics] of this.metrics.entries()) {
      const values = metrics.map(m => m.value);
      summaries.push({
        metric: name,
        count: values.length,
        sum: this.aggregate(values, 'sum'),
        avg: this.aggregate(values, 'avg'),
        min: this.aggregate(values, 'min'),
        max: this.aggregate(values, 'max'),
      });
    }

    return {
      type: 'metrics',
      summaries,
    };
  }

  private async generateInsightsSection(): Promise<any> {
    return {
      type: 'insights',
      insights: this.insights.slice(0, 10),
    };
  }

  private scheduleReport(report: Report): void {
    // Schedule report generation
    // In production: use node-cron or similar
  }

  // ========================================================================
  // Alerts
  // ========================================================================

  public async createAlert(alert: Omit<Alert, 'id' | 'triggerCount'>): Promise<Alert> {
    const full: Alert = {
      ...alert,
      id: this.generateId(),
      triggerCount: 0,
    };

    this.alerts.set(full.id, full);
    this.emit('alert:created', { alert: full });

    return full;
  }

  private checkAlerts(metric: Metric): void {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled || alert.condition.metric !== metric.name) {
        continue;
      }

      const shouldTrigger = this.evaluateAlertCondition(alert.condition, metric);

      if (shouldTrigger) {
        this.triggerAlert(alert, metric);
      }
    }
  }

  private evaluateAlertCondition(condition: AlertCondition, metric: Metric): boolean {
    const { operator, threshold } = condition;

    switch (operator) {
      case 'gt':
        return metric.value > threshold;
      case 'gte':
        return metric.value >= threshold;
      case 'lt':
        return metric.value < threshold;
      case 'lte':
        return metric.value <= threshold;
      case 'eq':
        return metric.value === threshold;
      case 'neq':
        return metric.value !== threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(alert: Alert, metric: Metric): Promise<void> {
    alert.lastTriggered = Date.now();
    alert.triggerCount++;

    this.emit('alert:triggered', { alert, metric });

    // Send notifications through channels
    for (const channel of alert.channels) {
      await this.sendAlertNotification(alert, metric, channel);
    }
  }

  private async sendAlertNotification(
    alert: Alert,
    metric: Metric,
    channel: AlertChannel
  ): Promise<void> {
    this.emit('alert:notification:sent', { alert, channel });
  }

  // ========================================================================
  // Anomaly Detection
  // ========================================================================

  private detectAnomalies(metricName: string): void {
    const metrics = this.metrics.get(metricName) || [];
    if (metrics.length < 30) return; // Need enough data

    const recent = metrics.slice(-30);
    const values = recent.map(m => m.value);

    const mean = this.aggregate(values, 'avg');
    const stdDev = this.standardDeviation(values);

    const latest = metrics[metrics.length - 1];
    const deviation = Math.abs(latest.value - mean) / stdDev;

    if (deviation > 3) {
      // 3-sigma rule
      const anomaly: Anomaly = {
        id: this.generateId(),
        metric: metricName,
        timestamp: latest.timestamp,
        expectedValue: mean,
        actualValue: latest.value,
        deviation,
        confidence: Math.min(deviation / 5, 1),
        severity: deviation > 5 ? 'high' : deviation > 4 ? 'medium' : 'low',
      };

      this.anomalies.push(anomaly);
      this.emit('anomaly:detected', { anomaly });

      // Generate insight
      this.generateInsight({
        type: 'anomaly',
        title: `Anomaly detected in ${metricName}`,
        description: `Value ${latest.value} deviates significantly from expected ${mean.toFixed(2)}`,
        confidence: anomaly.confidence,
        impact: anomaly.severity as 'low' | 'medium' | 'high',
        actionable: true,
        actions: ['Investigate cause', 'Review recent changes'],
      });
    }
  }

  private standardDeviation(values: number[]): number {
    const mean = this.aggregate(values, 'avg');
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = this.aggregate(squareDiffs, 'avg');
    return Math.sqrt(avgSquareDiff);
  }

  public getAnomalies(metricName?: string): Anomaly[] {
    if (metricName) {
      return this.anomalies.filter(a => a.metric === metricName);
    }
    return this.anomalies;
  }

  // ========================================================================
  // Predictive Analytics
  // ========================================================================

  public async predict(metricName: string, horizon: number): Promise<Prediction[]> {
    const metrics = this.metrics.get(metricName) || [];
    if (metrics.length < 10) {
      throw new Error('Not enough data for prediction');
    }

    const predictions: Prediction[] = [];
    const values = metrics.map(m => m.value);

    // Simple linear regression for prediction
    const { slope, intercept } = this.linearRegression(values);

    for (let i = 1; i <= horizon; i++) {
      const timestamp = Date.now() + i * this.config.aggregationInterval;
      const x = values.length + i;
      const predictedValue = slope * x + intercept;

      // Calculate confidence interval (simplified)
      const stdDev = this.standardDeviation(values);
      const confidence = Math.max(0, 1 - (stdDev / Math.abs(predictedValue)));

      predictions.push({
        id: this.generateId(),
        metric: metricName,
        timestamp,
        predictedValue,
        confidence,
        upperBound: predictedValue + 2 * stdDev,
        lowerBound: predictedValue - 2 * stdDev,
        algorithm: 'linear_regression',
      });
    }

    this.predictions.set(metricName, predictions);
    this.emit('predictions:generated', { metric: metricName, predictions });

    return predictions;
  }

  private linearRegression(values: number[]): { slope: number; intercept: number } {
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  public getPredictions(metricName: string): Prediction[] {
    return this.predictions.get(metricName) || [];
  }

  // ========================================================================
  // Insights Generation
  // ========================================================================

  public generateInsight(insight: Omit<Insight, 'id' | 'timestamp'>): void {
    const full: Insight = {
      ...insight,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.insights.push(full);
    this.emit('insight:generated', { insight: full });

    // Keep only last 100 insights
    if (this.insights.length > 100) {
      this.insights = this.insights.slice(-100);
    }
  }

  public getInsights(type?: Insight['type']): Insight[] {
    if (type) {
      return this.insights.filter(i => i.type === type);
    }
    return this.insights;
  }

  // ========================================================================
  // Data Aggregation
  // ========================================================================

  private startAggregationLoop(): void {
    setInterval(() => {
      this.performAggregation();
    }, this.config.aggregationInterval);
  }

  private performAggregation(): void {
    for (const [metricName, metrics] of this.metrics.entries()) {
      const timeRange: TimeRange = {
        start: Date.now() - this.config.aggregationInterval,
        end: Date.now(),
      };

      const recentMetrics = this.getMetrics(metricName, timeRange);
      if (recentMetrics.length === 0) continue;

      const values = recentMetrics.map(m => m.value);

      const aggregation: DataAggregation = {
        id: this.generateId(),
        metric: metricName,
        aggregations: {
          sum: this.aggregate(values, 'sum'),
          avg: this.aggregate(values, 'avg'),
          min: this.aggregate(values, 'min'),
          max: this.aggregate(values, 'max'),
          count: this.aggregate(values, 'count'),
          p50: this.aggregate(values, 'p50'),
          p95: this.aggregate(values, 'p95'),
          p99: this.aggregate(values, 'p99'),
        },
        timeRange,
        sampleSize: values.length,
      };

      this.emit('aggregation:completed', { aggregation });
    }

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }

  // ========================================================================
  // Correlation Analysis
  // ========================================================================

  public calculateCorrelation(metric1: string, metric2: string): number {
    const m1 = this.metrics.get(metric1) || [];
    const m2 = this.metrics.get(metric2) || [];

    if (m1.length === 0 || m2.length === 0) return 0;

    const minLength = Math.min(m1.length, m2.length);
    const values1 = m1.slice(-minLength).map(m => m.value);
    const values2 = m2.slice(-minLength).map(m => m.value);

    return this.pearsonCorrelation(values1, values2);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = this.aggregate(x, 'avg');
    const meanY = this.aggregate(y, 'avg');

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    return numerator / Math.sqrt(denomX * denomY);
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  public getStats(): AnalyticsStats {
    const totalMetrics = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.length,
      0
    );

    return {
      totalMetrics,
      uniqueMetricNames: this.metrics.size,
      dashboards: this.dashboards.size,
      reports: this.reports.size,
      alerts: this.alerts.size,
      activeAlerts: Array.from(this.alerts.values()).filter(a => a.enabled).length,
      anomalies: this.anomalies.length,
      insights: this.insights.length,
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export default AnalyticsManager;
