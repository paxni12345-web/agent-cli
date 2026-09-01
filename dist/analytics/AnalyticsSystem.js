"use strict";
/**
 * Analytics and Business Intelligence System
 * Data analytics, reporting, dashboards, and business metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.segmentManager = exports.dashboardManager = exports.reportGenerator = exports.analyticsEngine = exports.SegmentManager = exports.DashboardManager = exports.ReportGenerator = exports.TimeInterval = exports.AggregationType = exports.AnalyticsEngine = exports.WidgetType = exports.ScheduleFrequency = exports.ReportFormat = exports.RelativePeriod = exports.FilterOperator = exports.ReportType = void 0;
const EventBus_1 = require("../core/EventBus");
var ReportType;
(function (ReportType) {
    ReportType["Standard"] = "standard";
    ReportType["Custom"] = "custom";
    ReportType["Realtime"] = "realtime";
})(ReportType || (exports.ReportType = ReportType = {}));
var FilterOperator;
(function (FilterOperator) {
    FilterOperator["Equals"] = "eq";
    FilterOperator["NotEquals"] = "ne";
    FilterOperator["GreaterThan"] = "gt";
    FilterOperator["LessThan"] = "lt";
    FilterOperator["Contains"] = "contains";
    FilterOperator["In"] = "in";
})(FilterOperator || (exports.FilterOperator = FilterOperator = {}));
var RelativePeriod;
(function (RelativePeriod) {
    RelativePeriod["Today"] = "today";
    RelativePeriod["Yesterday"] = "yesterday";
    RelativePeriod["Last7Days"] = "last_7_days";
    RelativePeriod["Last30Days"] = "last_30_days";
    RelativePeriod["ThisMonth"] = "this_month";
    RelativePeriod["LastMonth"] = "last_month";
    RelativePeriod["ThisYear"] = "this_year";
})(RelativePeriod || (exports.RelativePeriod = RelativePeriod = {}));
var ReportFormat;
(function (ReportFormat) {
    ReportFormat["PDF"] = "pdf";
    ReportFormat["CSV"] = "csv";
    ReportFormat["Excel"] = "excel";
    ReportFormat["JSON"] = "json";
})(ReportFormat || (exports.ReportFormat = ReportFormat = {}));
var ScheduleFrequency;
(function (ScheduleFrequency) {
    ScheduleFrequency["Hourly"] = "hourly";
    ScheduleFrequency["Daily"] = "daily";
    ScheduleFrequency["Weekly"] = "weekly";
    ScheduleFrequency["Monthly"] = "monthly";
})(ScheduleFrequency || (exports.ScheduleFrequency = ScheduleFrequency = {}));
var WidgetType;
(function (WidgetType) {
    WidgetType["LineChart"] = "line_chart";
    WidgetType["BarChart"] = "bar_chart";
    WidgetType["PieChart"] = "pie_chart";
    WidgetType["Table"] = "table";
    WidgetType["ScoreCard"] = "score_card";
    WidgetType["Funnel"] = "funnel";
    WidgetType["Heatmap"] = "heatmap";
    WidgetType["Map"] = "map";
})(WidgetType || (exports.WidgetType = WidgetType = {}));
/**
 * Analytics Engine
 */
