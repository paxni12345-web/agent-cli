"use strict";
/**
 * Serverless Function Management
 * Function deployment, invocation, scaling, and edge computing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.functionScaler = exports.edgeComputingManager = exports.serverlessFunctionManager = exports.ScalingAction = exports.FunctionScaler = exports.EdgeComputingManager = exports.ServerlessFunctionManager = exports.ReplicationStatus = exports.LocationStatus = exports.InvocationStatus = exports.FunctionStatus = exports.TriggerType = exports.CodeType = exports.Runtime = void 0;
const EventBus_1 = require("../core/EventBus");
var Runtime;
(function (Runtime) {
    Runtime["NodeJS18"] = "nodejs18";
    Runtime["NodeJS20"] = "nodejs20";
    Runtime["Python39"] = "python3.9";
    Runtime["Python310"] = "python3.10";
    Runtime["Python311"] = "python3.11";
    Runtime["Go121"] = "go1.21";
    Runtime["Java17"] = "java17";
    Runtime["DotNet7"] = "dotnet7";
    Runtime["Ruby32"] = "ruby3.2";
})(Runtime || (exports.Runtime = Runtime = {}));
var CodeType;
(function (CodeType) {
    CodeType["Inline"] = "inline";
    CodeType["ZipFile"] = "zip_file";
    CodeType["S3"] = "s3";
    CodeType["Git"] = "git";
    CodeType["Container"] = "container";
})(CodeType || (exports.CodeType = CodeType = {}));
var TriggerType;
(function (TriggerType) {
    TriggerType["HTTP"] = "http";
    TriggerType["Schedule"] = "schedule";
    TriggerType["Queue"] = "queue";
    TriggerType["Stream"] = "stream";
    TriggerType["S3"] = "s3";
    TriggerType["EventBridge"] = "eventbridge";
})(TriggerType || (exports.TriggerType = TriggerType = {}));
var FunctionStatus;
(function (FunctionStatus) {
    FunctionStatus["Active"] = "active";
    FunctionStatus["Inactive"] = "inactive";
    FunctionStatus["Deploying"] = "deploying";
    FunctionStatus["Failed"] = "failed";
})(FunctionStatus || (exports.FunctionStatus = FunctionStatus = {}));
var InvocationStatus;
(function (InvocationStatus) {
    InvocationStatus["Running"] = "running";
    InvocationStatus["Success"] = "success";
    InvocationStatus["Failed"] = "failed";
    InvocationStatus["Timeout"] = "timeout";
    InvocationStatus["Throttled"] = "throttled";
})(InvocationStatus || (exports.InvocationStatus = InvocationStatus = {}));
var LocationStatus;
(function (LocationStatus) {
    LocationStatus["Active"] = "active";
    LocationStatus["Maintenance"] = "maintenance";
    LocationStatus["Offline"] = "offline";
})(LocationStatus || (exports.LocationStatus = LocationStatus = {}));
var ReplicationStatus;
(function (ReplicationStatus) {
    ReplicationStatus["Synced"] = "synced";
    ReplicationStatus["Syncing"] = "syncing";
    ReplicationStatus["Failed"] = "failed";
})(ReplicationStatus || (exports.ReplicationStatus = ReplicationStatus = {}));
/**
 * Serverless Function Manager
 */
