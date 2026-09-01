/**
 * MEGA TESTING SYSTEM - PART 3: VISUAL & SECURITY TESTING
 * Visual regression, accessibility, and security testing
 * Lines: 2000+
 */
import { EventEmitter } from 'events';
export interface VisualTestConfig {
    threshold: number;
    diffingEngine: DiffEngine;
    browsers: BrowserConfig[];
    viewports: ViewportConfig[];
    animations: AnimationConfig;
    ignoreRegions: Region[];
}
export type DiffEngine = 'pixelmatch' | 'ssim' | 'perceptual' | 'odiff';
export interface BrowserConfig {
    name: string;
    version: string;
    platform: string;
}
export interface ViewportConfig {
    name: string;
    width: number;
    height: number;
    deviceScaleFactor: number;
}
export interface AnimationConfig {
    disable: boolean;
    disableCSSAnimations: boolean;
    disableJSAnimations: boolean;
}
export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface VisualTest {
    id: string;
    name: string;
    url: string;
    baseline?: Screenshot;
    current?: Screenshot;
    diff?: DiffResult;
    status: VisualTestStatus;
}
export type VisualTestStatus = 'pending' | 'new' | 'approved' | 'failed' | 'changed';
export interface Screenshot {
    id: string;
    path: string;
    width: number;
    height: number;
    hash: string;
    timestamp: Date;
    metadata: ScreenshotMetadata;
}
export interface ScreenshotMetadata {
    browser: string;
    viewport: string;
    url: string;
    userAgent: string;
}
export interface DiffResult {
    id: string;
    diffPath: string;
    pixelsDifferent: number;
    percentDifferent: number;
    passed: boolean;
    regions: DiffRegion[];
}
export interface DiffRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    severity: DiffSeverity;
}
export type DiffSeverity = 'minor' | 'moderate' | 'major';
export declare class VisualTestRunner extends EventEmitter {
    private config;
    private tests;
    private baselines;
    constructor(config?: Partial<VisualTestConfig>);
    capture(url: string, name: string): Promise<Screenshot>;
    compare(baseline: Screenshot, current: Screenshot): Promise<DiffResult>;
    private identifyDiffRegions;
    approve(testId: string): Promise<void>;
    private generateHash;
    private generateId;
}
export interface AccessibilityConfig {
    standard: A11yStandard;
    level: A11yLevel;
    rules: A11yRule[];
    ignoreRules: string[];
}
export type A11yStandard = 'WCAG2.0' | 'WCAG2.1' | 'WCAG2.2' | 'Section508';
export type A11yLevel = 'A' | 'AA' | 'AAA';
export interface A11yRule {
    id: string;
    enabled: boolean;
    severity: A11ySeverity;
}
export type A11ySeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export interface A11yTest {
    id: string;
    url: string;
    violations: A11yViolation[];
    passes: A11yPass[];
    incomplete: A11yIncomplete[];
    score: number;
    timestamp: Date;
}
export interface A11yViolation {
    id: string;
    impact: A11ySeverity;
    description: string;
    help: string;
    helpUrl: string;
    nodes: A11yNode[];
    tags: string[];
}
export interface A11yNode {
    html: string;
    target: string[];
    failureSummary: string;
    fixes: A11yFix[];
}
export interface A11yFix {
    type: FixType;
    message: string;
    code?: string;
}
export type FixType = 'remove' | 'add' | 'modify' | 'none';
export interface A11yPass {
    id: string;
    description: string;
    nodes: number;
}
export interface A11yIncomplete {
    id: string;
    description: string;
    nodes: A11yNode[];
    reason: string;
}
export declare class AccessibilityTestRunner extends EventEmitter {
    private config;
    private tests;
    constructor(config?: Partial<AccessibilityConfig>);
    analyze(url: string, html: string): Promise<A11yTest>;
    private findViolations;
    private findPasses;
    private findIncomplete;
    private calculateScore;
    private generateId;
}
export interface SecurityTestConfig {
    scanners: SecurityScanner[];
    checks: SecurityCheck[];
    severity: SecuritySeverity[];
    autoFix: boolean;
}
export type SecurityScanner = 'xss' | 'sql_injection' | 'csrf' | 'clickjacking' | 'ssl' | 'headers' | 'dependencies' | 'secrets';
export interface SecurityCheck {
    id: string;
    name: string;
    type: SecurityCheckType;
    enabled: boolean;
}
export type SecurityCheckType = 'code_scan' | 'dependency_scan' | 'secret_scan' | 'container_scan' | 'api_scan';
export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export interface SecurityTest {
    id: string;
    type: SecurityCheckType;
    findings: SecurityFinding[];
    score: number;
    timestamp: Date;
}
export interface SecurityFinding {
    id: string;
    severity: SecuritySeverity;
    type: VulnerabilityType;
    title: string;
    description: string;
    location: FindingLocation;
    cwe?: string;
    cvss?: CVSSScore;
    remediation: Remediation;
    references: string[];
}
export type VulnerabilityType = 'xss' | 'sql_injection' | 'command_injection' | 'path_traversal' | 'ssrf' | 'xxe' | 'deserialization' | 'weak_crypto' | 'hardcoded_secret' | 'insecure_dependency' | 'missing_auth' | 'broken_access_control';
export interface FindingLocation {
    file: string;
    line: number;
    column: number;
    code: string;
}
export interface CVSSScore {
    version: string;
    score: number;
    vector: string;
}
export interface Remediation {
    description: string;
    effort: RemediationEffort;
    patches?: Patch[];
}
export type RemediationEffort = 'trivial' | 'easy' | 'moderate' | 'difficult' | 'complex';
export interface Patch {
    type: PatchType;
    content: string;
}
export type PatchType = 'code' | 'config' | 'dependency';
export declare class SecurityTestRunner extends EventEmitter {
    private config;
    private tests;
    private findings;
    constructor(config?: Partial<SecurityTestConfig>);
    scan(target: string, type: SecurityCheckType): Promise<SecurityTest>;
    private runScanner;
    private scanXSS;
    private scanSQLInjection;
    private scanSecrets;
    private scanDependencies;
    private calculateSecurityScore;
    fix(findingId: string): Promise<void>;
    private applyPatch;
    private generateId;
    getStats(): {
        tests: number;
        findings: number;
        critical: number;
        high: number;
    };
}
export interface MutationTestConfig {
    mutators: Mutator[];
    threshold: number;
    timeout: number;
    ignorePatterns: string[];
}
export type Mutator = 'arithmetic' | 'conditional' | 'logical' | 'assignment' | 'unary' | 'update' | 'string' | 'array';
export interface MutationTest {
    id: string;
    file: string;
    original: string;
    mutants: Mutant[];
    score: number;
    timestamp: Date;
}
export interface Mutant {
    id: string;
    mutator: Mutator;
    location: MutantLocation;
    original: string;
    mutated: string;
    status: MutantStatus;
    killedBy?: string[];
}
export interface MutantLocation {
    line: number;
    column: number;
    start: number;
    end: number;
}
export type MutantStatus = 'killed' | 'survived' | 'timeout' | 'error';
export declare class MutationTestRunner extends EventEmitter {
    private config;
    private tests;
    constructor(config?: Partial<MutationTestConfig>);
    run(file: string, code: string): Promise<MutationTest>;
    private generateMutants;
    private generateArithmeticMutants;
    private generateConditionalMutants;
    private generateLogicalMutants;
    private testMutant;
    private sleep;
    private generateId;
}
export declare class ComprehensiveTestingFramework {
    unit: UnitTestRunner;
    integration: IntegrationTestRunner;
    e2e: E2ETestRunner;
    performance: PerformanceTestRunner;
    load: LoadTestRunner;
    visual: VisualTestRunner;
    accessibility: AccessibilityTestRunner;
    security: SecurityTestRunner;
    mutation: MutationTestRunner;
    constructor();
    runAll(): Promise<ComprehensiveTestResults>;
}
export interface ComprehensiveTestResults {
    unit: TestResultSummary;
    integration: TestResultSummary;
    e2e: TestResultSummary;
    performance: PerformanceResultSummary;
    visual: VisualResultSummary;
    accessibility: AccessibilityResultSummary;
    security: SecurityResultSummary;
    mutation: MutationResultSummary;
    overall: OverallResultSummary;
}
export interface TestResultSummary {
    passed: number;
    failed: number;
    total: number;
}
export interface PerformanceResultSummary {
    score: number;
}
export interface VisualResultSummary {
    changes: number;
    approved: number;
}
export interface AccessibilityResultSummary {
    score: number;
    violations: number;
}
export interface SecurityResultSummary {
    score: number;
    findings: number;
}
export interface MutationResultSummary {
    score: number;
    mutants: number;
}
export interface OverallResultSummary {
    score: number;
    status: 'passed' | 'failed';
}
//# sourceMappingURL=MEGA_TestingSystem_Part3.d.ts.map