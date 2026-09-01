/**
 * MEGA TESTING SYSTEM - PART 4: TEST COVERAGE & REPORTING
 * Comprehensive coverage analysis and report generation
 * Lines: 2500+
 */
import { EventEmitter } from 'events';
export interface CoverageConfig {
    include: string[];
    exclude: string[];
    reporters: CoverageReporter[];
    watermarks: CoverageWatermarks;
    instrumenter: InstrumenterType;
}
export interface CoverageWatermarks {
    statements: [number, number];
    branches: [number, number];
    functions: [number, number];
    lines: [number, number];
}
export type InstrumenterType = 'istanbul' | 'v8' | 'nyc';
export interface CoverageData {
    files: Map<string, FileCoverage>;
    summary: CoverageSummary;
    timestamp: Date;
}
export interface FileCoverage {
    path: string;
    statements: StatementCoverage;
    branches: BranchCoverage;
    functions: FunctionCoverage;
    lines: LineCoverage;
    source: string;
}
export interface StatementCoverage {
    total: number;
    covered: number;
    skipped: number;
    pct: number;
    coverage: Map<number, number>;
}
export interface BranchCoverage {
    total: number;
    covered: number;
    skipped: number;
    pct: number;
    coverage: Map<number, BranchInfo>;
}
export interface BranchInfo {
    line: number;
    type: BranchType;
    locations: BranchLocation[];
}
export type BranchType = 'if' | 'switch' | 'cond-expr' | 'binary-expr';
export interface BranchLocation {
    start: Position;
    end: Position;
    count: number;
}
export interface Position {
    line: number;
    column: number;
}
export interface FunctionCoverage {
    total: number;
    covered: number;
    skipped: number;
    pct: number;
    coverage: Map<string, FunctionInfo>;
}
export interface FunctionInfo {
    name: string;
    line: number;
    loc: SourceLocation;
    count: number;
}
export interface SourceLocation {
    start: Position;
    end: Position;
}
export interface LineCoverage {
    total: number;
    covered: number;
    skipped: number;
    pct: number;
    coverage: Map<number, number>;
}
export interface CoverageSummary {
    statements: CoverageMetric;
    branches: CoverageMetric;
    functions: CoverageMetric;
    lines: CoverageMetric;
    files: number;
}
export interface CoverageMetric {
    total: number;
    covered: number;
    skipped: number;
    pct: number;
}
export declare class CoverageAnalyzer extends EventEmitter {
    private config;
    private coverage;
    private instrumented;
    constructor(config?: Partial<CoverageConfig>);
    instrument(file: string, source: string): string;
    private addCoverageTracking;
    recordCoverage(file: string, data: any): void;
    private createFileCoverage;
    private analyzeStatements;
    private analyzeBranches;
    private analyzeFunctions;
    private analyzeLines;
    private updateSummary;
    private aggregateMetric;
    getCoverage(): CoverageData;
    meetsThreshold(): boolean;
    generateReport(reporter: CoverageReporter): string;
    private generateTextReport;
    private generateHTMLReport;
    private generateHTMLMetrics;
    private generateLCOVReport;
}
export interface ReportConfig {
    outputDir: string;
    reporters: ReportType[];
    formats: ReportFormat[];
    includeMetadata: boolean;
    includeStackTraces: boolean;
    includeScreenshots: boolean;
    includeVideos: boolean;
}
export type ReportType = 'console' | 'json' | 'html' | 'junit' | 'allure' | 'mochawesome' | 'spec' | 'dot' | 'tap';
export type ReportFormat = 'text' | 'json' | 'xml' | 'html' | 'markdown';
export interface TestReport {
    id: string;
    name: string;
    type: ReportType;
    summary: ReportSummary;
    suites: SuiteReport[];
    coverage?: CoverageData;
    screenshots: Screenshot[];
    videos: Video[];
    metadata: ReportMetadata;
    createdAt: Date;
}
export interface ReportSummary {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
    duration: number;
    startTime: Date;
    endTime: Date;
    success: boolean;
}
export interface SuiteReport {
    name: string;
    tests: TestReport[];
    suites: SuiteReport[];
    stats: SuiteStats;
}
export interface SuiteStats {
    tests: number;
    passes: number;
    failures: number;
    skipped: number;
    duration: number;
}
export interface Screenshot {
    name: string;
    path: string;
    testId: string;
    timestamp: Date;
}
export interface Video {
    name: string;
    path: string;
    duration: number;
    size: number;
}
export interface ReportMetadata {
    environment: EnvironmentInfo;
    configuration: any;
    git?: GitInfo;
    ci?: CIInfo;
}
export interface EnvironmentInfo {
    platform: string;
    os: string;
    node: string;
    browser?: string;
    timezone: string;
}
export interface GitInfo {
    branch: string;
    commit: string;
    author: string;
    message: string;
    timestamp: Date;
}
export interface CIInfo {
    provider: string;
    buildNumber: string;
    jobUrl: string;
    pr?: string;
}
export declare class TestReporter extends EventEmitter {
    private config;
    private reports;
    constructor(config?: Partial<ReportConfig>);
    createReport(name: string, type: ReportType): TestReport;
    private collectMetadata;
    addTestResult(reportId: string, test: any): void;
    generate(reportId: string): Promise<void>;
    private generateReport;
    private generateConsoleReport;
    private generateHTMLReport;
    private generateJUnitReport;
    private generateJUnitSuite;
    private generateAllureReport;
    private writeReport;
    private getExtension;
    private generateId;
}
export declare class TestDataGenerator {
    generateString(length?: number): string;
    generateNumber(min?: number, max?: number): number;
    generateBoolean(): boolean;
    generateEmail(): string;
    generateUrl(): string;
    generateDate(start?: Date, end?: Date): Date;
    generateArray<T>(generator: () => T, length?: number): T[];
    generateObject(schema: Record<string, () => any>): any;
    generateUUID(): string;
    generatePhone(): string;
    generateAddress(): any;
    generateUser(): any;
}
export { UnitTestRunner, IntegrationTestRunner, E2ETestRunner, PerformanceTestRunner, LoadTestRunner, VisualTestRunner, AccessibilityTestRunner, SecurityTestRunner, MutationTestRunner, } from './MEGA_TestingSystem_Part1';
//# sourceMappingURL=MEGA_TestingSystem_Part4.d.ts.map