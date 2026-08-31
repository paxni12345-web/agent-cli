/**
 * CPUProfiler - Advanced CPU profiling and optimization
 * Flame graphs, hotspot detection, and performance optimization suggestions
 */

import { EventEmitter } from 'events';

export interface ProfilingSession {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  samples: Sample[];
  flamegraph: FlameGraphNode;
  hotspots: Hotspot[];
  statistics: ProfilingStatistics;
}

export interface Sample {
  timestamp: number;
  stackTrace: StackFrame[];
  cpuUsage: number;
  threadId: string;
}

export interface StackFrame {
  function: string;
  file: string;
  line: number;
  column: number;
  selfTime: number;
  totalTime: number;
}

export interface FlameGraphNode {
  name: string;
  value: number;
  children: FlameGraphNode[];
  percentage: number;
  file?: string;
  line?: number;
}

export interface Hotspot {
  function: string;
  file: string;
  line: number;
  selfTime: number;
  totalTime: number;
  callCount: number;
  avgTimePerCall: number;
  percentage: number;
  recommendation?: string;
}

export interface ProfilingStatistics {
  totalSamples: number;
  totalTime: number;
  avgCpuUsage: number;
  peakCpuUsage: number;
  functionCalls: number;
  uniqueFunctions: number;
}

export interface OptimizationSuggestion {
  type: 'algorithm' | 'caching' | 'async' | 'memory' | 'io';
  priority: 'low' | 'medium' | 'high' | 'critical';
  function: string;
  description: string;
  impact: string;
  implementation: string;
}

export class CPUProfiler extends EventEmitter {
  private sessions: Map<string, ProfilingSession> = new Map();
  private activeSessions: Map<string, NodeJS.Timer> = new Map();
  private samplingInterval: number = 10; // ms

  constructor(samplingInterval: number = 10) {
    super();
    this.samplingInterval = samplingInterval;
  }

  /**
   * Start profiling session
   */
  public startProfiling(name: string): string {
    const sessionId = `profile_${Date.now()}`;

    const session: ProfilingSession = {
      id: sessionId,
      name,
      startTime: new Date(),
      duration: 0,
      samples: [],
      flamegraph: { name: 'root', value: 0, children: [], percentage: 100 },
      hotspots: [],
      statistics: {
        totalSamples: 0,
        totalTime: 0,
        avgCpuUsage: 0,
        peakCpuUsage: 0,
        functionCalls: 0,
        uniqueFunctions: 0
      }
    };

    this.sessions.set(sessionId, session);

    // Start sampling
    const timer = setInterval(() => {
      this.takeSample(sessionId);
    }, this.samplingInterval);

    this.activeSessions.set(sessionId, timer);
    this.emit('profiling:started', session);

    return sessionId;
  }

