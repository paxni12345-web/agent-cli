/**
 * Advanced Debugging System
 * Breakpoint management, variable inspection, call stack analysis, and debugging tools
 */

import { eventBus } from '../core/EventBus';

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
export class DebugSessionManager {
  private sessions: Map<string, DebugSession> = new Map();
  private activeSessionId?: string;

  /**
   * Create debug session
   */
  createSession(config: DebugConfiguration): DebugSession {
    const session: DebugSession = {
      id: this.generateSessionId(),
      name: config.name,
      type: config.request,
      status: 'running',
      startedAt: new Date(),
      breakpoints: new Map(),
      callStack: [],
      variables: new Map(),
      watchExpressions: [],
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    eventBus.emitSync('debug.session_started', session, 'DebugSessionManager');

    return session;
  }

  /**
   * Get active session
   */
  getActiveSession(): DebugSession | undefined {
    if (!this.activeSessionId) return undefined;
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Set active session
   */
  setActiveSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
    }
  }

  /**
   * Stop session
   */
  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'stopped';
      session.stoppedAt = new Date();

      if (this.activeSessionId === sessionId) {
        this.activeSessionId = undefined;
      }

      eventBus.emitSync('debug.session_stopped', { sessionId }, 'DebugSessionManager');
    }
  }

  /**
   * Pause session
   */
  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'running') {
      session.status = 'paused';
      eventBus.emitSync('debug.session_paused', { sessionId }, 'DebugSessionManager');
    }
  }

  /**
   * Continue session
   */
  continueSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'running';
      eventBus.emitSync('debug.session_continued', { sessionId }, 'DebugSessionManager');
    }
  }

  /**
   * List all sessions
   */
  listSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session statistics
   */
  getStats(): {
    total: number;
    running: number;
    paused: number;
    stopped: number;
  } {
    const sessions = this.listSessions();

    return {
      total: sessions.length,
      running: sessions.filter(s => s.status === 'running').length,
      paused: sessions.filter(s => s.status === 'paused').length,
      stopped: sessions.filter(s => s.status === 'stopped').length,
    };
  }

  private generateSessionId(): string {
    return `debug_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Breakpoint Manager
 */
export class BreakpointManager {
  private breakpoints: Map<string, Breakpoint> = new Map();

  /**
   * Set breakpoint
   */
  setBreakpoint(
    file: string,
    line: number,
    options?: {
      column?: number;
      condition?: string;
      logMessage?: string;
    }
  ): Breakpoint {
    const breakpoint: Breakpoint = {
      id: this.generateBreakpointId(),
      file,
      line,
      column: options?.column,
      condition: options?.condition,
      hitCount: 0,
      enabled: true,
      logMessage: options?.logMessage,
      createdAt: new Date(),
    };

    this.breakpoints.set(breakpoint.id, breakpoint);

    eventBus.emitSync('debug.breakpoint_set', breakpoint, 'BreakpointManager');

    return breakpoint;
  }

  /**
   * Remove breakpoint
   */
  removeBreakpoint(breakpointId: string): boolean {
    const removed = this.breakpoints.delete(breakpointId);

    if (removed) {
      eventBus.emitSync('debug.breakpoint_removed', { breakpointId }, 'BreakpointManager');
    }

    return removed;
  }

  /**
   * Enable/disable breakpoint
   */
  toggleBreakpoint(breakpointId: string, enabled: boolean): void {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint) {
      breakpoint.enabled = enabled;
      eventBus.emitSync('debug.breakpoint_toggled', { breakpointId, enabled }, 'BreakpointManager');
    }
  }

  /**
   * Get breakpoint
   */
  getBreakpoint(breakpointId: string): Breakpoint | undefined {
    return this.breakpoints.get(breakpointId);
  }

  /**
   * List breakpoints
   */
  listBreakpoints(filter?: { file?: string; enabled?: boolean }): Breakpoint[] {
    let breakpoints = Array.from(this.breakpoints.values());

    if (filter?.file) {
      breakpoints = breakpoints.filter(b => b.file === filter.file);
    }

    if (filter?.enabled !== undefined) {
      breakpoints = breakpoints.filter(b => b.enabled === filter.enabled);
    }

    return breakpoints;
  }

  /**
   * Clear all breakpoints
   */
  clearAll(file?: string): number {
    if (file) {
      const toRemove = this.listBreakpoints({ file });
      toRemove.forEach(b => this.breakpoints.delete(b.id));
      return toRemove.length;
    } else {
      const count = this.breakpoints.size;
      this.breakpoints.clear();
      return count;
    }
  }

  /**
   * Hit breakpoint
   */
  hitBreakpoint(breakpointId: string): void {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint && breakpoint.enabled) {
      breakpoint.hitCount++;
      eventBus.emitSync('debug.breakpoint_hit', breakpoint, 'BreakpointManager');
    }
  }

  /**
   * Evaluate breakpoint condition
   */
  evaluateCondition(breakpointId: string, context: Record<string, any>): boolean {
    const breakpoint = this.breakpoints.get(breakpointId);

    if (!breakpoint || !breakpoint.condition) {
      return true;
    }

    try {
      // Simple condition evaluation (in production, use a proper evaluator)
      const func = new Function(...Object.keys(context), `return ${breakpoint.condition}`);
      return func(...Object.values(context));
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return true;
    }
  }

  private generateBreakpointId(): string {
    return `bp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Variable Inspector
 */
export class VariableInspector {
  /**
   * Inspect variable
   */
  inspect(value: any, name = 'value', maxDepth = 3): Variable {
    return this.inspectRecursive(value, name, 0, maxDepth);
  }

  /**
   * Inspect variable recursively
   */
  private inspectRecursive(value: any, name: string, depth: number, maxDepth: number): Variable {
    const type = this.getType(value);

    const variable: Variable = {
      name,
      value: this.formatValue(value, type),
      type,
    };

    if (depth < maxDepth && (type === 'object' || type === 'array')) {
      variable.children = this.inspectChildren(value, depth, maxDepth);

      if (type === 'array') {
        variable.indexedVariables = value.length;
      } else if (type === 'object') {
        variable.namedVariables = Object.keys(value).length;
      }
    }

    return variable;
  }

  /**
   * Inspect children of object/array
   */
  private inspectChildren(value: any, depth: number, maxDepth: number): Variable[] {
    const children: Variable[] = [];

    if (Array.isArray(value)) {
      for (let i = 0; i < Math.min(value.length, 100); i++) {
        children.push(this.inspectRecursive(value[i], `[${i}]`, depth + 1, maxDepth));
      }
    } else if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value).slice(0, 100);
      for (const key of keys) {
        children.push(this.inspectRecursive(value[key], key, depth + 1, maxDepth));
      }
    }

    return children;
  }

  /**
   * Get value type
   */
  private getType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regexp';
    if (value instanceof Error) return 'error';
    if (typeof value === 'function') return 'function';
    return typeof value;
  }

  /**
   * Format value for display
   */
  private formatValue(value: any, type: string): string {
    switch (type) {
      case 'null':
        return 'null';
      case 'undefined':
        return 'undefined';
      case 'string':
        return `"${value}"`;
      case 'number':
      case 'boolean':
        return String(value);
      case 'function':
        return `[Function: ${value.name || 'anonymous'}]`;
      case 'array':
        return `Array(${value.length})`;
      case 'object':
        return `Object {${Object.keys(value).length} properties}`;
      case 'date':
        return value.toISOString();
      case 'regexp':
        return value.toString();
      case 'error':
        return `${value.name}: ${value.message}`;
      default:
        return String(value);
    }
  }

  /**
   * Evaluate expression
   */
  evaluateExpression(expression: string, context: Record<string, any>): {
    value: any;
    type: string;
    error?: string;
  } {
    try {
      const func = new Function(...Object.keys(context), `return ${expression}`);
      const value = func(...Object.values(context));
      const type = this.getType(value);

      return { value, type };
    } catch (error) {
      return {
        value: undefined,
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Call Stack Analyzer
 */
export class CallStackAnalyzer {
  /**
   * Capture call stack
   */
  captureStack(): StackFrame[] {
    const stack = new Error().stack || '';
    const lines = stack.split('\n').slice(2); // Skip Error and this function

    return lines.map((line, index) => this.parseStackLine(line, index));
  }

  /**
   * Parse stack trace line
   */
  private parseStackLine(line: string, index: number): StackFrame {
    // Example: "    at functionName (file.ts:10:5)"
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);

    if (match) {
      return {
        id: `frame_${index}`,
        name: match[1].trim(),
        file: match[2],
        line: parseInt(match[3]),
        column: parseInt(match[4]),
        scopes: [],
      };
    }

    return {
      id: `frame_${index}`,
      name: 'unknown',
      file: 'unknown',
      line: 0,
      column: 0,
      scopes: [],
    };
  }

  /**
   * Format stack trace
   */
  formatStack(frames: StackFrame[]): string {
    return frames
      .map((frame, index) => {
        return `${index}. ${frame.name} at ${frame.file}:${frame.line}:${frame.column}`;
      })
      .join('\n');
  }

  /**
   * Find frame by file
   */
  findFrame(frames: StackFrame[], file: string): StackFrame | undefined {
    return frames.find(f => f.file.includes(file));
  }
}

/**
 * Watch Expression Manager
 */
export class WatchExpressionManager {
  private expressions: Map<string, WatchExpression> = new Map();

  /**
   * Add watch expression
   */
  addWatch(expression: string): WatchExpression {
    const watch: WatchExpression = {
      id: this.generateWatchId(),
      expression,
    };

    this.expressions.set(watch.id, watch);

    eventBus.emitSync('debug.watch_added', watch, 'WatchExpressionManager');

    return watch;
  }

  /**
   * Remove watch expression
   */
  removeWatch(watchId: string): boolean {
    const removed = this.expressions.delete(watchId);

    if (removed) {
      eventBus.emitSync('debug.watch_removed', { watchId }, 'WatchExpressionManager');
    }

    return removed;
  }

  /**
   * Evaluate all watch expressions
   */
  evaluateAll(context: Record<string, any>): void {
    const inspector = new VariableInspector();

    for (const watch of this.expressions.values()) {
      const result = inspector.evaluateExpression(watch.expression, context);

      watch.value = result.value;
      watch.type = result.type;
      watch.error = result.error;
    }
  }

  /**
   * Get watch expression
   */
  getWatch(watchId: string): WatchExpression | undefined {
    return this.expressions.get(watchId);
  }

  /**
   * List all watch expressions
   */
  listWatches(): WatchExpression[] {
    return Array.from(this.expressions.values());
  }

  /**
   * Clear all watches
   */
  clearAll(): void {
    this.expressions.clear();
  }

  private generateWatchId(): string {
    return `watch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Step Debugger
 */
export class StepDebugger {
  private currentLine = 0;
  private stepping = false;
  private stepMode: 'in' | 'over' | 'out' | null = null;

  /**
   * Step into function
   */
  stepInto(): void {
    this.stepping = true;
    this.stepMode = 'in';
    eventBus.emitSync('debug.step_into', {}, 'StepDebugger');
  }

  /**
   * Step over function
   */
  stepOver(): void {
    this.stepping = true;
    this.stepMode = 'over';
    eventBus.emitSync('debug.step_over', {}, 'StepDebugger');
  }

  /**
   * Step out of function
   */
  stepOut(): void {
    this.stepping = true;
    this.stepMode = 'out';
    eventBus.emitSync('debug.step_out', {}, 'StepDebugger');
  }

  /**
   * Continue execution
   */
  continue(): void {
    this.stepping = false;
    this.stepMode = null;
    eventBus.emitSync('debug.continue', {}, 'StepDebugger');
  }

  /**
   * Check if should stop at line
   */
  shouldStopAt(line: number): boolean {
    if (!this.stepping) return false;

    // Simple logic - in production, track call depth
    return true;
  }

  /**
   * Get current state
   */
  getState(): {
    stepping: boolean;
    stepMode: 'in' | 'over' | 'out' | null;
    currentLine: number;
  } {
    return {
      stepping: this.stepping,
      stepMode: this.stepMode,
      currentLine: this.currentLine,
    };
  }
}

/**
 * Debug Adapter Protocol (DAP) Server
 */
export class DebugAdapterServer {
  private sessionManager: DebugSessionManager;
  private breakpointManager: BreakpointManager;

  constructor(
    sessionManager: DebugSessionManager,
    breakpointManager: BreakpointManager
  ) {
    this.sessionManager = sessionManager;
    this.breakpointManager = breakpointManager;
  }

  /**
   * Handle DAP request
   */
  async handleRequest(command: string, args: any): Promise<any> {
    switch (command) {
      case 'initialize':
        return this.handleInitialize(args);
      case 'launch':
        return this.handleLaunch(args);
      case 'setBreakpoints':
        return this.handleSetBreakpoints(args);
      case 'continue':
        return this.handleContinue(args);
      case 'pause':
        return this.handlePause(args);
      case 'stepIn':
        return this.handleStepIn(args);
      case 'stepOver':
        return this.handleStepOver(args);
      case 'stepOut':
        return this.handleStepOut(args);
      case 'stackTrace':
        return this.handleStackTrace(args);
      case 'scopes':
        return this.handleScopes(args);
      case 'variables':
        return this.handleVariables(args);
      case 'evaluate':
        return this.handleEvaluate(args);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private handleInitialize(args: any): any {
    return {
      supportsConfigurationDoneRequest: true,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsLogPoints: true,
      supportsSetVariable: true,
      supportsEvaluateForHovers: true,
      supportsStepBack: false,
      supportsRestartFrame: false,
    };
  }

  private handleLaunch(args: any): any {
    const session = this.sessionManager.createSession({
      type: args.type || 'node',
      request: 'launch',
      name: args.name || 'Debug Session',
      program: args.program,
      args: args.args,
      cwd: args.cwd,
    });

    return { sessionId: session.id };
  }

  private handleSetBreakpoints(args: any): any {
    const { source, breakpoints } = args;
    const file = source.path;

    // Clear existing breakpoints for this file
    this.breakpointManager.clearAll(file);

    // Set new breakpoints
    const verified = breakpoints.map((bp: any) => {
      const breakpoint = this.breakpointManager.setBreakpoint(
        file,
        bp.line,
        {
          column: bp.column,
          condition: bp.condition,
          logMessage: bp.logMessage,
        }
      );

      return {
        id: breakpoint.id,
        verified: true,
        line: breakpoint.line,
        column: breakpoint.column,
      };
    });

    return { breakpoints: verified };
  }

  private handleContinue(args: any): any {
    const session = this.sessionManager.getActiveSession();
    if (session) {
      this.sessionManager.continueSession(session.id);
    }
    return { allThreadsContinued: true };
  }

  private handlePause(args: any): any {
    const session = this.sessionManager.getActiveSession();
    if (session) {
      this.sessionManager.pauseSession(session.id);
    }
    return {};
  }

  private handleStepIn(args: any): any {
    return {};
  }

  private handleStepOver(args: any): any {
    return {};
  }

  private handleStepOut(args: any): any {
    return {};
  }

  private handleStackTrace(args: any): any {
    const session = this.sessionManager.getActiveSession();
    if (!session) return { stackFrames: [] };

    return {
      stackFrames: session.callStack.map(frame => ({
        id: frame.id,
        name: frame.name,
        source: {
          path: frame.file,
        },
        line: frame.line,
        column: frame.column,
      })),
    };
  }

  private handleScopes(args: any): any {
    return {
      scopes: [
        { name: 'Local', variablesReference: 1, expensive: false },
        { name: 'Global', variablesReference: 2, expensive: false },
      ],
    };
  }

  private handleVariables(args: any): any {
    return { variables: [] };
  }

  private handleEvaluate(args: any): any {
    const inspector = new VariableInspector();
    const result = inspector.evaluateExpression(args.expression, {});

    return {
      result: result.value,
      type: result.type,
      variablesReference: 0,
    };
  }
}

/**
 * Singleton instances
 */
export const debugSessionManager = new DebugSessionManager();
export const breakpointManager = new BreakpointManager();
export const variableInspector = new VariableInspector();
export const callStackAnalyzer = new CallStackAnalyzer();
export const watchExpressionManager = new WatchExpressionManager();
export const stepDebugger = new StepDebugger();
export const debugAdapterServer = new DebugAdapterServer(
  debugSessionManager,
  breakpointManager
);
