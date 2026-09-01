/**
 * FineTuning - Model fine-tuning pipelines and training management
 * Handles dataset preparation, training jobs, and evaluation
 */
import { EventEmitter } from 'events';
export interface FineTuningJob {
    id: string;
    modelId: string;
    datasetId: string;
    config: TrainingConfig;
    status: 'pending' | 'preparing' | 'training' | 'completed' | 'failed';
    progress: TrainingProgress;
    metrics: TrainingMetrics;
    startTime?: Date;
    endTime?: Date;
    error?: string;
}
export interface TrainingConfig {
    epochs: number;
    batchSize: number;
    learningRate: number;
    warmupSteps: number;
    evaluationSteps: number;
    saveSteps: number;
    maxSteps?: number;
    gradientAccumulation: number;
    optimizer: 'adam' | 'sgd' | 'adamw';
    lrScheduler: 'linear' | 'cosine' | 'polynomial';
}
export interface TrainingProgress {
    currentEpoch: number;
    currentStep: number;
    totalSteps: number;
    percentComplete: number;
    estimatedTimeRemaining?: number;
}
export interface TrainingMetrics {
    loss: number[];
    accuracy: number[];
    validationLoss: number[];
    validationAccuracy: number[];
    learningRates: number[];
    perplexity?: number[];
}
export interface Dataset {
    id: string;
    name: string;
    size: number;
    examples: DataExample[];
    splits: DataSplits;
    metadata: DatasetMetadata;
}
export interface DataExample {
    id: string;
    input: string;
    output: string;
    metadata?: any;
}
export interface DataSplits {
    train: number;
    validation: number;
    test: number;
}
export interface DatasetMetadata {
    createdAt: Date;
    format: string;
    version: string;
    description: string;
}
export interface EvaluationResult {
    jobId: string;
    metrics: {
        accuracy: number;
        loss: number;
        perplexity: number;
        bleu?: number;
        rouge?: number;
    };
    confusionMatrix?: number[][];
    examples: EvaluationExample[];
}
export interface EvaluationExample {
    input: string;
    expected: string;
    predicted: string;
    correct: boolean;
    confidence: number;
}
export declare class FineTuningManager extends EventEmitter {
    private jobs;
    private datasets;
    private checkpoints;
    constructor();
    createJob(modelId: string, datasetId: string, config: Partial<TrainingConfig>): string;
    startTraining(jobId: string): Promise<void>;
    private prepareDataset;
    private runTraining;
    private trainingStep;
    private calculateLearningRate;
    private evaluate;
    private saveCheckpoint;
    evaluateModel(jobId: string, testDataset: Dataset): Promise<EvaluationResult>;
    private predict;
    registerDataset(dataset: Dataset): void;
    getJobStatus(jobId: string): any;
    getTrainingMetrics(jobId: string): TrainingMetrics | null;
    stopTraining(jobId: string): void;
}
export default FineTuningManager;
//# sourceMappingURL=FineTuning.d.ts.map