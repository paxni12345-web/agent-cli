/**
 * API Documentation Generator
 * OpenAPI/Swagger generation, automatic documentation, interactive explorer
 * Markdown export, versioning, custom templates
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

// ============================================================================
// API Documentation Generator
// ============================================================================

export class APIDocGenerator extends EventEmitter {
  private config: APIDocGeneratorConfig;
  private documentations: Map<string, APIDocumentation> = new Map();
  private templates: Map<string, DocTemplate> = new Map();

  constructor(config: Partial<APIDocGeneratorConfig> = {}) {
    super();
    this.config = {
      enableOpenAPI: true,
      enableSwagger: true,
      enableMarkdown: true,
      enableInteractiveUI: true,
      defaultVersion: '3.0.0',
      basePath: '/api',
      outputPath: './docs',
      ...config,
    };

    this.initializeDefaultTemplates();
  }

  // ========================================================================
  // Documentation Creation
  // ========================================================================

  public createDocumentation(
    name: string,
    version: string,
    options: Partial<APIDocumentation> = {}
  ): APIDocumentation {
    const doc: APIDocumentation = {
      id: this.generateId(),
      name,
      version,
      description: options.description,
      servers: options.servers || [],
      paths: new Map(),
      components: {
        schemas: new Map(),
        responses: new Map(),
        parameters: new Map(),
        examples: new Map(),
        requestBodies: new Map(),
        headers: new Map(),
        securitySchemes: new Map(),
        links: new Map(),
        callbacks: new Map(),
      },
      security: options.security,
      tags: options.tags,
      externalDocs: options.externalDocs,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        author: options.metadata?.author,
        license: options.metadata?.license,
        contact: options.metadata?.contact,
      },
    };

    this.documentations.set(doc.id, doc);
    this.emit('doc:created', { doc });

    return doc;
  }

  // ========================================================================
  // Path & Operation Management
  // ========================================================================

  public addPath(
    docId: string,
    path: string,
    pathItem: Partial<PathItem>
  ): void {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    const fullPath: PathItem = {
      summary: pathItem.summary,
      description: pathItem.description,
      operations: pathItem.operations || new Map(),
      parameters: pathItem.parameters,
      servers: pathItem.servers,
    };

    doc.paths.set(path, fullPath);
    doc.metadata.updatedAt = Date.now();

    this.emit('path:added', { doc, path, pathItem: fullPath });
  }

  public addOperation(
    docId: string,
    path: string,
    method: HTTPMethod,
    operation: Operation
  ): void {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    let pathItem = doc.paths.get(path);
    if (!pathItem) {
      pathItem = {
        operations: new Map(),
      };
      doc.paths.set(path, pathItem);
    }

    pathItem.operations.set(method, operation);
    doc.metadata.updatedAt = Date.now();

    this.emit('operation:added', { doc, path, method, operation });
  }

  // ========================================================================
  // Component Management
  // ========================================================================

  public addSchema(docId: string, name: string, schema: Schema): void {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    doc.components.schemas!.set(name, schema);
    doc.metadata.updatedAt = Date.now();

    this.emit('schema:added', { doc, name, schema });
  }

  public addSecurityScheme(
    docId: string,
    name: string,
    scheme: SecurityScheme
  ): void {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    doc.components.securitySchemes!.set(name, scheme);
    doc.metadata.updatedAt = Date.now();

    this.emit('security_scheme:added', { doc, name, scheme });
  }

  public addExample(docId: string, name: string, example: Example): void {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    doc.components.examples!.set(name, example);
    doc.metadata.updatedAt = Date.now();

    this.emit('example:added', { doc, name, example });
  }

  // ========================================================================
  // Auto-Generation from Code
  // ========================================================================

  public generateFromRoutes(
    docId: string,
    routes: RouteDefinition[]
  ): void {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    for (const route of routes) {
      const operation: Operation = {
        operationId: route.operationId,
        summary: route.summary,
        description: route.description,
        tags: route.tags,
        parameters: route.parameters,
        requestBody: route.requestBody,
        responses: this.generateResponses(route.responses),
        security: route.security,
        deprecated: route.deprecated,
      };

      this.addOperation(docId, route.path, route.method, operation);
    }

    this.emit('doc:generated', { doc });
  }

  public generateFromTypeScript(
    docId: string,
    interfaceCode: string
  ): Schema {
    // Simplified TypeScript parsing - use typescript compiler API in production
    const schema: Schema = {
      type: 'object',
      properties: new Map(),
    };

    // Parse interface and extract properties
    const propertyRegex = /(\w+)(\?)?:\s*(\w+)/g;
    let match;

    while ((match = propertyRegex.exec(interfaceCode)) !== null) {
      const [, name, optional, type] = match;

      schema.properties!.set(name, {
        type: this.mapTypeScriptType(type),
      });

      if (!optional && !schema.required) {
        schema.required = [];
      }
      if (!optional) {
        schema.required!.push(name);
      }
    }

    return schema;
  }

  private mapTypeScriptType(tsType: string): SchemaType {
    const typeMap: Record<string, SchemaType> = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      any: 'object',
      object: 'object',
      array: 'array',
    };

    return typeMap[tsType.toLowerCase()] || 'string';
  }

  private generateResponses(responses?: Record<string, string>): Map<string, Response> {
    const responseMap = new Map<string, Response>();

    if (!responses) {
      responseMap.set('200', {
        description: 'Successful response',
      });
      return responseMap;
    }

    for (const [code, description] of Object.entries(responses)) {
      responseMap.set(code, { description });
    }

    return responseMap;
  }

  // ========================================================================
  // Export & Generation
  // ========================================================================

  public generateOpenAPI(docId: string, options: DocGenerationOptions = { format: 'openapi' }): string {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    const openapi: any = {
      openapi: this.config.defaultVersion,
      info: {
        title: doc.name,
        version: doc.version,
        description: doc.description,
        contact: doc.metadata.contact,
        license: doc.metadata.license,
      },
      servers: doc.servers.map(s => ({
        url: s.url,
        description: s.description,
        variables: s.variables ? Object.fromEntries(s.variables) : undefined,
      })),
      paths: this.serializePaths(doc.paths, options),
      components: this.serializeComponents(doc.components, options),
      security: doc.security,
      tags: doc.tags,
      externalDocs: doc.externalDocs,
    };

    return JSON.stringify(openapi, null, 2);
  }

  public generateSwagger(docId: string): string {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    // Convert OpenAPI 3.0 to Swagger 2.0 format
    const swagger: any = {
      swagger: '2.0',
      info: {
        title: doc.name,
        version: doc.version,
        description: doc.description,
      },
      host: doc.servers[0]?.url || 'localhost',
      basePath: this.config.basePath,
      schemes: ['http', 'https'],
      paths: this.serializePathsSwagger(doc.paths),
      definitions: this.serializeSchemasSwagger(doc.components.schemas),
      securityDefinitions: this.serializeSecuritySwagger(doc.components.securitySchemes),
    };

    return JSON.stringify(swagger, null, 2);
  }

  public generateMarkdown(docId: string): string {
    const doc = this.documentations.get(docId);
    if (!doc) {
      throw new Error(`Documentation not found: ${docId}`);
    }

    let md = `# ${doc.name}\n\n`;
    md += `Version: ${doc.version}\n\n`;

    if (doc.description) {
      md += `${doc.description}\n\n`;
    }

    // Servers
    if (doc.servers.length > 0) {
      md += `## Servers\n\n`;
      for (const server of doc.servers) {
        md += `- ${server.url}`;
        if (server.description) {
          md += ` - ${server.description}`;
        }
        md += '\n';
      }
      md += '\n';
    }

    // Paths
    md += `## API Endpoints\n\n`;
    for (const [path, pathItem] of doc.paths.entries()) {
      md += `### ${path}\n\n`;

      if (pathItem.description) {
        md += `${pathItem.description}\n\n`;
      }

      for (const [method, operation] of pathItem.operations.entries()) {
        md += `#### ${method.toUpperCase()}\n\n`;

        if (operation.summary) {
          md += `**Summary:** ${operation.summary}\n\n`;
        }

        if (operation.description) {
          md += `${operation.description}\n\n`;
        }

        if (operation.parameters && operation.parameters.length > 0) {
          md += `**Parameters:**\n\n`;
          md += `| Name | In | Type | Required | Description |\n`;
          md += `|------|-----|------|----------|-------------|\n`;

          for (const param of operation.parameters) {
            md += `| ${param.name} | ${param.in} | ${param.schema.type} | ${param.required ? 'Yes' : 'No'} | ${param.description || ''} |\n`;
          }
          md += '\n';
        }

        if (operation.responses.size > 0) {
          md += `**Responses:**\n\n`;
          for (const [code, response] of operation.responses.entries()) {
            md += `- **${code}**: ${response.description}\n`;
          }
          md += '\n';
        }
      }
    }

    // Schemas
    if (doc.components.schemas && doc.components.schemas.size > 0) {
      md += `## Schemas\n\n`;
      for (const [name, schema] of doc.components.schemas.entries()) {
        md += `### ${name}\n\n`;
        if (schema.description) {
          md += `${schema.description}\n\n`;
        }
        md += '```json\n';
        md += JSON.stringify(this.serializeSchema(schema), null, 2);
        md += '\n```\n\n';
      }
    }

    return md;
  }

  // ========================================================================
  // Serialization Helpers
  // ========================================================================

  private serializePaths(paths: Map<string, PathItem>, options: DocGenerationOptions): any {
    const result: any = {};

    for (const [path, pathItem] of paths.entries()) {
      result[path] = {
        summary: pathItem.summary,
        description: pathItem.description,
      };

      for (const [method, operation] of pathItem.operations.entries()) {
        result[path][method] = this.serializeOperation(operation, options);
      }
    }

    return result;
  }

  private serializeOperation(operation: Operation, options: DocGenerationOptions): any {
    return {
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags,
      parameters: operation.parameters?.map(p => this.serializeParameter(p)),
      requestBody: operation.requestBody ? this.serializeRequestBody(operation.requestBody) : undefined,
      responses: Object.fromEntries(
        Array.from(operation.responses.entries()).map(([code, resp]) => [
          code,
          this.serializeResponse(resp),
        ])
      ),
      security: operation.security,
      deprecated: operation.deprecated,
    };
  }

  private serializeParameter(param: Parameter): any {
    return {
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required,
      deprecated: param.deprecated,
      schema: this.serializeSchema(param.schema),
      example: param.example,
    };
  }

  private serializeRequestBody(requestBody: RequestBody): any {
    return {
      description: requestBody.description,
      required: requestBody.required,
      content: Object.fromEntries(
        Array.from(requestBody.content.entries()).map(([type, media]) => [
          type,
          this.serializeMediaType(media),
        ])
      ),
    };
  }

  private serializeMediaType(media: MediaType): any {
    return {
      schema: media.schema ? this.serializeSchema(media.schema) : undefined,
      example: media.example,
    };
  }

  private serializeResponse(response: Response): any {
    return {
      description: response.description,
      content: response.content
        ? Object.fromEntries(
            Array.from(response.content.entries()).map(([type, media]) => [
              type,
              this.serializeMediaType(media),
            ])
          )
        : undefined,
    };
  }

  private serializeSchema(schema: Schema): any {
    const result: any = {
      type: schema.type,
      format: schema.format,
      description: schema.description,
      default: schema.default,
      enum: schema.enum,
      example: schema.example,
    };

    if (schema.properties) {
      result.properties = Object.fromEntries(
        Array.from(schema.properties.entries()).map(([name, prop]) => [
          name,
          this.serializeSchema(prop),
        ])
      );
    }

    if (schema.items) {
      result.items = this.serializeSchema(schema.items);
    }

    if (schema.required) {
      result.required = schema.required;
    }

    return result;
  }

  private serializeComponents(components: Components, options: DocGenerationOptions): any {
    return {
      schemas: components.schemas
        ? Object.fromEntries(
            Array.from(components.schemas.entries()).map(([name, schema]) => [
              name,
              this.serializeSchema(schema),
            ])
          )
        : undefined,
      securitySchemes: components.securitySchemes
        ? Object.fromEntries(components.securitySchemes.entries())
        : undefined,
    };
  }

  private serializePathsSwagger(paths: Map<string, PathItem>): any {
    // Simplified Swagger 2.0 serialization
    return Object.fromEntries(paths.entries());
  }

  private serializeSchemasSwagger(schemas?: Map<string, Schema>): any {
    if (!schemas) return undefined;
    return Object.fromEntries(
      Array.from(schemas.entries()).map(([name, schema]) => [
        name,
        this.serializeSchema(schema),
      ])
    );
  }

  private serializeSecuritySwagger(schemes?: Map<string, SecurityScheme>): any {
    if (!schemes) return undefined;
    return Object.fromEntries(schemes.entries());
  }

  // ========================================================================
  // Templates
  // ========================================================================

  private initializeDefaultTemplates(): void {
    // Initialize default templates for different formats
  }

  public addTemplate(template: DocTemplate): void {
    this.templates.set(template.id, template);
    this.emit('template:added', { template });
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getDocumentation(docId: string): APIDocumentation | undefined {
    return this.documentations.get(docId);
  }

  public getStats(): DocStats {
    return {
      documentations: this.documentations.size,
      templates: this.templates.size,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export default APIDocGenerator;
