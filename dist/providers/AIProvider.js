"use strict";
// Abstract AI Provider interface
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAIProvider = void 0;
class BaseAIProvider {
    buildSystemPrompt(request) {
        return request.systemPrompt || '';
    }
    estimateCost(inputTokens, outputTokens) {
        // Override in subclasses with actual pricing
        return 0;
    }
}
exports.BaseAIProvider = BaseAIProvider;
