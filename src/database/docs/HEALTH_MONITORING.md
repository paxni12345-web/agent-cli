# Connection Pool Health Monitoring

Complete health monitoring system for database connection pools with real-time diagnostics, automatic recovery, and graceful degradation.

## Features

### 1. Connection Validation Before Use

Validates connections before acquisition to ensure they are healthy:

```typescript
await manager.registerDatabase({
  id: 'my-db',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  username: 'user',
  password: 'pass',
  poolConfig: {
    testOnBorrow: true,      // Validate before use
    testOnReturn: false,     // Validate after use
    testWhileIdle: true,     // Validate idle connections
    validationQuery: 'SELECT 1',
  },
});
```

### 2. Automatic Reconnection on Failure

Automatically attempts to reconnect failed connections:

```typescript
manager.on('connection:reconnected', (event) => {
  console.log(`Connection ${event.connectionId} reconnected`);
});

manager.on('connection:reconnection_failed', (event) => {
  console.error(`Failed to reconnect ${event.connectionId}:`, event.error);
});
```

### 3. Health Check Queries

Periodic health checks with configurable intervals and timeouts:

```typescript
await manager.registerDatabase({
  id: 'my-db',
  // ... connection config
  poolConfig: {
    healthCheck: {
      enabled: true,
      interval: 30000,          // Check every 30 seconds
      timeout: 5000,            // 5 second timeout
      healthyThreshold: 3,      // Consider healthy after 3 successes
      unhealthyThreshold: 3,    // Consider unhealthy after 3 failures
      query: 'SELECT 1',
    },
  },
});

// Listen to health check events
manager.on('pool:health_check', (event) => {
  console.log(`Health: ${event.status.status} (${event.status.healthScore}/100)`);
});

// Force an immediate health check
await manager.forceHealthCheck('my-db');

// Get current health status
const health = manager.getPoolHealth('my-db');
console.log(`Status: ${health.status}, Score: ${health.healthScore}/100`);
```

### 4. Connection Leak Detection

Detects connections held for too long:

```typescript
await manager.registerDatabase({
  id: 'my-db',
  // ... connection config
  poolConfig: {
    leakDetectionThreshold: 300000, // 5 minutes
  },
});

manager.on('pool:connection_leak_detected', (event) => {
  console.log(`Detected ${event.leaks.length} connection leaks`);
  event.leaks.forEach(leak => {
    console.log(`  Connection: ${leak.connectionId}`);
    console.log(`  Duration: ${leak.duration}ms`);
    console.log(`  Acquired by: ${leak.acquiredBy}`);
    console.log(`  Stack trace:\n${leak.stackTrace}`);
  });
});

// Get current leaks
const leaks = manager.getConnectionLeaks('my-db');
```

### 5. Pool Statistics Tracking

Comprehensive statistics tracking:

```typescript
const stats = manager.getPoolStats('my-db');

console.log('Pool Statistics:');
console.log(`  Total Connections: ${stats.totalConnections}`);
console.log(`  Idle Connections: ${stats.idleConnections}`);
console.log(`  Active Connections: ${stats.activeConnections}`);
console.log(`  Waiting Requests: ${stats.waitingRequests}`);
console.log(`  Total Queries: ${stats.totalQueries}`);
console.log(`  Failed Queries: ${stats.failedQueries}`);
console.log(`  Average Query Time: ${stats.averageQueryTime}ms`);
console.log(`  Connection Leaks: ${stats.connectionLeaks}`);
console.log(`  Validation Failures: ${stats.validationFailures}`);
console.log(`  Reconnection Attempts: ${stats.reconnectionAttempts}`);
console.log(`  Circuit Breaker: ${stats.circuitBreakerState}`);
console.log(`  Health: ${stats.healthStatus.status} (${stats.healthStatus.healthScore}/100)`);

// Get statistics for all pools
const allStats = manager.getAllPoolStats();
allStats.forEach((stats, dbId) => {
  console.log(`${dbId}: ${stats.activeConnections}/${stats.totalConnections} connections`);
});
```

### 6. Alert on Pool Exhaustion

Alerts when pool utilization exceeds threshold:

```typescript
await manager.registerDatabase({
  id: 'my-db',
  // ... connection config
  poolConfig: {
    max: 10,
    exhaustionAlertThreshold: 0.9, // Alert at 90% utilization
  },
});

manager.on('pool:exhaustion_alert', (event) => {
  console.log(`Pool exhaustion alert!`);
  console.log(`  Utilization: ${(event.utilization * 100).toFixed(1)}%`);
  console.log(`  Connections: ${event.totalConnections}/${event.maxConnections}`);
  console.log(`  Waiting: ${event.waitingRequests} requests`);
  
  // Take action: scale up, shed load, etc.
});
```

### 7. Graceful Degradation

Continues operating in degraded mode:

