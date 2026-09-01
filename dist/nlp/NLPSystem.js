"use strict";
/**
 * Natural Language Processing System
 * Text analysis, sentiment analysis, entity extraction, language detection, and text generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.textStatisticsCalculator = exports.similarityCalculator = exports.tokenizer = exports.textSummarizer = exports.textClassifier = exports.languageDetector = exports.keyPhraseExtractor = exports.entityExtractor = exports.sentimentAnalyzer = exports.documentManager = exports.TextStatisticsCalculator = exports.SimilarityCalculator = exports.Tokenizer = exports.TextSummarizer = exports.TextClassifier = exports.LanguageDetector = exports.KeyPhraseExtractor = exports.EntityExtractor = exports.SentimentAnalyzer = exports.DocumentManager = exports.SimilarityMethod = exports.PartOfSpeech = exports.SummaryMethod = exports.EntityType = exports.Sentiment = void 0;
const EventBus_1 = require("../core/EventBus");
var Sentiment;
(function (Sentiment) {
    Sentiment["Positive"] = "positive";
    Sentiment["Negative"] = "negative";
    Sentiment["Neutral"] = "neutral";
    Sentiment["Mixed"] = "mixed";
})(Sentiment || (exports.Sentiment = Sentiment = {}));
var EntityType;
(function (EntityType) {
    EntityType["Person"] = "person";
    EntityType["Organization"] = "organization";
    EntityType["Location"] = "location";
    EntityType["Date"] = "date";
    EntityType["Time"] = "time";
    EntityType["Money"] = "money";
    EntityType["Percentage"] = "percentage";
    EntityType["Email"] = "email";
    EntityType["Phone"] = "phone";
    EntityType["URL"] = "url";
})(EntityType || (exports.EntityType = EntityType = {}));
var SummaryMethod;
(function (SummaryMethod) {
    SummaryMethod["Extractive"] = "extractive";
    SummaryMethod["Abstractive"] = "abstractive";
})(SummaryMethod || (exports.SummaryMethod = SummaryMethod = {}));
var PartOfSpeech;
(function (PartOfSpeech) {
    PartOfSpeech["Noun"] = "noun";
    PartOfSpeech["Verb"] = "verb";
    PartOfSpeech["Adjective"] = "adjective";
    PartOfSpeech["Adverb"] = "adverb";
    PartOfSpeech["Pronoun"] = "pronoun";
    PartOfSpeech["Preposition"] = "preposition";
    PartOfSpeech["Conjunction"] = "conjunction";
    PartOfSpeech["Interjection"] = "interjection";
    PartOfSpeech["Determiner"] = "determiner";
})(PartOfSpeech || (exports.PartOfSpeech = PartOfSpeech = {}));
var SimilarityMethod;
(function (SimilarityMethod) {
    SimilarityMethod["Cosine"] = "cosine";
    SimilarityMethod["Jaccard"] = "jaccard";
    SimilarityMethod["Levenshtein"] = "levenshtein";
})(SimilarityMethod || (exports.SimilarityMethod = SimilarityMethod = {}));
/**
 * Document Manager
 */
