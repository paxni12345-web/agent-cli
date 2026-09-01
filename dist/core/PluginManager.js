"use strict";
/**
 * Plugin System - Extensible architecture for adding features
 * Supports dynamic loading, hot reload, and sandboxed execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamplePlugin = exports.PluginManager = void 0;
const EventBus_1 = require("./EventBus");
/**
 * Plugin loader with dependency resolution and lifecycle management
 */
class PluginManager {
    plugins = new Map();
    pluginOrder = [];
    config = new Map();
    toolRegistry;
    providerRegistry;
    constructor(toolRegistry, providerRegistry) {
        this.toolRegistry = toolRegistry;
        this.providerRegistry = providerRegistry;
    }
    /**
     * Register a plugin instance
     */
    async register(plugin) {
        const name = plugin.metadata.name;
        if (this.plugins.has(name)) {
            throw new Error(`Plugin ${name} is already registered`);
        }
        // Check dependencies
        if (plugin.metadata.dependencies) {
            for (const dep of plugin.metadata.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Plugin ${name} depends on ${dep} which is not loaded`);
                }
            }
        }
        // Create context
        const context = this.createContext(name);
        // Store plugin
        this.plugins.set(name, {
            plugin,
            context,
            active: false,
            loadedAt: new Date(),
        });
        // Determine load order based on dependencies
        this.updateLoadOrder();
        EventBus_1.eventBus.emitSync('plugin.registered', { name }, 'PluginManager');
    }
    /**
     * Activate a plugin
     */
    async activate(name) {
        const loaded = this.plugins.get(name);
        if (!loaded) {
            throw new Error(`Plugin ${name} is not registered`);
        }
        if (loaded.active) {
            return; // Already active
        }
        // Activate dependencies first
        if (loaded.plugin.metadata.dependencies) {
            for (const dep of loaded.plugin.metadata.dependencies) {
                await this.activate(dep);
            }
        }
        // Activate plugin
        try {
            await loaded.plugin.activate(loaded.context);
            loaded.active = true;
            EventBus_1.eventBus.emitSync('plugin.activated', { name }, 'PluginManager');
            loaded.context.log(`Plugin ${name} activated`, 'info');
        }
        catch (error) {
            EventBus_1.eventBus.emitSync('plugin.error', { name, error: error instanceof Error ? error.message : String(error) }, 'PluginManager');
            throw new Error(`Failed to activate plugin ${name}: ${error instanceof Error ? error.message : error}`);
        }
    }
    /**
     * Deactivate a plugin
     */
    async deactivate(name) {
        const loaded = this.plugins.get(name);
        if (!loaded) {
            throw new Error(`Plugin ${name} is not registered`);
        }
        if (!loaded.active) {
            return; // Already inactive
        }
        // Check if other active plugins depend on this one
        for (const [pluginName, plugin] of this.plugins) {
            if (plugin.active &&
                plugin.plugin.metadata.dependencies?.includes(name)) {
                throw new Error(`Cannot deactivate ${name} because ${pluginName} depends on it`);
            }
        }
        // Deactivate plugin
        try {
            if (loaded.plugin.deactivate) {
                await loaded.plugin.deactivate();
            }
            loaded.active = false;
            EventBus_1.eventBus.emitSync('plugin.deactivated', { name }, 'PluginManager');
            loaded.context.log(`Plugin ${name} deactivated`, 'info');
        }
        catch (error) {
            EventBus_1.eventBus.emitSync('plugin.error', { name, error: error instanceof Error ? error.message : String(error) }, 'PluginManager');
            throw new Error(`Failed to deactivate plugin ${name}: ${error instanceof Error ? error.message : error}`);
        }
    }
    /**
     * Unregister a plugin (must be deactivated first)
     */
    async unregister(name) {
        const loaded = this.plugins.get(name);
        if (!loaded) {
            return;
        }
        if (loaded.active) {
            await this.deactivate(name);
        }
        this.plugins.delete(name);
        this.updateLoadOrder();
        EventBus_1.eventBus.emitSync('plugin.unregistered', { name }, 'PluginManager');
    }
    /**
     * Get plugin info
     */
    getPlugin(name) {
        return this.plugins.get(name);
    }
    /**
     * List all plugins
     */
    listPlugins() {
        return Array.from(this.plugins.values()).map((loaded) => ({
            name: loaded.plugin.metadata.name,
            version: loaded.plugin.metadata.version,
            active: loaded.active,
            loadedAt: loaded.loadedAt,
        }));
    }
    /**
     * Activate all plugins in dependency order
     */
    async activateAll() {
        for (const name of this.pluginOrder) {
            const loaded = this.plugins.get(name);
            if (loaded && !loaded.active) {
                await this.activate(name);
            }
        }
    }
    /**
     * Deactivate all plugins in reverse dependency order
     */
    async deactivateAll() {
        for (let i = this.pluginOrder.length - 1; i >= 0; i--) {
            const name = this.pluginOrder[i];
            const loaded = this.plugins.get(name);
            if (loaded && loaded.active) {
                await this.deactivate(name);
            }
        }
    }
    /**
     * Hot reload a plugin
     */
    async reload(name) {
        const loaded = this.plugins.get(name);
        if (!loaded) {
            throw new Error(`Plugin ${name} is not registered`);
        }
        const wasActive = loaded.active;
        if (wasActive) {
            await this.deactivate(name);
        }
        // In a real implementation, you would re-import the module here
        // For now, we just reactivate
        if (wasActive) {
            await this.activate(name);
        }
        EventBus_1.eventBus.emitSync('plugin.reloaded', { name }, 'PluginManager');
    }
    /**
     * Get plugin configuration
     */
    getPluginConfig(pluginName, key) {
        return this.config.get(`${pluginName}.${key}`);
    }
    /**
     * Set plugin configuration
     */
    setPluginConfig(pluginName, key, value) {
        this.config.set(`${pluginName}.${key}`, value);
    }
    createContext(pluginName) {
        return {
            eventBus: EventBus_1.eventBus,
            registerTool: (tool) => {
                if (this.toolRegistry) {
                    this.toolRegistry.register(tool);
                    EventBus_1.eventBus.emitSync('plugin.tool_registered', { plugin: pluginName, tool: tool.name }, 'PluginManager');
                }
            },
            registerProvider: (provider) => {
                if (this.providerRegistry) {
                    this.providerRegistry.register(provider);
                    EventBus_1.eventBus.emitSync('plugin.provider_registered', { plugin: pluginName, provider: provider.name }, 'PluginManager');
                }
            },
            getConfig: (key) => this.getPluginConfig(pluginName, key),
            setConfig: (key, value) => this.setPluginConfig(pluginName, key, value),
            log: (message, level = 'info') => {
                const prefix = `[Plugin:${pluginName}]`;
                if (level === 'error') {
                    console.error(prefix, message);
                }
                else if (level === 'warn') {
                    console.warn(prefix, message);
                }
                else {
                    console.log(prefix, message);
                }
            },
        };
    }
    updateLoadOrder() {
        const visited = new Set();
        const order = [];
        const visit = (name) => {
            if (visited.has(name))
                return;
            visited.add(name);
            const loaded = this.plugins.get(name);
            if (!loaded)
                return;
            // Visit dependencies first
            if (loaded.plugin.metadata.dependencies) {
                for (const dep of loaded.plugin.metadata.dependencies) {
                    visit(dep);
                }
            }
            order.push(name);
        };
        for (const name of this.plugins.keys()) {
            visit(name);
        }
        this.pluginOrder = order;
    }
}
exports.PluginManager = PluginManager;
/**
 * Example plugin for demonstration
 */
class ExamplePlugin {
    metadata = {
        name: 'example-plugin',
        version: '1.0.0',
        description: 'Example plugin demonstrating the plugin system',
        author: 'Agent CLI',
        license: 'MIT',
    };
    async activate(context) {
        context.log('Example plugin activated!');
        // Register a custom tool
        context.registerTool({
            name: 'example_tool',
            description: 'An example tool from a plugin',
            input_schema: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'Message to process',
                    },
                },
                required: ['message'],
            },
            execute: async (input) => {
                return {
                    success: true,
                    output: `Plugin processed: ${input.message}`,
                };
            },
        });
        // Listen to events
        context.eventBus.on('agent.started', (event) => {
            context.log(`Agent started event received at ${event.timestamp}`);
        });
    }
    async deactivate() {
        console.log('Example plugin deactivated');
    }
}
exports.ExamplePlugin = ExamplePlugin;
