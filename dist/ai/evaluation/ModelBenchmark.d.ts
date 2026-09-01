/**
 * ModelBenchmark - Automated model benchmarking and comparison
 * Performance comparison, cost analysis, and quality metrics
 */
import { EventEmitter } from 'events';
export interface BenchmarkConfig {
    models: ModelConfig[];
    datasets: BenchmarkDataset[];
    metrics: MetricConfig[];
    iterations: number;
    warmupRuns: number;
    timeout: number;
    parallel: boolean;
}
export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    endpoint: string;
    apiKey?: string;
    config: Record<string, any>;
    costPerToken: number;
}
export interface BenchmarkDataset {
    id: string;
    name: string;
    samples: BenchmarkSample[];
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
}
export interface BenchmarkSample {
    id: string;
    input: string;
    expectedOutput?: string;
    context?: string;
    metadata: Record<string, any>;
}
export interface MetricConfig {
    name: string;
    type: 'accuracy' | 'latency' | 'cost' | 'quality' | 'custom';
    weight: number;
    higherIsBetter: boolean;
    threshold?: number;
}
export interface BenchmarkResult {
    id: string;
    modelId: string;
    datasetId: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    metrics: MetricResult[];
    samples: SampleResult[];
    summary: BenchmarkSummary;
    errors: BenchmarkError[];
}
export interface MetricResult {
    name: string;
    value: number;
    unit: string;
    passed: boolean;
    threshold?: number;
}
export interface SampleResult {
    sampleId: string;
    input: string;
    output: string;
    expectedOutput?: string;
    correct: boolean;
    latency: number;
    tokens: number;
    cost: number;
    quality: number;
}
export interface BenchmarkSummary {
    totalSamples: number;
    successfulSamples: number;
    failedSamples: number;
    avgLatency: number;
    totalCost: number;
    avgQuality: number;
    accuracy: number;
    throughput: number;
}
export interface BenchmarkError {
    sampleId: string;
    error: string;
    timestamp: Date;
    retryCount: number;
}
export interface ComparisonReport {
    models: string[];
    datasets: string[];
    metrics: MetricComparison[];
    rankings: ModelRanking[];
    recommendations: string[];
    visualizations: VisualizationData[];
}
export interface MetricComparison {
    metric: string;
    values: Map<string, number>;
    winner: string;
    difference: number;
}
export interface ModelRanking {
    modelId: string;
    rank: number;
    score: number;
    strengths: string[];
    weaknesses: string[];
}
export interface VisualizationData {
    type: 'bar' | 'line' | 'scatter' | 'radar';
    data: any;
    config: any;
}
export declare class ModelBenchmark extends EventEmitter {
    private config;
    private results;
    private running;
    private cache;
    constructor(config: BenchmarkConfig);
    runBenchmark(modelId: string, datasetId: string): Promise<BenchmarkResult>;
    private benchmarkSample;
    private executeSample;
    private countTokens;
    private evaluateCorrectness;
    private evaluateQuality;
    private calculateMetrics;
    private getMetricUnit;
    private calculateSummary;
    private initializeSummary;
    runComparison(modelIds: string[], datasetIds: string[]): Promise<ComparisonReport>;
    private generateComparisonReport;
    private compareMetrics;
    private rankModels;
    private identifyStrengths;
    private identifyWeaknesses;
    private generateRecommendations;
    private generateVisualizations;
    private prepareBarChartData;
    private prepareScatterData;
    getResult(resultId: string): BenchmarkResult | null;
    listResults(): BenchmarkResult[];
    exportResults(format: 'json' | 'csv'): string;
}
export default ModelBenchmark;
//# sourceMappingURL=ModelBenchmark.d.ts.map