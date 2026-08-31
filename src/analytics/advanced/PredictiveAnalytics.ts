/**
 * PredictiveAnalytics - Time series forecasting and ML-based insights
 * Trend analysis, anomaly prediction, and business intelligence
 */

import { EventEmitter } from 'events';

export interface TimeSeries {
  id: string;
  name: string;
  dataPoints: DataPoint[];
  frequency: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  metadata: TimeSeriesMetadata;
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface TimeSeriesMetadata {
  unit: string;
  source: string;
  description: string;
  tags: string[];
}

export interface Forecast {
  id: string;
  timeSeriesId: string;
  method: ForecastMethod;
  predictions: Prediction[];
  confidence: number;
  accuracy: number;
  createdAt: Date;
}

export type ForecastMethod = 'arima' | 'exponential_smoothing' | 'prophet' | 'lstm' | 'linear_regression';

export interface Prediction {
  timestamp: Date;
  value: number;
  lower: number;
  upper: number;
  confidence: number;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  strength: number;
  changeRate: number;
  seasonality: SeasonalityInfo;
  anomalies: AnomalyPoint[];
}

export interface SeasonalityInfo {
  detected: boolean;
  period: number;
  strength: number;
  patterns: SeasonalPattern[];
}

export interface SeasonalPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  confidence: number;
  peaks: number[];
  troughs: number[];
}

export interface AnomalyPoint {
  timestamp: Date;
  value: number;
  expectedValue: number;
  severity: 'low' | 'medium' | 'high';
  type: 'spike' | 'drop' | 'shift';
}

export interface Correlation {
  series1: string;
  series2: string;
  coefficient: number;
  pValue: number;
  lag: number;
  significant: boolean;
}

export interface InsightRule {
  id: string;
  name: string;
  condition: (data: any) => boolean;
  insight: (data: any) => string;
  priority: number;
}

