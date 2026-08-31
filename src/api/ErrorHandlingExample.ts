/**
 * Comprehensive Error Handling Examples
 * Demonstrates how to use the error handling system in API Gateway
 */

import {
  APIGateway,
  APIRequest,
  APIResponse,
  RequestContext,
  HTTPMethod,
  ValidationSchemas,
} from './APIGateway';
import {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  errorLogger,
  circuitBreakerManager,
  RetryHandler,
} from './ErrorHandling';
import {
  ErrorMiddlewareStack,
  errorMetricsCollector,
} from './ErrorMiddleware';

/**
 * Example 1: Basic API Gateway with Error Handling
 */
export function createAPIGatewayWithErrorHandling(): APIGateway {
  const gateway = new APIGateway(undefined, undefined, undefined, {
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
export function registerEndpointWithErrorHandling(gateway: APIGateway): void {
  gateway.registerEndpoint({
    path: '/api/users/:id',
    method: HTTPMethod.GET,
    handler: async (request: APIRequest, context: RequestContext): Promise<APIResponse> => {
      try {
        const userId = request.params.id;

        // Validate user ID
        if (!userId || userId.length === 0) {
          throw new ValidationError('User ID is required', {
            field: 'id',
            value: userId,
          });
        }

        // Simulate database query with error handling
        const user = await gateway.executeWithRetry(
          async () => {
            // Database query simulation
            const result = await queryDatabase(userId);

            if (!result) {
              throw new NotFoundError('User', { userId });
            }

            return result;
          },
          { maxAttempts: 3, initialDelay: 100 }
        );

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { user },
        };
      } catch (error) {
        // Errors are automatically handled by error middleware
        throw error;
      }
    },
    middleware: [],
    validation: {
      params: {
        type: 'object',
        properties: {
          id: ValidationSchemas.uuid(),
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
export async function callExternalServiceWithCircuitBreaker(
  gateway: APIGateway,
  serviceName: string,
  data: any
): Promise<any> {
  try {
    return await gateway.executeWithCircuitBreaker(
      serviceName,
      async () => {
        // Call external service
        const response = await fetch(`https://api.example.com/${serviceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new ExternalServiceError(
            serviceName,
            `Service returned status ${response.status}`,
            { statusCode: response.status }
          );
        }

        return response.json();
      },
      {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
      }
    );
  } catch (error) {
    if (error instanceof APIError) {
      // Log and handle appropriately
      console.error(`External service ${serviceName} failed:`, error.message);
    }
    throw error;
  }
}

/**
 * Example 4: Database Operations with Error Handling
 */
export async function databaseOperationWithErrorHandling(userId: string): Promise<any> {
  try {
    return await RetryHandler.execute(
      async () => {
        // Simulate database operation
        const result = await performDatabaseOperation(userId);
        return result;
      },
      {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        retryableStatusCodes: [500, 502, 503, 504],
      }
    );
  } catch (error) {
    // Convert to DatabaseError for proper handling
    throw new DatabaseError('Failed to perform database operation', {
      userId,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Example 5: Custom Error Handling in Endpoint
 */
export function registerEndpointWithCustomErrors(gateway: APIGateway): void {
  gateway.registerEndpoint({
    path: '/api/orders',
    method: HTTPMethod.POST,
    handler: async (request: APIRequest, context: RequestContext): Promise<APIResponse> => {
      const { productId, quantity } = request.body;

      // Validation
      if (!productId) {
        throw new ValidationError('Product ID is required', {
          field: 'productId',
        });
      }

      if (!quantity || quantity <= 0) {
        throw new ValidationError('Quantity must be greater than 0', {
          field: 'quantity',
          value: quantity,
        });
      }

      // Check inventory with circuit breaker
      let inventory;
      try {
        inventory = await gateway.executeWithCircuitBreaker(
          'inventory-service',
          async () => {
            return await checkInventory(productId);
          }
        );
      } catch (error) {
        throw new ExternalServiceError(
          'inventory-service',
          'Failed to check inventory',
          { productId }
        );
      }

      // Check stock
      if (inventory.stock < quantity) {
        throw new ValidationError('Insufficient stock', {
          field: 'quantity',
          available: inventory.stock,
          requested: quantity,
        });
      }

      // Create order with retry
      const order = await gateway.executeWithRetry(
        async () => {
          return await createOrder({ productId, quantity });
        },
        { maxAttempts: 3 }
      );

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
          productId: ValidationSchemas.uuid(),
          quantity: ValidationSchemas.integer(1, 1000),
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
export function monitorErrorsAndCircuitBreakers(gateway: APIGateway): void {
  // Get error logs
  const errorLogs = errorLogger.getLogs({
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
export class OrderProcessingError extends APIError {
  constructor(message: string, orderId?: string, details?: Record<string, any>) {
    super(message, 422, 'ORDER_PROCESSING_ERROR', true, {
      orderId,
      ...details,
    });
  }
}

export class PaymentError extends APIError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 402, 'PAYMENT_REQUIRED', true, details);
  }
}

/**
 * Example 8: Error Recovery with Fallback
 */
export async function fetchDataWithFallback(
  gateway: APIGateway,
  dataId: string
): Promise<any> {
  try {
    // Try primary service
    return await gateway.executeWithCircuitBreaker(
      'primary-service',
      async () => {
        return await fetchFromPrimaryService(dataId);
      }
    );
  } catch (primaryError) {
    console.warn('Primary service failed, trying fallback');

    try {
      // Try secondary service
      return await gateway.executeWithCircuitBreaker(
        'secondary-service',
        async () => {
          return await fetchFromSecondaryService(dataId);
        }
      );
    } catch (secondaryError) {
      console.warn('Secondary service failed, using cache');

      // Use cached data as last resort
      const cachedData = await fetchFromCache(dataId);

      if (cachedData) {
        return cachedData;
      }

      // All options exhausted
      throw new NotFoundError('Data', {
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
export function createLoggingMiddleware() {
  return async (
    request: APIRequest,
    context: RequestContext,
    next: () => Promise<APIResponse>
  ): Promise<APIResponse> => {
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
    } catch (error) {
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
export function registerRateLimitedEndpoint(gateway: APIGateway): void {
  gateway.registerEndpoint({
    path: '/api/heavy-operation',
    method: HTTPMethod.POST,
    handler: async (request: APIRequest, context: RequestContext): Promise<APIResponse> => {
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
      strategy: 'token_bucket' as any,
      limit: 10,
      window: 60000, // 1 minute
    },
    tags: ['operations'],
  });
}

// Dummy helper functions for examples
async function queryDatabase(userId: string): Promise<any> {
  return { id: userId, name: 'John Doe' };
}

async function performDatabaseOperation(userId: string): Promise<any> {
  return { success: true };
}

async function checkInventory(productId: string): Promise<any> {
  return { productId, stock: 100 };
}

async function createOrder(data: any): Promise<any> {
  return { id: 'order-123', ...data };
}

async function fetchFromPrimaryService(dataId: string): Promise<any> {
  return { id: dataId, source: 'primary' };
}

async function fetchFromSecondaryService(dataId: string): Promise<any> {
  return { id: dataId, source: 'secondary' };
}

async function fetchFromCache(dataId: string): Promise<any> {
  return null;
}

async function performHeavyOperation(data: any): Promise<any> {
  return { processed: true };
}
