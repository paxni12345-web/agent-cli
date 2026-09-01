"use strict";
/**
 * Advanced Security System
 * Authentication, Authorization, Encryption, Audit Logging
 * RBAC, OAuth, JWT, MFA, Security Scanning
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityManager = void 0;
const events_1 = require("events");
const crypto = __importStar(require("crypto"));
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const ioredis_1 = __importDefault(require("ioredis"));
// ============================================================================
// Security Manager
// ============================================================================
class SecurityManager extends events_1.EventEmitter {
    config;
    users = new Map();
    roles = new Map();
    permissions = new Map();
    encryptionKeys = new Map();
    redis;
    redisConnected = false;
    constructor(config = {}) {
        super();
        this.config = {
            enableAuth: true,
            enableEncryption: true,
            enableAudit: true,
            enableMFA: false,
            jwtSecret: this.generateSecret(),
            jwtExpiry: 3600, // 1 hour in seconds
            jwtRefreshExpiry: 604800, // 7 days in seconds
            passwordMinLength: 8,
            passwordRequireUppercase: true,
            passwordRequireNumbers: true,
            passwordRequireSpecialChars: true,
            sessionTimeout: 1800000, // 30 minutes in milliseconds
            maxLoginAttempts: 5,
            lockoutDuration: 900000, // 15 minutes in milliseconds
            rateLimitWindow: 900000, // 15 minutes in milliseconds
            rateLimitMaxAttempts: 10,
            passwordResetExpiry: 3600000, // 1 hour in milliseconds
            bcryptRounds: 12,
            redisUrl: config.redisUrl || 'redis://localhost:6379',
            ...config,
        };
        this.redis = new ioredis_1.default(this.config.redisUrl, {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
        });
        this.initializeRedis();
        this.initializeDefaultRoles();
    }
    async initializeRedis() {
        try {
            this.redis.on('connect', () => {
                this.redisConnected = true;
                this.emit('redis:connected');
            });
            this.redis.on('error', (err) => {
                this.redisConnected = false;
                this.emit('redis:error', { error: err });
            });
            this.redis.on('close', () => {
                this.redisConnected = false;
                this.emit('redis:disconnected');
            });
            await this.redis.ping();
            this.redisConnected = true;
        }
        catch (error) {
            this.redisConnected = false;
            throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // ========================================================================
    // User Management
    // ========================================================================
    async createUser(username, email, password, roles = ['user']) {
        this.emit('user:create:start', { username, email });
        try {
            // Validate input
            if (!username || username.trim().length === 0) {
                throw new Error('Username is required');
            }
            if (!email || !this.validateEmail(email)) {
                throw new Error('Valid email is required');
            }
            // Validate password
            this.validatePassword(password);
            // Check if user exists
            if (Array.from(this.users.values()).some(u => u.username === username || u.email === email)) {
                throw new Error('User already exists');
            }
            // Hash password with bcrypt
            const passwordHash = await bcrypt.hash(password, this.config.bcryptRounds);
            const user = {
                id: this.generateId(),
                username: username.trim(),
                email: email.toLowerCase().trim(),
                passwordHash,
                roles,
                permissions: this.aggregatePermissions(roles),
                mfaEnabled: false,
                locked: false,
                loginAttempts: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            this.users.set(user.id, user);
            // Store user in Redis for persistence
            await this.redis.setex(`user:${user.id}`, 86400 * 30, // 30 days
            JSON.stringify(user));
            this.emit('user:created', { user: this.sanitizeUser(user) });
            await this.audit(user.id, 'user:created', 'user', user.id, 'success', {}, '0.0.0.0', 'System');
            return user;
        }
        catch (error) {
            this.emit('user:create:error', { error });
            throw error;
        }
    }
    async updateUser(userId, updates) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        // Prevent updating sensitive fields directly
        const allowedUpdates = { ...updates };
        delete allowedUpdates.passwordHash;
        delete allowedUpdates.id;
        Object.assign(user, allowedUpdates);
        user.updatedAt = Date.now();
        // Update in Redis
        await this.redis.setex(`user:${user.id}`, 86400 * 30, JSON.stringify(user));
        this.emit('user:updated', { user: this.sanitizeUser(user) });
        await this.audit(userId, 'user:updated', 'user', userId, 'success', {}, '0.0.0.0', 'System');
        return user;
    }
    async deleteUser(userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        // Revoke all sessions
        await this.revokeAllUserSessions(userId);
        // Delete from memory and Redis
        this.users.delete(userId);
        await this.redis.del(`user:${userId}`);
        this.emit('user:deleted', { userId });
        await this.audit(userId, 'user:deleted', 'user', userId, 'success', {}, '0.0.0.0', 'System');
    }
    // ========================================================================
    // Authentication
    // ========================================================================
    async login(username, password, context, mfaCode) {
        this.emit('auth:login:start', { username, ipAddress: context.ipAddress });
        try {
            // Rate limiting check
            await this.checkRateLimit(username, context.ipAddress);
            const user = Array.from(this.users.values()).find(u => u.username === username || u.email === username);
            if (!user) {
                await this.recordFailedLogin(username, context.ipAddress);
                await this.audit('', 'auth:login', 'session', '', 'failure', { username, reason: 'user_not_found' }, context.ipAddress, context.userAgent);
                throw new Error('Invalid credentials');
            }
            // Check if locked
            if (user.locked && user.lockedUntil && user.lockedUntil > Date.now()) {
                const remainingTime = Math.ceil((user.lockedUntil - Date.now()) / 1000);
                await this.audit(user.id, 'auth:login', 'session', '', 'denied', { reason: 'account_locked', remainingTime }, context.ipAddress, context.userAgent);
                throw new Error(`Account is locked. Try again in ${remainingTime} seconds`);
            }
            // Unlock if lockout period expired
            if (user.locked && user.lockedUntil && user.lockedUntil <= Date.now()) {
                user.locked = false;
                user.lockedUntil = undefined;
                user.loginAttempts = 0;
            }
            // Verify password with bcrypt
            const passwordValid = await bcrypt.compare(password, user.passwordHash);
            if (!passwordValid) {
                user.loginAttempts++;
                if (user.loginAttempts >= this.config.maxLoginAttempts) {
                    user.locked = true;
                    user.lockedUntil = Date.now() + this.config.lockoutDuration;
                    await this.updateUser(user.id, { locked: user.locked, lockedUntil: user.lockedUntil, loginAttempts: user.loginAttempts });
                    this.emit('user:locked', { user: this.sanitizeUser(user) });
                    await this.audit(user.id, 'auth:login', 'session', '', 'failure', { reason: 'account_locked_due_to_attempts' }, context.ipAddress, context.userAgent);
                    throw new Error('Account locked due to too many failed login attempts');
                }
                await this.updateUser(user.id, { loginAttempts: user.loginAttempts });
                await this.recordFailedLogin(username, context.ipAddress);
                await this.audit(user.id, 'auth:login', 'session', '', 'failure', { reason: 'invalid_password', attempts: user.loginAttempts }, context.ipAddress, context.userAgent);
                throw new Error('Invalid credentials');
            }
            // Verify MFA if enabled
            if (user.mfaEnabled) {
                if (!mfaCode) {
                    await this.audit(user.id, 'auth:login', 'session', '', 'failure', { reason: 'mfa_required' }, context.ipAddress, context.userAgent);
                    throw new Error('MFA code required');
                }
                const mfaValid = await this.verifyMFACode(user.mfaSecret, mfaCode);
                if (!mfaValid) {
                    await this.recordFailedLogin(username, context.ipAddress);
                    await this.audit(user.id, 'auth:login', 'session', '', 'failure', { reason: 'invalid_mfa' }, context.ipAddress, context.userAgent);
                    throw new Error('Invalid MFA code');
                }
            }
            // Reset login attempts
            user.loginAttempts = 0;
            user.locked = false;
            user.lockedUntil = undefined;
            user.lastLogin = Date.now();
            await this.updateUser(user.id, { loginAttempts: 0, locked: false, lockedUntil: undefined, lastLogin: user.lastLogin });
            // Generate tokens with jsonwebtoken
            const token = this.generateJWT(user, 'access');
            const refreshToken = this.generateJWT(user, 'refresh');
            // Create session in Redis
            const session = await this.createSession(user.id, token, context);
            // Clear rate limit on successful login
            await this.clearRateLimit(username, context.ipAddress);
            this.emit('auth:login:success', { user: this.sanitizeUser(user), sessionId: session.id });
            await this.audit(user.id, 'auth:login', 'session', session.id, 'success', { deviceId: context.deviceId }, context.ipAddress, context.userAgent);
            return { token, refreshToken, user: this.sanitizeUser(user), sessionId: session.id };
        }
        catch (error) {
            this.emit('auth:login:error', { error });
            throw error;
        }
    }
    async logout(token, context) {
        try {
            const sessionId = await this.redis.get(`token:${token}`);
            if (sessionId) {
                const sessionData = await this.redis.get(`session:${sessionId}`);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    // Delete session
                    await this.redis.del(`session:${sessionId}`);
                    await this.redis.del(`token:${token}`);
                    // Add token to blacklist
                    await this.redis.setex(`blacklist:${token}`, this.config.jwtExpiry, '1');
                    // Remove from user's session list
                    await this.redis.srem(`user:sessions:${session.userId}`, sessionId);
                    await this.audit(session.userId, 'auth:logout', 'session', sessionId, 'success', {}, context.ipAddress, context.userAgent);
                    this.emit('auth:logout', { sessionId });
                }
            }
        }
        catch (error) {
            this.emit('auth:logout:error', { error });
            throw error;
        }
    }
    async validateToken(token) {
        try {
            // Check if token is blacklisted
            const blacklisted = await this.redis.get(`blacklist:${token}`);
            if (blacklisted) {
                return null;
            }
            // Verify JWT token
            const payload = jwt.verify(token, this.config.jwtSecret);
            if (payload.type !== 'access') {
                return null;
            }
            const user = this.users.get(payload.userId);
            if (!user) {
                return null;
            }
            // Update session activity
            const sessionId = await this.redis.get(`token:${token}`);
            if (sessionId) {
                const sessionData = await this.redis.get(`session:${sessionId}`);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    // Check for timeout
                    if (Date.now() - session.lastActivity > this.config.sessionTimeout) {
                        await this.logout(token, { ipAddress: session.ipAddress, userAgent: session.userAgent });
                        return null;
                    }
                    // Update last activity
                    session.lastActivity = Date.now();
                    await this.redis.setex(`session:${sessionId}`, this.config.jwtExpiry, JSON.stringify(session));
                }
            }
            return user;
        }
        catch (error) {
            return null;
        }
    }
    async refreshToken(refreshToken, context) {
        try {
            // Check if token is blacklisted
            const blacklisted = await this.redis.get(`blacklist:${refreshToken}`);
            if (blacklisted) {
                throw new Error('Token has been revoked');
            }
            // Verify refresh token
            const payload = jwt.verify(refreshToken, this.config.jwtSecret);
            if (payload.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            const user = this.users.get(payload.userId);
            if (!user) {
                throw new Error('User not found');
            }
            // Generate new tokens
            const token = this.generateJWT(user, 'access');
            const newRefreshToken = this.generateJWT(user, 'refresh');
            // Blacklist old refresh token
            await this.redis.setex(`blacklist:${refreshToken}`, this.config.jwtRefreshExpiry, '1');
            await this.audit(user.id, 'auth:refresh', 'token', '', 'success', {}, context.ipAddress, context.userAgent);
            return { token, refreshToken: newRefreshToken };
        }
        catch (error) {
            throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // ========================================================================
    // Password Reset Flow
    // ========================================================================
    async requestPasswordReset(email, context) {
        try {
            const user = Array.from(this.users.values()).find(u => u.email === email);
            if (!user) {
                // Don't reveal if user exists
                await this.audit('', 'password:reset:request', 'user', '', 'failure', { email, reason: 'user_not_found' }, context.ipAddress, context.userAgent);
                // Return a fake token to prevent user enumeration
                return this.generateSecret();
            }
            // Generate reset token
            const resetToken = this.generateSecret();
            const resetData = {
                token: resetToken,
                userId: user.id,
                expiresAt: Date.now() + this.config.passwordResetExpiry,
                used: false,
            };
            // Store in Redis
            await this.redis.setex(`reset:${resetToken}`, Math.ceil(this.config.passwordResetExpiry / 1000), JSON.stringify(resetData));
            // Also store by user ID for revocation
            await this.redis.setex(`reset:user:${user.id}`, Math.ceil(this.config.passwordResetExpiry / 1000), resetToken);
            await this.audit(user.id, 'password:reset:request', 'user', user.id, 'success', {}, context.ipAddress, context.userAgent);
            this.emit('password:reset:requested', { userId: user.id, email: user.email, token: resetToken });
            return resetToken;
        }
        catch (error) {
            this.emit('password:reset:error', { error });
            throw error;
        }
    }
    async resetPassword(resetToken, newPassword, context) {
        try {
            const resetData = await this.redis.get(`reset:${resetToken}`);
            if (!resetData) {
                await this.audit('', 'password:reset:complete', 'user', '', 'failure', { reason: 'invalid_token' }, context.ipAddress, context.userAgent);
                throw new Error('Invalid or expired reset token');
            }
            const reset = JSON.parse(resetData);
            if (reset.used) {
                await this.audit(reset.userId, 'password:reset:complete', 'user', reset.userId, 'failure', { reason: 'token_already_used' }, context.ipAddress, context.userAgent);
                throw new Error('Reset token has already been used');
            }
            if (reset.expiresAt < Date.now()) {
                await this.redis.del(`reset:${resetToken}`);
                await this.audit(reset.userId, 'password:reset:complete', 'user', reset.userId, 'failure', { reason: 'token_expired' }, context.ipAddress, context.userAgent);
                throw new Error('Reset token has expired');
            }
            const user = this.users.get(reset.userId);
            if (!user) {
                throw new Error('User not found');
            }
            // Validate new password
            this.validatePassword(newPassword);
            // Hash new password
            const passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);
            user.passwordHash = passwordHash;
            user.updatedAt = Date.now();
            // Update in Redis
            await this.updateUser(user.id, { passwordHash, updatedAt: user.updatedAt });
            // Mark token as used and delete
            await this.redis.del(`reset:${resetToken}`);
            await this.redis.del(`reset:user:${reset.userId}`);
            // Revoke all existing sessions for security
            await this.revokeAllUserSessions(reset.userId);
            await this.audit(reset.userId, 'password:reset:complete', 'user', reset.userId, 'success', {}, context.ipAddress, context.userAgent);
            this.emit('password:reset:completed', { userId: reset.userId });
        }
        catch (error) {
            this.emit('password:reset:error', { error });
            throw error;
        }
    }
    async changePassword(userId, currentPassword, newPassword, context) {
        try {
            const user = this.users.get(userId);
            if (!user) {
                throw new Error('User not found');
            }
            // Verify current password
            const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!passwordValid) {
                await this.audit(userId, 'password:change', 'user', userId, 'failure', { reason: 'invalid_current_password' }, context.ipAddress, context.userAgent);
                throw new Error('Current password is incorrect');
            }
            // Validate new password
            this.validatePassword(newPassword);
            // Hash new password
            const passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);
            user.passwordHash = passwordHash;
            user.updatedAt = Date.now();
            await this.updateUser(user.id, { passwordHash, updatedAt: user.updatedAt });
            await this.audit(userId, 'password:change', 'user', userId, 'success', {}, context.ipAddress, context.userAgent);
            this.emit('password:changed', { userId });
        }
        catch (error) {
            this.emit('password:change:error', { error });
            throw error;
        }
    }
    // ========================================================================
    // Session Management
    // ========================================================================
    async createSession(userId, token, context) {
        const deviceId = context.deviceId || this.generateDeviceId(context);
        const session = {
            id: this.generateId(),
            userId,
            token,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            deviceId,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.config.jwtExpiry * 1000),
            lastActivity: Date.now(),
        };
        // Store session in Redis
        await this.redis.setex(`session:${session.id}`, this.config.jwtExpiry, JSON.stringify(session));
        // Map token to session ID
        await this.redis.setex(`token:${token}`, this.config.jwtExpiry, session.id);
        // Add to user's session list
        await this.redis.sadd(`user:sessions:${userId}`, session.id);
        // Store device info
        await this.redis.setex(`device:${deviceId}`, 86400 * 30, // 30 days
        JSON.stringify({ userId, lastSeen: Date.now(), ipAddress: context.ipAddress, userAgent: context.userAgent }));
        return session;
    }
    async getUserSessions(userId) {
        try {
            const sessionIds = await this.redis.smembers(`user:sessions:${userId}`);
            const sessions = [];
            for (const sessionId of sessionIds) {
                const sessionData = await this.redis.get(`session:${sessionId}`);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    // Check if session is still valid
                    if (session.expiresAt > Date.now()) {
                        sessions.push(session);
                    }
                    else {
                        // Clean up expired session
                        await this.redis.srem(`user:sessions:${userId}`, sessionId);
                        await this.redis.del(`session:${sessionId}`);
                    }
                }
            }
            return sessions;
        }
        catch (error) {
            throw new Error(`Failed to get user sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async revokeSession(sessionId, context) {
        try {
            const sessionData = await this.redis.get(`session:${sessionId}`);
            if (!sessionData) {
                throw new Error('Session not found');
            }
            const session = JSON.parse(sessionData);
            // Delete session
            await this.redis.del(`session:${sessionId}`);
            await this.redis.del(`token:${session.token}`);
            // Add token to blacklist
            await this.redis.setex(`blacklist:${session.token}`, this.config.jwtExpiry, '1');
            // Remove from user's session list
            await this.redis.srem(`user:sessions:${session.userId}`, sessionId);
            await this.audit(session.userId, 'session:revoked', 'session', sessionId, 'success', {}, context.ipAddress, context.userAgent);
            this.emit('session:revoked', { sessionId, userId: session.userId });
        }
        catch (error) {
            throw error;
        }
    }
    async revokeAllUserSessions(userId) {
        try {
            const sessionIds = await this.redis.smembers(`user:sessions:${userId}`);
            for (const sessionId of sessionIds) {
                const sessionData = await this.redis.get(`session:${sessionId}`);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    // Delete session
                    await this.redis.del(`session:${sessionId}`);
                    await this.redis.del(`token:${session.token}`);
                    // Add token to blacklist
                    await this.redis.setex(`blacklist:${session.token}`, this.config.jwtExpiry, '1');
                }
            }
            // Clear user's session list
            await this.redis.del(`user:sessions:${userId}`);
            await this.audit(userId, 'sessions:revoked:all', 'user', userId, 'success', { count: sessionIds.length }, '0.0.0.0', 'System');
            this.emit('sessions:revoked:all', { userId, count: sessionIds.length });
        }
        catch (error) {
            throw new Error(`Failed to revoke all sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async revokeOtherSessions(userId, currentSessionId, context) {
        try {
            const sessionIds = await this.redis.smembers(`user:sessions:${userId}`);
            let revokedCount = 0;
            for (const sessionId of sessionIds) {
                if (sessionId !== currentSessionId) {
                    const sessionData = await this.redis.get(`session:${sessionId}`);
                    if (sessionData) {
                        const session = JSON.parse(sessionData);
                        // Delete session
                        await this.redis.del(`session:${sessionId}`);
                        await this.redis.del(`token:${session.token}`);
                        // Add token to blacklist
                        await this.redis.setex(`blacklist:${session.token}`, this.config.jwtExpiry, '1');
                        await this.redis.srem(`user:sessions:${userId}`, sessionId);
                        revokedCount++;
                    }
                }
            }
            await this.audit(userId, 'sessions:revoked:others', 'user', userId, 'success', { count: revokedCount }, context.ipAddress, context.userAgent);
            this.emit('sessions:revoked:others', { userId, count: revokedCount });
            return revokedCount;
        }
        catch (error) {
            throw new Error(`Failed to revoke other sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // ========================================================================
    // Rate Limiting
    // ========================================================================
    async checkRateLimit(username, ipAddress) {
        const keys = [
            `ratelimit:user:${username}`,
            `ratelimit:ip:${ipAddress}`,
        ];
        for (const key of keys) {
            const attempts = await this.redis.get(key);
            const count = attempts ? parseInt(attempts, 10) : 0;
            if (count >= this.config.rateLimitMaxAttempts) {
                const ttl = await this.redis.ttl(key);
                throw new Error(`Too many login attempts. Try again in ${ttl} seconds`);
            }
        }
    }
    async recordFailedLogin(username, ipAddress) {
        const keys = [
            `ratelimit:user:${username}`,
            `ratelimit:ip:${ipAddress}`,
        ];
        for (const key of keys) {
            const current = await this.redis.get(key);
            if (current) {
                await this.redis.incr(key);
            }
            else {
                await this.redis.setex(key, Math.ceil(this.config.rateLimitWindow / 1000), '1');
            }
        }
    }
    async clearRateLimit(username, ipAddress) {
        await this.redis.del(`ratelimit:user:${username}`);
        await this.redis.del(`ratelimit:ip:${ipAddress}`);
    }
    // ========================================================================
    // Authorization (RBAC)
    // ========================================================================
    async checkPermission(userId, resource, action, context) {
        const user = this.users.get(userId);
        if (!user)
            return false;
        // Check user permissions
        const hasPermission = user.permissions.some(p => {
            const [r, a] = p.split(':');
            return (r === resource || r === '*') && (a === action || a === '*');
        });
        if (hasPermission) {
            await this.audit(userId, 'auth:check', 'permission', `${resource}:${action}`, 'success', {}, context.ipAddress, context.userAgent);
            return true;
        }
        await this.audit(userId, 'auth:check', 'permission', `${resource}:${action}`, 'denied', {}, context.ipAddress, context.userAgent);
        return false;
    }
    async assignRole(userId, roleName, context) {
        const user = this.users.get(userId);
        if (!user)
            throw new Error('User not found');
        const role = Array.from(this.roles.values()).find(r => r.name === roleName);
        if (!role)
            throw new Error('Role not found');
        if (!user.roles.includes(roleName)) {
            user.roles.push(roleName);
            user.permissions = this.aggregatePermissions(user.roles);
            user.updatedAt = Date.now();
            await this.updateUser(userId, { roles: user.roles, permissions: user.permissions, updatedAt: user.updatedAt });
        }
        await this.audit(userId, 'role:assigned', 'user', userId, 'success', { role: roleName }, context.ipAddress, context.userAgent);
        this.emit('role:assigned', { userId, roleName });
    }
    async revokeRole(userId, roleName, context) {
        const user = this.users.get(userId);
        if (!user)
            throw new Error('User not found');
        user.roles = user.roles.filter(r => r !== roleName);
        user.permissions = this.aggregatePermissions(user.roles);
        user.updatedAt = Date.now();
        await this.updateUser(userId, { roles: user.roles, permissions: user.permissions, updatedAt: user.updatedAt });
        await this.audit(userId, 'role:revoked', 'user', userId, 'success', { role: roleName }, context.ipAddress, context.userAgent);
        this.emit('role:revoked', { userId, roleName });
    }
    aggregatePermissions(roleNames) {
        const permissions = new Set();
        for (const roleName of roleNames) {
            const role = Array.from(this.roles.values()).find(r => r.name === roleName);
            if (role) {
                role.permissions.forEach(p => permissions.add(p));
                // Inherit from parent roles
                for (const parentName of role.inherits) {
                    const parent = Array.from(this.roles.values()).find(r => r.name === parentName);
                    if (parent) {
                        parent.permissions.forEach(p => permissions.add(p));
                    }
                }
            }
        }
        return Array.from(permissions);
    }
    // ========================================================================
    // Multi-Factor Authentication (MFA)
    // ========================================================================
    async setupMFA(userId, context) {
        const user = this.users.get(userId);
        if (!user)
            throw new Error('User not found');
        const secret = this.generateMFASecret();
        const qrCode = this.generateQRCode(user.username, secret);
        const backupCodes = this.generateBackupCodes(10);
        user.mfaSecret = secret;
        await this.updateUser(userId, { mfaSecret: secret });
        // Store backup codes in Redis (hashed)
        for (const code of backupCodes) {
            const hash = await bcrypt.hash(code, 10);
            await this.redis.sadd(`mfa:backup:${userId}`, hash);
        }
        await this.audit(userId, 'mfa:setup', 'user', userId, 'success', {}, context.ipAddress, context.userAgent);
        return { secret, qrCode, backupCodes };
    }
    async enableMFA(userId, code, context) {
        const user = this.users.get(userId);
        if (!user || !user.mfaSecret)
            throw new Error('MFA not set up');
        if (!await this.verifyMFACode(user.mfaSecret, code)) {
            throw new Error('Invalid MFA code');
        }
        user.mfaEnabled = true;
        user.updatedAt = Date.now();
        await this.updateUser(userId, { mfaEnabled: true, updatedAt: user.updatedAt });
        await this.audit(userId, 'mfa:enabled', 'user', userId, 'success', {}, context.ipAddress, context.userAgent);
        this.emit('mfa:enabled', { userId });
    }
    async disableMFA(userId, context) {
        const user = this.users.get(userId);
        if (!user)
            throw new Error('User not found');
        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        user.updatedAt = Date.now();
        await this.updateUser(userId, { mfaEnabled: false, mfaSecret: undefined, updatedAt: user.updatedAt });
        // Remove backup codes
        await this.redis.del(`mfa:backup:${userId}`);
        await this.audit(userId, 'mfa:disabled', 'user', userId, 'success', {}, context.ipAddress, context.userAgent);
        this.emit('mfa:disabled', { userId });
    }
    async verifyMFACode(secret, code) {
        // Implementation using TOTP algorithm
        // In production, use a library like 'otplib' for proper TOTP verification
        const timeStep = 30; // 30 seconds
        const currentTime = Math.floor(Date.now() / 1000 / timeStep);
        // Check current time window and adjacent windows for clock skew
        for (let i = -1; i <= 1; i++) {
            const timeCounter = currentTime + i;
            const expectedCode = this.generateTOTP(secret, timeCounter);
            if (expectedCode === code) {
                return true;
            }
        }
        return false;
    }
    generateTOTP(secret, counter) {
        // Simplified TOTP generation (in production, use otplib)
        const hmac = crypto.createHmac('sha1', secret);
        const counterBuffer = Buffer.alloc(8);
        counterBuffer.writeBigInt64BE(BigInt(counter));
        hmac.update(counterBuffer);
        const hash = hmac.digest();
        const offset = hash[hash.length - 1] & 0x0f;
        const binary = ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff);
        const otp = binary % 1000000;
        return otp.toString().padStart(6, '0');
    }
    generateMFASecret() {
        return crypto.randomBytes(20).toString('base32');
    }
    generateQRCode(username, secret) {
        // In production: use qrcode library to generate actual QR code
        return `otpauth://totp/SecurityManager:${username}?secret=${secret}&issuer=SecurityManager`;
    }
    generateBackupCodes(count) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }
    // ========================================================================
    // Encryption
    // ========================================================================
    async encrypt(data, keyId) {
        let key;
        if (keyId) {
            const existing = this.encryptionKeys.get(keyId);
            if (!existing)
                throw new Error('Encryption key not found');
            key = existing;
        }
        else {
            key = this.generateEncryptionKey();
            this.encryptionKeys.set(key.id, key);
        }
        const cipher = crypto.createCipheriv('aes-256-gcm', key.key, key.iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        const result = encrypted + ':' + authTag.toString('hex');
        return { encrypted: result, keyId: key.id };
    }
    async decrypt(encrypted, keyId) {
        const key = this.encryptionKeys.get(keyId);
        if (!key)
            throw new Error('Encryption key not found');
        const [ciphertext, authTagHex] = encrypted.split(':');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key.key, key.iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    generateEncryptionKey() {
        return {
            id: this.generateId(),
            algorithm: 'aes-256-gcm',
            key: crypto.randomBytes(32),
            iv: crypto.randomBytes(16),
            createdAt: Date.now(),
        };
    }
    // ========================================================================
    // Audit Logging
    // ========================================================================
    async audit(userId, action, resource, resourceId, result, metadata = {}, ipAddress = '0.0.0.0', userAgent = 'Unknown') {
        if (!this.config.enableAudit)
            return;
        try {
            const log = {
                id: this.generateId(),
                userId,
                action,
                resource,
                resourceId,
                result,
                ipAddress,
                userAgent,
                metadata,
                timestamp: Date.now(),
            };
            // Store in Redis with expiry (90 days)
            await this.redis.zadd('audit:logs', log.timestamp, JSON.stringify(log));
            // Emit event
            this.emit('audit:logged', { log });
            // Trim old logs (keep last 100000)
            const count = await this.redis.zcard('audit:logs');
            if (count > 100000) {
                await this.redis.zremrangebyrank('audit:logs', 0, count - 100001);
            }
        }
        catch (error) {
            // Don't throw on audit errors to prevent breaking application flow
            this.emit('audit:error', { error });
        }
    }
    async getAuditLogs(filters) {
        try {
            const startTime = filters?.startTime || 0;
            const endTime = filters?.endTime || Date.now();
            const limit = filters?.limit || 1000;
            // Get logs from Redis sorted set by timestamp
            const logStrings = await this.redis.zrangebyscore('audit:logs', startTime, endTime, 'LIMIT', 0, limit);
            let logs = logStrings.map(str => JSON.parse(str));
            // Apply filters
            if (filters) {
                if (filters.userId) {
                    logs = logs.filter(l => l.userId === filters.userId);
                }
                if (filters.action) {
                    logs = logs.filter(l => l.action === filters.action);
                }
                if (filters.resource) {
                    logs = logs.filter(l => l.resource === filters.resource);
                }
                if (filters.result) {
                    logs = logs.filter(l => l.result === filters.result);
                }
            }
            return logs;
        }
        catch (error) {
            throw new Error(`Failed to get audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // ========================================================================
    // Security Scanning
    // ========================================================================
    async scanSecurity() {
        this.emit('security:scan:start');
        const results = [];
        try {
            // Check for weak passwords (if any user has very short hash - indicates old weak algorithm)
            for (const user of this.users.values()) {
                if (user.passwordHash.length < 50) {
                    results.push({
                        id: this.generateId(),
                        type: 'vulnerability',
                        severity: 'high',
                        title: 'Weak Password Hash Detected',
                        description: `User ${user.username} has a potentially weak password hash`,
                        affected: [user.id],
                        remediation: 'User should reset password to use bcrypt hashing',
                        timestamp: Date.now(),
                    });
                }
            }
            // Check for inactive sessions
            const allUserIds = Array.from(this.users.keys());
            for (const userId of allUserIds) {
                const sessions = await this.getUserSessions(userId);
                for (const session of sessions) {
                    if (Date.now() - session.lastActivity > this.config.sessionTimeout) {
                        results.push({
                            id: this.generateId(),
                            type: 'vulnerability',
                            severity: 'medium',
                            title: 'Inactive Session',
                            description: `Session ${session.id} has been inactive for too long`,
                            affected: [session.id],
                            remediation: 'Terminate inactive sessions automatically',
                            timestamp: Date.now(),
                        });
                    }
                }
            }
            // Check for users without MFA
            if (this.config.enableMFA) {
                for (const user of this.users.values()) {
                    if (!user.mfaEnabled && user.roles.includes('admin')) {
                        results.push({
                            id: this.generateId(),
                            type: 'compliance',
                            severity: 'high',
                            title: 'Admin Without MFA',
                            description: `Admin user ${user.username} does not have MFA enabled`,
                            affected: [user.id],
                            remediation: 'Enable MFA for all admin users',
                            timestamp: Date.now(),
                        });
                    }
                }
            }
            // Check for locked accounts
            for (const user of this.users.values()) {
                if (user.locked) {
                    results.push({
                        id: this.generateId(),
                        type: 'vulnerability',
                        severity: 'low',
                        title: 'Locked Account',
                        description: `User ${user.username} is currently locked`,
                        affected: [user.id],
                        remediation: 'Review and unlock if necessary',
                        timestamp: Date.now(),
                    });
                }
            }
            this.emit('security:scan:complete', { results });
            return results;
        }
        catch (error) {
            this.emit('security:scan:error', { error });
            throw error;
        }
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    validatePassword(password) {
        if (!password || password.length < this.config.passwordMinLength) {
            throw new Error(`Password must be at least ${this.config.passwordMinLength} characters`);
        }
        if (this.config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }
        if (this.config.passwordRequireNumbers && !/[0-9]/.test(password)) {
            throw new Error('Password must contain at least one number');
        }
        if (this.config.passwordRequireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            throw new Error('Password must contain at least one special character');
        }
    }
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    generateJWT(user, type) {
        const expiresIn = type === 'access' ? this.config.jwtExpiry : this.config.jwtRefreshExpiry;
        const payload = {
            userId: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            type,
        };
        return jwt.sign(payload, this.config.jwtSecret, {
            expiresIn,
            algorithm: 'HS256',
            issuer: 'SecurityManager',
        });
    }
    generateDeviceId(context) {
        const data = `${context.ipAddress}:${context.userAgent}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }
    initializeDefaultRoles() {
        const adminRole = {
            id: 'role-admin',
            name: 'admin',
            description: 'Administrator with full access',
            permissions: ['*:*'],
            inherits: [],
        };
        const userRole = {
            id: 'role-user',
            name: 'user',
            description: 'Regular user',
            permissions: ['read:own', 'write:own', 'delete:own'],
            inherits: [],
        };
        const viewerRole = {
            id: 'role-viewer',
            name: 'viewer',
            description: 'Read-only access',
            permissions: ['read:*'],
            inherits: [],
        };
        this.roles.set(adminRole.id, adminRole);
        this.roles.set(userRole.id, userRole);
        this.roles.set(viewerRole.id, viewerRole);
    }
    generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }
    generateId() {
        return `sec-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    }
    sanitizeUser(user) {
        const { passwordHash, ...sanitized } = user;
        return sanitized;
    }
    // ========================================================================
    // Statistics & Management
    // ========================================================================
    async getStats() {
        const allUserIds = Array.from(this.users.keys());
        let totalActiveSessions = 0;
        for (const userId of allUserIds) {
            const sessions = await this.getUserSessions(userId);
            totalActiveSessions += sessions.length;
        }
        return {
            totalUsers: this.users.size,
            activeUsers: Array.from(this.users.values()).filter(u => !u.locked).length,
            lockedUsers: Array.from(this.users.values()).filter(u => u.locked).length,
            activeSessions: totalActiveSessions,
            mfaEnabledUsers: Array.from(this.users.values()).filter(u => u.mfaEnabled).length,
            auditLogCount: await this.redis.zcard('audit:logs'),
            redisConnected: this.redisConnected,
        };
    }
    async cleanup() {
        // Clean up expired sessions
        const allUserIds = Array.from(this.users.keys());
        for (const userId of allUserIds) {
            await this.getUserSessions(userId); // This will clean up expired sessions
        }
        // Clean up old audit logs (older than 90 days)
        const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
        await this.redis.zremrangebyscore('audit:logs', 0, ninetyDaysAgo);
        this.emit('cleanup:complete');
    }
    async disconnect() {
        await this.redis.quit();
        this.redisConnected = false;
    }
    getUser(userId) {
        const user = this.users.get(userId);
        return user ? this.sanitizeUser(user) : undefined;
    }
    getUserByUsername(username) {
        const user = Array.from(this.users.values()).find(u => u.username === username);
        return user ? this.sanitizeUser(user) : undefined;
    }
    getUserByEmail(email) {
        const user = Array.from(this.users.values()).find(u => u.email === email);
        return user ? this.sanitizeUser(user) : undefined;
    }
}
exports.SecurityManager = SecurityManager;
// ============================================================================
// Export
// ============================================================================
exports.default = SecurityManager;
