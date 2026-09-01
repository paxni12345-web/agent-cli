/**
 * Time Series Database System
 * Time-series data storage, aggregation, downsampling, and real-time analytics
 */
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
export declare enum DataQuality {
    Good = "good",
    Uncertain = "uncertain",
    Bad = "bad"
}
export interface RetentionPolicy {
    duration: number;
    replication: number;
    shardDuration: number;
    default: boolean;
}
export interface AggregationConfig {
    function: AggregationFunction;
    interval: number;
    fillPolicy: FillPolicy;
}
export declare enum AggregationFunction {
    Mean = "mean",
    Sum = "sum",
    Min = "min",
    Max = "max",
    Count = "count",
    First = "first",
    Last = "last",
    StdDev = "stddev",
    Median = "median",
    Percentile = "percentile"
}
export declare enum FillPolicy {
    None = "none",
    Null = "null",
    Previous = "previous",
    Linear = "linear",
    Zero = "zero"
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
export declare enum AnomalySeverity {
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export interface Forecast {
    id: string;
    seriesId: string;
    predictions: DataPoint[];
    confidence: number;
    model: ForecastModel;
    horizon: number;
    createdAt: Date;
}
export declare enum ForecastModel {
    Linear = "linear",
    Exponential = "exponential",
    ARIMA = "arima",
    Prophet = "prophet"
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
export declare enum ComparisonOperator {
    GreaterThan = "gt",
    GreaterThanOrEqual = "gte",
    LessThan = "lt",
    LessThanOrEqual = "lte",
    Equal = "eq",
    NotEqual = "ne"
}
export declare enum AlertState {
    OK = "ok",
    Pending = "pending",
    Firing = "firing",
    Resolved = "resolved"
}
export interface AlertAction {
    type: ActionType;
    config: Record<string, any>;
}
export declare enum ActionType {
    Email = "email",
    Webhook = "webhook",
    SMS = "sms",
    Slack = "slack"
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
export declare class TimeSeriesManager {
    private series;
    private buckets;
    /**
     * Create series
     */
    createSeries(series: Omit<TimeSeries, 'id' | 'dataPoints' | 'createdAt'>): TimeSeries;
    /**
     * Write data point
     */
    writePoint(seriesId: string, point: Omit<DataPoint, 'quality'>): void;
    /**
     * Write batch
     */
    writeBatch(seriesId: string, points: Omit<DataPoint, 'quality'>[]): void;
    /**
     * Query series
     */
    query(query: TimeSeriesQuery): QueryResult;
    /**
     * Get series
     */
    getSeries(seriesId: string): TimeSeries | undefined;
    /**
     * List series
     */
    listSeries(filter?: {
        metric?: string;
        tags?: Record<string, string>;
    }): TimeSeries[];
    /**
     * Delete series
     */
    deleteSeries(seriesId: string): void;
    /**
     * Create bucket
     */
    createBucket(name: string, retentionPolicies: RetentionPolicy[]): Bucket;
    /**
     * Get bucket
     */
    getBucket(name: string): Bucket | undefined;
    private aggregatePoints;
    private groupByInterval;
    private calculateAggregation;
    private applyRetention;
    private generateSeriesId;
}
/**
 * Continuous Query Manager
 */
export declare class ContinuousQueryManager {
    private queries;
    private timeSeriesManager;
    constructor(timeSeriesManager: TimeSeriesManager);
    /**
     * Create continuous query
     */
    createQuery(query: Omit<ContinuousQuery, 'id' | 'createdAt'>): ContinuousQuery;
    /**
     * Execute query
     */
    executeQuery(queryId: string): Promise<void>;
    /**
     * Get query
     */
    getQuery(queryId: string): ContinuousQuery | undefined;
    /**
     * List queries
     */
    listQueries(filter?: {
        enabled?: boolean;
    }): ContinuousQuery[];
    /**
     * Delete query
     */
    deleteQuery(queryId: string): void;
    private scheduleExecution;
    private generateQueryId;
}
/**
 * Anomaly Detector
 */
export declare class AnomalyDetector {
    private anomalies;
    private timeSeriesManager;
    constructor(timeSeriesManager: TimeSeriesManager);
    /**
     * Detect anomalies
     */
    detect(seriesId: string, threshold?: number): Promise<Anomaly[]>;
    /**
     * Get anomaly
     */
    getAnomaly(anomalyId: string): Anomaly | undefined;
    /**
     * List anomalies
     */
    listAnomalies(filter?: {
        seriesId?: string;
        severity?: AnomalySeverity;
    }): Anomaly[];
    private determineSeverity;
    private generateAnomalyId;
}
/**
 * Forecasting Engine
 */
export declare class ForecastingEngine {
    private forecasts;
    private timeSeriesManager;
    constructor(timeSeriesManager: TimeSeriesManager);
    /**
     * Generate forecast
     */
    forecast(seriesId: string, horizon: number, model?: ForecastModel): Promise<Forecast>;
    /**
     * Get forecast
     */
    getForecast(forecastId: string): Forecast | undefined;
    /**
     * List forecasts
     */
    listForecasts(seriesId?: string): Forecast[];
    private generatePredictions;
    private calculateTrend;
    private generateForecastId;
}
/**
 * Alert Manager
 */
export declare class AlertManager {
    private alerts;
    private timeSeriesManager;
    constructor(timeSeriesManager: TimeSeriesManager);
    /**
     * Create alert
     */
    createAlert(alert: Omit<Alert, 'id' | 'state'>): Alert;
    /**
     * Evaluate alerts
     */
    evaluateAlerts(): Promise<void>;
    /**
     * Evaluate single alert
     */
    private evaluateAlert;
    /**
     * Get alert
     */
    getAlert(alertId: string): Alert | undefined;
    /**
     * List alerts
     */
    listAlerts(filter?: {
        state?: AlertState;
        enabled?: boolean;
    }): Alert[];
    /**
     * Delete alert
     */
    deleteAlert(alertId: string): void;
    private checkCondition;
    private calculateAggregation;
    private executeAction;
    private generateAlertId;
}
/**
 * Singleton instances
 */
export declare const timeSeriesManager: TimeSeriesManager;
export declare const continuousQueryManager: ContinuousQueryManager;
export declare const anomalyDetector: AnomalyDetector;
export declare const forecastingEngine: ForecastingEngine;
export declare const alertManager: AlertManager;
//# sourceMappingURL=TimeSeriesSystem.d.ts.map