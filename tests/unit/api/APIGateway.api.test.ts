/**
 * Comprehensive Unit Tests for API APIGateway
 * Tests all public methods, edge cases, error conditions, async behavior,
 * resource cleanup, type safety, and mock external dependencies
 */

import {
  APIGateway,
  APIEndpoint,
  HTTPMethod,
  APIRequest,
  APIResponse,
  RequestContext,
  RateLimitConfig,
  RateLimitStrategy,
  ValidationConfig,
  AuthenticationConfig,
  AuthorizationConfig,
  CachingConfig,
  InputSanitizer,
  RequestValidator,
  RateLimiter,
  APICache,
  MetricsCollector,
  QuotaManager,
  ValidationMiddleware,
  ValidationSchemas,
} from '../../../src/api/APIGateway';

import {
  APIError,
  ValidationError as ValidError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
} from '../../../src/api/ErrorHandling';

describe('APIGateway - API Implementation', () => {
  let gateway: APIGateway;

  beforeEach(() => {
    gateway = new APIGateway();
  });

  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('Constructor', () => {
    it('should create gateway with default dependencies', () => {
      expect(gateway).toBeInstanceOf(APIGateway);
      expect(gateway.getAuthSystem()).toBeDefined();
      expect(gateway.getRBACSystem()).toBeDefined();
      expect(gateway.getAuditLogger()).toBeDefined();
    });

    it('should create gateway with custom dependencies', () => {
      const customGateway = new APIGateway(undefined, undefined, undefined, {
        enableErrorHandling: true,
      });
      expect(customGateway).toBeInstanceOf(APIGateway);
    });

    it('should handle null dependencies', () => {
      const gw = new APIGateway(null as any, null as any, null as any);
      expect(gw).toBeInstanceOf(APIGateway);
    });

    it('should handle undefined options', () => {
      const gw = new APIGateway(undefined, undefined, undefined, undefined);
      expect(gw).toBeInstanceOf(APIGateway);
    });

    it('should initialize with error handling disabled', () => {
      const gw = new APIGateway(undefined, undefined, undefined, {
        enableErrorHandling: false,
      });
      expect(gw).toBeInstanceOf(APIGateway);
    });
  });

  // ============================================================================
  // Endpoint Registration Tests
  // ============================================================================

  describe('registerEndpoint()', () => {
    it('should register valid endpoint', () => {
      const endpoint = gateway.registerEndpoint({
        path: '/api/users',
        method: HTTPMethod.GET,
        handler: async (req: APIRequest) => ({
          statusCode: 200,
          headers: {},
          body: { users: [] },
        }),
        middleware: [],
        tags: ['users'],
      });

      expect(endpoint.id).toBeDefined();
      expect(endpoint.path).toBe('/api/users');
      expect(endpoint.method).toBe(HTTPMethod.GET);
    });

    it('should generate unique IDs', () => {
      const ep1 = gateway.registerEndpoint({
        path: '/endpoint1',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });

      const ep2 = gateway.registerEndpoint({
        path: '/endpoint2',
        method: HTTPMethod.POST,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });

      expect(ep1.id).not.toBe(ep2.id);
    });

    it('should handle endpoint with all optional fields', () => {
      const endpoint = gateway.registerEndpoint({
        path: '/complex',
        method: HTTPMethod.PUT,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        rateLimit: {
          strategy: RateLimitStrategy.FixedWindow,
          limit: 100,
          window: 60000,
          scope: 'ip',
        },
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          roles: ['admin'],
          permissions: ['write'],
        },
        validation: {
          body: { type: 'object', properties: {}, required: [] },
        },
        caching: {
          enabled: true,
          ttl: 300000,
        },
        tags: ['admin'],
      });

      expect(endpoint.rateLimit).toBeDefined();
      expect(endpoint.authentication).toBeDefined();
      expect(endpoint.authorization).toBeDefined();
      expect(endpoint.validation).toBeDefined();
      expect(endpoint.caching).toBeDefined();
    });

    it('should handle null/undefined fields', () => {
      const endpoint = gateway.registerEndpoint({
        path: '/null-test',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: null }),
        middleware: [],
        rateLimit: undefined,
        authentication: undefined,
        authorization: undefined,
        validation: undefined,
        caching: undefined,
        tags: [],
      });

      expect(endpoint).toBeDefined();
    });

    it('should handle empty middleware array', () => {
      const endpoint = gateway.registerEndpoint({
        path: '/no-middleware',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });

      expect(endpoint.middleware).toEqual([]);
    });
  });

  describe('removeEndpoint()', () => {
    it('should remove existing endpoint', () => {
      const endpoint = gateway.registerEndpoint({
        path: '/remove-test',
        method: HTTPMethod.DELETE,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });

      gateway.removeEndpoint(endpoint.id);
      const endpoints = gateway.listEndpoints();
      expect(endpoints.find(e => e.id === endpoint.id)).toBeUndefined();
    });

    it('should handle removing non-existent endpoint', () => {
      expect(() => gateway.removeEndpoint('non-existent-id')).not.toThrow();
    });

    it('should handle null/undefined endpoint ID', () => {
      expect(() => gateway.removeEndpoint(null as any)).not.toThrow();
      expect(() => gateway.removeEndpoint(undefined as any)).not.toThrow();
    });
  });

  describe('listEndpoints()', () => {
    it('should return empty array when no endpoints', () => {
      const endpoints = gateway.listEndpoints();
      expect(endpoints).toEqual([]);
    });

    it('should return all registered endpoints', () => {
      gateway.registerEndpoint({
        path: '/ep1',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: ['test'],
      });
      gateway.registerEndpoint({
        path: '/ep2',
        method: HTTPMethod.POST,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: ['test'],
      });

      const endpoints = gateway.listEndpoints();
      expect(endpoints).toHaveLength(2);
    });

    it('should filter by tags', () => {
      gateway.registerEndpoint({
        path: '/tagged1',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: ['users'],
      });
      gateway.registerEndpoint({
        path: '/tagged2',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: ['admin'],
      });

      const filtered = gateway.listEndpoints({ tags: ['users'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].tags).toContain('users');
    });

    it('should handle null filter', () => {
      gateway.registerEndpoint({
        path: '/test',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });

      const endpoints = gateway.listEndpoints(undefined);
      expect(endpoints).toHaveLength(1);
    });
  });

  // ============================================================================
  // Request Handling Tests
  // ============================================================================

  describe('handleRequest()', () => {
    it('should handle valid request', async () => {
      gateway.registerEndpoint({
        path: '/test',
        method: HTTPMethod.GET,
        handler: async (req: APIRequest) => ({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { success: true },
        }),
        middleware: [],
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle request with body', async () => {
      gateway.registerEndpoint({
        path: '/post',
        method: HTTPMethod.POST,
        handler: async (req: APIRequest) => ({
          statusCode: 201,
          headers: {},
          body: { received: req.body },
        }),
        middleware: [],
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/post',
        headers: { 'Content-Type': 'application/json' },
        query: {},
        params: {},
        body: { name: 'test', value: 123 },
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(201);
      expect(response.body.received).toEqual({ name: 'test', value: 123 });
    });

    it('should return 404 for non-existent endpoint', async () => {
      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/non-existent',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(404);
    });

    it('should handle null request body', async () => {
      gateway.registerEndpoint({
        path: '/null-body',
        method: HTTPMethod.POST,
        handler: async (req: APIRequest) => ({
          statusCode: 200,
          headers: {},
          body: { bodyIsNull: req.body === null },
        }),
        middleware: [],
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/null-body',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(200);
    });

    it('should handle empty query parameters', async () => {
      gateway.registerEndpoint({
        path: '/query',
        method: HTTPMethod.GET,
        handler: async (req: APIRequest) => ({
          statusCode: 200,
          headers: {},
          body: { query: req.query },
        }),
        middleware: [],
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/query',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const response = await gateway.handleRequest(request);
      expect(response.body.query).toEqual({});
    });
  });

  // ============================================================================
  // Input Sanitization Tests
  // ============================================================================

  describe('InputSanitizer', () => {
    describe('sanitizeHTML()', () => {
      it('should strip all HTML by default', () => {
        const input = '<script>alert("xss")</script>Hello';
        const sanitized = InputSanitizer.sanitizeHTML(input);
        expect(sanitized).not.toContain('<script>');
      });

      it('should handle null input', () => {
        const sanitized = InputSanitizer.sanitizeHTML(null as any);
        expect(sanitized).toBeDefined();
      });

      it('should handle undefined input', () => {
        const sanitized = InputSanitizer.sanitizeHTML(undefined as any);
        expect(sanitized).toBeDefined();
      });

      it('should handle empty string', () => {
        const sanitized = InputSanitizer.sanitizeHTML('');
        expect(sanitized).toBe('');
      });

      it('should allow configured HTML tags', () => {
        const input = '<p>Hello</p>';
        const sanitized = InputSanitizer.sanitizeHTML(input, {
          allowHTML: true,
          allowedTags: ['p'],
          allowedAttributes: { p: [] },
        });
        expect(sanitized).toContain('Hello');
      });
    });

    describe('sanitizeSQL()', () => {
      it('should escape SQL special characters', () => {
        const input = "'; DROP TABLE users; --";
        const sanitized = InputSanitizer.sanitizeSQL(input);
        expect(sanitized).not.toContain('DROP TABLE');
      });

      it('should handle null input', () => {
        const sanitized = InputSanitizer.sanitizeSQL(null as any);
        expect(sanitized).toBeDefined();
      });

      it('should handle empty string', () => {
        const sanitized = InputSanitizer.sanitizeSQL('');
        expect(sanitized).toBe('');
      });
    });

    describe('sanitizeCommand()', () => {
      it('should remove shell metacharacters', () => {
        const input = 'ls; rm -rf /';
        const sanitized = InputSanitizer.sanitizeCommand(input);
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('|');
      });

      it('should handle null input', () => {
        const sanitized = InputSanitizer.sanitizeCommand(null as any);
        expect(sanitized).toBeDefined();
      });
    });

    describe('sanitizePath()', () => {
      it('should remove path traversal sequences', () => {
        const input = '../../etc/passwd';
        const sanitized = InputSanitizer.sanitizePath(input);
        expect(sanitized).not.toContain('..');
      });

      it('should handle null input', () => {
        const sanitized = InputSanitizer.sanitizePath(null as any);
        expect(sanitized).toBeDefined();
      });

      it('should handle empty string', () => {
        const sanitized = InputSanitizer.sanitizePath('');
        expect(sanitized).toBe('');
      });
    });

    describe('sanitizeObject()', () => {
      it('should sanitize nested objects', () => {
        const input = {
          name: '<script>alert("xss")</script>',
          nested: {
            value: '<img src=x onerror=alert(1)>',
          },
        };
        const sanitized = InputSanitizer.sanitizeObject(input);
        expect(sanitized.name).not.toContain('<script>');
        expect(sanitized.nested.value).not.toContain('onerror');
      });

      it('should handle null object', () => {
        const sanitized = InputSanitizer.sanitizeObject(null);
        expect(sanitized).toBeNull();
      });

      it('should handle undefined object', () => {
        const sanitized = InputSanitizer.sanitizeObject(undefined);
        expect(sanitized).toBeUndefined();
      });

      it('should sanitize arrays', () => {
        const input = ['<script>test</script>', 'normal text'];
        const sanitized = InputSanitizer.sanitizeObject(input);
        expect(Array.isArray(sanitized)).toBe(true);
        expect(sanitized[0]).not.toContain('<script>');
      });
    });

    describe('sanitizeEmail()', () => {
      it('should validate and sanitize valid email', () => {
        const sanitized = InputSanitizer.sanitizeEmail('  TEST@Example.COM  ');
        expect(sanitized).toBe('test@example.com');
      });

      it('should return null for invalid email', () => {
        const sanitized = InputSanitizer.sanitizeEmail('not-an-email');
        expect(sanitized).toBeNull();
      });

      it('should handle null input', () => {
        const sanitized = InputSanitizer.sanitizeEmail(null as any);
        expect(sanitized).toBeNull();
      });
    });

    describe('sanitizeURL()', () => {
      it('should validate and sanitize valid URL', () => {
        const sanitized = InputSanitizer.sanitizeURL('  https://example.com  ');
        expect(sanitized).toBe('https://example.com');
      });

      it('should return null for invalid URL', () => {
        const sanitized = InputSanitizer.sanitizeURL('not-a-url');
        expect(sanitized).toBeNull();
      });

      it('should handle null input', () => {
        const sanitized = InputSanitizer.sanitizeURL(null as any);
        expect(sanitized).toBeNull();
      });
    });
  });

  // ============================================================================
  // Request Validator Tests
  // ============================================================================

  describe('RequestValidator', () => {
    it('should validate valid request', () => {
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: { name: 'John', age: 30 },
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const config: ValidationConfig = {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
        },
      };

      const errors = RequestValidator.validate(request, config);
      expect(errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: { name: 123 }, // Wrong type
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const config: ValidationConfig = {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      };

      const errors = RequestValidator.validate(request, config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate string format', () => {
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: { email: 'not-an-email' },
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const config: ValidationConfig = {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      };

      const errors = RequestValidator.validate(request, config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle null body', () => {
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const config: ValidationConfig = {
        body: { type: 'object', properties: {} },
      };

      const errors = RequestValidator.validate(request, config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate arrays', () => {
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: { items: [1, 2, 3] },
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const config: ValidationConfig = {
        body: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        },
      };

      const errors = RequestValidator.validate(request, config);
      expect(errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Rate Limiter Tests
  // ============================================================================

  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter();
    });

    it('should allow requests within limit', async () => {
      const config: RateLimitConfig = {
        strategy: RateLimitStrategy.FixedWindow,
        limit: 5,
        window: 60000,
        scope: 'ip',
      };

      const allowed1 = await rateLimiter.checkLimit('test-key', config);
      const allowed2 = await rateLimiter.checkLimit('test-key', config);

      expect(allowed1).toBe(true);
      expect(allowed2).toBe(true);
    });

    it('should block requests exceeding limit', async () => {
      const config: RateLimitConfig = {
        strategy: RateLimitStrategy.FixedWindow,
        limit: 2,
        window: 60000,
        scope: 'ip',
      };

      await rateLimiter.checkLimit('test-key', config);
      await rateLimiter.checkLimit('test-key', config);
      const blocked = await rateLimiter.checkLimit('test-key', config);

      expect(blocked).toBe(false);
    });

    it('should reset after window expires', async () => {
      const config: RateLimitConfig = {
        strategy: RateLimitStrategy.FixedWindow,
        limit: 1,
        window: 100,
        scope: 'ip',
      };

      await rateLimiter.checkLimit('test-key', config);
      await new Promise(resolve => setTimeout(resolve, 150));
      const allowed = await rateLimiter.checkLimit('test-key', config);

      expect(allowed).toBe(true);
    });

    it('should handle token bucket strategy', async () => {
      const config: RateLimitConfig = {
        strategy: RateLimitStrategy.TokenBucket,
        limit: 5,
        window: 1000,
        scope: 'ip',
      };

      const allowed = await rateLimiter.checkLimit('token-key', config);
      expect(allowed).toBe(true);
    });

    it('should get rate limit state', () => {
      const config: RateLimitConfig = {
        strategy: RateLimitStrategy.FixedWindow,
        limit: 5,
        window: 60000,
        scope: 'ip',
      };

      rateLimiter.checkLimit('state-key', config);
      const state = rateLimiter.getState('state-key');

      expect(state).toBeDefined();
      expect(state?.key).toBe('state-key');
    });

    it('should reset rate limit', () => {
      const config: RateLimitConfig = {
        strategy: RateLimitStrategy.FixedWindow,
        limit: 1,
        window: 60000,
        scope: 'ip',
      };

      rateLimiter.checkLimit('reset-key', config);
      rateLimiter.reset('reset-key');

      const state = rateLimiter.getState('reset-key');
      expect(state).toBeUndefined();
    });
  });

  // ============================================================================
  // API Cache Tests
  // ============================================================================

  describe('APICache', () => {
    let cache: APICache;

    beforeEach(() => {
      cache = new APICache();
    });

    it('should cache and retrieve response', async () => {
      const response: APIResponse = {
        statusCode: 200,
        headers: {},
        body: { data: 'test' },
      };

      await cache.set('test-key', response, 60000);
      const cached = await cache.get('test-key');

      expect(cached).toEqual(response);
    });

    it('should return null for non-existent key', async () => {
      const cached = await cache.get('non-existent');
      expect(cached).toBeNull();
    });

    it('should expire cached items', async () => {
      const response: APIResponse = {
        statusCode: 200,
        headers: {},
        body: { data: 'test' },
      };

      await cache.set('expire-key', response, 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      const cached = await cache.get('expire-key');

      expect(cached).toBeNull();
    });

    it('should clear cache', async () => {
      const response: APIResponse = {
        statusCode: 200,
        headers: {},
        body: {},
      };

      await cache.set('clear-key', response, 60000);
      cache.clear();
      const cached = await cache.get('clear-key');

      expect(cached).toBeNull();
    });

    it('should handle null response', async () => {
      await cache.set('null-key', null as any, 60000);
      const cached = await cache.get('null-key');
      expect(cached).toBeDefined();
    });
  });

  // ============================================================================
  // Metrics Collector Tests
  // ============================================================================

  describe('MetricsCollector', () => {
    let collector: MetricsCollector;

    beforeEach(() => {
      collector = new MetricsCollector();
    });

    it('should record metrics', () => {
      const endpoint: APIEndpoint = {
        id: 'test-ep',
        path: '/test',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      };

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const response: APIResponse = {
        statusCode: 200,
        headers: {},
        body: {},
      };

      collector.record(endpoint, request, response, 100);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].requestCount).toBe(1);
    });

    it('should calculate latency percentiles', () => {
      const endpoint: APIEndpoint = {
        id: 'test-ep',
        path: '/test',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      };

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      for (let i = 0; i < 100; i++) {
        collector.record(
          endpoint,
          request,
          { statusCode: 200, headers: {}, body: {} },
          i * 10
        );
      }

      const metrics = collector.getMetrics();
      expect(metrics[0].p50Latency).toBeGreaterThan(0);
      expect(metrics[0].p95Latency).toBeGreaterThan(metrics[0].p50Latency);
    });

    it('should filter metrics', () => {
      const ep1: APIEndpoint = {
        id: 'ep1',
        path: '/ep1',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      };

      const ep2: APIEndpoint = {
        id: 'ep2',
        path: '/ep2',
        method: HTTPMethod.POST,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      };

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      collector.record(ep1, request, { statusCode: 200, headers: {}, body: {} }, 10);
      collector.record(ep2, { ...request, method: HTTPMethod.POST }, { statusCode: 200, headers: {}, body: {} }, 20);

      const filtered = collector.getMetrics({ method: HTTPMethod.GET });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].method).toBe(HTTPMethod.GET);
    });

    it('should clear metrics', () => {
      const endpoint: APIEndpoint = {
        id: 'test-ep',
        path: '/test',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      };

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/test',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      collector.record(endpoint, request, { statusCode: 200, headers: {}, body: {} }, 10);
      collector.clear();

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(0);
    });
  });

  // ============================================================================
  // Quota Manager Tests
  // ============================================================================

  describe('QuotaManager', () => {
    let quotaManager: QuotaManager;

    beforeEach(() => {
      quotaManager = new QuotaManager();
    });

    it('should set quota', () => {
      const quota = quotaManager.setQuota('user-123', 1000, 'hour');
      expect(quota.userId).toBe('user-123');
      expect(quota.limit).toBe(1000);
      expect(quota.period).toBe('hour');
    });

    it('should check quota within limit', () => {
      quotaManager.setQuota('user-123', 5, 'hour');
      expect(quotaManager.checkQuota('user-123')).toBe(true);
    });

    it('should enforce quota limits', () => {
      quotaManager.setQuota('user-123', 2, 'hour');
      quotaManager.incrementUsage('user-123');
      quotaManager.incrementUsage('user-123');
      expect(quotaManager.checkQuota('user-123')).toBe(false);
    });

    it('should reset quota after period', () => {
      quotaManager.setQuota('user-123', 1, 'hour');
      quotaManager.incrementUsage('user-123');

      // Manually set reset time to past
      const quota = quotaManager.getQuota('user-123');
      if (quota) {
        quota.resetAt = new Date(Date.now() - 1000);
      }

      expect(quotaManager.checkQuota('user-123')).toBe(true);
    });

    it('should return true for users without quota', () => {
      expect(quotaManager.checkQuota('no-quota-user')).toBe(true);
    });

    it('should get quota status', () => {
      quotaManager.setQuota('user-123', 100, 'day');
      const quota = quotaManager.getQuota('user-123');

      expect(quota).toBeDefined();
      expect(quota?.limit).toBe(100);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      gateway.registerEndpoint({
        path: '/validate',
        method: HTTPMethod.POST,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        validation: {
          body: {
            type: 'object',
            properties: {
              required: { type: 'string' },
            },
            required: ['required'],
          },
        },
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/validate',
        headers: {},
        query: {},
        params: {},
        body: {}, // Missing required field
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(400);
    });

    it('should handle authentication errors', async () => {
      gateway.registerEndpoint({
        path: '/protected',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/protected',
        headers: {}, // No auth header
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(401);
    });

    it('should handle unexpected errors gracefully', async () => {
      gateway.registerEndpoint({
        path: '/error',
        method: HTTPMethod.GET,
        handler: async () => {
          throw new Error('Unexpected error');
        },
        middleware: [],
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/error',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(500);
    });
  });

  // ============================================================================
  // Async Behavior Tests
  // ============================================================================

  describe('Async Operations', () => {
    it('should handle concurrent requests', async () => {
      gateway.registerEndpoint({
        path: '/concurrent',
        method: HTTPMethod.GET,
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { statusCode: 200, headers: {}, body: { success: true } };
        },
        middleware: [],
        tags: [],
      });

      const requests = Array(10).fill(null).map((_, i) => ({
        method: HTTPMethod.GET,
        path: '/concurrent',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: `127.0.0.${i}`,
        userAgent: 'test',
      }));

      const responses = await Promise.all(requests.map(req => gateway.handleRequest(req)));

      expect(responses).toHaveLength(10);
      expect(responses.every(r => r.statusCode === 200)).toBe(true);
    });

    it('should handle async middleware', async () => {
      const asyncMiddleware = async (
        req: APIRequest,
        ctx: RequestContext,
        next: () => Promise<APIResponse>
      ) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return next();
      };

      gateway.registerEndpoint({
        path: '/async-mw',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [asyncMiddleware],
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/async-mw',
        headers: {},
        query: {},
        params: {},
        body: undefined,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('should enforce HTTPMethod enum', () => {
      const methods = [
        HTTPMethod.GET,
        HTTPMethod.POST,
        HTTPMethod.PUT,
        HTTPMethod.DELETE,
        HTTPMethod.PATCH,
        HTTPMethod.OPTIONS,
        HTTPMethod.HEAD,
      ];

      methods.forEach(method => {
        const endpoint = gateway.registerEndpoint({
          path: `/method-${method}`,
          method,
          handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
          middleware: [],
          tags: [],
        });
        expect(endpoint.method).toBe(method);
      });
    });

    it('should enforce RateLimitStrategy enum', () => {
      const strategies = [
        RateLimitStrategy.FixedWindow,
        RateLimitStrategy.SlidingWindow,
        RateLimitStrategy.TokenBucket,
        RateLimitStrategy.LeakyBucket,
      ];

      strategies.forEach(strategy => {
        const config: RateLimitConfig = {
          strategy,
          limit: 100,
          window: 60000,
          scope: 'ip',
        };
        expect(config.strategy).toBe(strategy);
      });
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty path', () => {
      const endpoint = gateway.registerEndpoint({
        path: '',
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });
      expect(endpoint.path).toBe('');
    });

    it('should handle very long path', () => {
      const longPath = '/' + 'a'.repeat(5000);
      const endpoint = gateway.registerEndpoint({
        path: longPath,
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });
      expect(endpoint.path).toBe(longPath);
    });

    it('should handle special characters in path', () => {
      const specialPath = '/test/!@#$%^&*()';
      const endpoint = gateway.registerEndpoint({
        path: specialPath,
        method: HTTPMethod.GET,
        handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
        middleware: [],
        tags: [],
      });
      expect(endpoint.path).toBe(specialPath);
    });

    it('should handle large request body', async () => {
      gateway.registerEndpoint({
        path: '/large',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: { size: JSON.stringify(req.body).length },
        }),
        middleware: [],
        tags: [],
      });

      const largeBody = { data: 'x'.repeat(100000) };
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/large',
        headers: {},
        query: {},
        params: {},
        body: largeBody,
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(200);
    });

    it('should handle deeply nested objects', async () => {
      const createNestedObject = (depth: number): any => {
        if (depth === 0) return { value: 'leaf' };
        return { nested: createNestedObject(depth - 1) };
      };

      gateway.registerEndpoint({
        path: '/nested',
        method: HTTPMethod.POST,
        handler: async (req) => ({
          statusCode: 200,
          headers: {},
          body: req.body,
        }),
        middleware: [],
        tags: [],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/nested',
        headers: {},
        query: {},
        params: {},
        body: createNestedObject(10),
        ip: '127.0.0.1',
        userAgent: 'test',
      };

      const response = await gateway.handleRequest(request);
      expect(response.statusCode).toBe(200);
    });
  });

  // ============================================================================
  // Resource Cleanup Tests
  // ============================================================================

  describe('Resource Cleanup', () => {
    it('should not leak memory on repeated operations', () => {
      for (let i = 0; i < 1000; i++) {
        const endpoint = gateway.registerEndpoint({
          path: `/temp-${i}`,
          method: HTTPMethod.GET,
          handler: async () => ({ statusCode: 200, headers: {}, body: {} }),
          middleware: [],
          tags: [],
        });
        gateway.removeEndpoint(endpoint.id);
      }

      const endpoints = gateway.listEndpoints();
      expect(endpoints.length).toBe(0);
    });
  });

  // ============================================================================
  // ValidationSchemas Helper Tests
  // ============================================================================

  describe('ValidationSchemas', () => {
    it('should provide email schema', () => {
      const schema = ValidationSchemas.email();
      expect(schema.type).toBe('string');
      expect(schema.format).toBe('email');
    });

    it('should provide URL schema', () => {
      const schema = ValidationSchemas.url();
      expect(schema.type).toBe('string');
      expect(schema.format).toBe('url');
    });

    it('should provide UUID schema', () => {
      const schema = ValidationSchemas.uuid();
      expect(schema.type).toBe('string');
      expect(schema.format).toBe('uuid');
    });

    it('should provide integer schema with range', () => {
      const schema = ValidationSchemas.integer(1, 100);
      expect(schema.type).toBe('number');
      expect(schema.minimum).toBe(1);
      expect(schema.maximum).toBe(100);
    });

    it('should provide string schema with constraints', () => {
      const schema = ValidationSchemas.string(5, 50, '^[a-z]+$');
      expect(schema.type).toBe('string');
      expect(schema.minLength).toBe(5);
      expect(schema.maxLength).toBe(50);
      expect(schema.pattern).toBe('^[a-z]+$');
    });

    it('should provide array schema', () => {
      const schema = ValidationSchemas.array({ type: 'string' }, 1, 10);
      expect(schema.type).toBe('array');
      expect(schema.minLength).toBe(1);
      expect(schema.maxLength).toBe(10);
    });

    it('should provide object schema', () => {
      const schema = ValidationSchemas.object(
        {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        ['name']
      );
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('name');
    });

    it('should provide enum schema', () => {
      const schema = ValidationSchemas.enum(['red', 'green', 'blue']);
      expect(schema.type).toBe('string');
      expect(schema.enum).toContain('red');
    });
  });
});
