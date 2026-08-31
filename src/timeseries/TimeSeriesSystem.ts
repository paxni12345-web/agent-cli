/**
 * Time Series Database System
 * Time-series data storage, aggregation, downsampling, and real-time analytics
 */

import { eventBus } from '../core/EventBus';

export interface TimeSeries {
  id: string;
  name: string;
  metric: string;
  tags: Record<string, string>;
  dataPoints: DataPoint[];
  retention: RetentionPolicy;
  aggregation?: AggregationConfig;
  createdAt: Date;
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
  quality?: DataQuality;
}

export enum DataQuality {
  Good = 'good',
  Uncertain = 'uncertain',
  Bad = 'bad',
}

export interface RetentionPolicy {
  duration: number; // milliseconds
  replication: number;
  shardDuration: number;
  default: boolean;
}

export interface AggregationConfig {
  function: AggregationFunction;
  interval: number; // milliseconds
  fillPolicy: FillPolicy;
}

export enum AggregationFunction {
  Mean = 'mean',
  Sum = 'sum',
  Min = 'min',
  Max = 'max',
  Count = 'count',
  First = 'first',
  Last = 'last',
  StdDev = 'stddev',
  Median = 'median',
  Percentile = 'percentile',
}

export enum FillPolicy {
  None = 'none',
  Null = 'null',
  Previous = 'previous',
  Linear = 'linear',
  Zero = 'zero',
}

export interface TimeSeriesQuery {
  metric: string;
  tags?: Record<string, string>;
  startTime: Date;
  endTime: Date;
  aggregation?: AggregationConfig;
  groupBy?: string[];
  limit?: number;
}

export interface QueryResult {
  series: TimeSeries[];
  executionTime: number;
  dataPointCount: number;
  executedAt: Date;
}

export interface Measurement {
  name: string;
  tags: Record<string, string>;
  fields: Record<string, number>;
  timestamp: Date;
}

export interface ContinuousQuery {
  id: string;
  name: string;
  query: string;
  interval: number;
  destination: string;
  enabled: boolean;
  lastRun?: Date;
  createdAt: Date;
}

export interface Downsample {
  id: string;
  sourceRetention: string;
  targetRetention: string;
  aggregation: AggregationFunction;
  interval: number;
  enabled: boolean;
}

export interface Anomaly {
  id: string;
  seriesId: string;
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: AnomalySeverity;
  detectedAt: Date;
}

export enum AnomalySeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export interface Forecast {
  id: string;
  seriesId: string;
  predictions: DataPoint[];
  confidence: number;
  model: ForecastModel;
  horizon: number; // milliseconds
  createdAt: Date;
}

export enum ForecastModel {
  Linear = 'linear',
  Exponential = 'exponential',
  ARIMA = 'arima',
  Prophet = 'prophet',
}

export interface Rollup {
  id: string;
  name: string;
  sourceMetric: string;
  targetMetric: string;
  aggregation: AggregationFunction;
  interval: number;
  retention: number;
  enabled: boolean;
}

export interface Alert {
  id: string;
  name: string;
  metric: string;
  condition: AlertCondition;
  threshold: number;
  duration: number;
  actions: AlertAction[];
  enabled: boolean;
  state: AlertState;
  lastTriggered?: Date;
}

export interface AlertCondition {
  operator: ComparisonOperator;
  aggregation: AggregationFunction;
  window: number;
}

export enum ComparisonOperator {
  GreaterThan = 'gt',
  GreaterThanOrEqual = 'gte',
  LessThan = 'lt',
  LessThanOrEqual = 'lte',
  Equal = 'eq',
  NotEqual = 'ne',
}

export enum AlertState {
  OK = 'ok',
  Pending = 'pending',
  Firing = 'firing',
  Resolved = 'resolved',
}

export interface AlertAction {
  type: ActionType;
  config: Record<string, any>;
}

export enum ActionType {
  Email = 'email',
  Webhook = 'webhook',
  SMS = 'sms',
  Slack = 'slack',
}

export interface Bucket {
  name: string;
  retentionPolicies: RetentionPolicy[];
  measurements: Map<string, Measurement[]>;
  createdAt: Date;
}

/**
 * Time Series Manager
 */
