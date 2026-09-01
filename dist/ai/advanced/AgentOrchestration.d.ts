/**
 * AgentOrchestration - Multi-agent coordination and task decomposition
 * Manages complex multi-agent workflows with communication protocols
 */
import { EventEmitter } from 'events';
export interface Agent {
    id: string;
    name: string;
    type: string;
    capabilities: string[];
    status: 'idle' | 'busy' | 'error' | 'offline';
    performance: AgentPerformance;
    config: AgentConfig;
}
export interface AgentPerformance {
    tasksCompleted: number;
    successRate: number;
    avgLatency: number;
    avgQuality: number;
}
export interface AgentConfig {
    maxConcurrency: number;
    timeout: number;
    retries: number;
    priority: number;
}
export interface Task {
    id: string;
    type: string;
    description: string;
    input: any;
    dependencies: string[];
    assignedAgent?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
    startTime?: Date;
    endTime?: Date;
}
export interface WorkflowPlan {
    id: string;
    tasks: Task[];
    dependencies: Map<string, string[]>;
    executionOrder: string[][];
}
export interface Message {
    id: string;
    from: string;
    to: string;
    type: 'request' | 'response' | 'broadcast' | 'heartbeat';
    payload: any;
    timestamp: Date;
}
export interface ConsensusConfig {
    algorithm: 'majority' | 'weighted' | 'unanimous';
    threshold: number;
    timeout: number;
}
export declare class AgentOrchestrator extends EventEmitter {
    private agents;
    private tasks;
    private workflows;
    private messageQueue;
    private consensusConfig;
    constructor(consensusConfig?: Partial<ConsensusConfig>);
    registerAgent(agent: Agent): void;
    decomposeTask(description: string, context: any): Promise<Task[]>;
    private createTask;
    executeWorkflow(tasks: Task[]): Promise<Map<string, any>>;
    private createExecutionPlan;
    private topologicalSort;
    private executeTask;
    private selectAgent;
    private invokeAgent;
    sendMessage(from: string, to: string, type: string, payload: any): Promise<void>;
    private routeMessage;
    achieveConsensus(question: string, agents: string[]): Promise<any>;
    private getAgentResponse;
    private majorityConsensus;
    private weightedConsensus;
    private unanimousConsensus;
    getOrchestrationStats(): any;
}
export default AgentOrchestrator;
//# sourceMappingURL=AgentOrchestration.d.ts.map