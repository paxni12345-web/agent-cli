"use strict";
/**
 * Advanced Security System
 * Security scanning, vulnerability detection, encryption, authentication, and authorization
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizationManager = exports.authenticationManager = exports.encryptionService = exports.securityManager = exports.AuthorizationManager = exports.AuthenticationManager = exports.EncryptionService = exports.SecurityManager = exports.AuthenticationType = exports.EncryptionAlgorithm = exports.FindingStatus = exports.VulnerabilityType = exports.ScanStatus = exports.ScanType = exports.EnforcementLevel = exports.Severity = exports.SecurityRuleType = void 0;
const EventBus_1 = require("../core/EventBus");
const crypto = __importStar(require("crypto"));
var SecurityRuleType;
(function (SecurityRuleType) {
    SecurityRuleType["Authentication"] = "authentication";
    SecurityRuleType["Authorization"] = "authorization";
    SecurityRuleType["Encryption"] = "encryption";
    SecurityRuleType["InputValidation"] = "input_validation";
    SecurityRuleType["OutputEncoding"] = "output_encoding";
    SecurityRuleType["RateLimiting"] = "rate_limiting";
    SecurityRuleType["AccessControl"] = "access_control";
    SecurityRuleType["DataProtection"] = "data_protection";
})(SecurityRuleType || (exports.SecurityRuleType = SecurityRuleType = {}));
var Severity;
(function (Severity) {
    Severity["Critical"] = "critical";
    Severity["High"] = "high";
    Severity["Medium"] = "medium";
    Severity["Low"] = "low";
    Severity["Info"] = "info";
})(Severity || (exports.Severity = Severity = {}));
var EnforcementLevel;
(function (EnforcementLevel) {
    EnforcementLevel["Strict"] = "strict";
    EnforcementLevel["Standard"] = "standard";
    EnforcementLevel["Permissive"] = "permissive";
})(EnforcementLevel || (exports.EnforcementLevel = EnforcementLevel = {}));
var ScanType;
(function (ScanType) {
    ScanType["Static"] = "static";
    ScanType["Dynamic"] = "dynamic";
    ScanType["Dependency"] = "dependency";
    ScanType["Container"] = "container";
    ScanType["Compliance"] = "compliance";
})(ScanType || (exports.ScanType = ScanType = {}));
var ScanStatus;
(function (ScanStatus) {
    ScanStatus["Pending"] = "pending";
    ScanStatus["Running"] = "running";
    ScanStatus["Completed"] = "completed";
    ScanStatus["Failed"] = "failed";
})(ScanStatus || (exports.ScanStatus = ScanStatus = {}));
var VulnerabilityType;
(function (VulnerabilityType) {
    VulnerabilityType["SQLInjection"] = "sql_injection";
    VulnerabilityType["XSS"] = "xss";
    VulnerabilityType["CSRF"] = "csrf";
    VulnerabilityType["CommandInjection"] = "command_injection";
    VulnerabilityType["PathTraversal"] = "path_traversal";
    VulnerabilityType["InsecureDeserialization"] = "insecure_deserialization";
    VulnerabilityType["BrokenAuthentication"] = "broken_authentication";
    VulnerabilityType["SensitiveDataExposure"] = "sensitive_data_exposure";
    VulnerabilityType["XXE"] = "xxe";
    VulnerabilityType["BrokenAccessControl"] = "broken_access_control";
    VulnerabilityType["SecurityMisconfiguration"] = "security_misconfiguration";
    VulnerabilityType["OutdatedDependency"] = "outdated_dependency";
    VulnerabilityType["WeakCryptography"] = "weak_cryptography";
    VulnerabilityType["InsufficientLogging"] = "insufficient_logging";
})(VulnerabilityType || (exports.VulnerabilityType = VulnerabilityType = {}));
var FindingStatus;
(function (FindingStatus) {
    FindingStatus["Open"] = "open";
    FindingStatus["InProgress"] = "in_progress";
    FindingStatus["Resolved"] = "resolved";
    FindingStatus["Accepted"] = "accepted";
    FindingStatus["FalsePositive"] = "false_positive";
})(FindingStatus || (exports.FindingStatus = FindingStatus = {}));
var EncryptionAlgorithm;
(function (EncryptionAlgorithm) {
    EncryptionAlgorithm["AES"] = "aes";
    EncryptionAlgorithm["RSA"] = "rsa";
    EncryptionAlgorithm["ChaCha20"] = "chacha20";
    EncryptionAlgorithm["Blowfish"] = "blowfish";
})(EncryptionAlgorithm || (exports.EncryptionAlgorithm = EncryptionAlgorithm = {}));
var AuthenticationType;
(function (AuthenticationType) {
    AuthenticationType["Local"] = "local";
    AuthenticationType["OAuth"] = "oauth";
    AuthenticationType["SAML"] = "saml";
    AuthenticationType["LDAP"] = "ldap";
    AuthenticationType["JWT"] = "jwt";
    AuthenticationType["APIKey"] = "api_key";
})(AuthenticationType || (exports.AuthenticationType = AuthenticationType = {}));
/**
 * Security Manager
 */
