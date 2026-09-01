/**
 * Advanced Security System
 * Security scanning, vulnerability detection, encryption, authentication, and authorization
 */
export interface SecurityPolicy {
    id: string;
    name: string;
    description: string;
    rules: SecurityRule[];
    enforcement: EnforcementLevel;
    exceptions: SecurityException[];
    createdAt: Date;
    updatedAt: Date;
}
export interface SecurityRule {
    id: string;
    type: SecurityRuleType;
    severity: Severity;
    condition: RuleCondition;
    action: SecurityAction;
    enabled: boolean;
}
export declare enum SecurityRuleType {
    Authentication = "authentication",
    Authorization = "authorization",
    Encryption = "encryption",
    InputValidation = "input_validation",
    OutputEncoding = "output_encoding",
    RateLimiting = "rate_limiting",
    AccessControl = "access_control",
    DataProtection = "data_protection"
}
export declare enum Severity {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low",
    Info = "info"
}
export interface RuleCondition {
    type: 'pattern' | 'expression' | 'custom';
    value: string | ((context: SecurityContext) => boolean);
}
export interface SecurityAction {
    type: 'block' | 'warn' | 'log' | 'alert';
    message: string;
    notify?: string[];
}
export interface SecurityException {
    ruleId: string;
    reason: string;
    expiresAt?: Date;
    approvedBy: string;
}
export declare enum EnforcementLevel {
    Strict = "strict",
    Standard = "standard",
    Permissive = "permissive"
}
export interface SecurityContext {
    userId?: string;
    sessionId?: string;
    ip: string;
    userAgent?: string;
    timestamp: Date;
    resource?: string;
    action?: string;
    metadata: Record<string, any>;
}
export interface VulnerabilityScan {
    id: string;
    target: ScanTarget;
    type: ScanType;
    status: ScanStatus;
    findings: SecurityFinding[];
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
}
export interface ScanTarget {
    type: 'code' | 'dependency' | 'configuration' | 'network' | 'container';
    path?: string;
    url?: string;
    identifier?: string;
}
export declare enum ScanType {
    Static = "static",
    Dynamic = "dynamic",
    Dependency = "dependency",
    Container = "container",
    Compliance = "compliance"
}
export declare enum ScanStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed"
}
export interface SecurityFinding {
    id: string;
    type: VulnerabilityType;
    severity: Severity;
    title: string;
    description: string;
    location: FindingLocation;
    cwe?: string;
    cve?: string;
    cvss?: number;
    recommendation: string;
    status: FindingStatus;
    falsePositive: boolean;
}
export declare enum VulnerabilityType {
    SQLInjection = "sql_injection",
    XSS = "xss",
    CSRF = "csrf",
    CommandInjection = "command_injection",
    PathTraversal = "path_traversal",
    InsecureDeserialization = "insecure_deserialization",
    BrokenAuthentication = "broken_authentication",
    SensitiveDataExposure = "sensitive_data_exposure",
    XXE = "xxe",
    BrokenAccessControl = "broken_access_control",
    SecurityMisconfiguration = "security_misconfiguration",
    OutdatedDependency = "outdated_dependency",
    WeakCryptography = "weak_cryptography",
    InsufficientLogging = "insufficient_logging"
}
export interface FindingLocation {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
    code?: string;
}
export declare enum FindingStatus {
    Open = "open",
    InProgress = "in_progress",
    Resolved = "resolved",
    Accepted = "accepted",
    FalsePositive = "false_positive"
}
export interface EncryptionConfig {
    algorithm: EncryptionAlgorithm;
    keySize: number;
    mode?: string;
    padding?: string;
}
export declare enum EncryptionAlgorithm {
    AES = "aes",
    RSA = "rsa",
    ChaCha20 = "chacha20",
    Blowfish = "blowfish"
}
export interface AuthenticationProvider {
    name: string;
    type: AuthenticationType;
    config: AuthenticationConfig;
    enabled: boolean;
}
export declare enum AuthenticationType {
    Local = "local",
    OAuth = "oauth",
    SAML = "saml",
    LDAP = "ldap",
    JWT = "jwt",
    APIKey = "api_key"
}
export interface AuthenticationConfig {
    [key: string]: any;
}
export interface User {
    id: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
    metadata: Record<string, any>;
    createdAt: Date;
    lastLogin?: Date;
}
export interface Session {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    metadata: Record<string, any>;
}
export interface AuditLog {
    id: string;
    userId?: string;
    action: string;
    resource?: string;
    result: 'success' | 'failure';
    ip: string;
    userAgent?: string;
    timestamp: Date;
    metadata: Record<string, any>;
}
/**
 * Security Manager
 */
