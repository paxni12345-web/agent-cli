"use strict";
/**
 * Secure Query Builder - Usage Examples
 * Demonstrates the secure query execution system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSecureDatabase = setupSecureDatabase;
exports.exampleSecureQueries = exampleSecureQueries;
exports.exampleSQLInjectionPrevention = exampleSQLInjectionPrevention;
exports.exampleQueryMonitoring = exampleQueryMonitoring;
exports.exampleCacheManagement = exampleCacheManagement;
const DatabasePoolManager_1 = __importDefault(require("./DatabasePoolManager"));
// ============================================================================
// Setup and Configuration
// ============================================================================
async function setupSecureDatabase() {
    const manager = new DatabasePoolManager_1.default();
    // Register database
    const dbConfig = {
        id: 'main-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'myapp',
        username: 'dbuser',
        password: 'securepassword',
        ssl: true,
    };
    await manager.registerDatabase(dbConfig);
    // Configure security settings
    const securityConfig = {
        allowedTables: new Set(['users', 'posts', 'comments', 'sessions']),
        allowedColumns: new Map([
            ['users', new Set(['id', 'email', 'username', 'created_at', 'updated_at'])],
            ['posts', new Set(['id', 'title', 'content', 'author_id', 'created_at'])],
        ]),
        maxQueryTimeout: 30000,
        requireParameterized: true,
        blockDynamicIdentifiers: true,
        allowedOperations: new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
        maxResultRows: 1000,
        enableQueryLogging: true,
    };
    manager.setSecurityConfig('main-db', securityConfig);
    return manager;
}
// ============================================================================
// Secure Query Examples
// ============================================================================
async function exampleSecureQueries() {
    const manager = await setupSecureDatabase();
    // Example 1: Secure SELECT with parameterized query
    console.log('Example 1: Secure SELECT');
    try {
        const result = await manager.query('main-db', 'SELECT id, email, username FROM users WHERE email = $1', ['user@example.com'], { cache: true, cacheTTL: 60000 });
        console.log('✓ Query successful:', result.rowCount, 'rows');
    }
    catch (error) {
        console.error('✗ Query failed:', error.message);
    }
    // Example 2: Using Query Builder (safest approach)
    console.log('\nExample 2: Query Builder');
    try {
        const builder = manager.createQueryBuilder('main-db');
        const result = await builder
            .select('id', 'email', 'username')
            .from('users')
            .where('email', '=', 'user@example.com')
            .limit(10)
            .execute();
        console.log('✓ Query successful:', result.rowCount, 'rows');
    }
    catch (error) {
        console.error('✗ Query failed:', error.message);
    }
    // Example 3: Secure INSERT
    console.log('\nExample 3: Secure INSERT');
    try {
        const builder = manager.createQueryBuilder('main-db');
        const result = await builder
            .insert('users')
            .values({
            email: 'newuser@example.com',
            username: 'newuser',
        })
            .execute();
        console.log('✓ Insert successful');
    }
    catch (error) {
        console.error('✗ Insert failed:', error.message);
    }
    // Example 4: Secure UPDATE with WHERE clause
    console.log('\nExample 4: Secure UPDATE');
    try {
        const builder = manager.createQueryBuilder('main-db');
        const result = await builder
            .update('users')
            .set({ username: 'updated_username' })
            .where('id', '=', 123)
            .execute();
        console.log('✓ Update successful');
    }
    catch (error) {
        console.error('✗ Update failed:', error.message);
    }
    // Example 5: Secure DELETE with WHERE clause
    console.log('\nExample 5: Secure DELETE');
    try {
        const builder = manager.createQueryBuilder('main-db');
        const result = await builder
            .delete('users')
            .where('id', '=', 456)
            .execute();
        console.log('✓ Delete successful');
    }
    catch (error) {
        console.error('✗ Delete failed:', error.message);
    }
    // Example 6: Query with timeout protection
    console.log('\nExample 6: Query with timeout');
    try {
        const result = await manager.query('main-db', 'SELECT * FROM users WHERE created_at > $1', [new Date('2024-01-01')], { timeout: 5000, cache: true });
        console.log('✓ Query completed within timeout');
    }
    catch (error) {
        console.error('✗ Query timed out:', error.message);
    }
    // Example 7: Using prepared statements
    console.log('\nExample 7: Prepared statements');
    try {
        const result = await manager.query('main-db', 'SELECT id, username FROM users WHERE email = $1', ['user@example.com'], { prepare: true, cache: true });
        console.log('✓ Prepared statement executed');
    }
    catch (error) {
        console.error('✗ Prepared statement failed:', error.message);
    }
    // Example 8: Complex query with multiple conditions
    console.log('\nExample 8: Complex query');
    try {
        const builder = manager.createQueryBuilder('main-db');
        const result = await builder
            .select('id', 'title', 'author_id', 'created_at')
            .from('posts')
            .where('author_id', '=', 123)
            .orderBy('created_at', 'DESC')
            .limit(20)
            .offset(0)
            .execute({ cache: true, cacheTTL: 120000 });
        console.log('✓ Complex query successful');
    }
    catch (error) {
        console.error('✗ Complex query failed:', error.message);
    }
    // View query statistics
    console.log('\nQuery Statistics:');
    const stats = manager.getQueryStatistics('main-db');
    console.log('- Total queries:', stats.totalQueries);
    console.log('- Successful:', stats.successfulQueries);
    console.log('- Failed:', stats.failedQueries);
    console.log('- Average execution time:', stats.averageExecutionTime.toFixed(2), 'ms');
    await manager.close();
}
// ============================================================================
// SQL Injection Prevention Examples
// ============================================================================
async function exampleSQLInjectionPrevention() {
    const manager = await setupSecureDatabase();
    console.log('\n=== SQL Injection Prevention Examples ===\n');
    // Example 1: BLOCKED - Non-parameterized query
    console.log('Example 1: Non-parameterized query (BLOCKED)');
    try {
        await manager.query('main-db', "SELECT * FROM users WHERE email = 'user@example.com'", []);
        console.log('✗ Should have been blocked!');
    }
    catch (error) {
        console.log('✓ Correctly blocked:', error.message);
    }
    // Example 2: BLOCKED - Dynamic table name
    console.log('\nExample 2: Dynamic table name (BLOCKED)');
    try {
        const tableName = 'users'; // From user input
        const builder = manager.createQueryBuilder('main-db');
        // This would fail validation in the builder
        await manager.query('main-db', `SELECT * FROM ${tableName}`, // Dynamic identifier
        []);
        console.log('✗ Should have been blocked!');
    }
    catch (error) {
        console.log('✓ Correctly blocked:', error.message);
    }
    // Example 3: BLOCKED - Unauthorized table access
    console.log('\nExample 3: Unauthorized table access (BLOCKED)');
    try {
        await manager.query('main-db', 'SELECT * FROM admin_secrets WHERE id = $1', [1]);
        console.log('✗ Should have been blocked!');
    }
    catch (error) {
        console.log('✓ Correctly blocked:', error.message);
    }
    // Example 4: BLOCKED - DELETE without WHERE
    console.log('\nExample 4: DELETE without WHERE clause (BLOCKED)');
    try {
        await manager.query('main-db', 'DELETE FROM users', []);
        console.log('✗ Should have been blocked!');
    }
    catch (error) {
        console.log('✓ Correctly blocked:', error.message);
    }
    // Example 5: BLOCKED - Dangerous operation
    console.log('\nExample 5: DROP TABLE (BLOCKED)');
    try {
        await manager.query('main-db', 'DROP TABLE users', []);
        console.log('✗ Should have been blocked!');
    }
    catch (error) {
        console.log('✓ Correctly blocked:', error.message);
    }
    // Example 6: SAFE - Properly parameterized query
    console.log('\nExample 6: Properly parameterized query (SAFE)');
    try {
        const userInput = "'; DROP TABLE users; --"; // Malicious input
        await manager.query('main-db', 'SELECT * FROM users WHERE email = $1', [userInput] // Safely parameterized
        );
        console.log('✓ Query executed safely (no injection)');
    }
    catch (error) {
        console.log('Query failed (safe):', error.message);
    }
    await manager.close();
}
// ============================================================================
// Query Monitoring and Auditing
// ============================================================================
async function exampleQueryMonitoring() {
    const manager = await setupSecureDatabase();
    console.log('\n=== Query Monitoring Examples ===\n');
    // Execute some queries
    const builder = manager.createQueryBuilder('main-db');
    await builder
        .select('*')
        .from('users')
        .where('id', '=', 1)
        .execute({ logLevel: 'detailed' });
    await builder
        .select('*')
        .from('posts')
        .where('author_id', '=', 1)
        .limit(10)
        .execute({ logLevel: 'basic' });
    // Get query logs
    console.log('Recent query logs:');
    const logs = manager.getQueryLogs({ limit: 10 });
    logs.forEach((log, i) => {
        console.log(`${i + 1}. [${log.operation}] ${log.success ? '✓' : '✗'} (${log.executionTime}ms)`);
        if (log.error) {
            console.log(`   Error: ${log.error}`);
        }
    });
    // Get detailed statistics
    console.log('\nDetailed Statistics:');
    const stats = manager.getQueryStatistics('main-db');
    console.log('- Total queries:', stats.totalQueries);
    console.log('- Success rate:', ((stats.successfulQueries / stats.totalQueries) * 100).toFixed(1), '%');
    console.log('- Average execution time:', stats.averageExecutionTime.toFixed(2), 'ms');
    if (stats.slowestQuery) {
        console.log('- Slowest query:', stats.slowestQuery.executionTime, 'ms');
    }
    console.log('\nOperation breakdown:');
    stats.operationBreakdown.forEach((count, operation) => {
        console.log(`  ${operation}: ${count}`);
    });
    // Get failed queries only
    console.log('\nFailed queries:');
    const failedLogs = manager.getQueryLogs({ success: false });
    console.log(`Found ${failedLogs.length} failed queries`);
    await manager.close();
}
// ============================================================================
// Cache Management Examples
// ============================================================================
async function exampleCacheManagement() {
    const manager = await setupSecureDatabase();
    console.log('\n=== Cache Management Examples ===\n');
    const builder = manager.createQueryBuilder('main-db');
    // Query with caching enabled
    console.log('First query (cache miss):');
    const result1 = await builder
        .select('*')
        .from('users')
        .where('id', '=', 1)
        .execute({ cache: true, cacheTTL: 60000 });
    console.log('- From cache:', result1.fromCache || false);
    console.log('- Execution time:', result1.executionTime, 'ms');
    // Same query again (cache hit)
    console.log('\nSecond query (cache hit):');
    const result2 = await builder
        .select('*')
        .from('users')
        .where('id', '=', 1)
        .execute({ cache: true, cacheTTL: 60000 });
    console.log('- From cache:', result2.fromCache || false);
    console.log('- Execution time:', result2.executionTime, 'ms');
    // Clear cache
    console.log('\nClearing cache...');
    manager.clearQueryCache('main-db');
    console.log('✓ Cache cleared');
    // Query after cache clear
    console.log('\nThird query (cache miss after clear):');
    const result3 = await builder
        .select('*')
        .from('users')
        .where('id', '=', 1)
        .execute({ cache: true, cacheTTL: 60000 });
    console.log('- From cache:', result3.fromCache || false);
    await manager.close();
}
// ============================================================================
// Run Examples
// ============================================================================
if (require.main === module) {
    (async () => {
        try {
            await exampleSecureQueries();
            await exampleSQLInjectionPrevention();
            await exampleQueryMonitoring();
            await exampleCacheManagement();
        }
        catch (error) {
            console.error('Example failed:', error);
        }
    })();
}
