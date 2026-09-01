/**
 * Plugin System - Extensible architecture for adding features
 * Supports dynamic loading, hot reload, and sandboxed execution
 */
import { Tool } from '../types';
import { EventBus } from './EventBus';
import { AIProvider } from '../providers/AIProvider';
export interface PluginMetadata {
    name: string;
    version: string;
    description: string;
    author?: string;
    homepage?: string;
    license?: string;
    dependencies?: string[];
    keywords?: string[];
}
export interface PluginContext {
    eventBus: EventBus;
    registerTool: (tool: Tool) => void;
    registerProvider: (provider: AIProvider) => void;
    getConfig: (key: string) => any;
    setConfig: (key: string, value: any) => void;
    log: (message: string, level?: 'info' | 'warn' | 'error') => void;
}
export interface Plugin {
    metadata: PluginMetadata;
    activate: (context: PluginContext) => Promise<void> | void;
    deactivate?: () => Promise<void> | void;
}
export interface PluginManifest {
    name: string;
    version: string;
    main: string;
    dependencies?: Record<string, string>;
}
export interface LoadedPlugin {
    plugin: Plugin;
    context: PluginContext;
    active: boolean;
    loadedAt: Date;
}
/**
 * Plugin loader with dependency resolution and lifecycle management
 */
export declare class PluginManager {
    private plugins;
    private pluginOrder;
    private config;
    private toolRegistry?;
    private providerRegistry?;
    constructor(toolRegistry?: any, providerRegistry?: any);
    /**
     * Register a plugin instance
     */
    register(plugin: Plugin): Promise<void>;
    /**
     * Activate a plugin
     */
    activate(name: string): Promise<void>;
    /**
     * Deactivate a plugin
     */
    deactivate(name: string): Promise<void>;
    /**
     * Unregister a plugin (must be deactivated first)
     */
    unregister(name: string): Promise<void>;
    /**
     * Get plugin info
     */
    getPlugin(name: string): LoadedPlugin | undefined;
    /**
     * List all plugins
     */
    listPlugins(): Array<{
        name: string;
        version: string;
        active: boolean;
        loadedAt: Date;
    }>;
    /**
     * Activate all plugins in dependency order
     */
    activateAll(): Promise<void>;
    /**
     * Deactivate all plugins in reverse dependency order
     */
    deactivateAll(): Promise<void>;
    /**
     * Hot reload a plugin
     */
    reload(name: string): Promise<void>;
    /**
     * Get plugin configuration
     */
    getPluginConfig(pluginName: string, key: string): any;
    /**
     * Set plugin configuration
     */
    setPluginConfig(pluginName: string, key: string, value: any): void;
    private createContext;
    private updateLoadOrder;
}
/**
 * Example plugin for demonstration
 */
export declare class ExamplePlugin implements Plugin {
    metadata: PluginMetadata;
    activate(context: PluginContext): Promise<void>;
    deactivate(): Promise<void>;
}
//# sourceMappingURL=PluginManager.d.ts.map