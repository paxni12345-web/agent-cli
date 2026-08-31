/**
 * Feature Store System
 * ML feature management, online/offline serving, feature computation, and versioning
 */

import { eventBus } from '../core/EventBus';

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

export enum StoreType {
  Online = 'online',
  Offline = 'offline',
  Hybrid = 'hybrid',
}

export interface StoreConfig {
  onlineStore?: OnlineStoreConfig;
  offlineStore?: OfflineStoreConfig;
  registry?: RegistryConfig;
}

export interface OnlineStoreConfig {
  type: OnlineStoreType;
  connection: ConnectionConfig;
  ttl?: number; // milliseconds
}

export enum OnlineStoreType {
  Redis = 'redis',
  DynamoDB = 'dynamodb',
  Cassandra = 'cassandra',
  InMemory = 'in_memory',
}

export interface OfflineStoreConfig {
  type: OfflineStoreType;
  connection: ConnectionConfig;
  batchSize?: number;
}

export enum OfflineStoreType {
  Parquet = 'parquet',
  BigQuery = 'bigquery',
  Snowflake = 'snowflake',
  Redshift = 'redshift',
  PostgreSQL = 'postgresql',
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

export enum ValueType {
  Int32 = 'int32',
  Int64 = 'int64',
  Float32 = 'float32',
  Float64 = 'float64',
  String = 'string',
  Boolean = 'boolean',
  Timestamp = 'timestamp',
  Array = 'array',
  Map = 'map',
}

export interface FeatureView {
  id: string;
  name: string;
  description: string;
  entities: string[];
  features: Feature[];
  source: DataSource;
  ttl?: number; // milliseconds
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

export enum TransformationType {
  Identity = 'identity',
  Expression = 'expression',
  Function = 'function',
  Aggregation = 'aggregation',
  Window = 'window',
}

export interface FeatureValidation {
  rules: ValidationRule[];
  required: boolean;
}

export interface ValidationRule {
  type: RuleType;
  config: Record<string, any>;
}

export enum RuleType {
  Range = 'range',
  Regex = 'regex',
  Enum = 'enum',
  NotNull = 'not_null',
  Custom = 'custom',
}

export interface FeatureMetadata {
  owner: string;
  team: string;
  documentation?: string;
  freshness?: number; // milliseconds
  monitoring: boolean;
}

export interface DataSource {
  type: SourceType;
  config: SourceConfig;
  eventTimestampColumn?: string;
  createdTimestampColumn?: string;
}

export enum SourceType {
  BatchFile = 'batch_file',
  Stream = 'stream',
  RequestSource = 'request_source',
  Database = 'database',
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

export enum JobStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
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
  topValues?: Array<{ value: any; count: number }>;
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

export enum MetricType {
  Freshness = 'freshness',
  Completeness = 'completeness',
  Drift = 'drift',
  Accuracy = 'accuracy',
  Latency = 'latency',
}

export interface MonitoringAlert {
  id: string;
  severity: AlertSeverity;
  metric: MonitoringMetric;
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
}

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
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

export enum NodeType {
  Feature = 'feature',
  FeatureView = 'feature_view',
  DataSource = 'data_source',
  Model = 'model',
  Dataset = 'dataset',
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

export enum EngineType {
  Pandas = 'pandas',
  Spark = 'spark',
  Dask = 'dask',
  Ray = 'ray',
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
export class FeatureStoreManager {
  private stores: Map<string, FeatureStore> = new Map();

