/**
 * API Gateway & Network Enhancement
 * Request routing, load balancing, rate limiting, caching
 * Authentication, authorization, request transformation
 * Comprehensive input validation and security middleware
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import { z, ZodSchema, ZodError } from 'zod';

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base error class for all API Gateway errors
 */
export class APIGatewayError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: number;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'GATEWAY_ERROR',
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = Date.now();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error - 400 Bad Request
 */
export class ValidationError extends APIGatewayError {
  public readonly errors: ValidationError[];

  constructor(message: string, errors: any[] = [], context?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', true, context);
    this.errors = errors;
  }
}

/**
 * Authentication error - 401 Unauthorized
 */
export class AuthenticationError extends APIGatewayError {
  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, context);
  }
}

/**
 * Authorization error - 403 Forbidden
 */
export class AuthorizationError extends APIGatewayError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, any>) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, context);
  }
}

/**
 * Not found error - 404 Not Found
 */
export class NotFoundError extends APIGatewayError {
  constructor(message: string = 'Resource not found', context?: Record<string, any>) {
    super(message, 404, 'NOT_FOUND', true, context);
  }
}

/**
 * Rate limit error - 429 Too Many Requests
 */
export class RateLimitError extends APIGatewayError {
  public readonly retryAfter: number;

  constructor(message: string = 'Too many requests', retryAfter: number, context?: Record<string, any>) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, context);
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout error - 408 Request Timeout
 */
export class TimeoutError extends APIGatewayError {
  constructor(message: string = 'Request timeout', context?: Record<string, any>) {
    super(message, 408, 'TIMEOUT', true, context);
  }
}

/**
 * Circuit breaker error - 503 Service Unavailable
 */
export class CircuitBreakerError extends APIGatewayError {
  constructor(message: string = 'Service temporarily unavailable', context?: Record<string, any>) {
    super(message, 503, 'CIRCUIT_BREAKER_OPEN', true, context);
  }
}

/**
 * Upstream error - 502 Bad Gateway
 */
export class UpstreamError extends APIGatewayError {
  public readonly upstreamStatus?: number;

  constructor(message: string = 'Upstream service error', upstreamStatus?: number, context?: Record<string, any>) {
    super(message, 502, 'UPSTREAM_ERROR', true, context);
    this.upstreamStatus = upstreamStatus;
  }
}

/**
 * Payload too large error - 413
 */
export class PayloadTooLargeError extends APIGatewayError {
  public readonly maxSize: number;
  public readonly actualSize: number;

  constructor(maxSize: number, actualSize: number, context?: Record<string, any>) {
    super(`Payload too large: ${actualSize} bytes (max: ${maxSize} bytes)`, 413, 'PAYLOAD_TOO_LARGE', true, context);
    this.maxSize = maxSize;
    this.actualSize = actualSize;
  }
}

/**
 * Configuration error - 500 Internal Server Error (non-operational)
 */
export class ConfigurationError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 500, 'CONFIGURATION_ERROR', false, context);
  }
}

/**
 * Service unavailable error - 503
 */
export class ServiceUnavailableError extends APIGatewayError {
  constructor(message: string = 'Service unavailable', context?: Record<string, any>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', true, context);
  }
}

// ============================================================================
// Error Context & Logging
// ============================================================================

export interface ErrorContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userId?: string;
  timestamp: number;
  userAgent?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}

export interface ErrorLogEntry {
  level: 'error' | 'warn' | 'info';
  message: string;
  error: {
    name: string;
    message: string;
    code: string;
    statusCode: number;
    stack?: string;
    isOperational: boolean;
  };
  context: ErrorContext;
  timestamp: number;
}

/**
 * Error handler with logging and sanitization
 */
export class ErrorHandler {
  private static isDevelopment = process.env.NODE_ENV === 'development';
  private static errorLogs: ErrorLogEntry[] = [];
  private static maxLogSize: number = 1000;

  /**
   * Handle error and return appropriate response
   */
  public static handleError(error: any, context: ErrorContext): Response {
    const apiError = this.normalizeError(error);

    // Log error with context
    this.logError(apiError, context);

    // Create user-friendly response
    const response = this.createErrorResponse(apiError, context);

    return response;
  }

  /**
   * Normalize any error to APIGatewayError
   */
  private static normalizeError(error: any): APIGatewayError {
    if (error instanceof APIGatewayError) {
      return error;
    }

    if (error instanceof ZodError) {
      return new ValidationError('Validation failed', error.errors);
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new UpstreamError('Unable to connect to upstream service', undefined, { originalError: error.code });
    }

    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return new TimeoutError('Request timeout', { originalError: error.message });
    }

    if (error.statusCode) {
      return new APIGatewayError(
        error.message || 'An error occurred',
        error.statusCode,
        error.code || 'UNKNOWN_ERROR',
        true,
        { originalError: error.message }
      );
    }

    // Unknown error - non-operational
    return new APIGatewayError(
      this.isDevelopment ? error.message : 'Internal server error',
      500,
      'INTERNAL_ERROR',
      false,
      { originalError: error.message }
    );
  }

  /**
   * Create error response with sanitized stack trace
   */
  private static createErrorResponse(error: APIGatewayError, context: ErrorContext): Response {
    const body: any = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        timestamp: error.timestamp,
        requestId: context.requestId,
      },
    };

    // Add error details in development mode
    if (this.isDevelopment) {
      body.error.stack = this.sanitizeStackTrace(error.stack);
      body.error.context = error.context;
    }

    // Add retry information for rate limits
    if (error instanceof RateLimitError) {
      body.error.retryAfter = error.retryAfter;
    }

    // Add upstream status for upstream errors
    if (error instanceof UpstreamError && error.upstreamStatus) {
      body.error.upstreamStatus = error.upstreamStatus;
    }

    // Add validation errors
    if (error instanceof ValidationError && error.errors.length > 0) {
      body.error.validationErrors = error.errors;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': context.requestId,
    };

    // Add retry-after header for rate limits and service unavailable
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = String(Math.ceil(error.retryAfter / 1000));
    }

    return {
      status: error.statusCode,
      headers,
      body,
    };
  }

  /**
   * Sanitize stack trace to remove sensitive information
   */
  private static sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;

    return stack
      .split('\n')
      .map(line => {
        // Remove absolute paths, keep only relative paths
        return line.replace(/\(\/[^)]+\)/g, (match) => {
          const parts = match.split('/');
          return `(${parts.slice(-3).join('/')}`; // Keep last 3 parts
        });
      })
      .filter(line => {
        // Remove node_modules internals
        return !line.includes('node_modules') || line.includes('at ');
      })
      .slice(0, 10) // Limit to 10 lines
      .join('\n');
  }

  /**
   * Log error with full context
   */
  private static logError(error: APIGatewayError, context: ErrorContext): void {
    const level = error.statusCode >= 500 ? 'error' : error.statusCode >= 400 ? 'warn' : 'info';

    const logEntry: ErrorLogEntry = {
      level,
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: this.isDevelopment ? this.sanitizeStackTrace(error.stack) : undefined,
        isOperational: error.isOperational,
      },
      context,
      timestamp: Date.now(),
    };

    // Store in memory
    this.errorLogs.push(logEntry);
    if (this.errorLogs.length > this.maxLogSize) {
      this.errorLogs.shift();
    }

    // Console output
    this.logToConsole(logEntry);
  }

  /**
   * Format and log to console
   */
  private static logToConsole(entry: ErrorLogEntry): void {
    const prefix = `[${entry.level.toUpperCase()}] [${new Date(entry.timestamp).toISOString()}]`;
    const requestInfo = `${entry.context.method} ${entry.context.path} | ${entry.context.ip}`;
    const errorInfo = `${entry.error.code} (${entry.error.statusCode}): ${entry.error.message}`;

    const message = `${prefix} ${requestInfo} | ${errorInfo} | requestId=${entry.context.requestId}`;

    if (entry.level === 'error') {
      console.error(message);
      if (this.isDevelopment && entry.error.stack) {
        console.error(entry.error.stack);
      }
    } else if (entry.level === 'warn') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  /**
   * Get error logs with filtering
   */
  public static getErrorLogs(options?: {
    level?: 'error' | 'warn' | 'info';
    code?: string;
    since?: number;
    limit?: number;
  }): ErrorLogEntry[] {
    let logs = [...this.errorLogs];

    if (options) {
      if (options.level) {
        logs = logs.filter(l => l.level === options.level);
      }
      if (options.code) {
        logs = logs.filter(l => l.error.code === options.code);
      }
      if (options.since) {
        logs = logs.filter(l => l.timestamp >= options.since);
      }
      if (options.limit) {
        logs = logs.slice(-options.limit);
      }
    }

    return logs;
  }

  /**
   * Clear error logs
   */
  public static clearErrorLogs(): void {
    this.errorLogs = [];
  }

  /**
   * Check if error is retryable
   */
  public static isRetryable(error: any): boolean {
    if (error instanceof APIGatewayError) {
      return error.isOperational && [408, 429, 502, 503, 504].includes(error.statusCode);
    }

    // Network errors are retryable
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Determine error recovery strategy
   */
  public static getRecoveryStrategy(error: APIGatewayError): {
    action: 'retry' | 'fallback' | 'fail' | 'circuit_break';
    delay?: number;
    fallbackData?: any;
  } {
    // Circuit breaker errors - stop trying
    if (error instanceof CircuitBreakerError) {
      return { action: 'circuit_break' };
    }

    // Rate limit errors - retry with delay
    if (error instanceof RateLimitError) {
      return { action: 'retry', delay: error.retryAfter };
    }

    // Timeout errors - retry with backoff
    if (error instanceof TimeoutError) {
      return { action: 'retry', delay: 1000 };
    }

    // Upstream errors - retry or fallback
    if (error instanceof UpstreamError) {
      return { action: 'retry', delay: 500 };
    }

    // Service unavailable - retry with backoff
    if (error instanceof ServiceUnavailableError) {
      return { action: 'retry', delay: 2000 };
    }

    // Client errors (4xx) - fail immediately
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return { action: 'fail' };
    }

    // Server errors (5xx) - retry
    if (error.statusCode >= 500) {
      return { action: 'retry', delay: 1000 };
    }

    return { action: 'fail' };
  }
}

// ============================================================================
// Security & Validation Constants
// ============================================================================

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
  /(--|\|\||;|\/\*|\*\/|xp_|sp_)/gi,
  /('|('')|(\bOR\b\s+\d+\s*=\s*\d+)|(\bAND\b\s+\d+\s*=\s*\d+))/gi,
];

