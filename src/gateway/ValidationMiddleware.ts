/**
 * COMPREHENSIVE REQUEST VALIDATION MIDDLEWARE
 * Schema-based validation, security checks, and sanitization
 */

import { z, ZodSchema, ZodError } from 'zod';
import { APIRequest } from './APIGateway';

// ============================================================================
// Validation Types & Interfaces
// ============================================================================

export interface ValidationConfig {
  schemas?: {
    body?: ZodSchema;
    query?: ZodSchema;
    headers?: ZodSchema;
    params?: ZodSchema;
  };
  security?: SecurityConfig;
  rateLimit?: EndpointRateLimitConfig;
}

export interface SecurityConfig {
  preventXSS?: boolean;
  preventSQLInjection?: boolean;
  preventCommandInjection?: boolean;
  preventPathTraversal?: boolean;
  sanitizeHTML?: boolean;
  maxFieldSize?: number;
  maxDepth?: number;
}

export interface EndpointRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: APIRequest) => string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  sanitized?: {
    body?: any;
    query?: any;
    headers?: any;
    params?: any;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// ============================================================================
// Built-in Validation Schemas
// ============================================================================

export const CommonSchemas = {
  // Email validation
  email: z.string().email('Invalid email format').min(5).max(254),

  // Phone validation (international format)
  phone: z.string().regex(
    /^\+?[1-9]\d{1,14}$/,
    'Invalid phone number. Use international format (E.164)'
  ),

  // URL validation
  url: z.string().url('Invalid URL format').max(2048),

  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // IP address validation
  ipAddress: z.string().regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    'Invalid IP address'
  ),

  // Date validation (ISO 8601)
  isoDate: z.string().datetime('Invalid ISO 8601 date format'),

  // Alphanumeric validation
  alphanumeric: z.string().regex(/^[a-zA-Z0-9]+$/, 'Must contain only alphanumeric characters'),

  // Username validation
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),

  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  // Positive integer
  positiveInt: z.number().int().positive(),

  // Non-negative integer
  nonNegativeInt: z.number().int().min(0),

  // Pagination
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),

  // Search query
  searchQuery: z.string().min(1).max(200).trim(),

  // Sort order
  sortOrder: z.enum(['asc', 'desc']),

  // ID patterns
  id: z.string().min(1).max(64),
};

// ============================================================================
// Security Validators
// ============================================================================

export class SecurityValidator {
  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /eval\s*\(/gi,
  ];

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /--/g,
    /;.*--/g,
    /'\s*(OR|AND)\s*'?\d/gi,
    /'\s*=\s*'/gi,
    /UNION\s+SELECT/gi,
    /xp_cmdshell/gi,
  ];

  private static readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$(){}[\]<>]/g,
    /\$\(.*?\)/g,
    /`.*?`/g,
    /\|\|/g,
    /&&/g,
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\./g,
    /\.\.\\|\.\.\/|%2e%2e/gi,
    /\.\.%2f|\.\.%5c/gi,
    /%252e%252e/gi,
  ];

  /**
   * Detect XSS attack attempts
   */
  public static detectXSS(value: any): boolean {
    if (typeof value !== 'string') return false;

    return this.XSS_PATTERNS.some(pattern => pattern.test(value));
  }

  /**
   * Detect SQL injection attempts
   */
  public static detectSQLInjection(value: any): boolean {
    if (typeof value !== 'string') return false;

    // Check for common SQL injection patterns
    return this.SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
  }

  /**
   * Detect command injection attempts
   */
  public static detectCommandInjection(value: any): boolean {
    if (typeof value !== 'string') return false;

    return this.COMMAND_INJECTION_PATTERNS.some(pattern => pattern.test(value));
  }

  /**
   * Detect path traversal attempts
   */
  public static detectPathTraversal(value: any): boolean {
    if (typeof value !== 'string') return false;

    return this.PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(value));
  }

  /**
   * Sanitize HTML content
   */
  public static sanitizeHTML(html: string): string {
    if (!html || typeof html !== 'string') return '';

    // Remove script tags and event handlers
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<iframe/gi, '&lt;iframe')
      .replace(/<object/gi, '&lt;object')
      .replace(/<embed/gi, '&lt;embed');

    return sanitized;
  }

  /**
   * Escape special characters for SQL
   */
  public static escapeSQLString(value: string): string {
    if (!value || typeof value !== 'string') return '';

    return value.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case '\0': return '\\0';
        case '\x08': return '\\b';
        case '\x09': return '\\t';
        case '\x1a': return '\\z';
        case '\n': return '\\n';
        case '\r': return '\\r';
        case '"':
        case "'":
        case '\\':
        case '%': return '\\' + char;
        default: return char;
      }
    });
  }

  /**
   * Sanitize file path
   */
  public static sanitizeFilePath(path: string): string {
    if (!path || typeof path !== 'string') return '';

    // Remove path traversal attempts
    return path
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*]/g, '')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');
  }

  /**
   * Validate and sanitize object recursively
   */
  public static sanitizeObject(
    obj: any,
    config: SecurityConfig,
    depth: number = 0
  ): any {
    const maxDepth = config.maxDepth || 10;
    const maxFieldSize = config.maxFieldSize || 1024 * 1024; // 1MB

    if (depth > maxDepth) {
      throw new Error(`Object depth exceeds maximum of ${maxDepth}`);
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      // Check size
      if (obj.length > maxFieldSize) {
        throw new Error(`Field size exceeds maximum of ${maxFieldSize} characters`);
      }

      // Security checks
      if (config.preventXSS && this.detectXSS(obj)) {
        throw new Error('XSS attack detected');
      }

      if (config.preventSQLInjection && this.detectSQLInjection(obj)) {
        throw new Error('SQL injection attempt detected');
      }

      if (config.preventCommandInjection && this.detectCommandInjection(obj)) {
        throw new Error('Command injection attempt detected');
      }

      if (config.preventPathTraversal && this.detectPathTraversal(obj)) {
        throw new Error('Path traversal attempt detected');
      }

      // Sanitize if configured
      if (config.sanitizeHTML) {
        return this.sanitizeHTML(obj);
      }

      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, config, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const sanitizedKey = config.sanitizeHTML ? this.sanitizeHTML(key) : key;

        // Sanitize value
        sanitized[sanitizedKey] = this.sanitizeObject(value, config, depth + 1);
      }

      return sanitized;
    }

    return obj;
  }
}

