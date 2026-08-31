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

export class MemoryProfiler extends EventEmitter {
  private snapshots: Map<string, MemorySnapshot> = new Map();
  private gcActivities: GCActivity[] = [];
  private leaks: Map<string, MemoryLeak> = new Map();
  private monitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timer;

  constructor() {
    super();
  }

  /**
   * Take memory snapshot
   */
  public takeSnapshot(name?: string): MemorySnapshot {
    const memUsage = process.memoryUsage();

    const snapshot: MemorySnapshot = {
      id: `snapshot_${Date.now()}`,
      timestamp: new Date(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      objects: this.analyzeHeap(),
      statistics: {
        totalObjects: 0,
        totalSize: 0,
        largestObjects: [],
        leakSuspects: [],
        gcActivity: []
      }
    };

    this.calculateStatistics(snapshot);
    this.snapshots.set(snapshot.id, snapshot);
    this.emit('snapshot:taken', snapshot);

    return snapshot;
  }

  /**
   * Analyze heap (simulated)
   */
  private analyzeHeap(): ObjectInfo[] {
    const types = [
      'String',
      'Array',
      'Object',
      'Function',
      'Promise',
      'Map',
      'Set',
      'Buffer',
      'ArrayBuffer',
      'Uint8Array'
    ];

    return types.map(type => ({
      type,
      size: Math.floor(Math.random() * 1000000),
      count: Math.floor(Math.random() * 10000),
      retainedSize: Math.floor(Math.random() * 5000000),
      shallowSize: Math.floor(Math.random() * 100000)
    }));
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(snapshot: MemorySnapshot): void {
    snapshot.statistics.totalObjects = snapshot.objects.reduce((sum, o) => sum + o.count, 0);
    snapshot.statistics.totalSize = snapshot.objects.reduce((sum, o) => sum + o.size, 0);

    // Find largest objects
    snapshot.statistics.largestObjects = [...snapshot.objects]
      .sort((a, b) => b.retainedSize - a.retainedSize)
      .slice(0, 10);

    // Detect potential leaks
    snapshot.statistics.leakSuspects = this.detectLeaks(snapshot);

    // Get recent GC activity
    snapshot.statistics.gcActivity = this.gcActivities.slice(-10);
  }

  /**
   * Detect memory leaks
   */
  private detectLeaks(snapshot: MemorySnapshot): LeakSuspect[] {
    const suspects: LeakSuspect[] = [];
    const previousSnapshots = Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);

    if (previousSnapshots.length < 2) return suspects;

    for (const obj of snapshot.objects) {
      // Calculate growth rate
      const previousSizes = previousSnapshots.map(s =>
        s.objects.find(o => o.type === obj.type)?.size || 0
      );

      const avgPreviousSize = previousSizes.reduce((sum, s) => sum + s, 0) / previousSizes.length;
      const growth = obj.size - avgPreviousSize;
      const rate = avgPreviousSize > 0 ? (growth / avgPreviousSize) : 0;

      if (rate > 0.2 && growth > 100000) { // Growing more than 20% and > 100KB
        const severity: LeakSuspect['severity'] =
          rate > 0.5 ? 'critical' :
          rate > 0.4 ? 'high' :
          rate > 0.3 ? 'medium' : 'low';

        suspects.push({
          type: obj.type,
          growth,
          rate,
          severity,
          recommendation: this.getLeakRecommendation(obj.type, rate)
        });
      }
    }

    return suspects.sort((a, b) => b.rate - a.rate);
  }

  /**
   * Get leak recommendation
   */
  private getLeakRecommendation(type: string, rate: number): string {
    if (type === 'String' || type === 'Array') {
      return 'Check for accumulating data in arrays or string concatenation in loops';
    }
    if (type === 'Object') {
      return 'Review object lifecycle and ensure proper cleanup in event handlers';
    }
    if (type === 'Function') {
      return 'Check for closure memory leaks and ensure function references are cleared';
    }
    if (type === 'Promise') {
      return 'Ensure promises are properly resolved/rejected and not accumulating';
    }
    if (type === 'Buffer' || type === 'ArrayBuffer') {
      return 'Review buffer allocation and ensure buffers are released after use';
    }
    return 'Monitor this type for continued growth and investigate allocations';
  }

  /**
   * Compare snapshots
   */
  public compareSnapshots(snapshotId1: string, snapshotId2: string): HeapDiff {
    const snapshot1 = this.snapshots.get(snapshotId1);
    const snapshot2 = this.snapshots.get(snapshotId2);

    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both snapshots not found');
    }

    const diff: HeapDiff = {
      id: `diff_${Date.now()}`,
      snapshot1: snapshotId1,
      snapshot2: snapshotId2,
      duration: snapshot2.timestamp.getTime() - snapshot1.timestamp.getTime(),
      added: [],
      removed: [],
      changed: [],
      netGrowth: snapshot2.heapUsed - snapshot1.heapUsed
    };

    // Compare objects
    const types1 = new Set(snapshot1.objects.map(o => o.type));
    const types2 = new Set(snapshot2.objects.map(o => o.type));

    for (const type of types2) {
      const obj1 = snapshot1.objects.find(o => o.type === type);
      const obj2 = snapshot2.objects.find(o => o.type === type);

      if (!obj1) {
        diff.added.push(obj2!);
      } else if (obj2) {
        const sizeDiff = obj2.size - obj1.size;
        const countDiff = obj2.count - obj1.count;

        if (Math.abs(sizeDiff) > 10000 || Math.abs(countDiff) > 100) {
          diff.changed.push({
            type: obj2.type,
            size: sizeDiff,
            count: countDiff,
            retainedSize: obj2.retainedSize - obj1.retainedSize,
            shallowSize: obj2.shallowSize - obj1.shallowSize
          });
        }
      }
    }

    for (const type of types1) {
      if (!types2.has(type)) {
        const obj1 = snapshot1.objects.find(o => o.type === type);
        diff.removed.push(obj1!);
      }
    }

    this.emit('diff:created', diff);
    return diff;
  }

