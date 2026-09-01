/**
 * Advanced Validation & Schema System
 * JSON Schema validation, custom validators, complex rules
 * Type coercion, sanitization, error formatting
 */
import { EventEmitter } from 'events';
export interface ValidationManagerConfig {
    enableTypeCoercion: boolean;
    enableSanitization: boolean;
    enableCustomValidators: boolean;
    strictMode: boolean;
    stopOnFirstError: boolean;
    maxErrors: number;
}
export interface ValidationSchema {
    id: string;
    name: string;
    type: SchemaType;
    rules: ValidationRule[];
    properties?: Map<string, ValidationSchema>;
    items?: ValidationSchema;
    metadata: SchemaMetadata;
}
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'any' | 'null';
export interface ValidationRule {
    type: RuleType;
    value?: any;
    message?: string;
    custom?: CustomValidator;
}
export type RuleType = 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url' | 'uuid' | 'date' | 'enum' | 'custom' | 'unique' | 'arrayMinItems' | 'arrayMaxItems' | 'objectMinProperties' | 'objectMaxProperties' | 'multipleOf' | 'divisibleBy' | 'range' | 'in' | 'notIn' | 'match' | 'oneOf' | 'allOf' | 'anyOf' | 'not';
export type CustomValidator = (value: any, context: ValidationContext) => boolean | string;
export interface ValidationContext {
    path: string[];
    root: any;
    parent?: any;
    schema: ValidationSchema;
    options: ValidationOptions;
}
export interface ValidationOptions {
    coerce?: boolean;
    sanitize?: boolean;
    strict?: boolean;
    stopOnFirstError?: boolean;
    context?: Record<string, any>;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    data?: any;
    metadata: ResultMetadata;
}
export interface ValidationError {
    path: string;
    rule: RuleType;
    message: string;
    value?: any;
    expected?: any;
}
export interface ValidationWarning {
    path: string;
    message: string;
    value?: any;
}
export interface ResultMetadata {
    duration: number;
    coerced: string[];
    sanitized: string[];
}
export interface SchemaMetadata {
    description?: string;
    examples?: any[];
    default?: any;
    deprecated?: boolean;
    createdAt: number;
    updatedAt: number;
}
export interface Validator {
    id: string;
    name: string;
    validate: CustomValidator;
    async?: boolean;
}
export interface SanitizationRule {
    type: SanitizationType;
    options?: Record<string, any>;
}
export type SanitizationType = 'trim' | 'lowercase' | 'uppercase' | 'escape' | 'unescape' | 'stripTags' | 'normalizeEmail' | 'normalizeWhitespace' | 'removeNonPrintable' | 'custom';
export interface TypeCoercion {
    from: SchemaType;
    to: SchemaType;
    coerce: (value: any) => any;
}
export declare class ValidationManager extends EventEmitter {
    private config;
    private schemas;
    private validators;
    private coercions;
    constructor(config?: Partial<ValidationManagerConfig>);
    createSchema(name: string, type: SchemaType, rules?: ValidationRule[]): ValidationSchema;
    createObjectSchema(name: string, properties: Map<string, ValidationSchema>, rules?: ValidationRule[]): ValidationSchema;
    createArraySchema(name: string, itemSchema: ValidationSchema, rules?: ValidationRule[]): ValidationSchema;
    getSchema(id: string): ValidationSchema | undefined;
    getSchemaByName(name: string): ValidationSchema | undefined;
    validate(data: any, schema: ValidationSchema, options?: ValidationOptions): ValidationResult;
    private validateValue;
    private validateType;
    private validateRule;
    private coerceType;
    private getActualType;
    private initializeTypeCoercions;
    private sanitize;
    registerValidator(validator: Validator): void;
    getValidator(id: string): Validator | undefined;
    private initializeBuiltInValidators;
    private isValidEmail;
    private isValidUrl;
    private isValidUUID;
    string(rules?: ValidationRule[]): ValidationSchema;
    number(rules?: ValidationRule[]): ValidationSchema;
    integer(rules?: ValidationRule[]): ValidationSchema;
    boolean(rules?: ValidationRule[]): ValidationSchema;
    object(properties: Map<string, ValidationSchema>, rules?: ValidationRule[]): ValidationSchema;
    array(itemSchema: ValidationSchema, rules?: ValidationRule[]): ValidationSchema;
    fromJSONSchema(jsonSchema: any): ValidationSchema;
    toJSONSchema(schema: ValidationSchema): any;
    private generateId;
    getStats(): ValidationStats;
}
interface ValidationStats {
    schemas: number;
    validators: number;
    coercions: number;
}
export default ValidationManager;
//# sourceMappingURL=ValidationManager.d.ts.map