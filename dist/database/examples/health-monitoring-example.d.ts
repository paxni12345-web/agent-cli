/**
 * Connection Pool Health Monitoring Example
 * Demonstrates all health monitoring features
 */
import DatabasePoolManager from '../DatabasePoolManager';
declare function demonstrateHealthMonitoring(): Promise<void>;
declare class PoolHealthDashboard {
    private manager;
    private monitoringInterval;
    constructor(manager: DatabasePoolManager);
    start(intervalMs?: number): void;
    stop(): void;
    private displayDashboard;
    private getStatusEmoji;
    private getCircuitBreakerEmoji;
    private getHealthBar;
}
export { demonstrateHealthMonitoring, PoolHealthDashboard };
//# sourceMappingURL=health-monitoring-example.d.ts.map