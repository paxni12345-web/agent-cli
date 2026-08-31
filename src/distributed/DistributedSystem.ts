/**
 * Distributed Computing and Task Scheduling
 * Distributed task execution, job scheduling, load balancing, and cluster management
 */

import { eventBus } from '../core/EventBus';

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

export enum NodeStatus {
  Active = 'active',
  Idle = 'idle',
  Busy = 'busy',
  Offline = 'offline',
  Failed = 'failed',
}

export enum NodeRole {
  Master = 'master',
  Worker = 'worker',
  Coordinator = 'coordinator',
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

export enum TaskPriority {
  Critical = 0,
  High = 1,
  Normal = 2,
  Low = 3,
}

export enum TaskStatus {
  Pending = 'pending',
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
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

export enum JobStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Paused = 'paused',
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

export enum LoadBalancingStrategy {
  RoundRobin = 'round_robin',
  LeastConnections = 'least_connections',
  LeastLoad = 'least_load',
  Random = 'random',
  Weighted = 'weighted',
  ConsistentHash = 'consistent_hash',
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
export class ClusterManager {
  private nodes: Map<string, ClusterNode> = new Map();
  private config: ClusterConfig;
  private currentNodeId?: string;

  constructor(config?: Partial<ClusterConfig>) {
    this.config = {
      heartbeatInterval: 5000,
      taskTimeout: 300000,
      maxRetries: 3,
      loadBalancer: {
        strategy: LoadBalancingStrategy.LeastLoad,
        config: {},
      },
      ...config,
    };

    this.startHeartbeat();
  }

  /**
   * Register node
   */
  registerNode(node: Omit<ClusterNode, 'id' | 'metrics' | 'heartbeatAt' | 'joinedAt'>): ClusterNode {
    const fullNode: ClusterNode = {
      ...node,
      id: this.generateNodeId(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageTaskDuration: 0,
        uptime: 0,
      },
      heartbeatAt: new Date(),
      joinedAt: new Date(),
    };

    this.nodes.set(fullNode.id, fullNode);

    eventBus.emitSync('cluster.node_joined', fullNode, 'ClusterManager');

    return fullNode;
  }

  /**
   * Remove node
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    eventBus.emitSync('cluster.node_left', { nodeId }, 'ClusterManager');
  }

  /**
   * Get node
   */
  getNode(nodeId: string): ClusterNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * List nodes
   */
  listNodes(filter?: { status?: NodeStatus; role?: NodeRole }): ClusterNode[] {
    let nodes = Array.from(this.nodes.values());

    if (filter?.status) {
      nodes = nodes.filter(n => n.status === filter.status);
    }

    if (filter?.role) {
      nodes = nodes.filter(n => n.role === filter.role);
    }

    return nodes;
  }

  /**
   * Get available nodes for task
   */
  getAvailableNodes(taskType: string): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(
      node =>
        node.status === NodeStatus.Active &&
        node.capabilities.supportedTaskTypes.includes(taskType) &&
        node.resources.activeTasks < node.capabilities.maxTasks
    );
  }

  /**
   * Select node for task
   */
  selectNode(task: DistributedTask): ClusterNode | null {
    const availableNodes = this.getAvailableNodes(task.type);

    if (availableNodes.length === 0) {
      return null;
    }

    switch (this.config.loadBalancer.strategy) {
      case LoadBalancingStrategy.RoundRobin:
        return this.selectRoundRobin(availableNodes);

      case LoadBalancingStrategy.LeastConnections:
        return this.selectLeastConnections(availableNodes);

      case LoadBalancingStrategy.LeastLoad:
        return this.selectLeastLoad(availableNodes);

      case LoadBalancingStrategy.Random:
        return this.selectRandom(availableNodes);

      default:
        return availableNodes[0];
    }
  }

  /**
   * Update node heartbeat
   */
  heartbeat(nodeId: string): void {
    const node = this.nodes.get(nodeId);

    if (node) {
      node.heartbeatAt = new Date();
    }
  }

  /**
   * Update node status
   */
  updateNodeStatus(nodeId: string, status: NodeStatus): void {
    const node = this.nodes.get(nodeId);

    if (node) {
      node.status = status;
      eventBus.emitSync('cluster.node_status_changed', { nodeId, status }, 'ClusterManager');
    }
  }

  /**
   * Update node resources
   */
  updateNodeResources(nodeId: string, resources: Partial<NodeResources>): void {
    const node = this.nodes.get(nodeId);

    if (node) {
      Object.assign(node.resources, resources);
    }
  }

