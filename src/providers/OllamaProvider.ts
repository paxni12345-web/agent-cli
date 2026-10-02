import { BaseAIProvider } from './AIProvider.js';
import {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ToolCall,
  ProviderError,
  ContentBlock,
  ThinkingLevel,
} from '../types/index.js';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider extends BaseAIProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;
  private thinkingLevel: ThinkingLevel;

  constructor(
    options?: { baseUrl?: string; model?: string; thinkingLevel?: ThinkingLevel }
  ) {
    super();
    this.baseUrl = (options?.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    this.model = options?.model || 'mistral';
    this.thinkingLevel = options?.thinkingLevel || 'off';
  }

  setModel(model: string): void {
    this.model = model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const messages = this.formatMessages(request.messages);
      const systemPrompt = this.buildSystemPrompt(request);

      // Prepend system prompt as first message if provided
      if (systemPrompt) {
        messages.unshift({
          role: 'system',
          content: systemPrompt,
        });
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          temperature: request.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as OllamaChatResponse;

      // Ollama doesn't natively support tool calling like Anthropic/OpenAI
      // So we return the raw response and let the agent framework handle it
      return {
        content: data.message.content,
        toolCalls: undefined,
        finishReason: 'stop',
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      throw new ProviderError(
        `Ollama provider error: ${error instanceof Error ? error.message : String(error)}`,
        'ollama_error',
        { cause: error }
      );
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    try {
      const messages = this.formatMessages(request.messages);
      const systemPrompt = this.buildSystemPrompt(request);

      if (systemPrompt) {
        messages.unshift({
          role: 'system',
          content: systemPrompt,
        });
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          temperature: request.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      if (!response.body) {
        throw new Error('No response body from Ollama');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const chunk = JSON.parse(line) as OllamaStreamChunk;
              if (chunk.message?.content) {
                yield {
                  type: 'text',
                  text: chunk.message.content,
                  index: 0,
                };
              }

              if (chunk.done) {
                yield {
                  type: 'end',
                  index: 0,
                  usage: {
                    inputTokens: chunk.prompt_eval_count || 0,
                    outputTokens: chunk.eval_count || 0,
                    totalTokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
                  },
                };
              }
            } catch (e) {
              // Skip malformed JSON lines
              continue;
            }
          }
        }

        if (buffer.trim()) {
          try {
            const chunk = JSON.parse(buffer) as OllamaStreamChunk;
            if (chunk.message?.content) {
              yield {
                type: 'text',
                text: chunk.message.content,
                index: 0,
              };
            }
            if (chunk.done) {
              yield {
                type: 'end',
                index: 0,
                usage: {
                  inputTokens: chunk.prompt_eval_count || 0,
                  outputTokens: chunk.eval_count || 0,
                  totalTokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
                },
              };
            }
          } catch (e) {
            // Skip final buffer if not valid JSON
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw new ProviderError(
        `Ollama stream error: ${error instanceof Error ? error.message : String(error)}`,
        'ollama_stream_error',
        { cause: error }
      );
    }
  }

  private formatMessages(messages: Array<{ role: 'user' | 'assistant'; content: ContentBlock[] }>): OllamaMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content
        .map((block) => {
          if (block.type === 'text') {
            return block.text;
          }
          // Ollama doesn't support images natively, so we skip them
          return '';
        })
        .filter((text) => text.length > 0)
        .join('\n'),
    }));
  }
}
