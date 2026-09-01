/**
 * Workflow Engine & Orchestration System
 * Complex workflow management, state machines, and task orchestration
 *
 * Part of 350K lines goal
 */
import { EventEmitter } from 'events';
export interface WorkflowConfig {
    maxConcurrentWorkflows: number;
    defaultTimeout: number;
    enableRetry: boolean;
    enableCompensation: boolean;
    persistState: boolean;
}
export interface Workflow {
    id: string;
    name: string;
    version: string;
    definition: WorkflowDefinition;
    state: WorkflowState;
    variables: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}
export interface WorkflowDefinition {
    steps: WorkflowStep[];
    triggers?: Trigger[];
    errorHandlers?: ErrorHandler[];
    compensations?: Compensation[];
}
export interface WorkflowStep {
    id: string;
    name: string;
    type: StepType;
    action: StepAction;
    input?: StepInput;
    output?: string;
    condition?: StepCondition;
    retry?: RetryConfig;
    timeout?: number;
    next?: string | string[];
    onError?: string;
}
export type StepType = 'task' | 'parallel' | 'choice' | 'wait' | 'map' | 'succeed' | 'fail';
export interface StepAction {
    type: ActionType;
    handler: string;
    parameters?: Record<string, any>;
}
export type ActionType = 'function' | 'http' | 'event' | 'subprocess' | 'human_task';
export interface StepInput {
    source: InputSource;
    path?: string;
    transform?: TransformFunction;
}
export type InputSource = 'workflow' | 'step' | 'constant';
export type TransformFunction = (input: any) => any;
export interface StepCondition {
    variable: string;
    operator: ConditionOperator;
    value: any;
}
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'exists' | 'contains';
export interface RetryConfig {
    maxAttempts: number;
    backoff: BackoffConfig;
    retryableErrors?: string[];
}
export interface BackoffConfig {
    strategy: BackoffStrategy;
    initialInterval: number;
    multiplier?: number;
    maxInterval?: number;
}
export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';
export interface Trigger {
    type: TriggerType;
    config: TriggerConfig;
}
export type TriggerType = 'schedule' | 'event' | 'webhook' | 'manual';
export interface TriggerConfig {
    schedule?: string;
    eventType?: string;
    webhookUrl?: string;
}
export interface ErrorHandler {
    errorType: string;
    action: ErrorAction;
    retryable: boolean;
}
export type ErrorAction = 'retry' | 'fail' | 'compensate' | 'continue';
export interface Compensation {
    stepId: string;
    action: CompensationAction;
}
export interface CompensationAction {
    type: ActionType;
    handler: string;
    parameters?: Record<string, any>;
}
export type WorkflowState = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    state: WorkflowState;
    currentStep?: string;
    stepHistory: StepExecution[];
    variables: Record<string, any>;
    error?: ExecutionError;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
}
export interface StepExecution {
    stepId: string;
    state: StepState;
    input?: any;
    output?: any;
    error?: ExecutionError;
    attempts: number;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
}
export type StepState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';
export interface ExecutionError {
    type: string;
    message: string;
    stack?: string;
    retryable: boolean;
}
export interface StateMachine {
    id: string;
    name: string;
    states: State[];
    transitions: Transition[];
    currentState: string;
    context: Record<string, any>;
}
export interface State {
    name: string;
    type: StateType;
    onEntry?: StateAction[];
    onExit?: StateAction[];
    metadata?: Record<string, any>;
}
export type StateType = 'initial' | 'intermediate' | 'final';
export interface StateAction {
    type: string;
    handler: string;
    parameters?: Record<string, any>;
}
export interface Transition {
    from: string;
    to: string;
    event: string;
    condition?: TransitionCondition;
    actions?: StateAction[];
}
export interface TransitionCondition {
    guard: (context: Record<string, any>) => boolean;
}
export interface HumanTask {
    id: string;
    workflowExecutionId: string;
    stepId: string;
    assignee?: string;
    description: string;
    form?: TaskForm;
    state: HumanTaskState;
    createdAt: Date;
    completedAt?: Date;
    result?: any;
}
export type HumanTaskState = 'pending' | 'assigned' | 'completed' | 'rejected';
export interface TaskForm {
    fields: FormField[];
    validation?: FormValidation;
}
export interface FormField {
    name: string;
    type: FieldType;
    label: string;
    required: boolean;
    options?: string[];
    defaultValue?: any;
}
export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'date' | 'file';
export interface FormValidation {
    rules: ValidationRule[];
}
export interface ValidationRule {
    field: string;
    rule: string;
    message: string;
}
export interface WorkflowMetrics {
    totalWorkflows: number;
    runningWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    averageDuration: number;
    successRate: number;
}
export declare class WorkflowEngineManager extends EventEmitter {
    private config;
    private workflows;
    private executions;
    private stateMachines;
    private humanTasks;
    private runningExecutions;
    constructor(config?: Partial<WorkflowConfig>);
    defineWorkflow(name: string, version: string, definition: WorkflowDefinition): Workflow;
    getWorkflow(workflowId: string): Workflow | undefined;
    listWorkflows(): Workflow[];
    executeWorkflow(workflowId: string, input?: Record<string, any>): Promise<WorkflowExecution>;
    private runWorkflow;
    private executeStep;
    private executeAction;
    private executeFunctionAction;
    private executeHttpAction;
    private executeEventAction;
    private executeHumanTaskAction;
    private createHumanTask;
    completeHumanTask(taskId: string, result: any): void;
    rejectHumanTask(taskId: string, reason: string): void;
    createStateMachine(name: string, states: State[], transitions: Transition[]): StateMachine;
    transitionState(stateMachineId: string, event: string, context?: Record<string, any>): Promise<void>;
    private executeStateAction;
    private resolveInput;
    private evaluateCondition;
    private evaluateChoice;
    private calculateBackoff;
    private sleep;
    private generateId;
    getMetrics(): WorkflowMetrics;
    getStats(): {
        workflows: number;
        executions: number;
        runningExecutions: number;
        stateMachines: number;
        humanTasks: number;
        pendingHumanTasks: number;
        metrics: WorkflowMetrics;
    };
}
//# sourceMappingURL=WorkflowEngine.d.ts.map