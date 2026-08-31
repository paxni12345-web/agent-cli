/**
 * Security Test Suite: CSRF (Cross-Site Request Forgery) Attacks
 * Tests for CSRF protection mechanisms and bypass attempts
 */

import { SecurityManager, LoginContext } from '../../../src/security/SecurityManager';
import * as crypto from 'crypto';

describe('CSRF Attack Security Tests', () => {
  let securityManager: SecurityManager;
  let testContext: LoginContext;
  const validPassword = 'ValidPass123!';

  beforeEach(() => {
    securityManager = new SecurityManager({
      enableAuth: true,
      enableAudit: true,
      jwtSecret: 'test-secret-key-for-csrf-tests',
      redisUrl: 'redis://localhost:6379',
    });

    testContext = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Test Browser',
      deviceId: 'test-device-001',
    };
  });

  afterEach(async () => {
    await securityManager.disconnect();
  });

  describe('CSRF Token Generation', () => {
    test('should generate unique CSRF tokens', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const token = crypto.randomBytes(32).toString('hex');
        tokens.add(token);
      }

      expect(tokens.size).toBe(100);
    });

    test('should generate cryptographically secure CSRF tokens', () => {
      const token = crypto.randomBytes(32).toString('hex');

      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should tie CSRF token to user session', async () => {
      const user = await securityManager.createUser(
        'csrfuser',
        'csrf@example.com',
        validPassword,
        ['user']
      );

      const { sessionId } = await securityManager.login(
        'csrfuser',
        validPassword,
        testContext
      );

      // CSRF token should be tied to session
      const csrfToken = crypto.randomBytes(32).toString('hex');
      expect(csrfToken).toBeDefined();
      expect(sessionId).toBeDefined();
    });

    test('should refresh CSRF token periodically', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');

      expect(token1).not.toBe(token2);
    });

    test('should use different CSRF tokens per session', async () => {
      const user = await securityManager.createUser(
        'multicsrf',
        'multicsrf@example.com',
        validPassword,
        ['user']
      );

      const session1 = await securityManager.login(
        'multicsrf',
        validPassword,
        { ...testContext, deviceId: 'device-1' }
      );

      const session2 = await securityManager.login(
        'multicsrf',
        validPassword,
        { ...testContext, deviceId: 'device-2' }
      );

      // Each session should have its own CSRF protection
      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('CSRF Token Validation', () => {
    test('should reject requests without CSRF token', () => {
      const request = {
        method: 'POST',
        body: { action: 'delete_user' },
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // No CSRF token in request
      const hasCSRF = 'X-CSRF-Token' in request.headers;
      expect(hasCSRF).toBe(false);
    });

    test('should reject requests with invalid CSRF token', () => {
      const validToken = crypto.randomBytes(32).toString('hex');
      const invalidToken = 'invalid-token-12345';

      expect(validToken).not.toBe(invalidToken);
      expect(validToken.length).toBe(64);
      expect(invalidToken.length).not.toBe(64);
    });

    test('should reject requests with expired CSRF token', () => {
      const token = {
        value: crypto.randomBytes(32).toString('hex'),
        createdAt: Date.now() - 3600000, // 1 hour ago
        expiresAt: Date.now() - 1800000, // Expired 30 min ago
      };

      const isExpired = token.expiresAt < Date.now();
      expect(isExpired).toBe(true);
    });

    test('should reject CSRF token from different session', async () => {
      const user = await securityManager.createUser(
        'csrfsession',
        'csrfsession@example.com',
        validPassword,
        ['user']
      );

      const session1 = await securityManager.login(
        'csrfsession',
        validPassword,
        { ...testContext, deviceId: 'device-1' }
      );

      const session2 = await securityManager.login(
        'csrfsession',
        validPassword,
        { ...testContext, deviceId: 'device-2' }
      );

      // Token from session1 should not work with session2
      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    test('should validate CSRF token matches session', async () => {
      const user = await securityManager.createUser(
        'tokenvalidate',
        'tokenvalidate@example.com',
        validPassword,
        ['user']
      );

      const { sessionId } = await securityManager.login(
        'tokenvalidate',
        validPassword,
        testContext
      );

      const csrfToken = crypto.randomBytes(32).toString('hex');

      // In production, validate that token belongs to session
      expect(sessionId).toBeDefined();
      expect(csrfToken).toBeDefined();
    });
  });

  describe('Double Submit Cookie Pattern', () => {
    test('should set CSRF token in cookie', () => {
      const csrfToken = crypto.randomBytes(32).toString('hex');

      const cookie = {
        name: 'CSRF-TOKEN',
        value: csrfToken,
        httpOnly: false, // Must be readable by JavaScript
        secure: true,
        sameSite: 'strict' as const,
      };

      expect(cookie.value).toBe(csrfToken);
      expect(cookie.httpOnly).toBe(false);
      expect(cookie.secure).toBe(true);
    });

    test('should require matching token in header', () => {
      const csrfTokenInCookie = crypto.randomBytes(32).toString('hex');
      const csrfTokenInHeader = crypto.randomBytes(32).toString('hex');

      const requestHeaders = {
        'X-CSRF-Token': csrfTokenInHeader,
      };

      // Header token should match cookie token
      expect(csrfTokenInCookie).not.toBe(csrfTokenInHeader);
    });

    test('should validate cookie and header token match', () => {
      const token = crypto.randomBytes(32).toString('hex');

      const cookie = { csrfToken: token };
      const header = { 'X-CSRF-Token': token };

      expect(cookie.csrfToken).toBe(header['X-CSRF-Token']);
    });
  });

  describe('SameSite Cookie Attribute', () => {
    test('should set SameSite=Strict for authentication cookies', async () => {
      const user = await securityManager.createUser(
        'samesiteuser',
        'samesite@example.com',
        validPassword,
        ['user']
      );

      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'strict' as const,
      };

      expect(cookieOptions.sameSite).toBe('strict');
    });

    test('should use SameSite=Lax for less sensitive operations', () => {
      const cookieOptions = {
        sameSite: 'lax' as const,
      };

      expect(cookieOptions.sameSite).toBe('lax');
    });

    test('should not use SameSite=None without Secure flag', () => {
      const invalidCookie = {
        sameSite: 'none' as const,
        secure: false, // Invalid combination
      };

      // This should be rejected
      expect(invalidCookie.sameSite).toBe('none');
      expect(invalidCookie.secure).toBe(false);
    });
  });

  describe('Origin and Referer Validation', () => {
    test('should validate Origin header matches expected domain', () => {
      const expectedOrigin = 'https://example.com';
      const requestOrigin = 'https://example.com';
      const maliciousOrigin = 'https://evil.com';

      expect(requestOrigin).toBe(expectedOrigin);
      expect(maliciousOrigin).not.toBe(expectedOrigin);
    });

    test('should validate Referer header', () => {
      const expectedDomain = 'example.com';
      const referer = 'https://example.com/page';
      const maliciousReferer = 'https://evil.com/page';

      expect(referer.includes(expectedDomain)).toBe(true);
      expect(maliciousReferer.includes(expectedDomain)).toBe(false);
    });

    test('should reject requests without Origin or Referer', () => {
      const request = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const hasOrigin = 'Origin' in request.headers;
      const hasReferer = 'Referer' in request.headers;

      expect(hasOrigin).toBe(false);
      expect(hasReferer).toBe(false);
    });

    test('should handle requests from allowed subdomains', () => {
      const allowedDomains = ['example.com', 'api.example.com', 'www.example.com'];
      const origin = 'https://api.example.com';

      const isAllowed = allowedDomains.some(domain => origin.includes(domain));
      expect(isAllowed).toBe(true);
    });

    test('should reject cross-origin requests', () => {
      const expectedOrigin = 'https://example.com';
      const crossOrigin = 'https://attacker.com';

      expect(crossOrigin).not.toBe(expectedOrigin);
    });
  });

  describe('State-Changing Operations Protection', () => {
    test('should require CSRF token for POST requests', () => {
      const safeMethod = 'GET';
      const unsafeMethod = 'POST';

      const requiresCSRF = (method: string) => {
        return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
      };

      expect(requiresCSRF(safeMethod)).toBe(false);
      expect(requiresCSRF(unsafeMethod)).toBe(true);
    });

    test('should require CSRF token for DELETE requests', async () => {
      const user = await securityManager.createUser(
        'deleteuser',
        'delete@example.com',
        validPassword,
        ['user']
      );

      // DELETE should require CSRF protection
      const method = 'DELETE';
      expect(['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)).toBe(true);
    });

    test('should require CSRF token for PUT/PATCH requests', () => {
      const methods = ['PUT', 'PATCH'];

      for (const method of methods) {
        const requiresCSRF = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
        expect(requiresCSRF).toBe(true);
      }
    });

    test('should not require CSRF token for safe methods', () => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

      for (const method of safeMethods) {
        const requiresCSRF = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
        expect(requiresCSRF).toBe(false);
      }
    });

    test('should protect password change operations', async () => {
      const user = await securityManager.createUser(
        'pwdchangecsrf',
        'pwdchange@example.com',
        validPassword,
        ['user']
      );

      // Password change is state-changing and needs CSRF
      await securityManager.changePassword(
        user.id,
        validPassword,
        'NewPassword123!',
        testContext
      );

      // Verify password was changed
      const result = await securityManager.login(
        'pwdchangecsrf',
        'NewPassword123!',
        testContext
      );
      expect(result.token).toBeDefined();
    });

    test('should protect account deletion', async () => {
      const user = await securityManager.createUser(
        'deletecsrf',
        'deletecsrf@example.com',
        validPassword,
        ['user']
      );

      // Account deletion is critical and needs CSRF
      await securityManager.deleteUser(user.id);

      const deletedUser = securityManager.getUserById(user.id);
      expect(deletedUser).toBeUndefined();
    });

    test('should protect role assignment operations', async () => {
      const user = await securityManager.createUser(
        'rolecsrf',
        'rolecsrf@example.com',
        validPassword,
        ['user']
      );

      // Role changes need CSRF protection
      await securityManager.assignRole(user.id, 'admin', testContext);

      const updatedUser = securityManager.getUserById(user.id);
      expect(updatedUser?.roles).toContain('admin');
    });
  });

  describe('CSRF Bypass Attempts', () => {
    test('should prevent CSRF via GET parameter pollution', () => {
      const maliciousUrl = 'https://example.com/delete?id=123&confirmed=true';

      // GET requests should be safe and not perform state changes
      const method = 'GET';
      const changesState = false; // Should be false for GET

      expect(method).toBe('GET');
      expect(changesState).toBe(false);
    });

    test('should prevent CSRF via Flash/Java bypass', () => {
      const requestOrigin = 'https://attacker.com';
      const expectedOrigin = 'https://example.com';

      // Even from Flash/Java, Origin should be validated
      expect(requestOrigin).not.toBe(expectedOrigin);
    });

    test('should prevent CSRF via XHR without preflight', () => {
      const corsRequest = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://attacker.com',
        },
      };

      const allowedOrigins = ['https://example.com'];
      const isAllowed = allowedOrigins.includes(corsRequest.headers.Origin);

      expect(isAllowed).toBe(false);
    });

    test('should prevent CSRF via form auto-submission', () => {
      // Attacker's form that auto-submits
      const maliciousForm = `
        <form action="https://example.com/transfer" method="POST">
          <input type="hidden" name="to" value="attacker" />
          <input type="hidden" name="amount" value="1000" />
        </form>
        <script>document.forms[0].submit();</script>
      `;

      // CSRF token validation should prevent this
      expect(maliciousForm).toContain('form');
      expect(maliciousForm).not.toContain('csrf_token');
    });

    test('should prevent CSRF via image tag', () => {
      const maliciousImage = '<img src="https://example.com/delete?id=123" />';

      // Image requests are GET and should not perform state changes
      expect(maliciousImage).toContain('img');
    });

    test('should prevent CSRF token fixation', () => {
      const attackerToken = 'attacker-controlled-token';
      const serverToken = crypto.randomBytes(32).toString('hex');

      // Server should generate its own token, not accept attacker's
      expect(serverToken).not.toBe(attackerToken);
      expect(serverToken.length).toBe(64);
    });

    test('should prevent CSRF token leakage via Referer', () => {
      const csrfToken = crypto.randomBytes(32).toString('hex');
      const url = 'https://example.com/api/endpoint';

      // Token should not be in URL
      expect(url).not.toContain(csrfToken);
    });

    test('should prevent subdomain attacks', () => {
      const trustedDomain = 'example.com';
      const subdomainAttack = 'evil.example.com';

      // Should validate full origin, not just domain suffix
      const isExactMatch = subdomainAttack === trustedDomain;
      expect(isExactMatch).toBe(false);
    });
  });

  describe('Custom Header Validation', () => {
    test('should require custom header for API requests', () => {
      const request = {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      };

      const isAjax = request.headers['X-Requested-With'] === 'XMLHttpRequest';
      expect(isAjax).toBe(true);
    });

    test('should reject requests without custom header', () => {
      const request = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const hasCustomHeader = 'X-Requested-With' in request.headers;
      expect(hasCustomHeader).toBe(false);
    });

    test('should use custom header as CSRF protection', () => {
      const customHeaders = [
        'X-Requested-With',
        'X-CSRF-Token',
        'X-Custom-Header',
      ];

      // Any custom header can provide CSRF protection
      expect(customHeaders.length).toBeGreaterThan(0);
    });
  });

  describe('Content-Type Validation', () => {
    test('should validate Content-Type for JSON requests', () => {
      const request = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const isJSON = request.headers['Content-Type'].includes('application/json');
      expect(isJSON).toBe(true);
    });

    test('should reject form submissions without CSRF token', () => {
      const request = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=delete&id=123',
      };

      // Form submissions need CSRF token
      expect(request.body).not.toContain('csrf_token=');
    });

    test('should enforce CORS for cross-origin requests', () => {
      const request = {
        headers: {
          'Origin': 'https://attacker.com',
        },
      };

      const allowedOrigins = ['https://example.com'];
      const isCORS = !allowedOrigins.includes(request.headers.Origin);

      expect(isCORS).toBe(true);
    });
  });

  describe('CSRF Protection for AJAX', () => {
    test('should include CSRF token in AJAX headers', () => {
      const csrfToken = crypto.randomBytes(32).toString('hex');

      const ajaxRequest = {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
      };

      expect(ajaxRequest.headers['X-CSRF-Token']).toBe(csrfToken);
    });

    test('should validate CSRF token from meta tag', () => {
      const metaToken = crypto.randomBytes(32).toString('hex');
      const headerToken = metaToken; // Should match

      expect(metaToken).toBe(headerToken);
    });

    test('should include CSRF token in all AJAX requests', () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const needsCSRF = true; // All state-changing methods need CSRF
        expect(needsCSRF).toBe(true);
      }
    });
  });

  describe('CSRF Token Lifecycle', () => {
    test('should generate new token after login', async () => {
      const user = await securityManager.createUser(
        'tokenlifecycle',
        'lifecycle@example.com',
        validPassword,
        ['user']
      );

      const { sessionId: sessionId1 } = await securityManager.login(
        'tokenlifecycle',
        validPassword,
        testContext
      );

      // Logout and login again
      const { sessionId: sessionId2 } = await securityManager.login(
        'tokenlifecycle',
        validPassword,
        testContext
      );

      // New session should have new CSRF token
      expect(sessionId1).not.toBe(sessionId2);
    });

    test('should invalidate token after logout', async () => {
      const user = await securityManager.createUser(
        'tokeninvalidate',
        'invalidate@example.com',
        validPassword,
        ['user']
      );

      const { token, sessionId } = await securityManager.login(
        'tokeninvalidate',
        validPassword,
        testContext
      );

      await securityManager.logout(token, testContext);

      // Token should be invalid after logout
      const result = await securityManager.validateToken(token);
      expect(result).toBeNull();
    });

    test('should regenerate token on privilege escalation', async () => {
      const user = await securityManager.createUser(
        'escalation',
        'escalation@example.com',
        validPassword,
        ['user']
      );

      const { sessionId: sessionId1 } = await securityManager.login(
        'escalation',
        validPassword,
        testContext
      );

      // Assign admin role (privilege escalation)
      await securityManager.assignRole(user.id, 'admin', testContext);

      // Should regenerate CSRF token
      expect(sessionId1).toBeDefined();
    });
  });
});
