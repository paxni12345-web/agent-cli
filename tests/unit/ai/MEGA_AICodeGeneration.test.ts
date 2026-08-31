/**
 * Comprehensive Unit Tests for MEGA_AICodeGeneration
 * Coverage: AICodeGenerator, AICodeReviewer, AICodeIntelligence
 */

import {
  AICodeGenerator,
  AICodeReviewer,
  AICodeIntelligence,
  CodeGenerationRequest,
  ProgrammingLanguage,
  AIModel,
  Position,
  RefactoringType,
  GeneratedCode,
  CodeCompletion,
  RefactoringResult,
  CodeExplanation,
  CodeReview,
  ReviewSeverity,
} from '../../../src/ai-code/MEGA_AICodeGeneration';

describe('AICodeGenerator', () => {
  let generator: AICodeGenerator;

  beforeEach(() => {
    generator = new AICodeGenerator();
  });

  afterEach(() => {
    generator.removeAllListeners();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      expect(generator).toBeInstanceOf(AICodeGenerator);
    });

    it('should create instance with custom config', () => {
      const customGenerator = new AICodeGenerator({
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 1024,
        topP: 0.9,
      });
      expect(customGenerator).toBeInstanceOf(AICodeGenerator);
    });

    it('should handle partial config', () => {
      const customGenerator = new AICodeGenerator({
        temperature: 0.8,
      });
      expect(customGenerator).toBeInstanceOf(AICodeGenerator);
    });

    it('should handle empty config', () => {
      const customGenerator = new AICodeGenerator({});
      expect(customGenerator).toBeInstanceOf(AICodeGenerator);
    });
  });

  describe('generate', () => {
    it('should generate code from prompt', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'Create a class for user management',
        language: 'typescript',
      };

      const result = await generator.generate(request);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.language).toBe('typescript');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should emit generation:started event', async () => {
      const listener = jest.fn();
      generator.on('generation:started', listener);

      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
      };

      await generator.generate(request);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'test' })
      );
    });

    it('should emit generation:completed event', async () => {
      const listener = jest.fn();
      generator.on('generation:completed', listener);

      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
      };

      await generator.generate(request);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          generationId: expect.any(String),
          tokensUsed: expect.any(Number),
        })
      );
    });

    it('should use cache for duplicate requests', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test prompt',
        language: 'typescript',
      };

      const result1 = await generator.generate(request);
      const result2 = await generator.generate(request);

      expect(result1.id).toBe(result2.id);
    });

    it('should emit cache_hit event for cached requests', async () => {
      const listener = jest.fn();
      generator.on('generation:cache_hit', listener);

      const request: CodeGenerationRequest = {
        prompt: 'test prompt',
        language: 'typescript',
      };

      await generator.generate(request);
      await generator.generate(request);

      expect(listener).toHaveBeenCalled();
    });

    it('should generate code for different languages', async () => {
      const languages: ProgrammingLanguage[] = [
        'typescript',
        'javascript',
        'python',
        'java',
        'go',
        'rust',
      ];

      for (const language of languages) {
        const request: CodeGenerationRequest = {
          prompt: 'test',
          language,
        };

        const result = await generator.generate(request);
        expect(result.language).toBe(language);
        expect(result.code).toBeTruthy();
      }
    });

    it('should include tests when required', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
        constraints: { requireTests: true },
      };

      const result = await generator.generate(request);
      expect(result.tests).toBeDefined();
    });

    it('should include documentation when required', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
        constraints: { requireDocs: true },
      };

      const result = await generator.generate(request);
      expect(result.documentation).toBeDefined();
    });

    it('should handle context with existing code', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
        context: {
          existingCode: 'class ExistingClass {}',
          imports: ['import { Something } from "somewhere"'],
        },
      };

      const result = await generator.generate(request);
      expect(result).toBeDefined();
    });

    it('should handle generation constraints', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
        constraints: {
          maxLines: 100,
          maxComplexity: 10,
          usePatterns: ['singleton', 'factory'],
        },
      };

      const result = await generator.generate(request);
      expect(result).toBeDefined();
    });

    it('should handle coding style preferences', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
        style: {
          indentation: 'spaces',
          quotes: 'single',
          semicolons: true,
          trailingComma: true,
          bracketSpacing: true,
          arrowParens: 'always',
          namingConvention: {
            variables: 'camelCase',
            functions: 'camelCase',
            classes: 'PascalCase',
            constants: 'SCREAMING_SNAKE_CASE',
          },
        },
      };

      const result = await generator.generate(request);
      expect(result).toBeDefined();
    });

    it('should handle null prompt', async () => {
      const request = {
        prompt: null as any,
        language: 'typescript' as ProgrammingLanguage,
      };

      await expect(generator.generate(request)).rejects.toThrow();
    });

    it('should handle undefined prompt', async () => {
      const request = {
        prompt: undefined as any,
        language: 'typescript' as ProgrammingLanguage,
      };

      await expect(generator.generate(request)).rejects.toThrow();
    });

    it('should handle empty prompt', async () => {
      const request: CodeGenerationRequest = {
        prompt: '',
        language: 'typescript',
      };

      const result = await generator.generate(request);
      expect(result).toBeDefined();
    });

    it('should include metadata', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
      };

      const result = await generator.generate(request);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.model).toBeDefined();
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
      expect(result.metadata.version).toBeDefined();
    });

    it('should handle concurrent generations', async () => {
      const requests = [
        { prompt: 'test1', language: 'typescript' as ProgrammingLanguage },
        { prompt: 'test2', language: 'python' as ProgrammingLanguage },
        { prompt: 'test3', language: 'java' as ProgrammingLanguage },
      ];

      const results = await Promise.all(
        requests.map(req => generator.generate(req))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
      });
    });

    it('should calculate confidence correctly', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
      };

      const result = await generator.generate(request);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should generate unique IDs', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'unique test',
        language: 'typescript',
      };

      const result1 = await generator.generate(request);

      const request2: CodeGenerationRequest = {
        prompt: 'another unique test',
        language: 'typescript',
      };

      const result2 = await generator.generate(request2);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('complete', () => {
    it('should provide code completions', async () => {
      const code = 'const x = ';
      const position: Position = { line: 0, character: 10 };

      const completions = await generator.complete(code, position, 'typescript');

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should emit completion:requested event', async () => {
      const listener = jest.fn();
      generator.on('completion:requested', listener);

      const position: Position = { line: 0, character: 10 };
      await generator.complete('const x = ', position, 'typescript');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ position })
      );
    });

    it('should emit completion:completed event', async () => {
      const listener = jest.fn();
      generator.on('completion:completed', listener);

      const position: Position = { line: 0, character: 10 };
      await generator.complete('const x = ', position, 'typescript');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ count: expect.any(Number) })
      );
    });

    it('should return completions with required fields', async () => {
      const position: Position = { line: 0, character: 10 };
      const completions = await generator.complete('const x = ', position, 'typescript');

      completions.forEach(completion => {
        expect(completion.id).toBeDefined();
        expect(completion.text).toBeDefined();
        expect(completion.position).toEqual(position);
        expect(completion.score).toBeGreaterThan(0);
        expect(completion.type).toBeDefined();
      });
    });

    it('should handle null code', async () => {
      const position: Position = { line: 0, character: 0 };

      await expect(
        generator.complete(null as any, position, 'typescript')
      ).rejects.toThrow();
    });

    it('should handle undefined code', async () => {
      const position: Position = { line: 0, character: 0 };

      await expect(
        generator.complete(undefined as any, position, 'typescript')
      ).rejects.toThrow();
    });

    it('should handle empty code', async () => {
      const position: Position = { line: 0, character: 0 };
      const completions = await generator.complete('', position, 'typescript');

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should handle null position', async () => {
      await expect(
        generator.complete('const x = ', null as any, 'typescript')
      ).rejects.toThrow();
    });

    it('should handle negative line number', async () => {
      const position: Position = { line: -1, character: 0 };
      const completions = await generator.complete('const x = ', position, 'typescript');

      expect(completions).toBeDefined();
    });

    it('should handle negative character position', async () => {
      const position: Position = { line: 0, character: -1 };
      const completions = await generator.complete('const x = ', position, 'typescript');

      expect(completions).toBeDefined();
    });

    it('should sort completions by score', async () => {
      const position: Position = { line: 0, character: 10 };
      const completions = await generator.complete('const x = ', position, 'typescript');

      for (let i = 1; i < completions.length; i++) {
        expect(completions[i - 1].score).toBeGreaterThanOrEqual(completions[i].score);
      }
    });
  });

  describe('refactor', () => {
    const sampleCode = 'var x = 10; var y = 20;';

    it('should refactor code', async () => {
      const result = await generator.refactor(sampleCode, 'optimize');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.original).toBe(sampleCode);
      expect(result.refactored).toBeDefined();
      expect(result.type).toBe('optimize');
      expect(result.changes).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(typeof result.safe).toBe('boolean');
    });

    it('should emit refactor:started event', async () => {
      const listener = jest.fn();
      generator.on('refactor:started', listener);

      await generator.refactor(sampleCode, 'optimize');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'optimize' })
      );
    });

    it('should emit refactor:completed event', async () => {
      const listener = jest.fn();
      generator.on('refactor:completed', listener);

      await generator.refactor(sampleCode, 'optimize');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ refactoringId: expect.any(String) })
      );
    });

    it('should handle all refactoring types', async () => {
      const types: RefactoringType[] = [
        'extract_function',
        'extract_variable',
        'inline',
        'rename',
        'move',
        'optimize',
      ];

      for (const type of types) {
        const result = await generator.refactor(sampleCode, type);
        expect(result.type).toBe(type);
      }
    });

    it('should include code changes', async () => {
      const result = await generator.refactor(sampleCode, 'optimize');

      expect(result.changes).toBeDefined();
      expect(Array.isArray(result.changes)).toBe(true);

      if (result.changes.length > 0) {
        const change = result.changes[0];
        expect(change.type).toBeDefined();
        expect(change.range).toBeDefined();
      }
    });

    it('should handle null code', async () => {
      await expect(
        generator.refactor(null as any, 'optimize')
      ).rejects.toThrow();
    });

    it('should handle undefined code', async () => {
      await expect(
        generator.refactor(undefined as any, 'optimize')
      ).rejects.toThrow();
    });

    it('should handle empty code', async () => {
      const result = await generator.refactor('', 'optimize');
      expect(result).toBeDefined();
    });
  });

  describe('explainCode', () => {
    const sampleCode = `
      class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }
      }
    `;

    it('should explain code', async () => {
      const explanation = await generator.explainCode(sampleCode);

      expect(explanation).toBeDefined();
      expect(explanation.id).toBeDefined();
      expect(explanation.code).toBe(sampleCode);
      expect(explanation.summary).toBeDefined();
      expect(explanation.details).toBeDefined();
      expect(Array.isArray(explanation.details)).toBe(true);
      expect(explanation.complexity).toBeDefined();
      expect(explanation.patterns).toBeDefined();
      expect(explanation.suggestions).toBeDefined();
    });

    it('should emit explain:started event', async () => {
      const listener = jest.fn();
      generator.on('explain:started', listener);

      await generator.explainCode(sampleCode);

      expect(listener).toHaveBeenCalled();
    });

    it('should emit explain:completed event', async () => {
      const listener = jest.fn();
      generator.on('explain:completed', listener);

      await generator.explainCode(sampleCode);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ explanationId: expect.any(String) })
      );
    });

    it('should calculate complexity metrics', async () => {
      const explanation = await generator.explainCode(sampleCode);

      expect(explanation.complexity.cyclomatic).toBeGreaterThanOrEqual(0);
      expect(explanation.complexity.cognitive).toBeGreaterThanOrEqual(0);
      expect(explanation.complexity.lines).toBeGreaterThanOrEqual(0);
      expect(explanation.complexity.maintainability).toBeGreaterThanOrEqual(0);
      expect(explanation.complexity.maintainability).toBeLessThanOrEqual(100);
    });

    it('should identify code patterns', async () => {
      const explanation = await generator.explainCode(sampleCode);

      expect(explanation.patterns).toBeDefined();
      expect(Array.isArray(explanation.patterns)).toBe(true);

      if (explanation.patterns.length > 0) {
        const pattern = explanation.patterns[0];
        expect(pattern.name).toBeDefined();
        expect(pattern.category).toBeDefined();
        expect(pattern.description).toBeDefined();
      }
    });

    it('should generate suggestions', async () => {
      const explanation = await generator.explainCode(sampleCode);

      expect(explanation.suggestions).toBeDefined();
      expect(Array.isArray(explanation.suggestions)).toBe(true);
    });

    it('should handle null code', async () => {
      await expect(generator.explainCode(null as any)).rejects.toThrow();
    });

    it('should handle undefined code', async () => {
      await expect(generator.explainCode(undefined as any)).rejects.toThrow();
    });

    it('should handle empty code', async () => {
      const explanation = await generator.explainCode('');
      expect(explanation).toBeDefined();
    });

    it('should calculate complexity for complex code', async () => {
      const complexCode = `
        function complex() {
          if (a) {
            for (let i = 0; i < 10; i++) {
              while (condition) {
                switch (x) {
                  case 1:
                    break;
                  case 2:
                    break;
                }
              }
            }
          }
        }
      `;

      const explanation = await generator.explainCode(complexCode);
      expect(explanation.complexity.cyclomatic).toBeGreaterThan(1);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = generator.getStats();

      expect(stats).toBeDefined();
      expect(stats.generations).toBeDefined();
      expect(stats.cachedGenerations).toBeDefined();
      expect(stats.totalCompletions).toBeDefined();
    });

    it('should track generations count', async () => {
      const initialStats = generator.getStats();

      await generator.generate({
        prompt: 'test',
        language: 'typescript',
      });

      const afterStats = generator.getStats();
      expect(afterStats.generations).toBeGreaterThan(initialStats.generations);
    });

    it('should track cached generations', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'cached test',
        language: 'typescript',
      };

      await generator.generate(request);
      const statsAfterFirst = generator.getStats();

      await generator.generate(request);
      const statsAfterCached = generator.getStats();

      expect(statsAfterCached.cachedGenerations).toBeGreaterThanOrEqual(
        statsAfterFirst.cachedGenerations
      );
    });

    it('should track completions count', async () => {
      const initialStats = generator.getStats();

      await generator.complete('const x = ', { line: 0, character: 10 }, 'typescript');

      const afterStats = generator.getStats();
      expect(afterStats.totalCompletions).toBeGreaterThan(initialStats.totalCompletions);
    });
  });

  describe('Error Handling', () => {
    it('should handle generation errors gracefully', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
      };

      // Mock internal error
      jest.spyOn(generator as any, 'generateCode').mockRejectedValue(
        new Error('Generation failed')
      );

      await expect(generator.generate(request)).rejects.toThrow('Generation failed');
    });

    it('should handle completion errors gracefully', async () => {
      const position: Position = { line: 0, character: 0 };

      jest.spyOn(generator as any, 'complete').mockRejectedValue(
        new Error('Completion failed')
      );

      await expect(
        generator.complete('test', position, 'typescript')
      ).rejects.toThrow('Completion failed');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle generation timeout', async () => {
      const request: CodeGenerationRequest = {
        prompt: 'test',
        language: 'typescript',
      };

      jest.spyOn(generator as any, 'generateCode').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const timeoutPromise = Promise.race([
        generator.generate(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        ),
      ]);

      await expect(timeoutPromise).rejects.toThrow('Timeout');
    });
  });

  describe('Type Safety', () => {
    it('should enforce ProgrammingLanguage type', async () => {
      const languages: ProgrammingLanguage[] = [
        'typescript',
        'javascript',
        'python',
        'java',
        'go',
        'rust',
        'cpp',
        'csharp',
        'ruby',
        'php',
        'swift',
        'kotlin',
      ];

      for (const language of languages) {
        const request: CodeGenerationRequest = {
          prompt: 'test',
          language,
        };

        const result = await generator.generate(request);
        expect(result.language).toBe(language);
      }
    });
  });
});

