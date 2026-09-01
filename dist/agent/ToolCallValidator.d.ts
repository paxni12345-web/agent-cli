/**
 * Tool Call Validator - Advanced validation for tool calls
 *
 * Provides comprehensive validation, sanitization, and safety checks
 * for tool calls to ensure stability and security.
 */
import { ToolCall, JSONSchema } from '../types/index.js';
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedInput?: any;
}
export declare class ToolCallValidator {
    /**
     * Validates a tool call against its schema with detailed error messages
     */
    static validate(toolCall: ToolCall, schema: JSONSchema): ValidationResult;
    /**
     * Validates object against schema
     */
    private static validateObject;
    /**
     * Validates array against schema
     */
    private static validateArray;
    /**
     * Sanitizes value based on schema
     */
    private static sanitizeValue;
    /**
     * Checks if tool input contains dangerous patterns
     */
    static checkSafety(toolCall: ToolCall): {
        safe: boolean;
        issues: string[];
    };
    /**
     * Suggests fixes for common validation errors
     */
    static suggestFix(error: string, toolCall: ToolCall): string | null;
}
//# sourceMappingURL=ToolCallValidator.d.ts.map