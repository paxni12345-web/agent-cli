export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | ContentBlock[];
    timestamp?: Date;
    toolCalls?: ToolCall[];
}
export interface ContentBlock {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
    tool_use_id?: string;
    content?: string;
    is_error?: boolean;
}
export interface ToolSchema {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
        [key: string]: unknown;
    };
}
export interface ChatRequest {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: ToolSchema[];
    toolChoice?: 'auto' | 'any' | 'none' | {
        type: 'tool';
        name: string;
    };
}
export interface ChatResponse {
    content: string;
    toolCalls?: ToolCall[];
    finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error';
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    rawResponse?: any;
}
export interface ChatChunk {
    delta: string;
    toolCalls?: Partial<ToolCall>[];
}
export interface ToolCall {
    id: string;
    name: string;
    input: unknown;
}
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    metadata?: Record<string, unknown>;
    isError?: boolean;
    retryable?: boolean;
    executionTime?: number;
    cached?: boolean;
}
export interface ToolContext {
    workspaceRoot: string;
    permissions: PermissionManager;
    currentState: AgentState;
}
export interface Tool {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}
export interface JSONSchema {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
}
export interface AgentState {
    status: AgentStatus;
    currentTask?: string;
    plan?: Plan;
    history: ToolExecution[];
    conversationMessages: ChatMessage[];
    iterationCount: number;
    metadata: Record<string, unknown>;
}
export type AgentStatus = 'idle' | 'thinking' | 'planning' | 'executing' | 'waiting_approval' | 'verifying' | 'error_recovery' | 'completed' | 'cancelled';
export interface Plan {
    goal: string;
    steps: PlanStep[];
    dependencies?: Record<string, string[]>;
    validationCriteria?: string[];
}
export interface PlanStep {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    tool?: string;
    result?: ToolResult;
}
export interface ToolExecution {
    tool: string;
    input: unknown;
    result: ToolResult;
    timestamp: Date;
    retryCount?: number;
    duration?: number;
}
export interface PermissionManager {
    check(action: Action): PermissionResult;
    requestApproval(action: Action): Promise<boolean>;
}
export interface Action {
    type: ActionType;
    description: string;
    target?: string;
    risk: RiskLevel;
    command?: string;
}
export type ActionType = 'read_file' | 'write_file' | 'delete_file' | 'execute_command' | 'git_operation' | 'network_request';
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type PermissionResult = {
    allowed: true;
} | {
    allowed: false;
    reason: string;
};
export type PermissionMode = 'safe' | 'normal' | 'auto' | 'dangerous';
export interface Config {
    provider: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    permissionMode: PermissionMode;
    maxIterations: number;
    temperature: number;
    workspaceRoot: string;
    sessionDir?: string;
    debug: boolean;
    enableToolRetry?: boolean;
    maxToolRetries?: number;
    enableToolCache?: boolean;
    toolTimeout?: number;
    validateToolInputs?: boolean;
    autoRecovery?: boolean;
    strictToolCalling?: boolean;
}
export interface Session {
    id: string;
    timestamp: Date;
    workspace: string;
    messages: ChatMessage[];
    toolCalls: ToolExecution[];
    plan?: Plan;
    state: Record<string, unknown>;
}
export declare class AgentError extends Error {
    code: string;
    details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}
export declare class ToolError extends AgentError {
    constructor(message: string, details?: unknown);
}
export declare class ProviderError extends AgentError {
    constructor(message: string, details?: unknown);
}
export declare class PermissionError extends AgentError {
    constructor(message: string, details?: unknown);
}
export declare class WorkspaceError extends AgentError {
    constructor(message: string, details?: unknown);
}
export declare class ValidationError extends AgentError {
    constructor(message: string, details?: unknown);
}
//# sourceMappingURL=index.d.ts.map