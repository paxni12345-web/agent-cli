"use strict";
/**
 * Queue Management System
 * Job queues, task scheduling, priority queues, and dead letter queues
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledJobsManager = exports.deadLetterQueue = exports.queueManager = exports.BatchJobProcessor = exports.ScheduledJobsManager = exports.DeadLetterQueue = exports.PriorityQueue = exports.JobQueue = exports.QueueManager = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Queue Manager
 */
class QueueManager {
    queues = new Map();
    /**
     * Create queue
     */
    createQueue(config, processor) {
        if (this.queues.has(config.name)) {
            throw new Error(`Queue already exists: ${config.name}`);
        }
        const queue = new JobQueue(config, processor);
        this.queues.set(config.name, queue);
        EventBus_1.eventBus.emitSync('queue.created', { name: config.name }, 'QueueManager');
        return queue;
    }
    /**
     * Get queue
     */
    getQueue(name) {
        return this.queues.get(name);
    }
    /**
     * List queues
     */
    listQueues() {
        return Array.from(this.queues.values());
    }
    /**
     * Delete queue
     */
    async deleteQueue(name) {
        const queue = this.queues.get(name);
        if (queue) {
            await queue.close();
            this.queues.delete(name);
            EventBus_1.eventBus.emitSync('queue.deleted', { name }, 'QueueManager');
        }
    }
    /**
     * Get all queue statistics
     */
    getAllStats() {
        return this.listQueues().map(q => q.getStats());
    }
    /**
     * Pause all queues
     */
    pauseAll() {
        for (const queue of this.queues.values()) {
            queue.pause();
        }
    }
    /**
     * Resume all queues
     */
    resumeAll() {
        for (const queue of this.queues.values()) {
            queue.resume();
        }
    }
}
exports.QueueManager = QueueManager;
/**
 * Job Queue
 */
