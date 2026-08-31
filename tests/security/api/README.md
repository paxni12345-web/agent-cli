/**
 * Security Test Suite - README
 * Comprehensive security testing guide for API modules
 */

# API Security Test Suite

This directory contains comprehensive security tests for API modules using penetration testing techniques.

## Test Coverage

### 1. Injection Attacks (`injection-attacks.test.ts`)
- **SQL Injection**: Tests for SQL injection in query parameters, POST bodies, and nested objects
- **Command Injection**: Tests for shell command injection and metacharacter sanitization
- **XSS (Cross-Site Scripting)**: Tests for script injection, event handlers, and HTML sanitization
- **Path Traversal**: Tests for directory traversal and file access vulnerabilities
- **LDAP Injection**: Tests for LDAP query injection
- **XML/XXE Injection**: Tests for XML External Entity attacks
- **NoSQL Injection**: Tests for MongoDB operator injection
- **Template Injection**: Tests for template expression injection

### 2. Authentication Bypass (`authentication-bypass.test.ts`)
- **Missing Authentication**: Tests for requests without tokens
- **Invalid Token Format**: Tests for malformed JWT and bearer tokens
- **Token Manipulation**: Tests for tampered tokens and "none" algorithm
- **Session Validation**: Tests for revoked sessions and suspended accounts
- **Header Injection**: Tests for authentication header manipulation
- **Replay Attacks**: Tests for token reuse after logout
- **Privilege Escalation**: Tests for role modification in token claims
- **SQL Injection in Auth**: Tests for SQL injection in login endpoints
- **Timing Attacks**: Tests for consistent response times
- **Password Reset Token Bypass**: Tests for misuse of reset tokens
- **MFA Bypass**: Tests for multi-factor authentication enforcement

### 3. Authorization Violations (`authorization-violations.test.ts`)
- **Horizontal Privilege Escalation**: Tests for accessing other users' data (IDOR)
- **Vertical Privilege Escalation**: Tests for accessing higher-privilege endpoints
- **Missing Authorization Checks**: Tests for endpoints without proper authorization
- **Path Traversal in Authorization**: Tests for path manipulation to bypass checks
- **Mass Assignment**: Tests for updating restricted fields
- **Context-Based Authorization**: Tests for IP-based and time-based restrictions
- **Batch Operations**: Tests for authorization on each batch item
- **Field-Level Authorization**: Tests for GraphQL field permissions

### 4. Rate Limiting & CSRF (`rate-limiting-csrf.test.ts`)
- **Rate Limit Bypass**: Tests for IP rotation and header manipulation
- **Token Bucket Strategy**: Tests for burst protection
- **Distributed Rate Limiting**: Tests for consistent enforcement
- **CSRF Token Validation**: Tests for missing and invalid tokens
- **Origin/Referer Checks**: Tests for cross-origin request validation
- **Double-Submit Cookie Pattern**: Tests for cookie-header matching
- **Session Hijacking**: Tests for IP and user agent changes
- **Session Timeout**: Tests for expired session handling
- **Session Fixation**: Tests for session ID regeneration
- **DDoS Protection**: Tests for aggressive rate limiting under load

### 5. Cryptography Vulnerabilities (`crypto-vulnerabilities.test.ts`)
- **Weak Password Hashing**: Tests for MD5, SHA1, and insufficient iterations
- **Weak Encryption**: Tests for DES, ECB mode, and missing authentication
- **Insecure Random Numbers**: Tests for Math.random() vs crypto.randomBytes
- **SSL/TLS Configuration**: Tests for HTTPS enforcement and secure cookies
- **Key Management**: Tests for key exposure and rotation
- **JWT Security**: Tests for unsigned tokens and weak algorithms
- **Padding Oracle Attacks**: Tests for encryption tampering detection
- **Timing Attacks**: Tests for constant-time comparisons
- **Certificate Validation**: Tests for certificate chain and expiration

## Running the Tests

### Run all security tests:
```bash
npm test tests/security/api/
```

### Run specific test suite:
```bash
npm test tests/security/api/injection-attacks.test.ts
npm test tests/security/api/authentication-bypass.test.ts
npm test tests/security/api/authorization-violations.test.ts
npm test tests/security/api/rate-limiting-csrf.test.ts
npm test tests/security/api/crypto-vulnerabilities.test.ts
```

### Run with coverage:
```bash
npm run test:coverage -- tests/security/api/
```

## Test Methodology

