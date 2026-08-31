/**
 * Machine Learning Integration System
 * ML model training, inference, feature engineering, and experiment tracking
 */

import { eventBus } from '../core/EventBus';

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

export enum ModelType {
  Classification = 'classification',
  Regression = 'regression',
  Clustering = 'clustering',
  NeuralNetwork = 'neural_network',
  ReinforcementLearning = 'reinforcement_learning',
  NLP = 'nlp',
  ComputerVision = 'computer_vision',
}

export enum MLFramework {
  TensorFlow = 'tensorflow',
  PyTorch = 'pytorch',
  ScikitLearn = 'scikit_learn',
  XGBoost = 'xgboost',
  Keras = 'keras',
  Custom = 'custom',
}

export enum ModelStatus {
  Draft = 'draft',
  Training = 'training',
  Trained = 'trained',
  Evaluating = 'evaluating',
  Deployed = 'deployed',
  Archived = 'archived',
  Failed = 'failed',
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

export enum ArtifactType {
  Weights = 'weights',
  Graph = 'graph',
  Checkpoint = 'checkpoint',
  Config = 'config',
  Vocabulary = 'vocabulary',
  Scaler = 'scaler',
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

export enum TrainingStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Stopped = 'stopped',
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

export enum CallbackType {
  EarlyStopping = 'early_stopping',
  ModelCheckpoint = 'model_checkpoint',
  ReduceLROnPlateau = 'reduce_lr_on_plateau',
  TensorBoard = 'tensorboard',
  Custom = 'custom',
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

export enum FeatureType {
  Numeric = 'numeric',
  Categorical = 'categorical',
  Text = 'text',
  DateTime = 'datetime',
  Binary = 'binary',
  Image = 'image',
}

export interface FeatureTransformation {
  type: TransformationType;
  feature: string;
  config: Record<string, any>;
}

export enum TransformationType {
  Normalize = 'normalize',
  Standardize = 'standardize',
  OneHotEncode = 'one_hot_encode',
  LabelEncode = 'label_encode',
  BinDiscretize = 'bin_discretize',
  PolynomialFeatures = 'polynomial_features',
  TextVectorize = 'text_vectorize',
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

export enum ExperimentStatus {
  Active = 'active',
  Completed = 'completed',
  Archived = 'archived',
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
export class MLModelManager {
  private models: Map<string, MLModel> = new Map();
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private predictions: Prediction[] = [];

  /**
   * Register model
   */
  registerModel(model: Omit<MLModel, 'id' | 'status' | 'createdAt'>): MLModel {
    const fullModel: MLModel = {
      ...model,
      id: this.generateModelId(),
      status: ModelStatus.Draft,
      createdAt: new Date(),
    };

    this.models.set(fullModel.id, fullModel);

    eventBus.emitSync('ml.model_registered', fullModel, 'MLModelManager');

    return fullModel;
  }

