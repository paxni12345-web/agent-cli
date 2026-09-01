/**
 * Distributed System & Service Mesh
 * Microservices orchestration, service discovery, load balancing
 *
 * Part of 350K lines goal
 */
import { EventEmitter } from 'events';
export interface ServiceMeshConfig {
    enableServiceDiscovery: boolean;
    enableLoadBalancing: boolean;
    enableCircuitBreaker: boolean;
    enableRetry: boolean;
    enableTracing: boolean;
    healthCheckInterval: number;
}
export interface Service {
    id: string;
    name: string;
    version: string;
    host: string;
    port: number;
    protocol: Protocol;
    endpoints: Endpoint[];
    health: HealthStatus;
    metadata: ServiceMetadata;
    registeredAt: Date;
    lastHeartbeat: Date;
}
export type Protocol = 'http' | 'https' | 'grpc' | 'tcp' | 'udp';
export interface Endpoint {
    path: string;
    method: HttpMethod;
    authenticated: boolean;
    rateLimit?: RateLimit;
}
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
export interface RateLimit {
    requests: number;
    window: number;
}
export interface ServiceMetadata {
    region?: string;
    zone?: string;
    datacenter?: string;
    tags?: string[];
    weight?: number;
}
export interface HealthStatus {
    status: HealthState;
    checks: HealthCheck[];
    lastChecked: Date;
}
export type HealthState = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export interface HealthCheck {
    name: string;
    status: HealthState;
    message?: string;
    duration: number;
}
export interface LoadBalancer {
    id: string;
    algorithm: LoadBalancingAlgorithm;
    targets: ServiceTarget[];
    healthCheck: HealthCheckConfig;
}
export type LoadBalancingAlgorithm = 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'ip_hash' | 'random';
export interface ServiceTarget {
    serviceId: string;
    weight: number;
    connections: number;
    active: boolean;
}
export interface HealthCheckConfig {
    interval: number;
    timeout: number;
    healthyThreshold: number;
    unhealthyThreshold: number;
}
export interface CircuitBreaker {
    id: string;
    serviceId: string;
    state: CircuitState;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    failures: number;
    successes: number;
    lastStateChange: Date;
    halfOpenAttempts: number;
}
export type CircuitState = 'closed' | 'open' | 'half_open';
export interface RetryPolicy {
    maxRetries: number;
    backoffStrategy: BackoffStrategy;
    retryableErrors: string[];
    timeout: number;
}
export type BackoffStrategy = 'fixed' | 'exponential' | 'random';
export interface ServiceRequest {
    id: string;
    sourceService: string;
    targetService: string;
    endpoint: string;
    method: HttpMethod;
    headers: Record<string, string>;
    body?: any;
    timestamp: Date;
    traceId?: string;
}
export interface ServiceResponse {
    requestId: string;
    statusCode: number;
    headers: Record<string, string>;
    body?: any;
    duration: number;
    timestamp: Date;
}
export interface ServiceRegistry {
    services: Map<string, Service[]>;
    watchers: Map<string, ServiceWatcher[]>;
}
export interface ServiceWatcher {
    id: string;
    serviceName: string;
    callback: (services: Service[]) => void;
}
export interface Trace {
    id: string;
    parentId?: string;
    operation: string;
    service: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    tags: Record<string, string>;
    logs: TraceLog[];
}
export interface TraceLog {
    timestamp: Date;
    level: LogLevel;
    message: string;
    fields?: Record<string, any>;
}
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface MeshMetrics {
    totalServices: number;
    healthyServices: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
}
export declare class ServiceMeshManager extends EventEmitter {
    private config;
    private registry;
    private loadBalancers;
    private circuitBreakers;
    private retryPolicies;
    private traces;
    private requests;
    private responses;
    private healthCheckInterval;
    constructor(config?: Partial<ServiceMeshConfig>);
    registerService(name: string, version: string, host: string, port: number, endpoints: Endpoint[], metadata?: ServiceMetadata): Service;
    deregisterService(serviceId: string): void;
    discoverServices(name: string): Service[];
    watchService(serviceName: string, callback: (services: Service[]) => void): string;
    unwatchService(watcherId: string): void;
    private notifyWatchers;
    private startHealthChecks;
    private performHealthChecks;
    private checkServiceHealth;
    private checkEndpoint;
    private checkLatency;
    private checkResources;
    createLoadBalancer(serviceName: string, algorithm?: LoadBalancingAlgorithm): LoadBalancer;
    selectTarget(serviceName: string): Service | null;
    private selectRoundRobin;
    private selectLeastConnections;
    private selectWeightedRoundRobin;
    private selectRandom;
    createCircuitBreaker(serviceId: string, failureThreshold?: number, timeout?: number): CircuitBreaker;
    executeWithCircuitBreaker(serviceId: string, operation: () => Promise<any>): Promise<any>;
    setRetryPolicy(serviceName: string, policy: RetryPolicy): void;
    executeWithRetry(serviceName: string, operation: () => Promise<any>): Promise<any>;
    private calculateBackoff;
    private sleep;
    startTrace(operation: string, service: string, parentId?: string): Trace;
    endTrace(traceId: string): void;
    private generateId;
    getMetrics(): MeshMetrics;
    getStats(): {
        services: number;
        loadBalancers: number;
        circuitBreakers: number;
        openCircuits: number;
        retryPolicies: number;
        traces: number;
        metrics: MeshMetrics;
    };
    close(): void;
}
//# sourceMappingURL=ServiceMesh.d.ts.map