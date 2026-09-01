"use strict";
/**
 * Learning & Adaptation System - Learn from user feedback and improve over time
 * Implements reinforcement learning from human feedback (RLHF) principles
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
exports.learningSystem = exports.LearningSystem = void 0;
const EventBus_1 = require("../core/EventBus");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Learns from user interactions and adapts behavior
 */
class LearningSystem {
    feedbackHistory = [];
    patterns = new Map();
    preferences = new Map();
    learningRate = 0.1;
    dataDir;
    constructor(dataDir = './.agent-data') {
        this.dataDir = dataDir;
        this.initialize().catch(error => {
            console.error('Failed to initialize learning system during construction:', error);
        });
    }
    async initialize() {
        const timeout = 10000;
        try {
            await Promise.race([
                (async () => {
                    await fs.mkdir(this.dataDir, { recursive: true });
                    await this.load();
                })(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), timeout)),
            ]);
        }
        catch (error) {
            console.error('Failed to initialize learning system:', error);
            // Handle edge case: reset to clean state on initialization failure
            this.feedbackHistory = [];
            this.patterns.clear();
            this.preferences.clear();
        }
    }
    /**
     * Record user feedback on an action
     */
    async recordFeedback(task, action, rating, outcome, parameters, comment) {
        const feedback = {
            id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            context: { task, action, parameters },
            rating,
            comment,
            outcome,
        };
        this.feedbackHistory.push(feedback);
        // Update patterns
        await this.updatePatterns(feedback);
        // Update preferences
        await this.updatePreferences(feedback);
        // Emit event
        EventBus_1.eventBus.emitSync('learning.feedback_recorded', { feedback }, 'LearningSystem');
        // Persist
        await this.save();
    }
    /**
     * Get recommendation for a task
     */
    getRecommendation(task) {
        // Find patterns matching this task
        const relevantPatterns = [];
        for (const [key, pattern] of this.patterns) {
            const relevance = this.calculateRelevance(task, pattern);
            if (relevance > 0.3) {
                relevantPatterns.push({ pattern, relevance });
            }
        }
        if (relevantPatterns.length === 0) {
            return null;
        }
        // Sort by relevance * confidence * success rate
        relevantPatterns.sort((a, b) => {
            const scoreA = a.relevance * a.pattern.confidence * a.pattern.successRate;
            const scoreB = b.relevance * b.pattern.confidence * b.pattern.successRate;
            return scoreB - scoreA;
        });
        const best = relevantPatterns[0];
        return {
            suggestedAction: best.pattern.pattern,
            confidence: best.pattern.confidence * best.relevance,
            reasoning: this.generateReasoning(best.pattern),
        };
    }
    /**
     * Get user preferences for a category
     */
    getPreference(category) {
        return this.preferences.get(category);
    }
    /**
     * Get all learned patterns
     */
    getPatterns() {
        return Array.from(this.patterns.values()).sort((a, b) => b.confidence - a.confidence);
    }
    /**
     * Get all user preferences
     */
    getPreferences() {
        return Array.from(this.preferences.values()).sort((a, b) => b.strength - a.strength);
    }
    /**
     * Get learning statistics
     */
    getStats() {
        const positive = this.feedbackHistory.filter((f) => f.rating > 0).length;
        const avgConfidence = this.patterns.size > 0
            ? Array.from(this.patterns.values()).reduce((sum, p) => sum + p.confidence, 0) / this.patterns.size
            : 0;
        return {
            totalFeedback: this.feedbackHistory.length,
            positiveRate: this.feedbackHistory.length > 0
                ? positive / this.feedbackHistory.length
                : 0,
            patternsLearned: this.patterns.size,
            preferencesLearned: this.preferences.size,
            avgConfidence,
        };
    }
    /**
     * Clear all learned data
     */
    async reset() {
        this.feedbackHistory = [];
        this.patterns.clear();
        this.preferences.clear();
        await this.save();
    }
    async updatePatterns(feedback) {
        const key = `${feedback.context.task}:${feedback.context.action}`;
        const existing = this.patterns.get(key);
        if (existing) {
            // Update existing pattern
            const newTimesApplied = existing.timesApplied + 1;
            const successCount = existing.successRate * existing.timesApplied +
                (feedback.outcome === 'success' ? 1 : 0);
            const newSuccessRate = successCount / newTimesApplied;
            // Update confidence using learning rate
            const feedbackSignal = feedback.rating > 0 ? 1 : -1;
            const newConfidence = Math.max(0, Math.min(1, existing.confidence + this.learningRate * feedbackSignal));
            existing.successRate = newSuccessRate;
            existing.timesApplied = newTimesApplied;
            existing.confidence = newConfidence;
            existing.lastUsed = new Date();
            // Add example if positive
            if (feedback.rating > 0 && feedback.comment) {
                existing.examples.push(feedback.comment);
                if (existing.examples.length > 5) {
                    existing.examples.shift(); // Keep last 5
                }
            }
        }
        else {
            // Create new pattern
            this.patterns.set(key, {
                pattern: key,
                confidence: feedback.rating > 0 ? 0.5 : 0.3,
                successRate: feedback.outcome === 'success' ? 1 : 0,
                timesApplied: 1,
                lastUsed: new Date(),
                examples: feedback.comment ? [feedback.comment] : [],
            });
        }
    }
    async updatePreferences(feedback) {
        // Extract preferences from feedback
        if (!feedback.comment)
            return;
        // Simple preference extraction (in reality, would use NLP)
        const preferencePatterns = [
            { pattern: /prefer (.*)/i, category: 'general' },
            { pattern: /always (.*)/i, category: 'habit' },
            { pattern: /never (.*)/i, category: 'avoid' },
            { pattern: /like (.*)/i, category: 'preference' },
            { pattern: /dislike (.*)/i, category: 'avoid' },
        ];
        for (const { pattern, category } of preferencePatterns) {
            const match = feedback.comment.match(pattern);
            if (match) {
                const preference = match[1];
                const key = `${category}:${preference}`;
                const existing = this.preferences.get(key);
                if (existing) {
                    existing.strength = Math.min(1, existing.strength + this.learningRate);
                    existing.learnedFrom++;
                }
                else {
                    this.preferences.set(key, {
                        category,
                        preference,
                        strength: 0.5,
                        learnedFrom: 1,
                    });
                }
            }
        }
    }
    calculateRelevance(task, pattern) {
        // Simple keyword matching (in reality, would use embeddings)
        const taskWords = task.toLowerCase().split(/\s+/);
        const patternWords = pattern.pattern.toLowerCase().split(/\s+/);
        let matches = 0;
        for (const word of taskWords) {
            if (patternWords.some((pw) => pw.includes(word) || word.includes(pw))) {
                matches++;
            }
        }
        return matches / Math.max(taskWords.length, patternWords.length);
    }
    generateReasoning(pattern) {
        const parts = [];
        parts.push(`This approach has been used ${pattern.timesApplied} times with ${(pattern.successRate * 100).toFixed(0)}% success rate`);
        if (pattern.confidence > 0.7) {
            parts.push('High confidence based on positive feedback');
        }
        if (pattern.examples.length > 0) {
            parts.push(`Example: "${pattern.examples[0]}"`);
        }
        return parts.join('. ');
    }
    async save() {
        try {
            const data = {
                feedback: this.feedbackHistory,
                patterns: Array.from(this.patterns.entries()),
                preferences: Array.from(this.preferences.entries()),
            };
            await fs.writeFile(path.join(this.dataDir, 'learning.json'), JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.error('Failed to save learning data:', error);
        }
    }
    async load() {
        try {
            const dataPath = path.join(this.dataDir, 'learning.json');
            const content = await fs.readFile(dataPath, 'utf-8');
            const data = JSON.parse(content);
            this.feedbackHistory = data.feedback || [];
            this.patterns = new Map(data.patterns || []);
            this.preferences = new Map(data.preferences || []);
        }
        catch (error) {
            // File doesn't exist yet, that's okay
        }
    }
}
exports.LearningSystem = LearningSystem;
/**
 * Singleton instance
 */
exports.learningSystem = new LearningSystem();
