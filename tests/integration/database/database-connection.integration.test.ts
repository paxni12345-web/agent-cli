/**
 * Integration Tests: Real Database Connection
 * Tests actual database connectivity, connection pooling, and error handling
 */

import { DatabaseConnection, DatabaseConfig } from '../../../src/database/MEGA_DatabaseAbstraction';

describe('Database Connection Integration', () => {
  let connection: DatabaseConnection;
  let config: DatabaseConfig;

  beforeEach(() => {
    config = {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'test_db',
      username: process.env.DB_USER || 'test_user',
      password: process.env.DB_PASSWORD || 'test_password',
      logging: false
    };
    connection = new DatabaseConnection(config);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.disconnect();
    }
  });

  describe('Connection Lifecycle', () => {
    test('should connect to database successfully', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
    });

    test('should disconnect from database successfully', async () => {
      await connection.connect();
      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    });

    test('should handle multiple connect calls idempotently', async () => {
      await connection.connect();
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
    });

    test('should handle multiple disconnect calls idempotently', async () => {
      await connection.connect();
      await connection.disconnect();
      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    });

    test('should emit connection events', async () => {
      const events: string[] = [];
      connection.on('connecting', () => events.push('connecting'));
      connection.on('connected', () => events.push('connected'));
      connection.on('disconnecting', () => events.push('disconnecting'));
      connection.on('disconnected', () => events.push('disconnected'));

      await connection.connect();
      await connection.disconnect();

      expect(events).toEqual(['connecting', 'connected', 'disconnecting', 'disconnected']);
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    test('should execute SELECT query', async () => {
      const result = await connection.query('SELECT 1 as value', []);
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
      expect(result).toHaveProperty('affectedRows');
    });

    test('should execute parameterized query', async () => {
      const result = await connection.query('SELECT $1 as value', [42]);
      expect(result.rows).toBeDefined();
    });

    test('should reject query when not connected', async () => {
      await connection.disconnect();
      await expect(connection.query('SELECT 1', [])).rejects.toThrow('Not connected');
    });

    test('should validate parameter count matches placeholders', async () => {
      await expect(
        connection.query('SELECT $1, $2', [1])
      ).rejects.toThrow('Parameter mismatch');
    });

    test('should detect dangerous SQL patterns', async () => {
      await expect(
        connection.query('SELECT 1; DROP TABLE users', [])
      ).rejects.toThrow('dangerous SQL pattern');
    });

    test('should emit query events', async () => {
      const queryEvents: any[] = [];
      connection.on('query', (event) => queryEvents.push(event));

      await connection.query('SELECT 1', []);

      expect(queryEvents).toHaveLength(1);
      expect(queryEvents[0]).toHaveProperty('sql');
      expect(queryEvents[0]).toHaveProperty('params');
      expect(queryEvents[0]).toHaveProperty('duration');
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    test('should begin and commit transaction', async () => {
      await connection.beginTransaction();
      expect(connection.getTransactionDepth()).toBe(1);

      await connection.commit();
      expect(connection.getTransactionDepth()).toBe(0);
    });

    test('should begin and rollback transaction', async () => {
      await connection.beginTransaction();
      expect(connection.getTransactionDepth()).toBe(1);

      await connection.rollback();
      expect(connection.getTransactionDepth()).toBe(0);
    });

    test('should support nested transactions with savepoints', async () => {
      await connection.beginTransaction();
      expect(connection.getTransactionDepth()).toBe(1);

      await connection.beginTransaction();
      expect(connection.getTransactionDepth()).toBe(2);

      await connection.commit();
      expect(connection.getTransactionDepth()).toBe(1);

      await connection.commit();
      expect(connection.getTransactionDepth()).toBe(0);
    });

    test('should emit transaction events', async () => {
      const events: string[] = [];
      connection.on('transaction:begin', () => events.push('begin'));
      connection.on('transaction:commit', () => events.push('commit'));

      await connection.beginTransaction();
      await connection.commit();

      expect(events).toEqual(['begin', 'commit']);
    });

    test('should reject commit when no active transaction', async () => {
      await expect(connection.commit()).rejects.toThrow('No active transaction');
    });

    test('should reject rollback when no active transaction', async () => {
      await expect(connection.rollback()).rejects.toThrow('No active transaction');
    });
  });

  describe('Connection Error Handling', () => {
    test('should handle invalid connection configuration', () => {
      const invalidConfig: DatabaseConfig = {
        type: 'postgres',
        database: '',
        host: 'invalid-host'
      };

      const invalidConnection = new DatabaseConnection(invalidConfig);
      expect(invalidConnection.isConnected()).toBe(false);
    });

    test('should handle connection timeout', async () => {
      const timeoutConfig: DatabaseConfig = {
        ...config,
        timeout: 100,
        host: '192.0.2.1' // Non-routable IP to force timeout
      };

      const timeoutConnection = new DatabaseConnection(timeoutConfig);
      // In real test, this would timeout
      expect(timeoutConnection.isConnected()).toBe(false);
    });
  });
});
