/**
 * PromptOptimization - Automatic prompt engineering and optimization
 * A/B testing, versioning, and performance analytics for prompts
 */
import { EventEmitter } from 'events';
export interface PromptTemplate {
    id: string;
    name: string;
    template: string;
    variables: string[];
    version: string;
    metadata: PromptMetadata;
}
export interface PromptMetadata {
    createdAt: Date;
    updatedAt: Date;
    author: string;
    tags: string[];
    category: string;
    description: string;
}
export interface PromptVersion {
    version: string;
    template: string;
    performance: PromptPerformance;
    timestamp: Date;
}
export interface PromptPerformance {
    avgQuality: number;
    avgLatency: number;
    avgCost: number;
    successRate: number;
    totalExecutions: number;
    userSatisfaction: number;
}
export interface ABTest {
    id: string;
    name: string;
    variants: PromptVariant[];
    status: 'draft' | 'running' | 'paused' | 'completed';
    trafficSplit: number[];
    startDate: Date;
    endDate?: Date;
    results: ABTestResults;
}
export interface PromptVariant {
    id: string;
    name: string;
    template: string;
    traffic: number;
    metrics: VariantMetrics;
}
export interface VariantMetrics {
    executions: number;
    avgQuality: number;
    avgLatency: number;
    avgCost: number;
    conversions: number;
    errors: number;
}
export interface ABTestResults {
    winner?: string;
    confidence: number;
    statisticalSignificance: boolean;
    analysis: string;
}
export interface OptimizationConfig {
    enableAutoOptimization: boolean;
    optimizationInterval: number;
    minSampleSize: number;
    significanceLevel: number;
    optimizationGoals: OptimizationGoal[];
}
export interface OptimizationGoal {
    metric: 'quality' | 'latency' | 'cost' | 'satisfaction';
    weight: number;
    target?: number;
}
export interface PromptAnalytics {
    promptId: string;
    timeRange: {
        start: Date;
        end: Date;
    };
    metrics: {
        totalExecutions: number;
        avgQuality: number;
        avgLatency: number;
        avgCost: number;
        successRate: number;
        errorRate: number;
    };
    trends: {
        qualityTrend: number[];
        latencyTrend: number[];
        costTrend: number[];
    };
    topErrors: Array<{
        error: string;
        count: number;
    }>;
}
export declare class PromptOptimizer extends EventEmitter {
    private templates;
    private versions;
    private abTests;
    private config;
    private executionHistory;
    constructor(config?: Partial<OptimizationConfig>);
    /**
     * Register a new prompt template
     */
    registerTemplate(template: PromptTemplate): void;
    /**
     * Update prompt template and create new version
     */
    updateTemplate(templateId: string, newTemplate: string, reason?: string): string;
    /**
     * Execute prompt with automatic optimization
     */
    executePrompt(templateId: string, variables: Record<string, any>, options?: any): Promise<any>;
    /**
     * Create A/B test for prompt variants
     */
    createABTest(name: string, baseTemplateId: string, variants: Array<{
        name: string;
        template: string;
    }>, trafficSplit?: number[]): string;
    /**
     * Start A/B test
     */
    startABTest(testId: string): void;
    /**
     * Stop A/B test and analyze results
     */
    stopABTest(testId: string): ABTestResults;
    /**
     * Analyze A/B test results
     */
    private analyzeABTest;
    /**
     * Calculate variant score based on goals
     */
    private calculateVariantScore;
    /**
     * Calculate statistical significance using t-test
     */
    private calculateStatisticalSignificance;
    /**
     * Generate analysis text
     */
    private generateAnalysis;
    /**
     * Automatic prompt optimization
     */
    optimizePrompt(templateId: string): Promise<string[]>;
    /**
     * Generate optimized prompt variants
     */
    private generateOptimizedVariants;
    /**
     * Make prompt more concise
     */
    private makeConcise;
    /**
     * Make prompt more detailed
     */
    private makeDetailed;
    /**
     * Restructure prompt
     */
    private restructure;
    /**
     * Get prompt analytics
     */
    getAnalytics(templateId: string, timeRange?: {
        start: Date;
        end: Date;
    }): PromptAnalytics;
    /**
     * Render template with variables
     */
    private renderTemplate;
    /**
     * Invoke model (placeholder)
     */
    private invokeModel;
    /**
     * Record execution
     */
    private recordExecution;
    /**
     * Get active A/B test for template
     */
    private getActiveABTest;
    /**
     * Select variant based on traffic split
     */
    private selectVariant;
    /**
     * Update variant metrics
     */
    private updateVariantMetrics;
    /**
     * Initialize performance metrics
     */
    private initializePerformance;
    /**
     * Initialize variant metrics
     */
    private initializeVariantMetrics;
    /**
     * Generate version string
     */
    private generateVersion;
    /**
     * Calculate average
     */
    private average;
    /**
     * Update running average
     */
    private updateAverage;
    /**
     * Calculate trend
     */
    private calculateTrend;
    /**
     * Analyze performance
     */
    private analyzePerformance;
    /**
     * Get top errors
     */
    private getTopErrors;
    /**
     * Export templates
     */
    exportTemplates(): any[];
    /**
     * Import templates
     */
    importTemplates(templates: PromptTemplate[]): void;
}
export default PromptOptimizer;
//# sourceMappingURL=PromptOptimization.d.ts.map