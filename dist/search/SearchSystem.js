"use strict";
/**
 * Search Engine System
 * Full-text search, indexing, relevance scoring, faceted search, and query parsing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchQueryParser = exports.searchIndexManager = exports.SearchQueryParser = exports.SearchIndexManager = exports.SortOrder = exports.FilterOperator = exports.QueryOperator = exports.QueryType = exports.FieldType = void 0;
const EventBus_1 = require("../core/EventBus");
var FieldType;
(function (FieldType) {
    FieldType["Text"] = "text";
    FieldType["Keyword"] = "keyword";
    FieldType["Number"] = "number";
    FieldType["Date"] = "date";
    FieldType["Boolean"] = "boolean";
    FieldType["GeoPoint"] = "geo_point";
})(FieldType || (exports.FieldType = FieldType = {}));
var QueryType;
(function (QueryType) {
    QueryType["Match"] = "match";
    QueryType["MatchPhrase"] = "match_phrase";
    QueryType["Term"] = "term";
    QueryType["Terms"] = "terms";
    QueryType["Range"] = "range";
    QueryType["Wildcard"] = "wildcard";
    QueryType["Fuzzy"] = "fuzzy";
    QueryType["Bool"] = "bool";
    QueryType["MultiMatch"] = "multi_match";
})(QueryType || (exports.QueryType = QueryType = {}));
var QueryOperator;
(function (QueryOperator) {
    QueryOperator["And"] = "and";
    QueryOperator["Or"] = "or";
    QueryOperator["Not"] = "not";
})(QueryOperator || (exports.QueryOperator = QueryOperator = {}));
var FilterOperator;
(function (FilterOperator) {
    FilterOperator["Equals"] = "eq";
    FilterOperator["NotEquals"] = "ne";
    FilterOperator["GreaterThan"] = "gt";
    FilterOperator["GreaterThanOrEqual"] = "gte";
    FilterOperator["LessThan"] = "lt";
    FilterOperator["LessThanOrEqual"] = "lte";
    FilterOperator["In"] = "in";
    FilterOperator["NotIn"] = "nin";
    FilterOperator["Contains"] = "contains";
    FilterOperator["StartsWith"] = "starts_with";
    FilterOperator["EndsWith"] = "ends_with";
})(FilterOperator || (exports.FilterOperator = FilterOperator = {}));
var SortOrder;
(function (SortOrder) {
    SortOrder["Ascending"] = "asc";
    SortOrder["Descending"] = "desc";
})(SortOrder || (exports.SortOrder = SortOrder = {}));
/**
 * Search Index Manager
 */
