/**
 * Database Connection Pool Manager
 * Connection pooling, query optimization, transaction management
 * Multi-database support, failover, replication
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type DatabaseType =
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'redis'
  | 'cassandra'
  | 'dynamodb'
  | 'sqlite';

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
  allowedColumns: Map<string, Set<string>>; // table -> columns
  maxQueryTimeout: number;
  requireParameterized: boolean;
  blockDynamicIdentifiers: boolean;
  allowedOperations: Set<SQLOperation>;
  maxResultRows?: number;
  enableQueryLogging: boolean;
}

export type SQLOperation =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'CREATE'
  | 'DROP'
  | 'ALTER'
  | 'TRUNCATE';

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

export type IsolationLevel =
  | 'read_uncommitted'
  | 'read_committed'
  | 'repeatable_read'
  | 'serializable';

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

// ============================================================================
// Database Pool Manager
// ============================================================================

export class DatabasePoolManager extends EventEmitter {
  private pools: Map<string, ConnectionPool> = new Map();
  private databases: Map<string, DatabaseConfig> = new Map();
  private queryCache: Map<string, QueryCache> = new Map();
  private preparedStatements: Map<string, PreparedStatement> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private migrations: Map<string, Migration[]> = new Map();
  private securityConfigs: Map<string, SecurityConfig> = new Map();
  private queryAuditLogs: QueryAuditLog[] = [];
  private maintenanceInterval: NodeJS.Timeout | null = null;
  private readonly TRANSACTION_TIMEOUT = 300000; // 5 minutes
  private readonly MAX_TRANSACTION_AGE = 3600000; // 1 hour
  private readonly MAX_AUDIT_LOG_SIZE = 10000;
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private activeStreams: Set<NodeJS.ReadableStream | NodeJS.WritableStream> = new Set();
  private cleanupHandlers: Array<() => Promise<void>> = [];

  constructor() {
    super();
    this.startMaintenanceLoop();
    this.setupProcessHandlers();
  }

  private setupProcessHandlers(): void {
    // Graceful shutdown on process signals
    const shutdownHandler = () => {
      if (!this.isShuttingDown) {
        this.close().catch(err => {
          console.error('Error during graceful shutdown:', err);
          process.exit(1);
        });
      }
    };

    process.once('SIGTERM', shutdownHandler);
    process.once('SIGINT', shutdownHandler);
  }

  // ========================================================================
  // Database Management
  // ========================================================================

  public async registerDatabase(config: DatabaseConfig): Promise<void> {
    this.databases.set(config.id, config);

    const poolConfig: PoolConfig = {
      min: 2,
      max: 10,
      acquireTimeout: 30000,
      idleTimeout: 600000,
      evictionInterval: 60000,
      testOnBorrow: true,
      testOnReturn: false,
      testWhileIdle: true,
      validationQuery: 'SELECT 1',
      maxRetries: 3,
      retryDelay: 1000,
      leakDetectionThreshold: 300000, // 5 minutes
      exhaustionAlertThreshold: 0.9, // 90% utilization
      healthCheck: {
        enabled: true,
        interval: 30000, // 30 seconds
        timeout: 5000,
        healthyThreshold: 3,
        unhealthyThreshold: 3,
        query: 'SELECT 1',
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 1 minute
        halfOpenMaxAttempts: 3,
      },
      ...config.poolConfig,
    };

    const pool = new ConnectionPool(config, poolConfig, this);
    await pool.initialize();

    this.pools.set(config.id, pool);
    this.emit('database:registered', { databaseId: config.id });
  }

  public async unregisterDatabase(databaseId: string): Promise<void> {
    const pool = this.pools.get(databaseId);
    if (pool) {
      await pool.close();
      this.pools.delete(databaseId);
    }

    this.databases.delete(databaseId);
    this.emit('database:unregistered', { databaseId });
  }

  public getDatabase(databaseId: string): DatabaseConfig | undefined {
    return this.databases.get(databaseId);
  }

  /**
   * Lists all registered databases.
   * @returns Array of database configurations
   */
  public listDatabases(): DatabaseConfig[] {
    return Array.from(this.databases.values());
  }

  // ========================================================================
  // Security Configuration
  // ========================================================================

  public setSecurityConfig(databaseId: string, config: Partial<SecurityConfig>): void {
    const defaultConfig: SecurityConfig = {
      allowedTables: new Set(['*']),
      allowedColumns: new Map(),
      maxQueryTimeout: 30000,
      requireParameterized: true,
      blockDynamicIdentifiers: true,
      allowedOperations: new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
      maxResultRows: 10000,
      enableQueryLogging: true,
    };

    // Merge with defaults, ensuring all required fields are present
    const merged: SecurityConfig = {
      ...defaultConfig,
      ...config,
      allowedTables: config.allowedTables || defaultConfig.allowedTables,
      allowedColumns: config.allowedColumns || defaultConfig.allowedColumns,
      allowedOperations: config.allowedOperations || defaultConfig.allowedOperations,
    };

    this.securityConfigs.set(databaseId, merged);
    this.emit('security:config_updated', { databaseId, config: merged });
  }

  public getSecurityConfig(databaseId: string): SecurityConfig | undefined {
    return this.securityConfigs.get(databaseId);
  }

  // ========================================================================
  // SQL Parsing and Validation
  // ========================================================================

  /**
   * Parses SQL query and extracts metadata for security validation.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Parsed query metadata
   * @throws Error if query cannot be parsed or operation is invalid
   */
  private parseSQL(sql: string, params: any[]): ParsedQuery {
    const normalized = sql.trim().toUpperCase();

    // Extract operation with explicit null check
    const operationMatch = normalized.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)/);
    if (!operationMatch || !operationMatch[1]) {
      throw new Error('Unable to determine SQL operation - invalid or unsupported query format');
    }
    const operation = operationMatch[1] as SQLOperation;

    // Extract tables
    const tables = this.extractTables(sql);

    // Extract columns
    const columns = this.extractColumns(sql);

    // Check for subqueries
    const hasSubqueries = /\(\s*SELECT\s+/i.test(sql);

    // Check for dynamic identifiers (identifiers not properly parameterized)
    const hasDynamicIdentifiers = this.detectDynamicIdentifiers(sql);

    // Check if query is parameterized
    const isParameterized = params.length > 0 || !this.hasUnparameterizedValues(sql);

    // Count parameters
    const parameterCount = (sql.match(/\$\d+|\?/g) || []).length;

    return {
      operation,
      tables,
      columns,
      hasSubqueries,
      hasDynamicIdentifiers,
      isParameterized,
      parameterCount,
      rawSQL: sql,
    };
  }

  /**
   * Extracts table names from SQL query.
   * @param sql - SQL query string
   * @returns Array of table names found in the query
   */
  private extractTables(sql: string): string[] {
    const tables: string[] = [];
    const normalized = sql.replace(/\s+/g, ' ');

    // Match FROM clause with null check
    const fromMatch = normalized.match(/\bFROM\s+([^\s,;(]+(?:\s*,\s*[^\s,;(]+)*)/i);
    if (fromMatch && fromMatch[1]) {
      const tableList = fromMatch[1].split(',').map(t => {
        const parts = t.trim().split(/\s+/);
        return parts[0] || t.trim();
      });
      tables.push(...tableList);
    }

    // Match JOIN clauses with null checks
    const joinMatches = normalized.matchAll(/\bJOIN\s+([^\s,;(]+)/gi);
    for (const match of joinMatches) {
      if (match[1]) {
        tables.push(match[1].trim());
      }
    }

    // Match INSERT INTO with null check
    const insertMatch = normalized.match(/\bINSERT\s+INTO\s+([^\s(,;]+)/i);
    if (insertMatch && insertMatch[1]) {
      tables.push(insertMatch[1].trim());
    }

    // Match UPDATE with null check
    const updateMatch = normalized.match(/\bUPDATE\s+([^\s,;]+)/i);
    if (updateMatch && updateMatch[1]) {
      tables.push(updateMatch[1].trim());
    }

    // Clean table names (remove quotes, schemas)
    return tables.map(t => t.replace(/["'`]/g, '').split('.').pop() || t);
  }

  /**
   * Extracts column names from SQL query.
   * @param sql - SQL query string
   * @returns Array of column names found in the query
   */
  private extractColumns(sql: string): string[] {
    const columns: string[] = [];
    const normalized = sql.replace(/\s+/g, ' ');

    // Match SELECT columns with null check
    const selectMatch = normalized.match(/\bSELECT\s+(.+?)\s+FROM/i);
    if (selectMatch && selectMatch[1]) {
      const columnList = selectMatch[1];
      if (columnList.trim() !== '*') {
        const cols = columnList.split(',').map(c => {
          // Extract column name from "table.column AS alias" or just "column"
          const parts = c.trim().split(/\s+AS\s+/i);
          const cleaned = parts[0] || c.trim();
          const columnPart = cleaned.split('.').pop();
          return columnPart?.replace(/["'`]/g, '') || cleaned;
        });
        columns.push(...cols);
      }
    }

    // Match INSERT columns with null check
    const insertMatch = normalized.match(/\bINSERT\s+INTO\s+[^\s(]+\s*\(([^)]+)\)/i);
    if (insertMatch && insertMatch[1]) {
      const cols = insertMatch[1].split(',').map(c => c.trim().replace(/["'`]/g, ''));
      columns.push(...cols);
    }

    // Match UPDATE SET columns with null checks
    const updateMatches = normalized.matchAll(/\bSET\s+([^=\s]+)\s*=/gi);
    for (const match of updateMatches) {
      if (match[1]) {
        columns.push(match[1].trim().replace(/["'`]/g, ''));
      }
    }

    return [...new Set(columns)].filter(c => c && c !== '*');
  }

  private detectDynamicIdentifiers(sql: string): boolean {
    // Check for string concatenation patterns that might inject table/column names
    // This is a heuristic check
    const suspiciousPatterns = [
      /\${[^}]+}/,  // Template literals
      /\+\s*["'`]/,  // String concatenation
      /["'`]\s*\+/,  // String concatenation
    ];

    return suspiciousPatterns.some(pattern => pattern.test(sql));
  }

  private hasUnparameterizedValues(sql: string): boolean {
    // Check for literal values in WHERE clauses (potential SQL injection)
    // This is a simplified check - in production, use a proper SQL parser
    const whereMatch = sql.match(/\bWHERE\s+.+/i);
    if (!whereMatch) {
      return false;
    }

    const whereClause = whereMatch[0];
    // Check for string literals that aren't parameters
    const hasLiterals = /=\s*['"][^'"]*['"]/.test(whereClause) && !/\$\d+|\?/.test(whereClause);

    return hasLiterals;
  }

  private validateQuery(parsedQuery: ParsedQuery, securityConfig: SecurityConfig): void {
    // 1. Validate operation is allowed
    if (!securityConfig.allowedOperations.has(parsedQuery.operation)) {
      throw new Error(`Operation ${parsedQuery.operation} is not allowed`);
    }

    // 2. Validate tables are whitelisted
    if (!securityConfig.allowedTables.has('*')) {
      for (const table of parsedQuery.tables) {
        if (!securityConfig.allowedTables.has(table)) {
          throw new Error(`Access to table '${table}' is not allowed`);
        }
      }
    }

    // 3. Validate columns are whitelisted (if configured)
    for (const table of parsedQuery.tables) {
      const allowedColumns = securityConfig.allowedColumns.get(table);
      if (allowedColumns && allowedColumns.size > 0) {
        for (const column of parsedQuery.columns) {
          if (!allowedColumns.has(column) && !allowedColumns.has('*')) {
            throw new Error(`Access to column '${column}' in table '${table}' is not allowed`);
          }
        }
      }
    }

    // 4. Enforce parameterized queries
    if (securityConfig.requireParameterized && !parsedQuery.isParameterized) {
      throw new Error('Non-parameterized queries are not allowed. Use prepared statements with parameters.');
    }

    // 5. Block dynamic identifiers
    if (securityConfig.blockDynamicIdentifiers && parsedQuery.hasDynamicIdentifiers) {
      throw new Error('Dynamic table or column names from user input are not allowed');
    }

    // 6. Additional validation for dangerous operations
    if (parsedQuery.operation === 'DELETE' || parsedQuery.operation === 'TRUNCATE') {
      // Ensure DELETE has a WHERE clause (prevent accidental mass deletion)
      if (parsedQuery.operation === 'DELETE' && !/\bWHERE\b/i.test(parsedQuery.rawSQL)) {
        throw new Error('DELETE without WHERE clause is not allowed');
      }
    }

    if (parsedQuery.operation === 'DROP' || parsedQuery.operation === 'TRUNCATE') {
      // These operations should typically not be allowed in application code
      throw new Error(`${parsedQuery.operation} operation requires explicit approval`);
    }
  }

  // ========================================================================
  // Secure Query Execution
  // ========================================================================

  public async query<T = any>(
    databaseId: string,
    query: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    if (this.isShuttingDown) {
      throw new Error('DatabasePoolManager is shutting down');
    }

    const startTime = Date.now();
    const auditLogId = this.generateId();
    let connection: Connection | undefined;
    let pool: ConnectionPool | undefined;

    try {
      // Get security configuration
      const securityConfig = this.securityConfigs.get(databaseId);

      // Parse and validate SQL
      let parsedQuery: ParsedQuery | null = null;
      if (securityConfig && !options.skipValidation) {
        parsedQuery = this.parseSQL(query, params);
        this.validateQuery(parsedQuery, securityConfig);
      }

      // Apply query timeout from security config
      const queryTimeout = securityConfig?.maxQueryTimeout || options.timeout || 30000;
      const effectiveOptions: QueryOptions = {
        ...options,
        timeout: Math.min(queryTimeout, options.timeout || queryTimeout),
      };

      // Check cache
      if (effectiveOptions.cache) {
        const cached = this.getCachedQuery(databaseId, query, params);
        if (cached) {
          this.emit('query:cache_hit', { databaseId, query });

          // Log cache hit
          if (securityConfig?.enableQueryLogging) {
            this.logQuery({
              id: auditLogId,
              databaseId,
              query,
              params,
              operation: parsedQuery?.operation || 'SELECT',
              executionTime: Date.now() - startTime,
              rowCount: cached.rowCount,
              success: true,
              timestamp: Date.now(),
            });
          }

          return cached as QueryResult<T>;
        }
      }

      pool = this.pools.get(databaseId);
      if (!pool) {
        throw new Error(`Database not found: ${databaseId}`);
      }

      let retries = effectiveOptions.retries || 0;
      let lastError: Error | undefined;

      while (retries >= 0) {
        try {
          // Use replica for read-only queries
          if (effectiveOptions.readOnly || effectiveOptions.useReplica) {
            connection = await pool.acquireReplica();
          } else {
            connection = await pool.acquire();
          }

          // Execute with timeout protection
          const result = await this.executeQueryWithTimeout<T>(
            connection,
            query,
            params,
            effectiveOptions
          );

          result.executionTime = Date.now() - startTime;

          // Apply max result rows limit
          if (securityConfig?.maxResultRows && result.rows.length > securityConfig.maxResultRows) {
            throw new Error(`Query returned ${result.rows.length} rows, exceeding limit of ${securityConfig.maxResultRows}`);
          }

          // Cache result if requested
          if (effectiveOptions.cache && result.rowCount > 0) {
            this.cacheQuery(databaseId, query, params, result, effectiveOptions.cacheTTL || 300000);
          }

          // Log successful query
          if (securityConfig?.enableQueryLogging && effectiveOptions.logLevel !== 'none') {
            this.logQuery({
              id: auditLogId,
              databaseId,
              query,
              params: effectiveOptions.logLevel === 'detailed' ? params : [],
              operation: parsedQuery?.operation || 'UNKNOWN',
              executionTime: result.executionTime,
              rowCount: result.rowCount,
              success: true,
              timestamp: Date.now(),
            });
          }

          this.emit('query:success', {
            databaseId,
            query,
            executionTime: result.executionTime,
            rowCount: result.rowCount
          });

          return result;
        } catch (error) {
          lastError = error as Error;

          if (retries > 0) {
            await this.delay(effectiveOptions.retries ? 1000 : 0);
            retries--;
          } else {
            break;
          }
        } finally {
          // Always release connection in finally block
          if (connection && pool) {
            try {
              await pool.release(connection, !!lastError);
            } catch (releaseError) {
              console.error('Error releasing connection:', releaseError);
            }
            connection = undefined;
          }
        }
      }

      // Log failed query
      if (securityConfig?.enableQueryLogging) {
        this.logQuery({
          id: auditLogId,
          databaseId,
          query,
          params: effectiveOptions.logLevel === 'detailed' ? params : [],
          operation: parsedQuery?.operation || 'UNKNOWN',
          executionTime: Date.now() - startTime,
          rowCount: 0,
          success: false,
          error: lastError?.message,
          timestamp: Date.now(),
        });
      }

      this.emit('query:error', { databaseId, query, error: lastError });
      throw lastError;
    } catch (error) {
      // Log validation or other errors
      const securityConfig = this.securityConfigs.get(databaseId);
      if (securityConfig?.enableQueryLogging) {
        this.logQuery({
          id: auditLogId,
          databaseId,
          query,
          params: options.logLevel === 'detailed' ? params : [],
          operation: 'UNKNOWN',
          executionTime: Date.now() - startTime,
          rowCount: 0,
          success: false,
          error: (error as Error).message,
          timestamp: Date.now(),
        });
      }
      throw error;
    } finally {
      // Final cleanup in case something was missed
      if (connection && pool) {
        try {
          await pool.release(connection, true);
        } catch (releaseError) {
          console.error('Error in final connection cleanup:', releaseError);
        }
      }
    }
  }

  private async executeQueryWithTimeout<T>(
    connection: Connection,
    query: string,
    params: any[],
    options: QueryOptions
  ): Promise<QueryResult<T>> {
    const timeout = options.timeout || 30000;

    return Promise.race([
      this.executeQuery<T>(connection, query, params, options),
      new Promise<QueryResult<T>>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  private async executeQuery<T>(
    connection: Connection,
    query: string,
    params: any[],
    options: QueryOptions
  ): Promise<QueryResult<T>> {
    const database = this.databases.get(connection.databaseId);
    if (!database) {
      throw new Error(`Database config not found: ${connection.databaseId}`);
    }

    // Use prepared statements for better security
    if (options.prepare !== false && params.length > 0) {
      return await this.executeWithPreparedStatement<T>(connection, query, params, database);
    }

    // Execute based on database type
    switch (database.type) {
      case 'postgresql':
        return await this.executePostgreSQLQuery<T>(connection, query, params);

      case 'mysql':
        return await this.executeMySQLQuery<T>(connection, query, params);

      case 'mongodb':
        return await this.executeMongoQuery<T>(connection, query, params);

      case 'redis':
        return await this.executeRedisCommand<T>(connection, query, params);

      default:
        throw new Error(`Unsupported database type: ${database.type}`);
    }
  }

  private async executeWithPreparedStatement<T>(
    connection: Connection,
    query: string,
    params: any[],
    database: DatabaseConfig
  ): Promise<QueryResult<T>> {
    // Create or reuse prepared statement
    const key = `${connection.databaseId}:${query}`;
    let stmt = this.preparedStatements.get(key);

    try {
      if (!stmt) {
        // Prepare statement based on database type
        let native: any;

        switch (database.type) {
          case 'postgresql':
          case 'mysql':
            // Native drivers handle prepared statements
            native = { query, connection: connection.native };
            break;

          default:
            // Fallback to regular execution
            return await this.executeQuery<T>(connection, query, params, { prepare: false });
        }

        stmt = {
          id: this.generateId(),
          query,
          databaseId: connection.databaseId,
          native,
          executionCount: 0,
        };

        this.preparedStatements.set(key, stmt);
      }

      stmt.executionCount++;
      stmt.lastExecuted = Date.now();

      // Execute prepared statement
      let result: any;

      switch (database.type) {
        case 'postgresql':
          result = await connection.native.query(query, params);
          return {
            rows: result.rows || [],
            rowCount: result.rowCount || 0,
            fields: result.fields?.map((f: any) => ({
              name: f.name,
              type: f.dataTypeID,
              nullable: true,
            })),
            executionTime: 0,
          };

        case 'mysql':
          const [rows, fields] = await connection.native.execute(query, params);
          return {
            rows: rows || [],
            rowCount: Array.isArray(rows) ? rows.length : 0,
            fields: fields?.map((f: any) => ({
              name: f.name,
              type: f.type,
              nullable: true,
            })),
            executionTime: 0,
          };

        default:
          throw new Error(`Prepared statements not supported for ${database.type}`);
      }
    } catch (error) {
      // Remove failed prepared statement
      if (stmt) {
        this.preparedStatements.delete(key);
      }
      throw error;
    }
  }

  private async executePostgreSQLQuery<T>(
    connection: Connection,
    query: string,
    params: any[]
  ): Promise<QueryResult<T>> {
    const timeout = 30000;
    try {
      const result = await Promise.race([
        connection.native.query(query, params),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PostgreSQL query timeout')), timeout)
        ),
      ]);

      return {
        rows: result.rows || [],
        rowCount: result.rowCount || 0,
        fields: result.fields?.map((f: any) => ({
          name: f.name,
          type: f.dataTypeID,
          nullable: true,
        })),
        executionTime: 0,
      };
    } catch (error) {
      console.error('PostgreSQL query execution failed:', {
        connectionId: connection.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeMySQLQuery<T>(
    connection: Connection,
    query: string,
    params: any[]
  ): Promise<QueryResult<T>> {
    const [rows, fields] = await connection.native.execute(query, params);

    return {
      rows: rows || [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      fields: fields?.map((f: any) => ({
        name: f.name,
        type: f.type,
        nullable: true,
      })),
      executionTime: 0,
    };
  }

  private async executeMongoQuery<T>(
    connection: Connection,
    query: string,
    params: any[]
  ): Promise<QueryResult<T>> {
    const timeout = 30000;
    try {
      // Parse MongoDB query
      const queryObj = JSON.parse(query);
      const collection = connection.native.collection(queryObj.collection);

      let rows: any[];

      const executeOperation = async () => {
        switch (queryObj.operation) {
          case 'find':
            return await collection.find(queryObj.filter || {}).toArray();

          case 'findOne':
            const findOneResult = await collection.findOne(queryObj.filter || {});
            return [findOneResult];

          case 'insert':
            const insertResult = await collection.insertOne(queryObj.document);
            return [{ insertedId: insertResult.insertedId }];

          case 'update':
            const updateResult = await collection.updateMany(
              queryObj.filter || {},
              queryObj.update
            );
            return [{ modifiedCount: updateResult.modifiedCount }];

          case 'delete':
            const deleteResult = await collection.deleteMany(queryObj.filter || {});
            return [{ deletedCount: deleteResult.deletedCount }];

          default:
            throw new Error(`Unknown MongoDB operation: ${queryObj.operation}`);
        }
      };

      rows = await Promise.race([
        executeOperation(),
        new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error('MongoDB query timeout')), timeout)
        ),
      ]);

      return {
        rows: rows.filter(Boolean),
        rowCount: rows.length,
        executionTime: 0,
      };
    } catch (error) {
      console.error('MongoDB query execution failed:', {
        connectionId: connection.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Handle edge case: invalid JSON query
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid MongoDB query JSON: ${error.message}`);
      }
      throw error;
    }
  }

  private async executeRedisCommand<T>(
    connection: Connection,
    command: string,
    args: any[]
  ): Promise<QueryResult<T>> {
    const timeout = 30000;
    try {
      // Validate command exists
      const commandLower = command.toLowerCase();
      if (typeof connection.native[commandLower] !== 'function') {
        throw new Error(`Unknown Redis command: ${command}`);
      }

      const result = await Promise.race([
        connection.native[commandLower](...args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis command timeout')), timeout)
        ),
      ]);

      return {
        rows: Array.isArray(result) ? result : [result],
        rowCount: Array.isArray(result) ? result.length : 1,
        executionTime: 0,
      };
    } catch (error) {
      console.error('Redis command execution failed:', {
        connectionId: connection.id,
        command,
        error: error instanceof Error ? error.message : String(error),
      });
      // Handle edge case: null/undefined result
      if (error instanceof TypeError) {
        throw new Error(`Redis command failed: ${command} - ${error.message}`);
      }
      throw error;
    }
  }

  // ========================================================================
  // Query Logging and Monitoring
  // ========================================================================

  private logQuery(log: QueryAuditLog): void {
    try {
      this.queryAuditLogs.push(log);

      // Limit log size
      if (this.queryAuditLogs.length > this.MAX_AUDIT_LOG_SIZE) {
        this.queryAuditLogs = this.queryAuditLogs.slice(-this.MAX_AUDIT_LOG_SIZE);
      }

      this.emit('query:logged', log);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to log query:', errorMessage);
      this.emit('query:log_error', {
        queryId: log.id,
        error: errorMessage
      });
    }
  }

  public getQueryLogs(options?: {
    databaseId?: string;
    operation?: SQLOperation;
    success?: boolean;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): QueryAuditLog[] {
    let logs = this.queryAuditLogs;

    if (options?.databaseId) {
      logs = logs.filter(l => l.databaseId === options.databaseId);
    }

    if (options?.operation) {
      logs = logs.filter(l => l.operation === options.operation);
    }

    if (options?.success !== undefined) {
      logs = logs.filter(l => l.success === options.success);
    }

    if (options?.startTime) {
      logs = logs.filter(l => l.timestamp >= options.startTime!);
    }

    if (options?.endTime) {
      logs = logs.filter(l => l.timestamp <= options.endTime!);
    }

    if (options?.limit) {
      logs = logs.slice(-options.limit);
    }

    return logs;
  }

  public getQueryStatistics(databaseId?: string): {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageExecutionTime: number;
    slowestQuery: QueryAuditLog | null;
    fastestQuery: QueryAuditLog | null;
    operationBreakdown: Map<SQLOperation, number>;
  } {
    try {
      let logs = this.queryAuditLogs;

    if (databaseId) {
      logs = logs.filter(l => l.databaseId === databaseId);
    }

    const totalQueries = logs.length;
    const successfulQueries = logs.filter(l => l.success).length;
    const failedQueries = logs.filter(l => !l.success).length;

    const executionTimes = logs.map(l => l.executionTime);
    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;

    // Find slowest query with proper null handling
    const slowestQuery = logs.length > 0
      ? logs.reduce<QueryAuditLog | null>((slowest, log) =>
          !slowest || log.executionTime > slowest.executionTime ? log : slowest,
          null
        )
      : null;

    const fastestQuery = logs.reduce((fastest, log) =>
      !fastest || log.executionTime < fastest.executionTime ? log : fastest,
      null as QueryAuditLog | null
    );

    const operationBreakdown = new Map<SQLOperation, number>();
    for (const log of logs) {
      operationBreakdown.set(log.operation, (operationBreakdown.get(log.operation) || 0) + 1);
    }

      return {
        totalQueries,
        successfulQueries,
        failedQueries,
        averageExecutionTime,
        slowestQuery,
        fastestQuery,
        operationBreakdown,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get query statistics:', errorMessage);
      this.emit('query:statistics_error', { databaseId, error: errorMessage });

      // Return default statistics on error
      return {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        averageExecutionTime: 0,
        slowestQuery: null,
        fastestQuery: null,
        operationBreakdown: new Map(),
      };
    }
  }

  public clearQueryLogs(databaseId?: string): void {
    if (databaseId) {
      this.queryAuditLogs = this.queryAuditLogs.filter(l => l.databaseId !== databaseId);
    } else {
      this.queryAuditLogs = [];
    }

    this.emit('query_logs:cleared', { databaseId });
  }

  // ========================================================================
  // Secure Query Builder API
  // ========================================================================

  public createQueryBuilder(databaseId: string): SecureQueryBuilder {
    const database = this.databases.get(databaseId);
    if (!database) {
      throw new Error(`Database not found: ${databaseId}`);
    }

    return new SecureQueryBuilder(this, databaseId, database.type);
  }

  public async beginTransaction(
    databaseId: string,
    isolationLevel: IsolationLevel = 'read_committed'
  ): Promise<Transaction> {
    if (this.isShuttingDown) {
      throw new Error('Cannot begin transaction during shutdown');
    }

    const pool = this.pools.get(databaseId);
    if (!pool) {
      throw new Error(`Database not found: ${databaseId}`);
    }

    let connection: Connection | undefined;

    try {
      connection = await pool.acquire();
      connection.inTransaction = true;

      // Begin transaction based on database type
      const database = this.databases.get(databaseId);
      if (!database) {
        throw new Error(`Database config not found: ${databaseId}`);
      }

      switch (database.type) {
        case 'postgresql':
        case 'mysql':
          await connection.native.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel.toUpperCase().replace('_', ' ')}`);
          break;

        case 'mongodb':
          // MongoDB sessions for transactions
          break;

        default:
          break;
      }

      const transaction: Transaction = {
        id: this.generateId(),
        connectionId: connection.id,
        startTime: Date.now(),
        operations: [],
        state: 'active',
        isolationLevel,
        savepoints: [],
      };

      this.transactions.set(transaction.id, transaction);
      this.emit('transaction:begin', { transaction });

      return transaction;
    } catch (error) {
      // Rollback and release connection on error
      if (connection) {
        connection.inTransaction = false;
        try {
          await pool.release(connection, true);
        } catch (releaseError) {
          console.error('Error releasing connection after transaction begin failure:', releaseError);
        }
      }
      throw error;
    }
  }

  public async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.state !== 'active') {
      throw new Error(`Cannot commit transaction in state: ${transaction.state}`);
    }

    const pool = this.pools.get(transaction.connectionId.split('-')[0]);
    if (!pool) {
      throw new Error('Pool not found');
    }

    const connection = pool.getConnection(transaction.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    try {
      await connection.native.query('COMMIT');
      transaction.state = 'committed';
      connection.inTransaction = false;

      this.emit('transaction:commit', { transaction });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      transaction.state = 'failed';
      console.error(`Transaction commit failed for ${transactionId}:`, errorMessage);
      this.emit('transaction:commit_error', {
        transactionId,
        error: errorMessage
      });
      throw error;
    } finally {
      // Always release connection and cleanup transaction
      try {
        await pool.release(connection);
      } catch (releaseError) {
        console.error('Error releasing connection after commit:', releaseError);
      }
      this.transactions.delete(transactionId);
    }
  }

  public async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const pool = this.pools.get(transaction.connectionId.split('-')[0]);
    if (!pool) {
      throw new Error('Pool not found');
    }

    const connection = pool.getConnection(transaction.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    try {
      await connection.native.query('ROLLBACK');
      transaction.state = 'rolled_back';
      connection.inTransaction = false;

      this.emit('transaction:rollback', { transaction });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      transaction.state = 'failed';
      console.error(`Transaction rollback failed for ${transactionId}:`, errorMessage);
      this.emit('transaction:rollback_error', {
        transactionId,
        error: errorMessage
      });
      throw error;
    } finally {
      // Always release connection and cleanup transaction
      try {
        await pool.release(connection, true);
      } catch (releaseError) {
        console.error('Error releasing connection after rollback:', releaseError);
      }
      this.transactions.delete(transactionId);
    }
  }

  public async createSavepoint(
    transactionId: string,
    name: string
  ): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const pool = this.pools.get(transaction.connectionId.split('-')[0]);
    const connection = pool?.getConnection(transaction.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    await connection.native.query(`SAVEPOINT ${name}`);
    transaction.savepoints.push(name);

    transaction.operations.push({
      type: 'savepoint',
      timestamp: Date.now(),
    });

    this.emit('transaction:savepoint', { transaction, name });
  }

  public async rollbackToSavepoint(
    transactionId: string,
    name: string
  ): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const pool = this.pools.get(transaction.connectionId.split('-')[0]);
    const connection = pool?.getConnection(transaction.connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    await connection.native.query(`ROLLBACK TO SAVEPOINT ${name}`);

    transaction.operations.push({
      type: 'rollback_to_savepoint',
      timestamp: Date.now(),
    });

    this.emit('transaction:rollback_to_savepoint', { transaction, name });
  }

  // ========================================================================
  // Prepared Statements
  // ========================================================================

  public async prepare(
    databaseId: string,
    query: string
  ): Promise<PreparedStatement> {
    if (this.isShuttingDown) {
      throw new Error('Cannot prepare statement during shutdown');
    }

    const key = `${databaseId}:${query}`;
    let stmt = this.preparedStatements.get(key);

    if (stmt) {
      return stmt;
    }

    const pool = this.pools.get(databaseId);
    if (!pool) {
      throw new Error(`Database not found: ${databaseId}`);
    }

    let connection: Connection | undefined;

    try {
      connection = await pool.acquire();
      const native = await connection.native.prepare(query);

      stmt = {
        id: this.generateId(),
        query,
        databaseId,
        native,
        executionCount: 0,
      };

      this.preparedStatements.set(key, stmt);
      this.emit('prepared_statement:created', { statement: stmt });

      return stmt;
    } catch (error) {
      throw error;
    } finally {
      // Always release connection
      if (connection && pool) {
        try {
          await pool.release(connection, !stmt);
        } catch (releaseError) {
          console.error('Error releasing connection after prepare:', releaseError);
        }
      }
    }
  }

  public async executePrepared<T = any>(
    statementId: string,
    params: any[]
  ): Promise<QueryResult<T>> {
    const stmt = Array.from(this.preparedStatements.values()).find(
      s => s.id === statementId
    );

    if (!stmt) {
      throw new Error(`Prepared statement not found: ${statementId}`);
    }

    stmt.executionCount++;
    stmt.lastExecuted = Date.now();

    const result = await stmt.native.execute(params);

    return {
      rows: result.rows || result,
      rowCount: result.rowCount || (Array.isArray(result) ? result.length : 1),
      executionTime: 0,
    };
  }

  // ========================================================================
  // Query Caching
  // ========================================================================

  private getCachedQuery(
    databaseId: string,
    query: string,
    params: any[]
  ): QueryResult | null {
    const key = this.getQueryCacheKey(databaseId, query, params);
    const cached = this.queryCache.get(key);

    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    cached.hits++;
    return { ...cached.result, fromCache: true };
  }

  private cacheQuery(
    databaseId: string,
    query: string,
    params: any[],
    result: QueryResult,
    ttl: number
  ): void {
    const key = this.getQueryCacheKey(databaseId, query, params);

    const cached: QueryCache = {
      key,
      result,
      timestamp: Date.now(),
      ttl,
      hits: 0,
    };

    this.queryCache.set(key, cached);

    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldest = Array.from(this.queryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 100);

      for (const [key] of oldest) {
        this.queryCache.delete(key);
      }
    }
  }

  private getQueryCacheKey(
    databaseId: string,
    query: string,
    params: any[]
  ): string {
    return `${databaseId}:${query}:${JSON.stringify(params)}`;
  }

  public clearQueryCache(databaseId?: string): void {
    if (databaseId) {
      for (const [key] of this.queryCache.entries()) {
        if (key.startsWith(`${databaseId}:`)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }

    this.emit('cache:cleared', { databaseId });
  }

  // ========================================================================
  // Query Analysis
  // ========================================================================

  public async explainQuery(
    databaseId: string,
    query: string,
    params: any[] = []
  ): Promise<QueryPlan> {
    const pool = this.pools.get(databaseId);
    if (!pool) {
      throw new Error(`Database not found: ${databaseId}`);
    }

    let connection: Connection | undefined;

    try {
      connection = await pool.acquire();
      const database = this.databases.get(databaseId);
      let plan: any;

      switch (database?.type) {
        case 'postgresql':
          const pgResult = await connection.native.query(`EXPLAIN (FORMAT JSON) ${query}`, params);
          plan = pgResult.rows[0]['QUERY PLAN'];
          break;

        case 'mysql':
          const mysqlResult = await connection.native.query(`EXPLAIN FORMAT=JSON ${query}`, params);
          plan = mysqlResult[0];
          break;

        default:
          throw new Error(`EXPLAIN not supported for ${database?.type}`);
      }

      return {
        query,
        plan,
        cost: this.extractCost(plan),
        estimatedRows: this.extractRows(plan),
      };
    } catch (error) {
      throw error;
    } finally {
      // Always release connection
      if (connection && pool) {
        try {
          await pool.release(connection, false);
        } catch (releaseError) {
          console.error('Error releasing connection after EXPLAIN:', releaseError);
        }
      }
    }
  }

  private extractCost(plan: any): number {
    if (plan['Total Cost']) return plan['Total Cost'];
    if (plan.cost_info?.query_cost) return parseFloat(plan.cost_info.query_cost);
    return 0;
  }

  private extractRows(plan: any): number {
    if (plan['Plan Rows']) return plan['Plan Rows'];
    if (plan.rows_examined_per_scan) return plan.rows_examined_per_scan;
    return 0;
  }

  public async analyzeIndexes(
    databaseId: string,
    table: string
  ): Promise<IndexAnalysis[]> {
    const database = this.databases.get(databaseId);
    if (!database) {
      throw new Error(`Database not found: ${databaseId}`);
    }

    const analyses: IndexAnalysis[] = [];

    switch (database.type) {
      case 'postgresql':
        const pgQuery = `
          SELECT
            schemaname,
            tablename,
            indexname,
            idx_scan as usage,
            pg_size_pretty(pg_relation_size(indexrelid)) as size
          FROM pg_stat_user_indexes
          WHERE tablename = $1
        `;
        const result = await this.query(databaseId, pgQuery, [table]);

        for (const row of result.rows) {
          analyses.push({
            table,
            index: row.indexname,
            columns: [],
            type: 'btree',
            usage: row.usage,
            size: this.parseSizeString(row.size),
            recommendation: row.usage === 0 ? 'Consider dropping unused index' : 'Index is being used',
          });
        }
        break;

      case 'mysql':
        // Similar analysis for MySQL
        break;
    }

    return analyses;
  }

  /**
   * Parses a human-readable size string into bytes.
   * @param sizeStr - Size string (e.g., "5.2 MB")
   * @returns Size in bytes, or 0 if parsing fails
   */
  private parseSizeString(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(\w+)$/);
    if (!match || !match[1] || !match[2]) {
      return 0;
    }

    const value = match[1];
    const unit = match[2];
    const num = parseFloat(value);

    switch (unit.toLowerCase()) {
      case 'kb': return num * 1024;
      case 'mb': return num * 1024 * 1024;
      case 'gb': return num * 1024 * 1024 * 1024;
      default: return num;
    }
  }

  // ========================================================================
  // Migration Management
  // ========================================================================

  public async runMigrations(
    databaseId: string,
    migrations: Migration[]
  ): Promise<void> {
    const applied = this.migrations.get(databaseId) || [];
    const pending = migrations.filter(
      m => !applied.find(a => a.version === m.version)
    );

    for (const migration of pending.sort((a, b) => a.version - b.version)) {
      let transaction: Transaction | undefined;

      try {
        transaction = await this.beginTransaction(databaseId);
        await this.query(databaseId, migration.up);
        migration.appliedAt = Date.now();

        await this.commitTransaction(transaction.id);

        applied.push(migration);
        this.emit('migration:applied', { databaseId, migration });
      } catch (error) {
        // Rollback transaction on error
        if (transaction) {
          try {
            await this.rollbackTransaction(transaction.id);
          } catch (rollbackError) {
            console.error('Error rolling back migration transaction:', rollbackError);
          }
        }
        throw new Error(`Migration ${migration.name} failed: ${error}`);
      }
    }

    this.migrations.set(databaseId, applied);
  }

  public async rollbackMigration(
    databaseId: string,
    version: number
  ): Promise<void> {
    const applied = this.migrations.get(databaseId) || [];
    const migration = applied.find(m => m.version === version);

    if (!migration) {
      throw new Error(`Migration ${version} not found or not applied`);
    }

    let transaction: Transaction | undefined;

    try {
      transaction = await this.beginTransaction(databaseId);
      await this.query(databaseId, migration.down);
      await this.commitTransaction(transaction.id);

      const index = applied.indexOf(migration);
      applied.splice(index, 1);

      this.emit('migration:rolled_back', { databaseId, migration });
    } catch (error) {
      // Rollback transaction on error
      if (transaction) {
        try {
          await this.rollbackTransaction(transaction.id);
        } catch (rollbackError) {
          console.error('Error rolling back migration rollback transaction:', rollbackError);
        }
      }
      throw error;
    }
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  public getPoolStats(databaseId: string): PoolStats | undefined {
    const pool = this.pools.get(databaseId);
    return pool?.getStats();
  }

  public getAllPoolStats(): Map<string, PoolStats> {
    const stats = new Map<string, PoolStats>();

    for (const [id, pool] of this.pools.entries()) {
      stats.set(id, pool.getStats());
    }

    return stats;
  }

  // ========================================================================
  // Health Monitoring API
  // ========================================================================

  public getPoolHealth(databaseId: string): PoolHealthStatus | undefined {
    const pool = this.pools.get(databaseId);
    return pool?.getHealthStatus();
  }

  public getAllPoolHealth(): Map<string, PoolHealthStatus> {
    const healthMap = new Map<string, PoolHealthStatus>();

    for (const [id, pool] of this.pools.entries()) {
      healthMap.set(id, pool.getHealthStatus());
    }

    return healthMap;
  }

  public getConnectionLeaks(databaseId: string): ConnectionLeak[] | undefined {
    const pool = this.pools.get(databaseId);
    return pool?.getConnectionLeaks();
  }

  public getAllConnectionLeaks(): Map<string, ConnectionLeak[]> {
    const leaksMap = new Map<string, ConnectionLeak[]>();

    for (const [id, pool] of this.pools.entries()) {
      leaksMap.set(id, pool.getConnectionLeaks());
    }

    return leaksMap;
  }

  public getCircuitBreakerState(databaseId: string): CircuitBreakerState | undefined {
    const pool = this.pools.get(databaseId);
    return pool?.getCircuitBreakerState();
  }

  public resetCircuitBreaker(databaseId: string): void {
    const pool = this.pools.get(databaseId);
    if (pool) {
      pool.resetCircuitBreaker();
      this.emit('circuit_breaker:manual_reset', { databaseId });
    }
  }

  public async forceHealthCheck(databaseId: string): Promise<void> {
    const pool = this.pools.get(databaseId);
    if (pool) {
      await (pool as any).performHealthCheck();
    }
  }

  public isPoolHealthy(databaseId: string): boolean {
    const pool = this.pools.get(databaseId);
    return pool?.isHealthy() ?? false;
  }

  // ========================================================================
  // Maintenance
  // ========================================================================

  private startMaintenanceLoop(): void {
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute

    // Prevent interval from keeping process alive during shutdown
    if (this.maintenanceInterval.unref) {
      this.maintenanceInterval.unref();
    }
  }

  private async performMaintenance(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const now = Date.now();

    try {
      // Clean up old query cache entries
      for (const [key, cached] of this.queryCache.entries()) {
        if (now - cached.timestamp > cached.ttl) {
          this.queryCache.delete(key);
        }
      }

      // Clean up stale transactions
      for (const [txId, transaction] of this.transactions.entries()) {
        const age = now - transaction.startTime;

        // Rollback transactions that are too old or stuck
        if (age > this.MAX_TRANSACTION_AGE ||
            (transaction.state === 'active' && age > this.TRANSACTION_TIMEOUT)) {
          try {
            await this.rollbackTransaction(txId);
            this.emit('transaction:auto_rollback', {
              transactionId: txId,
              reason: age > this.MAX_TRANSACTION_AGE ? 'max_age_exceeded' : 'timeout',
              age
            });
          } catch (error) {
            this.emit('transaction:rollback_failed', { transactionId: txId, error });
            // Force cleanup on failure
            this.transactions.delete(txId);
          }
        }

        // Clean up completed transactions
        if (transaction.state === 'committed' || transaction.state === 'rolled_back') {
          this.transactions.delete(txId);
        }
      }

      // Pool maintenance
      for (const pool of this.pools.values()) {
        try {
          await pool.evictIdleConnections();
        } catch (error) {
          console.error('Error during pool maintenance:', error);
        }
      }

      this.emit('maintenance:completed', {
        queryCacheSize: this.queryCache.size,
        activeTransactions: Array.from(this.transactions.values()).filter(t => t.state === 'active').length,
        totalTransactions: this.transactions.size,
      });
    } catch (error) {
      console.error('Error during maintenance:', error);
      this.emit('maintenance:error', { error });
    }
  }

  // ========================================================================
  // Resource Leak Detection and Monitoring
  // ========================================================================

  /**
   * Get comprehensive resource usage report
   */
  public getResourceUsage(): {
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
  } {
    const totalConnections = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.getStats().totalConnections, 0);

    const activeConnections = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.getStats().activeConnections, 0);

    const idleConnections = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.getStats().idleConnections, 0);

    const waitingRequests = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.getStats().waitingRequests, 0);

    const activeTransactions = Array.from(this.transactions.values())
      .filter(tx => tx.state === 'active').length;

    const connectionLeaks = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.getConnectionLeaks().length, 0);

    const now = Date.now();
    const staleTransactions = Array.from(this.transactions.values())
      .filter(tx => tx.state === 'active' && (now - tx.startTime) > this.TRANSACTION_TIMEOUT)
      .length;

    const unusedPreparedStatements = Array.from(this.preparedStatements.values())
      .filter(stmt => stmt.lastExecuted && (now - stmt.lastExecuted) > 3600000) // 1 hour
      .length;

    return {
      pools: this.pools.size,
      totalConnections,
      activeConnections,
      idleConnections,
      waitingRequests,
      activeTransactions,
      preparedStatements: this.preparedStatements.size,
      cachedQueries: this.queryCache.size,
      activeStreams: this.activeStreams.size,
      potentialLeaks: {
        connections: connectionLeaks,
        transactions: staleTransactions,
        preparedStatements: unusedPreparedStatements,
      },
    };
  }

  /**
   * Detect and report all resource leaks
   */
  public detectResourceLeaks(): {
    connectionLeaks: Map<string, ConnectionLeak[]>;
    staleTransactions: Transaction[];
    unusedPreparedStatements: PreparedStatement[];
    oldCacheEntries: number;
  } {
    const now = Date.now();

    // Connection leaks by pool
    const connectionLeaks = new Map<string, ConnectionLeak[]>();
    for (const [poolId, pool] of this.pools.entries()) {
      const leaks = pool.getConnectionLeaks();
      if (leaks.length > 0) {
        connectionLeaks.set(poolId, leaks);
      }
    }

    // Stale transactions (active for too long)
    const staleTransactions = Array.from(this.transactions.values())
      .filter(tx => tx.state === 'active' && (now - tx.startTime) > this.TRANSACTION_TIMEOUT);

    // Unused prepared statements (not executed in last hour)
    const unusedPreparedStatements = Array.from(this.preparedStatements.values())
      .filter(stmt => stmt.lastExecuted && (now - stmt.lastExecuted) > 3600000);

    // Old cache entries (expired but not cleaned up)
    const oldCacheEntries = Array.from(this.queryCache.values())
      .filter(cached => (now - cached.timestamp) > cached.ttl)
      .length;

    return {
      connectionLeaks,
      staleTransactions,
      unusedPreparedStatements,
      oldCacheEntries,
    };
  }

  /**
   * Force cleanup of leaked resources
   */
  public async forceCleanupLeaks(): Promise<{
    connectionsReleased: number;
    transactionsRolledBack: number;
    preparedStatementsClosed: number;
    cacheEntriesCleared: number;
  }> {
    let connectionsReleased = 0;
    let transactionsRolledBack = 0;
    let preparedStatementsClosed = 0;
    let cacheEntriesCleared = 0;

    const now = Date.now();

    // Force release leaked connections (aggressive cleanup)
    for (const pool of this.pools.values()) {
      const leaks = pool.getConnectionLeaks();
      for (const leak of leaks) {
        const conn = pool.getConnection(leak.connectionId);
        if (conn) {
          try {
            await pool.release(conn, true);
            connectionsReleased++;
          } catch (error) {
            console.error(`Error force releasing connection ${leak.connectionId}:`, error);
          }
        }
      }
    }

    // Rollback stale transactions
    for (const [txId, tx] of this.transactions.entries()) {
      if (tx.state === 'active' && (now - tx.startTime) > this.TRANSACTION_TIMEOUT) {
        try {
          await this.rollbackTransaction(txId);
          transactionsRolledBack++;
        } catch (error) {
          console.error(`Error rolling back stale transaction ${txId}:`, error);
          this.transactions.delete(txId);
        }
      }
    }

    // Close unused prepared statements
    for (const [key, stmt] of this.preparedStatements.entries()) {
      if (stmt.lastExecuted && (now - stmt.lastExecuted) > 3600000) {
        try {
          if (stmt.native && typeof stmt.native.close === 'function') {
            await stmt.native.close();
          }
          this.preparedStatements.delete(key);
          preparedStatementsClosed++;
        } catch (error) {
          console.error(`Error closing prepared statement ${key}:`, error);
        }
      }
    }

    // Clear expired cache entries
    for (const [key, cached] of this.queryCache.entries()) {
      if ((now - cached.timestamp) > cached.ttl) {
        this.queryCache.delete(key);
        cacheEntriesCleared++;
      }
    }

    this.emit('resource:leaks_cleaned', {
      connectionsReleased,
      transactionsRolledBack,
      preparedStatementsClosed,
      cacheEntriesCleared,
    });

    return {
      connectionsReleased,
      transactionsRolledBack,
      preparedStatementsClosed,
      cacheEntriesCleared,
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================================================================
  // Stream Management
  // ========================================================================

  /**
   * Register a stream for cleanup tracking
   */
  public registerStream(stream: NodeJS.ReadableStream | NodeJS.WritableStream): void {
    this.activeStreams.add(stream);

    // Auto-cleanup on stream end
    stream.once('end', () => {
      this.activeStreams.delete(stream);
    });

    stream.once('error', () => {
      this.activeStreams.delete(stream);
    });

    stream.once('close', () => {
      this.activeStreams.delete(stream);
    });
  }

  /**
   * Cleanup all active streams
   */
  private async cleanupStreams(): Promise<void> {
    const streamArray = Array.from(this.activeStreams);

    for (const stream of streamArray) {
      try {
        if ('destroy' in stream && typeof stream.destroy === 'function') {
          stream.destroy();
        } else if ('end' in stream && typeof stream.end === 'function') {
          (stream as any).end();
        }
      } catch (error) {
        console.error('Error cleaning up stream:', error);
      }
    }

    this.activeStreams.clear();
  }

  /**
   * Register a cleanup handler
   */
  public registerCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Unregister a cleanup handler
   */
  public unregisterCleanupHandler(handler: () => Promise<void>): void {
    const index = this.cleanupHandlers.indexOf(handler);
    if (index !== -1) {
      this.cleanupHandlers.splice(index, 1);
    }
  }

  // ========================================================================
  // Graceful Shutdown
  // ========================================================================

  /**
   * Check if manager is shutting down
   */
  public isShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Wait for ongoing operations to complete
   */
  private async drainOperations(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if all transactions are completed
      const activeTransactions = Array.from(this.transactions.values())
        .filter(t => t.state === 'active');

      if (activeTransactions.length === 0) {
        return;
      }

      // Wait a bit before checking again
      await this.delay(100);
    }

    // Force cleanup if timeout reached
    console.warn(`Drain timeout reached with ${this.transactions.size} active transactions`);
  }

  public async close(): Promise<void> {
    // Prevent multiple shutdown attempts
    if (this.isShuttingDown) {
      return this.shutdownPromise || Promise.resolve();
    }

    this.isShuttingDown = true;

    this.shutdownPromise = this._performShutdown();
    return this.shutdownPromise;
  }

  private async _performShutdown(): Promise<void> {
    console.log('DatabasePoolManager: Starting graceful shutdown...');

    try {
      // 1. Stop accepting new operations (already done via isShuttingDown flag)

      // 2. Clear maintenance interval to prevent memory leak
      if (this.maintenanceInterval) {
        clearInterval(this.maintenanceInterval);
        this.maintenanceInterval = null;
      }

      // 3. Wait for ongoing operations to complete (with timeout)
      await this.drainOperations(30000);

      // 4. Rollback all active transactions
      const activeTransactionIds = Array.from(this.transactions.entries())
        .filter(([_, tx]) => tx.state === 'active')
        .map(([id]) => id);

      for (const txId of activeTransactionIds) {
        try {
          await this.rollbackTransaction(txId);
          console.log(`Rolled back transaction: ${txId}`);
        } catch (error) {
          console.error(`Failed to rollback transaction ${txId}:`, error);
          // Force cleanup
          this.transactions.delete(txId);
        }
      }

      // 5. Cleanup prepared statements
      for (const [key, stmt] of this.preparedStatements.entries()) {
        try {
          if (stmt.native && typeof stmt.native.close === 'function') {
            await stmt.native.close();
          }
        } catch (error) {
          console.error(`Error closing prepared statement ${key}:`, error);
        }
      }
      this.preparedStatements.clear();

      // 6. Close all connection pools (graceful drain)
      const poolClosePromises = Array.from(this.pools.values()).map(pool =>
        pool.close().catch(error => {
          console.error('Error closing pool:', error);
        })
      );
      await Promise.all(poolClosePromises);

      // 7. Cleanup streams
      await this.cleanupStreams();

      // 8. Run custom cleanup handlers
      for (const handler of this.cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          console.error('Error running cleanup handler:', error);
        }
      }
      this.cleanupHandlers = [];

      // 9. Clear all data structures
      this.pools.clear();
      this.databases.clear();
      this.transactions.clear();
      this.queryCache.clear();
      this.migrations.clear();
      this.securityConfigs.clear();
      this.queryAuditLogs = [];

      // 10. Remove all event listeners to prevent memory leaks
      this.removeAllListeners();

      this.emit('closed');

      console.log('DatabasePoolManager: Shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }
}

// ============================================================================
// Connection Pool
// ============================================================================

class ConnectionPool extends EventEmitter {
  private connections: Connection[] = [];
  private availableConnections: Connection[] = [];
  private waitingQueue: Array<{
    resolve: (conn: Connection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private totalQueries = 0;
  private failedQueries = 0;
  private totalQueryTime = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private leakDetectionInterval: NodeJS.Timeout | null = null;
  private healthStatus: PoolHealthStatus = {
    status: 'healthy',
    lastHealthCheck: Date.now(),
    consecutiveFailures: 0,
    healthScore: 100,
    issues: [],
  };
  private circuitBreakerState: CircuitBreakerState = 'closed';
  private circuitBreakerFailures = 0;
  private circuitBreakerSuccesses = 0;
  private circuitBreakerOpenedAt = 0;
  private halfOpenAttempts = 0;
  private connectionLeaks: ConnectionLeak[] = [];
  private validationFailures = 0;
  private reconnectionAttempts = 0;
  private isClosing = false;
  private drainPromise: Promise<void> | null = null;

  constructor(
    private config: DatabaseConfig,
    private poolConfig: PoolConfig,
    private manager: DatabasePoolManager
  ) {
    super();
  }

  public async initialize(): Promise<void> {
    // Create minimum connections
    for (let i = 0; i < this.poolConfig.min; i++) {
      const connection = await this.createConnection();
      this.connections.push(connection);
      this.availableConnections.push(connection);
    }

    // Start health check monitoring
    if (this.poolConfig.healthCheck?.enabled) {
      this.startHealthCheckMonitoring();
    }

    // Start leak detection
    if (this.poolConfig.leakDetectionThreshold) {
      this.startLeakDetection();
    }

    this.emit('pool:initialized', { databaseId: this.config.id });
  }

  private async createConnection(): Promise<Connection> {
    const connection: Connection = {
      id: `${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      databaseId: this.config.id,
      native: await this.createNativeConnection(),
      state: 'idle',
      createdAt: Date.now(),
      lastUsed: Date.now(),
      queryCount: 0,
      errorCount: 0,
      inTransaction: false,
      healthCheckFailures: 0,
    };

    this.emit('connection:created', { connection });

    return connection;
  }

  private async createNativeConnection(): Promise<any> {
    // Create native connection based on database type
    // This would use actual database drivers in production
    return {};
  }

  public async acquire(): Promise<Connection> {
    if (this.isClosing) {
      throw new Error(`Connection pool is closing for ${this.config.id}`);
    }

    // Check circuit breaker
    if (!this.checkCircuitBreaker()) {
      throw new Error(`Circuit breaker is open for pool ${this.config.id}`);
    }

    // Check pool exhaustion
    this.checkPoolExhaustion();

    // Check for available connection
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop()!;
      connection.state = 'active';
      connection.lastUsed = Date.now();
      connection.acquiredAt = Date.now();
      connection.acquiredBy = this.captureStackTrace();

      if (this.poolConfig.testOnBorrow) {
        const valid = await this.validateConnection(connection);
        if (!valid) {
          await this.reconnectConnection(connection);
          if (connection.state === 'error') {
            await this.destroyConnection(connection);
            return this.acquire();
          }
        }
      }

      return connection;
    }

    // Create new connection if under max
    if (this.connections.length < this.poolConfig.max) {
      const connection = await this.createConnection();
      this.connections.push(connection);
      connection.state = 'active';
      connection.acquiredAt = Date.now();
      connection.acquiredBy = this.captureStackTrace();
      return connection;
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        this.recordCircuitBreakerFailure();
        reject(new Error('Acquire timeout'));
      }, this.poolConfig.acquireTimeout);

      this.waitingQueue.push({
        resolve: (conn) => {
          clearTimeout(timeout);
          resolve(conn);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });
    });
  }

  public async acquireReplica(): Promise<Connection> {
    // Select replica and acquire connection
    // For simplicity, using main pool
    return this.acquire();
  }

  public async release(connection: Connection, error: boolean = false): Promise<void> {
    if (error) {
      connection.errorCount++;
      this.recordCircuitBreakerFailure();
    } else {
      this.recordCircuitBreakerSuccess();
    }

    // Clear acquisition tracking
    delete connection.acquiredAt;
    delete connection.acquiredBy;
    delete connection.stackTrace;

    connection.state = 'idle';
    connection.lastUsed = Date.now();

    if (this.poolConfig.testOnReturn) {
      const valid = await this.validateConnection(connection);
      if (!valid) {
        await this.reconnectConnection(connection);
        if (connection.state === 'error') {
          await this.destroyConnection(connection);
          return;
        }
      }
    }

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      connection.state = 'active';
      connection.acquiredAt = Date.now();
      connection.acquiredBy = this.captureStackTrace();
      waiter.resolve(connection);
    } else {
      this.availableConnections.push(connection);
    }
  }

  private async validateConnection(connection: Connection): Promise<boolean> {
    try {
      connection.state = 'validating';
      const timeout = this.poolConfig.healthCheck?.timeout || 5000;

      const validationPromise = connection.native.query(this.poolConfig.validationQuery);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Validation timeout')), timeout)
      );

      await Promise.race([validationPromise, timeoutPromise]);

      connection.state = 'idle';
      connection.healthCheckFailures = 0;
      connection.lastHealthCheck = Date.now();
      return true;
    } catch (error) {
      connection.state = 'error';
      connection.healthCheckFailures++;
      this.validationFailures++;
      this.emit('connection:validation_failed', {
        connectionId: connection.id,
        error,
        failures: connection.healthCheckFailures
      });
      return false;
    }
  }

  private async destroyConnection(connection: Connection): Promise<void> {
    try {
      // Close native connection gracefully
      if (connection.native) {
        if (typeof connection.native.end === 'function') {
          await connection.native.end();
        } else if (typeof connection.native.close === 'function') {
          await connection.native.close();
        } else if (typeof connection.native.destroy === 'function') {
          connection.native.destroy();
        }
      }
    } catch (error) {
      // Ignore errors during destruction, but log them
      console.error('Error destroying connection native:', error);
    }

    connection.state = 'closed';

    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    const availIndex = this.availableConnections.indexOf(connection);
    if (availIndex !== -1) {
      this.availableConnections.splice(availIndex, 1);
    }

    this.emit('connection:destroyed', { connection });
  }

  public async evictIdleConnections(): Promise<void> {
    if (this.isClosing) {
      return;
    }

    const now = Date.now();
    const connectionsToDestroy: Connection[] = [];

    for (const connection of this.availableConnections) {
      if (
        now - connection.lastUsed > this.poolConfig.idleTimeout &&
        this.connections.length > this.poolConfig.min
      ) {
        connectionsToDestroy.push(connection);
      }
    }

    // Destroy connections outside the iteration to avoid modification during iteration
    for (const conn of connectionsToDestroy) {
      await this.destroyConnection(conn);
    }

    if (connectionsToDestroy.length > 0) {
      this.emit('pool:idle_connections_evicted', {
        databaseId: this.config.id,
        count: connectionsToDestroy.length,
      });
    }
  }

  public getConnection(connectionId: string): Connection | undefined {
    return this.connections.find(c => c.id === connectionId);
  }

  public getStats(): PoolStats {
    return {
      databaseId: this.config.id,
      totalConnections: this.connections.length,
      idleConnections: this.availableConnections.length,
      activeConnections: this.connections.length - this.availableConnections.length,
      waitingRequests: this.waitingQueue.length,
      totalQueries: this.totalQueries,
      failedQueries: this.failedQueries,
      averageQueryTime: this.totalQueries > 0 ? this.totalQueryTime / this.totalQueries : 0,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      healthStatus: { ...this.healthStatus },
      connectionLeaks: this.connectionLeaks.length,
      validationFailures: this.validationFailures,
      reconnectionAttempts: this.reconnectionAttempts,
      circuitBreakerState: this.circuitBreakerState,
    };
  }

  public async close(): Promise<void> {
    // Prevent multiple close attempts
    if (this.isClosing) {
      return this.drainPromise || Promise.resolve();
    }

    this.isClosing = true;
    this.drainPromise = this._performClose();
    return this.drainPromise;
  }

  private async _performClose(): Promise<void> {
    console.log(`ConnectionPool: Starting graceful close for ${this.config.id}...`);

    try {
      // 1. Stop health check monitoring to prevent memory leaks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // 2. Stop leak detection to prevent memory leaks
      if (this.leakDetectionInterval) {
        clearInterval(this.leakDetectionInterval);
        this.leakDetectionInterval = null;
      }

      // 3. Reject all waiting requests with clear error
      const waitingRequests = [...this.waitingQueue];
      this.waitingQueue = [];

      for (const waiter of waitingRequests) {
        try {
          clearTimeout(waiter.timeout);
          waiter.reject(new Error('Connection pool is closing'));
        } catch (error) {
          console.error('Error rejecting waiting request:', error);
        }
      }

      // 4. Wait for active connections to be released (with timeout)
      const drainTimeout = 30000; // 30 seconds
      const drainStart = Date.now();
      const activeConnections = () => this.connections.filter(c => c.state === 'active');

      while (activeConnections().length > 0 && (Date.now() - drainStart) < drainTimeout) {
        console.log(`Waiting for ${activeConnections().length} active connections to be released...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (activeConnections().length > 0) {
        console.warn(`Forcing close with ${activeConnections().length} active connections still in use`);

        // Force close active connections that are still in use
        for (const conn of activeConnections()) {
          console.warn(`Force closing connection ${conn.id} (acquired by: ${conn.acquiredBy || 'unknown'})`);
        }
      }

      // 5. Destroy all connections (both idle and any remaining active)
      const allConnections = [...this.connections];
      const destroyPromises = allConnections.map(conn =>
        this.destroyConnection(conn).catch(error => {
          console.error(`Error destroying connection ${conn.id}:`, error);
        })
      );

      await Promise.all(destroyPromises);

      // 6. Clear all data structures
      this.connections = [];
      this.availableConnections = [];
      this.connectionLeaks = [];

      // 7. Remove all event listeners to prevent memory leaks
      this.removeAllListeners();

      this.emit('pool:closed', { databaseId: this.config.id });

      console.log(`ConnectionPool: Close complete for ${this.config.id}`);
    } catch (error) {
      console.error(`Error during pool close for ${this.config.id}:`, error);
      throw error;
    }
  }

  // ========================================================================
  // Health Monitoring
  // ========================================================================

  private startHealthCheckMonitoring(): void {
    const interval = this.poolConfig.healthCheck?.interval || 30000;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, interval);

    // Prevent interval from keeping process alive
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
  }

  private async performHealthCheck(): Promise<void> {
    if (this.isClosing) {
      return;
    }

    const startTime = Date.now();
    const issues: string[] = [];
    let healthyConnections = 0;
    let unhealthyConnections = 0;

    try {
      // Check all idle connections
      if (this.poolConfig.testWhileIdle) {
        for (const connection of this.availableConnections) {
          const valid = await this.validateConnection(connection);
          if (valid) {
            healthyConnections++;
          } else {
            unhealthyConnections++;
            await this.reconnectConnection(connection);
          }
        }
      }

      // Check pool utilization
      const utilization = this.connections.length / this.poolConfig.max;
      if (utilization >= (this.poolConfig.exhaustionAlertThreshold || 0.9)) {
        issues.push(`High pool utilization: ${(utilization * 100).toFixed(1)}%`);
      }

      // Check waiting queue
      if (this.waitingQueue.length > 0) {
        issues.push(`${this.waitingQueue.length} requests waiting for connections`);
      }

      // Check connection leaks
      if (this.connectionLeaks.length > 0) {
        issues.push(`${this.connectionLeaks.length} potential connection leaks detected`);
      }

      // Check circuit breaker
      if (this.circuitBreakerState !== 'closed') {
        issues.push(`Circuit breaker is ${this.circuitBreakerState}`);
      }

      // Calculate health score (0-100)
      let healthScore = 100;
      healthScore -= unhealthyConnections * 10;
      healthScore -= Math.min(this.waitingQueue.length * 5, 30);
      healthScore -= Math.min(this.connectionLeaks.length * 15, 40);
      if (this.circuitBreakerState === 'open') healthScore -= 30;
      if (this.circuitBreakerState === 'half_open') healthScore -= 15;
      healthScore = Math.max(0, healthScore);

      // Determine status
      let status: 'healthy' | 'degraded' | 'critical' | 'down' = 'healthy';
      if (healthScore < 30) status = 'down';
      else if (healthScore < 50) status = 'critical';
      else if (healthScore < 70) status = 'degraded';

      // Update health status
      const previousStatus = this.healthStatus.status;
      this.healthStatus = {
        status,
        lastHealthCheck: Date.now(),
        consecutiveFailures: status === 'healthy' ? 0 : this.healthStatus.consecutiveFailures + 1,
        healthScore,
        issues,
      };

      // Emit health check event
      this.emit('pool:health_check', {
        databaseId: this.config.id,
        status: this.healthStatus,
        duration: Date.now() - startTime,
      });

      // Alert on status change
      if (previousStatus !== status) {
        this.emit('pool:health_status_changed', {
          databaseId: this.config.id,
          previousStatus,
          currentStatus: status,
          healthScore,
          issues,
        });
      }

      // Alert on critical or down status
      if (status === 'critical' || status === 'down') {
        this.emit('pool:health_alert', {
          databaseId: this.config.id,
          severity: status,
          healthScore,
          issues,
        });
      }

    } catch (error) {
      this.healthStatus.consecutiveFailures++;
      this.emit('pool:health_check_failed', {
        databaseId: this.config.id,
        error,
      });
    }
  }

  // ========================================================================
  // Connection Leak Detection
  // ========================================================================

  private startLeakDetection(): void {
    this.leakDetectionInterval = setInterval(() => {
      this.detectConnectionLeaks();
    }, 60000); // Check every minute

    // Prevent interval from keeping process alive
    if (this.leakDetectionInterval.unref) {
      this.leakDetectionInterval.unref();
    }
  }

  private detectConnectionLeaks(): void {
    if (this.isClosing) {
      return;
    }

    const now = Date.now();
    const threshold = this.poolConfig.leakDetectionThreshold || 300000;
    this.connectionLeaks = [];

    for (const connection of this.connections) {
      if (connection.state === 'active' && connection.acquiredAt) {
        const duration = now - connection.acquiredAt;

        if (duration > threshold) {
          const leak: ConnectionLeak = {
            connectionId: connection.id,
            acquiredAt: connection.acquiredAt,
            acquiredBy: connection.acquiredBy || 'unknown',
            duration,
            stackTrace: connection.stackTrace,
          };

          this.connectionLeaks.push(leak);

          // Emit individual leak warnings
          this.emit('pool:connection_leak_warning', {
            databaseId: this.config.id,
            leak,
          });
        }
      }
    }

    if (this.connectionLeaks.length > 0) {
      this.emit('pool:connection_leak_detected', {
        databaseId: this.config.id,
        leaks: this.connectionLeaks,
      });
    }
  }

  private captureStackTrace(): string {
    const stack = new Error().stack || '';
    return stack.split('\n').slice(2, 6).join('\n');
  }

  // ========================================================================
  // Automatic Reconnection
  // ========================================================================

  private async reconnectConnection(connection: Connection): Promise<void> {
    this.reconnectionAttempts++;

    try {
      // Close the old native connection
      try {
        await connection.native.end();
      } catch {
        // Ignore close errors
      }

      // Create new native connection
      connection.native = await this.createNativeConnection();
      connection.state = 'idle';
      connection.errorCount = 0;
      connection.healthCheckFailures = 0;
      connection.lastHealthCheck = Date.now();

      this.emit('connection:reconnected', {
        connectionId: connection.id,
        databaseId: this.config.id,
      });

    } catch (error) {
      connection.state = 'error';
      this.emit('connection:reconnection_failed', {
        connectionId: connection.id,
        databaseId: this.config.id,
        error,
      });
    }
  }

  // ========================================================================
  // Circuit Breaker Pattern
  // ========================================================================

  private checkCircuitBreaker(): boolean {
    if (!this.poolConfig.circuitBreaker?.enabled) {
      return true;
    }

    const now = Date.now();

    switch (this.circuitBreakerState) {
      case 'closed':
        // Normal operation
        return true;

      case 'open':
        // Check if timeout has elapsed
        const elapsed = now - this.circuitBreakerOpenedAt;
        if (elapsed >= (this.poolConfig.circuitBreaker.timeout || 60000)) {
          this.circuitBreakerState = 'half_open';
          this.halfOpenAttempts = 0;
          this.emit('circuit_breaker:half_open', { databaseId: this.config.id });
          return true;
        }
        return false;

      case 'half_open':
        // Allow limited attempts
        if (this.halfOpenAttempts < (this.poolConfig.circuitBreaker.halfOpenMaxAttempts || 3)) {
          this.halfOpenAttempts++;
          return true;
        }
        return false;
    }
  }

  private recordCircuitBreakerFailure(): void {
    if (!this.poolConfig.circuitBreaker?.enabled) {
      return;
    }

    this.circuitBreakerFailures++;

    if (this.circuitBreakerState === 'half_open') {
      // Reopen circuit on failure in half-open state
      this.circuitBreakerState = 'open';
      this.circuitBreakerOpenedAt = Date.now();
      this.circuitBreakerSuccesses = 0;
      this.emit('circuit_breaker:reopened', {
        databaseId: this.config.id,
        reason: 'failure_in_half_open',
      });
    } else if (this.circuitBreakerState === 'closed') {
      // Open circuit if threshold exceeded
      const threshold = this.poolConfig.circuitBreaker.failureThreshold || 5;
      if (this.circuitBreakerFailures >= threshold) {
        this.circuitBreakerState = 'open';
        this.circuitBreakerOpenedAt = Date.now();
        this.circuitBreakerSuccesses = 0;
        this.emit('circuit_breaker:opened', {
          databaseId: this.config.id,
          failures: this.circuitBreakerFailures,
          threshold,
        });
      }
    }
  }

  private recordCircuitBreakerSuccess(): void {
    if (!this.poolConfig.circuitBreaker?.enabled) {
      return;
    }

    // Reset failure count on success
    this.circuitBreakerFailures = Math.max(0, this.circuitBreakerFailures - 1);

    if (this.circuitBreakerState === 'half_open') {
      this.circuitBreakerSuccesses++;

      const threshold = this.poolConfig.circuitBreaker.successThreshold || 2;
      if (this.circuitBreakerSuccesses >= threshold) {
        this.circuitBreakerState = 'closed';
        this.circuitBreakerFailures = 0;
        this.circuitBreakerSuccesses = 0;
        this.emit('circuit_breaker:closed', {
          databaseId: this.config.id,
          successes: this.circuitBreakerSuccesses,
        });
      }
    }
  }

  // ========================================================================
  // Pool Exhaustion Monitoring
  // ========================================================================

  private checkPoolExhaustion(): void {
    const utilization = this.connections.length / this.poolConfig.max;
    const threshold = this.poolConfig.exhaustionAlertThreshold || 0.9;

    if (utilization >= threshold && this.waitingQueue.length > 0) {
      this.emit('pool:exhaustion_alert', {
        databaseId: this.config.id,
        utilization,
        totalConnections: this.connections.length,
        maxConnections: this.poolConfig.max,
        waitingRequests: this.waitingQueue.length,
      });
    }
  }

  // ========================================================================
  // Graceful Degradation
  // ========================================================================

  public getDegradedConnection(): Connection | null {
    // Return a degraded connection with reduced capabilities
    // when the pool is under stress but still operational
    if (this.healthStatus.status === 'degraded' || this.healthStatus.status === 'critical') {
      // Find the least-used connection
      const sortedConnections = [...this.availableConnections].sort(
        (a, b) => a.queryCount - b.queryCount
      );

      if (sortedConnections.length > 0) {
        return sortedConnections[0];
      }
    }

    return null;
  }

  public isHealthy(): boolean {
    return this.healthStatus.status === 'healthy' || this.healthStatus.status === 'degraded';
  }

  public getHealthStatus(): PoolHealthStatus {
    return { ...this.healthStatus };
  }

  public getConnectionLeaks(): ConnectionLeak[] {
    return [...this.connectionLeaks];
  }

  public getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreakerState;
  }

  public resetCircuitBreaker(): void {
    this.circuitBreakerState = 'closed';
    this.circuitBreakerFailures = 0;
    this.circuitBreakerSuccesses = 0;
    this.circuitBreakerOpenedAt = 0;
    this.halfOpenAttempts = 0;

    this.emit('circuit_breaker:reset', { databaseId: this.config.id });
  }
}

// ============================================================================
// Secure Query Builder
// ============================================================================

export class SecureQueryBuilder {
  private operation: SQLOperation | null = null;
  private tableName: string | null = null;
  private selectColumns: string[] = [];
  private whereConditions: Array<{ column: string; operator: string; paramIndex: number }> = [];
  private insertData: Record<string, number> = {}; // column -> paramIndex
  private updateData: Record<string, number> = {}; // column -> paramIndex
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private orderByColumns: Array<{ column: string; direction: 'ASC' | 'DESC' }> = [];
  private params: any[] = [];

  constructor(
    private manager: DatabasePoolManager,
    private databaseId: string,
    private dbType: DatabaseType
  ) {}

  public select(...columns: string[]): this {
    this.operation = 'SELECT';
    this.selectColumns = columns.length > 0 ? columns : ['*'];
    return this;
  }

  public from(table: string): this {
    this.validateIdentifier(table, 'table');
    this.tableName = table;
    return this;
  }

  public insert(table: string): this {
    this.operation = 'INSERT';
    this.validateIdentifier(table, 'table');
    this.tableName = table;
    return this;
  }

  public update(table: string): this {
    this.operation = 'UPDATE';
    this.validateIdentifier(table, 'table');
    this.tableName = table;
    return this;
  }

  public delete(table: string): this {
    this.operation = 'DELETE';
    this.validateIdentifier(table, 'table');
    this.tableName = table;
    return this;
  }

  public values(data: Record<string, any>): this {
    for (const [column, value] of Object.entries(data)) {
      this.validateIdentifier(column, 'column');
      const paramIndex = this.params.length;
      this.params.push(value);
      this.insertData[column] = paramIndex;
    }
    return this;
  }

  public set(data: Record<string, any>): this {
    for (const [column, value] of Object.entries(data)) {
      this.validateIdentifier(column, 'column');
      const paramIndex = this.params.length;
      this.params.push(value);
      this.updateData[column] = paramIndex;
    }
    return this;
  }

  public where(column: string, operator: string, value: any): this {
    this.validateIdentifier(column, 'column');
    this.validateOperator(operator);

    const paramIndex = this.params.length;
    this.params.push(value);
    this.whereConditions.push({ column, operator, paramIndex });

    return this;
  }

  public limit(value: number): this {
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error('Limit must be a non-negative integer');
    }
    this.limitValue = value;
    return this;
  }

  public offset(value: number): this {
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error('Offset must be a non-negative integer');
    }
    this.offsetValue = value;
    return this;
  }

  public orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.validateIdentifier(column, 'column');
    this.orderByColumns.push({ column, direction });
    return this;
  }

  private validateIdentifier(identifier: string, type: 'table' | 'column'): void {
    // Ensure identifier doesn't contain SQL injection attempts
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid ${type} name: ${identifier}. Only alphanumeric characters and underscores are allowed.`);
    }
  }

  private validateOperator(operator: string): void {
    const allowedOperators = ['=', '!=', '<>', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN', 'IS', 'IS NOT'];
    if (!allowedOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }
  }

  private getParameterPlaceholder(index: number): string {
    switch (this.dbType) {
      case 'postgresql':
        return `$${index + 1}`;
      case 'mysql':
      case 'sqlite':
        return '?';
      default:
        return '?';
    }
  }

  public build(): { query: string; params: any[] } {
    if (!this.operation) {
      throw new Error('No operation specified. Use select(), insert(), update(), or delete()');
    }

    if (!this.tableName) {
      throw new Error('No table specified');
    }

    let query = '';

    switch (this.operation) {
      case 'SELECT':
        query = this.buildSelectQuery();
        break;
      case 'INSERT':
        query = this.buildInsertQuery();
        break;
      case 'UPDATE':
        query = this.buildUpdateQuery();
        break;
      case 'DELETE':
        query = this.buildDeleteQuery();
        break;
      default:
        throw new Error(`Unsupported operation: ${this.operation}`);
    }

    return { query, params: this.params };
  }

  private buildSelectQuery(): string {
    const columns = this.selectColumns.join(', ');
    let query = `SELECT ${columns} FROM ${this.tableName}`;

    if (this.whereConditions.length > 0) {
      query += ' WHERE ' + this.buildWhereClause();
    }

    if (this.orderByColumns.length > 0) {
      const orderBy = this.orderByColumns
        .map(o => `${o.column} ${o.direction}`)
        .join(', ');
      query += ` ORDER BY ${orderBy}`;
    }

    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== null) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    return query;
  }

  private buildInsertQuery(): string {
    if (Object.keys(this.insertData).length === 0) {
      throw new Error('No data to insert. Use values()');
    }

    const columns = Object.keys(this.insertData).join(', ');
    const placeholders = Object.values(this.insertData)
      .map(idx => this.getParameterPlaceholder(idx))
      .join(', ');

    return `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
  }

  private buildUpdateQuery(): string {
    if (Object.keys(this.updateData).length === 0) {
      throw new Error('No data to update. Use set()');
    }

    if (this.whereConditions.length === 0) {
      throw new Error('UPDATE requires WHERE clause. Use where()');
    }

    const sets = Object.entries(this.updateData)
      .map(([col, idx]) => `${col} = ${this.getParameterPlaceholder(idx)}`)
      .join(', ');

    let query = `UPDATE ${this.tableName} SET ${sets}`;

    if (this.whereConditions.length > 0) {
      query += ' WHERE ' + this.buildWhereClause();
    }

    return query;
  }

  private buildDeleteQuery(): string {
    if (this.whereConditions.length === 0) {
      throw new Error('DELETE requires WHERE clause. Use where()');
    }

    let query = `DELETE FROM ${this.tableName}`;

    if (this.whereConditions.length > 0) {
      query += ' WHERE ' + this.buildWhereClause();
    }

    return query;
  }

  private buildWhereClause(): string {
    return this.whereConditions
      .map(w => `${w.column} ${w.operator} ${this.getParameterPlaceholder(w.paramIndex)}`)
      .join(' AND ');
  }

  public async execute<T = any>(options?: QueryOptions): Promise<QueryResult<T>> {
    const { query, params } = this.build();
    return this.manager.query<T>(this.databaseId, query, params, options);
  }
}

// ============================================================================
// Export
// ============================================================================

export default DatabasePoolManager;
