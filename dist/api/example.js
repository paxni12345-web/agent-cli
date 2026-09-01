"use strict";
/**
 * Example Usage of Production API Gateway
 * Demonstrates how to use the API Gateway with all features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.example1_BasicUsage = example1_BasicUsage;
exports.example2_CreateUser = example2_CreateUser;
exports.example3_ListUsers = example3_ListUsers;
exports.example4_UpdateUser = example4_UpdateUser;
exports.example5_BatchOperations = example5_BatchOperations;
exports.example6_RateLimiting = example6_RateLimiting;
exports.example7_CORSPreflight = example7_CORSPreflight;
exports.example8_CustomEndpoint = example8_CustomEndpoint;
exports.example9_ValidationErrors = example9_ValidationErrors;
exports.example10_APIMetrics = example10_APIMetrics;
exports.example11_OpenAPISpec = example11_OpenAPISpec;
exports.example12_ListEndpoints = example12_ListEndpoints;
exports.example13_CustomMiddleware = example13_CustomMiddleware;
exports.runAllExamples = runAllExamples;
const APIGateway_1 = require("./APIGateway");
const APIGatewaySetup_1 = require("./APIGatewaySetup");
const ProductionHandlers_1 = require("./ProductionHandlers");
/**
 * Example 1: Initialize and use the API Gateway
 */
async function example1_BasicUsage() {
    console.log('\n=== Example 1: Basic Usage ===\n');
    // Initialize the gateway
    const gateway = (0, APIGatewaySetup_1.initializeAPIGateway)();
    // Create a request
    const request = {
        method: APIGateway_1.HTTPMethod.GET,
        path: '/health',
        headers: {
            'Content-Type': 'application/json',
        },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
        userAgent: 'Example Client/1.0',
    };
    // Handle the request
    const response = await gateway.handleRequest(request);
    console.log('Request:', {
        method: request.method,
        path: request.path,
    });
    console.log('Response:', {
        statusCode: response.statusCode,
        body: response.body,
    });
}
/**
 * Example 2: Authenticated request to create a user
 */
async function example2_CreateUser() {
    console.log('\n=== Example 2: Create User (Authenticated) ===\n');
    // First, you would authenticate and get a token
    // For this example, we'll simulate a valid token
    const token = 'simulated_jwt_token';
    const request = {
        method: APIGateway_1.HTTPMethod.POST,
        path: '/api/users',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        query: {},
        params: {},
        body: {
            username: 'john_doe',
            email: 'john.doe@example.com',
            password: 'SecurePassword123!',
            firstName: 'John',
            lastName: 'Doe',
        },
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
    };
    try {
        const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
        console.log('User Creation Response:', {
            statusCode: response.statusCode,
            success: response.body?.success,
            userId: response.body?.data?.id,
        });
    }
    catch (error) {
        console.error('Error creating user:', error);
    }
}
/**
 * Example 3: List users with pagination
 */
async function example3_ListUsers() {
    console.log('\n=== Example 3: List Users with Pagination ===\n');
    const request = {
        method: APIGateway_1.HTTPMethod.GET,
        path: '/api/users',
        headers: {
            'Authorization': 'Bearer simulated_jwt_token',
        },
        query: {
            page: '2',
            limit: '10',
        },
        params: {},
        body: null,
        ip: '192.168.1.100',
    };
    const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
    console.log('Users List Response:', {
        statusCode: response.statusCode,
        userCount: response.body?.data?.length,
        pagination: response.body?.pagination,
    });
}
/**
 * Example 4: Update a user
 */
async function example4_UpdateUser() {
    console.log('\n=== Example 4: Update User ===\n');
    const userId = 'user_1234567890';
    const request = {
        method: APIGateway_1.HTTPMethod.PUT,
        path: `/api/users/${userId}`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer simulated_jwt_token',
        },
        query: {},
        params: {
            userId: userId,
        },
        body: {
            email: 'newemail@example.com',
            firstName: 'John',
            lastName: 'Smith',
        },
        ip: '192.168.1.100',
    };
    const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
    console.log('User Update Response:', {
        statusCode: response.statusCode,
        success: response.body?.success,
        updatedData: response.body?.data,
    });
}
/**
 * Example 5: Batch operations
 */
