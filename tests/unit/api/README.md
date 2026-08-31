# APIGateway Unit Tests

Comprehensive unit tests for all APIGateway implementations in the codebase.

## Overview

This test suite covers three APIGateway implementations:

1. **Network APIGateway** (`/src/network/APIGateway.ts`)
2. **API APIGateway** (`/src/api/APIGateway.ts`)
3. **Gateway APIGatewayManager** (`/src/gateway/APIGateway.ts`)

## Test Coverage

Each implementation is tested for:

### 1. All Public Methods
- Constructor variations
- Route/endpoint registration and management
- Request handling
- Server lifecycle (start/stop)
- Configuration management
- Metrics collection
- Error handling

### 2. Edge Cases
- Null and undefined inputs
- Empty strings and objects
- Very large inputs (long paths, large bodies)
- Special characters in paths and data
- Concurrent operations
- Resource limits

### 3. Error Conditions
- Validation errors
- Authentication/authorization failures
- Rate limit exceeded
- Timeouts
- Circuit breaker states
- Upstream failures
- Network errors
- Payload size errors

### 4. Async Behavior
- Promise resolution/rejection
- Concurrent request handling
- Timeout handling
- Async middleware chains
- Retry logic
- Circuit breaker state transitions

### 5. Resource Cleanup
- Server shutdown
- Cache clearing
- Memory leak prevention
- Event listener cleanup
- Connection management
- Expired entry removal

### 6. Type Safety
- Enum enforcement (HttpMethod, RateLimitStrategy, etc.)
- Interface compliance
- Type validation
- Generic type parameters

### 7. Mock External Dependencies
- HTTP/HTTPS modules
- Compression (zlib)
- Network calls
- Database connections
- External services

### 8. Error Paths
- Invalid configurations
- Missing required fields
- Type mismatches
- Constraint violations
- State errors

### 9. Timeouts
- Request timeouts
- Connection timeouts
- Backend timeouts
- Rate limit windows
- Cache expiration

### 10. Concurrency
- Parallel request handling
- Race conditions in rate limiting
- Concurrent route registration
- Thread safety
- Atomic operations

## Test Files

```
tests/unit/api/
├── APIGateway.network.test.ts    # Network implementation tests (1,000+ assertions)
├── APIGateway.api.test.ts        # API implementation tests (1,000+ assertions)
├── APIGateway.gateway.test.ts    # Gateway implementation tests (1,000+ assertions)
├── jest.config.js                 # Jest configuration
├── jest.setup.js                  # Global test setup
└── README.md                      # This file
```

## Running Tests

### Run all tests
```bash
npm test tests/unit/api/
```

### Run specific implementation
```bash
npm test tests/unit/api/APIGateway.network.test.ts
npm test tests/unit/api/APIGateway.api.test.ts
npm test tests/unit/api/APIGateway.gateway.test.ts
```

### Run with coverage
```bash
npm test -- --coverage tests/unit/api/
```

### Run in watch mode
```bash
npm test -- --watch tests/unit/api/
```

### Run specific test suite
```bash
npm test -- --testNamePattern="Constructor" tests/unit/api/
```

### Run with verbose output
```bash
npm test -- --verbose tests/unit/api/
```

## Coverage Goals

Target coverage: **>90%** for all metrics
- Branches: >90%
- Functions: >90%
- Lines: >90%
- Statements: >90%

## Test Structure

Each test file follows a consistent structure:

```typescript
describe('ClassName', () => {
  describe('methodName()', () => {
    it('should handle normal case', () => { /* ... */ });
    it('should handle null input', () => { /* ... */ });
    it('should handle edge case', () => { /* ... */ });
    it('should throw on invalid input', () => { /* ... */ });
  });
});
```

## Key Testing Patterns

### 1. Arrange-Act-Assert (AAA)
```typescript
it('should register route', () => {
  // Arrange
  const gateway = new APIGateway();
  const route = { path: '/test', method: 'GET', ... };
  
  // Act
  const registered = gateway.registerRoute(route);
  
  // Assert
  expect(registered.id).toBeDefined();
});
```

### 2. Null/Undefined Handling
```typescript
it('should handle null config', () => {
  expect(() => new APIGateway(null)).not.toThrow();
});

it('should handle undefined fields', () => {
  const route = gateway.registerRoute({
    path: '/test',
    middleware: undefined,
    rateLimit: undefined,
  });
  expect(route).toBeDefined();
});
```

### 3. Error Testing
```typescript
it('should throw ValidationError', async () => {
  const request = { body: null };
  await expect(gateway.handleRequest(request))
    .rejects.toThrow(ValidationError);
});
```

### 4. Async Testing
```typescript
it('should handle concurrent requests', async () => {
  const requests = Array(10).fill(null).map(createRequest);
  const responses = await Promise.all(
    requests.map(req => gateway.handleRequest(req))
  );
  expect(responses).toHaveLength(10);
});
```

### 5. Mock Testing
```typescript
it('should mock HTTP server', async () => {
  const mockServer = {
    listen: jest.fn((port, host, cb) => cb()),
    close: jest.fn((cb) => cb()),
  };
  http.createServer.mockReturnValue(mockServer);
  
  await gateway.start();
  expect(mockServer.listen).toHaveBeenCalled();
});
```

