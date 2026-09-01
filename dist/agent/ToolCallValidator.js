"use strict";
/**
 * Tool Call Validator - Advanced validation for tool calls
 *
 * Provides comprehensive validation, sanitization, and safety checks
 * for tool calls to ensure stability and security.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolCallValidator = void 0;
class ToolCallValidator {
    /**
     * Validates a tool call against its schema with detailed error messages
     */
    static validate(toolCall, schema) {
        const errors = [];
        const warnings = [];
        let sanitizedInput = toolCall.input;
        // Check if input exists
        if (toolCall.input === undefined || toolCall.input === null) {
            if (schema.required && schema.required.length > 0) {
                errors.push('Input is required but was not provided');
                return { valid: false, errors, warnings };
            }
            return { valid: true, errors, warnings, sanitizedInput: {} };
        }
        // Validate type
        const inputType = Array.isArray(toolCall.input) ? 'array' : typeof toolCall.input;
        if (schema.type && schema.type !== inputType) {
            errors.push(`Expected ${schema.type}, got ${inputType}`);
            return { valid: false, errors, warnings };
        }
        // Validate object properties
        if (schema.type === 'object' && typeof toolCall.input === 'object') {
            const result = this.validateObject(toolCall.input, schema);
            errors.push(...result.errors);
            warnings.push(...result.warnings);
            sanitizedInput = result.sanitizedInput;
        }
        // Validate array items
        if (schema.type === 'array' && Array.isArray(toolCall.input)) {
            const result = this.validateArray(toolCall.input, schema);
            errors.push(...result.errors);
            warnings.push(...result.warnings);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            sanitizedInput,
        };
    }
    /**
     * Validates object against schema
     */
    static validateObject(input, schema) {
        const errors = [];
        const warnings = [];
        const sanitizedInput = {};
        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in input)) {
                    errors.push(`Missing required field: ${field}`);
                }
            }
        }
        // Validate each property
        if (schema.properties) {
            for (const [key, value] of Object.entries(input)) {
                const propSchema = schema.properties[key];
                if (!propSchema) {
                    warnings.push(`Unknown field: ${key}`);
                    continue;
                }
                // Validate property type
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (propSchema.type && propSchema.type !== actualType) {
                    errors.push(`Field '${key}' should be ${propSchema.type}, got ${actualType}`);
                    continue;
                }
                // Validate string constraints
                if (propSchema.type === 'string' && typeof value === 'string') {
                    if (propSchema.minLength && value.length < propSchema.minLength) {
                        errors.push(`Field '${key}' must be at least ${propSchema.minLength} characters`);
                    }
                    if (propSchema.maxLength && value.length > propSchema.maxLength) {
                        errors.push(`Field '${key}' must be at most ${propSchema.maxLength} characters`);
                    }
                    if (propSchema.pattern) {
                        const regex = new RegExp(propSchema.pattern);
                        if (!regex.test(value)) {
                            errors.push(`Field '${key}' does not match pattern: ${propSchema.pattern}`);
                        }
                    }
                }
                // Validate number constraints
                if (propSchema.type === 'number' && typeof value === 'number') {
                    if (propSchema.minimum !== undefined && value < propSchema.minimum) {
                        errors.push(`Field '${key}' must be at least ${propSchema.minimum}`);
                    }
                    if (propSchema.maximum !== undefined && value > propSchema.maximum) {
                        errors.push(`Field '${key}' must be at most ${propSchema.maximum}`);
                    }
                }
                // Validate enum
                if (propSchema.enum && !propSchema.enum.includes(value)) {
                    errors.push(`Field '${key}' must be one of: ${propSchema.enum.join(', ')}`);
                }
                // Sanitize and add to output
                sanitizedInput[key] = this.sanitizeValue(value, propSchema);
            }
        }
        return { valid: errors.length === 0, errors, warnings, sanitizedInput };
    }
    /**
     * Validates array against schema
     */
    static validateArray(input, schema) {
        const errors = [];
        const warnings = [];
        if (schema.minItems && input.length < schema.minItems) {
            errors.push(`Array must have at least ${schema.minItems} items`);
        }
        if (schema.maxItems && input.length > schema.maxItems) {
            errors.push(`Array must have at most ${schema.maxItems} items`);
        }
        // Validate items if schema provided
        if (schema.items) {
            input.forEach((item, index) => {
                const itemSchema = schema.items;
                const itemType = Array.isArray(item) ? 'array' : typeof item;
                if (itemSchema.type && itemSchema.type !== itemType) {
                    errors.push(`Item at index ${index} should be ${itemSchema.type}, got ${itemType}`);
                }
            });
        }
        return { valid: errors.length === 0, errors, warnings };
    }
    /**
     * Sanitizes value based on schema
     */
    static sanitizeValue(value, schema) {
        // Trim strings
        if (schema.type === 'string' && typeof value === 'string') {
            return value.trim();
        }
        // Ensure numbers are finite
        if (schema.type === 'number' && typeof value === 'number') {
            if (!isFinite(value)) {
                return 0;
            }
        }
        return value;
    }
    /**
     * Checks if tool input contains dangerous patterns
     */
    static checkSafety(toolCall) {
        const issues = [];
        const inputStr = JSON.stringify(toolCall.input);
        // Check for path traversal
        if (inputStr.includes('../') || inputStr.includes('..\\')) {
            issues.push('Potential path traversal detected');
        }
        // Check for command injection patterns
        const dangerousPatterns = [
            /;\s*rm\s+-rf/i,
            /\|\s*bash/i,
            /`.*`/,
            /\$\(/,
            /&&/,
            /\|\|/,
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(inputStr)) {
                issues.push(`Potentially dangerous pattern detected: ${pattern}`);
            }
        }
        // Check for excessive size
        if (inputStr.length > 1000000) { // 1MB
            issues.push('Input size exceeds safe limit (1MB)');
        }
        return {
            safe: issues.length === 0,
            issues,
        };
    }
    /**
     * Suggests fixes for common validation errors
     */
    static suggestFix(error, toolCall) {
        if (error.includes('Missing required field')) {
            const field = error.match(/field: (\w+)/)?.[1];
            return field ? `Add the required field '${field}' to the input` : null;
        }
        if (error.includes('should be') && error.includes('got')) {
            const match = error.match(/should be (\w+), got (\w+)/);
            if (match) {
                return `Convert the input to ${match[1]} type`;
            }
        }
        if (error.includes('not found')) {
            return 'Check the tool name and available tools list';
        }
        return null;
    }
}
exports.ToolCallValidator = ToolCallValidator;
