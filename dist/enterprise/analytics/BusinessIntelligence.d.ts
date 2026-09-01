/**
 * BusinessIntelligence - Auto-generated comprehensive implementation
 * Part of the 350K lines expansion project
 */
import { EventEmitter } from 'events';
export interface BusinessIntelligenceConfig {
    enabled: boolean;
    timeout: number;
    retries: number;
    batchSize: number;
    concurrency: number;
}
export interface BusinessIntelligenceResult {
    id: string;
    status: 'success' | 'failure' | 'pending';
    data: any;
    timestamp: Date;
    duration: number;
    metadata: Record<string, any>;
}
export declare class BusinessIntelligence extends EventEmitter {
    private config;
    private results;
    private isActive;
    constructor(config?: Partial<BusinessIntelligenceConfig>);
    execute(input: any): Promise<BusinessIntelligenceResult>;
    private processInput;
    start(): void;
    stop(): void;
    getResult(id: string): BusinessIntelligenceResult | null;
    listResults(): BusinessIntelligenceResult[];
    clearResults(): void;
    getStatistics(): any;
}
export default BusinessIntelligence;
//# sourceMappingURL=BusinessIntelligence.d.ts.map