/**
 * API Gateway Validation Examples
 * Demonstrates comprehensive request validation usage
 */

import { z } from 'zod';
import {
  APIGateway,
  ValidationMiddleware,
  CommonSchemas,
  ValidationHelpers,
  Route,
  Request,
  Response,
} from './APIGateway';

// ============================================================================
// Example 1: User Registration Endpoint with Full Validation
// ============================================================================

const userRegistrationSchema = z.object({
  email: CommonSchemas.email,
  username: CommonSchemas.username,
  password: CommonSchemas.password,
  age: z.number().int().min(13).max(120),
  phone: CommonSchemas.phone.optional(),
  website: CommonSchemas.url.optional(),
  bio: ValidationHelpers.patterns.safeText(500, false),
});

export function createUserRegistrationRoute(): Omit<Route, 'id'> {
  return {
    path: '/api/users/register',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
    validation: ValidationHelpers.createSecureValidation(userRegistrationSchema),
    rateLimit: ValidationHelpers.createRateLimit.strict(),
  };
}

// ============================================================================
// Example 2: File Upload Endpoint with Path Traversal Prevention
// ============================================================================

const fileUploadSchema = z.object({
  filename: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_\-\.]+$/),
  path: z.string()
    .max(1000)
    .regex(/^[a-zA-Z0-9_\-\/\.]+$/),
  content: z.string().max(10 * 1024 * 1024), // 10MB
  mimeType: z.string().max(100),
});

export function createFileUploadRoute(): Omit<Route, 'id'> {
  return {
    path: '/api/files/upload',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
    validation: ValidationHelpers.createFileValidation(fileUploadSchema),
    rateLimit: ValidationHelpers.createRateLimit.moderate(),
  };
}

// ============================================================================
// Example 3: Search Endpoint with SQL Injection Prevention
// ============================================================================

const searchQuerySchema = z.object({
  query: z.string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9\s\-_]+$/),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
  sortBy: z.enum(['relevance', 'date', 'title', 'author']).default('relevance'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export function createSearchRoute(): Omit<Route, 'id'> {
  return {
    path: '/api/search',
    method: 'GET',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
    rateLimit: ValidationHelpers.createRateLimit.lenient(),
  };
}

// ============================================================================
// Example 4: Admin Command Endpoint with Command Injection Prevention
// ============================================================================

const adminCommandSchema = z.object({
  action: z.enum(['restart', 'status', 'config', 'logs']),
  service: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9\-]+$/),
  parameters: z.record(z.string()).optional(),
});

export function createAdminCommandRoute(): Omit<Route, 'id'> {
  return {
    path: '/api/admin/command',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
    rateLimit: ValidationHelpers.createRateLimit.perEndpoint('admin-command', 5, 60000),
    auth: {
      type: 'bearer',
      validator: async (token: string) => token === 'admin-token',
      required: true,
    },
  };
}

// ============================================================================
// Example 5: Blog Post Creation with XSS Prevention
// ============================================================================

const blogPostSchema = z.object({
  title: ValidationHelpers.patterns.safeText(200, true),
  content: ValidationHelpers.patterns.safeText(50000, true),
  excerpt: ValidationHelpers.patterns.safeText(500, false),
  tags: ValidationHelpers.patterns.array(
    z.string().min(1).max(30).regex(/^[a-z0-9\-]+$/),
    0,
    10,
    false
  ),
  category: z.enum(['tech', 'lifestyle', 'business', 'health', 'entertainment']),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  publishDate: CommonSchemas.dateISO.optional(),
});

export function createBlogPostRoute(): Omit<Route, 'id'> {
  return {
    path: '/api/posts',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
    rateLimit: ValidationHelpers.createRateLimit.perUser(10, 60000),
  };
}

// ============================================================================
// Example 6: Custom Validation Rules
// ============================================================================

const customValidationSchema = z.object({
  email: CommonSchemas.email,
  age: z.number().int().min(0).max(150),
  referralCode: z.string().length(8).regex(/^[A-Z0-9]+$/),
});

