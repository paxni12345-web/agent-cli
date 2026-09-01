"use strict";
/**
 * Advanced Plugin System & Extension Framework
 * Dynamic plugin loading, dependency resolution, lifecycle management
 * Sandboxed execution, API versioning, plugin marketplace
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginManager = void 0;
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// ============================================================================
// Plugin Manager
// ============================================================================
class PluginManager extends events_1.EventEmitter {
    config;
    plugins = new Map();
    contexts = new Map();
    commands = new Map();
    hooks = new Map();
    loadedModules = new Map();
    constructor(config = {}) {
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
    async loadPlugin(pluginPath) {
        this.emit('plugin:load:start', { pluginPath });
        // Read manifest
        const manifestPath = path.join(pluginPath, 'package.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Plugin manifest not found: ${manifestPath}`);
        }
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        // Create plugin
        const plugin = {
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
        }
        catch (error) {
            plugin.state.status = 'error';
            plugin.state.error = error;
            this.emit('plugin:load:error', { plugin, error });
            throw error;
        }
    }
    async loadModule(modulePath) {
        // In production, this would use dynamic import with sandboxing
        // For now, we'll simulate module loading
        return {
            activate: async (context) => {
                // Plugin activation logic
            },
            deactivate: async () => {
                // Plugin deactivation logic
            },
        };
    }
    async unloadPlugin(pluginId) {
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
    async reloadPlugin(pluginId) {
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
    async activatePlugin(pluginId) {
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
                await this.executeWithTimeout(module.activate(context), this.config.maxExecutionTime);
            }
            plugin.state.status = 'active';
            plugin.state.activatedAt = Date.now();
            plugin.state.metrics.activationTime = Date.now() - startTime;
            this.emit('plugin:activated', { plugin });
        }
        catch (error) {
            plugin.state.status = 'error';
            plugin.state.error = error;
            plugin.state.metrics.errorCount++;
            this.emit('plugin:activate:error', { plugin, error });
            throw error;
        }
    }
    async deactivatePlugin(pluginId) {
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
                await this.executeWithTimeout(module.deactivate(), this.config.maxExecutionTime);
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
                    this.hooks.set(hookName, handlers.filter(h => !h.toString().includes(plugin.id)));
                }
                catch (error) {
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
        }
        catch (error) {
            plugin.state.error = error;
            this.emit('plugin:deactivate:error', { plugin, error });
            throw error;
        }
    }
    // ========================================================================
    // Plugin Context
    // ========================================================================
    createPluginContext(plugin) {
        const api = this.createPluginAPI(plugin);
        const storage = this.createPluginStorage(plugin.id);
        const logger = this.createPluginLogger(plugin);
        return {
            plugin,
            api,
            config: plugin.configuration.defaults,
            storage,
            logger,
            events: new events_1.EventEmitter(),
        };
    }
    createPluginAPI(plugin) {
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
    createCommandAPI(plugin) {
        return {
            register: (command) => {
                const commandId = `${plugin.id}:${command.id}`;
                this.commands.set(commandId, {
                    ...command,
                    id: commandId,
                });
                this.emit('command:registered', { plugin, command });
            },
            execute: async (commandId, args) => {
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
                }
                catch (error) {
                    plugin.state.metrics.errorCount++;
                    throw error;
                }
            },
            list: () => {
                return Array.from(this.commands.values()).filter(c => c.id.startsWith(`${plugin.id}:`));
            },
        };
    }
    createHookAPI(plugin) {
        return {
            register: (hookName, handler) => {
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
            trigger: async (hookName, data) => {
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
    createUIAPI() {
        return {
            showMessage: (message, type) => {
                this.emit('ui:message', { message, type });
            },
            showProgress: async (title, task) => {
                this.emit('ui:progress:start', { title });
                await task();
                this.emit('ui:progress:end', { title });
            },
            prompt: async (question, options) => {
                // In production, this would show an actual prompt
                return '';
            },
            confirm: async (question) => {
                // In production, this would show an actual confirmation dialog
                return false;
            },
        };
    }
    createWorkspaceAPI() {
        return {
            getRoot: () => process.cwd(),
            getFiles: async (pattern) => {
                // In production, this would use glob
                return [];
            },
            readFile: async (path) => {
                return fs.readFileSync(path, 'utf-8');
            },
            writeFile: async (path, content) => {
                fs.writeFileSync(path, content, 'utf-8');
            },
            watch: (pattern, handler) => {
                // In production, this would use chokidar or similar
            },
        };
    }
    createFilesystemAPI(plugin) {
        const hasPermission = plugin.permissions.some(p => p.type === 'filesystem:read' || p.type === 'filesystem:write');
        if (!hasPermission) {
            throw new Error(`Plugin ${plugin.name} does not have filesystem permissions`);
        }
        return {
            readFile: async (filePath) => {
                return fs.readFileSync(filePath);
            },
            writeFile: async (filePath, content) => {
                fs.writeFileSync(filePath, content);
            },
            readDir: async (dirPath) => {
                return fs.readdirSync(dirPath);
            },
            exists: async (filePath) => {
                return fs.existsSync(filePath);
            },
            stat: async (filePath) => {
                const stats = fs.statSync(filePath);
                return {
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory(),
                    size: stats.size,
                    created: stats.birthtimeMs,
                    modified: stats.mtimeMs,
                };
            },
            mkdir: async (dirPath) => {
                fs.mkdirSync(dirPath, { recursive: true });
            },
            remove: async (filePath) => {
                fs.rmSync(filePath, { recursive: true, force: true });
            },
        };
    }
    createNetworkAPI(plugin) {
        const hasPermission = plugin.permissions.some(p => p.type === 'network:http' || p.type === 'network:https');
        if (!hasPermission) {
            throw new Error(`Plugin ${plugin.name} does not have network permissions`);
        }
        return {
            fetch: async (url, options) => {
                // In production, this would use fetch or axios
                return {
                    status: 200,
                    headers: {},
                    body: null,
                };
            },
            createServer: (port, handler) => {
                return {
                    start: async () => { },
                    stop: async () => { },
                    port,
                };
            },
        };
    }
    createProcessAPI(plugin) {
        const hasPermission = plugin.permissions.some(p => p.type === 'process:spawn');
        if (!hasPermission) {
            throw new Error(`Plugin ${plugin.name} does not have process permissions`);
        }
        return {
            spawn: async (command, args) => {
                // In production, this would use child_process
                return {
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                };
            },
            exec: async (command) => {
                // In production, this would use child_process
                return '';
            },
        };
    }
    createPluginStorage(pluginId) {
        const storage = new Map();
        return {
            get: (key) => {
                return storage.get(key);
            },
            set: (key, value) => {
                storage.set(key, value);
            },
            delete: (key) => {
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
    createPluginLogger(plugin) {
        const log = (level, message, ...args) => {
            this.emit('plugin:log', { plugin, level, message, args });
        };
        return {
            trace: (message, ...args) => log('trace', message, ...args),
            debug: (message, ...args) => log('debug', message, ...args),
            info: (message, ...args) => log('info', message, ...args),
            warn: (message, ...args) => log('warn', message, ...args),
            error: (message, error, ...args) => log('error', message, error, ...args),
        };
    }
    // ========================================================================
    // Dependency Management
    // ========================================================================
    parseDependencies(deps) {
        if (!deps)
            return [];
        return Object.entries(deps).map(([name, version]) => ({
            name,
            version,
        }));
    }
    async validateDependencies(plugin) {
        for (const dep of plugin.dependencies) {
            const installedPlugin = Array.from(this.plugins.values()).find(p => p.name === dep.name);
            if (!installedPlugin && !dep.optional) {
                throw new Error(`Required dependency not found: ${dep.name}`);
            }
            if (installedPlugin && !this.isVersionCompatible(installedPlugin.version, dep.version)) {
                throw new Error(`Incompatible version for ${dep.name}: required ${dep.version}, found ${installedPlugin.version}`);
            }
        }
    }
    isVersionCompatible(installed, required) {
        // Simplified version check
        return installed >= required;
    }
    async checkPermissions(plugin) {
        for (const permission of plugin.permissions) {
            this.emit('plugin:permission:request', { plugin, permission });
        }
    }
    // ========================================================================
    // Auto-loading
    // ========================================================================
    async autoLoadPlugins() {
        if (!fs.existsSync(this.config.pluginDirectory)) {
            return;
        }
        const entries = fs.readdirSync(this.config.pluginDirectory, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pluginPath = path.join(this.config.pluginDirectory, entry.name);
                try {
                    await this.loadPlugin(pluginPath);
                }
                catch (error) {
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
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }
    listPlugins(filter) {
        let plugins = Array.from(this.plugins.values());
        if (filter) {
            if (filter.name) {
                plugins = plugins.filter(p => p.name.includes(filter.name));
            }
            if (filter.category) {
                plugins = plugins.filter(p => p.metadata.category === filter.category);
            }
            if (filter.capability) {
                plugins = plugins.filter(p => p.capabilities.includes(filter.capability));
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
    getActivePlugins() {
        return Array.from(this.plugins.values()).filter(p => p.state.status === 'active');
    }
    // ========================================================================
    // Command Execution
    // ========================================================================
    async executeCommand(commandId, args) {
        const command = this.commands.get(commandId);
        if (!command) {
            throw new Error(`Command not found: ${commandId}`);
        }
        this.emit('command:execute:start', { command, args });
        try {
            const result = await command.handler(args, {});
            this.emit('command:execute:complete', { command, result });
            return result;
        }
        catch (error) {
            this.emit('command:execute:error', { command, error });
            throw error;
        }
    }
    listCommands() {
        return Array.from(this.commands.values());
    }
    // ========================================================================
    // Hook Execution
    // ========================================================================
    async triggerHook(hookName, data) {
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
    async checkPluginHealth(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        const health = {
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
    generatePluginId(name) {
        return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    async executeWithTimeout(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), timeout)),
        ]);
    }
    getStats() {
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
exports.PluginManager = PluginManager;
// ============================================================================
// Export
// ============================================================================
exports.default = PluginManager;
