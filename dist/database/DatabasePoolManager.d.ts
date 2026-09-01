/**
 * Database Connection Pool Manager
 * Connection pooling, query optimization, transaction management
 * Multi-database support, failover, replication
 */
import { EventEmitter } from 'events';
export interface PoolConfig {
    min: number;
    max: number;
    acquireTimeout: number;
    idleTimeout: number;
    evictionInterval: number;
    testOnBorrow: boolean;
    testOnReturn: boolean;
    testWhileIdle: boolean;
    validationQuery: string;
    maxRetries: number;
    retryDelay: number;
    leakDetectionThreshold?: number;
    healthCheck?: HealthCheckConfig;
    circuitBreaker?: CircuitBreakerConfig;
    exhaustionAlertThreshold?: number;
}
export interface DatabaseConfig {
    id: string;
    type: DatabaseType;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    poolConfig?: Partial<PoolConfig>;
    readReplicas?: ReplicaConfig[];
    options?: Record<string, any>;
}
export type DatabaseType = 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'cassandra' | 'dynamodb' | 'sqlite';
export interface ReplicaConfig {
    id: string;
    host: string;
    port: number;
    weight: number;
    lag?: number;
}
export interface Connection {
    id: string;
    databaseId: string;
    native: any;
    state: ConnectionState;
    createdAt: number;
    lastUsed: number;
    queryCount: number;
    errorCount: number;
    inTransaction: boolean;
    acquiredAt?: number;
    acquiredBy?: string;
    stackTrace?: string;
    lastHealthCheck?: number;
    healthCheckFailures: number;
}
export type ConnectionState = 'idle' | 'active' | 'validating' | 'error' | 'closed';
export interface QueryOptions {
    timeout?: number;
    retries?: number;
    readOnly?: boolean;
    useReplica?: boolean;
    cache?: boolean;
    cacheTTL?: number;
    prepare?: boolean;
    skipValidation?: boolean;
    logLevel?: 'none' | 'basic' | 'detailed';
}
export interface SecurityConfig {
    allowedTables: Set<string>;
    allowedColumns: Map<string, Set<string>>;
    maxQueryTimeout: number;
    requireParameterized: boolean;
    blockDynamicIdentifiers: boolean;
    allowedOperations: Set<SQLOperation>;
    maxResultRows?: number;
    enableQueryLogging: boolean;
}
export type SQLOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'TRUNCATE';
export interface ParsedQuery {
    operation: SQLOperation;
    tables: string[];
    columns: string[];
    hasSubqueries: boolean;
    hasDynamicIdentifiers: boolean;
    isParameterized: boolean;
    parameterCount: number;
    rawSQL: string;
}
export interface QueryAuditLog {
    id: string;
    databaseId: string;
    query: string;
    params: any[];
    operation: SQLOperation;
    executionTime: number;
    rowCount: number;
    success: boolean;
    error?: string;
    timestamp: number;
    userId?: string;
    ipAddress?: string;
}
export interface QueryResult<T = any> {
    rows: T[];
    rowCount: number;
    fields?: QueryField[];
    executionTime: number;
    fromCache?: boolean;
    replica?: string;
}
export interface QueryField {
    name: string;
    type: string;
    nullable: boolean;
}
export interface Transaction {
    id: string;
    connectionId: string;
    startTime: number;
    operations: TransactionOperation[];
    state: TransactionState;
    isolationLevel: IsolationLevel;
    savepoints: string[];
}
export type TransactionState = 'active' | 'committed' | 'rolled_back' | 'failed';
export type IsolationLevel = 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
export interface TransactionOperation {
    type: 'query' | 'savepoint' | 'rollback_to_savepoint';
    query?: string;
    params?: any[];
    timestamp: number;
    result?: any;
}
export interface QueryCache {
    key: string;
    result: QueryResult;
    timestamp: number;
    ttl: number;
    hits: number;
}
export interface PreparedStatement {
    id: string;
    query: string;
    databaseId: string;
    native: any;
    executionCount: number;
    lastExecuted?: number;
}
export interface PoolStats {
    databaseId: string;
    totalConnections: number;
    idleConnections: number;
    activeConnections: number;
    waitingRequests: number;
    totalQueries: number;
    failedQueries: number;
    averageQueryTime: number;
    cacheHits: number;
    cacheMisses: number;
    healthStatus: PoolHealthStatus;
    connectionLeaks: number;
    validationFailures: number;
    reconnectionAttempts: number;
    circuitBreakerState: CircuitBreakerState;
}
export interface PoolHealthStatus {
    status: 'healthy' | 'degraded' | 'critical' | 'down';
    lastHealthCheck: number;
    consecutiveFailures: number;
    healthScore: number;
    issues: string[];
}
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';
export interface HealthCheckConfig {
    enabled: boolean;
    interval: number;
    timeout: number;
    healthyThreshold: number;
    unhealthyThreshold: number;
    query: string;
}
export interface ConnectionLeak {
    connectionId: string;
    acquiredAt: number;
    acquiredBy: string;
    duration: number;
    stackTrace?: string;
}
export interface CircuitBreakerConfig {
    enabled: boolean;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    halfOpenMaxAttempts: number;
}
export interface MigrationConfig {
    directory: string;
    table: string;
    autoRun: boolean;
}
export interface Migration {
    id: string;
    name: string;
    version: number;
    up: string;
    down: string;
    appliedAt?: number;
    checksum: string;
}
export interface IndexAnalysis {
    table: string;
    index: string;
    columns: string[];
    type: string;
    usage: number;
    size: number;
    recommendation: string;
}
export interface QueryPlan {
    query: string;
    plan: any;
    cost: number;
    estimatedRows: number;
    actualRows?: number;
    executionTime?: number;
}
export declare class DatabasePoolManager extends EventEmitter {
    private pools;
    private databases;
    private queryCache;
    private preparedStatements;
    private transactions;
    private migrations;
    private securityConfigs;
    private queryAuditLogs;
    private maintenanceInterval;
    private readonly TRANSACTION_TIMEOUT;
    private readonly MAX_TRANSACTION_AGE;
    private readonly MAX_AUDIT_LOG_SIZE;
    private isShuttingDown;
    private shutdownPromise;
    private activeStreams;
    private cleanupHandlers;
    constructor();
    private setupProcessHandlers;
    registerDatabase(config: DatabaseConfig): Promise<void>;
    unregisterDatabase(databaseId: string): Promise<void>;
    getDatabase(databaseId: string): DatabaseConfig | undefined;
    /**
     * Lists all registered databases.
     * @returns Array of database configurations
     */
    listDatabases(): DatabaseConfig[];
    setSecurityConfig(databaseId: string, config: Partial<SecurityConfig>): void;
    getSecurityConfig(databaseId: string): SecurityConfig | undefined;
    /**
     * Parses SQL query and extracts metadata for security validation.
     * @param sql - SQL query string
     * @param params - Query parameters
     * @returns Parsed query metadata
     * @throws Error if query cannot be parsed or operation is invalid
     */
    private parseSQL;
    /**
     * Extracts table names from SQL query.
     * @param sql - SQL query string
     * @returns Array of table names found in the query
     */
    private extractTables;
    /**
     * Extracts column names from SQL query.
     * @param sql - SQL query string
     * @returns Array of column names found in the query
     */
    private extractColumns;
    private detectDynamicIdentifiers;
    private hasUnparameterizedValues;
    private validateQuery;
    query<T = any>(databaseId: string, query: string, params?: any[], options?: QueryOptions): Promise<QueryResult<T>>;
    private executeQueryWithTimeout;
    private executeQuery;
    private executeWithPreparedStatement;
    private executePostgreSQLQuery;
    private executeMySQLQuery;
    private executeMongoQuery;
    private executeRedisCommand;
    private logQuery;
    getQueryLogs(options?: {
        databaseId?: string;
        operation?: SQLOperation;
        success?: boolean;
        startTime?: number;
        endTime?: number;
        limit?: number;
    }): QueryAuditLog[];
    getQueryStatistics(databaseId?: string): {
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        averageExecutionTime: number;
        slowestQuery: QueryAuditLog | null;
        fastestQuery: QueryAuditLog | null;
        operationBreakdown: Map<SQLOperation, number>;
    };
    clearQueryLogs(databaseId?: string): void;
    createQueryBuilder(databaseId: string): SecureQueryBuilder;
    beginTransaction(databaseId: string, isolationLevel?: IsolationLevel): Promise<Transaction>;
    commitTransaction(transactionId: string): Promise<void>;
    rollbackTransaction(transactionId: string): Promise<void>;
    createSavepoint(transactionId: string, name: string): Promise<void>;
    rollbackToSavepoint(transactionId: string, name: string): Promise<void>;
    prepare(databaseId: string, query: string): Promise<PreparedStatement>;
    executePrepared<T = any>(statementId: string, params: any[]): Promise<QueryResult<T>>;
    private getCachedQuery;
    private cacheQuery;
    private getQueryCacheKey;
    clearQueryCache(databaseId?: string): void;
    explainQuery(databaseId: string, query: string, params?: any[]): Promise<QueryPlan>;
    private extractCost;
    private extractRows;
    analyzeIndexes(databaseId: string, table: string): Promise<IndexAnalysis[]>;
    /**
     * Parses a human-readable size string into bytes.
     * @param sizeStr - Size string (e.g., "5.2 MB")
     * @returns Size in bytes, or 0 if parsing fails
     */
    private parseSizeString;
    runMigrations(databaseId: string, migrations: Migration[]): Promise<void>;
    rollbackMigration(databaseId: string, version: number): Promise<void>;
    getPoolStats(databaseId: string): PoolStats | undefined;
    getAllPoolStats(): Map<string, PoolStats>;
    getPoolHealth(databaseId: string): PoolHealthStatus | undefined;
    getAllPoolHealth(): Map<string, PoolHealthStatus>;
    getConnectionLeaks(databaseId: string): ConnectionLeak[] | undefined;
    getAllConnectionLeaks(): Map<string, ConnectionLeak[]>;
    getCircuitBreakerState(databaseId: string): CircuitBreakerState | undefined;
    resetCircuitBreaker(databaseId: string): void;
    forceHealthCheck(databaseId: string): Promise<void>;
    isPoolHealthy(databaseId: string): boolean;
    private startMaintenanceLoop;
    private performMaintenance;
    /**
     * Get comprehensive resource usage report
     */
    getResourceUsage(): {
        pools: number;
        totalConnections: number;
        activeConnections: number;
        idleConnections: number;
        waitingRequests: number;
        activeTransactions: number;
        preparedStatements: number;
        cachedQueries: number;
        activeStreams: number;
        potentialLeaks: {
            connections: number;
            transactions: number;
            preparedStatements: number;
        };
    };
    /**
     * Detect and report all resource leaks
     */
    detectResourceLeaks(): {
        connectionLeaks: Map<string, ConnectionLeak[]>;
        staleTransactions: Transaction[];
        unusedPreparedStatements: PreparedStatement[];
        oldCacheEntries: number;
    };
    /**
     * Force cleanup of leaked resources
     */
    forceCleanupLeaks(): Promise<{
        connectionsReleased: number;
        transactionsRolledBack: number;
        preparedStatementsClosed: number;
        cacheEntriesCleared: number;
    }>;
    private generateId;
    private delay;
    /**
     * Register a stream for cleanup tracking
     */
    registerStream(stream: NodeJS.ReadableStream | NodeJS.WritableStream): void;
    /**
     * Cleanup all active streams
     */
    private cleanupStreams;
    /**
     * Register a cleanup handler
     */
    registerCleanupHandler(handler: () => Promise<void>): void;
    /**
     * Unregister a cleanup handler
     */
    unregisterCleanupHandler(handler: () => Promise<void>): void;
    /**
     * Check if manager is shutting down
     */
    isShutdown(): boolean;
    /**
     * Wait for ongoing operations to complete
     */
    private drainOperations;
    close(): Promise<void>;
    private _performShutdown;
}
export declare class SecureQueryBuilder {
    private manager;
    private databaseId;
    private dbType;
    private operation;
    private tableName;
    private selectColumns;
    private whereConditions;
    private insertData;
    private updateData;
    private limitValue;
    private offsetValue;
    private orderByColumns;
    private params;
    constructor(manager: DatabasePoolManager, databaseId: string, dbType: DatabaseType);
    select(...columns: string[]): this;
    from(table: string): this;
    insert(table: string): this;
    update(table: string): this;
    delete(table: string): this;
    values(data: Record<string, any>): this;
    set(data: Record<string, any>): this;
    where(column: string, operator: string, value: any): this;
    limit(value: number): this;
    offset(value: number): this;
    orderBy(column: string, direction?: 'ASC' | 'DESC'): this;
    private validateIdentifier;
    private validateOperator;
    private getParameterPlaceholder;
    build(): {
        query: string;
        params: any[];
    };
    private buildSelectQuery;
    private buildInsertQuery;
    private buildUpdateQuery;
    private buildDeleteQuery;
    private buildWhereClause;
    execute<T = any>(options?: QueryOptions): Promise<QueryResult<T>>;
}
export default DatabasePoolManager;
//# sourceMappingURL=DatabasePoolManager.d.ts.map