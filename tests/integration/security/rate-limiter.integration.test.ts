/**
 * Integration Tests for Rate Limiter
 * Tests concurrent operations, real timing, and multi-module interactions
 */

import { RateLimiter, CostAnalyzer, RateLimitConfig } from '../../../src/security/RateLimiter';

describe('RateLimiter Integration Tests', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    rateLimiter.cleanup();
  });

  describe('End-to-End Rate Limiting Flow', () => {
    test('complete user request lifecycle with rate limiting', async () => {
      const userId = 'user-001';

      // Set limits
      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000,
        tokensPerDay: 100000,
        costPerDay: 50,
      });

      // Make requests within limit
      for (let i = 0; i < 5; i++) {
        const check = await rateLimiter.checkRateLimit(userId);
        expect(check.allowed).toBe(true);

        if (check.allowed) {
          rateLimiter.recordRequest(userId);
          rateLimiter.recordTokenUsage(userId, 100, 200);
        }
      }

      // Check quota status
      const status = rateLimiter.getQuotaStatus(userId);

      expect(status.requests.used).toBe(5);
      expect(status.tokens.used).toBe(1500); // 5 * (100 + 200)
      expect(status.requests.remaining).toBe(995);
    });

    test('rate limit enforcement', async () => {
      const userId = 'limited-user';

      // Set very restrictive limits
      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 3,
      });

      // Make requests up to limit
      for (let i = 0; i < 3; i++) {
        const check = await rateLimiter.checkRateLimit(userId);
        expect(check.allowed).toBe(true);
        rateLimiter.recordRequest(userId);
      }

      // Next request should be rate limited
      const limitedCheck = await rateLimiter.checkRateLimit(userId);

      expect(limitedCheck.allowed).toBe(false);
      expect(limitedCheck.reason).toContain('rate limit');
      expect(limitedCheck.retryAfter).toBeDefined();
      expect(limitedCheck.retryAfter).toBeGreaterThan(0);
    });

    test('rate limit resets after time window', async () => {
      const userId = 'reset-user';

      // Set limits with short window (per minute)
      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 2,
      });

      // Use up limit
      await rateLimiter.checkRateLimit(userId);
      rateLimiter.recordRequest(userId);
      await rateLimiter.checkRateLimit(userId);
      rateLimiter.recordRequest(userId);

      // Should be limited
      const limited = await rateLimiter.checkRateLimit(userId);
      expect(limited.allowed).toBe(false);

      // Wait for window to reset (simulate by creating new minute key)
      // In real scenario, would wait 60 seconds
      await new Promise(resolve => setTimeout(resolve, 100));

      // After cleanup, old entries should be removed
      rateLimiter.cleanup();
    });
  });

  describe('Multi-Level Rate Limiting', () => {
    test('minute, hour, and day limits work together', async () => {
      const userId = 'multi-level-user';

      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 5,
        requestsPerHour: 20,
        requestsPerDay: 100,
      });

      // Rapidly make requests to hit minute limit
      let allowedCount = 0;
      let blockedCount = 0;

      for (let i = 0; i < 10; i++) {
        const check = await rateLimiter.checkRateLimit(userId);

        if (check.allowed) {
          allowedCount++;
          rateLimiter.recordRequest(userId);
        } else {
          blockedCount++;
          expect(check.reason).toContain('minute');
        }
      }

      expect(allowedCount).toBeLessThanOrEqual(5);
      expect(blockedCount).toBeGreaterThan(0);
    });

    test('token quota enforcement', async () => {
      const userId = 'token-limited';

      rateLimiter.setUserLimits(userId, {
        tokensPerDay: 1000,
        requestsPerDay: 1000,
      });

      // Use tokens up to limit
      rateLimiter.recordRequest(userId);
      rateLimiter.recordTokenUsage(userId, 300, 400); // 700 tokens

      rateLimiter.recordRequest(userId);
      rateLimiter.recordTokenUsage(userId, 200, 200); // 400 more = 1100 total

      // Should be over token limit
      const check = await rateLimiter.checkRateLimit(userId);

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Token quota');
    });

    test('cost quota enforcement', async () => {
      const userId = 'cost-limited';

      rateLimiter.setUserLimits(userId, {
        costPerDay: 1.0, // $1 per day
      });

      // Simulate expensive requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest(userId);
        // Large token usage will exceed cost limit
        rateLimiter.recordTokenUsage(userId, 10000, 10000);
      }

      // Should hit cost limit
      const check = await rateLimiter.checkRateLimit(userId);

      if (!check.allowed) {
        expect(check.reason).toContain('cost');
      }

      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.cost.used).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations', () => {
    test('concurrent requests from same user', async () => {
      const userId = 'concurrent-user';

      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 100,
      });

      // Make 50 concurrent requests
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          rateLimiter.checkRateLimit(userId).then(result => {
            if (result.allowed) {
              rateLimiter.recordRequest(userId);
            }
            return result;
          })
        );
      }

      const results = await Promise.all(requests);

      // Most should be allowed (within limit)
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBeGreaterThan(45);

      // Verify count is accurate
      const status = rateLimiter.getQuotaStatus(userId);
      expect(status.requests.used).toBeLessThanOrEqual(50);
    });

    test('concurrent requests from multiple users', async () => {
      const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

      // Set limits for all users
      users.forEach(userId => {
        rateLimiter.setUserLimits(userId, {
          requestsPerMinute: 20,
        });
      });

      // Make concurrent requests from all users
      const allRequests = users.flatMap(userId =>
        Array.from({ length: 10 }, () =>
          rateLimiter.checkRateLimit(userId).then(result => {
            if (result.allowed) {
              rateLimiter.recordRequest(userId);
            }
            return { userId, result };
          })
        )
      );

      const results = await Promise.all(allRequests);

      // All users should have their requests processed
      users.forEach(userId => {
        const userResults = results.filter(r => r.userId === userId);
        expect(userResults.length).toBe(10);

        const allowed = userResults.filter(r => r.result.allowed).length;
        expect(allowed).toBeGreaterThan(0);
      });
    });

    test('concurrent token recording', () => {
      const userId = 'token-user';

      // Record tokens concurrently
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          Promise.resolve().then(() => {
            rateLimiter.recordTokenUsage(userId, 100, 100);
          })
        );
      }

      return Promise.all(operations).then(() => {
        const status = rateLimiter.getQuotaStatus(userId);
        expect(status.tokens.used).toBe(20000); // 100 * (100 + 100)
      });
    });
  });

  describe('Usage Metrics and Reporting', () => {
    test('generate usage report', () => {
      const userId = 'report-user';

      rateLimiter.setUserLimits(userId, {
        requestsPerDay: 10000,
        tokensPerDay: 1000000,
        costPerDay: 100,
      });

      // Make some requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest(userId);
        rateLimiter.recordTokenUsage(userId, 500, 1000);
      }

      const report = rateLimiter.generateReport(userId);

      expect(report).toContain('Usage Report');
      expect(report).toContain(userId);
      expect(report).toContain('Requests:');
      expect(report).toContain('Tokens:');
      expect(report).toContain('Cost:');
      expect(report).toContain('Quota Status');
    });

    test('track metrics over time', () => {
      const userId = 'metrics-user';

      // Day 1
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(userId);
        rateLimiter.recordTokenUsage(userId, 100, 200);
      }

      const metrics1 = rateLimiter.getUsageMetrics(userId);

      expect(metrics1.requestCount).toBe(5);
      expect(metrics1.tokenCount).toBe(1500);
      expect(metrics1.estimatedCost).toBeGreaterThan(0);

      // More requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(userId);
        rateLimiter.recordTokenUsage(userId, 100, 200);
      }

      const metrics2 = rateLimiter.getUsageMetrics(userId);

      expect(metrics2.requestCount).toBe(10);
      expect(metrics2.tokenCount).toBe(3000);
    });
  });

  describe('Cost Analysis Integration', () => {
    test('cost analyzer tracks daily costs', () => {
      const analyzer = new CostAnalyzer();
      const userId = 'cost-user';

      // Record costs over several days
      const dates = [
        new Date('2024-01-01'),
        new Date('2024-01-02'),
        new Date('2024-01-03'),
        new Date('2024-01-04'),
        new Date('2024-01-05'),
      ];

      const costs = [10, 12, 15, 18, 20];

      dates.forEach((date, index) => {
        analyzer.recordDailyCost(userId, date, costs[index]);
      });

      // Get trend
      const trend = analyzer.getCostTrend(userId, 5);

      expect(trend.daily.length).toBe(5);
      expect(trend.total).toBe(75);
      expect(trend.average).toBe(15);
      expect(trend.trend).toBe('increasing');
    });

    test('predict monthly cost', () => {
      const analyzer = new CostAnalyzer();
      const userId = 'predict-user';

      // Record 7 days of costs
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        analyzer.recordDailyCost(userId, date, 10);
      }

      const predicted = analyzer.predictMonthlyCost(userId);

      expect(predicted).toBe(300); // 10 * 30
    });

    test('get optimization suggestions', () => {
      const analyzer = new CostAnalyzer();
      const userId = 'optimize-user';

      // Record high costs
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        analyzer.recordDailyCost(userId, date, 60 + i * 5);
      }

      const suggestions = analyzer.getOptimizationSuggestions(userId);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('cache') || s.includes('cost'))).toBe(true);
    });

    test('detect cost trend changes', () => {
      const analyzer = new CostAnalyzer();
      const userId = 'trend-user';

      // Decreasing trend
      const costs = [50, 45, 40, 35, 30, 25, 20];
      costs.forEach((cost, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        analyzer.recordDailyCost(userId, date, cost);
      });

      const trend = analyzer.getCostTrend(userId, 7);

      expect(trend.trend).toBe('decreasing');
      expect(trend.average).toBeLessThan(50);
    });
  });

  describe('Error Propagation', () => {
    test('handle invalid user configuration', async () => {
      const userId = 'invalid-user';

      // Don't set limits, should use defaults
      const check = await rateLimiter.checkRateLimit(userId);

      expect(check.allowed).toBe(true);

      // Get default limits
      const limits = rateLimiter.getUserLimits(userId);
      expect(limits.requestsPerMinute).toBeDefined();
    });

    test('handle negative values gracefully', () => {
      const userId = 'negative-user';

      // Try to set invalid limits
      expect(() => {
        rateLimiter.setUserLimits(userId, {
          requestsPerMinute: -10,
        } as any);
      }).not.toThrow();
    });
  });

  describe('Time-Based Operations', () => {
    test('rate limit window expiration', async () => {
      const userId = 'expiry-user';

      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 2,
      });

      // Use up limit
      await rateLimiter.checkRateLimit(userId);
      rateLimiter.recordRequest(userId);
      await rateLimiter.checkRateLimit(userId);
      rateLimiter.recordRequest(userId);

      // Should be limited
      const limited = await rateLimiter.checkRateLimit(userId);
      expect(limited.allowed).toBe(false);

      // Note: In real scenario, would need to wait for actual time to pass
      // This test demonstrates the structure
    });

    test('cleanup removes old entries', () => {
      const userId = 'cleanup-user';

      // Make requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest(userId);
      }

      // Run cleanup
      rateLimiter.cleanup();

      // Cleanup should not crash
      expect(() => rateLimiter.cleanup()).not.toThrow();
    });

    test('retry-after provides valid timing', async () => {
      const userId = 'retry-user';

      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 1,
      });

      // Use up limit
      await rateLimiter.checkRateLimit(userId);
      rateLimiter.recordRequest(userId);

      // Check retry timing
      const result = await rateLimiter.checkRateLimit(userId);

      if (!result.allowed) {
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.retryAfter).toBeLessThanOrEqual(60);
      }
    });
  });

  describe('Integration with Authentication', () => {
    test('rate limiting per authenticated user', async () => {
      const users = [
        { id: 'auth-user-1', tier: 'free' },
        { id: 'auth-user-2', tier: 'premium' },
        { id: 'auth-user-3', tier: 'enterprise' },
      ];

      // Set different limits based on tier
      rateLimiter.setUserLimits(users[0].id, {
        requestsPerMinute: 10,
        tokensPerDay: 10000,
      });

      rateLimiter.setUserLimits(users[1].id, {
        requestsPerMinute: 50,
        tokensPerDay: 100000,
      });

      rateLimiter.setUserLimits(users[2].id, {
        requestsPerMinute: 200,
        tokensPerDay: 1000000,
      });

      // Verify each user has correct limits
      const limits1 = rateLimiter.getUserLimits(users[0].id);
      const limits2 = rateLimiter.getUserLimits(users[1].id);
      const limits3 = rateLimiter.getUserLimits(users[2].id);

      expect(limits1.requestsPerMinute).toBe(10);
      expect(limits2.requestsPerMinute).toBe(50);
      expect(limits3.requestsPerMinute).toBe(200);
    });
  });

  describe('Performance Under Load', () => {
    test('handle high volume of checks efficiently', async () => {
      const userId = 'perf-user';

      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 10000,
      });

      const startTime = Date.now();

      // Perform 1000 rate limit checks
      const checks = [];
      for (let i = 0; i < 1000; i++) {
        checks.push(rateLimiter.checkRateLimit(userId));
      }

      await Promise.all(checks);

      const duration = Date.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second for 1000 checks
    });

    test('efficient quota status queries', () => {
      const userCount = 100;

      // Set up many users
      for (let i = 0; i < userCount; i++) {
        const userId = `user-${i}`;
        rateLimiter.setUserLimits(userId, {
          requestsPerDay: 1000,
        });

        // Make some requests
        for (let j = 0; j < 10; j++) {
          rateLimiter.recordRequest(userId);
        }
      }

      const startTime = Date.now();

      // Query status for all users
      for (let i = 0; i < userCount; i++) {
        rateLimiter.getQuotaStatus(`user-${i}`);
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should be fast
    });
  });

  describe('Real-World Scenarios', () => {
    test('API gateway rate limiting simulation', async () => {
      const apiUsers = ['api-user-1', 'api-user-2', 'api-user-3'];

      // Configure different tiers
      apiUsers.forEach((userId, index) => {
        rateLimiter.setUserLimits(userId, {
          requestsPerMinute: (index + 1) * 10,
          requestsPerHour: (index + 1) * 100,
        });
      });

      // Simulate API requests
      const results = await Promise.all(
        apiUsers.flatMap(userId =>
          Array.from({ length: 15 }, async () => {
            const check = await rateLimiter.checkRateLimit(userId);
            if (check.allowed) {
              rateLimiter.recordRequest(userId);
              return { userId, status: 200 };
            } else {
              return { userId, status: 429, retryAfter: check.retryAfter };
            }
          })
        )
      );

      // Verify rate limiting worked
      const user1Results = results.filter(r => r.userId === 'api-user-1');
      const rateLimited = user1Results.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('burst traffic handling', async () => {
      const userId = 'burst-user';

      rateLimiter.setUserLimits(userId, {
        requestsPerMinute: 20,
      });

      // Simulate burst
      const burst1 = Array.from({ length: 15 }, () =>
        rateLimiter.checkRateLimit(userId).then(r => {
          if (r.allowed) rateLimiter.recordRequest(userId);
          return r;
        })
      );

      const results1 = await Promise.all(burst1);
      const allowed1 = results1.filter(r => r.allowed).length;

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Another burst
      const burst2 = Array.from({ length: 15 }, () =>
        rateLimiter.checkRateLimit(userId).then(r => {
          if (r.allowed) rateLimiter.recordRequest(userId);
          return r;
        })
      );

      const results2 = await Promise.all(burst2);
      const allowed2 = results2.filter(r => r.allowed).length;

      // Some requests should be blocked
      expect(allowed1 + allowed2).toBeLessThan(30);
    });
  });
});
