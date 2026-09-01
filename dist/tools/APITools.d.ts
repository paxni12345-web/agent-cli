/**
 * API & Network Tools - HTTP client, GraphQL, WebSocket support
 * Advanced request handling with retry, caching, and rate limiting
 */
import { Tool } from '../types';
export interface HTTPRequest {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    retries?: number;
    cache?: boolean;
}
export interface HTTPResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    duration: number;
}
/**
 * HTTP Client Tool
 */
export declare const HTTPClientTool: Tool;
/**
 * GraphQL Client Tool
 */
export declare const GraphQLTool: Tool;
/**
 * WebSocket Tool
 */
export declare const WebSocketTool: Tool;
/**
 * API Testing Tool
 */
export declare const APITestTool: Tool;
/**
 * Rate Limiter for API requests
 */
export declare class APIRateLimiter {
    private requests;
    private limits;
    /**
     * Set rate limit for an API
     */
    setLimit(apiKey: string, maxRequests: number, windowMs: number): void;
    /**
     * Check if request is allowed
     */
    isAllowed(apiKey: string): boolean;
    /**
     * Get remaining requests
     */
    getRemaining(apiKey: string): number;
    /**
     * Get time until reset
     */
    getResetTime(apiKey: string): number;
}
/**
 * Request Cache
 */
export declare class RequestCache {
    private cache;
    /**
     * Get cached response
     */
    get(key: string): any | null;
    /**
     * Set cached response
     */
    set(key: string, data: any, ttl?: number): void;
    /**
     * Clear cache
     */
    clear(): void;
    /**
     * Get cache stats
     */
    getStats(): {
        size: number;
        keys: string[];
    };
}
/**
 * Webhook Handler
 */
export declare class WebhookHandler {
    private handlers;
    /**
     * Register webhook handler
     */
    register(event: string, handler: (payload: any) => void): void;
    /**
     * Handle incoming webhook
     */
    handle(event: string, payload: any): Promise<void>;
    /**
     * List registered webhooks
     */
    listWebhooks(): string[];
}
/**
 * Singleton instances
 */
export declare const rateLimiter: APIRateLimiter;
export declare const requestCache: RequestCache;
export declare const webhookHandler: WebhookHandler;
//# sourceMappingURL=APITools.d.ts.map