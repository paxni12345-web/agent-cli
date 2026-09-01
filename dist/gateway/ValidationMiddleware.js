"use strict";
/**
 * COMPREHENSIVE REQUEST VALIDATION MIDDLEWARE
 * Schema-based validation, security checks, and sanitization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationPresets = exports.ValidationMiddlewareFactory = exports.RequestValidator = exports.EndpointRateLimiter = exports.SecurityValidator = exports.CommonSchemas = void 0;
const zod_1 = require("zod");
// ============================================================================
// Built-in Validation Schemas
// ============================================================================
exports.CommonSchemas = {
    // Email validation
    email: zod_1.z.string().email('Invalid email format').min(5).max(254),
    // Phone validation (international format)
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number. Use international format (E.164)'),
    // URL validation
    url: zod_1.z.string().url('Invalid URL format').max(2048),
    // UUID validation
    uuid: zod_1.z.string().uuid('Invalid UUID format'),
    // IP address validation
    ipAddress: zod_1.z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address'),
    // Date validation (ISO 8601)
    isoDate: zod_1.z.string().datetime('Invalid ISO 8601 date format'),
    // Alphanumeric validation
    alphanumeric: zod_1.z.string().regex(/^[a-zA-Z0-9]+$/, 'Must contain only alphanumeric characters'),
    // Username validation
    username: zod_1.z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must not exceed 30 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
    // Password validation
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must not exceed 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    // Positive integer
    positiveInt: zod_1.z.number().int().positive(),
    // Non-negative integer
    nonNegativeInt: zod_1.z.number().int().min(0),
    // Pagination
    pagination: zod_1.z.object({
        page: zod_1.z.number().int().min(1).default(1),
        limit: zod_1.z.number().int().min(1).max(100).default(20),
    }),
    // Search query
    searchQuery: zod_1.z.string().min(1).max(200).trim(),
    // Sort order
    sortOrder: zod_1.z.enum(['asc', 'desc']),
    // ID patterns
    id: zod_1.z.string().min(1).max(64),
};
// ============================================================================
// Security Validators
// ============================================================================
class SecurityValidator {
    static XSS_PATTERNS = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi,
        /eval\s*\(/gi,
    ];
    static SQL_INJECTION_PATTERNS = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
        /--/g,
        /;.*--/g,
        /'\s*(OR|AND)\s*'?\d/gi,
        /'\s*=\s*'/gi,
        /UNION\s+SELECT/gi,
        /xp_cmdshell/gi,
    ];
    static COMMAND_INJECTION_PATTERNS = [
        /[;&|`$(){}[\]<>]/g,
        /\$\(.*?\)/g,
        /`.*?`/g,
        /\|\|/g,
        /&&/g,
    ];
    static PATH_TRAVERSAL_PATTERNS = [
        /\.\./g,
        /\.\.\\|\.\.\/|%2e%2e/gi,
        /\.\.%2f|\.\.%5c/gi,
        /%252e%252e/gi,
    ];
    /**
     * Detect XSS attack attempts
     */
    static detectXSS(value) {
        if (typeof value !== 'string')
            return false;
        return this.XSS_PATTERNS.some(pattern => pattern.test(value));
    }
    /**
     * Detect SQL injection attempts
     */
    static detectSQLInjection(value) {
        if (typeof value !== 'string')
            return false;
        // Check for common SQL injection patterns
        return this.SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
    }
    /**
     * Detect command injection attempts
     */
    static detectCommandInjection(value) {
        if (typeof value !== 'string')
            return false;
        return this.COMMAND_INJECTION_PATTERNS.some(pattern => pattern.test(value));
    }
    /**
     * Detect path traversal attempts
     */
    static detectPathTraversal(value) {
        if (typeof value !== 'string')
            return false;
        return this.PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(value));
    }
    /**
     * Sanitize HTML content
     */
    static sanitizeHTML(html) {
        if (!html || typeof html !== 'string')
            return '';
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
    static escapeSQLString(value) {
        if (!value || typeof value !== 'string')
            return '';
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
    static sanitizeFilePath(path) {
        if (!path || typeof path !== 'string')
            return '';
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
    static sanitizeObject(obj, config, depth = 0) {
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
            const sanitized = {};
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
exports.SecurityValidator = SecurityValidator;
// ============================================================================
// Rate Limiter per Endpoint
// ============================================================================
class EndpointRateLimiter {
    requestCounts = new Map();
    /**
     * Check if request is within rate limit
     */
    checkLimit(req, config) {
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
    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.requestCounts.entries()) {
            if (now >= record.resetTime) {
                this.requestCounts.delete(key);
            }
        }
    }
}
exports.EndpointRateLimiter = EndpointRateLimiter;
// ============================================================================
// Request Validator
// ============================================================================
class RequestValidator {
    rateLimiter = new EndpointRateLimiter();
    /**
     * Validate request against configuration
     */
    async validate(request, config) {
        const errors = [];
        const sanitized = {};
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
                        sanitized.body = SecurityValidator.sanitizeObject(request.body, config.security);
                    }
                    if (request.query) {
                        sanitized.query = SecurityValidator.sanitizeObject(request.query, config.security);
                    }
                    if (request.headers) {
                        sanitized.headers = SecurityValidator.sanitizeObject(request.headers, config.security);
                    }
                }
                catch (error) {
                    return {
                        valid: false,
                        errors: [{
                                field: 'security',
                                message: error.message,
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
                    }
                    catch (error) {
                        if (error instanceof zod_1.ZodError) {
                            errors.push(...this.formatZodErrors(error, 'body'));
                        }
                        else {
                            errors.push({
                                field: 'body',
                                message: error.message,
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
                    }
                    catch (error) {
                        if (error instanceof zod_1.ZodError) {
                            errors.push(...this.formatZodErrors(error, 'query'));
                        }
                        else {
                            errors.push({
                                field: 'query',
                                message: error.message,
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
                    }
                    catch (error) {
                        if (error instanceof zod_1.ZodError) {
                            errors.push(...this.formatZodErrors(error, 'headers'));
                        }
                        else {
                            errors.push({
                                field: 'headers',
                                message: error.message,
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
                    }
                    catch (error) {
                        if (error instanceof zod_1.ZodError) {
                            errors.push(...this.formatZodErrors(error, 'params'));
                        }
                        else {
                            errors.push({
                                field: 'params',
                                message: error.message,
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
        }
        catch (error) {
            return {
                valid: false,
                errors: [{
                        field: 'unknown',
                        message: error.message,
                        code: 'VALIDATION_ERROR',
                    }],
            };
        }
    }
    /**
     * Format Zod validation errors
     */
    formatZodErrors(error, prefix) {
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
    extractPathParams(path) {
        // Simplified - in real implementation, this would use route matching
        const params = {};
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
    cleanup() {
        this.rateLimiter.cleanup();
    }
}
exports.RequestValidator = RequestValidator;
// ============================================================================
// Validation Middleware Factory
// ============================================================================
class ValidationMiddlewareFactory {
    validator = new RequestValidator();
    /**
     * Create validation middleware with configuration
     */
    create(config) {
        return async (request) => {
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
    getValidator() {
        return this.validator;
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        this.validator.cleanup();
    }
}
exports.ValidationMiddlewareFactory = ValidationMiddlewareFactory;
// ============================================================================
// Pre-built Validation Configs
// ============================================================================
exports.ValidationPresets = {
    /**
     * Strict validation with all security checks
     */
    strict: (schemas) => ({
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
    moderate: (schemas) => ({
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
    lenient: (schemas) => ({
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
    publicAPI: (schemas) => ({
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
