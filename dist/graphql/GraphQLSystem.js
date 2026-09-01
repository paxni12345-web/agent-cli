"use strict";
/**
 * GraphQL API System
 * Schema definition, resolvers, subscriptions, federation, and query execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphqlPerformanceMonitor = exports.graphqlFederationManager = exports.dataLoaderManager = exports.graphqlSubscriptionManager = exports.graphqlExecutor = exports.graphqlSchemaManager = exports.GraphQLPerformanceMonitor = exports.GraphQLFederationManager = exports.DataLoaderManager = exports.GraphQLSubscriptionManager = exports.GraphQLExecutor = exports.GraphQLSchemaManager = exports.ServiceHealth = exports.QueryStatus = exports.OperationType = exports.DirectiveLocation = exports.TypeKind = void 0;
const EventBus_1 = require("../core/EventBus");
var TypeKind;
(function (TypeKind) {
    TypeKind["Object"] = "OBJECT";
    TypeKind["Interface"] = "INTERFACE";
    TypeKind["Union"] = "UNION";
    TypeKind["Enum"] = "ENUM";
    TypeKind["InputObject"] = "INPUT_OBJECT";
    TypeKind["Scalar"] = "SCALAR";
})(TypeKind || (exports.TypeKind = TypeKind = {}));
var DirectiveLocation;
(function (DirectiveLocation) {
    DirectiveLocation["Query"] = "QUERY";
    DirectiveLocation["Mutation"] = "MUTATION";
    DirectiveLocation["Subscription"] = "SUBSCRIPTION";
    DirectiveLocation["Field"] = "FIELD";
    DirectiveLocation["FragmentDefinition"] = "FRAGMENT_DEFINITION";
    DirectiveLocation["FragmentSpread"] = "FRAGMENT_SPREAD";
    DirectiveLocation["InlineFragment"] = "INLINE_FRAGMENT";
    DirectiveLocation["Schema"] = "SCHEMA";
    DirectiveLocation["Scalar"] = "SCALAR";
    DirectiveLocation["Object"] = "OBJECT";
    DirectiveLocation["FieldDefinition"] = "FIELD_DEFINITION";
    DirectiveLocation["ArgumentDefinition"] = "ARGUMENT_DEFINITION";
    DirectiveLocation["Interface"] = "INTERFACE";
    DirectiveLocation["Union"] = "UNION";
    DirectiveLocation["Enum"] = "ENUM";
    DirectiveLocation["EnumValue"] = "ENUM_VALUE";
    DirectiveLocation["InputObject"] = "INPUT_OBJECT";
    DirectiveLocation["InputFieldDefinition"] = "INPUT_FIELD_DEFINITION";
})(DirectiveLocation || (exports.DirectiveLocation = DirectiveLocation = {}));
var OperationType;
(function (OperationType) {
    OperationType["Query"] = "query";
    OperationType["Mutation"] = "mutation";
    OperationType["Subscription"] = "subscription";
})(OperationType || (exports.OperationType = OperationType = {}));
var QueryStatus;
(function (QueryStatus) {
    QueryStatus["Pending"] = "pending";
    QueryStatus["Executing"] = "executing";
    QueryStatus["Completed"] = "completed";
    QueryStatus["Failed"] = "failed";
})(QueryStatus || (exports.QueryStatus = QueryStatus = {}));
var ServiceHealth;
(function (ServiceHealth) {
    ServiceHealth["Healthy"] = "healthy";
    ServiceHealth["Degraded"] = "degraded";
    ServiceHealth["Unhealthy"] = "unhealthy";
})(ServiceHealth || (exports.ServiceHealth = ServiceHealth = {}));
/**
 * GraphQL Schema Manager
 */
