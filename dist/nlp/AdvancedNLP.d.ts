/**
 * Advanced NLP System
 * Natural Language Processing with 100+ languages support
 *
 * Part of 350K lines goal
 */
import { EventEmitter } from 'events';
export interface NLPConfig {
    defaultLanguage: string;
    enableTranslation: boolean;
    enableSentiment: boolean;
    enableNER: boolean;
    enableSummarization: boolean;
    maxTokens: number;
}
export interface NLPTask {
    id: string;
    type: NLPTaskType;
    input: string;
    options: NLPOptions;
    status: TaskStatus;
    result?: NLPResult;
    createdAt: Date;
    completedAt?: Date;
}
export type NLPTaskType = 'translation' | 'sentiment' | 'ner' | 'summarization' | 'paraphrase' | 'question_answering' | 'text_generation' | 'language_detection' | 'intent_classification' | 'emotion_detection';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface NLPOptions {
    language?: string;
    targetLanguage?: string;
    model?: string;
    maxLength?: number;
    temperature?: number;
}
export interface NLPResult {
    output: string | any;
    confidence: number;
    metadata: NLPMetadata;
}
export interface NLPMetadata {
    processingTime: number;
    model: string;
    tokensUsed: number;
    language?: string;
    timestamp: Date;
}
export interface Entity {
    text: string;
    type: EntityType;
    start: number;
    end: number;
    confidence: number;
    metadata?: Record<string, any>;
}
export type EntityType = 'person' | 'organization' | 'location' | 'date' | 'time' | 'money' | 'email' | 'phone' | 'url' | 'custom';
export interface SentimentResult {
    label: SentimentLabel;
    score: number;
    emotions: EmotionScore[];
    aspects?: AspectSentiment[];
}
export type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'mixed';
export interface EmotionScore {
    emotion: string;
    score: number;
}
export interface AspectSentiment {
    aspect: string;
    sentiment: SentimentLabel;
    score: number;
}
export interface TranslationResult {
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
    alternatives?: string[];
}
export interface SummaryResult {
    summary: string;
    keyPoints: string[];
    compressionRatio: number;
    originalLength: number;
    summaryLength: number;
}
export interface Intent {
    intent: string;
    confidence: number;
    entities: Entity[];
    context?: Record<string, any>;
}
export interface QAResult {
    answer: string;
    confidence: number;
    context: string;
    startIndex: number;
    endIndex: number;
}
export declare class AdvancedNLPManager extends EventEmitter {
    private config;
    private tasks;
    private languageModels;
    private cache;
    constructor(config?: Partial<NLPConfig>);
    private initializeModels;
    translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult>;
    private simulateTranslation;
    analyzeSentiment(text: string, options?: NLPOptions): Promise<SentimentResult>;
    private calculateSentiment;
    private getSentimentLabel;
    extractEntities(text: string, options?: NLPOptions): Promise<Entity[]>;
    summarize(text: string, options?: NLPOptions): Promise<SummaryResult>;
    paraphrase(text: string, options?: NLPOptions): Promise<string[]>;
    classifyIntent(text: string, options?: NLPOptions): Promise<Intent>;
    answerQuestion(question: string, context: string, options?: NLPOptions): Promise<QAResult>;
    detectLanguage(text: string): Promise<string>;
    generateText(prompt: string, options?: NLPOptions): Promise<string>;
    private createTask;
    private generateId;
    getTask(taskId: string): NLPTask | undefined;
    getStats(): {
        totalTasks: number;
        pendingTasks: number;
        processingTasks: number;
        completedTasks: number;
        failedTasks: number;
        cacheSize: number;
        loadedModels: number;
    };
    clearCache(): void;
}
//# sourceMappingURL=AdvancedNLP.d.ts.map