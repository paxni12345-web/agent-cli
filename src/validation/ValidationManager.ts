/**
 * Advanced Validation & Schema System
 * JSON Schema validation, custom validators, complex rules
 * Type coercion, sanitization, error formatting
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type RuleType =
  | 'required'
  | 'min'
  | 'max'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'email'
  | 'url'
  | 'uuid'
  | 'date'
  | 'enum'
  | 'custom'
  | 'unique'
  | 'arrayMinItems'
  | 'arrayMaxItems'
  | 'objectMinProperties'
  | 'objectMaxProperties'
  | 'multipleOf'
  | 'divisibleBy'
  | 'range'
  | 'in'
  | 'notIn'
  | 'match'
  | 'oneOf'
  | 'allOf'
  | 'anyOf'
  | 'not';

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

export type SanitizationType =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'escape'
  | 'unescape'
  | 'stripTags'
  | 'normalizeEmail'
  | 'normalizeWhitespace'
  | 'removeNonPrintable'
  | 'custom';

export interface TypeCoercion {
  from: SchemaType;
  to: SchemaType;
  coerce: (value: any) => any;
}

// ============================================================================
// Validation Manager
// ============================================================================

export class ValidationManager extends EventEmitter {
  private config: ValidationManagerConfig;
  private schemas: Map<string, ValidationSchema> = new Map();
  private validators: Map<string, Validator> = new Map();
  private coercions: TypeCoercion[] = [];

  constructor(config: Partial<ValidationManagerConfig> = {}) {
    super();
    this.config = {
      enableTypeCoercion: true,
      enableSanitization: true,
      enableCustomValidators: true,
      strictMode: false,
      stopOnFirstError: false,
      maxErrors: 100,
      ...config,
    };

    this.initializeBuiltInValidators();
    this.initializeTypeCoercions();
  }

  // ========================================================================
  // Schema Management
  // ========================================================================

  public createSchema(
    name: string,
    type: SchemaType,
    rules: ValidationRule[] = []
  ): ValidationSchema {
    const schema: ValidationSchema = {
      id: this.generateId(),
      name,
      type,
      rules,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    this.schemas.set(schema.id, schema);
    this.emit('schema:created', { schema });

    return schema;
  }

  public createObjectSchema(
    name: string,
    properties: Map<string, ValidationSchema>,
    rules: ValidationRule[] = []
  ): ValidationSchema {
    const schema = this.createSchema(name, 'object', rules);
    schema.properties = properties;
    return schema;
  }

  public createArraySchema(
    name: string,
    itemSchema: ValidationSchema,
    rules: ValidationRule[] = []
  ): ValidationSchema {
    const schema = this.createSchema(name, 'array', rules);
    schema.items = itemSchema;
    return schema;
  }

  public getSchema(id: string): ValidationSchema | undefined {
    return this.schemas.get(id);
  }

  public getSchemaByName(name: string): ValidationSchema | undefined {
    return Array.from(this.schemas.values()).find(s => s.name === name);
  }

  // ========================================================================
  // Validation
  // ========================================================================

  public validate(
    data: any,
    schema: ValidationSchema,
    options: ValidationOptions = {}
  ): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const coerced: string[] = [];
    const sanitized: string[] = [];

    const mergedOptions: ValidationOptions = {
      coerce: options.coerce ?? this.config.enableTypeCoercion,
      sanitize: options.sanitize ?? this.config.enableSanitization,
      strict: options.strict ?? this.config.strictMode,
      stopOnFirstError: options.stopOnFirstError ?? this.config.stopOnFirstError,
      context: options.context || {},
    };

    const context: ValidationContext = {
      path: [],
      root: data,
      schema,
      options: mergedOptions,
    };

    let processedData = data;

    // Type coercion
    if (mergedOptions.coerce) {
      const coercionResult = this.coerceType(data, schema, context);
      if (coercionResult.coerced) {
        processedData = coercionResult.value;
        coerced.push(...coercionResult.paths);
      }
    }

    // Sanitization
    if (mergedOptions.sanitize) {
      const sanitizationResult = this.sanitize(processedData, schema, context);
      processedData = sanitizationResult.value;
      sanitized.push(...sanitizationResult.paths);
    }

    // Validation
    this.validateValue(processedData, schema, context, errors, warnings);

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      data: processedData,
      metadata: {
        duration: Date.now() - startTime,
        coerced,
        sanitized,
      },
    };

    this.emit('validation:completed', { result });

    return result;
  }

  private validateValue(
    value: any,
    schema: ValidationSchema,
    context: ValidationContext,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const path = context.path.join('.');

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push({
        path,
        rule: 'type' as RuleType,
        message: `Expected type ${schema.type}, got ${typeof value}`,
        value,
        expected: schema.type,
      });

      if (context.options.stopOnFirstError) return;
    }

    // Rule validation
    for (const rule of schema.rules) {
      if (errors.length >= this.config.maxErrors) break;

      const error = this.validateRule(value, rule, context);
      if (error) {
        errors.push(error);
        if (context.options.stopOnFirstError) return;
      }
    }

    // Object property validation
    if (schema.type === 'object' && schema.properties) {
      if (typeof value === 'object' && value !== null) {
        for (const [propName, propSchema] of schema.properties.entries()) {
          const propValue = value[propName];
          const propContext: ValidationContext = {
            ...context,
            path: [...context.path, propName],
            parent: value,
            schema: propSchema,
          };

          this.validateValue(propValue, propSchema, propContext, errors, warnings);
        }

        // Check for unknown properties in strict mode
        if (context.options.strict) {
          for (const key of Object.keys(value)) {
            if (!schema.properties.has(key)) {
              warnings.push({
                path: `${path}.${key}`,
                message: `Unknown property '${key}'`,
                value: value[key],
              });
            }
          }
        }
      }
    }

    // Array item validation
    if (schema.type === 'array' && schema.items) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const itemContext: ValidationContext = {
            ...context,
            path: [...context.path, String(i)],
            parent: value,
            schema: schema.items,
          };

          this.validateValue(value[i], schema.items, itemContext, errors, warnings);
        }
      }
    }
  }

  private validateType(value: any, type: SchemaType): boolean {
    if (type === 'any') return true;
    if (type === 'null') return value === null;

    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (type === 'integer') {
      return typeof value === 'number' && Number.isInteger(value);
    }

    if (type === 'number') {
      return typeof value === 'number';
    }

    return actualType === type;
  }

  private validateRule(
    value: any,
    rule: ValidationRule,
    context: ValidationContext
  ): ValidationError | null {
    const path = context.path.join('.');

    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            path,
            rule: rule.type,
            message: rule.message || 'This field is required',
            value,
          };
        }
        break;

      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Value must be at least ${rule.value}`,
            value,
            expected: rule.value,
          };
        }
        break;

      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Value must be at most ${rule.value}`,
            value,
            expected: rule.value,
          };
        }
        break;

      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Length must be at least ${rule.value}`,
            value,
            expected: rule.value,
          };
        }
        break;

      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Length must be at most ${rule.value}`,
            value,
            expected: rule.value,
          };
        }
        break;

      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Value does not match pattern ${rule.value}`,
            value,
            expected: rule.value,
          };
        }
        break;

      case 'email':
        if (typeof value === 'string' && !this.isValidEmail(value)) {
          return {
            path,
            rule: rule.type,
            message: rule.message || 'Invalid email address',
            value,
          };
        }
        break;

      case 'url':
        if (typeof value === 'string' && !this.isValidUrl(value)) {
          return {
            path,
            rule: rule.type,
            message: rule.message || 'Invalid URL',
            value,
          };
        }
        break;

      case 'uuid':
        if (typeof value === 'string' && !this.isValidUUID(value)) {
          return {
            path,
            rule: rule.type,
            message: rule.message || 'Invalid UUID',
            value,
          };
        }
        break;

      case 'enum':
        if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Value must be one of: ${rule.value.join(', ')}`,
            value,
            expected: rule.value,
          };
        }
        break;

      case 'arrayMinItems':
        if (Array.isArray(value) && value.length < rule.value) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Array must have at least ${rule.value} items`,
            value: value.length,
            expected: rule.value,
          };
        }
        break;

      case 'arrayMaxItems':
        if (Array.isArray(value) && value.length > rule.value) {
          return {
            path,
            rule: rule.type,
            message: rule.message || `Array must have at most ${rule.value} items`,
            value: value.length,
            expected: rule.value,
          };
        }
        break;

      case 'custom':
        if (rule.custom) {
          const result = rule.custom(value, context);
          if (result !== true) {
            return {
              path,
              rule: rule.type,
              message: typeof result === 'string' ? result : (rule.message || 'Custom validation failed'),
              value,
            };
          }
        }
        break;
    }

    return null;
  }

  // ========================================================================
  // Type Coercion
  // ========================================================================

  private coerceType(
    value: any,
    schema: ValidationSchema,
    context: ValidationContext
  ): { value: any; coerced: boolean; paths: string[] } {
    const paths: string[] = [];
    let coerced = false;
    let result = value;

    // Find appropriate coercion
    const actualType = this.getActualType(value);
    if (actualType !== schema.type && schema.type !== 'any') {
      const coercion = this.coercions.find(
        c => c.from === actualType && c.to === schema.type
      );

      if (coercion) {
        try {
          result = coercion.coerce(value);
          coerced = true;
          paths.push(context.path.join('.'));
        } catch (error) {
          // Coercion failed, leave value as is
        }
      }
    }

    return { value: result, coerced, paths };
  }

  private getActualType(value: any): SchemaType {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    return typeof value as SchemaType;
  }

  private initializeTypeCoercions(): void {
    // String to Number
    this.coercions.push({
      from: 'string',
      to: 'number',
      coerce: (value: string) => {
        const num = Number(value);
        if (isNaN(num)) throw new Error('Cannot coerce to number');
        return num;
      },
    });

    // String to Boolean
    this.coercions.push({
      from: 'string',
      to: 'boolean',
      coerce: (value: string) => {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
        throw new Error('Cannot coerce to boolean');
      },
    });

    // Number to String
    this.coercions.push({
      from: 'number',
      to: 'string',
      coerce: (value: number) => String(value),
    });

    // Boolean to String
    this.coercions.push({
      from: 'boolean',
      to: 'string',
      coerce: (value: boolean) => String(value),
    });
  }

  // ========================================================================
  // Sanitization
  // ========================================================================

  private sanitize(
    value: any,
    schema: ValidationSchema,
    context: ValidationContext
  ): { value: any; paths: string[] } {
    const paths: string[] = [];
    let result = value;

    if (typeof value === 'string') {
      // Apply common sanitization
      result = value.trim();
      if (result !== value) {
        paths.push(context.path.join('.'));
      }
    }

    return { value: result, paths };
  }

  // ========================================================================
  // Custom Validators
  // ========================================================================

  public registerValidator(validator: Validator): void {
    if (!this.config.enableCustomValidators) {
      throw new Error('Custom validators are not enabled');
    }

    this.validators.set(validator.id, validator);
    this.emit('validator:registered', { validator });
  }

  public getValidator(id: string): Validator | undefined {
    return this.validators.get(id);
  }

  // ========================================================================
  // Built-in Validators
  // ========================================================================

  private initializeBuiltInValidators(): void {
    // Email validator
    this.registerValidator({
      id: 'email',
      name: 'Email Validator',
      validate: (value: any) => this.isValidEmail(value),
    });

    // URL validator
    this.registerValidator({
      id: 'url',
      name: 'URL Validator',
      validate: (value: any) => this.isValidUrl(value),
    });

    // UUID validator
    this.registerValidator({
      id: 'uuid',
      name: 'UUID Validator',
      validate: (value: any) => this.isValidUUID(value),
    });
  }

  private isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  // ========================================================================
  // Schema Builders
  // ========================================================================

  public string(rules: ValidationRule[] = []): ValidationSchema {
    return this.createSchema('string', 'string', rules);
  }

  public number(rules: ValidationRule[] = []): ValidationSchema {
    return this.createSchema('number', 'number', rules);
  }

  public integer(rules: ValidationRule[] = []): ValidationSchema {
    return this.createSchema('integer', 'integer', rules);
  }

  public boolean(rules: ValidationRule[] = []): ValidationSchema {
    return this.createSchema('boolean', 'boolean', rules);
  }

  public object(
    properties: Map<string, ValidationSchema>,
    rules: ValidationRule[] = []
  ): ValidationSchema {
    return this.createObjectSchema('object', properties, rules);
  }

  public array(itemSchema: ValidationSchema, rules: ValidationRule[] = []): ValidationSchema {
    return this.createArraySchema('array', itemSchema, rules);
  }

  // ========================================================================
  // JSON Schema Conversion
  // ========================================================================

  public fromJSONSchema(jsonSchema: any): ValidationSchema {
    const schema = this.createSchema(
      jsonSchema.title || 'schema',
      jsonSchema.type || 'any',
      []
    );

    // Convert JSON Schema rules to validation rules
    if (jsonSchema.required) {
      schema.rules.push({ type: 'required' });
    }

    if (jsonSchema.minLength !== undefined) {
      schema.rules.push({ type: 'minLength', value: jsonSchema.minLength });
    }

    if (jsonSchema.maxLength !== undefined) {
      schema.rules.push({ type: 'maxLength', value: jsonSchema.maxLength });
    }

    if (jsonSchema.minimum !== undefined) {
      schema.rules.push({ type: 'min', value: jsonSchema.minimum });
    }

    if (jsonSchema.maximum !== undefined) {
      schema.rules.push({ type: 'max', value: jsonSchema.maximum });
    }

    if (jsonSchema.pattern) {
      schema.rules.push({ type: 'pattern', value: jsonSchema.pattern });
    }

    if (jsonSchema.enum) {
      schema.rules.push({ type: 'enum', value: jsonSchema.enum });
    }

    // Convert properties
    if (jsonSchema.properties) {
      schema.properties = new Map();
      for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
        schema.properties.set(key, this.fromJSONSchema(propSchema));
      }
    }

    // Convert items
    if (jsonSchema.items) {
      schema.items = this.fromJSONSchema(jsonSchema.items);
    }

    schema.metadata.description = jsonSchema.description;
    schema.metadata.default = jsonSchema.default;
    schema.metadata.examples = jsonSchema.examples;

    return schema;
  }

  public toJSONSchema(schema: ValidationSchema): any {
    const jsonSchema: any = {
      type: schema.type,
      description: schema.metadata.description,
      default: schema.metadata.default,
      examples: schema.metadata.examples,
    };

    // Convert rules
    for (const rule of schema.rules) {
      switch (rule.type) {
        case 'min':
          jsonSchema.minimum = rule.value;
          break;
        case 'max':
          jsonSchema.maximum = rule.value;
          break;
        case 'minLength':
          jsonSchema.minLength = rule.value;
          break;
        case 'maxLength':
          jsonSchema.maxLength = rule.value;
          break;
        case 'pattern':
          jsonSchema.pattern = rule.value;
          break;
        case 'enum':
          jsonSchema.enum = rule.value;
          break;
      }
    }

    // Convert properties
    if (schema.properties) {
      jsonSchema.properties = {};
      for (const [key, propSchema] of schema.properties.entries()) {
        jsonSchema.properties[key] = this.toJSONSchema(propSchema);
      }
    }

    // Convert items
    if (schema.items) {
      jsonSchema.items = this.toJSONSchema(schema.items);
    }

    return jsonSchema;
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateId(): string {
    return `schema-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats(): ValidationStats {
    return {
      schemas: this.schemas.size,
      validators: this.validators.size,
      coercions: this.coercions.length,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface ValidationStats {
  schemas: number;
  validators: number;
  coercions: number;
}

// ============================================================================
// Export
// ============================================================================

export default ValidationManager;
