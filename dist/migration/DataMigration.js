"use strict";
/**
 * Data Migration System
 * Schema migration, data transformation, and migration history tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataTransformer = exports.migrationManager = exports.MigrationBuilder = exports.SchemaMigrator = exports.DataTransformer = exports.MigrationManager = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Migration Manager
 */
class MigrationManager {
    migrations = new Map();
    history = [];
    currentVersion = 0;
    /**
     * Register migration
     */
    register(migration) {
        if (this.migrations.has(migration.version)) {
            throw new Error(`Migration version ${migration.version} already exists`);
        }
        this.migrations.set(migration.version, migration);
        EventBus_1.eventBus.emitSync('migration.registered', migration, 'MigrationManager');
    }
    /**
     * Register multiple migrations
     */
    registerAll(migrations) {
        for (const migration of migrations) {
            this.register(migration);
        }
    }
    /**
     * Get current version
     */
    getCurrentVersion() {
        return this.currentVersion;
    }
    /**
     * Get pending migrations
     */
    getPendingMigrations() {
        return Array.from(this.migrations.values())
            .filter(m => m.version > this.currentVersion)
            .sort((a, b) => a.version - b.version);
    }
    /**
     * Create migration plan
     */
    createPlan(targetVersion) {
        const allMigrations = Array.from(this.migrations.values()).sort((a, b) => a.version - b.version);
        if (targetVersion === undefined) {
            // Migrate to latest
            const pending = allMigrations.filter(m => m.version > this.currentVersion);
            return {
                migrations: pending,
                direction: 'up',
            };
        }
        if (targetVersion > this.currentVersion) {
            // Migrate up
            const pending = allMigrations.filter(m => m.version > this.currentVersion && m.version <= targetVersion);
            return {
                migrations: pending,
                direction: 'up',
                targetVersion,
            };
        }
        else if (targetVersion < this.currentVersion) {
            // Migrate down (rollback)
            const toRollback = allMigrations
                .filter(m => m.version > targetVersion && m.version <= this.currentVersion)
                .reverse();
            return {
                migrations: toRollback,
                direction: 'down',
                targetVersion,
            };
        }
        // Already at target version
        return {
            migrations: [],
            direction: 'up',
            targetVersion,
        };
    }
    /**
     * Execute migration plan
     */
    async executePlan(plan) {
        for (const migration of plan.migrations) {
            await this.executeMigration(migration, plan.direction);
        }
        EventBus_1.eventBus.emitSync('migration.plan_completed', plan, 'MigrationManager');
    }
    /**
     * Execute single migration
     */
    async executeMigration(migration, direction) {
        const startTime = Date.now();
        const context = {
            execute: async (query, params) => {
                // Mock database execution
                console.log(`Executing: ${query}`, params);
                return { affectedRows: 1 };
            },
            getData: (key) => {
                return migration[`_data_${key}`];
            },
            setData: (key, value) => {
                migration[`_data_${key}`] = value;
            },
            log: (message) => {
                console.log(`[Migration ${migration.version}] ${message}`);
            },
        };
        try {
            if (direction === 'up') {
                await migration.up(context);
                this.currentVersion = migration.version;
            }
            else {
                await migration.down(context);
                this.currentVersion = migration.version - 1;
            }
            const record = {
                id: migration.id,
                version: migration.version,
                name: migration.name,
                appliedAt: new Date(),
                executionTime: Date.now() - startTime,
                status: 'success',
            };
            this.history.push(record);
            EventBus_1.eventBus.emitSync('migration.executed', { migration, direction, record }, 'MigrationManager');
        }
        catch (error) {
            const record = {
                id: migration.id,
                version: migration.version,
                name: migration.name,
                appliedAt: new Date(),
                executionTime: Date.now() - startTime,
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
            };
            this.history.push(record);
            throw new Error(`Migration ${migration.version} failed: ${record.error}`);
        }
    }
    /**
     * Migrate to latest version
     */
    async migrateToLatest() {
        const plan = this.createPlan();
        await this.executePlan(plan);
    }
    /**
     * Migrate to specific version
     */
    async migrateTo(version) {
        const plan = this.createPlan(version);
        await this.executePlan(plan);
    }
    /**
     * Rollback last migration
     */
    async rollbackLast() {
        if (this.currentVersion === 0) {
            throw new Error('No migrations to rollback');
        }
        const migration = this.migrations.get(this.currentVersion);
        if (!migration) {
            throw new Error(`Migration ${this.currentVersion} not found`);
        }
        await this.executeMigration(migration, 'down');
    }
    /**
     * Rollback to version
     */
    async rollbackTo(version) {
        const plan = this.createPlan(version);
        await this.executePlan(plan);
    }
    /**
     * Get migration history
     */
    getHistory(filter) {
        let history = [...this.history];
        if (filter?.status) {
            history = history.filter(r => r.status === filter.status);
        }
        history.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
        if (filter?.limit) {
            history = history.slice(0, filter.limit);
        }
        return history;
    }
    /**
     * Get migration status
     */
    getStatus() {
        return {
            currentVersion: this.currentVersion,
            pendingCount: this.getPendingMigrations().length,
            appliedCount: this.history.filter(r => r.status === 'success').length,
            failedCount: this.history.filter(r => r.status === 'failed').length,
        };
    }
    /**
     * Generate migration file
     */
    static generateMigrationFile(name) {
        const timestamp = Date.now();
        const version = Math.floor(timestamp / 1000);
        return `
/**
 * Migration: ${name}
 * Version: ${version}
 * Created: ${new Date().toISOString()}
 */

export const migration: Migration = {
  id: 'migration_${version}',
  version: ${version},
  name: '${name}',
  description: 'Migration description',
  timestamp: new Date('${new Date().toISOString()}'),

  async up(context: MigrationContext): Promise<void> {
    context.log('Running migration: ${name}');

    // Add your migration logic here
    // Example: await context.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
  },

  async down(context: MigrationContext): Promise<void> {
    context.log('Rolling back migration: ${name}');

    // Add your rollback logic here
    // Example: await context.execute('ALTER TABLE users DROP COLUMN email');
  },
};
`.trim();
    }
}
exports.MigrationManager = MigrationManager;
/**
 * Data Transformer
 */