  /**
   * Create feature store
   */
  createStore(config: Omit<FeatureStore, 'id' | 'entities' | 'featureViews' | 'createdAt' | 'updatedAt'>): FeatureStore {
    const store: FeatureStore = {
      ...config,
      id: this.generateStoreId(),
      entities: [],
      featureViews: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.stores.set(store.id, store);

    eventBus.emitSync('feature_store.created', store, 'FeatureStoreManager');

    return store;
  }

  /**
   * Get store
   */
  getStore(storeId: string): FeatureStore | undefined {
    return this.stores.get(storeId);
  }

  /**
   * List stores
   */
  listStores(type?: StoreType): FeatureStore[] {
    let stores = Array.from(this.stores.values());

    if (type) {
      stores = stores.filter(s => s.type === type);
    }

    return stores;
  }

  /**
   * Update store
   */
  updateStore(storeId: string, updates: Partial<FeatureStore>): FeatureStore {
    const store = this.stores.get(storeId);

    if (!store) {
      throw new Error(`Feature store not found: ${storeId}`);
    }

    Object.assign(store, updates);
    store.updatedAt = new Date();

    eventBus.emitSync('feature_store.updated', store, 'FeatureStoreManager');

    return store;
  }

  private generateStoreId(): string {
    return `store_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Entity Manager
 */
export class EntityManager {
  private entities: Map<string, Entity> = new Map();

  /**
   * Register entity
   */
  registerEntity(config: Omit<Entity, 'id' | 'createdAt'>): Entity {
    const entity: Entity = {
      ...config,
      id: this.generateEntityId(),
      createdAt: new Date(),
    };

    this.entities.set(entity.id, entity);

    eventBus.emitSync('feature_store.entity_registered', entity, 'EntityManager');

    return entity;
  }

  /**
   * Get entity
   */
  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Find entity by name
   */
  findEntityByName(name: string): Entity | undefined {
    return Array.from(this.entities.values()).find(e => e.name === name);
  }

  /**
   * List entities
   */
  listEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  private generateEntityId(): string {
    return `entity_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Feature View Manager
 */
export class FeatureViewManager {
  private featureViews: Map<string, FeatureView> = new Map();

  /**
   * Create feature view
   */
  createFeatureView(config: Omit<FeatureView, 'id' | 'version' | 'createdAt' | 'updatedAt'>): FeatureView {
    const featureView: FeatureView = {
      ...config,
      id: this.generateFeatureViewId(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.featureViews.set(featureView.id, featureView);

    eventBus.emitSync('feature_store.feature_view_created', featureView, 'FeatureViewManager');

    return featureView;
  }

  /**
   * Get feature view
   */
  getFeatureView(featureViewId: string): FeatureView | undefined {
    return this.featureViews.get(featureViewId);
  }

  /**
   * Find feature view by name
   */
  findFeatureViewByName(name: string): FeatureView | undefined {
    return Array.from(this.featureViews.values()).find(fv => fv.name === name);
  }

  /**
   * List feature views
   */
  listFeatureViews(filter?: { online?: boolean; offline?: boolean }): FeatureView[] {
    let views = Array.from(this.featureViews.values());

    if (filter?.online !== undefined) {
      views = views.filter(fv => fv.online === filter.online);
    }

    if (filter?.offline !== undefined) {
      views = views.filter(fv => fv.offline === filter.offline);
    }

    return views;
  }

  /**
   * Update feature view
   */
  updateFeatureView(featureViewId: string, updates: Partial<FeatureView>): FeatureView {
    const featureView = this.featureViews.get(featureViewId);

    if (!featureView) {
      throw new Error(`Feature view not found: ${featureViewId}`);
    }

    Object.assign(featureView, updates);
    featureView.version += 1;
    featureView.updatedAt = new Date();

    eventBus.emitSync('feature_store.feature_view_updated', featureView, 'FeatureViewManager');

    return featureView;
  }

  private generateFeatureViewId(): string {
    return `fv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Online Feature Server
 */
export class OnlineFeatureServer {
  private cache: Map<string, FeatureVector> = new Map();
  private featureViewManager: FeatureViewManager;

  constructor(featureViewManager: FeatureViewManager) {
    this.featureViewManager = featureViewManager;
  }

  /**
   * Get online features
   */
  async getOnlineFeatures(request: FeatureRequest): Promise<FeatureResponse> {
    const startTime = Date.now();
    const vectors: FeatureVector[] = [];

    for (const entityKey of request.entityKeys) {
      const cacheKey = this.getCacheKey(entityKey, request.featureViews);
      let vector = this.cache.get(cacheKey);

      if (!vector) {
        vector = await this.fetchFeatures(entityKey, request.featureViews, request.features);
        this.cache.set(cacheKey, vector);
      }

      vectors.push(vector);
    }

    const response: FeatureResponse = {
      vectors,
      metadata: {
        requestId: this.generateRequestId(),
        latency: Date.now() - startTime,
        source: 'online',
        cached: true,
        timestamp: new Date(),
      },
    };

    return response;
  }

  /**
   * Write online features
   */
  async writeOnlineFeatures(vectors: FeatureVector[]): Promise<void> {
    for (const vector of vectors) {
      const cacheKey = this.getCacheKey(vector.entityKey, []);
      this.cache.set(cacheKey, vector);
    }

    eventBus.emitSync('feature_store.online_features_written', { count: vectors.length }, 'OnlineFeatureServer');
  }

  private async fetchFeatures(entityKey: EntityKey, featureViewNames: string[], features?: string[]): Promise<FeatureVector> {
    // Mock feature fetching
    await new Promise(resolve => setTimeout(resolve, 10));

    const featureMap = new Map<string, any>();

    for (const viewName of featureViewNames) {
      const view = this.featureViewManager.findFeatureViewByName(viewName);

      if (view) {
        for (const feature of view.features) {
          if (!features || features.includes(feature.name)) {
            featureMap.set(feature.name, this.generateMockValue(feature.valueType));
          }
        }
      }
    }

    return {
      entityKey,
      features: featureMap,
      timestamp: new Date(),
      metadata: {},
    };
  }

  private generateMockValue(valueType: ValueType): any {
    switch (valueType) {
      case ValueType.Int32:
      case ValueType.Int64:
        return Math.floor(Math.random() * 100);
      case ValueType.Float32:
      case ValueType.Float64:
        return Math.random() * 100;
      case ValueType.String:
        return `value_${Math.random().toString(36).substring(7)}`;
      case ValueType.Boolean:
        return Math.random() > 0.5;
      case ValueType.Timestamp:
        return new Date();
      default:
        return null;
    }
  }

  private getCacheKey(entityKey: EntityKey, featureViews: string[]): string {
    const keyParts = [entityKey.entityName];
    for (const [key, value] of entityKey.joinKeyValues) {
      keyParts.push(`${key}:${value}`);
    }
    keyParts.push(...featureViews);
    return keyParts.join('|');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Offline Feature Server
 */
export class OfflineFeatureServer {
  private featureViewManager: FeatureViewManager;

  constructor(featureViewManager: FeatureViewManager) {
    this.featureViewManager = featureViewManager;
  }

  /**
   * Get historical features
   */
  async getHistoricalFeatures(request: HistoricalFeatures): Promise<EntityDataFrame> {
    // Mock historical feature retrieval
    await new Promise(resolve => setTimeout(resolve, 100));

    const columns = [...request.entityDf.columns];
    const rows: any[][] = [];

    // Add feature columns
    for (const viewName of request.featureViews) {
      const view = this.featureViewManager.findFeatureViewByName(viewName);
      if (view) {
        for (const feature of view.features) {
          columns.push(feature.name);
        }
      }
    }

    // Generate mock data
    for (const row of request.entityDf.rows) {
      const newRow = [...row];
      // Add mock feature values
      for (let i = row.length; i < columns.length; i++) {
        newRow.push(Math.random() * 100);
      }
      rows.push(newRow);
    }

    const schema: Record<string, ValueType> = {};
    for (const col of columns) {
      schema[col] = ValueType.Float64;
    }

    eventBus.emitSync('feature_store.historical_features_retrieved', { rowCount: rows.length }, 'OfflineFeatureServer');

    return {
      columns,
      rows,
      schema,
    };
  }
}

/**
 * Materialization Manager
 */
export class MaterializationManager {
  private jobs: Map<string, MaterializationJob> = new Map();
  private featureViewManager: FeatureViewManager;
  private onlineServer: OnlineFeatureServer;

  constructor(featureViewManager: FeatureViewManager, onlineServer: OnlineFeatureServer) {
    this.featureViewManager = featureViewManager;
    this.onlineServer = onlineServer;
  }

  /**
   * Materialize features
   */
  async materialize(featureViewIds: string[], startTime: Date, endTime: Date): Promise<MaterializationJob> {
    const job: MaterializationJob = {
      id: this.generateJobId(),
      featureViewIds,
      startTime,
      endTime,
      status: JobStatus.Pending,
      progress: {
        featureViewsCompleted: 0,
        totalFeatureViews: featureViewIds.length,
        recordsProcessed: 0,
        totalRecords: 0,
        percentage: 0,
      },
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);

    eventBus.emitSync('feature_store.materialization_started', job, 'MaterializationManager');

    // Execute materialization
    await this.executeMaterialization(job);

    return job;
  }

  /**
   * Get job
   */
  getJob(jobId: string): MaterializationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List jobs
   */
  listJobs(status?: JobStatus): MaterializationJob[] {
    let jobs = Array.from(this.jobs.values());

    if (status) {
      jobs = jobs.filter(j => j.status === status);
    }

    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private async executeMaterialization(job: MaterializationJob): Promise<void> {
    job.status = JobStatus.Running;

    try {
      for (const viewId of job.featureViewIds) {
        // Mock materialization
        await new Promise(resolve => setTimeout(resolve, 100));

        job.progress.featureViewsCompleted++;
        job.progress.recordsProcessed += Math.floor(Math.random() * 1000);
        job.progress.percentage = (job.progress.featureViewsCompleted / job.progress.totalFeatureViews) * 100;
      }

      job.status = JobStatus.Completed;
      job.completedAt = new Date();

      eventBus.emitSync('feature_store.materialization_completed', job, 'MaterializationManager');

    } catch (error) {
      job.status = JobStatus.Failed;
      job.completedAt = new Date();

      eventBus.emitSync('feature_store.materialization_failed', job, 'MaterializationManager');
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Feature Monitoring Manager
 */
export class FeatureMonitoringManager {
  private monitors: Map<string, FeatureMonitoring> = new Map();

  /**
   * Enable monitoring
   */
  enableMonitoring(featureViewId: string, featureName: string): FeatureMonitoring {
    const key = `${featureViewId}:${featureName}`;
    let monitor = this.monitors.get(key);

    if (!monitor) {
      monitor = {
        featureViewId,
        featureName,
        metrics: [],
        alerts: [],
        enabled: true,
      };
      this.monitors.set(key, monitor);
    } else {
      monitor.enabled = true;
    }

    eventBus.emitSync('feature_store.monitoring_enabled', monitor, 'FeatureMonitoringManager');

    return monitor;
  }

  /**
   * Record metric
   */
  recordMetric(featureViewId: string, featureName: string, metric: MonitoringMetric): void {
    const key = `${featureViewId}:${featureName}`;
    const monitor = this.monitors.get(key);

    if (monitor && monitor.enabled) {
      monitor.metrics.push(metric);

      // Check thresholds
      if (metric.threshold && metric.value > metric.threshold) {
        this.createAlert(monitor, metric);
      }

      // Keep last 1000 metrics
      if (monitor.metrics.length > 1000) {
        monitor.metrics.shift();
      }
    }
  }

  /**
   * Get monitoring
   */
  getMonitoring(featureViewId: string, featureName: string): FeatureMonitoring | undefined {
    const key = `${featureViewId}:${featureName}`;
    return this.monitors.get(key);
  }

  /**
   * List active alerts
   */
  listActiveAlerts(): MonitoringAlert[] {
    const alerts: MonitoringAlert[] = [];

    for (const monitor of this.monitors.values()) {
      const activeAlerts = monitor.alerts.filter(a => !a.resolvedAt);
      alerts.push(...activeAlerts);
    }

    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  private createAlert(monitor: FeatureMonitoring, metric: MonitoringMetric): void {
    const alert: MonitoringAlert = {
      id: this.generateAlertId(),
      severity: AlertSeverity.Warning,
      metric,
      message: `${metric.name} exceeded threshold: ${metric.value} > ${metric.threshold}`,
      triggeredAt: new Date(),
    };

    monitor.alerts.push(alert);

    eventBus.emitSync('feature_store.alert_triggered', alert, 'FeatureMonitoringManager');
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const featureStoreManager = new FeatureStoreManager();
export const entityManager = new EntityManager();
export const featureViewManager = new FeatureViewManager();
export const onlineFeatureServer = new OnlineFeatureServer(featureViewManager);
export const offlineFeatureServer = new OfflineFeatureServer(featureViewManager);
export const materializationManager = new MaterializationManager(featureViewManager, onlineFeatureServer);
export const featureMonitoringManager = new FeatureMonitoringManager();
