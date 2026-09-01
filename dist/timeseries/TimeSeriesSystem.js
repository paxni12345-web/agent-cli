"use strict";
/**
 * Time Series Database System
 * Time-series data storage, aggregation, downsampling, and real-time analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertManager = exports.forecastingEngine = exports.anomalyDetector = exports.continuousQueryManager = exports.timeSeriesManager = exports.AlertManager = exports.ForecastingEngine = exports.AnomalyDetector = exports.ContinuousQueryManager = exports.TimeSeriesManager = exports.ActionType = exports.AlertState = exports.ComparisonOperator = exports.ForecastModel = exports.AnomalySeverity = exports.FillPolicy = exports.AggregationFunction = exports.DataQuality = void 0;
const EventBus_1 = require("../core/EventBus");
var DataQuality;
(function (DataQuality) {
    DataQuality["Good"] = "good";
    DataQuality["Uncertain"] = "uncertain";
    DataQuality["Bad"] = "bad";
})(DataQuality || (exports.DataQuality = DataQuality = {}));
var AggregationFunction;
(function (AggregationFunction) {
    AggregationFunction["Mean"] = "mean";
    AggregationFunction["Sum"] = "sum";
    AggregationFunction["Min"] = "min";
    AggregationFunction["Max"] = "max";
    AggregationFunction["Count"] = "count";
    AggregationFunction["First"] = "first";
    AggregationFunction["Last"] = "last";
    AggregationFunction["StdDev"] = "stddev";
    AggregationFunction["Median"] = "median";
    AggregationFunction["Percentile"] = "percentile";
})(AggregationFunction || (exports.AggregationFunction = AggregationFunction = {}));
var FillPolicy;
(function (FillPolicy) {
    FillPolicy["None"] = "none";
    FillPolicy["Null"] = "null";
    FillPolicy["Previous"] = "previous";
    FillPolicy["Linear"] = "linear";
    FillPolicy["Zero"] = "zero";
})(FillPolicy || (exports.FillPolicy = FillPolicy = {}));
var AnomalySeverity;
(function (AnomalySeverity) {
    AnomalySeverity["Low"] = "low";
    AnomalySeverity["Medium"] = "medium";
    AnomalySeverity["High"] = "high";
    AnomalySeverity["Critical"] = "critical";
})(AnomalySeverity || (exports.AnomalySeverity = AnomalySeverity = {}));
var ForecastModel;
(function (ForecastModel) {
    ForecastModel["Linear"] = "linear";
    ForecastModel["Exponential"] = "exponential";
    ForecastModel["ARIMA"] = "arima";
    ForecastModel["Prophet"] = "prophet";
})(ForecastModel || (exports.ForecastModel = ForecastModel = {}));
var ComparisonOperator;
(function (ComparisonOperator) {
    ComparisonOperator["GreaterThan"] = "gt";
    ComparisonOperator["GreaterThanOrEqual"] = "gte";
    ComparisonOperator["LessThan"] = "lt";
    ComparisonOperator["LessThanOrEqual"] = "lte";
    ComparisonOperator["Equal"] = "eq";
    ComparisonOperator["NotEqual"] = "ne";
})(ComparisonOperator || (exports.ComparisonOperator = ComparisonOperator = {}));
var AlertState;
(function (AlertState) {
    AlertState["OK"] = "ok";
    AlertState["Pending"] = "pending";
    AlertState["Firing"] = "firing";
    AlertState["Resolved"] = "resolved";
})(AlertState || (exports.AlertState = AlertState = {}));
var ActionType;
(function (ActionType) {
    ActionType["Email"] = "email";
    ActionType["Webhook"] = "webhook";
    ActionType["SMS"] = "sms";
    ActionType["Slack"] = "slack";
})(ActionType || (exports.ActionType = ActionType = {}));
/**
 * Time Series Manager
 */
