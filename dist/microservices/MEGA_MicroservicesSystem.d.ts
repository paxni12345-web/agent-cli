/**
 * MEGA PHASE 20: MICROSERVICES & SERVICE DISCOVERY
 * Service mesh, Discovery, Circuit breaker, Load balancing, Health checks
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface ServiceRegistryConfig {
    heartbeatInterval: number;
    heartbeatTimeout: number;
    deregisterAfter: number;
    enableHealthChecks: boolean;
}
export interface ServiceInstance {
    id: string;
    name: string;
    version: string;
    host: string;
    port: number;
    protocol: Protocol;
    metadata: Map<string, string>;
    tags: string[];
    health: HealthStatus;
    registeredAt: Date;
    lastHeartbeat: Date;
}
export type Protocol = 'http' | 'https' | 'grpc' | 'tcp';
export interface HealthStatus {
    status: HealthState;
    checks: HealthCheck[];
    lastCheck: Date;
}
export type HealthState = 'passing' | 'warning' | 'critical' | 'unknown';
export interface HealthCheck {
    name: string;
    type: CheckType;
    interval: number;
    timeout: number;
    status: HealthState;
    output?: string;
}
export type CheckType = 'http' | 'tcp' | 'grpc' | 'script' | 'ttl';
export interface ServiceQuery {
    name?: string;
    version?: string;
    tags?: string[];
    healthy?: boolean;
}
export declare class ServiceRegistry extends EventEmitter {
    private config;
    private services;
    private servicesByName;
    constructor(config?: Partial<ServiceRegistryConfig>);
    register(service: Omit<ServiceInstance, 'id' | 'registeredAt' | 'lastHeartbeat'>): ServiceInstance;
    deregister(serviceId: string): void;
    heartbeat(serviceId: string): void;
    discover(query: ServiceQuery): ServiceInstance[];
    private startHealthCheckMonitor;
    private checkStaleServices;
    private runHealthChecks;
    private executeHealthCheck;
    private updateServiceHealth;
    private sleep;
    private generateId;
    getStats(): {
        services: number;
        healthyServices: number;
    };
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
    volumeThreshold: number;
}
export interface CircuitBreaker {
    name: string;
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime?: Date;
    lastStateChange: Date;
    stats: CircuitStats;
}
export type CircuitState = 'closed' | 'open' | 'half_open';
export interface CircuitStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rejectedRequests: number;
    averageResponseTime: number;
}
export declare class CircuitBreakerManager extends EventEmitter {
    private config;
    private breakers;
    constructor(config?: Partial<CircuitBreakerConfig>);
    createBreaker(name: string): CircuitBreaker;
    execute<T>(name: string, fn: () => Promise<T>): Promise<T>;
    private executeWithTimeout;
    private onSuccess;
    private onFailure;
    private openCircuit;
    private closeCircuit;
    private shouldAttemptReset;
    private updateResponseTime;
    getStats(): {
        breakers: number;
        openCircuits: number;
    };
}
export interface LoadBalancerConfig {
    strategy: LoadBalancingStrategy;
    healthCheckInterval: number;
    stickySession: boolean;
}
export type LoadBalancingStrategy = 'round_robin' | 'least_connections' | 'random' | 'weighted' | 'ip_hash';
export interface Backend {
    id: string;
    instance: ServiceInstance;
    weight: number;
    connections: number;
    healthy: boolean;
}
export declare class LoadBalancer extends EventEmitter {
    private config;
    private backends;
    private roundRobinIndex;
    private sessionMap;
    constructor(config?: Partial<LoadBalancerConfig>);
    addBackend(instance: ServiceInstance, weight?: number): Backend;
    removeBackend(backendId: string): void;
    selectBackend(sessionId?: string): Backend | null;
    private roundRobin;
    private leastConnections;
    private random;
    private weighted;
    incrementConnections(backendId: string): void;
    decrementConnections(backendId: string): void;
    private generateId;
    getStats(): {
        backends: number;
        healthyBackends: number;
        totalConnections: number;
    };
}
export interface ServiceMeshConfig {
    enableMTLS: boolean;
    enableTracing: boolean;
    enableMetrics: boolean;
    retryPolicy: MeshRetryPolicy;
    timeoutPolicy: TimeoutPolicy;
}
export interface MeshRetryPolicy {
    attempts: number;
    perTryTimeout: number;
    retryOn: string[];
}
export interface TimeoutPolicy {
    request: number;
    idle: number;
}
export interface ServiceProxy {
    id: string;
    service: ServiceInstance;
    upstreamConnections: number;
    downstreamConnections: number;
    bytesIn: number;
    bytesOut: number;
}
export declare class ServiceMesh extends EventEmitter {
    private config;
    private proxies;
    private registry;
    private loadBalancer;
    private circuitBreaker;
    constructor(registry: ServiceRegistry, config?: Partial<ServiceMeshConfig>);
    createProxy(service: ServiceInstance): ServiceProxy;
    route(request: ServiceRequest): Promise<ServiceResponse>;
    private forwardRequest;
    private sleep;
    private generateId;
    getStats(): {
        proxies: number;
        registry: {
            services: number;
            healthyServices: number;
        };
        loadBalancer: {
            backends: number;
            healthyBackends: number;
            totalConnections: number;
        };
        circuitBreaker: {
            breakers: number;
            openCircuits: number;
        };
    };
}
export interface ServiceRequest {
    service: string;
    method: string;
    path: string;
    headers: Map<string, string>;
    body?: any;
    sessionId?: string;
}
export interface ServiceResponse {
    status: number;
    headers: Map<string, string>;
    body: any;
    backend: string;
}
export interface GatewayConfig {
    routes: Route[];
    middleware: Middleware[];
    rateLimit: RateLimitConfig;
    cors: CORSConfig;
}
export interface Route {
    path: string;
    methods: string[];
    service: string;
    rewrite?: string;
    stripPath?: boolean;
}
export interface Middleware {
    name: string;
    execute: (request: any, next: () => Promise<any>) => Promise<any>;
}
export interface RateLimitConfig {
    enabled: boolean;
    requests: number;
    window: number;
    keyGenerator?: (request: any) => string;
}
export interface CORSConfig {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
}
export declare class APIGateway extends EventEmitter {
    private config;
    private mesh;
    private rateLimiters;
    constructor(mesh: ServiceMesh, config?: Partial<GatewayConfig>);
    handleRequest(request: any): Promise<any>;
    private findRoute;
    private matchRoute;
    private checkRateLimit;
    getStats(): {
        routes: number;
        middleware: number;
        mesh: {
            proxies: number;
            registry: {
                services: number;
                healthyServices: number;
            };
            loadBalancer: {
                backends: number;
                healthyBackends: number;
                totalConnections: number;
            };
            circuitBreaker: {
                breakers: number;
                openCircuits: number;
            };
        };
    };
}
export declare class RateLimiter {
    private requests;
    private window;
    private timestamps;
    constructor(requests: number, window: number);
    tryAcquire(): boolean;
}
export declare class CompleteMicroservicesSystem {
    registry: ServiceRegistry;
    circuitBreaker: CircuitBreakerManager;
    loadBalancer: LoadBalancer;
    mesh: ServiceMesh;
    gateway: APIGateway;
    constructor();
    getOverallStats(): {
        registry: {
            services: number;
            healthyServices: number;
        };
        circuitBreaker: {
            breakers: number;
            openCircuits: number;
        };
        loadBalancer: {
            backends: number;
            healthyBackends: number;
            totalConnections: number;
        };
        mesh: {
            proxies: number;
            registry: {
                services: number;
                healthyServices: number;
            };
            loadBalancer: {
                backends: number;
                healthyBackends: number;
                totalConnections: number;
            };
            circuitBreaker: {
                breakers: number;
                openCircuits: number;
            };
        };
        gateway: {
            routes: number;
            middleware: number;
            mesh: {
                proxies: number;
                registry: {
                    services: number;
                    healthyServices: number;
                };
                loadBalancer: {
                    backends: number;
                    healthyBackends: number;
                    totalConnections: number;
                };
                circuitBreaker: {
                    breakers: number;
                    openCircuits: number;
                };
            };
        };
    };
}
//# sourceMappingURL=MEGA_MicroservicesSystem.d.ts.map