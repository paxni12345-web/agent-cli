"use strict";
// OpenAI Provider Implementation
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const AIProvider_js_1 = require("./AIProvider.js");
const index_js_1 = require("../types/index.js");
class OpenAIProvider extends AIProvider_js_1.BaseAIProvider {
    name = 'openai';
    client;
    model;
    constructor(apiKey, options) {
        super();
        this.model = options?.model || 'gpt-4-turbo-preview';
        this.client = new openai_1.default({
            apiKey,
            baseURL: options?.baseUrl,
        });
    }
    async chat(request) {
        try {
            const messages = [];
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
                        });
                    }
                    else {
                        // Handle content blocks (tool results)
                        messages.push({
                            role: msg.role,
                            content: msg.content,
                        });
                    }
                }
            }
            // Build API request
            const apiRequest = {
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
            const toolCalls = [];
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
        }
        catch (error) {
            throw new index_js_1.ProviderError(`OpenAI API error: ${error.message}`, { originalError: error });
        }
    }
    /**
     * Map tool choice to OpenAI format
     */
    mapToolChoice(choice) {
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
    async *stream(request) {
        try {
            const messages = [];
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
        }
        catch (error) {
            throw new index_js_1.ProviderError(`OpenAI streaming error: ${error.message}`, { originalError: error });
        }
    }
}
exports.OpenAIProvider = OpenAIProvider;
