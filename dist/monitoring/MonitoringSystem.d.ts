/**
 * Monitoring and Alerting System
 * Comprehensive system monitoring, health checks, metrics collection, and incident management
 */
export interface Monitor {
    id: string;
    name: string;
    type: MonitorType;
    target: MonitorTarget;
    checks: Check[];
    schedule: CheckSchedule;
    notifications: NotificationConfig[];
    enabled: boolean;
    status: MonitorStatus;
    lastCheck?: Date;
    createdAt: Date;
}
export declare enum MonitorType {
    Availability = "availability",
    Performance = "performance",
    Resource = "resource",
    Security = "security",
    Application = "application",
    Custom = "custom"
}
export interface MonitorTarget {
    type: TargetType;
    identifier: string;
    endpoint?: string;
    metadata: Record<string, any>;
}
export declare enum TargetType {
    URL = "url",
    Service = "service",
    Server = "server",
    Database = "database",
    Container = "container",
    Process = "process"
}
export interface Check {
    id: string;
    name: string;
    type: CheckType;
    config: CheckConfig;
    threshold: Threshold;
    status: CheckStatus;
    lastResult?: CheckResult;
}
export declare enum CheckType {
    HTTP = "http",
    TCP = "tcp",
    Ping = "ping",
    DNS = "dns",
    SSL = "ssl",
    CPU = "cpu",
    Memory = "memory",
    Disk = "disk",
    Network = "network",
    Custom = "custom"
}
export interface CheckConfig {
    timeout: number;
    retries: number;
    interval: number;
    parameters: Record<string, any>;
}
export interface Threshold {
    warning: number;
    critical: number;
    unit: string;
    operator: ThresholdOperator;
}
export declare enum ThresholdOperator {
    GreaterThan = "gt",
    GreaterThanOrEqual = "gte",
    LessThan = "lt",
    LessThanOrEqual = "lte",
    Equal = "eq",
    NotEqual = "ne"
}
export declare enum CheckStatus {
    Passing = "passing",
    Warning = "warning",
    Critical = "critical",
    Unknown = "unknown"
}
export declare enum MonitorStatus {
    Active = "active",
    Inactive = "inactive",
    Paused = "paused",
    Maintenance = "maintenance"
}
export interface CheckResult {
    checkId: string;
    status: CheckStatus;
    value: number;
    message: string;
    duration: number;
    timestamp: Date;
    metadata: Record<string, any>;
}
export interface CheckSchedule {
    frequency: ScheduleFrequency;
    interval: number;
    timezone?: string;
}
export declare enum ScheduleFrequency {
    Continuous = "continuous",
    Interval = "interval",
    Cron = "cron"
}
export interface NotificationConfig {
    channel: NotificationChannel;
    recipients: string[];
    conditions: NotificationCondition[];
    template?: string;
    enabled: boolean;
}
export declare enum NotificationChannel {
    Email = "email",
    SMS = "sms",
    Slack = "slack",
    Webhook = "webhook",
    PagerDuty = "pagerduty",
    OpsGenie = "opsgenie"
}
export interface NotificationCondition {
    field: string;
    operator: string;
    value: any;
}
export interface Alert {
    id: string;
    monitorId: string;
    checkId: string;
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    description: string;
    value: number;
    threshold: Threshold;
    triggeredAt: Date;
    acknowledgedAt?: Date;
    resolvedAt?: Date;
    acknowledgedBy?: string;
    metadata: Record<string, any>;
}
export declare enum AlertSeverity {
    Info = "info",
    Warning = "warning",
    Critical = "critical",
    Emergency = "emergency"
}
export declare enum AlertStatus {
    Open = "open",
    Acknowledged = "acknowledged",
    Resolved = "resolved",
    Closed = "closed"
}
export interface Incident {
    id: string;
    title: string;
    description: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    priority: IncidentPriority;
    alerts: string[];
    assignee?: string;
    team?: string;
    timeline: TimelineEvent[];
    impact: ImpactAssessment;
    createdAt: Date;
    resolvedAt?: Date;
}
export declare enum IncidentSeverity {
    SEV1 = "sev1",
    SEV2 = "sev2",
    SEV3 = "sev3",
    SEV4 = "sev4"
}
export declare enum IncidentStatus {
    Investigating = "investigating",
    Identified = "identified",
    Monitoring = "monitoring",
    Resolved = "resolved",
    Closed = "closed"
}
export declare enum IncidentPriority {
    P0 = "p0",
    P1 = "p1",
    P2 = "p2",
    P3 = "p3",
    P4 = "p4"
}
export interface TimelineEvent {
    timestamp: Date;
    type: EventType;
    actor: string;
    description: string;
    metadata: Record<string, any>;
}
export declare enum EventType {
    Created = "created",
    Updated = "updated",
    Assigned = "assigned",
    Commented = "commented",
    StatusChanged = "status_changed",
    Resolved = "resolved"
}
export interface ImpactAssessment {
    affectedServices: string[];
    affectedUsers: number;
    estimatedDowntime: number;
    businessImpact: BusinessImpact;
}
export declare enum BusinessImpact {
    None = "none",
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export interface SLA {
    id: string;
    name: string;
    description: string;
    targets: SLATarget[];
    period: number;
    enabled: boolean;
    createdAt: Date;
}
export interface SLATarget {
    metric: string;
    target: number;
    unit: string;
    operator: ThresholdOperator;
}
export interface SLAReport {
    id: string;
    slaId: string;
    period: {
        start: Date;
        end: Date;
    };
    results: SLAResult[];
    overallCompliance: number;
    violations: SLAViolation[];
    generatedAt: Date;
}
export interface SLAResult {
    target: SLATarget;
    actualValue: number;
    compliance: boolean;
    compliancePercentage: number;
}
export interface SLAViolation {
    target: SLATarget;
    timestamp: Date;
    actualValue: number;
    targetValue: number;
    duration: number;
}
export interface MetricCollector {
    id: string;
    name: string;
    source: MetricSource;
    metrics: MetricDefinition[];
    interval: number;
    enabled: boolean;
    createdAt: Date;
}
export interface MetricSource {
    type: SourceType;
    endpoint: string;
    credentials?: Record<string, string>;
    metadata: Record<string, any>;
}
export declare enum SourceType {
    Prometheus = "prometheus",
    Graphite = "graphite",
    InfluxDB = "influxdb",
    CloudWatch = "cloudwatch",
    Datadog = "datadog",
    Custom = "custom"
}
export interface MetricDefinition {
    name: string;
    type: MetricType;
    unit: string;
    aggregation: AggregationType;
    tags: Record<string, string>;
}
export declare enum MetricType {
    Counter = "counter",
    Gauge = "gauge",
    Histogram = "histogram",
    Summary = "summary"
}
export declare enum AggregationType {
    Sum = "sum",
    Average = "average",
    Min = "min",
    Max = "max",
    Count = "count",
    Percentile = "percentile"
}
export interface Dashboard {
    id: string;
    name: string;
    description: string;
    widgets: Widget[];
    layout: LayoutConfig;
    refreshInterval: number;
    public: boolean;
    createdAt: Date;
}
export interface Widget {
    id: string;
    type: WidgetType;
    title: string;
    config: WidgetConfig;
    position: Position;
    size: Size;
}
export declare enum WidgetType {
    LineChart = "line_chart",
    BarChart = "bar_chart",
    PieChart = "pie_chart",
    Gauge = "gauge",
    Counter = "counter",
    Table = "table",
    Heatmap = "heatmap",
    Status = "status"
}
export interface WidgetConfig {
    query: string;
    timeRange: TimeRange;
    visualization: VisualizationConfig;
    thresholds?: Threshold[];
}
export interface TimeRange {
    start: Date;
    end: Date;
    relative?: string;
}
export interface VisualizationConfig {
    colors?: string[];
    legend?: boolean;
    grid?: boolean;
    labels?: boolean;
}
export interface Position {
    x: number;
    y: number;
}
export interface Size {
    width: number;
    height: number;
}
export interface LayoutConfig {
    columns: number;
    rowHeight: number;
}
export interface Downtime {
    id: string;
    monitorId: string;
    start: Date;
    end?: Date;
    duration?: number;
    reason: string;
    status: DowntimeStatus;
    createdBy: string;
}
export declare enum DowntimeStatus {
    Scheduled = "scheduled",
    Active = "active",
    Completed = "completed",
    Cancelled = "cancelled"
}
/**
 * Monitor Manager
 */
export declare class MonitorManager {
    private monitors;
    private checkResults;
    /**
     * Create monitor
     */
    createMonitor(config: Omit<Monitor, 'id' | 'status' | 'createdAt'>): Monitor;
    /**
     * Execute checks
     */
    executeChecks(monitorId: string): Promise<CheckResult[]>;
    /**
     * Execute single check
     */
    private executeCheck;
    /**
     * Get monitor
     */
    getMonitor(monitorId: string): Monitor | undefined;
    /**
     * List monitors
     */
    listMonitors(filter?: {
        type?: MonitorType;
        status?: MonitorStatus;
    }): Monitor[];
    /**
     * Get check history
     */
    getCheckHistory(checkId: string, limit?: number): CheckResult[];
    /**
     * Update monitor status
     */
    updateMonitorStatus(monitorId: string, status: MonitorStatus): void;
    private scheduleChecks;
    private evaluateThreshold;
    private generateMonitorId;
}
/**
 * Alert Manager
 */
export declare class AlertManager {
    private alerts;
    private monitorManager;
    constructor(monitorManager: MonitorManager);
    /**
     * Create alert
     */
    createAlert(config: Omit<Alert, 'id' | 'status' | 'triggeredAt'>): Alert;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): void;
    /**
     * Resolve alert
     */
    resolveAlert(alertId: string): void;
    /**
     * Get alert
     */
    getAlert(alertId: string): Alert | undefined;
    /**
     * List alerts
     */
    listAlerts(filter?: {
        severity?: AlertSeverity;
        status?: AlertStatus;
        monitorId?: string;
    }): Alert[];
    private generateAlertId;
}
/**
 * Incident Manager
 */
