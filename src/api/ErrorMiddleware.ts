/**
 * Error Middleware for API Gateway
 * Provides comprehensive error handling middleware with logging, recovery, and user-friendly responses
 */

import {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  DatabaseError,
  ExternalServiceError,
  CircuitBreakerOpenError,
  ErrorLogger,
  ErrorResponseBuilder,
  ErrorContext,
  ErrorRecoveryStrategy,
  CircuitBreakerManager,
  RetryHandler,
  RetryConfig,
} from './ErrorHandling';
import { APIRequest, APIResponse, RequestContext, Middleware } from './APIGateway';
import { eventBus } from '../core/EventBus';

/**
 * Global Error Handler Middleware
 */
export class ErrorHandlerMiddleware {
  private readonly errorLogger: ErrorLogger;
  private readonly includeStackTrace: boolean;

  constructor(options: { includeStackTrace?: boolean } = {}) {
    this.errorLogger = ErrorLogger.getInstance();
    this.includeStackTrace = options.includeStackTrace ?? process.env.NODE_ENV === 'development';
  }

  /**
   * Create error handling middleware
   */
  create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      try {
        return await next();
      } catch (error) {
        return this.handleError(error, request, context);
      }
    };
  }

  /**
   * Handle error and create appropriate response
   */
  private handleError(error: unknown, request: APIRequest, context: RequestContext): APIResponse {
    const err = this.normalizeError(error);

    // Create error context
    const errorContext: ErrorContext = {
      requestId: context.requestId,
      userId: context.userId,
      path: request.path,
      method: request.method,
      ip: request.ip,
      userAgent: request.userAgent,
      timestamp: new Date(),
      duration: Date.now() - context.startTime,
    };

    // Determine severity
    const severity = this.determineSeverity(err);

    // Log error
    this.errorLogger.log(err, errorContext, severity);

    // Emit error event
    eventBus.emitSync('api.error', {
      error: err,
      context: errorContext,
      severity,
    }, 'ErrorHandlerMiddleware');

    // Build and return error response
    return ErrorResponseBuilder.build(err, context, this.includeStackTrace);
  }

  /**
   * Normalize error to Error instance
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new APIError(error);
    }

    if (typeof error === 'object' && error !== null) {
      const message = (error as any).message || JSON.stringify(error);
      return new APIError(message);
    }

    return new APIError('An unknown error occurred');
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error): 'info' | 'warning' | 'error' | 'critical' {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return 'info';
    }

    if (error instanceof RateLimitError || error instanceof AuthenticationError) {
      return 'warning';
    }

    if (error instanceof AuthorizationError || error instanceof DatabaseError) {
      return 'error';
    }

    if (error instanceof ServiceUnavailableError || error instanceof CircuitBreakerOpenError) {
      return 'critical';
    }

    if (error instanceof APIError && !error.isOperational) {
      return 'critical';
    }

    return 'error';
  }
}

/**
 * Async Error Wrapper
 */
export function asyncErrorHandler(
  handler: (request: APIRequest, context: RequestContext) => Promise<APIResponse>
): (request: APIRequest, context: RequestContext) => Promise<APIResponse> {
  return async (request: APIRequest, context: RequestContext): Promise<APIResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      // Wrap unknown errors
      throw new APIError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
        500,
        'INTERNAL_ERROR',
        false
      );
    }
  };
}

/**
 * Timeout Middleware
 */
export class TimeoutMiddleware {
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      return Promise.race([
        next(),
        new Promise<APIResponse>((_, reject) =>
          setTimeout(
            () => reject(new GatewayTimeoutError('Request timeout', { timeoutMs: this.timeoutMs })),
            this.timeoutMs
          )
        ),
      ]);
    };
  }
}

/**
 * Retry Middleware
 */
export class RetryMiddleware {
  private readonly config: Partial<RetryConfig>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = config;
  }

  create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      // Only retry safe methods
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
        return next();
      }

      return RetryHandler.execute(() => next(), this.config);
    };
  }
}

/**
 * Circuit Breaker Middleware Factory
 */
export class CircuitBreakerMiddleware {
  private readonly manager: CircuitBreakerManager;
  private readonly serviceExtractor: (request: APIRequest) => string;

