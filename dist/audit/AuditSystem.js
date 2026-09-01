"use strict";
/**
 * Audit Logging System
 * Comprehensive audit trail, compliance tracking, and security event logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertRuleManager = exports.retentionManager = exports.complianceManager = exports.auditLogger = exports.AlertRuleManager = exports.RetentionManager = exports.ComplianceManager = exports.AuditLogger = exports.ExportFormat = exports.AlertActionType = exports.ConditionOperator = exports.ComplianceFramework = exports.AuditOutcome = exports.ActorType = exports.AuditSeverity = exports.AuditCategory = exports.AuditEventType = void 0;
const EventBus_1 = require("../core/EventBus");
var AuditEventType;
(function (AuditEventType) {
    AuditEventType["Authentication"] = "authentication";
    AuditEventType["Authorization"] = "authorization";
    AuditEventType["DataAccess"] = "data_access";
    AuditEventType["DataModification"] = "data_modification";
    AuditEventType["DataDeletion"] = "data_deletion";
    AuditEventType["Configuration"] = "configuration";
    AuditEventType["Security"] = "security";
    AuditEventType["Compliance"] = "compliance";
    AuditEventType["SystemEvent"] = "system_event";
    AuditEventType["UserAction"] = "user_action";
    AuditEventType["APICall"] = "api_call";
    AuditEventType["FileAccess"] = "file_access";
    AuditEventType["AdminAction"] = "admin_action";
})(AuditEventType || (exports.AuditEventType = AuditEventType = {}));
var AuditCategory;
(function (AuditCategory) {
    AuditCategory["Security"] = "security";
    AuditCategory["Privacy"] = "privacy";
    AuditCategory["Financial"] = "financial";
    AuditCategory["Operational"] = "operational";
    AuditCategory["Administrative"] = "administrative";
    AuditCategory["Compliance"] = "compliance";
})(AuditCategory || (exports.AuditCategory = AuditCategory = {}));
var AuditSeverity;
(function (AuditSeverity) {
    AuditSeverity["Critical"] = "critical";
    AuditSeverity["High"] = "high";
    AuditSeverity["Medium"] = "medium";
    AuditSeverity["Low"] = "low";
    AuditSeverity["Info"] = "info";
})(AuditSeverity || (exports.AuditSeverity = AuditSeverity = {}));
var ActorType;
(function (ActorType) {
    ActorType["User"] = "user";
    ActorType["System"] = "system";
    ActorType["Service"] = "service";
    ActorType["API"] = "api";
    ActorType["Anonymous"] = "anonymous";
})(ActorType || (exports.ActorType = ActorType = {}));
var AuditOutcome;
(function (AuditOutcome) {
    AuditOutcome["Success"] = "success";
    AuditOutcome["Failure"] = "failure";
    AuditOutcome["Partial"] = "partial";
    AuditOutcome["Denied"] = "denied";
    AuditOutcome["Error"] = "error";
})(AuditOutcome || (exports.AuditOutcome = AuditOutcome = {}));
var ComplianceFramework;
(function (ComplianceFramework) {
    ComplianceFramework["GDPR"] = "gdpr";
    ComplianceFramework["HIPAA"] = "hipaa";
    ComplianceFramework["SOX"] = "sox";
    ComplianceFramework["PCI_DSS"] = "pci_dss";
    ComplianceFramework["ISO27001"] = "iso27001";
    ComplianceFramework["SOC2"] = "soc2";
    ComplianceFramework["CCPA"] = "ccpa";
})(ComplianceFramework || (exports.ComplianceFramework = ComplianceFramework = {}));
var ConditionOperator;
(function (ConditionOperator) {
    ConditionOperator["Equals"] = "equals";
    ConditionOperator["NotEquals"] = "not_equals";
    ConditionOperator["Contains"] = "contains";
    ConditionOperator["GreaterThan"] = "greater_than";
    ConditionOperator["LessThan"] = "less_than";
    ConditionOperator["In"] = "in";
    ConditionOperator["NotIn"] = "not_in";
})(ConditionOperator || (exports.ConditionOperator = ConditionOperator = {}));
var AlertActionType;
(function (AlertActionType) {
    AlertActionType["Email"] = "email";
    AlertActionType["Webhook"] = "webhook";
    AlertActionType["SMS"] = "sms";
    AlertActionType["Slack"] = "slack";
    AlertActionType["PagerDuty"] = "pagerduty";
})(AlertActionType || (exports.AlertActionType = AlertActionType = {}));
var ExportFormat;
(function (ExportFormat) {
    ExportFormat["JSON"] = "json";
    ExportFormat["CSV"] = "csv";
    ExportFormat["XML"] = "xml";
    ExportFormat["PDF"] = "pdf";
})(ExportFormat || (exports.ExportFormat = ExportFormat = {}));
/**
 * Audit Logger
 */