export function createCustomValidationRoute(): Omit<Route, 'id'> {
  return {
    path: '/api/users/signup',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
          validator: async (email: string) => {
            // Custom: check if email domain is allowed
            const allowedDomains = ['example.com', 'test.com'];
            const domain = email.split('@')[1];
            return allowedDomains.includes(domain);
          },
          message: 'Email domain not allowed',
        },
        {
          field: 'body.age',
          validator: (age: number) => {
            // Custom: must be 18 or older
            return age >= 18;
          },
          message: 'Must be 18 years or older',
        },
      ],
    },
    rateLimit: ValidationHelpers.createRateLimit.moderate(),
  };
}

// ============================================================================
// Example 7: Multi-step Validation Middleware
// ============================================================================

export function createMultiStepValidationRoute(): Omit<Route, 'id'> {
  const schema = z.object({
    step: z.enum(['personal', 'address', 'payment']),
    data: z.record(z.any()),
  });

  return {
    path: '/api/checkout/:step',
    method: 'POST',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
      async (req: Request, res: Response, next: () => Promise<void>) => {
        const step = req.params.step;

        let stepSchema;
        switch (step) {
          case 'personal':
            stepSchema = z.object({
              firstName: ValidationHelpers.patterns.safeText(50),
              lastName: ValidationHelpers.patterns.safeText(50),
              email: CommonSchemas.email,
            });
            break;
          case 'address':
            stepSchema = z.object({
              street: ValidationHelpers.patterns.safeText(100),
              city: ValidationHelpers.patterns.safeText(50),
              zipCode: CommonSchemas.zipCode,
            });
            break;
          case 'payment':
            stepSchema = z.object({
              cardNumber: CommonSchemas.creditCard,
              cvv: z.string().regex(/^\d{3,4}$/),
            });
            break;
          default:
            res.status = 400;
            res.body = { error: 'Invalid step' };
            return;
        }

        const result = await ValidationMiddleware.validate(req, {
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
    validation: ValidationHelpers.createSecureValidation(schema),
    rateLimit: ValidationHelpers.createRateLimit.strict(),
  };
}

// ============================================================================
// Example 8: Complex Nested Object Validation
// ============================================================================

const addressSchema = z.object({
  street: ValidationHelpers.patterns.safeText(100),
  city: ValidationHelpers.patterns.safeText(50),
  state: z.string().length(2).regex(/^[A-Z]{2}$/),
  zipCode: CommonSchemas.zipCode,
  country: z.string().length(2).regex(/^[A-Z]{2}$/),
});

const userProfileSchema = z.object({
  personalInfo: z.object({
    firstName: ValidationHelpers.patterns.safeText(50),
    lastName: ValidationHelpers.patterns.safeText(50),
    dateOfBirth: CommonSchemas.dateISO,
    phone: CommonSchemas.phone,
  }),
  contactInfo: z.object({
    email: CommonSchemas.email,
    alternateEmail: CommonSchemas.email.optional(),
    address: addressSchema,
    billingAddress: addressSchema.optional(),
  }),
  preferences: z.object({
    newsletter: z.boolean().default(false),
    notifications: z.boolean().default(true),
    language: z.enum(['en', 'es', 'fr', 'de']).default('en'),
    timezone: z.string().max(50),
  }),
  socialLinks: z.object({
    website: CommonSchemas.url.optional(),
    linkedin: CommonSchemas.url.optional(),
    twitter: CommonSchemas.url.optional(),
    github: CommonSchemas.url.optional(),
  }).optional(),
});

export function createUserProfileRoute(): Omit<Route, 'id'> {
  return {
    path: '/api/users/profile',
    method: 'PUT',
    target: {
      type: 'function',
      handler: async (req: Request): Promise<Response> => {
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
    validation: ValidationHelpers.createSecureValidation(userProfileSchema),
    rateLimit: ValidationHelpers.createRateLimit.moderate(),
  };
}

// ============================================================================
// Usage Example: Setting up API Gateway with Validation
// ============================================================================

export async function setupAPIGatewayWithValidation(): Promise<APIGateway> {
  const gateway = new APIGateway({
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

export async function standaloneValidationExamples() {
  // Example: Validate arbitrary data
  const testRequest: Request = {
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

  const testSchema = z.object({
    email: CommonSchemas.email,
    username: CommonSchemas.username,
    age: z.number().int().min(18),
  });

  const result = await ValidationMiddleware.validate(testRequest, {
    schema: testSchema,
    sanitize: true,
    preventXSS: true,
    preventSQLInjection: true,
  });

  console.log('Validation result:', result);
}
