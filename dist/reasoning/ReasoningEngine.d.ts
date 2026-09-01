/**
 * Advanced Reasoning Engine
 * Chain-of-Thought, Tree-of-Thoughts, Graph-of-Thoughts
 * Analogical, Abductive, Counterfactual, Causal reasoning
 */
import { EventEmitter } from 'events';
export interface Thought {
    id: string;
    content: string;
    type: 'observation' | 'hypothesis' | 'conclusion' | 'question' | 'assumption';
    confidence: number;
    evidence: Evidence[];
    reasoning: string;
    parent?: string;
    children: string[];
    depth: number;
    timestamp: number;
}
export interface Evidence {
    type: 'empirical' | 'logical' | 'statistical' | 'expert' | 'analogical';
    content: string;
    source: string;
    reliability: number;
    relevance: number;
}
export interface ReasoningChain {
    id: string;
    thoughts: Thought[];
    conclusion: string;
    confidence: number;
    steps: ReasoningStep[];
    metadata: Record<string, any>;
}
export interface ReasoningStep {
    id: string;
    type: 'deduction' | 'induction' | 'abduction' | 'analogy' | 'causal';
    input: string[];
    output: string;
    rule: string;
    confidence: number;
}
export interface ThoughtTree {
    root: ThoughtNode;
    branches: number;
    depth: number;
    evaluations: Map<string, number>;
}
export interface ThoughtNode {
    thought: Thought;
    children: ThoughtNode[];
    value: number;
    visits: number;
}
export interface ThoughtGraph {
    nodes: Map<string, Thought>;
    edges: Map<string, Set<string>>;
    paths: Path[];
    clusters: Cluster[];
}
export interface Path {
    nodes: string[];
    weight: number;
    type: 'causal' | 'logical' | 'temporal' | 'associative';
}
export interface Cluster {
    id: string;
    thoughts: string[];
    coherence: number;
    summary: string;
}
export interface Analogy {
    source: Domain;
    target: Domain;
    mappings: Mapping[];
    similarity: number;
    transferability: number;
}
export interface Domain {
    name: string;
    entities: Entity[];
    relations: Relation[];
    properties: Property[];
}
export interface Entity {
    id: string;
    name: string;
    type: string;
    attributes: Record<string, any>;
}
export interface Relation {
    id: string;
    type: string;
    source: string;
    target: string;
    strength: number;
}
export interface Property {
    entity: string;
    name: string;
    value: any;
}
export interface Mapping {
    sourceEntity: string;
    targetEntity: string;
    confidence: number;
    justification: string;
}
export interface CausalModel {
    variables: Variable[];
    edges: CausalEdge[];
    interventions: Intervention[];
    counterfactuals: Counterfactual[];
}
export interface Variable {
    id: string;
    name: string;
    type: 'binary' | 'continuous' | 'categorical';
    observed: boolean;
    value?: any;
}
export interface CausalEdge {
    cause: string;
    effect: string;
    strength: number;
    mechanism: string;
    confounders: string[];
}
export interface Intervention {
    variable: string;
    value: any;
    expectedEffects: Map<string, any>;
}
export interface Counterfactual {
    actual: Map<string, any>;
    hypothetical: Map<string, any>;
    likelihood: number;
    implications: string[];
}
export declare class ReasoningEngine extends EventEmitter {
    private thoughts;
    private chains;
    private analogies;
    private causalModels;
    private config;
    constructor(config?: Partial<ReasoningConfig>);
    chainOfThought(problem: string, context?: string[]): Promise<ReasoningChain>;
    treeOfThoughts(problem: string, evaluator: (thought: Thought) => Promise<number>): Promise<ThoughtTree>;
    private expandTree;
    private countBranches;
    private getTreeDepth;
    graphOfThoughts(problem: string, constraints?: Constraint[]): Promise<ThoughtGraph>;
    private buildThoughtConnections;
    private findReasoningPaths;
    private dfsPath;
    private calculatePathWeight;
    private clusterThoughts;
    private expandCluster;
    private calculateClusterCoherence;
    private summarizeCluster;
    analogicalReasoning(sourceDomain: Domain, targetDomain: Domain): Promise<Analogy>;
    private findStructuralMappings;
    private calculateEntitySimilarity;
    private calculateDomainSimilarity;
    private assessTransferability;
    private calculateMappingConsistency;
    abductiveReasoning(observations: string[], hypotheses: string[]): Promise<RankedHypothesis[]>;
    private scoreHypothesis;
    private explains;
    private assessPlausibility;
    causalReasoning(modelName: string, variables: Variable[], edges: CausalEdge[]): Promise<CausalModel>;
    interventionalQuery(modelName: string, intervention: Intervention): Promise<Map<string, any>>;
    private computeInterventionEffects;
    private estimateEffect;
    counterfactualReasoning(modelName: string, actual: Map<string, any>, hypothetical: Map<string, any>): Promise<Counterfactual>;
    private computeCounterfactualLikelihood;
    private deriveImplications;
    private getDownstreamVariables;
    private generateThought;
    private generateCandidateThoughts;
    private createReasoningStep;
    private calculateChainConfidence;
    private calculateThoughtSimilarity;
    private generateId;
    getThought(id: string): Thought | undefined;
    getChain(id: string): ReasoningChain | undefined;
    getCausalModel(name: string): CausalModel | undefined;
    getAnalogies(): Analogy[];
}
interface ReasoningConfig {
    maxDepth: number;
    maxBranches: number;
    minConfidence: number;
    useChainOfThought: boolean;
    useTreeOfThoughts: boolean;
    useGraphOfThoughts: boolean;
    enableAnalogy: boolean;
    enableCausal: boolean;
    enableCounterfactual: boolean;
}
interface Constraint {
    type: string;
    validate: (thought: Thought) => boolean;
}
interface RankedHypothesis {
    hypothesis: string;
    score: HypothesisScore;
    explanatoryPower: number;
    simplicity: number;
    plausibility: number;
}
interface HypothesisScore {
    explanatoryPower: number;
    simplicity: number;
    plausibility: number;
    total: number;
}
export default ReasoningEngine;
//# sourceMappingURL=ReasoningEngine.d.ts.map