"use strict";
/**
 * VALIDATION MIDDLEWARE USAGE EXAMPLES
 * Demonstrates how to use the validation middleware in API Gateway
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserRegistrationRoute = createUserRegistrationRoute;
exports.createProductSearchRoute = createProductSearchRoute;
exports.createFileUploadRoute = createFileUploadRoute;
exports.createAdminUpdateRoute = createAdminUpdateRoute;
exports.createCommentSubmissionRoute = createCommentSubmissionRoute;
exports.createWebhookRoute = createWebhookRoute;
exports.createOrderCreationRoute = createOrderCreationRoute;
exports.initializeGatewayWithExamples = initializeGatewayWithExamples;
const zod_1 = require("zod");
const APIGateway_1 = require("./APIGateway");
const ValidationMiddleware_1 = require("./ValidationMiddleware");
// ============================================================================
// Example 1: User Registration with Strict Validation
// ============================================================================
function createUserRegistrationRoute(gateway) {
    const userRegistrationSchema = zod_1.z.object({
        username: ValidationMiddleware_1.CommonSchemas.username,
        email: ValidationMiddleware_1.CommonSchemas.email,
        password: ValidationMiddleware_1.CommonSchemas.password,
        phoneNumber: ValidationMiddleware_1.CommonSchemas.phone.optional(),
        agreeToTerms: zod_1.z.boolean().refine(val => val === true, {
            message: 'You must agree to the terms of service',
        }),
    });
    return gateway.registerRoute({
        path: '/api/users/register',
        method: 'POST',
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
                config: ValidationMiddleware_1.ValidationPresets.strict({
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
function createProductSearchRoute(gateway) {
    const searchQuerySchema = zod_1.z.object({
        q: ValidationMiddleware_1.CommonSchemas.searchQuery,
        category: zod_1.z.string().min(1).max(50).optional(),
        minPrice: zod_1.z.coerce.number().min(0).optional(),
        maxPrice: zod_1.z.coerce.number().min(0).optional(),
        page: zod_1.z.coerce.number().int().min(1).default(1),
        limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
        sortBy: zod_1.z.enum(['price', 'name', 'rating', 'date']).optional(),
        sortOrder: ValidationMiddleware_1.CommonSchemas.sortOrder.optional(),
    }).refine((data) => {
        if (data.minPrice !== undefined && data.maxPrice !== undefined) {
            return data.minPrice <= data.maxPrice;
        }
        return true;
    }, {
        message: 'minPrice must be less than or equal to maxPrice',
    });
    return gateway.registerRoute({
        path: '/api/products/search',
        method: 'GET',
        backend: {
            type: 'http',
            url: 'http://localhost:3000/products/search',
            timeout: 3000,
        },
        middleware: [
            {
                name: 'product-search-validation',
                type: 'validate',
                config: ValidationMiddleware_1.ValidationPresets.publicAPI({
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
function createFileUploadRoute(gateway) {
    const fileUploadSchema = zod_1.z.object({
        fileName: zod_1.z.string()
            .min(1)
            .max(255)
            .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid file name format'),
        fileType: zod_1.z.enum(['image/jpeg', 'image/png', 'image/gif', 'application/pdf']),
        fileSize: zod_1.z.number().int().min(1).max(10 * 1024 * 1024), // Max 10MB
        description: zod_1.z.string().max(1000).optional(),
        tags: zod_1.z.array(zod_1.z.string().max(50)).max(10).optional(),
    });
    return gateway.registerRoute({
        path: '/api/files/upload',
        method: 'POST',
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
function createAdminUpdateRoute(gateway) {
    const adminUpdateSchema = zod_1.z.object({
        userId: ValidationMiddleware_1.CommonSchemas.uuid,
        role: zod_1.z.enum(['user', 'moderator', 'admin']),
        permissions: zod_1.z.array(zod_1.z.string()).max(50),
        active: zod_1.z.boolean(),
        notes: zod_1.z.string().max(500).optional(),
    });
    return gateway.registerRoute({
        path: '/api/admin/users/:userId',
        method: 'PUT',
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
                        params: zod_1.z.object({
                            userId: ValidationMiddleware_1.CommonSchemas.uuid,
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
function createCommentSubmissionRoute(gateway) {
    const commentSchema = zod_1.z.object({
        postId: ValidationMiddleware_1.CommonSchemas.uuid,
        authorName: zod_1.z.string().min(2).max(50),
        authorEmail: ValidationMiddleware_1.CommonSchemas.email,
        content: zod_1.z.string().min(10).max(5000),
        parentCommentId: ValidationMiddleware_1.CommonSchemas.uuid.optional(),
    });
    return gateway.registerRoute({
        path: '/api/comments',
        method: 'POST',
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
function createWebhookRoute(gateway) {
    const webhookSchema = zod_1.z.object({
        event: zod_1.z.string().min(1).max(100),
        timestamp: ValidationMiddleware_1.CommonSchemas.isoDate,
        data: zod_1.z.record(zod_1.z.any()),
        signature: zod_1.z.string().min(64).max(128),
    });
    const webhookHeaderSchema = zod_1.z.object({
        'x-webhook-signature': zod_1.z.string().min(64),
        'x-webhook-id': ValidationMiddleware_1.CommonSchemas.uuid,
    });
    return gateway.registerRoute({
        path: '/api/webhooks/receive',
        method: 'POST',
        backend: {
            type: 'http',
            url: 'http://localhost:3000/webhooks/process',
            timeout: 10000,
        },
        middleware: [
            {
                name: 'webhook-validation',
                type: 'validate',
                config: ValidationMiddleware_1.ValidationPresets.strict({
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
function createOrderCreationRoute(gateway) {
    const addressSchema = zod_1.z.object({
        street: zod_1.z.string().min(1).max(200),
        city: zod_1.z.string().min(1).max(100),
        state: zod_1.z.string().length(2),
        zipCode: zod_1.z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
        country: zod_1.z.string().length(2),
    });
    const orderItemSchema = zod_1.z.object({
        productId: ValidationMiddleware_1.CommonSchemas.uuid,
        quantity: zod_1.z.number().int().min(1).max(100),
        price: zod_1.z.number().min(0),
        options: zod_1.z.record(zod_1.z.string()).optional(),
    });
    const orderSchema = zod_1.z.object({
        customerId: ValidationMiddleware_1.CommonSchemas.uuid,
        items: zod_1.z.array(orderItemSchema).min(1).max(50),
        shippingAddress: addressSchema,
        billingAddress: addressSchema,
        paymentMethod: zod_1.z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer']),
        notes: zod_1.z.string().max(1000).optional(),
    });
    return gateway.registerRoute({
        path: '/api/orders',
        method: 'POST',
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
function initializeGatewayWithExamples() {
    const gateway = new APIGateway_1.APIGatewayManager({
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
