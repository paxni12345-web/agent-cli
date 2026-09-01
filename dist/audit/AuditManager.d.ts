/**
 * Audit & Compliance System
 * Activity logging, compliance reporting, audit trails
 * Data retention, access control auditing, regulatory compliance
 */
import { EventEmitter } from 'events';
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
export type AuditCategory = 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'configuration' | 'system' | 'security' | 'compliance' | 'api' | 'user_activity';
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
export type ComplianceFramework = 'gdpr' | 'hipaa' | 'pci_dss' | 'sox' | 'iso27001' | 'ccpa' | 'fedramp' | 'custom';
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
export declare class AuditManager extends EventEmitter {
    private config;
    private auditLogs;
    private accessAudits;
    private retentionPolicies;
    private retentionRecords;
    private complianceReports;
    private findings;
    constructor(config?: Partial<AuditManagerConfig>);
    log(category: AuditCategory, action: string, actor: Actor, options?: LogOptions): AuditLog;
    logAuthentication(actor: Actor, success: boolean, method: string, options?: Partial<LogOptions>): AuditLog;
    logDataAccess(actor: Actor, resource: ResourceReference, operation: ChangeOperation, options?: Partial<LogOptions>): AuditLog;
    logDataModification(actor: Actor, resource: ResourceReference, changes: Change[], options?: Partial<LogOptions>): AuditLog;
    logConfigurationChange(actor: Actor, resource: ResourceReference, changes: Change[], options?: Partial<LogOptions>): AuditLog;
    logAccess(actor: Actor, resource: ResourceReference, action: string, permission: string, decision: AccessDecision, options?: AccessAuditOptions): AccessAudit;
    query(query: AuditQuery): AuditLog[];
    getAccessAudits(actorId?: string, resourceId?: string, startDate?: number, endDate?: number): AccessAudit[];
    generateComplianceReport(framework: ComplianceFramework, startDate: number, endDate: number): ComplianceReport;
    private getControlsForFramework;
    private collectEvidence;
    private evaluateControlCompliance;
    createFinding(severity: FindingSeverity, category: string, description: string, options?: FindingOptions): Finding;
    resolveFinding(findingId: string, resolution: string): void;
    private initializeDefaultPolicies;
    createRetentionPolicy(name: string, category: AuditCategory, retentionPeriod: number, compliance: ComplianceFramework[]): RetentionPolicy;
    private applyRetentionPolicy;
    private startRetentionScheduler;
    private processRetention;
    private generateId;
    getStats(): AuditStats;
    exportLogs(startDate: number, endDate: number): AuditLog[];
}
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
export default AuditManager;
//# sourceMappingURL=AuditManager.d.ts.map