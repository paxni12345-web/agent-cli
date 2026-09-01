"use strict";
/**
 * DatasetManager - Dataset versioning, augmentation, and quality filtering
 * Comprehensive dataset management for ML training
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetManager = void 0;
const events_1 = require("events");
const crypto = __importStar(require("crypto"));
class DatasetManager extends events_1.EventEmitter {
    datasets = new Map();
    versions = new Map();
    constructor() {
        super();
    }
    /**
     * Create new dataset
     */
    createDataset(name, examples, metadata) {
        const datasetId = this.generateId();
        const dataset = {
            id: datasetId,
            name,
            version: '1.0.0',
            examples: examples.map(e => ({ ...e, id: e.id || this.generateId() })),
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                author: 'system',
                description: '',
                tags: [],
                license: 'MIT',
                size: examples.length,
                ...metadata
            },
            statistics: this.calculateStatistics(examples),
            quality: this.calculateQualityMetrics(examples)
        };
        this.datasets.set(datasetId, dataset);
        this.versions.set(datasetId, [dataset]);
        this.emit('dataset:created', dataset);
        return datasetId;
    }
    /**
     * Add examples to dataset
     */
    addExamples(datasetId, examples) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            throw new Error(`Dataset ${datasetId} not found`);
        const newExamples = examples.map(e => ({
            ...e,
            id: e.id || this.generateId()
        }));
        dataset.examples.push(...newExamples);
        dataset.metadata.updatedAt = new Date();
        dataset.metadata.size = dataset.examples.length;
        dataset.statistics = this.calculateStatistics(dataset.examples);
        dataset.quality = this.calculateQualityMetrics(dataset.examples);
        this.emit('dataset:updated', dataset);
    }
    /**
     * Augment dataset
     */
    async augmentDataset(datasetId, config) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            throw new Error(`Dataset ${datasetId} not found`);
        const originalSize = dataset.examples.length;
        const augmentedExamples = [];
        for (const example of dataset.examples) {
            for (let i = 0; i < config.factor; i++) {
                for (const method of config.methods) {
                    const augmented = await this.applyAugmentation(example, method);
                    augmentedExamples.push({
                        ...augmented,
                        id: this.generateId(),
                        augmented: true,
                        source: example.id
                    });
                }
            }
        }
        if (config.preserveOriginal) {
            dataset.examples.push(...augmentedExamples);
        }
        else {
            dataset.examples = augmentedExamples;
        }
        dataset.metadata.updatedAt = new Date();
        dataset.metadata.size = dataset.examples.length;
        dataset.statistics = this.calculateStatistics(dataset.examples);
        this.emit('dataset:augmented', {
            datasetId,
            originalSize,
            newSize: dataset.examples.length,
            augmentedCount: augmentedExamples.length
        });
        return augmentedExamples.length;
    }
    /**
     * Apply single augmentation method
     */
    async applyAugmentation(example, method) {
        let input = example.input;
        let output = example.output;
        switch (method) {
            case 'paraphrase':
                input = this.paraphrase(input);
                break;
            case 'synonym_replacement':
                input = this.replaceSynonyms(input);
                break;
            case 'random_insertion':
                input = this.randomInsertion(input);
                break;
            case 'random_swap':
                input = this.randomSwap(input);
                break;
            case 'random_deletion':
                input = this.randomDeletion(input);
                break;
            case 'backtranslation':
                input = await this.backtranslate(input);
                break;
        }
        return { ...example, input, output };
    }
    paraphrase(text) {
        // Simple paraphrasing simulation
        return text
            .replace(/\bis\b/g, 'is being')
            .replace(/\bwas\b/g, 'had been')
            .replace(/\bcan\b/g, 'is able to');
    }
    replaceSynonyms(text) {
        const synonyms = {
            good: ['great', 'excellent', 'fine'],
            bad: ['poor', 'terrible', 'awful'],
            big: ['large', 'huge', 'enormous'],
            small: ['tiny', 'little', 'compact']
        };
        let result = text;
        for (const [word, syns] of Object.entries(synonyms)) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (regex.test(result)) {
                const replacement = syns[Math.floor(Math.random() * syns.length)];
                result = result.replace(regex, replacement);
            }
        }
        return result;
    }
    randomInsertion(text) {
        const words = text.split(' ');
        const fillers = ['actually', 'really', 'basically', 'essentially'];
        const insertPos = Math.floor(Math.random() * words.length);
        const filler = fillers[Math.floor(Math.random() * fillers.length)];
        words.splice(insertPos, 0, filler);
        return words.join(' ');
    }
    randomSwap(text) {
        const words = text.split(' ');
        if (words.length < 2)
            return text;
        const i = Math.floor(Math.random() * (words.length - 1));
        [words[i], words[i + 1]] = [words[i + 1], words[i]];
        return words.join(' ');
    }
    randomDeletion(text) {
        const words = text.split(' ');
        if (words.length < 2)
            return text;
        const deletePos = Math.floor(Math.random() * words.length);
        words.splice(deletePos, 1);
        return words.join(' ');
    }
    async backtranslate(text) {
        // Simulate backtranslation
        await new Promise(resolve => setTimeout(resolve, 100));
        return text;
    }
    /**
     * Filter dataset by quality
     */
    filterDataset(datasetId, config) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            throw new Error(`Dataset ${datasetId} not found`);
        const originalSize = dataset.examples.length;
        let filtered = dataset.examples;
        // Filter by length
        filtered = filtered.filter(e => {
            const inputLen = e.input.length;
            const outputLen = e.output.length;
            return (inputLen >= config.minLength &&
                inputLen <= config.maxLength &&
                outputLen >= config.minLength &&
                outputLen <= config.maxLength);
        });
        // Filter by quality
        if (config.minQuality > 0) {
            filtered = filtered.filter(e => (e.quality || 1) >= config.minQuality);
        }
        // Remove duplicates
        if (config.removeDuplicates) {
            filtered = this.removeDuplicates(filtered);
        }
        // Remove outliers
        if (config.removeOutliers) {
            filtered = this.removeOutliers(filtered);
        }
        dataset.examples = filtered;
        dataset.metadata.updatedAt = new Date();
        dataset.metadata.size = filtered.length;
        dataset.statistics = this.calculateStatistics(filtered);
        const removed = originalSize - filtered.length;
        this.emit('dataset:filtered', { datasetId, originalSize, newSize: filtered.length, removed });
        return removed;
    }
    /**
     * Remove duplicate examples
     */
    removeDuplicates(examples) {
        const seen = new Set();
        return examples.filter(e => {
            const hash = this.hashExample(e);
            if (seen.has(hash))
                return false;
            seen.add(hash);
            return true;
        });
    }
    /**
     * Remove statistical outliers
     */
    removeOutliers(examples) {
        const lengths = examples.map(e => e.input.length + e.output.length);
        const mean = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
        const stdDev = Math.sqrt(lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length);
        return examples.filter(e => {
            const length = e.input.length + e.output.length;
            return Math.abs(length - mean) <= 3 * stdDev;
        });
    }
    /**
     * Detect bias in dataset
     */
    detectBias(datasetId) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            throw new Error(`Dataset ${datasetId} not found`);
        const biasTypes = [];
        const affectedExamples = [];
        const recommendations = [];
        // Check for gender bias
        const genderTerms = /\b(he|she|him|her|his|hers|man|woman|male|female)\b/gi;
        const genderBiased = dataset.examples.filter(e => genderTerms.test(e.input) || genderTerms.test(e.output));
        if (genderBiased.length > dataset.examples.length * 0.3) {
            biasTypes.push('gender');
            recommendations.push('Balance gender representation in examples');
        }
        // Check for length bias
        const lengths = dataset.examples.map(e => e.input.length);
        const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
        const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
        if (lengthVariance < avgLength * 0.1) {
            biasTypes.push('length_uniformity');
            recommendations.push('Include more diverse example lengths');
        }
        // Determine severity
        const severity = biasTypes.length === 0 ? 'low' :
            biasTypes.length === 1 ? 'medium' : 'high';
        return {
            biasTypes,
            severity,
            affectedExamples: affectedExamples.slice(0, 10),
            recommendations
        };
    }
    /**
     * Calculate dataset statistics
     */
    calculateStatistics(examples) {
        const inputLengths = examples.map(e => e.input.length);
        const outputLengths = examples.map(e => e.output.length);
        const uniqueHashes = new Set(examples.map(e => this.hashExample(e)));
        return {
            totalExamples: examples.length,
            avgInputLength: inputLengths.reduce((sum, l) => sum + l, 0) / inputLengths.length,
            avgOutputLength: outputLengths.reduce((sum, l) => sum + l, 0) / outputLengths.length,
            uniqueExamples: uniqueHashes.size,
            duplicates: examples.length - uniqueHashes.size,
            distribution: this.calculateDistribution(examples)
        };
    }
    /**
     * Calculate quality metrics
     */
    calculateQualityMetrics(examples) {
        const qualities = examples.map(e => e.quality || this.assessQuality(e));
        const low = qualities.filter(q => q < 0.5).length;
        const medium = qualities.filter(q => q >= 0.5 && q < 0.8).length;
        const high = qualities.filter(q => q >= 0.8).length;
        return {
            avgQuality: qualities.reduce((sum, q) => sum + q, 0) / qualities.length,
            lowQualityCount: low,
            mediumQualityCount: medium,
            highQualityCount: high,
            biasScore: this.calculateBiasScore(examples),
            diversityScore: this.calculateDiversityScore(examples)
        };
    }
    /**
     * Assess example quality
     */
    assessQuality(example) {
        let score = 1.0;
        // Penalize very short examples
        if (example.input.length < 10 || example.output.length < 10) {
            score -= 0.3;
        }
        // Penalize very long examples
        if (example.input.length > 1000 || example.output.length > 1000) {
            score -= 0.2;
        }
        // Reward proper formatting
        if (/^[A-Z]/.test(example.input) && /[.!?]$/.test(example.output)) {
            score += 0.1;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate bias score
     */
    calculateBiasScore(examples) {
        const biasResult = this.detectBias(examples[0]?.id?.split('_')[1] || 'temp');
        return biasResult.biasTypes.length / 5; // Normalize to 0-1
    }
    /**
     * Calculate diversity score
     */
    calculateDiversityScore(examples) {
        const uniqueWords = new Set();
        examples.forEach(e => {
            const words = (e.input + ' ' + e.output).toLowerCase().split(/\s+/);
            words.forEach(w => uniqueWords.add(w));
        });
        const totalWords = examples.reduce((sum, e) => sum + e.input.split(/\s+/).length + e.output.split(/\s+/).length, 0);
        return uniqueWords.size / totalWords;
    }
    /**
     * Calculate distribution
     */
    calculateDistribution(examples) {
        const dist = {
            'very_short': 0,
            'short': 0,
            'medium': 0,
            'long': 0,
            'very_long': 0
        };
        examples.forEach(e => {
            const totalLength = e.input.length + e.output.length;
            if (totalLength < 50)
                dist['very_short']++;
            else if (totalLength < 100)
                dist['short']++;
            else if (totalLength < 500)
                dist['medium']++;
            else if (totalLength < 1000)
                dist['long']++;
            else
                dist['very_long']++;
        });
        return dist;
    }
    /**
     * Create dataset version
     */
    createVersion(datasetId, versionName) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            throw new Error(`Dataset ${datasetId} not found`);
        const newVersion = JSON.parse(JSON.stringify(dataset));
        newVersion.version = versionName;
        newVersion.metadata.updatedAt = new Date();
        const versions = this.versions.get(datasetId) || [];
        versions.push(newVersion);
        this.versions.set(datasetId, versions);
        this.emit('version:created', { datasetId, version: versionName });
        return versionName;
    }
    /**
     * Get dataset version
     */
    getVersion(datasetId, version) {
        const versions = this.versions.get(datasetId);
        return versions?.find(v => v.version === version) || null;
    }
    /**
     * List all versions
     */
    listVersions(datasetId) {
        const versions = this.versions.get(datasetId) || [];
        return versions.map(v => v.version);
    }
    /**
     * Export dataset
     */
    exportDataset(datasetId, format) {
        const dataset = this.datasets.get(datasetId);
        if (!dataset)
            throw new Error(`Dataset ${datasetId} not found`);
        switch (format) {
            case 'json':
                return JSON.stringify(dataset, null, 2);
            case 'jsonl':
                return dataset.examples.map(e => JSON.stringify(e)).join('\n');
            case 'csv':
                const header = 'id,input,output,quality\n';
                const rows = dataset.examples.map(e => `"${e.id}","${e.input}","${e.output}",${e.quality || 1}`).join('\n');
                return header + rows;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    /**
     * Import dataset
     */
    importDataset(name, data, format) {
        let examples = [];
        switch (format) {
            case 'json':
                const parsed = JSON.parse(data);
                examples = parsed.examples || parsed;
                break;
            case 'jsonl':
                examples = data.split('\n').filter(Boolean).map(line => JSON.parse(line));
                break;
            case 'csv':
                const lines = data.split('\n').slice(1); // Skip header
                examples = lines.map(line => {
                    const [id, input, output, quality] = line.split(',').map(s => s.replace(/^"|"$/g, ''));
                    return { id, input, output, quality: parseFloat(quality) };
                });
                break;
        }
        return this.createDataset(name, examples, { description: `Imported from ${format}` });
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return crypto.randomBytes(8).toString('hex');
    }
    /**
     * Hash example for deduplication
     */
    hashExample(example) {
        const content = example.input + '|' + example.output;
        return crypto.createHash('md5').update(content).digest('hex');
    }
    /**
     * Get dataset
     */
    getDataset(datasetId) {
        return this.datasets.get(datasetId) || null;
    }
    /**
     * Delete dataset
     */
    deleteDataset(datasetId) {
        this.datasets.delete(datasetId);
        this.versions.delete(datasetId);
        this.emit('dataset:deleted', { datasetId });
    }
    /**
     * List all datasets
     */
    listDatasets() {
        return Array.from(this.datasets.values());
    }
}
exports.DatasetManager = DatasetManager;
exports.default = DatasetManager;
