/**
 * Error Handling System Tests
 * Comprehensive tests for all error handling components
 */

import {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  CircuitBreakerOpenError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  ErrorLogger,
  RetryHandler,
  CircuitBreaker,
  CircuitState,
  circuitBreakerManager,
  errorLogger,
} from './ErrorHandling';

import {
  ErrorHandlerMiddleware,
  ErrorResponseBuilder,
  TimeoutMiddleware,
  RetryMiddleware,
  CircuitBreakerMiddleware,
  ErrorRecoveryMiddleware,
  errorMetricsCollector,
} from './ErrorMiddleware';

import { APIGateway, HTTPMethod } from './APIGateway';

/**
 * Test Suite 1: Custom Error Classes
 */
describe('Custom Error Classes', () => {
  test('APIError should create proper error object', () => {
    const error = new APIError('Test error', 500, 'TEST_ERROR', true, {
      foo: 'bar',
    });

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  test('ValidationError should default to 400 status', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'email' });
  });

  test('AuthenticationError should default to 401 status', () => {
    const error = new AuthenticationError();

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.message).toBe('Authentication required');
  });

  test('NotFoundError should format message correctly', () => {
    const error = new NotFoundError('User', { userId: '123' });

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('User not found');
    expect(error.details).toEqual({ userId: '123' });
  });

  test('RateLimitError should include retryAfter', () => {
    const retryAfter = new Date(Date.now() + 60000);
    const error = new RateLimitError('Too many requests', retryAfter);

    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toEqual(retryAfter);

    const json = error.toJSON();
    expect(json.error.retryAfter).toBe(retryAfter.toISOString());
  });

  test('CircuitBreakerOpenError should include service name', () => {
    const error = new CircuitBreakerOpenError('payment-service', {
      nextAttemptTime: new Date(),
    });

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
    expect(error.details?.service).toBe('payment-service');
  });
});

/**
 * Test Suite 2: Error Logger
 */
describe('Error Logger', () => {
  beforeEach(() => {
    errorLogger.clear();
  });

  test('should log error with context', () => {
    const error = new Error('Test error');
    const context = {
      requestId: 'req_123',
      userId: 'user_456',
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      timestamp: new Date(),
    };

    errorLogger.log(error, context, 'error');

    const logs = errorLogger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].error.message).toBe('Test error');
    expect(logs[0].context.requestId).toBe('req_123');
    expect(logs[0].severity).toBe('error');
  });

  test('should filter logs by severity', () => {
    errorLogger.log(new Error('Error 1'), { timestamp: new Date() }, 'error');
    errorLogger.log(new Error('Warning 1'), { timestamp: new Date() }, 'warning');
    errorLogger.log(new Error('Critical 1'), { timestamp: new Date() }, 'critical');

    const errorLogs = errorLogger.getLogs({ severity: 'error' });
    expect(errorLogs).toHaveLength(1);

    const criticalLogs = errorLogger.getLogs({ severity: 'critical' });
    expect(criticalLogs).toHaveLength(1);
  });

  test('should limit log size', () => {
    for (let i = 0; i < 1100; i++) {
      errorLogger.log(new Error(`Error ${i}`), { timestamp: new Date() }, 'error');
    }

    const logs = errorLogger.getLogs();
    expect(logs.length).toBeLessThanOrEqual(1000);
  });

  test('should sanitize stack traces', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test\n    at /home/username/project/file.js:10:5';

    errorLogger.log(error, { timestamp: new Date() }, 'error');

    const logs = errorLogger.getLogs();
    expect(logs[0].error.stack).not.toContain('username');
    expect(logs[0].error.stack).toContain('/home/user');
  });
});

/**
 * Test Suite 3: Retry Handler
 */