class DataTransformer {
    transformations = new Map();
    /**
     * Register transformation
     */
    register(transformation) {
        this.transformations.set(transformation.id, transformation);
        EventBus_1.eventBus.emitSync('transformation.registered', transformation, 'DataTransformer');
    }
    /**
     * Transform data
     */
    async transform(transformationId, data) {
        const transformation = this.transformations.get(transformationId);
        if (!transformation) {
            throw new Error(`Transformation not found: ${transformationId}`);
        }
        // Validate input
        if (transformation.validate && !transformation.validate(data)) {
            throw new Error('Data validation failed');
        }
        const result = await transformation.transform(data);
        EventBus_1.eventBus.emitSync('transformation.completed', {
            transformationId,
            source: transformation.source,
            destination: transformation.destination,
        }, 'DataTransformer');
        return result;
    }
    /**
     * Batch transform
     */
    async transformBatch(transformationId, dataArray, batchSize = 100) {
        const results = [];
        for (let i = 0; i < dataArray.length; i += batchSize) {
            const batch = dataArray.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(data => this.transform(transformationId, data)));
            results.push(...batchResults);
        }
        return results;
    }
    /**
     * Get transformation
     */
    getTransformation(id) {
        return this.transformations.get(id);
    }
    /**
     * List transformations
     */
    listTransformations() {
        return Array.from(this.transformations.values());
    }
}
exports.DataTransformer = DataTransformer;
/**
 * Schema Migrator
 */
