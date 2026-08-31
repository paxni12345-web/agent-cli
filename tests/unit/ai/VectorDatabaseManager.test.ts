/**
 * Comprehensive Unit Tests for VectorDatabaseManager
 * Coverage: All public methods, edge cases, error conditions, async behavior, resource cleanup
 */

import {
  VectorDatabaseManager,
  VectorProvider,
  DistanceMetric,
  Vector,
  QueryResult,
  SearchOptions,
  RerankerConfig,
  HybridSearchResult,
  SparseVector,
  LocalVectorAdapter,
  PineconeAdapter,
  WeaviateAdapter,
  QdrantAdapter,
  MilvusAdapter,
  ChromaDBAdapter,
} from '../../../src/vector/VectorDatabaseManager';

// Mock dependencies
jest.mock('../../../src/vector/VectorDatabaseManager', () => {
  const actual = jest.requireActual('../../../src/vector/VectorDatabaseManager');
  return {
    ...actual,
    PineconeAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      sparseQuery: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      fetch: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue({
        totalVectors: 0,
        dimension: 1536,
        indexSize: 0,
        namespaces: [],
      }),
      supportsHybrid: jest.fn().mockReturnValue(true),
    })),
  };
});

describe('VectorDatabaseManager', () => {
  let manager: VectorDatabaseManager;

  beforeEach(() => {
    manager = new VectorDatabaseManager();
  });

  afterEach(async () => {
    // Cleanup all stores
    const stores = manager.listStores();
    for (const storeName of stores) {
      try {
        await manager.deleteStore(storeName);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      expect(manager).toBeInstanceOf(VectorDatabaseManager);
    });

    it('should create instance with custom config', () => {
      const customManager = new VectorDatabaseManager({
        defaultProvider: 'pinecone',
        defaultDimension: 768,
        defaultMetric: 'euclidean',
        enableHybridSearch: false,
      });
      expect(customManager).toBeInstanceOf(VectorDatabaseManager);
    });

    it('should handle partial config', () => {
      const customManager = new VectorDatabaseManager({
        defaultDimension: 512,
      });
      expect(customManager).toBeInstanceOf(VectorDatabaseManager);
    });

    it('should handle empty config object', () => {
      const customManager = new VectorDatabaseManager({});
      expect(customManager).toBeInstanceOf(VectorDatabaseManager);
    });
  });

  describe('createStore', () => {
    it('should create local store', async () => {
      const store = await manager.createStore('test-store', 'local');

      expect(store).toBeDefined();
      expect(store.name).toBe('test-store');
      expect(store.provider).toBe('local');
      expect(store.initialized).toBe(true);
    });

    it('should create store with custom options', async () => {
      const store = await manager.createStore('test-store', 'local', {
        dimension: 768,
        metric: 'euclidean',
      });

      expect(store.dimension).toBe(768);
      expect(store.metric).toBe('euclidean');
    });

    it('should emit store:create:start event', async () => {
      const listener = jest.fn();
      manager.on('store:create:start', listener);

      await manager.createStore('test-store', 'local');

      expect(listener).toHaveBeenCalledWith({
        name: 'test-store',
        provider: 'local',
      });
    });

    it('should emit store:created event', async () => {
      const listener = jest.fn();
      manager.on('store:created', listener);

      await manager.createStore('test-store', 'local');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          store: expect.objectContaining({
            name: 'test-store',
            provider: 'local',
          }),
        })
      );
    });

    it('should handle null name', async () => {
      await expect(
        manager.createStore(null as any, 'local')
      ).rejects.toThrow();
    });

    it('should handle undefined name', async () => {
      await expect(
        manager.createStore(undefined as any, 'local')
      ).rejects.toThrow();
    });

    it('should handle empty string name', async () => {
      const store = await manager.createStore('', 'local');
      expect(store.name).toBe('');
    });

    it('should handle unsupported provider', async () => {
      await expect(
        manager.createStore('test-store', 'unsupported' as VectorProvider)
      ).rejects.toThrow('Unsupported provider: unsupported');
    });

    it('should create multiple stores with different names', async () => {
      const store1 = await manager.createStore('store1', 'local');
      const store2 = await manager.createStore('store2', 'local');

      expect(store1.name).toBe('store1');
      expect(store2.name).toBe('store2');
      expect(manager.listStores()).toHaveLength(2);
    });

    it('should handle concurrent store creation', async () => {
      const promises = [
        manager.createStore('store1', 'local'),
        manager.createStore('store2', 'local'),
        manager.createStore('store3', 'local'),
      ];

      const stores = await Promise.all(promises);
      expect(stores).toHaveLength(3);
      expect(manager.listStores()).toHaveLength(3);
    });
  });

  describe('deleteStore', () => {
    it('should delete existing store', async () => {
      await manager.createStore('test-store', 'local');
      await manager.deleteStore('test-store');

      expect(manager.getStore('test-store')).toBeUndefined();
    });

    it('should emit store:deleted event', async () => {
      await manager.createStore('test-store', 'local');

      const listener = jest.fn();
      manager.on('store:deleted', listener);

      await manager.deleteStore('test-store');

      expect(listener).toHaveBeenCalledWith({ name: 'test-store' });
    });

    it('should throw error for non-existent store', async () => {
      await expect(manager.deleteStore('non-existent')).rejects.toThrow(
        'Store not found: non-existent'
      );
    });

    it('should handle null store name', async () => {
      await expect(manager.deleteStore(null as any)).rejects.toThrow();
    });

    it('should handle undefined store name', async () => {
      await expect(manager.deleteStore(undefined as any)).rejects.toThrow();
    });

    it('should handle empty string store name', async () => {
      await expect(manager.deleteStore('')).rejects.toThrow();
    });

    it('should cleanup adapter resources', async () => {
      await manager.createStore('test-store', 'local');
      const adapter = manager.getStore('test-store');
      const cleanupSpy = jest.spyOn(adapter!, 'cleanup');

      await manager.deleteStore('test-store');

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('getStore', () => {
    it('should get existing store', async () => {
      await manager.createStore('test-store', 'local');
      const store = manager.getStore('test-store');

      expect(store).toBeDefined();
    });

    it('should return undefined for non-existent store', () => {
      const store = manager.getStore('non-existent');
      expect(store).toBeUndefined();
    });

    it('should handle null store name', () => {
      const store = manager.getStore(null as any);
      expect(store).toBeUndefined();
    });

    it('should handle undefined store name', () => {
      const store = manager.getStore(undefined as any);
      expect(store).toBeUndefined();
    });

    it('should handle empty string', () => {
      const store = manager.getStore('');
      expect(store).toBeUndefined();
    });
  });

  describe('listStores', () => {
    it('should return empty array when no stores', () => {
      expect(manager.listStores()).toEqual([]);
    });

    it('should list all stores', async () => {
      await manager.createStore('store1', 'local');
      await manager.createStore('store2', 'local');

      const stores = manager.listStores();
      expect(stores).toHaveLength(2);
      expect(stores).toContain('store1');
      expect(stores).toContain('store2');
    });

    it('should return new array each time', async () => {
      await manager.createStore('store1', 'local');

      const list1 = manager.listStores();
      const list2 = manager.listStores();

      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);
    });
  });

  describe('upsert', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
    });

    it('should upsert vectors', async () => {
      const vectors: Vector[] = [
        { id: 'v1', values: [1, 2, 3] },
        { id: 'v2', values: [4, 5, 6] },
      ];

      await manager.upsert('test-store', vectors);

      const fetched = await manager.fetch('test-store', ['v1', 'v2']);
      expect(fetched).toHaveLength(2);
    });

    it('should emit upsert events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();

      manager.on('vectors:upsert:start', startListener);
      manager.on('vectors:upserted', completedListener);

      const vectors: Vector[] = [{ id: 'v1', values: [1, 2, 3] }];
      await manager.upsert('test-store', vectors);

      expect(startListener).toHaveBeenCalled();
      expect(completedListener).toHaveBeenCalled();
    });

    it('should throw error for non-existent store', async () => {
      await expect(
        manager.upsert('non-existent', [{ id: 'v1', values: [1, 2, 3] }])
      ).rejects.toThrow('Store not found: non-existent');
    });

    it('should handle empty vector array', async () => {
      await manager.upsert('test-store', []);
      const stores = manager.listStores();
      expect(stores).toContain('test-store');
    });

    it('should handle null vectors', async () => {
      await expect(
        manager.upsert('test-store', null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined vectors', async () => {
      await expect(
        manager.upsert('test-store', undefined as any)
      ).rejects.toThrow();
    });

    it('should upsert vectors with metadata', async () => {
      const vectors: Vector[] = [
        {
          id: 'v1',
          values: [1, 2, 3],
          metadata: { type: 'test', score: 0.95 },
        },
      ];

      await manager.upsert('test-store', vectors);
      const fetched = await manager.fetch('test-store', ['v1']);

      expect(fetched[0].metadata).toEqual({ type: 'test', score: 0.95 });
    });

    it('should upsert vectors with sparse values', async () => {
      const vectors: Vector[] = [
        {
          id: 'v1',
          values: [1, 2, 3],
          sparse: { indices: [0, 2], values: [0.5, 0.8] },
        },
      ];

      await manager.upsert('test-store', vectors);
      const fetched = await manager.fetch('test-store', ['v1']);

      expect(fetched[0].sparse).toBeDefined();
    });

    it('should handle concurrent upserts', async () => {
      const vectors1: Vector[] = [{ id: 'v1', values: [1, 2, 3] }];
      const vectors2: Vector[] = [{ id: 'v2', values: [4, 5, 6] }];

      await Promise.all([
        manager.upsert('test-store', vectors1),
        manager.upsert('test-store', vectors2),
      ]);

      const fetched = await manager.fetch('test-store', ['v1', 'v2']);
      expect(fetched).toHaveLength(2);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
      await manager.upsert('test-store', [
        { id: 'v1', values: [1, 0, 0], metadata: { type: 'a' } },
        { id: 'v2', values: [0, 1, 0], metadata: { type: 'b' } },
        { id: 'v3', values: [0, 0, 1], metadata: { type: 'a' } },
      ]);
    });

    it('should query vectors', async () => {
      const results = await manager.query('test-store', [1, 0, 0], { topK: 2 });

      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should emit query events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();

      manager.on('vectors:query:start', startListener);
      manager.on('vectors:queried', completedListener);

      await manager.query('test-store', [1, 0, 0], { topK: 2 });

      expect(startListener).toHaveBeenCalled();
      expect(completedListener).toHaveBeenCalled();
    });

    it('should throw error for non-existent store', async () => {
      await expect(
        manager.query('non-existent', [1, 0, 0], { topK: 2 })
      ).rejects.toThrow('Store not found: non-existent');
    });

    it('should handle empty query vector', async () => {
      const results = await manager.query('test-store', [], { topK: 2 });
      expect(results).toBeDefined();
    });

    it('should handle null query vector', async () => {
      await expect(
        manager.query('test-store', null as any, { topK: 2 })
      ).rejects.toThrow();
    });

    it('should handle undefined query vector', async () => {
      await expect(
        manager.query('test-store', undefined as any, { topK: 2 })
      ).rejects.toThrow();
    });

    it('should respect topK parameter', async () => {
      const results = await manager.query('test-store', [1, 0, 0], { topK: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should include vectors when requested', async () => {
      const results = await manager.query('test-store', [1, 0, 0], {
        topK: 2,
        includeVectors: true,
      });

      if (results.length > 0) {
        expect(results[0].vector).toBeDefined();
      }
    });

    it('should include metadata when requested', async () => {
      const results = await manager.query('test-store', [1, 0, 0], {
        topK: 2,
        includeMetadata: true,
      });

      if (results.length > 0) {
        expect(results[0].metadata).toBeDefined();
      }
    });

    it('should filter by minScore', async () => {
      const results = await manager.query('test-store', [1, 0, 0], {
        topK: 10,
        minScore: 0.9,
      });

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should handle zero topK', async () => {
      const results = await manager.query('test-store', [1, 0, 0], { topK: 0 });
      expect(results).toHaveLength(0);
    });

    it('should handle negative topK', async () => {
      const results = await manager.query('test-store', [1, 0, 0], { topK: -1 });
      expect(results).toBeDefined();
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
      await manager.upsert('test-store', [
        { id: 'v1', values: [1, 0, 0] },
        { id: 'v2', values: [0, 1, 0] },
      ]);
    });

    it('should delete vectors', async () => {
      await manager.delete('test-store', ['v1']);
      const fetched = await manager.fetch('test-store', ['v1']);

      expect(fetched).toHaveLength(0);
    });

    it('should emit delete event', async () => {
      const listener = jest.fn();
      manager.on('vectors:deleted', listener);

      await manager.delete('test-store', ['v1']);

      expect(listener).toHaveBeenCalled();
    });

    it('should throw error for non-existent store', async () => {
      await expect(
        manager.delete('non-existent', ['v1'])
      ).rejects.toThrow('Store not found: non-existent');
    });

    it('should handle empty id array', async () => {
      await manager.delete('test-store', []);
      const fetched = await manager.fetch('test-store', ['v1', 'v2']);
      expect(fetched).toHaveLength(2);
    });

    it('should handle null ids', async () => {
      await expect(
        manager.delete('test-store', null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined ids', async () => {
      await expect(
        manager.delete('test-store', undefined as any)
      ).rejects.toThrow();
    });

    it('should handle non-existent vector ids', async () => {
      await manager.delete('test-store', ['non-existent']);
      const fetched = await manager.fetch('test-store', ['v1', 'v2']);
      expect(fetched).toHaveLength(2);
    });

    it('should delete multiple vectors', async () => {
      await manager.delete('test-store', ['v1', 'v2']);
      const fetched = await manager.fetch('test-store', ['v1', 'v2']);

      expect(fetched).toHaveLength(0);
    });
  });

  describe('fetch', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
      await manager.upsert('test-store', [
        { id: 'v1', values: [1, 0, 0], metadata: { type: 'test' } },
        { id: 'v2', values: [0, 1, 0] },
      ]);
    });

    it('should fetch vectors by ids', async () => {
      const vectors = await manager.fetch('test-store', ['v1']);

      expect(vectors).toHaveLength(1);
      expect(vectors[0].id).toBe('v1');
    });

    it('should throw error for non-existent store', async () => {
      await expect(
        manager.fetch('non-existent', ['v1'])
      ).rejects.toThrow('Store not found: non-existent');
    });

    it('should handle empty id array', async () => {
      const vectors = await manager.fetch('test-store', []);
      expect(vectors).toHaveLength(0);
    });

    it('should handle null ids', async () => {
      await expect(
        manager.fetch('test-store', null as any)
      ).rejects.toThrow();
    });

    it('should handle undefined ids', async () => {
      await expect(
        manager.fetch('test-store', undefined as any)
      ).rejects.toThrow();
    });

    it('should fetch multiple vectors', async () => {
      const vectors = await manager.fetch('test-store', ['v1', 'v2']);
      expect(vectors).toHaveLength(2);
    });

    it('should handle non-existent ids gracefully', async () => {
      const vectors = await manager.fetch('test-store', ['v1', 'non-existent']);
      expect(vectors.length).toBeLessThanOrEqual(2);
    });

    it('should preserve metadata', async () => {
      const vectors = await manager.fetch('test-store', ['v1']);
      expect(vectors[0].metadata).toEqual({ type: 'test' });
    });
  });

  describe('hybridSearch', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
    });

    it('should throw error when hybrid search not supported', async () => {
      const denseQuery = [1, 0, 0];
      const sparseQuery: SparseVector = { indices: [0, 2], values: [0.5, 0.8] };

      await expect(
        manager.hybridSearch('test-store', denseQuery, sparseQuery, { topK: 5 })
      ).rejects.toThrow('does not support hybrid search');
    });

    it('should throw error for non-existent store', async () => {
      const denseQuery = [1, 0, 0];
      const sparseQuery: SparseVector = { indices: [0, 2], values: [0.5, 0.8] };

      await expect(
        manager.hybridSearch('non-existent', denseQuery, sparseQuery, { topK: 5 })
      ).rejects.toThrow('Store not found: non-existent');
    });

    it('should handle null dense query', async () => {
      const sparseQuery: SparseVector = { indices: [0, 2], values: [0.5, 0.8] };

      await expect(
        manager.hybridSearch('test-store', null as any, sparseQuery, { topK: 5 })
      ).rejects.toThrow();
    });

    it('should handle null sparse query', async () => {
      const denseQuery = [1, 0, 0];

      await expect(
        manager.hybridSearch('test-store', denseQuery, null as any, { topK: 5 })
      ).rejects.toThrow();
    });

    it('should handle undefined queries', async () => {
      await expect(
        manager.hybridSearch('test-store', undefined as any, undefined as any, { topK: 5 })
      ).rejects.toThrow();
    });
  });

  describe('rerank', () => {
    const mockResults: QueryResult[] = [
      { id: 'v1', score: 0.8 },
      { id: 'v2', score: 0.7 },
      { id: 'v3', score: 0.6 },
    ];

    it('should rerank results', async () => {
      const config: RerankerConfig = {
        model: 'rerank-english-v2.0',
        provider: 'cohere',
        topN: 2,
      };

      const reranked = await manager.rerank('test query', mockResults, config);

      expect(reranked).toBeDefined();
      expect(reranked.length).toBeLessThanOrEqual(config.topN);
    });

    it('should emit rerank events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();

      manager.on('rerank:start', startListener);
      manager.on('rerank:complete', completedListener);

      const config: RerankerConfig = {
        model: 'rerank-english-v2.0',
        provider: 'cohere',
        topN: 2,
      };

      await manager.rerank('test query', mockResults, config);

      expect(startListener).toHaveBeenCalled();
      expect(completedListener).toHaveBeenCalled();
    });

    it('should throw error for unsupported provider', async () => {
      const config: RerankerConfig = {
        model: 'test-model',
        provider: 'unsupported' as any,
        topN: 2,
      };

      await expect(
        manager.rerank('test query', mockResults, config)
      ).rejects.toThrow('Unsupported reranker');
    });

    it('should handle null query', async () => {
      const config: RerankerConfig = {
        model: 'test-model',
        provider: 'cohere',
        topN: 2,
      };

      await expect(
        manager.rerank(null as any, mockResults, config)
      ).rejects.toThrow();
    });

    it('should handle empty results', async () => {
      const config: RerankerConfig = {
        model: 'test-model',
        provider: 'cohere',
        topN: 2,
      };

      const reranked = await manager.rerank('test query', [], config);
      expect(reranked).toHaveLength(0);
    });

    it('should handle null results', async () => {
      const config: RerankerConfig = {
        model: 'test-model',
        provider: 'cohere',
        topN: 2,
      };

      await expect(
        manager.rerank('test query', null as any, config)
      ).rejects.toThrow();
    });

    it('should respect topN parameter', async () => {
      const config: RerankerConfig = {
        model: 'test-model',
        provider: 'cohere',
        topN: 1,
      };

      const reranked = await manager.rerank('test query', mockResults, config);
      expect(reranked.length).toBeLessThanOrEqual(1);
    });
  });

  describe('embed', () => {
    it('should embed single text', async () => {
      const embedding = await manager.embed('test text');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should embed multiple texts', async () => {
      const embeddings = await manager.embed(['text1', 'text2']);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
    });

    it('should emit embed events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();

      manager.on('embed:start', startListener);
      manager.on('embed:complete', completedListener);

      await manager.embed('test text');

      expect(startListener).toHaveBeenCalled();
      expect(completedListener).toHaveBeenCalled();
    });

    it('should throw error for unknown model', async () => {
      await expect(
        manager.embed('test text', 'unknown-model')
      ).rejects.toThrow('Embedding model not found');
    });

    it('should handle null text', async () => {
      await expect(manager.embed(null as any)).rejects.toThrow();
    });

    it('should handle undefined text', async () => {
      await expect(manager.embed(undefined as any)).rejects.toThrow();
    });

    it('should handle empty string', async () => {
      const embedding = await manager.embed('');
      expect(embedding).toBeDefined();
    });

    it('should handle empty array', async () => {
      const embeddings = await manager.embed([]);
      expect(embeddings).toBeDefined();
    });

    it('should use default model', async () => {
      const embedding = await manager.embed('test text');
      expect(embedding).toBeDefined();
    });

    it('should use custom model', async () => {
      const embedding = await manager.embed('test text', 'text-embedding-3-large');
      expect(embedding).toBeDefined();
    });
  });

  describe('batchUpsert', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
    });

    it('should batch upsert vectors', async () => {
      const vectors: Vector[] = Array.from({ length: 250 }, (_, i) => ({
        id: `v${i}`,
        values: [i, i, i],
      }));

      await manager.batchUpsert('test-store', vectors, 100);

      const fetched = await manager.fetch('test-store', ['v0', 'v100', 'v200']);
      expect(fetched.length).toBeGreaterThan(0);
    });

    it('should emit batch progress events', async () => {
      const listener = jest.fn();
      manager.on('batch:progress', listener);

      const vectors: Vector[] = Array.from({ length: 250 }, (_, i) => ({
        id: `v${i}`,
        values: [i, i, i],
      }));

      await manager.batchUpsert('test-store', vectors, 100);

      expect(listener).toHaveBeenCalled();
    });

    it('should throw error for non-existent store', async () => {
      await expect(
        manager.batchUpsert('non-existent', [{ id: 'v1', values: [1, 2, 3] }])
      ).rejects.toThrow('Store not found: non-existent');
    });

    it('should handle empty vector array', async () => {
      await manager.batchUpsert('test-store', []);
      expect(manager.listStores()).toContain('test-store');
    });

    it('should handle custom batch size', async () => {
      const vectors: Vector[] = Array.from({ length: 10 }, (_, i) => ({
        id: `v${i}`,
        values: [i, i, i],
      }));

      await manager.batchUpsert('test-store', vectors, 3);

      const fetched = await manager.fetch('test-store', ['v0', 'v5', 'v9']);
      expect(fetched.length).toBeGreaterThan(0);
    });

    it('should handle null vectors', async () => {
      await expect(
        manager.batchUpsert('test-store', null as any)
      ).rejects.toThrow();
    });
  });

  describe('batchQuery', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
      await manager.upsert('test-store', [
        { id: 'v1', values: [1, 0, 0] },
        { id: 'v2', values: [0, 1, 0] },
      ]);
    });

    it('should batch query vectors', async () => {
      const queries = [
        [1, 0, 0],
        [0, 1, 0],
      ];

      const results = await manager.batchQuery('test-store', queries, { topK: 2 });

      expect(results).toHaveLength(2);
      expect(Array.isArray(results[0])).toBe(true);
    });

    it('should throw error for non-existent store', async () => {
      await expect(
        manager.batchQuery('non-existent', [[1, 0, 0]], { topK: 2 })
      ).rejects.toThrow('Store not found: non-existent');
    });

    it('should handle empty queries array', async () => {
      const results = await manager.batchQuery('test-store', [], { topK: 2 });
      expect(results).toHaveLength(0);
    });

    it('should handle null queries', async () => {
      await expect(
        manager.batchQuery('test-store', null as any, { topK: 2 })
      ).rejects.toThrow();
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await manager.createStore('test-store', 'local');
    });

    it('should get store statistics', async () => {
      const stats = await manager.getStats('test-store');

      expect(stats).toBeDefined();
      expect(stats.totalVectors).toBeDefined();
      expect(stats.dimension).toBeDefined();
      expect(stats.indexSize).toBeDefined();
      expect(stats.namespaces).toBeDefined();
    });

    it('should throw error for non-existent store', async () => {
      await expect(manager.getStats('non-existent')).rejects.toThrow(
        'Store not found: non-existent'
      );
    });

    it('should handle null store name', async () => {
      await expect(manager.getStats(null as any)).rejects.toThrow();
    });

    it('should handle undefined store name', async () => {
      await expect(manager.getStats(undefined as any)).rejects.toThrow();
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup all stores on manager disposal', async () => {
      await manager.createStore('store1', 'local');
      await manager.createStore('store2', 'local');

      await manager.deleteStore('store1');
      await manager.deleteStore('store2');

      expect(manager.listStores()).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      await manager.createStore('test-store', 'local');
      const adapter = manager.getStore('test-store');

      jest.spyOn(adapter!, 'cleanup').mockRejectedValue(new Error('Cleanup failed'));

      await expect(manager.deleteStore('test-store')).rejects.toThrow('Cleanup failed');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle query timeout', async () => {
      await manager.createStore('test-store', 'local');
      const adapter = manager.getStore('test-store');

      jest.spyOn(adapter!, 'query').mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const timeoutPromise = Promise.race([
        manager.query('test-store', [1, 0, 0], { topK: 2 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      ]);

      await expect(timeoutPromise).rejects.toThrow('Timeout');
    });
  });

  describe('Type Safety', () => {
    it('should enforce VectorProvider type', async () => {
      const validProviders: VectorProvider[] = [
        'pinecone',
        'weaviate',
        'qdrant',
        'milvus',
        'chromadb',
        'local',
      ];

      for (const provider of validProviders) {
        const store = await manager.createStore(`store-${provider}`, provider);
        expect(store.provider).toBe(provider);
      }
    });

    it('should enforce DistanceMetric type', async () => {
      const validMetrics: DistanceMetric[] = [
        'cosine',
        'euclidean',
        'dot_product',
        'manhattan',
      ];

      for (const metric of validMetrics) {
        const store = await manager.createStore(`store-${metric}`, 'local', {
          metric,
        });
        expect(store.metric).toBe(metric);
      }
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent operations on same store', async () => {
      await manager.createStore('test-store', 'local');

      const operations = [
        manager.upsert('test-store', [{ id: 'v1', values: [1, 0, 0] }]),
        manager.upsert('test-store', [{ id: 'v2', values: [0, 1, 0] }]),
        manager.query('test-store', [1, 0, 0], { topK: 2 }),
        manager.fetch('test-store', ['v1']),
      ];

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it('should handle concurrent operations on different stores', async () => {
      await manager.createStore('store1', 'local');
      await manager.createStore('store2', 'local');

      const operations = [
        manager.upsert('store1', [{ id: 'v1', values: [1, 0, 0] }]),
        manager.upsert('store2', [{ id: 'v1', values: [0, 1, 0] }]),
        manager.query('store1', [1, 0, 0], { topK: 2 }),
        manager.query('store2', [0, 1, 0], { topK: 2 }),
      ];

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });
});
