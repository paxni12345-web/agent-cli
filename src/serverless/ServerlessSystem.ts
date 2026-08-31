/**
 * Serverless Function Management
 * Function deployment, invocation, scaling, and edge computing
 */

import { eventBus } from '../core/EventBus';

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

export enum Runtime {
  NodeJS18 = 'nodejs18',
  NodeJS20 = 'nodejs20',
  Python39 = 'python3.9',
  Python310 = 'python3.10',
  Python311 = 'python3.11',
  Go121 = 'go1.21',
  Java17 = 'java17',
  DotNet7 = 'dotnet7',
  Ruby32 = 'ruby3.2',
}

export interface FunctionCode {
  type: CodeType;
  source: string;
  dependencies?: string[];
  size: number;
}

export enum CodeType {
  Inline = 'inline',
  ZipFile = 'zip_file',
  S3 = 's3',
  Git = 'git',
  Container = 'container',
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

export enum TriggerType {
  HTTP = 'http',
  Schedule = 'schedule',
  Queue = 'queue',
  Stream = 'stream',
  S3 = 's3',
  EventBridge = 'eventbridge',
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

export enum FunctionStatus {
  Active = 'active',
  Inactive = 'inactive',
  Deploying = 'deploying',
  Failed = 'failed',
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

export enum InvocationStatus {
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Timeout = 'timeout',
  Throttled = 'throttled',
}

export interface EdgeLocation {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  status: LocationStatus;
}

export enum LocationStatus {
  Active = 'active',
  Maintenance = 'maintenance',
  Offline = 'offline',
}

export interface EdgeFunction extends ServerlessFunction {
  locations: string[];
  replicationStatus: Record<string, ReplicationStatus>;
}

export enum ReplicationStatus {
  Synced = 'synced',
  Syncing = 'syncing',
  Failed = 'failed',
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
export class ServerlessFunctionManager {
  private functions: Map<string, ServerlessFunction> = new Map();
  private invocations: Map<string, FunctionInvocation> = new Map();
  private layers: Map<string, Layer> = new Map();
  private executors: Map<Runtime, FunctionExecutor> = new Map();

