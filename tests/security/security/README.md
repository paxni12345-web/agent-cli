# Security Test Suite

Comprehensive penetration testing suite for security modules covering all major attack vectors.

## Test Coverage

### 1. Injection Attacks (`injection-attacks.test.ts`)
- **SQL Injection**: Tests for SQL injection in username, email, and query fields
- **Command Injection**: Tests for OS command injection and shell metacharacter exploitation
- **XSS (Cross-Site Scripting)**: Stored, reflected, DOM-based, and mutation XSS
- **LDAP Injection**: LDAP query manipulation tests
- **XML Injection**: XXE and XML bomb attacks
- **NoSQL Injection**: MongoDB operator injection
- **Template Injection**: SSTI and expression language injection

**Key Test Cases**:
- SQL injection bypass attempts with various payloads
- Command injection using shell metacharacters
- XSS polyglot and mutation attacks
- Null byte injection prevention
- Input sanitization and validation

### 2. Authentication Bypass (`authentication-bypass.test.ts`)
- **Credential Stuffing**: Rate limiting and account lockout
- **Password Reset**: Token security and user enumeration prevention
- **Token Manipulation**: JWT tampering and "none" algorithm attacks
- **Session Hijacking**: IP/device tracking and session validation
- **Brute Force Protection**: Account lockout and exponential backoff
- **MFA Bypass**: Multi-factor authentication security
- **Username Enumeration**: Consistent error messages and timing

**Key Test Cases**:
- JWT signature validation
- Token expiration enforcement
- Password reset token reuse prevention
- Session timeout and activity tracking
- Rate limiting on failed login attempts

### 3. Authorization Violations (`authorization-violations.test.ts`)
- **Privilege Escalation**: Horizontal and vertical privilege escalation
- **RBAC Bypass**: Role-based access control enforcement
- **IDOR (Insecure Direct Object References)**: Resource access validation
- **ACL Bypass**: Access control list enforcement
- **Function-Level Access Control**: Permission checks on sensitive operations
- **Context-Based Authorization**: IP, time, and device-based restrictions
- **Multi-Tenancy**: Tenant isolation and data leakage prevention

**Key Test Cases**:
- Role manipulation attempts
- Permission inheritance validation
- Resource ownership verification
- Cross-tenant access prevention
- Mass assignment vulnerabilities

### 4. Path Traversal (`path-traversal.test.ts`)
- **Directory Traversal**: ../ and ..\ bypass attempts
- **File Inclusion**: LFI and RFI vulnerabilities
- **Symlink Attacks**: Symbolic link traversal and TOCTOU
- **Filename Manipulation**: Dangerous filename detection
- **Archive Extraction**: Zip slip and tar absolute path attacks
- **Information Disclosure**: Directory listing and backup file exposure
- **Path Canonicalization**: Path normalization and resolution

**Key Test Cases**:
- Encoded path traversal (URL, Unicode, double-encoded)
- Null byte injection in file paths
- PHP wrapper exploitation
- Double extension attacks
- System file overwrite prevention

### 5. Cryptographic Vulnerabilities (`crypto-vulnerabilities.test.ts`)
- **Weak Password Hashing**: bcrypt enforcement and salt usage
- **Weak Encryption**: Strong algorithm enforcement (AES-256-GCM)
- **Insecure Random**: Cryptographically secure RNG
- **Key Management**: Key generation, rotation, and storage
- **Certificate/TLS**: Certificate validation and cipher suite enforcement
- **JWT Security**: Algorithm validation and token security
- **Side-Channel Attacks**: Timing attack prevention
- **Data At Rest**: Encryption and tamper detection

**Key Test Cases**:
- MD5/SHA1 rejection
- ECB mode prevention
- IV reuse detection
- "none" algorithm rejection in JWT
- Constant-time comparison for secrets
- Authenticated encryption (GCM) enforcement

### 6. Session Hijacking (`session-hijacking.test.ts`)
- **Session Fixation**: Session ID regeneration on login
- **XSS Theft**: HttpOnly and Secure cookie flags
- **Network Sniffing**: IP and User-Agent tracking
- **Session Timeout**: Inactivity and absolute timeouts
- **Concurrent Sessions**: Multi-device session management
- **Device Fingerprinting**: Device identification and change detection
- **Session Storage**: Secure backend storage (Redis)
- **Hijacking Detection**: Suspicious activity logging and alerting

**Key Test Cases**:
- Unpredictable session ID generation
- Token blacklisting after logout
- Session invalidation on password change
- IP address change detection
- Rapid session creation detection

### 7. CSRF Attacks (`csrf-attacks.test.ts`)
- **Token Generation**: Unique, cryptographically secure tokens
- **Token Validation**: Session binding and expiration
- **Double Submit Cookie**: Cookie and header matching
- **SameSite Attribute**: Cookie security configuration
- **Origin/Referer Validation**: Cross-origin request detection
- **State-Changing Operations**: POST/PUT/DELETE protection
- **Custom Headers**: X-Requested-With validation
- **Content-Type Validation**: JSON vs form submission

