/**
 * MEGA AI AGENT ORCHESTRATION SYSTEM
 * Multi-agent coordination, task distribution, and collaborative AI workflows
 * Lines: 1200+
 */
import { EventEmitter } from 'events';
export interface Agent {
    id: string;
    name: string;
    type: AgentType;
    capabilities: AgentCapability[];
    status: AgentStatus;
    metadata: AgentMetadata;
    config: AgentConfig;
}
export type AgentType = 'planner' | 'executor' | 'analyzer' | 'critic' | 'specialist' | 'coordinator' | 'learner' | 'monitor';
export interface AgentCapability {
    name: string;
    description: string;
    parameters: Record<string, any>;
    constraints: CapabilityConstraint[];
}
export interface CapabilityConstraint {
    type: 'resource' | 'time' | 'dependency' | 'permission';
    value: any;
}
export type AgentStatus = 'idle' | 'active' | 'busy' | 'waiting' | 'error' | 'offline';
export interface AgentMetadata {
    created: Date;
    lastActive: Date;
    totalTasks: number;
    successRate: number;
    averageResponseTime: number;
}
export interface AgentConfig {
    maxConcurrentTasks: number;
    timeout: number;
    retryAttempts: number;
    priority: number;
    resources: ResourceAllocation;
}
export interface ResourceAllocation {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
}
export interface Task {
    id: string;
    type: TaskType;
    description: string;
    requirements: TaskRequirement[];
    priority: TaskPriority;
    deadline?: Date;
    dependencies: string[];
    status: TaskStatus;
    assignedAgent?: string;
    result?: TaskResult;
}
export type TaskType = 'planning' | 'execution' | 'analysis' | 'synthesis' | 'validation' | 'optimization';
export interface TaskRequirement {
    capability: string;
    level: 'basic' | 'intermediate' | 'advanced' | 'expert';
    mandatory: boolean;
}
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export interface TaskResult {
    success: boolean;
    output: any;
    metrics: TaskMetrics;
    errors?: Error[];
}
export interface TaskMetrics {
    startTime: Date;
    endTime: Date;
    duration: number;
    resourcesUsed: ResourceAllocation;
    quality: number;
}
export interface OrchestrationStrategy {
    name: string;
    description: string;
    assignTask(task: Task, agents: Agent[]): Agent | null;
    balanceLoad(agents: Agent[]): void;
    handleFailure(task: Task, agent: Agent): void;
}
export declare class RoundRobinStrategy implements OrchestrationStrategy {
    name: string;
    description: string;
    private currentIndex;
    assignTask(task: Task, agents: Agent[]): Agent | null;
    balanceLoad(agents: Agent[]): void;
    handleFailure(task: Task, agent: Agent): void;
}
export declare class CapabilityBasedStrategy implements OrchestrationStrategy {
    name: string;
    description: string;
    assignTask(task: Task, agents: Agent[]): Agent | null;
    private calculateCapabilityScore;
    balanceLoad(agents: Agent[]): void;
    handleFailure(task: Task, agent: Agent): void;
}
export declare class LoadBalancingStrategy implements OrchestrationStrategy {
    name: string;
    description: string;
    assignTask(task: Task, agents: Agent[]): Agent | null;
    private getAgentLoad;
    balanceLoad(agents: Agent[]): void;
    handleFailure(task: Task, agent: Agent): void;
}
export interface Message {
    id: string;
    from: string;
    to: string;
    type: MessageType;
    content: any;
    timestamp: Date;
    priority: number;
}
export type MessageType = 'task_assignment' | 'task_result' | 'status_update' | 'request' | 'response' | 'notification' | 'coordination';
export declare class MessageBus extends EventEmitter {
    private messages;
    send(message: Message): void;
    receive(agentId: string): Message[];
    broadcast(message: Omit<Message, 'to'>): void;
}
export declare class CoordinationProtocol {
    private messageBus;
    constructor(messageBus: MessageBus);
    requestConsensus(agents: Agent[], decision: any): Promise<boolean>;
    negotiateTask(task: Task, agents: Agent[]): Promise<Agent | null>;
    private generateId;
}
export declare class CollaborationManager {
    hierarchicalDecomposition(task: Task, agents: Agent[]): Promise<Task[]>;
    peerReview(result: TaskResult, reviewers: Agent[]): Promise<ReviewResult>;
    private conductReview;
    private generateRecommendations;
    ensembleDecision(agents: Agent[], options: any[]): Promise<any>;
    private getAgentChoice;
}
interface Review {
    reviewerId: string;
    score: number;
    comments: string[];
    timestamp: Date;
}
interface ReviewResult {
    approved: boolean;
    averageScore: number;
    reviews: Review[];
    recommendations: string[];
}
export declare class AgentOrchestrator extends EventEmitter {
    private agents;
    private tasks;
    private messageBus;
    private strategy;
    private collaborationManager;
    private protocol;
    constructor(strategy?: OrchestrationStrategy);
    registerAgent(agent: Agent): void;
    unregisterAgent(agentId: string): void;
    getAgent(agentId: string): Agent | undefined;
    getAllAgents(): Agent[];
    submitTask(task: Task): Promise<string>;
    private assignTask;
    executeTask(taskId: string): Promise<TaskResult>;
    private performTask;
    orchestrateWorkflow(tasks: Task[]): Promise<Map<string, TaskResult>>;
    private buildDependencyGraph;
    private topologicalSort;
    balanceLoad(): Promise<void>;
    getStatistics(): OrchestrationStats;
    private calculateAverageResponseTime;
    private calculateSuccessRate;
    private getPriorityNumber;
    private generateId;
}
interface OrchestrationStats {
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageResponseTime: number;
    successRate: number;
}
export default AgentOrchestrator;
//# sourceMappingURL=MEGA_AIAgentOrchestration.d.ts.map