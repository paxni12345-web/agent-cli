/**
 * Queue Management System
 * Job queues, task scheduling, priority queues, and dead letter queues
 */

import { eventBus } from '../core/EventBus';

export interface Job<T = any> {
  id: string;
  queue: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'delayed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  delayUntil?: Date;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  priority?: boolean;
}

export interface QueueStats {
  name: string;
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  delayed: number;
}

export type JobProcessor<T = any> = (job: Job<T>) => Promise<any>;

/**
 * Queue Manager
 */
export class QueueManager {
  private queues: Map<string, JobQueue> = new Map();

  /**
   * Create queue
   */
  createQueue<T = any>(config: QueueConfig, processor: JobProcessor<T>): JobQueue<T> {
    if (this.queues.has(config.name)) {
      throw new Error(`Queue already exists: ${config.name}`);
    }

    const queue = new JobQueue<T>(config, processor);
    this.queues.set(config.name, queue);

    eventBus.emitSync('queue.created', { name: config.name }, 'QueueManager');

    return queue;
  }

  /**
   * Get queue
   */
  getQueue(name: string): JobQueue | undefined {
    return this.queues.get(name);
  }

  /**
   * List queues
   */
  listQueues(): JobQueue[] {
    return Array.from(this.queues.values());
  }

  /**
   * Delete queue
   */
  async deleteQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.close();
      this.queues.delete(name);
      eventBus.emitSync('queue.deleted', { name }, 'QueueManager');
    }
  }

  /**
   * Get all queue statistics
   */
  getAllStats(): QueueStats[] {
    return this.listQueues().map(q => q.getStats());
  }

  /**
   * Pause all queues
   */
  pauseAll(): void {
    for (const queue of this.queues.values()) {
      queue.pause();
    }
  }

  /**
   * Resume all queues
   */
  resumeAll(): void {
    for (const queue of this.queues.values()) {
      queue.resume();
    }
  }
}

/**
 * Job Queue
 */
export class JobQueue<T = any> {
  private jobs: Map<string, Job<T>> = new Map();
  private pending: Job<T>[] = [];
  private processing = new Set<string>();
  private config: QueueConfig;
  private processor: JobProcessor<T>;
  private paused = false;
  private closed = false;
  private processTimer?: NodeJS.Timeout;

  constructor(config: QueueConfig, processor: JobProcessor<T>) {
    this.config = config;
    this.processor = processor;
    this.startProcessing();
  }

