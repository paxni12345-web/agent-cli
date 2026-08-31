# Production-Ready API Gateway

Complete implementation of production-grade API request handlers with comprehensive security, monitoring, and reliability features.

## Features Implemented

### ✅ 1. Request Parsing & Validation
- **Zod Schema Validation**: Type-safe request validation using Zod
- **Custom Validators**: Email, URL, phone, UUID, IP validation
- **Body/Query/Params Validation**: Comprehensive validation for all request parts
- **Format Validation**: Email, URL, phone, UUID, date formats
- **Range Validation**: Min/max for strings, numbers, arrays
- **Pattern Matching**: Regex-based validation

### ✅ 2. Authentication & Authorization
- **Bearer Token Authentication**: JWT-based authentication
- **API Key Support**: Alternative authentication method
- **Role-Based Access Control (RBAC)**: Fine-grained permission system
- **Custom Authorization Logic**: Flexible authorization handlers
- **User Status Checking**: Verify active/inactive user status
- **Multi-Factor Authentication Ready**: Extensible auth framework

### ✅ 3. Business Logic Execution
- **User Management**: CRUD operations for users
- **Resource Management**: Generic resource handlers
- **Batch Operations**: Execute multiple operations in one request
- **Pagination**: Cursor and offset-based pagination
- **Filtering & Sorting**: Query parameter support
- **Data Transformation**: Response formatting

### ✅ 4. Error Handling
- **Structured Error Responses**: Consistent error format
- **Error Types**: Validation, Authentication, Authorization, Not Found, Server errors
- **Stack Traces**: Included in development, hidden in production
- **Request ID Tracking**: Trace errors across systems
- **Custom Error Codes**: Application-specific error codes
- **Error Recovery**: Graceful degradation

### ✅ 5. Structured Responses
- **Standard Format**: `{ success, data, requestId }` pattern
- **Pagination Metadata**: Page, limit, total, totalPages
- **Timestamps**: ISO 8601 timestamps
- **ETags**: Conditional requests support
- **Location Headers**: Resource creation responses
- **Cache-Control**: Appropriate caching directives

### ✅ 6. Response Compression
- **Content Negotiation**: Check Accept-Encoding header
- **Gzip Support**: Compress responses > 1KB
- **Compression Middleware**: Automatic compression
- **Size Threshold**: Only compress beneficial content
- **Vary Header**: Proper cache variation

### ✅ 7. CORS Implementation
- **Origin Validation**: Whitelist-based origin checking
- **Preflight Handling**: OPTIONS request support
- **Credentials Support**: Cookie/auth header handling
- **Method Allowlist**: Configure allowed HTTP methods
- **Header Allowlist**: Control allowed/exposed headers
- **Max-Age Caching**: Preflight response caching

### ✅ 8. Security Headers
- **X-Content-Type-Options**: Prevent MIME sniffing
- **X-Frame-Options**: Clickjacking protection
- **X-XSS-Protection**: XSS filter enablement
- **Content-Security-Policy**: Comprehensive CSP
- **Strict-Transport-Security**: HSTS enforcement
- **Referrer-Policy**: Referrer information control
- **Permissions-Policy**: Feature policy restrictions
- **X-Powered-By Removal**: Hide server information

### ✅ 9. Rate Limiting
- **Multiple Strategies**: Fixed Window, Sliding Window, Token Bucket, Leaky Bucket
- **Per-Endpoint Limits**: Configurable per route
- **Key Generation**: IP-based, user-based, custom keys
- **Burst Support**: Handle traffic spikes
- **Rate Limit Headers**: X-RateLimit-* headers
- **429 Responses**: Proper rate limit exceeded responses

### ✅ 10. Request/Response Logging
- **Structured Logging**: JSON-formatted logs
- **Request Logging**: Method, path, IP, user agent
- **Response Logging**: Status code, duration
- **Error Logging**: Stack traces, error details
- **Request ID Tracing**: Track requests end-to-end
- **Sensitive Data Filtering**: Redact passwords, tokens
- **Performance Metrics**: Latency tracking

### ✅ Additional Features

#### Input Sanitization
- **XSS Prevention**: HTML tag stripping/escaping
- **SQL Injection Protection**: Input sanitization
- **Command Injection Prevention**: Shell character removal
- **Path Traversal Protection**: Directory traversal prevention
- **Recursive Sanitization**: Deep object cleaning

#### Monitoring & Metrics
- **Request Counting**: Total requests per endpoint
- **Error Counting**: Track error rates
- **Latency Tracking**: P50, P95, P99 percentiles
- **Status Code Distribution**: Track response codes
- **Real-time Metrics**: Live performance data

#### Caching
- **Response Caching**: GET request caching
- **TTL Configuration**: Per-endpoint cache lifetime
- **Cache Keys**: Customizable key generation
- **Cache Invalidation**: Automatic expiry
- **Vary Support**: Header-based cache variation

## File Structure

```
src/api/
├── APIGateway.ts           # Core gateway with authentication, validation, rate limiting
├── ProductionHandlers.ts   # Production-ready handlers and middleware
├── APIGatewaySetup.ts      # Gateway configuration and initialization
└── README.md               # This file
```

## Usage

### Initialize the Gateway

```typescript
import { initializeAPIGateway } from './APIGatewaySetup';

// Automatically sets up based on NODE_ENV
const gateway = initializeAPIGateway();
```

### Handle Requests