class AnalyticsEngine {
    events = [];
    metrics = new Map();
    maxEvents = 100000;
    /**
     * Track event
     */
    trackEvent(event) {
        const fullEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: new Date(),
        };
        this.events.push(fullEvent);
        // Maintain max size
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }
        EventBus_1.eventBus.emitSync('analytics.event_tracked', fullEvent, 'AnalyticsEngine');
    }
    /**
     * Track metric
     */
    trackMetric(metric) {
        const key = this.getMetricKey(metric.name, metric.dimensions);
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        this.metrics.get(key).push(metric);
        // Keep only last 10000 points per metric
        const metricData = this.metrics.get(key);
        if (metricData.length > 10000) {
            metricData.shift();
        }
        EventBus_1.eventBus.emitSync('analytics.metric_tracked', metric, 'AnalyticsEngine');
    }
    /**
     * Query events
     */
    queryEvents(query) {
        let events = [...this.events];
        // Filter by name
        if (query.name) {
            events = events.filter(e => e.name === query.name);
        }
        // Filter by category
        if (query.category) {
            events = events.filter(e => e.category === query.category);
        }
        // Filter by user
        if (query.userId) {
            events = events.filter(e => e.userId === query.userId);
        }
        // Filter by date range
        if (query.dateRange) {
            events = events.filter(e => e.timestamp >= query.dateRange.start &&
                e.timestamp <= query.dateRange.end);
        }
        // Filter by properties
        if (query.properties) {
            events = events.filter(e => Object.entries(query.properties).every(([key, value]) => e.properties[key] === value));
        }
        return events.slice(0, query.limit || 1000);
    }
    /**
     * Aggregate events
     */
    aggregateEvents(query, groupBy, aggregation) {
        const events = this.queryEvents(query);
        const groups = new Map();
        // Group events
        for (const event of events) {
            const key = groupBy.map(field => event.properties[field] || 'unknown').join('|');
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(event);
        }
        // Aggregate
        const results = [];
        for (const [key, groupEvents] of groups) {
            const dimensions = key.split('|');
            const dimensionValues = {};
            groupBy.forEach((field, i) => {
                dimensionValues[field] = dimensions[i];
            });
            let value;
            switch (aggregation) {
                case AggregationType.Count:
                    value = groupEvents.length;
                    break;
                case AggregationType.Sum:
                    value = groupEvents.reduce((sum, e) => sum + (e.properties.value || 0), 0);
                    break;
                case AggregationType.Average:
                    value =
                        groupEvents.reduce((sum, e) => sum + (e.properties.value || 0), 0) /
                            groupEvents.length;
                    break;
                case AggregationType.Min:
                    value = Math.min(...groupEvents.map(e => e.properties.value || 0));
                    break;
                case AggregationType.Max:
                    value = Math.max(...groupEvents.map(e => e.properties.value || 0));
                    break;
                default:
                    value = groupEvents.length;
            }
            results.push({
                dimensions: dimensionValues,
                value,
            });
        }
        return results;
    }
    /**
     * Get unique users
     */
    getUniqueUsers(dateRange) {
        const events = this.queryEvents({ dateRange });
        const userIds = new Set(events.map(e => e.userId).filter(id => id !== undefined));
        return userIds.size;
    }
    /**
     * Calculate conversion rate
     */
    calculateConversionRate(startEvent, endEvent, dateRange) {
        const startEvents = this.queryEvents({
            name: startEvent,
            dateRange,
        });
        const endEvents = this.queryEvents({
            name: endEvent,
            dateRange,
        });
        const startUsers = new Set(startEvents.map(e => e.userId).filter(id => id));
        const endUsers = new Set(endEvents.map(e => e.userId).filter(id => id));
        const converted = Array.from(startUsers).filter(userId => endUsers.has(userId));
        return startUsers.size > 0 ? (converted.length / startUsers.size) * 100 : 0;
    }
    /**
     * Get event timeline
     */
    getEventTimeline(eventName, dateRange, interval) {
        const events = this.queryEvents({ name: eventName, dateRange });
        const timeline = new Map();
        for (const event of events) {
            const key = this.getTimeKey(event.timestamp, interval);
            timeline.set(key, (timeline.get(key) || 0) + 1);
        }
        return Array.from(timeline.entries())
            .map(([timestamp, count]) => ({ timestamp, count }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
    getMetricKey(name, dimensions) {
        const dimStr = Object.entries(dimensions)
            .sort(([k1], [k2]) => k1.localeCompare(k2))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${dimStr}}`;
    }
    getTimeKey(date, interval) {
        switch (interval) {
            case TimeInterval.Hour:
                return date.toISOString().slice(0, 13);
            case TimeInterval.Day:
                return date.toISOString().slice(0, 10);
            case TimeInterval.Week:
                return this.getWeekKey(date);
            case TimeInterval.Month:
                return date.toISOString().slice(0, 7);
            default:
                return date.toISOString().slice(0, 10);
        }
    }
    getWeekKey(date) {
        const firstDay = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
        const week = Math.ceil(days / 7);
        return `${date.getFullYear()}-W${week}`;
    }
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AnalyticsEngine = AnalyticsEngine;
var AggregationType;
(function (AggregationType) {
    AggregationType["Count"] = "count";
    AggregationType["Sum"] = "sum";
    AggregationType["Average"] = "average";
    AggregationType["Min"] = "min";
    AggregationType["Max"] = "max";
})(AggregationType || (exports.AggregationType = AggregationType = {}));
var TimeInterval;
(function (TimeInterval) {
    TimeInterval["Hour"] = "hour";
    TimeInterval["Day"] = "day";
    TimeInterval["Week"] = "week";
    TimeInterval["Month"] = "month";
})(TimeInterval || (exports.TimeInterval = TimeInterval = {}));
/**
 * Report Generator
 */
class ReportGenerator {
    reports = new Map();
    analyticsEngine;
    constructor(analyticsEngine) {
        this.analyticsEngine = analyticsEngine;
    }
    /**
     * Create report
     */
    createReport(report) {
        const fullReport = {
            ...report,
            id: this.generateReportId(),
            createdAt: new Date(),
        };
        this.reports.set(fullReport.id, fullReport);
        EventBus_1.eventBus.emitSync('analytics.report_created', fullReport, 'ReportGenerator');
        return fullReport;
    }
    /**
     * Generate report
     */
    async generateReport(reportId) {
        const report = this.reports.get(reportId);
        if (!report) {
            throw new Error(`Report not found: ${reportId}`);
        }
        const data = {
            reportId,
            name: report.name,
            generatedAt: new Date(),
            data: [],
            summary: {},
        };
        // Execute query
        const events = this.analyticsEngine.queryEvents({
            dateRange: report.query.dateRange,
        });
        // Apply filters
        let filteredEvents = events;
        for (const filter of report.query.filters) {
            filteredEvents = this.applyFilter(filteredEvents, filter);
        }
        // Group by dimensions and calculate metrics
        if (report.query.dimensions.length > 0) {
            data.data = this.analyticsEngine.aggregateEvents({ dateRange: report.query.dateRange }, report.query.dimensions, AggregationType.Count);
        }
        // Calculate summary
        data.summary.totalEvents = filteredEvents.length;
        data.summary.uniqueUsers = this.analyticsEngine.getUniqueUsers(report.query.dateRange);
        return data;
    }
    /**
     * Get report
     */
    getReport(reportId) {
        return this.reports.get(reportId);
    }
    /**
     * List reports
     */
    listReports() {
        return Array.from(this.reports.values());
    }
    applyFilter(events, filter) {
        switch (filter.operator) {
            case FilterOperator.Equals:
                return events.filter(e => e.properties[filter.field] === filter.value);
            case FilterOperator.NotEquals:
                return events.filter(e => e.properties[filter.field] !== filter.value);
            case FilterOperator.GreaterThan:
                return events.filter(e => e.properties[filter.field] > filter.value);
            case FilterOperator.LessThan:
                return events.filter(e => e.properties[filter.field] < filter.value);
            case FilterOperator.Contains:
                return events.filter(e => String(e.properties[filter.field])
                    .toLowerCase()
                    .includes(String(filter.value).toLowerCase()));
            case FilterOperator.In:
                return events.filter(e => filter.value.includes(e.properties[filter.field]));
            default:
                return events;
        }
    }
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ReportGenerator = ReportGenerator;
/**
 * Dashboard Manager
 */
class DashboardManager {
    dashboards = new Map();
    /**
     * Create dashboard
     */
    createDashboard(dashboard) {
        const fullDashboard = {
            ...dashboard,
            id: this.generateDashboardId(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.dashboards.set(fullDashboard.id, fullDashboard);
        EventBus_1.eventBus.emitSync('analytics.dashboard_created', fullDashboard, 'DashboardManager');
        return fullDashboard;
    }
    /**
     * Update dashboard
     */
    updateDashboard(dashboardId, updates) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        Object.assign(dashboard, updates, { updatedAt: new Date() });
        EventBus_1.eventBus.emitSync('analytics.dashboard_updated', dashboard, 'DashboardManager');
        return dashboard;
    }
    /**
     * Get dashboard
     */
    getDashboard(dashboardId) {
        return this.dashboards.get(dashboardId);
    }
    /**
     * List dashboards
     */
    listDashboards(filter) {
        let dashboards = Array.from(this.dashboards.values());
        if (filter?.createdBy) {
            dashboards = dashboards.filter(d => d.createdBy === filter.createdBy);
        }
        if (filter?.shared !== undefined) {
            dashboards = dashboards.filter(d => d.shared === filter.shared);
        }
        return dashboards;
    }
    /**
     * Delete dashboard
     */
    deleteDashboard(dashboardId) {
        this.dashboards.delete(dashboardId);
        EventBus_1.eventBus.emitSync('analytics.dashboard_deleted', { dashboardId }, 'DashboardManager');
    }
    generateDashboardId() {
        return `dashboard_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DashboardManager = DashboardManager;
/**
 * Segment Manager
 */
class SegmentManager {
    segments = new Map();
    analyticsEngine;
    constructor(analyticsEngine) {
        this.analyticsEngine = analyticsEngine;
    }
    /**
     * Create segment
     */
    createSegment(segment) {
        const fullSegment = {
            ...segment,
            id: this.generateSegmentId(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Calculate segment size
        fullSegment.size = this.calculateSegmentSize(fullSegment);
        this.segments.set(fullSegment.id, fullSegment);
        EventBus_1.eventBus.emitSync('analytics.segment_created', fullSegment, 'SegmentManager');
        return fullSegment;
    }
    /**
     * Get segment
     */
    getSegment(segmentId) {
        return this.segments.get(segmentId);
    }
    /**
     * List segments
     */
    listSegments() {
        return Array.from(this.segments.values());
    }
    /**
     * Check if user in segment
     */
    isUserInSegment(userId, segmentId) {
        const segment = this.segments.get(segmentId);
        if (!segment) {
            return false;
        }
        // Check all conditions
        return segment.conditions.every(condition => {
            const events = this.analyticsEngine.queryEvents({ userId });
            // Simplified check
            return events.length > 0;
        });
    }
    calculateSegmentSize(segment) {
        // Mock calculation
        return Math.floor(Math.random() * 10000);
    }
    generateSegmentId() {
        return `segment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SegmentManager = SegmentManager;
/**
 * Singleton instances
 */
exports.analyticsEngine = new AnalyticsEngine();
exports.reportGenerator = new ReportGenerator(exports.analyticsEngine);
exports.dashboardManager = new DashboardManager();
exports.segmentManager = new SegmentManager(exports.analyticsEngine);
