/**
 * Advanced Configuration Management System
 * Multi-environment configuration, secrets management, feature flags
 * Dynamic configuration updates, validation, versioning
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ConfigManagerConfig {
  defaultEnvironment: string;
  enableEncryption: boolean;
  enableValidation: boolean;
  enableVersioning: boolean;
  enableRemoteConfig: boolean;
  refreshInterval: number;
  configPaths: string[];
}

export interface Configuration {
  id: string;
  name: string;
  environment: Environment;
  version: string;
  schema?: ConfigSchema;
  values: Map<string, ConfigValue>;
  secrets: Map<string, Secret>;
  featureFlags: Map<string, FeatureFlag>;
  metadata: ConfigMetadata;
  state: ConfigState;
}

export type Environment = 'development' | 'staging' | 'production' | 'test' | string;

export interface ConfigValue {
  key: string;
  value: any;
  type: ValueType;
  encrypted: boolean;
  override?: any;
  source: ConfigSource;
  lastUpdated: number;
}

export type ValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export type ConfigSource = 'file' | 'environment' | 'remote' | 'default' | 'override';

export interface Secret {
  key: string;
  value: string;
  encrypted: boolean;
  expiresAt?: number;
  rotateAt?: number;
  lastRotated?: number;
  metadata: SecretMetadata;
}

export interface SecretMetadata {
  description?: string;
  tags: string[];
  createdAt: number;
  createdBy: string;
  accessCount: number;
  lastAccessed?: number;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage?: number;
  conditions?: FlagCondition[];
  variants?: FlagVariant[];
  metadata: FlagMetadata;
}

export interface FlagCondition {
  type: ConditionType;
  operator: ConditionOperator;
  value: any;
  attribute?: string;
}

export type ConditionType = 'user' | 'environment' | 'custom' | 'time' | 'random';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'matches';

export interface FlagVariant {
  name: string;
  value: any;
  weight: number;
}

export interface FlagMetadata {
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  owner?: string;
}

export interface ConfigSchema {
  version: string;
  properties: Map<string, SchemaProperty>;
  required: string[];
  additionalProperties: boolean;
}

export interface SchemaProperty {
  type: ValueType | ValueType[];
  description?: string;
  default?: any;
  enum?: any[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: SchemaProperty;
  properties?: Map<string, SchemaProperty>;
}

export interface ConfigMetadata {
  description?: string;
  tags: string[];
  owner: string;
  createdAt: number;
  updatedAt: number;
  lastValidated?: number;
}

export type ConfigState = 'active' | 'inactive' | 'deprecated';

export interface ConfigVersion {
  id: string;
  configId: string;
  version: string;
  values: Record<string, any>;
  timestamp: number;
  author: string;
  message?: string;
  checksum: string;
}

export interface ValidationError {
  key: string;
  message: string;
  expected?: any;
  actual?: any;
}

export interface ConfigWatch {
  id: string;
  keys: string[];
  callback: (changes: ConfigChange[]) => void;
  active: boolean;
}

export interface ConfigChange {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

export interface RemoteConfigSource {
  id: string;
  type: RemoteSourceType;
  endpoint: string;
  credentials?: Record<string, string>;
  refreshInterval: number;
  lastSync?: number;
}

export type RemoteSourceType = 'http' | 'consul' | 'etcd' | 'vault' | 'aws_ssm' | 'gcp_secret_manager';

export interface EncryptionKey {
  id: string;
  algorithm: string;
  key: string;
  createdAt: number;
  rotateAt?: number;
}

// ============================================================================
// Configuration Manager
// ============================================================================

export class ConfigManager extends EventEmitter {
  private config: ConfigManagerConfig;
  private configurations: Map<string, Configuration> = new Map();
  private versions: Map<string, ConfigVersion[]> = new Map();
  private watches: Map<string, ConfigWatch> = new Map();
  private remoteSources: Map<string, RemoteConfigSource> = new Map();
  private encryptionKey?: EncryptionKey;
  private cache: Map<string, any> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ConfigManagerConfig> = {}) {
    super();
    this.config = {
      defaultEnvironment: 'development',
      enableEncryption: true,
      enableValidation: true,
      enableVersioning: true,
      enableRemoteConfig: false,
      refreshInterval: 60000,
      configPaths: ['./config'],
      ...config,
    };

    if (this.config.enableEncryption) {
      this.initializeEncryption();
    }

    if (this.config.enableRemoteConfig) {
      this.startRemoteConfigSync();
    }
  }

  // ========================================================================
  // Configuration Management
  // ========================================================================

  public createConfiguration(
    name: string,
    environment: Environment = this.config.defaultEnvironment
  ): Configuration {
    const configuration: Configuration = {
      id: this.generateId(),
      name,
      environment,
      version: '1.0.0',
      values: new Map(),
      secrets: new Map(),
      featureFlags: new Map(),
      metadata: {
        tags: [],
        owner: 'system',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      state: 'active',
    };

    this.configurations.set(configuration.id, configuration);
    this.versions.set(configuration.id, []);

    this.emit('config:created', { configuration });

    return configuration;
  }

  public getConfiguration(id: string): Configuration | undefined {
    return this.configurations.get(id);
  }

  public getConfigurationByEnvironment(environment: Environment): Configuration | undefined {
    return Array.from(this.configurations.values()).find(
      c => c.environment === environment && c.state === 'active'
    );
  }

  // ========================================================================
  // Value Management
  // ========================================================================

  public set(
    configId: string,
    key: string,
    value: any,
    options: SetOptions = {}
  ): void {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    // Validate if schema exists
    if (this.config.enableValidation && config.schema) {
      const errors = this.validateValue(key, value, config.schema);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
    }

    const configValue: ConfigValue = {
      key,
      value: options.encrypted ? this.encrypt(value) : value,
      type: this.getValueType(value),
      encrypted: options.encrypted || false,
      source: options.source || 'override',
      lastUpdated: Date.now(),
    };

    const oldValue = config.values.get(key);
    config.values.set(key, configValue);
    config.metadata.updatedAt = Date.now();

    this.emit('config:value:set', { config, key, value: configValue });

    // Notify watchers
    this.notifyWatchers(key, oldValue?.value, value);

    // Create version if enabled
    if (this.config.enableVersioning) {
      this.createVersion(config, 'Value updated', 'system');
    }

    // Clear cache
    this.cache.delete(`${configId}:${key}`);
  }

  public get<T = any>(configId: string, key: string, defaultValue?: T): T {
    // Check cache first
    const cacheKey = `${configId}:${key}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const config = this.configurations.get(configId);
    if (!config) {
      return defaultValue as T;
    }

    const configValue = config.values.get(key);
    if (!configValue) {
      return defaultValue as T;
    }

    let value = configValue.value;

    // Decrypt if encrypted
    if (configValue.encrypted) {
      value = this.decrypt(value);
    }

    // Cache the value
    this.cache.set(cacheKey, value);

    return value as T;
  }

  public has(configId: string, key: string): boolean {
    const config = this.configurations.get(configId);
    return config ? config.values.has(key) : false;
  }

  public delete(configId: string, key: string): void {
    const config = this.configurations.get(configId);
    if (!config) return;

    const oldValue = config.values.get(key);
    config.values.delete(key);
    config.metadata.updatedAt = Date.now();

    this.emit('config:value:deleted', { config, key });

    // Notify watchers
    this.notifyWatchers(key, oldValue?.value, undefined);

    // Clear cache
    this.cache.delete(`${configId}:${key}`);
  }

  public getAll(configId: string): Record<string, any> {
    const config = this.configurations.get(configId);
    if (!config) return {};

    const result: Record<string, any> = {};

    for (const [key, configValue] of config.values.entries()) {
      result[key] = configValue.encrypted
        ? this.decrypt(configValue.value)
        : configValue.value;
    }

    return result;
  }

  // ========================================================================
  // Secret Management
  // ========================================================================

  public setSecret(
    configId: string,
    key: string,
    value: string,
    metadata?: Partial<SecretMetadata>
  ): void {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    const secret: Secret = {
      key,
      value: this.encrypt(value),
      encrypted: true,
      metadata: {
        tags: [],
        createdAt: Date.now(),
        createdBy: 'system',
        accessCount: 0,
        ...metadata,
      },
    };

    config.secrets.set(key, secret);
    this.emit('secret:set', { config, key });
  }

  public getSecret(configId: string, key: string): string | undefined {
    const config = this.configurations.get(configId);
    if (!config) return undefined;

    const secret = config.secrets.get(key);
    if (!secret) return undefined;

    // Update access metadata
    secret.metadata.accessCount++;
    secret.metadata.lastAccessed = Date.now();

    return this.decrypt(secret.value);
  }

  public rotateSecret(configId: string, key: string, newValue: string): void {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    const secret = config.secrets.get(key);
    if (!secret) {
      throw new Error(`Secret not found: ${key}`);
    }

    secret.value = this.encrypt(newValue);
    secret.lastRotated = Date.now();

    this.emit('secret:rotated', { config, key });
  }

  // ========================================================================
  // Feature Flags
  // ========================================================================

  public setFeatureFlag(
    configId: string,
    key: string,
    enabled: boolean,
    options: Partial<FeatureFlag> = {}
  ): void {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    const flag: FeatureFlag = {
      key,
      enabled,
      rolloutPercentage: options.rolloutPercentage,
      conditions: options.conditions,
      variants: options.variants,
      metadata: {
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...options.metadata,
      },
    };

    config.featureFlags.set(key, flag);
    this.emit('feature_flag:set', { config, key, flag });
  }

  public isFeatureEnabled(
    configId: string,
    key: string,
    context?: Record<string, any>
  ): boolean {
    const config = this.configurations.get(configId);
    if (!config) return false;

    const flag = config.featureFlags.get(key);
    if (!flag) return false;

    if (!flag.enabled) return false;

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      const random = Math.random() * 100;
      if (random > flag.rolloutPercentage) return false;
    }

    // Check conditions
    if (flag.conditions && context) {
      for (const condition of flag.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  public getFeatureFlagVariant(
    configId: string,
    key: string,
    context?: Record<string, any>
  ): any {
    if (!this.isFeatureEnabled(configId, key, context)) {
      return null;
    }

    const config = this.configurations.get(configId);
    if (!config) return null;

    const flag = config.featureFlags.get(key);
    if (!flag || !flag.variants || flag.variants.length === 0) {
      return null;
    }

    // Select variant based on weights
    const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const variant of flag.variants) {
      random -= variant.weight;
      if (random <= 0) {
        return variant.value;
      }
    }

    return flag.variants[0].value;
  }

  private evaluateCondition(condition: FlagCondition, context: Record<string, any>): boolean {
    const contextValue = condition.attribute ? context[condition.attribute] : null;

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;

      case 'not_equals':
        return contextValue !== condition.value;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);

      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);

      case 'greater_than':
        return contextValue > condition.value;

      case 'less_than':
        return contextValue < condition.value;

      case 'contains':
        return String(contextValue).includes(String(condition.value));

      case 'matches':
        return new RegExp(condition.value).test(String(contextValue));

      default:
        return false;
    }
  }

  // ========================================================================
  // Schema & Validation
  // ========================================================================

  public setSchema(configId: string, schema: ConfigSchema): void {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    config.schema = schema;

    // Validate existing values
    if (this.config.enableValidation) {
      const errors = this.validateConfiguration(config);
      if (errors.length > 0) {
        this.emit('config:validation:failed', { config, errors });
      }
    }

    this.emit('config:schema:set', { config });
  }

  public validateConfiguration(config: Configuration): ValidationError[] {
    if (!config.schema) return [];

    const errors: ValidationError[] = [];

    // Check required properties
    for (const key of config.schema.required) {
      if (!config.values.has(key)) {
        errors.push({
          key,
          message: `Required property '${key}' is missing`,
        });
      }
    }

    // Validate each value
    for (const [key, configValue] of config.values.entries()) {
      const property = config.schema.properties.get(key);
      if (property) {
        const valueErrors = this.validateValue(key, configValue.value, config.schema);
        errors.push(...valueErrors);
      } else if (!config.schema.additionalProperties) {
        errors.push({
          key,
          message: `Additional property '${key}' is not allowed`,
        });
      }
    }

    return errors;
  }

  private validateValue(
    key: string,
    value: any,
    schema: ConfigSchema
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const property = schema.properties.get(key);

    if (!property) return errors;

    // Type validation
    const actualType = this.getValueType(value);
    const expectedTypes = Array.isArray(property.type) ? property.type : [property.type];

    if (!expectedTypes.includes(actualType)) {
      errors.push({
        key,
        message: `Type mismatch: expected ${expectedTypes.join(' or ')}, got ${actualType}`,
        expected: expectedTypes,
        actual: actualType,
      });
    }

    // Enum validation
    if (property.enum && !property.enum.includes(value)) {
      errors.push({
        key,
        message: `Value must be one of: ${property.enum.join(', ')}`,
        expected: property.enum,
        actual: value,
      });
    }

    // String validations
    if (actualType === 'string') {
      if (property.pattern && !new RegExp(property.pattern).test(value)) {
        errors.push({
          key,
          message: `Value does not match pattern: ${property.pattern}`,
        });
      }

      if (property.minLength !== undefined && value.length < property.minLength) {
        errors.push({
          key,
          message: `String length must be at least ${property.minLength}`,
        });
      }

      if (property.maxLength !== undefined && value.length > property.maxLength) {
        errors.push({
          key,
          message: `String length must be at most ${property.maxLength}`,
        });
      }
    }

    // Number validations
    if (actualType === 'number') {
      if (property.minimum !== undefined && value < property.minimum) {
        errors.push({
          key,
          message: `Value must be at least ${property.minimum}`,
        });
      }

      if (property.maximum !== undefined && value > property.maximum) {
        errors.push({
          key,
          message: `Value must be at most ${property.maximum}`,
        });
      }
    }

    return errors;
  }

  // ========================================================================
  // Versioning
  // ========================================================================

  private createVersion(
    config: Configuration,
    message: string,
    author: string
  ): ConfigVersion {
    const version: ConfigVersion = {
      id: this.generateId(),
      configId: config.id,
      version: this.incrementVersion(config.version),
      values: this.getAll(config.id),
      timestamp: Date.now(),
      author,
      message,
      checksum: this.calculateChecksum(config),
    };

    const versions = this.versions.get(config.id) || [];
    versions.push(version);
    this.versions.set(config.id, versions);

    config.version = version.version;

    this.emit('config:version:created', { config, version });

    return version;
  }

  public getVersions(configId: string): ConfigVersion[] {
    return this.versions.get(configId) || [];
  }

  public restoreVersion(configId: string, versionId: string): void {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`);
    }

    const versions = this.versions.get(configId) || [];
    const version = versions.find(v => v.id === versionId);

    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Restore values
    config.values.clear();
    for (const [key, value] of Object.entries(version.values)) {
      this.set(configId, key, value, { source: 'override' });
    }

    this.emit('config:version:restored', { config, version });
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++;
    return parts.join('.');
  }

  // ========================================================================
  // Watchers
  // ========================================================================

  public watch(keys: string[], callback: (changes: ConfigChange[]) => void): ConfigWatch {
    const watch: ConfigWatch = {
      id: this.generateId(),
      keys,
      callback,
      active: true,
    };

    this.watches.set(watch.id, watch);
    this.emit('watch:created', { watch });

    return watch;
  }

  public unwatch(watchId: string): void {
    const watch = this.watches.get(watchId);
    if (watch) {
      watch.active = false;
      this.watches.delete(watchId);
      this.emit('watch:removed', { watch });
    }
  }

  private notifyWatchers(key: string, oldValue: any, newValue: any): void {
    const change: ConfigChange = {
      key,
      oldValue,
      newValue,
      timestamp: Date.now(),
    };

    for (const watch of this.watches.values()) {
      if (watch.active && watch.keys.includes(key)) {
        try {
          watch.callback([change]);
        } catch (error) {
          this.emit('watch:error', { watch, error });
        }
      }
    }
  }

  // ========================================================================
  // Remote Config
  // ========================================================================

  public registerRemoteSource(source: Omit<RemoteConfigSource, 'id'>): RemoteConfigSource {
    const full: RemoteConfigSource = {
      ...source,
      id: this.generateId(),
    };

    this.remoteSources.set(full.id, full);
    this.emit('remote_source:registered', { source: full });

    return full;
  }

  private startRemoteConfigSync(): void {
    this.syncInterval = setInterval(() => {
      this.syncRemoteConfigs();
    }, this.config.refreshInterval);
  }

  private async syncRemoteConfigs(): Promise<void> {
    for (const source of this.remoteSources.values()) {
      try {
        await this.syncRemoteSource(source);
        source.lastSync = Date.now();
      } catch (error) {
        this.emit('remote_source:sync:error', { source, error });
      }
    }
  }

  private async syncRemoteSource(source: RemoteConfigSource): Promise<void> {
    // In production, fetch from actual remote source
    this.emit('remote_source:sync', { source });
  }

  // ========================================================================
  // Encryption
  // ========================================================================

  private initializeEncryption(): void {
    // In production, use proper key management
    this.encryptionKey = {
      id: this.generateId(),
      algorithm: 'aes-256-gcm',
      key: Buffer.from(Math.random().toString(36).repeat(32)).toString('base64'),
      createdAt: Date.now(),
    };
  }

  private encrypt(value: string): string {
    if (!this.encryptionKey) return value;
    // Simplified encryption - use proper crypto in production
    return Buffer.from(value).toString('base64');
  }

  private decrypt(value: string): string {
    if (!this.encryptionKey) return value;
    // Simplified decryption - use proper crypto in production
    return Buffer.from(value, 'base64').toString();
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private getValueType(value: any): ValueType {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value as ValueType;
  }

  private calculateChecksum(config: Configuration): string {
    const data = JSON.stringify(this.getAll(config.id));
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private generateId(): string {
    return `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats(): ConfigStats {
    return {
      configurations: this.configurations.size,
      totalValues: Array.from(this.configurations.values()).reduce(
        (sum, c) => sum + c.values.size,
        0
      ),
      totalSecrets: Array.from(this.configurations.values()).reduce(
        (sum, c) => sum + c.secrets.size,
        0
      ),
      totalFlags: Array.from(this.configurations.values()).reduce(
        (sum, c) => sum + c.featureFlags.size,
        0
      ),
      watches: this.watches.size,
      remoteSources: this.remoteSources.size,
    };
  }

  public close(): void {
    // Clear sync interval to prevent memory leak
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Clear all data structures
    this.configurations.clear();
    this.versions.clear();
    this.watches.clear();
    this.remoteSources.clear();
    this.cache.clear();

    this.emit('manager:closed');
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface SetOptions {
  encrypted?: boolean;
  source?: ConfigSource;
}

interface ConfigStats {
  configurations: number;
  totalValues: number;
  totalSecrets: number;
  totalFlags: number;
  watches: number;
  remoteSources: number;
}

// ============================================================================
// Export
// ============================================================================

export default ConfigManager;