export declare class IncidentManager {
    private incidents;
    private alertManager;
    constructor(alertManager: AlertManager);
    /**
     * Create incident
     */
    createIncident(config: Omit<Incident, 'id' | 'timeline' | 'createdAt'>): Incident;
    /**
     * Update incident status
     */
    updateStatus(incidentId: string, status: IncidentStatus, actor: string, description: string): void;
    /**
     * Assign incident
     */
    assignIncident(incidentId: string, assignee: string, actor: string): void;
    /**
     * Add comment
     */
    addComment(incidentId: string, actor: string, comment: string): void;
    /**
     * Get incident
     */
    getIncident(incidentId: string): Incident | undefined;
    /**
     * List incidents
     */
    listIncidents(filter?: {
        severity?: IncidentSeverity;
        status?: IncidentStatus;
    }): Incident[];
    private generateIncidentId;
}
/**
 * SLA Manager
 */
export declare class SLAManager {
    private slas;
    private reports;
    /**
     * Create SLA
     */
    createSLA(config: Omit<SLA, 'id' | 'createdAt'>): SLA;
    /**
     * Generate SLA report
     */
    generateReport(slaId: string, start: Date, end: Date): Promise<SLAReport>;
    /**
     * Get SLA
     */
    getSLA(slaId: string): SLA | undefined;
    /**
     * List SLAs
     */
    listSLAs(): SLA[];
    /**
     * Get report
     */
    getReport(reportId: string): SLAReport | undefined;
    /**
     * List reports
     */
    listReports(slaId?: string): SLAReport[];
    private generateSLAId;
    private generateReportId;
}
/**
 * Dashboard Manager
 */
export declare class DashboardManager {
    private dashboards;
    /**
     * Create dashboard
     */
    createDashboard(config: Omit<Dashboard, 'id' | 'createdAt'>): Dashboard;
    /**
     * Get dashboard
     */
    getDashboard(dashboardId: string): Dashboard | undefined;
    /**
     * List dashboards
     */
    listDashboards(publicOnly?: boolean): Dashboard[];
    private generateDashboardId;
}
/**
 * Singleton instances
 */
export declare const monitorManager: MonitorManager;
export declare const alertManager: AlertManager;
export declare const incidentManager: IncidentManager;
export declare const slaManager: SLAManager;
export declare const dashboardManager: DashboardManager;
//# sourceMappingURL=MonitoringSystem.d.ts.map