  /**
   * Stop profiling session
   */
  public stopProfiling(sessionId: string): ProfilingSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const timer = this.activeSessions.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.activeSessions.delete(sessionId);
    }

    session.endTime = new Date();
    session.duration = session.endTime.getTime() - session.startTime.getTime();

    // Analyze results
    this.analyzeSamples(session);
    this.buildFlameGraph(session);
    this.identifyHotspots(session);
    this.calculateStatistics(session);

    this.emit('profiling:stopped', session);
    return session;
  }

  /**
   * Take CPU sample
   */
  private takeSample(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Capture stack trace (simulated)
    const stackTrace = this.captureStackTrace();
    const cpuUsage = this.getCurrentCPUUsage();

    const sample: Sample = {
      timestamp: Date.now(),
      stackTrace,
      cpuUsage,
      threadId: 'main'
    };

    session.samples.push(sample);
  }

  /**
   * Capture current stack trace
   */
  private captureStackTrace(): StackFrame[] {
    const frames: StackFrame[] = [];

    // Simulate stack capture
    const functions = [
      'processRequest',
      'handleQuery',
      'executeDatabase',
      'parseResults',
      'formatResponse'
    ];

    const depth = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < depth; i++) {
      frames.push({
        function: functions[Math.floor(Math.random() * functions.length)],
        file: `src/handlers/handler${i}.ts`,
        line: Math.floor(Math.random() * 100) + 1,
        column: Math.floor(Math.random() * 50) + 1,
        selfTime: 0,
        totalTime: 0
      });
    }

    return frames;
  }

  /**
   * Get current CPU usage
   */
  private getCurrentCPUUsage(): number {
    // Simulate CPU usage (0-100%)
    return Math.random() * 100;
  }

  /**
   * Analyze samples
   */
  private analyzeSamples(session: ProfilingSession): void {
    const functionTimes = new Map<string, { self: number; total: number; count: number }>();

    for (const sample of session.samples) {
      for (let i = 0; i < sample.stackTrace.length; i++) {
        const frame = sample.stackTrace[i];
        const key = `${frame.function}:${frame.file}:${frame.line}`;

        if (!functionTimes.has(key)) {
          functionTimes.set(key, { self: 0, total: 0, count: 0 });
        }

        const times = functionTimes.get(key)!;
        times.count++;

        // Self time (only for top frame)
        if (i === 0) {
          times.self += this.samplingInterval;
          frame.selfTime = times.self;
        }

        // Total time (for all frames)
        times.total += this.samplingInterval;
        frame.totalTime = times.total;
      }
    }
  }

  /**
   * Build flame graph
   */
  private buildFlameGraph(session: ProfilingSession): void {
    const root: FlameGraphNode = {
      name: 'root',
      value: 0,
      children: [],
      percentage: 100
    };

    // Build tree from samples
    for (const sample of session.samples) {
      let current = root;

      // Reverse stack (root to leaf)
      for (let i = sample.stackTrace.length - 1; i >= 0; i--) {
        const frame = sample.stackTrace[i];
        const name = `${frame.function} (${frame.file}:${frame.line})`;

        // Find or create child
        let child = current.children.find(c => c.name === name);
        if (!child) {
          child = {
            name,
            value: 0,
            children: [],
            percentage: 0,
            file: frame.file,
            line: frame.line
          };
          current.children.push(child);
        }

        child.value += this.samplingInterval;
        current = child;
      }
    }

    // Calculate percentages
    this.calculatePercentages(root, session.duration);
    session.flamegraph = root;
  }

  /**
   * Calculate percentages for flame graph
   */
  private calculatePercentages(node: FlameGraphNode, totalTime: number): void {
    node.percentage = totalTime > 0 ? (node.value / totalTime) * 100 : 0;

    for (const child of node.children) {
      this.calculatePercentages(child, totalTime);
    }

    // Sort children by value (descending)
    node.children.sort((a, b) => b.value - a.value);
  }

  /**
   * Identify hotspots
   */
  private identifyHotspots(session: ProfilingSession): void {
    const functionStats = new Map<string, {
      function: string;
      file: string;
      line: number;
      selfTime: number;
      totalTime: number;
      callCount: number;
    }>();

    // Aggregate function statistics
    for (const sample of session.samples) {
      for (const frame of sample.stackTrace) {
        const key = `${frame.function}:${frame.file}:${frame.line}`;

        if (!functionStats.has(key)) {
          functionStats.set(key, {
            function: frame.function,
            file: frame.file,
            line: frame.line,
            selfTime: 0,
            totalTime: 0,
            callCount: 0
          });
        }

        const stats = functionStats.get(key)!;
        stats.selfTime += frame.selfTime;
        stats.totalTime += frame.totalTime;
        stats.callCount++;
      }
    }

    // Create hotspots
    const hotspots: Hotspot[] = [];

    for (const stats of functionStats.values()) {
      if (stats.selfTime > session.duration * 0.05) { // More than 5% of time
        hotspots.push({
          function: stats.function,
          file: stats.file,
          line: stats.line,
          selfTime: stats.selfTime,
          totalTime: stats.totalTime,
          callCount: stats.callCount,
          avgTimePerCall: stats.totalTime / stats.callCount,
          percentage: (stats.selfTime / session.duration) * 100,
          recommendation: this.generateRecommendation(stats)
        });
      }
    }

    // Sort by self time (descending)
    hotspots.sort((a, b) => b.selfTime - a.selfTime);
    session.hotspots = hotspots.slice(0, 20); // Top 20 hotspots
  }

  /**
   * Generate optimization recommendation
   */
  private generateRecommendation(stats: any): string {
    if (stats.callCount > 1000) {
      return 'High call frequency detected - consider caching or reducing calls';
    }

    if (stats.avgTimePerCall > 100) {
      return 'Slow function execution - consider optimizing algorithm or using async operations';
    }

    if (stats.function.includes('parse') || stats.function.includes('serialize')) {
      return 'Consider using faster serialization library or caching parsed results';
    }

    if (stats.function.includes('query') || stats.function.includes('database')) {
      return 'Database operation detected - optimize queries or add indexes';
    }

    return 'Consider refactoring to reduce execution time';
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(session: ProfilingSession): void {
    session.statistics.totalSamples = session.samples.length;
    session.statistics.totalTime = session.duration;

    if (session.samples.length > 0) {
      const cpuUsages = session.samples.map(s => s.cpuUsage);
      session.statistics.avgCpuUsage = cpuUsages.reduce((sum, u) => sum + u, 0) / cpuUsages.length;
      session.statistics.peakCpuUsage = Math.max(...cpuUsages);
    }

    // Count function calls
    const functions = new Set<string>();
    for (const sample of session.samples) {
      session.statistics.functionCalls += sample.stackTrace.length;
      for (const frame of sample.stackTrace) {
        functions.add(`${frame.function}:${frame.file}`);
      }
    }
    session.statistics.uniqueFunctions = functions.size;
  }

  /**
   * Generate optimization suggestions
   */
  public generateOptimizationSuggestions(sessionId: string): OptimizationSuggestion[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const suggestions: OptimizationSuggestion[] = [];

    // Analyze hotspots
    for (const hotspot of session.hotspots.slice(0, 5)) { // Top 5
      if (hotspot.percentage > 20) {
        suggestions.push({
          type: 'algorithm',
          priority: 'critical',
          function: hotspot.function,
          description: `Function consumes ${hotspot.percentage.toFixed(1)}% of total CPU time`,
          impact: `Optimizing could improve performance by up to ${hotspot.percentage.toFixed(1)}%`,
          implementation: hotspot.recommendation || 'Refactor algorithm for better performance'
        });
      }

      if (hotspot.callCount > 1000 && hotspot.avgTimePerCall < 10) {
        suggestions.push({
          type: 'caching',
          priority: 'high',
          function: hotspot.function,
          description: `Function called ${hotspot.callCount} times with short execution time`,
          impact: 'Caching could reduce CPU usage significantly',
          implementation: 'Implement memoization or result caching'
        });
      }

      if (hotspot.avgTimePerCall > 50) {
        suggestions.push({
          type: 'async',
          priority: 'medium',
          function: hotspot.function,
          description: `Slow synchronous operation (${hotspot.avgTimePerCall.toFixed(1)}ms avg)`,
          impact: 'Making async could improve responsiveness',
          implementation: 'Convert to asynchronous operation or use worker threads'
        });
      }
    }

    // Check for I/O operations
    const ioFunctions = session.hotspots.filter(h =>
      h.function.includes('read') ||
      h.function.includes('write') ||
      h.function.includes('fetch') ||
      h.function.includes('request')
    );

    if (ioFunctions.length > 0) {
      suggestions.push({
        type: 'io',
        priority: 'high',
        function: 'I/O Operations',
        description: `${ioFunctions.length} I/O bound functions detected`,
        impact: 'Optimizing I/O could significantly improve throughput',
        implementation: 'Use connection pooling, batch operations, or async I/O'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Compare profiling sessions
   */
  public compareSessions(sessionId1: string, sessionId2: string): any {
    const session1 = this.sessions.get(sessionId1);
    const session2 = this.sessions.get(sessionId2);

    if (!session1 || !session2) {
      throw new Error('One or both sessions not found');
    }

    const comparison = {
      duration: {
        session1: session1.duration,
        session2: session2.duration,
        change: ((session2.duration - session1.duration) / session1.duration) * 100
      },
      avgCpuUsage: {
        session1: session1.statistics.avgCpuUsage,
        session2: session2.statistics.avgCpuUsage,
        change: ((session2.statistics.avgCpuUsage - session1.statistics.avgCpuUsage) / session1.statistics.avgCpuUsage) * 100
      },
      functionCalls: {
        session1: session1.statistics.functionCalls,
        session2: session2.statistics.functionCalls,
        change: ((session2.statistics.functionCalls - session1.statistics.functionCalls) / session1.statistics.functionCalls) * 100
      },
      topHotspots: {
        session1: session1.hotspots.slice(0, 5).map(h => ({
          function: h.function,
          percentage: h.percentage
        })),
        session2: session2.hotspots.slice(0, 5).map(h => ({
          function: h.function,
          percentage: h.percentage
        }))
      }
    };

    return comparison;
  }

  /**
   * Export flame graph as JSON
   */
  public exportFlameGraph(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    return JSON.stringify(session.flamegraph, null, 2);
  }

  /**
   * Export flame graph as SVG
   */
  public exportFlameGraphSVG(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const width = 1200;
    const height = 800;
    const boxHeight = 20;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>\n`;

    // Render flame graph
    const renderNode = (node: FlameGraphNode, x: number, y: number, w: number): void => {
      if (w < 2) return; // Too small to render

      const color = this.getFlameColor(node.percentage);
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${boxHeight}" `;
      svg += `fill="${color}" stroke="white" stroke-width="1"/>\n`;
      svg += `<text x="${x + 5}" y="${y + 14}" font-size="12" fill="black">${node.name}</text>\n`;

      // Render children
      let childX = x;
      for (const child of node.children) {
        const childWidth = (child.value / node.value) * w;
        renderNode(child, childX, y + boxHeight, childWidth);
        childX += childWidth;
      }
    };

    renderNode(session.flamegraph, 0, 0, width);
    svg += '</svg>';

    return svg;
  }

  /**
   * Get color for flame graph based on percentage
   */
  private getFlameColor(percentage: number): string {
    if (percentage > 20) return '#ff6b6b';      // Hot (red)
    if (percentage > 10) return '#ffa726';      // Warm (orange)
    if (percentage > 5) return '#ffeb3b';       // Medium (yellow)
    if (percentage > 2) return '#66bb6a';       // Cool (green)
    return '#42a5f5';                           // Cold (blue)
  }

  /**
   * Get session
   */
  public getSession(sessionId: string): ProfilingSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List all sessions
   */
  public listSessions(): ProfilingSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete session
   */
  public deleteSession(sessionId: string): void {
    const timer = this.activeSessions.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.activeSessions.delete(sessionId);
    }
    this.sessions.delete(sessionId);
  }
}

export default CPUProfiler;
