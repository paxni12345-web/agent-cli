/**
 * Feature Store System
 * ML feature management, online/offline serving, feature computation, and versioning
 */
export interface FeatureStore {
    id: string;
    name: string;
    description: string;
    type: StoreType;
    config: StoreConfig;
    entities: Entity[];
    featureViews: FeatureView[];
    createdAt: Date;
    updatedAt: Date;
}
export declare enum StoreType {
    Online = "online",
    Offline = "offline",
    Hybrid = "hybrid"
}
export interface StoreConfig {
    onlineStore?: OnlineStoreConfig;
    offlineStore?: OfflineStoreConfig;
    registry?: RegistryConfig;
}
export interface OnlineStoreConfig {
    type: OnlineStoreType;
    connection: ConnectionConfig;
    ttl?: number;
}
export declare enum OnlineStoreType {
    Redis = "redis",
    DynamoDB = "dynamodb",
    Cassandra = "cassandra",
    InMemory = "in_memory"
}
export interface OfflineStoreConfig {
    type: OfflineStoreType;
    connection: ConnectionConfig;
    batchSize?: number;
}
export declare enum OfflineStoreType {
    Parquet = "parquet",
    BigQuery = "bigquery",
    Snowflake = "snowflake",
    Redshift = "redshift",
    PostgreSQL = "postgresql"
}
export interface ConnectionConfig {
    host?: string;
    port?: number;
    database?: string;
    credentials?: Record<string, string>;
    options?: Record<string, any>;
}
export interface RegistryConfig {
    path: string;
    cacheEnabled: boolean;
    cacheTTL?: number;
}
export interface Entity {
    id: string;
    name: string;
    description: string;
    valueType: ValueType;
    joinKeys: string[];
    tags: string[];
    createdAt: Date;
}
export declare enum ValueType {
    Int32 = "int32",
    Int64 = "int64",
    Float32 = "float32",
    Float64 = "float64",
    String = "string",
    Boolean = "boolean",
    Timestamp = "timestamp",
    Array = "array",
    Map = "map"
}
export interface FeatureView {
    id: string;
    name: string;
    description: string;
    entities: string[];
    features: Feature[];
    source: DataSource;
    ttl?: number;
    online: boolean;
    offline: boolean;
    tags: string[];
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface Feature {
    id: string;
    name: string;
    description: string;
    valueType: ValueType;
    transformation?: Transformation;
    validation?: FeatureValidation;
    metadata: FeatureMetadata;
}
export interface Transformation {
    type: TransformationType;
    expression?: string;
    function?: string;
    parameters?: Record<string, any>;
}
export declare enum TransformationType {
    Identity = "identity",
    Expression = "expression",
    Function = "function",
    Aggregation = "aggregation",
    Window = "window"
}
export interface FeatureValidation {
    rules: ValidationRule[];
    required: boolean;
}
export interface ValidationRule {
    type: RuleType;
    config: Record<string, any>;
}
export declare enum RuleType {
    Range = "range",
    Regex = "regex",
    Enum = "enum",
    NotNull = "not_null",
    Custom = "custom"
}
export interface FeatureMetadata {
    owner: string;
    team: string;
    documentation?: string;
    freshness?: number;
    monitoring: boolean;
}
export interface DataSource {
    type: SourceType;
    config: SourceConfig;
    eventTimestampColumn?: string;
    createdTimestampColumn?: string;
}
export declare enum SourceType {
    BatchFile = "batch_file",
    Stream = "stream",
    RequestSource = "request_source",
    Database = "database"
}
export interface SourceConfig {
    path?: string;
    table?: string;
    query?: string;
    topic?: string;
    format?: string;
    options?: Record<string, any>;
}
export interface FeatureVector {
    entityKey: EntityKey;
    features: Map<string, any>;
    timestamp: Date;
    metadata: Record<string, any>;
}
export interface EntityKey {
    entityName: string;
    joinKeyValues: Map<string, any>;
}
export interface FeatureRequest {
    entityKeys: EntityKey[];
    featureViews: string[];
    features?: string[];
    asOf?: Date;
}
export interface FeatureResponse {
    vectors: FeatureVector[];
    metadata: ResponseMetadata;
}
export interface ResponseMetadata {
    requestId: string;
    latency: number;
    source: string;
    cached: boolean;
    timestamp: Date;
}
export interface HistoricalFeatures {
    entityDf: EntityDataFrame;
    featureViews: string[];
    startTime: Date;
    endTime: Date;
    resultPath?: string;
}
export interface EntityDataFrame {
    columns: string[];
    rows: any[][];
    schema: Record<string, ValueType>;
}
export interface MaterializationJob {
    id: string;
    featureViewIds: string[];
    startTime: Date;
    endTime: Date;
    status: JobStatus;
    progress: JobProgress;
    createdAt: Date;
    completedAt?: Date;
}
export declare enum JobStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled"
}
export interface JobProgress {
    featureViewsCompleted: number;
    totalFeatureViews: number;
    recordsProcessed: number;
    totalRecords: number;
    percentage: number;
}
export interface FeatureStatistics {
    featureName: string;
    count: number;
    mean?: number;
    stdDev?: number;
    min?: number;
    max?: number;
    percentiles?: Map<number, number>;
    nullCount: number;
    uniqueCount?: number;
    topValues?: Array<{
        value: any;
        count: number;
    }>;
}
export interface FeatureMonitoring {
    featureViewId: string;
    featureName: string;
    metrics: MonitoringMetric[];
    alerts: MonitoringAlert[];
    enabled: boolean;
}
export interface MonitoringMetric {
    name: string;
    type: MetricType;
    value: number;
    threshold?: number;
    timestamp: Date;
}
export declare enum MetricType {
    Freshness = "freshness",
    Completeness = "completeness",
    Drift = "drift",
    Accuracy = "accuracy",
    Latency = "latency"
}
export interface MonitoringAlert {
    id: string;
    severity: AlertSeverity;
    metric: MonitoringMetric;
    message: string;
    triggeredAt: Date;
    resolvedAt?: Date;
}
export declare enum AlertSeverity {
    Info = "info",
    Warning = "warning",
    Critical = "critical"
}
export interface FeatureLineage {
    featureId: string;
    upstream: LineageNode[];
    downstream: LineageNode[];
    transformations: Transformation[];
}
export interface LineageNode {
    type: NodeType;
    id: string;
    name: string;
    metadata: Record<string, any>;
}
export declare enum NodeType {
    Feature = "feature",
    FeatureView = "feature_view",
    DataSource = "data_source",
    Model = "model",
    Dataset = "dataset"
}
export interface FeatureRegistry {
    stores: Map<string, FeatureStore>;
    entities: Map<string, Entity>;
    featureViews: Map<string, FeatureView>;
    features: Map<string, Feature>;
}
export interface ComputationEngine {
    id: string;
    type: EngineType;
    config: EngineConfig;
    enabled: boolean;
}
export declare enum EngineType {
    Pandas = "pandas",
    Spark = "spark",
    Dask = "dask",
    Ray = "ray"
}
export interface EngineConfig {
    workers?: number;
    memory?: string;
    cores?: number;
    options?: Record<string, any>;
}
export interface FeatureService {
    id: string;
    name: string;
    description: string;
    featureViews: string[];
    features: string[];
    tags: string[];
    createdAt: Date;
}
export interface OnDemandFeatureView {
    id: string;
    name: string;
    sources: string[];
    udf: UserDefinedFunction;
    features: Feature[];
    createdAt: Date;
}
export interface UserDefinedFunction {
    name: string;
    language: string;
    code: string;
    inputs: string[];
    outputs: string[];
}
/**
 * Feature Store Manager
 */
