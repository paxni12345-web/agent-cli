/**
 * Error Recovery System - Automatic error detection and recovery
 *
 * Provides intelligent error handling and recovery strategies
 * for failed tool executions.
 */
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
export declare class ErrorRecoverySystem {
    private strategies;
    constructor();
    /**
     * Attempts to recover from a tool execution error
     */
    recover(error: string, toolCall: ToolCall, state: AgentState, attemptNumber: number): RecoveryAction;
    /**
     * Registers default recovery strategies
     */
    private registerDefaultStrategies;
    /**
     * Attempts to fix JSON input
     */
    private fixJsonInput;
    /**
     * Sanitizes path in tool input
     */
    private sanitizePath;
    /**
     * Analyzes error pattern to determine if it's recoverable
     */
    isRecoverable(error: string): boolean;
    /**
     * Gets error severity level
     */
    getErrorSeverity(error: string): 'low' | 'medium' | 'high' | 'critical';
    /**
     * Generates user-friendly error message
     */
    formatErrorMessage(error: string, toolCall: ToolCall): string;
    /**
     * Registers a custom recovery strategy
     */
    registerStrategy(strategy: RecoveryStrategy): void;
    /**
     * Gets all registered strategies
     */
    getStrategies(): RecoveryStrategy[];
}
//# sourceMappingURL=ErrorRecoverySystem.d.ts.map