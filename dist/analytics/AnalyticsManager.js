"use strict";
/**
 * Advanced Analytics & Reporting System
 * Real-time analytics, custom dashboards, data visualization
 * Report generation, data aggregation, predictive analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsManager = void 0;
const events_1 = require("events");
// ============================================================================
// Analytics Manager
// ============================================================================
class AnalyticsManager extends events_1.EventEmitter {
    config;
    metrics = new Map();
    dashboards = new Map();
    reports = new Map();
    alerts = new Map();
    anomalies = [];
    predictions = new Map();
    insights = [];
    constructor(config = {}) {
        super();
        this.config = {
            enableRealTime: true,
            enablePredictive: true,
            retentionDays: 90,
            aggregationInterval: 60000, // 1 minute
            samplingRate: 1.0,
            ...config,
        };
        this.startAggregationLoop();
    }
    // ========================================================================
    // Metrics Collection
    // ========================================================================
    recordMetric(metric) {
        // Apply sampling
        if (Math.random() > this.config.samplingRate) {
            return;
        }
        const full = {
            ...metric,
            id: this.generateId(),
            timestamp: Date.now(),
        };
        if (!this.metrics.has(metric.name)) {
            this.metrics.set(metric.name, []);
        }
        this.metrics.get(metric.name).push(full);
        this.emit('metric:recorded', { metric: full });
        // Check for alerts
        this.checkAlerts(full);
        // Detect anomalies if enabled
        if (this.config.enablePredictive) {
            this.detectAnomalies(metric.name);
        }
    }
    incrementCounter(name, value = 1, tags = {}) {
        this.recordMetric({
            name,
            type: 'counter',
            value,
            tags,
        });
    }
    setGauge(name, value, tags = {}) {
        this.recordMetric({
            name,
            type: 'gauge',
            value,
            tags,
        });
    }
    recordHistogram(name, value, tags = {}) {
        this.recordMetric({
            name,
            type: 'histogram',
            value,
            tags,
        });
    }
    getMetrics(name, timeRange) {
        const metrics = this.metrics.get(name) || [];
        if (!timeRange) {
            return metrics;
        }
        return metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
    }
    // ========================================================================
    // Time Series Analysis
    // ========================================================================
    getTimeSeries(metric, timeRange, aggregation, interval) {
        const metrics = this.getMetrics(metric, timeRange);
        // Group by interval
        const buckets = new Map();
        for (const m of metrics) {
            const bucket = Math.floor(m.timestamp / interval) * interval;
            if (!buckets.has(bucket)) {
                buckets.set(bucket, []);
            }
            buckets.get(bucket).push(m);
        }
        // Aggregate each bucket
        const dataPoints = [];
        for (const [timestamp, bucketMetrics] of buckets.entries()) {
            const value = this.aggregate(bucketMetrics.map(m => m.value), aggregation);
            dataPoints.push({ timestamp, value });
        }
        return {
            id: this.generateId(),
            metric,
            dataPoints: dataPoints.sort((a, b) => a.timestamp - b.timestamp),
            aggregation,
            interval,
            startTime: timeRange.start,
            endTime: timeRange.end,
        };
    }
    aggregate(values, type) {
        if (values.length === 0)
            return 0;
        switch (type) {
            case 'sum':
                return values.reduce((sum, v) => sum + v, 0);
            case 'avg':
                return values.reduce((sum, v) => sum + v, 0) / values.length;
            case 'min':
                return Math.min(...values);
            case 'max':
                return Math.max(...values);
            case 'count':
                return values.length;
            case 'p50':
                return this.percentile(values, 0.5);
            case 'p95':
                return this.percentile(values, 0.95);
            case 'p99':
                return this.percentile(values, 0.99);
            default:
                return 0;
        }
    }
    percentile(values, p) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[index] || 0;
    }
    // ========================================================================
    // Dashboard Management
    // ========================================================================
    async createDashboard(dashboard) {
        const full = {
            ...dashboard,
            id: this.generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.dashboards.set(full.id, full);
        this.emit('dashboard:created', { dashboard: full });
        return full;
    }
    async updateDashboard(dashboardId, updates) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        Object.assign(dashboard, updates);
        dashboard.updatedAt = Date.now();
        this.emit('dashboard:updated', { dashboard });
        return dashboard;
    }
    async deleteDashboard(dashboardId) {
        this.dashboards.delete(dashboardId);
        this.emit('dashboard:deleted', { dashboardId });
    }
    getDashboard(dashboardId) {
        return this.dashboards.get(dashboardId);
    }
    listDashboards() {
        return Array.from(this.dashboards.values());
    }
    async renderDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        const widgetData = {};
        for (const widget of dashboard.widgets) {
            widgetData[widget.id] = await this.renderWidget(widget);
        }
        return {
            dashboard,
            widgetData,
            lastUpdated: Date.now(),
        };
    }
    async renderWidget(widget) {
        const data = [];
        for (const metricName of widget.config.metrics) {
            const timeSeries = this.getTimeSeries(metricName, widget.config.timeRange, widget.config.aggregation, this.config.aggregationInterval);
            data.push({
                metric: metricName,
                data: timeSeries.dataPoints,
            });
        }
        return {
            type: widget.type,
            title: widget.title,
            data,
        };
    }
    // ========================================================================
    // Report Generation
    // ========================================================================
    async createReport(report) {
        const full = {
            ...report,
            id: this.generateId(),
        };
        this.reports.set(full.id, full);
        if (full.schedule) {
            this.scheduleReport(full);
        }
        this.emit('report:created', { report: full });
        return full;
    }
    async generateReport(reportId) {
        const report = this.reports.get(reportId);
        if (!report) {
            throw new Error(`Report not found: ${reportId}`);
        }
        this.emit('report:generate:start', { report });
        const sections = [];
        for (const section of report.sections) {
            const content = await this.generateReportSection(section, report);
            sections.push({
                ...section,
                generatedContent: content,
            });
        }
        const generated = {
            id: this.generateId(),
            reportId: report.id,
            name: report.name,
            format: report.format,
            sections,
            generatedAt: Date.now(),
            parameters: report.parameters,
        };
        report.lastGenerated = generated.generatedAt;
        this.emit('report:generated', { report: generated });
        return generated;
    }
    async generateReportSection(section, report) {
        switch (section.type) {
            case 'chart':
                return this.generateChartSection(section);
            case 'table':
                return this.generateTableSection(section);
            case 'metrics':
                return this.generateMetricsSection(section);
            case 'insights':
                return this.generateInsightsSection();
            case 'text':
                return section.content;
            default:
                return null;
        }
    }
    async generateChartSection(section) {
        // Generate chart data
        return {
            type: 'chart',
            data: [],
        };
    }
    async generateTableSection(section) {
        // Generate table data
        return {
            type: 'table',
            rows: [],
        };
    }
    async generateMetricsSection(section) {
        // Generate metrics summary
        const summaries = [];
        for (const [name, metrics] of this.metrics.entries()) {
            const values = metrics.map(m => m.value);
            summaries.push({
                metric: name,
                count: values.length,
                sum: this.aggregate(values, 'sum'),
                avg: this.aggregate(values, 'avg'),
                min: this.aggregate(values, 'min'),
                max: this.aggregate(values, 'max'),
            });
        }
        return {
            type: 'metrics',
            summaries,
        };
    }
    async generateInsightsSection() {
        return {
            type: 'insights',
            insights: this.insights.slice(0, 10),
        };
    }
    scheduleReport(report) {
        // Schedule report generation
        // In production: use node-cron or similar
    }
    // ========================================================================
    // Alerts
    // ========================================================================
    async createAlert(alert) {
        const full = {
            ...alert,
            id: this.generateId(),
            triggerCount: 0,
        };
        this.alerts.set(full.id, full);
        this.emit('alert:created', { alert: full });
        return full;
    }
    checkAlerts(metric) {
        for (const alert of this.alerts.values()) {
            if (!alert.enabled || alert.condition.metric !== metric.name) {
                continue;
            }
            const shouldTrigger = this.evaluateAlertCondition(alert.condition, metric);
            if (shouldTrigger) {
                this.triggerAlert(alert, metric);
            }
        }
    }
    evaluateAlertCondition(condition, metric) {
        const { operator, threshold } = condition;
        switch (operator) {
            case 'gt':
                return metric.value > threshold;
            case 'gte':
                return metric.value >= threshold;
            case 'lt':
                return metric.value < threshold;
            case 'lte':
                return metric.value <= threshold;
            case 'eq':
                return metric.value === threshold;
            case 'neq':
                return metric.value !== threshold;
            default:
                return false;
        }
    }
    async triggerAlert(alert, metric) {
        alert.lastTriggered = Date.now();
        alert.triggerCount++;
        this.emit('alert:triggered', { alert, metric });
        // Send notifications through channels
        for (const channel of alert.channels) {
            await this.sendAlertNotification(alert, metric, channel);
        }
    }
    async sendAlertNotification(alert, metric, channel) {
        this.emit('alert:notification:sent', { alert, channel });
    }
    // ========================================================================
    // Anomaly Detection
    // ========================================================================
    detectAnomalies(metricName) {
        const metrics = this.metrics.get(metricName) || [];
        if (metrics.length < 30)
            return; // Need enough data
        const recent = metrics.slice(-30);
        const values = recent.map(m => m.value);
        const mean = this.aggregate(values, 'avg');
        const stdDev = this.standardDeviation(values);
        const latest = metrics[metrics.length - 1];
        const deviation = Math.abs(latest.value - mean) / stdDev;
        if (deviation > 3) {
            // 3-sigma rule
            const anomaly = {
                id: this.generateId(),
                metric: metricName,
                timestamp: latest.timestamp,
                expectedValue: mean,
                actualValue: latest.value,
                deviation,
                confidence: Math.min(deviation / 5, 1),
                severity: deviation > 5 ? 'high' : deviation > 4 ? 'medium' : 'low',
            };
            this.anomalies.push(anomaly);
            this.emit('anomaly:detected', { anomaly });
            // Generate insight
            this.generateInsight({
                type: 'anomaly',
                title: `Anomaly detected in ${metricName}`,
                description: `Value ${latest.value} deviates significantly from expected ${mean.toFixed(2)}`,
                confidence: anomaly.confidence,
                impact: anomaly.severity,
                actionable: true,
                actions: ['Investigate cause', 'Review recent changes'],
            });
        }
    }
    standardDeviation(values) {
        const mean = this.aggregate(values, 'avg');
        const squareDiffs = values.map(v => Math.pow(v - mean, 2));
        const avgSquareDiff = this.aggregate(squareDiffs, 'avg');
        return Math.sqrt(avgSquareDiff);
    }
    getAnomalies(metricName) {
        if (metricName) {
            return this.anomalies.filter(a => a.metric === metricName);
        }
        return this.anomalies;
    }
    // ========================================================================
    // Predictive Analytics
    // ========================================================================
    async predict(metricName, horizon) {
        const metrics = this.metrics.get(metricName) || [];
        if (metrics.length < 10) {
            throw new Error('Not enough data for prediction');
        }
        const predictions = [];
        const values = metrics.map(m => m.value);
        // Simple linear regression for prediction
        const { slope, intercept } = this.linearRegression(values);
        for (let i = 1; i <= horizon; i++) {
            const timestamp = Date.now() + i * this.config.aggregationInterval;
            const x = values.length + i;
            const predictedValue = slope * x + intercept;
            // Calculate confidence interval (simplified)
            const stdDev = this.standardDeviation(values);
            const confidence = Math.max(0, 1 - (stdDev / Math.abs(predictedValue)));
            predictions.push({
                id: this.generateId(),
                metric: metricName,
                timestamp,
                predictedValue,
                confidence,
                upperBound: predictedValue + 2 * stdDev,
                lowerBound: predictedValue - 2 * stdDev,
                algorithm: 'linear_regression',
            });
        }
        this.predictions.set(metricName, predictions);
        this.emit('predictions:generated', { metric: metricName, predictions });
        return predictions;
    }
    linearRegression(values) {
        const n = values.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumXX += i * i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
    }
    getPredictions(metricName) {
        return this.predictions.get(metricName) || [];
    }
    // ========================================================================
    // Insights Generation
    // ========================================================================
    generateInsight(insight) {
        const full = {
            ...insight,
            id: this.generateId(),
            timestamp: Date.now(),
        };
        this.insights.push(full);
        this.emit('insight:generated', { insight: full });
        // Keep only last 100 insights
        if (this.insights.length > 100) {
            this.insights = this.insights.slice(-100);
        }
    }
    getInsights(type) {
        if (type) {
            return this.insights.filter(i => i.type === type);
        }
        return this.insights;
    }
    // ========================================================================
    // Data Aggregation
    // ========================================================================
    startAggregationLoop() {
        setInterval(() => {
            this.performAggregation();
        }, this.config.aggregationInterval);
    }
    performAggregation() {
        for (const [metricName, metrics] of this.metrics.entries()) {
            const timeRange = {
                start: Date.now() - this.config.aggregationInterval,
                end: Date.now(),
            };
            const recentMetrics = this.getMetrics(metricName, timeRange);
            if (recentMetrics.length === 0)
                continue;
            const values = recentMetrics.map(m => m.value);
            const aggregation = {
                id: this.generateId(),
                metric: metricName,
                aggregations: {
                    sum: this.aggregate(values, 'sum'),
                    avg: this.aggregate(values, 'avg'),
                    min: this.aggregate(values, 'min'),
                    max: this.aggregate(values, 'max'),
                    count: this.aggregate(values, 'count'),
                    p50: this.aggregate(values, 'p50'),
                    p95: this.aggregate(values, 'p95'),
                    p99: this.aggregate(values, 'p99'),
                },
                timeRange,
                sampleSize: values.length,
            };
            this.emit('aggregation:completed', { aggregation });
        }
        // Cleanup old metrics
        this.cleanupOldMetrics();
    }
    cleanupOldMetrics() {
        const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
        for (const [name, metrics] of this.metrics.entries()) {
            const filtered = metrics.filter(m => m.timestamp > cutoff);
            this.metrics.set(name, filtered);
        }
    }
    // ========================================================================
    // Correlation Analysis
    // ========================================================================
    calculateCorrelation(metric1, metric2) {
        const m1 = this.metrics.get(metric1) || [];
        const m2 = this.metrics.get(metric2) || [];
        if (m1.length === 0 || m2.length === 0)
            return 0;
        const minLength = Math.min(m1.length, m2.length);
        const values1 = m1.slice(-minLength).map(m => m.value);
        const values2 = m2.slice(-minLength).map(m => m.value);
        return this.pearsonCorrelation(values1, values2);
    }
    pearsonCorrelation(x, y) {
        const n = x.length;
        const meanX = this.aggregate(x, 'avg');
        const meanY = this.aggregate(y, 'avg');
        let numerator = 0;
        let denomX = 0;
        let denomY = 0;
        for (let i = 0; i < n; i++) {
            const diffX = x[i] - meanX;
            const diffY = y[i] - meanY;
            numerator += diffX * diffY;
            denomX += diffX * diffX;
            denomY += diffY * diffY;
        }
        return numerator / Math.sqrt(denomX * denomY);
    }
    // ========================================================================
    // Statistics
    // ========================================================================
    getStats() {
        const totalMetrics = Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0);
        return {
            totalMetrics,
            uniqueMetricNames: this.metrics.size,
            dashboards: this.dashboards.size,
            reports: this.reports.size,
            alerts: this.alerts.size,
            activeAlerts: Array.from(this.alerts.values()).filter(a => a.enabled).length,
            anomalies: this.anomalies.length,
            insights: this.insights.length,
        };
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    generateId() {
        return `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.AnalyticsManager = AnalyticsManager;
// ============================================================================
// Export
// ============================================================================
exports.default = AnalyticsManager;
