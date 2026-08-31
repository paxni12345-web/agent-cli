/**
 * Global setup for integration tests
 * Runs before all tests
 */

import { TestEnvironment } from './security/test-helpers';

beforeAll(async () => {
  console.log('🚀 Setting up integration test environment...');

  try {
    await TestEnvironment.setup();
    console.log('✅ Test environment ready');
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
}, 60000);

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');

  try {
    await TestEnvironment.teardown();
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Failed to cleanup test environment:', error);
  }
}, 30000);

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console logs during tests (can be enabled for debugging)
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}
