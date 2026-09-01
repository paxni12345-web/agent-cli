/**
 * MEGA AI MODEL FINETUNING SYSTEM
 * Custom model training, hyperparameter optimization, and model management
 * Lines: 1200+
 */
import { EventEmitter } from 'events';
export interface ModelConfig {
    id: string;
    name: string;
    baseModel: string;
    architecture: ModelArchitecture;
    parameters: ModelParameters;
    hyperparameters: Hyperparameters;
    metadata: ModelMetadata;
}
export interface ModelArchitecture {
    type: 'transformer' | 'lstm' | 'cnn' | 'hybrid';
    layers: LayerConfig[];
    inputShape: number[];
    outputShape: number[];
}
export interface LayerConfig {
    type: string;
    units?: number;
    activation?: string;
    dropout?: number;
    config: Record<string, any>;
}
export interface ModelParameters {
    totalParams: number;
    trainableParams: number;
    nonTrainableParams: number;
    modelSize: number;
}
export interface Hyperparameters {
    learningRate: number;
    batchSize: number;
    epochs: number;
    optimizer: OptimizerConfig;
    lossFunction: string;
    metrics: string[];
    regularization?: RegularizationConfig;
}
export interface OptimizerConfig {
    type: 'adam' | 'sgd' | 'rmsprop' | 'adamw';
    momentum?: number;
    beta1?: number;
    beta2?: number;
    epsilon?: number;
    weightDecay?: number;
}
export interface RegularizationConfig {
    l1?: number;
    l2?: number;
    dropout?: number;
    batchNorm?: boolean;
}
export interface ModelMetadata {
    created: Date;
    lastModified: Date;
    version: string;
    author: string;
    description: string;
    tags: string[];
    performance: PerformanceMetrics;
}
export interface PerformanceMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    loss: number;
    validationLoss: number;
}
export interface TrainingDataset {
    id: string;
    name: string;
    type: 'classification' | 'regression' | 'generation' | 'embedding';
    samples: DataSample[];
    split: DatasetSplit;
    preprocessing: PreprocessingConfig;
    augmentation?: AugmentationConfig;
}
export interface DataSample {
    id: string;
    input: any;
    output: any;
    metadata?: Record<string, any>;
}
export interface DatasetSplit {
    train: number;
    validation: number;
    test: number;
}
export interface PreprocessingConfig {
    normalization?: {
        method: 'minmax' | 'zscore' | 'robust';
        params?: Record<string, any>;
    };
    tokenization?: {
        method: 'wordpiece' | 'bpe' | 'char';
        vocabSize: number;
    };
    padding?: {
        maxLength: number;
        strategy: 'pre' | 'post';
    };
}
export interface AugmentationConfig {
    enabled: boolean;
    methods: AugmentationMethod[];
    probability: number;
}
export interface AugmentationMethod {
    type: string;
    params: Record<string, any>;
}
export interface TrainingJob {
    id: string;
    modelId: string;
    datasetId: string;
    status: TrainingStatus;
    progress: TrainingProgress;
    config: TrainingConfig;
    results?: TrainingResults;
    startTime?: Date;
    endTime?: Date;
}
export type TrainingStatus = 'queued' | 'initializing' | 'training' | 'validating' | 'completed' | 'failed' | 'cancelled';
export interface TrainingProgress {
    currentEpoch: number;
    totalEpochs: number;
    currentBatch: number;
    totalBatches: number;
    timeElapsed: number;
    timeRemaining: number;
    currentMetrics: Record<string, number>;
}
export interface TrainingConfig {
    checkpointInterval: number;
    earlyStoppingConfig?: EarlyStoppingConfig;
    learningRateSchedule?: LearningRateSchedule;
    mixedPrecision: boolean;
    distributedTraining?: DistributedConfig;
}
export interface EarlyStoppingConfig {
    enabled: boolean;
    patience: number;
    metric: string;
    minDelta: number;
}
export interface LearningRateSchedule {
    type: 'constant' | 'step' | 'exponential' | 'cosine' | 'plateau';
    params: Record<string, any>;
}
export interface DistributedConfig {
    enabled: boolean;
    strategy: 'data_parallel' | 'model_parallel' | 'pipeline';
    numWorkers: number;
}
export interface TrainingResults {
    finalMetrics: PerformanceMetrics;
    trainingHistory: EpochHistory[];
    bestCheckpoint: string;
    totalTime: number;
    resourceUsage: ResourceUsage;
}
export interface EpochHistory {
    epoch: number;
    trainLoss: number;
    validationLoss: number;
    metrics: Record<string, number>;
    learningRate: number;
    duration: number;
}
export interface ResourceUsage {
    peakMemory: number;
    averageGPUUtil: number;
    totalComputeTime: number;
}
export interface HyperparameterSearch {
    id: string;
    method: SearchMethod;
    searchSpace: SearchSpace;
    objective: OptimizationObjective;
    config: SearchConfig;
    results: SearchResult[];
    bestConfig?: Hyperparameters;
}
export type SearchMethod = 'grid' | 'random' | 'bayesian' | 'evolutionary' | 'hyperband';
export interface SearchSpace {
    parameters: ParameterRange[];
}
export interface ParameterRange {
    name: string;
    type: 'int' | 'float' | 'categorical';
    min?: number;
    max?: number;
    values?: any[];
    distribution?: 'uniform' | 'log_uniform' | 'normal';
}
export interface OptimizationObjective {
    metric: string;
    direction: 'minimize' | 'maximize';
}
export interface SearchConfig {
    maxTrials: number;
    timeout?: number;
    parallelTrials: number;
    earlyStoppingEnabled: boolean;
}
export interface SearchResult {
    trialId: string;
    hyperparameters: Hyperparameters;
    score: number;
    metrics: Record<string, number>;
    duration: number;
}
export declare class HyperparameterOptimizer {
    private search;
    private completedTrials;
    constructor(search: HyperparameterSearch);
    optimize(): Promise<Hyperparameters>;
    private gridSearch;
    private randomSearch;
    private bayesianOptimization;
    private evolutionarySearch;
    private hyperbandSearch;
    private generateGridCombinations;
    private sampleRandomConfiguration;
    private evaluateConfiguration;
    private acquireNextPoint;
    private initializePopulation;
    private selectParents;
    private evolvePopulation;
    private crossover;
    private mutate;
    private getBestConfiguration;
}
export declare class ModelRegistry extends EventEmitter {
    private models;
    private checkpoints;
    registerModel(model: ModelConfig): void;
    getModel(modelId: string): ModelConfig | undefined;
    listModels(): ModelConfig[];
    saveCheckpoint(modelId: string, checkpoint: Checkpoint): void;
    getCheckpoints(modelId: string): Checkpoint[];
    loadCheckpoint(modelId: string, checkpointId: string): Checkpoint | undefined;
}
export interface Checkpoint {
    id: string;
    modelId: string;
    epoch: number;
    metrics: PerformanceMetrics;
    timestamp: Date;
    path: string;
    size: number;
}
export declare class FineTuningEngine extends EventEmitter {
    private registry;
    private activeJobs;
    constructor();
    startFineTuning(baseModel: string, dataset: TrainingDataset, config: TrainingConfig): Promise<string>;
    private executeTraining;
    private trainEpoch;
    private validateEpoch;
    private saveCheckpoint;
    private shouldStopEarly;
    private findBestCheckpoint;
    getJob(jobId: string): TrainingJob | undefined;
    cancelJob(jobId: string): void;
    private generateJobId;
}
export default FineTuningEngine;
//# sourceMappingURL=MEGA_AIModelFinetuning.d.ts.map