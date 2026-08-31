# API Gateway Request Validation Middleware

## Overview

This is a comprehensive, production-ready request validation middleware for the API Gateway that provides:

- **Schema-based validation** using Zod
- **Type checking** for all inputs (body, query, headers, params)
- **Range validation** for numbers
- **Length validation** for strings
- **Format validation** (email, phone, URL, UUID, etc.)
- **XSS prevention** with pattern detection
- **SQL injection prevention** with pattern detection
- **Command injection prevention**
- **Path traversal prevention**
- **HTML sanitization**
- **Per-endpoint rate limiting**
- **Nested object validation** with depth limits
- **Field size limits**

## Files

- **`ValidationMiddleware.ts`** - Core validation middleware implementation
- **`ValidationExamples.ts`** - Real-world usage examples
- **`ValidationTests.ts`** - Comprehensive test suite
- **`APIGateway.ts`** - Updated to integrate validation middleware

## Installation

The validation middleware requires the `zod` library:

```bash
npm install zod
# or
yarn add zod
```

## Quick Start

### Basic Usage

```typescript
import { APIGatewayManager } from './APIGateway';
import { ValidationPresets, CommonSchemas } from './ValidationMiddleware';
import { z } from 'zod';

const gateway = new APIGatewayManager();

// Register a route with validation
gateway.registerRoute({
  path: '/api/users',
  method: 'POST',
  backend: {
    type: 'http',
    url: 'http://localhost:3000/users',
  },
  middleware: [
    {
      name: 'user-validation',
      type: 'validate',
      config: ValidationPresets.strict({
        body: z.object({
          username: CommonSchemas.username,
          email: CommonSchemas.email,
          password: CommonSchemas.password,
        }),
      }),
      order: 1,
    },
  ],
  metadata: {
    name: 'Create User',
    description: 'Create a new user',
    version: '1.0.0',
    tags: ['users'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});
```

## Features

### 1. Schema-Based Validation (Zod)

Use Zod schemas to validate request structure:

```typescript
import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  age: z.number().int().min(18),
  website: z.string().url().optional(),
});

// In middleware config
config: {
  schemas: {
    body: userSchema,
  },
}
```

### 2. Type Checking

All inputs are type-checked automatically through Zod schemas:

```typescript
const schema = z.object({
  id: z.number().int(),           // Must be integer
  name: z.string(),                // Must be string
  active: z.boolean(),             // Must be boolean
  tags: z.array(z.string()),       // Must be array of strings
  metadata: z.record(z.any()),     // Must be object
});
```

### 3. Range Validation

Validate numeric ranges:

```typescript
const productSchema = z.object({
  price: z.number().min(0).max(10000),
  quantity: z.number().int().min(1).max(999),
  discount: z.number().min(0).max(100),
});
```

### 4. Length Validation

Validate string lengths:

```typescript
const schema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(5000),
  slug: z.string().length(10), // Exactly 10 characters
});
```

### 5. Format Validation

Built-in validators for common formats:

```typescript
import { CommonSchemas } from './ValidationMiddleware';

const schema = z.object({
  email: CommonSchemas.email,          // Email format
  phone: CommonSchemas.phone,          // E.164 phone format
  url: CommonSchemas.url,              // Valid URL
  uuid: CommonSchemas.uuid,            // UUID format
  ipAddress: CommonSchemas.ipAddress,  // IPv4 address
  isoDate: CommonSchemas.isoDate,      // ISO 8601 date
});
```

### 6. XSS Prevention

Automatically detects and blocks XSS attempts:

```typescript
// These will be blocked:
'<script>alert("XSS")</script>'
'javascript:alert(1)'
'<img src=x onerror="alert(1)">'
'<iframe src="evil.com"></iframe>'

// Configure in security settings
config: {
  security: {
    preventXSS: true,
    sanitizeHTML: true, // Also sanitize HTML content
  },
}
```

### 7. SQL Injection Prevention

Detects common SQL injection patterns:

```typescript
// These will be blocked:
"'; DROP TABLE users; --"
"1' OR '1'='1"
"UNION SELECT * FROM passwords"

// Configure in security settings
config: {
  security: {
    preventSQLInjection: true,
  },
}
```

### 8. Command Injection Prevention

Blocks shell command injection attempts:

```typescript
// These will be blocked:
'test; rm -rf /'
'test | cat /etc/passwd'
'test && malicious_command'
'$(malicious_command)'

// Configure in security settings
config: {
  security: {
    preventCommandInjection: true,
  },
}
```

### 9. Path Traversal Prevention

