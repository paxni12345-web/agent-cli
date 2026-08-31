# API Gateway Request Validation - Implementation Guide

## Overview

The APIGateway now includes comprehensive request validation with the following features:

1. **Schema-based validation** using Zod
2. **Type checking** for all inputs
3. **Range validation** for numbers
4. **Length validation** for strings
5. **Format validation** (email, phone, URL, UUID, IP, date, JSON)
6. **XSS prevention** with HTML sanitization
7. **SQL injection prevention**
8. **Command injection prevention**
9. **Path traversal prevention**
10. **Rate limiting per endpoint**

## Components

### 1. InputSanitizer

Provides static methods for sanitizing various types of input:

- `sanitizeHTML(input, config?)` - XSS prevention
- `sanitizeSQL(input)` - SQL injection prevention
- `sanitizeCommand(input)` - Command injection prevention
- `sanitizePath(input)` - Path traversal prevention
- `sanitizeObject(obj, config?)` - Recursive sanitization
- `sanitizeEmail(email)` - Email validation and sanitization
- `sanitizeURL(url)` - URL validation and sanitization

### 2. RequestValidator

Comprehensive request validation:

- `validate(request, config)` - Main validation method
- `createZodSchema(schema)` - Convert ValidationSchema to Zod schema

### 3. ValidationMiddleware

Factory functions for creating validation middleware:

- `create(config)` - Validation middleware from schema
- `createSanitizer(config?)` - Sanitization middleware
- `createRateLimiter(config)` - Rate limiting middleware per endpoint
- `createXSSProtection()` - XSS protection middleware
- `createSQLInjectionProtection()` - SQL injection detection
- `createCommandInjectionProtection()` - Command injection prevention
- `createPathTraversalProtection()` - Path traversal prevention
- `createSecurityMiddleware(config?)` - Comprehensive security (combines all)

### 4. ValidationSchemas Helper

Pre-built validation schemas:

- `email()` - Email validation
- `url()` - URL validation
- `phone()` - Phone number validation
- `uuid()` - UUID validation
- `integer(min?, max?)` - Integer with range
- `string(minLength?, maxLength?, pattern?)` - String validation
- `array(items?, minLength?, maxLength?)` - Array validation
- `object(properties, required?)` - Object validation
- `enum(values)` - Enum validation

## Usage Examples

### Basic Endpoint with Validation

```typescript
import { 
  apiGateway, 
  ValidationSchemas, 
  ValidationMiddleware,
  RateLimitStrategy 
} from './api/APIGateway';

// Register endpoint with comprehensive validation
apiGateway.registerEndpoint({
  path: '/api/users',
  method: HTTPMethod.POST,
  handler: async (request, context) => {
    // Request is already validated and sanitized
    const { email, name, age } = request.body;
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: { id: '123', email, name, age },
    };
  },
  middleware: [
    // Apply security middleware (XSS, SQL injection, etc.)
    ...ValidationMiddleware.createSecurityMiddleware({
      rateLimiting: {
        strategy: RateLimitStrategy.FixedWindow,
        limit: 100,
        window: 60000, // 1 minute
      },
    }),
  ],
  validation: {
    body: {
      type: 'object',
      required: ['email', 'name', 'age'],
      properties: {
        email: ValidationSchemas.email(),
        name: ValidationSchemas.string(2, 100),
        age: ValidationSchemas.integer(0, 150),
      },
    },
  },
  rateLimit: {
    strategy: RateLimitStrategy.FixedWindow,
    limit: 100,
    window: 60000,
  },
  tags: ['users'],
});
```

### Custom Validation Schema

```typescript
apiGateway.registerEndpoint({
  path: '/api/products/:id',
  method: HTTPMethod.PUT,
  handler: async (request, context) => {
    const { id } = request.params;
    const { name, price, category } = request.body;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { id, name, price, category },
    };
  },
  middleware: [
    ValidationMiddleware.createXSSProtection(),
    ValidationMiddleware.createSQLInjectionProtection(),
  ],
  validation: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: ValidationSchemas.uuid(),
      },
    },
    body: {
      type: 'object',
      required: ['name', 'price'],
      properties: {
        name: {
          type: 'string',
          minLength: 3,
          maxLength: 200,
        },
        price: {
          type: 'number',
          minimum: 0,
          maximum: 1000000,
        },
        category: {
          type: 'string',
          enum: ['electronics', 'clothing', 'food', 'books'],
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 2,
            maxLength: 50,
          },
          minLength: 0,
          maxLength: 10,
        },
      },
    },
  },
  tags: ['products'],
});
```

### Query Parameter Validation

```typescript
apiGateway.registerEndpoint({
  path: '/api/search',
  method: HTTPMethod.GET,
  handler: async (request, context) => {
    const { query, page, limit, sortBy } = request.query;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { results: [], page, limit },
    };
  },
  middleware: [
    ValidationMiddleware.createPathTraversalProtection(),
  ],
  validation: {
    query: {
      type: 'object',
      required: ['query'],
      properties: {
        query: ValidationSchemas.string(1, 200),
        page: {
          type: 'number',
          minimum: 1,
          maximum: 10000,
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'date', 'price'],
        },
      },
    },
  },
  tags: ['search'],
});
```

### File Upload with Path Validation

```typescript
apiGateway.registerEndpoint({
  path: '/api/files/upload',
  method: HTTPMethod.POST,
  handler: async (request, context) => {
    const { filename, path } = request.body;
    
    // Path is already sanitized to prevent traversal
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, path: path },
    };
  },
  middleware: [
    ValidationMiddleware.createPathTraversalProtection(),
    ValidationMiddleware.createCommandInjectionProtection(),
  ],
  validation: {
    body: {
      type: 'object',
      required: ['filename', 'path'],
      properties: {
        filename: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          pattern: '^[a-zA-Z0-9_.-]+$',
        },
        path: {
          type: 'string',
          minLength: 1,
          maxLength: 1000,
        },
      },
    },
  },
  tags: ['files'],
});
```

