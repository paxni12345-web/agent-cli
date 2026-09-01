/**
 * AI Model Management System
 * Model fine-tuning, training pipeline, versioning, and A/B testing
 */
export interface AIModel {
    id: string;
    name: string;
    version: string;
    type: 'gpt' | 'claude' | 'gemini' | 'custom';
    provider: string;
    status: 'training' | 'ready' | 'deploying' | 'deprecated';
    size: number;
    parameters: ModelParameters;
    metrics: ModelMetrics;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}
export interface ModelParameters {
    temperature: number;
    maxTokens: number;
    topP: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
}
export interface ModelMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    perplexity?: number;
    latency?: number;
    throughput?: number;
    errorRate?: number;
}
export interface TrainingJob {
    id: string;
    modelId: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    config: TrainingConfig;
    dataset: Dataset;
    progress: number;
    epoch: number;
    totalEpochs: number;
    loss?: number;
    validationLoss?: number;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    checkpoints: Checkpoint[];
}
export interface TrainingConfig {
    learningRate: number;
    batchSize: number;
    epochs: number;
    optimizer: 'adam' | 'sgd' | 'rmsprop';
    lossFunction: string;
    validationSplit: number;
    earlyStoppingPatience?: number;
    checkpointInterval?: number;
}
export interface Dataset {
    id: string;
    name: string;
    type: 'text' | 'code' | 'conversation' | 'custom';
    size: number;
    samples: number;
    splits: {
        train: number;
        validation: number;
        test: number;
    };
    format: 'json' | 'jsonl' | 'csv' | 'parquet';
    path: string;
}
export interface Checkpoint {
    id: string;
    epoch: number;
    step: number;
    loss: number;
    validationLoss: number;
    metrics: ModelMetrics;
    path: string;
    timestamp: Date;
}
export interface ModelVersion {
    id: string;
    modelId: string;
    version: string;
    status: 'active' | 'deprecated' | 'archived';
    trainingJobId?: string;
    performance: ModelMetrics;
    deployments: Deployment[];
    createdAt: Date;
}
export interface Deployment {
    id: string;
    modelVersionId: string;
    environment: 'development' | 'staging' | 'production';
    status: 'deploying' | 'active' | 'inactive' | 'failed';
    endpoint?: string;
    traffic: number;
    deployedAt?: Date;
    undeployedAt?: Date;
}
export interface ABTest {
    id: string;
    name: string;
    status: 'draft' | 'running' | 'completed' | 'cancelled';
    variants: ABTestVariant[];
    metrics: string[];
    startedAt?: Date;
    endedAt?: Date;
    winner?: string;
    results?: ABTestResults;
}
export interface ABTestVariant {
    id: string;
    name: string;
    modelVersionId: string;
    traffic: number;
    requests: number;
    metrics: Record<string, number>;
}
export interface ABTestResults {
    winner: string;
    confidence: number;
    improvement: number;
    variantResults: Map<string, VariantResult>;
}
export interface VariantResult {
    requests: number;
    metrics: Record<string, number>;
    statisticalSignificance: number;
}
export interface FineTuningJob {
    id: string;
    baseModelId: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    dataset: Dataset;
    hyperparameters: FineTuningHyperparameters;
    progress: number;
    resultingModelId?: string;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}
export interface FineTuningHyperparameters {
    nEpochs: number;
    batchSize: number;
    learningRateMultiplier: number;
    promptLossWeight?: number;
    computeClassificationMetrics?: boolean;
}
/**
 * Model Manager
 */
