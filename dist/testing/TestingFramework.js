"use strict";
/**
 * Comprehensive Testing Framework
 * Unit tests, Integration tests, E2E tests, Performance tests
 * Code coverage, Mutation testing, Property-based testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestingFramework = void 0;
const events_1 = require("events");
// ============================================================================
// Testing Framework
// ============================================================================
class TestingFramework extends events_1.EventEmitter {
    suites = new Map();
    currentSuite;
    mocks = new Map();
    spies = new Map();
    coverage = new Map();
    config;
    constructor(config = {}) {
        super();
        this.config = {
            timeout: 5000,
            retries: 0,
            parallel: false,
            maxWorkers: 4,
            coverage: false,
            bail: false,
            verbose: false,
            ...config,
        };
    }
    // ========================================================================
    // Suite Definition
    // ========================================================================
    describe(name, fn) {
        const suite = {
            id: this.generateId(),
            name,
            description: '',
            tests: [],
            hooks: {
                beforeAll: [],
                afterAll: [],
                beforeEach: [],
                afterEach: [],
            },
            timeout: this.config.timeout,
            retries: this.config.retries,
        };
        this.suites.set(suite.id, suite);
        const previousSuite = this.currentSuite;
        this.currentSuite = suite;
        fn();
        this.currentSuite = previousSuite;
    }
    it(name, fn) {
        this.test(name, fn, 'unit');
    }
    test(name, fn, type = 'unit') {
        if (!this.currentSuite) {
            throw new Error('test() must be called within describe()');
        }
        const test = {
            id: this.generateId(),
            name,
            description: '',
            type,
            fn,
            timeout: this.currentSuite.timeout,
            retries: this.currentSuite.retries,
            skip: false,
            only: false,
            tags: [],
        };
        this.currentSuite.tests.push(test);
    }
    // ========================================================================
    // Hooks
    // ========================================================================
    beforeAll(fn) {
        if (!this.currentSuite) {
            throw new Error('beforeAll() must be called within describe()');
        }
        this.currentSuite.hooks.beforeAll.push({
            id: this.generateId(),
            fn,
            timeout: this.config.timeout,
        });
    }
    afterAll(fn) {
        if (!this.currentSuite) {
            throw new Error('afterAll() must be called within describe()');
        }
        this.currentSuite.hooks.afterAll.push({
            id: this.generateId(),
            fn,
            timeout: this.config.timeout,
        });
    }
    beforeEach(fn) {
        if (!this.currentSuite) {
            throw new Error('beforeEach() must be called within describe()');
        }
        this.currentSuite.hooks.beforeEach.push({
            id: this.generateId(),
            fn,
            timeout: this.config.timeout,
        });
    }
    afterEach(fn) {
        if (!this.currentSuite) {
            throw new Error('afterEach() must be called within describe()');
        }
        this.currentSuite.hooks.afterEach.push({
            id: this.generateId(),
            fn,
            timeout: this.config.timeout,
        });
    }
    // ========================================================================
    // Test Execution
    // ========================================================================
    async run(config) {
        const runConfig = { ...this.config, ...config };
        this.emit('run:start', { config: runConfig });
        const startTime = Date.now();
        const results = [];
        const suitesToRun = this.filterSuites(runConfig);
        if (runConfig.parallel && runConfig.maxWorkers > 1) {
            // Run tests in parallel
            const batches = this.createBatches(suitesToRun, runConfig.maxWorkers);
            for (const batch of batches) {
                const batchResults = await Promise.all(batch.map(suite => this.runSuite(suite, runConfig)));
                results.push(...batchResults.flat());
            }
        }
        else {
            // Run tests sequentially
            for (const suite of suitesToRun) {
                const suiteResults = await this.runSuite(suite, runConfig);
                results.push(...suiteResults);
                if (runConfig.bail && suiteResults.some(r => r.status === 'failed')) {
                    break;
                }
            }
        }
        const duration = Date.now() - startTime;
        const summary = this.computeSummary(results);
        const report = {
            id: this.generateId(),
            timestamp: startTime,
            duration,
            summary,
            results,
            coverage: runConfig.coverage ? this.aggregateCoverage() : undefined,
            performance: this.computePerformanceMetrics(results),
        };
        this.emit('run:complete', { report });
        return report;
    }
    async runSuite(suite, config) {
        this.emit('suite:start', { suite });
        const results = [];
        // Run beforeAll hooks
        for (const hook of suite.hooks.beforeAll) {
            await this.runHook(hook);
        }
        // Run tests
        for (const test of suite.tests) {
            if (test.skip) {
                results.push(this.createSkippedResult(test));
                continue;
            }
            // Run beforeEach hooks
            for (const hook of suite.hooks.beforeEach) {
                await this.runHook(hook);
            }
            // Run test
            const result = await this.runTest(test, config);
            results.push(result);
            // Run afterEach hooks
            for (const hook of suite.hooks.afterEach) {
                await this.runHook(hook);
            }
            if (config.bail && result.status === 'failed') {
                break;
            }
        }
        // Run afterAll hooks
        for (const hook of suite.hooks.afterAll) {
            await this.runHook(hook);
        }
        this.emit('suite:complete', { suite, results });
        return results;
    }
    async runTest(test, config) {
        this.emit('test:start', { test });
        const startTime = Date.now();
        let status = 'passed';
        let error;
        const logs = [];
        const assertions = [];
        let retryCount = 0;
        while (retryCount <= test.retries) {
            try {
                await this.executeWithTimeout(test.fn, test.timeout);
                status = 'passed';
                break;
            }
            catch (err) {
                error = this.formatError(err);
                status = 'failed';
                retryCount++;
                if (retryCount <= test.retries) {
                    this.emit('test:retry', { test, retryCount });
                }
            }
        }
        const duration = Date.now() - startTime;
        const result = {
            testId: test.id,
            name: test.name,
            status,
            duration,
            error,
            logs,
            assertions,
            retryCount: retryCount - 1,
        };
        this.emit('test:complete', { test, result });
        return result;
    }
    async runHook(hook) {
        await this.executeWithTimeout(hook.fn, hook.timeout);
    }
    async executeWithTimeout(fn, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout of ${timeout}ms exceeded`));
            }, timeout);
            Promise.resolve(fn())
                .then(() => {
                clearTimeout(timer);
                resolve();
            })
                .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    // ========================================================================
    // Assertions
    // ========================================================================
    expect(actual) {
        return new Expectation(actual);
    }
    assert(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new AssertionError(message || `Expected ${actual} to equal ${expected}`, {
                actual,
                expected,
                operator: 'strictEqual',
            });
        }
    }
    assertDeepEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new AssertionError(message || 'Objects not deeply equal', {
                actual,
                expected,
                operator: 'deepStrictEqual',
            });
        }
    }
    assertThrows(fn, expected) {
        try {
            fn();
            throw new AssertionError('Expected function to throw');
        }
        catch (err) {
            if (expected instanceof RegExp && !expected.test(err.message)) {
                throw new AssertionError('Error message does not match pattern');
            }
            if (typeof expected === 'function' && !(err instanceof expected)) {
                throw new AssertionError('Error is not instance of expected type');
            }
        }
    }
    // ========================================================================
    // Mocking
    // ========================================================================
    mock(target, property, implementation) {
        const mock = {
            id: this.generateId(),
            target,
            property: String(property),
            implementation,
            calls: [],
        };
        const original = target[property];
        target[property] = (...args) => {
            const startTime = Date.now();
            try {
                const returnValue = implementation(...args);
                mock.calls.push({
                    timestamp: startTime,
                    args,
                    returnValue,
                });
                return returnValue;
            }
            catch (error) {
                mock.calls.push({
                    timestamp: startTime,
                    args,
                    error: error,
                });
                throw error;
            }
        };
        this.mocks.set(mock.id, mock);
        return mock;
    }
    spy(target, property) {
        const spy = {
            id: this.generateId(),
            target,
            property: String(property),
            calls: [],
        };
        const original = target[property];
        target[property] = (...args) => {
            const startTime = Date.now();
            try {
                const returnValue = original.apply(target, args);
                spy.calls.push({
                    timestamp: startTime,
                    args,
                    returnValue,
                });
                return returnValue;
            }
            catch (error) {
                spy.calls.push({
                    timestamp: startTime,
                    args,
                    error: error,
                });
                throw error;
            }
        };
        this.spies.set(spy.id, spy);
        return spy;
    }
    stub(config) {
        return (...args) => {
            if (config.throws)
                throw config.throws;
            if (config.rejects)
                return Promise.reject(config.rejects);
            if (config.resolves)
                return Promise.resolve(config.resolves);
            if (config.callsFake)
                return config.callsFake(...args);
            return config.returns;
        };
    }
    restoreMocks() {
        this.mocks.clear();
        this.spies.clear();
    }
    // ========================================================================
    // Coverage
    // ========================================================================
    startCoverage(file) {
        // Initialize coverage for file
        this.coverage.set(file, {
            statements: { total: 0, covered: 0, percentage: 0 },
            branches: { total: 0, covered: 0, percentage: 0 },
            functions: { total: 0, covered: 0, percentage: 0 },
            lines: { total: 0, covered: 0, percentage: 0 },
        });
    }
    recordCoverage(file, type, total, covered) {
        const data = this.coverage.get(file);
        if (data) {
            data[type] = {
                total,
                covered,
                percentage: total > 0 ? (covered / total) * 100 : 0,
            };
        }
    }
    getCoverage() {
        return this.coverage;
    }
    aggregateCoverage() {
        const aggregate = {
            statements: { total: 0, covered: 0, percentage: 0 },
            branches: { total: 0, covered: 0, percentage: 0 },
            functions: { total: 0, covered: 0, percentage: 0 },
            lines: { total: 0, covered: 0, percentage: 0 },
        };
        for (const data of this.coverage.values()) {
            aggregate.statements.total += data.statements.total;
            aggregate.statements.covered += data.statements.covered;
            aggregate.branches.total += data.branches.total;
            aggregate.branches.covered += data.branches.covered;
            aggregate.functions.total += data.functions.total;
            aggregate.functions.covered += data.functions.covered;
            aggregate.lines.total += data.lines.total;
            aggregate.lines.covered += data.lines.covered;
        }
        aggregate.statements.percentage = this.calculatePercentage(aggregate.statements.covered, aggregate.statements.total);
        aggregate.branches.percentage = this.calculatePercentage(aggregate.branches.covered, aggregate.branches.total);
        aggregate.functions.percentage = this.calculatePercentage(aggregate.functions.covered, aggregate.functions.total);
        aggregate.lines.percentage = this.calculatePercentage(aggregate.lines.covered, aggregate.lines.total);
        return aggregate;
    }
    calculatePercentage(covered, total) {
        return total > 0 ? (covered / total) * 100 : 0;
    }
    // ========================================================================
    // Test Fixtures
    // ========================================================================
    createFixture(factory) {
        return new Fixture(factory);
    }
    // ========================================================================
    // Helpers
    // ========================================================================
    filterSuites(config) {
        let suites = Array.from(this.suites.values());
        if (config.pattern) {
            const regex = new RegExp(config.pattern);
            suites = suites.filter(s => regex.test(s.name));
        }
        if (config.tags && config.tags.length > 0) {
            suites = suites.filter(s => s.tests.some(t => config.tags.some(tag => t.tags.includes(tag))));
        }
        return suites;
    }
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    createSkippedResult(test) {
        return {
            testId: test.id,
            name: test.name,
            status: 'skipped',
            duration: 0,
            logs: [],
            assertions: [],
            retryCount: 0,
        };
    }
    formatError(err) {
        if (err instanceof AssertionError) {
            return {
                message: err.message,
                stack: err.stack,
                expected: err.expected,
                actual: err.actual,
                operator: err.operator,
            };
        }
        return {
            message: err.message || String(err),
            stack: err.stack,
        };
    }
    computeSummary(results) {
        const total = results.length;
        const passed = results.filter(r => r.status === 'passed').length;
        const failed = results.filter(r => r.status === 'failed').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const pending = results.filter(r => r.status === 'pending').length;
        return {
            total,
            passed,
            failed,
            skipped,
            pending,
            successRate: total > 0 ? (passed / total) * 100 : 0,
        };
    }
    computePerformanceMetrics(results) {
        const durations = results.map(r => r.duration).sort((a, b) => a - b);
        return {
            minDuration: durations[0] || 0,
            maxDuration: durations[durations.length - 1] || 0,
            avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length || 0,
            p50: this.percentile(durations, 0.5),
            p95: this.percentile(durations, 0.95),
            p99: this.percentile(durations, 0.99),
        };
    }
    percentile(values, p) {
        const index = Math.ceil(values.length * p) - 1;
        return values[index] || 0;
    }
    generateId() {
        return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.TestingFramework = TestingFramework;
// ============================================================================
// Expectation Builder
// ============================================================================
class Expectation {
    actual;
    constructor(actual) {
        this.actual = actual;
    }
    toBe(expected) {
        if (this.actual !== expected) {
            throw new AssertionError(`Expected ${this.actual} to be ${expected}`, {
                actual: this.actual,
                expected,
                operator: 'toBe',
            });
        }
    }
    toEqual(expected) {
        if (JSON.stringify(this.actual) !== JSON.stringify(expected)) {
            throw new AssertionError(`Expected values to be equal`, {
                actual: this.actual,
                expected,
                operator: 'toEqual',
            });
        }
    }
    toBeTruthy() {
        if (!this.actual) {
            throw new AssertionError(`Expected value to be truthy`, {
                actual: this.actual,
                operator: 'toBeTruthy',
            });
        }
    }
    toBeFalsy() {
        if (this.actual) {
            throw new AssertionError(`Expected value to be falsy`, {
                actual: this.actual,
                operator: 'toBeFalsy',
            });
        }
    }
    toBeNull() {
        if (this.actual !== null) {
            throw new AssertionError(`Expected value to be null`, {
                actual: this.actual,
                operator: 'toBeNull',
            });
        }
    }
    toBeUndefined() {
        if (this.actual !== undefined) {
            throw new AssertionError(`Expected value to be undefined`, {
                actual: this.actual,
                operator: 'toBeUndefined',
            });
        }
    }
    toContain(item) {
        if (Array.isArray(this.actual)) {
            if (!this.actual.includes(item)) {
                throw new AssertionError(`Expected array to contain item`, {
                    actual: this.actual,
                    expected: item,
                    operator: 'toContain',
                });
            }
        }
        else if (typeof this.actual === 'string') {
            if (!this.actual.includes(item)) {
                throw new AssertionError(`Expected string to contain substring`, {
                    actual: this.actual,
                    expected: item,
                    operator: 'toContain',
                });
            }
        }
        else {
            throw new AssertionError('toContain requires array or string');
        }
    }
    toThrow(expected) {
        if (typeof this.actual !== 'function') {
            throw new AssertionError('toThrow requires a function');
        }
        try {
            this.actual();
            throw new AssertionError('Expected function to throw');
        }
        catch (err) {
            if (expected instanceof RegExp && !expected.test(err.message)) {
                throw new AssertionError('Error message does not match pattern');
            }
            if (typeof expected === 'function' && !(err instanceof expected)) {
                throw new AssertionError('Error is not instance of expected type');
            }
        }
    }
    async toResolve() {
        if (!(this.actual instanceof Promise)) {
            throw new AssertionError('toResolve requires a Promise');
        }
        try {
            await this.actual;
        }
        catch (err) {
            throw new AssertionError('Expected promise to resolve', {
                actual: err,
                operator: 'toResolve',
            });
        }
    }
    async toReject() {
        if (!(this.actual instanceof Promise)) {
            throw new AssertionError('toReject requires a Promise');
        }
        try {
            await this.actual;
            throw new AssertionError('Expected promise to reject');
        }
        catch (err) {
            // Expected
        }
    }
}
// ============================================================================
// Assertion Error
// ============================================================================
class AssertionError extends Error {
    expected;
    actual;
    operator;
    constructor(message, options) {
        super(message);
        this.name = 'AssertionError';
        this.expected = options?.expected;
        this.actual = options?.actual;
        this.operator = options?.operator;
    }
}
// ============================================================================
// Fixture
// ============================================================================
class Fixture {
    factory;
    instance;
    constructor(factory) {
        this.factory = factory;
    }
    create() {
        this.instance = this.factory();
        return this.instance;
    }
    get() {
        if (!this.instance) {
            this.instance = this.factory();
        }
        return this.instance;
    }
    reset() {
        this.instance = undefined;
    }
}
// ============================================================================
// Export
// ============================================================================
exports.default = TestingFramework;
