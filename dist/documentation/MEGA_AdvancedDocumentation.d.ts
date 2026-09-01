/**
 * MEGA PHASE 15: ADVANCED DOCUMENTATION & API REFERENCE SYSTEM
 * Interactive docs, API playground, Code examples, Architecture diagrams
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface DocumentationConfig {
    format: DocFormat;
    outputDir: string;
    theme: DocTheme;
    includeExamples: boolean;
    includePlayground: boolean;
    includeDiagrams: boolean;
    generatePDF: boolean;
    languages: string[];
}
export type DocFormat = 'markdown' | 'html' | 'json' | 'openapi' | 'asyncapi';
export interface DocTheme {
    name: string;
    colors: ThemeColors;
    fonts: ThemeFonts;
    layout: LayoutConfig;
}
export interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    code: string;
    link: string;
}
export interface ThemeFonts {
    body: string;
    heading: string;
    code: string;
}
export interface LayoutConfig {
    sidebar: boolean;
    toc: boolean;
    breadcrumbs: boolean;
    search: boolean;
}
export interface Documentation {
    id: string;
    title: string;
    description: string;
    version: string;
    sections: DocSection[];
    navigation: NavStructure;
    metadata: DocMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface DocSection {
    id: string;
    title: string;
    slug: string;
    content: string;
    type: SectionType;
    order: number;
    parent?: string;
    children: string[];
    examples: CodeExample[];
    diagrams: Diagram[];
    related: string[];
}
export type SectionType = 'guide' | 'tutorial' | 'reference' | 'api' | 'concept' | 'example' | 'changelog';
export interface NavStructure {
    items: NavItem[];
    groups: NavGroup[];
}
export interface NavItem {
    id: string;
    title: string;
    path: string;
    icon?: string;
    badge?: string;
}
export interface NavGroup {
    id: string;
    title: string;
    items: NavItem[];
    collapsed: boolean;
}
export interface DocMetadata {
    author: string;
    contributors: string[];
    license: string;
    repository: string;
    homepage: string;
    keywords: string[];
}
export interface CodeExample {
    id: string;
    title: string;
    description: string;
    language: string;
    code: string;
    output?: string;
    runnable: boolean;
    highlightLines?: number[];
}
export interface Diagram {
    id: string;
    type: DiagramType;
    title: string;
    source: string;
    svg?: string;
    interactive: boolean;
}
export type DiagramType = 'flowchart' | 'sequence' | 'class' | 'er' | 'state' | 'gantt' | 'mindmap' | 'architecture';
export declare class DocumentationGenerator extends EventEmitter {
    private config;
    private docs;
    private templates;
    constructor(config?: Partial<DocumentationConfig>);
    private loadTemplates;
    createDocumentation(spec: DocumentationSpec): Documentation;
    addSection(docId: string, section: Omit<DocSection, 'id' | 'children'>): DocSection;
    private updateNavigation;
    addExample(docId: string, sectionId: string, example: Omit<CodeExample, 'id'>): CodeExample;
    addDiagram(docId: string, sectionId: string, diagram: Omit<Diagram, 'id'>): Diagram;
    private renderDiagram;
    generate(docId: string): Promise<GeneratedDocs>;
    private generateMarkdown;
    private renderMarkdownIndex;
    private renderMarkdownSection;
    private generateHTML;
    private renderHTMLIndex;
    private renderSidebar;
    private renderNavigation;
    private renderHTMLSection;
    private renderExamples;
    private renderDiagrams;
    private generateJSON;
    private generateIndex;
    private markdownToHTML;
    private escapeHTML;
    private capitalizeFirst;
    private generateId;
    getStats(): {
        documentations: number;
        totalSections: number;
        totalExamples: number;
    };
}
export interface DocumentationSpec {
    title: string;
    description: string;
    version: string;
    metadata: DocMetadata;
}
export interface DocTemplate {
    id: string;
    name: string;
    structure: string[];
}
export interface GeneratedDocs {
    format: DocFormat;
    files: DocFile[];
    index: string;
    assets: Asset[];
}
export interface DocFile {
    path: string;
    content: string;
}
export interface Asset {
    path: string;
    type: AssetType;
    data: Buffer;
}
export type AssetType = 'image' | 'video' | 'font' | 'stylesheet' | 'script';
export interface PlaygroundConfig {
    baseURL: string;
    defaultHeaders: Record<string, string>;
    enableMocking: boolean;
    saveHistory: boolean;
}
export interface APIEndpoint {
    id: string;
    method: HTTPMethod;
    path: string;
    description: string;
    parameters: APIParameter[];
    requestBody?: RequestBodySpec;
    responses: ResponseSpec[];
    examples: APIExample[];
}
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export interface APIParameter {
    name: string;
    in: ParameterLocation;
    description: string;
    required: boolean;
    schema: SchemaType;
    example?: any;
}
export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';
export interface SchemaType {
    type: string;
    format?: string;
    enum?: any[];
    default?: any;
}
export interface RequestBodySpec {
    description: string;
    required: boolean;
    content: Record<string, MediaType>;
}
export interface MediaType {
    schema: SchemaType;
    example?: any;
}
export interface ResponseSpec {
    statusCode: number;
    description: string;
    content?: Record<string, MediaType>;
}
export interface APIExample {
    name: string;
    description: string;
    request: ExampleRequest;
    response: ExampleResponse;
}
export interface ExampleRequest {
    method: HTTPMethod;
    url: string;
    headers?: Record<string, string>;
    body?: any;
}
export interface ExampleResponse {
    status: number;
    headers?: Record<string, string>;
    body?: any;
}
export declare class APIPlayground extends EventEmitter {
    private config;
    private endpoints;
    private history;
    constructor(config?: Partial<PlaygroundConfig>);
    registerEndpoint(endpoint: Omit<APIEndpoint, 'id'>): APIEndpoint;
    executeRequest(endpointId: string, params?: Record<string, any>, body?: any): Promise<PlaygroundResponse>;
    private buildURL;
    private simulateRequest;
    private sleep;
    getHistory(limit?: number): PlaygroundRequest[];
    private generateId;
    getStats(): {
        endpoints: number;
        historySize: number;
    };
}
export interface PlaygroundRequest {
    id: string;
    endpointId: string;
    method: HTTPMethod;
    url: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: Date;
}
export interface PlaygroundResponse {
    requestId: string;
    status: number;
    headers: Record<string, string>;
    body?: any;
    duration: number;
    timestamp: Date;
}
export declare class AdvancedDocumentationSystem {
    generator: DocumentationGenerator;
    playground: APIPlayground;
    constructor();
    getOverallStats(): {
        documentation: {
            documentations: number;
            totalSections: number;
            totalExamples: number;
        };
        playground: {
            endpoints: number;
            historySize: number;
        };
    };
}
//# sourceMappingURL=MEGA_AdvancedDocumentation.d.ts.map