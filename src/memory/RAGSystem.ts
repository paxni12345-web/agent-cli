/**
 * RAG System - Retrieval Augmented Generation
 * Combines semantic search with AI generation for better context
 */

import { SemanticMemory, SearchResult } from './VectorStore';
import { AIProvider } from '../providers/AIProvider';
import { ChatRequest, ChatMessage } from '../types';

export interface RAGConfig {
  topK: number; // Number of documents to retrieve
  similarityThreshold: number; // Minimum similarity score 0-1
  maxContextLength: number; // Max tokens in context
  reranking: boolean; // Use reranking
  hybridSearch: boolean; // Combine semantic + keyword
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
export class DocumentChunker {
  /**
   * Split document into fixed-size chunks with overlap
   */
  static fixedSize(
    text: string,
    chunkSize = 500,
    overlap = 50
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;

      if (start >= text.length - overlap) break;
    }

    return chunks;
  }

  /**
   * Split by sentences
   */
  static bySentence(text: string, maxChunkSize = 500): string[] {
    // Simple sentence splitting
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (currentChunk.length + trimmed.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmed;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmed;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Split by paragraphs
   */
  static byParagraph(text: string, maxChunkSize = 1000): string[] {
    const paragraphs = text
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (currentChunk.length + trimmed.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmed;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Semantic chunking (split at topic boundaries)
   */
  static semantic(text: string, maxChunkSize = 500): string[] {
    // Simple implementation: look for markdown headers or blank lines
    const sections = text.split(/\n#{1,6}\s+|\n\n/);
    return this.bySentence(sections.join('\n\n'), maxChunkSize);
  }
}

/**
 * Query expansion for better retrieval
 */
export class QueryExpander {
  /**
   * Expand query with synonyms and variations
   */
  static expand(query: string): string[] {
    const queries = [query];

    // Add variations
    const lower = query.toLowerCase();
    if (lower !== query) {
      queries.push(lower);
    }

    // Add question variations
    if (!query.includes('?')) {
      queries.push(`${query}?`);
    }

    // Remove common words for better matching
    const withoutCommon = query
      .replace(/\b(the|a|an|is|are|was|were|in|on|at|to|for)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (withoutCommon !== query && withoutCommon.length > 3) {
      queries.push(withoutCommon);
    }

    return queries;
  }
}

/**
 * Context compression - Reduce retrieved context to most relevant parts
 */
export class ContextCompressor {
  /**
   * Extract most relevant sentences from documents
   */
  static compress(
    documents: Document[],
    query: string,
    maxLength: number
  ): string {
    // Score each sentence by keyword overlap with query
    const queryWords = new Set(
      query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );

    interface ScoredSentence {
      text: string;
      score: number;
      docId: string;
    }

    const sentences: ScoredSentence[] = [];

    for (const doc of documents) {
      const docSentences = doc.content.split(/[.!?]+/);

      for (const sentence of docSentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 20) continue;

        const words = trimmed.toLowerCase().split(/\s+/);
        let score = 0;

        for (const word of words) {
          if (queryWords.has(word)) {
            score += 1;
          }
        }

        sentences.push({
          text: trimmed,
          score: score / words.length, // Normalize by length
          docId: doc.id,
        });
      }
    }

    // Sort by score
    sentences.sort((a, b) => b.score - a.score);

    // Build compressed context
    let context = '';
    let length = 0;

    for (const sent of sentences) {
      if (length + sent.text.length > maxLength) {
        break;
      }

      context += sent.text + '. ';
      length += sent.text.length;
    }

    return context;
  }
}

/**
 * RAG System implementation
 */
export class RAGSystem {
  private memory: SemanticMemory;
  private provider: AIProvider;
  private config: RAGConfig;

  constructor(
    memory: SemanticMemory,
    provider: AIProvider,
    config?: Partial<RAGConfig>
  ) {
    this.memory = memory;
    this.provider = provider;
    this.config = {
      topK: config?.topK ?? 5,
      similarityThreshold: config?.similarityThreshold ?? 0.5,
      maxContextLength: config?.maxContextLength ?? 4000,
      reranking: config?.reranking ?? false,
      hybridSearch: config?.hybridSearch ?? false,
    };
  }

  /**
   * Index documents into memory
   */
  async indexDocuments(
    documents: Document[],
    chunkingStrategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic' = 'sentence'
  ): Promise<number> {
    let totalChunks = 0;

    for (const doc of documents) {
      let chunks: string[];

      switch (chunkingStrategy) {
        case 'fixed':
          chunks = DocumentChunker.fixedSize(doc.content);
          break;
        case 'sentence':
          chunks = DocumentChunker.bySentence(doc.content);
          break;
        case 'paragraph':
          chunks = DocumentChunker.byParagraph(doc.content);
          break;
        case 'semantic':
          chunks = DocumentChunker.semantic(doc.content);
          break;
      }

      // Index each chunk
      for (let i = 0; i < chunks.length; i++) {
        await this.memory.remember(chunks[i], {
          documentId: doc.id,
          chunkIndex: i,
          totalChunks: chunks.length,
          source: doc.source,
          ...doc.metadata,
        });
        totalChunks++;
      }
    }

    return totalChunks;
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieve(query: string): Promise<RetrievalResult> {
    // Expand query
    const queries = QueryExpander.expand(query);

    // Search with all query variations
    const allResults: SearchResult[] = [];

    for (const q of queries) {
      const results = await this.memory.recall(q, this.config.topK);
      allResults.push(...results);
    }

    // Deduplicate by document ID
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of allResults) {
      const docId = result.metadata.documentId || result.id;
      if (!seen.has(docId)) {
        seen.add(docId);
        unique.push(result);
      }
    }

    // Filter by similarity threshold
    const filtered = unique.filter(
      (r) => r.score >= this.config.similarityThreshold
    );

    // Sort by score
    filtered.sort((a, b) => b.score - a.score);

    // Take top K
    const topResults = filtered.slice(0, this.config.topK);

    // Convert to documents
    const documents: Document[] = topResults.map((r) => ({
      id: r.metadata.documentId || r.id,
      content: r.text,
      metadata: r.metadata,
      source: r.metadata.source,
    }));

    return {
      documents,
      scores: topResults.map((r) => r.score),
      totalRetrieved: filtered.length,
      usedInContext: documents.length,
    };
  }

  /**
   * Generate answer using retrieved context
   */
  async query(
    question: string,
    systemPrompt?: string
  ): Promise<RAGResponse> {
    // Retrieve relevant documents
    const retrieval = await this.retrieve(question);

    if (retrieval.documents.length === 0) {
      return {
        answer:
          'I could not find relevant information to answer this question.',
        sources: [],
        retrieval,
        confidence: 0,
      };
    }

    // Build context from retrieved documents
    const context = ContextCompressor.compress(
      retrieval.documents,
      question,
      this.config.maxContextLength
    );

    // Build prompt with context
    const prompt = this.buildPrompt(question, context, retrieval.documents);

    // Generate answer
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.provider.chat({
      messages,
      systemPrompt:
        systemPrompt ||
        'You are a helpful assistant. Answer questions based on the provided context. If the context does not contain enough information, say so.',
      maxTokens: 1000,
    });

    // Calculate confidence based on retrieval scores
    const avgScore =
      retrieval.scores.reduce((sum, s) => sum + s, 0) /
      retrieval.scores.length;

    return {
      answer: response.content,
      sources: retrieval.documents,
      retrieval,
      confidence: avgScore,
    };
  }

  /**
   * Stream answer with retrieved context
   */
  async *queryStream(
    question: string,
    systemPrompt?: string
  ): AsyncIterable<string> {
    // Retrieve documents
    const retrieval = await this.retrieve(question);

    if (retrieval.documents.length === 0) {
      yield 'I could not find relevant information to answer this question.';
      return;
    }

    // Build context
    const context = ContextCompressor.compress(
      retrieval.documents,
      question,
      this.config.maxContextLength
    );

    const prompt = this.buildPrompt(question, context, retrieval.documents);

    const messages: ChatMessage[] = [
      { role: 'user', content: prompt },
    ];

    // Stream response
    const stream = this.provider.stream({
      messages,
      systemPrompt:
        systemPrompt || 'You are a helpful assistant. Answer based on context.',
      maxTokens: 1000,
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content;
      }
    }
  }

  private buildPrompt(
    question: string,
    context: string,
    sources: Document[]
  ): string {
    let prompt = `Context:\n${context}\n\n`;

    if (sources.length > 0) {
      prompt += `Sources:\n`;
      sources.forEach((doc, i) => {
        prompt += `[${i + 1}] ${doc.source || doc.id}\n`;
      });
      prompt += '\n';
    }

    prompt += `Question: ${question}\n\nAnswer based on the context above:`;

    return prompt;
  }

  /**
   * Clear all indexed documents
   */
  async clear(): Promise<void> {
    await this.memory.forgetAll();
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    config: RAGConfig;
  }> {
    return {
      totalDocuments: await this.memory.getCount(),
      config: this.config,
    };
  }
}
