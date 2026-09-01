/**
 * MEGA PHASE 24: ADVANCED SECURITY & AUTHENTICATION
 * OAuth2, JWT, RBAC, MFA, SSO, Security scanning, Audit logging
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface AuthConfig {
    jwtSecret: string;
    jwtExpiration: number;
    refreshTokenExpiration: number;
    passwordPolicy: PasswordPolicy;
    mfaEnabled: boolean;
    sessionTimeout: number;
}
export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number;
    preventReuse: number;
}
export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    passwordHistory: string[];
    roles: string[];
    permissions: string[];
    mfaEnabled: boolean;
    mfaSecret?: string;
    mfaBackupCodes?: string[];
    mfaMethod?: MFAMethod;
    phoneNumber?: string;
    trustedDevices: TrustedDevice[];
    status: UserStatus;
    metadata: UserMetadata;
    createdAt: Date;
    lastLogin?: Date;
}
export type MFAMethod = 'totp' | 'sms' | 'backup';
export interface TrustedDevice {
    id: string;
    name: string;
    fingerprint: string;
    userAgent: string;
    ipAddress: string;
    addedAt: Date;
    lastUsed: Date;
    expiresAt: Date;
}
export interface MFAEnrollmentResponse {
    secret: string;
    qrCode: string;
    backupCodes: string[];
    manualEntryKey: string;
}
export interface MFAVerificationRequest {
    userId: string;
    code: string;
    method: MFAMethod;
    trustDevice?: boolean;
    deviceInfo?: DeviceInfo;
}
export interface DeviceInfo {
    userAgent: string;
    ipAddress: string;
    deviceName?: string;
}
export type UserStatus = 'active' | 'inactive' | 'locked' | 'pending';
export interface UserMetadata {
    firstName?: string;
    lastName?: string;
    phone?: string;
    preferences: Map<string, any>;
    customFields: Map<string, any>;
}
export interface Session {
    id: string;
    userId: string;
    token: string;
    refreshToken: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
    createdAt: Date;
    lastActivity: Date;
}
export interface AuthToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
}
export interface LoginRequest {
    username: string;
    password: string;
    mfaCode?: string;
    mfaMethod?: MFAMethod;
    deviceFingerprint?: string;
    ipAddress: string;
    userAgent: string;
}
export interface LoginResponse {
    success: boolean;
    token?: AuthToken;
    user?: User;
    requireMFA?: boolean;
    error?: string;
}
export declare class AuthenticationSystem extends EventEmitter {
    private config;
    private users;
    private sessions;
    private loginAttempts;
    private pendingMFAEnrollments;
    private smsVerificationCodes;
    constructor(config?: Partial<AuthConfig>);
    register(username: string, email: string, password: string): Promise<User>;
    login(request: LoginRequest): Promise<LoginResponse>;
    logout(sessionId: string): Promise<void>;
    refreshToken(refreshToken: string): Promise<AuthToken>;
    enableMFA(userId: string): Promise<string>;
    /**
     * Complete MFA enrollment flow with QR code generation
     */
    enrollMFA(userId: string, appName?: string): Promise<MFAEnrollmentResponse>;
    /**
     * Complete MFA enrollment by verifying the first code
     */
    completeMFAEnrollment(userId: string, verificationCode: string): Promise<boolean>;
    /**
     * Disable MFA for a user
     */
    disableMFA(userId: string, verificationCode: string): Promise<boolean>;
    /**
     * Enable SMS fallback for MFA
     */
    enableSMSFallback(userId: string, phoneNumber: string): Promise<void>;
    /**
     * Send SMS verification code
     */
    sendSMSCode(userId: string): Promise<boolean>;
    /**
     * Verify SMS code
     */
    private verifySMSCode;
    /**
     * Recover account using backup codes
     */
    recoverWithBackupCode(userId: string, backupCode: string): Promise<boolean>;
    /**
     * Regenerate backup codes
     */
    regenerateBackupCodes(userId: string, verificationCode: string): Promise<string[]>;
    /**
     * Add trusted device
     */
    addTrustedDevice(userId: string, deviceInfo: DeviceInfo, durationDays?: number): Promise<TrustedDevice>;
    /**
     * Remove trusted device
     */
    removeTrustedDevice(userId: string, deviceId: string): Promise<boolean>;
    /**
     * List trusted devices
     */
    getTrustedDevices(userId: string): TrustedDevice[];
    /**
     * Check if device is trusted
     */
    private isDeviceTrusted;
    verifySession(token: string): Promise<User | null>;
    private createSession;
    private validatePassword;
    private hashPassword;
    private verifyPassword;
    private generateJWT;
    private verifyJWT;
    private generateRefreshToken;
    private generateMFASecret;
    private verifyMFACode;
    private verifyTOTPCode;
    /**
     * Generate backup codes
     */
    private generateBackupCodes;
    /**
     * Hash backup code for secure storage
     */
    private hashBackupCode;
    /**
     * Verify backup code against hash
     */
    private verifyBackupCode;
    /**
     * Generate SMS verification code
     */
    private generateSMSCode;
    /**
     * Generate device fingerprint
     */
    private generateDeviceFingerprint;
    /**
     * Extract device name from user agent
     */
    private extractDeviceName;
    private findUserByUsername;
    private findUserByEmail;
    private checkRateLimit;
    private recordLoginAttempt;
    private startSessionMonitor;
    private cleanExpiredSessions;
    private generateId;
    getStats(): {
        users: number;
        activeSessions: number;
        mfaEnabled: number;
        trustedDevices: number;
        pendingEnrollments: number;
    };
}
export interface LoginAttempt {
    timestamp: Date;
    success: boolean;
}
export interface SMSVerification {
    code: string;
    expiresAt: Date;
    attempts: number;
}
export interface RBACConfig {
    enableInheritance: boolean;
    enableWildcards: boolean;
    defaultDeny: boolean;
}
export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    inherits: string[];
    createdAt: Date;
}
export interface Permission {
    id: string;
    resource: string;
    action: Action;
    conditions?: Condition[];
}
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | '*';
export interface Condition {
    field: string;
    operator: Operator;
    value: any;
}
export type Operator = 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in';
export interface AccessRequest {
    userId: string;
    resource: string;
    action: Action;
    context?: Record<string, any>;
}
export interface AccessDecision {
    allowed: boolean;
    reason?: string;
    matchedPermissions: string[];
}
export declare class RBACSystem extends EventEmitter {
    private config;
    private roles;
    private userRoles;
    constructor(config?: Partial<RBACConfig>);
    private initializeDefaultRoles;
    createRole(role: Omit<Role, 'id' | 'createdAt'>): Role;
    assignRole(userId: string, roleId: string): void;
    revokeRole(userId: string, roleId: string): void;
    checkAccess(request: AccessRequest): AccessDecision;
    getUserPermissions(userId: string): string[];
    private getRolePermissions;
    private matchesPermission;
    private generateId;
    getStats(): {
        roles: number;
        usersWithRoles: number;
    };
}
export interface AuditConfig {
    enabled: boolean;
    storage: AuditStorage;
    retention: number;
    sensitive: boolean;
}
export type AuditStorage = 'database' | 'file' | 'siem';
export interface AuditLog {
    id: string;
    timestamp: Date;
    userId?: string;
    action: AuditAction;
    resource: string;
    result: AuditResult;
    ipAddress: string;
    userAgent?: string;
    details: Map<string, any>;
    severity: AuditSeverity;
}
export type AuditAction = 'login' | 'logout' | 'access' | 'create' | 'read' | 'update' | 'delete' | 'permission_change' | 'security_event';
export type AuditResult = 'success' | 'failure' | 'denied';
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';
export declare class AuditLogger extends EventEmitter {
    private config;
    private logs;
    constructor(config?: Partial<AuditConfig>);
    log(log: Omit<AuditLog, 'id' | 'timestamp'>): void;
    query(filters: AuditQueryFilters): AuditLog[];
    private startRetentionCleanup;
    private cleanOldLogs;
    private generateId;
    getStats(): {
        totalLogs: number;
        criticalLogs: number;
        failedActions: number;
    };
}
export interface AuditQueryFilters {
    userId?: string;
    action?: AuditAction;
    result?: AuditResult;
    severity?: AuditSeverity;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
}
export declare class CompleteSecuritySystem {
    auth: AuthenticationSystem;
    rbac: RBACSystem;
    audit: AuditLogger;
    constructor();
    private setupIntegration;
    getOverallStats(): {
        auth: {
            users: number;
            activeSessions: number;
            mfaEnabled: number;
            trustedDevices: number;
            pendingEnrollments: number;
        };
        rbac: {
            roles: number;
            usersWithRoles: number;
        };
        audit: {
            totalLogs: number;
            criticalLogs: number;
            failedActions: number;
        };
    };
}
//# sourceMappingURL=MEGA_SecurityAuthentication.d.ts.map