"use strict";
/**
 * API Gateway and Rate Limiting
 * API management, rate limiting, throttling, quota management, and API analytics
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationSchemas = exports.ValidationMiddleware = exports.quotaManager = exports.apiGateway = exports.QuotaManager = exports.MetricsCollector = exports.APICache = exports.RateLimiter = exports.APIGateway = exports.RequestValidator = exports.InputSanitizer = exports.RateLimitStrategy = exports.HTTPMethod = void 0;
const EventBus_1 = require("../core/EventBus");
const MEGA_SecurityAuthentication_1 = require("../security/MEGA_SecurityAuthentication");
const zod_1 = require("zod");
const validator_1 = __importDefault(require("validator"));
const xss_1 = __importDefault(require("xss"));
const ErrorHandling_1 = require("./ErrorHandling");
const ErrorMiddleware_1 = require("./ErrorMiddleware");
var HTTPMethod;
(function (HTTPMethod) {
    HTTPMethod["GET"] = "GET";
    HTTPMethod["POST"] = "POST";
    HTTPMethod["PUT"] = "PUT";
    HTTPMethod["DELETE"] = "DELETE";
    HTTPMethod["PATCH"] = "PATCH";
    HTTPMethod["OPTIONS"] = "OPTIONS";
    HTTPMethod["HEAD"] = "HEAD";
})(HTTPMethod || (exports.HTTPMethod = HTTPMethod = {}));
var RateLimitStrategy;
(function (RateLimitStrategy) {
    RateLimitStrategy["FixedWindow"] = "fixed_window";
    RateLimitStrategy["SlidingWindow"] = "sliding_window";
    RateLimitStrategy["TokenBucket"] = "token_bucket";
    RateLimitStrategy["LeakyBucket"] = "leaky_bucket";
})(RateLimitStrategy || (exports.RateLimitStrategy = RateLimitStrategy = {}));
/**
 * Input Sanitizer - Prevents XSS, SQL Injection, Command Injection, Path Traversal
 */