class DocumentManager {
    documents = new Map();
    /**
     * Create document
     */
    createDocument(document) {
        const fullDocument = {
            ...document,
            id: this.generateDocumentId(),
            createdAt: new Date(),
        };
        this.documents.set(fullDocument.id, fullDocument);
        EventBus_1.eventBus.emitSync('nlp.document_created', fullDocument, 'DocumentManager');
        return fullDocument;
    }
    /**
     * Get document
     */
    getDocument(documentId) {
        return this.documents.get(documentId);
    }
    /**
     * List documents
     */
    listDocuments(filter) {
        let documents = Array.from(this.documents.values());
        if (filter?.language) {
            documents = documents.filter(d => d.language === filter.language);
        }
        return documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Delete document
     */
    deleteDocument(documentId) {
        this.documents.delete(documentId);
        EventBus_1.eventBus.emitSync('nlp.document_deleted', { documentId }, 'DocumentManager');
    }
    generateDocumentId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DocumentManager = DocumentManager;
/**
 * Sentiment Analyzer
 */
class SentimentAnalyzer {
    analyses = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Analyze sentiment
     */
    async analyze(documentId) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Mock sentiment analysis
        await new Promise(resolve => setTimeout(resolve, 50));
        const score = this.calculateSentimentScore(document.text);
        const sentiment = this.determineSentiment(score);
        const analysis = {
            documentId,
            sentiment,
            score,
            confidence: 0.85,
            emotions: this.analyzeEmotions(document.text),
            analyzedAt: new Date(),
        };
        this.analyses.set(documentId, analysis);
        EventBus_1.eventBus.emitSync('nlp.sentiment_analyzed', analysis, 'SentimentAnalyzer');
        return analysis;
    }
    /**
     * Get analysis
     */
    getAnalysis(documentId) {
        return this.analyses.get(documentId);
    }
    /**
     * Batch analyze
     */
    async batchAnalyze(documentIds) {
        const results = new Map();
        for (const documentId of documentIds) {
            const analysis = await this.analyze(documentId);
            results.set(documentId, analysis);
        }
        return results;
    }
    calculateSentimentScore(text) {
        // Simple mock sentiment scoring
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'happy'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry'];
        const words = text.toLowerCase().split(/\s+/);
        let score = 0;
        for (const word of words) {
            if (positiveWords.includes(word))
                score += 0.1;
            if (negativeWords.includes(word))
                score -= 0.1;
        }
        return Math.max(-1, Math.min(1, score));
    }
    determineSentiment(score) {
        if (score > 0.3)
            return Sentiment.Positive;
        if (score < -0.3)
            return Sentiment.Negative;
        return Sentiment.Neutral;
    }
    analyzeEmotions(text) {
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
exports.SentimentAnalyzer = SentimentAnalyzer;
/**
 * Entity Extractor
 */
class EntityExtractor {
    extractions = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Extract entities
     */
    async extract(documentId) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Mock entity extraction
        await new Promise(resolve => setTimeout(resolve, 50));
        const entities = this.findEntities(document.text);
        const extraction = {
            documentId,
            entities,
            extractedAt: new Date(),
        };
        this.extractions.set(documentId, extraction);
        EventBus_1.eventBus.emitSync('nlp.entities_extracted', extraction, 'EntityExtractor');
        return extraction;
    }
    /**
     * Get extraction
     */
    getExtraction(documentId) {
        return this.extractions.get(documentId);
    }
    /**
     * Find entities by type
     */
    findByType(documentId, type) {
        const extraction = this.extractions.get(documentId);
        return extraction ? extraction.entities.filter(e => e.type === type) : [];
    }
    findEntities(text) {
        const entities = [];
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
exports.EntityExtractor = EntityExtractor;
/**
 * Key Phrase Extractor
 */
class KeyPhraseExtractor {
    extractions = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Extract key phrases
     */
    async extract(documentId, limit = 10) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Mock key phrase extraction
        await new Promise(resolve => setTimeout(resolve, 50));
        const phrases = this.extractPhrases(document.text, limit);
        const extraction = {
            documentId,
            phrases,
            extractedAt: new Date(),
        };
        this.extractions.set(documentId, extraction);
        EventBus_1.eventBus.emitSync('nlp.keyphrases_extracted', extraction, 'KeyPhraseExtractor');
        return extraction;
    }
    /**
     * Get extraction
     */
    getExtraction(documentId) {
        return this.extractions.get(documentId);
    }
    extractPhrases(text, limit) {
        // Simple word frequency analysis
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        const frequency = new Map();
        for (const word of words) {
            if (word.length > 3) {
                // Skip short words
                frequency.set(word, (frequency.get(word) || 0) + 1);
            }
        }
        const phrases = Array.from(frequency.entries())
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
exports.KeyPhraseExtractor = KeyPhraseExtractor;
/**
 * Language Detector
 */
class LanguageDetector {
    detections = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Detect language
     */
    async detect(documentId) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Mock language detection
        await new Promise(resolve => setTimeout(resolve, 30));
        const detection = {
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
        EventBus_1.eventBus.emitSync('nlp.language_detected', detection, 'LanguageDetector');
        return detection;
    }
    /**
     * Get detection
     */
    getDetection(documentId) {
        return this.detections.get(documentId);
    }
}
exports.LanguageDetector = LanguageDetector;
/**
 * Text Classifier
 */
class TextClassifier {
    classifications = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Classify text
     */
    async classify(documentId) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Mock classification
        await new Promise(resolve => setTimeout(resolve, 50));
        const categories = this.categorizeText(document.text);
        const classification = {
            documentId,
            categories,
            classifiedAt: new Date(),
        };
        this.classifications.set(documentId, classification);
        EventBus_1.eventBus.emitSync('nlp.text_classified', classification, 'TextClassifier');
        return classification;
    }
    /**
     * Get classification
     */
    getClassification(documentId) {
        return this.classifications.get(documentId);
    }
    categorizeText(text) {
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
exports.TextClassifier = TextClassifier;
/**
 * Text Summarizer
 */
class TextSummarizer {
    summaries = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Summarize text
     */
    async summarize(documentId, method = SummaryMethod.Extractive, maxLength) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Mock summarization
        await new Promise(resolve => setTimeout(resolve, 100));
        const summary = method === SummaryMethod.Extractive
            ? this.extractiveSummary(document.text, maxLength)
            : this.abstractiveSummary(document.text, maxLength);
        const textSummary = {
            documentId,
            summary,
            method,
            compressionRatio: summary.length / document.text.length,
            createdAt: new Date(),
        };
        this.summaries.set(documentId, textSummary);
        EventBus_1.eventBus.emitSync('nlp.text_summarized', textSummary, 'TextSummarizer');
        return textSummary;
    }
    /**
     * Get summary
     */
    getSummary(documentId) {
        return this.summaries.get(documentId);
    }
    extractiveSummary(text, maxLength) {
        // Simple extractive summarization: take first sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        const targetLength = maxLength || Math.floor(text.length * 0.3);
        let summary = '';
        for (const sentence of sentences) {
            if (summary.length + sentence.length > targetLength)
                break;
            summary += sentence;
        }
        return summary.trim();
    }
    abstractiveSummary(text, maxLength) {
        // Mock abstractive summary
        return `This is an abstractive summary of the text. ${text.substring(0, maxLength || 100)}...`;
    }
}
exports.TextSummarizer = TextSummarizer;
/**
 * Tokenizer
 */
class Tokenizer {
    tokenizations = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Tokenize text
     */
    async tokenize(documentId) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        // Mock tokenization
        await new Promise(resolve => setTimeout(resolve, 30));
        const tokens = this.extractTokens(document.text);
        const sentences = this.extractSentences(document.text);
        const tokenization = {
            documentId,
            tokens,
            sentences,
            tokenizedAt: new Date(),
        };
        this.tokenizations.set(documentId, tokenization);
        EventBus_1.eventBus.emitSync('nlp.text_tokenized', tokenization, 'Tokenizer');
        return tokenization;
    }
    /**
     * Get tokenization
     */
    getTokenization(documentId) {
        return this.tokenizations.get(documentId);
    }
    extractTokens(text) {
        const words = text.match(/\b\w+\b/g) || [];
        const tokens = [];
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
    extractSentences(text) {
        return text.match(/[^.!?]+[.!?]+/g) || [];
    }
    guessPartOfSpeech(word) {
        // Very simple POS guessing
        if (word.endsWith('ing') || word.endsWith('ed'))
            return PartOfSpeech.Verb;
        if (word.endsWith('ly'))
            return PartOfSpeech.Adverb;
        return PartOfSpeech.Noun;
    }
}
exports.Tokenizer = Tokenizer;
/**
 * Similarity Calculator
 */
class SimilarityCalculator {
    scores = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Calculate similarity
     */
    async calculate(document1Id, document2Id, method = SimilarityMethod.Cosine) {
        const doc1 = this.documentManager.getDocument(document1Id);
        const doc2 = this.documentManager.getDocument(document2Id);
        if (!doc1 || !doc2) {
            throw new Error('Documents not found');
        }
        // Mock similarity calculation
        await new Promise(resolve => setTimeout(resolve, 30));
        let score;
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
        const similarityScore = {
            document1Id,
            document2Id,
            score,
            method,
            calculatedAt: new Date(),
        };
        const key = `${document1Id}:${document2Id}:${method}`;
        this.scores.set(key, similarityScore);
        EventBus_1.eventBus.emitSync('nlp.similarity_calculated', similarityScore, 'SimilarityCalculator');
        return similarityScore;
    }
    cosineSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        if (words1.size === 0 || words2.size === 0)
            return 0;
        return intersection.size / Math.sqrt(words1.size * words2.size);
    }
    jaccardSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    levenshteinSimilarity(text1, text2) {
        const distance = this.levenshteinDistance(text1, text2);
        const maxLength = Math.max(text1.length, text2.length);
        return maxLength > 0 ? 1 - distance / maxLength : 1;
    }
    levenshteinDistance(a, b) {
        const matrix = [];
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
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[b.length][a.length];
    }
}
exports.SimilarityCalculator = SimilarityCalculator;
/**
 * Text Statistics Calculator
 */
class TextStatisticsCalculator {
    statistics = new Map();
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    /**
     * Calculate statistics
     */
    async calculate(documentId) {
        const document = this.documentManager.getDocument(documentId);
        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }
        const text = document.text;
        const words = text.match(/\b\w+\b/g) || [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        const paragraphs = text.split(/\n\n+/);
        const stats = {
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
        EventBus_1.eventBus.emitSync('nlp.statistics_calculated', stats, 'TextStatisticsCalculator');
        return stats;
    }
    /**
     * Get statistics
     */
    getStatistics(documentId) {
        return this.statistics.get(documentId);
    }
    calculateReadability(wordCount, sentenceCount) {
        // Simplified Flesch Reading Ease
        const avgWordsPerSentence = wordCount / sentenceCount;
        return 206.835 - 1.015 * avgWordsPerSentence;
    }
}
exports.TextStatisticsCalculator = TextStatisticsCalculator;
/**
 * Singleton instances
 */
exports.documentManager = new DocumentManager();
exports.sentimentAnalyzer = new SentimentAnalyzer(exports.documentManager);
exports.entityExtractor = new EntityExtractor(exports.documentManager);
exports.keyPhraseExtractor = new KeyPhraseExtractor(exports.documentManager);
exports.languageDetector = new LanguageDetector(exports.documentManager);
exports.textClassifier = new TextClassifier(exports.documentManager);
exports.textSummarizer = new TextSummarizer(exports.documentManager);
exports.tokenizer = new Tokenizer(exports.documentManager);
exports.similarityCalculator = new SimilarityCalculator(exports.documentManager);
exports.textStatisticsCalculator = new TextStatisticsCalculator(exports.documentManager);