**Key Test Cases**:
- CSRF token uniqueness per session
- Token expiration and refresh
- SameSite=Strict enforcement
- Origin header validation
- Protection on password change and account deletion

### 8. Rate Limiting Bypass (`rate-limiting-bypass.test.ts`)
- **Basic Rate Limiting**: Per-minute, per-hour, per-day limits
- **IP-Based Limiting**: IP address tracking and enforcement
- **User-Based Limiting**: Per-user account limits
- **Token Bucket Algorithm**: Burst handling and token refill
- **IP Rotation Bypass**: Distributed attack detection
- **Header Manipulation**: X-Forwarded-For validation
- **Session Manipulation**: Rate limiting across session changes
- **Cost-Based Limiting**: Token and cost quota enforcement

**Key Test Cases**:
- Rate limit enforcement per time window
- Retry-after header generation
- Distributed attack detection from multiple IPs
- IPv6 address rotation detection
- Timing attack prevention
- Quota status reporting

## Running the Tests

### Run All Security Tests
```bash
npm test tests/security/security/
```

### Run Specific Test Suite
```bash
# Injection attacks
npm test tests/security/security/injection-attacks.test.ts

# Authentication bypass
npm test tests/security/security/authentication-bypass.test.ts

# Authorization violations
npm test tests/security/security/authorization-violations.test.ts

# Path traversal
npm test tests/security/security/path-traversal.test.ts

# Crypto vulnerabilities
npm test tests/security/security/crypto-vulnerabilities.test.ts

# Session hijacking
npm test tests/security/security/session-hijacking.test.ts

# CSRF attacks
npm test tests/security/security/csrf-attacks.test.ts

# Rate limiting
npm test tests/security/security/rate-limiting-bypass.test.ts
```

### Run with Coverage
```bash
npm run test:coverage
```

## Test Environment

### Prerequisites
- Node.js 18+
- Redis server running on localhost:6379
- TypeScript and Jest configured

### Dependencies
- `@types/jest`: Testing framework types
- `bcrypt`: Password hashing
- `jsonwebtoken`: JWT token handling
- `ioredis`: Redis client for session storage
- `xss`: XSS sanitization library

## Penetration Testing Techniques Used

### 1. **Fuzzing**
- Automated testing with various malicious payloads
- Boundary value analysis
- Invalid input generation

### 2. **Payload Libraries**
- OWASP Top 10 attack vectors
- Common exploitation patterns
- Real-world attack scenarios

### 3. **Security Assertions**
- Input validation verification
- Output encoding checks
- Security header validation
- Error message analysis

### 4. **Timing Analysis**
- Constant-time operation verification
- User enumeration prevention
- Side-channel attack detection

### 5. **State Testing**
- Session state manipulation
- Race condition testing
- TOCTOU vulnerability detection

## Security Standards Compliance

These tests verify compliance with:
- **OWASP Top 10 2021**
- **OWASP ASVS (Application Security Verification Standard)**
- **CWE Top 25** (Common Weakness Enumeration)
- **NIST Cybersecurity Framework**
- **PCI DSS** (Payment Card Industry Data Security Standard)

## Expected Test Results

All tests should **PASS** in a secure implementation. Failed tests indicate:
- Security vulnerabilities that need immediate attention
- Missing security controls
- Improper input validation
- Weak cryptographic implementations
- Insufficient access controls

## Continuous Security Testing

### Integration with CI/CD
```yaml
# Example GitHub Actions workflow
name: Security Tests
on: [push, pull_request]
jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Start Redis
        run: docker run -d -p 6379:6379 redis
      - name: Install dependencies
        run: npm ci
      - name: Run security tests
        run: npm test tests/security/security/
```

### Pre-commit Hooks
```bash
# Install pre-commit hook
npm install husky --save-dev
npx husky add .husky/pre-commit "npm test tests/security/security/"
```

## Reporting Security Issues

If tests reveal vulnerabilities:
1. **Document the vulnerability** with test case reference
2. **Assess severity** using CVSS scoring
3. **Create remediation plan** with timeline
4. **Implement fixes** and verify with tests
5. **Retest thoroughly** before deployment

## Test Maintenance

### Regular Updates
- Update payload libraries quarterly
- Review new CVEs and attack techniques
- Add tests for emerging threats
- Maintain compatibility with security modules

### Performance Considerations
- Tests should complete within 5 minutes
- Use test data isolation
- Clean up resources after each test
- Mock external dependencies where appropriate

## Additional Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Special Publications](https://csrc.nist.gov/publications)

## Contributing

When adding new security tests:
1. Follow the existing test structure
2. Include detailed test descriptions
3. Reference CVE or CWE numbers where applicable
4. Add both positive and negative test cases
5. Document expected behavior
6. Update this README with new coverage

## License

These security tests are part of the agent-cli project and follow the same license terms.
