/**
 * Data Migration System
 * Schema migration, data transformation, and migration history tracking
 */
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
export declare class MigrationManager {
    private migrations;
    private history;
    private currentVersion;
    /**
     * Register migration
     */
    register(migration: Migration): void;
    /**
     * Register multiple migrations
     */
    registerAll(migrations: Migration[]): void;
    /**
     * Get current version
     */
    getCurrentVersion(): number;
    /**
     * Get pending migrations
     */
    getPendingMigrations(): Migration[];
    /**
     * Create migration plan
     */
    createPlan(targetVersion?: number): MigrationPlan;
    /**
     * Execute migration plan
     */
    executePlan(plan: MigrationPlan): Promise<void>;
    /**
     * Execute single migration
     */
    executeMigration(migration: Migration, direction: 'up' | 'down'): Promise<void>;
    /**
     * Migrate to latest version
     */
    migrateToLatest(): Promise<void>;
    /**
     * Migrate to specific version
     */
    migrateTo(version: number): Promise<void>;
    /**
     * Rollback last migration
     */
    rollbackLast(): Promise<void>;
    /**
     * Rollback to version
     */
    rollbackTo(version: number): Promise<void>;
    /**
     * Get migration history
     */
    getHistory(filter?: {
        status?: MigrationRecord['status'];
        limit?: number;
    }): MigrationRecord[];
    /**
     * Get migration status
     */
    getStatus(): {
        currentVersion: number;
        pendingCount: number;
        appliedCount: number;
        failedCount: number;
    };
    /**
     * Generate migration file
     */
    static generateMigrationFile(name: string): string;
}
/**
 * Data Transformer
 */
export declare class DataTransformer {
    private transformations;
    /**
     * Register transformation
     */
    register(transformation: DataTransformation): void;
    /**
     * Transform data
     */
    transform(transformationId: string, data: any): Promise<any>;
    /**
     * Batch transform
     */
    transformBatch(transformationId: string, dataArray: any[], batchSize?: number): Promise<any[]>;
    /**
     * Get transformation
     */
    getTransformation(id: string): DataTransformation | undefined;
    /**
     * List transformations
     */
    listTransformations(): DataTransformation[];
}
/**
 * Schema Migrator
 */
export declare class SchemaMigrator {
    /**
     * Generate schema diff
     */
    static generateDiff(oldSchema: any, newSchema: any): SchemaDiff;
    /**
     * Apply schema changes
     */
    static applyDiff(diff: SchemaDiff, context: MigrationContext): Promise<void>;
    private static typeToSQL;
}
interface SchemaDiff {
    added: Array<{
        key: string;
        value: any;
    }>;
    removed: Array<{
        key: string;
        value: any;
    }>;
    modified: Array<{
        key: string;
        oldValue: any;
        newValue: any;
    }>;
}
/**
 * Migration Builder - fluent API for creating migrations
 */
export declare class MigrationBuilder {
    private migration;
    private upSteps;
    private downSteps;
    /**
     * Set migration metadata
     */
    metadata(id: string, version: number, name: string, description: string): this;
    /**
     * Add table
     */
    createTable(tableName: string, columns: Record<string, string>): this;
    /**
     * Drop table
     */
    dropTable(tableName: string): this;
    /**
     * Add column
     */
    addColumn(tableName: string, columnName: string, type: string): this;
    /**
     * Custom up step
     */
    up(step: (context: MigrationContext) => Promise<void>): this;
    /**
     * Custom down step
     */
    down(step: (context: MigrationContext) => Promise<void>): this;
    /**
     * Build migration
     */
    build(): Migration;
}
/**
 * Singleton instances
 */
export declare const migrationManager: MigrationManager;
export declare const dataTransformer: DataTransformer;
export {};
//# sourceMappingURL=DataMigration.d.ts.map