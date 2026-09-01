/**
 * Tool Performance Monitor - Tracks and analyzes tool execution performance
 *
 * Provides real-time monitoring, analytics, and optimization suggestions
 * for tool execution.
 */
import { ToolExecution } from '../types/index.js';
export interface ToolMetrics {
    toolName: string;
    totalCalls: number;
    successCount: number;
    failCount: number;
    successRate: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    lastUsed: Date;
    cacheHitRate: number;
    retryRate: number;
    errorTypes: Map<string, number>;
}
export interface PerformanceReport {
    overview: {
        totalExecutions: number;
        totalSuccess: number;
        totalFailures: number;
        overallSuccessRate: number;
        avgExecutionTime: number;
    };
    toolMetrics: Map<string, ToolMetrics>;
    slowestTools: Array<{
        tool: string;
        avgDuration: number;
    }>;
    mostUnreliable: Array<{
        tool: string;
        successRate: number;
    }>;
    recommendations: string[];
}
export declare class ToolPerformanceMonitor {
    private executions;
    private metrics;
    private cacheHits;
    private retries;
    /**
     * Records a tool execution
     */
    record(execution: ToolExecution): void;
    /**
     * Updates metrics for a tool
     */
    private updateMetrics;
    /**
     * Generates a performance report
     */
    generateReport(): PerformanceReport;
    /**
     * Generates optimization recommendations
     */
    private generateRecommendations;
    /**
     * Gets metrics for a specific tool
     */
    getToolMetrics(toolName: string): ToolMetrics | undefined;
    /**
     * Gets all executions for a specific tool
     */
    getToolExecutions(toolName: string): ToolExecution[];
    /**
     * Gets recent failures
     */
    getRecentFailures(limit?: number): ToolExecution[];
    /**
     * Gets execution timeline
     */
    getTimeline(): Array<{
        timestamp: Date;
        tool: string;
        success: boolean;
        duration: number;
    }>;
    /**
     * Checks if a tool should be avoided based on recent performance
     */
    shouldAvoidTool(toolName: string): {
        avoid: boolean;
        reason?: string;
    };
    /**
     * Clears all metrics
     */
    clear(): void;
    /**
     * Exports metrics as JSON
     */
    export(): string;
    /**
     * Prints a formatted report to console
     */
    printReport(): void;
}
//# sourceMappingURL=ToolPerformanceMonitor.d.ts.map