class InputSanitizer {
    /**
     * Sanitize string input to prevent XSS attacks
     */
    static sanitizeHTML(input, config) {
        if (!config?.allowHTML) {
            // Strip all HTML tags if not explicitly allowed
            return (0, xss_1.default)(input, {
                whiteList: {},
                stripIgnoreTag: true,
                stripIgnoreTagBody: ['script', 'style'],
            });
        }
        // Allow specific tags if configured
        const whiteList = {};
        if (config.allowedTags && config.allowedAttributes) {
            config.allowedTags.forEach(tag => {
                whiteList[tag] = config.allowedAttributes[tag] || [];
            });
        }
        return (0, xss_1.default)(input, {
            whiteList,
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script', 'style'],
        });
    }
    /**
     * Prevent SQL injection by escaping dangerous characters
     */
    static sanitizeSQL(input) {
        // Escape single quotes, double quotes, backslashes, and null bytes
        return input
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/"/g, '\\"')
            .replace(/\x00/g, '\\0')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\x1a/g, '\\Z');
    }
    /**
     * Prevent command injection by removing dangerous shell characters
     */
    static sanitizeCommand(input) {
        // Remove or escape shell metacharacters
        const dangerous = /[;&|`$(){}[\]<>!\n\r]/g;
        return input.replace(dangerous, '');
    }
    /**
     * Prevent path traversal attacks
     */
    static sanitizePath(input) {
        // Remove path traversal sequences
        let sanitized = input
            .replace(/\.\./g, '')
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/^\/+/, '');
        // Remove null bytes
        sanitized = sanitized.replace(/\x00/g, '');
        // Ensure no absolute paths
        if (sanitized.startsWith('/')) {
            sanitized = sanitized.substring(1);
        }
        return sanitized;
    }
    /**
     * Sanitize object recursively
     */
    static sanitizeObject(obj, config) {
        if (obj === null || obj === undefined) {
            return obj;
        }
        if (typeof obj === 'string') {
            return this.sanitizeHTML(obj, config);
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, config));
        }
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = this.sanitizeObject(obj[key], config);
                }
            }
            return sanitized;
        }
        return obj;
    }
    /**
     * Validate and sanitize email
     */
    static sanitizeEmail(email) {
        const trimmed = email.trim().toLowerCase();
        return validator_1.default.isEmail(trimmed) ? trimmed : null;
    }
    /**
     * Validate and sanitize URL
     */
    static sanitizeURL(url) {
        const trimmed = url.trim();
        return validator_1.default.isURL(trimmed, {
            protocols: ['http', 'https'],
            require_protocol: true,
        }) ? trimmed : null;
    }
}
exports.InputSanitizer = InputSanitizer;
/**
 * Request Validator - Comprehensive validation with Zod schemas
 */
class RequestValidator {
    /**
     * Validate request against validation config
     */
    static validate(request, config) {
        const errors = [];
        // Validate body
        if (config.body) {
            const bodyErrors = this.validateValue(request.body, config.body, 'body');
            errors.push(...bodyErrors);
        }
        // Validate query parameters
        if (config.query) {
            const queryErrors = this.validateValue(request.query, config.query, 'query');
            errors.push(...queryErrors);
        }
        // Validate path parameters
        if (config.params) {
            const paramsErrors = this.validateValue(request.params, config.params, 'params');
            errors.push(...paramsErrors);
        }
        // Validate headers
        if (config.headers) {
            const headersErrors = this.validateValue(request.headers, config.headers, 'headers');
            errors.push(...headersErrors);
        }
        return errors;
    }
    /**
     * Validate value against schema
     */
    static validateValue(value, schema, path) {
        const errors = [];
        // Use Zod schema if provided
        if (schema.zodSchema) {
            try {
                schema.zodSchema.parse(value);
            }
            catch (error) {
                if (error instanceof zod_1.z.ZodError) {
                    error.errors.forEach(err => {
                        errors.push({
                            field: `${path}.${err.path.join('.')}`,
                            message: err.message,
                            value: err.code,
                        });
                    });
                }
            }
            return errors;
        }
        // Type validation
        if (!this.validateType(value, schema.type)) {
            errors.push({
                field: path,
                message: `Expected type ${schema.type}, got ${typeof value}`,
                value,
            });
            return errors;
        }
        // Type-specific validation
        switch (schema.type) {
            case 'string':
                errors.push(...this.validateString(value, schema, path));
                break;
            case 'number':
                errors.push(...this.validateNumber(value, schema, path));
                break;
            case 'array':
                errors.push(...this.validateArray(value, schema, path));
                break;
            case 'object':
                errors.push(...this.validateObject(value, schema, path));
                break;
        }
        return errors;
    }
    /**
     * Validate type
     */
    static validateType(value, type) {
        if (value === null || value === undefined) {
            return false;
        }
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && !Array.isArray(value);
            default:
                return false;
        }
    }
    /**
     * Validate string
     */
    static validateString(value, schema, path) {
        const errors = [];
        // Length validation
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push({
                field: path,
                message: `String length must be at least ${schema.minLength}`,
                value: value.length,
            });
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push({
                field: path,
                message: `String length must be at most ${schema.maxLength}`,
                value: value.length,
            });
        }
        // Pattern validation
        if (schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(value)) {
                errors.push({
                    field: path,
                    message: `String does not match pattern ${schema.pattern}`,
                    value,
                });
            }
        }
        // Format validation
        if (schema.format) {
            const formatError = this.validateFormat(value, schema.format, path);
            if (formatError) {
                errors.push(formatError);
            }
        }
        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push({
                field: path,
                message: `Value must be one of: ${schema.enum.join(', ')}`,
                value,
            });
        }
        return errors;
    }
    /**
     * Validate number
     */
    static validateNumber(value, schema, path) {
        const errors = [];
        // Range validation
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push({
                field: path,
                message: `Number must be at least ${schema.minimum}`,
                value,
            });
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push({
                field: path,
                message: `Number must be at most ${schema.maximum}`,
                value,
            });
        }
        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push({
                field: path,
                message: `Value must be one of: ${schema.enum.join(', ')}`,
                value,
            });
        }
        return errors;
    }
    /**
     * Validate array
     */
    static validateArray(value, schema, path) {
        const errors = [];
        // Length validation
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push({
                field: path,
                message: `Array length must be at least ${schema.minLength}`,
                value: value.length,
            });
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push({
                field: path,
                message: `Array length must be at most ${schema.maxLength}`,
                value: value.length,
            });
        }
        // Validate items
        if (schema.items) {
            value.forEach((item, index) => {
                const itemErrors = this.validateValue(item, schema.items, `${path}[${index}]`);
                errors.push(...itemErrors);
            });
        }
        return errors;
    }
    /**
     * Validate object
     */
    static validateObject(value, schema, path) {
        const errors = [];
        // Check required properties
        if (schema.required) {
            schema.required.forEach(prop => {
                if (!(prop in value) || value[prop] === undefined || value[prop] === null) {
                    errors.push({
                        field: `${path}.${prop}`,
                        message: `Required property ${prop} is missing`,
                    });
                }
            });
        }
        // Validate properties
        if (schema.properties) {
            Object.keys(schema.properties).forEach(prop => {
                if (prop in value && value[prop] !== undefined) {
                    const propErrors = this.validateValue(value[prop], schema.properties[prop], `${path}.${prop}`);
                    errors.push(...propErrors);
                }
            });
        }
        return errors;
    }
    /**
     * Validate format
     */
    static validateFormat(value, format, path) {
        switch (format) {
            case 'email':
                if (!validator_1.default.isEmail(value)) {
                    return {
                        field: path,
                        message: 'Invalid email format',
                        value,
                    };
                }
                break;
            case 'url':
                if (!validator_1.default.isURL(value, { protocols: ['http', 'https'], require_protocol: true })) {
                    return {
                        field: path,
                        message: 'Invalid URL format',
                        value,
                    };
                }
                break;
            case 'phone':
                if (!validator_1.default.isMobilePhone(value, 'any', { strictMode: false })) {
                    return {
                        field: path,
                        message: 'Invalid phone number format',
                        value,
                    };
                }
                break;
            case 'uuid':
                if (!validator_1.default.isUUID(value)) {
                    return {
                        field: path,
                        message: 'Invalid UUID format',
                        value,
                    };
                }
                break;
            case 'ip':
                if (!validator_1.default.isIP(value)) {
                    return {
                        field: path,
                        message: 'Invalid IP address format',
                        value,
                    };
                }
                break;
            case 'date':
                if (!validator_1.default.isISO8601(value)) {
                    return {
                        field: path,
                        message: 'Invalid ISO 8601 date format',
                        value,
                    };
                }
                break;
            case 'json':
                try {
                    JSON.parse(value);
                }
                catch {
                    return {
                        field: path,
                        message: 'Invalid JSON format',
                        value,
                    };
                }
                break;
        }
        return null;
    }
    /**
     * Create Zod schema from ValidationSchema
     */
    static createZodSchema(schema) {
        switch (schema.type) {
            case 'string':
                let stringSchema = zod_1.z.string();
                if (schema.minLength !== undefined) {
                    stringSchema = stringSchema.min(schema.minLength);
                }
                if (schema.maxLength !== undefined) {
                    stringSchema = stringSchema.max(schema.maxLength);
                }
                if (schema.pattern) {
                    stringSchema = stringSchema.regex(new RegExp(schema.pattern));
                }
                if (schema.format === 'email') {
                    stringSchema = stringSchema.email();
                }
                if (schema.format === 'url') {
                    stringSchema = stringSchema.url();
                }
                if (schema.format === 'uuid') {
                    stringSchema = stringSchema.uuid();
                }
                if (schema.enum) {
                    return zod_1.z.enum(schema.enum);
                }
                return stringSchema;
            case 'number':
                let numberSchema = zod_1.z.number();
                if (schema.minimum !== undefined) {
                    numberSchema = numberSchema.min(schema.minimum);
                }
                if (schema.maximum !== undefined) {
                    numberSchema = numberSchema.max(schema.maximum);
                }
                if (schema.enum) {
                    return zod_1.z.enum(schema.enum.map(String)).transform(Number);
                }
                return numberSchema;
            case 'boolean':
                return zod_1.z.boolean();
            case 'array':
                if (schema.items) {
                    let arraySchema = zod_1.z.array(this.createZodSchema(schema.items));
                    if (schema.minLength !== undefined) {
                        arraySchema = arraySchema.min(schema.minLength);
                    }
                    if (schema.maxLength !== undefined) {
                        arraySchema = arraySchema.max(schema.maxLength);
                    }
                    return arraySchema;
                }
                return zod_1.z.array(zod_1.z.any());
            case 'object':
                if (schema.properties) {
                    const shape = {};
                    Object.keys(schema.properties).forEach(key => {
                        let propSchema = this.createZodSchema(schema.properties[key]);
                        // Make optional if not required
                        if (!schema.required?.includes(key)) {
                            propSchema = propSchema.optional();
                        }
                        shape[key] = propSchema;
                    });
                    return zod_1.z.object(shape);
                }
                return zod_1.z.record(zod_1.z.any());
            default:
                return zod_1.z.any();
        }
    }
}
exports.RequestValidator = RequestValidator;
/**
 * API Gateway
 */
class APIGateway {
    endpoints = new Map();
    rateLimiter;
    cache;
    metrics;
    globalMiddleware = [];
    authSystem;
    rbacSystem;
    auditLogger;
    errorHandler;
    circuitBreakerManager = ErrorHandling_1.circuitBreakerManager;
    constructor(authSystem, rbacSystem, auditLogger, options) {
        this.rateLimiter = new RateLimiter();
        this.cache = new APICache();
        this.metrics = new MetricsCollector();
        this.authSystem = authSystem || new MEGA_SecurityAuthentication_1.AuthenticationSystem();
        this.rbacSystem = rbacSystem || new MEGA_SecurityAuthentication_1.RBACSystem();
        this.auditLogger = auditLogger || new MEGA_SecurityAuthentication_1.AuditLogger();
        this.errorHandler = new ErrorMiddleware_1.ErrorHandlerMiddleware({
            includeStackTrace: options?.errorHandlingOptions?.includeStackTrace,
        });
        // Add comprehensive error handling middleware by default
        if (options?.enableErrorHandling !== false) {
            const errorMiddleware = ErrorMiddleware_1.ErrorMiddlewareStack.create(options?.errorHandlingOptions || {});
            errorMiddleware.forEach(mw => this.globalMiddleware.push(mw));
        }
    }
    /**
     * Register endpoint
     */
    registerEndpoint(endpoint) {
        const fullEndpoint = {
            ...endpoint,
            id: this.generateEndpointId(endpoint.method, endpoint.path),
        };
        this.endpoints.set(fullEndpoint.id, fullEndpoint);
        EventBus_1.eventBus.emitSync('api.endpoint_registered', fullEndpoint, 'APIGateway');
        return fullEndpoint;
    }
    /**
     * Remove endpoint
     */
    removeEndpoint(endpointId) {
        this.endpoints.delete(endpointId);
        EventBus_1.eventBus.emitSync('api.endpoint_removed', { endpointId }, 'APIGateway');
    }
    /**
     * Handle request with comprehensive error handling
     */
    async handleRequest(request) {
        const context = {
            requestId: this.generateRequestId(),
            startTime: Date.now(),
            metadata: {},
        };
        EventBus_1.eventBus.emitSync('api.request_received', { request, context }, 'APIGateway');
        try {
            // Find matching endpoint
            const endpoint = this.findEndpoint(request.method, request.path);
            if (!endpoint) {
                throw new ErrorHandling_1.NotFoundError('Endpoint', { path: request.path, method: request.method });
            }
            // Extract path parameters
            request.params = this.extractParams(endpoint.path, request.path);
            // Check rate limit
            if (endpoint.rateLimit) {
                const rateLimitKey = endpoint.rateLimit.keyGenerator
                    ? endpoint.rateLimit.keyGenerator(request)
                    : this.defaultRateLimitKey(request);
                const allowed = await this.rateLimiter.checkLimit(rateLimitKey, endpoint.rateLimit);
                if (!allowed) {
                    const state = this.rateLimiter.getState(rateLimitKey);
                    throw new ErrorHandling_1.RateLimitError('Rate limit exceeded', state?.resetAt, {
                        limit: endpoint.rateLimit.limit,
                        window: endpoint.rateLimit.window,
                    });
                }
            }
            // Check cache
            if (endpoint.caching?.enabled && request.method === HTTPMethod.GET) {
                const cacheKey = endpoint.caching.keyGenerator
                    ? endpoint.caching.keyGenerator(request)
                    : this.defaultCacheKey(request);
                const cached = await this.cache.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            // Validate request
            if (endpoint.validation) {
                const errors = RequestValidator.validate(request, endpoint.validation);
                if (errors.length > 0) {
                    throw new ErrorHandling_1.ValidationError('Request validation failed', {
                        errors: errors.map(err => ({
                            field: err.field,
                            message: err.message,
                            value: err.value,
                        })),
                    });
                }
            }
            // Sanitize request inputs to prevent injection attacks
            request.body = InputSanitizer.sanitizeObject(request.body);
            request.query = InputSanitizer.sanitizeObject(request.query);
            request.params = InputSanitizer.sanitizeObject(request.params);
            // Authenticate
            if (endpoint.authentication?.required) {
                const authenticated = await this.authenticate(request, endpoint.authentication);
                if (!authenticated) {
                    throw new ErrorHandling_1.AuthenticationError('Authentication required', {
                        path: request.path,
                        method: request.method,
                    });
                }
                // Set userId in context from authenticated user
                const user = request.user;
                if (user) {
                    context.userId = user.id;
                }
            }
            // Authorize
            if (endpoint.authorization) {
                const authorized = await this.authorize(request, context, endpoint.authorization);
                if (!authorized) {
                    throw new ErrorHandling_1.AuthorizationError('Insufficient permissions', {
                        path: request.path,
                        method: request.method,
                        userId: context.userId,
                    });
                }
            }
            // Execute middleware chain
            const handler = this.buildMiddlewareChain([...this.globalMiddleware, ...endpoint.middleware], endpoint.handler);
            const response = await handler(request, context);
            // Cache response
            if (endpoint.caching?.enabled && request.method === HTTPMethod.GET && response.statusCode === 200) {
                const cacheKey = endpoint.caching.keyGenerator
                    ? endpoint.caching.keyGenerator(request)
                    : this.defaultCacheKey(request);
                await this.cache.set(cacheKey, response, endpoint.caching.ttl);
            }
            // Collect metrics
            const duration = Date.now() - context.startTime;
            this.metrics.record(endpoint, request, response, duration);
            EventBus_1.eventBus.emitSync('api.request_completed', { request, response, context, duration }, 'APIGateway');
            return response;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
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
            // Log error with context
            const severity = this.determineErrorSeverity(err);
            ErrorHandling_1.errorLogger.log(err, errorContext, severity);
            // Record error metrics
            ErrorMiddleware_1.errorMetricsCollector.record(err, errorContext);
            // Emit error event
            EventBus_1.eventBus.emitSync('api.request_failed', { request, context, error: err }, 'APIGateway');
            // Return appropriate error response
            if (err instanceof ErrorHandling_1.APIError) {
                return this.createErrorResponseFromAPIError(err, context);
            }
            return this.createErrorResponse(500, 'Internal server error', context.requestId);
        }
    }
    /**
     * Add global middleware
     */
    use(middleware) {
        this.globalMiddleware.push(middleware);
    }
    /**
     * Get metrics
     */
    getMetrics(filter) {
        return this.metrics.getMetrics(filter);
    }
    /**
     * Get authentication system
     */
    getAuthSystem() {
        return this.authSystem;
    }
    /**
     * Get RBAC system
     */
    getRBACSystem() {
        return this.rbacSystem;
    }
    /**
     * Get audit logger
     */
    getAuditLogger() {
        return this.auditLogger;
    }
    /**
     * Get circuit breaker manager
     */
    getCircuitBreakerManager() {
        return this.circuitBreakerManager;
    }
    /**
     * Get error logger
     */
    getErrorLogger() {
        return ErrorHandling_1.errorLogger;
    }
    /**
     * Get error metrics
     */
    getErrorMetrics(filter) {
        return ErrorMiddleware_1.errorMetricsCollector.getMetrics(filter);
    }
    /**
     * Execute with retry logic
     */
    async executeWithRetry(fn, config) {
        return ErrorHandling_1.RetryHandler.execute(fn, config);
    }
    /**
     * Execute with circuit breaker
     */
    async executeWithCircuitBreaker(serviceName, fn, config) {
        const breaker = this.circuitBreakerManager.getBreaker(serviceName, config);
        return breaker.execute(fn);
    }
    /**
     * List endpoints
     */
    listEndpoints(filter) {
        let endpoints = Array.from(this.endpoints.values());
        if (filter?.tags) {
            endpoints = endpoints.filter(e => e.tags.some(t => filter.tags.includes(t)));
        }
        return endpoints;
    }
    /**
     * Generate OpenAPI specification
     */
    generateOpenAPISpec() {
        const paths = {};
        for (const endpoint of this.endpoints.values()) {
            if (!paths[endpoint.path]) {
                paths[endpoint.path] = {};
            }
            paths[endpoint.path][endpoint.method.toLowerCase()] = {
                summary: endpoint.documentation?.summary,
                description: endpoint.documentation?.description,
                parameters: endpoint.documentation?.parameters,
                requestBody: endpoint.documentation?.requestBody,
                responses: endpoint.documentation?.responses,
                tags: endpoint.tags,
            };
        }
        return {
            openapi: '3.0.0',
            info: {
                title: 'API Gateway',
                version: '1.0.0',
            },
            paths,
        };
    }
    findEndpoint(method, path) {
        for (const endpoint of this.endpoints.values()) {
            if (endpoint.method === method && this.matchPath(endpoint.path, path)) {
                return endpoint;
            }
        }
        return undefined;
    }
    matchPath(pattern, path) {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        if (patternParts.length !== pathParts.length) {
            return false;
        }
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                continue;
            }
            if (patternParts[i] !== pathParts[i]) {
                return false;
            }
        }
        return true;
    }
    extractParams(pattern, path) {
        const params = {};
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                const paramName = patternParts[i].substring(1);
                params[paramName] = pathParts[i];
            }
        }
        return params;
    }
    validateRequest(request, validation) {
        // Validate using comprehensive validator
        const errors = RequestValidator.validate(request, validation);
        if (errors.length > 0) {
            // Format errors as readable message
            const errorMessages = errors.map(err => `${err.field}: ${err.message}`).join('; ');
            return errorMessages;
        }
        return null;
    }
    /**
     * Determine error severity for logging
     */
    determineErrorSeverity(error) {
        if (error instanceof ErrorHandling_1.ValidationError || error instanceof ErrorHandling_1.NotFoundError) {
            return 'info';
        }
        if (error instanceof ErrorHandling_1.RateLimitError || error instanceof ErrorHandling_1.AuthenticationError) {
            return 'warning';
        }
        if (error instanceof ErrorHandling_1.AuthorizationError || error instanceof ErrorHandling_1.DatabaseError) {
            return 'error';
        }
        if (error instanceof ErrorHandling_1.APIError && !error.isOperational) {
            return 'critical';
        }
        return 'error';
    }
    /**
     * Create error response from APIError
     */
    createErrorResponseFromAPIError(error, context) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const response = {
            statusCode: error.statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: {
                    message: this.getUserFriendlyErrorMessage(error),
                    code: error.code,
                    timestamp: error.timestamp.toISOString(),
                    requestId: context.requestId,
                },
            },
        };
        // Add details in development or for operational errors
        if (isDevelopment || error.isOperational) {
            if (error.details) {
                response.body.error.details = error.details;
            }
        }
        // Add stack trace only in development
        if (isDevelopment && error.stack) {
            response.body.error.stack = this.sanitizeStackTrace(error.stack);
        }
        // Add retry-after header for rate limit errors
        if (error instanceof ErrorHandling_1.RateLimitError && error.retryAfter) {
            response.headers['Retry-After'] = Math.ceil((error.retryAfter.getTime() - Date.now()) / 1000).toString();
            response.body.error.retryAfter = error.retryAfter.toISOString();
        }
        return response;
    }
    /**
     * Get user-friendly error message
     */
    getUserFriendlyErrorMessage(error) {
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
    /**
     * Sanitize stack trace
     */
    sanitizeStackTrace(stack) {
        return stack
            .split('\n')
            .map(line => {
            // Remove file paths that might contain sensitive information
            return line
                .replace(/\/home\/[^\/]+/g, '/home/user')
                .replace(/\/Users\/[^\/]+/g, '/Users/user')
                .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\user');
        })
            .slice(0, 10); // Limit stack trace depth
    }
    async authenticate(request, config) {
        try {
            // Extract token from Authorization header
            const authHeader = request.headers['authorization'] || request.headers['Authorization'];
            if (!authHeader) {
                this.auditLogger.log({
                    userId: undefined,
                    action: 'login',
                    resource: 'api',
                    result: 'failure',
                    ipAddress: request.ip,
                    userAgent: request.userAgent,
                    details: new Map([
                        ['reason', 'Missing authorization header'],
                        ['path', request.path]
                    ]),
                    severity: 'low',
                });
                return false;
            }
            let token;
            // Handle different authentication types
            switch (config.type) {
                case 'bearer':
                    if (!authHeader.startsWith('Bearer ')) {
                        this.auditLogger.log({
                            userId: undefined,
                            action: 'login',
                            resource: 'api',
                            result: 'failure',
                            ipAddress: request.ip,
                            userAgent: request.userAgent,
                            details: new Map([
                                ['reason', 'Invalid bearer token format'],
                                ['path', request.path]
                            ]),
                            severity: 'low',
                        });
                        return false;
                    }
                    token = authHeader.substring(7);
                    break;
                case 'basic':
                    // Basic auth not implemented for JWT
                    this.auditLogger.log({
                        userId: undefined,
                        action: 'login',
                        resource: 'api',
                        result: 'failure',
                        ipAddress: request.ip,
                        userAgent: request.userAgent,
                        details: new Map([
                            ['reason', 'Basic auth not supported'],
                            ['path', request.path]
                        ]),
                        severity: 'low',
                    });
                    return false;
                case 'api_key':
                    token = authHeader;
                    break;
                default:
                    token = authHeader.replace(/^Bearer /, '');
            }
            // Verify JWT token and get user
            const user = await this.authSystem.verifySession(token);
            if (!user) {
                this.auditLogger.log({
                    userId: undefined,
                    action: 'login',
                    resource: 'api',
                    result: 'failure',
                    ipAddress: request.ip,
                    userAgent: request.userAgent,
                    details: new Map([
                        ['reason', 'Invalid or expired token'],
                        ['path', request.path]
                    ]),
                    severity: 'medium',
                });
                return false;
            }
            // Check user status
            if (user.status !== 'active') {
                this.auditLogger.log({
                    userId: user.id,
                    action: 'login',
                    resource: 'api',
                    result: 'denied',
                    ipAddress: request.ip,
                    userAgent: request.userAgent,
                    details: new Map([
                        ['reason', `User status: ${user.status}`],
                        ['path', request.path],
                        ['username', user.username]
                    ]),
                    severity: 'high',
                });
                return false;
            }
            // Store user information in request context (will be set in handleRequest)
            request.user = user;
            // Log successful authentication
            this.auditLogger.log({
                userId: user.id,
                action: 'login',
                resource: 'api',
                result: 'success',
                ipAddress: request.ip,
                userAgent: request.userAgent,
                details: new Map([
                    ['path', request.path],
                    ['method', request.method],
                    ['username', user.username]
                ]),
                severity: 'low',
            });
            return true;
        }
        catch (error) {
            this.auditLogger.log({
                userId: undefined,
                action: 'login',
                resource: 'api',
                result: 'failure',
                ipAddress: request.ip,
                userAgent: request.userAgent,
                details: new Map([
                    ['reason', error instanceof Error ? error.message : 'Unknown error'],
                    ['path', request.path]
                ]),
                severity: 'high',
            });
            return false;
        }
    }
    async authorize(request, context, config) {
        try {
            // If custom authorization function is provided, use it
            if (config.custom) {
                const allowed = await config.custom(request, context);
                this.auditLogger.log({
                    userId: context.userId,
                    action: 'access',
                    resource: request.path,
                    result: allowed ? 'success' : 'denied',
                    ipAddress: request.ip,
                    userAgent: request.userAgent,
                    details: new Map([
                        ['method', request.method],
                        ['customAuth', 'true']
                    ]),
                    severity: allowed ? 'low' : 'medium',
                });
                return allowed;
            }
            // Get authenticated user from request
            const user = request.user;
            if (!user) {
                this.auditLogger.log({
                    userId: context.userId,
                    action: 'access',
                    resource: request.path,
                    result: 'denied',
                    ipAddress: request.ip,
                    userAgent: request.userAgent,
                    details: new Map([
                        ['reason', 'No authenticated user found'],
                        ['method', request.method]
                    ]),
                    severity: 'high',
                });
                return false;
            }
            // Set context userId if not already set
            if (!context.userId) {
                context.userId = user.id;
            }
            // Check role-based authorization
            if (config.roles && config.roles.length > 0) {
                const hasRequiredRole = config.roles.some(role => user.roles.includes(role));
                if (!hasRequiredRole) {
                    this.auditLogger.log({
                        userId: user.id,
                        action: 'access',
                        resource: request.path,
                        result: 'denied',
                        ipAddress: request.ip,
                        userAgent: request.userAgent,
                        details: new Map([
                            ['reason', 'Missing required role'],
                            ['requiredRoles', config.roles.join(', ')],
                            ['userRoles', user.roles.join(', ')],
                            ['method', request.method],
                            ['username', user.username]
                        ]),
                        severity: 'medium',
                    });
                    return false;
                }
            }
            // Check permission-based authorization using RBAC
            if (config.permissions && config.permissions.length > 0) {
                let hasAllPermissions = true;
                for (const permissionStr of config.permissions) {
                    // Parse permission string (format: "resource:action")
                    const [resource, action] = permissionStr.split(':');
                    if (!resource || !action) {
                        continue;
                    }
                    // Check access using RBAC system
                    const accessRequest = {
                        userId: user.id,
                        resource: resource,
                        action: action,
                        context: {
                            ip: request.ip,
                            path: request.path,
                            method: request.method
                        }
                    };
                    const decision = this.rbacSystem.checkAccess(accessRequest);
                    if (!decision.allowed) {
                        hasAllPermissions = false;
                        this.auditLogger.log({
                            userId: user.id,
                            action: 'access',
                            resource: request.path,
                            result: 'denied',
                            ipAddress: request.ip,
                            userAgent: request.userAgent,
                            details: new Map([
                                ['reason', decision.reason || 'Permission denied'],
                                ['requiredPermission', permissionStr],
                                ['method', request.method],
                                ['username', user.username]
                            ]),
                            severity: 'medium',
                        });
                        break;
                    }
                }
                if (!hasAllPermissions) {
                    return false;
                }
            }
            // Authorization successful
            this.auditLogger.log({
                userId: user.id,
                action: 'access',
                resource: request.path,
                result: 'success',
                ipAddress: request.ip,
                userAgent: request.userAgent,
                details: new Map([
                    ['method', request.method],
                    ['username', user.username],
                    ['roles', user.roles.join(', ')]
                ]),
                severity: 'low',
            });
            return true;
        }
        catch (error) {
            this.auditLogger.log({
                userId: context.userId,
                action: 'access',
                resource: request.path,
                result: 'failure',
                ipAddress: request.ip,
                userAgent: request.userAgent,
                details: new Map([
                    ['reason', error instanceof Error ? error.message : 'Unknown error'],
                    ['method', request.method]
                ]),
                severity: 'high',
            });
            return false;
        }
    }
    buildMiddlewareChain(middleware, handler) {
        return middleware.reduceRight((next, mw) => {
            return async (request, context) => {
                return mw(request, context, () => next(request, context));
            };
        }, handler);
    }
    createErrorResponse(statusCode, message, requestId) {
        return {
            statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: {
                    message,
                    code: this.getErrorCodeFromStatus(statusCode),
                    timestamp: new Date().toISOString(),
                    requestId,
                },
            },
        };
    }
    /**
     * Get error code from status code
     */
    getErrorCodeFromStatus(statusCode) {
        const codes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            429: 'RATE_LIMIT_EXCEEDED',
            500: 'INTERNAL_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE',
            504: 'GATEWAY_TIMEOUT',
        };
        return codes[statusCode] || 'UNKNOWN_ERROR';
    }
    defaultRateLimitKey(request) {
        return `${request.ip}:${request.path}`;
    }
    defaultCacheKey(request) {
        return `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
    }
    generateEndpointId(method, path) {
        return `${method}:${path}`;
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.APIGateway = APIGateway;
/**
 * Rate Limiter
 */
class RateLimiter {
    states = new Map();
    /**
     * Check rate limit
     */
    async checkLimit(key, config) {
        const now = Date.now();
        switch (config.strategy) {
            case RateLimitStrategy.FixedWindow:
                return this.checkFixedWindow(key, config, now);
            case RateLimitStrategy.SlidingWindow:
                return this.checkSlidingWindow(key, config, now);
            case RateLimitStrategy.TokenBucket:
                return this.checkTokenBucket(key, config, now);
            case RateLimitStrategy.LeakyBucket:
                return this.checkLeakyBucket(key, config, now);
            default:
                return true;
        }
    }
    /**
     * Get rate limit state
     */
    getState(key) {
        return this.states.get(key);
    }
    /**
     * Reset rate limit
     */
    reset(key) {
        this.states.delete(key);
    }
    checkFixedWindow(key, config, now) {
        let state = this.states.get(key);
        if (!state || now >= state.resetAt.getTime()) {
            state = {
                key,
                count: 0,
                resetAt: new Date(now + config.window),
            };
            this.states.set(key, state);
        }
        if (state.count >= config.limit) {
            return false;
        }
        state.count++;
        return true;
    }
    checkSlidingWindow(key, config, now) {
        // Simplified sliding window using fixed window approximation
        return this.checkFixedWindow(key, config, now);
    }
    checkTokenBucket(key, config, now) {
        let state = this.states.get(key);
        if (!state) {
            state = {
                key,
                count: 0,
                resetAt: new Date(now + config.window),
                tokens: config.limit,
            };
            this.states.set(key, state);
        }
        // Refill tokens
        const elapsed = now - (state.resetAt.getTime() - config.window);
        const refillRate = config.limit / config.window;
        const tokensToAdd = Math.floor(elapsed * refillRate);
        if (tokensToAdd > 0) {
            state.tokens = Math.min((state.tokens || 0) + tokensToAdd, config.limit);
            state.resetAt = new Date(now + config.window);
        }
        if ((state.tokens || 0) < 1) {
            return false;
        }
        state.tokens -= 1;
        state.count++;
        return true;
    }
    checkLeakyBucket(key, config, now) {
        // Simplified leaky bucket using token bucket
        return this.checkTokenBucket(key, config, now);
    }
}
exports.RateLimiter = RateLimiter;
/**
 * API Cache
 */
class APICache {
    cache = new Map();
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (Date.now() > entry.expiresAt.getTime()) {
            this.cache.delete(key);
            return null;
        }
        return entry.response;
    }
    async set(key, response, ttl) {
        this.cache.set(key, {
            response,
            expiresAt: new Date(Date.now() + ttl),
        });
    }
    clear() {
        this.cache.clear();
    }
}
exports.APICache = APICache;
/**
 * Metrics Collector
 */
class MetricsCollector {
    metrics = new Map();
    latencies = new Map();
    record(endpoint, request, response, duration) {
        const key = `${endpoint.method}:${endpoint.path}`;
        let metrics = this.metrics.get(key);
        if (!metrics) {
            metrics = {
                endpoint: endpoint.path,
                method: endpoint.method,
                requestCount: 0,
                errorCount: 0,
                averageLatency: 0,
                p50Latency: 0,
                p95Latency: 0,
                p99Latency: 0,
                statusCodes: {},
                timestamp: new Date(),
            };
            this.metrics.set(key, metrics);
            this.latencies.set(key, []);
        }
        metrics.requestCount++;
        if (response.statusCode >= 400) {
            metrics.errorCount++;
        }
        metrics.statusCodes[response.statusCode] = (metrics.statusCodes[response.statusCode] || 0) + 1;
        // Update latencies
        const latencies = this.latencies.get(key);
        latencies.push(duration);
        // Keep only last 1000 latencies
        if (latencies.length > 1000) {
            latencies.shift();
        }
        // Calculate percentiles
        const sorted = [...latencies].sort((a, b) => a - b);
        metrics.averageLatency = sorted.reduce((sum, l) => sum + l, 0) / sorted.length;
        metrics.p50Latency = sorted[Math.floor(sorted.length * 0.5)];
        metrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
        metrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
    }
    getMetrics(filter) {
        let metrics = Array.from(this.metrics.values());
        if (filter?.endpoint) {
            metrics = metrics.filter(m => m.endpoint === filter.endpoint);
        }
        if (filter?.method) {
            metrics = metrics.filter(m => m.method === filter.method);
        }
        return metrics;
    }
    clear() {
        this.metrics.clear();
        this.latencies.clear();
    }
}
exports.MetricsCollector = MetricsCollector;
/**
 * Quota Manager
 */
class QuotaManager {
    quotas = new Map();
    /**
     * Set quota
     */
    setQuota(userId, limit, period) {
        const quota = {
            userId,
            limit,
            period,
            used: 0,
            resetAt: this.calculateResetTime(period),
        };
        this.quotas.set(userId, quota);
        return quota;
    }
    /**
     * Check quota
     */
    checkQuota(userId) {
        const quota = this.quotas.get(userId);
        if (!quota) {
            return true; // No quota set
        }
        // Reset if period expired
        if (Date.now() >= quota.resetAt.getTime()) {
            quota.used = 0;
            quota.resetAt = this.calculateResetTime(quota.period);
        }
        return quota.used < quota.limit;
    }
    /**
     * Increment usage
     */
    incrementUsage(userId) {
        const quota = this.quotas.get(userId);
        if (quota) {
            quota.used++;
        }
    }
    /**
     * Get quota
     */
    getQuota(userId) {
        return this.quotas.get(userId);
    }
    calculateResetTime(period) {
        const now = new Date();
        switch (period) {
            case 'hour':
                return new Date(now.getTime() + 3600000);
            case 'day':
                return new Date(now.getTime() + 86400000);
            case 'month':
                return new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
    }
}
exports.QuotaManager = QuotaManager;
/**
 * Singleton instances
 */
exports.apiGateway = new APIGateway();
exports.quotaManager = new QuotaManager();
/**
 * Validation Middleware Factory
 */
class ValidationMiddleware {
    /**
     * Create validation middleware from schema
     */
    static create(config) {
        return async (request, context, next) => {
            const errors = RequestValidator.validate(request, config);
            if (errors.length > 0) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        error: 'Validation failed',
                        errors: errors.map(err => ({
                            field: err.field,
                            message: err.message,
                        })),
                    },
                };
            }
            return next();
        };
    }
    /**
     * Create sanitization middleware
     */
    static createSanitizer(config) {
        return async (request, context, next) => {
            // Sanitize all inputs
            request.body = InputSanitizer.sanitizeObject(request.body, config);
            request.query = InputSanitizer.sanitizeObject(request.query, config);
            request.params = InputSanitizer.sanitizeObject(request.params, config);
            return next();
        };
    }
    /**
     * Create rate limiting middleware per endpoint
     */
    static createRateLimiter(config) {
        const rateLimiter = new RateLimiter();
        return async (request, context, next) => {
            const key = config.keyGenerator
                ? config.keyGenerator(request)
                : `${request.ip}:${request.path}`;
            const allowed = await rateLimiter.checkLimit(key, config);
            if (!allowed) {
                const state = rateLimiter.getState(key);
                return {
                    statusCode: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-RateLimit-Limit': config.limit.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': state?.resetAt.toISOString() || '',
                    },
                    body: {
                        error: 'Rate limit exceeded',
                        retryAfter: state?.resetAt,
                    },
                };
            }
            return next();
        };
    }
    /**
     * Create XSS protection middleware
     */
    static createXSSProtection() {
        return async (request, context, next) => {
            // Sanitize to prevent XSS
            request.body = InputSanitizer.sanitizeObject(request.body);
            request.query = InputSanitizer.sanitizeObject(request.query);
            request.params = InputSanitizer.sanitizeObject(request.params);
            const response = await next();
            // Add security headers
            response.headers['X-Content-Type-Options'] = 'nosniff';
            response.headers['X-Frame-Options'] = 'DENY';
            response.headers['X-XSS-Protection'] = '1; mode=block';
            response.headers['Content-Security-Policy'] = "default-src 'self'";
            return response;
        };
    }
    /**
     * Create SQL injection protection middleware
     */
    static createSQLInjectionProtection() {
        return async (request, context, next) => {
            const checkForSQLInjection = (value) => {
                if (typeof value === 'string') {
                    // Common SQL injection patterns
                    const sqlPatterns = [
                        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
                        /(--|\#|\/\*|\*\/)/g,
                        /('|")\s*(OR|AND)\s*('|")\s*=\s*('|")/gi,
                        /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
                    ];
                    return sqlPatterns.some(pattern => pattern.test(value));
                }
                if (typeof value === 'object' && value !== null) {
                    return Object.values(value).some(v => checkForSQLInjection(v));
                }
                return false;
            };
            if (checkForSQLInjection(request.body) ||
                checkForSQLInjection(request.query) ||
                checkForSQLInjection(request.params)) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'Potentially malicious input detected' },
                };
            }
            return next();
        };
    }
    /**
     * Create command injection protection middleware
     */
    static createCommandInjectionProtection() {
        return async (request, context, next) => {
            const sanitizeForCommand = (obj) => {
                if (typeof obj === 'string') {
                    return InputSanitizer.sanitizeCommand(obj);
                }
                if (Array.isArray(obj)) {
                    return obj.map(sanitizeForCommand);
                }
                if (typeof obj === 'object' && obj !== null) {
                    const sanitized = {};
                    for (const key in obj) {
                        sanitized[key] = sanitizeForCommand(obj[key]);
                    }
                    return sanitized;
                }
                return obj;
            };
            request.body = sanitizeForCommand(request.body);
            request.query = sanitizeForCommand(request.query);
            request.params = sanitizeForCommand(request.params);
            return next();
        };
    }
    /**
     * Create path traversal protection middleware
     */
    static createPathTraversalProtection() {
        return async (request, context, next) => {
            const sanitizeForPath = (obj) => {
                if (typeof obj === 'string') {
                    return InputSanitizer.sanitizePath(obj);
                }
                if (Array.isArray(obj)) {
                    return obj.map(sanitizeForPath);
                }
                if (typeof obj === 'object' && obj !== null) {
                    const sanitized = {};
                    for (const key in obj) {
                        sanitized[key] = sanitizeForPath(obj[key]);
                    }
                    return sanitized;
                }
                return obj;
            };
            request.params = sanitizeForPath(request.params);
            request.query = sanitizeForPath(request.query);
            return next();
        };
    }
    /**
     * Create comprehensive security middleware (combines all protections)
     */
    static createSecurityMiddleware(config) {
        const middleware = [
            ValidationMiddleware.createXSSProtection(),
            ValidationMiddleware.createSQLInjectionProtection(),
            ValidationMiddleware.createCommandInjectionProtection(),
            ValidationMiddleware.createPathTraversalProtection(),
        ];
        if (config?.sanitization) {
            middleware.unshift(ValidationMiddleware.createSanitizer(config.sanitization));
        }
        if (config?.rateLimiting) {
            middleware.unshift(ValidationMiddleware.createRateLimiter(config.rateLimiting));
        }
        return middleware;
    }
}
exports.ValidationMiddleware = ValidationMiddleware;
/**
 * Helper functions to create common validation schemas
 */
