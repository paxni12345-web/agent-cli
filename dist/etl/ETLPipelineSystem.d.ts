/**
 * PHASE 2: ETL & DATA PIPELINE SYSTEM
 * Extract, Transform, Load with data quality and governance
 *
 * Part of 350K lines goal - PHASE 2
 */
import { EventEmitter } from 'events';
export interface ETLConfig {
    maxConcurrentPipelines: number;
    defaultBatchSize: number;
    enableDataQuality: boolean;
    enableGovernance: boolean;
    retentionDays: number;
}
export interface DataSource {
    id: string;
    name: string;
    type: DataSourceType;
    connection: ConnectionConfig;
    schema?: DataSchema;
    credentials?: Credentials;
    metadata: SourceMetadata;
}
export type DataSourceType = 'database' | 'api' | 'file' | 's3' | 'kafka' | 'webhook' | 'custom';
export interface ConnectionConfig {
    host?: string;
    port?: number;
    database?: string;
    url?: string;
    bucket?: string;
    path?: string;
    params?: Record<string, any>;
}
export interface Credentials {
    username?: string;
    password?: string;
    apiKey?: string;
    token?: string;
    accessKey?: string;
    secretKey?: string;
}
export interface SourceMetadata {
    region?: string;
    environment: string;
    owner: string;
    tags: string[];
    createdAt: Date;
}
export interface DataSchema {
    tables?: TableSchema[];
    collections?: CollectionSchema[];
    format?: DataFormat;
    fields: FieldSchema[];
}
export type DataFormat = 'json' | 'csv' | 'parquet' | 'avro' | 'xml' | 'protobuf';
export interface TableSchema {
    name: string;
    columns: ColumnSchema[];
    primaryKey?: string[];
    foreignKeys?: ForeignKey[];
}
export interface ColumnSchema {
    name: string;
    type: DataType;
    nullable: boolean;
    unique?: boolean;
    defaultValue?: any;
}
export type DataType = 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'timestamp' | 'json' | 'binary';
export interface ForeignKey {
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
}
export interface CollectionSchema {
    name: string;
    fields: FieldSchema[];
    indexes?: Index[];
}
export interface FieldSchema {
    name: string;
    type: DataType;
    required: boolean;
    validation?: ValidationRule[];
}
export interface ValidationRule {
    type: ValidationType;
    value?: any;
    message?: string;
}
export type ValidationType = 'min' | 'max' | 'pattern' | 'enum' | 'custom';
export interface Index {
    fields: string[];
    unique: boolean;
    type: IndexType;
}
export type IndexType = 'btree' | 'hash' | 'fulltext';
export interface ETLPipeline {
    id: string;
    name: string;
    description: string;
    source: DataSource;
    destination: DataSource;
    transformations: Transformation[];
    schedule?: Schedule;
    state: PipelineState;
    lastRun?: PipelineRun;
    config: PipelineConfig;
    createdAt: Date;
    updatedAt: Date;
}
export type PipelineState = 'draft' | 'active' | 'paused' | 'archived';
export interface PipelineConfig {
    batchSize: number;
    parallelism: number;
    errorHandling: ErrorHandling;
    monitoring: MonitoringConfig;
}
export interface ErrorHandling {
    strategy: ErrorStrategy;
    maxRetries: number;
    deadLetterQueue?: string;
}
export type ErrorStrategy = 'fail' | 'skip' | 'retry' | 'quarantine';
export interface MonitoringConfig {
    enableMetrics: boolean;
    enableLogging: boolean;
    alertThreshold: number;
}
export interface Schedule {
    type: ScheduleType;
    expression: string;
    timezone: string;
}
export type ScheduleType = 'cron' | 'interval' | 'manual';
export interface Transformation {
    id: string;
    name: string;
    type: TransformationType;
    config: TransformConfig;
    order: number;
}
export type TransformationType = 'filter' | 'map' | 'aggregate' | 'join' | 'pivot' | 'unpivot' | 'sort' | 'deduplicate' | 'validate' | 'enrich' | 'custom';
export interface TransformConfig {
    expression?: string;
    fields?: string[];
    conditions?: Condition[];
    joinType?: JoinType;
    aggregations?: Aggregation[];
    customFunction?: string;
    [key: string]: any;
}
export interface Condition {
    field: string;
    operator: Operator;
    value: any;
}
export type Operator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'contains' | 'regex';
export type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross';
export interface Aggregation {
    field: string;
    function: AggregateFunction;
    alias: string;
}
export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct' | 'first' | 'last';
export interface PipelineRun {
    id: string;
    pipelineId: string;
    state: RunState;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    recordsProcessed: number;
    recordsSucceeded: number;
    recordsFailed: number;
    steps: StepExecution[];
    error?: ExecutionError;
}
export type RunState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface StepExecution {
    stepId: string;
    name: string;
    state: RunState;
    startedAt: Date;
    completedAt?: Date;
    recordsIn: number;
    recordsOut: number;
    error?: ExecutionError;
}
export interface ExecutionError {
    message: string;
    code: string;
    details?: any;
    stack?: string;
}
export interface DataQualityRule {
    id: string;
    name: string;
    description: string;
    type: QualityRuleType;
    field?: string;
    condition: QualityCondition;
    severity: Severity;
    enabled: boolean;
}
export type QualityRuleType = 'completeness' | 'accuracy' | 'consistency' | 'uniqueness' | 'timeliness' | 'validity';
export interface QualityCondition {
    operator: Operator;
    threshold?: number;
    pattern?: string;
    referenceData?: any;
}
export type Severity = 'info' | 'warning' | 'error' | 'critical';
export interface QualityCheck {
    id: string;
    ruleId: string;
    pipelineRunId: string;
    passed: boolean;
    score: number;
    violations: Violation[];
    checkedAt: Date;
}
export interface Violation {
    recordId: string;
    field: string;
    value: any;
    expectedValue?: any;
    message: string;
}
export interface DataLineage {
    datasetId: string;
    upstream: LineageNode[];
    downstream: LineageNode[];
    transformations: string[];
    lastUpdated: Date;
}
export interface LineageNode {
    id: string;
    name: string;
    type: string;
    metadata: Record<string, any>;
}
export interface DataCatalog {
    id: string;
    name: string;
    description: string;
    schema: DataSchema;
    classification: DataClassification;
    owner: string;
    steward: string;
    tags: string[];
    businessGlossary: GlossaryTerm[];
    qualityScore: number;
    sensitivityLevel: SensitivityLevel;
    retentionPolicy: RetentionPolicy;
}
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';
export type SensitivityLevel = 'low' | 'medium' | 'high' | 'critical';
export interface GlossaryTerm {
    term: string;
    definition: string;
    synonyms: string[];
    relatedTerms: string[];
}
export interface RetentionPolicy {
    duration: number;
    unit: TimeUnit;
    action: RetentionAction;
}
export type TimeUnit = 'days' | 'months' | 'years';
export type RetentionAction = 'archive' | 'delete' | 'anonymize';
export interface CDCConfig {
    enabled: boolean;
    mode: CDCMode;
    captureDeletes: boolean;
    captureUpdates: boolean;
    batchInterval: number;
}
export type CDCMode = 'log_based' | 'trigger_based' | 'timestamp_based' | 'snapshot';
export interface ChangeEvent {
    id: string;
    operation: ChangeOperation;
    table: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    timestamp: Date;
    metadata: Record<string, any>;
}
export type ChangeOperation = 'insert' | 'update' | 'delete';
export declare class ETLPipelineManager extends EventEmitter {
    private config;
    private sources;
    private pipelines;
    private runs;
    private qualityRules;
    private catalog;
    private lineage;
    private runningPipelines;
    constructor(config?: Partial<ETLConfig>);
    registerDataSource(name: string, type: DataSourceType, connection: ConnectionConfig, metadata: Partial<SourceMetadata>): DataSource;
    discoverSchema(sourceId: string): Promise<DataSchema>;
    createPipeline(name: string, description: string, sourceId: string, destinationId: string, transformations: Transformation[]): ETLPipeline;
    schedulePipeline(pipelineId: string, schedule: Schedule): void;
    executePipeline(pipelineId: string): Promise<PipelineRun>;
    private extractData;
    private applyTransformation;
    private filterData;
    private mapData;
    private aggregateData;
    private deduplicateData;
    private loadData;
    createQualityRule(rule: Omit<DataQualityRule, 'id'>): DataQualityRule;
    private performQualityChecks;
    private executeQualityRule;
    catalogDataset(catalog: Omit<DataCatalog, 'id'>): DataCatalog;
    private updateLineage;
    getLineage(datasetId: string): DataLineage | undefined;
    private generateId;
    getStats(): {
        dataSources: number;
        pipelines: number;
        activePipelines: number;
        runs: number;
        runningPipelines: number;
        qualityRules: number;
        catalogEntries: number;
        lineageEntries: number;
    };
}
//# sourceMappingURL=ETLPipelineSystem.d.ts.map