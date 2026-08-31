/**
 * COMPREHENSIVE ERROR HANDLING SYSTEM
 * Custom error classes, middleware, logging, and recovery strategies
 */

import { EventEmitter } from 'events';

// ============================================================================
// Custom Error Classes
// ============================================================================

export class APIGatewayError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    context?: Record<string, any>,
    requestId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();
    this.requestId = requestId;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      requestId: this.requestId,
      context: this.context,
    };
  }
}

export class ValidationError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 400, 'VALIDATION_ERROR', true, context, requestId);
  }
}

export class AuthenticationError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, context, requestId);
  }
}

export class AuthorizationError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, context, requestId);
  }
}

export class NotFoundError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 404, 'NOT_FOUND', true, context, requestId);
  }
}

export class RateLimitError extends APIGatewayError {
  public readonly retryAfter: number;

  constructor(
    message: string,
    retryAfter: number,
    context?: Record<string, any>,
    requestId?: string
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, context, requestId);
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 408, 'REQUEST_TIMEOUT', true, context, requestId);
  }
}

export class ServiceUnavailableError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 503, 'SERVICE_UNAVAILABLE', true, context, requestId);
  }
}

export class BadGatewayError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 502, 'BAD_GATEWAY', true, context, requestId);
  }
}

export class CircuitBreakerOpenError extends ServiceUnavailableError {
  constructor(service: string, requestId?: string) {
    super(
      `Circuit breaker is open for ${service}`,
      { service },
      requestId
    );
    this.code = 'CIRCUIT_BREAKER_OPEN';
  }
}

export class PayloadTooLargeError extends APIGatewayError {
  constructor(
    message: string,
    maxSize: number,
    actualSize: number,
    requestId?: string
  ) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', true, { maxSize, actualSize }, requestId);
  }
}

export class ConflictError extends APIGatewayError {
  constructor(message: string, context?: Record<string, any>, requestId?: string) {
    super(message, 409, 'CONFLICT', true, context, requestId);
  }
}

export class UpstreamError extends APIGatewayError {
  public readonly upstreamService: string;
  public readonly upstreamStatus?: number;

  constructor(
    message: string,
    upstreamService: string,
    upstreamStatus?: number,
    requestId?: string
  ) {
    super(
      message,
      upstreamStatus || 502,
      'UPSTREAM_ERROR',
      true,
      { upstreamService, upstreamStatus },
      requestId
    );
    this.upstreamService = upstreamService;
    this.upstreamStatus = upstreamStatus;
  }
}

// ============================================================================
// Error Context & Tracking
// ============================================================================

export interface ErrorContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  userId?: string;
  timestamp: Date;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}

