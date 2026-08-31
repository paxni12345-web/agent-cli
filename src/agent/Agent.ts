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

import {
  AgentState,
  AgentStatus,
  ChatMessage,
  ToolCall,
  ToolExecution,
  Config,
  AgentError,
  JSONSchema,
} from '../types/index.js';
import { AIProvider } from '../providers/AIProvider.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { PermissionManager } from '../types/index.js';
import { ToolCallValidator } from './ToolCallValidator.js';
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
export class Agent {
  private state: AgentState;
  private provider: AIProvider;
  private toolRegistry: ToolRegistry;
  private permissions: PermissionManager;
  private config: Config;
  private toolCache: Map<string, { result: any; timestamp: number }>;
  private toolExecutionStats: Map<string, { successCount: number; failCount: number; avgDuration: number }>;
  private validator: ToolCallValidator;
  private errorRecovery: ErrorRecoverySystem;
  private performanceMonitor: ToolPerformanceMonitor;

  /**
   * Constructs a new Agent instance
   *
   * @param provider - AI provider for chat completions (Anthropic, OpenAI, etc.)
   * @param toolRegistry - Registry of available tools the agent can use
   * @param permissions - Permission manager to control tool execution
   * @param config - Configuration including workspace, model settings, etc.
   */
  constructor(
    provider: AIProvider,
    toolRegistry: ToolRegistry,
    permissions: PermissionManager,
    config: Config
  ) {
    this.provider = provider;
    this.toolRegistry = toolRegistry;
    this.permissions = permissions;
    this.config = {
      ...config,
      enableToolRetry: config.enableToolRetry ?? true,
      maxToolRetries: config.maxToolRetries ?? 3,
      enableToolCache: config.enableToolCache ?? true,
      toolTimeout: config.toolTimeout ?? 30000,
      validateToolInputs: config.validateToolInputs ?? true,
      autoRecovery: config.autoRecovery ?? true,
      strictToolCalling: config.strictToolCalling ?? true,
    };

    this.state = {
      status: 'idle',
      history: [],
      conversationMessages: [],
      iterationCount: 0,
      metadata: {},
    };

    this.toolCache = new Map();
    this.toolExecutionStats = new Map();
    this.validator = new ToolCallValidator();
    this.errorRecovery = new ErrorRecoverySystem();
    this.performanceMonitor = new ToolPerformanceMonitor();
  }

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
  async run(userMessage: string): Promise<string> {
    this.state.status = 'thinking';
    this.state.currentTask = userMessage;
    this.state.iterationCount = 0;

    // Add user message to conversation
    this.addMessage({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    let finalResponse = '';

    try {
      while (this.state.iterationCount < this.config.maxIterations) {
        this.state.iterationCount++;

        if (this.config.debug) {
          console.log(`\n[Iteration ${this.state.iterationCount}/${this.config.maxIterations}]`);
        }

        // Get AI response with tools
        const response = await this.provider.chat({
          messages: this.state.conversationMessages,
          temperature: this.config.temperature,
          maxTokens: 8192,
          systemPrompt: this.buildSystemPrompt(),
          tools: this.toolRegistry.getSchemas(),
          toolChoice: 'auto',
        });

        // Add assistant response to conversation
        if (response.content) {
          finalResponse = response.content;
        }

        // Check if agent wants to use tools
        if (response.toolCalls && response.toolCalls.length > 0) {
          this.state.status = 'executing';

          if (this.config.debug) {
            console.log(`\n→ Tool calls detected: ${response.toolCalls.length}`);
          }

          // Add assistant message with tool calls
          this.addMessage({
            role: 'assistant',
            content: response.content || '',
            timestamp: new Date(),
            toolCalls: response.toolCalls,
          });

          // Execute all tool calls and collect results
          const toolResults: any[] = [];

          for (const toolCall of response.toolCalls) {
            const result = await this.executeToolWithRetry(toolCall);

            // Store in history
            this.state.history.push({
              tool: toolCall.name,
              input: toolCall.input,
              result,
              timestamp: new Date(),
            });

            // Format for API
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: result.success
                ? (result.output || 'Success')
                : `Error: ${result.error}`,
              is_error: !result.success,
            });
          }

          // Add tool results back to conversation as content blocks
          this.addMessage({
            role: 'user',
            content: toolResults,
            timestamp: new Date(),
          });

          // Continue loop to get next agent response
          continue;
        } else {
          // No tool calls - add final assistant message
          this.addMessage({
            role: 'assistant',
            content: response.content,
            timestamp: new Date(),
          });
        }

        // No tool calls - agent is done
        this.state.status = 'completed';
        break;
      }

      if (this.state.iterationCount >= this.config.maxIterations) {
        throw new AgentError(
          `Maximum iterations (${this.config.maxIterations}) reached`,
          'MAX_ITERATIONS'
        );
      }

      return finalResponse;
    } catch (error: any) {
      this.state.status = 'error_recovery';
      throw error;
    }
  }

