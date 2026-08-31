/**
 * Global setup for API integration tests
 * Runs before all tests in the suite
 */

import { cleanupTestContainers } from './test-containers.util';

// Extend Jest timeout for integration tests
jest.setTimeout(60000);

// Global setup
beforeAll(async () => {
  // Cleanup any leftover containers from previous test runs
  try {
    await cleanupTestContainers();
  } catch (error) {
    console.warn('Failed to cleanup test containers:', error);
  }
});

// Global teardown
afterAll(async () => {
  // Cleanup all test containers
  try {
    await cleanupTestContainers();
  } catch (error) {
    console.warn('Failed to cleanup test containers:', error);
  }

  // Give time for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
});

// Suppress console errors during tests (optional)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Only suppress specific expected errors
    const message = args[0]?.toString() || '';
    if (
      message.includes('Docker not available') ||
      message.includes('Container not ready')
    ) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    // Suppress specific warnings
    const message = args[0]?.toString() || '';
    if (message.includes('Docker not available')) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Declare custom matcher types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

export {};