export interface ErrorLog {
  id: string;
  error: APIGatewayError | Error;
  context: ErrorContext;
  stackTrace: string;
  sanitizedStackTrace: string;
  timestamp: Date;
  severity: ErrorSeverity;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Stack Trace Sanitizer
// ============================================================================

export class StackTraceSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    /password[=:]\s*['"]?([^'"&\s]+)/gi,
    /token[=:]\s*['"]?([^'"&\s]+)/gi,
    /api[_-]?key[=:]\s*['"]?([^'"&\s]+)/gi,
    /secret[=:]\s*['"]?([^'"&\s]+)/gi,
    /authorization:\s*['"]?([^'"&\s]+)/gi,
    /bearer\s+([a-zA-Z0-9\-._~+/]+=*)/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // Credit card
  ];

  private static readonly INTERNAL_PATHS = [
    /\/node_modules\//g,
    /\(internal\//g,
  ];

  public static sanitize(stackTrace: string): string {
    let sanitized = stackTrace;

    // Replace sensitive data
    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        const colonIndex = match.indexOf(':');
        const equalsIndex = match.indexOf('=');
        const splitIndex = Math.max(colonIndex, equalsIndex);
        if (splitIndex > 0) {
          return match.substring(0, splitIndex + 1) + ' ***';
        }
        return '***';
      });
    }

    return sanitized;
  }

  public static filterInternalFrames(stackTrace: string): string {
    const lines = stackTrace.split('\n');
    const filtered = lines.filter(line => {
      return !this.INTERNAL_PATHS.some(pattern => pattern.test(line));
    });
    return filtered.join('\n');
  }

  public static getRelevantFrames(stackTrace: string, limit: number = 10): string {
    const lines = stackTrace.split('\n');
    return lines.slice(0, limit).join('\n');
  }
}

// ============================================================================
// Error Logger
// ============================================================================

export class ErrorLogger extends EventEmitter {
  private errorLogs: ErrorLog[] = [];
  private readonly maxLogs: number;

  constructor(maxLogs: number = 1000) {
    super();
    this.maxLogs = maxLogs;
  }

  public log(error: Error, context: ErrorContext): ErrorLog {
    const severity = this.determineSeverity(error);
    const stackTrace = error.stack || '';
    const sanitizedStackTrace = StackTraceSanitizer.sanitize(
      StackTraceSanitizer.filterInternalFrames(stackTrace)
    );

    const errorLog: ErrorLog = {
      id: this.generateId(),
      error,
      context: this.sanitizeContext(context),
      stackTrace,
      sanitizedStackTrace,
      timestamp: new Date(),
      severity,
    };

    this.errorLogs.push(errorLog);

    // Trim logs if exceeds max
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogs);
    }

    // Emit log event
    this.emit('error:logged', errorLog);

    // Emit severity-specific events
    if (severity === 'critical' || severity === 'high') {
      this.emit('error:critical', errorLog);
    }

    return errorLog;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    if (error instanceof APIGatewayError) {
      if (!error.isOperational) {
        return 'critical';
      }

      if (error.statusCode >= 500) {
        return 'high';
      }

      if (error.statusCode === 429 || error.statusCode === 403) {
        return 'medium';
      }

      return 'low';
    }

    // Unknown errors are critical
    return 'critical';
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized = { ...context };

    // Sanitize headers
    if (sanitized.headers) {
      sanitized.headers = this.sanitizeHeaders(sanitized.headers);
    }

    // Sanitize body (remove sensitive fields)
    if (sanitized.body && typeof sanitized.body === 'object') {
      sanitized.body = this.sanitizeObject(sanitized.body);
    }

    return sanitized;
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'cookie',
      'set-cookie',
      'x-auth-token',
      'x-csrf-token',
    ];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '***';
      }
    }

    return sanitized;
  }

  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'privateKey',
      'private_key',
      'creditCard',
      'ssn',
    ];

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  public getLogs(filter?: {
    severity?: ErrorSeverity;
    since?: Date;
    limit?: number;
  }): ErrorLog[] {
    let logs = [...this.errorLogs];

    if (filter) {
      if (filter.severity) {
        logs = logs.filter(log => log.severity === filter.severity);
      }

      if (filter.since) {
        logs = logs.filter(log => log.timestamp >= filter.since);
      }

      if (filter.limit) {
        logs = logs.slice(-filter.limit);
      }
    }

    return logs;
  }

  public getStats(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    recent: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let recent = 0;

    for (const log of this.errorLogs) {
      bySeverity[log.severity]++;
      if (log.timestamp >= oneHourAgo) {
        recent++;
      }
    }

    return {
      total: this.errorLogs.length,
      bySeverity,
      recent,
    };
  }

  private generateId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ============================================================================
// Error Response Formatter
// ============================================================================

