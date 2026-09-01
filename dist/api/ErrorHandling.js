"use strict";
/**
 * Comprehensive Error Handling System for API Gateway
 * Includes custom error classes, error middleware, logging, retry logic, and circuit breaker
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreakerManager = exports.errorLogger = exports.ErrorRecoveryStrategy = exports.CircuitBreakerManager = exports.CircuitBreaker = exports.CircuitState = exports.RetryHandler = exports.ErrorResponseBuilder = exports.ErrorLogger = exports.CircuitBreakerOpenError = exports.ExternalServiceError = exports.DatabaseError = exports.GatewayTimeoutError = exports.ServiceUnavailableError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.APIError = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Base API Error class with additional context
 */
class APIError extends Error {
    statusCode;
    code;
    isOperational;
    timestamp;
    requestId;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true, details) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.timestamp = new Date();
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            error: {
                name: this.name,
                message: this.message,
                code: this.code,
                statusCode: this.statusCode,
                timestamp: this.timestamp.toISOString(),
                details: this.details,
            },
        };
    }
}
exports.APIError = APIError;
/**
 * Validation Error - 400 Bad Request
 */
class ValidationError extends APIError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', true, details);
    }
}
exports.ValidationError = ValidationError;
/**
 * Authentication Error - 401 Unauthorized
 */
