/**
 * Production-Ready API Gateway Usage Examples
 *
 * This file demonstrates how to use the enhanced APIGateway with:
 * - Request validation and sanitization
 * - Authentication and authorization
 * - Rate limiting
 * - Response compression
 * - CORS support
 * - Security headers
 * - Request/response logging
 * - Caching
 * - Error handling
 */

import {
  APIGateway,
  APIHandlerFactory,
  MiddlewareFactory,
  ValidationHelpers,
  CommonSchemas,
  Request,
  Response,
  AuthConfig,
} from './APIGateway';
import { z } from 'zod';

// ============================================================================
// Example 1: Simple API Gateway Setup
// ============================================================================

async function example1_BasicSetup() {
  const gateway = new APIGateway({
    port: 3000,
    host: '0.0.0.0',
    enableSSL: false,
    enableCaching: true,
    enableRateLimiting: true,
    enableCompression: true,
    enableCORS: true,
    enableSecurityHeaders: true,
    enableRequestLogging: true,
    corsOrigins: ['http://localhost:3000', 'https://example.com'],
    compressionThreshold: 1024, // Compress responses > 1KB
    maxRequestSize: 5 * 1024 * 1024, // 5MB
  });

  // Simple route
  gateway.registerRoute({
    path: '/health',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            status: 'healthy',
            timestamp: Date.now(),
            uptime: process.uptime(),
          },
        };
      },
    },
    middleware: [],
  });

  await gateway.start();
  console.log('Gateway started on port 3000');
}

// ============================================================================
// Example 2: RESTful API with Validation
// ============================================================================

async function example2_RESTfulAPI() {
  const gateway = new APIGateway({
    port: 3000,
    enableCompression: true,
    enableCORS: true,
    enableSecurityHeaders: true,
    enableRequestLogging: true,
  });

  // Define schemas
  const userCreateSchema = z.object({
    username: CommonSchemas.username,
    email: CommonSchemas.email,
    password: CommonSchemas.password,
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
  });

  const userUpdateSchema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: CommonSchemas.email.optional(),
  });

  const userQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().max(100).optional(),
  });

  // Mock user service
  const userService = {
    list: async (query: any) => [
      { id: '1', username: 'john_doe', email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
      { id: '2', username: 'jane_doe', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' },
    ],
    get: async (id: string) => ({ id, username: 'john_doe', email: 'john@example.com', firstName: 'John', lastName: 'Doe' }),
    create: async (data: any) => ({ id: '3', ...data }),
    update: async (id: string, data: any) => ({ id, ...data }),
    delete: async (id: string) => {},
  };

  // Authentication config
  const authConfig: AuthConfig = {
    type: 'bearer',
    required: true,
    validator: async (token: string) => {
      // Implement JWT validation here
      return token === 'valid-token-123';
    },
  };

  // Create RESTful routes
  const userRoutes = APIHandlerFactory.createRESTHandlers({
    resource: 'users',
    schema: {
      create: userCreateSchema,
      update: userUpdateSchema,
      query: userQuerySchema,
    },
    service: userService,
    auth: authConfig,
    rateLimit: ValidationHelpers.createRateLimit.perUser(100, 60000),
  });

  // Register routes
  userRoutes.forEach(route => gateway.registerRoute(route));

  await gateway.start();
}

// ============================================================================
// Example 3: Advanced API with Custom Middleware
// ============================================================================

async function example3_AdvancedAPI() {
  const gateway = new APIGateway({
    port: 3000,
    enableCompression: true,
    enableCORS: true,
    enableSecurityHeaders: true,
    enableRequestLogging: true,
  });

  // Custom authentication
  const authConfig: AuthConfig = {
    type: 'jwt',
    required: true,
    validator: async (token: string) => {
      try {
        // Implement JWT verification
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return true;
      } catch {
        return false;
      }
    },
    scopes: ['read:data', 'write:data'],
  };

  // Create API endpoint with full features
  gateway.registerRoute({
    path: '/api/data',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        // Process request
        const data = req.body;

        // Simulate processing
        const result = {
          id: Math.random().toString(36).substr(2, 9),
          data: data,
          processedAt: Date.now(),
          processedBy: req.metadata.userId || 'anonymous',
        };

        return {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'X-Resource-ID': result.id,
          },
          body: {
            success: true,
            data: result,
          },
        };
      },
    },
    middleware: [
      MiddlewareFactory.requestId(),
      MiddlewareFactory.responseTime(),
      MiddlewareFactory.userContext(),
      MiddlewareFactory.errorHandler(),
      MiddlewareFactory.sizeLimit(1024 * 1024), // 1MB
      MiddlewareFactory.timeout(5000), // 5 seconds
    ],
    validation: ValidationHelpers.createSecureValidation(
      z.object({
        name: z.string().min(1).max(100),
        value: z.number().min(0).max(1000000),
        tags: z.array(z.string()).max(10).optional(),
        metadata: z.record(z.string()).optional(),
      })
    ),
    auth: authConfig,
    rateLimit: ValidationHelpers.createRateLimit.perEndpoint('api-data', 50, 60000),
    timeout: 10000,
  });

  await gateway.start();
}

