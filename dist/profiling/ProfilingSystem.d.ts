/**
 * Performance Profiling System
 * CPU profiling, memory profiling, flame graphs, and performance analysis
 */
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
export declare class CPUProfiler {
    private sessions;
    private activeSessionId?;
    private sampleInterval;
    /**
     * Start CPU profiling
     */
    startProfiling(name: string): ProfileSession;
    /**
     * Stop CPU profiling
     */
    stopProfiling(sessionId?: string): ProfileSession;
    /**
     * Analyze CPU profile
     */
    analyzeProfile(sessionId: string): CPUProfileAnalysis;
    /**
     * Get profiling session
     */
    getSession(sessionId: string): ProfileSession | undefined;
    /**
     * List all sessions
     */
    listSessions(): ProfileSession[];
    /**
     * Start sampling
     */
    private startSampling;
    /**
     * Capture single sample
     */
    private captureSample;
    /**
     * Capture stack trace
     */
    private captureStackTrace;
    /**
     * Find hot spots
     */
    private findHotSpots;
    /**
     * Build flame graph
     */
    private buildFlameGraph;
    /**
     * Add stack trace to flame graph
     */
    private addToFlameGraph;
    /**
     * Build call tree
     */
    private buildCallTree;
    /**
     * Add stack trace to call tree
     */
    private addToCallTree;
    private generateSessionId;
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
export declare class MemoryProfiler {
    private snapshots;
    /**
     * Take memory snapshot
     */
    takeSnapshot(name?: string): MemorySnapshot;
    /**
     * Compare two snapshots
     */
    compareSnapshots(snapshot1Id: string, snapshot2Id: string): MemoryComparison;
    /**
     * Find memory leaks
     */
    findLeaks(snapshotIds: string[]): MemoryLeak[];
    /**
     * Get snapshot
     */
    getSnapshot(snapshotId: string): MemorySnapshot | undefined;
    /**
     * List snapshots
     */
    listSnapshots(): MemorySnapshot[];
    /**
     * Format bytes
     */
    private formatBytes;
    private generateSnapshotId;
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
export declare class HeapProfiler {
    /**
     * Start heap profiling
     */
    startProfiling(): string;
    /**
     * Stop heap profiling
     */
    stopProfiling(sessionId: string): HeapProfile;
    /**
     * Collect allocations
     */
    private collectAllocations;
    /**
     * Collect deallocations
     */
    private collectDeallocations;
    /**
     * Collect live objects
     */
    private collectLiveObjects;
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
export declare class PerformanceBenchmarker {
    private benchmarks;
    /**
     * Run benchmark
     */
    runBenchmark(name: string, fn: () => void | Promise<void>, options?: {
        iterations?: number;
        warmup?: number;
    }): Promise<BenchmarkResult>;
    /**
     * Compare benchmarks
     */
    compareBenchmarks(id1: string, id2: string): BenchmarkComparison;
    /**
     * Get benchmark
     */
    getBenchmark(id: string): Benchmark | undefined;
    /**
     * List benchmarks
     */
    listBenchmarks(): Benchmark[];
    private mean;
    private median;
    private standardDeviation;
    private generateBenchmarkId;
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
export declare class PerformanceMonitor {
    private metrics;
    /**
     * Record metric
     */
    record(name: string, value: number, tags?: Record<string, string>): void;
    /**
     * Get metrics
     */
    getMetrics(name: string, since?: number): PerformanceMetric[];
    /**
     * Get statistics
     */
    getStats(name: string): MetricStats | null;
    /**
     * Clear metrics
     */
    clear(name?: string): void;
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
export declare const cpuProfiler: CPUProfiler;
export declare const memoryProfiler: MemoryProfiler;
export declare const heapProfiler: HeapProfiler;
export declare const performanceBenchmarker: PerformanceBenchmarker;
export declare const performanceMonitor: PerformanceMonitor;
export {};
//# sourceMappingURL=ProfilingSystem.d.ts.map