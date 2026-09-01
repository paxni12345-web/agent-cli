/**
 * Backup and Recovery System
 * Comprehensive backup management, disaster recovery, and data restoration
 */
export interface Backup {
    id: string;
    name: string;
    type: BackupType;
    status: BackupStatus;
    source: BackupSource;
    destination: BackupDestination;
    schedule?: BackupSchedule;
    retention: RetentionConfig;
    encryption?: EncryptionConfig;
    compression?: CompressionConfig;
    metadata: BackupMetadata;
    createdAt: Date;
    completedAt?: Date;
    nextRun?: Date;
}
export declare enum BackupType {
    Full = "full",
    Incremental = "incremental",
    Differential = "differential",
    Snapshot = "snapshot",
    Mirror = "mirror"
}
export declare enum BackupStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled",
    Paused = "paused"
}
export interface BackupSource {
    type: SourceType;
    path?: string;
    database?: DatabaseConfig;
    volume?: VolumeConfig;
    excludePatterns?: string[];
    includePatterns?: string[];
}
export declare enum SourceType {
    FileSystem = "filesystem",
    Database = "database",
    Volume = "volume",
    Application = "application"
}
export interface DatabaseConfig {
    engine: DatabaseEngine;
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
}
export declare enum DatabaseEngine {
    PostgreSQL = "postgresql",
    MySQL = "mysql",
    MongoDB = "mongodb",
    Redis = "redis",
    Cassandra = "cassandra"
}
export interface VolumeConfig {
    id: string;
    mountPoint: string;
    size: number;
}
export interface BackupDestination {
    type: DestinationType;
    path?: string;
    bucket?: string;
    region?: string;
    credentials?: Record<string, string>;
}
export declare enum DestinationType {
    Local = "local",
    S3 = "s3",
    Azure = "azure",
    GCS = "gcs",
    NFS = "nfs",
    FTP = "ftp"
}
export interface BackupSchedule {
    frequency: ScheduleFrequency;
    interval?: number;
    time?: string;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    enabled: boolean;
}
export declare enum ScheduleFrequency {
    Once = "once",
    Hourly = "hourly",
    Daily = "daily",
    Weekly = "weekly",
    Monthly = "monthly",
    Custom = "custom"
}
export interface RetentionConfig {
    keepLast?: number;
    keepDaily?: number;
    keepWeekly?: number;
    keepMonthly?: number;
    keepYearly?: number;
    maxAge?: number;
}
export interface EncryptionConfig {
    algorithm: EncryptionAlgorithm;
    keyId: string;
    enabled: boolean;
}
export declare enum EncryptionAlgorithm {
    AES256 = "aes256",
    AES128 = "aes128",
    RSA = "rsa"
}
export interface CompressionConfig {
    algorithm: CompressionAlgorithm;
    level: number;
    enabled: boolean;
}
export declare enum CompressionAlgorithm {
    Gzip = "gzip",
    Bzip2 = "bzip2",
    Zstd = "zstd",
    LZ4 = "lz4"
}
export interface BackupMetadata {
    size: number;
    compressedSize?: number;
    fileCount: number;
    duration: number;
    checksum: string;
    tags: string[];
    errors?: BackupError[];
}
export interface BackupError {
    timestamp: Date;
    message: string;
    severity: ErrorSeverity;
    path?: string;
}
export declare enum ErrorSeverity {
    Warning = "warning",
    Error = "error",
    Critical = "critical"
}
export interface RestorePoint {
    id: string;
    backupId: string;
    name: string;
    timestamp: Date;
    size: number;
    verified: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
}
export interface RestoreJob {
    id: string;
    restorePointId: string;
    destination: string;
    status: RestoreStatus;
    options: RestoreOptions;
    progress: RestoreProgress;
    startedAt: Date;
    completedAt?: Date;
}
export declare enum RestoreStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    PartiallyRestored = "partially_restored"
}
export interface RestoreOptions {
    overwrite: boolean;
    preservePermissions: boolean;
    preserveTimestamps: boolean;
    verifyChecksum: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
}
export interface RestoreProgress {
    filesRestored: number;
    totalFiles: number;
    bytesRestored: number;
    totalBytes: number;
    currentFile?: string;
    errors: BackupError[];
}
export interface BackupVerification {
    id: string;
    backupId: string;
    status: VerificationStatus;
    results: VerificationResult[];
    startedAt: Date;
    completedAt?: Date;
}
export declare enum VerificationStatus {
    Pending = "pending",
    Running = "running",
    Passed = "passed",
    Failed = "failed"
}
export interface VerificationResult {
    test: VerificationTest;
    passed: boolean;
    message: string;
    details?: Record<string, any>;
}
export declare enum VerificationTest {
    ChecksumValidation = "checksum_validation",
    FileIntegrity = "file_integrity",
    DataConsistency = "data_consistency",
    RestoreTest = "restore_test",
    EncryptionValidation = "encryption_validation"
}
export interface BackupReport {
    id: string;
    period: {
        start: Date;
        end: Date;
    };
    summary: BackupSummary;
    backups: Backup[];
    failures: Backup[];
    recommendations: string[];
    generatedAt: Date;
}
export interface BackupSummary {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    totalSize: number;
    totalDuration: number;
    averageSize: number;
    averageDuration: number;
    successRate: number;
}
export interface RecoveryPlan {
    id: string;
    name: string;
    description: string;
    priority: RecoveryPriority;
    rto: number;
    rpo: number;
    steps: RecoveryStep[];
    backupIds: string[];
    enabled: boolean;
    createdAt: Date;
}
export declare enum RecoveryPriority {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low"
}
export interface RecoveryStep {
    order: number;
    name: string;
    action: RecoveryAction;
    config: Record<string, any>;
    dependencies?: number[];
}
export declare enum RecoveryAction {
    RestoreBackup = "restore_backup",
    StartService = "start_service",
    ExecuteScript = "execute_script",
    VerifyData = "verify_data",
    NotifyTeam = "notify_team"
}
export interface DisasterRecovery {
    id: string;
    planId: string;
    status: DisasterRecoveryStatus;
    startedAt: Date;
    completedAt?: Date;
    steps: DisasterRecoveryStepResult[];
    metrics: RecoveryMetrics;
}
export declare enum DisasterRecoveryStatus {
    Initiated = "initiated",
    InProgress = "in_progress",
    Completed = "completed",
    Failed = "failed",
    RolledBack = "rolled_back"
}
export interface DisasterRecoveryStepResult {
    step: RecoveryStep;
    status: StepStatus;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}
