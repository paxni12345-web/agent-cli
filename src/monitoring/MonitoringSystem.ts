/**
 * Monitoring and Alerting System
 * Comprehensive system monitoring, health checks, metrics collection, and incident management
 */

import { eventBus } from '../core/EventBus';

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

export enum MonitorType {
  Availability = 'availability',
  Performance = 'performance',
  Resource = 'resource',
  Security = 'security',
  Application = 'application',
  Custom = 'custom',
}

export interface MonitorTarget {
  type: TargetType;
  identifier: string;
  endpoint?: string;
  metadata: Record<string, any>;
}

export enum TargetType {
  URL = 'url',
  Service = 'service',
  Server = 'server',
  Database = 'database',
  Container = 'container',
  Process = 'process',
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

export enum CheckType {
  HTTP = 'http',
  TCP = 'tcp',
  Ping = 'ping',
  DNS = 'dns',
  SSL = 'ssl',
  CPU = 'cpu',
  Memory = 'memory',
  Disk = 'disk',
  Network = 'network',
  Custom = 'custom',
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

export enum ThresholdOperator {
  GreaterThan = 'gt',
  GreaterThanOrEqual = 'gte',
  LessThan = 'lt',
  LessThanOrEqual = 'lte',
  Equal = 'eq',
  NotEqual = 'ne',
}

export enum CheckStatus {
  Passing = 'passing',
  Warning = 'warning',
  Critical = 'critical',
  Unknown = 'unknown',
}

export enum MonitorStatus {
  Active = 'active',
  Inactive = 'inactive',
  Paused = 'paused',
  Maintenance = 'maintenance',
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
  interval: number; // milliseconds
  timezone?: string;
}

export enum ScheduleFrequency {
  Continuous = 'continuous',
  Interval = 'interval',
  Cron = 'cron',
}

export interface NotificationConfig {
  channel: NotificationChannel;
  recipients: string[];
  conditions: NotificationCondition[];
  template?: string;
  enabled: boolean;
}

export enum NotificationChannel {
  Email = 'email',
  SMS = 'sms',
  Slack = 'slack',
  Webhook = 'webhook',
  PagerDuty = 'pagerduty',
  OpsGenie = 'opsgenie',
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

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
  Emergency = 'emergency',
}

export enum AlertStatus {
  Open = 'open',
  Acknowledged = 'acknowledged',
  Resolved = 'resolved',
  Closed = 'closed',
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

export enum IncidentSeverity {
  SEV1 = 'sev1',
  SEV2 = 'sev2',
  SEV3 = 'sev3',
  SEV4 = 'sev4',
}

export enum IncidentStatus {
  Investigating = 'investigating',
  Identified = 'identified',
  Monitoring = 'monitoring',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum IncidentPriority {
  P0 = 'p0',
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
  P4 = 'p4',
}

export interface TimelineEvent {
  timestamp: Date;
  type: EventType;
  actor: string;
  description: string;
  metadata: Record<string, any>;
}

export enum EventType {
  Created = 'created',
  Updated = 'updated',
  Assigned = 'assigned',
  Commented = 'commented',
  StatusChanged = 'status_changed',
  Resolved = 'resolved',
}

export interface ImpactAssessment {
  affectedServices: string[];
  affectedUsers: number;
  estimatedDowntime: number;
  businessImpact: BusinessImpact;
}

export enum BusinessImpact {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export interface SLA {
  id: string;
  name: string;
  description: string;
  targets: SLATarget[];
  period: number; // milliseconds
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

export enum SourceType {
  Prometheus = 'prometheus',
  Graphite = 'graphite',
  InfluxDB = 'influxdb',
  CloudWatch = 'cloudwatch',
  Datadog = 'datadog',
  Custom = 'custom',
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  unit: string;
  aggregation: AggregationType;
  tags: Record<string, string>;
}

export enum MetricType {
  Counter = 'counter',
  Gauge = 'gauge',
  Histogram = 'histogram',
  Summary = 'summary',
}

export enum AggregationType {
  Sum = 'sum',
  Average = 'average',
  Min = 'min',
  Max = 'max',
  Count = 'count',
  Percentile = 'percentile',
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

export enum WidgetType {
  LineChart = 'line_chart',
  BarChart = 'bar_chart',
  PieChart = 'pie_chart',
  Gauge = 'gauge',
  Counter = 'counter',
  Table = 'table',
  Heatmap = 'heatmap',
  Status = 'status',
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
  relative?: string; // e.g., "last_1h", "last_24h"
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

export enum DowntimeStatus {
  Scheduled = 'scheduled',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/**
 * Monitor Manager
 */
export class MonitorManager {
  private monitors: Map<string, Monitor> = new Map();
  private checkResults: Map<string, CheckResult[]> = new Map();