  /**
   * Track GC activity
   */
  public recordGC(type: 'minor' | 'major' | 'incremental', duration: number, freedMemory: number): void {
    const memUsage = process.memoryUsage();

    const activity: GCActivity = {
      timestamp: new Date(),
      type,
      duration,
      freedMemory,
      beforeSize: memUsage.heapUsed + freedMemory,
      afterSize: memUsage.heapUsed
    };

    this.gcActivities.push(activity);

    // Keep only last 100 activities
    if (this.gcActivities.length > 100) {
      this.gcActivities.shift();
    }

    this.emit('gc:recorded', activity);
  }

  /**
   * Start continuous monitoring
   */
  public startMonitoring(interval: number = 10000): void {
    if (this.monitoring) {
      throw new Error('Monitoring already active');
    }

    this.monitoring = true;
    this.monitoringInterval = setInterval(() => {
      const snapshot = this.takeSnapshot();

      // Check for leaks
      if (snapshot.statistics.leakSuspects.length > 0) {
        this.emit('leak:detected', snapshot.statistics.leakSuspects);
      }

      // Check memory usage
      const usagePercent = (snapshot.heapUsed / snapshot.heapTotal) * 100;
      if (usagePercent > 90) {
        this.emit('memory:critical', { snapshot, usagePercent });
      } else if (usagePercent > 80) {
        this.emit('memory:warning', { snapshot, usagePercent });
      }
    }, interval);

    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.monitoring = false;
    this.emit('monitoring:stopped');
  }

