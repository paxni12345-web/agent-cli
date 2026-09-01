/**
 * TaskScheduler - Task scheduling system
 * Enterprise-grade implementation with full features
 */
import { EventEmitter } from 'events';
export interface TaskSchedulerConfig {
    enabled: boolean;
    mode: 'development' | 'staging' | 'production';
    timeout: number;
    retries: number;
    batchSize: number;
    concurrency: number;
    cacheEnabled: boolean;
    cacheTTL: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    debug: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsEnabled: boolean;
    metricsInterval: number;
}
export interface Request {
    id: string;
    type: string;
    action: string;
    payload: any;
    priority: number;
    timestamp: Date;
    metadata: RequestMetadata;
    options?: RequestOptions;
}
export interface RequestMetadata {
    userId?: string;
    sessionId?: string;
    clientId?: string;
    source?: string;
    tags?: string[];
    custom?: Record<string, any>;
}
export interface RequestOptions {
    timeout?: number;
    retries?: number;
    priority?: number;
    cacheKey?: string;
    skipCache?: boolean;
    async?: boolean;
}
export interface Response {
    id: string;
    requestId: string;
    status: 'success' | 'error' | 'timeout' | 'cancelled';
    data: any;
    error?: ErrorInfo;
    duration: number;
    cached: boolean;
    timestamp: Date;
    metadata: ResponseMetadata;
}
export interface ErrorInfo {
    code: string;
    message: string;
    details?: any;
    stack?: string;
    retryable: boolean;
}
export interface ResponseMetadata {
    processingTime: number;
    queueTime: number;
    cacheHit: boolean;
    retryCount: number;
    custom?: Record<string, any>;
}
export interface Metrics {
    requests: RequestMetrics;
    responses: ResponseMetrics;
    cache: CacheMetrics;
    queue: QueueMetrics;
    errors: ErrorMetrics;
    performance: PerformanceMetrics;
}
export interface RequestMetrics {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    rate: number;
}
export interface ResponseMetrics {
    successful: number;
    failed: number;
    timedOut: number;
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
}
export interface CacheMetrics {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    evictions: number;
}
export interface QueueMetrics {
    size: number;
    avgWaitTime: number;
    maxWaitTime: number;
    throughput: number;
}
export interface ErrorMetrics {
    total: number;
    byType: Map<string, number>;
    byCode: Map<string, number>;
    rate: number;
}
export interface PerformanceMetrics {
    cpu: number;
    memory: number;
    latency: number;
    throughput: number;
}
export interface CacheEntry {
    key: string;
    value: any;
    ttl: number;
    createdAt: Date;
    accessedAt: Date;
    hits: number;
    size: number;
    compressed: boolean;
    encrypted: boolean;
}
export interface QueueItem {
    id: string;
    request: Request;
    priority: number;
    addedAt: Date;
    attempts: number;
    nextRetry?: Date;
}
export interface ValidationRule {
    field: string;
    type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
    value?: any;
    message: string;
    validator?: (value: any) => boolean;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: any;
}
export interface ValidationWarning {
    field: string;
    message: string;
    suggestion?: string;
}
export declare class TaskScheduler extends EventEmitter {
    private config;
    private requests;
    private responses;
    private metrics;
    private cache;
    private queue;
    private processing;
    private validationRules;
    private isInitialized;
    private isRunning;
    private shutdownRequested;
    constructor(config?: Partial<TaskSchedulerConfig>);
    private mergeConfig;
    private initializeMetrics;
    private setupEventHandlers;
    initialize(): Promise<void>;
    private validateConfiguration;
    private loadPersistedData;
    private setupConnections;
    private warmupCache;
    private registerValidationRules;
    private startMetricsCollection;
    private startProcessingLoop;
    submit(type: string, action: string, payload: any, options?: RequestOptions): Promise<string>;
    private validateRequest;
    private sortQueue;
    private processQueue;
    private processItem;
    private executeRequest;
    private processRequest;
    private createTimeout;
    private checkCache;
    private setCache;
    private getCacheKey;
    private compress;
    private decompress;
    private calculateSize;
    private evictCache;
    private updateSuccessMetrics;
    private updateErrorMetrics;
    private updateDurationMetrics;
    private updatePerformanceMetrics;
    private createErrorInfo;
    waitFor(requestId: string, timeout?: number): Promise<Response>;
    getMetrics(): Metrics;
    getStatus(): any;
    private generateId;
    private log;
    private handleError;
    private handleWarning;
    private onRequestSubmitted;
    private onRequestCompleted;
    private onRequestFailed;
    shutdown(): Promise<void>;
    private persistData;
}
export default TaskScheduler;
//# sourceMappingURL=TaskScheduler.d.ts.map