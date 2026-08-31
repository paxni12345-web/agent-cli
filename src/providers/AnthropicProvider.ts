// Anthropic (Claude) Provider Implementation

import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './AIProvider.js';
import { ChatRequest, ChatResponse, ChatChunk, ToolCall, ProviderError } from '../types/index.js';

export class AnthropicProvider extends BaseAIProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string, options?: { baseUrl?: string }) {
    super();
    this.client = new Anthropic({
      apiKey,
      baseURL: options?.baseUrl,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const messages = this.formatMessages(request.messages);
      const systemPrompt = this.buildSystemPrompt(request);

      // Build API request
      const apiRequest: any = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens || 8192,
        temperature: request.temperature || 0.7,
        system: systemPrompt || undefined,
        messages,
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        apiRequest.tools = request.tools;

        // Add tool_choice if specified
        if (request.toolChoice) {
          apiRequest.tool_choice = this.mapToolChoice(request.toolChoice);
        }
      }

      const response = await this.client.messages.create(apiRequest);

      const toolCalls: ToolCall[] = [];
      let content = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: response.stop_reason === 'end_turn' ? 'stop' :
                      response.stop_reason === 'tool_use' ? 'tool_use' :
                      response.stop_reason === 'max_tokens' ? 'max_tokens' : 'stop',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        rawResponse: response,
      };
    } catch (error: any) {
      throw new ProviderError(
        `Anthropic API error: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Format messages for Anthropic API
   * Handles both string and ContentBlock[] content
   */
  private formatMessages(messages: ChatRequest['messages']): any[] {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (typeof m.content === 'string') {
          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
          };
        } else {
          // Content blocks (for tool results)
          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
          };
        }
      });
  }

  /**
   * Map tool choice to Anthropic format
   */
  private mapToolChoice(choice: ChatRequest['toolChoice']): any {
    if (!choice || choice === 'auto') {
      return { type: 'auto' };
    }
    if (choice === 'any') {
      return { type: 'any' };
    }
    if (choice === 'none') {
      return undefined;
    }
    if (typeof choice === 'object' && 'name' in choice) {
      return { type: 'tool', name: choice.name };
    }
    return { type: 'auto' };
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    try {
      const messages = request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const systemPrompt = this.buildSystemPrompt(request);

      const stream = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens || 8192,
        temperature: request.temperature || 0.7,
        system: systemPrompt || undefined,
        messages,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { delta: event.delta.text };
          }
        }
      }
    } catch (error: any) {
      throw new ProviderError(
        `Anthropic streaming error: ${error.message}`,
        { originalError: error }
      );
    }
  }
}
