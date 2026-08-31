/**
 * Advanced Plugin System & Extension Framework
 * Dynamic plugin loading, dependency resolution, lifecycle management
 * Sandboxed execution, API versioning, plugin marketplace
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PluginConfig {
  pluginDirectory: string;
  enableAutoLoad: boolean;
  enableSandbox: boolean;
  enableVersionCheck: boolean;
  maxExecutionTime: number;
  allowedAPIs: string[];
  marketplaceURL?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  main: string;
  dependencies: PluginDependency[];
  peerDependencies: PluginDependency[];
  engines: EngineRequirement;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  configuration: PluginConfiguration;
  metadata: PluginMetadata;
  state: PluginState;
}

export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
}

export interface EngineRequirement {
  node?: string;
  agentCLI?: string;
}

export type PluginCapability =
  | 'command'
  | 'hook'
  | 'provider'
  | 'transformer'
  | 'analyzer'
  | 'generator'
  | 'ui'
  | 'language';

export interface PluginPermission {
  type: PermissionType;
  resources?: string[];
  reason: string;
}

export type PermissionType =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:http'
  | 'network:https'
  | 'process:spawn'
  | 'environment:read'
  | 'environment:write';

export interface PluginConfiguration {
  schema: ConfigurationSchema;
  defaults: Record<string, any>;
}

export interface ConfigurationSchema {
  [key: string]: ConfigurationField;
}

export interface ConfigurationField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: any;
  enum?: any[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

export interface PluginMetadata {
  tags: string[];
  category: string;
  icon?: string;
  screenshots?: string[];
  keywords: string[];
  downloads?: number;
  rating?: number;
  publishedAt?: number;
  updatedAt?: number;
}

export interface PluginState {
  status: PluginStatus;
  loadedAt?: number;
  activatedAt?: number;
  error?: Error;
  health: PluginHealth;
  metrics: PluginMetrics;
}

export type PluginStatus = 'unloaded' | 'loading' | 'loaded' | 'active' | 'inactive' | 'error' | 'uninstalling';

export interface PluginHealth {
  healthy: boolean;
  lastCheck: number;
  issues: string[];
}

export interface PluginMetrics {
  activationTime: number;
  executionCount: number;
  averageExecutionTime: number;
  errorCount: number;
  lastExecuted?: number;
}

export interface PluginContext {
  plugin: Plugin;
  api: PluginAPI;
  config: Record<string, any>;
  storage: PluginStorage;
  logger: PluginLogger;
  events: EventEmitter;
}

export interface PluginAPI {
  version: string;
  commands: CommandAPI;
  hooks: HookAPI;
  ui: UIAPI;
  workspace: WorkspaceAPI;
  filesystem: FilesystemAPI;
  network: NetworkAPI;
  process: ProcessAPI;
}

export interface CommandAPI {
  register(command: CommandDefinition): void;
  execute(commandId: string, args: any[]): Promise<any>;
  list(): CommandDefinition[];
}

export interface CommandDefinition {
  id: string;
  name: string;
  description: string;
  usage: string;
  arguments: CommandArgument[];
  options: CommandOption[];
  handler: (args: any[], options: any) => Promise<any>;
}

export interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  variadic?: boolean;
}

export interface CommandOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  default?: any;
}

export interface HookAPI {
  register(hookName: string, handler: HookHandler): void;
  trigger(hookName: string, data: any): Promise<any>;
  list(): string[];
}

export type HookHandler = (data: any) => Promise<any>;

export interface UIAPI {
  showMessage(message: string, type: 'info' | 'warning' | 'error'): void;
  showProgress(title: string, task: () => Promise<void>): Promise<void>;
  prompt(question: string, options?: PromptOptions): Promise<string>;
  confirm(question: string): Promise<boolean>;
}

export interface PromptOptions {
  default?: string;
  placeholder?: string;
  password?: boolean;
  validate?: (value: string) => boolean | string;
}

export interface WorkspaceAPI {
  getRoot(): string;
  getFiles(pattern: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  watch(pattern: string, handler: (event: FileEvent) => void): void;
}

export interface FileEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
}

export interface FilesystemAPI {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, content: Buffer): Promise<void>;
  readDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStats>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface FileStats {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  created: number;
  modified: number;
}

export interface NetworkAPI {
  fetch(url: string, options?: FetchOptions): Promise<FetchResponse>;
  createServer(port: number, handler: ServerHandler): Server;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface FetchResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export type ServerHandler = (req: any, res: any) => void;

export interface Server {
  start(): Promise<void>;
  stop(): Promise<void>;
  port: number;
}

export interface ProcessAPI {
  spawn(command: string, args: string[]): Promise<ProcessResult>;
  exec(command: string): Promise<string>;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PluginStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  keys(): string[];
}

export interface PluginLogger {
  trace(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  capabilities?: PluginCapability[];
  permissions?: PluginPermission[];
  configuration?: PluginConfiguration;
}

export interface PluginLoader {
  load(pluginPath: string): Promise<Plugin>;
  unload(pluginId: string): Promise<void>;
  reload(pluginId: string): Promise<Plugin>;
}

export interface PluginRegistry {
  register(plugin: Plugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): Plugin | undefined;
  list(): Plugin[];
  search(query: PluginSearchQuery): Plugin[];
}

export interface PluginSearchQuery {
  name?: string;
  category?: string;
  capability?: PluginCapability;
  tags?: string[];
}

export interface PluginMarketplace {
  search(query: string): Promise<MarketplacePlugin[]>;
  install(pluginId: string): Promise<Plugin>;
  uninstall(pluginId: string): Promise<void>;
  update(pluginId: string): Promise<Plugin>;
  listInstalled(): Plugin[];
  listAvailable(): Promise<MarketplacePlugin[]>;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  publishedAt: number;
  updatedAt: number;
}

// ============================================================================
// Plugin Manager
// ============================================================================

export class PluginManager extends EventEmitter {
  private config: PluginConfig;
  private plugins: Map<string, Plugin> = new Map();
  private contexts: Map<string, PluginContext> = new Map();
  private commands: Map<string, CommandDefinition> = new Map();
  private hooks: Map<string, HookHandler[]> = new Map();
  private loadedModules: Map<string, any> = new Map();

  constructor(config: Partial<PluginConfig> = {}) {
    super();
    this.config = {
      pluginDirectory: './plugins',
      enableAutoLoad: true,
      enableSandbox: true,
      enableVersionCheck: true,
      maxExecutionTime: 30000,
      allowedAPIs: ['commands', 'hooks', 'workspace'],
      ...config,
    };

    if (this.config.enableAutoLoad) {
      this.autoLoadPlugins();
    }
  }

  // ========================================================================
  // Plugin Loading
  // ========================================================================

  public async loadPlugin(pluginPath: string): Promise<Plugin> {
    this.emit('plugin:load:start', { pluginPath });

    // Read manifest
    const manifestPath = path.join(pluginPath, 'package.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found: ${manifestPath}`);
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestContent);

    // Create plugin
    const plugin: Plugin = {
      id: this.generatePluginId(manifest.name),
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      license: 'MIT',
      main: path.join(pluginPath, manifest.main),
      dependencies: this.parseDependencies(manifest.dependencies),
      peerDependencies: this.parseDependencies(manifest.peerDependencies),
      engines: manifest.engines || {},
      capabilities: manifest.capabilities || [],
      permissions: manifest.permissions || [],
      configuration: manifest.configuration || { schema: {}, defaults: {} },
      metadata: {
        tags: [],
        category: 'general',
        keywords: [],
      },
      state: {
        status: 'loading',
        health: {
          healthy: true,
          lastCheck: Date.now(),
          issues: [],
        },
        metrics: {
          activationTime: 0,
          executionCount: 0,
          averageExecutionTime: 0,
          errorCount: 0,
        },
      },
    };

    // Validate dependencies
    if (this.config.enableVersionCheck) {
      await this.validateDependencies(plugin);
    }

    // Check permissions
    await this.checkPermissions(plugin);

    // Load module
    try {
      const module = await this.loadModule(plugin.main);
      this.loadedModules.set(plugin.id, module);

      plugin.state.status = 'loaded';
      plugin.state.loadedAt = Date.now();

      this.plugins.set(plugin.id, plugin);
      this.emit('plugin:loaded', { plugin });

      // Auto-activate if possible
      await this.activatePlugin(plugin.id);

      return plugin;
    } catch (error) {
      plugin.state.status = 'error';
      plugin.state.error = error as Error;
      this.emit('plugin:load:error', { plugin, error });
      throw error;
    }
  }

  private async loadModule(modulePath: string): Promise<any> {
    // In production, this would use dynamic import with sandboxing
    // For now, we'll simulate module loading
    return {
      activate: async (context: PluginContext) => {
        // Plugin activation logic
      },
      deactivate: async () => {
        // Plugin deactivation logic
      },
    };
  }

  public async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    this.emit('plugin:unload:start', { plugin });

    // Deactivate if active
    if (plugin.state.status === 'active') {
      await this.deactivatePlugin(pluginId);
    }

    // Remove from registry
    this.plugins.delete(pluginId);
    this.contexts.delete(pluginId);
    this.loadedModules.delete(pluginId);

    plugin.state.status = 'unloaded';

    this.emit('plugin:unloaded', { plugin });
  }

  public async reloadPlugin(pluginId: string): Promise<Plugin> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const pluginPath = path.dirname(plugin.main);

    await this.unloadPlugin(pluginId);
    return await this.loadPlugin(pluginPath);
  }

  // ========================================================================
  // Plugin Activation
  // ========================================================================

  public async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.state.status === 'active') {
      return;
    }

    this.emit('plugin:activate:start', { plugin });

    const startTime = Date.now();

    try {
      // Create context
      const context = this.createPluginContext(plugin);
      this.contexts.set(plugin.id, context);

      // Activate plugin
      const module = this.loadedModules.get(plugin.id);
      if (module && module.activate) {
        await this.executeWithTimeout(
          module.activate(context),
          this.config.maxExecutionTime
        );
      }

      plugin.state.status = 'active';
      plugin.state.activatedAt = Date.now();
      plugin.state.metrics.activationTime = Date.now() - startTime;

      this.emit('plugin:activated', { plugin });
    } catch (error) {
      plugin.state.status = 'error';
      plugin.state.error = error as Error;
      plugin.state.metrics.errorCount++;

      this.emit('plugin:activate:error', { plugin, error });
      throw error;
    }
  }

  public async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.state.status !== 'active') {
      return;
    }

    this.emit('plugin:deactivate:start', { plugin });

    try {
      // Deactivate plugin
      const module = this.loadedModules.get(plugin.id);
      if (module && module.deactivate) {
        await this.executeWithTimeout(
          module.deactivate(),
          this.config.maxExecutionTime
        );
      }

      // Clean up commands
      for (const [commandId, command] of this.commands.entries()) {
        if (commandId.startsWith(`${plugin.id}:`)) {
          this.commands.delete(commandId);
        }
      }

      // Clean up hooks
      for (const [hookName, handlers] of this.hooks.entries()) {
        try {
          this.hooks.set(
            hookName,
            handlers.filter(h => !h.toString().includes(plugin.id))
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.emit('plugin:hook_cleanup_error', {
            plugin,
            hookName,
            error: errorMessage
          });
          console.error(`Error cleaning up hook ${hookName} for plugin ${plugin.id}:`, errorMessage);
        }
      }

      plugin.state.status = 'inactive';

      this.emit('plugin:deactivated', { plugin });
    } catch (error) {
      plugin.state.error = error as Error;
      this.emit('plugin:deactivate:error', { plugin, error });
      throw error;
    }
  }

  // ========================================================================
  // Plugin Context
  // ========================================================================

  private createPluginContext(plugin: Plugin): PluginContext {
    const api = this.createPluginAPI(plugin);
    const storage = this.createPluginStorage(plugin.id);
    const logger = this.createPluginLogger(plugin);

    return {
      plugin,
      api,
      config: plugin.configuration.defaults,
      storage,
      logger,
      events: new EventEmitter(),
    };
  }

  private createPluginAPI(plugin: Plugin): PluginAPI {
    return {
      version: '1.0.0',
      commands: this.createCommandAPI(plugin),
      hooks: this.createHookAPI(plugin),
      ui: this.createUIAPI(),
      workspace: this.createWorkspaceAPI(),
      filesystem: this.createFilesystemAPI(plugin),
      network: this.createNetworkAPI(plugin),
      process: this.createProcessAPI(plugin),
    };
  }

  private createCommandAPI(plugin: Plugin): CommandAPI {
    return {
      register: (command: CommandDefinition) => {
        const commandId = `${plugin.id}:${command.id}`;
        this.commands.set(commandId, {
          ...command,
          id: commandId,
        });
        this.emit('command:registered', { plugin, command });
      },
      execute: async (commandId: string, args: any[]) => {
        const command = this.commands.get(commandId);
        if (!command) {
          throw new Error(`Command not found: ${commandId}`);
        }

        const startTime = Date.now();
        try {
          const result = await command.handler(args, {});
          plugin.state.metrics.executionCount++;
          plugin.state.metrics.lastExecuted = Date.now();

          const duration = Date.now() - startTime;
          plugin.state.metrics.averageExecutionTime =
            (plugin.state.metrics.averageExecutionTime * (plugin.state.metrics.executionCount - 1) + duration) /
            plugin.state.metrics.executionCount;

          return result;
        } catch (error) {
          plugin.state.metrics.errorCount++;
          throw error;
        }
      },
      list: () => {
        return Array.from(this.commands.values()).filter(c =>
          c.id.startsWith(`${plugin.id}:`)
        );
      },
    };
  }

  private createHookAPI(plugin: Plugin): HookAPI {
    return {
      register: (hookName: string, handler: HookHandler) => {
        if (!this.hooks.has(hookName)) {
          this.hooks.set(hookName, []);
        }
        // Explicitly check for null/undefined before pushing
        const handlers = this.hooks.get(hookName);
        if (!handlers) {
          throw new Error(`Failed to get hook handlers for '${hookName}' - unexpected state`);
        }
        handlers.push(handler);
        this.emit('hook:registered', { plugin, hookName });
      },
      trigger: async (hookName: string, data: any) => {
        const handlers = this.hooks.get(hookName) || [];
        let result = data;

        for (const handler of handlers) {
          result = await handler(result);
        }

        return result;
      },
      list: () => {
        return Array.from(this.hooks.keys());
      },
    };
  }

  private createUIAPI(): UIAPI {
    return {
      showMessage: (message: string, type: 'info' | 'warning' | 'error') => {
        this.emit('ui:message', { message, type });
      },
      showProgress: async (title: string, task: () => Promise<void>) => {
        this.emit('ui:progress:start', { title });
        await task();
        this.emit('ui:progress:end', { title });
      },
      prompt: async (question: string, options?: PromptOptions) => {
        // In production, this would show an actual prompt
        return '';
      },
      confirm: async (question: string) => {
        // In production, this would show an actual confirmation dialog
        return false;
      },
    };
  }

  private createWorkspaceAPI(): WorkspaceAPI {
    return {
      getRoot: () => process.cwd(),
      getFiles: async (pattern: string) => {
        // In production, this would use glob
        return [];
      },
      readFile: async (path: string) => {
        return fs.readFileSync(path, 'utf-8');
      },
      writeFile: async (path: string, content: string) => {
        fs.writeFileSync(path, content, 'utf-8');
      },
      watch: (pattern: string, handler: (event: FileEvent) => void) => {
        // In production, this would use chokidar or similar
      },
    };
  }

  private createFilesystemAPI(plugin: Plugin): FilesystemAPI {
    const hasPermission = plugin.permissions.some(
      p => p.type === 'filesystem:read' || p.type === 'filesystem:write'
    );

    if (!hasPermission) {
      throw new Error(`Plugin ${plugin.name} does not have filesystem permissions`);
    }

    return {
      readFile: async (filePath: string) => {
        return fs.readFileSync(filePath);
      },
      writeFile: async (filePath: string, content: Buffer) => {
        fs.writeFileSync(filePath, content);
      },
      readDir: async (dirPath: string) => {
        return fs.readdirSync(dirPath);
      },
      exists: async (filePath: string) => {
        return fs.existsSync(filePath);
      },
      stat: async (filePath: string) => {
        const stats = fs.statSync(filePath);
        return {
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          created: stats.birthtimeMs,
          modified: stats.mtimeMs,
        };
      },
      mkdir: async (dirPath: string) => {
        fs.mkdirSync(dirPath, { recursive: true });
      },
      remove: async (filePath: string) => {
        fs.rmSync(filePath, { recursive: true, force: true });
      },
    };
  }

  private createNetworkAPI(plugin: Plugin): NetworkAPI {
    const hasPermission = plugin.permissions.some(
      p => p.type === 'network:http' || p.type === 'network:https'
    );

    if (!hasPermission) {
      throw new Error(`Plugin ${plugin.name} does not have network permissions`);
    }

    return {
      fetch: async (url: string, options?: FetchOptions) => {
        // In production, this would use fetch or axios
        return {
          status: 200,
          headers: {},
          body: null,
        };
      },
      createServer: (port: number, handler: ServerHandler) => {
        return {
          start: async () => {},
          stop: async () => {},
          port,
        };
      },
    };
  }

  private createProcessAPI(plugin: Plugin): ProcessAPI {
    const hasPermission = plugin.permissions.some(p => p.type === 'process:spawn');

    if (!hasPermission) {
      throw new Error(`Plugin ${plugin.name} does not have process permissions`);
    }

    return {
      spawn: async (command: string, args: string[]) => {
        // In production, this would use child_process
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
        };
      },
      exec: async (command: string) => {
        // In production, this would use child_process
        return '';
      },
    };
  }

  private createPluginStorage(pluginId: string): PluginStorage {
    const storage = new Map<string, any>();

    return {
      get: <T>(key: string): T | undefined => {
        return storage.get(key);
      },
      set: <T>(key: string, value: T) => {
        storage.set(key, value);
      },
      delete: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      keys: () => {
        return Array.from(storage.keys());
      },
    };
  }

  private createPluginLogger(plugin: Plugin): PluginLogger {
    const log = (level: string, message: string, ...args: any[]) => {
      this.emit('plugin:log', { plugin, level, message, args });
    };

    return {
      trace: (message: string, ...args: any[]) => log('trace', message, ...args),
      debug: (message: string, ...args: any[]) => log('debug', message, ...args),
      info: (message: string, ...args: any[]) => log('info', message, ...args),
      warn: (message: string, ...args: any[]) => log('warn', message, ...args),
      error: (message: string, error?: Error, ...args: any[]) => log('error', message, error, ...args),
    };
  }

  // ========================================================================
  // Dependency Management
  // ========================================================================

  private parseDependencies(deps?: Record<string, string>): PluginDependency[] {
    if (!deps) return [];

    return Object.entries(deps).map(([name, version]) => ({
      name,
      version,
    }));
  }

  private async validateDependencies(plugin: Plugin): Promise<void> {
    for (const dep of plugin.dependencies) {
      const installedPlugin = Array.from(this.plugins.values()).find(
        p => p.name === dep.name
      );

      if (!installedPlugin && !dep.optional) {
        throw new Error(`Required dependency not found: ${dep.name}`);
      }

      if (installedPlugin && !this.isVersionCompatible(installedPlugin.version, dep.version)) {
        throw new Error(
          `Incompatible version for ${dep.name}: required ${dep.version}, found ${installedPlugin.version}`
        );
      }
    }
  }

  private isVersionCompatible(installed: string, required: string): boolean {
    // Simplified version check
    return installed >= required;
  }

  private async checkPermissions(plugin: Plugin): Promise<void> {
    for (const permission of plugin.permissions) {
      this.emit('plugin:permission:request', { plugin, permission });
    }
  }

  // ========================================================================
  // Auto-loading
  // ========================================================================

  private async autoLoadPlugins(): Promise<void> {
    if (!fs.existsSync(this.config.pluginDirectory)) {
      return;
    }

    const entries = fs.readdirSync(this.config.pluginDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(this.config.pluginDirectory, entry.name);
        try {
          await this.loadPlugin(pluginPath);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to autoload plugin from ${pluginPath}:`, errorMessage);
          this.emit('plugin:autoload:error', {
            pluginPath,
            error: errorMessage,
            pluginName: entry.name
          });
        }
      }
    }
  }

  // ========================================================================
  // Plugin Registry
  // ========================================================================

  public getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  public listPlugins(filter?: PluginSearchQuery): Plugin[] {
    let plugins = Array.from(this.plugins.values());

    if (filter) {
      if (filter.name) {
        plugins = plugins.filter(p => p.name.includes(filter.name!));
      }

      if (filter.category) {
        plugins = plugins.filter(p => p.metadata.category === filter.category);
      }

      if (filter.capability) {
        plugins = plugins.filter(p => p.capabilities.includes(filter.capability!));
      }

      // Filter by tags with explicit null check and type guard
      if (filter.tags && Array.isArray(filter.tags) && filter.tags.length > 0) {
        plugins = plugins.filter(p => {
          // Ensure both arrays exist and are valid before comparison
          if (!filter.tags || !Array.isArray(p.metadata.tags)) {
            return false;
          }
          return filter.tags.some(t => p.metadata.tags.includes(t));
        });
      }
    }

    return plugins;
  }

  public getActivePlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.state.status === 'active');
  }

  // ========================================================================
  // Command Execution
  // ========================================================================

  public async executeCommand(commandId: string, args: any[]): Promise<any> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    this.emit('command:execute:start', { command, args });

    try {
      const result = await command.handler(args, {});
      this.emit('command:execute:complete', { command, result });
      return result;
    } catch (error) {
      this.emit('command:execute:error', { command, error });
      throw error;
    }
  }

  public listCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  // ========================================================================
  // Hook Execution
  // ========================================================================

  public async triggerHook(hookName: string, data: any): Promise<any> {
    const handlers = this.hooks.get(hookName) || [];

    this.emit('hook:trigger', { hookName, handlersCount: handlers.length });

    let result = data;
    for (const handler of handlers) {
      result = await handler(result);
    }

    return result;
  }

  // ========================================================================
  // Health Checks
  // ========================================================================

  public async checkPluginHealth(pluginId: string): Promise<PluginHealth> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const health: PluginHealth = {
      healthy: true,
      lastCheck: Date.now(),
      issues: [],
    };

    // Check if plugin is loaded
    if (plugin.state.status === 'error') {
      health.healthy = false;
      health.issues.push(`Plugin in error state: ${plugin.state.error?.message}`);
    }

    // Check error rate
    const errorRate = plugin.state.metrics.errorCount / Math.max(plugin.state.metrics.executionCount, 1);
    if (errorRate > 0.1) {
      health.healthy = false;
      health.issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }

    plugin.state.health = health;

    return health;
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generatePluginId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      ),
    ]);
  }

  public getStats(): PluginStats {
    const plugins = Array.from(this.plugins.values());

    return {
      totalPlugins: plugins.length,
      activePlugins: plugins.filter(p => p.state.status === 'active').length,
      inactivePlugins: plugins.filter(p => p.state.status === 'inactive').length,
      errorPlugins: plugins.filter(p => p.state.status === 'error').length,
      totalCommands: this.commands.size,
      totalHooks: this.hooks.size,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface PluginStats {
  totalPlugins: number;
  activePlugins: number;
  inactivePlugins: number;
  errorPlugins: number;
  totalCommands: number;
  totalHooks: number;
}

// ============================================================================
// Export
// ============================================================================

export default PluginManager;
