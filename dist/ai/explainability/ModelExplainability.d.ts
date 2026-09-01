/**
 * ModelExplainability - AI model interpretation and explainability
 * SHAP values, LIME, attention visualization, feature importance
 */
import { EventEmitter } from 'events';
export interface ExplainabilityConfig {
    method: 'shap' | 'lime' | 'attention' | 'gradcam' | 'integrated_gradients';
    numSamples: number;
    confidenceThreshold: number;
    visualize: boolean;
    saveArtifacts: boolean;
}
export interface Explanation {
    id: string;
    modelId: string;
    input: any;
    output: any;
    method: string;
    features: FeatureImportance[];
    attributions: Attribution[];
    visualizations: Visualization[];
    confidence: number;
    timestamp: Date;
}
export interface FeatureImportance {
    feature: string;
    importance: number;
    direction: 'positive' | 'negative';
    value: any;
    contribution: number;
}
export interface Attribution {
    token: string;
    score: number;
    position: number;
    layer?: number;
    head?: number;
}
export interface Visualization {
    type: 'heatmap' | 'bar' | 'waterfall' | 'force' | 'decision';
    data: any;
    config: any;
    format: 'svg' | 'png' | 'html';
}
export interface SHAPValues {
    baseValue: number;
    values: number[];
    features: string[];
    expectedValue: number;
    interaction: number[][];
}
export interface LIMEExplanation {
    intercept: number;
    coefficients: Map<string, number>;
    r2Score: number;
    localFidelity: number;
    samples: LocalSample[];
}
export interface LocalSample {
    perturbedInput: any;
    prediction: number;
    weight: number;
    distance: number;
}
export interface AttentionWeights {
    layers: AttentionLayer[];
    avgAttention: number[][];
    maxAttention: number[][];
    tokens: string[];
}
export interface AttentionLayer {
    layerIndex: number;
    heads: AttentionHead[];
    avgHeadAttention: number[][];
}
export interface AttentionHead {
    headIndex: number;
    attention: number[][];
    entropy: number;
    sparsity: number;
}
export interface CounterfactualExample {
    original: any;
    counterfactual: any;
    changes: FeatureChange[];
    originalPrediction: any;
    newPrediction: any;
    distance: number;
    validity: number;
}
export interface FeatureChange {
    feature: string;
    originalValue: any;
    newValue: any;
    impact: number;
}
export interface GlobalExplanation {
    modelId: string;
    overallImportance: FeatureImportance[];
    interactions: FeatureInteraction[];
    partialDependence: PartialDependence[];
    anchorRules: AnchorRule[];
    statistics: ExplanationStatistics;
}
export interface FeatureInteraction {
    features: string[];
    strength: number;
    type: 'synergy' | 'redundancy' | 'conditional';
}
export interface PartialDependence {
    feature: string;
    values: number[];
    predictions: number[];
    confidence: number[];
}
export interface AnchorRule {
    conditions: string[];
    coverage: number;
    precision: number;
    examples: any[];
}
export interface ExplanationStatistics {
    totalExplanations: number;
    avgConfidence: number;
    topFeatures: string[];
    consistencyScore: number;
    faithfulness: number;
}
export declare class ModelExplainability extends EventEmitter {
    private config;
    private explanations;
    private cache;
    constructor(config?: Partial<ExplainabilityConfig>);
    explain(modelId: string, input: any, output: any): Promise<Explanation>;
    private computeSHAP;
    private computeLIME;
    private extractAttention;
    private computeIntegratedGradients;
    private computeGradient;
    generateCounterfactuals(modelId: string, input: any, desiredOutput: any, numExamples?: number): Promise<CounterfactualExample[]>;
    private findCounterfactual;
    generateGlobalExplanation(modelId: string, dataset: any[]): Promise<GlobalExplanation>;
    private aggregateFeatureImportance;
    private detectFeatureInteractions;
    private computePartialDependence;
    private extractAnchorRules;
    private calculateStatistics;
    private extractFeatures;
    private tokenize;
    private generateAttentionMatrix;
    private calculateEntropy;
    private calculateSparsity;
    private averageAttention;
    private maxAttention;
    private perturb;
    private calculateDistance;
    private createBaseline;
    private interpolate;
    private selectFeatureToChange;
    private generateNewValue;
    private calculateImpact;
    private predict;
    private matchesDesired;
    private validateCounterfactual;
    private generateRange;
    private calculateConfidence;
    private shapToFeatureImportance;
    private limeToFeatureImportance;
    private attentionToAttributions;
    private gradientsToAttributions;
    private generateSHAPVisualizations;
    private generateLIMEVisualizations;
    private generateAttentionVisualizations;
    private generateGradientVisualizations;
    getExplanation(id: string): Explanation | null;
    listExplanations(): Explanation[];
}
export default ModelExplainability;
//# sourceMappingURL=ModelExplainability.d.ts.map