These tests follow penetration testing best practices:

1. **Black Box Testing**: Tests interact with APIs as an external attacker would
2. **Fuzzing**: Multiple malicious payloads are tested for each vulnerability
3. **Boundary Testing**: Edge cases and limits are tested thoroughly
4. **Negative Testing**: Focus on what should be rejected/blocked
5. **Attack Simulation**: Real-world attack patterns are replicated

## Security Test Categories

### OWASP Top 10 Coverage
- ✅ A01:2021 - Broken Access Control (Authorization tests)
- ✅ A02:2021 - Cryptographic Failures (Crypto tests)
- ✅ A03:2021 - Injection (Injection tests)
- ✅ A05:2021 - Security Misconfiguration (All tests)
- ✅ A07:2021 - Identification and Authentication Failures (Auth tests)
- ✅ A08:2021 - Software and Data Integrity Failures (Crypto tests)

### SANS Top 25 Coverage
- ✅ CWE-79: Cross-site Scripting (XSS)
- ✅ CWE-89: SQL Injection
- ✅ CWE-78: OS Command Injection
- ✅ CWE-22: Path Traversal
- ✅ CWE-287: Improper Authentication
- ✅ CWE-352: CSRF
- ✅ CWE-306: Missing Authentication
- ✅ CWE-862: Missing Authorization
- ✅ CWE-798: Use of Hard-coded Credentials
- ✅ CWE-330: Insufficient Randomness

## Expected Results

All tests should **PASS**, meaning:
- Attacks are properly **blocked**
- Invalid input is **rejected**
- Security headers are **present**
- Sensitive data is **protected**
- Audit logs are **created**

**If tests fail**: This indicates a security vulnerability that must be fixed immediately.

## Adding New Tests

When adding new security tests:

1. **Identify the threat**: What attack are you testing?
2. **Create attack vectors**: Multiple variations of the attack
3. **Test both positive and negative**: Valid and invalid cases
4. **Check logging**: Ensure attacks are logged
5. **Document findings**: Add comments explaining the vulnerability

### Example Template:
```typescript
describe('New Security Test', () => {
  it('should block [specific attack]', async () => {
    // Arrange: Setup malicious payload
    const maliciousPayload = '...';
    
    // Act: Execute attack
    const response = await gateway.handleRequest({
      // ... request details
    });
    
    // Assert: Attack is blocked
    expect(response.statusCode).toBe(403); // or 400, 401
    expect(response.body.error).toContain('blocked');
  });
});
```

## Security Best Practices Tested

- ✅ Input validation and sanitization
- ✅ Output encoding
- ✅ Parameterized queries (SQL injection prevention)
- ✅ Strong authentication mechanisms
- ✅ Proper authorization checks
- ✅ Secure session management
- ✅ Rate limiting and throttling
- ✅ CSRF token validation
- ✅ Secure cryptographic operations
- ✅ TLS/SSL enforcement
- ✅ Security headers (CSP, HSTS, X-Frame-Options, etc.)
- ✅ Audit logging
- ✅ Error handling (no information leakage)

## Continuous Security Testing

These tests should be:
- Run on every commit (CI/CD pipeline)
- Run before every deployment
- Included in code review checklist
- Updated when new vulnerabilities are discovered
- Expanded when new features are added

## Reporting Security Issues

If a test reveals a vulnerability:

1. **Do not commit the vulnerable code**
2. **Fix the vulnerability immediately**
3. **Add a test to prevent regression**
4. **Document the fix in commit message**
5. **Update security documentation**

## Additional Security Testing

Beyond these automated tests, consider:

- **Manual penetration testing**: Hire security professionals
- **Security code review**: Review code for security issues
- **Dependency scanning**: Check for vulnerable dependencies
- **Static analysis**: Use tools like Snyk, SonarQube
- **Dynamic analysis**: DAST tools like OWASP ZAP
- **Bug bounty program**: Incentivize external security research

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [SANS Top 25](https://www.sans.org/top25-software-errors/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Compliance

These tests help meet compliance requirements for:
- PCI DSS (Payment Card Industry Data Security Standard)
- HIPAA (Health Insurance Portability and Accountability Act)
- GDPR (General Data Protection Regulation)
- SOC 2 (Service Organization Control 2)
- ISO 27001 (Information Security Management)

## Contact

For security concerns or questions about these tests:
- Security Team: security@example.com
- Report vulnerabilities: security-report@example.com
