"use strict";
/**
 * COMPREHENSIVE ERROR HANDLING SYSTEM
 * Custom error classes, middleware, logging, and recovery strategies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultResponseStrategy = exports.FallbackServiceStrategy = exports.CacheRecoveryStrategy = exports.ErrorRecoveryManager = exports.EnhancedCircuitBreaker = exports.RetryStrategy = exports.ErrorResponseFormatter = exports.ErrorLogger = exports.StackTraceSanitizer = exports.UpstreamError = exports.ConflictError = exports.PayloadTooLargeError = exports.CircuitBreakerOpenError = exports.BadGatewayError = exports.ServiceUnavailableError = exports.TimeoutError = exports.RateLimitError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.APIGatewayError = void 0;
const events_1 = require("events");
// ============================================================================
// Custom Error Classes
// ============================================================================
class APIGatewayError extends Error {
    statusCode;
    code;
    isOperational;
    context;
    timestamp;
    requestId;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true, context, requestId) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.context = context;
        this.timestamp = new Date();
        this.requestId = requestId;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            code: this.code,
            timestamp: this.timestamp.toISOString(),
            requestId: this.requestId,
            context: this.context,
        };
    }
}
exports.APIGatewayError = APIGatewayError;
class ValidationError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 400, 'VALIDATION_ERROR', true, context, requestId);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 401, 'AUTHENTICATION_ERROR', true, context, requestId);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 403, 'AUTHORIZATION_ERROR', true, context, requestId);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 404, 'NOT_FOUND', true, context, requestId);
    }
}
exports.NotFoundError = NotFoundError;
class RateLimitError extends APIGatewayError {
    retryAfter;
    constructor(message, retryAfter, context, requestId) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', true, context, requestId);
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
class TimeoutError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 408, 'REQUEST_TIMEOUT', true, context, requestId);
    }
}
exports.TimeoutError = TimeoutError;
class ServiceUnavailableError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 503, 'SERVICE_UNAVAILABLE', true, context, requestId);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class BadGatewayError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 502, 'BAD_GATEWAY', true, context, requestId);
    }
}
exports.BadGatewayError = BadGatewayError;
class CircuitBreakerOpenError extends ServiceUnavailableError {
    constructor(service, requestId) {
        super(`Circuit breaker is open for ${service}`, { service }, requestId);
        this.code = 'CIRCUIT_BREAKER_OPEN';
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
class PayloadTooLargeError extends APIGatewayError {
    constructor(message, maxSize, actualSize, requestId) {
        super(message, 413, 'PAYLOAD_TOO_LARGE', true, { maxSize, actualSize }, requestId);
    }
}
exports.PayloadTooLargeError = PayloadTooLargeError;
class ConflictError extends APIGatewayError {
    constructor(message, context, requestId) {
        super(message, 409, 'CONFLICT', true, context, requestId);
    }
}
exports.ConflictError = ConflictError;
class UpstreamError extends APIGatewayError {
    upstreamService;
    upstreamStatus;
    constructor(message, upstreamService, upstreamStatus, requestId) {
        super(message, upstreamStatus || 502, 'UPSTREAM_ERROR', true, { upstreamService, upstreamStatus }, requestId);
        this.upstreamService = upstreamService;
        this.upstreamStatus = upstreamStatus;
    }
}
exports.UpstreamError = UpstreamError;
// ============================================================================
// Stack Trace Sanitizer
// ============================================================================
class StackTraceSanitizer {
    static SENSITIVE_PATTERNS = [
        /password[=:]\s*['"]?([^'"&\s]+)/gi,
        /token[=:]\s*['"]?([^'"&\s]+)/gi,
        /api[_-]?key[=:]\s*['"]?([^'"&\s]+)/gi,
        /secret[=:]\s*['"]?([^'"&\s]+)/gi,
        /authorization:\s*['"]?([^'"&\s]+)/gi,
        /bearer\s+([a-zA-Z0-9\-._~+/]+=*)/gi,
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // Credit card
    ];
    static INTERNAL_PATHS = [
        /\/node_modules\//g,
        /\(internal\//g,
    ];
    static sanitize(stackTrace) {
        let sanitized = stackTrace;
        // Replace sensitive data
        for (const pattern of this.SENSITIVE_PATTERNS) {
            sanitized = sanitized.replace(pattern, (match) => {
                const colonIndex = match.indexOf(':');
                const equalsIndex = match.indexOf('=');
                const splitIndex = Math.max(colonIndex, equalsIndex);
                if (splitIndex > 0) {
                    return match.substring(0, splitIndex + 1) + ' ***';
                }
                return '***';
            });
        }
        return sanitized;
    }
    static filterInternalFrames(stackTrace) {
        const lines = stackTrace.split('\n');
        const filtered = lines.filter(line => {
            return !this.INTERNAL_PATHS.some(pattern => pattern.test(line));
        });
        return filtered.join('\n');
    }
    static getRelevantFrames(stackTrace, limit = 10) {
        const lines = stackTrace.split('\n');
        return lines.slice(0, limit).join('\n');
    }
}
exports.StackTraceSanitizer = StackTraceSanitizer;
// ============================================================================
// Error Logger
// ============================================================================
class ErrorLogger extends events_1.EventEmitter {
    errorLogs = [];
    maxLogs;
    constructor(maxLogs = 1000) {
        super();
        this.maxLogs = maxLogs;
    }
    log(error, context) {
        const severity = this.determineSeverity(error);
        const stackTrace = error.stack || '';
        const sanitizedStackTrace = StackTraceSanitizer.sanitize(StackTraceSanitizer.filterInternalFrames(stackTrace));
        const errorLog = {
            id: this.generateId(),
            error,
            context: this.sanitizeContext(context),
            stackTrace,
            sanitizedStackTrace,
            timestamp: new Date(),
            severity,
        };
        this.errorLogs.push(errorLog);
        // Trim logs if exceeds max
        if (this.errorLogs.length > this.maxLogs) {
            this.errorLogs = this.errorLogs.slice(-this.maxLogs);
        }
        // Emit log event
        this.emit('error:logged', errorLog);
        // Emit severity-specific events
        if (severity === 'critical' || severity === 'high') {
            this.emit('error:critical', errorLog);
        }
        return errorLog;
    }
    determineSeverity(error) {
        if (error instanceof APIGatewayError) {
            if (!error.isOperational) {
                return 'critical';
            }
            if (error.statusCode >= 500) {
                return 'high';
            }
            if (error.statusCode === 429 || error.statusCode === 403) {
                return 'medium';
            }
            return 'low';
        }
        // Unknown errors are critical
        return 'critical';
    }
    sanitizeContext(context) {
        const sanitized = { ...context };
        // Sanitize headers
        if (sanitized.headers) {
            sanitized.headers = this.sanitizeHeaders(sanitized.headers);
        }
        // Sanitize body (remove sensitive fields)
        if (sanitized.body && typeof sanitized.body === 'object') {
            sanitized.body = this.sanitizeObject(sanitized.body);
        }
        return sanitized;
    }
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = [
            'authorization',
            'x-api-key',
            'cookie',
            'set-cookie',
            'x-auth-token',
            'x-csrf-token',
        ];
        for (const key of Object.keys(sanitized)) {
            if (sensitiveHeaders.includes(key.toLowerCase())) {
                sanitized[key] = '***';
            }
        }
        return sanitized;
    }
    sanitizeObject(obj) {
        const sanitized = {};
        const sensitiveKeys = [
            'password',
            'token',
            'secret',
            'apiKey',
            'api_key',
            'privateKey',
            'private_key',
            'creditCard',
            'ssn',
        ];
        for (const [key, value] of Object.entries(obj)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                sanitized[key] = '***';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    getLogs(filter) {
        let logs = [...this.errorLogs];
        if (filter) {
            if (filter.severity) {
                logs = logs.filter(log => log.severity === filter.severity);
            }
            if (filter.since) {
                logs = logs.filter(log => log.timestamp >= filter.since);
            }
            if (filter.limit) {
                logs = logs.slice(-filter.limit);
            }
        }
        return logs;
    }
    getStats() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 3600000);
        const bySeverity = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };
        let recent = 0;
        for (const log of this.errorLogs) {
            bySeverity[log.severity]++;
            if (log.timestamp >= oneHourAgo) {
                recent++;
            }
        }
        return {
            total: this.errorLogs.length,
            bySeverity,
            recent,
        };
    }
    generateId() {
        return `err-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
}
exports.ErrorLogger = ErrorLogger;
// ============================================================================
// Error Response Formatter
// ============================================================================
class ErrorResponseFormatter {
    static format(error, requestId, includeStack = false) {
        if (error instanceof APIGatewayError) {
            return {
                error: {
                    code: error.code,
                    message: this.getUserFriendlyMessage(error),
                    statusCode: error.statusCode,
                    timestamp: error.timestamp.toISOString(),
                    requestId: error.requestId || requestId,
                    details: error.context,
                    ...(includeStack && {
                        stack: StackTraceSanitizer.getRelevantFrames(StackTraceSanitizer.sanitize(error.stack || ''), 5),
                    }),
                },
            };
        }
        // Generic error
        return {
            error: {
                code: 'INTERNAL_ERROR',
                message: this.getUserFriendlyMessage(error),
                statusCode: 500,
                timestamp: new Date().toISOString(),
                requestId,
                ...(includeStack && {
                    stack: StackTraceSanitizer.getRelevantFrames(StackTraceSanitizer.sanitize(error.stack || ''), 5),
                }),
            },
        };
    }
    static getUserFriendlyMessage(error) {
        if (error instanceof APIGatewayError) {
            // Return the original message for operational errors
            if (error.isOperational) {
                return error.message;
            }
        }
        // Map common error patterns to user-friendly messages
        const message = error.message.toLowerCase();
        if (message.includes('timeout') || message.includes('timed out')) {
            return 'The request took too long to process. Please try again.';
        }
        if (message.includes('connection') || message.includes('econnrefused')) {
            return 'Unable to connect to the service. Please try again later.';
        }
        if (message.includes('network') || message.includes('dns')) {
            return 'Network error occurred. Please check your connection.';
        }
        if (message.includes('parse') || message.includes('json')) {
            return 'Invalid request format. Please check your data.';
        }
        // Generic message for unknown errors
        return 'An unexpected error occurred. Please try again or contact support.';
    }
}
exports.ErrorResponseFormatter = ErrorResponseFormatter;
class RetryStrategy {
    static DEFAULT_CONFIG = {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 10000,
        backoffMultiplier: 2,
        retryableErrors: [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ENETUNREACH',
        ],
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    };
    static async executeWithRetry(operation, config = {}) {
        const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
        let lastError = null;
        for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                // Check if error is retryable
                if (!this.isRetryable(error, fullConfig)) {
                    throw error;
                }
                // Don't wait after the last attempt
                if (attempt < fullConfig.maxRetries) {
                    const delay = this.calculateDelay(attempt, fullConfig);
                    await this.sleep(delay);
                }
            }
        }
        throw lastError;
    }
    static isRetryable(error, config) {
        // Check if it's a retryable API Gateway error
        if (error instanceof APIGatewayError) {
            return config.retryableStatusCodes.includes(error.statusCode);
        }
        // Check error code
        const errorCode = error.code;
        if (errorCode && config.retryableErrors.includes(errorCode)) {
            return true;
        }
        // Check error message for common patterns
        const message = error.message.toLowerCase();
        return (message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('network') ||
            message.includes('unavailable'));
    }
    static calculateDelay(attempt, config) {
        const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
        const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
        return Math.min(exponentialDelay + jitter, config.maxDelay);
    }
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RetryStrategy = RetryStrategy;
class EnhancedCircuitBreaker extends events_1.EventEmitter {
    metrics;
    options;
    serviceName;
    constructor(serviceName, options = {}) {
        super();
        this.serviceName = serviceName;
        this.options = {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            halfOpenRequests: 3,
            monitoringPeriod: 10000,
            volumeThreshold: 10,
            ...options,
        };
        this.metrics = {
            state: 'closed',
            failures: 0,
            successes: 0,
            totalRequests: 0,
            lastStateChange: new Date(),
            halfOpenAttempts: 0,
        };
    }
    async execute(operation) {
        // Check if circuit is open
        if (this.metrics.state === 'open') {
            if (this.metrics.nextAttempt &&
                new Date() >= this.metrics.nextAttempt) {
                this.transitionToHalfOpen();
            }
            else {
                throw new CircuitBreakerOpenError(this.serviceName);
            }
        }
        // Check half-open request limit
        if (this.metrics.state === 'half_open' &&
            this.metrics.halfOpenAttempts >= this.options.halfOpenRequests) {
            throw new CircuitBreakerOpenError(this.serviceName);
        }
        this.metrics.totalRequests++;
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.metrics.successes++;
        this.metrics.failures = 0;
        if (this.metrics.state === 'half_open') {
            this.metrics.halfOpenAttempts++;
            if (this.metrics.successes >= this.options.successThreshold) {
                this.transitionToClosed();
            }
        }
        this.emit('success', {
            service: this.serviceName,
            state: this.metrics.state,
            successes: this.metrics.successes,
        });
    }
    onFailure() {
        this.metrics.failures++;
        this.metrics.lastFailureTime = new Date();
        this.metrics.successes = 0;
        if (this.metrics.state === 'half_open') {
            this.transitionToOpen();
        }
        else if (this.metrics.state === 'closed') {
            // Check if we should open the circuit
            if (this.metrics.totalRequests >= this.options.volumeThreshold &&
                this.metrics.failures >= this.options.failureThreshold) {
                this.transitionToOpen();
            }
        }
        this.emit('failure', {
            service: this.serviceName,
            state: this.metrics.state,
            failures: this.metrics.failures,
        });
    }
    transitionToOpen() {
        this.metrics.state = 'open';
        this.metrics.nextAttempt = new Date(Date.now() + this.options.timeout);
        this.metrics.lastStateChange = new Date();
        this.metrics.halfOpenAttempts = 0;
        this.emit('state:open', {
            service: this.serviceName,
            failures: this.metrics.failures,
            nextAttempt: this.metrics.nextAttempt,
        });
    }
    transitionToHalfOpen() {
        this.metrics.state = 'half_open';
        this.metrics.successes = 0;
        this.metrics.halfOpenAttempts = 0;
        this.metrics.lastStateChange = new Date();
        this.emit('state:half_open', {
            service: this.serviceName,
        });
    }
    transitionToClosed() {
        this.metrics.state = 'closed';
        this.metrics.failures = 0;
        this.metrics.successes = 0;
        this.metrics.totalRequests = 0;
        this.metrics.lastStateChange = new Date();
        this.metrics.halfOpenAttempts = 0;
        this.metrics.nextAttempt = undefined;
        this.emit('state:closed', {
            service: this.serviceName,
        });
    }
    getMetrics() {
        return { ...this.metrics };
    }
    reset() {
        this.transitionToClosed();
    }
    forceOpen() {
        this.transitionToOpen();
    }
}
exports.EnhancedCircuitBreaker = EnhancedCircuitBreaker;
class ErrorRecoveryManager {
    strategies = [];
    registerStrategy(strategy) {
        this.strategies.push(strategy);
    }
    async attemptRecovery(error, context) {
        for (const strategy of this.strategies) {
            if (strategy.canHandle(error)) {
                try {
                    const result = await strategy.recover(error, context);
                    return {
                        recovered: true,
                        result,
                        strategy: strategy.name,
                    };
                }
                catch (recoveryError) {
                    // Strategy failed, try next one
                    continue;
                }
            }
        }
        return { recovered: false };
    }
}
exports.ErrorRecoveryManager = ErrorRecoveryManager;
// Default recovery strategies
exports.CacheRecoveryStrategy = {
    name: 'cache_fallback',
    canHandle: (error) => {
        return (error instanceof ServiceUnavailableError ||
            error instanceof TimeoutError ||
            error instanceof UpstreamError);
    },
    recover: async (error, context) => {
        // Attempt to return cached response
        if (context.cache && context.cacheKey) {
            const cached = context.cache.get(context.cacheKey);
            if (cached) {
                return {
                    ...cached,
                    fromCache: true,
                    stale: true,
                };
            }
        }
        throw error;
    },
};
exports.FallbackServiceStrategy = {
    name: 'fallback_service',
    canHandle: (error) => {
        return error instanceof ServiceUnavailableError || error instanceof UpstreamError;
    },
    recover: async (error, context) => {
        // Attempt to use fallback service
        if (context.fallbackService) {
            return await context.fallbackService();
        }
        throw error;
    },
};
exports.DefaultResponseStrategy = {
    name: 'default_response',
    canHandle: (error) => {
        return error instanceof ServiceUnavailableError;
    },
    recover: async (error, context) => {
        // Return a default safe response
        if (context.defaultResponse) {
            return context.defaultResponse;
        }
        throw error;
    },
};
