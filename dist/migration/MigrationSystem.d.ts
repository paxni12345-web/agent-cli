/**
 * Data Migration System
 * Schema versioning, data transformation, ETL pipelines, and rollback management
 */
export interface Migration {
    id: string;
    name: string;
    version: string;
    description: string;
    type: MigrationType;
    source: DataSource;
    target: DataSource;
    transformations: Transformation[];
    validations: Validation[];
    status: MigrationStatus;
    metadata: MigrationMetadata;
    createdAt: Date;
    executedAt?: Date;
    completedAt?: Date;
}
export declare enum MigrationType {
    SchemaChange = "schema_change",
    DataTransfer = "data_transfer",
    DataTransformation = "data_transformation",
    SystemUpgrade = "system_upgrade",
    DatabaseMigration = "database_migration"
}
export interface DataSource {
    type: SourceType;
    connection: ConnectionConfig;
    schema?: SchemaDefinition;
    query?: string;
}
export declare enum SourceType {
    PostgreSQL = "postgresql",
    MySQL = "mysql",
    MongoDB = "mongodb",
    Redis = "redis",
    Elasticsearch = "elasticsearch",
    CSV = "csv",
    JSON = "json",
    API = "api"
}
export interface ConnectionConfig {
    host: string;
    port: number;
    database?: string;
    username?: string;
    password?: string;
    options?: Record<string, any>;
}
export interface SchemaDefinition {
    tables: TableSchema[];
    indexes: IndexSchema[];
    constraints: ConstraintSchema[];
}
export interface TableSchema {
    name: string;
    columns: ColumnSchema[];
    primaryKey?: string[];
}
export interface ColumnSchema {
    name: string;
    type: ColumnType;
    nullable: boolean;
    defaultValue?: any;
    length?: number;
}
export declare enum ColumnType {
    String = "string",
    Integer = "integer",
    Float = "float",
    Boolean = "boolean",
    Date = "date",
    DateTime = "datetime",
    JSON = "json",
    Binary = "binary"
}
export interface IndexSchema {
    name: string;
    table: string;
    columns: string[];
    unique: boolean;
    type: IndexType;
}
export declare enum IndexType {
    BTree = "btree",
    Hash = "hash",
    GiST = "gist",
    GIN = "gin"
}
export interface ConstraintSchema {
    name: string;
    table: string;
    type: ConstraintType;
    columns: string[];
    reference?: ForeignKeyReference;
}
export declare enum ConstraintType {
    PrimaryKey = "primary_key",
    ForeignKey = "foreign_key",
    Unique = "unique",
    Check = "check"
}
export interface ForeignKeyReference {
    table: string;
    columns: string[];
    onDelete: ReferentialAction;
    onUpdate: ReferentialAction;
}
export declare enum ReferentialAction {
    Cascade = "cascade",
    SetNull = "set_null",
    SetDefault = "set_default",
    Restrict = "restrict",
    NoAction = "no_action"
}
export interface Transformation {
    id: string;
    name: string;
    type: TransformationType;
    config: TransformationConfig;
    order: number;
}
export declare enum TransformationType {
    Map = "map",
    Filter = "filter",
    Aggregate = "aggregate",
    Join = "join",
    Split = "split",
    Merge = "merge",
    Custom = "custom"
}
export interface TransformationConfig {
    expression?: string;
    mapping?: Record<string, string>;
    function?: string;
    parameters?: Record<string, any>;
}
export interface Validation {
    id: string;
    name: string;
    type: ValidationType;
    config: ValidationConfig;
    severity: ValidationSeverity;
}
export declare enum ValidationType {
    RowCount = "row_count",
    DataIntegrity = "data_integrity",
    SchemaMatch = "schema_match",
    ValueRange = "value_range",
    Custom = "custom"
}
export interface ValidationConfig {
    threshold?: number;
    field?: string;
    constraint?: string;
    query?: string;
}
export declare enum ValidationSeverity {
    Error = "error",
    Warning = "warning",
    Info = "info"
}
export declare enum MigrationStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    RolledBack = "rolled_back",
    PartiallyCompleted = "partially_completed"
}
export interface MigrationMetadata {
    owner: string;
    tags: string[];
    rollbackSupported: boolean;
    estimatedDuration?: number;
    dependencies: string[];
}
export interface MigrationExecution {
    id: string;
    migrationId: string;
    status: ExecutionStatus;
    progress: ExecutionProgress;
    results: ExecutionResult;
    errors: MigrationError[];
    startedAt: Date;
    completedAt?: Date;
}
export declare enum ExecutionStatus {
    Initializing = "initializing",
    Extracting = "extracting",
    Transforming = "transforming",
    Loading = "loading",
    Validating = "validating",
    Completed = "completed",
    Failed = "failed",
    RollingBack = "rolling_back"
}
export interface ExecutionProgress {
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
    recordsProcessed: number;
    totalRecords: number;
    percentage: number;
}
export interface ExecutionResult {
    recordsExtracted: number;
    recordsTransformed: number;
    recordsLoaded: number;
    recordsFailed: number;
    validationsPassed: number;
    validationsFailed: number;
    duration: number;
}
export interface MigrationError {
    timestamp: Date;
    step: string;
    record?: any;
    message: string;
    stackTrace?: string;
}
export interface Rollback {
    id: string;
    migrationId: string;
    executionId: string;
    strategy: RollbackStrategy;
    status: RollbackStatus;
    backupLocation?: string;
    steps: RollbackStep[];
    startedAt: Date;
    completedAt?: Date;
}
export declare enum RollbackStrategy {
    RestoreBackup = "restore_backup",
    ReverseTransformation = "reverse_transformation",
    DeleteNewData = "delete_new_data",
    Custom = "custom"
}
export declare enum RollbackStatus {
    Pending = "pending",
    InProgress = "in_progress",
    Completed = "completed",
    Failed = "failed"
}
export interface RollbackStep {
    order: number;
    action: string;
    status: StepStatus;
    executedAt?: Date;
    error?: string;
}
export declare enum StepStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed"
}
export interface ETLPipeline {
    id: string;
    name: string;
    description: string;
    stages: ETLStage[];
    schedule?: PipelineSchedule;
    enabled: boolean;
    lastRun?: Date;
    createdAt: Date;
}
export interface ETLStage {
    id: string;
    name: string;
    type: StageType;
    config: StageConfig;
    order: number;
    retryPolicy?: RetryPolicy;
}
export declare enum StageType {
    Extract = "extract",
    Transform = "transform",
    Load = "load",
    Validate = "validate"
}
export interface StageConfig {
    source?: DataSource;
    target?: DataSource;
    transformations?: Transformation[];
    validations?: Validation[];
    batchSize?: number;
    parallelism?: number;
}
export interface RetryPolicy {
    maxAttempts: number;
    backoffMs: number;
    backoffMultiplier: number;
}
export interface PipelineSchedule {
    type: ScheduleType;
    expression?: string;
    interval?: number;
    enabled: boolean;
}
export declare enum ScheduleType {
    Cron = "cron",
    Interval = "interval",
    Manual = "manual"
}
export interface DataMapper {
    id: string;
    name: string;
    sourceSchema: SchemaDefinition;
    targetSchema: SchemaDefinition;
    mappings: FieldMapping[];
    createdAt: Date;
}
export interface FieldMapping {
    sourceField: string;
    targetField: string;
    transformation?: Transformation;
    defaultValue?: any;
    required: boolean;
}
export interface SchemaVersion {
    id: string;
    version: string;
    schema: SchemaDefinition;
    changes: SchemaChange[];
    applied: boolean;
    appliedAt?: Date;
    createdAt: Date;
}
export interface SchemaChange {
    type: ChangeType;
    table?: string;
    column?: string;
    details: Record<string, any>;
}
export declare enum ChangeType {
    CreateTable = "create_table",
    DropTable = "drop_table",
    AlterTable = "alter_table",
    AddColumn = "add_column",
    DropColumn = "drop_column",
    ModifyColumn = "modify_column",
    CreateIndex = "create_index",
    DropIndex = "drop_index",
    AddConstraint = "add_constraint",
    DropConstraint = "drop_constraint"
}
export interface DataQualityReport {
    id: string;
    migrationId: string;
    metrics: QualityMetric[];
    issues: QualityIssue[];
    score: number;
    generatedAt: Date;
}
export interface QualityMetric {
    name: string;
    category: QualityCategory;
    value: number;
    threshold: number;
    passed: boolean;
}
export declare enum QualityCategory {
    Completeness = "completeness",
    Accuracy = "accuracy",
    Consistency = "consistency",
    Timeliness = "timeliness",
    Validity = "validity"
}
export interface QualityIssue {
    severity: ValidationSeverity;
    category: QualityCategory;
    description: string;
    affectedRecords: number;
    sampleData?: any[];
}
/**
 * Migration Manager
 */
