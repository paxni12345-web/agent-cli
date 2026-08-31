/**
 * Comprehensive Error Handling Tests
 */

import {
  APIGatewayError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ServiceUnavailableError,
  BadGatewayError,
  CircuitBreakerOpenError,
  PayloadTooLargeError,
  ConflictError,
  UpstreamError,
  ErrorLogger,
  ErrorResponseFormatter,
  StackTraceSanitizer,
  RetryStrategy,
  EnhancedCircuitBreaker,
  ErrorRecoveryManager,
  CacheRecoveryStrategy,
} from '../ErrorHandling';

describe('Custom Error Classes', () => {
  describe('APIGatewayError', () => {
    it('should create error with all properties', () => {
      const error = new APIGatewayError(
        'Test error',
        500,
        'TEST_ERROR',
        true,
        { key: 'value' },
        'req-123'
      );

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ key: 'value' });
      expect(error.requestId).toBe('req-123');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should serialize to JSON', () => {
      const error = new APIGatewayError('Test', 400, 'TEST', true, { a: 1 }, 'req-1');
      const json = error.toJSON();

      expect(json.name).toBe('APIGatewayError');
      expect(json.message).toBe('Test');
      expect(json.statusCode).toBe(400);
      expect(json.code).toBe('TEST');
      expect(json.requestId).toBe('req-1');
      expect(json.context).toEqual({ a: 1 });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct defaults', () => {
      const error = new ValidationError('Invalid input', { field: 'email' }, 'req-123');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.isOperational).toBe(true);
    });
  });

  describe('RateLimitError', () => {
    it('should include retryAfter property', () => {
      const error = new RateLimitError('Too many requests', 60, { limit: 100 }, 'req-123');

      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('UpstreamError', () => {
    it('should include upstream service details', () => {
      const error = new UpstreamError('Service failed', 'api.example.com', 502, 'req-123');

      expect(error.upstreamService).toBe('api.example.com');
      expect(error.upstreamStatus).toBe(502);
      expect(error.statusCode).toBe(502);
    });
  });
});

describe('StackTraceSanitizer', () => {
  describe('sanitize', () => {
    it('should sanitize passwords', () => {
      const input = 'Error: password=secret123 in request';
      const output = StackTraceSanitizer.sanitize(input);

      expect(output).not.toContain('secret123');
      expect(output).toContain('password=');
    });

    it('should sanitize tokens', () => {
      const input = 'token: abc123xyz';
      const output = StackTraceSanitizer.sanitize(input);

      expect(output).not.toContain('abc123xyz');
      expect(output).toContain('***');
    });

    it('should sanitize API keys', () => {
      const input = 'api_key=sk_live_1234567890';
      const output = StackTraceSanitizer.sanitize(input);

      expect(output).not.toContain('sk_live_1234567890');
    });

    it('should sanitize email addresses', () => {
      const input = 'Error for user@example.com';
      const output = StackTraceSanitizer.sanitize(input);

      expect(output).not.toContain('user@example.com');
      expect(output).toContain('***');
    });

    it('should sanitize authorization headers', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const output = StackTraceSanitizer.sanitize(input);

      expect(output).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });
  });

  describe('filterInternalFrames', () => {
    it('should remove node_modules frames', () => {
      const stack = `Error: test
  at func1 (/app/src/file.ts:10:5)
  at func2 (/app/node_modules/library/index.js:20:10)
  at func3 (/app/src/other.ts:30:15)`;

      const filtered = StackTraceSanitizer.filterInternalFrames(stack);

      expect(filtered).toContain('/app/src/file.ts');
      expect(filtered).toContain('/app/src/other.ts');
      expect(filtered).not.toContain('node_modules');
    });
  });

  describe('getRelevantFrames', () => {
    it('should limit stack trace to specified number of lines', () => {
      const stack = Array(20).fill('  at something').join('\n');
      const limited = StackTraceSanitizer.getRelevantFrames(stack, 5);

      const lines = limited.split('\n');
      expect(lines.length).toBe(5);
    });
  });
});

describe('ErrorLogger', () => {
  let logger: ErrorLogger;

  beforeEach(() => {
    logger = new ErrorLogger(100);
  });

  it('should log errors with context', () => {
    const error = new ValidationError('Test error', undefined, 'req-123');
    const context = {
      requestId: 'req-123',
      method: 'POST',
      path: '/api/test',
      ip: '127.0.0.1',
      userAgent: 'test',
      timestamp: new Date(),
    };

    const log = logger.log(error, context);

    expect(log.id).toBeDefined();
    expect(log.error).toBe(error);
    expect(log.context.requestId).toBe('req-123');
    expect(log.severity).toBe('low');
  });

  it('should determine severity correctly', () => {
    const lowError = new ValidationError('Low', undefined, 'req-1');
    const highError = new ServiceUnavailableError('High', undefined, 'req-2');
    const criticalError = new Error('Unknown');

    const context = {
      requestId: 'req',
      method: 'GET',
      path: '/',
      ip: '127.0.0.1',
      userAgent: 'test',
      timestamp: new Date(),
    };

    expect(logger.log(lowError, context).severity).toBe('low');
    expect(logger.log(highError, context).severity).toBe('high');
    expect(logger.log(criticalError, context).severity).toBe('critical');
  });

  it('should sanitize headers in context', () => {
    const error = new Error('Test');
    const context = {
      requestId: 'req-123',
      method: 'GET',
      path: '/',
      ip: '127.0.0.1',
      userAgent: 'test',
      timestamp: new Date(),
      headers: {
        'authorization': 'Bearer token123',
        'x-api-key': 'secret-key',
        'content-type': 'application/json',
      },
    };

    const log = logger.log(error, context);

    expect(log.context.headers?.['authorization']).toBe('***');
    expect(log.context.headers?.['x-api-key']).toBe('***');
    expect(log.context.headers?.['content-type']).toBe('application/json');
  });

  it('should emit critical error events', (done) => {
    const error = new Error('Critical failure');
    const context = {
      requestId: 'req-123',
      method: 'GET',
      path: '/',
      ip: '127.0.0.1',
      userAgent: 'test',
      timestamp: new Date(),
    };

    logger.on('error:critical', (log) => {
      expect(log.severity).toBe('critical');
      done();
    });

    logger.log(error, context);
  });

  it('should return filtered logs', () => {
    const context = {
      requestId: 'req',
      method: 'GET',
      path: '/',
      ip: '127.0.0.1',
      userAgent: 'test',
      timestamp: new Date(),
    };

    logger.log(new ValidationError('E1'), context);
    logger.log(new ServiceUnavailableError('E2'), context);
    logger.log(new Error('E3'), context);

    const criticalLogs = logger.getLogs({ severity: 'critical' });
    expect(criticalLogs.length).toBe(1);

    const highLogs = logger.getLogs({ severity: 'high' });
    expect(highLogs.length).toBe(1);
  });

  it('should provide error statistics', () => {
    const context = {
      requestId: 'req',
      method: 'GET',
      path: '/',
      ip: '127.0.0.1',
      userAgent: 'test',
      timestamp: new Date(),
    };

    logger.log(new ValidationError('E1'), context);
    logger.log(new ValidationError('E2'), context);
    logger.log(new ServiceUnavailableError('E3'), context);

    const stats = logger.getStats();
    expect(stats.total).toBe(3);
    expect(stats.bySeverity.low).toBe(2);
    expect(stats.bySeverity.high).toBe(1);
  });
});

describe('ErrorResponseFormatter', () => {
  it('should format API Gateway errors', () => {
    const error = new ValidationError(
      'Invalid input',
      { field: 'email' },
      'req-123'
    );

    const formatted = ErrorResponseFormatter.format(error, 'req-123', false);

    expect(formatted.error.code).toBe('VALIDATION_ERROR');
    expect(formatted.error.statusCode).toBe(400);
    expect(formatted.error.message).toBe('Invalid input');
    expect(formatted.error.requestId).toBe('req-123');
    expect(formatted.error.details).toEqual({ field: 'email' });
    expect(formatted.error.stack).toBeUndefined();
  });

  it('should include sanitized stack trace when requested', () => {
    const error = new Error('Test error');
    const formatted = ErrorResponseFormatter.format(error, 'req-123', true);

    expect(formatted.error.stack).toBeDefined();
    expect(typeof formatted.error.stack).toBe('string');
  });

  it('should provide user-friendly messages for generic errors', () => {
    const timeoutError = new Error('Connection timeout occurred');
    const formatted = ErrorResponseFormatter.format(timeoutError, 'req-123', false);

    expect(formatted.error.message).toContain('took too long');
  });
});

describe('RetryStrategy', () => {
  it('should retry on retryable errors', async () => {
    let attempts = 0;

    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        const error: any = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        throw error;
      }
      return 'success';
    };

    const result = await RetryStrategy.executeWithRetry(operation, {
      maxRetries: 3,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry on non-retryable errors', async () => {
    let attempts = 0;

    const operation = async () => {
      attempts++;
      throw new ValidationError('Invalid input');
    };

    await expect(
      RetryStrategy.executeWithRetry(operation, { maxRetries: 3 })
    ).rejects.toThrow('Invalid input');

    expect(attempts).toBe(1);
  });

  it('should respect max retries', async () => {
    let attempts = 0;

    const operation = async () => {
      attempts++;
      throw new TimeoutError('Timeout');
    };

    await expect(
      RetryStrategy.executeWithRetry(operation, {
        maxRetries: 2,
        initialDelay: 10,
      })
    ).rejects.toThrow('Timeout');

    expect(attempts).toBe(3); // Initial + 2 retries
  });
});

describe('EnhancedCircuitBreaker', () => {
  let circuitBreaker: EnhancedCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new EnhancedCircuitBreaker('test-service', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      halfOpenRequests: 2,
      monitoringPeriod: 5000,
      volumeThreshold: 5,
    });
  });

  it('should start in closed state', () => {
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe('closed');
  });

  it('should open circuit after threshold failures', async () => {
    const failingOperation = async () => {
      throw new Error('Service failure');
    };

    // Need to reach volume threshold first
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (e) {
        // Expected to fail
      }
    }

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe('open');
    expect(metrics.failures).toBeGreaterThanOrEqual(3);
  });

  it('should reject requests when circuit is open', async () => {
    // Force circuit open
    circuitBreaker.forceOpen();

    const operation = async () => 'success';

    await expect(
      circuitBreaker.execute(operation)
    ).rejects.toThrow('Circuit breaker is open');
  });

  it('should transition to half-open after timeout', async (done) => {
    circuitBreaker = new EnhancedCircuitBreaker('test', {
      failureThreshold: 1,
      timeout: 100,
      volumeThreshold: 1,
    });

    circuitBreaker.on('state:half_open', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('half_open');
      done();
    });

    // Cause failure to open circuit
    try {
      await circuitBreaker.execute(async () => {
        throw new Error('Fail');
      });
    } catch (e) {}

    // Wait for timeout and attempt
    setTimeout(async () => {
      try {
        await circuitBreaker.execute(async () => 'test');
      } catch (e) {}
    }, 150);
  });

  it('should close circuit after successful half-open requests', async () => {
    circuitBreaker.forceOpen();

    // Manually transition to half-open
    const metrics = circuitBreaker.getMetrics();
    metrics.state = 'half_open';
    metrics.nextAttempt = new Date(Date.now() - 1000);

    const successOperation = async () => 'success';

    // Execute successful operations
    await circuitBreaker.execute(successOperation);
    await circuitBreaker.execute(successOperation);

    const finalMetrics = circuitBreaker.getMetrics();
    expect(finalMetrics.state).toBe('closed');
  });

  it('should reset circuit state', () => {
    circuitBreaker.forceOpen();
    circuitBreaker.reset();

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe('closed');
    expect(metrics.failures).toBe(0);
  });
});

