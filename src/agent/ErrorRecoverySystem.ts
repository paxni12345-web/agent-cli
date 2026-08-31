/**
 * Error Recovery System - Automatic error detection and recovery
 *
 * Provides intelligent error handling and recovery strategies
 * for failed tool executions.
 */

import { ToolCall, ToolResult, AgentState } from '../types/index.js';

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

  /**
   * Attempts to recover from a tool execution error
   */
  recover(
    error: string,
    toolCall: ToolCall,
    state: AgentState,
    attemptNumber: number
  ): RecoveryAction {
    // Try each strategy
    for (const strategy of this.strategies) {
      if (strategy.canRecover(error, toolCall)) {
        const action = strategy.recover(error, toolCall, state);

        // Add attempt context
        if (action.action === 'retry' && attemptNumber > 1) {
          action.reason = `${action.reason} (Attempt ${attemptNumber})`;
        }

        return action;
      }
    }

    // No strategy found - abort
    return {
      action: 'abort',
      reason: 'No recovery strategy available for this error',
      userMessage: `Tool '${toolCall.name}' failed: ${error}`,
    };
  }

  /**
   * Registers default recovery strategies
   */
  private registerDefaultStrategies(): void {
    // File not found - try creating parent directory
    this.strategies.push({
      name: 'file_not_found',
      description: 'Handle file not found errors',
      canRecover: (error) => {
        return error.toLowerCase().includes('no such file') ||
               error.toLowerCase().includes('not found') ||
               error.toLowerCase().includes('enoent');
      },
      recover: (error, toolCall) => {
        return {
          action: 'retry',
          reason: 'File not found - will attempt to create parent directory first',
          userMessage: `File not found. Consider using list_files or creating the directory first.`,
        };
      },
    });

    // Permission denied - suggest using different approach
    this.strategies.push({
      name: 'permission_denied',
      description: 'Handle permission errors',
      canRecover: (error) => {
        return error.toLowerCase().includes('permission denied') ||
               error.toLowerCase().includes('eacces');
      },
      recover: (error, toolCall) => {
        return {
          action: 'abort',
          reason: 'Permission denied - cannot proceed',
          userMessage: `Permission denied for ${toolCall.name}. Check file/directory permissions.`,
        };
      },
    });

    // Timeout - retry with shorter timeout or simpler operation
    this.strategies.push({
      name: 'timeout',
      description: 'Handle timeout errors',
      canRecover: (error) => {
        return error.toLowerCase().includes('timeout') ||
               error.toLowerCase().includes('timed out');
      },
      recover: (error, toolCall) => {
        return {
          action: 'retry',
          reason: 'Operation timed out - retrying',
          userMessage: `${toolCall.name} timed out. Will retry...`,
        };
      },
    });

    // Invalid JSON - suggest fixing format
    this.strategies.push({
      name: 'invalid_json',
      description: 'Handle JSON parsing errors',
      canRecover: (error) => {
        return error.toLowerCase().includes('json') ||
               error.toLowerCase().includes('parse');
      },
      recover: (error, toolCall) => {
        return {
          action: 'modify_input',
          reason: 'Invalid JSON format - attempting to fix',
          modifiedToolCall: this.fixJsonInput(toolCall),
        };
      },
    });

    // Path traversal - sanitize path
    this.strategies.push({
      name: 'path_traversal',
      description: 'Handle path traversal attempts',
      canRecover: (error) => {
        return error.toLowerCase().includes('path') &&
               (error.toLowerCase().includes('outside') ||
                error.toLowerCase().includes('traversal'));
      },
      recover: (error, toolCall) => {
        return {
          action: 'modify_input',
          reason: 'Invalid path - sanitizing',
          modifiedToolCall: this.sanitizePath(toolCall),
        };
      },
    });

    // Network errors - retry with backoff
    this.strategies.push({
      name: 'network_error',
      description: 'Handle network errors',
      canRecover: (error) => {
        return error.toLowerCase().includes('network') ||
               error.toLowerCase().includes('connection') ||
               error.toLowerCase().includes('econnrefused');
      },
      recover: (error, toolCall) => {
        return {
          action: 'retry',
          reason: 'Network error - retrying with backoff',
          userMessage: `Network error for ${toolCall.name}. Retrying...`,
        };
      },
    });

    // Rate limiting - wait and retry
    this.strategies.push({
      name: 'rate_limit',
      description: 'Handle rate limiting',
      canRecover: (error) => {
        return error.toLowerCase().includes('rate limit') ||
               error.toLowerCase().includes('too many requests') ||
               error.includes('429');
      },
      recover: (error, toolCall) => {
        return {
          action: 'retry',
          reason: 'Rate limited - waiting before retry',
          userMessage: `Rate limited. Waiting before retry...`,
        };
      },
    });

    // Missing required field - add default value
    this.strategies.push({
      name: 'missing_field',
      description: 'Handle missing required fields',
      canRecover: (error) => {
        return error.toLowerCase().includes('missing required field');
      },
      recover: (error, toolCall) => {
        return {
          action: 'abort',
          reason: 'Missing required field',
          userMessage: `${error}. Please provide all required fields.`,
        };
      },
    });

    // Type mismatch - try to convert
    this.strategies.push({
      name: 'type_mismatch',
      description: 'Handle type mismatches',
      canRecover: (error) => {
        return error.toLowerCase().includes('should be') &&
               error.toLowerCase().includes('got');
      },
      recover: (error, toolCall) => {
        return {
          action: 'abort',
          reason: 'Type mismatch',
          userMessage: `${error}. Provide the correct data type.`,
        };
      },
    });

    // Tool not found - suggest similar tools
    this.strategies.push({
      name: 'tool_not_found',
      description: 'Handle tool not found',
      canRecover: (error) => {
        return error.toLowerCase().includes('tool') &&
               error.toLowerCase().includes('not found');
      },
      recover: (error, toolCall) => {
        return {
          action: 'abort',
          reason: 'Tool not found',
          userMessage: error,
        };
      },
    });
  }

  /**
   * Attempts to fix JSON input
   */
  private fixJsonInput(toolCall: ToolCall): ToolCall {
    try {
      if (typeof toolCall.input === 'string') {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(toolCall.input);
        return { ...toolCall, input: parsed };
      }
    } catch {
      // Cannot fix
    }
    return toolCall;
  }

  /**
   * Sanitizes path in tool input
   */
  private sanitizePath(toolCall: ToolCall): ToolCall {
    if (typeof toolCall.input === 'object' && toolCall.input !== null) {
      const input = { ...toolCall.input } as any;

      // Sanitize common path fields
      for (const field of ['path', 'file', 'filename', 'filepath', 'directory']) {
        if (field in input && typeof input[field] === 'string') {
          // Remove ../ and other dangerous patterns
          input[field] = input[field]
            .replace(/\.\.\//g, '')
            .replace(/\.\.\\/g, '')
            .replace(/\/\//g, '/')
            .replace(/^\//, '');
        }
      }

      return { ...toolCall, input };
    }

    return toolCall;
  }

  /**
   * Analyzes error pattern to determine if it's recoverable
   */
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

  /**
   * Gets error severity level
   */
  getErrorSeverity(error: string): 'low' | 'medium' | 'high' | 'critical' {
    if (error.toLowerCase().includes('permission denied')) return 'high';
    if (error.toLowerCase().includes('not found')) return 'medium';
    if (error.toLowerCase().includes('timeout')) return 'low';
    if (error.toLowerCase().includes('network')) return 'medium';
    if (error.toLowerCase().includes('invalid')) return 'medium';
    return 'medium';
  }

  /**
   * Generates user-friendly error message
   */
  formatErrorMessage(error: string, toolCall: ToolCall): string {
    const severity = this.getErrorSeverity(error);
    const emoji = severity === 'critical' ? '🔴' :
                  severity === 'high' ? '⚠️' :
                  severity === 'medium' ? '⚡' : 'ℹ️';

    return `${emoji} Tool '${toolCall.name}' failed: ${error}`;
  }

  /**
   * Registers a custom recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Gets all registered strategies
   */
  getStrategies(): RecoveryStrategy[] {
    return [...this.strategies];
  }
}
