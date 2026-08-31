/**
 * Security Test Suite Index
 * Comprehensive security tests for database modules
 */

export * from './sql-injection.test';
export * from './authentication-bypass.test';
export * from './authorization-violations.test';
export * from './command-injection.test';
export * from './crypto-vulnerabilities.test';
export * from './xss-sanitization.test';
export * from './rate-limiting.test';
export * from './session-hijacking.test';
export * from './path-traversal.test';

/**
 * Security Test Coverage Summary
 *
 * 1. SQL Injection Tests (sql-injection.test.ts)
 *    - Classic injection patterns (OR 1=1, UNION, stacked queries)
 *    - Comment-based injection
 *    - Time-based and boolean blind injection
 *    - Second-order injection
 *    - Injection through ORDER BY, table names, column names
 *    - LIKE, IN, and BETWEEN clause injection
 *    - Database-specific techniques (PostgreSQL, MySQL)
 *    - ORM-level protection
 *    - Parameter validation
 *
 * 2. Authentication Bypass Tests (authentication-bypass.test.ts)
 *    - SQL authentication bypass
 *    - Password hash bypass
 *    - Timing attacks on authentication
 *    - Session token security
 *    - Multi-factor authentication bypass
 *    - Account enumeration prevention
 *    - Privilege escalation
 *    - Default credential attacks
 *
 * 3. Authorization Violation Tests (authorization-violations.test.ts)
 *    - Insecure Direct Object References (IDOR)
 *    - Missing function-level access control
 *    - Broken access control via filters
 *    - Permission boundary violations
 *    - Cross-tenant data leakage
 *    - Mass assignment vulnerabilities
 *    - Aggregation and statistical attacks
 *    - Temporal access control
 *    - Ownership verification
 *
 * 4. Command Injection Tests (command-injection.test.ts)
 *    - PostgreSQL command injection (COPY TO PROGRAM, pg_read_file)
 *    - Backup and restore command injection
 *    - Export and import command injection
 *    - Migration command injection
 *    - Shell escape vulnerabilities
 *    - External program execution
 *    - NoSQL command injection
 *    - LDAP injection
 *    - XML External Entity (XXE) prevention
 *    - Path traversal in database operations
 *    - Template injection prevention
 *
 * 5. Cryptography Vulnerabilities Tests (crypto-vulnerabilities.test.ts)
 *    - Weak password hashing (MD5, SHA-1)
 *    - Insufficient work factors
 *    - Missing salt in hashing
 *    - Weak encryption algorithms (DES, RC4)
 *    - ECB mode vulnerabilities
 *    - Insecure random number generation
 *    - Insufficient key length
 *    - IV reuse and misuse
 *    - Insecure data storage
 *    - Certificate and TLS issues
 *    - Timing attack prevention
 *    - Key management
 *    - Hash collision attacks
 *
 * 6. XSS and Sanitization Tests (xss-sanitization.test.ts)
 *    - Stored XSS prevention
 *    - Script tag detection
 *    - Event handler injection
 *    - Encoded XSS attacks
 *    - DOM-based XSS
 *    - Content Security Policy
 *    - JSON injection
 *    - Prototype pollution
 *    - LDAP injection in search
 *    - URL validation
 *    - NoSQL injection via XSS
 *    - Input length validation
 *    - File upload validation
 *    - Regular expression DoS (ReDoS)
 *
 * 7. Rate Limiting Tests (rate-limiting.test.ts)
 *    - Per-user query rate limits
 *    - Sliding window rate limiting
 *    - Token bucket algorithm
 *    - IP-based rate limiting
 *    - Distributed rate limiting
 *    - Query complexity limits
 *    - Connection pool exhaustion
 *    - Bulk operation limits
 *    - Query timeout protection
 *    - Memory exhaustion prevention
 *    - Vector database DoS prevention
 *    - Slowloris and slow read attacks
 *
 * 8. Session Hijacking Tests (session-hijacking.test.ts)
 *    - Session token security
 *    - Session storage security
 *    - Session hijacking prevention
 *    - CSRF token protection
 *    - Cookie security (HttpOnly, Secure, SameSite)
 *    - Session fixation prevention
 *    - Logout security
 *    - Concurrent session management
 *    - Remember me security
 *
 * 9. Path Traversal Tests (path-traversal.test.ts)
 *    - Directory traversal prevention
 *    - Encoded path traversal
 *    - Null byte injection
 *    - Absolute path restrictions
 *    - Filename sanitization
 *    - Reserved filename prevention
 *    - Symbolic link attacks
 *    - Database file path storage
 *    - Archive extraction vulnerabilities (Zip Slip)
 *    - Configuration file protection
 *    - File upload path validation
 *    - URL path traversal
 *    - Windows-specific path issues
 *
 * Running the Tests:
 *
 * Run all security tests:
 *   npm test -- tests/security/database
 *
 * Run specific test suite:
 *   npm test -- tests/security/database/sql-injection.test.ts
 *
 * Run with coverage:
 *   npm run test:coverage -- tests/security/database
 *
 * Test Organization:
 *
 * Each test file follows penetration testing methodology:
 * 1. Identify attack vectors
 * 2. Test vulnerability detection
 * 3. Verify security controls
 * 4. Validate proper error handling
 * 5. Confirm defense-in-depth measures
 *
 * Best Practices Tested:
 *
 * - Input validation and sanitization
 * - Parameterized queries
 * - Prepared statements
 * - Output encoding
 * - Least privilege access
 * - Defense in depth
 * - Secure defaults
 * - Fail securely
 * - Complete mediation
 * - Separation of duties
 *
 * Security Standards Coverage:
 *
 * - OWASP Top 10 (2021)
 * - CWE/SANS Top 25
 * - NIST Cybersecurity Framework
 * - PCI DSS Requirements
 * - GDPR Security Requirements
 * - ISO 27001 Controls
 *
 * Vulnerability Categories:
 *
 * - Injection Flaws (SQL, Command, LDAP, XPath)
 * - Broken Authentication
 * - Sensitive Data Exposure
 * - XML External Entities (XXE)
 * - Broken Access Control
 * - Security Misconfiguration
 * - Cross-Site Scripting (XSS)
 * - Insecure Deserialization
 * - Using Components with Known Vulnerabilities
 * - Insufficient Logging & Monitoring
 *
 * Penetration Testing Techniques:
 *
 * - Black box testing (no source code access)
 * - White box testing (full source code review)
 * - Gray box testing (partial knowledge)
 * - Fuzz testing (malformed input)
 * - Boundary value analysis
 * - Equivalence partitioning
 * - Error guessing
 * - Exploratory testing
 *
 * Reporting:
 *
 * All tests output results in standard Jest format
 * Failed tests indicate potential security vulnerabilities
 * Each test includes descriptive messages explaining the security issue
 *
 * Continuous Security Testing:
 *
 * Integrate these tests into CI/CD pipeline:
 * 1. Run on every commit
 * 2. Fail builds on security test failures
 * 3. Track security metrics over time
 * 4. Regular security audit reviews
 * 5. Update tests for new vulnerabilities
 *
 * Compliance and Auditing:
 *
 * Test results can be used for:
 * - Security audit reports
 * - Compliance documentation (SOC 2, ISO 27001)
 * - Vulnerability assessment reports
 * - Penetration testing documentation
 * - Risk assessment processes
 */

// Re-export all test utilities
export const SecurityTestCategories = {
  INJECTION: 'Injection Attacks',
  AUTHENTICATION: 'Authentication Bypass',
  AUTHORIZATION: 'Authorization Violations',
  COMMAND_INJECTION: 'Command Injection',
  CRYPTOGRAPHY: 'Cryptography Vulnerabilities',
  XSS: 'Cross-Site Scripting',
  RATE_LIMITING: 'Rate Limiting and DoS',
  SESSION: 'Session Management',
  PATH_TRAVERSAL: 'Path Traversal'
} as const;

export const SecurityTestMetrics = {
  TOTAL_TEST_SUITES: 9,
  ESTIMATED_TEST_COUNT: 450,
  VULNERABILITY_TYPES: 50,
  ATTACK_VECTORS: 200
} as const;
