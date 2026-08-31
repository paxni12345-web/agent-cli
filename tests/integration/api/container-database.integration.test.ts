/**
 * Real Database Integration Tests with Test Containers
 * Tests actual database operations using containerized databases
 */

import { DatabasePoolManager, DatabaseConfig, DatabaseType } from '../../../src/database/DatabasePoolManager';
import { APIGateway, APIRequest, HTTPMethod } from '../../../src/api/APIGateway';
import {
  isDockerAvailable,
  PostgreSQLContainer,
  MySQLContainer,
  RedisContainer,
  cleanupTestContainers,
  waitForService,
} from './test-containers.util';

describe('Real Database Integration Tests (Test Containers)', () => {
  let dbManager: DatabasePoolManager;
  let gateway: APIGateway;
  let dockerAvailable: boolean;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.warn('Docker not available - skipping container-based tests');
    }
  });

  afterAll(async () => {
    if (dockerAvailable) {
      await cleanupTestContainers();
    }
  });

  beforeEach(() => {
    dbManager = new DatabasePoolManager();
    gateway = new APIGateway();
  });

  afterEach(async () => {
    await dbManager.closeAll();
  });

  describe('PostgreSQL Container Tests', () => {
    let pgContainer: PostgreSQLContainer;

    beforeEach(async () => {
      if (!dockerAvailable) {
        return;
      }

      pgContainer = new PostgreSQLContainer('test-pg-api', 15432);
      await pgContainer.start();
    });

    afterEach(async () => {
      if (pgContainer) {
        await pgContainer.stop();
      }
    });

    it('should connect to real PostgreSQL container', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const config = pgContainer.getConnectionConfig();

      const dbConfig: DatabaseConfig = {
        id: 'postgres-test',
        type: 'postgresql' as DatabaseType,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
      };

      await dbManager.addDatabase(dbConfig);

      // Test connection
      const result = await dbManager.query('postgres-test', {
        text: 'SELECT version()',
        values: [],
      });

      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.rows[0]).toHaveProperty('version');
    });

    it('should perform CRUD operations on PostgreSQL', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const config = pgContainer.getConnectionConfig();

      const dbConfig: DatabaseConfig = {
        id: 'pg-crud',
        type: 'postgresql' as DatabaseType,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
      };

      await dbManager.addDatabase(dbConfig);

      // Create table
      await dbManager.query('pg-crud', {
        text: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255))',
        values: [],
      });

      // Insert
      await dbManager.query('pg-crud', {
        text: 'INSERT INTO users (name, email) VALUES ($1, $2)',
        values: ['John Doe', 'john@example.com'],
      });

      // Read
      const selectResult = await dbManager.query('pg-crud', {
        text: 'SELECT * FROM users WHERE name = $1',
        values: ['John Doe'],
      });

      expect(selectResult.rowCount).toBe(1);
      expect(selectResult.rows[0].email).toBe('john@example.com');

      // Update
      await dbManager.query('pg-crud', {
        text: 'UPDATE users SET email = $1 WHERE name = $2',
        values: ['newemail@example.com', 'John Doe'],
      });

      const updatedResult = await dbManager.query('pg-crud', {
        text: 'SELECT * FROM users WHERE name = $1',
        values: ['John Doe'],
      });

      expect(updatedResult.rows[0].email).toBe('newemail@example.com');

      // Delete
      await dbManager.query('pg-crud', {
        text: 'DELETE FROM users WHERE name = $1',
        values: ['John Doe'],
      });

      const deleteResult = await dbManager.query('pg-crud', {
        text: 'SELECT * FROM users WHERE name = $1',
        values: ['John Doe'],
      });

      expect(deleteResult.rowCount).toBe(0);
    });

    it('should handle PostgreSQL transactions', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const config = pgContainer.getConnectionConfig();

      const dbConfig: DatabaseConfig = {
        id: 'pg-tx',
        type: 'postgresql' as DatabaseType,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
      };

      await dbManager.addDatabase(dbConfig);

      await dbManager.query('pg-tx', {
        text: 'CREATE TABLE accounts (id SERIAL PRIMARY KEY, balance DECIMAL(10, 2))',
        values: [],
      });

      // Successful transaction
      await dbManager.transaction('pg-tx', async (client) => {
        await client.query({
          text: 'INSERT INTO accounts (balance) VALUES ($1)',
          values: [1000],
        });

        await client.query({
          text: 'INSERT INTO accounts (balance) VALUES ($1)',
          values: [2000],
        });
      });

      const result = await dbManager.query('pg-tx', {
        text: 'SELECT COUNT(*) as count FROM accounts',
        values: [],
      });

      expect(parseInt(result.rows[0].count)).toBe(2);

      // Failed transaction (should rollback)
      await expect(
        dbManager.transaction('pg-tx', async (client) => {
          await client.query({
            text: 'INSERT INTO accounts (balance) VALUES ($1)',
            values: [3000],
          });

          throw new Error('Transaction failed');
        })
      ).rejects.toThrow();

      const finalResult = await dbManager.query('pg-tx', {
        text: 'SELECT COUNT(*) as count FROM accounts',
        values: [],
      });

      expect(parseInt(finalResult.rows[0].count)).toBe(2); // Unchanged
    });
  });

  describe('MySQL Container Tests', () => {
    let mysqlContainer: MySQLContainer;

    beforeEach(async () => {
      if (!dockerAvailable) {
        return;
      }

      mysqlContainer = new MySQLContainer('test-mysql-api', 13306);
      await mysqlContainer.start();
    });

    afterEach(async () => {
      if (mysqlContainer) {
        await mysqlContainer.stop();
      }
    });

    it('should connect to real MySQL container', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const config = mysqlContainer.getConnectionConfig();

      const dbConfig: DatabaseConfig = {
        id: 'mysql-test',
        type: 'mysql' as DatabaseType,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
      };

      await dbManager.addDatabase(dbConfig);

      const result = await dbManager.query('mysql-test', {
        text: 'SELECT VERSION()',
        values: [],
      });

      expect(result.rowCount).toBeGreaterThan(0);
    });

    it('should handle MySQL-specific features', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const config = mysqlContainer.getConnectionConfig();

      const dbConfig: DatabaseConfig = {
        id: 'mysql-features',
        type: 'mysql' as DatabaseType,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
      };

      await dbManager.addDatabase(dbConfig);

      // Create table with AUTO_INCREMENT
      await dbManager.query('mysql-features', {
        text: 'CREATE TABLE products (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), price DECIMAL(10, 2))',
        values: [],
      });

      // Insert without ID
      await dbManager.query('mysql-features', {
        text: 'INSERT INTO products (name, price) VALUES (?, ?)',
        values: ['Product 1', 99.99],
      });

      await dbManager.query('mysql-features', {
        text: 'INSERT INTO products (name, price) VALUES (?, ?)',
        values: ['Product 2', 149.99],
      });

      // Verify AUTO_INCREMENT worked
      const result = await dbManager.query('mysql-features', {
        text: 'SELECT * FROM products ORDER BY id',
        values: [],
      });

      expect(result.rowCount).toBe(2);
      expect(result.rows[0].id).toBe(1);
      expect(result.rows[1].id).toBe(2);
    });
  });

  describe('Redis Container Tests', () => {
    let redisContainer: RedisContainer;

    beforeEach(async () => {
      if (!dockerAvailable) {
        return;
      }

      redisContainer = new RedisContainer('test-redis-api', 16379);
      await redisContainer.start();
    });

    afterEach(async () => {
      if (redisContainer) {
        await redisContainer.stop();
      }
    });

    it('should connect to real Redis container', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const config = redisContainer.getConnectionConfig();

      const dbConfig: DatabaseConfig = {
        id: 'redis-test',
        type: 'redis' as DatabaseType,
        host: config.host,
        port: config.port,
        database: '0',
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      // Test SET and GET
      await dbManager.query('redis-test', {
        text: 'SET',
        values: ['test-key', 'test-value'],
      });

      const result = await dbManager.query('redis-test', {
        text: 'GET',
        values: ['test-key'],
      });

      expect(result.rows[0]).toBe('test-value');
    });

    it('should use Redis for API caching', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const config = redisContainer.getConnectionConfig();

      const dbConfig: DatabaseConfig = {
        id: 'redis-cache',
        type: 'redis' as DatabaseType,
        host: config.host,
        port: config.port,
        database: '0',
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      let computeCount = 0;

      gateway.registerEndpoint({
        path: '/api/cached-data',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const cacheKey = `api:cached-data:${JSON.stringify(request.query)}`;

          // Check Redis cache
          try {
            const cached = await dbManager.query('redis-cache', {
              text: 'GET',
              values: [cacheKey],
            });

            if (cached.rows[0]) {
              return {
                statusCode: 200,
                headers: { 'X-Cache': 'HIT' },
                body: JSON.parse(cached.rows[0]),
              };
            }
          } catch (error) {
            // Cache miss or error
          }

          // Compute result
          computeCount++;
          const result = {
            data: 'computed-data',
            timestamp: Date.now(),
            computeCount,
          };

          // Store in Redis
          await dbManager.query('redis-cache', {
            text: 'SETEX',
            values: [cacheKey, 60, JSON.stringify(result)],
          });

          return {
            statusCode: 200,
            headers: { 'X-Cache': 'MISS' },
            body: result,
          };
        },
        middleware: [],
        tags: ['cached'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/cached-data',
        headers: {},
        query: { param: 'value' },
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      // First request (cache miss)
      const response1 = await gateway.handleRequest(request);
      expect(response1.headers['X-Cache']).toBe('MISS');
      expect(response1.body.computeCount).toBe(1);

      // Second request (cache hit)
      const response2 = await gateway.handleRequest(request);
      expect(response2.headers['X-Cache']).toBe('HIT');
      expect(response2.body.computeCount).toBe(1); // Same as before

      expect(computeCount).toBe(1); // Only computed once
    });
  });

  describe('Multi-Database Operations', () => {
    let pgContainer: PostgreSQLContainer;
    let redisContainer: RedisContainer;

    beforeEach(async () => {
      if (!dockerAvailable) {
        return;
      }

      pgContainer = new PostgreSQLContainer('test-pg-multi', 25432);
      redisContainer = new RedisContainer('test-redis-multi', 26379);

      await Promise.all([pgContainer.start(), redisContainer.start()]);
    });

    afterEach(async () => {
      if (pgContainer && redisContainer) {
        await Promise.all([pgContainer.stop(), redisContainer.stop()]);
      }
    });

    it('should coordinate operations across PostgreSQL and Redis', async () => {
      if (!dockerAvailable) {
        console.log('Skipping - Docker not available');
        return;
      }

      const pgConfig = pgContainer.getConnectionConfig();
      const redisConfig = redisContainer.getConnectionConfig();

      // Add PostgreSQL
      await dbManager.addDatabase({
        id: 'pg-multi',
        type: 'postgresql' as DatabaseType,
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        username: pgConfig.username,
        password: pgConfig.password,
      });

      // Add Redis
      await dbManager.addDatabase({
        id: 'redis-multi',
        type: 'redis' as DatabaseType,
        host: redisConfig.host,
        port: redisConfig.port,
        database: '0',
        username: '',
        password: '',
      });

      // Create table in PostgreSQL
      await dbManager.query('pg-multi', {
        text: 'CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INT, created_at TIMESTAMP)',
        values: [],
      });

      // Register endpoint that uses both databases
      gateway.registerEndpoint({
        path: '/api/session',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { userId } = request.body;
          const sessionId = `session_${Date.now()}_${Math.random()}`;

          // Store session in PostgreSQL
          await dbManager.query('pg-multi', {
            text: 'INSERT INTO sessions (id, user_id, created_at) VALUES ($1, $2, NOW())',
            values: [sessionId, userId],
          });

          // Store session token in Redis with TTL
          await dbManager.query('redis-multi', {
            text: 'SETEX',
            values: [`session:${sessionId}`, 3600, userId.toString()],
          });

          return {
            statusCode: 201,
            headers: {},
            body: { sessionId },
          };
        },
        middleware: [],
        tags: ['session'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/session',
        headers: {},
        query: {},
        params: {},
        body: { userId: 123 },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.sessionId).toBeDefined();

      // Verify in PostgreSQL
      const pgResult = await dbManager.query('pg-multi', {
        text: 'SELECT * FROM sessions WHERE id = $1',
        values: [response.body.sessionId],
      });

      expect(pgResult.rowCount).toBe(1);
      expect(pgResult.rows[0].user_id).toBe(123);

      // Verify in Redis
      const redisResult = await dbManager.query('redis-multi', {
        text: 'GET',
        values: [`session:${response.body.sessionId}`],
      });

      expect(redisResult.rows[0]).toBe('123');
    });
  });
});
