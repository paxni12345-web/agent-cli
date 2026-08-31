/**
 * Comprehensive Integration Testing Framework
 * End-to-end testing, API testing, UI testing
 * Performance testing, load testing, stress testing
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type TestType =
  | 'e2e'
  | 'api'
  | 'integration'
  | 'performance'
  | 'load'
  | 'stress'
  | 'security'
  | 'smoke';

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

// ============================================================================
// Integration Test Framework
// ============================================================================

export class IntegrationTestFramework extends EventEmitter {
  private config: IntegrationTestConfig;
  private suites: Map<string, TestSuite> = new Map();
  private results: Map<string, SuiteResult> = new Map();
  private currentExecution?: ExecutionContext;

  constructor(config: Partial<IntegrationTestConfig> = {}) {
    super();
    this.config = {
      timeout: 30000,
      retries: 0,
      parallel: false,
      maxConcurrency: 5,
      setupTimeout: 10000,
      teardownTimeout: 10000,
      screenshotOnFailure: true,
      videoRecording: false,
      traceCollection: false,
      ...config,
    };
  }

  // ========================================================================
  // Suite Management
  // ========================================================================

  public createSuite(suite: Omit<TestSuite, 'id' | 'tests'>): TestSuite {
    const full: TestSuite = {
      ...suite,
      id: this.generateId(),
      tests: [],
      tags: suite.tags || [],
      config: suite.config || {},
    };

    this.suites.set(full.id, full);
    this.emit('suite:created', { suite: full });

    return full;
  }

  public addTest(suiteId: string, test: Omit<IntegrationTest, 'id'>): IntegrationTest {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    const full: IntegrationTest = {
      ...test,
      id: this.generateId(),
      tags: test.tags || [],
    };

    suite.tests.push(full);
    this.emit('test:added', { suite, test: full });

    return full;
  }

  // ========================================================================
  // Test Execution
  // ========================================================================

  public async runSuite(suiteId: string): Promise<SuiteResult> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    const startTime = Date.now();
    this.emit('suite:start', { suite });

    const results: TestResult[] = [];
    const context = this.createExecutionContext(suite);

    try {
      // Run beforeAll hook
      if (suite.beforeAll) {
        await this.runHook(suite.beforeAll, context, 'beforeAll');
      }

      // Filter tests
      const testsToRun = this.filterTests(suite.tests);

      // Run tests
      if (this.config.parallel) {
        const chunks = this.chunkArray(testsToRun, this.config.maxConcurrency);
        for (const chunk of chunks) {
          const chunkResults = await Promise.all(
            chunk.map(test => this.runTest(suite, test, context))
          );
          results.push(...chunkResults);
        }
      } else {
        for (const test of testsToRun) {
          const result = await this.runTest(suite, test, context);
          results.push(result);
        }
      }

      // Run afterAll hook
      if (suite.afterAll) {
        await this.runHook(suite.afterAll, context, 'afterAll');
      }
    } catch (error) {
      this.emit('suite:error', { suite, error });
    }

    const suiteResult: SuiteResult = {
      suiteId: suite.id,
      name: suite.name,
      type: suite.type,
      status: this.calculateSuiteStatus(results),
      duration: Date.now() - startTime,
      tests: results,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      timestamp: startTime,
    };

    this.results.set(suite.id, suiteResult);
    this.emit('suite:complete', { result: suiteResult });

    return suiteResult;
  }

  private async runTest(
    suite: TestSuite,
    test: IntegrationTest,
    execContext: ExecutionContext
  ): Promise<TestResult> {
    if (test.skip) {
      return {
        suiteId: suite.id,
        testId: test.id,
        name: test.name,
        status: 'skipped',
        duration: 0,
        logs: [],
        metrics: this.initializeMetrics(),
        retries: 0,
        timestamp: Date.now(),
      };
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const screenshots: string[] = [];
    let status: TestStatus = 'passed';
    let error: Error | undefined;
    let retries = 0;

    const maxRetries = test.retries ?? suite.config.retries ?? this.config.retries;

    this.emit('test:start', { suite, test });

    while (retries <= maxRetries) {
      try {
        const testContext = this.createTestContext(suite, test, execContext, logs);

        // Run beforeEach hook
        if (suite.beforeEach) {
          await this.runHook(suite.beforeEach, testContext, 'beforeEach');
        }

        // Run test with timeout
        const timeout = test.timeout ?? suite.config.timeout ?? this.config.timeout;
        await this.runWithTimeout(test.fn(testContext), timeout);

        // Run afterEach hook
        if (suite.afterEach) {
          await this.runHook(suite.afterEach, testContext, 'afterEach');
        }

        status = 'passed';
        break;
      } catch (err) {
        error = err as Error;
        status = 'failed';
        retries++;

        // Take screenshot on failure
        if (this.config.screenshotOnFailure && execContext.browser) {
          try {
            const screenshot = await execContext.browser.screenshot();
            const path = `screenshot-${test.id}-${retries}.png`;
            screenshots.push(path);
          } catch {
            // Ignore screenshot errors
          }
        }

        if (retries > maxRetries) {
          break;
        }

        await this.delay(1000);
      }
    }

    const result: TestResult = {
      suiteId: suite.id,
      testId: test.id,
      name: test.name,
      status,
      duration: Date.now() - startTime,
      error,
      logs,
      metrics: execContext.metrics,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      retries,
      timestamp: startTime,
    };

    this.emit('test:complete', { result });

    return result;
  }

  private async runHook(
    hook: HookFunction,
    context: TestContext,
    name: string
  ): Promise<void> {
    try {
      await this.runWithTimeout(hook(context), this.config.setupTimeout);
    } catch (error) {
      this.emit('hook:error', { name, error });
      throw error;
    }
  }

  private runWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  // ========================================================================
  // Context Creation
  // ========================================================================

  private createExecutionContext(suite: TestSuite): ExecutionContext {
    return {
      suite,
      http: this.createHTTPClient(),
      browser: undefined, // Would create browser context in real implementation
      database: undefined, // Would create database context in real implementation
      storage: new Map(),
      metrics: this.initializeMetrics(),
    };
  }

  private createTestContext(
    suite: TestSuite,
    test: IntegrationTest,
    execContext: ExecutionContext,
    logs: string[]
  ): TestContext {
    return {
      suite,
      test,
      http: execContext.http,
      browser: execContext.browser,
      database: execContext.database,
      storage: execContext.storage,
      metrics: execContext.metrics,
      skip: () => {
        throw new Error('SKIP_TEST');
      },
      log: (message: string) => {
        logs.push(`[${new Date().toISOString()}] ${message}`);
        this.emit('test:log', { test, message });
      },
    };
  }

  private createHTTPClient(): HTTPClient {
    const client: HTTPClient = {
      get: async (url, options) => this.makeRequest('GET', url, options),
      post: async (url, body, options) => this.makeRequest('POST', url, { ...options, body }),
      put: async (url, body, options) => this.makeRequest('PUT', url, { ...options, body }),
      patch: async (url, body, options) => this.makeRequest('PATCH', url, { ...options, body }),
      delete: async (url, options) => this.makeRequest('DELETE', url, options),
      request: async (method, url, options) => this.makeRequest(method, url, options),
    };

    return client;
  }

  private async makeRequest(
    method: string,
    url: string,
    options: RequestOptions = {}
  ): Promise<HTTPResponse> {
    const startTime = Date.now();

    try {
      // In production, this would use a real HTTP library like axios or fetch
      const response: HTTPResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: null,
        data: null,
        time: Date.now() - startTime,
      };

      if (this.currentExecution) {
        this.currentExecution.metrics.requestCount++;
        this.currentExecution.metrics.responseTimeSum += response.time;
      }

      return response;
    } catch (error) {
      if (this.currentExecution) {
        this.currentExecution.metrics.errorCount++;
      }
      throw error;
    }
  }

  // ========================================================================
  // Performance Testing
  // ========================================================================

  public async runPerformanceTest(
    scenarios: LoadScenario[],
    config: PerformanceTestConfig
  ): Promise<PerformanceMetrics> {
    this.emit('performance_test:start', { config });

    const metrics: PerformanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      requestsPerSecond: 0,
      responseTimes: [],
      percentiles: { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
      errorRate: 0,
      throughput: 0,
      duration: 0,
    };

    const startTime = Date.now();
    const endTime = startTime + config.duration;
    const rampUpEnd = startTime + config.rampUpTime;

    const virtualUsers: Promise<void>[] = [];

    for (let i = 0; i < config.virtualUsers; i++) {
      const vuStartDelay = (config.rampUpTime / config.virtualUsers) * i;

      virtualUsers.push(
        this.runVirtualUser(i, scenarios, endTime, vuStartDelay, metrics)
      );
    }

    await Promise.all(virtualUsers);

    const duration = Date.now() - startTime;
    metrics.duration = duration;
    metrics.requestsPerSecond = (metrics.totalRequests / duration) * 1000;
    metrics.errorRate = metrics.totalRequests > 0
      ? metrics.failedRequests / metrics.totalRequests
      : 0;
    metrics.throughput = metrics.requestsPerSecond;
    metrics.percentiles = this.calculatePercentiles(metrics.responseTimes);

    // Check thresholds
    const passed = this.checkPerformanceThresholds(metrics, config.thresholds);

    this.emit('performance_test:complete', { metrics, passed });

    return metrics;
  }

  private async runVirtualUser(
    vuId: number,
    scenarios: LoadScenario[],
    endTime: number,
    startDelay: number,
    metrics: PerformanceMetrics
  ): Promise<void> {
    await this.delay(startDelay);

    let iteration = 0;

    while (Date.now() < endTime) {
      const scenario = this.selectScenario(scenarios);
      const context: LoadTestContext = {
        http: this.createHTTPClient(),
        iteration: iteration++,
        vuId,
        startTime: Date.now(),
        sleep: this.delay,
      };

      try {
        const requestStartTime = Date.now();
        await scenario.fn(context);
        const responseTime = Date.now() - requestStartTime;

        metrics.totalRequests++;
        metrics.successfulRequests++;
        metrics.responseTimes.push(responseTime);
      } catch (error) {
        metrics.totalRequests++;
        metrics.failedRequests++;
      }
    }
  }

  private selectScenario(scenarios: LoadScenario[]): LoadScenario {
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const scenario of scenarios) {
      random -= scenario.weight;
      if (random <= 0) {
        return scenario;
      }
    }

    return scenarios[0];
  }

  private calculatePercentiles(values: number[]): PerformanceMetrics['percentiles'] {
    if (values.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);

    return {
      p50: this.percentile(sorted, 0.5),
      p75: this.percentile(sorted, 0.75),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }

  private checkPerformanceThresholds(
    metrics: PerformanceMetrics,
    thresholds: PerformanceThresholds
  ): boolean {
    const checks = [
      metrics.percentiles.p50 <= thresholds.responseTime.p50,
      metrics.percentiles.p95 <= thresholds.responseTime.p95,
      metrics.percentiles.p99 <= thresholds.responseTime.p99,
      metrics.errorRate <= thresholds.errorRate,
      metrics.throughput >= thresholds.throughput,
    ];

    return checks.every(check => check);
  }

  // ========================================================================
  // Load Testing
  // ========================================================================

  public async runLoadTest(
    scenario: LoadScenario,
    config: PerformanceTestConfig
  ): Promise<PerformanceMetrics> {
    return this.runPerformanceTest([scenario], config);
  }

  public async runStressTest(
    scenario: LoadScenario,
    config: PerformanceTestConfig
  ): Promise<PerformanceMetrics> {
    // Stress test: gradually increase load until failure
    const results: PerformanceMetrics[] = [];
    let currentVUs = config.virtualUsers;
    let failed = false;

    while (!failed && currentVUs <= config.virtualUsers * 10) {
      const testConfig = { ...config, virtualUsers: currentVUs };
      const metrics = await this.runPerformanceTest([scenario], testConfig);

      results.push(metrics);

      if (metrics.errorRate > 0.05 || metrics.percentiles.p95 > config.thresholds.responseTime.p95 * 2) {
        failed = true;
      } else {
        currentVUs = Math.floor(currentVUs * 1.5);
      }
    }

    return results[results.length - 1];
  }

  // ========================================================================
  // API Testing
  // ========================================================================

  public createAPISuite(name: string, baseURL: string): APISuiteBuilder {
    const suite = this.createSuite({
      name,
      description: `API tests for ${baseURL}`,
      type: 'api',
      config: {},
      tags: ['api'],
    });

    return new APISuiteBuilder(this, suite, baseURL);
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private filterTests(tests: IntegrationTest[]): IntegrationTest[] {
    const onlyTests = tests.filter(t => t.only);
    if (onlyTests.length > 0) {
      return onlyTests;
    }

    return tests.filter(t => !t.skip);
  }

  private calculateSuiteStatus(results: TestResult[]): TestStatus {
    if (results.every(r => r.status === 'passed')) {
      return 'passed';
    }

    if (results.some(r => r.status === 'failed')) {
      return 'failed';
    }

    return 'skipped';
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private initializeMetrics(): TestMetrics {
    return {
      startTime: Date.now(),
      requestCount: 0,
      responseTimeSum: 0,
      errorCount: 0,
      assertionCount: 0,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Results
  // ========================================================================

  public getResult(suiteId: string): SuiteResult | undefined {
    return this.results.get(suiteId);
  }

  public getAllResults(): SuiteResult[] {
    return Array.from(this.results.values());
  }

  public async generateReport(format: 'json' | 'html' | 'junit'): Promise<string> {
    const results = this.getAllResults();

    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2);

      case 'html':
        return this.generateHTMLReport(results);

      case 'junit':
        return this.generateJUnitReport(results);

      default:
        return '';
    }
  }

  private generateHTMLReport(results: SuiteResult[]): string {
    // Generate HTML report
    return '<html><body><h1>Test Results</h1></body></html>';
  }

  private generateJUnitReport(results: SuiteResult[]): string {
    // Generate JUnit XML report
    return '<?xml version="1.0"?><testsuites></testsuites>';
  }
}

// ============================================================================
// API Suite Builder
// ============================================================================

class APISuiteBuilder {
  constructor(
    private framework: IntegrationTestFramework,
    private suite: TestSuite,
    private baseURL: string
  ) {}

  public test(name: string, fn: (http: HTTPClient) => Promise<void>): this {
    this.framework.addTest(this.suite.id, {
      name,
      description: name,
      fn: async (context) => {
        await fn(context.http);
      },
      tags: ['api'],
    });

    return this;
  }

  public beforeAll(fn: HookFunction): this {
    this.suite.beforeAll = fn;
    return this;
  }

  public afterAll(fn: HookFunction): this {
    this.suite.afterAll = fn;
    return this;
  }

  public beforeEach(fn: HookFunction): this {
    this.suite.beforeEach = fn;
    return this;
  }

  public afterEach(fn: HookFunction): this {
    this.suite.afterEach = fn;
    return this;
  }

  public build(): TestSuite {
    return this.suite;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface ExecutionContext {
  suite: TestSuite;
  http: HTTPClient;
  browser?: BrowserContext;
  database?: DatabaseContext;
  storage: Map<string, any>;
  metrics: TestMetrics;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export class Expect<T> {
  constructor(private actual: T) {}

  public toBe(expected: T): void {
    if (this.actual !== expected) {
      throw new Error(`Expected ${this.actual} to be ${expected}`);
    }
  }

  public toEqual(expected: T): void {
    if (JSON.stringify(this.actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(this.actual)} to equal ${JSON.stringify(expected)}`);
    }
  }

  public toContain(item: any): void {
    if (Array.isArray(this.actual)) {
      if (!this.actual.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    } else if (typeof this.actual === 'string') {
      if (!this.actual.includes(item)) {
        throw new Error(`Expected string to contain ${item}`);
      }
    }
  }

  public toBeGreaterThan(value: number): void {
    if (typeof this.actual !== 'number' || this.actual <= value) {
      throw new Error(`Expected ${this.actual} to be greater than ${value}`);
    }
  }

  public toBeLessThan(value: number): void {
    if (typeof this.actual !== 'number' || this.actual >= value) {
      throw new Error(`Expected ${this.actual} to be less than ${value}`);
    }
  }

  public toBeTruthy(): void {
    if (!this.actual) {
      throw new Error(`Expected ${this.actual} to be truthy`);
    }
  }

  public toBeFalsy(): void {
    if (this.actual) {
      throw new Error(`Expected ${this.actual} to be falsy`);
    }
  }

  public toBeNull(): void {
    if (this.actual !== null) {
      throw new Error(`Expected ${this.actual} to be null`);
    }
  }

  public toBeUndefined(): void {
    if (this.actual !== undefined) {
      throw new Error(`Expected ${this.actual} to be undefined`);
    }
  }

  public toThrow(errorMessage?: string): void {
    if (typeof this.actual !== 'function') {
      throw new Error('Expected a function');
    }

    try {
      (this.actual as Function)();
      throw new Error('Expected function to throw');
    } catch (error) {
      if (errorMessage && (error as Error).message !== errorMessage) {
        throw new Error(`Expected error message "${errorMessage}", got "${(error as Error).message}"`);
      }
    }
  }
}

export function expect<T>(actual: T): Expect<T> {
  return new Expect(actual);
}

// ============================================================================
// Export
// ============================================================================

export default IntegrationTestFramework;
