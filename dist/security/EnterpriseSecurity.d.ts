/**
 * Enterprise Security System
 * Advanced authentication, authorization, and security features
 *
 * Part of 350K lines goal
 */
import { EventEmitter } from 'events';
export interface SecurityConfig {
    enableMFA: boolean;
    enableSSO: boolean;
    enableZeroTrust: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordPolicy: PasswordPolicy;
    encryptionAlgorithm: string;
}
export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expiryDays: number;
    preventReuse: number;
}
export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    mfaEnabled: boolean;
    mfaSecret?: string;
    roles: string[];
    permissions: string[];
    lastLogin?: Date;
    failedLoginAttempts: number;
    locked: boolean;
    metadata: UserMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserMetadata {
    firstName?: string;
    lastName?: string;
    department?: string;
    title?: string;
    phone?: string;
    avatar?: string;
}
export interface Session {
    id: string;
    userId: string;
    token: string;
    refreshToken: string;
    expiresAt: Date;
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;
    riskScore: number;
    metadata: SessionMetadata;
    createdAt: Date;
}
export interface SessionMetadata {
    location?: string;
    device?: string;
    browser?: string;
    os?: string;
}
export interface AuthenticationResult {
    success: boolean;
    user?: User;
    session?: Session;
    requiresMFA?: boolean;
    error?: string;
    riskAssessment?: RiskAssessment;
}
export interface RiskAssessment {
    score: number;
    factors: RiskFactor[];
    recommendation: RiskRecommendation;
}
export interface RiskFactor {
    type: RiskFactorType;
    severity: RiskSeverity;
    description: string;
    score: number;
}
export type RiskFactorType = 'unusual_location' | 'unusual_time' | 'new_device' | 'suspicious_ip' | 'multiple_failures' | 'account_sharing';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskRecommendation = 'allow' | 'challenge_mfa' | 'require_verification' | 'block';
export interface MFAConfig {
    type: MFAType;
    enabled: boolean;
    settings: MFASettings;
}
export type MFAType = 'totp' | 'sms' | 'email' | 'biometric' | 'hardware_key';
export interface MFASettings {
    issuer: string;
    window: number;
    period: number;
    digits: number;
}
export interface MFAChallenge {
    id: string;
    userId: string;
    type: MFAType;
    code?: string;
    expiresAt: Date;
    verified: boolean;
    attempts: number;
}
export interface SSOConfig {
    provider: SSOProvider;
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}
export type SSOProvider = 'oauth2' | 'saml' | 'oidc' | 'ldap' | 'azure_ad' | 'okta' | 'google';
export interface SSOSession {
    id: string;
    provider: SSOProvider;
    externalId: string;
    tokens: SSOTokens;
    metadata: Record<string, any>;
}
export interface SSOTokens {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt: Date;
}
export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
    parent?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Permission {
    id: string;
    resource: string;
    action: Action;
    conditions?: AccessCondition[];
}
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'admin';
export interface AccessCondition {
    type: ConditionType;
    operator: ConditionOperator;
    value: any;
}
export type ConditionType = 'time' | 'location' | 'attribute' | 'context';
export type ConditionOperator = 'equals' | 'contains' | 'greater_than' | 'less_than';
export interface AuditLog {
    id: string;
    userId: string;
    action: string;
    resource: string;
    result: AuditResult;
    details: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
}
export type AuditResult = 'success' | 'failure' | 'denied';
export interface ThreatEvent {
    id: string;
    type: ThreatType;
    severity: ThreatSeverity;
    source: string;
    target?: string;
    details: Record<string, any>;
    mitigated: boolean;
    timestamp: Date;
}
export type ThreatType = 'brute_force' | 'credential_stuffing' | 'session_hijacking' | 'privilege_escalation' | 'data_exfiltration' | 'malware' | 'ddos';
export type ThreatSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export declare class EnterpriseSecurityManager extends EventEmitter {
    private config;
    private users;
    private sessions;
    private roles;
    private auditLogs;
    private threats;
    private mfaChallenges;
    private ssoConfigs;
    constructor(config?: Partial<SecurityConfig>);
    authenticate(username: string, password: string, metadata?: Partial<SessionMetadata>): Promise<AuthenticationResult>;
    initiateMFA(userId: string, type?: MFAType): Promise<MFAChallenge>;
    verifyMFA(challengeId: string, code: string): Promise<boolean>;
    private generateMFACode;
    private sendMFACode;
    configureSSOProvider(provider: SSOProvider, config: Partial<SSOConfig>): void;
    authenticateSSO(provider: SSOProvider, token: string): Promise<AuthenticationResult>;
    private verifySSOToken;
    private createUserFromSSO;
    createRole(name: string, permissions: Permission[], parent?: string): Role;
    assignRole(userId: string, roleId: string): void;
    hasPermission(userId: string, resource: string, action: Action): boolean;
    private assessRisk;
    private isUnusualLocation;
    private isNewDevice;
    detectThreat(type: ThreatType, source: string, details: Record<string, any>): ThreatEvent;
    private calculateThreatSeverity;
    private mitigateThreat;
    private createSession;
    private verifyPassword;
    private hashPassword;
    private generateToken;
    private generateDeviceFingerprint;
    private findUserByUsername;
    private findUserByEmail;
    private generateId;
    private logAudit;
    private initializeDefaultRoles;
    getStats(): {
        totalUsers: number;
        activeSessions: number;
        roles: number;
        auditLogs: number;
        threats: number;
        criticalThreats: number;
    };
}
//# sourceMappingURL=EnterpriseSecurity.d.ts.map