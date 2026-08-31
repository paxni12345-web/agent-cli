/**
 * Unit tests for OpenAI Provider
 */

import { OpenAIProvider } from '../../src/providers/OpenAIProvider';
import { ChatRequest } from '../../src/types';

// Mock OpenAI SDK
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockClient: any;

  beforeEach(() => {
    const OpenAI = require('openai');
    provider = new OpenAIProvider('test-api-key');
    mockClient = new OpenAI();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello from GPT!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        maxTokens: 1024,
      };

      const response = await provider.chat(request);

      expect(response.content).toBe('Hello from GPT!');
      expect(response.finishReason).toBe('stop');
      expect(response.usage?.inputTokens).toBe(10);
      expect(response.usage?.outputTokens).toBe(5);
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
          max_tokens: 1024,
          temperature: 0.7,
        })
      );
    });

    it('should handle tool calls (function calling)', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'read_file',
                    arguments: '{"path": "/test.txt"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 20,
          total_tokens: 35,
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Read test.txt' }],
      };

      const response = await provider.chat(request);

      expect(response.finishReason).toBe('tool_use');
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0]).toEqual({
        id: 'call_1',
        name: 'read_file',
        input: { path: '/test.txt' },
      });
    });

    it('should handle API errors', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await expect(provider.chat(request)).rejects.toThrow('OpenAI API error');
    });

    it('should include system prompt in messages', async () => {
      const mockResponse = {
        choices: [
          {
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'You are helpful',
      };

      await provider.chat(request);

      const call = mockClient.chat.completions.create.mock.calls[0][0];
      expect(call.messages[0].role).toBe('system');
      expect(call.messages[0].content).toBe('You are helpful');
    });
  });

  describe('constructor', () => {
    it('should create provider with custom model', () => {
      const customProvider = new OpenAIProvider('key', {
        model: 'gpt-4',
      });

      expect(customProvider.name).toBe('openai');
    });

    it('should create provider with custom baseURL', () => {
      const customProvider = new OpenAIProvider('key', {
        baseUrl: 'https://custom.openai.com',
      });

      expect(customProvider.name).toBe('openai');
    });
  });
});
