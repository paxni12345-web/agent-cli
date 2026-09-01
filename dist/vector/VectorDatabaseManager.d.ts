/**
 * Advanced Vector Database System
 * Multi-provider support: Pinecone, Weaviate, Qdrant, Milvus, ChromaDB
 * Hybrid search, reranking, multi-modal embeddings
 */
import { EventEmitter } from 'events';
export interface VectorStore {
    name: string;
    provider: VectorProvider;
    dimension: number;
    metric: DistanceMetric;
    initialized: boolean;
}
export type VectorProvider = 'pinecone' | 'weaviate' | 'qdrant' | 'milvus' | 'chromadb' | 'local';
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot_product' | 'manhattan';
export interface Vector {
    id: string;
    values: number[];
    metadata?: Record<string, any>;
    sparse?: SparseVector;
}
export interface SparseVector {
    indices: number[];
    values: number[];
}
export interface QueryResult {
    id: string;
    score: number;
    vector?: number[];
    metadata?: Record<string, any>;
}
export interface SearchOptions {
    topK: number;
    filter?: Record<string, any>;
    includeVectors?: boolean;
    includeMetadata?: boolean;
    minScore?: number;
    namespace?: string;
    hybrid?: boolean;
    alpha?: number;
}
export interface EmbeddingModel {
    name: string;
    provider: 'openai' | 'cohere' | 'huggingface' | 'local';
    dimension: number;
    maxTokens: number;
}
export interface HybridSearchResult {
    denseResults: QueryResult[];
    sparseResults: QueryResult[];
    fusedResults: QueryResult[];
    fusionMethod: 'rrf' | 'weighted' | 'convex';
}
export interface RerankerConfig {
    model: string;
    provider: 'cohere' | 'crossencoder' | 'custom';
    topN: number;
}
export declare class VectorDatabaseManager extends EventEmitter {
    private stores;
    private embeddings;
    private config;
    constructor(config?: Partial<VectorDBConfig>);
    createStore(name: string, provider: VectorProvider, options?: CreateStoreOptions): Promise<VectorStore>;
    private createAdapter;
    deleteStore(name: string): Promise<void>;
    getStore(name: string): VectorStoreAdapter | undefined;
    listStores(): string[];
    upsert(storeName: string, vectors: Vector[]): Promise<void>;
    query(storeName: string, query: number[], options: SearchOptions): Promise<QueryResult[]>;
    delete(storeName: string, ids: string[]): Promise<void>;
    fetch(storeName: string, ids: string[]): Promise<Vector[]>;
    hybridSearch(storeName: string, denseQuery: number[], sparseQuery: SparseVector, options: SearchOptions): Promise<HybridSearchResult>;
    private fuseResults;
    private reciprocalRankFusion;
    private weightedFusion;
    private convexFusion;
    rerank(query: string, results: QueryResult[], config: RerankerConfig): Promise<QueryResult[]>;
    private createReranker;
    embed(text: string | string[], model?: string): Promise<number[] | number[][]>;
    private createEmbedder;
    private initializeDefaultEmbeddings;
    batchUpsert(storeName: string, vectors: Vector[], batchSize?: number): Promise<void>;
    batchQuery(storeName: string, queries: number[][], options: SearchOptions): Promise<QueryResult[][]>;
    getStats(storeName: string): Promise<VectorStoreStats>;
    private getStoreOrThrow;
}
export interface VectorStoreAdapter {
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    upsert(vectors: Vector[]): Promise<void>;
    query(query: number[], options: SearchOptions): Promise<QueryResult[]>;
    sparseQuery(query: SparseVector, options: SearchOptions): Promise<QueryResult[]>;
    delete(ids: string[]): Promise<void>;
    fetch(ids: string[]): Promise<Vector[]>;
    getStats(): Promise<VectorStoreStats>;
    supportsHybrid(): boolean;
}
export interface VectorStoreStats {
    totalVectors: number;
    dimension: number;
    indexSize: number;
    namespaces: string[];
}
export declare class PineconeAdapter implements VectorStoreAdapter {
    private config;
    private client;
    constructor(config: CreateStoreOptions);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    upsert(vectors: Vector[]): Promise<void>;
    query(query: number[], options: SearchOptions): Promise<QueryResult[]>;
    sparseQuery(query: SparseVector, options: SearchOptions): Promise<QueryResult[]>;
    delete(ids: string[]): Promise<void>;
    fetch(ids: string[]): Promise<Vector[]>;
    getStats(): Promise<VectorStoreStats>;
    supportsHybrid(): boolean;
}
export declare class WeaviateAdapter implements VectorStoreAdapter {
    private config;
    private client;
    constructor(config: CreateStoreOptions);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    upsert(vectors: Vector[]): Promise<void>;
    query(query: number[], options: SearchOptions): Promise<QueryResult[]>;
    sparseQuery(query: SparseVector, options: SearchOptions): Promise<QueryResult[]>;
    delete(ids: string[]): Promise<void>;
    fetch(ids: string[]): Promise<Vector[]>;
    getStats(): Promise<VectorStoreStats>;
    supportsHybrid(): boolean;
}
export declare class QdrantAdapter implements VectorStoreAdapter {
    private config;
    constructor(config: CreateStoreOptions);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    upsert(vectors: Vector[]): Promise<void>;
    query(query: number[], options: SearchOptions): Promise<QueryResult[]>;
    sparseQuery(query: SparseVector, options: SearchOptions): Promise<QueryResult[]>;
    delete(ids: string[]): Promise<void>;
    fetch(ids: string[]): Promise<Vector[]>;
    getStats(): Promise<VectorStoreStats>;
    supportsHybrid(): boolean;
}
export declare class MilvusAdapter implements VectorStoreAdapter {
    private config;
    constructor(config: CreateStoreOptions);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    upsert(vectors: Vector[]): Promise<void>;
    query(query: number[], options: SearchOptions): Promise<QueryResult[]>;
    sparseQuery(query: SparseVector, options: SearchOptions): Promise<QueryResult[]>;
    delete(ids: string[]): Promise<void>;
    fetch(ids: string[]): Promise<Vector[]>;
    getStats(): Promise<VectorStoreStats>;
    supportsHybrid(): boolean;
}
export declare class ChromaDBAdapter implements VectorStoreAdapter {
    private config;
    constructor(config: CreateStoreOptions);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    upsert(vectors: Vector[]): Promise<void>;
    query(query: number[], options: SearchOptions): Promise<QueryResult[]>;
    sparseQuery(query: SparseVector, options: SearchOptions): Promise<QueryResult[]>;
    delete(ids: string[]): Promise<void>;
    fetch(ids: string[]): Promise<Vector[]>;
    getStats(): Promise<VectorStoreStats>;
    supportsHybrid(): boolean;
}
export declare class LocalVectorAdapter implements VectorStoreAdapter {
    private vectors;
    private config;
    constructor(config: CreateStoreOptions);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    upsert(vectors: Vector[]): Promise<void>;
    query(query: number[], options: SearchOptions): Promise<QueryResult[]>;
    sparseQuery(query: SparseVector, options: SearchOptions): Promise<QueryResult[]>;
    delete(ids: string[]): Promise<void>;
    fetch(ids: string[]): Promise<Vector[]>;
    getStats(): Promise<VectorStoreStats>;
    supportsHybrid(): boolean;
    private computeSimilarity;
    private cosineSimilarity;
    private euclideanDistance;
    private dotProduct;
}
interface VectorDBConfig {
    defaultProvider: VectorProvider;
    defaultDimension: number;
    defaultMetric: DistanceMetric;
    enableHybridSearch: boolean;
    enableReranking: boolean;
    cacheEmbeddings: boolean;
}
interface CreateStoreOptions {
    dimension?: number;
    metric?: DistanceMetric;
    indexName?: string;
    namespace?: string;
    apiKey?: string;
    endpoint?: string;
    [key: string]: any;
}
export default VectorDatabaseManager;
//# sourceMappingURL=VectorDatabaseManager.d.ts.map