class AuthenticationError extends APIError {
    constructor(message = 'Authentication required', details) {
        super(message, 401, 'AUTHENTICATION_ERROR', true, details);
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Authorization Error - 403 Forbidden
 */
class AuthorizationError extends APIError {
    constructor(message = 'Insufficient permissions', details) {
        super(message, 403, 'AUTHORIZATION_ERROR', true, details);
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Not Found Error - 404 Not Found
 */
class NotFoundError extends APIError {
    constructor(resource = 'Resource', details) {
        super(`${resource} not found`, 404, 'NOT_FOUND', true, details);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Conflict Error - 409 Conflict
 */
class ConflictError extends APIError {
    constructor(message = 'Resource conflict', details) {
        super(message, 409, 'CONFLICT_ERROR', true, details);
    }
}
exports.ConflictError = ConflictError;
/**
 * Rate Limit Error - 429 Too Many Requests
 */
class RateLimitError extends APIError {
    retryAfter;
    constructor(message = 'Rate limit exceeded', retryAfter, details) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', true, details);
        this.retryAfter = retryAfter;
    }
    toJSON() {
        const json = super.toJSON();
        if (this.retryAfter) {
            json.error.retryAfter = this.retryAfter.toISOString();
        }
        return json;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Service Unavailable Error - 503
 */
class ServiceUnavailableError extends APIError {
    constructor(message = 'Service temporarily unavailable', details) {
        super(message, 503, 'SERVICE_UNAVAILABLE', true, details);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
/**
 * Gateway Timeout Error - 504
 */
class GatewayTimeoutError extends APIError {
    constructor(message = 'Gateway timeout', details) {
        super(message, 504, 'GATEWAY_TIMEOUT', true, details);
    }
}
exports.GatewayTimeoutError = GatewayTimeoutError;
/**
 * Database Error - 500
 */
class DatabaseError extends APIError {
    constructor(message = 'Database operation failed', details) {
        super(message, 500, 'DATABASE_ERROR', true, details);
    }
}
exports.DatabaseError = DatabaseError;
/**
 * External Service Error - 502 Bad Gateway
 */
class ExternalServiceError extends APIError {
    constructor(service, message, details) {
        super(message || `External service ${service} failed`, 502, 'EXTERNAL_SERVICE_ERROR', true, { service, ...details });
    }
}
exports.ExternalServiceError = ExternalServiceError;
/**
 * Circuit Breaker Open Error
 */
class CircuitBreakerOpenError extends APIError {
    constructor(service, details) {
        super(`Circuit breaker open for service: ${service}`, 503, 'CIRCUIT_BREAKER_OPEN', true, { service, ...details });
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
/**
 * Error Logger with structured logging
 */
class ErrorLogger {
    static instance;
    errorLog = [];
    maxLogSize = 1000;
    constructor() { }
    static getInstance() {
        if (!ErrorLogger.instance) {
            ErrorLogger.instance = new ErrorLogger();
        }
        return ErrorLogger.instance;
    }
    /**
     * Log error with context
     */
    log(error, context, severity = 'error') {
        const entry = {
            error: {
                name: error.name,
                message: error.message,
                stack: this.sanitizeStackTrace(error.stack),
                code: error instanceof APIError ? error.code : undefined,
                statusCode: error instanceof APIError ? error.statusCode : 500,
            },
            context,
            severity,
            timestamp: new Date(),
        };
        this.errorLog.push(entry);
        // Maintain max log size
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
        // Emit event for external monitoring
        EventBus_1.eventBus.emitSync('error.logged', entry, 'ErrorLogger');
        // Console logging based on severity
        this.consoleLog(entry);
    }
    /**
     * Sanitize stack trace to remove sensitive information
     */
    sanitizeStackTrace(stack) {
        if (!stack)
            return undefined;
        return stack
            .split('\n')
            .map(line => {
            // Remove file paths that might contain usernames
            return line.replace(/\/home\/[^\/]+/g, '/home/user')
                .replace(/\/Users\/[^\/]+/g, '/Users/user')
                .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\user');
        })
            .slice(0, 10) // Limit stack trace depth
            .join('\n');
    }
    /**
     * Console log based on severity
     */
    consoleLog(entry) {
        const logData = {
            timestamp: entry.timestamp.toISOString(),
            severity: entry.severity,
            error: entry.error.name,
            message: entry.error.message,
            code: entry.error.code,
            requestId: entry.context.requestId,
            path: entry.context.path,
        };
        switch (entry.severity) {
            case 'critical':
            case 'error':
                console.error('[ERROR]', JSON.stringify(logData, null, 2));
                break;
            case 'warning':
                console.warn('[WARNING]', JSON.stringify(logData, null, 2));
                break;
            case 'info':
                console.info('[INFO]', JSON.stringify(logData, null, 2));
                break;
        }
    }
    /**
     * Get error logs
     */
    getLogs(filter) {
        let logs = [...this.errorLog];
        if (filter?.severity) {
            logs = logs.filter(log => log.severity === filter.severity);
        }
        if (filter?.limit) {
            logs = logs.slice(-filter.limit);
        }
        return logs;
    }
    /**
     * Clear logs
     */
    clear() {
        this.errorLog = [];
    }
}
exports.ErrorLogger = ErrorLogger;
/**
 * Error Response Builder
 */
class ErrorResponseBuilder {
    /**
     * Build user-friendly error response
     */
    static build(error, context, includeStack = false) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (error instanceof APIError) {
            const response = {
                statusCode: error.statusCode,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    error: {
                        message: this.getUserFriendlyMessage(error),
                        code: error.code,
                        timestamp: error.timestamp.toISOString(),
                    },
                },
            };
            // Add request ID if available
            if (context?.requestId) {
                response.body.error.requestId = context.requestId;
            }
            // Add details in development or for operational errors
            if (isDevelopment || error.isOperational) {
                if (error.details) {
                    response.body.error.details = error.details;
                }
            }
            // Add stack trace only in development
            if (isDevelopment && includeStack && error.stack) {
                response.body.error.stack = error.stack.split('\n').slice(0, 10);
            }
            // Add retry-after header for rate limit errors
            if (error instanceof RateLimitError && error.retryAfter) {
                response.headers['Retry-After'] = Math.ceil((error.retryAfter.getTime() - Date.now()) / 1000).toString();
                response.body.error.retryAfter = error.retryAfter.toISOString();
            }
            return response;
        }
        // Generic error response
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: {
                    message: isDevelopment ? error.message : 'An unexpected error occurred',
                    code: 'INTERNAL_ERROR',
                    timestamp: new Date().toISOString(),
                    requestId: context?.requestId,
                    ...(isDevelopment && includeStack && error.stack ? { stack: error.stack.split('\n').slice(0, 10) } : {}),
                },
            },
        };
    }
    /**
     * Get user-friendly error message
     */
    static getUserFriendlyMessage(error) {
        const friendlyMessages = {
            VALIDATION_ERROR: 'The request data is invalid. Please check your input and try again.',
            AUTHENTICATION_ERROR: 'Authentication failed. Please log in and try again.',
            AUTHORIZATION_ERROR: 'You do not have permission to perform this action.',
            NOT_FOUND: 'The requested resource could not be found.',
            CONFLICT_ERROR: 'The request conflicts with existing data.',
            RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down and try again later.',
            SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
            GATEWAY_TIMEOUT: 'The request took too long to process. Please try again.',
            DATABASE_ERROR: 'A database error occurred. Please try again later.',
            EXTERNAL_SERVICE_ERROR: 'An external service failed. Please try again later.',
            CIRCUIT_BREAKER_OPEN: 'The service is temporarily unavailable due to repeated failures.',
        };
        return friendlyMessages[error.code] || error.message;
    }
}
exports.ErrorResponseBuilder = ErrorResponseBuilder;
/**
 * Retry Handler with exponential backoff
 */
class RetryHandler {
    static DEFAULT_CONFIG = {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
    };
    /**
     * Execute function with retry logic
     */
    static async execute(fn, config = {}) {
        const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
        let lastError;
        let delay = fullConfig.initialDelay;
        for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Check if error is retryable
                const isRetryable = this.isRetryableError(lastError, fullConfig);
                // Don't retry on last attempt or non-retryable errors
                if (attempt === fullConfig.maxAttempts || !isRetryable) {
                    throw lastError;
                }
                // Log retry attempt
                console.warn(`Retry attempt ${attempt}/${fullConfig.maxAttempts} after ${delay}ms`, { error: lastError.message });
                // Wait before retrying
                await this.sleep(delay);
                // Calculate next delay with exponential backoff
                delay = Math.min(delay * fullConfig.backoffMultiplier, fullConfig.maxDelay);
            }
        }
        throw lastError || new Error('Retry failed');
    }
    /**
     * Check if error is retryable
     */
    static isRetryableError(error, config) {
        // Check status codes for API errors
        if (error instanceof APIError) {
            return config.retryableStatusCodes?.includes(error.statusCode) || false;
        }
        // Check error codes
        const errorCode = error.code;
        if (errorCode && config.retryableErrors?.includes(errorCode)) {
            return true;
        }
        // Check error message for common transient issues
        const message = error.message.toLowerCase();
        const transientPatterns = ['timeout', 'connection', 'network', 'unavailable', 'econnreset'];
        return transientPatterns.some(pattern => message.includes(pattern));
    }
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RetryHandler = RetryHandler;
/**
 * Circuit Breaker State
 */
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
/**
 * Circuit Breaker for downstream services
 */
class CircuitBreaker {
    state = CircuitState.CLOSED;
    failures = 0;
    successes = 0;
    consecutiveFailures = 0;
    consecutiveSuccesses = 0;
    lastFailureTime;
    nextAttemptTime;
    totalRequests = 0;
    totalFailures = 0;
    totalSuccesses = 0;
    config;
    serviceName;
    static DEFAULT_CONFIG = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 30000,
        resetTimeout: 60000,
        monitoringPeriod: 60000,
    };
    constructor(serviceName, config = {}) {
        this.serviceName = serviceName;
        this.config = { ...CircuitBreaker.DEFAULT_CONFIG, ...config };
    }
    /**
     * Execute function with circuit breaker protection
     */
    async execute(fn) {
        // Check circuit state
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.state = CircuitState.HALF_OPEN;
                console.info(`Circuit breaker for ${this.serviceName} entering HALF_OPEN state`);
            }
            else {
                throw new CircuitBreakerOpenError(this.serviceName, {
                    nextAttemptTime: this.nextAttemptTime,
                });
            }
        }
        this.totalRequests++;
        try {
            // Execute with timeout
            const result = await this.executeWithTimeout(fn);
            // Record success
            this.onSuccess();
            return result;
        }
        catch (error) {
            // Record failure
            this.onFailure();
            throw error;
        }
    }
    /**
     * Execute function with timeout
     */
    async executeWithTimeout(fn) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => setTimeout(() => reject(new GatewayTimeoutError('Circuit breaker timeout')), this.config.timeout)),
        ]);
    }
    /**
     * Handle successful execution
     */
    onSuccess() {
        this.successes++;
        this.consecutiveSuccesses++;
        this.consecutiveFailures = 0;
        this.totalSuccesses++;
        if (this.state === CircuitState.HALF_OPEN) {
            if (this.consecutiveSuccesses >= this.config.successThreshold) {
                this.reset();
                console.info(`Circuit breaker for ${this.serviceName} reset to CLOSED state`);
            }
        }
        EventBus_1.eventBus.emitSync('circuit_breaker.success', {
            service: this.serviceName,
            stats: this.getStats(),
        }, 'CircuitBreaker');
    }
    /**
     * Handle failed execution
     */
    onFailure() {
        this.failures++;
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
        this.lastFailureTime = new Date();
        this.totalFailures++;
        if (this.state === CircuitState.HALF_OPEN) {
            this.open();
            console.warn(`Circuit breaker for ${this.serviceName} reopened after failure in HALF_OPEN state`);
        }
        else if (this.consecutiveFailures >= this.config.failureThreshold) {
            this.open();
            console.error(`Circuit breaker for ${this.serviceName} opened after ${this.consecutiveFailures} consecutive failures`);
        }
        EventBus_1.eventBus.emitSync('circuit_breaker.failure', {
            service: this.serviceName,
            stats: this.getStats(),
        }, 'CircuitBreaker');
    }
    /**
     * Open the circuit
     */
    open() {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
        EventBus_1.eventBus.emitSync('circuit_breaker.opened', {
            service: this.serviceName,
            stats: this.getStats(),
        }, 'CircuitBreaker');
    }
    /**
     * Check if should attempt reset
     */
    shouldAttemptReset() {
        return this.nextAttemptTime ? Date.now() >= this.nextAttemptTime.getTime() : false;
    }
    /**
     * Reset circuit breaker
     */
    reset() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.nextAttemptTime = undefined;
        EventBus_1.eventBus.emitSync('circuit_breaker.reset', {
            service: this.serviceName,
            stats: this.getStats(),
        }, 'CircuitBreaker');
    }
    /**
     * Get circuit breaker statistics
     */
    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            consecutiveFailures: this.consecutiveFailures,
            consecutiveSuccesses: this.consecutiveSuccesses,
            lastFailureTime: this.lastFailureTime,
            nextAttemptTime: this.nextAttemptTime,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
        };
    }
    /**
     * Manually reset circuit breaker
     */
    forceReset() {
        this.reset();
        console.info(`Circuit breaker for ${this.serviceName} manually reset`);
    }
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Circuit Breaker Manager
 */