  /**
   * Executes a tool call with retry, caching, validation, and timeout
   *
   * @param toolCall - The tool call containing name and input parameters
   * @returns Tool execution result with success/error status
   * @private
   */
  private async executeToolWithRetry(toolCall: ToolCall): Promise<any> {
    const startTime = Date.now();
    let lastError: any = null;
    let currentToolCall = toolCall;
    const maxRetries = this.config.enableToolRetry ? this.config.maxToolRetries! : 1;

    // Check cache first
    if (this.config.enableToolCache) {
      const cacheKey = this.getCacheKey(toolCall);
      const cached = this.toolCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
        if (this.config.debug) {
          console.log(`\n→ Using cached result for: ${toolCall.name}`);
        }
        return { ...cached.result, cached: true };
      }
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0 && this.config.debug) {
          console.log(`\n→ Retry attempt ${attempt + 1}/${maxRetries} for: ${toolCall.name}`);
        }

        const result = await this.executeToolWithTimeout(currentToolCall);

        // Record execution in performance monitor
        const execution: ToolExecution = {
          tool: currentToolCall.name,
          input: currentToolCall.input,
          result,
          timestamp: new Date(),
          retryCount: attempt,
          duration: Date.now() - startTime,
        };
        this.performanceMonitor.record(execution);

        // If successful, cache and return
        if (result.success) {
          // Update stats
          this.updateToolStats(currentToolCall.name, true, Date.now() - startTime);

          // Cache successful results
          if (this.config.enableToolCache) {
            const cacheKey = this.getCacheKey(currentToolCall);
            this.toolCache.set(cacheKey, { result, timestamp: Date.now() });
          }

          result.executionTime = Date.now() - startTime;
          result.retryable = false;

          return result;
        }

        // Failed - try error recovery if enabled
        if (this.config.autoRecovery && attempt < maxRetries - 1) {
          const recoveryAction = this.errorRecovery.recover(
            result.error || 'Unknown error',
            currentToolCall,
            this.state,
            attempt + 1
          );

          if (this.config.debug) {
            console.log(`  🔧 Recovery action: ${recoveryAction.action}`);
            console.log(`  📝 Reason: ${recoveryAction.reason}`);
          }

          if (recoveryAction.action === 'retry') {
            // Wait before retry with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else if (recoveryAction.action === 'modify_input' && recoveryAction.modifiedToolCall) {
            // Try with modified input
            currentToolCall = recoveryAction.modifiedToolCall;
            continue;
          } else if (recoveryAction.action === 'use_alternative' && recoveryAction.alternativeTool) {
            // Try alternative tool
            if (this.config.debug) {
              console.log(`  🔀 Switching to alternative tool: ${recoveryAction.alternativeTool}`);
            }
            currentToolCall = {
              ...currentToolCall,
              name: recoveryAction.alternativeTool,
            };
            continue;
          } else if (recoveryAction.action === 'abort') {
            // Abort immediately
            lastError = result;
            break;
          }
        }

        lastError = result;

