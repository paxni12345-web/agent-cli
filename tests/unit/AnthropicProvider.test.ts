/**
 * Unit tests for Anthropic Provider
 */

import { AnthropicProvider } from '../../src/providers/AnthropicProvider';
import { ChatRequest } from '../../src/types';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockClient: any;

  beforeEach(() => {
    const Anthropic = require('@anthropic-ai/sdk');
    provider = new AnthropicProvider('test-api-key');
    mockClient = new Anthropic();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        maxTokens: 1024,
      };

      const response = await provider.chat(request);

      expect(response.content).toBe('Hello!');
      expect(response.finishReason).toBe('stop');
      expect(response.usage?.inputTokens).toBe(10);
      expect(response.usage?.outputTokens).toBe(5);
      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          temperature: 0.7,
        })
      );
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        content: [
          { type: 'text', text: 'I will use a tool' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'read_file',
            input: { path: '/test.txt' },
          },
        ],
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 15,
          output_tokens: 20,
        },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Read test.txt' }],
      };

      const response = await provider.chat(request);

      expect(response.content).toBe('I will use a tool');
      expect(response.finishReason).toBe('tool_use');
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0]).toEqual({
        id: 'tool_1',
        name: 'read_file',
        input: { path: '/test.txt' },
      });
    });

    it('should handle API errors', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('API Error'));

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await expect(provider.chat(request)).rejects.toThrow('Anthropic API error');
    });

    it('should filter system messages and build system prompt', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const request: ChatRequest = {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        systemPrompt: 'Custom system prompt',
      };

      await provider.chat(request);

      const call = mockClient.messages.create.mock.calls[0][0];
      expect(call.messages).toHaveLength(1);
      expect(call.messages[0].role).toBe('user');
      expect(call.system).toBe('Custom system prompt');
    });
  });

  describe('constructor', () => {
    it('should create provider with custom baseURL', () => {
      const customProvider = new AnthropicProvider('key', {
        baseUrl: 'https://custom.api.com',
      });

      expect(customProvider.name).toBe('anthropic');
    });
  });
});
