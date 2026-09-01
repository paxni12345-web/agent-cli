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
export declare class CPUProfiler extends EventEmitter {
    private sessions;
    private activeSessions;
    private samplingInterval;
    constructor(samplingInterval?: number);
    /**
     * Start profiling session
     */
    startProfiling(name: string): string;
    /**
     * Stop profiling session
     */
    stopProfiling(sessionId: string): ProfilingSession;
    /**
     * Take CPU sample
     */
    private takeSample;
    /**
     * Capture current stack trace
     */
    private captureStackTrace;
    /**
     * Get current CPU usage
     */
    private getCurrentCPUUsage;
    /**
     * Analyze samples
     */
    private analyzeSamples;
    /**
     * Build flame graph
     */
    private buildFlameGraph;
    /**
     * Calculate percentages for flame graph
     */
    private calculatePercentages;
    /**
     * Identify hotspots
     */
    private identifyHotspots;
    /**
     * Generate optimization recommendation
     */
    private generateRecommendation;
    /**
     * Calculate statistics
     */
    private calculateStatistics;
    /**
     * Generate optimization suggestions
     */
    generateOptimizationSuggestions(sessionId: string): OptimizationSuggestion[];
    /**
     * Compare profiling sessions
     */
    compareSessions(sessionId1: string, sessionId2: string): any;
    /**
     * Export flame graph as JSON
     */
    exportFlameGraph(sessionId: string): string;
    /**
     * Export flame graph as SVG
     */
    exportFlameGraphSVG(sessionId: string): string;
    /**
     * Get color for flame graph based on percentage
     */
    private getFlameColor;
    /**
     * Get session
     */
    getSession(sessionId: string): ProfilingSession | null;
    /**
     * List all sessions
     */
    listSessions(): ProfilingSession[];
    /**
     * Delete session
     */
    deleteSession(sessionId: string): void;
}
export default CPUProfiler;
//# sourceMappingURL=CPUProfiler.d.ts.map