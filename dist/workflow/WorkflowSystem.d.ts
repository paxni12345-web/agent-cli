/**
 * Workflow Engine System
 * State machine orchestration, task execution, approval workflows, and process automation
 */
export interface Workflow {
    id: string;
    name: string;
    description: string;
    version: number;
    definition: WorkflowDefinition;
    status: WorkflowStatus;
    metadata: WorkflowMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum WorkflowStatus {
    Draft = "draft",
    Active = "active",
    Inactive = "inactive",
    Deprecated = "deprecated"
}
export interface WorkflowDefinition {
    states: State[];
    transitions: Transition[];
    initialState: string;
    finalStates: string[];
    variables: Variable[];
}
export interface State {
    id: string;
    name: string;
    type: StateType;
    config: StateConfig;
    onEntry?: Action[];
    onExit?: Action[];
    timeout?: number;
}
export declare enum StateType {
    Task = "task",
    Decision = "decision",
    Parallel = "parallel",
    Wait = "wait",
    Success = "success",
    Fail = "fail",
    Choice = "choice"
}
export interface StateConfig {
    resource?: string;
    parameters?: Record<string, any>;
    retry?: RetryConfig;
    catch?: CatchConfig[];
}
export interface RetryConfig {
    maxAttempts: number;
    backoffRate: number;
    intervalMs: number;
    errors?: string[];
}
export interface CatchConfig {
    errorType: string;
    nextState: string;
    resultPath?: string;
}
export interface Transition {
    id: string;
    from: string;
    to: string;
    condition?: Condition;
    priority: number;
}
export interface Condition {
    field: string;
    operator: ConditionOperator;
    value: any;
}
export declare enum ConditionOperator {
    Equals = "equals",
    NotEquals = "not_equals",
    GreaterThan = "greater_than",
    LessThan = "less_than",
    Contains = "contains",
    Exists = "exists"
}
export interface Action {
    type: ActionType;
    config: Record<string, any>;
}
export declare enum ActionType {
    ExecuteTask = "execute_task",
    SendNotification = "send_notification",
    UpdateVariable = "update_variable",
    InvokeAPI = "invoke_api",
    WaitForEvent = "wait_for_event",
    LogMessage = "log_message"
}
export interface Variable {
    name: string;
    type: VariableType;
    defaultValue?: any;
    required: boolean;
}
export declare enum VariableType {
    String = "string",
    Number = "number",
    Boolean = "boolean",
    Object = "object",
    Array = "array"
}
export interface WorkflowMetadata {
    owner: string;
    tags: string[];
    category: string;
    permissions: Permission[];
}
export interface Permission {
    principal: string;
    actions: PermissionAction[];
}
export declare enum PermissionAction {
    View = "view",
    Execute = "execute",
    Edit = "edit",
    Delete = "delete"
}
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    workflowVersion: number;
    status: ExecutionStatus;
    currentState: string;
    context: ExecutionContext;
    history: ExecutionEvent[];
    startedAt: Date;
    completedAt?: Date;
    error?: ExecutionError;
}
export declare enum ExecutionStatus {
    Running = "running",
    Succeeded = "succeeded",
    Failed = "failed",
    TimedOut = "timed_out",
    Aborted = "aborted",
    Paused = "paused"
}
export interface ExecutionContext {
    variables: Map<string, any>;
    input: any;
    output?: any;
    metadata: Record<string, any>;
}
export interface ExecutionEvent {
    timestamp: Date;
    type: EventType;
    stateId: string;
    stateName: string;
    details: Record<string, any>;
    duration?: number;
}
export declare enum EventType {
    StateEntered = "state_entered",
    StateExited = "state_exited",
    TransitionTaken = "transition_taken",
    ActionExecuted = "action_executed",
    ErrorOccurred = "error_occurred",
    ExecutionStarted = "execution_started",
    ExecutionCompleted = "execution_completed"
}
export interface ExecutionError {
    type: string;
    message: string;
    stateId: string;
    timestamp: Date;
    stackTrace?: string;
}
export interface Task {
    id: string;
    executionId: string;
    stateId: string;
    name: string;
    type: TaskType;
    status: TaskStatus;
    input: any;
    output?: any;
    assignee?: string;
    priority: TaskPriority;
    dueDate?: Date;
    createdAt: Date;
    completedAt?: Date;
}
export declare enum TaskType {
    Manual = "manual",
    Automated = "automated",
    Approval = "approval",
    Review = "review",
    Notification = "notification"
}
export declare enum TaskStatus {
    Pending = "pending",
    InProgress = "in_progress",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled"
}
export declare enum TaskPriority {
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export interface ApprovalRequest {
    id: string;
    taskId: string;
    executionId: string;
    title: string;
    description: string;
    requester: string;
    approvers: string[];
    approvalType: ApprovalType;
    responses: ApprovalResponse[];
    status: ApprovalStatus;
    dueDate?: Date;
    createdAt: Date;
    resolvedAt?: Date;
}
export declare enum ApprovalType {
    AllRequired = "all_required",
    AnyRequired = "any_required",
    MajorityRequired = "majority_required",
    SingleRequired = "single_required"
}
export interface ApprovalResponse {
    approver: string;
    decision: ApprovalDecision;
    comment?: string;
    timestamp: Date;
}
export declare enum ApprovalDecision {
    Approved = "approved",
    Rejected = "rejected",
    Delegated = "delegated"
}
export declare enum ApprovalStatus {
    Pending = "pending",
    Approved = "approved",
    Rejected = "rejected",
    Expired = "expired"
}
export interface Schedule {
    id: string;
    workflowId: string;
    name: string;
    type: ScheduleType;
    config: ScheduleConfig;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    createdAt: Date;
}
export declare enum ScheduleType {
    Cron = "cron",
    Interval = "interval",
    Once = "once",
    Event = "event"
}
export interface ScheduleConfig {
    expression?: string;
    interval?: number;
    startDate?: Date;
    endDate?: Date;
    timezone?: string;
    maxRuns?: number;
    eventTrigger?: EventTrigger;
}
export interface EventTrigger {
    source: string;
    eventType: string;
    filter?: Record<string, any>;
}
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    definition: WorkflowDefinition;
    parameters: TemplateParameter[];
    tags: string[];
    createdAt: Date;
}
export interface TemplateParameter {
    name: string;
    type: VariableType;
    description: string;
    required: boolean;
    defaultValue?: any;
}
export interface ParallelExecution {
    id: string;
    branches: Branch[];
    strategy: ParallelStrategy;
    status: ExecutionStatus;
    startedAt: Date;
    completedAt?: Date;
}
export declare enum ParallelStrategy {
    WaitForAll = "wait_for_all",
    WaitForAny = "wait_for_any",
    WaitForN = "wait_for_n"
}
export interface Branch {
    id: string;
    name: string;
    executionId: string;
    status: ExecutionStatus;
    result?: any;
}
export interface CompensationAction {
    id: string;
    stateId: string;
    action: Action;
    executed: boolean;
    executedAt?: Date;
}
export interface WorkflowMetrics {
    workflowId: string;
    period: {
        start: Date;
        end: Date;
    };
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    successRate: number;
    stateMetrics: Map<string, StateMetrics>;
}
export interface StateMetrics {
    stateId: string;
    stateName: string;
    enterCount: number;
    exitCount: number;
    averageDuration: number;
    errorCount: number;
}
/**
 * Workflow Manager
 */