  /**
   * Add job to queue
   */
  add(data: T, options?: {
    priority?: number;
    delay?: number;
    maxAttempts?: number;
    metadata?: Record<string, any>;
  }): Job<T> {
    if (this.closed) {
      throw new Error('Queue is closed');
    }

    const job: Job<T> = {
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

    eventBus.emitSync('queue.job_added', { queueName: this.config.name, jobId: job.id }, 'JobQueue');

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job<T> | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Remove job
   */
  remove(jobId: string): boolean {
    const job = this.jobs.get(jobId);

    if (!job) return false;

    // Can only remove jobs that are not processing
    if (job.status === 'processing') {
      return false;
    }

    this.jobs.delete(jobId);
    this.pending = this.pending.filter(j => j.id !== jobId);

    eventBus.emitSync('queue.job_removed', { queueName: this.config.name, jobId }, 'JobQueue');

    return true;
  }

  /**
   * Retry failed job
   */
  async retry(jobId: string): Promise<void> {
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

    eventBus.emitSync('queue.job_retried', { queueName: this.config.name, jobId }, 'JobQueue');
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
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
  pause(): void {
    this.paused = true;
    eventBus.emitSync('queue.paused', { name: this.config.name }, 'JobQueue');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.paused = false;
    eventBus.emitSync('queue.resumed', { name: this.config.name }, 'JobQueue');
  }

  /**
   * Close queue
   */
  async close(): Promise<void> {
    this.closed = true;

    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }

    // Wait for processing jobs to complete
    while (this.processing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    eventBus.emitSync('queue.closed', { name: this.config.name }, 'JobQueue');
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    const process = async () => {
      if (this.closed) return;

      if (!this.paused) {
        // Move delayed jobs to pending
        this.checkDelayedJobs();

        // Process jobs up to concurrency limit
        while (
          this.processing.size < this.config.concurrency &&
          this.pending.length > 0
        ) {
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
  private checkDelayedJobs(): void {
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
  private async processJob(job: Job<T>): Promise<void> {
    job.status = 'processing';
    job.attempts++;
    job.startedAt = new Date();
    this.processing.add(job.id);

    eventBus.emitSync('queue.job_started', { queueName: this.config.name, jobId: job.id }, 'JobQueue');

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

      eventBus.emitSync('queue.job_completed', {
        queueName: this.config.name,
        jobId: job.id,
        result,
      }, 'JobQueue');
    } catch (error) {
      job.error = error instanceof Error ? error.message : String(error);

      if (job.attempts < job.maxAttempts) {
        // Retry with delay
        job.status = 'delayed';
        job.delayUntil = new Date(Date.now() + this.config.retryDelay);

        eventBus.emitSync('queue.job_retry', {
          queueName: this.config.name,
          jobId: job.id,
          attempt: job.attempts,
        }, 'JobQueue');
      } else {
        job.status = 'failed';
        job.failedAt = new Date();

        eventBus.emitSync('queue.job_failed', {
          queueName: this.config.name,
          jobId: job.id,
          error: job.error,
        }, 'JobQueue');
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Sort pending jobs by priority
   */
  private sortPending(): void {
    if (this.config.priority) {
      this.pending.sort((a, b) => b.priority - a.priority);
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Priority Queue
 */
export class PriorityQueue<T = any> extends JobQueue<T> {
  constructor(name: string, processor: JobProcessor<T>, concurrency = 1) {
    super(
      {
        name,
        concurrency,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        priority: true,
      },
      processor
    );
  }
}

/**
 * Dead Letter Queue
 */
export class DeadLetterQueue {
  private jobs: Map<string, Job> = new Map();

  /**
   * Add failed job to DLQ
   */
  add(job: Job): void {
    this.jobs.set(job.id, job);
    eventBus.emitSync('dlq.job_added', { jobId: job.id, queue: job.queue }, 'DeadLetterQueue');
  }

  /**
   * Get job from DLQ
   */
  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List all jobs in DLQ
   */
  list(filter?: { queue?: string; limit?: number }): Job[] {
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
  remove(jobId: string): boolean {
    const deleted = this.jobs.delete(jobId);
    if (deleted) {
      eventBus.emitSync('dlq.job_removed', { jobId }, 'DeadLetterQueue');
    }
    return deleted;
  }

  /**
   * Clear all jobs
   */
  clear(queue?: string): number {
    if (queue) {
      const toDelete = Array.from(this.jobs.values())
        .filter(j => j.queue === queue)
        .map(j => j.id);

      for (const id of toDelete) {
        this.jobs.delete(id);
      }

      return toDelete.length;
    } else {
      const count = this.jobs.size;
      this.jobs.clear();
      return count;
    }
  }

  /**
   * Get DLQ statistics
   */
  getStats(): {
    total: number;
    byQueue: Record<string, number>;
  } {
    const jobs = Array.from(this.jobs.values());
    const byQueue: Record<string, number> = {};

    for (const job of jobs) {
      byQueue[job.queue] = (byQueue[job.queue] || 0) + 1;
    }

    return {
      total: jobs.length,
      byQueue,
    };
  }
}

/**
 * Scheduled Jobs Manager
 */
export class ScheduledJobsManager {
  private schedules: Map<string, ScheduledJob> = new Map();

  /**
   * Schedule recurring job
   */
  schedule(
    name: string,
    cronExpression: string,
    queueName: string,
    jobData: any
  ): ScheduledJob {
    const schedule: ScheduledJob = {
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

    eventBus.emitSync('schedule.created', schedule, 'ScheduledJobsManager');

    return schedule;
  }

  /**
   * Unschedule job
   */
  unschedule(scheduleId: string): void {
    this.schedules.delete(scheduleId);
    eventBus.emitSync('schedule.deleted', { scheduleId }, 'ScheduledJobsManager');
  }

  /**
   * Enable/disable schedule
   */
  setEnabled(scheduleId: string, enabled: boolean): void {
    const schedule = this.schedules.get(scheduleId);
    if (schedule) {
      schedule.enabled = enabled;
    }
  }

  /**
   * Get schedule
   */
  getSchedule(scheduleId: string): ScheduledJob | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * List schedules
   */
  listSchedules(filter?: { enabled?: boolean }): ScheduledJob[] {
    let schedules = Array.from(this.schedules.values());

    if (filter?.enabled !== undefined) {
      schedules = schedules.filter(s => s.enabled === filter.enabled);
    }

    return schedules;
  }

  /**
   * Check and trigger due schedules
   */
  checkSchedules(queueManager: QueueManager): void {
    const now = new Date();

    for (const schedule of this.schedules.values()) {
      if (schedule.enabled && schedule.nextRunAt && schedule.nextRunAt <= now) {
        const queue = queueManager.getQueue(schedule.queueName);

        if (queue) {
          queue.add(schedule.jobData);
          schedule.lastRunAt = now;
          schedule.nextRunAt = this.calculateNextRun(schedule.cronExpression);

          eventBus.emitSync('schedule.triggered', schedule, 'ScheduledJobsManager');
        }
      }
    }
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simplified: just add 1 hour for demo
    // In production, use a cron parser library
    return new Date(Date.now() + 3600000);
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  queueName: string;
  jobData: any;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
}

/**
 * Batch Job Processor
 */
export class BatchJobProcessor {
  /**
   * Process jobs in batches
   */
  static async processBatch<T, R>(
    jobs: T[],
    processor: (job: T) => Promise<R>,
    batchSize = 10,
    concurrency = 5
  ): Promise<R[]> {
    const results: R[] = [];

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
  private static async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === promise),
          1
        );
      }
    }

    await Promise.all(executing);

    return results;
  }
}

/**
 * Singleton instances
 */
export const queueManager = new QueueManager();
export const deadLetterQueue = new DeadLetterQueue();
export const scheduledJobsManager = new ScheduledJobsManager();

// Move failed jobs to DLQ
eventBus.on('queue.job_failed', (event) => {
  const { queueName, jobId } = event.data;
  const queue = queueManager.getQueue(queueName);

  if (queue) {
    const job = queue.getJob(jobId);
    if (job) {
      deadLetterQueue.add(job);
    }
  }
});
