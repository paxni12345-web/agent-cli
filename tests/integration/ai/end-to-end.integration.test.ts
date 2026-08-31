/**
 * End-to-End AI Integration Tests
 * Tests complete workflows integrating multiple AI modules
 */

import { LearningSystem } from '../../../src/ai/LearningSystem';
import { MultiModelOrchestrator, ModelConfig } from '../../../src/ai/MultiModelOrchestrator';
import { MultiModalAIManager } from '../../../src/ai/MultiModalAI';
import AgentOrchestrator from '../../../src/ai/advanced/AgentOrchestration';
import DatasetManager from '../../../src/ai/training/DatasetManager';
import { AIProvider } from '../../../src/providers/AIProvider';
import { ChatRequest, ChatResponse } from '../../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock AI Provider
class TestAIProvider implements AIProvider {
  private responseDelay: number;
  public callLog: Array<{ request: ChatRequest; timestamp: Date }> = [];

  constructor(delay: number = 100) {
    this.responseDelay = delay;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.callLog.push({ request, timestamp: new Date() });
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));

    return {
      content: `AI Response: ${request.messages[0].content}`,
      model: 'test-model',
      usage: {
        prompt_tokens: 50,
        completion_tokens: 30,
        total_tokens: 80
      }
    };
  }
}

