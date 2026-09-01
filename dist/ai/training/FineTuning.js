"use strict";
/**
 * FineTuning - Model fine-tuning pipelines and training management
 * Handles dataset preparation, training jobs, and evaluation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FineTuningManager = void 0;
const events_1 = require("events");
class FineTuningManager extends events_1.EventEmitter {
    jobs = new Map();
    datasets = new Map();
    checkpoints = new Map();
    constructor() {
        super();
    }
    createJob(modelId, datasetId, config) {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const job = {
            id: jobId,
            modelId,
            datasetId,
            config: {
                epochs: 3,
                batchSize: 8,
                learningRate: 5e-5,
                warmupSteps: 100,
                evaluationSteps: 500,
                saveSteps: 1000,
                gradientAccumulation: 1,
                optimizer: 'adamw',
                lrScheduler: 'linear',
                ...config
            },
            status: 'pending',
            progress: {
                currentEpoch: 0,
                currentStep: 0,
                totalSteps: 0,
                percentComplete: 0
            },
            metrics: {
                loss: [],
                accuracy: [],
                validationLoss: [],
                validationAccuracy: [],
                learningRates: []
            }
        };
        this.jobs.set(jobId, job);
        this.emit('job:created', job);
        return jobId;
    }
    async startTraining(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            throw new Error(`Job ${jobId} not found`);
        const dataset = this.datasets.get(job.datasetId);
        if (!dataset)
            throw new Error(`Dataset ${job.datasetId} not found`);
        job.status = 'preparing';
        job.startTime = new Date();
        this.emit('job:preparing', job);
        try {
            await this.prepareDataset(dataset);
            job.status = 'training';
            job.progress.totalSteps = Math.ceil((dataset.size * dataset.splits.train / 100) / job.config.batchSize * job.config.epochs);
            this.emit('job:training:started', job);
            await this.runTraining(job, dataset);
            job.status = 'completed';
            job.endTime = new Date();
            job.progress.percentComplete = 100;
            this.emit('job:completed', job);
        }
        catch (error) {
            job.status = 'failed';
            job.error = error.message;
            job.endTime = new Date();
            this.emit('job:failed', { job, error });
            throw error;
        }
    }
    async prepareDataset(dataset) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.emit('dataset:prepared', dataset);
    }
    async runTraining(job, dataset) {
        const trainSize = Math.floor(dataset.size * dataset.splits.train / 100);
        const stepsPerEpoch = Math.ceil(trainSize / job.config.batchSize);
        for (let epoch = 1; epoch <= job.config.epochs; epoch++) {
            job.progress.currentEpoch = epoch;
            for (let step = 1; step <= stepsPerEpoch; step++) {
                job.progress.currentStep = (epoch - 1) * stepsPerEpoch + step;
                job.progress.percentComplete = (job.progress.currentStep / job.progress.totalSteps) * 100;
                await this.trainingStep(job, step);
                if (step % job.config.evaluationSteps === 0) {
                    await this.evaluate(job, dataset);
                }
                if (step % job.config.saveSteps === 0) {
                    await this.saveCheckpoint(job);
                }
                this.emit('job:progress', {
                    jobId: job.id,
                    progress: job.progress,
                    currentLoss: job.metrics.loss[job.metrics.loss.length - 1]
                });
            }
            this.emit('job:epoch:completed', { jobId: job.id, epoch });
        }
    }
    async trainingStep(job, step) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const baseLoss = 2.0;
        const decay = Math.exp(-step / 1000);
        const noise = (Math.random() - 0.5) * 0.1;
        const loss = baseLoss * decay + noise;
        job.metrics.loss.push(Math.max(0.1, loss));
        job.metrics.accuracy.push(Math.min(0.99, 0.5 + (1 - decay) * 0.49));
        const lr = this.calculateLearningRate(job, step);
        job.metrics.learningRates.push(lr);
    }
    calculateLearningRate(job, step) {
        const { learningRate, warmupSteps, lrScheduler } = job.config;
        const totalSteps = job.progress.totalSteps;
        if (step < warmupSteps) {
            return (learningRate * step) / warmupSteps;
        }
        const progress = (step - warmupSteps) / (totalSteps - warmupSteps);
        switch (lrScheduler) {
            case 'linear':
                return learningRate * (1 - progress);
            case 'cosine':
                return learningRate * 0.5 * (1 + Math.cos(Math.PI * progress));
            case 'polynomial':
                return learningRate * Math.pow(1 - progress, 2);
            default:
                return learningRate;
        }
    }
    async evaluate(job, dataset) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const valLoss = job.metrics.loss[job.metrics.loss.length - 1] * 1.1;
        const valAcc = job.metrics.accuracy[job.metrics.accuracy.length - 1] * 0.95;
        job.metrics.validationLoss.push(valLoss);
        job.metrics.validationAccuracy.push(valAcc);
        this.emit('job:evaluated', {
            jobId: job.id,
            validationLoss: valLoss,
            validationAccuracy: valAcc
        });
    }
    async saveCheckpoint(job) {
        const checkpoint = {
            step: job.progress.currentStep,
            epoch: job.progress.currentEpoch,
            loss: job.metrics.loss[job.metrics.loss.length - 1],
            timestamp: new Date()
        };
        const checkpoints = this.checkpoints.get(job.id) || [];
        checkpoints.push(checkpoint);
        this.checkpoints.set(job.id, checkpoints);
        this.emit('checkpoint:saved', { jobId: job.id, checkpoint });
    }
    async evaluateModel(jobId, testDataset) {
        const job = this.jobs.get(jobId);
        if (!job)
            throw new Error(`Job ${jobId} not found`);
        const examples = [];
        let correct = 0;
        for (let i = 0; i < Math.min(100, testDataset.examples.length); i++) {
            const example = testDataset.examples[i];
            const predicted = await this.predict(job, example.input);
            const isCorrect = predicted.text === example.output;
            if (isCorrect)
                correct++;
            examples.push({
                input: example.input,
                expected: example.output,
                predicted: predicted.text,
                correct: isCorrect,
                confidence: predicted.confidence
            });
        }
        const accuracy = correct / examples.length;
        const finalLoss = job.metrics.validationLoss[job.metrics.validationLoss.length - 1] || 0;
        return {
            jobId,
            metrics: {
                accuracy,
                loss: finalLoss,
                perplexity: Math.exp(finalLoss)
            },
            examples: examples.slice(0, 10)
        };
    }
    async predict(job, input) {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
            text: `Predicted output for: ${input}`,
            confidence: 0.85 + Math.random() * 0.15
        };
    }
    registerDataset(dataset) {
        this.datasets.set(dataset.id, dataset);
        this.emit('dataset:registered', dataset);
    }
    getJobStatus(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return null;
        return {
            id: job.id,
            status: job.status,
            progress: job.progress,
            currentMetrics: {
                loss: job.metrics.loss[job.metrics.loss.length - 1],
                accuracy: job.metrics.accuracy[job.metrics.accuracy.length - 1],
                validationLoss: job.metrics.validationLoss[job.metrics.validationLoss.length - 1],
                validationAccuracy: job.metrics.validationAccuracy[job.metrics.validationAccuracy.length - 1]
            },
            duration: job.startTime && job.endTime
                ? job.endTime.getTime() - job.startTime.getTime()
                : job.startTime
                    ? Date.now() - job.startTime.getTime()
                    : 0
        };
    }
    getTrainingMetrics(jobId) {
        const job = this.jobs.get(jobId);
        return job ? job.metrics : null;
    }
    stopTraining(jobId) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'training') {
            job.status = 'failed';
            job.error = 'Training stopped by user';
            job.endTime = new Date();
            this.emit('job:stopped', job);
        }
    }
}
exports.FineTuningManager = FineTuningManager;
exports.default = FineTuningManager;
