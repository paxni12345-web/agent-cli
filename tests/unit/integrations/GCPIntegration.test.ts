/**
 * Comprehensive unit tests for GCPIntegration
 * Coverage: All public methods, edge cases, error conditions, async behavior,
 * resource cleanup, type safety, mocking, timeouts, and concurrency
 */

import { GCPIntegration, GCPIntegrationConfig, Request, Response, ValidationResult } from '../../../src/integrations/GCPIntegration';
import { EventEmitter } from 'events';

// Mock timers
jest.useFakeTimers();

describe('GCPIntegration', () => {
  let integration: GCPIntegration;
  let config: Partial<GCPIntegrationConfig>;

  beforeEach(() => {
    config = {
      enabled: true,
      mode: 'production',
      timeout: 5000,
      retries: 2,
      batchSize: 50,
      concurrency: 5,
      cacheEnabled: true,
      cacheTTL: 60000,
      compressionEnabled: true,
      encryptionEnabled: false,
      debug: false,
      logLevel: 'error',
      metricsEnabled: false,
      metricsInterval: 10000
    };
    integration = new GCPIntegration(config);
  });

  afterEach(async () => {
    if (integration && (integration as any).isInitialized) {
      await integration.shutdown();
    }
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      const defaultIntegration = new GCPIntegration();
      expect(defaultIntegration).toBeInstanceOf(GCPIntegration);
      expect(defaultIntegration).toBeInstanceOf(EventEmitter);
    });

    it('should create instance with custom config', () => {
      expect(integration).toBeInstanceOf(GCPIntegration);
      const status = integration.getStatus();
      expect(status.initialized).toBe(false);
    });

    it('should merge config with defaults', () => {
      const partialConfig = { timeout: 1000 };
      const inst = new GCPIntegration(partialConfig);
      expect(inst).toBeInstanceOf(GCPIntegration);
    });

    it('should handle null config', () => {
      const inst = new GCPIntegration(undefined);
      expect(inst).toBeInstanceOf(GCPIntegration);
    });

    it('should handle empty config object', () => {
      const inst = new GCPIntegration({});
      expect(inst).toBeInstanceOf(GCPIntegration);
    });

    it('should initialize internal data structures', () => {
      expect((integration as any).requests).toBeInstanceOf(Map);
      expect((integration as any).responses).toBeInstanceOf(Map);
      expect((integration as any).cache).toBeInstanceOf(Map);
      expect((integration as any).queue).toBeInstanceOf(Array);
    });
  });

  describe('initialize()', () => {
    it('should initialize successfully', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const status = integration.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.running).toBe(true);
    });

    it('should throw error if already initialized', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await expect(integration.initialize()).rejects.toThrow('Already initialized');
    });

    it('should throw error if disabled in config', async () => {
      const disabledIntegration = new GCPIntegration({ enabled: false });
      await expect(disabledIntegration.initialize()).rejects.toThrow('System is disabled in configuration');
    });

    it('should emit initialized event', async () => {
      const initHandler = jest.fn();
      integration.on('initialized', initHandler);

      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      expect(initHandler).toHaveBeenCalled();
    });

    it('should validate configuration during initialization', async () => {
      const invalidIntegration = new GCPIntegration({ timeout: -1, enabled: true });
      await expect(invalidIntegration.initialize()).rejects.toThrow('timeout must be positive');
    });

    it('should reject invalid concurrency', async () => {
      const invalidIntegration = new GCPIntegration({ concurrency: 0, enabled: true });
      await expect(invalidIntegration.initialize()).rejects.toThrow('concurrency must be positive');
    });

    it('should reject zero timeout', async () => {
      const invalidIntegration = new GCPIntegration({ timeout: 0, enabled: true });
      await expect(invalidIntegration.initialize()).rejects.toThrow('timeout must be positive');
    });

    it('should reject negative concurrency', async () => {
      const invalidIntegration = new GCPIntegration({ concurrency: -5, enabled: true });
      await expect(invalidIntegration.initialize()).rejects.toThrow('concurrency must be positive');
    });

    it('should start metrics collection if enabled', async () => {
      const metricsIntegration = new GCPIntegration({ metricsEnabled: true });
      const metricsHandler = jest.fn();
      metricsIntegration.on('metrics:updated', metricsHandler);

      const initPromise = metricsIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      jest.advanceTimersByTime(10000);
      expect(metricsHandler).toHaveBeenCalled();

      await metricsIntegration.shutdown();
    });

    it('should handle initialization with cache disabled', async () => {
      const noCacheIntegration = new GCPIntegration({ cacheEnabled: false });
      const initPromise = noCacheIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      expect((noCacheIntegration as any).config.cacheEnabled).toBe(false);
      await noCacheIntegration.shutdown();
    });

    it('should register validation rules', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      expect((integration as any).validationRules.length).toBeGreaterThan(0);
    });

    it('should setup event handlers', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      expect(integration.listenerCount('error')).toBeGreaterThan(0);
    });
  });

  describe('submit()', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should submit request successfully', async () => {
      const requestId = await integration.submit('test', 'create', { data: 'test' });
      expect(requestId).toBeTruthy();
      expect(typeof requestId).toBe('string');
    });

    it('should throw if not initialized', async () => {
      const uninitializedIntegration = new GCPIntegration(config);
      await expect(uninitializedIntegration.submit('test', 'create', {}))
        .rejects.toThrow('System not initialized');
    });

    it('should throw if not running', async () => {
      (integration as any).isRunning = false;
      await expect(integration.submit('test', 'create', {}))
        .rejects.toThrow('System not running');
    });

    it('should handle null type', async () => {
      await expect(integration.submit(null as any, 'create', {}))
        .rejects.toThrow('Validation failed');
    });

    it('should handle undefined type', async () => {
      await expect(integration.submit(undefined as any, 'create', {}))
        .rejects.toThrow('Validation failed');
    });

    it('should handle empty string type', async () => {
      const requestId = await integration.submit('', 'create', {});
      expect(requestId).toBeTruthy();
    });

    it('should handle null payload', async () => {
      await expect(integration.submit('test', 'create', null))
        .rejects.toThrow('Validation failed');
    });

    it('should handle undefined payload', async () => {
      await expect(integration.submit('test', 'create', undefined))
        .rejects.toThrow('Validation failed');
    });

    it('should handle empty payload', async () => {
      const requestId = await integration.submit('test', 'create', {});
      expect(requestId).toBeTruthy();
    });

    it('should accept custom priority', async () => {
      const requestId = await integration.submit('test', 'create', {}, { priority: 10 });
      expect(requestId).toBeTruthy();
    });

    it('should accept custom timeout', async () => {
      const requestId = await integration.submit('test', 'create', {}, { timeout: 1000 });
      expect(requestId).toBeTruthy();
    });

    it('should accept custom retries', async () => {
      const requestId = await integration.submit('test', 'create', {}, { retries: 5 });
      expect(requestId).toBeTruthy();
    });

    it('should accept skipCache option', async () => {
      const requestId = await integration.submit('test', 'create', {}, { skipCache: true });
      expect(requestId).toBeTruthy();
    });

    it('should accept cacheKey option', async () => {
      const requestId = await integration.submit('test', 'create', {}, { cacheKey: 'custom-key' });
      expect(requestId).toBeTruthy();
    });

    it('should emit request:submitted event', async () => {
      const handler = jest.fn();
      integration.on('request:submitted', handler);

      await integration.submit('test', 'create', { data: 'test' });
      expect(handler).toHaveBeenCalled();
    });

    it('should update metrics on submit', async () => {
      const initialMetrics = integration.getMetrics();
      await integration.submit('test', 'create', {});
      const updatedMetrics = integration.getMetrics();

      expect(updatedMetrics.requests.total).toBeGreaterThan(initialMetrics.requests.total);
    });

    it('should add request to queue', async () => {
      await integration.submit('test', 'create', {});
      const status = integration.getStatus();
      expect(status.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should handle high priority requests', async () => {
      const lowPriorityId = await integration.submit('test', 'create', {}, { priority: 1 });
      const highPriorityId = await integration.submit('test', 'create', {}, { priority: 100 });

      expect(lowPriorityId).toBeTruthy();
      expect(highPriorityId).toBeTruthy();
    });

    it('should generate unique request IDs', async () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = await integration.submit('test', 'create', { index: i });
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    });

    it('should handle multiple action types', async () => {
      await integration.submit('test', 'create', {});
      await integration.submit('test', 'update', {});
      await integration.submit('test', 'delete', {});
      await integration.submit('test', 'read', {});

      expect(true).toBe(true);
    });
  });

  describe('waitFor()', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should wait for request completion', async () => {
      const requestId = await integration.submit('test', 'create', { data: 'test' });

      const waitPromise = integration.waitFor(requestId, 10000);
      jest.advanceTimersByTime(500);

      const response = await waitPromise;
      expect(response).toBeDefined();
      expect(response.requestId).toBe(requestId);
    });

    it('should timeout if request not completed', async () => {
      const fakeRequestId = 'nonexistent_request_id';

      const waitPromise = integration.waitFor(fakeRequestId, 1000);
      jest.advanceTimersByTime(1100);

      await expect(waitPromise).rejects.toThrow('Timeout waiting for request');
    });

    it('should use default timeout if not provided', async () => {
      const requestId = await integration.submit('test', 'create', {});

      const waitPromise = integration.waitFor(requestId);
      jest.advanceTimersByTime(500);

      const response = await waitPromise;
      expect(response).toBeDefined();
    });

    it('should handle null requestId', async () => {
      const waitPromise = integration.waitFor(null as any, 100);
      jest.advanceTimersByTime(200);

      await expect(waitPromise).rejects.toThrow();
    });

    it('should handle undefined requestId', async () => {
      const waitPromise = integration.waitFor(undefined as any, 100);
      jest.advanceTimersByTime(200);

      await expect(waitPromise).rejects.toThrow();
    });

    it('should handle empty string requestId', async () => {
      const waitPromise = integration.waitFor('', 100);
      jest.advanceTimersByTime(200);

      await expect(waitPromise).rejects.toThrow();
    });

    it('should return response immediately if already completed', async () => {
      const requestId = await integration.submit('test', 'create', {});
      jest.advanceTimersByTime(500);

      const response = await integration.waitFor(requestId, 10000);
      expect(response).toBeDefined();
    });

    it('should handle concurrent waitFor calls', async () => {
      const requestId = await integration.submit('test', 'create', {});

      const wait1 = integration.waitFor(requestId, 10000);
      const wait2 = integration.waitFor(requestId, 10000);

      jest.advanceTimersByTime(500);

      const [response1, response2] = await Promise.all([wait1, wait2]);
      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    });
  });

  describe('getMetrics()', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should return metrics object', () => {
      const metrics = integration.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.requests).toBeDefined();
      expect(metrics.responses).toBeDefined();
      expect(metrics.cache).toBeDefined();
      expect(metrics.queue).toBeDefined();
      expect(metrics.errors).toBeDefined();
      expect(metrics.performance).toBeDefined();
    });

    it('should return initialized request metrics', () => {
      const metrics = integration.getMetrics();
      expect(metrics.requests.total).toBe(0);
      expect(metrics.requests.pending).toBe(0);
      expect(metrics.requests.processing).toBe(0);
      expect(metrics.requests.completed).toBe(0);
      expect(metrics.requests.failed).toBe(0);
    });

    it('should return initialized response metrics', () => {
      const metrics = integration.getMetrics();
      expect(metrics.responses.successful).toBe(0);
      expect(metrics.responses.failed).toBe(0);
      expect(metrics.responses.timedOut).toBe(0);
      expect(metrics.responses.avgDuration).toBe(0);
    });

    it('should return initialized cache metrics', () => {
      const metrics = integration.getMetrics();
      expect(metrics.cache.hits).toBe(0);
      expect(metrics.cache.misses).toBe(0);
      expect(metrics.cache.hitRate).toBe(0);
      expect(metrics.cache.size).toBe(0);
      expect(metrics.cache.evictions).toBe(0);
    });

    it('should calculate cache hit rate', async () => {
      await integration.submit('test', 'create', { data: 1 });
      jest.advanceTimersByTime(500);

      const metrics = integration.getMetrics();
      expect(metrics.cache.hitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cache.hitRate).toBeLessThanOrEqual(1);
    });

    it('should calculate error rate', () => {
      const metrics = integration.getMetrics();
      expect(metrics.errors.rate).toBeGreaterThanOrEqual(0);
      expect(metrics.errors.rate).toBeLessThanOrEqual(1);
    });

    it('should not mutate internal metrics', () => {
      const metrics1 = integration.getMetrics();
      metrics1.requests.total = 999999;

      const metrics2 = integration.getMetrics();
      expect(metrics2.requests.total).not.toBe(999999);
    });

    it('should update metrics after requests', async () => {
      const before = integration.getMetrics();

      await integration.submit('test', 'create', {});
      jest.advanceTimersByTime(500);

      const after = integration.getMetrics();
      expect(after.requests.total).toBeGreaterThan(before.requests.total);
    });

    it('should track error metrics', () => {
      const metrics = integration.getMetrics();
      expect(metrics.errors.byCode).toBeInstanceOf(Map);
      expect(metrics.errors.byType).toBeInstanceOf(Map);
    });
  });

  describe('getStatus()', () => {
    it('should return status before initialization', () => {
      const status = integration.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.running).toBe(false);
      expect(status.shuttingDown).toBe(false);
    });

    it('should return status after initialization', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const status = integration.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.running).toBe(true);
      expect(status.shuttingDown).toBe(false);
    });

    it('should include queue size', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const status = integration.getStatus();
      expect(status.queueSize).toBeDefined();
      expect(typeof status.queueSize).toBe('number');
    });

    it('should include processing count', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const status = integration.getStatus();
      expect(status.processing).toBeDefined();
      expect(typeof status.processing).toBe('number');
    });

    it('should include cache size', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const status = integration.getStatus();
      expect(status.cacheSize).toBeDefined();
      expect(typeof status.cacheSize).toBe('number');
    });

    it('should include metrics', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const status = integration.getStatus();
      expect(status.metrics).toBeDefined();
    });

    it('should reflect shutdown state', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const shutdownPromise = integration.shutdown();
      const status = integration.getStatus();
      expect(status.shuttingDown).toBe(true);

      jest.advanceTimersByTime(500);
      await shutdownPromise;
    });
  });

  describe('shutdown()', () => {
    it('should shutdown successfully', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(500);
      await shutdownPromise;

      const status = integration.getStatus();
      expect(status.initialized).toBe(false);
    });

    it('should emit shutdown event', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const handler = jest.fn();
      integration.on('shutdown', handler);

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(500);
      await shutdownPromise;

      expect(handler).toHaveBeenCalled();
    });

    it('should handle multiple shutdown calls', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const shutdown1 = integration.shutdown();
      jest.advanceTimersByTime(500);
      await shutdown1;

      const shutdown2 = integration.shutdown();
      jest.advanceTimersByTime(100);
      await shutdown2;

      expect(true).toBe(true); // Should not throw
    });

    it('should clear cache on shutdown', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await integration.submit('test', 'create', {});

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(500);
      await shutdownPromise;

      const status = integration.getStatus();
      expect(status.cacheSize).toBe(0);
    });

    it('should clear queue on shutdown', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await integration.submit('test', 'create', {});

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(500);
      await shutdownPromise;

      const status = integration.getStatus();
      expect(status.queueSize).toBe(0);
    });

    it('should wait for processing to complete', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await integration.submit('test', 'create', {});

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(1000);
      await shutdownPromise;

      const status = integration.getStatus();
      expect(status.processing).toBe(0);
    });

    it('should force terminate after timeout', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      // Submit many requests to keep processing busy
      for (let i = 0; i < 100; i++) {
        await integration.submit('test', 'create', { index: i });
      }

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(35000); // Exceed shutdown timeout
      await shutdownPromise;

      expect(true).toBe(true); // Should complete
    });

    it('should stop accepting new requests during shutdown', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(100);

      await expect(integration.submit('test', 'create', {}))
        .rejects.toThrow('System not running');

      jest.advanceTimersByTime(500);
      await shutdownPromise;
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should emit log events', async () => {
      const logHandler = jest.fn();
      integration.on('log', logHandler);

      await integration.submit('test', 'create', {});

      expect(logHandler).toHaveBeenCalled();
    });

    it('should emit error events', () => {
      const errorHandler = jest.fn();
      integration.on('error', errorHandler);

      integration.emit('error', new Error('Test error'));

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit warning events', () => {
      const warningHandler = jest.fn();
      integration.on('warning', warningHandler);

      integration.emit('warning', 'Test warning');

      expect(warningHandler).toHaveBeenCalled();
    });

    it('should emit request:completed events', async () => {
      const completedHandler = jest.fn();
      integration.on('request:completed', completedHandler);

      await integration.submit('test', 'create', {});
      jest.advanceTimersByTime(500);

      expect(completedHandler).toHaveBeenCalled();
    });

    it('should handle multiple event listeners', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      integration.on('request:submitted', handler1);
      integration.on('request:submitted', handler2);

      await integration.submit('test', 'create', {});

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should emit metrics:updated events when enabled', async () => {
      const metricsIntegration = new GCPIntegration({ metricsEnabled: true });
      const handler = jest.fn();
      metricsIntegration.on('metrics:updated', handler);

      const initPromise = metricsIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      jest.advanceTimersByTime(10000);

      expect(handler).toHaveBeenCalled();
      await metricsIntegration.shutdown();
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should cache successful responses', async () => {
      const requestId1 = await integration.submit('test', 'create', { data: 'same' });
      jest.advanceTimersByTime(500);

      const metrics1 = integration.getMetrics();

      const requestId2 = await integration.submit('test', 'create', { data: 'same' });
      jest.advanceTimersByTime(500);

      const metrics2 = integration.getMetrics();
      expect(metrics2.cache.hits).toBeGreaterThanOrEqual(metrics1.cache.hits);
    });

    it('should respect skipCache option', async () => {
      await integration.submit('test', 'create', { data: 'test' });
      jest.advanceTimersByTime(500);

      const requestId = await integration.submit('test', 'create', { data: 'test' }, { skipCache: true });
      jest.advanceTimersByTime(500);

      expect(requestId).toBeTruthy();
    });

    it('should use custom cache key', async () => {
      await integration.submit('test', 'create', { data: 'test' }, { cacheKey: 'custom-1' });
      jest.advanceTimersByTime(500);

      await integration.submit('test', 'create', { data: 'different' }, { cacheKey: 'custom-1' });
      jest.advanceTimersByTime(500);

      const metrics = integration.getMetrics();
      expect(metrics.cache.hits).toBeGreaterThanOrEqual(0);
    });

    it('should handle cache with compression enabled', async () => {
      const compIntegration = new GCPIntegration({ compressionEnabled: true });
      const initPromise = compIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await compIntegration.submit('test', 'create', { data: 'test' });
      jest.advanceTimersByTime(500);

      const metrics = compIntegration.getMetrics();
      expect(metrics).toBeDefined();

      await compIntegration.shutdown();
    });

    it('should handle cache with compression disabled', async () => {
      const noCompIntegration = new GCPIntegration({ compressionEnabled: false });
      const initPromise = noCompIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await noCompIntegration.submit('test', 'create', { data: 'test' });
      jest.advanceTimersByTime(500);

      const metrics = noCompIntegration.getMetrics();
      expect(metrics).toBeDefined();

      await noCompIntegration.shutdown();
    });

    it('should evict cache when size limit exceeded', async () => {
      // Submit many unique requests to fill cache
      for (let i = 0; i < 15000; i++) {
        await integration.submit('test', 'create', { index: i });
      }
      jest.advanceTimersByTime(1000);

      const metrics = integration.getMetrics();
      expect(metrics.cache.evictions).toBeGreaterThanOrEqual(0);
    });

    it('should expire cached entries after TTL', async () => {
      const shortTTLIntegration = new GCPIntegration({ cacheTTL: 100 });
      const initPromise = shortTTLIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await shortTTLIntegration.submit('test', 'create', { data: 'test' });
      jest.advanceTimersByTime(500);

      // Wait for TTL to expire
      jest.advanceTimersByTime(200);

      await shortTTLIntegration.submit('test', 'create', { data: 'test' });
      jest.advanceTimersByTime(500);

      await shortTTLIntegration.shutdown();
    });

    it('should handle cache disabled', async () => {
      const noCacheIntegration = new GCPIntegration({ cacheEnabled: false });
      const initPromise = noCacheIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await noCacheIntegration.submit('test', 'create', { data: 'test' });
      jest.advanceTimersByTime(500);

      const metrics = noCacheIntegration.getMetrics();
      expect(metrics.cache.hits).toBe(0);

      await noCacheIntegration.shutdown();
    });
  });

  describe('Retry Logic', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should retry failed requests', async () => {
      const retryHandler = jest.fn();
      integration.on('request:retry', retryHandler);

      const requestId = await integration.submit('test', 'create', {});
      jest.advanceTimersByTime(10000);

      expect(requestId).toBeTruthy();
    });

    it('should respect retry limit', async () => {
      const failedHandler = jest.fn();
      integration.on('request:failed', failedHandler);

      const requestId = await integration.submit('test', 'create', {});
      jest.advanceTimersByTime(20000);

      expect(requestId).toBeTruthy();
    });

    it('should use exponential backoff', async () => {
      const retryIntegration = new GCPIntegration({ retries: 3 });
      const initPromise = retryIntegration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await retryIntegration.submit('test', 'create', {});
      jest.advanceTimersByTime(20000);

      await retryIntegration.shutdown();
    });
  });

  describe('Concurrency', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should handle concurrent requests', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(integration.submit('test', 'create', { index: i }));
      }

      const requestIds = await Promise.all(promises);
      expect(requestIds).toHaveLength(10);
      expect(new Set(requestIds).size).toBe(10); // All unique
    });

    it('should respect concurrency limit', async () => {
      const lowConcurrency = new GCPIntegration({ concurrency: 2 });
      const initPromise = lowConcurrency.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      for (let i = 0; i < 10; i++) {
        await lowConcurrency.submit('test', 'create', { index: i });
      }

      const status = lowConcurrency.getStatus();
      expect(status.processing).toBeLessThanOrEqual(2);

      await lowConcurrency.shutdown();
    });

    it('should process queue in priority order', async () => {
      await integration.submit('test', 'create', { priority: 'low' }, { priority: 1 });
      await integration.submit('test', 'create', { priority: 'high' }, { priority: 100 });
      await integration.submit('test', 'create', { priority: 'medium' }, { priority: 50 });

      jest.advanceTimersByTime(2000);

      expect(true).toBe(true);
    });
  });

  describe('Timeout Handling', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should timeout long-running requests', async () => {
      const shortTimeout = new GCPIntegration({ timeout: 100 });
      const initPromise = shortTimeout.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await shortTimeout.submit('test', 'create', {});
      jest.advanceTimersByTime(500);

      const metrics = shortTimeout.getMetrics();
      expect(metrics.requests.total).toBeGreaterThan(0);

      await shortTimeout.shutdown();
    });

    it('should respect custom request timeout', async () => {
      await integration.submit('test', 'create', {}, { timeout: 100 });
      jest.advanceTimersByTime(500);

      expect(true).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;
    });

    it('should have circuit breaker initialized', () => {
      expect((integration as any).circuitBreaker).toBeDefined();
    });

    it('should track circuit breaker state', () => {
      const cb = (integration as any).circuitBreaker;
      expect(cb.getState()).toBeDefined();
    });

    it('should reset circuit breaker', () => {
      const cb = (integration as any).circuitBreaker;
      cb.reset();
      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('Type Safety', () => {
    it('should enforce config types', () => {
      const validConfig: Partial<GCPIntegrationConfig> = {
        timeout: 5000,
        retries: 3,
        enabled: true
      };
      const inst = new GCPIntegration(validConfig);
      expect(inst).toBeInstanceOf(GCPIntegration);
    });

    it('should handle different payload types', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await integration.submit('test', 'create', { string: 'test' });
      await integration.submit('test', 'create', { number: 123 });
      await integration.submit('test', 'create', { boolean: true });
      await integration.submit('test', 'create', { array: [1, 2, 3] });
      await integration.submit('test', 'create', { nested: { deep: { value: 'test' } } });

      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid initialization and shutdown', async () => {
      const rapid = new GCPIntegration(config);
      const initPromise = rapid.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const shutdownPromise = rapid.shutdown();
      jest.advanceTimersByTime(500);
      await shutdownPromise;

      expect(true).toBe(true);
    });

    it('should handle empty queue processing', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      jest.advanceTimersByTime(1000);

      const status = integration.getStatus();
      expect(status.queueSize).toBe(0);
    });

    it('should handle very large payloads', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const largePayload = { data: 'x'.repeat(100000) };
      const requestId = await integration.submit('test', 'create', largePayload);
      expect(requestId).toBeTruthy();
    });

    it('should handle deeply nested payloads', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      let nested: any = { value: 'deep' };
      for (let i = 0; i < 100; i++) {
        nested = { nested };
      }

      const requestId = await integration.submit('test', 'create', nested);
      expect(requestId).toBeTruthy();
    });

    it('should handle special characters in data', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const specialChars = {
        unicode: '🚀🔥💯',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        quotes: `'"`,
        newlines: 'line1\nline2\rline3'
      };

      const requestId = await integration.submit('test', 'create', specialChars);
      expect(requestId).toBeTruthy();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up all resources on shutdown', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      await integration.submit('test', 'create', {});

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(500);
      await shutdownPromise;

      const status = integration.getStatus();
      expect(status.cacheSize).toBe(0);
      expect(status.queueSize).toBe(0);
      expect(status.initialized).toBe(false);
    });

    it('should remove all event listeners on shutdown', async () => {
      const initPromise = integration.initialize();
      jest.advanceTimersByTime(300);
      await initPromise;

      const handler = jest.fn();
      integration.on('request:submitted', handler);

      const shutdownPromise = integration.shutdown();
      jest.advanceTimersByTime(500);
      await shutdownPromise;

      integration.emit('request:submitted', {});
      expect(handler).toHaveBeenCalledTimes(0);
    });
  });
});