export class ErrorResponseFormatter {
  public static format(
    error: Error,
    requestId: string,
    includeStack: boolean = false
  ): {
    error: {
      code: string;
      message: string;
      statusCode: number;
      timestamp: string;
      requestId: string;
      details?: any;
      stack?: string;
    };
  } {
    if (error instanceof APIGatewayError) {
      return {
        error: {
          code: error.code,
          message: this.getUserFriendlyMessage(error),
          statusCode: error.statusCode,
          timestamp: error.timestamp.toISOString(),
          requestId: error.requestId || requestId,
          details: error.context,
          ...(includeStack && {
            stack: StackTraceSanitizer.getRelevantFrames(
              StackTraceSanitizer.sanitize(error.stack || ''),
              5
            ),
          }),
        },
      };
    }

    // Generic error
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: this.getUserFriendlyMessage(error),
        statusCode: 500,
        timestamp: new Date().toISOString(),
        requestId,
        ...(includeStack && {
          stack: StackTraceSanitizer.getRelevantFrames(
            StackTraceSanitizer.sanitize(error.stack || ''),
            5
          ),
        }),
      },
    };
  }

  private static getUserFriendlyMessage(error: Error): string {
    if (error instanceof APIGatewayError) {
      // Return the original message for operational errors
      if (error.isOperational) {
        return error.message;
      }
    }

    // Map common error patterns to user-friendly messages
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'The request took too long to process. Please try again.';
    }

    if (message.includes('connection') || message.includes('econnrefused')) {
      return 'Unable to connect to the service. Please try again later.';
    }

    if (message.includes('network') || message.includes('dns')) {
      return 'Network error occurred. Please check your connection.';
    }

    if (message.includes('parse') || message.includes('json')) {
      return 'Invalid request format. Please check your data.';
    }

    // Generic message for unknown errors
    return 'An unexpected error occurred. Please try again or contact support.';
  }
}

// ============================================================================
// Retry Strategy
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  retryableStatusCodes: number[];
}

export class RetryStrategy {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
    ],
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  };

  public static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryable(error as Error, fullConfig)) {
          throw error;
        }

        // Don't wait after the last attempt
        if (attempt < fullConfig.maxRetries) {
          const delay = this.calculateDelay(attempt, fullConfig);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private static isRetryable(error: Error, config: RetryConfig): boolean {
    // Check if it's a retryable API Gateway error
    if (error instanceof APIGatewayError) {
      return config.retryableStatusCodes.includes(error.statusCode);
    }

    // Check error code
    const errorCode = (error as any).code;
    if (errorCode && config.retryableErrors.includes(errorCode)) {
      return true;
    }

    // Check error message for common patterns
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('unavailable')
    );
  }

  private static calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay =
      config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
    return Math.min(exponentialDelay + jitter, config.maxDelay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Enhanced Circuit Breaker
// ============================================================================

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenRequests: number;
  monitoringPeriod: number;
  volumeThreshold: number;
}

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastStateChange: Date;
  nextAttempt?: Date;
  halfOpenAttempts: number;
}

export class EnhancedCircuitBreaker extends EventEmitter {
  private metrics: CircuitBreakerMetrics;
  private readonly options: CircuitBreakerOptions;
  private readonly serviceName: string;

  constructor(serviceName: string, options: Partial<CircuitBreakerOptions> = {}) {
    super();
    this.serviceName = serviceName;
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      halfOpenRequests: 3,
      monitoringPeriod: 10000,
      volumeThreshold: 10,
      ...options,
    };

