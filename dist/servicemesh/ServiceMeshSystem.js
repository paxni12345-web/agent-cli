"use strict";
/**
 * Service Mesh System
 * Service discovery, load balancing, health checking, and inter-service communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trafficManager = exports.serviceRouter = exports.loadBalancerManager = exports.healthCheckManager = exports.serviceRegistry = exports.TrafficManager = exports.ServiceRouter = exports.LoadBalancerManager = exports.HealthCheckManager = exports.ServiceRegistry = exports.MiddlewareType = exports.DiscoveryBackend = exports.ActionType = exports.ConditionOperator = exports.RuleType = exports.LoadBalancingAlgorithm = exports.HealthCheckType = exports.HealthState = exports.Environment = exports.ServiceType = void 0;
const EventBus_1 = require("../core/EventBus");
var ServiceType;
(function (ServiceType) {
    ServiceType["HTTP"] = "http";
    ServiceType["GRPC"] = "grpc";
    ServiceType["TCP"] = "tcp";
    ServiceType["UDP"] = "udp";
    ServiceType["WebSocket"] = "websocket";
})(ServiceType || (exports.ServiceType = ServiceType = {}));
var Environment;
(function (Environment) {
    Environment["Development"] = "development";
    Environment["Staging"] = "staging";
    Environment["Production"] = "production";
    Environment["Test"] = "test";
})(Environment || (exports.Environment = Environment = {}));
var HealthState;
(function (HealthState) {
    HealthState["Healthy"] = "healthy";
    HealthState["Unhealthy"] = "unhealthy";
    HealthState["Warning"] = "warning";
    HealthState["Unknown"] = "unknown";
})(HealthState || (exports.HealthState = HealthState = {}));
var HealthCheckType;
(function (HealthCheckType) {
    HealthCheckType["HTTP"] = "http";
    HealthCheckType["TCP"] = "tcp";
    HealthCheckType["Script"] = "script";
    HealthCheckType["GRPC"] = "grpc";
})(HealthCheckType || (exports.HealthCheckType = HealthCheckType = {}));
var LoadBalancingAlgorithm;
(function (LoadBalancingAlgorithm) {
    LoadBalancingAlgorithm["RoundRobin"] = "round_robin";
    LoadBalancingAlgorithm["LeastConnections"] = "least_connections";
    LoadBalancingAlgorithm["WeightedRoundRobin"] = "weighted_round_robin";
    LoadBalancingAlgorithm["Random"] = "random";
    LoadBalancingAlgorithm["IPHash"] = "ip_hash";
    LoadBalancingAlgorithm["LeastResponseTime"] = "least_response_time";
    LoadBalancingAlgorithm["ConsistentHash"] = "consistent_hash";
})(LoadBalancingAlgorithm || (exports.LoadBalancingAlgorithm = LoadBalancingAlgorithm = {}));
var RuleType;
(function (RuleType) {
    RuleType["Header"] = "header";
    RuleType["Path"] = "path";
    RuleType["Query"] = "query";
    RuleType["Method"] = "method";
    RuleType["Weight"] = "weight";
})(RuleType || (exports.RuleType = RuleType = {}));
var ConditionOperator;
(function (ConditionOperator) {
    ConditionOperator["Equals"] = "equals";
    ConditionOperator["NotEquals"] = "not_equals";
    ConditionOperator["Contains"] = "contains";
    ConditionOperator["StartsWith"] = "starts_with";
    ConditionOperator["EndsWith"] = "ends_with";
    ConditionOperator["Matches"] = "matches";
})(ConditionOperator || (exports.ConditionOperator = ConditionOperator = {}));
var ActionType;
(function (ActionType) {
    ActionType["Forward"] = "forward";
    ActionType["Redirect"] = "redirect";
    ActionType["Rewrite"] = "rewrite";
    ActionType["Reject"] = "reject";
})(ActionType || (exports.ActionType = ActionType = {}));
var DiscoveryBackend;
(function (DiscoveryBackend) {
    DiscoveryBackend["Consul"] = "consul";
    DiscoveryBackend["Etcd"] = "etcd";
    DiscoveryBackend["Eureka"] = "eureka";
    DiscoveryBackend["Kubernetes"] = "kubernetes";
    DiscoveryBackend["ZooKeeper"] = "zookeeper";
})(DiscoveryBackend || (exports.DiscoveryBackend = DiscoveryBackend = {}));
var MiddlewareType;
(function (MiddlewareType) {
    MiddlewareType["Authentication"] = "authentication";
    MiddlewareType["Authorization"] = "authorization";
    MiddlewareType["RateLimit"] = "rate_limit";
    MiddlewareType["Logging"] = "logging";
    MiddlewareType["Tracing"] = "tracing";
    MiddlewareType["Compression"] = "compression";
    MiddlewareType["CORS"] = "cors";
    MiddlewareType["Transform"] = "transform";
})(MiddlewareType || (exports.MiddlewareType = MiddlewareType = {}));
/**
 * Service Registry
 */
