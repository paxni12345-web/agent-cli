# API Gateway Error Handling System

Comprehensive error handling implementation for the API Gateway with custom error classes, recovery strategies, circuit breakers, retry logic, and monitoring.

## Table of Contents

1. [Custom Error Classes](#custom-error-classes)
2. [Error Handler](#error-handler)
3. [Error Middleware](#error-middleware)
4. [Circuit Breaker](#circuit-breaker)
5. [Retry Logic](#retry-logic)
6. [Error Recovery](#error-recovery)
7. [Error Monitoring](#error-monitoring)
8. [Stack Trace Sanitization](#stack-trace-sanitization)
9. [Usage Examples](#usage-examples)

---

## Custom Error Classes

### Base Error Class

All gateway errors extend from `APIGatewayError`:

```typescript
class APIGatewayError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  context?: Record<string, any>;
  timestamp: number;
}
```

### Built-in Error Classes

| Error Class | Status Code | Use Case |
|------------|-------------|----------|
| `ValidationError` | 400 | Invalid request data |
| `AuthenticationError` | 401 | Missing or invalid credentials |
| `AuthorizationError` | 403 | Insufficient permissions |
| `NotFoundError` | 404 | Resource not found |
| `TimeoutError` | 408 | Request timeout |
| `PayloadTooLargeError` | 413 | Request body too large |
| `RateLimitError` | 429 | Rate limit exceeded |
| `UpstreamError` | 502 | Upstream service error |
| `ServiceUnavailableError` | 503 | Service unavailable |
| `CircuitBreakerError` | 503 | Circuit breaker open |
| `ConfigurationError` | 500 | Configuration error (non-operational) |

### Usage

```typescript
throw new NotFoundError('User not found', { userId: '123' });

throw new RateLimitError('Too many requests', 60000, {
  limit: 100,
  window: 60000
});

throw new UpstreamError('External API failed', 503, {
  service: 'payment-api'
});
```

---

## Error Handler

The `ErrorHandler` class provides centralized error handling with logging, sanitization, and recovery strategies.

### Features

- **Error Normalization**: Converts any error to `APIGatewayError`
- **Context Enrichment**: Adds request context to errors
- **Stack Trace Sanitization**: Removes sensitive information from stack traces
- **User-Friendly Messages**: Returns appropriate messages for production vs development
- **Error Logging**: Stores errors with full context for debugging
- **Recovery Strategies**: Determines appropriate recovery actions

### Error Context

```typescript
interface ErrorContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userId?: string;
  timestamp: number;
  userAgent?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}
```

### Error Response Format

**Production:**
```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND",
    "timestamp": 1234567890,
    "requestId": "gateway-123-abc"
  }
}
```

**Development:**
```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND",
    "timestamp": 1234567890,
    "requestId": "gateway-123-abc",
    "stack": "sanitized stack trace...",
    "context": { "userId": "123" }
  }
}
```

---

## Error Middleware

### Basic Error Handling

```typescript
import { MiddlewareFactory } from './APIGateway';

const middleware = MiddlewareFactory.errorHandler();
```

### Error Handling with Recovery

```typescript
const middleware = MiddlewareFactory.errorHandler({
  enableRecovery: true,
  fallbackData: { id: 'unknown', name: 'Guest' }
});
```

### Custom Error Middleware

```typescript
const customErrorHandler: Middleware = async (req, res, next) => {
  try {
    await next();
  } catch (error) {
    const errorContext: ErrorContext = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: Date.now(),
    };

    const response = ErrorHandler.handleError(error, errorContext);
    
    res.status = response.status;
    res.body = response.body;
    Object.assign(res.headers, response.headers);
  }
};
```

---

## Circuit Breaker

Prevents cascading failures by temporarily blocking requests to failing services.

### Configuration

```typescript
circuitBreaker: {
  threshold: 5,          // Open after 5 failures
  timeout: 30000,        // Stay open for 30 seconds
  monitoringPeriod: 60000, // Monitor window of 60 seconds
  fallbackResponse: {
    success: false,
    message: 'Service temporarily unavailable'
  }
}
```

### States

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit is open, requests are blocked
- **HALF_OPEN**: Testing if service recovered, allows limited requests

### Usage

```typescript
gateway.registerRoute({
  path: '/api/external',
  method: 'GET',
  target: {
    type: 'upstream',
    upstream: {
      servers: [...],
      circuitBreaker: {
        threshold: 5,
        timeout: 30000,
        monitoringPeriod: 60000
      }
    }
  }
});

// Monitor circuit breaker events
gateway.on('circuit_breaker:opened', (data) => {
  console.error('Circuit opened:', data.serverId);
});

gateway.on('circuit_breaker:closed', (data) => {
  console.log('Circuit closed:', data.serverId);
});

// Manually reset circuit breaker
gateway.resetCircuitBreaker('server1');
```

### Circuit Breaker Middleware

```typescript
const circuitBreaker = MiddlewareFactory.circuitBreaker({
  threshold: 5,
  timeout: 30000,
  monitoringPeriod: 60000,
  fallbackResponse: { error: 'Service unavailable' }
});
```

---

## Retry Logic

Automatic retry for transient failures with configurable backoff strategies.

### Configuration

```typescript
retry: {
  maxAttempts: 3,
  delay: 1000,           // Initial delay in ms
  backoff: 'exponential', // 'fixed' | 'linear' | 'exponential'
  retryableStatuses: [502, 503, 504],
  retryableErrors: ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']
}
```

### Backoff Strategies

- **Fixed**: Same delay for each retry (e.g., 1s, 1s, 1s)
- **Linear**: Linearly increasing delay (e.g., 1s, 2s, 3s)
- **Exponential**: Exponentially increasing delay (e.g., 1s, 2s, 4s)

Jitter (±25%) is automatically added to prevent thundering herd.

### Usage

```typescript
gateway.registerRoute({
  path: '/api/data',
  method: 'GET',
  target: {
    type: 'upstream',
    upstream: { ... }
  },
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoff: 'exponential',
    retryableStatuses: [502, 503, 504],
    retryableErrors: ['ETIMEDOUT']
  }
});

// Monitor retry events
gateway.on('retry:attempt', (data) => {
  console.log(`Retry attempt ${data.attempt} after ${data.delay}ms`);
});
```

---

## Error Recovery

### Recovery Strategies

The `ErrorHandler` determines recovery strategies based on error type:

| Error Type | Strategy | Action |
|-----------|----------|--------|
| `CircuitBreakerError` | `circuit_break` | Stop trying |
| `RateLimitError` | `retry` | Wait and retry |
| `TimeoutError` | `retry` | Retry with backoff |
| `UpstreamError` | `retry` | Retry or fallback |
| `ServiceUnavailableError` | `retry` | Retry with longer delay |
| 4xx errors | `fail` | Fail immediately |
| 5xx errors | `retry` | Retry with backoff |

### Execute with Recovery

```typescript
import { ErrorRecovery } from './APIGateway';

const result = await ErrorRecovery.executeWithRecovery(
  async () => {
    // Potentially failing operation
    return await fetchData();
  },
  {
    maxRetries: 3,
    retryDelay: 1000,
    backoff: 'exponential',
    fallback: { data: [], cached: true },
    onRetry: (attempt, error) => {
      console.log(`Retry ${attempt}: ${error.message}`);
    },
    shouldRetry: (error) => ErrorHandler.isRetryable(error)
  }
);
```

### Execute with Timeout

```typescript
const result = await ErrorRecovery.executeWithTimeout(
  async () => await slowOperation(),
  5000, // 5 second timeout
  new TimeoutError('Operation timed out')
);
```

### Circuit Breaker Pattern

```typescript
const breaker = ErrorRecovery.createCircuitBreaker({
  threshold: 5,
  timeout: 30000,
  monitoringPeriod: 60000,
  fallback: { data: [] }
});

// Use the circuit breaker
const result = await breaker(async () => {
  return await fetchFromUnreliableService();
});
```

### Graceful Degradation

```typescript
const data = await ErrorRecovery.gracefulDegrade(
  // Primary: Fast but may fail
  async () => await fetchFromCache(),
  // Secondary: Slower but more reliable
  async () => await fetchFromDatabase(),
  // Tertiary: Static fallback
  { default: true, data: [] }
);
```

### Fallback Chain

```typescript
const result = await ErrorRecovery.executeWithFallbackChain([
  async () => await fetchFromPrimaryAPI(),
  async () => await fetchFromSecondaryAPI(),
  async () => await fetchFromCache(),
  async () => ({ fallback: true, data: [] })
]);
```

---

## Error Monitoring

### Subscribe to Errors

```typescript
import { ErrorMonitor } from './APIGateway';

const unsubscribe = ErrorMonitor.onError((entry) => {
  console.log(`[${entry.level}] ${entry.error.code}: ${entry.message}`);
  
  // Send to external monitoring (Sentry, DataDog, etc.)
  if (entry.level === 'error') {
    sendToSentry(entry);
  }
});

// Unsubscribe when done
unsubscribe();
```

### Check Thresholds

```typescript
ErrorMonitor.checkThresholds({
  errorRateThreshold: 0.1, // 10% error rate
  timeWindowMs: 60000,     // 1 minute window
  onThresholdExceeded: (stats) => {
    console.error('Error rate exceeded!', stats);
    sendAlert({
      severity: 'high',
      errorRate: stats.errorRate,
      totalErrors: stats.totalErrors
    });
  }
});
```

### Get Error Statistics

```typescript
const stats = ErrorMonitor.getErrorStats(Date.now() - 3600000); // Last hour

console.log('Total errors:', stats.total);
console.log('By code:', stats.byCode);
console.log('By level:', stats.byLevel);
console.log('By status:', stats.byStatusCode);

// Example output:
// {
//   total: 42,
//   byCode: {
//     'TIMEOUT': 15,
//     'UPSTREAM_ERROR': 12,
//     'NOT_FOUND': 10,
//     'VALIDATION_ERROR': 5
//   },
//   byLevel: { 'error': 27, 'warn': 15 },
//   byStatusCode: { '404': 10, '408': 15, '502': 12, '400': 5 }
// }
```

### Get Error Logs

```typescript
const gateway = new APIGateway({ ... });

// Get recent errors
const errors = gateway.getErrorLogs({
  level: 'error',
  since: Date.now() - 3600000, // Last hour
  limit: 50
});

errors.forEach(entry => {
  console.log({
    time: new Date(entry.timestamp).toISOString(),
    code: entry.error.code,
    message: entry.message,
    path: entry.context.path,
    requestId: entry.context.requestId
  });
});
```

### Health Status

```typescript
const health = gateway.getHealthStatus();

console.log('Status:', health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log('Error rate:', health.errorRate);
console.log('Circuit breakers:', health.circuitBreakers);
console.log('Recent errors:', health.recentErrors);

// Example output:
// {
//   status: 'degraded',
//   uptime: 3600000,
//   metrics: { ... },
//   circuitBreakers: [
//     { serverId: 'server1', state: 'open', failures: 5 }
//   ],
//   errorRate: 0.15,
//   recentErrors: [ ... ]
// }
```

---

## Stack Trace Sanitization

Stack traces are automatically sanitized to:

1. **Remove absolute paths**: Keep only relative paths (last 3 segments)
2. **Filter node_modules**: Remove internal dependencies
3. **Limit depth**: Show only top 10 stack frames
4. **Production mode**: Stack traces not shown in production

**Before sanitization:**
```
Error: Connection failed
    at Request.request (/home/user/app/node_modules/axios/lib/core/request.js:123:45)
    at /home/user/app/src/services/api.service.ts:45:23
    at /home/user/app/node_modules/express/lib/router/route.js:234:56
```

**After sanitization:**
```
Error: Connection failed
    at (app/src/services/api.service.ts:45:23)
```

---

## Usage Examples

### Basic Route with Error Handling

```typescript
gateway.registerRoute({
  path: '/api/users/:id',
  method: 'GET',
  target: {
    type: 'function',
    handler: async (req: Request): Promise<Response> => {
      const user = await db.findUser(req.params.id);
      
      if (!user) {
        throw new NotFoundError('User not found', { userId: req.params.id });
      }
      
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true, data: user }
      };
    }
  },
  middleware: [
    MiddlewareFactory.errorHandler()
  ]
});
```

### Upstream with Circuit Breaker and Retry

```typescript
gateway.registerRoute({
  path: '/api/payments',
  method: 'POST',
  target: {
    type: 'upstream',
    upstream: {
      servers: [
        { id: 'payment-1', url: 'http://payment-service:8080', ... }
      ],
      loadBalancing: 'round_robin',
      circuitBreaker: {
        threshold: 5,
        timeout: 30000,
        monitoringPeriod: 60000
      }
    }
  },
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoff: 'exponential',
    retryableStatuses: [502, 503, 504],
    retryableErrors: ['ETIMEDOUT', 'ECONNREFUSED']
  }
});
```

### Complete Production Setup

```typescript
const gateway = new APIGateway({
  port: 8080,
  enableCircuitBreaker: true,
  enableRateLimiting: true,
  enableRequestLogging: true,
});

// Error monitoring
ErrorMonitor.onError((entry) => {
  if (entry.level === 'error') {
    sendToSentry(entry);
  }
});

// Health monitoring
setInterval(() => {
  const health = gateway.getHealthStatus();
  if (health.status !== 'healthy') {
    sendAlert({ severity: 'warning', health });
  }
}, 60000);

await gateway.start();
```

---

## Best Practices

1. **Use Specific Error Classes**: Use appropriate error classes for different scenarios
2. **Add Context**: Include relevant context when throwing errors
3. **Set Operational Flag**: Mark operational vs programming errors correctly
4. **Enable Circuit Breakers**: For all upstream services
5. **Configure Retries**: Use exponential backoff with jitter
6. **Monitor Error Rates**: Set up alerting for error threshold breaches
7. **Log with Context**: Include request ID, user ID, and relevant metadata
8. **Graceful Degradation**: Provide fallbacks for non-critical features
9. **Test Error Paths**: Ensure error handling works as expected
10. **Document Recovery**: Document what happens when errors occur

---

## API Reference

See `APIGateway.ts` for complete API documentation and type definitions.

---

## License

MIT
