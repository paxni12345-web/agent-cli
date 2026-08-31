/**
 * Audit Logging System
 * Comprehensive audit trail, compliance tracking, and security event logging
 */

import { eventBus } from '../core/EventBus';

export interface AuditLog {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  actor: Actor;
  resource: Resource;
  action: string;
  outcome: AuditOutcome;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  changes?: ChangeRecord[];
  tags: string[];
}

export enum AuditEventType {
  Authentication = 'authentication',
  Authorization = 'authorization',
  DataAccess = 'data_access',
  DataModification = 'data_modification',
  DataDeletion = 'data_deletion',
  Configuration = 'configuration',
  Security = 'security',
  Compliance = 'compliance',
  SystemEvent = 'system_event',
  UserAction = 'user_action',
  APICall = 'api_call',
  FileAccess = 'file_access',
  AdminAction = 'admin_action',
}

export enum AuditCategory {
  Security = 'security',
  Privacy = 'privacy',
  Financial = 'financial',
  Operational = 'operational',
  Administrative = 'administrative',
  Compliance = 'compliance',
}

export enum AuditSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Info = 'info',
}

export interface Actor {
  type: ActorType;
  id: string;
  name: string;
  email?: string;
  roles?: string[];
  department?: string;
}

export enum ActorType {
  User = 'user',
  System = 'system',
  Service = 'service',
  API = 'api',
  Anonymous = 'anonymous',
}

export interface Resource {
  type: string;
  id: string;
  name?: string;
  attributes?: Record<string, any>;
}

export enum AuditOutcome {
  Success = 'success',
  Failure = 'failure',
  Partial = 'partial',
  Denied = 'denied',
  Error = 'error',
}

export interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export interface AuditQuery {
  startTime?: Date;
  endTime?: Date;
  eventTypes?: AuditEventType[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: AuditOutcome;
  searchText?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  logs: AuditLog[];
  total: number;
  offset: number;
  limit: number;
  executionTime: number;
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  framework: ComplianceFramework;
  eventTypes: AuditEventType[];
  retentionPeriod: number; // milliseconds
  required: boolean;
  enabled: boolean;
  createdAt: Date;
}

export enum ComplianceFramework {
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  SOX = 'sox',
  PCI_DSS = 'pci_dss',
  ISO27001 = 'iso27001',
  SOC2 = 'soc2',
  CCPA = 'ccpa',
}

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  period: {
    start: Date;
    end: Date;
  };
  rules: ComplianceRuleResult[];
  summary: ComplianceSummary;
  generatedAt: Date;
}

export interface ComplianceRuleResult {
  rule: ComplianceRule;
  compliant: boolean;
  violations: AuditLog[];
  details: string;
}

export interface ComplianceSummary {
  totalRules: number;
  compliantRules: number;
  nonCompliantRules: number;
  totalViolations: number;
  complianceScore: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  eventTypes: AuditEventType[];
  retentionPeriod: number; // milliseconds
  archiveAfter?: number; // milliseconds
  deleteAfter?: number; // milliseconds
  enabled: boolean;
  createdAt: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  enabled: boolean;
  cooldown: number; // milliseconds
  lastTriggered?: Date;
  createdAt: Date;
}

export interface AlertCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export enum ConditionOperator {
  Equals = 'equals',
  NotEquals = 'not_equals',
  Contains = 'contains',
  GreaterThan = 'greater_than',
  LessThan = 'less_than',
  In = 'in',
  NotIn = 'not_in',
}

export interface AlertAction {
  type: AlertActionType;
  config: Record<string, any>;
}

export enum AlertActionType {
  Email = 'email',
  Webhook = 'webhook',
  SMS = 'sms',
  Slack = 'slack',
  PagerDuty = 'pagerduty',
}

export interface AuditStatistics {
  period: {
    start: Date;
    end: Date;
  };
  totalLogs: number;
  byEventType: Record<AuditEventType, number>;
  byCategory: Record<AuditCategory, number>;
  bySeverity: Record<AuditSeverity, number>;
  byOutcome: Record<AuditOutcome, number>;
  topActors: Array<{ actor: Actor; count: number }>;
  topResources: Array<{ resource: Resource; count: number }>;
  failureRate: number;
  averageDuration: number;
}

export interface ExportOptions {
  format: ExportFormat;
  query: AuditQuery;
  includeMetadata: boolean;
  compress: boolean;
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml',
  PDF = 'pdf',
}

export interface ArchivedLog {
  id: string;
  originalLogId: string;
  log: AuditLog;
  archivedAt: Date;
  storageLocation: string;
}

/**
 * Audit Logger
 */
export class AuditLogger {
  private logs: Map<string, AuditLog> = new Map();
  private archivedLogs: Map<string, ArchivedLog> = new Map();

