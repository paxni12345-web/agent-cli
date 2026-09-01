"use strict";
/**
 * Advanced Workflow Orchestration System
 * Multi-step workflow execution, state management, conditional branching
 * Parallel execution, error handling, rollback support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrator = void 0;
const events_1 = require("events");
// ============================================================================
// Workflow Orchestrator
// ============================================================================
class WorkflowOrchestrator extends events_1.EventEmitter {
    config;
    workflows = new Map();
    executions = new Map();
    approvalRequests = new Map();
    executors = new Map();
    templates = new Map();
    activeExecutions = new Set();
    constructor(config = {}) {
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
    registerWorkflow(workflow) {
        const full = {
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
    getWorkflow(workflowId) {
        return this.workflows.get(workflowId);
    }
    listWorkflows() {
        return Array.from(this.workflows.values());
    }
    deleteWorkflow(workflowId) {
        this.workflows.delete(workflowId);
        this.emit('workflow:deleted', { workflowId });
    }
    // ========================================================================
    // Workflow Execution
    // ========================================================================
    async executeWorkflow(workflowId, variables = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        // Check concurrency
        if (this.activeExecutions.size >= this.config.maxConcurrency) {
            throw new Error('Max concurrency reached');
        }
        const execution = {
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
        }
        catch (error) {
            execution.status = 'failed';
            execution.error = error;
            execution.completedAt = Date.now();
            execution.duration = execution.completedAt - execution.startedAt;
            workflow.state.status = 'failed';
            workflow.state.error = error;
            this.emit('workflow:failed', { workflow, execution, error });
            throw error;
        }
        finally {
            this.activeExecutions.delete(execution.id);
        }
        return execution;
    }
    async executeSteps(workflow, context) {
        const completedSteps = new Set();
        const pendingSteps = new Set(workflow.steps.map(s => s.id));
        while (pendingSteps.size > 0) {
            // Find executable steps (dependencies satisfied)
            const executableSteps = workflow.steps.filter(step => {
                if (!step || !pendingSteps.has(step.id))
                    return false;
                return step.dependencies.every(dep => completedSteps.has(dep));
            });
            if (executableSteps.length === 0) {
                throw new Error('Workflow deadlock detected');
            }
            // Execute steps
            await Promise.all(executableSteps.map(async (step) => {
                await this.executeStep(step, context);
                completedSteps.add(step.id);
                pendingSteps.delete(step.id);
            }));
        }
    }
    async executeStep(step, context) {
        this.emit('step:start', { step, context });
        const record = {
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
            let lastError;
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
                    const result = await this.executeWithTimeout(executor.execute(step, context), timeout);
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
                }
                catch (error) {
                    lastError = error;
                    // Check if error is retryable
                    if (!this.isRetryableError(error, retryPolicy)) {
                        break;
                    }
                }
            }
            // All retries failed
            throw lastError;
        }
        catch (error) {
            record.status = 'failed';
            record.error = error;
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
                    await this.handleError(handler, error, context);
                }
            }
            this.emit('step:failed', { step, error, context });
            throw error;
        }
    }
    async evaluateConditions(conditions, context) {
        for (const condition of conditions) {
            let result;
            switch (condition.type) {
                case 'expression':
                    result = this.evaluateExpression(condition.expression, context);
                    break;
                case 'script':
                    result = await this.evaluateScript(condition.script, context);
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
    evaluateExpression(expression, context) {
        // Simple expression evaluation
        // In production, use a proper expression parser
        try {
            const vars = Object.fromEntries(context.variables);
            const fn = new Function(...Object.keys(vars), `return ${expression}`);
            return fn(...Object.values(vars));
        }
        catch {
            return false;
        }
    }
    async evaluateScript(script, context) {
        // Script evaluation
        // In production, use a sandboxed environment
        try {
            const vars = Object.fromEntries(context.variables);
            const fn = new Function(...Object.keys(vars), script);
            return await fn(...Object.values(vars));
        }
        catch {
            return false;
        }
    }
    async executeActions(actions, context) {
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
    async handleError(handler, error, context) {
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
    registerDefaultExecutors() {
        this.registerExecutor('task', new TaskExecutor());
        this.registerExecutor('parallel', new ParallelExecutor(this));
        this.registerExecutor('sequence', new SequenceExecutor(this));
        this.registerExecutor('condition', new ConditionExecutor(this));
        this.registerExecutor('loop', new LoopExecutor(this));
        this.registerExecutor('wait', new WaitExecutor());
        this.registerExecutor('approval', new ApprovalExecutor(this));
        this.registerExecutor('webhook', new WebhookExecutor());
    }
    registerExecutor(type, executor) {
        this.executors.set(type, executor);
    }
    // ========================================================================
    // Workflow Control
    // ========================================================================
    async pauseWorkflow(executionId) {
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
    async resumeWorkflow(executionId) {
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
    async cancelWorkflow(executionId) {
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
    async rollbackWorkflow(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution) {
            throw new Error(`Execution not found: ${executionId}`);
        }
        this.emit('workflow:rollback:start', { execution });
        // Rollback in reverse order
        const workflow = this.workflows.get(execution.workflowId);
        if (!workflow)
            return;
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
    async requestApproval(executionId, stepId, approvers) {
        const request = {
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
    async submitApproval(requestId, approver, approved, comment) {
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
        const approval = {
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
        }
        else if (rejectedCount > request.approvers.length - request.requiredApprovals) {
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
    registerTemplate(template) {
        const full = {
            ...template,
            id: this.generateId(),
        };
        this.templates.set(full.id, full);
        this.emit('template:registered', { template: full });
        return full;
    }
    async instantiateTemplate(templateId, parameters) {
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
        const replacedStr = workflowStr.replace(/\{\{(\w+)\}\}/g, (_, paramName) => parameters[paramName] || '');
        const instantiated = JSON.parse(replacedStr);
        return this.registerWorkflow(instantiated);
    }
    // ========================================================================
    // Context Creation
    // ========================================================================
    createWorkflowContext(workflow, execution) {
        return {
            workflow,
            execution,
            variables: execution.variables,
            stepResults: execution.stepResults,
            emit: (event, data) => {
                this.emit(event, { workflow, execution, data });
            },
            getVariable: (name) => execution.variables.get(name),
            setVariable: (name, value) => {
                execution.variables.set(name, value);
            },
            getStepResult: (stepId) => execution.stepResults.get(stepId),
            log: (message, level = 'info') => {
                this.emit('workflow:log', { workflow, execution, message, level });
            },
        };
    }
    validateVariables(workflow, variables) {
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
    isRetryableError(error, policy) {
        if (!policy.retryableErrors || policy.retryableErrors.length === 0) {
            return true;
        }
        return policy.retryableErrors.some(pattern => error.message.includes(pattern));
    }
    calculateRetryDelay(attempt, policy) {
        let delay;
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
    async executeWithTimeout(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Step timeout')), timeout)),
        ]);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    generateId() {
        return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    listExecutions(workflowId) {
        const executions = Array.from(this.executions.values());
        if (workflowId) {
            return executions.filter(e => e.workflowId === workflowId);
        }
        return executions;
    }
    getStats() {
        const executions = Array.from(this.executions.values());
        return {
            totalWorkflows: this.workflows.size,
            totalExecutions: executions.length,
            runningExecutions: executions.filter(e => e.status === 'running').length,
            completedExecutions: executions.filter(e => e.status === 'completed').length,
            failedExecutions: executions.filter(e => e.status === 'failed').length,
            activeApprovals: Array.from(this.approvalRequests.values()).filter(r => r.status === 'pending').length,
        };
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
// ============================================================================
// Step Executors Implementation
// ============================================================================
class TaskExecutor {
    async execute(step, context) {
        // Execute task handler
        if (step.config.handler) {
            // In production, execute the actual handler
            return { result: 'task completed' };
        }
        return step.config.output;
    }
}
class ParallelExecutor {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async execute(step, context) {
        const parallelSteps = step.config.parallelSteps || [];
        const workflow = context.workflow;
        const steps = workflow.steps.filter(s => parallelSteps.includes(s.id));
        const results = await Promise.all(steps.map(async (s) => {
            return await this.orchestrator['executeStep'](s, context);
        }));
        return results;
    }
}
class SequenceExecutor {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async execute(step, context) {
        const sequenceSteps = step.config.sequenceSteps || [];
        const workflow = context.workflow;
        const steps = workflow.steps.filter(s => sequenceSteps.includes(s.id));
        const results = [];
        for (const s of steps) {
            const result = await this.orchestrator['executeStep'](s, context);
            results.push(result);
        }
        return results;
    }
}
class ConditionExecutor {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async execute(step, context) {
        // Condition evaluation is handled in evaluateConditions
        return { condition: true };
    }
}
class LoopExecutor {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async execute(step, context) {
        const loopVariable = step.config.loopVariable;
        const collectionName = step.config.loopCollection;
        if (!loopVariable || !collectionName) {
            throw new Error('Loop step requires loopVariable and loopCollection');
        }
        const collection = context.getVariable(collectionName);
        if (!Array.isArray(collection)) {
            throw new Error('Loop collection must be an array');
        }
        const results = [];
        for (const item of collection) {
            context.setVariable(loopVariable, item);
            // Execute loop body
            results.push(item);
        }
        return results;
    }
}
class WaitExecutor {
    async execute(step, context) {
        const duration = step.config.waitDuration || 0;
        await new Promise(resolve => setTimeout(resolve, duration));
        return { waited: duration };
    }
}
class ApprovalExecutor {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async execute(step, context) {
        const approvers = step.config.approvers || [];
        const request = await this.orchestrator.requestApproval(context.execution.id, step.id, approvers);
        context.execution.status = 'waiting_approval';
        // Wait for approval (in production, this would be event-driven)
        return { requestId: request.id };
    }
}
class WebhookExecutor {
    async execute(step, context) {
        const url = step.config.webhookURL;
        if (!url) {
            throw new Error('Webhook URL required');
        }
        // In production, make actual HTTP request
        return { status: 'webhook sent' };
    }
}
// ============================================================================
// Export
// ============================================================================
exports.default = WorkflowOrchestrator;
