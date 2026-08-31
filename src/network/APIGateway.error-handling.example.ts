/**
 * API Gateway Error Handling Examples
 *
 * This file demonstrates comprehensive error handling capabilities
 * including custom error classes, recovery strategies, circuit breakers,
 * and monitoring.
 */

import {
  APIGateway,
  Route,
  Request,
  Response,
  // Error classes
  APIGatewayError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  CircuitBreakerError,
  UpstreamError,
  // Error handling
  ErrorHandler,
  ErrorRecovery,
  ErrorMonitor,
  // Middleware
  MiddlewareFactory,
  ValidationHelpers,
} from './APIGateway';
import { z } from 'zod';

// ============================================================================
// Example 1: Basic Error Handling Setup
// ============================================================================

async function example1_BasicErrorHandling() {
  const gateway = new APIGateway({
    port: 8080,
    host: '0.0.0.0',
    enableCircuitBreaker: true,
    enableRateLimiting: true,
  });

  // Register route with error handling
  gateway.registerRoute({
    path: '/api/users/:id',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        const userId = req.params.id;

        // Validate ID format
        if (!userId.match(/^\d+$/)) {
          throw new ValidationError('Invalid user ID format', [], {
            userId,
            expectedFormat: 'numeric',
          });
        }

        // Simulate user lookup
        const user = await lookupUser(userId);
        if (!user) {
          throw new NotFoundError(`User ${userId} not found`, { userId });
        }

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { success: true, data: user },
        };
      },
    },
    middleware: [
      MiddlewareFactory.errorHandler({
        enableRecovery: true,
        fallbackData: { id: 'unknown', name: 'Guest User' },
      }),
    ],
  });

  await gateway.start();
  console.log('Gateway started with error handling');
}

async function lookupUser(id: string): Promise<any> {
  // Simulate database lookup
  return { id, name: 'John Doe', email: 'john@example.com' };
}

// ============================================================================
// Example 2: Circuit Breaker Pattern
// ============================================================================