async function example5_BatchOperations() {
    console.log('\n=== Example 5: Batch Operations ===\n');
    const request = {
        method: APIGateway_1.HTTPMethod.POST,
        path: '/api/batch',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer simulated_jwt_token',
        },
        query: {},
        params: {},
        body: {
            operations: [
                {
                    method: 'GET',
                    path: '/api/users/user_1',
                },
                {
                    method: 'GET',
                    path: '/api/users/user_2',
                },
                {
                    method: 'POST',
                    path: '/api/resources',
                    body: { name: 'New Resource' },
                },
            ],
        },
        ip: '192.168.1.100',
    };
    const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
    console.log('Batch Operation Response:', {
        statusCode: response.statusCode,
        totalOperations: response.body?.total,
        results: response.body?.results?.map((r) => ({
            index: r.index,
            method: r.method,
            statusCode: r.statusCode,
        })),
    });
}
/**
 * Example 6: Rate limiting demonstration
 */
async function example6_RateLimiting() {
    console.log('\n=== Example 6: Rate Limiting ===\n');
    // Make multiple requests to trigger rate limit
    for (let i = 1; i <= 12; i++) {
        const request = {
            method: APIGateway_1.HTTPMethod.GET,
            path: '/health',
            headers: {},
            query: {},
            params: {},
            body: null,
            ip: '192.168.1.200', // Same IP to trigger rate limit
        };
        const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
        console.log(`Request ${i}:`, {
            statusCode: response.statusCode,
            rateLimitRemaining: response.headers['X-RateLimit-Remaining'],
            blocked: response.statusCode === 429,
        });
        if (response.statusCode === 429) {
            console.log('Rate limit exceeded! Message:', response.body?.error);
            break;
        }
    }
}
/**
 * Example 7: CORS preflight request
 */
async function example7_CORSPreflight() {
    console.log('\n=== Example 7: CORS Preflight ===\n');
    const request = {
        method: APIGateway_1.HTTPMethod.OPTIONS,
        path: '/api/users',
        headers: {
            'Origin': 'https://example.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.100',
    };
    const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
    console.log('CORS Preflight Response:', {
        statusCode: response.statusCode,
        allowOrigin: response.headers['Access-Control-Allow-Origin'],
        allowMethods: response.headers['Access-Control-Allow-Methods'],
        allowHeaders: response.headers['Access-Control-Allow-Headers'],
    });
}
/**
 * Example 8: Custom endpoint registration
 */
async function example8_CustomEndpoint() {
    console.log('\n=== Example 8: Custom Endpoint ===\n');
    // Register a custom endpoint
    APIGatewaySetup_1.apiGateway.registerEndpoint({
        path: '/api/custom/hello/:name',
        method: APIGateway_1.HTTPMethod.GET,
        handler: async (request, context) => {
            const name = request.params.name || 'World';
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: {
                    success: true,
                    message: `Hello, ${name}!`,
                    requestId: context.requestId,
                    timestamp: new Date().toISOString(),
                },
            };
        },
        middleware: [],
        rateLimit: ProductionHandlers_1.RateLimitPresets.moderate,
        tags: ['custom', 'example'],
        documentation: {
            summary: 'Custom hello endpoint',
            description: 'Returns a personalized greeting',
            parameters: [
                {
                    name: 'name',
                    in: 'path',
                    description: 'Name to greet',
                    required: true,
                    schema: { type: 'string' },
                },
            ],
            responses: {
                200: {
                    description: 'Greeting response',
                },
            },
        },
    });
    // Test the custom endpoint
    const request = {
        method: APIGateway_1.HTTPMethod.GET,
        path: '/api/custom/hello/Alice',
        headers: {},
        query: {},
        params: {
            name: 'Alice',
        },
        body: null,
        ip: '192.168.1.100',
    };
    const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
    console.log('Custom Endpoint Response:', {
        statusCode: response.statusCode,
        message: response.body?.message,
    });
}
/**
 * Example 9: Validation error handling
 */