export class TimeSeriesManager {
  private series: Map<string, TimeSeries> = new Map();
  private buckets: Map<string, Bucket> = new Map();

  /**
   * Create series
   */
  createSeries(series: Omit<TimeSeries, 'id' | 'dataPoints' | 'createdAt'>): TimeSeries {
    const fullSeries: TimeSeries = {
      ...series,
      id: this.generateSeriesId(),
      dataPoints: [],
      createdAt: new Date(),
    };

    this.series.set(fullSeries.id, fullSeries);

    eventBus.emitSync('timeseries.series_created', fullSeries, 'TimeSeriesManager');

    return fullSeries;
  }

  /**
   * Write data point
   */
  writePoint(seriesId: string, point: Omit<DataPoint, 'quality'>): void {
    const series = this.series.get(seriesId);

    if (!series) {
      throw new Error(`Series not found: ${seriesId}`);
    }

    const fullPoint: DataPoint = {
      ...point,
      quality: DataQuality.Good,
    };

    series.dataPoints.push(fullPoint);

    // Apply retention policy
    this.applyRetention(series);

    eventBus.emitSync('timeseries.point_written', { seriesId, point: fullPoint }, 'TimeSeriesManager');
  }

  /**
   * Write batch
   */
  writeBatch(seriesId: string, points: Omit<DataPoint, 'quality'>[]): void {
    for (const point of points) {
      this.writePoint(seriesId, point);
    }
  }

  /**
   * Query series
   */
  query(query: TimeSeriesQuery): QueryResult {
    const startTime = Date.now();
    let matchingSeries = Array.from(this.series.values()).filter(
      s => s.metric === query.metric
    );

    // Filter by tags
    if (query.tags) {
      matchingSeries = matchingSeries.filter(s => {
        return Object.entries(query.tags!).every(([key, value]) => s.tags[key] === value);
      });
    }

    // Filter by time range and aggregate
    const results = matchingSeries.map(series => {
      const filteredPoints = series.dataPoints.filter(
        p => p.timestamp >= query.startTime && p.timestamp <= query.endTime
      );

      let processedPoints = filteredPoints;

      if (query.aggregation) {
        processedPoints = this.aggregatePoints(filteredPoints, query.aggregation);
      }

      if (query.limit) {
        processedPoints = processedPoints.slice(0, query.limit);
      }

      return {
        ...series,
        dataPoints: processedPoints,
      };
    });

    const totalPoints = results.reduce((sum, s) => sum + s.dataPoints.length, 0);

    return {
      series: results,
      executionTime: Date.now() - startTime,
      dataPointCount: totalPoints,
      executedAt: new Date(),
    };
  }

  /**
   * Get series
   */
  getSeries(seriesId: string): TimeSeries | undefined {
    return this.series.get(seriesId);
  }

  /**
   * List series
   */
  listSeries(filter?: { metric?: string; tags?: Record<string, string> }): TimeSeries[] {
    let series = Array.from(this.series.values());

    if (filter?.metric) {
      series = series.filter(s => s.metric === filter.metric);
    }

    if (filter?.tags) {
      series = series.filter(s => {
        return Object.entries(filter.tags!).every(([key, value]) => s.tags[key] === value);
      });
    }

    return series;
  }

  /**
   * Delete series
   */
  deleteSeries(seriesId: string): void {
    this.series.delete(seriesId);
    eventBus.emitSync('timeseries.series_deleted', { seriesId }, 'TimeSeriesManager');
  }

  /**
   * Create bucket
   */
  createBucket(name: string, retentionPolicies: RetentionPolicy[]): Bucket {
    const bucket: Bucket = {
      name,
      retentionPolicies,
      measurements: new Map(),
      createdAt: new Date(),
    };

    this.buckets.set(name, bucket);

    eventBus.emitSync('timeseries.bucket_created', bucket, 'TimeSeriesManager');

    return bucket;
  }

  /**
   * Get bucket
   */
  getBucket(name: string): Bucket | undefined {
    return this.buckets.get(name);
  }

  private aggregatePoints(points: DataPoint[], config: AggregationConfig): DataPoint[] {
    if (points.length === 0) return [];

    const groups = this.groupByInterval(points, config.interval);
    const aggregated: DataPoint[] = [];

    for (const [timestamp, groupPoints] of groups) {
      const value = this.calculateAggregation(
        groupPoints.map(p => p.value),
        config.function
      );

      aggregated.push({
        timestamp: new Date(timestamp),
        value,
        quality: DataQuality.Good,
      });
    }

    return aggregated;
  }

