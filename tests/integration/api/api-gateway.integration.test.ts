/**
 * API Gateway Integration Tests
 * Tests real API flows, authentication, rate limiting, and error handling
 */

import {
  APIGateway,
  APIRequest,
  HTTPMethod,
  RateLimitStrategy,
  ValidationSchemas,
  InputSanitizer,
} from '../../../src/api/APIGateway';
import {
  AuthenticationSystem,
  RBACSystem,
  AuditLogger,
} from '../../../src/security/MEGA_SecurityAuthentication';
import { eventBus } from '../../../src/core/EventBus';

describe('API Gateway Integration Tests', () => {
  let gateway: APIGateway;
  let authSystem: AuthenticationSystem;
  let rbacSystem: RBACSystem;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    authSystem = new AuthenticationSystem();
    rbacSystem = new RBACSystem();
    auditLogger = new AuditLogger();
    gateway = new APIGateway(authSystem, rbacSystem, auditLogger, {
      enableErrorHandling: true,
      errorHandlingOptions: {
        timeout: 5000,
        retry: { maxAttempts: 3, initialDelay: 100 },
        includeStackTrace: false,
        enableCircuitBreaker: true,
      },
    });
  });

  afterEach(() => {
    // Clear any registered endpoints
    const endpoints = gateway.listEndpoints();
    endpoints.forEach(e => gateway.removeEndpoint(e.id));
  });

  describe('End-to-End Request Flow', () => {
    it('should handle complete authenticated request with validation', async () => {
      // Register user
      const user = await authSystem.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      // Assign role
      rbacSystem.assignRole(user.id, 'user');

      // Login to get token
      const session = await authSystem.login('testuser', 'SecurePass123!');

      // Register endpoint with validation
      gateway.registerEndpoint({
        path: '/api/users/:userId',
        method: HTTPMethod.GET,
        handler: async (request, context) => {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
              userId: request.params.userId,
              requestId: context.requestId,
            },
          };
        },
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        authorization: {
          roles: ['user', 'admin'],
        },
        validation: {
          params: {
            type: 'object',
            properties: {
              userId: ValidationSchemas.uuid(),
            },
            required: ['userId'],
          },
        },
        tags: ['users'],
      });

      // Make authenticated request
      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: `/api/users/${user.id}`,
        headers: {
          authorization: `Bearer ${session.token}`,
        },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
        userAgent: 'test-client',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.userId).toBe(user.id);
      expect(response.body.requestId).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      gateway.registerEndpoint({
        path: '/api/protected',
        method: HTTPMethod.GET,
        handler: async () => ({
          statusCode: 200,
          headers: {},
          body: { data: 'secret' },
        }),
        middleware: [],
        authentication: {
          type: 'bearer',
          required: true,
        },
        tags: ['protected'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/protected',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Multi-Module Interactions', () => {
    it('should integrate authentication, authorization, and audit logging', async () => {
      const auditLogs: any[] = [];

      // Register user with admin role
      const admin = await authSystem.register({
        username: 'admin',
        email: 'admin@example.com',
        password: 'AdminPass123!',
      });
      rbacSystem.assignRole(admin.id, 'admin');

      const session = await authSystem.login('admin', 'AdminPass123!');

      // Register admin-only endpoint
      gateway.registerEndpoint({
        path: '/api/admin/users',
        method: HTTPMethod.POST,
        handler: async (request) => ({
          statusCode: 201,
          headers: { 'Content-Type': 'application/json' },
          body: { user: request.body },
        }),
        middleware: [],
        authentication: { type: 'bearer', required: true },
        authorization: { roles: ['admin'] },
        validation: {
          body: {
            type: 'object',
            properties: {
              username: ValidationSchemas.string(3, 50),
              email: ValidationSchemas.email(),
            },
            required: ['username', 'email'],
          },
        },
        tags: ['admin'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/admin/users',
        headers: { authorization: `Bearer ${session.token}` },
        query: {},
        params: {},
        body: {
          username: 'newuser',
          email: 'newuser@example.com',
        },
        ip: '192.168.1.100',
        userAgent: 'admin-client',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.user.username).toBe('newuser');

      // Verify audit logs were created
      const logs = auditLogger.getRecentLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.action === 'login')).toBe(true);
    });

    it('should handle concurrent requests with rate limiting', async () => {
      const user = await authSystem.register({
        username: 'ratelimituser',
        email: 'rate@example.com',
        password: 'Pass123!',
      });
      const session = await authSystem.login('ratelimituser', 'Pass123!');

      gateway.registerEndpoint({
        path: '/api/limited',
        method: HTTPMethod.GET,
        handler: async () => ({
          statusCode: 200,
          headers: {},
          body: { data: 'success' },
        }),
        middleware: [],
        authentication: { type: 'bearer', required: true },
        rateLimit: {
          strategy: RateLimitStrategy.FixedWindow,
          limit: 5,
          window: 1000, // 5 requests per second
        },
        tags: ['rate-limited'],
      });

      const makeRequest = () => {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/limited',
          headers: { authorization: `Bearer ${session.token}` },
          query: {},
          params: {},
          body: null,
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      };

      // Make 10 concurrent requests
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => makeRequest())
      );

      const successCount = responses.filter(r => r.statusCode === 200).length;
      const rateLimitedCount = responses.filter(r => r.statusCode === 429).length;

      expect(successCount).toBe(5);
      expect(rateLimitedCount).toBe(5);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors through middleware chain', async () => {
      const errorLogs: any[] = [];

      gateway.use(async (request, context, next) => {
        try {
          return await next();
        } catch (error) {
          errorLogs.push({ middleware: 'global', error });
          throw error;
        }
      });

      gateway.registerEndpoint({
        path: '/api/error',
        method: HTTPMethod.GET,
        handler: async () => {
          throw new Error('Handler error');
        },
        middleware: [
          async (request, context, next) => {
            try {
              return await next();
            } catch (error) {
              errorLogs.push({ middleware: 'endpoint', error });
              throw error;
            }
          },
        ],
        tags: ['error-test'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/error',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(500);
      expect(errorLogs.length).toBeGreaterThan(0);

      // Verify error metrics
      const errorMetrics = gateway.getErrorMetrics();
      expect(errorMetrics.length).toBeGreaterThan(0);
    });

    it('should handle validation errors gracefully', async () => {
      gateway.registerEndpoint({
        path: '/api/validate',
        method: HTTPMethod.POST,
        handler: async (request) => ({
          statusCode: 200,
          headers: {},
          body: request.body,
        }),
        middleware: [],
        validation: {
          body: {
            type: 'object',
            properties: {
              email: ValidationSchemas.email(),
              age: ValidationSchemas.integer(0, 150),
            },
            required: ['email', 'age'],
          },
        },
        tags: ['validation'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/validate',
        headers: {},
        query: {},
        params: {},
        body: {
          email: 'invalid-email',
          age: 200,
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toBeDefined();
      expect(response.body.error.details.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts', async () => {
      gateway.registerEndpoint({
        path: '/api/comments',
        method: HTTPMethod.POST,
        handler: async (request) => ({
          statusCode: 201,
          headers: {},
          body: { comment: request.body.text },
        }),
        middleware: [],
        tags: ['comments'],
      });

      const xssPayload = '<script>alert("XSS")</script>Hello';
      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/comments',
        headers: {},
        query: {},
        params: {},
        body: { text: xssPayload },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.comment).not.toContain('<script>');
    });

    it('should sanitize SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const sanitized = InputSanitizer.sanitizeSQL(sqlInjection);

      expect(sanitized).not.toContain('DROP TABLE');
      expect(sanitized).toContain("''");
    });

    it('should sanitize command injection attempts', () => {
      const commandInjection = 'test; rm -rf /';
      const sanitized = InputSanitizer.sanitizeCommand(commandInjection);

      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('|');
    });

    it('should sanitize path traversal attempts', () => {
      const pathTraversal = '../../etc/passwd';
      const sanitized = InputSanitizer.sanitizePath(pathTraversal);

      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toStartWith('/');
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker after multiple failures', async () => {
      let callCount = 0;

      const unreliableService = async () => {
        callCount++;
        throw new Error('Service unavailable');
      };

      // Execute multiple times to trigger circuit breaker
      const attempts = 10;
      const results = [];

      for (let i = 0; i < attempts; i++) {
        try {
          await gateway.executeWithCircuitBreaker(
            'unreliable-service',
            unreliableService,
            { failureThreshold: 3, resetTimeout: 5000 }
          );
          results.push('success');
        } catch (error) {
          results.push('failure');
        }
      }

      // Circuit breaker should open after threshold
      expect(callCount).toBeLessThan(attempts);

      const breaker = gateway.getCircuitBreakerManager().getBreaker('unreliable-service');
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;

      const flakyOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
        }
        return 'success';
      };

      const result = await gateway.executeWithRetry(flakyOperation, {
        maxAttempts: 5,
        initialDelay: 10,
        maxDelay: 100,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect request metrics', async () => {
      gateway.registerEndpoint({
        path: '/api/metrics-test',
        method: HTTPMethod.GET,
        handler: async () => ({
          statusCode: 200,
          headers: {},
          body: { data: 'test' },
        }),
        middleware: [],
        tags: ['metrics'],
      });

      // Make multiple requests
      for (let i = 0; i < 10; i++) {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/metrics-test',
          headers: {},
          query: {},
          params: {},
          body: null,
          ip: '192.168.1.1',
        };
        await gateway.handleRequest(request);
      }

      const metrics = gateway.getMetrics({ endpoint: '/api/metrics-test' });

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].requestCount).toBe(10);
      expect(metrics[0].averageLatency).toBeGreaterThan(0);
      expect(metrics[0].p50Latency).toBeDefined();
      expect(metrics[0].p95Latency).toBeDefined();
      expect(metrics[0].p99Latency).toBeDefined();
    });
  });

  describe('Event Bus Integration', () => {
    it('should emit events for request lifecycle', async () => {
      const events: any[] = [];

      eventBus.on('api.request_received', (data) => events.push({ type: 'received', data }));
      eventBus.on('api.request_completed', (data) => events.push({ type: 'completed', data }));

      gateway.registerEndpoint({
        path: '/api/events',
        method: HTTPMethod.GET,
        handler: async () => ({
          statusCode: 200,
          headers: {},
          body: { data: 'test' },
        }),
        middleware: [],
        tags: ['events'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/events',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      await gateway.handleRequest(request);

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.some(e => e.type === 'received')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);

      // Cleanup
      eventBus.removeAllListeners('api.request_received');
      eventBus.removeAllListeners('api.request_completed');
    });
  });

  describe('Caching Integration', () => {
    it('should cache GET responses', async () => {
      let handlerCallCount = 0;

      gateway.registerEndpoint({
        path: '/api/cached',
        method: HTTPMethod.GET,
        handler: async () => {
          handlerCallCount++;
          return {
            statusCode: 200,
            headers: {},
            body: { data: 'cached-data', timestamp: Date.now() },
          };
        },
        middleware: [],
        caching: {
          enabled: true,
          ttl: 5000,
        },
        tags: ['cached'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/cached',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      // First request
      const response1 = await gateway.handleRequest(request);
      expect(response1.statusCode).toBe(200);
      expect(handlerCallCount).toBe(1);

      // Second request (should be cached)
      const response2 = await gateway.handleRequest(request);
      expect(response2.statusCode).toBe(200);
      expect(handlerCallCount).toBe(1); // Handler not called again

      // Responses should be identical
      expect(response1.body.timestamp).toBe(response2.body.timestamp);
    });
  });
});
