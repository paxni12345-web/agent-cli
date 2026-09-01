/**
 * Comprehensive Error Handling Examples
 * Demonstrates how to use the error handling system in API Gateway
 */
import { APIGateway, APIRequest, APIResponse, RequestContext } from './APIGateway';
import { APIError } from './ErrorHandling';
/**
 * Example 1: Basic API Gateway with Error Handling
 */
export declare function createAPIGatewayWithErrorHandling(): APIGateway;
/**
 * Example 2: Endpoint with Custom Error Handling
 */
export declare function registerEndpointWithErrorHandling(gateway: APIGateway): void;
/**
 * Example 3: Using Circuit Breaker for External Service Calls
 */
export declare function callExternalServiceWithCircuitBreaker(gateway: APIGateway, serviceName: string, data: any): Promise<any>;
/**
 * Example 4: Database Operations with Error Handling
 */
export declare function databaseOperationWithErrorHandling(userId: string): Promise<any>;
/**
 * Example 5: Custom Error Handling in Endpoint
 */
export declare function registerEndpointWithCustomErrors(gateway: APIGateway): void;
/**
 * Example 6: Monitoring Errors and Circuit Breakers
 */
export declare function monitorErrorsAndCircuitBreakers(gateway: APIGateway): void;
/**
 * Example 7: Custom Error Classes
 */
export declare class OrderProcessingError extends APIError {
    constructor(message: string, orderId?: string, details?: Record<string, any>);
}
export declare class PaymentError extends APIError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * Example 8: Error Recovery with Fallback
 */
export declare function fetchDataWithFallback(gateway: APIGateway, dataId: string): Promise<any>;
/**
 * Example 9: Graceful Error Handling in Middleware
 */
export declare function createLoggingMiddleware(): (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => Promise<APIResponse>;
/**
 * Example 10: Rate Limiting with Custom Error Messages
 */
export declare function registerRateLimitedEndpoint(gateway: APIGateway): void;
//# sourceMappingURL=ErrorHandlingExample.d.ts.map