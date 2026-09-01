/**
 * MEGA PHASE 19: GRAPHQL SERVER & FEDERATION
 * Complete GraphQL implementation with subscriptions, federation, caching
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface GraphQLConfig {
    schemaPath?: string;
    introspection: boolean;
    playground: boolean;
    tracing: boolean;
    caching: boolean;
    persistedQueries: boolean;
    maxDepth: number;
    maxComplexity: number;
}
export interface Schema {
    types: Map<string, GraphQLType>;
    queries: Map<string, Field>;
    mutations: Map<string, Field>;
    subscriptions: Map<string, Field>;
    directives: Directive[];
}
export interface GraphQLType {
    name: string;
    kind: TypeKind;
    description?: string;
    fields?: Field[];
    interfaces?: string[];
    possibleTypes?: string[];
    enumValues?: EnumValue[];
    inputFields?: InputField[];
}
export type TypeKind = 'SCALAR' | 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'LIST' | 'NON_NULL';
export interface Field {
    name: string;
    type: TypeReference;
    args: Argument[];
    description?: string;
    deprecationReason?: string;
    resolve?: Resolver;
}
export interface TypeReference {
    kind: TypeKind;
    name?: string;
    ofType?: TypeReference;
}
export interface Argument {
    name: string;
    type: TypeReference;
    defaultValue?: any;
    description?: string;
}
export interface EnumValue {
    name: string;
    value: string;
    description?: string;
    deprecationReason?: string;
}
export interface InputField {
    name: string;
    type: TypeReference;
    defaultValue?: any;
    description?: string;
}
export interface Directive {
    name: string;
    locations: DirectiveLocation[];
    args: Argument[];
    description?: string;
}
export type DirectiveLocation = 'QUERY' | 'MUTATION' | 'SUBSCRIPTION' | 'FIELD' | 'FRAGMENT_DEFINITION' | 'FRAGMENT_SPREAD' | 'INLINE_FRAGMENT' | 'SCHEMA' | 'SCALAR' | 'OBJECT' | 'FIELD_DEFINITION' | 'ARGUMENT_DEFINITION' | 'INTERFACE' | 'UNION' | 'ENUM' | 'ENUM_VALUE' | 'INPUT_OBJECT' | 'INPUT_FIELD_DEFINITION';
export type Resolver = (parent: any, args: any, context: any, info: ResolveInfo) => any;
export interface ResolveInfo {
    fieldName: string;
    fieldNodes: any[];
    returnType: TypeReference;
    parentType: GraphQLType;
    path: ResponsePath;
    schema: Schema;
    fragments: Map<string, any>;
    rootValue: any;
    operation: OperationDefinition;
    variableValues: Map<string, any>;
}
export interface ResponsePath {
    prev?: ResponsePath;
    key: string | number;
}
export interface OperationDefinition {
    operation: OperationType;
    name?: string;
    variableDefinitions: VariableDefinition[];
    directives: DirectiveNode[];
    selectionSet: SelectionSet;
}
export type OperationType = 'query' | 'mutation' | 'subscription';
export interface VariableDefinition {
    variable: Variable;
    type: TypeReference;
    defaultValue?: any;
}
export interface Variable {
    name: string;
}
export interface DirectiveNode {
    name: string;
    arguments: ArgumentNode[];
}
export interface ArgumentNode {
    name: string;
    value: any;
}
export interface SelectionSet {
    selections: Selection[];
}
export type Selection = FieldNode | FragmentSpread | InlineFragment;
export interface FieldNode {
    kind: 'Field';
    name: string;
    alias?: string;
    arguments: ArgumentNode[];
    directives: DirectiveNode[];
    selectionSet?: SelectionSet;
}
export interface FragmentSpread {
    kind: 'FragmentSpread';
    name: string;
    directives: DirectiveNode[];
}
export interface InlineFragment {
    kind: 'InlineFragment';
    typeCondition?: string;
    directives: DirectiveNode[];
    selectionSet: SelectionSet;
}
export declare class GraphQLSchema {
    private types;
    private queries;
    private mutations;
    private subscriptions;
    private directives;
    constructor();
    private initializeBuiltInTypes;
    private initializeBuiltInDirectives;
    addType(type: GraphQLType): void;
    addQuery(name: string, field: Field): void;
    addMutation(name: string, field: Field): void;
    addSubscription(name: string, field: Field): void;
    getType(name: string): GraphQLType | undefined;
    toSDL(): string;
    private typeToSDL;
    private fieldToSDL;
    private typeRefToSDL;
}
export interface ExecutionContext {
    schema: Schema;
    operation: OperationDefinition;
    rootValue: any;
    contextValue: any;
    variableValues: Map<string, any>;
    fragments: Map<string, any>;
}
export interface ExecutionResult {
    data?: any;
    errors?: GraphQLError[];
    extensions?: Map<string, any>;
}
export interface GraphQLError {
    message: string;
    locations?: SourceLocation[];
    path?: (string | number)[];
    extensions?: Map<string, any>;
}
export interface SourceLocation {
    line: number;
    column: number;
}
export declare class GraphQLExecutor extends EventEmitter {
    private schema;
    private resolvers;
    constructor(schema: GraphQLSchema);
    setResolver(typeName: string, fieldName: string, resolver: Resolver): void;
    execute(query: string, variables?: Record<string, any>, context?: any): Promise<ExecutionResult>;
    private parseQuery;
    private validate;
    private executeOperation;
    private executeSelectionSet;
    private executeField;
    private getArgumentValues;
}
export interface SubscriptionConfig {
    path: string;
    keepAlive: number;
}
export interface Subscription {
    id: string;
    query: string;
    variables: Record<string, any>;
    context: any;
    iterator: AsyncIterator<any>;
    active: boolean;
}
export declare class GraphQLSubscriptionManager extends EventEmitter {
    private config;
    private subscriptions;
    private topics;
    constructor(config?: Partial<SubscriptionConfig>);
    subscribe(query: string, variables?: Record<string, any>, context?: any): Promise<Subscription>;
    private extractTopics;
    private createAsyncIterator;
    publish(topic: string, payload: any): Promise<void>;
    unsubscribe(subscriptionId: string): Promise<void>;
    private generateId;
    getStats(): {
        subscriptions: number;
        topics: number;
    };
}
export interface FederationConfig {
    serviceName: string;
    services: FederatedService[];
    enableTracing: boolean;
}
export interface FederatedService {
    name: string;
    url: string;
    schema: Schema;
}
export interface EntityReference {
    __typename: string;
    [key: string]: any;
}
export declare class GraphQLFederation extends EventEmitter {
    private config;
    private services;
    private gateway?;
    constructor(config?: Partial<FederationConfig>);
    addService(service: FederatedService): void;
    createGateway(): FederationGateway;
    resolveEntity(reference: EntityReference): Promise<any>;
    private findServiceForType;
    private queryService;
    private sleep;
    getStats(): {
        services: number;
    };
}
export declare class FederationGateway {
    private services;
    private queryPlanCache;
    constructor(services: Map<string, FederatedService>);
    execute(query: string, variables?: Record<string, any>): Promise<ExecutionResult>;
    private createQueryPlan;
    private executePlan;
    private executeOnService;
    private sleep;
}
export interface QueryPlan {
    steps: QueryPlanStep[];
}
export interface QueryPlanStep {
    service: string;
    query: string;
    requires: EntityReference[];
}
export interface CacheConfig {
    ttl: number;
    maxSize: number;
    strategy: CacheStrategy;
}
export type CacheStrategy = 'memory' | 'redis' | 'memcached';
export declare class GraphQLCache {
    private config;
    private cache;
    constructor(config?: Partial<CacheConfig>);
    set(key: string, value: any, ttl?: number): void;
    get(key: string): any | null;
    delete(key: string): void;
    clear(): void;
}
export interface CacheEntry {
    value: any;
    expiresAt: number;
}
export declare class CompleteGraphQLSystem {
    schema: GraphQLSchema;
    executor: GraphQLExecutor;
    subscriptions: GraphQLSubscriptionManager;
    federation: GraphQLFederation;
    cache: GraphQLCache;
    constructor();
    getOverallStats(): {
        subscriptions: {
            subscriptions: number;
            topics: number;
        };
        federation: {
            services: number;
        };
    };
}
//# sourceMappingURL=MEGA_GraphQLServer.d.ts.map