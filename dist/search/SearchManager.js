"use strict";
/**
 * Advanced Search & Indexing System
 * Full-text search, semantic search, faceted search
 * Real-time indexing, query optimization, relevance scoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchManager = void 0;
const events_1 = require("events");
// ============================================================================
// Search Manager
// ============================================================================
class SearchManager extends events_1.EventEmitter {
    config;
    indexes = new Map();
    analyzers = new Map();
    queryParser;
    constructor(config = {}) {
        super();
        this.config = {
            indexDirectory: './indexes',
            enableFuzzySearch: true,
            enableSemanticSearch: false,
            maxResults: 100,
            minScore: 0.0,
            highlightEnabled: true,
            synonymsEnabled: true,
            stopWordsEnabled: true,
            ...config,
        };
        this.queryParser = new DefaultQueryParser();
        this.registerDefaultAnalyzers();
    }
    // ========================================================================
    // Index Management
    // ========================================================================
    createIndex(name, fields, settings) {
        const index = {
            id: this.generateId(),
            name,
            type: 'full_text',
            fields,
            documents: new Map(),
            statistics: {
                documentCount: 0,
                totalSize: 0,
                fieldStats: new Map(),
                lastIndexed: Date.now(),
            },
            settings: {
                analyzer: 'standard',
                similarity: 'BM25',
                shards: 1,
                replicas: 0,
                refreshInterval: 1000,
                ...settings,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.indexes.set(name, index);
        this.emit('index:created', { index });
        return index;
    }
    getIndex(name) {
        return this.indexes.get(name);
    }
    deleteIndex(name) {
        this.indexes.delete(name);
        this.emit('index:deleted', { name });
    }
    listIndexes() {
        return Array.from(this.indexes.values());
    }
    // ========================================================================
    // Document Indexing
    // ========================================================================
    async indexDocument(indexName, id, document) {
        const index = this.indexes.get(indexName);
        if (!index) {
            throw new Error(`Index not found: ${indexName}`);
        }
        this.emit('document:index:start', { indexName, id });
        // Analyze and index document
        const indexedDoc = {
            id,
            fields: {},
            timestamp: Date.now(),
        };
        for (const field of index.fields) {
            const value = document[field.name];
            if (value !== undefined) {
                if (field.analyzed) {
                    indexedDoc.fields[field.name] = await this.analyzeField(value, index.settings.analyzer);
                }
                else {
                    indexedDoc.fields[field.name] = value;
                }
            }
        }
        // Generate vector if semantic search enabled
        if (this.config.enableSemanticSearch) {
            indexedDoc.vector = await this.generateEmbedding(document);
        }
        index.documents.set(id, indexedDoc);
        index.statistics.documentCount = index.documents.size;
        index.statistics.lastIndexed = Date.now();
        index.updatedAt = Date.now();
        this.emit('document:indexed', { indexName, id, document: indexedDoc });
    }
    async indexDocuments(indexName, documents) {
        for (const [id, doc] of Object.entries(documents)) {
            await this.indexDocument(indexName, id, doc);
        }
    }
    async updateDocument(indexName, id, updates) {
        const index = this.indexes.get(indexName);
        if (!index) {
            throw new Error(`Index not found: ${indexName}`);
        }
        const existing = index.documents.get(id);
        if (!existing) {
            throw new Error(`Document not found: ${id}`);
        }
        // Merge updates
        const updated = { ...existing.fields, ...updates };
        await this.indexDocument(indexName, id, updated);
        this.emit('document:updated', { indexName, id });
    }
    deleteDocument(indexName, id) {
        const index = this.indexes.get(indexName);
        if (!index) {
            throw new Error(`Index not found: ${indexName}`);
        }
        index.documents.delete(id);
        index.statistics.documentCount = index.documents.size;
        this.emit('document:deleted', { indexName, id });
    }
    // ========================================================================
    // Search
    // ========================================================================
    async search(indexName, query) {
        const startTime = Date.now();
        const index = this.indexes.get(indexName);
        if (!index) {
            throw new Error(`Index not found: ${indexName}`);
        }
        this.emit('search:start', { indexName, query });
        // Parse query
        const parsedQuery = this.queryParser.parse(query.query);
        // Execute search
        let hits = await this.executeSearch(index, query, parsedQuery);
        // Apply filters
        if (query.filters && query.filters.length > 0) {
            hits = this.applyFilters(hits, query.filters);
        }
        // Sort results
        if (query.sort && query.sort.length > 0) {
            hits = this.sortHits(hits, query.sort);
        }
        else {
            // Default sort by score
            hits.sort((a, b) => b.score - a.score);
        }
        // Apply pagination
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;
        const start = (page - 1) * pageSize;
        const paginatedHits = hits.slice(start, start + pageSize);
        // Calculate facets
        const facets = query.facets
            ? await this.calculateFacets(hits, query.facets)
            : undefined;
        // Generate suggestions
        const suggestions = await this.generateSuggestions(index, query.query);
        // Apply highlighting
        if (query.highlight && this.config.highlightEnabled) {
            for (const hit of paginatedHits) {
                hit.highlights = this.highlightFields(hit, query.query, query.highlight);
            }
        }
        const result = {
            query,
            hits: paginatedHits,
            total: hits.length,
            maxScore: hits.length > 0 ? hits[0].score : 0,
            took: Date.now() - startTime,
            facets,
            suggestions,
        };
        this.emit('search:complete', { indexName, result });
        return result;
    }
    async executeSearch(index, query, parsed) {
        const hits = [];
        for (const [id, doc] of index.documents.entries()) {
            const score = this.calculateScore(doc, query, parsed, index);
            if (score >= (query.options?.minScore || this.config.minScore)) {
                hits.push({
                    id,
                    score,
                    fields: doc.fields,
                });
            }
        }
        return hits;
    }
    calculateScore(doc, query, parsed, index) {
        let score = 0;
        const queryTerms = this.extractTerms(query.query);
        const searchFields = query.fields || index.fields.map(f => f.name);
        for (const field of searchFields) {
            const fieldValue = doc.fields[field];
            if (!fieldValue)
                continue;
            const fieldConfig = index.fields.find(f => f.name === field);
            const boost = fieldConfig?.boost || 1.0;
            // Calculate field score based on similarity type
            const fieldScore = this.calculateFieldScore(fieldValue, queryTerms, index.settings.similarity);
            score += fieldScore * boost;
        }
        // Apply fuzzy matching if enabled
        if (this.config.enableFuzzySearch && query.type === 'fuzzy') {
            score *= 0.8; // Reduce score for fuzzy matches
        }
        return score;
    }
    calculateFieldScore(fieldValue, queryTerms, similarity) {
        const fieldText = String(fieldValue).toLowerCase();
        switch (similarity) {
            case 'BM25':
                return this.calculateBM25(fieldText, queryTerms);
            case 'TF_IDF':
                return this.calculateTFIDF(fieldText, queryTerms);
            case 'cosine':
                return this.calculateCosine(fieldText, queryTerms);
            default:
                return this.calculateSimpleMatch(fieldText, queryTerms);
        }
    }
    calculateBM25(text, terms) {
        const k1 = 1.5;
        const b = 0.75;
        let score = 0;
        const textTerms = text.split(/\s+/);
        const docLength = textTerms.length;
        const avgDocLength = 100; // Simplified
        for (const term of terms) {
            const termFreq = textTerms.filter(t => t === term).length;
            if (termFreq > 0) {
                const idf = Math.log((1 + 0.5) / (termFreq + 0.5));
                const tf = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));
                score += idf * tf;
            }
        }
        return score;
    }
    calculateTFIDF(text, terms) {
        let score = 0;
        const textTerms = text.split(/\s+/);
        for (const term of terms) {
            const tf = textTerms.filter(t => t === term).length / textTerms.length;
            const idf = Math.log(100 / (1 + textTerms.filter(t => t === term).length));
            score += tf * idf;
        }
        return score;
    }
    calculateCosine(text, terms) {
        const textTerms = text.split(/\s+/);
        const intersection = terms.filter(t => textTerms.includes(t)).length;
        const magnitude1 = Math.sqrt(terms.length);
        const magnitude2 = Math.sqrt(textTerms.length);
        return intersection / (magnitude1 * magnitude2);
    }
    calculateSimpleMatch(text, terms) {
        let matches = 0;
        for (const term of terms) {
            if (text.includes(term)) {
                matches++;
            }
        }
        return matches / terms.length;
    }
    // ========================================================================
    // Filtering & Sorting
    // ========================================================================
    applyFilters(hits, filters) {
        return hits.filter(hit => {
            for (const filter of filters) {
                const value = hit.fields[filter.field];
                if (!this.evaluateFilter(value, filter)) {
                    return false;
                }
            }
            return true;
        });
    }
    evaluateFilter(value, filter) {
        switch (filter.operator) {
            case 'equals':
                return value === filter.value;
            case 'not_equals':
                return value !== filter.value;
            case 'greater_than':
                return value > filter.value;
            case 'less_than':
                return value < filter.value;
            case 'between':
                return value >= filter.value[0] && value <= filter.value[1];
            case 'in':
                return Array.isArray(filter.value) && filter.value.includes(value);
            case 'not_in':
                return Array.isArray(filter.value) && !filter.value.includes(value);
            case 'contains':
                return String(value).includes(String(filter.value));
            case 'starts_with':
                return String(value).startsWith(String(filter.value));
            case 'ends_with':
                return String(value).endsWith(String(filter.value));
            case 'exists':
                return value !== undefined && value !== null;
            default:
                return true;
        }
    }
    sortHits(hits, criteria) {
        return hits.sort((a, b) => {
            for (const sort of criteria) {
                const aValue = a.fields[sort.field];
                const bValue = b.fields[sort.field];
                if (aValue < bValue)
                    return sort.order === 'asc' ? -1 : 1;
                if (aValue > bValue)
                    return sort.order === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
    // ========================================================================
    // Faceting
    // ========================================================================
    async calculateFacets(hits, facets) {
        const results = [];
        for (const facet of facets) {
            const valueCounts = new Map();
            for (const hit of hits) {
                const value = hit.fields[facet.field];
                if (value !== undefined) {
                    valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
                }
            }
            const values = Array.from(valueCounts.entries())
                .filter(([_, count]) => count >= (facet.minCount || 1))
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, facet.size || 10);
            results.push({
                field: facet.field,
                values,
                total: valueCounts.size,
            });
        }
        return results;
    }
    // ========================================================================
    // Highlighting
    // ========================================================================
    highlightFields(hit, query, options) {
        const highlights = {};
        const terms = this.extractTerms(query);
        const preTag = options.preTag || '<em>';
        const postTag = options.postTag || '</em>';
        for (const field of options.fields) {
            const value = String(hit.fields[field] || '');
            const fragments = [];
            let highlighted = value;
            for (const term of terms) {
                const regex = new RegExp(`\\b${term}\\b`, 'gi');
                highlighted = highlighted.replace(regex, `${preTag}$&${postTag}`);
            }
            fragments.push(highlighted);
            highlights[field] = fragments;
        }
        return highlights;
    }
    // ========================================================================
    // Suggestions
    // ========================================================================
    async generateSuggestions(index, query) {
        const suggestions = [];
        // Simple suggestion based on indexed terms
        const queryTerms = this.extractTerms(query);
        const allTerms = new Set();
        for (const doc of index.documents.values()) {
            for (const field of index.fields) {
                if (field.type === 'text') {
                    const value = String(doc.fields[field.name] || '');
                    const terms = this.extractTerms(value);
                    terms.forEach(t => allTerms.add(t));
                }
            }
        }
        // Find similar terms
        for (const term of allTerms) {
            if (this.isSimilar(queryTerms[0], term)) {
                suggestions.push({
                    text: term,
                    score: this.calculateSimilarity(queryTerms[0], term),
                    freq: 1,
                });
            }
        }
        return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
    }
    isSimilar(term1, term2) {
        if (term1 === term2)
            return false;
        return this.levenshteinDistance(term1, term2) <= 2;
    }
    calculateSimilarity(term1, term2) {
        const distance = this.levenshteinDistance(term1, term2);
        const maxLength = Math.max(term1.length, term2.length);
        return 1 - distance / maxLength;
    }
    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    // ========================================================================
    // Text Analysis
    // ========================================================================
    registerDefaultAnalyzers() {
        this.analyzers.set('standard', {
            name: 'standard',
            tokenizer: { type: 'standard' },
            filters: [{ type: 'lowercase' }, { type: 'stop' }],
        });
        this.analyzers.set('simple', {
            name: 'simple',
            tokenizer: { type: 'whitespace' },
            filters: [{ type: 'lowercase' }],
        });
        this.analyzers.set('keyword', {
            name: 'keyword',
            tokenizer: { type: 'keyword' },
            filters: [],
        });
    }
    async analyzeField(value, analyzerName) {
        const analyzer = this.analyzers.get(analyzerName);
        if (!analyzer) {
            return String(value);
        }
        let text = String(value);
        // Apply tokenization
        const tokens = this.tokenize(text, analyzer.tokenizer);
        // Apply filters
        let processedTokens = tokens;
        for (const filter of analyzer.filters) {
            processedTokens = this.applyFilter(processedTokens, filter);
        }
        return processedTokens.map(t => t.text).join(' ');
    }
    tokenize(text, tokenizer) {
        const tokens = [];
        let position = 0;
        switch (tokenizer.type) {
            case 'standard':
            case 'whitespace':
                const words = text.split(/\s+/);
                for (const word of words) {
                    if (word) {
                        tokens.push({
                            text: word,
                            position: position++,
                            startOffset: 0,
                            endOffset: word.length,
                            type: 'word',
                        });
                    }
                }
                break;
            case 'keyword':
                tokens.push({
                    text,
                    position: 0,
                    startOffset: 0,
                    endOffset: text.length,
                    type: 'keyword',
                });
                break;
            default:
                break;
        }
        return tokens;
    }
    applyFilter(tokens, filter) {
        switch (filter.type) {
            case 'lowercase':
                return tokens.map(t => ({ ...t, text: t.text.toLowerCase() }));
            case 'uppercase':
                return tokens.map(t => ({ ...t, text: t.text.toUpperCase() }));
            case 'stop':
                const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but']);
                return tokens.filter(t => !stopWords.has(t.text.toLowerCase()));
            default:
                return tokens;
        }
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    extractTerms(text) {
        return text
            .toLowerCase()
            .split(/\s+/)
            .filter(t => t.length > 0);
    }
    async generateEmbedding(document) {
        // Simplified embedding generation
        const text = Object.values(document).join(' ');
        return Array.from({ length: 384 }, () => Math.random());
    }
    generateId() {
        return `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getStats() {
        return {
            indexes: this.indexes.size,
            totalDocuments: Array.from(this.indexes.values()).reduce((sum, idx) => sum + idx.statistics.documentCount, 0),
            analyzers: this.analyzers.size,
        };
    }
}
exports.SearchManager = SearchManager;
// ============================================================================
// Query Parser
// ============================================================================
class DefaultQueryParser {
    parse(query) {
        const clauses = [];
        // Simple parsing: split by spaces
        const terms = query.split(/\s+/);
        for (const term of terms) {
            if (term) {
                clauses.push({
                    type: 'term',
                    value: term,
                });
            }
        }
        return {
            type: 'boolean',
            clauses,
        };
    }
}
// ============================================================================
// Export
// ============================================================================
exports.default = SearchManager;
