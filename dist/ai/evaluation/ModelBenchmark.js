"use strict";
/**
 * ModelBenchmark - Automated model benchmarking and comparison
 * Performance comparison, cost analysis, and quality metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelBenchmark = void 0;
const events_1 = require("events");
class ModelBenchmark extends events_1.EventEmitter {
    config;
    results = new Map();
    running = new Set();
    cache = new Map();
    constructor(config) {
        super();
        this.config = config;
    }
    async runBenchmark(modelId, datasetId) {
        const model = this.config.models.find(m => m.id === modelId);
        const dataset = this.config.datasets.find(d => d.id === datasetId);
        if (!model)
            throw new Error(`Model ${modelId} not found`);
        if (!dataset)
            throw new Error(`Dataset ${datasetId} not found`);
        const resultId = `${modelId}_${datasetId}_${Date.now()}`;
        this.running.add(resultId);
        const result = {
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
                }
                catch (error) {
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
        }
        catch (error) {
            this.emit('benchmark:failed', { resultId, error });
            throw error;
        }
        finally {
            this.running.delete(resultId);
        }
    }
    async benchmarkSample(model, sample) {
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
    async executeSample(model, sample) {
        const cacheKey = `${model.id}_${sample.id}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
        const output = `Generated response for: ${sample.input}`;
        this.cache.set(cacheKey, output);
        return output;
    }
    countTokens(text) {
        return Math.ceil(text.length / 4);
    }
    evaluateCorrectness(output, expected) {
        const normalizedOutput = output.toLowerCase().trim();
        const normalizedExpected = expected.toLowerCase().trim();
        return normalizedOutput.includes(normalizedExpected) ||
            normalizedExpected.includes(normalizedOutput);
    }
    evaluateQuality(output, sample) {
        let score = 0.5;
        if (output.length > 10)
            score += 0.1;
        if (output.length > 50)
            score += 0.1;
        if (/^[A-Z]/.test(output))
            score += 0.1;
        if (/[.!?]$/.test(output))
            score += 0.1;
        if (sample.expectedOutput && output.includes(sample.expectedOutput))
            score += 0.1;
        return Math.min(1.0, score);
    }
    calculateMetrics(samples) {
        const metrics = [];
        for (const metricConfig of this.config.metrics) {
            let value;
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
    getMetricUnit(type) {
        switch (type) {
            case 'accuracy': return '%';
            case 'latency': return 'ms';
            case 'cost': return '$';
            case 'quality': return 'score';
            default: return '';
        }
    }
    calculateSummary(result) {
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
    initializeSummary() {
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
    async runComparison(modelIds, datasetIds) {
        const results = [];
        for (const modelId of modelIds) {
            for (const datasetId of datasetIds) {
                const result = await this.runBenchmark(modelId, datasetId);
                results.push(result);
            }
        }
        return this.generateComparisonReport(results);
    }
    generateComparisonReport(results) {
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
    compareMetrics(results) {
        const comparisons = [];
        const metricNames = new Set();
        results.forEach(r => r.metrics.forEach(m => metricNames.add(m.name)));
        for (const metricName of metricNames) {
            const values = new Map();
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
    rankModels(results) {
        const modelScores = new Map();
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
    identifyStrengths(modelId, results) {
        const strengths = [];
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
    identifyWeaknesses(modelId, results) {
        const weaknesses = [];
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
    generateRecommendations(rankings) {
        const recommendations = [];
        if (rankings.length > 0) {
            const topModel = rankings[0];
            recommendations.push(`Best overall model: ${topModel.modelId} (score: ${topModel.score.toFixed(2)})`);
            if (topModel.strengths.length > 0) {
                recommendations.push(`Strengths: ${topModel.strengths.join(', ')}`);
            }
        }
        return recommendations;
    }
    generateVisualizations(results) {
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
    prepareBarChartData(results) {
        return {
            labels: results.map(r => r.modelId),
            datasets: [{
                    label: 'Accuracy',
                    data: results.map(r => r.summary.accuracy)
                }]
        };
    }
    prepareScatterData(results) {
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
    getResult(resultId) {
        return this.results.get(resultId) || null;
    }
    listResults() {
        return Array.from(this.results.values());
    }
    exportResults(format) {
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
exports.ModelBenchmark = ModelBenchmark;
exports.default = ModelBenchmark;
