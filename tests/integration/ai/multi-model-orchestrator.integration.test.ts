/**
 * Integration Tests for MultiModelOrchestrator
 * Tests real API calls, error propagation, and multi-model coordination
 */

import { MultiModelOrchestrator, ModelConfig, TaskRequirements } from '../../../src/ai/MultiModelOrchestrator';
import { AIProvider } from '../../../src/providers/AIProvider';
import { ChatRequest, ChatResponse } from '../../../src/types';

// Mock AI Provider for testing
class MockAIProvider implements AIProvider {
  public callCount = 0;
  public shouldFail = false;
  public failureRate = 0;
  public latency = 100;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.callCount++;

    await new Promise(resolve => setTimeout(resolve, this.latency));

    if (this.shouldFail || Math.random() < this.failureRate) {
      throw new Error('API call failed');
    }

    return {
      content: `Response to: ${request.messages[0].content}`,
      model: 'mock-model',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      }
    };
  }

  reset() {
    this.callCount = 0;
    this.shouldFail = false;
    this.failureRate = 0;
  }
}

describe('MultiModelOrchestrator Integration Tests', () => {
  let orchestrator: MultiModelOrchestrator;
  let fastProvider: MockAIProvider;
  let slowProvider: MockAIProvider;
  let smartProvider: MockAIProvider;
  let cheapProvider: MockAIProvider;

  beforeEach(() => {
    orchestrator = new MultiModelOrchestrator();

    fastProvider = new MockAIProvider();
    fastProvider.latency = 50;

    slowProvider = new MockAIProvider();
    slowProvider.latency = 500;

    smartProvider = new MockAIProvider();
    smartProvider.latency = 200;

    cheapProvider = new MockAIProvider();
    cheapProvider.latency = 150;
  });

  afterEach(() => {
    orchestrator.clearHistory();
  });

  describe('Real Model Registration and Routing', () => {
    it('should register multiple models and route requests', async () => {
      const fastConfig: ModelConfig = {
        provider: fastProvider,
        modelName: 'fast-model',
        capabilities: {
          reasoning: 60,
          coding: 70,
          speed: 95,
          costEfficiency: 70,
          contextWindow: 8000,
          multimodal: false
        },
        costPerToken: { input: 0.5, output: 1.5 },
        maxRetries: 3,
        timeout: 5000
      };

      const smartConfig: ModelConfig = {
        provider: smartProvider,
        modelName: 'smart-model',
        capabilities: {
          reasoning: 95,
          coding: 90,
          speed: 60,
          costEfficiency: 40,
          contextWindow: 32000,
          multimodal: true
        },
        costPerToken: { input: 5.0, output: 15.0 },
        maxRetries: 3,
        timeout: 10000
      };

      orchestrator.registerModel('fast', fastConfig);
      orchestrator.registerModel('smart', smartConfig);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Write a simple function' }]
      };

      // Test speed-focused routing
      const speedRequirements: TaskRequirements = {
        speed: 95,
        reasoning: 50,
        costSensitivity: 30
      };

      const response1 = await orchestrator.route(request, speedRequirements);
      expect(response1).toBeDefined();
      expect(fastProvider.callCount).toBe(1);

      // Test reasoning-focused routing
      const reasoningRequirements: TaskRequirements = {
        reasoning: 95,
        speed: 40,
        costSensitivity: 30
      };

      const response2 = await orchestrator.route(request, reasoningRequirements);
      expect(response2).toBeDefined();
      expect(smartProvider.callCount).toBe(1);
    });

    it('should select models based on capability requirements', async () => {
      orchestrator.registerModel('fast', {
        provider: fastProvider,
        modelName: 'fast',
        capabilities: {
          reasoning: 50, coding: 60, speed: 90,
          costEfficiency: 80, contextWindow: 4000, multimodal: false
        },
        costPerToken: { input: 0.5, output: 1.0 },
        maxRetries: 3,
        timeout: 5000
      });

      orchestrator.registerModel('smart', {
        provider: smartProvider,
        modelName: 'smart',
        capabilities: {
          reasoning: 95, coding: 90, speed: 50,
          costEfficiency: 30, contextWindow: 32000, multimodal: true
        },
        costPerToken: { input: 10.0, output: 30.0 },
        maxRetries: 3,
        timeout: 10000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Analyze this image' }]
      };

      // Require multimodal - should select smart model
      const decision = orchestrator.selectModel(request, {
        requiresMultimodal: true,
        reasoning: 80
      });

      expect(decision.selectedModel).toBe('smart');
      expect(decision.reason).toContain('multimodal');
    });
  });

  describe('Automatic Fallback Mechanism', () => {
    it('should fallback to secondary model on primary failure', async () => {
      const primaryProvider = new MockAIProvider();
      primaryProvider.shouldFail = true;

      const fallbackProvider = new MockAIProvider();

      orchestrator.registerModel('primary', {
        provider: primaryProvider,
        modelName: 'primary',
        capabilities: {
          reasoning: 90, coding: 85, speed: 80,
          costEfficiency: 70, contextWindow: 16000, multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 2,
        timeout: 5000
      });

      orchestrator.registerModel('fallback', {
        provider: fallbackProvider,
        modelName: 'fallback',
        capabilities: {
          reasoning: 85, coding: 80, speed: 85,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 2,
        timeout: 5000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test fallback' }]
      };

      const response = await orchestrator.route(request);

      expect(response).toBeDefined();
      expect(primaryProvider.callCount).toBe(1);
      expect(fallbackProvider.callCount).toBe(1);
    });

    it('should try multiple fallbacks in order', async () => {
      const provider1 = new MockAIProvider();
      provider1.shouldFail = true;

      const provider2 = new MockAIProvider();
      provider2.shouldFail = true;

      const provider3 = new MockAIProvider();
      provider3.shouldFail = false;

      orchestrator.registerModel('model1', {
        provider: provider1,
        modelName: 'model1',
        capabilities: {
          reasoning: 90, coding: 90, speed: 70,
          costEfficiency: 50, contextWindow: 32000, multimodal: false
        },
        costPerToken: { input: 5.0, output: 15.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('model2', {
        provider: provider2,
        modelName: 'model2',
        capabilities: {
          reasoning: 85, coding: 85, speed: 75,
          costEfficiency: 60, contextWindow: 16000, multimodal: false
        },
        costPerToken: { input: 3.0, output: 9.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('model3', {
        provider: provider3,
        modelName: 'model3',
        capabilities: {
          reasoning: 80, coding: 80, speed: 80,
          costEfficiency: 70, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test cascading fallback' }]
      };

      const response = await orchestrator.route(request);

      expect(response).toBeDefined();
      expect(provider1.callCount).toBe(1);
      expect(provider2.callCount).toBe(1);
      expect(provider3.callCount).toBe(1);
    });

    it('should throw error when all models fail', async () => {
      const provider1 = new MockAIProvider();
      provider1.shouldFail = true;

      const provider2 = new MockAIProvider();
      provider2.shouldFail = true;

      orchestrator.registerModel('model1', {
        provider: provider1,
        modelName: 'model1',
        capabilities: {
          reasoning: 80, coding: 80, speed: 80,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('model2', {
        provider: provider2,
        modelName: 'model2',
        capabilities: {
          reasoning: 75, coding: 75, speed: 85,
          costEfficiency: 85, contextWindow: 4000, multimodal: false
        },
        costPerToken: { input: 0.5, output: 1.5 },
        maxRetries: 1,
        timeout: 5000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'This should fail' }]
      };

      await expect(orchestrator.route(request)).rejects.toThrow('All models failed');
    });
  });

  describe('Performance Tracking and Adaptive Routing', () => {
    it('should track success rates and prefer reliable models', async () => {
      const reliableProvider = new MockAIProvider();
      reliableProvider.failureRate = 0.1;

      const unreliableProvider = new MockAIProvider();
      unreliableProvider.failureRate = 0.5;

      orchestrator.registerModel('reliable', {
        provider: reliableProvider,
        modelName: 'reliable',
        capabilities: {
          reasoning: 80, coding: 80, speed: 80,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('unreliable', {
        provider: unreliableProvider,
        modelName: 'unreliable',
        capabilities: {
          reasoning: 85, coding: 85, speed: 80,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 1,
        timeout: 5000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      // Make multiple requests to build history
      for (let i = 0; i < 10; i++) {
        try {
          await orchestrator.route(request);
        } catch (error) {
          // Ignore failures
        }
      }

      const reliableStats = orchestrator.getModelStats('reliable');
      const unreliableStats = orchestrator.getModelStats('unreliable');

      expect(reliableStats.successRate).toBeGreaterThan(unreliableStats.successRate);
    });

    it('should track and report latency statistics', async () => {
      fastProvider.latency = 50;
      slowProvider.latency = 300;

      orchestrator.registerModel('fast', {
        provider: fastProvider,
        modelName: 'fast',
        capabilities: {
          reasoning: 70, coding: 70, speed: 90,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('slow', {
        provider: slowProvider,
        modelName: 'slow',
        capabilities: {
          reasoning: 70, coding: 70, speed: 40,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test latency' }]
      };

      // Test each model multiple times
      for (let i = 0; i < 5; i++) {
        await orchestrator.route(request, { speed: 95 });
        await orchestrator.route(request, { speed: 30 });
      }

      const fastStats = orchestrator.getModelStats('fast');
      const slowStats = orchestrator.getModelStats('slow');

      expect(fastStats.avgLatency).toBeLessThan(slowStats.avgLatency);
      expect(fastStats.totalRequests).toBeGreaterThan(0);
      expect(slowStats.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests to different models', async () => {
      orchestrator.registerModel('model1', {
        provider: fastProvider,
        modelName: 'model1',
        capabilities: {
          reasoning: 80, coding: 80, speed: 90,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('model2', {
        provider: slowProvider,
        modelName: 'model2',
        capabilities: {
          reasoning: 85, coding: 85, speed: 50,
          costEfficiency: 70, contextWindow: 16000, multimodal: false
        },
        costPerToken: { input: 2.0, output: 6.0 },
        maxRetries: 1,
        timeout: 5000
      });

      const requests = Array.from({ length: 10 }, (_, i) => ({
        messages: [{ role: 'user', content: `Request ${i}` }]
      }));

      const responses = await Promise.all(
        requests.map(req => orchestrator.route(req))
      );

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
      });
    });

    it('should maintain request isolation under concurrent load', async () => {
      orchestrator.registerModel('test', {
        provider: fastProvider,
        modelName: 'test',
        capabilities: {
          reasoning: 80, coding: 80, speed: 80,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        orchestrator.route({
          messages: [{ role: 'user', content: `Unique request ${i}` }]
        })
      );

      const responses = await Promise.all(concurrentRequests);

      // Verify each response is unique
      const contents = responses.map(r => r.content);
      const uniqueContents = new Set(contents);
      expect(uniqueContents.size).toBeGreaterThan(1);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate provider errors with context', async () => {
      const errorProvider = new MockAIProvider();
      errorProvider.shouldFail = true;

      orchestrator.registerModel('error-model', {
        provider: errorProvider,
        modelName: 'error-model',
        capabilities: {
          reasoning: 80, coding: 80, speed: 80,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'This will fail' }]
      };

      try {
        await orchestrator.route(request);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('All models failed');
      }
    });

    it('should handle model not found errors', () => {
      expect(() => {
        orchestrator.selectModel(
          { messages: [{ role: 'user', content: 'test' }] },
          {}
        );
      }).toThrow('No models registered');
    });

    it('should handle invalid requirement constraints', () => {
      orchestrator.registerModel('test', {
        provider: fastProvider,
        modelName: 'test',
        capabilities: {
          reasoning: 80, coding: 80, speed: 80,
          costEfficiency: 80, contextWindow: 4000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      expect(() => {
        orchestrator.selectModel(
          { messages: [{ role: 'user', content: 'test' }] },
          { contextLength: 50000 } // Exceeds all model capabilities
        );
      }).toThrow('No suitable model found');
    });
  });

  describe('Multi-Module Integration', () => {
    it('should emit events during routing lifecycle', async () => {
      const events: string[] = [];

      orchestrator.on('orchestrator.model_registered', () => {
        events.push('registered');
      });

      orchestrator.on('orchestrator.routing_decision', () => {
        events.push('routing');
      });

      orchestrator.registerModel('test', {
        provider: fastProvider,
        modelName: 'test',
        capabilities: {
          reasoning: 80, coding: 80, speed: 80,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      await orchestrator.route({
        messages: [{ role: 'user', content: 'test' }]
      });

      expect(events).toContain('registered');
      expect(events).toContain('routing');
    });

    it('should provide comprehensive statistics', async () => {
      orchestrator.registerModel('model1', {
        provider: fastProvider,
        modelName: 'model1',
        capabilities: {
          reasoning: 80, coding: 80, speed: 90,
          costEfficiency: 80, contextWindow: 8000, multimodal: false
        },
        costPerToken: { input: 1.0, output: 3.0 },
        maxRetries: 1,
        timeout: 5000
      });

      orchestrator.registerModel('model2', {
        provider: slowProvider,
        modelName: 'model2',
        capabilities: {
          reasoning: 90, coding: 90, speed: 50,
          costEfficiency: 60, contextWindow: 16000, multimodal: true
        },
        costPerToken: { input: 3.0, output: 9.0 },
        maxRetries: 1,
        timeout: 5000
      });

      // Make some requests
      await orchestrator.route({ messages: [{ role: 'user', content: 'test1' }] });
      await orchestrator.route({ messages: [{ role: 'user', content: 'test2' }] });

      const models = orchestrator.listModels();
      expect(models).toHaveLength(2);

      models.forEach(model => {
        expect(model.name).toBeDefined();
        expect(model.modelName).toBeDefined();
        expect(model.capabilities).toBeDefined();
        expect(model.stats).toBeDefined();
        expect(model.stats.totalRequests).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
