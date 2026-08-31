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
  slowestTools: Array<{ tool: string; avgDuration: number }>;
  mostUnreliable: Array<{ tool: string; successRate: number }>;
  recommendations: string[];
}

export class ToolPerformanceMonitor {
  private executions: ToolExecution[] = [];
  private metrics: Map<string, ToolMetrics> = new Map();
  private cacheHits: Map<string, number> = new Map();
  private retries: Map<string, number> = new Map();

  /**
   * Records a tool execution
   */
  record(execution: ToolExecution): void {
    this.executions.push(execution);
    this.updateMetrics(execution);
  }

  /**
   * Updates metrics for a tool
   */
  private updateMetrics(execution: ToolExecution): void {
    const toolName = execution.tool;
    const existing = this.metrics.get(toolName);

    if (!existing) {
      this.metrics.set(toolName, {
        toolName,
        totalCalls: 1,
        successCount: execution.result.success ? 1 : 0,
        failCount: execution.result.success ? 0 : 1,
        successRate: execution.result.success ? 100 : 0,
        avgDuration: execution.duration || 0,
        minDuration: execution.duration || 0,
        maxDuration: execution.duration || 0,
        lastUsed: execution.timestamp,
        cacheHitRate: execution.result.cached ? 100 : 0,
        retryRate: execution.retryCount ? 100 : 0,
        errorTypes: new Map(),
      });

      if (!execution.result.success && execution.result.error) {
        const metrics = this.metrics.get(toolName)!;
        metrics.errorTypes.set(execution.result.error, 1);
      }
    } else {
      existing.totalCalls++;
      if (execution.result.success) {
        existing.successCount++;
      } else {
        existing.failCount++;
        if (execution.result.error) {
          const count = existing.errorTypes.get(execution.result.error) || 0;
          existing.errorTypes.set(execution.result.error, count + 1);
        }
      }

      existing.successRate = (existing.successCount / existing.totalCalls) * 100;

      if (execution.duration) {
        existing.avgDuration =
          (existing.avgDuration * (existing.totalCalls - 1) + execution.duration) /
          existing.totalCalls;
        existing.minDuration = Math.min(existing.minDuration, execution.duration);
        existing.maxDuration = Math.max(existing.maxDuration, execution.duration);
      }

      existing.lastUsed = execution.timestamp;

      // Update cache hit rate
      if (execution.result.cached) {
        const hits = (this.cacheHits.get(toolName) || 0) + 1;
        this.cacheHits.set(toolName, hits);
        existing.cacheHitRate = (hits / existing.totalCalls) * 100;
      }

      // Update retry rate
      if (execution.retryCount && execution.retryCount > 0) {
        const retries = (this.retries.get(toolName) || 0) + 1;
        this.retries.set(toolName, retries);
        existing.retryRate = (retries / existing.totalCalls) * 100;
      }
    }
  }

  /**
   * Generates a performance report
   */
  generateReport(): PerformanceReport {
    const totalExecutions = this.executions.length;
    const totalSuccess = this.executions.filter(e => e.result.success).length;
    const totalFailures = totalExecutions - totalSuccess;
    const overallSuccessRate = totalExecutions > 0 ? (totalSuccess / totalExecutions) * 100 : 0;
    const avgExecutionTime =
      this.executions.reduce((sum, e) => sum + (e.duration || 0), 0) / totalExecutions || 0;

    const slowestTools = Array.from(this.metrics.values())
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5)
      .map(m => ({ tool: m.toolName, avgDuration: m.avgDuration }));