class ServiceRegistry {
    services = new Map();
    /**
     * Register service
     */
    register(config) {
        const service = {
            ...config,
            id: this.generateServiceId(),
            health: {
                status: HealthState.Unknown,
                checks: [],
                lastCheck: new Date(),
                consecutiveFailures: 0,
            },
            registeredAt: new Date(),
            lastHeartbeat: new Date(),
        };
        this.services.set(service.id, service);
        EventBus_1.eventBus.emitSync('service_mesh.service_registered', service, 'ServiceRegistry');
        return service;
    }
    /**
     * Deregister service
     */
    deregister(serviceId) {
        const service = this.services.get(serviceId);
        if (service) {
            this.services.delete(serviceId);
            EventBus_1.eventBus.emitSync('service_mesh.service_deregistered', service, 'ServiceRegistry');
        }
    }
    /**
     * Update heartbeat
     */
    heartbeat(serviceId) {
        const service = this.services.get(serviceId);
        if (service) {
            service.lastHeartbeat = new Date();
        }
    }
    /**
     * Get service
     */
    getService(serviceId) {
        return this.services.get(serviceId);
    }
    /**
     * Find services by name
     */
    findByName(name) {
        return Array.from(this.services.values()).filter(s => s.name === name);
    }
    /**
     * Find services by tag
     */
    findByTag(tag) {
        return Array.from(this.services.values()).filter(s => s.tags.includes(tag));
    }
    /**
     * List all services
     */
    listServices(filter) {
        let services = Array.from(this.services.values());
        if (filter?.environment) {
            services = services.filter(s => s.metadata.environment === filter.environment);
        }
        if (filter?.type) {
            services = services.filter(s => s.type === filter.type);
        }
        return services;
    }
    generateServiceId() {
        return `service_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ServiceRegistry = ServiceRegistry;
/**
 * Health Check Manager
 */
class HealthCheckManager {
    registry;
    checkIntervals = new Map();
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * Add health check to service
     */
    addCheck(serviceId, check) {
        const service = this.registry.getService(serviceId);
        if (!service) {
            throw new Error(`Service not found: ${serviceId}`);
        }
        const fullCheck = {
            ...check,
            id: this.generateCheckId(),
            status: HealthState.Unknown,
            lastCheck: new Date(),
            duration: 0,
        };
        service.health.checks.push(fullCheck);
        // Start periodic checking
        this.scheduleCheck(service, fullCheck);
        return fullCheck;
    }
    /**
     * Execute health check
     */
    async executeCheck(serviceId, checkId) {
        const service = this.registry.getService(serviceId);
        if (!service) {
            throw new Error(`Service not found: ${serviceId}`);
        }
        const check = service.health.checks.find(c => c.id === checkId);
        if (!check) {
            throw new Error(`Health check not found: ${checkId}`);
        }
        const startTime = Date.now();
        try {
            // Mock health check execution
            await new Promise(resolve => setTimeout(resolve, 50));
            check.status = HealthState.Healthy;
            check.message = 'Check passed';
            check.lastCheck = new Date();
            check.duration = Date.now() - startTime;
            service.health.consecutiveFailures = 0;
        }
        catch (error) {
            check.status = HealthState.Unhealthy;
            check.message = error instanceof Error ? error.message : 'Check failed';
            check.lastCheck = new Date();
            check.duration = Date.now() - startTime;
            service.health.consecutiveFailures++;
        }
        // Update overall service health
        this.updateServiceHealth(service);
        return check;
    }
    /**
     * Remove health check
     */
    removeCheck(serviceId, checkId) {
        const service = this.registry.getService(serviceId);
        if (!service) {
            return;
        }
        const index = service.health.checks.findIndex(c => c.id === checkId);
        if (index !== -1) {
            service.health.checks.splice(index, 1);
        }
        // Clear interval
        const intervalKey = `${serviceId}:${checkId}`;
        const interval = this.checkIntervals.get(intervalKey);
        if (interval) {
            clearInterval(interval);
            this.checkIntervals.delete(intervalKey);
        }
    }
    scheduleCheck(service, check) {
        const intervalKey = `${service.id}:${check.id}`;
        const interval = setInterval(() => {
            this.executeCheck(service.id, check.id);
        }, check.config.interval);
        this.checkIntervals.set(intervalKey, interval);
    }
    updateServiceHealth(service) {
        if (service.health.checks.length === 0) {
            service.health.status = HealthState.Unknown;
            return;
        }
        const healthyCount = service.health.checks.filter(c => c.status === HealthState.Healthy).length;
        const unhealthyCount = service.health.checks.filter(c => c.status === HealthState.Unhealthy).length;
        if (unhealthyCount > 0) {
            service.health.status = HealthState.Unhealthy;
        }
        else if (healthyCount === service.health.checks.length) {
            service.health.status = HealthState.Healthy;
        }
        else {
            service.health.status = HealthState.Warning;
        }
        service.health.lastCheck = new Date();
        EventBus_1.eventBus.emitSync('service_mesh.health_updated', service, 'HealthCheckManager');
    }
    generateCheckId() {
        return `check_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.HealthCheckManager = HealthCheckManager;
/**
 * Load Balancer
 */
class LoadBalancerManager {
    balancers = new Map();
    instances = new Map();
    roundRobinCounters = new Map();
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * Create load balancer
     */
    createBalancer(config) {
        const balancer = {
            ...config,
            id: this.generateBalancerId(),
            createdAt: new Date(),
        };
        this.balancers.set(balancer.id, balancer);
        EventBus_1.eventBus.emitSync('service_mesh.balancer_created', balancer, 'LoadBalancerManager');
        return balancer;
    }
    /**
     * Select service instance
     */
    selectInstance(balancerId, requestContext) {
        const balancer = this.balancers.get(balancerId);
        if (!balancer || !balancer.enabled) {
            return null;
        }
        // Get healthy instances
        const instances = this.getHealthyInstances(balancer);
        if (instances.length === 0) {
            return null;
        }
        // Apply load balancing algorithm
        switch (balancer.algorithm) {
            case LoadBalancingAlgorithm.RoundRobin:
                return this.roundRobin(balancerId, instances);
            case LoadBalancingAlgorithm.WeightedRoundRobin:
                return this.weightedRoundRobin(instances);
            case LoadBalancingAlgorithm.LeastConnections:
                return this.leastConnections(instances);
            case LoadBalancingAlgorithm.Random:
                return this.random(instances);
            case LoadBalancingAlgorithm.LeastResponseTime:
                return this.leastResponseTime(instances);
            default:
                return instances[0];
        }
    }
    /**
     * Get balancer
     */
    getBalancer(balancerId) {
        return this.balancers.get(balancerId);
    }
    /**
     * List balancers
     */
    listBalancers() {
        return Array.from(this.balancers.values());
    }
    getHealthyInstances(balancer) {
        const instances = [];
        for (const serviceName of balancer.serviceNames) {
            const services = this.registry.findByName(serviceName);
            for (const service of services) {
                if (service.health.status === HealthState.Healthy) {
                    for (const endpoint of service.endpoints) {
                        instances.push({
                            service,
                            endpoint,
                            connections: 0,
                            totalRequests: 0,
                            failedRequests: 0,
                            averageResponseTime: 0,
                        });
                    }
                }
            }
        }
        return instances;
    }
    roundRobin(balancerId, instances) {
        const counter = this.roundRobinCounters.get(balancerId) || 0;
        const index = counter % instances.length;
        this.roundRobinCounters.set(balancerId, counter + 1);
        return instances[index];
    }
    weightedRoundRobin(instances) {
        const totalWeight = instances.reduce((sum, i) => sum + i.endpoint.weight, 0);
        let random = Math.random() * totalWeight;
        for (const instance of instances) {
            random -= instance.endpoint.weight;
            if (random <= 0) {
                return instance;
            }
        }
        return instances[0];
    }
    leastConnections(instances) {
        return instances.reduce((min, instance) => instance.connections < min.connections ? instance : min);
    }
    random(instances) {
        const index = Math.floor(Math.random() * instances.length);
        return instances[index];
    }
    leastResponseTime(instances) {
        return instances.reduce((min, instance) => instance.averageResponseTime < min.averageResponseTime ? instance : min);
    }
    generateBalancerId() {
        return `balancer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.LoadBalancerManager = LoadBalancerManager;
/**
 * Service Router
 */
class ServiceRouter {
    routes = new Map();
    /**
     * Create route
     */
    createRoute(config) {
        const route = {
            ...config,
            id: this.generateRouteId(),
            createdAt: new Date(),
        };
        this.routes.set(route.id, route);
        EventBus_1.eventBus.emitSync('service_mesh.route_created', route, 'ServiceRouter');
        return route;
    }
    /**
     * Match route
     */
    matchRoute(path, method, headers) {
        for (const route of this.routes.values()) {
            if (!route.enabled)
                continue;
            // Check path
            if (!this.matchPath(path, route.source.path))
                continue;
            // Check method
            if (!route.source.methods.includes(method))
                continue;
            // Check headers
            if (route.source.headers) {
                const headersMatch = Object.entries(route.source.headers).every(([key, value]) => headers[key] === value);
                if (!headersMatch)
                    continue;
            }
            return route;
        }
        return null;
    }
    /**
     * Get route
     */
    getRoute(routeId) {
        return this.routes.get(routeId);
    }
    /**
     * List routes
     */
    listRoutes() {
        return Array.from(this.routes.values());
    }
    matchPath(path, pattern) {
        // Simple pattern matching (can be extended with regex)
        if (pattern === path)
            return true;
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return path.startsWith(prefix);
        }
        return false;
    }
    generateRouteId() {
        return `route_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ServiceRouter = ServiceRouter;
/**
 * Traffic Manager
 */
class TrafficManager {
    splits = new Map();
    /**
     * Create traffic split
     */
    createSplit(config) {
        const split = {
            ...config,
            id: this.generateSplitId(),
            createdAt: new Date(),
        };
        this.splits.set(split.id, split);
        EventBus_1.eventBus.emitSync('service_mesh.traffic_split_created', split, 'TrafficManager');
        return split;
    }
    /**
     * Select version based on traffic split
     */
    selectVersion(serviceName) {
        const splits = Array.from(this.splits.values()).filter(s => s.serviceName === serviceName && s.enabled);
        if (splits.length === 0) {
            return null;
        }
        const split = splits[0];
        const totalWeight = split.splits.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;
        for (const s of split.splits) {
            random -= s.weight;
            if (random <= 0) {
                return s.version;
            }
        }
        return split.splits[0].version;
    }
    /**
     * Get split
     */
    getSplit(splitId) {
        return this.splits.get(splitId);
    }
    /**
     * List splits
     */
    listSplits(serviceName) {
        let splits = Array.from(this.splits.values());
        if (serviceName) {
            splits = splits.filter(s => s.serviceName === serviceName);
        }
        return splits;
    }
    generateSplitId() {
        return `split_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TrafficManager = TrafficManager;
/**
 * Singleton instances
 */
exports.serviceRegistry = new ServiceRegistry();
exports.healthCheckManager = new HealthCheckManager(exports.serviceRegistry);
exports.loadBalancerManager = new LoadBalancerManager(exports.serviceRegistry);
exports.serviceRouter = new ServiceRouter();
exports.trafficManager = new TrafficManager();
