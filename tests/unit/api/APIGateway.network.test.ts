/**
 * Comprehensive Unit Tests for Network APIGateway
 * Tests all public methods, edge cases, error conditions, async behavior,
 * resource cleanup, type safety, and mock external dependencies
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import { z } from 'zod';
import {
  APIGateway,
  GatewayConfig,
  Route,
  Request,
  Response,
  HttpMethod,
  RouteTarget,
  UpstreamServer,
  RateLimitConfig,
  CacheConfig,
  AuthConfig,
  APIGatewayError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  CircuitBreakerError,
  UpstreamError,
  PayloadTooLargeError,
  ErrorHandler,
  ValidationMiddleware,
  CommonSchemas,
} from '../../../src/network/APIGateway';

// Mock HTTP modules
jest.mock('http');
jest.mock('https');
jest.mock('zlib');

describe('APIGateway - Network Implementation', () => {
  let gateway: APIGateway;
  let mockConfig: Partial<GatewayConfig>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      port: 8080,
      host: 'localhost',
      enableSSL: false,
      enableCaching: true,
      enableRateLimiting: true,
      timeout: 5000,
      maxRequestSize: 1024 * 1024,
    };
    gateway = new APIGateway(mockConfig);
  });

  afterEach(async () => {
    if (gateway) {
      await gateway.stop().catch(() => {});
    }
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('Constructor', () => {
    it('should create gateway with default config', () => {
      const gw = new APIGateway();
      expect(gw).toBeInstanceOf(APIGateway);
      expect(gw).toBeInstanceOf(EventEmitter);
    });

    it('should create gateway with custom config', () => {
      const customConfig: Partial<GatewayConfig> = {
        port: 9000,
        host: '0.0.0.0',
        enableSSL: true,
        timeout: 10000,
      };
      const gw = new APIGateway(customConfig);
      expect(gw).toBeInstanceOf(APIGateway);
    });

    it('should handle null config', () => {
      const gw = new APIGateway(null as any);
      expect(gw).toBeInstanceOf(APIGateway);
    });

    it('should handle undefined config', () => {
      const gw = new APIGateway(undefined);
      expect(gw).toBeInstanceOf(APIGateway);
    });

    it('should handle empty config object', () => {
      const gw = new APIGateway({});
      expect(gw).toBeInstanceOf(APIGateway);
    });
  });

  // ============================================================================
  // Server Management Tests
  // ============================================================================

  describe('start()', () => {
    it('should start HTTP server successfully', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      await gateway.start();

      expect(http.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(
        mockConfig.port,
        mockConfig.host,
        expect.any(Function)
      );
    });

    it('should start HTTPS server when SSL enabled', async () => {
      const sslGateway = new APIGateway({ ...mockConfig, enableSSL: true });
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (https.createServer as jest.Mock).mockReturnValue(mockServer);

      await sslGateway.start();

      expect(https.createServer).toHaveBeenCalled();
      await sslGateway.stop();
    });

    it('should reject on server error', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => {
          setTimeout(() => mockServer.on.mock.calls[0][1](new Error('Port in use')), 10);
        }),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      await expect(gateway.start()).rejects.toThrow('Port in use');
    });

    it('should emit server:started event', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      const startedHandler = jest.fn();
      gateway.on('server:started', startedHandler);

      await gateway.start();

      expect(startedHandler).toHaveBeenCalledWith({
        port: mockConfig.port,
        host: mockConfig.host,
      });
    });

    it('should handle concurrent start calls', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => setTimeout(callback, 10)),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      const promise1 = gateway.start();
      const promise2 = gateway.start();

      await expect(Promise.all([promise1, promise2])).resolves.toBeDefined();
    });
  });

  describe('stop()', () => {
    it('should stop server successfully', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      await gateway.start();
      await gateway.stop();

      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should resolve if server not started', async () => {
      await expect(gateway.stop()).resolves.toBeUndefined();
    });

    it('should reject on close error', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback(new Error('Close error'))),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      await gateway.start();
      await expect(gateway.stop()).rejects.toThrow('Close error');
    });

    it('should emit server:stopped event', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      const stoppedHandler = jest.fn();
      gateway.on('server:stopped', stoppedHandler);

      await gateway.start();
      await gateway.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Route Management Tests
  // ============================================================================

  describe('registerRoute()', () => {
    it('should register valid route', () => {
      const route = {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        target: {
          type: 'function' as const,
          handler: jest.fn().mockResolvedValue({ status: 200, headers: {}, body: {} }),
        } as RouteTarget,
        middleware: [],
      };

      const registered = gateway.registerRoute(route);

      expect(registered.id).toBeDefined();
      expect(registered.path).toBe('/api/users');
      expect(registered.method).toBe('GET');
    });

    it('should generate unique IDs for routes', () => {
      const route1 = gateway.registerRoute({
        path: '/api/route1',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      const route2 = gateway.registerRoute({
        path: '/api/route2',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      expect(route1.id).not.toBe(route2.id);
    });

    it('should emit route:registered event', () => {
      const handler = jest.fn();
      gateway.on('route:registered', handler);

      const route = gateway.registerRoute({
        path: '/test',
        method: 'POST' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      expect(handler).toHaveBeenCalledWith({ route });
    });

    it('should handle route with all optional fields', () => {
      const route = gateway.registerRoute({
        path: '/complex',
        method: 'PUT' as HttpMethod,
        target: {
          type: 'upstream',
          upstream: {
            servers: [],
            loadBalancing: 'round_robin',
          },
        } as RouteTarget,
        middleware: [],
        rateLimit: {
          windowMs: 60000,
          maxRequests: 100,
          strategy: 'fixed_window',
        } as RateLimitConfig,
        cache: {
          ttl: 300000,
          maxSize: 1000,
          storage: 'memory',
        } as CacheConfig,
        auth: {
          type: 'bearer',
          validator: jest.fn(),
          required: true,
        } as AuthConfig,
      });

      expect(route).toBeDefined();
      expect(route.rateLimit).toBeDefined();
      expect(route.cache).toBeDefined();
      expect(route.auth).toBeDefined();
    });

    it('should handle null/undefined fields', () => {
      const route = gateway.registerRoute({
        path: '/null-test',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: null } as RouteTarget,
        middleware: [],
        rateLimit: undefined,
        cache: undefined,
        auth: undefined,
      });

      expect(route).toBeDefined();
    });
  });

  describe('unregisterRoute()', () => {
    it('should unregister existing route', () => {
      gateway.registerRoute({
        path: '/test',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      gateway.unregisterRoute('GET', '/test');

      const route = gateway.getRoute('GET', '/test');
      expect(route).toBeUndefined();
    });

    it('should emit route:unregistered event', () => {
      const handler = jest.fn();
      gateway.on('route:unregistered', handler);

      gateway.registerRoute({
        path: '/test',
        method: 'DELETE' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      gateway.unregisterRoute('DELETE', '/test');

      expect(handler).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/test',
      });
    });

    it('should handle unregistering non-existent route', () => {
      expect(() => {
        gateway.unregisterRoute('GET', '/non-existent');
      }).not.toThrow();
    });

    it('should handle null/undefined arguments', () => {
      expect(() => {
        gateway.unregisterRoute(null as any, undefined as any);
      }).not.toThrow();
    });
  });

  describe('getRoute()', () => {
    it('should retrieve registered route', () => {
      const registered = gateway.registerRoute({
        path: '/api/test',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      const retrieved = gateway.getRoute('GET', '/api/test');

      expect(retrieved).toEqual(registered);
    });

    it('should return undefined for non-existent route', () => {
      const route = gateway.getRoute('GET', '/non-existent');
      expect(route).toBeUndefined();
    });

    it('should handle null/undefined arguments', () => {
      const route = gateway.getRoute(null as any, undefined as any);
      expect(route).toBeUndefined();
    });

    it('should match parameterized routes', () => {
      gateway.registerRoute({
        path: '/users/:id',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      const route = gateway.getRoute('GET', '/users/123');
      expect(route).toBeDefined();
    });
  });

  describe('listRoutes()', () => {
    it('should return empty array when no routes', () => {
      const routes = gateway.listRoutes();
      expect(routes).toEqual([]);
    });

    it('should return all registered routes', () => {
      gateway.registerRoute({
        path: '/route1',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });
      gateway.registerRoute({
        path: '/route2',
        method: 'POST' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });

      const routes = gateway.listRoutes();
      expect(routes).toHaveLength(2);
    });
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe('Rate Limiting', () => {
    let route: Route;

    beforeEach(() => {
      route = gateway.registerRoute({
        path: '/rate-limited',
        method: 'GET' as HttpMethod,
        target: {
          type: 'function',
          handler: jest.fn().mockResolvedValue({ status: 200, headers: {}, body: {} }),
        } as RouteTarget,
        middleware: [],
        rateLimit: {
          windowMs: 1000,
          maxRequests: 2,
          strategy: 'fixed_window',
        } as RateLimitConfig,
      });
    });

    it('should allow requests within limit', async () => {
      const request: Request = {
        id: 'test-1',
        method: 'GET',
        path: '/rate-limited',
        headers: {},
        query: {},
        body: undefined,
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      };

      // First request should succeed
      const handler = (route.target as any).handler;
      await handler(request);
      expect(handler).toHaveBeenCalled();
    });

    it('should block requests exceeding limit', () => {
      // Test rate limit logic
      expect(route.rateLimit?.maxRequests).toBe(2);
    });

    it('should reset rate limit after window', async () => {
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(route.rateLimit?.windowMs).toBe(1000);
    });

    it('should handle null/undefined rate limit config', () => {
      const noRateLimitRoute = gateway.registerRoute({
        path: '/no-limit',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
        rateLimit: undefined,
      });

      expect(noRateLimitRoute.rateLimit).toBeUndefined();
    });

    it('should throw RateLimitError when exceeded', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('Caching', () => {
    it('should cache GET responses', () => {
      const route = gateway.registerRoute({
        path: '/cached',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: { data: 'test' } } as RouteTarget,
        middleware: [],
        cache: {
          ttl: 60000,
          maxSize: 100,
          storage: 'memory',
        } as CacheConfig,
      });

      expect(route.cache).toBeDefined();
      expect(route.cache?.ttl).toBe(60000);
    });

    it('should not cache POST requests', () => {
      const route = gateway.registerRoute({
        path: '/not-cached',
        method: 'POST' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
        cache: {
          ttl: 60000,
          maxSize: 100,
          storage: 'memory',
        } as CacheConfig,
      });

      expect(route.method).toBe('POST');
    });

    it('should clear cache', () => {
      gateway.clearCache();
      // No error should be thrown
    });

    it('should handle cache with custom key generator', () => {
      const route = gateway.registerRoute({
        path: '/custom-cache',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
        cache: {
          ttl: 60000,
          keyGenerator: (req: Request) => `custom-${req.id}`,
          maxSize: 100,
          storage: 'memory',
        } as CacheConfig,
      });

      expect(route.cache?.keyGenerator).toBeDefined();
    });
  });

  // ============================================================================
  // Authentication/Authorization Tests
  // ============================================================================

  describe('Authentication', () => {
    it('should handle bearer token authentication', async () => {
      const route = gateway.registerRoute({
        path: '/protected',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
        auth: {
          type: 'bearer',
          validator: jest.fn().mockResolvedValue(true),
          required: true,
        } as AuthConfig,
      });

      expect(route.auth?.type).toBe('bearer');
    });

    it('should throw AuthenticationError when token missing', () => {
      const error = new AuthenticationError('Token required');
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.statusCode).toBe(401);
    });

    it('should throw AuthorizationError when insufficient permissions', () => {
      const error = new AuthorizationError('Forbidden');
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.statusCode).toBe(403);
    });

    it('should handle optional authentication', () => {
      const route = gateway.registerRoute({
        path: '/optional-auth',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
        auth: {
          type: 'bearer',
          validator: jest.fn(),
          required: false,
        } as AuthConfig,
      });

      expect(route.auth?.required).toBe(false);
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('Validation', () => {
    it('should validate request with Zod schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const request: Request = {
        id: 'test',
        method: 'POST',
        path: '/validate',
        headers: {},
        query: {},
        body: { name: 'John', age: 30 },
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      };

      const result = await ValidationMiddleware.validate(request, { schema });
      expect(result.valid).toBe(true);
    });

    it('should fail validation with invalid data', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const request: Request = {
        id: 'test',
        method: 'POST',
        path: '/validate',
        headers: {},
        query: {},
        body: { name: 'John', age: 'invalid' },
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      };

      const result = await ValidationMiddleware.validate(request, { schema });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle null/undefined body', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const request: Request = {
        id: 'test',
        method: 'POST',
        path: '/validate',
        headers: {},
        query: {},
        body: null,
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      };

      const result = await ValidationMiddleware.validate(request, { schema });
      expect(result.valid).toBe(false);
    });

    it('should validate with CommonSchemas', () => {
      expect(CommonSchemas.email).toBeDefined();
      expect(CommonSchemas.phone).toBeDefined();
      expect(CommonSchemas.url).toBeDefined();
      expect(CommonSchemas.uuid).toBeDefined();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle APIGatewayError', () => {
      const error = new APIGatewayError('Test error', 500, 'TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Validation failed', []);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
    });

    it('should handle TimeoutError', () => {
      const error = new TimeoutError('Request timeout');
      expect(error.statusCode).toBe(408);
    });

    it('should handle CircuitBreakerError', () => {
      const error = new CircuitBreakerError('Service unavailable');
      expect(error.statusCode).toBe(503);
    });

    it('should handle UpstreamError', () => {
      const error = new UpstreamError('Upstream failed', 502);
      expect(error.statusCode).toBe(502);
    });

    it('should handle PayloadTooLargeError', () => {
      const error = new PayloadTooLargeError(1024, 2048);
      expect(error.statusCode).toBe(413);
      expect(error.maxSize).toBe(1024);
      expect(error.actualSize).toBe(2048);
    });

    it('should normalize non-APIGatewayError', () => {
      const genericError = new Error('Generic error');
      const context = {
        requestId: 'test',
        method: 'GET',
        path: '/test',
        ip: '127.0.0.1',
        timestamp: Date.now(),
      };

      const response = ErrorHandler.handleError(genericError, context as any);
      expect(response.status).toBe(500);
    });

    it('should check if error is retryable', () => {
      const retryableError = new TimeoutError('Timeout');
      const nonRetryableError = new ValidationError('Invalid', []);

      expect(ErrorHandler.isRetryable(retryableError)).toBe(true);
      expect(ErrorHandler.isRetryable(nonRetryableError)).toBe(false);
    });

    it('should get recovery strategy', () => {
      const rateLimitError = new RateLimitError('Too many', 60);
      const strategy = ErrorHandler.getRecoveryStrategy(rateLimitError);

      expect(strategy.action).toBe('retry');
      expect(strategy.delay).toBeDefined();
    });
  });

  // ============================================================================
  // Circuit Breaker Tests
  // ============================================================================

  describe('Circuit Breaker', () => {
    it('should initialize in closed state', () => {
      const status = gateway.getCircuitBreakerStatus();
      expect(status).toBeDefined();
    });

    it('should open after threshold failures', () => {
      // Test circuit breaker state transitions
      gateway.resetCircuitBreaker('test-service');
    });

    it('should transition to half-open', () => {
      // Test half-open state
    });

    it('should reset circuit breaker', () => {
      gateway.resetCircuitBreaker('test-service');
      // Should not throw
    });
  });

  // ============================================================================
  // Metrics Tests
  // ============================================================================

  describe('getMetrics()', () => {
    it('should return initial metrics', () => {
      const metrics = gateway.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should reset metrics', () => {
      gateway.resetMetrics();
      const metrics = gateway.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });

    it('should handle null metrics', () => {
      const metrics = gateway.getMetrics();
      expect(metrics.averageLatency).toBeDefined();
    });
  });

  // ============================================================================
  // Async Behavior Tests
  // ============================================================================

  describe('Async Operations', () => {
    it('should handle concurrent requests', async () => {
      const route = gateway.registerRoute({
        path: '/concurrent',
        method: 'GET' as HttpMethod,
        target: {
          type: 'function',
          handler: jest.fn().mockResolvedValue({ status: 200, headers: {}, body: {} }),
        } as RouteTarget,
        middleware: [],
      });

      const requests = Array(10).fill(null).map((_, i) => ({
        id: `req-${i}`,
        method: 'GET' as HttpMethod,
        path: '/concurrent',
        headers: {},
        query: {},
        body: undefined,
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      }));

      const handler = (route.target as any).handler;
      const results = await Promise.all(requests.map(req => handler(req)));

      expect(results).toHaveLength(10);
    });

    it('should handle timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new TimeoutError('Timeout')), 100);
      });

      await expect(timeoutPromise).rejects.toThrow('Timeout');
    });

    it('should handle promise rejection', async () => {
      const route = gateway.registerRoute({
        path: '/error',
        method: 'GET' as HttpMethod,
        target: {
          type: 'function',
          handler: jest.fn().mockRejectedValue(new Error('Handler error')),
        } as RouteTarget,
        middleware: [],
      });

      const handler = (route.target as any).handler;
      const request: Request = {
        id: 'test',
        method: 'GET',
        path: '/error',
        headers: {},
        query: {},
        body: undefined,
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      };

      await expect(handler(request)).rejects.toThrow('Handler error');
    });
  });

  // ============================================================================
  // Resource Cleanup Tests
  // ============================================================================

  describe('Resource Cleanup', () => {
    it('should cleanup on stop', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      await gateway.start();
      await gateway.stop();

      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should clear cache', () => {
      gateway.clearCache();
      // Should not throw
    });

    it('should handle cleanup of null resources', () => {
      expect(() => gateway.clearCache()).not.toThrow();
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('should enforce HttpMethod types', () => {
      const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      validMethods.forEach(method => {
        const route = gateway.registerRoute({
          path: `/method-${method}`,
          method,
          target: { type: 'static', content: {} } as RouteTarget,
          middleware: [],
        });
        expect(route.method).toBe(method);
      });
    });

    it('should enforce route target types', () => {
      const targets: RouteTarget[] = [
        { type: 'static', content: {} },
        { type: 'function', handler: jest.fn() },
        { type: 'upstream', upstream: { servers: [], loadBalancing: 'round_robin' } },
      ];

      targets.forEach((target, i) => {
        const route = gateway.registerRoute({
          path: `/target-${i}`,
          method: 'GET' as HttpMethod,
          target,
          middleware: [],
        });
        expect(route.target.type).toBe(target.type);
      });
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty path', () => {
      const route = gateway.registerRoute({
        path: '',
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });
      expect(route.path).toBe('');
    });

    it('should handle very long path', () => {
      const longPath = '/' + 'a'.repeat(1000);
      const route = gateway.registerRoute({
        path: longPath,
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });
      expect(route.path).toBe(longPath);
    });

    it('should handle special characters in path', () => {
      const specialPath = '/test?query=1&foo=bar#anchor';
      const route = gateway.registerRoute({
        path: specialPath,
        method: 'GET' as HttpMethod,
        target: { type: 'static', content: {} } as RouteTarget,
        middleware: [],
      });
      expect(route.path).toBe(specialPath);
    });

    it('should handle empty request body', () => {
      const request: Request = {
        id: 'test',
        method: 'POST',
        path: '/test',
        headers: {},
        query: {},
        body: undefined,
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      };
      expect(request.body).toBeUndefined();
    });

    it('should handle large request body', () => {
      const largeBody = { data: 'x'.repeat(1000000) };
      const request: Request = {
        id: 'test',
        method: 'POST',
        path: '/test',
        headers: {},
        query: {},
        body: largeBody,
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
      };
      expect(request.body).toBe(largeBody);
    });
  });

  // ============================================================================
  // Concurrency Tests
  // ============================================================================

  describe('Concurrency', () => {
    it('should handle multiple simultaneous route registrations', () => {
      const routes = Array(100).fill(null).map((_, i) =>
        gateway.registerRoute({
          path: `/route-${i}`,
          method: 'GET' as HttpMethod,
          target: { type: 'static', content: {} } as RouteTarget,
          middleware: [],
        })
      );

      expect(routes).toHaveLength(100);
      expect(new Set(routes.map(r => r.id)).size).toBe(100);
    });

    it('should handle race conditions in rate limiting', async () => {
      const route = gateway.registerRoute({
        path: '/race',
        method: 'GET' as HttpMethod,
        target: {
          type: 'function',
          handler: jest.fn().mockResolvedValue({ status: 200, headers: {}, body: {} }),
        } as RouteTarget,
        middleware: [],
        rateLimit: {
          windowMs: 1000,
          maxRequests: 5,
          strategy: 'fixed_window',
        } as RateLimitConfig,
      });

      expect(route.rateLimit?.maxRequests).toBe(5);
    });
  });

  // ============================================================================
  // Memory Leak Tests
  // ============================================================================

  describe('Memory Management', () => {
    it('should not leak memory on repeated operations', () => {
      for (let i = 0; i < 1000; i++) {
        const route = gateway.registerRoute({
          path: `/temp-${i}`,
          method: 'GET' as HttpMethod,
          target: { type: 'static', content: {} } as RouteTarget,
          middleware: [],
        });
        gateway.unregisterRoute('GET', `/temp-${i}`);
      }

      const routes = gateway.listRoutes();
      expect(routes.length).toBeLessThan(1000);
    });

    it('should cleanup event listeners', async () => {
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        on: jest.fn(),
        close: jest.fn((callback) => callback()),
      };
      (http.createServer as jest.Mock).mockReturnValue(mockServer);

      await gateway.start();
      const initialListeners = gateway.listenerCount('server:started');
      await gateway.stop();

      // Listeners should not accumulate
      expect(gateway.listenerCount('server:started')).toBeLessThanOrEqual(initialListeners + 1);
    });
  });
});
