"use strict";
/**
 * Error Middleware for API Gateway
 * Provides comprehensive error handling middleware with logging, recovery, and user-friendly responses
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMetricsCollector = exports.ErrorMetricsCollector = exports.ErrorMiddlewareStack = exports.ExternalServiceErrorHandler = exports.RateLimitErrorHandler = exports.NotFoundHandler = exports.DatabaseErrorHandler = exports.ValidationErrorHandler = exports.ErrorRecoveryMiddleware = exports.CircuitBreakerMiddleware = exports.RetryMiddleware = exports.TimeoutMiddleware = exports.ErrorHandlerMiddleware = void 0;
exports.asyncErrorHandler = asyncErrorHandler;
const ErrorHandling_1 = require("./ErrorHandling");
const EventBus_1 = require("../core/EventBus");
/**
 * Global Error Handler Middleware
 */
class ErrorHandlerMiddleware {
    errorLogger;
    includeStackTrace;
    constructor(options = {}) {
        this.errorLogger = ErrorHandling_1.ErrorLogger.getInstance();
        this.includeStackTrace = options.includeStackTrace ?? process.env.NODE_ENV === 'development';
    }
    /**
     * Create error handling middleware
     */
    create() {
        return async (request, context, next) => {
            try {
                return await next();
            }
            catch (error) {
                return this.handleError(error, request, context);
            }
        };
    }
    /**
     * Handle error and create appropriate response
     */
    handleError(error, request, context) {
        const err = this.normalizeError(error);
        // Create error context
        const errorContext = {
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
        EventBus_1.eventBus.emitSync('api.error', {
            error: err,
            context: errorContext,
            severity,
        }, 'ErrorHandlerMiddleware');
        // Build and return error response
        return ErrorHandling_1.ErrorResponseBuilder.build(err, context, this.includeStackTrace);
    }
    /**
     * Normalize error to Error instance
     */
    normalizeError(error) {
        if (error instanceof Error) {
            return error;
        }
        if (typeof error === 'string') {
            return new ErrorHandling_1.APIError(error);
        }
        if (typeof error === 'object' && error !== null) {
            const message = error.message || JSON.stringify(error);
            return new ErrorHandling_1.APIError(message);
        }
        return new ErrorHandling_1.APIError('An unknown error occurred');
    }
    /**
     * Determine error severity
     */
    determineSeverity(error) {
        if (error instanceof ErrorHandling_1.ValidationError || error instanceof ErrorHandling_1.NotFoundError) {
            return 'info';
        }
        if (error instanceof ErrorHandling_1.RateLimitError || error instanceof ErrorHandling_1.AuthenticationError) {
            return 'warning';
        }
        if (error instanceof ErrorHandling_1.AuthorizationError || error instanceof ErrorHandling_1.DatabaseError) {
            return 'error';
        }
        if (error instanceof ErrorHandling_1.ServiceUnavailableError || error instanceof ErrorHandling_1.CircuitBreakerOpenError) {
            return 'critical';
        }
        if (error instanceof ErrorHandling_1.APIError && !error.isOperational) {
            return 'critical';
        }
        return 'error';
    }
}
exports.ErrorHandlerMiddleware = ErrorHandlerMiddleware;
/**
 * Async Error Wrapper
 */
function asyncErrorHandler(handler) {
    return async (request, context) => {
        try {
            return await handler(request, context);
        }
        catch (error) {
            if (error instanceof ErrorHandling_1.APIError) {
                throw error;
            }
            // Wrap unknown errors
            throw new ErrorHandling_1.APIError(error instanceof Error ? error.message : 'An unexpected error occurred', 500, 'INTERNAL_ERROR', false);
        }
    };
}
/**
 * Timeout Middleware
 */
class TimeoutMiddleware {
    timeoutMs;
    constructor(timeoutMs = 30000) {
        this.timeoutMs = timeoutMs;
    }
    create() {
        return async (request, context, next) => {
            return Promise.race([
                next(),
                new Promise((_, reject) => setTimeout(() => reject(new ErrorHandling_1.GatewayTimeoutError('Request timeout', { timeoutMs: this.timeoutMs })), this.timeoutMs)),
            ]);
        };
    }
}
exports.TimeoutMiddleware = TimeoutMiddleware;
/**
 * Retry Middleware
 */
class RetryMiddleware {
    config;
    constructor(config = {}) {
        this.config = config;
    }
    create() {
        return async (request, context, next) => {
            // Only retry safe methods
            if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
                return next();
            }
            return ErrorHandling_1.RetryHandler.execute(() => next(), this.config);
        };
    }
}
exports.RetryMiddleware = RetryMiddleware;
/**
 * Circuit Breaker Middleware Factory
 */
class CircuitBreakerMiddleware {
    manager;
    serviceExtractor;
    constructor(serviceExtractor) {
        this.manager = ErrorHandling_1.CircuitBreakerManager.getInstance();
        this.serviceExtractor = serviceExtractor || this.defaultServiceExtractor;
    }
    create() {
        return async (request, context, next) => {
            const serviceName = this.serviceExtractor(request);
            const breaker = this.manager.getBreaker(serviceName);
            try {
                return await breaker.execute(() => next());
            }
            catch (error) {
                // Check if we can use fallback
                if (error instanceof ErrorHandling_1.CircuitBreakerOpenError) {
                    const fallback = ErrorHandling_1.ErrorRecoveryStrategy.getFallbackResponse(error, context);
                    if (fallback) {
                        return fallback;
                    }
                }
                throw error;
            }
        };
    }
    defaultServiceExtractor(request) {
        // Extract service name from path (e.g., /api/users -> users)
        const pathParts = request.path.split('/').filter(Boolean);
        return pathParts[1] || 'default';
    }
}
exports.CircuitBreakerMiddleware = CircuitBreakerMiddleware;
/**
 * Error Recovery Middleware
 */
