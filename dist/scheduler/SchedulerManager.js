"use strict";
/**
 * Advanced Scheduler & Cron Manager
 * Complex scheduling, job queuing, recurring tasks, dependencies
 * Timezone support, failure recovery, distributed scheduling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerManager = void 0;
const events_1 = require("events");
// ============================================================================
// Scheduler Manager
// ============================================================================
class SchedulerManager extends events_1.EventEmitter {
    config;
    jobs = new Map();
    executions = new Map();
    queues = new Map();
    dependencies = new Map();
    timers = new Map();
    runningJobs = new Set();
    constructor(config = {}) {
        super();
        this.config = {
            enableCron: true,
            enableRecurring: true,
            enableDependencies: true,
            enableDistributed: false,
            maxConcurrentJobs: 10,
            defaultTimeout: 300000,
            retryAttempts: 3,
            timezone: 'UTC',
            ...config,
        };
        this.initializeQueues();
        this.startScheduler();
    }
    // ========================================================================
    // Job Registration
    // ========================================================================
    scheduleJob(name, schedule, handler, options = {}) {
        const job = {
            id: this.generateId(),
            name,
            type: this.determineJobType(schedule),
            schedule,
            handler,
            options: {
                priority: options.priority || 'normal',
                timeout: options.timeout || this.config.defaultTimeout,
                retries: options.retries || this.config.retryAttempts,
                retryDelay: options.retryDelay || 5000,
                concurrency: options.concurrency || 1,
                dependencies: options.dependencies || [],
                data: options.data,
                tags: options.tags || [],
                enabled: options.enabled !== false,
            },
            metadata: {
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: 'system',
                description: options.description,
            },
            state: 'idle',
            execution: {
                runCount: 0,
                successCount: 0,
                failureCount: 0,
                averageDuration: 0,
            },
        };
        this.jobs.set(job.id, job);
        // Register dependencies
        if (job.options.dependencies && job.options.dependencies.length > 0) {
            this.dependencies.set(job.id, {
                jobId: job.id,
                dependsOn: job.options.dependencies,
                type: 'success',
            });
        }
        // Schedule first execution
        if (job.options.enabled) {
            this.scheduleNextExecution(job);
        }
        this.emit('job:registered', { job });
        return job;
    }
    scheduleCronJob(name, cronExpression, handler, options = {}) {
        if (!this.config.enableCron) {
            throw new Error('Cron scheduling is not enabled');
        }
        return this.scheduleJob(name, {
            type: 'cron',
            value: cronExpression,
            timezone: options.timezone || this.config.timezone,
        }, handler, options);
    }
    scheduleRecurringJob(name, intervalMs, handler, options = {}) {
        if (!this.config.enableRecurring) {
            throw new Error('Recurring scheduling is not enabled');
        }
        return this.scheduleJob(name, {
            type: 'interval',
            value: intervalMs,
        }, handler, options);
    }
    scheduleOneTimeJob(name, executeAt, handler, options = {}) {
        return this.scheduleJob(name, {
            type: 'once',
            value: executeAt,
        }, handler, options);
    }
    // ========================================================================
    // Job Execution
    // ========================================================================
    async executeJob(job, attempt = 1) {
        // Check concurrency
        if (this.runningJobs.size >= this.config.maxConcurrentJobs) {
            this.queueJob(job);
            return;
        }
        // Check dependencies
        if (this.config.enableDependencies && !this.checkDependencies(job)) {
            this.emit('job:dependency:blocked', { job });
            return;
        }
        const execution = {
            id: this.generateId(),
            jobId: job.id,
            scheduledTime: job.execution.nextRun,
            startTime: Date.now(),
            status: 'running',
            attempt,
            logs: [],
        };
        this.executions.set(execution.id, execution);
        this.runningJobs.add(job.id);
        job.state = 'running';
        this.emit('job:started', { job, execution });
        const context = {
            jobId: job.id,
            executionId: execution.id,
            scheduledTime: execution.scheduledTime,
            actualTime: execution.startTime,
            attempt,
            data: job.options.data,
            previousResult: job.execution.lastResult,
        };
        try {
            // Execute with timeout
            const result = await this.executeWithTimeout(job.handler(context), job.options.timeout);
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;
            execution.status = 'success';
            execution.result = result;
            job.execution.runCount++;
            job.execution.successCount++;
            job.execution.lastRun = execution.endTime;
            job.execution.lastResult = result;
            // Update average duration
            try {
                const totalDuration = job.execution.averageDuration * (job.execution.runCount - 1) +
                    execution.duration;
                job.execution.averageDuration = totalDuration / job.execution.runCount;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Failed to update average duration for job ${job.id}:`, errorMessage);
                this.emit('job:metrics_update_error', {
                    jobId: job.id,
                    error: errorMessage
                });
            }
            this.emit('job:completed', { job, execution });
            // Notify dependent jobs
            this.notifyDependentJobs(job.id, execution);
        }
        catch (error) {
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;
            execution.error = error instanceof Error ? error.message : 'Unknown error';
            // Retry logic
            if (attempt < job.options.retries) {
                execution.status = 'failed';
                this.emit('job:retry', { job, execution, attempt });
                setTimeout(() => {
                    this.executeJob(job, attempt + 1);
                }, job.options.retryDelay * Math.pow(2, attempt - 1));
            }
            else {
                execution.status = 'failed';
                job.execution.runCount++;
                job.execution.failureCount++;
                job.execution.lastRun = execution.endTime;
                job.execution.lastError = execution.error;
                this.emit('job:failed', { job, execution });
            }
        }
        finally {
            this.runningJobs.delete(job.id);
            job.state = execution.status === 'success' ? 'completed' : 'failed';
            // Schedule next execution for recurring jobs
            if (job.type !== 'one_time' && job.options.enabled) {
                this.scheduleNextExecution(job);
            }
            else if (job.type === 'one_time') {
                job.state = 'completed';
            }
            // Process queue
            this.processQueue();
        }
    }
    async executeWithTimeout(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Job execution timeout')), timeout)),
        ]);
    }
    // ========================================================================
    // Scheduling Logic
    // ========================================================================
    scheduleNextExecution(job) {
        const nextRun = this.calculateNextRun(job);
        if (!nextRun)
            return;
        job.execution.nextRun = nextRun;
        job.state = 'scheduled';
        const delay = nextRun - Date.now();
        // Clear existing timer
        const existingTimer = this.timers.get(job.id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        // Set new timer
        const timer = setTimeout(() => {
            this.executeJob(job);
        }, Math.max(0, delay));
        this.timers.set(job.id, timer);
        this.emit('job:scheduled', { job, nextRun });
    }
    calculateNextRun(job) {
        const now = Date.now();
        const { schedule } = job;
        // Check end date
        if (schedule.endDate && now > schedule.endDate) {
            return null;
        }
        switch (schedule.type) {
            case 'once':
                const onceTime = typeof schedule.value === 'number' ? schedule.value : 0;
                return onceTime > now ? onceTime : null;
            case 'interval':
                const intervalMs = typeof schedule.value === 'number' ? schedule.value : 0;
                const lastRun = job.execution.lastRun || now;
                return lastRun + intervalMs;
            case 'cron':
                return this.calculateNextCronRun(schedule.value, schedule.timezone || this.config.timezone);
            case 'daily':
                return this.calculateNextDailyRun(schedule);
            case 'weekly':
                return this.calculateNextWeeklyRun(schedule);
            case 'monthly':
                return this.calculateNextMonthlyRun(schedule);
            default:
                return null;
        }
    }
    calculateNextCronRun(expression, timezone) {
        // Simplified cron calculation - use cron library in production
        const parts = expression.split(' ');
        const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
        const now = new Date();
        const next = new Date(now);
        // Parse minute
        if (minute !== '*') {
            next.setMinutes(parseInt(minute, 10));
        }
        // Parse hour
        if (hour !== '*') {
            next.setHours(parseInt(hour, 10));
        }
        // If calculated time is in the past, add one day
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        return next.getTime();
    }
    calculateNextDailyRun(schedule) {
        const now = new Date();
        const next = new Date(now);
        // Parse time from schedule value (e.g., "14:30")
        const [hour, minute] = String(schedule.value).split(':').map(Number);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        return next.getTime();
    }
    calculateNextWeeklyRun(schedule) {
        const now = new Date();
        const next = new Date(now);
        // Parse day and time from schedule value (e.g., "Monday 14:30")
        const [day, time] = String(schedule.value).split(' ');
        const [hour, minute] = time.split(':').map(Number);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const targetDay = days.indexOf(day);
        next.setHours(hour, minute, 0, 0);
        const daysUntilTarget = (targetDay + 7 - next.getDay()) % 7;
        if (daysUntilTarget === 0 && next <= now) {
            next.setDate(next.getDate() + 7);
        }
        else {
            next.setDate(next.getDate() + daysUntilTarget);
        }
        return next.getTime();
    }
    calculateNextMonthlyRun(schedule) {
        const now = new Date();
        const next = new Date(now);
        // Parse day and time from schedule value (e.g., "15 14:30")
        const [day, time] = String(schedule.value).split(' ');
        const [hour, minute] = time.split(':').map(Number);
        next.setDate(parseInt(day, 10));
        next.setHours(hour, minute, 0, 0);
        if (next <= now) {
            next.setMonth(next.getMonth() + 1);
        }
        return next.getTime();
    }
    // ========================================================================
    // Queue Management
    // ========================================================================
    initializeQueues() {
        const priorities = ['low', 'normal', 'high', 'critical'];
        for (const priority of priorities) {
            this.queues.set(priority, {
                name: priority,
                priority,
                jobs: [],
                concurrency: this.config.maxConcurrentJobs,
                paused: false,
                processing: new Set(),
            });
        }
    }
    queueJob(job) {
        const queue = this.queues.get(job.options.priority);
        queue.jobs.push(job.id);
        job.state = 'scheduled';
        this.emit('job:queued', { job, queue: queue.name });
    }
    async processQueue() {
        // Process queues in priority order
        const priorities = ['critical', 'high', 'normal', 'low'];
        for (const priority of priorities) {
            const queue = this.queues.get(priority);
            if (queue.paused || queue.jobs.length === 0)
                continue;
            while (queue.jobs.length > 0 &&
                this.runningJobs.size < this.config.maxConcurrentJobs) {
                const jobId = queue.jobs.shift();
                const job = this.jobs.get(jobId);
                if (job) {
                    await this.executeJob(job);
                }
            }
        }
    }
    pauseQueue(priority) {
        const queue = this.queues.get(priority);
        if (queue) {
            queue.paused = true;
            this.emit('queue:paused', { queue: priority });
        }
    }
    resumeQueue(priority) {
        const queue = this.queues.get(priority);
        if (queue) {
            queue.paused = false;
            this.processQueue();
            this.emit('queue:resumed', { queue: priority });
        }
    }
    // ========================================================================
    // Dependencies
    // ========================================================================
    checkDependencies(job) {
        const dependency = this.dependencies.get(job.id);
        if (!dependency)
            return true;
        for (const depJobId of dependency.dependsOn) {
            const depJob = this.jobs.get(depJobId);
            if (!depJob)
                continue;
            switch (dependency.type) {
                case 'success':
                    if (depJob.state !== 'completed' || depJob.execution.failureCount > 0) {
                        return false;
                    }
                    break;
                case 'completion':
                    if (depJob.state === 'running' || depJob.state === 'scheduled') {
                        return false;
                    }
                    break;
                case 'custom':
                    if (dependency.condition && !this.evaluateCondition(dependency.condition, depJob)) {
                        return false;
                    }
                    break;
            }
        }
        return true;
    }
    evaluateCondition(condition, job) {
        const value = job.execution?.[condition.field];
        switch (condition.operator) {
            case 'equals':
                return value === condition.value;
            case 'greater_than':
                return value > condition.value;
            case 'less_than':
                return value < condition.value;
            case 'contains':
                return String(value).includes(String(condition.value));
            default:
                return false;
        }
    }
    notifyDependentJobs(jobId, execution) {
        for (const [depJobId, dependency] of this.dependencies.entries()) {
            if (dependency.dependsOn.includes(jobId)) {
                const depJob = this.jobs.get(depJobId);
                if (depJob && depJob.state === 'idle' && this.checkDependencies(depJob)) {
                    this.scheduleNextExecution(depJob);
                }
            }
        }
    }
    // ========================================================================
    // Job Control
    // ========================================================================
    pauseJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        job.state = 'paused';
        job.options.enabled = false;
        const timer = this.timers.get(jobId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(jobId);
        }
        this.emit('job:paused', { job });
    }
    resumeJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        job.state = 'idle';
        job.options.enabled = true;
        this.scheduleNextExecution(job);
        this.emit('job:resumed', { job });
    }
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        job.state = 'cancelled';
        job.options.enabled = false;
        const timer = this.timers.get(jobId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(jobId);
        }
        this.emit('job:cancelled', { job });
    }
    deleteJob(jobId) {
        this.cancelJob(jobId);
        this.jobs.delete(jobId);
        this.dependencies.delete(jobId);
        this.emit('job:deleted', { jobId });
    }
    async runJobNow(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            throw new Error(`Job not found: ${jobId}`);
        }
        await this.executeJob(job);
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    determineJobType(schedule) {
        switch (schedule.type) {
            case 'once':
                return 'one_time';
            case 'cron':
                return 'cron';
            case 'interval':
            case 'daily':
            case 'weekly':
            case 'monthly':
                return 'recurring';
            default:
                return 'one_time';
        }
    }
    startScheduler() {
        // Check for missed jobs every minute
        setInterval(() => {
            this.checkMissedJobs();
        }, 60000);
    }
    checkMissedJobs() {
        const now = Date.now();
        for (const job of this.jobs.values()) {
            if (job.state === 'scheduled' &&
                job.execution.nextRun &&
                job.execution.nextRun < now - 60000) {
                this.emit('job:missed', { job });
                // Reschedule
                this.scheduleNextExecution(job);
            }
        }
    }
    generateId() {
        return `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    // ========================================================================
    // Statistics & Monitoring
    // ========================================================================
    getStats() {
        const jobs = Array.from(this.jobs.values());
        const executions = Array.from(this.executions.values());
        const totalDuration = executions
            .filter(e => e.duration)
            .reduce((sum, e) => sum + (e.duration || 0), 0);
        const avgDuration = executions.length > 0 ? totalDuration / executions.length : 0;
        return {
            totalJobs: jobs.length,
            activeJobs: jobs.filter(j => j.options.enabled).length,
            runningJobs: this.runningJobs.size,
            completedJobs: jobs.filter(j => j.state === 'completed').length,
            failedJobs: jobs.filter(j => j.state === 'failed').length,
            queuedJobs: Array.from(this.queues.values()).reduce((sum, q) => sum + q.jobs.length, 0),
            averageExecutionTime: avgDuration,
        };
    }
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    getJobExecutions(jobId) {
        return Array.from(this.executions.values()).filter(e => e.jobId === jobId);
    }
    getAllJobs() {
        return Array.from(this.jobs.values());
    }
    getJobsByTag(tag) {
        return Array.from(this.jobs.values()).filter(j => j.options.tags?.includes(tag));
    }
}
exports.SchedulerManager = SchedulerManager;
// ============================================================================
// Export
// ============================================================================
exports.default = SchedulerManager;
