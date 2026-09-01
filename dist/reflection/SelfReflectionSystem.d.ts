/**
 * Self-Reflection and Meta-Cognitive System
 * Performance monitoring, confidence calibration, self-critique
 * Uncertainty quantification, meta-reasoning
 */
import { EventEmitter } from 'events';
export interface PerformanceMetrics {
    taskId: string;
    taskType: string;
    startTime: number;
    endTime: number;
    duration: number;
    success: boolean;
    accuracy?: number;
    efficiency?: number;
    resourceUsage: ResourceUsage;
    errors: ErrorRecord[];
    warnings: string[];
}
export interface ResourceUsage {
    cpuTime: number;
    memoryPeak: number;
    memoryAverage: number;
    apiCalls: number;
    tokensUsed: number;
    cost: number;
}
export interface ErrorRecord {
    type: string;
    message: string;
    timestamp: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context: Record<string, any>;
    recovered: boolean;
}
export interface ConfidenceAssessment {
    taskId: string;
    initialConfidence: number;
    finalConfidence: number;
    calibrationScore: number;
    overconfidence: number;
    underconfidence: number;
    factors: ConfidenceFactor[];
}
export interface ConfidenceFactor {
    factor: string;
    weight: number;
    value: number;
    description: string;
}
export interface UncertaintyEstimate {
    type: 'epistemic' | 'aleatoric' | 'model' | 'data';
    value: number;
    source: string;
    reducible: boolean;
    mitigation: string[];
}
export interface SelfCritique {
    taskId: string;
    timestamp: number;
    strengths: string[];
    weaknesses: string[];
    improvements: Improvement[];
    alternatives: Alternative[];
    lessonsLearned: Lesson[];
}
export interface Improvement {
    area: string;
    current: string;
    suggested: string;
    priority: 'low' | 'medium' | 'high';
    effort: 'small' | 'medium' | 'large';
    impact: number;
}
export interface Alternative {
    description: string;
    advantages: string[];
    disadvantages: string[];
    feasibility: number;
    estimatedPerformance: number;
}
export interface Lesson {
    id: string;
    category: string;
    content: string;
    context: string;
    importance: number;
    applicability: string[];
    verified: boolean;
}
export interface MetaReasoningState {
    currentStrategy: string;
    strategyEffectiveness: number;
    alternativeStrategies: string[];
    shouldSwitch: boolean;
    reasoning: string;
}
export interface ContinuousImprovement {
    dimension: string;
    baseline: number;
    current: number;
    target: number;
    trend: 'improving' | 'stable' | 'declining';
    actions: ImprovementAction[];
}
export interface ImprovementAction {
    id: string;
    description: string;
    implemented: boolean;
    impact: number;
    cost: number;
    timestamp: number;
}
export interface ReflectionReport {
    id: string;
    timestamp: number;
    period: {
        start: number;
        end: number;
    };
    performance: PerformanceSummary;
    calibration: CalibrationSummary;
    critiques: SelfCritique[];
    improvements: ContinuousImprovement[];
    recommendations: Recommendation[];
}
export interface PerformanceSummary {
    tasksCompleted: number;
    successRate: number;
    averageAccuracy: number;
    averageDuration: number;
    resourceEfficiency: number;
    errorRate: number;
}
export interface CalibrationSummary {
    overallCalibration: number;
    overconfidenceRate: number;
    underconfidenceRate: number;
    calibrationTrend: 'improving' | 'stable' | 'declining';
}
export interface Recommendation {
    id: string;
    type: 'strategy' | 'parameter' | 'process' | 'training';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    rationale: string;
    expectedImprovement: number;
    effort: 'small' | 'medium' | 'large';
}
export declare class SelfReflectionSystem extends EventEmitter {
    private performanceHistory;
    private confidenceHistory;
    private critiques;
    private lessons;
    private improvements;
    private metaState;
    private config;
    constructor(config?: Partial<ReflectionConfig>);
    recordPerformance(metrics: PerformanceMetrics): void;
    private analyzePerformance;
    private detectTrend;
    private detectAnomalies;
    calibrateConfidence(taskId: string, initialConfidence: number, actualSuccess: boolean, actualAccuracy?: number): ConfidenceAssessment;
    private identifyConfidenceFactors;
    private estimateTaskComplexity;
    private assessPriorExperience;
    private assessResourceAvailability;
    private assessContextQuality;
    private assessTimePressure;
    quantifyUncertainty(taskId: string, context: Record<string, any>): UncertaintyEstimate[];
    private estimateEpistemicUncertainty;
    private estimateAleatoricUncertainty;
    private estimateModelUncertainty;
    private estimateDataUncertainty;
    private identifyKnowledgeGaps;
    critique(taskId: string, outcome: any, expectedOutcome: any): Promise<SelfCritique>;
    private identifyStrengths;
    private identifyWeaknesses;
    private suggestImprovements;
    private generateAlternatives;
    private extractLessons;
    updateMetaReasoning(currentPerformance: number, context: Record<string, any>): MetaReasoningState;
    private evaluateStrategyEffectiveness;
    private selectBestStrategy;
    trackImprovement(dimension: string, value: number): void;
    private determineTrend;
    proposeImprovementAction(dimension: string, action: Omit<ImprovementAction, 'id' | 'timestamp'>): void;
    generateReport(period?: {
        start: number;
        end: number;
    }): Promise<ReflectionReport>;
    private summarizePerformance;
    private summarizeCalibration;
    private detectCalibrationTrend;
    private generateRecommendations;
    private startReflectionLoop;
    private shouldTriggerReflection;
    private performReflection;
    private getRecentMetrics;
    private calculateAverage;
    private calculateStdDev;
    private calculateResourceEfficiency;
    private findMetrics;
    private generateId;
    getPerformanceHistory(): PerformanceMetrics[];
    getConfidenceHistory(): ConfidenceAssessment[];
    getCritiques(): SelfCritique[];
    getLessons(): Lesson[];
    getImprovements(): ContinuousImprovement[];
    getMetaState(): MetaReasoningState;
}
interface ReflectionConfig {
    enablePerformanceMonitoring: boolean;
    enableConfidenceCalibration: boolean;
    enableSelfCritique: boolean;
    enableMetaReasoning: boolean;
    reflectionInterval: number;
    critiqueThreshold: number;
    improvementThreshold: number;
}
export default SelfReflectionSystem;
//# sourceMappingURL=SelfReflectionSystem.d.ts.map