class ErrorRecoveryMiddleware {
    create() {
        return async (request, context, next) => {
            try {
                return await next();
            }
            catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                const errorContext = {
                    requestId: context.requestId,
                    userId: context.userId,
                    path: request.path,
                    method: request.method,
                    ip: request.ip,
                    userAgent: request.userAgent,
                    timestamp: new Date(),
                };
                // Attempt recovery
                const canRecover = await ErrorHandling_1.ErrorRecoveryStrategy.attemptRecovery(err, errorContext);
                if (canRecover) {
                    // Try to get fallback response
                    const fallback = ErrorHandling_1.ErrorRecoveryStrategy.getFallbackResponse(err, context);
                    if (fallback) {
                        EventBus_1.eventBus.emitSync('api.error_recovered', {
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
exports.ErrorRecoveryMiddleware = ErrorRecoveryMiddleware;
/**
 * Request Validation Error Handler
 */
class ValidationErrorHandler {
    static create() {
        return async (request, context, next) => {
            try {
                return await next();
            }
            catch (error) {
                if (error instanceof ErrorHandling_1.ValidationError) {
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
exports.ValidationErrorHandler = ValidationErrorHandler;
/**
 * Database Error Handler
 */
class DatabaseErrorHandler {
    static create() {
        return async (request, context, next) => {
            try {
                return await next();
            }
            catch (error) {
                // Convert database-specific errors to APIError
                if (error instanceof Error) {
                    const message = error.message.toLowerCase();
                    // Connection errors
                    if (message.includes('connection') || message.includes('econnrefused')) {
                        throw new ErrorHandling_1.DatabaseError('Database connection failed', {
                            originalError: error.message,
                        });
                    }
                    // Timeout errors
                    if (message.includes('timeout')) {
                        throw new ErrorHandling_1.DatabaseError('Database operation timed out', {
                            originalError: error.message,
                        });
                    }
                    // Constraint violations
                    if (message.includes('unique') || message.includes('duplicate')) {
                        throw new ErrorHandling_1.ValidationError('A record with this information already exists', {
                            constraint: 'unique',
                            originalError: error.message,
                        });
                    }
                    // Foreign key violations
                    if (message.includes('foreign key')) {
                        throw new ErrorHandling_1.ValidationError('Referenced record does not exist', {
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
exports.DatabaseErrorHandler = DatabaseErrorHandler;
/**
 * Not Found Handler
 */
class NotFoundHandler {
    static create(resourceName) {
        return async (request, context, next) => {
            try {
                return await next();
            }
            catch (error) {
                if (error instanceof ErrorHandling_1.NotFoundError) {
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
exports.NotFoundHandler = NotFoundHandler;
/**
 * Rate Limit Error Handler with enhanced headers
 */
class RateLimitErrorHandler {
    static create() {
        return async (request, context, next) => {
            try {
                return await next();
            }
            catch (error) {
                if (error instanceof ErrorHandling_1.RateLimitError) {
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
exports.RateLimitErrorHandler = RateLimitErrorHandler;
/**
 * External Service Error Handler with Circuit Breaker
 */
class ExternalServiceErrorHandler {
    circuitBreakerManager;
    constructor() {
        this.circuitBreakerManager = ErrorHandling_1.CircuitBreakerManager.getInstance();
    }
    create() {
        return async (request, context, next) => {
            try {
                return await next();
            }
            catch (error) {
                if (error instanceof ErrorHandling_1.ExternalServiceError) {
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
exports.ExternalServiceErrorHandler = ExternalServiceErrorHandler;
/**
 * Comprehensive Error Middleware Stack
 */
class ErrorMiddlewareStack {
    /**
     * Create complete error handling middleware stack
     */
    static create(options = {}) {
        const middleware = [];
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
        middleware.push(new ErrorHandlerMiddleware({
            includeStackTrace: options.includeStackTrace,
        }).create());
        return middleware;
    }
}
exports.ErrorMiddlewareStack = ErrorMiddlewareStack;
/**
 * Error Metrics Collector
 */
class ErrorMetricsCollector {
    metrics = new Map();
    /**
     * Record error occurrence
     */
    record(error, context) {
        const errorType = error.constructor.name;
        const key = `${errorType}:${context.path}`;
        let metric = this.metrics.get(key);
        if (!metric) {
            metric = {
                errorType,
                path: context.path || '',
                count: 0,
                lastOccurrence: new Date(),
                statusCode: error instanceof ErrorHandling_1.APIError ? error.statusCode : 500,
            };
            this.metrics.set(key, metric);
        }
        metric.count++;
        metric.lastOccurrence = new Date();
    }
    /**
     * Get error metrics
     */
    getMetrics(filter) {
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
    clear() {
        this.metrics.clear();
    }
}
exports.ErrorMetricsCollector = ErrorMetricsCollector;
/**
 * Singleton instances
 */
exports.errorMetricsCollector = new ErrorMetricsCollector();
