/**
 * Workflow Engine & Orchestration System
 * Complex workflow management, state machines, and task orchestration
 *
 * Part of 350K lines goal
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type StepType =
  | 'task'
  | 'parallel'
  | 'choice'
  | 'wait'
  | 'map'
  | 'succeed'
  | 'fail';

export interface StepAction {
  type: ActionType;
  handler: string;
  parameters?: Record<string, any>;
}

export type ActionType =
  | 'function'
  | 'http'
  | 'event'
  | 'subprocess'
  | 'human_task';

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

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'contains';

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
  schedule?: string; // Cron expression
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

// State Machine
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

// Human Tasks
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

// Workflow Metrics
export interface WorkflowMetrics {
  totalWorkflows: number;
  runningWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  averageDuration: number;
  successRate: number;
}

// ============================================================================
// Workflow Engine Manager
// ============================================================================

export class WorkflowEngineManager extends EventEmitter {
  private config: WorkflowConfig;
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private stateMachines: Map<string, StateMachine> = new Map();
  private humanTasks: Map<string, HumanTask> = new Map();
  private runningExecutions: number = 0;

  constructor(config: Partial<WorkflowConfig> = {}) {
    super();
    this.config = {
      maxConcurrentWorkflows: 100,
      defaultTimeout: 3600000, // 1 hour
      enableRetry: true,
      enableCompensation: true,
      persistState: true,
      ...config,
    };
  }

  // ========================================================================
  // Workflow Definition
  // ========================================================================

  public defineWorkflow(
    name: string,
    version: string,
    definition: WorkflowDefinition
  ): Workflow {
    const workflow: Workflow = {
      id: this.generateId(),
      name,
      version,
      definition,
      state: 'pending',
      variables: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(workflow.id, workflow);
    this.emit('workflow:defined', { workflowId: workflow.id });

    return workflow;
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  // ========================================================================
  // Workflow Execution
  // ========================================================================

  public async executeWorkflow(
    workflowId: string,
    input: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (this.runningExecutions >= this.config.maxConcurrentWorkflows) {
      throw new Error('Max concurrent workflows reached');
    }

    const execution: WorkflowExecution = {
      id: this.generateId(),
      workflowId,
      state: 'running',
      stepHistory: [],
      variables: { ...input },
      startedAt: new Date(),
    };

    this.executions.set(execution.id, execution);
    this.runningExecutions++;

    workflow.state = 'running';
    workflow.startedAt = new Date();

    this.emit('workflow:started', { executionId: execution.id });

    try {
      await this.runWorkflow(workflow, execution);

      execution.state = 'completed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      workflow.state = 'completed';
      workflow.completedAt = new Date();

      this.emit('workflow:completed', { executionId: execution.id });
    } catch (error) {
      execution.state = 'failed';
      execution.error = {
        type: 'WorkflowError',
        message: (error as Error).message,
        retryable: false,
      };

      workflow.state = 'failed';

      this.emit('workflow:failed', { executionId: execution.id, error });
    } finally {
      this.runningExecutions--;
    }

    return execution;
  }

  private async runWorkflow(
    workflow: Workflow,
    execution: WorkflowExecution
  ): Promise<void> {
    const steps = workflow.definition.steps;

    if (steps.length === 0) {
      return;
    }

    let currentStep = steps[0];

    while (currentStep) {
      execution.currentStep = currentStep.id;

      const stepExecution = await this.executeStep(currentStep, execution);
      execution.stepHistory.push(stepExecution);

      if (stepExecution.state === 'failed') {
        if (currentStep.onError) {
          currentStep = steps.find(s => s.id === currentStep.onError)!;
          continue;
        } else {
          throw new Error(`Step ${currentStep.id} failed`);
        }
      }

      // Determine next step
      if (currentStep.type === 'choice') {
        currentStep = this.evaluateChoice(currentStep, execution);
      } else if (currentStep.type === 'succeed' || currentStep.type === 'fail') {
        break;
      } else if (currentStep.next) {
        const nextId = Array.isArray(currentStep.next) ? currentStep.next[0] : currentStep.next;
        currentStep = steps.find(s => s.id === nextId)!;
      } else {
        break;
      }
    }
  }

  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<StepExecution> {
    const stepExecution: StepExecution = {
      stepId: step.id,
      state: 'running',
      attempts: 0,
      startedAt: new Date(),
    };

    this.emit('step:started', { executionId: execution.id, stepId: step.id });

    try {
      // Check condition
      if (step.condition && !this.evaluateCondition(step.condition, execution.variables)) {
        stepExecution.state = 'skipped';
        stepExecution.completedAt = new Date();
        return stepExecution;
      }

      // Get input
      const input = this.resolveInput(step.input, execution);
      stepExecution.input = input;

      // Execute action with retry
      let result;
      const maxAttempts = step.retry?.maxAttempts || 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        stepExecution.attempts = attempt;

        try {
          result = await this.executeAction(step.action, input, execution);
          break;
        } catch (error) {
          if (attempt < maxAttempts && step.retry) {
            const delay = this.calculateBackoff(attempt, step.retry.backoff);
            await this.sleep(delay);
            stepExecution.state = 'retrying';
          } else {
            throw error;
          }
        }
      }

      stepExecution.output = result;
      stepExecution.state = 'completed';

      // Store output
      if (step.output) {
        execution.variables[step.output] = result;
      }

      this.emit('step:completed', { executionId: execution.id, stepId: step.id });
    } catch (error) {
      stepExecution.state = 'failed';
      stepExecution.error = {
        type: 'StepError',
        message: (error as Error).message,
        retryable: false,
      };

      this.emit('step:failed', { executionId: execution.id, stepId: step.id, error });
    }

    stepExecution.completedAt = new Date();
    stepExecution.duration = stepExecution.completedAt.getTime() - stepExecution.startedAt.getTime();

    return stepExecution;
  }

  private async executeAction(
    action: StepAction,
    input: any,
    execution: WorkflowExecution
  ): Promise<any> {
    switch (action.type) {
      case 'function':
        return this.executeFunctionAction(action, input);
      case 'http':
        return this.executeHttpAction(action, input);
      case 'event':
        return this.executeEventAction(action, input);
      case 'human_task':
        return this.executeHumanTaskAction(action, input, execution);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeFunctionAction(action: StepAction, input: any): Promise<any> {
    // Simulate function execution
    return { result: 'Function executed', input };
  }

  private async executeHttpAction(action: StepAction, input: any): Promise<any> {
    // Simulate HTTP call
    return { statusCode: 200, body: { result: 'HTTP call completed' } };
  }

  private async executeEventAction(action: StepAction, input: any): Promise<any> {
    this.emit('workflow:event', { handler: action.handler, input });
    return { result: 'Event emitted' };
  }

  private async executeHumanTaskAction(
    action: StepAction,
    input: any,
    execution: WorkflowExecution
  ): Promise<any> {
    const humanTask = this.createHumanTask(execution.id, action, input);

    // Wait for human task completion
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const task = this.humanTasks.get(humanTask.id);

        if (task?.state === 'completed') {
          clearInterval(checkInterval);
          resolve(task.result);
        } else if (task?.state === 'rejected') {
          clearInterval(checkInterval);
          reject(new Error('Human task rejected'));
        }
      }, 1000);
    });
  }

  // ========================================================================
  // Human Tasks
  // ========================================================================

  private createHumanTask(
    executionId: string,
    action: StepAction,
    input: any
  ): HumanTask {
    const task: HumanTask = {
      id: this.generateId(),
      workflowExecutionId: executionId,
      stepId: action.handler,
      description: action.parameters?.description || 'Please complete this task',
      form: action.parameters?.form,
      state: 'pending',
      createdAt: new Date(),
    };

    this.humanTasks.set(task.id, task);
    this.emit('human_task:created', { taskId: task.id });

    return task;
  }

  public completeHumanTask(taskId: string, result: any): void {
    const task = this.humanTasks.get(taskId);

    if (!task) {
      throw new Error('Human task not found');
    }

    task.state = 'completed';
    task.result = result;
    task.completedAt = new Date();

    this.emit('human_task:completed', { taskId });
  }

  public rejectHumanTask(taskId: string, reason: string): void {
    const task = this.humanTasks.get(taskId);

    if (!task) {
      throw new Error('Human task not found');
    }

    task.state = 'rejected';
    task.completedAt = new Date();

    this.emit('human_task:rejected', { taskId, reason });
  }

  // ========================================================================
  // State Machine
  // ========================================================================

  public createStateMachine(
    name: string,
    states: State[],
    transitions: Transition[]
  ): StateMachine {
    const initialState = states.find(s => s.type === 'initial');

    if (!initialState) {
      throw new Error('State machine must have an initial state');
    }

    const sm: StateMachine = {
      id: this.generateId(),
      name,
      states,
      transitions,
      currentState: initialState.name,
      context: {},
    };

    this.stateMachines.set(sm.id, sm);
    this.emit('state_machine:created', { stateMachineId: sm.id });

    return sm;
  }

  public async transitionState(
    stateMachineId: string,
    event: string,
    context?: Record<string, any>
  ): Promise<void> {
    const sm = this.stateMachines.get(stateMachineId);

    if (!sm) {
      throw new Error('State machine not found');
    }

    const transition = sm.transitions.find(
      t => t.from === sm.currentState && t.event === event
    );

    if (!transition) {
      throw new Error(`No transition found for event ${event} from state ${sm.currentState}`);
    }

    // Check condition
    if (transition.condition && !transition.condition.guard(sm.context)) {
      throw new Error('Transition condition not met');
    }

    const currentState = sm.states.find(s => s.name === sm.currentState)!;
    const nextState = sm.states.find(s => s.name === transition.to)!;

    // Execute onExit actions
    if (currentState.onExit) {
      for (const action of currentState.onExit) {
        await this.executeStateAction(action, sm);
      }
    }

    // Execute transition actions
    if (transition.actions) {
      for (const action of transition.actions) {
        await this.executeStateAction(action, sm);
      }
    }

    // Update state
    sm.currentState = transition.to;

    // Update context
    if (context) {
      sm.context = { ...sm.context, ...context };
    }

    // Execute onEntry actions
    if (nextState.onEntry) {
      for (const action of nextState.onEntry) {
        await this.executeStateAction(action, sm);
      }
    }

    this.emit('state:transitioned', {
      stateMachineId,
      from: currentState.name,
      to: nextState.name,
      event,
    });
  }

  private async executeStateAction(
    action: StateAction,
    sm: StateMachine
  ): Promise<void> {
    this.emit('state_action:executed', {
      stateMachineId: sm.id,
      action: action.type,
    });
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private resolveInput(
    input: StepInput | undefined,
    execution: WorkflowExecution
  ): any {
    if (!input) {
      return execution.variables;
    }

    let value: any;

    switch (input.source) {
      case 'workflow':
        value = execution.variables;
        break;
      case 'step':
        const lastStep = execution.stepHistory[execution.stepHistory.length - 1];
        value = lastStep?.output;
        break;
      case 'constant':
        value = input.path;
        break;
    }

    if (input.transform) {
      value = input.transform(value);
    }

    return value;
  }

  private evaluateCondition(
    condition: StepCondition,
    variables: Record<string, any>
  ): boolean {
    const value = variables[condition.variable];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'exists':
        return value !== undefined;
      case 'contains':
        return String(value).includes(condition.value);
      default:
        return false;
    }
  }

  private evaluateChoice(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): WorkflowStep | undefined {
    // Simplified choice evaluation
    if (Array.isArray(step.next)) {
      return this.workflows
        .get(execution.workflowId)
        ?.definition.steps.find(s => s.id === step.next![0]);
    }
    return undefined;
  }

  private calculateBackoff(attempt: number, config: BackoffConfig): number {
    switch (config.strategy) {
      case 'fixed':
        return config.initialInterval;
      case 'exponential':
        return Math.min(
          config.initialInterval * Math.pow(config.multiplier || 2, attempt - 1),
          config.maxInterval || 60000
        );
      case 'linear':
        return config.initialInterval * attempt;
      default:
        return config.initialInterval;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  public getMetrics(): WorkflowMetrics {
    const allExecutions = Array.from(this.executions.values());
    const completed = allExecutions.filter(e => e.state === 'completed');
    const failed = allExecutions.filter(e => e.state === 'failed');

    const durations = completed
      .map(e => e.duration)
      .filter(d => d !== undefined) as number[];

    return {
      totalWorkflows: this.workflows.size,
      runningWorkflows: this.runningExecutions,
      completedWorkflows: completed.length,
      failedWorkflows: failed.length,
      averageDuration:
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      successRate:
        allExecutions.length > 0 ? (completed.length / allExecutions.length) * 100 : 0,
    };
  }

  public getStats() {
    return {
      workflows: this.workflows.size,
      executions: this.executions.size,
      runningExecutions: this.runningExecutions,
      stateMachines: this.stateMachines.size,
      humanTasks: this.humanTasks.size,
      pendingHumanTasks: Array.from(this.humanTasks.values()).filter(
        t => t.state === 'pending'
      ).length,
      metrics: this.getMetrics(),
    };
  }
}