  /**
   * Start training
   */
  async trainModel(modelId: string, config: TrainingConfig): Promise<TrainingJob> {
    const model = this.models.get(modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const job: TrainingJob = {
      id: this.generateJobId(),
      modelId,
      config,
      status: TrainingStatus.Running,
      progress: {
        currentEpoch: 0,
        totalEpochs: config.epochs,
        currentBatch: 0,
        totalBatches: 0,
        percentage: 0,
      },
      epochs: [],
      startedAt: new Date(),
    };

    this.trainingJobs.set(job.id, job);
    model.status = ModelStatus.Training;

    eventBus.emitSync('ml.training_started', job, 'MLModelManager');

    // Run training asynchronously
    this.executeTraining(job, model);

    return job;
  }

  /**
   * Stop training
   */
  stopTraining(jobId: string): void {
    const job = this.trainingJobs.get(jobId);

    if (job && job.status === TrainingStatus.Running) {
      job.status = TrainingStatus.Stopped;
      job.completedAt = new Date();

      eventBus.emitSync('ml.training_stopped', job, 'MLModelManager');
    }
  }

  /**
   * Make prediction
   */
  async predict(modelId: string, input: any): Promise<Prediction> {
    const model = this.models.get(modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status !== ModelStatus.Trained && model.status !== ModelStatus.Deployed) {
      throw new Error(`Model is not ready for inference: ${model.status}`);
    }

    const startTime = Date.now();

    // Mock prediction
    const output = this.executePrediction(model, input);

    const prediction: Prediction = {
      id: this.generatePredictionId(),
      modelId,
      input,
      output,
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };

    this.predictions.push(prediction);

    eventBus.emitSync('ml.prediction_made', prediction, 'MLModelManager');

    return prediction;
  }

  /**
   * Evaluate model
   */
  async evaluateModel(modelId: string, testData: any[]): Promise<ModelMetrics> {
    const model = this.models.get(modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    model.status = ModelStatus.Evaluating;

    // Mock evaluation
    const metrics: ModelMetrics = {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      f1Score: 0.85,
    };

    model.metrics = metrics;
    model.status = ModelStatus.Trained;

    eventBus.emitSync('ml.model_evaluated', { modelId, metrics }, 'MLModelManager');

    return metrics;
  }

  /**
   * Deploy model
   */
  deployModel(modelId: string, environment: string): void {
    const model = this.models.get(modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    model.status = ModelStatus.Deployed;

    eventBus.emitSync('ml.model_deployed', { modelId, environment }, 'MLModelManager');
  }

  /**
   * Get model
   */
  getModel(modelId: string): MLModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * List models
   */
  listModels(filter?: { status?: ModelStatus; type?: ModelType }): MLModel[] {
    let models = Array.from(this.models.values());

    if (filter?.status) {
      models = models.filter(m => m.status === filter.status);
    }

    if (filter?.type) {
      models = models.filter(m => m.type === filter.type);
    }

    return models;
  }

  /**
   * Get training job
   */
  getTrainingJob(jobId: string): TrainingJob | undefined {
    return this.trainingJobs.get(jobId);
  }

  /**
   * List training jobs
   */
  listTrainingJobs(modelId?: string): TrainingJob[] {
    let jobs = Array.from(this.trainingJobs.values());

    if (modelId) {
      jobs = jobs.filter(j => j.modelId === modelId);
    }

    return jobs;
  }

  /**
   * Get predictions
   */
  getPredictions(modelId?: string, limit: number = 100): Prediction[] {
    let predictions = [...this.predictions];

    if (modelId) {
      predictions = predictions.filter(p => p.modelId === modelId);
    }

    return predictions.slice(-limit);
  }

  private async executeTraining(job: TrainingJob, model: MLModel): Promise<void> {
    try {
      for (let epoch = 1; epoch <= job.config.epochs; epoch++) {
        if (job.status !== TrainingStatus.Running) {
          break;
        }

        const epochStart = Date.now();

        // Mock training epoch
        await new Promise(resolve => setTimeout(resolve, 100));

        const epochResult: EpochResult = {
          epoch,
          loss: 1.0 - (epoch / job.config.epochs) * 0.7,
          accuracy: 0.5 + (epoch / job.config.epochs) * 0.4,
          valLoss: 1.0 - (epoch / job.config.epochs) * 0.6,
          valAccuracy: 0.5 + (epoch / job.config.epochs) * 0.35,
          metrics: {},
          duration: Date.now() - epochStart,
          timestamp: new Date(),
        };

        job.epochs.push(epochResult);
        job.progress.currentEpoch = epoch;
        job.progress.percentage = (epoch / job.config.epochs) * 100;

        eventBus.emitSync('ml.epoch_completed', { jobId: job.id, epochResult }, 'MLModelManager');

        // Check early stopping
        if (job.config.earlyStoppingPatience) {
          const recentEpochs = job.epochs.slice(-job.config.earlyStoppingPatience);

          if (recentEpochs.length === job.config.earlyStoppingPatience) {
            const improving = recentEpochs.every((e, i) =>
              i === 0 || e.valLoss! < recentEpochs[i - 1].valLoss!
            );

            if (!improving) {
              job.status = TrainingStatus.Stopped;
              break;
            }
          }
        }
      }

      if (job.status === TrainingStatus.Running) {
        job.status = TrainingStatus.Completed;
      }

      job.completedAt = new Date();
      model.status = ModelStatus.Trained;
      model.trainedAt = new Date();

      eventBus.emitSync('ml.training_completed', job, 'MLModelManager');
    } catch (error) {
      job.status = TrainingStatus.Failed;
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      model.status = ModelStatus.Failed;

      eventBus.emitSync('ml.training_failed', job, 'MLModelManager');
    }
  }

  private executePrediction(model: MLModel, input: any): any {
    // Mock prediction based on model type
    switch (model.type) {
      case ModelType.Classification:
        return {
          class: 'positive',
          confidence: 0.85,
          probabilities: {
            positive: 0.85,
            negative: 0.15,
          },
        };

      case ModelType.Regression:
        return {
          value: 42.5,
          confidence: 0.92,
        };

      default:
        return { result: 'unknown' };
    }
  }

  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generatePredictionId(): string {
    return `pred_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Feature Engineering Manager
 */
export class FeatureEngineeringManager {
  private featureSets: Map<string, FeatureSet> = new Map();

  /**
   * Create feature set
   */
  createFeatureSet(
    name: string,
    features: Feature[],
    transformations: FeatureTransformation[] = []
  ): FeatureSet {
    const featureSet: FeatureSet = {
      id: this.generateFeatureSetId(),
      name,
      features,
      transformations,
      statistics: {
        count: 0,
        missing: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.featureSets.set(featureSet.id, featureSet);

    eventBus.emitSync('ml.feature_set_created', featureSet, 'FeatureEngineeringManager');

    return featureSet;
  }

  /**
   * Transform data
   */
  async transform(featureSetId: string, data: any[]): Promise<any[]> {
    const featureSet = this.featureSets.get(featureSetId);

    if (!featureSet) {
      throw new Error(`Feature set not found: ${featureSetId}`);
    }

    let transformed = data;

    for (const transformation of featureSet.transformations) {
      transformed = this.applyTransformation(transformation, transformed);
    }

    return transformed;
  }

  /**
   * Calculate statistics
   */
  calculateStatistics(featureSetId: string, data: any[]): void {
    const featureSet = this.featureSets.get(featureSetId);

    if (!featureSet) {
      throw new Error(`Feature set not found: ${featureSetId}`);
    }

    for (const feature of featureSet.features) {
      const values = data.map(d => d[feature.name]).filter(v => v !== null && v !== undefined);

      if (feature.type === FeatureType.Numeric) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

        feature.description = `Mean: ${mean.toFixed(2)}, Std: ${Math.sqrt(variance).toFixed(2)}`;
      }
    }

    featureSet.statistics.count = data.length;
    featureSet.statistics.missing = data.length - data.filter(d => d !== null).length;
    featureSet.updatedAt = new Date();
  }

  /**
   * Get feature set
   */
  getFeatureSet(id: string): FeatureSet | undefined {
    return this.featureSets.get(id);
  }

  /**
   * List feature sets
   */
  listFeatureSets(): FeatureSet[] {
    return Array.from(this.featureSets.values());
  }

  private applyTransformation(transformation: FeatureTransformation, data: any[]): any[] {
    switch (transformation.type) {
      case TransformationType.Normalize:
        return this.normalize(data, transformation.feature);

      case TransformationType.Standardize:
        return this.standardize(data, transformation.feature);

      case TransformationType.OneHotEncode:
        return this.oneHotEncode(data, transformation.feature);

      default:
        return data;
    }
  }

  private normalize(data: any[], feature: string): any[] {
    const values = data.map(d => d[feature]);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return data.map(d => ({
      ...d,
      [feature]: (d[feature] - min) / (max - min),
    }));
  }

  private standardize(data: any[], feature: string): any[] {
    const values = data.map(d => d[feature]);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

    return data.map(d => ({
      ...d,
      [feature]: (d[feature] - mean) / std,
    }));
  }

  private oneHotEncode(data: any[], feature: string): any[] {
    const uniqueValues = [...new Set(data.map(d => d[feature]))];

    return data.map(d => {
      const encoded: any = { ...d };

      for (const value of uniqueValues) {
        encoded[`${feature}_${value}`] = d[feature] === value ? 1 : 0;
      }

      return encoded;
    });
  }

  private generateFeatureSetId(): string {
    return `features_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Experiment Tracker
 */
export class ExperimentTracker {
  private experiments: Map<string, Experiment> = new Map();

  /**
   * Create experiment
   */
  createExperiment(name: string, description?: string): Experiment {
    const experiment: Experiment = {
      id: this.generateExperimentId(),
      name,
      description,
      runs: [],
      status: ExperimentStatus.Active,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.experiments.set(experiment.id, experiment);

    eventBus.emitSync('ml.experiment_created', experiment, 'ExperimentTracker');

    return experiment;
  }

  /**
   * Log run
   */
  logRun(
    experimentId: string,
    modelId: string,
    parameters: Record<string, any>,
    metrics: Record<string, number>
  ): ExperimentRun {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    const run: ExperimentRun = {
      id: this.generateRunId(),
      experimentId,
      modelId,
      parameters,
      metrics,
      artifacts: [],
      tags: [],
      startedAt: new Date(),
      completedAt: new Date(),
    };

    experiment.runs.push(run);
    experiment.updatedAt = new Date();

    // Update best run
    if (!experiment.bestRun || this.isBetterRun(run, experiment.runs.find(r => r.id === experiment.bestRun)!)) {
      experiment.bestRun = run.id;
    }

    eventBus.emitSync('ml.run_logged', run, 'ExperimentTracker');

    return run;
  }

  /**
   * Compare runs
   */
  compareRuns(runIds: string[]): RunComparison {
    const runs: ExperimentRun[] = [];

    for (const experiment of this.experiments.values()) {
      for (const run of experiment.runs) {
        if (runIds.includes(run.id)) {
          runs.push(run);
        }
      }
    }

    return {
      runs,
      parameters: this.aggregateParameters(runs),
      metrics: this.aggregateMetrics(runs),
    };
  }

  /**
   * Get experiment
   */
  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  /**
   * List experiments
   */
  listExperiments(filter?: { status?: ExperimentStatus }): Experiment[] {
    let experiments = Array.from(this.experiments.values());

    if (filter?.status) {
      experiments = experiments.filter(e => e.status === filter.status);
    }

    return experiments;
  }

  private isBetterRun(run1: ExperimentRun, run2: ExperimentRun): boolean {
    // Simple comparison based on first metric
    const metric1 = Object.values(run1.metrics)[0] || 0;
    const metric2 = Object.values(run2.metrics)[0] || 0;

    return metric1 > metric2;
  }

  private aggregateParameters(runs: ExperimentRun[]): Record<string, any[]> {
    const parameters: Record<string, any[]> = {};

    for (const run of runs) {
      for (const [key, value] of Object.entries(run.parameters)) {
        if (!parameters[key]) {
          parameters[key] = [];
        }

        parameters[key].push(value);
      }
    }

    return parameters;
  }

  private aggregateMetrics(runs: ExperimentRun[]): Record<string, number[]> {
    const metrics: Record<string, number[]> = {};

    for (const run of runs) {
      for (const [key, value] of Object.entries(run.metrics)) {
        if (!metrics[key]) {
          metrics[key] = [];
        }

        metrics[key].push(value);
      }
    }

    return metrics;
  }

  private generateExperimentId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

export interface RunComparison {
  runs: ExperimentRun[];
  parameters: Record<string, any[]>;
  metrics: Record<string, number[]>;
}

/**
 * Singleton instances
 */
export const mlModelManager = new MLModelManager();
export const featureEngineeringManager = new FeatureEngineeringManager();
export const experimentTracker = new ExperimentTracker();