export declare class MigrationManager {
    private migrations;
    private executions;
    /**
     * Create migration
     */
    createMigration(config: Omit<Migration, 'id' | 'status' | 'createdAt'>): Migration;
    /**
     * Execute migration
     */
    executeMigration(migrationId: string): Promise<MigrationExecution>;
    /**
     * Get migration
     */
    getMigration(migrationId: string): Migration | undefined;
    /**
     * List migrations
     */
    listMigrations(filter?: {
        status?: MigrationStatus;
        type?: MigrationType;
    }): Migration[];
    /**
     * Get execution
     */
    getExecution(executionId: string): MigrationExecution | undefined;
    /**
     * List executions
     */
    listExecutions(migrationId?: string): MigrationExecution[];
    private extractData;
    private transformData;
    private loadData;
    private validateData;
    private generateMigrationId;
    private generateExecutionId;
}
/**
 * Rollback Manager
 */
export declare class RollbackManager {
    private rollbacks;
    private migrationManager;
    constructor(migrationManager: MigrationManager);
    /**
     * Create rollback
     */
    createRollback(migrationId: string, executionId: string, strategy: RollbackStrategy): Promise<Rollback>;
    /**
     * Execute rollback
     */
    executeRollback(rollbackId: string): Promise<void>;
    /**
     * Get rollback
     */
    getRollback(rollbackId: string): Rollback | undefined;
    /**
     * List rollbacks
     */
    listRollbacks(migrationId?: string): Rollback[];
    private createRollbackSteps;
    private generateRollbackId;
}
/**
 * ETL Pipeline Manager
 */