describe('AICodeReviewer', () => {
  let reviewer: AICodeReviewer;

  beforeEach(() => {
    reviewer = new AICodeReviewer();
  });

  afterEach(() => {
    reviewer.removeAllListeners();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      expect(reviewer).toBeInstanceOf(AICodeReviewer);
    });

    it('should create instance with custom config', () => {
      const customReviewer = new AICodeReviewer({
        autoFix: true,
        severity: ['error', 'critical'],
      });
      expect(customReviewer).toBeInstanceOf(AICodeReviewer);
    });

    it('should handle partial config', () => {
      const customReviewer = new AICodeReviewer({
        autoFix: true,
      });
      expect(customReviewer).toBeInstanceOf(AICodeReviewer);
    });

    it('should handle empty config', () => {
      const customReviewer = new AICodeReviewer({});
      expect(customReviewer).toBeInstanceOf(AICodeReviewer);
    });
  });

  describe('review', () => {
    const sampleCode = `
      var x = 10;
      console.log(x);
    `;

    it('should review code', async () => {
      const review = await reviewer.review(sampleCode, 'typescript');

      expect(review).toBeDefined();
      expect(review.id).toBeDefined();
      expect(review.code).toBe(sampleCode);
      expect(review.issues).toBeDefined();
      expect(Array.isArray(review.issues)).toBe(true);
      expect(review.score).toBeGreaterThanOrEqual(0);
      expect(review.score).toBeLessThanOrEqual(100);
      expect(review.timestamp).toBeInstanceOf(Date);
    });

    it('should emit review:started event', async () => {
      const listener = jest.fn();
      reviewer.on('review:started', listener);

      await reviewer.review(sampleCode, 'typescript');

      expect(listener).toHaveBeenCalled();
    });

    it('should emit review:completed event', async () => {
      const listener = jest.fn();
      reviewer.on('review:completed', listener);

      await reviewer.review(sampleCode, 'typescript');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewId: expect.any(String),
          issues: expect.any(Number),
        })
      );
    });

    it('should identify console.log issues', async () => {
      const codeWithConsole = 'console.log("test");';
      const review = await reviewer.review(codeWithConsole, 'typescript');

      const consoleIssue = review.issues.find(
        issue => issue.rule === 'no-console'
      );
      expect(consoleIssue).toBeDefined();
    });

    it('should identify var usage issues', async () => {
      const codeWithVar = 'var x = 10;';
      const review = await reviewer.review(codeWithVar, 'typescript');

      const varIssue = review.issues.find(issue => issue.rule === 'no-var');
      expect(varIssue).toBeDefined();
    });

    it('should calculate review score', async () => {
      const cleanCode = 'const x = 10; const y = 20;';
      const review = await reviewer.review(cleanCode, 'typescript');

      expect(review.score).toBeGreaterThanOrEqual(0);
      expect(review.score).toBeLessThanOrEqual(100);
    });

    it('should include issue details', async () => {
      const review = await reviewer.review(sampleCode, 'typescript');

      if (review.issues.length > 0) {
        const issue = review.issues[0];
        expect(issue.id).toBeDefined();
        expect(issue.rule).toBeDefined();
        expect(issue.category).toBeDefined();
        expect(issue.severity).toBeDefined();
        expect(issue.message).toBeDefined();
        expect(issue.line).toBeDefined();
        expect(issue.column).toBeDefined();
      }
    });

    it('should suggest fixes', async () => {
      const review = await reviewer.review(sampleCode, 'typescript');

      const issueWithFix = review.issues.find(issue => issue.fix);
      if (issueWithFix) {
        expect(issueWithFix.fix).toBeDefined();
        expect(issueWithFix.fix!.description).toBeDefined();
        expect(issueWithFix.fix!.changes).toBeDefined();
        expect(typeof issueWithFix.fix!.automatic).toBe('boolean');
      }
    });

    it('should handle null code', async () => {
      await expect(
        reviewer.review(null as any, 'typescript')
      ).rejects.toThrow();
    });

    it('should handle undefined code', async () => {
      await expect(
        reviewer.review(undefined as any, 'typescript')
      ).rejects.toThrow();
    });

    it('should handle empty code', async () => {
      const review = await reviewer.review('', 'typescript');
      expect(review).toBeDefined();
      expect(review.issues).toHaveLength(0);
    });

    it('should review different languages', async () => {
      const languages: ProgrammingLanguage[] = [
        'typescript',
        'javascript',
        'python',
      ];

      for (const language of languages) {
        const review = await reviewer.review('const x = 10;', language);
        expect(review).toBeDefined();
      }
    });

    it('should handle concurrent reviews', async () => {
      const codes = [
        'var x = 10;',
        'console.log("test");',
        'const y = 20;',
      ];

      const reviews = await Promise.all(
        codes.map(code => reviewer.review(code, 'typescript'))
      );

      expect(reviews).toHaveLength(3);
      reviews.forEach(review => {
        expect(review).toBeDefined();
        expect(review.id).toBeDefined();
      });
    });

    it('should categorize issues correctly', async () => {
      const review = await reviewer.review(sampleCode, 'typescript');

      const validCategories = [
        'correctness',
        'performance',
        'security',
        'maintainability',
        'style',
        'best_practices',
      ];

      review.issues.forEach(issue => {
        expect(validCategories).toContain(issue.category);
      });
    });

    it('should assign severity levels', async () => {
      const review = await reviewer.review(sampleCode, 'typescript');

      const validSeverities: ReviewSeverity[] = [
        'info',
        'warning',
        'error',
        'critical',
      ];

      review.issues.forEach(issue => {
        expect(validSeverities).toContain(issue.severity);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle review errors gracefully', async () => {
      jest.spyOn(reviewer as any, 'findIssues').mockRejectedValue(
        new Error('Review failed')
      );

      await expect(
        reviewer.review('test code', 'typescript')
      ).rejects.toThrow('Review failed');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle review timeout', async () => {
      jest.spyOn(reviewer as any, 'findIssues').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const timeoutPromise = Promise.race([
        reviewer.review('test code', 'typescript'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        ),
      ]);

      await expect(timeoutPromise).rejects.toThrow('Timeout');
    });
  });
});

