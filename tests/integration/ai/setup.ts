/**
 * Test Setup for AI Integration Tests
 * Runs before all tests in the suite
 */

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Extend default timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  /**
   * Sleep utility for async tests
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Retry utility for flaky operations
   */
  retry: async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await global.testUtils.sleep(delay);
      }
    }
    throw new Error('Retry failed');
  },

  /**
   * Create unique test identifier
   */
  uniqueId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
};

// Mock console methods to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  // Only log actual errors, not expected test errors
  if (!args[0]?.toString().includes('Expected')) {
    originalConsoleError(...args);
  }
};

console.warn = (...args: any[]) => {
  // Suppress warnings during tests unless explicitly needed
  if (process.env.SHOW_WARNINGS === 'true') {
    originalConsoleWarn(...args);
  }
};

// Track test performance
const testPerformance = new Map<string, number>();

beforeEach(() => {
  const testName = expect.getState().currentTestName;
  testPerformance.set(testName || 'unknown', Date.now());
});

afterEach(() => {
  const testName = expect.getState().currentTestName;
  const startTime = testPerformance.get(testName || 'unknown');
  if (startTime) {
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      console.log(`⚠️  Slow test: ${testName} took ${duration}ms`);
    }
  }
});

// Cleanup event listeners to prevent memory leaks
afterEach(() => {
  // Remove all listeners from common event emitters
  if (global.gc) {
    global.gc();
  }
});

// Export types for global utilities
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        sleep: (ms: number) => Promise<void>;
        retry: <T>(fn: () => Promise<T>, maxRetries?: number, delay?: number) => Promise<T>;
        uniqueId: () => string;
      };
    }
  }
}

export {};
