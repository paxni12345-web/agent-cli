/**
 * Advanced Scheduler & Cron Manager
 * Complex scheduling, job queuing, recurring tasks, dependencies
 * Timezone support, failure recovery, distributed scheduling
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SchedulerConfig {
  enableCron: boolean;
  enableRecurring: boolean;
  enableDependencies: boolean;
  enableDistributed: boolean;
  maxConcurrentJobs: number;
  defaultTimeout: number;
  retryAttempts: number;
  timezone: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  type: JobType;
  schedule: Schedule;
  handler: JobHandler;
  options: JobOptions;
  metadata: JobMetadata;
  state: JobState;
  execution?: ExecutionInfo;
}

export type JobType = 'one_time' | 'recurring' | 'cron' | 'interval' | 'dependent';

export interface Schedule {
  type: ScheduleType;
  value: string | number;
  timezone?: string;
  startDate?: number;
  endDate?: number;
  excludeDates?: number[];
}

export type ScheduleType = 'cron' | 'interval' | 'once' | 'daily' | 'weekly' | 'monthly';

export type JobHandler = (context: JobContext) => Promise<any>;

export interface JobContext {
  jobId: string;
  executionId: string;
  scheduledTime: number;
  actualTime: number;
  attempt: number;
  data?: any;
  previousResult?: any;
}

export interface JobOptions {
  priority: JobPriority;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  concurrency?: number;
  dependencies?: string[];
  data?: any;
  tags?: string[];
  enabled?: boolean;
}

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface JobMetadata {
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  description?: string;
  owner?: string;
}

export type JobState = 'idle' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionInfo {
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastResult?: any;
  lastError?: string;
}

export interface JobExecution {
  id: string;
  jobId: string;
  scheduledTime: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  status: ExecutionStatus;
  result?: any;
  error?: string;
  attempt: number;
  logs: ExecutionLog[];
}

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';

export interface ExecutionLog {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface JobQueue {
  name: string;
  priority: JobPriority;
  jobs: string[];
  concurrency: number;
  paused: boolean;
  processing: Set<string>;
}

export interface CronExpression {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export interface JobDependency {
  jobId: string;
  dependsOn: string[];
  type: DependencyType;
  condition?: DependencyCondition;
}

export type DependencyType = 'success' | 'completion' | 'custom';

export interface DependencyCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface SchedulerStats {
  totalJobs: number;
  activeJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  queuedJobs: number;
  averageExecutionTime: number;
}

// ============================================================================
// Scheduler Manager
// ============================================================================

export class SchedulerManager extends EventEmitter {
  private config: SchedulerConfig;
  private jobs: Map<string, ScheduledJob> = new Map();
  private executions: Map<string, JobExecution> = new Map();
  private queues: Map<string, JobQueue> = new Map();
  private dependencies: Map<string, JobDependency> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private runningJobs: Set<string> = new Set();

  constructor(config: Partial<SchedulerConfig> = {}) {
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

  public scheduleJob(
    name: string,
    schedule: Schedule,
    handler: JobHandler,
    options: Partial<JobOptions> = {}
  ): ScheduledJob {
    const job: ScheduledJob = {
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

  public scheduleCronJob(
    name: string,
    cronExpression: string,
    handler: JobHandler,
    options: Partial<JobOptions> = {}
  ): ScheduledJob {
    if (!this.config.enableCron) {
      throw new Error('Cron scheduling is not enabled');
    }

    return this.scheduleJob(
      name,
      {
        type: 'cron',
        value: cronExpression,
        timezone: options.timezone || this.config.timezone,
      },
      handler,
      options
    );
  }

  public scheduleRecurringJob(
    name: string,
    intervalMs: number,
    handler: JobHandler,
    options: Partial<JobOptions> = {}
  ): ScheduledJob {
    if (!this.config.enableRecurring) {
      throw new Error('Recurring scheduling is not enabled');
    }

    return this.scheduleJob(
      name,
      {
        type: 'interval',
        value: intervalMs,
      },
      handler,
      options
    );
  }

  public scheduleOneTimeJob(
    name: string,
    executeAt: number,
    handler: JobHandler,
    options: Partial<JobOptions> = {}
  ): ScheduledJob {
    return this.scheduleJob(
      name,
      {
        type: 'once',
        value: executeAt,
      },
      handler,
      options
    );
  }

  // ========================================================================
  // Job Execution
  // ========================================================================

  private async executeJob(job: ScheduledJob, attempt: number = 1): Promise<void> {
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

    const execution: JobExecution = {
      id: this.generateId(),
      jobId: job.id,
      scheduledTime: job.execution!.nextRun!,
      startTime: Date.now(),
      status: 'running',
      attempt,
      logs: [],
    };

    this.executions.set(execution.id, execution);
    this.runningJobs.add(job.id);
    job.state = 'running';

    this.emit('job:started', { job, execution });

    const context: JobContext = {
      jobId: job.id,
      executionId: execution.id,
      scheduledTime: execution.scheduledTime,
      actualTime: execution.startTime!,
      attempt,
      data: job.options.data,
      previousResult: job.execution!.lastResult,
    };

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        job.handler(context),
        job.options.timeout!
      );

      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime!;
      execution.status = 'success';
      execution.result = result;

      job.execution!.runCount++;
      job.execution!.successCount++;
      job.execution!.lastRun = execution.endTime;
      job.execution!.lastResult = result;

      // Update average duration
      try {
        const totalDuration =
          job.execution!.averageDuration * (job.execution!.runCount - 1) +
          execution.duration;
        job.execution!.averageDuration = totalDuration / job.execution!.runCount;
      } catch (error) {
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
    } catch (error) {
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime!;
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      // Retry logic
      if (attempt < job.options.retries!) {
        execution.status = 'failed';
        this.emit('job:retry', { job, execution, attempt });

        setTimeout(() => {
          this.executeJob(job, attempt + 1);
        }, job.options.retryDelay! * Math.pow(2, attempt - 1));
      } else {
        execution.status = 'failed';
        job.execution!.runCount++;
        job.execution!.failureCount++;
        job.execution!.lastRun = execution.endTime;
        job.execution!.lastError = execution.error;

        this.emit('job:failed', { job, execution });
      }
    } finally {
      this.runningJobs.delete(job.id);
      job.state = execution.status === 'success' ? 'completed' : 'failed';

      // Schedule next execution for recurring jobs
      if (job.type !== 'one_time' && job.options.enabled) {
        this.scheduleNextExecution(job);
      } else if (job.type === 'one_time') {
        job.state = 'completed';
      }

      // Process queue
      this.processQueue();
    }
  }

  private async executeWithTimeout(promise: Promise<any>, timeout: number): Promise<any> {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job execution timeout')), timeout)
      ),
    ]);
  }

  // ========================================================================
  // Scheduling Logic
  // ========================================================================

  private scheduleNextExecution(job: ScheduledJob): void {
    const nextRun = this.calculateNextRun(job);
    if (!nextRun) return;

    job.execution!.nextRun = nextRun;
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

  private calculateNextRun(job: ScheduledJob): number | null {
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
        const lastRun = job.execution!.lastRun || now;
        return lastRun + intervalMs;

      case 'cron':
        return this.calculateNextCronRun(
          schedule.value as string,
          schedule.timezone || this.config.timezone
        );

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

  private calculateNextCronRun(expression: string, timezone: string): number {
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

  private calculateNextDailyRun(schedule: Schedule): number {
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

  private calculateNextWeeklyRun(schedule: Schedule): number {
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
    } else {
      next.setDate(next.getDate() + daysUntilTarget);
    }

    return next.getTime();
  }

  private calculateNextMonthlyRun(schedule: Schedule): number {
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

  private initializeQueues(): void {
    const priorities: JobPriority[] = ['low', 'normal', 'high', 'critical'];

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

  private queueJob(job: ScheduledJob): void {
    const queue = this.queues.get(job.options.priority)!;
    queue.jobs.push(job.id);
    job.state = 'scheduled';

    this.emit('job:queued', { job, queue: queue.name });
  }

  private async processQueue(): Promise<void> {
    // Process queues in priority order
    const priorities: JobPriority[] = ['critical', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const queue = this.queues.get(priority)!;

      if (queue.paused || queue.jobs.length === 0) continue;

      while (
        queue.jobs.length > 0 &&
        this.runningJobs.size < this.config.maxConcurrentJobs
      ) {
        const jobId = queue.jobs.shift()!;
        const job = this.jobs.get(jobId);

        if (job) {
          await this.executeJob(job);
        }
      }
    }
  }

  public pauseQueue(priority: JobPriority): void {
    const queue = this.queues.get(priority);
    if (queue) {
      queue.paused = true;
      this.emit('queue:paused', { queue: priority });
    }
  }

  public resumeQueue(priority: JobPriority): void {
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

  private checkDependencies(job: ScheduledJob): boolean {
    const dependency = this.dependencies.get(job.id);
    if (!dependency) return true;

    for (const depJobId of dependency.dependsOn) {
      const depJob = this.jobs.get(depJobId);
      if (!depJob) continue;

      switch (dependency.type) {
        case 'success':
          if (depJob.state !== 'completed' || depJob.execution!.failureCount > 0) {
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

  private evaluateCondition(condition: DependencyCondition, job: ScheduledJob): boolean {
    const value = (job.execution as any)?.[condition.field];

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

  private notifyDependentJobs(jobId: string, execution: JobExecution): void {
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

  public pauseJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'paused';
    job.options.enabled = false;

    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }

    this.emit('job:paused', { job });
  }

  public resumeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'idle';
    job.options.enabled = true;
    this.scheduleNextExecution(job);

    this.emit('job:resumed', { job });
  }

  public cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'cancelled';
    job.options.enabled = false;

    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }

    this.emit('job:cancelled', { job });
  }

  public deleteJob(jobId: string): void {
    this.cancelJob(jobId);
    this.jobs.delete(jobId);
    this.dependencies.delete(jobId);
    this.emit('job:deleted', { jobId });
  }

  public async runJobNow(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await this.executeJob(job);
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private determineJobType(schedule: Schedule): JobType {
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

  private startScheduler(): void {
    // Check for missed jobs every minute
    setInterval(() => {
      this.checkMissedJobs();
    }, 60000);
  }

  private checkMissedJobs(): void {
    const now = Date.now();

    for (const job of this.jobs.values()) {
      if (
        job.state === 'scheduled' &&
        job.execution!.nextRun &&
        job.execution!.nextRun < now - 60000
      ) {
        this.emit('job:missed', { job });
        // Reschedule
        this.scheduleNextExecution(job);
      }
    }
  }

  private generateId(): string {
    return `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  public getStats(): SchedulerStats {
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
      queuedJobs: Array.from(this.queues.values()).reduce(
        (sum, q) => sum + q.jobs.length,
        0
      ),
      averageExecutionTime: avgDuration,
    };
  }

  public getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  public getExecution(executionId: string): JobExecution | undefined {
    return this.executions.get(executionId);
  }

  public getJobExecutions(jobId: string): JobExecution[] {
    return Array.from(this.executions.values()).filter(e => e.jobId === jobId);
  }

  public getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  public getJobsByTag(tag: string): ScheduledJob[] {
    return Array.from(this.jobs.values()).filter(j => j.options.tags?.includes(tag));
  }
}

// ============================================================================
// Export
// ============================================================================

export default SchedulerManager;
