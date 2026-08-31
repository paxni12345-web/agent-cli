/**
 * Security System
 * Authentication, authorization, encryption, and security scanning
 */

import * as crypto from 'crypto';
import { eventBus } from '../core/EventBus';

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
  sessionTimeout: number; // minutes
  maxFailedLoginAttempts: number;
  lockoutDuration: number; // minutes
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
export class AuthenticationManager {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private failedAttempts: Map<string, number> = new Map();
  private lockouts: Map<string, Date> = new Map();
  private policy: SecurityPolicy = {
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
  async register(
    username: string,
    email: string,
    password: string,
    roles: string[] = ['user']
  ): Promise<User> {
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

    const user: User = {
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

    eventBus.emitSync('auth.user_registered', { userId: user.id, username }, 'AuthenticationManager');

    return user;
  }

  /**
   * Login user
   */
  async login(username: string, password: string, mfaToken?: string): Promise<Session> {
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

    eventBus.emitSync('auth.user_logged_in', { userId: user.id, username }, 'AuthenticationManager');

    return session;
  }

  /**
   * Logout user
   */
  logout(sessionToken: string): void {
    this.sessions.delete(sessionToken);
    eventBus.emitSync('auth.user_logged_out', { sessionToken }, 'AuthenticationManager');
  }

  /**
   * Verify session
   */
  verifySession(sessionToken: string): Session | null {
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
  async createApiKey(
    userId: string,
    name: string,
    permissions: string[],
    expiresInDays?: number
  ): Promise<ApiKey> {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const key = this.generateApiKey();
    const keyHash = await this.hashPassword(key);

    const apiKey: ApiKey = {
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

    eventBus.emitSync('auth.api_key_created', { userId, keyId: apiKey.id }, 'AuthenticationManager');

    return apiKey;
  }

  /**
   * Verify API key
   */
  async verifyApiKey(key: string): Promise<{ user: User; apiKey: ApiKey } | null> {
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
  enableMFA(userId: string): string {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const secret = this.generateMFASecret();
    user.mfaSecret = secret;
    user.mfaEnabled = true;

    eventBus.emitSync('auth.mfa_enabled', { userId }, 'AuthenticationManager');

    return secret;
  }

  /**
   * Disable MFA for user
   */
  disableMFA(userId: string): void {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error('User not found');
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;

    eventBus.emitSync('auth.mfa_disabled', { userId }, 'AuthenticationManager');
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Update security policy
   */
  setPolicy(policy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  private findUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  private findUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  private validatePassword(password: string): boolean {
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

  private async hashPassword(password: string): Promise<string> {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  private isLockedOut(username: string): boolean {
    const lockoutUntil = this.lockouts.get(username);
    if (!lockoutUntil) return false;

    if (new Date() > lockoutUntil) {
      this.lockouts.delete(username);
      this.failedAttempts.delete(username);
      return false;
    }

    return true;
  }

  private recordFailedAttempt(username: string): void {
    const attempts = (this.failedAttempts.get(username) || 0) + 1;
    this.failedAttempts.set(username, attempts);

    if (attempts >= this.policy.maxFailedLoginAttempts) {
      const lockoutUntil = new Date(Date.now() + this.policy.lockoutDuration * 60 * 1000);
      this.lockouts.set(username, lockoutUntil);

      eventBus.emitSync('auth.account_locked', { username, lockoutUntil }, 'AuthenticationManager');
    }
  }

  private createSession(userId: string): Session {
    const session: Session = {
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

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateApiKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateMFASecret(): string {
    return crypto.randomBytes(20).toString('base32');
  }

  private verifyMFAToken(user: User, token: string): boolean {
    // Mock MFA verification (in production, use TOTP library)
    return token.length === 6 && /^\d+$/.test(token);
  }
}

/**
 * Authorization Manager
 */
export class AuthorizationManager {
  private roles: Map<string, Role> = new Map();

  /**
   * Create role
   */
  createRole(name: string, description: string, permissions: string[]): Role {
    const role: Role = {
      id: this.generateRoleId(),
      name,
      description,
      permissions,
    };

    this.roles.set(role.id, role);

    eventBus.emitSync('authz.role_created', role, 'AuthorizationManager');

    return role;
  }

  /**
   * Check if user has permission
   */
  hasPermission(user: User, resource: string, action: string): boolean {
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
  private checkPermissions(permissions: string[], resource: string, action: string): boolean {
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
  private findRoleByName(name: string): Role | undefined {
    return Array.from(this.roles.values()).find(r => r.name === name);
  }

  /**
   * Create default roles
   */
  static createDefaultRoles(): Role[] {
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

  private generateRoleId(): string {
    return `role_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Encryption Manager
 */
export class EncryptionManager {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;

  /**
   * Generate encryption key
   */
  generateKey(): Buffer {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Encrypt data
   */
  encrypt(data: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = (cipher as any).getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypt data
   */
  decrypt(encrypted: string, key: Buffer, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );

    (decipher as any).setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash data
   */
  hash(data: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Generate HMAC
   */
  hmac(data: string, key: Buffer, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
  }

  /**
   * Generate random token
   */
  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

/**
 * Security Audit Logger
 */
export class SecurityAuditLogger {
  private logs: SecurityAuditLog[] = [];
  private maxLogs = 10000;

  /**
   * Log security event
   */
  log(
    action: string,
    resource: string,
    result: SecurityAuditLog['result'],
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    const log: SecurityAuditLog = {
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

    eventBus.emitSync('security.audit_logged', log, 'SecurityAuditLogger');
  }

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
  }): SecurityAuditLog[] {
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
      logs = logs.filter(l => l.timestamp >= filter.startDate!);
    }

    if (filter?.endDate) {
      logs = logs.filter(l => l.timestamp <= filter.endDate!);
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
  getStats(): {
    totalLogs: number;
    successCount: number;
    failureCount: number;
    deniedCount: number;
    topUsers: Array<{ userId: string; count: number }>;
    topActions: Array<{ action: string; count: number }>;
  } {
    const userCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();

    let successCount = 0;
    let failureCount = 0;
    let deniedCount = 0;

    for (const log of this.logs) {
      if (log.userId) {
        userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
      }

      actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);

      if (log.result === 'success') successCount++;
      else if (log.result === 'failure') failureCount++;
      else if (log.result === 'denied') deniedCount++;
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

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Security Scanner
 */
export class SecurityScanner {
  /**
   * Scan for common vulnerabilities
   */
  async scan(target: string): Promise<SecurityScanResult> {
    const vulnerabilities: SecurityVulnerability[] = [];

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

  private scanWeakPasswords(): SecurityVulnerability[] {
    // Mock implementation
    return [];
  }

  private async scanExposedSecrets(target: string): Promise<SecurityVulnerability[]> {
    // Mock implementation
    return [];
  }

  private async scanDependencies(target: string): Promise<SecurityVulnerability[]> {
    // Mock implementation
    return [];
  }
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
export const authenticationManager = new AuthenticationManager();
export const authorizationManager = new AuthorizationManager();
export const encryptionManager = new EncryptionManager();
export const securityAuditLogger = new SecurityAuditLogger();
export const securityScanner = new SecurityScanner();