async function example2_CircuitBreaker() {
  const gateway = new APIGateway({
    port: 8080,
    host: '0.0.0.0',
    enableCircuitBreaker: true,
  });

  // Route with upstream service and circuit breaker
  gateway.registerRoute({
    path: '/api/external',
    method: 'GET',
    target: {
      type: 'upstream',
      upstream: {
        servers: [
          {
            id: 'server1',
            url: 'http://external-service.com',
            weight: 1,
            priority: 1,
            maxConnections: 100,
            currentConnections: 0,
            healthy: true,
          },
        ],
        loadBalancing: 'round_robin',
        circuitBreaker: {
          threshold: 5, // Open after 5 failures
          timeout: 30000, // Stay open for 30 seconds
          monitoringPeriod: 60000, // Monitor window of 60 seconds
          fallbackResponse: {
            success: false,
            message: 'Service temporarily unavailable',
            fallback: true,
          },
        },
      },
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

  // Monitor circuit breaker events
  gateway.on('circuit_breaker:opened', (data) => {
    console.error('Circuit breaker opened:', data);
    // Send alert to monitoring system
  });

  gateway.on('circuit_breaker:closed', (data) => {
    console.log('Circuit breaker closed:', data);
  });
}

// ============================================================================
// Example 3: Retry Logic with Recovery
// ============================================================================

async function example3_RetryWithRecovery() {
  // Using ErrorRecovery utility
  const result = await ErrorRecovery.executeWithRecovery(
    async () => {
      // Potentially failing operation
      const response = await fetch('http://unreliable-api.com/data');
      if (!response.ok) {
        throw new UpstreamError(`API returned ${response.status}`, response.status);
      }
      return response.json();
    },
    {
      maxRetries: 3,
      retryDelay: 1000,
      backoff: 'exponential',
      fallback: { data: [], cached: true },
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt} after error:`, error.message);
      },
      shouldRetry: (error) => {
        // Custom retry logic
        if (error instanceof UpstreamError) {
          return error.upstreamStatus ? error.upstreamStatus >= 500 : true;
        }
        return ErrorHandler.isRetryable(error);
      },
    }
  );

  console.log('Result:', result);
}

// ============================================================================
// Example 4: Error Monitoring and Alerting
// ============================================================================

async function example4_ErrorMonitoring() {
  const gateway = new APIGateway({
    port: 8080,
    host: '0.0.0.0',
  });

  // Subscribe to error events
  const unsubscribe = ErrorMonitor.onError((entry) => {
    console.log(`[${entry.level}] ${entry.error.code}: ${entry.message}`);

    // Alert on critical errors
    if (entry.level === 'error' && !entry.error.isOperational) {
      sendAlert({
        severity: 'critical',
        message: entry.message,
        error: entry.error,
        context: entry.context,
      });
    }
  });

  // Periodic threshold checking
  setInterval(() => {
    ErrorMonitor.checkThresholds({
      errorRateThreshold: 0.1, // 10% error rate
      timeWindowMs: 60000, // 1 minute window
      onThresholdExceeded: (stats) => {
        console.error('Error rate threshold exceeded:', stats);
        sendAlert({
          severity: 'high',
          message: `Error rate: ${(stats.errorRate * 100).toFixed(2)}%`,
          stats,
        });
      },
    });
  }, 30000); // Check every 30 seconds

  // Get error statistics
  const stats = ErrorMonitor.getErrorStats(Date.now() - 3600000); // Last hour
  console.log('Error statistics:', stats);

  await gateway.start();
}

function sendAlert(alert: any) {
  // Send to monitoring system (e.g., Sentry, DataDog, PagerDuty)
  console.log('ALERT:', alert);
}

// ============================================================================
// Example 5: Custom Error Classes
// ============================================================================

class DatabaseError extends APIGatewayError {
  constructor(message: string, query?: string, context?: Record<string, any>) {
    super(message, 500, 'DATABASE_ERROR', true, { ...context, query });
  }
}

class ExternalAPIError extends APIGatewayError {
  public readonly provider: string;

  constructor(provider: string, message: string, context?: Record<string, any>) {
    super(message, 502, 'EXTERNAL_API_ERROR', true, { ...context, provider });
    this.provider = provider;
  }
}

async function example5_CustomErrors() {
  const gateway = new APIGateway({ port: 8080, host: '0.0.0.0' });

  gateway.registerRoute({
    path: '/api/data',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        try {
          // Simulate database query
          const data = await queryDatabase('SELECT * FROM users');
          return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { success: true, data },
          };
        } catch (error) {
          throw new DatabaseError(
            'Failed to query users table',
            'SELECT * FROM users',
            { originalError: (error as Error).message }
          );
        }
      },
    },
  });

  await gateway.start();
}

async function queryDatabase(query: string): Promise<any[]> {
  // Simulate database query
  return [];
}

// ============================================================================
// Example 6: Graceful Degradation
// ============================================================================

async function example6_GracefulDegradation() {
  const gateway = new APIGateway({ port: 8080, host: '0.0.0.0' });

  gateway.registerRoute({
    path: '/api/recommendations',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        // Try multiple data sources with fallback
        const recommendations = await ErrorRecovery.gracefulDegrade(
          // Primary: ML-based recommendations
          async () => {
            const result = await fetch('http://ml-service/recommend');
            if (!result.ok) throw new Error('ML service unavailable');
            return result.json();
          },
          // Secondary: Rule-based recommendations
          async () => {
            const result = await fetch('http://rule-engine/recommend');
            if (!result.ok) throw new Error('Rule engine unavailable');
            return result.json();
          },
          // Tertiary: Default popular items
          { items: ['item1', 'item2', 'item3'], source: 'default' }
        );

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { success: true, data: recommendations },
        };
      },
    },
  });

  await gateway.start();
}

// ============================================================================
// Example 7: Error Logging with Context
// ============================================================================

async function example7_ErrorLogging() {
  const gateway = new APIGateway({
    port: 8080,
    host: '0.0.0.0',
    enableRequestLogging: true,
  });

  // Get error logs with filtering
  const recentErrors = gateway.getErrorLogs({
    level: 'error',
    since: Date.now() - 3600000, // Last hour
    limit: 50,
  });

  console.log(`Found ${recentErrors.length} errors in the last hour`);

  recentErrors.forEach((entry) => {
    console.log({
      time: new Date(entry.timestamp).toISOString(),
      code: entry.error.code,
      message: entry.message,
      path: entry.context.path,
      ip: entry.context.ip,
      statusCode: entry.error.statusCode,
    });
  });

  // Get health status including error rates
  const health = gateway.getHealthStatus();
  console.log('Gateway health:', health.status);
  console.log('Error rate:', (health.errorRate * 100).toFixed(2) + '%');
  console.log('Circuit breakers:', health.circuitBreakers);
}

// ============================================================================
// Example 8: Complete Production Setup
// ============================================================================

async function example8_ProductionSetup() {
  const gateway = new APIGateway({
    port: 8080,
    host: '0.0.0.0',
    enableSSL: false,
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
  });

  // User schema
  const userSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    age: z.number().int().min(0).max(150).optional(),
  });

  // Register route with full error handling
  gateway.registerRoute({
    path: '/api/users',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        const user = req.body;

        // Business logic
        const createdUser = await createUser(user);

        return {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Location': `/api/users/${createdUser.id}`,
          },
          body: { success: true, data: createdUser },
        };
      },
    },
    middleware: [
      MiddlewareFactory.requestId(),
      MiddlewareFactory.timeout(5000),
      MiddlewareFactory.sizeLimit(1024 * 1024), // 1MB
      MiddlewareFactory.errorHandler({ enableRecovery: false }),
    ],
    validation: ValidationHelpers.createSecureValidation(userSchema),
    auth: {
      type: 'bearer',
      required: true,
      validator: async (token: string) => {
        // Validate JWT or API key
        return token.length > 0;
      },
    },
    rateLimit: ValidationHelpers.createRateLimit.perUser(100, 60000),
    retry: {
      maxAttempts: 3,
      delay: 1000,
      backoff: 'exponential',
      retryableStatuses: [502, 503, 504],
      retryableErrors: ['ETIMEDOUT', 'ECONNREFUSED'],
    },
  });

  // Error monitoring
  ErrorMonitor.onError((entry) => {
    // Log to external service (e.g., Sentry)
    if (entry.level === 'error') {
      console.error('Error occurred:', {
        code: entry.error.code,
        message: entry.message,
        requestId: entry.context.requestId,
        path: entry.context.path,
      });
    }
  });

  // Health check endpoint
  gateway.registerRoute({
    path: '/health',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
        const health = gateway.getHealthStatus();
        return {
          status: health.status === 'healthy' ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
          body: health,
        };
      },
    },
    middleware: [],
  });

  await gateway.start();
  console.log('Production gateway started on port 8080');

  // Periodic health monitoring
  setInterval(() => {
    const health = gateway.getHealthStatus();
    if (health.status !== 'healthy') {
      console.warn('Gateway health degraded:', health);
    }
  }, 60000); // Check every minute
}

async function createUser(user: any): Promise<any> {
  // Simulate user creation
  return { id: '123', ...user };
}

// ============================================================================
// Export examples
// ============================================================================

export {
  example1_BasicErrorHandling,
  example2_CircuitBreaker,
  example3_RetryWithRecovery,
  example4_ErrorMonitoring,
  example5_CustomErrors,
  example6_GracefulDegradation,
  example7_ErrorLogging,
  example8_ProductionSetup,
};