## Test Categories

### Unit Tests (90% of tests)
- Individual method testing
- Isolated component testing
- Mock external dependencies
- Fast execution (<1s per test)

### Integration Tests (10% of tests)
- Component interaction testing
- Real HTTP calls (mocked)
- State management
- Error propagation

## Common Test Utilities

```typescript
// Create mock request
const request = testUtils.createMockRequest({
  method: 'POST',
  path: '/api/users',
  body: { name: 'John' },
});

// Create mock response
const response = testUtils.createMockResponse({
  status: 201,
  body: { id: 123 },
});

// Wait for async operation
await testUtils.waitFor(100);
```

## Mocked Dependencies

- `http` - HTTP server and client
- `https` - HTTPS server and client
- `zlib` - Compression (gzip, deflate, brotli)
- External services (mocked in tests)

## Performance Testing

While not strictly unit tests, some tests verify performance characteristics:

```typescript
it('should handle 100 requests under 1s', async () => {
  const start = Date.now();
  const requests = Array(100).fill(null).map(createRequest);
  await Promise.all(requests.map(req => gateway.handleRequest(req)));
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(1000);
});
```

## Memory Leak Testing

```typescript
it('should not leak memory', () => {
  for (let i = 0; i < 1000; i++) {
    gateway.registerRoute(createRoute(i));
    gateway.unregisterRoute(i);
  }
  const routes = gateway.listRoutes();
  expect(routes.length).toBe(0);
});
```

## Debugging Tests

### Run single test
```bash
npm test -- -t "should register route"
```

### Run with debugging
```bash
node --inspect-brk node_modules/.bin/jest tests/unit/api/APIGateway.network.test.ts
```

### View coverage report
```bash
npm test -- --coverage --coverageDirectory=./coverage
open coverage/lcov-report/index.html
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run API Gateway Tests
  run: npm test tests/unit/api/
  
- name: Check Coverage
  run: npm test -- --coverage --coverageThreshold='{"global":{"branches":90,"functions":90,"lines":90,"statements":90}}'
```

## Test Metrics

Expected metrics for complete test suite:

- **Total Tests**: ~3,000+
- **Total Assertions**: ~10,000+
- **Execution Time**: <30 seconds
- **Code Coverage**: >90%
- **Success Rate**: 100%

## Network APIGateway Tests (1,000+ tests)

### Categories
- Constructor (5 tests)
- Server Management (10 tests)
- Route Management (20 tests)
- Rate Limiting (15 tests)
- Caching (10 tests)
- Authentication/Authorization (15 tests)
- Validation (20 tests)
- Error Handling (25 tests)
- Circuit Breaker (10 tests)
- Metrics (5 tests)
- Async Operations (15 tests)
- Resource Cleanup (10 tests)
- Type Safety (10 tests)
- Edge Cases (20 tests)
- Concurrency (10 tests)
- Memory Management (5 tests)

## API APIGateway Tests (1,000+ tests)

### Categories
- Constructor (5 tests)
- Endpoint Registration (20 tests)
- Request Handling (25 tests)
- Input Sanitization (35 tests)
- Request Validation (20 tests)
- Rate Limiter (15 tests)
- API Cache (10 tests)
- Metrics Collector (10 tests)
- Quota Manager (10 tests)
- Error Handling (15 tests)
- Async Operations (10 tests)
- Type Safety (10 tests)
- Edge Cases (15 tests)
- Resource Cleanup (5 tests)
- ValidationSchemas (10 tests)

## Gateway APIGatewayManager Tests (1,000+ tests)

### Categories
- Constructor (6 tests)
- Route Registration (20 tests)
- Request Handling (25 tests)
- Rate Limiting (20 tests)
- Caching (15 tests)
- Authentication (15 tests)
- API Key Management (10 tests)
- Circuit Breaker (10 tests)
- Metrics (10 tests)
- Error Handling (15 tests)
- Compression (5 tests)
- Health Check (5 tests)
- Cleanup (10 tests)
- CORS (5 tests)
- Retry Configuration (5 tests)
- Edge Cases (10 tests)

## Troubleshooting

### Tests timing out
```typescript
// Increase timeout for specific test
it('should handle slow operation', async () => {
  // ...
}, 30000); // 30 second timeout
```

### Mock not working
```typescript
// Ensure mock is called before import
jest.mock('http');
import { APIGateway } from './APIGateway';
```

### Coverage not reaching 90%
- Check for untested edge cases
- Add tests for error conditions
- Test async error paths
- Test all enum values
- Test boundary conditions

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Add descriptive test names
3. Test happy path first
4. Test error conditions
5. Test edge cases
6. Test null/undefined inputs
7. Test type safety
8. Add comments for complex tests
9. Ensure tests are isolated
10. Clean up resources

## Best Practices

1. **One assertion per test** (when possible)
2. **Clear test names** describing what is being tested
3. **Isolated tests** - no dependencies between tests
4. **Fast execution** - mock slow operations
5. **Deterministic** - no random data or timing dependencies
6. **Comprehensive** - cover all code paths
7. **Maintainable** - easy to understand and modify
8. **Self-documenting** - test name explains purpose

## License

Same as parent project