class JobQueue {
    jobs = new Map();
    pending = [];
    processing = new Set();
    config;
    processor;
    paused = false;
    closed = false;
    processTimer;
    constructor(config, processor) {
        this.config = config;
        this.processor = processor;
        this.startProcessing();
    }
    /**
     * Add job to queue
     */
    add(data, options) {
        if (this.closed) {
            throw new Error('Queue is closed');
        }
        const job = {
            id: this.generateJobId(),
            queue: this.config.name,
            data,
            priority: options?.priority || 0,
            attempts: 0,
            maxAttempts: options?.maxAttempts || this.config.maxRetries,
            status: options?.delay ? 'delayed' : 'pending',
            createdAt: new Date(),
            delayUntil: options?.delay ? new Date(Date.now() + options.delay) : undefined,
            metadata: options?.metadata,
        };
        this.jobs.set(job.id, job);
        if (job.status === 'pending') {
            this.pending.push(job);
            this.sortPending();
        }
        EventBus_1.eventBus.emitSync('queue.job_added', { queueName: this.config.name, jobId: job.id }, 'JobQueue');
        return job;
    }
    /**
     * Get job by ID
     */
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    /**
     * Remove job
     */
    remove(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return false;
        // Can only remove jobs that are not processing
        if (job.status === 'processing') {
            return false;
        }
        this.jobs.delete(jobId);
        this.pending = this.pending.filter(j => j.id !== jobId);
        EventBus_1.eventBus.emitSync('queue.job_removed', { queueName: this.config.name, jobId }, 'JobQueue');
        return true;
    }
    /**
     * Retry failed job
     */
    async retry(jobId) {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'failed') {
            throw new Error('Job not found or not failed');
        }
        job.status = 'pending';
        job.attempts = 0;
        job.error = undefined;
        job.failedAt = undefined;
        this.pending.push(job);
        this.sortPending();
        EventBus_1.eventBus.emitSync('queue.job_retried', { queueName: this.config.name, jobId }, 'JobQueue');
    }
    /**
     * Get queue statistics
     */
    getStats() {
        const jobs = Array.from(this.jobs.values());
        return {
            name: this.config.name,
            total: jobs.length,
            pending: jobs.filter(j => j.status === 'pending').length,
            processing: jobs.filter(j => j.status === 'processing').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            failed: jobs.filter(j => j.status === 'failed').length,
            delayed: jobs.filter(j => j.status === 'delayed').length,
        };
    }
    /**
     * Pause queue processing
     */
    pause() {
        this.paused = true;
        EventBus_1.eventBus.emitSync('queue.paused', { name: this.config.name }, 'JobQueue');
    }
    /**
     * Resume queue processing
     */
    resume() {
        this.paused = false;
        EventBus_1.eventBus.emitSync('queue.resumed', { name: this.config.name }, 'JobQueue');
    }
    /**
     * Close queue
     */
    async close() {
        this.closed = true;
        if (this.processTimer) {
            clearTimeout(this.processTimer);
        }
        // Wait for processing jobs to complete
        while (this.processing.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        EventBus_1.eventBus.emitSync('queue.closed', { name: this.config.name }, 'JobQueue');
    }
    /**
     * Start processing jobs
     */
    startProcessing() {
        const process = async () => {
            if (this.closed)
                return;
            if (!this.paused) {
                // Move delayed jobs to pending
                this.checkDelayedJobs();
                // Process jobs up to concurrency limit
                while (this.processing.size < this.config.concurrency &&
                    this.pending.length > 0) {
                    const job = this.pending.shift();
                    if (job) {
                        this.processJob(job);
                    }
                }
            }
            this.processTimer = setTimeout(process, 100);
        };
        process();
    }
    /**
     * Check and move delayed jobs to pending
     */
    checkDelayedJobs() {
        const now = new Date();
        for (const job of this.jobs.values()) {
            if (job.status === 'delayed' && job.delayUntil && job.delayUntil <= now) {
                job.status = 'pending';
                job.delayUntil = undefined;
                this.pending.push(job);
            }
        }
        this.sortPending();
    }
    /**
     * Process single job
     */
    async processJob(job) {
        job.status = 'processing';
        job.attempts++;
        job.startedAt = new Date();
        this.processing.add(job.id);
        EventBus_1.eventBus.emitSync('queue.job_started', { queueName: this.config.name, jobId: job.id }, 'JobQueue');
        try {
            // Set timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Job timeout')), this.config.timeout);
            });
            const processorPromise = this.processor(job);
            const result = await Promise.race([processorPromise, timeoutPromise]);
            job.result = result;
            job.status = 'completed';
            job.completedAt = new Date();
            EventBus_1.eventBus.emitSync('queue.job_completed', {
                queueName: this.config.name,
                jobId: job.id,
                result,
            }, 'JobQueue');
        }
        catch (error) {
            job.error = error instanceof Error ? error.message : String(error);
            if (job.attempts < job.maxAttempts) {
                // Retry with delay
                job.status = 'delayed';
                job.delayUntil = new Date(Date.now() + this.config.retryDelay);
                EventBus_1.eventBus.emitSync('queue.job_retry', {
                    queueName: this.config.name,
                    jobId: job.id,
                    attempt: job.attempts,
                }, 'JobQueue');
            }
            else {
                job.status = 'failed';
                job.failedAt = new Date();
                EventBus_1.eventBus.emitSync('queue.job_failed', {
                    queueName: this.config.name,
                    jobId: job.id,
                    error: job.error,
                }, 'JobQueue');
            }
        }
        finally {
            this.processing.delete(job.id);
        }
    }
    /**
     * Sort pending jobs by priority
     */
    sortPending() {
        if (this.config.priority) {
            this.pending.sort((a, b) => b.priority - a.priority);
        }
    }
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.JobQueue = JobQueue;
/**
 * Priority Queue
 */
class PriorityQueue extends JobQueue {
    constructor(name, processor, concurrency = 1) {
        super({
            name,
            concurrency,
            maxRetries: 3,
            retryDelay: 1000,
            timeout: 30000,
            priority: true,
        }, processor);
    }
}
exports.PriorityQueue = PriorityQueue;
/**
 * Dead Letter Queue
 */
class DeadLetterQueue {
    jobs = new Map();
    /**
     * Add failed job to DLQ
     */
    add(job) {
        this.jobs.set(job.id, job);
        EventBus_1.eventBus.emitSync('dlq.job_added', { jobId: job.id, queue: job.queue }, 'DeadLetterQueue');
    }
    /**
     * Get job from DLQ
     */
    get(jobId) {
        return this.jobs.get(jobId);
    }
    /**
     * List all jobs in DLQ
     */
    list(filter) {
        let jobs = Array.from(this.jobs.values());
        if (filter?.queue) {
            jobs = jobs.filter(j => j.queue === filter.queue);
        }
        jobs.sort((a, b) => (b.failedAt?.getTime() || 0) - (a.failedAt?.getTime() || 0));
        if (filter?.limit) {
            jobs = jobs.slice(0, filter.limit);
        }
        return jobs;
    }
    /**
     * Remove job from DLQ
     */
    remove(jobId) {
        const deleted = this.jobs.delete(jobId);
        if (deleted) {
            EventBus_1.eventBus.emitSync('dlq.job_removed', { jobId }, 'DeadLetterQueue');
        }
        return deleted;
    }
    /**
     * Clear all jobs
     */
    clear(queue) {
        if (queue) {
            const toDelete = Array.from(this.jobs.values())
                .filter(j => j.queue === queue)
                .map(j => j.id);
            for (const id of toDelete) {
                this.jobs.delete(id);
            }
            return toDelete.length;
        }
        else {
            const count = this.jobs.size;
            this.jobs.clear();
            return count;
        }
    }
    /**
     * Get DLQ statistics
     */
    getStats() {
        const jobs = Array.from(this.jobs.values());
        const byQueue = {};
        for (const job of jobs) {
            byQueue[job.queue] = (byQueue[job.queue] || 0) + 1;
        }
        return {
            total: jobs.length,
            byQueue,
        };
    }
}
exports.DeadLetterQueue = DeadLetterQueue;
/**
 * Scheduled Jobs Manager
 */