  /**
   * Create monitor
   */
  createMonitor(config: Omit<Monitor, 'id' | 'status' | 'createdAt'>): Monitor {
    const monitor: Monitor = {
      ...config,
      id: this.generateMonitorId(),
      status: MonitorStatus.Active,
      createdAt: new Date(),
    };

    this.monitors.set(monitor.id, monitor);

    eventBus.emitSync('monitoring.monitor_created', monitor, 'MonitorManager');

    // Start monitoring if enabled
    if (monitor.enabled) {
      this.scheduleChecks(monitor);
    }

    return monitor;
  }

  /**
   * Execute checks
   */
  async executeChecks(monitorId: string): Promise<CheckResult[]> {
    const monitor = this.monitors.get(monitorId);

    if (!monitor || !monitor.enabled) {
      return [];
    }

    const results: CheckResult[] = [];

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
  private async executeCheck(monitor: Monitor, check: Check): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      // Mock check execution
      await new Promise(resolve => setTimeout(resolve, 50));

      const value = Math.random() * 100;
      let status = CheckStatus.Passing;

      if (this.evaluateThreshold(value, check.threshold.critical, check.threshold.operator)) {
        status = CheckStatus.Critical;
      } else if (this.evaluateThreshold(value, check.threshold.warning, check.threshold.operator)) {
        status = CheckStatus.Warning;
      }

      const result: CheckResult = {
        checkId: check.id,
        status,
        value,
        message: status === CheckStatus.Passing ? 'Check passed' : `Value ${value} exceeds threshold`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: {},
      };

      eventBus.emitSync('monitoring.check_executed', { monitor, check, result }, 'MonitorManager');

      return result;

    } catch (error) {
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
  getMonitor(monitorId: string): Monitor | undefined {
    return this.monitors.get(monitorId);
  }

  /**
   * List monitors
   */
  listMonitors(filter?: { type?: MonitorType; status?: MonitorStatus }): Monitor[] {
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
  getCheckHistory(checkId: string, limit?: number): CheckResult[] {
    const history = this.checkResults.get(checkId) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Update monitor status
   */
  updateMonitorStatus(monitorId: string, status: MonitorStatus): void {
    const monitor = this.monitors.get(monitorId);

    if (monitor) {
      monitor.status = status;
      eventBus.emitSync('monitoring.monitor_status_changed', monitor, 'MonitorManager');
    }
  }

  private scheduleChecks(monitor: Monitor): void {
    // Mock scheduling - in production, this would use actual scheduling
    setInterval(() => {
      if (monitor.enabled && monitor.status === MonitorStatus.Active) {
        this.executeChecks(monitor.id);
      }
    }, monitor.schedule.interval);
  }

  private evaluateThreshold(value: number, threshold: number, operator: ThresholdOperator): boolean {
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

  private generateMonitorId(): string {
    return `monitor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Alert Manager
 */
export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private monitorManager: MonitorManager;

  constructor(monitorManager: MonitorManager) {
    this.monitorManager = monitorManager;
  }

  /**
   * Create alert
   */
  createAlert(config: Omit<Alert, 'id' | 'status' | 'triggeredAt'>): Alert {
    const alert: Alert = {
      ...config,
      id: this.generateAlertId(),
      status: AlertStatus.Open,
      triggeredAt: new Date(),
    };

    this.alerts.set(alert.id, alert);

    eventBus.emitSync('monitoring.alert_created', alert, 'AlertManager');

    return alert;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.get(alertId);

    if (alert) {
      alert.status = AlertStatus.Acknowledged;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;

      eventBus.emitSync('monitoring.alert_acknowledged', alert, 'AlertManager');
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);

    if (alert) {
      alert.status = AlertStatus.Resolved;
      alert.resolvedAt = new Date();

      eventBus.emitSync('monitoring.alert_resolved', alert, 'AlertManager');
    }
  }

  /**
   * Get alert
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * List alerts
   */
  listAlerts(filter?: { severity?: AlertSeverity; status?: AlertStatus; monitorId?: string }): Alert[] {
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

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Incident Manager
 */
export class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private alertManager: AlertManager;

  constructor(alertManager: AlertManager) {
    this.alertManager = alertManager;
  }

  /**
   * Create incident
   */
  createIncident(config: Omit<Incident, 'id' | 'timeline' | 'createdAt'>): Incident {
    const incident: Incident = {
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

    eventBus.emitSync('monitoring.incident_created', incident, 'IncidentManager');

    return incident;
  }

  /**
   * Update incident status
   */
  updateStatus(incidentId: string, status: IncidentStatus, actor: string, description: string): void {
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

      eventBus.emitSync('monitoring.incident_updated', incident, 'IncidentManager');
    }
  }

  /**
   * Assign incident
   */
  assignIncident(incidentId: string, assignee: string, actor: string): void {
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

      eventBus.emitSync('monitoring.incident_assigned', incident, 'IncidentManager');
    }
  }

  /**
   * Add comment
   */
  addComment(incidentId: string, actor: string, comment: string): void {
    const incident = this.incidents.get(incidentId);

    if (incident) {
      incident.timeline.push({
        timestamp: new Date(),
        type: EventType.Commented,
        actor,
        description: comment,
        metadata: {},
      });

      eventBus.emitSync('monitoring.incident_commented', incident, 'IncidentManager');
    }
  }

  /**
   * Get incident
   */
  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * List incidents
   */
  listIncidents(filter?: { severity?: IncidentSeverity; status?: IncidentStatus }): Incident[] {
    let incidents = Array.from(this.incidents.values());

    if (filter?.severity) {
      incidents = incidents.filter(i => i.severity === filter.severity);
    }

    if (filter?.status) {
      incidents = incidents.filter(i => i.status === filter.status);
    }

    return incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private generateIncidentId(): string {
    return `incident_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * SLA Manager
 */
export class SLAManager {
  private slas: Map<string, SLA> = new Map();
  private reports: Map<string, SLAReport> = new Map();

  /**
   * Create SLA
   */
  createSLA(config: Omit<SLA, 'id' | 'createdAt'>): SLA {
    const sla: SLA = {
      ...config,
      id: this.generateSLAId(),
      createdAt: new Date(),
    };

    this.slas.set(sla.id, sla);

    eventBus.emitSync('monitoring.sla_created', sla, 'SLAManager');

    return sla;
  }

  /**
   * Generate SLA report
   */
  async generateReport(slaId: string, start: Date, end: Date): Promise<SLAReport> {
    const sla = this.slas.get(slaId);

    if (!sla) {
      throw new Error(`SLA not found: ${slaId}`);
    }

    // Mock report generation
    const results: SLAResult[] = sla.targets.map(target => {
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

    const report: SLAReport = {
      id: this.generateReportId(),
      slaId,
      period: { start, end },
      results,
      overallCompliance: (compliantCount / results.length) * 100,
      violations: [],
      generatedAt: new Date(),
    };

    this.reports.set(report.id, report);

    eventBus.emitSync('monitoring.sla_report_generated', report, 'SLAManager');

    return report;
  }

  /**
   * Get SLA
   */
  getSLA(slaId: string): SLA | undefined {
    return this.slas.get(slaId);
  }

  /**
   * List SLAs
   */
  listSLAs(): SLA[] {
    return Array.from(this.slas.values());
  }

  /**
   * Get report
   */
  getReport(reportId: string): SLAReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * List reports
   */
  listReports(slaId?: string): SLAReport[] {
    let reports = Array.from(this.reports.values());

    if (slaId) {
      reports = reports.filter(r => r.slaId === slaId);
    }

    return reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  private generateSLAId(): string {
    return `sla_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Dashboard Manager
 */
export class DashboardManager {
  private dashboards: Map<string, Dashboard> = new Map();

  /**
   * Create dashboard
   */
  createDashboard(config: Omit<Dashboard, 'id' | 'createdAt'>): Dashboard {
    const dashboard: Dashboard = {
      ...config,
      id: this.generateDashboardId(),
      createdAt: new Date(),
    };

    this.dashboards.set(dashboard.id, dashboard);

    eventBus.emitSync('monitoring.dashboard_created', dashboard, 'DashboardManager');

    return dashboard;
  }

  /**
   * Get dashboard
   */
  getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  /**
   * List dashboards
   */
  listDashboards(publicOnly?: boolean): Dashboard[] {
    let dashboards = Array.from(this.dashboards.values());

    if (publicOnly) {
      dashboards = dashboards.filter(d => d.public);
    }

    return dashboards;
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const monitorManager = new MonitorManager();
export const alertManager = new AlertManager(monitorManager);
export const incidentManager = new IncidentManager(alertManager);
export const slaManager = new SLAManager();
export const dashboardManager = new DashboardManager();
