"use strict";
/**
 * Comprehensive Error Handling Examples
 * Demonstrates how to use the error handling system in API Gateway
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentError = exports.OrderProcessingError = void 0;
exports.createAPIGatewayWithErrorHandling = createAPIGatewayWithErrorHandling;
exports.registerEndpointWithErrorHandling = registerEndpointWithErrorHandling;
exports.callExternalServiceWithCircuitBreaker = callExternalServiceWithCircuitBreaker;
exports.databaseOperationWithErrorHandling = databaseOperationWithErrorHandling;
exports.registerEndpointWithCustomErrors = registerEndpointWithCustomErrors;
exports.monitorErrorsAndCircuitBreakers = monitorErrorsAndCircuitBreakers;
exports.fetchDataWithFallback = fetchDataWithFallback;
exports.createLoggingMiddleware = createLoggingMiddleware;
exports.registerRateLimitedEndpoint = registerRateLimitedEndpoint;
const APIGateway_1 = require("./APIGateway");
const ErrorHandling_1 = require("./ErrorHandling");
/**
 * Example 1: Basic API Gateway with Error Handling
 */
function createAPIGatewayWithErrorHandling() {
    const gateway = new APIGateway_1.APIGateway(undefined, undefined, undefined, {
        enableErrorHandling: true,
        errorHandlingOptions: {
            timeout: 30000, // 30 second timeout
            retry: {
                maxAttempts: 3,
                initialDelay: 100,
            },
            includeStackTrace: process.env.NODE_ENV === 'development',
            enableCircuitBreaker: true,
            enableRecovery: true,
        },
    });
    return gateway;
}
/**
 * Example 2: Endpoint with Custom Error Handling
 */
function registerEndpointWithErrorHandling(gateway) {
    gateway.registerEndpoint({
        path: '/api/users/:id',
        method: APIGateway_1.HTTPMethod.GET,
        handler: async (request, context) => {
            try {
                const userId = request.params.id;
                // Validate user ID
                if (!userId || userId.length === 0) {
                    throw new ErrorHandling_1.ValidationError('User ID is required', {
                        field: 'id',
                        value: userId,
                    });
                }
                // Simulate database query with error handling
                const user = await gateway.executeWithRetry(async () => {
                    // Database query simulation
                    const result = await queryDatabase(userId);
                    if (!result) {
                        throw new ErrorHandling_1.NotFoundError('User', { userId });
                    }
                    return result;
                }, { maxAttempts: 3, initialDelay: 100 });
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: { user },
                };
            }
            catch (error) {
                // Errors are automatically handled by error middleware
                throw error;
            }
        },
        middleware: [],
        validation: {
            params: {
                type: 'object',
                properties: {
                    id: APIGateway_1.ValidationSchemas.uuid(),
                },
                required: ['id'],
            },
        },
        tags: ['users'],
    });
}
/**
 * Example 3: Using Circuit Breaker for External Service Calls
 */
