/**
 * Learning & Adaptation System - Learn from user feedback and improve over time
 * Implements reinforcement learning from human feedback (RLHF) principles
 */

import { eventBus } from '../core/EventBus';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Feedback {
  id: string;
  timestamp: Date;
  context: {
    task: string;
    action: string;
    parameters?: any;
  };
  rating: number; // -1 (negative), 0 (neutral), 1 (positive)
  comment?: string;
  outcome: 'success' | 'failure' | 'partial';
}

export interface LearningPattern {
  pattern: string;
  confidence: number; // 0-1
  successRate: number;
  timesApplied: number;
  lastUsed: Date;
  examples: string[];
}

export interface UserPreference {
  category: string;
  preference: string;
  strength: number; // 0-1
  learnedFrom: number; // count of feedback instances
}

/**
 * Learns from user interactions and adapts behavior
 */
export class LearningSystem {
  private feedbackHistory: Feedback[] = [];
  private patterns: Map<string, LearningPattern> = new Map();
  private preferences: Map<string, UserPreference> = new Map();
  private learningRate: number = 0.1;
  private dataDir: string;

  constructor(dataDir: string = './.agent-data') {
    this.dataDir = dataDir;
    this.initialize().catch(error => {
      console.error('Failed to initialize learning system during construction:', error);
    });
  }

  private async initialize(): Promise<void> {
    const timeout = 10000;
    try {
      await Promise.race([
        (async () => {
          await fs.mkdir(this.dataDir, { recursive: true });
          await this.load();
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Initialization timeout')), timeout)
        ),
      ]);
    } catch (error) {
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
  async recordFeedback(
    task: string,
    action: string,
    rating: number,
    outcome: 'success' | 'failure' | 'partial',
    parameters?: any,
    comment?: string
  ): Promise<void> {
    const feedback: Feedback = {
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
    eventBus.emitSync(
      'learning.feedback_recorded',
      { feedback },
      'LearningSystem'
    );

    // Persist
    await this.save();
  }

  /**
   * Get recommendation for a task
   */
  getRecommendation(task: string): {
    suggestedAction: string;
    confidence: number;
    reasoning: string;
  } | null {
    // Find patterns matching this task
    const relevantPatterns: Array<{
      pattern: LearningPattern;
      relevance: number;
    }> = [];

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
      const scoreA =
        a.relevance * a.pattern.confidence * a.pattern.successRate;
      const scoreB =
        b.relevance * b.pattern.confidence * b.pattern.successRate;
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
  getPreference(category: string): UserPreference | undefined {
    return this.preferences.get(category);
  }

  /**
   * Get all learned patterns
   */
  getPatterns(): LearningPattern[] {
    return Array.from(this.patterns.values()).sort(
      (a, b) => b.confidence - a.confidence
    );
  }

  /**
   * Get all user preferences
   */
  getPreferences(): UserPreference[] {
    return Array.from(this.preferences.values()).sort(
      (a, b) => b.strength - a.strength
    );
  }

  /**
   * Get learning statistics
   */
  getStats(): {
    totalFeedback: number;
    positiveRate: number;
    patternsLearned: number;
    preferencesLearned: number;
    avgConfidence: number;
  } {
    const positive = this.feedbackHistory.filter((f) => f.rating > 0).length;
    const avgConfidence =
      this.patterns.size > 0
        ? Array.from(this.patterns.values()).reduce(
            (sum, p) => sum + p.confidence,
            0
          ) / this.patterns.size
        : 0;

    return {
      totalFeedback: this.feedbackHistory.length,
      positiveRate:
        this.feedbackHistory.length > 0
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
  async reset(): Promise<void> {
    this.feedbackHistory = [];
    this.patterns.clear();
    this.preferences.clear();
    await this.save();
  }

  private async updatePatterns(feedback: Feedback): Promise<void> {
    const key = `${feedback.context.task}:${feedback.context.action}`;
    const existing = this.patterns.get(key);

    if (existing) {
      // Update existing pattern
      const newTimesApplied = existing.timesApplied + 1;
      const successCount =
        existing.successRate * existing.timesApplied +
        (feedback.outcome === 'success' ? 1 : 0);
      const newSuccessRate = successCount / newTimesApplied;

      // Update confidence using learning rate
      const feedbackSignal = feedback.rating > 0 ? 1 : -1;
      const newConfidence = Math.max(
        0,
        Math.min(
          1,
          existing.confidence + this.learningRate * feedbackSignal
        )
      );

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
    } else {
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

  private async updatePreferences(feedback: Feedback): Promise<void> {
    // Extract preferences from feedback
    if (!feedback.comment) return;

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
          existing.strength = Math.min(
            1,
            existing.strength + this.learningRate
          );
          existing.learnedFrom++;
        } else {
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

  private calculateRelevance(task: string, pattern: LearningPattern): number {
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

  private generateReasoning(pattern: LearningPattern): string {
    const parts: string[] = [];

    parts.push(
      `This approach has been used ${pattern.timesApplied} times with ${(pattern.successRate * 100).toFixed(0)}% success rate`
    );

    if (pattern.confidence > 0.7) {
      parts.push('High confidence based on positive feedback');
    }

    if (pattern.examples.length > 0) {
      parts.push(`Example: "${pattern.examples[0]}"`);
    }

    return parts.join('. ');
  }

  private async save(): Promise<void> {
    try {
      const data = {
        feedback: this.feedbackHistory,
        patterns: Array.from(this.patterns.entries()),
        preferences: Array.from(this.preferences.entries()),
      };

      await fs.writeFile(
        path.join(this.dataDir, 'learning.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error('Failed to save learning data:', error);
    }
  }

  private async load(): Promise<void> {
    try {
      const dataPath = path.join(this.dataDir, 'learning.json');
      const content = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(content);

      this.feedbackHistory = data.feedback || [];
      this.patterns = new Map(data.patterns || []);
      this.preferences = new Map(data.preferences || []);
    } catch (error) {
      // File doesn't exist yet, that's okay
    }
  }
}

/**
 * Singleton instance
 */
export const learningSystem = new LearningSystem();