class AuditLogger {
    logs = new Map();
    archivedLogs = new Map();
    /**
     * Log audit event
     */
    log(event) {
        const log = {
            ...event,
            id: this.generateLogId(),
            timestamp: new Date(),
        };
        this.logs.set(log.id, log);
        EventBus_1.eventBus.emitSync('audit.log_created', log, 'AuditLogger');
        return log;
    }
    /**
     * Batch log
     */
    logBatch(events) {
        const logs = events.map(event => this.log(event));
        return logs;
    }
    /**
     * Query logs
     */
    query(query) {
        const startTime = Date.now();
        let results = Array.from(this.logs.values());
        // Apply filters
        if (query.startTime) {
            results = results.filter(log => log.timestamp >= query.startTime);
        }
        if (query.endTime) {
            results = results.filter(log => log.timestamp <= query.endTime);
        }
        if (query.eventTypes && query.eventTypes.length > 0) {
            results = results.filter(log => query.eventTypes.includes(log.eventType));
        }
        if (query.categories && query.categories.length > 0) {
            results = results.filter(log => query.categories.includes(log.category));
        }
        if (query.severities && query.severities.length > 0) {
            results = results.filter(log => query.severities.includes(log.severity));
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
            results = results.filter(log => log.action.toLowerCase().includes(searchLower) ||
                log.actor.name.toLowerCase().includes(searchLower) ||
                log.resource.name?.toLowerCase().includes(searchLower));
        }
        if (query.tags && query.tags.length > 0) {
            results = results.filter(log => query.tags.some(tag => log.tags.includes(tag)));
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
    getLog(logId) {
        return this.logs.get(logId);
    }
    /**
     * Delete logs
     */
    deleteLogs(query) {
        const result = this.query(query);
        let deletedCount = 0;
        for (const log of result.logs) {
            if (this.logs.delete(log.id)) {
                deletedCount++;
            }
        }
        EventBus_1.eventBus.emitSync('audit.logs_deleted', { count: deletedCount }, 'AuditLogger');
        return deletedCount;
    }
    /**
     * Archive logs
     */
    archiveLogs(query) {
        const result = this.query(query);
        let archivedCount = 0;
        for (const log of result.logs) {
            const archived = {
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
        EventBus_1.eventBus.emitSync('audit.logs_archived', { count: archivedCount }, 'AuditLogger');
        return archivedCount;
    }
    /**
     * Get statistics
     */
    getStatistics(startTime, endTime) {
        const logs = Array.from(this.logs.values()).filter(log => log.timestamp >= startTime && log.timestamp <= endTime);
        const byEventType = {};
        const byCategory = {};
        const bySeverity = {};
        const byOutcome = {};
        const actorCounts = new Map();
        const resourceCounts = new Map();
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
            actorCounts.get(actorKey).count++;
            // Track resources
            const resourceKey = `${log.resource.type}:${log.resource.id}`;
            if (!resourceCounts.has(resourceKey)) {
                resourceCounts.set(resourceKey, { resource: log.resource, count: 0 });
            }
            resourceCounts.get(resourceKey).count++;
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
            byEventType: byEventType,
            byCategory: byCategory,
            bySeverity: bySeverity,
            byOutcome: byOutcome,
            topActors,
            topResources,
            failureRate: logs.length > 0 ? failureCount / logs.length : 0,
            averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
        };
    }
    /**
     * Export logs
     */
    async export(options) {
        const result = this.query(options.query);
        // Mock export
        await new Promise(resolve => setTimeout(resolve, 100));
        const exportData = this.formatExport(result.logs, options.format);
        EventBus_1.eventBus.emitSync('audit.logs_exported', { count: result.logs.length, format: options.format }, 'AuditLogger');
        return exportData;
    }
    formatExport(logs, format) {
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
    generateLogId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AuditLogger = AuditLogger;
/**
 * Compliance Manager
 */
class ComplianceManager {
    rules = new Map();
    reports = new Map();
    auditLogger;
    constructor(auditLogger) {
        this.auditLogger = auditLogger;
    }
    /**
     * Create compliance rule
     */
    createRule(rule) {
        const fullRule = {
            ...rule,
            id: this.generateRuleId(),
            createdAt: new Date(),
        };
        this.rules.set(fullRule.id, fullRule);
        EventBus_1.eventBus.emitSync('audit.compliance_rule_created', fullRule, 'ComplianceManager');
        return fullRule;
    }
    /**
     * Generate compliance report
     */
    async generateReport(framework, start, end) {
        const frameworkRules = Array.from(this.rules.values()).filter(rule => rule.framework === framework && rule.enabled);
        const ruleResults = [];
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
        const report = {
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
        EventBus_1.eventBus.emitSync('audit.compliance_report_generated', report, 'ComplianceManager');
        return report;
    }
    /**
     * Get compliance rule
     */
    getRule(ruleId) {
        return this.rules.get(ruleId);
    }
    /**
     * List compliance rules
     */
    listRules(framework) {
        let rules = Array.from(this.rules.values());
        if (framework) {
            rules = rules.filter(rule => rule.framework === framework);
        }
        return rules;
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
    listReports(framework) {
        let reports = Array.from(this.reports.values());
        if (framework) {
            reports = reports.filter(report => report.framework === framework);
        }
        return reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
    }
    async checkRuleCompliance(rule, start, end) {
        const result = this.auditLogger.query({
            startTime: start,
            endTime: end,
            eventTypes: rule.eventTypes,
            outcome: AuditOutcome.Failure,
        });
        return result.logs;
    }
    generateRuleId() {
        return `rule_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ComplianceManager = ComplianceManager;
/**
 * Retention Manager
 */
class RetentionManager {
    policies = new Map();
    auditLogger;
    constructor(auditLogger) {
        this.auditLogger = auditLogger;
    }
    /**
     * Create retention policy
     */
    createPolicy(policy) {
        const fullPolicy = {
            ...policy,
            id: this.generatePolicyId(),
            createdAt: new Date(),
        };
        this.policies.set(fullPolicy.id, fullPolicy);
        EventBus_1.eventBus.emitSync('audit.retention_policy_created', fullPolicy, 'RetentionManager');
        return fullPolicy;
    }
    /**
     * Apply retention policies
     */
    async applyPolicies() {
        for (const policy of this.policies.values()) {
            if (!policy.enabled)
                continue;
            await this.applyPolicy(policy);
        }
    }
    /**
     * Apply single policy
     */
    async applyPolicy(policy) {
        const cutoffTime = new Date(Date.now() - policy.retentionPeriod);
        // Archive logs if archiveAfter is set
        if (policy.archiveAfter) {
            const archiveCutoff = new Date(Date.now() - policy.archiveAfter);
            const archivedCount = this.auditLogger.archiveLogs({
                endTime: archiveCutoff,
                eventTypes: policy.eventTypes,
            });
            if (archivedCount > 0) {
                EventBus_1.eventBus.emitSync('audit.logs_archived_by_policy', { policyId: policy.id, count: archivedCount }, 'RetentionManager');
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
                EventBus_1.eventBus.emitSync('audit.logs_deleted_by_policy', { policyId: policy.id, count: deletedCount }, 'RetentionManager');
            }
        }
    }
    /**
     * Get policy
     */
    getPolicy(policyId) {
        return this.policies.get(policyId);
    }
    /**
     * List policies
     */
    listPolicies() {
        return Array.from(this.policies.values());
    }
    /**
     * Delete policy
     */
    deletePolicy(policyId) {
        this.policies.delete(policyId);
        EventBus_1.eventBus.emitSync('audit.retention_policy_deleted', { policyId }, 'RetentionManager');
    }
    generatePolicyId() {
        return `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.RetentionManager = RetentionManager;
/**
 * Alert Rule Manager
 */
class AlertRuleManager {
    rules = new Map();
    /**
     * Create alert rule
     */
    createRule(rule) {
        const fullRule = {
            ...rule,
            id: this.generateRuleId(),
            createdAt: new Date(),
        };
        this.rules.set(fullRule.id, fullRule);
        EventBus_1.eventBus.emitSync('audit.alert_rule_created', fullRule, 'AlertRuleManager');
        return fullRule;
    }
    /**
     * Evaluate alert rules
     */
    async evaluateRules(log) {
        for (const rule of this.rules.values()) {
            if (!rule.enabled)
                continue;
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
                EventBus_1.eventBus.emitSync('audit.alert_triggered', { rule, log }, 'AlertRuleManager');
            }
        }
    }
    /**
     * Get rule
     */
    getRule(ruleId) {
        return this.rules.get(ruleId);
    }
    /**
     * List rules
     */
    listRules() {
        return Array.from(this.rules.values());
    }
    /**
     * Delete rule
     */
    deleteRule(ruleId) {
        this.rules.delete(ruleId);
        EventBus_1.eventBus.emitSync('audit.alert_rule_deleted', { ruleId }, 'AlertRuleManager');
    }
    evaluateConditions(log, conditions) {
        return conditions.every(condition => {
            const value = this.getFieldValue(log, condition.field);
            return this.evaluateCondition(value, condition.operator, condition.value);
        });
    }
    getFieldValue(log, field) {
        const parts = field.split('.');
        let value = log;
        for (const part of parts) {
            value = value?.[part];
        }
        return value;
    }
    evaluateCondition(value, operator, expected) {
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
    async executeActions(rule, log) {
        for (const action of rule.actions) {
            // Mock action execution
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    generateRuleId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AlertRuleManager = AlertRuleManager;
/**
 * Singleton instances
 */
exports.auditLogger = new AuditLogger();
exports.complianceManager = new ComplianceManager(exports.auditLogger);
exports.retentionManager = new RetentionManager(exports.auditLogger);
exports.alertRuleManager = new AlertRuleManager();
