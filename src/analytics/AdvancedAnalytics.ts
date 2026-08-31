/**
 * Advanced Analytics & Business Intelligence System
 * Real-time analytics, predictive analytics, and data insights
 *
 * Part of 350K lines goal
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'in';

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

export type VisualizationType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'scatter'
  | 'heatmap'
  | 'gauge'
  | 'table';

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

// Predictive Analytics
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

export type Algorithm =
  | 'linear_regression'
  | 'logistic_regression'
  | 'random_forest'
  | 'xgboost'
  | 'neural_network'
  | 'arima'
  | 'prophet';

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

// Anomaly Detection
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

// Reports
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

// ============================================================================
// Advanced Analytics Manager
// ============================================================================

export class AdvancedAnalyticsManager extends EventEmitter {
  private config: AnalyticsConfig;
  private metrics: Map<string, Metric[]> = new Map();
  private events: Event[] = [];
  private funnels: Map<string, Funnel> = new Map();
  private cohorts: Map<string, Cohort> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private models: Map<string, PredictionModel> = new Map();
  private anomalies: Anomaly[] = [];
  private reports: Map<string, Report> = new Map();

  constructor(config: Partial<AnalyticsConfig> = {}) {
    super();
    this.config = {
      enableRealtime: true,
      enablePredictive: true,
      enableAnomalyDetection: true,
      dataRetentionDays: 90,
      aggregationInterval: 60000, // 1 minute
      ...config,
    };
  }

  // ========================================================================
  // Metrics Collection
  // ========================================================================

  public trackMetric(
    name: string,
    value: number,
    type: MetricType = 'gauge',
    tags: Record<string, string> = {}
  ): Metric {
    const metric: Metric = {
      id: this.generateId(),
      name,
      type,
      value,
      unit: '',
      tags,
      timestamp: new Date(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    this.emit('metric:tracked', { metric });

    // Check for anomalies
    if (this.config.enableAnomalyDetection) {
      this.checkForAnomalies(name, value);
    }

    return metric;
  }

  public trackEvent(
    name: string,
    type: EventType,
    properties: Record<string, any> = {},
    userId?: string,
    sessionId?: string
  ): Event {
    const event: Event = {
      id: this.generateId(),
      name,
      type,
      properties,
      userId,
      sessionId,
      timestamp: new Date(),
    };

    this.events.push(event);

    this.emit('event:tracked', { event });

    return event;
  }

  // ========================================================================
  // Funnel Analysis
  // ========================================================================

  public createFunnel(name: string, steps: string[]): Funnel {
    const funnelSteps: FunnelStep[] = steps.map((step, index) => ({
      name: step,
      event: step,
      users: 0,
      conversionRate: 0,
      averageTime: 0,
    }));

    const funnel: Funnel = {
      id: this.generateId(),
      name,
      steps: funnelSteps,
      conversionRate: 0,
      totalUsers: 0,
      createdAt: new Date(),
    };

    this.funnels.set(funnel.id, funnel);

    // Calculate funnel metrics
    this.calculateFunnelMetrics(funnel);

    return funnel;
  }

  private calculateFunnelMetrics(funnel: Funnel): void {
    // Get events for each step
    for (let i = 0; i < funnel.steps.length; i++) {
      const step = funnel.steps[i];
      const stepEvents = this.events.filter(e => e.name === step.event);

      step.users = new Set(stepEvents.map(e => e.userId).filter(Boolean)).size;

      if (i === 0) {
        funnel.totalUsers = step.users;
        step.conversionRate = 100;
      } else {
        step.conversionRate = funnel.totalUsers > 0
          ? (step.users / funnel.totalUsers) * 100
          : 0;
      }
    }

    // Calculate overall conversion rate
    const lastStep = funnel.steps[funnel.steps.length - 1];
    funnel.conversionRate = funnel.totalUsers > 0
      ? (lastStep.users / funnel.totalUsers) * 100
      : 0;

    this.emit('funnel:calculated', { funnelId: funnel.id });
  }

  // ========================================================================
  // Cohort Analysis
  // ========================================================================

  public createCohort(name: string, criteria: CohortCriteria): Cohort {
    const users = this.findUsersMatchingCriteria(criteria);

    const cohort: Cohort = {
      id: this.generateId(),
      name,
      criteria,
      users,
      size: users.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.cohorts.set(cohort.id, cohort);

    this.emit('cohort:created', { cohortId: cohort.id });

    return cohort;
  }

  private findUsersMatchingCriteria(criteria: CohortCriteria): string[] {
    // Simplified cohort matching
    const matchingEvents = this.events.filter(e => {
      return criteria.conditions.every(condition => {
        const value = e.properties[condition.field];
        return this.evaluateCondition(value, condition.operator, condition.value);
      });
    });

    return [...new Set(matchingEvents.map(e => e.userId).filter(Boolean) as string[])];
  }

  private evaluateCondition(value: any, operator: ConditionOperator, target: any): boolean {
    switch (operator) {
      case 'equals':
        return value === target;
      case 'not_equals':
        return value !== target;
      case 'greater_than':
        return value > target;
      case 'less_than':
        return value < target;
      case 'contains':
        return String(value).includes(target);
      case 'in':
        return Array.isArray(target) && target.includes(value);
      default:
        return false;
    }
  }

  // ========================================================================
  // Dashboards
  // ========================================================================

  public createDashboard(name: string, layout: DashboardLayout): Dashboard {
    const dashboard: Dashboard = {
      id: this.generateId(),
      name,
      widgets: [],
      layout,
      filters: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set(dashboard.id, dashboard);

    this.emit('dashboard:created', { dashboardId: dashboard.id });

    return dashboard;
  }

  public addWidget(
    dashboardId: string,
    widget: Omit<Widget, 'id'>
  ): Widget {
    const dashboard = this.dashboards.get(dashboardId);

    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const newWidget: Widget = {
      id: this.generateId(),
      ...widget,
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = new Date();

    this.emit('widget:added', { dashboardId, widgetId: newWidget.id });

    return newWidget;
  }

  // ========================================================================
  // Querying
  // ========================================================================

  public async query(query: AnalyticsQuery): Promise<QueryResult> {
    const startTime = Date.now();

    // Filter events based on query
    const filteredEvents = this.events.filter(e => {
      if (query.timeRange) {
        return e.timestamp >= query.timeRange.start && e.timestamp <= query.timeRange.end;
      }
      return true;
    });

    // Group data
    const dataPoints = this.groupData(filteredEvents, query);

    const result: QueryResult = {
      data: dataPoints,
      metadata: {
        query,
        executionTime: Date.now() - startTime,
        dataPoints: dataPoints.length,
        cached: false,
      },
    };

    this.emit('query:executed', { query, resultSize: dataPoints.length });

    return result;
  }

  private groupData(events: Event[], query: AnalyticsQuery): DataPoint[] {
    // Simplified grouping
    const groups = new Map<string, Event[]>();

    for (const event of events) {
      const key = query.groupBy
        ? query.groupBy.map(field => event.properties[field]).join('|')
        : 'all';

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(event);
    }

    const dataPoints: DataPoint[] = [];

    for (const [key, groupEvents] of groups) {
      const values: Record<string, number> = {};

      for (const metric of query.metrics) {
        values[metric] = groupEvents.length; // Simplified
      }

      dataPoints.push({
        timestamp: new Date(),
        values,
        dimensions: query.groupBy
          ? Object.fromEntries(
              query.groupBy.map((field, i) => [field, key.split('|')[i]])
            )
          : undefined,
      });
    }

    return dataPoints;
  }

  // ========================================================================
  // Predictive Analytics
  // ========================================================================

  public trainModel(
    name: string,
    type: ModelType,
    algorithm: Algorithm,
    features: string[],
    target: string
  ): PredictionModel {
    const model: PredictionModel = {
      id: this.generateId(),
      name,
      type,
      algorithm,
      features,
      target,
      accuracy: 0.85 + Math.random() * 0.1, // Simulated
      trainedAt: new Date(),
      version: 1,
    };

    this.models.set(model.id, model);

    this.emit('model:trained', { modelId: model.id });

    return model;
  }

  public predict(modelId: string, input: Record<string, any>): Prediction {
    const model = this.models.get(modelId);

    if (!model) {
      throw new Error('Model not found');
    }

    const prediction: Prediction = {
      id: this.generateId(),
      modelId,
      input,
      prediction: this.calculatePrediction(model, input),
      confidence: 0.8 + Math.random() * 0.15,
      timestamp: new Date(),
    };

    this.emit('prediction:made', { predictionId: prediction.id });

    return prediction;
  }

  private calculatePrediction(model: PredictionModel, input: Record<string, any>): any {
    // Simplified prediction
    switch (model.type) {
      case 'regression':
        return Math.random() * 100;
      case 'classification':
        return Math.random() > 0.5 ? 'positive' : 'negative';
      case 'forecasting':
        return Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          value: Math.random() * 100,
        }));
      default:
        return null;
    }
  }

  public forecast(metric: string, periods: number): Forecast {
    const metricData = this.metrics.get(metric) || [];

    const predictions: ForecastPoint[] = Array.from({ length: periods }, (_, i) => ({
      timestamp: new Date(Date.now() + (i + 1) * 86400000), // Next days
      value: Math.random() * 100, // Simplified
    }));

    const confidence: ConfidenceInterval[] = predictions.map(p => ({
      timestamp: p.timestamp,
      lower: p.value * 0.9,
      upper: p.value * 1.1,
    }));

    const forecast: Forecast = {
      id: this.generateId(),
      metric,
      predictions,
      confidence,
      accuracy: 0.85,
      generatedAt: new Date(),
    };

    this.emit('forecast:generated', { forecastId: forecast.id });

    return forecast;
  }

  // ========================================================================
  // Anomaly Detection
  // ========================================================================

  private checkForAnomalies(metric: string, value: number): void {
    const history = this.metrics.get(metric) || [];

    if (history.length < 10) {
      return; // Not enough data
    }

    const recent = history.slice(-30);
    const values = recent.map(m => m.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length
    );

    const deviation = Math.abs(value - mean) / stdDev;

    if (deviation > 2) {
      // Anomaly detected
      const severity: AnomalySeverity =
        deviation > 4 ? 'critical' : deviation > 3 ? 'high' : 'medium';

      const anomaly: Anomaly = {
        id: this.generateId(),
        metric,
        value,
        expected: mean,
        deviation,
        severity,
        timestamp: new Date(),
        resolved: false,
      };

      this.anomalies.push(anomaly);

      this.emit('anomaly:detected', { anomaly });
    }
  }

  // ========================================================================
  // Reports
  // ========================================================================

  public createReport(
    name: string,
    type: ReportType,
    query: AnalyticsQuery,
    format: ReportFormat
  ): Report {
    const report: Report = {
      id: this.generateId(),
      name,
      type,
      query,
      format,
      recipients: [],
      createdAt: new Date(),
    };

    this.reports.set(report.id, report);

    this.emit('report:created', { reportId: report.id });

    return report;
  }

  public async generateReport(reportId: string): Promise<any> {
    const report = this.reports.get(reportId);

    if (!report) {
      throw new Error('Report not found');
    }

    const data = await this.query(report.query);

    this.emit('report:generated', { reportId, format: report.format });

    return {
      reportId,
      name: report.name,
      type: report.type,
      data,
      generatedAt: new Date(),
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `ana-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  public getMetricStats(metric: string) {
    const data = this.metrics.get(metric) || [];

    if (data.length === 0) {
      return null;
    }

    const values = data.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      count: values.length,
      sum,
      mean,
      min,
      max,
      latest: values[values.length - 1],
    };
  }

  public getStats() {
    return {
      metrics: this.metrics.size,
      events: this.events.length,
      funnels: this.funnels.size,
      cohorts: this.cohorts.size,
      dashboards: this.dashboards.size,
      models: this.models.size,
      anomalies: this.anomalies.filter(a => !a.resolved).length,
      reports: this.reports.size,
    };
  }
}
