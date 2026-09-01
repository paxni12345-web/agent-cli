import { Tool, ToolContext, ToolResult } from '../types/index.js';
export declare class SearchCodeTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            pattern: {
                type: string;
                description: string;
            };
            filePattern: {
                type: string;
                description: string;
            };
            directory: {
                type: string;
                description: string;
            };
            regex: {
                type: string;
                description: string;
            };
            caseSensitive: {
                type: string;
                description: string;
            };
            maxResults: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
    private searchDirectory;
    private searchFile;
    private formatResults;
}
//# sourceMappingURL=SearchTool.d.ts.map