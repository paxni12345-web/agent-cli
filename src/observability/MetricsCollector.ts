/**
 * MetricsCollector - Metrics collection system
 * Enterprise-grade implementation with full features
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MetricsCollectorConfig {
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

// ============================================================================
// MAIN CLASS IMPLEMENTATION
// ============================================================================

export class MetricsCollector extends EventEmitter {
  private config: MetricsCollectorConfig;
  private requests: Map<string, Request> = new Map();
  private responses: Map<string, Response> = new Map();
  private metrics: Metrics;
  private cache: Map<string, CacheEntry> = new Map();
  private queue: QueueItem[] = [];
  private processing: Map<string, Promise<any>> = new Map();
  private validationRules: ValidationRule[] = [];
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private shutdownRequested: boolean = false;

  constructor(config?: Partial<MetricsCollectorConfig>) {
    super();
    this.config = this.mergeConfig(config);
    this.metrics = this.initializeMetrics();
    this.setupEventHandlers();
  }

  private mergeConfig(config?: Partial<MetricsCollectorConfig>): MetricsCollectorConfig {
    return {
      enabled: true,
      mode: 'production',
      timeout: 30000,
      retries: 3,
      batchSize: 100,
      concurrency: 10,
      cacheEnabled: true,
      cacheTTL: 3600000,
      compressionEnabled: true,
      encryptionEnabled: false,
      debug: false,
      logLevel: 'info',
      metricsEnabled: true,
      metricsInterval: 10000,
      ...config
    };
  }

  private initializeMetrics(): Metrics {
    return {
      requests: {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        rate: 0
      },
      responses: {
        successful: 0,
        failed: 0,
        timedOut: 0,
        avgDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictions: 0
      },
      queue: {
        size: 0,
        avgWaitTime: 0,
        maxWaitTime: 0,
        throughput: 0
      },
      errors: {
        total: 0,
        byType: new Map(),
        byCode: new Map(),
        rate: 0
      },
      performance: {
        cpu: 0,
        memory: 0,
        latency: 0,
        throughput: 0
      }
    };
  }

  private setupEventHandlers(): void {
    this.on('error', this.handleError.bind(this));
    this.on('warning', this.handleWarning.bind(this));
    this.on('request:submitted', this.onRequestSubmitted.bind(this));
    this.on('request:completed', this.onRequestCompleted.bind(this));
    this.on('request:failed', this.onRequestFailed.bind(this));
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Already initialized');
    }

    if (!this.config.enabled) {
      throw new Error('System is disabled in configuration');
    }

    this.log('info', 'Initializing MetricsCollector...');

    await this.validateConfiguration();
    await this.loadPersistedData();
    await this.setupConnections();
    await this.warmupCache();
    await this.registerValidationRules();
    
    if (this.config.metricsEnabled) {
      this.startMetricsCollection();
    }

    this.isInitialized = true;
    this.isRunning = true;
    
    this.startProcessingLoop();
    
    this.emit('initialized');
    this.log('info', 'MetricsCollector initialized successfully');
  }

  private async validateConfiguration(): Promise<void> {
    if (this.config.timeout <= 0) {
      throw new Error('timeout must be positive');
    }
    if (this.config.concurrency <= 0) {
      throw new Error('concurrency must be positive');
    }
    this.log('debug', 'Configuration validated');
  }

  private async loadPersistedData(): Promise<void> {
    this.log('debug', 'Loading persisted data...');
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async setupConnections(): Promise<void> {
    this.log('debug', 'Setting up connections...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async warmupCache(): Promise<void> {
    if (!this.config.cacheEnabled) return;
    this.log('debug', 'Warming up cache...');
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async registerValidationRules(): Promise<void> {
    this.validationRules = [
      {
        field: 'type',
        type: 'required',
        message: 'Request type is required'
      },
      {
        field: 'payload',
        type: 'required',
        message: 'Request payload is required'
      }
    ];
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updatePerformanceMetrics();
      this.emit('metrics:updated', this.metrics);
    }, this.config.metricsInterval);
  }

  private startProcessingLoop(): void {
    setInterval(() => {
      if (this.isRunning && !this.shutdownRequested) {
        this.processQueue().catch(error => {
          this.log('error', `Queue processing error: ${error.message}`);
        });
      }
    }, 100);
  }

  public async submit(type: string, action: string, payload: any, options?: RequestOptions): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('System not initialized');
    }

    if (!this.isRunning) {
      throw new Error('System not running');
    }

    const request: Request = {
      id: this.generateId(),
      type,
      action,
      payload,
      priority: options?.priority || 1,
      timestamp: new Date(),
      metadata: {},
      options
    };

    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.requests.set(request.id, request);
    this.metrics.requests.total++;
    this.metrics.requests.pending++;

    const queueItem: QueueItem = {
      id: this.generateId(),
      request,
      priority: request.priority,
      addedAt: new Date(),
      attempts: 0
    };

    this.queue.push(queueItem);
    this.sortQueue();
    this.metrics.queue.size = this.queue.length;

    this.emit('request:submitted', request);
    this.log('debug', `Request ${request.id} submitted`);

    return request.id;
  }

  private validateRequest(request: Request): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const rule of this.validationRules) {
      const value = (request as any)[rule.field];

      if (rule.type === 'required' && (value === undefined || value === null)) {
        errors.push({
          field: rule.field,
          message: rule.message,
          code: 'REQUIRED_FIELD',
          value
        });
      }

      if (rule.validator && !rule.validator(value)) {
        errors.push({
          field: rule.field,
          message: rule.message,
          code: 'VALIDATION_FAILED',
          value
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.addedAt.getTime() - b.addedAt.getTime();
    });
  }

  private async processQueue(): Promise<void> {
    const available = this.config.concurrency - this.processing.size;
    if (available <= 0 || this.queue.length === 0) {
      return;
    }

    const toProcess = this.queue.splice(0, Math.min(available, this.queue.length));
    this.metrics.queue.size = this.queue.length;

    for (const item of toProcess) {
      const promise = this.processItem(item);
      this.processing.set(item.id, promise);
      
      promise.finally(() => {
        this.processing.delete(item.id);
      });
    }
  }

  private async processItem(item: QueueItem): Promise<void> {
    const request = item.request;
    const startTime = Date.now();
    const queueTime = startTime - item.addedAt.getTime();

    this.metrics.requests.pending--;
    this.metrics.requests.processing++;

    try {
      const result = await this.executeRequest(request);

      const response: Response = {
        id: this.generateId(),
        requestId: request.id,
        status: 'success',
        data: result,
        duration: Date.now() - startTime,
        cached: false,
        timestamp: new Date(),
        metadata: {
          processingTime: Date.now() - startTime,
          queueTime,
          cacheHit: false,
          retryCount: item.attempts
        }
      };

      this.responses.set(response.id, response);
      this.updateSuccessMetrics(response);
      this.emit('request:completed', { request, response });

    } catch (error) {
      const response: Response = {
        id: this.generateId(),
        requestId: request.id,
        status: 'error',
        data: null,
        error: this.createErrorInfo(error),
        duration: Date.now() - startTime,
        cached: false,
        timestamp: new Date(),
        metadata: {
          processingTime: Date.now() - startTime,
          queueTime,
          cacheHit: false,
          retryCount: item.attempts
        }
      };

      this.responses.set(response.id, response);
      this.updateErrorMetrics(response);

      if (item.attempts < this.config.retries && response.error?.retryable) {
        item.attempts++;
        item.nextRetry = new Date(Date.now() + Math.pow(2, item.attempts) * 1000);
        this.queue.push(item);
        this.emit('request:retry', { request, attempt: item.attempts });
      } else {
        this.emit('request:failed', { request, response });
      }
    } finally {
      this.metrics.requests.processing--;
    }
  }

  private async executeRequest(request: Request): Promise<any> {
    if (this.config.cacheEnabled && !request.options?.skipCache) {
      const cached = this.checkCache(request);
      if (cached !== null) {
        this.metrics.cache.hits++;
        return cached;
      }
      this.metrics.cache.misses++;
    }

    const timeout = request.options?.timeout || this.config.timeout;
    const result = await Promise.race([
      this.processRequest(request),
      this.createTimeout(timeout)
    ]);

    if (this.config.cacheEnabled) {
      this.setCache(request, result);
    }

    return result;
  }

  private async processRequest(request: Request): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    return {
      processed: true,
      requestId: request.id,
      type: request.type,
      action: request.action,
      timestamp: new Date(),
      result: request.payload
    };
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });
  }

  private checkCache(request: Request): any {
    const key = request.options?.cacheKey || this.getCacheKey(request);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const age = Date.now() - entry.createdAt.getTime();
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.accessedAt = new Date();
    entry.hits++;

    return this.config.compressionEnabled 
      ? this.decompress(entry.value)
      : entry.value;
  }

  private setCache(request: Request, value: any): void {
    const key = request.options?.cacheKey || this.getCacheKey(request);
    
    const processedValue = this.config.compressionEnabled
      ? this.compress(value)
      : value;

    const entry: CacheEntry = {
      key,
      value: processedValue,
      ttl: this.config.cacheTTL,
      createdAt: new Date(),
      accessedAt: new Date(),
      hits: 0,
      size: this.calculateSize(processedValue),
      compressed: this.config.compressionEnabled,
      encrypted: this.config.encryptionEnabled
    };

    this.cache.set(key, entry);
    this.metrics.cache.size = this.cache.size;

    if (this.cache.size > 10000) {
      this.evictCache();
    }
  }

  private getCacheKey(request: Request): string {
    return crypto.createHash('md5')
      .update(JSON.stringify({
        type: request.type,
        action: request.action,
        payload: request.payload
      }))
      .digest('hex');
  }

  private compress(value: any): string {
    return Buffer.from(JSON.stringify(value)).toString('base64');
  }

  private decompress(value: string): any {
    return JSON.parse(Buffer.from(value, 'base64').toString());
  }

  private calculateSize(value: any): number {
    return Buffer.byteLength(JSON.stringify(value));
  }

  private evictCache(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => {
        const scoreA = a[1].hits / (Date.now() - a[1].createdAt.getTime());
        const scoreB = b[1].hits / (Date.now() - b[1].createdAt.getTime());
        return scoreA - scoreB;
      });

    const toRemove = Math.floor(this.cache.size * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
      this.metrics.cache.evictions++;
    }

    this.metrics.cache.size = this.cache.size;
  }

  private updateSuccessMetrics(response: Response): void {
    this.metrics.requests.completed++;
    this.metrics.responses.successful++;
    this.updateDurationMetrics(response.duration);
  }

  private updateErrorMetrics(response: Response): void {
    this.metrics.requests.failed++;
    this.metrics.responses.failed++;
    this.metrics.errors.total++;

    if (response.error) {
      const code = response.error.code;
      this.metrics.errors.byCode.set(code, (this.metrics.errors.byCode.get(code) || 0) + 1);
    }
  }

  private updateDurationMetrics(duration: number): void {
    const n = this.metrics.responses.successful;
    this.metrics.responses.avgDuration = 
      (this.metrics.responses.avgDuration * (n - 1) + duration) / n;
  }

  private updatePerformanceMetrics(): void {
    const used = process.memoryUsage();
    this.metrics.performance.memory = used.heapUsed / used.heapTotal;
    this.metrics.performance.cpu = process.cpuUsage().user / 1000000;
  }

  private createErrorInfo(error: any): ErrorInfo {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error.details,
      stack: error.stack,
      retryable: error.retryable !== false
    };
  }

  public async waitFor(requestId: string, timeout?: number): Promise<Response> {
    const maxWait = timeout || this.config.timeout;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const response = Array.from(this.responses.values())
        .find(r => r.requestId === requestId);

      if (response) {
        return response;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for request ${requestId}`);
  }

  public getMetrics(): Metrics {
    this.metrics.cache.hitRate = this.metrics.cache.hits + this.metrics.cache.misses > 0
      ? this.metrics.cache.hits / (this.metrics.cache.hits + this.metrics.cache.misses)
      : 0;

    this.metrics.errors.rate = this.metrics.requests.total > 0
      ? this.metrics.errors.total / this.metrics.requests.total
      : 0;

    return JSON.parse(JSON.stringify(this.metrics));
  }

  public getStatus(): any {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      shuttingDown: this.shutdownRequested,
      queueSize: this.queue.length,
      processing: this.processing.size,
      cacheSize: this.cache.size,
      metrics: this.getMetrics()
    };
  }

  private generateId(): string {
    return `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      if (this.config.debug) {
        console.log(`[${level.toUpperCase()}] [MetricsCollector] ${message}`);
      }
      this.emit('log', { level, message, timestamp: new Date() });
    }
  }

  private handleError(error: Error): void {
    this.log('error', `Error: ${error.message}`);
  }

  private handleWarning(warning: any): void {
    this.log('warn', `Warning: ${warning}`);
  }

  private onRequestSubmitted(request: Request): void {
    this.log('debug', `Request submitted: ${request.id}`);
  }

  private onRequestCompleted(data: any): void {
    this.log('debug', `Request completed: ${data.request.id}`);
  }

  private onRequestFailed(data: any): void {
    this.log('warn', `Request failed: ${data.request.id}`);
  }

  public async shutdown(): Promise<void> {
    if (this.shutdownRequested) {
      return;
    }

    this.log('info', 'Initiating shutdown...');
    this.shutdownRequested = true;
    this.isRunning = false;

    const timeout = 30000;
    const startTime = Date.now();

    while (this.processing.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.processing.size > 0) {
      this.log('warn', `Forcefully terminating ${this.processing.size} requests`);
    }

    await this.persistData();
    this.cache.clear();
    this.queue = [];
    this.isInitialized = false;

    this.emit('shutdown');
    this.log('info', 'Shutdown complete');
  }

  private async persistData(): Promise<void> {
    this.log('debug', 'Persisting data...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

export default MetricsCollector;