class GraphQLSchemaManager {
    schemas = new Map();
    resolvers = new Map();
    /**
     * Register schema
     */
    registerSchema(schema) {
        const fullSchema = {
            ...schema,
            id: this.generateSchemaId(),
            createdAt: new Date(),
        };
        this.schemas.set(fullSchema.name, fullSchema);
        EventBus_1.eventBus.emitSync('graphql.schema_registered', fullSchema, 'GraphQLSchemaManager');
        return fullSchema;
    }
    /**
     * Register resolver
     */
    registerResolver(typeName, fieldName, resolveFn) {
        const key = `${typeName}.${fieldName}`;
        if (!this.resolvers.has(key)) {
            this.resolvers.set(key, []);
        }
        this.resolvers.get(key).push({
            typeName,
            fieldName,
            resolve: resolveFn,
        });
        EventBus_1.eventBus.emitSync('graphql.resolver_registered', { typeName, fieldName }, 'GraphQLSchemaManager');
    }
    /**
     * Get resolver
     */
    getResolver(typeName, fieldName) {
        const key = `${typeName}.${fieldName}`;
        const resolvers = this.resolvers.get(key);
        return resolvers?.[0];
    }
    /**
     * Get schema
     */
    getSchema(name) {
        return this.schemas.get(name);
    }
    /**
     * List schemas
     */
    listSchemas() {
        return Array.from(this.schemas.values());
    }
    /**
     * Validate schema
     */
    validateSchema(schema) {
        const errors = [];
        // Check for duplicate type names
        const typeNames = new Set();
        for (const type of schema.types) {
            if (typeNames.has(type.name)) {
                errors.push({
                    message: `Duplicate type name: ${type.name}`,
                    locations: [],
                });
            }
            typeNames.add(type.name);
        }
        // Check for missing resolvers
        for (const query of schema.queries) {
            if (!this.getResolver('Query', query.name)) {
                errors.push({
                    message: `Missing resolver for query: ${query.name}`,
                    locations: [],
                });
            }
        }
        return errors;
    }
    /**
     * Merge schemas
     */
    mergeSchemas(schemas) {
        const mergedTypes = [];
        const mergedQueries = [];
        const mergedMutations = [];
        const mergedSubscriptions = [];
        const mergedDirectives = [];
        for (const schema of schemas) {
            mergedTypes.push(...schema.types);
            mergedQueries.push(...schema.queries);
            mergedMutations.push(...schema.mutations);
            mergedSubscriptions.push(...schema.subscriptions);
            mergedDirectives.push(...schema.directives);
        }
        return {
            id: this.generateSchemaId(),
            name: 'merged',
            version: '1.0.0',
            types: mergedTypes,
            queries: mergedQueries,
            mutations: mergedMutations,
            subscriptions: mergedSubscriptions,
            directives: mergedDirectives,
            createdAt: new Date(),
        };
    }
    generateSchemaId() {
        return `schema_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.GraphQLSchemaManager = GraphQLSchemaManager;
/**
 * GraphQL Executor
 */
class GraphQLExecutor {
    schemaManager;
    queries = new Map();
    cache = new Map();
    constructor(schemaManager) {
        this.schemaManager = schemaManager;
    }
    /**
     * Execute query
     */
    async execute(schemaName, query, variables, context) {
        const startTime = Date.now();
        const graphqlQuery = {
            id: this.generateQueryId(),
            operationType: this.detectOperationType(query),
            query,
            variables,
            context,
            status: QueryStatus.Pending,
            timestamp: new Date(),
        };
        this.queries.set(graphqlQuery.id, graphqlQuery);
        try {
            graphqlQuery.status = QueryStatus.Executing;
            // Parse query
            const parsed = this.parseQuery(query);
            // Validate query
            const schema = this.schemaManager.getSchema(schemaName);
            if (!schema) {
                throw new Error(`Schema not found: ${schemaName}`);
            }
            const validationErrors = this.validateQuery(parsed, schema);
            if (validationErrors.length > 0) {
                graphqlQuery.status = QueryStatus.Failed;
                graphqlQuery.errors = validationErrors;
                return graphqlQuery;
            }
            // Check cache
            const cacheKey = this.getCacheKey(query, variables);
            if (this.cache.has(cacheKey)) {
                graphqlQuery.result = this.cache.get(cacheKey);
                graphqlQuery.status = QueryStatus.Completed;
                graphqlQuery.executionTime = Date.now() - startTime;
                return graphqlQuery;
            }
            // Execute resolvers
            const result = await this.executeResolvers(parsed, schema, variables, context);
            graphqlQuery.result = result;
            graphqlQuery.status = QueryStatus.Completed;
            graphqlQuery.executionTime = Date.now() - startTime;
            // Cache result
            this.cache.set(cacheKey, result);
            EventBus_1.eventBus.emitSync('graphql.query_executed', graphqlQuery, 'GraphQLExecutor');
        }
        catch (error) {
            graphqlQuery.status = QueryStatus.Failed;
            graphqlQuery.errors = [{
                    message: error instanceof Error ? error.message : 'Unknown error',
                    locations: [],
                }];
            graphqlQuery.executionTime = Date.now() - startTime;
        }
        return graphqlQuery;
    }
    /**
     * Get query
     */
    getQuery(queryId) {
        return this.queries.get(queryId);
    }
    /**
     * List queries
     */
    listQueries(filter) {
        let queries = Array.from(this.queries.values());
        if (filter?.status) {
            queries = queries.filter(q => q.status === filter.status);
        }
        if (filter?.operationType) {
            queries = queries.filter(q => q.operationType === filter.operationType);
        }
        return queries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        EventBus_1.eventBus.emitSync('graphql.cache_cleared', {}, 'GraphQLExecutor');
    }
    parseQuery(query) {
        // Simplified query parsing
        return {
            query,
            fields: this.extractFields(query),
        };
    }
    extractFields(query) {
        // Simple field extraction
        const matches = query.match(/\b\w+\b/g);
        return matches || [];
    }
    detectOperationType(query) {
        if (query.trim().startsWith('mutation')) {
            return OperationType.Mutation;
        }
        else if (query.trim().startsWith('subscription')) {
            return OperationType.Subscription;
        }
        return OperationType.Query;
    }
    validateQuery(parsed, schema) {
        // Simplified validation
        return [];
    }
    async executeResolvers(parsed, schema, variables, context) {
        const result = {};
        for (const field of parsed.fields) {
            const resolver = this.schemaManager.getResolver('Query', field);
            if (resolver) {
                const info = {
                    fieldName: field,
                    fieldNodes: [],
                    returnType: { name: 'String', kind: TypeKind.Scalar, nonNull: false, list: false },
                    parentType: { name: 'Query', kind: TypeKind.Object },
                    path: [],
                    schema,
                    fragments: {},
                    rootValue: {},
                    operation: {},
                    variableValues: variables || {},
                };
                result[field] = await resolver.resolve({}, variables || {}, context, info);
            }
        }
        return result;
    }
    getCacheKey(query, variables) {
        return `${query}:${JSON.stringify(variables || {})}`;
    }
    generateQueryId() {
        return `query_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.GraphQLExecutor = GraphQLExecutor;
/**
 * GraphQL Subscription Manager
 */
class GraphQLSubscriptionManager {
    subscriptions = new Map();
    topics = new Map();
    /**
     * Subscribe
     */
    subscribe(query, callback, variables, context) {
        const subscription = {
            id: this.generateSubscriptionId(),
            query,
            variables,
            context: context || {},
            topic: this.extractTopic(query),
            callback,
            createdAt: new Date(),
        };
        this.subscriptions.set(subscription.id, subscription);
        if (!this.topics.has(subscription.topic)) {
            this.topics.set(subscription.topic, new Set());
        }
        this.topics.get(subscription.topic).add(subscription.id);
        EventBus_1.eventBus.emitSync('graphql.subscribed', subscription, 'GraphQLSubscriptionManager');
        return subscription;
    }
    /**
     * Unsubscribe
     */
    unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
            const topic = subscription.topic;
            this.topics.get(topic)?.delete(subscriptionId);
            this.subscriptions.delete(subscriptionId);
            EventBus_1.eventBus.emitSync('graphql.unsubscribed', { subscriptionId }, 'GraphQLSubscriptionManager');
        }
    }
    /**
     * Publish
     */
    publish(topic, data) {
        const subscriptionIds = this.topics.get(topic);
        if (subscriptionIds) {
            for (const subscriptionId of subscriptionIds) {
                const subscription = this.subscriptions.get(subscriptionId);
                if (subscription) {
                    subscription.callback(data);
                }
            }
        }
        EventBus_1.eventBus.emitSync('graphql.published', { topic, subscribers: subscriptionIds?.size || 0 }, 'GraphQLSubscriptionManager');
    }
    /**
     * Get subscription
     */
    getSubscription(subscriptionId) {
        return this.subscriptions.get(subscriptionId);
    }
    /**
     * List subscriptions
     */
    listSubscriptions(topic) {
        if (topic) {
            const subscriptionIds = this.topics.get(topic) || new Set();
            return Array.from(subscriptionIds)
                .map(id => this.subscriptions.get(id))
                .filter((s) => s !== undefined);
        }
        return Array.from(this.subscriptions.values());
    }
    extractTopic(query) {
        // Simple topic extraction from subscription query
        const match = query.match(/subscription\s+\w+\s*{?\s*(\w+)/);
        return match ? match[1] : 'default';
    }
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.GraphQLSubscriptionManager = GraphQLSubscriptionManager;
/**
 * DataLoader for batch loading
 */
class DataLoaderManager {
    loaders = new Map();
    /**
     * Create loader
     */
    createLoader(name, batchLoadFn) {
        const loader = {
            name,
            batchLoadFn,
            cache: new Map(),
            batch: [],
            batchScheduled: false,
        };
        this.loaders.set(name, loader);
        return loader;
    }
    /**
     * Load
     */
    async load(loaderName, key) {
        const loader = this.loaders.get(loaderName);
        if (!loader) {
            throw new Error(`Loader not found: ${loaderName}`);
        }
        // Check cache
        if (loader.cache.has(key)) {
            return loader.cache.get(key);
        }
        // Add to batch
        const promise = new Promise((resolve, reject) => {
            loader.batch.push({ key, resolve, reject });
            if (!loader.batchScheduled) {
                loader.batchScheduled = true;
                process.nextTick(() => this.dispatchBatch(loaderName));
            }
        });
        loader.cache.set(key, promise);
        return promise;
    }
    /**
     * Load many
     */
    async loadMany(loaderName, keys) {
        return Promise.all(keys.map(key => this.load(loaderName, key)));
    }
    /**
     * Clear cache
     */
    clearCache(loaderName, key) {
        const loader = this.loaders.get(loaderName);
        if (loader) {
            if (key !== undefined) {
                loader.cache.delete(key);
            }
            else {
                loader.cache.clear();
            }
        }
    }
    async dispatchBatch(loaderName) {
        const loader = this.loaders.get(loaderName);
        if (!loader || loader.batch.length === 0) {
            return;
        }
        const batch = loader.batch;
        loader.batch = [];
        loader.batchScheduled = false;
        const keys = batch.map(item => item.key);
        try {
            const values = await loader.batchLoadFn(keys);
            batch.forEach((item, index) => {
                item.resolve(values[index]);
            });
        }
        catch (error) {
            batch.forEach(item => {
                item.reject(error);
            });
        }
    }
    /**
     * Get loader
     */
    getLoader(name) {
        return this.loaders.get(name);
    }
}
exports.DataLoaderManager = DataLoaderManager;
/**
 * GraphQL Federation Manager
 */
class GraphQLFederationManager {
    services = new Map();
    gateway;
    constructor() {
        this.gateway = {
            schemas: new Map(),
            queryPlanner: {
                plan: (query) => this.planQuery(query),
            },
        };
    }
    /**
     * Register service
     */
    registerService(service) {
        this.services.set(service.name, service);
        this.gateway.schemas.set(service.name, service.schema);
        EventBus_1.eventBus.emitSync('graphql.service_registered', service, 'GraphQLFederationManager');
    }
    /**
     * Execute federated query
     */
    async executeFederatedQuery(query, variables) {
        const plan = this.gateway.queryPlanner.plan(query);
        const results = {};
        for (const step of plan.steps) {
            const service = this.services.get(step.serviceName);
            if (!service) {
                throw new Error(`Service not found: ${step.serviceName}`);
            }
            // Mock service execution
            const result = await this.executeServiceQuery(service, step.query, step.variables);
            Object.assign(results, result);
        }
        return results;
    }
    /**
     * Get service
     */
    getService(name) {
        return this.services.get(name);
    }
    /**
     * List services
     */
    listServices() {
        return Array.from(this.services.values());
    }
    /**
     * Check service health
     */
    async checkHealth(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            return ServiceHealth.Unhealthy;
        }
        // Mock health check
        return ServiceHealth.Healthy;
    }
    planQuery(query) {
        // Simplified query planning
        return {
            steps: [
                {
                    serviceName: 'default',
                    query,
                    variables: {},
                },
            ],
        };
    }
    async executeServiceQuery(service, query, variables) {
        // Mock service query execution
        await new Promise(resolve => setTimeout(resolve, 50));
        return { data: {} };
    }
}
exports.GraphQLFederationManager = GraphQLFederationManager;
/**
 * GraphQL Performance Monitor
 */
class GraphQLPerformanceMonitor {
    metrics = {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowestQueries: [],
        errorRate: 0,
        cacheHitRate: 0,
    };
    executionTimes = [];
    errors = 0;
    cacheHits = 0;
    cacheAttempts = 0;
    /**
     * Record query
     */
    recordQuery(query) {
        this.metrics.totalQueries++;
        if (query.executionTime) {
            this.executionTimes.push(query.executionTime);
            this.updateAverageExecutionTime();
            // Track slow queries
            if (query.executionTime > 1000) {
                this.metrics.slowestQueries.push({
                    query: query.query,
                    executionTime: query.executionTime,
                    timestamp: query.timestamp,
                });
                // Keep only top 10 slowest
                this.metrics.slowestQueries.sort((a, b) => b.executionTime - a.executionTime);
                this.metrics.slowestQueries = this.metrics.slowestQueries.slice(0, 10);
            }
        }
        if (query.status === QueryStatus.Failed) {
            this.errors++;
            this.updateErrorRate();
        }
    }
    /**
     * Record cache hit
     */
    recordCacheHit(hit) {
        this.cacheAttempts++;
        if (hit) {
            this.cacheHits++;
        }
        this.updateCacheHitRate();
    }
    /**
     * Get metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            totalQueries: 0,
            averageExecutionTime: 0,
            slowestQueries: [],
            errorRate: 0,
            cacheHitRate: 0,
        };
        this.executionTimes = [];
        this.errors = 0;
        this.cacheHits = 0;
        this.cacheAttempts = 0;
    }
    updateAverageExecutionTime() {
        const sum = this.executionTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageExecutionTime = sum / this.executionTimes.length;
    }
    updateErrorRate() {
        this.metrics.errorRate = (this.errors / this.metrics.totalQueries) * 100;
    }
    updateCacheHitRate() {
        this.metrics.cacheHitRate = this.cacheAttempts > 0
            ? (this.cacheHits / this.cacheAttempts) * 100
            : 0;
    }
}
exports.GraphQLPerformanceMonitor = GraphQLPerformanceMonitor;
/**
 * Singleton instances
 */
exports.graphqlSchemaManager = new GraphQLSchemaManager();
exports.graphqlExecutor = new GraphQLExecutor(exports.graphqlSchemaManager);
exports.graphqlSubscriptionManager = new GraphQLSubscriptionManager();
exports.dataLoaderManager = new DataLoaderManager();
exports.graphqlFederationManager = new GraphQLFederationManager();
exports.graphqlPerformanceMonitor = new GraphQLPerformanceMonitor();
