"use strict";
/**
 * Performance Profiling System
 * CPU profiling, memory profiling, flame graphs, and performance analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMonitor = exports.performanceBenchmarker = exports.heapProfiler = exports.memoryProfiler = exports.cpuProfiler = exports.PerformanceMonitor = exports.PerformanceBenchmarker = exports.HeapProfiler = exports.MemoryProfiler = exports.CPUProfiler = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * CPU Profiler
 */
class CPUProfiler {
    sessions = new Map();
    activeSessionId;
    sampleInterval = 10; // milliseconds
    /**
     * Start CPU profiling
     */
    startProfiling(name) {
        const session = {
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
        EventBus_1.eventBus.emitSync('profiler.cpu_started', session, 'CPUProfiler');
        return session;
    }
    /**
     * Stop CPU profiling
     */
    stopProfiling(sessionId) {
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
        EventBus_1.eventBus.emitSync('profiler.cpu_stopped', session, 'CPUProfiler');
        return session;
    }
    /**
     * Analyze CPU profile
     */
    analyzeProfile(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        session.status = 'analyzing';
        const analysis = {
            sessionId,
            totalSamples: session.samples.length,
            duration: session.duration || 0,
            hotSpots: this.findHotSpots(session),
            flameGraph: this.buildFlameGraph(session),
            callTree: this.buildCallTree(session),
        };
        EventBus_1.eventBus.emitSync('profiler.analysis_completed', analysis, 'CPUProfiler');
        return analysis;
    }
    /**
     * Get profiling session
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * List all sessions
     */
    listSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Start sampling
     */
    startSampling(session) {
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
    captureSample() {
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
    captureStackTrace() {
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
    findHotSpots(session) {
        const functionCounts = new Map();
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
        const hotSpots = [];
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
    buildFlameGraph(session) {
        const root = {
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
    addToFlameGraph(node, stack, value) {
        if (stack.length === 0)
            return;
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
    buildCallTree(session) {
        const root = {
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
    addToCallTree(node, stack, time) {
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
    generateSessionId() {
        return `cpu_profile_${Date.now()}`;
    }
}
exports.CPUProfiler = CPUProfiler;
/**
 * Memory Profiler
 */
class MemoryProfiler {
    snapshots = new Map();
    /**
     * Take memory snapshot
     */
    takeSnapshot(name) {
        const memUsage = process.memoryUsage();
        const snapshot = {
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
        EventBus_1.eventBus.emitSync('profiler.snapshot_taken', snapshot, 'MemoryProfiler');
        return snapshot;
    }
    /**
     * Compare two snapshots
     */
    compareSnapshots(snapshot1Id, snapshot2Id) {
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
    findLeaks(snapshotIds) {
        const leaks = [];
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
    getSnapshot(snapshotId) {
        return this.snapshots.get(snapshotId);
    }
    /**
     * List snapshots
     */
    listSnapshots() {
        return Array.from(this.snapshots.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Format bytes
     */
    formatBytes(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    generateSnapshotId() {
        return `snapshot_${Date.now()}`;
    }
}
exports.MemoryProfiler = MemoryProfiler;
/**
 * Heap Profiler
 */
class HeapProfiler {
    /**
     * Start heap profiling
     */
    startProfiling() {
        const sessionId = `heap_profile_${Date.now()}`;
        EventBus_1.eventBus.emitSync('profiler.heap_started', { sessionId }, 'HeapProfiler');
        return sessionId;
    }
    /**
     * Stop heap profiling
     */
    stopProfiling(sessionId) {
        const profile = {
            sessionId,
            allocations: this.collectAllocations(),
            deallocations: this.collectDeallocations(),
            liveObjects: this.collectLiveObjects(),
        };
        EventBus_1.eventBus.emitSync('profiler.heap_stopped', profile, 'HeapProfiler');
        return profile;
    }
    /**
     * Collect allocations
     */
    collectAllocations() {
        // Mock implementation
        return [];
    }
    /**
     * Collect deallocations
     */
    collectDeallocations() {
        return 0;
    }
    /**
     * Collect live objects
     */
    collectLiveObjects() {
        // Mock implementation
        return [
            { type: 'String', count: 1000, size: 50000 },
            { type: 'Array', count: 500, size: 100000 },
            { type: 'Object', count: 800, size: 150000 },
        ];
    }
}
exports.HeapProfiler = HeapProfiler;
/**
 * Performance Benchmarker
 */
class PerformanceBenchmarker {
    benchmarks = new Map();
    /**
     * Run benchmark
     */
    async runBenchmark(name, fn, options) {
        const iterations = options?.iterations || 1000;
        const warmup = options?.warmup || 100;
        // Warmup
        for (let i = 0; i < warmup; i++) {
            await fn();
        }
        // Measure
        const times = [];
        const memoryBefore = process.memoryUsage().heapUsed;
        for (let i = 0; i < iterations; i++) {
            const start = process.hrtime.bigint();
            await fn();
            const end = process.hrtime.bigint();
            times.push(Number(end - start) / 1e6); // Convert to milliseconds
        }
        const memoryAfter = process.memoryUsage().heapUsed;
        const result = {
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
        const benchmark = {
            id: this.generateBenchmarkId(),
            name,
            result,
            timestamp: new Date(),
        };
        this.benchmarks.set(benchmark.id, benchmark);
        EventBus_1.eventBus.emitSync('profiler.benchmark_completed', benchmark, 'PerformanceBenchmarker');
        return result;
    }
    /**
     * Compare benchmarks
     */
    compareBenchmarks(id1, id2) {
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
    getBenchmark(id) {
        return this.benchmarks.get(id);
    }
    /**
     * List benchmarks
     */
    listBenchmarks() {
        return Array.from(this.benchmarks.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    mean(values) {
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    median(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }
    standardDeviation(values) {
        const avg = this.mean(values);
        const squareDiffs = values.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(this.mean(squareDiffs));
    }
    generateBenchmarkId() {
        return `benchmark_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.PerformanceBenchmarker = PerformanceBenchmarker;
/**
 * Performance Monitor
 */
class PerformanceMonitor {
    metrics = new Map();
    /**
     * Record metric
     */
    record(name, value, tags) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        this.metrics.get(name).push({
            timestamp: Date.now(),
            value,
            tags,
        });
        // Keep only last 1000 metrics per name
        const metrics = this.metrics.get(name);
        if (metrics.length > 1000) {
            this.metrics.set(name, metrics.slice(-1000));
        }
    }
    /**
     * Get metrics
     */
    getMetrics(name, since) {
        const metrics = this.metrics.get(name) || [];
        if (since) {
            return metrics.filter(m => m.timestamp >= since);
        }
        return metrics;
    }
    /**
     * Get statistics
     */
    getStats(name) {
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
    clear(name) {
        if (name) {
            this.metrics.delete(name);
        }
        else {
            this.metrics.clear();
        }
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
/**
 * Singleton instances
 */
exports.cpuProfiler = new CPUProfiler();
exports.memoryProfiler = new MemoryProfiler();
exports.heapProfiler = new HeapProfiler();
exports.performanceBenchmarker = new PerformanceBenchmarker();
exports.performanceMonitor = new PerformanceMonitor();
