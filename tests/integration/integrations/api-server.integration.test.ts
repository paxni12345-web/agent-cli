/**
 * Integration Tests: Real API Endpoints with Test Server
 * Tests real HTTP requests, routing, middleware, and error handling
 * Uses mock HTTP server for integration testing
 */

import { EventEmitter } from 'events';
import * as http from 'http';

// Mock HTTP Server
class MockHTTPServer extends EventEmitter {
  private server: http.Server | null = null;
  private routes: Map<string, Map<string, Function>> = new Map();
  private middleware: Function[] = [];
  private port: number = 0;

  use(middleware: Function): void {
    this.middleware.push(middleware);
  }

  route(method: string, path: string, handler: Function): void {
    if (!this.routes.has(method)) {
      this.routes.set(method, new Map());
    }
    this.routes.get(method)!.set(path, handler);
  }

  async start(port: number = 0): Promise<number> {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.server.listen(port, () => {
        const address = this.server!.address() as any;
        this.port = address.port;
        this.emit('server:started', { port: this.port });
        resolve(this.port);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.emit('server:stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method || 'GET';
    const url = req.url || '/';

    try {
      // Parse body
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      const requestData = body ? JSON.parse(body) : {};

      // Create context
      let context: any = {
        method,
        url,
        body: requestData,
        headers: req.headers,
        params: {},
        query: {}
      };

      // Run middleware
      for (const mw of this.middleware) {
        context = await mw(context, req, res);
        if (res.writableEnded) return;
      }

      // Find route handler
      const methodRoutes = this.routes.get(method);
      if (!methodRoutes) {
        this.sendError(res, 405, 'Method not allowed');
        return;
      }

      const handler = methodRoutes.get(url);
      if (!handler) {
        this.sendError(res, 404, 'Not found');
        return;
      }

      // Execute handler
      const result = await handler(context);

      this.sendJSON(res, 200, result);
      this.emit('request:handled', { method, url, status: 200 });
    } catch (error: any) {
      this.sendError(res, 500, error.message);
      this.emit('request:error', { method, url, error });
    }
  }

  private sendJSON(res: http.ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sendError(res: http.ServerResponse, status: number, message: string): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  getPort(): number {
    return this.port;
  }
}

// Mock HTTP Client
class MockHTTPClient {
  async request(method: string, url: string, data?: any, headers?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsed
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async get(url: string, headers?: any): Promise<any> {
    return this.request('GET', url, undefined, headers);
  }

  async post(url: string, data: any, headers?: any): Promise<any> {
    return this.request('POST', url, data, headers);
  }

  async put(url: string, data: any, headers?: any): Promise<any> {
    return this.request('PUT', url, data, headers);
  }

  async delete(url: string, headers?: any): Promise<any> {
    return this.request('DELETE', url, undefined, headers);
  }
}

describe('Real API Integration Tests', () => {
  let server: MockHTTPServer;
  let client: MockHTTPClient;
  let baseURL: string;

  beforeAll(async () => {
    server = new MockHTTPServer();
    client = new MockHTTPClient();
    const port = await server.start();
    baseURL = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Basic HTTP Operations', () => {
    test('should handle GET request', async () => {
      server.route('GET', '/api/health', async () => {
        return { status: 'healthy', timestamp: new Date().toISOString() };
      });

      const response = await client.get(`${baseURL}/api/health`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('timestamp');
    });

    test('should handle POST request', async () => {
      server.route('POST', '/api/users', async (context: any) => {
        return {
          id: 'user-123',
          username: context.body.username,
          created: true
        };
      });

      const response = await client.post(`${baseURL}/api/users`, {
        username: 'testuser',
        email: 'test@example.com'
      });

      expect(response.status).toBe(200);
      expect(response.data.username).toBe('testuser');
      expect(response.data.created).toBe(true);
    });

    test('should handle PUT request', async () => {
      server.route('PUT', '/api/users/123', async (context: any) => {
        return {
          id: '123',
          username: context.body.username,
          updated: true
        };
      });

      const response = await client.put(`${baseURL}/api/users/123`, {
        username: 'updateduser'
      });

      expect(response.status).toBe(200);
      expect(response.data.updated).toBe(true);
    });

    test('should handle DELETE request', async () => {
      server.route('DELETE', '/api/users/123', async () => {
        return { deleted: true, id: '123' };
      });

      const response = await client.delete(`${baseURL}/api/users/123`);

      expect(response.status).toBe(200);
      expect(response.data.deleted).toBe(true);
    });

    test('should return 404 for non-existent routes', async () => {
      const response = await client.get(`${baseURL}/api/nonexistent`);

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });
  });

  describe('Middleware Integration', () => {
    test('should execute middleware before handler', async () => {
      const executionOrder: string[] = [];

      server.use(async (context: any) => {
        executionOrder.push('middleware-1');
        context.middlewareExecuted = true;
        return context;
      });

      server.route('GET', '/api/middleware-test', async (context: any) => {
        executionOrder.push('handler');
        return { middlewareExecuted: context.middlewareExecuted };
      });

      const response = await client.get(`${baseURL}/api/middleware-test`);

      expect(executionOrder).toEqual(['middleware-1', 'handler']);
      expect(response.data.middlewareExecuted).toBe(true);
    });

    test('should pass data through middleware chain', async () => {
      server.use(async (context: any) => {
        context.step1 = 'completed';
        return context;
      });

      server.use(async (context: any) => {
        context.step2 = 'completed';
        return context;
      });

      server.route('GET', '/api/chain-test', async (context: any) => {
        return {
          step1: context.step1,
          step2: context.step2
        };
      });

      const response = await client.get(`${baseURL}/api/chain-test`);

      expect(response.data.step1).toBe('completed');
      expect(response.data.step2).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    test('should handle synchronous errors', async () => {
      server.route('GET', '/api/sync-error', async () => {
        throw new Error('Synchronous error');
      });

      const response = await client.get(`${baseURL}/api/sync-error`);

      expect(response.status).toBe(500);
      expect(response.data.error).toContain('Synchronous error');
    });

    test('should handle asynchronous errors', async () => {
      server.route('GET', '/api/async-error', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Asynchronous error');
      });

      const response = await client.get(`${baseURL}/api/async-error`);

      expect(response.status).toBe(500);
      expect(response.data.error).toContain('Asynchronous error');
    });

    test('should handle validation errors', async () => {
      server.route('POST', '/api/validate', async (context: any) => {
        if (!context.body.email) {
          throw new Error('Email is required');
        }
        if (!context.body.email.includes('@')) {
          throw new Error('Invalid email format');
        }
        return { valid: true };
      });

      const response = await client.post(`${baseURL}/api/validate`, {
        email: 'invalid-email'
      });

      expect(response.status).toBe(500);
      expect(response.data.error).toContain('Invalid email format');
    });
  });

  describe('Request/Response Headers', () => {
    test('should handle custom request headers', async () => {
      server.route('GET', '/api/headers', async (context: any) => {
        return {
          receivedHeader: context.headers['x-custom-header']
        };
      });

      const response = await client.get(`${baseURL}/api/headers`, {
        'X-Custom-Header': 'test-value'
      });

      expect(response.data.receivedHeader).toBe('test-value');
    });

    test('should include content-type in response', async () => {
      server.route('GET', '/api/content-type', async () => {
        return { message: 'test' };
      });

      const response = await client.get(`${baseURL}/api/content-type`);

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent requests', async () => {
      server.route('GET', '/api/concurrent', async (context: any) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { processed: true, timestamp: Date.now() };
      });

      const requests = Array.from({ length: 10 }, () =>
        client.get(`${baseURL}/api/concurrent`)
      );

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.processed).toBe(true);
      });
    });

    test('should maintain request isolation', async () => {
      let requestCount = 0;

      server.route('POST', '/api/isolated', async (context: any) => {
        const id = ++requestCount;
        await new Promise(resolve => setTimeout(resolve, 20));
        return { requestId: id, data: context.body.value };
      });

      const requests = Array.from({ length: 5 }, (_, i) =>
        client.post(`${baseURL}/api/isolated`, { value: i })
      );

      const responses = await Promise.all(requests);

      const values = responses.map(r => r.data.data);
      expect(values.sort()).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('Request Body Parsing', () => {
    test('should parse JSON body', async () => {
      server.route('POST', '/api/json-body', async (context: any) => {
        return {
          received: context.body,
          type: typeof context.body
        };
      });

      const testData = { name: 'test', value: 123, nested: { key: 'value' } };
      const response = await client.post(`${baseURL}/api/json-body`, testData);

      expect(response.data.received).toEqual(testData);
      expect(response.data.type).toBe('object');
    });

    test('should handle empty body', async () => {
      server.route('POST', '/api/empty-body', async (context: any) => {
        return { hasBody: Object.keys(context.body).length > 0 };
      });

      const response = await client.post(`${baseURL}/api/empty-body`, {});

      expect(response.data.hasBody).toBe(false);
    });
  });
});

describe('API Rate Limiting Integration', () => {
  let server: MockHTTPServer;
  let client: MockHTTPClient;
  let baseURL: string;
  let requestCounts: Map<string, number>;

  beforeAll(async () => {
    server = new MockHTTPServer();
    client = new MockHTTPClient();
    requestCounts = new Map();

    // Rate limiting middleware
    server.use(async (context: any) => {
      const key = context.headers['x-client-id'] || 'default';
      const count = requestCounts.get(key) || 0;

      if (count >= 5) {
        throw new Error('Rate limit exceeded');
      }

      requestCounts.set(key, count + 1);
      return context;
    });

    const port = await server.start();
    baseURL = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    requestCounts.clear();
  });

  test('should enforce rate limits', async () => {
    server.route('GET', '/api/limited', async () => {
      return { success: true };
    });

    const requests = Array.from({ length: 6 }, () =>
      client.get(`${baseURL}/api/limited`, { 'X-Client-Id': 'client-1' })
    );

    const responses = await Promise.all(requests);
    const errors = responses.filter(r => r.status === 500);

    expect(errors.length).toBeGreaterThan(0);
  });

  test('should track limits per client', async () => {
    server.route('GET', '/api/per-client', async () => {
      return { success: true };
    });

    const client1Requests = Array.from({ length: 3 }, () =>
      client.get(`${baseURL}/api/per-client`, { 'X-Client-Id': 'client-1' })
    );

    const client2Requests = Array.from({ length: 3 }, () =>
      client.get(`${baseURL}/api/per-client`, { 'X-Client-Id': 'client-2' })
    );

    const allResponses = await Promise.all([...client1Requests, ...client2Requests]);
    const successful = allResponses.filter(r => r.status === 200);

    expect(successful.length).toBe(6);
  });
});

describe('API Authentication Integration', () => {
  let server: MockHTTPServer;
  let client: MockHTTPClient;
  let baseURL: string;
  let validTokens: Set<string>;

  beforeAll(async () => {
    server = new MockHTTPServer();
    client = new MockHTTPClient();
    validTokens = new Set(['valid-token-123']);

    // Auth middleware
    server.use(async (context: any) => {
      const token = context.headers['authorization'];

      if (context.url === '/api/public') {
        return context;
      }

      if (!token) {
        throw new Error('No authorization token');
      }

      if (!validTokens.has(token)) {
        throw new Error('Invalid token');
      }

      context.authenticated = true;
      return context;
    });

    const port = await server.start();
    baseURL = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  test('should allow access to public endpoints', async () => {
    server.route('GET', '/api/public', async () => {
      return { public: true };
    });

    const response = await client.get(`${baseURL}/api/public`);

    expect(response.status).toBe(200);
    expect(response.data.public).toBe(true);
  });

  test('should block access without token', async () => {
    server.route('GET', '/api/protected', async () => {
      return { protected: true };
    });

    const response = await client.get(`${baseURL}/api/protected`);

    expect(response.status).toBe(500);
    expect(response.data.error).toContain('No authorization token');
  });

  test('should allow access with valid token', async () => {
    server.route('GET', '/api/protected', async (context: any) => {
      return { protected: true, authenticated: context.authenticated };
    });

    const response = await client.get(`${baseURL}/api/protected`, {
      'Authorization': 'valid-token-123'
    });

    expect(response.status).toBe(200);
    expect(response.data.authenticated).toBe(true);
  });

  test('should reject invalid token', async () => {
    server.route('GET', '/api/protected', async () => {
      return { protected: true };
    });

    const response = await client.get(`${baseURL}/api/protected`, {
      'Authorization': 'invalid-token'
    });

    expect(response.status).toBe(500);
    expect(response.data.error).toContain('Invalid token');
  });
});
