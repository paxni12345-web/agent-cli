"use strict";
/**
 * Monitoring and Alerting System
 * Comprehensive system monitoring, health checks, metrics collection, and incident management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardManager = exports.slaManager = exports.incidentManager = exports.alertManager = exports.monitorManager = exports.DashboardManager = exports.SLAManager = exports.IncidentManager = exports.AlertManager = exports.MonitorManager = exports.DowntimeStatus = exports.WidgetType = exports.AggregationType = exports.MetricType = exports.SourceType = exports.BusinessImpact = exports.EventType = exports.IncidentPriority = exports.IncidentStatus = exports.IncidentSeverity = exports.AlertStatus = exports.AlertSeverity = exports.NotificationChannel = exports.ScheduleFrequency = exports.MonitorStatus = exports.CheckStatus = exports.ThresholdOperator = exports.CheckType = exports.TargetType = exports.MonitorType = void 0;
const EventBus_1 = require("../core/EventBus");
var MonitorType;
(function (MonitorType) {
    MonitorType["Availability"] = "availability";
    MonitorType["Performance"] = "performance";
    MonitorType["Resource"] = "resource";
    MonitorType["Security"] = "security";
    MonitorType["Application"] = "application";
    MonitorType["Custom"] = "custom";
})(MonitorType || (exports.MonitorType = MonitorType = {}));
var TargetType;
(function (TargetType) {
    TargetType["URL"] = "url";
    TargetType["Service"] = "service";
    TargetType["Server"] = "server";
    TargetType["Database"] = "database";
    TargetType["Container"] = "container";
    TargetType["Process"] = "process";
})(TargetType || (exports.TargetType = TargetType = {}));
var CheckType;
(function (CheckType) {
    CheckType["HTTP"] = "http";
    CheckType["TCP"] = "tcp";
    CheckType["Ping"] = "ping";
    CheckType["DNS"] = "dns";
    CheckType["SSL"] = "ssl";
    CheckType["CPU"] = "cpu";
    CheckType["Memory"] = "memory";
    CheckType["Disk"] = "disk";
    CheckType["Network"] = "network";
    CheckType["Custom"] = "custom";
})(CheckType || (exports.CheckType = CheckType = {}));
var ThresholdOperator;
(function (ThresholdOperator) {
    ThresholdOperator["GreaterThan"] = "gt";
    ThresholdOperator["GreaterThanOrEqual"] = "gte";
    ThresholdOperator["LessThan"] = "lt";
    ThresholdOperator["LessThanOrEqual"] = "lte";
    ThresholdOperator["Equal"] = "eq";
    ThresholdOperator["NotEqual"] = "ne";
})(ThresholdOperator || (exports.ThresholdOperator = ThresholdOperator = {}));
var CheckStatus;
(function (CheckStatus) {
    CheckStatus["Passing"] = "passing";
    CheckStatus["Warning"] = "warning";
    CheckStatus["Critical"] = "critical";
    CheckStatus["Unknown"] = "unknown";
})(CheckStatus || (exports.CheckStatus = CheckStatus = {}));
var MonitorStatus;
(function (MonitorStatus) {
    MonitorStatus["Active"] = "active";
    MonitorStatus["Inactive"] = "inactive";
    MonitorStatus["Paused"] = "paused";
    MonitorStatus["Maintenance"] = "maintenance";
})(MonitorStatus || (exports.MonitorStatus = MonitorStatus = {}));
var ScheduleFrequency;
(function (ScheduleFrequency) {
    ScheduleFrequency["Continuous"] = "continuous";
    ScheduleFrequency["Interval"] = "interval";
    ScheduleFrequency["Cron"] = "cron";
})(ScheduleFrequency || (exports.ScheduleFrequency = ScheduleFrequency = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["Email"] = "email";
    NotificationChannel["SMS"] = "sms";
    NotificationChannel["Slack"] = "slack";
    NotificationChannel["Webhook"] = "webhook";
    NotificationChannel["PagerDuty"] = "pagerduty";
    NotificationChannel["OpsGenie"] = "opsgenie";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["Info"] = "info";
    AlertSeverity["Warning"] = "warning";
    AlertSeverity["Critical"] = "critical";
    AlertSeverity["Emergency"] = "emergency";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["Open"] = "open";
    AlertStatus["Acknowledged"] = "acknowledged";
    AlertStatus["Resolved"] = "resolved";
    AlertStatus["Closed"] = "closed";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
var IncidentSeverity;
(function (IncidentSeverity) {
    IncidentSeverity["SEV1"] = "sev1";
    IncidentSeverity["SEV2"] = "sev2";
    IncidentSeverity["SEV3"] = "sev3";
    IncidentSeverity["SEV4"] = "sev4";
})(IncidentSeverity || (exports.IncidentSeverity = IncidentSeverity = {}));
var IncidentStatus;
(function (IncidentStatus) {
    IncidentStatus["Investigating"] = "investigating";
    IncidentStatus["Identified"] = "identified";
    IncidentStatus["Monitoring"] = "monitoring";
    IncidentStatus["Resolved"] = "resolved";
    IncidentStatus["Closed"] = "closed";
})(IncidentStatus || (exports.IncidentStatus = IncidentStatus = {}));
var IncidentPriority;
(function (IncidentPriority) {
    IncidentPriority["P0"] = "p0";
    IncidentPriority["P1"] = "p1";
    IncidentPriority["P2"] = "p2";
    IncidentPriority["P3"] = "p3";
    IncidentPriority["P4"] = "p4";
})(IncidentPriority || (exports.IncidentPriority = IncidentPriority = {}));
var EventType;
(function (EventType) {
    EventType["Created"] = "created";
    EventType["Updated"] = "updated";
    EventType["Assigned"] = "assigned";
    EventType["Commented"] = "commented";
    EventType["StatusChanged"] = "status_changed";
    EventType["Resolved"] = "resolved";
})(EventType || (exports.EventType = EventType = {}));
var BusinessImpact;
(function (BusinessImpact) {
    BusinessImpact["None"] = "none";
    BusinessImpact["Low"] = "low";
    BusinessImpact["Medium"] = "medium";
    BusinessImpact["High"] = "high";
    BusinessImpact["Critical"] = "critical";
})(BusinessImpact || (exports.BusinessImpact = BusinessImpact = {}));
var SourceType;
(function (SourceType) {
    SourceType["Prometheus"] = "prometheus";
    SourceType["Graphite"] = "graphite";
    SourceType["InfluxDB"] = "influxdb";
    SourceType["CloudWatch"] = "cloudwatch";
    SourceType["Datadog"] = "datadog";
    SourceType["Custom"] = "custom";
})(SourceType || (exports.SourceType = SourceType = {}));
var MetricType;
(function (MetricType) {
    MetricType["Counter"] = "counter";
    MetricType["Gauge"] = "gauge";
    MetricType["Histogram"] = "histogram";
    MetricType["Summary"] = "summary";
})(MetricType || (exports.MetricType = MetricType = {}));
var AggregationType;
(function (AggregationType) {
    AggregationType["Sum"] = "sum";
    AggregationType["Average"] = "average";
    AggregationType["Min"] = "min";
    AggregationType["Max"] = "max";
    AggregationType["Count"] = "count";
    AggregationType["Percentile"] = "percentile";
})(AggregationType || (exports.AggregationType = AggregationType = {}));
var WidgetType;
(function (WidgetType) {
    WidgetType["LineChart"] = "line_chart";
    WidgetType["BarChart"] = "bar_chart";
    WidgetType["PieChart"] = "pie_chart";
    WidgetType["Gauge"] = "gauge";
    WidgetType["Counter"] = "counter";
    WidgetType["Table"] = "table";
    WidgetType["Heatmap"] = "heatmap";
    WidgetType["Status"] = "status";
})(WidgetType || (exports.WidgetType = WidgetType = {}));
var DowntimeStatus;
(function (DowntimeStatus) {
    DowntimeStatus["Scheduled"] = "scheduled";
    DowntimeStatus["Active"] = "active";
    DowntimeStatus["Completed"] = "completed";
    DowntimeStatus["Cancelled"] = "cancelled";
})(DowntimeStatus || (exports.DowntimeStatus = DowntimeStatus = {}));
/**
 * Monitor Manager
 */
