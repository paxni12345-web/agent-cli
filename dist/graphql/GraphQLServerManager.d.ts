/**
 * GraphQL Server & Schema Management System
 * Schema generation, resolvers, subscriptions, federation support
 * Query optimization, caching, DataLoader integration
 */
import { EventEmitter } from 'events';
export interface GraphQLServerConfig {
    port: number;
    enablePlayground: boolean;
    enableIntrospection: boolean;
    enableTracing: boolean;
    enableCaching: boolean;
    enableDataLoader: boolean;
    enableSubscriptions: boolean;
    enableFederation: boolean;
    maxQueryDepth: number;
    maxQueryComplexity: number;
    timeout: number;
}
export interface GraphQLSchema {
    id: string;
    name: string;
    version: string;
    types: Map<string, GraphQLType>;
    queries: Map<string, QueryDefinition>;
    mutations: Map<string, MutationDefinition>;
    subscriptions: Map<string, SubscriptionDefinition>;
    directives: Map<string, DirectiveDefinition>;
    metadata: SchemaMetadata;
}
export interface GraphQLType {
    name: string;
    kind: TypeKind;
    description?: string;
    fields?: Map<string, FieldDefinition>;
    interfaces?: string[];
    enumValues?: string[];
    possibleTypes?: string[];
    inputFields?: Map<string, InputFieldDefinition>;
}
export type TypeKind = 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR' | 'LIST' | 'NON_NULL';
export interface FieldDefinition {
    name: string;
    type: TypeReference;
    description?: string;
    args?: Map<string, ArgumentDefinition>;
    resolver?: Resolver;
    directives?: DirectiveApplication[];
    deprecationReason?: string;
}
export interface TypeReference {
    name: string;
    kind: TypeKind;
    ofType?: TypeReference;
}
export interface ArgumentDefinition {
    name: string;
    type: TypeReference;
    description?: string;
    defaultValue?: any;
}
export interface InputFieldDefinition {
    name: string;
    type: TypeReference;
    description?: string;
    defaultValue?: any;
}
export interface QueryDefinition {
    name: string;
    type: TypeReference;
    args?: Map<string, ArgumentDefinition>;
    resolver: Resolver;
    complexity?: number;
    cacheControl?: CacheControlDirective;
}
export interface MutationDefinition {
    name: string;
    type: TypeReference;
    args?: Map<string, ArgumentDefinition>;
    resolver: Resolver;
}
export interface SubscriptionDefinition {
    name: string;
    type: TypeReference;
    args?: Map<string, ArgumentDefinition>;
    subscribe: SubscriptionResolver;
    resolve?: Resolver;
}
export type Resolver = (parent: any, args: Record<string, any>, context: GraphQLContext, info: ResolveInfo) => any;
export type SubscriptionResolver = (parent: any, args: Record<string, any>, context: GraphQLContext, info: ResolveInfo) => AsyncIterator<any>;
export interface GraphQLContext {
    requestId: string;
    user?: any;
    headers: Record<string, string>;
    dataSources: Map<string, any>;
    loaders: Map<string, DataLoader>;
    cacheControl: CacheControl;
    [key: string]: any;
}
export interface ResolveInfo {
    fieldName: string;
    fieldNodes: any[];
    returnType: TypeReference;
    parentType: GraphQLType;
    path: string[];
    schema: GraphQLSchema;
    fragments: Record<string, any>;
    operation: OperationDefinition;
    variableValues: Record<string, any>;
}
export interface DirectiveDefinition {
    name: string;
    description?: string;
    locations: DirectiveLocation[];
    args?: Map<string, ArgumentDefinition>;
    executor?: DirectiveExecutor;
}
export type DirectiveLocation = 'QUERY' | 'MUTATION' | 'SUBSCRIPTION' | 'FIELD' | 'FRAGMENT_DEFINITION' | 'FRAGMENT_SPREAD' | 'INLINE_FRAGMENT' | 'SCHEMA' | 'SCALAR' | 'OBJECT' | 'FIELD_DEFINITION' | 'ARGUMENT_DEFINITION' | 'INTERFACE' | 'UNION' | 'ENUM' | 'ENUM_VALUE' | 'INPUT_OBJECT' | 'INPUT_FIELD_DEFINITION';
export interface DirectiveApplication {
    name: string;
    args: Record<string, any>;
}
export type DirectiveExecutor = (resolve: Resolver, parent: any, args: Record<string, any>, context: GraphQLContext, info: ResolveInfo) => any;
export interface SchemaMetadata {
    description?: string;
    createdAt: number;
    updatedAt: number;
    version: string;
}
export interface CacheControlDirective {
    maxAge?: number;
    scope?: 'PUBLIC' | 'PRIVATE';
}
export interface OperationDefinition {
    operation: 'query' | 'mutation' | 'subscription';
    name?: string;
    variableDefinitions: VariableDefinition[];
    directives: DirectiveApplication[];
    selectionSet: SelectionSet;
}
export interface VariableDefinition {
    variable: string;
    type: TypeReference;
    defaultValue?: any;
}
export interface SelectionSet {
    selections: Selection[];
}
export type Selection = Field | FragmentSpread | InlineFragment;
export interface Field {
    kind: 'Field';
    name: string;
    alias?: string;
    args?: Record<string, any>;
    directives?: DirectiveApplication[];
    selectionSet?: SelectionSet;
}
export interface FragmentSpread {
    kind: 'FragmentSpread';
    name: string;
    directives?: DirectiveApplication[];
}
export interface InlineFragment {
    kind: 'InlineFragment';
    typeCondition?: string;
    directives?: DirectiveApplication[];
    selectionSet: SelectionSet;
}
export interface DataLoader {
    id: string;
    load: (key: any) => Promise<any>;
    loadMany: (keys: any[]) => Promise<any[]>;
    clear: (key: any) => void;
    clearAll: () => void;
    prime: (key: any, value: any) => void;
}
export interface CacheControl {
    setCacheHint: (hint: CacheHint) => void;
    cacheHints: CacheHint[];
}
export interface CacheHint {
    maxAge?: number;
    scope?: 'PUBLIC' | 'PRIVATE';
    path: string[];
}
export interface QueryExecutionResult {
    data?: any;
    errors?: GraphQLError[];
    extensions?: Record<string, any>;
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
export interface SubscriptionConnection {
    id: string;
    subscriptionId: string;
    operation: OperationDefinition;
    context: GraphQLContext;
    iterator: AsyncIterator<any>;
    active: boolean;
}
export declare class GraphQLServerManager extends EventEmitter {
    private config;
    private schemas;
    private activeSchema?;
    private resolvers;
    private subscriptions;
    private loaders;
    private queryCache;
    constructor(config?: Partial<GraphQLServerConfig>);
    createSchema(name: string): GraphQLSchema;
    setActiveSchema(schemaId: string): void;
    getSchema(schemaId: string): GraphQLSchema | undefined;
    addType(schemaId: string, type: GraphQLType): void;
    addObjectType(schemaId: string, name: string, fields: Map<string, FieldDefinition>, options?: Partial<GraphQLType>): void;
    addInterfaceType(schemaId: string, name: string, fields: Map<string, FieldDefinition>, options?: Partial<GraphQLType>): void;
    addEnumType(schemaId: string, name: string, values: string[], options?: Partial<GraphQLType>): void;
    addInputType(schemaId: string, name: string, fields: Map<string, InputFieldDefinition>, options?: Partial<GraphQLType>): void;
    addScalarType(schemaId: string, name: string, options?: Partial<GraphQLType>): void;
    addQuery(schemaId: string, name: string, definition: Omit<QueryDefinition, 'name'>): void;
    addMutation(schemaId: string, name: string, definition: Omit<MutationDefinition, 'name'>): void;
    addSubscription(schemaId: string, name: string, definition: Omit<SubscriptionDefinition, 'name'>): void;
    addDirective(schemaId: string, directive: DirectiveDefinition): void;
    private initializeBuiltInDirectives;
    executeQuery(query: string, variables?: Record<string, any>, context?: Partial<GraphQLContext>): Promise<QueryExecutionResult>;
    private executeOperation;
    subscribeToOperation(query: string, variables?: Record<string, any>, context?: Partial<GraphQLContext>): Promise<string>;
    private processSubscription;
    unsubscribe(subscriptionId: string): void;
    createDataLoader(name: string, batchLoadFn: (keys: any[]) => Promise<any[]>): DataLoader;
    private validateQuery;
    private calculateQueryDepth;
    private calculateQueryComplexity;
    private parseQuery;
    generateSDL(schemaId: string): string;
    private generateTypeSDL;
    private formatTypeReference;
    private initializeBuiltInTypes;
    private createCacheControl;
    private generateCacheKey;
    private generateId;
    getStats(): GraphQLStats;
}
interface GraphQLStats {
    schemas: number;
    activeSubscriptions: number;
    loaders: number;
    cachedQueries: number;
}
export default GraphQLServerManager;
//# sourceMappingURL=GraphQLServerManager.d.ts.map