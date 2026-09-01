/**
 * API Documentation Generator
 * OpenAPI/Swagger generation, automatic documentation, interactive explorer
 * Markdown export, versioning, custom templates
 */
import { EventEmitter } from 'events';
export interface APIDocGeneratorConfig {
    enableOpenAPI: boolean;
    enableSwagger: boolean;
    enableMarkdown: boolean;
    enableInteractiveUI: boolean;
    defaultVersion: string;
    basePath: string;
    outputPath: string;
}
export interface APIDocumentation {
    id: string;
    name: string;
    version: string;
    description?: string;
    servers: Server[];
    paths: Map<string, PathItem>;
    components: Components;
    security?: SecurityRequirement[];
    tags?: Tag[];
    externalDocs?: ExternalDocumentation;
    metadata: DocMetadata;
}
export interface Server {
    url: string;
    description?: string;
    variables?: Map<string, ServerVariable>;
}
export interface ServerVariable {
    enum?: string[];
    default: string;
    description?: string;
}
export interface PathItem {
    summary?: string;
    description?: string;
    operations: Map<HTTPMethod, Operation>;
    parameters?: Parameter[];
    servers?: Server[];
}
export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'trace';
export interface Operation {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: Parameter[];
    requestBody?: RequestBody;
    responses: Map<string, Response>;
    security?: SecurityRequirement[];
    deprecated?: boolean;
    servers?: Server[];
}
export interface Parameter {
    name: string;
    in: ParameterLocation;
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema: Schema;
    example?: any;
    examples?: Map<string, Example>;
}
export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';
export interface RequestBody {
    description?: string;
    required?: boolean;
    content: Map<string, MediaType>;
}
export interface MediaType {
    schema?: Schema;
    example?: any;
    examples?: Map<string, Example>;
    encoding?: Map<string, Encoding>;
}
export interface Encoding {
    contentType?: string;
    headers?: Map<string, Header>;
    style?: string;
    explode?: boolean;
}
export interface Response {
    description: string;
    headers?: Map<string, Header>;
    content?: Map<string, MediaType>;
    links?: Map<string, Link>;
}
export interface Header {
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema: Schema;
}
export interface Link {
    operationRef?: string;
    operationId?: string;
    parameters?: Map<string, any>;
    requestBody?: any;
    description?: string;
}
export interface Schema {
    type?: SchemaType | SchemaType[];
    format?: string;
    title?: string;
    description?: string;
    default?: any;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    enum?: any[];
    properties?: Map<string, Schema>;
    items?: Schema;
    allOf?: Schema[];
    oneOf?: Schema[];
    anyOf?: Schema[];
    not?: Schema;
    discriminator?: Discriminator;
    readOnly?: boolean;
    writeOnly?: boolean;
    example?: any;
    examples?: any[];
    deprecated?: boolean;
    $ref?: string;
}
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
export interface Discriminator {
    propertyName: string;
    mapping?: Map<string, string>;
}
export interface Example {
    summary?: string;
    description?: string;
    value?: any;
    externalValue?: string;
}
export interface Components {
    schemas?: Map<string, Schema>;
    responses?: Map<string, Response>;
    parameters?: Map<string, Parameter>;
    examples?: Map<string, Example>;
    requestBodies?: Map<string, RequestBody>;
    headers?: Map<string, Header>;
    securitySchemes?: Map<string, SecurityScheme>;
    links?: Map<string, Link>;
    callbacks?: Map<string, Callback>;
}
export interface SecurityScheme {
    type: SecuritySchemeType;
    description?: string;
    name?: string;
    in?: ParameterLocation;
    scheme?: string;
    bearerFormat?: string;
    flows?: OAuthFlows;
    openIdConnectUrl?: string;
}
export type SecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
export interface OAuthFlows {
    implicit?: OAuthFlow;
    password?: OAuthFlow;
    clientCredentials?: OAuthFlow;
    authorizationCode?: OAuthFlow;
}
export interface OAuthFlow {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Map<string, string>;
}
export interface SecurityRequirement {
    [name: string]: string[];
}
export interface Callback {
    [expression: string]: PathItem;
}
export interface Tag {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
}
export interface ExternalDocumentation {
    description?: string;
    url: string;
}
export interface DocMetadata {
    createdAt: number;
    updatedAt: number;
    author?: string;
    license?: License;
    contact?: Contact;
}
export interface License {
    name: string;
    url?: string;
}
export interface Contact {
    name?: string;
    url?: string;
    email?: string;
}
export interface DocGenerationOptions {
    format: DocFormat;
    includeExamples?: boolean;
    includeSchemas?: boolean;
    includeSecuritySchemes?: boolean;
    template?: string;
}
export type DocFormat = 'openapi' | 'swagger' | 'markdown' | 'html' | 'postman';
export interface DocTemplate {
    id: string;
    name: string;
    format: DocFormat;
    template: string;
    variables: Set<string>;
}
export declare class APIDocGenerator extends EventEmitter {
    private config;
    private documentations;
    private templates;
    constructor(config?: Partial<APIDocGeneratorConfig>);
    createDocumentation(name: string, version: string, options?: Partial<APIDocumentation>): APIDocumentation;
    addPath(docId: string, path: string, pathItem: Partial<PathItem>): void;
    addOperation(docId: string, path: string, method: HTTPMethod, operation: Operation): void;
    addSchema(docId: string, name: string, schema: Schema): void;
    addSecurityScheme(docId: string, name: string, scheme: SecurityScheme): void;
    addExample(docId: string, name: string, example: Example): void;
    generateFromRoutes(docId: string, routes: RouteDefinition[]): void;
    generateFromTypeScript(docId: string, interfaceCode: string): Schema;
    private mapTypeScriptType;
    private generateResponses;
    generateOpenAPI(docId: string, options?: DocGenerationOptions): string;
    generateSwagger(docId: string): string;
    generateMarkdown(docId: string): string;
    private serializePaths;
    private serializeOperation;
    private serializeParameter;
    private serializeRequestBody;
    private serializeMediaType;
    private serializeResponse;
    private serializeSchema;
    private serializeComponents;
    private serializePathsSwagger;
    private serializeSchemasSwagger;
    private serializeSecuritySwagger;
    private initializeDefaultTemplates;
    addTemplate(template: DocTemplate): void;
    private generateId;
    getDocumentation(docId: string): APIDocumentation | undefined;
    getStats(): DocStats;
}
interface RouteDefinition {
    path: string;
    method: HTTPMethod;
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: Parameter[];
    requestBody?: RequestBody;
    responses?: Record<string, string>;
    security?: SecurityRequirement[];
    deprecated?: boolean;
}
interface DocStats {
    documentations: number;
    templates: number;
}
export default APIDocGenerator;
//# sourceMappingURL=APIDocGenerator.d.ts.map