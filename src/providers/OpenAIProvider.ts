// OpenAI Provider Implementation

import OpenAI from 'openai';
import { BaseAIProvider } from './AIProvider.js';
import { ChatRequest, ChatResponse, ChatChunk, ToolCall, ProviderError } from '../types/index.js';

export class OpenAIProvider extends BaseAIProvider {
  name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, options?: { baseUrl?: string; model?: string }) {
    super();
    this.model = options?.model || 'gpt-4-turbo-preview';
    this.client = new OpenAI({
      apiKey,
      baseURL: options?.baseUrl,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add system message if present
      const systemPrompt = this.buildSystemPrompt(request);
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      // Add conversation messages
      for (const msg of request.messages) {
        if (msg.role !== 'system') {
          if (typeof msg.content === 'string') {
            messages.push({
              role: msg.role,
              content: msg.content,
            } as any);
          } else {
            // Handle content blocks (tool results)
            messages.push({
              role: msg.role,
              content: msg.content,
            } as any);
          }
        }
      }

      // Build API request
      const apiRequest: any = {
        model: this.model,
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 8192,
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        apiRequest.tools = request.tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        }));

        // Add tool_choice if specified
        if (request.toolChoice) {
          apiRequest.tool_choice = this.mapToolChoice(request.toolChoice);
        }
      }

      const response = await this.client.chat.completions.create(apiRequest);

      const choice = response.choices[0];
      const content = choice.message.content || '';
      const toolCalls: ToolCall[] = [];

      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: choice.finish_reason === 'stop' ? 'stop' :
                      choice.finish_reason === 'tool_calls' ? 'tool_use' :
                      choice.finish_reason === 'length' ? 'max_tokens' : 'stop',
        usage: response.usage ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        rawResponse: response,
      };
    } catch (error: any) {
      throw new ProviderError(
        `OpenAI API error: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Map tool choice to OpenAI format
   */
  private mapToolChoice(choice: ChatRequest['toolChoice']): any {
    if (!choice || choice === 'auto') {
      return 'auto';
    }
    if (choice === 'any') {
      return 'required';
    }
    if (choice === 'none') {
      return 'none';
    }
    if (typeof choice === 'object' && 'name' in choice) {
      return {
        type: 'function',
        function: { name: choice.name },
      };
    }
    return 'auto';
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      const systemPrompt = this.buildSystemPrompt(request);
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      for (const msg of request.messages) {
        if (msg.role !== 'system') {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 8192,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield { delta: delta.content };
        }
      }
    } catch (error: any) {
      throw new ProviderError(
        `OpenAI streaming error: ${error.message}`,
        { originalError: error }
      );
    }
  }
}
