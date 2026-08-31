/**
 * Jest Setup File
 * Global test setup and mocks
 */

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers for consistent testing
jest.useFakeTimers();

// Global test utilities
global.testUtils = {
  createMockRequest: (overrides = {}) => ({
    id: 'test-req',
    method: 'GET',
    path: '/test',
    headers: {},
    query: {},
    params: {},
    body: undefined,
    ip: '127.0.0.1',
    timestamp: Date.now(),
    metadata: {},
    ...overrides,
  }),

  createMockResponse: (overrides = {}) => ({
    status: 200,
    headers: {},
    body: {},
    ...overrides,
  }),

  waitFor: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Cleanup after all tests
afterAll(() => {
  jest.restoreAllMocks();
});
