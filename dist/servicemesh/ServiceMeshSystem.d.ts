/**
 * Service Mesh System
 * Service discovery, load balancing, health checking, and inter-service communication
 */
export interface Service {
    id: string;
    name: string;
    version: string;
    type: ServiceType;
    endpoints: ServiceEndpoint[];
    metadata: ServiceMetadata;
    health: HealthStatus;
    tags: string[];
    registeredAt: Date;
    lastHeartbeat: Date;
}
export declare enum ServiceType {
    HTTP = "http",
    GRPC = "grpc",
    TCP = "tcp",
    UDP = "udp",
    WebSocket = "websocket"
}
export interface ServiceEndpoint {
    id: string;
    host: string;
    port: number;
    protocol: string;
    path?: string;
    weight: number;
    metadata: Record<string, any>;
}
export interface ServiceMetadata {
    region: string;
    zone: string;
    datacenter: string;
    environment: Environment;
    owner: string;
    dependencies: string[];
    resources: ResourceRequirements;
}
export declare enum Environment {
    Development = "development",
    Staging = "staging",
    Production = "production",
    Test = "test"
}
export interface ResourceRequirements {
    cpu: number;
    memory: number;
    disk: number;
}
export interface HealthStatus {
    status: HealthState;
    checks: HealthCheck[];
    lastCheck: Date;
    consecutiveFailures: number;
}
export declare enum HealthState {
    Healthy = "healthy",
    Unhealthy = "unhealthy",
    Warning = "warning",
    Unknown = "unknown"
}
export interface HealthCheck {
    id: string;
    name: string;
    type: HealthCheckType;
    config: HealthCheckConfig;
    status: HealthState;
    message?: string;
    lastCheck: Date;
    duration: number;
}
export declare enum HealthCheckType {
    HTTP = "http",
    TCP = "tcp",
    Script = "script",
    GRPC = "grpc"
}
export interface HealthCheckConfig {
    interval: number;
    timeout: number;
    retries: number;
    endpoint?: string;
    expectedStatus?: number;
    script?: string;
}
export interface LoadBalancer {
    id: string;
    name: string;
    algorithm: LoadBalancingAlgorithm;
    serviceNames: string[];
    config: LoadBalancerConfig;
    enabled: boolean;
    createdAt: Date;
}
export declare enum LoadBalancingAlgorithm {
    RoundRobin = "round_robin",
    LeastConnections = "least_connections",
    WeightedRoundRobin = "weighted_round_robin",
    Random = "random",
    IPHash = "ip_hash",
    LeastResponseTime = "least_response_time",
    ConsistentHash = "consistent_hash"
}
export interface LoadBalancerConfig {
    healthCheckEnabled: boolean;
    healthCheckInterval: number;
    sessionAffinity: boolean;
    sessionAffinityTTL: number;
    maxRetries: number;
    retryTimeout: number;
}
export interface ServiceInstance {
    service: Service;
    endpoint: ServiceEndpoint;
    connections: number;
    totalRequests: number;
    failedRequests: number;
    averageResponseTime: number;
}
export interface RouteConfig {
    id: string;
    name: string;
    source: RouteSource;
    destinations: RouteDestination[];
    rules: RoutingRule[];
    enabled: boolean;
    createdAt: Date;
}
export interface RouteSource {
    path: string;
    methods: string[];
    headers?: Record<string, string>;
}
export interface RouteDestination {
    serviceName: string;
    weight: number;
    headers?: Record<string, string>;
    rewrite?: string;
}
export interface RoutingRule {
    type: RuleType;
    condition: RuleCondition;
    action: RuleAction;
}
export declare enum RuleType {
    Header = "header",
    Path = "path",
    Query = "query",
    Method = "method",
    Weight = "weight"
}
export interface RuleCondition {
    field: string;
    operator: ConditionOperator;
    value: any;
}
export declare enum ConditionOperator {
    Equals = "equals",
    NotEquals = "not_equals",
    Contains = "contains",
    StartsWith = "starts_with",
    EndsWith = "ends_with",
    Matches = "matches"
}
export interface RuleAction {
    type: ActionType;
    config: Record<string, any>;
}
export declare enum ActionType {
    Forward = "forward",
    Redirect = "redirect",
    Rewrite = "rewrite",
    Reject = "reject"
}
export interface ServiceDiscoveryConfig {
    backend: DiscoveryBackend;
    refreshInterval: number;
    cacheEnabled: boolean;
    cacheTTL: number;
}
export declare enum DiscoveryBackend {
    Consul = "consul",
    Etcd = "etcd",
    Eureka = "eureka",
    Kubernetes = "kubernetes",
    ZooKeeper = "zookeeper"
}
export interface CircuitBreakerPolicy {
    id: string;
    serviceName: string;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
    enabled: boolean;
}
export interface RetryPolicy {
    id: string;
    serviceName: string;
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
    retryableErrors: string[];
    enabled: boolean;
}
export interface TimeoutPolicy {
    id: string;
    serviceName: string;
    connectionTimeout: number;
    requestTimeout: number;
    idleTimeout: number;
    enabled: boolean;
}
export interface TrafficSplit {
    id: string;
    name: string;
    serviceName: string;
    splits: Split[];
    enabled: boolean;
    createdAt: Date;
}
export interface Split {
    version: string;
    weight: number;
    headers?: Record<string, string>;
}
export interface ServiceMetrics {
    serviceName: string;
    period: {
        start: Date;
        end: Date;
    };
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
}
export interface Middleware {
    id: string;
    name: string;
    type: MiddlewareType;
    config: Record<string, any>;
    order: number;
    enabled: boolean;
}
export declare enum MiddlewareType {
    Authentication = "authentication",
    Authorization = "authorization",
    RateLimit = "rate_limit",
    Logging = "logging",
    Tracing = "tracing",
    Compression = "compression",
    CORS = "cors",
    Transform = "transform"
}
/**
 * Service Registry
 */
