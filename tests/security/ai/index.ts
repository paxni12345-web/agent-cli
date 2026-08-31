/**
 * Security Test Suite Index for AI Modules
 * Comprehensive security testing covering all major attack vectors
 */

export { default as injectionTests } from './injection-attacks.test';
export { default as authBypassTests } from './authentication-bypass.test';
export { default as authzViolationTests } from './authorization-violations.test';
export { default as pathTraversalTests } from './path-traversal.test';
export { default as cryptoVulnTests } from './crypto-vulnerabilities.test';
export { default as sessionHijackTests } from './session-hijacking.test';
export { default as csrfTests } from './csrf-attacks.test';
export { default as rateLimitTests } from './rate-limiting-bypass.test';

/**
 * Security Test Coverage Summary:
 *
 * 1. Injection Attacks (injection-attacks.test.ts)
 *    - SQL Injection
 *    - Command Injection
 *    - XSS (Cross-Site Scripting)
 *    - Prompt Injection
 *    - NoSQL Injection
 *    - Path Traversal in Injection Context
 *
 * 2. Authentication Bypass (authentication-bypass.test.ts)
 *    - Token Manipulation
 *    - JWT Algorithm Confusion
 *    - Session Fixation
 *    - Credential Stuffing
 *    - Default Credentials
 *    - API Key Security
 *    - MFA Bypass
 *    - Privilege Escalation
 *    - Account Takeover
 *
 * 3. Authorization Violations (authorization-violations.test.ts)
 *    - Resource Access Control
 *    - Horizontal Privilege Escalation
 *    - Vertical Privilege Escalation
 *    - Context-Based Authorization
 *    - ABAC (Attribute-Based Access Control)
 *    - Rate Limiting and Throttling
 *    - Cross-Tenant Isolation
 *    - Audit Logging
 *
 * 4. Path Traversal (path-traversal.test.ts)
 *    - Directory Traversal
 *    - Null Byte Injection
 *    - URL Encoding Bypass
 *    - OS-Specific Attacks
 *    - Symbolic Link Attacks
 *    - Canonicalization Issues
 *    - TOCTOU Race Conditions
 *    - Backup File Access
 *
 * 5. Cryptographic Vulnerabilities (crypto-vulnerabilities.test.ts)
 *    - Weak Encryption Algorithms
 *    - Weak Hashing Algorithms
 *    - IV Security
 *    - Key Management
 *    - Random Number Generation
 *    - Timing Attacks
 *    - Certificate Validation
 *    - Data-at-Rest Encryption
 *    - Side-Channel Attacks
 *
 * 6. Session Hijacking (session-hijacking.test.ts)
 *    - Session Token Security
 *    - Cookie Security
 *    - Session Fixation
 *    - Session Expiration
 *    - Concurrent Session Management
 *    - Token-Based Hijacking
 *    - Session Storage Security
 *    - CSRF with Sessions
 *    - Anomaly Detection
 *
 * 7. CSRF Attacks (csrf-attacks.test.ts)
 *    - CSRF Token Generation/Validation
 *    - State-Changing Operations
 *    - HTTP Method Verification
 *    - Origin/Referer Validation
 *    - SameSite Cookie Attribute
 *    - Double Submit Cookie Pattern
 *    - Custom Header Verification
 *    - Content-Type Verification
 *
 * 8. Rate Limiting Bypass (rate-limiting-bypass.test.ts)
 *    - Basic Rate Limiting
 *    - IP-Based Bypass
 *    - User Authentication Bypass
 *    - Header Manipulation
 *    - Distributed Attack Detection
 *    - API Key Rate Limiting
 *    - AI-Specific Rate Limiting
 *    - Cost-Based Rate Limiting
 *
 * Test Execution:
 *   npm test -- tests/security/ai
 *   npm test -- tests/security/ai/injection-attacks.test.ts
 *
 * Coverage Report:
 *   npm run test:coverage -- tests/security/ai
 */
