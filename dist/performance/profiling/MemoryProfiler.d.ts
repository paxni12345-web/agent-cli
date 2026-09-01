/**
 * MemoryProfiler - Memory leak detection and heap analysis
 * Heap snapshots, garbage collection analysis, and memory optimization
 */
import { EventEmitter } from 'events';
export interface MemorySnapshot {
    id: string;
    timestamp: Date;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    objects: ObjectInfo[];
    statistics: MemoryStatistics;
}
export interface ObjectInfo {
    type: string;
    size: number;
    count: number;
    retainedSize: number;
    shallowSize: number;
}
export interface MemoryStatistics {
    totalObjects: number;
    totalSize: number;
    largestObjects: ObjectInfo[];
    leakSuspects: LeakSuspect[];
    gcActivity: GCActivity[];
}
export interface LeakSuspect {
    type: string;
    growth: number;
    rate: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
}
export interface GCActivity {
    timestamp: Date;
    type: 'minor' | 'major' | 'incremental';
    duration: number;
    freedMemory: number;
    beforeSize: number;
    afterSize: number;
}
export interface MemoryLeak {
    id: string;
    type: string;
    detected: Date;
    growthRate: number;
    estimatedLeakSize: number;
    stackTraces: string[][];
    confidence: number;
}
export interface HeapDiff {
    id: string;
    snapshot1: string;
    snapshot2: string;
    duration: number;
    added: ObjectInfo[];
    removed: ObjectInfo[];
    changed: ObjectInfo[];
    netGrowth: number;
}
export declare class MemoryProfiler extends EventEmitter {
    private snapshots;
    private gcActivities;
    private leaks;
    private monitoring;
    private monitoringInterval?;
    constructor();
    /**
     * Take memory snapshot
     */
    takeSnapshot(name?: string): MemorySnapshot;
    /**
     * Analyze heap (simulated)
     */
    private analyzeHeap;
    /**
     * Calculate statistics
     */
    private calculateStatistics;
    /**
     * Detect memory leaks
     */
    private detectLeaks;
    /**
     * Get leak recommendation
     */
    private getLeakRecommendation;
    /**
     * Compare snapshots
     */
    compareSnapshots(snapshotId1: string, snapshotId2: string): HeapDiff;
    /**
     * Track GC activity
     */
    recordGC(type: 'minor' | 'major' | 'incremental', duration: number, freedMemory: number): void;
    /**
     * Start continuous monitoring
     */
    startMonitoring(interval?: number): void;
    /**
     * Stop monitoring
     */
    stopMonitoring(): void;
    /**
     * Analyze memory trend
     */
    analyzeMemoryTrend(): any;
    /**
     * Calculate standard deviation
     */
    private calculateStdDev;
    /**
     * Generate memory report
     */
    generateReport(): string;
    /**
     * Format bytes to human readable
     */
    private formatBytes;
    /**
     * Export snapshot as JSON
     */
    exportSnapshot(snapshotId: string): string;
    /**
     * Force garbage collection (if available)
     */
    forceGC(): boolean;
    /**
     * Get snapshot
     */
    getSnapshot(snapshotId: string): MemorySnapshot | null;
    /**
     * List snapshots
     */
    listSnapshots(): MemorySnapshot[];
    /**
     * Delete snapshot
     */
    deleteSnapshot(snapshotId: string): void;
    /**
     * Clear all snapshots
     */
    clearSnapshots(): void;
}
export default MemoryProfiler;
//# sourceMappingURL=MemoryProfiler.d.ts.map