export class PredictiveAnalytics extends EventEmitter {
  private timeSeries: Map<string, TimeSeries> = new Map();
  private forecasts: Map<string, Forecast> = new Map();
  private insightRules: Map<string, InsightRule> = new Map();
  private models: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeInsightRules();
  }

  /**
   * Register time series
   */
  public registerTimeSeries(series: TimeSeries): void {
    this.timeSeries.set(series.id, series);
    this.emit('series:registered', series);
  }

  /**
   * Add data point to time series
   */
  public addDataPoint(seriesId: string, dataPoint: DataPoint): void {
    const series = this.timeSeries.get(seriesId);
    if (!series) throw new Error(`Time series ${seriesId} not found`);

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
  public async generateForecast(
    seriesId: string,
    method: ForecastMethod = 'exponential_smoothing',
    horizon: number = 10
  ): Promise<Forecast> {
    const series = this.timeSeries.get(seriesId);
    if (!series) throw new Error(`Time series ${seriesId} not found`);

    if (series.dataPoints.length < 10) {
      throw new Error('Insufficient data for forecasting');
    }

    let predictions: Prediction[];

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

    const forecast: Forecast = {
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
  private exponentialSmoothing(series: TimeSeries, horizon: number): Prediction[] {
    const values = series.dataPoints.map(p => p.value);
    const alpha = 0.3; // Smoothing parameter
    const beta = 0.1;  // Trend parameter

    let level = values[0];
    let trend = values[1] - values[0];

    // Calculate smoothed values
    for (let i = 1; i < values.length; i++) {
      const prevLevel = level;
      level = alpha * values[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    // Generate predictions
    const predictions: Prediction[] = [];
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
  private arimaForecast(series: TimeSeries, horizon: number): Prediction[] {
    const values = series.dataPoints.map(p => p.value);

    // Differencing to make stationary
    const diff = values.slice(1).map((v, i) => v - values[i]);

    // Simple AR(1) model
    const phi = this.calculateAutoCorrelation(diff, 1);
    let forecast = diff[diff.length - 1];

    const predictions: Prediction[] = [];
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
  private linearRegressionForecast(series: TimeSeries, horizon: number): Prediction[] {
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
    const predictions: Prediction[] = [];
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
  private async prophetForecast(series: TimeSeries, horizon: number): Promise<Prediction[]> {
    await new Promise(resolve => setTimeout(resolve, 100));

    // Decompose into trend + seasonality + residual
    const trend = this.extractTrend(series);
    const seasonal = this.extractSeasonality(series);

    const predictions: Prediction[] = [];
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
  private async lstmForecast(series: TimeSeries, horizon: number): Promise<Prediction[]> {
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate deep learning forecast
    const values = series.dataPoints.map(p => p.value);
    const normalized = this.normalize(values);

    // Use last values for prediction
    const lookback = Math.min(10, values.length);
    const lastValues = normalized.slice(-lookback);

    const predictions: Prediction[] = [];
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
  public analyzeTrend(seriesId: string): TrendAnalysis {
    const series = this.timeSeries.get(seriesId);
    if (!series) throw new Error(`Time series ${seriesId} not found`);

    const values = series.dataPoints.map(p => p.value);

    // Calculate trend direction
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const avgFirst = this.average(firstHalf);
    const avgSecond = this.average(secondHalf);

    const direction: 'up' | 'down' | 'stable' =
      avgSecond > avgFirst * 1.05 ? 'up' :
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
  private detectSeasonality(series: TimeSeries): SeasonalityInfo {
    const values = series.dataPoints.map(p => p.value);

    // Try different periods
    const periods = [7, 24, 30]; // Weekly, daily, monthly
    let bestPeriod = 0;
    let bestCorrelation = 0;

    for (const period of periods) {
      if (values.length < period * 2) continue;

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
  private extractSeasonalPatterns(series: TimeSeries, period: number): SeasonalPattern[] {
    const values = series.dataPoints.map(p => p.value);
    const cycles = Math.floor(values.length / period);

    if (cycles < 2) return [];

    // Average values at each position in cycle
    const avgCycle = Array(period).fill(0);
    for (let i = 0; i < cycles; i++) {
      for (let j = 0; j < period; j++) {
        avgCycle[j] += values[i * period + j];
      }
    }
    avgCycle.forEach((_, i) => avgCycle[i] /= cycles);

    // Find peaks and troughs
    const peaks: number[] = [];
    const troughs: number[] = [];

    for (let i = 1; i < avgCycle.length - 1; i++) {
      if (avgCycle[i] > avgCycle[i-1] && avgCycle[i] > avgCycle[i+1]) {
        peaks.push(i);
      }
      if (avgCycle[i] < avgCycle[i-1] && avgCycle[i] < avgCycle[i+1]) {
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
  private detectAnomalies(series: TimeSeries): AnomalyPoint[] {
    const values = series.dataPoints.map(p => p.value);
    const mean = this.average(values);
    const stdDev = this.calculateStdDev(values);
    const anomalies: AnomalyPoint[] = [];

    for (let i = 0; i < series.dataPoints.length; i++) {
      const point = series.dataPoints[i];
      const zScore = Math.abs((point.value - mean) / stdDev);

      if (zScore > 3) {
        const type: 'spike' | 'drop' | 'shift' =
          point.value > mean ? 'spike' : 'drop';

        const severity: 'low' | 'medium' | 'high' =
          zScore > 5 ? 'high' : zScore > 4 ? 'medium' : 'low';

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
  public calculateCorrelation(seriesId1: string, seriesId2: string, maxLag: number = 10): Correlation[] {
    const series1 = this.timeSeries.get(seriesId1);
    const series2 = this.timeSeries.get(seriesId2);

    if (!series1 || !series2) {
      throw new Error('One or both series not found');
    }

    const values1 = series1.dataPoints.map(p => p.value);
    const values2 = series2.dataPoints.map(p => p.value);
    const minLength = Math.min(values1.length, values2.length);

    const correlations: Correlation[] = [];

    for (let lag = 0; lag <= maxLag; lag++) {
      const coefficient = this.pearsonCorrelation(
        values1.slice(0, minLength - lag),
        values2.slice(lag, minLength)
      );

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
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

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
  public generateInsights(seriesId: string): string[] {
    const series = this.timeSeries.get(seriesId);
    if (!series) return [];

    const insights: string[] = [];
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
  private initializeInsightRules(): void {
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
  private getTimeInterval(frequency: TimeSeries['frequency']): number {
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

  private calculateStdDev(values: number[]): number {
    const mean = this.average(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private average(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateSlope(values: number[]): number {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, v) => sum + v, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = x.reduce((sum, v, i) => sum + v * values[i], 0);
    const sumX2 = x.reduce((sum, v) => sum + v * v, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateAutoCorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;

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

  private extractTrend(series: TimeSeries): number[] {
    const values = series.dataPoints.map(p => p.value);
    const windowSize = Math.floor(values.length / 10);
    const trend: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(values.length, i + windowSize + 1);
      const window = values.slice(start, end);
      trend.push(this.average(window));
    }

    return trend;
  }

  private extractSeasonality(series: TimeSeries): number[] {
    const values = series.dataPoints.map(p => p.value);
    const trend = this.extractTrend(series);
    return values.map((v, i) => v - trend[i]);
  }

  private normalize(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return values.map(v => (v - min) / range);
  }

  private denormalize(normalized: number, original: number[]): number {
    const min = Math.min(...original);
    const max = Math.max(...original);
    return normalized * (max - min) + min;
  }

  private calculateForecastConfidence(series: TimeSeries, predictions: Prediction[]): number {
    const values = series.dataPoints.map(p => p.value);
    const stdDev = this.calculateStdDev(values);
    const avgRange = predictions.reduce((sum, p) => sum + (p.upper - p.lower), 0) / predictions.length;
    return Math.max(0, Math.min(1, 1 - (avgRange / (4 * stdDev))));
  }

  private calculateAccuracy(series: TimeSeries): number {
    // Simplified backtesting
    const values = series.dataPoints.map(p => p.value);
    if (values.length < 20) return 0.5;

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
  public getForecast(forecastId: string): Forecast | null {
    return this.forecasts.get(forecastId) || null;
  }

  /**
   * List forecasts for series
   */
  public listForecasts(seriesId: string): Forecast[] {
    return Array.from(this.forecasts.values())
      .filter(f => f.timeSeriesId === seriesId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export default PredictiveAnalytics;
