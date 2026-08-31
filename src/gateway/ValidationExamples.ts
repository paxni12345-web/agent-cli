/**
 * VALIDATION MIDDLEWARE USAGE EXAMPLES
 * Demonstrates how to use the validation middleware in API Gateway
 */

import { z } from 'zod';
import { APIGatewayManager, APIRoute, HttpMethod } from './APIGateway';
import { CommonSchemas, ValidationPresets, ValidationConfig } from './ValidationMiddleware';

// ============================================================================
// Example 1: User Registration with Strict Validation
// ============================================================================

export function createUserRegistrationRoute(gateway: APIGatewayManager): APIRoute {
  const userRegistrationSchema = z.object({
    username: CommonSchemas.username,
    email: CommonSchemas.email,
    password: CommonSchemas.password,
    phoneNumber: CommonSchemas.phone.optional(),
    agreeToTerms: z.boolean().refine(val => val === true, {
      message: 'You must agree to the terms of service',
    }),
  });

  return gateway.registerRoute({
    path: '/api/users/register',
    method: 'POST' as HttpMethod,
    backend: {
      type: 'http',
      url: 'http://localhost:3000/users',
      timeout: 5000,
      retries: 3,
    },
    middleware: [
      {
        name: 'user-registration-validation',
        type: 'validate',
        config: ValidationPresets.strict({
          body: userRegistrationSchema,
        }),
        order: 1,
      },
    ],
    metadata: {
      name: 'User Registration',
      description: 'Register a new user with strict validation',
      version: '1.0.0',
      tags: ['auth', 'users'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Example 2: Product Search with Query Validation
// ============================================================================

export function createProductSearchRoute(gateway: APIGatewayManager): APIRoute {
  const searchQuerySchema = z.object({
    q: CommonSchemas.searchQuery,
    category: z.string().min(1).max(50).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['price', 'name', 'rating', 'date']).optional(),
    sortOrder: CommonSchemas.sortOrder.optional(),
  }).refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'minPrice must be less than or equal to maxPrice',
    }
  );

  return gateway.registerRoute({
    path: '/api/products/search',
    method: 'GET' as HttpMethod,
    backend: {
      type: 'http',
      url: 'http://localhost:3000/products/search',
      timeout: 3000,
    },
    middleware: [
      {
        name: 'product-search-validation',
        type: 'validate',
        config: ValidationPresets.publicAPI({
          query: searchQuerySchema,
        }),
        order: 1,
      },
    ],
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      varyBy: ['query:q', 'query:category', 'query:sortBy'],
    },
    metadata: {
      name: 'Product Search',
      description: 'Search products with filters and pagination',
      version: '1.0.0',
      tags: ['products', 'search'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Example 3: File Upload with Size and Type Validation
// ============================================================================

export function createFileUploadRoute(gateway: APIGatewayManager): APIRoute {
  const fileUploadSchema = z.object({
    fileName: z.string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid file name format'),
    fileType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'application/pdf']),
    fileSize: z.number().int().min(1).max(10 * 1024 * 1024), // Max 10MB
    description: z.string().max(1000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  });

  return gateway.registerRoute({
    path: '/api/files/upload',
    method: 'POST' as HttpMethod,
    backend: {
      type: 'http',
      url: 'http://localhost:3000/files/upload',
      timeout: 30000,
    },
    middleware: [
      {
        name: 'file-upload-validation',
        type: 'validate',
        config: {
          schemas: {
            body: fileUploadSchema,
          },
          security: {
            preventXSS: true,
            preventPathTraversal: true,
            sanitizeHTML: true,
            maxFieldSize: 10 * 1024 * 1024, // 10MB
            maxDepth: 5,
          },
          rateLimit: {
            windowMs: 3600000, // 1 hour
            maxRequests: 50, // 50 uploads per hour
            keyGenerator: (req) => req.metadata.userId || req.ip,
          },
        },
        order: 1,
      },
    ],
    metadata: {
      name: 'File Upload',
      description: 'Upload files with validation and rate limiting',
      version: '1.0.0',
      tags: ['files', 'upload'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Example 4: Admin API with Strict Security
// ============================================================================

export function createAdminUpdateRoute(gateway: APIGatewayManager): APIRoute {
  const adminUpdateSchema = z.object({
    userId: CommonSchemas.uuid,
    role: z.enum(['user', 'moderator', 'admin']),
    permissions: z.array(z.string()).max(50),
    active: z.boolean(),
    notes: z.string().max(500).optional(),
  });

  return gateway.registerRoute({
    path: '/api/admin/users/:userId',
    method: 'PUT' as HttpMethod,
    backend: {
      type: 'http',
      url: 'http://localhost:3000/admin/users',
      timeout: 5000,
    },
    middleware: [
      {
        name: 'admin-auth',
        type: 'auth',
        config: {},
        order: 1,
      },
      {
        name: 'admin-validation',
        type: 'validate',
        config: {
          schemas: {
            body: adminUpdateSchema,
            params: z.object({
              userId: CommonSchemas.uuid,
            }),
          },
          security: {
            preventXSS: true,
            preventSQLInjection: true,
            preventCommandInjection: true,
            preventPathTraversal: true,
            sanitizeHTML: true,
            maxFieldSize: 100 * 1024, // 100KB
            maxDepth: 5,
          },
          rateLimit: {
            windowMs: 60000, // 1 minute
            maxRequests: 30,
            keyGenerator: (req) => req.metadata.apiKey || req.ip,
          },
        },
        order: 2,
      },
    ],
    auth: {
      type: 'api_key',
      required: true,
      scopes: ['admin'],
    },
    metadata: {
      name: 'Admin User Update',
      description: 'Update user with admin privileges',
      version: '1.0.0',
      tags: ['admin', 'users'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Example 5: Public Comment Submission with XSS Protection
// ============================================================================

export function createCommentSubmissionRoute(gateway: APIGatewayManager): APIRoute {
  const commentSchema = z.object({
    postId: CommonSchemas.uuid,
    authorName: z.string().min(2).max(50),
    authorEmail: CommonSchemas.email,
    content: z.string().min(10).max(5000),
    parentCommentId: CommonSchemas.uuid.optional(),
  });

  return gateway.registerRoute({
    path: '/api/comments',
    method: 'POST' as HttpMethod,
    backend: {
      type: 'http',
      url: 'http://localhost:3000/comments',
      timeout: 5000,
    },
    middleware: [
      {
        name: 'comment-validation',
        type: 'validate',
        config: {
          schemas: {
            body: commentSchema,
          },
          security: {
            preventXSS: true,
            preventSQLInjection: true,
            sanitizeHTML: true,
            maxFieldSize: 10 * 1024, // 10KB
            maxDepth: 3,
          },
          rateLimit: {
            windowMs: 300000, // 5 minutes
            maxRequests: 10, // 10 comments per 5 minutes
            keyGenerator: (req) => req.ip,
          },
        },
        order: 1,
      },
    ],
    metadata: {
      name: 'Comment Submission',
      description: 'Submit a comment with XSS protection',
      version: '1.0.0',
      tags: ['comments', 'public'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Example 6: Webhook Endpoint with Custom Validation
// ============================================================================

export function createWebhookRoute(gateway: APIGatewayManager): APIRoute {
  const webhookSchema = z.object({
    event: z.string().min(1).max(100),
    timestamp: CommonSchemas.isoDate,
    data: z.record(z.any()),
    signature: z.string().min(64).max(128),
  });

  const webhookHeaderSchema = z.object({
    'x-webhook-signature': z.string().min(64),
    'x-webhook-id': CommonSchemas.uuid,
  });

  return gateway.registerRoute({
    path: '/api/webhooks/receive',
    method: 'POST' as HttpMethod,
    backend: {
      type: 'http',
      url: 'http://localhost:3000/webhooks/process',
      timeout: 10000,
    },
    middleware: [
      {
        name: 'webhook-validation',
        type: 'validate',
        config: ValidationPresets.strict({
          body: webhookSchema,
          headers: webhookHeaderSchema,
        }),
        order: 1,
      },
    ],
    rateLimit: {
      strategy: 'token_bucket',
      limit: 100,
      window: 60000,
      scope: 'ip',
      burst: 10,
    },
    metadata: {
      name: 'Webhook Receiver',
      description: 'Receive and validate webhook events',
      version: '1.0.0',
      tags: ['webhooks', 'integration'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Example 7: Complex Nested Object Validation
// ============================================================================

export function createOrderCreationRoute(gateway: APIGatewayManager): APIRoute {
  const addressSchema = z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
    country: z.string().length(2),
  });

  const orderItemSchema = z.object({
    productId: CommonSchemas.uuid,
    quantity: z.number().int().min(1).max(100),
    price: z.number().min(0),
    options: z.record(z.string()).optional(),
  });

  const orderSchema = z.object({
    customerId: CommonSchemas.uuid,
    items: z.array(orderItemSchema).min(1).max(50),
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    paymentMethod: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer']),
    notes: z.string().max(1000).optional(),
  });

  return gateway.registerRoute({
    path: '/api/orders',
    method: 'POST' as HttpMethod,
    backend: {
      type: 'http',
      url: 'http://localhost:3000/orders',
      timeout: 10000,
    },
    middleware: [
      {
        name: 'order-validation',
        type: 'validate',
        config: {
          schemas: {
            body: orderSchema,
          },
          security: {
            preventXSS: true,
            preventSQLInjection: true,
            sanitizeHTML: true,
            maxFieldSize: 512 * 1024, // 512KB
            maxDepth: 10,
          },
          rateLimit: {
            windowMs: 60000, // 1 minute
            maxRequests: 20,
            keyGenerator: (req) => req.metadata.userId || req.ip,
          },
        },
        order: 1,
      },
    ],
    auth: {
      type: 'jwt',
      required: true,
      scopes: ['orders:create'],
    },
    metadata: {
      name: 'Order Creation',
      description: 'Create a new order with validation',
      version: '1.0.0',
      tags: ['orders', 'commerce'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Utility: Initialize Gateway with All Example Routes
// ============================================================================

export function initializeGatewayWithExamples(): APIGatewayManager {
  const gateway = new APIGatewayManager({
    port: 8080,
    host: '0.0.0.0',
    enableRateLimiting: true,
    enableCaching: true,
    enableAuth: true,
    enableCompression: true,
    maxRequestSize: 10 * 1024 * 1024,
    timeout: 30000,
  });

  // Register all example routes
  createUserRegistrationRoute(gateway);
  createProductSearchRoute(gateway);
  createFileUploadRoute(gateway);
  createAdminUpdateRoute(gateway);
  createCommentSubmissionRoute(gateway);
  createWebhookRoute(gateway);
  createOrderCreationRoute(gateway);

  return gateway;
}
