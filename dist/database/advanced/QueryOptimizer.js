"use strict";
/**
 * QueryOptimizer - Database query analysis and optimization
 * Advanced query optimization with index recommendations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryOptimizer = void 0;
const events_1 = require("events");
class QueryOptimizer extends events_1.EventEmitter {
    queries = new Map();
    executionHistory = [];
    indexRecommendations = new Map();
    slowQueryThreshold = 1000; // ms
    constructor(slowQueryThreshold = 1000) {
        super();
        this.slowQueryThreshold = slowQueryThreshold;
    }
    /**
     * Analyze query and provide optimization suggestions
     */
    async analyzeQuery(sql, database) {
        const query = {
            id: `q_${Date.now()}`,
            sql: sql.trim(),
            database,
            timestamp: new Date()
        };
        this.queries.set(query.id, query);
        // Parse query
        const parsed = this.parseQuery(sql);
        // Get execution plan
        const plan = await this.getExecutionPlan(query);
        query.executionPlan = plan;
        // Analyze and generate suggestions
        const suggestions = this.generateSuggestions(query, parsed, plan);
        this.emit('query:analyzed', { query, suggestions });
        return suggestions;
    }
    /**
     * Parse SQL query
     */
    parseQuery(sql) {
        const normalized = sql.toLowerCase().trim();
        const type = normalized.startsWith('select') ? 'select'
            : normalized.startsWith('insert') ? 'insert'
                : normalized.startsWith('update') ? 'update'
                    : normalized.startsWith('delete') ? 'delete'
                        : 'unknown';
        // Extract tables
        const tablePattern = /(?:from|join|into|update)\s+([a-z_][a-z0-9_]*)/gi;
        const tables = new Set();
        let match;
        while ((match = tablePattern.exec(normalized)) !== null) {
            tables.add(match[1]);
        }
        // Extract columns in WHERE clause
        const wherePattern = /where\s+(.+?)(?:group\s+by|order\s+by|limit|$)/i;
        const whereMatch = wherePattern.exec(normalized);
        const whereColumns = new Set();
        if (whereMatch) {
            const whereClause = whereMatch[1];
            const columnPattern = /([a-z_][a-z0-9_]*)\s*(?:=|>|<|>=|<=|!=|like|in)/gi;
            let colMatch;
            while ((colMatch = columnPattern.exec(whereClause)) !== null) {
                whereColumns.add(colMatch[1]);
            }
        }
        // Extract JOINs
        const joinPattern = /join\s+([a-z_][a-z0-9_]*)\s+on\s+([a-z_][a-z0-9_.]*)(?:\s*=\s*)([a-z_][a-z0-9_.]*)/gi;
        const joins = [];
        while ((match = joinPattern.exec(normalized)) !== null) {
            joins.push({
                table: match[1],
                condition: `${match[2]} = ${match[3]}`
            });
        }
        return {
            type,
            tables: Array.from(tables),
            whereColumns: Array.from(whereColumns),
            joins,
            hasWhere: whereMatch !== null,
            hasJoin: joins.length > 0,
            hasGroupBy: /group\s+by/i.test(normalized),
            hasOrderBy: /order\s+by/i.test(normalized),
            hasLimit: /limit\s+\d+/i.test(normalized)
        };
    }
    /**
     * Get execution plan (simulated)
     */
    async getExecutionPlan(query) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const operations = [
            {
                type: 'Seq Scan',
                table: 'users',
                method: 'seq_scan',
                estimatedRows: 10000,
                cost: 150.5
            }
        ];
        return {
            type: 'select',
            operations,
            estimatedCost: 150.5,
            indexes: [],
            warnings: ['Sequential scan detected - consider adding index']
        };
    }
    /**
     * Generate optimization suggestions
     */
    generateSuggestions(query, parsed, plan) {
        const suggestions = [];
        // Check for sequential scans
        const hasSeqScan = plan.operations.some(op => op.method === 'seq_scan');
        if (hasSeqScan && parsed.whereColumns.length > 0) {
            suggestions.push({
                type: 'index',
                priority: 'high',
                description: `Add index on ${parsed.whereColumns.join(', ')}`,
                impact: 'Reduce query time by 70-90%',
                implementation: `CREATE INDEX idx_${parsed.tables[0]}_${parsed.whereColumns.join('_')} ON ${parsed.tables[0]} (${parsed.whereColumns.join(', ')});`,
                estimatedImprovement: 0.8
            });
        }
        // Check for SELECT *
        if (/select\s+\*/i.test(query.sql)) {
            suggestions.push({
                type: 'rewrite',
                priority: 'medium',
                description: 'Avoid SELECT * - specify columns explicitly',
                impact: 'Reduce data transfer and memory usage',
                implementation: 'List only needed columns in SELECT clause',
                estimatedImprovement: 0.3
            });
        }
        // Check for missing WHERE clause
        if (!parsed.hasWhere && parsed.type !== 'insert') {
            suggestions.push({
                type: 'rewrite',
                priority: 'critical',
                description: 'Query has no WHERE clause - will scan entire table',
                impact: 'Potential performance disaster on large tables',
                implementation: 'Add WHERE clause to filter rows',
                estimatedImprovement: 0.95
            });
        }
        // Check for N+1 query pattern
        if (this.detectN1Pattern(query)) {
            suggestions.push({
                type: 'rewrite',
                priority: 'high',
                description: 'N+1 query pattern detected',
                impact: 'Multiple round trips to database',
                implementation: 'Use JOIN or IN clause to fetch related data',
                estimatedImprovement: 0.85
            });
        }
        // Check for subquery optimization
        if (/\(\s*select/i.test(query.sql)) {
            suggestions.push({
                type: 'rewrite',
                priority: 'medium',
                description: 'Subquery can be optimized',
                impact: 'Reduce query complexity',
                implementation: 'Convert subquery to JOIN',
                estimatedImprovement: 0.4
            });
        }
        // Check for LIKE with leading wildcard
        if (/%[^%]+%/.test(query.sql)) {
            suggestions.push({
                type: 'index',
                priority: 'medium',
                description: 'LIKE with leading wildcard prevents index usage',
                impact: 'Forces full table scan',
                implementation: 'Use full-text search or restructure query',
                estimatedImprovement: 0.6
            });
        }
        return suggestions.sort((a, b) => {
            const priority = { critical: 4, high: 3, medium: 2, low: 1 };
            return priority[b.priority] - priority[a.priority];
        });
    }
    /**
     * Detect N+1 query pattern
     */
    detectN1Pattern(query) {
        const recentQueries = this.executionHistory.slice(-100);
        const similarQueries = recentQueries.filter(q => this.querySimilarity(q.sql, query.sql) > 0.8);
        return similarQueries.length > 10;
    }
    /**
     * Calculate query similarity
     */
    querySimilarity(sql1, sql2) {
        const normalize = (sql) => sql.toLowerCase()
            .replace(/\d+/g, '?')
            .replace(/'[^']*'/g, '?')
            .replace(/\s+/g, ' ')
            .trim();
        const norm1 = normalize(sql1);
        const norm2 = normalize(sql2);
        if (norm1 === norm2)
            return 1.0;
        const words1 = new Set(norm1.split(' '));
        const words2 = new Set(norm2.split(' '));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        return intersection.size / Math.max(words1.size, words2.size);
    }
    /**
     * Generate index recommendations
     */
    generateIndexRecommendations(database) {
        const dbQueries = this.executionHistory.filter(q => q.database === database);
        const tableColumns = new Map();
        // Analyze queries to find frequently used columns
        for (const query of dbQueries) {
            const parsed = this.parseQuery(query.sql);
            for (const table of parsed.tables) {
                if (!tableColumns.has(table)) {
                    tableColumns.set(table, new Set());
                }
                for (const col of parsed.whereColumns) {
                    tableColumns.get(table).add(col);
                }
            }
        }
        const recommendations = [];
        for (const [table, columns] of tableColumns) {
            if (columns.size > 0) {
                recommendations.push({
                    table,
                    columns: Array.from(columns),
                    type: 'btree',
                    reason: `Columns used in ${dbQueries.length} queries`,
                    queries: dbQueries.slice(0, 5).map(q => q.sql),
                    estimatedImprovement: 0.7
                });
            }
        }
        this.indexRecommendations.set(database, recommendations);
        this.emit('indexes:recommended', { database, recommendations });
        return recommendations;
    }
    /**
     * Record query execution
     */
    recordExecution(queryId, executionTime, rowsAffected) {
        const query = this.queries.get(queryId);
        if (!query)
            return;
        query.executionTime = executionTime;
        query.rowsAffected = rowsAffected;
        this.executionHistory.push(query);
        // Keep only last 10000 queries
        if (this.executionHistory.length > 10000) {
            this.executionHistory.shift();
        }
        if (executionTime > this.slowQueryThreshold) {
            this.emit('query:slow', query);
        }
    }
    /**
     * Get query statistics
     */
    getStatistics(database) {
        const queries = database
            ? this.executionHistory.filter(q => q.database === database)
            : this.executionHistory;
        const withExecutionTime = queries.filter(q => q.executionTime !== undefined);
        const avgTime = withExecutionTime.length > 0
            ? withExecutionTime.reduce((sum, q) => sum + q.executionTime, 0) / withExecutionTime.length
            : 0;
        const slowQueries = queries.filter(q => q.executionTime > this.slowQueryThreshold).length;
        const fastQueries = queries.filter(q => q.executionTime <= this.slowQueryThreshold).length;
        // Most expensive queries
        const mostExpensive = [...queries]
            .sort((a, b) => (b.executionTime || 0) - (a.executionTime || 0))
            .slice(0, 10);
        // Most frequent queries
        const queryCount = new Map();
        for (const query of queries) {
            const normalized = this.normalizeQuery(query.sql);
            queryCount.set(normalized, (queryCount.get(normalized) || 0) + 1);
        }
        const mostFrequent = Array.from(queryCount.entries())
            .map(([sql, count]) => ({ sql, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            totalQueries: queries.length,
            avgExecutionTime: avgTime,
            slowQueries,
            fastQueries,
            mostExpensive,
            mostFrequent
        };
    }
    /**
     * Normalize query for comparison
     */
    normalizeQuery(sql) {
        return sql
            .toLowerCase()
            .replace(/\d+/g, '?')
            .replace(/'[^']*'/g, '?')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Explain query
     */
    async explainQuery(sql, database) {
        const query = await this.analyzeQuery(sql, database);
        const suggestions = query;
        let explanation = `Query Analysis:\n`;
        explanation += `================\n\n`;
        explanation += `SQL: ${sql}\n\n`;
        if (suggestions.length > 0) {
            explanation += `Optimization Suggestions:\n`;
            for (const [i, sug] of suggestions.entries()) {
                explanation += `\n${i + 1}. [${sug.priority.toUpperCase()}] ${sug.description}\n`;
                explanation += `   Impact: ${sug.impact}\n`;
                explanation += `   Implementation: ${sug.implementation}\n`;
                explanation += `   Est. Improvement: ${(sug.estimatedImprovement * 100).toFixed(0)}%\n`;
            }
        }
        else {
            explanation += `No optimization suggestions - query looks good!\n`;
        }
        return explanation;
    }
    /**
     * Clear history
     */
    clearHistory() {
        this.executionHistory = [];
        this.emit('history:cleared');
    }
}
exports.QueryOptimizer = QueryOptimizer;
exports.default = QueryOptimizer;
