/**
 * Advanced Security System
 * Authentication, Authorization, Encryption, Audit Logging
 * RBAC, OAuth, JWT, MFA, Security Scanning
 */
import { EventEmitter } from 'events';
export interface SecurityConfig {
    enableAuth: boolean;
    enableEncryption: boolean;
    enableAudit: boolean;
    enableMFA: boolean;
    jwtSecret: string;
    jwtExpiry: number;
    jwtRefreshExpiry: number;
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecialChars: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    rateLimitWindow: number;
    rateLimitMaxAttempts: number;
    passwordResetExpiry: number;
    bcryptRounds: number;
    redisUrl?: string;
}
export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    roles: string[];
    permissions: string[];
    mfaEnabled: boolean;
    mfaSecret?: string;
    locked: boolean;
    lockedUntil?: number;
    loginAttempts: number;
    lastLogin?: number;
    createdAt: number;
    updatedAt: number;
}
export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    inherits: string[];
}
export interface Permission {
    id: string;
    resource: string;
    action: string;
    conditions?: PermissionCondition[];
}
export interface PermissionCondition {
    type: 'time' | 'ip' | 'resource_owner' | 'custom';
    operator: 'equals' | 'contains' | 'matches' | 'in_range';
    value: any;
}
export interface AuthToken {
    token: string;
    type: 'access' | 'refresh';
    userId: string;
    expiresAt: number;
    scopes: string[];
}
export interface Session {
    id: string;
    userId: string;
    token: string;
    ipAddress: string;
    userAgent: string;
    deviceId: string;
    createdAt: number;
    expiresAt: number;
    lastActivity: number;
}
export interface AuditLog {
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    result: 'success' | 'failure' | 'denied';
    ipAddress: string;
    userAgent: string;
    metadata: Record<string, any>;
    timestamp: number;
}
export interface SecurityScanResult {
    id: string;
    type: 'vulnerability' | 'malware' | 'compliance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    affected: string[];
    remediation: string;
    timestamp: number;
}
export interface EncryptionKey {
    id: string;
    algorithm: 'aes-256-gcm' | 'rsa' | 'ed25519';
    key: Buffer;
    iv?: Buffer;
    createdAt: number;
    expiresAt?: number;
}
export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
}
export interface MFASetup {
    secret: string;
    qrCode: string;
    backupCodes: string[];
}
export interface PasswordResetToken {
    token: string;
    userId: string;
    expiresAt: number;
    used: boolean;
}
export interface LoginContext {
    ipAddress: string;
    userAgent: string;
    deviceId?: string;
}
export declare class SecurityManager extends EventEmitter {
    private config;
    private users;
    private roles;
    private permissions;
    private encryptionKeys;
    private redis;
    private redisConnected;
    constructor(config?: Partial<SecurityConfig>);
    private initializeRedis;
    createUser(username: string, email: string, password: string, roles?: string[]): Promise<User>;
    updateUser(userId: string, updates: Partial<User>): Promise<User>;
    deleteUser(userId: string): Promise<void>;
    login(username: string, password: string, context: LoginContext, mfaCode?: string): Promise<{
        token: string;
        refreshToken: string;
        user: User;
        sessionId: string;
    }>;
    logout(token: string, context: LoginContext): Promise<void>;
    validateToken(token: string): Promise<User | null>;
    refreshToken(refreshToken: string, context: LoginContext): Promise<{
        token: string;
        refreshToken: string;
    }>;
    requestPasswordReset(email: string, context: LoginContext): Promise<string>;
    resetPassword(resetToken: string, newPassword: string, context: LoginContext): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string, context: LoginContext): Promise<void>;
    private createSession;
    getUserSessions(userId: string): Promise<Session[]>;
    revokeSession(sessionId: string, context: LoginContext): Promise<void>;
    revokeAllUserSessions(userId: string): Promise<void>;
    revokeOtherSessions(userId: string, currentSessionId: string, context: LoginContext): Promise<number>;
    private checkRateLimit;
    private recordFailedLogin;
    private clearRateLimit;
    checkPermission(userId: string, resource: string, action: string, context: LoginContext): Promise<boolean>;
    assignRole(userId: string, roleName: string, context: LoginContext): Promise<void>;
    revokeRole(userId: string, roleName: string, context: LoginContext): Promise<void>;
    private aggregatePermissions;
    setupMFA(userId: string, context: LoginContext): Promise<MFASetup>;
    enableMFA(userId: string, code: string, context: LoginContext): Promise<void>;
    disableMFA(userId: string, context: LoginContext): Promise<void>;
    private verifyMFACode;
    private generateTOTP;
    private generateMFASecret;
    private generateQRCode;
    private generateBackupCodes;
    encrypt(data: string, keyId?: string): Promise<{
        encrypted: string;
        keyId: string;
    }>;
    decrypt(encrypted: string, keyId: string): Promise<string>;
    private generateEncryptionKey;
    audit(userId: string, action: string, resource: string, resourceId: string, result: 'success' | 'failure' | 'denied', metadata?: Record<string, any>, ipAddress?: string, userAgent?: string): Promise<void>;
    getAuditLogs(filters?: {
        userId?: string;
        action?: string;
        resource?: string;
        result?: string;
        startTime?: number;
        endTime?: number;
        limit?: number;
    }): Promise<AuditLog[]>;
    scanSecurity(): Promise<SecurityScanResult[]>;
    private validatePassword;
    private validateEmail;
    private generateJWT;
    private generateDeviceId;
    private initializeDefaultRoles;
    private generateSecret;
    private generateId;
    private sanitizeUser;
    getStats(): Promise<SecurityStats>;
    cleanup(): Promise<void>;
    disconnect(): Promise<void>;
    getUser(userId: string): User | undefined;
    getUserByUsername(username: string): User | undefined;
    getUserByEmail(email: string): User | undefined;
}
interface SecurityStats {
    totalUsers: number;
    activeUsers: number;
    lockedUsers: number;
    activeSessions: number;
    mfaEnabledUsers: number;
    auditLogCount: number;
    redisConnected: boolean;
}
export default SecurityManager;
//# sourceMappingURL=SecurityManager.d.ts.map