async function callExternalServiceWithCircuitBreaker(gateway, serviceName, data) {
    try {
        return await gateway.executeWithCircuitBreaker(serviceName, async () => {
            // Call external service
            const response = await fetch(`https://api.example.com/${serviceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new ErrorHandling_1.ExternalServiceError(serviceName, `Service returned status ${response.status}`, { statusCode: response.status });
            }
            return response.json();
        }, {
            failureThreshold: 5,
            resetTimeout: 60000, // 1 minute
        });
    }
    catch (error) {
        if (error instanceof ErrorHandling_1.APIError) {
            // Log and handle appropriately
            console.error(`External service ${serviceName} failed:`, error.message);
        }
        throw error;
    }
}
/**
 * Example 4: Database Operations with Error Handling
 */
async function databaseOperationWithErrorHandling(userId) {
    try {
        return await ErrorHandling_1.RetryHandler.execute(async () => {
            // Simulate database operation
            const result = await performDatabaseOperation(userId);
            return result;
        }, {
            maxAttempts: 3,
            initialDelay: 100,
            maxDelay: 5000,
            backoffMultiplier: 2,
            retryableStatusCodes: [500, 502, 503, 504],
        });
    }
    catch (error) {
        // Convert to DatabaseError for proper handling
        throw new ErrorHandling_1.DatabaseError('Failed to perform database operation', {
            userId,
            originalError: error instanceof Error ? error.message : String(error),
        });
    }
}
/**
 * Example 5: Custom Error Handling in Endpoint
 */
function registerEndpointWithCustomErrors(gateway) {
    gateway.registerEndpoint({
        path: '/api/orders',
        method: APIGateway_1.HTTPMethod.POST,
        handler: async (request, context) => {
            const { productId, quantity } = request.body;
            // Validation
            if (!productId) {
                throw new ErrorHandling_1.ValidationError('Product ID is required', {
                    field: 'productId',
                });
            }
            if (!quantity || quantity <= 0) {
                throw new ErrorHandling_1.ValidationError('Quantity must be greater than 0', {
                    field: 'quantity',
                    value: quantity,
                });
            }
            // Check inventory with circuit breaker
            let inventory;
            try {
                inventory = await gateway.executeWithCircuitBreaker('inventory-service', async () => {
                    return await checkInventory(productId);
                });
            }
            catch (error) {
                throw new ErrorHandling_1.ExternalServiceError('inventory-service', 'Failed to check inventory', { productId });
            }
            // Check stock
            if (inventory.stock < quantity) {
                throw new ErrorHandling_1.ValidationError('Insufficient stock', {
                    field: 'quantity',
                    available: inventory.stock,
                    requested: quantity,
                });
            }
            // Create order with retry
            const order = await gateway.executeWithRetry(async () => {
                return await createOrder({ productId, quantity });
            }, { maxAttempts: 3 });
            return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: { order },
            };
        },
        middleware: [],
        validation: {
            body: {
                type: 'object',
                properties: {
                    productId: APIGateway_1.ValidationSchemas.uuid(),
                    quantity: APIGateway_1.ValidationSchemas.integer(1, 1000),
                },
                required: ['productId', 'quantity'],
            },
        },
        tags: ['orders'],
    });
}
/**
 * Example 6: Monitoring Errors and Circuit Breakers
 */
function monitorErrorsAndCircuitBreakers(gateway) {
    // Get error logs
    const errorLogs = ErrorHandling_1.errorLogger.getLogs({
        severity: 'error',
        limit: 50,
    });
    console.log('Recent errors:', errorLogs);
    // Get error metrics
    const errorMetrics = gateway.getErrorMetrics();
    console.log('Error metrics:', errorMetrics);
    // Get circuit breaker stats
    const circuitBreakerStats = gateway.getCircuitBreakerManager().getAllStats();
    console.log('Circuit breaker stats:', circuitBreakerStats);
    // Check specific service circuit breaker
    const inventoryBreaker = gateway.getCircuitBreakerManager().getBreaker('inventory-service');
    const inventoryStats = inventoryBreaker.getStats();
    if (inventoryStats.state === 'OPEN') {
        console.warn('Inventory service circuit breaker is OPEN!');
        console.log('Next attempt time:', inventoryStats.nextAttemptTime);
    }
}
/**
 * Example 7: Custom Error Classes
 */
class OrderProcessingError extends ErrorHandling_1.APIError {
    constructor(message, orderId, details) {
        super(message, 422, 'ORDER_PROCESSING_ERROR', true, {
            orderId,
            ...details,
        });
    }
}
exports.OrderProcessingError = OrderProcessingError;
class PaymentError extends ErrorHandling_1.APIError {
    constructor(message, details) {
        super(message, 402, 'PAYMENT_REQUIRED', true, details);
    }
}
exports.PaymentError = PaymentError;
/**
 * Example 8: Error Recovery with Fallback
 */
async function fetchDataWithFallback(gateway, dataId) {
    try {
        // Try primary service
        return await gateway.executeWithCircuitBreaker('primary-service', async () => {
            return await fetchFromPrimaryService(dataId);
        });
    }
    catch (primaryError) {
        console.warn('Primary service failed, trying fallback');
        try {
            // Try secondary service
            return await gateway.executeWithCircuitBreaker('secondary-service', async () => {
                return await fetchFromSecondaryService(dataId);
            });
        }
        catch (secondaryError) {
            console.warn('Secondary service failed, using cache');
            // Use cached data as last resort
            const cachedData = await fetchFromCache(dataId);
            if (cachedData) {
                return cachedData;
            }
            // All options exhausted
            throw new ErrorHandling_1.NotFoundError('Data', {
                dataId,
                primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
                secondaryError: secondaryError instanceof Error ? secondaryError.message : String(secondaryError),
            });
        }
    }
}
/**
 * Example 9: Graceful Error Handling in Middleware
 */
function createLoggingMiddleware() {
    return async (request, context, next) => {
        const startTime = Date.now();
        try {
            const response = await next();
            const duration = Date.now() - startTime;
            // Log successful request
            console.log({
                requestId: context.requestId,
                method: request.method,
                path: request.path,
                statusCode: response.statusCode,
                duration,
            });
            return response;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Log error
            console.error({
                requestId: context.requestId,
                method: request.method,
                path: request.path,
                error: error instanceof Error ? error.message : String(error),
                duration,
            });
            // Re-throw for error middleware to handle
            throw error;
        }
    };
}
/**
 * Example 10: Rate Limiting with Custom Error Messages
 */
function registerRateLimitedEndpoint(gateway) {
    gateway.registerEndpoint({
        path: '/api/heavy-operation',
        method: APIGateway_1.HTTPMethod.POST,
        handler: async (request, context) => {
            // Perform heavy operation
            const result = await performHeavyOperation(request.body);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { result },
            };
        },
        middleware: [],
        rateLimit: {
            strategy: 'token_bucket',
            limit: 10,
            window: 60000, // 1 minute
        },
        tags: ['operations'],
    });
}
// Dummy helper functions for examples
async function queryDatabase(userId) {
    return { id: userId, name: 'John Doe' };
}
async function performDatabaseOperation(userId) {
    return { success: true };
}
async function checkInventory(productId) {
    return { productId, stock: 100 };
}
async function createOrder(data) {
    return { id: 'order-123', ...data };
}
async function fetchFromPrimaryService(dataId) {
    return { id: dataId, source: 'primary' };
}
async function fetchFromSecondaryService(dataId) {
    return { id: dataId, source: 'secondary' };
}
async function fetchFromCache(dataId) {
    return null;
}
async function performHeavyOperation(data) {
    return { processed: true };
}
