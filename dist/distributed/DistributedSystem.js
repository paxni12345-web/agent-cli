"use strict";
/**
 * Distributed Computing and Task Scheduling
 * Distributed task execution, job scheduling, load balancing, and cluster management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributedLockManager = exports.taskScheduler = exports.clusterManager = exports.DistributedLockManager = exports.TaskScheduler = exports.ClusterManager = exports.LoadBalancingStrategy = exports.JobStatus = exports.TaskStatus = exports.TaskPriority = exports.NodeRole = exports.NodeStatus = void 0;
const EventBus_1 = require("../core/EventBus");
var NodeStatus;
(function (NodeStatus) {
    NodeStatus["Active"] = "active";
    NodeStatus["Idle"] = "idle";
    NodeStatus["Busy"] = "busy";
    NodeStatus["Offline"] = "offline";
    NodeStatus["Failed"] = "failed";
})(NodeStatus || (exports.NodeStatus = NodeStatus = {}));
var NodeRole;
(function (NodeRole) {
    NodeRole["Master"] = "master";
    NodeRole["Worker"] = "worker";
    NodeRole["Coordinator"] = "coordinator";
})(NodeRole || (exports.NodeRole = NodeRole = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["Critical"] = 0] = "Critical";
    TaskPriority[TaskPriority["High"] = 1] = "High";
    TaskPriority[TaskPriority["Normal"] = 2] = "Normal";
    TaskPriority[TaskPriority["Low"] = 3] = "Low";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["Pending"] = "pending";
    TaskStatus["Queued"] = "queued";
    TaskStatus["Running"] = "running";
    TaskStatus["Completed"] = "completed";
    TaskStatus["Failed"] = "failed";
    TaskStatus["Cancelled"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var JobStatus;
(function (JobStatus) {
    JobStatus["Pending"] = "pending";
    JobStatus["Running"] = "running";
    JobStatus["Completed"] = "completed";
    JobStatus["Failed"] = "failed";
    JobStatus["Cancelled"] = "cancelled";
    JobStatus["Paused"] = "paused";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var LoadBalancingStrategy;
(function (LoadBalancingStrategy) {
    LoadBalancingStrategy["RoundRobin"] = "round_robin";
    LoadBalancingStrategy["LeastConnections"] = "least_connections";
    LoadBalancingStrategy["LeastLoad"] = "least_load";
    LoadBalancingStrategy["Random"] = "random";
    LoadBalancingStrategy["Weighted"] = "weighted";
    LoadBalancingStrategy["ConsistentHash"] = "consistent_hash";
})(LoadBalancingStrategy || (exports.LoadBalancingStrategy = LoadBalancingStrategy = {}));
/**
 * Cluster Manager
 */