  constructor(serviceExtractor?: (request: APIRequest) => string) {
    this.manager = CircuitBreakerManager.getInstance();
    this.serviceExtractor = serviceExtractor || this.defaultServiceExtractor;
  }

  create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      const serviceName = this.serviceExtractor(request);
      const breaker = this.manager.getBreaker(serviceName);

      try {
        return await breaker.execute(() => next());
      } catch (error) {
        // Check if we can use fallback
        if (error instanceof CircuitBreakerOpenError) {
          const fallback = ErrorRecoveryStrategy.getFallbackResponse(error, context);
          if (fallback) {
            return fallback;
          }
        }

        throw error;
      }
    };
  }

  private defaultServiceExtractor(request: APIRequest): string {
    // Extract service name from path (e.g., /api/users -> users)
    const pathParts = request.path.split('/').filter(Boolean);
    return pathParts[1] || 'default';
  }
}

/**
 * Error Recovery Middleware
 */
export class ErrorRecoveryMiddleware {
  create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      try {
        return await next();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        const errorContext: ErrorContext = {
          requestId: context.requestId,
          userId: context.userId,
          path: request.path,
          method: request.method,
          ip: request.ip,
          userAgent: request.userAgent,
          timestamp: new Date(),
        };

        // Attempt recovery
        const canRecover = await ErrorRecoveryStrategy.attemptRecovery(err, errorContext);

        if (canRecover) {
          // Try to get fallback response
          const fallback = ErrorRecoveryStrategy.getFallbackResponse(err, context);
          if (fallback) {
            eventBus.emitSync('api.error_recovered', {
              error: err,
              context: errorContext,
            }, 'ErrorRecoveryMiddleware');

            return fallback;
          }
        }

        // Re-throw if recovery not possible
        throw error;
      }
    };
  }
}

/**
 * Request Validation Error Handler
 */
export class ValidationErrorHandler {
  static create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      try {
        return await next();
      } catch (error) {
        if (error instanceof ValidationError) {
          // Enhanced validation error response
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: {
              error: {
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                timestamp: new Date().toISOString(),
                requestId: context.requestId,
                details: error.details,
              },
            },
          };
        }

        throw error;
      }
    };
  }
}

/**
 * Database Error Handler
 */
export class DatabaseErrorHandler {
  static create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      try {
        return await next();
      } catch (error) {
        // Convert database-specific errors to APIError
        if (error instanceof Error) {
          const message = error.message.toLowerCase();

          // Connection errors
          if (message.includes('connection') || message.includes('econnrefused')) {
            throw new DatabaseError('Database connection failed', {
              originalError: error.message,
            });
          }

          // Timeout errors
          if (message.includes('timeout')) {
            throw new DatabaseError('Database operation timed out', {
              originalError: error.message,
            });
          }

          // Constraint violations
          if (message.includes('unique') || message.includes('duplicate')) {
            throw new ValidationError('A record with this information already exists', {
              constraint: 'unique',
              originalError: error.message,
            });
          }

          // Foreign key violations
          if (message.includes('foreign key')) {
            throw new ValidationError('Referenced record does not exist', {
              constraint: 'foreign_key',
              originalError: error.message,
            });
          }
        }

        throw error;
      }
    };
  }
}

/**
 * Not Found Handler
 */
export class NotFoundHandler {
  static create(resourceName?: string): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      try {
        return await next();
      } catch (error) {
        if (error instanceof NotFoundError) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: {
              error: {
                message: error.message,
                code: 'NOT_FOUND',
                timestamp: new Date().toISOString(),
                requestId: context.requestId,
                resource: resourceName || request.path,
              },
            },
          };
        }

        throw error;
      }
    };
  }
}

/**
 * Rate Limit Error Handler with enhanced headers
 */
export class RateLimitErrorHandler {
  static create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      try {
        return await next();
      } catch (error) {
        if (error instanceof RateLimitError) {
          const retryAfter = error.retryAfter
            ? Math.ceil((error.retryAfter.getTime() - Date.now()) / 1000)
            : 60;

          return {
            statusCode: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Reset': error.retryAfter?.toISOString() || '',
            },
            body: {
              error: {
                message: error.message,
                code: 'RATE_LIMIT_EXCEEDED',
                timestamp: new Date().toISOString(),
                requestId: context.requestId,
                retryAfter: error.retryAfter?.toISOString(),
              },
            },
          };
        }

