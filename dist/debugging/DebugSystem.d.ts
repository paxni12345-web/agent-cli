/**
 * Advanced Debugging System
 * Breakpoint management, variable inspection, call stack analysis, and debugging tools
 */
export interface Breakpoint {
    id: string;
    file: string;
    line: number;
    column?: number;
    condition?: string;
    hitCount: number;
    enabled: boolean;
    logMessage?: string;
    createdAt: Date;
}
export interface DebugSession {
    id: string;
    name: string;
    type: 'attach' | 'launch';
    status: 'running' | 'paused' | 'stopped';
    processId?: number;
    startedAt: Date;
    stoppedAt?: Date;
    breakpoints: Map<string, Breakpoint>;
    callStack: StackFrame[];
    variables: Map<string, Variable>;
    watchExpressions: WatchExpression[];
}
export interface StackFrame {
    id: string;
    name: string;
    file: string;
    line: number;
    column: number;
    source?: string;
    scopes: Scope[];
}
export interface Scope {
    name: string;
    type: 'local' | 'global' | 'closure' | 'block';
    variables: Variable[];
    expensive: boolean;
}
export interface Variable {
    name: string;
    value: any;
    type: string;
    reference?: string;
    indexedVariables?: number;
    namedVariables?: number;
    children?: Variable[];
}
export interface WatchExpression {
    id: string;
    expression: string;
    value?: any;
    error?: string;
    type?: string;
}
export interface DebugConfiguration {
    type: string;
    request: 'launch' | 'attach';
    name: string;
    program?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stopOnEntry?: boolean;
    console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
}
/**
 * Debug Session Manager
 */
export declare class DebugSessionManager {
    private sessions;
    private activeSessionId?;
    /**
     * Create debug session
     */
    createSession(config: DebugConfiguration): DebugSession;
    /**
     * Get active session
     */
    getActiveSession(): DebugSession | undefined;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): DebugSession | undefined;
    /**
     * Set active session
     */
    setActiveSession(sessionId: string): void;
    /**
     * Stop session
     */
    stopSession(sessionId: string): void;
    /**
     * Pause session
     */
    pauseSession(sessionId: string): void;
    /**
     * Continue session
     */
    continueSession(sessionId: string): void;
    /**
     * List all sessions
     */
    listSessions(): DebugSession[];
    /**
     * Get session statistics
     */
    getStats(): {
        total: number;
        running: number;
        paused: number;
        stopped: number;
    };
    private generateSessionId;
}
/**
 * Breakpoint Manager
 */
export declare class BreakpointManager {
    private breakpoints;
    /**
     * Set breakpoint
     */
    setBreakpoint(file: string, line: number, options?: {
        column?: number;
        condition?: string;
        logMessage?: string;
    }): Breakpoint;
    /**
     * Remove breakpoint
     */
    removeBreakpoint(breakpointId: string): boolean;
    /**
     * Enable/disable breakpoint
     */
    toggleBreakpoint(breakpointId: string, enabled: boolean): void;
    /**
     * Get breakpoint
     */
    getBreakpoint(breakpointId: string): Breakpoint | undefined;
    /**
     * List breakpoints
     */
    listBreakpoints(filter?: {
        file?: string;
        enabled?: boolean;
    }): Breakpoint[];
    /**
     * Clear all breakpoints
     */
    clearAll(file?: string): number;
    /**
     * Hit breakpoint
     */
    hitBreakpoint(breakpointId: string): void;
    /**
     * Evaluate breakpoint condition
     */
    evaluateCondition(breakpointId: string, context: Record<string, any>): boolean;
    private generateBreakpointId;
}
/**
 * Variable Inspector
 */
export declare class VariableInspector {
    /**
     * Inspect variable
     */
    inspect(value: any, name?: string, maxDepth?: number): Variable;
    /**
     * Inspect variable recursively
     */
    private inspectRecursive;
    /**
     * Inspect children of object/array
     */
    private inspectChildren;
    /**
     * Get value type
     */
    private getType;
    /**
     * Format value for display
     */
    private formatValue;
    /**
     * Evaluate expression
     */
    evaluateExpression(expression: string, context: Record<string, any>): {
        value: any;
        type: string;
        error?: string;
    };
}
/**
 * Call Stack Analyzer
 */
export declare class CallStackAnalyzer {
    /**
     * Capture call stack
     */
    captureStack(): StackFrame[];
    /**
     * Parse stack trace line
     */
    private parseStackLine;
    /**
     * Format stack trace
     */
    formatStack(frames: StackFrame[]): string;
    /**
     * Find frame by file
     */
    findFrame(frames: StackFrame[], file: string): StackFrame | undefined;
}
/**
 * Watch Expression Manager
 */
export declare class WatchExpressionManager {
    private expressions;
    /**
     * Add watch expression
     */
    addWatch(expression: string): WatchExpression;
    /**
     * Remove watch expression
     */
    removeWatch(watchId: string): boolean;
    /**
     * Evaluate all watch expressions
     */
    evaluateAll(context: Record<string, any>): void;
    /**
     * Get watch expression
     */
    getWatch(watchId: string): WatchExpression | undefined;
    /**
     * List all watch expressions
     */
    listWatches(): WatchExpression[];
    /**
     * Clear all watches
     */
    clearAll(): void;
    private generateWatchId;
}
/**
 * Step Debugger
 */
export declare class StepDebugger {
    private currentLine;
    private stepping;
    private stepMode;
    /**
     * Step into function
     */
    stepInto(): void;
    /**
     * Step over function
     */
    stepOver(): void;
    /**
     * Step out of function
     */
    stepOut(): void;
    /**
     * Continue execution
     */
    continue(): void;
    /**
     * Check if should stop at line
     */
    shouldStopAt(line: number): boolean;
    /**
     * Get current state
     */
    getState(): {
        stepping: boolean;
        stepMode: 'in' | 'over' | 'out' | null;
        currentLine: number;
    };
}
/**
 * Debug Adapter Protocol (DAP) Server
 */
export declare class DebugAdapterServer {
    private sessionManager;
    private breakpointManager;
    constructor(sessionManager: DebugSessionManager, breakpointManager: BreakpointManager);
    /**
     * Handle DAP request
     */
    handleRequest(command: string, args: any): Promise<any>;
    private handleInitialize;
    private handleLaunch;
    private handleSetBreakpoints;
    private handleContinue;
    private handlePause;
    private handleStepIn;
    private handleStepOver;
    private handleStepOut;
    private handleStackTrace;
    private handleScopes;
    private handleVariables;
    private handleEvaluate;
}
/**
 * Singleton instances
 */
export declare const debugSessionManager: DebugSessionManager;
export declare const breakpointManager: BreakpointManager;
export declare const variableInspector: VariableInspector;
export declare const callStackAnalyzer: CallStackAnalyzer;
export declare const watchExpressionManager: WatchExpressionManager;
export declare const stepDebugger: StepDebugger;
export declare const debugAdapterServer: DebugAdapterServer;
//# sourceMappingURL=DebugSystem.d.ts.map