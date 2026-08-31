/**
 * Configuration Management - Advanced config loading and validation
 * Environment-based configs, secrets management, schema validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { eventBus } from '../core/EventBus';

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
export class AdvancedConfigManager {
  private config: Record<string, any> = {};
  private sources: ConfigSource[] = [];
  private schema?: ConfigSchema;
  private watchers: Map<string, () => void> = new Map();

  /**
   * Register a config source
   */
  registerSource(source: ConfigSource): void {
    this.sources.push(source);
    this.sources.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Set config schema for validation
   */
  setSchema(schema: ConfigSchema): void {
    this.schema = schema;
  }

  /**
   * Load configuration from all sources
   */
  async load(): Promise<void> {
    const configs: Record<string, any>[] = [];

    for (const source of this.sources) {
      try {
        const config = await source.load();
        configs.push(config);
      } catch (error) {
        console.warn(`Failed to load config from ${source.name}:`, error);
      }
    }

    // Merge configs (higher priority overwrites lower)
    this.config = this.mergeConfigs(configs);

    // Validate against schema
    if (this.schema) {
      const errors = this.validate(this.config, this.schema);
      if (errors.length > 0) {
        throw new Error(
          `Config validation failed:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`
        );
      }
    }

    eventBus.emitSync('config.loaded', this.config, 'ConfigManager');
  }

  /**
   * Get config value by path
   */
  get<T = any>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    let value: any = this.config;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return defaultValue as T;
      }
      value = value[part];
    }

    return value !== undefined ? value : (defaultValue as T);
  }

  /**
   * Set config value
   */
  set(path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
    let target = this.config;

    for (const part of parts) {
      if (!target[part] || typeof target[part] !== 'object') {
        target[part] = {};
      }
      target = target[part];
    }

    target[lastPart] = value;

    eventBus.emitSync('config.updated', { path, value }, 'ConfigManager');

    // Notify watchers
    const watcher = this.watchers.get(path);
    if (watcher) {
      watcher();
    }
  }

  /**
   * Watch for config changes
   */
  watch(path: string, callback: () => void): () => void {
    this.watchers.set(path, callback);

    // Return unwatch function
    return () => {
      this.watchers.delete(path);
    };
  }

  /**
   * Get all config
   */
  getAll(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * Validate config against schema
   */
  private validate(
    config: any,
    schema: ConfigSchema,
    path = ''
  ): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

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

    if (
      schema.type !== 'object' &&
      schema.type !== 'array' &&
      typeof config !== schema.type
    ) {
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
  private mergeConfigs(configs: Record<string, any>[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const config of configs) {
      this.deepMerge(result, config);
    }

    return result;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Export config to file
   */
  async export(filePath: string, format: 'json' | 'yaml' = 'json'): Promise<void> {
    let content: string;

    if (format === 'json') {
      content = JSON.stringify(this.config, null, 2);
    } else {
      // Simple YAML export
      content = this.toYAML(this.config);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Simple YAML serialization
   */
  private toYAML(obj: any, indent = 0): string {
    const spaces = ' '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.toYAML(value, indent + 2);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${item}\n`;
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }
}

/**
 * Environment-based config source
 */
export class EnvironmentConfigSource implements ConfigSource {
  name = 'environment';
  priority = 100;

  private prefix: string;

  constructor(prefix = 'AGENT_') {
    this.prefix = prefix;
  }

  async load(): Promise<Record<string, any>> {
    const config: Record<string, any> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(this.prefix)) {
        const configKey = key
          .substring(this.prefix.length)
          .toLowerCase()
          .replace(/_/g, '.');

        this.setNestedValue(config, configKey, this.parseValue(value!));
      }
    }

    return config;
  }

  private parseValue(value: string): any {
    // Try to parse as JSON
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
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

/**
 * File-based config source
 */
export class FileConfigSource implements ConfigSource {
  name: string;
  priority: number;
  private filePath: string;

  constructor(filePath: string, priority = 50) {
    this.name = `file:${filePath}`;
    this.priority = priority;
    this.filePath = filePath;
  }

  async load(): Promise<Record<string, any>> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');

      if (this.filePath.endsWith('.json')) {
        return JSON.parse(content);
      } else if (this.filePath.endsWith('.js') || this.filePath.endsWith('.ts')) {
        // Dynamic import would be used here in real implementation
        return {};
      }

      return {};
    } catch (error) {
      console.warn(`Failed to load config from ${this.filePath}:`, error);
      return {};
    }
  }
}

/**
 * Remote config source (for cloud-based configs)
 */
export class RemoteConfigSource implements ConfigSource {
  name: string;
  priority = 25;
  private url: string;

  constructor(url: string) {
    this.name = `remote:${url}`;
    this.url = url;
  }

  async load(): Promise<Record<string, any>> {
    // In real implementation, would fetch from remote URL
    console.log(`Fetching config from ${this.url}`);
    return {};
  }
}

/**
 * Config presets for common scenarios
 */
export class ConfigPresets {
  static development(): Record<string, any> {
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

  static production(): Record<string, any> {
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

  static testing(): Record<string, any> {
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

/**
 * Config migration helper
 */
export class ConfigMigration {
  private migrations: Map<string, (config: any) => any> = new Map();

  /**
   * Register a migration
   */
  register(version: string, migrate: (config: any) => any): void {
    this.migrations.set(version, migrate);
  }

  /**
   * Run migrations
   */
  async migrate(config: any, fromVersion: string, toVersion: string): Promise<any> {
    let result = { ...config };
    let currentVersion = fromVersion;

    // Get migration versions in order
    const versions = Array.from(this.migrations.keys()).sort();

    for (const version of versions) {
      if (version > currentVersion && version <= toVersion) {
        const migrate = this.migrations.get(version)!;
        result = migrate(result);
        currentVersion = version;
      }
    }

    return result;
  }
}

/**
 * Singleton instance
 */
export const advancedConfigManager = new AdvancedConfigManager();
