"use strict";
/**
 * Vector Store - Semantic search and embedding storage
 * Supports multiple backends (in-memory, file-based, remote)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticMemory = exports.SimpleEmbeddingGenerator = exports.FileVectorStore = exports.InMemoryVectorStore = exports.VectorStore = void 0;
/**
 * Abstract vector store interface
 */
class VectorStore {
    config;
    constructor(config) {
        this.config = config;
    }
}
exports.VectorStore = VectorStore;
/**
 * In-memory vector store with cosine similarity search
 */
class InMemoryVectorStore extends VectorStore {
    vectors = new Map();
    async initialize() {
        // No initialization needed for in-memory
    }
    async insert(vector) {
        if (vector.embedding.length !== this.config.dimensions) {
            throw new Error(`Expected ${this.config.dimensions} dimensions, got ${vector.embedding.length}`);
        }
        this.vectors.set(vector.id, vector);
    }
    async insertBatch(vectors) {
        for (const vector of vectors) {
            await this.insert(vector);
        }
    }
    async search(query, topK, filter) {
        if (query.length !== this.config.dimensions) {
            throw new Error(`Query must have ${this.config.dimensions} dimensions`);
        }
        const results = [];
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
                if (!matches)
                    continue;
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
    async delete(id) {
        this.vectors.delete(id);
    }
    async clear() {
        this.vectors.clear();
    }
    async count() {
        return this.vectors.size;
    }
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0)
            return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
exports.InMemoryVectorStore = InMemoryVectorStore;
/**
 * File-based vector store with persistence
 */
class FileVectorStore extends InMemoryVectorStore {
    filePath;
    saveInterval = null;
    dirty = false;
    constructor(config, filePath) {
        super(config);
        this.filePath = filePath;
    }
    async initialize() {
        await this.load();
        // Auto-save every 30 seconds if dirty
        this.saveInterval = setInterval(async () => {
            if (this.dirty) {
                await this.save();
            }
        }, 30000);
    }
    async insert(vector) {
        await super.insert(vector);
        this.dirty = true;
    }
    async insertBatch(vectors) {
        await super.insertBatch(vectors);
        this.dirty = true;
    }
    async delete(id) {
        await super.delete(id);
        this.dirty = true;
    }
    async clear() {
        await super.clear();
        this.dirty = true;
    }
    async save() {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
        const data = {
            config: this.config,
            vectors: Array.from(this.vectors.entries()),
            savedAt: new Date().toISOString(),
        };
        await fs.writeFile(this.filePath, JSON.stringify(data), 'utf-8');
        this.dirty = false;
    }
    async load() {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const content = await fs.readFile(this.filePath, 'utf-8');
            const data = JSON.parse(content);
            this.vectors = new Map(data.vectors);
            this.dirty = false;
        }
        catch (error) {
            // File doesn't exist yet
        }
    }
    async close() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        if (this.dirty) {
            await this.save();
        }
    }
}
exports.FileVectorStore = FileVectorStore;
/**
 * Simple embedding generator using character frequencies
 * (In production, would use OpenAI, Cohere, or local model)
 */
class SimpleEmbeddingGenerator {
    dimensions = 384; // Standard embedding size
    async generate(text) {
        // Simple hashing-based embedding (not semantic!)
        // In production, use proper embedding model
        const embedding = new Array(this.dimensions).fill(0);
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const idx = (charCode * (i + 1)) % this.dimensions;
            embedding[idx] += 1;
        }
        // Normalize
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= norm;
            }
        }
        return embedding;
    }
    async generateBatch(texts) {
        return Promise.all(texts.map((text) => this.generate(text)));
    }
}
exports.SimpleEmbeddingGenerator = SimpleEmbeddingGenerator;
/**
 * Semantic memory system with vector search
 */
class SemanticMemory {
    store;
    embedder;
    constructor(store, embedder) {
        this.store = store;
        this.embedder = embedder;
    }
    async initialize() {
        await this.store.initialize();
    }
    /**
     * Add text to memory
     */
    async remember(text, metadata = {}) {
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
    async rememberBatch(items) {
        const ids = [];
        const vectors = [];
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
    async recall(query, topK = 5, filter) {
        const queryEmbedding = await this.embedder.generate(query);
        return this.store.search(queryEmbedding, topK, filter);
    }
    /**
     * Forget a memory
     */
    async forget(id) {
        await this.store.delete(id);
    }
    /**
     * Clear all memories
     */
    async forgetAll() {
        await this.store.clear();
    }
    /**
     * Get memory count
     */
    async getCount() {
        return this.store.count();
    }
}
exports.SemanticMemory = SemanticMemory;
