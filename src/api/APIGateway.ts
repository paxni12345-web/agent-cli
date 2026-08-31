/**
 * API Gateway and Rate Limiting
 * API management, rate limiting, throttling, quota management, and API analytics
 */

import { eventBus } from '../core/EventBus';
import {
  AuthenticationSystem,
  RBACSystem,
  AuditLogger,
  User,
  AccessRequest
} from '../security/MEGA_SecurityAuthentication';
import { z } from 'zod';
import validator from 'validator';
import xss from 'xss';
import {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
  errorLogger,
  ErrorContext,
  circuitBreakerManager,
  RetryHandler,
  CircuitBreaker,
} from './ErrorHandling';
import {
  ErrorHandlerMiddleware,
  ErrorMiddlewareStack,
  errorMetricsCollector,
} from './ErrorMiddleware';

export interface APIEndpoint {
  id: string;
  path: string;
  method: HTTPMethod;
  handler: EndpointHandler;
  middleware: Middleware[];
  rateLimit?: RateLimitConfig;
  authentication?: AuthenticationConfig;
  authorization?: AuthorizationConfig;
  validation?: ValidationConfig;
  caching?: CachingConfig;
  documentation?: EndpointDocumentation;
  tags: string[];
}

export enum HTTPMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}

export type EndpointHandler = (request: APIRequest, context: RequestContext) => Promise<APIResponse>;
export type Middleware = (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => Promise<APIResponse>;

export interface APIRequest {
  method: HTTPMethod;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
  body: any;
  ip: string;
  userAgent?: string;
}

export interface APIResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
  metadata: Record<string, any>;
}

export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  limit: number;
  window: number; // milliseconds
  burst?: number;
  keyGenerator?: (request: APIRequest) => string;
}

export enum RateLimitStrategy {
  FixedWindow = 'fixed_window',
  SlidingWindow = 'sliding_window',
  TokenBucket = 'token_bucket',
  LeakyBucket = 'leaky_bucket',
}

export interface AuthenticationConfig {
  type: 'bearer' | 'basic' | 'api_key' | 'oauth';
  required: boolean;
  schemes?: string[];
}

export interface AuthorizationConfig {
  roles?: string[];
  permissions?: string[];
  custom?: (request: APIRequest, context: RequestContext) => Promise<boolean>;
}

export interface ValidationConfig {
  body?: ValidationSchema;
  query?: ValidationSchema;
  params?: ValidationSchema;
  headers?: ValidationSchema;
}

export interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, ValidationSchema>;
  required?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: 'email' | 'url' | 'phone' | 'uuid' | 'ip' | 'date' | 'json';
  items?: ValidationSchema;
  enum?: any[];
  zodSchema?: z.ZodSchema;
}

export interface CachingConfig {
  enabled: boolean;
  ttl: number;
  keyGenerator?: (request: APIRequest) => string;
  vary?: string[];
}

export interface EndpointDocumentation {
  summary: string;
  description?: string;
  parameters?: ParameterDocumentation[];
  requestBody?: RequestBodyDocumentation;
  responses: Record<number, ResponseDocumentation>;
  examples?: ExampleDocumentation[];
}

export interface ParameterDocumentation {
  name: string;
  in: 'path' | 'query' | 'header';
  description?: string;
  required: boolean;
  schema: ValidationSchema;
}

export interface RequestBodyDocumentation {
  description?: string;
  required: boolean;
  schema: ValidationSchema;
}

export interface ResponseDocumentation {
  description: string;
  schema?: ValidationSchema;
}

export interface ExampleDocumentation {
  name: string;
  request: Partial<APIRequest>;
  response: APIResponse;
}

export interface RateLimitState {
  key: string;
  count: number;
  resetAt: Date;
  tokens?: number;
}

export interface APIMetrics {
  endpoint: string;
  method: HTTPMethod;
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  statusCodes: Record<number, number>;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface SanitizationConfig {
  allowHTML?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}

/**
 * Input Sanitizer - Prevents XSS, SQL Injection, Command Injection, Path Traversal
 */
export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS attacks
   */
  static sanitizeHTML(input: string, config?: SanitizationConfig): string {
    if (!config?.allowHTML) {
      // Strip all HTML tags if not explicitly allowed
      return xss(input, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style'],
      });
    }

    // Allow specific tags if configured
    const whiteList: Record<string, string[]> = {};
    if (config.allowedTags && config.allowedAttributes) {
      config.allowedTags.forEach(tag => {
        whiteList[tag] = config.allowedAttributes![tag] || [];
      });
    }

