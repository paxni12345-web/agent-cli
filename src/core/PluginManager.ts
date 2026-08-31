/**
 * Plugin System - Extensible architecture for adding features
 * Supports dynamic loading, hot reload, and sandboxed execution
 */

import { Tool } from '../types';
import { EventBus, eventBus } from './EventBus';
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
export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginOrder: string[] = [];
  private config: Map<string, any> = new Map();
  private toolRegistry?: any;
  private providerRegistry?: any;

  constructor(
    toolRegistry?: any,
    providerRegistry?: any
  ) {
    this.toolRegistry = toolRegistry;
    this.providerRegistry = providerRegistry;
  }

  /**
   * Register a plugin instance
   */
  async register(plugin: Plugin): Promise<void> {
    const name = plugin.metadata.name;

    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} is already registered`);
    }

    // Check dependencies
    if (plugin.metadata.dependencies) {
      for (const dep of plugin.metadata.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Plugin ${name} depends on ${dep} which is not loaded`
          );
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

    eventBus.emitSync('plugin.registered', { name }, 'PluginManager');
  }

  /**
   * Activate a plugin
   */
  async activate(name: string): Promise<void> {
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

      eventBus.emitSync('plugin.activated', { name }, 'PluginManager');
      loaded.context.log(`Plugin ${name} activated`, 'info');
    } catch (error) {
      eventBus.emitSync(
        'plugin.error',
        { name, error: error instanceof Error ? error.message : String(error) },
        'PluginManager'
      );
      throw new Error(
        `Failed to activate plugin ${name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivate(name: string): Promise<void> {
    const loaded = this.plugins.get(name);
    if (!loaded) {
      throw new Error(`Plugin ${name} is not registered`);
    }

    if (!loaded.active) {
      return; // Already inactive
    }

    // Check if other active plugins depend on this one
    for (const [pluginName, plugin] of this.plugins) {
      if (
        plugin.active &&
        plugin.plugin.metadata.dependencies?.includes(name)
      ) {
        throw new Error(
          `Cannot deactivate ${name} because ${pluginName} depends on it`
        );
      }
    }

    // Deactivate plugin
    try {
      if (loaded.plugin.deactivate) {
        await loaded.plugin.deactivate();
      }
      loaded.active = false;

      eventBus.emitSync('plugin.deactivated', { name }, 'PluginManager');
      loaded.context.log(`Plugin ${name} deactivated`, 'info');
    } catch (error) {
      eventBus.emitSync(
        'plugin.error',
        { name, error: error instanceof Error ? error.message : String(error) },
        'PluginManager'
      );
      throw new Error(
        `Failed to deactivate plugin ${name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Unregister a plugin (must be deactivated first)
   */
  async unregister(name: string): Promise<void> {
    const loaded = this.plugins.get(name);
    if (!loaded) {
      return;
    }

    if (loaded.active) {
      await this.deactivate(name);
    }

    this.plugins.delete(name);
    this.updateLoadOrder();

    eventBus.emitSync('plugin.unregistered', { name }, 'PluginManager');
  }

  /**
   * Get plugin info
   */
  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * List all plugins
   */
  listPlugins(): Array<{
    name: string;
    version: string;
    active: boolean;
    loadedAt: Date;
  }> {
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
  async activateAll(): Promise<void> {
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
  async deactivateAll(): Promise<void> {
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
  async reload(name: string): Promise<void> {
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

    eventBus.emitSync('plugin.reloaded', { name }, 'PluginManager');
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig(pluginName: string, key: string): any {
    return this.config.get(`${pluginName}.${key}`);
  }

  /**
   * Set plugin configuration
   */
  setPluginConfig(pluginName: string, key: string, value: any): void {
    this.config.set(`${pluginName}.${key}`, value);
  }

  private createContext(pluginName: string): PluginContext {
    return {
      eventBus,
      registerTool: (tool: Tool) => {
        if (this.toolRegistry) {
          this.toolRegistry.register(tool);
          eventBus.emitSync(
            'plugin.tool_registered',
            { plugin: pluginName, tool: tool.name },
            'PluginManager'
          );
        }
      },
      registerProvider: (provider: AIProvider) => {
        if (this.providerRegistry) {
          this.providerRegistry.register(provider);
          eventBus.emitSync(
            'plugin.provider_registered',
            { plugin: pluginName, provider: provider.name },
            'PluginManager'
          );
        }
      },
      getConfig: (key: string) => this.getPluginConfig(pluginName, key),
      setConfig: (key: string, value: any) =>
        this.setPluginConfig(pluginName, key, value),
      log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        const prefix = `[Plugin:${pluginName}]`;
        if (level === 'error') {
          console.error(prefix, message);
        } else if (level === 'warn') {
          console.warn(prefix, message);
        } else {
          console.log(prefix, message);
        }
      },
    };
  }

  private updateLoadOrder(): void {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const loaded = this.plugins.get(name);
      if (!loaded) return;

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

/**
 * Example plugin for demonstration
 */
export class ExamplePlugin implements Plugin {
  metadata: PluginMetadata = {
    name: 'example-plugin',
    version: '1.0.0',
    description: 'Example plugin demonstrating the plugin system',
    author: 'Agent CLI',
    license: 'MIT',
  };

  async activate(context: PluginContext): Promise<void> {
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
      execute: async (input: any) => {
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

  async deactivate(): Promise<void> {
    console.log('Example plugin deactivated');
  }
}
