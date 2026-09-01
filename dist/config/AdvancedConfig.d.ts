/**
 * Configuration Management - Advanced config loading and validation
 * Environment-based configs, secrets management, schema validation
 */
export interface ConfigSchema {
    type: 'object' | 'string' | 'number' | 'boolean' | 'array';
    properties?: Record<string, ConfigSchema>;
    required?: string[];
    default?: any;
    enum?: any[];
    minimum?: number;
    maximum?: number;
    pattern?: string;
    items?: ConfigSchema;
}
export interface ConfigSource {
    name: string;
    priority: number;
    load: () => Promise<Record<string, any>>;
}
export interface ConfigValidationError {
    path: string;
    message: string;
    value?: any;
}
/**
 * Advanced Configuration Manager
 */
export declare class AdvancedConfigManager {
    private config;
    private sources;
    private schema?;
    private watchers;
    /**
     * Register a config source
     */
    registerSource(source: ConfigSource): void;
    /**
     * Set config schema for validation
     */
    setSchema(schema: ConfigSchema): void;
    /**
     * Load configuration from all sources
     */
    load(): Promise<void>;
    /**
     * Get config value by path
     */
    get<T = any>(path: string, defaultValue?: T): T;
    /**
     * Set config value
     */
    set(path: string, value: any): void;
    /**
     * Watch for config changes
     */
    watch(path: string, callback: () => void): () => void;
    /**
     * Get all config
     */
    getAll(): Record<string, any>;
    /**
     * Validate config against schema
     */
    private validate;
    /**
     * Merge multiple configs (right overwrites left)
     */
    private mergeConfigs;
    /**
     * Deep merge objects
     */
    private deepMerge;
    /**
     * Export config to file
     */
    export(filePath: string, format?: 'json' | 'yaml'): Promise<void>;
    /**
     * Simple YAML serialization
     */
    private toYAML;
}
/**
 * Environment-based config source
 */
export declare class EnvironmentConfigSource implements ConfigSource {
    name: string;
    priority: number;
    private prefix;
    constructor(prefix?: string);
    load(): Promise<Record<string, any>>;
    private parseValue;
    private setNestedValue;
}
/**
 * File-based config source
 */
export declare class FileConfigSource implements ConfigSource {
    name: string;
    priority: number;
    private filePath;
    constructor(filePath: string, priority?: number);
    load(): Promise<Record<string, any>>;
}
/**
 * Remote config source (for cloud-based configs)
 */
export declare class RemoteConfigSource implements ConfigSource {
    name: string;
    priority: number;
    private url;
    constructor(url: string);
    load(): Promise<Record<string, any>>;
}
/**
 * Config presets for common scenarios
 */
export declare class ConfigPresets {
    static development(): Record<string, any>;
    static production(): Record<string, any>;
    static testing(): Record<string, any>;
}
/**
 * Config migration helper
 */
export declare class ConfigMigration {
    private migrations;
    /**
     * Register a migration
     */
    register(version: string, migrate: (config: any) => any): void;
    /**
     * Run migrations
     */
    migrate(config: any, fromVersion: string, toVersion: string): Promise<any>;
}
/**
 * Singleton instance
 */
export declare const advancedConfigManager: AdvancedConfigManager;
//# sourceMappingURL=AdvancedConfig.d.ts.map