  /**
   * Create function
   */
  createFunction(fn: Omit<ServerlessFunction, 'id' | 'status' | 'metrics' | 'createdAt' | 'updatedAt'>): ServerlessFunction {
    const fullFunction: ServerlessFunction = {
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

    eventBus.emitSync('function.created', fullFunction, 'ServerlessFunctionManager');

    return fullFunction;
  }

  /**
   * Deploy function
   */
  async deployFunction(functionId: string): Promise<void> {
    const fn = this.functions.get(functionId);

    if (!fn) {
      throw new Error(`Function not found: ${functionId}`);
    }

    fn.status = FunctionStatus.Deploying;

    eventBus.emitSync('function.deploying', fn, 'ServerlessFunctionManager');

    try {
      // Mock deployment
      await new Promise(resolve => setTimeout(resolve, 1000));

      fn.status = FunctionStatus.Active;
      fn.lastDeployedAt = new Date();

      eventBus.emitSync('function.deployed', fn, 'ServerlessFunctionManager');
    } catch (error) {
      fn.status = FunctionStatus.Failed;
      eventBus.emitSync('function.deployment_failed', { fn, error }, 'ServerlessFunctionManager');
      throw error;
    }
  }

  /**
   * Invoke function
   */
  async invokeFunction(
    functionId: string,
    event: any,
    context?: Partial<InvocationContext>
  ): Promise<FunctionInvocation> {
    const fn = this.functions.get(functionId);

    if (!fn) {
      throw new Error(`Function not found: ${functionId}`);
    }

    if (fn.status !== FunctionStatus.Active) {
      throw new Error(`Function is not active: ${fn.status}`);
    }

    // Check concurrency
    if (fn.metrics.concurrentExecutions >= fn.config.concurrency) {
      const throttled: FunctionInvocation = {
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

    const invocation: FunctionInvocation = {
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

    eventBus.emitSync('function.invocation_started', invocation, 'ServerlessFunctionManager');

    // Execute function
    this.executeFunction(fn, invocation);

    return invocation;
  }

  /**
   * Get function
   */
  getFunction(functionId: string): ServerlessFunction | undefined {
    return this.functions.get(functionId);
  }

  /**
   * List functions
   */
  listFunctions(filter?: { status?: FunctionStatus; runtime?: Runtime }): ServerlessFunction[] {
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
  getInvocation(invocationId: string): FunctionInvocation | undefined {
    return this.invocations.get(invocationId);
  }

  /**
   * List invocations
   */
  listInvocations(functionId?: string, limit: number = 100): FunctionInvocation[] {
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
  deleteFunction(functionId: string): void {
    this.functions.delete(functionId);
    eventBus.emitSync('function.deleted', { functionId }, 'ServerlessFunctionManager');
  }

  /**
   * Create layer
   */
  createLayer(layer: Omit<Layer, 'id' | 'createdAt'>): Layer {
    const fullLayer: Layer = {
      ...layer,
      id: this.generateLayerId(),
      createdAt: new Date(),
    };

    this.layers.set(fullLayer.id, fullLayer);

    eventBus.emitSync('layer.created', fullLayer, 'ServerlessFunctionManager');

    return fullLayer;
  }

  /**
   * Get layer
   */
  getLayer(layerId: string): Layer | undefined {
    return this.layers.get(layerId);
  }

  private async executeFunction(fn: ServerlessFunction, invocation: FunctionInvocation): Promise<void> {
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
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Function timeout')), fn.config.timeout)
        ),
      ]);

      invocation.result = result;
      invocation.status = InvocationStatus.Success;
      invocation.completedAt = new Date();
      invocation.duration = Date.now() - startTime;
      invocation.memory = Math.floor(Math.random() * fn.config.memory);

      fn.metrics.invocations++;
      fn.metrics.duration = (fn.metrics.duration * (fn.metrics.invocations - 1) + invocation.duration) / fn.metrics.invocations;

      eventBus.emitSync('function.invocation_completed', invocation, 'ServerlessFunctionManager');
    } catch (error) {
      invocation.error = error instanceof Error ? error.message : String(error);
      invocation.status = InvocationStatus.Failed;
      invocation.completedAt = new Date();
      invocation.duration = Date.now() - startTime;

      fn.metrics.errors++;

      eventBus.emitSync('function.invocation_failed', invocation, 'ServerlessFunctionManager');
    } finally {
      fn.metrics.concurrentExecutions--;
    }
  }

  private buildContext(partial?: Partial<InvocationContext>): InvocationContext {
    return {
      requestId: this.generateRequestId(),
      metadata: {},
      ...partial,
    };
  }

  private hasWarmInstance(functionId: string): boolean {
    // Mock warm instance check
    return Math.random() > 0.3;
  }

  private generateFunctionId(): string {
    return `fn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateInvocationId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateLayerId(): string {
    return `layer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

export interface FunctionExecutor {
  execute(fn: ServerlessFunction, event: any, context: InvocationContext): Promise<any>;
}

/**
 * Edge Computing Manager
 */
export class EdgeComputingManager {
  private locations: Map<string, EdgeLocation> = new Map();
  private edgeFunctions: Map<string, EdgeFunction> = new Map();

  /**
   * Register edge location
   */
  registerLocation(location: Omit<EdgeLocation, 'id'>): EdgeLocation {
    const fullLocation: EdgeLocation = {
      ...location,
      id: this.generateLocationId(),
    };

    this.locations.set(fullLocation.id, fullLocation);

    eventBus.emitSync('edge.location_registered', fullLocation, 'EdgeComputingManager');

    return fullLocation;
  }

  /**
   * Deploy edge function
   */
  async deployEdgeFunction(
    fn: ServerlessFunction,
    locationIds: string[]
  ): Promise<EdgeFunction> {
    const edgeFunction: EdgeFunction = {
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
  findNearestLocation(latitude: number, longitude: number): EdgeLocation | null {
    let nearest: EdgeLocation | null = null;
    let minDistance = Infinity;

    for (const location of this.locations.values()) {
      if (location.status !== LocationStatus.Active) {
        continue;
      }

      const distance = this.calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude
      );

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
  getEdgeFunction(functionId: string): EdgeFunction | undefined {
    return this.edgeFunctions.get(functionId);
  }

  /**
   * List locations
   */
  listLocations(filter?: { status?: LocationStatus }): EdgeLocation[] {
    let locations = Array.from(this.locations.values());

    if (filter?.status) {
      locations = locations.filter(l => l.status === filter.status);
    }

    return locations;
  }

  private async replicateToLocations(fn: EdgeFunction, locationIds: string[]): Promise<void> {
    for (const locationId of locationIds) {
      try {
        // Mock replication
        await new Promise(resolve => setTimeout(resolve, 500));

        fn.replicationStatus[locationId] = ReplicationStatus.Synced;

        eventBus.emitSync('edge.replicated', { functionId: fn.id, locationId }, 'EdgeComputingManager');
      } catch (error) {
        fn.replicationStatus[locationId] = ReplicationStatus.Failed;

        eventBus.emitSync('edge.replication_failed', {
          functionId: fn.id,
          locationId,
          error,
        }, 'EdgeComputingManager');
      }
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private generateLocationId(): string {
    return `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Function Scaler
 */
export class FunctionScaler {
  private scalingPolicies: Map<string, ScalingPolicy> = new Map();

  /**
   * Set scaling policy
   */
  setScalingPolicy(functionId: string, policy: ScalingPolicy): void {
    this.scalingPolicies.set(functionId, policy);
  }

  /**
   * Get scaling recommendation
   */
  getScalingRecommendation(
    functionId: string,
    metrics: FunctionMetrics
  ): ScalingRecommendation {
    const policy = this.scalingPolicies.get(functionId);

    if (!policy) {
      return { action: ScalingAction.NoAction };
    }

    // Check metrics against policy
    if (metrics.concurrentExecutions > policy.targetConcurrency * 1.5) {
      return {
        action: ScalingAction.ScaleUp,
        targetConcurrency: Math.min(
          metrics.concurrentExecutions * 2,
          policy.maxConcurrency
        ),
      };
    }

    if (metrics.concurrentExecutions < policy.targetConcurrency * 0.3) {
      return {
        action: ScalingAction.ScaleDown,
        targetConcurrency: Math.max(
          metrics.concurrentExecutions / 2,
          policy.minConcurrency
        ),
      };
    }

    return { action: ScalingAction.NoAction };
  }
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

export enum ScalingAction {
  NoAction = 'no_action',
  ScaleUp = 'scale_up',
  ScaleDown = 'scale_down',
}

/**
 * Singleton instances
 */
export const serverlessFunctionManager = new ServerlessFunctionManager();
export const edgeComputingManager = new EdgeComputingManager();
export const functionScaler = new FunctionScaler();
