/**
 * Security Test Configuration
 * Jest configuration specifically for security tests
 */

module.exports = {
  displayName: 'security-tests',
  testMatch: ['**/tests/security/**/*.test.ts'],
  testEnvironment: 'node',
  preset: 'ts-jest',

  // Security tests should run serially to avoid interference
  maxWorkers: 1,

  // Longer timeout for security tests (rate limiting tests take time)
  testTimeout: 30000,

  // Clear mocks between tests for isolation
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Coverage thresholds for security-critical code
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Verbose output for security test results
  verbose: true,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/security/setup.ts'],

  // Transform TypeScript
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // Module name mapper for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Collect coverage from security-critical files
  collectCoverageFrom: [
    'src/api/**/*.ts',
    'src/security/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
};
