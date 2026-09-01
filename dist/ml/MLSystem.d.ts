/**
 * Machine Learning Integration System
 * ML model training, inference, feature engineering, and experiment tracking
 */
export interface MLModel {
    id: string;
    name: string;
    type: ModelType;
    version: string;
    framework: MLFramework;
    algorithm: string;
    hyperparameters: Record<string, any>;
    metrics: ModelMetrics;
    artifacts: ModelArtifact[];
    metadata: ModelMetadata;
    status: ModelStatus;
    createdAt: Date;
    trainedAt?: Date;
}
export declare enum ModelType {
    Classification = "classification",
    Regression = "regression",
    Clustering = "clustering",
    NeuralNetwork = "neural_network",
    ReinforcementLearning = "reinforcement_learning",
    NLP = "nlp",
    ComputerVision = "computer_vision"
}
export declare enum MLFramework {
    TensorFlow = "tensorflow",
    PyTorch = "pytorch",
    ScikitLearn = "scikit_learn",
    XGBoost = "xgboost",
    Keras = "keras",
    Custom = "custom"
}
export declare enum ModelStatus {
    Draft = "draft",
    Training = "training",
    Trained = "trained",
    Evaluating = "evaluating",
    Deployed = "deployed",
    Archived = "archived",
    Failed = "failed"
}
export interface ModelMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;
    mse?: number;
    mae?: number;
    r2?: number;
    loss?: number;
    customMetrics?: Record<string, number>;
}
export interface ModelArtifact {
    type: ArtifactType;
    path: string;
    size: number;
    checksum: string;
    createdAt: Date;
}
export declare enum ArtifactType {
    Weights = "weights",
    Graph = "graph",
    Checkpoint = "checkpoint",
    Config = "config",
    Vocabulary = "vocabulary",
    Scaler = "scaler"
}
export interface ModelMetadata {
    author: string;
    description?: string;
    tags: string[];
    dataset: string;
    features: string[];
    targetVariable?: string;
    trainingDuration?: number;
    sampleCount?: number;
}
export interface TrainingJob {
    id: string;
    modelId: string;
    config: TrainingConfig;
    status: TrainingStatus;
    progress: TrainingProgress;
    epochs: EpochResult[];
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}
export interface TrainingConfig {
    epochs: number;
    batchSize: number;
    learningRate: number;
    validationSplit: number;
    optimizer: string;
    lossFunction: string;
    callbacks: TrainingCallback[];
    earlyStoppingPatience?: number;
}
export declare enum TrainingStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Stopped = "stopped"
}
export interface TrainingProgress {
    currentEpoch: number;
    totalEpochs: number;
    currentBatch: number;
    totalBatches: number;
    percentage: number;
    eta?: number;
}
export interface EpochResult {
    epoch: number;
    loss: number;
    accuracy?: number;
    valLoss?: number;
    valAccuracy?: number;
    metrics: Record<string, number>;
    duration: number;
    timestamp: Date;
}
export interface TrainingCallback {
    type: CallbackType;
    config: Record<string, any>;
}
export declare enum CallbackType {
    EarlyStopping = "early_stopping",
    ModelCheckpoint = "model_checkpoint",
    ReduceLROnPlateau = "reduce_lr_on_plateau",
    TensorBoard = "tensorboard",
    Custom = "custom"
}
export interface Prediction {
    id: string;
    modelId: string;
    input: any;
    output: any;
    confidence?: number;
    timestamp: Date;
    duration: number;
}
export interface FeatureSet {
    id: string;
    name: string;
    features: Feature[];
    transformations: FeatureTransformation[];
    statistics: FeatureStatistics;
    createdAt: Date;
    updatedAt: Date;
}
export interface Feature {
    name: string;
    type: FeatureType;
    nullable: boolean;
    categorical: boolean;
    description?: string;
}
export declare enum FeatureType {
    Numeric = "numeric",
    Categorical = "categorical",
    Text = "text",
    DateTime = "datetime",
    Binary = "binary",
    Image = "image"
}
export interface FeatureTransformation {
    type: TransformationType;
    feature: string;
    config: Record<string, any>;
}
export declare enum TransformationType {
    Normalize = "normalize",
    Standardize = "standardize",
    OneHotEncode = "one_hot_encode",
    LabelEncode = "label_encode",
    BinDiscretize = "bin_discretize",
    PolynomialFeatures = "polynomial_features",
    TextVectorize = "text_vectorize"
}
export interface FeatureStatistics {
    count: number;
    missing: number;
    unique?: number;
    mean?: number;
    std?: number;
    min?: number;
    max?: number;
    percentiles?: Record<string, number>;
}
export interface Experiment {
    id: string;
    name: string;
    description?: string;
    runs: ExperimentRun[];
    bestRun?: string;
    status: ExperimentStatus;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum ExperimentStatus {
    Active = "active",
    Completed = "completed",
    Archived = "archived"
}
export interface ExperimentRun {
    id: string;
    experimentId: string;
    modelId: string;
    parameters: Record<string, any>;
    metrics: Record<string, number>;
    artifacts: string[];
    tags: string[];
    startedAt: Date;
    completedAt?: Date;
}
/**
 * ML Model Manager
 */
export declare class MLModelManager {
    private models;
    private trainingJobs;
    private predictions;
    /**
     * Register model
     */
    registerModel(model: Omit<MLModel, 'id' | 'status' | 'createdAt'>): MLModel;
    /**
     * Start training
     */
    trainModel(modelId: string, config: TrainingConfig): Promise<TrainingJob>;
    /**
     * Stop training
     */
    stopTraining(jobId: string): void;
    /**
     * Make prediction
     */
    predict(modelId: string, input: any): Promise<Prediction>;
    /**
     * Evaluate model
     */
    evaluateModel(modelId: string, testData: any[]): Promise<ModelMetrics>;
    /**
     * Deploy model
     */
    deployModel(modelId: string, environment: string): void;
    /**
     * Get model
     */
    getModel(modelId: string): MLModel | undefined;
    /**
     * List models
     */
    listModels(filter?: {
        status?: ModelStatus;
        type?: ModelType;
    }): MLModel[];
    /**
     * Get training job
     */
    getTrainingJob(jobId: string): TrainingJob | undefined;
    /**
     * List training jobs
     */
    listTrainingJobs(modelId?: string): TrainingJob[];
    /**
     * Get predictions
     */
    getPredictions(modelId?: string, limit?: number): Prediction[];
    private executeTraining;
    private executePrediction;
    private generateModelId;
    private generateJobId;
    private generatePredictionId;
}
/**
 * Feature Engineering Manager
 */
export declare class FeatureEngineeringManager {
    private featureSets;
    /**
     * Create feature set
     */
    createFeatureSet(name: string, features: Feature[], transformations?: FeatureTransformation[]): FeatureSet;
    /**
     * Transform data
     */
    transform(featureSetId: string, data: any[]): Promise<any[]>;
    /**
     * Calculate statistics
     */
    calculateStatistics(featureSetId: string, data: any[]): void;
    /**
     * Get feature set
     */
    getFeatureSet(id: string): FeatureSet | undefined;
    /**
     * List feature sets
     */
    listFeatureSets(): FeatureSet[];
    private applyTransformation;
    private normalize;
    private standardize;
    private oneHotEncode;
    private generateFeatureSetId;
}
/**
 * Experiment Tracker
 */
export declare class ExperimentTracker {
    private experiments;
    /**
     * Create experiment
     */
    createExperiment(name: string, description?: string): Experiment;
    /**
     * Log run
     */
    logRun(experimentId: string, modelId: string, parameters: Record<string, any>, metrics: Record<string, number>): ExperimentRun;
    /**
     * Compare runs
     */
    compareRuns(runIds: string[]): RunComparison;
    /**
     * Get experiment
     */
    getExperiment(id: string): Experiment | undefined;
    /**
     * List experiments
     */
    listExperiments(filter?: {
        status?: ExperimentStatus;
    }): Experiment[];
    private isBetterRun;
    private aggregateParameters;
    private aggregateMetrics;
    private generateExperimentId;
    private generateRunId;
}
export interface RunComparison {
    runs: ExperimentRun[];
    parameters: Record<string, any[]>;
    metrics: Record<string, number[]>;
}
/**
 * Singleton instances
 */
export declare const mlModelManager: MLModelManager;
export declare const featureEngineeringManager: FeatureEngineeringManager;
export declare const experimentTracker: ExperimentTracker;
//# sourceMappingURL=MLSystem.d.ts.map