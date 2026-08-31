# Production-Ready API Gateway

A comprehensive API Gateway implementation with enterprise-grade features including validation, authentication, rate limiting, compression, CORS, security headers, and request logging.

## Features

### ✅ 1. Request Parsing & Validation
- **Schema Validation**: Zod-based request validation with detailed error messages
- **Security Validation**: Built-in XSS, SQL injection, command injection, and path traversal detection
- **Input Sanitization**: Automatic sanitization of user inputs
- **Common Schemas**: Pre-built validation schemas for email, phone, URL, username, password, etc.

### ✅ 2. Authentication & Authorization
- **Multiple Auth Types**: Bearer, Basic, API Key, JWT, OAuth2
- **Token Validation**: Async token validator support
- **Scope-based Access**: Fine-grained permission control
- **Flexible Configuration**: Per-route authentication requirements

### ✅ 3. Business Logic Execution
- **Handler Types**: Function handlers, static content, upstream proxying
- **Middleware Chain**: Composable middleware for request processing
- **Error Handling**: Comprehensive error handling with proper status codes
- **Request Transformation**: Request/response transformation capabilities

### ✅ 4. Error Handling
- **Structured Errors**: Consistent error response format
- **Status Code Mapping**: Proper HTTP status codes for different error types
- **Error Logging**: Automatic error logging with stack traces
- **Development Mode**: Detailed error messages in development

### ✅ 5. Structured Responses
- **Consistent Format**: Standardized response structure
- **Metadata Inclusion**: Request ID, timestamps, pagination info
- **Content Negotiation**: Automatic JSON/text handling
- **Status Indicators**: Success/error flags in responses

### ✅ 6. Response Compression
- **Multiple Algorithms**: Brotli, Gzip, Deflate support
- **Smart Compression**: Only compress responses above threshold (default 1KB)
- **Content-Type Aware**: Skips compression for already-compressed content
- **Compression Metrics**: Track compression ratios and savings

### ✅ 7. CORS Implementation
- **Configurable Origins**: Whitelist allowed origins
- **Preflight Handling**: Automatic OPTIONS request handling
- **Credentials Support**: Cookie/auth header support
- **Custom Headers**: Configurable allowed headers and methods

### ✅ 8. Security Headers
- **XSS Protection**: X-XSS-Protection header
- **Clickjacking Prevention**: X-Frame-Options header
- **MIME Sniffing Protection**: X-Content-Type-Options header
- **HSTS**: Strict-Transport-Security for SSL
- **CSP**: Content-Security-Policy headers
- **Privacy Headers**: Referrer-Policy, Permissions-Policy

### ✅ 9. Rate Limiting
- **Multiple Strategies**: Fixed window, sliding window, token bucket
- **Flexible Keys**: IP-based, user-based, endpoint-based rate limiting
- **Per-Route Limits**: Different limits for different endpoints
- **Rate Limit Headers**: X-RateLimit-* headers in responses

### ✅ 10. Request/Response Logging
- **Structured Logging**: JSON-formatted log entries
- **Request Tracking**: Unique request IDs
- **Performance Metrics**: Latency tracking
- **Log Filtering**: Query logs by status, method, path, time
- **Event Emission**: Real-time log streaming via events

## Installation

```bash
npm install zod
```

## Basic Usage

```typescript
import { APIGateway, ValidationHelpers, CommonSchemas } from './APIGateway';
import { z } from 'zod';

// Create gateway
const gateway = new APIGateway({
  port: 3000,
  enableCompression: true,
  enableCORS: true,
  enableSecurityHeaders: true,
  enableRequestLogging: true,
});

// Register a route
gateway.registerRoute({
  path: '/api/users',
  method: 'POST',
  target: {
    type: 'function',
    handler: async (req) => {
      // Your business logic here
      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true, data: req.body },
      };
    },
  },
  validation: ValidationHelpers.createSecureValidation(
    z.object({
      username: CommonSchemas.username,
      email: CommonSchemas.email,
      password: CommonSchemas.password,
    })
  ),
  rateLimit: ValidationHelpers.createRateLimit.moderate(),
  middleware: [],
});

// Start server
await gateway.start();
```

