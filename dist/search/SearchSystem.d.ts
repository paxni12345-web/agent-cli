/**
 * Search Engine System
 * Full-text search, indexing, relevance scoring, faceted search, and query parsing
 */
export interface SearchIndex {
    id: string;
    name: string;
    schema: IndexSchema;
    documents: Map<string, IndexedDocument>;
    invertedIndex: Map<string, Set<string>>;
    statistics: IndexStatistics;
    createdAt: Date;
}
export interface IndexSchema {
    fields: IndexField[];
    settings: IndexSettings;
}
export interface IndexField {
    name: string;
    type: FieldType;
    indexed: boolean;
    stored: boolean;
    analyzer?: string;
    boost?: number;
}
export declare enum FieldType {
    Text = "text",
    Keyword = "keyword",
    Number = "number",
    Date = "date",
    Boolean = "boolean",
    GeoPoint = "geo_point"
}
export interface IndexSettings {
    numberOfShards: number;
    numberOfReplicas: number;
    analyzer: string;
    refreshInterval: number;
}
export interface IndexedDocument {
    id: string;
    fields: Map<string, any>;
    score?: number;
    version: number;
    timestamp: Date;
}
export interface SearchQuery {
    query: QueryExpression;
    filters?: FilterExpression[];
    sort?: SortCriteria[];
    from?: number;
    size?: number;
    highlight?: HighlightConfig;
    facets?: FacetConfig[];
}
export interface QueryExpression {
    type: QueryType;
    value?: any;
    field?: string;
    boost?: number;
    operator?: QueryOperator;
    queries?: QueryExpression[];
}
export declare enum QueryType {
    Match = "match",
    MatchPhrase = "match_phrase",
    Term = "term",
    Terms = "terms",
    Range = "range",
    Wildcard = "wildcard",
    Fuzzy = "fuzzy",
    Bool = "bool",
    MultiMatch = "multi_match"
}
export declare enum QueryOperator {
    And = "and",
    Or = "or",
    Not = "not"
}
export interface FilterExpression {
    field: string;
    operator: FilterOperator;
    value: any;
}
export declare enum FilterOperator {
    Equals = "eq",
    NotEquals = "ne",
    GreaterThan = "gt",
    GreaterThanOrEqual = "gte",
    LessThan = "lt",
    LessThanOrEqual = "lte",
    In = "in",
    NotIn = "nin",
    Contains = "contains",
    StartsWith = "starts_with",
    EndsWith = "ends_with"
}
export interface SortCriteria {
    field: string;
    order: SortOrder;
}
export declare enum SortOrder {
    Ascending = "asc",
    Descending = "desc"
}
export interface HighlightConfig {
    fields: string[];
    preTag?: string;
    postTag?: string;
    fragmentSize?: number;
}
export interface FacetConfig {
    field: string;
    size?: number;
    minCount?: number;
}
export interface SearchResult {
    total: number;
    hits: SearchHit[];
    facets?: FacetResult[];
    took: number;
    maxScore?: number;
}
export interface SearchHit {
    id: string;
    score: number;
    fields: Record<string, any>;
    highlight?: Record<string, string[]>;
}
export interface FacetResult {
    field: string;
    buckets: FacetBucket[];
}
export interface FacetBucket {
    value: any;
    count: number;
}
export interface Analyzer {
    name: string;
    tokenizer: string;
    filters: string[];
}
export interface Token {
    text: string;
    position: number;
    startOffset: number;
    endOffset: number;
}
export interface IndexStatistics {
    documentCount: number;
    totalTerms: number;
    averageDocumentLength: number;
    indexSize: number;
}
export interface Suggestion {
    text: string;
    score: number;
    freq: number;
}
export interface QueryParser {
    parse(query: string): QueryExpression;
}
/**
 * Search Index Manager
 */
export declare class SearchIndexManager {
    private indexes;
    private analyzers;
    constructor();
    /**
     * Create index
     */
    createIndex(name: string, schema: IndexSchema): SearchIndex;
    /**
     * Index document
     */
    indexDocument(indexName: string, id: string, document: Record<string, any>): Promise<void>;
    /**
     * Delete document
     */
    deleteDocument(indexName: string, id: string): Promise<void>;
    /**
     * Search
     */
    search(indexName: string, query: SearchQuery): Promise<SearchResult>;
    /**
     * Get index
     */
    getIndex(name: string): SearchIndex | undefined;
    /**
     * List indexes
     */
    listIndexes(): SearchIndex[];
    /**
     * Delete index
     */
    deleteIndex(name: string): void;
    /**
     * Register analyzer
     */
    registerAnalyzer(analyzer: Analyzer): void;
    /**
     * Analyze text
     */
    analyze(text: string, analyzerName: string): Token[];
    /**
     * Suggest completions
     */
    suggest(indexName: string, prefix: string, field: string, size?: number): Suggestion[];
    private executeQuery;
    private executeMatchQuery;
    private executeTermQuery;
    private executeRangeQuery;
    private executeBoolQuery;
    private executeWildcardQuery;
    private executeFuzzyQuery;
    private applyFilters;
    private matchesAllFilters;
    private matchesFilter;
    private scoreDocuments;
    private calculateScore;
    private termFrequency;
    private inverseDocumentFrequency;
    private sortHits;
    private applyHighlight;
    private calculateFacets;
    private tokenize;
    private applyFilter;
    private stem;
    private defaultAnalyze;
    private matchesRange;
    private levenshteinDistance;
    private intersectSets;
    private unionSets;
    private differenceSets;
    private registerDefaultAnalyzers;
    private generateIndexId;
}
/**
 * Query Parser
 */
export declare class SearchQueryParser implements QueryParser {
    /**
     * Parse query string
     */
    parse(query: string): QueryExpression;
}
/**
 * Singleton instances
 */
export declare const searchIndexManager: SearchIndexManager;
export declare const searchQueryParser: SearchQueryParser;
//# sourceMappingURL=SearchSystem.d.ts.map