export declare enum StepStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Skipped = "skipped"
}
export interface RecoveryMetrics {
    actualRTO: number;
    actualRPO: number;
    dataLoss: number;
    downtime: number;
}
/**
 * Backup Manager
 */
export declare class BackupManager {
    private backups;
    private restorePoints;
    /**
     * Create backup
     */
    createBackup(config: Omit<Backup, 'id' | 'status' | 'metadata' | 'createdAt'>): Promise<Backup>;
    /**
     * Execute backup
     */
    executeBackup(backupId: string): Promise<void>;
    /**
     * Get backup
     */
    getBackup(backupId: string): Backup | undefined;
    /**
     * List backups
     */
    listBackups(filter?: {
        status?: BackupStatus;
        type?: BackupType;
    }): Backup[];
    /**
     * Delete backup
     */
    deleteBackup(backupId: string): Promise<void>;
    /**
     * Get restore point
     */
    getRestorePoint(restorePointId: string): RestorePoint | undefined;
    /**
     * List restore points
     */
    listRestorePoints(backupId?: string): RestorePoint[];
    /**
     * Apply retention policy
     */
    applyRetention(backupId: string): Promise<number>;
    private generateBackupId;
    private generateRestorePointId;
    private generateChecksum;
}
/**
 * Restore Manager
 */
export declare class RestoreManager {
    private restoreJobs;
    private backupManager;
    constructor(backupManager: BackupManager);
    /**
     * Create restore job
     */
    restore(restorePointId: string, destination: string, options: RestoreOptions): Promise<RestoreJob>;
    /**
     * Execute restore
     */
    private executeRestore;
    /**
     * Get restore job
     */
    getRestoreJob(jobId: string): RestoreJob | undefined;
    /**
     * List restore jobs
     */
    listRestoreJobs(filter?: {
        status?: RestoreStatus;
    }): RestoreJob[];
}
/**
 * Verification Manager
 */
export declare class VerificationManager {
    private verifications;
    private backupManager;
    constructor(backupManager: BackupManager);
    /**
     * Verify backup
     */
    verify(backupId: string): Promise<BackupVerification>;
    /**
     * Execute verification
     */
    private executeVerification;
    /**
     * Get verification
     */
    getVerification(verificationId: string): BackupVerification | undefined;
    /**
     * List verifications
     */
    listVerifications(backupId?: string): BackupVerification[];
    private generateVerificationId;
}
/**
 * Disaster Recovery Manager
 */
export declare class DisasterRecoveryManager {
    private plans;
    private recoveries;
    private backupManager;
    private restoreManager;
    constructor(backupManager: BackupManager, restoreManager: RestoreManager);
    /**
     * Create recovery plan
     */
    createPlan(plan: Omit<RecoveryPlan, 'id' | 'createdAt'>): RecoveryPlan;
    /**
     * Execute recovery plan
     */
    executeRecovery(planId: string): Promise<DisasterRecovery>;
    /**
     * Execute recovery step
     */
    private executeStep;
    /**
     * Get plan
     */
    getPlan(planId: string): RecoveryPlan | undefined;
    /**
     * List plans
     */
    listPlans(filter?: {
        priority?: RecoveryPriority;
    }): RecoveryPlan[];
    /**
     * Get recovery
     */
    getRecovery(recoveryId: string): DisasterRecovery | undefined;
    /**
     * List recoveries
     */
    listRecoveries(planId?: string): DisasterRecovery[];
    private generatePlanId;
    private generateRecoveryId;
}
/**
 * Singleton instances
 */
export declare const backupManager: BackupManager;
export declare const restoreManager: RestoreManager;
export declare const verificationManager: VerificationManager;
export declare const disasterRecoveryManager: DisasterRecoveryManager;
//# sourceMappingURL=BackupSystem.d.ts.map