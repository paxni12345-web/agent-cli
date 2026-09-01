/**
 * Learning & Adaptation System - Learn from user feedback and improve over time
 * Implements reinforcement learning from human feedback (RLHF) principles
 */
export interface Feedback {
    id: string;
    timestamp: Date;
    context: {
        task: string;
        action: string;
        parameters?: any;
    };
    rating: number;
    comment?: string;
    outcome: 'success' | 'failure' | 'partial';
}
export interface LearningPattern {
    pattern: string;
    confidence: number;
    successRate: number;
    timesApplied: number;
    lastUsed: Date;
    examples: string[];
}
export interface UserPreference {
    category: string;
    preference: string;
    strength: number;
    learnedFrom: number;
}
/**
 * Learns from user interactions and adapts behavior
 */
export declare class LearningSystem {
    private feedbackHistory;
    private patterns;
    private preferences;
    private learningRate;
    private dataDir;
    constructor(dataDir?: string);
    private initialize;
    /**
     * Record user feedback on an action
     */
    recordFeedback(task: string, action: string, rating: number, outcome: 'success' | 'failure' | 'partial', parameters?: any, comment?: string): Promise<void>;
    /**
     * Get recommendation for a task
     */
    getRecommendation(task: string): {
        suggestedAction: string;
        confidence: number;
        reasoning: string;
    } | null;
    /**
     * Get user preferences for a category
     */
    getPreference(category: string): UserPreference | undefined;
    /**
     * Get all learned patterns
     */
    getPatterns(): LearningPattern[];
    /**
     * Get all user preferences
     */
    getPreferences(): UserPreference[];
    /**
     * Get learning statistics
     */
    getStats(): {
        totalFeedback: number;
        positiveRate: number;
        patternsLearned: number;
        preferencesLearned: number;
        avgConfidence: number;
    };
    /**
     * Clear all learned data
     */
    reset(): Promise<void>;
    private updatePatterns;
    private updatePreferences;
    private calculateRelevance;
    private generateReasoning;
    private save;
    private load;
}
/**
 * Singleton instance
 */
export declare const learningSystem: LearningSystem;
//# sourceMappingURL=LearningSystem.d.ts.map