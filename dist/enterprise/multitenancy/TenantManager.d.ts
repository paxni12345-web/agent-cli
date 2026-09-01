/**
 * TenantManager - Auto-generated comprehensive implementation
 * Part of the 350K lines expansion project
 */
import { EventEmitter } from 'events';
export interface TenantManagerConfig {
    enabled: boolean;
    timeout: number;
    retries: number;
    batchSize: number;
    concurrency: number;
}
export interface TenantManagerResult {
    id: string;
    status: 'success' | 'failure' | 'pending';
    data: any;
    timestamp: Date;
    duration: number;
    metadata: Record<string, any>;
}
export declare class TenantManager extends EventEmitter {
    private config;
    private results;
    private isActive;
    constructor(config?: Partial<TenantManagerConfig>);
    execute(input: any): Promise<TenantManagerResult>;
    private processInput;
    start(): void;
    stop(): void;
    getResult(id: string): TenantManagerResult | null;
    listResults(): TenantManagerResult[];
    clearResults(): void;
    getStatistics(): any;
}
export default TenantManager;
//# sourceMappingURL=TenantManager.d.ts.map