class CircuitBreakerManager {
    static instance;
    breakers = new Map();
    constructor() { }
    static getInstance() {
        if (!CircuitBreakerManager.instance) {
            CircuitBreakerManager.instance = new CircuitBreakerManager();
        }
        return CircuitBreakerManager.instance;
    }
    /**
     * Get or create circuit breaker for service
     */
    getBreaker(serviceName, config) {
        if (!this.breakers.has(serviceName)) {
            this.breakers.set(serviceName, new CircuitBreaker(serviceName, config));
        }
        return this.breakers.get(serviceName);
    }
    /**
     * Get all circuit breakers
     */
    getAllBreakers() {
        return this.breakers;
    }
    /**
     * Get circuit breaker statistics for all services
     */
    getAllStats() {
        const stats = {};
        for (const [name, breaker] of this.breakers) {
            stats[name] = breaker.getStats();
        }
        return stats;
    }
    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.forceReset();
        }
    }
}
exports.CircuitBreakerManager = CircuitBreakerManager;
/**
 * Error Recovery Strategies
 */
class ErrorRecoveryStrategy {
    /**
     * Attempt recovery for common error scenarios
     */
    static async attemptRecovery(error, context) {
        if (error instanceof RateLimitError) {
            // Wait and retry strategy
            console.warn('Rate limit hit, waiting before retry', {
                requestId: context.requestId,
                retryAfter: error.retryAfter,
            });
            return true; // Can retry after waiting
        }
        if (error instanceof ServiceUnavailableError) {
            // Service might recover
            console.warn('Service unavailable, can retry', {
                requestId: context.requestId,
            });
            return true;
        }
        if (error instanceof GatewayTimeoutError) {
            // Timeout might be transient
            console.warn('Gateway timeout, can retry', {
                requestId: context.requestId,
            });
            return true;
        }
        if (error instanceof ExternalServiceError) {
            // External service might recover
            console.warn('External service error, can retry', {
                requestId: context.requestId,
                service: error.details?.service,
            });
            return true;
        }
        // Non-recoverable errors
        return false;
    }
    /**
     * Get fallback response for error
     */
    static getFallbackResponse(error, context) {
        // Return cached or default response for certain errors
        if (error instanceof ServiceUnavailableError || error instanceof CircuitBreakerOpenError) {
            return {
                statusCode: 503,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    error: {
                        message: 'Service temporarily unavailable. Using cached data.',
                        code: 'FALLBACK_RESPONSE',
                        timestamp: new Date().toISOString(),
                    },
                    data: null, // Could be populated with cached data
                },
            };
        }
        return null;
    }
}
exports.ErrorRecoveryStrategy = ErrorRecoveryStrategy;
/**
 * Singleton instances
 */
exports.errorLogger = ErrorLogger.getInstance();
exports.circuitBreakerManager = CircuitBreakerManager.getInstance();