export declare class FeatureStoreManager {
    private stores;
    /**
     * Create feature store
     */
    createStore(config: Omit<FeatureStore, 'id' | 'entities' | 'featureViews' | 'createdAt' | 'updatedAt'>): FeatureStore;
    /**
     * Get store
     */
    getStore(storeId: string): FeatureStore | undefined;
    /**
     * List stores
     */
    listStores(type?: StoreType): FeatureStore[];
    /**
     * Update store
     */
    updateStore(storeId: string, updates: Partial<FeatureStore>): FeatureStore;
    private generateStoreId;
}
/**
 * Entity Manager
 */
export declare class EntityManager {
    private entities;
    /**
     * Register entity
     */
    registerEntity(config: Omit<Entity, 'id' | 'createdAt'>): Entity;
    /**
     * Get entity
     */
    getEntity(entityId: string): Entity | undefined;
    /**
     * Find entity by name
     */
    findEntityByName(name: string): Entity | undefined;
    /**
     * List entities
     */
    listEntities(): Entity[];
    private generateEntityId;
}
/**
 * Feature View Manager
 */
export declare class FeatureViewManager {
    private featureViews;
    /**
     * Create feature view
     */
    createFeatureView(config: Omit<FeatureView, 'id' | 'version' | 'createdAt' | 'updatedAt'>): FeatureView;
    /**
     * Get feature view
     */
    getFeatureView(featureViewId: string): FeatureView | undefined;
    /**
     * Find feature view by name
     */
    findFeatureViewByName(name: string): FeatureView | undefined;
    /**
     * List feature views
     */
    listFeatureViews(filter?: {
        online?: boolean;
        offline?: boolean;
    }): FeatureView[];
    /**
     * Update feature view
     */
    updateFeatureView(featureViewId: string, updates: Partial<FeatureView>): FeatureView;
    private generateFeatureViewId;
}
/**
 * Online Feature Server
 */
