/**
 * Data Pipeline and ETL System
 * Extract, Transform, Load operations with data validation and quality checks
 */
export interface Pipeline {
    id: string;
    name: string;
    description?: string;
    source: DataSource;
    transforms: Transform[];
    destination: DataDestination;
    schedule?: PipelineSchedule;
    config: PipelineConfig;
    status: PipelineStatus;
    metrics: PipelineMetrics;
    createdAt: Date;
    updatedAt: Date;
}
export interface DataSource {
    type: SourceType;
    config: SourceConfig;
    schema?: DataSchema;
}
export declare enum SourceType {
    Database = "database",
    File = "file",
    API = "api",
    Stream = "stream",
    Queue = "queue"
}
export interface SourceConfig {
    [key: string]: any;
}
export interface DataSchema {
    fields: SchemaField[];
    primaryKey?: string[];
    indexes?: Index[];
}
export interface SchemaField {
    name: string;
    type: FieldType;
    nullable: boolean;
    defaultValue?: any;
    constraints?: FieldConstraint[];
}
export declare enum FieldType {
    String = "string",
    Number = "number",
    Boolean = "boolean",
    Date = "date",
    Object = "object",
    Array = "array"
}
export interface FieldConstraint {
    type: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
    value: any;
}
export interface Index {
    name: string;
    fields: string[];
    unique: boolean;
}
export interface Transform {
    id: string;
    name: string;
    type: TransformType;
    config: TransformConfig;
    enabled: boolean;
    order: number;
}
export declare enum TransformType {
    Map = "map",
    Filter = "filter",
    Aggregate = "aggregate",
    Join = "join",
    Sort = "sort",
    Deduplicate = "deduplicate",
    Validate = "validate",
    Enrich = "enrich",
    Split = "split",
    Merge = "merge"
}
export interface TransformConfig {
    [key: string]: any;
}
export interface DataDestination {
    type: DestinationType;
    config: DestinationConfig;
    schema?: DataSchema;
}
export declare enum DestinationType {
    Database = "database",
    File = "file",
    API = "api",
    Stream = "stream",
    Queue = "queue"
}
export interface DestinationConfig {
    [key: string]: any;
}
export interface PipelineSchedule {
    type: 'cron' | 'interval' | 'event';
    expression?: string;
    interval?: number;
    eventType?: string;
}
export interface PipelineConfig {
    batchSize: number;
    parallelism: number;
    retryPolicy: RetryPolicy;
    errorHandling: ErrorHandling;
    logging: LoggingConfig;
}
export interface RetryPolicy {
    maxAttempts: number;
    backoff: 'linear' | 'exponential';
    delay: number;
}
export interface ErrorHandling {
    strategy: 'stop' | 'skip' | 'deadletter';
    deadLetterQueue?: string;
}
export interface LoggingConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    destination: 'console' | 'file' | 'database';
}
export declare enum PipelineStatus {
    Idle = "idle",
    Running = "running",
    Paused = "paused",
    Failed = "failed",
    Completed = "completed"
}
export interface PipelineMetrics {
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    skippedRecords: number;
    averageLatency: number;
    throughput: number;
    lastRun?: Date;
    runCount: number;
}
export interface PipelineRun {
    id: string;
    pipelineId: string;
    status: PipelineStatus;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    metrics: RunMetrics;
    errors: PipelineError[];
}
export interface RunMetrics {
    recordsRead: number;
    recordsWritten: number;
    recordsFailed: number;
    recordsSkipped: number;
    bytesRead: number;
    bytesWritten: number;
}
export interface PipelineError {
    recordId?: string;
    stage: string;
    error: string;
    timestamp: Date;
    data?: any;
}
export interface DataQualityRule {
    id: string;
    name: string;
    type: QualityRuleType;
    field?: string;
    condition: QualityCondition;
    severity: 'error' | 'warning';
    enabled: boolean;
}
export declare enum QualityRuleType {
    NotNull = "not_null",
    Unique = "unique",
    Range = "range",
    Pattern = "pattern",
    Enum = "enum",
    Custom = "custom"
}
export interface QualityCondition {
    type: string;
    value: any;
}
export interface DataQualityReport {
    pipelineId: string;
    runId: string;
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    violations: QualityViolation[];
    timestamp: Date;
}
export interface QualityViolation {
    ruleId: string;
    ruleName: string;
    recordId?: string;
    field?: string;
    value?: any;
    message: string;
    severity: 'error' | 'warning';
}
/**
 * ETL Pipeline Manager
 */
export declare class ETLPipelineManager {
    private pipelines;
    private runs;
    private qualityRules;
    /**
     * Create pipeline
     */
    createPipeline(pipeline: Omit<Pipeline, 'id' | 'status' | 'metrics' | 'createdAt' | 'updatedAt'>): Pipeline;
    /**
     * Run pipeline
     */
    runPipeline(pipelineId: string): Promise<PipelineRun>;
    /**
     * Stop pipeline
     */
    stopPipeline(pipelineId: string): void;
    /**
     * Get pipeline
     */
    getPipeline(pipelineId: string): Pipeline | undefined;
    /**
     * List pipelines
     */
    listPipelines(filter?: {
        status?: PipelineStatus;
    }): Pipeline[];
    /**
     * Get pipeline run
     */
    getRun(runId: string): PipelineRun | undefined;
    /**
     * List pipeline runs
     */
    listRuns(pipelineId?: string): PipelineRun[];
    /**
     * Add quality rule
     */
    addQualityRule(pipelineId: string, rule: DataQualityRule): void;
    /**
     * Validate data quality
     */
    validateQuality(pipelineId: string, runId: string, records: any[]): Promise<DataQualityReport>;
    /**
     * Execute pipeline
     */
    private executePipeline;
    /**
     * Extract data
     */
    private extract;
    /**
     * Transform data
     */
    private transform;
    private transformMap;
    private transformFilter;
    private transformAggregate;
    private transformSort;
    private transformDeduplicate;
    /**
     * Load data
     */
    private load;
    private checkRule;
    private generatePipelineId;
    private generateRunId;
}
/**
 * Data Validator
 */
export declare class DataValidator {
    /**
     * Validate against schema
     */
    validate(data: any, schema: DataSchema): ValidationResult;
    private validateType;
    private validateConstraint;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}
export interface ValidationError {
    field: string;
    message: string;
    value: any;
}
/**
 * Singleton instances
 */
export declare const etlPipelineManager: ETLPipelineManager;
export declare const dataValidator: DataValidator;
//# sourceMappingURL=ETLPipeline.d.ts.map