## Advanced Examples

### RESTful CRUD API

```typescript
import { APIHandlerFactory } from './APIGateway';

const userRoutes = APIHandlerFactory.createRESTHandlers({
  resource: 'users',
  schema: {
    create: z.object({
      username: CommonSchemas.username,
      email: CommonSchemas.email,
    }),
    update: z.object({
      email: CommonSchemas.email.optional(),
    }),
    query: z.object({
      page: z.string().regex(/^\d+$/).transform(Number).optional(),
      limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    }),
  },
  service: {
    list: async (query) => [/* users */],
    get: async (id) => ({ id, username: 'john' }),
    create: async (data) => ({ id: '123', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async (id) => {},
  },
  auth: {
    type: 'bearer',
    required: true,
    validator: async (token) => token === 'valid-token',
  },
  rateLimit: ValidationHelpers.createRateLimit.perUser(100, 60000),
});

userRoutes.forEach(route => gateway.registerRoute(route));
```

### Custom Middleware

```typescript
import { MiddlewareFactory } from './APIGateway';

gateway.registerRoute({
  path: '/api/protected',
  method: 'POST',
  target: { /* ... */ },
  middleware: [
    MiddlewareFactory.requestId(),
    MiddlewareFactory.responseTime(),
    MiddlewareFactory.userContext(),
    MiddlewareFactory.timeout(5000),
    MiddlewareFactory.sizeLimit(1024 * 1024), // 1MB
    MiddlewareFactory.errorHandler(),
  ],
});
```

### Upstream Proxying with Load Balancing

```typescript
gateway.registerRoute({
  path: '/api/external/*',
  method: 'GET',
  target: {
    type: 'upstream',
    upstream: {
      servers: [
        {
          id: 'server-1',
          url: 'https://api1.example.com',
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
      },
    },
  },
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
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT'],
  },
});
```

## Configuration

### Gateway Config

```typescript
interface GatewayConfig {
  port: number;                      // Server port
  host: string;                      // Bind address
  enableSSL: boolean;                // Enable HTTPS
  enableCaching: boolean;            // Enable response caching
  enableRateLimiting: boolean;       // Enable rate limiting
  enableLoadBalancing: boolean;      // Enable load balancing
  enableCircuitBreaker: boolean;     // Enable circuit breaker
  enableCompression: boolean;        // Enable response compression
  enableCORS: boolean;               // Enable CORS
  enableSecurityHeaders: boolean;    // Enable security headers
  enableRequestLogging: boolean;     // Enable request logging
  timeout: number;                   // Request timeout (ms)
  maxRequestSize: number;            // Max request body size (bytes)
  corsOrigins: string[];             // Allowed CORS origins
  compressionThreshold: number;      // Min size to compress (bytes)
}
```

### Validation Config

```typescript
interface ValidationConfig {
  schema?: ZodSchema<any>;           // Zod validation schema
  sanitize?: boolean;                // Enable input sanitization
  preventXSS?: boolean;              // Enable XSS detection
  preventSQLInjection?: boolean;     // Enable SQL injection detection
  preventCommandInjection?: boolean; // Enable command injection detection
  preventPathTraversal?: boolean;    // Enable path traversal detection
  customValidators?: ValidationRule[]; // Custom validation rules
}
```

### Rate Limit Config

```typescript
interface RateLimitConfig {
  windowMs: number;                  // Time window (ms)
  maxRequests: number;               // Max requests per window
  strategy: 'sliding_window' | 'fixed_window' | 'token_bucket';
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
  skipFailedRequests?: boolean;      // Don't count failed requests
}
```

## Monitoring & Metrics

### Get Metrics

```typescript
const metrics = gateway.getMetrics();
console.log(metrics);
// {
//   totalRequests: 1000,
//   successfulRequests: 950,
//   failedRequests: 50,
//   cachedResponses: 200,
//   rateLimited: 10,
//   averageLatency: 45.5,
//   requestsPerSecond: 20,
//   bytesIn: 1048576,
//   bytesOut: 2097152,
//   compressedResponses: 500,
//   compressionRatio: 3.2,
// }
```