class SecurityManager {
    policies = new Map();
    scans = new Map();
    auditLogs = [];
    /**
     * Create security policy
     */
    createPolicy(policy) {
        const fullPolicy = {
            ...policy,
            id: this.generatePolicyId(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.policies.set(fullPolicy.id, fullPolicy);
        EventBus_1.eventBus.emitSync('security.policy_created', fullPolicy, 'SecurityManager');
        return fullPolicy;
    }
    /**
     * Evaluate security context against policies
     */
    async evaluateContext(context) {
        const violations = [];
        for (const policy of this.policies.values()) {
            if (policy.enforcement === EnforcementLevel.Permissive) {
                continue;
            }
            for (const rule of policy.rules) {
                if (!rule.enabled) {
                    continue;
                }
                // Check if exception exists
                const hasException = policy.exceptions.some(ex => ex.ruleId === rule.id && (!ex.expiresAt || ex.expiresAt > new Date()));
                if (hasException) {
                    continue;
                }
                // Evaluate condition
                const violated = await this.evaluateRule(rule, context);
                if (violated) {
                    violations.push({
                        policyId: policy.id,
                        ruleId: rule.id,
                        severity: rule.severity,
                        message: rule.action.message,
                        timestamp: new Date(),
                    });
                    // Execute action
                    await this.executeAction(rule.action, context);
                }
            }
        }
        return {
            allowed: violations.length === 0,
            violations,
            timestamp: new Date(),
        };
    }
    /**
     * Start vulnerability scan
     */
    async startScan(target, type) {
        const scan = {
            id: this.generateScanId(),
            target,
            type,
            status: ScanStatus.Running,
            findings: [],
            startedAt: new Date(),
        };
        this.scans.set(scan.id, scan);
        EventBus_1.eventBus.emitSync('security.scan_started', scan, 'SecurityManager');
        // Run scan asynchronously
        this.executeScan(scan);
        return scan;
    }
    /**
     * Get scan results
     */
    getScan(scanId) {
        return this.scans.get(scanId);
    }
    /**
     * List scans
     */
    listScans(filter) {
        let scans = Array.from(this.scans.values());
        if (filter?.status) {
            scans = scans.filter(s => s.status === filter.status);
        }
        if (filter?.type) {
            scans = scans.filter(s => s.type === filter.type);
        }
        return scans;
    }
    /**
     * Get security findings
     */
    getFindings(filter) {
        const findings = [];
        for (const scan of this.scans.values()) {
            findings.push(...scan.findings);
        }
        let filtered = findings;
        if (filter?.severity) {
            filtered = filtered.filter(f => f.severity === filter.severity);
        }
        if (filter?.status) {
            filtered = filtered.filter(f => f.status === filter.status);
        }
        return filtered;
    }
    /**
     * Log audit event
     */
    audit(log) {
        const fullLog = {
            ...log,
            id: this.generateAuditId(),
            timestamp: new Date(),
        };
        this.auditLogs.push(fullLog);
        EventBus_1.eventBus.emitSync('security.audit_logged', fullLog, 'SecurityManager');
    }
    /**
     * Get audit logs
     */
    getAuditLogs(filter) {
        let logs = [...this.auditLogs];
        if (filter?.userId) {
            logs = logs.filter(l => l.userId === filter.userId);
        }
        if (filter?.action) {
            logs = logs.filter(l => l.action === filter.action);
        }
        if (filter?.startDate) {
            logs = logs.filter(l => l.timestamp >= filter.startDate);
        }
        if (filter?.endDate) {
            logs = logs.filter(l => l.timestamp <= filter.endDate);
        }
        return logs;
    }
    async evaluateRule(rule, context) {
        if (rule.condition.type === 'custom' && typeof rule.condition.value === 'function') {
            return rule.condition.value(context);
        }
        // Mock evaluation
        return false;
    }
    async executeAction(action, context) {
        switch (action.type) {
            case 'block':
                EventBus_1.eventBus.emitSync('security.blocked', { action, context }, 'SecurityManager');
                break;
            case 'warn':
                EventBus_1.eventBus.emitSync('security.warning', { action, context }, 'SecurityManager');
                break;
            case 'log':
                this.audit({
                    action: 'security_violation',
                    result: 'failure',
                    ip: context.ip,
                    userId: context.userId,
                    metadata: { message: action.message },
                });
                break;
            case 'alert':
                EventBus_1.eventBus.emitSync('security.alert', { action, context }, 'SecurityManager');
                break;
        }
    }
    async executeScan(scan) {
        try {
            // Mock scan execution
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Generate mock findings
            scan.findings = this.generateMockFindings(scan.type);
            scan.status = ScanStatus.Completed;
            scan.completedAt = new Date();
            scan.duration = scan.completedAt.getTime() - scan.startedAt.getTime();
            EventBus_1.eventBus.emitSync('security.scan_completed', scan, 'SecurityManager');
        }
        catch (error) {
            scan.status = ScanStatus.Failed;
            scan.completedAt = new Date();
            EventBus_1.eventBus.emitSync('security.scan_failed', scan, 'SecurityManager');
        }
    }
    generateMockFindings(type) {
        // Mock findings
        return [];
    }
    generatePolicyId() {
        return `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateScanId() {
        return `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateAuditId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SecurityManager = SecurityManager;
/**
 * Encryption Service
 */
class EncryptionService {
    /**
     * Encrypt data
     */
    encrypt(data, key, config) {
        const algorithm = this.getAlgorithm(config);
        const cipher = crypto.createCipheriv(algorithm, this.deriveKey(key, config.keySize), this.generateIV());
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    /**
     * Decrypt data
     */
    decrypt(encrypted, key, config) {
        const algorithm = this.getAlgorithm(config);
        const decipher = crypto.createDecipheriv(algorithm, this.deriveKey(key, config.keySize), this.generateIV());
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Hash data
     */
    hash(data, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }
    /**
     * Generate HMAC
     */
    hmac(data, key, algorithm = 'sha256') {
        return crypto.createHmac(algorithm, key).update(data).digest('hex');
    }
    /**
     * Generate random key
     */
    generateKey(size = 32) {
        return crypto.randomBytes(size).toString('hex');
    }
    getAlgorithm(config) {
        switch (config.algorithm) {
            case EncryptionAlgorithm.AES:
                return `aes-${config.keySize * 8}-cbc`;
            default:
                return 'aes-256-cbc';
        }
    }
    deriveKey(password, keySize) {
        return crypto.pbkdf2Sync(password, 'salt', 100000, keySize, 'sha256');
    }
    generateIV() {
        return crypto.randomBytes(16);
    }
}
exports.EncryptionService = EncryptionService;
/**
 * Authentication Manager
 */
class AuthenticationManager {
    providers = new Map();
    users = new Map();
    sessions = new Map();
    /**
     * Register authentication provider
     */
    registerProvider(provider) {
        this.providers.set(provider.name, provider);
        EventBus_1.eventBus.emitSync('auth.provider_registered', provider, 'AuthenticationManager');
    }
    /**
     * Authenticate user
     */
    async authenticate(providerName, credentials) {
        const provider = this.providers.get(providerName);
        if (!provider || !provider.enabled) {
            return {
                success: false,
                error: 'Provider not found or disabled',
            };
        }
        // Mock authentication
        const user = await this.findUser(credentials.username);
        if (!user) {
            return {
                success: false,
                error: 'Invalid credentials',
            };
        }
        const session = this.createSession(user.id);
        return {
            success: true,
            user,
            session,
        };
    }
    /**
     * Validate session
     */
    validateSession(token) {
        const session = Array.from(this.sessions.values()).find(s => s.token === token);
        if (!session) {
            return null;
        }
        if (new Date() > session.expiresAt) {
            this.sessions.delete(session.id);
            return null;
        }
        return session;
    }
    /**
     * Revoke session
     */
    revokeSession(sessionId) {
        this.sessions.delete(sessionId);
        EventBus_1.eventBus.emitSync('auth.session_revoked', { sessionId }, 'AuthenticationManager');
    }
    /**
     * Create user
     */
    createUser(userData) {
        const user = {
            ...userData,
            id: this.generateUserId(),
            createdAt: new Date(),
        };
        this.users.set(user.id, user);
        return user;
    }
    /**
     * Get user
     */
    getUser(userId) {
        return this.users.get(userId);
    }
    async findUser(username) {
        for (const user of this.users.values()) {
            if (user.username === username) {
                return user;
            }
        }
        return null;
    }
    createSession(userId) {
        const session = {
            id: this.generateSessionId(),
            userId,
            token: this.generateToken(),
            expiresAt: new Date(Date.now() + 3600000), // 1 hour
            createdAt: new Date(),
            metadata: {},
        };
        this.sessions.set(session.id, session);
        return session;
    }
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }
}
exports.AuthenticationManager = AuthenticationManager;
/**
 * Authorization Manager
 */
class AuthorizationManager {
    permissions = new Map();
    rolePermissions = new Map();
    /**
     * Define permission
     */
    definePermission(permission) {
        this.permissions.set(permission.id, permission);
    }
    /**
     * Assign permission to role
     */
    assignPermissionToRole(roleId, permissionId) {
        if (!this.rolePermissions.has(roleId)) {
            this.rolePermissions.set(roleId, []);
        }
        this.rolePermissions.get(roleId).push(permissionId);
    }
    /**
     * Check authorization
     */
    authorize(user, resource, action) {
        // Check user permissions
        if (user.permissions.includes(`${resource}:${action}`)) {
            return true;
        }
        // Check role permissions
        for (const role of user.roles) {
            const rolePerms = this.rolePermissions.get(role) || [];
            for (const permId of rolePerms) {
                const perm = this.permissions.get(permId);
                if (perm && perm.resource === resource && perm.action === action) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Get user permissions
     */
    getUserPermissions(user) {
        const permissions = [];
        // Add direct permissions
        for (const permStr of user.permissions) {
            const [resource, action] = permStr.split(':');
            permissions.push({
                id: permStr,
                resource,
                action,
                description: '',
            });
        }
        // Add role permissions
        for (const role of user.roles) {
            const rolePerms = this.rolePermissions.get(role) || [];
            for (const permId of rolePerms) {
                const perm = this.permissions.get(permId);
                if (perm) {
                    permissions.push(perm);
                }
            }
        }
        return permissions;
    }
}
exports.AuthorizationManager = AuthorizationManager;
/**
 * Singleton instances
 */
exports.securityManager = new SecurityManager();
exports.encryptionService = new EncryptionService();
exports.authenticationManager = new AuthenticationManager();
exports.authorizationManager = new AuthorizationManager();
