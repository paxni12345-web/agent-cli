"use strict";
/**
 * API Gateway Validation Examples
 * Demonstrates comprehensive request validation usage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserRegistrationRoute = createUserRegistrationRoute;
exports.createFileUploadRoute = createFileUploadRoute;
exports.createSearchRoute = createSearchRoute;
exports.createAdminCommandRoute = createAdminCommandRoute;
exports.createBlogPostRoute = createBlogPostRoute;
exports.createCustomValidationRoute = createCustomValidationRoute;
exports.createMultiStepValidationRoute = createMultiStepValidationRoute;
exports.createUserProfileRoute = createUserProfileRoute;
exports.setupAPIGatewayWithValidation = setupAPIGatewayWithValidation;
exports.standaloneValidationExamples = standaloneValidationExamples;
const zod_1 = require("zod");
const APIGateway_1 = require("./APIGateway");
// ============================================================================
// Example 1: User Registration Endpoint with Full Validation
// ============================================================================
const userRegistrationSchema = zod_1.z.object({
    email: APIGateway_1.CommonSchemas.email,
    username: APIGateway_1.CommonSchemas.username,
    password: APIGateway_1.CommonSchemas.password,
    age: zod_1.z.number().int().min(13).max(120),
    phone: APIGateway_1.CommonSchemas.phone.optional(),
    website: APIGateway_1.CommonSchemas.url.optional(),
    bio: APIGateway_1.ValidationHelpers.patterns.safeText(500, false),
});
function createUserRegistrationRoute() {
    return {
        path: '/api/users/register',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        user: req.body,
                    },
                };
            },
        },
        middleware: [],
        validation: APIGateway_1.ValidationHelpers.createSecureValidation(userRegistrationSchema),
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.strict(),
    };
}
// ============================================================================
// Example 2: File Upload Endpoint with Path Traversal Prevention
// ============================================================================
const fileUploadSchema = zod_1.z.object({
    filename: zod_1.z.string()
        .min(1)
        .max(255)
        .regex(/^[a-zA-Z0-9_\-\.]+$/),
    path: zod_1.z.string()
        .max(1000)
        .regex(/^[a-zA-Z0-9_\-\/\.]+$/),
    content: zod_1.z.string().max(10 * 1024 * 1024), // 10MB
    mimeType: zod_1.z.string().max(100),
});
function createFileUploadRoute() {
    return {
        path: '/api/files/upload',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        filename: req.body.filename,
                    },
                };
            },
        },
        middleware: [],
        validation: APIGateway_1.ValidationHelpers.createFileValidation(fileUploadSchema),
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.moderate(),
    };
}
// ============================================================================
// Example 3: Search Endpoint with SQL Injection Prevention
// ============================================================================
const searchQuerySchema = zod_1.z.object({
    query: zod_1.z.string()
        .min(1)
        .max(200)
        .regex(/^[a-zA-Z0-9\s\-_]+$/),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
    offset: zod_1.z.number().int().min(0).max(10000).default(0),
    sortBy: zod_1.z.enum(['relevance', 'date', 'title', 'author']).default('relevance'),
    order: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
function createSearchRoute() {
    return {
        path: '/api/search',
        method: 'GET',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        results: [],
                        query: req.query,
                    },
                };
            },
        },
        middleware: [],
        validation: {
            schema: searchQuerySchema,
            sanitize: true,
            preventSQLInjection: true,
            preventXSS: true,
        },
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.lenient(),
    };
}
// ============================================================================
// Example 4: Admin Command Endpoint with Command Injection Prevention
// ============================================================================
const adminCommandSchema = zod_1.z.object({
    action: zod_1.z.enum(['restart', 'status', 'config', 'logs']),
    service: zod_1.z.string()
        .min(1)
        .max(50)
        .regex(/^[a-z0-9\-]+$/),
    parameters: zod_1.z.record(zod_1.z.string()).optional(),
});
function createAdminCommandRoute() {
    return {
        path: '/api/admin/command',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        action: req.body.action,
                    },
                };
            },
        },
        middleware: [],
        validation: {
            schema: adminCommandSchema,
            sanitize: true,
            preventCommandInjection: true,
            preventPathTraversal: true,
        },
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.perEndpoint('admin-command', 5, 60000),
        auth: {
            type: 'bearer',
            validator: async (token) => token === 'admin-token',
            required: true,
        },
    };
}
// ============================================================================
// Example 5: Blog Post Creation with XSS Prevention
// ============================================================================
const blogPostSchema = zod_1.z.object({
    title: APIGateway_1.ValidationHelpers.patterns.safeText(200, true),
    content: APIGateway_1.ValidationHelpers.patterns.safeText(50000, true),
    excerpt: APIGateway_1.ValidationHelpers.patterns.safeText(500, false),
    tags: APIGateway_1.ValidationHelpers.patterns.array(zod_1.z.string().min(1).max(30).regex(/^[a-z0-9\-]+$/), 0, 10, false),
    category: zod_1.z.enum(['tech', 'lifestyle', 'business', 'health', 'entertainment']),
    status: zod_1.z.enum(['draft', 'published', 'archived']).default('draft'),
    publishDate: APIGateway_1.CommonSchemas.dateISO.optional(),
});
function createBlogPostRoute() {
    return {
        path: '/api/posts',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        post: req.body,
                    },
                };
            },
        },
        middleware: [],
        validation: {
            schema: blogPostSchema,
            sanitize: true,
            preventXSS: true,
        },
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.perUser(10, 60000),
    };
}
// ============================================================================
// Example 6: Custom Validation Rules
// ============================================================================
const customValidationSchema = zod_1.z.object({
    email: APIGateway_1.CommonSchemas.email,
    age: zod_1.z.number().int().min(0).max(150),
    referralCode: zod_1.z.string().length(8).regex(/^[A-Z0-9]+$/),
});
function createCustomValidationRoute() {
    return {
        path: '/api/users/signup',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: { success: true },
                };
            },
        },
        middleware: [],
        validation: {
            schema: customValidationSchema,
            sanitize: true,
            preventXSS: true,
            customValidators: [
                {
                    field: 'body.email',
                    validator: async (email) => {
                        // Custom: check if email domain is allowed
                        const allowedDomains = ['example.com', 'test.com'];
                        const domain = email.split('@')[1];
                        return allowedDomains.includes(domain);
                    },
                    message: 'Email domain not allowed',
                },
                {
                    field: 'body.age',
                    validator: (age) => {
                        // Custom: must be 18 or older
                        return age >= 18;
                    },
                    message: 'Must be 18 years or older',
                },
            ],
        },
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.moderate(),
    };
}
// ============================================================================
// Example 7: Multi-step Validation Middleware
// ============================================================================
function createMultiStepValidationRoute() {
    const schema = zod_1.z.object({
        step: zod_1.z.enum(['personal', 'address', 'payment']),
        data: zod_1.z.record(zod_1.z.any()),
    });
    return {
        path: '/api/checkout/:step',
        method: 'POST',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        nextStep: req.body.step === 'personal' ? 'address' : 'payment',
                    },
                };
            },
        },
        middleware: [
            // Step-specific validation
            async (req, res, next) => {
                const step = req.params.step;
                let stepSchema;
                switch (step) {
                    case 'personal':
                        stepSchema = zod_1.z.object({
                            firstName: APIGateway_1.ValidationHelpers.patterns.safeText(50),
                            lastName: APIGateway_1.ValidationHelpers.patterns.safeText(50),
                            email: APIGateway_1.CommonSchemas.email,
                        });
                        break;
                    case 'address':
                        stepSchema = zod_1.z.object({
                            street: APIGateway_1.ValidationHelpers.patterns.safeText(100),
                            city: APIGateway_1.ValidationHelpers.patterns.safeText(50),
                            zipCode: APIGateway_1.CommonSchemas.zipCode,
                        });
                        break;
                    case 'payment':
                        stepSchema = zod_1.z.object({
                            cardNumber: APIGateway_1.CommonSchemas.creditCard,
                            cvv: zod_1.z.string().regex(/^\d{3,4}$/),
                        });
                        break;
                    default:
                        res.status = 400;
                        res.body = { error: 'Invalid step' };
                        return;
                }
                const result = await APIGateway_1.ValidationMiddleware.validate(req, {
                    schema: stepSchema,
                    sanitize: true,
                    preventXSS: true,
                });
                if (!result.valid) {
                    res.status = 400;
                    res.body = { error: 'Validation failed', errors: result.errors };
                    return;
                }
                await next();
            },
        ],
        validation: APIGateway_1.ValidationHelpers.createSecureValidation(schema),
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.strict(),
    };
}
// ============================================================================
// Example 8: Complex Nested Object Validation
// ============================================================================
const addressSchema = zod_1.z.object({
    street: APIGateway_1.ValidationHelpers.patterns.safeText(100),
    city: APIGateway_1.ValidationHelpers.patterns.safeText(50),
    state: zod_1.z.string().length(2).regex(/^[A-Z]{2}$/),
    zipCode: APIGateway_1.CommonSchemas.zipCode,
    country: zod_1.z.string().length(2).regex(/^[A-Z]{2}$/),
});
const userProfileSchema = zod_1.z.object({
    personalInfo: zod_1.z.object({
        firstName: APIGateway_1.ValidationHelpers.patterns.safeText(50),
        lastName: APIGateway_1.ValidationHelpers.patterns.safeText(50),
        dateOfBirth: APIGateway_1.CommonSchemas.dateISO,
        phone: APIGateway_1.CommonSchemas.phone,
    }),
    contactInfo: zod_1.z.object({
        email: APIGateway_1.CommonSchemas.email,
        alternateEmail: APIGateway_1.CommonSchemas.email.optional(),
        address: addressSchema,
        billingAddress: addressSchema.optional(),
    }),
    preferences: zod_1.z.object({
        newsletter: zod_1.z.boolean().default(false),
        notifications: zod_1.z.boolean().default(true),
        language: zod_1.z.enum(['en', 'es', 'fr', 'de']).default('en'),
        timezone: zod_1.z.string().max(50),
    }),
    socialLinks: zod_1.z.object({
        website: APIGateway_1.CommonSchemas.url.optional(),
        linkedin: APIGateway_1.CommonSchemas.url.optional(),
        twitter: APIGateway_1.CommonSchemas.url.optional(),
        github: APIGateway_1.CommonSchemas.url.optional(),
    }).optional(),
});
function createUserProfileRoute() {
    return {
        path: '/api/users/profile',
        method: 'PUT',
        target: {
            type: 'function',
            handler: async (req) => {
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        profile: req.body,
                    },
                };
            },
        },
        middleware: [],
        validation: APIGateway_1.ValidationHelpers.createSecureValidation(userProfileSchema),
        rateLimit: APIGateway_1.ValidationHelpers.createRateLimit.moderate(),
    };
}
// ============================================================================
// Usage Example: Setting up API Gateway with Validation
// ============================================================================
async function setupAPIGatewayWithValidation() {
    const gateway = new APIGateway_1.APIGateway({
        port: 8080,
        host: '0.0.0.0',
        enableRateLimiting: true,
        enableCaching: true,
        timeout: 30000,
        maxRequestSize: 10 * 1024 * 1024,
    });
    // Register routes with validation
    gateway.registerRoute(createUserRegistrationRoute());
    gateway.registerRoute(createFileUploadRoute());
    gateway.registerRoute(createSearchRoute());
    gateway.registerRoute(createAdminCommandRoute());
    gateway.registerRoute(createBlogPostRoute());
    gateway.registerRoute(createCustomValidationRoute());
    gateway.registerRoute(createMultiStepValidationRoute());
    gateway.registerRoute(createUserProfileRoute());
    // Start the gateway
    await gateway.start();
    console.log('API Gateway started with comprehensive validation on port 8080');
    return gateway;
}
// ============================================================================
// Standalone Validation Examples
// ============================================================================
async function standaloneValidationExamples() {
    // Example: Validate arbitrary data
    const testRequest = {
        id: 'test-123',
        method: 'POST',
        path: '/test',
        headers: {},
        query: {},
        body: {
            email: 'test@example.com',
            username: 'testuser',
            age: 25,
        },
        params: {},
        ip: '127.0.0.1',
        timestamp: Date.now(),
        metadata: {},
    };
    const testSchema = zod_1.z.object({
        email: APIGateway_1.CommonSchemas.email,
        username: APIGateway_1.CommonSchemas.username,
        age: zod_1.z.number().int().min(18),
    });
    const result = await APIGateway_1.ValidationMiddleware.validate(testRequest, {
        schema: testSchema,
        sanitize: true,
        preventXSS: true,
        preventSQLInjection: true,
    });
    console.log('Validation result:', result);
}
