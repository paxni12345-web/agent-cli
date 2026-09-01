"use strict";
/**
 * Production-Ready API Gateway Usage Examples
 *
 * This file demonstrates how to use the enhanced APIGateway with:
 * - Request validation and sanitization
 * - Authentication and authorization
 * - Rate limiting
 * - Response compression
 * - CORS support
 * - Security headers
 * - Request/response logging
 * - Caching
 * - Error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.example1_BasicSetup = example1_BasicSetup;
exports.example2_RESTfulAPI = example2_RESTfulAPI;
exports.example3_AdvancedAPI = example3_AdvancedAPI;
exports.example4_FileUpload = example4_FileUpload;
exports.example5_Proxy = example5_Proxy;
exports.example6_Monitoring = example6_Monitoring;
exports.example7_ProductionSetup = example7_ProductionSetup;
const APIGateway_1 = require("./APIGateway");
const zod_1 = require("zod");
// ============================================================================
// Example 1: Simple API Gateway Setup
// ============================================================================
async function example1_BasicSetup() {
    const gateway = new APIGateway_1.APIGateway({
        port: 3000,
        host: '0.0.0.0',
        enableSSL: false,
        enableCaching: true,
        enableRateLimiting: true,
        enableCompression: true,
        enableCORS: true,
        enableSecurityHeaders: true,
        enableRequestLogging: true,
        corsOrigins: ['http://localhost:3000', 'https://example.com'],
        compressionThreshold: 1024, // Compress responses > 1KB
        maxRequestSize: 5 * 1024 * 1024, // 5MB
    });
    // Simple route
    gateway.registerRoute({
        path: '/health',
        method: 'GET',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        status: 'healthy',
                        timestamp: Date.now(),
                        uptime: process.uptime(),
                    },
                };
            },
        },
        middleware: [],
    });
    await gateway.start();
    console.log('Gateway started on port 3000');
}
// ============================================================================
// Example 2: RESTful API with Validation
// ============================================================================
async function example2_RESTfulAPI() {
    const gateway = new APIGateway_1.APIGateway({
        port: 3000,
        enableCompression: true,
        enableCORS: true,
        enableSecurityHeaders: true,
        enableRequestLogging: true,
    });
    // Define schemas
    const userCreateSchema = zod_1.z.object({
        username: APIGateway_1.CommonSchemas.username,
        email: APIGateway_1.CommonSchemas.email,
        password: APIGateway_1.CommonSchemas.password,
        firstName: zod_1.z.string().min(1).max(50),
        lastName: zod_1.z.string().min(1).max(50),
    });
    const userUpdateSchema = zod_1.z.object({
        firstName: zod_1.z.string().min(1).max(50).optional(),
        lastName: zod_1.z.string().min(1).max(50).optional(),
        email: APIGateway_1.CommonSchemas.email.optional(),
    });
    const userQuerySchema = zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
        search: zod_1.z.string().max(100).optional(),
    });
    // Mock user service
    const userService = {
        list: async (query) => [
            { id: '1', username: 'john_doe', email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
            { id: '2', username: 'jane_doe', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' },
        ],
        get: async (id) => ({ id, username: 'john_doe', email: 'john@example.com', firstName: 'John', lastName: 'Doe' }),
        create: async (data) => ({ id: '3', ...data }),
        update: async (id, data) => ({ id, ...data }),
        delete: async (id) => { },
    };
    // Authentication config
    const authConfig = {
        type: 'bearer',
        required: true,
        validator: async (token) => {
            // Implement JWT validation here
            return token === 'valid-token-123';
        },
    };
    // Create RESTful routes
    const userRoutes = APIGateway_1.APIHandlerFactory.createRESTHandlers({
        resource: 'users',
        schema: {
            create: userCreateSchema,
            update: userUpdateSchema,
            query: userQuerySchema,
        },
        service: userService,
        auth: authConfig,
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.perUser(100, 60000),
    });
    // Register routes
    userRoutes.forEach(route => gateway.registerRoute(route));
    await gateway.start();
}
// ============================================================================
// Example 3: Advanced API with Custom Middleware
// ============================================================================
async function example3_AdvancedAPI() {
    const gateway = new APIGateway_1.APIGateway({
        port: 3000,
        enableCompression: true,
        enableCORS: true,
        enableSecurityHeaders: true,
        enableRequestLogging: true,
    });
    // Custom authentication
    const authConfig = {
        type: 'jwt',
        required: true,
        validator: async (token) => {
            try {
                // Implement JWT verification
                // const decoded = jwt.verify(token, process.env.JWT_SECRET);
                return true;
            }
            catch {
                return false;
            }
        },
        scopes: ['read:data', 'write:data'],
    };
    // Create API endpoint with full features
    gateway.registerRoute({
        path: '/api/data',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                // Process request
                const data = req.body;
                // Simulate processing
                const result = {
                    id: Math.random().toString(36).substr(2, 9),
                    data: data,
                    processedAt: Date.now(),
                    processedBy: req.metadata.userId || 'anonymous',
                };
                return {
                    status: 201,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Resource-ID': result.id,
                    },
                    body: {
                        success: true,
                        data: result,
                    },
                };
            },
        },
        middleware: [
            APIGateway_1.MiddlewareFactory.requestId(),
            APIGateway_1.MiddlewareFactory.responseTime(),
            APIGateway_1.MiddlewareFactory.userContext(),
            APIGateway_1.MiddlewareFactory.errorHandler(),
            APIGateway_1.MiddlewareFactory.sizeLimit(1024 * 1024), // 1MB
            APIGateway_1.MiddlewareFactory.timeout(5000), // 5 seconds
        ],
        validation: APIGateway_1.ValidationHelpers.createSecureValidation(zod_1.z.object({
            name: zod_1.z.string().min(1).max(100),
            value: zod_1.z.number().min(0).max(1000000),
            tags: zod_1.z.array(zod_1.z.string()).max(10).optional(),
            metadata: zod_1.z.record(zod_1.z.string()).optional(),
        })),
        auth: authConfig,
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.perEndpoint('api-data', 50, 60000),
        timeout: 10000,
    });
    await gateway.start();
}
// ============================================================================
// Example 4: File Upload API
// ============================================================================
async function example4_FileUpload() {
    const gateway = new APIGateway_1.APIGateway({
        port: 3000,
        maxRequestSize: 50 * 1024 * 1024, // 50MB for file uploads
        enableCompression: false, // Don't compress file uploads
        enableRequestLogging: true,
    });
    gateway.registerRoute({
        path: '/api/upload',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                const { filename, contentType, data } = req.body;
                // Validate file
                const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
                if (!allowedTypes.includes(contentType)) {
                    return {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: {
                            success: false,
                            error: 'Invalid file type',
                            allowedTypes,
                        },
                    };
                }
                // Process file (save to storage, etc.)
                const fileId = Math.random().toString(36).substr(2, 9);
                return {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        data: {
                            fileId,
                            filename,
                            contentType,
                            size: data.length,
                            uploadedAt: Date.now(),
                        },
                    },
                };
            },
        },
        middleware: [
            APIGateway_1.MiddlewareFactory.requestId(),
            APIGateway_1.MiddlewareFactory.sizeLimit(50 * 1024 * 1024),
        ],
        validation: {
            schema: zod_1.z.object({
                filename: zod_1.z.string().min(1).max(255),
                contentType: zod_1.z.string(),
                data: zod_1.z.string(), // Base64 encoded
            }),
            sanitize: true,
            preventPathTraversal: true,
        },
        rateLimit: {
            windowMs: 60000,
            maxRequests: 10,
            strategy: 'sliding_window',
        },
    });
    await gateway.start();
}
// ============================================================================
// Example 5: Proxying to Upstream Services
// ============================================================================
async function example5_Proxy() {
    const gateway = new APIGateway_1.APIGateway({
        port: 3000,
        enableLoadBalancing: true,
        enableCircuitBreaker: true,
        enableCaching: true,
    });
    gateway.registerRoute({
        path: '/api/external/:path*',
        method: 'GET',
        target: {
            type: 'upstream',
            upstream: {
                servers: [
                    {
                        id: 'server-1',
                        url: 'https://api.example.com',
                        weight: 2,
                        priority: 1,
                        maxConnections: 100,
                        currentConnections: 0,
                        healthy: true,
                    },
                    {
                        id: 'server-2',
                        url: 'https://api2.example.com',
                        weight: 1,
                        priority: 2,
                        maxConnections: 100,
                        currentConnections: 0,
                        healthy: true,
                    },
                ],
                loadBalancing: 'weighted_round_robin',
                healthCheck: {
                    interval: 30000,
                    timeout: 5000,
                    unhealthyThreshold: 3,
                    healthyThreshold: 2,
                    path: '/health',
                    method: 'GET',
                    expectedStatus: [200, 204],
                },
                circuitBreaker: {
                    threshold: 5,
                    timeout: 60000,
                    monitoringPeriod: 10000,
                    fallbackResponse: {
                        error: 'Service temporarily unavailable',
                    },
                },
            },
        },
        middleware: [APIGateway_1.MiddlewareFactory.requestId()],
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.moderate(),
        cache: {
            ttl: 300000, // 5 minutes
            maxSize: 50 * 1024 * 1024,
            storage: 'memory',
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
}
// ============================================================================
// Example 6: Monitoring and Metrics
// ============================================================================
async function example6_Monitoring() {
    const gateway = new APIGateway_1.APIGateway({
        port: 3000,
        enableRequestLogging: true,
    });
    // Metrics endpoint
    gateway.registerRoute({
        path: '/metrics',
        method: 'GET',
        target: {
            type: 'function',
            handler: async (req) => {
                const metrics = gateway.getMetrics();
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: metrics,
                };
            },
        },
        middleware: [],
    });
    // Request logs endpoint
    gateway.registerRoute({
        path: '/logs',
        method: 'GET',
        target: {
            type: 'function',
            handler: async (req) => {
                const logs = gateway.getRequestLogs({
                    limit: parseInt(req.query.limit || '100'),
                    status: req.query.status ? parseInt(req.query.status) : undefined,
                    method: req.query.method,
                    since: req.query.since ? parseInt(req.query.since) : undefined,
                });
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        total: logs.length,
                        logs,
                    },
                };
            },
        },
        middleware: [],
    });
    // Listen to events
    gateway.on('request:received', (data) => {
        console.log('Request received:', data.request.id);
    });
    gateway.on('request:completed', (data) => {
        console.log('Request completed:', data.request.id, 'in', data.latency, 'ms');
    });
    gateway.on('request:error', (data) => {
        console.error('Request error:', data.request.id, data.error);
    });
    gateway.on('rate_limit:exceeded', (data) => {
        console.warn('Rate limit exceeded:', data.key);
    });
    gateway.on('circuit_breaker:opened', (data) => {
        console.error('Circuit breaker opened:', data.serverId);
    });
    gateway.on('log', (data) => {
        // Send to external logging service
        console.log(data.message);
    });
    await gateway.start();
}
// ============================================================================
// Example 7: Complete Production Setup
// ============================================================================
async function example7_ProductionSetup() {
    const gateway = new APIGateway_1.APIGateway({
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
        enableSSL: process.env.ENABLE_SSL === 'true',
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
        corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
        compressionThreshold: 1024,
    });
    // Global middleware
    const globalMiddleware = [
        APIGateway_1.MiddlewareFactory.requestId(),
        APIGateway_1.MiddlewareFactory.responseTime(),
        APIGateway_1.MiddlewareFactory.userContext(),
        APIGateway_1.MiddlewareFactory.errorHandler(),
    ];
    // API key validation
    const apiKeys = new Set(process.env.API_KEYS?.split(',') || []);
    // Health check
    gateway.registerRoute({
        path: '/health',
        method: 'GET',
        target: {
            type: 'function',
            handler: async () => ({
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { status: 'healthy', timestamp: Date.now() },
            }),
        },
        middleware: [],
    });
    // Metrics (protected)
    gateway.registerRoute({
        path: '/metrics',
        method: 'GET',
        target: {
            type: 'function',
            handler: async () => ({
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: gateway.getMetrics(),
            }),
        },
        middleware: [APIGateway_1.MiddlewareFactory.apiKey(apiKeys)],
    });
    // Register your API routes here
    // ...
    // Start server
    await gateway.start();
    console.log(`Production gateway started on port ${gateway['config'].port}`);
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, shutting down gracefully');
        await gateway.stop();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        console.log('SIGINT received, shutting down gracefully');
        await gateway.stop();
        process.exit(0);
    });
}
// ============================================================================
// Run Examples
// ============================================================================
if (require.main === module) {
    // Uncomment the example you want to run
    // example1_BasicSetup();
    // example2_RESTfulAPI();
    // example3_AdvancedAPI();
    // example4_FileUpload();
    // example5_Proxy();
    // example6_Monitoring();
    // example7_ProductionSetup();
}
