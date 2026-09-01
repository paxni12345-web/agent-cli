/**
 * Queue Management System
 * Job queues, task scheduling, priority queues, and dead letter queues
 */
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
export declare class QueueManager {
    private queues;
    /**
     * Create queue
     */
    createQueue<T = any>(config: QueueConfig, processor: JobProcessor<T>): JobQueue<T>;
    /**
     * Get queue
     */
    getQueue(name: string): JobQueue | undefined;
    /**
     * List queues
     */
    listQueues(): JobQueue[];
    /**
     * Delete queue
     */
    deleteQueue(name: string): Promise<void>;
    /**
     * Get all queue statistics
     */
    getAllStats(): QueueStats[];
    /**
     * Pause all queues
     */
    pauseAll(): void;
    /**
     * Resume all queues
     */
    resumeAll(): void;
}
/**
 * Job Queue
 */
export declare class JobQueue<T = any> {
    private jobs;
    private pending;
    private processing;
    private config;
    private processor;
    private paused;
    private closed;
    private processTimer?;
    constructor(config: QueueConfig, processor: JobProcessor<T>);
    /**
     * Add job to queue
     */
    add(data: T, options?: {
        priority?: number;
        delay?: number;
        maxAttempts?: number;
        metadata?: Record<string, any>;
    }): Job<T>;
    /**
     * Get job by ID
     */
    getJob(jobId: string): Job<T> | undefined;
    /**
     * Remove job
     */
    remove(jobId: string): boolean;
    /**
     * Retry failed job
     */
    retry(jobId: string): Promise<void>;
    /**
     * Get queue statistics
     */
    getStats(): QueueStats;
    /**
     * Pause queue processing
     */
    pause(): void;
    /**
     * Resume queue processing
     */
    resume(): void;
    /**
     * Close queue
     */
    close(): Promise<void>;
    /**
     * Start processing jobs
     */
    private startProcessing;
    /**
     * Check and move delayed jobs to pending
     */
    private checkDelayedJobs;
    /**
     * Process single job
     */
    private processJob;
    /**
     * Sort pending jobs by priority
     */
    private sortPending;
    private generateJobId;
}
/**
 * Priority Queue
 */
export declare class PriorityQueue<T = any> extends JobQueue<T> {
    constructor(name: string, processor: JobProcessor<T>, concurrency?: number);
}
/**
 * Dead Letter Queue
 */
export declare class DeadLetterQueue {
    private jobs;
    /**
     * Add failed job to DLQ
     */
    add(job: Job): void;
    /**
     * Get job from DLQ
     */
    get(jobId: string): Job | undefined;
    /**
     * List all jobs in DLQ
     */
    list(filter?: {
        queue?: string;
        limit?: number;
    }): Job[];
    /**
     * Remove job from DLQ
     */
    remove(jobId: string): boolean;
    /**
     * Clear all jobs
     */
    clear(queue?: string): number;
    /**
     * Get DLQ statistics
     */
    getStats(): {
        total: number;
        byQueue: Record<string, number>;
    };
}
/**
 * Scheduled Jobs Manager
 */
export declare class ScheduledJobsManager {
    private schedules;
    /**
     * Schedule recurring job
     */
    schedule(name: string, cronExpression: string, queueName: string, jobData: any): ScheduledJob;
    /**
     * Unschedule job
     */
    unschedule(scheduleId: string): void;
    /**
     * Enable/disable schedule
     */
    setEnabled(scheduleId: string, enabled: boolean): void;
    /**
     * Get schedule
     */
    getSchedule(scheduleId: string): ScheduledJob | undefined;
    /**
     * List schedules
     */
    listSchedules(filter?: {
        enabled?: boolean;
    }): ScheduledJob[];
    /**
     * Check and trigger due schedules
     */
    checkSchedules(queueManager: QueueManager): void;
    private calculateNextRun;
    private generateScheduleId;
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
export declare class BatchJobProcessor {
    /**
     * Process jobs in batches
     */
    static processBatch<T, R>(jobs: T[], processor: (job: T) => Promise<R>, batchSize?: number, concurrency?: number): Promise<R[]>;
    /**
     * Process with concurrency limit
     */
    private static processWithConcurrency;
}
/**
 * Singleton instances
 */
export declare const queueManager: QueueManager;
export declare const deadLetterQueue: DeadLetterQueue;
export declare const scheduledJobsManager: ScheduledJobsManager;
export {};
//# sourceMappingURL=QueueSystem.d.ts.map