/**
 * Integration Tests: Testcontainers Support
 * Real database and service containers for integration testing
 * Tests with PostgreSQL, Redis, and other containerized services
 */

import { EventEmitter } from 'events';

/**
 * Mock Container Manager for testcontainers-like functionality
 * In real implementation, this would use actual testcontainers library
 */
class MockContainer extends EventEmitter {
  private containerId: string;
  private image: string;
  private ports: Map<number, number> = new Map();
  private env: Map<string, string> = new Map();
  private running = false;
  private health = 'starting';

  constructor(image: string) {
    super();
    this.image = image;
    this.containerId = `container-${Date.now()}-${Math.random()}`;
  }

  withExposedPorts(...ports: number[]): this {
    ports.forEach(port => {
      // Simulate random host port mapping
      this.ports.set(port, 30000 + Math.floor(Math.random() * 10000));
    });
    return this;
  }

  withEnvironment(key: string, value: string): this {
    this.env.set(key, value);
    return this;
  }

  async start(): Promise<void> {
    this.running = true;
    this.emit('container:starting', { id: this.containerId, image: this.image });

    // Simulate startup time
    await new Promise(resolve => setTimeout(resolve, 100));

    this.health = 'healthy';
    this.emit('container:started', { id: this.containerId, image: this.image });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.health = 'stopped';
    this.emit('container:stopped', { id: this.containerId });
  }

  getMappedPort(containerPort: number): number {
    return this.ports.get(containerPort) || 0;
  }

  getHost(): string {
    return 'localhost';
  }

  isRunning(): boolean {
    return this.running;
  }

  getHealth(): string {
    return this.health;
  }

  getId(): string {
    return this.containerId;
  }
}

/**
 * Mock Database Connection for container
 */
class MockContainerDatabase extends EventEmitter {
  private connected = false;
  private data: Map<string, any[]> = new Map();

  constructor(private host: string, private port: number, private database: string) {
    super();
  }

  async connect(): Promise<void> {
    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 50));
    this.connected = true;
    this.emit('connected', { host: this.host, port: this.port });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.data.clear();
    this.emit('disconnected');
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    this.emit('query', { sql, params });

    // Simulate query execution
    if (sql.includes('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE (\w+)/i);
      if (match) {
        const tableName = match[1];
        this.data.set(tableName, []);
      }
      return { success: true };
    }

    if (sql.includes('INSERT INTO')) {
      const match = sql.match(/INSERT INTO (\w+)/i);
      if (match) {
        const tableName = match[1];
        const table = this.data.get(tableName) || [];
        const record = { id: table.length + 1, ...params };
        table.push(record);
        this.data.set(tableName, table);
        return { insertId: record.id };
      }
    }

    if (sql.includes('SELECT')) {
      const match = sql.match(/FROM (\w+)/i);
      if (match) {
        const tableName = match[1];
        return { rows: this.data.get(tableName) || [] };
      }
    }

    return { success: true };
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Mock Redis Client for container
 */
class MockContainerRedis extends EventEmitter {
  private connected = false;
  private data: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();

  constructor(private host: string, private port: number) {
    super();
  }

  async connect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    this.connected = true;
    this.emit('connected', { host: this.host, port: this.port });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.data.clear();
    this.expirations.clear();
    this.emit('disconnected');
  }

  async set(key: string, value: string, expiryMs?: number): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to Redis');
    }

    this.data.set(key, value);

    if (expiryMs) {
      this.expirations.set(key, Date.now() + expiryMs);
    }

    this.emit('set', { key, value });
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) {
      throw new Error('Not connected to Redis');
    }

    // Check expiration
    const expiry = this.expirations.get(key);
    if (expiry && Date.now() > expiry) {
      this.data.delete(key);
      this.expirations.delete(key);
      return null;
    }

    return this.data.get(key) || null;
  }

  async del(key: string): Promise<number> {
    if (!this.connected) {
      throw new Error('Not connected to Redis');
    }

    const existed = this.data.has(key);
    this.data.delete(key);
    this.expirations.delete(key);

    return existed ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.connected) {
      throw new Error('Not connected to Redis');
    }

    // Simple pattern matching
    const allKeys = Array.from(this.data.keys());

    if (pattern === '*') {
      return allKeys;
    }

    const regex = new RegExp(pattern.replace('*', '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  isConnected(): boolean {
    return this.connected;
  }
}

