# AI Modules Integration Tests

Comprehensive integration test suite for AI modules covering real database connections, API calls, file operations, and end-to-end workflows.

## Test Coverage

### 1. LearningSystem Integration Tests
**File:** `learning-system.integration.test.ts`

- **Real File Operations**
  - Persist feedback to disk
  - Load existing data on initialization
  - Handle concurrent writes without corruption
  - Graceful file system error handling

- **End-to-End Learning Flow**
  - Learn from multiple feedback and improve recommendations
  - Extract and store user preferences
  - Track success rates over time

- **Error Propagation**
  - File read errors during initialization
  - Initialization timeout handling
  - Recovery from corrupted data files

- **Multi-Module Interactions**
  - Event system integration
  - State persistence across system restarts

- **Concurrent Operations**
  - Concurrent feedback recording
  - Data consistency under concurrent access

- **Transaction-like Behavior**
  - Consistency when save fails
  - Atomic reset operations

### 2. MultiModelOrchestrator Integration Tests
**File:** `multi-model-orchestrator.integration.test.ts`

- **Real Model Registration and Routing**
  - Register multiple models and route requests
  - Select models based on capability requirements

- **Automatic Fallback Mechanism**
  - Fallback to secondary model on primary failure
  - Try multiple fallbacks in order
  - Error handling when all models fail

- **Performance Tracking**
  - Track success rates and prefer reliable models
  - Track and report latency statistics

- **Concurrent Request Handling**
  - Handle concurrent requests to different models
  - Maintain request isolation under concurrent load

- **Error Propagation**
  - Propagate provider errors with context
  - Handle model not found errors
  - Handle invalid requirement constraints

- **Multi-Module Integration**
  - Emit events during routing lifecycle
  - Provide comprehensive statistics

### 3. MultiModalAI Integration Tests
**File:** `multi-modal-ai.integration.test.ts`

- **Vision Processing Integration**
  - Image classification end-to-end
  - Object detection with bounding boxes
  - OCR on images with text
  - Face recognition with metadata
  - Image caption generation

- **Audio Processing Integration**
  - Audio transcription with segments
  - Speaker detection and separation
  - Emotion detection in audio
  - Text-to-speech conversion

- **Video Processing Integration**
  - Comprehensive video analysis
  - Scene change detection

- **Concurrent Processing**
  - Concurrent image processing
  - Concurrent audio transcription
  - Mixed multimodal concurrent operations

- **Error Handling**
  - Processing failures gracefully
  - Task lifecycle events
  - Task failure tracking

- **End-to-End Workflows**
  - Image → OCR → Text analysis
  - Video → Audio extraction → Transcription
  - Multiple images with face recognition

- **Real File Operations**
  - Process images from disk
  - Process multiple files concurrently
  - Handle large files appropriately

- **Statistics and Monitoring**
  - Track processing statistics
  - Track task counts over time

### 4. AgentOrchestration Integration Tests
**File:** `agent-orchestration.integration.test.ts`

- **Multi-Agent Task Decomposition**
  - Code analysis task decomposition
  - Implementation task decomposition
  - Refactoring task decomposition
  - Generic task handling

- **Agent Selection and Assignment**
  - Select best agent based on capabilities
  - Prefer agents with higher success rates
  - Handle multiple agents with same capabilities

- **Workflow Execution**
  - Execute tasks in correct order based on dependencies
  - Execute independent tasks in parallel
  - Handle complex dependency graphs
  - Detect circular dependencies

- **Agent Communication**
  - Send and route messages between agents
  - Handle message delivery to valid agents
  - Queue messages for processing

- **Consensus Mechanisms**
  - Majority consensus
  - Weighted consensus based on priority
  - Unanimous consensus

- **Error Handling**
  - Handle task failures gracefully
  - Handle missing agent for task
  - Track agent performance metrics

- **Concurrent Operations**
  - Multiple concurrent workflows
  - Maintain agent state consistency under load
  - Handle agent registration/unregistration during execution

- **Statistics and Monitoring**
  - Comprehensive orchestration statistics
  - Track agent idle/busy states
  - Track task status distribution

### 5. DatasetManager Integration Tests
**File:** `dataset-manager.integration.test.ts`

- **Dataset Creation and Management**
  - Create dataset with examples and metadata
  - Calculate statistics on creation
  - Add examples to existing dataset
  - Update metadata when examples are added

- **Dataset Augmentation**
  - Augment with paraphrasing
  - Apply multiple augmentation methods
  - Replace originals or preserve them
  - Track augmentation sources
  - Handle concurrent augmentation requests

- **Filtering and Quality Control**
  - Filter by length constraints
  - Filter by quality threshold
  - Remove duplicate examples
  - Remove statistical outliers

- **Bias Detection**
  - Detect gender bias
  - Detect length uniformity bias
  - Provide recommendations

- **Dataset Versioning**
  - Create versions of datasets
  - Retrieve specific versions
  - Maintain independent version histories

- **Import and Export**
  - Export to JSON, JSONL, CSV
  - Import from JSON, JSONL, CSV
  - Round-trip export and import

