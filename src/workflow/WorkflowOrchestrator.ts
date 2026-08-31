/**
 * Advanced Workflow Orchestration System
 * Multi-step workflow execution, state management, conditional branching
 * Parallel execution, error handling, rollback support
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type StepType =
  | 'task'
  | 'parallel'
  | 'sequence'
  | 'condition'
  | 'loop'
  | 'wait'
  | 'approval'
  | 'webhook'
  | 'subprocess';

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

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

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

// ============================================================================
// Workflow Orchestrator
// ============================================================================

export class WorkflowOrchestrator extends EventEmitter {
  private config: WorkflowConfig;
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private executors: Map<StepType, StepExecutor> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  private activeExecutions: Set<string> = new Set();

  constructor(config: Partial<WorkflowConfig> = {}) {
    super();
    this.config = {
      maxConcurrency: 10,
      timeout: 3600000, // 1 hour
      retryPolicy: {
        maxAttempts: 3,
        backoffType: 'exponential',
        initialDelay: 1000,
        maxDelay: 60000,
      },
      enableStateSnapshot: true,
      snapshotInterval: 60000,
      persistenceBackend: 'memory',
      ...config,
    };

    this.registerDefaultExecutors();
  }

  // ========================================================================
  // Workflow Management
  // ========================================================================

  public registerWorkflow(workflow: Omit<Workflow, 'id' | 'state'>): Workflow {
    const full: Workflow = {
      ...workflow,
      id: this.generateId(),
      state: {
        status: 'pending',
        executionHistory: [],
      },
    };

    this.workflows.set(full.id, full);
    this.emit('workflow:registered', { workflow: full });

    return full;
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  public deleteWorkflow(workflowId: string): void {
    this.workflows.delete(workflowId);
    this.emit('workflow:deleted', { workflowId });
  }

  // ========================================================================
  // Workflow Execution
  // ========================================================================

  public async executeWorkflow(
    workflowId: string,
    variables: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check concurrency
    if (this.activeExecutions.size >= this.config.maxConcurrency) {
      throw new Error('Max concurrency reached');
    }

    const execution: WorkflowExecution = {
      id: this.generateId(),
      workflowId,
      status: 'running',
      variables: new Map(Object.entries(variables)),
      stepResults: new Map(),
      startedAt: Date.now(),
      snapshots: [],
    };

    this.executions.set(execution.id, execution);
    this.activeExecutions.add(execution.id);

    workflow.state.status = 'running';
    workflow.state.startedAt = Date.now();

    this.emit('workflow:started', { workflow, execution });

    try {
      const context = this.createWorkflowContext(workflow, execution);

      // Validate required variables
      this.validateVariables(workflow, execution.variables);

      // Execute workflow steps
      await this.executeSteps(workflow, context);

      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;

      workflow.state.status = 'completed';
      workflow.state.completedAt = Date.now();

      this.emit('workflow:completed', { workflow, execution });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error as Error;
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt! - execution.startedAt;

      workflow.state.status = 'failed';
      workflow.state.error = error as Error;

      this.emit('workflow:failed', { workflow, execution, error });
      throw error;
    } finally {
      this.activeExecutions.delete(execution.id);
    }

    return execution;
  }

  private async executeSteps(workflow: Workflow, context: WorkflowContext): Promise<void> {
    const completedSteps = new Set<string>();
    const pendingSteps = new Set(workflow.steps.map(s => s.id));

    while (pendingSteps.size > 0) {
      // Find executable steps (dependencies satisfied)
      const executableSteps = workflow.steps.filter(step => {
        if (!step || !pendingSteps.has(step.id)) return false;
        return step.dependencies.every(dep => completedSteps.has(dep));
      });

      if (executableSteps.length === 0) {
        throw new Error('Workflow deadlock detected');
      }

      // Execute steps
      await Promise.all(
        executableSteps.map(async step => {
          await this.executeStep(step, context);
          completedSteps.add(step.id);
          pendingSteps.delete(step.id);
        })
      );
    }
  }

  private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    this.emit('step:start', { step, context });

    const record: ExecutionRecord = {
      stepId: step.id,
      status: 'running',
      startedAt: Date.now(),
      retryCount: 0,
      input: step.config.input,
    };

    context.workflow.state.currentStep = step.id;
    context.workflow.state.executionHistory.push(record);

    try {
      // Check conditions
      if (step.conditions.length > 0) {
        const shouldExecute = await this.evaluateConditions(step.conditions, context);
        if (!shouldExecute) {
          record.status = 'skipped';
          record.completedAt = Date.now();
          this.emit('step:skipped', { step, context });
          return;
        }
      }

      // Execute with retry
      const retryPolicy = step.retryPolicy || this.config.retryPolicy;
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= retryPolicy.maxAttempts; attempt++) {
        if (attempt > 0) {
          const delay = this.calculateRetryDelay(attempt, retryPolicy);
          await this.delay(delay);
          record.retryCount = attempt;
        }

        try {
          const executor = this.executors.get(step.type);
          if (!executor) {
            throw new Error(`No executor found for step type: ${step.type}`);
          }

          const timeout = step.timeout || this.config.timeout;
          const result = await this.executeWithTimeout(
            executor.execute(step, context),
            timeout
          );

          record.status = 'completed';
          record.output = result;
          record.completedAt = Date.now();
          record.duration = record.completedAt - record.startedAt;

          context.stepResults.set(step.id, result);

          // Execute success actions
          if (step.onSuccess) {
            await this.executeActions(step.onSuccess, context);
          }

          this.emit('step:completed', { step, result, context });

          return result;
        } catch (error) {
          lastError = error as Error;

          // Check if error is retryable
          if (!this.isRetryableError(error as Error, retryPolicy)) {
            break;
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (error) {
      record.status = 'failed';
      record.error = error as Error;
      record.completedAt = Date.now();
      record.duration = record.completedAt - record.startedAt;

      // Execute failure actions
      if (step.onFailure) {
        await this.executeActions(step.onFailure, context);
      }

      // Check error handler
      if (step.errorHandler) {
        const handler = context.workflow.errorHandlers.find(h => h.id === step.errorHandler);
        if (handler) {
          await this.handleError(handler, error as Error, context);
        }
      }

      this.emit('step:failed', { step, error, context });

      throw error;
    }
  }

  private async evaluateConditions(
    conditions: Condition[],
    context: WorkflowContext
  ): Promise<boolean> {
    for (const condition of conditions) {
      let result: boolean;

      switch (condition.type) {
        case 'expression':
          result = this.evaluateExpression(condition.expression!, context);
          break;

        case 'script':
          result = await this.evaluateScript(condition.script!, context);
          break;

        case 'custom':
          if (!condition.handler) {
            throw new Error('Custom condition requires a handler function');
          }
          result = condition.handler(context);
          break;

        default:
          result = true;
      }

      if (!result) {
        return false;
      }
    }

    return true;
  }

  private evaluateExpression(expression: string, context: WorkflowContext): boolean {
    // Simple expression evaluation
    // In production, use a proper expression parser
    try {
      const vars = Object.fromEntries(context.variables);
      const fn = new Function(...Object.keys(vars), `return ${expression}`);
      return fn(...Object.values(vars));
    } catch {
      return false;
    }
  }

  private async evaluateScript(script: string, context: WorkflowContext): Promise<boolean> {
    // Script evaluation
    // In production, use a sandboxed environment
    try {
      const vars = Object.fromEntries(context.variables);
      const fn = new Function(...Object.keys(vars), script);
      return await fn(...Object.values(vars));
    } catch {
      return false;
    }
  }

  private async executeActions(actions: StepAction[], context: WorkflowContext): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'set_variable':
          if (action.variable) {
            context.setVariable(action.variable, action.value);
          }
          break;

        case 'emit_event':
          if (action.event) {
            context.emit(action.event, {});
          }
          break;

        case 'trigger_workflow':
          if (action.workflowId) {
            await this.executeWorkflow(action.workflowId);
          }
          break;

        case 'custom':
          if (action.handler) {
            action.handler(context);
          }
          break;
      }
    }
  }

  private async handleError(
    handler: ErrorHandler,
    error: Error,
    context: WorkflowContext
  ): Promise<void> {
    switch (handler.action) {
      case 'retry':
        // Retry is handled by step executor
        break;

      case 'skip':
        // Skip the error
        break;

      case 'fail':
        throw error;

      case 'rollback':
        await this.rollbackWorkflow(context.execution.id);
        break;

      case 'custom':
        if (handler.handler) {
          handler.handler(error, context);
        }
        break;
    }
  }

  // ========================================================================
  // Step Executors
  // ========================================================================

  private registerDefaultExecutors(): void {
    this.registerExecutor('task', new TaskExecutor());
    this.registerExecutor('parallel', new ParallelExecutor(this));
    this.registerExecutor('sequence', new SequenceExecutor(this));
    this.registerExecutor('condition', new ConditionExecutor(this));
    this.registerExecutor('loop', new LoopExecutor(this));
    this.registerExecutor('wait', new WaitExecutor());
    this.registerExecutor('approval', new ApprovalExecutor(this));
    this.registerExecutor('webhook', new WebhookExecutor());
  }

  public registerExecutor(type: StepType, executor: StepExecutor): void {
    this.executors.set(type, executor);
  }

  // ========================================================================
  // Workflow Control
  // ========================================================================

  public async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    execution.status = 'paused';
    workflow.state.status = 'paused';
    workflow.state.pausedAt = Date.now();

    this.emit('workflow:paused', { workflow, execution });
  }

  public async resumeWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    execution.status = 'running';
    workflow.state.status = 'running';
    workflow.state.pausedAt = undefined;

    this.emit('workflow:resumed', { workflow, execution });

    // Continue execution
    const context = this.createWorkflowContext(workflow, execution);
    await this.executeSteps(workflow, context);
  }

  public async cancelWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    execution.status = 'cancelled';
    execution.completedAt = Date.now();
    execution.duration = execution.completedAt - execution.startedAt;

    workflow.state.status = 'cancelled';
    workflow.state.completedAt = Date.now();

    this.activeExecutions.delete(execution.id);

    this.emit('workflow:cancelled', { workflow, execution });
  }

  public async rollbackWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    this.emit('workflow:rollback:start', { execution });

    // Rollback in reverse order
    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return;

    const completedSteps = workflow.state.executionHistory
      .filter(r => r.status === 'completed')
      .reverse();

    for (const record of completedSteps) {
      const step = workflow.steps.find(s => s.id === record.stepId);
      if (step && step.config.handler) {
        // Execute rollback handler if exists
        this.emit('step:rollback', { step, record });
      }
    }

    this.emit('workflow:rollback:complete', { execution });
  }

  // ========================================================================
  // Approval Management
  // ========================================================================

  public async requestApproval(
    executionId: string,
    stepId: string,
    approvers: string[]
  ): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: this.generateId(),
      workflowExecutionId: executionId,
      stepId,
      requestedAt: Date.now(),
      approvers,
      requiredApprovals: Math.ceil(approvers.length / 2),
      approvals: [],
      status: 'pending',
    };

    this.approvalRequests.set(request.id, request);
    this.emit('approval:requested', { request });

    return request;
  }

  public async submitApproval(
    requestId: string,
    approver: string,
    approved: boolean,
    comment?: string
  ): Promise<void> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    if (!request.approvers.includes(approver)) {
      throw new Error(`Approver not authorized: ${approver}`);
    }

    if (request.approvals.some(a => a.approver === approver)) {
      throw new Error(`Approver already submitted: ${approver}`);
    }

    const approval: Approval = {
      approver,
      approved,
      timestamp: Date.now(),
      comment,
    };

    request.approvals.push(approval);

    // Check if enough approvals
    const approvedCount = request.approvals.filter(a => a.approved).length;
    const rejectedCount = request.approvals.filter(a => !a.approved).length;

    if (approvedCount >= request.requiredApprovals) {
      request.status = 'approved';
      this.emit('approval:approved', { request });

      // Resume workflow
      const execution = this.executions.get(request.workflowExecutionId);
      if (execution && execution.status === 'waiting_approval') {
        await this.resumeWorkflow(execution.id);
      }
    } else if (rejectedCount > request.approvers.length - request.requiredApprovals) {
      request.status = 'rejected';
      this.emit('approval:rejected', { request });

      // Cancel workflow
      await this.cancelWorkflow(request.workflowExecutionId);
    }

    this.emit('approval:submitted', { request, approval });
  }

  // ========================================================================
  // Template Management
  // ========================================================================

  public registerTemplate(template: Omit<WorkflowTemplate, 'id'>): WorkflowTemplate {
    const full: WorkflowTemplate = {
      ...template,
      id: this.generateId(),
    };

    this.templates.set(full.id, full);
    this.emit('template:registered', { template: full });

    return full;
  }

  public async instantiateTemplate(
    templateId: string,
    parameters: Record<string, any>
  ): Promise<Workflow> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate parameters
    for (const param of template.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }
    }

    // Clone workflow and apply parameters
    const workflow = JSON.parse(JSON.stringify(template.workflow));

    // Replace parameter placeholders
    const workflowStr = JSON.stringify(workflow);
    const replacedStr = workflowStr.replace(
      /\{\{(\w+)\}\}/g,
      (_, paramName) => parameters[paramName] || ''
    );

    const instantiated = JSON.parse(replacedStr);

    return this.registerWorkflow(instantiated);
  }

  // ========================================================================
  // Context Creation
  // ========================================================================

  private createWorkflowContext(
    workflow: Workflow,
    execution: WorkflowExecution
  ): WorkflowContext {
    return {
      workflow,
      execution,
      variables: execution.variables,
      stepResults: execution.stepResults,
      emit: (event: string, data: any) => {
        this.emit(event, { workflow, execution, data });
      },
      getVariable: (name: string) => execution.variables.get(name),
      setVariable: (name: string, value: any) => {
        execution.variables.set(name, value);
      },
      getStepResult: (stepId: string) => execution.stepResults.get(stepId),
      log: (message: string, level: string = 'info') => {
        this.emit('workflow:log', { workflow, execution, message, level });
      },
    };
  }

  private validateVariables(workflow: Workflow, variables: Map<string, any>): void {
    for (const variable of workflow.variables) {
      if (variable.required && !variables.has(variable.name)) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }

      if (!variables.has(variable.name) && variable.default !== undefined) {
        variables.set(variable.name, variable.default);
      }
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private isRetryableError(error: Error, policy: RetryPolicy): boolean {
    if (!policy.retryableErrors || policy.retryableErrors.length === 0) {
      return true;
    }

    return policy.retryableErrors.some(pattern => error.message.includes(pattern));
  }

  private calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
    let delay: number;

    switch (policy.backoffType) {
      case 'fixed':
        delay = policy.initialDelay;
        break;

      case 'linear':
        delay = policy.initialDelay * attempt;
        break;

      case 'exponential':
        delay = policy.initialDelay * Math.pow(2, attempt - 1);
        break;

      default:
        delay = policy.initialDelay;
    }

    return Math.min(delay, policy.maxDelay);
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Step timeout')), timeout)
      ),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  public listExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());

    if (workflowId) {
      return executions.filter(e => e.workflowId === workflowId);
    }

    return executions;
  }

  public getStats(): WorkflowStats {
    const executions = Array.from(this.executions.values());

    return {
      totalWorkflows: this.workflows.size,
      totalExecutions: executions.length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      completedExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
      activeApprovals: Array.from(this.approvalRequests.values()).filter(
        r => r.status === 'pending'
      ).length,
    };
  }
}

// ============================================================================
// Step Executors Implementation
// ============================================================================

class TaskExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    // Execute task handler
    if (step.config.handler) {
      // In production, execute the actual handler
      return { result: 'task completed' };
    }
    return step.config.output;
  }
}

class ParallelExecutor implements StepExecutor {
  constructor(private orchestrator: WorkflowOrchestrator) {}

  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const parallelSteps = step.config.parallelSteps || [];
    const workflow = context.workflow;

    const steps = workflow.steps.filter(s => parallelSteps.includes(s.id));

    const results = await Promise.all(
      steps.map(async s => {
        return await this.orchestrator['executeStep'](s, context);
      })
    );

    return results;
  }
}

class SequenceExecutor implements StepExecutor {
  constructor(private orchestrator: WorkflowOrchestrator) {}

  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const sequenceSteps = step.config.sequenceSteps || [];
    const workflow = context.workflow;

    const steps = workflow.steps.filter(s => sequenceSteps.includes(s.id));

    const results: any[] = [];
    for (const s of steps) {
      const result = await this.orchestrator['executeStep'](s, context);
      results.push(result);
    }

    return results;
  }
}

class ConditionExecutor implements StepExecutor {
  constructor(private orchestrator: WorkflowOrchestrator) {}

  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    // Condition evaluation is handled in evaluateConditions
    return { condition: true };
  }
}

class LoopExecutor implements StepExecutor {
  constructor(private orchestrator: WorkflowOrchestrator) {}

  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const loopVariable = step.config.loopVariable;
    const collectionName = step.config.loopCollection;

    if (!loopVariable || !collectionName) {
      throw new Error('Loop step requires loopVariable and loopCollection');
    }

    const collection = context.getVariable(collectionName);
    if (!Array.isArray(collection)) {
      throw new Error('Loop collection must be an array');
    }

    const results: any[] = [];
    for (const item of collection) {
      context.setVariable(loopVariable, item);
      // Execute loop body
      results.push(item);
    }

    return results;
  }
}

class WaitExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const duration = step.config.waitDuration || 0;
    await new Promise(resolve => setTimeout(resolve, duration));
    return { waited: duration };
  }
}

class ApprovalExecutor implements StepExecutor {
  constructor(private orchestrator: WorkflowOrchestrator) {}

  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const approvers = step.config.approvers || [];

    const request = await this.orchestrator.requestApproval(
      context.execution.id,
      step.id,
      approvers
    );

    context.execution.status = 'waiting_approval';

    // Wait for approval (in production, this would be event-driven)
    return { requestId: request.id };
  }
}

class WebhookExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const url = step.config.webhookURL;
    if (!url) {
      throw new Error('Webhook URL required');
    }

    // In production, make actual HTTP request
    return { status: 'webhook sent' };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface WorkflowStats {
  totalWorkflows: number;
  totalExecutions: number;
  runningExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  activeApprovals: number;
}

// ============================================================================
// Export
// ============================================================================

export default WorkflowOrchestrator;
