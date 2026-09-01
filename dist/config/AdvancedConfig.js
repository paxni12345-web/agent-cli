"use strict";
/**
 * Configuration Management - Advanced config loading and validation
 * Environment-based configs, secrets management, schema validation
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
exports.advancedConfigManager = exports.ConfigMigration = exports.ConfigPresets = exports.RemoteConfigSource = exports.FileConfigSource = exports.EnvironmentConfigSource = exports.AdvancedConfigManager = void 0;
const fs = __importStar(require("fs/promises"));
const EventBus_1 = require("../core/EventBus");
/**
 * Advanced Configuration Manager
 */
class AdvancedConfigManager {
    config = {};
    sources = [];
    schema;
    watchers = new Map();
    /**
     * Register a config source
     */
    registerSource(source) {
        this.sources.push(source);
        this.sources.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Set config schema for validation
     */
    setSchema(schema) {
        this.schema = schema;
    }
    /**
     * Load configuration from all sources
     */
    async load() {
        const configs = [];
        for (const source of this.sources) {
            try {
                const config = await source.load();
                configs.push(config);
            }
            catch (error) {
                console.warn(`Failed to load config from ${source.name}:`, error);
            }
        }
        // Merge configs (higher priority overwrites lower)
        this.config = this.mergeConfigs(configs);
        // Validate against schema
        if (this.schema) {
            const errors = this.validate(this.config, this.schema);
            if (errors.length > 0) {
                throw new Error(`Config validation failed:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`);
            }
        }
        EventBus_1.eventBus.emitSync('config.loaded', this.config, 'ConfigManager');
    }
    /**
     * Get config value by path
     */
    get(path, defaultValue) {
        const parts = path.split('.');
        let value = this.config;
        for (const part of parts) {
            if (value === undefined || value === null) {
                return defaultValue;
            }
            value = value[part];
        }
        return value !== undefined ? value : defaultValue;
    }
    /**
     * Set config value
     */
    set(path, value) {
        const parts = path.split('.');
        const lastPart = parts.pop();
        let target = this.config;
        for (const part of parts) {
            if (!target[part] || typeof target[part] !== 'object') {
                target[part] = {};
            }
            target = target[part];
        }
        target[lastPart] = value;
        EventBus_1.eventBus.emitSync('config.updated', { path, value }, 'ConfigManager');
        // Notify watchers
        const watcher = this.watchers.get(path);
        if (watcher) {
            watcher();
        }
    }
    /**
     * Watch for config changes
     */
    watch(path, callback) {
        this.watchers.set(path, callback);
        // Return unwatch function
        return () => {
            this.watchers.delete(path);
        };
    }
    /**
     * Get all config
     */
    getAll() {
        return { ...this.config };
    }
    /**
     * Validate config against schema
     */
    validate(config, schema, path = '') {
        const errors = [];
        // Type validation
        if (schema.type === 'object' && typeof config !== 'object') {
            errors.push({
                path,
                message: `Expected object, got ${typeof config}`,
                value: config,
            });
            return errors;
        }
        if (schema.type === 'array' && !Array.isArray(config)) {
            errors.push({
                path,
                message: `Expected array, got ${typeof config}`,
                value: config,
            });
            return errors;
        }
        if (schema.type !== 'object' &&
            schema.type !== 'array' &&
            typeof config !== schema.type) {
            errors.push({
                path,
                message: `Expected ${schema.type}, got ${typeof config}`,
                value: config,
            });
            return errors;
        }
        // Required fields
        if (schema.required && schema.type === 'object') {
            for (const key of schema.required) {
                if (!(key in config)) {
                    errors.push({
                        path: path ? `${path}.${key}` : key,
                        message: 'Required field missing',
                    });
                }
            }
        }
        // Enum validation
        if (schema.enum && !schema.enum.includes(config)) {
            errors.push({
                path,
                message: `Value must be one of: ${schema.enum.join(', ')}`,
                value: config,
            });
        }
        // Number validation
        if (schema.type === 'number') {
            if (schema.minimum !== undefined && config < schema.minimum) {
                errors.push({
                    path,
                    message: `Value must be >= ${schema.minimum}`,
                    value: config,
                });
            }
            if (schema.maximum !== undefined && config > schema.maximum) {
                errors.push({
                    path,
                    message: `Value must be <= ${schema.maximum}`,
                    value: config,
                });
            }
        }
        // String pattern validation
        if (schema.type === 'string' && schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(config)) {
                errors.push({
                    path,
                    message: `Value must match pattern: ${schema.pattern}`,
                    value: config,
                });
            }
        }
        // Recursive validation for objects
        if (schema.type === 'object' && schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (key in config) {
                    const propPath = path ? `${path}.${key}` : key;
                    errors.push(...this.validate(config[key], propSchema, propPath));
                }
            }
        }
        // Array items validation
        if (schema.type === 'array' && schema.items) {
            for (let i = 0; i < config.length; i++) {
                const itemPath = `${path}[${i}]`;
                errors.push(...this.validate(config[i], schema.items, itemPath));
            }
        }
        return errors;
    }
    /**
     * Merge multiple configs (right overwrites left)
     */
    mergeConfigs(configs) {
        const result = {};
        for (const config of configs) {
            this.deepMerge(result, config);
        }
        return result;
    }
    /**
     * Deep merge objects
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            }
            else {
                target[key] = source[key];
            }
        }
    }
    /**
     * Export config to file
     */
    async export(filePath, format = 'json') {
        let content;
        if (format === 'json') {
            content = JSON.stringify(this.config, null, 2);
        }
        else {
            // Simple YAML export
            content = this.toYAML(this.config);
        }
        await fs.writeFile(filePath, content, 'utf-8');
    }
    /**
     * Simple YAML serialization
     */
    toYAML(obj, indent = 0) {
        const spaces = ' '.repeat(indent);
        let yaml = '';
        for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                yaml += `${spaces}${key}:\n`;
                yaml += this.toYAML(value, indent + 2);
            }
            else if (Array.isArray(value)) {
                yaml += `${spaces}${key}:\n`;
                for (const item of value) {
                    yaml += `${spaces}  - ${item}\n`;
                }
            }
            else {
                yaml += `${spaces}${key}: ${value}\n`;
            }
        }
        return yaml;
    }
}
exports.AdvancedConfigManager = AdvancedConfigManager;
/**
 * Environment-based config source
 */
