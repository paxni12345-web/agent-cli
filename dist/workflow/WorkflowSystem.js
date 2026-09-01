"use strict";
/**
 * Workflow Engine System
 * State machine orchestration, task execution, approval workflows, and process automation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalManager = exports.taskManager = exports.executionEngine = exports.workflowManager = exports.ApprovalManager = exports.TaskManager = exports.ExecutionEngine = exports.WorkflowManager = exports.ParallelStrategy = exports.ScheduleType = exports.ApprovalStatus = exports.ApprovalDecision = exports.ApprovalType = exports.TaskPriority = exports.TaskStatus = exports.TaskType = exports.EventType = exports.ExecutionStatus = exports.PermissionAction = exports.VariableType = exports.ActionType = exports.ConditionOperator = exports.StateType = exports.WorkflowStatus = void 0;
const EventBus_1 = require("../core/EventBus");
var WorkflowStatus;
(function (WorkflowStatus) {
    WorkflowStatus["Draft"] = "draft";
    WorkflowStatus["Active"] = "active";
    WorkflowStatus["Inactive"] = "inactive";
    WorkflowStatus["Deprecated"] = "deprecated";
})(WorkflowStatus || (exports.WorkflowStatus = WorkflowStatus = {}));
var StateType;
(function (StateType) {
    StateType["Task"] = "task";
    StateType["Decision"] = "decision";
    StateType["Parallel"] = "parallel";
    StateType["Wait"] = "wait";
    StateType["Success"] = "success";
    StateType["Fail"] = "fail";
    StateType["Choice"] = "choice";
})(StateType || (exports.StateType = StateType = {}));
var ConditionOperator;
(function (ConditionOperator) {
    ConditionOperator["Equals"] = "equals";
    ConditionOperator["NotEquals"] = "not_equals";
    ConditionOperator["GreaterThan"] = "greater_than";
    ConditionOperator["LessThan"] = "less_than";
    ConditionOperator["Contains"] = "contains";
    ConditionOperator["Exists"] = "exists";
})(ConditionOperator || (exports.ConditionOperator = ConditionOperator = {}));
var ActionType;
(function (ActionType) {
    ActionType["ExecuteTask"] = "execute_task";
    ActionType["SendNotification"] = "send_notification";
    ActionType["UpdateVariable"] = "update_variable";
    ActionType["InvokeAPI"] = "invoke_api";
    ActionType["WaitForEvent"] = "wait_for_event";
    ActionType["LogMessage"] = "log_message";
})(ActionType || (exports.ActionType = ActionType = {}));
var VariableType;
(function (VariableType) {
    VariableType["String"] = "string";
    VariableType["Number"] = "number";
    VariableType["Boolean"] = "boolean";
    VariableType["Object"] = "object";
    VariableType["Array"] = "array";
})(VariableType || (exports.VariableType = VariableType = {}));
var PermissionAction;
(function (PermissionAction) {
    PermissionAction["View"] = "view";
    PermissionAction["Execute"] = "execute";
    PermissionAction["Edit"] = "edit";
    PermissionAction["Delete"] = "delete";
})(PermissionAction || (exports.PermissionAction = PermissionAction = {}));
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["Running"] = "running";
    ExecutionStatus["Succeeded"] = "succeeded";
    ExecutionStatus["Failed"] = "failed";
    ExecutionStatus["TimedOut"] = "timed_out";
    ExecutionStatus["Aborted"] = "aborted";
    ExecutionStatus["Paused"] = "paused";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
var EventType;
(function (EventType) {
    EventType["StateEntered"] = "state_entered";
    EventType["StateExited"] = "state_exited";
    EventType["TransitionTaken"] = "transition_taken";
    EventType["ActionExecuted"] = "action_executed";
    EventType["ErrorOccurred"] = "error_occurred";
    EventType["ExecutionStarted"] = "execution_started";
    EventType["ExecutionCompleted"] = "execution_completed";
})(EventType || (exports.EventType = EventType = {}));
var TaskType;
(function (TaskType) {
    TaskType["Manual"] = "manual";
    TaskType["Automated"] = "automated";
    TaskType["Approval"] = "approval";
    TaskType["Review"] = "review";
    TaskType["Notification"] = "notification";
})(TaskType || (exports.TaskType = TaskType = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["Pending"] = "pending";
    TaskStatus["InProgress"] = "in_progress";
    TaskStatus["Completed"] = "completed";
    TaskStatus["Failed"] = "failed";
    TaskStatus["Cancelled"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["Low"] = "low";
    TaskPriority["Medium"] = "medium";
    TaskPriority["High"] = "high";
    TaskPriority["Critical"] = "critical";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var ApprovalType;
(function (ApprovalType) {
    ApprovalType["AllRequired"] = "all_required";
    ApprovalType["AnyRequired"] = "any_required";
    ApprovalType["MajorityRequired"] = "majority_required";
    ApprovalType["SingleRequired"] = "single_required";
})(ApprovalType || (exports.ApprovalType = ApprovalType = {}));
var ApprovalDecision;
(function (ApprovalDecision) {
    ApprovalDecision["Approved"] = "approved";
    ApprovalDecision["Rejected"] = "rejected";
    ApprovalDecision["Delegated"] = "delegated";
})(ApprovalDecision || (exports.ApprovalDecision = ApprovalDecision = {}));
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["Pending"] = "pending";
    ApprovalStatus["Approved"] = "approved";
    ApprovalStatus["Rejected"] = "rejected";
    ApprovalStatus["Expired"] = "expired";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
var ScheduleType;
(function (ScheduleType) {
    ScheduleType["Cron"] = "cron";
    ScheduleType["Interval"] = "interval";
    ScheduleType["Once"] = "once";
    ScheduleType["Event"] = "event";
})(ScheduleType || (exports.ScheduleType = ScheduleType = {}));
var ParallelStrategy;
(function (ParallelStrategy) {
    ParallelStrategy["WaitForAll"] = "wait_for_all";
    ParallelStrategy["WaitForAny"] = "wait_for_any";
    ParallelStrategy["WaitForN"] = "wait_for_n";
})(ParallelStrategy || (exports.ParallelStrategy = ParallelStrategy = {}));
/**
 * Workflow Manager
 */