  private groupByInterval(points: DataPoint[], interval: number): Map<number, DataPoint[]> {
    const groups = new Map<number, DataPoint[]>();

    for (const point of points) {
      const bucket = Math.floor(point.timestamp.getTime() / interval) * interval;

      if (!groups.has(bucket)) {
        groups.set(bucket, []);
      }

      groups.get(bucket)!.push(point);
    }

    return groups;
  }

  private calculateAggregation(values: number[], func: AggregationFunction): number {
    if (values.length === 0) return 0;

    switch (func) {
      case AggregationFunction.Mean:
        return values.reduce((sum, v) => sum + v, 0) / values.length;

      case AggregationFunction.Sum:
        return values.reduce((sum, v) => sum + v, 0);

      case AggregationFunction.Min:
        return Math.min(...values);

      case AggregationFunction.Max:
        return Math.max(...values);

      case AggregationFunction.Count:
        return values.length;

      case AggregationFunction.First:
        return values[0];

      case AggregationFunction.Last:
        return values[values.length - 1];

      case AggregationFunction.StdDev:
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);

      case AggregationFunction.Median:
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

      default:
        return 0;
    }
  }

  private applyRetention(series: TimeSeries): void {
    const cutoff = new Date(Date.now() - series.retention.duration);
    series.dataPoints = series.dataPoints.filter(p => p.timestamp >= cutoff);
  }

  private generateSeriesId(): string {
    return `series_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Continuous Query Manager
 */
export class ContinuousQueryManager {
  private queries: Map<string, ContinuousQuery> = new Map();
  private timeSeriesManager: TimeSeriesManager;

  constructor(timeSeriesManager: TimeSeriesManager) {
    this.timeSeriesManager = timeSeriesManager;
  }

  /**
   * Create continuous query
   */
  createQuery(query: Omit<ContinuousQuery, 'id' | 'createdAt'>): ContinuousQuery {
    const fullQuery: ContinuousQuery = {
      ...query,
      id: this.generateQueryId(),
      createdAt: new Date(),
    };

    this.queries.set(fullQuery.id, fullQuery);

    eventBus.emitSync('timeseries.cq_created', fullQuery, 'ContinuousQueryManager');

    // Start execution if enabled
    if (fullQuery.enabled) {
      this.scheduleExecution(fullQuery);
    }

    return fullQuery;
  }

  /**
   * Execute query
   */
  async executeQuery(queryId: string): Promise<void> {
    const query = this.queries.get(queryId);

    if (!query || !query.enabled) {
      return;
    }

    // Mock query execution
    await new Promise(resolve => setTimeout(resolve, 50));

    query.lastRun = new Date();

    eventBus.emitSync('timeseries.cq_executed', query, 'ContinuousQueryManager');
  }

  /**
   * Get query
   */
  getQuery(queryId: string): ContinuousQuery | undefined {
    return this.queries.get(queryId);
  }

  /**
   * List queries
   */
  listQueries(filter?: { enabled?: boolean }): ContinuousQuery[] {
    let queries = Array.from(this.queries.values());

    if (filter?.enabled !== undefined) {
      queries = queries.filter(q => q.enabled === filter.enabled);
    }

    return queries;
  }

  /**
   * Delete query
   */
  deleteQuery(queryId: string): void {
    this.queries.delete(queryId);
    eventBus.emitSync('timeseries.cq_deleted', { queryId }, 'ContinuousQueryManager');
  }

  private scheduleExecution(query: ContinuousQuery): void {
    // Mock scheduling
    setInterval(() => this.executeQuery(query.id), query.interval);
  }

  private generateQueryId(): string {
    return `cq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Anomaly Detector
 */
export class AnomalyDetector {
  private anomalies: Map<string, Anomaly> = new Map();
  private timeSeriesManager: TimeSeriesManager;

  constructor(timeSeriesManager: TimeSeriesManager) {
    this.timeSeriesManager = timeSeriesManager;
  }

  /**
   * Detect anomalies
   */
  async detect(seriesId: string, threshold: number = 3): Promise<Anomaly[]> {
    const series = this.timeSeriesManager.getSeries(seriesId);

    if (!series) {
      throw new Error(`Series not found: ${seriesId}`);
    }

    const anomalies: Anomaly[] = [];
    const values = series.dataPoints.map(p => p.value);

    if (values.length < 2) {
      return anomalies;
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    for (const point of series.dataPoints) {
      const deviation = Math.abs(point.value - mean) / stdDev;

      if (deviation > threshold) {
        const anomaly: Anomaly = {
          id: this.generateAnomalyId(),
          seriesId,
          timestamp: point.timestamp,
          value: point.value,
          expectedValue: mean,
          deviation,
          severity: this.determineSeverity(deviation, threshold),
          detectedAt: new Date(),
        };

        anomalies.push(anomaly);
        this.anomalies.set(anomaly.id, anomaly);
      }
    }

    if (anomalies.length > 0) {
      eventBus.emitSync('timeseries.anomalies_detected', { seriesId, count: anomalies.length }, 'AnomalyDetector');
    }

    return anomalies;
  }

  /**
   * Get anomaly
   */
  getAnomaly(anomalyId: string): Anomaly | undefined {
    return this.anomalies.get(anomalyId);
  }

  /**
   * List anomalies
   */
  listAnomalies(filter?: { seriesId?: string; severity?: AnomalySeverity }): Anomaly[] {
    let anomalies = Array.from(this.anomalies.values());

    if (filter?.seriesId) {
      anomalies = anomalies.filter(a => a.seriesId === filter.seriesId);
    }

    if (filter?.severity) {
      anomalies = anomalies.filter(a => a.severity === filter.severity);
    }

    return anomalies.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  private determineSeverity(deviation: number, threshold: number): AnomalySeverity {
    if (deviation > threshold * 2) return AnomalySeverity.Critical;
    if (deviation > threshold * 1.5) return AnomalySeverity.High;
    if (deviation > threshold * 1.2) return AnomalySeverity.Medium;
    return AnomalySeverity.Low;
  }

  private generateAnomalyId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Forecasting Engine
 */
export class ForecastingEngine {
  private forecasts: Map<string, Forecast> = new Map();
  private timeSeriesManager: TimeSeriesManager;

  constructor(timeSeriesManager: TimeSeriesManager) {
    this.timeSeriesManager = timeSeriesManager;
  }

  /**
   * Generate forecast
   */
  async forecast(
    seriesId: string,
    horizon: number,
    model: ForecastModel = ForecastModel.Linear
  ): Promise<Forecast> {
    const series = this.timeSeriesManager.getSeries(seriesId);

    if (!series) {
      throw new Error(`Series not found: ${seriesId}`);
    }

    // Mock forecasting
    await new Promise(resolve => setTimeout(resolve, 100));

    const predictions = this.generatePredictions(series, horizon, model);

    const forecast: Forecast = {
      id: this.generateForecastId(),
      seriesId,
      predictions,
      confidence: 0.75 + Math.random() * 0.2,
      model,
      horizon,
      createdAt: new Date(),
    };

    this.forecasts.set(forecast.id, forecast);

    eventBus.emitSync('timeseries.forecast_generated', forecast, 'ForecastingEngine');

    return forecast;
  }

  /**
   * Get forecast
   */
  getForecast(forecastId: string): Forecast | undefined {
    return this.forecasts.get(forecastId);
  }

  /**
   * List forecasts
   */
  listForecasts(seriesId?: string): Forecast[] {
    let forecasts = Array.from(this.forecasts.values());

    if (seriesId) {
      forecasts = forecasts.filter(f => f.seriesId === seriesId);
    }

    return forecasts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private generatePredictions(series: TimeSeries, horizon: number, model: ForecastModel): DataPoint[] {
    const points = series.dataPoints;
    if (points.length === 0) return [];

    const lastPoint = points[points.length - 1];
    const predictions: DataPoint[] = [];

    // Simple linear trend
    const trend = this.calculateTrend(points);

    for (let i = 1; i <= 10; i++) {
      const timestamp = new Date(lastPoint.timestamp.getTime() + (horizon / 10) * i);
      const value = lastPoint.value + trend * i + (Math.random() - 0.5) * 2;

      predictions.push({
        timestamp,
        value,
        quality: DataQuality.Good,
      });
    }

    return predictions;
  }

  private calculateTrend(points: DataPoint[]): number {
    if (points.length < 2) return 0;

    const n = Math.min(points.length, 10);
    const recent = points.slice(-n);

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < recent.length; i++) {
      sumX += i;
      sumY += recent[i].value;
      sumXY += i * recent[i].value;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return slope;
  }

  private generateForecastId(): string {
    return `forecast_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Alert Manager
 */
export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private timeSeriesManager: TimeSeriesManager;

  constructor(timeSeriesManager: TimeSeriesManager) {
    this.timeSeriesManager = timeSeriesManager;
  }

  /**
   * Create alert
   */
  createAlert(alert: Omit<Alert, 'id' | 'state'>): Alert {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      state: AlertState.OK,
    };

    this.alerts.set(fullAlert.id, fullAlert);

    eventBus.emitSync('timeseries.alert_created', fullAlert, 'AlertManager');

    return fullAlert;
  }

  /**
   * Evaluate alerts
   */
  async evaluateAlerts(): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      await this.evaluateAlert(alert);
    }
  }

  /**
   * Evaluate single alert
   */
  private async evaluateAlert(alert: Alert): Promise<void> {
    const series = this.timeSeriesManager.listSeries({ metric: alert.metric });

    for (const s of series) {
      const recentPoints = s.dataPoints.slice(-10);
      const values = recentPoints.map(p => p.value);

      if (values.length === 0) continue;

      const aggregatedValue = this.calculateAggregation(values, alert.condition.aggregation);
      const triggered = this.checkCondition(aggregatedValue, alert.condition.operator, alert.threshold);

      if (triggered && alert.state !== AlertState.Firing) {
        alert.state = AlertState.Firing;
        alert.lastTriggered = new Date();

        // Execute actions
        for (const action of alert.actions) {
          await this.executeAction(action, alert);
        }

        eventBus.emitSync('timeseries.alert_triggered', alert, 'AlertManager');
      } else if (!triggered && alert.state === AlertState.Firing) {
        alert.state = AlertState.Resolved;
        eventBus.emitSync('timeseries.alert_resolved', alert, 'AlertManager');
      }
    }
  }

  /**
   * Get alert
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * List alerts
   */
  listAlerts(filter?: { state?: AlertState; enabled?: boolean }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filter?.state) {
      alerts = alerts.filter(a => a.state === filter.state);
    }

    if (filter?.enabled !== undefined) {
      alerts = alerts.filter(a => a.enabled === filter.enabled);
    }

    return alerts;
  }

  /**
   * Delete alert
   */
  deleteAlert(alertId: string): void {
    this.alerts.delete(alertId);
    eventBus.emitSync('timeseries.alert_deleted', { alertId }, 'AlertManager');
  }

  private checkCondition(value: number, operator: ComparisonOperator, threshold: number): boolean {
    switch (operator) {
      case ComparisonOperator.GreaterThan:
        return value > threshold;
      case ComparisonOperator.GreaterThanOrEqual:
        return value >= threshold;
      case ComparisonOperator.LessThan:
        return value < threshold;
      case ComparisonOperator.LessThanOrEqual:
        return value <= threshold;
      case ComparisonOperator.Equal:
        return value === threshold;
      case ComparisonOperator.NotEqual:
        return value !== threshold;
      default:
        return false;
    }
  }

  private calculateAggregation(values: number[], func: AggregationFunction): number {
    if (values.length === 0) return 0;

    switch (func) {
      case AggregationFunction.Mean:
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      case AggregationFunction.Max:
        return Math.max(...values);
      case AggregationFunction.Min:
        return Math.min(...values);
      case AggregationFunction.Sum:
        return values.reduce((sum, v) => sum + v, 0);
      default:
        return 0;
    }
  }

  private async executeAction(action: AlertAction, alert: Alert): Promise<void> {
    // Mock action execution
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const timeSeriesManager = new TimeSeriesManager();
export const continuousQueryManager = new ContinuousQueryManager(timeSeriesManager);
export const anomalyDetector = new AnomalyDetector(timeSeriesManager);
export const forecastingEngine = new ForecastingEngine(timeSeriesManager);
export const alertManager = new AlertManager(timeSeriesManager);
