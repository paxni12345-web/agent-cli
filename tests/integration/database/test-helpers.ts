/**
 * Integration Tests: Test Utilities and Helpers
 * Shared utilities for database integration tests
 */

import { DatabaseConfig } from '../../../src/database/DatabasePoolManager';

/**
 * Get test database configuration from environment
 */
export function getTestDatabaseConfig(id: string = 'test-db'): DatabaseConfig {
  return {
    id,
    type: 'postgresql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'test_db',
    username: process.env.DB_USER || 'test_user',
    password: process.env.DB_PASSWORD || 'test_password',
    ssl: process.env.DB_SSL === 'true',
    poolConfig: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10')
    }
  };
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Retry an operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 100
): Promise<T> {
  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Generate random test data
 */
export class TestDataGenerator {
  static randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static randomEmail(): string {
    return `test_${this.randomString(8)}@example.com`;
  }

  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static randomBoolean(): boolean {
    return Math.random() > 0.5;
  }

  static randomDate(startYear: number = 2020, endYear: number = 2024): Date {
    const start = new Date(startYear, 0, 1);
    const end = new Date(endYear, 11, 31);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  static randomDecimal(min: number, max: number, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return parseFloat(value.toFixed(decimals));
  }
}

/**
 * Database test helper for common operations
 */
export class DatabaseTestHelper {
  /**
   * Create a unique table name for test isolation
   */
  static uniqueTableName(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Clean up test tables
   */
  static async cleanupTestTables(
    connection: any,
    tablePrefix: string
  ): Promise<void> {
    try {
      const query = `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE $1
      `;
      const result = await connection.query(query, [`${tablePrefix}%`]);

      for (const row of result.rows) {
        await connection.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`, []);
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  /**
   * Check if table exists
   */
  static async tableExists(
    connection: any,
    tableName: string
  ): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename = $1
        )
      `;
      const result = await connection.query(query, [tableName]);
      return result.rows[0].exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get table row count
   */
  static async getTableRowCount(
    connection: any,
    tableName: string
  ): Promise<number> {
    try {
      const result = await connection.query(
        `SELECT COUNT(*) as count FROM ${tableName}`,
        []
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Truncate table
   */
  static async truncateTable(
    connection: any,
    tableName: string,
    cascade: boolean = false
  ): Promise<void> {
    const cascadeClause = cascade ? 'CASCADE' : '';
    await connection.query(`TRUNCATE TABLE ${tableName} ${cascadeClause}`, []);
  }
}

/**
 * Performance measurement utility
 */
export class PerformanceMonitor {
  private startTime: number = 0;
  private measurements: Map<string, number[]> = new Map();

  start(): void {
    this.startTime = Date.now();
  }

  end(label: string): number {
    const duration = Date.now() - this.startTime;

    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }

    this.measurements.get(label)!.push(duration);
    return duration;
  }

  getStats(label: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  } | null {
    const values = this.measurements.get(label);

    if (!values || values.length === 0) {
      return null;
    }

    const total = values.reduce((sum, v) => sum + v, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      count: values.length,
      total,
      average,
      min,
      max
    };
  }

  reset(): void {
    this.measurements.clear();
  }

  getAllStats(): Record<string, ReturnType<PerformanceMonitor['getStats']>> {
    const result: Record<string, any> = {};

    for (const [label] of this.measurements) {
      result[label] = this.getStats(label);
    }

    return result;
  }
}

/**
 * Connection pool monitor
 */
export class PoolMonitor {
  private snapshots: Array<{
    timestamp: number;
    total: number;
    active: number;
    idle: number;
    waiting: number;
  }> = [];

  takeSnapshot(stats: any): void {
    this.snapshots.push({
      timestamp: Date.now(),
      total: stats.totalConnections,
      active: stats.activeConnections,
      idle: stats.idleConnections,
      waiting: stats.waitingRequests
    });
  }

  getUtilization(): {
    average: number;
    peak: number;
    idle: number;
  } {
    if (this.snapshots.length === 0) {
      return { average: 0, peak: 0, idle: 0 };
    }

    const utilizations = this.snapshots.map(s =>
      s.total > 0 ? s.active / s.total : 0
    );

    const average = utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length;
    const peak = Math.max(...utilizations);
    const avgIdle = this.snapshots.reduce((sum, s) => sum + s.idle, 0) / this.snapshots.length;

    return {
      average: Math.round(average * 100),
      peak: Math.round(peak * 100),
      idle: Math.round(avgIdle)
    };
  }

  reset(): void {
    this.snapshots = [];
  }
}

/**
 * Concurrent operation tester
 */
export class ConcurrentTester {
  static async runConcurrent<T>(
    operations: Array<() => Promise<T>>,
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
    } = {}
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const { batchSize = operations.length, delayBetweenBatches = 0 } = options;
    const results: Array<{ success: boolean; result?: T; error?: Error }> = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(op => op())
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push({ success: true, result: result.value });
        } else {
          results.push({ success: false, error: result.reason });
        }
      }

      if (i + batchSize < operations.length && delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  static analyzeResults<T>(
    results: Array<{ success: boolean; result?: T; error?: Error }>
  ): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    errors: Error[];
  } {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const successRate = (successful / total) * 100;
    const errors = results.filter(r => r.error).map(r => r.error!);

    return {
      total,
      successful,
      failed,
      successRate,
      errors
    };
  }
}

/**
 * Test fixtures for common test data
 */
export const TestFixtures = {
  users: [
    { username: 'alice', email: 'alice@example.com', age: 25 },
    { username: 'bob', email: 'bob@example.com', age: 30 },
    { username: 'charlie', email: 'charlie@example.com', age: 35 },
    { username: 'diana', email: 'diana@example.com', age: 28 },
    { username: 'eve', email: 'eve@example.com', age: 32 }
  ],

  products: [
    { name: 'Laptop', price: 999.99, category: 'Electronics', stock: 10 },
    { name: 'Mouse', price: 29.99, category: 'Electronics', stock: 50 },
    { name: 'Keyboard', price: 79.99, category: 'Electronics', stock: 30 },
    { name: 'Monitor', price: 299.99, category: 'Electronics', stock: 15 },
    { name: 'Headphones', price: 149.99, category: 'Electronics', stock: 25 }
  ],

  orders: [
    { status: 'pending', total: 100.00 },
    { status: 'processing', total: 250.50 },
    { status: 'completed', total: 499.99 },
    { status: 'cancelled', total: 75.00 },
    { status: 'completed', total: 1200.00 }
  ]
};

/**
 * Assert helpers for integration tests
 */
export class IntegrationAssertions {
  static assertPoolHealthy(stats: any): void {
    expect(stats).toBeDefined();
    expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
    expect(stats.activeConnections).toBeLessThanOrEqual(stats.totalConnections);
    expect(stats.idleConnections).toBeLessThanOrEqual(stats.totalConnections);
    expect(stats.activeConnections + stats.idleConnections).toBeLessThanOrEqual(
      stats.totalConnections
    );
  }

  static assertQueryResult(result: any): void {
    expect(result).toBeDefined();
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('rowCount');
    expect(result).toHaveProperty('executionTime');
    expect(Array.isArray(result.rows)).toBe(true);
    expect(typeof result.rowCount).toBe('number');
    expect(typeof result.executionTime).toBe('number');
  }

  static assertTransactionState(transaction: any, expectedState: string): void {
    expect(transaction).toBeDefined();
    expect(transaction).toHaveProperty('id');
    expect(transaction).toHaveProperty('state');
    expect(transaction.state).toBe(expectedState);
  }

  static assertPerformance(duration: number, maxDuration: number): void {
    expect(duration).toBeLessThanOrEqual(maxDuration);
    expect(duration).toBeGreaterThanOrEqual(0);
  }
}