  /**
   * Log audit event
   */
  log(event: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      ...event,
      id: this.generateLogId(),
      timestamp: new Date(),
    };

    this.logs.set(log.id, log);

    eventBus.emitSync('audit.log_created', log, 'AuditLogger');

    return log;
  }

  /**
   * Batch log
   */
  logBatch(events: Omit<AuditLog, 'id' | 'timestamp'>[]): AuditLog[] {
    const logs = events.map(event => this.log(event));
    return logs;
  }

  /**
   * Query logs
   */
  query(query: AuditQuery): AuditQueryResult {
    const startTime = Date.now();
    let results = Array.from(this.logs.values());

    // Apply filters
    if (query.startTime) {
      results = results.filter(log => log.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      results = results.filter(log => log.timestamp <= query.endTime!);
    }

    if (query.eventTypes && query.eventTypes.length > 0) {
      results = results.filter(log => query.eventTypes!.includes(log.eventType));
    }

    if (query.categories && query.categories.length > 0) {
      results = results.filter(log => query.categories!.includes(log.category));
    }

    if (query.severities && query.severities.length > 0) {
      results = results.filter(log => query.severities!.includes(log.severity));
    }

    if (query.actorId) {
      results = results.filter(log => log.actor.id === query.actorId);
    }

    if (query.resourceType) {
      results = results.filter(log => log.resource.type === query.resourceType);
    }

    if (query.resourceId) {
      results = results.filter(log => log.resource.id === query.resourceId);
    }

    if (query.outcome) {
      results = results.filter(log => log.outcome === query.outcome);
    }

    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(log =>
        log.action.toLowerCase().includes(searchLower) ||
        log.actor.name.toLowerCase().includes(searchLower) ||
        log.resource.name?.toLowerCase().includes(searchLower)
      );
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(log =>
        query.tags!.some(tag => log.tags.includes(tag))
      );
    }

    // Sort by timestamp desc
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = results.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    results = results.slice(offset, offset + limit);

    return {
      logs: results,
      total,
      offset,
      limit,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Get log by ID
   */
  getLog(logId: string): AuditLog | undefined {
    return this.logs.get(logId);
  }

  /**
   * Delete logs
   */
  deleteLogs(query: AuditQuery): number {
    const result = this.query(query);
    let deletedCount = 0;

    for (const log of result.logs) {
      if (this.logs.delete(log.id)) {
        deletedCount++;
      }
    }

    eventBus.emitSync('audit.logs_deleted', { count: deletedCount }, 'AuditLogger');

    return deletedCount;
  }

  /**
   * Archive logs
   */
  archiveLogs(query: AuditQuery): number {
    const result = this.query(query);
    let archivedCount = 0;

    for (const log of result.logs) {
      const archived: ArchivedLog = {
        id: this.generateLogId(),
        originalLogId: log.id,
        log,
        archivedAt: new Date(),
        storageLocation: `archive/${log.id}`,
      };

      this.archivedLogs.set(archived.id, archived);
      this.logs.delete(log.id);
      archivedCount++;
    }

    eventBus.emitSync('audit.logs_archived', { count: archivedCount }, 'AuditLogger');

    return archivedCount;
  }

  /**
   * Get statistics
   */
  getStatistics(startTime: Date, endTime: Date): AuditStatistics {
    const logs = Array.from(this.logs.values()).filter(
      log => log.timestamp >= startTime && log.timestamp <= endTime
    );

    const byEventType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const actorCounts = new Map<string, { actor: Actor; count: number }>();
    const resourceCounts = new Map<string, { resource: Resource; count: number }>();

    let totalDuration = 0;
    let durationCount = 0;
    let failureCount = 0;

    for (const log of logs) {
      byEventType[log.eventType] = (byEventType[log.eventType] || 0) + 1;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      byOutcome[log.outcome] = (byOutcome[log.outcome] || 0) + 1;

      // Track actors
      const actorKey = log.actor.id;
      if (!actorCounts.has(actorKey)) {
        actorCounts.set(actorKey, { actor: log.actor, count: 0 });
      }
      actorCounts.get(actorKey)!.count++;

      // Track resources
      const resourceKey = `${log.resource.type}:${log.resource.id}`;
      if (!resourceCounts.has(resourceKey)) {
        resourceCounts.set(resourceKey, { resource: log.resource, count: 0 });
      }
      resourceCounts.get(resourceKey)!.count++;

      // Track failures
      if (log.outcome === AuditOutcome.Failure || log.outcome === AuditOutcome.Error) {
        failureCount++;
      }

      // Track duration
      if (log.duration !== undefined) {
        totalDuration += log.duration;
        durationCount++;
      }
    }

    const topActors = Array.from(actorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topResources = Array.from(resourceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      period: { start: startTime, end: endTime },
      totalLogs: logs.length,
      byEventType: byEventType as Record<AuditEventType, number>,
      byCategory: byCategory as Record<AuditCategory, number>,
      bySeverity: bySeverity as Record<AuditSeverity, number>,
      byOutcome: byOutcome as Record<AuditOutcome, number>,
      topActors,
      topResources,
      failureRate: logs.length > 0 ? failureCount / logs.length : 0,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    };
  }

  /**
   * Export logs
   */
  async export(options: ExportOptions): Promise<string> {
    const result = this.query(options.query);

    // Mock export
    await new Promise(resolve => setTimeout(resolve, 100));

    const exportData = this.formatExport(result.logs, options.format);

    eventBus.emitSync('audit.logs_exported', { count: result.logs.length, format: options.format }, 'AuditLogger');

    return exportData;
  }

  private formatExport(logs: AuditLog[], format: ExportFormat): string {
    switch (format) {
      case ExportFormat.JSON:
        return JSON.stringify(logs, null, 2);

      case ExportFormat.CSV:
        const headers = ['ID', 'Timestamp', 'Event Type', 'Actor', 'Action', 'Outcome'];
        const rows = logs.map(log => [
          log.id,
          log.timestamp.toISOString(),
          log.eventType,
          log.actor.name,
          log.action,
          log.outcome,
        ].join(','));
        return [headers.join(','), ...rows].join('\n');

      case ExportFormat.XML:
        return `<?xml version="1.0"?>\n<logs>\n${logs.map(log => `  <log id="${log.id}"/>`).join('\n')}\n</logs>`;

      default:
        return JSON.stringify(logs);
    }
  }

  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Compliance Manager
 */
export class ComplianceManager {
  private rules: Map<string, ComplianceRule> = new Map();
  private reports: Map<string, ComplianceReport> = new Map();
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Create compliance rule
   */
  createRule(rule: Omit<ComplianceRule, 'id' | 'createdAt'>): ComplianceRule {
    const fullRule: ComplianceRule = {
      ...rule,
      id: this.generateRuleId(),
      createdAt: new Date(),
    };

    this.rules.set(fullRule.id, fullRule);

    eventBus.emitSync('audit.compliance_rule_created', fullRule, 'ComplianceManager');

    return fullRule;
  }

  /**
   * Generate compliance report
   */
  async generateReport(framework: ComplianceFramework, start: Date, end: Date): Promise<ComplianceReport> {
    const frameworkRules = Array.from(this.rules.values()).filter(
      rule => rule.framework === framework && rule.enabled
    );

    const ruleResults: ComplianceRuleResult[] = [];

    for (const rule of frameworkRules) {
      const violations = await this.checkRuleCompliance(rule, start, end);
      const compliant = violations.length === 0;

      ruleResults.push({
        rule,
        compliant,
        violations,
        details: compliant ? 'No violations found' : `${violations.length} violations detected`,
      });
    }

    const compliantRules = ruleResults.filter(r => r.compliant).length;
    const totalViolations = ruleResults.reduce((sum, r) => sum + r.violations.length, 0);

    const report: ComplianceReport = {
      id: this.generateReportId(),
      framework,
      period: { start, end },
      rules: ruleResults,
      summary: {
        totalRules: frameworkRules.length,
        compliantRules,
        nonCompliantRules: frameworkRules.length - compliantRules,
        totalViolations,
        complianceScore: frameworkRules.length > 0 ? compliantRules / frameworkRules.length : 1,
      },
      generatedAt: new Date(),
    };

    this.reports.set(report.id, report);

    eventBus.emitSync('audit.compliance_report_generated', report, 'ComplianceManager');

    return report;
  }

  /**
   * Get compliance rule
   */
  getRule(ruleId: string): ComplianceRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * List compliance rules
   */
  listRules(framework?: ComplianceFramework): ComplianceRule[] {
    let rules = Array.from(this.rules.values());

    if (framework) {
      rules = rules.filter(rule => rule.framework === framework);
    }

    return rules;
  }

  /**
   * Get report
   */
  getReport(reportId: string): ComplianceReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * List reports
   */
  listReports(framework?: ComplianceFramework): ComplianceReport[] {
    let reports = Array.from(this.reports.values());

    if (framework) {
      reports = reports.filter(report => report.framework === framework);
    }

    return reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  private async checkRuleCompliance(rule: ComplianceRule, start: Date, end: Date): Promise<AuditLog[]> {
    const result = this.auditLogger.query({
      startTime: start,
      endTime: end,
      eventTypes: rule.eventTypes,
      outcome: AuditOutcome.Failure,
    });

    return result.logs;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Retention Manager
 */
export class RetentionManager {
  private policies: Map<string, RetentionPolicy> = new Map();
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Create retention policy
   */
  createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt'>): RetentionPolicy {
    const fullPolicy: RetentionPolicy = {
      ...policy,
      id: this.generatePolicyId(),
      createdAt: new Date(),
    };

    this.policies.set(fullPolicy.id, fullPolicy);

    eventBus.emitSync('audit.retention_policy_created', fullPolicy, 'RetentionManager');

    return fullPolicy;
  }

  /**
   * Apply retention policies
   */
  async applyPolicies(): Promise<void> {
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      await this.applyPolicy(policy);
    }
  }

  /**
   * Apply single policy
   */
  private async applyPolicy(policy: RetentionPolicy): Promise<void> {
    const cutoffTime = new Date(Date.now() - policy.retentionPeriod);

    // Archive logs if archiveAfter is set
    if (policy.archiveAfter) {
      const archiveCutoff = new Date(Date.now() - policy.archiveAfter);
      const archivedCount = this.auditLogger.archiveLogs({
        endTime: archiveCutoff,
        eventTypes: policy.eventTypes,
      });

      if (archivedCount > 0) {
        eventBus.emitSync('audit.logs_archived_by_policy', { policyId: policy.id, count: archivedCount }, 'RetentionManager');
      }
    }

    // Delete logs if deleteAfter is set
    if (policy.deleteAfter) {
      const deleteCutoff = new Date(Date.now() - policy.deleteAfter);
      const deletedCount = this.auditLogger.deleteLogs({
        endTime: deleteCutoff,
        eventTypes: policy.eventTypes,
      });

      if (deletedCount > 0) {
        eventBus.emitSync('audit.logs_deleted_by_policy', { policyId: policy.id, count: deletedCount }, 'RetentionManager');
      }
    }
  }

  /**
   * Get policy
   */
  getPolicy(policyId: string): RetentionPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * List policies
   */
  listPolicies(): RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Delete policy
   */
  deletePolicy(policyId: string): void {
    this.policies.delete(policyId);
    eventBus.emitSync('audit.retention_policy_deleted', { policyId }, 'RetentionManager');
  }

  private generatePolicyId(): string {
    return `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Alert Rule Manager
 */
export class AlertRuleManager {
  private rules: Map<string, AlertRule> = new Map();

  /**
   * Create alert rule
   */
  createRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): AlertRule {
    const fullRule: AlertRule = {
      ...rule,
      id: this.generateRuleId(),
      createdAt: new Date(),
    };

    this.rules.set(fullRule.id, fullRule);

    eventBus.emitSync('audit.alert_rule_created', fullRule, 'AlertRuleManager');

    return fullRule;
  }

  /**
   * Evaluate alert rules
   */
  async evaluateRules(log: AuditLog): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldown) {
          continue;
        }
      }

      const matches = this.evaluateConditions(log, rule.conditions);

      if (matches) {
        rule.lastTriggered = new Date();
        await this.executeActions(rule, log);

        eventBus.emitSync('audit.alert_triggered', { rule, log }, 'AlertRuleManager');
      }
    }
  }

  /**
   * Get rule
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * List rules
   */
  listRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Delete rule
   */
  deleteRule(ruleId: string): void {
    this.rules.delete(ruleId);
    eventBus.emitSync('audit.alert_rule_deleted', { ruleId }, 'AlertRuleManager');
  }

  private evaluateConditions(log: AuditLog, conditions: AlertCondition[]): boolean {
    return conditions.every(condition => {
      const value = this.getFieldValue(log, condition.field);
      return this.evaluateCondition(value, condition.operator, condition.value);
    });
  }

  private getFieldValue(log: AuditLog, field: string): any {
    const parts = field.split('.');
    let value: any = log;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  private evaluateCondition(value: any, operator: ConditionOperator, expected: any): boolean {
    switch (operator) {
      case ConditionOperator.Equals:
        return value === expected;
      case ConditionOperator.NotEquals:
        return value !== expected;
      case ConditionOperator.Contains:
        return String(value).includes(String(expected));
      case ConditionOperator.GreaterThan:
        return value > expected;
      case ConditionOperator.LessThan:
        return value < expected;
      case ConditionOperator.In:
        return Array.isArray(expected) && expected.includes(value);
      case ConditionOperator.NotIn:
        return Array.isArray(expected) && !expected.includes(value);
      default:
        return false;
    }
  }

  private async executeActions(rule: AlertRule, log: AuditLog): Promise<void> {
    for (const action of rule.actions) {
      // Mock action execution
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private generateRuleId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const auditLogger = new AuditLogger();
export const complianceManager = new ComplianceManager(auditLogger);
export const retentionManager = new RetentionManager(auditLogger);
export const alertRuleManager = new AlertRuleManager();
