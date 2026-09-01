/**
 * Advanced Scheduler & Cron Manager
 * Complex scheduling, job queuing, recurring tasks, dependencies
 * Timezone support, failure recovery, distributed scheduling
 */
import { EventEmitter } from 'events';
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
export declare class SchedulerManager extends EventEmitter {
    private config;
    private jobs;
    private executions;
    private queues;
    private dependencies;
    private timers;
    private runningJobs;
    constructor(config?: Partial<SchedulerConfig>);
    scheduleJob(name: string, schedule: Schedule, handler: JobHandler, options?: Partial<JobOptions>): ScheduledJob;
    scheduleCronJob(name: string, cronExpression: string, handler: JobHandler, options?: Partial<JobOptions>): ScheduledJob;
    scheduleRecurringJob(name: string, intervalMs: number, handler: JobHandler, options?: Partial<JobOptions>): ScheduledJob;
    scheduleOneTimeJob(name: string, executeAt: number, handler: JobHandler, options?: Partial<JobOptions>): ScheduledJob;
    private executeJob;
    private executeWithTimeout;
    private scheduleNextExecution;
    private calculateNextRun;
    private calculateNextCronRun;
    private calculateNextDailyRun;
    private calculateNextWeeklyRun;
    private calculateNextMonthlyRun;
    private initializeQueues;
    private queueJob;
    private processQueue;
    pauseQueue(priority: JobPriority): void;
    resumeQueue(priority: JobPriority): void;
    private checkDependencies;
    private evaluateCondition;
    private notifyDependentJobs;
    pauseJob(jobId: string): void;
    resumeJob(jobId: string): void;
    cancelJob(jobId: string): void;
    deleteJob(jobId: string): void;
    runJobNow(jobId: string): Promise<void>;
    private determineJobType;
    private startScheduler;
    private checkMissedJobs;
    private generateId;
    getStats(): SchedulerStats;
    getJob(jobId: string): ScheduledJob | undefined;
    getExecution(executionId: string): JobExecution | undefined;
    getJobExecutions(jobId: string): JobExecution[];
    getAllJobs(): ScheduledJob[];
    getJobsByTag(tag: string): ScheduledJob[];
}
export default SchedulerManager;
//# sourceMappingURL=SchedulerManager.d.ts.map