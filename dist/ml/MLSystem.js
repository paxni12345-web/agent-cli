"use strict";
/**
 * Machine Learning Integration System
 * ML model training, inference, feature engineering, and experiment tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.experimentTracker = exports.featureEngineeringManager = exports.mlModelManager = exports.ExperimentTracker = exports.FeatureEngineeringManager = exports.MLModelManager = exports.ExperimentStatus = exports.TransformationType = exports.FeatureType = exports.CallbackType = exports.TrainingStatus = exports.ArtifactType = exports.ModelStatus = exports.MLFramework = exports.ModelType = void 0;
const EventBus_1 = require("../core/EventBus");
var ModelType;
(function (ModelType) {
    ModelType["Classification"] = "classification";
    ModelType["Regression"] = "regression";
    ModelType["Clustering"] = "clustering";
    ModelType["NeuralNetwork"] = "neural_network";
    ModelType["ReinforcementLearning"] = "reinforcement_learning";
    ModelType["NLP"] = "nlp";
    ModelType["ComputerVision"] = "computer_vision";
})(ModelType || (exports.ModelType = ModelType = {}));
var MLFramework;
(function (MLFramework) {
    MLFramework["TensorFlow"] = "tensorflow";
    MLFramework["PyTorch"] = "pytorch";
    MLFramework["ScikitLearn"] = "scikit_learn";
    MLFramework["XGBoost"] = "xgboost";
    MLFramework["Keras"] = "keras";
    MLFramework["Custom"] = "custom";
})(MLFramework || (exports.MLFramework = MLFramework = {}));
var ModelStatus;
(function (ModelStatus) {
    ModelStatus["Draft"] = "draft";
    ModelStatus["Training"] = "training";
    ModelStatus["Trained"] = "trained";
    ModelStatus["Evaluating"] = "evaluating";
    ModelStatus["Deployed"] = "deployed";
    ModelStatus["Archived"] = "archived";
    ModelStatus["Failed"] = "failed";
})(ModelStatus || (exports.ModelStatus = ModelStatus = {}));
var ArtifactType;
(function (ArtifactType) {
    ArtifactType["Weights"] = "weights";
    ArtifactType["Graph"] = "graph";
    ArtifactType["Checkpoint"] = "checkpoint";
    ArtifactType["Config"] = "config";
    ArtifactType["Vocabulary"] = "vocabulary";
    ArtifactType["Scaler"] = "scaler";
})(ArtifactType || (exports.ArtifactType = ArtifactType = {}));
var TrainingStatus;
(function (TrainingStatus) {
    TrainingStatus["Pending"] = "pending";
    TrainingStatus["Running"] = "running";
    TrainingStatus["Completed"] = "completed";
    TrainingStatus["Failed"] = "failed";
    TrainingStatus["Stopped"] = "stopped";
})(TrainingStatus || (exports.TrainingStatus = TrainingStatus = {}));
var CallbackType;
(function (CallbackType) {
    CallbackType["EarlyStopping"] = "early_stopping";
    CallbackType["ModelCheckpoint"] = "model_checkpoint";
    CallbackType["ReduceLROnPlateau"] = "reduce_lr_on_plateau";
    CallbackType["TensorBoard"] = "tensorboard";
    CallbackType["Custom"] = "custom";
})(CallbackType || (exports.CallbackType = CallbackType = {}));
var FeatureType;
(function (FeatureType) {
    FeatureType["Numeric"] = "numeric";
    FeatureType["Categorical"] = "categorical";
    FeatureType["Text"] = "text";
    FeatureType["DateTime"] = "datetime";
    FeatureType["Binary"] = "binary";
    FeatureType["Image"] = "image";
})(FeatureType || (exports.FeatureType = FeatureType = {}));
var TransformationType;
(function (TransformationType) {
    TransformationType["Normalize"] = "normalize";
    TransformationType["Standardize"] = "standardize";
    TransformationType["OneHotEncode"] = "one_hot_encode";
    TransformationType["LabelEncode"] = "label_encode";
    TransformationType["BinDiscretize"] = "bin_discretize";
    TransformationType["PolynomialFeatures"] = "polynomial_features";
    TransformationType["TextVectorize"] = "text_vectorize";
})(TransformationType || (exports.TransformationType = TransformationType = {}));
var ExperimentStatus;
(function (ExperimentStatus) {
    ExperimentStatus["Active"] = "active";
    ExperimentStatus["Completed"] = "completed";
    ExperimentStatus["Archived"] = "archived";
})(ExperimentStatus || (exports.ExperimentStatus = ExperimentStatus = {}));
/**
 * ML Model Manager
 */
