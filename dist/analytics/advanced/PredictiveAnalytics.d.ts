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
export declare class PredictiveAnalytics extends EventEmitter {
    private timeSeries;
    private forecasts;
    private insightRules;
    private models;
    constructor();
    /**
     * Register time series
     */
    registerTimeSeries(series: TimeSeries): void;
    /**
     * Add data point to time series
     */
    addDataPoint(seriesId: string, dataPoint: DataPoint): void;
    /**
     * Generate forecast
     */
    generateForecast(seriesId: string, method?: ForecastMethod, horizon?: number): Promise<Forecast>;
    /**
     * Exponential smoothing forecast
     */
    private exponentialSmoothing;
    /**
     * ARIMA forecast (simplified)
     */
    private arimaForecast;
    /**
     * Linear regression forecast
     */
    private linearRegressionForecast;
    /**
     * Prophet forecast (simplified simulation)
     */
    private prophetForecast;
    /**
     * LSTM forecast (simplified simulation)
     */
    private lstmForecast;
    /**
     * Analyze trends
     */
    analyzeTrend(seriesId: string): TrendAnalysis;
    /**
     * Detect seasonality
     */
    private detectSeasonality;
    /**
     * Extract seasonal patterns
     */
    private extractSeasonalPatterns;
    /**
     * Detect anomalies
     */
    private detectAnomalies;
    /**
     * Calculate correlation between two series
     */
    calculateCorrelation(seriesId1: string, seriesId2: string, maxLag?: number): Correlation[];
    /**
     * Pearson correlation coefficient
     */
    private pearsonCorrelation;
    /**
     * Generate insights
     */
    generateInsights(seriesId: string): string[];
    /**
     * Initialize insight rules
     */
    private initializeInsightRules;
    /**
     * Helper functions
     */
    private getTimeInterval;
    private calculateStdDev;
    private average;
    private calculateSlope;
    private calculateAutoCorrelation;
    private extractTrend;
    private extractSeasonality;
    private normalize;
    private denormalize;
    private calculateForecastConfidence;
    private calculateAccuracy;
    /**
     * Get forecast
     */
    getForecast(forecastId: string): Forecast | null;
    /**
     * List forecasts for series
     */
    listForecasts(seriesId: string): Forecast[];
}
export default PredictiveAnalytics;
//# sourceMappingURL=PredictiveAnalytics.d.ts.map