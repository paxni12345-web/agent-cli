# API Gateway Request Validation

Comprehensive request validation middleware for the API Gateway with schema validation, security checks, and sanitization.

## Features

### 1. Schema-Based Validation (Zod)
- Type-safe validation using Zod schemas
- Automatic type inference
- Custom validation rules
- Nested object validation
- Array validation with min/max length

### 2. Security Features

#### XSS Prevention
- Detects and blocks malicious script tags
- Prevents iframe injections
- Blocks javascript: URLs
- Sanitizes event handlers (onclick, onerror, etc.)
- HTML entity encoding

#### SQL Injection Prevention
- Detects SQL keywords (SELECT, INSERT, UPDATE, DELETE, etc.)
- Blocks SQL operators (OR, AND, UNION)
- Sanitizes SQL special characters
- Prevents comment-based attacks

#### Command Injection Prevention
- Blocks shell metacharacters (;, |, &, `, $, etc.)
- Prevents command chaining
- Sanitizes command strings
- Blocks subshell execution

#### Path Traversal Prevention
- Blocks directory traversal patterns (..)
- Prevents access to system directories (/etc/, /var/, /proc/, /sys/)
- Detects URL-encoded traversal attempts
- Path sanitization

### 3. Format Validation
- Email validation (RFC compliant)
- Phone number validation (international formats)
- URL validation (HTTP/HTTPS)
- UUID validation
- IP address validation (IPv4 and IPv6)
- Credit card validation
- ZIP code validation
- Date/time validation (ISO 8601)
- Custom regex patterns

### 4. Range and Length Validation
- Number min/max ranges
- Integer validation
- String length constraints (min/max)
- Array length validation
- Positive/non-negative number validation

### 5. Type Checking
- Automatic type inference from Zod schemas
- Runtime type validation
- Nested object type checking
- Array item type validation
- Optional and nullable fields

### 6. Sanitization
- HTML sanitization (encode special characters)
- SQL sanitization (escape quotes, remove operators)
- Command sanitization (remove shell metacharacters)
- Path sanitization (remove traversal patterns)
- Whitespace trimming
- Case normalization (lowercase/uppercase)

### 7. Rate Limiting Per Endpoint
- Fixed window strategy
- Sliding window strategy
- Token bucket algorithm
- Per-IP rate limiting
- Per-user rate limiting
- Per-endpoint rate limiting
- Custom key generation

## Usage

### Basic Example

```typescript
import { APIGateway, ValidationHelpers, CommonSchemas } from './APIGateway';
import { z } from 'zod';

const gateway = new APIGateway({ port: 8080 });

// Define validation schema
const userSchema = z.object({
  email: CommonSchemas.email,
  username: CommonSchemas.username,
  age: z.number().int().min(18).max(120),
});

// Register route with validation
gateway.registerRoute({
  path: '/api/users',
  method: 'POST',
  target: {
    type: 'function',
    handler: async (req) => ({
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, user: req.body },
    }),
  },
  middleware: [],
  validation: ValidationHelpers.createSecureValidation(userSchema),
  rateLimit: ValidationHelpers.createRateLimit.moderate(),
});

await gateway.start();
```

### Security Validation

```typescript
// Full security validation
gateway.registerRoute({
  path: '/api/data',
  method: 'POST',
  validation: {
    schema: mySchema,
    sanitize: true,
    preventXSS: true,
    preventSQLInjection: true,
    preventCommandInjection: true,
    preventPathTraversal: true,
  },
  // ... other config
});

// API-specific validation (XSS + SQL injection only)
gateway.registerRoute({
  path: '/api/search',
  method: 'GET',
  validation: ValidationHelpers.createAPIValidation(searchSchema),
  // ... other config
});

