/**
 * DatasetManager - Dataset versioning, augmentation, and quality filtering
 * Comprehensive dataset management for ML training
 */
import { EventEmitter } from 'events';
export interface Dataset {
    id: string;
    name: string;
    version: string;
    examples: DataExample[];
    metadata: DatasetMetadata;
    statistics: DatasetStatistics;
    quality: QualityMetrics;
}
export interface DataExample {
    id: string;
    input: string;
    output: string;
    metadata?: Record<string, any>;
    quality?: number;
    augmented?: boolean;
    source?: string;
}
export interface DatasetMetadata {
    createdAt: Date;
    updatedAt: Date;
    author: string;
    description: string;
    tags: string[];
    license: string;
    size: number;
}
export interface DatasetStatistics {
    totalExamples: number;
    avgInputLength: number;
    avgOutputLength: number;
    uniqueExamples: number;
    duplicates: number;
    distribution: Record<string, number>;
}
export interface QualityMetrics {
    avgQuality: number;
    lowQualityCount: number;
    mediumQualityCount: number;
    highQualityCount: number;
    biasScore: number;
    diversityScore: number;
}
export interface AugmentationConfig {
    methods: AugmentationMethod[];
    factor: number;
    preserveOriginal: boolean;
}
export type AugmentationMethod = 'paraphrase' | 'backtranslation' | 'synonym_replacement' | 'random_insertion' | 'random_swap' | 'random_deletion';
export interface FilterConfig {
    minLength: number;
    maxLength: number;
    minQuality: number;
    removeDuplicates: boolean;
    removeOutliers: boolean;
}
export interface BiasDetectionResult {
    biasTypes: string[];
    severity: 'low' | 'medium' | 'high';
    affectedExamples: string[];
    recommendations: string[];
}
export declare class DatasetManager extends EventEmitter {
    private datasets;
    private versions;
    constructor();
    /**
     * Create new dataset
     */
    createDataset(name: string, examples: DataExample[], metadata: Partial<DatasetMetadata>): string;
    /**
     * Add examples to dataset
     */
    addExamples(datasetId: string, examples: DataExample[]): void;
    /**
     * Augment dataset
     */
    augmentDataset(datasetId: string, config: AugmentationConfig): Promise<number>;
    /**
     * Apply single augmentation method
     */
    private applyAugmentation;
    private paraphrase;
    private replaceSynonyms;
    private randomInsertion;
    private randomSwap;
    private randomDeletion;
    private backtranslate;
    /**
     * Filter dataset by quality
     */
    filterDataset(datasetId: string, config: FilterConfig): number;
    /**
     * Remove duplicate examples
     */
    private removeDuplicates;
    /**
     * Remove statistical outliers
     */
    private removeOutliers;
    /**
     * Detect bias in dataset
     */
    detectBias(datasetId: string): BiasDetectionResult;
    /**
     * Calculate dataset statistics
     */
    private calculateStatistics;
    /**
     * Calculate quality metrics
     */
    private calculateQualityMetrics;
    /**
     * Assess example quality
     */
    private assessQuality;
    /**
     * Calculate bias score
     */
    private calculateBiasScore;
    /**
     * Calculate diversity score
     */
    private calculateDiversityScore;
    /**
     * Calculate distribution
     */
    private calculateDistribution;
    /**
     * Create dataset version
     */
    createVersion(datasetId: string, versionName: string): string;
    /**
     * Get dataset version
     */
    getVersion(datasetId: string, version: string): Dataset | null;
    /**
     * List all versions
     */
    listVersions(datasetId: string): string[];
    /**
     * Export dataset
     */
    exportDataset(datasetId: string, format: 'json' | 'csv' | 'jsonl'): string;
    /**
     * Import dataset
     */
    importDataset(name: string, data: string, format: 'json' | 'csv' | 'jsonl'): string;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Hash example for deduplication
     */
    private hashExample;
    /**
     * Get dataset
     */
    getDataset(datasetId: string): Dataset | null;
    /**
     * Delete dataset
     */
    deleteDataset(datasetId: string): void;
    /**
     * List all datasets
     */
    listDatasets(): Dataset[];
}
export default DatasetManager;
//# sourceMappingURL=DatasetManager.d.ts.map