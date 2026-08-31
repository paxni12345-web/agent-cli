/**
 * Vector Store - Semantic search and embedding storage
 * Supports multiple backends (in-memory, file-based, remote)
 */

export interface Vector {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  text: string;
  timestamp: Date;
}

export interface SearchResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number; // Similarity score 0-1
}

export interface VectorStoreConfig {
  dimensions: number;
  backend: 'memory' | 'file' | 'pinecone' | 'weaviate';
  apiKey?: string;
  endpoint?: string;
  index?: string;
}

/**
 * Abstract vector store interface
 */
export abstract class VectorStore {
  protected config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract insert(vector: Vector): Promise<void>;
  abstract insertBatch(vectors: Vector[]): Promise<void>;
  abstract search(query: number[], topK: number, filter?: Record<string, any>): Promise<SearchResult[]>;
  abstract delete(id: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract count(): Promise<number>;
}

/**
 * In-memory vector store with cosine similarity search
 */
export class InMemoryVectorStore extends VectorStore {
  private vectors: Map<string, Vector> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed for in-memory
  }

  async insert(vector: Vector): Promise<void> {
    if (vector.embedding.length !== this.config.dimensions) {
      throw new Error(
        `Expected ${this.config.dimensions} dimensions, got ${vector.embedding.length}`
      );
    }
    this.vectors.set(vector.id, vector);
  }

  async insertBatch(vectors: Vector[]): Promise<void> {
    for (const vector of vectors) {
      await this.insert(vector);
    }
  }

  async search(
    query: number[],
    topK: number,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    if (query.length !== this.config.dimensions) {
      throw new Error(
        `Query must have ${this.config.dimensions} dimensions`
      );
    }

    const results: Array<{ vector: Vector; score: number }> = [];

    for (const vector of this.vectors.values()) {
      // Apply filter if provided
      if (filter) {
        let matches = true;
        for (const [key, value] of Object.entries(filter)) {
          if (vector.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      const score = this.cosineSimilarity(query, vector.embedding);
      results.push({ vector, score });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top K
    return results.slice(0, topK).map((r) => ({
      id: r.vector.id,
      text: r.vector.text,
      metadata: r.vector.metadata,
      score: r.score,
    }));
  }

  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async clear(): Promise<void> {
    this.vectors.clear();
  }

  async count(): Promise<number> {
    return this.vectors.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

/**
 * File-based vector store with persistence
 */
export class FileVectorStore extends InMemoryVectorStore {
  private filePath: string;
  private saveInterval: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(config: VectorStoreConfig, filePath: string) {
    super(config);
    this.filePath = filePath;
  }

  async initialize(): Promise<void> {
    await this.load();

    // Auto-save every 30 seconds if dirty
    this.saveInterval = setInterval(async () => {
      if (this.dirty) {
        await this.save();
      }
    }, 30000);
  }

  async insert(vector: Vector): Promise<void> {
    await super.insert(vector);
    this.dirty = true;
  }

  async insertBatch(vectors: Vector[]): Promise<void> {
    await super.insertBatch(vectors);
    this.dirty = true;
  }

  async delete(id: string): Promise<void> {
    await super.delete(id);
    this.dirty = true;
  }

  async clear(): Promise<void> {
    await super.clear();
    this.dirty = true;
  }

  async save(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const data = {
      config: this.config,
      vectors: Array.from((this as any).vectors.entries()),
      savedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.filePath, JSON.stringify(data), 'utf-8');
    this.dirty = false;
  }

  async load(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);

      (this as any).vectors = new Map(data.vectors);
      this.dirty = false;
    } catch (error) {
      // File doesn't exist yet
    }
  }

  async close(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    if (this.dirty) {
      await this.save();
    }
  }
}

/**
 * Embedding generator interface
 */
export interface EmbeddingGenerator {
  generate(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

/**
 * Simple embedding generator using character frequencies
 * (In production, would use OpenAI, Cohere, or local model)
 */
export class SimpleEmbeddingGenerator implements EmbeddingGenerator {
  dimensions = 384; // Standard embedding size

  async generate(text: string): Promise<number[]> {
    // Simple hashing-based embedding (not semantic!)
    // In production, use proper embedding model
    const embedding = new Array(this.dimensions).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const idx = (charCode * (i + 1)) % this.dimensions;
      embedding[idx] += 1;
    }

    // Normalize
    const norm = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.generate(text)));
  }
}

/**
 * Semantic memory system with vector search
 */
export class SemanticMemory {
  private store: VectorStore;
  private embedder: EmbeddingGenerator;

  constructor(store: VectorStore, embedder: EmbeddingGenerator) {
    this.store = store;
    this.embedder = embedder;
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  /**
   * Add text to memory
   */
  async remember(
    text: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const embedding = await this.embedder.generate(text);

    await this.store.insert({
      id,
      embedding,
      text,
      metadata,
      timestamp: new Date(),
    });

    return id;
  }

  /**
   * Add multiple texts in batch
   */
  async rememberBatch(
    items: Array<{ text: string; metadata?: Record<string, any> }>
  ): Promise<string[]> {
    const ids: string[] = [];
    const vectors: Vector[] = [];

    const texts = items.map((item) => item.text);
    const embeddings = await this.embedder.generateBatch(texts);

    for (let i = 0; i < items.length; i++) {
      const id = `mem_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
      ids.push(id);

      vectors.push({
        id,
        embedding: embeddings[i],
        text: items[i].text,
        metadata: items[i].metadata || {},
        timestamp: new Date(),
      });
    }

    await this.store.insertBatch(vectors);
    return ids;
  }

  /**
   * Semantic search
   */
  async recall(
    query: string,
    topK = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.embedder.generate(query);
    return this.store.search(queryEmbedding, topK, filter);
  }

  /**
   * Forget a memory
   */
  async forget(id: string): Promise<void> {
    await this.store.delete(id);
  }

  /**
   * Clear all memories
   */
  async forgetAll(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Get memory count
   */
  async getCount(): Promise<number> {
    return this.store.count();
  }
}