  /**
   * Get cluster statistics
   */
  getClusterStats(): ClusterStats {
    const nodes = Array.from(this.nodes.values());

    return {
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => n.status === NodeStatus.Active).length,
      idleNodes: nodes.filter(n => n.status === NodeStatus.Idle).length,
      busyNodes: nodes.filter(n => n.status === NodeStatus.Busy).length,
      offlineNodes: nodes.filter(n => n.status === NodeStatus.Offline).length,
      totalTasks: nodes.reduce((sum, n) => sum + n.resources.activeTasks, 0),
      totalCPU: nodes.reduce((sum, n) => sum + n.capabilities.cpuCores, 0),
      totalMemory: nodes.reduce((sum, n) => sum + n.capabilities.memory, 0),
      avgCPUUsage: nodes.reduce((sum, n) => sum + n.resources.cpuUsage, 0) / nodes.length,
      avgMemoryUsage: nodes.reduce((sum, n) => sum + n.resources.memoryUsage, 0) / nodes.length,
    };
  }

  private selectRoundRobin(nodes: ClusterNode[]): ClusterNode {
    // Simple round-robin
    return nodes[0];
  }

  private selectLeastConnections(nodes: ClusterNode[]): ClusterNode {
    return nodes.reduce((min, node) =>
      node.resources.activeTasks < min.resources.activeTasks ? node : min
    );
  }

  private selectLeastLoad(nodes: ClusterNode[]): ClusterNode {
    return nodes.reduce((min, node) => {
      const nodeLoad = (node.resources.cpuUsage + node.resources.memoryUsage) / 2;
      const minLoad = (min.resources.cpuUsage + min.resources.memoryUsage) / 2;

      return nodeLoad < minLoad ? node : min;
    });
  }

  private selectRandom(nodes: ClusterNode[]): ClusterNode {
    return nodes[Math.floor(Math.random() * nodes.length)];
  }

  private startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();

