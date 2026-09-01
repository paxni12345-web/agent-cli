/**
 * Advanced Workflow Orchestration System
 * Multi-step workflow execution, state management, conditional branching
 * Parallel execution, error handling, rollback support
 */
import { EventEmitter } from 'events';
export interface WorkflowConfig {
    maxConcurrency: number;
    timeout: number;
    retryPolicy: RetryPolicy;
    enableStateSnapshot: boolean;
    snapshotInterval: number;
    persistenceBackend: 'memory' | 'file' | 'database';
}
export interface RetryPolicy {
    maxAttempts: number;
    backoffType: 'fixed' | 'exponential' | 'linear';
    initialDelay: number;
    maxDelay: number;
    retryableErrors?: string[];
}
export interface Workflow {
    id: string;
    name: string;
    description: string;
    version: string;
    steps: WorkflowStep[];
    triggers: WorkflowTrigger[];
    variables: WorkflowVariable[];
    errorHandlers: ErrorHandler[];
    metadata: WorkflowMetadata;
    state: WorkflowState;
}
export interface WorkflowStep {
    id: string;
    name: string;
    type: StepType;
    config: StepConfig;
    dependencies: string[];
    conditions: Condition[];
    timeout?: number;
    retryPolicy?: RetryPolicy;
    errorHandler?: string;
    onSuccess?: StepAction[];
    onFailure?: StepAction[];
}
export type StepType = 'task' | 'parallel' | 'sequence' | 'condition' | 'loop' | 'wait' | 'approval' | 'webhook' | 'subprocess';
export interface StepConfig {
    handler?: string;
    input?: Record<string, any>;
    output?: Record<string, any>;
    parallelSteps?: string[];
    sequenceSteps?: string[];
    condition?: string;
    loopVariable?: string;
    loopCollection?: string;
    waitDuration?: number;
    waitUntil?: string;
    approvers?: string[];
    webhookURL?: string;
    workflowId?: string;
}
export interface Condition {
    type: 'expression' | 'script' | 'custom';
    expression?: string;
    script?: string;
    handler?: (context: WorkflowContext) => boolean;
}
export interface StepAction {
    type: 'set_variable' | 'emit_event' | 'trigger_workflow' | 'custom';
    variable?: string;
    value?: any;
    event?: string;
    workflowId?: string;
    handler?: (context: WorkflowContext) => void;
}
export interface WorkflowTrigger {
    type: 'manual' | 'scheduled' | 'event' | 'webhook';
    schedule?: string;
    event?: string;
    webhookPath?: string;
    enabled: boolean;
}
export interface WorkflowVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    default?: any;
    description?: string;
}
export interface ErrorHandler {
    id: string;
    errorType: string;
    action: 'retry' | 'skip' | 'fail' | 'rollback' | 'custom';
    handler?: (error: Error, context: WorkflowContext) => void;
}
export interface WorkflowMetadata {
    author: string;
    tags: string[];
    category: string;
    createdAt: number;
    updatedAt: number;
}
export interface WorkflowState {
    status: WorkflowStatus;
    currentStep?: string;
    startedAt?: number;
    completedAt?: number;
    pausedAt?: number;
    error?: Error;
    executionHistory: ExecutionRecord[];
}
export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval';
export interface ExecutionRecord {
    stepId: string;
    status: StepStatus;
    startedAt: number;
    completedAt?: number;
    duration?: number;
    input?: any;
    output?: any;
    error?: Error;
    retryCount: number;
}
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: WorkflowStatus;
    variables: Map<string, any>;
    stepResults: Map<string, any>;
    startedAt: number;
    completedAt?: number;
    duration?: number;
    error?: Error;
    snapshots: ExecutionSnapshot[];
}
export interface ExecutionSnapshot {
    timestamp: number;
    stepId: string;
    variables: Record<string, any>;
    stepResults: Record<string, any>;
}
export interface WorkflowContext {
    workflow: Workflow;
    execution: WorkflowExecution;
    variables: Map<string, any>;
    stepResults: Map<string, any>;
    emit: (event: string, data: any) => void;
    getVariable: (name: string) => any;
    setVariable: (name: string, value: any) => void;
    getStepResult: (stepId: string) => any;
    log: (message: string, level?: string) => void;
}
export interface WorkflowBuilder {
    setName(name: string): this;
    setDescription(description: string): this;
    addStep(step: Omit<WorkflowStep, 'id'>): this;
    addVariable(variable: WorkflowVariable): this;
    addTrigger(trigger: WorkflowTrigger): this;
    addErrorHandler(handler: ErrorHandler): this;
    build(): Workflow;
}
export interface StepExecutor {
    execute(step: WorkflowStep, context: WorkflowContext): Promise<any>;
}
export interface ApprovalRequest {
    id: string;
    workflowExecutionId: string;
    stepId: string;
    requestedAt: number;
    approvers: string[];
    requiredApprovals: number;
    approvals: Approval[];
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    expiresAt?: number;
}
export interface Approval {
    approver: string;
    approved: boolean;
    timestamp: number;
    comment?: string;
}
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    workflow: Workflow;
    parameters: TemplateParameter[];
}
export interface TemplateParameter {
    name: string;
    type: string;
    required: boolean;
    default?: any;
    description: string;
}
export declare class WorkflowOrchestrator extends EventEmitter {
    private config;
    private workflows;
    private executions;
    private approvalRequests;
    private executors;
    private templates;
    private activeExecutions;
    constructor(config?: Partial<WorkflowConfig>);
    registerWorkflow(workflow: Omit<Workflow, 'id' | 'state'>): Workflow;
    getWorkflow(workflowId: string): Workflow | undefined;
    listWorkflows(): Workflow[];
    deleteWorkflow(workflowId: string): void;
    executeWorkflow(workflowId: string, variables?: Record<string, any>): Promise<WorkflowExecution>;
    private executeSteps;
    private executeStep;
    private evaluateConditions;
    private evaluateExpression;
    private evaluateScript;
    private executeActions;
    private handleError;
    private registerDefaultExecutors;
    registerExecutor(type: StepType, executor: StepExecutor): void;
    pauseWorkflow(executionId: string): Promise<void>;
    resumeWorkflow(executionId: string): Promise<void>;
    cancelWorkflow(executionId: string): Promise<void>;
    rollbackWorkflow(executionId: string): Promise<void>;
    requestApproval(executionId: string, stepId: string, approvers: string[]): Promise<ApprovalRequest>;
    submitApproval(requestId: string, approver: string, approved: boolean, comment?: string): Promise<void>;
    registerTemplate(template: Omit<WorkflowTemplate, 'id'>): WorkflowTemplate;
    instantiateTemplate(templateId: string, parameters: Record<string, any>): Promise<Workflow>;
    private createWorkflowContext;
    private validateVariables;
    private isRetryableError;
    private calculateRetryDelay;
    private executeWithTimeout;
    private delay;
    private generateId;
    getExecution(executionId: string): WorkflowExecution | undefined;
    listExecutions(workflowId?: string): WorkflowExecution[];
    getStats(): WorkflowStats;
}
interface WorkflowStats {
    totalWorkflows: number;
    totalExecutions: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    activeApprovals: number;
}
export default WorkflowOrchestrator;
//# sourceMappingURL=WorkflowOrchestrator.d.ts.map