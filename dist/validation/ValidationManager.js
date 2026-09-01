"use strict";
/**
 * Advanced Validation & Schema System
 * JSON Schema validation, custom validators, complex rules
 * Type coercion, sanitization, error formatting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationManager = void 0;
const events_1 = require("events");
// ============================================================================
// Validation Manager
// ============================================================================
class ValidationManager extends events_1.EventEmitter {
    config;
    schemas = new Map();
    validators = new Map();
    coercions = [];
    constructor(config = {}) {
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
    createSchema(name, type, rules = []) {
        const schema = {
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
    createObjectSchema(name, properties, rules = []) {
        const schema = this.createSchema(name, 'object', rules);
        schema.properties = properties;
        return schema;
    }
    createArraySchema(name, itemSchema, rules = []) {
        const schema = this.createSchema(name, 'array', rules);
        schema.items = itemSchema;
        return schema;
    }
    getSchema(id) {
        return this.schemas.get(id);
    }
    getSchemaByName(name) {
        return Array.from(this.schemas.values()).find(s => s.name === name);
    }
    // ========================================================================
    // Validation
    // ========================================================================
    validate(data, schema, options = {}) {
        const startTime = Date.now();
        const errors = [];
        const warnings = [];
        const coerced = [];
        const sanitized = [];
        const mergedOptions = {
            coerce: options.coerce ?? this.config.enableTypeCoercion,
            sanitize: options.sanitize ?? this.config.enableSanitization,
            strict: options.strict ?? this.config.strictMode,
            stopOnFirstError: options.stopOnFirstError ?? this.config.stopOnFirstError,
            context: options.context || {},
        };
        const context = {
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
        const result = {
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
    validateValue(value, schema, context, errors, warnings) {
        const path = context.path.join('.');
        // Type validation
        if (!this.validateType(value, schema.type)) {
            errors.push({
                path,
                rule: 'type',
                message: `Expected type ${schema.type}, got ${typeof value}`,
                value,
                expected: schema.type,
            });
            if (context.options.stopOnFirstError)
                return;
        }
        // Rule validation
        for (const rule of schema.rules) {
            if (errors.length >= this.config.maxErrors)
                break;
            const error = this.validateRule(value, rule, context);
            if (error) {
                errors.push(error);
                if (context.options.stopOnFirstError)
                    return;
            }
        }
        // Object property validation
        if (schema.type === 'object' && schema.properties) {
            if (typeof value === 'object' && value !== null) {
                for (const [propName, propSchema] of schema.properties.entries()) {
                    const propValue = value[propName];
                    const propContext = {
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
                    const itemContext = {
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
    validateType(value, type) {
        if (type === 'any')
            return true;
        if (type === 'null')
            return value === null;
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (type === 'integer') {
            return typeof value === 'number' && Number.isInteger(value);
        }
        if (type === 'number') {
            return typeof value === 'number';
        }
        return actualType === type;
    }
    validateRule(value, rule, context) {
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
    coerceType(value, schema, context) {
        const paths = [];
        let coerced = false;
        let result = value;
        // Find appropriate coercion
        const actualType = this.getActualType(value);
        if (actualType !== schema.type && schema.type !== 'any') {
            const coercion = this.coercions.find(c => c.from === actualType && c.to === schema.type);
            if (coercion) {
                try {
                    result = coercion.coerce(value);
                    coerced = true;
                    paths.push(context.path.join('.'));
                }
                catch (error) {
                    // Coercion failed, leave value as is
                }
            }
        }
        return { value: result, coerced, paths };
    }
    getActualType(value) {
        if (value === null)
            return 'null';
        if (Array.isArray(value))
            return 'array';
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'integer' : 'number';
        }
        return typeof value;
    }
    initializeTypeCoercions() {
        // String to Number
        this.coercions.push({
            from: 'string',
            to: 'number',
            coerce: (value) => {
                const num = Number(value);
                if (isNaN(num))
                    throw new Error('Cannot coerce to number');
                return num;
            },
        });
        // String to Boolean
        this.coercions.push({
            from: 'string',
            to: 'boolean',
            coerce: (value) => {
                const lower = value.toLowerCase();
                if (lower === 'true' || lower === '1')
                    return true;
                if (lower === 'false' || lower === '0')
                    return false;
                throw new Error('Cannot coerce to boolean');
            },
        });
        // Number to String
        this.coercions.push({
            from: 'number',
            to: 'string',
            coerce: (value) => String(value),
        });
        // Boolean to String
        this.coercions.push({
            from: 'boolean',
            to: 'string',
            coerce: (value) => String(value),
        });
    }
    // ========================================================================
    // Sanitization
    // ========================================================================
    sanitize(value, schema, context) {
        const paths = [];
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
    registerValidator(validator) {
        if (!this.config.enableCustomValidators) {
            throw new Error('Custom validators are not enabled');
        }
        this.validators.set(validator.id, validator);
        this.emit('validator:registered', { validator });
    }
    getValidator(id) {
        return this.validators.get(id);
    }
    // ========================================================================
    // Built-in Validators
    // ========================================================================
    initializeBuiltInValidators() {
        // Email validator
        this.registerValidator({
            id: 'email',
            name: 'Email Validator',
            validate: (value) => this.isValidEmail(value),
        });
        // URL validator
        this.registerValidator({
            id: 'url',
            name: 'URL Validator',
            validate: (value) => this.isValidUrl(value),
        });
        // UUID validator
        this.registerValidator({
            id: 'uuid',
            name: 'UUID Validator',
            validate: (value) => this.isValidUUID(value),
        });
    }
    isValidEmail(value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }
    isValidUrl(value) {
        try {
            new URL(value);
            return true;
        }
        catch {
            return false;
        }
    }
    isValidUUID(value) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    }
    // ========================================================================
    // Schema Builders
    // ========================================================================
    string(rules = []) {
        return this.createSchema('string', 'string', rules);
    }
    number(rules = []) {
        return this.createSchema('number', 'number', rules);
    }
    integer(rules = []) {
        return this.createSchema('integer', 'integer', rules);
    }
    boolean(rules = []) {
        return this.createSchema('boolean', 'boolean', rules);
    }
    object(properties, rules = []) {
        return this.createObjectSchema('object', properties, rules);
    }
    array(itemSchema, rules = []) {
        return this.createArraySchema('array', itemSchema, rules);
    }
    // ========================================================================
    // JSON Schema Conversion
    // ========================================================================
    fromJSONSchema(jsonSchema) {
        const schema = this.createSchema(jsonSchema.title || 'schema', jsonSchema.type || 'any', []);
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
    toJSONSchema(schema) {
        const jsonSchema = {
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
    generateId() {
        return `schema-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getStats() {
        return {
            schemas: this.schemas.size,
            validators: this.validators.size,
            coercions: this.coercions.length,
        };
    }
}
exports.ValidationManager = ValidationManager;
// ============================================================================
// Export
// ============================================================================
exports.default = ValidationManager;
