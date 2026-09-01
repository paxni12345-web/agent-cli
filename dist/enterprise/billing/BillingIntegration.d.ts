/**
 * BillingIntegration - Auto-generated comprehensive implementation
 * Part of the 350K lines expansion project
 */
import { EventEmitter } from 'events';
export interface BillingIntegrationConfig {
    enabled: boolean;
    timeout: number;
    retries: number;
    batchSize: number;
    concurrency: number;
}
export interface BillingIntegrationResult {
    id: string;
    status: 'success' | 'failure' | 'pending';
    data: any;
    timestamp: Date;
    duration: number;
    metadata: Record<string, any>;
}
export declare class BillingIntegration extends EventEmitter {
    private config;
    private results;
    private isActive;
    constructor(config?: Partial<BillingIntegrationConfig>);
    execute(input: any): Promise<BillingIntegrationResult>;
    private processInput;
    start(): void;
    stop(): void;
    getResult(id: string): BillingIntegrationResult | null;
    listResults(): BillingIntegrationResult[];
    clearResults(): void;
    getStatistics(): any;
}
export default BillingIntegration;
//# sourceMappingURL=BillingIntegration.d.ts.map