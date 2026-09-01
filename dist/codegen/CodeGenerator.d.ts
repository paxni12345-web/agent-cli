/**
 * Advanced Code Generation & Template Engine
 * Dynamic code generation, template processing, AST manipulation
 * Multi-language support, code formatting, validation
 */
import { EventEmitter } from 'events';
export interface CodeGeneratorConfig {
    defaultLanguage: ProgrammingLanguage;
    formatting: FormattingConfig;
    validation: boolean;
    autoImport: boolean;
    templateCache: boolean;
    outputDirectory: string;
}
export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'csharp' | 'go' | 'rust' | 'ruby' | 'php' | 'kotlin' | 'swift';
export interface FormattingConfig {
    indentSize: number;
    indentStyle: 'space' | 'tab';
    lineWidth: number;
    quotes: 'single' | 'double';
    semicolons: boolean;
    trailingComma: boolean;
    bracketSpacing: boolean;
}
export interface Template {
    id: string;
    name: string;
    language: ProgrammingLanguage;
    content: string;
    variables: TemplateVariable[];
    metadata: TemplateMetadata;
    compiled?: CompiledTemplate;
}
export interface TemplateVariable {
    name: string;
    type: VariableType;
    required: boolean;
    default?: any;
    description?: string;
    validation?: ValidationRule;
}
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'identifier' | 'type' | 'expression';
export interface ValidationRule {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    enum?: any[];
    custom?: (value: any) => boolean;
}
export interface TemplateMetadata {
    author: string;
    version: string;
    description: string;
    tags: string[];
    dependencies: string[];
    createdAt: number;
    updatedAt: number;
}
export interface CompiledTemplate {
    id: string;
    templateId: string;
    fn: (context: Record<string, any>) => string;
    ast?: any;
    compiledAt: number;
}
export interface CodeGenerationRequest {
    template: string | Template;
    context: Record<string, any>;
    language?: ProgrammingLanguage;
    formatting?: Partial<FormattingConfig>;
    validate?: boolean;
    format?: boolean;
}
export interface GeneratedCode {
    id: string;
    code: string;
    language: ProgrammingLanguage;
    formatted: boolean;
    validated: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    metadata: GenerationMetadata;
    ast?: any;
}
export interface ValidationError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
    rule?: string;
}
export interface ValidationWarning {
    line: number;
    column: number;
    message: string;
    suggestion?: string;
}
export interface GenerationMetadata {
    templateId?: string;
    generatedAt: number;
    variables: Record<string, any>;
    duration: number;
}
export interface CodeSnippet {
    id: string;
    name: string;
    language: ProgrammingLanguage;
    code: string;
    description: string;
    tags: string[];
    category: string;
    imports: string[];
}
export interface ClassDefinition {
    name: string;
    extends?: string;
    implements?: string[];
    properties: PropertyDefinition[];
    methods: MethodDefinition[];
    constructorParams?: ParameterDefinition[];
    decorators?: DecoratorDefinition[];
    isAbstract?: boolean;
    isExported?: boolean;
    documentation?: string;
}
export interface PropertyDefinition {
    name: string;
    type: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isReadonly?: boolean;
    defaultValue?: any;
    decorators?: DecoratorDefinition[];
    documentation?: string;
}
export interface MethodDefinition {
    name: string;
    returnType: string;
    parameters: ParameterDefinition[];
    visibility: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isAsync?: boolean;
    isAbstract?: boolean;
    body?: string;
    decorators?: DecoratorDefinition[];
    documentation?: string;
}
export interface ParameterDefinition {
    name: string;
    type: string;
    optional?: boolean;
    defaultValue?: any;
    isRest?: boolean;
}
export interface DecoratorDefinition {
    name: string;
    arguments?: any[];
}
export interface InterfaceDefinition {
    name: string;
    extends?: string[];
    properties: InterfaceProperty[];
    methods: InterfaceMethod[];
    isExported?: boolean;
    documentation?: string;
}
export interface InterfaceProperty {
    name: string;
    type: string;
    optional?: boolean;
    readonly?: boolean;
    documentation?: string;
}
export interface InterfaceMethod {
    name: string;
    returnType: string;
    parameters: ParameterDefinition[];
    optional?: boolean;
    documentation?: string;
}
export interface FunctionDefinition {
    name: string;
    returnType: string;
    parameters: ParameterDefinition[];
    isAsync?: boolean;
    isExported?: boolean;
    isGenerator?: boolean;
    body: string;
    documentation?: string;
}
export interface ImportStatement {
    module: string;
    imports: ImportSpecifier[];
    isTypeOnly?: boolean;
    isDefault?: boolean;
}
export interface ImportSpecifier {
    name: string;
    alias?: string;
}
export interface AST {
    type: string;
    body: ASTNode[];
    sourceType: 'module' | 'script';
}
export interface ASTNode {
    type: string;
    [key: string]: any;
}
export declare class CodeGenerator extends EventEmitter {
    private config;
    private templates;
    private compiledTemplates;
    private snippets;
    private generatedCode;
    constructor(config?: Partial<CodeGeneratorConfig>);
    registerTemplate(template: Omit<Template, 'id'>): Template;
    private compileTemplate;
    private createTemplateFunction;
    private validateVariable;
    private formatValue;
    private processConditionals;
    private processLoops;
    generate(request: CodeGenerationRequest): Promise<GeneratedCode>;
    generateClass(definition: ClassDefinition, language?: ProgrammingLanguage): string;
    private generateTypeScriptClass;
    private generateJavaScriptClass;
    private generatePythonClass;
    private generateJavaClass;
    generateInterface(definition: InterfaceDefinition, language?: ProgrammingLanguage): string;
    generateFunction(definition: FunctionDefinition, language?: ProgrammingLanguage): string;
    generateImports(imports: ImportStatement[], language?: ProgrammingLanguage): string;
    private format;
    private validate;
    private toIdentifier;
    private toTypeName;
    private toCamelCase;
    private toPascalCase;
    private toSnakeCase;
    private generateId;
    registerSnippet(snippet: Omit<CodeSnippet, 'id'>): CodeSnippet;
    getSnippet(id: string): CodeSnippet | undefined;
    searchSnippets(query: SnippetQuery): CodeSnippet[];
    getGeneratedCode(id: string): GeneratedCode | undefined;
    listTemplates(): Template[];
}
interface SnippetQuery {
    language?: ProgrammingLanguage;
    category?: string;
    tags?: string[];
    search?: string;
}
export default CodeGenerator;
//# sourceMappingURL=CodeGenerator.d.ts.map