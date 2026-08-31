/**
 * Integration Security Test Configuration
 * Jest configuration and setup for security tests
 */

module.exports = {
  displayName: 'Integration Security Tests',
  testMatch: ['**/tests/security/integrations/**/*.test.ts'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/integrations/**/*.ts',
    '!src/integrations/**/*.d.ts',
    '!src/integrations/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/security/integrations/setup.ts'],
  testTimeout: 30000,
  verbose: true
};