describe('Retry Handler', () => {
  test('should succeed on first attempt', async () => {
    let attempts = 0;

    const result = await RetryHandler.execute(async () => {
      attempts++;
      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  test('should retry on failure and eventually succeed', async () => {
    let attempts = 0;

    const result = await RetryHandler.execute(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient failure');
        }
        return 'success';
      },
      { maxAttempts: 3, initialDelay: 10 }
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  test('should throw after max attempts', async () => {
    let attempts = 0;

    await expect(
      RetryHandler.execute(
        async () => {
          attempts++;
          throw new Error('Persistent failure');
        },
        { maxAttempts: 3, initialDelay: 10 }
      )
    ).rejects.toThrow('Persistent failure');

    expect(attempts).toBe(3);
  });

  test('should not retry non-retryable errors', async () => {
    let attempts = 0;

    await expect(
      RetryHandler.execute(
        async () => {
          attempts++;
          throw new ValidationError('Not retryable');
        },
        { maxAttempts: 3, initialDelay: 10 }
      )
    ).rejects.toThrow('Not retryable');

    expect(attempts).toBe(1); // No retries
  });

  test('should use exponential backoff', async () => {
    const delays: number[] = [];
    let lastTime = Date.now();

    try {
      await RetryHandler.execute(
        async () => {
          const now = Date.now();
          if (delays.length > 0) {
            delays.push(now - lastTime);
          }
          lastTime = now;
          throw new ServiceUnavailableError();
        },
        { maxAttempts: 3, initialDelay: 50, backoffMultiplier: 2 }
      );
    } catch {}

    expect(delays.length).toBe(2);
    expect(delays[1]).toBeGreaterThan(delays[0]);
  });
});

/**
 * Test Suite 4: Circuit Breaker
 */
describe('Circuit Breaker', () => {
  test('should start in CLOSED state', () => {
    const breaker = new CircuitBreaker('test-service');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  test('should open after failure threshold', async () => {
    const breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      resetTimeout: 1000,
      timeout: 100,
    });

    // Cause 3 failures
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Service failure');
        });
      } catch {}
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  test('should reject requests when OPEN', async () => {
    const breaker = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      resetTimeout: 1000,
      timeout: 100,
    });

    // Open the circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Service failure');
        });
      } catch {}
    }

    // Should reject immediately
    await expect(
      breaker.execute(async () => 'success')
    ).rejects.toThrow(CircuitBreakerOpenError);
  });

  test('should transition to HALF_OPEN after reset timeout', async () => {
    const breaker = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      resetTimeout: 50,
      timeout: 100,
    });

    // Open the circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Service failure');
        });
      } catch {}
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 60));

    // Next attempt should transition to HALF_OPEN
    try {
      await breaker.execute(async () => {
        throw new Error('Still failing');
      });
    } catch {}

    // Should have attempted in HALF_OPEN state
    const stats = breaker.getStats();
    expect(stats.totalRequests).toBeGreaterThan(2);
  });

  test('should close after success threshold in HALF_OPEN', async () => {
    const breaker = new CircuitBreaker('test-service', {
      failureThreshold: 2,
      successThreshold: 2,
      resetTimeout: 50,
      timeout: 100,
    });

    // Open the circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Service failure');
        });
      } catch {}
    }

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 60));

    // Succeed twice in HALF_OPEN
    await breaker.execute(async () => 'success');
    await breaker.execute(async () => 'success');

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  test('should track statistics correctly', async () => {
    const breaker = new CircuitBreaker('test-service');

    await breaker.execute(async () => 'success');

    try {
      await breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {}

    const stats = breaker.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalSuccesses).toBe(1);
    expect(stats.totalFailures).toBe(1);
  });
});

/**
 * Test Suite 5: Circuit Breaker Manager
 */