// ============================================================================
// Rate Limiter per Endpoint
// ============================================================================

export class EndpointRateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if request is within rate limit
   */
  public checkLimit(req: APIRequest, config: EndpointRateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const key = config.keyGenerator
      ? config.keyGenerator(req)
      : `${req.ip}:${req.path}`;

    const now = Date.now();
    const record = this.requestCounts.get(key);

    // No record or window expired
    if (!record || now >= record.resetTime) {
      this.requestCounts.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    // Within window
    if (record.count < config.maxRequests) {
      record.count++;
      return {
        allowed: true,
        remaining: config.maxRequests - record.count,
        resetTime: record.resetTime,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  /**
   * Clean up expired entries
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requestCounts.entries()) {
      if (now >= record.resetTime) {
        this.requestCounts.delete(key);
      }
    }
  }
}

// ============================================================================
// Request Validator
// ============================================================================

export class RequestValidator {
  private rateLimiter = new EndpointRateLimiter();

  /**
   * Validate request against configuration
   */
  public async validate(
    request: APIRequest,
    config: ValidationConfig
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const sanitized: any = {};

    try {
      // 1. Rate limiting check
      if (config.rateLimit) {
        const rateLimitResult = this.rateLimiter.checkLimit(request, config.rateLimit);

        if (!rateLimitResult.allowed) {
          return {
            valid: false,
            errors: [{
              field: 'rate_limit',
              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds`,
              code: 'RATE_LIMIT_EXCEEDED',
            }],
          };
        }
      }

      // 2. Security checks and sanitization
      if (config.security) {
        try {
          if (request.body) {
            sanitized.body = SecurityValidator.sanitizeObject(
              request.body,
              config.security
            );
          }

          if (request.query) {
            sanitized.query = SecurityValidator.sanitizeObject(
              request.query,
              config.security
            );
          }

          if (request.headers) {
            sanitized.headers = SecurityValidator.sanitizeObject(
              request.headers,
              config.security
            );
          }
        } catch (error) {
          return {
            valid: false,
            errors: [{
              field: 'security',
              message: (error as Error).message,
              code: 'SECURITY_VIOLATION',
            }],
          };
        }
      }

      // 3. Schema validation
      if (config.schemas) {
        // Validate body
        if (config.schemas.body && request.body) {
          try {
            const validated = config.schemas.body.parse(sanitized.body || request.body);
            sanitized.body = validated;
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(...this.formatZodErrors(error, 'body'));
            } else {
              errors.push({
                field: 'body',
                message: (error as Error).message,
                code: 'VALIDATION_ERROR',
              });
            }
          }
        }

        // Validate query parameters
        if (config.schemas.query && request.query) {
          try {
            const validated = config.schemas.query.parse(sanitized.query || request.query);
            sanitized.query = validated;
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(...this.formatZodErrors(error, 'query'));
            } else {
              errors.push({
                field: 'query',
                message: (error as Error).message,
                code: 'VALIDATION_ERROR',
              });
            }
          }
        }

        // Validate headers
        if (config.schemas.headers && request.headers) {
          try {
            const validated = config.schemas.headers.parse(sanitized.headers || request.headers);
            sanitized.headers = validated;
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(...this.formatZodErrors(error, 'headers'));
            } else {
              errors.push({
                field: 'headers',
                message: (error as Error).message,
                code: 'VALIDATION_ERROR',
              });
            }
          }
        }

        // Validate path parameters
        if (config.schemas.params) {
          try {
            const params = this.extractPathParams(request.path);
            const validated = config.schemas.params.parse(params);
            sanitized.params = validated;
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(...this.formatZodErrors(error, 'params'));
            } else {
              errors.push({
                field: 'params',
                message: (error as Error).message,
                code: 'VALIDATION_ERROR',
              });
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        sanitized: Object.keys(sanitized).length > 0 ? sanitized : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'unknown',
          message: (error as Error).message,
          code: 'VALIDATION_ERROR',
        }],
      };
    }
  }

  /**
   * Format Zod validation errors
   */
  private formatZodErrors(error: ZodError, prefix: string): ValidationError[] {
    return error.errors.map(err => ({
      field: `${prefix}.${err.path.join('.')}`,
      message: err.message,
      code: err.code,
      value: err.message.includes('Invalid') ? undefined : err,
    }));
  }

  /**
   * Extract path parameters from request path
   */
  private extractPathParams(path: string): Record<string, string> {
    // Simplified - in real implementation, this would use route matching
    const params: Record<string, string> = {};
    const segments = path.split('/').filter(Boolean);

    segments.forEach((segment, index) => {
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = segments[index];
      }
    });

    return params;
  }

  /**
   * Clean up rate limiter
   */
  public cleanup(): void {
    this.rateLimiter.cleanup();
  }
}

// ============================================================================
// Validation Middleware Factory
// ============================================================================

export class ValidationMiddlewareFactory {
  private validator = new RequestValidator();

  /**
   * Create validation middleware with configuration
   */
  public create(config: ValidationConfig) {
    return async (request: APIRequest): Promise<{
      allowed: boolean;
      status?: number;
      message?: string;
      errors?: ValidationError[];
      sanitized?: any;
    }> {
      const result = await this.validator.validate(request, config);

      if (!result.valid) {
        return {
          allowed: false,
          status: result.errors?.[0]?.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 400,
          message: result.errors?.[0]?.message || 'Validation failed',
          errors: result.errors,
        };
      }

      return {
        allowed: true,
        sanitized: result.sanitized,
      };
    };
  }

  /**
   * Get validator instance for manual validation
   */
  public getValidator(): RequestValidator {
    return this.validator;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.validator.cleanup();
  }
}

// ============================================================================
// Pre-built Validation Configs
// ============================================================================

export const ValidationPresets = {
  /**
   * Strict validation with all security checks
   */
  strict: (schemas?: ValidationConfig['schemas']): ValidationConfig => ({
    schemas,
    security: {
      preventXSS: true,
      preventSQLInjection: true,
      preventCommandInjection: true,
      preventPathTraversal: true,
      sanitizeHTML: true,
      maxFieldSize: 1024 * 1024, // 1MB
      maxDepth: 10,
    },
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    },
  }),

  /**
   * Moderate validation with basic security
   */
  moderate: (schemas?: ValidationConfig['schemas']): ValidationConfig => ({
    schemas,
    security: {
      preventXSS: true,
      preventSQLInjection: true,
      sanitizeHTML: true,
      maxFieldSize: 5 * 1024 * 1024, // 5MB
      maxDepth: 20,
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 500,
    },
  }),

  /**
   * Lenient validation with minimal checks
   */
  lenient: (schemas?: ValidationConfig['schemas']): ValidationConfig => ({
    schemas,
    security: {
      preventXSS: true,
      maxFieldSize: 10 * 1024 * 1024, // 10MB
      maxDepth: 50,
    },
  }),

  /**
   * Public API validation
   */
  publicAPI: (schemas?: ValidationConfig['schemas']): ValidationConfig => ({
    schemas,
    security: {
      preventXSS: true,
      preventSQLInjection: true,
      preventCommandInjection: true,
      preventPathTraversal: true,
      sanitizeHTML: true,
      maxFieldSize: 512 * 1024, // 512KB
      maxDepth: 5,
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 50,
      keyGenerator: (req) => req.metadata.apiKey || req.ip,
    },
  }),
};
