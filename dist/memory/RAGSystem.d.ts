/**
 * RAG System - Retrieval Augmented Generation
 * Combines semantic search with AI generation for better context
 */
import { SemanticMemory } from './VectorStore';
import { AIProvider } from '../providers/AIProvider';
export interface RAGConfig {
    topK: number;
    similarityThreshold: number;
    maxContextLength: number;
    reranking: boolean;
    hybridSearch: boolean;
}
export interface Document {
    id: string;
    content: string;
    metadata: Record<string, any>;
    source?: string;
}
export interface RetrievalResult {
    documents: Document[];
    scores: number[];
    totalRetrieved: number;
    usedInContext: number;
}
export interface RAGResponse {
    answer: string;
    sources: Document[];
    retrieval: RetrievalResult;
    confidence: number;
}
/**
 * Chunking strategies for documents
 */
export declare class DocumentChunker {
    /**
     * Split document into fixed-size chunks with overlap
     */
    static fixedSize(text: string, chunkSize?: number, overlap?: number): string[];
    /**
     * Split by sentences
     */
    static bySentence(text: string, maxChunkSize?: number): string[];
    /**
     * Split by paragraphs
     */
    static byParagraph(text: string, maxChunkSize?: number): string[];
    /**
     * Semantic chunking (split at topic boundaries)
     */
    static semantic(text: string, maxChunkSize?: number): string[];
}
/**
 * Query expansion for better retrieval
 */
export declare class QueryExpander {
    /**
     * Expand query with synonyms and variations
     */
    static expand(query: string): string[];
}
/**
 * Context compression - Reduce retrieved context to most relevant parts
 */
export declare class ContextCompressor {
    /**
     * Extract most relevant sentences from documents
     */
    static compress(documents: Document[], query: string, maxLength: number): string;
}
/**
 * RAG System implementation
 */
export declare class RAGSystem {
    private memory;
    private provider;
    private config;
    constructor(memory: SemanticMemory, provider: AIProvider, config?: Partial<RAGConfig>);
    /**
     * Index documents into memory
     */
    indexDocuments(documents: Document[], chunkingStrategy?: 'fixed' | 'sentence' | 'paragraph' | 'semantic'): Promise<number>;
    /**
     * Retrieve relevant documents for a query
     */
    retrieve(query: string): Promise<RetrievalResult>;
    /**
     * Generate answer using retrieved context
     */
    query(question: string, systemPrompt?: string): Promise<RAGResponse>;
    /**
     * Stream answer with retrieved context
     */
    queryStream(question: string, systemPrompt?: string): AsyncIterable<string>;
    private buildPrompt;
    /**
     * Clear all indexed documents
     */
    clear(): Promise<void>;
    /**
     * Get statistics
     */
    getStats(): Promise<{
        totalDocuments: number;
        config: RAGConfig;
    }>;
}
//# sourceMappingURL=RAGSystem.d.ts.map