import { Tool, ToolContext, ToolResult } from '../types/index.js';
export declare class GitStatusTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {};
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
}
export declare class GitDiffTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            staged: {
                type: string;
                description: string;
            };
            file: {
                type: string;
                description: string;
            };
        };
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
}
export declare class GitLogTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            limit: {
                type: string;
                description: string;
            };
            file: {
                type: string;
                description: string;
            };
        };
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
}
//# sourceMappingURL=GitTools.d.ts.map