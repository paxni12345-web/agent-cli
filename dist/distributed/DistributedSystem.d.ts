/**
 * Distributed Computing and Task Scheduling
 * Distributed task execution, job scheduling, load balancing, and cluster management
 */
export interface ClusterNode {
    id: string;
    hostname: string;
    ip: string;
    port: number;
    status: NodeStatus;
    role: NodeRole;
    capabilities: NodeCapabilities;
    resources: NodeResources;
    metrics: NodeMetrics;
    heartbeatAt: Date;
    joinedAt: Date;
}
export declare enum NodeStatus {
    Active = "active",
    Idle = "idle",
    Busy = "busy",
    Offline = "offline",
    Failed = "failed"
}
export declare enum NodeRole {
    Master = "master",
    Worker = "worker",
    Coordinator = "coordinator"
}
export interface NodeCapabilities {
    maxTasks: number;
    supportedTaskTypes: string[];
    cpuCores: number;
    memory: number;
    gpu: boolean;
}
export interface NodeResources {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkUsage: number;
    activeTasks: number;
}
export interface NodeMetrics {
    tasksCompleted: number;
    tasksFailed: number;
    averageTaskDuration: number;
    uptime: number;
    lastTaskAt?: Date;
}
export interface DistributedTask {
    id: string;
    name: string;
    type: string;
    priority: TaskPriority;
    payload: any;
    dependencies: string[];
    status: TaskStatus;
    assignedNode?: string;
    retries: number;
    maxRetries: number;
    timeout: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: any;
    error?: string;
}
export declare enum TaskPriority {
    Critical = 0,
    High = 1,
    Normal = 2,
    Low = 3
}
export declare enum TaskStatus {
    Pending = "pending",
    Queued = "queued",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled"
}
export interface Job {
    id: string;
    name: string;
    description?: string;
    tasks: DistributedTask[];
    schedule?: JobSchedule;
    dependencies: string[];
    status: JobStatus;
    progress: JobProgress;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}
export interface JobSchedule {
    type: 'once' | 'recurring' | 'cron';
    startAt?: Date;
    interval?: number;
    cron?: string;
    endAt?: Date;
}
export declare enum JobStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled",
    Paused = "paused"
}
export interface JobProgress {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    percentage: number;
}
export interface LoadBalancer {
    strategy: LoadBalancingStrategy;
    config: LoadBalancerConfig;
}
export declare enum LoadBalancingStrategy {
    RoundRobin = "round_robin",
    LeastConnections = "least_connections",
    LeastLoad = "least_load",
    Random = "random",
    Weighted = "weighted",
    ConsistentHash = "consistent_hash"
}
export interface LoadBalancerConfig {
    healthCheckInterval?: number;
    maxRetries?: number;
    weights?: Record<string, number>;
}
export interface TaskExecutor {
    type: string;
    execute: (task: DistributedTask, context: ExecutionContext) => Promise<any>;
}
export interface ExecutionContext {
    nodeId: string;
    jobId?: string;
    attempt: number;
    metadata: Record<string, any>;
}
export interface ClusterConfig {
    masterNode?: string;
    heartbeatInterval: number;
    taskTimeout: number;
    maxRetries: number;
    loadBalancer: LoadBalancer;
}
/**
 * Cluster Manager
 */
export declare class ClusterManager {
    private nodes;
    private config;
    private currentNodeId?;
    constructor(config?: Partial<ClusterConfig>);
    /**
     * Register node
     */
    registerNode(node: Omit<ClusterNode, 'id' | 'metrics' | 'heartbeatAt' | 'joinedAt'>): ClusterNode;
    /**
     * Remove node
     */
    removeNode(nodeId: string): void;
    /**
     * Get node
     */
    getNode(nodeId: string): ClusterNode | undefined;
    /**
     * List nodes
     */
    listNodes(filter?: {
        status?: NodeStatus;
        role?: NodeRole;
    }): ClusterNode[];
    /**
     * Get available nodes for task
     */
    getAvailableNodes(taskType: string): ClusterNode[];
    /**
     * Select node for task
     */
    selectNode(task: DistributedTask): ClusterNode | null;
    /**
     * Update node heartbeat
     */
    heartbeat(nodeId: string): void;
    /**
     * Update node status
     */
    updateNodeStatus(nodeId: string, status: NodeStatus): void;
    /**
     * Update node resources
     */
    updateNodeResources(nodeId: string, resources: Partial<NodeResources>): void;
    /**
     * Get cluster statistics
     */
    getClusterStats(): ClusterStats;
    private selectRoundRobin;
    private selectLeastConnections;
    private selectLeastLoad;
    private selectRandom;
    private startHeartbeat;
    private generateNodeId;
}
export interface ClusterStats {
    totalNodes: number;
    activeNodes: number;
    idleNodes: number;
    busyNodes: number;
    offlineNodes: number;
    totalTasks: number;
    totalCPU: number;
    totalMemory: number;
    avgCPUUsage: number;
    avgMemoryUsage: number;
}
/**
 * Task Scheduler
 */
export declare class TaskScheduler {
    private tasks;
    private jobs;
    private executors;
    private queue;
    private clusterManager;
    constructor(clusterManager: ClusterManager);
    /**
     * Register task executor
     */
    registerExecutor(executor: TaskExecutor): void;
    /**
     * Submit task
     */
    submitTask(task: Omit<DistributedTask, 'id' | 'status' | 'retries' | 'createdAt'>): DistributedTask;
    /**
     * Submit job
     */
    submitJob(job: Omit<Job, 'id' | 'status' | 'progress' | 'createdAt'>): Job;
    /**
     * Cancel task
     */
    cancelTask(taskId: string): void;
    /**
     * Cancel job
     */
    cancelJob(jobId: string): void;
    /**
     * Get task
     */
    getTask(taskId: string): DistributedTask | undefined;
    /**
     * Get job
     */
    getJob(jobId: string): Job | undefined;
    /**
     * List tasks
     */
    listTasks(filter?: {
        status?: TaskStatus;
        nodeId?: string;
    }): DistributedTask[];
    /**
     * List jobs
     */
    listJobs(filter?: {
        status?: JobStatus;
    }): Job[];
    /**
     * Enqueue task
     */
    private enqueueTask;
    /**
     * Start scheduler loop
     */
    private startScheduler;
    /**
     * Schedule next task
     */
    private scheduleNextTask;
    /**
     * Execute task
     */
    private executeTask;
    private generateTaskId;
    private generateJobId;
}
/**
 * Distributed Lock Manager
 */
export declare class DistributedLockManager {
    private locks;
    /**
     * Acquire lock
     */
    acquireLock(resource: string, owner: string, ttl?: number): Promise<boolean>;
    /**
     * Release lock
     */
    releaseLock(resource: string, owner: string): boolean;
    /**
     * Check if locked
     */
    isLocked(resource: string): boolean;
    /**
     * Get lock owner
     */
    getLockOwner(resource: string): string | null;
}
export interface Lock {
    resource: string;
    owner: string;
    acquiredAt: Date;
    expiresAt: Date;
}
/**
 * Singleton instances
 */
export declare const clusterManager: ClusterManager;
export declare const taskScheduler: TaskScheduler;
export declare const distributedLockManager: DistributedLockManager;
//# sourceMappingURL=DistributedSystem.d.ts.map