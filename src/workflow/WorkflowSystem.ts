/**
 * Workflow Engine System
 * State machine orchestration, task execution, approval workflows, and process automation
 */

import { eventBus } from '../core/EventBus';

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

export enum WorkflowStatus {
  Draft = 'draft',
  Active = 'active',
  Inactive = 'inactive',
  Deprecated = 'deprecated',
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
  timeout?: number; // milliseconds
}

export enum StateType {
  Task = 'task',
  Decision = 'decision',
  Parallel = 'parallel',
  Wait = 'wait',
  Success = 'success',
  Fail = 'fail',
  Choice = 'choice',
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

export enum ConditionOperator {
  Equals = 'equals',
  NotEquals = 'not_equals',
  GreaterThan = 'greater_than',
  LessThan = 'less_than',
  Contains = 'contains',
  Exists = 'exists',
}

export interface Action {
  type: ActionType;
  config: Record<string, any>;
}

export enum ActionType {
  ExecuteTask = 'execute_task',
  SendNotification = 'send_notification',
  UpdateVariable = 'update_variable',
  InvokeAPI = 'invoke_api',
  WaitForEvent = 'wait_for_event',
  LogMessage = 'log_message',
}

export interface Variable {
  name: string;
  type: VariableType;
  defaultValue?: any;
  required: boolean;
}

export enum VariableType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Object = 'object',
  Array = 'array',
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

export enum PermissionAction {
  View = 'view',
  Execute = 'execute',
  Edit = 'edit',
  Delete = 'delete',
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

export enum ExecutionStatus {
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  TimedOut = 'timed_out',
  Aborted = 'aborted',
  Paused = 'paused',
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

export enum EventType {
  StateEntered = 'state_entered',
  StateExited = 'state_exited',
  TransitionTaken = 'transition_taken',
  ActionExecuted = 'action_executed',
  ErrorOccurred = 'error_occurred',
  ExecutionStarted = 'execution_started',
  ExecutionCompleted = 'execution_completed',
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

export enum TaskType {
  Manual = 'manual',
  Automated = 'automated',
  Approval = 'approval',
  Review = 'review',
  Notification = 'notification',
}

export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
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

export enum ApprovalType {
  AllRequired = 'all_required',
  AnyRequired = 'any_required',
  MajorityRequired = 'majority_required',
  SingleRequired = 'single_required',
}

export interface ApprovalResponse {
  approver: string;
  decision: ApprovalDecision;
  comment?: string;
  timestamp: Date;
}

export enum ApprovalDecision {
  Approved = 'approved',
  Rejected = 'rejected',
  Delegated = 'delegated',
}

export enum ApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Expired = 'expired',
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

export enum ScheduleType {
  Cron = 'cron',
  Interval = 'interval',
  Once = 'once',
  Event = 'event',
}

export interface ScheduleConfig {
  expression?: string; // cron expression
  interval?: number; // milliseconds
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

export enum ParallelStrategy {
  WaitForAll = 'wait_for_all',
  WaitForAny = 'wait_for_any',
  WaitForN = 'wait_for_n',
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
export class WorkflowManager {
  private workflows: Map<string, Workflow> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();

