/**
 * ContextManagement - Long-context handling and optimization
 * Manages 1M+ token contexts with compression and caching
 */
import { EventEmitter } from 'events';
export interface ContextWindow {
    id: string;
    maxTokens: number;
    currentTokens: number;
    messages: ContextMessage[];
    metadata: ContextMetadata;
}
export interface ContextMessage {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    tokens: number;
    timestamp: Date;
    priority: number;
    compressed: boolean;
}
export interface ContextMetadata {
    createdAt: Date;
    lastUpdated: Date;
    compressionRatio: number;
    cacheHits: number;
    cacheMisses: number;
}
export interface CompressionStrategy {
    type: 'sliding' | 'semantic' | 'hierarchical' | 'adaptive';
    threshold: number;
    preserveRecent: number;
    preserveImportant: boolean;
}
export interface CompressionResult {
    originalTokens: number;
    compressedTokens: number;
    ratio: number;
    strategy: string;
    preservedMessages: number;
}
export interface CacheConfig {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    strategy: 'lru' | 'lfu' | 'adaptive';
}
export interface CacheEntry {
    key: string;
    value: any;
    tokens: number;
    hits: number;
    lastAccessed: Date;
    createdAt: Date;
}
export declare class ContextManager extends EventEmitter {
    private contexts;
    private cache;
    private compressionStrategy;
    private cacheConfig;
    private tokenCounter;
    constructor(compressionStrategy?: Partial<CompressionStrategy>, cacheConfig?: Partial<CacheConfig>);
    /**
     * Create new context window
     */
    createContext(maxTokens?: number): string;
    /**
     * Add message to context
     */
    addMessage(contextId: string, role: 'system' | 'user' | 'assistant', content: string, priority?: number): Promise<void>;
    /**
     * Compress context using configured strategy
     */
    compressContext(contextId: string): Promise<CompressionResult>;
    /**
     * Sliding window compression
     */
    private applySlidingWindow;
    /**
     * Semantic compression - summarize older messages
     */
    private applySemanticCompression;
    /**
     * Hierarchical compression - multi-level summaries
     */
    private applyHierarchicalCompression;
    /**
     * Adaptive compression - choose best strategy based on context
     */
    private applyAdaptiveCompression;
    /**
     * Summarize messages
     */
    private summarizeMessages;
    /**
     * Cache context state
     */
    cacheContext(contextId: string, key: string): void;
    /**
     * Retrieve from cache
     */
    retrieveFromCache(key: string): ContextWindow | null;
    /**
     * Evict cache entries based on strategy
     */
    private evictCache;
    /**
     * Get context statistics
     */
    getContextStats(contextId: string): any;
    /**
     * Get all messages from context
     */
    getMessages(contextId: string): ContextMessage[];
    /**
     * Clear context
     */
    clearContext(contextId: string): void;
    /**
     * Delete context
     */
    deleteContext(contextId: string): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): any;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Export context
     */
    exportContext(contextId: string): any;
    /**
     * Import context
     */
    importContext(contextData: string): string;
    /**
     * Optimize all contexts
     */
    optimizeAll(): Promise<void>;
}
export default ContextManager;
//# sourceMappingURL=ContextManagement.d.ts.map