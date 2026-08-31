/**
 * Audit & Compliance System
 * Activity logging, compliance reporting, audit trails
 * Data retention, access control auditing, regulatory compliance
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AuditManagerConfig {
  enableActivityLogging: boolean;
  enableComplianceReporting: boolean;
  enableAccessAuditing: boolean;
  retentionPeriod: number;
  encryptLogs: boolean;
  realTimeAlerts: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  level: AuditLevel;
  category: AuditCategory;
  action: string;
  actor: Actor;
  resource?: ResourceReference;
  result: AuditResult;
  metadata: AuditMetadata;
  compliance: ComplianceInfo;
}

export type AuditLevel = 'info' | 'warning' | 'critical' | 'security';

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'configuration'
  | 'system'
  | 'security'
  | 'compliance'
  | 'api'
  | 'user_activity';

export interface Actor {
  id: string;
  type: ActorType;
  name?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export type ActorType = 'user' | 'service' | 'system' | 'admin' | 'anonymous';

export interface ResourceReference {
  id: string;
  type: string;
  name?: string;
  path?: string;
}

export type AuditResult = 'success' | 'failure' | 'partial' | 'denied';

export interface AuditMetadata {
  correlationId?: string;
  requestId?: string;
  duration?: number;
  changes?: Change[];
  context?: Record<string, any>;
  tags: string[];
  sensitive: boolean;
}

export interface Change {
  field: string;
  oldValue?: any;
  newValue?: any;
  operation: ChangeOperation;
}

export type ChangeOperation = 'create' | 'update' | 'delete' | 'read';

export interface ComplianceInfo {
  frameworks: ComplianceFramework[];
  controls: string[];
  requiresReview: boolean;
  retentionRequired: boolean;
  dataClassification?: DataClassification;
}

export type ComplianceFramework =
  | 'gdpr'
  | 'hipaa'
  | 'pci_dss'
  | 'sox'
  | 'iso27001'
  | 'ccpa'
  | 'fedramp'
  | 'custom';

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  period: ReportPeriod;
  controls: Map<string, ControlCompliance>;
  findings: Finding[];
  summary: ComplianceSummary;
  generatedAt: number;
}

export interface ReportPeriod {
  startDate: number;
  endDate: number;
}

export interface ControlCompliance {
  controlId: string;
  description: string;
  status: ComplianceStatus;
  evidence: Evidence[];
  lastAudited: number;
  nextAuditDue?: number;
}

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';

export interface Evidence {
  id: string;
  type: EvidenceType;
  description: string;
  timestamp: number;
  auditLogIds: string[];
  attachments?: string[];
}

export type EvidenceType = 'log' | 'screenshot' | 'document' | 'report' | 'attestation';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: string;
  description: string;
  controlId?: string;
  affectedResources: string[];
  recommendation: string;
  status: FindingStatus;
  identifiedAt: number;
  resolvedAt?: number;
}

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FindingStatus = 'open' | 'in_progress' | 'resolved' | 'accepted' | 'false_positive';

export interface ComplianceSummary {
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  complianceRate: number;
  criticalFindings: number;
  openFindings: number;
}

export interface AccessAudit {
  id: string;
  timestamp: number;
  actor: Actor;
  resource: ResourceReference;
  action: string;
  permission: string;
  decision: AccessDecision;
  reason?: string;
  policyEvaluated?: string;
}

export type AccessDecision = 'allow' | 'deny' | 'conditional';

export interface AuditQuery {
  startDate?: number;
  endDate?: number;
  levels?: AuditLevel[];
  categories?: AuditCategory[];
  actors?: string[];
  resources?: string[];
  results?: AuditResult[];
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  category: AuditCategory;
  retentionPeriod: number;
  archiveAfter?: number;
  deleteAfter: number;
  legalHold: boolean;
  compliance: ComplianceFramework[];
}

export interface DataRetentionRecord {
  id: string;
  auditLogId: string;
  policyId: string;
  status: RetentionStatus;
  archivedAt?: number;
  scheduledDeletion?: number;
  legalHold: boolean;
}

export type RetentionStatus = 'active' | 'archived' | 'pending_deletion' | 'deleted';

// ============================================================================
// Audit Manager
// ============================================================================

export class AuditManager extends EventEmitter {
  private config: AuditManagerConfig;
  private auditLogs: Map<string, AuditLog> = new Map();
  private accessAudits: Map<string, AccessAudit> = new Map();
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private retentionRecords: Map<string, DataRetentionRecord> = new Map();
  private complianceReports: Map<string, ComplianceReport> = new Map();
  private findings: Map<string, Finding> = new Map();

  constructor(config: Partial<AuditManagerConfig> = {}) {
    super();
    this.config = {
      enableActivityLogging: true,
      enableComplianceReporting: true,
      enableAccessAuditing: true,
      retentionPeriod: 2592000000, // 30 days
      encryptLogs: true,
      realTimeAlerts: true,
      ...config,
    };

    this.initializeDefaultPolicies();
    this.startRetentionScheduler();
  }

  // ========================================================================
  // Audit Logging
  // ========================================================================

  public log(
    category: AuditCategory,
    action: string,
    actor: Actor,
    options: LogOptions = {}
  ): AuditLog {
    if (!this.config.enableActivityLogging) {
      throw new Error('Activity logging is not enabled');
    }

    const auditLog: AuditLog = {
      id: this.generateId(),
      timestamp: Date.now(),
      level: options.level || 'info',
      category,
      action,
      actor,
      resource: options.resource,
      result: options.result || 'success',
      metadata: {
        correlationId: options.correlationId,
        requestId: options.requestId,
        duration: options.duration,
        changes: options.changes,
        context: options.context,
        tags: options.tags || [],
        sensitive: options.sensitive || false,
      },
      compliance: {
        frameworks: options.frameworks || [],
        controls: options.controls || [],
        requiresReview: options.requiresReview || false,
        retentionRequired: options.retentionRequired ?? true,
        dataClassification: options.dataClassification,
      },
    };

    this.auditLogs.set(auditLog.id, auditLog);

    // Apply retention policy
    this.applyRetentionPolicy(auditLog);

    // Emit real-time alert if critical
    if (this.config.realTimeAlerts && auditLog.level === 'critical') {
      this.emit('audit:critical', { log: auditLog });
    }

    this.emit('audit:logged', { log: auditLog });

    return auditLog;
  }

  public logAuthentication(
    actor: Actor,
    success: boolean,
    method: string,
    options: Partial<LogOptions> = {}
  ): AuditLog {
    return this.log('authentication', `Authentication via ${method}`, actor, {
      ...options,
      result: success ? 'success' : 'failure',
      level: success ? 'info' : 'security',
      frameworks: ['iso27001', 'sox'],
      controls: ['AC-2', 'IA-2'],
    });
  }

  public logDataAccess(
    actor: Actor,
    resource: ResourceReference,
    operation: ChangeOperation,
    options: Partial<LogOptions> = {}
  ): AuditLog {
    return this.log('data_access', `${operation} ${resource.type}`, actor, {
      ...options,
      resource,
      sensitive: true,
      frameworks: ['gdpr', 'hipaa'],
      controls: ['AC-3', 'AU-2'],
    });
  }

  public logDataModification(
    actor: Actor,
    resource: ResourceReference,
    changes: Change[],
    options: Partial<LogOptions> = {}
  ): AuditLog {
    return this.log('data_modification', 'Data modification', actor, {
      ...options,
      resource,
      changes,
      sensitive: true,
      requiresReview: true,
      frameworks: ['gdpr', 'hipaa', 'sox'],
      controls: ['AC-6', 'AU-10'],
    });
  }

  public logConfigurationChange(
    actor: Actor,
    resource: ResourceReference,
    changes: Change[],
    options: Partial<LogOptions> = {}
  ): AuditLog {
    return this.log('configuration', 'Configuration change', actor, {
      ...options,
      resource,
      changes,
      level: 'warning',
      requiresReview: true,
      frameworks: ['iso27001', 'fedramp'],
      controls: ['CM-3', 'CM-5'],
    });
  }

  // ========================================================================
  // Access Auditing
  // ========================================================================

  public logAccess(
    actor: Actor,
    resource: ResourceReference,
    action: string,
    permission: string,
    decision: AccessDecision,
    options: AccessAuditOptions = {}
  ): AccessAudit {
    if (!this.config.enableAccessAuditing) {
      throw new Error('Access auditing is not enabled');
    }

    const accessAudit: AccessAudit = {
      id: this.generateId(),
      timestamp: Date.now(),
      actor,
      resource,
      action,
      permission,
      decision,
      reason: options.reason,
      policyEvaluated: options.policyEvaluated,
    };

    this.accessAudits.set(accessAudit.id, accessAudit);

    // Also create audit log for denied access
    if (decision === 'deny') {
      this.log('authorization', `Access denied: ${action} on ${resource.type}`, actor, {
        resource,
        result: 'denied',
        level: 'security',
        frameworks: ['iso27001'],
        controls: ['AC-3', 'AC-4'],
      });
    }

    this.emit('access:audited', { audit: accessAudit });

    return accessAudit;
  }

  // ========================================================================
  // Query & Search
  // ========================================================================

  public query(query: AuditQuery): AuditLog[] {
    let results = Array.from(this.auditLogs.values());

    // Filter by date range
    if (query.startDate) {
      results = results.filter(log => log.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(log => log.timestamp <= query.endDate!);
    }

    // Filter by levels
    if (query.levels && query.levels.length > 0) {
      results = results.filter(log => query.levels!.includes(log.level));
    }

    // Filter by categories
    if (query.categories && query.categories.length > 0) {
      results = results.filter(log => query.categories!.includes(log.category));
    }

    // Filter by actors
    if (query.actors && query.actors.length > 0) {
      results = results.filter(log => query.actors!.includes(log.actor.id));
    }

    // Filter by resources
    if (query.resources && query.resources.length > 0) {
      results = results.filter(
        log => log.resource && query.resources!.includes(log.resource.id)
      );
    }

    // Filter by results
    if (query.results && query.results.length > 0) {
      results = results.filter(log => query.results!.includes(log.result));
    }

    // Search text
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(
        log =>
          log.action.toLowerCase().includes(searchLower) ||
          log.actor.name?.toLowerCase().includes(searchLower) ||
          log.resource?.name?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  public getAccessAudits(
    actorId?: string,
    resourceId?: string,
    startDate?: number,
    endDate?: number
  ): AccessAudit[] {
    let results = Array.from(this.accessAudits.values());

    if (actorId) {
      results = results.filter(audit => audit.actor.id === actorId);
    }

    if (resourceId) {
      results = results.filter(audit => audit.resource.id === resourceId);
    }

    if (startDate) {
      results = results.filter(audit => audit.timestamp >= startDate);
    }

    if (endDate) {
      results = results.filter(audit => audit.timestamp <= endDate);
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ========================================================================
  // Compliance Reporting
  // ========================================================================

  public generateComplianceReport(
    framework: ComplianceFramework,
    startDate: number,
    endDate: number
  ): ComplianceReport {
    if (!this.config.enableComplianceReporting) {
      throw new Error('Compliance reporting is not enabled');
    }

    const controls = this.getControlsForFramework(framework);
    const controlCompliance = new Map<string, ControlCompliance>();

    // Evaluate each control
    for (const [controlId, description] of controls.entries()) {
      const evidence = this.collectEvidence(controlId, startDate, endDate);
      const status = this.evaluateControlCompliance(controlId, evidence);

      controlCompliance.set(controlId, {
        controlId,
        description,
        status,
        evidence,
        lastAudited: Date.now(),
        nextAuditDue: Date.now() + 7776000000, // 90 days
      });
    }

    // Calculate summary
    const totalControls = controls.size;
    const compliantControls = Array.from(controlCompliance.values()).filter(
      c => c.status === 'compliant'
    ).length;
    const nonCompliantControls = Array.from(controlCompliance.values()).filter(
      c => c.status === 'non_compliant'
    ).length;

    const findingsArray = Array.from(this.findings.values()).filter(
      f => f.status === 'open'
    );
    const criticalFindings = findingsArray.filter(f => f.severity === 'critical').length;

    const report: ComplianceReport = {
      id: this.generateId(),
      framework,
      period: { startDate, endDate },
      controls: controlCompliance,
      findings: findingsArray,
      summary: {
        totalControls,
        compliantControls,
        nonCompliantControls,
        complianceRate: (compliantControls / totalControls) * 100,
        criticalFindings,
        openFindings: findingsArray.length,
      },
      generatedAt: Date.now(),
    };

    this.complianceReports.set(report.id, report);
    this.emit('compliance:report:generated', { report });

    return report;
  }

  private getControlsForFramework(framework: ComplianceFramework): Map<string, string> {
    const controls = new Map<string, string>();

    switch (framework) {
      case 'iso27001':
        controls.set('AC-2', 'Account Management');
        controls.set('AC-3', 'Access Enforcement');
        controls.set('AC-6', 'Least Privilege');
        controls.set('AU-2', 'Audit Events');
        controls.set('AU-10', 'Non-repudiation');
        controls.set('IA-2', 'Identification and Authentication');
        controls.set('CM-3', 'Configuration Change Control');
        controls.set('CM-5', 'Access Restrictions for Change');
        break;

      case 'gdpr':
        controls.set('GDPR-7.1', 'Lawfulness of Processing');
        controls.set('GDPR-7.2', 'Transparency');
        controls.set('GDPR-7.3', 'Data Minimization');
        controls.set('GDPR-7.4', 'Accuracy');
        controls.set('GDPR-7.5', 'Storage Limitation');
        controls.set('GDPR-7.6', 'Integrity and Confidentiality');
        break;

      case 'hipaa':
        controls.set('HIPAA-164.308', 'Administrative Safeguards');
        controls.set('HIPAA-164.310', 'Physical Safeguards');
        controls.set('HIPAA-164.312', 'Technical Safeguards');
        break;

      case 'sox':
        controls.set('SOX-404', 'Management Assessment of Internal Controls');
        controls.set('SOX-302', 'Corporate Responsibility for Financial Reports');
        break;
    }

    return controls;
  }

  private collectEvidence(
    controlId: string,
    startDate: number,
    endDate: number
  ): Evidence[] {
    const relevantLogs = Array.from(this.auditLogs.values()).filter(
      log =>
        log.timestamp >= startDate &&
        log.timestamp <= endDate &&
        log.compliance.controls.includes(controlId)
    );

    if (relevantLogs.length === 0) return [];

    return [
      {
        id: this.generateId(),
        type: 'log',
        description: `${relevantLogs.length} audit log entries supporting this control`,
        timestamp: Date.now(),
        auditLogIds: relevantLogs.map(log => log.id),
      },
    ];
  }

  private evaluateControlCompliance(
    controlId: string,
    evidence: Evidence[]
  ): ComplianceStatus {
    if (evidence.length === 0) {
      return 'not_applicable';
    }

    // Simplified evaluation - in production, implement proper control logic
    return evidence.length > 0 ? 'compliant' : 'non_compliant';
  }

  // ========================================================================
  // Findings Management
  // ========================================================================

  public createFinding(
    severity: FindingSeverity,
    category: string,
    description: string,
    options: FindingOptions = {}
  ): Finding {
    const finding: Finding = {
      id: this.generateId(),
      severity,
      category,
      description,
      controlId: options.controlId,
      affectedResources: options.affectedResources || [],
      recommendation: options.recommendation || '',
      status: 'open',
      identifiedAt: Date.now(),
    };

    this.findings.set(finding.id, finding);
    this.emit('finding:created', { finding });

    return finding;
  }

  public resolveFinding(findingId: string, resolution: string): void {
    const finding = this.findings.get(findingId);
    if (finding) {
      finding.status = 'resolved';
      finding.resolvedAt = Date.now();
      this.emit('finding:resolved', { finding, resolution });
    }
  }

  // ========================================================================
  // Data Retention
  // ========================================================================

  private initializeDefaultPolicies(): void {
    // Security logs - 1 year retention
    this.createRetentionPolicy(
      'Security Logs',
      'security',
      31536000000,
      ['iso27001', 'sox']
    );

    // Authentication logs - 90 days
    this.createRetentionPolicy(
      'Authentication Logs',
      'authentication',
      7776000000,
      ['iso27001']
    );

    // Data access logs - 1 year (compliance requirement)
    this.createRetentionPolicy(
      'Data Access Logs',
      'data_access',
      31536000000,
      ['gdpr', 'hipaa']
    );
  }

  public createRetentionPolicy(
    name: string,
    category: AuditCategory,
    retentionPeriod: number,
    compliance: ComplianceFramework[]
  ): RetentionPolicy {
    const policy: RetentionPolicy = {
      id: this.generateId(),
      name,
      category,
      retentionPeriod,
      deleteAfter: retentionPeriod,
      legalHold: false,
      compliance,
    };

    this.retentionPolicies.set(policy.id, policy);
    this.emit('retention:policy:created', { policy });

    return policy;
  }

  private applyRetentionPolicy(auditLog: AuditLog): void {
    const policy = Array.from(this.retentionPolicies.values()).find(
      p => p.category === auditLog.category
    );

    if (policy) {
      const record: DataRetentionRecord = {
        id: this.generateId(),
        auditLogId: auditLog.id,
        policyId: policy.id,
        status: 'active',
        scheduledDeletion: auditLog.timestamp + policy.deleteAfter,
        legalHold: policy.legalHold,
      };

      this.retentionRecords.set(record.id, record);
    }
  }

  private startRetentionScheduler(): void {
    setInterval(() => {
      this.processRetention();
    }, 86400000); // Daily
  }

  private processRetention(): void {
    const now = Date.now();

    for (const record of this.retentionRecords.values()) {
      if (record.legalHold) continue;

      if (record.status === 'active' && record.scheduledDeletion && now >= record.scheduledDeletion) {
        // Mark for deletion
        record.status = 'pending_deletion';
        this.emit('retention:pending_deletion', { record });
      }

      if (record.status === 'pending_deletion') {
        // Delete after grace period
        this.auditLogs.delete(record.auditLogId);
        record.status = 'deleted';
        this.emit('retention:deleted', { record });
      }
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats(): AuditStats {
    return {
      totalLogs: this.auditLogs.size,
      accessAudits: this.accessAudits.size,
      retentionPolicies: this.retentionPolicies.size,
      complianceReports: this.complianceReports.size,
      openFindings: Array.from(this.findings.values()).filter(f => f.status === 'open').length,
      criticalLogs: Array.from(this.auditLogs.values()).filter(l => l.level === 'critical').length,
    };
  }

  public exportLogs(startDate: number, endDate: number): AuditLog[] {
    return Array.from(this.auditLogs.values()).filter(
      log => log.timestamp >= startDate && log.timestamp <= endDate
    );
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface LogOptions {
  level?: AuditLevel;
  resource?: ResourceReference;
  result?: AuditResult;
  correlationId?: string;
  requestId?: string;
  duration?: number;
  changes?: Change[];
  context?: Record<string, any>;
  tags?: string[];
  sensitive?: boolean;
  frameworks?: ComplianceFramework[];
  controls?: string[];
  requiresReview?: boolean;
  retentionRequired?: boolean;
  dataClassification?: DataClassification;
}

interface AccessAuditOptions {
  reason?: string;
  policyEvaluated?: string;
}

interface FindingOptions {
  controlId?: string;
  affectedResources?: string[];
  recommendation?: string;
}

interface AuditStats {
  totalLogs: number;
  accessAudits: number;
  retentionPolicies: number;
  complianceReports: number;
  openFindings: number;
  criticalLogs: number;
}

// ============================================================================
// Export
// ============================================================================

export default AuditManager;