```typescript
// Check if pool is healthy
const isHealthy = manager.isPoolHealthy('my-db');

if (!isHealthy) {
  console.log('Pool is degraded - implementing fallback strategies');
  // Use cached data, route to replica, reduce load, etc.
}

// Get detailed health status
const health = manager.getPoolHealth('my-db');

switch (health.status) {
  case 'healthy':
    // Normal operation
    break;
  case 'degraded':
    // Reduce load, use caching
    break;
  case 'critical':
    // Emergency mode, read-only
    break;
  case 'down':
    // Fail over to backup
    break;
}

// Listen for status changes
manager.on('pool:health_status_changed', (event) => {
  console.log(`Health changed: ${event.previousStatus} → ${event.currentStatus}`);
  // Adjust application behavior
});

manager.on('pool:health_alert', (event) => {
  console.log(`Health alert: ${event.severity}`);
  console.log(`Issues: ${event.issues.join(', ')}`);
  // Send notifications, page on-call, etc.
});
```

### 8. Circuit Breaker Pattern

Protects against cascading failures:

```typescript
await manager.registerDatabase({
  id: 'my-db',
  // ... connection config
  poolConfig: {
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,        // Open after 5 failures
      successThreshold: 2,        // Close after 2 successes
      timeout: 60000,             // Try again after 1 minute
      halfOpenMaxAttempts: 3,     // Max attempts in half-open state
    },
  },
});

// Monitor circuit breaker state
manager.on('circuit_breaker:opened', (event) => {
  console.log(`Circuit breaker opened for ${event.databaseId}`);
  console.log(`Failures: ${event.failures}/${event.threshold}`);
  // Stop sending traffic, use fallback
});

manager.on('circuit_breaker:half_open', (event) => {
  console.log(`Circuit breaker half-open for ${event.databaseId}`);
  // Limited traffic for testing
});

manager.on('circuit_breaker:closed', (event) => {
  console.log(`Circuit breaker closed for ${event.databaseId}`);
  // Resume normal operation
});

// Check current state
const state = manager.getCircuitBreakerState('my-db');
console.log(`Circuit breaker: ${state}`);

// Manually reset circuit breaker
manager.resetCircuitBreaker('my-db');
```

## Health Status Values

### Status Levels

- **healthy**: Pool operating normally (score 70-100)
- **degraded**: Pool under stress but operational (score 50-69)
- **critical**: Pool severely impaired (score 30-49)
- **down**: Pool not operational (score 0-29)

### Health Score Calculation

Health score (0-100) is calculated based on:

- **Unhealthy connections**: -10 per connection
- **Waiting requests**: -5 per request (max -30)
- **Connection leaks**: -15 per leak (max -40)
- **Circuit breaker open**: -30
- **Circuit breaker half-open**: -15

## Circuit Breaker States

- **closed**: Normal operation, all requests allowed
- **open**: Failing, all requests rejected
- **half_open**: Testing recovery, limited requests allowed

## Events Reference

### Health Monitoring Events

```typescript
// Health check completed
manager.on('pool:health_check', (event) => {
  // event.databaseId, event.status, event.duration
});

// Health status changed
manager.on('pool:health_status_changed', (event) => {
  // event.databaseId, event.previousStatus, event.currentStatus, 
  // event.healthScore, event.issues
});

// Health alert (critical or down)
manager.on('pool:health_alert', (event) => {
  // event.databaseId, event.severity, event.healthScore, event.issues
});

// Health check failed
manager.on('pool:health_check_failed', (event) => {
  // event.databaseId, event.error
});
```

### Connection Events

```typescript
// Connection validation failed
manager.on('connection:validation_failed', (event) => {
  // event.connectionId, event.error, event.failures
});

// Connection reconnected
manager.on('connection:reconnected', (event) => {
  // event.connectionId, event.databaseId
});

// Reconnection failed
manager.on('connection:reconnection_failed', (event) => {
  // event.connectionId, event.databaseId, event.error
});
```

### Pool Events

```typescript
// Pool exhaustion alert
manager.on('pool:exhaustion_alert', (event) => {
  // event.databaseId, event.utilization, event.totalConnections,
  // event.maxConnections, event.waitingRequests
});

// Connection leak detected
manager.on('pool:connection_leak_detected', (event) => {
  // event.databaseId, event.leaks
});
```

### Circuit Breaker Events

```typescript
// Circuit breaker opened
manager.on('circuit_breaker:opened', (event) => {
  // event.databaseId, event.failures, event.threshold
});

// Circuit breaker half-open
manager.on('circuit_breaker:half_open', (event) => {
  // event.databaseId
});

// Circuit breaker closed
manager.on('circuit_breaker:closed', (event) => {
  // event.databaseId, event.successes
});

// Circuit breaker reopened
manager.on('circuit_breaker:reopened', (event) => {
  // event.databaseId, event.reason
});

// Circuit breaker manually reset
manager.on('circuit_breaker:manual_reset', (event) => {
  // event.databaseId
});
```