  /**
   * Create workflow
   */
  createWorkflow(config: Omit<Workflow, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'>): Workflow {
    const workflow: Workflow = {
      ...config,
      id: this.generateWorkflowId(),
      version: 1,
      status: WorkflowStatus.Draft,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(workflow.id, workflow);

    eventBus.emitSync('workflow.created', workflow, 'WorkflowManager');

    return workflow;
  }

  /**
   * Update workflow
   */
  updateWorkflow(workflowId: string, updates: Partial<Workflow>): Workflow {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    Object.assign(workflow, updates);
    workflow.updatedAt = new Date();

    eventBus.emitSync('workflow.updated', workflow, 'WorkflowManager');

    return workflow;
  }

  /**
   * Publish workflow
   */
  publishWorkflow(workflowId: string): Workflow {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.status = WorkflowStatus.Active;
    workflow.updatedAt = new Date();

    eventBus.emitSync('workflow.published', workflow, 'WorkflowManager');

    return workflow;
  }

  /**
   * Create new version
   */
  createVersion(workflowId: string, changes: Partial<WorkflowDefinition>): Workflow {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const newVersion: Workflow = {
      ...workflow,
      id: this.generateWorkflowId(),
      version: workflow.version + 1,
      definition: {
        ...workflow.definition,
        ...changes,
      },
      status: WorkflowStatus.Draft,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(newVersion.id, newVersion);

    eventBus.emitSync('workflow.version_created', newVersion, 'WorkflowManager');

    return newVersion;
  }

  /**
   * Get workflow
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * List workflows
   */
  listWorkflows(filter?: { status?: WorkflowStatus; category?: string }): Workflow[] {
    let workflows = Array.from(this.workflows.values());

    if (filter?.status) {
      workflows = workflows.filter(w => w.status === filter.status);
    }

    if (filter?.category) {
      workflows = workflows.filter(w => w.metadata.category === filter.category);
    }

    return workflows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Create template
   */
  createTemplate(config: Omit<WorkflowTemplate, 'id' | 'createdAt'>): WorkflowTemplate {
    const template: WorkflowTemplate = {
      ...config,
      id: this.generateTemplateId(),
      createdAt: new Date(),
    };

    this.templates.set(template.id, template);

    eventBus.emitSync('workflow.template_created', template, 'WorkflowManager');

    return template;
  }

  /**
   * Get template
   */
  getTemplate(templateId: string): WorkflowTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List templates
   */
  listTemplates(category?: string): WorkflowTemplate[] {
    let templates = Array.from(this.templates.values());

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return templates;
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Execution Engine
 */
export class ExecutionEngine {
  private executions: Map<string, WorkflowExecution> = new Map();
  private workflowManager: WorkflowManager;

  constructor(workflowManager: WorkflowManager) {
    this.workflowManager = workflowManager;
  }

  /**
   * Start workflow execution
   */
  async startExecution(workflowId: string, input: any): Promise<WorkflowExecution> {
    const workflow = this.workflowManager.getWorkflow(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== WorkflowStatus.Active) {
      throw new Error(`Workflow is not active: ${workflowId}`);
    }

    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflowId,
      workflowVersion: workflow.version,
      status: ExecutionStatus.Running,
      currentState: workflow.definition.initialState,
      context: {
        variables: new Map(),
        input,
        metadata: {},
      },
      history: [{
        timestamp: new Date(),
        type: EventType.ExecutionStarted,
        stateId: workflow.definition.initialState,
        stateName: workflow.definition.initialState,
        details: {},
      }],
      startedAt: new Date(),
    };

    this.executions.set(execution.id, execution);

    eventBus.emitSync('workflow.execution_started', execution, 'ExecutionEngine');

    // Start execution
    await this.executeState(execution, workflow);

    return execution;
  }

  /**
   * Execute state
   */
  private async executeState(execution: WorkflowExecution, workflow: Workflow): Promise<void> {
    const state = workflow.definition.states.find(s => s.id === execution.currentState);

    if (!state) {
      throw new Error(`State not found: ${execution.currentState}`);
    }

    execution.history.push({
      timestamp: new Date(),
      type: EventType.StateEntered,
      stateId: state.id,
      stateName: state.name,
      details: {},
    });

    // Execute onEntry actions
    if (state.onEntry) {
      for (const action of state.onEntry) {
        await this.executeAction(execution, action);
      }
    }

    // Execute state based on type
    try {
      switch (state.type) {
        case StateType.Task:
          await this.executeTask(execution, state);
          break;

        case StateType.Wait:
          await this.executeWait(execution, state);
          break;

        case StateType.Success:
        case StateType.Fail:
          await this.completeExecution(execution, state.type === StateType.Success);
          return;

        default:
          break;
      }

      // Execute onExit actions
      if (state.onExit) {
        for (const action of state.onExit) {
          await this.executeAction(execution, action);
        }
      }

      execution.history.push({
        timestamp: new Date(),
        type: EventType.StateExited,
        stateId: state.id,
        stateName: state.name,
        details: {},
      });

      // Determine next state
      const nextState = this.determineNextState(execution, workflow);

      if (nextState) {
        execution.currentState = nextState;
        await this.executeState(execution, workflow);
      } else {
        await this.completeExecution(execution, true);
      }

    } catch (error) {
      await this.handleError(execution, state, error);
    }
  }

  /**
   * Execute task
   */
  private async executeTask(execution: WorkflowExecution, state: State): Promise<void> {
    // Mock task execution
    await new Promise(resolve => setTimeout(resolve, 100));

    execution.history.push({
      timestamp: new Date(),
      type: EventType.ActionExecuted,
      stateId: state.id,
      stateName: state.name,
      details: { action: 'task_executed' },
    });
  }

  /**
   * Execute wait
   */
  private async executeWait(execution: WorkflowExecution, state: State): Promise<void> {
    const waitTime = state.timeout || 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Execute action
   */
  private async executeAction(execution: WorkflowExecution, action: Action): Promise<void> {
    // Mock action execution
    await new Promise(resolve => setTimeout(resolve, 50));

    execution.history.push({
      timestamp: new Date(),
      type: EventType.ActionExecuted,
      stateId: execution.currentState,
      stateName: execution.currentState,
      details: { actionType: action.type },
    });
  }

  /**
   * Determine next state
   */
  private determineNextState(execution: WorkflowExecution, workflow: Workflow): string | null {
    const transitions = workflow.definition.transitions
      .filter(t => t.from === execution.currentState)
      .sort((a, b) => b.priority - a.priority);

    for (const transition of transitions) {
      if (!transition.condition || this.evaluateCondition(execution, transition.condition)) {
        execution.history.push({
          timestamp: new Date(),
          type: EventType.TransitionTaken,
          stateId: transition.from,
          stateName: transition.from,
          details: { to: transition.to },
        });

        return transition.to;
      }
    }

    return null;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(execution: WorkflowExecution, condition: Condition): boolean {
    const value = execution.context.variables.get(condition.field);

    switch (condition.operator) {
      case ConditionOperator.Equals:
        return value === condition.value;
      case ConditionOperator.NotEquals:
        return value !== condition.value;
      case ConditionOperator.GreaterThan:
        return value > condition.value;
      case ConditionOperator.LessThan:
        return value < condition.value;
      case ConditionOperator.Contains:
        return String(value).includes(String(condition.value));
      case ConditionOperator.Exists:
        return value !== undefined;
      default:
        return false;
    }
  }

  /**
   * Handle error
   */
  private async handleError(execution: WorkflowExecution, state: State, error: any): Promise<void> {
    execution.status = ExecutionStatus.Failed;
    execution.error = {
      type: error.name || 'Error',
      message: error.message || 'Unknown error',
      stateId: state.id,
      timestamp: new Date(),
      stackTrace: error.stack,
    };

    execution.history.push({
      timestamp: new Date(),
      type: EventType.ErrorOccurred,
      stateId: state.id,
      stateName: state.name,
      details: { error: execution.error },
    });

    await this.completeExecution(execution, false);
  }

  /**
   * Complete execution
   */
  private async completeExecution(execution: WorkflowExecution, success: boolean): Promise<void> {
    execution.status = success ? ExecutionStatus.Succeeded : ExecutionStatus.Failed;
    execution.completedAt = new Date();

    execution.history.push({
      timestamp: new Date(),
      type: EventType.ExecutionCompleted,
      stateId: execution.currentState,
      stateName: execution.currentState,
      details: { success },
    });

    eventBus.emitSync('workflow.execution_completed', execution, 'ExecutionEngine');
  }

  /**
   * Get execution
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List executions
   */
  listExecutions(filter?: { workflowId?: string; status?: ExecutionStatus }): WorkflowExecution[] {
    let executions = Array.from(this.executions.values());

    if (filter?.workflowId) {
      executions = executions.filter(e => e.workflowId === filter.workflowId);
    }

    if (filter?.status) {
      executions = executions.filter(e => e.status === filter.status);
    }

    return executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Abort execution
   */
  abortExecution(executionId: string): void {
    const execution = this.executions.get(executionId);

    if (execution && execution.status === ExecutionStatus.Running) {
      execution.status = ExecutionStatus.Aborted;
      execution.completedAt = new Date();

      eventBus.emitSync('workflow.execution_aborted', execution, 'ExecutionEngine');
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Task Manager
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();

  /**
   * Create task
   */
  createTask(config: Omit<Task, 'id' | 'status' | 'createdAt'>): Task {
    const task: Task = {
      ...config,
      id: this.generateTaskId(),
      status: TaskStatus.Pending,
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);

    eventBus.emitSync('workflow.task_created', task, 'TaskManager');

    return task;
  }

  /**
   * Complete task
   */
  completeTask(taskId: string, output: any): void {
    const task = this.tasks.get(taskId);

    if (task) {
      task.status = TaskStatus.Completed;
      task.output = output;
      task.completedAt = new Date();

      eventBus.emitSync('workflow.task_completed', task, 'TaskManager');
    }
  }

  /**
   * Assign task
   */
  assignTask(taskId: string, assignee: string): void {
    const task = this.tasks.get(taskId);

    if (task) {
      task.assignee = assignee;
      task.status = TaskStatus.InProgress;

      eventBus.emitSync('workflow.task_assigned', task, 'TaskManager');
    }
  }

  /**
   * Get task
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * List tasks
   */
  listTasks(filter?: { status?: TaskStatus; assignee?: string; executionId?: string }): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter?.assignee) {
      tasks = tasks.filter(t => t.assignee === filter.assignee);
    }

    if (filter?.executionId) {
      tasks = tasks.filter(t => t.executionId === filter.executionId);
    }

    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Approval Manager
 */
export class ApprovalManager {
  private approvals: Map<string, ApprovalRequest> = new Map();

  /**
   * Create approval request
   */
  createApprovalRequest(config: Omit<ApprovalRequest, 'id' | 'responses' | 'status' | 'createdAt'>): ApprovalRequest {
    const approval: ApprovalRequest = {
      ...config,
      id: this.generateApprovalId(),
      responses: [],
      status: ApprovalStatus.Pending,
      createdAt: new Date(),
    };

    this.approvals.set(approval.id, approval);

    eventBus.emitSync('workflow.approval_created', approval, 'ApprovalManager');

    return approval;
  }

  /**
   * Submit approval response
   */
  submitResponse(approvalId: string, approver: string, decision: ApprovalDecision, comment?: string): void {
    const approval = this.approvals.get(approvalId);

    if (!approval || approval.status !== ApprovalStatus.Pending) {
      return;
    }

    if (!approval.approvers.includes(approver)) {
      throw new Error('Approver not authorized');
    }

    approval.responses.push({
      approver,
      decision,
      comment,
      timestamp: new Date(),
    });

    // Check if approval is complete
    const status = this.evaluateApprovalStatus(approval);

    if (status !== ApprovalStatus.Pending) {
      approval.status = status;
      approval.resolvedAt = new Date();

      eventBus.emitSync('workflow.approval_resolved', approval, 'ApprovalManager');
    }
  }

  /**
   * Get approval request
   */
  getApprovalRequest(approvalId: string): ApprovalRequest | undefined {
    return this.approvals.get(approvalId);
  }

  /**
   * List approval requests
   */
  listApprovalRequests(filter?: { status?: ApprovalStatus; approver?: string }): ApprovalRequest[] {
    let approvals = Array.from(this.approvals.values());

    if (filter?.status) {
      approvals = approvals.filter(a => a.status === filter.status);
    }

    if (filter?.approver) {
      approvals = approvals.filter(a => a.approvers.includes(filter.approver!));
    }

    return approvals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private evaluateApprovalStatus(approval: ApprovalRequest): ApprovalStatus {
    const approvedCount = approval.responses.filter(r => r.decision === ApprovalDecision.Approved).length;
    const rejectedCount = approval.responses.filter(r => r.decision === ApprovalDecision.Rejected).length;

    switch (approval.approvalType) {
      case ApprovalType.AllRequired:
        if (rejectedCount > 0) return ApprovalStatus.Rejected;
        if (approvedCount === approval.approvers.length) return ApprovalStatus.Approved;
        break;

      case ApprovalType.AnyRequired:
        if (approvedCount > 0) return ApprovalStatus.Approved;
        if (rejectedCount === approval.approvers.length) return ApprovalStatus.Rejected;
        break;

      case ApprovalType.MajorityRequired:
        const required = Math.ceil(approval.approvers.length / 2);
        if (approvedCount >= required) return ApprovalStatus.Approved;
        if (rejectedCount >= required) return ApprovalStatus.Rejected;
        break;

      case ApprovalType.SingleRequired:
        if (approvedCount > 0) return ApprovalStatus.Approved;
        if (rejectedCount > 0) return ApprovalStatus.Rejected;
        break;
    }

    return ApprovalStatus.Pending;
  }

  private generateApprovalId(): string {
    return `approval_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const workflowManager = new WorkflowManager();
export const executionEngine = new ExecutionEngine(workflowManager);
export const taskManager = new TaskManager();
export const approvalManager = new ApprovalManager();
