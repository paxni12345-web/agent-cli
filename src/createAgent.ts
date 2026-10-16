import { Agent } from './agent/Agent.js';
import { AIProvider } from './providers/AIProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { ParallelProvider } from './providers/ParallelProvider.js';
import { createDefaultToolRegistry } from './tools/index.js';
import { DefaultPermissionManager } from './security/PermissionManager.js';
import { Config } from './types/index.js';

/** Picks the provider implementation named in the config. */
export function createProvider(config: Config, apiKey: string): AIProvider {
  // A "virtual" model: PARALLEL_MODEL_NAME (default iris-parallel) fans out to PARALLEL_MODELS and merges the answers.
  const parallel = (process.env.PARALLEL_MODELS ?? '').split(',').map(m => m.trim()).filter(Boolean);
  if (parallel.length > 0 && config.model === (process.env.PARALLEL_MODEL_NAME || 'iris-parallel')) {
    const build = (model: string): AIProvider => createProvider({ ...config, model }, apiKey);
    return new ParallelProvider(parallel.map(build), build(process.env.PARALLEL_JUDGE || parallel[0] || ''));
  }
  if (config.provider === 'anthropic') {
    return new AnthropicProvider(apiKey, { baseUrl: config.baseUrl, model: config.model, thinkingLevel: config.thinkingLevel });
  }
  if (config.provider === 'openai') {
    return new OpenAIProvider(apiKey, { baseUrl: config.baseUrl, model: config.model, thinkingLevel: config.thinkingLevel });
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}

/** Builds a fully wired Agent: provider + tools + permissions from one config. */
export function createAgent(config: Config, apiKey: string): Agent {
  return new Agent(
    createProvider(config, apiKey),
    createDefaultToolRegistry(),
    new DefaultPermissionManager(config.permissionMode),
    config
  );
}