class SearchIndexManager {
    indexes = new Map();
    analyzers = new Map();
    constructor() {
        this.registerDefaultAnalyzers();
    }
    /**
     * Create index
     */
    createIndex(name, schema) {
        const index = {
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
        EventBus_1.eventBus.emitSync('search.index_created', index, 'SearchIndexManager');
        return index;
    }
    /**
     * Index document
     */
    async indexDocument(indexName, id, document) {
        const index = this.indexes.get(indexName);
        if (!index) {
            throw new Error(`Index not found: ${indexName}`);
        }
        const fields = new Map();
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
                        index.invertedIndex.get(token.text).add(id);
                    }
                }
            }
        }
        const indexedDoc = {
            id,
            fields,
            version: 1,
            timestamp: new Date(),
        };
        index.documents.set(id, indexedDoc);
        index.statistics.documentCount++;
        EventBus_1.eventBus.emitSync('search.document_indexed', { indexName, id }, 'SearchIndexManager');
    }
    /**
     * Delete document
     */
    async deleteDocument(indexName, id) {
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
            EventBus_1.eventBus.emitSync('search.document_deleted', { indexName, id }, 'SearchIndexManager');
        }
    }
    /**
     * Search
     */
    async search(indexName, query) {
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
        }
        else {
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
        let facets;
        if (query.facets) {
            facets = this.calculateFacets(index, candidates, query.facets);
        }
        const result = {
            total: scoredHits.length,
            hits: paginatedHits,
            facets,
            took: Date.now() - startTime,
            maxScore: scoredHits.length > 0 ? scoredHits[0].score : undefined,
        };
        EventBus_1.eventBus.emitSync('search.query_executed', { indexName, took: result.took }, 'SearchIndexManager');
        return result;
    }
    /**
     * Get index
     */
    getIndex(name) {
        return this.indexes.get(name);
    }
    /**
     * List indexes
     */
    listIndexes() {
        return Array.from(this.indexes.values());
    }
    /**
     * Delete index
     */
    deleteIndex(name) {
        this.indexes.delete(name);
        EventBus_1.eventBus.emitSync('search.index_deleted', { name }, 'SearchIndexManager');
    }
    /**
     * Register analyzer
     */
    registerAnalyzer(analyzer) {
        this.analyzers.set(analyzer.name, analyzer);
    }
    /**
     * Analyze text
     */
    analyze(text, analyzerName) {
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
    suggest(indexName, prefix, field, size = 10) {
        const index = this.indexes.get(indexName);
        if (!index) {
            return [];
        }
        const suggestions = [];
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
    executeQuery(index, query) {
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
    executeMatchQuery(index, query) {
        const tokens = this.analyze(String(query.value), index.schema.settings.analyzer);
        const results = new Set();
        for (const token of tokens) {
            const docIds = index.invertedIndex.get(token.text);
            if (docIds) {
                docIds.forEach(id => results.add(id));
            }
        }
        return results;
    }
    executeTermQuery(index, query) {
        const term = String(query.value).toLowerCase();
        return index.invertedIndex.get(term) || new Set();
    }
    executeRangeQuery(index, query) {
        const results = new Set();
        for (const [id, doc] of index.documents) {
            const value = doc.fields.get(query.field);
            if (this.matchesRange(value, query.value)) {
                results.add(id);
            }
        }
        return results;
    }
    executeBoolQuery(index, query) {
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
    executeWildcardQuery(index, query) {
        const pattern = String(query.value).replace(/\*/g, '.*').replace(/\?/g, '.');
        const regex = new RegExp(`^${pattern}$`, 'i');
        const results = new Set();
        for (const [term, docIds] of index.invertedIndex) {
            if (regex.test(term)) {
                docIds.forEach(id => results.add(id));
            }
        }
        return results;
    }
    executeFuzzyQuery(index, query) {
        const searchTerm = String(query.value).toLowerCase();
        const results = new Set();
        const maxDistance = 2;
        for (const [term, docIds] of index.invertedIndex) {
            if (this.levenshteinDistance(searchTerm, term) <= maxDistance) {
                docIds.forEach(id => results.add(id));
            }
        }
        return results;
    }
    applyFilters(index, candidates, filters) {
        const results = new Set();
        for (const id of candidates) {
            const doc = index.documents.get(id);
            if (doc && this.matchesAllFilters(doc, filters)) {
                results.add(id);
            }
        }
        return results;
    }
    matchesAllFilters(doc, filters) {
        return filters.every(filter => this.matchesFilter(doc, filter));
    }
    matchesFilter(doc, filter) {
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
    scoreDocuments(index, candidates, query) {
        const hits = [];
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
    calculateScore(index, doc, query) {
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
        }
        else {
            score = 1.0;
        }
        // Apply boost
        if (query.boost) {
            score *= query.boost;
        }
        return score;
    }
    termFrequency(text, term) {
        const tokens = text.toLowerCase().split(/\s+/);
        const count = tokens.filter(t => t === term).length;
        return count / tokens.length;
    }
    inverseDocumentFrequency(index, term) {
        const docCount = index.documents.size;
        const termDocCount = index.invertedIndex.get(term)?.size || 0;
        if (termDocCount === 0) {
            return 0;
        }
        return Math.log(docCount / termDocCount);
    }
    sortHits(hits, criteria) {
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
    applyHighlight(hits, config) {
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
    calculateFacets(index, candidates, configs) {
        const facets = [];
        for (const config of configs) {
            const buckets = new Map();
            for (const id of candidates) {
                const doc = index.documents.get(id);
                if (doc) {
                    const value = doc.fields.get(config.field);
                    if (value !== undefined) {
                        buckets.set(value, (buckets.get(value) || 0) + 1);
                    }
                }
            }
            const facetBuckets = Array.from(buckets.entries())
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
    tokenize(text, tokenizer) {
        // Simple whitespace tokenizer
        const words = text.toLowerCase().split(/\s+/);
        const tokens = [];
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
    applyFilter(tokens, filter) {
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
    stem(word) {
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
    defaultAnalyze(text) {
        return this.tokenize(text, 'standard');
    }
    matchesRange(value, range) {
        if (range.gte !== undefined && value < range.gte)
            return false;
        if (range.gt !== undefined && value <= range.gt)
            return false;
        if (range.lte !== undefined && value > range.lte)
            return false;
        if (range.lt !== undefined && value >= range.lt)
            return false;
        return true;
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
    intersectSets(sets) {
        if (sets.length === 0)
            return new Set();
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
    unionSets(sets) {
        const result = new Set();
        for (const set of sets) {
            for (const item of set) {
                result.add(item);
            }
        }
        return result;
    }
    differenceSets(setA, setB) {
        const result = new Set(setA);
        for (const item of setB) {
            result.delete(item);
        }
        return result;
    }
    registerDefaultAnalyzers() {
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
    generateIndexId() {
        return `idx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SearchIndexManager = SearchIndexManager;
/**
 * Query Parser
 */
class SearchQueryParser {
    /**
     * Parse query string
     */
    parse(query) {
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
exports.SearchQueryParser = SearchQueryParser;
/**
 * Singleton instances
 */
exports.searchIndexManager = new SearchIndexManager();
exports.searchQueryParser = new SearchQueryParser();
