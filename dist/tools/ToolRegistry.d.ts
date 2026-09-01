/**
 * Tool Registry - manages all available tools
 *
 * A centralized registry for managing tools that the agent can execute.
 * Provides registration, lookup, and schema generation capabilities.
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 * registry.register(new ReadFileTool());
 * registry.register(new WriteFileTool());
 *
 * const tool = registry.get('read_file');
 * const schemas = registry.getSchemas();
 * ```
 */
import { Tool } from '../types/index.js';
/**
 * Central registry for managing agent tools
 */
export declare class ToolRegistry {
    private tools;
    /**
     * Registers a new tool in the registry
     *
     * @param tool - The tool to register
     * @throws {ToolError} If a tool with the same name is already registered
     */
    register(tool: Tool): void;
    /**
     * Retrieves a tool by name
     *
     * @param name - The name of the tool to retrieve
     * @returns The tool if found, undefined otherwise
     */
    get(name: string): Tool | undefined;
    /**
     * Returns all registered tools
     *
     * @returns Array of all registered tools
     */
    list(): Tool[];
    /**
     * Checks if a tool with the given name is registered
     *
     * @param name - The name of the tool to check
     * @returns True if the tool exists, false otherwise
     */
    has(name: string): boolean;
    /**
     * Unregisters a tool by name
     *
     * @param name - The name of the tool to remove
     * @returns True if the tool was removed, false if it didn't exist
     */
    unregister(name: string): boolean;
    /**
     * Gets tool schemas in a format suitable for AI provider tool definitions
     *
     * @returns Array of tool schemas with name, description, and input schema
     */
    getSchemas(): Array<{
        name: string;
        description: string;
        input_schema: any;
    }>;
}
//# sourceMappingURL=ToolRegistry.d.ts.map