class ClusterManager {
    nodes = new Map();
    config;
    currentNodeId;
    constructor(config) {
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
    registerNode(node) {
        const fullNode = {
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
        EventBus_1.eventBus.emitSync('cluster.node_joined', fullNode, 'ClusterManager');
        return fullNode;
    }
    /**
     * Remove node
     */
    removeNode(nodeId) {
        this.nodes.delete(nodeId);
        EventBus_1.eventBus.emitSync('cluster.node_left', { nodeId }, 'ClusterManager');
    }
    /**
     * Get node
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    /**
     * List nodes
     */
    listNodes(filter) {
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
    getAvailableNodes(taskType) {
        return Array.from(this.nodes.values()).filter(node => node.status === NodeStatus.Active &&
            node.capabilities.supportedTaskTypes.includes(taskType) &&
            node.resources.activeTasks < node.capabilities.maxTasks);
    }
    /**
     * Select node for task
     */
    selectNode(task) {
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
    heartbeat(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.heartbeatAt = new Date();
        }
    }
    /**
     * Update node status
     */
    updateNodeStatus(nodeId, status) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.status = status;
            EventBus_1.eventBus.emitSync('cluster.node_status_changed', { nodeId, status }, 'ClusterManager');
        }
    }
    /**
     * Update node resources
     */
    updateNodeResources(nodeId, resources) {
        const node = this.nodes.get(nodeId);
        if (node) {
            Object.assign(node.resources, resources);
        }
    }
    /**
     * Get cluster statistics
     */
    getClusterStats() {
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
    selectRoundRobin(nodes) {
        // Simple round-robin
        return nodes[0];
    }
    selectLeastConnections(nodes) {
        return nodes.reduce((min, node) => node.resources.activeTasks < min.resources.activeTasks ? node : min);
    }
    selectLeastLoad(nodes) {
        return nodes.reduce((min, node) => {
            const nodeLoad = (node.resources.cpuUsage + node.resources.memoryUsage) / 2;
            const minLoad = (min.resources.cpuUsage + min.resources.memoryUsage) / 2;
            return nodeLoad < minLoad ? node : min;
        });
    }
    selectRandom(nodes) {
        return nodes[Math.floor(Math.random() * nodes.length)];
    }
    startHeartbeat() {
        setInterval(() => {
            const now = Date.now();
            for (const node of this.nodes.values()) {
                const timeSinceHeartbeat = now - node.heartbeatAt.getTime();
                if (timeSinceHeartbeat > this.config.heartbeatInterval * 3) {
                    if (node.status !== NodeStatus.Offline) {
                        node.status = NodeStatus.Offline;
                        EventBus_1.eventBus.emitSync('cluster.node_timeout', { nodeId: node.id }, 'ClusterManager');
                    }
                }
            }
        }, this.config.heartbeatInterval);
    }
    generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ClusterManager = ClusterManager;
/**
 * Task Scheduler
 */
class TaskScheduler {
    tasks = new Map();
    jobs = new Map();
    executors = new Map();
    queue = [];
    clusterManager;
    constructor(clusterManager) {
        this.clusterManager = clusterManager;
        this.startScheduler();
    }
    /**
     * Register task executor
     */
    registerExecutor(executor) {
        this.executors.set(executor.type, executor);
    }
    /**
     * Submit task
     */
    submitTask(task) {
        const fullTask = {
            ...task,
            id: this.generateTaskId(),
            status: TaskStatus.Pending,
            retries: 0,
            createdAt: new Date(),
        };
        this.tasks.set(fullTask.id, fullTask);
        this.enqueueTask(fullTask);
        EventBus_1.eventBus.emitSync('task.submitted', fullTask, 'TaskScheduler');
        return fullTask;
    }
    /**
     * Submit job
     */
    submitJob(job) {
        const fullJob = {
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
        EventBus_1.eventBus.emitSync('job.submitted', fullJob, 'TaskScheduler');
        return fullJob;
    }
    /**
     * Cancel task
     */
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = TaskStatus.Cancelled;
            this.queue = this.queue.filter(t => t.id !== taskId);
            EventBus_1.eventBus.emitSync('task.cancelled', task, 'TaskScheduler');
        }
    }
    /**
     * Cancel job
     */
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = JobStatus.Cancelled;
            // Cancel all tasks
            for (const task of job.tasks) {
                this.cancelTask(task.id);
            }
            EventBus_1.eventBus.emitSync('job.cancelled', job, 'TaskScheduler');
        }
    }
    /**
     * Get task
     */
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    /**
     * Get job
     */
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    /**
     * List tasks
     */
    listTasks(filter) {
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
    listJobs(filter) {
        let jobs = Array.from(this.jobs.values());
        if (filter?.status) {
            jobs = jobs.filter(j => j.status === filter.status);
        }
        return jobs;
    }
    /**
     * Enqueue task
     */
    enqueueTask(task) {
        task.status = TaskStatus.Queued;
        // Insert based on priority
        const index = this.queue.findIndex(t => t.priority > task.priority);
        if (index === -1) {
            this.queue.push(task);
        }
        else {
            this.queue.splice(index, 0, task);
        }
    }
    /**
     * Start scheduler loop
     */
    startScheduler() {
        setInterval(() => {
            this.scheduleNextTask();
        }, 1000);
    }
    /**
     * Schedule next task
     */
    async scheduleNextTask() {
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
        EventBus_1.eventBus.emitSync('task.started', { task, nodeId: node.id }, 'TaskScheduler');
        // Execute task
        this.executeTask(task, node);
    }
    /**
     * Execute task
     */
    async executeTask(task, node) {
        const executor = this.executors.get(task.type);
        if (!executor) {
            task.status = TaskStatus.Failed;
            task.error = `No executor found for task type: ${task.type}`;
            task.completedAt = new Date();
            EventBus_1.eventBus.emitSync('task.failed', task, 'TaskScheduler');
            return;
        }
        const context = {
            nodeId: node.id,
            attempt: task.retries + 1,
            metadata: {},
        };
        try {
            const result = await Promise.race([
                executor.execute(task, context),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Task timeout')), task.timeout)),
            ]);
            task.status = TaskStatus.Completed;
            task.result = result;
            task.completedAt = new Date();
            // Update node metrics
            node.metrics.tasksCompleted++;
            node.metrics.lastTaskAt = new Date();
            EventBus_1.eventBus.emitSync('task.completed', task, 'TaskScheduler');
        }
        catch (error) {
            task.retries++;
            if (task.retries < task.maxRetries) {
                // Retry
                task.status = TaskStatus.Queued;
                task.assignedNode = undefined;
                this.enqueueTask(task);
                EventBus_1.eventBus.emitSync('task.retrying', task, 'TaskScheduler');
            }
            else {
                task.status = TaskStatus.Failed;
                task.error = error instanceof Error ? error.message : String(error);
                task.completedAt = new Date();
                // Update node metrics
                node.metrics.tasksFailed++;
                EventBus_1.eventBus.emitSync('task.failed', task, 'TaskScheduler');
            }
        }
        finally {
            // Update node resources
            this.clusterManager.updateNodeResources(node.id, {
                activeTasks: node.resources.activeTasks - 1,
            });
        }
    }
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TaskScheduler = TaskScheduler;
/**
 * Distributed Lock Manager
 */
class DistributedLockManager {
    locks = new Map();
    /**
     * Acquire lock
     */
    async acquireLock(resource, owner, ttl = 30000) {
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
        EventBus_1.eventBus.emitSync('lock.acquired', { resource, owner }, 'DistributedLockManager');
        return true;
    }
    /**
     * Release lock
     */
    releaseLock(resource, owner) {
        const lock = this.locks.get(resource);
        if (!lock || lock.owner !== owner) {
            return false;
        }
        this.locks.delete(resource);
        EventBus_1.eventBus.emitSync('lock.released', { resource, owner }, 'DistributedLockManager');
        return true;
    }
    /**
     * Check if locked
     */
    isLocked(resource) {
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
    getLockOwner(resource) {
        const lock = this.locks.get(resource);
        if (!lock || Date.now() >= lock.expiresAt.getTime()) {
            return null;
        }
        return lock.owner;
    }
}
exports.DistributedLockManager = DistributedLockManager;
/**
 * Singleton instances
 */
exports.clusterManager = new ClusterManager();
exports.taskScheduler = new TaskScheduler(exports.clusterManager);
exports.distributedLockManager = new DistributedLockManager();