describe('ErrorRecoveryManager', () => {
  let recoveryManager: ErrorRecoveryManager;

  beforeEach(() => {
    recoveryManager = new ErrorRecoveryManager();
  });

  it('should attempt recovery with registered strategies', async () => {
    recoveryManager.registerStrategy(CacheRecoveryStrategy);

    const error = new ServiceUnavailableError('Service down');
    const context = {
      cache: new Map([['key1', { value: 'cached-data', status: 200 }]]),
      cacheKey: 'key1',
    };

    const result = await recoveryManager.attemptRecovery(error, context);

    expect(result.recovered).toBe(true);
    expect(result.result.value).toBe('cached-data');
    expect(result.strategy).toBe('cache_fallback');
  });

  it('should return not recovered when no strategy matches', async () => {
    const error = new ValidationError('Invalid');
    const context = {};

    const result = await recoveryManager.attemptRecovery(error, context);

    expect(result.recovered).toBe(false);
  });

  it('should try multiple strategies', async () => {
    const strategy1 = {
      name: 'strategy1',
      canHandle: () => true,
      recover: async () => {
        throw new Error('Strategy 1 failed');
      },
    };

    const strategy2 = {
      name: 'strategy2',
      canHandle: () => true,
      recover: async () => 'recovered',
    };

    recoveryManager.registerStrategy(strategy1);
    recoveryManager.registerStrategy(strategy2);

    const result = await recoveryManager.attemptRecovery(new Error('Test'), {});

    expect(result.recovered).toBe(true);
    expect(result.result).toBe('recovered');
    expect(result.strategy).toBe('strategy2');
  });
});
