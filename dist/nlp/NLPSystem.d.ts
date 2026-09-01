/**
 * Natural Language Processing System
 * Text analysis, sentiment analysis, entity extraction, language detection, and text generation
 */
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
    score: number;
    confidence: number;
    emotions: EmotionScores;
    analyzedAt: Date;
}
export declare enum Sentiment {
    Positive = "positive",
    Negative = "negative",
    Neutral = "neutral",
    Mixed = "mixed"
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
export declare enum EntityType {
    Person = "person",
    Organization = "organization",
    Location = "location",
    Date = "date",
    Time = "time",
    Money = "money",
    Percentage = "percentage",
    Email = "email",
    Phone = "phone",
    URL = "url"
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
export declare enum SummaryMethod {
    Extractive = "extractive",
    Abstractive = "abstractive"
}
export interface Token {
    text: string;
    lemma: string;
    pos: PartOfSpeech;
    tag: string;
    start: number;
    end: number;
}
export declare enum PartOfSpeech {
    Noun = "noun",
    Verb = "verb",
    Adjective = "adjective",
    Adverb = "adverb",
    Pronoun = "pronoun",
    Preposition = "preposition",
    Conjunction = "conjunction",
    Interjection = "interjection",
    Determiner = "determiner"
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
    score: number;
    method: SimilarityMethod;
    calculatedAt: Date;
}
export declare enum SimilarityMethod {
    Cosine = "cosine",
    Jaccard = "jaccard",
    Levenshtein = "levenshtein"
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
export declare class DocumentManager {
    private documents;
    /**
     * Create document
     */
    createDocument(document: Omit<TextDocument, 'id' | 'createdAt'>): TextDocument;
    /**
     * Get document
     */
    getDocument(documentId: string): TextDocument | undefined;
    /**
     * List documents
     */
    listDocuments(filter?: {
        language?: string;
    }): TextDocument[];
    /**
     * Delete document
     */
    deleteDocument(documentId: string): void;
    private generateDocumentId;
}
/**
 * Sentiment Analyzer
 */
export declare class SentimentAnalyzer {
    private analyses;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Analyze sentiment
     */
    analyze(documentId: string): Promise<SentimentAnalysis>;
    /**
     * Get analysis
     */
    getAnalysis(documentId: string): SentimentAnalysis | undefined;
    /**
     * Batch analyze
     */
    batchAnalyze(documentIds: string[]): Promise<Map<string, SentimentAnalysis>>;
    private calculateSentimentScore;
    private determineSentiment;
    private analyzeEmotions;
}
/**
 * Entity Extractor
 */
export declare class EntityExtractor {
    private extractions;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Extract entities
     */
    extract(documentId: string): Promise<EntityExtraction>;
    /**
     * Get extraction
     */
    getExtraction(documentId: string): EntityExtraction | undefined;
    /**
     * Find entities by type
     */
    findByType(documentId: string, type: EntityType): Entity[];
    private findEntities;
}
/**
 * Key Phrase Extractor
 */
export declare class KeyPhraseExtractor {
    private extractions;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Extract key phrases
     */
    extract(documentId: string, limit?: number): Promise<KeyPhraseExtraction>;
    /**
     * Get extraction
     */
    getExtraction(documentId: string): KeyPhraseExtraction | undefined;
    private extractPhrases;
}
/**
 * Language Detector
 */
export declare class LanguageDetector {
    private detections;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Detect language
     */
    detect(documentId: string): Promise<LanguageDetection>;
    /**
     * Get detection
     */
    getDetection(documentId: string): LanguageDetection | undefined;
}
/**
 * Text Classifier
 */
export declare class TextClassifier {
    private classifications;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Classify text
     */
    classify(documentId: string): Promise<TextClassification>;
    /**
     * Get classification
     */
    getClassification(documentId: string): TextClassification | undefined;
    private categorizeText;
}
/**
 * Text Summarizer
 */
export declare class TextSummarizer {
    private summaries;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Summarize text
     */
    summarize(documentId: string, method?: SummaryMethod, maxLength?: number): Promise<TextSummary>;
    /**
     * Get summary
     */
    getSummary(documentId: string): TextSummary | undefined;
    private extractiveSummary;
    private abstractiveSummary;
}
/**
 * Tokenizer
 */
export declare class Tokenizer {
    private tokenizations;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Tokenize text
     */
    tokenize(documentId: string): Promise<Tokenization>;
    /**
     * Get tokenization
     */
    getTokenization(documentId: string): Tokenization | undefined;
    private extractTokens;
    private extractSentences;
    private guessPartOfSpeech;
}
/**
 * Similarity Calculator
 */
export declare class SimilarityCalculator {
    private scores;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Calculate similarity
     */
    calculate(document1Id: string, document2Id: string, method?: SimilarityMethod): Promise<SimilarityScore>;
    private cosineSimilarity;
    private jaccardSimilarity;
    private levenshteinSimilarity;
    private levenshteinDistance;
}
/**
 * Text Statistics Calculator
 */
export declare class TextStatisticsCalculator {
    private statistics;
    private documentManager;
    constructor(documentManager: DocumentManager);
    /**
     * Calculate statistics
     */
    calculate(documentId: string): Promise<TextStatistics>;
    /**
     * Get statistics
     */
    getStatistics(documentId: string): TextStatistics | undefined;
    private calculateReadability;
}
/**
 * Singleton instances
 */
export declare const documentManager: DocumentManager;
export declare const sentimentAnalyzer: SentimentAnalyzer;
export declare const entityExtractor: EntityExtractor;
export declare const keyPhraseExtractor: KeyPhraseExtractor;
export declare const languageDetector: LanguageDetector;
export declare const textClassifier: TextClassifier;
export declare const textSummarizer: TextSummarizer;
export declare const tokenizer: Tokenizer;
export declare const similarityCalculator: SimilarityCalculator;
export declare const textStatisticsCalculator: TextStatisticsCalculator;
//# sourceMappingURL=NLPSystem.d.ts.map