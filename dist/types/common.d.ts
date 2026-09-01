/**
 * Common type definitions for type-safe codebase
 * Centralized types to eliminate 'any' usage
 */
/**
 * Type-safe JSON value - replaces any for JSON data
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = {
    [key: string]: JsonValue;
};
export type JsonArray = JsonValue[];
/**
 * Unknown record type - safer than any for objects
 */
export type UnknownRecord = Record<string, unknown>;
/**
 * Type-safe error with additional context
 */
export interface TypedError extends Error {
    code?: string;
    statusCode?: number;
    context?: UnknownRecord;
    cause?: Error;
}
/**
 * Generic tool input with validation schema
 */
export interface ToolInput {
    [key: string]: JsonValue;
}
/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    data?: JsonValue;
    metadata?: UnknownRecord;
}
/**
 * Tool context for execution environment
 */
export interface ToolContext {
    workingDirectory: string;
    environment: NodeJS.ProcessEnv;
    userId?: string;
    sessionId?: string;
    metadata?: UnknownRecord;
}
/**
 * Tool definition with type-safe schema
 */
export interface Tool {
    name: string;
    description: string;
    input_schema: JsonObject;
    execute: (input: ToolInput, context: ToolContext) => Promise<ToolResult>;
}
/**
 * Database query parameters (safe SQL parameters)
 */
export type QueryParameter = string | number | boolean | null | Date | Buffer;
export type QueryParameters = QueryParameter[];
/**
 * Database row result
 */
export type DatabaseRow = Record<string, QueryParameter | JsonValue>;
/**
 * Query result with metadata
 */
export interface QueryResult<T = DatabaseRow> {
    rows: T[];
    rowCount: number;
    affectedRows: number;
    insertId?: number;
    fields?: string[];
    executionTime?: number;
}
/**
 * HTTP headers
 */
export type HttpHeaders = Record<string, string | string[]>;
/**
 * HTTP request body (validated)
 */
export type HttpBody = JsonValue | string | Buffer;
/**
 * HTTP response data
 */
export interface HttpResponse<T = JsonValue> {
    status: number;
    headers: HttpHeaders;
    body: T;
    cached?: boolean;
    fromUpstream?: string;
}
/**
 * API error response
 */
export interface ApiErrorResponse {
    success: false;
    error: {
        message: string;
        code: string;
        timestamp: number;
        requestId?: string;
        validationErrors?: ValidationError[];
        stack?: string;
        context?: UnknownRecord;
    };
}
/**
 * API success response
 */
export interface ApiSuccessResponse<T = JsonValue> {
    success: true;
    data: T;
    metadata?: UnknownRecord;
}
/**
 * Union type for API responses
 */
export type ApiResponse<T = JsonValue> = ApiSuccessResponse<T> | ApiErrorResponse;
/**
 * Validation error details
 */
export interface ValidationError {
    field: string;
    message: string;
    value?: JsonValue;
    code: string;
}
/**
 * Validation result
 */
export interface ValidationResult<T = unknown> {
    valid: boolean;
    errors: ValidationError[];
    sanitized?: T;
    data?: T;
}
/**
 * Database configuration
 */
export interface DatabaseConfig {
    type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'redis';
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    poolSize?: number;
    timeout?: number;
    connectionString?: string;
    logging?: boolean;
}
/**
 * Cache configuration
 */
export interface CacheConfig {
    ttl: number;
    maxSize: number;
    storage: 'memory' | 'redis' | 'disk';
    keyPrefix?: string;
}
/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    strategy: 'sliding_window' | 'fixed_window' | 'token_bucket';
    keyGenerator?: (context: UnknownRecord) => string;
}
/**
 * Generic event payload
 */
export interface EventPayload<T = UnknownRecord> {
    type: string;
    timestamp: number;
    data: T;
    source?: string;
    correlationId?: string;
}
/**
 * Event handler
 */
export type EventHandler<T = UnknownRecord> = (payload: EventPayload<T>) => void | Promise<void>;
/**
 * Async function that returns typed result
 */
