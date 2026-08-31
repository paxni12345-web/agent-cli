/**
 * Natural Language Processing System
 * Text analysis, sentiment analysis, entity extraction, language detection, and text generation
 */

import { eventBus } from '../core/EventBus';

export interface TextDocument {
  id: string;
  text: string;
  language?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface SentimentAnalysis {
  documentId: string;
  sentiment: Sentiment;
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  emotions: EmotionScores;
  analyzedAt: Date;
}

export enum Sentiment {
  Positive = 'positive',
  Negative = 'negative',
  Neutral = 'neutral',
  Mixed = 'mixed',
}

export interface EmotionScores {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
}

export interface Entity {
  text: string;
  type: EntityType;
  start: number;
  end: number;
  confidence: number;
  metadata?: Record<string, any>;
}

export enum EntityType {
  Person = 'person',
  Organization = 'organization',
  Location = 'location',
  Date = 'date',
  Time = 'time',
  Money = 'money',
  Percentage = 'percentage',
  Email = 'email',
  Phone = 'phone',
  URL = 'url',
}

export interface EntityExtraction {
  documentId: string;
  entities: Entity[];
  extractedAt: Date;
}

export interface KeyPhrase {
  text: string;
  score: number;
  frequency: number;
}

export interface KeyPhraseExtraction {
  documentId: string;
  phrases: KeyPhrase[];
  extractedAt: Date;
}

export interface LanguageDetection {
  documentId: string;
  language: string;
  confidence: number;
  alternativeLanguages: LanguageScore[];
  detectedAt: Date;
}

export interface LanguageScore {
  language: string;
  score: number;
}

export interface TextClassification {
  documentId: string;
  categories: Category[];
  classifiedAt: Date;
}

export interface Category {
  name: string;
  score: number;
  confidence: number;
}

export interface TextSummary {
  documentId: string;
  summary: string;
  method: SummaryMethod;
  compressionRatio: number;
  createdAt: Date;
}

export enum SummaryMethod {
  Extractive = 'extractive',
  Abstractive = 'abstractive',
}

export interface Token {
  text: string;
  lemma: string;
  pos: PartOfSpeech;
  tag: string;
  start: number;
  end: number;
}

export enum PartOfSpeech {
  Noun = 'noun',
  Verb = 'verb',
  Adjective = 'adjective',
  Adverb = 'adverb',
  Pronoun = 'pronoun',
  Preposition = 'preposition',
  Conjunction = 'conjunction',
  Interjection = 'interjection',
  Determiner = 'determiner',
}

export interface Tokenization {
  documentId: string;
  tokens: Token[];
  sentences: string[];
  tokenizedAt: Date;
}

export interface SimilarityScore {
  document1Id: string;
  document2Id: string;
  score: number; // 0 to 1
  method: SimilarityMethod;
  calculatedAt: Date;
}

export enum SimilarityMethod {
  Cosine = 'cosine',
  Jaccard = 'jaccard',
  Levenshtein = 'levenshtein',
}

export interface TextGeneration {
  id: string;
  prompt: string;
  generatedText: string;
  model: string;
  temperature: number;
  maxTokens: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Translation {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  createdAt: Date;
}

export interface SpellCheck {
  documentId: string;
  corrections: SpellCorrection[];
  checkedAt: Date;
}

export interface SpellCorrection {
  original: string;
  suggestion: string;
  position: number;
  confidence: number;
}

export interface TextStatistics {
  documentId: string;
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordLength: number;
  averageSentenceLength: number;
  readabilityScore: number;
  calculatedAt: Date;
}

/**
 * Document Manager
 */
export class DocumentManager {
  private documents: Map<string, TextDocument> = new Map();

  /**
   * Create document
   */
  createDocument(document: Omit<TextDocument, 'id' | 'createdAt'>): TextDocument {
    const fullDocument: TextDocument = {
      ...document,
      id: this.generateDocumentId(),
      createdAt: new Date(),
    };

    this.documents.set(fullDocument.id, fullDocument);

    eventBus.emitSync('nlp.document_created', fullDocument, 'DocumentManager');

    return fullDocument;
  }