const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
];

const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$(){}[\]<>]/g,
  /\$\(.*\)/g,
  /`.*`/g,
  /(&&|\|\|)/g,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\./g,
  /\/etc\//gi,
  /\/var\//gi,
  /\/proc\//gi,
  /\/sys\//gi,
  /~\//g,
  /%2e%2e/gi,
  /%252e/gi,
];

// ============================================================================
// Validation Types & Interfaces
// ============================================================================

export interface ValidationConfig {
  schema?: ZodSchema<any>;
  sanitize?: boolean;
  preventXSS?: boolean;
  preventSQLInjection?: boolean;
  preventCommandInjection?: boolean;
  preventPathTraversal?: boolean;
  customValidators?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  validator: (value: any) => boolean | Promise<boolean>;
  message: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

export interface SanitizationOptions {
  html?: boolean;
  sql?: boolean;
  command?: boolean;
  path?: boolean;
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitized?: any;
}

// Common validation schemas
export const CommonSchemas = {
  email: z.string().email().max(255),
  phone: z.string().regex(/^[\d\s\-\+\(\)]+$/).min(10).max(20),
  url: z.string().url().max(2048),
  uuid: z.string().uuid(),

  username: z.string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/),

  password: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),

  ipv4: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/),
  ipv6: z.string().regex(/^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/),

  positiveInt: z.number().int().positive(),
  nonNegativeInt: z.number().int().min(0),

  dateISO: z.string().datetime(),

  alphanumeric: z.string().regex(/^[a-zA-Z0-9]+$/),

  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),

  hexColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),

  creditCard: z.string().regex(/^\d{13,19}$/),

  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),

  safeString: z.string()
    .min(1)
    .max(1000)
    .regex(/^[^<>'";&|`$(){}[\]]+$/),
};

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface GatewayConfig {
  port: number;
  host: string;
  enableSSL: boolean;
  enableCaching: boolean;
  enableRateLimiting: boolean;
  enableLoadBalancing: boolean;
  enableCircuitBreaker: boolean;
  enableCompression: boolean;
  enableCORS: boolean;
  enableSecurityHeaders: boolean;
  enableRequestLogging: boolean;
  timeout: number;
  maxRequestSize: number;
  corsOrigins: string[];
  compressionThreshold: number;
}

export interface Route {
  id: string;
  path: string;
  method: HttpMethod;
  target: RouteTarget;
  middleware: Middleware[];
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  auth?: AuthConfig;
  transform?: TransformConfig;
  retry?: RetryConfig;
  timeout?: number;
  validation?: ValidationConfig;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface RouteTarget {
  type: 'upstream' | 'function' | 'static';
  upstream?: UpstreamConfig;
  handler?: RequestHandler;
  content?: any;
}

export interface UpstreamConfig {
  servers: UpstreamServer[];
  loadBalancing: LoadBalancingStrategy;
  healthCheck?: HealthCheckConfig;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface UpstreamServer {
  id: string;
  url: string;
  weight: number;
  priority: number;
  maxConnections: number;
  currentConnections: number;
  healthy: boolean;
  lastHealthCheck?: number;
  metadata?: Record<string, any>;
}

export type LoadBalancingStrategy =
  | 'round_robin'
  | 'least_connections'
  | 'weighted_round_robin'
  | 'ip_hash'
  | 'random'
  | 'priority';

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  path: string;
  method: string;
  expectedStatus: number[];
}

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  monitoringPeriod: number;
  fallbackResponse?: any;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  strategy: 'sliding_window' | 'fixed_window' | 'token_bucket';
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface CacheConfig {
  ttl: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  varyBy?: string[];
  maxSize: number;
  storage: 'memory' | 'redis' | 'disk';
}

export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apikey' | 'jwt' | 'oauth2';
  validator: (token: string) => Promise<boolean>;
  required: boolean;
  scopes?: string[];
}

export interface TransformConfig {
  request?: RequestTransform;
  response?: ResponseTransform;
}

export interface RequestTransform {
  headers?: Record<string, string | ((req: Request) => string)>;
  body?: (body: any) => any;
  query?: Record<string, string>;
}

export interface ResponseTransform {
  headers?: Record<string, string>;
  body?: (body: any) => any;
  status?: (status: number) => number;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  retryableStatuses: number[];
  retryableErrors: string[];
}

export interface Request {
  id: string;
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: any;
  params: Record<string, string>;
  ip: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface Response {
  status: number;
  headers: Record<string, string>;
  body?: any;
  cached?: boolean;
  fromUpstream?: string;
}

export type Middleware = (
  req: Request,
  res: Response,
  next: () => Promise<void>
) => Promise<void>;

export type RequestHandler = (req: Request) => Promise<Response>;

export interface CacheEntry {
  key: string;
  value: Response;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

export interface RateLimitEntry {
  key: string;
  count: number;
  resetTime: number;
  tokens?: number;
  lastRefill?: number;
}

export interface CircuitBreakerState {
  serverId: string;
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  lastFailure?: number;
  nextAttempt?: number;
}

export interface ProxyMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedResponses: number;
  rateLimited: number;
  averageLatency: number;
  requestsPerSecond: number;
  bytesIn: number;
  bytesOut: number;
  compressedResponses: number;
  compressionRatio: number;
}

export interface RequestLog {
  id: string;
  timestamp: number;
  method: HttpMethod;
  path: string;
  ip: string;
  userAgent?: string;
  status: number;
  latency: number;
  bytesIn: number;
  bytesOut: number;
  cached: boolean;
  compressed: boolean;
  error?: string;
}

// ============================================================================
// Validation Middleware
// ============================================================================

export class ValidationMiddleware {
  /**
   * Validate request against schema and security rules
   */
  public static async validate(
    request: Request,
    config: ValidationConfig
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Schema validation
    if (config.schema) {
      try {
        const validated = await config.schema.parseAsync(request.body);
        request.body = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
              value: e.path.length > 0 ? this.getNestedValue(request.body, e.path) : undefined,
              code: e.code,
            }))
          );
        } else {
          errors.push({
            field: 'body',
            message: 'Invalid request body',
            code: 'VALIDATION_ERROR',
          });
        }
      }
    }

    // Security validations
    if (config.preventXSS) {
      const xssErrors = this.checkXSS(request);
      errors.push(...xssErrors);
    }

    if (config.preventSQLInjection) {
      const sqlErrors = this.checkSQLInjection(request);
      errors.push(...sqlErrors);
    }

    if (config.preventCommandInjection) {
      const cmdErrors = this.checkCommandInjection(request);
      errors.push(...cmdErrors);
    }

    if (config.preventPathTraversal) {
      const pathErrors = this.checkPathTraversal(request);
      errors.push(...pathErrors);
    }

    // Custom validators
    if (config.customValidators) {
      for (const rule of config.customValidators) {
        const value = this.getFieldValue(request, rule.field);
        const valid = await rule.validator(value);
        if (!valid) {
          errors.push({
            field: rule.field,
            message: rule.message,
            value,
            code: 'CUSTOM_VALIDATION_FAILED',
          });
        }
      }
    }

    // Sanitization
    let sanitized = undefined;
    if (config.sanitize && errors.length === 0) {
      sanitized = this.sanitizeRequest(request, {
        html: config.preventXSS,
        sql: config.preventSQLInjection,
        command: config.preventCommandInjection,
        path: config.preventPathTraversal,
        trim: true,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * Check for XSS patterns
   */
  private static checkXSS(request: Request): ValidationError[] {
    const errors: ValidationError[] = [];
    const checkValue = (value: any, path: string): void => {
      if (typeof value === 'string') {
        for (const pattern of XSS_PATTERNS) {
          if (pattern.test(value)) {
            errors.push({
              field: path,
              message: 'Potential XSS detected',
              code: 'XSS_DETECTED',
            });
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, `${path}.${key}`);
        }
      }
    };

    checkValue(request.body, 'body');
    checkValue(request.query, 'query');
    checkValue(request.params, 'params');

    return errors;
  }

  /**
   * Check for SQL injection patterns
   */
  private static checkSQLInjection(request: Request): ValidationError[] {
    const errors: ValidationError[] = [];
    const checkValue = (value: any, path: string): void => {
      if (typeof value === 'string') {
        for (const pattern of SQL_INJECTION_PATTERNS) {
          if (pattern.test(value)) {
            errors.push({
              field: path,
              message: 'Potential SQL injection detected',
              code: 'SQL_INJECTION_DETECTED',
            });
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, `${path}.${key}`);
        }
      }
    };

    checkValue(request.body, 'body');
    checkValue(request.query, 'query');
    checkValue(request.params, 'params');

    return errors;
  }

  /**
   * Check for command injection patterns
   */
  private static checkCommandInjection(request: Request): ValidationError[] {
    const errors: ValidationError[] = [];
    const checkValue = (value: any, path: string): void => {
      if (typeof value === 'string') {
        for (const pattern of COMMAND_INJECTION_PATTERNS) {
          if (pattern.test(value)) {
            errors.push({
              field: path,
              message: 'Potential command injection detected',
              code: 'COMMAND_INJECTION_DETECTED',
            });
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, `${path}.${key}`);
        }
      }
    };

    checkValue(request.body, 'body');
    checkValue(request.query, 'query');
    checkValue(request.params, 'params');

    return errors;
  }

  /**
   * Check for path traversal patterns
   */
  private static checkPathTraversal(request: Request): ValidationError[] {
    const errors: ValidationError[] = [];
    const checkValue = (value: any, path: string): void => {
      if (typeof value === 'string') {
        for (const pattern of PATH_TRAVERSAL_PATTERNS) {
          if (pattern.test(value)) {
            errors.push({
              field: path,
              message: 'Potential path traversal detected',
              code: 'PATH_TRAVERSAL_DETECTED',
            });
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, `${path}.${key}`);
        }
      }
    };

    checkValue(request.body, 'body');
    checkValue(request.query, 'query');
    checkValue(request.params, 'params');
    checkValue(request.path, 'path');

    return errors;
  }

  /**
   * Sanitize request data
   */
  private static sanitizeRequest(
    request: Request,
    options: SanitizationOptions
  ): Request {
    const sanitized = { ...request };

    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        let cleaned = value;

        if (options.trim) {
          cleaned = cleaned.trim();
        }

        if (options.html) {
          cleaned = this.sanitizeHTML(cleaned);
        }

        if (options.sql) {
          cleaned = this.sanitizeSQL(cleaned);
        }

        if (options.command) {
          cleaned = this.sanitizeCommand(cleaned);
        }

        if (options.path) {
          cleaned = this.sanitizePath(cleaned);
        }

        if (options.lowercase) {
          cleaned = cleaned.toLowerCase();
        }

        if (options.uppercase) {
          cleaned = cleaned.toUpperCase();
        }

        return cleaned;
      } else if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj: any = {};
        for (const [key, val] of Object.entries(value)) {
          sanitizedObj[key] = sanitizeValue(val);
        }
        return sanitizedObj;
      }

      return value;
    };

    sanitized.body = sanitizeValue(request.body);
    sanitized.query = sanitizeValue(request.query);
    sanitized.params = sanitizeValue(request.params);

    return sanitized;
  }

  /**
   * Sanitize HTML content
   */
  private static sanitizeHTML(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize SQL content
   */
  private static sanitizeSQL(input: string): string {
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }

  /**
   * Sanitize command content
   */
  private static sanitizeCommand(input: string): string {
    return input
      .replace(/[;&|`$(){}[\]<>]/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '');
  }

  /**
   * Sanitize path content
   */
  private static sanitizePath(input: string): string {
    return input
      .replace(/\.\./g, '')
      .replace(/~\//g, '')
      .replace(/%2e%2e/gi, '')
      .replace(/%252e/gi, '')
      .replace(/\/etc\//gi, '')
      .replace(/\/var\//gi, '')
      .replace(/\/proc\//gi, '')
      .replace(/\/sys\//gi, '');
  }

  /**
   * Get nested value from object
   */
  private static getNestedValue(obj: any, path: (string | number)[]): any {
    let current = obj;
    for (const key of path) {
      if (current == null) return undefined;
      current = current[key];
    }
    return current;
  }

  /**
   * Get field value from request
   */
  private static getFieldValue(request: Request, field: string): any {
    const parts = field.split('.');
    const source = parts[0];

    if (source === 'body') {
      return this.getNestedValue(request.body, parts.slice(1));
    } else if (source === 'query') {
      return this.getNestedValue(request.query, parts.slice(1));
    } else if (source === 'params') {
      return this.getNestedValue(request.params, parts.slice(1));
    } else if (source === 'headers') {
      return this.getNestedValue(request.headers, parts.slice(1));
    }

    return undefined;
  }

  /**
   * Create validation middleware
   */
  public static createMiddleware(config: ValidationConfig): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const result = await ValidationMiddleware.validate(req, config);

      if (!result.valid) {
        res.status = 400;
        res.body = {
          error: 'Validation failed',
          errors: result.errors,
        };
        return;
      }

      if (result.sanitized) {
        Object.assign(req, result.sanitized);
      }

      await next();
    };
  }
}

// ============================================================================
// API Gateway
// ============================================================================

export class APIGateway extends EventEmitter {
  private config: GatewayConfig;
  private routes: Map<string, Route> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private server?: http.Server | https.Server;
  private metrics: ProxyMetrics;
  private roundRobinIndex: Map<string, number> = new Map();
  private requestLogs: RequestLog[] = [];
  private maxLogSize: number = 10000;

  constructor(config: Partial<GatewayConfig> = {}) {
    super();
    this.config = {
      port: 8080,
      host: '0.0.0.0',
      enableSSL: false,
      enableCaching: true,
      enableRateLimiting: true,
      enableLoadBalancing: true,
      enableCircuitBreaker: true,
      enableCompression: true,
      enableCORS: true,
      enableSecurityHeaders: true,
      enableRequestLogging: true,
      timeout: 30000,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      corsOrigins: ['*'],
      compressionThreshold: 1024, // Compress responses > 1KB
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.startMetricsCollection();
  }

  // ========================================================================
  // Server Management
  // ========================================================================

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestHandler = this.handleRequest.bind(this);

      if (this.config.enableSSL) {
        // SSL configuration would go here
        this.server = https.createServer(requestHandler);
      } else {
        this.server = http.createServer(requestHandler);
      }

      this.server.listen(this.config.port, this.config.host, () => {
        this.emit('server:started', {
          port: this.config.port,
          host: this.config.host,
        });
        resolve();
      });

      this.server.on('error', (error) => {
        this.emit('server:error', { error });
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.emit('server:stopped');
          resolve();
        }
      });
    });
  }

  // ========================================================================
  // Route Management
  // ========================================================================

  public registerRoute(route: Omit<Route, 'id'>): Route {
    const full: Route = {
      ...route,
      id: this.generateId(),
      middleware: route.middleware || [],
    };

    const key = this.getRouteKey(route.method, route.path);
    this.routes.set(key, full);

    this.emit('route:registered', { route: full });

    return full;
  }

  public unregisterRoute(method: HttpMethod, path: string): void {
    const key = this.getRouteKey(method, path);
    this.routes.delete(key);
    this.emit('route:unregistered', { method, path });
  }

  public getRoute(method: HttpMethod, path: string): Route | undefined {
    const key = this.getRouteKey(method, path);
    return this.routes.get(key);
  }

  public listRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  private getRouteKey(method: HttpMethod, path: string): string {
    return `${method}:${path}`;
  }

  // ========================================================================
  // Request Handling
  // ========================================================================

  private async handleRequest(
    rawReq: http.IncomingMessage,
    rawRes: http.ServerResponse
  ): Promise<void> {
    const startTime = Date.now();
    let request: Request;

    try {
      request = await this.parseRequest(rawReq);
    } catch (error) {
      // Handle request parsing errors
      const errorContext: ErrorContext = {
        requestId: this.generateId(),
        method: (rawReq.method || 'UNKNOWN') as any,
        path: rawReq.url || '/',
        ip: rawReq.socket.remoteAddress || 'unknown',
        timestamp: Date.now(),
      };

      const response = ErrorHandler.handleError(error, errorContext);
      await this.sendErrorResponse(rawRes, response);
      return;
    }

    const logEntry: Partial<RequestLog> = {
      id: request.id,
      timestamp: startTime,
      method: request.method,
      path: request.path,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      bytesIn: JSON.stringify(request.body || '').length,
    };

    this.metrics.totalRequests++;
    this.emit('request:received', { request });

    // Log request
    if (this.config.enableRequestLogging) {
      this.logRequest('incoming', request);
    }

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS' && this.config.enableCORS) {
        this.handleCORSPreflight(rawRes);
        return;
      }

      // Find matching route
      const route = this.findRoute(request);
      if (!route) {
        throw new NotFoundError(`Route not found: ${request.method} ${request.path}`, {
          method: request.method,
          path: request.path,
        });
      }

      // Validate request
      if (route.validation) {
        const validationResult = await ValidationMiddleware.validate(request, route.validation);
        if (!validationResult.valid) {
          throw new ValidationError('Validation failed', validationResult.errors, {
            path: request.path,
            method: request.method,
          });
        }

        // Apply sanitization
        if (validationResult.sanitized) {
          Object.assign(request, validationResult.sanitized);
        }
      }

      // Check rate limit
      if (this.config.enableRateLimiting && route.rateLimit) {
        const allowed = await this.checkRateLimit(request, route.rateLimit);
        if (!allowed) {
          this.metrics.rateLimited++;
          throw new RateLimitError(
            'Too many requests',
            route.rateLimit.windowMs,
            {
              limit: route.rateLimit.maxRequests,
              window: route.rateLimit.windowMs,
            }
          );
        }
      }

      // Check authentication
      if (route.auth) {
        const authenticated = await this.checkAuth(request, route.auth);
        if (!authenticated) {
          throw new AuthenticationError('Authentication failed', {
            authType: route.auth.type,
            required: route.auth.required,
          });
        }
      }

      // Check cache
      if (this.config.enableCaching && route.cache && request.method === 'GET') {
        const cached = await this.getCached(request, route.cache);
        if (cached) {
          this.metrics.cachedResponses++;
          const response = {
            ...cached,
            cached: true,
            headers: {
              ...cached.headers,
              'X-Cache': 'HIT'
            }
          };
          await this.sendFinalResponse(rawRes, response, request, logEntry, startTime);
          return;
        }
      }

      // Apply request transformation
      if (route.transform?.request) {
        await this.transformRequest(request, route.transform.request);
      }

      // Execute middleware chain
      let response: Response | undefined;
      const middlewareChain = [...route.middleware];
      let index = 0;

      const next = async (): Promise<void> => {
        if (index < middlewareChain.length) {
          const middleware = middlewareChain[index++];
          await middleware(request, response!, next);
        }
      };

      response = {
        status: 200,
        headers: this.getBaseHeaders(),
      };

      await next();

      // Handle route target
      response = await this.executeRoute(request, route);

      // Ensure base headers are included
      response.headers = {
        ...this.getBaseHeaders(),
        ...response.headers
      };

      // Apply response transformation
      if (route.transform?.response) {
        response = await this.transformResponse(response, route.transform.response);
      }

      // Cache response if applicable
      if (
        this.config.enableCaching &&
        route.cache &&
        request.method === 'GET' &&
        response.status === 200
      ) {
        await this.cacheResponse(request, response, route.cache);
        response.headers['X-Cache'] = 'MISS';
      }

      // Send response
      await this.sendFinalResponse(rawRes, response, request, logEntry, startTime);

      this.metrics.successfulRequests++;

      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);

      this.emit('request:completed', { request, response, latency });
    } catch (error) {
      this.metrics.failedRequests++;

      // Create error context
      const errorContext: ErrorContext = {
        requestId: request.id,
        method: request.method,
        path: request.path,
        ip: request.ip,
        userId: request.metadata.userId,
        timestamp: Date.now(),
        userAgent: request.headers['user-agent'],
        headers: request.headers,
        query: request.query,
      };

      // Handle error and create response
      const response = ErrorHandler.handleError(error, errorContext);

      logEntry.error = error instanceof Error ? error.message : 'Unknown error';
      logEntry.status = response.status;

      this.emit('request:error', { request, error, response });

      // Send error response
      await this.sendFinalResponse(rawRes, response, request, logEntry, startTime);
    }
  }

  /**
   * Send error response (simplified version for early errors)
   */
  private async sendErrorResponse(
    rawRes: http.ServerResponse,
    response: Response
  ): Promise<void> {
    rawRes.statusCode = response.status;

    for (const [key, value] of Object.entries(response.headers)) {
      rawRes.setHeader(key, value);
    }

    if (response.body !== undefined) {
      const body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
      rawRes.end(body);
    } else {
      rawRes.end();
    }
  }

  private async parseRequest(rawReq: http.IncomingMessage): Promise<Request> {
    const url = new URL(rawReq.url || '/', `http://${rawReq.headers.host}`);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawReq.headers)) {
      if (value) {
        headers[key] = Array.isArray(value) ? value[0] : value;
      }
    }

    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    let body: any;
    if (rawReq.method !== 'GET' && rawReq.method !== 'HEAD') {
      body = await this.readRequestBody(rawReq);
    }

    return {
      id: this.generateId(),
      method: (rawReq.method || 'GET') as HttpMethod,
      path: url.pathname,
      headers,
      query,
      body,
      params: {},
      ip: rawReq.socket.remoteAddress || 'unknown',
      timestamp: Date.now(),
      metadata: {},
    };
  }

  private readRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.config.maxRequestSize) {
          req.destroy();
          reject(new PayloadTooLargeError(this.config.maxRequestSize, size));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';

        try {
          if (contentType.includes('application/json')) {
            resolve(JSON.parse(buffer.toString()));
          } else {
            resolve(buffer.toString());
          }
        } catch (error) {
          reject(new ValidationError('Invalid JSON in request body', [], {
            contentType,
            size: buffer.length,
          }));
        }
      });

      req.on('error', (error) => {
        reject(new APIGatewayError('Request read error', 400, 'REQUEST_READ_ERROR', true, {
          originalError: error.message,
        }));
      });
    });
  }

  private findRoute(request: Request): Route | undefined {
    // Exact match first
    const exactKey = this.getRouteKey(request.method, request.path);
    let route = this.routes.get(exactKey);

    if (!route) {
      // Try pattern matching
      for (const r of this.routes.values()) {
        if (r.method === request.method && this.matchPath(r.path, request.path)) {
          route = r;
          request.params = this.extractParams(r.path, request.path);
          break;
        }
      }
    }

    return route;
  }

  private matchPath(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        continue; // Parameter
      }

      if (patternPart !== pathPart) {
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
      const patternPart = patternParts[i];
      if (patternPart.startsWith(':')) {
        const paramName = patternPart.slice(1);
        params[paramName] = pathParts[i];
      }
    }

    return params;
  }

  private async executeRoute(request: Request, route: Route): Promise<Response> {
    switch (route.target.type) {
      case 'function':
        if (!route.target.handler) {
          throw new Error('Handler not defined for function route');
        }
        return await route.target.handler(request);

      case 'static':
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: route.target.content,
        };

      case 'upstream':
        if (!route.target.upstream) {
          throw new Error('Upstream not defined for upstream route');
        }
        return await this.proxyToUpstream(request, route.target.upstream, route.retry);

      default:
        throw new Error(`Unknown route target type: ${route.target.type}`);
    }
  }

  // ========================================================================
  // Upstream Proxying with Enhanced Error Handling
  // ========================================================================

  private async proxyToUpstream(
    request: Request,
    upstream: UpstreamConfig,
    retry?: RetryConfig
  ): Promise<Response> {
    let lastError: Error | undefined;
    const maxAttempts = retry?.maxAttempts || 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && retry) {
        const delay = this.calculateRetryDelay(attempt, retry);
        this.emit('retry:attempt', {
          request: request.id,
          attempt,
          delay,
          reason: lastError?.message
        });
        await this.delay(delay);
      }

      try {
        const server = this.selectUpstreamServer(upstream);
        if (!server) {
          throw new ServiceUnavailableError('No healthy upstream servers available', {
            totalServers: upstream.servers.length,
            healthyServers: 0,
          });
        }

        // Check circuit breaker
        if (this.config.enableCircuitBreaker && upstream.circuitBreaker) {
          const allowed = this.checkCircuitBreaker(server.id);
          if (!allowed) {
            const breakerState = this.circuitBreakers.get(server.id);
            throw new CircuitBreakerError(
              `Circuit breaker open for server ${server.id}`,
              {
                serverId: server.id,
                state: breakerState?.state,
                failures: breakerState?.failures,
                nextAttempt: breakerState?.nextAttempt,
              }
            );
          }
        }

        const response = await this.forwardRequest(request, server);

        // Record success for circuit breaker
        if (this.config.enableCircuitBreaker) {
          this.recordCircuitBreakerSuccess(server.id);
        }

        server.currentConnections--;

        return {
          ...response,
          fromUpstream: server.id,
        };
      } catch (error) {
        lastError = error as Error;

        // Record failure for circuit breaker
        if (this.config.enableCircuitBreaker && upstream.circuitBreaker) {
          const server = this.selectUpstreamServer(upstream);
          if (server) {
            this.recordCircuitBreakerFailure(server.id, upstream.circuitBreaker);
            server.currentConnections = Math.max(0, server.currentConnections - 1);
          }
        }

        // Check if error is retryable
        if (!retry || attempt === maxAttempts - 1) {
          throw this.normalizeUpstreamError(error, attempt + 1);
        }

        if (!this.isRetryableUpstreamError(error as Error, retry)) {
          throw this.normalizeUpstreamError(error, attempt + 1);
        }

        // Log retry decision
        this.emit('retry:decision', {
          request: request.id,
          attempt: attempt + 1,
          maxAttempts,
          error: (error as Error).message,
          willRetry: true,
        });
      }
    }

    throw this.normalizeUpstreamError(lastError || new Error('All retry attempts failed'), maxAttempts);
  }

  /**
   * Normalize upstream errors
   */
  private normalizeUpstreamError(error: any, attempts: number): Error {
    if (error instanceof APIGatewayError) {
      return error;
    }

    const context = { attempts };

    if (error.code === 'ECONNREFUSED') {
      return new UpstreamError('Connection refused by upstream server', undefined, context);
    }

    if (error.code === 'ENOTFOUND') {
      return new UpstreamError('Upstream server not found', undefined, context);
    }

    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return new TimeoutError('Upstream request timeout', context);
    }

    if (error.statusCode && error.statusCode >= 500) {
      return new UpstreamError(
        `Upstream server error: ${error.statusCode}`,
        error.statusCode,
        context
      );
    }

    return new UpstreamError(
      error.message || 'Upstream request failed',
      undefined,
      context
    );
  }

  /**
   * Check if upstream error is retryable
   */
  private isRetryableUpstreamError(error: Error, config: RetryConfig): boolean {
    // Check custom retryable errors
    if (config.retryableErrors.some(pattern => error.message.includes(pattern))) {
      return true;
    }

    // Network errors
    const networkErrors = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
    if (networkErrors.includes((error as any).code)) {
      return true;
    }

    // Check if it's a retryable APIGatewayError
    if (error instanceof APIGatewayError) {
      return ErrorHandler.isRetryable(error);
    }

    // HTTP 5xx errors
    if ((error as any).statusCode >= 500) {
      return config.retryableStatuses.includes((error as any).statusCode);
    }

    return false;
  }

  private selectUpstreamServer(upstream: UpstreamConfig): UpstreamServer | undefined {
    const healthyServers = upstream.servers.filter(s => s.healthy);
    if (healthyServers.length === 0) return undefined;

    switch (upstream.loadBalancing) {
      case 'round_robin':
        return this.selectRoundRobin(healthyServers, upstream);

      case 'least_connections':
        return this.selectLeastConnections(healthyServers);

      case 'weighted_round_robin':
        return this.selectWeightedRoundRobin(healthyServers, upstream);

      case 'random':
        return healthyServers[Math.floor(Math.random() * healthyServers.length)];

      case 'priority':
        return this.selectPriority(healthyServers);

      default:
        return healthyServers[0];
    }
  }

  private selectRoundRobin(
    servers: UpstreamServer[],
    upstream: UpstreamConfig
  ): UpstreamServer {
    const key = servers.map(s => s.id).join(',');
    const index = (this.roundRobinIndex.get(key) || 0) % servers.length;
    this.roundRobinIndex.set(key, index + 1);
    return servers[index];
  }

  private selectLeastConnections(servers: UpstreamServer[]): UpstreamServer {
    return servers.reduce((min, server) =>
      server.currentConnections < min.currentConnections ? server : min
    );
  }

  private selectWeightedRoundRobin(
    servers: UpstreamServer[],
    upstream: UpstreamConfig
  ): UpstreamServer {
    const totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const server of servers) {
      random -= server.weight;
      if (random <= 0) {
        return server;
      }
    }

    return servers[0];
  }

  private selectPriority(servers: UpstreamServer[]): UpstreamServer {
    return servers.reduce((highest, server) =>
      server.priority > highest.priority ? server : highest
    );
  }

  private async forwardRequest(
    request: Request,
    server: UpstreamServer
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const url = new URL(request.path, server.url);
      Object.entries(request.query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      const options = {
        method: request.method,
        headers: request.headers,
        timeout: this.config.timeout,
      };

      const protocol = url.protocol === 'https:' ? https : http;
      server.currentConnections++;

      const timeoutId = setTimeout(() => {
        req.destroy();
        reject(new TimeoutError('Upstream request timeout', {
          server: server.id,
          timeout: this.config.timeout,
        }));
      }, this.config.timeout);

      const req = protocol.request(url, options, (res) => {
        clearTimeout(timeoutId);
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => chunks.push(chunk));

        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || '';

          let parsedBody: any;
          try {
            if (contentType.includes('application/json')) {
              parsedBody = JSON.parse(body.toString());
            } else {
              parsedBody = body.toString();
            }
          } catch {
            parsedBody = body.toString();
          }

          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value) {
              headers[key] = Array.isArray(value) ? value[0] : value;
            }
          }

          const statusCode = res.statusCode || 200;

          // Check if upstream returned an error status
          if (statusCode >= 500) {
            reject(new UpstreamError(
              `Upstream server error: ${statusCode}`,
              statusCode,
              { server: server.id, url: url.toString() }
            ));
            return;
          }

          resolve({
            status: statusCode,
            headers,
            body: parsedBody,
          });
        });

        res.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(new UpstreamError(
            `Upstream response error: ${error.message}`,
            undefined,
            { server: server.id, originalError: error.message }
          ));
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new TimeoutError('Request timeout', { server: server.id }));
      });

      if (request.body) {
        const bodyString =
          typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
        req.write(bodyString);
      }

      req.end();
    });
  }

  // ========================================================================
  // Rate Limiting
  // ========================================================================

  private async checkRateLimit(
    request: Request,
    config: RateLimitConfig
  ): Promise<boolean> {
    const key = config.keyGenerator ? config.keyGenerator(request) : request.ip;
    const now = Date.now();

    let entry = this.rateLimits.get(key);

    if (!entry) {
      entry = {
        key,
        count: 0,
        resetTime: now + config.windowMs,
        tokens: config.maxRequests,
        lastRefill: now,
      };
      this.rateLimits.set(key, entry);
    }

    switch (config.strategy) {
      case 'fixed_window':
        return this.checkFixedWindow(entry, config, now);

      case 'sliding_window':
        return this.checkSlidingWindow(entry, config, now);

      case 'token_bucket':
        return this.checkTokenBucket(entry, config, now);

      default:
        return true;
    }
  }

  private checkFixedWindow(
    entry: RateLimitEntry,
    config: RateLimitConfig,
    now: number
  ): boolean {
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + config.windowMs;
    }

    if (entry.count >= config.maxRequests) {
      this.emit('rate_limit:exceeded', {
        key: entry.key,
        count: entry.count,
        limit: config.maxRequests
      });
      return false;
    }

    entry.count++;
    return true;
  }

  private checkSlidingWindow(
    entry: RateLimitEntry,
    config: RateLimitConfig,
    now: number
  ): boolean {
    const windowStart = now - config.windowMs;

    if (entry.resetTime < windowStart) {
      entry.count = 0;
      entry.resetTime = now;
    }

    if (entry.count >= config.maxRequests) {
      this.emit('rate_limit:exceeded', {
        key: entry.key,
        count: entry.count,
        limit: config.maxRequests
      });
      return false;
    }

    entry.count++;
    return true;
  }

  private checkTokenBucket(
    entry: RateLimitEntry,
    config: RateLimitConfig,
    now: number
  ): boolean {
    const refillRate = config.maxRequests / config.windowMs;
    const elapsed = now - (entry.lastRefill || now);
    const tokensToAdd = Math.floor(elapsed * refillRate);

    entry.tokens = Math.min(
      config.maxRequests,
      (entry.tokens || config.maxRequests) + tokensToAdd
    );
    entry.lastRefill = now;

    if ((entry.tokens || 0) < 1) {
      this.emit('rate_limit:exceeded', {
        key: entry.key,
        tokens: entry.tokens,
        limit: config.maxRequests
      });
      return false;
    }

    entry.tokens = (entry.tokens || 0) - 1;
    return true;
  }

  /**
   * Create per-endpoint rate limiter
   */
  public createRateLimiter(config: RateLimitConfig): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const allowed = await this.checkRateLimit(req, config);

      if (!allowed) {
        res.status = 429;
        res.headers['Retry-After'] = String(Math.ceil(config.windowMs / 1000));
        res.body = {
          error: 'Too many requests',
          retryAfter: Math.ceil(config.windowMs / 1000)
        };
        return;
      }

      await next();
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  public resetRateLimit(key: string): void {
    this.rateLimits.delete(key);
    this.emit('rate_limit:reset', { key });
  }

  /**
   * Get rate limit status for a key
   */
  public getRateLimitStatus(key: string): RateLimitEntry | undefined {
    return this.rateLimits.get(key);
  }

  // ========================================================================
  // Caching
  // ========================================================================

  private async getCached(request: Request, config: CacheConfig): Promise<Response | null> {
    const key = config.keyGenerator ? config.keyGenerator(request) : this.getCacheKey(request);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    this.emit('cache:hit', { key, entry });

    return entry.value;
  }

  private async cacheResponse(
    request: Request,
    response: Response,
    config: CacheConfig
  ): Promise<void> {
    const key = config.keyGenerator ? config.keyGenerator(request) : this.getCacheKey(request);

    const size = JSON.stringify(response.body).length;
    const entry: CacheEntry = {
      key,
      value: response,
      timestamp: Date.now(),
      ttl: config.ttl,
      hits: 0,
      size,
    };

    this.cache.set(key, entry);
    this.emit('cache:set', { key, entry });

    // Evict if over size limit
    this.evictCacheIfNeeded(config.maxSize);
  }

  private getCacheKey(request: Request): string {
    return `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
  }

  private evictCacheIfNeeded(maxSize: number): void {
    const totalSize = Array.from(this.cache.values()).reduce((sum, e) => sum + e.size, 0);

    if (totalSize > maxSize) {
      // LRU eviction
      const entries = Array.from(this.cache.entries()).sort((a, b) => {
        const scoreA = a[1].hits / (Date.now() - a[1].timestamp);
        const scoreB = b[1].hits / (Date.now() - b[1].timestamp);
        return scoreA - scoreB;
      });

      let currentSize = totalSize;
      for (const [key, entry] of entries) {
        if (currentSize <= maxSize * 0.9) break;
        this.cache.delete(key);
        currentSize -= entry.size;
      }
    }
  }

  // ========================================================================
  // Circuit Breaker with Enhanced Error Handling
  // ========================================================================

  private checkCircuitBreaker(serverId: string): boolean {
    const state = this.circuitBreakers.get(serverId);
    if (!state) {
      this.circuitBreakers.set(serverId, {
        serverId,
        state: 'closed',
        failures: 0,
      });
      return true;
    }

    const now = Date.now();

    switch (state.state) {
      case 'closed':
        return true;

      case 'open':
        if (state.nextAttempt && now >= state.nextAttempt) {
          state.state = 'half_open';
          this.emit('circuit_breaker:half_open', { serverId, state });
          return true;
        }
        return false;

      case 'half_open':
        return true;

      default:
        return false;
    }
  }

  private recordCircuitBreakerSuccess(serverId: string): void {
    const state = this.circuitBreakers.get(serverId);
    if (!state) return;

    if (state.state === 'half_open') {
      state.state = 'closed';
      state.failures = 0;
      delete state.lastFailure;
      delete state.nextAttempt;
      this.emit('circuit_breaker:closed', { serverId, reason: 'success_after_half_open' });
    } else if (state.state === 'closed' && state.failures > 0) {
      // Gradually reduce failure count on success
      state.failures = Math.max(0, state.failures - 1);
    }
  }

  private recordCircuitBreakerFailure(
    serverId: string,
    config: CircuitBreakerConfig
  ): void {
    let state = this.circuitBreakers.get(serverId);
    if (!state) {
      state = {
        serverId,
        state: 'closed',
        failures: 0,
      };
      this.circuitBreakers.set(serverId, state);
    }

    state.failures++;
    state.lastFailure = Date.now();

    // If in half-open state, any failure reopens the circuit
    if (state.state === 'half_open') {
      state.state = 'open';
      state.nextAttempt = Date.now() + config.timeout;
      this.emit('circuit_breaker:reopened', {
        serverId,
        state,
        reason: 'failure_in_half_open'
      });
      return;
    }

    // Check if threshold exceeded
    if (state.failures >= config.threshold) {
      state.state = 'open';
      state.nextAttempt = Date.now() + config.timeout;
      this.emit('circuit_breaker:opened', {
        serverId,
        state,
        failures: state.failures,
        threshold: config.threshold
      });
    }
  }

  /**
   * Manually reset circuit breaker for a server
   */
  public resetCircuitBreaker(serverId: string): void {
    const state = this.circuitBreakers.get(serverId);
    if (state) {
      state.state = 'closed';
      state.failures = 0;
      delete state.lastFailure;
      delete state.nextAttempt;
      this.emit('circuit_breaker:reset', { serverId });
    }
  }

  /**
   * Get circuit breaker status for all servers
   */
  public getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  // ========================================================================
  // Authentication
  // ========================================================================

  private async checkAuth(request: Request, config: AuthConfig): Promise<boolean> {
    let token: string | undefined;

    switch (config.type) {
      case 'bearer':
        token = this.extractBearerToken(request);
        break;

      case 'apikey':
        token = request.headers['x-api-key'] || request.query['api_key'];
        break;

      case 'basic':
        token = this.extractBasicAuth(request);
        break;

      case 'jwt':
        token = this.extractBearerToken(request);
        break;

      default:
        return false;
    }

    if (!token) {
      return !config.required;
    }

    return await config.validator(token);
  }

  private extractBearerToken(request: Request): string | undefined {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      return undefined;
    }
    return auth.slice(7);
  }

  private extractBasicAuth(request: Request): string | undefined {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Basic ')) {
      return undefined;
    }
    return Buffer.from(auth.slice(6), 'base64').toString();
  }

  // ========================================================================
  // Transformation
  // ========================================================================

  private async transformRequest(
    request: Request,
    transform: RequestTransform
  ): Promise<void> {
    if (transform.headers) {
      for (const [key, value] of Object.entries(transform.headers)) {
        request.headers[key] = typeof value === 'function' ? value(request) : value;
      }
    }

    if (transform.body && request.body) {
      request.body = transform.body(request.body);
    }

    if (transform.query) {
      Object.assign(request.query, transform.query);
    }
  }

  private async transformResponse(
    response: Response,
    transform: ResponseTransform
  ): Promise<Response> {
    const transformed = { ...response };

    if (transform.headers) {
      Object.assign(transformed.headers, transform.headers);
    }

    if (transform.body && transformed.body) {
      transformed.body = transform.body(transformed.body);
    }

    if (transform.status) {
      transformed.status = transform.status(transformed.status);
    }

    return transformed;
  }

  // ========================================================================
  // Response Sending
  // ========================================================================

  private async sendFinalResponse(
    rawRes: http.ServerResponse,
    response: Response,
    request: Request,
    logEntry: Partial<RequestLog>,
    startTime: number
  ): Promise<void> {
    // Add CORS headers
    if (this.config.enableCORS) {
      this.addCORSHeaders(rawRes, request);
    }

    // Add security headers
    if (this.config.enableSecurityHeaders) {
      this.addSecurityHeaders(rawRes);
    }

    rawRes.statusCode = response.status;

    // Set response headers
    for (const [key, value] of Object.entries(response.headers)) {
      rawRes.setHeader(key, value);
    }

    if (response.body !== undefined) {
      let body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
      const bodyBuffer = Buffer.from(body);

      this.metrics.bytesIn += logEntry.bytesIn || 0;
      logEntry.bytesOut = bodyBuffer.length;

      // Apply compression if enabled and body is large enough
      if (
        this.config.enableCompression &&
        bodyBuffer.length >= this.config.compressionThreshold &&
        this.supportsCompression(request)
      ) {
        const compressed = await this.compressResponse(bodyBuffer, request);
        if (compressed) {
          rawRes.setHeader('Content-Encoding', compressed.encoding);
          rawRes.setHeader('Content-Length', compressed.data.length);
          this.metrics.bytesOut += compressed.data.length;
          this.metrics.compressedResponses++;

          const ratio = bodyBuffer.length / compressed.data.length;
          this.updateCompressionMetrics(ratio);

          logEntry.compressed = true;
          logEntry.bytesOut = compressed.data.length;

          rawRes.end(compressed.data);
        } else {
          rawRes.setHeader('Content-Length', bodyBuffer.length);
          this.metrics.bytesOut += bodyBuffer.length;
          logEntry.compressed = false;
          rawRes.end(body);
        }
      } else {
        rawRes.setHeader('Content-Length', bodyBuffer.length);
        this.metrics.bytesOut += bodyBuffer.length;
        logEntry.compressed = false;
        rawRes.end(body);
      }
    } else {
      rawRes.end();
      logEntry.bytesOut = 0;
    }

    // Complete log entry
    logEntry.status = response.status;
    logEntry.latency = Date.now() - startTime;
    logEntry.cached = response.cached || false;

    if (this.config.enableRequestLogging) {
      this.addRequestLog(logEntry as RequestLog);
      this.logRequest('response', request, undefined, response, logEntry.latency);
    }
  }

  private sendResponse(res: http.ServerResponse, response: Response): void {
    res.statusCode = response.status;

    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }

    if (response.body !== undefined) {
      const body =
        typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
      this.metrics.bytesOut += body.length;
      res.end(body);
    } else {
      res.end();
    }
  }

  // ========================================================================
  // Retry Logic with Enhanced Error Handling
  // ========================================================================

  private isRetryableError(error: Error, config: RetryConfig): boolean {
    return config.retryableErrors.some(pattern => error.message.includes(pattern));
  }

  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    let baseDelay: number;

    switch (config.backoff) {
      case 'fixed':
        baseDelay = config.delay;
        break;

      case 'linear':
        baseDelay = config.delay * attempt;
        break;

      case 'exponential':
        baseDelay = config.delay * Math.pow(2, attempt - 1);
        break;

      default:
        baseDelay = config.delay;
    }

    // Add jitter (±25%) to prevent thundering herd
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(baseDelay + jitter));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create retry middleware for routes
   */
  public createRetryMiddleware(config: RetryConfig): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        if (attempt > 0) {
          const delay = this.calculateRetryDelay(attempt, config);
          await this.delay(delay);
        }

        try {
          await next();
          return; // Success
        } catch (error) {
          lastError = error as Error;

          if (attempt === config.maxAttempts - 1) {
            throw error; // Last attempt, throw error
          }

          if (!this.isRetryableUpstreamError(error as Error, config)) {
            throw error; // Non-retryable, throw immediately
          }
        }
      }

      throw lastError || new Error('All retry attempts failed');
    };
  }

  // ========================================================================
  // Metrics
  // ========================================================================

  private initializeMetrics(): ProxyMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedResponses: 0,
      rateLimited: 0,
      averageLatency: 0,
      requestsPerSecond: 0,
      bytesIn: 0,
      bytesOut: 0,
      compressedResponses: 0,
      compressionRatio: 1.0,
    };
  }

  private updateLatencyMetrics(latency: number): void {
    const total = this.metrics.totalRequests;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (total - 1) + latency) / total;
  }

  private updateCompressionMetrics(ratio: number): void {
    const total = this.metrics.compressedResponses;
    this.metrics.compressionRatio =
      (this.metrics.compressionRatio * (total - 1) + ratio) / total;
  }

  private startMetricsCollection(): void {
    let lastRequestCount = 0;

    setInterval(() => {
      const currentCount = this.metrics.totalRequests;
      this.metrics.requestsPerSecond = currentCount - lastRequestCount;
      lastRequestCount = currentCount;

      this.emit('metrics:updated', { metrics: this.metrics });
    }, 1000);
  }

  public getMetrics(): ProxyMetrics {
    return { ...this.metrics };
  }

  /**
   * Get error logs
   */
  public getErrorLogs(options?: {
    level?: 'error' | 'warn' | 'info';
    code?: string;
    since?: number;
    limit?: number;
  }): ErrorLogEntry[] {
    return ErrorHandler.getErrorLogs(options);
  }

  /**
   * Clear error logs
   */
  public clearErrorLogs(): void {
    ErrorHandler.clearErrorLogs();
  }

  /**
   * Get health status including error rates
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    metrics: ProxyMetrics;
    circuitBreakers: { serverId: string; state: string; failures: number }[];
    errorRate: number;
    recentErrors: ErrorLogEntry[];
  } {
    const totalRequests = this.metrics.totalRequests;
    const errorRate = totalRequests > 0 ? this.metrics.failedRequests / totalRequests : 0;

    const circuitBreakers = Array.from(this.circuitBreakers.values()).map(cb => ({
      serverId: cb.serverId,
      state: cb.state,
      failures: cb.failures,
    }));

    const recentErrors = ErrorHandler.getErrorLogs({
      level: 'error',
      since: Date.now() - 300000, // Last 5 minutes
      limit: 10,
    });

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (errorRate > 0.5) {
      status = 'unhealthy';
    } else if (errorRate > 0.1 || circuitBreakers.some(cb => cb.state === 'open')) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      uptime: Date.now() - (this.metrics as any).startTime || 0,
      metrics: this.metrics,
      circuitBreakers,
      errorRate,
      recentErrors,
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `gateway-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public clearCache(): void {
    this.cache.clear();
    this.emit('cache:cleared');
  }

  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.emit('metrics:reset');
  }

  // ========================================================================
  // CORS Support
  // ========================================================================

  private handleCORSPreflight(res: http.ServerResponse): void {
    res.statusCode = 204;
    this.addCORSHeaders(res, {} as Request);
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.end();
  }

  private addCORSHeaders(res: http.ServerResponse, request: Request): void {
    const origin = request.headers?.origin || '*';
    const allowedOrigin = this.isOriginAllowed(origin) ? origin : this.config.corsOrigins[0];

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');
  }

  private isOriginAllowed(origin: string): boolean {
    if (this.config.corsOrigins.includes('*')) {
      return true;
    }
    return this.config.corsOrigins.includes(origin);
  }

  // ========================================================================
  // Security Headers
  // ========================================================================

  private addSecurityHeaders(res: http.ServerResponse): void {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Strict transport security (if SSL enabled)
    if (this.config.enableSSL) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Content security policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
    );

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );

    // Remove server header
    res.removeHeader('X-Powered-By');
  }

  private getBaseHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Request-ID': this.generateId(),
      'X-Response-Time': Date.now().toString(),
    };
  }

  private getAuthenticateHeader(config: AuthConfig): string {
    switch (config.type) {
      case 'bearer':
      case 'jwt':
        return `Bearer realm="API", charset="UTF-8"`;
      case 'basic':
        return `Basic realm="API", charset="UTF-8"`;
      case 'apikey':
        return `API-Key`;
      default:
        return 'Bearer';
    }
  }

  // ========================================================================
  // Response Compression
  // ========================================================================

  private supportsCompression(request: Request): boolean {
    const acceptEncoding = request.headers['accept-encoding'] || '';
    return acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate') || acceptEncoding.includes('br');
  }

  private async compressResponse(
    data: Buffer,
    request: Request
  ): Promise<{ data: Buffer; encoding: string } | null> {
    const acceptEncoding = request.headers['accept-encoding'] || '';

    return new Promise((resolve) => {
      // Prefer Brotli compression (best ratio)
      if (acceptEncoding.includes('br')) {
        zlib.brotliCompress(data, (err, compressed) => {
          if (err) {
            resolve(null);
          } else {
            resolve({ data: compressed, encoding: 'br' });
          }
        });
      }
      // Then gzip (good balance)
      else if (acceptEncoding.includes('gzip')) {
        zlib.gzip(data, (err, compressed) => {
          if (err) {
            resolve(null);
          } else {
            resolve({ data: compressed, encoding: 'gzip' });
          }
        });
      }
      // Finally deflate (fastest)
      else if (acceptEncoding.includes('deflate')) {
        zlib.deflate(data, (err, compressed) => {
          if (err) {
            resolve(null);
          } else {
            resolve({ data: compressed, encoding: 'deflate' });
          }
        });
      } else {
        resolve(null);
      }
    });
  }

  // ========================================================================
  // Request/Response Logging
  // ========================================================================

  private logRequest(
    phase: 'incoming' | 'response' | 'error',
    request: Request,
    error?: any,
    response?: Response,
    latency?: number
  ): void {
    const timestamp = new Date().toISOString();
    const logData: any = {
      timestamp,
      phase,
      id: request.id,
      method: request.method,
      path: request.path,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    if (phase === 'response' && response) {
      logData.status = response.status;
      logData.latency = latency;
      logData.cached = response.cached;
    }

    if (phase === 'error' && error) {
      logData.error = error instanceof Error ? error.message : String(error);
      logData.stack = error instanceof Error ? error.stack : undefined;
    }

    const logLevel = phase === 'error' ? 'ERROR' : 'INFO';
    const logMessage = this.formatLogMessage(logLevel, logData);

    // Emit log event for external logging systems
    this.emit('log', { level: logLevel, data: logData, message: logMessage });

    // Console logging based on environment
    if (process.env.NODE_ENV === 'development') {
      console.log(logMessage);
    }
  }

  private formatLogMessage(level: string, data: any): string {
    const parts = [
      `[${level}]`,
      `[${data.timestamp}]`,
      `${data.method} ${data.path}`,
      `id=${data.id}`,
      `ip=${data.ip}`,
    ];

    if (data.status) {
      parts.push(`status=${data.status}`);
    }

    if (data.latency !== undefined) {
      parts.push(`latency=${data.latency}ms`);
    }

    if (data.cached) {
      parts.push('cached=true');
    }

    if (data.error) {
      parts.push(`error="${data.error}"`);
    }

    return parts.join(' ');
  }

  private addRequestLog(log: RequestLog): void {
    this.requestLogs.push(log);

    // Keep logs under max size (FIFO)
    if (this.requestLogs.length > this.maxLogSize) {
      this.requestLogs.shift();
    }

    this.emit('request:logged', { log });
  }

  public getRequestLogs(options?: {
    limit?: number;
    status?: number;
    method?: HttpMethod;
    pathPattern?: string;
    since?: number;
  }): RequestLog[] {
    let logs = [...this.requestLogs];

    if (options) {
      if (options.status !== undefined) {
        logs = logs.filter(l => l.status === options.status);
      }

      if (options.method) {
        logs = logs.filter(l => l.method === options.method);
      }

      if (options.pathPattern) {
        const pattern = new RegExp(options.pathPattern);
        logs = logs.filter(l => pattern.test(l.path));
      }

      if (options.since) {
        logs = logs.filter(l => l.timestamp >= options.since);
      }

      if (options.limit) {
        logs = logs.slice(-options.limit);
      }
    }

    return logs;
  }

  public clearRequestLogs(): void {
    this.requestLogs = [];
    this.emit('logs:cleared');
  }
}

