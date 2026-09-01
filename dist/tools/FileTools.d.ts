import { Tool, ToolContext, ToolResult } from '../types/index.js';
export declare class ListFilesTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
            recursive: {
                type: string;
                description: string;
            };
            maxDepth: {
                type: string;
                description: string;
            };
            excludePatterns: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
    private listDirectory;
    private resolvePath;
    private validatePath;
}
export declare class ReadFileTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
            startLine: {
                type: string;
                description: string;
            };
            endLine: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
    private validatePath;
    private isBinaryFile;
}
export declare class WriteFileTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
    private validatePath;
}
export declare class EditFileTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
            oldText: {
                type: string;
                description: string;
            };
            newText: {
                type: string;
                description: string;
            };
            replaceAll: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
    private validatePath;
}
//# sourceMappingURL=FileTools.d.ts.map