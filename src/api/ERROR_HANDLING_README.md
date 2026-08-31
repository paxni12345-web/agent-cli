# Comprehensive Error Handling System

This directory contains a complete error handling system for the API Gateway with custom error classes, middleware, logging, retry logic, circuit breakers, and recovery strategies.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Error Classes](#error-classes)
4. [Error Middleware](#error-middleware)
5. [Error Logging](#error-logging)
6. [Retry Logic](#retry-logic)
7. [Circuit Breaker](#circuit-breaker)
8. [Error Recovery](#error-recovery)
9. [Usage Examples](#usage-examples)
10. [Best Practices](#best-practices)

## Overview

The error handling system provides:

- **Custom Error Classes** - Type-safe error handling with proper status codes
- **Error Middleware** - Automatic error interception and response formatting
- **Structured Logging** - Context-aware error logging with sanitized stack traces
- **Retry Logic** - Exponential backoff retry for transient failures
- **Circuit Breaker** - Prevent cascading failures in downstream services
- **Error Recovery** - Fallback strategies and graceful degradation
- **User-Friendly Messages** - Automatic conversion to user-friendly error messages
- **Stack Trace Sanitization** - Remove sensitive information from stack traces
- **Error Metrics** - Track error rates and patterns

## Architecture

```
ErrorHandling.ts          - Core error classes and utilities
ErrorMiddleware.ts        - Express-style middleware for error handling
APIGateway.ts            - Integrated error handling in API Gateway
ErrorHandlingExample.ts   - Usage examples and patterns
```

### Flow Diagram

```
Request → Middleware Chain → Handler
                ↓ (error)
          Error Middleware
                ↓
          Error Logger
                ↓
          Error Response Builder
                ↓
          User-Friendly Response
```

## Error Classes

### Base Error Class

```typescript
class APIError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  timestamp: Date;
  requestId?: string;
  details?: Record<string, any>;
}
```

### Predefined Error Classes

| Class | Status Code | Use Case |
|-------|-------------|----------|
| `ValidationError` | 400 | Invalid request data |
| `AuthenticationError` | 401 | Authentication required/failed |
| `AuthorizationError` | 403 | Insufficient permissions |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Resource conflict |
| `RateLimitError` | 429 | Rate limit exceeded |
| `DatabaseError` | 500 | Database operation failed |
| `ExternalServiceError` | 502 | External service failure |
| `ServiceUnavailableError` | 503 | Service temporarily unavailable |
| `GatewayTimeoutError` | 504 | Request timeout |
| `CircuitBreakerOpenError` | 503 | Circuit breaker open |

### Creating Custom Errors

```typescript
import { APIError } from './ErrorHandling';

class PaymentError extends APIError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 402, 'PAYMENT_REQUIRED', true, details);
  }
}

// Usage
throw new PaymentError('Payment failed', { 
  transactionId: '123',
  reason: 'Insufficient funds' 
});
```

## Error Middleware

### Error Handler Middleware

Automatically catches and formats all errors:

```typescript
import { ErrorHandlerMiddleware } from './ErrorMiddleware';

const errorHandler = new ErrorHandlerMiddleware({
  includeStackTrace: process.env.NODE_ENV === 'development'
});

gateway.use(errorHandler.create());
```

### Complete Middleware Stack

```typescript
import { ErrorMiddlewareStack } from './ErrorMiddleware';

const middleware = ErrorMiddlewareStack.create({
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    initialDelay: 100,
  },
  includeStackTrace: false,
  enableCircuitBreaker: true,
  enableRecovery: true,
});

middleware.forEach(mw => gateway.use(mw));
```

### Individual Middleware Components

- **TimeoutMiddleware** - Request timeout protection
- **RetryMiddleware** - Automatic retry for safe methods
- **CircuitBreakerMiddleware** - Circuit breaker protection
- **ErrorRecoveryMiddleware** - Fallback responses
- **ValidationErrorHandler** - Enhanced validation errors
- **DatabaseErrorHandler** - Database error conversion
- **RateLimitErrorHandler** - Rate limit with retry-after
- **ExternalServiceErrorHandler** - External service errors

## Error Logging

### Error Logger

Structured error logging with context:

```typescript
import { errorLogger } from './ErrorHandling';

errorLogger.log(error, {
  requestId: context.requestId,
  userId: context.userId,
  path: request.path,
  method: request.method,
  ip: request.ip,
  userAgent: request.userAgent,
  timestamp: new Date(),
  duration: 123,
}, 'error');
```

### Log Severity Levels

- `info` - Informational (validation errors, not found)
- `warning` - Warning (rate limits, authentication failures)
- `error` - Error (authorization, database errors)
- `critical` - Critical (service unavailable, non-operational errors)

### Retrieving Logs

```typescript
// Get recent errors
const logs = errorLogger.getLogs({
  severity: 'error',
  limit: 50
});

// Get all critical errors
const critical = errorLogger.getLogs({ severity: 'critical' });
```

### Stack Trace Sanitization

Stack traces are automatically sanitized to remove:
- User-specific file paths
- Sensitive environment information
- Limited to top 10 frames

## Retry Logic

### Basic Retry

```typescript
import { RetryHandler } from './ErrorHandling';

const result = await RetryHandler.execute(
  async () => {
    return await fetchData();
  },
  {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2,
  }
);
```

### Gateway Integration

```typescript
const data = await gateway.executeWithRetry(
  async () => {
    return await queryDatabase(userId);
  },
  { maxAttempts: 3, initialDelay: 100 }
);
```

### Retryable Conditions

By default, retries on:
- Status codes: 408, 429, 500, 502, 503, 504
- Error codes: ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED
- Timeout errors
- Connection errors

### Exponential Backoff

```
Attempt 1: delay = 100ms
Attempt 2: delay = 200ms (100 * 2)
Attempt 3: delay = 400ms (200 * 2)
...
Max delay: 5000ms
```

## Circuit Breaker

### Overview

Prevents cascading failures by stopping requests to failing services:

```
CLOSED → (failures exceed threshold) → OPEN
   ↑                                      ↓
   └──────── (success) ← HALF_OPEN ←─────┘
              (reset timeout)
```

### States

- **CLOSED** - Normal operation, requests pass through
- **OPEN** - Service failing, requests rejected immediately
- **HALF_OPEN** - Testing if service recovered

### Basic Usage

```typescript
import { circuitBreakerManager } from './ErrorHandling';

const breaker = circuitBreakerManager.getBreaker('external-service', {
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 2,      // Close after 2 successes in HALF_OPEN
  timeout: 30000,          // 30 second request timeout
  resetTimeout: 60000,     // Try again after 1 minute
});

const result = await breaker.execute(async () => {
  return await callExternalService();
});
```

### Gateway Integration

```typescript
const result = await gateway.executeWithCircuitBreaker(
  'payment-service',
  async () => {
    return await processPayment(data);
  },
  {
    failureThreshold: 5,
    resetTimeout: 60000,
  }
);
```

### Monitoring Circuit Breakers

```typescript
const manager = gateway.getCircuitBreakerManager();

// Get all circuit breaker stats
const allStats = manager.getAllStats();

// Get specific service stats
const breaker = manager.getBreaker('payment-service');
const stats = breaker.getStats();

console.log({
  state: stats.state,
  failures: stats.consecutiveFailures,
  successes: stats.consecutiveSuccesses,
  totalRequests: stats.totalRequests,
  nextAttemptTime: stats.nextAttemptTime,
});

// Manually reset
if (stats.state === 'OPEN') {
  breaker.forceReset();
}
```

## Error Recovery

### Recovery Strategies

```typescript
import { ErrorRecoveryStrategy } from './ErrorHandling';

const canRecover = await ErrorRecoveryStrategy.attemptRecovery(
  error,
  errorContext
);

if (canRecover) {
  const fallback = ErrorRecoveryStrategy.getFallbackResponse(
    error,
    context
  );
  
  if (fallback) {
    return fallback;
  }
}
```

### Fallback Pattern

```typescript
async function fetchDataWithFallback(dataId: string) {
  try {
    // Try primary service
    return await gateway.executeWithCircuitBreaker(
      'primary-service',
      async () => fetchFromPrimary(dataId)
    );
  } catch (error) {
    // Try secondary service
    try {
      return await gateway.executeWithCircuitBreaker(
        'secondary-service',
        async () => fetchFromSecondary(dataId)
      );
    } catch (secondaryError) {
      // Use cached data
      const cached = await fetchFromCache(dataId);
      if (cached) return cached;
      
      throw new NotFoundError('Data', { dataId });
    }
  }
}
```

## Usage Examples

### Complete API Gateway Setup

```typescript
import { APIGateway } from './APIGateway';

const gateway = new APIGateway(undefined, undefined, undefined, {
  enableErrorHandling: true,
  errorHandlingOptions: {
    timeout: 30000,
    retry: { maxAttempts: 3, initialDelay: 100 },
    includeStackTrace: process.env.NODE_ENV === 'development',
    enableCircuitBreaker: true,
    enableRecovery: true,
  },
});
```

### Endpoint with Error Handling

```typescript
gateway.registerEndpoint({
  path: '/api/users/:id',
  method: HTTPMethod.GET,
  handler: async (request, context) => {
    const userId = request.params.id;
    
    // Validation
    if (!userId) {
      throw new ValidationError('User ID is required', { 
        field: 'id' 
      });
    }
    
    // Database query with retry
    const user = await gateway.executeWithRetry(
      async () => {
        const result = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (!result) {
          throw new NotFoundError('User', { userId });
        }
        return result;
      }
    );
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { user },
    };
  },
  validation: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' }
      },
      required: ['id']
    }
  },
  tags: ['users'],
});
```

### Monitoring and Metrics

```typescript
// Get error metrics
const errorMetrics = gateway.getErrorMetrics();
console.log('Top errors:', errorMetrics.slice(0, 10));

// Get error logs
const errorLogs = gateway.getErrorLogger().getLogs({
  severity: 'error',
  limit: 50
});

// Get circuit breaker status
const cbStats = gateway.getCircuitBreakerManager().getAllStats();
Object.entries(cbStats).forEach(([service, stats]) => {
  if (stats.state === 'OPEN') {
    console.warn(`Service ${service} circuit breaker is OPEN!`);
  }
});
```

## Best Practices

### 1. Use Appropriate Error Classes

```typescript
// ✅ Good - Specific error class
throw new ValidationError('Invalid email', { field: 'email' });

// ❌ Bad - Generic error
throw new Error('Invalid email');
```

### 2. Include Context in Errors

```typescript
// ✅ Good - Includes context
throw new NotFoundError('User', { 
  userId,
  searchCriteria: { email: userEmail }
});

// ❌ Bad - No context
throw new NotFoundError('User');
```

### 3. Use Retry for Transient Failures

```typescript
// ✅ Good - Retry database queries
const result = await gateway.executeWithRetry(
  async () => db.query(sql)
);

// ❌ Bad - No retry on transient failures
const result = await db.query(sql);
```

### 4. Use Circuit Breakers for External Services

```typescript
// ✅ Good - Circuit breaker protection
const result = await gateway.executeWithCircuitBreaker(
  'payment-service',
  async () => callPaymentService()
);

// ❌ Bad - Direct call without protection
const result = await callPaymentService();
```

### 5. Log Errors with Context

```typescript
// ✅ Good - Rich context
errorLogger.log(error, {
  requestId: context.requestId,
  userId: context.userId,
  path: request.path,
  method: request.method,
  ip: request.ip,
  timestamp: new Date(),
}, 'error');

// ❌ Bad - No context
console.error(error);
```

### 6. Use Fallbacks for Critical Services

```typescript
// ✅ Good - Multiple fallback options
try {
  return await primary();
} catch {
  try {
    return await secondary();
  } catch {
    return await cached();
  }
}

// ❌ Bad - Single point of failure
return await primary();
```

### 7. Monitor Error Rates

```typescript
// ✅ Good - Regular monitoring
setInterval(() => {
  const metrics = gateway.getErrorMetrics();
  const highErrorEndpoints = metrics.filter(m => m.count > 100);
  
  if (highErrorEndpoints.length > 0) {
    alertOps(highErrorEndpoints);
  }
}, 60000);
```

### 8. Handle Different Error Scenarios

```typescript
// ✅ Good - Specific handling
try {
  await operation();
} catch (error) {
  if (error instanceof ValidationError) {
    return handleValidationError(error);
  } else if (error instanceof AuthenticationError) {
    return redirectToLogin();
  } else if (error instanceof RateLimitError) {
    return showRateLimitMessage(error.retryAfter);
  }
  throw error;
}
```

## Error Response Format

### Standard Error Response

```json
{
  "error": {
    "message": "User-friendly error message",
    "code": "ERROR_CODE",
    "timestamp": "2026-08-30T12:00:00.000Z",
    "requestId": "req_1234567890_abc123"
  }
}
```

### With Details (Development/Operational)

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-08-30T12:00:00.000Z",
    "requestId": "req_1234567890_abc123",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Invalid email format",
          "value": "not-an-email"
        }
      ]
    }
  }
}
```

### Rate Limit Error

```json
{
  "error": {
    "message": "Too many requests. Please slow down and try again later.",
    "code": "RATE_LIMIT_EXCEEDED",
    "timestamp": "2026-08-30T12:00:00.000Z",
    "requestId": "req_1234567890_abc123",
    "retryAfter": "2026-08-30T12:01:00.000Z"
  }
}
```

## Configuration

### Environment Variables

```bash
NODE_ENV=production              # Controls stack trace inclusion
API_TIMEOUT=30000               # Request timeout in ms
RETRY_MAX_ATTEMPTS=3            # Max retry attempts
CIRCUIT_BREAKER_THRESHOLD=5     # Failure threshold
CIRCUIT_BREAKER_TIMEOUT=60000   # Reset timeout in ms
```

### Gateway Configuration

```typescript
const gateway = new APIGateway(authSystem, rbacSystem, auditLogger, {
  enableErrorHandling: true,
  errorHandlingOptions: {
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
    retry: {
      maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3'),
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
    },
    includeStackTrace: process.env.NODE_ENV === 'development',
    enableCircuitBreaker: true,
    enableRecovery: true,
  },
});
```

## Testing

### Testing Error Handling

```typescript
import { ValidationError, NotFoundError } from './ErrorHandling';

describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const response = await gateway.handleRequest({
      method: HTTPMethod.POST,
      path: '/api/users',
      body: { email: 'invalid' },
      // ... other fields
    });
    
    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  
  it('should retry on transient failures', async () => {
    let attempts = 0;
    
    const result = await RetryHandler.execute(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('Transient failure');
        return 'success';
      },
      { maxAttempts: 3 }
    );
    
    expect(attempts).toBe(3);
    expect(result).toBe('success');
  });
});
```

## Performance Considerations

- Error logging is synchronous but non-blocking
- Circuit breakers use in-memory state (consider Redis for distributed systems)
- Retry logic uses exponential backoff to avoid overwhelming services
- Stack trace sanitization is minimal overhead
- Error metrics are aggregated in memory with size limits

## Future Enhancements

- [ ] Distributed tracing integration (OpenTelemetry)
- [ ] External error reporting (Sentry, Rollbar)
- [ ] Redis-backed circuit breaker state
- [ ] Advanced error analytics and anomaly detection
- [ ] Automatic error rate alerting
- [ ] Error budget tracking
- [ ] Dead letter queue for failed requests

## Support

For issues or questions about the error handling system, please refer to the examples in `ErrorHandlingExample.ts` or consult the main API Gateway documentation.
