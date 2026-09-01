export interface RateLimitConfig {
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
    tokensPerDay?: number;
    costPerDay?: number;
}
export interface UsageMetrics {
    userId: string;
    requestCount: number;
    tokenCount: number;
    estimatedCost: number;
    timestamp: Date;
}
export interface QuotaStatus {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: Date;
}
export declare class RateLimiter {
    private requestCounts;
    private tokenCounts;
    private costTracking;
    private config;
    setUserLimits(userId: string, config: RateLimitConfig): void;
    getUserLimits(userId: string): RateLimitConfig;
    checkRateLimit(userId: string): Promise<{
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
    }>;
    recordRequest(userId: string): void;
    recordTokenUsage(userId: string, inputTokens: number, outputTokens: number): void;
    recordCost(userId: string, cost: number): void;
    private estimateCost;
    getQuotaStatus(userId: string): {
        requests: QuotaStatus;
        tokens: QuotaStatus;
        cost: QuotaStatus;
    };
    getUsageMetrics(userId: string): UsageMetrics;
    private getRequestCount;
    private incrementCount;
    private getMinuteKey;
    private getHourKey;
    private getDayKey;
    private getSecondsUntilNextDay;
    cleanup(): void;
    generateReport(userId: string): string;
}
export declare class CostAnalyzer {
    private costHistory;
    recordDailyCost(userId: string, date: Date, cost: number): void;
    getCostTrend(userId: string, days?: number): {
        daily: number[];
        average: number;
        total: number;
        trend: 'increasing' | 'decreasing' | 'stable';
    };
    predictMonthlyCost(userId: string): number;
    getOptimizationSuggestions(userId: string): string[];
}
//# sourceMappingURL=RateLimiter.d.ts.map