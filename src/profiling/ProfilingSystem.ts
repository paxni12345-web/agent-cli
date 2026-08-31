/**
 * Performance Profiling System
 * CPU profiling, memory profiling, flame graphs, and performance analysis
 */

import { eventBus } from '../core/EventBus';

export interface ProfileSession {
  id: string;
  name: string;
  type: 'cpu' | 'memory' | 'heap' | 'allocation';
  status: 'recording' | 'stopped' | 'analyzing';
  startedAt: Date;
  stoppedAt?: Date;
  duration?: number;
  samples: ProfileSample[];
  metadata?: Record<string, any>;
}

export interface ProfileSample {
  timestamp: number;
  stackTrace: string[];
  cpuUsage?: number;
  memoryUsage?: number;
  heapUsed?: number;
  heapTotal?: number;
}

export interface CPUProfile {
  samples: number[];
  timestamps: number[];
  startTime: number;
  endTime: number;
  nodes: CPUProfileNode[];
}

export interface CPUProfileNode {
  id: number;
  functionName: string;
  scriptId: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
  hitCount: number;
  children: number[];
  parent?: number;
}

export interface MemorySnapshot {
  id: string;
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

export interface MemoryNode {
  id: number;
  type: string;
  name: string;
  size: number;
  edgeCount: number;
}

export interface MemoryEdge {
  type: string;
  name: string;
  from: number;
  to: number;
}

export interface FlameGraphNode {
  name: string;
  value: number;
  children: FlameGraphNode[];
  color?: string;
}

export interface HotSpot {
  functionName: string;
  file: string;
  line: number;
  selfTime: number;
  totalTime: number;
  calls: number;
  percentage: number;
}

/**
 * CPU Profiler
 */
export class CPUProfiler {
  private sessions: Map<string, ProfileSession> = new Map();
  private activeSessionId?: string;
  private sampleInterval = 10; // milliseconds

  /**
   * Start CPU profiling
   */
  startProfiling(name: string): ProfileSession {
    const session: ProfileSession = {
      id: this.generateSessionId(),
      name,
      type: 'cpu',
      status: 'recording',
      startedAt: new Date(),
      samples: [],
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    // Start sampling
    this.startSampling(session);

    eventBus.emitSync('profiler.cpu_started', session, 'CPUProfiler');

    return session;
  }

  /**
   * Stop CPU profiling
   */
  stopProfiling(sessionId?: string): ProfileSession {
    const id = sessionId || this.activeSessionId;

    if (!id) {
      throw new Error('No active profiling session');
    }

    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    session.status = 'stopped';
    session.stoppedAt = new Date();
    session.duration = session.stoppedAt.getTime() - session.startedAt.getTime();

    if (this.activeSessionId === id) {
      this.activeSessionId = undefined;
    }

    eventBus.emitSync('profiler.cpu_stopped', session, 'CPUProfiler');

    return session;
  }

  /**
   * Analyze CPU profile
   */
  analyzeProfile(sessionId: string): CPUProfileAnalysis {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'analyzing';

    const analysis: CPUProfileAnalysis = {
      sessionId,
      totalSamples: session.samples.length,
      duration: session.duration || 0,
      hotSpots: this.findHotSpots(session),
      flameGraph: this.buildFlameGraph(session),
      callTree: this.buildCallTree(session),
    };

    eventBus.emitSync('profiler.analysis_completed', analysis, 'CPUProfiler');

    return analysis;
  }

  /**
   * Get profiling session
   */
  getSession(sessionId: string): ProfileSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(): ProfileSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Start sampling
   */
  private startSampling(session: ProfileSession): void {
    const interval = setInterval(() => {
      if (session.status !== 'recording') {
        clearInterval(interval);
        return;
      }

      const sample = this.captureSample();
      session.samples.push(sample);
    }, this.sampleInterval);
  }

  /**
   * Capture single sample
   */
  private captureSample(): ProfileSample {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: Date.now(),
      stackTrace: this.captureStackTrace(),
      cpuUsage: cpuUsage.user + cpuUsage.system,
      memoryUsage: memUsage.heapUsed,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
    };
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): string[] {
    const stack = new Error().stack || '';
    return stack
      .split('\n')
      .slice(3) // Skip Error, captureSample, and this function
      .map(line => line.trim())
      .filter(line => line.startsWith('at '));
  }

