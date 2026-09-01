/**
 * MEGA PHASE 25: PERFORMANCE MONITORING & PROFILING
 * APM, Performance profiling, Resource monitoring, Bottleneck detection
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface APMConfig {
    samplingRate: number;
    enableProfiling: boolean;
    enableMemoryTracking: boolean;
    enableCPUTracking: boolean;
    slowThreshold: number;
    errorTracking: boolean;
}
export interface Transaction {
    id: string;
    name: string;
    type: TransactionType;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: TransactionStatus;
    spans: Span[];
    context: TransactionContext;
    metadata: Map<string, any>;
}
export type TransactionType = 'request' | 'background' | 'custom';
export type TransactionStatus = 'success' | 'error' | 'timeout' | 'cancelled';
export interface Span {
    id: string;
    parentId?: string;
    name: string;
    type: SpanType;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    stacktrace?: StackFrame[];
    metadata: Map<string, any>;
}
export type SpanType = 'http' | 'db' | 'cache' | 'external' | 'function' | 'template' | 'custom';
export interface StackFrame {
    filename: string;
    function: string;
    line: number;
    column: number;
}
export interface TransactionContext {
    request?: RequestContext;
    user?: UserContext;
    tags: Map<string, string>;
    custom: Map<string, any>;
}
export interface RequestContext {
    method: string;
    url: string;
    headers: Map<string, string>;
    statusCode?: number;
}
export interface UserContext {
    id: string;
    username?: string;
    email?: string;
    ipAddress?: string;
}
export interface PerformanceMetrics {
    throughput: number;
    averageResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
    apdex: number;
}
export declare class APMAgent extends EventEmitter {
    private config;
    private transactions;
    private activeTransactions;
    private metrics;
    constructor(config?: Partial<APMConfig>);
    startTransaction(name: string, type?: TransactionType): Transaction;
    endTransaction(transaction: Transaction, status?: TransactionStatus): void;
    startSpan(transaction: Transaction, name: string, type: SpanType): Span;
    endSpan(span: Span): void;
    captureError(error: Error, transaction?: Transaction): void;
    setUserContext(transaction: Transaction, user: UserContext): void;
    setCustomContext(transaction: Transaction, key: string, value: any): void;
    addTag(transaction: Transaction, key: string, value: string): void;
    private shouldSample;
    private createDummyTransaction;
    private updateMetrics;
    private startMetricsAggregation;
    private generateId;
    getMetrics(): PerformanceMetrics;
    getStats(): {
        activeTransactions: number;
        totalTransactions: number;
        metrics: PerformanceMetrics;
    };
}
export interface ResourceMonitorConfig {
    interval: number;
    enableCPU: boolean;
    enableMemory: boolean;
    enableDisk: boolean;
    enableNetwork: boolean;
    thresholds: ResourceThresholds;
}
export interface ResourceThresholds {
    cpu: number;
    memory: number;
    disk: number;
    networkIO: number;
}
export interface ResourceMetrics {
    timestamp: Date;
    cpu: CPUMetrics;
    memory: MemoryMetrics;
    disk: DiskMetrics;
    network: NetworkMetrics;
}
export interface CPUMetrics {
    usage: number;
    load: number[];
    cores: number;
    perCore: number[];
}
export interface MemoryMetrics {
    total: number;
    used: number;
    free: number;
    usage: number;
    heap: HeapMetrics;
}
export interface HeapMetrics {
    total: number;
    used: number;
    limit: number;
}
export interface DiskMetrics {
    total: number;
    used: number;
    free: number;
    usage: number;
    ioOps: number;
    readThroughput: number;
    writeThroughput: number;
}
export interface NetworkMetrics {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    connections: number;
}
export declare class ResourceMonitor extends EventEmitter {
    private config;
    private metrics;
    private monitoring;
    constructor(config?: Partial<ResourceMonitorConfig>);
    start(): void;
    stop(): void;
    private monitoringLoop;
    private collectMetrics;
    private collectCPUMetrics;
    private collectMemoryMetrics;
    private collectDiskMetrics;
    private collectNetworkMetrics;
    private checkThresholds;
    private sleep;
    getLatestMetrics(): ResourceMetrics | null;
    getMetricsHistory(duration?: number): ResourceMetrics[];
    getStats(): {
        monitoring: boolean;
        samples: number;
        latest: ResourceMetrics | null;
    };
}
export interface ProfilerConfig {
    samplingInterval: number;
    stackDepth: number;
    enableSourceMaps: boolean;
}
export interface Profile {
    id: string;
    duration: number;
    samples: ProfileSample[];
    startTime: Date;
    endTime: Date;
    summary: ProfileSummary;
}
export interface ProfileSample {
    timestamp: Date;
    stackTrace: StackFrame[];
    weight: number;
}
export interface ProfileSummary {
    totalSamples: number;
    hotFunctions: HotFunction[];
    callGraph: CallGraphNode;
}
export interface HotFunction {
    name: string;
    file: string;
    line: number;
    samples: number;
    percentage: number;
    selfTime: number;
    totalTime: number;
}
export interface CallGraphNode {
    name: string;
    samples: number;
    children: Map<string, CallGraphNode>;
}
export declare class Profiler extends EventEmitter {
    private config;
    private profiling;
    private currentProfile?;
    private samples;
    constructor(config?: Partial<ProfilerConfig>);
    start(): void;
    stop(): Profile;
    private startSampling;
    private collectSample;
    private generateSummary;
    private buildCallGraph;
    private generateId;
    getStats(): {
        profiling: boolean;
        samples: number;
        currentProfile: string | undefined;
    };
}
export interface BottleneckConfig {
    detectionThreshold: number;
    minSamples: number;
    categories: BottleneckCategory[];
}
export type BottleneckCategory = 'cpu' | 'memory' | 'io' | 'network' | 'database';
export interface Bottleneck {
    id: string;
    category: BottleneckCategory;
    severity: BottleneckSeverity;
    description: string;
    impact: number;
    recommendations: string[];
    detectedAt: Date;
    evidence: BottleneckEvidence;
}
export type BottleneckSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface BottleneckEvidence {
    metrics: Map<string, number>;
    traces: string[];
    duration: number;
}
export declare class BottleneckDetector extends EventEmitter {
    private config;
    private bottlenecks;
    constructor(config?: Partial<BottleneckConfig>);
    analyze(metrics: ResourceMetrics, transactions: Transaction[]): Bottleneck[];
    private detectCPUBottleneck;
    private detectMemoryBottleneck;
    private detectIOBottleneck;
    private calculateSeverity;
    private generateId;
    getStats(): {
        bottlenecks: number;
        bySeverity: {
            critical: number;
            high: number;
            medium: number;
            low: number;
        };
    };
}
export declare class CompletePerformanceMonitoringSystem {
    apm: APMAgent;
    resources: ResourceMonitor;
    profiler: Profiler;
    bottleneckDetector: BottleneckDetector;
    constructor();
    getOverallStats(): {
        apm: {
            activeTransactions: number;
            totalTransactions: number;
            metrics: PerformanceMetrics;
        };
        resources: {
            monitoring: boolean;
            samples: number;
            latest: ResourceMetrics | null;
        };
        profiler: {
            profiling: boolean;
            samples: number;
            currentProfile: string | undefined;
        };
        bottleneckDetector: {
            bottlenecks: number;
            bySeverity: {
                critical: number;
                high: number;
                medium: number;
                low: number;
            };
        };
    };
}
//# sourceMappingURL=MEGA_PerformanceMonitoring.d.ts.map