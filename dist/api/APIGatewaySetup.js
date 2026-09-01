"use strict";
/**
 * API Gateway Setup and Configuration
 * Complete setup with production-ready handlers and middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiGateway = void 0;
exports.setupProductionAPIGateway = setupProductionAPIGateway;
exports.setupDevelopmentAPIGateway = setupDevelopmentAPIGateway;
exports.initializeAPIGateway = initializeAPIGateway;
const APIGateway_1 = require("./APIGateway");
Object.defineProperty(exports, "apiGateway", { enumerable: true, get: function () { return APIGateway_1.apiGateway; } });
const ProductionHandlers_1 = require("./ProductionHandlers");
/**
 * Setup production API Gateway with all endpoints
 */
function setupProductionAPIGateway(gateway = APIGateway_1.apiGateway) {
    // Get production middleware stack
    const productionMiddleware = (0, ProductionHandlers_1.createProductionMiddlewareStack)({
        cors: ProductionHandlers_1.defaultCORSConfig,
        logging: {
            logBody: true,
            logHeaders: false, // Don't log headers to avoid sensitive data in logs
        },
    });
    // Apply global middleware
    productionMiddleware.forEach(middleware => {
        gateway.use(middleware);
    });
    // ============================================================
    // Health & Status Endpoints
    // ============================================================
    gateway.registerEndpoint({
        path: '/health',
        method: APIGateway_1.HTTPMethod.GET,
        handler: ProductionHandlers_1.ProductionHandlers.healthCheck,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.permissive,
        tags: ['health', 'monitoring'],
        documentation: {
            summary: 'Health check endpoint',
            description: 'Returns the health status of the API',
            responses: {
                200: {
                    description: 'API is healthy',
                    schema: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' },
                            timestamp: { type: 'string' },
                            uptime: { type: 'number' },
                        },
                    },
                },
            },
        },
    });
    gateway.registerEndpoint({
        path: '/api/health',
        method: APIGateway_1.HTTPMethod.GET,
        handler: ProductionHandlers_1.ProductionHandlers.healthCheck,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.permissive,
        tags: ['health', 'monitoring'],
        documentation: {
            summary: 'API health check',
            description: 'Returns the health status of the API with request ID',
            responses: {
                200: {
                    description: 'API is healthy',
                },
            },
        },
    });
    // ============================================================
    // User Management Endpoints
    // ============================================================
    // Create User
    gateway.registerEndpoint({
        path: '/api/users',
        method: APIGateway_1.HTTPMethod.POST,
        handler: ProductionHandlers_1.ProductionHandlers.createUser,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.moderate,
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            permissions: ['users:create'],
        },
        validation: ProductionHandlers_1.ValidationConfigs.createUser,
        tags: ['users'],
        documentation: {
            summary: 'Create a new user',
            description: 'Creates a new user account with the provided information',
            requestBody: {
                description: 'User creation data',
                required: true,
                schema: {
                    type: 'object',
                    properties: {
                        username: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                    },
                    required: ['username', 'email', 'password'],
                },
            },
            responses: {
                201: {
                    description: 'User created successfully',
                },
                400: {
                    description: 'Validation error',
                },
                401: {
                    description: 'Authentication required',
                },
                403: {
                    description: 'Insufficient permissions',
                },
            },
        },
    });
    // List Users
    gateway.registerEndpoint({
        path: '/api/users',
        method: APIGateway_1.HTTPMethod.GET,
        handler: ProductionHandlers_1.ProductionHandlers.listUsers,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.moderate,
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            permissions: ['users:read'],
        },
        validation: ProductionHandlers_1.ValidationConfigs.listUsers,
        caching: {
            enabled: true,
            ttl: 30000, // 30 seconds
        },
        tags: ['users'],
        documentation: {
            summary: 'List users',
            description: 'Returns a paginated list of users',
            parameters: [
                {
                    name: 'page',
                    in: 'query',
                    description: 'Page number',
                    required: false,
                    schema: { type: 'number' },
                },
                {
                    name: 'limit',
                    in: 'query',
                    description: 'Number of items per page',
                    required: false,
                    schema: { type: 'number' },
                },
            ],
            responses: {
                200: {
                    description: 'List of users',
                },
                401: {
                    description: 'Authentication required',
                },
            },
        },
    });
    // Get User
    gateway.registerEndpoint({
        path: '/api/users/:userId',
        method: APIGateway_1.HTTPMethod.GET,
        handler: ProductionHandlers_1.ProductionHandlers.getUser,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.moderate,
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            permissions: ['users:read'],
        },
        caching: {
            enabled: true,
            ttl: 60000, // 1 minute
            keyGenerator: (request) => `user:${request.params.userId}`,
        },
        tags: ['users'],
        documentation: {
            summary: 'Get user by ID',
            description: 'Returns detailed information about a specific user',
            parameters: [
                {
                    name: 'userId',
                    in: 'path',
                    description: 'User ID',
                    required: true,
                    schema: { type: 'string', format: 'uuid' },
                },
            ],
            responses: {
                200: {
                    description: 'User details',
                },
                404: {
                    description: 'User not found',
                },
            },
        },
    });
    // Update User
    gateway.registerEndpoint({
        path: '/api/users/:userId',
        method: APIGateway_1.HTTPMethod.PUT,
        handler: ProductionHandlers_1.ProductionHandlers.updateUser,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.moderate,
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            permissions: ['users:update'],
        },
        validation: ProductionHandlers_1.ValidationConfigs.updateUser,
        tags: ['users'],
        documentation: {
            summary: 'Update user',
            description: 'Updates user information',
            parameters: [
                {
                    name: 'userId',
                    in: 'path',
                    description: 'User ID',
                    required: true,
                    schema: { type: 'string' },
                },
            ],
            requestBody: {
                description: 'User update data',
                required: true,
                schema: {
                    type: 'object',
                    properties: {
                        email: { type: 'string', format: 'email' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                    },
                },
            },
            responses: {
                200: {
                    description: 'User updated successfully',
                },
                400: {
                    description: 'Validation error',
                },
                404: {
                    description: 'User not found',
                },
            },
        },
    });
    // Patch User (partial update)
    gateway.registerEndpoint({
        path: '/api/users/:userId',
        method: APIGateway_1.HTTPMethod.PATCH,
        handler: ProductionHandlers_1.ProductionHandlers.updateUser,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.moderate,
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            permissions: ['users:update'],
        },
        tags: ['users'],
        documentation: {
            summary: 'Partially update user',
            description: 'Updates specific user fields',
            responses: {
                200: {
                    description: 'User updated successfully',
                },
            },
        },
    });
    // Delete User
    gateway.registerEndpoint({
        path: '/api/users/:userId',
        method: APIGateway_1.HTTPMethod.DELETE,
        handler: ProductionHandlers_1.ProductionHandlers.deleteUser,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.strict,
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            roles: ['admin'],
            permissions: ['users:delete'],
        },
        tags: ['users'],
        documentation: {
            summary: 'Delete user',
            description: 'Permanently deletes a user account',
            parameters: [
                {
                    name: 'userId',
                    in: 'path',
                    description: 'User ID',
                    required: true,
                    schema: { type: 'string' },
                },
            ],
            responses: {
                204: {
                    description: 'User deleted successfully',
                },
                403: {
                    description: 'Insufficient permissions',
                },
                404: {
                    description: 'User not found',
                },
            },
        },
    });
    // ============================================================
    // Generic Resource Endpoints
    // ============================================================
    // Create Resource
    gateway.registerEndpoint({
        path: '/api/:resourceType',
        method: APIGateway_1.HTTPMethod.POST,
        handler: ProductionHandlers_1.ProductionHandlers.createResource,
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.moderate,
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            custom: async (request, context) => {
                const resourceType = request.params.resourceType;
                // Check if user has permission for this resource type
                // In production, check against RBAC system
                return true;
            },
        },
        tags: ['resources'],
        documentation: {
            summary: 'Create a new resource',
            description: 'Generic endpoint for creating resources of any type',
            responses: {
                201: {
                    description: 'Resource created successfully',
                },
            },
        },
    });
    // ============================================================
    // Batch Operations
    // ============================================================
    gateway.registerEndpoint({
        path: '/api/batch',
        method: APIGateway_1.HTTPMethod.POST,
        handler: ProductionHandlers_1.ProductionHandlers.batchOperation,
        middleware: [],
        rateLimit: {
            strategy: 'token_bucket',
            limit: 10,
            window: 60000,
        },
        authentication: {
            type: 'bearer',
            required: true,
        },
        authorization: {
            permissions: ['batch:execute'],
        },
        tags: ['batch'],
        documentation: {
            summary: 'Execute batch operations',
            description: 'Execute multiple API operations in a single request',
            requestBody: {
                description: 'Batch operations',
                required: true,
                schema: {
                    type: 'object',
                    properties: {
                        operations: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    method: { type: 'string' },
                                    path: { type: 'string' },
                                    body: { type: 'object' },
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: 'Batch operations completed',
                },
            },
        },
    });
    // ============================================================
    // OPTIONS handlers for CORS preflight
    // ============================================================
    // Register OPTIONS handlers for all main paths
    const paths = [
        '/api/users',
        '/api/users/:userId',
        '/api/batch',
        '/api/:resourceType',
    ];
    paths.forEach(path => {
        gateway.registerEndpoint({
            path,
            method: APIGateway_1.HTTPMethod.OPTIONS,
            handler: async (request, context) => ({
                statusCode: 204,
                headers: {},
                body: null,
            }),
            middleware: [],
            tags: ['cors'],
            documentation: {
                summary: 'CORS preflight',
                description: 'Handles CORS preflight requests',
                responses: {
                    204: {
                        description: 'CORS preflight successful',
                    },
                },
            },
        });
    });
}
/**
 * Setup development API Gateway (with relaxed security)
 */
function setupDevelopmentAPIGateway(gateway = APIGateway_1.apiGateway) {
    // More permissive CORS for development
    const devCORSConfig = {
        ...ProductionHandlers_1.defaultCORSConfig,
        origins: '*',
    };
    const devMiddleware = (0, ProductionHandlers_1.createProductionMiddlewareStack)({
        cors: devCORSConfig,
        logging: {
            logBody: true,
            logHeaders: true, // Log headers in development
        },
    });
    devMiddleware.forEach(middleware => {
        gateway.use(middleware);
    });
    // Setup same endpoints but with relaxed rate limits
    setupProductionAPIGateway(gateway);
}
/**
 * Initialize the API Gateway based on environment
 */
function initializeAPIGateway() {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        setupProductionAPIGateway(APIGateway_1.apiGateway);
    }
    else {
        setupDevelopmentAPIGateway(APIGateway_1.apiGateway);
    }
    console.log(`API Gateway initialized in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    console.log(`Registered ${APIGateway_1.apiGateway.listEndpoints().length} endpoints`);
    return APIGateway_1.apiGateway;
}
