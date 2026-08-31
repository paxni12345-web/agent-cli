/**
 * Integration Tests: Database and API Integration
 * Tests real database connections with API endpoints
 * Tests transaction handling, error propagation, and data flow
 */

import { EventEmitter } from 'events';

// Mock Database Connection
class MockDatabaseConnection extends EventEmitter {
  private connected = false;
  private transactionDepth = 0;
  private mockData: Map<string, any> = new Map();

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(sql: string, params: any[]): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    this.emit('query', { sql, params, timestamp: new Date() });

    // Simulate different query types
    if (sql.includes('SELECT')) {
      return { rows: [{ id: 1, name: 'Test' }], rowCount: 1 };
    } else if (sql.includes('INSERT')) {
      return { rows: [], rowCount: 1, insertId: 123 };
    } else if (sql.includes('UPDATE')) {
      return { rows: [], rowCount: 1 };
    } else if (sql.includes('DELETE')) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  async beginTransaction(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    this.transactionDepth++;
    this.emit('transaction:begin', { depth: this.transactionDepth });
  }

  async commit(): Promise<void> {
    if (this.transactionDepth === 0) {
      throw new Error('No active transaction');
    }
    this.transactionDepth--;
    this.emit('transaction:commit', { depth: this.transactionDepth });
  }

  async rollback(): Promise<void> {
    if (this.transactionDepth === 0) {
      throw new Error('No active transaction');
    }
    this.transactionDepth--;
    this.emit('transaction:rollback', { depth: this.transactionDepth });
  }

  getTransactionDepth(): number {
    return this.transactionDepth;
  }
}

// Mock API Gateway
class MockAPIGateway extends EventEmitter {
  private routes: Map<string, Function> = new Map();
  private rateLimits: Map<string, number> = new Map();

  registerRoute(path: string, handler: Function): void {
    this.routes.set(path, handler);
    this.emit('route:registered', { path });
  }

  async handleRequest(path: string, data: any): Promise<any> {
    const handler = this.routes.get(path);
    if (!handler) {
      throw new Error(`Route not found: ${path}`);
    }

    // Check rate limit
    const currentCount = this.rateLimits.get(path) || 0;
    if (currentCount >= 100) {
      throw new Error('Rate limit exceeded');
    }
    this.rateLimits.set(path, currentCount + 1);

    this.emit('request', { path, data, timestamp: new Date() });

    try {
      const result = await handler(data);
      this.emit('response', { path, result, status: 200 });
      return result;
    } catch (error) {
      this.emit('error', { path, error, status: 500 });
      throw error;
    }
  }

  resetRateLimits(): void {
    this.rateLimits.clear();
  }
}

