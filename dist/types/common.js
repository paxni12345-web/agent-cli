"use strict";
/**
 * Common type definitions for type-safe codebase
 * Centralized types to eliminate 'any' usage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJsonValue = isJsonValue;
exports.isObject = isObject;
exports.isTypedError = isTypedError;
exports.isOk = isOk;
exports.isErr = isErr;
exports.isSome = isSome;
// ============================================================================
// Type Guards
// ============================================================================
/**
 * Check if value is JsonValue
 */
function isJsonValue(value) {
    if (value === null)
        return true;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean')
        return true;
    if (Array.isArray(value))
        return value.every(isJsonValue);
    if (type === 'object') {
        return Object.values(value).every(isJsonValue);
    }
    return false;
}
/**
 * Check if value is object (not null, not array)
 */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Check if error is typed error
 */
function isTypedError(error) {
    return error instanceof Error && 'code' in error;
}
/**
 * Check if result is Ok
 */
function isOk(result) {
    return result.ok === true;
}
/**
 * Check if result is Err
 */
function isErr(result) {
    return result.ok === false;
}
/**
 * Check if value is Some (not null/undefined)
 */
function isSome(value) {
    return value !== null && value !== undefined;
}
