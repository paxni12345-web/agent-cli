/**
 * Agent Core - The main autonomous agent loop
 *
 * This is the central orchestrator that manages the agent's execution cycle,
 * handling communication with AI providers, tool execution, and state management.
 *
 * @example
 * ```typescript
 * const agent = new Agent(provider, toolRegistry, permissions, config);
 * const response = await agent.run("Create a new React component");
 * ```
 */
import { AgentState, Config } from '../types/index.js';
import { AIProvider } from '../providers/AIProvider.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { PermissionManager } from '../types/index.js';
import { ErrorRecoverySystem } from './ErrorRecoverySystem.js';
import { ToolPerformanceMonitor } from './ToolPerformanceMonitor.js';
/**
 * Main Agent class that orchestrates autonomous AI-powered tasks
 *
 * The Agent class implements an agentic loop that:
 * 1. Receives user input
 * 2. Calls AI provider for reasoning
 * 3. Executes tools as needed
 * 4. Iterates until task completion or max iterations reached
 */
export declare class Agent {
    private state;
    private provider;
    private toolRegistry;
    private permissions;
    private config;
    private toolCache;
    private toolExecutionStats;
    private validator;
    private errorRecovery;
    private performanceMonitor;
    private circuitBreaker;
    /**
     * Constructs a new Agent instance
     *
     * @param provider - AI provider for chat completions (Anthropic, OpenAI, etc.)
     * @param toolRegistry - Registry of available tools the agent can use
     * @param permissions - Permission manager to control tool execution
     * @param config - Configuration including workspace, model settings, etc.
     */
    constructor(provider: AIProvider, toolRegistry: ToolRegistry, permissions: PermissionManager, config: Config);
    /**
     * Clean up old cache entries to prevent memory leaks
     * @private
     */
    private cleanupOldCache;
    /**
     * Trim conversation history to prevent memory bloat
     * @private
     */
    private trimConversationHistory;
    /**
     * Runs the agent with a user message and executes the agentic loop
     *
     * This is the main entry point for agent execution. It will:
     * 1. Add user message to conversation history
     * 2. Loop: Call AI provider -> Execute tools -> Repeat
     * 3. Continue until task is complete or max iterations reached
     *
     * @param userMessage - The user's task or question
     * @returns The final response from the agent
     * @throws {AgentError} If max iterations are exceeded or critical error occurs
     *
     * @example
     * ```typescript
     * const response = await agent.run("Add error handling to the login function");
     * console.log(response);
     * ```
     */
    run(userMessage: string): Promise<string>;
    /**
     * Executes a tool call with retry, caching, validation, and timeout
     *
     * @param toolCall - The tool call containing name and input parameters
     * @returns Tool execution result with success/error status
     * @private
     */
    private executeToolWithRetry;
    /**
     * Executes a tool with timeout
     */
    private executeToolWithTimeout;
    /**
     * Executes a single tool call with validation
     *
     * @param toolCall - The tool call containing name and input parameters
     * @returns Tool execution result with success/error status
     * @private
     */
    private executeTool;
    /**
     * Generates cache key for tool call
     */
    private getCacheKey;
    /**
     * Updates tool execution statistics
     */
    private updateToolStats;
    /**
     * Gets tool execution statistics
     */
    getToolStats(): Map<string, {
        successCount: number;
        failCount: number;
        avgDuration: number;
    }>;
    /**
     * Gets performance monitor
     */
    getPerformanceMonitor(): ToolPerformanceMonitor;
    /**
     * Gets error recovery system
     */
    getErrorRecovery(): ErrorRecoverySystem;
    /**
     * Prints performance report
     */
    printPerformanceReport(): void;
    /**
     * Exports performance data
     */
    exportPerformanceData(): string;
    /**
     * Builds the system prompt with available tools and guidelines
     *
     * @returns System prompt string for the AI provider
     * @private
     */
    private buildSystemPrompt;
    /**
     * Adds a message to the conversation history
     *
     * @param message - Chat message to add
     * @private
     */
    private addMessage;
    /**
     * Gets a copy of the current agent state
     *
     * @returns A shallow copy of the agent state
     */
    getState(): AgentState;
    /**
     * Resets the agent to initial idle state
     *
     * Clears conversation history, execution history, and resets status.
     * Useful for starting fresh without creating a new agent instance.
     */
    reset(): void;
}
//# sourceMappingURL=Agent.d.ts.map