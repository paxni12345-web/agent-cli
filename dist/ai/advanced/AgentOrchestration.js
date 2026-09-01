"use strict";
/**
 * AgentOrchestration - Multi-agent coordination and task decomposition
 * Manages complex multi-agent workflows with communication protocols
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const events_1 = require("events");
class AgentOrchestrator extends events_1.EventEmitter {
    agents = new Map();
    tasks = new Map();
    workflows = new Map();
    messageQueue = [];
    consensusConfig;
    constructor(consensusConfig) {
        super();
        this.consensusConfig = {
            algorithm: 'majority',
            threshold: 0.6,
            timeout: 30000,
            ...consensusConfig
        };
    }
    registerAgent(agent) {
        this.agents.set(agent.id, agent);
        this.emit('agent:registered', agent);
    }
    async decomposeTask(description, context) {
        const subtasks = [];
        const keywords = description.toLowerCase();
        if (keywords.includes('analyze') && keywords.includes('code')) {
            subtasks.push(this.createTask('read_files', 'Read and parse source files', context), this.createTask('analyze_structure', 'Analyze code structure', context, ['read_files']), this.createTask('find_issues', 'Identify potential issues', context, ['analyze_structure']), this.createTask('generate_report', 'Generate analysis report', context, ['find_issues']));
        }
        else if (keywords.includes('implement') || keywords.includes('create')) {
            subtasks.push(this.createTask('design', 'Create design specification', context), this.createTask('implement', 'Implement functionality', context, ['design']), this.createTask('test', 'Write and run tests', context, ['implement']), this.createTask('review', 'Code review', context, ['test']));
        }
        else if (keywords.includes('refactor')) {
            subtasks.push(this.createTask('understand', 'Understand current code', context), this.createTask('plan_refactor', 'Plan refactoring steps', context, ['understand']), this.createTask('apply_changes', 'Apply refactoring', context, ['plan_refactor']), this.createTask('verify', 'Verify functionality', context, ['apply_changes']));
        }
        else {
            subtasks.push(this.createTask('execute', description, context));
        }
        subtasks.forEach(task => this.tasks.set(task.id, task));
        return subtasks;
    }
    createTask(type, description, input, dependencies = []) {
        return {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            description,
            input,
            dependencies,
            status: 'pending'
        };
    }
    async executeWorkflow(tasks) {
        const plan = this.createExecutionPlan(tasks);
        this.workflows.set(plan.id, plan);
        const results = new Map();
        for (const batch of plan.executionOrder) {
            const batchPromises = batch.map(taskId => this.executeTask(this.tasks.get(taskId), results));
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((result, idx) => {
                const taskId = batch[idx];
                if (result.status === 'fulfilled') {
                    results.set(taskId, result.value);
                }
                else {
                    const task = this.tasks.get(taskId);
                    task.status = 'failed';
                    task.error = result.reason;
                }
            });
        }
        return results;
    }
    createExecutionPlan(tasks) {
        const plan = {
            id: `workflow_${Date.now()}`,
            tasks,
            dependencies: new Map(),
            executionOrder: []
        };
        tasks.forEach(task => {
            plan.dependencies.set(task.id, task.dependencies);
        });
        plan.executionOrder = this.topologicalSort(tasks);
        return plan;
    }
    topologicalSort(tasks) {
        const levels = [];
        const completed = new Set();
        const remaining = new Set(tasks.map(t => t.id));
        while (remaining.size > 0) {
            const level = [];
            for (const taskId of remaining) {
                const task = tasks.find(t => t.id === taskId);
                const depsMet = task.dependencies.every(dep => completed.has(dep));
                if (depsMet) {
                    level.push(taskId);
                }
            }
            if (level.length === 0 && remaining.size > 0) {
                throw new Error('Circular dependency detected');
            }
            levels.push(level);
            level.forEach(id => {
                completed.add(id);
                remaining.delete(id);
            });
        }
        return levels;
    }
    async executeTask(task, previousResults) {
        task.status = 'running';
        task.startTime = new Date();
        const agent = this.selectAgent(task);
        if (!agent) {
            throw new Error(`No suitable agent found for task ${task.id}`);
        }
        task.assignedAgent = agent.id;
        this.emit('task:started', { task, agent });
        try {
            const depResults = task.dependencies.map(dep => previousResults.get(dep));
            const result = await this.invokeAgent(agent, task, depResults);
            task.status = 'completed';
            task.result = result;
            task.endTime = new Date();
            agent.performance.tasksCompleted++;
            this.emit('task:completed', { task, result });
            return result;
        }
        catch (error) {
            task.status = 'failed';
            task.error = error.message;
            task.endTime = new Date();
            this.emit('task:failed', { task, error });
            throw error;
        }
    }
    selectAgent(task) {
        const availableAgents = Array.from(this.agents.values())
            .filter(a => a.status === 'idle' && a.capabilities.includes(task.type));
        if (availableAgents.length === 0)
            return null;
        return availableAgents.reduce((best, agent) => agent.performance.successRate > best.performance.successRate ? agent : best);
    }
    async invokeAgent(agent, task, deps) {
        agent.status = 'busy';
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        agent.status = 'idle';
        return {
            taskId: task.id,
            agentId: agent.id,
            output: `Completed ${task.type}: ${task.description}`,
            dependencies: deps
        };
    }
    async sendMessage(from, to, type, payload) {
        const message = {
            id: `msg_${Date.now()}`,
            from,
            to,
            type: type,
            payload,
            timestamp: new Date()
        };
        this.messageQueue.push(message);
        this.emit('message:sent', message);
        if (type === 'request') {
            await this.routeMessage(message);
        }
    }
    async routeMessage(message) {
        const recipient = this.agents.get(message.to);
        if (recipient) {
            this.emit('message:delivered', { message, recipient });
        }
    }
    async achieveConsensus(question, agents) {
        const responses = await Promise.all(agents.map(agentId => this.getAgentResponse(agentId, question)));
        switch (this.consensusConfig.algorithm) {
            case 'majority':
                return this.majorityConsensus(responses);
            case 'weighted':
                return this.weightedConsensus(responses);
            case 'unanimous':
                return this.unanimousConsensus(responses);
            default:
                return this.majorityConsensus(responses);
        }
    }
    async getAgentResponse(agentId, question) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return null;
        return {
            agentId,
            response: `Response from ${agent.name}`,
            confidence: 0.7 + Math.random() * 0.3,
            weight: agent.config.priority
        };
    }
    majorityConsensus(responses) {
        const validResponses = responses.filter(r => r !== null);
        if (validResponses.length === 0)
            return null;
        const grouped = new Map();
        validResponses.forEach(r => {
            const key = JSON.stringify(r.response);
            if (!grouped.has(key))
                grouped.set(key, []);
            grouped.get(key).push(r);
        });
        let maxGroup = [];
        for (const group of grouped.values()) {
            if (group.length > maxGroup.length)
                maxGroup = group;
        }
        return maxGroup[0].response;
    }
    weightedConsensus(responses) {
        const validResponses = responses.filter(r => r !== null);
        if (validResponses.length === 0)
            return null;
        const scored = validResponses.map(r => ({
            response: r.response,
            score: r.confidence * r.weight
        }));
        return scored.reduce((best, current) => current.score > best.score ? current : best).response;
    }
    unanimousConsensus(responses) {
        const validResponses = responses.filter(r => r !== null);
        if (validResponses.length === 0)
            return null;
        const first = JSON.stringify(validResponses[0].response);
        const allMatch = validResponses.every(r => JSON.stringify(r.response) === first);
        return allMatch ? validResponses[0].response : null;
    }
    getOrchestrationStats() {
        const tasks = Array.from(this.tasks.values());
        return {
            agents: {
                total: this.agents.size,
                idle: Array.from(this.agents.values()).filter(a => a.status === 'idle').length,
                busy: Array.from(this.agents.values()).filter(a => a.status === 'busy').length
            },
            tasks: {
                total: tasks.length,
                pending: tasks.filter(t => t.status === 'pending').length,
                running: tasks.filter(t => t.status === 'running').length,
                completed: tasks.filter(t => t.status === 'completed').length,
                failed: tasks.filter(t => t.status === 'failed').length
            },
            workflows: this.workflows.size,
            messages: this.messageQueue.length
        };
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
exports.default = AgentOrchestrator;