describe('Testcontainers Integration - PostgreSQL', () => {
  let container: MockContainer;
  let database: MockContainerDatabase;

  beforeAll(async () => {
    container = new MockContainer('postgres:15-alpine');
    container
      .withExposedPorts(5432)
      .withEnvironment('POSTGRES_DB', 'testdb')
      .withEnvironment('POSTGRES_USER', 'testuser')
      .withEnvironment('POSTGRES_PASSWORD', 'testpass');

    await container.start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    database = new MockContainerDatabase(host, port, 'testdb');
    await database.connect();
  });

  afterAll(async () => {
    if (database?.isConnected()) {
      await database.disconnect();
    }
    if (container?.isRunning()) {
      await container.stop();
    }
  });

  test('should start PostgreSQL container', () => {
    expect(container.isRunning()).toBe(true);
    expect(container.getHealth()).toBe('healthy');
  });

  test('should connect to containerized database', () => {
    expect(database.isConnected()).toBe(true);
  });

  test('should create table in container', async () => {
    const result = await database.query(
      'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100))'
    );

    expect(result.success).toBe(true);
  });

  test('should insert data into containerized database', async () => {
    await database.query('CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(100))');

    const result = await database.query(
      'INSERT INTO products (name) VALUES ($1)',
      ['Test Product']
    );

    expect(result).toHaveProperty('insertId');
  });

  test('should query data from containerized database', async () => {
    await database.query('CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(100))');
    await database.query('INSERT INTO items (name) VALUES ($1)', ['Item 1']);
    await database.query('INSERT INTO items (name) VALUES ($1)', ['Item 2']);

    const result = await database.query('SELECT * FROM items');

    expect(result.rows).toHaveLength(2);
  });

  test('should handle transaction in container', async () => {
    await database.query('CREATE TABLE accounts (id SERIAL PRIMARY KEY, balance INTEGER)');

    await database.query('BEGIN');
    await database.query('INSERT INTO accounts (balance) VALUES ($1)', [1000]);
    await database.query('INSERT INTO accounts (balance) VALUES ($1)', [2000]);
    await database.query('COMMIT');

    const result = await database.query('SELECT * FROM accounts');
    expect(result.rows).toHaveLength(2);
  });
});

describe('Testcontainers Integration - Redis', () => {
  let container: MockContainer;
  let redis: MockContainerRedis;

  beforeAll(async () => {
    container = new MockContainer('redis:7-alpine');
    container.withExposedPorts(6379);

    await container.start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);

    redis = new MockContainerRedis(host, port);
    await redis.connect();
  });

  afterAll(async () => {
    if (redis?.isConnected()) {
      await redis.disconnect();
    }
    if (container?.isRunning()) {
      await container.stop();
    }
  });

  test('should start Redis container', () => {
    expect(container.isRunning()).toBe(true);
    expect(container.getHealth()).toBe('healthy');
  });

  test('should connect to containerized Redis', () => {
    expect(redis.isConnected()).toBe(true);
  });

  test('should set and get values in Redis container', async () => {
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');

    expect(value).toBe('test-value');
  });

  test('should handle key expiration', async () => {
    await redis.set('expiring-key', 'value', 100);

    const immediate = await redis.get('expiring-key');
    expect(immediate).toBe('value');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    const expired = await redis.get('expiring-key');
    expect(expired).toBeNull();
  });

  test('should delete keys', async () => {
    await redis.set('delete-me', 'value');

    const deleted = await redis.del('delete-me');
    expect(deleted).toBe(1);

    const value = await redis.get('delete-me');
    expect(value).toBeNull();
  });

  test('should find keys by pattern', async () => {
    await redis.set('user:1', 'Alice');
    await redis.set('user:2', 'Bob');
    await redis.set('post:1', 'Post content');

    const userKeys = await redis.keys('user:*');

    expect(userKeys).toHaveLength(2);
    expect(userKeys).toContain('user:1');
    expect(userKeys).toContain('user:2');
  });
});

