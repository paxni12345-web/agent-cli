/**
 * Serverless Function Management
 * Function deployment, invocation, scaling, and edge computing
 */
export interface ServerlessFunction {
    id: string;
    name: string;
    runtime: Runtime;
    handler: string;
    code: FunctionCode;
    config: FunctionConfig;
    environment: Record<string, string>;
    triggers: Trigger[];
    status: FunctionStatus;
    metrics: FunctionMetrics;
    createdAt: Date;
    updatedAt: Date;
    lastDeployedAt?: Date;
}
export declare enum Runtime {
    NodeJS18 = "nodejs18",
    NodeJS20 = "nodejs20",
    Python39 = "python3.9",
    Python310 = "python3.10",
    Python311 = "python3.11",
    Go121 = "go1.21",
    Java17 = "java17",
    DotNet7 = "dotnet7",
    Ruby32 = "ruby3.2"
}
export interface FunctionCode {
    type: CodeType;
    source: string;
    dependencies?: string[];
    size: number;
}
export declare enum CodeType {
    Inline = "inline",
    ZipFile = "zip_file",
    S3 = "s3",
    Git = "git",
    Container = "container"
}
export interface FunctionConfig {
    memory: number;
    timeout: number;
    concurrency: number;
    retries: number;
    layers?: string[];
    vpc?: VPCConfig;
}
export interface VPCConfig {
    subnetIds: string[];
    securityGroupIds: string[];
}
export interface Trigger {
    id: string;
    type: TriggerType;
    config: TriggerConfig;
    enabled: boolean;
}
export declare enum TriggerType {
    HTTP = "http",
    Schedule = "schedule",
    Queue = "queue",
    Stream = "stream",
    S3 = "s3",
    EventBridge = "eventbridge"
}
export type TriggerConfig = HTTPTriggerConfig | ScheduleTriggerConfig | QueueTriggerConfig;
export interface HTTPTriggerConfig {
    path: string;
    method: string;
    cors?: boolean;
    authentication?: string;
}
export interface ScheduleTriggerConfig {
    schedule: string;
    timezone?: string;
}
export interface QueueTriggerConfig {
    queueName: string;
    batchSize: number;
}
export declare enum FunctionStatus {
    Active = "active",
    Inactive = "inactive",
    Deploying = "deploying",
    Failed = "failed"
}
export interface FunctionMetrics {
    invocations: number;
    errors: number;
    throttles: number;
    duration: number;
    concurrentExecutions: number;
    coldStarts: number;
}
export interface FunctionInvocation {
    id: string;
    functionId: string;
    event: any;
    context: InvocationContext;
    result?: any;
    error?: string;
    duration: number;
    memory: number;
    coldStart: boolean;
    status: InvocationStatus;
    startedAt: Date;
    completedAt?: Date;
}
export interface InvocationContext {
    requestId: string;
    traceId?: string;
    userId?: string;
    metadata: Record<string, any>;
}
export declare enum InvocationStatus {
    Running = "running",
    Success = "success",
    Failed = "failed",
    Timeout = "timeout",
    Throttled = "throttled"
}
export interface EdgeLocation {
    id: string;
    name: string;
    region: string;
    latitude: number;
    longitude: number;
    status: LocationStatus;
}
export declare enum LocationStatus {
    Active = "active",
    Maintenance = "maintenance",
    Offline = "offline"
}
export interface EdgeFunction extends ServerlessFunction {
    locations: string[];
    replicationStatus: Record<string, ReplicationStatus>;
}
export declare enum ReplicationStatus {
    Synced = "synced",
    Syncing = "syncing",
    Failed = "failed"
}
export interface Layer {
    id: string;
    name: string;
    version: string;
    runtime: Runtime;
    content: LayerContent;
    size: number;
    createdAt: Date;
}
export interface LayerContent {
    type: 'zip' | 's3';
    location: string;
}
/**
 * Serverless Function Manager
 */
export declare class ServerlessFunctionManager {
    private functions;
    private invocations;
    private layers;
    private executors;
    /**
     * Create function
     */
    createFunction(fn: Omit<ServerlessFunction, 'id' | 'status' | 'metrics' | 'createdAt' | 'updatedAt'>): ServerlessFunction;
    /**
     * Deploy function
     */
    deployFunction(functionId: string): Promise<void>;
    /**
     * Invoke function
     */
    invokeFunction(functionId: string, event: any, context?: Partial<InvocationContext>): Promise<FunctionInvocation>;
    /**
     * Get function
     */
    getFunction(functionId: string): ServerlessFunction | undefined;
    /**
     * List functions
     */
    listFunctions(filter?: {
        status?: FunctionStatus;
        runtime?: Runtime;
    }): ServerlessFunction[];
    /**
     * Get invocation
     */
    getInvocation(invocationId: string): FunctionInvocation | undefined;
    /**
     * List invocations
     */
    listInvocations(functionId?: string, limit?: number): FunctionInvocation[];
    /**
     * Delete function
     */
    deleteFunction(functionId: string): void;
    /**
     * Create layer
     */
    createLayer(layer: Omit<Layer, 'id' | 'createdAt'>): Layer;
    /**
     * Get layer
     */
    getLayer(layerId: string): Layer | undefined;
    private executeFunction;
    private buildContext;
    private hasWarmInstance;
    private generateFunctionId;
    private generateInvocationId;
    private generateLayerId;
    private generateRequestId;
}
export interface FunctionExecutor {
    execute(fn: ServerlessFunction, event: any, context: InvocationContext): Promise<any>;
}
/**
 * Edge Computing Manager
 */
export declare class EdgeComputingManager {
    private locations;
    private edgeFunctions;
    /**
     * Register edge location
     */
    registerLocation(location: Omit<EdgeLocation, 'id'>): EdgeLocation;
    /**
     * Deploy edge function
     */
    deployEdgeFunction(fn: ServerlessFunction, locationIds: string[]): Promise<EdgeFunction>;
    /**
     * Find nearest location
     */
    findNearestLocation(latitude: number, longitude: number): EdgeLocation | null;
    /**
     * Get edge function
     */
    getEdgeFunction(functionId: string): EdgeFunction | undefined;
    /**
     * List locations
     */
    listLocations(filter?: {
        status?: LocationStatus;
    }): EdgeLocation[];
    private replicateToLocations;
    private calculateDistance;
    private toRadians;
    private generateLocationId;
}
/**
 * Function Scaler
 */
export declare class FunctionScaler {
    private scalingPolicies;
    /**
     * Set scaling policy
     */
    setScalingPolicy(functionId: string, policy: ScalingPolicy): void;
    /**
     * Get scaling recommendation
     */
    getScalingRecommendation(functionId: string, metrics: FunctionMetrics): ScalingRecommendation;
}
export interface ScalingPolicy {
    minConcurrency: number;
    maxConcurrency: number;
    targetConcurrency: number;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
}
export interface ScalingRecommendation {
    action: ScalingAction;
    targetConcurrency?: number;
}
export declare enum ScalingAction {
    NoAction = "no_action",
    ScaleUp = "scale_up",
    ScaleDown = "scale_down"
}
/**
 * Singleton instances
 */
export declare const serverlessFunctionManager: ServerlessFunctionManager;
export declare const edgeComputingManager: EdgeComputingManager;
export declare const functionScaler: FunctionScaler;
//# sourceMappingURL=ServerlessSystem.d.ts.map