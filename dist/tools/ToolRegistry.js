"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const index_js_1 = require("../types/index.js");
/**
 * Central registry for managing agent tools
 */
class ToolRegistry {
    tools = new Map();
    /**
     * Registers a new tool in the registry
     *
     * @param tool - The tool to register
     * @throws {ToolError} If a tool with the same name is already registered
     */
    register(tool) {
        if (this.tools.has(tool.name)) {
            throw new index_js_1.ToolError(`Tool '${tool.name}' is already registered`);
        }
        this.tools.set(tool.name, tool);
    }
    /**
     * Retrieves a tool by name
     *
     * @param name - The name of the tool to retrieve
     * @returns The tool if found, undefined otherwise
     */
    get(name) {
        return this.tools.get(name);
    }
    /**
     * Returns all registered tools
     *
     * @returns Array of all registered tools
     */
    list() {
        return Array.from(this.tools.values());
    }
    /**
     * Checks if a tool with the given name is registered
     *
     * @param name - The name of the tool to check
     * @returns True if the tool exists, false otherwise
     */
    has(name) {
        return this.tools.has(name);
    }
    /**
     * Unregisters a tool by name
     *
     * @param name - The name of the tool to remove
     * @returns True if the tool was removed, false if it didn't exist
     */
    unregister(name) {
        return this.tools.delete(name);
    }
    /**
     * Gets tool schemas in a format suitable for AI provider tool definitions
     *
     * @returns Array of tool schemas with name, description, and input schema
     */
    getSchemas() {
        return this.list().map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema,
        }));
    }
}
exports.ToolRegistry = ToolRegistry;
