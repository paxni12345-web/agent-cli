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

export class ContextManager extends EventEmitter {
  private contexts: Map<string, ContextWindow> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private compressionStrategy: CompressionStrategy;
  private cacheConfig: CacheConfig;
  private tokenCounter: (text: string) => number;

  constructor(
    compressionStrategy?: Partial<CompressionStrategy>,
    cacheConfig?: Partial<CacheConfig>
  ) {
    super();

    this.compressionStrategy = {
      type: 'adaptive',
      threshold: 0.8,
      preserveRecent: 10,
      preserveImportant: true,
      ...compressionStrategy
    };

    this.cacheConfig = {
      enabled: true,
      maxSize: 1000,
      ttl: 3600000, // 1 hour
      strategy: 'lru',
      ...cacheConfig
    };

    this.tokenCounter = (text: string) => Math.ceil(text.length / 4);
  }

  /**
   * Create new context window
   */
  public createContext(maxTokens: number = 1000000): string {
    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const context: ContextWindow = {
      id: contextId,
      maxTokens,
      currentTokens: 0,
      messages: [],
      metadata: {
        createdAt: new Date(),
        lastUpdated: new Date(),
        compressionRatio: 1.0,
        cacheHits: 0,
        cacheMisses: 0
      }
    };

    this.contexts.set(contextId, context);
    this.emit('context:created', context);
    return contextId;
  }

  /**
   * Add message to context
   */
  public async addMessage(
    contextId: string,
    role: 'system' | 'user' | 'assistant',
    content: string,
    priority: number = 1
  ): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    const tokens = this.tokenCounter(content);
    const message: ContextMessage = {
      id: `msg_${Date.now()}`,
      role,
      content,
      tokens,
      timestamp: new Date(),
      priority,
      compressed: false
    };

    // Check if we need to compress
    if (context.currentTokens + tokens > context.maxTokens * this.compressionStrategy.threshold) {
      await this.compressContext(contextId);
    }

    context.messages.push(message);
    context.currentTokens += tokens;
    context.metadata.lastUpdated = new Date();

