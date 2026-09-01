"use strict";
/**
 * Backup and Recovery System
 * Comprehensive backup management, disaster recovery, and data restoration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.disasterRecoveryManager = exports.verificationManager = exports.restoreManager = exports.backupManager = exports.DisasterRecoveryManager = exports.VerificationManager = exports.RestoreManager = exports.BackupManager = exports.StepStatus = exports.DisasterRecoveryStatus = exports.RecoveryAction = exports.RecoveryPriority = exports.VerificationTest = exports.VerificationStatus = exports.RestoreStatus = exports.ErrorSeverity = exports.CompressionAlgorithm = exports.EncryptionAlgorithm = exports.ScheduleFrequency = exports.DestinationType = exports.DatabaseEngine = exports.SourceType = exports.BackupStatus = exports.BackupType = void 0;
const EventBus_1 = require("../core/EventBus");
var BackupType;
(function (BackupType) {
    BackupType["Full"] = "full";
    BackupType["Incremental"] = "incremental";
    BackupType["Differential"] = "differential";
    BackupType["Snapshot"] = "snapshot";
    BackupType["Mirror"] = "mirror";
})(BackupType || (exports.BackupType = BackupType = {}));
var BackupStatus;
(function (BackupStatus) {
    BackupStatus["Pending"] = "pending";
    BackupStatus["Running"] = "running";
    BackupStatus["Completed"] = "completed";
    BackupStatus["Failed"] = "failed";
    BackupStatus["Cancelled"] = "cancelled";
    BackupStatus["Paused"] = "paused";
})(BackupStatus || (exports.BackupStatus = BackupStatus = {}));
var SourceType;
(function (SourceType) {
    SourceType["FileSystem"] = "filesystem";
    SourceType["Database"] = "database";
    SourceType["Volume"] = "volume";
    SourceType["Application"] = "application";
})(SourceType || (exports.SourceType = SourceType = {}));
var DatabaseEngine;
(function (DatabaseEngine) {
    DatabaseEngine["PostgreSQL"] = "postgresql";
    DatabaseEngine["MySQL"] = "mysql";
    DatabaseEngine["MongoDB"] = "mongodb";
    DatabaseEngine["Redis"] = "redis";
    DatabaseEngine["Cassandra"] = "cassandra";
})(DatabaseEngine || (exports.DatabaseEngine = DatabaseEngine = {}));
var DestinationType;
(function (DestinationType) {
    DestinationType["Local"] = "local";
    DestinationType["S3"] = "s3";
    DestinationType["Azure"] = "azure";
    DestinationType["GCS"] = "gcs";
    DestinationType["NFS"] = "nfs";
    DestinationType["FTP"] = "ftp";
})(DestinationType || (exports.DestinationType = DestinationType = {}));
var ScheduleFrequency;
(function (ScheduleFrequency) {
    ScheduleFrequency["Once"] = "once";
    ScheduleFrequency["Hourly"] = "hourly";
    ScheduleFrequency["Daily"] = "daily";
    ScheduleFrequency["Weekly"] = "weekly";
    ScheduleFrequency["Monthly"] = "monthly";
    ScheduleFrequency["Custom"] = "custom";
})(ScheduleFrequency || (exports.ScheduleFrequency = ScheduleFrequency = {}));
var EncryptionAlgorithm;
(function (EncryptionAlgorithm) {
    EncryptionAlgorithm["AES256"] = "aes256";
    EncryptionAlgorithm["AES128"] = "aes128";
    EncryptionAlgorithm["RSA"] = "rsa";
})(EncryptionAlgorithm || (exports.EncryptionAlgorithm = EncryptionAlgorithm = {}));
var CompressionAlgorithm;
(function (CompressionAlgorithm) {
    CompressionAlgorithm["Gzip"] = "gzip";
    CompressionAlgorithm["Bzip2"] = "bzip2";
    CompressionAlgorithm["Zstd"] = "zstd";
    CompressionAlgorithm["LZ4"] = "lz4";
})(CompressionAlgorithm || (exports.CompressionAlgorithm = CompressionAlgorithm = {}));
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["Warning"] = "warning";
    ErrorSeverity["Error"] = "error";
    ErrorSeverity["Critical"] = "critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
var RestoreStatus;
(function (RestoreStatus) {
    RestoreStatus["Pending"] = "pending";
    RestoreStatus["Running"] = "running";
    RestoreStatus["Completed"] = "completed";
    RestoreStatus["Failed"] = "failed";
    RestoreStatus["PartiallyRestored"] = "partially_restored";
})(RestoreStatus || (exports.RestoreStatus = RestoreStatus = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["Pending"] = "pending";
    VerificationStatus["Running"] = "running";
    VerificationStatus["Passed"] = "passed";
    VerificationStatus["Failed"] = "failed";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
var VerificationTest;
(function (VerificationTest) {
    VerificationTest["ChecksumValidation"] = "checksum_validation";
    VerificationTest["FileIntegrity"] = "file_integrity";
    VerificationTest["DataConsistency"] = "data_consistency";
    VerificationTest["RestoreTest"] = "restore_test";
    VerificationTest["EncryptionValidation"] = "encryption_validation";
})(VerificationTest || (exports.VerificationTest = VerificationTest = {}));
var RecoveryPriority;
(function (RecoveryPriority) {
    RecoveryPriority["Critical"] = "critical";
    RecoveryPriority["High"] = "high";
    RecoveryPriority["Medium"] = "medium";
    RecoveryPriority["Low"] = "low";
})(RecoveryPriority || (exports.RecoveryPriority = RecoveryPriority = {}));
var RecoveryAction;
(function (RecoveryAction) {
    RecoveryAction["RestoreBackup"] = "restore_backup";
    RecoveryAction["StartService"] = "start_service";
    RecoveryAction["ExecuteScript"] = "execute_script";
    RecoveryAction["VerifyData"] = "verify_data";
    RecoveryAction["NotifyTeam"] = "notify_team";
})(RecoveryAction || (exports.RecoveryAction = RecoveryAction = {}));
var DisasterRecoveryStatus;
(function (DisasterRecoveryStatus) {
    DisasterRecoveryStatus["Initiated"] = "initiated";
    DisasterRecoveryStatus["InProgress"] = "in_progress";
    DisasterRecoveryStatus["Completed"] = "completed";
    DisasterRecoveryStatus["Failed"] = "failed";
    DisasterRecoveryStatus["RolledBack"] = "rolled_back";
})(DisasterRecoveryStatus || (exports.DisasterRecoveryStatus = DisasterRecoveryStatus = {}));
var StepStatus;
(function (StepStatus) {
    StepStatus["Pending"] = "pending";
    StepStatus["Running"] = "running";
    StepStatus["Completed"] = "completed";
    StepStatus["Failed"] = "failed";
    StepStatus["Skipped"] = "skipped";
})(StepStatus || (exports.StepStatus = StepStatus = {}));
/**
 * Backup Manager
 */
