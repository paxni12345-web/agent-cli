"use strict";
/**
 * Audit & Compliance System
 * Activity logging, compliance reporting, audit trails
 * Data retention, access control auditing, regulatory compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditManager = void 0;
const events_1 = require("events");
// ============================================================================
// Audit Manager
// ============================================================================
class AuditManager extends events_1.EventEmitter {
    config;
    auditLogs = new Map();
    accessAudits = new Map();
    retentionPolicies = new Map();
    retentionRecords = new Map();
    complianceReports = new Map();
    findings = new Map();
    constructor(config = {}) {
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
    log(category, action, actor, options = {}) {
        if (!this.config.enableActivityLogging) {
            throw new Error('Activity logging is not enabled');
        }
        const auditLog = {
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
    logAuthentication(actor, success, method, options = {}) {
        return this.log('authentication', `Authentication via ${method}`, actor, {
            ...options,
            result: success ? 'success' : 'failure',
            level: success ? 'info' : 'security',
            frameworks: ['iso27001', 'sox'],
            controls: ['AC-2', 'IA-2'],
        });
    }
    logDataAccess(actor, resource, operation, options = {}) {
        return this.log('data_access', `${operation} ${resource.type}`, actor, {
            ...options,
            resource,
            sensitive: true,
            frameworks: ['gdpr', 'hipaa'],
            controls: ['AC-3', 'AU-2'],
        });
    }
    logDataModification(actor, resource, changes, options = {}) {
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
    logConfigurationChange(actor, resource, changes, options = {}) {
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
    logAccess(actor, resource, action, permission, decision, options = {}) {
        if (!this.config.enableAccessAuditing) {
            throw new Error('Access auditing is not enabled');
        }
        const accessAudit = {
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
    query(query) {
        let results = Array.from(this.auditLogs.values());
        // Filter by date range
        if (query.startDate) {
            results = results.filter(log => log.timestamp >= query.startDate);
        }
        if (query.endDate) {
            results = results.filter(log => log.timestamp <= query.endDate);
        }
        // Filter by levels
        if (query.levels && query.levels.length > 0) {
            results = results.filter(log => query.levels.includes(log.level));
        }
        // Filter by categories
        if (query.categories && query.categories.length > 0) {
            results = results.filter(log => query.categories.includes(log.category));
        }
        // Filter by actors
        if (query.actors && query.actors.length > 0) {
            results = results.filter(log => query.actors.includes(log.actor.id));
        }
        // Filter by resources
        if (query.resources && query.resources.length > 0) {
            results = results.filter(log => log.resource && query.resources.includes(log.resource.id));
        }
        // Filter by results
        if (query.results && query.results.length > 0) {
            results = results.filter(log => query.results.includes(log.result));
        }
        // Search text
        if (query.searchText) {
            const searchLower = query.searchText.toLowerCase();
            results = results.filter(log => log.action.toLowerCase().includes(searchLower) ||
                log.actor.name?.toLowerCase().includes(searchLower) ||
                log.resource?.name?.toLowerCase().includes(searchLower));
        }
        // Sort by timestamp descending
        results.sort((a, b) => b.timestamp - a.timestamp);
        // Pagination
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        return results.slice(offset, offset + limit);
    }
    getAccessAudits(actorId, resourceId, startDate, endDate) {
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
    generateComplianceReport(framework, startDate, endDate) {
        if (!this.config.enableComplianceReporting) {
            throw new Error('Compliance reporting is not enabled');
        }
        const controls = this.getControlsForFramework(framework);
        const controlCompliance = new Map();
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
        const compliantControls = Array.from(controlCompliance.values()).filter(c => c.status === 'compliant').length;
        const nonCompliantControls = Array.from(controlCompliance.values()).filter(c => c.status === 'non_compliant').length;
        const findingsArray = Array.from(this.findings.values()).filter(f => f.status === 'open');
        const criticalFindings = findingsArray.filter(f => f.severity === 'critical').length;
        const report = {
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
    getControlsForFramework(framework) {
        const controls = new Map();
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
    collectEvidence(controlId, startDate, endDate) {
        const relevantLogs = Array.from(this.auditLogs.values()).filter(log => log.timestamp >= startDate &&
            log.timestamp <= endDate &&
            log.compliance.controls.includes(controlId));
        if (relevantLogs.length === 0)
            return [];
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
    evaluateControlCompliance(controlId, evidence) {
        if (evidence.length === 0) {
            return 'not_applicable';
        }
        // Simplified evaluation - in production, implement proper control logic
        return evidence.length > 0 ? 'compliant' : 'non_compliant';
    }
    // ========================================================================
    // Findings Management
    // ========================================================================
    createFinding(severity, category, description, options = {}) {
        const finding = {
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
    resolveFinding(findingId, resolution) {
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
    initializeDefaultPolicies() {
        // Security logs - 1 year retention
        this.createRetentionPolicy('Security Logs', 'security', 31536000000, ['iso27001', 'sox']);
        // Authentication logs - 90 days
        this.createRetentionPolicy('Authentication Logs', 'authentication', 7776000000, ['iso27001']);
        // Data access logs - 1 year (compliance requirement)
        this.createRetentionPolicy('Data Access Logs', 'data_access', 31536000000, ['gdpr', 'hipaa']);
    }
    createRetentionPolicy(name, category, retentionPeriod, compliance) {
        const policy = {
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
    applyRetentionPolicy(auditLog) {
        const policy = Array.from(this.retentionPolicies.values()).find(p => p.category === auditLog.category);
        if (policy) {
            const record = {
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
    startRetentionScheduler() {
        setInterval(() => {
            this.processRetention();
        }, 86400000); // Daily
    }
    processRetention() {
        const now = Date.now();
        for (const record of this.retentionRecords.values()) {
            if (record.legalHold)
                continue;
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
    generateId() {
        return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getStats() {
        return {
            totalLogs: this.auditLogs.size,
            accessAudits: this.accessAudits.size,
            retentionPolicies: this.retentionPolicies.size,
            complianceReports: this.complianceReports.size,
            openFindings: Array.from(this.findings.values()).filter(f => f.status === 'open').length,
            criticalLogs: Array.from(this.auditLogs.values()).filter(l => l.level === 'critical').length,
        };
    }
    exportLogs(startDate, endDate) {
        return Array.from(this.auditLogs.values()).filter(log => log.timestamp >= startDate && log.timestamp <= endDate);
    }
}
exports.AuditManager = AuditManager;
// ============================================================================
// Export
// ============================================================================
exports.default = AuditManager;