class MonitorManager {
    monitors = new Map();
    checkResults = new Map();
    /**
     * Create monitor
     */
    createMonitor(config) {
        const monitor = {
            ...config,
            id: this.generateMonitorId(),
            status: MonitorStatus.Active,
            createdAt: new Date(),
        };
        this.monitors.set(monitor.id, monitor);
        EventBus_1.eventBus.emitSync('monitoring.monitor_created', monitor, 'MonitorManager');
        // Start monitoring if enabled
        if (monitor.enabled) {
            this.scheduleChecks(monitor);
        }
        return monitor;
    }
    /**
     * Execute checks
     */
    async executeChecks(monitorId) {
        const monitor = this.monitors.get(monitorId);
        if (!monitor || !monitor.enabled) {
            return [];
        }
        const results = [];
        for (const check of monitor.checks) {
            const result = await this.executeCheck(monitor, check);
            results.push(result);
            // Store result
            let history = this.checkResults.get(check.id);
            if (!history) {
                history = [];
                this.checkResults.set(check.id, history);
            }
            history.push(result);
            // Keep last 100 results
            if (history.length > 100) {
                history.shift();
            }
            // Update check status
            check.status = result.status;
            check.lastResult = result;
        }
        monitor.lastCheck = new Date();
        return results;
    }
    /**
     * Execute single check
     */
    async executeCheck(monitor, check) {
        const startTime = Date.now();
        try {
            // Mock check execution
            await new Promise(resolve => setTimeout(resolve, 50));
            const value = Math.random() * 100;
            let status = CheckStatus.Passing;
            if (this.evaluateThreshold(value, check.threshold.critical, check.threshold.operator)) {
                status = CheckStatus.Critical;
            }
            else if (this.evaluateThreshold(value, check.threshold.warning, check.threshold.operator)) {
                status = CheckStatus.Warning;
            }
            const result = {
                checkId: check.id,
                status,
                value,
                message: status === CheckStatus.Passing ? 'Check passed' : `Value ${value} exceeds threshold`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                metadata: {},
            };
            EventBus_1.eventBus.emitSync('monitoring.check_executed', { monitor, check, result }, 'MonitorManager');
            return result;
        }
        catch (error) {
            return {
                checkId: check.id,
                status: CheckStatus.Critical,
                value: 0,
                message: error instanceof Error ? error.message : 'Check failed',
                duration: Date.now() - startTime,
                timestamp: new Date(),
                metadata: {},
            };
        }
    }
    /**
     * Get monitor
     */
    getMonitor(monitorId) {
        return this.monitors.get(monitorId);
    }
    /**
     * List monitors
     */
    listMonitors(filter) {
        let monitors = Array.from(this.monitors.values());
        if (filter?.type) {
            monitors = monitors.filter(m => m.type === filter.type);
        }
        if (filter?.status) {
            monitors = monitors.filter(m => m.status === filter.status);
        }
        return monitors;
    }
    /**
     * Get check history
     */
    getCheckHistory(checkId, limit) {
        const history = this.checkResults.get(checkId) || [];
        return limit ? history.slice(-limit) : history;
    }
    /**
     * Update monitor status
     */
    updateMonitorStatus(monitorId, status) {
        const monitor = this.monitors.get(monitorId);
        if (monitor) {
            monitor.status = status;
            EventBus_1.eventBus.emitSync('monitoring.monitor_status_changed', monitor, 'MonitorManager');
        }
    }
    scheduleChecks(monitor) {
        // Mock scheduling - in production, this would use actual scheduling
        setInterval(() => {
            if (monitor.enabled && monitor.status === MonitorStatus.Active) {
                this.executeChecks(monitor.id);
            }
        }, monitor.schedule.interval);
    }
    evaluateThreshold(value, threshold, operator) {
        switch (operator) {
            case ThresholdOperator.GreaterThan:
                return value > threshold;
            case ThresholdOperator.GreaterThanOrEqual:
                return value >= threshold;
            case ThresholdOperator.LessThan:
                return value < threshold;
            case ThresholdOperator.LessThanOrEqual:
                return value <= threshold;
            case ThresholdOperator.Equal:
                return value === threshold;
            case ThresholdOperator.NotEqual:
                return value !== threshold;
            default:
                return false;
        }
    }
    generateMonitorId() {
        return `monitor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.MonitorManager = MonitorManager;
/**
 * Alert Manager
 */
class AlertManager {
    alerts = new Map();
    monitorManager;
    constructor(monitorManager) {
        this.monitorManager = monitorManager;
    }
    /**
     * Create alert
     */
    createAlert(config) {
        const alert = {
            ...config,
            id: this.generateAlertId(),
            status: AlertStatus.Open,
            triggeredAt: new Date(),
        };
        this.alerts.set(alert.id, alert);
        EventBus_1.eventBus.emitSync('monitoring.alert_created', alert, 'AlertManager');
        return alert;
    }
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.status = AlertStatus.Acknowledged;
            alert.acknowledgedAt = new Date();
            alert.acknowledgedBy = acknowledgedBy;
            EventBus_1.eventBus.emitSync('monitoring.alert_acknowledged', alert, 'AlertManager');
        }
    }
    /**
     * Resolve alert
     */
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.status = AlertStatus.Resolved;
            alert.resolvedAt = new Date();
            EventBus_1.eventBus.emitSync('monitoring.alert_resolved', alert, 'AlertManager');
        }
    }
    /**
     * Get alert
     */
    getAlert(alertId) {
        return this.alerts.get(alertId);
    }
    /**
     * List alerts
     */
    listAlerts(filter) {
        let alerts = Array.from(this.alerts.values());
        if (filter?.severity) {
            alerts = alerts.filter(a => a.severity === filter.severity);
        }
        if (filter?.status) {
            alerts = alerts.filter(a => a.status === filter.status);
        }
        if (filter?.monitorId) {
            alerts = alerts.filter(a => a.monitorId === filter.monitorId);
        }
        return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AlertManager = AlertManager;
/**
 * Incident Manager
 */
class IncidentManager {
    incidents = new Map();
    alertManager;
    constructor(alertManager) {
        this.alertManager = alertManager;
    }
    /**
     * Create incident
     */
    createIncident(config) {
        const incident = {
            ...config,
            id: this.generateIncidentId(),
            timeline: [{
                    timestamp: new Date(),
                    type: EventType.Created,
                    actor: 'system',
                    description: 'Incident created',
                    metadata: {},
                }],
            createdAt: new Date(),
        };
        this.incidents.set(incident.id, incident);
        EventBus_1.eventBus.emitSync('monitoring.incident_created', incident, 'IncidentManager');
        return incident;
    }
    /**
     * Update incident status
     */
    updateStatus(incidentId, status, actor, description) {
        const incident = this.incidents.get(incidentId);
        if (incident) {
            incident.status = status;
            incident.timeline.push({
                timestamp: new Date(),
                type: EventType.StatusChanged,
                actor,
                description,
                metadata: { newStatus: status },
            });
            if (status === IncidentStatus.Resolved) {
                incident.resolvedAt = new Date();
            }
            EventBus_1.eventBus.emitSync('monitoring.incident_updated', incident, 'IncidentManager');
        }
    }
    /**
     * Assign incident
     */
    assignIncident(incidentId, assignee, actor) {
        const incident = this.incidents.get(incidentId);
        if (incident) {
            incident.assignee = assignee;
            incident.timeline.push({
                timestamp: new Date(),
                type: EventType.Assigned,
                actor,
                description: `Assigned to ${assignee}`,
                metadata: { assignee },
            });
            EventBus_1.eventBus.emitSync('monitoring.incident_assigned', incident, 'IncidentManager');
        }
    }
    /**
     * Add comment
     */
    addComment(incidentId, actor, comment) {
        const incident = this.incidents.get(incidentId);
        if (incident) {
            incident.timeline.push({
                timestamp: new Date(),
                type: EventType.Commented,
                actor,
                description: comment,
                metadata: {},
            });
            EventBus_1.eventBus.emitSync('monitoring.incident_commented', incident, 'IncidentManager');
        }
    }
    /**
     * Get incident
     */
    getIncident(incidentId) {
        return this.incidents.get(incidentId);
    }
    /**
     * List incidents
     */
    listIncidents(filter) {
        let incidents = Array.from(this.incidents.values());
        if (filter?.severity) {
            incidents = incidents.filter(i => i.severity === filter.severity);
        }
        if (filter?.status) {
            incidents = incidents.filter(i => i.status === filter.status);
        }
        return incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    generateIncidentId() {
        return `incident_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.IncidentManager = IncidentManager;
/**
 * SLA Manager
 */
class SLAManager {
    slas = new Map();
    reports = new Map();
    /**
     * Create SLA
     */
    createSLA(config) {
        const sla = {
            ...config,
            id: this.generateSLAId(),
            createdAt: new Date(),
        };
        this.slas.set(sla.id, sla);
        EventBus_1.eventBus.emitSync('monitoring.sla_created', sla, 'SLAManager');
        return sla;
    }
    /**
     * Generate SLA report
     */
    async generateReport(slaId, start, end) {
        const sla = this.slas.get(slaId);
        if (!sla) {
            throw new Error(`SLA not found: ${slaId}`);
        }
        // Mock report generation
        const results = sla.targets.map(target => {
            const actualValue = Math.random() * 100;
            const compliance = actualValue >= target.target;
            return {
                target,
                actualValue,
                compliance,
                compliancePercentage: (actualValue / target.target) * 100,
            };
        });
        const compliantCount = results.filter(r => r.compliance).length;
        const report = {
            id: this.generateReportId(),
            slaId,
            period: { start, end },
            results,
            overallCompliance: (compliantCount / results.length) * 100,
            violations: [],
            generatedAt: new Date(),
        };
        this.reports.set(report.id, report);
        EventBus_1.eventBus.emitSync('monitoring.sla_report_generated', report, 'SLAManager');
        return report;
    }
    /**
     * Get SLA
     */
    getSLA(slaId) {
        return this.slas.get(slaId);
    }
    /**
     * List SLAs
     */
    listSLAs() {
        return Array.from(this.slas.values());
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
    listReports(slaId) {
        let reports = Array.from(this.reports.values());
        if (slaId) {
            reports = reports.filter(r => r.slaId === slaId);
        }
        return reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
    }
    generateSLAId() {
        return `sla_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SLAManager = SLAManager;
/**
 * Dashboard Manager
 */
class DashboardManager {
    dashboards = new Map();
    /**
     * Create dashboard
     */
    createDashboard(config) {
        const dashboard = {
            ...config,
            id: this.generateDashboardId(),
            createdAt: new Date(),
        };
        this.dashboards.set(dashboard.id, dashboard);
        EventBus_1.eventBus.emitSync('monitoring.dashboard_created', dashboard, 'DashboardManager');
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
    listDashboards(publicOnly) {
        let dashboards = Array.from(this.dashboards.values());
        if (publicOnly) {
            dashboards = dashboards.filter(d => d.public);
        }
        return dashboards;
    }
    generateDashboardId() {
        return `dashboard_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DashboardManager = DashboardManager;
/**
 * Singleton instances
 */
exports.monitorManager = new MonitorManager();
exports.alertManager = new AlertManager(exports.monitorManager);
exports.incidentManager = new IncidentManager(exports.alertManager);
exports.slaManager = new SLAManager();
exports.dashboardManager = new DashboardManager();
