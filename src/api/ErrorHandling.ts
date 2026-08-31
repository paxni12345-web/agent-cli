/**
 * Comprehensive Error Handling System for API Gateway
 * Includes custom error classes, error middleware, logging, retry logic, and circuit breaker
 */

import { APIRequest, APIResponse, RequestContext } from './APIGateway';
import { eventBus } from '../core/EventBus';

/**
 * Base API Error class with additional context
 */
export class APIError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, any> {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        timestamp: this.timestamp.toISOString(),
        details: this.details,
      },
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 */
export class ValidationError extends APIError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

/**
 * Authentication Error - 401 Unauthorized
 */
export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required', details?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, details);
  }
}

/**
 * Authorization Error - 403 Forbidden
 */
export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, any>) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, details);
  }
}

/**
 * Not Found Error - 404 Not Found
 */
export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource', details?: Record<string, any>) {
    super(`${resource} not found`, 404, 'NOT_FOUND', true, details);
  }
}

/**
 * Conflict Error - 409 Conflict
 */
export class ConflictError extends APIError {
  constructor(message: string = 'Resource conflict', details?: Record<string, any>) {
    super(message, 409, 'CONFLICT_ERROR', true, details);
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 */
export class RateLimitError extends APIError {
  public readonly retryAfter?: Date;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: Date, details?: Record<string, any>) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, details);
    this.retryAfter = retryAfter;
  }

  toJSON(): Record<string, any> {
    const json = super.toJSON();
    if (this.retryAfter) {
      json.error.retryAfter = this.retryAfter.toISOString();
    }
    return json;
  }
}

/**
 * Service Unavailable Error - 503
 */
export class ServiceUnavailableError extends APIError {
  constructor(message: string = 'Service temporarily unavailable', details?: Record<string, any>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', true, details);
  }
}

/**
 * Gateway Timeout Error - 504
 */
export class GatewayTimeoutError extends APIError {
  constructor(message: string = 'Gateway timeout', details?: Record<string, any>) {
    super(message, 504, 'GATEWAY_TIMEOUT', true, details);
  }
}

/**
 * Database Error - 500
 */
export class DatabaseError extends APIError {
  constructor(message: string = 'Database operation failed', details?: Record<string, any>) {
    super(message, 500, 'DATABASE_ERROR', true, details);
  }
}

/**
 * External Service Error - 502 Bad Gateway
 */
export class ExternalServiceError extends APIError {
  constructor(service: string, message?: string, details?: Record<string, any>) {
    super(
      message || `External service ${service} failed`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { service, ...details }
    );
  }
}

/**
 * Circuit Breaker Open Error
 */
export class CircuitBreakerOpenError extends APIError {
  constructor(service: string, details?: Record<string, any>) {
    super(
      `Circuit breaker open for service: ${service}`,
      503,
      'CIRCUIT_BREAKER_OPEN',
      true,
      { service, ...details }
    );
  }
}

