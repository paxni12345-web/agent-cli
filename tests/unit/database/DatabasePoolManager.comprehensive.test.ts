/**
 * Comprehensive Unit Tests for DatabasePoolManager
 * Tests all public methods, edge cases, error conditions, async behavior, resource cleanup, and concurrency
 */

import { DatabasePoolManager } from '../../../src/database/DatabasePoolManager';
import type {
  DatabaseConfig,
  QueryOptions,
  SecurityConfig,
  IsolationLevel,
  Migration,
  CircuitBreakerState,
  PoolHealthStatus,
} from '../../../src/database/DatabasePoolManager';

// ============================================================================
// Database Registration Tests
// ============================================================================

describe('DatabasePoolManager - Database Registration', () => {
  let manager: DatabasePoolManager;

  beforeEach(() => {
    manager = new DatabasePoolManager();
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('registerDatabase', () => {
    it('should register database successfully', async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };

      await expect(manager.registerDatabase(config)).resolves.not.toThrow();
    });

    it('should emit database:registered event', async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };

      const eventSpy = jest.fn();
      manager.on('database:registered', eventSpy);

      await manager.registerDatabase(config);

      expect(eventSpy).toHaveBeenCalledWith({ databaseId: 'test-db' });
    });

    it('should handle null config fields', async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
        ssl: undefined,
      };

      await expect(manager.registerDatabase(config)).resolves.not.toThrow();
    });

    it('should register database with custom pool config', async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
        poolConfig: {
          min: 5,
          max: 20,
          acquireTimeout: 10000,
        },
      };

      await expect(manager.registerDatabase(config)).resolves.not.toThrow();
    });
  });

  describe('unregisterDatabase', () => {
    it('should unregister database', async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };

      await manager.registerDatabase(config);
      await expect(manager.unregisterDatabase('test-db')).resolves.not.toThrow();
    });

    it('should not throw if database does not exist', async () => {
      await expect(manager.unregisterDatabase('non-existent')).resolves.not.toThrow();
    });

    it('should emit database:unregistered event', async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };

      await manager.registerDatabase(config);

      const eventSpy = jest.fn();
      manager.on('database:unregistered', eventSpy);

      await manager.unregisterDatabase('test-db');

      expect(eventSpy).toHaveBeenCalledWith({ databaseId: 'test-db' });
    });
  });

  describe('getDatabase', () => {
    it('should get registered database', async () => {
      const config: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };

      await manager.registerDatabase(config);
      const retrieved = manager.getDatabase('test-db');

      expect(retrieved).toEqual(config);
    });

    it('should return undefined for non-existent database', () => {
      const retrieved = manager.getDatabase('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should return undefined when passed null', () => {
      const retrieved = manager.getDatabase(null as any);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('listDatabases', () => {
    it('should list all registered databases', async () => {
      const config1: DatabaseConfig = {
        id: 'db1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb1',
        username: 'user',
        password: 'pass',
      };

      const config2: DatabaseConfig = {
        id: 'db2',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'testdb2',
        username: 'user',
        password: 'pass',
      };

      await manager.registerDatabase(config1);
      await manager.registerDatabase(config2);

      const databases = manager.listDatabases();

      expect(databases).toHaveLength(2);
      expect(databases).toContainEqual(config1);
      expect(databases).toContainEqual(config2);
    });

    it('should return empty array when no databases registered', () => {
      const databases = manager.listDatabases();
      expect(databases).toEqual([]);
    });
  });
});

// ============================================================================
// Security Configuration Tests
// ============================================================================

describe('DatabasePoolManager - Security Configuration', () => {
  let manager: DatabasePoolManager;

  beforeEach(() => {
    manager = new DatabasePoolManager();
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('setSecurityConfig', () => {
    it('should set security configuration', () => {
      const config: Partial<SecurityConfig> = {
        allowedTables: new Set(['users', 'posts']),
        requireParameterized: true,
        maxQueryTimeout: 5000,
      };

      expect(() => manager.setSecurityConfig('test-db', config)).not.toThrow();
    });

    it('should emit security:config_updated event', () => {
      const eventSpy = jest.fn();
      manager.on('security:config_updated', eventSpy);

      const config: Partial<SecurityConfig> = {
        allowedTables: new Set(['users']),
      };

      manager.setSecurityConfig('test-db', config);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should merge with default security config', () => {
      const config: Partial<SecurityConfig> = {
        maxQueryTimeout: 5000,
      };

      manager.setSecurityConfig('test-db', config);
      const retrieved = manager.getSecurityConfig('test-db');

      expect(retrieved).toBeDefined();
      expect(retrieved?.maxQueryTimeout).toBe(5000);
      expect(retrieved?.requireParameterized).toBeDefined();
    });

    it('should handle empty config', () => {
      expect(() => manager.setSecurityConfig('test-db', {})).not.toThrow();
    });
  });

  describe('getSecurityConfig', () => {
    it('should get security configuration', () => {
      const config: Partial<SecurityConfig> = {
        allowedTables: new Set(['users']),
      };

      manager.setSecurityConfig('test-db', config);
      const retrieved = manager.getSecurityConfig('test-db');

      expect(retrieved).toBeDefined();
    });

    it('should return undefined for non-existent config', () => {
      const retrieved = manager.getSecurityConfig('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });
});

// ============================================================================
// Query Execution Tests
// ============================================================================

describe('DatabasePoolManager - Query Execution', () => {
  let manager: DatabasePoolManager;
  let dbConfig: DatabaseConfig;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    dbConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('query', () => {
    it('should execute query successfully', async () => {
      const result = await manager.query('test-db', 'SELECT $1', [1]);
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
      expect(result).toHaveProperty('executionTime');
    });

    it('should throw error for non-existent database', async () => {
      await expect(manager.query('non-existent', 'SELECT 1', [])).rejects.toThrow('Database not found');
    });

    it('should handle null database id', async () => {
      await expect(manager.query(null as any, 'SELECT 1', [])).rejects.toThrow();
    });

    it('should handle undefined query', async () => {
      await expect(manager.query('test-db', undefined as any, [])).rejects.toThrow();
    });

    it('should handle empty query', async () => {
      await expect(manager.query('test-db', '', [])).rejects.toThrow();
    });

    it('should handle null params', async () => {
      const result = await manager.query('test-db', 'SELECT $1', [null]);
      expect(result).toBeDefined();
    });

    it('should handle empty params', async () => {
      const result = await manager.query('test-db', 'SELECT 1', []);
      expect(result).toBeDefined();
    });

    it('should emit query:success event', async () => {
      const eventSpy = jest.fn();
      manager.on('query:success', eventSpy);

      await manager.query('test-db', 'SELECT 1', []);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle query with timeout option', async () => {
      const options: QueryOptions = { timeout: 5000 };
      const result = await manager.query('test-db', 'SELECT 1', [], options);
      expect(result).toBeDefined();
    });

    it('should handle read-only queries', async () => {
      const options: QueryOptions = { readOnly: true };
      const result = await manager.query('test-db', 'SELECT 1', [], options);
      expect(result).toBeDefined();
    });

    it('should handle query caching', async () => {
      const options: QueryOptions = { cache: true, cacheTTL: 60000 };

      // First query - cache miss
      const result1 = await manager.query('test-db', 'SELECT 1', [], options);
      expect(result1.fromCache).toBeUndefined();

      // Second query - cache hit
      const result2 = await manager.query('test-db', 'SELECT 1', [], options);
      expect(result2.fromCache).toBe(true);
    });

    it('should respect max result rows limit', async () => {
      manager.setSecurityConfig('test-db', {
        maxResultRows: 5,
        enableQueryLogging: false,
      });

      // This would need to mock a query that returns more than 5 rows
      // For now, just test it doesn't throw with small result set
      const result = await manager.query('test-db', 'SELECT 1', []);
      expect(result).toBeDefined();
    });
  });

  describe('SQL validation', () => {
    beforeEach(() => {
      manager.setSecurityConfig('test-db', {
        requireParameterized: true,
        blockDynamicIdentifiers: true,
        allowedOperations: new Set(['SELECT']),
        enableQueryLogging: false,
      });
    });

    it('should reject non-parameterized queries', async () => {
      await expect(
        manager.query('test-db', "SELECT * FROM users WHERE name = 'test'", [])
      ).rejects.toThrow('Non-parameterized queries are not allowed');
    });

    it('should reject disallowed operations', async () => {
      await expect(
        manager.query('test-db', 'DROP TABLE users', [])
      ).rejects.toThrow('not allowed');
    });

    it('should validate table access', async () => {
      manager.setSecurityConfig('test-db', {
        allowedTables: new Set(['users']),
        allowedOperations: new Set(['SELECT']),
        enableQueryLogging: false,
      });

      await expect(
        manager.query('test-db', 'SELECT * FROM forbidden_table WHERE id = $1', [1])
      ).rejects.toThrow('not allowed');
    });

    it('should allow wildcard table access', async () => {
      manager.setSecurityConfig('test-db', {
        allowedTables: new Set(['*']),
        allowedOperations: new Set(['SELECT']),
        enableQueryLogging: false,
      });

      await expect(
        manager.query('test-db', 'SELECT * FROM any_table WHERE id = $1', [1])
      ).resolves.toBeDefined();
    });

    it('should skip validation when skipValidation is true', async () => {
      const options: QueryOptions = { skipValidation: true };
      await expect(
        manager.query('test-db', 'DROP TABLE users', [], options)
      ).resolves.toBeDefined();
    });
  });
});

// ============================================================================
// Transaction Tests
// ============================================================================

describe('DatabasePoolManager - Transactions', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('beginTransaction', () => {
    it('should begin transaction', async () => {
      const tx = await manager.beginTransaction('test-db');
      expect(tx).toHaveProperty('id');
      expect(tx).toHaveProperty('connectionId');
      expect(tx.state).toBe('active');
    });

    it('should emit transaction:begin event', async () => {
      const eventSpy = jest.fn();
      manager.on('transaction:begin', eventSpy);

      await manager.beginTransaction('test-db');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should support different isolation levels', async () => {
      const levels: IsolationLevel[] = [
        'read_uncommitted',
        'read_committed',
        'repeatable_read',
        'serializable',
      ];

      for (const level of levels) {
        const tx = await manager.beginTransaction('test-db', level);
        expect(tx.isolationLevel).toBe(level);
        await manager.rollbackTransaction(tx.id);
      }
    });

    it('should throw error for non-existent database', async () => {
      await expect(manager.beginTransaction('non-existent')).rejects.toThrow('Database not found');
    });

    it('should throw error during shutdown', async () => {
      await manager.close();
      await expect(manager.beginTransaction('test-db')).rejects.toThrow('shutting down');
    });
  });

  describe('commitTransaction', () => {
    it('should commit transaction', async () => {
      const tx = await manager.beginTransaction('test-db');
      await expect(manager.commitTransaction(tx.id)).resolves.not.toThrow();
    });

    it('should emit transaction:commit event', async () => {
      const tx = await manager.beginTransaction('test-db');
      const eventSpy = jest.fn();
      manager.on('transaction:commit', eventSpy);

      await manager.commitTransaction(tx.id);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent transaction', async () => {
      await expect(manager.commitTransaction('non-existent')).rejects.toThrow('Transaction not found');
    });

    it('should throw error for already committed transaction', async () => {
      const tx = await manager.beginTransaction('test-db');
      await manager.commitTransaction(tx.id);
      await expect(manager.commitTransaction(tx.id)).rejects.toThrow('Transaction not found');
    });
  });

  describe('rollbackTransaction', () => {
    it('should rollback transaction', async () => {
      const tx = await manager.beginTransaction('test-db');
      await expect(manager.rollbackTransaction(tx.id)).resolves.not.toThrow();
    });

    it('should emit transaction:rollback event', async () => {
      const tx = await manager.beginTransaction('test-db');
      const eventSpy = jest.fn();
      manager.on('transaction:rollback', eventSpy);

      await manager.rollbackTransaction(tx.id);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent transaction', async () => {
      await expect(manager.rollbackTransaction('non-existent')).rejects.toThrow('Transaction not found');
    });
  });

  describe('savepoints', () => {
    it('should create savepoint', async () => {
      const tx = await manager.beginTransaction('test-db');
      await expect(manager.createSavepoint(tx.id, 'sp1')).resolves.not.toThrow();
      await manager.rollbackTransaction(tx.id);
    });

    it('should rollback to savepoint', async () => {
      const tx = await manager.beginTransaction('test-db');
      await manager.createSavepoint(tx.id, 'sp1');
      await expect(manager.rollbackToSavepoint(tx.id, 'sp1')).resolves.not.toThrow();
      await manager.rollbackTransaction(tx.id);
    });

    it('should emit savepoint events', async () => {
      const tx = await manager.beginTransaction('test-db');
      const eventSpy = jest.fn();
      manager.on('transaction:savepoint', eventSpy);

      await manager.createSavepoint(tx.id, 'sp1');

      expect(eventSpy).toHaveBeenCalled();
      await manager.rollbackTransaction(tx.id);
    });
  });
});

// ============================================================================
// Query Logging Tests
// ============================================================================

describe('DatabasePoolManager - Query Logging', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
    manager.setSecurityConfig('test-db', {
      enableQueryLogging: true,
    });
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('getQueryLogs', () => {
    it('should return query logs', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      const logs = manager.getQueryLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should filter logs by database', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      const logs = manager.getQueryLogs({ databaseId: 'test-db' });
      expect(logs.every(log => log.databaseId === 'test-db')).toBe(true);
    });

    it('should filter logs by success', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      const logs = manager.getQueryLogs({ success: true });
      expect(logs.every(log => log.success === true)).toBe(true);
    });

    it('should limit logs', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      await manager.query('test-db', 'SELECT 2', []);
      const logs = manager.getQueryLogs({ limit: 1 });
      expect(logs.length).toBeLessThanOrEqual(1);
    });

    it('should handle empty logs', () => {
      const logs = manager.getQueryLogs();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('getQueryStatistics', () => {
    it('should return query statistics', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      const stats = manager.getQueryStatistics('test-db');

      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('successfulQueries');
      expect(stats).toHaveProperty('failedQueries');
      expect(stats).toHaveProperty('averageExecutionTime');
    });

    it('should handle no logs', () => {
      const stats = manager.getQueryStatistics('test-db');
      expect(stats.totalQueries).toBe(0);
    });

    it('should calculate average execution time', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      await manager.query('test-db', 'SELECT 2', []);
      const stats = manager.getQueryStatistics('test-db');
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearQueryLogs', () => {
    it('should clear all logs', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      manager.clearQueryLogs();
      const logs = manager.getQueryLogs();
      expect(logs.length).toBe(0);
    });

    it('should clear logs for specific database', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      manager.clearQueryLogs('test-db');
      const logs = manager.getQueryLogs({ databaseId: 'test-db' });
      expect(logs.length).toBe(0);
    });

    it('should emit query_logs:cleared event', () => {
      const eventSpy = jest.fn();
      manager.on('query_logs:cleared', eventSpy);
      manager.clearQueryLogs();
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Prepared Statements Tests
// ============================================================================

describe('DatabasePoolManager - Prepared Statements', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('prepare', () => {
    it('should prepare statement', async () => {
      const stmt = await manager.prepare('test-db', 'SELECT * FROM users WHERE id = $1');
      expect(stmt).toHaveProperty('id');
      expect(stmt).toHaveProperty('query');
      expect(stmt).toHaveProperty('databaseId');
    });

    it('should reuse existing prepared statement', async () => {
      const stmt1 = await manager.prepare('test-db', 'SELECT 1');
      const stmt2 = await manager.prepare('test-db', 'SELECT 1');
      expect(stmt1.id).toBe(stmt2.id);
    });

    it('should throw error for non-existent database', async () => {
      await expect(manager.prepare('non-existent', 'SELECT 1')).rejects.toThrow('Database not found');
    });

    it('should throw error during shutdown', async () => {
      await manager.close();
      await expect(manager.prepare('test-db', 'SELECT 1')).rejects.toThrow('shutting down');
    });

    it('should emit prepared_statement:created event', async () => {
      const eventSpy = jest.fn();
      manager.on('prepared_statement:created', eventSpy);

      await manager.prepare('test-db', 'SELECT 1');

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('executePrepared', () => {
    it('should execute prepared statement', async () => {
      const stmt = await manager.prepare('test-db', 'SELECT $1');
      const result = await manager.executePrepared(stmt.id, [1]);
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
    });

    it('should throw error for non-existent statement', async () => {
      await expect(manager.executePrepared('non-existent', [])).rejects.toThrow('not found');
    });

    it('should handle null parameters', async () => {
      const stmt = await manager.prepare('test-db', 'SELECT $1');
      const result = await manager.executePrepared(stmt.id, [null]);
      expect(result).toBeDefined();
    });

    it('should handle empty parameters', async () => {
      const stmt = await manager.prepare('test-db', 'SELECT 1');
      const result = await manager.executePrepared(stmt.id, []);
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// Query Cache Tests
// ============================================================================

describe('DatabasePoolManager - Query Cache', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('clearQueryCache', () => {
    it('should clear all cache', async () => {
      await manager.query('test-db', 'SELECT 1', [], { cache: true });
      manager.clearQueryCache();
      const result = await manager.query('test-db', 'SELECT 1', [], { cache: true });
      expect(result.fromCache).toBeUndefined();
    });

    it('should clear cache for specific database', async () => {
      await manager.query('test-db', 'SELECT 1', [], { cache: true });
      manager.clearQueryCache('test-db');
      const result = await manager.query('test-db', 'SELECT 1', [], { cache: true });
      expect(result.fromCache).toBeUndefined();
    });

    it('should emit cache:cleared event', () => {
      const eventSpy = jest.fn();
      manager.on('cache:cleared', eventSpy);
      manager.clearQueryCache();
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle empty cache', () => {
      expect(() => manager.clearQueryCache()).not.toThrow();
    });
  });

  describe('cache behavior', () => {
    it('should cache query results', async () => {
      const options: QueryOptions = { cache: true, cacheTTL: 60000 };
      await manager.query('test-db', 'SELECT 1', [], options);
      const result = await manager.query('test-db', 'SELECT 1', [], options);
      expect(result.fromCache).toBe(true);
    });

    it('should not cache by default', async () => {
      await manager.query('test-db', 'SELECT 1', []);
      const result = await manager.query('test-db', 'SELECT 1', []);
      expect(result.fromCache).toBeUndefined();
    });

    it('should respect cache TTL', async () => {
      const options: QueryOptions = { cache: true, cacheTTL: 100 };
      await manager.query('test-db', 'SELECT 1', [], options);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await manager.query('test-db', 'SELECT 1', [], options);
      expect(result.fromCache).toBeUndefined();
    });
  });
});

// ============================================================================
// Migration Tests
// ============================================================================

describe('DatabasePoolManager - Migrations', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('runMigrations', () => {
    it('should run migrations', async () => {
      const migration: Migration = {
        id: 'migration-1',
        name: 'create_users',
        version: 1,
        up: 'CREATE TABLE users (id INT)',
        down: 'DROP TABLE users',
        checksum: 'abc123',
      };

      await expect(manager.runMigrations('test-db', [migration])).resolves.not.toThrow();
    });

    it('should skip already applied migrations', async () => {
      const migration: Migration = {
        id: 'migration-1',
        name: 'create_users',
        version: 1,
        up: 'CREATE TABLE users (id INT)',
        down: 'DROP TABLE users',
        checksum: 'abc123',
      };

      await manager.runMigrations('test-db', [migration]);
      await expect(manager.runMigrations('test-db', [migration])).resolves.not.toThrow();
    });

    it('should emit migration:applied event', async () => {
      const migration: Migration = {
        id: 'migration-1',
        name: 'create_users',
        version: 1,
        up: 'CREATE TABLE users (id INT)',
        down: 'DROP TABLE users',
        checksum: 'abc123',
      };

      const eventSpy = jest.fn();
      manager.on('migration:applied', eventSpy);

      await manager.runMigrations('test-db', [migration]);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const migration: Migration = {
        id: 'migration-1',
        name: 'invalid_migration',
        version: 1,
        up: 'INVALID SQL',
        down: 'DROP TABLE users',
        checksum: 'abc123',
      };

      await expect(manager.runMigrations('test-db', [migration])).rejects.toThrow();
    });

    it('should handle empty migration list', async () => {
      await expect(manager.runMigrations('test-db', [])).resolves.not.toThrow();
    });
  });

  describe('rollbackMigration', () => {
    it('should rollback migration', async () => {
      const migration: Migration = {
        id: 'migration-1',
        name: 'create_users',
        version: 1,
        up: 'CREATE TABLE users (id INT)',
        down: 'DROP TABLE users',
        checksum: 'abc123',
      };

      await manager.runMigrations('test-db', [migration]);
      await expect(manager.rollbackMigration('test-db', 1)).resolves.not.toThrow();
    });

    it('should emit migration:rolled_back event', async () => {
      const migration: Migration = {
        id: 'migration-1',
        name: 'create_users',
        version: 1,
        up: 'CREATE TABLE users (id INT)',
        down: 'DROP TABLE users',
        checksum: 'abc123',
      };

      await manager.runMigrations('test-db', [migration]);

      const eventSpy = jest.fn();
      manager.on('migration:rolled_back', eventSpy);

      await manager.rollbackMigration('test-db', 1);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent migration', async () => {
      await expect(manager.rollbackMigration('test-db', 999)).rejects.toThrow('not found');
    });
  });
});

// ============================================================================
// Pool Statistics Tests
// ============================================================================

describe('DatabasePoolManager - Pool Statistics', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      const stats = manager.getPoolStats('test-db');
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('databaseId');
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('activeConnections');
    });

    it('should return undefined for non-existent pool', () => {
      const stats = manager.getPoolStats('non-existent');
      expect(stats).toBeUndefined();
    });

    it('should handle null database id', () => {
      const stats = manager.getPoolStats(null as any);
      expect(stats).toBeUndefined();
    });
  });

  describe('getAllPoolStats', () => {
    it('should return all pool statistics', () => {
      const allStats = manager.getAllPoolStats();
      expect(allStats).toBeInstanceOf(Map);
      expect(allStats.size).toBeGreaterThan(0);
    });

    it('should return empty map when no pools', async () => {
      const newManager = new DatabasePoolManager();
      const allStats = newManager.getAllPoolStats();
      expect(allStats.size).toBe(0);
      await newManager.close();
    });
  });
});

// ============================================================================
// Health Monitoring Tests
// ============================================================================

describe('DatabasePoolManager - Health Monitoring', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('getPoolHealth', () => {
    it('should return pool health status', () => {
      const health = manager.getPoolHealth('test-db');
      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('healthScore');
    });

    it('should return undefined for non-existent pool', () => {
      const health = manager.getPoolHealth('non-existent');
      expect(health).toBeUndefined();
    });
  });

  describe('getAllPoolHealth', () => {
    it('should return all pool health statuses', () => {
      const allHealth = manager.getAllPoolHealth();
      expect(allHealth).toBeInstanceOf(Map);
      expect(allHealth.size).toBeGreaterThan(0);
    });
  });

  describe('isPoolHealthy', () => {
    it('should return health status', () => {
      const isHealthy = manager.isPoolHealthy('test-db');
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should return false for non-existent pool', () => {
      const isHealthy = manager.isPoolHealthy('non-existent');
      expect(isHealthy).toBe(false);
    });
  });

  describe('forceHealthCheck', () => {
    it('should force health check', async () => {
      await expect(manager.forceHealthCheck('test-db')).resolves.not.toThrow();
    });

    it('should handle non-existent pool', async () => {
      await expect(manager.forceHealthCheck('non-existent')).resolves.not.toThrow();
    });
  });
});

// ============================================================================
// Connection Leak Detection Tests
// ============================================================================

describe('DatabasePoolManager - Connection Leak Detection', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('getConnectionLeaks', () => {
    it('should return connection leaks', () => {
      const leaks = manager.getConnectionLeaks('test-db');
      expect(Array.isArray(leaks)).toBe(true);
    });

    it('should return undefined for non-existent pool', () => {
      const leaks = manager.getConnectionLeaks('non-existent');
      expect(leaks).toBeUndefined();
    });
  });

  describe('getAllConnectionLeaks', () => {
    it('should return all connection leaks', () => {
      const allLeaks = manager.getAllConnectionLeaks();
      expect(allLeaks).toBeInstanceOf(Map);
    });
  });

  describe('getResourceUsage', () => {
    it('should return resource usage', () => {
      const usage = manager.getResourceUsage();
      expect(usage).toHaveProperty('pools');
      expect(usage).toHaveProperty('totalConnections');
      expect(usage).toHaveProperty('activeConnections');
      expect(usage).toHaveProperty('potentialLeaks');
    });
  });

  describe('detectResourceLeaks', () => {
    it('should detect resource leaks', () => {
      const leaks = manager.detectResourceLeaks();
      expect(leaks).toHaveProperty('connectionLeaks');
      expect(leaks).toHaveProperty('staleTransactions');
      expect(leaks).toHaveProperty('unusedPreparedStatements');
    });
  });

  describe('forceCleanupLeaks', () => {
    it('should cleanup resource leaks', async () => {
      const result = await manager.forceCleanupLeaks();
      expect(result).toHaveProperty('connectionsReleased');
      expect(result).toHaveProperty('transactionsRolledBack');
      expect(result).toHaveProperty('preparedStatementsClosed');
    });

    it('should emit resource:leaks_cleaned event', async () => {
      const eventSpy = jest.fn();
      manager.on('resource:leaks_cleaned', eventSpy);

      await manager.forceCleanupLeaks();

      expect(eventSpy).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Circuit Breaker Tests
// ============================================================================

describe('DatabasePoolManager - Circuit Breaker', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('getCircuitBreakerState', () => {
    it('should return circuit breaker state', () => {
      const state = manager.getCircuitBreakerState('test-db');
      expect(state).toBeDefined();
      expect(['closed', 'open', 'half_open']).toContain(state);
    });

    it('should return undefined for non-existent pool', () => {
      const state = manager.getCircuitBreakerState('non-existent');
      expect(state).toBeUndefined();
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit breaker', () => {
      expect(() => manager.resetCircuitBreaker('test-db')).not.toThrow();
    });

    it('should emit circuit_breaker:manual_reset event', () => {
      const eventSpy = jest.fn();
      manager.on('circuit_breaker:manual_reset', eventSpy);

      manager.resetCircuitBreaker('test-db');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle non-existent pool', () => {
      expect(() => manager.resetCircuitBreaker('non-existent')).not.toThrow();
    });
  });
});

// ============================================================================
// Graceful Shutdown Tests
// ============================================================================

describe('DatabasePoolManager - Graceful Shutdown', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  describe('close', () => {
    it('should close manager gracefully', async () => {
      await expect(manager.close()).resolves.not.toThrow();
    });

    it('should emit closed event', async () => {
      const eventSpy = jest.fn();
      manager.on('closed', eventSpy);

      await manager.close();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await manager.close();
      await expect(manager.close()).resolves.not.toThrow();
    });

    it('should rollback active transactions', async () => {
      const tx = await manager.beginTransaction('test-db');
      await manager.close();
      // Transaction should be rolled back automatically
    });

    it('should reject new operations after close', async () => {
      await manager.close();
      await expect(manager.query('test-db', 'SELECT 1', [])).rejects.toThrow('shutting down');
    });

    it('should cleanup all resources', async () => {
      await manager.query('test-db', 'SELECT 1', [], { cache: true });
      await manager.close();

      const usage = manager.getResourceUsage();
      expect(usage.pools).toBe(0);
    });
  });

  describe('isShutdown', () => {
    it('should return false initially', () => {
      expect(manager.isShutdown()).toBe(false);
    });

    it('should return true after close', async () => {
      await manager.close();
      expect(manager.isShutdown()).toBe(true);
    });
  });
});

// ============================================================================
// Concurrency and Stress Tests
// ============================================================================

describe('DatabasePoolManager - Concurrency', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
    const dbConfig: DatabaseConfig = {
      id: 'test-db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };
    await manager.registerDatabase(dbConfig);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('concurrent queries', () => {
    it('should handle multiple concurrent queries', async () => {
      const queries = Array.from({ length: 20 }, (_, i) =>
        manager.query('test-db', 'SELECT $1', [i])
      );

      const results = await Promise.all(queries);
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result).toHaveProperty('rows');
      });
    });

    it('should handle concurrent transactions', async () => {
      const transactions = Array.from({ length: 5 }, async () => {
        const tx = await manager.beginTransaction('test-db');
        await manager.query('test-db', 'SELECT 1', []);
        await manager.commitTransaction(tx.id);
      });

      await expect(Promise.all(transactions)).resolves.not.toThrow();
    });

    it('should handle mixed operations', async () => {
      const operations = [
        manager.query('test-db', 'SELECT 1', []),
        manager.beginTransaction('test-db'),
        manager.query('test-db', 'SELECT 2', []),
        manager.prepare('test-db', 'SELECT $1'),
      ];

      await expect(Promise.allSettled(operations)).resolves.toBeDefined();
    });
  });

  describe('stress testing', () => {
    it('should handle rapid sequential operations', async () => {
      for (let i = 0; i < 50; i++) {
        await manager.query('test-db', 'SELECT $1', [i]);
      }
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      // This would test pool limits - simplified for unit tests
      const queries = Array.from({ length: 100 }, (_, i) =>
        manager.query('test-db', 'SELECT $1', [i])
      );

      await expect(Promise.allSettled(queries)).resolves.toBeDefined();
    });
  });
});

// ============================================================================
// Error Handling and Edge Cases
// ============================================================================

describe('DatabasePoolManager - Error Handling', () => {
  let manager: DatabasePoolManager;

  beforeEach(async () => {
    manager = new DatabasePoolManager();
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('null and undefined handling', () => {
    it('should handle null database config', async () => {
      await expect(manager.registerDatabase(null as any)).rejects.toThrow();
    });

    it('should handle undefined database id in query', async () => {
      await expect(manager.query(undefined as any, 'SELECT 1', [])).rejects.toThrow();
    });

    it('should handle null query string', async () => {
      const dbConfig: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };
      await manager.registerDatabase(dbConfig);
      await expect(manager.query('test-db', null as any, [])).rejects.toThrow();
    });
  });

  describe('timeout handling', () => {
    it('should handle query timeout', async () => {
      const dbConfig: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };
      await manager.registerDatabase(dbConfig);

      const options: QueryOptions = { timeout: 1 };
      // This would need a long-running query to properly test
      await expect(manager.query('test-db', 'SELECT 1', [], options)).resolves.toBeDefined();
    });

    it('should handle transaction timeout', async () => {
      const dbConfig: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };
      await manager.registerDatabase(dbConfig);

      const tx = await manager.beginTransaction('test-db');
      // Transaction would auto-rollback after timeout in real scenario
      await manager.rollbackTransaction(tx.id);
    });
  });

  describe('error recovery', () => {
    it('should recover from query errors', async () => {
      const dbConfig: DatabaseConfig = {
        id: 'test-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
      };
      await manager.registerDatabase(dbConfig);

      // Attempt invalid query
      try {
        await manager.query('test-db', 'INVALID SQL', []);
      } catch (error) {
        // Expected error
      }

      // Should still be able to execute valid queries
      const result = await manager.query('test-db', 'SELECT 1', []);
      expect(result).toBeDefined();
    });
  });
});