export declare class ETLPipelineManager {
    private pipelines;
    /**
     * Create pipeline
     */
    createPipeline(config: Omit<ETLPipeline, 'id' | 'createdAt'>): ETLPipeline;
    /**
     * Execute pipeline
     */
    executePipeline(pipelineId: string): Promise<void>;
    /**
     * Get pipeline
     */
    getPipeline(pipelineId: string): ETLPipeline | undefined;
    /**
     * List pipelines
     */
    listPipelines(): ETLPipeline[];
    private executeStage;
    private generatePipelineId;
}
/**
 * Schema Version Manager
 */
export declare class SchemaVersionManager {
    private versions;
    /**
     * Create schema version
     */
    createVersion(config: Omit<SchemaVersion, 'id' | 'applied' | 'createdAt'>): SchemaVersion;
    /**
     * Apply schema version
     */
    applyVersion(versionId: string): Promise<void>;
    /**
     * Get version
     */
    getVersion(versionId: string): SchemaVersion | undefined;
    /**
     * List versions
     */
    listVersions(appliedOnly?: boolean): SchemaVersion[];
    private generateVersionId;
}
/**
 * Data Quality Manager
 */
export declare class DataQualityManager {
    private reports;
    /**
     * Generate quality report
     */
    generateReport(migrationId: string): Promise<DataQualityReport>;
    /**
     * Get report
     */
    getReport(reportId: string): DataQualityReport | undefined;
    /**
     * List reports
     */
    listReports(migrationId?: string): DataQualityReport[];
    private generateReportId;
}
/**
 * Singleton instances
 */
export declare const migrationManager: MigrationManager;
export declare const rollbackManager: RollbackManager;
export declare const etlPipelineManager: ETLPipelineManager;
export declare const schemaVersionManager: SchemaVersionManager;
export declare const dataQualityManager: DataQualityManager;
//# sourceMappingURL=MigrationSystem.d.ts.map