## Complete Configuration Example

```typescript
import DatabasePoolManager from './DatabasePoolManager';

const manager = new DatabasePoolManager();

await manager.registerDatabase({
  id: 'production-db',
  type: 'postgresql',
  host: 'db.example.com',
  port: 5432,
  database: 'myapp',
  username: 'appuser',
  password: 'secret',
  ssl: true,
  poolConfig: {
    // Connection pool settings
    min: 2,
    max: 20,
    acquireTimeout: 30000,
    idleTimeout: 600000,
    evictionInterval: 60000,
    
    // Connection validation
    testOnBorrow: true,
    testOnReturn: false,
    testWhileIdle: true,
    validationQuery: 'SELECT 1',
    
    // Retry settings
    maxRetries: 3,
    retryDelay: 1000,
    
    // Leak detection
    leakDetectionThreshold: 300000, // 5 minutes
    
    // Pool exhaustion
    exhaustionAlertThreshold: 0.9, // 90%
    
    // Health checks
    healthCheck: {
      enabled: true,
      interval: 30000,        // 30 seconds
      timeout: 5000,          // 5 seconds
      healthyThreshold: 3,
      unhealthyThreshold: 3,
      query: 'SELECT 1',
    },
    
    // Circuit breaker
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,         // 1 minute
      halfOpenMaxAttempts: 3,
    },
  },
});

// Set up monitoring
manager.on('pool:health_alert', async (event) => {
  await notifyOncall({
    severity: event.severity,
    database: event.databaseId,
    issues: event.issues,
  });
});

manager.on('pool:exhaustion_alert', async (event) => {
  await scaleUpPool(event.databaseId);
});

manager.on('circuit_breaker:opened', async (event) => {
  await failoverToReplica(event.databaseId);
});

// Use the pool
const result = await manager.query('production-db', 'SELECT * FROM users WHERE id = $1', [123]);
```

## Best Practices

1. **Enable health checks**: Always enable health checks in production
2. **Configure timeouts**: Set appropriate timeouts for your workload
3. **Monitor events**: Listen to health events and alert on issues
4. **Leak detection**: Enable leak detection with reasonable threshold
5. **Circuit breaker**: Use circuit breaker to prevent cascading failures
6. **Graceful degradation**: Implement fallback strategies for degraded state
7. **Pool sizing**: Size pools appropriately and monitor exhaustion
8. **Validate connections**: Enable testOnBorrow for critical applications
9. **Track statistics**: Monitor statistics to understand pool behavior
10. **Alert on issues**: Set up alerting for health alerts and exhaustion

## Monitoring Dashboard Example

```typescript
import { PoolHealthDashboard } from './examples/health-monitoring-example';

const dashboard = new PoolHealthDashboard(manager);

// Start monitoring (updates every 5 seconds)
dashboard.start(5000);

// Stop monitoring
dashboard.stop();
```

## API Reference

### Health Monitoring Methods

```typescript
// Get health status for a pool
getPoolHealth(databaseId: string): PoolHealthStatus | undefined

// Get health status for all pools
getAllPoolHealth(): Map<string, PoolHealthStatus>

// Force an immediate health check
forceHealthCheck(databaseId: string): Promise<void>

// Check if pool is healthy
isPoolHealthy(databaseId: string): boolean
```

### Connection Leak Methods

```typescript
// Get connection leaks for a pool
getConnectionLeaks(databaseId: string): ConnectionLeak[] | undefined

// Get connection leaks for all pools
getAllConnectionLeaks(): Map<string, ConnectionLeak[]>
```

### Circuit Breaker Methods

```typescript
// Get circuit breaker state
getCircuitBreakerState(databaseId: string): CircuitBreakerState | undefined

// Manually reset circuit breaker
resetCircuitBreaker(databaseId: string): void
```

### Statistics Methods

```typescript
// Get pool statistics
getPoolStats(databaseId: string): PoolStats | undefined

// Get statistics for all pools
getAllPoolStats(): Map<string, PoolStats>
```

## Troubleshooting

### High Connection Leaks

If you're seeing many connection leaks:

1. Check for unclosed transactions
2. Ensure all queries are wrapped in try-catch
3. Review code for missing connection releases
4. Increase leakDetectionThreshold if operations legitimately take longer

### Circuit Breaker Opening Frequently

If circuit breaker opens too often:

1. Check database connectivity and performance
2. Increase failureThreshold
3. Review query performance and timeouts
4. Consider scaling database resources

### Pool Exhaustion

If pool exhaustion alerts are frequent:

1. Increase max pool size
2. Reduce connection hold time
3. Optimize slow queries
4. Implement connection pooling per service
5. Use read replicas for read-heavy workloads

### Low Health Score

If health score is consistently low:

1. Check for connection validation failures
2. Review waiting requests and pool sizing
3. Check for connection leaks
4. Monitor circuit breaker state
5. Review application query patterns