export declare class ServiceRegistry {
    private services;
    /**
     * Register service
     */
    register(config: Omit<Service, 'id' | 'health' | 'registeredAt' | 'lastHeartbeat'>): Service;
    /**
     * Deregister service
     */
    deregister(serviceId: string): void;
    /**
     * Update heartbeat
     */
    heartbeat(serviceId: string): void;
    /**
     * Get service
     */
    getService(serviceId: string): Service | undefined;
    /**
     * Find services by name
     */
    findByName(name: string): Service[];
    /**
     * Find services by tag
     */
    findByTag(tag: string): Service[];
    /**
     * List all services
     */
    listServices(filter?: {
        environment?: Environment;
        type?: ServiceType;
    }): Service[];
    private generateServiceId;
}
/**
 * Health Check Manager
 */
export declare class HealthCheckManager {
    private registry;
    private checkIntervals;
    constructor(registry: ServiceRegistry);
    /**
     * Add health check to service
     */
    addCheck(serviceId: string, check: Omit<HealthCheck, 'id' | 'status' | 'lastCheck' | 'duration'>): HealthCheck;
    /**
     * Execute health check
     */
    executeCheck(serviceId: string, checkId: string): Promise<HealthCheck>;
    /**
     * Remove health check
     */
    removeCheck(serviceId: string, checkId: string): void;
    private scheduleCheck;
    private updateServiceHealth;
    private generateCheckId;
}
/**
 * Load Balancer
 */
export declare class LoadBalancerManager {
    private balancers;
    private instances;
    private roundRobinCounters;
    private registry;
    constructor(registry: ServiceRegistry);
    /**
     * Create load balancer
     */
    createBalancer(config: Omit<LoadBalancer, 'id' | 'createdAt'>): LoadBalancer;
    /**
     * Select service instance
     */
    selectInstance(balancerId: string, requestContext?: Record<string, any>): ServiceInstance | null;
    /**
     * Get balancer
     */
    getBalancer(balancerId: string): LoadBalancer | undefined;
    /**
     * List balancers
     */
    listBalancers(): LoadBalancer[];
    private getHealthyInstances;
    private roundRobin;
    private weightedRoundRobin;
    private leastConnections;
    private random;
    private leastResponseTime;
    private generateBalancerId;
}
/**
 * Service Router
 */
export declare class ServiceRouter {
    private routes;
    /**
     * Create route
     */
    createRoute(config: Omit<RouteConfig, 'id' | 'createdAt'>): RouteConfig;
    /**
     * Match route
     */
    matchRoute(path: string, method: string, headers: Record<string, string>): RouteConfig | null;
    /**
     * Get route
     */
    getRoute(routeId: string): RouteConfig | undefined;
    /**
     * List routes
     */
    listRoutes(): RouteConfig[];
    private matchPath;
    private generateRouteId;
}
/**
 * Traffic Manager
 */
export declare class TrafficManager {
    private splits;
    /**
     * Create traffic split
     */
    createSplit(config: Omit<TrafficSplit, 'id' | 'createdAt'>): TrafficSplit;
    /**
     * Select version based on traffic split
     */
    selectVersion(serviceName: string): string | null;
    /**
     * Get split
     */
    getSplit(splitId: string): TrafficSplit | undefined;
    /**
     * List splits
     */
    listSplits(serviceName?: string): TrafficSplit[];
    private generateSplitId;
}
/**
 * Singleton instances
 */
export declare const serviceRegistry: ServiceRegistry;
export declare const healthCheckManager: HealthCheckManager;
export declare const loadBalancerManager: LoadBalancerManager;
export declare const serviceRouter: ServiceRouter;
export declare const trafficManager: TrafficManager;
//# sourceMappingURL=ServiceMeshSystem.d.ts.map