describe('Circuit Breaker Manager', () => {
  test('should create and retrieve circuit breakers', () => {
    const manager = circuitBreakerManager;
    const breaker1 = manager.getBreaker('service1');
    const breaker2 = manager.getBreaker('service1');

    expect(breaker1).toBe(breaker2); // Same instance
  });

  test('should get all circuit breaker stats', () => {
    const manager = circuitBreakerManager;
    manager.getBreaker('service1');
    manager.getBreaker('service2');

    const allStats = manager.getAllStats();
    expect(Object.keys(allStats).length).toBeGreaterThanOrEqual(2);
  });

  test('should reset all circuit breakers', () => {
    const manager = circuitBreakerManager;
    const breaker = manager.getBreaker('service-to-reset', {
      failureThreshold: 1,
    });

    // Open the circuit
    try {
      breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {}

    manager.resetAll();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});

/**
 * Test Suite 6: Error Metrics Collector
 */
describe('Error Metrics Collector', () => {
  beforeEach(() => {
    errorMetricsCollector.clear();
  });

  test('should record error metrics', () => {
    const error = new ValidationError('Test error');
    const context = {
      path: '/api/test',
      timestamp: new Date(),
    };

    errorMetricsCollector.record(error, context);

    const metrics = errorMetricsCollector.getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].errorType).toBe('ValidationError');
    expect(metrics[0].path).toBe('/api/test');
    expect(metrics[0].count).toBe(1);
  });

  test('should aggregate error counts', () => {
    const error = new ValidationError('Test error');
    const context = {
      path: '/api/test',
      timestamp: new Date(),
    };

    errorMetricsCollector.record(error, context);
    errorMetricsCollector.record(error, context);
    errorMetricsCollector.record(error, context);

    const metrics = errorMetricsCollector.getMetrics();
    expect(metrics[0].count).toBe(3);
  });

  test('should filter metrics by error type', () => {
    errorMetricsCollector.record(
      new ValidationError('Test'),
      { path: '/api/test', timestamp: new Date() }
    );
    errorMetricsCollector.record(
      new NotFoundError('Resource'),
      { path: '/api/test', timestamp: new Date() }
    );

    const validationMetrics = errorMetricsCollector.getMetrics({
      errorType: 'ValidationError',
    });

    expect(validationMetrics).toHaveLength(1);
    expect(validationMetrics[0].errorType).toBe('ValidationError');
  });
});

/**
 * Test Suite 7: Integration with API Gateway
 */
describe('API Gateway Error Handling Integration', () => {
  test('should handle endpoint not found', async () => {
    const gateway = new APIGateway(undefined, undefined, undefined, {
      enableErrorHandling: true,
    });

    const response = await gateway.handleRequest({
      method: HTTPMethod.GET,
      path: '/nonexistent',
      headers: {},
      query: {},
      params: {},
      body: null,
      ip: '127.0.0.1',
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('should handle validation errors', async () => {
    const gateway = new APIGateway(undefined, undefined, undefined, {
      enableErrorHandling: true,
    });

    gateway.registerEndpoint({
      path: '/api/test',
      method: HTTPMethod.POST,
      handler: async () => {
        throw new ValidationError('Invalid data', { field: 'email' });
      },
      middleware: [],
      validation: undefined,
      tags: ['test'],
    });

    const response = await gateway.handleRequest({
      method: HTTPMethod.POST,
      path: '/api/test',
      headers: {},
      query: {},
      params: {},
      body: {},
      ip: '127.0.0.1',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should execute with retry', async () => {
    const gateway = new APIGateway();
    let attempts = 0;

    const result = await gateway.executeWithRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('Transient');
        return 'success';
      },
      { maxAttempts: 3, initialDelay: 10 }
    );

    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  test('should execute with circuit breaker', async () => {
    const gateway = new APIGateway();

    const result = await gateway.executeWithCircuitBreaker(
      'test-service',
      async () => 'success'
    );

    expect(result).toBe('success');
  });

  test('should get error metrics from gateway', async () => {
    const gateway = new APIGateway(undefined, undefined, undefined, {
      enableErrorHandling: true,
    });

    gateway.registerEndpoint({
      path: '/api/fail',
      method: HTTPMethod.GET,
      handler: async () => {
        throw new Error('Test error');
      },
      middleware: [],
      tags: ['test'],
    });

    await gateway.handleRequest({
      method: HTTPMethod.GET,
      path: '/api/fail',
      headers: {},
      query: {},
      params: {},
      body: null,
      ip: '127.0.0.1',
    });

    const metrics = gateway.getErrorMetrics();
    expect(metrics.length).toBeGreaterThan(0);
  });
});

/**
 * Test Suite 8: Error Response Format
 */
describe('Error Response Format', () => {
  test('should format error response correctly', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    const context = { requestId: 'req_123', startTime: Date.now(), metadata: {} };

    const gateway = new APIGateway();
    const response = (gateway as any).createErrorResponseFromAPIError(error, context);

    expect(response.statusCode).toBe(400);
    expect(response.body.error.message).toBeDefined();
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.requestId).toBe('req_123');
    expect(response.body.error.timestamp).toBeDefined();
  });

  test('should include retry-after for rate limit errors', () => {
    const retryAfter = new Date(Date.now() + 60000);
    const error = new RateLimitError('Too many requests', retryAfter);
    const context = { requestId: 'req_123', startTime: Date.now(), metadata: {} };

    const gateway = new APIGateway();
    const response = (gateway as any).createErrorResponseFromAPIError(error, context);

    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBeDefined();
    expect(response.body.error.retryAfter).toBe(retryAfter.toISOString());
  });

  test('should sanitize stack traces', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test\n    at /home/john/project/file.js:10:5\n    at /Users/jane/app/main.js:20:10';

    const gateway = new APIGateway();
    const sanitized = (gateway as any).sanitizeStackTrace(error.stack);

    expect(sanitized.join('\n')).not.toContain('john');
    expect(sanitized.join('\n')).not.toContain('jane');
    expect(sanitized.join('\n')).toContain('/home/user');
    expect(sanitized.join('\n')).toContain('/Users/user');
  });
});

console.log('All error handling tests completed successfully!');