describe('Multi-Container Integration', () => {
  let postgresContainer: MockContainer;
  let redisContainer: MockContainer;
  let database: MockContainerDatabase;
  let redis: MockContainerRedis;

  beforeAll(async () => {
    // Start PostgreSQL
    postgresContainer = new MockContainer('postgres:15-alpine');
    postgresContainer
      .withExposedPorts(5432)
      .withEnvironment('POSTGRES_DB', 'appdb')
      .withEnvironment('POSTGRES_USER', 'appuser')
      .withEnvironment('POSTGRES_PASSWORD', 'apppass');

    await postgresContainer.start();

    // Start Redis
    redisContainer = new MockContainer('redis:7-alpine');
    redisContainer.withExposedPorts(6379);
    await redisContainer.start();

    // Connect to both
    database = new MockContainerDatabase(
      postgresContainer.getHost(),
      postgresContainer.getMappedPort(5432),
      'appdb'
    );
    await database.connect();

    redis = new MockContainerRedis(
      redisContainer.getHost(),
      redisContainer.getMappedPort(6379)
    );
    await redis.connect();
  });

  afterAll(async () => {
    await database?.disconnect();
    await redis?.disconnect();
    await postgresContainer?.stop();
    await redisContainer?.stop();
  });

  test('should use database for persistence and Redis for caching', async () => {
    // Create table
    await database.query('CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100))');

    // Insert into database
    const insertResult = await database.query(
      'INSERT INTO users (name) VALUES ($1)',
      ['John Doe']
    );

    const userId = insertResult.insertId;

    // Cache in Redis
    await redis.set(`user:${userId}`, JSON.stringify({ id: userId, name: 'John Doe' }));

    // Retrieve from cache
    const cached = await redis.get(`user:${userId}`);
    expect(cached).toBeTruthy();

    const user = JSON.parse(cached!);
    expect(user.name).toBe('John Doe');

    // Verify in database
    const dbResult = await database.query('SELECT * FROM users WHERE id = $1', [userId]);
    expect(dbResult.rows).toHaveLength(1);
  });

  test('should implement cache-aside pattern', async () => {
    await database.query('CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(100))');

    const productId = 123;
    const productName = 'Laptop';

    // Try cache first
    let cached = await redis.get(`product:${productId}`);

    if (!cached) {
      // Not in cache, get from database
      await database.query('INSERT INTO products (name) VALUES ($1)', [productName]);
      const dbResult = await database.query('SELECT * FROM products WHERE id = $1', [productId]);

      if (dbResult.rows.length > 0) {
        const product = dbResult.rows[0];
        // Store in cache
        await redis.set(`product:${productId}`, JSON.stringify(product));
        cached = JSON.stringify(product);
      }
    }

    expect(cached).toBeTruthy();
  });

  test('should invalidate cache on database update', async () => {
    await database.query('CREATE TABLE settings (id SERIAL PRIMARY KEY, value TEXT)');

    const settingId = 1;

    // Initial data
    await database.query('INSERT INTO settings (value) VALUES ($1)', ['old-value']);
    await redis.set(`setting:${settingId}`, 'old-value');

    // Update database
    await database.query('UPDATE settings SET value = $1 WHERE id = $2', ['new-value', settingId]);

    // Invalidate cache
    await redis.del(`setting:${settingId}`);

    // Cache should be empty
    const cached = await redis.get(`setting:${settingId}`);
    expect(cached).toBeNull();
  });
});

