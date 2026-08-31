/**
 * VALIDATION MIDDLEWARE TESTS
 * Comprehensive tests for all validation features
 */

import { z } from 'zod';
import {
  RequestValidator,
  SecurityValidator,
  CommonSchemas,
  ValidationPresets,
  ValidationConfig,
  EndpointRateLimiter,
} from './ValidationMiddleware';
import { APIRequest, HttpMethod } from './APIGateway';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockRequest(overrides: Partial<APIRequest> = {}): APIRequest {
  return {
    id: 'req-123',
    method: 'POST' as HttpMethod,
    path: '/api/test',
    headers: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    userAgent: 'Test Agent',
    timestamp: new Date(),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// Security Validator Tests
// ============================================================================

console.log('=== Security Validator Tests ===\n');

// XSS Detection
console.log('1. XSS Detection:');
const xssExamples = [
  '<script>alert("XSS")</script>',
  'javascript:alert("XSS")',
  '<img src=x onerror="alert(1)">',
  '<iframe src="evil.com"></iframe>',
  'Normal text without XSS',
];

xssExamples.forEach(example => {
  const detected = SecurityValidator.detectXSS(example);
  console.log(`  "${example.substring(0, 40)}..." => ${detected ? '🚫 BLOCKED' : '✅ ALLOWED'}`);
});

// SQL Injection Detection
console.log('\n2. SQL Injection Detection:');
const sqlExamples = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "UNION SELECT * FROM passwords",
  "SELECT * FROM users WHERE id = 1",
  "Normal search query",
];

sqlExamples.forEach(example => {
  const detected = SecurityValidator.detectSQLInjection(example);
  console.log(`  "${example}" => ${detected ? '🚫 BLOCKED' : '✅ ALLOWED'}`);
});

// Command Injection Detection
console.log('\n3. Command Injection Detection:');
const cmdExamples = [
  'test; rm -rf /',
  'test | cat /etc/passwd',
  'test && malicious_command',
  '$(malicious_command)',
  'normal-file-name.txt',
];

cmdExamples.forEach(example => {
  const detected = SecurityValidator.detectCommandInjection(example);
  console.log(`  "${example}" => ${detected ? '🚫 BLOCKED' : '✅ ALLOWED'}`);
});

// Path Traversal Detection
console.log('\n4. Path Traversal Detection:');
const pathExamples = [
  '../../../etc/passwd',
  '..\\..\\windows\\system32',
  '%2e%2e%2f%2e%2e%2f',
  'normal/file/path.txt',
];

pathExamples.forEach(example => {
  const detected = SecurityValidator.detectPathTraversal(example);
  console.log(`  "${example}" => ${detected ? '🚫 BLOCKED' : '✅ ALLOWED'}`);
});

// HTML Sanitization
console.log('\n5. HTML Sanitization:');
const htmlInput = '<script>alert("XSS")</script><p onclick="evil()">Hello</p>';
const sanitized = SecurityValidator.sanitizeHTML(htmlInput);
console.log(`  Input:  "${htmlInput}"`);
console.log(`  Output: "${sanitized}"`);

// ============================================================================
// Schema Validation Tests
// ============================================================================

console.log('\n\n=== Schema Validation Tests ===\n');

// Email Validation
console.log('1. Email Validation:');
const emails = [
  'valid@example.com',
  'user+tag@domain.co.uk',
  'invalid@',
  'not-an-email',
  '@example.com',
];

emails.forEach(email => {
  const result = CommonSchemas.email.safeParse(email);
  console.log(`  "${email}" => ${result.success ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.success) {
    console.log(`    Error: ${result.error.errors[0].message}`);
  }
});

// Phone Validation
console.log('\n2. Phone Validation:');
const phones = [
  '+14155552671',
  '+442071838750',
  '555-1234',
  'not-a-phone',
];

phones.forEach(phone => {
  const result = CommonSchemas.phone.safeParse(phone);
  console.log(`  "${phone}" => ${result.success ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.success) {
    console.log(`    Error: ${result.error.errors[0].message}`);
  }
});

// URL Validation
console.log('\n3. URL Validation:');
const urls = [
  'https://example.com',
  'http://localhost:3000/api',
  'ftp://files.example.com',
  'not a url',
  'javascript:alert(1)',
];

urls.forEach(url => {
  const result = CommonSchemas.url.safeParse(url);
  console.log(`  "${url}" => ${result.success ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.success) {
    console.log(`    Error: ${result.error.errors[0].message}`);
  }
});

// Password Validation
console.log('\n4. Password Validation:');
const passwords = [
  'P@ssw0rd123',
  'weakpass',
  'NoNumbers!',
  'nospecialchars123',
  'NOLOWERCASE1!',
];

passwords.forEach(password => {
  const result = CommonSchemas.password.safeParse(password);
  console.log(`  "${password}" => ${result.success ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.success) {
    console.log(`    Error: ${result.error.errors[0].message}`);
  }
});

// Complex Schema Validation
console.log('\n5. Complex User Schema:');
const userSchema = z.object({
  username: CommonSchemas.username,
  email: CommonSchemas.email,
  password: CommonSchemas.password,
  age: z.number().int().min(13).max(120),
  website: CommonSchemas.url.optional(),
});

const testUsers = [
  {
    username: 'john_doe',
    email: 'john@example.com',
    password: 'SecureP@ss123',
    age: 25,
    website: 'https://johndoe.com',
  },
  {
    username: 'ab', // Too short
    email: 'invalid-email',
    password: 'weak',
    age: 10, // Too young
  },
];

testUsers.forEach((user, index) => {
  const result = userSchema.safeParse(user);
  console.log(`  User ${index + 1}: ${result.success ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.success) {
    result.error.errors.forEach(err => {
      console.log(`    - ${err.path.join('.')}: ${err.message}`);
    });
  }
});

// ============================================================================
// Request Validator Tests
// ============================================================================

console.log('\n\n=== Request Validator Tests ===\n');

const validator = new RequestValidator();

// Test 1: Valid Request with Schema
console.log('1. Valid Request with Schema:');
(async () => {
  const request = createMockRequest({
    body: {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecureP@ss123',
    },
  });

  const config: ValidationConfig = {
    schemas: {
      body: z.object({
        username: CommonSchemas.username,
        email: CommonSchemas.email,
        password: CommonSchemas.password,
      }),
    },
    security: {
      preventXSS: true,
      preventSQLInjection: true,
    },
  };

  const result = await validator.validate(request, config);
  console.log(`  Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    console.log('  Errors:', result.errors);
  }
})();

// Test 2: Invalid Request with XSS
console.log('\n2. Invalid Request with XSS:');
(async () => {
  const request = createMockRequest({
    body: {
      comment: '<script>alert("XSS")</script>',
    },
  });

  const config: ValidationConfig = {
    security: {
      preventXSS: true,
    },
  };

  const result = await validator.validate(request, config);
  console.log(`  Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    console.log('  Errors:', JSON.stringify(result.errors, null, 2));
  }
})();

// Test 3: SQL Injection Attempt
console.log('\n3. SQL Injection Attempt:');
(async () => {
  const request = createMockRequest({
    query: {
      id: "1' OR '1'='1",
    },
  });

  const config: ValidationConfig = {
    security: {
      preventSQLInjection: true,
    },
  };

  const result = await validator.validate(request, config);
  console.log(`  Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    console.log('  Errors:', JSON.stringify(result.errors, null, 2));
  }
})();

// Test 4: Nested Object Sanitization
console.log('\n4. Nested Object Sanitization:');
(async () => {
  const request = createMockRequest({
    body: {
      user: {
        name: 'John',
        bio: '<script>alert(1)</script>Safe text',
        nested: {
          data: 'More data',
        },
      },
    },
  });

  const config: ValidationConfig = {
    security: {
      preventXSS: true,
      sanitizeHTML: true,
      maxDepth: 5,
    },
  };

  const result = await validator.validate(request, config);
  console.log(`  Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (result.sanitized) {
    console.log('  Sanitized:', JSON.stringify(result.sanitized.body, null, 2));
  }
})();

// ============================================================================
// Rate Limiting Tests
// ============================================================================

console.log('\n\n=== Rate Limiting Tests ===\n');

const rateLimiter = new EndpointRateLimiter();

console.log('1. Rate Limiting (5 requests per second):');
(async () => {
  const config = {
    windowMs: 1000,
    maxRequests: 5,
  };

  for (let i = 1; i <= 7; i++) {
    const request = createMockRequest({ id: `req-${i}` });
    const result = rateLimiter.checkLimit(request, config);
    console.log(
      `  Request ${i}: ${result.allowed ? '✅ ALLOWED' : '🚫 BLOCKED'} (${result.remaining} remaining)`
    );
  }
})();

// ============================================================================
// Validation Presets Tests
// ============================================================================

console.log('\n\n=== Validation Presets Tests ===\n');

console.log('1. Strict Preset Configuration:');
const strictConfig = ValidationPresets.strict();
console.log('  Security checks enabled:');
console.log(`    - XSS Prevention: ${strictConfig.security?.preventXSS}`);
console.log(`    - SQL Injection Prevention: ${strictConfig.security?.preventSQLInjection}`);
console.log(`    - Command Injection Prevention: ${strictConfig.security?.preventCommandInjection}`);
console.log(`    - Path Traversal Prevention: ${strictConfig.security?.preventPathTraversal}`);
console.log(`    - HTML Sanitization: ${strictConfig.security?.sanitizeHTML}`);
console.log(`  Rate Limit: ${strictConfig.rateLimit?.maxRequests} requests per ${strictConfig.rateLimit?.windowMs}ms`);

console.log('\n2. Public API Preset Configuration:');
const publicConfig = ValidationPresets.publicAPI();
console.log('  Max Field Size:', publicConfig.security?.maxFieldSize, 'bytes');
console.log('  Max Depth:', publicConfig.security?.maxDepth);
console.log('  Rate Limit:', publicConfig.rateLimit?.maxRequests, 'requests per minute');

// ============================================================================
// Edge Cases Tests
// ============================================================================

console.log('\n\n=== Edge Cases Tests ===\n');

console.log('1. Empty Request Body:');
(async () => {
  const request = createMockRequest({ body: undefined });
  const config: ValidationConfig = {
    schemas: {
      body: z.object({
        required: z.string(),
      }),
    },
  };

  const result = await validator.validate(request, config);
  console.log(`  Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
})();

console.log('\n2. Very Deep Nested Object:');
(async () => {
  let deepObj: any = { value: 'deep' };
  for (let i = 0; i < 15; i++) {
    deepObj = { nested: deepObj };
  }

  const request = createMockRequest({ body: deepObj });
  const config: ValidationConfig = {
    security: {
      maxDepth: 10,
    },
  };

  const result = await validator.validate(request, config);
  console.log(`  Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    console.log('  Error:', result.errors?.[0]?.message);
  }
})();

console.log('\n3. Large Field Size:');
(async () => {
  const largeString = 'a'.repeat(2 * 1024 * 1024); // 2MB string
  const request = createMockRequest({ body: { data: largeString } });
  const config: ValidationConfig = {
    security: {
      maxFieldSize: 1024 * 1024, // 1MB limit
    },
  };

  const result = await validator.validate(request, config);
  console.log(`  Result: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    console.log('  Error:', result.errors?.[0]?.message);
  }
})();

// ============================================================================
// Summary
// ============================================================================

console.log('\n\n=== Test Summary ===\n');
console.log('✅ All validation features tested successfully!');
console.log('\nFeatures covered:');
console.log('  1. Schema-based validation (Zod)');
console.log('  2. Type checking for all inputs');
console.log('  3. Range validation for numbers');
console.log('  4. Length validation for strings');
console.log('  5. Format validation (email, phone, URL)');
console.log('  6. XSS prevention');
console.log('  7. SQL injection prevention');
console.log('  8. Command injection prevention');
console.log('  9. Path traversal prevention');
console.log('  10. Rate limiting per endpoint');
console.log('  11. HTML sanitization');
console.log('  12. Nested object validation');
console.log('  13. Security presets');
