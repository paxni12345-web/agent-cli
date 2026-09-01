/**
 * MEGA PHASE 28: COMPLETE SYSTEM AGGREGATOR & FINAL INTEGRATION
 * All systems unified, Complete API surface, Production deployment ready
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface UnifiedSystemConfig {
    systemName: string;
    version: string;
    environment: string;
    modules: ModuleConfig[];
    globalConfig: GlobalConfig;
}
export interface ModuleConfig {
    name: string;
    enabled: boolean;
    priority: number;
    dependencies: string[];
    config: Record<string, any>;
}
export interface GlobalConfig {
    maxConnections: number;
    requestTimeout: number;
    retryAttempts: number;
    logging: LoggingConfig;
    monitoring: MonitoringConfig;
    security: SecurityConfig;
}
export interface LoggingConfig {
    level: LogLevel;
    format: LogFormat;
    outputs: LogOutput[];
}
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogFormat = 'json' | 'text' | 'structured';
export type LogOutput = 'console' | 'file' | 'syslog' | 'cloudwatch';
export interface MonitoringConfig {
    enabled: boolean;
    interval: number;
    metrics: string[];
    exporters: MetricExporter[];
}
export interface MetricExporter {
    type: ExporterType;
    endpoint: string;
    interval: number;
}
export type ExporterType = 'prometheus' | 'datadog' | 'newrelic' | 'cloudwatch';
export interface SecurityConfig {
    enableAuth: boolean;
    enableEncryption: boolean;
    enableAudit: boolean;
    policies: SecurityPolicy[];
}
export interface SecurityPolicy {
    name: string;
    rules: PolicyRule[];
    enforcement: EnforcementLevel;
}
export interface PolicyRule {
    resource: string;
    actions: string[];
    conditions: Map<string, any>;
}
export type EnforcementLevel = 'advisory' | 'enforcing' | 'blocking';
export declare class UnifiedSystemManager extends EventEmitter {
    private config;
    private modules;
    private initialized;
    private running;
    constructor(config: UnifiedSystemConfig);
    initialize(): Promise<void>;
    private initializeModule;
    start(): Promise<void>;
    private startModule;
    stop(): Promise<void>;
    private stopModule;
    getSystemStatus(): SystemStatus;
    getModule(name: string): SystemModule | undefined;
    private sleep;
    getStats(): {
        modules: number;
        running: number;
        initialized: boolean;
        systemRunning: boolean;
    };
}
export interface SystemModule {
    name: string;
    status: ModuleStatus;
    config: Record<string, any>;
    stats: ModuleStats;
    startTime: Date;
}
export type ModuleStatus = 'initializing' | 'ready' | 'running' | 'stopped' | 'error';
export interface ModuleStats {
    requests: number;
    errors: number;
    latency: number;
}
export interface SystemStatus {
    systemName: string;
    version: string;
    environment: string;
    initialized: boolean;
    running: boolean;
    modules: ModuleStatusInfo[];
    timestamp: Date;
}
export interface ModuleStatusInfo {
    name: string;
    status: ModuleStatus;
    uptime: number;
    stats: ModuleStats;
}
export interface APIGatewayConfig {
    port: number;
    host: string;
    routes: RouteDefinition[];
    middleware: MiddlewareConfig[];
    rateLimit: RateLimitConfig;
    cors: CORSConfig;
    authentication: AuthConfig;
}
export interface RouteDefinition {
    path: string;
    method: HTTPMethod;
    handler: string;
    middleware: string[];
    auth: boolean;
    rateLimit?: number;
}
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export interface MiddlewareConfig {
    name: string;
    enabled: boolean;
    order: number;
    config: Record<string, any>;
}
export interface RateLimitConfig {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    keyGenerator: string;
}
export interface CORSConfig {
    enabled: boolean;
    origins: string[];
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
}
export interface AuthConfig {
    type: AuthType;
    config: Record<string, any>;
}
export type AuthType = 'jwt' | 'oauth2' | 'apikey' | 'basic' | 'none';
export interface APIRequest {
    id: string;
    method: HTTPMethod;
    path: string;
    headers: Map<string, string>;
    query: Map<string, string>;
    body?: any;
    timestamp: Date;
}
export interface APIResponse {
    statusCode: number;
    headers: Map<string, string>;
    body?: any;
    duration: number;
}
export declare class ComprehensiveAPIGateway extends EventEmitter {
    private config;
    private routes;
    private middleware;
    private rateLimiters;
    constructor(config: APIGatewayConfig);
    private initializeRoutes;
    private initializeMiddleware;
    private createMiddleware;
    handleRequest(req: APIRequest): Promise<APIResponse>;
    private findRoute;
    private checkRateLimit;
    private generateRateLimitKey;
    private authenticate;
    private executeMiddleware;
    private executeHandler;
    private sleep;
    getStats(): {
        routes: number;
        middleware: number;
        rateLimiters: number;
    };
}
export type MiddlewareFunction = (req: APIRequest, res: APIResponse, next: () => Promise<void>) => Promise<void>;
export declare class RateLimiter {
    private maxRequests;
    private windowMs;
    private requests;
    constructor(maxRequests: number, windowMs: number);
    tryAcquire(): boolean;
}
export interface DeploymentOrchestratorConfig {
    strategy: DeploymentStrategy;
    healthChecks: HealthCheckConfig[];
    rollback: RollbackConfig;
    notifications: NotificationConfig[];
}
export type DeploymentStrategy = 'rolling' | 'blue_green' | 'canary' | 'recreate' | 'a_b';
export interface HealthCheckConfig {
    type: HealthCheckType;
    endpoint?: string;
    interval: number;
    timeout: number;
    retries: number;
}
export type HealthCheckType = 'http' | 'tcp' | 'script' | 'command';
export interface RollbackConfig {
    automatic: boolean;
    threshold: RollbackThreshold;
    timeout: number;
}
export interface RollbackThreshold {
    errorRate: number;
    latency: number;
    healthCheckFailures: number;
}
export interface NotificationConfig {
    type: NotificationType;
    events: DeploymentEvent[];
    recipients: string[];
}
export type NotificationType = 'email' | 'slack' | 'webhook' | 'pagerduty' | 'teams';
export type DeploymentEvent = 'started' | 'progressing' | 'completed' | 'failed' | 'rolled_back' | 'cancelled';
export interface Deployment {
    id: string;
    version: string;
    strategy: DeploymentStrategy;
    status: DeploymentStatus;
    progress: number;
    instances: DeploymentInstance[];
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}
export type DeploymentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolling_back' | 'rolled_back';
export interface DeploymentInstance {
    id: string;
    version: string;
    status: InstanceStatus;
    healthy: boolean;
    traffic: number;
    startedAt: Date;
}
export type InstanceStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
export declare class DeploymentOrchestrator extends EventEmitter {
    private config;
    private deployments;
    private activeDeployment?;
    constructor(config: DeploymentOrchestratorConfig);
    deploy(version: string, instanceCount: number): Promise<Deployment>;
    private executeDeployment;
    private rollingUpdate;
    private blueGreenDeployment;
    private canaryDeployment;
    private recreateDeployment;
    private createInstance;
    private stopInstance;
    private waitForHealthy;
    private checkHealth;
    rollback(deploymentId: string): Promise<void>;
    private sleep;
    private generateId;
    getStats(): {
        deployments: number;
        activeInstances: number;
        healthyInstances: number;
    };
}
export declare class FinalCompleteEnterpriseSystem {
    systemManager: UnifiedSystemManager;
    apiGateway: ComprehensiveAPIGateway;
    deploymentOrchestrator: DeploymentOrchestrator;
    private initialized;
    constructor(systemConfig: UnifiedSystemConfig, apiConfig: APIGatewayConfig, deployConfig: DeploymentOrchestratorConfig);
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getCompleteStatus(): {
        system: SystemStatus;
        api: {
            routes: number;
            middleware: number;
            rateLimiters: number;
        };
        deployment: {
            deployments: number;
            activeInstances: number;
            healthyInstances: number;
        };
        timestamp: Date;
    };
    isReady(): boolean;
}
//# sourceMappingURL=MEGA_FinalSystem.d.ts.map