      for (const node of this.nodes.values()) {
        const timeSinceHeartbeat = now - node.heartbeatAt.getTime();

        if (timeSinceHeartbeat > this.config.heartbeatInterval * 3) {
          if (node.status !== NodeStatus.Offline) {
            node.status = NodeStatus.Offline;
            eventBus.emitSync('cluster.node_timeout', { nodeId: node.id }, 'ClusterManager');
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
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
export class TaskScheduler {
  private tasks: Map<string, DistributedTask> = new Map();
  private jobs: Map<string, Job> = new Map();
  private executors: Map<string, TaskExecutor> = new Map();
  private queue: DistributedTask[] = [];
  private clusterManager: ClusterManager;

  constructor(clusterManager: ClusterManager) {
    this.clusterManager = clusterManager;
    this.startScheduler();
  }

  /**
   * Register task executor
   */
  registerExecutor(executor: TaskExecutor): void {
    this.executors.set(executor.type, executor);
  }

  /**
   * Submit task
   */
  submitTask(task: Omit<DistributedTask, 'id' | 'status' | 'retries' | 'createdAt'>): DistributedTask {
    const fullTask: DistributedTask = {
      ...task,
      id: this.generateTaskId(),
      status: TaskStatus.Pending,
      retries: 0,
      createdAt: new Date(),
    };

    this.tasks.set(fullTask.id, fullTask);
    this.enqueueTask(fullTask);

    eventBus.emitSync('task.submitted', fullTask, 'TaskScheduler');

    return fullTask;
  }

  /**
   * Submit job
   */
  submitJob(job: Omit<Job, 'id' | 'status' | 'progress' | 'createdAt'>): Job {
    const fullJob: Job = {
      ...job,
      id: this.generateJobId(),
      status: JobStatus.Pending,
      progress: {
        totalTasks: job.tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        percentage: 0,
      },
      createdAt: new Date(),
    };

    this.jobs.set(fullJob.id, fullJob);

    // Submit tasks
    for (const task of fullJob.tasks) {
      this.submitTask({ ...task, maxRetries: 3, timeout: 300000 });
    }

    eventBus.emitSync('job.submitted', fullJob, 'TaskScheduler');

    return fullJob;
  }

  /**
   * Cancel task
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);

    if (task) {
      task.status = TaskStatus.Cancelled;
      this.queue = this.queue.filter(t => t.id !== taskId);

      eventBus.emitSync('task.cancelled', task, 'TaskScheduler');
    }
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);

    if (job) {
      job.status = JobStatus.Cancelled;

      // Cancel all tasks
      for (const task of job.tasks) {
        this.cancelTask(task.id);
      }

      eventBus.emitSync('job.cancelled', job, 'TaskScheduler');
    }
  }

  /**
   * Get task
   */
  getTask(taskId: string): DistributedTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get job
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List tasks
   */
  listTasks(filter?: { status?: TaskStatus; nodeId?: string }): DistributedTask[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter?.nodeId) {
      tasks = tasks.filter(t => t.assignedNode === filter.nodeId);
    }

    return tasks;
  }

  /**
   * List jobs
   */
  listJobs(filter?: { status?: JobStatus }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter(j => j.status === filter.status);
    }

    return jobs;
  }

  /**
   * Enqueue task
   */
  private enqueueTask(task: DistributedTask): void {
    task.status = TaskStatus.Queued;

    // Insert based on priority
    const index = this.queue.findIndex(t => t.priority > task.priority);

    if (index === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(index, 0, task);
    }
  }

  /**
   * Start scheduler loop
   */
  private startScheduler(): void {
    setInterval(() => {
      this.scheduleNextTask();
    }, 1000);
  }

  /**
   * Schedule next task
   */
  private async scheduleNextTask(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const task = this.queue[0];

    // Check dependencies
    const dependenciesMet = task.dependencies.every(depId => {
      const dep = this.tasks.get(depId);
      return dep && dep.status === TaskStatus.Completed;
    });

    if (!dependenciesMet) {
      return;
    }

    // Select node
    const node = this.clusterManager.selectNode(task);

    if (!node) {
      return;
    }

    // Dequeue and assign
    this.queue.shift();
    task.status = TaskStatus.Running;
    task.assignedNode = node.id;
    task.startedAt = new Date();

    // Update node resources
    this.clusterManager.updateNodeResources(node.id, {
      activeTasks: node.resources.activeTasks + 1,
    });

    eventBus.emitSync('task.started', { task, nodeId: node.id }, 'TaskScheduler');

    // Execute task
    this.executeTask(task, node);
  }

  /**
   * Execute task
   */
  private async executeTask(task: DistributedTask, node: ClusterNode): Promise<void> {
    const executor = this.executors.get(task.type);

    if (!executor) {
      task.status = TaskStatus.Failed;
      task.error = `No executor found for task type: ${task.type}`;
      task.completedAt = new Date();

      eventBus.emitSync('task.failed', task, 'TaskScheduler');

      return;
    }

    const context: ExecutionContext = {
      nodeId: node.id,
      attempt: task.retries + 1,
      metadata: {},
    };

    try {
      const result = await Promise.race([
        executor.execute(task, context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), task.timeout)
        ),
      ]);

      task.status = TaskStatus.Completed;
      task.result = result;
      task.completedAt = new Date();

      // Update node metrics
      node.metrics.tasksCompleted++;
      node.metrics.lastTaskAt = new Date();

      eventBus.emitSync('task.completed', task, 'TaskScheduler');
    } catch (error) {
      task.retries++;

      if (task.retries < task.maxRetries) {
        // Retry
        task.status = TaskStatus.Queued;
        task.assignedNode = undefined;
        this.enqueueTask(task);

        eventBus.emitSync('task.retrying', task, 'TaskScheduler');
      } else {
        task.status = TaskStatus.Failed;
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();

        // Update node metrics
        node.metrics.tasksFailed++;

        eventBus.emitSync('task.failed', task, 'TaskScheduler');
      }
    } finally {
      // Update node resources
      this.clusterManager.updateNodeResources(node.id, {
        activeTasks: node.resources.activeTasks - 1,
      });
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Distributed Lock Manager
 */
export class DistributedLockManager {
  private locks: Map<string, Lock> = new Map();

  /**
   * Acquire lock
   */
  async acquireLock(resource: string, owner: string, ttl: number = 30000): Promise<boolean> {
    const lock = this.locks.get(resource);

    if (lock) {
      // Check if expired
      if (Date.now() < lock.expiresAt.getTime()) {
        return false;
      }
    }

    // Acquire lock
    this.locks.set(resource, {
      resource,
      owner,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + ttl),
    });

    eventBus.emitSync('lock.acquired', { resource, owner }, 'DistributedLockManager');

    return true;
  }

  /**
   * Release lock
   */
  releaseLock(resource: string, owner: string): boolean {
    const lock = this.locks.get(resource);

    if (!lock || lock.owner !== owner) {
      return false;
    }

    this.locks.delete(resource);

    eventBus.emitSync('lock.released', { resource, owner }, 'DistributedLockManager');

    return true;
  }

  /**
   * Check if locked
   */
  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource);

    if (!lock) {
      return false;
    }

    if (Date.now() >= lock.expiresAt.getTime()) {
      this.locks.delete(resource);
      return false;
    }

    return true;
  }

  /**
   * Get lock owner
   */
  getLockOwner(resource: string): string | null {
    const lock = this.locks.get(resource);

    if (!lock || Date.now() >= lock.expiresAt.getTime()) {
      return null;
    }

    return lock.owner;
  }
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
export const clusterManager = new ClusterManager();
export const taskScheduler = new TaskScheduler(clusterManager);
export const distributedLockManager = new DistributedLockManager();