  /**
   * Get document
   */
  getDocument(documentId: string): TextDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * List documents
   */
  listDocuments(filter?: { language?: string }): TextDocument[] {
    let documents = Array.from(this.documents.values());

    if (filter?.language) {
      documents = documents.filter(d => d.language === filter.language);
    }

    return documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Delete document
   */
  deleteDocument(documentId: string): void {
    this.documents.delete(documentId);
    eventBus.emitSync('nlp.document_deleted', { documentId }, 'DocumentManager');
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Sentiment Analyzer
 */
export class SentimentAnalyzer {
  private analyses: Map<string, SentimentAnalysis> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Analyze sentiment
   */
  async analyze(documentId: string): Promise<SentimentAnalysis> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Mock sentiment analysis
    await new Promise(resolve => setTimeout(resolve, 50));

    const score = this.calculateSentimentScore(document.text);
    const sentiment = this.determineSentiment(score);

    const analysis: SentimentAnalysis = {
      documentId,
      sentiment,
      score,
      confidence: 0.85,
      emotions: this.analyzeEmotions(document.text),
      analyzedAt: new Date(),
    };

    this.analyses.set(documentId, analysis);

    eventBus.emitSync('nlp.sentiment_analyzed', analysis, 'SentimentAnalyzer');

    return analysis;
  }

  /**
   * Get analysis
   */
  getAnalysis(documentId: string): SentimentAnalysis | undefined {
    return this.analyses.get(documentId);
  }

  /**
   * Batch analyze
   */
  async batchAnalyze(documentIds: string[]): Promise<Map<string, SentimentAnalysis>> {
    const results = new Map<string, SentimentAnalysis>();

    for (const documentId of documentIds) {
      const analysis = await this.analyze(documentId);
      results.set(documentId, analysis);
    }

    return results;
  }

  private calculateSentimentScore(text: string): number {
    // Simple mock sentiment scoring
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'happy'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    for (const word of words) {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    }

    return Math.max(-1, Math.min(1, score));
  }

  private determineSentiment(score: number): Sentiment {
    if (score > 0.3) return Sentiment.Positive;
    if (score < -0.3) return Sentiment.Negative;
    return Sentiment.Neutral;
  }

  private analyzeEmotions(text: string): EmotionScores {
    // Mock emotion analysis
    return {
      joy: Math.random(),
      sadness: Math.random() * 0.5,
      anger: Math.random() * 0.3,
      fear: Math.random() * 0.2,
      surprise: Math.random() * 0.4,
      disgust: Math.random() * 0.2,
    };
  }
}

/**
 * Entity Extractor
 */
export class EntityExtractor {
  private extractions: Map<string, EntityExtraction> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Extract entities
   */
  async extract(documentId: string): Promise<EntityExtraction> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Mock entity extraction
    await new Promise(resolve => setTimeout(resolve, 50));

    const entities = this.findEntities(document.text);

    const extraction: EntityExtraction = {
      documentId,
      entities,
      extractedAt: new Date(),
    };

    this.extractions.set(documentId, extraction);

    eventBus.emitSync('nlp.entities_extracted', extraction, 'EntityExtractor');

    return extraction;
  }

  /**
   * Get extraction
   */
  getExtraction(documentId: string): EntityExtraction | undefined {
    return this.extractions.get(documentId);
  }

  /**
   * Find entities by type
   */
  findByType(documentId: string, type: EntityType): Entity[] {
    const extraction = this.extractions.get(documentId);
    return extraction ? extraction.entities.filter(e => e.type === type) : [];
  }

  private findEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    // Email pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;

    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: EntityType.Email,
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.95,
      });
    }

    // URL pattern
    const urlRegex = /https?:\/\/[^\s]+/g;
    while ((match = urlRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: EntityType.URL,
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.95,
      });
    }

    // Phone pattern (simple)
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    while ((match = phoneRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: EntityType.Phone,
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.85,
      });
    }

    return entities;
  }
}

/**
 * Key Phrase Extractor
 */
export class KeyPhraseExtractor {
  private extractions: Map<string, KeyPhraseExtraction> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Extract key phrases
   */
  async extract(documentId: string, limit: number = 10): Promise<KeyPhraseExtraction> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Mock key phrase extraction
    await new Promise(resolve => setTimeout(resolve, 50));

    const phrases = this.extractPhrases(document.text, limit);

    const extraction: KeyPhraseExtraction = {
      documentId,
      phrases,
      extractedAt: new Date(),
    };

    this.extractions.set(documentId, extraction);

    eventBus.emitSync('nlp.keyphrases_extracted', extraction, 'KeyPhraseExtractor');

