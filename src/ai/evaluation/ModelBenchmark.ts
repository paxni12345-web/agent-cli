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

export class ModelBenchmark extends EventEmitter {
  private config: BenchmarkConfig;
  private results: Map<string, BenchmarkResult> = new Map();
  private running: Set<string> = new Set();
  private cache: Map<string, any> = new Map();

  constructor(config: BenchmarkConfig) {
    super();
    this.config = config;
  }

  public async runBenchmark(modelId: string, datasetId: string): Promise<BenchmarkResult> {
    const model = this.config.models.find(m => m.id === modelId);
    const dataset = this.config.datasets.find(d => d.id === datasetId);

    if (!model) throw new Error(`Model ${modelId} not found`);
    if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

    const resultId = `${modelId}_${datasetId}_${Date.now()}`;
    this.running.add(resultId);

    const result: BenchmarkResult = {
      id: resultId,
      modelId,
      datasetId,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      metrics: [],
      samples: [],
      summary: this.initializeSummary(),
      errors: []
    };

    this.emit('benchmark:started', { modelId, datasetId });

    try {
      // Warmup runs
      for (let i = 0; i < this.config.warmupRuns; i++) {
        const sample = dataset.samples[i % dataset.samples.length];
        await this.executeSample(model, sample);
      }

      // Actual benchmark runs
      const iterations = Math.min(this.config.iterations, dataset.samples.length);

      for (let i = 0; i < iterations; i++) {
        const sample = dataset.samples[i];

        try {
          const sampleResult = await this.benchmarkSample(model, sample);
          result.samples.push(sampleResult);

          this.emit('benchmark:progress', {
            resultId,
            progress: ((i + 1) / iterations) * 100,
            current: i + 1,
            total: iterations
          });
        } catch (error) {
          result.errors.push({
            sampleId: sample.id,
            error: error.message,
            timestamp: new Date(),
            retryCount: 0
          });
        }
      }

      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      // Calculate metrics
      result.metrics = this.calculateMetrics(result.samples);
      result.summary = this.calculateSummary(result);

      this.results.set(resultId, result);
      this.emit('benchmark:completed', result);

      return result;
    } catch (error) {
      this.emit('benchmark:failed', { resultId, error });
      throw error;
    } finally {
      this.running.delete(resultId);
    }
  }

  private async benchmarkSample(model: ModelConfig, sample: BenchmarkSample): Promise<SampleResult> {
    const startTime = Date.now();

    const output = await this.executeSample(model, sample);
    const latency = Date.now() - startTime;

    const tokens = this.countTokens(sample.input) + this.countTokens(output);
    const cost = tokens * model.costPerToken;

    const correct = sample.expectedOutput
      ? this.evaluateCorrectness(output, sample.expectedOutput)
      : true;

    const quality = this.evaluateQuality(output, sample);

    return {
      sampleId: sample.id,
      input: sample.input,
      output,
      expectedOutput: sample.expectedOutput,
      correct,
      latency,
      tokens,
      cost,
      quality
    };
  }

