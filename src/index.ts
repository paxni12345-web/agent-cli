/**
 * Agent CLI — Public API
 *
 * Exports the core building blocks of the agent:
 * - Agent: the autonomous agentic loop
 * - Providers: Anthropic (Claude) & OpenAI
 * - Tools: file, shell, search, git
 * - Config: loader with env override
 * - Permissions: mode-based permission manager
 */

export { Agent } from './agent/Agent.js';
export { ToolCallValidator } from './agent/ToolCallValidator.js';
export { CircuitBreaker } from './agent/CircuitBreaker.js';
export { ErrorRecoverySystem } from './agent/ErrorRecoverySystem.js';
export { ToolPerformanceMonitor } from './agent/ToolPerformanceMonitor.js';

export { BaseAIProvider } from './providers/AIProvider.js';
export type { AIProvider } from './providers/AIProvider.js';
export { AnthropicProvider } from './providers/AnthropicProvider.js';
export { OpenAIProvider } from './providers/OpenAIProvider.js';

export { ToolRegistry } from './tools/ToolRegistry.js';
export { ListFilesTool, ReadFileTool, WriteFileTool, EditFileTool } from './tools/FileTools.js';
export { ShellTool } from './tools/ShellTool.js';
export { SearchCodeTool } from './tools/SearchTool.js';
export { GitStatusTool, GitDiffTool, GitLogTool } from './tools/GitTools.js';

export { ConfigLoader } from './config/ConfigLoader.js';
export { DefaultPermissionManager } from './security/PermissionManager.js';

export * from './types/index.js';
