import { BaseAIProvider } from './AIProvider.js';
import { ChatRequest, ChatResponse, ChatChunk } from '../types/index.js';
export declare class AnthropicProvider extends BaseAIProvider {
    name: string;
    private client;
    constructor(apiKey: string, options?: {
        baseUrl?: string;
    });
    chat(request: ChatRequest): Promise<ChatResponse>;
    /**
     * Format messages for Anthropic API
     * Handles both string and ContentBlock[] content
     */
    private formatMessages;
    /**
     * Map tool choice to Anthropic format
     */
    private mapToolChoice;
    stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}
//# sourceMappingURL=AnthropicProvider.d.ts.map