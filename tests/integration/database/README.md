# Database Integration Tests

Comprehensive integration tests for database modules covering real database operations, transactions, and multi-module interactions.

## Test Suites

### 1. Database Connection Integration (`database-connection.integration.test.ts`)
Tests real database connectivity and connection lifecycle:
- Connection establishment and disconnection
- Query execution with real database
- Transaction management (begin, commit, rollback)
- Nested transactions with savepoints
- Connection error handling
- Event emission
- Parameter validation and SQL injection prevention

### 2. Pool Manager Integration (`pool-manager.integration.test.ts`)
Tests connection pooling and multi-database support:
- Multi-database registration and management
- Connection pool lifecycle
- Concurrent query execution (20+ concurrent operations)
- Transaction handling across pools
- Security configuration and validation
- Query caching mechanisms
- Health monitoring and circuit breaker patterns
- Resource leak detection and cleanup
- Graceful shutdown procedures

### 3. ORM Operations Integration (`orm-operations.integration.test.ts`)
Tests Object-Relational Mapping with real database:
- Model registration and schema validation
- CRUD operations (Create, Read, Update, Delete)
- Complex query builder operations
- Transaction support with rollback
- Model validation and custom validators
- Dirty tracking and change detection
- Model serialization (toJSON)
- Soft deletes
- Model refresh from database

### 4. Migrations Integration (`migrations.integration.test.ts`)
Tests database schema migrations:
- Migration execution and rollback
- Schema changes (add/drop columns, indexes)
- Complex table creation with foreign keys
- Migration ordering and dependencies
- Transaction safety during migrations
- Validation and security (SQL keyword protection)
- Error handling and automatic rollback
- Migration status tracking

### 5. Concurrent Operations Integration (`concurrent-operations.integration.test.ts`)
Tests database operations under concurrent load:
- 100+ concurrent queries
- Concurrent reads and writes
- Multiple concurrent transactions
- Race condition handling
- Connection pool stress testing
- Deadlock prevention
- Query cache under concurrency
- Prepared statement concurrency
- Error propagation and isolation
- Performance benchmarking

### 6. End-to-End Workflows Integration (`e2e-workflows.integration.test.ts`)
Tests complete real-world workflows:
- User management (registration, profile updates, deactivation)
- Blog platform (post creation, comments, publishing)
- E-commerce order processing with transactions
- Order cancellation and refunds
- Data seeding and migrations
- Complex filtering and pagination
- Batch operations
- Error recovery and partial failures

## Setup

### Prerequisites

1. **Database Server**: PostgreSQL, MySQL, or SQLite
2. **Environment Variables**:
   ```bash
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_NAME=test_db
   export DB_USER=test_user
   export DB_PASSWORD=test_password
   ```

3. **Test Database**: Create a dedicated test database
   ```sql
   CREATE DATABASE test_db;
   CREATE USER test_user WITH PASSWORD 'test_password';
   GRANT ALL PRIVILEGES ON DATABASE test_db TO test_user;
   ```

### Docker Setup (Recommended)

Use Docker Compose for test database:

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data

volumes:
  postgres_test_data:
```

Start test database:
```bash
docker-compose -f docker-compose.test.yml up -d
```

### Test Containers (Alternative)

Tests support testcontainers for automatic database provisioning:

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const container = await new PostgreSqlContainer().start();
process.env.DB_HOST = container.getHost();
process.env.DB_PORT = container.getPort().toString();
```

## Running Tests

### Run All Integration Tests
```bash
npm test -- tests/integration/database
```

### Run Specific Test Suite
```bash
npm test -- tests/integration/database/database-connection.integration.test.ts
npm test -- tests/integration/database/pool-manager.integration.test.ts
npm test -- tests/integration/database/orm-operations.integration.test.ts
npm test -- tests/integration/database/migrations.integration.test.ts
npm test -- tests/integration/database/concurrent-operations.integration.test.ts
npm test -- tests/integration/database/e2e-workflows.integration.test.ts
```

### Run with Coverage
```bash
npm run test:coverage -- tests/integration/database
```

### Watch Mode
```bash
npm run test:watch -- tests/integration/database
```

## Test Coverage

Integration tests cover:

- ✅ **Real Database Connections**: Actual TCP connections to database servers
- ✅ **Real API Calls**: Authentic database driver API usage
- ✅ **Real File Operations**: Temporary directories for SQLite databases
- ✅ **End-to-End Flows**: Complete user workflows from start to finish
- ✅ **Multi-Module Interactions**: Integration between ORM, migrations, and pooling
- ✅ **Error Propagation**: Error handling across module boundaries
- ✅ **Transaction Handling**: ACID compliance and rollback scenarios
- ✅ **Concurrent Operations**: Thread safety and race condition handling

## Performance Benchmarks

Tests include performance assertions:

- **Query Response Time**: < 100ms average for simple queries
- **Concurrent Load**: 100+ simultaneous queries without degradation
- **Pool Efficiency**: Connection reuse > 90%
- **Transaction Overhead**: < 10ms for begin/commit cycle

## Debugging

### Enable SQL Logging
```typescript
const config = {
  // ...
  logging: true  // Enable query logging
};
```

### Increase Test Timeout
```typescript
jest.setTimeout(30000);  // 30 seconds for slow operations
```

### Isolate Failing Tests
```bash
npm test -- tests/integration/database/concurrent-operations.integration.test.ts -t "should handle 100 concurrent queries"
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm test -- tests/integration/database
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: test_db
          DB_USER: test_user
          DB_PASSWORD: test_password
```

## Cleanup

Tests automatically clean up after themselves:
- Connections are closed in `afterAll` hooks
- Test databases can be dropped between runs
- Docker containers can be removed

```bash
# Clean up Docker test database
docker-compose -f docker-compose.test.yml down -v
```

## Best Practices

1. **Isolation**: Each test suite uses separate tables/schemas
2. **Idempotency**: Tests can run multiple times without side effects
3. **Cleanup**: Always close connections and release resources
4. **Timeouts**: Set appropriate timeouts for long-running operations
5. **Assertions**: Test both success and failure scenarios
6. **Real Data**: Use realistic data volumes for performance tests

## Troubleshooting

### Connection Refused
- Check database server is running
- Verify host/port configuration
- Check firewall rules

### Timeout Errors
- Increase jest timeout: `jest.setTimeout(60000)`
- Check database server performance
- Verify network connectivity

### Permission Errors
- Ensure test user has proper grants
- Check database ownership
- Verify schema permissions

### Port Conflicts
- Change test database port
- Stop conflicting services
- Use Docker with port mapping

## Contributing

When adding new integration tests:

1. Follow existing test structure
2. Include setup/teardown hooks
3. Test both success and failure paths
4. Add performance assertions where relevant
5. Document any special setup requirements
6. Ensure tests are idempotent

## Related Documentation

- [Database Pool Manager](../../../src/database/DatabasePoolManager.ts)
- [ORM System](../../../src/database/MEGA_DatabaseAbstraction.ts)
- [Unit Tests](../../unit/database/)
- [Performance Tests](../../performance/database/)
