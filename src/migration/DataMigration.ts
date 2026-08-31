/**
 * Data Migration System
 * Schema migration, data transformation, and migration history tracking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { eventBus } from '../core/EventBus';

export interface Migration {
  id: string;
  version: number;
  name: string;
  description: string;
  up: (context: MigrationContext) => Promise<void>;
  down: (context: MigrationContext) => Promise<void>;
  timestamp: Date;
}

export interface MigrationContext {
  execute: (query: string, params?: any[]) => Promise<any>;
  getData: (key: string) => any;
  setData: (key: string, value: any) => void;
  log: (message: string) => void;
}

export interface MigrationRecord {
  id: string;
  version: number;
  name: string;
  appliedAt: Date;
  executionTime: number;
  status: 'success' | 'failed' | 'rolled_back';
  error?: string;
}

export interface MigrationPlan {
  migrations: Migration[];
  direction: 'up' | 'down';
  targetVersion?: number;
}

export interface DataTransformation {
  id: string;
  name: string;
  source: string;
  destination: string;
  transform: (data: any) => Promise<any>;
  validate?: (data: any) => boolean;
}

/**
 * Migration Manager
 */
export class MigrationManager {
  private migrations: Map<number, Migration> = new Map();
  private history: MigrationRecord[] = [];
  private currentVersion = 0;

  /**
   * Register migration
   */
  register(migration: Migration): void {
    if (this.migrations.has(migration.version)) {
      throw new Error(`Migration version ${migration.version} already exists`);
    }

    this.migrations.set(migration.version, migration);

    eventBus.emitSync('migration.registered', migration, 'MigrationManager');
  }

  /**
   * Register multiple migrations
   */
  registerAll(migrations: Migration[]): void {
    for (const migration of migrations) {
      this.register(migration);
    }
  }

