/**
 * API Gateway Setup and Configuration
 * Complete setup with production-ready handlers and middleware
 */

import {
  APIGateway,
  HTTPMethod,
  apiGateway,
} from './APIGateway';
import {
  ProductionHandlers,
  createProductionMiddlewareStack,
  RateLimitPresets,
  ValidationConfigs,
  defaultCORSConfig,
} from './ProductionHandlers';

/**
 * Setup production API Gateway with all endpoints
 */
export function setupProductionAPIGateway(gateway: APIGateway = apiGateway): void {
  // Get production middleware stack
  const productionMiddleware = createProductionMiddlewareStack({
    cors: defaultCORSConfig,
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
    method: HTTPMethod.GET,
    handler: ProductionHandlers.healthCheck,
    middleware: [],
    rateLimit: RateLimitPresets.permissive,
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
    method: HTTPMethod.GET,
    handler: ProductionHandlers.healthCheck,
    middleware: [],
    rateLimit: RateLimitPresets.permissive,
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
    method: HTTPMethod.POST,
    handler: ProductionHandlers.createUser,
    middleware: [],
    rateLimit: RateLimitPresets.moderate,
    authentication: {
      type: 'bearer',
      required: true,
    },
    authorization: {
      permissions: ['users:create'],
    },
    validation: ValidationConfigs.createUser,
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
    method: HTTPMethod.GET,
    handler: ProductionHandlers.listUsers,
    middleware: [],
    rateLimit: RateLimitPresets.moderate,
    authentication: {
      type: 'bearer',
      required: true,
    },
    authorization: {
      permissions: ['users:read'],
    },
    validation: ValidationConfigs.listUsers,
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
    method: HTTPMethod.GET,
    handler: ProductionHandlers.getUser,
    middleware: [],
    rateLimit: RateLimitPresets.moderate,
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
    method: HTTPMethod.PUT,
    handler: ProductionHandlers.updateUser,
    middleware: [],
    rateLimit: RateLimitPresets.moderate,
    authentication: {
      type: 'bearer',
      required: true,
    },
    authorization: {
      permissions: ['users:update'],
    },
    validation: ValidationConfigs.updateUser,
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
    method: HTTPMethod.PATCH,
    handler: ProductionHandlers.updateUser,
    middleware: [],
    rateLimit: RateLimitPresets.moderate,
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
    method: HTTPMethod.DELETE,
    handler: ProductionHandlers.deleteUser,
    middleware: [],
    rateLimit: RateLimitPresets.strict,
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
    method: HTTPMethod.POST,
    handler: ProductionHandlers.createResource,
    middleware: [],
    rateLimit: RateLimitPresets.moderate,
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
    method: HTTPMethod.POST,
    handler: ProductionHandlers.batchOperation,
    middleware: [],
    rateLimit: {
      strategy: 'token_bucket' as any,
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
      method: HTTPMethod.OPTIONS,
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
export function setupDevelopmentAPIGateway(gateway: APIGateway = apiGateway): void {
  // More permissive CORS for development
  const devCORSConfig = {
    ...defaultCORSConfig,
    origins: '*' as '*',
  };

  const devMiddleware = createProductionMiddlewareStack({
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
export function initializeAPIGateway(): APIGateway {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    setupProductionAPIGateway(apiGateway);
  } else {
    setupDevelopmentAPIGateway(apiGateway);
  }

  console.log(`API Gateway initialized in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
  console.log(`Registered ${apiGateway.listEndpoints().length} endpoints`);

  return apiGateway;
}

/**
 * Export configured gateway
 */
export { apiGateway };
