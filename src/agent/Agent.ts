import { EventEmitter } from 'events';
import {
  AgentState,
  ChatMessage,
  ContentBlock,
  ToolCall,
  ToolExecution,
  ToolResult,
  Config,
  AgentError,
  PermissionManager,
} from '../types/index.js';
import { AIProvider } from '../providers/AIProvider.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ToolCallValidator } from './ToolCallValidator.js';
import { ErrorRecoverySystem } from './ErrorRecoverySystem.js';
import { ToolPerformanceMonitor } from './ToolPerformanceMonitor.js';
import { CircuitBreaker } from './CircuitBreaker.js';

export class Agent extends EventEmitter {
  private state: AgentState;
  private provider: AIProvider;
  private toolRegistry: ToolRegistry;
  private permissions: PermissionManager;
  private config: Config;
  private toolCache = new Map<string, { result: ToolResult; timestamp: number }>();
  private validator = new ToolCallValidator();
  private errorRecovery = new ErrorRecoverySystem();
  private performanceMonitor = new ToolPerformanceMonitor();
  private circuitBreaker = new CircuitBreaker();
  private activeTimers = new Set<NodeJS.Timeout>();

  private static readonly READ_ONLY_TOOLS = new Set([
    'list_files',
    'read_file',
    'search_code',
    'git_status',
    'git_diff',
    'git_log',
  ]);

  constructor(
    provider: AIProvider,
    toolRegistry: ToolRegistry,
    permissions: PermissionManager,
    config: Config
  ) {
    super();
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
  }

  async run(userMessage: string): Promise<string> {
    this.setStatus('thinking');
    this.state.currentTask = userMessage;
    this.state.iterationCount = 0;

    this.cleanupOldCache();
    this.trimConversationHistory();

    this.addMessage({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    let finalResponse = '';

    try {
      while (this.state.iterationCount < this.config.maxIterations) {
        this.state.iterationCount++;
        this.emit('iteration', this.state.iterationCount, this.config.maxIterations);

        const response = await this.provider.chat({
          messages: this.state.conversationMessages,
          temperature: this.config.temperature,
          maxTokens: 8192,
          systemPrompt: this.buildSystemPrompt(),
          tools: this.toolRegistry.getSchemas(),
          toolChoice: 'auto',
        });

        if (response.usage) {
          this.emit('tokenUsage', response.usage);
        }

        if (response.content) {
          finalResponse = response.content;
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          this.setStatus('executing');

          this.addMessage({
            role: 'assistant',
            content: response.content || '',
            toolCalls: response.toolCalls,
            timestamp: new Date(),
          });

          const toolResults: ContentBlock[] = [];

          for (const toolCall of response.toolCalls) {
            this.emit('toolStart', { id: toolCall.id, name: toolCall.name, input: toolCall.input });

            const result = await this.executeToolWithRetry(toolCall);

            const execution: ToolExecution = {
              tool: toolCall.name,
              input: toolCall.input,
              result,
              timestamp: new Date(),
            };
            this.state.history.push(execution);
            this.performanceMonitor.record(execution);
            this.emit('toolEnd', execution);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: result.success ? result.output || 'Success' : `Error: ${result.error}`,
              is_error: !result.success,
            });
          }

          this.addMessage({
            role: 'user',
            content: toolResults,
            timestamp: new Date(),
          });
          continue;
        }

        this.addMessage({
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        });
        this.setStatus('completed');
        break;
      }

      if (this.state.iterationCount >= this.config.maxIterations) {
        throw new AgentError(
          `Maximum iterations (${this.config.maxIterations}) reached`,
          'MAX_ITERATIONS'
        );
      }

      return finalResponse;
    } catch (error) {
      this.setStatus('error_recovery');
      throw error;
    }
  }

  private async executeToolWithRetry(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    let current = toolCall;
    let lastError: { error?: string; message?: string } | null = null;
    const maxRetries = this.config.enableToolRetry ? this.config.maxToolRetries! : 1;

    if (this.circuitBreaker.isOpen(toolCall.name)) {
      const state = this.circuitBreaker.getState(toolCall.name);
      const cooldownSec = Math.ceil(state.cooldownRemaining / 1000);
      return {
        success: false,
        error: `Tool '${toolCall.name}' is temporarily unavailable (circuit open, cooldown ${cooldownSec}s)`,
        isError: true,
        retryable: false,
        executionTime: Date.now() - startTime,
      };
    }

    if (this.isCacheable(toolCall.name)) {
      const cached = this.toolCache.get(this.getCacheKey(toolCall));
      if (cached && Date.now() - cached.timestamp < 60_000) {
        return { ...cached.result, cached: true };
      }
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.executeToolWithTimeout(current);
        result.executionTime = Date.now() - startTime;

        if (result.success) {
          this.circuitBreaker.recordSuccess(current.name);
          if (this.isCacheable(current.name)) {
            this.toolCache.set(this.getCacheKey(current), { result, timestamp: Date.now() });
          }
          return result;
        }

        lastError = result;

        if (this.config.autoRecovery && attempt < maxRetries - 1) {
          const recovery = this.errorRecovery.recover(
            result.error || 'Unknown error',
            current,
            this.state,
            attempt + 1
          );

          if (recovery.action === 'retry') {
            await this.sleep(Math.min(1000 * 2 ** attempt, 5000));
            continue;
          }
          if (recovery.action === 'modify_input' && recovery.modifiedToolCall) {
            current = recovery.modifiedToolCall;
            continue;
          }
          if (recovery.action === 'use_alternative' && recovery.alternativeTool) {
            current = { ...current, name: recovery.alternativeTool };
            continue;
          }
          if (recovery.action === 'abort') {
            break;
          }
        }

        if (attempt < maxRetries - 1) {
          await this.sleep(Math.min(1000 * 2 ** attempt, 5000));
        }
      } catch (error) {
        lastError = error instanceof Error ? { message: error.message } : { message: String(error) };
        if (attempt < maxRetries - 1) {
          await this.sleep(Math.min(1000 * 2 ** attempt, 5000));
        }
      }
    }

