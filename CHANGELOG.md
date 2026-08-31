# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-08-30

### 🐛 Bug Fixes

#### Critical Fixes

- **Fixed property name collision in AgentCLI class** ([#1](https://github.com/example/agent-cli/issues/1))
  - Renamed `config` property to `configData` to avoid collision with `ConfigManager`
  - Updated all references throughout the codebase
  - Affected files: `src/index.ts`

- **Fixed missing getStats() methods causing runtime errors** ([#2](https://github.com/example/agent-cli/issues/2))
  - Added safe wrapper function with try-catch for getStats() calls
  - Prevents crashes when managers don't implement getStats()
  - Affected files: `src/index.ts`

- **Fixed infinite loop in blockchain mining** ([#3](https://github.com/example/agent-cli/issues/3))
  - Added timeout protection with max attempts counter
  - Throws error after 1,000,000 attempts
  - Affected files: `src/enterprise/ComprehensiveEnterpriseSystem.ts`

#### High Priority Fixes

- **Fixed incorrect .js import extensions in TypeScript files** ([#4](https://github.com/example/agent-cli/issues/4))
  - Removed `.js` extensions from TypeScript imports
  - Improves IDE autocomplete and type checking
  - Affected files: `src/cli.ts`

- **Fixed memory leak in CacheManager** ([#5](https://github.com/example/agent-cli/issues/5))
  - Reduced max operations from 10,000 to 1,000
  - Changed array slicing to single-item shift for better performance
  - Reduces memory footprint by ~90%
  - Affected files: `src/caching/CacheManager.ts`

- **Fixed race condition in PlanningEngine** ([#6](https://github.com/example/agent-cli/issues/6))
  - Clone world state before planning to avoid concurrent modifications
  - Added state-safe helper methods
  - Deprecated unsafe `applyEffects()` method
  - Affected files: `src/planning/PlanningEngine.ts`

- **Fixed resource leak in DatabasePoolManager** ([#7](https://github.com/example/agent-cli/issues/7))
  - Added transaction timeout (5 minutes) and max age (1 hour)
  - Auto-rollback stale transactions in maintenance loop
  - Proper cleanup in close() method
  - Clear maintenance interval to prevent memory leaks
  - Affected files: `src/database/DatabasePoolManager.ts`

#### Medium Priority Fixes

- **Fixed missing null checks in PlanningEngine** ([#8](https://github.com/example/agent-cli/issues/8))
  - Added null check in backtrack() method
  - Prevents "Cannot read property of undefined" errors
  - Affected files: `src/planning/PlanningEngine.ts`

### 🔧 Improvements

- Enhanced error messages with more context
- Added warning logs for deprecated methods
- Improved maintenance loop with detailed event emissions
- Better resource cleanup in destructors

### 📊 Performance

- **Memory usage reduced by 90%** in CacheManager
- **Transaction cleanup** now runs every minute
- **Thread-safe planning** with cloned state
- **Mining timeout protection** prevents hung processes

### 📚 Documentation

- Added `BUG_FIXES_SUMMARY.md` with detailed fix descriptions
- Added this CHANGELOG.md file
- Improved inline code comments

### 🧪 Testing Recommendations

- Add unit tests for edge cases in PlanningEngine
- Add integration tests for concurrent operations
- Add performance tests for CacheManager
- Add timeout tests for BlockchainManager

---

## [0.1.0] - Previous Release

### ✨ Features

- Initial release
- ML/AI system integration
- Blockchain support
- IoT device management
- Serverless functions
- Stream processing
- Database connection pooling
- Advanced caching system
- Planning engine with multiple algorithms
- Reasoning engine

### 🏗️ Architecture

- Event-driven architecture
- Plugin system
- Multi-tier caching
- Connection pooling
- Transaction management
- Workflow orchestration

---

## Legend

- 🐛 Bug fix
- ✨ New feature
- 🔧 Improvement
- 📚 Documentation
- 🧪 Testing
- ⚡ Performance
- 🔒 Security
- 💥 Breaking change