class WorkflowManager {
    workflows = new Map();
    templates = new Map();
    /**
     * Create workflow
     */
    createWorkflow(config) {
        const workflow = {
            ...config,
            id: this.generateWorkflowId(),
            version: 1,
            status: WorkflowStatus.Draft,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.workflows.set(workflow.id, workflow);
        EventBus_1.eventBus.emitSync('workflow.created', workflow, 'WorkflowManager');
        return workflow;
    }
    /**
     * Update workflow
     */
    updateWorkflow(workflowId, updates) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        Object.assign(workflow, updates);
        workflow.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('workflow.updated', workflow, 'WorkflowManager');
        return workflow;
    }
    /**
     * Publish workflow
     */
    publishWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        workflow.status = WorkflowStatus.Active;
        workflow.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('workflow.published', workflow, 'WorkflowManager');
        return workflow;
    }
    /**
     * Create new version
     */
    createVersion(workflowId, changes) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        const newVersion = {
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
        EventBus_1.eventBus.emitSync('workflow.version_created', newVersion, 'WorkflowManager');
        return newVersion;
    }
    /**
     * Get workflow
     */
    getWorkflow(workflowId) {
        return this.workflows.get(workflowId);
    }
    /**
     * List workflows
     */
    listWorkflows(filter) {
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
    createTemplate(config) {
        const template = {
            ...config,
            id: this.generateTemplateId(),
            createdAt: new Date(),
        };
        this.templates.set(template.id, template);
        EventBus_1.eventBus.emitSync('workflow.template_created', template, 'WorkflowManager');
        return template;
    }
    /**
     * Get template
     */
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    /**
     * List templates
     */
    listTemplates(category) {
        let templates = Array.from(this.templates.values());
        if (category) {
            templates = templates.filter(t => t.category === category);
        }
        return templates;
    }
    generateWorkflowId() {
        return `workflow_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateTemplateId() {
        return `template_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.WorkflowManager = WorkflowManager;
/**
 * Execution Engine
 */
class ExecutionEngine {
    executions = new Map();
    workflowManager;
    constructor(workflowManager) {
        this.workflowManager = workflowManager;
    }
    /**
     * Start workflow execution
     */
    async startExecution(workflowId, input) {
        const workflow = this.workflowManager.getWorkflow(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        if (workflow.status !== WorkflowStatus.Active) {
            throw new Error(`Workflow is not active: ${workflowId}`);
        }
        const execution = {
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
        EventBus_1.eventBus.emitSync('workflow.execution_started', execution, 'ExecutionEngine');
        // Start execution
        await this.executeState(execution, workflow);
        return execution;
    }
    /**
     * Execute state
     */
    async executeState(execution, workflow) {
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
            }
            else {
                await this.completeExecution(execution, true);
            }
        }
        catch (error) {
            await this.handleError(execution, state, error);
        }
    }
    /**
     * Execute task
     */
    async executeTask(execution, state) {
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
    async executeWait(execution, state) {
        const waitTime = state.timeout || 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    /**
     * Execute action
     */
    async executeAction(execution, action) {
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
    determineNextState(execution, workflow) {
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
    evaluateCondition(execution, condition) {
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
    async handleError(execution, state, error) {
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
    async completeExecution(execution, success) {
        execution.status = success ? ExecutionStatus.Succeeded : ExecutionStatus.Failed;
        execution.completedAt = new Date();
        execution.history.push({
            timestamp: new Date(),
            type: EventType.ExecutionCompleted,
            stateId: execution.currentState,
            stateName: execution.currentState,
            details: { success },
        });
        EventBus_1.eventBus.emitSync('workflow.execution_completed', execution, 'ExecutionEngine');
    }
    /**
     * Get execution
     */
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    /**
     * List executions
     */
    listExecutions(filter) {
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
    abortExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (execution && execution.status === ExecutionStatus.Running) {
            execution.status = ExecutionStatus.Aborted;
            execution.completedAt = new Date();
            EventBus_1.eventBus.emitSync('workflow.execution_aborted', execution, 'ExecutionEngine');
        }
    }
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ExecutionEngine = ExecutionEngine;
/**
 * Task Manager
 */
class TaskManager {
    tasks = new Map();
    /**
     * Create task
     */
    createTask(config) {
        const task = {
            ...config,
            id: this.generateTaskId(),
            status: TaskStatus.Pending,
            createdAt: new Date(),
        };
        this.tasks.set(task.id, task);
        EventBus_1.eventBus.emitSync('workflow.task_created', task, 'TaskManager');
        return task;
    }
    /**
     * Complete task
     */
    completeTask(taskId, output) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = TaskStatus.Completed;
            task.output = output;
            task.completedAt = new Date();
            EventBus_1.eventBus.emitSync('workflow.task_completed', task, 'TaskManager');
        }
    }
    /**
     * Assign task
     */
    assignTask(taskId, assignee) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.assignee = assignee;
            task.status = TaskStatus.InProgress;
            EventBus_1.eventBus.emitSync('workflow.task_assigned', task, 'TaskManager');
        }
    }
    /**
     * Get task
     */
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    /**
     * List tasks
     */
    listTasks(filter) {
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
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TaskManager = TaskManager;
/**
 * Approval Manager
 */
class ApprovalManager {
    approvals = new Map();
    /**
     * Create approval request
     */
    createApprovalRequest(config) {
        const approval = {
            ...config,
            id: this.generateApprovalId(),
            responses: [],
            status: ApprovalStatus.Pending,
            createdAt: new Date(),
        };
        this.approvals.set(approval.id, approval);
        EventBus_1.eventBus.emitSync('workflow.approval_created', approval, 'ApprovalManager');
        return approval;
    }
    /**
     * Submit approval response
     */
    submitResponse(approvalId, approver, decision, comment) {
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
            EventBus_1.eventBus.emitSync('workflow.approval_resolved', approval, 'ApprovalManager');
        }
    }
    /**
     * Get approval request
     */
    getApprovalRequest(approvalId) {
        return this.approvals.get(approvalId);
    }
    /**
     * List approval requests
     */
    listApprovalRequests(filter) {
        let approvals = Array.from(this.approvals.values());
        if (filter?.status) {
            approvals = approvals.filter(a => a.status === filter.status);
        }
        if (filter?.approver) {
            approvals = approvals.filter(a => a.approvers.includes(filter.approver));
        }
        return approvals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    evaluateApprovalStatus(approval) {
        const approvedCount = approval.responses.filter(r => r.decision === ApprovalDecision.Approved).length;
        const rejectedCount = approval.responses.filter(r => r.decision === ApprovalDecision.Rejected).length;
        switch (approval.approvalType) {
            case ApprovalType.AllRequired:
                if (rejectedCount > 0)
                    return ApprovalStatus.Rejected;
                if (approvedCount === approval.approvers.length)
                    return ApprovalStatus.Approved;
                break;
            case ApprovalType.AnyRequired:
                if (approvedCount > 0)
                    return ApprovalStatus.Approved;
                if (rejectedCount === approval.approvers.length)
                    return ApprovalStatus.Rejected;
                break;
            case ApprovalType.MajorityRequired:
                const required = Math.ceil(approval.approvers.length / 2);
                if (approvedCount >= required)
                    return ApprovalStatus.Approved;
                if (rejectedCount >= required)
                    return ApprovalStatus.Rejected;
                break;
            case ApprovalType.SingleRequired:
                if (approvedCount > 0)
                    return ApprovalStatus.Approved;
                if (rejectedCount > 0)
                    return ApprovalStatus.Rejected;
                break;
        }
        return ApprovalStatus.Pending;
    }
    generateApprovalId() {
        return `approval_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ApprovalManager = ApprovalManager;
/**
 * Singleton instances
 */
exports.workflowManager = new WorkflowManager();
exports.executionEngine = new ExecutionEngine(exports.workflowManager);
exports.taskManager = new TaskManager();
exports.approvalManager = new ApprovalManager();