// File operation validation (path traversal + command injection)
gateway.registerRoute({
  path: '/api/files',
  method: 'POST',
  validation: ValidationHelpers.createFileValidation(fileSchema),
  // ... other config
});
```

### Custom Validators

```typescript
gateway.registerRoute({
  path: '/api/signup',
  method: 'POST',
  validation: {
    schema: signupSchema,
    sanitize: true,
    preventXSS: true,
    customValidators: [
      {
        field: 'body.email',
        validator: async (email: string) => {
          // Check if email domain is allowed
          const domain = email.split('@')[1];
          return allowedDomains.includes(domain);
        },
        message: 'Email domain not allowed',
      },
      {
        field: 'body.username',
        validator: async (username: string) => {
          // Check if username is available
          return !await isUsernameTaken(username);
        },
        message: 'Username already taken',
      },
    ],
  },
  // ... other config
});
```

### Rate Limiting Examples

```typescript
// Strict rate limiting (10 requests per minute)
rateLimit: ValidationHelpers.createRateLimit.strict()

// Moderate rate limiting (60 requests per minute)
rateLimit: ValidationHelpers.createRateLimit.moderate()

// Lenient rate limiting (100 requests per minute)
rateLimit: ValidationHelpers.createRateLimit.lenient()

// Custom rate limiting
rateLimit: ValidationHelpers.createRateLimit.custom(50, 30000, 'sliding_window')

// Per-user rate limiting
rateLimit: ValidationHelpers.createRateLimit.perUser(20, 60000)

// Per-endpoint rate limiting
rateLimit: ValidationHelpers.createRateLimit.perEndpoint('login', 5, 60000)
```

### Common Schemas

The library provides pre-built schemas for common data types:

```typescript
import { CommonSchemas } from './APIGateway';

// Email validation
CommonSchemas.email

// Phone number validation
CommonSchemas.phone

// URL validation
CommonSchemas.url

// Username validation (3-32 chars, alphanumeric + underscore/dash)
CommonSchemas.username

// Password validation (8-128 chars, requires uppercase, lowercase, digit, special char)
CommonSchemas.password

// UUID validation
CommonSchemas.uuid

// IP address validation
CommonSchemas.ipv4
CommonSchemas.ipv6

// Positive/non-negative integers
CommonSchemas.positiveInt
CommonSchemas.nonNegativeInt

// ISO date string
CommonSchemas.dateISO

// Alphanumeric string
CommonSchemas.alphanumeric

// URL-friendly slug
CommonSchemas.slug

// Hex color code
CommonSchemas.hexColor

// Credit card number
CommonSchemas.creditCard

// ZIP code
CommonSchemas.zipCode

// Safe string (no special characters that could be malicious)
CommonSchemas.safeString
```

### Validation Helpers

```typescript
import { ValidationHelpers } from './APIGateway';

// String with length constraints
ValidationHelpers.patterns.stringWithLength(5, 50, true)

// Number in range
ValidationHelpers.patterns.numberInRange(0, 100, true)

// Integer in range
ValidationHelpers.patterns.integerInRange(1, 10, true)

// Array with item validation
ValidationHelpers.patterns.array(z.string(), 0, 10, true)

// Enum validation
ValidationHelpers.patterns.enum(['active', 'inactive', 'pending'], true)

// Safe text (no XSS characters, max length)
ValidationHelpers.patterns.safeText(1000, true)
```

### Complex Nested Validation

```typescript
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
    address: z.object({
      street: ValidationHelpers.patterns.safeText(100),
      city: ValidationHelpers.patterns.safeText(50),
      zipCode: CommonSchemas.zipCode,
    }),
  }),
  preferences: z.object({
    newsletter: z.boolean().default(false),
    notifications: z.boolean().default(true),
    language: z.enum(['en', 'es', 'fr', 'de']).default('en'),
  }),
});

gateway.registerRoute({
  path: '/api/users/profile',
  method: 'PUT',
  validation: ValidationHelpers.createSecureValidation(userProfileSchema),
  rateLimit: ValidationHelpers.createRateLimit.moderate(),
  // ... other config
});
```

### Standalone Validation (Without Gateway)

```typescript
import { ValidationMiddleware } from './APIGateway';

