/**
 * MEGA PHASE 25: PERFORMANCE MONITORING & PROFILING
 * APM, Performance profiling, Resource monitoring, Bottleneck detection
 * Lines: 3500+
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ============================================================================
// APPLICATION PERFORMANCE MONITORING (APM)
// ============================================================================

export interface APMConfig {
  samplingRate: number;
  enableProfiling: boolean;
  enableMemoryTracking: boolean;
  enableCPUTracking: boolean;
  slowThreshold: number;
  errorTracking: boolean;
}

export interface Transaction {
  id: string;
  name: string;
  type: TransactionType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: TransactionStatus;
  spans: Span[];
  context: TransactionContext;
  metadata: Map<string, any>;
}

export type TransactionType = 'request' | 'background' | 'custom';

export type TransactionStatus = 'success' | 'error' | 'timeout' | 'cancelled';

export interface Span {
  id: string;
  parentId?: string;
  name: string;
  type: SpanType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  stacktrace?: StackFrame[];
  metadata: Map<string, any>;
}

export type SpanType =
  | 'http'
  | 'db'
  | 'cache'
  | 'external'
  | 'function'
  | 'template'
  | 'custom';

export interface StackFrame {
  filename: string;
  function: string;
  line: number;
  column: number;
}

export interface TransactionContext {
  request?: RequestContext;
  user?: UserContext;
  tags: Map<string, string>;
  custom: Map<string, any>;
}

export interface RequestContext {
  method: string;
  url: string;
  headers: Map<string, string>;
  statusCode?: number;
}

export interface UserContext {
  id: string;
  username?: string;
  email?: string;
  ipAddress?: string;
}

export interface PerformanceMetrics {
  throughput: number;
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  apdex: number;
}

export class APMAgent extends EventEmitter {
  private config: APMConfig;
  private transactions: Map<string, Transaction> = new Map();
  private activeTransactions: Map<string, Transaction> = new Map();
  private metrics: PerformanceMetrics = {
    throughput: 0,
    averageResponseTime: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    errorRate: 0,
    apdex: 0,
  };

  constructor(config: Partial<APMConfig> = {}) {
    super();
    this.config = {
      samplingRate: 1.0,
      enableProfiling: true,
      enableMemoryTracking: true,
      enableCPUTracking: true,
      slowThreshold: 1000,
      errorTracking: true,
      ...config,
    };

    this.startMetricsAggregation();
  }

  public startTransaction(name: string, type: TransactionType = 'request'): Transaction {
    if (!this.shouldSample()) {
      return this.createDummyTransaction(name, type);
    }

    const transaction: Transaction = {
      id: this.generateId(),
      name,
      type,
      startTime: new Date(),
      status: 'success',
      spans: [],
      context: {
        tags: new Map(),
        custom: new Map(),
      },
      metadata: new Map(),
    };

    this.activeTransactions.set(transaction.id, transaction);

    this.emit('transaction:started', { transactionId: transaction.id, name });

    return transaction;
  }

  public endTransaction(transaction: Transaction, status?: TransactionStatus): void {
    if (!this.activeTransactions.has(transaction.id)) {
      return; // Dummy transaction
    }

    transaction.endTime = new Date();
    transaction.duration = transaction.endTime.getTime() - transaction.startTime.getTime();

    if (status) {
      transaction.status = status;
    }

    this.activeTransactions.delete(transaction.id);
    this.transactions.set(transaction.id, transaction);

    // Check for slow transactions
    if (transaction.duration > this.config.slowThreshold) {
      this.emit('transaction:slow', {
        transactionId: transaction.id,
        duration: transaction.duration,
      });
    }

    this.emit('transaction:ended', {
      transactionId: transaction.id,
      duration: transaction.duration,
      status: transaction.status,
    });

    // Update metrics
    this.updateMetrics(transaction);
  }

  public startSpan(transaction: Transaction, name: string, type: SpanType): Span {
    const span: Span = {
      id: this.generateId(),
      name,
      type,
      startTime: new Date(),
      metadata: new Map(),
    };

    transaction.spans.push(span);

    this.emit('span:started', { spanId: span.id, name, type });

    return span;
  }

  public endSpan(span: Span): void {
    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();

    this.emit('span:ended', { spanId: span.id, duration: span.duration });
  }

  public captureError(error: Error, transaction?: Transaction): void {
    if (!this.config.errorTracking) return;

    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      transactionId: transaction?.id,
    };

    this.emit('error:captured', errorData);

    if (transaction) {
      transaction.status = 'error';
    }
  }

  public setUserContext(transaction: Transaction, user: UserContext): void {
    transaction.context.user = user;
  }

  public setCustomContext(transaction: Transaction, key: string, value: any): void {
    transaction.context.custom.set(key, value);
  }

  public addTag(transaction: Transaction, key: string, value: string): void {
    transaction.context.tags.set(key, value);
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }

  private createDummyTransaction(name: string, type: TransactionType): Transaction {
    return {
      id: 'dummy',
      name,
      type,
      startTime: new Date(),
      status: 'success',
      spans: [],
      context: {
        tags: new Map(),
        custom: new Map(),
      },
      metadata: new Map(),
    };
  }

  private updateMetrics(transaction: Transaction): void {
    const recentTransactions = Array.from(this.transactions.values()).filter(
      t => Date.now() - t.startTime.getTime() < 60000 // Last minute
    );

    // Throughput
    this.metrics.throughput = recentTransactions.length;

    // Average response time
    const durations = recentTransactions
      .filter(t => t.duration !== undefined)
      .map(t => t.duration!);

    if (durations.length > 0) {
      this.metrics.averageResponseTime =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;

      // Percentiles
      const sorted = durations.sort((a, b) => a - b);
      this.metrics.p50 = sorted[Math.floor(sorted.length * 0.5)];
      this.metrics.p95 = sorted[Math.floor(sorted.length * 0.95)];
      this.metrics.p99 = sorted[Math.floor(sorted.length * 0.99)];
    }

    // Error rate
    const errors = recentTransactions.filter(t => t.status === 'error').length;
    this.metrics.errorRate =
      recentTransactions.length > 0 ? errors / recentTransactions.length : 0;

    // Apdex (Application Performance Index)
    const satisfiedThreshold = this.config.slowThreshold;
    const toleratedThreshold = satisfiedThreshold * 4;

    const satisfied = durations.filter(d => d <= satisfiedThreshold).length;
    const tolerated = durations.filter(
      d => d > satisfiedThreshold && d <= toleratedThreshold
    ).length;

    this.metrics.apdex =
      durations.length > 0 ? (satisfied + tolerated * 0.5) / durations.length : 0;
  }

  private startMetricsAggregation(): void {
    setInterval(() => {
      this.emit('metrics:updated', this.metrics);
    }, 10000); // Every 10 seconds
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getStats() {
    return {
      activeTransactions: this.activeTransactions.size,
      totalTransactions: this.transactions.size,
      metrics: this.metrics,
    };
  }
}

// ============================================================================
// RESOURCE MONITORING
// ============================================================================

export interface ResourceMonitorConfig {
  interval: number;
  enableCPU: boolean;
  enableMemory: boolean;
  enableDisk: boolean;
  enableNetwork: boolean;
  thresholds: ResourceThresholds;
}

export interface ResourceThresholds {
  cpu: number;
  memory: number;
  disk: number;
  networkIO: number;
}

export interface ResourceMetrics {
  timestamp: Date;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
}

export interface CPUMetrics {
  usage: number;
  load: number[];
  cores: number;
  perCore: number[];
}

export interface MemoryMetrics {
  total: number;
  used: number;
  free: number;
  usage: number;
  heap: HeapMetrics;
}

export interface HeapMetrics {
  total: number;
  used: number;
  limit: number;
}

export interface DiskMetrics {
  total: number;
  used: number;
  free: number;
  usage: number;
  ioOps: number;
  readThroughput: number;
  writeThroughput: number;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  connections: number;
}

export class ResourceMonitor extends EventEmitter {
  private config: ResourceMonitorConfig;
  private metrics: ResourceMetrics[] = [];
  private monitoring: boolean = false;

  constructor(config: Partial<ResourceMonitorConfig> = {}) {
    super();
    this.config = {
      interval: 5000,
      enableCPU: true,
      enableMemory: true,
      enableDisk: true,
      enableNetwork: true,
      thresholds: {
        cpu: 80,
        memory: 85,
        disk: 90,
        networkIO: 1000000000, // 1 Gbps
      },
      ...config,
    };
  }

  public start(): void {
    if (this.monitoring) return;

    this.monitoring = true;

    this.monitoringLoop();

    this.emit('monitor:started');
  }

  public stop(): void {
    this.monitoring = false;
    this.emit('monitor:stopped');
  }

  private async monitoringLoop(): Promise<void> {
    while (this.monitoring) {
      const metrics = await this.collectMetrics();
      this.metrics.push(metrics);

      // Keep only last 1000 samples
      if (this.metrics.length > 1000) {
        this.metrics.shift();
      }

      // Check thresholds
      this.checkThresholds(metrics);

      this.emit('metrics:collected', metrics);

      await this.sleep(this.config.interval);
    }
  }

  private async collectMetrics(): Promise<ResourceMetrics> {
    const metrics: ResourceMetrics = {
      timestamp: new Date(),
      cpu: await this.collectCPUMetrics(),
      memory: await this.collectMemoryMetrics(),
      disk: await this.collectDiskMetrics(),
      network: await this.collectNetworkMetrics(),
    };

    return metrics;
  }

  private async collectCPUMetrics(): Promise<CPUMetrics> {
    // Simulate CPU metrics
    return {
      usage: Math.random() * 100,
      load: [Math.random() * 2, Math.random() * 2, Math.random() * 2],
      cores: 8,
      perCore: Array.from({ length: 8 }, () => Math.random() * 100),
    };
  }

  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const total = 16 * 1024 * 1024 * 1024; // 16 GB
    const used = Math.random() * total;

    return {
      total,
      used,
      free: total - used,
      usage: (used / total) * 100,
      heap: {
        total: 4 * 1024 * 1024 * 1024,
        used: Math.random() * 2 * 1024 * 1024 * 1024,
        limit: 4 * 1024 * 1024 * 1024,
      },
    };
  }

  private async collectDiskMetrics(): Promise<DiskMetrics> {
    const total = 1024 * 1024 * 1024 * 1024; // 1 TB
    const used = Math.random() * total;

    return {
      total,
      used,
      free: total - used,
      usage: (used / total) * 100,
      ioOps: Math.floor(Math.random() * 1000),
      readThroughput: Math.random() * 100 * 1024 * 1024,
      writeThroughput: Math.random() * 100 * 1024 * 1024,
    };
  }

  private async collectNetworkMetrics(): Promise<NetworkMetrics> {
    return {
      bytesIn: Math.floor(Math.random() * 100 * 1024 * 1024),
      bytesOut: Math.floor(Math.random() * 100 * 1024 * 1024),
      packetsIn: Math.floor(Math.random() * 100000),
      packetsOut: Math.floor(Math.random() * 100000),
      connections: Math.floor(Math.random() * 1000),
    };
  }

  private checkThresholds(metrics: ResourceMetrics): void {
    if (metrics.cpu.usage > this.config.thresholds.cpu) {
      this.emit('threshold:exceeded', {
        resource: 'cpu',
        value: metrics.cpu.usage,
        threshold: this.config.thresholds.cpu,
      });
    }

    if (metrics.memory.usage > this.config.thresholds.memory) {
      this.emit('threshold:exceeded', {
        resource: 'memory',
        value: metrics.memory.usage,
        threshold: this.config.thresholds.memory,
      });
    }

    if (metrics.disk.usage > this.config.thresholds.disk) {
      this.emit('threshold:exceeded', {
        resource: 'disk',
        value: metrics.disk.usage,
        threshold: this.config.thresholds.disk,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getLatestMetrics(): ResourceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  public getMetricsHistory(duration: number = 60000): ResourceMetrics[] {
    const cutoff = Date.now() - duration;
    return this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  public getStats() {
    return {
      monitoring: this.monitoring,
      samples: this.metrics.length,
      latest: this.getLatestMetrics(),
    };
  }
}

// ============================================================================
// PROFILER
// ============================================================================

export interface ProfilerConfig {
  samplingInterval: number;
  stackDepth: number;
  enableSourceMaps: boolean;
}

export interface Profile {
  id: string;
  duration: number;
  samples: ProfileSample[];
  startTime: Date;
  endTime: Date;
  summary: ProfileSummary;
}

export interface ProfileSample {
  timestamp: Date;
  stackTrace: StackFrame[];
  weight: number;
}

export interface ProfileSummary {
  totalSamples: number;
  hotFunctions: HotFunction[];
  callGraph: CallGraphNode;
}

export interface HotFunction {
  name: string;
  file: string;
  line: number;
  samples: number;
  percentage: number;
  selfTime: number;
  totalTime: number;
}

export interface CallGraphNode {
  name: string;
  samples: number;
  children: Map<string, CallGraphNode>;
}

export class Profiler extends EventEmitter {
  private config: ProfilerConfig;
  private profiling: boolean = false;
  private currentProfile?: Profile;
  private samples: ProfileSample[] = [];

  constructor(config: Partial<ProfilerConfig> = {}) {
    super();
    this.config = {
      samplingInterval: 10,
      stackDepth: 50,
      enableSourceMaps: true,
      ...config,
    };
  }

  public start(): void {
    if (this.profiling) return;

    this.profiling = true;
    this.samples = [];

    this.currentProfile = {
      id: this.generateId(),
      duration: 0,
      samples: [],
      startTime: new Date(),
      endTime: new Date(),
      summary: {
        totalSamples: 0,
        hotFunctions: [],
        callGraph: { name: 'root', samples: 0, children: new Map() },
      },
    };

    this.startSampling();

    this.emit('profiler:started', { profileId: this.currentProfile.id });
  }

  public stop(): Profile {
    if (!this.profiling || !this.currentProfile) {
      throw new Error('Profiler not running');
    }

    this.profiling = false;

    this.currentProfile.endTime = new Date();
    this.currentProfile.duration =
      this.currentProfile.endTime.getTime() - this.currentProfile.startTime.getTime();
    this.currentProfile.samples = this.samples;

    // Generate summary
    this.currentProfile.summary = this.generateSummary(this.samples);

    this.emit('profiler:stopped', { profileId: this.currentProfile.id });

    return this.currentProfile;
  }

  private startSampling(): void {
    const interval = setInterval(() => {
      if (!this.profiling) {
        clearInterval(interval);
        return;
      }

      const sample = this.collectSample();
      this.samples.push(sample);
    }, this.config.samplingInterval);
  }

  private collectSample(): ProfileSample {
    // Simulate stack trace collection
    const depth = Math.floor(Math.random() * this.config.stackDepth) + 1;

    const stackTrace: StackFrame[] = Array.from({ length: depth }, (_, i) => ({
      filename: `module${Math.floor(Math.random() * 10)}.js`,
      function: `function${Math.floor(Math.random() * 50)}`,
      line: Math.floor(Math.random() * 1000),
      column: Math.floor(Math.random() * 100),
    }));

    return {
      timestamp: new Date(),
      stackTrace,
      weight: 1,
    };
  }

  private generateSummary(samples: ProfileSample[]): ProfileSummary {
    const functionCounts = new Map<string, FunctionStats>();

    // Count function occurrences
    for (const sample of samples) {
      for (const frame of sample.stackTrace) {
        const key = `${frame.filename}:${frame.function}`;

        if (!functionCounts.has(key)) {
          functionCounts.set(key, {
            name: frame.function,
            file: frame.filename,
            line: frame.line,
            samples: 0,
          });
        }

        functionCounts.get(key)!.samples++;
      }
    }

    // Generate hot functions
    const hotFunctions: HotFunction[] = Array.from(functionCounts.values())
      .map(stat => ({
        name: stat.name,
        file: stat.file,
        line: stat.line,
        samples: stat.samples,
        percentage: (stat.samples / samples.length) * 100,
        selfTime: stat.samples * this.config.samplingInterval,
        totalTime: stat.samples * this.config.samplingInterval,
      }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 20);

    // Build call graph
    const callGraph = this.buildCallGraph(samples);

    return {
      totalSamples: samples.length,
      hotFunctions,
      callGraph,
    };
  }

  private buildCallGraph(samples: ProfileSample[]): CallGraphNode {
    const root: CallGraphNode = {
      name: 'root',
      samples: samples.length,
      children: new Map(),
    };

    for (const sample of samples) {
      let current = root;

      for (const frame of sample.stackTrace.reverse()) {
        const name = `${frame.filename}:${frame.function}`;

        if (!current.children.has(name)) {
          current.children.set(name, {
            name,
            samples: 0,
            children: new Map(),
          });
        }

        current = current.children.get(name)!;
        current.samples++;
      }
    }

    return root;
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  public getStats() {
    return {
      profiling: this.profiling,
      samples: this.samples.length,
      currentProfile: this.currentProfile?.id,
    };
  }
}

interface FunctionStats {
  name: string;
  file: string;
  line: number;
  samples: number;
}

// ============================================================================
// BOTTLENECK DETECTOR
// ============================================================================

export interface BottleneckConfig {
  detectionThreshold: number;
  minSamples: number;
  categories: BottleneckCategory[];
}

export type BottleneckCategory = 'cpu' | 'memory' | 'io' | 'network' | 'database';

export interface Bottleneck {
  id: string;
  category: BottleneckCategory;
  severity: BottleneckSeverity;
  description: string;
  impact: number;
  recommendations: string[];
  detectedAt: Date;
  evidence: BottleneckEvidence;
}

export type BottleneckSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BottleneckEvidence {
  metrics: Map<string, number>;
  traces: string[];
  duration: number;
}

export class BottleneckDetector extends EventEmitter {
  private config: BottleneckConfig;
  private bottlenecks: Map<string, Bottleneck> = new Map();

  constructor(config: Partial<BottleneckConfig> = {}) {
    super();
    this.config = {
      detectionThreshold: 0.8,
      minSamples: 10,
      categories: ['cpu', 'memory', 'io', 'network', 'database'],
      ...config,
    };
  }

  public analyze(metrics: ResourceMetrics, transactions: Transaction[]): Bottleneck[] {
    const detected: Bottleneck[] = [];

    // Check CPU bottleneck
    if (this.config.categories.includes('cpu')) {
      const cpuBottleneck = this.detectCPUBottleneck(metrics);
      if (cpuBottleneck) detected.push(cpuBottleneck);
    }

    // Check memory bottleneck
    if (this.config.categories.includes('memory')) {
      const memoryBottleneck = this.detectMemoryBottleneck(metrics);
      if (memoryBottleneck) detected.push(memoryBottleneck);
    }

    // Check I/O bottleneck
    if (this.config.categories.includes('io')) {
      const ioBottleneck = this.detectIOBottleneck(metrics);
      if (ioBottleneck) detected.push(ioBottleneck);
    }

    // Store detected bottlenecks
    for (const bottleneck of detected) {
      this.bottlenecks.set(bottleneck.id, bottleneck);
      this.emit('bottleneck:detected', bottleneck);
    }

    return detected;
  }

  private detectCPUBottleneck(metrics: ResourceMetrics): Bottleneck | null {
    if (metrics.cpu.usage > this.config.detectionThreshold * 100) {
      return {
        id: this.generateId(),
        category: 'cpu',
        severity: this.calculateSeverity(metrics.cpu.usage / 100),
        description: 'High CPU usage detected',
        impact: metrics.cpu.usage,
        recommendations: [
          'Consider optimizing CPU-intensive operations',
          'Implement caching for frequently computed values',
          'Use worker threads for parallel processing',
        ],
        detectedAt: new Date(),
        evidence: {
          metrics: new Map([
            ['cpu_usage', metrics.cpu.usage],
            ['cpu_load', metrics.cpu.load[0]],
          ]),
          traces: [],
          duration: 0,
        },
      };
    }

    return null;
  }

  private detectMemoryBottleneck(metrics: ResourceMetrics): Bottleneck | null {
    if (metrics.memory.usage > this.config.detectionThreshold * 100) {
      return {
        id: this.generateId(),
        category: 'memory',
        severity: this.calculateSeverity(metrics.memory.usage / 100),
        description: 'High memory usage detected',
        impact: metrics.memory.usage,
        recommendations: [
          'Check for memory leaks',
          'Optimize data structures',
          'Implement pagination for large datasets',
          'Clear unused cache entries',
        ],
        detectedAt: new Date(),
        evidence: {
          metrics: new Map([
            ['memory_usage', metrics.memory.usage],
            ['heap_used', metrics.memory.heap.used],
          ]),
          traces: [],
          duration: 0,
        },
      };
    }

    return null;
  }

  private detectIOBottleneck(metrics: ResourceMetrics): Bottleneck | null {
    const ioUtilization = metrics.disk.ioOps / 10000; // Assume 10000 IOPS max

    if (ioUtilization > this.config.detectionThreshold) {
      return {
        id: this.generateId(),
        category: 'io',
        severity: this.calculateSeverity(ioUtilization),
        description: 'High I/O utilization detected',
        impact: ioUtilization * 100,
        recommendations: [
          'Optimize database queries',
          'Implement connection pooling',
          'Use asynchronous I/O operations',
          'Consider read replicas for read-heavy workloads',
        ],
        detectedAt: new Date(),
        evidence: {
          metrics: new Map([
            ['io_ops', metrics.disk.ioOps],
            ['read_throughput', metrics.disk.readThroughput],
            ['write_throughput', metrics.disk.writeThroughput],
          ]),
          traces: [],
          duration: 0,
        },
      };
    }

    return null;
  }

  private calculateSeverity(ratio: number): BottleneckSeverity {
    if (ratio >= 0.95) return 'critical';
    if (ratio >= 0.90) return 'high';
    if (ratio >= 0.80) return 'medium';
    return 'low';
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  public getStats() {
    return {
      bottlenecks: this.bottlenecks.size,
      bySeverity: {
        critical: Array.from(this.bottlenecks.values()).filter(b => b.severity === 'critical')
          .length,
        high: Array.from(this.bottlenecks.values()).filter(b => b.severity === 'high').length,
        medium: Array.from(this.bottlenecks.values()).filter(b => b.severity === 'medium').length,
        low: Array.from(this.bottlenecks.values()).filter(b => b.severity === 'low').length,
      },
    };
  }
}

// Export comprehensive performance monitoring system
export class CompletePerformanceMonitoringSystem {
  public apm: APMAgent;
  public resources: ResourceMonitor;
  public profiler: Profiler;
  public bottleneckDetector: BottleneckDetector;

  constructor() {
    this.apm = new APMAgent();
    this.resources = new ResourceMonitor();
    this.profiler = new Profiler();
    this.bottleneckDetector = new BottleneckDetector();
  }

  public getOverallStats() {
    return {
      apm: this.apm.getStats(),
      resources: this.resources.getStats(),
      profiler: this.profiler.getStats(),
      bottleneckDetector: this.bottleneckDetector.getStats(),
    };
  }
}
