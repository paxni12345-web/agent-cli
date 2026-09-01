/**
 * QueryOptimizer - Database query analysis and optimization
 * Advanced query optimization with index recommendations
 */
import { EventEmitter } from 'events';
export interface Query {
    id: string;
    sql: string;
    database: string;
    timestamp: Date;
    executionTime?: number;
    rowsAffected?: number;
    executionPlan?: ExecutionPlan;
}
export interface ExecutionPlan {
    type: 'select' | 'insert' | 'update' | 'delete';
    operations: Operation[];
    estimatedCost: number;
    actualCost?: number;
    indexes: string[];
    warnings: string[];
}
export interface Operation {
    type: string;
    table: string;
    method: 'seq_scan' | 'index_scan' | 'bitmap_scan' | 'nested_loop' | 'hash_join' | 'merge_join';
    estimatedRows: number;
    actualRows?: number;
    cost: number;
}
export interface OptimizationSuggestion {
    type: 'index' | 'rewrite' | 'partition' | 'cache';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string;
    implementation: string;
    estimatedImprovement: number;
}
export interface IndexRecommendation {
    table: string;
    columns: string[];
    type: 'btree' | 'hash' | 'gin' | 'gist';
    reason: string;
    queries: string[];
    estimatedImprovement: number;
}
export interface QueryStats {
    totalQueries: number;
    avgExecutionTime: number;
    slowQueries: number;
    fastQueries: number;
    mostExpensive: Query[];
    mostFrequent: Array<{
        sql: string;
        count: number;
    }>;
}
export declare class QueryOptimizer extends EventEmitter {
    private queries;
    private executionHistory;
    private indexRecommendations;
    private slowQueryThreshold;
    constructor(slowQueryThreshold?: number);
    /**
     * Analyze query and provide optimization suggestions
     */
    analyzeQuery(sql: string, database: string): Promise<OptimizationSuggestion[]>;
    /**
     * Parse SQL query
     */
    private parseQuery;
    /**
     * Get execution plan (simulated)
     */
    private getExecutionPlan;
    /**
     * Generate optimization suggestions
     */
    private generateSuggestions;
    /**
     * Detect N+1 query pattern
     */
    private detectN1Pattern;
    /**
     * Calculate query similarity
     */
    private querySimilarity;
    /**
     * Generate index recommendations
     */
    generateIndexRecommendations(database: string): IndexRecommendation[];
    /**
     * Record query execution
     */
    recordExecution(queryId: string, executionTime: number, rowsAffected: number): void;
    /**
     * Get query statistics
     */
    getStatistics(database?: string): QueryStats;
    /**
     * Normalize query for comparison
     */
    private normalizeQuery;
    /**
     * Explain query
     */
    explainQuery(sql: string, database: string): Promise<string>;
    /**
     * Clear history
     */
    clearHistory(): void;
}
export default QueryOptimizer;
//# sourceMappingURL=QueryOptimizer.d.ts.map