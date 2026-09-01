/**
 * MEGA TESTING SYSTEM - PART 2: E2E & PERFORMANCE TESTING
 * Continuation of comprehensive testing framework
 * Lines: 2000+
 */
import { EventEmitter } from 'events';
export interface E2EConfig {
    browser: BrowserType;
    headless: boolean;
    viewport: Viewport;
    slowMo: number;
    timeout: number;
    screenshots: ScreenshotConfig;
    videos: VideoConfig;
    tracing: TracingConfig;
}
export type BrowserType = 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge';
export interface Viewport {
    width: number;
    height: number;
    deviceScaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
}
export interface ScreenshotConfig {
    enabled: boolean;
    onFailure: boolean;
    fullPage: boolean;
    path: string;
}
export interface VideoConfig {
    enabled: boolean;
    size: VideoSize;
    path: string;
}
export interface VideoSize {
    width: number;
    height: number;
}
export interface TracingConfig {
    enabled: boolean;
    screenshots: boolean;
    snapshots: boolean;
    sources: boolean;
}
export interface Browser {
    id: string;
    type: BrowserType;
    version: string;
    contexts: BrowserContext[];
    connected: boolean;
}
export interface BrowserContext {
    id: string;
    pages: Page[];
    cookies: Cookie[];
    localStorage: Map<string, string>;
    sessionStorage: Map<string, string>;
}
export interface Page {
    id: string;
    url: string;
    title: string;
    elements: Map<string, Element>;
    requests: NetworkRequest[];
    responses: NetworkResponse[];
}
export interface Element {
    id: string;
    selector: string;
    tag: string;
    text: string;
    attributes: Map<string, string>;
    visible: boolean;
    enabled: boolean;
}
export interface NetworkRequest {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: Date;
}
export interface NetworkResponse {
    id: string;
    requestId: string;
    status: number;
    headers: Record<string, string>;
    body?: any;
    timing: ResponseTiming;
}
export interface ResponseTiming {
    dns: number;
    connect: number;
    ssl: number;
    send: number;
    wait: number;
    receive: number;
    total: number;
}
export interface Cookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: Date;
    httpOnly: boolean;
    secure: boolean;
    sameSite: SameSite;
}
export type SameSite = 'Strict' | 'Lax' | 'None';
export declare class E2ETestRunner extends EventEmitter {
    private config;
    private browsers;
    private sessions;
    constructor(config?: Partial<E2EConfig>);
    launch(): Promise<Browser>;
    newPage(browser: Browser): Promise<Page>;
    goto(page: Page, url: string): Promise<void>;
    click(page: Page, selector: string): Promise<void>;
    type(page: Page, selector: string, text: string): Promise<void>;
    screenshot(page: Page, path?: string): Promise<Buffer>;
    waitForSelector(page: Page, selector: string, timeout?: number): Promise<Element>;
    evaluate(page: Page, fn: Function, ...args: any[]): Promise<any>;
    close(browser: Browser): Promise<void>;
    private sleep;
    private generateId;
}
export interface E2ESession {
    id: string;
    browser: Browser;
    pages: Page[];
    recordings: Recording[];
    traces: Trace[];
}
export interface Recording {
    id: string;
    path: string;
    duration: number;
    size: number;
}
export interface Trace {
    id: string;
    events: TraceEvent[];
    path: string;
}
export interface TraceEvent {
    type: string;
    timestamp: Date;
    data: any;
}
export interface PerformanceTestConfig {
    duration: number;
    warmup: number;
    iterations: number;
    concurrency: number;
    rampUp: number;
    thresholds: PerformanceThresholds;
    metrics: MetricConfig[];
}
export interface PerformanceThresholds {
    responseTime: ThresholdConfig;
    throughput: ThresholdConfig;
    errorRate: ThresholdConfig;
    cpu: ThresholdConfig;
    memory: ThresholdConfig;
}
export interface ThresholdConfig {
    p50: number;
    p95: number;
    p99: number;
    max: number;
}
export interface MetricConfig {
    name: string;
    type: MetricType;
    aggregation: AggregationType;
}
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';
export interface PerformanceTest {
    id: string;
    name: string;
    scenario: TestScenario;
    config: PerformanceTestConfig;
    status: TestStatus;
    results?: PerformanceResults;
    startTime?: Date;
    endTime?: Date;
}
export interface TestScenario {
    name: string;
    steps: ScenarioStep[];
    think_time?: number;
}
export interface ScenarioStep {
    name: string;
    action: StepAction;
    params: Record<string, any>;
    checks: PerformanceCheck[];
}
export interface StepAction {
    type: ActionType;
    target: string;
    method?: string;
    data?: any;
}
export type ActionType = 'http' | 'grpc' | 'websocket' | 'custom';
export interface PerformanceCheck {
    name: string;
    condition: string;
    threshold: number;
}
export interface PerformanceResults {
    summary: ResultSummary;
    metrics: MetricResults[];
    checks: CheckResults[];
    errors: ErrorResults[];
}
export interface ResultSummary {
    duration: number;
    iterations: number;
    vus: number;
    requests: RequestStats;
    data: DataStats;
}
export interface RequestStats {
    total: number;
    success: number;
    failed: number;
    rate: number;
    duration: DurationStats;
}
export interface DurationStats {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
}
export interface DataStats {
    sent: number;
    received: number;
    rate: number;
}
export interface MetricResults {
    name: string;
    values: number[];
    stats: DurationStats;
}
export interface CheckResults {
    name: string;
    passed: number;
    failed: number;
    rate: number;
}
export interface ErrorResults {
    message: string;
    count: number;
    rate: number;
}
export declare class PerformanceTestRunner extends EventEmitter {
    private config;
    private tests;
    private virtualUsers;
    constructor(config?: Partial<PerformanceTestConfig>);
    runTest(scenario: TestScenario): Promise<PerformanceResults>;
    private warmup;
    private rampUp;
    private createVirtualUser;
    private executeScenario;
    private runVirtualUser;
    private executeStep;
    private evaluateCheck;
    private sleep;
    private generateId;
    getStats(): {
        tests: number;
        activeVUs: number;
        totalVUs: number;
    };
}
export interface VirtualUser {
    id: string;
    iteration: number;
    requests: VURequest[];
    active: boolean;
    startTime: Date;
}
export interface VURequest {
    step: string;
    duration: number;
    success: boolean;
    timestamp: Date;
}
export interface LoadTestConfig {
    type: LoadTestType;
    stages: LoadStage[];
    thresholds: LoadThresholds;
    scenarios: LoadScenario[];
}
export type LoadTestType = 'stress' | 'spike' | 'soak' | 'breakpoint';
export interface LoadStage {
    duration: number;
    target: number;
    name?: string;
}
export interface LoadThresholds {
    http_req_duration: string[];
    http_req_failed: string[];
    http_reqs: string[];
}
export interface LoadScenario {
    name: string;
    executor: ExecutorType;
    options: ExecutorOptions;
    exec: string;
}
export type ExecutorType = 'constant-vus' | 'ramping-vus' | 'constant-arrival-rate' | 'ramping-arrival-rate' | 'per-vu-iterations';
export interface ExecutorOptions {
    vus?: number;
    duration?: number;
    stages?: LoadStage[];
    rate?: number;
    timeUnit?: string;
    preAllocatedVUs?: number;
    maxVUs?: number;
    iterations?: number;
}
export declare class LoadTestRunner extends EventEmitter {
    private config;
    private currentStage;
    private activeVUs;
    constructor(config?: Partial<LoadTestConfig>);
    run(): Promise<LoadTestResults>;
    private runStage;
    private rampToTarget;
    private sleep;
}
export interface LoadTestResults {
    type: LoadTestType;
    stages: StageResults[];
    summary: LoadSummary;
}
export interface StageResults {
    name: string;
    duration: number;
    targetVUs: number;
    actualVUs: number;
    requests: number;
    errors: number;
    responseTime: DurationStats;
}
export interface LoadSummary {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    maxVUs: number;
}
//# sourceMappingURL=MEGA_TestingSystem_Part2.d.ts.map