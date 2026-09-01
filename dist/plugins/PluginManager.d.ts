/**
 * Advanced Plugin System & Extension Framework
 * Dynamic plugin loading, dependency resolution, lifecycle management
 * Sandboxed execution, API versioning, plugin marketplace
 */
import { EventEmitter } from 'events';
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
export type PluginCapability = 'command' | 'hook' | 'provider' | 'transformer' | 'analyzer' | 'generator' | 'ui' | 'language';
export interface PluginPermission {
    type: PermissionType;
    resources?: string[];
    reason: string;
}
export type PermissionType = 'filesystem:read' | 'filesystem:write' | 'network:http' | 'network:https' | 'process:spawn' | 'environment:read' | 'environment:write';
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
export declare class PluginManager extends EventEmitter {
    private config;
    private plugins;
    private contexts;
    private commands;
    private hooks;
    private loadedModules;
    constructor(config?: Partial<PluginConfig>);
    loadPlugin(pluginPath: string): Promise<Plugin>;
    private loadModule;
    unloadPlugin(pluginId: string): Promise<void>;
    reloadPlugin(pluginId: string): Promise<Plugin>;
    activatePlugin(pluginId: string): Promise<void>;
    deactivatePlugin(pluginId: string): Promise<void>;
    private createPluginContext;
    private createPluginAPI;
    private createCommandAPI;
    private createHookAPI;
    private createUIAPI;
    private createWorkspaceAPI;
    private createFilesystemAPI;
    private createNetworkAPI;
    private createProcessAPI;
    private createPluginStorage;
    private createPluginLogger;
    private parseDependencies;
    private validateDependencies;
    private isVersionCompatible;
    private checkPermissions;
    private autoLoadPlugins;
    getPlugin(pluginId: string): Plugin | undefined;
    listPlugins(filter?: PluginSearchQuery): Plugin[];
    getActivePlugins(): Plugin[];
    executeCommand(commandId: string, args: any[]): Promise<any>;
    listCommands(): CommandDefinition[];
    triggerHook(hookName: string, data: any): Promise<any>;
    checkPluginHealth(pluginId: string): Promise<PluginHealth>;
    private generatePluginId;
    private executeWithTimeout;
    getStats(): PluginStats;
}
interface PluginStats {
    totalPlugins: number;
    activePlugins: number;
    inactivePlugins: number;
    errorPlugins: number;
    totalCommands: number;
    totalHooks: number;
}
export default PluginManager;
//# sourceMappingURL=PluginManager.d.ts.map