// ============================================================================
// Export
// ============================================================================

// Helper functions for creating validation configurations
export const ValidationHelpers = {
  /**
   * Create a complete validation config with all security features
   */
  createSecureValidation(schema: ZodSchema<any>): ValidationConfig {
    return {
      schema,
      sanitize: true,
      preventXSS: true,
      preventSQLInjection: true,
      preventCommandInjection: true,
      preventPathTraversal: true,
    };
  },

  /**
   * Create validation config for API endpoints
   */
  createAPIValidation(schema: ZodSchema<any>): ValidationConfig {
    return {
      schema,
      sanitize: true,
      preventXSS: true,
      preventSQLInjection: true,
    };
  },

  /**
   * Create validation config for file operations
   */
  createFileValidation(schema: ZodSchema<any>): ValidationConfig {
    return {
      schema,
      sanitize: true,
      preventPathTraversal: true,
      preventCommandInjection: true,
    };
  },

  /**
   * Create rate limit config for different endpoint types
   */
  createRateLimit: {
    strict: (): RateLimitConfig => ({
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      strategy: 'sliding_window',
    }),

    moderate: (): RateLimitConfig => ({
      windowMs: 60000, // 1 minute
      maxRequests: 60,
      strategy: 'token_bucket',
    }),

    lenient: (): RateLimitConfig => ({
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      strategy: 'fixed_window',
    }),

    custom: (maxRequests: number, windowMs: number, strategy: RateLimitConfig['strategy']): RateLimitConfig => ({
      windowMs,
      maxRequests,
      strategy,
    }),

    perUser: (maxRequests: number, windowMs: number): RateLimitConfig => ({
      windowMs,
      maxRequests,
      strategy: 'sliding_window',
      keyGenerator: (req: Request) => {
        const userId = req.headers['x-user-id'] || req.metadata['userId'];
        return userId ? `user:${userId}` : req.ip;
      },
    }),

    perEndpoint: (endpoint: string, maxRequests: number, windowMs: number): RateLimitConfig => ({
      windowMs,
      maxRequests,
      strategy: 'token_bucket',
      keyGenerator: (req: Request) => `${endpoint}:${req.ip}`,
    }),
  },

  /**
   * Common validation patterns
   */
  patterns: {
    email: (required = true) => required ? CommonSchemas.email : CommonSchemas.email.optional(),
    phone: (required = true) => required ? CommonSchemas.phone : CommonSchemas.phone.optional(),
    url: (required = true) => required ? CommonSchemas.url : CommonSchemas.url.optional(),
    username: (required = true) => required ? CommonSchemas.username : CommonSchemas.username.optional(),
    password: (required = true) => required ? CommonSchemas.password : CommonSchemas.password.optional(),

    stringWithLength: (min: number, max: number, required = true) => {
      const schema = z.string().min(min).max(max);
      return required ? schema : schema.optional();
    },

    numberInRange: (min: number, max: number, required = true) => {
      const schema = z.number().min(min).max(max);
      return required ? schema : schema.optional();
    },

    integerInRange: (min: number, max: number, required = true) => {
      const schema = z.number().int().min(min).max(max);
      return required ? schema : schema.optional();
    },

    array: (itemSchema: ZodSchema<any>, minLength = 0, maxLength = 100, required = true) => {
      const schema = z.array(itemSchema).min(minLength).max(maxLength);
      return required ? schema : schema.optional();
    },

    enum: <T extends string>(values: T[], required = true) => {
      const schema = z.enum(values as [T, ...T[]]);
      return required ? schema : schema.optional();
    },

    safeText: (maxLength = 1000, required = true) => {
      const schema = CommonSchemas.safeString.max(maxLength);
      return required ? schema : schema.optional();
    },
  },
};

