"use strict";
/**
 * PredictiveAnalytics - Time series forecasting and ML-based insights
 * Trend analysis, anomaly prediction, and business intelligence
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictiveAnalytics = void 0;
const events_1 = require("events");
class PredictiveAnalytics extends events_1.EventEmitter {
    timeSeries = new Map();
    forecasts = new Map();
    insightRules = new Map();
    models = new Map();
    constructor() {
        super();
        this.initializeInsightRules();
    }
    /**
     * Register time series
     */
    registerTimeSeries(series) {
        this.timeSeries.set(series.id, series);
        this.emit('series:registered', series);
    }
    /**
     * Add data point to time series
     */
    addDataPoint(seriesId, dataPoint) {
        const series = this.timeSeries.get(seriesId);
        if (!series)
            throw new Error(`Time series ${seriesId} not found`);
        series.dataPoints.push(dataPoint);
        // Keep series sorted by timestamp
        series.dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        this.emit('datapoint:added', { seriesId, dataPoint });
        // Auto-generate forecast if enough data
        if (series.dataPoints.length >= 30) {
            this.generateForecast(seriesId, 'exponential_smoothing', 10);
        }
    }
    /**
     * Generate forecast
     */
    async generateForecast(seriesId, method = 'exponential_smoothing', horizon = 10) {
        const series = this.timeSeries.get(seriesId);
        if (!series)
            throw new Error(`Time series ${seriesId} not found`);
        if (series.dataPoints.length < 10) {
            throw new Error('Insufficient data for forecasting');
        }
        let predictions;
        switch (method) {
            case 'exponential_smoothing':
                predictions = this.exponentialSmoothing(series, horizon);
                break;
            case 'arima':
                predictions = this.arimaForecast(series, horizon);
                break;
            case 'linear_regression':
                predictions = this.linearRegressionForecast(series, horizon);
                break;
            case 'prophet':
                predictions = await this.prophetForecast(series, horizon);
                break;
            case 'lstm':
                predictions = await this.lstmForecast(series, horizon);
                break;
            default:
                predictions = this.exponentialSmoothing(series, horizon);
        }
        const forecast = {
            id: `forecast_${Date.now()}`,
            timeSeriesId: seriesId,
            method,
            predictions,
            confidence: this.calculateForecastConfidence(series, predictions),
            accuracy: this.calculateAccuracy(series),
            createdAt: new Date()
        };
        this.forecasts.set(forecast.id, forecast);
        this.emit('forecast:generated', forecast);
        return forecast;
    }
    /**
     * Exponential smoothing forecast
     */
    exponentialSmoothing(series, horizon) {
        const values = series.dataPoints.map(p => p.value);
        const alpha = 0.3; // Smoothing parameter
        const beta = 0.1; // Trend parameter
        let level = values[0];
        let trend = values[1] - values[0];
        // Calculate smoothed values
        for (let i = 1; i < values.length; i++) {
            const prevLevel = level;
            level = alpha * values[i] + (1 - alpha) * (level + trend);
            trend = beta * (level - prevLevel) + (1 - beta) * trend;
        }
        // Generate predictions
        const predictions = [];
        const lastTimestamp = series.dataPoints[series.dataPoints.length - 1].timestamp;
        const interval = this.getTimeInterval(series.frequency);
        for (let h = 1; h <= horizon; h++) {
            const forecastValue = level + h * trend;
            const stdDev = this.calculateStdDev(values);
            const margin = 1.96 * stdDev; // 95% confidence interval
            predictions.push({
                timestamp: new Date(lastTimestamp.getTime() + h * interval),
                value: forecastValue,
                lower: forecastValue - margin,
                upper: forecastValue + margin,
                confidence: 0.95
            });
        }
        return predictions;
    }
    /**
     * ARIMA forecast (simplified)
     */
    arimaForecast(series, horizon) {
        const values = series.dataPoints.map(p => p.value);
        // Differencing to make stationary
        const diff = values.slice(1).map((v, i) => v - values[i]);
        // Simple AR(1) model
        const phi = this.calculateAutoCorrelation(diff, 1);
        let forecast = diff[diff.length - 1];
        const predictions = [];
        const lastTimestamp = series.dataPoints[series.dataPoints.length - 1].timestamp;
        const interval = this.getTimeInterval(series.frequency);
        const lastValue = values[values.length - 1];
        for (let h = 1; h <= horizon; h++) {
            forecast = phi * forecast;
            const predictedValue = lastValue + forecast;
            const stdDev = this.calculateStdDev(diff);
            const margin = 1.96 * stdDev;
            predictions.push({
                timestamp: new Date(lastTimestamp.getTime() + h * interval),
                value: predictedValue,
                lower: predictedValue - margin,
                upper: predictedValue + margin,
                confidence: 0.95
            });
        }
        return predictions;
    }
    /**
     * Linear regression forecast
     */
    linearRegressionForecast(series, horizon) {
        const n = series.dataPoints.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = series.dataPoints.map(p => p.value);
        // Calculate slope and intercept
        const sumX = x.reduce((sum, v) => sum + v, 0);
        const sumY = y.reduce((sum, v) => sum + v, 0);
        const sumXY = x.reduce((sum, v, i) => sum + v * y[i], 0);
        const sumX2 = x.reduce((sum, v) => sum + v * v, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        // Generate predictions
        const predictions = [];
        const lastTimestamp = series.dataPoints[series.dataPoints.length - 1].timestamp;
        const interval = this.getTimeInterval(series.frequency);
        const residuals = y.map((yi, i) => yi - (slope * x[i] + intercept));
        const stdDev = this.calculateStdDev(residuals);
        for (let h = 1; h <= horizon; h++) {
            const predictedValue = slope * (n + h - 1) + intercept;
            const margin = 1.96 * stdDev;
            predictions.push({
                timestamp: new Date(lastTimestamp.getTime() + h * interval),
                value: predictedValue,
                lower: predictedValue - margin,
                upper: predictedValue + margin,
                confidence: 0.95
            });
        }
        return predictions;
    }
    /**
     * Prophet forecast (simplified simulation)
     */
    async prophetForecast(series, horizon) {
        await new Promise(resolve => setTimeout(resolve, 100));
        // Decompose into trend + seasonality + residual
        const trend = this.extractTrend(series);
        const seasonal = this.extractSeasonality(series);
        const predictions = [];
        const lastTimestamp = series.dataPoints[series.dataPoints.length - 1].timestamp;
        const interval = this.getTimeInterval(series.frequency);
        for (let h = 1; h <= horizon; h++) {
            const trendValue = trend[trend.length - 1] + (trend[trend.length - 1] - trend[trend.length - 2]) * h;
            const seasonalValue = seasonal[h % seasonal.length];
            const predictedValue = trendValue + seasonalValue;
            const stdDev = this.calculateStdDev(series.dataPoints.map(p => p.value));
            const margin = 1.96 * stdDev;
            predictions.push({
                timestamp: new Date(lastTimestamp.getTime() + h * interval),
                value: predictedValue,
                lower: predictedValue - margin,
                upper: predictedValue + margin,
                confidence: 0.95
            });
        }
        return predictions;
    }
    /**
     * LSTM forecast (simplified simulation)
     */
    async lstmForecast(series, horizon) {
        await new Promise(resolve => setTimeout(resolve, 200));
        // Simulate deep learning forecast
        const values = series.dataPoints.map(p => p.value);
        const normalized = this.normalize(values);
        // Use last values for prediction
        const lookback = Math.min(10, values.length);
        const lastValues = normalized.slice(-lookback);
        const predictions = [];
        const lastTimestamp = series.dataPoints[series.dataPoints.length - 1].timestamp;
        const interval = this.getTimeInterval(series.frequency);
        let current = lastValues[lastValues.length - 1];
        for (let h = 1; h <= horizon; h++) {
            // Simulate LSTM prediction
            const change = (Math.random() - 0.5) * 0.1;
            current += change;
            const denormalized = this.denormalize(current, values);
            const stdDev = this.calculateStdDev(values) * 1.5; // LSTM has more uncertainty
            const margin = 1.96 * stdDev;
            predictions.push({
                timestamp: new Date(lastTimestamp.getTime() + h * interval),
                value: denormalized,
                lower: denormalized - margin,
                upper: denormalized + margin,
                confidence: 0.90
            });
        }
        return predictions;
    }
    /**
     * Analyze trends
     */
    analyzeTrend(seriesId) {
        const series = this.timeSeries.get(seriesId);
        if (!series)
            throw new Error(`Time series ${seriesId} not found`);
        const values = series.dataPoints.map(p => p.value);
        // Calculate trend direction
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const avgFirst = this.average(firstHalf);
        const avgSecond = this.average(secondHalf);
        const direction = avgSecond > avgFirst * 1.05 ? 'up' :
            avgSecond < avgFirst * 0.95 ? 'down' : 'stable';
        // Calculate trend strength
        const slope = this.calculateSlope(values);
        const strength = Math.min(1, Math.abs(slope) / this.calculateStdDev(values));
        // Calculate change rate
        const changeRate = (avgSecond - avgFirst) / avgFirst;
        // Detect seasonality
        const seasonality = this.detectSeasonality(series);
        // Detect anomalies
        const anomalies = this.detectAnomalies(series);
        return {
            direction,
            strength,
            changeRate,
            seasonality,
            anomalies
        };
    }
    /**
     * Detect seasonality
     */
    detectSeasonality(series) {
        const values = series.dataPoints.map(p => p.value);
        // Try different periods
        const periods = [7, 24, 30]; // Weekly, daily, monthly
        let bestPeriod = 0;
        let bestCorrelation = 0;
        for (const period of periods) {
            if (values.length < period * 2)
                continue;
            const correlation = this.calculateAutoCorrelation(values, period);
            if (Math.abs(correlation) > Math.abs(bestCorrelation)) {
                bestCorrelation = correlation;
                bestPeriod = period;
            }
        }
        const detected = Math.abs(bestCorrelation) > 0.3;
        return {
            detected,
            period: bestPeriod,
            strength: Math.abs(bestCorrelation),
            patterns: detected ? this.extractSeasonalPatterns(series, bestPeriod) : []
        };
    }
    /**
     * Extract seasonal patterns
     */
    extractSeasonalPatterns(series, period) {
        const values = series.dataPoints.map(p => p.value);
        const cycles = Math.floor(values.length / period);
        if (cycles < 2)
            return [];
        // Average values at each position in cycle
        const avgCycle = Array(period).fill(0);
        for (let i = 0; i < cycles; i++) {
            for (let j = 0; j < period; j++) {
                avgCycle[j] += values[i * period + j];
            }
        }
        avgCycle.forEach((_, i) => avgCycle[i] /= cycles);
        // Find peaks and troughs
        const peaks = [];
        const troughs = [];
        for (let i = 1; i < avgCycle.length - 1; i++) {
            if (avgCycle[i] > avgCycle[i - 1] && avgCycle[i] > avgCycle[i + 1]) {
                peaks.push(i);
            }
            if (avgCycle[i] < avgCycle[i - 1] && avgCycle[i] < avgCycle[i + 1]) {
                troughs.push(i);
            }
        }
        const type = period === 7 ? 'weekly' : period === 24 ? 'daily' : 'monthly';
        return [{
                type,
                confidence: 0.8,
                peaks,
                troughs
            }];
    }
    /**
     * Detect anomalies
     */
    detectAnomalies(series) {
        const values = series.dataPoints.map(p => p.value);
        const mean = this.average(values);
        const stdDev = this.calculateStdDev(values);
        const anomalies = [];
        for (let i = 0; i < series.dataPoints.length; i++) {
            const point = series.dataPoints[i];
            const zScore = Math.abs((point.value - mean) / stdDev);
            if (zScore > 3) {
                const type = point.value > mean ? 'spike' : 'drop';
                const severity = zScore > 5 ? 'high' : zScore > 4 ? 'medium' : 'low';
                anomalies.push({
                    timestamp: point.timestamp,
                    value: point.value,
                    expectedValue: mean,
                    severity,
                    type
                });
            }
        }
        return anomalies;
    }
    /**
     * Calculate correlation between two series
     */
    calculateCorrelation(seriesId1, seriesId2, maxLag = 10) {
        const series1 = this.timeSeries.get(seriesId1);
        const series2 = this.timeSeries.get(seriesId2);
        if (!series1 || !series2) {
            throw new Error('One or both series not found');
        }
        const values1 = series1.dataPoints.map(p => p.value);
        const values2 = series2.dataPoints.map(p => p.value);
        const minLength = Math.min(values1.length, values2.length);
        const correlations = [];
        for (let lag = 0; lag <= maxLag; lag++) {
            const coefficient = this.pearsonCorrelation(values1.slice(0, minLength - lag), values2.slice(lag, minLength));
            // Simple p-value approximation
            const pValue = Math.exp(-Math.abs(coefficient) * Math.sqrt(minLength - lag - 2));
            correlations.push({
                series1: seriesId1,
                series2: seriesId2,
                coefficient,
                pValue,
                lag,
                significant: Math.abs(coefficient) > 0.5 && pValue < 0.05
            });
        }
        return correlations;
    }
    /**
     * Pearson correlation coefficient
     */
    pearsonCorrelation(x, y) {
        const n = Math.min(x.length, y.length);
        if (n === 0)
            return 0;
        const sumX = x.reduce((sum, v) => sum + v, 0);
        const sumY = y.reduce((sum, v) => sum + v, 0);
        const sumXY = x.reduce((sum, v, i) => sum + v * y[i], 0);
        const sumX2 = x.reduce((sum, v) => sum + v * v, 0);
        const sumY2 = y.reduce((sum, v) => sum + v * v, 0);
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        return denominator === 0 ? 0 : numerator / denominator;
    }
    /**
     * Generate insights
     */
    generateInsights(seriesId) {
        const series = this.timeSeries.get(seriesId);
        if (!series)
            return [];
        const insights = [];
        const trend = this.analyzeTrend(seriesId);
        for (const rule of this.insightRules.values()) {
            if (rule.condition({ series, trend })) {
                insights.push(rule.insight({ series, trend }));
            }
        }
        return insights.sort((a, b) => b.length - a.length); // Prioritize detailed insights
    }
    /**
     * Initialize insight rules
     */
    initializeInsightRules() {
        this.insightRules.set('uptrend', {
            id: 'uptrend',
            name: 'Upward Trend Detected',
            condition: (data) => data.trend.direction === 'up' && data.trend.strength > 0.5,
            insight: (data) => `Strong upward trend detected with ${(data.trend.changeRate * 100).toFixed(1)}% increase`,
            priority: 1
        });
        this.insightRules.set('seasonality', {
            id: 'seasonality',
            name: 'Seasonality Pattern',
            condition: (data) => data.trend.seasonality.detected,
            insight: (data) => `Seasonal pattern detected with period of ${data.trend.seasonality.period}`,
            priority: 2
        });
        this.insightRules.set('anomalies', {
            id: 'anomalies',
            name: 'Anomalies Detected',
            condition: (data) => data.trend.anomalies.length > 0,
            insight: (data) => `${data.trend.anomalies.length} anomalies detected in the data`,
            priority: 3
        });
    }
    /**
     * Helper functions
     */
    getTimeInterval(frequency) {
        switch (frequency) {
            case 'second': return 1000;
            case 'minute': return 60000;
            case 'hour': return 3600000;
            case 'day': return 86400000;
            case 'week': return 604800000;
            case 'month': return 2592000000;
            default: return 60000;
        }
    }
    calculateStdDev(values) {
        const mean = this.average(values);
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    average(values) {
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    calculateSlope(values) {
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const sumX = x.reduce((sum, v) => sum + v, 0);
        const sumY = values.reduce((sum, v) => sum + v, 0);
        const sumXY = x.reduce((sum, v, i) => sum + v * values[i], 0);
        const sumX2 = x.reduce((sum, v) => sum + v * v, 0);
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
    calculateAutoCorrelation(values, lag) {
        if (lag >= values.length)
            return 0;
        const n = values.length - lag;
        const mean = this.average(values);
        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (values[i] - mean) * (values[i + lag] - mean);
        }
        for (let i = 0; i < values.length; i++) {
            denominator += Math.pow(values[i] - mean, 2);
        }
        return denominator === 0 ? 0 : numerator / denominator;
    }
    extractTrend(series) {
        const values = series.dataPoints.map(p => p.value);
        const windowSize = Math.floor(values.length / 10);
        const trend = [];
        for (let i = 0; i < values.length; i++) {
            const start = Math.max(0, i - windowSize);
            const end = Math.min(values.length, i + windowSize + 1);
            const window = values.slice(start, end);
            trend.push(this.average(window));
        }
        return trend;
    }
    extractSeasonality(series) {
        const values = series.dataPoints.map(p => p.value);
        const trend = this.extractTrend(series);
        return values.map((v, i) => v - trend[i]);
    }
    normalize(values) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        return values.map(v => (v - min) / range);
    }
    denormalize(normalized, original) {
        const min = Math.min(...original);
        const max = Math.max(...original);
        return normalized * (max - min) + min;
    }
    calculateForecastConfidence(series, predictions) {
        const values = series.dataPoints.map(p => p.value);
        const stdDev = this.calculateStdDev(values);
        const avgRange = predictions.reduce((sum, p) => sum + (p.upper - p.lower), 0) / predictions.length;
        return Math.max(0, Math.min(1, 1 - (avgRange / (4 * stdDev))));
    }
    calculateAccuracy(series) {
        // Simplified backtesting
        const values = series.dataPoints.map(p => p.value);
        if (values.length < 20)
            return 0.5;
        const trainSize = Math.floor(values.length * 0.8);
        const predictions = this.exponentialSmoothing(series, values.length - trainSize);
        const actual = values.slice(trainSize);
        const errors = actual.map((v, i) => Math.abs(v - predictions[i].value));
        const mape = errors.reduce((sum, e, i) => sum + e / actual[i], 0) / actual.length;
        return Math.max(0, Math.min(1, 1 - mape));
    }
    /**
     * Get forecast
     */
    getForecast(forecastId) {
        return this.forecasts.get(forecastId) || null;
    }
    /**
     * List forecasts for series
     */
    listForecasts(seriesId) {
        return Array.from(this.forecasts.values())
            .filter(f => f.timeSeriesId === seriesId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
}
exports.PredictiveAnalytics = PredictiveAnalytics;
exports.default = PredictiveAnalytics;
