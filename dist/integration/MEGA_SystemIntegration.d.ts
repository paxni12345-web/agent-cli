/**
 * MEGA PHASE 26: COMPLETE INTEGRATION & SYSTEM ORCHESTRATOR
 * System-wide integration, Health checks, Status dashboard, Unified management
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface SystemConfig {
    name: string;
    version: string;
    environment: Environment;
    components: ComponentConfig[];
    healthCheckInterval: number;
    enableAutoRecovery: boolean;
    monitoring: MonitoringConfig;
}
export type Environment = 'development' | 'staging' | 'production';
export interface ComponentConfig {
    name: string;
    type: ComponentType;
    enabled: boolean;
    dependencies: string[];
    config: Record<string, any>;
}
export type ComponentType = 'api' | 'database' | 'cache' | 'queue' | 'storage' | 'ml' | 'analytics' | 'security';
export interface MonitoringConfig {
    enableMetrics: boolean;
    enableTracing: boolean;
    enableLogs: boolean;
    enableAlerts: boolean;
}
export interface SystemStatus {
    status: SystemHealth;
    uptime: number;
    version: string;
    components: ComponentStatus[];
    metrics: SystemMetrics;
    timestamp: Date;
}
export type SystemHealth = 'healthy' | 'degraded' | 'unhealthy' | 'down';
export interface ComponentStatus {
    name: string;
    health: SystemHealth;
    status: string;
    latency?: number;
    lastCheck: Date;
    error?: string;
    metadata: Map<string, any>;
}
export interface SystemMetrics {
    requests: RequestMetrics;
    resources: ResourceUsage;
    errors: ErrorMetrics;
    performance: PerformanceMetrics;
}
export interface RequestMetrics {
    total: number;
    successful: number;
    failed: number;
    rps: number;
    averageLatency: number;
}
export interface ResourceUsage {
    cpu: number;
    memory: number;
    disk: number;
    network: NetworkUsage;
}
export interface NetworkUsage {
    inbound: number;
    outbound: number;
    connections: number;
}
export interface ErrorMetrics {
    total: number;
    rate: number;
    byType: Map<string, number>;
}
export interface PerformanceMetrics {
    throughput: number;
    p50: number;
    p95: number;
    p99: number;
    apdex: number;
}
export declare class SystemOrchestrator extends EventEmitter {
    private config;
    private components;
    private startTime;
    private monitoring;
    constructor(config: SystemConfig);
    private initializeComponents;
    start(): Promise<void>;
    stop(): Promise<void>;
    private startComponent;
    private stopComponent;
    private resolveStartOrder;
    private startMonitoring;
    private performHealthChecks;
    private checkComponentHealth;
    private recoverComponent;
    getStatus(): SystemStatus;
    private calculateOverallHealth;
    private collectMetrics;
    private sleep;
    getComponent(name: string): Component | undefined;
}
export interface Component {
    name: string;
    type: ComponentType;
    status: ComponentStatus;
    enabled: boolean;
    dependencies: string[];
    config: Record<string, any>;
}
export interface DashboardConfig {
    refreshInterval: number;
    enableRealTime: boolean;
    widgets: WidgetConfig[];
}
export interface WidgetConfig {
    id: string;
    type: WidgetType;
    title: string;
    size: WidgetSize;
    config: Record<string, any>;
}
export type WidgetType = 'metrics' | 'chart' | 'status' | 'logs' | 'alerts' | 'topology' | 'custom';
export interface WidgetSize {
    width: number;
    height: number;
}
export interface DashboardData {
    widgets: WidgetData[];
    timestamp: Date;
}
export interface WidgetData {
    id: string;
    type: WidgetType;
    data: any;
    loading: boolean;
    error?: string;
}
export interface MetricsWidget {
    metrics: MetricValue[];
    trends: TrendData[];
}
export interface MetricValue {
    name: string;
    value: number;
    unit: string;
    change?: number;
    status: MetricStatus;
}
export type MetricStatus = 'good' | 'warning' | 'critical';
export interface TrendData {
    timestamp: Date;
    value: number;
}
export interface ChartWidget {
    type: ChartType;
    data: ChartDataPoint[];
    options: ChartOptions;
}
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter';
export interface ChartDataPoint {
    x: any;
    y: number;
    label?: string;
}
export interface ChartOptions {
    title?: string;
    xAxis?: AxisConfig;
    yAxis?: AxisConfig;
    legend?: boolean;
}
export interface AxisConfig {
    label: string;
    type: 'linear' | 'logarithmic' | 'time';
}
export declare class UnifiedDashboard extends EventEmitter {
    private config;
    private orchestrator;
    private data;
    private updating;
    constructor(orchestrator: SystemOrchestrator, config?: Partial<DashboardConfig>);
    getDashboardData(): Promise<DashboardData>;
    private fetchWidgetData;
    private generateWidgetData;
    private generateMetricsData;
    private generateChartData;
    private generateStatusData;
    private generateLogsData;
    private generateAlertsData;
    private generateTopologyData;
    private startRealTimeUpdates;
    private refreshData;
    stop(): void;
    private sleep;
}
export interface IntegrationConfig {
    enableAll: boolean;
    integrations: IntegrationDefinition[];
}
export interface IntegrationDefinition {
    name: string;
    type: IntegrationType;
    enabled: boolean;
    config: Record<string, any>;
}
export type IntegrationType = 'webhook' | 'api' | 'database' | 'message_queue' | 'storage' | 'monitoring' | 'alerting';
export interface Integration {
    name: string;
    type: IntegrationType;
    status: IntegrationStatus;
    lastSync?: Date;
    error?: string;
}
export type IntegrationStatus = 'active' | 'inactive' | 'error';
export declare class IntegrationManager extends EventEmitter {
    private config;
    private integrations;
    constructor(config?: Partial<IntegrationConfig>);
    private initializeIntegrations;
    enableIntegration(name: string): Promise<void>;
    disableIntegration(name: string): Promise<void>;
    sync(name: string): Promise<void>;
    private performSync;
    private sleep;
    getStats(): {
        total: number;
        active: number;
        errors: number;
    };
}
export declare class CompleteSystemIntegration {
    orchestrator: SystemOrchestrator;
    dashboard: UnifiedDashboard;
    integrations: IntegrationManager;
    constructor(config: SystemConfig);
    private setupEventHandlers;
    start(): Promise<void>;
    stop(): Promise<void>;
    getOverallStatus(): {
        system: SystemStatus;
        integrations: {
            total: number;
            active: number;
            errors: number;
        };
    };
}
export declare class CompleteEnterprisePlatform {
    system: CompleteSystemIntegration;
    private initialized;
    constructor(config: SystemConfig);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): {
        system: SystemStatus;
        integrations: {
            total: number;
            active: number;
            errors: number;
        };
    };
    isHealthy(): boolean;
}
//# sourceMappingURL=MEGA_SystemIntegration.d.ts.map