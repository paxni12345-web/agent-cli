import { ChatRequest, ChatResponse, ChatChunk } from '../types/index.js';

export interface AIProvider {
  name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  setModel?(model: string): void;
}

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;

  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract stream(request: ChatRequest): AsyncIterable<ChatChunk>;

  setModel(model: string): void {
    (this as { model?: string }).model = model;
  }

  protected buildSystemPrompt(request: ChatRequest): string {
    return request.systemPrompt || '';
  }
}
