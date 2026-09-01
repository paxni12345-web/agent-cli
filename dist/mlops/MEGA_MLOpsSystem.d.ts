/**
 * MEGA PHASE 23: MLOPS & MODEL MANAGEMENT
 * ML pipeline, Model versioning, A/B testing, Feature store, Model monitoring
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface ModelRegistryConfig {
    storageBackend: StorageBackend;
    versioningStrategy: VersioningStrategy;
    enableStaging: boolean;
    retentionPolicy: RetentionPolicy;
}
export type StorageBackend = 's3' | 'gcs' | 'azure' | 'local';
export type VersioningStrategy = 'semantic' | 'timestamp' | 'hash' | 'sequential';
export interface RetentionPolicy {
    maxVersions: number;
    minAge: number;
    keepProduction: boolean;
}
export interface MLModel {
    id: string;
    name: string;
    version: string;
    framework: MLFramework;
    algorithm: string;
    stage: ModelStage;
    metrics: ModelMetrics;
    parameters: ModelParameters;
    artifacts: ModelArtifact[];
    metadata: ModelMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export type MLFramework = 'tensorflow' | 'pytorch' | 'scikit-learn' | 'xgboost' | 'lightgbm' | 'keras' | 'onnx';
export type ModelStage = 'development' | 'staging' | 'production' | 'archived';
export interface ModelMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;
    mse?: number;
    mae?: number;
    r2?: number;
    custom: Map<string, number>;
}
export interface ModelParameters {
    hyperparameters: Map<string, any>;
    trainingConfig: TrainingConfig;
    datasetInfo: DatasetInfo;
}
export interface TrainingConfig {
    epochs: number;
    batchSize: number;
    learningRate: number;
    optimizer: string;
    lossFunction: string;
}
export interface DatasetInfo {
    name: string;
    version: string;
    size: number;
    features: number;
    samples: number;
    split: DataSplit;
}
export interface DataSplit {
    train: number;
    validation: number;
    test: number;
}
export interface ModelArtifact {
    type: ArtifactType;
    path: string;
    size: number;
    checksum: string;
}
export type ArtifactType = 'model' | 'weights' | 'config' | 'tokenizer' | 'preprocessor';
export interface ModelMetadata {
    author: string;
    description: string;
    tags: string[];
    license: string;
    useCase: string;
    dependencies: Record<string, string>;
}
export declare class ModelRegistry extends EventEmitter {
    private config;
    private models;
    constructor(config?: Partial<ModelRegistryConfig>);
    registerModel(model: Omit<MLModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<MLModel>;
    getModel(name: string, version?: string): Promise<MLModel | null>;
    promoteModel(modelId: string, stage: ModelStage): Promise<void>;
    deleteModel(modelId: string): Promise<void>;
    private applyRetentionPolicy;
    private generateId;
    getStats(): {
        totalModels: number;
        productionModels: number;
        modelNames: number;
    };
}
export interface FeatureStoreConfig {
    backend: StorageBackend;
    cacheEnabled: boolean;
    cacheTTL: number;
    enableVersioning: boolean;
}
export interface Feature {
    id: string;
    name: string;
    type: FeatureType;
    description: string;
    entity: string;
    source: FeatureSource;
    transformation?: Transformation;
    version: number;
    createdAt: Date;
}
export type FeatureType = 'numerical' | 'categorical' | 'binary' | 'text' | 'embedding';
export interface FeatureSource {
    type: SourceType;
    query?: string;
    path?: string;
    refreshInterval?: number;
}
export type SourceType = 'batch' | 'stream' | 'request';
export interface Transformation {
    type: TransformationType;
    config: Record<string, any>;
}
export type TransformationType = 'normalize' | 'standardize' | 'one_hot' | 'embedding' | 'aggregation' | 'custom';
export interface FeatureGroup {
    id: string;
    name: string;
    features: string[];
    version: number;
    description: string;
    createdAt: Date;
}
export interface FeatureVector {
    entityId: string;
    features: Map<string, any>;
    timestamp: Date;
}
export declare class FeatureStore extends EventEmitter {
    private config;
    private features;
    private groups;
    private cache;
    constructor(config?: Partial<FeatureStoreConfig>);
    createFeature(feature: Omit<Feature, 'id' | 'createdAt'>): Promise<Feature>;
    createFeatureGroup(group: Omit<FeatureGroup, 'id' | 'createdAt'>): Promise<FeatureGroup>;
    getFeatures(entityId: string, featureIds: string[]): Promise<FeatureVector>;
    private computeFeature;
    private sleep;
    private generateId;
    getStats(): {
        features: number;
        groups: number;
        cached: number;
    };
}
export interface ServingConfig {
    replicas: number;
    batchSize: number;
    maxLatency: number;
    enableGPU: boolean;
    caching: boolean;
}
export interface InferenceRequest {
    modelId: string;
    inputs: any;
    parameters?: Record<string, any>;
}
export interface InferenceResponse {
    requestId: string;
    predictions: any;
    latency: number;
    modelVersion: string;
    timestamp: Date;
}
export interface ModelEndpoint {
    id: string;
    modelId: string;
    url: string;
    replicas: number;
    status: EndpointStatus;
    metrics: EndpointMetrics;
    createdAt: Date;
}
export type EndpointStatus = 'creating' | 'active' | 'updating' | 'failed';
export interface EndpointMetrics {
    requests: number;
    errors: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
}
export declare class ModelServingEngine extends EventEmitter {
    private config;
    private endpoints;
    private registry;
    private requestQueue;
    constructor(registry: ModelRegistry, config?: Partial<ServingConfig>);
    createEndpoint(modelId: string): Promise<ModelEndpoint>;
    predict(request: InferenceRequest): Promise<InferenceResponse>;
    private startBatchProcessor;
    private processBatch;
    private generatePredictions;
    private updateMetrics;
    private sleep;
    private generateId;
    getStats(): {
        endpoints: number;
        activeEndpoints: number;
        queuedRequests: number;
    };
}
export interface MonitoringConfig {
    enableDriftDetection: boolean;
    driftThreshold: number;
    windowSize: number;
    alerting: boolean;
}
export interface ModelMonitor {
    modelId: string;
    metrics: MonitoringMetrics;
    driftStatus: DriftStatus;
    alerts: Alert[];
}
export interface MonitoringMetrics {
    predictions: PredictionMetrics;
    performance: PerformanceMetrics;
    data: DataMetrics;
}
export interface PredictionMetrics {
    count: number;
    distribution: Distribution;
    confidence: ConfidenceMetrics;
}
export interface Distribution {
    mean: number;
    std: number;
    min: number;
    max: number;
    percentiles: Map<number, number>;
}
export interface ConfidenceMetrics {
    average: number;
    low: number;
    high: number;
}
export interface PerformanceMetrics {
    accuracy?: number;
    latency: LatencyMetrics;
    throughput: number;
    errorRate: number;
}
export interface LatencyMetrics {
    p50: number;
    p95: number;
    p99: number;
    max: number;
}
export interface DataMetrics {
    featureDrift: Map<string, number>;
    targetDrift?: number;
    missingValues: Map<string, number>;
}
export interface DriftStatus {
    detected: boolean;
    severity: DriftSeverity;
    features: string[];
    timestamp?: Date;
}
export type DriftSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';
export interface Alert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
}
export type AlertType = 'drift' | 'performance' | 'error' | 'latency';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export declare class ModelMonitoringSystem extends EventEmitter {
    private config;
    private monitors;
    constructor(config?: Partial<MonitoringConfig>);
    createMonitor(modelId: string): ModelMonitor;
    recordPrediction(modelId: string, prediction: any, latency: number): Promise<void>;
    private updateLatencyMetrics;
    private detectDrift;
    private createAlert;
    private sleep;
    private generateId;
    getStats(): {
        monitors: number;
        totalAlerts: number;
        driftDetected: number;
    };
}
export declare class CompleteMLOpsSystem {
    registry: ModelRegistry;
    featureStore: FeatureStore;
    serving: ModelServingEngine;
    monitoring: ModelMonitoringSystem;
    constructor();
    getOverallStats(): {
        registry: {
            totalModels: number;
            productionModels: number;
            modelNames: number;
        };
        featureStore: {
            features: number;
            groups: number;
            cached: number;
        };
        serving: {
            endpoints: number;
            activeEndpoints: number;
            queuedRequests: number;
        };
        monitoring: {
            monitors: number;
            totalAlerts: number;
            driftDetected: number;
        };
    };
}
//# sourceMappingURL=MEGA_MLOpsSystem.d.ts.map