describe('End-to-End AI Integration Tests', () => {
  let tempDir: string;
  let learningSystem: LearningSystem;
  let orchestrator: MultiModelOrchestrator;
  let multiModal: MultiModalAIManager;
  let agentOrchestrator: AgentOrchestrator;
  let datasetManager: DatasetManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-ai-test-'));
    learningSystem = new LearningSystem(tempDir);
    orchestrator = new MultiModelOrchestrator();
    multiModal = new MultiModalAIManager();
    agentOrchestrator = new AgentOrchestrator();
    datasetManager = new DatasetManager();

    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    orchestrator.clearHistory();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Complete AI Workflow: Code Analysis', () => {
    it('should execute end-to-end code analysis with learning', async () => {
      // Step 1: Register AI models
      const provider = new TestAIProvider(100);
      const modelConfig: ModelConfig = {
        provider,
        modelName: 'analyzer',
        capabilities: {
          reasoning: 85,
          coding: 90,
          speed: 80,
          costEfficiency: 70,
          contextWindow: 16000,
          multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 3,
        timeout: 10000
      };

      orchestrator.registerModel('analyzer', modelConfig);

      // Step 2: Process code with AI
      const codeRequest: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'Analyze this code: function add(a, b) { return a + b; }'
          }
        ]
      };

      const analysisResult = await orchestrator.route(codeRequest, {
        reasoning: 85,
        coding: 90
      });

      expect(analysisResult).toBeDefined();
      expect(analysisResult.content).toContain('AI Response');

      // Step 3: Record feedback on analysis
      await learningSystem.recordFeedback(
        'code_analysis',
        'use_ai_analyzer',
        1,
        'success',
        { code: 'function add' },
        'Analysis was accurate and helpful'
      );

      // Step 4: Verify learning
      const recommendation = learningSystem.getRecommendation('code_analysis');
      expect(recommendation).toBeDefined();
      expect(recommendation?.confidence).toBeGreaterThan(0);
    });

    it('should coordinate multiple agents for complex task', async () => {
      // Register specialized agents
      const codeAgent = {
        id: 'code-analyzer',
        name: 'Code Analyzer',
        type: 'specialist',
        capabilities: ['read_files', 'analyze_structure'],
        status: 'idle' as const,
        performance: {
          tasksCompleted: 10,
          successRate: 95,
          avgLatency: 500,
          avgQuality: 0.9
        },
        config: {
          maxConcurrency: 3,
          timeout: 10000,
          retries: 2,
          priority: 5
        }
      };

      const testAgent = {
        id: 'test-generator',
        name: 'Test Generator',
        type: 'specialist',
        capabilities: ['test', 'verify'],
        status: 'idle' as const,
        performance: {
          tasksCompleted: 8,
          successRate: 90,
          avgLatency: 600,
          avgQuality: 0.85
        },
        config: {
          maxConcurrency: 2,
          timeout: 8000,
          retries: 2,
          priority: 4
        }
      };

      agentOrchestrator.registerAgent(codeAgent);
      agentOrchestrator.registerAgent(testAgent);

      // Decompose and execute workflow
      const tasks = await agentOrchestrator.decomposeTask(
        'analyze code and generate tests',
        { files: ['main.ts'] }
      );

      const results = await agentOrchestrator.executeWorkflow(tasks);

      expect(results.size).toBeGreaterThan(0);
      expect(tasks.every(t => t.status === 'completed' || t.status === 'failed')).toBe(true);
    });
  });

  describe('Multimodal AI Pipeline', () => {
    it('should process image -> OCR -> AI analysis -> learning', async () => {
      // Step 1: Process image with OCR
      const image = {
        data: Buffer.from('test-document-image'),
        format: 'png' as const
      };

      const ocrResult = await multiModal.extractTextOCR(image);
      expect(ocrResult.predictions.length).toBeGreaterThan(0);

      const extractedText = ocrResult.predictions.map(p => p.label).join(' ');

      // Step 2: Analyze text with AI model
      const provider = new TestAIProvider(50);
      orchestrator.registerModel('text-analyzer', {
        provider,
        modelName: 'text-analyzer',
        capabilities: {
          reasoning: 80,
          coding: 60,
          speed: 90,
          costEfficiency: 85,
          contextWindow: 8000,
          multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 2,
        timeout: 5000
      });

      const analysisRequest: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: `Analyze this extracted text: ${extractedText}`
          }
        ]
      };

      const textAnalysis = await orchestrator.route(analysisRequest);
      expect(textAnalysis).toBeDefined();

      // Step 3: Record learning feedback
      await learningSystem.recordFeedback(
        'ocr_analysis',
        'extract_and_analyze',
        1,
        'success',
        { imageFormat: 'png' },
        'OCR extraction was accurate'
      );

      const stats = learningSystem.getStats();
      expect(stats.totalFeedback).toBeGreaterThan(0);
    });

    it('should handle audio transcription -> dataset creation -> learning', async () => {
      // Step 1: Transcribe audio
      const audio = {
        data: Buffer.from('audio-sample'),
        format: 'mp3' as const,
        duration: 10.0
      };

      const transcription = await multiModal.transcribeAudio(audio);
      expect(transcription.text).toBeDefined();
      expect(transcription.segments).toBeDefined();

      // Step 2: Create training dataset from transcription
      const examples = transcription.segments!.map((seg, i) => ({
        id: `seg_${i}`,
        input: `Transcribe: [audio segment]`,
        output: seg.text,
        quality: seg.confidence
      }));

      const datasetId = datasetManager.createDataset(
        'transcription-training',
        examples,
        {
          description: 'Audio transcription training data',
          tags: ['audio', 'transcription', 'training']
        }
      );

      const dataset = datasetManager.getDataset(datasetId);
      expect(dataset!.examples.length).toBe(examples.length);

      // Step 3: Augment dataset
      await datasetManager.augmentDataset(datasetId, {
        methods: ['paraphrase', 'synonym_replacement'],
        factor: 1,
        preserveOriginal: true
      });

      const augmentedDataset = datasetManager.getDataset(datasetId);
      expect(augmentedDataset!.examples.length).toBeGreaterThan(examples.length);

      // Step 4: Record learning
      await learningSystem.recordFeedback(
        'audio_transcription',
        'transcribe_and_train',
        1,
        'success',
        { datasetSize: augmentedDataset!.examples.length }
      );
    });
  });

  describe('Multi-Model Coordination with Learning', () => {
    it('should route tasks to best model based on learned preferences', async () => {
      // Setup multiple models
      const fastProvider = new TestAIProvider(50);
      const smartProvider = new TestAIProvider(200);

      orchestrator.registerModel('fast', {
        provider: fastProvider,
        modelName: 'fast-model',
        capabilities: {
          reasoning: 70,
          coding: 70,
          speed: 95,
          costEfficiency: 90,
          contextWindow: 8000,
          multimodal: false
        },
        costPerToken: { input: 0.5, output: 1.5 },
        maxRetries: 2,
        timeout: 5000
      });

      orchestrator.registerModel('smart', {
        provider: smartProvider,
        modelName: 'smart-model',
        capabilities: {
          reasoning: 95,
          coding: 90,
          speed: 60,
          costEfficiency: 40,
          contextWindow: 32000,
          multimodal: false
        },
        costPerToken: { input: 5.0, output: 15.0 },
        maxRetries: 3,
        timeout: 15000
      });

      // Execute multiple requests and learn preferences
      const simpleTask: ChatRequest = {
        messages: [{ role: 'user', content: 'Simple formatting question' }]
      };

      const complexTask: ChatRequest = {
        messages: [{ role: 'user', content: 'Complex algorithm design' }]
      };

      // Simple task should use fast model
      await orchestrator.route(simpleTask, { speed: 90, costSensitivity: 80 });
      await learningSystem.recordFeedback(
        'simple_query',
        'use_fast_model',
        1,
        'success',
        {},
        'Fast model was sufficient'
      );

      // Complex task should use smart model
      await orchestrator.route(complexTask, { reasoning: 95, speed: 40 });
      await learningSystem.recordFeedback(
        'complex_query',
        'use_smart_model',
        1,
        'success',
        {},
        'Smart model provided better analysis'
      );

      // Verify learning
      const simpleRec = learningSystem.getRecommendation('simple_query');
      const complexRec = learningSystem.getRecommendation('complex_query');

      expect(simpleRec?.suggestedAction).toContain('fast');
      expect(complexRec?.suggestedAction).toContain('smart');
    });

    it('should handle model failures with automatic fallback and learning', async () => {
      const unreliableProvider = new TestAIProvider(100);
      const reliableProvider = new TestAIProvider(150);

      // Make first provider fail
      unreliableProvider.chat = async () => {
        throw new Error('Provider temporarily unavailable');
      };

      orchestrator.registerModel('unreliable', {
        provider: unreliableProvider,
        modelName: 'unreliable',
        capabilities: {
          reasoning: 90,
          coding: 90,
          speed: 80,
          costEfficiency: 70,
          contextWindow: 16000,
          multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('reliable', {
        provider: reliableProvider,
        modelName: 'reliable',
        capabilities: {
          reasoning: 85,
          coding: 85,
          speed: 75,
          costEfficiency: 75,
          contextWindow: 16000,
          multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 2,
        timeout: 5000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test fallback' }]
      };

      // Should automatically fallback to reliable provider
      const result = await orchestrator.route(request);
      expect(result).toBeDefined();

      // Learn from the failure
      await learningSystem.recordFeedback(
        'model_failure',
        'fallback_to_reliable',
        1,
        'success',
        {},
        'Fallback mechanism worked well'
      );

      const patterns = learningSystem.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Dataset-Driven Model Training Workflow', () => {
    it('should create dataset, augment, filter, and export for training', async () => {
      // Step 1: Create initial dataset
      const trainingExamples = Array.from({ length: 20 }, (_, i) => ({
        id: `train_${i}`,
        input: `Training input ${i}: Please analyze this code snippet`,
        output: `Analysis result ${i}: The code is well-structured`,
        quality: 0.7 + Math.random() * 0.3
      }));

      const datasetId = datasetManager.createDataset(
        'model-training',
        trainingExamples,
        {
          author: 'ai-system',
          description: 'Training data for code analysis model',
          tags: ['training', 'code-analysis']
        }
      );

      // Step 2: Augment dataset
      const augmented = await datasetManager.augmentDataset(datasetId, {
        methods: ['paraphrase', 'synonym_replacement'],
        factor: 2,
        preserveOriginal: true
      });

      expect(augmented).toBeGreaterThan(0);

      // Step 3: Filter for quality
      datasetManager.filterDataset(datasetId, {
        minLength: 20,
        maxLength: 500,
        minQuality: 0.8,
        removeDuplicates: true,
        removeOutliers: true
      });

      // Step 4: Check for bias
      const biasReport = datasetManager.detectBias(datasetId);
      expect(biasReport).toBeDefined();

      // Step 5: Export for training
      const exported = datasetManager.exportDataset(datasetId, 'jsonl');
      const exportPath = path.join(tempDir, 'training-data.jsonl');
      await fs.writeFile(exportPath, exported);

      const fileStats = await fs.stat(exportPath);
      expect(fileStats.size).toBeGreaterThan(0);

      // Step 6: Record learning about dataset quality
      await learningSystem.recordFeedback(
        'dataset_preparation',
        'augment_and_filter',
        1,
        'success',
        { finalSize: datasetManager.getDataset(datasetId)!.examples.length },
        'Dataset quality is high after augmentation and filtering'
      );
    });

    it('should version datasets and track improvements', async () => {
      // Create initial dataset
      const v1Examples = Array.from({ length: 10 }, (_, i) => ({
        id: `v1_${i}`,
        input: `Input ${i}`,
        output: `Output ${i}`,
        quality: 0.7
      }));

      const datasetId = datasetManager.createDataset('versioned', v1Examples, {});

      // Create version 1.0
      datasetManager.createVersion(datasetId, 'v1.0');

      // Improve dataset
      await datasetManager.augmentDataset(datasetId, {
        methods: ['paraphrase'],
        factor: 1,
        preserveOriginal: true
      });

      datasetManager.filterDataset(datasetId, {
        minLength: 5,
        maxLength: 1000,
        minQuality: 0.75,
        removeDuplicates: true,
        removeOutliers: false
      });

      // Create version 2.0
      datasetManager.createVersion(datasetId, 'v2.0');

      // Compare versions
      const v1 = datasetManager.getVersion(datasetId, 'v1.0');
      const v2 = datasetManager.getVersion(datasetId, 'v2.0');

      expect(v2!.examples.length).toBeGreaterThanOrEqual(v1!.examples.length);

      // Learn from improvement
      await learningSystem.recordFeedback(
        'dataset_versioning',
        'augment_and_version',
        1,
        'success',
        {
          v1Size: v1!.examples.length,
          v2Size: v2!.examples.length
        }
      );
    });
  });

  describe('Concurrent AI Operations at Scale', () => {
    it('should handle high-volume concurrent requests', async () => {
      const provider = new TestAIProvider(50);
      orchestrator.registerModel('scalable', {
        provider,
        modelName: 'scalable',
        capabilities: {
          reasoning: 80,
          coding: 80,
          speed: 85,
          costEfficiency: 80,
          contextWindow: 8000,
          multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 2,
        timeout: 5000
      });

      // Create 50 concurrent requests
      const requests = Array.from({ length: 50 }, (_, i) =>
        orchestrator.route({
          messages: [{ role: 'user', content: `Request ${i}` }]
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(results.every(r => r.content)).toBe(true);

      // Should complete in reasonable time (concurrent, not sequential)
      expect(duration).toBeLessThan(5000);

      // Record performance learning
      await learningSystem.recordFeedback(
        'concurrent_processing',
        'batch_requests',
        1,
        'success',
        { requestCount: 50, duration }
      );
    });

    it('should process mixed multimodal operations concurrently', async () => {
      const operations = [
        // Image operations
        ...Array.from({ length: 10 }, (_, i) =>
          multiModal.classifyImage({
            data: Buffer.from(`image-${i}`),
            format: 'jpeg'
          })
        ),
        // Audio operations
        ...Array.from({ length: 10 }, (_, i) =>
          multiModal.transcribeAudio({
            data: Buffer.from(`audio-${i}`),
            format: 'mp3'
          })
        ),
        // Video operations
        ...Array.from({ length: 5 }, (_, i) =>
          multiModal.analyzeVideo({
            data: Buffer.from(`video-${i}`),
            format: 'mp4'
          })
        )
      ];

      const results = await Promise.all(operations);
      expect(results).toHaveLength(25);
      expect(results.every(r => r.metadata)).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from provider failures and continue processing', async () => {
      let callCount = 0;
      const flakeyProvider = new TestAIProvider(100);
      const originalChat = flakeyProvider.chat.bind(flakeyProvider);

      flakeyProvider.chat = async (request: ChatRequest) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Temporary failure');
        }
        return originalChat(request);
      };

      const fallbackProvider = new TestAIProvider(100);

      orchestrator.registerModel('flakey', {
        provider: flakeyProvider,
        modelName: 'flakey',
        capabilities: {
          reasoning: 85,
          coding: 85,
          speed: 80,
          costEfficiency: 75,
          contextWindow: 8000,
          multimodal: false
        },
        costPerToken: { input: 1.5, output: 4.5 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('fallback', {
        provider: fallbackProvider,
        modelName: 'fallback',
        capabilities: {
          reasoning: 80,
          coding: 80,
          speed: 85,
          costEfficiency: 80,
          contextWindow: 8000,
          multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 2,
        timeout: 5000
      });

      // Send 10 requests - some will fail and fallback
      const requests = Array.from({ length: 10 }, (_, i) =>
        orchestrator.route({
          messages: [{ role: 'user', content: `Request ${i}` }]
        })
      );

      const results = await Promise.all(requests);
      expect(results.every(r => r.content)).toBe(true);
    });

    it('should handle file system errors and continue learning', async () => {
      // Create learning system with restricted permissions
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.mkdir(restrictedDir);

      const restrictedSystem = new LearningSystem(restrictedDir);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make directory read-only
      await fs.chmod(restrictedDir, 0o444);

      try {
        // Should not crash even with write errors
        await restrictedSystem.recordFeedback(
          'test',
          'action',
          1,
          'success'
        );

        const stats = restrictedSystem.getStats();
        expect(stats.totalFeedback).toBeGreaterThanOrEqual(0);
      } finally {
        await fs.chmod(restrictedDir, 0o755);
      }
    });
  });

  describe('Cross-Module Data Flow', () => {
    it('should flow data through complete AI pipeline', async () => {
      // 1. Multimodal input processing
      const image = {
        data: Buffer.from('code-screenshot'),
        format: 'png' as const
      };

      const ocrResult = await multiModal.extractTextOCR(image);
      const code = ocrResult.predictions.map(p => p.label).join(' ');

      // 2. AI analysis
      const provider = new TestAIProvider(100);
      orchestrator.registerModel('analyzer', {
        provider,
        modelName: 'analyzer',
        capabilities: {
          reasoning: 85,
          coding: 90,
          speed: 75,
          costEfficiency: 70,
          contextWindow: 16000,
          multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 2,
        timeout: 10000
      });

      const analysis = await orchestrator.route({
        messages: [{ role: 'user', content: `Analyze: ${code}` }]
      });

      // 3. Create training example
      const example = {
        id: 'flow_1',
        input: code,
        output: analysis.content,
        quality: 0.9
      };

      const datasetId = datasetManager.createDataset('pipeline', [example], {});

      // 4. Record learning
      await learningSystem.recordFeedback(
        'ocr_to_training',
        'complete_pipeline',
        1,
        'success',
        { datasetId }
      );

      // Verify complete flow
      expect(ocrResult).toBeDefined();
      expect(analysis).toBeDefined();
      expect(datasetManager.getDataset(datasetId)).toBeDefined();
      expect(learningSystem.getStats().totalFeedback).toBeGreaterThan(0);
    });
  });
});
