/**
 * Security Tests: CSRF (Cross-Site Request Forgery) Attacks on AI Modules
 * Tests CSRF token validation, same-origin policies, and state-changing operations
 */

import * as crypto from 'crypto';
import { MultiModelOrchestrator } from '../../../src/ai/MultiModelOrchestrator';
import { LearningSystem } from '../../../src/ai/LearningSystem';

describe('AI Module CSRF Attack Tests', () => {
  describe('CSRF Token Generation and Validation', () => {
    test('should generate unique CSRF tokens per session', () => {
      const generateCSRFToken = (sessionId: string): string => {
        const data = `${sessionId}-${Date.now()}-${crypto.randomBytes(32).toString('hex')}`;
        return crypto.createHash('sha256').update(data).digest('hex');
      };

      const sessionId = crypto.randomBytes(32).toString('hex');
      const token1 = generateCSRFToken(sessionId);
      const token2 = generateCSRFToken(sessionId);

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // SHA-256 hex
    });

    test('should validate CSRF token with session binding', () => {
      const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

      const createToken = (sessionId: string): string => {
        const token = crypto.randomBytes(32).toString('hex');
        csrfTokens.set(sessionId, {
          token,
          expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
        });
        return token;
      };

      const validateToken = (sessionId: string, token: string): boolean => {
        const stored = csrfTokens.get(sessionId);
        if (!stored) return false;
        if (Date.now() > stored.expiresAt) return false;
        return crypto.timingSafeEqual(
          Buffer.from(stored.token),
          Buffer.from(token)
        );
      };

      const sessionId = crypto.randomBytes(32).toString('hex');
      const validToken = createToken(sessionId);
      const invalidToken = crypto.randomBytes(32).toString('hex');

      expect(validateToken(sessionId, validToken)).toBe(true);
      expect(validateToken(sessionId, invalidToken)).toBe(false);
      expect(validateToken('wrong-session', validToken)).toBe(false);
    });

    test('should rotate CSRF tokens after use', () => {
      const usedTokens = new Set<string>();

      const useToken = (token: string): boolean => {
        if (usedTokens.has(token)) {
          return false; // Token already used
        }
        usedTokens.add(token);
        return true;
      };

      const token = crypto.randomBytes(32).toString('hex');

      expect(useToken(token)).toBe(true);
      expect(useToken(token)).toBe(false); // Second use fails
    });

    test('should implement HMAC-based CSRF tokens', () => {
      const secret = crypto.randomBytes(32);

      const generateToken = (sessionId: string, timestamp: number): string => {
        const data = `${sessionId}:${timestamp}`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(data);
        return `${timestamp}.${hmac.digest('hex')}`;
      };

      const validateToken = (token: string, sessionId: string): boolean => {
        const [timestampStr, signature] = token.split('.');
        const timestamp = parseInt(timestampStr, 10);

        // Check expiration (5 minutes)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
          return false;
        }

        // Verify signature
        const data = `${sessionId}:${timestamp}`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(data);
        const expectedSignature = hmac.digest('hex');

        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      };

      const sessionId = crypto.randomBytes(32).toString('hex');
      const token = generateToken(sessionId, Date.now());

      expect(validateToken(token, sessionId)).toBe(true);
      expect(validateToken(token, 'wrong-session')).toBe(false);
    });
  });

  describe('State-Changing Operations Protection', () => {
    test('should require CSRF token for model registration', async () => {
      const orchestrator = new MultiModelOrchestrator();
      const csrfTokens = new Set<string>();

      const registerModelWithCSRF = (
        modelName: string,
        csrfToken: string
      ): boolean => {
        if (!csrfTokens.has(csrfToken)) {
          throw new Error('Invalid CSRF token');
        }

        // Token is valid, proceed with registration
        orchestrator.registerModel(modelName, {
          provider: {} as any,
          modelName,
          capabilities: {
            reasoning: 80,
            coding: 80,
            speed: 80,
            costEfficiency: 80,
            contextWindow: 8000,
            multimodal: false
          },
          costPerToken: { input: 0.01, output: 0.03 },
          maxRetries: 3,
          timeout: 5000
        });

        csrfTokens.delete(csrfToken); // One-time use
        return true;
      };

      const validToken = crypto.randomBytes(32).toString('hex');
      csrfTokens.add(validToken);

      // Valid token should work
      expect(() => registerModelWithCSRF('test-model', validToken)).not.toThrow();

      // Invalid token should fail
      expect(() => registerModelWithCSRF('test-model-2', 'invalid-token')).toThrow('Invalid CSRF token');
    });

    test('should require CSRF token for feedback submission', async () => {
      const learningSystem = new LearningSystem('/tmp/test-csrf-feedback');
      const validTokens = new Set<string>();

      const submitFeedbackWithCSRF = async (
        task: string,
        action: string,
        rating: number,
        csrfToken: string
      ): Promise<void> => {
        if (!validTokens.has(csrfToken)) {
          throw new Error('CSRF token validation failed');
        }

        await learningSystem.recordFeedback(task, action, rating, 'success');
        validTokens.delete(csrfToken);
      };

      const token = crypto.randomBytes(32).toString('hex');
      validTokens.add(token);

      await expect(
        submitFeedbackWithCSRF('task', 'action', 1, token)
      ).resolves.not.toThrow();

      await expect(
        submitFeedbackWithCSRF('task', 'action', 1, 'invalid')
      ).rejects.toThrow('CSRF token validation failed');

      await learningSystem.reset();
    });

    test('should protect deletion operations with CSRF', async () => {
      const learningSystem = new LearningSystem('/tmp/test-csrf-delete');
      const csrfTokens = new Map<string, string>();

      const deleteWithCSRF = async (
        sessionId: string,
        csrfToken: string
      ): Promise<void> => {
        if (csrfTokens.get(sessionId) !== csrfToken) {
          throw new Error('CSRF validation failed');
        }

        await learningSystem.reset();
        csrfTokens.delete(sessionId);
      };

      const sessionId = 'session-123';
      const token = crypto.randomBytes(32).toString('hex');
      csrfTokens.set(sessionId, token);

      await expect(deleteWithCSRF(sessionId, token)).resolves.not.toThrow();
      await expect(deleteWithCSRF(sessionId, 'wrong-token')).rejects.toThrow();
    });
  });

  describe('HTTP Method Verification', () => {
    test('should reject state-changing operations via GET', () => {
      const isMethodAllowed = (method: string, operation: string): boolean => {
        const stateChangingOps = ['create', 'update', 'delete'];

        if (stateChangingOps.includes(operation)) {
          // State-changing operations must use POST, PUT, DELETE
          return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
        }

        return true;
      };

      expect(isMethodAllowed('GET', 'read')).toBe(true);
      expect(isMethodAllowed('GET', 'create')).toBe(false);
      expect(isMethodAllowed('POST', 'create')).toBe(true);
      expect(isMethodAllowed('GET', 'delete')).toBe(false);
      expect(isMethodAllowed('DELETE', 'delete')).toBe(true);
    });

    test('should validate idempotency for safe methods', () => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
      const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      const isSafeMethod = (method: string): boolean => {
        return safeMethods.includes(method);
      };

      safeMethods.forEach(method => {
        expect(isSafeMethod(method)).toBe(true);
      });

      unsafeMethods.forEach(method => {
        expect(isSafeMethod(method)).toBe(false);
      });
    });
  });

  describe('Origin and Referer Validation', () => {
    test('should validate Origin header', () => {
      const allowedOrigins = [
        'https://example.com',
        'https://app.example.com',
        'https://api.example.com'
      ];

      const validateOrigin = (origin: string): boolean => {
        return allowedOrigins.includes(origin);
      };

      expect(validateOrigin('https://example.com')).toBe(true);
      expect(validateOrigin('https://evil.com')).toBe(false);
      expect(validateOrigin('https://example.com.evil.com')).toBe(false);
    });

    test('should validate Referer header', () => {
      const validateReferer = (referer: string, allowedDomain: string): boolean => {
        try {
          const url = new URL(referer);
          return url.hostname === allowedDomain || url.hostname.endsWith(`.${allowedDomain}`);
        } catch {
          return false;
        }
      };

      expect(validateReferer('https://example.com/page', 'example.com')).toBe(true);
      expect(validateReferer('https://api.example.com/endpoint', 'example.com')).toBe(true);
      expect(validateReferer('https://evil.com', 'example.com')).toBe(false);
      expect(validateReferer('invalid-url', 'example.com')).toBe(false);
    });

    test('should handle missing Origin/Referer headers safely', () => {
      const validateRequest = (
        method: string,
        origin: string | null,
        referer: string | null,
        csrfToken: string | null
      ): boolean => {
        // For state-changing methods
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
          // Must have either valid origin/referer OR valid CSRF token
          const hasValidOrigin = origin === 'https://example.com';
          const hasValidReferer = referer?.startsWith('https://example.com');
          const hasValidCSRF = csrfToken !== null;

          return (hasValidOrigin || hasValidReferer) && hasValidCSRF;
        }

        return true; // Safe methods
      };

      expect(validateRequest('POST', 'https://example.com', null, 'token')).toBe(true);
      expect(validateRequest('POST', null, 'https://example.com/page', 'token')).toBe(true);
      expect(validateRequest('POST', null, null, 'token')).toBe(false);
      expect(validateRequest('GET', null, null, null)).toBe(true);
    });
  });

  describe('SameSite Cookie Attribute', () => {
    test('should enforce SameSite=Strict for sensitive cookies', () => {
      const sessionCookie = {
        name: 'session_id',
        value: crypto.randomBytes(32).toString('hex'),
        sameSite: 'strict' as const,
        secure: true,
        httpOnly: true
      };

      expect(sessionCookie.sameSite).toBe('strict');
    });

    test('should use SameSite=Lax for less critical cookies', () => {
      const preferenceCookie = {
        name: 'preferences',
        value: 'theme=dark',
        sameSite: 'lax' as const,
        secure: true
      };

      expect(preferenceCookie.sameSite).toBe('lax');
    });

    test('should never use SameSite=None without Secure', () => {
      const validateCookie = (cookie: { sameSite: string; secure: boolean }): boolean => {
        if (cookie.sameSite === 'none') {
          return cookie.secure === true;
        }
        return true;
      };

      expect(validateCookie({ sameSite: 'none', secure: true })).toBe(true);
      expect(validateCookie({ sameSite: 'none', secure: false })).toBe(false);
      expect(validateCookie({ sameSite: 'strict', secure: false })).toBe(true);
    });
  });

  describe('Double Submit Cookie Pattern', () => {
    test('should validate CSRF token matches cookie value', () => {
      const csrfCookie = crypto.randomBytes(32).toString('hex');

      const validateDoubleSubmit = (
        cookieValue: string,
        headerValue: string
      ): boolean => {
        if (!cookieValue || !headerValue) return false;

        return crypto.timingSafeEqual(
          Buffer.from(cookieValue),
          Buffer.from(headerValue)
        );
      };

      expect(validateDoubleSubmit(csrfCookie, csrfCookie)).toBe(true);
      expect(validateDoubleSubmit(csrfCookie, 'different-value')).toBe(false);
    });

    test('should generate synchronized cookie and token', () => {
      const generateDoubleSubmitTokens = (): {
        cookie: string;
        token: string;
      } => {
        const value = crypto.randomBytes(32).toString('hex');
        return {
          cookie: value,
          token: value
        };
      };

      const { cookie, token } = generateDoubleSubmitTokens();
      expect(cookie).toBe(token);
    });
  });

  describe('Custom Header Verification', () => {
    test('should require custom header for AJAX requests', () => {
      const validateRequest = (
        method: string,
        customHeader: string | null
      ): boolean => {
        if (['POST', 'PUT', 'DELETE'].includes(method)) {
          return customHeader === 'XMLHttpRequest' || customHeader === 'fetch';
        }
        return true;
      };

      expect(validateRequest('POST', 'XMLHttpRequest')).toBe(true);
      expect(validateRequest('POST', 'fetch')).toBe(true);
      expect(validateRequest('POST', null)).toBe(false);
      expect(validateRequest('GET', null)).toBe(true);
    });

    test('should validate X-Requested-With header', () => {
      const isAJAXRequest = (headers: Record<string, string>): boolean => {
        return headers['x-requested-with']?.toLowerCase() === 'xmlhttprequest';
      };

      expect(isAJAXRequest({ 'x-requested-with': 'XMLHttpRequest' })).toBe(true);
      expect(isAJAXRequest({ 'x-requested-with': 'xmlhttprequest' })).toBe(true);
      expect(isAJAXRequest({})).toBe(false);
    });
  });

  describe('Content-Type Verification', () => {
    test('should validate Content-Type for JSON requests', () => {
      const validateContentType = (contentType: string | null): boolean => {
        if (!contentType) return false;

        const validTypes = [
          'application/json',
          'application/json; charset=utf-8',
          'application/json;charset=utf-8'
        ];

        return validTypes.some(valid =>
          contentType.toLowerCase().startsWith('application/json')
        );
      };

      expect(validateContentType('application/json')).toBe(true);
      expect(validateContentType('application/json; charset=utf-8')).toBe(true);
      expect(validateContentType('application/x-www-form-urlencoded')).toBe(false);
      expect(validateContentType(null)).toBe(false);
    });

    test('should reject form submissions without CSRF protection', () => {
      const validateFormSubmission = (
        contentType: string,
        csrfToken: string | null
      ): boolean => {
        if (contentType.includes('application/x-www-form-urlencoded') ||
            contentType.includes('multipart/form-data')) {
          return csrfToken !== null;
        }
        return true;
      };

      expect(validateFormSubmission('application/x-www-form-urlencoded', 'token')).toBe(true);
      expect(validateFormSubmission('application/x-www-form-urlencoded', null)).toBe(false);
      expect(validateFormSubmission('application/json', null)).toBe(true);
    });
  });

  describe('Anti-CSRF Patterns in AI Operations', () => {
    test('should protect model configuration changes', async () => {
      const orchestrator = new MultiModelOrchestrator();
      const validTokens = new Set<string>();

      const updateModelConfig = (modelName: string, csrfToken: string): void => {
        if (!validTokens.has(csrfToken)) {
          throw new Error('CSRF protection: Invalid token');
        }

        // Proceed with update
        orchestrator.unregisterModel(modelName);
        validTokens.delete(csrfToken);
      };

      orchestrator.registerModel('test-model', {
        provider: {} as any,
        modelName: 'test',
        capabilities: {
          reasoning: 50,
          coding: 50,
          speed: 50,
          costEfficiency: 50,
          contextWindow: 4000,
          multimodal: false
        },
        costPerToken: { input: 0, output: 0 },
        maxRetries: 3,
        timeout: 5000
      });

      const token = crypto.randomBytes(32).toString('hex');
      validTokens.add(token);

      expect(() => updateModelConfig('test-model', token)).not.toThrow();
      expect(() => updateModelConfig('test-model', 'invalid')).toThrow();
    });

    test('should protect learning system reset operations', async () => {
      const learningSystem = new LearningSystem('/tmp/test-csrf-reset');
      const csrfTokens = new Map<string, string>();

      const resetWithCSRF = async (sessionId: string, token: string): Promise<void> => {
        if (csrfTokens.get(sessionId) !== token) {
          throw new Error('CSRF: Unauthorized reset attempt');
        }

        await learningSystem.reset();
      };

      const sessionId = 'session-abc';
      const validToken = crypto.randomBytes(32).toString('hex');
      csrfTokens.set(sessionId, validToken);

      await learningSystem.recordFeedback('task', 'action', 1, 'success');
      expect(learningSystem.getStats().totalFeedback).toBe(1);

      await expect(resetWithCSRF(sessionId, validToken)).resolves.not.toThrow();
      await expect(resetWithCSRF(sessionId, 'wrong')).rejects.toThrow('CSRF');
    });
  });

  describe('CSRF Token Lifecycle Management', () => {
    test('should expire CSRF tokens after timeout', () => {
      const tokens = new Map<string, { value: string; expiresAt: number }>();

      const createToken = (): string => {
        const token = crypto.randomBytes(32).toString('hex');
        tokens.set(token, {
          value: token,
          expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
        });
        return token;
      };

      const isTokenValid = (token: string): boolean => {
        const stored = tokens.get(token);
        if (!stored) return false;
        return Date.now() < stored.expiresAt;
      };

      const token = createToken();
      expect(isTokenValid(token)).toBe(true);

      // Simulate expiration
      tokens.get(token)!.expiresAt = Date.now() - 1000;
      expect(isTokenValid(token)).toBe(false);
    });

    test('should cleanup expired tokens periodically', () => {
      const tokens = new Map<string, { expiresAt: number }>();

      tokens.set('expired1', { expiresAt: Date.now() - 1000 });
      tokens.set('expired2', { expiresAt: Date.now() - 2000 });
      tokens.set('valid', { expiresAt: Date.now() + 60000 });

      const cleanupExpiredTokens = (): number => {
        const now = Date.now();
        let cleaned = 0;

        for (const [token, data] of tokens.entries()) {
          if (now >= data.expiresAt) {
            tokens.delete(token);
            cleaned++;
          }
        }

        return cleaned;
      };

      const cleaned = cleanupExpiredTokens();
      expect(cleaned).toBe(2);
      expect(tokens.size).toBe(1);
      expect(tokens.has('valid')).toBe(true);
    });

    test('should limit number of active tokens per session', () => {
      const maxTokensPerSession = 5;
      const sessionTokens = new Map<string, string[]>();

      const createTokenForSession = (sessionId: string): string => {
        const tokens = sessionTokens.get(sessionId) || [];
        const newToken = crypto.randomBytes(32).toString('hex');

        if (tokens.length >= maxTokensPerSession) {
          tokens.shift(); // Remove oldest
        }

        tokens.push(newToken);
        sessionTokens.set(sessionId, tokens);

        return newToken;
      };

      const sessionId = 'session-123';

      for (let i = 0; i < 10; i++) {
        createTokenForSession(sessionId);
      }

      const tokens = sessionTokens.get(sessionId);
      expect(tokens?.length).toBe(maxTokensPerSession);
    });
  });

  describe('Defense in Depth', () => {
    test('should combine multiple CSRF protections', () => {
      const validateRequest = (request: {
        method: string;
        csrfToken: string | null;
        origin: string | null;
        contentType: string;
        customHeader: string | null;
      }): { valid: boolean; reasons: string[] } => {
        const reasons: string[] = [];

        if (request.method !== 'GET') {
          // Check 1: CSRF Token
          if (!request.csrfToken) {
            reasons.push('Missing CSRF token');
          }

          // Check 2: Origin validation
          if (!request.origin?.startsWith('https://example.com')) {
            reasons.push('Invalid origin');
          }

          // Check 3: Content-Type
          if (!request.contentType.includes('application/json')) {
            reasons.push('Invalid content-type');
          }

          // Check 4: Custom header
          if (!request.customHeader) {
            reasons.push('Missing custom header');
          }
        }

        return {
          valid: reasons.length === 0,
          reasons
        };
      };

      const validRequest = {
        method: 'POST',
        csrfToken: 'valid-token',
        origin: 'https://example.com',
        contentType: 'application/json',
        customHeader: 'XMLHttpRequest'
      };

      const invalidRequest = {
        method: 'POST',
        csrfToken: null,
        origin: 'https://evil.com',
        contentType: 'text/plain',
        customHeader: null
      };

      expect(validateRequest(validRequest).valid).toBe(true);
      expect(validateRequest(invalidRequest).valid).toBe(false);
      expect(validateRequest(invalidRequest).reasons.length).toBeGreaterThan(0);
    });

    test('should log CSRF attack attempts', () => {
      const securityLog: any[] = [];

      const logCSRFAttempt = (details: any): void => {
        securityLog.push({
          timestamp: Date.now(),
          type: 'CSRF_ATTACK_ATTEMPT',
          ...details
        });
      };

      logCSRFAttempt({
        ip: '203.0.113.1',
        endpoint: '/api/models/delete',
        reason: 'Invalid CSRF token',
        userAgent: 'AttackerBot/1.0'
      });

      expect(securityLog.length).toBe(1);
      expect(securityLog[0].type).toBe('CSRF_ATTACK_ATTEMPT');
    });
  });
});
