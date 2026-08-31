/**
 * External API Integration Tests
 * Tests real API calls to external services (mocked for testing)
 */

import { APIGateway, APIRequest, HTTPMethod } from '../../../src/api/APIGateway';
import { CircuitBreaker } from '../../../src/api/ErrorHandling';

// Mock HTTP client for external API calls
class MockHTTPClient {
  private baseURL: string;
  private failureRate: number = 0;
  private latency: number = 0;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setFailureRate(rate: number) {
    this.failureRate = rate;
  }

  setLatency(ms: number) {
    this.latency = ms;
  }

  async get(path: string, options?: any): Promise<any> {
    await this.simulateLatency();

    if (Math.random() < this.failureRate) {
      throw new Error('Network error');
    }

    return {
      status: 200,
      data: { path, method: 'GET', ...options },
    };
  }

  async post(path: string, data: any, options?: any): Promise<any> {
    await this.simulateLatency();

    if (Math.random() < this.failureRate) {
      throw new Error('Network error');
    }

    return {
      status: 201,
      data: { path, method: 'POST', body: data, ...options },
    };
  }

  async put(path: string, data: any, options?: any): Promise<any> {
    await this.simulateLatency();

    if (Math.random() < this.failureRate) {
      throw new Error('Network error');
    }

    return {
      status: 200,
      data: { path, method: 'PUT', body: data, ...options },
    };
  }

  async delete(path: string, options?: any): Promise<any> {
    await this.simulateLatency();

    if (Math.random() < this.failureRate) {
      throw new Error('Network error');
    }

    return {
      status: 204,
      data: null,
    };
  }

  private async simulateLatency() {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }
  }
}