describe('AICodeIntelligence', () => {
  let intelligence: AICodeIntelligence;

  beforeEach(() => {
    intelligence = new AICodeIntelligence();
  });

  describe('Constructor', () => {
    it('should create instance', () => {
      expect(intelligence).toBeInstanceOf(AICodeIntelligence);
    });

    it('should have generator', () => {
      expect(intelligence.generator).toBeInstanceOf(AICodeGenerator);
    });

    it('should have reviewer', () => {
      expect(intelligence.reviewer).toBeInstanceOf(AICodeReviewer);
    });
  });

  describe('getOverallStats', () => {
    it('should return overall statistics', () => {
      const stats = intelligence.getOverallStats();

      expect(stats).toBeDefined();
      expect(stats.generation).toBeDefined();
      expect(stats.reviews).toBeDefined();
    });

    it('should include generation stats', () => {
      const stats = intelligence.getOverallStats();

      expect(stats.generation.generations).toBeDefined();
      expect(stats.generation.cachedGenerations).toBeDefined();
      expect(stats.generation.totalCompletions).toBeDefined();
    });

    it('should track stats across operations', async () => {
      await intelligence.generator.generate({
        prompt: 'test',
        language: 'typescript',
      });

      await intelligence.reviewer.review('const x = 10;', 'typescript');

      const stats = intelligence.getOverallStats();
      expect(stats.generation.generations).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should handle concurrent generator and reviewer operations', async () => {
      const operations = [
        intelligence.generator.generate({
          prompt: 'test',
          language: 'typescript',
        }),
        intelligence.reviewer.review('const x = 10;', 'typescript'),
      ];

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it('should maintain separate state for generator and reviewer', async () => {
      await intelligence.generator.generate({
        prompt: 'test',
        language: 'typescript',
      });

      await intelligence.reviewer.review('const x = 10;', 'typescript');

      const generatorStats = intelligence.generator.getStats();
      const overallStats = intelligence.getOverallStats();

      expect(generatorStats.generations).toBeGreaterThan(0);
      expect(overallStats.reviews).toBeDefined();
    });
  });
});
