"use strict";
/**
 * PHASE 3: ADVANCED API GATEWAY & RATE LIMITING
 * Comprehensive API management, rate limiting, and traffic control
 *
 * Part of 350K lines goal - PHASE 3
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIGatewayManager = void 0;
const events_1 = require("events");
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const zlib = __importStar(require("zlib"));
const url_1 = require("url");
const ValidationMiddleware_1 = require("./ValidationMiddleware");
const ErrorHandling_1 = require("./ErrorHandling");
// ============================================================================
// API Gateway Manager
// ============================================================================
class APIGatewayManager extends events_1.EventEmitter {
    config;
    routes = new Map();
    rateLimitStates = new Map();
    cache = new Map();
    apiKeys = new Map();
    trafficPolicies = new Map();
    circuitBreakers = new Map();
    requests = [];
    responses = [];
    routeMetrics = new Map();
    validationFactory = new ValidationMiddleware_1.ValidationMiddlewareFactory();
    // Enhanced error handling components
    errorLogger = new ErrorHandling_1.ErrorLogger(5000);
    enhancedCircuitBreakers = new Map();
    errorRecoveryManager = new ErrorHandling_1.ErrorRecoveryManager();
    retryConfig = {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 10000,
        backoffMultiplier: 2,
    };
    constructor(config = {}) {
        super();
        this.config = {
            port: 8080,
            host: '0.0.0.0',
            enableRateLimiting: true,
            enableCaching: true,
            enableAuth: true,
            enableCompression: true,
            maxRequestSize: 10 * 1024 * 1024, // 10MB
            timeout: 30000,
            enableLogging: true,
            enableSecurityHeaders: true,
            corsOrigins: ['*'],
            compressionLevel: 6,
            logFormat: 'json',
            ...config,
        };
        // Initialize error recovery strategies
        this.setupErrorRecovery();
        // Setup error logger listeners
        this.setupErrorLogging();
    }
    setupErrorRecovery() {
        this.errorRecoveryManager.registerStrategy(ErrorHandling_1.CacheRecoveryStrategy);
        this.errorRecoveryManager.registerStrategy(ErrorHandling_1.FallbackServiceStrategy);
        this.errorRecoveryManager.registerStrategy(ErrorHandling_1.DefaultResponseStrategy);
    }
    setupErrorLogging() {
        this.errorLogger.on('error:critical', (errorLog) => {
            this.emit('critical_error', {
                errorId: errorLog.id,
                message: errorLog.error.message,
                context: errorLog.context,
                timestamp: errorLog.timestamp,
            });
        });
    }
    // ========================================================================
    // Route Management
    // ========================================================================
    registerRoute(route) {
        const apiRoute = {
            id: this.generateId(),
            ...route,
        };
        this.routes.set(apiRoute.id, apiRoute);
        // Initialize metrics
        this.routeMetrics.set(apiRoute.id, {
            routeId: apiRoute.id,
            requests: 0,
            errors: 0,
            latencies: [],
            statusCodes: new Map(),
        });
        this.emit('route:registered', { routeId: apiRoute.id });
        return apiRoute;
    }
    findRoute(method, path) {
        for (const route of this.routes.values()) {
            if (route.method === method && this.matchPath(route.path, path)) {
                return route;
            }
        }
        return undefined;
    }
    matchPath(routePath, requestPath) {
        // Simple path matching (could be more sophisticated with wildcards)
        const routeSegments = routePath.split('/');
        const requestSegments = requestPath.split('/');
        if (routeSegments.length !== requestSegments.length) {
            return false;
        }
        for (let i = 0; i < routeSegments.length; i++) {
            const routeSeg = routeSegments[i];
            const reqSeg = requestSegments[i];
            // Parameter segment
            if (routeSeg.startsWith(':')) {
                continue;
            }
            // Exact match required
            if (routeSeg !== reqSeg) {
                return false;
            }
        }
        return true;
    }
    extractPathParams(routePath, requestPath) {
        const params = {};
        const routeSegments = routePath.split('/');
        const requestSegments = requestPath.split('/');
        for (let i = 0; i < routeSegments.length; i++) {
            const routeSeg = routeSegments[i];
            if (routeSeg.startsWith(':')) {
                const paramName = routeSeg.substring(1);
                params[paramName] = requestSegments[i];
            }
        }
        return params;
    }
    // ========================================================================
    // Request Processing
    // ========================================================================
    async handleRequest(request) {
        const startTime = Date.now();
        this.requests.push(request);
        // Log incoming request
        this.logRequest(request);
        this.emit('request:received', { requestId: request.id });
        try {
            // 1. Parse and validate request body
            const parseResult = await this.parseRequestBody(request);
            if (!parseResult.success) {
                throw new ErrorHandling_1.ValidationError(parseResult.error || 'Invalid request body', { contentType: request.headers['content-type'] }, request.id);
            }
            // 2. Validate request size
            if (request.rawBody && request.rawBody.length > this.config.maxRequestSize) {
                throw new ErrorHandling_1.PayloadTooLargeError('Request payload exceeds maximum allowed size', this.config.maxRequestSize, request.rawBody.length, request.id);
            }
            // 3. Find matching route
            const route = this.findRoute(request.method, request.path);
            if (!route) {
                throw new ErrorHandling_1.NotFoundError(`Route not found: ${request.method} ${request.path}`, { method: request.method, path: request.path }, request.id);
            }
            // Extract path parameters
            request.params = this.extractPathParams(route.path, request.path);
            // 4. Check enhanced circuit breaker
            const circuitBreaker = this.getOrCreateCircuitBreaker(route.id);
            try {
                return await circuitBreaker.execute(async () => {
                    return await this.processRequest(request, route, startTime);
                });
            }
            catch (error) {
                if (error instanceof ErrorHandling_1.CircuitBreakerOpenError) {
                    // Attempt recovery strategies
                    const recoveryResult = await this.attemptErrorRecovery(error, {
                        request,
                        route,
                        cache: this.cache,
                        cacheKey: this.generateCacheKey(request, route.cache || { enabled: false, ttl: 0 }),
                    });
                    if (recoveryResult.recovered) {
                        return this.createResponse(request.id, 200, recoveryResult.result, startTime, { 'X-Served-From': 'recovery' }, true);
                    }
                }
                throw error;
            }
        }
        catch (error) {
            return await this.handleError(error, request, startTime);
        }
    }
    async processRequest(request, route, startTime) {
        // 5. Apply middleware in order
        for (const middleware of route.middleware.sort((a, b) => a.order - b.order)) {
            const result = await this.applyMiddleware(middleware, request, route);
            if (!result.allowed) {
                throw new ErrorHandling_1.AuthorizationError(result.message || 'Request blocked by middleware', { middleware: middleware.name }, request.id);
            }
        }
        // 6. Authenticate and authorize user
        if (this.config.enableAuth && route.auth) {
            const authResult = await this.applyAuthMiddleware(request, route.auth);
            if (!authResult.allowed) {
                if (authResult.status === 401) {
                    throw new ErrorHandling_1.AuthenticationError(authResult.message || 'Authentication required', undefined, request.id);
                }
                else {
                    throw new ErrorHandling_1.AuthorizationError(authResult.message || 'Insufficient permissions', undefined, request.id);
                }
            }
        }
        // 7. Check rate limit
        if (this.config.enableRateLimiting && route.rateLimit) {
            const rateLimitResult = await this.checkRateLimit(request, route.rateLimit);
            if (!rateLimitResult.allowed) {
                throw new ErrorHandling_1.RateLimitError('Rate limit exceeded. Please try again later.', rateLimitResult.retryAfter || 60, {
                    limit: route.rateLimit.limit,
                    remaining: rateLimitResult.remaining,
                    resetAt: rateLimitResult.resetAt,
                }, request.id);
            }
        }
        // 8. Check cache
        if (this.config.enableCaching && route.cache?.enabled && request.method === 'GET') {
            const cached = this.getCachedResponse(request, route.cache);
            if (cached) {
                const response = this.createResponse(request.id, cached.status, cached.value, startTime, cached.headers, true);
                cached.hits++;
                this.emit('cache:hit', { requestId: request.id });
                this.logResponse(request, response);
                return response;
            }
        }
        // 9. Transform request
        if (route.transform?.request) {
            request = this.transformRequest(request, route.transform.request);
        }
        // 10. Execute business logic - forward to backend with retry
        const backendResponse = await ErrorHandling_1.RetryStrategy.executeWithRetry(() => this.forwardToBackend(request, route.backend), this.retryConfig);
        // 11. Transform response
        let responseBody = backendResponse.body;
        if (route.transform?.response) {
            responseBody = this.transformResponse(responseBody, route.transform.response);
        }
        // 12. Cache response
        if (this.config.enableCaching &&
            route.cache?.enabled &&
            request.method === 'GET' &&
            backendResponse.status === 200) {
            this.cacheResponse(request, route.cache, backendResponse);
        }
        // 13. Add security headers
        const responseHeaders = this.addSecurityHeaders(backendResponse.headers);
        // 14. Compress response if enabled
        let finalBody = responseBody;
        let compressed = false;
        if (this.config.enableCompression && this.shouldCompressResponse(request, responseBody)) {
            const compressionResult = await this.compressResponse(responseBody);
            if (compressionResult.success) {
                finalBody = compressionResult.data;
                responseHeaders['Content-Encoding'] = compressionResult.encoding;
                responseHeaders['Content-Length'] = String(compressionResult.data.length);
                compressed = true;
            }
        }
        const response = this.createResponse(request.id, backendResponse.status, finalBody, startTime, responseHeaders, false, compressed);
        // 15. Update metrics
        this.updateMetrics(route.id, response);
        // 16. Log response
        this.logResponse(request, response);
        return response;
    }
    async handleError(error, request, startTime) {
        // Create error context
        const errorContext = {
            requestId: request.id,
            method: request.method,
            path: request.path,
            ip: request.ip,
            userAgent: request.userAgent,
            userId: request.metadata.userId,
            timestamp: request.timestamp,
            headers: request.headers,
            query: request.query,
        };
        // Log error with full context
        const errorLog = this.errorLogger.log(error, errorContext);
        // Emit error event
        this.emit('request:error', {
            errorId: errorLog.id,
            requestId: request.id,
            error: error.message,
            severity: errorLog.severity,
        });
        // Attempt recovery if not already an API Gateway error
        if (!(error instanceof ErrorHandling_1.APIGatewayError)) {
            const route = this.findRoute(request.method, request.path);
            if (route) {
                const recoveryResult = await this.attemptErrorRecovery(error, {
                    request,
                    route,
                    cache: this.cache,
                    cacheKey: this.generateCacheKey(request, route.cache || { enabled: false, ttl: 0 }),
                });
                if (recoveryResult.recovered) {
                    return this.createResponse(request.id, 200, recoveryResult.result, startTime, { 'X-Served-From': 'recovery', 'X-Recovery-Strategy': recoveryResult.strategy || 'unknown' }, true);
                }
            }
        }
        // Format error response
        const includeStack = process.env.NODE_ENV === 'development';
        const errorResponse = ErrorHandling_1.ErrorResponseFormatter.format(error, request.id, includeStack);
        // Get status code from error
        let statusCode = 500;
        let headers = {};
        if (error instanceof ErrorHandling_1.APIGatewayError) {
            statusCode = error.statusCode;
            // Add rate limit headers if applicable
            if (error instanceof ErrorHandling_1.RateLimitError) {
                headers = {
                    'X-RateLimit-Limit': String(error.context?.limit || 0),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(error.context?.resetAt || new Date().toISOString()),
                    'Retry-After': String(error.retryAfter),
                };
            }
        }
        const response = this.createResponse(request.id, statusCode, errorResponse, startTime, this.addSecurityHeaders(headers));
        this.logResponse(request, response);
        return response;
    }
    getOrCreateCircuitBreaker(routeId) {
        let circuitBreaker = this.enhancedCircuitBreakers.get(routeId);
        if (!circuitBreaker) {
            circuitBreaker = new ErrorHandling_1.EnhancedCircuitBreaker(routeId, {
                failureThreshold: 5,
                successThreshold: 2,
                timeout: 60000,
                halfOpenRequests: 3,
                monitoringPeriod: 10000,
                volumeThreshold: 10,
            });
            // Forward circuit breaker events
            circuitBreaker.on('state:open', (data) => {
                this.emit('circuit_breaker:opened', data);
            });
            circuitBreaker.on('state:closed', (data) => {
                this.emit('circuit_breaker:closed', data);
            });
            circuitBreaker.on('state:half_open', (data) => {
                this.emit('circuit_breaker:half_open', data);
            });
            this.enhancedCircuitBreakers.set(routeId, circuitBreaker);
        }
        return circuitBreaker;
    }
    async attemptErrorRecovery(error, context) {
        try {
            return await this.errorRecoveryManager.attemptRecovery(error, context);
        }
        catch (recoveryError) {
            return { recovered: false };
        }
    }
    // ========================================================================
    // Rate Limiting
    // ========================================================================
    async checkRateLimit(request, config) {
        const key = this.generateRateLimitKey(request, config);
        let state = this.rateLimitStates.get(key);
        const now = new Date();
        if (!state) {
            state = {
                key,
                count: 0,
                resetAt: new Date(now.getTime() + config.window),
                tokens: config.burst || config.limit,
            };
            this.rateLimitStates.set(key, state);
        }
        // Reset if window expired
        if (now >= state.resetAt) {
            state.count = 0;
            state.resetAt = new Date(now.getTime() + config.window);
            state.tokens = config.burst || config.limit;
        }
        // Check limit based on strategy
        let allowed = false;
        switch (config.strategy) {
            case 'fixed_window':
            case 'sliding_window':
                allowed = state.count < config.limit;
                if (allowed)
                    state.count++;
                break;
            case 'token_bucket':
                // Refill tokens
                if (state.lastRefill) {
                    const elapsed = now.getTime() - state.lastRefill.getTime();
                    const refillAmount = Math.floor(elapsed / (config.window / config.limit));
                    state.tokens = Math.min((state.tokens || 0) + refillAmount, config.limit);
                }
                allowed = (state.tokens || 0) > 0;
                if (allowed)
                    state.tokens = (state.tokens || 1) - 1;
                state.lastRefill = now;
                break;
            case 'leaky_bucket':
                // Simplified leaky bucket
                allowed = state.count < config.limit;
                if (allowed)
                    state.count++;
                break;
        }
        const remaining = Math.max(0, config.limit - state.count);
        const retryAfter = allowed ? undefined : Math.ceil((state.resetAt.getTime() - now.getTime()) / 1000);
        this.emit('rate_limit:checked', { key, allowed, remaining });
        return {
            allowed,
            remaining,
            resetAt: state.resetAt,
            retryAfter,
        };
    }
    generateRateLimitKey(request, config) {
        switch (config.scope) {
            case 'user':
                return `user:${request.metadata.userId || 'anonymous'}`;
            case 'ip':
                return `ip:${request.ip}`;
            case 'api_key':
                return `key:${request.metadata.apiKey || 'none'}`;
            case 'custom':
                return config.keyGenerator ? config.keyGenerator(request) : 'global';
            case 'global':
            default:
                return 'global';
        }
    }
    // ========================================================================
    // Caching
    // ========================================================================
    getCachedResponse(request, config) {
        const key = this.generateCacheKey(request, config);
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if expired
        if (new Date() >= entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry;
    }
    cacheResponse(request, config, response) {
        const key = this.generateCacheKey(request, config);
        const now = new Date();
        const entry = {
            key,
            value: response.body,
            headers: response.headers,
            status: response.status,
            createdAt: now,
            expiresAt: new Date(now.getTime() + config.ttl),
            hits: 0,
        };
        this.cache.set(key, entry);
        this.emit('cache:set', { key });
    }
    generateCacheKey(request, config) {
        let key = `${request.method}:${request.path}`;
        if (config.varyBy) {
            for (const field of config.varyBy) {
                if (field.startsWith('header:')) {
                    const header = field.substring(7);
                    key += `:${request.headers[header] || 'none'}`;
                }
                else if (field.startsWith('query:')) {
                    const param = field.substring(6);
                    key += `:${request.query[param] || 'none'}`;
                }
            }
        }
        return key;
    }
    // ========================================================================
    // Middleware
    // ========================================================================
    async applyMiddleware(middleware, request, route) {
        switch (middleware.type) {
            case 'auth':
                return this.applyAuthMiddleware(request, route.auth);
            case 'cors':
                return this.applyCorsMiddleware(request);
            case 'validate':
                return this.applyValidationMiddleware(request, middleware.config);
            default:
                return { allowed: true };
        }
    }
    applyAuthMiddleware(request, auth) {
        if (!auth || !auth.required) {
            return { allowed: true };
        }
        const apiKey = request.headers['x-api-key'] || request.metadata.apiKey;
        if (!apiKey) {
            return { allowed: false, status: 401, message: 'API key required' };
        }
        const key = this.apiKeys.get(apiKey);
        if (!key) {
            return { allowed: false, status: 401, message: 'Invalid API key' };
        }
        // Check expiration
        if (key.expiresAt && new Date() >= key.expiresAt) {
            return { allowed: false, status: 401, message: 'API key expired' };
        }
        // Check scopes
        if (auth.scopes && auth.scopes.length > 0) {
            const hasScope = auth.scopes.some(scope => key.scopes.includes(scope));
            if (!hasScope) {
                return { allowed: false, status: 403, message: 'Insufficient permissions' };
            }
        }
        key.lastUsedAt = new Date();
        return { allowed: true };
    }
    applyCorsMiddleware(request) {
        // Implement proper CORS handling
        const origin = request.headers['origin'];
        if (!origin) {
            // Not a CORS request
            return { allowed: true };
        }
        const allowedOrigins = this.config.corsOrigins || ['*'];
        // Check if origin is allowed
        if (allowedOrigins.includes('*')) {
            return { allowed: true };
        }
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed === origin) {
                return true;
            }
            // Support wildcard domains like *.example.com
            if (allowed.startsWith('*.')) {
                const domain = allowed.substring(2);
                return origin.endsWith(domain);
            }
            return false;
        });
        if (!isAllowed) {
            this.emit('cors:blocked', { requestId: request.id, origin });
            return { allowed: false };
        }
        return { allowed: true };
    }
    async applyValidationMiddleware(request, config) {
        // Use comprehensive validation middleware
        const validationConfig = config;
        // If no validation config provided, use default strict validation
        if (!validationConfig.schemas && !validationConfig.security && !validationConfig.rateLimit) {
            return { allowed: true };
        }
        const validationMiddleware = this.validationFactory.create(validationConfig);
        const result = await validationMiddleware(request);
        // If validation passed and sanitized data is available, update request
        if (result.allowed && result.sanitized) {
            if (result.sanitized.body) {
                request.body = result.sanitized.body;
            }
            if (result.sanitized.query) {
                request.query = result.sanitized.query;
            }
            if (result.sanitized.headers) {
                request.headers = result.sanitized.headers;
            }
        }
        this.emit('validation:completed', {
            requestId: request.id,
            allowed: result.allowed,
            errors: result.errors,
        });
        return {
            allowed: result.allowed,
            status: result.status,
            message: result.message,
        };
    }
    // ========================================================================
    // Backend Communication
    // ========================================================================
    async forwardToBackend(request, backend) {
        const timeout = backend.timeout || this.config.timeout;
        try {
            switch (backend.type) {
                case 'http':
                    return await this.forwardToHTTP(request, backend, timeout);
                case 'service':
                    return await this.forwardToService(request, backend, timeout);
                case 'lambda':
                    return await this.forwardToLambda(request, backend, timeout);
                case 'grpc':
                    return await this.forwardToGRPC(request, backend, timeout);
                default:
                    throw new ErrorHandling_1.BadGatewayError(`Unsupported backend type: ${backend.type}`, { backendType: backend.type }, request.id);
            }
        }
        catch (error) {
            // Wrap backend errors
            if (error instanceof ErrorHandling_1.APIGatewayError) {
                throw error;
            }
            const errorMessage = error.message;
            if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
                throw new ErrorHandling_1.TimeoutError(`Backend request timed out after ${timeout}ms`, { backend: backend.type, timeout }, request.id);
            }
            if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
                throw new ErrorHandling_1.ServiceUnavailableError(`Unable to connect to backend service`, { backend: backend.type, error: errorMessage }, request.id);
            }
            throw new ErrorHandling_1.UpstreamError(`Backend request failed: ${errorMessage}`, backend.type, undefined, request.id);
        }
    }
    async forwardToHTTP(request, backend, timeout) {
        if (!backend.url) {
            throw new ErrorHandling_1.BadGatewayError('Backend URL is required for HTTP backend', { backend: backend.type }, request.id);
        }
        return new Promise((resolve, reject) => {
            const url = new url_1.URL(backend.url);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            // Prepare request options
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: request.path + (Object.keys(request.query).length > 0 ? '?' + new URLSearchParams(request.query).toString() : ''),
                method: request.method,
                headers: {
                    ...request.headers,
                    'Host': url.hostname,
                },
                timeout,
            };
            const req = httpModule.request(options, (res) => {
                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    let body;
                    // Parse response body
                    const contentType = res.headers['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        try {
                            body = JSON.parse(buffer.toString('utf8'));
                        }
                        catch (parseError) {
                            body = buffer.toString('utf8');
                        }
                    }
                    else if (contentType.includes('text/')) {
                        body = buffer.toString('utf8');
                    }
                    else {
                        body = buffer;
                    }
                    const statusCode = res.statusCode || 200;
                    // Check for upstream errors
                    if (statusCode >= 500) {
                        reject(new ErrorHandling_1.UpstreamError(`Upstream service returned error: ${statusCode}`, backend.url, statusCode, request.id));
                        return;
                    }
                    resolve({
                        status: statusCode,
                        body,
                        headers: res.headers,
                    });
                });
            });
            req.on('error', (error) => {
                reject(new ErrorHandling_1.UpstreamError(`Backend request failed: ${error.message}`, backend.url, undefined, request.id));
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new ErrorHandling_1.TimeoutError(`Backend request timeout after ${timeout}ms`, { backend: backend.url, timeout }, request.id));
            });
            // Write request body if present
            if (request.body) {
                try {
                    const bodyData = typeof request.body === 'string'
                        ? request.body
                        : JSON.stringify(request.body);
                    req.write(bodyData);
                }
                catch (error) {
                    reject(new ErrorHandling_1.BadGatewayError(`Failed to serialize request body: ${error.message}`, undefined, request.id));
                    return;
                }
            }
            req.end();
        });
    }
    async forwardToService(request, backend, timeout) {
        // Service discovery and forwarding
        // This would integrate with a service registry (e.g., Consul, Eureka)
        if (!backend.service) {
            throw new ErrorHandling_1.BadGatewayError('Service name is required for service backend', { backend: backend.type }, request.id);
        }
        // For now, simulate service call
        this.emit('backend:service', {
            requestId: request.id,
            service: backend.service,
        });
        // In production, this would resolve service endpoint and forward
        return {
            status: 200,
            body: { message: 'Service response', service: backend.service },
            headers: { 'Content-Type': 'application/json' },
        };
    }
    async forwardToLambda(request, backend, timeout) {
        // AWS Lambda invocation
        if (!backend.function) {
            throw new ErrorHandling_1.BadGatewayError('Function name is required for Lambda backend', { backend: backend.type }, request.id);
        }
        this.emit('backend:lambda', {
            requestId: request.id,
            function: backend.function,
        });
        // In production, this would use AWS SDK to invoke Lambda
        return {
            status: 200,
            body: { message: 'Lambda response', function: backend.function },
            headers: { 'Content-Type': 'application/json' },
        };
    }
    async forwardToGRPC(request, backend, timeout) {
        // gRPC call
        if (!backend.url) {
            throw new ErrorHandling_1.BadGatewayError('Backend URL is required for gRPC backend', { backend: backend.type }, request.id);
        }
        this.emit('backend:grpc', {
            requestId: request.id,
            url: backend.url,
        });
        // In production, this would use @grpc/grpc-js
        return {
            status: 200,
            body: { message: 'gRPC response' },
            headers: { 'Content-Type': 'application/json' },
        };
    }
    // ========================================================================
    // Circuit Breaker
    // ========================================================================
    async isCircuitOpen(routeId) {
        const state = this.circuitBreakers.get(routeId);
        if (!state || state.state === 'closed') {
            return false;
        }
        if (state.state === 'open') {
            if (state.nextAttempt && new Date() >= state.nextAttempt) {
                state.state = 'half_open';
                state.successes = 0;
                return false;
            }
            return true;
        }
        return false;
    }
    recordCircuitBreakerSuccess(routeId) {
        let state = this.circuitBreakers.get(routeId);
        if (!state) {
            state = {
                state: 'closed',
                failures: 0,
                successes: 0,
            };
            this.circuitBreakers.set(routeId, state);
        }
        state.failures = 0;
        state.successes++;
        if (state.state === 'half_open' && state.successes >= 3) {
            state.state = 'closed';
            this.emit('circuit_breaker:closed', { routeId });
        }
    }
    recordCircuitBreakerFailure(routeId) {
        let state = this.circuitBreakers.get(routeId);
        if (!state) {
            state = {
                state: 'closed',
                failures: 0,
                successes: 0,
            };
            this.circuitBreakers.set(routeId, state);
        }
        state.failures++;
        state.lastFailure = new Date();
        if (state.failures >= 5) {
            state.state = 'open';
            state.nextAttempt = new Date(Date.now() + 60000); // 1 minute
            this.emit('circuit_breaker:opened', { routeId });
        }
    }
    // ========================================================================
    // Transformations
    // ========================================================================
    transformRequest(request, transform) {
        if (transform.addHeaders) {
            request.headers = { ...request.headers, ...transform.addHeaders };
        }
        if (transform.removeHeaders) {
            for (const header of transform.removeHeaders) {
                delete request.headers[header];
            }
        }
        return request;
    }
    transformResponse(body, transform) {
        if (transform.filterFields && typeof body === 'object') {
            const filtered = {};
            for (const field of transform.filterFields) {
                if (body[field] !== undefined) {
                    filtered[field] = body[field];
                }
            }
            return filtered;
        }
        return body;
    }
    // ========================================================================
    // API Key Management
    // ========================================================================
    createAPIKey(name, scopes, expiresIn) {
        const key = {
            id: this.generateId(),
            key: this.generateKey(),
            name,
            scopes,
            expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : undefined,
            createdAt: new Date(),
        };
        this.apiKeys.set(key.key, key);
        this.emit('api_key:created', { keyId: key.id });
        return key;
    }
    generateKey() {
        return `ak_${Date.now()}_${Math.random().toString(36).slice(2, 18)}`;
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    async parseRequestBody(request) {
        if (!request.rawBody || request.rawBody.length === 0) {
            return { success: true };
        }
        const contentType = request.headers['content-type'] || '';
        try {
            if (contentType.includes('application/json')) {
                request.body = JSON.parse(request.rawBody.toString('utf8'));
            }
            else if (contentType.includes('application/x-www-form-urlencoded')) {
                const params = new URLSearchParams(request.rawBody.toString('utf8'));
                request.body = Object.fromEntries(params);
            }
            else if (contentType.includes('text/')) {
                request.body = request.rawBody.toString('utf8');
            }
            else {
                // Binary data
                request.body = request.rawBody;
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: 'Failed to parse request body: ' + error.message,
                status: 400,
            };
        }
    }
    addSecurityHeaders(headers) {
        if (!this.config.enableSecurityHeaders) {
            return headers;
        }
        return {
            ...headers,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        };
    }
    shouldCompressResponse(request, body) {
        // Check if client accepts compression
        const acceptEncoding = request.headers['accept-encoding'] || '';
        if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
            return false;
        }
        // Only compress if body is large enough
        const bodySize = typeof body === 'string' ? Buffer.byteLength(body) : JSON.stringify(body).length;
        if (bodySize < 1024) {
            return false;
        }
        // Don't compress binary data
        if (Buffer.isBuffer(body)) {
            return false;
        }
        return true;
    }
    async compressResponse(body) {
        try {
            const data = typeof body === 'string' ? body : JSON.stringify(body);
            const buffer = Buffer.from(data, 'utf8');
            return new Promise((resolve) => {
                zlib.gzip(buffer, { level: this.config.compressionLevel || 6 }, (err, compressed) => {
                    if (err) {
                        resolve({ success: false, data: body });
                    }
                    else {
                        resolve({ success: true, data: compressed, encoding: 'gzip' });
                    }
                });
            });
        }
        catch (error) {
            return { success: false, data: body };
        }
    }
    sanitizeErrorMessage(message) {
        // Use the centralized stack trace sanitizer
        return ErrorHandling_1.StackTraceSanitizer.sanitize(message);
    }
    logRequest(request) {
        if (!this.config.enableLogging) {
            return;
        }
        const logEntry = {
            timestamp: request.timestamp.toISOString(),
            requestId: request.id,
            method: request.method,
            path: request.path,
            ip: request.ip,
            userAgent: request.userAgent,
            headers: this.sanitizeHeaders(request.headers),
            query: request.query,
            userId: request.metadata.userId,
            apiKey: request.metadata.apiKey ? '***' : undefined,
        };
        if (this.config.logFormat === 'json') {
            this.emit('log:request', JSON.stringify(logEntry));
        }
        else {
            this.emit('log:request', `[${logEntry.timestamp}] ${logEntry.method} ${logEntry.path} - ${logEntry.ip}`);
        }
    }
    logResponse(request, response) {
        if (!this.config.enableLogging) {
            return;
        }
        const logEntry = {
            timestamp: response.timestamp.toISOString(),
            requestId: response.requestId,
            method: request.method,
            path: request.path,
            status: response.status,
            duration: response.duration,
            cached: response.cached,
            compressed: response.compressed,
            size: response.size,
        };
        if (this.config.logFormat === 'json') {
            this.emit('log:response', JSON.stringify(logEntry));
        }
        else {
            this.emit('log:response', `[${logEntry.timestamp}] ${request.method} ${request.path} - ${logEntry.status} (${logEntry.duration}ms)`);
        }
    }
    logError(request, error) {
        if (!this.config.enableLogging) {
            return;
        }
        const errorContext = {
            requestId: request.id,
            method: request.method,
            path: request.path,
            ip: request.ip,
            userAgent: request.userAgent,
            userId: request.metadata.userId,
            timestamp: request.timestamp,
        };
        const errorLog = this.errorLogger.log(error, errorContext);
        const logEntry = {
            timestamp: errorLog.timestamp.toISOString(),
            errorId: errorLog.id,
            requestId: request.id,
            method: request.method,
            path: request.path,
            error: error.message,
            severity: errorLog.severity,
            sanitizedStack: errorLog.sanitizedStackTrace.split('\n').slice(0, 5).join('\n'),
        };
        if (this.config.logFormat === 'json') {
            this.emit('log:error', JSON.stringify(logEntry));
        }
        else {
            this.emit('log:error', `[${logEntry.timestamp}] ERROR ${request.method} ${request.path} - ${error.message}`);
        }
    }
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
        for (const key of sensitiveHeaders) {
            if (sanitized[key]) {
                sanitized[key] = '***';
            }
        }
        return sanitized;
    }
    createResponse(requestId, status, body, startTime, headers = {}, cached = false, compressed = false) {
        const response = {
            requestId,
            status,
            headers,
            body,
            cached,
            duration: Date.now() - startTime,
            timestamp: new Date(),
            compressed,
            size: typeof body === 'string' ? Buffer.byteLength(body) : Buffer.isBuffer(body) ? body.length : JSON.stringify(body).length,
        };
        this.responses.push(response);
        return response;
    }
    createErrorResponse(requestId, status, message, startTime, headers = {}) {
        const errorBody = {
            error: {
                code: this.getErrorCode(status),
                message: message,
                status: status,
                timestamp: new Date().toISOString(),
                requestId: requestId,
            },
        };
        // Add security headers to error responses
        const secureHeaders = this.addSecurityHeaders(headers);
        return this.createResponse(requestId, status, errorBody, startTime, secureHeaders);
    }
    getErrorCode(status) {
        const errorCodes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            405: 'METHOD_NOT_ALLOWED',
            408: 'REQUEST_TIMEOUT',
            409: 'CONFLICT',
            413: 'PAYLOAD_TOO_LARGE',
            415: 'UNSUPPORTED_MEDIA_TYPE',
            429: 'RATE_LIMIT_EXCEEDED',
            500: 'INTERNAL_SERVER_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE',
            504: 'GATEWAY_TIMEOUT',
        };
        return errorCodes[status] || 'UNKNOWN_ERROR';
    }
    updateMetrics(routeId, response) {
        const metrics = this.routeMetrics.get(routeId);
        if (metrics) {
            metrics.requests++;
            if (response.status >= 400) {
                metrics.errors++;
            }
            metrics.latencies.push(response.duration);
            const count = metrics.statusCodes.get(response.status) || 0;
            metrics.statusCodes.set(response.status, count + 1);
        }
    }
    generateId() {
        return `gw-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getMetrics() {
        const latencies = this.responses.map(r => r.duration).sort((a, b) => a - b);
        const errors = this.responses.filter(r => r.status >= 400).length;
        const cached = this.responses.filter(r => r.cached).length;
        return {
            totalRequests: this.requests.length,
            successfulRequests: this.responses.filter(r => r.status < 400).length,
            failedRequests: errors,
            averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
            p50Latency: latencies[Math.floor(latencies.length * 0.5)] || 0,
            p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
            p99Latency: latencies[Math.floor(latencies.length * 0.99)] || 0,
            errorRate: this.requests.length > 0 ? (errors / this.requests.length) * 100 : 0,
            throughput: this.requests.length / 60, // Simplified
            cacheHitRate: this.responses.length > 0 ? (cached / this.responses.length) * 100 : 0,
        };
    }
    getStats() {
        return {
            routes: this.routes.size,
            rateLimitStates: this.rateLimitStates.size,
            cacheEntries: this.cache.size,
            apiKeys: this.apiKeys.size,
            trafficPolicies: this.trafficPolicies.size,
            requests: this.requests.length,
            responses: this.responses.length,
            metrics: this.getMetrics(),
            errorStats: this.errorLogger.getStats(),
            circuitBreakers: Array.from(this.enhancedCircuitBreakers.entries()).map(([id, cb]) => ({
                routeId: id,
                ...cb.getMetrics(),
            })),
        };
    }
    // ========================================================================
    // Error Management Methods
    // ========================================================================
    getErrorLogs(filter) {
        return this.errorLogger.getLogs(filter);
    }
    getErrorStats() {
        return this.errorLogger.getStats();
    }
    getCircuitBreakerStatus(routeId) {
        if (routeId) {
            const cb = this.enhancedCircuitBreakers.get(routeId);
            return cb ? cb.getMetrics() : null;
        }
        return Array.from(this.enhancedCircuitBreakers.entries()).map(([id, cb]) => ({
            routeId: id,
            ...cb.getMetrics(),
        }));
    }
    resetCircuitBreaker(routeId) {
        const cb = this.enhancedCircuitBreakers.get(routeId);
        if (cb) {
            cb.reset();
            return true;
        }
        return false;
    }
    forceOpenCircuitBreaker(routeId) {
        const cb = this.enhancedCircuitBreakers.get(routeId);
        if (cb) {
            cb.forceOpen();
            return true;
        }
        return false;
    }
    setRetryConfig(config) {
        this.retryConfig = { ...this.retryConfig, ...config };
    }
    getRetryConfig() {
        return { ...this.retryConfig };
    }
    // ========================================================================
    // CORS Headers Helper
    // ========================================================================
    getCorsHeaders(origin) {
        const headers = {
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Requested-With',
            'Access-Control-Max-Age': '86400',
        };
        if (origin) {
            const allowedOrigins = this.config.corsOrigins || ['*'];
            if (allowedOrigins.includes('*')) {
                headers['Access-Control-Allow-Origin'] = '*';
            }
            else if (allowedOrigins.includes(origin)) {
                headers['Access-Control-Allow-Origin'] = origin;
                headers['Access-Control-Allow-Credentials'] = 'true';
            }
        }
        return headers;
    }
    // ========================================================================
    // Health Check
    // ========================================================================
    async healthCheck() {
        const checks = {
            gateway: true,
            cache: this.cache.size >= 0,
            rateLimiter: this.rateLimitStates.size >= 0,
            routes: this.routes.size > 0,
        };
        const allHealthy = Object.values(checks).every(v => v);
        const someHealthy = Object.values(checks).some(v => v);
        return {
            status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
            checks,
            uptime: process.uptime(),
            timestamp: new Date(),
        };
    }
    // ========================================================================
    // Cleanup & Maintenance
    // ========================================================================
    async cleanup() {
        const now = new Date();
        // Clean expired cache entries
        for (const [key, entry] of this.cache.entries()) {
            if (now >= entry.expiresAt) {
                this.cache.delete(key);
                this.emit('cache:expired', { key });
            }
        }
        // Clean expired rate limit states
        for (const [key, state] of this.rateLimitStates.entries()) {
            if (now >= state.resetAt) {
                this.rateLimitStates.delete(key);
            }
        }
        // Clean old requests/responses (keep last 10000)
        if (this.requests.length > 10000) {
            this.requests = this.requests.slice(-10000);
        }
        if (this.responses.length > 10000) {
            this.responses = this.responses.slice(-10000);
        }
        this.emit('cleanup:completed', {
            cacheSize: this.cache.size,
            rateLimitStates: this.rateLimitStates.size,
            requests: this.requests.length,
            responses: this.responses.length,
            errorLogs: this.errorLogger.getStats().total,
        });
    }
}
exports.APIGatewayManager = APIGatewayManager;