Prevents directory traversal attacks:

```typescript
// These will be blocked:
'../../../etc/passwd'
'..\\..\\windows\\system32'
'%2e%2e%2f%2e%2e%2f'

// Configure in security settings
config: {
  security: {
    preventPathTraversal: true,
  },
}
```

### 10. Rate Limiting Per Endpoint

Rate limit specific endpoints independently:

```typescript
config: {
  rateLimit: {
    windowMs: 60000,        // Time window (1 minute)
    maxRequests: 100,       // Max requests per window
    keyGenerator: (req) => {
      // Custom key generation
      return req.metadata.userId || req.ip;
    },
  },
}
```

## Common Schemas

Pre-built validation schemas for common patterns:

```typescript
import { CommonSchemas } from './ValidationMiddleware';

// Email validation
CommonSchemas.email

// Phone number (E.164 format)
CommonSchemas.phone

// URL validation
CommonSchemas.url

// UUID validation
CommonSchemas.uuid

// Username (3-30 chars, alphanumeric + _ -)
CommonSchemas.username

// Strong password
CommonSchemas.password

// Positive integer
CommonSchemas.positiveInt

// Pagination
CommonSchemas.pagination // { page: number, limit: number }

// Search query
CommonSchemas.searchQuery

// Sort order
CommonSchemas.sortOrder // 'asc' | 'desc'
```

## Validation Presets

Pre-configured validation settings for common scenarios:

### Strict Preset

Maximum security for sensitive endpoints:

```typescript
import { ValidationPresets } from './ValidationMiddleware';

config: ValidationPresets.strict({
  body: mySchema,
})

// Enables:
// - All security checks
// - 1MB field size limit
// - 10 level depth limit
// - 100 requests/minute rate limit
```

### Moderate Preset

Balanced security and performance:

```typescript
config: ValidationPresets.moderate({
  body: mySchema,
})

// Enables:
// - XSS and SQL injection prevention
// - HTML sanitization
// - 5MB field size limit
// - 20 level depth limit
// - 500 requests/minute rate limit
```

### Lenient Preset

Minimal checks for internal APIs:

```typescript
config: ValidationPresets.lenient({
  body: mySchema,
})

// Enables:
// - XSS prevention only
// - 10MB field size limit
// - 50 level depth limit
// - No rate limiting
```

### Public API Preset

Optimized for public-facing APIs:

```typescript
config: ValidationPresets.publicAPI({
  body: mySchema,
})

// Enables:
// - All security checks
// - 512KB field size limit
// - 5 level depth limit
// - 50 requests/minute per API key or IP
```

## Custom Configuration

Build your own validation configuration:

```typescript
import { ValidationConfig } from './ValidationMiddleware';

const config: ValidationConfig = {
  // Schema validation
  schemas: {
    body: bodySchema,
    query: querySchema,
    headers: headerSchema,
    params: paramSchema,
  },
  
  // Security settings
  security: {
    preventXSS: true,
    preventSQLInjection: true,
    preventCommandInjection: true,
    preventPathTraversal: true,
    sanitizeHTML: true,
    maxFieldSize: 1024 * 1024,  // 1MB
    maxDepth: 10,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 60000,              // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => {
      return `${req.metadata.userId}:${req.path}`;
    },
  },
};
```

## Real-World Examples

### Example 1: User Registration

```typescript
const registrationSchema = z.object({
  username: CommonSchemas.username,
  email: CommonSchemas.email,
  password: CommonSchemas.password,
  agreeToTerms: z.boolean().refine(val => val === true),
});

gateway.registerRoute({
  path: '/api/users/register',
  method: 'POST',
  middleware: [{
    name: 'registration-validation',
    type: 'validate',
    config: ValidationPresets.strict({ body: registrationSchema }),
    order: 1,
  }],
  // ... rest of route config
});
```

### Example 2: Search with Pagination

```typescript
const searchSchema = z.object({
  q: CommonSchemas.searchQuery,
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

gateway.registerRoute({
  path: '/api/products/search',
  method: 'GET',
  middleware: [{
    name: 'search-validation',
    type: 'validate',
    config: ValidationPresets.publicAPI({ query: searchSchema }),
    order: 1,
  }],
  // ... rest of route config
});
```

### Example 3: File Upload