        if (attempt < maxRetries - 1) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error: any) {
        lastError = error;

        if (attempt < maxRetries - 1) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    this.updateToolStats(currentToolCall.name, false, Date.now() - startTime);

    // Record failed execution
    const execution: ToolExecution = {
      tool: currentToolCall.name,
      input: currentToolCall.input,
      result: lastError,
      timestamp: new Date(),
      retryCount: maxRetries - 1,
      duration: Date.now() - startTime,
    };
    this.performanceMonitor.record(execution);

    const errorMsg = lastError?.error || lastError?.message || 'Unknown error';

    return {
      success: false,
      error: `Tool execution failed after ${maxRetries} attempts: ${errorMsg}`,
      isError: true,
      retryable: this.errorRecovery.isRecoverable(errorMsg),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Executes a tool with timeout
   */
  private async executeToolWithTimeout(toolCall: ToolCall): Promise<any> {
    const timeout = this.config.toolTimeout!;

    return Promise.race([
      this.executeTool(toolCall),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Executes a single tool call with validation
   *
   * @param toolCall - The tool call containing name and input parameters
   * @returns Tool execution result with success/error status
   * @private
   */
  private async executeTool(toolCall: ToolCall): Promise<any> {
    const startTime = Date.now();
    const tool = this.toolRegistry.get(toolCall.name);

    if (!tool) {
      const availableTools = this.toolRegistry.list().map(t => t.name).join(', ');
      return {
        success: false,
        error: `Tool '${toolCall.name}' not found. Available tools: ${availableTools}`,
        isError: true,
        retryable: false,
      };
    }

    // Check if tool should be avoided based on performance
    const avoidCheck = this.performanceMonitor.shouldAvoidTool(toolCall.name);
    if (avoidCheck.avoid && this.config.debug) {
      console.log(`  ⚠️  Warning: ${avoidCheck.reason}`);
    }

    // Validate input if enabled
    if (this.config.validateToolInputs && tool.inputSchema) {
      const validation = ToolCallValidator.validate(toolCall, tool.inputSchema);

      if (!validation.valid) {
        if (this.config.debug) {
          console.log(`  ❌ Validation failed:`);
          validation.errors.forEach(err => console.log(`     - ${err}`));
        }

        return {
          success: false,
          error: `Invalid input for tool '${toolCall.name}': ${validation.errors.join(', ')}`,
          isError: true,
          retryable: true,
          executionTime: Date.now() - startTime,
        };
      }

      // Show warnings
      if (validation.warnings.length > 0 && this.config.debug) {
        console.log(`  ⚠️  Warnings:`);
        validation.warnings.forEach(warn => console.log(`     - ${warn}`));
      }

      // Use sanitized input
      if (validation.sanitizedInput) {
        toolCall = { ...toolCall, input: validation.sanitizedInput };
      }
    }

    // Safety check
    if (this.config.strictToolCalling) {
      const safety = ToolCallValidator.checkSafety(toolCall);
      if (!safety.safe) {
        if (this.config.debug) {
          console.log(`  🔒 Safety check failed:`);
          safety.issues.forEach(issue => console.log(`     - ${issue}`));
        }

        return {
          success: false,
          error: `Safety check failed: ${safety.issues.join(', ')}`,
          isError: true,
          retryable: false,
          executionTime: Date.now() - startTime,
        };
      }
    }

    if (this.config.debug) {
      console.log(`\n→ Executing: ${toolCall.name}`);
      console.log(`  Input: ${JSON.stringify(toolCall.input, null, 2)}`);
    }

    try {
      const result = await tool.execute(toolCall.input, {
        workspaceRoot: this.config.workspaceRoot,
        permissions: this.permissions,
        currentState: this.state,
      });

      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      if (this.config.debug) {
        console.log(`  Success: ${result.success}`);
        if (result.output) {
          const preview = result.output.substring(0, 200);
          console.log(`  Output: ${preview}${result.output.length > 200 ? '...' : ''}`);
        }
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
        console.log(`  Duration: ${executionTime}ms`);
      }

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (this.config.debug) {
        console.log(`  Exception: ${error.message}`);
        console.log(`  Duration: ${executionTime}ms`);
      }

      return {
        success: false,
        error: error.message,
        isError: true,
        retryable: true,
        executionTime,
      };
    }
  }

  /**
   * Generates cache key for tool call
   */
  private getCacheKey(toolCall: ToolCall): string {
    return `${toolCall.name}:${JSON.stringify(toolCall.input)}`;
  }

  /**
   * Updates tool execution statistics
   */
  private updateToolStats(toolName: string, success: boolean, duration: number): void {
    const stats = this.toolExecutionStats.get(toolName) || {
      successCount: 0,
      failCount: 0,
      avgDuration: 0,
    };

    if (success) {
      stats.successCount++;
    } else {
      stats.failCount++;
    }

    const totalCalls = stats.successCount + stats.failCount;
    stats.avgDuration = (stats.avgDuration * (totalCalls - 1) + duration) / totalCalls;

    this.toolExecutionStats.set(toolName, stats);
  }

  /**
   * Gets tool execution statistics
   */
  getToolStats(): Map<string, { successCount: number; failCount: number; avgDuration: number }> {
    return new Map(this.toolExecutionStats);
  }

  /**
   * Gets performance monitor
   */
  getPerformanceMonitor(): ToolPerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * Gets error recovery system
   */
  getErrorRecovery(): ErrorRecoverySystem {
    return this.errorRecovery;
  }

  /**
   * Prints performance report
   */
  printPerformanceReport(): void {
    this.performanceMonitor.printReport();
  }

  /**
   * Exports performance data
   */
  exportPerformanceData(): string {
    return this.performanceMonitor.export();
  }

  /**
   * Builds the system prompt with available tools and guidelines
   *
   * @returns System prompt string for the AI provider
   * @private
   */
  private buildSystemPrompt(): string {
    const tools = this.toolRegistry.getSchemas();
    const stats = this.getToolStats();

    let statsInfo = '';
    if (stats.size > 0 && this.config.debug) {
      statsInfo = '\n\nTool Performance Stats:\n';
      stats.forEach((stat, toolName) => {
        const successRate = ((stat.successCount / (stat.successCount + stat.failCount)) * 100).toFixed(1);
        statsInfo += `- ${toolName}: ${successRate}% success, avg ${stat.avgDuration.toFixed(0)}ms\n`;
      });
    }

    return `You are an autonomous AI coding agent with native tool calling capabilities.

You have access to ${tools.length} tools with structured calling support.

IMPORTANT TOOL CALLING GUIDELINES:

1. **Native Tool Support**: You can call tools directly using the tool_use format. The system will automatically execute them and return results.

2. **Tool Input Validation**: Always provide complete and valid input parameters matching the tool's schema. Invalid inputs will be rejected with clear error messages.

3. **Error Handling**: If a tool fails:
   - Read the error message carefully
   - Correct the parameters or approach
   - Try again with the fix
   - The system will automatically retry transient failures

4. **Tool Selection**: Choose the right tool for the task:
${tools.map(t => `   - ${t.name}: ${t.description}`).join('\n')}

5. **Execution Flow**:
   - Inspect before acting (use read/list tools first)
   - Plan your approach
   - Execute changes
   - Verify results
   - Iterate if needed

6. **Best Practices**:
   - Use read_file before edit_file to understand context
   - Use search_code to find relevant code
   - Use shell to run tests and verify changes
   - Always validate your changes

7. **Self-Correction**: If something fails, analyze why and try a different approach.

8. **Completion**: Continue using tools until the task is fully complete. Don't stop after the first tool call.
${statsInfo}
Current workspace: ${this.config.workspaceRoot}
Permission mode: ${this.config.permissionMode}
Iteration: ${this.state.iterationCount}/${this.config.maxIterations}

Features enabled:
- Tool retry: ${this.config.enableToolRetry ? 'Yes' : 'No'}
- Input validation: ${this.config.validateToolInputs ? 'Yes' : 'No'}
- Caching: ${this.config.enableToolCache ? 'Yes' : 'No'}
- Auto recovery: ${this.config.autoRecovery ? 'Yes' : 'No'}

Think step by step and complete the task thoroughly.`;
  }

  /**
   * Adds a message to the conversation history
   *
   * @param message - Chat message to add
   * @private
   */
  private addMessage(message: ChatMessage): void {
    this.state.conversationMessages.push(message);
  }

  /**
   * Gets a copy of the current agent state
   *
   * @returns A shallow copy of the agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Resets the agent to initial idle state
   *
   * Clears conversation history, execution history, and resets status.
   * Useful for starting fresh without creating a new agent instance.
   */
  reset(): void {
    this.state = {
      status: 'idle',
      history: [],
      conversationMessages: [],
      iterationCount: 0,
      metadata: {},
    };
  }
}