class ServerlessFunctionManager {
    functions = new Map();
    invocations = new Map();
    layers = new Map();
    executors = new Map();
    /**
     * Create function
     */
    createFunction(fn) {
        const fullFunction = {
            ...fn,
            id: this.generateFunctionId(),
            status: FunctionStatus.Inactive,
            metrics: {
                invocations: 0,
                errors: 0,
                throttles: 0,
                duration: 0,
                concurrentExecutions: 0,
                coldStarts: 0,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.functions.set(fullFunction.id, fullFunction);
        EventBus_1.eventBus.emitSync('function.created', fullFunction, 'ServerlessFunctionManager');
        return fullFunction;
    }
    /**
     * Deploy function
     */
    async deployFunction(functionId) {
        const fn = this.functions.get(functionId);
        if (!fn) {
            throw new Error(`Function not found: ${functionId}`);
        }
        fn.status = FunctionStatus.Deploying;
        EventBus_1.eventBus.emitSync('function.deploying', fn, 'ServerlessFunctionManager');
        try {
            // Mock deployment
            await new Promise(resolve => setTimeout(resolve, 1000));
            fn.status = FunctionStatus.Active;
            fn.lastDeployedAt = new Date();
            EventBus_1.eventBus.emitSync('function.deployed', fn, 'ServerlessFunctionManager');
        }
        catch (error) {
            fn.status = FunctionStatus.Failed;
            EventBus_1.eventBus.emitSync('function.deployment_failed', { fn, error }, 'ServerlessFunctionManager');
            throw error;
        }
    }
    /**
     * Invoke function
     */
    async invokeFunction(functionId, event, context) {
        const fn = this.functions.get(functionId);
        if (!fn) {
            throw new Error(`Function not found: ${functionId}`);
        }
        if (fn.status !== FunctionStatus.Active) {
            throw new Error(`Function is not active: ${fn.status}`);
        }
        // Check concurrency
        if (fn.metrics.concurrentExecutions >= fn.config.concurrency) {
            const throttled = {
                id: this.generateInvocationId(),
                functionId,
                event,
                context: this.buildContext(context),
                duration: 0,
                memory: 0,
                coldStart: false,
                status: InvocationStatus.Throttled,
                startedAt: new Date(),
                completedAt: new Date(),
            };
            fn.metrics.throttles++;
            return throttled;
        }
        const invocation = {
            id: this.generateInvocationId(),
            functionId,
            event,
            context: this.buildContext(context),
            duration: 0,
            memory: 0,
            coldStart: !this.hasWarmInstance(functionId),
            status: InvocationStatus.Running,
            startedAt: new Date(),
        };
        this.invocations.set(invocation.id, invocation);
        fn.metrics.concurrentExecutions++;
        if (invocation.coldStart) {
            fn.metrics.coldStarts++;
        }
        EventBus_1.eventBus.emitSync('function.invocation_started', invocation, 'ServerlessFunctionManager');
        // Execute function
        this.executeFunction(fn, invocation);
        return invocation;
    }
    /**
     * Get function
     */
    getFunction(functionId) {
        return this.functions.get(functionId);
    }
    /**
     * List functions
     */
    listFunctions(filter) {
        let functions = Array.from(this.functions.values());
        if (filter?.status) {
            functions = functions.filter(f => f.status === filter.status);
        }
        if (filter?.runtime) {
            functions = functions.filter(f => f.runtime === filter.runtime);
        }
        return functions;
    }
    /**
     * Get invocation
     */
    getInvocation(invocationId) {
        return this.invocations.get(invocationId);
    }
    /**
     * List invocations
     */
    listInvocations(functionId, limit = 100) {
        let invocations = Array.from(this.invocations.values());
        if (functionId) {
            invocations = invocations.filter(i => i.functionId === functionId);
        }
        return invocations
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
            .slice(0, limit);
    }
    /**
     * Delete function
     */
    deleteFunction(functionId) {
        this.functions.delete(functionId);
        EventBus_1.eventBus.emitSync('function.deleted', { functionId }, 'ServerlessFunctionManager');
    }
    /**
     * Create layer
     */
    createLayer(layer) {
        const fullLayer = {
            ...layer,
            id: this.generateLayerId(),
            createdAt: new Date(),
        };
        this.layers.set(fullLayer.id, fullLayer);
        EventBus_1.eventBus.emitSync('layer.created', fullLayer, 'ServerlessFunctionManager');
        return fullLayer;
    }
    /**
     * Get layer
     */
    getLayer(layerId) {
        return this.layers.get(layerId);
    }
    async executeFunction(fn, invocation) {
        const startTime = Date.now();
        try {
            // Get executor
            const executor = this.executors.get(fn.runtime);
            if (!executor) {
                throw new Error(`No executor found for runtime: ${fn.runtime}`);
            }
            // Execute with timeout
            const result = await Promise.race([
                executor.execute(fn, invocation.event, invocation.context),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Function timeout')), fn.config.timeout)),
            ]);
            invocation.result = result;
            invocation.status = InvocationStatus.Success;
            invocation.completedAt = new Date();
            invocation.duration = Date.now() - startTime;
            invocation.memory = Math.floor(Math.random() * fn.config.memory);
            fn.metrics.invocations++;
            fn.metrics.duration = (fn.metrics.duration * (fn.metrics.invocations - 1) + invocation.duration) / fn.metrics.invocations;
            EventBus_1.eventBus.emitSync('function.invocation_completed', invocation, 'ServerlessFunctionManager');
        }
        catch (error) {
            invocation.error = error instanceof Error ? error.message : String(error);
            invocation.status = InvocationStatus.Failed;
            invocation.completedAt = new Date();
            invocation.duration = Date.now() - startTime;
            fn.metrics.errors++;
            EventBus_1.eventBus.emitSync('function.invocation_failed', invocation, 'ServerlessFunctionManager');
        }
        finally {
            fn.metrics.concurrentExecutions--;
        }
    }
    buildContext(partial) {
        return {
            requestId: this.generateRequestId(),
            metadata: {},
            ...partial,
        };
    }
    hasWarmInstance(functionId) {
        // Mock warm instance check
        return Math.random() > 0.3;
    }
    generateFunctionId() {
        return `fn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateInvocationId() {
        return `inv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateLayerId() {
        return `layer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ServerlessFunctionManager = ServerlessFunctionManager;
/**
 * Edge Computing Manager
 */
class EdgeComputingManager {
    locations = new Map();
    edgeFunctions = new Map();
    /**
     * Register edge location
     */
    registerLocation(location) {
        const fullLocation = {
            ...location,
            id: this.generateLocationId(),
        };
        this.locations.set(fullLocation.id, fullLocation);
        EventBus_1.eventBus.emitSync('edge.location_registered', fullLocation, 'EdgeComputingManager');
        return fullLocation;
    }
    /**
     * Deploy edge function
     */
    async deployEdgeFunction(fn, locationIds) {
        const edgeFunction = {
            ...fn,
            locations: locationIds,
            replicationStatus: {},
        };
        // Initialize replication status
        for (const locationId of locationIds) {
            edgeFunction.replicationStatus[locationId] = ReplicationStatus.Syncing;
        }
        this.edgeFunctions.set(edgeFunction.id, edgeFunction);
        // Replicate to locations
        this.replicateToLocations(edgeFunction, locationIds);
        return edgeFunction;
    }
    /**
     * Find nearest location
     */
    findNearestLocation(latitude, longitude) {
        let nearest = null;
        let minDistance = Infinity;
        for (const location of this.locations.values()) {
            if (location.status !== LocationStatus.Active) {
                continue;
            }
            const distance = this.calculateDistance(latitude, longitude, location.latitude, location.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = location;
            }
        }
        return nearest;
    }
    /**
     * Get edge function
     */
    getEdgeFunction(functionId) {
        return this.edgeFunctions.get(functionId);
    }
    /**
     * List locations
     */
    listLocations(filter) {
        let locations = Array.from(this.locations.values());
        if (filter?.status) {
            locations = locations.filter(l => l.status === filter.status);
        }
        return locations;
    }
    async replicateToLocations(fn, locationIds) {
        for (const locationId of locationIds) {
            try {
                // Mock replication
                await new Promise(resolve => setTimeout(resolve, 500));
                fn.replicationStatus[locationId] = ReplicationStatus.Synced;
                EventBus_1.eventBus.emitSync('edge.replicated', { functionId: fn.id, locationId }, 'EdgeComputingManager');
            }
            catch (error) {
                fn.replicationStatus[locationId] = ReplicationStatus.Failed;
                EventBus_1.eventBus.emitSync('edge.replication_failed', {
                    functionId: fn.id,
                    locationId,
                    error,
                }, 'EdgeComputingManager');
            }
        }
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) *
                Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRadians(degrees) {
        return (degrees * Math.PI) / 180;
    }
    generateLocationId() {
        return `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.EdgeComputingManager = EdgeComputingManager;
/**
 * Function Scaler
 */
class FunctionScaler {
    scalingPolicies = new Map();
    /**
     * Set scaling policy
     */
    setScalingPolicy(functionId, policy) {
        this.scalingPolicies.set(functionId, policy);
    }
    /**
     * Get scaling recommendation
     */
    getScalingRecommendation(functionId, metrics) {
        const policy = this.scalingPolicies.get(functionId);
        if (!policy) {
            return { action: ScalingAction.NoAction };
        }
        // Check metrics against policy
        if (metrics.concurrentExecutions > policy.targetConcurrency * 1.5) {
            return {
                action: ScalingAction.ScaleUp,
                targetConcurrency: Math.min(metrics.concurrentExecutions * 2, policy.maxConcurrency),
            };
        }
        if (metrics.concurrentExecutions < policy.targetConcurrency * 0.3) {
            return {
                action: ScalingAction.ScaleDown,
                targetConcurrency: Math.max(metrics.concurrentExecutions / 2, policy.minConcurrency),
            };
        }
        return { action: ScalingAction.NoAction };
    }
}
exports.FunctionScaler = FunctionScaler;
var ScalingAction;
(function (ScalingAction) {
    ScalingAction["NoAction"] = "no_action";
    ScalingAction["ScaleUp"] = "scale_up";
    ScalingAction["ScaleDown"] = "scale_down";
})(ScalingAction || (exports.ScalingAction = ScalingAction = {}));
/**
 * Singleton instances
 */
exports.serverlessFunctionManager = new ServerlessFunctionManager();
exports.edgeComputingManager = new EdgeComputingManager();
exports.functionScaler = new FunctionScaler();