    return extraction;
  }

  /**
   * Get extraction
   */
  getExtraction(documentId: string): KeyPhraseExtraction | undefined {
    return this.extractions.get(documentId);
  }

  private extractPhrases(text: string, limit: number): KeyPhrase[] {
    // Simple word frequency analysis
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const frequency = new Map<string, number>();

    for (const word of words) {
      if (word.length > 3) {
        // Skip short words
        frequency.set(word, (frequency.get(word) || 0) + 1);
      }
    }

    const phrases: KeyPhrase[] = Array.from(frequency.entries())
      .map(([text, freq]) => ({
        text,
        score: freq / words.length,
        frequency: freq,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return phrases;
  }
}

/**
 * Language Detector
 */
export class LanguageDetector {
  private detections: Map<string, LanguageDetection> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Detect language
   */
  async detect(documentId: string): Promise<LanguageDetection> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Mock language detection
    await new Promise(resolve => setTimeout(resolve, 30));

    const detection: LanguageDetection = {
      documentId,
      language: 'en',
      confidence: 0.95,
      alternativeLanguages: [
        { language: 'es', score: 0.03 },
        { language: 'fr', score: 0.02 },
      ],
      detectedAt: new Date(),
    };

    this.detections.set(documentId, detection);

    eventBus.emitSync('nlp.language_detected', detection, 'LanguageDetector');

    return detection;
  }

  /**
   * Get detection
   */
  getDetection(documentId: string): LanguageDetection | undefined {
    return this.detections.get(documentId);
  }
}

/**
 * Text Classifier
 */
export class TextClassifier {
  private classifications: Map<string, TextClassification> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Classify text
   */
  async classify(documentId: string): Promise<TextClassification> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Mock classification
    await new Promise(resolve => setTimeout(resolve, 50));

    const categories = this.categorizeText(document.text);

    const classification: TextClassification = {
      documentId,
      categories,
      classifiedAt: new Date(),
    };

    this.classifications.set(documentId, classification);

    eventBus.emitSync('nlp.text_classified', classification, 'TextClassifier');

    return classification;
  }

  /**
   * Get classification
   */
  getClassification(documentId: string): TextClassification | undefined {
    return this.classifications.get(documentId);
  }

  private categorizeText(text: string): Category[] {
    // Mock categorization
    const categories = [
      'Technology',
      'Business',
      'Sports',
      'Entertainment',
      'Politics',
      'Science',
    ];

    return categories
      .map(name => ({
        name,
        score: Math.random(),
        confidence: 0.7 + Math.random() * 0.3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
}

/**
 * Text Summarizer
 */
export class TextSummarizer {
  private summaries: Map<string, TextSummary> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Summarize text
   */
  async summarize(
    documentId: string,
    method: SummaryMethod = SummaryMethod.Extractive,
    maxLength?: number
  ): Promise<TextSummary> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Mock summarization
    await new Promise(resolve => setTimeout(resolve, 100));

    const summary =
      method === SummaryMethod.Extractive
        ? this.extractiveSummary(document.text, maxLength)
        : this.abstractiveSummary(document.text, maxLength);

    const textSummary: TextSummary = {
      documentId,
      summary,
      method,
      compressionRatio: summary.length / document.text.length,
      createdAt: new Date(),
    };

    this.summaries.set(documentId, textSummary);

    eventBus.emitSync('nlp.text_summarized', textSummary, 'TextSummarizer');

    return textSummary;
  }

  /**
   * Get summary
   */
  getSummary(documentId: string): TextSummary | undefined {
    return this.summaries.get(documentId);
  }

  private extractiveSummary(text: string, maxLength?: number): string {
    // Simple extractive summarization: take first sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const targetLength = maxLength || Math.floor(text.length * 0.3);

    let summary = '';
    for (const sentence of sentences) {
      if (summary.length + sentence.length > targetLength) break;
      summary += sentence;
    }

    return summary.trim();
  }

  private abstractiveSummary(text: string, maxLength?: number): string {
    // Mock abstractive summary
    return `This is an abstractive summary of the text. ${text.substring(0, maxLength || 100)}...`;
  }
}

/**
 * Tokenizer
 */
export class Tokenizer {
  private tokenizations: Map<string, Tokenization> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Tokenize text
   */
  async tokenize(documentId: string): Promise<Tokenization> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Mock tokenization
    await new Promise(resolve => setTimeout(resolve, 30));

    const tokens = this.extractTokens(document.text);
    const sentences = this.extractSentences(document.text);

    const tokenization: Tokenization = {
      documentId,
      tokens,
      sentences,
      tokenizedAt: new Date(),
    };

    this.tokenizations.set(documentId, tokenization);

    eventBus.emitSync('nlp.text_tokenized', tokenization, 'Tokenizer');

    return tokenization;
  }

  /**
   * Get tokenization
   */
  getTokenization(documentId: string): Tokenization | undefined {
    return this.tokenizations.get(documentId);
  }

  private extractTokens(text: string): Token[] {
    const words = text.match(/\b\w+\b/g) || [];
    const tokens: Token[] = [];

    let position = 0;
    for (const word of words) {
      const start = text.indexOf(word, position);
      tokens.push({
        text: word,
        lemma: word.toLowerCase(),
        pos: this.guessPartOfSpeech(word),
        tag: 'NN',
        start,
        end: start + word.length,
      });
      position = start + word.length;
    }

    return tokens;
  }

  private extractSentences(text: string): string[] {
    return text.match(/[^.!?]+[.!?]+/g) || [];
  }

  private guessPartOfSpeech(word: string): PartOfSpeech {
    // Very simple POS guessing
    if (word.endsWith('ing') || word.endsWith('ed')) return PartOfSpeech.Verb;
    if (word.endsWith('ly')) return PartOfSpeech.Adverb;
    return PartOfSpeech.Noun;
  }
}

/**
 * Similarity Calculator
 */
export class SimilarityCalculator {
  private scores: Map<string, SimilarityScore> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Calculate similarity
   */
  async calculate(
    document1Id: string,
    document2Id: string,
    method: SimilarityMethod = SimilarityMethod.Cosine
  ): Promise<SimilarityScore> {
    const doc1 = this.documentManager.getDocument(document1Id);
    const doc2 = this.documentManager.getDocument(document2Id);

    if (!doc1 || !doc2) {
      throw new Error('Documents not found');
    }

    // Mock similarity calculation
    await new Promise(resolve => setTimeout(resolve, 30));

    let score: number;

    switch (method) {
      case SimilarityMethod.Cosine:
        score = this.cosineSimilarity(doc1.text, doc2.text);
        break;
      case SimilarityMethod.Jaccard:
        score = this.jaccardSimilarity(doc1.text, doc2.text);
        break;
      case SimilarityMethod.Levenshtein:
        score = this.levenshteinSimilarity(doc1.text, doc2.text);
        break;
    }

    const similarityScore: SimilarityScore = {
      document1Id,
      document2Id,
      score,
      method,
      calculatedAt: new Date(),
    };

    const key = `${document1Id}:${document2Id}:${method}`;
    this.scores.set(key, similarityScore);

    eventBus.emitSync('nlp.similarity_calculated', similarityScore, 'SimilarityCalculator');

    return similarityScore;
  }

  private cosineSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));

    if (words1.size === 0 || words2.size === 0) return 0;

    return intersection.size / Math.sqrt(words1.size * words2.size);
  }

  private jaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private levenshteinSimilarity(text1: string, text2: string): number {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);

    return maxLength > 0 ? 1 - distance / maxLength : 1;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

