/**
 * GraphQL API System
 * Schema definition, resolvers, subscriptions, federation, and query execution
 */
export interface GraphQLSchema {
    id: string;
    name: string;
    version: string;
    types: TypeDefinition[];
    queries: FieldDefinition[];
    mutations: FieldDefinition[];
    subscriptions: FieldDefinition[];
    directives: DirectiveDefinition[];
    createdAt: Date;
}
export interface TypeDefinition {
    name: string;
    kind: TypeKind;
    description?: string;
    fields?: FieldDefinition[];
    interfaces?: string[];
    enumValues?: EnumValue[];
    inputFields?: InputFieldDefinition[];
}
export declare enum TypeKind {
    Object = "OBJECT",
    Interface = "INTERFACE",
    Union = "UNION",
    Enum = "ENUM",
    InputObject = "INPUT_OBJECT",
    Scalar = "SCALAR"
}
export interface FieldDefinition {
    name: string;
    type: TypeReference;
    description?: string;
    args?: InputFieldDefinition[];
    deprecationReason?: string;
    resolver?: string;
}
export interface InputFieldDefinition {
    name: string;
    type: TypeReference;
    description?: string;
    defaultValue?: any;
}
export interface TypeReference {
    name: string;
    kind: TypeKind;
    ofType?: TypeReference;
    nonNull: boolean;
    list: boolean;
}
export interface EnumValue {
    name: string;
    description?: string;
    deprecationReason?: string;
}
export interface DirectiveDefinition {
    name: string;
    description?: string;
    locations: DirectiveLocation[];
    args?: InputFieldDefinition[];
}
export declare enum DirectiveLocation {
    Query = "QUERY",
    Mutation = "MUTATION",
    Subscription = "SUBSCRIPTION",
    Field = "FIELD",
    FragmentDefinition = "FRAGMENT_DEFINITION",
    FragmentSpread = "FRAGMENT_SPREAD",
    InlineFragment = "INLINE_FRAGMENT",
    Schema = "SCHEMA",
    Scalar = "SCALAR",
    Object = "OBJECT",
    FieldDefinition = "FIELD_DEFINITION",
    ArgumentDefinition = "ARGUMENT_DEFINITION",
    Interface = "INTERFACE",
    Union = "UNION",
    Enum = "ENUM",
    EnumValue = "ENUM_VALUE",
    InputObject = "INPUT_OBJECT",
    InputFieldDefinition = "INPUT_FIELD_DEFINITION"
}
export interface GraphQLQuery {
    id: string;
    operationType: OperationType;
    operationName?: string;
    query: string;
    variables?: Record<string, any>;
    context?: QueryContext;
    status: QueryStatus;
    result?: any;
    errors?: GraphQLError[];
    executionTime?: number;
    timestamp: Date;
}
export declare enum OperationType {
    Query = "query",
    Mutation = "mutation",
    Subscription = "subscription"
}
export declare enum QueryStatus {
    Pending = "pending",
    Executing = "executing",
    Completed = "completed",
    Failed = "failed"
}
export interface QueryContext {
    userId?: string;
    headers?: Record<string, string>;
    ip?: string;
    userAgent?: string;
}
export interface GraphQLError {
    message: string;
    locations?: ErrorLocation[];
    path?: (string | number)[];
    extensions?: Record<string, any>;
}
export interface ErrorLocation {
    line: number;
    column: number;
}
export interface Resolver {
    typeName: string;
    fieldName: string;
    resolve: ResolverFunction;
}
export type ResolverFunction = (parent: any, args: any, context: any, info: ResolverInfo) => any | Promise<any>;
export interface ResolverInfo {
    fieldName: string;
    fieldNodes: any[];
    returnType: TypeReference;
    parentType: TypeDefinition;
    path: any;
    schema: GraphQLSchema;
    fragments: Record<string, any>;
    rootValue: any;
    operation: any;
    variableValues: Record<string, any>;
}
export interface Subscription {
    id: string;
    query: string;
    variables?: Record<string, any>;
    context: QueryContext;
    topic: string;
    callback: (data: any) => void;
    createdAt: Date;
}
export interface DataLoader {
    name: string;
    batchLoadFn: (keys: any[]) => Promise<any[]>;
    cache: Map<any, Promise<any>>;
    batch: any[];
    batchScheduled: boolean;
}
export interface Federation {
    services: FederatedService[];
    gateway: FederationGateway;
}
export interface FederatedService {
    name: string;
    url: string;
    schema: GraphQLSchema;
    health: ServiceHealth;
}
export declare enum ServiceHealth {
    Healthy = "healthy",
    Degraded = "degraded",
    Unhealthy = "unhealthy"
}
export interface FederationGateway {
    schemas: Map<string, GraphQLSchema>;
    queryPlanner: QueryPlanner;
}
export interface QueryPlanner {
    plan: (query: string) => QueryPlan;
}
export interface QueryPlan {
    steps: QueryStep[];
}
export interface QueryStep {
    serviceName: string;
    query: string;
    variables?: Record<string, any>;
    requires?: string[];
}
export interface Introspection {
    schema: GraphQLSchema;
    queries: IntrospectionQuery[];
}
export interface IntrospectionQuery {
    name: string;
    query: string;
    description: string;
}
export interface ValidationRule {
    name: string;
    validate: (query: string, schema: GraphQLSchema) => ValidationError[];
}
export interface ValidationError {
    message: string;
    locations: ErrorLocation[];
}
export interface PerformanceMetrics {
    totalQueries: number;
    averageExecutionTime: number;
    slowestQueries: SlowQuery[];
    errorRate: number;
    cacheHitRate: number;
}
export interface SlowQuery {
    query: string;
    executionTime: number;
    timestamp: Date;
}
/**
 * GraphQL Schema Manager
 */
