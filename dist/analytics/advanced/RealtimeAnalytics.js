"use strict";
/**
 * RealtimeAnalytics - Real-time stream processing and analytics
 * Live dashboards, event correlation, and real-time aggregation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeAnalytics = void 0;
const events_1 = require("events");
class RealtimeAnalytics extends events_1.EventEmitter {
    streams = new Map();
    queries = new Map();
    dashboards = new Map();
    alerts = new Map();
    aggregations = new Map();
    windowSize = 60000; // 1 minute
    constructor(windowSize = 60000) {
        super();
        this.windowSize = windowSize;
        this.startProcessing();
    }
    /**
     * Ingest stream event
     */
    ingest(event) {
        const streamKey = event.type;
        if (!this.streams.has(streamKey)) {
            this.streams.set(streamKey, []);
        }
        this.streams.get(streamKey).push(event);
        this.emit('event:ingested', event);
        // Process event through queries
        this.processEvent(event);
        // Check alerts
        this.checkAlerts(event);
        // Clean old events
        this.cleanOldEvents(streamKey);
    }
    /**
     * Process event through registered queries
     */
    processEvent(event) {
        for (const query of this.queries.values()) {
            // Apply filter
            if (query.filter && !query.filter(event)) {
                continue;
            }
            // Apply map
            let processedData = query.map ? query.map(event) : event.data;
            // Apply window aggregation
            if (query.window) {
                this.aggregateInWindow(query, event);
            }
            this.emit('query:processed', { queryId: query.id, event, result: processedData });
        }
    }
    /**
     * Aggregate event in time window
     */
    aggregateInWindow(query, event) {
        const windowKey = `${query.id}:${this.getWindowKey(event.timestamp, query.window)}`;
        if (!this.aggregations.has(windowKey)) {
            this.aggregations.set(windowKey, []);
        }
        const aggs = this.aggregations.get(windowKey);
        // Update aggregations
        if (typeof event.data === 'number') {
            const existing = aggs.find(a => a.metric === query.name);
            if (existing) {
                existing.count++;
                existing.sum += event.data;
                existing.avg = existing.sum / existing.count;
                existing.min = Math.min(existing.min, event.data);
                existing.max = Math.max(existing.max, event.data);
                existing.value = event.data;
            }
            else {
                aggs.push({
                    metric: query.name,
                    value: event.data,
                    count: 1,
                    min: event.data,
                    max: event.data,
                    avg: event.data,
                    sum: event.data,
                    timestamp: event.timestamp
                });
            }
        }
    }
    /**
     * Get window key for event
     */
    getWindowKey(timestamp, window) {
        const time = timestamp.getTime();
        switch (window.type) {
            case 'tumbling':
                return Math.floor(time / window.duration).toString();
            case 'sliding':
                return Math.floor(time / (window.duration / 2)).toString();
            case 'session':
                return timestamp.toISOString().substring(0, 16); // Minute precision
            default:
                return Math.floor(time / window.duration).toString();
        }
    }
    /**
     * Register stream query
     */
    registerQuery(query) {
        this.queries.set(query.id, query);
        this.emit('query:registered', query);
    }
    /**
     * Execute ad-hoc query
     */
    query(streamType, filter, timeRange) {
        const events = this.streams.get(streamType) || [];
        let filtered = events;
        // Apply time range filter
        if (timeRange) {
            filtered = filtered.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);
        }
        // Apply custom filter
        if (filter) {
            filtered = filtered.filter(filter);
        }
        return filtered;
    }
    /**
     * Calculate metric aggregations
     */
    aggregate(streamType, metric, operation, groupBy, timeRange) {
        const events = this.query(streamType, undefined, timeRange);
        const groups = new Map();
        // Group events
        for (const event of events) {
            const key = groupBy ? event.data[groupBy] || 'unknown' : 'all';
            const value = event.data[metric];
            if (typeof value === 'number') {
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(value);
            }
        }
        // Calculate aggregation
        const result = new Map();
        for (const [key, values] of groups) {
            let aggregated;
            switch (operation) {
                case 'sum':
                    aggregated = values.reduce((sum, v) => sum + v, 0);
                    break;
                case 'avg':
                    aggregated = values.reduce((sum, v) => sum + v, 0) / values.length;
                    break;
                case 'min':
                    aggregated = Math.min(...values);
                    break;
                case 'max':
                    aggregated = Math.max(...values);
                    break;
                case 'count':
                    aggregated = values.length;
                    break;
                default:
                    aggregated = 0;
            }
            result.set(key, aggregated);
        }
        return result;
    }
    /**
     * Create dashboard
     */
    createDashboard(dashboard) {
        this.dashboards.set(dashboard.id, dashboard);
        this.emit('dashboard:created', dashboard);
        // Start auto-refresh
        this.startDashboardRefresh(dashboard.id);
    }
    /**
     * Update dashboard data
     */
    updateDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard)
            return;
        for (const widget of dashboard.widgets) {
            widget.data = this.executeWidgetQuery(widget);
        }
        dashboard.lastUpdated = new Date();
        this.emit('dashboard:updated', dashboard);
    }
    /**
     * Execute widget query
     */
    executeWidgetQuery(widget) {
        // Parse and execute query (simplified)
        const query = widget.query;
        if (query.includes('count')) {
            const streamType = query.match(/from\s+(\w+)/)?.[1] || '';
            const events = this.streams.get(streamType) || [];
            return { count: events.length };
        }
        if (query.includes('avg') || query.includes('sum')) {
            const streamType = query.match(/from\s+(\w+)/)?.[1] || '';
            const metric = query.match(/(\w+)\s+from/)?.[1] || '';
            const operation = query.includes('avg') ? 'avg' : 'sum';
            const result = this.aggregate(streamType, metric, operation);
            return Object.fromEntries(result);
        }
        return {};
    }
    /**
     * Start dashboard auto-refresh
     */
    startDashboardRefresh(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard)
            return;
        setInterval(() => {
            this.updateDashboard(dashboardId);
        }, dashboard.refreshInterval);
    }
    /**
     * Register alert
     */
    registerAlert(alert) {
        this.alerts.set(alert.id, alert);
        this.emit('alert:registered', alert);
    }
    /**
     * Check alerts
     */
    checkAlerts(event) {
        for (const alert of this.alerts.values()) {
            if (!alert.enabled || alert.fired)
                continue;
            // Get recent aggregations
            const recentAggs = Array.from(this.aggregations.values())
                .flat()
                .filter(a => Date.now() - a.timestamp.getTime() < this.windowSize);
            // Check condition
            if (alert.condition(recentAggs)) {
                alert.fired = true;
                alert.lastFired = new Date();
                this.emit('alert:fired', { alert, event });
                // Auto-reset after cooldown
                setTimeout(() => {
                    alert.fired = false;
                }, 60000); // 1 minute cooldown
            }
        }
    }
    /**
     * Event correlation
     */
    correlate(streamType1, streamType2, correlationKey, timeWindow = 5000) {
        const events1 = this.streams.get(streamType1) || [];
        const events2 = this.streams.get(streamType2) || [];
        const correlated = [];
        for (const e1 of events1) {
            for (const e2 of events2) {
                // Check correlation key match
                if (e1.data[correlationKey] === e2.data[correlationKey]) {
                    // Check time proximity
                    const timeDiff = Math.abs(e1.timestamp.getTime() - e2.timestamp.getTime());
                    if (timeDiff <= timeWindow) {
                        correlated.push({ event1: e1, event2: e2 });
                    }
                }
            }
        }
        return correlated;
    }
    /**
     * Pattern detection
     */
    detectPattern(streamType, pattern, timeWindow = 10000) {
        const events = this.streams.get(streamType) || [];
        const matches = [];
        for (let i = 0; i <= events.length - pattern.length; i++) {
            const candidate = events.slice(i, i + pattern.length);
            // Check if candidate matches pattern
            const isMatch = candidate.every((event, idx) => {
                const patternEvent = pattern[idx];
                return (event.type === patternEvent.type &&
                    this.matchesPattern(event.data, patternEvent.data));
            });
            // Check time window
            const timeSpan = candidate[candidate.length - 1].timestamp.getTime() -
                candidate[0].timestamp.getTime();
            if (isMatch && timeSpan <= timeWindow) {
                matches.push(candidate);
            }
        }
        return matches;
    }
    /**
     * Check if data matches pattern
     */
    matchesPattern(data, pattern) {
        if (typeof pattern !== 'object') {
            return data === pattern;
        }
        for (const key in pattern) {
            if (pattern[key] !== '*' && data[key] !== pattern[key]) {
                return false;
            }
        }
        return true;
    }
    /**
     * Calculate percentiles
     */
    percentile(streamType, metric, percentiles) {
        const events = this.streams.get(streamType) || [];
        const values = events
            .map(e => e.data[metric])
            .filter(v => typeof v === 'number')
            .sort((a, b) => a - b);
        const result = new Map();
        for (const p of percentiles) {
            const index = Math.ceil((p / 100) * values.length) - 1;
            result.set(p, values[Math.max(0, index)] || 0);
        }
        return result;
    }
    /**
     * Anomaly detection using Z-score
     */
    detectAnomalies(streamType, metric, threshold = 3) {
        const events = this.streams.get(streamType) || [];
        const values = events.map(e => e.data[metric]).filter(v => typeof v === 'number');
        // Calculate mean and std dev
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        // Find anomalies
        return events.filter(e => {
            const value = e.data[metric];
            if (typeof value !== 'number')
                return false;
            const zScore = Math.abs((value - mean) / stdDev);
            return zScore > threshold;
        });
    }
    /**
     * Clean old events
     */
    cleanOldEvents(streamKey) {
        const events = this.streams.get(streamKey);
        if (!events)
            return;
        const cutoff = Date.now() - this.windowSize * 10; // Keep 10 windows
        const filtered = events.filter(e => e.timestamp.getTime() > cutoff);
        this.streams.set(streamKey, filtered);
    }
    /**
     * Start processing loop
     */
    startProcessing() {
        setInterval(() => {
            // Clean old aggregations
            for (const [key, aggs] of this.aggregations) {
                const cutoff = Date.now() - this.windowSize * 2;
                const filtered = aggs.filter(a => a.timestamp.getTime() > cutoff);
                if (filtered.length === 0) {
                    this.aggregations.delete(key);
                }
                else {
                    this.aggregations.set(key, filtered);
                }
            }
        }, this.windowSize);
    }
    /**
     * Get stream statistics
     */
    getStatistics(streamType) {
        if (streamType) {
            const events = this.streams.get(streamType) || [];
            return {
                streamType,
                eventCount: events.length,
                oldestEvent: events[0]?.timestamp,
                newestEvent: events[events.length - 1]?.timestamp,
                eventsPerSecond: this.calculateRate(events)
            };
        }
        return {
            totalStreams: this.streams.size,
            totalEvents: Array.from(this.streams.values()).reduce((sum, events) => sum + events.length, 0),
            queries: this.queries.size,
            dashboards: this.dashboards.size,
            alerts: this.alerts.size,
            aggregations: this.aggregations.size
        };
    }
    /**
     * Calculate event rate
     */
    calculateRate(events) {
        if (events.length < 2)
            return 0;
        const timeSpan = events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime();
        return timeSpan > 0 ? (events.length / timeSpan) * 1000 : 0;
    }
    /**
     * Export stream data
     */
    exportStream(streamType, format) {
        const events = this.streams.get(streamType) || [];
        if (format === 'json') {
            return JSON.stringify(events, null, 2);
        }
        // CSV format
        if (events.length === 0)
            return '';
        const headers = ['id', 'timestamp', 'type', ...Object.keys(events[0].data)];
        const rows = events.map(e => [e.id, e.timestamp.toISOString(), e.type, ...Object.values(e.data)].join(','));
        return [headers.join(','), ...rows].join('\n');
    }
    /**
     * Get dashboard
     */
    getDashboard(dashboardId) {
        return this.dashboards.get(dashboardId) || null;
    }
    /**
     * List all dashboards
     */
    listDashboards() {
        return Array.from(this.dashboards.values());
    }
}
exports.RealtimeAnalytics = RealtimeAnalytics;
exports.default = RealtimeAnalytics;