### Get Request Logs

```typescript
const logs = gateway.getRequestLogs({
  limit: 100,
  status: 500,
  method: 'POST',
  since: Date.now() - 3600000, // Last hour
});
```

### Event Listeners

```typescript
gateway.on('request:received', (data) => {
  console.log('Request:', data.request.id);
});

gateway.on('request:completed', (data) => {
  console.log('Completed in', data.latency, 'ms');
});

gateway.on('request:error', (data) => {
  console.error('Error:', data.error);
});

gateway.on('rate_limit:exceeded', (data) => {
  console.warn('Rate limit exceeded:', data.key);
});

gateway.on('circuit_breaker:opened', (data) => {
  console.error('Circuit breaker opened:', data.serverId);
});

gateway.on('log', (data) => {
  // Send to external logging service
  sendToLogService(data);
});
```

## Security Best Practices

1. **Always validate input**: Use schema validation for all user inputs
2. **Enable security headers**: Protect against common web vulnerabilities
3. **Use HTTPS in production**: Enable SSL for encrypted communication
4. **Rate limit endpoints**: Prevent abuse and DDoS attacks
5. **Implement authentication**: Require authentication for sensitive endpoints
6. **Sanitize inputs**: Enable input sanitization to prevent injection attacks
7. **Log security events**: Monitor for suspicious activity
8. **Keep secrets safe**: Never expose API keys or tokens in responses
9. **Use CORS wisely**: Only allow trusted origins
10. **Regular security audits**: Review logs and metrics regularly

## Performance Optimization

1. **Enable compression**: Reduce bandwidth usage for large responses
2. **Use caching**: Cache frequently accessed data
3. **Implement rate limiting**: Protect against traffic spikes
4. **Load balancing**: Distribute traffic across multiple servers
5. **Circuit breakers**: Fail fast when upstream services are down
6. **Connection pooling**: Reuse connections to upstream services
7. **Monitor metrics**: Track performance and optimize bottlenecks
8. **Set appropriate timeouts**: Prevent requests from hanging
9. **Limit request size**: Prevent large payload attacks
10. **Use health checks**: Automatically detect and remove unhealthy servers

## Production Checklist

- [ ] Configure proper CORS origins (no wildcards)
- [ ] Enable SSL/TLS encryption
- [ ] Set up rate limiting for all endpoints
- [ ] Implement authentication and authorization
- [ ] Enable security headers
- [ ] Configure request size limits
- [ ] Set up comprehensive logging
- [ ] Implement health check endpoints
- [ ] Configure metrics collection
- [ ] Set up graceful shutdown handling
- [ ] Test error handling scenarios
- [ ] Configure circuit breakers for upstream services
- [ ] Set up monitoring and alerting
- [ ] Document all API endpoints
- [ ] Implement request tracing
- [ ] Configure backup strategies

## Common Validation Schemas

The library includes pre-built schemas for common use cases:

```typescript
CommonSchemas.email          // Email validation
CommonSchemas.phone          // Phone number validation
CommonSchemas.url            // URL validation
CommonSchemas.uuid           // UUID validation
CommonSchemas.username       // Username validation (3-32 chars, alphanumeric)
CommonSchemas.password       // Strong password (8+ chars, mixed case, numbers, symbols)
CommonSchemas.ipv4           // IPv4 address
CommonSchemas.ipv6           // IPv6 address
CommonSchemas.positiveInt    // Positive integer
CommonSchemas.dateISO        // ISO date string
CommonSchemas.alphanumeric   // Alphanumeric string
CommonSchemas.slug           // URL-friendly slug
CommonSchemas.hexColor       // Hex color code
CommonSchemas.creditCard     // Credit card number
CommonSchemas.zipCode        // US zip code
CommonSchemas.safeString     // XSS-safe string
```

## License

See project root for license information.

## Support

For issues and feature requests, please file an issue in the repository.