export declare class ModelManager {
    private models;
    private versions;
    /**
     * Register model
     */
    registerModel(model: Omit<AIModel, 'id' | 'createdAt' | 'updatedAt'>): AIModel;
    /**
     * Get model
     */
    getModel(modelId: string): AIModel | undefined;
    /**
     * List models
     */
    listModels(filter?: {
        type?: AIModel['type'];
        status?: AIModel['status'];
        provider?: string;
    }): AIModel[];
    /**
     * Update model
     */
    updateModel(modelId: string, updates: Partial<AIModel>): AIModel;
    /**
     * Delete model
     */
    deleteModel(modelId: string): void;
    /**
     * Create model version
     */
    createVersion(modelId: string, version: Omit<ModelVersion, 'id' | 'createdAt'>): ModelVersion;
    /**
     * Get model versions
     */
    getVersions(modelId: string): ModelVersion[];
    /**
     * Get active version
     */
    getActiveVersion(modelId: string): ModelVersion | undefined;
    /**
     * Compare models
     */
    compareModels(modelIds: string[]): ModelComparison;
    private compareMetrics;
    private compareParameters;
    private generateModelId;
    private generateVersionId;
}
interface ModelComparison {
    models: AIModel[];
    metrics: Record<string, number[]>;
    parameters: Record<string, any[]>;
}
/**
 * Training Manager
 */
export declare class TrainingManager {
    private jobs;
    /**
     * Start training job
     */
    startTraining(modelId: string, name: string, config: TrainingConfig, dataset: Dataset): Promise<TrainingJob>;
    /**
     * Stop training job
     */
    stopTraining(jobId: string): void;
    /**
     * Get training job
     */
    getJob(jobId: string): TrainingJob | undefined;
    /**
     * List training jobs
     */
    listJobs(filter?: {
        modelId?: string;
        status?: TrainingJob['status'];
    }): TrainingJob[];
    /**
     * Run training (mock implementation)
     */
    private runTraining;
    private generateJobId;
    private generateCheckpointId;
}
/**
 * Fine-Tuning Manager
 */
export declare class FineTuningManager {
    private jobs;
    /**
     * Start fine-tuning
     */
    startFineTuning(baseModelId: string, name: string, dataset: Dataset, hyperparameters: FineTuningHyperparameters): Promise<FineTuningJob>;
    /**
     * Get fine-tuning job
     */
    getJob(jobId: string): FineTuningJob | undefined;
    /**
     * List fine-tuning jobs
     */
    listJobs(filter?: {
        baseModelId?: string;
        status?: FineTuningJob['status'];
    }): FineTuningJob[];
    /**
     * Run fine-tuning (mock implementation)
     */
    private runFineTuning;
    private generateJobId;
}
/**
 * Deployment Manager
 */
export declare class DeploymentManager {
    private deployments;
    /**
     * Deploy model version
     */
    deploy(modelVersionId: string, environment: Deployment['environment'], traffic?: number): Promise<Deployment>;
    /**
     * Undeploy model
     */
    undeploy(deploymentId: string): Promise<void>;
    /**
     * Update traffic split
     */
    updateTraffic(deploymentId: string, traffic: number): void;
    /**
     * Get deployment
     */
    getDeployment(deploymentId: string): Deployment | undefined;
    /**
     * List deployments
     */
    listDeployments(filter?: {
        environment?: Deployment['environment'];
        status?: Deployment['status'];
    }): Deployment[];
    private generateDeploymentId;
}
/**
 * A/B Test Manager
 */
export declare class ABTestManager {
    private tests;
    /**
     * Create A/B test
     */
    createTest(name: string, variants: Omit<ABTestVariant, 'id' | 'requests' | 'metrics'>[], metrics: string[]): ABTest;
    /**
     * Start A/B test
     */
    startTest(testId: string): void;
    /**
     * Record test result
     */
    recordResult(testId: string, variantId: string, metrics: Record<string, number>): void;
    /**
     * Stop test and analyze results
     */
    stopTest(testId: string): ABTest;
    /**
     * Get test
     */
    getTest(testId: string): ABTest | undefined;
    /**
     * List tests
     */
    listTests(filter?: {
        status?: ABTest['status'];
    }): ABTest[];
    /**
     * Analyze test results
     */
    private analyzeResults;
    private calculateScore;
    private generateTestId;
    private generateVariantId;
}
/**
 * Singleton instances
 */
export declare const modelManager: ModelManager;
export declare const trainingManager: TrainingManager;
export declare const fineTuningManager: FineTuningManager;
export declare const deploymentManager: DeploymentManager;
export declare const abTestManager: ABTestManager;
export {};
//# sourceMappingURL=ModelManagement.d.ts.map