async function example9_ValidationErrors() {
    console.log('\n=== Example 9: Validation Error Handling ===\n');
    // Try to create a user with invalid data
    const request = {
        method: APIGateway_1.HTTPMethod.POST,
        path: '/api/users',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer simulated_jwt_token',
        },
        query: {},
        params: {},
        body: {
            username: 'ab', // Too short (min 3)
            email: 'invalid-email', // Invalid format
            password: '123', // Too short (min 8)
        },
        ip: '192.168.1.100',
    };
    const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
    console.log('Validation Error Response:', {
        statusCode: response.statusCode,
        error: response.body?.error,
        details: response.body?.details,
    });
}
/**
 * Example 10: Get API metrics
 */
async function example10_APIMetrics() {
    console.log('\n=== Example 10: API Metrics ===\n');
    // Make some requests to generate metrics
    await example1_BasicUsage();
    await example3_ListUsers();
    // Get metrics
    const metrics = APIGatewaySetup_1.apiGateway.getMetrics();
    console.log('API Metrics:');
    metrics.forEach(metric => {
        console.log(`\nEndpoint: ${metric.method} ${metric.endpoint}`);
        console.log(`  Requests: ${metric.requestCount}`);
        console.log(`  Errors: ${metric.errorCount}`);
        console.log(`  Avg Latency: ${metric.averageLatency.toFixed(2)}ms`);
        console.log(`  P95 Latency: ${metric.p95Latency.toFixed(2)}ms`);
        console.log(`  Status Codes:`, metric.statusCodes);
    });
}
/**
 * Example 11: OpenAPI specification generation
 */
async function example11_OpenAPISpec() {
    console.log('\n=== Example 11: OpenAPI Specification ===\n');
    const spec = APIGatewaySetup_1.apiGateway.generateOpenAPISpec();
    console.log('OpenAPI Specification:');
    console.log(JSON.stringify(spec, null, 2));
}
/**
 * Example 12: List all registered endpoints
 */
async function example12_ListEndpoints() {
    console.log('\n=== Example 12: List Endpoints ===\n');
    const endpoints = APIGatewaySetup_1.apiGateway.listEndpoints();
    console.log(`Total Endpoints: ${endpoints.length}\n`);
    endpoints.forEach(endpoint => {
        console.log(`${endpoint.method} ${endpoint.path}`);
        console.log(`  Tags: ${endpoint.tags.join(', ')}`);
        console.log(`  Auth Required: ${endpoint.authentication?.required || false}`);
        console.log(`  Rate Limited: ${!!endpoint.rateLimit}`);
        console.log(`  Cached: ${endpoint.caching?.enabled || false}`);
        console.log('');
    });
}
/**
 * Example 13: Custom middleware usage
 */
async function example13_CustomMiddleware() {
    console.log('\n=== Example 13: Custom Middleware ===\n');
    // Create a custom middleware for request timing
    const timingMiddleware = ProductionHandlers_1.LoggingMiddleware.create({
        logBody: false,
        logHeaders: false,
    });
    // Register custom endpoint with middleware
    APIGatewaySetup_1.apiGateway.registerEndpoint({
        path: '/api/timed',
        method: APIGateway_1.HTTPMethod.GET,
        handler: async (request, context) => {
            // Simulate some processing
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    success: true,
                    message: 'Timed endpoint',
                },
            };
        },
        middleware: [timingMiddleware],
        tags: ['custom'],
    });
    const request = {
        method: APIGateway_1.HTTPMethod.GET,
        path: '/api/timed',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.100',
    };
    const response = await APIGatewaySetup_1.apiGateway.handleRequest(request);
    console.log('Timed Endpoint Response:', {
        statusCode: response.statusCode,
        message: response.body?.message,
    });
}
/**
 * Run all examples
 */
async function runAllExamples() {
    try {
        await example1_BasicUsage();
        await example2_CreateUser();
        await example3_ListUsers();
        await example4_UpdateUser();
        await example5_BatchOperations();
        await example6_RateLimiting();
        await example7_CORSPreflight();
        await example8_CustomEndpoint();
        await example9_ValidationErrors();
        await example10_APIMetrics();
        await example11_OpenAPISpec();
        await example12_ListEndpoints();
        await example13_CustomMiddleware();
        console.log('\n=== All Examples Completed ===\n');
    }
    catch (error) {
        console.error('Error running examples:', error);
    }
}
// Run examples if executed directly
if (require.main === module) {
    runAllExamples();
}