export declare class OnlineFeatureServer {
    private cache;
    private featureViewManager;
    constructor(featureViewManager: FeatureViewManager);
    /**
     * Get online features
     */
    getOnlineFeatures(request: FeatureRequest): Promise<FeatureResponse>;
    /**
     * Write online features
     */
    writeOnlineFeatures(vectors: FeatureVector[]): Promise<void>;
    private fetchFeatures;
    private generateMockValue;
    private getCacheKey;
    private generateRequestId;
}
/**
 * Offline Feature Server
 */
export declare class OfflineFeatureServer {
    private featureViewManager;
    constructor(featureViewManager: FeatureViewManager);
    /**
     * Get historical features
     */
    getHistoricalFeatures(request: HistoricalFeatures): Promise<EntityDataFrame>;
}
/**
 * Materialization Manager
 */
export declare class MaterializationManager {
    private jobs;
    private featureViewManager;
    private onlineServer;
    constructor(featureViewManager: FeatureViewManager, onlineServer: OnlineFeatureServer);
    /**
     * Materialize features
     */
    materialize(featureViewIds: string[], startTime: Date, endTime: Date): Promise<MaterializationJob>;
    /**
     * Get job
     */
    getJob(jobId: string): MaterializationJob | undefined;
    /**
     * List jobs
     */
    listJobs(status?: JobStatus): MaterializationJob[];
    private executeMaterialization;
    private generateJobId;
}
/**
 * Feature Monitoring Manager
 */
export declare class FeatureMonitoringManager {
    private monitors;
    /**
     * Enable monitoring
     */
    enableMonitoring(featureViewId: string, featureName: string): FeatureMonitoring;
    /**
     * Record metric
     */
    recordMetric(featureViewId: string, featureName: string, metric: MonitoringMetric): void;
    /**
     * Get monitoring
     */
    getMonitoring(featureViewId: string, featureName: string): FeatureMonitoring | undefined;
    /**
     * List active alerts
     */
    listActiveAlerts(): MonitoringAlert[];
    private createAlert;
    private generateAlertId;
}
/**
 * Singleton instances
 */
export declare const featureStoreManager: FeatureStoreManager;
export declare const entityManager: EntityManager;
export declare const featureViewManager: FeatureViewManager;
export declare const onlineFeatureServer: OnlineFeatureServer;
export declare const offlineFeatureServer: OfflineFeatureServer;
export declare const materializationManager: MaterializationManager;
export declare const featureMonitoringManager: FeatureMonitoringManager;
//# sourceMappingURL=FeatureStoreSystem.d.ts.map