describe('External API Integration Tests', () => {
  let gateway: APIGateway;
  let externalAPI: MockHTTPClient;

  beforeEach(() => {
    gateway = new APIGateway(undefined, undefined, undefined, {
      enableErrorHandling: true,
      errorHandlingOptions: {
        timeout: 5000,
        retry: { maxAttempts: 3, initialDelay: 100 },
        enableCircuitBreaker: true,
      },
    });
    externalAPI = new MockHTTPClient('https://api.example.com');
  });

  describe('Real API Calls', () => {
    it('should proxy requests to external API', async () => {
      gateway.registerEndpoint({
        path: '/api/external/users/:id',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { id } = request.params;

          const response = await externalAPI.get(`/users/${id}`, {
            headers: request.headers,
          });

          return {
            statusCode: response.status,
            headers: { 'Content-Type': 'application/json' },
            body: response.data,
          };
        },
        middleware: [],
        tags: ['proxy'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/external/users/123',
        headers: { 'X-Request-ID': 'test-123' },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.path).toBe('/users/123');
      expect(response.body.method).toBe('GET');
    });

    it('should handle external API errors gracefully', async () => {
      externalAPI.setFailureRate(1.0); // Always fail

      gateway.registerEndpoint({
        path: '/api/external/fail',
        method: HTTPMethod.GET,
        handler: async () => {
          try {
            await externalAPI.get('/test');
          } catch (error) {
            return {
              statusCode: 503,
              headers: {},
              body: {
                error: 'External service unavailable',
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            };
          }

          return {
            statusCode: 200,
            headers: {},
            body: {},
          };
        },
        middleware: [],
        tags: ['error'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/external/fail',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(503);
      expect(response.body.error).toBe('External service unavailable');
    });

    it('should retry failed external API calls', async () => {
      let attemptCount = 0;

      gateway.registerEndpoint({
        path: '/api/external/retry',
        method: HTTPMethod.GET,
        handler: async () => {
          const result = await gateway.executeWithRetry(
            async () => {
              attemptCount++;
              if (attemptCount < 3) {
                throw new Error('Transient failure');
              }
              return { success: true, attempts: attemptCount };
            },
            { maxAttempts: 5, initialDelay: 10, maxDelay: 100 }
          );

          return {
            statusCode: 200,
            headers: {},
            body: result,
          };
        },
        middleware: [],
        tags: ['retry'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/external/retry',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.attempts).toBe(3);
      expect(attemptCount).toBe(3);
    });
  });

  describe('Circuit Breaker with External Services', () => {
    it('should open circuit breaker after repeated failures', async () => {
      externalAPI.setFailureRate(1.0); // Always fail

      gateway.registerEndpoint({
        path: '/api/external/circuit',
        method: HTTPMethod.GET,
        handler: async () => {
          try {
            const result = await gateway.executeWithCircuitBreaker(
              'external-service',
              async () => {
                const response = await externalAPI.get('/test');
                return response.data;
              },
              { failureThreshold: 3, resetTimeout: 1000 }
            );

            return {
              statusCode: 200,
              headers: {},
              body: result,
            };
          } catch (error) {
            return {
              statusCode: 503,
              headers: {},
              body: {
                error: error instanceof Error ? error.message : 'Service unavailable',
              },
            };
          }
        },
        middleware: [],
        tags: ['circuit-breaker'],
      });

      const makeRequest = () => {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/external/circuit',
          headers: {},
          query: {},
          params: {},
          body: null,
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      };

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await makeRequest();
      }

      const breaker = gateway.getCircuitBreakerManager().getBreaker('external-service');
      expect(breaker.getState()).toBe('open');
    });

    it('should reset circuit breaker after timeout', async () => {
      let callCount = 0;

      gateway.registerEndpoint({
        path: '/api/external/reset',
        method: HTTPMethod.GET,
        handler: async () => {
          try {
            const result = await gateway.executeWithCircuitBreaker(
              'reset-service',
              async () => {
                callCount++;
                if (callCount <= 3) {
                  throw new Error('Service error');
                }
                return { success: true };
              },
              { failureThreshold: 3, resetTimeout: 200 }
            );

            return {
              statusCode: 200,
              headers: {},
              body: result,
            };
          } catch (error) {
            return {
              statusCode: 503,
              headers: {},
              body: { error: 'Service unavailable' },
            };
          }
        },
        middleware: [],
        tags: ['circuit-reset'],
      });

      const makeRequest = () => {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/external/reset',
          headers: {},
          query: {},
          params: {},
          body: null,
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      };

      // Trigger circuit breaker
      await makeRequest();
      await makeRequest();
      await makeRequest();

      const breaker = gateway.getCircuitBreakerManager().getBreaker('reset-service');
      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 250));

      // Circuit should be half-open
      expect(['half-open', 'open']).toContain(breaker.getState());

      // Successful request should close circuit
      const response = await makeRequest();
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow external API calls', async () => {
      externalAPI.setLatency(3000); // 3 second latency

      gateway.registerEndpoint({
        path: '/api/external/slow',
        method: HTTPMethod.GET,
        handler: async () => {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 1000)
          );

          const apiPromise = externalAPI.get('/slow-endpoint');

          try {
            const response = await Promise.race([apiPromise, timeoutPromise]);
            return {
              statusCode: 200,
              headers: {},
              body: (response as any).data,
            };
          } catch (error) {
            return {
              statusCode: 504,
              headers: {},
              body: {
                error: 'Gateway timeout',
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            };
          }
        },
        middleware: [],
        tags: ['timeout'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/external/slow',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const startTime = Date.now();
      const response = await gateway.handleRequest(request);
      const duration = Date.now() - startTime;

      expect(response.statusCode).toBe(504);
      expect(duration).toBeLessThan(2000); // Should timeout before 2 seconds
    });
  });

  describe('API Composition', () => {
    it('should compose multiple external API calls', async () => {
      const usersAPI = new MockHTTPClient('https://users.example.com');
      const ordersAPI = new MockHTTPClient('https://orders.example.com');

      gateway.registerEndpoint({
        path: '/api/users/:id/orders',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { id } = request.params;

          // Fetch user and orders in parallel
          const [userResponse, ordersResponse] = await Promise.all([
            usersAPI.get(`/users/${id}`),
            ordersAPI.get(`/orders?userId=${id}`),
          ]);

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
              user: userResponse.data,
              orders: ordersResponse.data,
            },
          };
        },
        middleware: [],
        tags: ['composition'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/users/123/orders',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.orders).toBeDefined();
    });

    it('should handle partial failures in composed APIs', async () => {
      const usersAPI = new MockHTTPClient('https://users.example.com');
      const ordersAPI = new MockHTTPClient('https://orders.example.com');

      ordersAPI.setFailureRate(1.0); // Orders API always fails

      gateway.registerEndpoint({
        path: '/api/users/:id/details',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { id } = request.params;

          const userResponse = await usersAPI.get(`/users/${id}`);

          let orders = null;
          try {
            const ordersResponse = await ordersAPI.get(`/orders?userId=${id}`);
            orders = ordersResponse.data;
          } catch (error) {
            // Continue even if orders fail
            orders = { error: 'Orders service unavailable' };
          }

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
              user: userResponse.data,
              orders,
            },
          };
        },
        middleware: [],
        tags: ['partial-failure'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/users/123/details',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.orders.error).toBe('Orders service unavailable');
    });
  });

  describe('Rate Limiting with External APIs', () => {
    it('should respect rate limits when calling external APIs', async () => {
      const rateLimitedAPI = new MockHTTPClient('https://ratelimited.example.com');
      let requestCount = 0;
      const maxRequestsPerSecond = 5;

      gateway.registerEndpoint({
        path: '/api/external/ratelimited',
        method: HTTPMethod.GET,
        handler: async () => {
          requestCount++;

          if (requestCount > maxRequestsPerSecond) {
            return {
              statusCode: 429,
              headers: { 'Retry-After': '1' },
              body: { error: 'Rate limit exceeded' },
            };
          }

          const response = await rateLimitedAPI.get('/data');

          return {
            statusCode: 200,
            headers: {},
            body: response.data,
          };
        },
        middleware: [],
        rateLimit: {
          strategy: 'fixed_window' as any,
          limit: 5,
          window: 1000,
        },
        tags: ['rate-limited'],
      });

      const requests = Array.from({ length: 10 }, () => {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: '/api/external/ratelimited',
          headers: {},
          query: {},
          params: {},
          body: null,
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      });

      const responses = await Promise.all(requests);

      const successCount = responses.filter(r => r.statusCode === 200).length;
      const rateLimitedCount = responses.filter(r => r.statusCode === 429).length;

      expect(successCount).toBeLessThanOrEqual(5);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Response Caching for External APIs', () => {
    it('should cache external API responses', async () => {
      let apiCallCount = 0;

      gateway.registerEndpoint({
        path: '/api/external/cached',
        method: HTTPMethod.GET,
        handler: async () => {
          apiCallCount++;
          const response = await externalAPI.get('/cacheable-data');

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { ...response.data, callCount: apiCallCount },
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
        path: '/api/external/cached',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      // First request
      const response1 = await gateway.handleRequest(request);
      expect(response1.statusCode).toBe(200);
      expect(response1.body.callCount).toBe(1);

      // Second request (should be cached)
      const response2 = await gateway.handleRequest(request);
      expect(response2.statusCode).toBe(200);
      expect(response2.body.callCount).toBe(1); // Same count, from cache

      expect(apiCallCount).toBe(1); // API only called once
    });
  });

  describe('Webhook Handling', () => {
    it('should receive and process webhooks from external services', async () => {
      const receivedWebhooks: any[] = [];

      gateway.registerEndpoint({
        path: '/api/webhooks/external',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const webhook = {
            id: request.body.id,
            event: request.body.event,
            data: request.body.data,
            timestamp: Date.now(),
            ip: request.ip,
          };

          receivedWebhooks.push(webhook);

          return {
            statusCode: 200,
            headers: {},
            body: { received: true, webhookId: webhook.id },
          };
        },
        middleware: [],
        validation: {
          body: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              event: { type: 'string' },
              data: { type: 'object' },
            },
            required: ['id', 'event'],
          },
        },
        tags: ['webhooks'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/webhooks/external',
        headers: { 'X-Webhook-Signature': 'test-signature' },
        query: {},
        params: {},
        body: {
          id: 'webhook-123',
          event: 'user.created',
          data: { userId: '456', username: 'newuser' },
        },
        ip: '203.0.113.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.received).toBe(true);
      expect(receivedWebhooks.length).toBe(1);
      expect(receivedWebhooks[0].event).toBe('user.created');
    });
  });
});