  /**
   * Analyze memory trend
   */
  public analyzeMemoryTrend(): any {
    const snapshots = Array.from(this.snapshots.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (snapshots.length < 2) {
      return { trend: 'insufficient_data' };
    }

    const heapUsages = snapshots.map(s => s.heapUsed);
    const timePoints = snapshots.map(s => s.timestamp.getTime());

    // Calculate linear regression
    const n = heapUsages.length;
    const sumX = timePoints.reduce((sum, t) => sum + t, 0);
    const sumY = heapUsages.reduce((sum, h) => sum + h, 0);
    const sumXY = timePoints.reduce((sum, t, i) => sum + t * heapUsages[i], 0);
    const sumX2 = timePoints.reduce((sum, t) => sum + t * t, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Determine trend
    const avgHeap = sumY / n;
    const slopePercent = (slope / avgHeap) * 3600000; // Per hour

    const trend = slopePercent > 5 ? 'increasing' :
                  slopePercent < -5 ? 'decreasing' : 'stable';

    // Calculate R-squared
    const yMean = avgHeap;
    const ssTotal = heapUsages.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = heapUsages.reduce((sum, y, i) =>
      sum + Math.pow(y - (slope * timePoints[i] + intercept), 2), 0
    );
    const rSquared = 1 - (ssResidual / ssTotal);

    return {
      trend,
      slope,
      slopePercent,
      rSquared,
      currentHeap: heapUsages[heapUsages.length - 1],
      avgHeap,
      minHeap: Math.min(...heapUsages),
      maxHeap: Math.max(...heapUsages),
      volatility: this.calculateStdDev(heapUsages) / avgHeap
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Generate memory report
   */
  public generateReport(): string {
    const latestSnapshot = Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!latestSnapshot) {
      return 'No snapshots available';
    }

    const trend = this.analyzeMemoryTrend();

    let report = '=== Memory Profile Report ===\n\n';
    report += `Timestamp: ${latestSnapshot.timestamp.toISOString()}\n`;
    report += `Heap Used: ${this.formatBytes(latestSnapshot.heapUsed)}\n`;
    report += `Heap Total: ${this.formatBytes(latestSnapshot.heapTotal)}\n`;
    report += `Usage: ${((latestSnapshot.heapUsed / latestSnapshot.heapTotal) * 100).toFixed(1)}%\n`;
    report += `External: ${this.formatBytes(latestSnapshot.external)}\n\n`;

    report += '=== Memory Trend ===\n';
    report += `Trend: ${trend.trend}\n`;
    report += `Growth Rate: ${trend.slopePercent?.toFixed(2)}% per hour\n`;
    report += `Volatility: ${(trend.volatility * 100)?.toFixed(1)}%\n\n`;

    if (latestSnapshot.statistics.leakSuspects.length > 0) {
      report += '=== Potential Memory Leaks ===\n';
      for (const suspect of latestSnapshot.statistics.leakSuspects.slice(0, 5)) {
        report += `\n${suspect.type} [${suspect.severity.toUpperCase()}]\n`;
        report += `  Growth: ${this.formatBytes(suspect.growth)} (${(suspect.rate * 100).toFixed(1)}%)\n`;
        report += `  Recommendation: ${suspect.recommendation}\n`;
      }
      report += '\n';
    }

    report += '=== Largest Objects ===\n';
    for (const obj of latestSnapshot.statistics.largestObjects.slice(0, 5)) {
      report += `${obj.type}: ${this.formatBytes(obj.retainedSize)} (${obj.count} instances)\n`;
    }
    report += '\n';

    if (this.gcActivities.length > 0) {
      const recentGC = this.gcActivities.slice(-10);
      const avgGCDuration = recentGC.reduce((sum, gc) => sum + gc.duration, 0) / recentGC.length;
      const totalFreed = recentGC.reduce((sum, gc) => sum + gc.freedMemory, 0);

      report += '=== GC Activity (Last 10) ===\n';
      report += `Average Duration: ${avgGCDuration.toFixed(2)}ms\n`;
      report += `Total Memory Freed: ${this.formatBytes(totalFreed)}\n`;
      report += `Major GCs: ${recentGC.filter(gc => gc.type === 'major').length}\n`;
      report += `Minor GCs: ${recentGC.filter(gc => gc.type === 'minor').length}\n`;
    }

    return report;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Export snapshot as JSON
   */
  public exportSnapshot(snapshotId: string): string {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) throw new Error(`Snapshot ${snapshotId} not found`);

    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Force garbage collection (if available)
   */
  public forceGC(): boolean {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = before - after;

      this.recordGC('major', 0, freed);
      this.emit('gc:forced', { freed });
      return true;
    }

    return false;
  }

  /**
   * Get snapshot
   */
  public getSnapshot(snapshotId: string): MemorySnapshot | null {
    return this.snapshots.get(snapshotId) || null;
  }

  /**
   * List snapshots
   */
  public listSnapshots(): MemorySnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Delete snapshot
   */
  public deleteSnapshot(snapshotId: string): void {
    this.snapshots.delete(snapshotId);
  }

  /**
   * Clear all snapshots
   */
  public clearSnapshots(): void {
    this.snapshots.clear();
    this.emit('snapshots:cleared');
  }
}

export default MemoryProfiler;
