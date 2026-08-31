/**
 * Search Engine System
 * Full-text search, indexing, relevance scoring, faceted search, and query parsing
 */

import { eventBus } from '../core/EventBus';

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

export enum FieldType {
  Text = 'text',
  Keyword = 'keyword',
  Number = 'number',
  Date = 'date',
  Boolean = 'boolean',
  GeoPoint = 'geo_point',
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

export enum QueryType {
  Match = 'match',
  MatchPhrase = 'match_phrase',
  Term = 'term',
  Terms = 'terms',
  Range = 'range',
  Wildcard = 'wildcard',
  Fuzzy = 'fuzzy',
  Bool = 'bool',
  MultiMatch = 'multi_match',
}

export enum QueryOperator {
  And = 'and',
  Or = 'or',
  Not = 'not',
}

export interface FilterExpression {
  field: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  Equals = 'eq',
  NotEquals = 'ne',
  GreaterThan = 'gt',
  GreaterThanOrEqual = 'gte',
  LessThan = 'lt',
  LessThanOrEqual = 'lte',
  In = 'in',
  NotIn = 'nin',
  Contains = 'contains',
  StartsWith = 'starts_with',
  EndsWith = 'ends_with',
}

export interface SortCriteria {
  field: string;
  order: SortOrder;
}

export enum SortOrder {
  Ascending = 'asc',
  Descending = 'desc',
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
export class SearchIndexManager {
  private indexes: Map<string, SearchIndex> = new Map();
  private analyzers: Map<string, Analyzer> = new Map();

  constructor() {
    this.registerDefaultAnalyzers();
  }

  /**
   * Create index
   */
  createIndex(name: string, schema: IndexSchema): SearchIndex {
    const index: SearchIndex = {
      id: this.generateIndexId(),
      name,
      schema,
      documents: new Map(),
      invertedIndex: new Map(),
      statistics: {
        documentCount: 0,
        totalTerms: 0,
        averageDocumentLength: 0,
        indexSize: 0,
      },
      createdAt: new Date(),
    };

    this.indexes.set(name, index);

    eventBus.emitSync('search.index_created', index, 'SearchIndexManager');

    return index;
  }

  /**
   * Index document
   */
  async indexDocument(indexName: string, id: string, document: Record<string, any>): Promise<void> {
    const index = this.indexes.get(indexName);

    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    const fields = new Map<string, any>();

    for (const field of index.schema.fields) {
      if (document[field.name] !== undefined) {
        fields.set(field.name, document[field.name]);

        // Build inverted index for text fields
        if (field.indexed && field.type === FieldType.Text) {
          const tokens = this.analyze(document[field.name], index.schema.settings.analyzer);

          for (const token of tokens) {
            if (!index.invertedIndex.has(token.text)) {
              index.invertedIndex.set(token.text, new Set());
            }
            index.invertedIndex.get(token.text)!.add(id);
          }
        }
      }
    }

    const indexedDoc: IndexedDocument = {
      id,
      fields,
      version: 1,
      timestamp: new Date(),
    };

    index.documents.set(id, indexedDoc);
    index.statistics.documentCount++;

    eventBus.emitSync('search.document_indexed', { indexName, id }, 'SearchIndexManager');
  }

  /**
   * Delete document
   */
  async deleteDocument(indexName: string, id: string): Promise<void> {
    const index = this.indexes.get(indexName);

    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    const doc = index.documents.get(id);

    if (doc) {
      // Remove from inverted index
      for (const docIds of index.invertedIndex.values()) {
        docIds.delete(id);
      }

      index.documents.delete(id);
      index.statistics.documentCount--;

      eventBus.emitSync('search.document_deleted', { indexName, id }, 'SearchIndexManager');
    }
  }

  /**
   * Search
   */
  async search(indexName: string, query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const index = this.indexes.get(indexName);

    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    // Execute query
    let candidates = this.executeQuery(index, query.query);

    // Apply filters
    if (query.filters) {
      candidates = this.applyFilters(index, candidates, query.filters);
    }

    // Calculate scores
    const scoredHits = this.scoreDocuments(index, candidates, query.query);

    // Sort
    if (query.sort) {
      this.sortHits(scoredHits, query.sort);
    } else {
      scoredHits.sort((a, b) => b.score - a.score);
    }

    // Pagination
    const from = query.from || 0;
    const size = query.size || 10;
    const paginatedHits = scoredHits.slice(from, from + size);

    // Highlight
    if (query.highlight) {
      this.applyHighlight(paginatedHits, query.highlight);
    }

    // Facets
    let facets: FacetResult[] | undefined;
    if (query.facets) {
      facets = this.calculateFacets(index, candidates, query.facets);
    }

    const result: SearchResult = {
      total: scoredHits.length,
      hits: paginatedHits,
      facets,
      took: Date.now() - startTime,
      maxScore: scoredHits.length > 0 ? scoredHits[0].score : undefined,
    };

    eventBus.emitSync('search.query_executed', { indexName, took: result.took }, 'SearchIndexManager');

    return result;
  }