class MLModelManager {
    models = new Map();
    trainingJobs = new Map();
    predictions = [];
    /**
     * Register model
     */
    registerModel(model) {
        const fullModel = {
            ...model,
            id: this.generateModelId(),
            status: ModelStatus.Draft,
            createdAt: new Date(),
        };
        this.models.set(fullModel.id, fullModel);
        EventBus_1.eventBus.emitSync('ml.model_registered', fullModel, 'MLModelManager');
        return fullModel;
    }
    /**
     * Start training
     */
    async trainModel(modelId, config) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        const job = {
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
        EventBus_1.eventBus.emitSync('ml.training_started', job, 'MLModelManager');
        // Run training asynchronously
        this.executeTraining(job, model);
        return job;
    }
    /**
     * Stop training
     */
    stopTraining(jobId) {
        const job = this.trainingJobs.get(jobId);
        if (job && job.status === TrainingStatus.Running) {
            job.status = TrainingStatus.Stopped;
            job.completedAt = new Date();
            EventBus_1.eventBus.emitSync('ml.training_stopped', job, 'MLModelManager');
        }
    }
    /**
     * Make prediction
     */
    async predict(modelId, input) {
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
        const prediction = {
            id: this.generatePredictionId(),
            modelId,
            input,
            output,
            timestamp: new Date(),
            duration: Date.now() - startTime,
        };
        this.predictions.push(prediction);
        EventBus_1.eventBus.emitSync('ml.prediction_made', prediction, 'MLModelManager');
        return prediction;
    }
    /**
     * Evaluate model
     */
    async evaluateModel(modelId, testData) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        model.status = ModelStatus.Evaluating;
        // Mock evaluation
        const metrics = {
            accuracy: 0.85,
            precision: 0.83,
            recall: 0.87,
            f1Score: 0.85,
        };
        model.metrics = metrics;
        model.status = ModelStatus.Trained;
        EventBus_1.eventBus.emitSync('ml.model_evaluated', { modelId, metrics }, 'MLModelManager');
        return metrics;
    }
    /**
     * Deploy model
     */
    deployModel(modelId, environment) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        model.status = ModelStatus.Deployed;
        EventBus_1.eventBus.emitSync('ml.model_deployed', { modelId, environment }, 'MLModelManager');
    }
    /**
     * Get model
     */
    getModel(modelId) {
        return this.models.get(modelId);
    }
    /**
     * List models
     */
    listModels(filter) {
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
    getTrainingJob(jobId) {
        return this.trainingJobs.get(jobId);
    }
    /**
     * List training jobs
     */
    listTrainingJobs(modelId) {
        let jobs = Array.from(this.trainingJobs.values());
        if (modelId) {
            jobs = jobs.filter(j => j.modelId === modelId);
        }
        return jobs;
    }
    /**
     * Get predictions
     */
    getPredictions(modelId, limit = 100) {
        let predictions = [...this.predictions];
        if (modelId) {
            predictions = predictions.filter(p => p.modelId === modelId);
        }
        return predictions.slice(-limit);
    }
    async executeTraining(job, model) {
        try {
            for (let epoch = 1; epoch <= job.config.epochs; epoch++) {
                if (job.status !== TrainingStatus.Running) {
                    break;
                }
                const epochStart = Date.now();
                // Mock training epoch
                await new Promise(resolve => setTimeout(resolve, 100));
                const epochResult = {
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
                EventBus_1.eventBus.emitSync('ml.epoch_completed', { jobId: job.id, epochResult }, 'MLModelManager');
                // Check early stopping
                if (job.config.earlyStoppingPatience) {
                    const recentEpochs = job.epochs.slice(-job.config.earlyStoppingPatience);
                    if (recentEpochs.length === job.config.earlyStoppingPatience) {
                        const improving = recentEpochs.every((e, i) => i === 0 || e.valLoss < recentEpochs[i - 1].valLoss);
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
            EventBus_1.eventBus.emitSync('ml.training_completed', job, 'MLModelManager');
        }
        catch (error) {
            job.status = TrainingStatus.Failed;
            job.error = error instanceof Error ? error.message : String(error);
            job.completedAt = new Date();
            model.status = ModelStatus.Failed;
            EventBus_1.eventBus.emitSync('ml.training_failed', job, 'MLModelManager');
        }
    }
    executePrediction(model, input) {
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
    generateModelId() {
        return `model_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generatePredictionId() {
        return `pred_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.MLModelManager = MLModelManager;
/**
 * Feature Engineering Manager
 */
class FeatureEngineeringManager {
    featureSets = new Map();
    /**
     * Create feature set
     */
    createFeatureSet(name, features, transformations = []) {
        const featureSet = {
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
        EventBus_1.eventBus.emitSync('ml.feature_set_created', featureSet, 'FeatureEngineeringManager');
        return featureSet;
    }
    /**
     * Transform data
     */
    async transform(featureSetId, data) {
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
    calculateStatistics(featureSetId, data) {
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
    getFeatureSet(id) {
        return this.featureSets.get(id);
    }
    /**
     * List feature sets
     */
    listFeatureSets() {
        return Array.from(this.featureSets.values());
    }
    applyTransformation(transformation, data) {
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
    normalize(data, feature) {
        const values = data.map(d => d[feature]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        return data.map(d => ({
            ...d,
            [feature]: (d[feature] - min) / (max - min),
        }));
    }
    standardize(data, feature) {
        const values = data.map(d => d[feature]);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
        return data.map(d => ({
            ...d,
            [feature]: (d[feature] - mean) / std,
        }));
    }
    oneHotEncode(data, feature) {
        const uniqueValues = [...new Set(data.map(d => d[feature]))];
        return data.map(d => {
            const encoded = { ...d };
            for (const value of uniqueValues) {
                encoded[`${feature}_${value}`] = d[feature] === value ? 1 : 0;
            }
            return encoded;
        });
    }
    generateFeatureSetId() {
        return `features_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FeatureEngineeringManager = FeatureEngineeringManager;
/**
 * Experiment Tracker
 */
class ExperimentTracker {
    experiments = new Map();
    /**
     * Create experiment
     */
    createExperiment(name, description) {
        const experiment = {
            id: this.generateExperimentId(),
            name,
            description,
            runs: [],
            status: ExperimentStatus.Active,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.experiments.set(experiment.id, experiment);
        EventBus_1.eventBus.emitSync('ml.experiment_created', experiment, 'ExperimentTracker');
        return experiment;
    }
    /**
     * Log run
     */
    logRun(experimentId, modelId, parameters, metrics) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experiment not found: ${experimentId}`);
        }
        const run = {
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
        if (!experiment.bestRun || this.isBetterRun(run, experiment.runs.find(r => r.id === experiment.bestRun))) {
            experiment.bestRun = run.id;
        }
        EventBus_1.eventBus.emitSync('ml.run_logged', run, 'ExperimentTracker');
        return run;
    }
    /**
     * Compare runs
     */
    compareRuns(runIds) {
        const runs = [];
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
    getExperiment(id) {
        return this.experiments.get(id);
    }
    /**
     * List experiments
     */
    listExperiments(filter) {
        let experiments = Array.from(this.experiments.values());
        if (filter?.status) {
            experiments = experiments.filter(e => e.status === filter.status);
        }
        return experiments;
    }
    isBetterRun(run1, run2) {
        // Simple comparison based on first metric
        const metric1 = Object.values(run1.metrics)[0] || 0;
        const metric2 = Object.values(run2.metrics)[0] || 0;
        return metric1 > metric2;
    }
    aggregateParameters(runs) {
        const parameters = {};
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
    aggregateMetrics(runs) {
        const metrics = {};
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
    generateExperimentId() {
        return `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateRunId() {
        return `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ExperimentTracker = ExperimentTracker;
/**
 * Singleton instances
 */
exports.mlModelManager = new MLModelManager();
exports.featureEngineeringManager = new FeatureEngineeringManager();
exports.experimentTracker = new ExperimentTracker();