  /**
   * Find hot spots
   */
  private findHotSpots(session: ProfileSession): HotSpot[] {
    const functionCounts = new Map<string, { count: number; time: number }>();

    for (const sample of session.samples) {
      for (const frame of sample.stackTrace) {
        const match = frame.match(/at\s+(.+?)\s+\(/);
        const functionName = match ? match[1] : 'anonymous';

        const current = functionCounts.get(functionName) || { count: 0, time: 0 };
        current.count++;
        current.time += this.sampleInterval;

        functionCounts.set(functionName, current);
      }
    }

    const totalTime = session.duration || 1;
    const hotSpots: HotSpot[] = [];

    for (const [functionName, stats] of functionCounts.entries()) {
      hotSpots.push({
        functionName,
        file: 'unknown',
        line: 0,
        selfTime: stats.time,
        totalTime: stats.time,
        calls: stats.count,
        percentage: (stats.time / totalTime) * 100,
      });
    }

    return hotSpots.sort((a, b) => b.totalTime - a.totalTime).slice(0, 20);
  }

  /**
   * Build flame graph
   */
  private buildFlameGraph(session: ProfileSession): FlameGraphNode {
    const root: FlameGraphNode = {
      name: 'root',
      value: session.samples.length,
      children: [],
    };

    for (const sample of session.samples) {
      this.addToFlameGraph(root, sample.stackTrace.reverse(), 1);
    }

    return root;
  }

  /**
   * Add stack trace to flame graph
   */
  private addToFlameGraph(node: FlameGraphNode, stack: string[], value: number): void {
    if (stack.length === 0) return;

    const frame = stack[0];
    const match = frame.match(/at\s+(.+?)\s+\(/);
    const name = match ? match[1] : 'anonymous';

    let child = node.children.find(c => c.name === name);

    if (!child) {
      child = {
        name,
        value: 0,
        children: [],
      };
      node.children.push(child);
    }

    child.value += value;

    this.addToFlameGraph(child, stack.slice(1), value);
  }

  /**
   * Build call tree
   */
  private buildCallTree(session: ProfileSession): CallTreeNode {
    const root: CallTreeNode = {
      name: 'root',
      selfTime: 0,
      totalTime: session.duration || 0,
      calls: 1,
      children: [],
    };

    for (const sample of session.samples) {
      this.addToCallTree(root, sample.stackTrace.reverse(), this.sampleInterval);
    }

    return root;
  }

  /**
   * Add stack trace to call tree
   */
  private addToCallTree(node: CallTreeNode, stack: string[], time: number): void {
    if (stack.length === 0) {
      node.selfTime += time;
      return;
    }

    const frame = stack[0];
    const match = frame.match(/at\s+(.+?)\s+\(/);
    const name = match ? match[1] : 'anonymous';

    let child = node.children.find(c => c.name === name);

    if (!child) {
      child = {
        name,
        selfTime: 0,
        totalTime: 0,
        calls: 0,
        children: [],
      };
      node.children.push(child);
    }

    child.calls++;
    child.totalTime += time;

    this.addToCallTree(child, stack.slice(1), time);
  }

  private generateSessionId(): string {
    return `cpu_profile_${Date.now()}`;
  }
}

interface CPUProfileAnalysis {
  sessionId: string;
  totalSamples: number;
  duration: number;
  hotSpots: HotSpot[];
  flameGraph: FlameGraphNode;
  callTree: CallTreeNode;
}

interface CallTreeNode {
  name: string;
  selfTime: number;
  totalTime: number;
  calls: number;
  children: CallTreeNode[];
}

/**
 * Memory Profiler
 */
export class MemoryProfiler {
  private snapshots: Map<string, MemorySnapshot> = new Map();

  /**
   * Take memory snapshot
   */
  takeSnapshot(name?: string): MemorySnapshot {
    const memUsage = process.memoryUsage();

    const snapshot: MemorySnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      nodes: [],
      edges: [],
    };

    this.snapshots.set(snapshot.id, snapshot);

    eventBus.emitSync('profiler.snapshot_taken', snapshot, 'MemoryProfiler');

    return snapshot;
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(
    snapshot1Id: string,
    snapshot2Id: string
  ): MemoryComparison {
    const snapshot1 = this.snapshots.get(snapshot1Id);
    const snapshot2 = this.snapshots.get(snapshot2Id);

    if (!snapshot1 || !snapshot2) {
      throw new Error('Snapshot not found');
    }

    return {
      heapGrowth: snapshot2.heapUsed - snapshot1.heapUsed,
      heapGrowthPercentage: ((snapshot2.heapUsed - snapshot1.heapUsed) / snapshot1.heapUsed) * 100,
      timeDiff: snapshot2.timestamp.getTime() - snapshot1.timestamp.getTime(),
      snapshot1: snapshot1Id,
      snapshot2: snapshot2Id,
    };
  }

  /**
   * Find memory leaks
   */
  findLeaks(snapshotIds: string[]): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    if (snapshotIds.length < 2) {
      return leaks;
    }

    // Simple leak detection: objects that grow consistently
    for (let i = 1; i < snapshotIds.length; i++) {
      const comparison = this.compareSnapshots(snapshotIds[i - 1], snapshotIds[i]);

      if (comparison.heapGrowth > 1024 * 1024) { // 1MB
        leaks.push({
          type: 'heap_growth',
          description: `Heap grew by ${this.formatBytes(comparison.heapGrowth)}`,
          growth: comparison.heapGrowth,
          snapshot1: snapshotIds[i - 1],
          snapshot2: snapshotIds[i],
        });
      }
    }

    return leaks;
  }

  /**
   * Get snapshot
   */
  getSnapshot(snapshotId: string): MemorySnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * List snapshots
   */
  listSnapshots(): MemorySnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}`;
  }
}

interface MemoryComparison {
  heapGrowth: number;
  heapGrowthPercentage: number;
  timeDiff: number;
  snapshot1: string;
  snapshot2: string;
}

interface MemoryLeak {
  type: string;
  description: string;
  growth: number;
  snapshot1: string;
  snapshot2: string;
}

/**
 * Heap Profiler
 */
export class HeapProfiler {
  /**
   * Start heap profiling
   */
  startProfiling(): string {
    const sessionId = `heap_profile_${Date.now()}`;
    eventBus.emitSync('profiler.heap_started', { sessionId }, 'HeapProfiler');
    return sessionId;
  }

  /**
   * Stop heap profiling
   */
  stopProfiling(sessionId: string): HeapProfile {
    const profile: HeapProfile = {
      sessionId,
      allocations: this.collectAllocations(),
      deallocations: this.collectDeallocations(),
      liveObjects: this.collectLiveObjects(),
    };

    eventBus.emitSync('profiler.heap_stopped', profile, 'HeapProfiler');

    return profile;
  }

  /**
   * Collect allocations
   */
  private collectAllocations(): AllocationSite[] {
    // Mock implementation
    return [];
  }

  /**
   * Collect deallocations
   */
  private collectDeallocations(): number {
    return 0;
  }

  /**
   * Collect live objects
   */
  private collectLiveObjects(): ObjectStats[] {
    // Mock implementation
    return [
      { type: 'String', count: 1000, size: 50000 },
      { type: 'Array', count: 500, size: 100000 },
      { type: 'Object', count: 800, size: 150000 },
    ];
  }
}

interface HeapProfile {
  sessionId: string;
  allocations: AllocationSite[];
  deallocations: number;
  liveObjects: ObjectStats[];
}

interface AllocationSite {
  location: string;
  size: number;
  count: number;
}

interface ObjectStats {
  type: string;
  count: number;
  size: number;
}

/**
 * Performance Benchmarker
 */
export class PerformanceBenchmarker {
  private benchmarks: Map<string, Benchmark> = new Map();

  /**
   * Run benchmark
   */
  async runBenchmark(
    name: string,
    fn: () => void | Promise<void>,
    options?: {
      iterations?: number;
      warmup?: number;
    }
  ): Promise<BenchmarkResult> {
    const iterations = options?.iterations || 1000;
    const warmup = options?.warmup || 100;

    // Warmup
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // Measure
    const times: number[] = [];
    const memoryBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();

      times.push(Number(end - start) / 1e6); // Convert to milliseconds
    }

    const memoryAfter = process.memoryUsage().heapUsed;

    const result: BenchmarkResult = {
      name,
      iterations,
      times,
      mean: this.mean(times),
      median: this.median(times),
      min: Math.min(...times),
      max: Math.max(...times),
      stdDev: this.standardDeviation(times),
      opsPerSecond: 1000 / this.mean(times),
      memoryDelta: memoryAfter - memoryBefore,
    };

    const benchmark: Benchmark = {
      id: this.generateBenchmarkId(),
      name,
      result,
      timestamp: new Date(),
    };

    this.benchmarks.set(benchmark.id, benchmark);

    eventBus.emitSync('profiler.benchmark_completed', benchmark, 'PerformanceBenchmarker');

    return result;
  }

  /**
   * Compare benchmarks
   */
  compareBenchmarks(id1: string, id2: string): BenchmarkComparison {
    const bench1 = this.benchmarks.get(id1);
    const bench2 = this.benchmarks.get(id2);

    if (!bench1 || !bench2) {
      throw new Error('Benchmark not found');
    }

    const speedup = bench1.result.mean / bench2.result.mean;

    return {
      benchmark1: id1,
      benchmark2: id2,
      speedup,
      faster: speedup > 1 ? id2 : id1,
      timeDiff: bench1.result.mean - bench2.result.mean,
      percentDiff: ((bench2.result.mean - bench1.result.mean) / bench1.result.mean) * 100,
    };
  }

  /**
   * Get benchmark
   */
  getBenchmark(id: string): Benchmark | undefined {
    return this.benchmarks.get(id);
  }

  /**
   * List benchmarks
   */
  listBenchmarks(): Benchmark[] {
    return Array.from(this.benchmarks.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private mean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private standardDeviation(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  private generateBenchmarkId(): string {
    return `benchmark_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

interface Benchmark {
  id: string;
  name: string;
  result: BenchmarkResult;
  timestamp: Date;
}

interface BenchmarkResult {
  name: string;
  iterations: number;
  times: number[];
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  opsPerSecond: number;
  memoryDelta: number;
}

interface BenchmarkComparison {
  benchmark1: string;
  benchmark2: string;
  speedup: number;
  faster: string;
  timeDiff: number;
  percentDiff: number;
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();

  /**
   * Record metric
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Keep only last 1000 metrics per name
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 1000) {
      this.metrics.set(name, metrics.slice(-1000));
    }
  }

  /**
   * Get metrics
   */
  getMetrics(name: string, since?: number): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || [];

    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }

    return metrics;
  }

  /**
   * Get statistics
   */
  getStats(name: string): MetricStats | null {
    const metrics = this.metrics.get(name);

    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value);

    return {
      count: values.length,
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
    };
  }

  /**
   * Clear metrics
   */
  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

interface PerformanceMetric {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

interface MetricStats {
  count: number;
  mean: number;
  min: number;
  max: number;
  latest: number;
}

/**
 * Singleton instances
 */
export const cpuProfiler = new CPUProfiler();
export const memoryProfiler = new MemoryProfiler();
export const heapProfiler = new HeapProfiler();
export const performanceBenchmarker = new PerformanceBenchmarker();
export const performanceMonitor = new PerformanceMonitor();
