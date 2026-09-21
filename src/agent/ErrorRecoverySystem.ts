import { ToolCall, AgentState } from '../types/index.js';

export interface RecoveryStrategy {
  name: string;
  description: string;
  canRecover: (error: string, toolCall: ToolCall) => boolean;
  recover: (error: string, toolCall: ToolCall, state: AgentState) => RecoveryAction;
}

export interface RecoveryAction {
  action: 'retry' | 'modify_input' | 'use_alternative' | 'skip' | 'abort';
  reason: string;
  modifiedToolCall?: ToolCall;
  alternativeTool?: string;
  userMessage?: string;
}

export class ErrorRecoverySystem {
  private strategies: RecoveryStrategy[] = [];

  constructor() {
    this.registerDefaultStrategies();
  }

  recover(
    error: string,
    toolCall: ToolCall,
    state: AgentState,
    attemptNumber: number
  ): RecoveryAction {
    for (const strategy of this.strategies) {
      if (strategy.canRecover(error, toolCall)) {
        const action = strategy.recover(error, toolCall, state);

        if (action.action === 'retry' && attemptNumber > 1) {
          action.reason = `${action.reason} (Attempt ${attemptNumber})`;
        }

        return action;
      }
    }

    return {
      action: 'abort',
      reason: 'No recovery strategy available for this error',
      userMessage: `Tool '${toolCall.name}' failed: ${error}`,
    };
  }

  private registerDefaultStrategies(): void {
    this.strategies.push({
      name: 'file_not_found',
      description: 'Handle file not found errors',
      canRecover: error => {
        const lower = error.toLowerCase();
        return (
          lower.includes('no such file') ||
          lower.includes('not found') ||
          lower.includes('enoent')
        );
      },
      recover: () => ({
        action: 'retry',
        reason: 'File not found - verify path and parent directories',
        userMessage: 'File not found. Consider using list_files or creating the directory first.',
      }),
    });

    this.strategies.push({
      name: 'permission_denied',
      description: 'Handle permission errors',
      canRecover: error => {
        const lower = error.toLowerCase();
        return lower.includes('permission denied') || lower.includes('eacces');
      },
      recover: (_error, toolCall) => ({
        action: 'abort',
        reason: 'Permission denied - cannot proceed',
        userMessage: `Permission denied for ${toolCall.name}. Check file/directory permissions.`,
      }),
    });

    this.strategies.push({
      name: 'timeout',
      description: 'Handle timeout errors',
      canRecover: error => {
        const lower = error.toLowerCase();
        return lower.includes('timeout') || lower.includes('timed out');
      },
      recover: (_error, toolCall) => ({
        action: 'retry',
        reason: 'Operation timed out - retrying',
        userMessage: `${toolCall.name} timed out. Will retry...`,
      }),
    });

    this.strategies.push({
      name: 'invalid_json',
      description: 'Handle JSON parsing errors',
      canRecover: error => {
        const lower = error.toLowerCase();
        return lower.includes('json') || lower.includes('parse');
      },
      recover: (_error, toolCall) => ({
        action: 'modify_input',
        reason: 'Invalid JSON format - attempting to fix',
        modifiedToolCall: this.fixJsonInput(toolCall),
      }),
    });

    this.strategies.push({
      name: 'network_error',
      description: 'Handle network errors',
      canRecover: error => {
        const lower = error.toLowerCase();
        return (
          lower.includes('network') ||
          lower.includes('connection') ||
          lower.includes('econnrefused')
        );
      },
      recover: (_error, toolCall) => ({
        action: 'retry',
        reason: 'Network error - retrying with backoff',
        userMessage: `Network error for ${toolCall.name}. Retrying...`,
      }),
    });

    this.strategies.push({
      name: 'rate_limit',
      description: 'Handle rate limiting',
      canRecover: error => {
        const lower = error.toLowerCase();
        return lower.includes('rate limit') || lower.includes('too many requests') || error.includes('429');
      },
      recover: () => ({
        action: 'retry',
        reason: 'Rate limited - waiting before retry',
        userMessage: 'Rate limited. Waiting before retry...',
      }),
    });

    this.strategies.push({
      name: 'tool_not_found',
      description: 'Handle tool not found',
      canRecover: error => {
        const lower = error.toLowerCase();
        return lower.includes('tool') && lower.includes('not found');
      },
      recover: error => ({
        action: 'abort',
        reason: 'Tool not found',
        userMessage: error,
      }),
    });
  }

  private fixJsonInput(toolCall: ToolCall): ToolCall {
    try {
      if (typeof toolCall.input === 'string') {
        const parsed = JSON.parse(toolCall.input);
        return { ...toolCall, input: parsed };
      }
    } catch {
      // Cannot fix
    }
    return toolCall;
  }

  isRecoverable(error: string): boolean {
    const recoverablePatterns = [
      /timeout/i,
      /network/i,
      /rate limit/i,
      /temporary/i,
      /retry/i,
      /econnrefused/i,
      /econnreset/i,
    ];

    return recoverablePatterns.some(pattern => pattern.test(error));
  }

  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  getStrategies(): RecoveryStrategy[] {
    return [...this.strategies];
  }
}