```typescript
import { apiGateway } from './APIGatewaySetup';
import { APIRequest } from './APIGateway';

const request: APIRequest = {
  method: HTTPMethod.POST,
  path: '/api/users',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGc...',
  },
  query: {},
  params: {},
  body: {
    username: 'john_doe',
    email: 'john@example.com',
    password: 'SecurePass123!',
  },
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
};

const response = await apiGateway.handleRequest(request);
console.log(response);
// {
//   statusCode: 201,
//   headers: { 'Content-Type': 'application/json', ... },
//   body: { success: true, data: { id: 'user_123', ... } }
// }
```

### Register Custom Endpoints

```typescript
import { apiGateway, HTTPMethod } from './APIGateway';
import { RateLimitPresets } from './ProductionHandlers';

apiGateway.registerEndpoint({
  path: '/api/custom/:id',
  method: HTTPMethod.GET,
  handler: async (request, context) => {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        data: { id: request.params.id },
        requestId: context.requestId,
      },
    };
  },
  middleware: [],
  rateLimit: RateLimitPresets.moderate,
  authentication: {
    type: 'bearer',
    required: true,
  },
  authorization: {
    permissions: ['custom:read'],
  },
  tags: ['custom'],
});
```

### Create Custom Middleware

```typescript
import { Middleware } from './APIGateway';

const customMiddleware: Middleware = async (request, context, next) => {
  // Pre-processing
  console.log(`Processing request: ${request.method} ${request.path}`);
  
  // Call next middleware/handler
  const response = await next();
  
  // Post-processing
  response.headers['X-Custom-Header'] = 'CustomValue';
  
  return response;
};

// Add to gateway
apiGateway.use(customMiddleware);
```

## Available Endpoints

### Health Check
- **GET /health** - API health status
- **GET /api/health** - Detailed health check

### User Management
- **POST /api/users** - Create user (requires auth)
- **GET /api/users** - List users with pagination (requires auth)
- **GET /api/users/:userId** - Get user details (requires auth)
- **PUT /api/users/:userId** - Update user (requires auth)
- **PATCH /api/users/:userId** - Partial user update (requires auth)
- **DELETE /api/users/:userId** - Delete user (requires admin role)

### Resource Management
- **POST /api/:resourceType** - Create any resource type (requires auth)

### Batch Operations
- **POST /api/batch** - Execute multiple operations (requires auth)

## Configuration

### Environment Variables

```bash
NODE_ENV=production          # production or development
LOG_LEVEL=info              # Logging level
ENABLE_COMPRESSION=true     # Enable response compression
ENABLE_CACHING=true         # Enable response caching
```

### Rate Limit Presets

```typescript
import { RateLimitPresets } from './ProductionHandlers';

// Strict: 10 requests per minute
RateLimitPresets.strict

// Moderate: 100 requests per minute
RateLimitPresets.moderate

// Permissive: 1000 requests per minute
RateLimitPresets.permissive
```

### CORS Configuration

```typescript
import { defaultCORSConfig } from './ProductionHandlers';

const customCORS = {
  origins: ['https://example.com', 'https://app.example.com'],
  methods: [HTTPMethod.GET, HTTPMethod.POST],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400,
};
```

## Security Best Practices

1. **Always use HTTPS** in production
2. **Rotate JWT secrets** regularly
3. **Implement rate limiting** on all endpoints
4. **Validate all inputs** before processing
5. **Sanitize outputs** to prevent XSS
6. **Use parameterized queries** to prevent SQL injection
7. **Log security events** for audit trails
8. **Monitor for anomalies** in traffic patterns
9. **Keep dependencies updated** for security patches
10. **Use principle of least privilege** for permissions

## Performance Optimization

1. **Response Caching**: Cache GET requests
2. **Compression**: Enable gzip for large responses
3. **Database Indexing**: Index frequently queried fields
4. **Connection Pooling**: Reuse database connections
5. **CDN Usage**: Serve static assets from CDN
6. **Pagination**: Limit result set sizes
7. **Async Processing**: Use queues for heavy operations
8. **Load Balancing**: Distribute traffic across servers

## Monitoring & Observability

### Metrics Available

```typescript
const metrics = apiGateway.getMetrics();
// Returns:
// - requestCount: Total requests
// - errorCount: Total errors
// - averageLatency: Average response time
// - p50Latency, p95Latency, p99Latency: Percentile latencies
// - statusCodes: Distribution of status codes
```

### Logging Format

```json
{
  "type": "REQUEST",
  "requestId": "req_1234567890_abc123",
  "method": "POST",
  "path": "/api/users",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-08-30T12:00:00.000Z"
}
```

## Testing

### Example Test

```typescript
import { apiGateway } from './APIGatewaySetup';
import { HTTPMethod } from './APIGateway';

describe('User API', () => {
  it('should create a user', async () => {
    const request = {
      method: HTTPMethod.POST,
      path: '/api/users',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      query: {},
      params: {},
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
      },
      ip: '127.0.0.1',
    };

    const response = await apiGateway.handleRequest(request);
    
    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
  });
});
```

## Production Deployment Checklist

- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS origins (not *)
- [ ] Enable HTTPS/TLS
- [ ] Set up rate limiting
- [ ] Configure logging aggregation
- [ ] Set up monitoring and alerts
- [ ] Enable response compression
- [ ] Configure cache TTLs appropriately
- [ ] Set up database connection pooling
- [ ] Configure backup and disaster recovery
- [ ] Set up CI/CD pipeline
- [ ] Perform security audit
- [ ] Load test the API
- [ ] Document API with OpenAPI/Swagger
- [ ] Set up API versioning strategy

## License

Internal use only - Part of the agent-cli project.