    this.metrics = {
      state: 'closed',
      failures: 0,
      successes: 0,
      totalRequests: 0,
      lastStateChange: new Date(),
      halfOpenAttempts: 0,
    };
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.metrics.state === 'open') {
      if (
        this.metrics.nextAttempt &&
        new Date() >= this.metrics.nextAttempt
      ) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerOpenError(this.serviceName);
      }
    }

    // Check half-open request limit
    if (
      this.metrics.state === 'half_open' &&
      this.metrics.halfOpenAttempts >= this.options.halfOpenRequests
    ) {
      throw new CircuitBreakerOpenError(this.serviceName);
    }

    this.metrics.totalRequests++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.metrics.successes++;
    this.metrics.failures = 0;

    if (this.metrics.state === 'half_open') {
      this.metrics.halfOpenAttempts++;

      if (this.metrics.successes >= this.options.successThreshold) {
        this.transitionToClosed();
      }
    }

    this.emit('success', {
      service: this.serviceName,
      state: this.metrics.state,
      successes: this.metrics.successes,
    });
  }

  private onFailure(): void {
    this.metrics.failures++;
    this.metrics.lastFailureTime = new Date();
    this.metrics.successes = 0;

    if (this.metrics.state === 'half_open') {
      this.transitionToOpen();
    } else if (this.metrics.state === 'closed') {
      // Check if we should open the circuit
      if (
        this.metrics.totalRequests >= this.options.volumeThreshold &&
        this.metrics.failures >= this.options.failureThreshold
      ) {
        this.transitionToOpen();
      }
    }

    this.emit('failure', {
      service: this.serviceName,
      state: this.metrics.state,
      failures: this.metrics.failures,
    });
  }

  private transitionToOpen(): void {
    this.metrics.state = 'open';
    this.metrics.nextAttempt = new Date(Date.now() + this.options.timeout);
    this.metrics.lastStateChange = new Date();
    this.metrics.halfOpenAttempts = 0;

    this.emit('state:open', {
      service: this.serviceName,
      failures: this.metrics.failures,
      nextAttempt: this.metrics.nextAttempt,
    });
  }

  private transitionToHalfOpen(): void {
    this.metrics.state = 'half_open';
    this.metrics.successes = 0;
    this.metrics.halfOpenAttempts = 0;
    this.metrics.lastStateChange = new Date();

    this.emit('state:half_open', {
      service: this.serviceName,
    });
  }

  private transitionToClosed(): void {
    this.metrics.state = 'closed';
    this.metrics.failures = 0;
    this.metrics.successes = 0;
    this.metrics.totalRequests = 0;
    this.metrics.lastStateChange = new Date();
    this.metrics.halfOpenAttempts = 0;
    this.metrics.nextAttempt = undefined;

    this.emit('state:closed', {
      service: this.serviceName,
    });
  }

  public getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  public reset(): void {
    this.transitionToClosed();
  }

  public forceOpen(): void {
    this.transitionToOpen();
  }
}

// ============================================================================
// Error Recovery Strategies
// ============================================================================

export interface RecoveryStrategy {
  name: string;
  canHandle: (error: Error) => boolean;
  recover: (error: Error, context: any) => Promise<any>;
}

export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [];

  public registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  public async attemptRecovery(error: Error, context: any): Promise<{
    recovered: boolean;
    result?: any;
    strategy?: string;
  }> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(error)) {
        try {
          const result = await strategy.recover(error, context);
          return {
            recovered: true,
            result,
            strategy: strategy.name,
          };
        } catch (recoveryError) {
          // Strategy failed, try next one
          continue;
        }
      }
    }

    return { recovered: false };
  }
}

// Default recovery strategies
export const CacheRecoveryStrategy: RecoveryStrategy = {
  name: 'cache_fallback',
  canHandle: (error: Error) => {
    return (
      error instanceof ServiceUnavailableError ||
      error instanceof TimeoutError ||
      error instanceof UpstreamError
    );
  },
  recover: async (error: Error, context: any) => {
    // Attempt to return cached response
    if (context.cache && context.cacheKey) {
      const cached = context.cache.get(context.cacheKey);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          stale: true,
        };
      }
    }
    throw error;
  },
};

export const FallbackServiceStrategy: RecoveryStrategy = {
  name: 'fallback_service',
  canHandle: (error: Error) => {
    return error instanceof ServiceUnavailableError || error instanceof UpstreamError;
  },
  recover: async (error: Error, context: any) => {
    // Attempt to use fallback service
    if (context.fallbackService) {
      return await context.fallbackService();
    }
    throw error;
  },
};

export const DefaultResponseStrategy: RecoveryStrategy = {
  name: 'default_response',
  canHandle: (error: Error) => {
    return error instanceof ServiceUnavailableError;
  },
  recover: async (error: Error, context: any) => {
    // Return a default safe response
    if (context.defaultResponse) {
      return context.defaultResponse;
    }
    throw error;
  },
};