        throw error;
      }
    };
  }
}

/**
 * External Service Error Handler with Circuit Breaker
 */
export class ExternalServiceErrorHandler {
  private readonly circuitBreakerManager: CircuitBreakerManager;

  constructor() {
    this.circuitBreakerManager = CircuitBreakerManager.getInstance();
  }

  create(): Middleware {
    return async (
      request: APIRequest,
      context: RequestContext,
      next: () => Promise<APIResponse>
    ): Promise<APIResponse> => {
      try {
        return await next();
      } catch (error) {
        if (error instanceof ExternalServiceError) {
          const service = error.details?.service;
          if (service) {
            const breaker = this.circuitBreakerManager.getBreaker(service);
            const stats = breaker.getStats();

            return {
              statusCode: 502,
              headers: { 'Content-Type': 'application/json' },
              body: {
                error: {
                  message: error.message,
                  code: 'EXTERNAL_SERVICE_ERROR',
                  timestamp: new Date().toISOString(),
                  requestId: context.requestId,
                  service,
                  circuitBreakerState: stats.state,
                },
              },
            };
          }
        }

        throw error;
      }
    };
  }
}

/**
 * Comprehensive Error Middleware Stack
 */
export class ErrorMiddlewareStack {
  /**
   * Create complete error handling middleware stack
   */
  static create(options: {
    timeout?: number;
    retry?: Partial<RetryConfig>;
    includeStackTrace?: boolean;
    enableCircuitBreaker?: boolean;
    enableRecovery?: boolean;
  } = {}): Middleware[] {
    const middleware: Middleware[] = [];

    // Add timeout middleware
    if (options.timeout) {
      middleware.push(new TimeoutMiddleware(options.timeout).create());
    }

    // Add circuit breaker middleware
    if (options.enableCircuitBreaker !== false) {
      middleware.push(new CircuitBreakerMiddleware().create());
    }

    // Add retry middleware (for safe methods)
    if (options.retry) {
      middleware.push(new RetryMiddleware(options.retry).create());
    }

    // Add error recovery middleware
    if (options.enableRecovery !== false) {
      middleware.push(new ErrorRecoveryMiddleware().create());
    }

    // Add specific error handlers
    middleware.push(ValidationErrorHandler.create());
    middleware.push(DatabaseErrorHandler.create());
    middleware.push(NotFoundHandler.create());
    middleware.push(RateLimitErrorHandler.create());
    middleware.push(new ExternalServiceErrorHandler().create());

    // Add global error handler (should be last)
    middleware.push(
      new ErrorHandlerMiddleware({
        includeStackTrace: options.includeStackTrace,
      }).create()
    );

    return middleware;
  }
}

/**
 * Error Metrics Collector
 */
export class ErrorMetricsCollector {
  private metrics: Map<string, ErrorMetric> = new Map();

  /**
   * Record error occurrence
   */
  record(error: Error, context: ErrorContext): void {
    const errorType = error.constructor.name;
    const key = `${errorType}:${context.path}`;

    let metric = this.metrics.get(key);
    if (!metric) {
      metric = {
        errorType,
        path: context.path || '',
        count: 0,
        lastOccurrence: new Date(),
        statusCode: error instanceof APIError ? error.statusCode : 500,
      };
      this.metrics.set(key, metric);
    }

    metric.count++;
    metric.lastOccurrence = new Date();
  }

  /**
   * Get error metrics
   */
  getMetrics(filter?: { errorType?: string; path?: string }): ErrorMetric[] {
    let metrics = Array.from(this.metrics.values());

    if (filter?.errorType) {
      metrics = metrics.filter(m => m.errorType === filter.errorType);
    }

    if (filter?.path) {
      metrics = metrics.filter(m => m.path === filter.path);
    }

    return metrics.sort((a, b) => b.count - a.count);
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

export interface ErrorMetric {
  errorType: string;
  path: string;
  count: number;
  lastOccurrence: Date;
  statusCode: number;
}

/**
 * Singleton instances
 */
export const errorMetricsCollector = new ErrorMetricsCollector();
