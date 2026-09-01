/**
 * Learning and Adaptation System
 * Reinforcement Learning from Human Feedback (RLHF)
 * Few-shot, Meta-learning, Transfer learning, Online learning
 * Preference learning, Curriculum learning, Active learning
 */
import { EventEmitter } from 'events';
export interface Feedback {
    id: string;
    taskId: string;
    userId: string;
    timestamp: number;
    type: 'positive' | 'negative' | 'neutral' | 'correction';
    rating?: number;
    comment?: string;
    correction?: any;
    context: Record<string, any>;
}
export interface LearningExample {
    id: string;
    input: any;
    output: any;
    context: Record<string, any>;
    quality: number;
    source: 'human' | 'synthetic' | 'curriculum';
    timestamp: number;
}
export interface Preference {
    id: string;
    option1: any;
    option2: any;
    preferred: 'option1' | 'option2' | 'equal';
    strength: number;
    context: Record<string, any>;
    timestamp: number;
}
export interface RewardSignal {
    taskId: string;
    action: string;
    reward: number;
    state: any;
    nextState: any;
    terminal: boolean;
}
export interface PolicyUpdate {
    id: string;
    before: Policy;
    after: Policy;
    improvement: number;
    timestamp: number;
}
export interface Policy {
    name: string;
    parameters: Map<string, number>;
    performance: number;
    confidence: number;
}
export interface FewShotPrompt {
    task: string;
    examples: LearningExample[];
    query: any;
    similarityThreshold: number;
}
export interface MetaLearningTask {
    id: string;
    family: string;
    trainExamples: LearningExample[];
    testExamples: LearningExample[];
    adaptationSteps: number;
}
export interface TransferContext {
    sourceTask: string;
    targetTask: string;
    similarity: number;
    transferableKnowledge: KnowledgeComponent[];
}
export interface KnowledgeComponent {
    type: 'parameter' | 'strategy' | 'pattern' | 'heuristic';
    name: string;
    value: any;
    transferability: number;
}
export interface CurriculumStage {
    id: string;
    level: number;
    name: string;
    difficulty: number;
    prerequisites: string[];
    tasks: LearningExample[];
    masteryThreshold: number;
    currentMastery: number;
}
export interface ActiveLearningQuery {
    id: string;
    candidate: any;
    uncertainty: number;
    informativeness: number;
    priority: number;
    acquisitionFunction: 'uncertainty' | 'diversity' | 'expected_improvement';
}
export interface AdaptationResult {
    taskId: string;
    initialPerformance: number;
    finalPerformance: number;
    adaptationSteps: number;
    convergence: boolean;
    learnedParameters: Map<string, number>;
}
export declare class LearningSystem extends EventEmitter {
    private feedback;
    private examples;
    private preferences;
    private rewardHistory;
    private policies;
    private curriculum;
    private transferKnowledge;
    private config;
    private rewardModel;
    private valueFunction;
    private qTable;
    private metaParameters;
    private taskEmbeddings;
    constructor(config?: Partial<LearningConfig>);
    learnFromFeedback(feedback: Feedback): Promise<void>;
    private updateRewardModel;
    private computeReward;
    private updatePolicy;
    private computePolicyGradient;
    fewShotLearn(prompt: FewShotPrompt): Promise<any>;
    private selectRelevantExamples;
    private computeSimilarity;
    private adaptFromExamples;
    private generateWithExamples;
    metaLearn(task: MetaLearningTask): Promise<AdaptationResult>;
    private innerLoopUpdate;
    private outerLoopUpdate;
    private computeTaskEmbedding;
    private computeAvgDifficulty;
    transferKnowledgeFrom(sourceTask: string, targetTask: string): Promise<TransferContext>;
    private computeTaskSimilarity;
    private identifyTransferableKnowledge;
    private extractPatterns;
    private applyTransfer;
    createCurriculum(taskFamily: string, examples: LearningExample[]): Promise<CurriculumStage[]>;
    trainOnCurriculum(curriculumId: string, maxEpochs?: number): Promise<CurriculumProgress>;
    private trainOnStage;
    private computeOverallMastery;
    selectQueriesForLabeling(candidates: any[], budget: number): Promise<ActiveLearningQuery[]>;
    private estimateUncertainty;
    private estimateInformativeness;
    private computeAcquisitionScore;
    learnFromPreference(preference: Preference): Promise<void>;
    private updatePolicyFromPreferences;
    private aggregatePreferences;
    onlineUpdate(example: LearningExample): Promise<void>;
    private incrementalUpdate;
    private initializeDefaultPolicy;
    private getCurrentPolicy;
    private evaluatePolicy;
    private clonePolicy;
    private evaluateOnExamples;
    private predict;
    private isCorrect;
    private computeLoss;
    private computeGradient;
    private generateId;
    getFeedback(): Feedback[];
    getExamples(): LearningExample[];
    getPreferences(): Preference[];
    getPolicy(name?: string): Policy | undefined;
    getCurriculum(): CurriculumStage[];
    getTransferredKnowledge(taskId: string): KnowledgeComponent[];
}
interface LearningConfig {
    learningRate: number;
    discountFactor: number;
    explorationRate: number;
    batchSize: number;
    updateFrequency: number;
    enableRLHF: boolean;
    enableFewShot: boolean;
    enableMetaLearning: boolean;
    enableTransfer: boolean;
    enableCurriculum: boolean;
    enableActive: boolean;
}
interface CurriculumProgress {
    curriculumId: string;
    completedStages: string[];
    currentStage: number;
    overallMastery: number;
    epochs: number;
}
export default LearningSystem;
//# sourceMappingURL=LearningSystem.d.ts.map