// ============================================================================
// Production-Ready API Handler Factory
// ============================================================================

export class APIHandlerFactory {
  /**
   * Create a complete production-ready API handler with all features
   */
  public static createHandler(config: {
    schema?: ZodSchema<any>;
    auth?: AuthConfig;
    rateLimit?: RateLimitConfig;
    cache?: CacheConfig;
    handler: RequestHandler;
    middleware?: Middleware[];
  }): Route {
    const route: Omit<Route, 'id'> = {
      path: '/',
      method: 'POST',
      target: {
        type: 'function',
        handler: config.handler,
      },
      middleware: config.middleware || [],
      validation: config.schema ? ValidationHelpers.createSecureValidation(config.schema) : undefined,
      auth: config.auth,
      rateLimit: config.rateLimit,
      cache: config.cache,
    };

    return route as Route;
  }

  /**
   * Create RESTful CRUD handlers for a resource
   */
  public static createRESTHandlers<T>(config: {
    resource: string;
    schema: {
      create: ZodSchema<any>;
      update: ZodSchema<any>;
      query: ZodSchema<any>;
    };
    service: {
      list: (query: any) => Promise<T[]>;
      get: (id: string) => Promise<T | null>;
      create: (data: any) => Promise<T>;
      update: (id: string, data: any) => Promise<T>;
      delete: (id: string) => Promise<void>;
    };
    auth?: AuthConfig;
    rateLimit?: RateLimitConfig;
  }): Omit<Route, 'id'>[] {
    const baseAuth = config.auth || {
      type: 'bearer' as const,
      required: true,
      validator: async () => true,
    };

    const baseRateLimit = config.rateLimit || ValidationHelpers.createRateLimit.moderate();

    return [
      // LIST
      {
        path: `/${config.resource}`,
        method: 'GET',
        target: {
          type: 'function',
          handler: async (req: Request): Promise<Response> => {
            try {
              const validated = await config.schema.query.parseAsync(req.query);
              const items = await config.service.list(validated);
              return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: true,
                  data: items,
                  total: items.length,
                  timestamp: Date.now(),
                },
              };
            } catch (error) {
              return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Bad request',
                  timestamp: Date.now(),
                },
              };
            }
          },
        },
        middleware: [],
        auth: baseAuth,
        rateLimit: baseRateLimit,
        cache: {
          ttl: 60000, // 1 minute
          maxSize: 10 * 1024 * 1024,
          storage: 'memory',
        },
      },
      // GET
      {
        path: `/${config.resource}/:id`,
        method: 'GET',
        target: {
          type: 'function',
          handler: async (req: Request): Promise<Response> => {
            try {
              const item = await config.service.get(req.params.id);
              if (!item) {
                return {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                  body: {
                    success: false,
                    error: `${config.resource} not found`,
                    timestamp: Date.now(),
                  },
                };
              }
              return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: true,
                  data: item,
                  timestamp: Date.now(),
                },
              };
            } catch (error) {
              return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Internal error',
                  timestamp: Date.now(),
                },
              };
            }
          },
        },
        middleware: [],
        auth: baseAuth,
        rateLimit: baseRateLimit,
        cache: {
          ttl: 30000, // 30 seconds
          maxSize: 10 * 1024 * 1024,
          storage: 'memory',
        },
      },
      // CREATE
      {
        path: `/${config.resource}`,
        method: 'POST',
        target: {
          type: 'function',
          handler: async (req: Request): Promise<Response> => {
            try {
              const validated = await config.schema.create.parseAsync(req.body);
              const item = await config.service.create(validated);
              return {
                status: 201,
                headers: {
                  'Content-Type': 'application/json',
                  'Location': `/${config.resource}/${(item as any).id}`,
                },
                body: {
                  success: true,
                  data: item,
                  timestamp: Date.now(),
                },
              };
            } catch (error) {
              return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Bad request',
                  timestamp: Date.now(),
                },
              };
            }
          },
        },
        middleware: [],
        validation: ValidationHelpers.createSecureValidation(config.schema.create),
        auth: baseAuth,
        rateLimit: {
          ...baseRateLimit,
          maxRequests: 20, // Stricter for writes
        },
      },
      // UPDATE
      {
        path: `/${config.resource}/:id`,
        method: 'PUT',
        target: {
          type: 'function',
          handler: async (req: Request): Promise<Response> => {
            try {
              const validated = await config.schema.update.parseAsync(req.body);
              const item = await config.service.update(req.params.id, validated);
              return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: true,
                  data: item,
                  timestamp: Date.now(),
                },
              };
            } catch (error) {
              return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Bad request',
                  timestamp: Date.now(),
                },
              };
            }
          },
        },
        middleware: [],
        validation: ValidationHelpers.createSecureValidation(config.schema.update),
        auth: baseAuth,
        rateLimit: {
          ...baseRateLimit,
          maxRequests: 20, // Stricter for writes
        },
      },
      // DELETE
      {
        path: `/${config.resource}/:id`,
        method: 'DELETE',
        target: {
          type: 'function',
          handler: async (req: Request): Promise<Response> => {
            try {
              await config.service.delete(req.params.id);
              return {
                status: 204,
                headers: {},
                body: undefined,
              };
            } catch (error) {
              return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Bad request',
                  timestamp: Date.now(),
                },
              };
            }
          },
        },
        middleware: [],
        auth: baseAuth,
        rateLimit: {
          ...baseRateLimit,
          maxRequests: 10, // Strictest for deletes
        },
      },
    ];
  }
}

