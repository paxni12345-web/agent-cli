/**
 * Advanced Machine Learning Integration System
 * Model training, inference, feature engineering, hyperparameter tuning
 * Model versioning, A/B testing, drift detection
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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
  psi?: number; // Population Stability Index
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

// ============================================================================
// ML Manager
// ============================================================================

export class MLManager extends EventEmitter {
  private config: MLConfig;
  private models: Map<string, Model> = new Map();
  private datasets: Map<string, Dataset> = new Map();
  private trainingJobs: Map<string, TrainingJob> = new Map();
  private experiments: Map<string, ModelExperiment> = new Map();
  private driftDetectors: Map<string, DriftDetection> = new Map();
  private featureStores: Map<string, FeatureStore> = new Map();
  private monitoring: Map<string, ModelMonitoring> = new Map();
  private predictionCache: Map<string, PredictionResult> = new Map();

  constructor(config: Partial<MLConfig> = {}) {
    super();
    this.config = {
      modelRegistry: './models',
      enableAutoML: false,
      enableModelVersioning: true,
      enableDriftDetection: true,
      inferenceTimeout: 30000,
      maxConcurrentInferences: 10,
      cachePredictions: true,
      ...config,
    };
  }

  // ========================================================================
  // Model Management
  // ========================================================================

  public registerModel(model: Omit<Model, 'id' | 'status' | 'metadata'>): Model {
    const full: Model = {
      ...model,
      id: this.generateId(),
      status: 'draft',
      metadata: {
        author: 'system',
        description: model.metadata?.description || '',
        tags: model.metadata?.tags || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    this.models.set(full.id, full);
    this.emit('model:registered', { model: full });

    return full;
  }

  public getModel(modelId: string, version?: string): Model | undefined {
    if (!version) {
      return this.models.get(modelId);
    }

    // Find specific version
    return Array.from(this.models.values()).find(
      m => m.name === this.models.get(modelId)?.name && m.version === version
    );
  }

  public listModels(filter?: ModelFilter): Model[] {
    let models = Array.from(this.models.values());

    if (filter) {
      if (filter.type) {
        models = models.filter(m => m.type === filter.type);
      }

      if (filter.status) {
        models = models.filter(m => m.status === filter.status);
      }

      if (filter.framework) {
        models = models.filter(m => m.framework === filter.framework);
      }

      if (filter.tags && filter.tags.length > 0) {
        models = models.filter(m =>
          filter.tags!.some(t => m.metadata.tags.includes(t))
        );
      }
    }

    return models;
  }

  // ========================================================================
  // Model Training
  // ========================================================================

  public async trainModel(modelId: string): Promise<TrainingJob> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const job: TrainingJob = {
      id: this.generateId(),
      modelId,
      status: 'running',
      progress: 0,
      startedAt: Date.now(),
      totalEpochs: model.trainingConfig.epochs,
      trainingMetrics: {
        epochMetrics: [],
      },
    };

    this.trainingJobs.set(job.id, job);
    model.status = 'training';

    this.emit('training:started', { model, job });

    // Simulate training
    this.simulateTraining(job, model);

    return job;
  }

  private async simulateTraining(job: TrainingJob, model: Model): Promise<void> {
    const epochs = model.trainingConfig.epochs;

    for (let epoch = 1; epoch <= epochs; epoch++) {
      job.currentEpoch = epoch;
      job.progress = (epoch / epochs) * 100;

      const epochMetrics: EpochMetrics = {
        epoch,
        loss: 1.0 - (epoch / epochs) * 0.8 + Math.random() * 0.1,
        valLoss: 1.0 - (epoch / epochs) * 0.7 + Math.random() * 0.15,
        metrics: {
          accuracy: 0.5 + (epoch / epochs) * 0.45 + Math.random() * 0.05,
          f1Score: 0.4 + (epoch / epochs) * 0.5 + Math.random() * 0.1,
        },
        duration: 1000 + Math.random() * 500,
      };

      job.trainingMetrics.epochMetrics.push(epochMetrics);

      this.emit('training:epoch', { job, epochMetrics });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    job.status = 'completed';
    job.completedAt = Date.now();
    job.duration = job.completedAt - job.startedAt;

    // Update model metrics
    const finalMetrics = job.trainingMetrics.epochMetrics[epochs - 1];
    model.metrics = {
      accuracy: finalMetrics.metrics.accuracy,
      f1Score: finalMetrics.metrics.f1Score,
    };

    model.status = 'trained';
    model.metadata.trainedAt = Date.now();
    model.metadata.trainingDuration = job.duration;

    this.emit('training:completed', { model, job });
  }

  public async cancelTraining(jobId: string): Promise<void> {
    const job = this.trainingJobs.get(jobId);
    if (!job) {
      throw new Error(`Training job not found: ${jobId}`);
    }

    job.status = 'cancelled';
    job.completedAt = Date.now();
    job.duration = job.completedAt - job.startedAt;

    const model = this.models.get(job.modelId);
    if (model) {
      model.status = 'draft';
    }

    this.emit('training:cancelled', { job });
  }

  // ========================================================================
  // Model Inference
  // ========================================================================

  public async predict(request: PredictionRequest): Promise<PredictionResult> {
    const startTime = Date.now();

    // Check cache
    if (this.config.cachePredictions) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.predictionCache.get(cacheKey);

      if (cached) {
        this.emit('prediction:cache_hit', { request });
        return { ...cached, timestamp: Date.now() };
      }
    }

    const model = this.getModel(request.modelId, request.modelVersion);
    if (!model) {
      throw new Error(`Model not found: ${request.modelId}`);
    }

    if (model.status !== 'trained' && model.status !== 'deployed') {
      throw new Error(`Model not ready for inference: ${model.status}`);
    }

    this.emit('prediction:start', { request, model });

    // Simulate prediction
    const prediction = await this.performInference(model, request);

    const result: PredictionResult = {
      prediction,
      confidence: 0.85 + Math.random() * 0.1,
      modelVersion: model.version,
      timestamp: Date.now(),
      latency: Date.now() - startTime,
    };

    // Add probabilities for classification
    if (model.type === 'classification') {
      result.probabilities = {
        class_0: Math.random(),
        class_1: Math.random(),
      };
    }

    // Add explanation if requested
    if (request.options?.explainability) {
      result.explanation = this.generateExplanation(model, request);
    }

    // Cache result
    if (this.config.cachePredictions) {
      const cacheKey = this.getCacheKey(request);
      this.predictionCache.set(cacheKey, result);
    }

    // Update monitoring
    this.updateMonitoring(model.id, result);

    this.emit('prediction:complete', { request, result });

    return result;
  }

  private async performInference(model: Model, request: PredictionRequest): Promise<any> {
    // Simulate inference based on model type
    switch (model.type) {
      case 'classification':
        return Math.random() > 0.5 ? 'class_1' : 'class_0';

      case 'regression':
        return Math.random() * 100;

      case 'clustering':
        return Math.floor(Math.random() * 5);

      default:
        return null;
    }
  }

  private generateExplanation(model: Model, request: PredictionRequest): Explanation {
    const featureImportance: Record<string, number> = {};

    for (const feature of model.features) {
      featureImportance[feature.name] = Math.random();
    }

    return {
      featureImportance,
    };
  }

  private getCacheKey(request: PredictionRequest): string {
    return `${request.modelId}:${JSON.stringify(request.input)}`;
  }

  // ========================================================================
  // Hyperparameter Tuning
  // ========================================================================

  public async tuneHyperparameters(
    modelType: string,
    searchSpace: SearchSpace,
    config: Partial<HyperparameterTuning>
  ): Promise<HyperparameterTuning> {
    const tuning: HyperparameterTuning = {
      id: this.generateId(),
      modelType,
      searchSpace,
      strategy: config.strategy || 'random_search',
      objective: config.objective || 'accuracy',
      trials: [],
      status: 'running',
    };

    this.emit('tuning:started', { tuning });

    // Generate trials based on strategy
    const trials = this.generateTrials(tuning);

    for (const trial of trials) {
      trial.status = 'running';
      trial.startedAt = Date.now();

      // Simulate trial
      await this.delay(100);

      trial.metrics = {
        accuracy: 0.7 + Math.random() * 0.25,
        f1Score: 0.65 + Math.random() * 0.3,
      };

      trial.status = 'completed';
      trial.completedAt = Date.now();
      trial.duration = trial.completedAt - trial.startedAt;

      tuning.trials.push(trial);

      this.emit('tuning:trial_complete', { tuning, trial });
    }

    // Find best trial
    tuning.bestTrial = tuning.trials.reduce((best, trial) =>
      trial.metrics[tuning.objective] > (best.metrics[tuning.objective] || 0)
        ? trial
        : best
    );

    tuning.status = 'completed';

    this.emit('tuning:completed', { tuning });

    return tuning;
  }

  private generateTrials(tuning: HyperparameterTuning): Trial[] {
    const trials: Trial[] = [];
    const numTrials = tuning.strategy === 'grid_search' ? 20 : 10;

    for (let i = 0; i < numTrials; i++) {
      const parameters: Record<string, any> = {};

      for (const [param, space] of Object.entries(tuning.searchSpace)) {
        parameters[param] = this.sampleParameter(space);
      }

      trials.push({
        id: this.generateId(),
        parameters,
        metrics: {},
        status: 'pending',
        duration: 0,
        startedAt: 0,
      });
    }

    return trials;
  }

  private sampleParameter(space: ParameterSpace): any {
    switch (space.type) {
      case 'int':
        return Math.floor(Math.random() * (space.max! - space.min!)) + space.min!;

      case 'float':
        return Math.random() * (space.max! - space.min!) + space.min!;

      case 'categorical':
        return space.values![Math.floor(Math.random() * space.values!.length)];

      case 'boolean':
        return Math.random() > 0.5;

      default:
        return null;
    }
  }

  // ========================================================================
  // Model Experiments
  // ========================================================================

  public createExperiment(experiment: Omit<ModelExperiment, 'id' | 'status' | 'startedAt' | 'metrics'>): ModelExperiment {
    const full: ModelExperiment = {
      ...experiment,
      id: this.generateId(),
      status: 'running',
      startedAt: Date.now(),
      metrics: {
        modelMetrics: new Map(),
        comparisonResults: [],
      },
    };

    this.experiments.set(full.id, full);
    this.emit('experiment:created', { experiment: full });

    return full;
  }

  public async compareModels(experimentId: string): Promise<ComparisonResult[]> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    const results: ComparisonResult[] = [];

    // Compare each model with baseline
    if (experiment.baseline) {
      const baselineModel = this.models.get(experiment.baseline);

      for (const modelId of experiment.models) {
        if (modelId === experiment.baseline) continue;

        const model = this.models.get(modelId);
        if (!model || !baselineModel) continue;

        const comparison = this.compareModelMetrics(baselineModel, model);
        results.push(...comparison);
      }
    }

    experiment.metrics.comparisonResults = results;

    this.emit('experiment:compared', { experiment, results });

    return results;
  }

  private compareModelMetrics(modelA: Model, modelB: Model): ComparisonResult[] {
    const results: ComparisonResult[] = [];

    for (const metric of ['accuracy', 'precision', 'recall', 'f1Score']) {
      const valueA = (modelA.metrics as any)[metric];
      const valueB = (modelB.metrics as any)[metric];

      if (valueA !== undefined && valueB !== undefined) {
        const improvement = ((valueB - valueA) / valueA) * 100;

        results.push({
          modelA: modelA.id,
          modelB: modelB.id,
          metric,
          improvement,
          significant: Math.abs(improvement) > 5,
        });
      }
    }

    return results;
  }

  // ========================================================================
  // Drift Detection
  // ========================================================================

  public async detectDrift(modelId: string, recentData: any[]): Promise<DriftDetection | null> {
    if (!this.config.enableDriftDetection) {
      return null;
    }

    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const drift: DriftDetection = {
      id: this.generateId(),
      modelId,
      type: 'data_drift',
      threshold: 0.1,
      severity: 'low',
      affectedFeatures: [],
      metrics: {
        drift_score: Math.random() * 0.2,
      },
    };

    // Calculate drift metrics
    drift.metrics.psi = this.calculatePSI(model, recentData);
    drift.metrics.drift_score = drift.metrics.psi || 0;

    if (drift.metrics.drift_score > drift.threshold) {
      drift.detectedAt = Date.now();
      drift.severity = drift.metrics.drift_score > 0.25 ? 'high' : 'medium';

      this.driftDetectors.set(drift.id, drift);
      this.emit('drift:detected', { drift });

      return drift;
    }

    return null;
  }

  private calculatePSI(model: Model, recentData: any[]): number {
    // Simplified PSI calculation
    return Math.random() * 0.3;
  }

  // ========================================================================
  // Model Monitoring
  // ========================================================================

  private updateMonitoring(modelId: string, result: PredictionResult): void {
    let monitoring = this.monitoring.get(modelId);

    if (!monitoring) {
      monitoring = {
        modelId,
        metrics: {
          requestCount: 0,
          averageLatency: 0,
          errorRate: 0,
          throughput: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          predictionDistribution: {},
        },
        alerts: [],
        lastCheck: Date.now(),
      };
      this.monitoring.set(modelId, monitoring);
    }

    monitoring.metrics.requestCount++;
    monitoring.metrics.averageLatency =
      (monitoring.metrics.averageLatency * (monitoring.metrics.requestCount - 1) +
        result.latency) /
      monitoring.metrics.requestCount;

    monitoring.lastCheck = Date.now();

    // Check for alerts
    if (result.latency > 5000) {
      this.createAlert(modelId, 'high_latency', 'warning', `High latency: ${result.latency}ms`);
    }
  }

  private createAlert(
    modelId: string,
    type: AlertType,
    severity: 'info' | 'warning' | 'critical',
    message: string
  ): void {
    const monitoring = this.monitoring.get(modelId);
    if (!monitoring) return;

    const alert: ModelAlert = {
      id: this.generateId(),
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    };

    monitoring.alerts.push(alert);
    this.emit('alert:created', { modelId, alert });
  }

  // ========================================================================
  // Dataset Management
  // ========================================================================

  public registerDataset(dataset: Omit<Dataset, 'id'>): Dataset {
    const full: Dataset = {
      ...dataset,
      id: this.generateId(),
    };

    this.datasets.set(full.id, full);
    this.emit('dataset:registered', { dataset: full });

    return full;
  }

  public getDataset(datasetId: string): Dataset | undefined {
    return this.datasets.get(datasetId);
  }

  // ========================================================================
  // Feature Store
  // ========================================================================

  public createFeatureStore(name: string): FeatureStore {
    const store: FeatureStore = {
      id: this.generateId(),
      name,
      features: new Map(),
      version: '1.0.0',
      updatedAt: Date.now(),
    };

    this.featureStores.set(store.id, store);
    this.emit('feature_store:created', { store });

    return store;
  }

  public setFeature(storeId: string, name: string, value: any): void {
    const store = this.featureStores.get(storeId);
    if (!store) {
      throw new Error(`Feature store not found: ${storeId}`);
    }

    const feature: FeatureValue = {
      name,
      value,
      timestamp: Date.now(),
      version: store.version,
    };

    store.features.set(name, feature);
    store.updatedAt = Date.now();

    this.emit('feature:updated', { store, feature });
  }

  public getFeature(storeId: string, name: string): FeatureValue | undefined {
    const store = this.featureStores.get(storeId);
    return store?.features.get(name);
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateId(): string {
    return `ml-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getStats(): MLStats {
    return {
      totalModels: this.models.size,
      trainedModels: Array.from(this.models.values()).filter(m => m.status === 'trained').length,
      deployedModels: Array.from(this.models.values()).filter(m => m.status === 'deployed').length,
      trainingJobs: this.trainingJobs.size,
      activeJobs: Array.from(this.trainingJobs.values()).filter(j => j.status === 'running').length,
      totalDatasets: this.datasets.size,
      experiments: this.experiments.size,
      driftDetections: this.driftDetectors.size,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export default MLManager;