export declare class GraphQLSchemaManager {
    private schemas;
    private resolvers;
    /**
     * Register schema
     */
    registerSchema(schema: Omit<GraphQLSchema, 'id' | 'createdAt'>): GraphQLSchema;
    /**
     * Register resolver
     */
    registerResolver(typeName: string, fieldName: string, resolveFn: ResolverFunction): void;
    /**
     * Get resolver
     */
    getResolver(typeName: string, fieldName: string): Resolver | undefined;
    /**
     * Get schema
     */
    getSchema(name: string): GraphQLSchema | undefined;
    /**
     * List schemas
     */
    listSchemas(): GraphQLSchema[];
    /**
     * Validate schema
     */
    validateSchema(schema: GraphQLSchema): ValidationError[];
    /**
     * Merge schemas
     */
    mergeSchemas(schemas: GraphQLSchema[]): GraphQLSchema;
    private generateSchemaId;
}
/**
 * GraphQL Executor
 */
export declare class GraphQLExecutor {
    private schemaManager;
    private queries;
    private cache;
    constructor(schemaManager: GraphQLSchemaManager);
    /**
     * Execute query
     */
    execute(schemaName: string, query: string, variables?: Record<string, any>, context?: QueryContext): Promise<GraphQLQuery>;
    /**
     * Get query
     */
    getQuery(queryId: string): GraphQLQuery | undefined;
    /**
     * List queries
     */
    listQueries(filter?: {
        status?: QueryStatus;
        operationType?: OperationType;
    }): GraphQLQuery[];
    /**
     * Clear cache
     */
    clearCache(): void;
    private parseQuery;
    private extractFields;
    private detectOperationType;
    private validateQuery;
    private executeResolvers;
    private getCacheKey;
    private generateQueryId;
}
/**
 * GraphQL Subscription Manager
 */
export declare class GraphQLSubscriptionManager {
    private subscriptions;
    private topics;
    /**
     * Subscribe
     */
    subscribe(query: string, callback: (data: any) => void, variables?: Record<string, any>, context?: QueryContext): Subscription;
    /**
     * Unsubscribe
     */
    unsubscribe(subscriptionId: string): void;
    /**
     * Publish
     */
    publish(topic: string, data: any): void;
    /**
     * Get subscription
     */
    getSubscription(subscriptionId: string): Subscription | undefined;
    /**
     * List subscriptions
     */
    listSubscriptions(topic?: string): Subscription[];
    private extractTopic;
    private generateSubscriptionId;
}
/**
 * DataLoader for batch loading
 */
export declare class DataLoaderManager {
    private loaders;
    /**
     * Create loader
     */
    createLoader(name: string, batchLoadFn: (keys: any[]) => Promise<any[]>): DataLoader;
    /**
     * Load
     */
    load(loaderName: string, key: any): Promise<any>;
    /**
     * Load many
     */
    loadMany(loaderName: string, keys: any[]): Promise<any[]>;
    /**
     * Clear cache
     */
    clearCache(loaderName: string, key?: any): void;
    private dispatchBatch;
    /**
     * Get loader
     */
    getLoader(name: string): DataLoader | undefined;
}
/**
 * GraphQL Federation Manager
 */
export declare class GraphQLFederationManager {
    private services;
    private gateway;
    constructor();
    /**
     * Register service
     */
    registerService(service: FederatedService): void;
    /**
     * Execute federated query
     */
    executeFederatedQuery(query: string, variables?: Record<string, any>): Promise<any>;
    /**
     * Get service
     */
    getService(name: string): FederatedService | undefined;
    /**
     * List services
     */
    listServices(): FederatedService[];
    /**
     * Check service health
     */
    checkHealth(serviceName: string): Promise<ServiceHealth>;
    private planQuery;
    private executeServiceQuery;
}
/**
 * GraphQL Performance Monitor
 */
export declare class GraphQLPerformanceMonitor {
    private metrics;
    private executionTimes;
    private errors;
    private cacheHits;
    private cacheAttempts;
    /**
     * Record query
     */
    recordQuery(query: GraphQLQuery): void;
    /**
     * Record cache hit
     */
    recordCacheHit(hit: boolean): void;
    /**
     * Get metrics
     */
    getMetrics(): PerformanceMetrics;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
    private updateAverageExecutionTime;
    private updateErrorRate;
    private updateCacheHitRate;
}
/**
 * Singleton instances
 */
export declare const graphqlSchemaManager: GraphQLSchemaManager;
export declare const graphqlExecutor: GraphQLExecutor;
export declare const graphqlSubscriptionManager: GraphQLSubscriptionManager;
export declare const dataLoaderManager: DataLoaderManager;
export declare const graphqlFederationManager: GraphQLFederationManager;
export declare const graphqlPerformanceMonitor: GraphQLPerformanceMonitor;
//# sourceMappingURL=GraphQLSystem.d.ts.map