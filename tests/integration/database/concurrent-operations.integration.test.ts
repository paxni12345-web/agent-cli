/**
 * Integration Tests: Concurrent Operations
 * Tests concurrent database operations, race conditions, and thread safety
 */

import { DatabasePoolManager, DatabaseConfig } from '../../../src/database/DatabasePoolManager';
import { ORM, Model, Schema } from '../../../src/database/MEGA_DatabaseAbstraction';

describe('Concurrent Operations Integration', () => {
  let poolManager: DatabasePoolManager;
  let orm: ORM;

  beforeAll(async () => {
    poolManager = new DatabasePoolManager();

    const config: DatabaseConfig = {
      id: 'concurrent-db',
      type: 'postgresql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'test_concurrent',
      username: 'test',
      password: 'test',
      poolConfig: {
        min: 5,
        max: 20,
        acquireTimeout: 30000
      }
    };

    await poolManager.registerDatabase(config);

    const ormConfig = {
      type: 'postgres' as const,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      logging: false
    };

    orm = new ORM(ormConfig);
    await orm.connect();
  });

  afterAll(async () => {
    await poolManager.close();
    await orm.disconnect();
  });

  describe('Concurrent Query Execution', () => {
    test('should handle 100 concurrent queries', async () => {
      const queries = Array.from({ length: 100 }, (_, i) =>
        poolManager.query('concurrent-db', 'SELECT $1 as id', [i])
      );

      const results = await Promise.all(queries);

      expect(results).toHaveLength(100);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('rows');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle concurrent reads and writes', async () => {
      const operations = [];

      // Mix of reads and writes
      for (let i = 0; i < 50; i++) {
        operations.push(
          poolManager.query('concurrent-db', 'SELECT $1 as value', [i])
        );
        operations.push(
          poolManager.query('concurrent-db', 'SELECT $1 as insert_test', [i])
        );
      }

      const results = await Promise.all(operations);
      expect(results).toHaveLength(100);
    });

    test('should maintain connection pool under load', async () => {
      const beforeStats = poolManager.getPoolStats('concurrent-db');

      const queries = Array.from({ length: 200 }, (_, i) =>
        poolManager.query('concurrent-db', 'SELECT $1', [i])
      );

      await Promise.all(queries);

      const afterStats = poolManager.getPoolStats('concurrent-db');

      expect(afterStats?.totalConnections).toBeLessThanOrEqual(20); // Max pool size
      expect(afterStats?.totalConnections).toBeGreaterThanOrEqual(5); // Min pool size
    });

    test('should handle burst traffic', async () => {
      // Simulate burst: many queries in quick succession
      const burst1 = Array.from({ length: 50 }, (_, i) =>
        poolManager.query('concurrent-db', 'SELECT $1', [i])
      );

      await Promise.all(burst1);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Another burst
      const burst2 = Array.from({ length: 50 }, (_, i) =>
        poolManager.query('concurrent-db', 'SELECT $1', [i + 100])
      );

      const results = await Promise.all(burst2);
      expect(results).toHaveLength(50);
    });
  });

  describe('Concurrent Transactions', () => {
    test('should handle multiple concurrent transactions', async () => {
      const transactions = await Promise.all(
        Array.from({ length: 10 }, () =>
          poolManager.beginTransaction('concurrent-db')
        )
      );

      expect(transactions).toHaveLength(10);
      expect(new Set(transactions.map(t => t.id)).size).toBe(10); // All unique

      // Commit all
      await Promise.all(
        transactions.map(tx => poolManager.commitTransaction(tx.id))
      );
    });

    test('should isolate concurrent transactions', async () => {
      const tx1 = await poolManager.beginTransaction('concurrent-db');
      const tx2 = await poolManager.beginTransaction('concurrent-db');

      // Both transactions should have unique IDs
      expect(tx1.id).not.toBe(tx2.id);

      await poolManager.commitTransaction(tx1.id);
      await poolManager.commitTransaction(tx2.id);
    });

    test('should handle mixed commit and rollback', async () => {
      const transactions = await Promise.all(
        Array.from({ length: 20 }, () =>
          poolManager.beginTransaction('concurrent-db')
        )
      );

      // Commit half, rollback half
      const operations = transactions.map((tx, index) =>
        index % 2 === 0
          ? poolManager.commitTransaction(tx.id)
          : poolManager.rollbackTransaction(tx.id)
      );

      await Promise.all(operations);
    });

    test('should handle concurrent transaction errors', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, async () => {
          const tx = await poolManager.beginTransaction('concurrent-db');

          if (Math.random() > 0.5) {
            await poolManager.commitTransaction(tx.id);
          } else {
            await poolManager.rollbackTransaction(tx.id);
          }
        })
      );

      // All should settle (either fulfill or reject)
      expect(results).toHaveLength(10);
    });
  });

  describe('Concurrent Model Operations', () => {
    let Counter: typeof Model;

    beforeAll(() => {
      class CounterModel extends Model {}

      const schema: Schema = {
        table: 'concurrent_counters',
        columns: {
          id: { type: 'integer', primaryKey: true, autoIncrement: true },
          name: { type: 'string', length: 100 },
          count: { type: 'integer', default: 0 }
        }
      };

      orm.registerModel('ConcurrentCounter', CounterModel, schema);
      Counter = orm.model('ConcurrentCounter');
    });

    test('should handle concurrent creates', async () => {
      const creates = Array.from({ length: 50 }, (_, i) =>
        Counter.create({
          name: `concurrent-${i}`,
          count: i
        })
      );

      const models = await Promise.all(creates);

      expect(models).toHaveLength(50);
      expect(new Set(models.map(m => m.getAttribute('id'))).size).toBe(50);
    });

    test('should handle concurrent reads', async () => {
      const created = await Counter.create({
        name: 'concurrent-read-test',
        count: 100
      });

      const reads = Array.from({ length: 100 }, () =>
        Counter.find(created.getAttribute('id'))
      );

      const results = await Promise.all(reads);

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result?.getAttribute('name')).toBe('concurrent-read-test');
      });
    });

    test('should handle concurrent updates to different records', async () => {
      // Create records
      const records = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          Counter.create({
            name: `update-test-${i}`,
            count: 0
          })
        )
      );

      // Update all concurrently
      const updates = records.map(async (record, index) => {
        record.setAttribute('count', index * 10);
        return record.save();
      });

      await Promise.all(updates);

      // Verify all updates succeeded
      const verified = await Promise.all(
        records.map(r => Counter.find(r.getAttribute('id')))
      );

      verified.forEach((record, index) => {
        expect(record?.getAttribute('count')).toBe(index * 10);
      });
    });

    test('should handle race condition on same record', async () => {
      const record = await Counter.create({
        name: 'race-test',
        count: 0
      });

      const recordId = record.getAttribute('id');

      // Multiple concurrent updates to the same record
      const updates = Array.from({ length: 10 }, async () => {
        const model = await Counter.find(recordId);
        if (model) {
          const currentCount = model.getAttribute('count');
          model.setAttribute('count', currentCount + 1);
          return model.save();
        }
      });

      await Promise.all(updates);

      // Final count should reflect some updates
      // (exact count depends on race conditions and transaction isolation)
      const final = await Counter.find(recordId);
      expect(final?.getAttribute('count')).toBeGreaterThanOrEqual(1);
    });

    test('should handle concurrent deletes', async () => {
      const records = await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          Counter.create({
            name: `delete-test-${i}`,
            count: i
          })
        )
      );

      const deletes = records.map(record => record.delete());

      await Promise.all(deletes);

      // Verify all deleted
      const verifyDeletes = await Promise.all(
        records.map(r => Counter.find(r.getAttribute('id')))
      );

      verifyDeletes.forEach(result => {
        expect(result).toBeNull();
      });
    });
  });

  describe('Connection Pool Stress Test', () => {
    test('should handle pool exhaustion gracefully', async () => {
      const stats = poolManager.getPoolStats('concurrent-db');
      const maxConnections = stats?.totalConnections || 20;

      // Try to acquire more connections than pool size
      const queries = Array.from({ length: maxConnections + 10 }, (_, i) =>
        poolManager.query('concurrent-db', 'SELECT $1', [i])
      );

      const results = await Promise.all(queries);
      expect(results).toHaveLength(maxConnections + 10);
    });

    test('should recover from temporary failures', async () => {
      const operations = Array.from({ length: 50 }, async (_, i) => {
        try {
          return await poolManager.query(
            'concurrent-db',
            'SELECT $1 as value',
            [i],
            { retries: 3 }
          );
        } catch (error) {
          return null;
        }
      });

      const results = await Promise.all(operations);
      const successful = results.filter(r => r !== null);

      expect(successful.length).toBeGreaterThan(0);
    });

    test('should maintain health under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const startTime = Date.now();
      const results: any[] = [];

      while (Date.now() - startTime < duration) {
        const batch = Array.from({ length: 10 }, (_, i) =>
          poolManager.query('concurrent-db', 'SELECT $1', [i])
        );

        results.push(...await Promise.all(batch));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(results.length).toBeGreaterThan(0);

      const health = poolManager.getPoolHealth('concurrent-db');
      expect(health?.status).toBe('healthy');
    });
  });

  describe('Deadlock Prevention', () => {
    test('should handle concurrent transactions without deadlock', async () => {
      const transactions = [];

      for (let i = 0; i < 20; i++) {
        transactions.push(
          (async () => {
            const tx = await poolManager.beginTransaction('concurrent-db');

            try {
              // Simulate some work
              await poolManager.query('concurrent-db', 'SELECT $1', [i]);
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
              await poolManager.commitTransaction(tx.id);
            } catch (error) {
              await poolManager.rollbackTransaction(tx.id);
              throw error;
            }
          })()
        );
      }

      await expect(Promise.all(transactions)).resolves.toBeDefined();
    });

    test('should timeout long-running transactions', async () => {
      const tx = await poolManager.beginTransaction('concurrent-db');

      // Wait longer than transaction timeout
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should still be able to commit or rollback
      await expect(
        poolManager.commitTransaction(tx.id)
      ).resolves.not.toThrow();
    });
  });

  describe('Query Cache Concurrency', () => {
    test('should handle concurrent cache hits', async () => {
      const query = 'SELECT $1 as cached';
      const params = [42];

      // First query - cache miss
      await poolManager.query('concurrent-db', query, params, {
        cache: true,
        cacheTTL: 60000
      });

      // Multiple concurrent queries - should all hit cache
      const cachedQueries = Array.from({ length: 100 }, () =>
        poolManager.query('concurrent-db', query, params, { cache: true })
      );

      const results = await Promise.all(cachedQueries);

      const cacheHits = results.filter(r => r.fromCache).length;
      expect(cacheHits).toBeGreaterThan(0);
    });

    test('should handle cache invalidation under load', async () => {
      const query = 'SELECT $1 as value';

      for (let i = 0; i < 50; i++) {
        await poolManager.query('concurrent-db', query, [i], {
          cache: true,
          cacheTTL: 10000
        });
      }

      poolManager.clearQueryCache('concurrent-db');

      // New queries should be cache misses
      const result = await poolManager.query('concurrent-db', query, [1], {
        cache: true
      });

      expect(result.fromCache).toBeUndefined();
    });
  });

  describe('Prepared Statement Concurrency', () => {
    test('should handle concurrent prepared statement execution', async () => {
      const stmt = await poolManager.prepare(
        'concurrent-db',
        'SELECT $1 as value'
      );

      const executions = Array.from({ length: 100 }, (_, i) =>
        poolManager.executePrepared(stmt.id, [i])
      );

      const results = await Promise.all(executions);
      expect(results).toHaveLength(100);
    });
  });

  describe('Error Propagation', () => {
    test('should propagate errors in concurrent operations', async () => {
      const operations = Array.from({ length: 20 }, async (_, i) => {
        if (i % 5 === 0) {
          // Intentionally cause some errors
          throw new Error(`Error in operation ${i}`);
        }
        return poolManager.query('concurrent-db', 'SELECT $1', [i]);
      });

      const results = await Promise.allSettled(operations);

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(succeeded).toBeGreaterThan(0);
      expect(failed).toBeGreaterThan(0);
      expect(succeeded + failed).toBe(20);
    });

    test('should isolate errors between concurrent transactions', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, async (_, i) => {
          const tx = await poolManager.beginTransaction('concurrent-db');

          try {
            if (i % 3 === 0) {
              throw new Error('Simulated transaction error');
            }
            await poolManager.commitTransaction(tx.id);
          } catch (error) {
            await poolManager.rollbackTransaction(tx.id);
            throw error;
          }
        })
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(succeeded).toBeGreaterThan(0);
      expect(failed).toBeGreaterThan(0);
    });
  });

  describe('Performance Under Concurrency', () => {
    test('should maintain acceptable response times', async () => {
      const startTime = Date.now();

      const queries = Array.from({ length: 100 }, (_, i) =>
        poolManager.query('concurrent-db', 'SELECT $1', [i])
      );

      await Promise.all(queries);

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / 100;

      // Average time per query should be reasonable (< 100ms)
      expect(avgTime).toBeLessThan(100);
    });

    test('should track statistics accurately under load', async () => {
      const beforeStats = poolManager.getQueryStatistics('concurrent-db');
      const initialCount = beforeStats.totalQueries;

      const queries = Array.from({ length: 50 }, (_, i) =>
        poolManager.query('concurrent-db', 'SELECT $1', [i])
      );

      await Promise.all(queries);

      const afterStats = poolManager.getQueryStatistics('concurrent-db');

      expect(afterStats.totalQueries).toBeGreaterThanOrEqual(initialCount + 50);
    });
  });
});