class ScheduledJobsManager {
    schedules = new Map();
    /**
     * Schedule recurring job
     */
    schedule(name, cronExpression, queueName, jobData) {
        const schedule = {
            id: this.generateScheduleId(),
            name,
            cronExpression,
            queueName,
            jobData,
            enabled: true,
            lastRunAt: undefined,
            nextRunAt: this.calculateNextRun(cronExpression),
            createdAt: new Date(),
        };
        this.schedules.set(schedule.id, schedule);
        EventBus_1.eventBus.emitSync('schedule.created', schedule, 'ScheduledJobsManager');
        return schedule;
    }
    /**
     * Unschedule job
     */
    unschedule(scheduleId) {
        this.schedules.delete(scheduleId);
        EventBus_1.eventBus.emitSync('schedule.deleted', { scheduleId }, 'ScheduledJobsManager');
    }
    /**
     * Enable/disable schedule
     */
    setEnabled(scheduleId, enabled) {
        const schedule = this.schedules.get(scheduleId);
        if (schedule) {
            schedule.enabled = enabled;
        }
    }
    /**
     * Get schedule
     */
    getSchedule(scheduleId) {
        return this.schedules.get(scheduleId);
    }
    /**
     * List schedules
     */
    listSchedules(filter) {
        let schedules = Array.from(this.schedules.values());
        if (filter?.enabled !== undefined) {
            schedules = schedules.filter(s => s.enabled === filter.enabled);
        }
        return schedules;
    }
    /**
     * Check and trigger due schedules
     */
    checkSchedules(queueManager) {
        const now = new Date();
        for (const schedule of this.schedules.values()) {
            if (schedule.enabled && schedule.nextRunAt && schedule.nextRunAt <= now) {
                const queue = queueManager.getQueue(schedule.queueName);
                if (queue) {
                    queue.add(schedule.jobData);
                    schedule.lastRunAt = now;
                    schedule.nextRunAt = this.calculateNextRun(schedule.cronExpression);
                    EventBus_1.eventBus.emitSync('schedule.triggered', schedule, 'ScheduledJobsManager');
                }
            }
        }
    }
    calculateNextRun(cronExpression) {
        // Simplified: just add 1 hour for demo
        // In production, use a cron parser library
        return new Date(Date.now() + 3600000);
    }
    generateScheduleId() {
        return `schedule_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ScheduledJobsManager = ScheduledJobsManager;
/**
 * Batch Job Processor
 */
class BatchJobProcessor {
    /**
     * Process jobs in batches
     */
    static async processBatch(jobs, processor, batchSize = 10, concurrency = 5) {
        const results = [];
        for (let i = 0; i < jobs.length; i += batchSize) {
            const batch = jobs.slice(i, i + batchSize);
            // Process batch with concurrency limit
            const batchResults = await this.processWithConcurrency(batch, processor, concurrency);
            results.push(...batchResults);
        }
        return results;
    }
    /**
     * Process with concurrency limit
     */
    static async processWithConcurrency(items, processor, concurrency) {
        const results = [];
        const executing = [];
        for (const item of items) {
            const promise = processor(item).then(result => {
                results.push(result);
            });
            executing.push(promise);
            if (executing.length >= concurrency) {
                await Promise.race(executing);
                executing.splice(executing.findIndex(p => p === promise), 1);
            }
        }
        await Promise.all(executing);
        return results;
    }
}
exports.BatchJobProcessor = BatchJobProcessor;
/**
 * Singleton instances
 */
exports.queueManager = new QueueManager();
exports.deadLetterQueue = new DeadLetterQueue();
exports.scheduledJobsManager = new ScheduledJobsManager();
// Move failed jobs to DLQ
EventBus_1.eventBus.on('queue.job_failed', (event) => {
    const { queueName, jobId } = event.data;
    const queue = exports.queueManager.getQueue(queueName);
    if (queue) {
        const job = queue.getJob(jobId);
        if (job) {
            exports.deadLetterQueue.add(job);
        }
    }
});