// ============================================================================
// Example 4: File Upload API
// ============================================================================

async function example4_FileUpload() {
  const gateway = new APIGateway({
    port: 3000,
    maxRequestSize: 50 * 1024 * 1024, // 50MB for file uploads
    enableCompression: false, // Don't compress file uploads
    enableRequestLogging: true,
  });

  gateway.registerRoute({
    path: '/api/upload',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        const { filename, contentType, data } = req.body;

        // Validate file
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(contentType)) {
          return {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: {
              success: false,
              error: 'Invalid file type',
              allowedTypes,
            },
          };
        }

        // Process file (save to storage, etc.)
        const fileId = Math.random().toString(36).substr(2, 9);

        return {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: true,
            data: {
              fileId,
              filename,
              contentType,
              size: data.length,
              uploadedAt: Date.now(),
            },
          },
        };
      },
    },
    middleware: [
      MiddlewareFactory.requestId(),
      MiddlewareFactory.sizeLimit(50 * 1024 * 1024),
    ],
    validation: {
      schema: z.object({
        filename: z.string().min(1).max(255),
        contentType: z.string(),
        data: z.string(), // Base64 encoded
      }),
      sanitize: true,
      preventPathTraversal: true,
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 10,
      strategy: 'sliding_window',
    },
  });

  await gateway.start();
}

// ============================================================================
// Example 5: Proxying to Upstream Services
// ============================================================================

async function example5_Proxy() {
  const gateway = new APIGateway({
    port: 3000,
    enableLoadBalancing: true,
    enableCircuitBreaker: true,
    enableCaching: true,
  });

  gateway.registerRoute({
    path: '/api/external/:path*',
    method: 'GET',
    target: {
      type: 'upstream',
      upstream: {
        servers: [
          {
            id: 'server-1',
            url: 'https://api.example.com',
            weight: 2,
            priority: 1,
            maxConnections: 100,
            currentConnections: 0,
            healthy: true,
          },
          {
            id: 'server-2',
            url: 'https://api2.example.com',
            weight: 1,
            priority: 2,
            maxConnections: 100,
            currentConnections: 0,
            healthy: true,
          },
        ],
        loadBalancing: 'weighted_round_robin',
        healthCheck: {
          interval: 30000,
          timeout: 5000,
          unhealthyThreshold: 3,
          healthyThreshold: 2,
          path: '/health',
          method: 'GET',
          expectedStatus: [200, 204],
        },
        circuitBreaker: {
          threshold: 5,
          timeout: 60000,
          monitoringPeriod: 10000,
          fallbackResponse: {
            error: 'Service temporarily unavailable',
          },
        },
      },
    },
    middleware: [MiddlewareFactory.requestId()],
    rateLimit: ValidationHelpers.createRateLimit.moderate(),
    cache: {
      ttl: 300000, // 5 minutes
      maxSize: 50 * 1024 * 1024,
      storage: 'memory',
    },
    retry: {
      maxAttempts: 3,
      delay: 1000,
      backoff: 'exponential',
      retryableStatuses: [502, 503, 504],
      retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
    },
  });

  await gateway.start();
}

