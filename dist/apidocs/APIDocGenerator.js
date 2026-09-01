"use strict";
/**
 * API Documentation Generator
 * OpenAPI/Swagger generation, automatic documentation, interactive explorer
 * Markdown export, versioning, custom templates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIDocGenerator = void 0;
const events_1 = require("events");
// ============================================================================
// API Documentation Generator
// ============================================================================
class APIDocGenerator extends events_1.EventEmitter {
    config;
    documentations = new Map();
    templates = new Map();
    constructor(config = {}) {
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
    createDocumentation(name, version, options = {}) {
        const doc = {
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
    addPath(docId, path, pathItem) {
        const doc = this.documentations.get(docId);
        if (!doc) {
            throw new Error(`Documentation not found: ${docId}`);
        }
        const fullPath = {
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
    addOperation(docId, path, method, operation) {
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
    addSchema(docId, name, schema) {
        const doc = this.documentations.get(docId);
        if (!doc) {
            throw new Error(`Documentation not found: ${docId}`);
        }
        doc.components.schemas.set(name, schema);
        doc.metadata.updatedAt = Date.now();
        this.emit('schema:added', { doc, name, schema });
    }
    addSecurityScheme(docId, name, scheme) {
        const doc = this.documentations.get(docId);
        if (!doc) {
            throw new Error(`Documentation not found: ${docId}`);
        }
        doc.components.securitySchemes.set(name, scheme);
        doc.metadata.updatedAt = Date.now();
        this.emit('security_scheme:added', { doc, name, scheme });
    }
    addExample(docId, name, example) {
        const doc = this.documentations.get(docId);
        if (!doc) {
            throw new Error(`Documentation not found: ${docId}`);
        }
        doc.components.examples.set(name, example);
        doc.metadata.updatedAt = Date.now();
        this.emit('example:added', { doc, name, example });
    }
    // ========================================================================
    // Auto-Generation from Code
    // ========================================================================
    generateFromRoutes(docId, routes) {
        const doc = this.documentations.get(docId);
        if (!doc) {
            throw new Error(`Documentation not found: ${docId}`);
        }
        for (const route of routes) {
            const operation = {
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
    generateFromTypeScript(docId, interfaceCode) {
        // Simplified TypeScript parsing - use typescript compiler API in production
        const schema = {
            type: 'object',
            properties: new Map(),
        };
        // Parse interface and extract properties
        const propertyRegex = /(\w+)(\?)?:\s*(\w+)/g;
        let match;
        while ((match = propertyRegex.exec(interfaceCode)) !== null) {
            const [, name, optional, type] = match;
            schema.properties.set(name, {
                type: this.mapTypeScriptType(type),
            });
            if (!optional && !schema.required) {
                schema.required = [];
            }
            if (!optional) {
                schema.required.push(name);
            }
        }
        return schema;
    }
    mapTypeScriptType(tsType) {
        const typeMap = {
            string: 'string',
            number: 'number',
            boolean: 'boolean',
            any: 'object',
            object: 'object',
            array: 'array',
        };
        return typeMap[tsType.toLowerCase()] || 'string';
    }
    generateResponses(responses) {
        const responseMap = new Map();
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
    generateOpenAPI(docId, options = { format: 'openapi' }) {
        const doc = this.documentations.get(docId);
        if (!doc) {
            throw new Error(`Documentation not found: ${docId}`);
        }
        const openapi = {
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
    generateSwagger(docId) {
        const doc = this.documentations.get(docId);
        if (!doc) {
            throw new Error(`Documentation not found: ${docId}`);
        }
        // Convert OpenAPI 3.0 to Swagger 2.0 format
        const swagger = {
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
    generateMarkdown(docId) {
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
    serializePaths(paths, options) {
        const result = {};
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
    serializeOperation(operation, options) {
        return {
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags,
            parameters: operation.parameters?.map(p => this.serializeParameter(p)),
            requestBody: operation.requestBody ? this.serializeRequestBody(operation.requestBody) : undefined,
            responses: Object.fromEntries(Array.from(operation.responses.entries()).map(([code, resp]) => [
                code,
                this.serializeResponse(resp),
            ])),
            security: operation.security,
            deprecated: operation.deprecated,
        };
    }
    serializeParameter(param) {
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
    serializeRequestBody(requestBody) {
        return {
            description: requestBody.description,
            required: requestBody.required,
            content: Object.fromEntries(Array.from(requestBody.content.entries()).map(([type, media]) => [
                type,
                this.serializeMediaType(media),
            ])),
        };
    }
    serializeMediaType(media) {
        return {
            schema: media.schema ? this.serializeSchema(media.schema) : undefined,
            example: media.example,
        };
    }
    serializeResponse(response) {
        return {
            description: response.description,
            content: response.content
                ? Object.fromEntries(Array.from(response.content.entries()).map(([type, media]) => [
                    type,
                    this.serializeMediaType(media),
                ]))
                : undefined,
        };
    }
    serializeSchema(schema) {
        const result = {
            type: schema.type,
            format: schema.format,
            description: schema.description,
            default: schema.default,
            enum: schema.enum,
            example: schema.example,
        };
        if (schema.properties) {
            result.properties = Object.fromEntries(Array.from(schema.properties.entries()).map(([name, prop]) => [
                name,
                this.serializeSchema(prop),
            ]));
        }
        if (schema.items) {
            result.items = this.serializeSchema(schema.items);
        }
        if (schema.required) {
            result.required = schema.required;
        }
        return result;
    }
    serializeComponents(components, options) {
        return {
            schemas: components.schemas
                ? Object.fromEntries(Array.from(components.schemas.entries()).map(([name, schema]) => [
                    name,
                    this.serializeSchema(schema),
                ]))
                : undefined,
            securitySchemes: components.securitySchemes
                ? Object.fromEntries(components.securitySchemes.entries())
                : undefined,
        };
    }
    serializePathsSwagger(paths) {
        // Simplified Swagger 2.0 serialization
        return Object.fromEntries(paths.entries());
    }
    serializeSchemasSwagger(schemas) {
        if (!schemas)
            return undefined;
        return Object.fromEntries(Array.from(schemas.entries()).map(([name, schema]) => [
            name,
            this.serializeSchema(schema),
        ]));
    }
    serializeSecuritySwagger(schemes) {
        if (!schemes)
            return undefined;
        return Object.fromEntries(schemes.entries());
    }
    // ========================================================================
    // Templates
    // ========================================================================
    initializeDefaultTemplates() {
        // Initialize default templates for different formats
    }
    addTemplate(template) {
        this.templates.set(template.id, template);
        this.emit('template:added', { template });
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    generateId() {
        return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getDocumentation(docId) {
        return this.documentations.get(docId);
    }
    getStats() {
        return {
            documentations: this.documentations.size,
            templates: this.templates.size,
        };
    }
}
exports.APIDocGenerator = APIDocGenerator;
// ============================================================================
// Export
// ============================================================================
exports.default = APIDocGenerator;
