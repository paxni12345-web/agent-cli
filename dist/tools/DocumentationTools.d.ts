/**
 * Documentation Generator - Auto-generate docs from code
 * Support for JSDoc, TSDoc, Sphinx, GoDoc, RustDoc
 */
import { Tool } from '../types';
/**
 * Documentation Generator Tool
 */
export declare const DocGeneratorTool: Tool;
/**
 * README Generator Tool
 */
export declare const ReadmeGeneratorTool: Tool;
/**
 * Changelog Generator Tool
 */
export declare const ChangelogGeneratorTool: Tool;
/**
 * API Documentation Tool
 */
export declare const APIDocTool: Tool;
/**
 * Code Examples Extractor
 */
export declare const ExamplesExtractorTool: Tool;
/**
 * Documentation Site Builder
 */
export declare class DocSiteBuilder {
    /**
     * Build a complete documentation site
     */
    static build(config: {
        source: string;
        output: string;
        theme?: string;
        nav?: Array<{
            title: string;
            path: string;
        }>;
    }): Promise<void>;
    /**
     * Serve documentation locally
     */
    static serve(config: {
        path: string;
        port?: number;
    }): Promise<void>;
}
/**
 * Documentation Linter
 */
export declare class DocLinter {
    /**
     * Lint documentation for common issues
     */
    static lint(content: string): Array<{
        line: number;
        message: string;
        severity: 'error' | 'warning';
    }>;
}
//# sourceMappingURL=DocumentationTools.d.ts.map