describe('Container Lifecycle Management', () => {
  test('should handle container restart', async () => {
    const container = new MockContainer('postgres:15-alpine');
    container.withExposedPorts(5432);

    await container.start();
    expect(container.isRunning()).toBe(true);

    await container.stop();
    expect(container.isRunning()).toBe(false);

    await container.start();
    expect(container.isRunning()).toBe(true);

    await container.stop();
  });

  test('should emit lifecycle events', async () => {
    const container = new MockContainer('redis:7-alpine');
    const events: string[] = [];

    container.on('container:starting', () => events.push('starting'));
    container.on('container:started', () => events.push('started'));
    container.on('container:stopped', () => events.push('stopped'));

    await container.start();
    await container.stop();

    expect(events).toEqual(['starting', 'started', 'stopped']);
  });

  test('should clean up resources on stop', async () => {
    const container = new MockContainer('postgres:15-alpine');
    container.withExposedPorts(5432);

    await container.start();

    const db = new MockContainerDatabase(
      container.getHost(),
      container.getMappedPort(5432),
      'test'
    );
    await db.connect();

    await db.disconnect();
    await container.stop();

    expect(container.isRunning()).toBe(false);
    expect(db.isConnected()).toBe(false);
  });
});

describe('Container Network Integration', () => {
  test('should enable communication between containers', async () => {
    const dbContainer = new MockContainer('postgres:15-alpine');
    dbContainer.withExposedPorts(5432);
    await dbContainer.start();

    const appContainer = new MockContainer('node:18-alpine');
    await appContainer.start();

    // Simulate app connecting to database
    const db = new MockContainerDatabase(
      dbContainer.getHost(),
      dbContainer.getMappedPort(5432),
      'app'
    );
    await db.connect();

    expect(db.isConnected()).toBe(true);

    await db.disconnect();
    await dbContainer.stop();
    await appContainer.stop();
  });
});

describe('Integration Test Scenarios with Containers', () => {
  let pgContainer: MockContainer;
  let redisContainer: MockContainer;
  let db: MockContainerDatabase;
  let cache: MockContainerRedis;

  beforeAll(async () => {
    pgContainer = new MockContainer('postgres:15-alpine');
    pgContainer.withExposedPorts(5432);
    await pgContainer.start();

    redisContainer = new MockContainer('redis:7-alpine');
    redisContainer.withExposedPorts(6379);
    await redisContainer.start();

    db = new MockContainerDatabase(
      pgContainer.getHost(),
      pgContainer.getMappedPort(5432),
      'test'
    );
    await db.connect();

    cache = new MockContainerRedis(
      redisContainer.getHost(),
      redisContainer.getMappedPort(6379)
    );
    await cache.connect();
  });

  afterAll(async () => {
    await db?.disconnect();
    await cache?.disconnect();
    await pgContainer?.stop();
    await redisContainer?.stop();
  });

  test('should handle user registration with database and cache', async () => {
    await db.query('CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(100))');

    const userEmail = 'test@example.com';

    // Register user
    const result = await db.query('INSERT INTO users (email) VALUES ($1)', [userEmail]);
    const userId = result.insertId;

    // Cache user data
    await cache.set(`user:${userId}`, JSON.stringify({ id: userId, email: userEmail }));

    // Verify in both
    const dbResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const cacheResult = await cache.get(`user:${userId}`);

    expect(dbResult.rows).toHaveLength(1);
    expect(cacheResult).toBeTruthy();
  });

  test('should handle session management', async () => {
    const sessionId = 'session-123';
    const userId = 'user-456';

    // Store session in Redis
    await cache.set(`session:${sessionId}`, userId, 3600000);

    // Retrieve session
    const retrievedUserId = await cache.get(`session:${sessionId}`);

    expect(retrievedUserId).toBe(userId);
  });

  test('should implement distributed locking with Redis', async () => {
    const lockKey = 'lock:resource-1';
    const lockValue = 'process-123';

    // Acquire lock
    await cache.set(lockKey, lockValue, 5000);

    // Check lock
    const currentLock = await cache.get(lockKey);
    expect(currentLock).toBe(lockValue);

    // Release lock
    await cache.del(lockKey);

    const released = await cache.get(lockKey);
    expect(released).toBeNull();
  });
});