/**
 * Error context for logging
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  duration?: number;
  additionalData?: Record<string, any>;
}

/**
 * Error Logger with structured logging
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private errorLog: ErrorLogEntry[] = [];
  private readonly maxLogSize: number = 1000;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log error with context
   */
  log(error: Error, context: ErrorContext, severity: ErrorSeverity = 'error'): void {
    const entry: ErrorLogEntry = {
      error: {
        name: error.name,
        message: error.message,
        stack: this.sanitizeStackTrace(error.stack),
        code: error instanceof APIError ? error.code : undefined,
        statusCode: error instanceof APIError ? error.statusCode : 500,
      },
      context,
      severity,
      timestamp: new Date(),
    };

    this.errorLog.push(entry);

    // Maintain max log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Emit event for external monitoring
    eventBus.emitSync('error.logged', entry, 'ErrorLogger');

    // Console logging based on severity
    this.consoleLog(entry);
  }

  /**
   * Sanitize stack trace to remove sensitive information
   */
  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;

    return stack
      .split('\n')
      .map(line => {
        // Remove file paths that might contain usernames
        return line.replace(/\/home\/[^\/]+/g, '/home/user')
                   .replace(/\/Users\/[^\/]+/g, '/Users/user')
                   .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\user');
      })
      .slice(0, 10) // Limit stack trace depth
      .join('\n');
  }

  /**
   * Console log based on severity
   */
  private consoleLog(entry: ErrorLogEntry): void {
    const logData = {
      timestamp: entry.timestamp.toISOString(),
      severity: entry.severity,
      error: entry.error.name,
      message: entry.error.message,
      code: entry.error.code,
      requestId: entry.context.requestId,
      path: entry.context.path,
    };

    switch (entry.severity) {
      case 'critical':
      case 'error':
        console.error('[ERROR]', JSON.stringify(logData, null, 2));
        break;
      case 'warning':
        console.warn('[WARNING]', JSON.stringify(logData, null, 2));
        break;
      case 'info':
        console.info('[INFO]', JSON.stringify(logData, null, 2));
        break;
    }
  }

  /**
   * Get error logs
   */
  getLogs(filter?: { severity?: ErrorSeverity; limit?: number }): ErrorLogEntry[] {
    let logs = [...this.errorLog];

    if (filter?.severity) {
      logs = logs.filter(log => log.severity === filter.severity);
    }

    if (filter?.limit) {
      logs = logs.slice(-filter.limit);
    }

    return logs;
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.errorLog = [];
  }
}

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorLogEntry {
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode: number;
  };
  context: ErrorContext;
  severity: ErrorSeverity;
  timestamp: Date;
}

/**
 * Error Response Builder
 */
export class ErrorResponseBuilder {
  /**
   * Build user-friendly error response
   */
  static build(error: Error, context?: RequestContext, includeStack: boolean = false): APIResponse {
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (error instanceof APIError) {
      const response: APIResponse = {
        statusCode: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: {
            message: this.getUserFriendlyMessage(error),
            code: error.code,
            timestamp: error.timestamp.toISOString(),
          },
        },
      };

      // Add request ID if available
      if (context?.requestId) {
        response.body.error.requestId = context.requestId;
      }

      // Add details in development or for operational errors
      if (isDevelopment || error.isOperational) {
        if (error.details) {
          response.body.error.details = error.details;
        }
      }

      // Add stack trace only in development
      if (isDevelopment && includeStack && error.stack) {
        response.body.error.stack = error.stack.split('\n').slice(0, 10);
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

    // Generic error response
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: {
          message: isDevelopment ? error.message : 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
          requestId: context?.requestId,
          ...(isDevelopment && includeStack && error.stack ? { stack: error.stack.split('\n').slice(0, 10) } : {}),
        },
      },
    };
  }

  /**
   * Get user-friendly error message
   */
  private static getUserFriendlyMessage(error: APIError): string {
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
}

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors?: string[];
  retryableStatusCodes?: number[];
}

/**
 * Retry Handler with exponential backoff
 */