    return xss(input, {
      whiteList,
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    });
  }

  /**
   * Prevent SQL injection by escaping dangerous characters
   */
  static sanitizeSQL(input: string): string {
    // Escape single quotes, double quotes, backslashes, and null bytes
    return input
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''")
      .replace(/"/g, '\\"')
      .replace(/\x00/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * Prevent command injection by removing dangerous shell characters
   */
  static sanitizeCommand(input: string): string {
    // Remove or escape shell metacharacters
    const dangerous = /[;&|`$(){}[\]<>!\n\r]/g;
    return input.replace(dangerous, '');
  }

  /**
   * Prevent path traversal attacks
   */
  static sanitizePath(input: string): string {
    // Remove path traversal sequences
    let sanitized = input
      .replace(/\.\./g, '')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '');

    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, '');

    // Ensure no absolute paths
    if (sanitized.startsWith('/')) {
      sanitized = sanitized.substring(1);
    }

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(obj: any, config?: SanitizationConfig): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeHTML(obj, config);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, config));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = this.sanitizeObject(obj[key], config);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate and sanitize email
   */
  static sanitizeEmail(email: string): string | null {
    const trimmed = email.trim().toLowerCase();
    return validator.isEmail(trimmed) ? trimmed : null;
  }

  /**
   * Validate and sanitize URL
   */
  static sanitizeURL(url: string): string | null {
    const trimmed = url.trim();
    return validator.isURL(trimmed, {
      protocols: ['http', 'https'],
      require_protocol: true,
    }) ? trimmed : null;
  }
}

/**
 * Request Validator - Comprehensive validation with Zod schemas
 */
export class RequestValidator {
  /**
   * Validate request against validation config
   */
  static validate(request: APIRequest, config: ValidationConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate body
    if (config.body) {
      const bodyErrors = this.validateValue(request.body, config.body, 'body');
      errors.push(...bodyErrors);
    }

    // Validate query parameters
    if (config.query) {
      const queryErrors = this.validateValue(request.query, config.query, 'query');
      errors.push(...queryErrors);
    }

    // Validate path parameters
    if (config.params) {
      const paramsErrors = this.validateValue(request.params, config.params, 'params');
      errors.push(...paramsErrors);
    }

    // Validate headers
    if (config.headers) {
      const headersErrors = this.validateValue(request.headers, config.headers, 'headers');
      errors.push(...headersErrors);
    }

    return errors;
  }

  /**
   * Validate value against schema
   */
  private static validateValue(
    value: any,
    schema: ValidationSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Use Zod schema if provided
    if (schema.zodSchema) {
      try {
        schema.zodSchema.parse(value);
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach(err => {
            errors.push({
              field: `${path}.${err.path.join('.')}`,
              message: err.message,
              value: err.code,
            });
          });
        }
      }
      return errors;
    }

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push({
        field: path,
        message: `Expected type ${schema.type}, got ${typeof value}`,
        value,
      });
      return errors;
    }

    // Type-specific validation
    switch (schema.type) {
      case 'string':
        errors.push(...this.validateString(value, schema, path));
        break;

      case 'number':
        errors.push(...this.validateNumber(value, schema, path));
        break;

      case 'array':
        errors.push(...this.validateArray(value, schema, path));
        break;

      case 'object':
        errors.push(...this.validateObject(value, schema, path));
        break;
    }

    return errors;
  }

  /**
   * Validate type
   */
  private static validateType(value: any, type: string): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Validate string
   */
  private static validateString(
    value: string,
    schema: ValidationSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Length validation
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        field: path,
        message: `String length must be at least ${schema.minLength}`,
        value: value.length,
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field: path,
        message: `String length must be at most ${schema.maxLength}`,
        value: value.length,
      });
    }

    // Pattern validation
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: path,
          message: `String does not match pattern ${schema.pattern}`,
          value,
        });
      }
    }

    // Format validation
    if (schema.format) {
      const formatError = this.validateFormat(value, schema.format, path);
      if (formatError) {
        errors.push(formatError);
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value,
      });
    }

    return errors;
  }

  /**
   * Validate number
   */
  private static validateNumber(
    value: number,
    schema: ValidationSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Range validation
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        field: path,
        message: `Number must be at least ${schema.minimum}`,
        value,
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        field: path,
        message: `Number must be at most ${schema.maximum}`,
        value,
      });
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value,
      });
    }

    return errors;
  }

  /**
   * Validate array
   */
  private static validateArray(
    value: any[],
    schema: ValidationSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Length validation
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        field: path,
        message: `Array length must be at least ${schema.minLength}`,
        value: value.length,
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field: path,
        message: `Array length must be at most ${schema.maxLength}`,
        value: value.length,
      });
    }

    // Validate items
    if (schema.items) {
      value.forEach((item, index) => {
        const itemErrors = this.validateValue(item, schema.items!, `${path}[${index}]`);
        errors.push(...itemErrors);
      });
    }

    return errors;
  }

  /**
   * Validate object
   */
  private static validateObject(
    value: Record<string, any>,
    schema: ValidationSchema,
    path: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check required properties
    if (schema.required) {
      schema.required.forEach(prop => {
        if (!(prop in value) || value[prop] === undefined || value[prop] === null) {
          errors.push({
            field: `${path}.${prop}`,
            message: `Required property ${prop} is missing`,
          });
        }
      });
    }

    // Validate properties
    if (schema.properties) {
      Object.keys(schema.properties).forEach(prop => {
        if (prop in value && value[prop] !== undefined) {
          const propErrors = this.validateValue(
            value[prop],
            schema.properties![prop],
            `${path}.${prop}`
          );
          errors.push(...propErrors);
        }
      });
    }

    return errors;
  }

  /**
   * Validate format
   */
  private static validateFormat(
    value: string,
    format: string,
    path: string
  ): ValidationError | null {
    switch (format) {
      case 'email':
        if (!validator.isEmail(value)) {
          return {
            field: path,
            message: 'Invalid email format',
            value,
          };
        }
        break;

      case 'url':
        if (!validator.isURL(value, { protocols: ['http', 'https'], require_protocol: true })) {
          return {
            field: path,
            message: 'Invalid URL format',
            value,
          };
        }
        break;

      case 'phone':
        if (!validator.isMobilePhone(value, 'any', { strictMode: false })) {
          return {
            field: path,
            message: 'Invalid phone number format',
            value,
          };
        }
        break;

      case 'uuid':
        if (!validator.isUUID(value)) {
          return {
            field: path,
            message: 'Invalid UUID format',
            value,
          };
        }
        break;

      case 'ip':
        if (!validator.isIP(value)) {
          return {
            field: path,
            message: 'Invalid IP address format',
            value,
          };
        }
        break;

      case 'date':
        if (!validator.isISO8601(value)) {
          return {
            field: path,
            message: 'Invalid ISO 8601 date format',
            value,
          };
        }
        break;

      case 'json':
        try {
          JSON.parse(value);
        } catch {
          return {
            field: path,
            message: 'Invalid JSON format',
            value,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Create Zod schema from ValidationSchema
   */
  static createZodSchema(schema: ValidationSchema): z.ZodSchema {
    switch (schema.type) {
      case 'string':
        let stringSchema = z.string();

        if (schema.minLength !== undefined) {
          stringSchema = stringSchema.min(schema.minLength);
        }
        if (schema.maxLength !== undefined) {
          stringSchema = stringSchema.max(schema.maxLength);
        }
        if (schema.pattern) {
          stringSchema = stringSchema.regex(new RegExp(schema.pattern));
        }
        if (schema.format === 'email') {
          stringSchema = stringSchema.email();
        }
        if (schema.format === 'url') {
          stringSchema = stringSchema.url();
        }
        if (schema.format === 'uuid') {
          stringSchema = stringSchema.uuid();
        }
        if (schema.enum) {
          return z.enum(schema.enum as [string, ...string[]]);
        }

        return stringSchema;

      case 'number':
        let numberSchema = z.number();

        if (schema.minimum !== undefined) {
          numberSchema = numberSchema.min(schema.minimum);
        }
        if (schema.maximum !== undefined) {
          numberSchema = numberSchema.max(schema.maximum);
        }
        if (schema.enum) {
          return z.enum(schema.enum.map(String) as [string, ...string[]]).transform(Number);
        }

        return numberSchema;

      case 'boolean':
        return z.boolean();

      case 'array':
        if (schema.items) {
          let arraySchema = z.array(this.createZodSchema(schema.items));

          if (schema.minLength !== undefined) {
            arraySchema = arraySchema.min(schema.minLength);
          }
          if (schema.maxLength !== undefined) {
            arraySchema = arraySchema.max(schema.maxLength);
          }

          return arraySchema;
        }
        return z.array(z.any());

      case 'object':
        if (schema.properties) {
          const shape: Record<string, z.ZodSchema> = {};

          Object.keys(schema.properties).forEach(key => {
            let propSchema = this.createZodSchema(schema.properties![key]);

            // Make optional if not required
            if (!schema.required?.includes(key)) {
              propSchema = propSchema.optional();
            }

            shape[key] = propSchema;
          });

          return z.object(shape);
        }
        return z.record(z.any());

      default:
        return z.any();
    }
  }
}

export interface QuotaConfig {
  userId: string;
  limit: number;
  period: 'hour' | 'day' | 'month';
  used: number;
  resetAt: Date;
}

/**
 * API Gateway
 */
export class APIGateway {
  private endpoints: Map<string, APIEndpoint> = new Map();
  private rateLimiter: RateLimiter;
  private cache: APICache;
  private metrics: MetricsCollector;
  private globalMiddleware: Middleware[] = [];
  private authSystem: AuthenticationSystem;
  private rbacSystem: RBACSystem;
  private auditLogger: AuditLogger;
  private errorHandler: ErrorHandlerMiddleware;
  private circuitBreakerManager = circuitBreakerManager;

  constructor(
    authSystem?: AuthenticationSystem,
    rbacSystem?: RBACSystem,
    auditLogger?: AuditLogger,
    options?: {
      enableErrorHandling?: boolean;
      errorHandlingOptions?: {
        timeout?: number;
        retry?: { maxAttempts?: number; initialDelay?: number };
        includeStackTrace?: boolean;
        enableCircuitBreaker?: boolean;
        enableRecovery?: boolean;
      };
    }
  ) {
    this.rateLimiter = new RateLimiter();
    this.cache = new APICache();
    this.metrics = new MetricsCollector();
    this.authSystem = authSystem || new AuthenticationSystem();
    this.rbacSystem = rbacSystem || new RBACSystem();
    this.auditLogger = auditLogger || new AuditLogger();
    this.errorHandler = new ErrorHandlerMiddleware({
      includeStackTrace: options?.errorHandlingOptions?.includeStackTrace,
    });

    // Add comprehensive error handling middleware by default
    if (options?.enableErrorHandling !== false) {
      const errorMiddleware = ErrorMiddlewareStack.create(options?.errorHandlingOptions || {});
      errorMiddleware.forEach(mw => this.globalMiddleware.push(mw));
    }
  }

  /**
   * Register endpoint
   */
  registerEndpoint(endpoint: Omit<APIEndpoint, 'id'>): APIEndpoint {
    const fullEndpoint: APIEndpoint = {
      ...endpoint,
      id: this.generateEndpointId(endpoint.method, endpoint.path),
    };

    this.endpoints.set(fullEndpoint.id, fullEndpoint);

    eventBus.emitSync('api.endpoint_registered', fullEndpoint, 'APIGateway');

    return fullEndpoint;
  }

  /**
   * Remove endpoint
   */
  removeEndpoint(endpointId: string): void {
    this.endpoints.delete(endpointId);
    eventBus.emitSync('api.endpoint_removed', { endpointId }, 'APIGateway');
  }

  /**
   * Handle request with comprehensive error handling
   */
  async handleRequest(request: APIRequest): Promise<APIResponse> {
    const context: RequestContext = {
      requestId: this.generateRequestId(),
      startTime: Date.now(),
      metadata: {},
    };

    eventBus.emitSync('api.request_received', { request, context }, 'APIGateway');

    try {
      // Find matching endpoint
      const endpoint = this.findEndpoint(request.method, request.path);

      if (!endpoint) {
        throw new NotFoundError('Endpoint', { path: request.path, method: request.method });
      }

      // Extract path parameters
      request.params = this.extractParams(endpoint.path, request.path);

      // Check rate limit
      if (endpoint.rateLimit) {
        const rateLimitKey = endpoint.rateLimit.keyGenerator
          ? endpoint.rateLimit.keyGenerator(request)
          : this.defaultRateLimitKey(request);

        const allowed = await this.rateLimiter.checkLimit(rateLimitKey, endpoint.rateLimit);

        if (!allowed) {
          const state = this.rateLimiter.getState(rateLimitKey);
          throw new RateLimitError('Rate limit exceeded', state?.resetAt, {
            limit: endpoint.rateLimit.limit,
            window: endpoint.rateLimit.window,
          });
        }
      }

      // Check cache
      if (endpoint.caching?.enabled && request.method === HTTPMethod.GET) {
        const cacheKey = endpoint.caching.keyGenerator
          ? endpoint.caching.keyGenerator(request)
          : this.defaultCacheKey(request);

        const cached = await this.cache.get(cacheKey);

        if (cached) {
          return cached;
        }
      }

      // Validate request
      if (endpoint.validation) {
        const errors = RequestValidator.validate(request, endpoint.validation);

        if (errors.length > 0) {
          throw new ValidationError('Request validation failed', {
            errors: errors.map(err => ({
              field: err.field,
              message: err.message,
              value: err.value,
            })),
          });
        }
      }

      // Sanitize request inputs to prevent injection attacks
      request.body = InputSanitizer.sanitizeObject(request.body);
      request.query = InputSanitizer.sanitizeObject(request.query);
      request.params = InputSanitizer.sanitizeObject(request.params);

      // Authenticate
      if (endpoint.authentication?.required) {
        const authenticated = await this.authenticate(request, endpoint.authentication);

        if (!authenticated) {
          throw new AuthenticationError('Authentication required', {
            path: request.path,
            method: request.method,
          });
        }

        // Set userId in context from authenticated user
        const user = (request as any).user as User;
        if (user) {
          context.userId = user.id;
        }
      }

      // Authorize
      if (endpoint.authorization) {
        const authorized = await this.authorize(request, context, endpoint.authorization);

        if (!authorized) {
          throw new AuthorizationError('Insufficient permissions', {
            path: request.path,
            method: request.method,
            userId: context.userId,
          });
        }
      }

      // Execute middleware chain
      const handler = this.buildMiddlewareChain(
        [...this.globalMiddleware, ...endpoint.middleware],
        endpoint.handler
      );

      const response = await handler(request, context);

      // Cache response
      if (endpoint.caching?.enabled && request.method === HTTPMethod.GET && response.statusCode === 200) {
        const cacheKey = endpoint.caching.keyGenerator
          ? endpoint.caching.keyGenerator(request)
          : this.defaultCacheKey(request);

        await this.cache.set(cacheKey, response, endpoint.caching.ttl);
      }

      // Collect metrics
      const duration = Date.now() - context.startTime;
      this.metrics.record(endpoint, request, response, duration);

      eventBus.emitSync('api.request_completed', { request, response, context, duration }, 'APIGateway');

      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Create error context
      const errorContext: ErrorContext = {
        requestId: context.requestId,
        userId: context.userId,
        path: request.path,
        method: request.method,
        ip: request.ip,
        userAgent: request.userAgent,
        timestamp: new Date(),
        duration: Date.now() - context.startTime,
      };

      // Log error with context
      const severity = this.determineErrorSeverity(err);
      errorLogger.log(err, errorContext, severity);

      // Record error metrics
      errorMetricsCollector.record(err, errorContext);

      // Emit error event
      eventBus.emitSync('api.request_failed', { request, context, error: err }, 'APIGateway');

      // Return appropriate error response
      if (err instanceof APIError) {
        return this.createErrorResponseFromAPIError(err, context);
      }

      return this.createErrorResponse(500, 'Internal server error', context.requestId);
    }
  }

  /**
   * Add global middleware
   */
  use(middleware: Middleware): void {
    this.globalMiddleware.push(middleware);
  }

  /**
   * Get metrics
   */
  getMetrics(filter?: { endpoint?: string; method?: HTTPMethod }): APIMetrics[] {
    return this.metrics.getMetrics(filter);
  }

  /**
   * Get authentication system
   */
  getAuthSystem(): AuthenticationSystem {
    return this.authSystem;
  }

  /**
   * Get RBAC system
   */
  getRBACSystem(): RBACSystem {
    return this.rbacSystem;
  }

  /**
   * Get audit logger
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Get circuit breaker manager
   */
  getCircuitBreakerManager() {
    return this.circuitBreakerManager;
  }

  /**
   * Get error logger
   */
  getErrorLogger() {
    return errorLogger;
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(filter?: { errorType?: string; path?: string }) {
    return errorMetricsCollector.getMetrics(filter);
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config?: { maxAttempts?: number; initialDelay?: number; maxDelay?: number }
  ): Promise<T> {
    return RetryHandler.execute(fn, config);
  }

  /**
   * Execute with circuit breaker
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>,
    config?: { failureThreshold?: number; resetTimeout?: number }
  ): Promise<T> {
    const breaker = this.circuitBreakerManager.getBreaker(serviceName, config);
    return breaker.execute(fn);
  }

  /**
   * List endpoints
   */
  listEndpoints(filter?: { tags?: string[] }): APIEndpoint[] {
    let endpoints = Array.from(this.endpoints.values());

    if (filter?.tags) {
      endpoints = endpoints.filter(e => e.tags.some(t => filter.tags!.includes(t)));
    }

    return endpoints;
  }

  /**
   * Generate OpenAPI specification
   */
  generateOpenAPISpec(): OpenAPISpec {
    const paths: Record<string, any> = {};

    for (const endpoint of this.endpoints.values()) {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.documentation?.summary,
        description: endpoint.documentation?.description,
        parameters: endpoint.documentation?.parameters,
        requestBody: endpoint.documentation?.requestBody,
        responses: endpoint.documentation?.responses,
        tags: endpoint.tags,
      };
    }

    return {
      openapi: '3.0.0',
      info: {
        title: 'API Gateway',
        version: '1.0.0',
      },
      paths,
    };
  }

  private findEndpoint(method: HTTPMethod, path: string): APIEndpoint | undefined {
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.method === method && this.matchPath(endpoint.path, path)) {
        return endpoint;
      }
    }

    return undefined;
  }

  private matchPath(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        continue;
      }

      if (patternParts[i] !== pathParts[i]) {
        return false;
      }
    }

    return true;
  }

  private extractParams(pattern: string, path: string): Record<string, string> {
    const params: Record<string, string> = {};
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].substring(1);
        params[paramName] = pathParts[i];
      }
    }

    return params;
  }

  private validateRequest(request: APIRequest, validation: ValidationConfig): string | null {
    // Validate using comprehensive validator
    const errors = RequestValidator.validate(request, validation);

    if (errors.length > 0) {
      // Format errors as readable message
      const errorMessages = errors.map(err => `${err.field}: ${err.message}`).join('; ');
      return errorMessages;
    }

    return null;
  }

  /**
   * Determine error severity for logging
   */
  private determineErrorSeverity(error: Error): 'info' | 'warning' | 'error' | 'critical' {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return 'info';
    }

    if (error instanceof RateLimitError || error instanceof AuthenticationError) {
      return 'warning';
    }

    if (error instanceof AuthorizationError || error instanceof DatabaseError) {
      return 'error';
    }

    if (error instanceof APIError && !error.isOperational) {
      return 'critical';
    }

    return 'error';
  }

  /**
   * Create error response from APIError
   */
  private createErrorResponseFromAPIError(error: APIError, context: RequestContext): APIResponse {
    const isDevelopment = process.env.NODE_ENV === 'development';

    const response: APIResponse = {
      statusCode: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: {
          message: this.getUserFriendlyErrorMessage(error),
          code: error.code,
          timestamp: error.timestamp.toISOString(),
          requestId: context.requestId,
        },
      },
    };

    // Add details in development or for operational errors
    if (isDevelopment || error.isOperational) {
      if (error.details) {
        response.body.error.details = error.details;
      }
    }

    // Add stack trace only in development
    if (isDevelopment && error.stack) {
      response.body.error.stack = this.sanitizeStackTrace(error.stack);
    }

    // Add retry-after header for rate limit errors
    if (error instanceof RateLimitError && error.retryAfter) {
      response.headers['Retry-After'] = Math.ceil(
        (error.retryAfter.getTime() - Date.now()) / 1000
      ).toString();
      response.body.error.retryAfter = error.retryAfter.toISOString();
    }

    return response;
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyErrorMessage(error: APIError): string {
    const friendlyMessages: Record<string, string> = {
      VALIDATION_ERROR: 'The request data is invalid. Please check your input and try again.',
      AUTHENTICATION_ERROR: 'Authentication failed. Please log in and try again.',
      AUTHORIZATION_ERROR: 'You do not have permission to perform this action.',
      NOT_FOUND: 'The requested resource could not be found.',
      CONFLICT_ERROR: 'The request conflicts with existing data.',
      RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down and try again later.',
      SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
      GATEWAY_TIMEOUT: 'The request took too long to process. Please try again.',
      DATABASE_ERROR: 'A database error occurred. Please try again later.',
      EXTERNAL_SERVICE_ERROR: 'An external service failed. Please try again later.',
      CIRCUIT_BREAKER_OPEN: 'The service is temporarily unavailable due to repeated failures.',
    };

    return friendlyMessages[error.code] || error.message;
  }

  /**
   * Sanitize stack trace
   */
  private sanitizeStackTrace(stack: string): string[] {
    return stack
      .split('\n')
      .map(line => {
        // Remove file paths that might contain sensitive information
        return line
          .replace(/\/home\/[^\/]+/g, '/home/user')
          .replace(/\/Users\/[^\/]+/g, '/Users/user')
          .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\user');
      })
      .slice(0, 10); // Limit stack trace depth
  }

  private async authenticate(
    request: APIRequest,
    config: AuthenticationConfig
  ): Promise<boolean> {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers['authorization'] || request.headers['Authorization'];

      if (!authHeader) {
        this.auditLogger.log({
          userId: undefined,
          action: 'login',
          resource: 'api',
          result: 'failure',
          ipAddress: request.ip,
          userAgent: request.userAgent,
          details: new Map([
            ['reason', 'Missing authorization header'],
            ['path', request.path]
          ]),
          severity: 'low',
        });
        return false;
      }

      let token: string;

      // Handle different authentication types
      switch (config.type) {
        case 'bearer':
          if (!authHeader.startsWith('Bearer ')) {
            this.auditLogger.log({
              userId: undefined,
              action: 'login',
              resource: 'api',
              result: 'failure',
              ipAddress: request.ip,
              userAgent: request.userAgent,
              details: new Map([
                ['reason', 'Invalid bearer token format'],
                ['path', request.path]
              ]),
              severity: 'low',
            });
            return false;
          }
          token = authHeader.substring(7);
          break;

        case 'basic':
          // Basic auth not implemented for JWT
          this.auditLogger.log({
            userId: undefined,
            action: 'login',
            resource: 'api',
            result: 'failure',
            ipAddress: request.ip,
            userAgent: request.userAgent,
            details: new Map([
              ['reason', 'Basic auth not supported'],
              ['path', request.path]
            ]),
            severity: 'low',
          });
          return false;

        case 'api_key':
          token = authHeader;
          break;

        default:
          token = authHeader.replace(/^Bearer /, '');
      }

      // Verify JWT token and get user
      const user = await this.authSystem.verifySession(token);

      if (!user) {
        this.auditLogger.log({
          userId: undefined,
          action: 'login',
          resource: 'api',
          result: 'failure',
          ipAddress: request.ip,
          userAgent: request.userAgent,
          details: new Map([
            ['reason', 'Invalid or expired token'],
            ['path', request.path]
          ]),
          severity: 'medium',
        });
        return false;
      }

      // Check user status
      if (user.status !== 'active') {
        this.auditLogger.log({
          userId: user.id,
          action: 'login',
          resource: 'api',
          result: 'denied',
          ipAddress: request.ip,
          userAgent: request.userAgent,
          details: new Map([
            ['reason', `User status: ${user.status}`],
            ['path', request.path],
            ['username', user.username]
          ]),
          severity: 'high',
        });
        return false;
      }

      // Store user information in request context (will be set in handleRequest)
      (request as any).user = user;

      // Log successful authentication
      this.auditLogger.log({
        userId: user.id,
        action: 'login',
        resource: 'api',
        result: 'success',
        ipAddress: request.ip,
        userAgent: request.userAgent,
        details: new Map([
          ['path', request.path],
          ['method', request.method],
          ['username', user.username]
        ]),
        severity: 'low',
      });

      return true;
    } catch (error) {
      this.auditLogger.log({
        userId: undefined,
        action: 'login',
        resource: 'api',
        result: 'failure',
        ipAddress: request.ip,
        userAgent: request.userAgent,
        details: new Map([
          ['reason', error instanceof Error ? error.message : 'Unknown error'],
          ['path', request.path]
        ]),
        severity: 'high',
      });
      return false;
    }
  }

  private async authorize(
    request: APIRequest,
    context: RequestContext,
    config: AuthorizationConfig
  ): Promise<boolean> {
    try {
      // If custom authorization function is provided, use it
      if (config.custom) {
        const allowed = await config.custom(request, context);

        this.auditLogger.log({
          userId: context.userId,
          action: 'access',
          resource: request.path,
          result: allowed ? 'success' : 'denied',
          ipAddress: request.ip,
          userAgent: request.userAgent,
          details: new Map([
            ['method', request.method],
            ['customAuth', 'true']
          ]),
          severity: allowed ? 'low' : 'medium',
        });

        return allowed;
      }

      // Get authenticated user from request
      const user = (request as any).user as User;

      if (!user) {
        this.auditLogger.log({
          userId: context.userId,
          action: 'access',
          resource: request.path,
          result: 'denied',
          ipAddress: request.ip,
          userAgent: request.userAgent,
          details: new Map([
            ['reason', 'No authenticated user found'],
            ['method', request.method]
          ]),
          severity: 'high',
        });
        return false;
      }

      // Set context userId if not already set
      if (!context.userId) {
        context.userId = user.id;
      }

      // Check role-based authorization
      if (config.roles && config.roles.length > 0) {
        const hasRequiredRole = config.roles.some(role =>
          user.roles.includes(role)
        );

        if (!hasRequiredRole) {
          this.auditLogger.log({
            userId: user.id,
            action: 'access',
            resource: request.path,
            result: 'denied',
            ipAddress: request.ip,
            userAgent: request.userAgent,
            details: new Map([
              ['reason', 'Missing required role'],
              ['requiredRoles', config.roles.join(', ')],
              ['userRoles', user.roles.join(', ')],
              ['method', request.method],
              ['username', user.username]
            ]),
            severity: 'medium',
          });
          return false;
        }
      }

      // Check permission-based authorization using RBAC
      if (config.permissions && config.permissions.length > 0) {
        let hasAllPermissions = true;

        for (const permissionStr of config.permissions) {
          // Parse permission string (format: "resource:action")
          const [resource, action] = permissionStr.split(':');

          if (!resource || !action) {
            continue;
          }

          // Check access using RBAC system
          const accessRequest: AccessRequest = {
            userId: user.id,
            resource: resource,
            action: action as any,
            context: {
              ip: request.ip,
              path: request.path,
              method: request.method
            }
          };

          const decision = this.rbacSystem.checkAccess(accessRequest);

          if (!decision.allowed) {
            hasAllPermissions = false;

            this.auditLogger.log({
              userId: user.id,
              action: 'access',
              resource: request.path,
              result: 'denied',
              ipAddress: request.ip,
              userAgent: request.userAgent,
              details: new Map([
                ['reason', decision.reason || 'Permission denied'],
                ['requiredPermission', permissionStr],
                ['method', request.method],
                ['username', user.username]
              ]),
              severity: 'medium',
            });

            break;
          }
        }

        if (!hasAllPermissions) {
          return false;
        }
      }

      // Authorization successful
      this.auditLogger.log({
        userId: user.id,
        action: 'access',
        resource: request.path,
        result: 'success',
        ipAddress: request.ip,
        userAgent: request.userAgent,
        details: new Map([
          ['method', request.method],
          ['username', user.username],
          ['roles', user.roles.join(', ')]
        ]),
        severity: 'low',
      });

      return true;
    } catch (error) {
      this.auditLogger.log({
        userId: context.userId,
        action: 'access',
        resource: request.path,
        result: 'failure',
        ipAddress: request.ip,
        userAgent: request.userAgent,
        details: new Map([
          ['reason', error instanceof Error ? error.message : 'Unknown error'],
          ['method', request.method]
        ]),
        severity: 'high',
      });
      return false;
    }
  }

  private buildMiddlewareChain(
    middleware: Middleware[],
    handler: EndpointHandler
  ): EndpointHandler {
    return middleware.reduceRight(
      (next, mw) => {
        return async (request: APIRequest, context: RequestContext) => {
          return mw(request, context, () => next(request, context));
        };
      },
      handler
    );
  }

  private createErrorResponse(statusCode: number, message: string, requestId?: string): APIResponse {
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: {
          message,
          code: this.getErrorCodeFromStatus(statusCode),
          timestamp: new Date().toISOString(),
          requestId,
        },
      },
    };
  }

  /**
   * Get error code from status code
   */
  private getErrorCodeFromStatus(statusCode: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return codes[statusCode] || 'UNKNOWN_ERROR';
  }

  private defaultRateLimitKey(request: APIRequest): string {
    return `${request.ip}:${request.path}`;
  }

  private defaultCacheKey(request: APIRequest): string {
    return `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
  }

  private generateEndpointId(method: HTTPMethod, path: string): string {
    return `${method}:${path}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Rate Limiter
 */
export class RateLimiter {
  private states: Map<string, RateLimitState> = new Map();

  /**
   * Check rate limit
   */
  async checkLimit(key: string, config: RateLimitConfig): Promise<boolean> {
    const now = Date.now();

    switch (config.strategy) {
      case RateLimitStrategy.FixedWindow:
        return this.checkFixedWindow(key, config, now);

      case RateLimitStrategy.SlidingWindow:
        return this.checkSlidingWindow(key, config, now);

      case RateLimitStrategy.TokenBucket:
        return this.checkTokenBucket(key, config, now);

      case RateLimitStrategy.LeakyBucket:
        return this.checkLeakyBucket(key, config, now);

      default:
        return true;
    }
  }

  /**
   * Get rate limit state
   */
  getState(key: string): RateLimitState | undefined {
    return this.states.get(key);
  }

  /**
   * Reset rate limit
   */
  reset(key: string): void {
    this.states.delete(key);
  }

  private checkFixedWindow(key: string, config: RateLimitConfig, now: number): boolean {
    let state = this.states.get(key);

    if (!state || now >= state.resetAt.getTime()) {
      state = {
        key,
        count: 0,
        resetAt: new Date(now + config.window),
      };

      this.states.set(key, state);
    }

    if (state.count >= config.limit) {
      return false;
    }

    state.count++;
    return true;
  }

  private checkSlidingWindow(key: string, config: RateLimitConfig, now: number): boolean {
    // Simplified sliding window using fixed window approximation
    return this.checkFixedWindow(key, config, now);
  }

  private checkTokenBucket(key: string, config: RateLimitConfig, now: number): boolean {
    let state = this.states.get(key);

    if (!state) {
      state = {
        key,
        count: 0,
        resetAt: new Date(now + config.window),
        tokens: config.limit,
      };

      this.states.set(key, state);
    }

    // Refill tokens
    const elapsed = now - (state.resetAt.getTime() - config.window);
    const refillRate = config.limit / config.window;
    const tokensToAdd = Math.floor(elapsed * refillRate);

    if (tokensToAdd > 0) {
      state.tokens = Math.min((state.tokens || 0) + tokensToAdd, config.limit);
      state.resetAt = new Date(now + config.window);
    }

    if ((state.tokens || 0) < 1) {
      return false;
    }

    state.tokens! -= 1;
    state.count++;

    return true;
  }

  private checkLeakyBucket(key: string, config: RateLimitConfig, now: number): boolean {
    // Simplified leaky bucket using token bucket
    return this.checkTokenBucket(key, config, now);
  }
}

/**
 * API Cache
 */
export class APICache {
  private cache: Map<string, CacheEntry> = new Map();

  async get(key: string): Promise<APIResponse | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  async set(key: string, response: APIResponse, ttl: number): Promise<void> {
    this.cache.set(key, {
      response,
      expiresAt: new Date(Date.now() + ttl),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

interface CacheEntry {
  response: APIResponse;
  expiresAt: Date;
}

/**
 * Metrics Collector
 */
export class MetricsCollector {
  private metrics: Map<string, APIMetrics> = new Map();
  private latencies: Map<string, number[]> = new Map();

  record(endpoint: APIEndpoint, request: APIRequest, response: APIResponse, duration: number): void {
    const key = `${endpoint.method}:${endpoint.path}`;

    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        endpoint: endpoint.path,
        method: endpoint.method,
        requestCount: 0,
        errorCount: 0,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        statusCodes: {},
        timestamp: new Date(),
      };

      this.metrics.set(key, metrics);
      this.latencies.set(key, []);
    }

    metrics.requestCount++;

    if (response.statusCode >= 400) {
      metrics.errorCount++;
    }

    metrics.statusCodes[response.statusCode] = (metrics.statusCodes[response.statusCode] || 0) + 1;

    // Update latencies
    const latencies = this.latencies.get(key)!;
    latencies.push(duration);

    // Keep only last 1000 latencies
    if (latencies.length > 1000) {
      latencies.shift();
    }

    // Calculate percentiles
    const sorted = [...latencies].sort((a, b) => a - b);
    metrics.averageLatency = sorted.reduce((sum, l) => sum + l, 0) / sorted.length;
    metrics.p50Latency = sorted[Math.floor(sorted.length * 0.5)];
    metrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
    metrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
  }

  getMetrics(filter?: { endpoint?: string; method?: HTTPMethod }): APIMetrics[] {
    let metrics = Array.from(this.metrics.values());

    if (filter?.endpoint) {
      metrics = metrics.filter(m => m.endpoint === filter.endpoint);
    }

    if (filter?.method) {
      metrics = metrics.filter(m => m.method === filter.method);
    }

    return metrics;
  }

  clear(): void {
    this.metrics.clear();
    this.latencies.clear();
  }
}

/**
 * Quota Manager
 */
export class QuotaManager {
  private quotas: Map<string, QuotaConfig> = new Map();

  /**
   * Set quota
   */
  setQuota(userId: string, limit: number, period: QuotaConfig['period']): QuotaConfig {
    const quota: QuotaConfig = {
      userId,
      limit,
      period,
      used: 0,
      resetAt: this.calculateResetTime(period),
    };

    this.quotas.set(userId, quota);

    return quota;
  }

  /**
   * Check quota
   */
  checkQuota(userId: string): boolean {
    const quota = this.quotas.get(userId);

    if (!quota) {
      return true; // No quota set
    }

    // Reset if period expired
    if (Date.now() >= quota.resetAt.getTime()) {
      quota.used = 0;
      quota.resetAt = this.calculateResetTime(quota.period);
    }

    return quota.used < quota.limit;
  }

  /**
   * Increment usage
   */
  incrementUsage(userId: string): void {
    const quota = this.quotas.get(userId);

    if (quota) {
      quota.used++;
    }
  }

  /**
   * Get quota
   */
  getQuota(userId: string): QuotaConfig | undefined {
    return this.quotas.get(userId);
  }

  private calculateResetTime(period: QuotaConfig['period']): Date {
    const now = new Date();

    switch (period) {
      case 'hour':
        return new Date(now.getTime() + 3600000);
      case 'day':
        return new Date(now.getTime() + 86400000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, any>;
}

/**
 * Singleton instances
 */
export const apiGateway = new APIGateway();
export const quotaManager = new QuotaManager();

/**
 * Validation Middleware Factory
 */
export class ValidationMiddleware {
  /**
   * Create validation middleware from schema
   */
  static create(config: ValidationConfig): Middleware {
    return async (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => {
      const errors = RequestValidator.validate(request, config);

      if (errors.length > 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: {
            error: 'Validation failed',
            errors: errors.map(err => ({
              field: err.field,
              message: err.message,
            })),
          },
        };
      }

      return next();
    };
  }

  /**
   * Create sanitization middleware
   */
  static createSanitizer(config?: SanitizationConfig): Middleware {
    return async (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => {
      // Sanitize all inputs
      request.body = InputSanitizer.sanitizeObject(request.body, config);
      request.query = InputSanitizer.sanitizeObject(request.query, config);
      request.params = InputSanitizer.sanitizeObject(request.params, config);

      return next();
    };
  }

  /**
   * Create rate limiting middleware per endpoint
   */
  static createRateLimiter(config: RateLimitConfig): Middleware {
    const rateLimiter = new RateLimiter();

    return async (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => {
      const key = config.keyGenerator
        ? config.keyGenerator(request)
        : `${request.ip}:${request.path}`;

      const allowed = await rateLimiter.checkLimit(key, config);

      if (!allowed) {
        const state = rateLimiter.getState(key);
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': state?.resetAt.toISOString() || '',
          },
          body: {
            error: 'Rate limit exceeded',
            retryAfter: state?.resetAt,
          },
        };
      }

      return next();
    };
  }

  /**
   * Create XSS protection middleware
   */
  static createXSSProtection(): Middleware {
    return async (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => {
      // Sanitize to prevent XSS
      request.body = InputSanitizer.sanitizeObject(request.body);
      request.query = InputSanitizer.sanitizeObject(request.query);
      request.params = InputSanitizer.sanitizeObject(request.params);

      const response = await next();

      // Add security headers
      response.headers['X-Content-Type-Options'] = 'nosniff';
      response.headers['X-Frame-Options'] = 'DENY';
      response.headers['X-XSS-Protection'] = '1; mode=block';
      response.headers['Content-Security-Policy'] = "default-src 'self'";

      return response;
    };
  }

  /**
   * Create SQL injection protection middleware
   */
  static createSQLInjectionProtection(): Middleware {
    return async (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => {
      const checkForSQLInjection = (value: any): boolean => {
        if (typeof value === 'string') {
          // Common SQL injection patterns
          const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
            /(--|\#|\/\*|\*\/)/g,
            /('|")\s*(OR|AND)\s*('|")\s*=\s*('|")/gi,
            /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
          ];

          return sqlPatterns.some(pattern => pattern.test(value));
        }

        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(v => checkForSQLInjection(v));
        }

        return false;
      };

      if (
        checkForSQLInjection(request.body) ||
        checkForSQLInjection(request.query) ||
        checkForSQLInjection(request.params)
      ) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Potentially malicious input detected' },
        };
      }

      return next();
    };
  }

  /**
   * Create command injection protection middleware
   */
  static createCommandInjectionProtection(): Middleware {
    return async (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => {
      const sanitizeForCommand = (obj: any): any => {
        if (typeof obj === 'string') {
          return InputSanitizer.sanitizeCommand(obj);
        }
        if (Array.isArray(obj)) {
          return obj.map(sanitizeForCommand);
        }
        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {};
          for (const key in obj) {
            sanitized[key] = sanitizeForCommand(obj[key]);
          }
          return sanitized;
        }
        return obj;
      };

      request.body = sanitizeForCommand(request.body);
      request.query = sanitizeForCommand(request.query);
      request.params = sanitizeForCommand(request.params);

      return next();
    };
  }

  /**
   * Create path traversal protection middleware
   */
  static createPathTraversalProtection(): Middleware {
    return async (request: APIRequest, context: RequestContext, next: () => Promise<APIResponse>) => {
      const sanitizeForPath = (obj: any): any => {
        if (typeof obj === 'string') {
          return InputSanitizer.sanitizePath(obj);
        }
        if (Array.isArray(obj)) {
          return obj.map(sanitizeForPath);
        }
        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {};
          for (const key in obj) {
            sanitized[key] = sanitizeForPath(obj[key]);
          }
          return sanitized;
        }
        return obj;
      };

      request.params = sanitizeForPath(request.params);
      request.query = sanitizeForPath(request.query);

      return next();
    };
  }

  /**
   * Create comprehensive security middleware (combines all protections)
   */
  static createSecurityMiddleware(config?: {
    rateLimiting?: RateLimitConfig;
    sanitization?: SanitizationConfig;
  }): Middleware[] {
    const middleware: Middleware[] = [
      ValidationMiddleware.createXSSProtection(),
      ValidationMiddleware.createSQLInjectionProtection(),
      ValidationMiddleware.createCommandInjectionProtection(),
      ValidationMiddleware.createPathTraversalProtection(),
    ];

    if (config?.sanitization) {
      middleware.unshift(ValidationMiddleware.createSanitizer(config.sanitization));
    }

    if (config?.rateLimiting) {
      middleware.unshift(ValidationMiddleware.createRateLimiter(config.rateLimiting));
    }

    return middleware;
  }
}

/**
 * Helper functions to create common validation schemas
 */
export const ValidationSchemas = {
  /**
   * Email validation schema
   */
  email: (): ValidationSchema => ({
    type: 'string',
    format: 'email',
    minLength: 3,
    maxLength: 255,
  }),

  /**
   * URL validation schema
   */
  url: (): ValidationSchema => ({
    type: 'string',
    format: 'url',
    maxLength: 2048,
  }),

  /**
   * Phone validation schema
   */
  phone: (): ValidationSchema => ({
    type: 'string',
    format: 'phone',
    minLength: 10,
    maxLength: 20,
  }),

  /**
   * UUID validation schema
   */
  uuid: (): ValidationSchema => ({
    type: 'string',
    format: 'uuid',
  }),

  /**
   * Integer with range
   */
  integer: (min?: number, max?: number): ValidationSchema => ({
    type: 'number',
    minimum: min,
    maximum: max,
  }),

  /**
   * String with length constraints
   */
  string: (minLength?: number, maxLength?: number, pattern?: string): ValidationSchema => ({
    type: 'string',
    minLength,
    maxLength,
    pattern,
  }),

  /**
   * Array with constraints
   */
  array: (items?: ValidationSchema, minLength?: number, maxLength?: number): ValidationSchema => ({
    type: 'array',
    items,
    minLength,
    maxLength,
  }),

  /**
   * Object with properties
   */
  object: (properties: Record<string, ValidationSchema>, required?: string[]): ValidationSchema => ({
    type: 'object',
    properties,
    required,
  }),

  /**
   * Enum validation
   */
  enum: <T extends string | number>(values: T[]): ValidationSchema => ({
    type: typeof values[0] === 'string' ? 'string' : 'number',
    enum: values,
  }),
};
