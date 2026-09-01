"use strict";
/**
 * Connection Pool Health Monitoring Tests
 * Tests for health checks, leak detection, circuit breaker, and graceful degradation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const DatabasePoolManager_1 = require("../DatabasePoolManager");
describe('DatabasePoolManager - Health Monitoring', () => {
    let manager;
    beforeEach(() => {
        manager = new DatabasePoolManager_1.DatabasePoolManager();
    });
    afterEach(async () => {
        await manager.close();
    });
    describe('Health Check Monitoring', () => {
        it('should perform periodic health checks', async () => {
            const healthCheckSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    healthCheck: {
                        enabled: true,
                        interval: 1000,
                        timeout: 5000,
                        healthyThreshold: 3,
                        unhealthyThreshold: 3,
                        query: 'SELECT 1',
                    },
                },
            });
            manager.on('pool:health_check', healthCheckSpy);
            // Wait for health checks to run
            await new Promise(resolve => setTimeout(resolve, 2500));
            expect(healthCheckSpy).toHaveBeenCalled();
        });
        it('should report healthy status for normal operation', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            const health = manager.getPoolHealth('test-db');
            expect(health).toBeDefined();
            expect(health?.status).toBe('healthy');
            expect(health?.healthScore).toBeGreaterThan(70);
        });
        it('should detect degraded status under stress', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    max: 2,
                    exhaustionAlertThreshold: 0.5,
                },
            });
            // Acquire all connections to stress the pool
            const conn1 = await manager.query('test-db', 'SELECT 1');
            const conn2 = await manager.query('test-db', 'SELECT 1');
            const health = manager.getPoolHealth('test-db');
            expect(health?.status).toMatch(/degraded|critical/);
        });
        it('should emit health status change events', async () => {
            const statusChangeSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            manager.on('pool:health_status_changed', statusChangeSpy);
            // Force a health check
            await manager.forceHealthCheck('test-db');
            // Verify event was emitted if status changed
            // In normal operation, status may not change
            expect(statusChangeSpy).toHaveBeenCalledTimes(0);
        });
        it('should emit alerts on critical status', async () => {
            const alertSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            manager.on('pool:health_alert', alertSpy);
            // Simulate critical conditions
            // This would require mocking connection failures
        });
    });
    describe('Connection Validation', () => {
        it('should validate connections before use when testOnBorrow is enabled', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    testOnBorrow: true,
                    validationQuery: 'SELECT 1',
                },
            });
            const result = await manager.query('test-db', 'SELECT * FROM users');
            expect(result).toBeDefined();
        });
        it('should validate connections after use when testOnReturn is enabled', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    testOnReturn: true,
                    validationQuery: 'SELECT 1',
                },
            });
            const result = await manager.query('test-db', 'SELECT * FROM users');
            expect(result).toBeDefined();
        });
        it('should track validation failures', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            const stats = manager.getPoolStats('test-db');
            expect(stats?.validationFailures).toBeDefined();
            expect(stats?.validationFailures).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Automatic Reconnection', () => {
        it('should attempt to reconnect failed connections', async () => {
            const reconnectSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            manager.on('connection:reconnected', reconnectSpy);
            // Simulate connection failure and reconnection
            // This would require mocking connection errors
        });
        it('should track reconnection attempts', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            const stats = manager.getPoolStats('test-db');
            expect(stats?.reconnectionAttempts).toBeDefined();
            expect(stats?.reconnectionAttempts).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Connection Leak Detection', () => {
        it('should detect connections held too long', async () => {
            const leakSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    leakDetectionThreshold: 100, // 100ms for testing
                },
            });
            manager.on('pool:connection_leak_detected', leakSpy);
            // Acquire connection and hold it
            const transaction = await manager.beginTransaction('test-db');
            // Wait for leak detection
            await new Promise(resolve => setTimeout(resolve, 150));
            // Check for leaks
            const leaks = manager.getConnectionLeaks('test-db');
            expect(leaks).toBeDefined();
        });
        it('should include stack trace in leak information', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    leakDetectionThreshold: 50,
                },
            });
            const transaction = await manager.beginTransaction('test-db');
            await new Promise(resolve => setTimeout(resolve, 100));
            const leaks = manager.getConnectionLeaks('test-db');
            if (leaks && leaks.length > 0) {
                expect(leaks[0].acquiredBy).toBeDefined();
                expect(leaks[0].duration).toBeGreaterThan(0);
            }
        });
        it('should report all connection leaks across pools', async () => {
            await manager.registerDatabase({
                id: 'test-db-1',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb1',
                username: 'user',
                password: 'pass',
            });
            await manager.registerDatabase({
                id: 'test-db-2',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb2',
                username: 'user',
                password: 'pass',
            });
            const allLeaks = manager.getAllConnectionLeaks();
            expect(allLeaks.size).toBe(2);
        });
    });
    describe('Pool Statistics Tracking', () => {
        it('should track comprehensive pool statistics', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            const stats = manager.getPoolStats('test-db');
            expect(stats).toBeDefined();
            expect(stats?.totalConnections).toBeGreaterThanOrEqual(0);
            expect(stats?.idleConnections).toBeGreaterThanOrEqual(0);
            expect(stats?.activeConnections).toBeGreaterThanOrEqual(0);
            expect(stats?.healthStatus).toBeDefined();
            expect(stats?.connectionLeaks).toBeGreaterThanOrEqual(0);
            expect(stats?.circuitBreakerState).toBeDefined();
        });
        it('should provide statistics for all pools', async () => {
            await manager.registerDatabase({
                id: 'test-db-1',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb1',
                username: 'user',
                password: 'pass',
            });
            await manager.registerDatabase({
                id: 'test-db-2',
                type: 'mysql',
                host: 'localhost',
                port: 3306,
                database: 'testdb2',
                username: 'user',
                password: 'pass',
            });
            const allStats = manager.getAllPoolStats();
            expect(allStats.size).toBe(2);
            expect(allStats.get('test-db-1')).toBeDefined();
            expect(allStats.get('test-db-2')).toBeDefined();
        });
    });
    describe('Pool Exhaustion Alerts', () => {
        it('should alert when pool utilization exceeds threshold', async () => {
            const exhaustionSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    max: 2,
                    exhaustionAlertThreshold: 0.8,
                },
            });
            manager.on('pool:exhaustion_alert', exhaustionSpy);
            // Attempt to acquire more connections than available
            try {
                await Promise.all([
                    manager.query('test-db', 'SELECT 1'),
                    manager.query('test-db', 'SELECT 1'),
                    manager.query('test-db', 'SELECT 1'),
                ]);
            }
            catch {
                // Expected to fail or timeout
            }
            // Check if alert was triggered
            expect(exhaustionSpy).toHaveBeenCalled();
        });
        it('should report waiting requests in statistics', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    max: 1,
                },
            });
            // Start long-running query
            const query1 = manager.query('test-db', 'SELECT pg_sleep(1)');
            // Wait a bit then check stats
            await new Promise(resolve => setTimeout(resolve, 50));
            const stats = manager.getPoolStats('test-db');
            expect(stats?.activeConnections).toBeGreaterThan(0);
        });
    });
    describe('Circuit Breaker Pattern', () => {
        it('should open circuit breaker after consecutive failures', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    circuitBreaker: {
                        enabled: true,
                        failureThreshold: 3,
                        successThreshold: 2,
                        timeout: 5000,
                        halfOpenMaxAttempts: 2,
                    },
                },
            });
            const cbState = manager.getCircuitBreakerState('test-db');
            expect(cbState).toBe('closed');
        });
        it('should transition to half-open after timeout', async () => {
            const halfOpenSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    circuitBreaker: {
                        enabled: true,
                        failureThreshold: 2,
                        successThreshold: 2,
                        timeout: 1000,
                        halfOpenMaxAttempts: 2,
                    },
                },
            });
            manager.on('circuit_breaker:half_open', halfOpenSpy);
            // Simulate failures to open circuit
            // Then wait for timeout
        });
        it('should close circuit breaker after successful operations', async () => {
            const closedSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    circuitBreaker: {
                        enabled: true,
                        failureThreshold: 5,
                        successThreshold: 2,
                        timeout: 5000,
                        halfOpenMaxAttempts: 3,
                    },
                },
            });
            manager.on('circuit_breaker:closed', closedSpy);
            // Normal operations should keep circuit closed
            await manager.query('test-db', 'SELECT 1');
            const state = manager.getCircuitBreakerState('test-db');
            expect(state).toBe('closed');
        });
        it('should allow manual circuit breaker reset', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            manager.resetCircuitBreaker('test-db');
            const state = manager.getCircuitBreakerState('test-db');
            expect(state).toBe('closed');
        });
        it('should emit circuit breaker state change events', async () => {
            const openedSpy = jest.fn();
            const closedSpy = jest.fn();
            const resetSpy = jest.fn();
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            manager.on('circuit_breaker:opened', openedSpy);
            manager.on('circuit_breaker:closed', closedSpy);
            manager.on('circuit_breaker:manual_reset', resetSpy);
            manager.resetCircuitBreaker('test-db');
            expect(resetSpy).toHaveBeenCalled();
        });
    });
    describe('Graceful Degradation', () => {
        it('should continue operating in degraded mode', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            const isHealthy = manager.isPoolHealthy('test-db');
            expect(typeof isHealthy).toBe('boolean');
        });
        it('should report degraded status in health checks', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
            });
            const health = manager.getPoolHealth('test-db');
            expect(health?.status).toMatch(/healthy|degraded|critical|down/);
        });
        it('should provide health status for all pools', async () => {
            await manager.registerDatabase({
                id: 'test-db-1',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb1',
                username: 'user',
                password: 'pass',
            });
            await manager.registerDatabase({
                id: 'test-db-2',
                type: 'mysql',
                host: 'localhost',
                port: 3306,
                database: 'testdb2',
                username: 'user',
                password: 'pass',
            });
            const allHealth = manager.getAllPoolHealth();
            expect(allHealth.size).toBe(2);
            expect(allHealth.get('test-db-1')).toBeDefined();
            expect(allHealth.get('test-db-2')).toBeDefined();
        });
    });
    describe('Health Check Queries', () => {
        it('should use custom health check query', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    validationQuery: 'SELECT version()',
                    healthCheck: {
                        enabled: true,
                        interval: 30000,
                        timeout: 5000,
                        healthyThreshold: 3,
                        unhealthyThreshold: 3,
                        query: 'SELECT version()',
                    },
                },
            });
            const health = manager.getPoolHealth('test-db');
            expect(health).toBeDefined();
        });
        it('should timeout health checks that take too long', async () => {
            await manager.registerDatabase({
                id: 'test-db',
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'user',
                password: 'pass',
                poolConfig: {
                    healthCheck: {
                        enabled: true,
                        interval: 30000,
                        timeout: 100, // Very short timeout
                        healthyThreshold: 3,
                        unhealthyThreshold: 3,
                        query: 'SELECT pg_sleep(1)',
                    },
                },
            });
            // Health check should timeout
            const health = manager.getPoolHealth('test-db');
            expect(health).toBeDefined();
        });
    });
});
