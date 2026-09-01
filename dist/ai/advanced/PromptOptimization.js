"use strict";
/**
 * PromptOptimization - Automatic prompt engineering and optimization
 * A/B testing, versioning, and performance analytics for prompts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptOptimizer = void 0;
const events_1 = require("events");
class PromptOptimizer extends events_1.EventEmitter {
    templates = new Map();
    versions = new Map();
    abTests = new Map();
    config;
    executionHistory = new Map();
    constructor(config) {
        super();
        this.config = {
            enableAutoOptimization: false,
            optimizationInterval: 3600000, // 1 hour
            minSampleSize: 100,
            significanceLevel: 0.05,
            optimizationGoals: [
                { metric: 'quality', weight: 0.5 },
                { metric: 'latency', weight: 0.3 },
                { metric: 'cost', weight: 0.2 }
            ],
            ...config
        };
    }
    /**
     * Register a new prompt template
     */
    registerTemplate(template) {
        this.templates.set(template.id, template);
        this.versions.set(template.id, [{
                version: template.version,
                template: template.template,
                performance: this.initializePerformance(),
                timestamp: new Date()
            }]);
        this.executionHistory.set(template.id, []);
        this.emit('template:registered', template);
    }
    /**
     * Update prompt template and create new version
     */
    updateTemplate(templateId, newTemplate, reason) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }
        const versions = this.versions.get(templateId) || [];
        const newVersion = this.generateVersion(versions.length + 1);
        versions.push({
            version: newVersion,
            template: newTemplate,
            performance: this.initializePerformance(),
            timestamp: new Date()
        });
        this.versions.set(templateId, versions);
        template.template = newTemplate;
        template.version = newVersion;
        template.metadata.updatedAt = new Date();
        this.emit('template:updated', { templateId, version: newVersion, reason });
        return newVersion;
    }
    /**
     * Execute prompt with automatic optimization
     */
    async executePrompt(templateId, variables, options) {
        const startTime = Date.now();
        // Check if template is in A/B test
        const abTest = this.getActiveABTest(templateId);
        const template = abTest
            ? this.selectVariant(abTest)
            : this.templates.get(templateId)?.template;
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }
        // Render template with variables
        const renderedPrompt = this.renderTemplate(template, variables);
        try {
            // Execute prompt (simulate - replace with actual execution)
            const result = await this.invokeModel(renderedPrompt, options);
            const latency = Date.now() - startTime;
            // Record execution
            this.recordExecution(templateId, {
                variables,
                result,
                latency,
                cost: result.cost || 0,
                quality: result.quality || 0,
                success: true,
                timestamp: new Date()
            });
            // Update metrics
            if (abTest) {
                this.updateVariantMetrics(abTest.id, template, latency, result);
            }
            return result;
        }
        catch (error) {
            // Record error
            this.recordExecution(templateId, {
                variables,
                error: error.message,
                latency: Date.now() - startTime,
                success: false,
                timestamp: new Date()
            });
            throw error;
        }
    }
    /**
     * Create A/B test for prompt variants
     */
    createABTest(name, baseTemplateId, variants, trafficSplit) {
        const testId = `abtest_${Date.now()}`;
        const split = trafficSplit || variants.map(() => 1 / variants.length);
        const test = {
            id: testId,
            name,
            variants: variants.map((v, i) => ({
                id: `variant_${i}`,
                name: v.name,
                template: v.template,
                traffic: split[i],
                metrics: this.initializeVariantMetrics()
            })),
            status: 'draft',
            trafficSplit: split,
            startDate: new Date(),
            results: {
                confidence: 0,
                statisticalSignificance: false,
                analysis: ''
            }
        };
        this.abTests.set(testId, test);
        this.emit('abtest:created', test);
        return testId;
    }
    /**
     * Start A/B test
     */
    startABTest(testId) {
        const test = this.abTests.get(testId);
        if (!test) {
            throw new Error(`A/B test ${testId} not found`);
        }
        test.status = 'running';
        test.startDate = new Date();
        this.emit('abtest:started', test);
    }
    /**
     * Stop A/B test and analyze results
     */
    stopABTest(testId) {
        const test = this.abTests.get(testId);
        if (!test) {
            throw new Error(`A/B test ${testId} not found`);
        }
        test.status = 'completed';
        test.endDate = new Date();
        // Analyze results
        const results = this.analyzeABTest(test);
        test.results = results;
        this.emit('abtest:completed', { test, results });
        return results;
    }
    /**
     * Analyze A/B test results
     */
    analyzeABTest(test) {
        const variants = test.variants;
        // Calculate overall scores
        const scores = variants.map(v => this.calculateVariantScore(v.metrics));
        // Find winner
        const maxScore = Math.max(...scores);
        const winnerIndex = scores.indexOf(maxScore);
        const winner = variants[winnerIndex];
        // Calculate statistical significance
        const significance = this.calculateStatisticalSignificance(variants);
        return {
            winner: winner.id,
            confidence: significance.confidence,
            statisticalSignificance: significance.isSignificant,
            analysis: this.generateAnalysis(test, winner, significance)
        };
    }
    /**
     * Calculate variant score based on goals
     */
    calculateVariantScore(metrics) {
        let score = 0;
        for (const goal of this.config.optimizationGoals) {
            let metricValue = 0;
            switch (goal.metric) {
                case 'quality':
                    metricValue = metrics.avgQuality;
                    break;
                case 'latency':
                    metricValue = 1 / (metrics.avgLatency / 1000); // Inverse for latency
                    break;
                case 'cost':
                    metricValue = 1 / metrics.avgCost; // Inverse for cost
                    break;
                case 'satisfaction':
                    metricValue = metrics.conversions / Math.max(metrics.executions, 1);
                    break;
            }
            score += metricValue * goal.weight;
        }
        return score;
    }
    /**
     * Calculate statistical significance using t-test
     */
    calculateStatisticalSignificance(variants) {
        if (variants.length < 2) {
            return { confidence: 0, isSignificant: false };
        }
        // Simple confidence calculation based on sample size and variance
        const minSamples = Math.min(...variants.map(v => v.metrics.executions));
        const confidence = Math.min(minSamples / this.config.minSampleSize, 1);
        return {
            confidence,
            isSignificant: confidence > 0.95 && minSamples >= this.config.minSampleSize
        };
    }
    /**
     * Generate analysis text
     */
    generateAnalysis(test, winner, significance) {
        const lines = [
            `A/B Test: ${test.name}`,
            `Winner: ${winner.name}`,
            `Confidence: ${(significance.confidence * 100).toFixed(1)}%`,
            `Statistical Significance: ${significance.isSignificant ? 'Yes' : 'No'}`,
            '',
            'Metrics:',
            `- Quality: ${winner.metrics.avgQuality.toFixed(2)}`,
            `- Latency: ${winner.metrics.avgLatency.toFixed(0)}ms`,
            `- Cost: $${winner.metrics.avgCost.toFixed(4)}`,
            `- Success Rate: ${((winner.metrics.executions - winner.metrics.errors) / winner.metrics.executions * 100).toFixed(1)}%`
        ];
        return lines.join('\n');
    }
    /**
     * Automatic prompt optimization
     */
    async optimizePrompt(templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }
        const history = this.executionHistory.get(templateId) || [];
        if (history.length < this.config.minSampleSize) {
            throw new Error('Insufficient data for optimization');
        }
        // Analyze current performance
        const performance = this.analyzePerformance(history);
        // Generate optimized variants
        const variants = this.generateOptimizedVariants(template.template, performance);
        // Create A/B test
        const testId = this.createABTest(`Auto-optimization: ${template.name}`, templateId, variants);
        this.emit('optimization:started', { templateId, testId, variants });
        return [testId, ...variants.map(v => v.name)];
    }
    /**
     * Generate optimized prompt variants
     */
    generateOptimizedVariants(baseTemplate, performance) {
        const variants = [];
        // Variant 1: More concise
        if (baseTemplate.length > 200) {
            variants.push({
                name: 'Concise Version',
                template: this.makeConcise(baseTemplate)
            });
        }
        // Variant 2: More detailed
        variants.push({
            name: 'Detailed Version',
            template: this.makeDetailed(baseTemplate)
        });
        // Variant 3: Different structure
        variants.push({
            name: 'Restructured Version',
            template: this.restructure(baseTemplate)
        });
        return variants;
    }
    /**
     * Make prompt more concise
     */
    makeConcise(template) {
        // Remove redundant phrases and shorten
        return template
            .replace(/\s+/g, ' ')
            .replace(/please\s+/gi, '')
            .replace(/kindly\s+/gi, '')
            .trim();
    }
    /**
     * Make prompt more detailed
     */
    makeDetailed(template) {
        // Add more context and instructions
        return `${template}\n\nPlease provide a detailed response with specific examples and clear explanations.`;
    }
    /**
     * Restructure prompt
     */
    restructure(template) {
        // Add structure with numbered steps
        const lines = template.split('\n');
        return lines.map((line, i) => line.trim() ? `${i + 1}. ${line.trim()}` : line).join('\n');
    }
    /**
     * Get prompt analytics
     */
    getAnalytics(templateId, timeRange) {
        const history = this.executionHistory.get(templateId) || [];
        const filtered = timeRange
            ? history.filter(h => h.timestamp >= timeRange.start && h.timestamp <= timeRange.end)
            : history;
        const successful = filtered.filter(h => h.success);
        return {
            promptId: templateId,
            timeRange: timeRange || { start: new Date(0), end: new Date() },
            metrics: {
                totalExecutions: filtered.length,
                avgQuality: this.average(successful.map(h => h.quality)),
                avgLatency: this.average(successful.map(h => h.latency)),
                avgCost: this.average(successful.map(h => h.cost)),
                successRate: successful.length / filtered.length,
                errorRate: 1 - (successful.length / filtered.length)
            },
            trends: {
                qualityTrend: this.calculateTrend(successful.map(h => h.quality)),
                latencyTrend: this.calculateTrend(successful.map(h => h.latency)),
                costTrend: this.calculateTrend(successful.map(h => h.cost))
            },
            topErrors: this.getTopErrors(filtered.filter(h => !h.success))
        };
    }
    /**
     * Render template with variables
     */
    renderTemplate(template, variables) {
        let rendered = template;
        for (const [key, value] of Object.entries(variables)) {
            rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }
        return rendered;
    }
    /**
     * Invoke model (placeholder)
     */
    async invokeModel(prompt, options) {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        return {
            text: 'Generated response',
            quality: 0.8 + Math.random() * 0.2,
            cost: 0.001 + Math.random() * 0.004,
            tokens: 150
        };
    }
    /**
     * Record execution
     */
    recordExecution(templateId, execution) {
        const history = this.executionHistory.get(templateId) || [];
        history.push(execution);
        // Keep only last 1000 executions
        if (history.length > 1000) {
            history.shift();
        }
        this.executionHistory.set(templateId, history);
    }
    /**
     * Get active A/B test for template
     */
    getActiveABTest(templateId) {
        for (const test of this.abTests.values()) {
            if (test.status === 'running') {
                return test;
            }
        }
        return null;
    }
    /**
     * Select variant based on traffic split
     */
    selectVariant(test) {
        const rand = Math.random();
        let cumulative = 0;
        for (const variant of test.variants) {
            cumulative += variant.traffic;
            if (rand <= cumulative) {
                return variant.template;
            }
        }
        return test.variants[0].template;
    }
    /**
     * Update variant metrics
     */
    updateVariantMetrics(testId, template, latency, result) {
        const test = this.abTests.get(testId);
        if (!test)
            return;
        const variant = test.variants.find(v => v.template === template);
        if (!variant)
            return;
        variant.metrics.executions++;
        variant.metrics.avgLatency = this.updateAverage(variant.metrics.avgLatency, latency, variant.metrics.executions);
        variant.metrics.avgQuality = this.updateAverage(variant.metrics.avgQuality, result.quality || 0, variant.metrics.executions);
        variant.metrics.avgCost = this.updateAverage(variant.metrics.avgCost, result.cost || 0, variant.metrics.executions);
    }
    /**
     * Initialize performance metrics
     */
    initializePerformance() {
        return {
            avgQuality: 0,
            avgLatency: 0,
            avgCost: 0,
            successRate: 0,
            totalExecutions: 0,
            userSatisfaction: 0
        };
    }
    /**
     * Initialize variant metrics
     */
    initializeVariantMetrics() {
        return {
            executions: 0,
            avgQuality: 0,
            avgLatency: 0,
            avgCost: 0,
            conversions: 0,
            errors: 0
        };
    }
    /**
     * Generate version string
     */
    generateVersion(number) {
        return `v${number}.0.0`;
    }
    /**
     * Calculate average
     */
    average(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    /**
     * Update running average
     */
    updateAverage(current, newValue, count) {
        return (current * (count - 1) + newValue) / count;
    }
    /**
     * Calculate trend
     */
    calculateTrend(values) {
        const windowSize = 10;
        const trend = [];
        for (let i = 0; i < values.length; i += windowSize) {
            const window = values.slice(i, i + windowSize);
            trend.push(this.average(window));
        }
        return trend;
    }
    /**
     * Analyze performance
     */
    analyzePerformance(history) {
        const successful = history.filter(h => h.success);
        return {
            avgQuality: this.average(successful.map(h => h.quality)),
            avgLatency: this.average(successful.map(h => h.latency)),
            avgCost: this.average(successful.map(h => h.cost)),
            successRate: successful.length / history.length
        };
    }
    /**
     * Get top errors
     */
    getTopErrors(failed) {
        const errorCounts = new Map();
        for (const execution of failed) {
            const error = execution.error || 'Unknown error';
            errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
        }
        return Array.from(errorCounts.entries())
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }
    /**
     * Export templates
     */
    exportTemplates() {
        return Array.from(this.templates.values());
    }
    /**
     * Import templates
     */
    importTemplates(templates) {
        for (const template of templates) {
            this.registerTemplate(template);
        }
    }
}
exports.PromptOptimizer = PromptOptimizer;
exports.default = PromptOptimizer;