exports.ValidationSchemas = {
    /**
     * Email validation schema
     */
    email: () => ({
        type: 'string',
        format: 'email',
        minLength: 3,
        maxLength: 255,
    }),
    /**
     * URL validation schema
     */
    url: () => ({
        type: 'string',
        format: 'url',
        maxLength: 2048,
    }),
    /**
     * Phone validation schema
     */
    phone: () => ({
        type: 'string',
        format: 'phone',
        minLength: 10,
        maxLength: 20,
    }),
    /**
     * UUID validation schema
     */
    uuid: () => ({
        type: 'string',
        format: 'uuid',
    }),
    /**
     * Integer with range
     */
    integer: (min, max) => ({
        type: 'number',
        minimum: min,
        maximum: max,
    }),
    /**
     * String with length constraints
     */
    string: (minLength, maxLength, pattern) => ({
        type: 'string',
        minLength,
        maxLength,
        pattern,
    }),
    /**
     * Array with constraints
     */
    array: (items, minLength, maxLength) => ({
        type: 'array',
        items,
        minLength,
        maxLength,
    }),
    /**
     * Object with properties
     */
    object: (properties, required) => ({
        type: 'object',
        properties,
        required,
    }),
    /**
     * Enum validation
     */
    enum: (values) => ({
        type: typeof values[0] === 'string' ? 'string' : 'number',
        enum: values,
    }),
};
