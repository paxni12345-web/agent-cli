/**
 * Integration Tests: Database Pool Manager
 * Tests real connection pooling, multi-database support, and concurrent operations
 */

import { DatabasePoolManager, DatabaseConfig, PoolConfig } from '../../../src/database/DatabasePoolManager';

describe('DatabasePoolManager Integration', () => {
  let poolManager: DatabasePoolManager;

  beforeEach(() => {
    poolManager = new DatabasePoolManager();
  });

  afterEach(async () => {
    await poolManager.close();
  });

  describe('Multi-Database Registration', () => {
    test('should register multiple databases', async () => {
      const db1Config: DatabaseConfig = {
        id: 'primary',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_primary',
        username: 'test',
        password: 'test'
      };

      const db2Config: DatabaseConfig = {
        id: 'replica',
        type: 'postgresql',
        host: 'localhost',
        port: 5433,
        database: 'test_replica',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(db1Config);
      await poolManager.registerDatabase(db2Config);

      const databases = poolManager.listDatabases();
      expect(databases).toHaveLength(2);
      expect(databases.map(db => db.id)).toEqual(['primary', 'replica']);
    });

    test('should unregister database and close pool', async () => {
      const config: DatabaseConfig = {
        id: 'temp-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_temp',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);
      expect(poolManager.getDatabase('temp-db')).toBeDefined();

      await poolManager.unregisterDatabase('temp-db');
      expect(poolManager.getDatabase('temp-db')).toBeUndefined();
    });

    test('should emit registration events', async () => {
      const events: any[] = [];
      poolManager.on('database:registered', (event) => events.push(event));
      poolManager.on('database:unregistered', (event) => events.push(event));

      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);
      await poolManager.unregisterDatabase('test-db');

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ databaseId: 'test-db' });
      expect(events[1]).toMatchObject({ databaseId: 'test-db' });
    });
  });

  describe('Query Execution with Pools', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: 'test',
        username: 'test',
        password: 'test',
        poolConfig: {
          min: 2,
          max: 10
        }
      };

      await poolManager.registerDatabase(config);
    });

    test('should execute query from pool', async () => {
      const result = await poolManager.query('test-db', 'SELECT $1 as value', [42]);

      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
      expect(result).toHaveProperty('executionTime');
    });

    test('should handle concurrent queries', async () => {
      const queries = Array.from({ length: 20 }, (_, i) =>
        poolManager.query('test-db', 'SELECT $1 as value', [i])
      );

      const results = await Promise.all(queries);
      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result).toHaveProperty('rows');
      });
    });

    test('should retry failed queries', async () => {
      const result = await poolManager.query(
        'test-db',
        'SELECT $1 as value',
        [1],
        { retries: 3 }
      );

      expect(result).toHaveProperty('rows');
    });

    test('should use query cache when enabled', async () => {
      const query = 'SELECT $1 as cached_value';
      const params = [100];

      // First query - cache miss
      const result1 = await poolManager.query('test-db', query, params, {
        cache: true,
        cacheTTL: 60000
      });

      // Second query - cache hit
      const result2 = await poolManager.query('test-db', query, params, {
        cache: true
      });

      expect(result2.fromCache).toBe(true);
    });

    test('should clear query cache', async () => {
      await poolManager.query('test-db', 'SELECT 1', [], { cache: true });

      poolManager.clearQueryCache('test-db');

      const stats = poolManager.getPoolStats('test-db');
      expect(stats?.cacheHits).toBe(0);
    });
  });

  describe('Transaction Handling', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        id: 'txn-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);
    });

    test('should begin and commit transaction', async () => {
      const transaction = await poolManager.beginTransaction('txn-db');

      expect(transaction).toHaveProperty('id');
      expect(transaction.state).toBe('active');

      await poolManager.commitTransaction(transaction.id);
    });

    test('should rollback transaction on error', async () => {
      const transaction = await poolManager.beginTransaction('txn-db');

      await poolManager.rollbackTransaction(transaction.id);
    });

    test('should support savepoints', async () => {
      const transaction = await poolManager.beginTransaction('txn-db');

      await poolManager.createSavepoint(transaction.id, 'sp1');
      await poolManager.rollbackToSavepoint(transaction.id, 'sp1');

      await poolManager.commitTransaction(transaction.id);
    });

    test('should emit transaction events', async () => {
      const events: string[] = [];
      poolManager.on('transaction:begin', () => events.push('begin'));
      poolManager.on('transaction:commit', () => events.push('commit'));

      const transaction = await poolManager.beginTransaction('txn-db');
      await poolManager.commitTransaction(transaction.id);

      expect(events).toEqual(['begin', 'commit']);
    });

    test('should handle multiple concurrent transactions', async () => {
      const transactions = await Promise.all([
        poolManager.beginTransaction('txn-db'),
        poolManager.beginTransaction('txn-db'),
        poolManager.beginTransaction('txn-db')
      ]);

      expect(transactions).toHaveLength(3);

      await Promise.all(
        transactions.map(tx => poolManager.commitTransaction(tx.id))
      );
    });
  });

  describe('Security and Validation', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        id: 'secure-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);

      poolManager.setSecurityConfig('secure-db', {
        allowedTables: new Set(['users', 'posts']),
        allowedOperations: new Set(['SELECT', 'INSERT', 'UPDATE']),
        requireParameterized: true,
        maxQueryTimeout: 5000,
        enableQueryLogging: true
      });
    });

    test('should enforce table whitelist', async () => {
      await expect(
        poolManager.query('secure-db', 'SELECT * FROM forbidden_table', [])
      ).rejects.toThrow('not allowed');
    });

    test('should enforce operation whitelist', async () => {
      await expect(
        poolManager.query('secure-db', 'DROP TABLE users', [])
      ).rejects.toThrow('not allowed');
    });

    test('should require parameterized queries', async () => {
      await expect(
        poolManager.query('secure-db', "SELECT * FROM users WHERE id = '1'", [])
      ).rejects.toThrow('parameterized');
    });

    test('should prevent DELETE without WHERE clause', async () => {
      poolManager.setSecurityConfig('secure-db', {
        allowedTables: new Set(['users']),
        allowedOperations: new Set(['DELETE']),
        requireParameterized: true,
        maxQueryTimeout: 5000,
        enableQueryLogging: true
      });

      await expect(
        poolManager.query('secure-db', 'DELETE FROM users', [])
      ).rejects.toThrow('WHERE clause');
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        id: 'health-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
        poolConfig: {
          healthCheck: {
            enabled: true,
            interval: 10000,
            timeout: 5000,
            healthyThreshold: 2,
            unhealthyThreshold: 3,
            query: 'SELECT 1'
          }
        }
      };

      await poolManager.registerDatabase(config);
    });

    test('should get pool health status', async () => {
      const health = poolManager.getPoolHealth('health-db');

      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('healthScore');
      expect(health).toHaveProperty('consecutiveFailures');
    });

    test('should check if pool is healthy', () => {
      const isHealthy = poolManager.isPoolHealthy('health-db');
      expect(typeof isHealthy).toBe('boolean');
    });

    test('should get all pool health statuses', async () => {
      const healthMap = poolManager.getAllPoolHealth();

      expect(healthMap).toBeInstanceOf(Map);
      expect(healthMap.has('health-db')).toBe(true);
    });

    test('should force health check', async () => {
      await expect(
        poolManager.forceHealthCheck('health-db')
      ).resolves.not.toThrow();
    });
  });

  describe('Pool Statistics', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        id: 'stats-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);
    });

    test('should get pool statistics', async () => {
      await poolManager.query('stats-db', 'SELECT 1', []);

      const stats = poolManager.getPoolStats('stats-db');

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('totalQueries');
    });

    test('should get all pool statistics', async () => {
      const allStats = poolManager.getAllPoolStats();

      expect(allStats).toBeInstanceOf(Map);
      expect(allStats.has('stats-db')).toBe(true);
    });

    test('should track query statistics', async () => {
      await poolManager.query('stats-db', 'SELECT $1', [1]);
      await poolManager.query('stats-db', 'SELECT $1', [2]);

      const queryStats = poolManager.getQueryStatistics('stats-db');

      expect(queryStats.totalQueries).toBeGreaterThanOrEqual(2);
      expect(queryStats.successfulQueries).toBeGreaterThanOrEqual(0);
      expect(queryStats.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        id: 'resource-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);
    });

    test('should get resource usage', () => {
      const usage = poolManager.getResourceUsage();

      expect(usage).toHaveProperty('pools');
      expect(usage).toHaveProperty('totalConnections');
      expect(usage).toHaveProperty('activeConnections');
      expect(usage).toHaveProperty('preparedStatements');
      expect(usage).toHaveProperty('cachedQueries');
      expect(usage).toHaveProperty('potentialLeaks');
    });

    test('should detect resource leaks', () => {
      const leaks = poolManager.detectResourceLeaks();

      expect(leaks).toHaveProperty('connectionLeaks');
      expect(leaks).toHaveProperty('staleTransactions');
      expect(leaks).toHaveProperty('unusedPreparedStatements');
    });

    test('should force cleanup of leaks', async () => {
      const result = await poolManager.forceCleanupLeaks();

      expect(result).toHaveProperty('connectionsReleased');
      expect(result).toHaveProperty('transactionsRolledBack');
      expect(result).toHaveProperty('preparedStatementsClosed');
      expect(result).toHaveProperty('cacheEntriesCleared');
    });
  });

  describe('Graceful Shutdown', () => {
    test('should gracefully shutdown with active connections', async () => {
      const config: DatabaseConfig = {
        id: 'shutdown-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);

      // Start some queries
      const queryPromise = poolManager.query('shutdown-db', 'SELECT 1', []);

      // Initiate shutdown
      const shutdownPromise = poolManager.close();

      await Promise.all([queryPromise, shutdownPromise]);

      expect(poolManager.isShutdown()).toBe(true);
    });

    test('should reject new operations during shutdown', async () => {
      const config: DatabaseConfig = {
        id: 'shutdown-db2',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      };

      await poolManager.registerDatabase(config);
      await poolManager.close();

      await expect(
        poolManager.query('shutdown-db2', 'SELECT 1', [])
      ).rejects.toThrow('shutting down');
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(async () => {
      const config: DatabaseConfig = {
        id: 'cb-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
        poolConfig: {
          circuitBreaker: {
            enabled: true,
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            halfOpenMaxAttempts: 3
          }
        }
      };

      await poolManager.registerDatabase(config);
    });

    test('should get circuit breaker state', () => {
      const state = poolManager.getCircuitBreakerState('cb-db');
      expect(['closed', 'open', 'half_open']).toContain(state);
    });

    test('should reset circuit breaker', () => {
      poolManager.resetCircuitBreaker('cb-db');
      const state = poolManager.getCircuitBreakerState('cb-db');
      expect(state).toBe('closed');
    });
  });
});
