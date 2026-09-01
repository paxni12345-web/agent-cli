/**
 * PHASE 1: AUTOML & MODEL TRAINING SYSTEM
 * Automated machine learning, model training, and hyperparameter optimization
 *
 * Part of 350K lines goal - PHASE 1
 */
import { EventEmitter } from 'events';
export interface AutoMLConfig {
    maxTrainingTime: number;
    maxModels: number;
    enableEnsemble: boolean;
    enableFeatureEngineering: boolean;
    enableHyperparameterTuning: boolean;
    evaluationMetric: string;
}
export interface Dataset {
    id: string;
    name: string;
    type: DatasetType;
    features: Feature[];
    target: Feature;
    samples: number;
    split: DatasetSplit;
    metadata: DatasetMetadata;
}
export type DatasetType = 'classification' | 'regression' | 'clustering' | 'time_series';
export interface Feature {
    name: string;
    type: FeatureType;
    importance?: number;
    statistics?: FeatureStatistics;
    encoding?: EncodingType;
}
export type FeatureType = 'numeric' | 'categorical' | 'datetime' | 'text' | 'image';
export type EncodingType = 'onehot' | 'label' | 'ordinal' | 'embedding' | 'tfidf';
export interface FeatureStatistics {
    mean?: number;
    median?: number;
    std?: number;
    min?: number;
    max?: number;
    missing?: number;
    unique?: number;
}
export interface DatasetSplit {
    train: number;
    validation: number;
    test: number;
    stratified: boolean;
}
export interface DatasetMetadata {
    source: string;
    createdAt: Date;
    lastModified: Date;
    version: number;
}
export interface TrainingJob {
    id: string;
    name: string;
    datasetId: string;
    modelType: ModelType;
    algorithm: MLAlgorithm;
    hyperparameters: Hyperparameters;
    state: TrainingState;
    progress: number;
    metrics: TrainingMetrics;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
}
export type ModelType = 'classification' | 'regression' | 'clustering' | 'anomaly_detection';
export type MLAlgorithm = 'logistic_regression' | 'random_forest' | 'xgboost' | 'lightgbm' | 'catboost' | 'neural_network' | 'svm' | 'knn' | 'naive_bayes' | 'decision_tree' | 'gradient_boosting' | 'adaboost';
export interface Hyperparameters {
    learning_rate?: number;
    max_depth?: number;
    n_estimators?: number;
    min_samples_split?: number;
    min_samples_leaf?: number;
    max_features?: number | string;
    subsample?: number;
    colsample_bytree?: number;
    reg_alpha?: number;
    reg_lambda?: number;
    [key: string]: any;
}
export type TrainingState = 'pending' | 'preparing' | 'training' | 'evaluating' | 'completed' | 'failed';
export interface TrainingMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;
    mse?: number;
    rmse?: number;
    mae?: number;
    r2Score?: number;
    confusionMatrix?: number[][];
    rocCurve?: ROCPoint[];
    prCurve?: PRPoint[];
}
export interface ROCPoint {
    fpr: number;
    tpr: number;
    threshold: number;
}
export interface PRPoint {
    precision: number;
    recall: number;
    threshold: number;
}
export interface FeatureEngineeringJob {
    id: string;
    datasetId: string;
    operations: FeatureOperation[];
    state: JobState;
    outputFeatures: Feature[];
    createdAt: Date;
}
export type JobState = 'pending' | 'running' | 'completed' | 'failed';
export interface FeatureOperation {
    type: FeatureOperationType;
    sourceFeatures: string[];
    outputFeature: string;
    parameters?: Record<string, any>;
}
export type FeatureOperationType = 'normalize' | 'standardize' | 'log_transform' | 'polynomial' | 'interaction' | 'binning' | 'encoding' | 'pca' | 'embedding';
export interface HyperparameterTuningJob {
    id: string;
    modelType: ModelType;
    algorithm: MLAlgorithm;
    searchSpace: SearchSpace;
    strategy: OptimizationStrategy;
    maxTrials: number;
    currentTrial: number;
    bestParams: Hyperparameters;
    bestScore: number;
    trials: Trial[];
    state: JobState;
}
export interface SearchSpace {
    [parameter: string]: ParameterRange;
}
export interface ParameterRange {
    type: 'int' | 'float' | 'categorical' | 'boolean';
    min?: number;
    max?: number;
    values?: any[];
    log?: boolean;
}
export type OptimizationStrategy = 'grid_search' | 'random_search' | 'bayesian' | 'genetic' | 'tpe';
export interface Trial {
    id: string;
    parameters: Hyperparameters;
    score: number;
    duration: number;
    state: TrialState;
}
export type TrialState = 'pending' | 'running' | 'completed' | 'failed' | 'pruned';
export interface ModelEvaluation {
    modelId: string;
    testMetrics: TrainingMetrics;
    crossValidation?: CrossValidationResult;
    featureImportance: FeatureImportance[];
    predictions: Prediction[];
    residuals?: number[];
    timestamp: Date;
}
export interface CrossValidationResult {
    folds: number;
    scores: number[];
    mean: number;
    std: number;
}
export interface FeatureImportance {
    feature: string;
    importance: number;
    rank: number;
}
export interface Prediction {
    actual: any;
    predicted: any;
    probability?: number;
    confidence?: number;
}
export interface RegisteredModel {
    id: string;
    name: string;
    version: number;
    algorithm: MLAlgorithm;
    hyperparameters: Hyperparameters;
    metrics: TrainingMetrics;
    features: Feature[];
    target: Feature;
    artifactPath: string;
    stage: ModelStage;
    tags: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
}
export type ModelStage = 'development' | 'staging' | 'production' | 'archived';
export interface ModelDeployment {
    id: string;
    modelId: string;
    version: number;
    endpoint: string;
    status: DeploymentStatus;
    instances: number;
    autoScaling: AutoScalingConfig;
    monitoring: DeploymentMonitoring;
    deployedAt: Date;
}
export type DeploymentStatus = 'deploying' | 'active' | 'updating' | 'failed' | 'terminated';
export interface AutoScalingConfig {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
}
export interface DeploymentMonitoring {
    requestsPerSecond: number;
    averageLatency: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
}
export interface EnsembleModel {
    id: string;
    name: string;
    strategy: EnsembleStrategy;
    baseModels: string[];
    weights?: number[];
    votingMethod?: VotingMethod;
    stackingMeta?: MLAlgorithm;
    metrics: TrainingMetrics;
}
export type EnsembleStrategy = 'voting' | 'averaging' | 'stacking' | 'boosting' | 'bagging';
export type VotingMethod = 'hard' | 'soft';
export declare class AutoMLManager extends EventEmitter {
    private config;
    private datasets;
    private trainingJobs;
    private featureJobs;
    private tuningJobs;
    private models;
    private deployments;
    private ensembles;
    constructor(config?: Partial<AutoMLConfig>);
    registerDataset(name: string, type: DatasetType, features: Feature[], target: Feature, samples: number): Dataset;
    analyzeDataset(datasetId: string): void;
    private calculateFeatureStatistics;
    engineerFeatures(datasetId: string, operations: FeatureOperation[]): Promise<FeatureEngineeringJob>;
    private applyFeatureOperation;
    trainModel(datasetId: string, algorithm: MLAlgorithm, hyperparameters?: Hyperparameters): Promise<TrainingJob>;
    private evaluateModel;
    tuneHyperparameters(datasetId: string, algorithm: MLAlgorithm, searchSpace: SearchSpace, strategy?: OptimizationStrategy, maxTrials?: number): Promise<HyperparameterTuningJob>;
    private sampleHyperparameters;
    private runTrial;
    runAutoML(datasetId: string): Promise<RegisteredModel>;
    private getScore;
    private getSearchSpace;
    private registerModel;
    deployModel(modelId: string, instances?: number): Promise<ModelDeployment>;
    private createEnsemble;
    private generateId;
    private sleep;
    getStats(): {
        datasets: number;
        trainingJobs: number;
        featureJobs: number;
        tuningJobs: number;
        registeredModels: number;
        deployments: number;
        ensembles: number;
        productionModels: number;
    };
}
//# sourceMappingURL=AutoMLSystem.d.ts.map