  /**
   * Get current version
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): Migration[] {
    return Array.from(this.migrations.values())
      .filter(m => m.version > this.currentVersion)
      .sort((a, b) => a.version - b.version);
  }

  /**
   * Create migration plan
   */
  createPlan(targetVersion?: number): MigrationPlan {
    const allMigrations = Array.from(this.migrations.values()).sort(
      (a, b) => a.version - b.version
    );

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
      const pending = allMigrations.filter(
        m => m.version > this.currentVersion && m.version <= targetVersion
      );
      return {
        migrations: pending,
        direction: 'up',
        targetVersion,
      };
    } else if (targetVersion < this.currentVersion) {
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
  async executePlan(plan: MigrationPlan): Promise<void> {
    for (const migration of plan.migrations) {
      await this.executeMigration(migration, plan.direction);
    }

    eventBus.emitSync('migration.plan_completed', plan, 'MigrationManager');
  }

  /**
   * Execute single migration
   */
  async executeMigration(migration: Migration, direction: 'up' | 'down'): Promise<void> {
    const startTime = Date.now();

    const context: MigrationContext = {
      execute: async (query: string, params?: any[]) => {
        // Mock database execution
        console.log(`Executing: ${query}`, params);
        return { affectedRows: 1 };
      },
      getData: (key: string) => {
        return (migration as any)[`_data_${key}`];
      },
      setData: (key: string, value: any) => {
        (migration as any)[`_data_${key}`] = value;
      },
      log: (message: string) => {
        console.log(`[Migration ${migration.version}] ${message}`);
      },
    };

    try {
      if (direction === 'up') {
        await migration.up(context);
        this.currentVersion = migration.version;
      } else {
        await migration.down(context);
        this.currentVersion = migration.version - 1;
      }

      const record: MigrationRecord = {
        id: migration.id,
        version: migration.version,
        name: migration.name,
        appliedAt: new Date(),
        executionTime: Date.now() - startTime,
        status: 'success',
      };

      this.history.push(record);

      eventBus.emitSync('migration.executed', { migration, direction, record }, 'MigrationManager');
    } catch (error) {
      const record: MigrationRecord = {
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
  async migrateToLatest(): Promise<void> {
    const plan = this.createPlan();
    await this.executePlan(plan);
  }

  /**
   * Migrate to specific version
   */
  async migrateTo(version: number): Promise<void> {
    const plan = this.createPlan(version);
    await this.executePlan(plan);
  }

  /**
   * Rollback last migration
   */
  async rollbackLast(): Promise<void> {
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
  async rollbackTo(version: number): Promise<void> {
    const plan = this.createPlan(version);
    await this.executePlan(plan);
  }

  /**
   * Get migration history
   */
  getHistory(filter?: {
    status?: MigrationRecord['status'];
    limit?: number;
  }): MigrationRecord[] {
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
  getStatus(): {
    currentVersion: number;
    pendingCount: number;
    appliedCount: number;
    failedCount: number;
  } {
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
  static generateMigrationFile(name: string): string {
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

/**
 * Data Transformer
 */
export class DataTransformer {
  private transformations: Map<string, DataTransformation> = new Map();

  /**
   * Register transformation
   */
  register(transformation: DataTransformation): void {
    this.transformations.set(transformation.id, transformation);
    eventBus.emitSync('transformation.registered', transformation, 'DataTransformer');
  }

  /**
   * Transform data
   */
  async transform(transformationId: string, data: any): Promise<any> {
    const transformation = this.transformations.get(transformationId);

    if (!transformation) {
      throw new Error(`Transformation not found: ${transformationId}`);
    }

    // Validate input
    if (transformation.validate && !transformation.validate(data)) {
      throw new Error('Data validation failed');
    }

    const result = await transformation.transform(data);

    eventBus.emitSync('transformation.completed', {
      transformationId,
      source: transformation.source,
      destination: transformation.destination,
    }, 'DataTransformer');

    return result;
  }

  /**
   * Batch transform
   */
  async transformBatch(
    transformationId: string,
    dataArray: any[],
    batchSize = 100
  ): Promise<any[]> {
    const results: any[] = [];

    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(data => this.transform(transformationId, data))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get transformation
   */
  getTransformation(id: string): DataTransformation | undefined {
    return this.transformations.get(id);
  }

  /**
   * List transformations
   */
  listTransformations(): DataTransformation[] {
    return Array.from(this.transformations.values());
  }
}

/**
 * Schema Migrator
 */
export class SchemaMigrator {
  /**
   * Generate schema diff
   */
  static generateDiff(oldSchema: any, newSchema: any): SchemaDiff {
    const diff: SchemaDiff = {
      added: [],
      removed: [],
      modified: [],
    };

    // Find added and modified
    for (const [key, value] of Object.entries(newSchema)) {
      if (!(key in oldSchema)) {
        diff.added.push({ key, value });
      } else if (JSON.stringify(oldSchema[key]) !== JSON.stringify(value)) {
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
  static async applyDiff(diff: SchemaDiff, context: MigrationContext): Promise<void> {
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

  private static typeToSQL(type: any): string {
    if (typeof type === 'string') return type;
    if (type.type === 'string') return 'VARCHAR(255)';
    if (type.type === 'number') return 'INTEGER';
    if (type.type === 'boolean') return 'BOOLEAN';
    if (type.type === 'date') return 'TIMESTAMP';
    return 'TEXT';
  }
}

interface SchemaDiff {
  added: Array<{ key: string; value: any }>;
  removed: Array<{ key: string; value: any }>;
  modified: Array<{ key: string; oldValue: any; newValue: any }>;
}

/**
 * Migration Builder - fluent API for creating migrations
 */
export class MigrationBuilder {
  private migration: Partial<Migration> = {
    timestamp: new Date(),
  };

  private upSteps: Array<(context: MigrationContext) => Promise<void>> = [];
  private downSteps: Array<(context: MigrationContext) => Promise<void>> = [];

  /**
   * Set migration metadata
   */
  metadata(id: string, version: number, name: string, description: string): this {
    this.migration.id = id;
    this.migration.version = version;
    this.migration.name = name;
    this.migration.description = description;
    return this;
  }

  /**
   * Add table
   */
  createTable(tableName: string, columns: Record<string, string>): this {
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
  dropTable(tableName: string): this {
    this.upSteps.push(async (context) => {
      await context.execute(`DROP TABLE ${tableName}`);
      context.log(`Dropped table: ${tableName}`);
    });

    return this;
  }

  /**
   * Add column
   */
  addColumn(tableName: string, columnName: string, type: string): this {
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
  up(step: (context: MigrationContext) => Promise<void>): this {
    this.upSteps.push(step);
    return this;
  }

  /**
   * Custom down step
   */
  down(step: (context: MigrationContext) => Promise<void>): this {
    this.downSteps.push(step);
    return this;
  }

  /**
   * Build migration
   */
  build(): Migration {
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
    } as Migration;
  }
}

/**
 * Singleton instances
 */
export const migrationManager = new MigrationManager();
export const dataTransformer = new DataTransformer();
