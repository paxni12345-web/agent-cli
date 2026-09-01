import { Tool, ToolContext, ToolResult } from '../types/index.js';
export declare class ShellTool implements Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            command: {
                type: string;
                description: string;
            };
            timeout: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(input: any, context: ToolContext): Promise<ToolResult>;
    /**
     * Parse command string into program and arguments
     * This prevents shell injection by avoiding shell interpretation
     */
    private parseCommand;
    /**
     * Execute command using spawn instead of exec for security
     */
    private executeWithSpawn;
    private assessCommandRisk;
    private formatOutput;
    private truncateOutput;
}
//# sourceMappingURL=ShellTool.d.ts.map