  /**
   * Get index
   */
  getIndex(name: string): SearchIndex | undefined {
    return this.indexes.get(name);
  }

  /**
   * List indexes
   */
  listIndexes(): SearchIndex[] {
    return Array.from(this.indexes.values());
  }

  /**
   * Delete index
   */
  deleteIndex(name: string): void {
    this.indexes.delete(name);
    eventBus.emitSync('search.index_deleted', { name }, 'SearchIndexManager');
  }

  /**
   * Register analyzer
   */
  registerAnalyzer(analyzer: Analyzer): void {
    this.analyzers.set(analyzer.name, analyzer);
  }

  /**
   * Analyze text
   */
  analyze(text: string, analyzerName: string): Token[] {
    const analyzer = this.analyzers.get(analyzerName);

    if (!analyzer) {
      return this.defaultAnalyze(text);
    }

    let tokens = this.tokenize(text, analyzer.tokenizer);

    for (const filter of analyzer.filters) {
      tokens = this.applyFilter(tokens, filter);
    }

    return tokens;
  }

  /**
   * Suggest completions
   */
  suggest(indexName: string, prefix: string, field: string, size: number = 10): Suggestion[] {
    const index = this.indexes.get(indexName);

    if (!index) {
      return [];
    }

    const suggestions: Suggestion[] = [];
    const prefixLower = prefix.toLowerCase();

    for (const [term, docIds] of index.invertedIndex) {
      if (term.startsWith(prefixLower)) {
        suggestions.push({
          text: term,
          score: docIds.size,
          freq: docIds.size,
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return suggestions.slice(0, size);
  }

  private executeQuery(index: SearchIndex, query: QueryExpression): Set<string> {
    switch (query.type) {
      case QueryType.Match:
        return this.executeMatchQuery(index, query);

      case QueryType.Term:
        return this.executeTermQuery(index, query);

      case QueryType.Range:
        return this.executeRangeQuery(index, query);

      case QueryType.Bool:
        return this.executeBoolQuery(index, query);

      case QueryType.Wildcard:
        return this.executeWildcardQuery(index, query);

      case QueryType.Fuzzy:
        return this.executeFuzzyQuery(index, query);

      default:
        return new Set(index.documents.keys());
    }
  }

  private executeMatchQuery(index: SearchIndex, query: QueryExpression): Set<string> {
    const tokens = this.analyze(String(query.value), index.schema.settings.analyzer);
    const results = new Set<string>();

    for (const token of tokens) {
      const docIds = index.invertedIndex.get(token.text);
      if (docIds) {
        docIds.forEach(id => results.add(id));
      }
    }

    return results;
  }

  private executeTermQuery(index: SearchIndex, query: QueryExpression): Set<string> {
    const term = String(query.value).toLowerCase();
    return index.invertedIndex.get(term) || new Set();
  }

  private executeRangeQuery(index: SearchIndex, query: QueryExpression): Set<string> {
    const results = new Set<string>();

    for (const [id, doc] of index.documents) {
      const value = doc.fields.get(query.field!);

      if (this.matchesRange(value, query.value)) {
        results.add(id);
      }
    }

    return results;
  }

  private executeBoolQuery(index: SearchIndex, query: QueryExpression): Set<string> {
    if (!query.queries || query.queries.length === 0) {
      return new Set();
    }

    const results = query.queries.map(q => this.executeQuery(index, q));

    switch (query.operator) {
      case QueryOperator.And:
        return this.intersectSets(results);

      case QueryOperator.Or:
        return this.unionSets(results);

      case QueryOperator.Not:
        return this.differenceSets(new Set(index.documents.keys()), results[0]);

      default:
        return results[0] || new Set();
    }
  }

  private executeWildcardQuery(index: SearchIndex, query: QueryExpression): Set<string> {
    const pattern = String(query.value).replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${pattern}$`, 'i');
    const results = new Set<string>();

    for (const [term, docIds] of index.invertedIndex) {
      if (regex.test(term)) {
        docIds.forEach(id => results.add(id));
      }
    }

    return results;
  }

  private executeFuzzyQuery(index: SearchIndex, query: QueryExpression): Set<string> {
    const searchTerm = String(query.value).toLowerCase();
    const results = new Set<string>();
    const maxDistance = 2;

    for (const [term, docIds] of index.invertedIndex) {
      if (this.levenshteinDistance(searchTerm, term) <= maxDistance) {
        docIds.forEach(id => results.add(id));
      }
    }

    return results;
  }

  private applyFilters(index: SearchIndex, candidates: Set<string>, filters: FilterExpression[]): Set<string> {
    const results = new Set<string>();

    for (const id of candidates) {
      const doc = index.documents.get(id);

      if (doc && this.matchesAllFilters(doc, filters)) {
        results.add(id);
      }
    }

    return results;
  }

  private matchesAllFilters(doc: IndexedDocument, filters: FilterExpression[]): boolean {
    return filters.every(filter => this.matchesFilter(doc, filter));
  }

  private matchesFilter(doc: IndexedDocument, filter: FilterExpression): boolean {
    const value = doc.fields.get(filter.field);

    switch (filter.operator) {
      case FilterOperator.Equals:
        return value === filter.value;

      case FilterOperator.NotEquals:
        return value !== filter.value;

      case FilterOperator.GreaterThan:
        return value > filter.value;

      case FilterOperator.GreaterThanOrEqual:
        return value >= filter.value;

      case FilterOperator.LessThan:
        return value < filter.value;

      case FilterOperator.LessThanOrEqual:
        return value <= filter.value;

      case FilterOperator.In:
        return Array.isArray(filter.value) && filter.value.includes(value);

      case FilterOperator.Contains:
        return String(value).includes(String(filter.value));

      default:
        return true;
    }
  }

  private scoreDocuments(index: SearchIndex, candidates: Set<string>, query: QueryExpression): SearchHit[] {
    const hits: SearchHit[] = [];

    for (const id of candidates) {
      const doc = index.documents.get(id);

      if (doc) {
        const score = this.calculateScore(index, doc, query);

        hits.push({
          id,
          score,
          fields: Object.fromEntries(doc.fields),
        });
      }
    }

    return hits;
  }

  private calculateScore(index: SearchIndex, doc: IndexedDocument, query: QueryExpression): number {
    // Simple TF-IDF scoring
    let score = 0;

    if (query.type === QueryType.Match && query.field) {
      const fieldValue = doc.fields.get(query.field);

      if (fieldValue) {
        const tokens = this.analyze(String(query.value), index.schema.settings.analyzer);

        for (const token of tokens) {
          const tf = this.termFrequency(String(fieldValue), token.text);
          const idf = this.inverseDocumentFrequency(index, token.text);
          score += tf * idf;
        }
      }
    } else {
      score = 1.0;
    }

    // Apply boost
    if (query.boost) {
      score *= query.boost;
    }

    return score;
  }

  private termFrequency(text: string, term: string): number {
    const tokens = text.toLowerCase().split(/\s+/);
    const count = tokens.filter(t => t === term).length;
    return count / tokens.length;
  }

  private inverseDocumentFrequency(index: SearchIndex, term: string): number {
    const docCount = index.documents.size;
    const termDocCount = index.invertedIndex.get(term)?.size || 0;

    if (termDocCount === 0) {
      return 0;
    }

    return Math.log(docCount / termDocCount);
  }

  private sortHits(hits: SearchHit[], criteria: SortCriteria[]): void {
    hits.sort((a, b) => {
      for (const criterion of criteria) {
        const aValue = a.fields[criterion.field];
        const bValue = b.fields[criterion.field];

        if (aValue !== bValue) {
          const comparison = aValue < bValue ? -1 : 1;
          return criterion.order === SortOrder.Ascending ? comparison : -comparison;
        }
      }

      return 0;
    });
  }

  private applyHighlight(hits: SearchHit[], config: HighlightConfig): void {
    const preTag = config.preTag || '<em>';
    const postTag = config.postTag || '</em>';

    for (const hit of hits) {
      hit.highlight = {};

      for (const field of config.fields) {
        const value = hit.fields[field];

        if (value) {
          // Simple highlighting
          hit.highlight[field] = [`${preTag}${value}${postTag}`];
        }
      }
    }
  }

  private calculateFacets(index: SearchIndex, candidates: Set<string>, configs: FacetConfig[]): FacetResult[] {
    const facets: FacetResult[] = [];

    for (const config of configs) {
      const buckets = new Map<any, number>();

      for (const id of candidates) {
        const doc = index.documents.get(id);

        if (doc) {
          const value = doc.fields.get(config.field);

          if (value !== undefined) {
            buckets.set(value, (buckets.get(value) || 0) + 1);
          }
        }
      }

      const facetBuckets: FacetBucket[] = Array.from(buckets.entries())
        .map(([value, count]) => ({ value, count }))
        .filter(b => !config.minCount || b.count >= config.minCount)
        .sort((a, b) => b.count - a.count);

      if (config.size) {
        facetBuckets.splice(config.size);
      }

      facets.push({
        field: config.field,
        buckets: facetBuckets,
      });
    }

    return facets;
  }

  private tokenize(text: string, tokenizer: string): Token[] {
    // Simple whitespace tokenizer
    const words = text.toLowerCase().split(/\s+/);
    const tokens: Token[] = [];

    let position = 0;
    let offset = 0;

    for (const word of words) {
      if (word) {
        tokens.push({
          text: word,
          position: position++,
          startOffset: offset,
          endOffset: offset + word.length,
        });
      }

      offset += word.length + 1;
    }

    return tokens;
  }

  private applyFilter(tokens: Token[], filter: string): Token[] {
    switch (filter) {
      case 'lowercase':
        return tokens.map(t => ({ ...t, text: t.text.toLowerCase() }));

      case 'stop':
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are']);
        return tokens.filter(t => !stopWords.has(t.text));

      case 'stem':
        return tokens.map(t => ({ ...t, text: this.stem(t.text) }));

      default:
        return tokens;
    }
  }

  private stem(word: string): string {
    // Very simple stemming
    if (word.endsWith('ing')) {
      return word.slice(0, -3);
    }
    if (word.endsWith('ed')) {
      return word.slice(0, -2);
    }
    if (word.endsWith('s')) {
      return word.slice(0, -1);
    }
    return word;
  }

  private defaultAnalyze(text: string): Token[] {
    return this.tokenize(text, 'standard');
  }

  private matchesRange(value: any, range: any): boolean {
    if (range.gte !== undefined && value < range.gte) return false;
    if (range.gt !== undefined && value <= range.gt) return false;
    if (range.lte !== undefined && value > range.lte) return false;
    if (range.lt !== undefined && value >= range.lt) return false;
    return true;
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

  private intersectSets(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) return new Set();

    const result = new Set(sets[0]);

    for (let i = 1; i < sets.length; i++) {
      for (const item of result) {
        if (!sets[i].has(item)) {
          result.delete(item);
        }
      }
    }

    return result;
  }

  private unionSets(sets: Set<string>[]): Set<string> {
    const result = new Set<string>();

    for (const set of sets) {
      for (const item of set) {
        result.add(item);
      }
    }

    return result;
  }

  private differenceSets(setA: Set<string>, setB: Set<string>): Set<string> {
    const result = new Set(setA);

    for (const item of setB) {
      result.delete(item);
    }

    return result;
  }

  private registerDefaultAnalyzers(): void {
    this.registerAnalyzer({
      name: 'standard',
      tokenizer: 'standard',
      filters: ['lowercase', 'stop'],
    });

    this.registerAnalyzer({
      name: 'simple',
      tokenizer: 'standard',
      filters: ['lowercase'],
    });

    this.registerAnalyzer({
      name: 'keyword',
      tokenizer: 'keyword',
      filters: [],
    });
  }

  private generateIndexId(): string {
    return `idx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Query Parser
 */
export class SearchQueryParser implements QueryParser {
  /**
   * Parse query string
   */
  parse(query: string): QueryExpression {
    // Simple query parser
    query = query.trim();

    // Check for boolean operators
    if (query.includes(' AND ')) {
      const parts = query.split(' AND ');
      return {
        type: QueryType.Bool,
        operator: QueryOperator.And,
        queries: parts.map(p => this.parse(p.trim())),
      };
    }

    if (query.includes(' OR ')) {
      const parts = query.split(' OR ');
      return {
        type: QueryType.Bool,
        operator: QueryOperator.Or,
        queries: parts.map(p => this.parse(p.trim())),
      };
    }

    // Check for field query
    const fieldMatch = query.match(/^(\w+):(.+)$/);
    if (fieldMatch) {
      const [, field, value] = fieldMatch;

      // Check for wildcards
      if (value.includes('*') || value.includes('?')) {
        return {
          type: QueryType.Wildcard,
          field,
          value,
        };
      }

      return {
        type: QueryType.Match,
        field,
        value: value.replace(/['"]/g, ''),
      };
    }

    // Default match query
    return {
      type: QueryType.Match,
      value: query,
    };
  }
}

/**
 * Singleton instances
 */
export const searchIndexManager = new SearchIndexManager();
export const searchQueryParser = new SearchQueryParser();
