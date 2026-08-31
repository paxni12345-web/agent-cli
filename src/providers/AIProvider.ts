// Abstract AI Provider interface

import { ChatRequest, ChatResponse, ChatChunk } from '../types/index.js';

export interface AIProvider {
  name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;

  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract stream(request: ChatRequest): AsyncIterable<ChatChunk>;

  protected buildSystemPrompt(request: ChatRequest): string {
    return request.systemPrompt || '';
  }

  protected estimateCost(inputTokens: number, outputTokens: number): number {
    // Override in subclasses with actual pricing
    return 0;
  }
}
