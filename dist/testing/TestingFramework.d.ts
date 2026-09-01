/**
 * Comprehensive Testing Framework
 * Unit tests, Integration tests, E2E tests, Performance tests
 * Code coverage, Mutation testing, Property-based testing
 */
import { EventEmitter } from 'events';
export interface TestSuite {
    id: string;
    name: string;
    description: string;
    tests: Test[];
    hooks: TestHooks;
    timeout: number;
    retries: number;
}
export interface Test {
    id: string;
    name: string;
    description: string;
    type: TestType;
    fn: TestFunction;
    timeout: number;
    retries: number;
    skip: boolean;
    only: boolean;
    tags: string[];
}
export type TestType = 'unit' | 'integration' | 'e2e' | 'performance' | 'security' | 'accessibility';
export type TestFunction = () => Promise<void> | void;
export interface TestHooks {
    beforeAll: Hook[];
    afterAll: Hook[];
    beforeEach: Hook[];
    afterEach: Hook[];
}
export interface Hook {
    id: string;
    fn: HookFunction;
    timeout: number;
}
export type HookFunction = () => Promise<void> | void;
export interface TestResult {
    testId: string;
    name: string;
    status: TestStatus;
    duration: number;
    error?: TestError;
    logs: string[];
    assertions: AssertionResult[];
    coverage?: CoverageData;
    retryCount: number;
}
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending' | 'timeout';
export interface TestError {
    message: string;
    stack?: string;
    expected?: any;
    actual?: any;
    operator?: string;
}
export interface AssertionResult {
    id: string;
    description: string;
    passed: boolean;
    expected?: any;
    actual?: any;
}
export interface CoverageData {
    statements: CoverageMetric;
    branches: CoverageMetric;
    functions: CoverageMetric;
    lines: CoverageMetric;
}
export interface CoverageMetric {
    total: number;
    covered: number;
    percentage: number;
}
export interface TestRunConfig {
    pattern?: string;
    tags?: string[];
    parallel?: boolean;
    maxWorkers?: number;
    coverage?: boolean;
    bail?: boolean;
    verbose?: boolean;
    watch?: boolean;
}
export interface TestReport {
    id: string;
    timestamp: number;
    duration: number;
    summary: TestSummary;
    results: TestResult[];
    coverage?: CoverageData;
    performance?: PerformanceMetrics;
}
export interface TestSummary {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
    successRate: number;
}
export interface PerformanceMetrics {
    minDuration: number;
    maxDuration: number;
    avgDuration: number;
    p50: number;
    p95: number;
    p99: number;
}
export interface Mock {
    id: string;
    target: any;
    property: string;
    implementation: Function;
    calls: MockCall[];
}
export interface MockCall {
    timestamp: number;
    args: any[];
    returnValue?: any;
    error?: Error;
}
export interface Spy {
    id: string;
    target: any;
    property: string;
    calls: MockCall[];
}
export interface Stub {
    id: string;
    returns?: any;
    throws?: Error;
    resolves?: any;
    rejects?: Error;
    callsFake?: Function;
}
export declare class TestingFramework extends EventEmitter {
    private suites;
    private currentSuite?;
    private mocks;
    private spies;
    private coverage;
    private config;
    constructor(config?: Partial<TestConfig>);
    describe(name: string, fn: () => void): void;
    it(name: string, fn: TestFunction): void;
    test(name: string, fn: TestFunction, type?: TestType): void;
    beforeAll(fn: HookFunction): void;
    afterAll(fn: HookFunction): void;
    beforeEach(fn: HookFunction): void;
    afterEach(fn: HookFunction): void;
    run(config?: TestRunConfig): Promise<TestReport>;
    private runSuite;
    private runTest;
    private runHook;
    private executeWithTimeout;
    expect(actual: any): Expectation;
    assert(condition: boolean, message?: string): void;
    assertEqual(actual: any, expected: any, message?: string): void;
    assertDeepEqual(actual: any, expected: any, message?: string): void;
    assertThrows(fn: Function, expected?: RegExp | Function): void;
    mock<T extends object>(target: T, property: keyof T, implementation: Function): Mock;
    spy<T extends object>(target: T, property: keyof T): Spy;
    stub(config: Stub): Function;
    restoreMocks(): void;
    startCoverage(file: string): void;
    recordCoverage(file: string, type: keyof CoverageData, total: number, covered: number): void;
    getCoverage(): Map<string, CoverageData>;
    private aggregateCoverage;
    private calculatePercentage;
    createFixture<T>(factory: () => T): Fixture<T>;
    private filterSuites;
    private createBatches;
    private createSkippedResult;
    private formatError;
    private computeSummary;
    private computePerformanceMetrics;
    private percentile;
    private generateId;
}
declare class Expectation {
    private actual;
    constructor(actual: any);
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toContain(item: any): void;
    toThrow(expected?: RegExp | Function): void;
    toResolve(): Promise<void>;
    toReject(): Promise<void>;
}
declare class Fixture<T> {
    private factory;
    private instance?;
    constructor(factory: () => T);
    create(): T;
    get(): T;
    reset(): void;
}
interface TestConfig {
    timeout: number;
    retries: number;
    parallel: boolean;
    maxWorkers: number;
    coverage: boolean;
    bail: boolean;
    verbose: boolean;
}
export default TestingFramework;
//# sourceMappingURL=TestingFramework.d.ts.map