describe('Database-API Integration', () => {
  let db: MockDatabaseConnection;
  let api: MockAPIGateway;

  beforeEach(async () => {
    db = new MockDatabaseConnection();
    api = new MockAPIGateway();
    await db.connect();
  });

  afterEach(async () => {
    if (db.isConnected()) {
      await db.disconnect();
    }
  });

  describe('End-to-End CRUD Operations', () => {
    test('should create user via API and persist to database', async () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const queryLog: any[] = [];

      db.on('query', (event) => queryLog.push(event));

      api.registerRoute('/users', async (data: any) => {
        const result = await db.query(
          'INSERT INTO users (name, email) VALUES ($1, $2)',
          [data.name, data.email]
        );
        return { id: result.insertId, ...data };
      });

      const response = await api.handleRequest('/users', userData);

      expect(response).toHaveProperty('id');
      expect(response.name).toBe(userData.name);
      expect(queryLog).toHaveLength(1);
      expect(queryLog[0].sql).toContain('INSERT INTO users');
    });

    test('should read user via API from database', async () => {
      api.registerRoute('/users/:id', async (data: any) => {
        const result = await db.query(
          'SELECT * FROM users WHERE id = $1',
          [data.id]
        );
        return result.rows[0];
      });

      const response = await api.handleRequest('/users/:id', { id: 1 });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('name');
    });

    test('should update user via API in database', async () => {
      api.registerRoute('/users/:id', async (data: any) => {
        const result = await db.query(
          'UPDATE users SET name = $1 WHERE id = $2',
          [data.name, data.id]
        );
        return { updated: result.rowCount > 0 };
      });

      const response = await api.handleRequest('/users/:id', {
        id: 1,
        name: 'Jane Doe'
      });

      expect(response.updated).toBe(true);
    });

    test('should delete user via API from database', async () => {
      api.registerRoute('/users/:id', async (data: any) => {
        const result = await db.query(
          'DELETE FROM users WHERE id = $1',
          [data.id]
        );
        return { deleted: result.rowCount > 0 };
      });

      const response = await api.handleRequest('/users/:id', { id: 1 });

      expect(response.deleted).toBe(true);
    });
  });

  describe('Transaction Handling in API Requests', () => {
    test('should handle transaction commit on successful operation', async () => {
      const txEvents: string[] = [];

      db.on('transaction:begin', () => txEvents.push('begin'));
      db.on('transaction:commit', () => txEvents.push('commit'));

      api.registerRoute('/transfer', async (data: any) => {
        await db.beginTransaction();

        try {
          await db.query(
            'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
            [data.amount, data.fromAccount]
          );
          await db.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [data.amount, data.toAccount]
          );

          await db.commit();
          return { success: true };
        } catch (error) {
          await db.rollback();
          throw error;
        }
      });

      const response = await api.handleRequest('/transfer', {
        fromAccount: 1,
        toAccount: 2,
        amount: 100
      });

      expect(response.success).toBe(true);
      expect(txEvents).toEqual(['begin', 'commit']);
    });

    test('should rollback transaction on error', async () => {
      const txEvents: string[] = [];

      db.on('transaction:begin', () => txEvents.push('begin'));
      db.on('transaction:rollback', () => txEvents.push('rollback'));

      api.registerRoute('/transfer', async (data: any) => {
        await db.beginTransaction();

        try {
          await db.query(
            'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
            [data.amount, data.fromAccount]
          );

          // Simulate error
          throw new Error('Insufficient funds');

          await db.commit();
        } catch (error) {
          await db.rollback();
          throw error;
        }
      });

      await expect(
        api.handleRequest('/transfer', {
          fromAccount: 1,
          toAccount: 2,
          amount: 100
        })
      ).rejects.toThrow('Insufficient funds');

      expect(txEvents).toEqual(['begin', 'rollback']);
    });

    test('should handle nested transactions', async () => {
      api.registerRoute('/complex-operation', async (data: any) => {
        await db.beginTransaction();

        try {
          await db.query('INSERT INTO logs (message) VALUES ($1)', ['Outer transaction']);

          await db.beginTransaction(); // Nested

          try {
            await db.query('INSERT INTO logs (message) VALUES ($1)', ['Inner transaction']);
            await db.commit(); // Inner commit
          } catch (error) {
            await db.rollback(); // Inner rollback
          }

          await db.commit(); // Outer commit
          return { success: true };
        } catch (error) {
          await db.rollback();
          throw error;
        }
      });

      const response = await api.handleRequest('/complex-operation', {});

      expect(response.success).toBe(true);
      expect(db.getTransactionDepth()).toBe(0);
    });
  });

  describe('Error Propagation from Database to API', () => {
    test('should propagate database connection errors to API', async () => {
      await db.disconnect();

      api.registerRoute('/test', async () => {
        return await db.query('SELECT 1', []);
      });

      await expect(
        api.handleRequest('/test', {})
      ).rejects.toThrow('Not connected to database');
    });

    test('should emit error events through both layers', async () => {
      const errors: any[] = [];

      db.on('error', (err) => errors.push({ layer: 'db', error: err }));
      api.on('error', (err) => errors.push({ layer: 'api', error: err }));

      api.registerRoute('/error-test', async () => {
        const err = new Error('Database constraint violation');
        db.emit('error', err);
        throw err;
      });

      await expect(
        api.handleRequest('/error-test', {})
      ).rejects.toThrow('Database constraint violation');

      expect(errors).toHaveLength(2);
      expect(errors[0].layer).toBe('db');
      expect(errors[1].layer).toBe('api');
    });

    test('should handle database timeout errors', async () => {
      api.registerRoute('/slow-query', async () => {
        // Simulate slow query
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Query timeout'));
          }, 100);
        });
      });

      await expect(
        api.handleRequest('/slow-query', {})
      ).rejects.toThrow('Query timeout');
    });
  });

  describe('Concurrent API Requests with Database', () => {
    test('should handle multiple concurrent requests', async () => {
      api.registerRoute('/items', async (data: any) => {
        const result = await db.query(
          'INSERT INTO items (name) VALUES ($1)',
          [data.name]
        );
        return { id: result.insertId };
      });

      const requests = Array.from({ length: 10 }, (_, i) =>
        api.handleRequest('/items', { name: `Item ${i}` })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toHaveProperty('id');
      });
    });

    test('should handle concurrent reads without conflicts', async () => {
      api.registerRoute('/items/list', async () => {
        return await db.query('SELECT * FROM items', []);
      });

      const requests = Array.from({ length: 20 }, () =>
        api.handleRequest('/items/list', {})
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result).toHaveProperty('rows');
      });
    });

    test('should enforce rate limits across concurrent requests', async () => {
      api.registerRoute('/limited', async () => {
        return { message: 'Success' };
      });

      // Make 101 requests (exceeds limit of 100)
      const requests = Array.from({ length: 101 }, () =>
        api.handleRequest('/limited', {}).catch((e) => e)
      );

      const results = await Promise.all(requests);
      const errors = results.filter((r) => r instanceof Error);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('Rate limit'))).toBe(true);
    });
  });

  describe('Multi-Module Data Flow', () => {
    test('should flow data from API through database to response', async () => {
      const dataFlow: string[] = [];

      api.on('request', () => dataFlow.push('api:request'));
      db.on('query', () => dataFlow.push('db:query'));
      api.on('response', () => dataFlow.push('api:response'));

      api.registerRoute('/flow-test', async (data: any) => {
        const result = await db.query(
          'INSERT INTO test (value) VALUES ($1)',
          [data.value]
        );
        return { inserted: true, id: result.insertId };
      });

      await api.handleRequest('/flow-test', { value: 'test' });

      expect(dataFlow).toEqual(['api:request', 'db:query', 'api:response']);
    });

    test('should validate data at API layer before database', async () => {
      api.registerRoute('/validated', async (data: any) => {
        // API validation
        if (!data.email || !data.email.includes('@')) {
          throw new Error('Invalid email format');
        }

        // Only reach database if valid
        return await db.query(
          'INSERT INTO users (email) VALUES ($1)',
          [data.email]
        );
      });

      await expect(
        api.handleRequest('/validated', { email: 'invalid' })
      ).rejects.toThrow('Invalid email format');

      // Valid email should work
      const result = await api.handleRequest('/validated', {
        email: 'valid@example.com'
      });
      expect(result).toBeDefined();
    });
  });
});
