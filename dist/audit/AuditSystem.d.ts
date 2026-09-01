/**
 * Audit Logging System
 * Comprehensive audit trail, compliance tracking, and security event logging
 */
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
export declare enum AuditEventType {
    Authentication = "authentication",
    Authorization = "authorization",
    DataAccess = "data_access",
    DataModification = "data_modification",
    DataDeletion = "data_deletion",
    Configuration = "configuration",
    Security = "security",
    Compliance = "compliance",
    SystemEvent = "system_event",
    UserAction = "user_action",
    APICall = "api_call",
    FileAccess = "file_access",
    AdminAction = "admin_action"
}
export declare enum AuditCategory {
    Security = "security",
    Privacy = "privacy",
    Financial = "financial",
    Operational = "operational",
    Administrative = "administrative",
    Compliance = "compliance"
}
export declare enum AuditSeverity {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low",
    Info = "info"
}
export interface Actor {
    type: ActorType;
    id: string;
    name: string;
    email?: string;
    roles?: string[];
    department?: string;
}
export declare enum ActorType {
    User = "user",
    System = "system",
    Service = "service",
    API = "api",
    Anonymous = "anonymous"
}
export interface Resource {
    type: string;
    id: string;
    name?: string;
    attributes?: Record<string, any>;
}
export declare enum AuditOutcome {
    Success = "success",
    Failure = "failure",
    Partial = "partial",
    Denied = "denied",
    Error = "error"
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
    retentionPeriod: number;
    required: boolean;
    enabled: boolean;
    createdAt: Date;
}
export declare enum ComplianceFramework {
    GDPR = "gdpr",
    HIPAA = "hipaa",
    SOX = "sox",
    PCI_DSS = "pci_dss",
    ISO27001 = "iso27001",
    SOC2 = "soc2",
    CCPA = "ccpa"
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
    retentionPeriod: number;
    archiveAfter?: number;
    deleteAfter?: number;
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
    cooldown: number;
    lastTriggered?: Date;
    createdAt: Date;
}
export interface AlertCondition {
    field: string;
    operator: ConditionOperator;
    value: any;
}
export declare enum ConditionOperator {
    Equals = "equals",
    NotEquals = "not_equals",
    Contains = "contains",
    GreaterThan = "greater_than",
    LessThan = "less_than",
    In = "in",
    NotIn = "not_in"
}
export interface AlertAction {
    type: AlertActionType;
    config: Record<string, any>;
}
export declare enum AlertActionType {
    Email = "email",
    Webhook = "webhook",
    SMS = "sms",
    Slack = "slack",
    PagerDuty = "pagerduty"
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
    topActors: Array<{
        actor: Actor;
        count: number;
    }>;
    topResources: Array<{
        resource: Resource;
        count: number;
    }>;
    failureRate: number;
    averageDuration: number;
}
export interface ExportOptions {
    format: ExportFormat;
    query: AuditQuery;
    includeMetadata: boolean;
    compress: boolean;
}
export declare enum ExportFormat {
    JSON = "json",
    CSV = "csv",
    XML = "xml",
    PDF = "pdf"
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
export declare class AuditLogger {
    private logs;
    private archivedLogs;
    /**
     * Log audit event
     */
    log(event: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog;
    /**
     * Batch log
     */
    logBatch(events: Omit<AuditLog, 'id' | 'timestamp'>[]): AuditLog[];
    /**
     * Query logs
     */
    query(query: AuditQuery): AuditQueryResult;
    /**
     * Get log by ID
     */
    getLog(logId: string): AuditLog | undefined;
    /**
     * Delete logs
     */
    deleteLogs(query: AuditQuery): number;
    /**
     * Archive logs
     */
    archiveLogs(query: AuditQuery): number;
    /**
     * Get statistics
     */
    getStatistics(startTime: Date, endTime: Date): AuditStatistics;
    /**
     * Export logs
     */
    export(options: ExportOptions): Promise<string>;
    private formatExport;
    private generateLogId;
}
/**
 * Compliance Manager
 */
export declare class ComplianceManager {
    private rules;
    private reports;
    private auditLogger;
    constructor(auditLogger: AuditLogger);
    /**
     * Create compliance rule
     */
    createRule(rule: Omit<ComplianceRule, 'id' | 'createdAt'>): ComplianceRule;
    /**
     * Generate compliance report
     */
    generateReport(framework: ComplianceFramework, start: Date, end: Date): Promise<ComplianceReport>;
    /**
     * Get compliance rule
     */
    getRule(ruleId: string): ComplianceRule | undefined;
    /**
     * List compliance rules
     */
    listRules(framework?: ComplianceFramework): ComplianceRule[];
    /**
     * Get report
     */
    getReport(reportId: string): ComplianceReport | undefined;
    /**
     * List reports
     */
    listReports(framework?: ComplianceFramework): ComplianceReport[];
    private checkRuleCompliance;
    private generateRuleId;
    private generateReportId;
}
/**
 * Retention Manager
 */
export declare class RetentionManager {
    private policies;
    private auditLogger;
    constructor(auditLogger: AuditLogger);
    /**
     * Create retention policy
     */
    createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt'>): RetentionPolicy;
    /**
     * Apply retention policies
     */
    applyPolicies(): Promise<void>;
    /**
     * Apply single policy
     */
    private applyPolicy;
    /**
     * Get policy
     */
    getPolicy(policyId: string): RetentionPolicy | undefined;
    /**
     * List policies
     */
    listPolicies(): RetentionPolicy[];
    /**
     * Delete policy
     */
    deletePolicy(policyId: string): void;
    private generatePolicyId;
}
/**
 * Alert Rule Manager
 */
export declare class AlertRuleManager {
    private rules;
    /**
     * Create alert rule
     */
    createRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): AlertRule;
    /**
     * Evaluate alert rules
     */
    evaluateRules(log: AuditLog): Promise<void>;
    /**
     * Get rule
     */
    getRule(ruleId: string): AlertRule | undefined;
    /**
     * List rules
     */
    listRules(): AlertRule[];
    /**
     * Delete rule
     */
    deleteRule(ruleId: string): void;
    private evaluateConditions;
    private getFieldValue;
    private evaluateCondition;
    private executeActions;
    private generateRuleId;
}
/**
 * Singleton instances
 */
export declare const auditLogger: AuditLogger;
export declare const complianceManager: ComplianceManager;
export declare const retentionManager: RetentionManager;
export declare const alertRuleManager: AlertRuleManager;
//# sourceMappingURL=AuditSystem.d.ts.map