// ============================================================================
// Common Middleware Factories
// ============================================================================

export class MiddlewareFactory {
  /**
   * Create logging middleware
   */
  public static logger(): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.status} ${duration}ms`);
    };
  }

  /**
   * Create request ID middleware
   */
  public static requestId(): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      req.metadata.requestId = req.id;
      res.headers['X-Request-ID'] = req.id;
      await next();
    };
  }

  /**
   * Create timeout middleware
   */
  public static timeout(ms: number): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), ms);
      });

      try {
        await Promise.race([next(), timeoutPromise]);
      } catch (error) {
        res.status = 408;
        res.body = {
          error: 'Request timeout',
          timeout: ms,
          timestamp: Date.now(),
        };
      }
    };
  }

  /**
   * Create user context middleware
   */
  public static userContext(): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const userId = req.headers['x-user-id'];
      if (userId) {
        req.metadata.userId = userId;
      }
      await next();
    };
  }

  /**
   * Create error handling middleware with recovery strategies
   */
  public static errorHandler(options?: {
    enableRecovery?: boolean;
    fallbackData?: any;
  }): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      try {
        await next();
      } catch (error) {
        const errorContext: ErrorContext = {
          requestId: req.id,
          method: req.method,
          path: req.path,
          ip: req.ip,
          userId: req.metadata.userId,
          timestamp: Date.now(),
          userAgent: req.headers['user-agent'],
        };

        // Handle error and create response
        const errorResponse = ErrorHandler.handleError(error, errorContext);

        // Apply recovery strategy if enabled
        if (options?.enableRecovery && options.fallbackData) {
          const strategy = ErrorHandler.getRecoveryStrategy(
            error instanceof APIGatewayError ? error : new APIGatewayError(String(error))
          );

          if (strategy.action === 'fallback') {
            res.status = 200;
            res.body = {
              success: true,
              data: options.fallbackData,
              fallback: true,
              originalError: errorResponse.body.error.code,
            };
            res.headers['X-Fallback'] = 'true';
            return;
          }
        }

        // Set error response
        res.status = errorResponse.status;
        res.body = errorResponse.body;
        Object.assign(res.headers, errorResponse.headers);
      }
    };
  }

  /**
   * Create circuit breaker middleware
   */
  public static circuitBreaker(config: {
    threshold: number;
    timeout: number;
    monitoringPeriod: number;
    fallbackResponse?: any;
  }): Middleware {
    const failures = new Map<string, { count: number; lastFailure: number }>();

    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const key = `${req.method}:${req.path}`;
      const failureInfo = failures.get(key);

      // Check if circuit is open
      if (failureInfo) {
        const now = Date.now();
        const timeSinceLastFailure = now - failureInfo.lastFailure;

        if (
          failureInfo.count >= config.threshold &&
          timeSinceLastFailure < config.timeout
        ) {
          // Circuit is open
          res.status = 503;
          res.body = config.fallbackResponse || {
            error: 'Service temporarily unavailable',
            code: 'CIRCUIT_BREAKER_OPEN',
            retryAfter: Math.ceil((config.timeout - timeSinceLastFailure) / 1000),
          };
          return;
        }

        // Reset if monitoring period has passed
        if (timeSinceLastFailure > config.monitoringPeriod) {
          failures.delete(key);
        }
      }

      try {
        await next();

        // Success - reset failure count
        if (res.status < 500) {
          failures.delete(key);
        }
      } catch (error) {
        // Record failure
        const current = failures.get(key) || { count: 0, lastFailure: 0 };
        failures.set(key, {
          count: current.count + 1,
          lastFailure: Date.now(),
        });

        throw error;
      }
    };
  }

  /**
   * Create request size limit middleware
   */
  public static sizeLimit(maxBytes: number): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const size = JSON.stringify(req.body || '').length;
      if (size > maxBytes) {
        res.status = 413;
        res.body = {
          error: 'Request entity too large',
          maxSize: maxBytes,
          actualSize: size,
          timestamp: Date.now(),
        };
        return;
      }
      await next();
    };
  }

  /**
   * Create API key validation middleware
   */
  public static apiKey(validKeys: Set<string>): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const apiKey = req.headers['x-api-key'] || req.query['api_key'];
      if (!apiKey || !validKeys.has(apiKey)) {
        res.status = 401;
        res.body = {
          error: 'Invalid API key',
          timestamp: Date.now(),
        };
        return;
      }
      await next();
    };
  }

  /**
   * Create response time header middleware
   */
  public static responseTime(): Middleware {
    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const start = Date.now();
      await next();
      res.headers['X-Response-Time'] = `${Date.now() - start}ms`;
    };
  }

  /**
   * Create CORS middleware
   */
  public static cors(options?: {
    origins?: string[];
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
  }): Middleware {
    const config = {
      origins: options?.origins || ['*'],
      methods: options?.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      headers: options?.headers || ['Content-Type', 'Authorization'],
      credentials: options?.credentials !== undefined ? options.credentials : true,
    };

    return async (req: Request, res: Response, next: () => Promise<void>) => {
      const origin = req.headers.origin || '*';
      const allowedOrigin = config.origins.includes('*') || config.origins.includes(origin)
        ? origin
        : config.origins[0];

      res.headers['Access-Control-Allow-Origin'] = allowedOrigin;
      res.headers['Access-Control-Allow-Methods'] = config.methods.join(', ');
      res.headers['Access-Control-Allow-Headers'] = config.headers.join(', ');
      if (config.credentials) {
        res.headers['Access-Control-Allow-Credentials'] = 'true';
      }

      if (req.method === 'OPTIONS') {
        res.status = 204;
        return;
      }

      await next();
    };
  }
}

export default APIGateway;
export {
  APIGateway,
  ValidationMiddleware,
  CommonSchemas,
  // Error classes
  APIGatewayError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  CircuitBreakerError,
  UpstreamError,
  PayloadTooLargeError,
  ConfigurationError,
  ServiceUnavailableError,
  // Error handling
  ErrorHandler,
  ErrorContext,
  ErrorLogEntry,
};

// ============================================================================
// Error Recovery Utilities
// ============================================================================

export class ErrorRecovery {
  /**
   * Execute with automatic retry and fallback
   */
  public static async executeWithRecovery<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      backoff?: 'fixed' | 'exponential' | 'linear';
      fallback?: T;
      onRetry?: (attempt: number, error: Error) => void;
      shouldRetry?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    const backoff = options.backoff || 'exponential';
    const shouldRetry = options.shouldRetry || ErrorHandler.isRetryable;

    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (options.onRetry) {
          options.onRetry(attempt + 1, lastError);
        }

        // Check if should retry
        if (attempt < maxRetries - 1 && shouldRetry(lastError)) {
          let delay: number;
          switch (backoff) {
            case 'exponential':
              delay = retryDelay * Math.pow(2, attempt);
              break;
            case 'linear':
              delay = retryDelay * (attempt + 1);
              break;
            case 'fixed':
            default:
              delay = retryDelay;
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    // All retries failed - use fallback if available
    if (options.fallback !== undefined) {
      return options.fallback;
    }

    throw lastError!;
  }

  /**
   * Execute with timeout
   */
  public static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutError?: Error
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(timeoutError || new TimeoutError('Operation timeout')),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Execute with circuit breaker pattern
   */
  public static createCircuitBreaker<T>(options: {
    threshold: number;
    timeout: number;
    monitoringPeriod: number;
    fallback?: T;
  }) {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'closed' | 'open' | 'half_open' = 'closed';

    return async (fn: () => Promise<T>): Promise<T> => {
      const now = Date.now();

      // Reset if monitoring period passed
      if (now - lastFailureTime > options.monitoringPeriod) {
        failures = 0;
        state = 'closed';
      }

      // Check if circuit is open
      if (state === 'open') {
        if (now - lastFailureTime < options.timeout) {
          // Circuit still open
          if (options.fallback !== undefined) {
            return options.fallback;
          }
          throw new CircuitBreakerError('Circuit breaker is open');
        }
        // Try half-open
        state = 'half_open';
      }

      try {
        const result = await fn();

        // Success - reset or close circuit
        if (state === 'half_open') {
          state = 'closed';
          failures = 0;
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        // Open circuit if threshold exceeded
        if (failures >= options.threshold) {
          state = 'open';
        }

        // If in half-open, reopen immediately
        if (state === 'half_open') {
          state = 'open';
        }

        if (options.fallback !== undefined) {
          return options.fallback;
        }

        throw error;
      }
    };
  }

  /**
   * Execute multiple operations with fallback chain
   */
  public static async executeWithFallbackChain<T>(
    operations: Array<() => Promise<T>>
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < operations.length; i++) {
      try {
        return await operations[i]();
      } catch (error) {
        lastError = error as Error;

        // If this is the last operation, throw
        if (i === operations.length - 1) {
          throw lastError;
        }

        // Continue to next fallback
        continue;
      }
    }

    throw lastError!;
  }

  /**
   * Graceful degradation wrapper
   */
  public static async gracefulDegrade<T>(
    primary: () => Promise<T>,
    secondary: () => Promise<T>,
    tertiary?: T
  ): Promise<T> {
    try {
      return await primary();
    } catch (primaryError) {
      try {
        return await secondary();
      } catch (secondaryError) {
        if (tertiary !== undefined) {
          return tertiary;
        }
        throw secondaryError;
      }
    }
  }
}

// ============================================================================
// Error Monitoring & Alerting
// ============================================================================

export class ErrorMonitor {
  private static listeners: Array<(entry: ErrorLogEntry) => void> = [];

  /**
   * Subscribe to error events
   */
  public static onError(listener: (entry: ErrorLogEntry) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit error event
   */
  public static emitError(entry: ErrorLogEntry): void {
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (error) {
        console.error('Error in error listener:', error);
      }
    });
  }

  /**
   * Check error thresholds and alert
   */
  public static checkThresholds(options: {
    errorRateThreshold: number;
    timeWindowMs: number;
    onThresholdExceeded: (stats: {
      errorRate: number;
      totalErrors: number;
      totalRequests: number;
    }) => void;
  }): void {
    const since = Date.now() - options.timeWindowMs;
    const errors = ErrorHandler.getErrorLogs({ since });

    // Calculate error rate (simplified - in production, track total requests too)
    const errorRate = errors.length / 100; // Assuming 100 requests in window

    if (errorRate > options.errorRateThreshold) {
      options.onThresholdExceeded({
        errorRate,
        totalErrors: errors.length,
        totalRequests: 100,
      });
    }
  }

  /**
   * Get error statistics
   */
  public static getErrorStats(since?: number): {
    total: number;
    byCode: Record<string, number>;
    byLevel: Record<string, number>;
    byStatusCode: Record<number, number>;
  } {
    const logs = ErrorHandler.getErrorLogs({ since });

    const stats = {
      total: logs.length,
      byCode: {} as Record<string, number>,
      byLevel: {} as Record<string, number>,
      byStatusCode: {} as Record<number, number>,
    };

    logs.forEach(log => {
      // By code
      stats.byCode[log.error.code] = (stats.byCode[log.error.code] || 0) + 1;

      // By level
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

      // By status code
      stats.byStatusCode[log.error.statusCode] =
        (stats.byStatusCode[log.error.statusCode] || 0) + 1;
    });

    return stats;
  }
}