// ============================================================================
// Example 6: Monitoring and Metrics
// ============================================================================

async function example6_Monitoring() {
  const gateway = new APIGateway({
    port: 3000,
    enableRequestLogging: true,
  });

  // Metrics endpoint
  gateway.registerRoute({
    path: '/metrics',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        const metrics = gateway.getMetrics();
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: metrics,
        };
      },
    },
    middleware: [],
  });

  // Request logs endpoint
  gateway.registerRoute({
    path: '/logs',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        const logs = gateway.getRequestLogs({
          limit: parseInt(req.query.limit || '100'),
          status: req.query.status ? parseInt(req.query.status) : undefined,
          method: req.query.method as any,
          since: req.query.since ? parseInt(req.query.since) : undefined,
        });
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            total: logs.length,
            logs,
          },
        };
      },
    },
    middleware: [],
  });

  // Listen to events
  gateway.on('request:received', (data) => {
    console.log('Request received:', data.request.id);
  });

  gateway.on('request:completed', (data) => {
    console.log('Request completed:', data.request.id, 'in', data.latency, 'ms');
  });

  gateway.on('request:error', (data) => {
    console.error('Request error:', data.request.id, data.error);
  });

  gateway.on('rate_limit:exceeded', (data) => {
    console.warn('Rate limit exceeded:', data.key);
  });

  gateway.on('circuit_breaker:opened', (data) => {
    console.error('Circuit breaker opened:', data.serverId);
  });

  gateway.on('log', (data) => {
    // Send to external logging service
    console.log(data.message);
  });

  await gateway.start();
}

// ============================================================================
// Example 7: Complete Production Setup
// ============================================================================

async function example7_ProductionSetup() {
  const gateway = new APIGateway({
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    enableSSL: process.env.ENABLE_SSL === 'true',
    enableCaching: true,
    enableRateLimiting: true,
    enableLoadBalancing: true,
    enableCircuitBreaker: true,
    enableCompression: true,
    enableCORS: true,
    enableSecurityHeaders: true,
    enableRequestLogging: true,
    timeout: 30000,
    maxRequestSize: 10 * 1024 * 1024,
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
    compressionThreshold: 1024,
  });

  // Global middleware
  const globalMiddleware = [
    MiddlewareFactory.requestId(),
    MiddlewareFactory.responseTime(),
    MiddlewareFactory.userContext(),
    MiddlewareFactory.errorHandler(),
  ];

  // API key validation
  const apiKeys = new Set(process.env.API_KEYS?.split(',') || []);

  // Health check
  gateway.registerRoute({
    path: '/health',
    method: 'GET',
    target: {
      type: 'function',
      handler: async () => ({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'healthy', timestamp: Date.now() },
      }),
    },
    middleware: [],
  });

  // Metrics (protected)
  gateway.registerRoute({
    path: '/metrics',
    method: 'GET',
    target: {
      type: 'function',
      handler: async () => ({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: gateway.getMetrics(),
      }),
    },
    middleware: [MiddlewareFactory.apiKey(apiKeys)],
  });

  // Register your API routes here
  // ...

  // Start server
  await gateway.start();
  console.log(`Production gateway started on port ${gateway['config'].port}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await gateway.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await gateway.stop();
    process.exit(0);
  });
}

// ============================================================================
// Run Examples
// ============================================================================

if (require.main === module) {
  // Uncomment the example you want to run
  // example1_BasicSetup();
  // example2_RESTfulAPI();
  // example3_AdvancedAPI();
  // example4_FileUpload();
  // example5_Proxy();
  // example6_Monitoring();
  // example7_ProductionSetup();
}

export {
  example1_BasicSetup,
  example2_RESTfulAPI,
  example3_AdvancedAPI,
  example4_FileUpload,
  example5_Proxy,
  example6_Monitoring,
  example7_ProductionSetup,
};
