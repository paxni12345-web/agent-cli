import { BaseAIProvider } from './AIProvider.js';
import { ChatRequest, ChatResponse, ChatChunk } from '../types/index.js';
export declare class OpenAIProvider extends BaseAIProvider {
    name: string;
    private client;
    private model;
    constructor(apiKey: string, options?: {
        baseUrl?: string;
        model?: string;
    });
    chat(request: ChatRequest): Promise<ChatResponse>;
    /**
     * Map tool choice to OpenAI format
     */
    private mapToolChoice;
    stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}
//# sourceMappingURL=OpenAIProvider.d.ts.map