export class RetryHandler {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
  };

  /**
   * Execute function with retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    let lastError: Error | undefined;
    let delay = fullConfig.initialDelay;

    for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError, fullConfig);

        // Don't retry on last attempt or non-retryable errors
        if (attempt === fullConfig.maxAttempts || !isRetryable) {
          throw lastError;
        }

        // Log retry attempt
        console.warn(
          `Retry attempt ${attempt}/${fullConfig.maxAttempts} after ${delay}ms`,
          { error: lastError.message }
        );

        // Wait before retrying
        await this.sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * fullConfig.backoffMultiplier, fullConfig.maxDelay);
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: Error, config: RetryConfig): boolean {
    // Check status codes for API errors
    if (error instanceof APIError) {
      return config.retryableStatusCodes?.includes(error.statusCode) || false;
    }

    // Check error codes
    const errorCode = (error as any).code;
    if (errorCode && config.retryableErrors?.includes(errorCode)) {
      return true;
    }

    // Check error message for common transient issues
    const message = error.message.toLowerCase();
    const transientPatterns = ['timeout', 'connection', 'network', 'unavailable', 'econnreset'];
    return transientPatterns.some(pattern => message.includes(pattern));
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker State
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // milliseconds
  resetTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
}

/**
 * Circuit Breaker Statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Circuit Breaker for downstream services
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;

  private readonly config: CircuitBreakerConfig;
  private readonly serviceName: string;

  private static readonly DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 60000,
    monitoringPeriod: 60000,
  };

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = { ...CircuitBreaker.DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.info(`Circuit breaker for ${this.serviceName} entering HALF_OPEN state`);
      } else {
        throw new CircuitBreakerOpenError(this.serviceName, {
          nextAttemptTime: this.nextAttemptTime,
        });
      }
    }

    this.totalRequests++;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure();

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new GatewayTimeoutError('Circuit breaker timeout')),
          this.config.timeout
        )
      ),
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.totalSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.reset();
        console.info(`Circuit breaker for ${this.serviceName} reset to CLOSED state`);
      }
    }

    eventBus.emitSync('circuit_breaker.success', {
      service: this.serviceName,
      stats: this.getStats(),
    }, 'CircuitBreaker');
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();
    this.totalFailures++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
      console.warn(`Circuit breaker for ${this.serviceName} reopened after failure in HALF_OPEN state`);
    } else if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.open();
      console.error(`Circuit breaker for ${this.serviceName} opened after ${this.consecutiveFailures} consecutive failures`);
    }

    eventBus.emitSync('circuit_breaker.failure', {
      service: this.serviceName,
      stats: this.getStats(),
    }, 'CircuitBreaker');
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);

    eventBus.emitSync('circuit_breaker.opened', {
      service: this.serviceName,
      stats: this.getStats(),
    }, 'CircuitBreaker');
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? Date.now() >= this.nextAttemptTime.getTime() : false;
  }

  /**
   * Reset circuit breaker
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.nextAttemptTime = undefined;

    eventBus.emitSync('circuit_breaker.reset', {
      service: this.serviceName,
      stats: this.getStats(),
    }, 'CircuitBreaker');
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Manually reset circuit breaker
   */
  forceReset(): void {
    this.reset();
    console.info(`Circuit breaker for ${this.serviceName} manually reset`);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Circuit Breaker Manager
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get circuit breaker statistics for all services
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceReset();
    }
  }
}

/**
 * Error Recovery Strategies
 */
export class ErrorRecoveryStrategy {
  /**
   * Attempt recovery for common error scenarios
   */
  static async attemptRecovery(error: Error, context: ErrorContext): Promise<boolean> {
    if (error instanceof RateLimitError) {
      // Wait and retry strategy
      console.warn('Rate limit hit, waiting before retry', {
        requestId: context.requestId,
        retryAfter: error.retryAfter,
      });
      return true; // Can retry after waiting
    }

    if (error instanceof ServiceUnavailableError) {
      // Service might recover
      console.warn('Service unavailable, can retry', {
        requestId: context.requestId,
      });
      return true;
    }

    if (error instanceof GatewayTimeoutError) {
      // Timeout might be transient
      console.warn('Gateway timeout, can retry', {
        requestId: context.requestId,
      });
      return true;
    }

    if (error instanceof ExternalServiceError) {
      // External service might recover
      console.warn('External service error, can retry', {
        requestId: context.requestId,
        service: error.details?.service,
      });
      return true;
    }

    // Non-recoverable errors
    return false;
  }

  /**
   * Get fallback response for error
   */
  static getFallbackResponse(error: Error, context?: RequestContext): APIResponse | null {
    // Return cached or default response for certain errors
    if (error instanceof ServiceUnavailableError || error instanceof CircuitBreakerOpenError) {
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: {
            message: 'Service temporarily unavailable. Using cached data.',
            code: 'FALLBACK_RESPONSE',
            timestamp: new Date().toISOString(),
          },
          data: null, // Could be populated with cached data
        },
      };
    }

    return null;
  }
}

/**
 * Singleton instances
 */
export const errorLogger = ErrorLogger.getInstance();
export const circuitBreakerManager = CircuitBreakerManager.getInstance();