- **Real File Operations**
  - Export to file and reimport
  - Handle multiple export formats concurrently

- **Concurrent Operations**
  - Concurrent dataset creation
  - Concurrent modifications
  - Maintain consistency during augmentation and filtering

- **Event-Driven Integration**
  - Emit events during dataset lifecycle
  - Provide detailed event data

### 6. End-to-End AI Integration Tests
**File:** `end-to-end.integration.test.ts`

- **Complete AI Workflow: Code Analysis**
  - Register models → Process code → Record feedback → Verify learning
  - Coordinate multiple agents for complex tasks

- **Multimodal AI Pipeline**
  - Image → OCR → AI analysis → Learning
  - Audio transcription → Dataset creation → Learning

- **Multi-Model Coordination**
  - Route tasks to best model based on learned preferences
  - Handle model failures with automatic fallback and learning

- **Dataset-Driven Training Workflow**
  - Create → Augment → Filter → Export for training
  - Version datasets and track improvements

- **Concurrent Operations at Scale**
  - High-volume concurrent requests (50+ simultaneous)
  - Mixed multimodal operations concurrently

- **Error Recovery and Resilience**
  - Recover from provider failures
  - Handle file system errors

- **Cross-Module Data Flow**
  - Complete pipeline: Multimodal → AI → Dataset → Learning

## Running Tests

### Run all integration tests
```bash
npm test -- tests/integration/ai/
```

### Run specific test suite
```bash
npm test -- tests/integration/ai/learning-system.integration.test.ts
npm test -- tests/integration/ai/multi-model-orchestrator.integration.test.ts
npm test -- tests/integration/ai/multi-modal-ai.integration.test.ts
npm test -- tests/integration/ai/agent-orchestration.integration.test.ts
npm test -- tests/integration/ai/dataset-manager.integration.test.ts
npm test -- tests/integration/ai/end-to-end.integration.test.ts
```

### Run with coverage
```bash
npm run test:coverage -- tests/integration/ai/
```

### Run in watch mode
```bash
npm run test:watch -- tests/integration/ai/
```

## Test Features

### Real Database Connections
- Tests use actual file system operations with temporary directories
- Real file I/O for persistence testing
- Proper cleanup after each test

### Real API Calls (with test endpoints)
- Mock AI providers that simulate real API behavior
- Configurable latency and failure rates
- Request logging and statistics

### Real File Operations
- Create, read, update, delete operations on temp directories
- File permission testing
- Concurrent file access testing
- Large file handling

### End-to-End Flows
- Complete workflows from input to output
- Multi-step processes with data transformation
- Integration between multiple modules

### Multi-Module Interactions
- Event-driven communication between modules
- Shared state management
- Cross-module data flow

### Error Propagation
- Test error handling at each layer
- Verify error messages and context
- Test recovery mechanisms

### Transaction Handling
- Atomic operations testing
- Rollback on failure
- Consistency guarantees

### Concurrent Operations
- Parallel request processing
- Race condition testing
- Thread-safety verification
- Load testing with high concurrency

## Test Utilities

### Mock AI Provider
```typescript
class TestAIProvider implements AIProvider {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Simulates real AI API with configurable behavior
  }
}
```

Features:
- Configurable response delay
- Failure simulation
- Request logging
- Usage tracking

### Temporary Directory Management
- Automatic creation before each test
- Automatic cleanup after each test
- Unique directories per test to avoid conflicts

### Event Tracking
- Listen to module events
- Verify event sequence
- Check event payloads

## Best Practices

1. **Isolation**: Each test is independent and can run in any order
2. **Cleanup**: Resources are properly cleaned up after each test
3. **Real Operations**: Tests use real I/O, not just mocks
4. **Comprehensive**: Cover happy paths, edge cases, and error scenarios
5. **Performance**: Tests verify performance characteristics (latency, throughput)
6. **Concurrency**: Tests verify thread-safety and race conditions
7. **Documentation**: Clear test names and descriptions

## Test Containers

The tests are designed to support test containers for:
- Database connections (when database modules are integrated)
- Message queues (for async communication)
- Cache systems (for performance testing)

To add test containers, install:
```bash
npm install --save-dev @testcontainers/postgresql @testcontainers/redis
```

## Performance Benchmarks

Integration tests track:
- Request latency
- Throughput (requests per second)
- Memory usage
- File I/O performance
- Concurrent operation scaling

## Troubleshooting

### Tests Timeout
- Increase Jest timeout in jest.config.js
- Check for resource leaks
- Verify cleanup in afterEach hooks

### File Permission Errors
- Ensure temp directory is writable
- Check cleanup in previous tests
- Verify directory permissions

### Concurrent Test Failures
- Use unique temp directories per test
- Avoid shared state between tests
- Ensure proper synchronization

### Memory Issues
- Verify cleanup of large buffers
- Check for event listener leaks
- Monitor file handle cleanup

## Contributing

When adding new integration tests:
1. Follow the existing test structure
2. Use real operations, not just mocks
3. Test error cases and edge conditions
4. Include concurrent operation tests
5. Document expected behavior
6. Add cleanup in afterEach hooks
7. Use descriptive test names