  private async executeSample(model: ModelConfig, sample: BenchmarkSample): Promise<string> {
    const cacheKey = `${model.id}_${sample.id}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));

    const output = `Generated response for: ${sample.input}`;
    this.cache.set(cacheKey, output);

    return output;
  }

  private countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private evaluateCorrectness(output: string, expected: string): boolean {
    const normalizedOutput = output.toLowerCase().trim();
    const normalizedExpected = expected.toLowerCase().trim();

    return normalizedOutput.includes(normalizedExpected) ||
           normalizedExpected.includes(normalizedOutput);
  }

  private evaluateQuality(output: string, sample: BenchmarkSample): number {
    let score = 0.5;

    if (output.length > 10) score += 0.1;
    if (output.length > 50) score += 0.1;
    if (/^[A-Z]/.test(output)) score += 0.1;
    if (/[.!?]$/.test(output)) score += 0.1;
    if (sample.expectedOutput && output.includes(sample.expectedOutput)) score += 0.1;

    return Math.min(1.0, score);
  }

  private calculateMetrics(samples: SampleResult[]): MetricResult[] {
    const metrics: MetricResult[] = [];

    for (const metricConfig of this.config.metrics) {
      let value: number;

      switch (metricConfig.type) {
        case 'accuracy':
          value = samples.filter(s => s.correct).length / samples.length;
          break;

        case 'latency':
          value = samples.reduce((sum, s) => sum + s.latency, 0) / samples.length;
          break;

        case 'cost':
          value = samples.reduce((sum, s) => sum + s.cost, 0);
          break;

        case 'quality':
          value = samples.reduce((sum, s) => sum + s.quality, 0) / samples.length;
          break;

        default:
          value = 0;
      }

      const passed = metricConfig.threshold
        ? metricConfig.higherIsBetter
          ? value >= metricConfig.threshold
          : value <= metricConfig.threshold
        : true;

      metrics.push({
        name: metricConfig.name,
        value,
        unit: this.getMetricUnit(metricConfig.type),
        passed,
        threshold: metricConfig.threshold
      });
    }

    return metrics;
  }

  private getMetricUnit(type: string): string {
    switch (type) {
      case 'accuracy': return '%';
      case 'latency': return 'ms';
      case 'cost': return '$';
      case 'quality': return 'score';
      default: return '';
    }
  }

  private calculateSummary(result: BenchmarkResult): BenchmarkSummary {
    const samples = result.samples;

    return {
      totalSamples: samples.length,
      successfulSamples: samples.filter(s => s.correct).length,
      failedSamples: samples.filter(s => !s.correct).length,
      avgLatency: samples.reduce((sum, s) => sum + s.latency, 0) / samples.length,
      totalCost: samples.reduce((sum, s) => sum + s.cost, 0),
      avgQuality: samples.reduce((sum, s) => sum + s.quality, 0) / samples.length,
      accuracy: samples.filter(s => s.correct).length / samples.length,
      throughput: samples.length / (result.duration / 1000)
    };
  }

  private initializeSummary(): BenchmarkSummary {
    return {
      totalSamples: 0,
      successfulSamples: 0,
      failedSamples: 0,
      avgLatency: 0,
      totalCost: 0,
      avgQuality: 0,
      accuracy: 0,
      throughput: 0
    };
  }

  public async runComparison(modelIds: string[], datasetIds: string[]): Promise<ComparisonReport> {
    const results: BenchmarkResult[] = [];

    for (const modelId of modelIds) {
      for (const datasetId of datasetIds) {
        const result = await this.runBenchmark(modelId, datasetId);
        results.push(result);
      }
    }

    return this.generateComparisonReport(results);
  }

  private generateComparisonReport(results: BenchmarkResult[]): ComparisonReport {
    const modelIds = [...new Set(results.map(r => r.modelId))];
    const datasetIds = [...new Set(results.map(r => r.datasetId))];

    const metrics = this.compareMetrics(results);
    const rankings = this.rankModels(results);
    const recommendations = this.generateRecommendations(rankings);
    const visualizations = this.generateVisualizations(results);

    return {
      models: modelIds,
      datasets: datasetIds,
      metrics,
      rankings,
      recommendations,
      visualizations
    };
  }

  private compareMetrics(results: BenchmarkResult[]): MetricComparison[] {
    const comparisons: MetricComparison[] = [];
    const metricNames = new Set<string>();

    results.forEach(r => r.metrics.forEach(m => metricNames.add(m.name)));

    for (const metricName of metricNames) {
      const values = new Map<string, number>();

      for (const result of results) {
        const metric = result.metrics.find(m => m.name === metricName);
        if (metric) {
          values.set(result.modelId, metric.value);
        }
      }

      const sortedValues = Array.from(values.entries())
        .sort((a, b) => b[1] - a[1]);

      const winner = sortedValues[0][0];
      const difference = sortedValues[0][1] - (sortedValues[1]?.[1] || 0);

      comparisons.push({
        metric: metricName,
        values,
        winner,
        difference
      });
    }

    return comparisons;
  }

  private rankModels(results: BenchmarkResult[]): ModelRanking[] {
    const modelScores = new Map<string, number>();

    for (const result of results) {
      let score = 0;

      for (const metric of result.metrics) {
        const metricConfig = this.config.metrics.find(m => m.name === metric.name);
        if (metricConfig) {
          const normalizedValue = metricConfig.higherIsBetter
            ? metric.value
            : 1 - metric.value;

          score += normalizedValue * metricConfig.weight;
        }
      }

      modelScores.set(result.modelId, (modelScores.get(result.modelId) || 0) + score);
    }

    const rankings = Array.from(modelScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([modelId, score], index) => ({
        modelId,
        rank: index + 1,
        score,
        strengths: this.identifyStrengths(modelId, results),
        weaknesses: this.identifyWeaknesses(modelId, results)
      }));

    return rankings;
  }

  private identifyStrengths(modelId: string, results: BenchmarkResult[]): string[] {
    const strengths: string[] = [];
    const modelResults = results.filter(r => r.modelId === modelId);

    for (const result of modelResults) {
      if (result.summary.accuracy > 0.9) {
        strengths.push('High accuracy');
      }
      if (result.summary.avgLatency < 100) {
        strengths.push('Fast response time');
      }
      if (result.summary.avgQuality > 0.8) {
        strengths.push('High quality outputs');
      }
    }

    return [...new Set(strengths)];
  }

  private identifyWeaknesses(modelId: string, results: BenchmarkResult[]): string[] {
    const weaknesses: string[] = [];
    const modelResults = results.filter(r => r.modelId === modelId);

    for (const result of modelResults) {
      if (result.summary.accuracy < 0.7) {
        weaknesses.push('Lower accuracy');
      }
      if (result.summary.avgLatency > 500) {
        weaknesses.push('Slower response time');
      }
      if (result.summary.totalCost > 1) {
        weaknesses.push('Higher cost');
      }
    }

    return [...new Set(weaknesses)];
  }

  private generateRecommendations(rankings: ModelRanking[]): string[] {
    const recommendations: string[] = [];

    if (rankings.length > 0) {
      const topModel = rankings[0];
      recommendations.push(`Best overall model: ${topModel.modelId} (score: ${topModel.score.toFixed(2)})`);

      if (topModel.strengths.length > 0) {
        recommendations.push(`Strengths: ${topModel.strengths.join(', ')}`);
      }
    }

    return recommendations;
  }

  private generateVisualizations(results: BenchmarkResult[]): VisualizationData[] {
    return [
      {
        type: 'bar',
        data: this.prepareBarChartData(results),
        config: { title: 'Model Comparison' }
      },
      {
        type: 'scatter',
        data: this.prepareScatterData(results),
        config: { title: 'Latency vs Accuracy' }
      }
    ];
  }

  private prepareBarChartData(results: BenchmarkResult[]): any {
    return {
      labels: results.map(r => r.modelId),
      datasets: [{
        label: 'Accuracy',
        data: results.map(r => r.summary.accuracy)
      }]
    };
  }

  private prepareScatterData(results: BenchmarkResult[]): any {
    return {
      datasets: [{
        label: 'Models',
        data: results.map(r => ({
          x: r.summary.avgLatency,
          y: r.summary.accuracy
        }))
      }]
    };
  }

  public getResult(resultId: string): BenchmarkResult | null {
    return this.results.get(resultId) || null;
  }

  public listResults(): BenchmarkResult[] {
    return Array.from(this.results.values());
  }

  public exportResults(format: 'json' | 'csv'): string {
    const results = this.listResults();

    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }

    // CSV format
    const headers = ['Model', 'Dataset', 'Accuracy', 'Avg Latency', 'Total Cost', 'Quality'];
    const rows = results.map(r => [
      r.modelId,
      r.datasetId,
      r.summary.accuracy,
      r.summary.avgLatency,
      r.summary.totalCost,
      r.summary.avgQuality
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export default ModelBenchmark;