```typescript
const fileUploadSchema = z.object({
  fileName: z.string().regex(/^[a-zA-Z0-9._-]+$/),
  fileType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  fileSize: z.number().int().max(10 * 1024 * 1024), // 10MB
});

gateway.registerRoute({
  path: '/api/files/upload',
  method: 'POST',
  middleware: [{
    name: 'upload-validation',
    type: 'validate',
    config: {
      schemas: { body: fileUploadSchema },
      security: {
        preventXSS: true,
        preventPathTraversal: true,
        maxFieldSize: 10 * 1024 * 1024,
      },
      rateLimit: {
        windowMs: 3600000,  // 1 hour
        maxRequests: 50,
        keyGenerator: (req) => req.metadata.userId || req.ip,
      },
    },
    order: 1,
  }],
  // ... rest of route config
});
```

### Example 4: Admin Endpoint

```typescript
const adminUpdateSchema = z.object({
  userId: CommonSchemas.uuid,
  role: z.enum(['user', 'moderator', 'admin']),
  permissions: z.array(z.string()).max(50),
});

gateway.registerRoute({
  path: '/api/admin/users/:userId',
  method: 'PUT',
  middleware: [{
    name: 'admin-validation',
    type: 'validate',
    config: ValidationPresets.strict({
      body: adminUpdateSchema,
      params: z.object({ userId: CommonSchemas.uuid }),
    }),
    order: 2,
  }],
  auth: {
    type: 'api_key',
    required: true,
    scopes: ['admin'],
  },
  // ... rest of route config
});
```

## Security Best Practices

1. **Always validate user input** - Never trust data from clients
2. **Use strict presets for sensitive endpoints** - Authentication, payments, admin
3. **Sanitize HTML** when accepting rich text
4. **Set appropriate rate limits** - Protect against DoS attacks
5. **Limit field sizes** - Prevent memory exhaustion
6. **Limit object depth** - Prevent stack overflow
7. **Use strong schema validation** - Type safety prevents many bugs
8. **Log security violations** - Monitor for attack attempts

## Error Handling

Validation errors return structured error responses:

```typescript
{
  "allowed": false,
  "status": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "body.email",
      "message": "Invalid email format",
      "code": "invalid_string"
    },
    {
      "field": "body.password",
      "message": "Password must contain at least one uppercase letter",
      "code": "invalid_string"
    }
  ]
}
```

Rate limit errors:

```typescript
{
  "allowed": false,
  "status": 429,
  "message": "Rate limit exceeded. Try again in 45 seconds",
  "errors": [
    {
      "field": "rate_limit",
      "message": "Rate limit exceeded. Try again in 45 seconds",
      "code": "RATE_LIMIT_EXCEEDED"
    }
  ]
}
```

Security violation errors:

```typescript
{
  "allowed": false,
  "status": 400,
  "message": "XSS attack detected",
  "errors": [
    {
      "field": "security",
      "message": "XSS attack detected",
      "code": "SECURITY_VIOLATION"
    }
  ]
}
```

## Performance Considerations

- **Schema compilation**: Zod schemas are compiled once when routes are registered
- **Rate limiter cleanup**: Call `validationFactory.cleanup()` periodically to remove expired entries
- **Memory usage**: Set appropriate `maxFieldSize` and `maxDepth` limits
- **Caching**: Validated and sanitized data is cached in the request object

## Testing

Run the comprehensive test suite:

```typescript
import './ValidationTests';
```

The test suite covers:
- All security validators
- Schema validation
- Common schema patterns
- Request validation
- Rate limiting
- Edge cases

## API Reference

### ValidationMiddlewareFactory

```typescript
class ValidationMiddlewareFactory {
  create(config: ValidationConfig): MiddlewareFunction
  getValidator(): RequestValidator
  cleanup(): void
}
```

### RequestValidator

```typescript
class RequestValidator {
  validate(request: APIRequest, config: ValidationConfig): Promise<ValidationResult>
  cleanup(): void
}
```

### SecurityValidator

```typescript
class SecurityValidator {
  static detectXSS(value: any): boolean
  static detectSQLInjection(value: any): boolean
  static detectCommandInjection(value: any): boolean
  static detectPathTraversal(value: any): boolean
  static sanitizeHTML(html: string): string
  static escapeSQLString(value: string): string
  static sanitizeFilePath(path: string): string
  static sanitizeObject(obj: any, config: SecurityConfig): any
}
```

## Integration with API Gateway

The validation middleware is automatically integrated into the API Gateway's middleware pipeline. It runs in the order specified by the `order` field and can access/modify the request before it reaches the backend.

When validation succeeds and produces sanitized data, the request object is updated with the clean values, ensuring downstream handlers receive validated and safe input.

## License

Part of the API Gateway Phase 3 implementation.
