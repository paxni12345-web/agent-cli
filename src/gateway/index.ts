/**
 * VALIDATION MIDDLEWARE EXPORTS
 * Central export point for all validation components
 */

// Core validation middleware
export {
  ValidationMiddlewareFactory,
  RequestValidator,
  SecurityValidator,
  EndpointRateLimiter,
} from './ValidationMiddleware';

// Types and interfaces
export type {
  ValidationConfig,
  SecurityConfig,
  EndpointRateLimitConfig,
  ValidationResult,
  ValidationError,
} from './ValidationMiddleware';

// Common schemas and presets
export {
  CommonSchemas,
  ValidationPresets,
} from './ValidationMiddleware';

// Example implementations
export {
  createUserRegistrationRoute,
  createProductSearchRoute,
  createFileUploadRoute,
  createAdminUpdateRoute,
  createCommentSubmissionRoute,
  createWebhookRoute,
  createOrderCreationRoute,
  initializeGatewayWithExamples,
} from './ValidationExamples';

// API Gateway exports
export {
  APIGatewayManager,
} from './APIGateway';

export type {
  GatewayConfig,
  APIRoute,
  HttpMethod,
  Backend,
  Middleware,
  MiddlewareType,
  APIRequest,
  APIResponse,
  RateLimitConfig,
  CacheConfig,
  AuthConfig,
} from './APIGateway';
