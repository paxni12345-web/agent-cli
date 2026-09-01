/**
 * Advanced Configuration Management System
 * Multi-environment configuration, secrets management, feature flags
 * Dynamic configuration updates, validation, versioning
 */
import { EventEmitter } from 'events';
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
export type ConditionOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'contains' | 'matches';
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
export declare class ConfigManager extends EventEmitter {
    private config;
    private configurations;
    private versions;
    private watches;
    private remoteSources;
    private encryptionKey?;
    private cache;
    private syncInterval;
    constructor(config?: Partial<ConfigManagerConfig>);
    createConfiguration(name: string, environment?: Environment): Configuration;
    getConfiguration(id: string): Configuration | undefined;
    getConfigurationByEnvironment(environment: Environment): Configuration | undefined;
    set(configId: string, key: string, value: any, options?: SetOptions): void;
    get<T = any>(configId: string, key: string, defaultValue?: T): T;
    has(configId: string, key: string): boolean;
    delete(configId: string, key: string): void;
    getAll(configId: string): Record<string, any>;
    setSecret(configId: string, key: string, value: string, metadata?: Partial<SecretMetadata>): void;
    getSecret(configId: string, key: string): string | undefined;
    rotateSecret(configId: string, key: string, newValue: string): void;
    setFeatureFlag(configId: string, key: string, enabled: boolean, options?: Partial<FeatureFlag>): void;
    isFeatureEnabled(configId: string, key: string, context?: Record<string, any>): boolean;
    getFeatureFlagVariant(configId: string, key: string, context?: Record<string, any>): any;
    private evaluateCondition;
    setSchema(configId: string, schema: ConfigSchema): void;
    validateConfiguration(config: Configuration): ValidationError[];
    private validateValue;
    private createVersion;
    getVersions(configId: string): ConfigVersion[];
    restoreVersion(configId: string, versionId: string): void;
    private incrementVersion;
    watch(keys: string[], callback: (changes: ConfigChange[]) => void): ConfigWatch;
    unwatch(watchId: string): void;
    private notifyWatchers;
    registerRemoteSource(source: Omit<RemoteConfigSource, 'id'>): RemoteConfigSource;
    private startRemoteConfigSync;
    private syncRemoteConfigs;
    private syncRemoteSource;
    private initializeEncryption;
    private encrypt;
    private decrypt;
    private getValueType;
    private calculateChecksum;
    private generateId;
    getStats(): ConfigStats;
    close(): void;
}
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
export default ConfigManager;
//# sourceMappingURL=ConfigManager.d.ts.map