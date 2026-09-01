import { ChatRequest, ChatResponse, ChatChunk } from '../types/index.js';
export interface AIProvider {
    name: string;
    chat(request: ChatRequest): Promise<ChatResponse>;
    stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}
export declare abstract class BaseAIProvider implements AIProvider {
    abstract name: string;
    abstract chat(request: ChatRequest): Promise<ChatResponse>;
    abstract stream(request: ChatRequest): AsyncIterable<ChatChunk>;
    protected buildSystemPrompt(request: ChatRequest): string;
    protected estimateCost(inputTokens: number, outputTokens: number): number;
}
//# sourceMappingURL=AIProvider.d.ts.map