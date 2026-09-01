"use strict";
/**
 * Advanced Configuration Management System
 * Multi-environment configuration, secrets management, feature flags
 * Dynamic configuration updates, validation, versioning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const events_1 = require("events");
// ============================================================================
// Configuration Manager
// ============================================================================
class ConfigManager extends events_1.EventEmitter {
    config;
    configurations = new Map();
    versions = new Map();
    watches = new Map();
    remoteSources = new Map();
    encryptionKey;
    cache = new Map();
    syncInterval = null;
    constructor(config = {}) {
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
    createConfiguration(name, environment = this.config.defaultEnvironment) {
        const configuration = {
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
    getConfiguration(id) {
        return this.configurations.get(id);
    }
    getConfigurationByEnvironment(environment) {
        return Array.from(this.configurations.values()).find(c => c.environment === environment && c.state === 'active');
    }
    // ========================================================================
    // Value Management
    // ========================================================================
    set(configId, key, value, options = {}) {
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
        const configValue = {
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
    get(configId, key, defaultValue) {
        // Check cache first
        const cacheKey = `${configId}:${key}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        const config = this.configurations.get(configId);
        if (!config) {
            return defaultValue;
        }
        const configValue = config.values.get(key);
        if (!configValue) {
            return defaultValue;
        }
        let value = configValue.value;
        // Decrypt if encrypted
        if (configValue.encrypted) {
            value = this.decrypt(value);
        }
        // Cache the value
        this.cache.set(cacheKey, value);
        return value;
    }
    has(configId, key) {
        const config = this.configurations.get(configId);
        return config ? config.values.has(key) : false;
    }
    delete(configId, key) {
        const config = this.configurations.get(configId);
        if (!config)
            return;
        const oldValue = config.values.get(key);
        config.values.delete(key);
        config.metadata.updatedAt = Date.now();
        this.emit('config:value:deleted', { config, key });
        // Notify watchers
        this.notifyWatchers(key, oldValue?.value, undefined);
        // Clear cache
        this.cache.delete(`${configId}:${key}`);
    }
    getAll(configId) {
        const config = this.configurations.get(configId);
        if (!config)
            return {};
        const result = {};
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
    setSecret(configId, key, value, metadata) {
        const config = this.configurations.get(configId);
        if (!config) {
            throw new Error(`Configuration not found: ${configId}`);
        }
        const secret = {
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
    getSecret(configId, key) {
        const config = this.configurations.get(configId);
        if (!config)
            return undefined;
        const secret = config.secrets.get(key);
        if (!secret)
            return undefined;
        // Update access metadata
        secret.metadata.accessCount++;
        secret.metadata.lastAccessed = Date.now();
        return this.decrypt(secret.value);
    }
    rotateSecret(configId, key, newValue) {
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
    setFeatureFlag(configId, key, enabled, options = {}) {
        const config = this.configurations.get(configId);
        if (!config) {
            throw new Error(`Configuration not found: ${configId}`);
        }
        const flag = {
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
    isFeatureEnabled(configId, key, context) {
        const config = this.configurations.get(configId);
        if (!config)
            return false;
        const flag = config.featureFlags.get(key);
        if (!flag)
            return false;
        if (!flag.enabled)
            return false;
        // Check rollout percentage
        if (flag.rolloutPercentage !== undefined) {
            const random = Math.random() * 100;
            if (random > flag.rolloutPercentage)
                return false;
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
    getFeatureFlagVariant(configId, key, context) {
        if (!this.isFeatureEnabled(configId, key, context)) {
            return null;
        }
        const config = this.configurations.get(configId);
        if (!config)
            return null;
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
    evaluateCondition(condition, context) {
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
    setSchema(configId, schema) {
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
    validateConfiguration(config) {
        if (!config.schema)
            return [];
        const errors = [];
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
            }
            else if (!config.schema.additionalProperties) {
                errors.push({
                    key,
                    message: `Additional property '${key}' is not allowed`,
                });
            }
        }
        return errors;
    }
    validateValue(key, value, schema) {
        const errors = [];
        const property = schema.properties.get(key);
        if (!property)
            return errors;
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
    createVersion(config, message, author) {
        const version = {
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
    getVersions(configId) {
        return this.versions.get(configId) || [];
    }
    restoreVersion(configId, versionId) {
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
    incrementVersion(version) {
        const parts = version.split('.').map(Number);
        parts[2]++;
        return parts.join('.');
    }
    // ========================================================================
    // Watchers
    // ========================================================================
    watch(keys, callback) {
        const watch = {
            id: this.generateId(),
            keys,
            callback,
            active: true,
        };
        this.watches.set(watch.id, watch);
        this.emit('watch:created', { watch });
        return watch;
    }
    unwatch(watchId) {
        const watch = this.watches.get(watchId);
        if (watch) {
            watch.active = false;
            this.watches.delete(watchId);
            this.emit('watch:removed', { watch });
        }
    }
    notifyWatchers(key, oldValue, newValue) {
        const change = {
            key,
            oldValue,
            newValue,
            timestamp: Date.now(),
        };
        for (const watch of this.watches.values()) {
            if (watch.active && watch.keys.includes(key)) {
                try {
                    watch.callback([change]);
                }
                catch (error) {
                    this.emit('watch:error', { watch, error });
                }
            }
        }
    }
    // ========================================================================
    // Remote Config
    // ========================================================================
    registerRemoteSource(source) {
        const full = {
            ...source,
            id: this.generateId(),
        };
        this.remoteSources.set(full.id, full);
        this.emit('remote_source:registered', { source: full });
        return full;
    }
    startRemoteConfigSync() {
        this.syncInterval = setInterval(() => {
            this.syncRemoteConfigs();
        }, this.config.refreshInterval);
    }
    async syncRemoteConfigs() {
        for (const source of this.remoteSources.values()) {
            try {
                await this.syncRemoteSource(source);
                source.lastSync = Date.now();
            }
            catch (error) {
                this.emit('remote_source:sync:error', { source, error });
            }
        }
    }
    async syncRemoteSource(source) {
        // In production, fetch from actual remote source
        this.emit('remote_source:sync', { source });
    }
    // ========================================================================
    // Encryption
    // ========================================================================
    initializeEncryption() {
        // In production, use proper key management
        this.encryptionKey = {
            id: this.generateId(),
            algorithm: 'aes-256-gcm',
            key: Buffer.from(Math.random().toString(36).repeat(32)).toString('base64'),
            createdAt: Date.now(),
        };
    }
    encrypt(value) {
        if (!this.encryptionKey)
            return value;
        // Simplified encryption - use proper crypto in production
        return Buffer.from(value).toString('base64');
    }
    decrypt(value) {
        if (!this.encryptionKey)
            return value;
        // Simplified decryption - use proper crypto in production
        return Buffer.from(value, 'base64').toString();
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    getValueType(value) {
        if (value === null)
            return 'null';
        if (Array.isArray(value))
            return 'array';
        return typeof value;
    }
    calculateChecksum(config) {
        const data = JSON.stringify(this.getAll(config.id));
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash) + data.charCodeAt(i);
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    generateId() {
        return `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getStats() {
        return {
            configurations: this.configurations.size,
            totalValues: Array.from(this.configurations.values()).reduce((sum, c) => sum + c.values.size, 0),
            totalSecrets: Array.from(this.configurations.values()).reduce((sum, c) => sum + c.secrets.size, 0),
            totalFlags: Array.from(this.configurations.values()).reduce((sum, c) => sum + c.featureFlags.size, 0),
            watches: this.watches.size,
            remoteSources: this.remoteSources.size,
        };
    }
    close() {
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
exports.ConfigManager = ConfigManager;
// ============================================================================
// Export
// ============================================================================
exports.default = ConfigManager;
