/**
 * Production-Ready API Request Handlers
 * Implements comprehensive request handling with all production features
 */
import { APIRequest, APIResponse, RequestContext, Middleware, HTTPMethod, ValidationConfig, RateLimitConfig } from './APIGateway';
/**
 * Compression utilities
 */
export declare class ResponseCompression {
    /**
     * Check if response should be compressed
     */
    static shouldCompress(request: APIRequest, body: any): boolean;
    /**
     * Compress response body (simulated - in real implementation would use zlib)
     */
    static compress(body: any): {
        compressed: string;
        encoding: string;
    };
}
/**
 * CORS Configuration
 */
export interface CORSConfig {
    origins: string[] | '*';
    methods: HTTPMethod[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
}
export declare const defaultCORSConfig: CORSConfig;
/**
 * CORS Middleware Factory
 */
export declare class CORSMiddleware {
    static create(config?: CORSConfig): Middleware;
    private static getCORSHeaders;
}
/**
 * Security Headers Middleware
 */
export declare class SecurityHeadersMiddleware {
    static create(): Middleware;
}
/**
 * Request/Response Logging Middleware
 */
export declare class LoggingMiddleware {
    static create(options?: {
        logBody?: boolean;
        logHeaders?: boolean;
    }): Middleware;
    private static logRequest;
    private static logResponse;
    private static logError;
    private static sanitizeHeaders;
    private static sanitizeBody;
}
/**
 * Response Compression Middleware
 */
export declare class CompressionMiddleware {
    static create(minSize?: number): Middleware;
}
/**
 * Request ID Middleware
 */
export declare class RequestIDMiddleware {
    static create(): Middleware;
}
/**
 * Error Handler Middleware
 */
export declare class ErrorHandlerMiddleware {
    static create(options?: {
        includeStack?: boolean;
    }): Middleware;
    private static handleError;
}
/**
 * Production API Handlers
 */
export declare class ProductionHandlers {
    /**
     * Health Check Handler
     */
    static healthCheck(request: APIRequest, context: RequestContext): Promise<APIResponse>;
    /**
     * Create User Handler
     */
    static createUser(request: APIRequest, context: RequestContext): Promise<APIResponse>;
    /**
     * Get User Handler
     */
    static getUser(request: APIRequest, context: RequestContext): Promise<APIResponse>;
    /**
     * Update User Handler
     */
    static updateUser(request: APIRequest, context: RequestContext): Promise<APIResponse>;
    /**
     * Delete User Handler
     */
    static deleteUser(request: APIRequest, context: RequestContext): Promise<APIResponse>;
    /**
     * List Users Handler
     */
    static listUsers(request: APIRequest, context: RequestContext): Promise<APIResponse>;
    /**
     * Create Resource Handler (Generic)
     */
    static createResource(request: APIRequest, context: RequestContext): Promise<APIResponse>;
    /**
     * Batch Operation Handler
     */
    static batchOperation(request: APIRequest, context: RequestContext): Promise<APIResponse>;
}
/**
 * Production Middleware Stack
 * Combines all middleware in the correct order
 */
export declare function createProductionMiddlewareStack(config?: {
    cors?: CORSConfig;
    rateLimit?: RateLimitConfig;
    logging?: {
        logBody?: boolean;
        logHeaders?: boolean;
    };
}): Middleware[];
/**
 * Default rate limit configurations
 */
export declare const RateLimitPresets: {
    strict: RateLimitConfig;
    moderate: RateLimitConfig;
    permissive: RateLimitConfig;
};
/**
 * Validation configurations for common endpoints
 */
export declare const ValidationConfigs: {
    createUser: ValidationConfig;
    updateUser: ValidationConfig;
    listUsers: ValidationConfig;
};
//# sourceMappingURL=ProductionHandlers.d.ts.map