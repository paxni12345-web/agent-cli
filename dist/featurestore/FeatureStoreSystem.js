"use strict";
/**
 * Feature Store System
 * ML feature management, online/offline serving, feature computation, and versioning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureMonitoringManager = exports.materializationManager = exports.offlineFeatureServer = exports.onlineFeatureServer = exports.featureViewManager = exports.entityManager = exports.featureStoreManager = exports.FeatureMonitoringManager = exports.MaterializationManager = exports.OfflineFeatureServer = exports.OnlineFeatureServer = exports.FeatureViewManager = exports.EntityManager = exports.FeatureStoreManager = exports.EngineType = exports.NodeType = exports.AlertSeverity = exports.MetricType = exports.JobStatus = exports.SourceType = exports.RuleType = exports.TransformationType = exports.ValueType = exports.OfflineStoreType = exports.OnlineStoreType = exports.StoreType = void 0;
const EventBus_1 = require("../core/EventBus");
var StoreType;
(function (StoreType) {
    StoreType["Online"] = "online";
    StoreType["Offline"] = "offline";
    StoreType["Hybrid"] = "hybrid";
})(StoreType || (exports.StoreType = StoreType = {}));
var OnlineStoreType;
(function (OnlineStoreType) {
    OnlineStoreType["Redis"] = "redis";
    OnlineStoreType["DynamoDB"] = "dynamodb";
    OnlineStoreType["Cassandra"] = "cassandra";
    OnlineStoreType["InMemory"] = "in_memory";
})(OnlineStoreType || (exports.OnlineStoreType = OnlineStoreType = {}));
var OfflineStoreType;
(function (OfflineStoreType) {
    OfflineStoreType["Parquet"] = "parquet";
    OfflineStoreType["BigQuery"] = "bigquery";
    OfflineStoreType["Snowflake"] = "snowflake";
    OfflineStoreType["Redshift"] = "redshift";
    OfflineStoreType["PostgreSQL"] = "postgresql";
})(OfflineStoreType || (exports.OfflineStoreType = OfflineStoreType = {}));
var ValueType;
(function (ValueType) {
    ValueType["Int32"] = "int32";
    ValueType["Int64"] = "int64";
    ValueType["Float32"] = "float32";
    ValueType["Float64"] = "float64";
    ValueType["String"] = "string";
    ValueType["Boolean"] = "boolean";
    ValueType["Timestamp"] = "timestamp";
    ValueType["Array"] = "array";
    ValueType["Map"] = "map";
})(ValueType || (exports.ValueType = ValueType = {}));
var TransformationType;
(function (TransformationType) {
    TransformationType["Identity"] = "identity";
    TransformationType["Expression"] = "expression";
    TransformationType["Function"] = "function";
    TransformationType["Aggregation"] = "aggregation";
    TransformationType["Window"] = "window";
})(TransformationType || (exports.TransformationType = TransformationType = {}));
var RuleType;
(function (RuleType) {
    RuleType["Range"] = "range";
    RuleType["Regex"] = "regex";
    RuleType["Enum"] = "enum";
    RuleType["NotNull"] = "not_null";
    RuleType["Custom"] = "custom";
})(RuleType || (exports.RuleType = RuleType = {}));
var SourceType;
(function (SourceType) {
    SourceType["BatchFile"] = "batch_file";
    SourceType["Stream"] = "stream";
    SourceType["RequestSource"] = "request_source";
    SourceType["Database"] = "database";
})(SourceType || (exports.SourceType = SourceType = {}));
var JobStatus;
(function (JobStatus) {
    JobStatus["Pending"] = "pending";
    JobStatus["Running"] = "running";
    JobStatus["Completed"] = "completed";
    JobStatus["Failed"] = "failed";
    JobStatus["Cancelled"] = "cancelled";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var MetricType;
(function (MetricType) {
    MetricType["Freshness"] = "freshness";
    MetricType["Completeness"] = "completeness";
    MetricType["Drift"] = "drift";
    MetricType["Accuracy"] = "accuracy";
    MetricType["Latency"] = "latency";
})(MetricType || (exports.MetricType = MetricType = {}));
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["Info"] = "info";
    AlertSeverity["Warning"] = "warning";
    AlertSeverity["Critical"] = "critical";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var NodeType;
(function (NodeType) {
    NodeType["Feature"] = "feature";
    NodeType["FeatureView"] = "feature_view";
    NodeType["DataSource"] = "data_source";
    NodeType["Model"] = "model";
    NodeType["Dataset"] = "dataset";
})(NodeType || (exports.NodeType = NodeType = {}));
var EngineType;
(function (EngineType) {
    EngineType["Pandas"] = "pandas";
    EngineType["Spark"] = "spark";
    EngineType["Dask"] = "dask";
    EngineType["Ray"] = "ray";
})(EngineType || (exports.EngineType = EngineType = {}));
/**
 * Feature Store Manager
 */
