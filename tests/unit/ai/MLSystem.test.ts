/**
 * Comprehensive Unit Tests for MLSystem
 * Coverage: MLModelManager, FeatureEngineeringManager, ExperimentTracker
 */

import {
  MLModelManager,
  FeatureEngineeringManager,
  ExperimentTracker,
  MLModel,
  ModelType,
  MLFramework,
  ModelStatus,
  TrainingConfig,
  TrainingStatus,
  Feature,
  FeatureType,
  TransformationType,
  ExperimentStatus,
  mlModelManager,
  featureEngineeringManager,
  experimentTracker,
} from '../../../src/ml/MLSystem';

// Mock EventBus
jest.mock('../../../src/core/EventBus', () => ({
  eventBus: {
    emitSync: jest.fn(),
  },
}));

describe('MLModelManager', () => {
  let manager: MLModelManager;

  beforeEach(() => {
    manager = new MLModelManager();
  });

  describe('registerModel', () => {
    it('should register a model', () => {
      const model = manager.registerModel({
        name: 'Test Model',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'logistic_regression',
        hyperparameters: { learning_rate: 0.01 },
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test Author',
          tags: ['test'],
          dataset: 'test_dataset',
          features: ['feature1', 'feature2'],
        },
      });

      expect(model).toBeDefined();
      expect(model.id).toBeDefined();
      expect(model.name).toBe('Test Model');
      expect(model.status).toBe(ModelStatus.Draft);
      expect(model.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', () => {
      const model1 = manager.registerModel({
        name: 'Model 1',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const model2 = manager.registerModel({
        name: 'Model 2',
        type: ModelType.Regression,
        version: '1.0.0',
        framework: MLFramework.PyTorch,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      expect(model1.id).not.toBe(model2.id);
    });

    it('should handle all model types', () => {
      const types: ModelType[] = [
        ModelType.Classification,
        ModelType.Regression,
        ModelType.Clustering,
        ModelType.NeuralNetwork,
        ModelType.ReinforcementLearning,
        ModelType.NLP,
        ModelType.ComputerVision,
      ];

      types.forEach(type => {
        const model = manager.registerModel({
          name: `Model ${type}`,
          type,
          version: '1.0.0',
          framework: MLFramework.TensorFlow,
          algorithm: 'test',
          hyperparameters: {},
          metrics: {},
          artifacts: [],
          metadata: {
            author: 'Test',
            tags: [],
            dataset: 'test',
            features: [],
          },
        });

        expect(model.type).toBe(type);
      });
    });

    it('should handle all frameworks', () => {
      const frameworks: MLFramework[] = [
        MLFramework.TensorFlow,
        MLFramework.PyTorch,
        MLFramework.ScikitLearn,
        MLFramework.XGBoost,
        MLFramework.Keras,
        MLFramework.Custom,
      ];

      frameworks.forEach(framework => {
        const model = manager.registerModel({
          name: `Model ${framework}`,
          type: ModelType.Classification,
          version: '1.0.0',
          framework,
          algorithm: 'test',
          hyperparameters: {},
          metrics: {},
          artifacts: [],
          metadata: {
            author: 'Test',
            tags: [],
            dataset: 'test',
            features: [],
          },
        });

        expect(model.framework).toBe(framework);
      });
    });

    it('should handle null name', () => {
      expect(() => {
        manager.registerModel({
          name: null as any,
          type: ModelType.Classification,
          version: '1.0.0',
          framework: MLFramework.TensorFlow,
          algorithm: 'test',
          hyperparameters: {},
          metrics: {},
          artifacts: [],
          metadata: {
            author: 'Test',
            tags: [],
            dataset: 'test',
            features: [],
          },
        });
      }).toThrow();
    });

    it('should handle undefined name', () => {
      expect(() => {
        manager.registerModel({
          name: undefined as any,
          type: ModelType.Classification,
          version: '1.0.0',
          framework: MLFramework.TensorFlow,
          algorithm: 'test',
          hyperparameters: {},
          metrics: {},
          artifacts: [],
          metadata: {
            author: 'Test',
            tags: [],
            dataset: 'test',
            features: [],
          },
        });
      }).toThrow();
    });

    it('should handle empty metadata', () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: '',
          tags: [],
          dataset: '',
          features: [],
        },
      });

      expect(model).toBeDefined();
    });
  });

  describe('trainModel', () => {
    let modelId: string;

    beforeEach(() => {
      const model = manager.registerModel({
        name: 'Test Model',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });
      modelId = model.id;
    });

    it('should start training', async () => {
      const config: TrainingConfig = {
        epochs: 10,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'categorical_crossentropy',
        callbacks: [],
      };

      const job = await manager.trainModel(modelId, config);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.modelId).toBe(modelId);
      expect(job.status).toBe(TrainingStatus.Running);
      expect(job.config).toEqual(config);
      expect(job.progress.totalEpochs).toBe(10);
    });

    it('should throw error for non-existent model', async () => {
      const config: TrainingConfig = {
        epochs: 10,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await expect(
        manager.trainModel('non-existent', config)
      ).rejects.toThrow('Model not found: non-existent');
    });

    it('should update model status to Training', async () => {
      const config: TrainingConfig = {
        epochs: 5,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(modelId, config);

      const model = manager.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.Training);
    });

    it('should handle null config', async () => {
      await expect(
        manager.trainModel(modelId, null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined config', async () => {
      await expect(
        manager.trainModel(modelId, undefined as any)
      ).rejects.toThrow();
    });

    it('should handle zero epochs', async () => {
      const config: TrainingConfig = {
        epochs: 0,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      const job = await manager.trainModel(modelId, config);
      expect(job).toBeDefined();
    });

    it('should handle negative epochs', async () => {
      const config: TrainingConfig = {
        epochs: -5,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      const job = await manager.trainModel(modelId, config);
      expect(job).toBeDefined();
    });

    it('should complete training', async () => {
      const config: TrainingConfig = {
        epochs: 2,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      const job = await manager.trainModel(modelId, config);

      // Wait for training to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      const updatedJob = manager.getTrainingJob(job.id);
      expect(updatedJob?.status).toBe(TrainingStatus.Completed);
    });

    it('should handle early stopping', async () => {
      const config: TrainingConfig = {
        epochs: 100,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
        earlyStoppingPatience: 3,
      };

      const job = await manager.trainModel(modelId, config);

      // Wait for training
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedJob = manager.getTrainingJob(job.id);
      expect(updatedJob?.epochs.length).toBeLessThanOrEqual(100);
    });

    it('should handle concurrent training jobs', async () => {
      const model1 = manager.registerModel({
        name: 'Model 1',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const model2 = manager.registerModel({
        name: 'Model 2',
        type: ModelType.Regression,
        version: '1.0.0',
        framework: MLFramework.PyTorch,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const config: TrainingConfig = {
        epochs: 2,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      const jobs = await Promise.all([
        manager.trainModel(model1.id, config),
        manager.trainModel(model2.id, config),
      ]);

      expect(jobs).toHaveLength(2);
      expect(jobs[0].id).not.toBe(jobs[1].id);
    });
  });

  describe('stopTraining', () => {
    let modelId: string;
    let jobId: string;

    beforeEach(async () => {
      const model = manager.registerModel({
        name: 'Test Model',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });
      modelId = model.id;

      const config: TrainingConfig = {
        epochs: 100,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      const job = await manager.trainModel(modelId, config);
      jobId = job.id;
    });

    it('should stop running training', () => {
      manager.stopTraining(jobId);

      const job = manager.getTrainingJob(jobId);
      expect(job?.status).toBe(TrainingStatus.Stopped);
      expect(job?.completedAt).toBeInstanceOf(Date);
    });

    it('should handle non-existent job', () => {
      manager.stopTraining('non-existent');
      // Should not throw
    });

    it('should handle null job ID', () => {
      manager.stopTraining(null as any);
      // Should not throw
    });

    it('should handle undefined job ID', () => {
      manager.stopTraining(undefined as any);
      // Should not throw
    });

    it('should not affect completed jobs', async () => {
      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      const job = await manager.trainModel(modelId, config);
      await new Promise(resolve => setTimeout(resolve, 200));

      manager.stopTraining(job.id);

      const updatedJob = manager.getTrainingJob(job.id);
      expect(updatedJob?.status).toBe(TrainingStatus.Completed);
    });
  });

  describe('predict', () => {
    let modelId: string;

    beforeEach(async () => {
      const model = manager.registerModel({
        name: 'Test Model',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });
      modelId = model.id;

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(modelId, config);
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    it('should make prediction', async () => {
      const input = { feature1: 1.0, feature2: 2.0 };
      const prediction = await manager.predict(modelId, input);

      expect(prediction).toBeDefined();
      expect(prediction.id).toBeDefined();
      expect(prediction.modelId).toBe(modelId);
      expect(prediction.input).toEqual(input);
      expect(prediction.output).toBeDefined();
      expect(prediction.timestamp).toBeInstanceOf(Date);
      expect(prediction.duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-existent model', async () => {
      await expect(
        manager.predict('non-existent', {})
      ).rejects.toThrow('Model not found: non-existent');
    });

    it('should throw error for untrained model', async () => {
      const untrainedModel = manager.registerModel({
        name: 'Untrained',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      await expect(
        manager.predict(untrainedModel.id, {})
      ).rejects.toThrow('Model is not ready for inference');
    });

    it('should handle null input', async () => {
      await expect(
        manager.predict(modelId, null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined input', async () => {
      await expect(
        manager.predict(modelId, undefined as any)
      ).rejects.toThrow();
    });

    it('should handle empty input', async () => {
      const prediction = await manager.predict(modelId, {});
      expect(prediction).toBeDefined();
    });

    it('should return different outputs for different model types', async () => {
      const classificationPrediction = await manager.predict(modelId, {});
      expect(classificationPrediction.output).toHaveProperty('class');
      expect(classificationPrediction.output).toHaveProperty('confidence');
    });

    it('should handle concurrent predictions', async () => {
      const inputs = [
        { feature1: 1.0 },
        { feature1: 2.0 },
        { feature1: 3.0 },
      ];

      const predictions = await Promise.all(
        inputs.map(input => manager.predict(modelId, input))
      );

      expect(predictions).toHaveLength(3);
      predictions.forEach((pred, i) => {
        expect(pred.input).toEqual(inputs[i]);
      });
    });
  });

  describe('evaluateModel', () => {
    let modelId: string;

    beforeEach(async () => {
      const model = manager.registerModel({
        name: 'Test Model',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });
      modelId = model.id;

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(modelId, config);
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    it('should evaluate model', async () => {
      const testData = [{ feature1: 1.0 }, { feature1: 2.0 }];
      const metrics = await manager.evaluateModel(modelId, testData);

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeDefined();
      expect(metrics.precision).toBeDefined();
      expect(metrics.recall).toBeDefined();
      expect(metrics.f1Score).toBeDefined();
    });

    it('should update model metrics', async () => {
      const testData = [{ feature1: 1.0 }];
      await manager.evaluateModel(modelId, testData);

      const model = manager.getModel(modelId);
      expect(model?.metrics).toBeDefined();
      expect(model?.metrics.accuracy).toBeDefined();
    });

    it('should update model status', async () => {
      const testData = [{ feature1: 1.0 }];
      await manager.evaluateModel(modelId, testData);

      const model = manager.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.Trained);
    });

    it('should throw error for non-existent model', async () => {
      await expect(
        manager.evaluateModel('non-existent', [])
      ).rejects.toThrow('Model not found: non-existent');
    });

    it('should handle null test data', async () => {
      await expect(
        manager.evaluateModel(modelId, null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined test data', async () => {
      await expect(
        manager.evaluateModel(modelId, undefined as any)
      ).rejects.toThrow();
    });

    it('should handle empty test data', async () => {
      const metrics = await manager.evaluateModel(modelId, []);
      expect(metrics).toBeDefined();
    });
  });

  describe('deployModel', () => {
    let modelId: string;

    beforeEach(async () => {
      const model = manager.registerModel({
        name: 'Test Model',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });
      modelId = model.id;
    });

    it('should deploy model', () => {
      manager.deployModel(modelId, 'production');

      const model = manager.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.Deployed);
    });

    it('should throw error for non-existent model', () => {
      expect(() => {
        manager.deployModel('non-existent', 'production');
      }).toThrow('Model not found: non-existent');
    });

    it('should handle null model ID', () => {
      expect(() => {
        manager.deployModel(null as any, 'production');
      }).toThrow();
    });

    it('should handle undefined model ID', () => {
      expect(() => {
        manager.deployModel(undefined as any, 'production');
      }).toThrow();
    });

    it('should handle null environment', () => {
      expect(() => {
        manager.deployModel(modelId, null as any);
      }).toThrow();
    });

    it('should handle empty environment', () => {
      manager.deployModel(modelId, '');
      const model = manager.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.Deployed);
    });
  });

  describe('getModel', () => {
    it('should get existing model', () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const retrieved = manager.getModel(model.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(model.id);
    });

    it('should return undefined for non-existent model', () => {
      const model = manager.getModel('non-existent');
      expect(model).toBeUndefined();
    });

    it('should handle null ID', () => {
      const model = manager.getModel(null as any);
      expect(model).toBeUndefined();
    });

    it('should handle undefined ID', () => {
      const model = manager.getModel(undefined as any);
      expect(model).toBeUndefined();
    });
  });

  describe('listModels', () => {
    beforeEach(() => {
      manager.registerModel({
        name: 'Classification Model',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      manager.registerModel({
        name: 'Regression Model',
        type: ModelType.Regression,
        version: '1.0.0',
        framework: MLFramework.PyTorch,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });
    });

    it('should list all models', () => {
      const models = manager.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', () => {
      const draftModels = manager.listModels({ status: ModelStatus.Draft });
      expect(draftModels.length).toBeGreaterThanOrEqual(2);
      draftModels.forEach(model => {
        expect(model.status).toBe(ModelStatus.Draft);
      });
    });

    it('should filter by type', () => {
      const classificationModels = manager.listModels({
        type: ModelType.Classification,
      });
      expect(classificationModels.length).toBeGreaterThanOrEqual(1);
      classificationModels.forEach(model => {
        expect(model.type).toBe(ModelType.Classification);
      });
    });

    it('should filter by both status and type', () => {
      const models = manager.listModels({
        status: ModelStatus.Draft,
        type: ModelType.Classification,
      });
      expect(models).toBeDefined();
      models.forEach(model => {
        expect(model.status).toBe(ModelStatus.Draft);
        expect(model.type).toBe(ModelType.Classification);
      });
    });

    it('should handle empty filters', () => {
      const models = manager.listModels({});
      expect(models.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle undefined filter', () => {
      const models = manager.listModels(undefined);
      expect(models.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getTrainingJob', () => {
    it('should get existing job', async () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      const job = await manager.trainModel(model.id, config);
      const retrieved = manager.getTrainingJob(job.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
    });

    it('should return undefined for non-existent job', () => {
      const job = manager.getTrainingJob('non-existent');
      expect(job).toBeUndefined();
    });

    it('should handle null ID', () => {
      const job = manager.getTrainingJob(null as any);
      expect(job).toBeUndefined();
    });
  });

  describe('listTrainingJobs', () => {
    it('should list all jobs', async () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(model.id, config);

      const jobs = manager.listTrainingJobs();
      expect(jobs.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by model ID', async () => {
      const model1 = manager.registerModel({
        name: 'Model 1',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const model2 = manager.registerModel({
        name: 'Model 2',
        type: ModelType.Regression,
        version: '1.0.0',
        framework: MLFramework.PyTorch,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(model1.id, config);
      await manager.trainModel(model2.id, config);

      const jobs = manager.listTrainingJobs(model1.id);
      expect(jobs).toBeDefined();
      jobs.forEach(job => {
        expect(job.modelId).toBe(model1.id);
      });
    });

    it('should handle undefined model ID', () => {
      const jobs = manager.listTrainingJobs(undefined);
      expect(jobs).toBeDefined();
    });
  });

  describe('getPredictions', () => {
    let modelId: string;

    beforeEach(async () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });
      modelId = model.id;

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(modelId, config);
      await new Promise(resolve => setTimeout(resolve, 200));

      await manager.predict(modelId, { feature1: 1.0 });
      await manager.predict(modelId, { feature1: 2.0 });
    });

    it('should get all predictions', () => {
      const predictions = manager.getPredictions();
      expect(predictions.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by model ID', () => {
      const predictions = manager.getPredictions(modelId);
      expect(predictions.length).toBeGreaterThanOrEqual(2);
      predictions.forEach(pred => {
        expect(pred.modelId).toBe(modelId);
      });
    });

    it('should respect limit parameter', () => {
      const predictions = manager.getPredictions(undefined, 1);
      expect(predictions.length).toBeLessThanOrEqual(1);
    });

    it('should handle zero limit', () => {
      const predictions = manager.getPredictions(undefined, 0);
      expect(predictions).toHaveLength(0);
    });

    it('should handle negative limit', () => {
      const predictions = manager.getPredictions(undefined, -1);
      expect(predictions).toBeDefined();
    });

    it('should handle undefined model ID', () => {
      const predictions = manager.getPredictions(undefined);
      expect(predictions).toBeDefined();
    });
  });

  describe('Resource Cleanup', () => {
    it('should handle training failures', async () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      // Mock training error
      jest.spyOn(manager as any, 'executeTraining').mockRejectedValue(
        new Error('Training failed')
      );

      const job = await manager.trainModel(model.id, config);
      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedJob = manager.getTrainingJob(job.id);
      // Should handle error gracefully
      expect(updatedJob).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should handle prediction timeout', async () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(model.id, config);
      await new Promise(resolve => setTimeout(resolve, 200));

      jest.spyOn(manager as any, 'executePrediction').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const timeoutPromise = Promise.race([
        manager.predict(model.id, {}),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        ),
      ]);

      await expect(timeoutPromise).rejects.toThrow('Timeout');
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent model operations', async () => {
      const model = manager.registerModel({
        name: 'Test',
        type: ModelType.Classification,
        version: '1.0.0',
        framework: MLFramework.TensorFlow,
        algorithm: 'test',
        hyperparameters: {},
        metrics: {},
        artifacts: [],
        metadata: {
          author: 'Test',
          tags: [],
          dataset: 'test',
          features: [],
        },
      });

      const config: TrainingConfig = {
        epochs: 1,
        batchSize: 32,
        learningRate: 0.001,
        validationSplit: 0.2,
        optimizer: 'adam',
        lossFunction: 'mse',
        callbacks: [],
      };

      await manager.trainModel(model.id, config);
      await new Promise(resolve => setTimeout(resolve, 200));

      const operations = [
        manager.predict(model.id, { feature1: 1.0 }),
        manager.predict(model.id, { feature1: 2.0 }),
        manager.evaluateModel(model.id, []),
      ];

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });
});

describe('FeatureEngineeringManager', () => {
  let manager: FeatureEngineeringManager;

  beforeEach(() => {
    manager = new FeatureEngineeringManager();
  });

  describe('createFeatureSet', () => {
    it('should create feature set', () => {
      const features: Feature[] = [
        {
          name: 'age',
          type: FeatureType.Numeric,
          nullable: false,
          categorical: false,
        },
        {
          name: 'category',
          type: FeatureType.Categorical,
          nullable: true,
          categorical: true,
        },
      ];

      const featureSet = manager.createFeatureSet('test-features', features);

      expect(featureSet).toBeDefined();
      expect(featureSet.id).toBeDefined();
      expect(featureSet.name).toBe('test-features');
      expect(featureSet.features).toEqual(features);
      expect(featureSet.createdAt).toBeInstanceOf(Date);
      expect(featureSet.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle transformations', () => {
      const features: Feature[] = [
        {
          name: 'value',
          type: FeatureType.Numeric,
          nullable: false,
          categorical: false,
        },
      ];

      const transformations = [
        {
          type: TransformationType.Normalize,
          feature: 'value',
          config: {},
        },
      ];

      const featureSet = manager.createFeatureSet(
        'test-features',
        features,
        transformations
      );

      expect(featureSet.transformations).toEqual(transformations);
    });

    it('should handle null name', () => {
      expect(() => {
        manager.createFeatureSet(null as any, []);
      }).toThrow();
    });

    it('should handle undefined name', () => {
      expect(() => {
        manager.createFeatureSet(undefined as any, []);
      }).toThrow();
    });

    it('should handle empty features', () => {
      const featureSet = manager.createFeatureSet('empty', []);
      expect(featureSet.features).toHaveLength(0);
    });

    it('should handle null features', () => {
      expect(() => {
        manager.createFeatureSet('test', null as any);
      }).toThrow();
    });
  });

  describe('transform', () => {
    let featureSetId: string;

    beforeEach(() => {
      const features: Feature[] = [
        {
          name: 'value',
          type: FeatureType.Numeric,
          nullable: false,
          categorical: false,
        },
      ];

      const transformations = [
        {
          type: TransformationType.Normalize,
          feature: 'value',
          config: {},
        },
      ];

      const featureSet = manager.createFeatureSet(
        'test-features',
        features,
        transformations
      );
      featureSetId = featureSet.id;
    });

    it('should transform data', async () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
      ];

      const transformed = await manager.transform(featureSetId, data);

      expect(transformed).toBeDefined();
      expect(transformed).toHaveLength(3);
    });

    it('should throw error for non-existent feature set', async () => {
      await expect(
        manager.transform('non-existent', [])
      ).rejects.toThrow('Feature set not found: non-existent');
    });

    it('should handle null data', async () => {
      await expect(
        manager.transform(featureSetId, null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined data', async () => {
      await expect(
        manager.transform(featureSetId, undefined as any)
      ).rejects.toThrow();
    });

    it('should handle empty data', async () => {
      const transformed = await manager.transform(featureSetId, []);
      expect(transformed).toHaveLength(0);
    });

    it('should apply standardization', async () => {
      const features: Feature[] = [
        {
          name: 'value',
          type: FeatureType.Numeric,
          nullable: false,
          categorical: false,
        },
      ];

      const transformations = [
        {
          type: TransformationType.Standardize,
          feature: 'value',
          config: {},
        },
      ];

      const featureSet = manager.createFeatureSet(
        'standardize-test',
        features,
        transformations
      );

      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
      ];

      const transformed = await manager.transform(featureSet.id, data);
      expect(transformed).toBeDefined();
    });

    it('should apply one-hot encoding', async () => {
      const features: Feature[] = [
        {
          name: 'category',
          type: FeatureType.Categorical,
          nullable: false,
          categorical: true,
        },
      ];

      const transformations = [
        {
          type: TransformationType.OneHotEncode,
          feature: 'category',
          config: {},
        },
      ];

      const featureSet = manager.createFeatureSet(
        'onehot-test',
        features,
        transformations
      );

      const data = [
        { category: 'A' },
        { category: 'B' },
        { category: 'A' },
      ];

      const transformed = await manager.transform(featureSet.id, data);
      expect(transformed).toBeDefined();
      if (transformed.length > 0) {
        expect(transformed[0]).toHaveProperty('category_A');
        expect(transformed[0]).toHaveProperty('category_B');
      }
    });
  });

  describe('calculateStatistics', () => {
    let featureSetId: string;

    beforeEach(() => {
      const features: Feature[] = [
        {
          name: 'value',
          type: FeatureType.Numeric,
          nullable: false,
          categorical: false,
        },
      ];

      const featureSet = manager.createFeatureSet('test-features', features);
      featureSetId = featureSet.id;
    });

    it('should calculate statistics', () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
      ];

      manager.calculateStatistics(featureSetId, data);

      const featureSet = manager.getFeatureSet(featureSetId);
      expect(featureSet?.statistics.count).toBe(3);
    });

    it('should throw error for non-existent feature set', () => {
      expect(() => {
        manager.calculateStatistics('non-existent', []);
      }).toThrow('Feature set not found: non-existent');
    });

    it('should handle null data', () => {
      expect(() => {
        manager.calculateStatistics(featureSetId, null as any);
      }).toThrow();
    });

    it('should handle empty data', () => {
      manager.calculateStatistics(featureSetId, []);
      const featureSet = manager.getFeatureSet(featureSetId);
      expect(featureSet?.statistics.count).toBe(0);
    });
  });

  describe('getFeatureSet', () => {
    it('should get existing feature set', () => {
      const features: Feature[] = [
        {
          name: 'test',
          type: FeatureType.Numeric,
          nullable: false,
          categorical: false,
        },
      ];

      const created = manager.createFeatureSet('test', features);
      const retrieved = manager.getFeatureSet(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent feature set', () => {
      const featureSet = manager.getFeatureSet('non-existent');
      expect(featureSet).toBeUndefined();
    });

    it('should handle null ID', () => {
      const featureSet = manager.getFeatureSet(null as any);
      expect(featureSet).toBeUndefined();
    });
  });

  describe('listFeatureSets', () => {
    beforeEach(() => {
      const features: Feature[] = [
        {
          name: 'test',
          type: FeatureType.Numeric,
          nullable: false,
          categorical: false,
        },
      ];

      manager.createFeatureSet('set1', features);
      manager.createFeatureSet('set2', features);
    });

    it('should list all feature sets', () => {
      const featureSets = manager.listFeatureSets();
      expect(featureSets.length).toBeGreaterThanOrEqual(2);
    });

    it('should return new array each time', () => {
      const list1 = manager.listFeatureSets();
      const list2 = manager.listFeatureSets();

      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);
    });
  });
});

describe('ExperimentTracker', () => {
  let tracker: ExperimentTracker;

  beforeEach(() => {
    tracker = new ExperimentTracker();
  });

  describe('createExperiment', () => {
    it('should create experiment', () => {
      const experiment = tracker.createExperiment('Test Experiment', 'Description');

      expect(experiment).toBeDefined();
      expect(experiment.id).toBeDefined();
      expect(experiment.name).toBe('Test Experiment');
      expect(experiment.description).toBe('Description');
      expect(experiment.status).toBe(ExperimentStatus.Active);
      expect(experiment.runs).toEqual([]);
      expect(experiment.createdAt).toBeInstanceOf(Date);
      expect(experiment.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle null name', () => {
      expect(() => {
        tracker.createExperiment(null as any);
      }).toThrow();
    });

    it('should handle undefined name', () => {
      expect(() => {
        tracker.createExperiment(undefined as any);
      }).toThrow();
    });

    it('should handle empty name', () => {
      const experiment = tracker.createExperiment('');
      expect(experiment.name).toBe('');
    });

    it('should handle undefined description', () => {
      const experiment = tracker.createExperiment('Test');
      expect(experiment.description).toBeUndefined();
    });
  });

  describe('logRun', () => {
    let experimentId: string;

    beforeEach(() => {
      const experiment = tracker.createExperiment('Test Experiment');
      experimentId = experiment.id;
    });

    it('should log run', () => {
      const run = tracker.logRun(
        experimentId,
        'model-123',
        { learning_rate: 0.01 },
        { accuracy: 0.95 }
      );

      expect(run).toBeDefined();
      expect(run.id).toBeDefined();
      expect(run.experimentId).toBe(experimentId);
      expect(run.modelId).toBe('model-123');
      expect(run.parameters).toEqual({ learning_rate: 0.01 });
      expect(run.metrics).toEqual({ accuracy: 0.95 });
    });

    it('should update experiment', () => {
      tracker.logRun(
        experimentId,
        'model-123',
        {},
        { accuracy: 0.95 }
      );

      const experiment = tracker.getExperiment(experimentId);
      expect(experiment?.runs).toHaveLength(1);
      expect(experiment?.bestRun).toBeDefined();
    });

    it('should throw error for non-existent experiment', () => {
      expect(() => {
        tracker.logRun('non-existent', 'model-123', {}, {});
      }).toThrow('Experiment not found: non-existent');
    });

    it('should handle null experiment ID', () => {
      expect(() => {
        tracker.logRun(null as any, 'model-123', {}, {});
      }).toThrow();
    });

    it('should handle null parameters', () => {
      expect(() => {
        tracker.logRun(experimentId, 'model-123', null as any, {});
      }).toThrow();
    });

    it('should handle null metrics', () => {
      expect(() => {
        tracker.logRun(experimentId, 'model-123', {}, null as any);
      }).toThrow();
    });

    it('should handle empty parameters and metrics', () => {
      const run = tracker.logRun(experimentId, 'model-123', {}, {});
      expect(run).toBeDefined();
    });

    it('should update best run', () => {
      tracker.logRun(experimentId, 'model-1', {}, { accuracy: 0.80 });
      tracker.logRun(experimentId, 'model-2', {}, { accuracy: 0.90 });

      const experiment = tracker.getExperiment(experimentId);
      const bestRun = experiment?.runs.find(r => r.id === experiment.bestRun);

      expect(bestRun?.metrics.accuracy).toBe(0.90);
    });
  });

  describe('compareRuns', () => {
    let experimentId: string;
    let runIds: string[];

    beforeEach(() => {
      const experiment = tracker.createExperiment('Test Experiment');
      experimentId = experiment.id;

      const run1 = tracker.logRun(
        experimentId,
        'model-1',
        { learning_rate: 0.01 },
        { accuracy: 0.80 }
      );

      const run2 = tracker.logRun(
        experimentId,
        'model-2',
        { learning_rate: 0.001 },
        { accuracy: 0.85 }
      );

      runIds = [run1.id, run2.id];
    });

    it('should compare runs', () => {
      const comparison = tracker.compareRuns(runIds);

      expect(comparison).toBeDefined();
      expect(comparison.runs).toHaveLength(2);
      expect(comparison.parameters).toBeDefined();
      expect(comparison.metrics).toBeDefined();
    });

    it('should aggregate parameters', () => {
      const comparison = tracker.compareRuns(runIds);

      expect(comparison.parameters).toHaveProperty('learning_rate');
      expect(comparison.parameters.learning_rate).toHaveLength(2);
    });

    it('should aggregate metrics', () => {
      const comparison = tracker.compareRuns(runIds);

      expect(comparison.metrics).toHaveProperty('accuracy');
      expect(comparison.metrics.accuracy).toHaveLength(2);
    });

    it('should handle null run IDs', () => {
      expect(() => {
        tracker.compareRuns(null as any);
      }).toThrow();
    });

    it('should handle empty run IDs', () => {
      const comparison = tracker.compareRuns([]);
      expect(comparison.runs).toHaveLength(0);
    });

    it('should handle non-existent run IDs', () => {
      const comparison = tracker.compareRuns(['non-existent']);
      expect(comparison.runs).toHaveLength(0);
    });
  });

  describe('getExperiment', () => {
    it('should get existing experiment', () => {
      const created = tracker.createExperiment('Test');
      const retrieved = tracker.getExperiment(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent experiment', () => {
      const experiment = tracker.getExperiment('non-existent');
      expect(experiment).toBeUndefined();
    });

    it('should handle null ID', () => {
      const experiment = tracker.getExperiment(null as any);
      expect(experiment).toBeUndefined();
    });
  });

  describe('listExperiments', () => {
    beforeEach(() => {
      tracker.createExperiment('Experiment 1');
      tracker.createExperiment('Experiment 2');
    });

    it('should list all experiments', () => {
      const experiments = tracker.listExperiments();
      expect(experiments.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', () => {
      const activeExperiments = tracker.listExperiments({
        status: ExperimentStatus.Active,
      });

      expect(activeExperiments.length).toBeGreaterThanOrEqual(2);
      activeExperiments.forEach(exp => {
        expect(exp.status).toBe(ExperimentStatus.Active);
      });
    });

    it('should handle undefined filter', () => {
      const experiments = tracker.listExperiments(undefined);
      expect(experiments.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty filter', () => {
      const experiments = tracker.listExperiments({});
      expect(experiments.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('Singleton Instances', () => {
  it('should export mlModelManager singleton', () => {
    expect(mlModelManager).toBeInstanceOf(MLModelManager);
  });

  it('should export featureEngineeringManager singleton', () => {
    expect(featureEngineeringManager).toBeInstanceOf(FeatureEngineeringManager);
  });

  it('should export experimentTracker singleton', () => {
    expect(experimentTracker).toBeInstanceOf(ExperimentTracker);
  });

  it('should use same singleton instances', () => {
    const model = mlModelManager.registerModel({
      name: 'Singleton Test',
      type: ModelType.Classification,
      version: '1.0.0',
      framework: MLFramework.TensorFlow,
      algorithm: 'test',
      hyperparameters: {},
      metrics: {},
      artifacts: [],
      metadata: {
        author: 'Test',
        tags: [],
        dataset: 'test',
        features: [],
      },
    });

    const retrieved = mlModelManager.getModel(model.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(model.id);
  });
});