    this.emit('message:added', { contextId, message });
  }

  /**
   * Compress context using configured strategy
   */
  public async compressContext(contextId: string): Promise<CompressionResult> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    const originalTokens = context.currentTokens;

    let result: CompressionResult;

    switch (this.compressionStrategy.type) {
      case 'sliding':
        result = await this.applySlidingWindow(context);
        break;
      case 'semantic':
        result = await this.applySemanticCompression(context);
        break;
      case 'hierarchical':
        result = await this.applyHierarchicalCompression(context);
        break;
      case 'adaptive':
        result = await this.applyAdaptiveCompression(context);
        break;
      default:
        result = await this.applySlidingWindow(context);
    }

    context.metadata.compressionRatio = result.ratio;
    context.metadata.lastUpdated = new Date();

    this.emit('context:compressed', { contextId, result });
    return result;
  }

  /**
   * Sliding window compression
   */
  private async applySlidingWindow(context: ContextWindow): Promise<CompressionResult> {
    const preserveCount = this.compressionStrategy.preserveRecent;
    const messages = context.messages;

    if (messages.length <= preserveCount) {
      return {
        originalTokens: context.currentTokens,
        compressedTokens: context.currentTokens,
        ratio: 1.0,
        strategy: 'sliding',
        preservedMessages: messages.length
      };
    }

    // Keep only recent messages
    const toRemove = messages.slice(0, messages.length - preserveCount);
    const toKeep = messages.slice(-preserveCount);

    const removedTokens = toRemove.reduce((sum, m) => sum + m.tokens, 0);

    context.messages = toKeep;
    context.currentTokens -= removedTokens;

    return {
      originalTokens: context.currentTokens + removedTokens,
      compressedTokens: context.currentTokens,
      ratio: context.currentTokens / (context.currentTokens + removedTokens),
      strategy: 'sliding',
      preservedMessages: toKeep.length
    };
  }

  /**
   * Semantic compression - summarize older messages
   */
  private async applySemanticCompression(context: ContextWindow): Promise<CompressionResult> {
    const preserveCount = this.compressionStrategy.preserveRecent;
    const messages = context.messages;

    if (messages.length <= preserveCount) {
      return {
        originalTokens: context.currentTokens,
        compressedTokens: context.currentTokens,
        ratio: 1.0,
        strategy: 'semantic',
        preservedMessages: messages.length
      };
    }

    const toCompress = messages.slice(0, messages.length - preserveCount);
    const toKeep = messages.slice(-preserveCount);

    // Summarize older messages
    const summary = await this.summarizeMessages(toCompress);
    const summaryTokens = this.tokenCounter(summary);

    const originalTokens = toCompress.reduce((sum, m) => sum + m.tokens, 0);

    // Create summary message
    const summaryMessage: ContextMessage = {
      id: `msg_summary_${Date.now()}`,
      role: 'system',
      content: `[Summary of ${toCompress.length} messages]: ${summary}`,
      tokens: summaryTokens,
      timestamp: new Date(),
      priority: 5,
      compressed: true
    };

    context.messages = [summaryMessage, ...toKeep];
    context.currentTokens = summaryTokens + toKeep.reduce((sum, m) => sum + m.tokens, 0);

    return {
      originalTokens: originalTokens + context.currentTokens - summaryTokens,
      compressedTokens: context.currentTokens,
      ratio: context.currentTokens / (originalTokens + context.currentTokens - summaryTokens),
      strategy: 'semantic',
      preservedMessages: context.messages.length
    };
  }

  /**
   * Hierarchical compression - multi-level summaries
   */
  private async applyHierarchicalCompression(context: ContextWindow): Promise<CompressionResult> {
    const messages = context.messages;
    const chunkSize = 10;
    const summaries: ContextMessage[] = [];

    let totalOriginalTokens = 0;
    let totalSummaryTokens = 0;

    // Create summaries for chunks
    for (let i = 0; i < messages.length - this.compressionStrategy.preserveRecent; i += chunkSize) {
      const chunk = messages.slice(i, Math.min(i + chunkSize, messages.length - this.compressionStrategy.preserveRecent));
      const summary = await this.summarizeMessages(chunk);
      const summaryTokens = this.tokenCounter(summary);

      totalOriginalTokens += chunk.reduce((sum, m) => sum + m.tokens, 0);
      totalSummaryTokens += summaryTokens;

      summaries.push({
        id: `msg_summary_${i}_${Date.now()}`,
        role: 'system',
        content: `[Level 1 Summary]: ${summary}`,
        tokens: summaryTokens,
        timestamp: new Date(),
        priority: 4,
        compressed: true
      });
    }

    // Keep recent messages
    const recentMessages = messages.slice(-this.compressionStrategy.preserveRecent);

    context.messages = [...summaries, ...recentMessages];
    context.currentTokens = totalSummaryTokens + recentMessages.reduce((sum, m) => sum + m.tokens, 0);

    return {
      originalTokens: totalOriginalTokens + context.currentTokens - totalSummaryTokens,
      compressedTokens: context.currentTokens,
      ratio: context.currentTokens / (totalOriginalTokens + context.currentTokens - totalSummaryTokens),
      strategy: 'hierarchical',
      preservedMessages: context.messages.length
    };
  }

  /**
   * Adaptive compression - choose best strategy based on context
   */
  private async applyAdaptiveCompression(context: ContextWindow): Promise<CompressionResult> {
    const messages = context.messages;
    const avgTokensPerMessage = context.currentTokens / messages.length;

    // If messages are short, use sliding window
    if (avgTokensPerMessage < 100) {
      return this.applySlidingWindow(context);
    }

    // If messages are long, use semantic compression
    if (avgTokensPerMessage > 500) {
      return this.applySemanticCompression(context);
    }

    // For medium messages, use hierarchical
    return this.applyHierarchicalCompression(context);
  }

  /**
   * Summarize messages
   */
  private async summarizeMessages(messages: ContextMessage[]): Promise<string> {
    // Simple extractive summarization
    const content = messages.map(m => m.content).join(' ');
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());

    // Take first and last sentences, and key sentences
    const keySentences = sentences.filter(s =>
      /important|key|critical|summary|conclusion/i.test(s)
    );

    const summary = [
      sentences[0],
      ...keySentences.slice(0, 2),
      sentences[sentences.length - 1]
    ].filter(Boolean).join('. ');

    return summary.substring(0, 500); // Limit summary length
  }

  /**
   * Cache context state
   */
  public cacheContext(contextId: string, key: string): void {
    if (!this.cacheConfig.enabled) return;

    const context = this.contexts.get(contextId);
    if (!context) return;

    // Evict old entries if cache is full
    if (this.cache.size >= this.cacheConfig.maxSize) {
      this.evictCache();
    }

    const entry: CacheEntry = {
      key,
      value: JSON.parse(JSON.stringify(context)), // Deep clone
      tokens: context.currentTokens,
      hits: 0,
      lastAccessed: new Date(),
      createdAt: new Date()
    };

    this.cache.set(key, entry);
    this.emit('cache:set', { key, tokens: entry.tokens });
  }

  /**
   * Retrieve from cache
   */
  public retrieveFromCache(key: string): ContextWindow | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.emit('cache:miss', { key });
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.createdAt.getTime();
    if (age > this.cacheConfig.ttl) {
      this.cache.delete(key);
      this.emit('cache:expired', { key });
      return null;
    }

    entry.hits++;
    entry.lastAccessed = new Date();
    this.emit('cache:hit', { key, hits: entry.hits });

    return entry.value;
  }

  /**
   * Evict cache entries based on strategy
   */
  private evictCache(): void {
    const entries = Array.from(this.cache.entries());

    if (entries.length === 0) return;

    let toEvict: string;

    switch (this.cacheConfig.strategy) {
      case 'lru':
        // Evict least recently used
        toEvict = entries.reduce((oldest, [key, entry]) =>
          entry.lastAccessed < this.cache.get(oldest)!.lastAccessed ? key : oldest,
          entries[0][0]
        );
        break;

      case 'lfu':
        // Evict least frequently used
        toEvict = entries.reduce((least, [key, entry]) =>
          entry.hits < this.cache.get(least)!.hits ? key : least,
          entries[0][0]
        );
        break;

      case 'adaptive':
        // Evict based on score (frequency / age)
        toEvict = entries.reduce((lowest, [key, entry]) => {
          const age = Date.now() - entry.createdAt.getTime();
          const score = entry.hits / (age / 1000);
          const lowestEntry = this.cache.get(lowest)!;
          const lowestAge = Date.now() - lowestEntry.createdAt.getTime();
          const lowestScore = lowestEntry.hits / (lowestAge / 1000);
          return score < lowestScore ? key : lowest;
        }, entries[0][0]);
        break;

      default:
        toEvict = entries[0][0];
    }

    this.cache.delete(toEvict);
    this.emit('cache:evicted', { key: toEvict });
  }

  /**
   * Get context statistics
   */
  public getContextStats(contextId: string): any {
    const context = this.contexts.get(contextId);
    if (!context) return null;

    return {
      id: context.id,
      maxTokens: context.maxTokens,
      currentTokens: context.currentTokens,
      utilization: (context.currentTokens / context.maxTokens * 100).toFixed(1) + '%',
      messageCount: context.messages.length,
      compressedMessages: context.messages.filter(m => m.compressed).length,
      compressionRatio: context.metadata.compressionRatio.toFixed(2),
      cacheHits: context.metadata.cacheHits,
      cacheMisses: context.metadata.cacheMisses,
      cacheHitRate: context.metadata.cacheHits + context.metadata.cacheMisses > 0
        ? (context.metadata.cacheHits / (context.metadata.cacheHits + context.metadata.cacheMisses) * 100).toFixed(1) + '%'
        : 'N/A'
    };
  }

  /**
   * Get all messages from context
   */
  public getMessages(contextId: string): ContextMessage[] {
    const context = this.contexts.get(contextId);
    return context ? [...context.messages] : [];
  }

  /**
   * Clear context
   */
  public clearContext(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.messages = [];
      context.currentTokens = 0;
      context.metadata.lastUpdated = new Date();
      this.emit('context:cleared', { contextId });
    }
  }

  /**
   * Delete context
   */
  public deleteContext(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (context) {
      this.contexts.delete(contextId);
      this.emit('context:deleted', { contextId });
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): any {
    const entries = Array.from(this.cache.values());

    return {
      enabled: this.cacheConfig.enabled,
      size: this.cache.size,
      maxSize: this.cacheConfig.maxSize,
      utilization: (this.cache.size / this.cacheConfig.maxSize * 100).toFixed(1) + '%',
      totalTokens: entries.reduce((sum, e) => sum + e.tokens, 0),
      totalHits: entries.reduce((sum, e) => sum + e.hits, 0),
      avgHits: entries.length > 0 ? entries.reduce((sum, e) => sum + e.hits, 0) / entries.length : 0,
      strategy: this.cacheConfig.strategy
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Export context
   */
  public exportContext(contextId: string): any {
    const context = this.contexts.get(contextId);
    return context ? JSON.stringify(context, null, 2) : null;
  }

  /**
   * Import context
   */
  public importContext(contextData: string): string {
    const context = JSON.parse(contextData) as ContextWindow;
    this.contexts.set(context.id, context);
    this.emit('context:imported', { contextId: context.id });
    return context.id;
  }

  /**
   * Optimize all contexts
   */
  public async optimizeAll(): Promise<void> {
    for (const contextId of this.contexts.keys()) {
      const context = this.contexts.get(contextId)!;
      if (context.currentTokens > context.maxTokens * this.compressionStrategy.threshold) {
        await this.compressContext(contextId);
      }
    }
    this.emit('contexts:optimized');
  }
}

export default ContextManager;
