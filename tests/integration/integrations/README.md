/**
 * Integration Tests: README
 * Overview of integration test suite for integrations modules
 */

# Integration Tests for Integrations Modules

This directory contains comprehensive integration tests for testing interactions between multiple modules and real services.

## Test Files

### 1. `cloud-integrations.integration.test.ts`
Tests multi-cloud provider integrations (AWS, Azure, GCP):
- Cross-provider file transfer
- Multi-cloud storage aggregation
- Error propagation across providers
- Concurrent multi-provider operations
- Circuit breaker patterns

### 2. `database-api-integration.test.ts`
Tests database and API layer integration:
- End-to-end CRUD operations
- Transaction handling in API requests
- Error propagation from database to API
- Concurrent API requests with database
- Multi-module data flow
- Authentication middleware flow

### 3. `filesystem-storage.integration.test.ts`
Tests file system operations with storage integration:
- Real file operations (create, read, update, delete)
- File watching and event propagation
- Storage manager integration
- Concurrent file operations
- Transaction-like file operations
- Error handling in file operations

### 4. `end-to-end-flows.integration.test.ts`
Tests complete workflows through multiple modules:
- User registration and login flow
- Data creation and retrieval flow
- Transaction flow with rollback
- Authentication middleware flow
- Complex multi-module workflows
- Concurrent operations in workflows

### 5. `messaging-eventbus.integration.test.ts`
Tests message queue and event bus integration:
- Basic queue operations
- Error handling and retries
- Queue integration with workers
- Event publishing and subscription
- Event propagation patterns
- Worker pool with queue integration
- Event-driven microservices pattern

### 6. `api-server.integration.test.ts`
Tests real HTTP API endpoints:
- Basic HTTP operations (GET, POST, PUT, DELETE)
- Middleware integration
- Error handling
- Request/response headers
- Concurrent requests
- Request body parsing
- Rate limiting
- Authentication

### 7. `testcontainers.integration.test.ts`
Tests with containerized services:
- PostgreSQL container integration
- Redis container integration
- Multi-container integration
- Container lifecycle management
- Container network integration
- Cache-aside pattern
- Session management
- Distributed locking

## Running Tests

### Run All Integration Tests
```bash
npm test -- tests/integration/integrations
```

### Run Specific Test File
```bash
npm test -- tests/integration/integrations/database-api-integration.test.ts
```

### Run with Coverage
```bash
npm run test:coverage -- tests/integration/integrations
```

## Test Categories

### Real Database Connections
Tests use mock database connections that simulate real database behavior:
- Connection pooling
- Transaction management
- Query execution
- Error handling

### Real API Calls
Tests use mock HTTP servers that simulate real API behavior:
- Request routing
- Middleware execution
- Response handling
- Authentication

### Real File Operations
Tests use Node.js `fs` module for actual file system operations:
- File creation and deletion
- Directory management
- File watching
- Concurrent access

### End-to-End Flows
Tests complete workflows from input to output:
- User authentication flow
- Data persistence flow
- File upload flow
- Multi-step transactions

### Multi-Module Interactions
Tests integration between different modules:
- Database + API
- File System + Storage
- Message Queue + Event Bus
- Cloud Providers + Storage

### Error Propagation
Tests error handling across module boundaries:
- Database errors to API
- File system errors to storage
- Queue errors to workers
- Network errors to application

### Transaction Handling
Tests transaction management:
- Database transactions
- Multi-step workflows
- Rollback on error
- Nested transactions

### Concurrent Operations
Tests parallel execution:
- Multiple database queries
- Concurrent API requests
- Parallel file operations
- Race condition handling

## Best Practices

1. **Use Temporary Directories**: All file operations use `os.tmpdir()` to avoid polluting the file system
2. **Clean Up Resources**: All tests properly clean up resources in `afterEach` and `afterAll` hooks
3. **Test Isolation**: Each test is independent and doesn't rely on state from other tests
4. **Real Operations**: Tests use real file operations, real HTTP requests where possible
5. **Mock External Services**: External cloud services are mocked to avoid actual API calls
6. **Error Scenarios**: Tests include both success and failure scenarios
7. **Concurrent Testing**: Tests verify behavior under concurrent load

## Environment Variables

Some tests may require environment variables for real services:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_db
DB_USER=test_user
DB_PASSWORD=test_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API
API_BASE_URL=http://localhost:3000
```

## Testcontainers Support

For tests that require real services, use testcontainers:

```typescript
import { GenericContainer } from 'testcontainers';

const container = await new GenericContainer('postgres:15-alpine')
  .withExposedPorts(5432)
  .withEnvironment('POSTGRES_DB', 'testdb')
  .start();
```

## Performance Considerations

- Integration tests are slower than unit tests
- Use `beforeAll` to set up expensive resources once
- Run integration tests in CI/CD pipeline
- Consider parallel test execution for faster results

## Debugging

Enable verbose logging:
```bash
DEBUG=* npm test -- tests/integration/integrations
```

Run single test:
```bash
npm test -- tests/integration/integrations/database-api-integration.test.ts -t "should create user"
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:
- No external dependencies required (mocked services)
- Clean up all resources
- Fast execution with mocks
- Can optionally use real containers in CI

## Future Enhancements

- [ ] Add WebSocket integration tests
- [ ] Add GraphQL API integration tests
- [ ] Add message broker integration (RabbitMQ, Kafka)
- [ ] Add distributed tracing integration
- [ ] Add metrics collection integration
- [ ] Add real cloud provider integration tests (with credentials)