export declare class WorkflowManager {
    private workflows;
    private templates;
    /**
     * Create workflow
     */
    createWorkflow(config: Omit<Workflow, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'>): Workflow;
    /**
     * Update workflow
     */
    updateWorkflow(workflowId: string, updates: Partial<Workflow>): Workflow;
    /**
     * Publish workflow
     */
    publishWorkflow(workflowId: string): Workflow;
    /**
     * Create new version
     */
    createVersion(workflowId: string, changes: Partial<WorkflowDefinition>): Workflow;
    /**
     * Get workflow
     */
    getWorkflow(workflowId: string): Workflow | undefined;
    /**
     * List workflows
     */
    listWorkflows(filter?: {
        status?: WorkflowStatus;
        category?: string;
    }): Workflow[];
    /**
     * Create template
     */
    createTemplate(config: Omit<WorkflowTemplate, 'id' | 'createdAt'>): WorkflowTemplate;
    /**
     * Get template
     */
    getTemplate(templateId: string): WorkflowTemplate | undefined;
    /**
     * List templates
     */
    listTemplates(category?: string): WorkflowTemplate[];
    private generateWorkflowId;
    private generateTemplateId;
}
/**
 * Execution Engine
 */
export declare class ExecutionEngine {
    private executions;
    private workflowManager;
    constructor(workflowManager: WorkflowManager);
    /**
     * Start workflow execution
     */
    startExecution(workflowId: string, input: any): Promise<WorkflowExecution>;
    /**
     * Execute state
     */
    private executeState;
    /**
     * Execute task
     */
    private executeTask;
    /**
     * Execute wait
     */
    private executeWait;
    /**
     * Execute action
     */
    private executeAction;
    /**
     * Determine next state
     */
    private determineNextState;
    /**
     * Evaluate condition
     */
    private evaluateCondition;
    /**
     * Handle error
     */
    private handleError;
    /**
     * Complete execution
     */
    private completeExecution;
    /**
     * Get execution
     */
    getExecution(executionId: string): WorkflowExecution | undefined;
    /**
     * List executions
     */
    listExecutions(filter?: {
        workflowId?: string;
        status?: ExecutionStatus;
    }): WorkflowExecution[];
    /**
     * Abort execution
     */
    abortExecution(executionId: string): void;
    private generateExecutionId;
}
/**
 * Task Manager
 */
export declare class TaskManager {
    private tasks;
    /**
     * Create task
     */
    createTask(config: Omit<Task, 'id' | 'status' | 'createdAt'>): Task;
    /**
     * Complete task
     */
    completeTask(taskId: string, output: any): void;
    /**
     * Assign task
     */
    assignTask(taskId: string, assignee: string): void;
    /**
     * Get task
     */
    getTask(taskId: string): Task | undefined;
    /**
     * List tasks
     */
    listTasks(filter?: {
        status?: TaskStatus;
        assignee?: string;
        executionId?: string;
    }): Task[];
    private generateTaskId;
}
/**
 * Approval Manager
 */
export declare class ApprovalManager {
    private approvals;
    /**
     * Create approval request
     */
    createApprovalRequest(config: Omit<ApprovalRequest, 'id' | 'responses' | 'status' | 'createdAt'>): ApprovalRequest;
    /**
     * Submit approval response
     */
    submitResponse(approvalId: string, approver: string, decision: ApprovalDecision, comment?: string): void;
    /**
     * Get approval request
     */
    getApprovalRequest(approvalId: string): ApprovalRequest | undefined;
    /**
     * List approval requests
     */
    listApprovalRequests(filter?: {
        status?: ApprovalStatus;
        approver?: string;
    }): ApprovalRequest[];
    private evaluateApprovalStatus;
    private generateApprovalId;
}
/**
 * Singleton instances
 */
export declare const workflowManager: WorkflowManager;
export declare const executionEngine: ExecutionEngine;
export declare const taskManager: TaskManager;
export declare const approvalManager: ApprovalManager;
//# sourceMappingURL=WorkflowSystem.d.ts.map