/**
 * Text Statistics Calculator
 */
export class TextStatisticsCalculator {
  private statistics: Map<string, TextStatistics> = new Map();
  private documentManager: DocumentManager;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  /**
   * Calculate statistics
   */
  async calculate(documentId: string): Promise<TextStatistics> {
    const document = this.documentManager.getDocument(documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const text = document.text;
    const words = text.match(/\b\w+\b/g) || [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const paragraphs = text.split(/\n\n+/);

    const stats: TextStatistics = {
      documentId,
      characterCount: text.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      averageWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length,
      averageSentenceLength: words.length / sentences.length,
      readabilityScore: this.calculateReadability(words.length, sentences.length),
      calculatedAt: new Date(),
    };

    this.statistics.set(documentId, stats);

    eventBus.emitSync('nlp.statistics_calculated', stats, 'TextStatisticsCalculator');

    return stats;
  }

  /**
   * Get statistics
   */
  getStatistics(documentId: string): TextStatistics | undefined {
    return this.statistics.get(documentId);
  }

  private calculateReadability(wordCount: number, sentenceCount: number): number {
    // Simplified Flesch Reading Ease
    const avgWordsPerSentence = wordCount / sentenceCount;
    return 206.835 - 1.015 * avgWordsPerSentence;
  }
}

/**
 * Singleton instances
 */
export const documentManager = new DocumentManager();
export const sentimentAnalyzer = new SentimentAnalyzer(documentManager);
export const entityExtractor = new EntityExtractor(documentManager);
export const keyPhraseExtractor = new KeyPhraseExtractor(documentManager);
export const languageDetector = new LanguageDetector(documentManager);
export const textClassifier = new TextClassifier(documentManager);
export const textSummarizer = new TextSummarizer(documentManager);
export const tokenizer = new Tokenizer(documentManager);
export const similarityCalculator = new SimilarityCalculator(documentManager);
export const textStatisticsCalculator = new TextStatisticsCalculator(documentManager);
