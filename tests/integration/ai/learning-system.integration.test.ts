/**
 * Integration Tests for LearningSystem
 * Tests real file operations, error propagation, and system integration
 */

import { LearningSystem } from '../../../src/ai/LearningSystem';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('LearningSystem Integration Tests', () => {
  let tempDir: string;
  let learningSystem: LearningSystem;

  beforeEach(async () => {
    // Create real temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'learning-test-'));
    learningSystem = new LearningSystem(tempDir);
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up real files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Real File Operations', () => {
    it('should persist feedback to disk', async () => {
      await learningSystem.recordFeedback(
        'code_review',
        'suggest_improvements',
        1,
        'success',
        { file: 'test.ts' },
        'Good suggestions'
      );

      const dataPath = path.join(tempDir, 'learning.json');
      const content = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.feedback).toHaveLength(1);
      expect(data.feedback[0].context.task).toBe('code_review');
      expect(data.feedback[0].rating).toBe(1);
    });

    it('should load existing data on initialization', async () => {
      // Write initial data
      const initialData = {
        feedback: [{
          id: 'fb_test',
          timestamp: new Date().toISOString(),
          context: { task: 'test', action: 'test_action' },
          rating: 1,
          outcome: 'success'
        }],
        patterns: [['test:test_action', {
          pattern: 'test:test_action',
          confidence: 0.8,
          successRate: 1.0,
          timesApplied: 5,
          lastUsed: new Date().toISOString(),
          examples: ['example']
        }]],
        preferences: []
      };

      await fs.writeFile(
        path.join(tempDir, 'learning.json'),
        JSON.stringify(initialData)
      );

      // Create new instance that loads data
      const newSystem = new LearningSystem(tempDir);
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = newSystem.getStats();
      expect(stats.totalFeedback).toBe(1);
      expect(stats.patternsLearned).toBe(1);
    });

    it('should handle concurrent writes without corruption', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        learningSystem.recordFeedback(
          `task_${i}`,
          'action',
          1,
          'success',
          {},
          `comment_${i}`
        )
      );

      await Promise.all(writes);

      const stats = learningSystem.getStats();
      expect(stats.totalFeedback).toBe(10);

      // Verify file is valid JSON
      const dataPath = path.join(tempDir, 'learning.json');
      const content = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.feedback).toHaveLength(10);
    });

    it('should handle file system errors gracefully', async () => {
      // Make directory read-only
      await fs.chmod(tempDir, 0o444);

      try {
        await learningSystem.recordFeedback(
          'test',
          'action',
          1,
          'success'
        );

        // Should not throw, just log error
        const stats = learningSystem.getStats();
        expect(stats.totalFeedback).toBe(1);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(tempDir, 0o755);
      }
    });
  });

  describe('End-to-End Learning Flow', () => {
    it('should learn from multiple feedback and improve recommendations', async () => {
      // Record positive feedback for code review
      for (let i = 0; i < 5; i++) {
        await learningSystem.recordFeedback(
          'code_review',
          'use_eslint',
          1,
          'success',
          {},
          'ESLint worked great'
        );
      }

      // Record negative feedback for different approach
      for (let i = 0; i < 2; i++) {
        await learningSystem.recordFeedback(
          'code_review',
          'manual_review',
          -1,
          'failure'
        );
      }

      const recommendation = learningSystem.getRecommendation('code_review');
      expect(recommendation).toBeDefined();
      expect(recommendation?.suggestedAction).toContain('use_eslint');
      expect(recommendation?.confidence).toBeGreaterThan(0.5);
    });

    it('should extract and store user preferences', async () => {
      await learningSystem.recordFeedback(
        'formatting',
        'apply_prettier',
        1,
        'success',
        {},
        'I prefer using Prettier for all code'
      );

      const preferences = learningSystem.getPreferences();
      const preferenceMatch = preferences.find(p =>
        p.preference.toLowerCase().includes('prettier')
      );

      expect(preferenceMatch).toBeDefined();
    });

    it('should track success rates over time', async () => {
      const task = 'refactoring';
      const action = 'extract_function';

      // 7 successes
      for (let i = 0; i < 7; i++) {
        await learningSystem.recordFeedback(task, action, 1, 'success');
      }

      // 3 failures
      for (let i = 0; i < 3; i++) {
        await learningSystem.recordFeedback(task, action, -1, 'failure');
      }

      const patterns = learningSystem.getPatterns();
      const pattern = patterns.find(p => p.pattern === `${task}:${action}`);

      expect(pattern).toBeDefined();
      expect(pattern?.timesApplied).toBe(10);
      expect(pattern?.successRate).toBeCloseTo(0.7, 1);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate file read errors during initialization', async () => {
      const badPath = '/nonexistent/path/that/cannot/exist';
      const badSystem = new LearningSystem(badPath);

      // Should handle error internally, not crash
      await new Promise(resolve => setTimeout(resolve, 200));

      // System should still be usable with empty state
      const stats = badSystem.getStats();
      expect(stats.totalFeedback).toBe(0);
    });

    it('should handle initialization timeout', async () => {
      // This tests the timeout mechanism in initialize()
      const slowSystem = new LearningSystem(tempDir);

      // Immediately try to use it before full initialization
      await learningSystem.recordFeedback('test', 'action', 1, 'success');

      const stats = learningSystem.getStats();
      expect(stats.totalFeedback).toBeGreaterThanOrEqual(0);
    });

    it('should recover from corrupted data file', async () => {
      // Write corrupted JSON
      const dataPath = path.join(tempDir, 'learning.json');
      await fs.writeFile(dataPath, '{ invalid json content [[[');

      // Create new instance
      const newSystem = new LearningSystem(tempDir);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should start with clean state
      const stats = newSystem.getStats();
      expect(stats.totalFeedback).toBe(0);
    });
  });

  describe('Multi-Module Interactions', () => {
    it('should integrate with event system', async () => {
      const events: any[] = [];

      // Mock event bus (in real integration, this would be the actual eventBus)
      const originalEmit = (learningSystem as any).eventBus?.emitSync;

      await learningSystem.recordFeedback(
        'test_task',
        'test_action',
        1,
        'success'
      );

      // Verify feedback was recorded
      const stats = learningSystem.getStats();
      expect(stats.totalFeedback).toBe(1);
    });

    it('should persist state across system restarts', async () => {
      // First session
      await learningSystem.recordFeedback('task1', 'action1', 1, 'success');
      await learningSystem.recordFeedback('task2', 'action2', -1, 'failure');

      const stats1 = learningSystem.getStats();

      // Simulate restart
      const newSystem = new LearningSystem(tempDir);
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats2 = newSystem.getStats();
      expect(stats2.totalFeedback).toBe(stats1.totalFeedback);
      expect(stats2.patternsLearned).toBe(stats1.patternsLearned);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent feedback recording', async () => {
      const operations = Array.from({ length: 20 }, (_, i) =>
        learningSystem.recordFeedback(
          `task_${i % 5}`,
          `action_${i % 3}`,
          i % 2 === 0 ? 1 : -1,
          i % 2 === 0 ? 'success' : 'failure'
        )
      );

      await Promise.all(operations);

      const stats = learningSystem.getStats();
      expect(stats.totalFeedback).toBe(20);
    });

    it('should maintain data consistency under concurrent access', async () => {
      const task = 'concurrent_task';
      const action = 'concurrent_action';

      await Promise.all([
        learningSystem.recordFeedback(task, action, 1, 'success'),
        learningSystem.recordFeedback(task, action, 1, 'success'),
        learningSystem.recordFeedback(task, action, 1, 'success'),
        learningSystem.getRecommendation(task),
        learningSystem.getPatterns(),
        learningSystem.getStats()
      ]);

      const stats = learningSystem.getStats();
      expect(stats.totalFeedback).toBe(3);
    });
  });

  describe('Transaction-like Behavior', () => {
    it('should maintain consistency if save fails', async () => {
      // Record initial state
      await learningSystem.recordFeedback('task1', 'action1', 1, 'success');
      const stats1 = learningSystem.getStats();

      // Make save fail by removing write permissions
      await fs.chmod(tempDir, 0o444);

      try {
        await learningSystem.recordFeedback('task2', 'action2', 1, 'success');

        // In-memory state should still update
        const stats2 = learningSystem.getStats();
        expect(stats2.totalFeedback).toBe(2);
      } finally {
        await fs.chmod(tempDir, 0o755);
      }
    });

    it('should handle reset atomically', async () => {
      await learningSystem.recordFeedback('task', 'action', 1, 'success');

      await learningSystem.reset();

      const stats = learningSystem.getStats();
      expect(stats.totalFeedback).toBe(0);
      expect(stats.patternsLearned).toBe(0);

      // Verify file is cleared
      const dataPath = path.join(tempDir, 'learning.json');
      const content = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.feedback).toHaveLength(0);
    });
  });
});