class FeatureStoreManager {
    stores = new Map();
    /**
     * Create feature store
     */
    createStore(config) {
        const store = {
            ...config,
            id: this.generateStoreId(),
            entities: [],
            featureViews: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.stores.set(store.id, store);
        EventBus_1.eventBus.emitSync('feature_store.created', store, 'FeatureStoreManager');
        return store;
    }
    /**
     * Get store
     */
    getStore(storeId) {
        return this.stores.get(storeId);
    }
    /**
     * List stores
     */
    listStores(type) {
        let stores = Array.from(this.stores.values());
        if (type) {
            stores = stores.filter(s => s.type === type);
        }
        return stores;
    }
    /**
     * Update store
     */
    updateStore(storeId, updates) {
        const store = this.stores.get(storeId);
        if (!store) {
            throw new Error(`Feature store not found: ${storeId}`);
        }
        Object.assign(store, updates);
        store.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('feature_store.updated', store, 'FeatureStoreManager');
        return store;
    }
    generateStoreId() {
        return `store_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FeatureStoreManager = FeatureStoreManager;
/**
 * Entity Manager
 */
class EntityManager {
    entities = new Map();
    /**
     * Register entity
     */
    registerEntity(config) {
        const entity = {
            ...config,
            id: this.generateEntityId(),
            createdAt: new Date(),
        };
        this.entities.set(entity.id, entity);
        EventBus_1.eventBus.emitSync('feature_store.entity_registered', entity, 'EntityManager');
        return entity;
    }
    /**
     * Get entity
     */
    getEntity(entityId) {
        return this.entities.get(entityId);
    }
    /**
     * Find entity by name
     */
    findEntityByName(name) {
        return Array.from(this.entities.values()).find(e => e.name === name);
    }
    /**
     * List entities
     */
    listEntities() {
        return Array.from(this.entities.values());
    }
    generateEntityId() {
        return `entity_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.EntityManager = EntityManager;
/**
 * Feature View Manager
 */
class FeatureViewManager {
    featureViews = new Map();
    /**
     * Create feature view
     */
    createFeatureView(config) {
        const featureView = {
            ...config,
            id: this.generateFeatureViewId(),
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.featureViews.set(featureView.id, featureView);
        EventBus_1.eventBus.emitSync('feature_store.feature_view_created', featureView, 'FeatureViewManager');
        return featureView;
    }
    /**
     * Get feature view
     */
    getFeatureView(featureViewId) {
        return this.featureViews.get(featureViewId);
    }
    /**
     * Find feature view by name
     */
    findFeatureViewByName(name) {
        return Array.from(this.featureViews.values()).find(fv => fv.name === name);
    }
    /**
     * List feature views
     */
    listFeatureViews(filter) {
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
    updateFeatureView(featureViewId, updates) {
        const featureView = this.featureViews.get(featureViewId);
        if (!featureView) {
            throw new Error(`Feature view not found: ${featureViewId}`);
        }
        Object.assign(featureView, updates);
        featureView.version += 1;
        featureView.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('feature_store.feature_view_updated', featureView, 'FeatureViewManager');
        return featureView;
    }
    generateFeatureViewId() {
        return `fv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FeatureViewManager = FeatureViewManager;
/**
 * Online Feature Server
 */
class OnlineFeatureServer {
    cache = new Map();
    featureViewManager;
    constructor(featureViewManager) {
        this.featureViewManager = featureViewManager;
    }
    /**
     * Get online features
     */
    async getOnlineFeatures(request) {
        const startTime = Date.now();
        const vectors = [];
        for (const entityKey of request.entityKeys) {
            const cacheKey = this.getCacheKey(entityKey, request.featureViews);
            let vector = this.cache.get(cacheKey);
            if (!vector) {
                vector = await this.fetchFeatures(entityKey, request.featureViews, request.features);
                this.cache.set(cacheKey, vector);
            }
            vectors.push(vector);
        }
        const response = {
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
    async writeOnlineFeatures(vectors) {
        for (const vector of vectors) {
            const cacheKey = this.getCacheKey(vector.entityKey, []);
            this.cache.set(cacheKey, vector);
        }
        EventBus_1.eventBus.emitSync('feature_store.online_features_written', { count: vectors.length }, 'OnlineFeatureServer');
    }
    async fetchFeatures(entityKey, featureViewNames, features) {
        // Mock feature fetching
        await new Promise(resolve => setTimeout(resolve, 10));
        const featureMap = new Map();
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
    generateMockValue(valueType) {
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
    getCacheKey(entityKey, featureViews) {
        const keyParts = [entityKey.entityName];
        for (const [key, value] of entityKey.joinKeyValues) {
            keyParts.push(`${key}:${value}`);
        }
        keyParts.push(...featureViews);
        return keyParts.join('|');
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.OnlineFeatureServer = OnlineFeatureServer;
/**
 * Offline Feature Server
 */
class OfflineFeatureServer {
    featureViewManager;
    constructor(featureViewManager) {
        this.featureViewManager = featureViewManager;
    }
    /**
     * Get historical features
     */
    async getHistoricalFeatures(request) {
        // Mock historical feature retrieval
        await new Promise(resolve => setTimeout(resolve, 100));
        const columns = [...request.entityDf.columns];
        const rows = [];
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
        const schema = {};
        for (const col of columns) {
            schema[col] = ValueType.Float64;
        }
        EventBus_1.eventBus.emitSync('feature_store.historical_features_retrieved', { rowCount: rows.length }, 'OfflineFeatureServer');
        return {
            columns,
            rows,
            schema,
        };
    }
}
exports.OfflineFeatureServer = OfflineFeatureServer;
/**
 * Materialization Manager
 */
class MaterializationManager {
    jobs = new Map();
    featureViewManager;
    onlineServer;
    constructor(featureViewManager, onlineServer) {
        this.featureViewManager = featureViewManager;
        this.onlineServer = onlineServer;
    }
    /**
     * Materialize features
     */
    async materialize(featureViewIds, startTime, endTime) {
        const job = {
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
        EventBus_1.eventBus.emitSync('feature_store.materialization_started', job, 'MaterializationManager');
        // Execute materialization
        await this.executeMaterialization(job);
        return job;
    }
    /**
     * Get job
     */
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    /**
     * List jobs
     */
    listJobs(status) {
        let jobs = Array.from(this.jobs.values());
        if (status) {
            jobs = jobs.filter(j => j.status === status);
        }
        return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async executeMaterialization(job) {
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
            EventBus_1.eventBus.emitSync('feature_store.materialization_completed', job, 'MaterializationManager');
        }
        catch (error) {
            job.status = JobStatus.Failed;
            job.completedAt = new Date();
            EventBus_1.eventBus.emitSync('feature_store.materialization_failed', job, 'MaterializationManager');
        }
    }
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.MaterializationManager = MaterializationManager;
/**
 * Feature Monitoring Manager
 */
class FeatureMonitoringManager {
    monitors = new Map();
    /**
     * Enable monitoring
     */
    enableMonitoring(featureViewId, featureName) {
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
        }
        else {
            monitor.enabled = true;
        }
        EventBus_1.eventBus.emitSync('feature_store.monitoring_enabled', monitor, 'FeatureMonitoringManager');
        return monitor;
    }
    /**
     * Record metric
     */
    recordMetric(featureViewId, featureName, metric) {
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
    getMonitoring(featureViewId, featureName) {
        const key = `${featureViewId}:${featureName}`;
        return this.monitors.get(key);
    }
    /**
     * List active alerts
     */
    listActiveAlerts() {
        const alerts = [];
        for (const monitor of this.monitors.values()) {
            const activeAlerts = monitor.alerts.filter(a => !a.resolvedAt);
            alerts.push(...activeAlerts);
        }
        return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
    }
    createAlert(monitor, metric) {
        const alert = {
            id: this.generateAlertId(),
            severity: AlertSeverity.Warning,
            metric,
            message: `${metric.name} exceeded threshold: ${metric.value} > ${metric.threshold}`,
            triggeredAt: new Date(),
        };
        monitor.alerts.push(alert);
        EventBus_1.eventBus.emitSync('feature_store.alert_triggered', alert, 'FeatureMonitoringManager');
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FeatureMonitoringManager = FeatureMonitoringManager;
/**
 * Singleton instances
 */
exports.featureStoreManager = new FeatureStoreManager();
exports.entityManager = new EntityManager();
exports.featureViewManager = new FeatureViewManager();
exports.onlineFeatureServer = new OnlineFeatureServer(exports.featureViewManager);
exports.offlineFeatureServer = new OfflineFeatureServer(exports.featureViewManager);
exports.materializationManager = new MaterializationManager(exports.featureViewManager, exports.onlineFeatureServer);
exports.featureMonitoringManager = new FeatureMonitoringManager();
