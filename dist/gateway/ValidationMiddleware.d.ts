/**
 * COMPREHENSIVE REQUEST VALIDATION MIDDLEWARE
 * Schema-based validation, security checks, and sanitization
 */
import { ZodSchema } from 'zod';
import { APIRequest } from './APIGateway';
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
export declare const CommonSchemas: {
    email: any;
    phone: any;
    url: any;
    uuid: any;
    ipAddress: any;
    isoDate: any;
    alphanumeric: any;
    username: any;
    password: any;
    positiveInt: any;
    nonNegativeInt: any;
    pagination: ZodSchema<{
        page: any;
        limit: any;
    }>;
    searchQuery: any;
    sortOrder: ZodSchema<string>;
    id: any;
};
export declare class SecurityValidator {
    private static readonly XSS_PATTERNS;
    private static readonly SQL_INJECTION_PATTERNS;
    private static readonly COMMAND_INJECTION_PATTERNS;
    private static readonly PATH_TRAVERSAL_PATTERNS;
    /**
     * Detect XSS attack attempts
     */
    static detectXSS(value: any): boolean;
    /**
     * Detect SQL injection attempts
     */
    static detectSQLInjection(value: any): boolean;
    /**
     * Detect command injection attempts
     */
    static detectCommandInjection(value: any): boolean;
    /**
     * Detect path traversal attempts
     */
    static detectPathTraversal(value: any): boolean;
    /**
     * Sanitize HTML content
     */
    static sanitizeHTML(html: string): string;
    /**
     * Escape special characters for SQL
     */
    static escapeSQLString(value: string): string;
    /**
     * Sanitize file path
     */
    static sanitizeFilePath(path: string): string;
    /**
     * Validate and sanitize object recursively
     */
    static sanitizeObject(obj: any, config: SecurityConfig, depth?: number): any;
}
export declare class EndpointRateLimiter {
    private requestCounts;
    /**
     * Check if request is within rate limit
     */
    checkLimit(req: APIRequest, config: EndpointRateLimitConfig): {
        allowed: boolean;
        remaining: number;
        resetTime: number;
    };
    /**
     * Clean up expired entries
     */
    cleanup(): void;
}
export declare class RequestValidator {
    private rateLimiter;
    /**
     * Validate request against configuration
     */
    validate(request: APIRequest, config: ValidationConfig): Promise<ValidationResult>;
    /**
     * Format Zod validation errors
     */
    private formatZodErrors;
    /**
     * Extract path parameters from request path
     */
    private extractPathParams;
    /**
     * Clean up rate limiter
     */
    cleanup(): void;
}
export declare class ValidationMiddlewareFactory {
    private validator;
    /**
     * Create validation middleware with configuration
     */
    create(config: ValidationConfig): (request: APIRequest) => Promise<{
        allowed: boolean;
        status?: number;
        message?: string;
        errors?: ValidationError[];
        sanitized?: any;
    }>;
    /**
     * Get validator instance for manual validation
     */
    getValidator(): RequestValidator;
    /**
     * Cleanup resources
     */
    cleanup(): void;
}
export declare const ValidationPresets: {
    /**
     * Strict validation with all security checks
     */
    strict: (schemas?: ValidationConfig["schemas"]) => ValidationConfig;
    /**
     * Moderate validation with basic security
     */
    moderate: (schemas?: ValidationConfig["schemas"]) => ValidationConfig;
    /**
     * Lenient validation with minimal checks
     */
    lenient: (schemas?: ValidationConfig["schemas"]) => ValidationConfig;
    /**
     * Public API validation
     */
    publicAPI: (schemas?: ValidationConfig["schemas"]) => ValidationConfig;
};
//# sourceMappingURL=ValidationMiddleware.d.ts.map