class BackupManager {
    backups = new Map();
    restorePoints = new Map();
    /**
     * Create backup
     */
    async createBackup(config) {
        const backup = {
            ...config,
            id: this.generateBackupId(),
            status: BackupStatus.Pending,
            metadata: {
                size: 0,
                fileCount: 0,
                duration: 0,
                checksum: '',
                tags: [],
            },
            createdAt: new Date(),
        };
        this.backups.set(backup.id, backup);
        EventBus_1.eventBus.emitSync('backup.created', backup, 'BackupManager');
        // Start backup execution
        await this.executeBackup(backup.id);
        return backup;
    }
    /**
     * Execute backup
     */
    async executeBackup(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }
        backup.status = BackupStatus.Running;
        const startTime = Date.now();
        EventBus_1.eventBus.emitSync('backup.started', backup, 'BackupManager');
        try {
            // Mock backup execution
            await new Promise(resolve => setTimeout(resolve, 200));
            // Simulate backup data
            const fileCount = Math.floor(Math.random() * 1000) + 100;
            const size = Math.floor(Math.random() * 1000000000) + 100000000; // 100MB - 1GB
            const compressedSize = backup.compression?.enabled
                ? Math.floor(size * (0.3 + Math.random() * 0.4))
                : undefined;
            backup.metadata = {
                size,
                compressedSize,
                fileCount,
                duration: Date.now() - startTime,
                checksum: this.generateChecksum(),
                tags: backup.metadata.tags,
            };
            backup.status = BackupStatus.Completed;
            backup.completedAt = new Date();
            // Create restore point
            const restorePoint = {
                id: this.generateRestorePointId(),
                backupId: backup.id,
                name: `${backup.name} - ${new Date().toISOString()}`,
                timestamp: new Date(),
                size: backup.metadata.size,
                verified: false,
                metadata: {},
                createdAt: new Date(),
            };
            this.restorePoints.set(restorePoint.id, restorePoint);
            EventBus_1.eventBus.emitSync('backup.completed', backup, 'BackupManager');
        }
        catch (error) {
            backup.status = BackupStatus.Failed;
            backup.metadata.errors = [{
                    timestamp: new Date(),
                    message: error instanceof Error ? error.message : 'Unknown error',
                    severity: ErrorSeverity.Critical,
                }];
            EventBus_1.eventBus.emitSync('backup.failed', backup, 'BackupManager');
        }
    }
    /**
     * Get backup
     */
    getBackup(backupId) {
        return this.backups.get(backupId);
    }
    /**
     * List backups
     */
    listBackups(filter) {
        let backups = Array.from(this.backups.values());
        if (filter?.status) {
            backups = backups.filter(b => b.status === filter.status);
        }
        if (filter?.type) {
            backups = backups.filter(b => b.type === filter.type);
        }
        return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Delete backup
     */
    async deleteBackup(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }
        // Delete associated restore points
        for (const [id, rp] of this.restorePoints.entries()) {
            if (rp.backupId === backupId) {
                this.restorePoints.delete(id);
            }
        }
        this.backups.delete(backupId);
        EventBus_1.eventBus.emitSync('backup.deleted', { backupId }, 'BackupManager');
    }
    /**
     * Get restore point
     */
    getRestorePoint(restorePointId) {
        return this.restorePoints.get(restorePointId);
    }
    /**
     * List restore points
     */
    listRestorePoints(backupId) {
        let points = Array.from(this.restorePoints.values());
        if (backupId) {
            points = points.filter(rp => rp.backupId === backupId);
        }
        return points.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Apply retention policy
     */
    async applyRetention(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }
        const retention = backup.retention;
        const relatedBackups = Array.from(this.backups.values())
            .filter(b => b.name === backup.name && b.status === BackupStatus.Completed)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const toDelete = [];
        // Apply keepLast
        if (retention.keepLast && relatedBackups.length > retention.keepLast) {
            const excess = relatedBackups.slice(retention.keepLast);
            toDelete.push(...excess.map(b => b.id));
        }
        // Apply maxAge
        if (retention.maxAge) {
            const cutoff = new Date(Date.now() - retention.maxAge);
            const old = relatedBackups.filter(b => b.createdAt < cutoff);
            toDelete.push(...old.map(b => b.id));
        }
        // Delete backups
        const uniqueToDelete = [...new Set(toDelete)];
        for (const id of uniqueToDelete) {
            await this.deleteBackup(id);
        }
        return uniqueToDelete.length;
    }
    generateBackupId() {
        return `backup_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateRestorePointId() {
        return `rp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateChecksum() {
        return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
}
exports.BackupManager = BackupManager;
/**
 * Restore Manager
 */
class RestoreManager {
    restoreJobs = new Map();
    backupManager;
    constructor(backupManager) {
        this.backupManager = backupManager;
    }
    /**
     * Create restore job
     */
    async restore(restorePointId, destination, options) {
        const restorePoint = this.backupManager.getRestorePoint(restorePointId);
        if (!restorePoint) {
            throw new Error(`Restore point not found: ${restorePointId}`);
        }
        const job = {
            id: this.generateJobId(),
            restorePointId,
            destination,
            status: RestoreStatus.Pending,
            options,
            progress: {
                filesRestored: 0,
                totalFiles: 100,
                bytesRestored: 0,
                totalBytes: restorePoint.size,
                errors: [],
            },
            startedAt: new Date(),
        };
        this.restoreJobs.set(job.id, job);
        EventBus_1.eventBus.emitSync('restore.created', job, 'RestoreManager');
        // Execute restore
        await this.executeRestore(job.id);
        return job;
    }
    /**
     * Execute restore
     */
    async executeRestore(jobId) {
        const job = this.restoreJobs.get(jobId);
        if (!job) {
            return;
        }
        job.status = RestoreStatus.Running;
        EventBus_1.eventBus.emitSync('restore.started', job, 'RestoreManager');
        try {
            // Mock restore execution
            await new Promise(resolve => setTimeout(resolve, 200));
            job.progress.filesRestored = job.progress.totalFiles;
            job.progress.bytesRestored = job.progress.totalBytes;
            job.status = RestoreStatus.Completed;
            job.completedAt = new Date();
            EventBus_1.eventBus.emitSync('restore.completed', job, 'RestoreManager');
        }
        catch (error) {
            job.status = RestoreStatus.Failed;
            job.progress.errors.push({
                timestamp: new Date(),
                message: error instanceof Error ? error.message : 'Unknown error',
                severity: ErrorSeverity.Critical,
            });
            EventBus_1.eventBus.emitSync('restore.failed', job, 'RestoreManager');
        }
    }
    /**
     * Get restore job
     */
    getRestoreJob(jobId) {
        return this.restoreJobs.get(jobId);
    }
    /**
     * List restore jobs
     */
    listRestoreJobs(filter) {
        let jobs = Array.from(this.restoreJobs.values());
        if (filter?.status) {
            jobs = jobs.filter(j => j.status === filter.status);
        }
        return jobs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }
}
exports.RestoreManager = RestoreManager;
/**
 * Verification Manager
 */
class VerificationManager {
    verifications = new Map();
    backupManager;
    constructor(backupManager) {
        this.backupManager = backupManager;
    }
    /**
     * Verify backup
     */
    async verify(backupId) {
        const backup = this.backupManager.getBackup(backupId);
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }
        const verification = {
            id: this.generateVerificationId(),
            backupId,
            status: VerificationStatus.Pending,
            results: [],
            startedAt: new Date(),
        };
        this.verifications.set(verification.id, verification);
        EventBus_1.eventBus.emitSync('backup.verification_started', verification, 'VerificationManager');
        // Execute verification tests
        await this.executeVerification(verification);
        return verification;
    }
    /**
     * Execute verification
     */
    async executeVerification(verification) {
        verification.status = VerificationStatus.Running;
        const tests = [
            VerificationTest.ChecksumValidation,
            VerificationTest.FileIntegrity,
            VerificationTest.DataConsistency,
        ];
        for (const test of tests) {
            // Mock test execution
            await new Promise(resolve => setTimeout(resolve, 50));
            const passed = Math.random() > 0.1; // 90% success rate
            verification.results.push({
                test,
                passed,
                message: passed ? 'Test passed' : 'Test failed',
                details: {},
            });
        }
        const allPassed = verification.results.every(r => r.passed);
        verification.status = allPassed ? VerificationStatus.Passed : VerificationStatus.Failed;
        verification.completedAt = new Date();
        EventBus_1.eventBus.emitSync('backup.verification_completed', verification, 'VerificationManager');
    }
    /**
     * Get verification
     */
    getVerification(verificationId) {
        return this.verifications.get(verificationId);
    }
    /**
     * List verifications
     */
    listVerifications(backupId) {
        let verifications = Array.from(this.verifications.values());
        if (backupId) {
            verifications = verifications.filter(v => v.backupId === backupId);
        }
        return verifications.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }
    generateVerificationId() {
        return `verify_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.VerificationManager = VerificationManager;
/**
 * Disaster Recovery Manager
 */
class DisasterRecoveryManager {
    plans = new Map();
    recoveries = new Map();
    backupManager;
    restoreManager;
    constructor(backupManager, restoreManager) {
        this.backupManager = backupManager;
        this.restoreManager = restoreManager;
    }
    /**
     * Create recovery plan
     */
    createPlan(plan) {
        const fullPlan = {
            ...plan,
            id: this.generatePlanId(),
            createdAt: new Date(),
        };
        this.plans.set(fullPlan.id, fullPlan);
        EventBus_1.eventBus.emitSync('disaster_recovery.plan_created', fullPlan, 'DisasterRecoveryManager');
        return fullPlan;
    }
    /**
     * Execute recovery plan
     */
    async executeRecovery(planId) {
        const plan = this.plans.get(planId);
        if (!plan) {
            throw new Error(`Recovery plan not found: ${planId}`);
        }
        const recovery = {
            id: this.generateRecoveryId(),
            planId,
            status: DisasterRecoveryStatus.Initiated,
            startedAt: new Date(),
            steps: [],
            metrics: {
                actualRTO: 0,
                actualRPO: 0,
                dataLoss: 0,
                downtime: 0,
            },
        };
        this.recoveries.set(recovery.id, recovery);
        EventBus_1.eventBus.emitSync('disaster_recovery.started', recovery, 'DisasterRecoveryManager');
        recovery.status = DisasterRecoveryStatus.InProgress;
        // Execute steps in order
        const sortedSteps = [...plan.steps].sort((a, b) => a.order - b.order);
        for (const step of sortedSteps) {
            const stepResult = await this.executeStep(step, plan);
            recovery.steps.push(stepResult);
            if (stepResult.status === StepStatus.Failed) {
                recovery.status = DisasterRecoveryStatus.Failed;
                break;
            }
        }
        if (recovery.status !== DisasterRecoveryStatus.Failed) {
            recovery.status = DisasterRecoveryStatus.Completed;
        }
        recovery.completedAt = new Date();
        recovery.metrics.actualRTO = recovery.completedAt.getTime() - recovery.startedAt.getTime();
        EventBus_1.eventBus.emitSync('disaster_recovery.completed', recovery, 'DisasterRecoveryManager');
        return recovery;
    }
    /**
     * Execute recovery step
     */
    async executeStep(step, plan) {
        const result = {
            step,
            status: StepStatus.Running,
            startedAt: new Date(),
        };
        try {
            // Mock step execution
            await new Promise(resolve => setTimeout(resolve, 100));
            result.status = StepStatus.Completed;
            result.completedAt = new Date();
        }
        catch (error) {
            result.status = StepStatus.Failed;
            result.error = error instanceof Error ? error.message : 'Unknown error';
            result.completedAt = new Date();
        }
        return result;
    }
    /**
     * Get plan
     */
    getPlan(planId) {
        return this.plans.get(planId);
    }
    /**
     * List plans
     */
    listPlans(filter) {
        let plans = Array.from(this.plans.values());
        if (filter?.priority) {
            plans = plans.filter(p => p.priority === filter.priority);
        }
        return plans;
    }
    /**
     * Get recovery
     */
    getRecovery(recoveryId) {
        return this.recoveries.get(recoveryId);
    }
    /**
     * List recoveries
     */
    listRecoveries(planId) {
        let recoveries = Array.from(this.recoveries.values());
        if (planId) {
            recoveries = recoveries.filter(r => r.planId === planId);
        }
        return recoveries.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }
    generatePlanId() {
        return `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateRecoveryId() {
        return `recovery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DisasterRecoveryManager = DisasterRecoveryManager;
/**
 * Singleton instances
 */
exports.backupManager = new BackupManager();
exports.restoreManager = new RestoreManager(exports.backupManager);
exports.verificationManager = new VerificationManager(exports.backupManager);
exports.disasterRecoveryManager = new DisasterRecoveryManager(exports.backupManager, exports.restoreManager);