### Custom Rate Limiting Per Endpoint

```typescript
// Different rate limits for different operations
apiGateway.registerEndpoint({
  path: '/api/heavy-operation',
  method: HTTPMethod.POST,
  handler: async (request, context) => {
    // Expensive operation
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { status: 'processing' },
    };
  },
  middleware: [
    ValidationMiddleware.createRateLimiter({
      strategy: RateLimitStrategy.TokenBucket,
      limit: 10, // Only 10 requests
      window: 3600000, // Per hour
      keyGenerator: (request) => {
        // Rate limit per user
        const userId = (request as any).user?.id || request.ip;
        return `heavy-op:${userId}`;
      },
    }),
  ],
  tags: ['operations'],
});
```

### Using Zod Schemas Directly

```typescript
import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
  role: z.enum(['user', 'admin', 'moderator']),
  profile: z.object({
    bio: z.string().max(500).optional(),
    website: z.string().url().optional(),
  }).optional(),
});

apiGateway.registerEndpoint({
  path: '/api/users/profile',
  method: HTTPMethod.POST,
  handler: async (request, context) => {
    // Type-safe with Zod inference
    const userData = request.body;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: userData,
    };
  },
  validation: {
    body: {
      type: 'object',
      zodSchema: userSchema,
    },
  },
  tags: ['users'],
});
```

### Format Validation Examples

```typescript
// Email validation
apiGateway.registerEndpoint({
  path: '/api/contact',
  method: HTTPMethod.POST,
  validation: {
    body: {
      type: 'object',
      required: ['email', 'phone', 'website'],
      properties: {
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', format: 'phone' },
        website: { type: 'string', format: 'url' },
        ipAddress: { type: 'string', format: 'ip' },
        userId: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date' },
      },
    },
  },
  handler: async (request, context) => {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { received: true },
    };
  },
  middleware: [],
  tags: ['contact'],
});
```

## Security Features

### Automatic Sanitization

All requests are automatically sanitized after validation:

```typescript
// In APIGateway.handleRequest():
// After validation, inputs are sanitized
request.body = InputSanitizer.sanitizeObject(request.body);
request.query = InputSanitizer.sanitizeObject(request.query);
request.params = InputSanitizer.sanitizeObject(request.params);
```

### XSS Prevention

```typescript
import { InputSanitizer } from './api/APIGateway';

// Strip all HTML
const safe = InputSanitizer.sanitizeHTML('<script>alert("xss")</script>');
// Result: ''

// Allow specific tags
const safeWithTags = InputSanitizer.sanitizeHTML(
  '<p>Hello <strong>World</strong></p>',
  {
    allowHTML: true,
    allowedTags: ['p', 'strong'],
    allowedAttributes: { p: ['class'], strong: [] },
  }
);
// Result: '<p>Hello <strong>World</strong></p>'
```

### SQL Injection Prevention

```typescript
// Automatic detection middleware
ValidationMiddleware.createSQLInjectionProtection();

// Manual sanitization
const safe = InputSanitizer.sanitizeSQL("'; DROP TABLE users; --");
// Result: "''; DROP TABLE users; --"
```

### Command Injection Prevention

```typescript
const safe = InputSanitizer.sanitizeCommand('rm -rf / ; echo "pwned"');
// Result: 'rm -rf  echo "pwned"'
```

### Path Traversal Prevention

```typescript
const safe = InputSanitizer.sanitizePath('../../etc/passwd');
// Result: 'etc/passwd'
```

## Error Responses

Validation errors return a structured response:

```json
{
  "error": "Validation failed",
  "errors": [
    {
      "field": "body.email",
      "message": "Invalid email format"
    },
    {
      "field": "body.age",
      "message": "Number must be at least 0"
    }
  ]
}
```

Rate limit exceeded response:

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": "2026-08-30T17:00:00.000Z"
}
```

## Best Practices

1. **Always validate user input** - Use validation config on all endpoints
2. **Use middleware for common security** - Apply security middleware globally or per endpoint
3. **Set appropriate rate limits** - Different limits for different operations
4. **Sanitize file paths** - Use path sanitization for file operations
5. **Validate formats** - Use format validation for emails, URLs, UUIDs, etc.
6. **Set length limits** - Always set max length to prevent DoS
7. **Use enums for fixed values** - Validate against allowed values
8. **Combine validations** - Use multiple middleware for defense in depth

## Testing Validation

```typescript
// Test validation manually
import { RequestValidator } from './api/APIGateway';

const errors = RequestValidator.validate(
  {
    method: HTTPMethod.POST,
    path: '/api/test',
    headers: {},
    query: {},
    params: {},
    body: { email: 'invalid-email', age: -5 },
    ip: '127.0.0.1',
  },
  {
    body: {
      type: 'object',
      required: ['email', 'age'],
      properties: {
        email: ValidationSchemas.email(),
        age: ValidationSchemas.integer(0, 150),
      },
    },
  }
);

console.log(errors);
// [
//   { field: 'body.email', message: 'Invalid email format', value: 'invalid-email' },
//   { field: 'body.age', message: 'Number must be at least 0', value: -5 }
// ]
```

## Dependencies

The validation system requires:

- `zod` - Schema validation
- `validator` - Format validation (email, URL, phone, etc.)
- `xss` - XSS prevention and HTML sanitization

Install with:

```bash
npm install zod validator xss @types/validator
```
