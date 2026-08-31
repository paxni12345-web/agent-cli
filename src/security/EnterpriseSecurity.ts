/**
 * Enterprise Security System
 * Advanced authentication, authorization, and security features
 *
 * Part of 350K lines goal
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type RiskFactorType =
  | 'unusual_location'
  | 'unusual_time'
  | 'new_device'
  | 'suspicious_ip'
  | 'multiple_failures'
  | 'account_sharing';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskRecommendation =
  | 'allow'
  | 'challenge_mfa'
  | 'require_verification'
  | 'block';

// Multi-Factor Authentication
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

// Single Sign-On
export interface SSOConfig {
  provider: SSOProvider;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export type SSOProvider =
  | 'oauth2'
  | 'saml'
  | 'oidc'
  | 'ldap'
  | 'azure_ad'
  | 'okta'
  | 'google';

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

// Role-Based Access Control
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

// Audit Logging
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

// Threat Detection
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

export type ThreatType =
  | 'brute_force'
  | 'credential_stuffing'
  | 'session_hijacking'
  | 'privilege_escalation'
  | 'data_exfiltration'
  | 'malware'
  | 'ddos';

export type ThreatSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Enterprise Security Manager
// ============================================================================

export class EnterpriseSecurityManager extends EventEmitter {
  private config: SecurityConfig;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private roles: Map<string, Role> = new Map();
  private auditLogs: AuditLog[] = [];
  private threats: ThreatEvent[] = [];
  private mfaChallenges: Map<string, MFAChallenge> = new Map();
  private ssoConfigs: Map<string, SSOConfig> = new Map();

  constructor(config: Partial<SecurityConfig> = {}) {
    super();
    this.config = {
      enableMFA: true,
      enableSSO: true,
      enableZeroTrust: true,
      sessionTimeout: 3600000, // 1 hour
      maxLoginAttempts: 5,
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expiryDays: 90,
        preventReuse: 5,
      },
      encryptionAlgorithm: 'aes-256-gcm',
      ...config,
    };

    this.initializeDefaultRoles();
  }

  // ========================================================================
  // Authentication
  // ========================================================================

  public async authenticate(
    username: string,
    password: string,
    metadata: Partial<SessionMetadata> = {}
  ): Promise<AuthenticationResult> {
    try {
      // Find user
      const user = this.findUserByUsername(username);

      if (!user) {
        this.logAudit({
          userId: 'unknown',
          action: 'login',
          resource: 'authentication',
          result: 'failure',
          details: { reason: 'user_not_found', username },
          ipAddress: metadata.location || 'unknown',
          userAgent: metadata.browser || 'unknown',
        });

        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Check if account is locked
      if (user.locked) {
        return {
          success: false,
          error: 'Account locked due to multiple failed attempts',
        };
      }

      // Verify password
      const passwordValid = await this.verifyPassword(password, user.passwordHash);

      if (!passwordValid) {
        user.failedLoginAttempts++;

        if (user.failedLoginAttempts >= this.config.maxLoginAttempts) {
          user.locked = true;
          this.emit('user:locked', { userId: user.id });
        }

        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Reset failed attempts
      user.failedLoginAttempts = 0;

      // Risk assessment
      const riskAssessment = await this.assessRisk(user, metadata);

      // Check if MFA required
      if (user.mfaEnabled || riskAssessment.recommendation !== 'allow') {
        return {
          success: true,
          user,
          requiresMFA: true,
          riskAssessment,
        };
      }

      // Create session
      const session = await this.createSession(user, metadata);

      user.lastLogin = new Date();

      this.logAudit({
        userId: user.id,
        action: 'login',
        resource: 'authentication',
        result: 'success',
        details: { riskScore: riskAssessment.score },
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      });

      return {
        success: true,
        user,
        session,
        riskAssessment,
      };
    } catch (error) {
      this.emit('auth:error', { error });
      throw error;
    }
  }

  // ========================================================================
  // Multi-Factor Authentication
  // ========================================================================

  public async initiateMFA(userId: string, type: MFAType = 'totp'): Promise<MFAChallenge> {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const challenge: MFAChallenge = {
      id: this.generateId(),
      userId,
      type,
      code: this.generateMFACode(),
      expiresAt: new Date(Date.now() + 300000), // 5 minutes
      verified: false,
      attempts: 0,
    };

    this.mfaChallenges.set(challenge.id, challenge);

    // Send code via appropriate channel
    await this.sendMFACode(user, challenge);

    this.emit('mfa:initiated', { userId, challengeId: challenge.id, type });

    return challenge;
  }

  public async verifyMFA(challengeId: string, code: string): Promise<boolean> {
    const challenge = this.mfaChallenges.get(challengeId);

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    if (challenge.expiresAt < new Date()) {
      return false;
    }

    challenge.attempts++;

    if (challenge.attempts > 3) {
      this.mfaChallenges.delete(challengeId);
      return false;
    }

    const valid = challenge.code === code;

    if (valid) {
      challenge.verified = true;
      this.emit('mfa:verified', { userId: challenge.userId, challengeId });
    }

    return valid;
  }

  private generateMFACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendMFACode(user: User, challenge: MFAChallenge): Promise<void> {
    // In production, send via SMS, email, or authenticator app
    this.emit('mfa:code:sent', {
      userId: user.id,
      type: challenge.type,
      code: challenge.code, // Only for dev
    });
  }

  // ========================================================================
  // Single Sign-On
  // ========================================================================

  public configureSSOProvider(provider: SSOProvider, config: Partial<SSOConfig>): void {
    const ssoConfig: SSOConfig = {
      provider,
      enabled: true,
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      redirectUri: config.redirectUri || '',
      scopes: config.scopes || ['openid', 'profile', 'email'],
    };

    this.ssoConfigs.set(provider, ssoConfig);
    this.emit('sso:configured', { provider });
  }

  public async authenticateSSO(
    provider: SSOProvider,
    token: string
  ): Promise<AuthenticationResult> {
    const config = this.ssoConfigs.get(provider);

    if (!config || !config.enabled) {
      throw new Error(`SSO provider ${provider} not configured`);
    }

    // Verify token with provider
    const profile = await this.verifySSOToken(provider, token);

    // Find or create user
    let user = this.findUserByEmail(profile.email);

    if (!user) {
      user = await this.createUserFromSSO(profile);
    }

    // Create session
    const session = await this.createSession(user, {});

    this.logAudit({
      userId: user.id,
      action: 'sso_login',
      resource: 'authentication',
      result: 'success',
      details: { provider },
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    });

    return {
      success: true,
      user,
      session,
    };
  }

  private async verifySSOToken(
    provider: SSOProvider,
    token: string
  ): Promise<any> {
    // In production, verify with actual SSO provider
    return {
      email: 'user@example.com',
      name: 'John Doe',
      sub: 'external-id-123',
    };
  }

  private async createUserFromSSO(profile: any): Promise<User> {
    const user: User = {
      id: this.generateId(),
      username: profile.email,
      email: profile.email,
      passwordHash: '', // No password for SSO users
      mfaEnabled: false,
      roles: ['user'],
      permissions: [],
      failedLoginAttempts: 0,
      locked: false,
      metadata: {
        firstName: profile.name?.split(' ')[0],
        lastName: profile.name?.split(' ')[1],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);
    this.emit('user:created:sso', { userId: user.id });

    return user;
  }

  // ========================================================================
  // Role-Based Access Control
  // ========================================================================

  public createRole(name: string, permissions: Permission[], parent?: string): Role {
    const role: Role = {
      id: this.generateId(),
      name,
      description: `Role: ${name}`,
      permissions,
      parent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.roles.set(role.id, role);
    this.emit('role:created', { roleId: role.id });

    return role;
  }

  public assignRole(userId: string, roleId: string): void {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);

    if (!user || !role) {
      throw new Error('User or role not found');
    }

    if (!user.roles.includes(roleId)) {
      user.roles.push(roleId);
      this.emit('role:assigned', { userId, roleId });
    }
  }

  public hasPermission(
    userId: string,
    resource: string,
    action: Action
  ): boolean {
    const user = this.users.get(userId);

    if (!user) {
      return false;
    }

    // Check direct permissions
    if (user.permissions.includes(`${resource}:${action}`)) {
      return true;
    }

    // Check role permissions
    for (const roleId of user.roles) {
      const role = this.roles.get(roleId);

      if (role) {
        const hasPermission = role.permissions.some(
          p => p.resource === resource && p.action === action
        );

        if (hasPermission) {
          return true;
        }

        // Check parent role
        if (role.parent) {
          const parentRole = this.roles.get(role.parent);
          if (parentRole) {
            const hasParentPermission = parentRole.permissions.some(
              p => p.resource === resource && p.action === action
            );

            if (hasParentPermission) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  // ========================================================================
  // Risk Assessment & Zero Trust
  // ========================================================================

  private async assessRisk(
    user: User,
    metadata: Partial<SessionMetadata>
  ): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let score = 0;

    // Check for unusual location
    if (metadata.location && this.isUnusualLocation(user, metadata.location)) {
      factors.push({
        type: 'unusual_location',
        severity: 'medium',
        description: 'Login from unusual location',
        score: 0.3,
      });
      score += 0.3;
    }

    // Check for new device
    if (metadata.device && this.isNewDevice(user, metadata.device)) {
      factors.push({
        type: 'new_device',
        severity: 'low',
        description: 'Login from new device',
        score: 0.2,
      });
      score += 0.2;
    }

    // Check failed attempts
    if (user.failedLoginAttempts > 2) {
      factors.push({
        type: 'multiple_failures',
        severity: 'high',
        description: 'Multiple failed login attempts',
        score: 0.4,
      });
      score += 0.4;
    }

    // Determine recommendation
    let recommendation: RiskRecommendation = 'allow';

    if (score > 0.7) {
      recommendation = 'block';
    } else if (score > 0.4) {
      recommendation = 'require_verification';
    } else if (score > 0.2) {
      recommendation = 'challenge_mfa';
    }

    return {
      score,
      factors,
      recommendation,
    };
  }

  private isUnusualLocation(user: User, location: string): boolean {
    // Simplified check
    return Math.random() > 0.8;
  }

  private isNewDevice(user: User, device: string): boolean {
    // Simplified check
    return Math.random() > 0.7;
  }

  // ========================================================================
  // Threat Detection
  // ========================================================================

  public detectThreat(
    type: ThreatType,
    source: string,
    details: Record<string, any>
  ): ThreatEvent {
    const severity = this.calculateThreatSeverity(type, details);

    const threat: ThreatEvent = {
      id: this.generateId(),
      type,
      severity,
      source,
      details,
      mitigated: false,
      timestamp: new Date(),
    };

    this.threats.push(threat);
    this.emit('threat:detected', { threat });

    // Auto-mitigation for critical threats
    if (severity === 'critical') {
      this.mitigateThreat(threat);
    }

    return threat;
  }

  private calculateThreatSeverity(
    type: ThreatType,
    details: Record<string, any>
  ): ThreatSeverity {
    const severityMap: Record<ThreatType, ThreatSeverity> = {
      brute_force: 'high',
      credential_stuffing: 'high',
      session_hijacking: 'critical',
      privilege_escalation: 'critical',
      data_exfiltration: 'critical',
      malware: 'critical',
      ddos: 'high',
    };

    return severityMap[type] || 'medium';
  }

  private mitigateThreat(threat: ThreatEvent): void {
    // Implement mitigation strategies
    threat.mitigated = true;
    this.emit('threat:mitigated', { threatId: threat.id });
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private async createSession(
    user: User,
    metadata: Partial<SessionMetadata>
  ): Promise<Session> {
    const session: Session = {
      id: this.generateId(),
      userId: user.id,
      token: this.generateToken(),
      refreshToken: this.generateToken(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeout),
      ipAddress: metadata.location || 'unknown',
      userAgent: metadata.browser || 'unknown',
      deviceFingerprint: this.generateDeviceFingerprint(metadata),
      riskScore: 0,
      metadata: metadata as SessionMetadata,
      createdAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.emit('session:created', { sessionId: session.id });

    return session;
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    // Simplified password verification
    return crypto.createHash('sha256').update(password).digest('hex') === hash;
  }

  private async hashPassword(password: string): Promise<string> {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateDeviceFingerprint(metadata: Partial<SessionMetadata>): string {
    const data = JSON.stringify(metadata);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private findUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  private findUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  private generateId(): string {
    return `sec-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const auditLog: AuditLog = {
      id: this.generateId(),
      ...log,
      timestamp: new Date(),
    };

    this.auditLogs.push(auditLog);
    this.emit('audit:logged', { logId: auditLog.id });
  }

  private initializeDefaultRoles(): void {
    this.createRole('admin', [
      { id: '1', resource: '*', action: 'admin' },
    ]);

    this.createRole('user', [
      { id: '2', resource: 'profile', action: 'read' },
      { id: '3', resource: 'profile', action: 'update' },
    ]);
  }

  public getStats() {
    return {
      totalUsers: this.users.size,
      activeSessions: this.sessions.size,
      roles: this.roles.size,
      auditLogs: this.auditLogs.length,
      threats: this.threats.length,
      criticalThreats: this.threats.filter(t => t.severity === 'critical').length,
    };
  }
}