class SchemaMigrator {
    /**
     * Generate schema diff
     */
    static generateDiff(oldSchema, newSchema) {
        const diff = {
            added: [],
            removed: [],
            modified: [],
        };
        // Find added and modified
        for (const [key, value] of Object.entries(newSchema)) {
            if (!(key in oldSchema)) {
                diff.added.push({ key, value });
            }
            else if (JSON.stringify(oldSchema[key]) !== JSON.stringify(value)) {
                diff.modified.push({
                    key,
                    oldValue: oldSchema[key],
                    newValue: value,
                });
            }
        }
        // Find removed
        for (const key of Object.keys(oldSchema)) {
            if (!(key in newSchema)) {
                diff.removed.push({ key, value: oldSchema[key] });
            }
        }
        return diff;
    }
    /**
     * Apply schema changes
     */
    static async applyDiff(diff, context) {
        // Apply additions
        for (const { key, value } of diff.added) {
            context.log(`Adding: ${key}`);
            await context.execute(`ALTER TABLE ADD COLUMN ${key} ${this.typeToSQL(value)}`);
        }
        // Apply modifications
        for (const { key, newValue } of diff.modified) {
            context.log(`Modifying: ${key}`);
            await context.execute(`ALTER TABLE MODIFY COLUMN ${key} ${this.typeToSQL(newValue)}`);
        }
        // Apply removals
        for (const { key } of diff.removed) {
            context.log(`Removing: ${key}`);
            await context.execute(`ALTER TABLE DROP COLUMN ${key}`);
        }
    }
    static typeToSQL(type) {
        if (typeof type === 'string')
            return type;
        if (type.type === 'string')
            return 'VARCHAR(255)';
        if (type.type === 'number')
            return 'INTEGER';
        if (type.type === 'boolean')
            return 'BOOLEAN';
        if (type.type === 'date')
            return 'TIMESTAMP';
        return 'TEXT';
    }
}
exports.SchemaMigrator = SchemaMigrator;
/**
 * Migration Builder - fluent API for creating migrations
 */
class MigrationBuilder {
    migration = {
        timestamp: new Date(),
    };
    upSteps = [];
    downSteps = [];
    /**
     * Set migration metadata
     */
    metadata(id, version, name, description) {
        this.migration.id = id;
        this.migration.version = version;
        this.migration.name = name;
        this.migration.description = description;
        return this;
    }
    /**
     * Add table
     */
    createTable(tableName, columns) {
        this.upSteps.push(async (context) => {
            const columnDefs = Object.entries(columns)
                .map(([name, type]) => `${name} ${type}`)
                .join(', ');
            await context.execute(`CREATE TABLE ${tableName} (${columnDefs})`);
            context.log(`Created table: ${tableName}`);
        });
        this.downSteps.push(async (context) => {
            await context.execute(`DROP TABLE ${tableName}`);
            context.log(`Dropped table: ${tableName}`);
        });
        return this;
    }
    /**
     * Drop table
     */
    dropTable(tableName) {
        this.upSteps.push(async (context) => {
            await context.execute(`DROP TABLE ${tableName}`);
            context.log(`Dropped table: ${tableName}`);
        });
        return this;
    }
    /**
     * Add column
     */
    addColumn(tableName, columnName, type) {
        this.upSteps.push(async (context) => {
            await context.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${type}`);
            context.log(`Added column ${columnName} to ${tableName}`);
        });
        this.downSteps.push(async (context) => {
            await context.execute(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
            context.log(`Removed column ${columnName} from ${tableName}`);
        });
        return this;
    }
    /**
     * Custom up step
     */
    up(step) {
        this.upSteps.push(step);
        return this;
    }
    /**
     * Custom down step
     */
    down(step) {
        this.downSteps.push(step);
        return this;
    }
    /**
     * Build migration
     */
    build() {
        if (!this.migration.id || !this.migration.version || !this.migration.name) {
            throw new Error('Migration metadata is incomplete');
        }
        return {
            ...this.migration,
            up: async (context) => {
                for (const step of this.upSteps) {
                    await step(context);
                }
            },
            down: async (context) => {
                for (const step of this.downSteps.reverse()) {
                    await step(context);
                }
            },
        };
    }
}
exports.MigrationBuilder = MigrationBuilder;
/**
 * Singleton instances
 */
exports.migrationManager = new MigrationManager();
exports.dataTransformer = new DataTransformer();
