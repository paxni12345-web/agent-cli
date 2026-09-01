"use strict";
/**
 * Advanced Debugging System
 * Breakpoint management, variable inspection, call stack analysis, and debugging tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugAdapterServer = exports.stepDebugger = exports.watchExpressionManager = exports.callStackAnalyzer = exports.variableInspector = exports.breakpointManager = exports.debugSessionManager = exports.DebugAdapterServer = exports.StepDebugger = exports.WatchExpressionManager = exports.CallStackAnalyzer = exports.VariableInspector = exports.BreakpointManager = exports.DebugSessionManager = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Debug Session Manager
 */
class DebugSessionManager {
    sessions = new Map();
    activeSessionId;
    /**
     * Create debug session
     */
    createSession(config) {
        const session = {
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
        EventBus_1.eventBus.emitSync('debug.session_started', session, 'DebugSessionManager');
        return session;
    }
    /**
     * Get active session
     */
    getActiveSession() {
        if (!this.activeSessionId)
            return undefined;
        return this.sessions.get(this.activeSessionId);
    }
    /**
     * Get session by ID
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Set active session
     */
    setActiveSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            this.activeSessionId = sessionId;
        }
    }
    /**
     * Stop session
     */
    stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'stopped';
            session.stoppedAt = new Date();
            if (this.activeSessionId === sessionId) {
                this.activeSessionId = undefined;
            }
            EventBus_1.eventBus.emitSync('debug.session_stopped', { sessionId }, 'DebugSessionManager');
        }
    }
    /**
     * Pause session
     */
    pauseSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.status === 'running') {
            session.status = 'paused';
            EventBus_1.eventBus.emitSync('debug.session_paused', { sessionId }, 'DebugSessionManager');
        }
    }
    /**
     * Continue session
     */
    continueSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.status === 'paused') {
            session.status = 'running';
            EventBus_1.eventBus.emitSync('debug.session_continued', { sessionId }, 'DebugSessionManager');
        }
    }
    /**
     * List all sessions
     */
    listSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Get session statistics
     */
    getStats() {
        const sessions = this.listSessions();
        return {
            total: sessions.length,
            running: sessions.filter(s => s.status === 'running').length,
            paused: sessions.filter(s => s.status === 'paused').length,
            stopped: sessions.filter(s => s.status === 'stopped').length,
        };
    }
    generateSessionId() {
        return `debug_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DebugSessionManager = DebugSessionManager;
/**
 * Breakpoint Manager
 */
class BreakpointManager {
    breakpoints = new Map();
    /**
     * Set breakpoint
     */
    setBreakpoint(file, line, options) {
        const breakpoint = {
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
        EventBus_1.eventBus.emitSync('debug.breakpoint_set', breakpoint, 'BreakpointManager');
        return breakpoint;
    }
    /**
     * Remove breakpoint
     */
    removeBreakpoint(breakpointId) {
        const removed = this.breakpoints.delete(breakpointId);
        if (removed) {
            EventBus_1.eventBus.emitSync('debug.breakpoint_removed', { breakpointId }, 'BreakpointManager');
        }
        return removed;
    }
    /**
     * Enable/disable breakpoint
     */
    toggleBreakpoint(breakpointId, enabled) {
        const breakpoint = this.breakpoints.get(breakpointId);
        if (breakpoint) {
            breakpoint.enabled = enabled;
            EventBus_1.eventBus.emitSync('debug.breakpoint_toggled', { breakpointId, enabled }, 'BreakpointManager');
        }
    }
    /**
     * Get breakpoint
     */
    getBreakpoint(breakpointId) {
        return this.breakpoints.get(breakpointId);
    }
    /**
     * List breakpoints
     */
    listBreakpoints(filter) {
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
    clearAll(file) {
        if (file) {
            const toRemove = this.listBreakpoints({ file });
            toRemove.forEach(b => this.breakpoints.delete(b.id));
            return toRemove.length;
        }
        else {
            const count = this.breakpoints.size;
            this.breakpoints.clear();
            return count;
        }
    }
    /**
     * Hit breakpoint
     */
    hitBreakpoint(breakpointId) {
        const breakpoint = this.breakpoints.get(breakpointId);
        if (breakpoint && breakpoint.enabled) {
            breakpoint.hitCount++;
            EventBus_1.eventBus.emitSync('debug.breakpoint_hit', breakpoint, 'BreakpointManager');
        }
    }
    /**
     * Evaluate breakpoint condition
     */
    evaluateCondition(breakpointId, context) {
        const breakpoint = this.breakpoints.get(breakpointId);
        if (!breakpoint || !breakpoint.condition) {
            return true;
        }
        try {
            // Simple condition evaluation (in production, use a proper evaluator)
            const func = new Function(...Object.keys(context), `return ${breakpoint.condition}`);
            return func(...Object.values(context));
        }
        catch (error) {
            console.error('Condition evaluation error:', error);
            return true;
        }
    }
    generateBreakpointId() {
        return `bp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.BreakpointManager = BreakpointManager;
/**
 * Variable Inspector
 */
class VariableInspector {
    /**
     * Inspect variable
     */
    inspect(value, name = 'value', maxDepth = 3) {
        return this.inspectRecursive(value, name, 0, maxDepth);
    }
    /**
     * Inspect variable recursively
     */
    inspectRecursive(value, name, depth, maxDepth) {
        const type = this.getType(value);
        const variable = {
            name,
            value: this.formatValue(value, type),
            type,
        };
        if (depth < maxDepth && (type === 'object' || type === 'array')) {
            variable.children = this.inspectChildren(value, depth, maxDepth);
            if (type === 'array') {
                variable.indexedVariables = value.length;
            }
            else if (type === 'object') {
                variable.namedVariables = Object.keys(value).length;
            }
        }
        return variable;
    }
    /**
     * Inspect children of object/array
     */
    inspectChildren(value, depth, maxDepth) {
        const children = [];
        if (Array.isArray(value)) {
            for (let i = 0; i < Math.min(value.length, 100); i++) {
                children.push(this.inspectRecursive(value[i], `[${i}]`, depth + 1, maxDepth));
            }
        }
        else if (typeof value === 'object' && value !== null) {
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
    getType(value) {
        if (value === null)
            return 'null';
        if (value === undefined)
            return 'undefined';
        if (Array.isArray(value))
            return 'array';
        if (value instanceof Date)
            return 'date';
        if (value instanceof RegExp)
            return 'regexp';
        if (value instanceof Error)
            return 'error';
        if (typeof value === 'function')
            return 'function';
        return typeof value;
    }
    /**
     * Format value for display
     */
    formatValue(value, type) {
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
    evaluateExpression(expression, context) {
        try {
            const func = new Function(...Object.keys(context), `return ${expression}`);
            const value = func(...Object.values(context));
            const type = this.getType(value);
            return { value, type };
        }
        catch (error) {
            return {
                value: undefined,
                type: 'error',
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
exports.VariableInspector = VariableInspector;
/**
 * Call Stack Analyzer
 */
class CallStackAnalyzer {
    /**
     * Capture call stack
     */
    captureStack() {
        const stack = new Error().stack || '';
        const lines = stack.split('\n').slice(2); // Skip Error and this function
        return lines.map((line, index) => this.parseStackLine(line, index));
    }
    /**
     * Parse stack trace line
     */
    parseStackLine(line, index) {
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
    formatStack(frames) {
        return frames
            .map((frame, index) => {
            return `${index}. ${frame.name} at ${frame.file}:${frame.line}:${frame.column}`;
        })
            .join('\n');
    }
    /**
     * Find frame by file
     */
    findFrame(frames, file) {
        return frames.find(f => f.file.includes(file));
    }
}
exports.CallStackAnalyzer = CallStackAnalyzer;
/**
 * Watch Expression Manager
 */
class WatchExpressionManager {
    expressions = new Map();
    /**
     * Add watch expression
     */
    addWatch(expression) {
        const watch = {
            id: this.generateWatchId(),
            expression,
        };
        this.expressions.set(watch.id, watch);
        EventBus_1.eventBus.emitSync('debug.watch_added', watch, 'WatchExpressionManager');
        return watch;
    }
    /**
     * Remove watch expression
     */
    removeWatch(watchId) {
        const removed = this.expressions.delete(watchId);
        if (removed) {
            EventBus_1.eventBus.emitSync('debug.watch_removed', { watchId }, 'WatchExpressionManager');
        }
        return removed;
    }
    /**
     * Evaluate all watch expressions
     */
    evaluateAll(context) {
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
    getWatch(watchId) {
        return this.expressions.get(watchId);
    }
    /**
     * List all watch expressions
     */
    listWatches() {
        return Array.from(this.expressions.values());
    }
    /**
     * Clear all watches
     */
    clearAll() {
        this.expressions.clear();
    }
    generateWatchId() {
        return `watch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.WatchExpressionManager = WatchExpressionManager;
/**
 * Step Debugger
 */
class StepDebugger {
    currentLine = 0;
    stepping = false;
    stepMode = null;
    /**
     * Step into function
     */
    stepInto() {
        this.stepping = true;
        this.stepMode = 'in';
        EventBus_1.eventBus.emitSync('debug.step_into', {}, 'StepDebugger');
    }
    /**
     * Step over function
     */
    stepOver() {
        this.stepping = true;
        this.stepMode = 'over';
        EventBus_1.eventBus.emitSync('debug.step_over', {}, 'StepDebugger');
    }
    /**
     * Step out of function
     */
    stepOut() {
        this.stepping = true;
        this.stepMode = 'out';
        EventBus_1.eventBus.emitSync('debug.step_out', {}, 'StepDebugger');
    }
    /**
     * Continue execution
     */
    continue() {
        this.stepping = false;
        this.stepMode = null;
        EventBus_1.eventBus.emitSync('debug.continue', {}, 'StepDebugger');
    }
    /**
     * Check if should stop at line
     */
    shouldStopAt(line) {
        if (!this.stepping)
            return false;
        // Simple logic - in production, track call depth
        return true;
    }
    /**
     * Get current state
     */
    getState() {
        return {
            stepping: this.stepping,
            stepMode: this.stepMode,
            currentLine: this.currentLine,
        };
    }
}
exports.StepDebugger = StepDebugger;
/**
 * Debug Adapter Protocol (DAP) Server
 */
class DebugAdapterServer {
    sessionManager;
    breakpointManager;
    constructor(sessionManager, breakpointManager) {
        this.sessionManager = sessionManager;
        this.breakpointManager = breakpointManager;
    }
    /**
     * Handle DAP request
     */
    async handleRequest(command, args) {
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
    handleInitialize(args) {
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
    handleLaunch(args) {
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
    handleSetBreakpoints(args) {
        const { source, breakpoints } = args;
        const file = source.path;
        // Clear existing breakpoints for this file
        this.breakpointManager.clearAll(file);
        // Set new breakpoints
        const verified = breakpoints.map((bp) => {
            const breakpoint = this.breakpointManager.setBreakpoint(file, bp.line, {
                column: bp.column,
                condition: bp.condition,
                logMessage: bp.logMessage,
            });
            return {
                id: breakpoint.id,
                verified: true,
                line: breakpoint.line,
                column: breakpoint.column,
            };
        });
        return { breakpoints: verified };
    }
    handleContinue(args) {
        const session = this.sessionManager.getActiveSession();
        if (session) {
            this.sessionManager.continueSession(session.id);
        }
        return { allThreadsContinued: true };
    }
    handlePause(args) {
        const session = this.sessionManager.getActiveSession();
        if (session) {
            this.sessionManager.pauseSession(session.id);
        }
        return {};
    }
    handleStepIn(args) {
        return {};
    }
    handleStepOver(args) {
        return {};
    }
    handleStepOut(args) {
        return {};
    }
    handleStackTrace(args) {
        const session = this.sessionManager.getActiveSession();
        if (!session)
            return { stackFrames: [] };
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
    handleScopes(args) {
        return {
            scopes: [
                { name: 'Local', variablesReference: 1, expensive: false },
                { name: 'Global', variablesReference: 2, expensive: false },
            ],
        };
    }
    handleVariables(args) {
        return { variables: [] };
    }
    handleEvaluate(args) {
        const inspector = new VariableInspector();
        const result = inspector.evaluateExpression(args.expression, {});
        return {
            result: result.value,
            type: result.type,
            variablesReference: 0,
        };
    }
}
exports.DebugAdapterServer = DebugAdapterServer;
/**
 * Singleton instances
 */
exports.debugSessionManager = new DebugSessionManager();
exports.breakpointManager = new BreakpointManager();
exports.variableInspector = new VariableInspector();
exports.callStackAnalyzer = new CallStackAnalyzer();
exports.watchExpressionManager = new WatchExpressionManager();
exports.stepDebugger = new StepDebugger();
exports.debugAdapterServer = new DebugAdapterServer(exports.debugSessionManager, exports.breakpointManager);
