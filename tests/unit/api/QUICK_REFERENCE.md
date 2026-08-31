# APIGateway Unit Tests - Quick Reference

## Quick Start

```bash
# Run all tests
npm test tests/unit/api/

# Or use the test runner script
./tests/unit/api/run-tests.sh

# Run with coverage
npm test tests/unit/api/ -- --coverage

# Run specific implementation
npm test tests/unit/api/APIGateway.network.test.ts
npm test tests/unit/api/APIGateway.api.test.ts
npm test tests/unit/api/APIGateway.gateway.test.ts
```

## Test Files

| File | Implementation | Tests | Lines |
|------|---------------|-------|-------|
| `APIGateway.network.test.ts` | `/src/network/APIGateway.ts` | 190+ | 1,200+ |
| `APIGateway.api.test.ts` | `/src/api/APIGateway.ts` | 200+ | 1,800+ |
| `APIGateway.gateway.test.ts` | `/src/gateway/APIGateway.ts` | 180+ | 2,000+ |

## Coverage Target

All metrics must exceed **90%**:
- ✓ Branches: >90%
- ✓ Functions: >90%
- ✓ Lines: >90%
- ✓ Statements: >90%

## Test Categories (All Implementations)

### Core Functionality
- [x] Constructor & initialization
- [x] Route/endpoint registration
- [x] Request handling
- [x] Response generation
- [x] Server lifecycle

### Security
- [x] Authentication (Bearer, API Key, JWT, OAuth2, Basic)
- [x] Authorization (Roles, Scopes, Permissions)
- [x] Input sanitization (XSS, SQL, Command, Path)
- [x] Validation (Zod schemas, custom validators)
- [x] Rate limiting (Fixed/Sliding window, Token/Leaky bucket)

### Performance
- [x] Caching (GET requests, TTL, vary-by)
- [x] Compression (Gzip, Deflate, Brotli)
- [x] Circuit breaker (Open/Closed/Half-open states)
- [x] Load balancing
- [x] Connection pooling

### Reliability
- [x] Error handling (All error types)
- [x] Retry logic (Exponential backoff)
- [x] Timeout handling
- [x] Health checks
- [x] Graceful shutdown

### Observability
- [x] Metrics collection
- [x] Request logging
- [x] Error logging
- [x] Performance tracking
- [x] Latency percentiles

### Edge Cases
- [x] Null/undefined inputs
- [x] Empty values
- [x] Large payloads
- [x] Special characters
- [x] Concurrent operations
- [x] Memory leaks

## Test Utilities

```typescript
// Available in jest.setup.js
global.testUtils.createMockRequest(overrides)
global.testUtils.createMockResponse(overrides)
global.testUtils.waitFor(ms)
```

## Debugging

```bash
# Run single test
npm test -- -t "should register route"

# Debug mode
node --inspect-brk node_modules/.bin/jest tests/unit/api/APIGateway.network.test.ts

# Verbose output
npm test tests/unit/api/ -- --verbose

# Watch mode
npm test tests/unit/api/ -- --watch
```

## CI/CD

```bash
# CI pipeline command
npm test tests/unit/api/ -- --coverage --ci --maxWorkers=2

# Pre-commit hook
npm test tests/unit/api/ --silent
```

## Expected Results

```
Test Suites: 3 passed, 3 total
Tests:       570+ passed, 570+ total
Time:        ~20-30s
Coverage:    >90% all metrics
```

## Files Structure

```
tests/unit/api/
├── APIGateway.network.test.ts  # Network implementation
├── APIGateway.api.test.ts      # API implementation  
├── APIGateway.gateway.test.ts  # Gateway implementation
├── jest.config.js              # Jest configuration
├── jest.setup.js               # Test utilities
├── run-tests.sh                # Test runner script
├── README.md                   # Full documentation
├── TEST_SUMMARY.md             # Detailed summary
└── QUICK_REFERENCE.md          # This file
```

## Common Issues

### Tests timeout
```typescript
it('slow test', async () => {
  // ...
}, 30000); // Increase timeout
```

### Mocks not working
```typescript
// Mock before import
jest.mock('http');
import { APIGateway } from './APIGateway';
```

### Coverage below 90%
- Add edge case tests
- Test error conditions
- Test all enum values
- Test async error paths

## Links

- Full Documentation: [README.md](./README.md)
- Test Summary: [TEST_SUMMARY.md](./TEST_SUMMARY.md)
- Jest Config: [jest.config.js](./jest.config.js)
- Test Runner: [run-tests.sh](./run-tests.sh)
