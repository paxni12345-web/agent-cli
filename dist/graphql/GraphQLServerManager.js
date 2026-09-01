"use strict";
/**
 * GraphQL Server & Schema Management System
 * Schema generation, resolvers, subscriptions, federation support
 * Query optimization, caching, DataLoader integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLServerManager = void 0;
const events_1 = require("events");
// ============================================================================
// GraphQL Server Manager
// ============================================================================
class GraphQLServerManager extends events_1.EventEmitter {
    config;
    schemas = new Map();
    activeSchema;
    resolvers = new Map();
    subscriptions = new Map();
    loaders = new Map();
    queryCache = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            port: 4000,
            enablePlayground: true,
            enableIntrospection: true,
            enableTracing: false,
            enableCaching: true,
            enableDataLoader: true,
            enableSubscriptions: true,
            enableFederation: false,
            maxQueryDepth: 10,
            maxQueryComplexity: 1000,
            timeout: 30000,
            ...config,
        };
        this.initializeBuiltInTypes();
        this.initializeBuiltInDirectives();
    }
    // ========================================================================
    // Schema Management
    // ========================================================================
    createSchema(name) {
        const schema = {
            id: this.generateId(),
            name,
            version: '1.0.0',
            types: new Map(),
            queries: new Map(),
            mutations: new Map(),
            subscriptions: new Map(),
            directives: new Map(),
            metadata: {
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0',
            },
        };
        this.schemas.set(schema.id, schema);
        this.emit('schema:created', { schema });
        return schema;
    }
    setActiveSchema(schemaId) {
        const schema = this.schemas.get(schemaId);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        this.activeSchema = schema;
        this.emit('schema:activated', { schema });
    }
    getSchema(schemaId) {
        return this.schemas.get(schemaId);
    }
    // ========================================================================
    // Type System
    // ========================================================================
    addType(schemaId, type) {
        const schema = this.schemas.get(schemaId);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        schema.types.set(type.name, type);
        schema.metadata.updatedAt = Date.now();
        this.emit('type:added', { schema, type });
    }
    addObjectType(schemaId, name, fields, options = {}) {
        const type = {
            name,
            kind: 'OBJECT',
            fields,
            interfaces: options.interfaces || [],
            ...options,
        };
        this.addType(schemaId, type);
    }
    addInterfaceType(schemaId, name, fields, options = {}) {
        const type = {
            name,
            kind: 'INTERFACE',
            fields,
            ...options,
        };
        this.addType(schemaId, type);
    }
    addEnumType(schemaId, name, values, options = {}) {
        const type = {
            name,
            kind: 'ENUM',
            enumValues: values,
            ...options,
        };
        this.addType(schemaId, type);
    }
    addInputType(schemaId, name, fields, options = {}) {
        const type = {
            name,
            kind: 'INPUT_OBJECT',
            inputFields: fields,
            ...options,
        };
        this.addType(schemaId, type);
    }
    addScalarType(schemaId, name, options = {}) {
        const type = {
            name,
            kind: 'SCALAR',
            ...options,
        };
        this.addType(schemaId, type);
    }
    // ========================================================================
    // Query, Mutation, Subscription
    // ========================================================================
    addQuery(schemaId, name, definition) {
        const schema = this.schemas.get(schemaId);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        schema.queries.set(name, { name, ...definition });
        this.resolvers.set(`Query.${name}`, definition.resolver);
        this.emit('query:added', { schema, name, definition });
    }
    addMutation(schemaId, name, definition) {
        const schema = this.schemas.get(schemaId);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        schema.mutations.set(name, { name, ...definition });
        this.resolvers.set(`Mutation.${name}`, definition.resolver);
        this.emit('mutation:added', { schema, name, definition });
    }
    addSubscription(schemaId, name, definition) {
        const schema = this.schemas.get(schemaId);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        if (!this.config.enableSubscriptions) {
            throw new Error('Subscriptions are not enabled');
        }
        schema.subscriptions.set(name, { name, ...definition });
        this.emit('subscription:added', { schema, name, definition });
    }
    // ========================================================================
    // Directives
    // ========================================================================
    addDirective(schemaId, directive) {
        const schema = this.schemas.get(schemaId);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        schema.directives.set(directive.name, directive);
        this.emit('directive:added', { schema, directive });
    }
    initializeBuiltInDirectives() {
        // Built-in directives like @deprecated, @skip, @include, @cacheControl
    }
    // ========================================================================
    // Query Execution
    // ========================================================================
    async executeQuery(query, variables, context) {
        try {
            if (!this.activeSchema) {
                throw new Error('No active schema');
            }
            // Create execution context
            const execContext = {
                requestId: this.generateId(),
                headers: {},
                dataSources: new Map(),
                loaders: new Map(),
                cacheControl: this.createCacheControl(),
                ...context,
            };
            // Parse and validate query
            const operation = this.parseQuery(query);
            this.validateQuery(operation, this.activeSchema);
            // Check cache
            if (this.config.enableCaching && operation.operation === 'query') {
                const cacheKey = this.generateCacheKey(query, variables);
                const cached = this.queryCache.get(cacheKey);
                if (cached) {
                    this.emit('query:cache:hit', { cacheKey });
                    return cached;
                }
            }
            // Execute operation
            const result = await this.executeOperation(operation, variables || {}, execContext, this.activeSchema);
            // Cache result
            if (this.config.enableCaching &&
                operation.operation === 'query' &&
                !result.errors) {
                const cacheKey = this.generateCacheKey(query, variables);
                this.queryCache.set(cacheKey, result);
            }
            this.emit('query:executed', { operation, result });
            return result;
        }
        catch (error) {
            return {
                errors: [
                    {
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                ],
            };
        }
    }
    async executeOperation(operation, variables, context, schema) {
        const data = {};
        try {
            switch (operation.operation) {
                case 'query':
                    for (const selection of operation.selectionSet.selections) {
                        if (selection.kind === 'Field') {
                            const query = schema.queries.get(selection.name);
                            if (!query) {
                                throw new Error(`Query not found: ${selection.name}`);
                            }
                            const resolver = this.resolvers.get(`Query.${selection.name}`);
                            if (!resolver) {
                                throw new Error(`Resolver not found: Query.${selection.name}`);
                            }
                            const info = {
                                fieldName: selection.name,
                                fieldNodes: [selection],
                                returnType: query.type,
                                parentType: { name: 'Query', kind: 'OBJECT' },
                                path: [selection.name],
                                schema,
                                fragments: {},
                                operation,
                                variableValues: variables,
                            };
                            const fieldName = selection.alias || selection.name;
                            data[fieldName] = await resolver(undefined, selection.args || {}, context, info);
                        }
                    }
                    break;
                case 'mutation':
                    for (const selection of operation.selectionSet.selections) {
                        if (selection.kind === 'Field') {
                            const mutation = schema.mutations.get(selection.name);
                            if (!mutation) {
                                throw new Error(`Mutation not found: ${selection.name}`);
                            }
                            const resolver = this.resolvers.get(`Mutation.${selection.name}`);
                            if (!resolver) {
                                throw new Error(`Resolver not found: Mutation.${selection.name}`);
                            }
                            const info = {
                                fieldName: selection.name,
                                fieldNodes: [selection],
                                returnType: mutation.type,
                                parentType: { name: 'Mutation', kind: 'OBJECT' },
                                path: [selection.name],
                                schema,
                                fragments: {},
                                operation,
                                variableValues: variables,
                            };
                            const fieldName = selection.alias || selection.name;
                            data[fieldName] = await resolver(undefined, selection.args || {}, context, info);
                        }
                    }
                    break;
                case 'subscription':
                    throw new Error('Use subscribeToOperation for subscriptions');
            }
            return { data };
        }
        catch (error) {
            return {
                data,
                errors: [
                    {
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                ],
            };
        }
    }
    // ========================================================================
    // Subscriptions
    // ========================================================================
    async subscribeToOperation(query, variables, context) {
        if (!this.config.enableSubscriptions) {
            throw new Error('Subscriptions are not enabled');
        }
        if (!this.activeSchema) {
            throw new Error('No active schema');
        }
        const operation = this.parseQuery(query);
        if (operation.operation !== 'subscription') {
            throw new Error('Operation must be a subscription');
        }
        const execContext = {
            requestId: this.generateId(),
            headers: {},
            dataSources: new Map(),
            loaders: new Map(),
            cacheControl: this.createCacheControl(),
            ...context,
        };
        const subscriptionId = this.generateId();
        const selection = operation.selectionSet.selections[0];
        if (selection.kind === 'Field') {
            const subscription = this.activeSchema.subscriptions.get(selection.name);
            if (!subscription) {
                throw new Error(`Subscription not found: ${selection.name}`);
            }
            const info = {
                fieldName: selection.name,
                fieldNodes: [selection],
                returnType: subscription.type,
                parentType: { name: 'Subscription', kind: 'OBJECT' },
                path: [selection.name],
                schema: this.activeSchema,
                fragments: {},
                operation,
                variableValues: variables || {},
            };
            const iterator = await subscription.subscribe(undefined, selection.args || {}, execContext, info);
            const connection = {
                id: this.generateId(),
                subscriptionId,
                operation,
                context: execContext,
                iterator,
                active: true,
            };
            this.subscriptions.set(subscriptionId, connection);
            this.emit('subscription:created', { subscriptionId, connection });
            // Start listening
            this.processSubscription(connection, subscription);
        }
        return subscriptionId;
    }
    async processSubscription(connection, subscription) {
        try {
            for await (const value of connection.iterator) {
                if (!connection.active)
                    break;
                const result = subscription.resolve
                    ? await subscription.resolve(value, {}, connection.context, {})
                    : value;
                this.emit('subscription:data', {
                    subscriptionId: connection.subscriptionId,
                    data: result,
                });
            }
        }
        catch (error) {
            this.emit('subscription:error', {
                subscriptionId: connection.subscriptionId,
                error,
            });
        }
        finally {
            this.unsubscribe(connection.subscriptionId);
        }
    }
    unsubscribe(subscriptionId) {
        const connection = this.subscriptions.get(subscriptionId);
        if (connection) {
            connection.active = false;
            this.subscriptions.delete(subscriptionId);
            this.emit('subscription:closed', { subscriptionId });
        }
    }
    // ========================================================================
    // DataLoader
    // ========================================================================
    createDataLoader(name, batchLoadFn) {
        const cache = new Map();
        const loader = {
            id: this.generateId(),
            load: async (key) => {
                if (cache.has(key)) {
                    return cache.get(key);
                }
                const results = await batchLoadFn([key]);
                const result = results[0];
                cache.set(key, result);
                return result;
            },
            loadMany: async (keys) => {
                const uncachedKeys = keys.filter(k => !cache.has(k));
                if (uncachedKeys.length > 0) {
                    const results = await batchLoadFn(uncachedKeys);
                    uncachedKeys.forEach((key, index) => {
                        cache.set(key, results[index]);
                    });
                }
                return keys.map(k => cache.get(k));
            },
            clear: (key) => {
                cache.delete(key);
            },
            clearAll: () => {
                cache.clear();
            },
            prime: (key, value) => {
                cache.set(key, value);
            },
        };
        this.loaders.set(name, loader);
        return loader;
    }
    // ========================================================================
    // Validation
    // ========================================================================
    validateQuery(operation, schema) {
        // Validate query depth
        const depth = this.calculateQueryDepth(operation.selectionSet);
        if (depth > this.config.maxQueryDepth) {
            throw new Error(`Query depth ${depth} exceeds maximum ${this.config.maxQueryDepth}`);
        }
        // Validate query complexity
        const complexity = this.calculateQueryComplexity(operation, schema);
        if (complexity > this.config.maxQueryComplexity) {
            throw new Error(`Query complexity ${complexity} exceeds maximum ${this.config.maxQueryComplexity}`);
        }
    }
    calculateQueryDepth(selectionSet, depth = 1) {
        let maxDepth = depth;
        for (const selection of selectionSet.selections) {
            if (selection.kind === 'Field' && selection.selectionSet) {
                const fieldDepth = this.calculateQueryDepth(selection.selectionSet, depth + 1);
                maxDepth = Math.max(maxDepth, fieldDepth);
            }
        }
        return maxDepth;
    }
    calculateQueryComplexity(operation, schema) {
        let complexity = 0;
        const calculateSelection = (selection, multiplier = 1) => {
            if (selection.kind === 'Field') {
                // Get field complexity
                let fieldComplexity = 1;
                if (operation.operation === 'query') {
                    const query = schema.queries.get(selection.name);
                    if (query && query.complexity) {
                        fieldComplexity = query.complexity;
                    }
                }
                complexity += fieldComplexity * multiplier;
                // Recurse into nested selections
                if (selection.selectionSet) {
                    for (const nested of selection.selectionSet.selections) {
                        calculateSelection(nested, multiplier);
                    }
                }
            }
        };
        for (const selection of operation.selectionSet.selections) {
            calculateSelection(selection);
        }
        return complexity;
    }
    // ========================================================================
    // Parsing & Schema Generation
    // ========================================================================
    parseQuery(query) {
        // Simplified parser - use graphql-js in production
        const lines = query.trim().split('\n');
        const firstLine = lines[0].trim();
        let operation = 'query';
        if (firstLine.startsWith('mutation'))
            operation = 'mutation';
        if (firstLine.startsWith('subscription'))
            operation = 'subscription';
        return {
            operation,
            variableDefinitions: [],
            directives: [],
            selectionSet: {
                selections: [
                    {
                        kind: 'Field',
                        name: 'example',
                        args: {},
                    },
                ],
            },
        };
    }
    generateSDL(schemaId) {
        const schema = this.schemas.get(schemaId);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        let sdl = '';
        // Types
        for (const type of schema.types.values()) {
            sdl += this.generateTypeSDL(type);
            sdl += '\n\n';
        }
        // Query
        if (schema.queries.size > 0) {
            sdl += 'type Query {\n';
            for (const query of schema.queries.values()) {
                sdl += `  ${query.name}`;
                if (query.args && query.args.size > 0) {
                    sdl += '(';
                    sdl += Array.from(query.args.values())
                        .map(arg => `${arg.name}: ${this.formatTypeReference(arg.type)}`)
                        .join(', ');
                    sdl += ')';
                }
                sdl += `: ${this.formatTypeReference(query.type)}\n`;
            }
            sdl += '}\n\n';
        }
        // Mutation
        if (schema.mutations.size > 0) {
            sdl += 'type Mutation {\n';
            for (const mutation of schema.mutations.values()) {
                sdl += `  ${mutation.name}`;
                if (mutation.args && mutation.args.size > 0) {
                    sdl += '(';
                    sdl += Array.from(mutation.args.values())
                        .map(arg => `${arg.name}: ${this.formatTypeReference(arg.type)}`)
                        .join(', ');
                    sdl += ')';
                }
                sdl += `: ${this.formatTypeReference(mutation.type)}\n`;
            }
            sdl += '}\n\n';
        }
        // Subscription
        if (schema.subscriptions.size > 0) {
            sdl += 'type Subscription {\n';
            for (const subscription of schema.subscriptions.values()) {
                sdl += `  ${subscription.name}`;
                if (subscription.args && subscription.args.size > 0) {
                    sdl += '(';
                    sdl += Array.from(subscription.args.values())
                        .map(arg => `${arg.name}: ${this.formatTypeReference(arg.type)}`)
                        .join(', ');
                    sdl += ')';
                }
                sdl += `: ${this.formatTypeReference(subscription.type)}\n`;
            }
            sdl += '}\n';
        }
        return sdl;
    }
    generateTypeSDL(type) {
        switch (type.kind) {
            case 'OBJECT':
                let objectSDL = `type ${type.name}`;
                if (type.interfaces && type.interfaces.length > 0) {
                    objectSDL += ` implements ${type.interfaces.join(' & ')}`;
                }
                objectSDL += ' {\n';
                if (type.fields) {
                    for (const field of type.fields.values()) {
                        objectSDL += `  ${field.name}: ${this.formatTypeReference(field.type)}\n`;
                    }
                }
                objectSDL += '}';
                return objectSDL;
            case 'INTERFACE':
                let interfaceSDL = `interface ${type.name} {\n`;
                if (type.fields) {
                    for (const field of type.fields.values()) {
                        interfaceSDL += `  ${field.name}: ${this.formatTypeReference(field.type)}\n`;
                    }
                }
                interfaceSDL += '}';
                return interfaceSDL;
            case 'ENUM':
                let enumSDL = `enum ${type.name} {\n`;
                if (type.enumValues) {
                    for (const value of type.enumValues) {
                        enumSDL += `  ${value}\n`;
                    }
                }
                enumSDL += '}';
                return enumSDL;
            case 'INPUT_OBJECT':
                let inputSDL = `input ${type.name} {\n`;
                if (type.inputFields) {
                    for (const field of type.inputFields.values()) {
                        inputSDL += `  ${field.name}: ${this.formatTypeReference(field.type)}\n`;
                    }
                }
                inputSDL += '}';
                return inputSDL;
            case 'SCALAR':
                return `scalar ${type.name}`;
            default:
                return '';
        }
    }
    formatTypeReference(typeRef) {
        if (typeRef.kind === 'NON_NULL') {
            return `${this.formatTypeReference(typeRef.ofType)}!`;
        }
        if (typeRef.kind === 'LIST') {
            return `[${this.formatTypeReference(typeRef.ofType)}]`;
        }
        return typeRef.name;
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    initializeBuiltInTypes() {
        // Built-in scalar types: String, Int, Float, Boolean, ID
    }
    createCacheControl() {
        const hints = [];
        return {
            setCacheHint: (hint) => {
                hints.push(hint);
            },
            cacheHints: hints,
        };
    }
    generateCacheKey(query, variables) {
        return `${query}:${JSON.stringify(variables || {})}`;
    }
    generateId() {
        return `gql-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getStats() {
        return {
            schemas: this.schemas.size,
            activeSubscriptions: this.subscriptions.size,
            loaders: this.loaders.size,
            cachedQueries: this.queryCache.size,
        };
    }
}
exports.GraphQLServerManager = GraphQLServerManager;
// ============================================================================
// Export
// ============================================================================
exports.default = GraphQLServerManager;
