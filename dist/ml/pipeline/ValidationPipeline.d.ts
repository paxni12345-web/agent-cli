/**
 * ValidationPipeline - Production-ready implementation
 * Full-featured with comprehensive error handling and validation
 */
import { EventEmitter } from 'events';
export interface Config {
    enabled: boolean;
    timeout: number;
    retries: number;
    batchSize: number;
    concurrency: number;
    debug: boolean;
}
export interface Request {
    id: string;
    type: string;
    payload: any;
    priority: number;
    timestamp: Date;
    metadata: Record<string, any>;
}
export interface Response {
    id: string;
    requestId: string;
    status: 'success' | 'error' | 'timeout';
    data: any;
    error?: Error;
    duration: number;
    timestamp: Date;
}
export interface Metrics {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    throughput: number;
    errorRate: number;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: string[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
export interface CacheEntry {
    key: string;
    value: any;
    ttl: number;
    createdAt: Date;
    hits: number;
}
export interface QueueItem {
    id: string;
    data: any;
    priority: number;
    addedAt: Date;
    attempts: number;
}
export declare class ValidationPipeline extends EventEmitter {
    private config;
    private requests;
    private responses;
    private metrics;
    private cache;
    private queue;
    private processing;
    private isRunning;
    constructor(config?: Partial<Config>);
    private initializeMetrics;
    initialize(): Promise<void>;
    private loadConfiguration;
    private setupConnections;
    private warmupCache;
    private startProcessing;
    submit(type: string, payload: any, priority?: number): Promise<string>;
    private sortQueue;
    private processQueue;
    private processItem;
    private execute;
    private validate;
    private validatePayload;
    private process;
    private checkCache;
    private setCache;
    private getCacheKey;
    private evictCache;
    private updateMetrics;
    waitFor(requestId: string, timeout?: number): Promise<Response>;
    getMetrics(): Metrics;
    getStatus(): any;
    private generateId;
    private log;
    shutdown(): Promise<void>;
}
export default ValidationPipeline;
//# sourceMappingURL=ValidationPipeline.d.ts.map