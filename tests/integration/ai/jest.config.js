/**
 * Jest Configuration for AI Integration Tests
 * Optimized for long-running integration tests with real I/O operations
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test matching
  testMatch: [
    '**/tests/integration/ai/**/*.integration.test.ts'
  ],

  // Longer timeout for integration tests (30 seconds)
  testTimeout: 30000,

  // Coverage configuration
  collectCoverageFrom: [
    'src/ai/**/*.ts',
    '!src/ai/**/*.d.ts',
    '!src/ai/**/*.test.ts'
  ],

  coverageDirectory: 'coverage/integration/ai',

  coverageThresholds: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/integration/ai/setup.ts'],
  globalTeardown: '<rootDir>/tests/integration/ai/teardown.ts',

  // Performance
  maxWorkers: '50%', // Use half of available CPU cores

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results/integration/ai',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Verbose output for integration tests
  verbose: true,

  // Display individual test results
  displayName: {
    name: 'AI Integration Tests',
    color: 'blue'
  },

  // Error handling
  bail: false, // Continue running tests even if some fail
  errorOnDeprecated: true,

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true
        }
      }
    ]
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true
};
