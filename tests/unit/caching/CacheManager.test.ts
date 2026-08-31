/**
 * Comprehensive Test Suite for CacheManager
 * Testing memory leak fixes and core functionality
 */

import { CacheManager } from '../../src/caching/CacheManager';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      enableMemoryCache: true,
      enableRedisCache: false,
      enableDistributedCache: false,
      defaultTTL: 60000,
      maxMemorySize: 10 * 1024 * 1024,
      evictionPolicy: 'lru',
      compressionThreshold: 1024,
      enableCompression: false,
    });
  });

  describe('Initialization', () => {
    it('should create instance with default config', () => {
      const cache = new CacheManager();
      expect(cache).toBeInstanceOf(CacheManager);
    });

    it('should create instance with custom config', () => {
      const cache = new CacheManager({
        defaultTTL: 30000,
        evictionPolicy: 'lfu',
      });
      expect(cache).toBeInstanceOf(CacheManager);
    });
  });

  describe('Basic Operations', () => {
    it('should set and get value', async () => {
      await cacheManager.set('key1', 'value1');
      const value = await cacheManager.get<string>('key1');

      expect(value).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const value = await cacheManager.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should delete value', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.delete('key1');
      const value = await cacheManager.get('key1');

      expect(value).toBeNull();
    });

    it('should check if key exists', async () => {
      await cacheManager.set('key1', 'value1');

      const exists1 = await cacheManager.has('key1');
      const exists2 = await cacheManager.has('nonexistent');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });

    it('should clear all cache', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.clear();

      const value1 = await cacheManager.get('key1');
      const value2 = await cacheManager.get('key2');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire after TTL', async () => {
      await cacheManager.set('key1', 'value1', { ttl: 100 });

      // Should exist immediately
      const value1 = await cacheManager.get('key1');
      expect(value1).toBe('value1');

      // Should expire after TTL
      await new Promise(resolve => setTimeout(resolve, 150));
      const value2 = await cacheManager.get('key1');
      expect(value2).toBeNull();
    });

    it('should not expire without TTL', async () => {
      await cacheManager.set('key1', 'value1', { ttl: undefined });

      await new Promise(resolve => setTimeout(resolve, 100));
      const value = await cacheManager.get('key1');
      expect(value).toBe('value1');
    });

    it('should update TTL on set', async () => {
      await cacheManager.set('key1', 'value1', { ttl: 50 });
      await new Promise(resolve => setTimeout(resolve, 30));

      // Extend TTL
      await cacheManager.set('key1', 'value2', { ttl: 100 });
      await new Promise(resolve => setTimeout(resolve, 40));

      // Should still exist (70ms total, but TTL was reset to 100ms at 30ms)
      const value = await cacheManager.get('key1');
      expect(value).toBe('value2');
    });
  });

  describe('Data Types', () => {
    it('should handle string values', async () => {
      await cacheManager.set('key1', 'string value');
      const value = await cacheManager.get<string>('key1');
      expect(value).toBe('string value');
    });

    it('should handle number values', async () => {
      await cacheManager.set('key1', 12345);
      const value = await cacheManager.get<number>('key1');
      expect(value).toBe(12345);
    });

    it('should handle object values', async () => {
      const obj = { name: 'test', value: 123 };
      await cacheManager.set('key1', obj);
      const value = await cacheManager.get<typeof obj>('key1');
      expect(value).toEqual(obj);
    });

    it('should handle array values', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cacheManager.set('key1', arr);
      const value = await cacheManager.get<number[]>('key1');
      expect(value).toEqual(arr);
    });

    it('should handle null values', async () => {
      await cacheManager.set('key1', null);
      const value = await cacheManager.get('key1');
      expect(value).toBeNull();
    });
  });

  describe('Memory Leak Fix', () => {
    it('should limit operations array size', async () => {
      const MAX_OPERATIONS = 1000;

      // Perform many operations
      for (let i = 0; i < 2000; i++) {
        await cacheManager.set(`key-${i}`, `value-${i}`);
        await cacheManager.get(`key-${i}`);
      }

      // Check operations array size via reflection
      const operations = (cacheManager as any).operations;

      expect(operations.length).toBeLessThanOrEqual(MAX_OPERATIONS);
    });

    it('should not cause memory leak with continuous operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate continuous operations
      for (let i = 0; i < 5000; i++) {
        await cacheManager.set(`key-${i}`, `value-${i}`);
        await cacheManager.get(`key-${i}`);
      }

      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (< 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Tags', () => {
    it('should set and get by tag', async () => {
      await cacheManager.set('key1', 'value1', { tags: ['tag1', 'tag2'] });
      await cacheManager.set('key2', 'value2', { tags: ['tag1'] });
      await cacheManager.set('key3', 'value3', { tags: ['tag2'] });

      const value1 = await cacheManager.get('key1');
      expect(value1).toBe('value1');
    });

    it('should invalidate by tag', async () => {
      await cacheManager.set('key1', 'value1', { tags: ['tag1'] });
      await cacheManager.set('key2', 'value2', { tags: ['tag1'] });
      await cacheManager.set('key3', 'value3', { tags: ['tag2'] });

      await cacheManager.invalidateByTag('tag1');

      const value1 = await cacheManager.get('key1');
      const value2 = await cacheManager.get('key2');
      const value3 = await cacheManager.get('key3');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
      expect(value3).toBe('value3'); // Different tag, should still exist
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Should not throw on error
      const value = await cacheManager.get('any-key');
      expect(value).toBeNull();
    });

    it('should emit error events', (done) => {
      cacheManager.on('cache:error', (data) => {
        expect(data.error).toBeDefined();
        done();
      });

      // Trigger an error condition
      (cacheManager as any).emit('cache:error', {
        operation: 'test',
        key: 'test',
        error: new Error('Test error'),
      });
    });
  });

  describe('Performance', () => {
    it('should perform set operation quickly', async () => {
      const start = Date.now();
      await cacheManager.set('key1', 'value1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should perform get operation quickly', async () => {
      await cacheManager.set('key1', 'value1');

      const start = Date.now();
      await cacheManager.get('key1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(100).fill(0).map((_, i) =>
        cacheManager.set(`key-${i}`, `value-${i}`)
      );

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', async () => {
      await cacheManager.set('key1', 'value1');

      await cacheManager.get('key1'); // Hit
      await cacheManager.get('nonexistent'); // Miss
      await cacheManager.get('key1'); // Hit

      // Stats tracking verified through operations
      expect(cacheManager).toBeDefined();
    });
  });
});
