/**
 * Multi-Module Integration Tests
 * Tests complex interactions between API, Database, Security, and Event systems
 */

import { APIGateway, APIRequest, HTTPMethod } from '../../../src/api/APIGateway';
import { DatabasePoolManager, DatabaseConfig, DatabaseType } from '../../../src/database/DatabasePoolManager';
import {
  AuthenticationSystem,
  RBACSystem,
  AuditLogger,
} from '../../../src/security/MEGA_SecurityAuthentication';
import { eventBus } from '../../../src/core/EventBus';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Multi-Module Integration Tests', () => {
  let gateway: APIGateway;
  let dbManager: DatabasePoolManager;
  let authSystem: AuthenticationSystem;
  let rbacSystem: RBACSystem;
  let auditLogger: AuditLogger;
  let testDbPath: string;

  beforeAll(() => {
    testDbPath = join(tmpdir(), `multi-module-test-${Date.now()}`);
    try {
      mkdirSync(testDbPath, { recursive: true });
    } catch (error) {
      // Directory might exist
    }
  });

  afterAll(() => {
    try {
      rmSync(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    authSystem = new AuthenticationSystem();
    rbacSystem = new RBACSystem();
    auditLogger = new AuditLogger();
    gateway = new APIGateway(authSystem, rbacSystem, auditLogger, {
      enableErrorHandling: true,
    });
    dbManager = new DatabasePoolManager();
  });

  afterEach(async () => {
    await dbManager.closeAll();
    eventBus.removeAllListeners();
  });

  describe('Complete User Management Flow', () => {
    it('should handle user registration, authentication, and data persistence', async () => {
      const dbPath = join(testDbPath, 'user-mgmt.db');

      const dbConfig: DatabaseConfig = {
        id: 'user-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      // Create users table
      await dbManager.query('user-db', {
        text: 'CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, username TEXT, email TEXT, created_at INTEGER)',
        values: [],
      });

      // Register user via auth system
      const user = await authSystem.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      // Assign role via RBAC
      rbacSystem.assignRole(user.id, 'user');

      // Store user profile in database
      await dbManager.query('user-db', {
        text: 'INSERT INTO user_profiles (user_id, username, email, created_at) VALUES (?, ?, ?, ?)',
        values: [user.id, user.username, user.email, Date.now()],
      });

      // Login and get token
      const session = await authSystem.login('testuser', 'SecurePass123!');

      // Register API endpoint to fetch profile
      gateway.registerEndpoint({
        path: '/api/profile',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const authUser = (request as any).user;

          const result = await dbManager.query('user-db', {
            text: 'SELECT * FROM user_profiles WHERE user_id = ?',
            values: [authUser.id],
          });

          if (result.rowCount === 0) {
            return {
              statusCode: 404,
              headers: {},
              body: { error: 'Profile not found' },
            };
          }

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
              profile: result.rows[0],
            },
          };
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        tags: ['profile'],
      });

      // Make authenticated request
      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/profile',
        headers: { authorization: `Bearer ${session.token}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
        userAgent: 'test-client',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.profile.username).toBe('testuser');
      expect(response.body.profile.email).toBe('test@example.com');

      // Verify audit logs
      const logs = auditLogger.getRecentLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.action === 'login')).toBe(true);
      expect(logs.some(log => log.action === 'access')).toBe(true);
    });
  });

  describe('Event-Driven Architecture', () => {
    it('should propagate events across modules', async () => {
      const events: any[] = [];

      // Listen to various events
      eventBus.on('api.request_received', (data) => {
        events.push({ type: 'api.request_received', data });
      });

      eventBus.on('api.request_completed', (data) => {
        events.push({ type: 'api.request_completed', data });
      });

      eventBus.on('api.endpoint_registered', (data) => {
        events.push({ type: 'api.endpoint_registered', data });
      });

      // Register endpoint (should emit event)
      gateway.registerEndpoint({
        path: '/api/events-test',
        method: HTTPMethod.GET,
        handler: async () => ({
          statusCode: 200,
          headers: {},
          body: { message: 'Event test' },
        }),
        middleware: [],
        tags: ['events'],
      });

      // Make request (should emit events)
      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/events-test',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      await gateway.handleRequest(request);

      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events.some(e => e.type === 'api.endpoint_registered')).toBe(true);
      expect(events.some(e => e.type === 'api.request_received')).toBe(true);
      expect(events.some(e => e.type === 'api.request_completed')).toBe(true);
    });

    it('should handle cross-module event communication', async () => {
      const dbPath = join(testDbPath, 'events.db');

      const dbConfig: DatabaseConfig = {
        id: 'events-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      await dbManager.query('events-db', {
        text: 'CREATE TABLE IF NOT EXISTS event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, data TEXT, timestamp INTEGER)',
        values: [],
      });

      // Set up event handler that writes to database
      eventBus.on('api.request_completed', async (data) => {
        await dbManager.query('events-db', {
          text: 'INSERT INTO event_log (event_type, data, timestamp) VALUES (?, ?, ?)',
          values: ['api.request_completed', JSON.stringify(data), Date.now()],
        });
      });

      gateway.registerEndpoint({
        path: '/api/trigger-event',
        method: HTTPMethod.POST,
        handler: async (request) => ({
          statusCode: 200,
          headers: {},
          body: { success: true },
        }),
        middleware: [],
        tags: ['events'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/trigger-event',
        headers: {},
        query: {},
        params: {},
        body: { test: 'data' },
        ip: '192.168.1.1',
      };

      await gateway.handleRequest(request);

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event was logged to database
      const logs = await dbManager.query('events-db', {
        text: 'SELECT * FROM event_log WHERE event_type = ?',
        values: ['api.request_completed'],
      });

      expect(logs.rowCount).toBeGreaterThan(0);
    });
  });

  describe('Complex Transaction Scenarios', () => {
    it('should handle multi-table transactions with API operations', async () => {
      const dbPath = join(testDbPath, 'transactions.db');

      const dbConfig: DatabaseConfig = {
        id: 'tx-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      // Create tables
      await dbManager.query('tx-db', {
        text: 'CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance INTEGER)',
        values: [],
      });

      await dbManager.query('tx-db', {
        text: 'CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, from_account INTEGER, to_account INTEGER, amount INTEGER, timestamp INTEGER)',
        values: [],
      });

      // Create test accounts
      await dbManager.query('tx-db', {
        text: 'INSERT INTO accounts (id, name, balance) VALUES (1, "Alice", 1000), (2, "Bob", 500)',
        values: [],
      });

      // Register transfer endpoint
      gateway.registerEndpoint({
        path: '/api/transfer',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { from, to, amount } = request.body;

          try {
            await dbManager.transaction('tx-db', async (client) => {
              // Check balance
              const fromAccount = await client.query({
                text: 'SELECT balance FROM accounts WHERE id = ?',
                values: [from],
              });

              if (fromAccount.rows[0].balance < amount) {
                throw new Error('Insufficient funds');
              }

              // Deduct from sender
              await client.query({
                text: 'UPDATE accounts SET balance = balance - ? WHERE id = ?',
                values: [amount, from],
              });

              // Add to receiver
              await client.query({
                text: 'UPDATE accounts SET balance = balance + ? WHERE id = ?',
                values: [amount, to],
              });

              // Log transaction
              await client.query({
                text: 'INSERT INTO transactions (from_account, to_account, amount, timestamp) VALUES (?, ?, ?, ?)',
                values: [from, to, amount, Date.now()],
              });
            });

            return {
              statusCode: 200,
              headers: {},
              body: { success: true, message: 'Transfer completed' },
            };
          } catch (error) {
            return {
              statusCode: 400,
              headers: {},
              body: { error: error instanceof Error ? error.message : 'Transfer failed' },
            };
          }
        },
        middleware: [],
        validation: {
          body: {
            type: 'object',
            properties: {
              from: { type: 'number' },
              to: { type: 'number' },
              amount: { type: 'number', minimum: 1 },
            },
            required: ['from', 'to', 'amount'],
          },
        },
        tags: ['transfer'],
      });

      // Successful transfer
      const request1: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/transfer',
        headers: {},
        query: {},
        params: {},
        body: { from: 1, to: 2, amount: 200 },
        ip: '192.168.1.1',
      };

      const response1 = await gateway.handleRequest(request1);
      expect(response1.statusCode).toBe(200);

      // Verify balances
      const balances = await dbManager.query('tx-db', {
        text: 'SELECT * FROM accounts ORDER BY id',
        values: [],
      });

      expect(balances.rows[0].balance).toBe(800); // Alice: 1000 - 200
      expect(balances.rows[1].balance).toBe(700); // Bob: 500 + 200

      // Failed transfer (insufficient funds)
      const request2: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/transfer',
        headers: {},
        query: {},
        params: {},
        body: { from: 1, to: 2, amount: 1000 },
        ip: '192.168.1.1',
      };

      const response2 = await gateway.handleRequest(request2);
      expect(response2.statusCode).toBe(400);
      expect(response2.body.error).toBe('Insufficient funds');

      // Verify balances unchanged
      const balances2 = await dbManager.query('tx-db', {
        text: 'SELECT * FROM accounts ORDER BY id',
        values: [],
      });

      expect(balances2.rows[0].balance).toBe(800); // Unchanged
      expect(balances2.rows[1].balance).toBe(700); // Unchanged
    });
  });

  describe('Permission-Based Data Access', () => {
    it('should enforce row-level security through RBAC', async () => {
      const dbPath = join(testDbPath, 'rbac.db');

      const dbConfig: DatabaseConfig = {
        id: 'rbac-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      await dbManager.query('rbac-db', {
        text: 'CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, owner_id TEXT, is_public INTEGER)',
        values: [],
      });

      // Create users
      const user1 = await authSystem.register({
        username: 'user1',
        email: 'user1@example.com',
        password: 'Pass123!',
      });

      const user2 = await authSystem.register({
        username: 'user2',
        email: 'user2@example.com',
        password: 'Pass123!',
      });

      rbacSystem.assignRole(user1.id, 'user');
      rbacSystem.assignRole(user2.id, 'user');

      // Insert test documents
      await dbManager.query('rbac-db', {
        text: 'INSERT INTO documents (title, content, owner_id, is_public) VALUES (?, ?, ?, ?)',
        values: ['User1 Private', 'Private content', user1.id, 0],
      });

      await dbManager.query('rbac-db', {
        text: 'INSERT INTO documents (title, content, owner_id, is_public) VALUES (?, ?, ?, ?)',
        values: ['User1 Public', 'Public content', user1.id, 1],
      });

      await dbManager.query('rbac-db', {
        text: 'INSERT INTO documents (title, content, owner_id, is_public) VALUES (?, ?, ?, ?)',
        values: ['User2 Private', 'Private content', user2.id, 0],
      });

      // Register endpoint with row-level security
      gateway.registerEndpoint({
        path: '/api/documents',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const authUser = (request as any).user;

          // Only return documents that user owns or are public
          const result = await dbManager.query('rbac-db', {
            text: 'SELECT * FROM documents WHERE owner_id = ? OR is_public = 1',
            values: [authUser.id],
          });

          return {
            statusCode: 200,
            headers: {},
            body: { documents: result.rows },
          };
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        authorization: { roles: ['user'] },
        tags: ['documents'],
      });

      // Login as user1
      const session1 = await authSystem.login('user1', 'Pass123!');

      const request1: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/documents',
        headers: { authorization: `Bearer ${session1.token}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response1 = await gateway.handleRequest(request1);

      expect(response1.statusCode).toBe(200);
      expect(response1.body.documents).toHaveLength(2); // User1's private + User1's public
      expect(response1.body.documents.every((d: any) => d.owner_id === user1.id)).toBe(true);

      // Login as user2
      const session2 = await authSystem.login('user2', 'Pass123!');

      const request2: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/documents',
        headers: { authorization: `Bearer ${session2.token}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response2 = await gateway.handleRequest(request2);

      expect(response2.statusCode).toBe(200);
      expect(response2.body.documents).toHaveLength(2); // User2's private + User1's public
      expect(
        response2.body.documents.some((d: any) => d.owner_id === user2.id && !d.is_public)
      ).toBe(true);
      expect(
        response2.body.documents.some((d: any) => d.owner_id === user1.id && d.is_public)
      ).toBe(true);
    });
  });

  describe('Error Recovery Across Modules', () => {
    it('should recover from database failures without affecting auth', async () => {
      const dbPath = join(testDbPath, 'error-recovery.db');

      const dbConfig: DatabaseConfig = {
        id: 'error-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
      };

      await dbManager.addDatabase(dbConfig);

      const user = await authSystem.register({
        username: 'erroruser',
        email: 'error@example.com',
        password: 'Pass123!',
      });

      const session = await authSystem.login('erroruser', 'Pass123!');

      gateway.registerEndpoint({
        path: '/api/error-recovery',
        method: HTTPMethod.GET,
        handler: async (request) => {
          // Try database operation that might fail
          try {
            await dbManager.query('error-db', {
              text: 'SELECT * FROM non_existent_table',
              values: [],
            });
          } catch (dbError) {
            // Database failed, but auth still works
            const authUser = (request as any).user;

            return {
              statusCode: 200,
              headers: {},
              body: {
                message: 'Database failed but recovered',
                authenticated: true,
                userId: authUser.id,
              },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: { success: true },
          };
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        tags: ['error-recovery'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/error-recovery',
        headers: { authorization: `Bearer ${session.token}` },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.userId).toBe(user.id);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high concurrent load across all modules', async () => {
      const dbPath = join(testDbPath, 'performance.db');

      const dbConfig: DatabaseConfig = {
        id: 'perf-db',
        type: 'sqlite' as DatabaseType,
        host: dbPath,
        port: 0,
        database: dbPath,
        username: '',
        password: '',
        poolConfig: {
          min: 5,
          max: 20,
        },
      };

      await dbManager.addDatabase(dbConfig);

      await dbManager.query('perf-db', {
        text: 'CREATE TABLE IF NOT EXISTS metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT, timestamp INTEGER)',
        values: [],
      });

      const user = await authSystem.register({
        username: 'perfuser',
        email: 'perf@example.com',
        password: 'Pass123!',
      });

      const session = await authSystem.login('perfuser', 'Pass123!');

      gateway.registerEndpoint({
        path: '/api/performance',
        method: HTTPMethod.POST,
        handler: async (request, context) => {
          await dbManager.query('perf-db', {
            text: 'INSERT INTO metrics (request_id, timestamp) VALUES (?, ?)',
            values: [context.requestId, Date.now()],
          });

          return {
            statusCode: 200,
            headers: {},
            body: { requestId: context.requestId },
          };
        },
        middleware: [],
        authentication: { type: 'bearer', required: true },
        tags: ['performance'],
      });

      const startTime = Date.now();

      // 100 concurrent requests
      const requests = Array.from({ length: 100 }, () => {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/performance',
          headers: { authorization: `Bearer ${session.token}` },
          query: {},
          params: {},
          body: {},
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      });

      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      expect(responses.every(r => r.statusCode === 200)).toBe(true);

      // Should complete in reasonable time (< 5 seconds for 100 requests)
      expect(duration).toBeLessThan(5000);

      // Verify all metrics were recorded
      const metrics = await dbManager.query('perf-db', {
        text: 'SELECT COUNT(*) as count FROM metrics',
        values: [],
      });

      expect(metrics.rows[0].count).toBe(100);

      // Check metrics
      const apiMetrics = gateway.getMetrics({ endpoint: '/api/performance' });
      expect(apiMetrics.length).toBeGreaterThan(0);
      expect(apiMetrics[0].requestCount).toBe(100);
    });
  });
});
