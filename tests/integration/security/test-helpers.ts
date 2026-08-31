/**
 * Integration Test Setup and Utilities
 * Provides test containers, helpers, and fixtures for security integration tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Test container mock for Redis (would use testcontainers in production)
 */
export class MockRedisContainer {
  private data: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();

  async start(): Promise<void> {
    // Simulate container startup
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async stop(): Promise<void> {
    this.data.clear();
    this.expirations.clear();
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.data.set(key, value);
    if (ttl) {
      this.expirations.set(key, Date.now() + ttl * 1000);
    }
  }

  async get(key: string): Promise<string | null> {
    const expiry = this.expirations.get(key);
    if (expiry && Date.now() > expiry) {
      this.data.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.data.get(key) || null;
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
    this.expirations.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  getConnectionString(): string {
    return 'redis://localhost:6379';
  }
}

/**
 * Test container mock for PostgreSQL
 */
export class MockPostgresContainer {
  private tables: Map<string, any[]> = new Map();

  async start(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.initializeTables();
  }

  async stop(): Promise<void> {
    this.tables.clear();
  }

  private initializeTables(): void {
    this.tables.set('users', []);
    this.tables.set('sessions', []);
    this.tables.set('audit_logs', []);
    this.tables.set('permissions', []);
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Mock SQL execution
    if (sql.includes('INSERT INTO users')) {
      const user = {
        id: crypto.randomUUID(),
        username: params?.[0],
        email: params?.[1],
        created_at: new Date(),
      };
      this.tables.get('users')?.push(user);
      return [user];
    }

    if (sql.includes('SELECT * FROM users')) {
      return this.tables.get('users') || [];
    }

    return [];
  }

  getConnectionString(): string {
    return 'postgresql://test:test@localhost:5432/testdb';
  }
}

/**
 * Test fixtures for security tests
 */
export class SecurityTestFixtures {
  static createValidUser(overrides?: any) {
    return {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!',
      roles: ['user'],
      ...overrides,
    };
  }

  static createAdminUser(overrides?: any) {
    return {
      username: 'admin',
      email: 'admin@example.com',
      password: 'AdminPass123!',
      roles: ['admin'],
      ...overrides,
    };
  }

  static createTestSecret(type: 'api-key' | 'aws' | 'github' = 'api-key'): string {
    switch (type) {
      case 'api-key':
        return 'sk-ant-api03-' + crypto.randomBytes(64).toString('hex').slice(0, 95);
      case 'aws':
        return 'AKIA' + crypto.randomBytes(16).toString('hex').slice(0, 16).toUpperCase();
      case 'github':
        return 'ghp_' + crypto.randomBytes(36).toString('hex').slice(0, 36);
      default:
        return crypto.randomBytes(32).toString('hex');
    }
  }

  static createTempDirectory(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'security-test-'));
  }

  static cleanupTempDirectory(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

/**
 * Test helpers for common operations
 */
export class SecurityTestHelpers {
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Timeout waiting for condition');
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed');
  }

  static generateRandomString(length: number): string {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  static async measurePerformance<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;

    return { result, duration };
  }

  static createMockApiEndpoint(port: number = 3000): MockApiServer {
    return new MockApiServer(port);
  }
}

/**
 * Mock API server for testing API integrations
 */
export class MockApiServer {
  private handlers: Map<string, (req: any) => any> = new Map();
  private requestLog: any[] = [];

  constructor(private port: number) {}

  async start(): Promise<void> {
    // Simulate server startup
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async stop(): Promise<void> {
    this.handlers.clear();
    this.requestLog = [];
  }

  onRequest(path: string, handler: (req: any) => any): void {
    this.handlers.set(path, handler);
  }

  async request(path: string, options: any = {}): Promise<any> {
    const handler = this.handlers.get(path);

    const req = {
      path,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    };

    this.requestLog.push(req);

    if (handler) {
      return handler(req);
    }

    return { status: 404, body: 'Not Found' };
  }

  getRequestLog(): any[] {
    return this.requestLog;
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

/**
 * Database test utilities
 */
export class DatabaseTestUtils {
  static async createTestDatabase(name: string): Promise<MockPostgresContainer> {
    const db = new MockPostgresContainer();
    await db.start();
    return db;
  }

  static async seedTestData(db: MockPostgresContainer, data: any): Promise<void> {
    // Insert seed data
    for (const table in data) {
      for (const row of data[table]) {
        await db.query(`INSERT INTO ${table} VALUES (?)`, [row]);
      }
    }
  }

  static async cleanupDatabase(db: MockPostgresContainer): Promise<void> {
    await db.stop();
  }
}

/**
 * File system test utilities
 */
export class FileSystemTestUtils {
  static createTestFile(dir: string, filename: string, content: string): string {
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  static createTestDirectory(baseDir: string, name: string): string {
    const dirPath = path.join(baseDir, name);
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  }

  static readTestFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  static deleteTestFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  static listTestFiles(dir: string): string[] {
    return fs.readdirSync(dir);
  }
}

/**
 * Assertion helpers for security tests
 */
export class SecurityAssertions {
  static assertValidToken(token: string): void {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  }

  static assertValidUserId(userId: string): void {
    expect(userId).toBeDefined();
    expect(typeof userId).toBe('string');
    expect(userId.length).toBeGreaterThan(0);
  }

  static assertSecurePassword(password: string): void {
    expect(password.length).toBeGreaterThanOrEqual(8);
    expect(password).toMatch(/[A-Z]/); // Has uppercase
    expect(password).toMatch(/[0-9]/); // Has number
    expect(password).toMatch(/[!@#$%^&*]/); // Has special char
  }

  static assertNoSecretsInText(text: string, secretPatterns: RegExp[]): void {
    for (const pattern of secretPatterns) {
      expect(text).not.toMatch(pattern);
    }
  }

  static assertAuditLogEntry(entry: any, expectedAction: string): void {
    expect(entry).toBeDefined();
    expect(entry.action).toBe(expectedAction);
    expect(entry.timestamp).toBeDefined();
    expect(entry.actorId).toBeDefined();
  }

  static assertRateLimitResponse(response: any, shouldBeAllowed: boolean): void {
    expect(response).toBeDefined();
    expect(response.allowed).toBe(shouldBeAllowed);

    if (!shouldBeAllowed) {
      expect(response.reason).toBeDefined();
      expect(response.retryAfter).toBeGreaterThan(0);
    }
  }

  static assertPermissionDenied(result: any): void {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.toLowerCase()).toContain('permission');
  }
}

/**
 * Load testing utilities
 */
export class LoadTestUtils {
  static async simulateLoad<T>(
    operation: () => Promise<T>,
    concurrency: number,
    duration: number
  ): Promise<{ totalRequests: number; successCount: number; errorCount: number; avgLatency: number }> {
    const startTime = Date.now();
    let totalRequests = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalLatency = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (Date.now() - startTime < duration) {
        const reqStart = Date.now();
        try {
          await operation();
          successCount++;
        } catch (error) {
          errorCount++;
        }
        totalLatency += Date.now() - reqStart;
        totalRequests++;
      }
    });

    await Promise.all(workers);

    return {
      totalRequests,
      successCount,
      errorCount,
      avgLatency: totalLatency / totalRequests,
    };
  }

  static async rampUp<T>(
    operation: () => Promise<T>,
    startConcurrency: number,
    endConcurrency: number,
    rampUpTime: number
  ): Promise<void> {
    const step = (endConcurrency - startConcurrency) / 10;
    const stepDuration = rampUpTime / 10;

    for (let i = 0; i < 10; i++) {
      const concurrency = Math.floor(startConcurrency + step * i);
      await this.simulateLoad(operation, concurrency, stepDuration);
    }
  }
}

/**
 * Environment setup for integration tests
 */
export class TestEnvironment {
  static redis: MockRedisContainer | null = null;
  static db: MockPostgresContainer | null = null;
  static api: MockApiServer | null = null;

  static async setup(): Promise<void> {
    // Start test containers
    this.redis = new MockRedisContainer();
    await this.redis.start();

    this.db = new MockPostgresContainer();
    await this.db.start();

    this.api = new MockApiServer(3000);
    await this.api.start();
  }

  static async teardown(): Promise<void> {
    if (this.redis) await this.redis.stop();
    if (this.db) await this.db.stop();
    if (this.api) await this.api.stop();
  }

  static getRedis(): MockRedisContainer {
    if (!this.redis) throw new Error('Redis not initialized');
    return this.redis;
  }

  static getDb(): MockPostgresContainer {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  static getApi(): MockApiServer {
    if (!this.api) throw new Error('API server not initialized');
    return this.api;
  }
}