const request = {
  id: 'test-123',
  method: 'POST',
  path: '/test',
  headers: {},
  query: {},
  body: { email: 'test@example.com', age: 25 },
  params: {},
  ip: '127.0.0.1',
  timestamp: Date.now(),
  metadata: {},
};

const schema = z.object({
  email: CommonSchemas.email,
  age: z.number().int().min(18),
});

const result = await ValidationMiddleware.validate(request, {
  schema,
  sanitize: true,
  preventXSS: true,
  preventSQLInjection: true,
});

if (!result.valid) {
  console.error('Validation errors:', result.errors);
} else {
  console.log('Validation passed');
  if (result.sanitized) {
    // Use sanitized data
    console.log('Sanitized data:', result.sanitized.body);
  }
}
```

## Validation Error Format

```typescript
interface ValidationError {
  field: string;        // Path to the field (e.g., "body.email", "query.page")
  message: string;      // Human-readable error message
  value?: any;          // The invalid value (optional)
  code: string;         // Error code (e.g., "VALIDATION_ERROR", "XSS_DETECTED")
}
```

Example error response:

```json
{
  "error": "Validation failed",
  "errors": [
    {
      "field": "body.email",
      "message": "Invalid email",
      "value": "not-an-email",
      "code": "invalid_string"
    },
    {
      "field": "body.content",
      "message": "Potential XSS detected",
      "code": "XSS_DETECTED"
    }
  ]
}
```

## Security Best Practices

1. **Always use schema validation** for all incoming data
2. **Enable all security checks** for user-generated content
3. **Sanitize data** even after validation
4. **Use rate limiting** on all public endpoints
5. **Validate nested objects** thoroughly
6. **Use CommonSchemas** for standard data types
7. **Implement custom validators** for business logic
8. **Log validation failures** for security monitoring
9. **Use HTTPS** in production
10. **Keep dependencies updated** (especially Zod)

## Performance Considerations

- Schema validation is cached by Zod for performance
- Security pattern matching uses compiled RegExp
- Sanitization is applied only when enabled
- Rate limiting uses in-memory stores (consider Redis for production)
- Validation runs before authentication to reject malicious requests early
- Custom validators should be efficient (avoid expensive database queries)

## Testing

Run the validation tests:

```bash
npm test src/network/__tests__/APIGateway.validation.test.ts
```

Tests cover:
- Schema validation
- XSS prevention
- SQL injection prevention
- Command injection prevention
- Path traversal prevention
- Sanitization
- Custom validators
- Common schemas
- Rate limiting

## Migration from Mock Validation

The mock validation has been completely replaced with real implementation:

**Before:**
```typescript
// Mock validation (no actual checks)
if (someCondition) {
  // Pretend to validate
}
```

**After:**
```typescript
// Real validation with Zod + security checks
validation: ValidationHelpers.createSecureValidation(schema)
```

All routes should be updated to use the new validation system.

## Examples

See `validation-examples.ts` for comprehensive usage examples including:
- User registration with full validation
- File upload with path traversal prevention
- Search endpoint with SQL injection prevention
- Admin commands with command injection prevention
- Blog posts with XSS prevention
- Custom validation rules
- Multi-step validation
- Complex nested object validation

## API Reference

### ValidationMiddleware

- `validate(request, config)` - Validate a request
- `createMiddleware(config)` - Create Express-style middleware

### ValidationHelpers

- `createSecureValidation(schema)` - Full security validation
- `createAPIValidation(schema)` - API-specific validation
- `createFileValidation(schema)` - File operation validation
- `createRateLimit.*` - Rate limiting configurations
- `patterns.*` - Common validation patterns

### CommonSchemas

Pre-built Zod schemas for common data types (email, phone, URL, etc.)

## License

MIT
