/**
 * Advanced Search & Indexing System
 * Full-text search, semantic search, faceted search
 * Real-time indexing, query optimization, relevance scoring
 */
import { EventEmitter } from 'events';
export interface SearchConfig {
    indexDirectory: string;
    enableFuzzySearch: boolean;
    enableSemanticSearch: boolean;
    maxResults: number;
    minScore: number;
    highlightEnabled: boolean;
    synonymsEnabled: boolean;
    stopWordsEnabled: boolean;
}
export interface SearchIndex {
    id: string;
    name: string;
    type: IndexType;
    fields: IndexField[];
    documents: Map<string, IndexedDocument>;
    statistics: IndexStatistics;
    settings: IndexSettings;
    createdAt: number;
    updatedAt: number;
}
export type IndexType = 'full_text' | 'semantic' | 'hybrid' | 'vector';
export interface IndexField {
    name: string;
    type: FieldType;
    indexed: boolean;
    stored: boolean;
    analyzed: boolean;
    boost?: number;
    faceted?: boolean;
}
export type FieldType = 'text' | 'keyword' | 'number' | 'date' | 'boolean' | 'geo_point' | 'vector';
export interface IndexedDocument {
    id: string;
    fields: Record<string, any>;
    vector?: number[];
    score?: number;
    timestamp: number;
}
export interface IndexStatistics {
    documentCount: number;
    totalSize: number;
    fieldStats: Map<string, FieldStatistics>;
    lastIndexed: number;
}
export interface FieldStatistics {
    field: string;
    uniqueValues: number;
    minValue?: any;
    maxValue?: any;
    avgLength?: number;
}
export interface IndexSettings {
    analyzer: string;
    similarity: SimilarityType;
    shards: number;
    replicas: number;
    refreshInterval: number;
}
export type SimilarityType = 'BM25' | 'TF_IDF' | 'cosine' | 'euclidean';
export interface SearchQuery {
    query: string;
    type: QueryType;
    fields?: string[];
    filters?: Filter[];
    facets?: FacetRequest[];
    sort?: SortCriteria[];
    page?: number;
    pageSize?: number;
    highlight?: HighlightOptions;
    options?: SearchOptions;
}
export type QueryType = 'match' | 'match_phrase' | 'multi_match' | 'fuzzy' | 'wildcard' | 'prefix' | 'semantic' | 'vector' | 'boolean';
export interface Filter {
    field: string;
    operator: FilterOperator;
    value: any;
    boost?: number;
}
export type FilterOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with' | 'exists';
export interface FacetRequest {
    field: string;
    size?: number;
    minCount?: number;
}
export interface SortCriteria {
    field: string;
    order: 'asc' | 'desc';
    mode?: 'min' | 'max' | 'avg';
}
export interface HighlightOptions {
    fields: string[];
    preTag?: string;
    postTag?: string;
    fragmentSize?: number;
    numberOfFragments?: number;
}
export interface SearchOptions {
    fuzzyDistance?: number;
    synonyms?: boolean;
    stopWords?: boolean;
    minScore?: number;
    timeout?: number;
    explain?: boolean;
}
export interface SearchResult {
    query: SearchQuery;
    hits: SearchHit[];
    total: number;
    maxScore: number;
    took: number;
    facets?: FacetResult[];
    suggestions?: Suggestion[];
}
export interface SearchHit {
    id: string;
    score: number;
    fields: Record<string, any>;
    highlights?: Record<string, string[]>;
    explanation?: Explanation;
}
export interface Explanation {
    value: number;
    description: string;
    details: Explanation[];
}
export interface FacetResult {
    field: string;
    values: FacetValue[];
    missing?: number;
    total: number;
}
export interface FacetValue {
    value: any;
    count: number;
    selected?: boolean;
}
export interface Suggestion {
    text: string;
    score: number;
    freq: number;
}
export interface Analyzer {
    name: string;
    tokenizer: Tokenizer;
    filters: TokenFilter[];
}
export interface Tokenizer {
    type: TokenizerType;
    config?: Record<string, any>;
}
export type TokenizerType = 'standard' | 'whitespace' | 'ngram' | 'edge_ngram' | 'keyword' | 'pattern';
export interface TokenFilter {
    type: FilterType;
    config?: Record<string, any>;
}
export type FilterType = 'lowercase' | 'uppercase' | 'stop' | 'stemmer' | 'synonym' | 'ngram' | 'edge_ngram' | 'phonetic' | 'ascii_folding';
export interface Token {
    text: string;
    position: number;
    startOffset: number;
    endOffset: number;
    type: string;
}
export interface QueryParser {
    parse(query: string): ParsedQuery;
}
export interface ParsedQuery {
    type: string;
    clauses: QueryClause[];
    boost?: number;
}
export interface QueryClause {
    type: 'term' | 'phrase' | 'boolean' | 'wildcard' | 'fuzzy';
    field?: string;
    value: any;
    operator?: 'AND' | 'OR' | 'NOT';
    boost?: number;
}
export interface SemanticSearchConfig {
    model: string;
    embeddingDimension: number;
    similarityThreshold: number;
}
export interface VectorSearchQuery {
    vector: number[];
    k: number;
    filters?: Filter[];
}
export declare class SearchManager extends EventEmitter {
    private config;
    private indexes;
    private analyzers;
    private queryParser;
    constructor(config?: Partial<SearchConfig>);
    createIndex(name: string, fields: IndexField[], settings?: Partial<IndexSettings>): SearchIndex;
    getIndex(name: string): SearchIndex | undefined;
    deleteIndex(name: string): void;
    listIndexes(): SearchIndex[];
    indexDocument(indexName: string, id: string, document: Record<string, any>): Promise<void>;
    indexDocuments(indexName: string, documents: Record<string, Record<string, any>>): Promise<void>;
    updateDocument(indexName: string, id: string, updates: Record<string, any>): Promise<void>;
    deleteDocument(indexName: string, id: string): void;
    search(indexName: string, query: SearchQuery): Promise<SearchResult>;
    private executeSearch;
    private calculateScore;
    private calculateFieldScore;
    private calculateBM25;
    private calculateTFIDF;
    private calculateCosine;
    private calculateSimpleMatch;
    private applyFilters;
    private evaluateFilter;
    private sortHits;
    private calculateFacets;
    private highlightFields;
    private generateSuggestions;
    private isSimilar;
    private calculateSimilarity;
    private levenshteinDistance;
    private registerDefaultAnalyzers;
    private analyzeField;
    private tokenize;
    private applyFilter;
    private extractTerms;
    private generateEmbedding;
    private generateId;
    getStats(): SearchStats;
}
interface SearchStats {
    indexes: number;
    totalDocuments: number;
    analyzers: number;
}
export default SearchManager;
//# sourceMappingURL=SearchManager.d.ts.map