export declare class SecurityManager {
    private policies;
    private scans;
    private auditLogs;
    /**
     * Create security policy
     */
    createPolicy(policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>): SecurityPolicy;
    /**
     * Evaluate security context against policies
     */
    evaluateContext(context: SecurityContext): Promise<SecurityEvaluation>;
    /**
     * Start vulnerability scan
     */
    startScan(target: ScanTarget, type: ScanType): Promise<VulnerabilityScan>;
    /**
     * Get scan results
     */
    getScan(scanId: string): VulnerabilityScan | undefined;
    /**
     * List scans
     */
    listScans(filter?: {
        status?: ScanStatus;
        type?: ScanType;
    }): VulnerabilityScan[];
    /**
     * Get security findings
     */
    getFindings(filter?: {
        severity?: Severity;
        status?: FindingStatus;
    }): SecurityFinding[];
    /**
     * Log audit event
     */
    audit(log: Omit<AuditLog, 'id' | 'timestamp'>): void;
    /**
     * Get audit logs
     */
    getAuditLogs(filter?: {
        userId?: string;
        action?: string;
        startDate?: Date;
        endDate?: Date;
    }): AuditLog[];
    private evaluateRule;
    private executeAction;
    private executeScan;
    private generateMockFindings;
    private generatePolicyId;
    private generateScanId;
    private generateAuditId;
}
export interface SecurityEvaluation {
    allowed: boolean;
    violations: SecurityViolation[];
    timestamp: Date;
}
export interface SecurityViolation {
    policyId: string;
    ruleId: string;
    severity: Severity;
    message: string;
    timestamp: Date;
}
/**
 * Encryption Service
 */
export declare class EncryptionService {
    /**
     * Encrypt data
     */
    encrypt(data: string, key: string, config: EncryptionConfig): string;
    /**
     * Decrypt data
     */
    decrypt(encrypted: string, key: string, config: EncryptionConfig): string;
    /**
     * Hash data
     */
    hash(data: string, algorithm?: 'sha256' | 'sha512' | 'md5'): string;
    /**
     * Generate HMAC
     */
    hmac(data: string, key: string, algorithm?: 'sha256' | 'sha512'): string;
    /**
     * Generate random key
     */
    generateKey(size?: number): string;
    private getAlgorithm;
    private deriveKey;
    private generateIV;
}
/**
 * Authentication Manager
 */
export declare class AuthenticationManager {
    private providers;
    private users;
    private sessions;
    /**
     * Register authentication provider
     */
    registerProvider(provider: AuthenticationProvider): void;
    /**
     * Authenticate user
     */
    authenticate(providerName: string, credentials: Record<string, any>): Promise<AuthenticationResult>;
    /**
     * Validate session
     */
    validateSession(token: string): Session | null;
    /**
     * Revoke session
     */
    revokeSession(sessionId: string): void;
    /**
     * Create user
     */
    createUser(userData: Omit<User, 'id' | 'createdAt'>): User;
    /**
     * Get user
     */
    getUser(userId: string): User | undefined;
    private findUser;
    private createSession;
    private generateUserId;
    private generateSessionId;
    private generateToken;
}
export interface AuthenticationResult {
    success: boolean;
    user?: User;
    session?: Session;
    error?: string;
}
/**
 * Authorization Manager
 */
export declare class AuthorizationManager {
    private permissions;
    private rolePermissions;
    /**
     * Define permission
     */
    definePermission(permission: Permission): void;
    /**
     * Assign permission to role
     */
    assignPermissionToRole(roleId: string, permissionId: string): void;
    /**
     * Check authorization
     */
    authorize(user: User, resource: string, action: string): boolean;
    /**
     * Get user permissions
     */
    getUserPermissions(user: User): Permission[];
}
export interface Permission {
    id: string;
    resource: string;
    action: string;
    description: string;
}
/**
 * Singleton instances
 */
export declare const securityManager: SecurityManager;
export declare const encryptionService: EncryptionService;
export declare const authenticationManager: AuthenticationManager;
export declare const authorizationManager: AuthorizationManager;
//# sourceMappingURL=SecuritySystem.d.ts.map