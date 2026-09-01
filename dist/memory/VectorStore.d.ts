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
    score: number;
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
export declare abstract class VectorStore {
    protected config: VectorStoreConfig;
    constructor(config: VectorStoreConfig);
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
export declare class InMemoryVectorStore extends VectorStore {
    private vectors;
    initialize(): Promise<void>;
    insert(vector: Vector): Promise<void>;
    insertBatch(vectors: Vector[]): Promise<void>;
    search(query: number[], topK: number, filter?: Record<string, any>): Promise<SearchResult[]>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
    count(): Promise<number>;
    private cosineSimilarity;
}
/**
 * File-based vector store with persistence
 */
export declare class FileVectorStore extends InMemoryVectorStore {
    private filePath;
    private saveInterval;
    private dirty;
    constructor(config: VectorStoreConfig, filePath: string);
    initialize(): Promise<void>;
    insert(vector: Vector): Promise<void>;
    insertBatch(vectors: Vector[]): Promise<void>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
    save(): Promise<void>;
    load(): Promise<void>;
    close(): Promise<void>;
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
export declare class SimpleEmbeddingGenerator implements EmbeddingGenerator {
    dimensions: number;
    generate(text: string): Promise<number[]>;
    generateBatch(texts: string[]): Promise<number[][]>;
}
/**
 * Semantic memory system with vector search
 */
export declare class SemanticMemory {
    private store;
    private embedder;
    constructor(store: VectorStore, embedder: EmbeddingGenerator);
    initialize(): Promise<void>;
    /**
     * Add text to memory
     */
    remember(text: string, metadata?: Record<string, any>): Promise<string>;
    /**
     * Add multiple texts in batch
     */
    rememberBatch(items: Array<{
        text: string;
        metadata?: Record<string, any>;
    }>): Promise<string[]>;
    /**
     * Semantic search
     */
    recall(query: string, topK?: number, filter?: Record<string, any>): Promise<SearchResult[]>;
    /**
     * Forget a memory
     */
    forget(id: string): Promise<void>;
    /**
     * Clear all memories
     */
    forgetAll(): Promise<void>;
    /**
     * Get memory count
     */
    getCount(): Promise<number>;
}
//# sourceMappingURL=VectorStore.d.ts.map