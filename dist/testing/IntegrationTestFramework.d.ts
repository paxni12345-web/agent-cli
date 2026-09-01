/**
 * Comprehensive Integration Testing Framework
 * End-to-end testing, API testing, UI testing
 * Performance testing, load testing, stress testing
 */
import { EventEmitter } from 'events';
export interface IntegrationTestConfig {
    timeout: number;
    retries: number;
    parallel: boolean;
    maxConcurrency: number;
    setupTimeout: number;
    teardownTimeout: number;
    screenshotOnFailure: boolean;
    videoRecording: boolean;
    traceCollection: boolean;
}
export interface TestSuite {
    id: string;
    name: string;
    description: string;
    type: TestType;
    tests: IntegrationTest[];
    beforeAll?: HookFunction;
    afterAll?: HookFunction;
    beforeEach?: HookFunction;
    afterEach?: HookFunction;
    config: Partial<IntegrationTestConfig>;
    tags: string[];
}
export type TestType = 'e2e' | 'api' | 'integration' | 'performance' | 'load' | 'stress' | 'security' | 'smoke';
export interface IntegrationTest {
    id: string;
    name: string;
    description: string;
    fn: TestFunction;
    skip?: boolean;
    only?: boolean;
    timeout?: number;
    retries?: number;
    tags: string[];
    dependencies?: string[];
}
export type TestFunction = (context: TestContext) => Promise<void>;
export type HookFunction = (context: TestContext) => Promise<void>;
export interface TestContext {
    suite: TestSuite;
    test: IntegrationTest;
    http: HTTPClient;
    browser?: BrowserContext;
    database?: DatabaseContext;
    storage: Map<string, any>;
    metrics: TestMetrics;
    skip: () => void;
    log: (message: string) => void;
}
export interface HTTPClient {
    get(url: string, options?: RequestOptions): Promise<HTTPResponse>;
    post(url: string, body?: any, options?: RequestOptions): Promise<HTTPResponse>;
    put(url: string, body?: any, options?: RequestOptions): Promise<HTTPResponse>;
    patch(url: string, body?: any, options?: RequestOptions): Promise<HTTPResponse>;
    delete(url: string, options?: RequestOptions): Promise<HTTPResponse>;
    request(method: string, url: string, options?: RequestOptions): Promise<HTTPResponse>;
}
export interface RequestOptions {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
    timeout?: number;
    followRedirects?: boolean;
    validateStatus?: (status: number) => boolean;
}
export interface HTTPResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    data: any;
    time: number;
}
export interface BrowserContext {
    navigate(url: string): Promise<void>;
    click(selector: string): Promise<void>;
    type(selector: string, text: string): Promise<void>;
    select(selector: string, value: string): Promise<void>;
    getText(selector: string): Promise<string>;
    getAttribute(selector: string, attr: string): Promise<string>;
    waitForSelector(selector: string, timeout?: number): Promise<void>;
    waitForNavigation(timeout?: number): Promise<void>;
    screenshot(path?: string): Promise<Buffer>;
    evaluate<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T>;
    cookies(): Promise<Cookie[]>;
    setCookie(cookie: Cookie): Promise<void>;
    clearCookies(): Promise<void>;
}
export interface Cookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}
export interface DatabaseContext {
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    execute(sql: string, params?: any[]): Promise<void>;
    transaction<T>(fn: (tx: DatabaseContext) => Promise<T>): Promise<T>;
    seed(data: Record<string, any[]>): Promise<void>;
    truncate(tables: string[]): Promise<void>;
    reset(): Promise<void>;
}
export interface TestMetrics {
    startTime: number;
    endTime?: number;
    duration?: number;
    requestCount: number;
    responseTimeSum: number;
    errorCount: number;
    assertionCount: number;
    memoryUsage?: NodeJS.MemoryUsage;
}
export interface TestResult {
    suiteId: string;
    testId: string;
    name: string;
    status: TestStatus;
    duration: number;
    error?: Error;
    logs: string[];
    metrics: TestMetrics;
    screenshots?: string[];
    trace?: string;
    retries: number;
    timestamp: number;
}
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';
export interface SuiteResult {
    suiteId: string;
    name: string;
    type: TestType;
    status: TestStatus;
    duration: number;
    tests: TestResult[];
    passed: number;
    failed: number;
    skipped: number;
    timestamp: number;
}
export interface PerformanceTestConfig {
    duration: number;
    rampUpTime: number;
    virtualUsers: number;
    requestsPerSecond?: number;
    thresholds: PerformanceThresholds;
}
export interface PerformanceThresholds {
    responseTime: {
        p50: number;
        p95: number;
        p99: number;
    };
    errorRate: number;
    throughput: number;
}
export interface PerformanceMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    requestsPerSecond: number;
    responseTimes: number[];
    percentiles: {
        p50: number;
        p75: number;
        p90: number;
        p95: number;
        p99: number;
    };
    errorRate: number;
    throughput: number;
    duration: number;
}
export interface LoadScenario {
    id: string;
    name: string;
    weight: number;
    fn: (context: LoadTestContext) => Promise<void>;
}
export interface LoadTestContext {
    http: HTTPClient;
    iteration: number;
    vuId: number;
    startTime: number;
    sleep: (ms: number) => Promise<void>;
}
export declare class IntegrationTestFramework extends EventEmitter {
    private config;
    private suites;
    private results;
    private currentExecution?;
    constructor(config?: Partial<IntegrationTestConfig>);
    createSuite(suite: Omit<TestSuite, 'id' | 'tests'>): TestSuite;
    addTest(suiteId: string, test: Omit<IntegrationTest, 'id'>): IntegrationTest;
    runSuite(suiteId: string): Promise<SuiteResult>;
    private runTest;
    private runHook;
    private runWithTimeout;
    private createExecutionContext;
    private createTestContext;
    private createHTTPClient;
    private makeRequest;
    runPerformanceTest(scenarios: LoadScenario[], config: PerformanceTestConfig): Promise<PerformanceMetrics>;
    private runVirtualUser;
    private selectScenario;
    private calculatePercentiles;
    private percentile;
    private checkPerformanceThresholds;
    runLoadTest(scenario: LoadScenario, config: PerformanceTestConfig): Promise<PerformanceMetrics>;
    runStressTest(scenario: LoadScenario, config: PerformanceTestConfig): Promise<PerformanceMetrics>;
    createAPISuite(name: string, baseURL: string): APISuiteBuilder;
    private filterTests;
    private calculateSuiteStatus;
    private chunkArray;
    private initializeMetrics;
    private delay;
    private generateId;
    getResult(suiteId: string): SuiteResult | undefined;
    getAllResults(): SuiteResult[];
    generateReport(format: 'json' | 'html' | 'junit'): Promise<string>;
    private generateHTMLReport;
    private generateJUnitReport;
}
declare class APISuiteBuilder {
    private framework;
    private suite;
    private baseURL;
    constructor(framework: IntegrationTestFramework, suite: TestSuite, baseURL: string);
    test(name: string, fn: (http: HTTPClient) => Promise<void>): this;
    beforeAll(fn: HookFunction): this;
    afterAll(fn: HookFunction): this;
    beforeEach(fn: HookFunction): this;
    afterEach(fn: HookFunction): this;
    build(): TestSuite;
}
export declare class Expect<T> {
    private actual;
    constructor(actual: T);
    toBe(expected: T): void;
    toEqual(expected: T): void;
    toContain(item: any): void;
    toBeGreaterThan(value: number): void;
    toBeLessThan(value: number): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toThrow(errorMessage?: string): void;
}
export declare function expect<T>(actual: T): Expect<T>;
export default IntegrationTestFramework;
//# sourceMappingURL=IntegrationTestFramework.d.ts.map