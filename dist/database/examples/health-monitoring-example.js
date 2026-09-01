"use strict";
/**
 * Connection Pool Health Monitoring Example
 * Demonstrates all health monitoring features
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolHealthDashboard = void 0;
exports.demonstrateHealthMonitoring = demonstrateHealthMonitoring;
const DatabasePoolManager_1 = __importDefault(require("../DatabasePoolManager"));
async function demonstrateHealthMonitoring() {
    const manager = new DatabasePoolManager_1.default();
    console.log('='.repeat(80));
    console.log('Connection Pool Health Monitoring Demo');
    console.log('='.repeat(80));
    // ========================================================================
    // 1. Register Database with Health Monitoring Configuration
    // ========================================================================
    console.log('\n1. Registering database with health monitoring...');
    await manager.registerDatabase({
        id: 'production-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'myapp',
        username: 'appuser',
        password: 'password',
        poolConfig: {
            min: 2,
            max: 10,
            acquireTimeout: 30000,
            idleTimeout: 600000,
            testOnBorrow: true,
            testOnReturn: false,
            testWhileIdle: true,
            validationQuery: 'SELECT 1',
            leakDetectionThreshold: 300000, // 5 minutes
            exhaustionAlertThreshold: 0.9, // Alert at 90% utilization
            healthCheck: {
                enabled: true,
                interval: 30000, // Check every 30 seconds
                timeout: 5000,
                healthyThreshold: 3,
                unhealthyThreshold: 3,
                query: 'SELECT 1',
            },
            circuitBreaker: {
                enabled: true,
                failureThreshold: 5,
                successThreshold: 2,
                timeout: 60000,
                halfOpenMaxAttempts: 3,
            },
        },
    });
    console.log('✓ Database registered with health monitoring enabled');
    // ========================================================================
    // 2. Connection Validation Before Use
    // ========================================================================
    console.log('\n2. Testing connection validation before use...');
    manager.on('connection:validation_failed', (event) => {
        console.log(`⚠ Connection validation failed: ${event.connectionId}`);
        console.log(`  Failures: ${event.failures}`);
    });
    try {
        const result = await manager.query('production-db', 'SELECT NOW() as current_time');
        console.log('✓ Connection validated and query executed successfully');
        console.log(`  Result: ${JSON.stringify(result.rows[0])}`);
    }
    catch (error) {
        console.error('✗ Query failed:', error);
    }
    // ========================================================================
    // 3. Health Check Monitoring
    // ========================================================================
    console.log('\n3. Setting up health check monitoring...');
    manager.on('pool:health_check', (event) => {
        const { status, duration } = event;
        console.log(`\n[Health Check] Pool: ${event.databaseId}`);
        console.log(`  Status: ${status.status}`);
        console.log(`  Health Score: ${status.healthScore}/100`);
        console.log(`  Duration: ${duration}ms`);
        if (status.issues.length > 0) {
            console.log(`  Issues:`);
            status.issues.forEach(issue => console.log(`    - ${issue}`));
        }
    });
    manager.on('pool:health_status_changed', (event) => {
        console.log(`\n[Status Change] ${event.databaseId}`);
        console.log(`  ${event.previousStatus} → ${event.currentStatus}`);
        console.log(`  Health Score: ${event.healthScore}/100`);
    });
    manager.on('pool:health_alert', (event) => {
        console.log(`\n🚨 [HEALTH ALERT] ${event.databaseId}`);
        console.log(`  Severity: ${event.severity}`);
        console.log(`  Health Score: ${event.healthScore}/100`);
        console.log(`  Issues:`);
        event.issues.forEach(issue => console.log(`    - ${issue}`));
    });
    console.log('✓ Health check monitoring configured');
    // Force an immediate health check
    await manager.forceHealthCheck('production-db');
    const health = manager.getPoolHealth('production-db');
    console.log(`\nCurrent Health Status: ${health?.status}`);
    // ========================================================================
    // 4. Connection Leak Detection
    // ========================================================================
    console.log('\n4. Demonstrating connection leak detection...');
    manager.on('pool:connection_leak_detected', (event) => {
        console.log(`\n⚠ [LEAK DETECTED] ${event.databaseId}`);
        console.log(`  Total leaks: ${event.leaks.length}`);
        event.leaks.forEach((leak, i) => {
            console.log(`\n  Leak #${i + 1}:`);
            console.log(`    Connection: ${leak.connectionId}`);
            console.log(`    Duration: ${Math.round(leak.duration / 1000)}s`);
            console.log(`    Acquired by: ${leak.acquiredBy}`);
            if (leak.stackTrace) {
                console.log(`    Stack trace:\n${leak.stackTrace}`);
            }
        });
    });
    // Simulate a potential leak by starting a transaction and not completing it
    console.log('Starting a long-running transaction (potential leak)...');
    const transaction = await manager.beginTransaction('production-db');
    console.log(`✓ Transaction started: ${transaction.id}`);
    console.log('  (This will be detected as a leak if held too long)');
    // ========================================================================
    // 5. Pool Statistics Tracking
    // ========================================================================
    console.log('\n5. Pool statistics tracking...');
    const stats = manager.getPoolStats('production-db');
    if (stats) {
        console.log('\nCurrent Pool Statistics:');
        console.log(`  Total Connections: ${stats.totalConnections}`);
        console.log(`  Idle Connections: ${stats.idleConnections}`);
        console.log(`  Active Connections: ${stats.activeConnections}`);
        console.log(`  Waiting Requests: ${stats.waitingRequests}`);
        console.log(`  Total Queries: ${stats.totalQueries}`);
        console.log(`  Failed Queries: ${stats.failedQueries}`);
        console.log(`  Average Query Time: ${stats.averageQueryTime.toFixed(2)}ms`);
        console.log(`  Connection Leaks: ${stats.connectionLeaks}`);
        console.log(`  Validation Failures: ${stats.validationFailures}`);
        console.log(`  Reconnection Attempts: ${stats.reconnectionAttempts}`);
        console.log(`  Circuit Breaker State: ${stats.circuitBreakerState}`);
        console.log(`  Health Status: ${stats.healthStatus.status} (${stats.healthStatus.healthScore}/100)`);
    }
    // ========================================================================
    // 6. Pool Exhaustion Alerts
    // ========================================================================
    console.log('\n6. Pool exhaustion monitoring...');
    manager.on('pool:exhaustion_alert', (event) => {
        console.log(`\n🚨 [POOL EXHAUSTION] ${event.databaseId}`);
        console.log(`  Utilization: ${(event.utilization * 100).toFixed(1)}%`);
        console.log(`  Connections: ${event.totalConnections}/${event.maxConnections}`);
        console.log(`  Waiting Requests: ${event.waitingRequests}`);
    });
    console.log('✓ Exhaustion alerts configured');
    // ========================================================================
    // 7. Circuit Breaker Pattern
    // ========================================================================
    console.log('\n7. Circuit breaker monitoring...');
    manager.on('circuit_breaker:opened', (event) => {
        console.log(`\n⚠ [CIRCUIT BREAKER OPENED] ${event.databaseId}`);
        console.log(`  Failures: ${event.failures}/${event.threshold}`);
    });
    manager.on('circuit_breaker:half_open', (event) => {
        console.log(`\n[CIRCUIT BREAKER HALF-OPEN] ${event.databaseId}`);
        console.log(`  Attempting recovery...`);
    });
    manager.on('circuit_breaker:closed', (event) => {
        console.log(`\n✓ [CIRCUIT BREAKER CLOSED] ${event.databaseId}`);
        console.log(`  Successes: ${event.successes}`);
    });
    const cbState = manager.getCircuitBreakerState('production-db');
    console.log(`Current Circuit Breaker State: ${cbState}`);
    // ========================================================================
    // 8. Automatic Reconnection
    // ========================================================================
    console.log('\n8. Automatic reconnection monitoring...');
    manager.on('connection:reconnected', (event) => {
        console.log(`\n✓ [RECONNECTED] ${event.connectionId}`);
    });
    manager.on('connection:reconnection_failed', (event) => {
        console.log(`\n✗ [RECONNECTION FAILED] ${event.connectionId}`);
        console.log(`  Error: ${event.error}`);
    });
    console.log('✓ Reconnection monitoring configured');
    // ========================================================================
    // 9. Graceful Degradation
    // ========================================================================
    console.log('\n9. Checking graceful degradation status...');
    const isHealthy = manager.isPoolHealthy('production-db');
    console.log(`Pool is ${isHealthy ? 'healthy' : 'unhealthy or degraded'}`);
    if (!isHealthy) {
        console.log('Pool is in degraded mode - implementing fallback strategies');
    }
    // ========================================================================
    // 10. Multiple Database Monitoring
    // ========================================================================
    console.log('\n10. Monitoring multiple databases...');
    // Register another database
    await manager.registerDatabase({
        id: 'analytics-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5433,
        database: 'analytics',
        username: 'analytics',
        password: 'password',
        poolConfig: {
            min: 1,
            max: 5,
            healthCheck: {
                enabled: true,
                interval: 60000,
                timeout: 5000,
                healthyThreshold: 3,
                unhealthyThreshold: 3,
                query: 'SELECT 1',
            },
        },
    });
    console.log('✓ Multiple databases registered');
    // Get health status for all pools
    const allHealth = manager.getAllPoolHealth();
    console.log('\nHealth Status for All Pools:');
    allHealth.forEach((health, dbId) => {
        console.log(`  ${dbId}: ${health.status} (${health.healthScore}/100)`);
    });
    // Get statistics for all pools
    const allStats = manager.getAllPoolStats();
    console.log('\nStatistics for All Pools:');
    allStats.forEach((stats, dbId) => {
        console.log(`  ${dbId}:`);
        console.log(`    Connections: ${stats.activeConnections}/${stats.totalConnections}`);
        console.log(`    Circuit Breaker: ${stats.circuitBreakerState}`);
    });
    // Get all connection leaks
    const allLeaks = manager.getAllConnectionLeaks();
    console.log(`\nTotal Connection Leaks Across All Pools: ${Array.from(allLeaks.values()).reduce((sum, leaks) => sum + leaks.length, 0)}`);
    // ========================================================================
    // 11. Manual Operations
    // ========================================================================
    console.log('\n11. Manual health management operations...');
    // Force health check
    console.log('Forcing immediate health check...');
    await manager.forceHealthCheck('production-db');
    console.log('✓ Health check completed');
    // Reset circuit breaker
    console.log('Resetting circuit breaker...');
    manager.resetCircuitBreaker('production-db');
    console.log('✓ Circuit breaker reset');
    // ========================================================================
    // Cleanup
    // ========================================================================
    console.log('\n12. Cleanup and final statistics...');
    // Commit the transaction we started earlier
    await manager.commitTransaction(transaction.id);
    console.log('✓ Transaction committed');
    // Final statistics
    const finalStats = manager.getPoolStats('production-db');
    console.log('\nFinal Pool Statistics:');
    console.log(`  Total Queries: ${finalStats?.totalQueries}`);
    console.log(`  Failed Queries: ${finalStats?.failedQueries}`);
    console.log(`  Success Rate: ${finalStats?.totalQueries
        ? ((1 - finalStats.failedQueries / finalStats.totalQueries) * 100).toFixed(2)
        : 0}%`);
    // Close manager
    await manager.close();
    console.log('\n✓ Database pool manager closed');
    console.log('\n' + '='.repeat(80));
    console.log('Health Monitoring Demo Complete');
    console.log('='.repeat(80));
}
// ============================================================================
// Monitoring Dashboard Example
// ============================================================================
class PoolHealthDashboard {
    manager;
    monitoringInterval = null;
    constructor(manager) {
        this.manager = manager;
    }
    start(intervalMs = 5000) {
        console.log('\n' + '='.repeat(80));
        console.log('Pool Health Dashboard Started');
        console.log('='.repeat(80));
        this.monitoringInterval = setInterval(() => {
            this.displayDashboard();
        }, intervalMs);
        // Display immediately
        this.displayDashboard();
    }
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        console.log('\nPool Health Dashboard Stopped');
    }
    displayDashboard() {
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] Pool Health Dashboard`);
        console.log('-'.repeat(80));
        const allStats = this.manager.getAllPoolStats();
        const allHealth = this.manager.getAllPoolHealth();
        allStats.forEach((stats, dbId) => {
            const health = allHealth.get(dbId);
            console.log(`\n${dbId}:`);
            console.log(`  Status: ${this.getStatusEmoji(health?.status)} ${health?.status || 'unknown'}`);
            console.log(`  Health Score: ${this.getHealthBar(health?.healthScore || 0)} ${health?.healthScore || 0}/100`);
            console.log(`  Connections: ${stats.activeConnections} active, ${stats.idleConnections} idle, ${stats.totalConnections} total (max: ${stats.totalConnections})`);
            console.log(`  Waiting: ${stats.waitingRequests} requests`);
            console.log(`  Queries: ${stats.totalQueries} total, ${stats.failedQueries} failed`);
            console.log(`  Circuit Breaker: ${this.getCircuitBreakerEmoji(stats.circuitBreakerState)} ${stats.circuitBreakerState}`);
            console.log(`  Leaks: ${stats.connectionLeaks} detected`);
            if (health && health.issues.length > 0) {
                console.log(`  Issues:`);
                health.issues.forEach(issue => console.log(`    ⚠ ${issue}`));
            }
        });
        console.log('\n' + '-'.repeat(80));
    }
    getStatusEmoji(status) {
        switch (status) {
            case 'healthy': return '✅';
            case 'degraded': return '⚠️';
            case 'critical': return '🔴';
            case 'down': return '💀';
            default: return '❓';
        }
    }
    getCircuitBreakerEmoji(state) {
        switch (state) {
            case 'closed': return '✅';
            case 'half_open': return '⚠️';
            case 'open': return '🔴';
            default: return '❓';
        }
    }
    getHealthBar(score) {
        const barLength = 20;
        const filled = Math.round((score / 100) * barLength);
        const empty = barLength - filled;
        return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    }
}
exports.PoolHealthDashboard = PoolHealthDashboard;
// ============================================================================
// Run Examples
// ============================================================================
if (require.main === module) {
    demonstrateHealthMonitoring().catch(console.error);
}
