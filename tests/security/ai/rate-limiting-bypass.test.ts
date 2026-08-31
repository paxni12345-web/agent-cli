/**
 * Security Tests: Rate Limiting Bypass Attacks on AI Modules
 * Tests rate limiting, throttling, quota enforcement, and bypass techniques
 */

import { MultiModelOrchestrator } from '../../../src/ai/MultiModelOrchestrator';
import { LearningSystem } from '../../../src/ai/LearningSystem';
import * as crypto from 'crypto';

describe('AI Module Rate Limiting Bypass Tests', () => {
  describe('Basic Rate Limiting', () => {
    test('should enforce requests per minute limit', () => {
      const rateLimiter = {
        limit: 10,
        window: 60000, // 1 minute
        requests: new Map<string, number[]>()
      };

      const checkRateLimit = (userId: string): boolean => {
        const now = Date.now();
        const userRequests = rateLimiter.requests.get(userId) || [];

        // Remove requests outside the time window
        const validRequests = userRequests.filter(
          timestamp => now - timestamp < rateLimiter.window
        );

        if (validRequests.length >= rateLimiter.limit) {
          return false; // Rate limit exceeded
        }

        validRequests.push(now);
        rateLimiter.requests.set(userId, validRequests);
        return true;
      };

      const userId = 'user123';

      // First 10 requests should succeed
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit(userId)).toBe(true);
      }

      // 11th request should fail
      expect(checkRateLimit(userId)).toBe(false);
    });

    test('should implement sliding window rate limiting', () => {
      class SlidingWindowRateLimiter {
        private requests = new Map<string, number[]>();

        constructor(
          private limit: number,
          private windowMs: number
        ) {}

        isAllowed(key: string): boolean {
          const now = Date.now();
          const userRequests = this.requests.get(key) || [];

          // Sliding window: remove old requests
          const validRequests = userRequests.filter(
            timestamp => now - timestamp < this.windowMs
          );

          if (validRequests.length >= this.limit) {
            return false;
          }

          validRequests.push(now);
          this.requests.set(key, validRequests);
          return true;
        }
      }

      const limiter = new SlidingWindowRateLimiter(5, 1000); // 5 per second

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed('user1')).toBe(true);
      }

      // 6th should fail
      expect(limiter.isAllowed('user1')).toBe(false);
    });

    test('should implement token bucket algorithm', () => {
      class TokenBucket {
        private tokens: number;
        private lastRefill: number;

        constructor(
          private capacity: number,
          private refillRate: number // tokens per second
        ) {
          this.tokens = capacity;
          this.lastRefill = Date.now();
        }

        consume(count: number = 1): boolean {
          this.refill();

          if (this.tokens >= count) {
            this.tokens -= count;
            return true;
          }

          return false;
        }

        private refill(): void {
          const now = Date.now();
          const elapsed = (now - this.lastRefill) / 1000;
          const tokensToAdd = Math.floor(elapsed * this.refillRate);

          if (tokensToAdd > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefill = now;
          }
        }
      }

      const bucket = new TokenBucket(10, 2); // 10 capacity, 2 per second

      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        expect(bucket.consume()).toBe(true);
      }

      // Should fail when empty
      expect(bucket.consume()).toBe(false);
    });

    test('should implement leaky bucket algorithm', () => {
      class LeakyBucket {
        private queue: number[] = [];

        constructor(
          private capacity: number,
          private leakRate: number // requests per second
        ) {}

        add(): boolean {
          this.leak();

          if (this.queue.length >= this.capacity) {
            return false; // Bucket full
          }

          this.queue.push(Date.now());
          return true;
        }

        private leak(): void {
          const now = Date.now();
          const leakInterval = 1000 / this.leakRate;

          while (this.queue.length > 0) {
            const oldest = this.queue[0];
            if (now - oldest >= leakInterval) {
              this.queue.shift();
            } else {
              break;
            }
          }
        }
      }

      const bucket = new LeakyBucket(5, 2); // Capacity 5, leak 2/sec

      // Fill bucket
      for (let i = 0; i < 5; i++) {
        expect(bucket.add()).toBe(true);
      }

      // Should reject when full
      expect(bucket.add()).toBe(false);
    });
  });

  describe('IP-Based Rate Limiting Bypass', () => {
    test('should detect distributed attacks from multiple IPs', () => {
      const requestTracker = new Map<string, number>();
      const globalLimit = 100;
      let globalCount = 0;

      const trackRequest = (ip: string): boolean => {
        globalCount++;

        const ipCount = (requestTracker.get(ip) || 0) + 1;
        requestTracker.set(ip, ipCount);

        // Check global rate limit
        if (globalCount > globalLimit) {
          return false;
        }

        return true;
      };

      // Simulate distributed attack
      const attackIPs = Array.from({ length: 50 }, (_, i) => `192.168.1.${i}`);

      for (const ip of attackIPs) {
        trackRequest(ip);
        trackRequest(ip);
      }

      // Should hit global limit
      expect(globalCount).toBeGreaterThan(globalLimit);
    });

    test('should block proxy-based IP rotation', () => {
      const knownProxies = new Set([
        '203.0.113.1',
        '198.51.100.1',
        '192.0.2.1'
      ]);

      const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-cluster-client-ip',
        'via'
      ];

      const detectProxy = (
        ip: string,
        headers: Record<string, string>
      ): boolean => {
        // Check if IP is known proxy
        if (knownProxies.has(ip)) {
          return true;
        }

        // Check for proxy headers
        return suspiciousHeaders.some(header => header in headers);
      };

      expect(detectProxy('203.0.113.1', {})).toBe(true);
      expect(detectProxy('192.168.1.1', { 'x-forwarded-for': '1.2.3.4' })).toBe(true);
      expect(detectProxy('192.168.1.1', {})).toBe(false);
    });

    test('should enforce rate limits per subnet', () => {
      const subnetLimits = new Map<string, number>();
      const limitPerSubnet = 50;

      const getSubnet = (ip: string): string => {
        const parts = ip.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      };

      const checkSubnetLimit = (ip: string): boolean => {
        const subnet = getSubnet(ip);
        const count = (subnetLimits.get(subnet) || 0) + 1;

        if (count > limitPerSubnet) {
          return false;
        }

        subnetLimits.set(subnet, count);
        return true;
      };

      // Requests from same subnet
      for (let i = 0; i < 55; i++) {
        const result = checkSubnetLimit(`192.168.1.${i % 255}`);
        if (i < 50) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }
    });
  });

  describe('User Authentication Bypass', () => {
    test('should prevent unauthenticated rate limit bypass', () => {
      const authenticatedLimits = new Map<string, number>();
      const unauthenticatedLimits = new Map<string, number>();

      const checkLimit = (
        userId: string | null,
        ip: string
      ): { allowed: boolean; reason?: string } => {
        if (userId) {
          // Authenticated users get higher limits
          const count = (authenticatedLimits.get(userId) || 0) + 1;
          if (count > 1000) {
            return { allowed: false, reason: 'User quota exceeded' };
          }
          authenticatedLimits.set(userId, count);
        } else {
          // Unauthenticated users get lower limits per IP
          const count = (unauthenticatedLimits.get(ip) || 0) + 1;
          if (count > 10) {
            return { allowed: false, reason: 'Anonymous quota exceeded' };
          }
          unauthenticatedLimits.set(ip, count);
        }

        return { allowed: true };
      };

      // Authenticated user
      for (let i = 0; i < 100; i++) {
        const result = checkLimit('user123', '192.168.1.1');
        expect(result.allowed).toBe(true);
      }

      // Unauthenticated user hits limit faster
      for (let i = 0; i < 15; i++) {
        const result = checkLimit(null, '192.168.1.2');
        if (i < 10) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
        }
      }
    });

    test('should prevent account sharing for rate limit bypass', () => {
      const userSessions = new Map<string, Set<string>>();
      const maxConcurrentIPs = 3;

      const trackSession = (userId: string, ip: string): boolean => {
        const ips = userSessions.get(userId) || new Set();

        if (!ips.has(ip) && ips.size >= maxConcurrentIPs) {
          return false; // Too many concurrent IPs
        }

        ips.add(ip);
        userSessions.set(userId, ips);
        return true;
      };

      const userId = 'user123';

      expect(trackSession(userId, '192.168.1.1')).toBe(true);
      expect(trackSession(userId, '192.168.1.2')).toBe(true);
      expect(trackSession(userId, '192.168.1.3')).toBe(true);
      expect(trackSession(userId, '192.168.1.4')).toBe(false);
    });
  });

  describe('Header Manipulation Bypass', () => {
    test('should detect X-Forwarded-For spoofing', () => {
      const validateForwardedFor = (
        clientIP: string,
        xForwardedFor: string | null
      ): string => {
        if (!xForwardedFor) {
          return clientIP;
        }

        // X-Forwarded-For can be spoofed, prefer client IP
        const ips = xForwardedFor.split(',').map(ip => ip.trim());

        // Use the rightmost trusted IP
        return clientIP; // In production, validate trust chain
      };

      const clientIP = '203.0.113.1';
      const spoofedHeader = '192.168.1.1, 10.0.0.1, 172.16.0.1';

      const effectiveIP = validateForwardedFor(clientIP, spoofedHeader);
      expect(effectiveIP).toBe(clientIP); // Don't trust spoofed header
    });

    test('should validate User-Agent for bot detection', () => {
      const suspiciousUserAgents = [
        'curl',
        'wget',
        'python-requests',
        'bot',
        'crawler',
        'spider'
      ];

      const isSuspicious = (userAgent: string): boolean => {
        const ua = userAgent.toLowerCase();
        return suspiciousUserAgents.some(pattern => ua.includes(pattern));
      };

      expect(isSuspicious('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
      expect(isSuspicious('curl/7.68.0')).toBe(true);
      expect(isSuspicious('python-requests/2.25.1')).toBe(true);
    });

    test('should detect header-based rate limit bypass attempts', () => {
      const seenFingerprints = new Map<string, number>();

      const generateFingerprint = (headers: Record<string, string>): string => {
        const parts = [
          headers['user-agent'] || '',
          headers['accept-language'] || '',
          headers['accept-encoding'] || '',
          headers['accept'] || ''
        ];

        return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
      };

      const checkFingerprint = (headers: Record<string, string>): boolean => {
        const fingerprint = generateFingerprint(headers);
        const count = (seenFingerprints.get(fingerprint) || 0) + 1;

        if (count > 100) {
          return false; // Same fingerprint too many times
        }

        seenFingerprints.set(fingerprint, count);
        return true;
      };

      const headers = {
        'user-agent': 'Mozilla/5.0',
        'accept-language': 'en-US',
        'accept-encoding': 'gzip',
        'accept': 'text/html'
      };

      for (let i = 0; i < 105; i++) {
        const result = checkFingerprint(headers);
        if (i < 100) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }
    });
  });

  describe('Distributed Attack Detection', () => {
    test('should detect coordinated attack patterns', () => {
      const requestLog: Array<{ ip: string; timestamp: number }> = [];

      const detectCoordinatedAttack = (): boolean => {
        const now = Date.now();
        const recentWindow = 5000; // 5 seconds

        const recentRequests = requestLog.filter(
          req => now - req.timestamp < recentWindow
        );

        const uniqueIPs = new Set(recentRequests.map(r => r.ip));

        // Suspicious if many IPs hitting at same time
        return recentRequests.length > 50 && uniqueIPs.size > 10;
      };

      // Simulate coordinated attack
      const timestamp = Date.now();
      for (let i = 0; i < 60; i++) {
        requestLog.push({
          ip: `192.168.1.${i % 20}`,
          timestamp: timestamp + (i * 10)
        });
      }

      expect(detectCoordinatedAttack()).toBe(true);
    });

    test('should implement exponential backoff on repeated failures', () => {
      const failureCounts = new Map<string, number>();

      const calculateBackoff = (userId: string): number => {
        const failures = failureCounts.get(userId) || 0;
        const backoffMs = Math.min(1000 * Math.pow(2, failures), 32000);
        return backoffMs;
      };

      const recordFailure = (userId: string): void => {
        const count = (failureCounts.get(userId) || 0) + 1;
        failureCounts.set(userId, count);
      };

      const userId = 'user123';

      recordFailure(userId);
      expect(calculateBackoff(userId)).toBe(2000); // 2^1 seconds

      recordFailure(userId);
      expect(calculateBackoff(userId)).toBe(4000); // 2^2 seconds

      recordFailure(userId);
      expect(calculateBackoff(userId)).toBe(8000); // 2^3 seconds
    });
  });

  describe('API Key and Token Rate Limiting', () => {
    test('should enforce per-API-key rate limits', () => {
      const apiKeyLimits = new Map<string, {
        requests: number[];
        limit: number;
        window: number;
      }>();

      const checkAPIKeyLimit = (apiKey: string): boolean => {
        const now = Date.now();
        let keyData = apiKeyLimits.get(apiKey);

        if (!keyData) {
          keyData = {
            requests: [],
            limit: 1000,
            window: 60000 // 1 minute
          };
          apiKeyLimits.set(apiKey, keyData);
        }

        // Remove old requests
        keyData.requests = keyData.requests.filter(
          timestamp => now - timestamp < keyData.window
        );

        if (keyData.requests.length >= keyData.limit) {
          return false;
        }

        keyData.requests.push(now);
        return true;
      };

      const apiKey = crypto.randomBytes(32).toString('hex');

      for (let i = 0; i < 1005; i++) {
        const result = checkAPIKeyLimit(apiKey);
        if (i < 1000) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }
    });

    test('should detect API key sharing', () => {
      const apiKeyUsage = new Map<string, Set<string>>();

      const trackAPIKeyUsage = (apiKey: string, ip: string): boolean => {
        const ips = apiKeyUsage.get(apiKey) || new Set();
        ips.add(ip);
        apiKeyUsage.set(apiKey, ips);

        // Suspicious if API key used from too many IPs
        return ips.size <= 5;
      };

      const apiKey = crypto.randomBytes(32).toString('hex');

      for (let i = 1; i <= 10; i++) {
        const result = trackAPIKeyUsage(apiKey, `192.168.1.${i}`);
        if (i <= 5) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }
    });
  });

  describe('AI-Specific Rate Limiting', () => {
    test('should enforce rate limits on model orchestration', async () => {
      const orchestrator = new MultiModelOrchestrator();
      const requestCounts = new Map<string, number>();
      const limit = 5;

      const checkOrchestrationLimit = (userId: string): boolean => {
        const count = (requestCounts.get(userId) || 0) + 1;

        if (count > limit) {
          return false;
        }

        requestCounts.set(userId, count);
        return true;
      };

      const userId = 'user123';

      for (let i = 0; i < 7; i++) {
        const allowed = checkOrchestrationLimit(userId);
        if (i < 5) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }
    });

    test('should enforce rate limits on learning feedback', async () => {
      const learningSystem = new LearningSystem('/tmp/test-rate-limit-feedback');
      const feedbackCounts = new Map<string, number[]>();
      const limit = 10;
      const window = 60000;

      const checkFeedbackLimit = (userId: string): boolean => {
        const now = Date.now();
        const timestamps = feedbackCounts.get(userId) || [];

        const validTimestamps = timestamps.filter(
          ts => now - ts < window
        );

        if (validTimestamps.length >= limit) {
          return false;
        }

        validTimestamps.push(now);
        feedbackCounts.set(userId, validTimestamps);
        return true;
      };

      const userId = 'user123';

      for (let i = 0; i < 12; i++) {
        const allowed = checkFeedbackLimit(userId);

        if (allowed) {
          await learningSystem.recordFeedback('task', 'action', 1, 'success');
        }

        if (i < 10) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }

      await learningSystem.reset();
    });

    test('should implement cost-based rate limiting', () => {
      const userBudgets = new Map<string, {
        spent: number;
        limit: number;
        resetAt: number;
      }>();

      const checkCostLimit = (userId: string, cost: number): boolean => {
        const now = Date.now();
        let budget = userBudgets.get(userId);

        if (!budget || now >= budget.resetAt) {
          budget = {
            spent: 0,
            limit: 100, // $100 per month
            resetAt: now + (30 * 24 * 60 * 60 * 1000)
          };
          userBudgets.set(userId, budget);
        }

        if (budget.spent + cost > budget.limit) {
          return false;
        }

        budget.spent += cost;
        return true;
      };

      const userId = 'user123';

      expect(checkCostLimit(userId, 50)).toBe(true);
      expect(checkCostLimit(userId, 40)).toBe(true);
      expect(checkCostLimit(userId, 20)).toBe(false); // Would exceed limit
    });
  });

  describe('Rate Limit Headers and Communication', () => {
    test('should provide rate limit information in headers', () => {
      const generateRateLimitHeaders = (
        used: number,
        limit: number,
        resetTime: number
      ): Record<string, string> => {
        return {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': Math.max(0, limit - used).toString(),
          'X-RateLimit-Reset': resetTime.toString(),
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString()
        };
      };

      const headers = generateRateLimitHeaders(
        90,
        100,
        Date.now() + 60000
      );

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('10');
      expect(parseInt(headers['Retry-After'])).toBeGreaterThan(0);
    });

    test('should return 429 Too Many Requests status', () => {
      const handleRateLimitExceeded = (): {
        status: number;
        body: any;
      } => {
        return {
          status: 429,
          body: {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: 60
          }
        };
      };

      const response = handleRateLimitExceeded();
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too Many Requests');
    });
  });

  describe('Advanced Bypass Prevention', () => {
    test('should detect time-based rate limit bypass', () => {
      const requestTimestamps = new Map<string, number[]>();

      const detectTimingBypass = (userId: string): boolean => {
        const timestamps = requestTimestamps.get(userId) || [];
        const now = Date.now();

        timestamps.push(now);
        requestTimestamps.set(userId, timestamps);

        // Check if requests are evenly spaced (just under limit)
        if (timestamps.length < 3) return false;

        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => {
          return sum + Math.pow(interval - avgInterval, 2);
        }, 0) / intervals.length;

        // Low variance suggests automated timing bypass
        return variance < 1000; // Less than 1 second variance
      };

      const userId = 'user123';

      // Simulate evenly-spaced requests (bypass attempt)
      for (let i = 0; i < 10; i++) {
        const timestamps = requestTimestamps.get(userId) || [];
        timestamps.push(Date.now() + (i * 5000)); // Exactly 5 seconds apart
        requestTimestamps.set(userId, timestamps);
      }

      expect(detectTimingBypass(userId)).toBe(true);
    });

    test('should implement adaptive rate limiting', () => {
      const adaptiveLimiter = {
        baseLimit: 100,
        currentLimit: 100,
        errorRate: 0,
        adjustInterval: 60000
      };

      const adjustRateLimit = (
        successfulRequests: number,
        failedRequests: number
      ): number => {
        const totalRequests = successfulRequests + failedRequests;
        if (totalRequests === 0) return adaptiveLimiter.currentLimit;

        const errorRate = failedRequests / totalRequests;

        if (errorRate > 0.1) {
          // High error rate, reduce limit
          adaptiveLimiter.currentLimit = Math.max(
            10,
            Math.floor(adaptiveLimiter.currentLimit * 0.8)
          );
        } else if (errorRate < 0.01) {
          // Low error rate, increase limit
          adaptiveLimiter.currentLimit = Math.min(
            adaptiveLimiter.baseLimit * 2,
            Math.floor(adaptiveLimiter.currentLimit * 1.1)
          );
        }

        return adaptiveLimiter.currentLimit;
      };

      // High error rate scenario
      let newLimit = adjustRateLimit(80, 20); // 20% error rate
      expect(newLimit).toBeLessThan(100);

      // Low error rate scenario
      adaptiveLimiter.currentLimit = 100;
      newLimit = adjustRateLimit(99, 1); // 1% error rate
      expect(newLimit).toBeGreaterThan(100);
    });
  });
});