class EnvironmentConfigSource {
    name = 'environment';
    priority = 100;
    prefix;
    constructor(prefix = 'AGENT_') {
        this.prefix = prefix;
    }
    async load() {
        const config = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(this.prefix)) {
                const configKey = key
                    .substring(this.prefix.length)
                    .toLowerCase()
                    .replace(/_/g, '.');
                this.setNestedValue(config, configKey, this.parseValue(value));
            }
        }
        return config;
    }
    parseValue(value) {
        // Try to parse as JSON
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        if (value === 'null')
            return null;
        if (/^\d+$/.test(value))
            return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value))
            return parseFloat(value);
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    setNestedValue(obj, path, value) {
        const parts = path.split('.');
        const lastPart = parts.pop();
        let target = obj;
        for (const part of parts) {
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part];
        }
        target[lastPart] = value;
    }
}
exports.EnvironmentConfigSource = EnvironmentConfigSource;
/**
 * File-based config source
 */
class FileConfigSource {
    name;
    priority;
    filePath;
    constructor(filePath, priority = 50) {
        this.name = `file:${filePath}`;
        this.priority = priority;
        this.filePath = filePath;
    }
    async load() {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            if (this.filePath.endsWith('.json')) {
                return JSON.parse(content);
            }
            else if (this.filePath.endsWith('.js') || this.filePath.endsWith('.ts')) {
                // Dynamic import would be used here in real implementation
                return {};
            }
            return {};
        }
        catch (error) {
            console.warn(`Failed to load config from ${this.filePath}:`, error);
            return {};
        }
    }
}
exports.FileConfigSource = FileConfigSource;
/**
 * Remote config source (for cloud-based configs)
 */
class RemoteConfigSource {
    name;
    priority = 25;
    url;
    constructor(url) {
        this.name = `remote:${url}`;
        this.url = url;
    }
    async load() {
        // In real implementation, would fetch from remote URL
        console.log(`Fetching config from ${this.url}`);
        return {};
    }
}
exports.RemoteConfigSource = RemoteConfigSource;
/**
 * Config presets for common scenarios
 */
class ConfigPresets {
    static development() {
        return {
            provider: 'anthropic',
            model: 'claude-opus-5',
            maxIterations: 20,
            debug: true,
            verbose: true,
            autoSave: true,
            features: {
                git: true,
                linting: true,
                formatting: true,
            },
        };
    }
    static production() {
        return {
            provider: 'anthropic',
            model: 'claude-sonnet-5',
            maxIterations: 10,
            debug: false,
            verbose: false,
            autoSave: false,
            features: {
                git: true,
                linting: true,
                formatting: true,
            },
            security: {
                secretDetection: true,
                permissionMode: 'safe',
            },
        };
    }
    static testing() {
        return {
            provider: 'mock',
            model: 'test-model',
            maxIterations: 5,
            debug: true,
            verbose: false,
            features: {
                git: false,
                linting: false,
                formatting: false,
            },
        };
    }
}
exports.ConfigPresets = ConfigPresets;
/**
 * Config migration helper
 */
class ConfigMigration {
    migrations = new Map();
    /**
     * Register a migration
     */
    register(version, migrate) {
        this.migrations.set(version, migrate);
    }
    /**
     * Run migrations
     */
    async migrate(config, fromVersion, toVersion) {
        let result = { ...config };
        let currentVersion = fromVersion;
        // Get migration versions in order
        const versions = Array.from(this.migrations.keys()).sort();
        for (const version of versions) {
            if (version > currentVersion && version <= toVersion) {
                const migrate = this.migrations.get(version);
                result = migrate(result);
                currentVersion = version;
            }
        }
        return result;
    }
}
exports.ConfigMigration = ConfigMigration;
/**
 * Singleton instance
 */
exports.advancedConfigManager = new AdvancedConfigManager();
