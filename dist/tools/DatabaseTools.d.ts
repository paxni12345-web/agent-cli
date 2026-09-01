/**
 * Database Tools - SQL and NoSQL database operations
 * Supports PostgreSQL, MySQL, MongoDB, Redis
 */
import { Tool } from '../types';
export interface DatabaseConfig {
    type: 'postgres' | 'mysql' | 'mongodb' | 'redis';
    host: string;
    port: number;
    database?: string;
    username?: string;
    password?: string;
    connectionString?: string;
}
export interface QueryResult {
    rows?: any[];
    rowCount?: number;
    fields?: string[];
    executionTime?: number;
}
/**
 * Database connection interface
 */
export interface DatabaseConnection {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query(sql: string, params?: any[]): Promise<QueryResult>;
    isConnected(): boolean;
}
/**
 * SQL Query Builder Tool
 */
export declare const SQLQueryTool: Tool;
/**
 * Database Schema Inspector Tool
 */
export declare const InspectSchemaTool: Tool;
/**
 * MongoDB Query Tool
 */
export declare const MongoQueryTool: Tool;
/**
 * Redis Operations Tool
 */
export declare const RedisTool: Tool;
/**
 * Database Migration Tool
 */
export declare const MigrationTool: Tool;
export declare function registerConnection(id: string, connection: DatabaseConnection): void;
//# sourceMappingURL=DatabaseTools.d.ts.map