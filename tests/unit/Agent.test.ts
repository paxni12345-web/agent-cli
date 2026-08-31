/**
 * Unit tests for Agent class
 */

import { Agent } from '../../src/agent/Agent';
import { AIProvider } from '../../src/providers/AIProvider';
import { ToolRegistry } from '../../src/tools/ToolRegistry';
import { PermissionManager, Config, ChatRequest, ChatResponse } from '../../src/types';

// Mock AI Provider
class MockAIProvider extends AIProvider {
  name = 'mock';
  private responses: ChatResponse[] = [];
  private currentIndex = 0;

  setResponses(responses: ChatResponse[]) {
    this.responses = responses;
    this.currentIndex = 0;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.currentIndex >= this.responses.length) {
      return {
        content: 'Task completed',
        finishReason: 'stop',
      };
    }
    return this.responses[this.currentIndex++];
  }

  async *stream(request: ChatRequest): AsyncIterable<any> {
    yield { delta: 'mock stream' };
  }
}

// Mock Permission Manager
class MockPermissionManager implements PermissionManager {
  async requestPermission(action: string, details: any): Promise<boolean> {
    return true;
  }
}

describe('Agent', () => {
  let provider: MockAIProvider;
  let toolRegistry: ToolRegistry;
  let permissions: MockPermissionManager;
  let config: Config;

  beforeEach(() => {
    provider = new MockAIProvider();
    toolRegistry = new ToolRegistry();
    permissions = new MockPermissionManager();
    config = {
      provider: 'mock',
      model: 'mock-model',
      workspaceRoot: '/test',
      permissionMode: 'normal',
      maxIterations: 10,
      temperature: 0.7,
      debug: false,
    };
  });

  describe('constructor', () => {
    it('should create an agent with initial idle state', () => {
      const agent = new Agent(provider, toolRegistry, permissions, config);
      const state = agent.getState();

      expect(state.status).toBe('idle');
      expect(state.iterationCount).toBe(0);
      expect(state.history).toEqual([]);
      expect(state.conversationMessages).toEqual([]);
    });
  });

  describe('run', () => {
    it('should execute simple task without tools', async () => {
      const agent = new Agent(provider, toolRegistry, permissions, config);

      provider.setResponses([
        {
          content: 'I will help you with that task.',
          finishReason: 'stop',
        },
      ]);

      const response = await agent.run('Hello, agent!');

      expect(response).toBe('I will help you with that task.');

      const state = agent.getState();
      expect(state.status).toBe('completed');
      expect(state.iterationCount).toBe(1);
    });

    it('should handle tool calls', async () => {
      const agent = new Agent(provider, toolRegistry, permissions, config);

      // Register a mock tool
      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
        async execute(input: any, context: any) {
          return { success: true, output: 'Tool executed' };
        },
      };
      toolRegistry.register(mockTool);

      provider.setResponses([
        {
          content: 'I will use the tool',
          toolCalls: [
            { id: '1', name: 'test_tool', input: {} },
          ],
          finishReason: 'tool_use',
        },
        {
          content: 'Task completed with tool',
          finishReason: 'stop',
        },
      ]);

      const response = await agent.run('Use the test tool');

      expect(response).toBe('Task completed with tool');

      const state = agent.getState();
      expect(state.status).toBe('completed');
      expect(state.history.length).toBe(1);
      expect(state.history[0].tool).toBe('test_tool');
    });

    it('should throw error when max iterations exceeded', async () => {
      const agent = new Agent(provider, toolRegistry, permissions, {
        ...config,
        maxIterations: 2,
      });

      provider.setResponses([
        {
          content: 'Iteration 1',
          toolCalls: [{ id: '1', name: 'fake_tool', input: {} }],
          finishReason: 'tool_use',
        },
        {
          content: 'Iteration 2',
          toolCalls: [{ id: '2', name: 'fake_tool', input: {} }],
          finishReason: 'tool_use',
        },
      ]);

      await expect(agent.run('Infinite loop task')).rejects.toThrow('Maximum iterations');
    });

    it('should handle tool execution errors gracefully', async () => {
      const agent = new Agent(provider, toolRegistry, permissions, config);

      const errorTool = {
        name: 'error_tool',
        description: 'A tool that fails',
        inputSchema: { type: 'object' },
        async execute(input: any, context: any) {
          throw new Error('Tool failed');
        },
      };
      toolRegistry.register(errorTool);

      provider.setResponses([
        {
          content: 'Using error tool',
          toolCalls: [{ id: '1', name: 'error_tool', input: {} }],
          finishReason: 'tool_use',
        },
        {
          content: 'Handled the error',
          finishReason: 'stop',
        },
      ]);

      const response = await agent.run('Try error tool');

      expect(response).toBe('Handled the error');

      const state = agent.getState();
      expect(state.history[0].result.success).toBe(false);
      expect(state.history[0].result.error).toBe('Tool failed');
    });
  });

  describe('getState', () => {
    it('should return a copy of the state', () => {
      const agent = new Agent(provider, toolRegistry, permissions, config);
      const state1 = agent.getState();
      const state2 = agent.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });
  });

  describe('reset', () => {
    it('should reset agent to initial state', async () => {
      const agent = new Agent(provider, toolRegistry, permissions, config);

      provider.setResponses([
        {
          content: 'Response',
          finishReason: 'stop',
        },
      ]);

      await agent.run('Test task');

      let state = agent.getState();
      expect(state.status).toBe('completed');
      expect(state.iterationCount).toBe(1);
      expect(state.conversationMessages.length).toBeGreaterThan(0);

      agent.reset();

      state = agent.getState();
      expect(state.status).toBe('idle');
      expect(state.iterationCount).toBe(0);
      expect(state.conversationMessages).toEqual([]);
      expect(state.history).toEqual([]);
    });
  });
});