    const mostUnreliable = Array.from(this.metrics.values())
      .filter(m => m.totalCalls >= 3) // Only consider tools with at least 3 calls
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5)
      .map(m => ({ tool: m.toolName, successRate: m.successRate }));

    const recommendations = this.generateRecommendations();

    return {
      overview: {
        totalExecutions,
        totalSuccess,
        totalFailures,
        overallSuccessRate,
        avgExecutionTime,
      },
      toolMetrics: this.metrics,
      slowestTools,
      mostUnreliable,
      recommendations,
    };
  }

  /**
   * Generates optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    for (const [toolName, metrics] of this.metrics) {
      // Slow tool
      if (metrics.avgDuration > 5000) {
        recommendations.push(
          `⚡ Tool '${toolName}' is slow (avg ${metrics.avgDuration.toFixed(0)}ms). Consider optimizing or using alternatives.`
        );
      }

      // Low success rate
      if (metrics.successRate < 70 && metrics.totalCalls >= 3) {
        recommendations.push(
          `⚠️ Tool '${toolName}' has low success rate (${metrics.successRate.toFixed(1)}%). Review input validation and error handling.`
        );
      }

      // High retry rate
      if (metrics.retryRate > 30) {
        recommendations.push(
          `🔄 Tool '${toolName}' requires frequent retries (${metrics.retryRate.toFixed(1)}%). Investigate root cause.`
        );
      }

      // Low cache hit rate for expensive operations
      if (metrics.avgDuration > 1000 && metrics.cacheHitRate < 20 && metrics.totalCalls >= 5) {
        recommendations.push(
          `💾 Tool '${toolName}' is slow but rarely cached. Enable caching for better performance.`
        );
      }

      // Common error pattern
      if (metrics.errorTypes.size > 0) {
        const mostCommonError = Array.from(metrics.errorTypes.entries())
          .sort((a, b) => b[1] - a[1])[0];

        if (mostCommonError[1] >= 3) {
          recommendations.push(
            `🐛 Tool '${toolName}' frequently fails with: "${mostCommonError[0]}". Add specific handling for this error.`
          );
        }
      }
    }

    // Overall recommendations
    const totalExecutions = this.executions.length;
    if (totalExecutions > 50) {
      const avgTime = this.executions.reduce((sum, e) => sum + (e.duration || 0), 0) / totalExecutions;
      if (avgTime > 3000) {
        recommendations.push(
          `🚀 Overall execution time is high (${avgTime.toFixed(0)}ms avg). Consider parallel execution or tool optimization.`
        );
      }
    }

    return recommendations;
  }

  /**
   * Gets metrics for a specific tool
   */
  getToolMetrics(toolName: string): ToolMetrics | undefined {
    return this.metrics.get(toolName);
  }

  /**
   * Gets all executions for a specific tool
   */
  getToolExecutions(toolName: string): ToolExecution[] {
    return this.executions.filter(e => e.tool === toolName);
  }

  /**
   * Gets recent failures
   */
  getRecentFailures(limit: number = 10): ToolExecution[] {
    return this.executions
      .filter(e => !e.result.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * Gets execution timeline
   */
  getTimeline(): Array<{ timestamp: Date; tool: string; success: boolean; duration: number }> {
    return this.executions.map(e => ({
      timestamp: e.timestamp,
      tool: e.tool,
      success: e.result.success,
      duration: e.duration || 0,
    }));
  }

  /**
   * Checks if a tool should be avoided based on recent performance
   */
  shouldAvoidTool(toolName: string): { avoid: boolean; reason?: string } {
    const metrics = this.metrics.get(toolName);

    if (!metrics || metrics.totalCalls < 3) {
      return { avoid: false };
    }

    // Check recent failures (last 5 calls)
    const recentCalls = this.getToolExecutions(toolName).slice(-5);
    const recentFailures = recentCalls.filter(e => !e.result.success).length;

    if (recentFailures >= 4) {
      return {
        avoid: true,
        reason: `Tool has failed ${recentFailures} out of last 5 attempts`,
      };
    }

    // Check overall success rate
    if (metrics.successRate < 50 && metrics.totalCalls >= 5) {
      return {
        avoid: true,
        reason: `Tool has low success rate: ${metrics.successRate.toFixed(1)}%`,
      };
    }

    return { avoid: false };
  }

  /**
   * Clears all metrics
   */
  clear(): void {
    this.executions = [];
    this.metrics.clear();
    this.cacheHits.clear();
    this.retries.clear();
  }

  /**
   * Exports metrics as JSON
   */
  export(): string {
    const data = {
      executions: this.executions,
      metrics: Array.from(this.metrics.entries()).map(([key, value]) => ({
        toolName: key,
        ...value,
        errorTypes: Array.from(value.errorTypes.entries()),
      })),
      timestamp: new Date(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Prints a formatted report to console
   */
  printReport(): void {
    const report = this.generateReport();

    console.log('\n' + '='.repeat(60));
    console.log('📊 TOOL PERFORMANCE REPORT');
    console.log('='.repeat(60));

    console.log('\nOverview:');
    console.log(`  Total Executions: ${report.overview.totalExecutions}`);
    console.log(`  Success: ${report.overview.totalSuccess} (${report.overview.overallSuccessRate.toFixed(1)}%)`);
    console.log(`  Failures: ${report.overview.totalFailures}`);
    console.log(`  Avg Execution Time: ${report.overview.avgExecutionTime.toFixed(0)}ms`);

    if (report.slowestTools.length > 0) {
      console.log('\n🐌 Slowest Tools:');
      report.slowestTools.forEach((tool, i) => {
        console.log(`  ${i + 1}. ${tool.tool}: ${tool.avgDuration.toFixed(0)}ms`);
      });
    }

    if (report.mostUnreliable.length > 0) {
      console.log('\n⚠️  Most Unreliable Tools:');
      report.mostUnreliable.forEach((tool, i) => {
        console.log(`  ${i + 1}. ${tool.tool}: ${tool.successRate.toFixed(1)}% success`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}
