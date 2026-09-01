/**
 * Security System
 * Authentication, authorization, encryption, and security scanning
 */
export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    roles: string[];
    permissions: string[];
    mfaEnabled: boolean;
    mfaSecret?: string;
    apiKeys: ApiKey[];
    createdAt: Date;
    lastLoginAt?: Date;
}
export interface ApiKey {
    id: string;
    name: string;
    key: string;
    keyHash: string;
    permissions: string[];
    expiresAt?: Date;
    createdAt: Date;
    lastUsedAt?: Date;
}
export interface Session {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    lastActivityAt: Date;
    metadata?: Record<string, any>;
}
export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
}
export interface Permission {
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | '*';
}
export interface SecurityPolicy {
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireLowercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecialChars: boolean;
    sessionTimeout: number;
    maxFailedLoginAttempts: number;
    lockoutDuration: number;
    mfaRequired: boolean;
}
export interface SecurityAuditLog {
    id: string;
    userId?: string;
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'denied';
    timestamp: Date;
    metadata?: Record<string, any>;
}
/**
 * Authentication Manager
 */
export declare class AuthenticationManager {
    private users;
    private sessions;
    private failedAttempts;
    private lockouts;
    private policy;
    /**
     * Register new user
     */
    register(username: string, email: string, password: string, roles?: string[]): Promise<User>;
    /**
     * Login user
     */
    login(username: string, password: string, mfaToken?: string): Promise<Session>;
    /**
     * Logout user
     */
    logout(sessionToken: string): void;
    /**
     * Verify session
     */
    verifySession(sessionToken: string): Session | null;
    /**
     * Create API key
     */
    createApiKey(userId: string, name: string, permissions: string[], expiresInDays?: number): Promise<ApiKey>;
    /**
     * Verify API key
     */
    verifyApiKey(key: string): Promise<{
        user: User;
        apiKey: ApiKey;
    } | null>;
    /**
     * Enable MFA for user
     */
    enableMFA(userId: string): string;
    /**
     * Disable MFA for user
     */
    disableMFA(userId: string): void;
    /**
     * Get user by ID
     */
    getUser(userId: string): User | undefined;
    /**
     * Update security policy
     */
    setPolicy(policy: Partial<SecurityPolicy>): void;
    private findUserByUsername;
    private findUserByEmail;
    private validatePassword;
    private hashPassword;
    private verifyPassword;
    private isLockedOut;
    private recordFailedAttempt;
    private createSession;
    private generateUserId;
    private generateSessionId;
    private generateSessionToken;
    private generateApiKey;
    private generateApiKeyId;
    private generateMFASecret;
    private verifyMFAToken;
}
/**
 * Authorization Manager
 */
export declare class AuthorizationManager {
    private roles;
    /**
     * Create role
     */
    createRole(name: string, description: string, permissions: string[]): Role;
    /**
     * Check if user has permission
     */
    hasPermission(user: User, resource: string, action: string): boolean;
    /**
     * Check permissions list
     */
    private checkPermissions;
    /**
     * Get role by name
     */
    private findRoleByName;
    /**
     * Create default roles
     */
    static createDefaultRoles(): Role[];
    private generateRoleId;
}
/**
 * Encryption Manager
 */
export declare class EncryptionManager {
    private algorithm;
    private keyLength;
    /**
     * Generate encryption key
     */
    generateKey(): Buffer;
    /**
     * Encrypt data
     */
    encrypt(data: string, key: Buffer): {
        encrypted: string;
        iv: string;
        tag: string;
    };
    /**
     * Decrypt data
     */
    decrypt(encrypted: string, key: Buffer, iv: string, tag: string): string;
    /**
     * Hash data
     */
    hash(data: string, algorithm?: 'sha256' | 'sha512'): string;
    /**
     * Generate HMAC
     */
    hmac(data: string, key: Buffer, algorithm?: 'sha256' | 'sha512'): string;
    /**
     * Generate random token
     */
    generateToken(length?: number): string;
}
/**
 * Security Audit Logger
 */
export declare class SecurityAuditLogger {
    private logs;
    private maxLogs;
    /**
     * Log security event
     */
    log(action: string, resource: string, result: SecurityAuditLog['result'], userId?: string, metadata?: Record<string, any>): void;
    /**
     * Query audit logs
     */
    query(filter?: {
        userId?: string;
        action?: string;
        resource?: string;
        result?: SecurityAuditLog['result'];
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): SecurityAuditLog[];
    /**
     * Get security statistics
     */
    getStats(): {
        totalLogs: number;
        successCount: number;
        failureCount: number;
        deniedCount: number;
        topUsers: Array<{
            userId: string;
            count: number;
        }>;
        topActions: Array<{
            action: string;
            count: number;
        }>;
    };
    private generateLogId;
}
/**
 * Security Scanner
 */
export declare class SecurityScanner {
    /**
     * Scan for common vulnerabilities
     */
    scan(target: string): Promise<SecurityScanResult>;
    private scanWeakPasswords;
    private scanExposedSecrets;
    private scanDependencies;
}
interface SecurityScanResult {
    target: string;
    timestamp: Date;
    vulnerabilities: SecurityVulnerability[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}
interface SecurityVulnerability {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
}
/**
 * Singleton instances
 */
export declare const authenticationManager: AuthenticationManager;
export declare const authorizationManager: AuthorizationManager;
export declare const encryptionManager: EncryptionManager;
export declare const securityAuditLogger: SecurityAuditLogger;
export declare const securityScanner: SecurityScanner;
export {};
//# sourceMappingURL=Security.d.ts.map