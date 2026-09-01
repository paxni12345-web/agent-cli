"use strict";
/**
 * Security System
 * Authentication, authorization, encryption, and security scanning
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
exports.securityScanner = exports.securityAuditLogger = exports.encryptionManager = exports.authorizationManager = exports.authenticationManager = exports.SecurityScanner = exports.SecurityAuditLogger = exports.EncryptionManager = exports.AuthorizationManager = exports.AuthenticationManager = void 0;
const crypto = __importStar(require("crypto"));
const EventBus_1 = require("../core/EventBus");
/**
 * Authentication Manager
 */
class AuthenticationManager {
    users = new Map();
    sessions = new Map();
    failedAttempts = new Map();
    lockouts = new Map();
    policy = {
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecialChars: true,
        sessionTimeout: 60,
        maxFailedLoginAttempts: 5,
        lockoutDuration: 30,
        mfaRequired: false,
    };
    /**
     * Register new user
     */
    async register(username, email, password, roles = ['user']) {
        // Check if user exists
        if (this.findUserByUsername(username)) {
            throw new Error('Username already exists');
        }
        if (this.findUserByEmail(email)) {
            throw new Error('Email already exists');
        }
        // Validate password
        if (!this.validatePassword(password)) {
            throw new Error('Password does not meet security requirements');
        }
        // Hash password
        const passwordHash = await this.hashPassword(password);
        const user = {
            id: this.generateUserId(),
            username,
            email,
            passwordHash,
            roles,
            permissions: [],
            mfaEnabled: false,
            apiKeys: [],
            createdAt: new Date(),
        };
        this.users.set(user.id, user);
        EventBus_1.eventBus.emitSync('auth.user_registered', { userId: user.id, username }, 'AuthenticationManager');
        return user;
    }
    /**
     * Login user
     */
    async login(username, password, mfaToken) {
        // Check lockout
        if (this.isLockedOut(username)) {
            throw new Error('Account is locked due to too many failed login attempts');
        }
        const user = this.findUserByUsername(username);
        if (!user) {
            this.recordFailedAttempt(username);
            throw new Error('Invalid credentials');
        }
        // Verify password
        const valid = await this.verifyPassword(password, user.passwordHash);
        if (!valid) {
            this.recordFailedAttempt(username);
            throw new Error('Invalid credentials');
        }
        // Verify MFA if enabled
        if (user.mfaEnabled) {
            if (!mfaToken) {
                throw new Error('MFA token required');
            }
            if (!this.verifyMFAToken(user, mfaToken)) {
                throw new Error('Invalid MFA token');
            }
        }
        // Clear failed attempts
        this.failedAttempts.delete(username);
        // Create session
        const session = this.createSession(user.id);
        // Update last login
        user.lastLoginAt = new Date();
        EventBus_1.eventBus.emitSync('auth.user_logged_in', { userId: user.id, username }, 'AuthenticationManager');
        return session;
    }
    /**
     * Logout user
     */
    logout(sessionToken) {
        this.sessions.delete(sessionToken);
        EventBus_1.eventBus.emitSync('auth.user_logged_out', { sessionToken }, 'AuthenticationManager');
    }
    /**
     * Verify session
     */
    verifySession(sessionToken) {
        const session = this.sessions.get(sessionToken);
        if (!session) {
            return null;
        }
        // Check expiration
        if (new Date() > session.expiresAt) {
            this.sessions.delete(sessionToken);
            return null;
        }
        // Update last activity
        session.lastActivityAt = new Date();
        return session;
    }
    /**
     * Create API key
     */
    async createApiKey(userId, name, permissions, expiresInDays) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const key = this.generateApiKey();
        const keyHash = await this.hashPassword(key);
        const apiKey = {
            id: this.generateApiKeyId(),
            name,
            key, // Only shown once
            keyHash,
            permissions,
            expiresAt: expiresInDays
                ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
                : undefined,
            createdAt: new Date(),
        };
        user.apiKeys.push(apiKey);
        EventBus_1.eventBus.emitSync('auth.api_key_created', { userId, keyId: apiKey.id }, 'AuthenticationManager');
        return apiKey;
    }
    /**
     * Verify API key
     */
    async verifyApiKey(key) {
        for (const user of this.users.values()) {
            for (const apiKey of user.apiKeys) {
                const valid = await this.verifyPassword(key, apiKey.keyHash);
                if (valid) {
                    // Check expiration
                    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
                        return null;
                    }
                    // Update last used
                    apiKey.lastUsedAt = new Date();
                    return { user, apiKey };
                }
            }
        }
        return null;
    }
    /**
     * Enable MFA for user
     */
    enableMFA(userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const secret = this.generateMFASecret();
        user.mfaSecret = secret;
        user.mfaEnabled = true;
        EventBus_1.eventBus.emitSync('auth.mfa_enabled', { userId }, 'AuthenticationManager');
        return secret;
    }
    /**
     * Disable MFA for user
     */
    disableMFA(userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        EventBus_1.eventBus.emitSync('auth.mfa_disabled', { userId }, 'AuthenticationManager');
    }
    /**
     * Get user by ID
     */
    getUser(userId) {
        return this.users.get(userId);
    }
    /**
     * Update security policy
     */
    setPolicy(policy) {
        this.policy = { ...this.policy, ...policy };
    }
    findUserByUsername(username) {
        return Array.from(this.users.values()).find(u => u.username === username);
    }
    findUserByEmail(email) {
        return Array.from(this.users.values()).find(u => u.email === email);
    }
    validatePassword(password) {
        if (password.length < this.policy.passwordMinLength) {
            return false;
        }
        if (this.policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            return false;
        }
        if (this.policy.passwordRequireLowercase && !/[a-z]/.test(password)) {
            return false;
        }
        if (this.policy.passwordRequireNumbers && !/[0-9]/.test(password)) {
            return false;
        }
        if (this.policy.passwordRequireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return false;
        }
        return true;
    }
    async hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }
    async verifyPassword(password, hash) {
        const passwordHash = await this.hashPassword(password);
        return passwordHash === hash;
    }
    isLockedOut(username) {
        const lockoutUntil = this.lockouts.get(username);
        if (!lockoutUntil)
            return false;
        if (new Date() > lockoutUntil) {
            this.lockouts.delete(username);
            this.failedAttempts.delete(username);
            return false;
        }
        return true;
    }
    recordFailedAttempt(username) {
        const attempts = (this.failedAttempts.get(username) || 0) + 1;
        this.failedAttempts.set(username, attempts);
        if (attempts >= this.policy.maxFailedLoginAttempts) {
            const lockoutUntil = new Date(Date.now() + this.policy.lockoutDuration * 60 * 1000);
            this.lockouts.set(username, lockoutUntil);
            EventBus_1.eventBus.emitSync('auth.account_locked', { username, lockoutUntil }, 'AuthenticationManager');
        }
    }
    createSession(userId) {
        const session = {
            id: this.generateSessionId(),
            userId,
            token: this.generateSessionToken(),
            expiresAt: new Date(Date.now() + this.policy.sessionTimeout * 60 * 1000),
            createdAt: new Date(),
            lastActivityAt: new Date(),
        };
        this.sessions.set(session.token, session);
        return session;
    }
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    generateApiKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    generateApiKeyId() {
        return `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateMFASecret() {
        return crypto.randomBytes(20).toString('base32');
    }
    verifyMFAToken(user, token) {
        // Mock MFA verification (in production, use TOTP library)
        return token.length === 6 && /^\d+$/.test(token);
    }
}
exports.AuthenticationManager = AuthenticationManager;
/**
 * Authorization Manager
 */
class AuthorizationManager {
    roles = new Map();
    /**
     * Create role
     */
    createRole(name, description, permissions) {
        const role = {
            id: this.generateRoleId(),
            name,
            description,
            permissions,
        };
        this.roles.set(role.id, role);
        EventBus_1.eventBus.emitSync('authz.role_created', role, 'AuthorizationManager');
        return role;
    }
    /**
     * Check if user has permission
     */
    hasPermission(user, resource, action) {
        // Check direct permissions
        if (this.checkPermissions(user.permissions, resource, action)) {
            return true;
        }
        // Check role permissions
        for (const roleName of user.roles) {
            const role = this.findRoleByName(roleName);
            if (role && this.checkPermissions(role.permissions, resource, action)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check permissions list
     */
    checkPermissions(permissions, resource, action) {
        for (const perm of permissions) {
            const [permResource, permAction] = perm.split(':');
            if (permResource === '*' || permResource === resource) {
                if (permAction === '*' || permAction === action) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Get role by name
     */
    findRoleByName(name) {
        return Array.from(this.roles.values()).find(r => r.name === name);
    }
    /**
     * Create default roles
     */
    static createDefaultRoles() {
        return [
            {
                id: 'role_admin',
                name: 'admin',
                description: 'Full system access',
                permissions: ['*:*'],
            },
            {
                id: 'role_user',
                name: 'user',
                description: 'Standard user access',
                permissions: ['files:read', 'files:write', 'projects:read'],
            },
            {
                id: 'role_readonly',
                name: 'readonly',
                description: 'Read-only access',
                permissions: ['*:read'],
            },
        ];
    }
    generateRoleId() {
        return `role_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AuthorizationManager = AuthorizationManager;
/**
 * Encryption Manager
 */
class EncryptionManager {
    algorithm = 'aes-256-gcm';
    keyLength = 32;
    /**
     * Generate encryption key
     */
    generateKey() {
        return crypto.randomBytes(this.keyLength);
    }
    /**
     * Encrypt data
     */
    encrypt(data, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
        };
    }
    /**
     * Decrypt data
     */
    decrypt(encrypted, key, iv, tag) {
        const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
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
     * Generate random token
     */
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
}
exports.EncryptionManager = EncryptionManager;
/**
 * Security Audit Logger
 */
class SecurityAuditLogger {
    logs = [];
    maxLogs = 10000;
    /**
     * Log security event
     */
    log(action, resource, result, userId, metadata) {
        const log = {
            id: this.generateLogId(),
            userId,
            action,
            resource,
            result,
            timestamp: new Date(),
            metadata,
        };
        this.logs.push(log);
        // Limit log size
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        EventBus_1.eventBus.emitSync('security.audit_logged', log, 'SecurityAuditLogger');
    }
    /**
     * Query audit logs
     */
    query(filter) {
        let logs = [...this.logs];
        if (filter?.userId) {
            logs = logs.filter(l => l.userId === filter.userId);
        }
        if (filter?.action) {
            logs = logs.filter(l => l.action === filter.action);
        }
        if (filter?.resource) {
            logs = logs.filter(l => l.resource === filter.resource);
        }
        if (filter?.result) {
            logs = logs.filter(l => l.result === filter.result);
        }
        if (filter?.startDate) {
            logs = logs.filter(l => l.timestamp >= filter.startDate);
        }
        if (filter?.endDate) {
            logs = logs.filter(l => l.timestamp <= filter.endDate);
        }
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (filter?.limit) {
            logs = logs.slice(0, filter.limit);
        }
        return logs;
    }
    /**
     * Get security statistics
     */
    getStats() {
        const userCounts = new Map();
        const actionCounts = new Map();
        let successCount = 0;
        let failureCount = 0;
        let deniedCount = 0;
        for (const log of this.logs) {
            if (log.userId) {
                userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
            }
            actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
            if (log.result === 'success')
                successCount++;
            else if (log.result === 'failure')
                failureCount++;
            else if (log.result === 'denied')
                deniedCount++;
        }
        return {
            totalLogs: this.logs.length,
            successCount,
            failureCount,
            deniedCount,
            topUsers: Array.from(userCounts.entries())
                .map(([userId, count]) => ({ userId, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            topActions: Array.from(actionCounts.entries())
                .map(([action, count]) => ({ action, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
        };
    }
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SecurityAuditLogger = SecurityAuditLogger;
/**
 * Security Scanner
 */
class SecurityScanner {
    /**
     * Scan for common vulnerabilities
     */
    async scan(target) {
        const vulnerabilities = [];
        // Check for weak passwords
        vulnerabilities.push(...this.scanWeakPasswords());
        // Check for exposed secrets
        vulnerabilities.push(...await this.scanExposedSecrets(target));
        // Check for outdated dependencies
        vulnerabilities.push(...await this.scanDependencies(target));
        return {
            target,
            timestamp: new Date(),
            vulnerabilities,
            summary: {
                critical: vulnerabilities.filter(v => v.severity === 'critical').length,
                high: vulnerabilities.filter(v => v.severity === 'high').length,
                medium: vulnerabilities.filter(v => v.severity === 'medium').length,
                low: vulnerabilities.filter(v => v.severity === 'low').length,
            },
        };
    }
    scanWeakPasswords() {
        // Mock implementation
        return [];
    }
    async scanExposedSecrets(target) {
        // Mock implementation
        return [];
    }
    async scanDependencies(target) {
        // Mock implementation
        return [];
    }
}
exports.SecurityScanner = SecurityScanner;
/**
 * Singleton instances
 */
exports.authenticationManager = new AuthenticationManager();
exports.authorizationManager = new AuthorizationManager();
exports.encryptionManager = new EncryptionManager();
exports.securityAuditLogger = new SecurityAuditLogger();
exports.securityScanner = new SecurityScanner();
