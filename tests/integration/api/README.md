# API Integration Tests

This directory contains comprehensive integration tests for API modules with real database connections, file operations, and multi-module interactions.

## Test Files

### 1. `api-gateway.integration.test.ts`
Tests core API Gateway functionality:
- End-to-end request flows with authentication and authorization
- Multi-module interactions (Auth + RBAC + Audit)
- Concurrent requests with rate limiting
- Error propagation through middleware chains
- Input sanitization (XSS, SQL injection, command injection, path traversal)
- Circuit breaker integration
- Retry logic
- Metrics collection
- Event bus integration
- Response caching

### 2. `database-api.integration.test.ts`
Tests database + API integration:
- Real SQLite database connections
- Query execution against real databases
- Transaction handling (commit and rollback)
- Nested transactions
- API endpoints with database operations
- Database error handling in API endpoints
- Concurrent database writes
- Concurrent API requests with database operations
- Connection pool management and reuse
- Error recovery

### 3. `file-operations.integration.test.ts`
Tests file operations with temporary directories:
- Create, read, update, delete files via API endpoints
- List files in directories
- File upload with metadata
- Concurrent file writes and reads
- File not found error handling
- Path traversal prevention
- File-based caching
- Temporary file creation and cleanup
- Binary file operations

### 4. `multi-module.integration.test.ts`
Tests complex interactions between modules:
- Complete user management flow (registration, authentication, data persistence)
- Event-driven architecture across modules
- Cross-module event communication
- Multi-table transactions with API operations
- Permission-based data access with row-level security
- Error recovery across modules
- Performance under high concurrent load (100+ requests)

### 5. `external-api.integration.test.ts`
Tests external API integrations:
- Proxying requests to external APIs
- External API error handling
- Retry logic for failed external calls
- Circuit breaker with external services
- Timeout handling for slow APIs
- API composition (multiple external calls)
- Partial failure handling
- Rate limiting with external APIs
- Response caching for external APIs
- Webhook handling from external services

### 6. `container-database.integration.test.ts`
Tests with real containerized databases (requires Docker):
- PostgreSQL container tests (CRUD, transactions)
- MySQL container tests (AUTO_INCREMENT, features)
- Redis container tests (caching, SET/GET)
- Multi-database operations (PostgreSQL + Redis)
- Session management across databases

### 7. `test-containers.util.ts`
Utilities for test containers:
- `TestContainer` base class
- `PostgreSQLContainer`, `MySQLContainer`, `RedisContainer`, `MongoDBContainer`
- Docker availability checking
- Container lifecycle management
- Service readiness waiting

## Running Tests

### Run all integration tests:
```bash
npm test -- tests/integration/api
```

### Run specific test file:
```bash
npm test -- tests/integration/api/api-gateway.integration.test.ts
```

### Run with coverage:
```bash
npm run test:coverage -- tests/integration/api
```

### Run container-based tests (requires Docker):
```bash
docker --version  # Ensure Docker is available
npm test -- tests/integration/api/container-database.integration.test.ts
```

## Test Coverage

These integration tests cover:

1. **Real Database Connections**
   - SQLite for fast in-memory/file-based testing
   - PostgreSQL/MySQL/Redis via Docker containers
   - Connection pooling and management
   - Query execution and prepared statements

2. **Real API Calls**
   - HTTP method handling (GET, POST, PUT, DELETE, PATCH)
   - Request/response cycle
   - Headers, query params, path params, body
   - Authentication and authorization

3. **Real File Operations**
   - File creation, reading, updating, deletion
   - Directory operations
   - Temporary files with cleanup
   - Binary file handling
   - Concurrent file operations

4. **End-to-End Flows**
   - User registration → Login → Authenticated requests
   - API → Database → Response
   - API → External service → Cache → Response
   - Multi-step workflows

5. **Multi-Module Interactions**
   - API Gateway + Database Pool Manager
   - API Gateway + Authentication System
   - API Gateway + RBAC System
   - API Gateway + Audit Logger
   - API Gateway + Event Bus
   - All modules together in complex scenarios

6. **Error Propagation**
   - Errors through middleware chains
   - Database errors in API handlers
   - External service failures
   - Validation errors
   - Authentication/authorization failures

7. **Transaction Handling**
   - Successful transaction commits
   - Failed transaction rollbacks
   - Nested transactions
   - Multi-table transactions
   - Concurrent transaction handling

8. **Concurrent Operations**
   - 10-100+ concurrent requests
   - Concurrent database writes
   - Concurrent file operations
   - Race condition handling
   - Resource contention

## Test Containers

The test suite uses Docker containers for real database testing. If Docker is not available, container-based tests are automatically skipped.

### Prerequisites:
- Docker installed and running
- Sufficient disk space for container images
- Available ports (configured in tests)

### Supported Containers:
- PostgreSQL 15 (Alpine)
- MySQL 8.0
- Redis 7 (Alpine)
- MongoDB 7.0

### Container Lifecycle:
1. Container starts before test
2. Tests run against real database
3. Container stops and is removed after test
4. Automatic cleanup on test suite completion

## Best Practices

1. **Isolation**: Each test is independent with its own setup/teardown
2. **Cleanup**: All resources (files, containers, connections) are cleaned up
3. **Temp Directories**: File tests use temporary directories
4. **Port Conflicts**: Container tests use non-standard ports to avoid conflicts
5. **Docker Checks**: Container tests skip gracefully if Docker unavailable
6. **Error Handling**: Tests verify both success and failure scenarios
7. **Concurrency**: Tests verify thread-safety and concurrent operations

## Performance Expectations

- API Gateway tests: < 1 second per test
- Database tests: < 2 seconds per test
- File operation tests: < 1 second per test
- Container tests: 5-10 seconds per test (includes container startup)
- Multi-module tests: 2-5 seconds per test
- Concurrent load tests: < 5 seconds for 100 requests

## Troubleshooting

### Docker container tests failing:
```bash
# Check if Docker is running
docker ps

# Check for port conflicts
netstat -an | grep 5432  # PostgreSQL
netstat -an | grep 3306  # MySQL
netstat -an | grep 6379  # Redis

# Manually cleanup test containers
docker ps -a --filter "name=test-"
docker stop $(docker ps -a --filter "name=test-" -q)
docker rm $(docker ps -a --filter "name=test-" -q)
```

### File operation tests failing:
```bash
# Check temp directory permissions
ls -la /tmp

# Clean up old test directories
rm -rf /tmp/api-file-test-*
rm -rf /tmp/test-db-*
```

### Database connection issues:
- Increase timeout values in test configuration
- Check database container logs: `docker logs <container-name>`
- Verify connection parameters match container configuration

## Future Enhancements

- [ ] Add Kafka/RabbitMQ message queue integration tests
- [ ] Add GraphQL API integration tests
- [ ] Add WebSocket integration tests
- [ ] Add gRPC integration tests
- [ ] Add distributed tracing integration tests
- [ ] Add load testing scenarios (1000+ concurrent requests)
- [ ] Add chaos engineering tests (random failures)
- [ ] Add performance benchmarking
- [ ] Add API versioning tests
- [ ] Add multi-tenancy tests
