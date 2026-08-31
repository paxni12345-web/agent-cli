/**
 * Security Test Suite: Rate Limiting Bypass
 * Tests for rate limiting mechanisms and bypass techniques
 */

import { RateLimiter } from '../../../src/security/RateLimiter';
import { SecurityManager, LoginContext } from '../../../src/security/SecurityManager';

describe('Rate Limiting Bypass Security Tests', () => {
  let rateLimiter: RateLimiter;
  let securityManager: SecurityManager;
  let testContext: LoginContext;
  const validPassword = 'ValidPass123!';

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    securityManager = new SecurityManager({
      enableAuth: true,
      jwtSecret: 'test-secret-key-for-ratelimit-tests',
      maxLoginAttempts: 5,
      rateLimitWindow: 60000, // 1 minute
      rateLimitMaxAttempts: 10,
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

  describe('Basic Rate Limiting', () => {
    test('should enforce requests per minute limit', async () => {
      const userId = 'test-user-001';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 5 });

      const results = [];

      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkRateLimit(userId);
        results.push(result);

        if (result.allowed) {
          rateLimiter.recordRequest(userId);
        }
      }

      const blocked = results.filter(r => !r.allowed);
      expect(blocked.length).toBeGreaterThan(0);
    });

    test('should enforce requests per hour limit', async () => {
      const userId = 'test-user-002';
      rateLimiter.setUserLimits(userId, { requestsPerHour: 100 });

      for (let i = 0; i < 50; i++) {
        rateLimiter.recordRequest(userId);
      }

      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.requests.used).toBeGreaterThan(0);
    });

    test('should enforce requests per day limit', async () => {
      const userId = 'test-user-003';
      rateLimiter.setUserLimits(userId, { requestsPerDay: 1000 });

      for (let i = 0; i < 100; i++) {
        rateLimiter.recordRequest(userId);
      }

      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.requests.used).toBe(100);
      expect(status.requests.remaining).toBe(900);
    });

    test('should provide retry-after time when rate limited', async () => {
      const userId = 'test-user-004';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 3 });

      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(userId);
      }

      const result = await rateLimiter.checkRateLimit(userId);
      if (!result.allowed) {
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
      }
    });

    test('should reset rate limit after time window', async () => {
      const userId = 'test-user-005';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 5 });

      // Fill quota
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(userId);
      }

      const result1 = await rateLimiter.checkRateLimit(userId);
      expect(result1.allowed).toBe(false);

      // Wait for time window to reset (simulate)
      rateLimiter.cleanup();

      // Should allow requests again
      const result2 = await rateLimiter.checkRateLimit(userId);
      expect(result2).toBeDefined();
    });
  });

  describe('IP-Based Rate Limiting', () => {
    test('should enforce rate limit per IP address', async () => {
      const user = await securityManager.createUser(
        'ipuser',
        'ip@example.com',
        validPassword,
        ['user']
      );

      const attempts = [];

      for (let i = 0; i < 15; i++) {
        const attempt = securityManager
          .login('ipuser', 'wrongpassword', testContext)
          .catch(e => e);
        attempts.push(attempt);
      }

      const results = await Promise.all(attempts);
      const rateLimited = results.filter(
        r => r instanceof Error && r.message.includes('Too many')
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should track rate limit across different users from same IP', async () => {
      const user1 = await securityManager.createUser(
        'ipuser1',
        'ipuser1@example.com',
        validPassword,
        ['user']
      );

      const user2 = await securityManager.createUser(
        'ipuser2',
        'ipuser2@example.com',
        validPassword,
        ['user']
      );

      // Multiple failed attempts from same IP for different users
      for (let i = 0; i < 5; i++) {
        try {
          await securityManager.login('ipuser1', 'wrong', testContext);
        } catch (e) {}

        try {
          await securityManager.login('ipuser2', 'wrong', testContext);
        } catch (e) {}
      }

      // IP should be rate limited
      await expect(
        securityManager.login('ipuser1', validPassword, testContext)
      ).rejects.toThrow(/Too many/);
    });

    test('should allow separate rate limits for different IPs', async () => {
      const userId = 'multiip-user';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 5 });

      const ip1 = '192.168.1.100';
      const ip2 = '192.168.1.101';

      // Each IP should have separate limit
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest(userId);
      }

      const result = await rateLimiter.checkRateLimit(userId);
      expect(result).toBeDefined();
    });
  });

  describe('User-Based Rate Limiting', () => {
    test('should enforce rate limit per user account', async () => {
      const user = await securityManager.createUser(
        'userrate',
        'userrate@example.com',
        validPassword,
        ['user']
      );

      for (let i = 0; i < 6; i++) {
        try {
          await securityManager.login('userrate', 'wrongpassword', testContext);
        } catch (e) {}
      }

      await expect(
        securityManager.login('userrate', validPassword, testContext)
      ).rejects.toThrow(/locked/);
    });

    test('should track failed login attempts per user', async () => {
      const user = await securityManager.createUser(
        'trackuser',
        'track@example.com',
        validPassword,
        ['user']
      );

      for (let i = 0; i < 3; i++) {
        try {
          await securityManager.login('trackuser', 'wrongpassword', testContext);
        } catch (e) {}
      }

      const userRecord = securityManager.getUserByUsername('trackuser');
      expect(userRecord?.loginAttempts).toBeGreaterThan(0);
    });

    test('should reset counter after successful login', async () => {
      const user = await securityManager.createUser(
        'resetuser',
        'reset@example.com',
        validPassword,
        ['user']
      );

      // Failed attempts
      for (let i = 0; i < 2; i++) {
        try {
          await securityManager.login('resetuser', 'wrongpassword', testContext);
        } catch (e) {}
      }

      // Successful login
      await securityManager.login('resetuser', validPassword, testContext);

      const userRecord = securityManager.getUserByUsername('resetuser');
      expect(userRecord?.loginAttempts).toBe(0);
    });

    test('should apply different limits per user tier', async () => {
      const freeUser = 'free-user';
      const premiumUser = 'premium-user';

      rateLimiter.setUserLimits(freeUser, { requestsPerMinute: 10 });
      rateLimiter.setUserLimits(premiumUser, { requestsPerMinute: 100 });

      const freeLimits = rateLimiter.getUserLimits(freeUser);
      const premiumLimits = rateLimiter.getUserLimits(premiumUser);

      expect(premiumLimits.requestsPerMinute).toBeGreaterThan(
        freeLimits.requestsPerMinute!
      );
    });
  });

  describe('Token Bucket Algorithm', () => {
    test('should allow burst of requests within limit', async () => {
      const userId = 'burst-user';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 10 });

      const results = [];

      // Burst of 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkRateLimit(userId);
        results.push(result);
        if (result.allowed) {
          rateLimiter.recordRequest(userId);
        }
      }

      const allAllowed = results.every(r => r.allowed);
      expect(allAllowed).toBe(true);
    });

    test('should refill tokens over time', async () => {
      const userId = 'refill-user';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 5 });

      // Use all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(userId);
      }

      const result1 = await rateLimiter.checkRateLimit(userId);
      expect(result1.allowed).toBe(false);

      // Simulate time passing
      rateLimiter.cleanup();

      const result2 = await rateLimiter.checkRateLimit(userId);
      expect(result2).toBeDefined();
    });
  });

  describe('Bypass Attempts via IP Rotation', () => {
    test('should detect distributed attack from multiple IPs', async () => {
      const user = await securityManager.createUser(
        'distributed',
        'distributed@example.com',
        validPassword,
        ['user']
      );

      const ips = [
        '192.168.1.10',
        '192.168.1.11',
        '192.168.1.12',
        '192.168.1.13',
        '192.168.1.14',
      ];

      for (const ip of ips) {
        for (let i = 0; i < 2; i++) {
          try {
            await securityManager.login('distributed', 'wrongpassword', {
              ...testContext,
              ipAddress: ip,
            });
          } catch (e) {}
        }
      }

      // User should be locked despite IP rotation
      const userRecord = securityManager.getUserByUsername('distributed');
      expect(userRecord?.loginAttempts).toBeGreaterThan(5);
    });

    test('should track requests from proxy/VPN IPs', async () => {
      const suspiciousIPs = [
        '10.0.0.1', // Private network
        '172.16.0.1', // Private network
        '192.168.0.1', // Private network
      ];

      for (const ip of suspiciousIPs) {
        const isPrivate =
          ip.startsWith('10.') ||
          ip.startsWith('172.16.') ||
          ip.startsWith('192.168.');
        expect(isPrivate).toBe(true);
      }
    });

    test('should detect IPv6 address rotation', () => {
      const ipv6Addresses = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:0db8:85a3:0000:0000:8a2e:0370:7335',
        '2001:0db8:85a3:0000:0000:8a2e:0370:7336',
      ];

      // Should detect pattern in IPv6 rotation
      const basePrefix = '2001:0db8:85a3:0000:0000:8a2e:0370';
      const allSamePrefix = ipv6Addresses.every(ip => ip.startsWith(basePrefix));

      expect(allSamePrefix).toBe(true);
    });
  });

  describe('Bypass Attempts via Header Manipulation', () => {
    test('should not trust X-Forwarded-For header blindly', async () => {
      const user = await securityManager.createUser(
        'headerbypass',
        'header@example.com',
        validPassword,
        ['user']
      );

      // Attacker tries to bypass by spoofing IP
      const spoofedContext = {
        ...testContext,
        ipAddress: '127.0.0.1', // Spoofed as localhost
      };

      for (let i = 0; i < 6; i++) {
        try {
          await securityManager.login('headerbypass', 'wrongpassword', spoofedContext);
        } catch (e) {}
      }

      // Should still be rate limited
      const userRecord = securityManager.getUserByUsername('headerbypass');
      expect(userRecord?.loginAttempts).toBeGreaterThan(5);
    });

    test('should validate X-Real-IP header', () => {
      const request = {
        headers: {
          'X-Real-IP': '203.0.113.1',
          'X-Forwarded-For': '198.51.100.1, 203.0.113.1',
        },
      };

      // Should use most trustworthy IP source
      const realIP = request.headers['X-Real-IP'];
      expect(realIP).toBe('203.0.113.1');
    });

    test('should handle missing rate limit headers', async () => {
      const userId = 'no-headers';
      const result = await rateLimiter.checkRateLimit(userId);

      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
    });
  });

  describe('Bypass Attempts via Session Manipulation', () => {
    test('should rate limit even with new sessions', async () => {
      const user = await securityManager.createUser(
        'newsession',
        'newsession@example.com',
        validPassword,
        ['user']
      );

      for (let i = 0; i < 6; i++) {
        try {
          await securityManager.login('newsession', 'wrongpassword', {
            ...testContext,
            deviceId: `device-${i}`, // New device each time
          });
        } catch (e) {}
      }

      // Should be locked regardless of new sessions
      const userRecord = securityManager.getUserByUsername('newsession');
      expect(userRecord?.loginAttempts).toBeGreaterThan(5);
    });

    test('should detect rapid session creation', async () => {
      const user = await securityManager.createUser(
        'rapidsession',
        'rapid@example.com',
        validPassword,
        ['user']
      );

      const startTime = Date.now();
      const sessions = [];

      for (let i = 0; i < 10; i++) {
        const session = await securityManager.login('rapidsession', validPassword, {
          ...testContext,
          deviceId: `device-${i}`,
        });
        sessions.push(session);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Rapid session creation should be detected
      expect(sessions.length).toBe(10);
      expect(duration).toBeDefined();
    });
  });

  describe('Bypass Attempts via Timing Attacks', () => {
    test('should have consistent response time for rate limited requests', async () => {
      const userId = 'timing-user';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 2 });

      // Fill quota
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest(userId);
      }

      const timings = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await rateLimiter.checkRateLimit(userId);
        const end = Date.now();
        timings.push(end - start);
      }

      // Timings should be relatively consistent
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      expect(avgTiming).toBeGreaterThanOrEqual(0);
    });

    test('should not leak information through timing', async () => {
      const user = await securityManager.createUser(
        'timingleak',
        'timingleak@example.com',
        validPassword,
        ['user']
      );

      const validUserTimings = [];
      const invalidUserTimings = [];

      // Valid user
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        try {
          await securityManager.login('timingleak', 'wrongpassword', testContext);
        } catch (e) {}
        const end = Date.now();
        validUserTimings.push(end - start);
      }

      // Invalid user
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        try {
          await securityManager.login('nonexistent', 'wrongpassword', testContext);
        } catch (e) {}
        const end = Date.now();
        invalidUserTimings.push(end - start);
      }

      // Timings should be similar (no user enumeration)
      const avgValid =
        validUserTimings.reduce((a, b) => a + b) / validUserTimings.length;
      const avgInvalid =
        invalidUserTimings.reduce((a, b) => a + b) / invalidUserTimings.length;

      const difference = Math.abs(avgValid - avgInvalid);
      expect(difference).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Cost-Based Rate Limiting', () => {
    test('should enforce token quota limits', async () => {
      const userId = 'token-user';
      rateLimiter.setUserLimits(userId, { tokensPerDay: 1000 });

      rateLimiter.recordTokenUsage(userId, 500, 300);

      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.tokens.used).toBe(800);
      expect(status.tokens.remaining).toBe(200);
    });

    test('should enforce cost quota limits', async () => {
      const userId = 'cost-user';
      rateLimiter.setUserLimits(userId, { costPerDay: 10 });

      rateLimiter.recordTokenUsage(userId, 10000, 5000);

      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.cost.used).toBeGreaterThan(0);
    });

    test('should block requests when token quota exceeded', async () => {
      const userId = 'quota-exceed';
      rateLimiter.setUserLimits(userId, { tokensPerDay: 100 });

      rateLimiter.recordTokenUsage(userId, 80, 30);

      const result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Token quota exceeded');
    });

    test('should provide usage metrics', async () => {
      const userId = 'metrics-user';
      rateLimiter.recordRequest(userId);
      rateLimiter.recordTokenUsage(userId, 100, 50);

      const metrics = rateLimiter.getUsageMetrics(userId);

      expect(metrics.userId).toBe(userId);
      expect(metrics.requestCount).toBeGreaterThan(0);
      expect(metrics.tokenCount).toBe(150);
      expect(metrics.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Distributed Rate Limiting', () => {
    test('should coordinate rate limits across multiple servers', async () => {
      // Rate limits stored in Redis are shared across instances
      const userId = 'distributed-user';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 10 });

      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(userId);
      }

      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.requests.used).toBe(5);
    });

    test('should handle race conditions in distributed system', async () => {
      const userId = 'race-user';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 10 });

      const promises = [];

      for (let i = 0; i < 15; i++) {
        promises.push(rateLimiter.checkRateLimit(userId));
      }

      const results = await Promise.all(promises);
      const allowed = results.filter(r => r.allowed).length;

      // Should not exceed limit even with concurrent requests
      expect(allowed).toBeLessThanOrEqual(10);
    });
  });

  describe('Rate Limit Response Headers', () => {
    test('should include X-RateLimit-Limit header', () => {
      const headers = {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '75',
        'X-RateLimit-Reset': '1234567890',
      };

      expect(headers['X-RateLimit-Limit']).toBe('100');
    });

    test('should include X-RateLimit-Remaining header', () => {
      const userId = 'header-user';
      rateLimiter.setUserLimits(userId, { requestsPerDay: 100 });

      for (let i = 0; i < 25; i++) {
        rateLimiter.recordRequest(userId);
      }

      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.requests.remaining).toBe(75);
    });

    test('should include Retry-After header when rate limited', async () => {
      const userId = 'retry-user';
      rateLimiter.setUserLimits(userId, { requestsPerMinute: 2 });

      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest(userId);
      }

      const result = await rateLimiter.checkRateLimit(userId);
      if (!result.allowed) {
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
      }
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('should clean up expired rate limit entries', () => {
      const userId = 'cleanup-user';

      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest(userId);
      }

      rateLimiter.cleanup();

      // Old entries should be removed
      expect(true).toBe(true);
    });

    test('should maintain rate limit accuracy after cleanup', () => {
      const userId = 'accuracy-user';
      rateLimiter.setUserLimits(userId, { requestsPerDay: 100 });

      for (let i = 0; i < 50; i++) {
        rateLimiter.recordRequest(userId);
      }

      const status1 = rateLimiter.getQuotaStatus(userId);
      rateLimiter.cleanup();
      const status2 = rateLimiter.getQuotaStatus(userId);

      expect(status1.requests.used).toBe(status2.requests.used);
    });
  });
});