    this.circuitBreaker.recordFailure(current.name);
    const errorMsg = lastError?.error || lastError?.message || 'Unknown error';

    return {
      success: false,
      error: `Tool execution failed after ${maxRetries} attempt${maxRetries > 1 ? 's' : ''}: ${errorMsg}`,
      isError: true,
      retryable: this.errorRecovery.isRecoverable(errorMsg),
      executionTime: Date.now() - startTime,
    };
  }

  private async executeToolWithTimeout(toolCall: ToolCall): Promise<ToolResult> {
    const timeout = this.config.toolTimeout!;

    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Tool execution timeout after ${timeout}ms`)),
        timeout
      );
      this.activeTimers.add(timer);
    });

    return Promise.race([this.executeTool(toolCall), timeoutPromise]).finally(() => {
      clearTimeout(timer!);
      this.activeTimers.delete(timer!);
    });
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.toolRegistry.get(toolCall.name);

    if (!tool) {
      const available = this.toolRegistry.list().map(t => t.name).join(', ');
      return {
        success: false,
        error: `Tool '${toolCall.name}' not found. Available tools: ${available}`,
        isError: true,
        retryable: false,
      };
    }

    if (this.config.validateToolInputs && tool.inputSchema) {
      const validation = ToolCallValidator.validate(toolCall, tool.inputSchema as never);

      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid input for tool '${toolCall.name}': ${validation.errors.join(', ')}`,
          isError: true,
          retryable: true,
        };
      }

      if (validation.sanitizedInput !== undefined) {
        toolCall = { ...toolCall, input: validation.sanitizedInput };
      }
    }

    if (this.config.strictToolCalling) {
      const safety = ToolCallValidator.checkSafety(toolCall);
      if (!safety.safe) {
        return {
          success: false,
          error: `Safety check failed: ${safety.issues.join(', ')}`,
          isError: true,
          retryable: false,
        };
      }
    }

    try {
      return await tool.execute(toolCall.input, {
        workspaceRoot: this.config.workspaceRoot,
        permissions: this.permissions,
        currentState: this.state,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        isError: true,
        retryable: true,
      };
    }
  }

  private isCacheable(toolName: string): boolean {
    return this.config.enableToolCache === true && Agent.READ_ONLY_TOOLS.has(toolName);
  }

  private getCacheKey(toolCall: ToolCall): string {
    return `${toolCall.name}:${JSON.stringify(toolCall.input)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const t = setTimeout(resolve, ms);
      t.unref();
    });
  }

  private cleanupOldCache(): void {
    const MAX_CACHE_SIZE = 1000;
    if (this.toolCache.size > MAX_CACHE_SIZE) {
      const sorted = Array.from(this.toolCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );
      for (const [key] of sorted.slice(0, Math.floor(MAX_CACHE_SIZE / 2))) {
        this.toolCache.delete(key);
      }
    }
  }

  private trimConversationHistory(): void {
    const MAX_MESSAGES = 50;
    if (this.state.conversationMessages.length > MAX_MESSAGES) {
      const systemMsgs = this.state.conversationMessages.filter(m => m.role === 'system');
      const recent = this.state.conversationMessages.slice(-(MAX_MESSAGES - systemMsgs.length));
      this.state.conversationMessages = [...systemMsgs, ...recent];
    }
  }

  private buildSystemPrompt(): string {
    const tools = this.toolRegistry.getSchemas();

    return `You are an autonomous AI coding agent with native tool calling capabilities.

You have access to ${tools.length} tools with structured calling support.

TOOL CALLING GUIDELINES:

1. **Tool Input**: Always provide complete input parameters matching the tool's schema.

2. **Tool Selection**:
${tools.map(t => `   - ${t.name}: ${t.description}`).join('\n')}

3. **Execution Flow**:
   - Inspect before acting (use read/list/search tools first)
   - Execute changes
   - Verify results
   - Iterate if needed

4. **Best Practices**:
   - Use read_file before edit_file to understand context
   - Use search_code to find relevant code
   - Use shell to run tests and verify changes

5. **Completion**: Continue using tools until the task is fully complete. Don't stop after the first tool call.

Current workspace: ${this.config.workspaceRoot}
Permission mode: ${this.config.permissionMode}
Iteration: ${this.state.iterationCount}/${this.config.maxIterations}

Think step by step and complete the task thoroughly.`;
  }

  private addMessage(message: ChatMessage): void {
    this.state.conversationMessages.push(message);
    this.emit('message', message);
  }

  private setStatus(status: AgentState['status']): void {
    this.state.status = status;
    this.emit('status', status);
  }

  updateConfig(partial: Partial<Config>): void {
    this.config = { ...this.config, ...partial };
    this.provider.setModel?.(this.config.model);
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getPerformanceMonitor(): ToolPerformanceMonitor {
    return this.performanceMonitor;
  }

  getErrorRecovery(): ErrorRecoverySystem {
    return this.errorRecovery;
  }

  exportPerformanceData(): string {
    return this.performanceMonitor.export();
  }

  reset(): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.toolCache.clear();
    this.state = {
      status: 'idle',
      history: [],
      conversationMessages: [],
      iterationCount: 0,
      metadata: {},
    };
    this.emit('status', 'idle');
  }
}