class TimeSeriesManager {
    series = new Map();
    buckets = new Map();
    /**
     * Create series
     */
    createSeries(series) {
        const fullSeries = {
            ...series,
            id: this.generateSeriesId(),
            dataPoints: [],
            createdAt: new Date(),
        };
        this.series.set(fullSeries.id, fullSeries);
        EventBus_1.eventBus.emitSync('timeseries.series_created', fullSeries, 'TimeSeriesManager');
        return fullSeries;
    }
    /**
     * Write data point
     */
    writePoint(seriesId, point) {
        const series = this.series.get(seriesId);
        if (!series) {
            throw new Error(`Series not found: ${seriesId}`);
        }
        const fullPoint = {
            ...point,
            quality: DataQuality.Good,
        };
        series.dataPoints.push(fullPoint);
        // Apply retention policy
        this.applyRetention(series);
        EventBus_1.eventBus.emitSync('timeseries.point_written', { seriesId, point: fullPoint }, 'TimeSeriesManager');
    }
    /**
     * Write batch
     */
    writeBatch(seriesId, points) {
        for (const point of points) {
            this.writePoint(seriesId, point);
        }
    }
    /**
     * Query series
     */
    query(query) {
        const startTime = Date.now();
        let matchingSeries = Array.from(this.series.values()).filter(s => s.metric === query.metric);
        // Filter by tags
        if (query.tags) {
            matchingSeries = matchingSeries.filter(s => {
                return Object.entries(query.tags).every(([key, value]) => s.tags[key] === value);
            });
        }
        // Filter by time range and aggregate
        const results = matchingSeries.map(series => {
            const filteredPoints = series.dataPoints.filter(p => p.timestamp >= query.startTime && p.timestamp <= query.endTime);
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
    getSeries(seriesId) {
        return this.series.get(seriesId);
    }
    /**
     * List series
     */
    listSeries(filter) {
        let series = Array.from(this.series.values());
        if (filter?.metric) {
            series = series.filter(s => s.metric === filter.metric);
        }
        if (filter?.tags) {
            series = series.filter(s => {
                return Object.entries(filter.tags).every(([key, value]) => s.tags[key] === value);
            });
        }
        return series;
    }
    /**
     * Delete series
     */
    deleteSeries(seriesId) {
        this.series.delete(seriesId);
        EventBus_1.eventBus.emitSync('timeseries.series_deleted', { seriesId }, 'TimeSeriesManager');
    }
    /**
     * Create bucket
     */
    createBucket(name, retentionPolicies) {
        const bucket = {
            name,
            retentionPolicies,
            measurements: new Map(),
            createdAt: new Date(),
        };
        this.buckets.set(name, bucket);
        EventBus_1.eventBus.emitSync('timeseries.bucket_created', bucket, 'TimeSeriesManager');
        return bucket;
    }
    /**
     * Get bucket
     */
    getBucket(name) {
        return this.buckets.get(name);
    }
    aggregatePoints(points, config) {
        if (points.length === 0)
            return [];
        const groups = this.groupByInterval(points, config.interval);
        const aggregated = [];
        for (const [timestamp, groupPoints] of groups) {
            const value = this.calculateAggregation(groupPoints.map(p => p.value), config.function);
            aggregated.push({
                timestamp: new Date(timestamp),
                value,
                quality: DataQuality.Good,
            });
        }
        return aggregated;
    }
    groupByInterval(points, interval) {
        const groups = new Map();
        for (const point of points) {
            const bucket = Math.floor(point.timestamp.getTime() / interval) * interval;
            if (!groups.has(bucket)) {
                groups.set(bucket, []);
            }
            groups.get(bucket).push(point);
        }
        return groups;
    }
    calculateAggregation(values, func) {
        if (values.length === 0)
            return 0;
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
    applyRetention(series) {
        const cutoff = new Date(Date.now() - series.retention.duration);
        series.dataPoints = series.dataPoints.filter(p => p.timestamp >= cutoff);
    }
    generateSeriesId() {
        return `series_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TimeSeriesManager = TimeSeriesManager;
/**
 * Continuous Query Manager
 */
class ContinuousQueryManager {
    queries = new Map();
    timeSeriesManager;
    constructor(timeSeriesManager) {
        this.timeSeriesManager = timeSeriesManager;
    }
    /**
     * Create continuous query
     */
    createQuery(query) {
        const fullQuery = {
            ...query,
            id: this.generateQueryId(),
            createdAt: new Date(),
        };
        this.queries.set(fullQuery.id, fullQuery);
        EventBus_1.eventBus.emitSync('timeseries.cq_created', fullQuery, 'ContinuousQueryManager');
        // Start execution if enabled
        if (fullQuery.enabled) {
            this.scheduleExecution(fullQuery);
        }
        return fullQuery;
    }
    /**
     * Execute query
     */
    async executeQuery(queryId) {
        const query = this.queries.get(queryId);
        if (!query || !query.enabled) {
            return;
        }
        // Mock query execution
        await new Promise(resolve => setTimeout(resolve, 50));
        query.lastRun = new Date();
        EventBus_1.eventBus.emitSync('timeseries.cq_executed', query, 'ContinuousQueryManager');
    }
    /**
     * Get query
     */
    getQuery(queryId) {
        return this.queries.get(queryId);
    }
    /**
     * List queries
     */
    listQueries(filter) {
        let queries = Array.from(this.queries.values());
        if (filter?.enabled !== undefined) {
            queries = queries.filter(q => q.enabled === filter.enabled);
        }
        return queries;
    }
    /**
     * Delete query
     */
    deleteQuery(queryId) {
        this.queries.delete(queryId);
        EventBus_1.eventBus.emitSync('timeseries.cq_deleted', { queryId }, 'ContinuousQueryManager');
    }
    scheduleExecution(query) {
        // Mock scheduling
        setInterval(() => this.executeQuery(query.id), query.interval);
    }
    generateQueryId() {
        return `cq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ContinuousQueryManager = ContinuousQueryManager;
/**
 * Anomaly Detector
 */
class AnomalyDetector {
    anomalies = new Map();
    timeSeriesManager;
    constructor(timeSeriesManager) {
        this.timeSeriesManager = timeSeriesManager;
    }
    /**
     * Detect anomalies
     */
    async detect(seriesId, threshold = 3) {
        const series = this.timeSeriesManager.getSeries(seriesId);
        if (!series) {
            throw new Error(`Series not found: ${seriesId}`);
        }
        const anomalies = [];
        const values = series.dataPoints.map(p => p.value);
        if (values.length < 2) {
            return anomalies;
        }
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
        for (const point of series.dataPoints) {
            const deviation = Math.abs(point.value - mean) / stdDev;
            if (deviation > threshold) {
                const anomaly = {
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
            EventBus_1.eventBus.emitSync('timeseries.anomalies_detected', { seriesId, count: anomalies.length }, 'AnomalyDetector');
        }
        return anomalies;
    }
    /**
     * Get anomaly
     */
    getAnomaly(anomalyId) {
        return this.anomalies.get(anomalyId);
    }
    /**
     * List anomalies
     */
    listAnomalies(filter) {
        let anomalies = Array.from(this.anomalies.values());
        if (filter?.seriesId) {
            anomalies = anomalies.filter(a => a.seriesId === filter.seriesId);
        }
        if (filter?.severity) {
            anomalies = anomalies.filter(a => a.severity === filter.severity);
        }
        return anomalies.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    }
    determineSeverity(deviation, threshold) {
        if (deviation > threshold * 2)
            return AnomalySeverity.Critical;
        if (deviation > threshold * 1.5)
            return AnomalySeverity.High;
        if (deviation > threshold * 1.2)
            return AnomalySeverity.Medium;
        return AnomalySeverity.Low;
    }
    generateAnomalyId() {
        return `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AnomalyDetector = AnomalyDetector;
/**
 * Forecasting Engine
 */
class ForecastingEngine {
    forecasts = new Map();
    timeSeriesManager;
    constructor(timeSeriesManager) {
        this.timeSeriesManager = timeSeriesManager;
    }
    /**
     * Generate forecast
     */
    async forecast(seriesId, horizon, model = ForecastModel.Linear) {
        const series = this.timeSeriesManager.getSeries(seriesId);
        if (!series) {
            throw new Error(`Series not found: ${seriesId}`);
        }
        // Mock forecasting
        await new Promise(resolve => setTimeout(resolve, 100));
        const predictions = this.generatePredictions(series, horizon, model);
        const forecast = {
            id: this.generateForecastId(),
            seriesId,
            predictions,
            confidence: 0.75 + Math.random() * 0.2,
            model,
            horizon,
            createdAt: new Date(),
        };
        this.forecasts.set(forecast.id, forecast);
        EventBus_1.eventBus.emitSync('timeseries.forecast_generated', forecast, 'ForecastingEngine');
        return forecast;
    }
    /**
     * Get forecast
     */
    getForecast(forecastId) {
        return this.forecasts.get(forecastId);
    }
    /**
     * List forecasts
     */
    listForecasts(seriesId) {
        let forecasts = Array.from(this.forecasts.values());
        if (seriesId) {
            forecasts = forecasts.filter(f => f.seriesId === seriesId);
        }
        return forecasts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    generatePredictions(series, horizon, model) {
        const points = series.dataPoints;
        if (points.length === 0)
            return [];
        const lastPoint = points[points.length - 1];
        const predictions = [];
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
    calculateTrend(points) {
        if (points.length < 2)
            return 0;
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
    generateForecastId() {
        return `forecast_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ForecastingEngine = ForecastingEngine;
/**
 * Alert Manager
 */
class AlertManager {
    alerts = new Map();
    timeSeriesManager;
    constructor(timeSeriesManager) {
        this.timeSeriesManager = timeSeriesManager;
    }
    /**
     * Create alert
     */
    createAlert(alert) {
        const fullAlert = {
            ...alert,
            id: this.generateAlertId(),
            state: AlertState.OK,
        };
        this.alerts.set(fullAlert.id, fullAlert);
        EventBus_1.eventBus.emitSync('timeseries.alert_created', fullAlert, 'AlertManager');
        return fullAlert;
    }
    /**
     * Evaluate alerts
     */
    async evaluateAlerts() {
        for (const alert of this.alerts.values()) {
            if (!alert.enabled)
                continue;
            await this.evaluateAlert(alert);
        }
    }
    /**
     * Evaluate single alert
     */
    async evaluateAlert(alert) {
        const series = this.timeSeriesManager.listSeries({ metric: alert.metric });
        for (const s of series) {
            const recentPoints = s.dataPoints.slice(-10);
            const values = recentPoints.map(p => p.value);
            if (values.length === 0)
                continue;
            const aggregatedValue = this.calculateAggregation(values, alert.condition.aggregation);
            const triggered = this.checkCondition(aggregatedValue, alert.condition.operator, alert.threshold);
            if (triggered && alert.state !== AlertState.Firing) {
                alert.state = AlertState.Firing;
                alert.lastTriggered = new Date();
                // Execute actions
                for (const action of alert.actions) {
                    await this.executeAction(action, alert);
                }
                EventBus_1.eventBus.emitSync('timeseries.alert_triggered', alert, 'AlertManager');
            }
            else if (!triggered && alert.state === AlertState.Firing) {
                alert.state = AlertState.Resolved;
                EventBus_1.eventBus.emitSync('timeseries.alert_resolved', alert, 'AlertManager');
            }
        }
    }
    /**
     * Get alert
     */
    getAlert(alertId) {
        return this.alerts.get(alertId);
    }
    /**
     * List alerts
     */
    listAlerts(filter) {
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
    deleteAlert(alertId) {
        this.alerts.delete(alertId);
        EventBus_1.eventBus.emitSync('timeseries.alert_deleted', { alertId }, 'AlertManager');
    }
    checkCondition(value, operator, threshold) {
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
    calculateAggregation(values, func) {
        if (values.length === 0)
            return 0;
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
    async executeAction(action, alert) {
        // Mock action execution
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AlertManager = AlertManager;
/**
 * Singleton instances
 */
exports.timeSeriesManager = new TimeSeriesManager();
exports.continuousQueryManager = new ContinuousQueryManager(exports.timeSeriesManager);
exports.anomalyDetector = new AnomalyDetector(exports.timeSeriesManager);
exports.forecastingEngine = new ForecastingEngine(exports.timeSeriesManager);
exports.alertManager = new AlertManager(exports.timeSeriesManager);
