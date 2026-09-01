/**
 * Advanced Machine Learning Integration System
 * Model training, inference, feature engineering, hyperparameter tuning
 * Model versioning, A/B testing, drift detection
 */
import { EventEmitter } from 'events';
export interface MLConfig {
    modelRegistry: string;
    enableAutoML: boolean;
    enableModelVersioning: boolean;
    enableDriftDetection: boolean;
    inferenceTimeout: number;
    maxConcurrentInferences: number;
    cachePredictions: boolean;
}
export interface Model {
    id: string;
    name: string;
    version: string;
    type: ModelType;
    algorithm: string;
    framework: MLFramework;
    status: ModelStatus;
    metrics: ModelMetrics;
    hyperparameters: Record<string, any>;
    features: FeatureDefinition[];
    targetVariable: string;
    trainingConfig: TrainingConfig;
    metadata: ModelMetadata;
    artifacts: ModelArtifacts;
}
export type ModelType = 'classification' | 'regression' | 'clustering' | 'anomaly_detection' | 'time_series' | 'nlp' | 'computer_vision';
export type MLFramework = 'tensorflow' | 'pytorch' | 'scikit-learn' | 'xgboost' | 'lightgbm' | 'keras' | 'onnx';
export type ModelStatus = 'draft' | 'training' | 'trained' | 'deployed' | 'archived' | 'failed';
export interface ModelMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    rmse?: number;
    mae?: number;
    r2Score?: number;
    auc?: number;
    customMetrics?: Record<string, number>;
    confusionMatrix?: number[][];
    validationMetrics?: Record<string, number>;
}
export interface FeatureDefinition {
    name: string;
    type: FeatureType;
    source: string;
    transformation?: string;
    importance?: number;
    nullable: boolean;
    description?: string;
}
export type FeatureType = 'numeric' | 'categorical' | 'text' | 'datetime' | 'boolean' | 'embedding';
export interface TrainingConfig {
    datasetId: string;
    validationSplit: number;
    testSplit: number;
    batchSize: number;
    epochs: number;
    earlyStoppingPatience?: number;
    learningRate: number;
    optimizer: string;
    lossFunction: string;
    regularization?: RegularizationConfig;
    augmentation?: AugmentationConfig;
}
export interface RegularizationConfig {
    type: 'l1' | 'l2' | 'elastic_net' | 'dropout';
    strength: number;
    dropoutRate?: number;
}
export interface AugmentationConfig {
    enabled: boolean;
    techniques: string[];
    probability: number;
}
export interface ModelMetadata {
    author: string;
    description: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
    trainedAt?: number;
    deployedAt?: number;
    trainingDuration?: number;
    datasetSize?: number;
}
export interface ModelArtifacts {
    modelPath: string;
    weightsPath?: string;
    configPath?: string;
    preprocessorPath?: string;
    vocabularyPath?: string;
    checkpointPaths?: string[];
}
export interface TrainingJob {
    id: string;
    modelId: string;
    status: JobStatus;
    progress: number;
    startedAt: number;
    completedAt?: number;
    duration?: number;
    currentEpoch?: number;
    totalEpochs: number;
    trainingMetrics: TrainingMetrics;
    error?: Error;
}
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface TrainingMetrics {
    epochMetrics: EpochMetrics[];
    bestEpoch?: number;
    bestMetrics?: Record<string, number>;
    convergenceRate?: number;
}
export interface EpochMetrics {
    epoch: number;
    loss: number;
    valLoss?: number;
    metrics: Record<string, number>;
    duration: number;
}
export interface PredictionRequest {
    modelId: string;
    modelVersion?: string;
    input: any;
    features?: Record<string, any>;
    options?: PredictionOptions;
}
export interface PredictionOptions {
    explainability?: boolean;
    confidence?: boolean;
    batchMode?: boolean;
    timeout?: number;
}
export interface PredictionResult {
    prediction: any;
    confidence?: number;
    probabilities?: Record<string, number>;
    explanation?: Explanation;
    modelVersion: string;
    timestamp: number;
    latency: number;
}
export interface Explanation {
    featureImportance: Record<string, number>;
    shapValues?: Record<string, number>;
    lime?: any;
    attention?: number[][];
}
export interface Dataset {
    id: string;
    name: string;
    type: DatasetType;
    size: number;
    features: string[];
    targetVariable: string;
    split: DatasetSplit;
    statistics: DatasetStatistics;
    metadata: DatasetMetadata;
}
export type DatasetType = 'tabular' | 'text' | 'image' | 'audio' | 'video' | 'time_series';
export interface DatasetSplit {
    train: number;
    validation: number;
    test: number;
}
export interface DatasetStatistics {
    rowCount: number;
    columnCount: number;
    missingValues: Record<string, number>;
    uniqueValues: Record<string, number>;
    distributions: Record<string, Distribution>;
    correlations?: Record<string, Record<string, number>>;
}
export interface Distribution {
    mean?: number;
    median?: number;
    std?: number;
    min?: number;
    max?: number;
    quartiles?: number[];
    histogram?: HistogramBin[];
}
export interface HistogramBin {
    start: number;
    end: number;
    count: number;
}
export interface DatasetMetadata {
    source: string;
    createdAt: number;
    updatedAt: number;
    version: string;
    tags: string[];
}
export interface HyperparameterTuning {
    id: string;
    modelType: string;
    strategy: TuningStrategy;
    searchSpace: SearchSpace;
    objective: string;
    trials: Trial[];
    bestTrial?: Trial;
    status: JobStatus;
}
export type TuningStrategy = 'grid_search' | 'random_search' | 'bayesian_optimization' | 'hyperband' | 'genetic_algorithm';
export interface SearchSpace {
    [parameter: string]: ParameterSpace;
}
export interface ParameterSpace {
    type: 'int' | 'float' | 'categorical' | 'boolean';
    min?: number;
    max?: number;
    step?: number;
    values?: any[];
    scale?: 'linear' | 'log';
}
export interface Trial {
    id: string;
    parameters: Record<string, any>;
    metrics: Record<string, number>;
    status: JobStatus;
    duration: number;
    startedAt: number;
    completedAt?: number;
}
export interface ModelExperiment {
    id: string;
    name: string;
    description: string;
    models: string[];
    baseline?: string;
    currentChampion?: string;
    metrics: ExperimentMetrics;
    status: 'running' | 'completed' | 'cancelled';
    startedAt: number;
    completedAt?: number;
}
export interface ExperimentMetrics {
    modelMetrics: Map<string, ModelMetrics>;
    comparisonResults: ComparisonResult[];
}
export interface ComparisonResult {
    modelA: string;
    modelB: string;
    metric: string;
    improvement: number;
    significant: boolean;
    pValue?: number;
}
export interface DriftDetection {
    id: string;
    modelId: string;
    type: DriftType;
    threshold: number;
    detectedAt?: number;
    severity: 'low' | 'medium' | 'high';
    affectedFeatures: string[];
    metrics: DriftMetrics;
}
export type DriftType = 'data_drift' | 'concept_drift' | 'prediction_drift';
export interface DriftMetrics {
    psi?: number;
    kl_divergence?: number;
    js_divergence?: number;
    wasserstein_distance?: number;
    drift_score: number;
}
export interface FeatureStore {
    id: string;
    name: string;
    features: Map<string, FeatureValue>;
    version: string;
    updatedAt: number;
}
export interface FeatureValue {
    name: string;
    value: any;
    timestamp: number;
    version: string;
}
export interface ModelMonitoring {
    modelId: string;
    metrics: MonitoringMetrics;
    alerts: ModelAlert[];
    lastCheck: number;
}
export interface MonitoringMetrics {
    requestCount: number;
    averageLatency: number;
    errorRate: number;
    throughput: number;
    cpuUsage: number;
    memoryUsage: number;
    predictionDistribution: Distribution;
}
export interface ModelAlert {
    id: string;
    type: AlertType;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: number;
    acknowledged: boolean;
}
export type AlertType = 'high_latency' | 'high_error_rate' | 'drift_detected' | 'resource_usage' | 'prediction_anomaly';
export declare class MLManager extends EventEmitter {
    private config;
    private models;
    private datasets;
    private trainingJobs;
    private experiments;
    private driftDetectors;
    private featureStores;
    private monitoring;
    private predictionCache;
    constructor(config?: Partial<MLConfig>);
    registerModel(model: Omit<Model, 'id' | 'status' | 'metadata'>): Model;
    getModel(modelId: string, version?: string): Model | undefined;
    listModels(filter?: ModelFilter): Model[];
    trainModel(modelId: string): Promise<TrainingJob>;
    private simulateTraining;
    cancelTraining(jobId: string): Promise<void>;
    predict(request: PredictionRequest): Promise<PredictionResult>;
    private performInference;
    private generateExplanation;
    private getCacheKey;
    tuneHyperparameters(modelType: string, searchSpace: SearchSpace, config: Partial<HyperparameterTuning>): Promise<HyperparameterTuning>;
    private generateTrials;
    private sampleParameter;
    createExperiment(experiment: Omit<ModelExperiment, 'id' | 'status' | 'startedAt' | 'metrics'>): ModelExperiment;
    compareModels(experimentId: string): Promise<ComparisonResult[]>;
    private compareModelMetrics;
    detectDrift(modelId: string, recentData: any[]): Promise<DriftDetection | null>;
    private calculatePSI;
    private updateMonitoring;
    private createAlert;
    registerDataset(dataset: Omit<Dataset, 'id'>): Dataset;
    getDataset(datasetId: string): Dataset | undefined;
    createFeatureStore(name: string): FeatureStore;
    setFeature(storeId: string, name: string, value: any): void;
    getFeature(storeId: string, name: string): FeatureValue | undefined;
    private generateId;
    private delay;
    getStats(): MLStats;
}
interface ModelFilter {
    type?: ModelType;
    status?: ModelStatus;
    framework?: MLFramework;
    tags?: string[];
}
interface MLStats {
    totalModels: number;
    trainedModels: number;
    deployedModels: number;
    trainingJobs: number;
    activeJobs: number;
    totalDatasets: number;
    experiments: number;
    driftDetections: number;
}
export default MLManager;
//# sourceMappingURL=MLManager.d.ts.map