export type AsyncFunction<T = unknown, Args extends unknown[] = unknown[]> = (...args: Args) => Promise<T>;
/**
 * Callback with error-first pattern
 */
export type Callback<T = unknown> = (error: Error | null, result?: T) => void;
/**
 * Transformer function
 */
export type Transformer<TInput, TOutput> = (input: TInput) => TOutput;
/**
 * Validator function
 */
export type Validator<T> = (value: T) => boolean | Promise<boolean>;
/**
 * Predicate function
 */
export type Predicate<T> = (value: T) => boolean;
/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};
/**
 * Extract keys of specific type
 */
export type KeysOfType<T, V> = {
    [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];
/**
 * Strict extract (no any leakage)
 */
export type StrictExtract<T, U extends T> = T extends U ? T : never;
/**
 * Safe Omit that preserves type safety
 */
export type SafeOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/**
 * Require at least one property
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
}[Keys];
/**
 * Require exactly one property
 */
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, never>>;
}[Keys];
declare const brand: unique symbol;
/**
 * Brand a type to make it unique
 */
export type Brand<T, B> = T & {
    [brand]: B;
};
/**
 * User ID (branded string)
 */
export type UserId = Brand<string, 'UserId'>;
/**
 * Session ID (branded string)
 */
export type SessionId = Brand<string, 'SessionId'>;
/**
 * Request ID (branded string)
 */
export type RequestId = Brand<string, 'RequestId'>;
/**
 * Connection ID (branded string)
 */
export type ConnectionId = Brand<string, 'ConnectionId'>;
/**
 * Success result
 */
export interface Ok<T> {
    ok: true;
    value: T;
}
/**
 * Error result
 */
export interface Err<E = Error> {
    ok: false;
    error: E;
}
/**
 * Result type for error handling without exceptions
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;
/**
 * Option type for nullable values
 */
export type Option<T> = T | null | undefined;
/**
 * Non-nullable version
 */
export type Some<T> = NonNullable<T>;
/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    requestsPerSecond: number;
    bytesIn: number;
    bytesOut: number;
    timestamp: number;
}
/**
 * Statistics summary
 */
export interface Statistics {
    count: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;
    percentiles: {
        p50: number;
        p75: number;
        p90: number;
        p95: number;
        p99: number;
    };
}
/**
 * Paginated request parameters
 */
export interface PaginationParams {
    page: number;
    perPage: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    from: number;
    to: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}
/**
 * ISO date string
 */
export type ISODateString = Brand<string, 'ISODateString'>;
/**
 * Unix timestamp (milliseconds)
 */
export type UnixTimestamp = Brand<number, 'UnixTimestamp'>;
/**
 * Date range
 */
export interface DateRange {
    start: Date;
    end: Date;
}
/**
 * Create operation input
 */
export interface CreateInput<T> {
    data: T;
    metadata?: UnknownRecord;
}
/**
 * Update operation input
 */
export interface UpdateInput<T> {
    id: string | number;
    data: Partial<T>;
    metadata?: UnknownRecord;
}
/**
 * Delete operation input
 */
export interface DeleteInput {
    id: string | number;
    soft?: boolean;
    metadata?: UnknownRecord;
}
/**
 * Find operation options
 */
export interface FindOptions {
    filters?: UnknownRecord;
    sort?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    offset?: number;
    include?: string[];
}
/**
 * Check if value is JsonValue
 */
export declare function isJsonValue(value: unknown): value is JsonValue;
/**
 * Check if value is object (not null, not array)
 */
export declare function isObject(value: unknown): value is UnknownRecord;
/**
 * Check if error is typed error
 */
export declare function isTypedError(error: unknown): error is TypedError;
/**
 * Check if result is Ok
 */
export declare function isOk<T, E>(result: Result<T, E>): result is Ok<T>;
/**
 * Check if result is Err
 */
export declare function isErr<T, E>(result: Result<T, E>): result is Err<E>;
/**
 * Check if value is Some (not null/undefined)
 */
export declare function isSome<T>(value: Option<T>): value is Some<T>;
export {};
//# sourceMappingURL=common.d.ts.map