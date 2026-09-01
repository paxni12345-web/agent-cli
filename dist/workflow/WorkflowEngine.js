"use strict";
/**
 * Workflow Engine & Orchestration System
 * Complex workflow management, state machines, and task orchestration
 *
 * Part of 350K lines goal
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngineManager = void 0;
const events_1 = require("events");
// ============================================================================
// Workflow Engine Manager
// ============================================================================
class WorkflowEngineManager extends events_1.EventEmitter {
    config;
    workflows = new Map();
    executions = new Map();
    stateMachines = new Map();
    humanTasks = new Map();
    runningExecutions = 0;
    constructor(config = {}) {
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
    defineWorkflow(name, version, definition) {
        const workflow = {
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
    getWorkflow(workflowId) {
        return this.workflows.get(workflowId);
    }
    listWorkflows() {
        return Array.from(this.workflows.values());
    }
    // ========================================================================
    // Workflow Execution
    // ========================================================================
    async executeWorkflow(workflowId, input = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        if (this.runningExecutions >= this.config.maxConcurrentWorkflows) {
            throw new Error('Max concurrent workflows reached');
        }
        const execution = {
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
        }
        catch (error) {
            execution.state = 'failed';
            execution.error = {
                type: 'WorkflowError',
                message: error.message,
                retryable: false,
            };
            workflow.state = 'failed';
            this.emit('workflow:failed', { executionId: execution.id, error });
        }
        finally {
            this.runningExecutions--;
        }
        return execution;
    }
    async runWorkflow(workflow, execution) {
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
                    currentStep = steps.find(s => s.id === currentStep.onError);
                    continue;
                }
                else {
                    throw new Error(`Step ${currentStep.id} failed`);
                }
            }
            // Determine next step
            if (currentStep.type === 'choice') {
                currentStep = this.evaluateChoice(currentStep, execution);
            }
            else if (currentStep.type === 'succeed' || currentStep.type === 'fail') {
                break;
            }
            else if (currentStep.next) {
                const nextId = Array.isArray(currentStep.next) ? currentStep.next[0] : currentStep.next;
                currentStep = steps.find(s => s.id === nextId);
            }
            else {
                break;
            }
        }
    }
    async executeStep(step, execution) {
        const stepExecution = {
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
                }
                catch (error) {
                    if (attempt < maxAttempts && step.retry) {
                        const delay = this.calculateBackoff(attempt, step.retry.backoff);
                        await this.sleep(delay);
                        stepExecution.state = 'retrying';
                    }
                    else {
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
        }
        catch (error) {
            stepExecution.state = 'failed';
            stepExecution.error = {
                type: 'StepError',
                message: error.message,
                retryable: false,
            };
            this.emit('step:failed', { executionId: execution.id, stepId: step.id, error });
        }
        stepExecution.completedAt = new Date();
        stepExecution.duration = stepExecution.completedAt.getTime() - stepExecution.startedAt.getTime();
        return stepExecution;
    }
    async executeAction(action, input, execution) {
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
    async executeFunctionAction(action, input) {
        // Simulate function execution
        return { result: 'Function executed', input };
    }
    async executeHttpAction(action, input) {
        // Simulate HTTP call
        return { statusCode: 200, body: { result: 'HTTP call completed' } };
    }
    async executeEventAction(action, input) {
        this.emit('workflow:event', { handler: action.handler, input });
        return { result: 'Event emitted' };
    }
    async executeHumanTaskAction(action, input, execution) {
        const humanTask = this.createHumanTask(execution.id, action, input);
        // Wait for human task completion
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const task = this.humanTasks.get(humanTask.id);
                if (task?.state === 'completed') {
                    clearInterval(checkInterval);
                    resolve(task.result);
                }
                else if (task?.state === 'rejected') {
                    clearInterval(checkInterval);
                    reject(new Error('Human task rejected'));
                }
            }, 1000);
        });
    }
    // ========================================================================
    // Human Tasks
    // ========================================================================
    createHumanTask(executionId, action, input) {
        const task = {
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
    completeHumanTask(taskId, result) {
        const task = this.humanTasks.get(taskId);
        if (!task) {
            throw new Error('Human task not found');
        }
        task.state = 'completed';
        task.result = result;
        task.completedAt = new Date();
        this.emit('human_task:completed', { taskId });
    }
    rejectHumanTask(taskId, reason) {
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
    createStateMachine(name, states, transitions) {
        const initialState = states.find(s => s.type === 'initial');
        if (!initialState) {
            throw new Error('State machine must have an initial state');
        }
        const sm = {
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
    async transitionState(stateMachineId, event, context) {
        const sm = this.stateMachines.get(stateMachineId);
        if (!sm) {
            throw new Error('State machine not found');
        }
        const transition = sm.transitions.find(t => t.from === sm.currentState && t.event === event);
        if (!transition) {
            throw new Error(`No transition found for event ${event} from state ${sm.currentState}`);
        }
        // Check condition
        if (transition.condition && !transition.condition.guard(sm.context)) {
            throw new Error('Transition condition not met');
        }
        const currentState = sm.states.find(s => s.name === sm.currentState);
        const nextState = sm.states.find(s => s.name === transition.to);
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
    async executeStateAction(action, sm) {
        this.emit('state_action:executed', {
            stateMachineId: sm.id,
            action: action.type,
        });
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    resolveInput(input, execution) {
        if (!input) {
            return execution.variables;
        }
        let value;
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
    evaluateCondition(condition, variables) {
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
    evaluateChoice(step, execution) {
        // Simplified choice evaluation
        if (Array.isArray(step.next)) {
            return this.workflows
                .get(execution.workflowId)
                ?.definition.steps.find(s => s.id === step.next[0]);
        }
        return undefined;
    }
    calculateBackoff(attempt, config) {
        switch (config.strategy) {
            case 'fixed':
                return config.initialInterval;
            case 'exponential':
                return Math.min(config.initialInterval * Math.pow(config.multiplier || 2, attempt - 1), config.maxInterval || 60000);
            case 'linear':
                return config.initialInterval * attempt;
            default:
                return config.initialInterval;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    generateId() {
        return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    getMetrics() {
        const allExecutions = Array.from(this.executions.values());
        const completed = allExecutions.filter(e => e.state === 'completed');
        const failed = allExecutions.filter(e => e.state === 'failed');
        const durations = completed
            .map(e => e.duration)
            .filter(d => d !== undefined);
        return {
            totalWorkflows: this.workflows.size,
            runningWorkflows: this.runningExecutions,
            completedWorkflows: completed.length,
            failedWorkflows: failed.length,
            averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            successRate: allExecutions.length > 0 ? (completed.length / allExecutions.length) * 100 : 0,
        };
    }
    getStats() {
        return {
            workflows: this.workflows.size,
            executions: this.executions.size,
            runningExecutions: this.runningExecutions,
            stateMachines: this.stateMachines.size,
            humanTasks: this.humanTasks.size,
            pendingHumanTasks: Array.from(this.humanTasks.values()).filter(t => t.state === 'pending').length,
            metrics: this.getMetrics(),
        };
    }
}
exports.WorkflowEngineManager = WorkflowEngineManager;
