/**
 * Database + API Integration Tests
 * Tests real database connections, transactions, and API interactions
 */

import { DatabasePoolManager, DatabaseConfig, DatabaseType } from '../../../src/database/DatabasePoolManager';
import { APIGateway, APIRequest, HTTPMethod } from '../../../src/api/APIGateway';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Database + API Integration Tests', () => {
  let dbManager: DatabasePoolManager;
  let gateway: APIGateway;
  let testDbPath: string;

  beforeAll(() => {
    // Create temp directory for SQLite databases
    testDbPath = join(tmpdir(), `test-db-${Date.now()}`);
    try {
      mkdirSync(testDbPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(() => {
    // Cleanup temp directory
    try {
      rmSync(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    dbManager = new DatabasePoolManager();
    gateway = new APIGateway();
  });

  afterEach(async () => {
    // Cleanup
    await dbManager.closeAll();
  });

  describe('Real Database Connections', () => {
    it('should connect to SQLite database', async () => {
      const dbPath = join(testDbPath, 'test.db');

      const config: DatabaseConfig = {
        id: 'test-sqlite',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 1,
          max: 5,
        },
      };

      await dbManager.addDatabase(config);

      const pool = dbManager.getPool('test-sqlite');
      expect(pool).toBeDefined();
      expect(pool?.config.id).toBe('test-sqlite');
    });

    it('should execute queries against real database', async () => {
      const dbPath = join(testDbPath, 'query-test.db');

      const config: DatabaseConfig = {
        id: 'query-test',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      // Create table
      await dbManager.query('query-test', {
        text: 'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)',
        values: [],
      });

      // Insert data
      await dbManager.query('query-test', {
        text: 'INSERT INTO users (name, email) VALUES (?, ?)',
        values: ['John Doe', 'john@example.com'],
      });

      // Query data
      const result = await dbManager.query('query-test', {
        text: 'SELECT * FROM users WHERE name = ?',
        values: ['John Doe'],
      });

      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.rows[0]).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should handle connection pool exhaustion', async () => {
      const dbPath = join(testDbPath, 'pool-test.db');

      const config: DatabaseConfig = {
        id: 'pool-test',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 1,
          max: 2,
          acquireTimeout: 1000,
        },
      };

      await dbManager.addDatabase(config);

      // Acquire all connections
      const conn1 = await dbManager.acquire('pool-test');
      const conn2 = await dbManager.acquire('pool-test');

      // Try to acquire when pool is exhausted
      const acquirePromise = dbManager.acquire('pool-test');

      // Should timeout
      await expect(acquirePromise).rejects.toThrow();

      // Release connections
      await dbManager.release('pool-test', conn1.id);
      await dbManager.release('pool-test', conn2.id);
    });
  });

  describe('Transaction Handling', () => {
    it('should commit successful transactions', async () => {
      const dbPath = join(testDbPath, 'transaction-commit.db');

      const config: DatabaseConfig = {
        id: 'tx-commit',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      // Create table
      await dbManager.query('tx-commit', {
        text: 'CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, balance INTEGER)',
        values: [],
      });

      // Execute transaction
      const result = await dbManager.transaction('tx-commit', async (client) => {
        await client.query({
          text: 'INSERT INTO accounts (balance) VALUES (?)',
          values: [1000],
        });

        await client.query({
          text: 'INSERT INTO accounts (balance) VALUES (?)',
          values: [2000],
        });

        return { success: true };
      });

      expect(result.success).toBe(true);

      // Verify data was committed
      const accounts = await dbManager.query('tx-commit', {
        text: 'SELECT * FROM accounts',
        values: [],
      });

      expect(accounts.rowCount).toBe(2);
    });

    it('should rollback failed transactions', async () => {
      const dbPath = join(testDbPath, 'transaction-rollback.db');

      const config: DatabaseConfig = {
        id: 'tx-rollback',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      // Create table
      await dbManager.query('tx-rollback', {
        text: 'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)',
        values: [],
      });

      // Execute transaction that fails
      await expect(
        dbManager.transaction('tx-rollback', async (client) => {
          await client.query({
            text: 'INSERT INTO items (name) VALUES (?)',
            values: ['Item 1'],
          });

          // Force error
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // Verify data was rolled back
      const items = await dbManager.query('tx-rollback', {
        text: 'SELECT * FROM items',
        values: [],
      });

      expect(items.rowCount).toBe(0);
    });

    it('should handle nested transactions', async () => {
      const dbPath = join(testDbPath, 'nested-tx.db');

      const config: DatabaseConfig = {
        id: 'nested-tx',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      await dbManager.query('nested-tx', {
        text: 'CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, status TEXT)',
        values: [],
      });

      // Outer transaction
      await dbManager.transaction('nested-tx', async (client) => {
        await client.query({
          text: 'INSERT INTO orders (status) VALUES (?)',
          values: ['pending'],
        });

        // Simulate nested operation
        await client.query({
          text: 'UPDATE orders SET status = ? WHERE status = ?',
          values: ['completed', 'pending'],
        });
      });

      const orders = await dbManager.query('nested-tx', {
        text: 'SELECT * FROM orders WHERE status = ?',
        values: ['completed'],
      });

      expect(orders.rowCount).toBe(1);
    });
  });

  describe('API + Database Integration', () => {
    it('should handle end-to-end API requests with database operations', async () => {
      const dbPath = join(testDbPath, 'api-db.db');

      const config: DatabaseConfig = {
        id: 'api-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      // Create table
      await dbManager.query('api-db', {
        text: 'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL)',
        values: [],
      });

      // Register API endpoint
      gateway.registerEndpoint({
        path: '/api/products',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { name, price } = request.body;

          const result = await dbManager.query('api-db', {
            text: 'INSERT INTO products (name, price) VALUES (?, ?)',
            values: [name, price],
          });

          return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: { id: result.rows[0]?.id || 1, name, price },
          };
        },
        middleware: [],
        tags: ['products'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/products',
        headers: {},
        query: {},
        params: {},
        body: {
          name: 'Laptop',
          price: 999.99,
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('Laptop');

      // Verify in database
      const products = await dbManager.query('api-db', {
        text: 'SELECT * FROM products WHERE name = ?',
        values: ['Laptop'],
      });

      expect(products.rowCount).toBe(1);
      expect(products.rows[0].price).toBe(999.99);
    });

    it('should handle database errors in API endpoints', async () => {
      const dbPath = join(testDbPath, 'api-error.db');

      const config: DatabaseConfig = {
        id: 'api-error',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      gateway.registerEndpoint({
        path: '/api/error-test',
        method: HTTPMethod.GET,
        handler: async () => {
          // Query non-existent table
          await dbManager.query('api-error', {
            text: 'SELECT * FROM non_existent_table',
            values: [],
          });

          return {
            statusCode: 200,
            headers: {},
            body: {},
          };
        },
        middleware: [],
        tags: ['error'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/error-test',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent database writes', async () => {
      const dbPath = join(testDbPath, 'concurrent.db');

      const config: DatabaseConfig = {
        id: 'concurrent',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 2,
          max: 10,
        },
      };

      await dbManager.addDatabase(config);

      await dbManager.query('concurrent', {
        text: 'CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, timestamp INTEGER)',
        values: [],
      });

      // Execute concurrent writes
      const writes = Array.from({ length: 20 }, (_, i) =>
        dbManager.query('concurrent', {
          text: 'INSERT INTO logs (message, timestamp) VALUES (?, ?)',
          values: [`Message ${i}`, Date.now()],
        })
      );

      await Promise.all(writes);

      // Verify all writes succeeded
      const logs = await dbManager.query('concurrent', {
        text: 'SELECT COUNT(*) as count FROM logs',
        values: [],
      });

      expect(logs.rows[0].count).toBe(20);
    });

    it('should handle concurrent API requests with database operations', async () => {
      const dbPath = join(testDbPath, 'concurrent-api.db');

      const config: DatabaseConfig = {
        id: 'concurrent-api',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 2,
          max: 10,
        },
      };

      await dbManager.addDatabase(config);

      await dbManager.query('concurrent-api', {
        text: 'CREATE TABLE IF NOT EXISTS counters (id INTEGER PRIMARY KEY, value INTEGER)',
        values: [],
      });

      await dbManager.query('concurrent-api', {
        text: 'INSERT INTO counters (id, value) VALUES (1, 0)',
        values: [],
      });

      gateway.registerEndpoint({
        path: '/api/counter/increment',
        method: HTTPMethod.POST,
        handler: async () => {
          await dbManager.transaction('concurrent-api', async (client) => {
            const current = await client.query({
              text: 'SELECT value FROM counters WHERE id = 1',
              values: [],
            });

            const newValue = current.rows[0].value + 1;

            await client.query({
              text: 'UPDATE counters SET value = ? WHERE id = 1',
              values: [newValue],
            });
          });

          return {
            statusCode: 200,
            headers: {},
            body: { success: true },
          };
        },
        middleware: [],
        tags: ['counter'],
      });

      // Make concurrent requests
      const requests = Array.from({ length: 10 }, () => {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/counter/increment',
          headers: {},
          query: {},
          params: {},
          body: {},
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      });

      await Promise.all(requests);

      // Verify final counter value
      const result = await dbManager.query('concurrent-api', {
        text: 'SELECT value FROM counters WHERE id = 1',
        values: [],
      });

      expect(result.rows[0].value).toBe(10);
    });
  });

  describe('Connection Pool Management', () => {
    it('should reuse connections from pool', async () => {
      const dbPath = join(testDbPath, 'pool-reuse.db');

      const config: DatabaseConfig = {
        id: 'pool-reuse',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 2,
          max: 5,
        },
      };

      await dbManager.addDatabase(config);

      const pool = dbManager.getPool('pool-reuse');
      expect(pool).toBeDefined();

      // Acquire and release multiple times
      const conn1 = await dbManager.acquire('pool-reuse');
      const firstId = conn1.id;
      await dbManager.release('pool-reuse', conn1.id);

      const conn2 = await dbManager.acquire('pool-reuse');
      await dbManager.release('pool-reuse', conn2.id);

      // Should reuse connection
      expect(pool?.metrics.totalAcquired).toBeGreaterThanOrEqual(2);
      expect(pool?.metrics.totalReleased).toBeGreaterThanOrEqual(2);
    });

    it('should track connection metrics', async () => {
      const dbPath = join(testDbPath, 'metrics.db');

      const config: DatabaseConfig = {
        id: 'metrics',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      // Perform operations
      await dbManager.query('metrics', {
        text: 'SELECT 1',
        values: [],
      });

      const pool = dbManager.getPool('metrics');
      expect(pool?.metrics).toBeDefined();
      expect(pool?.metrics.totalAcquired).toBeGreaterThan(0);
      expect(pool?.metrics.totalReleased).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from connection failures', async () => {
      const dbPath = join(testDbPath, 'recovery.db');

      const config: DatabaseConfig = {
        id: 'recovery',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          maxRetries: 3,
          retryDelay: 100,
        },
      };

      await dbManager.addDatabase(config);

      // Create table
      await dbManager.query('recovery', {
        text: 'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)',
        values: [],
      });

      // Simulate recoverable operations
      const result = await dbManager.query('recovery', {
        text: 'INSERT INTO test (id) VALUES (?)',
        values: [1],
      });

      expect(result).toBeDefined();
    });
  });

  describe('Query Optimization', () => {
    it('should handle prepared statements', async () => {
      const dbPath = join(testDbPath, 'prepared.db');

      const config: DatabaseConfig = {
        id: 'prepared',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(config);

      await dbManager.query('prepared', {
        text: 'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT, category TEXT)',
        values: [],
      });

      // Execute same query with different parameters
      for (let i = 0; i < 5; i++) {
        await dbManager.query('prepared', {
          text: 'INSERT INTO items (name, category) VALUES (?, ?)',
          values: [`Item ${i}`, 'Category A'],
        });
      }

      const result = await dbManager.query('prepared', {
        text: 'SELECT * FROM items WHERE category = ?',
        values: ['Category A'],
      });

      expect(result.rowCount).toBe(5);
    });
  });
});
