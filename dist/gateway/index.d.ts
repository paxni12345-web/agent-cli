/**
 * VALIDATION MIDDLEWARE EXPORTS
 * Central export point for all validation components
 */
export { ValidationMiddlewareFactory, RequestValidator, SecurityValidator, EndpointRateLimiter, } from './ValidationMiddleware';
export type { ValidationConfig, SecurityConfig, EndpointRateLimitConfig, ValidationResult, ValidationError, } from './ValidationMiddleware';
export { CommonSchemas, ValidationPresets, } from './ValidationMiddleware';
export { createUserRegistrationRoute, createProductSearchRoute, createFileUploadRoute, createAdminUpdateRoute, createCommentSubmissionRoute, createWebhookRoute, createOrderCreationRoute, initializeGatewayWithExamples, } from './ValidationExamples';
export { APIGatewayManager, } from './APIGateway';
export type { GatewayConfig, APIRoute, HttpMethod, Backend, Middleware, MiddlewareType, APIRequest, APIResponse, RateLimitConfig, CacheConfig, AuthConfig, } from './APIGateway';
//# sourceMappingURL=index.d.ts.map