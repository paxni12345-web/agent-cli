/**
 * MEGA PHASE 22: CI/CD PIPELINE & DEPLOYMENT AUTOMATION
 * Complete CI/CD, GitOps, Blue-Green, Canary, Rollback automation
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface PipelineConfig {
    name: string;
    triggers: PipelineTrigger[];
    stages: Stage[];
    environment: Record<string, string>;
    timeout: number;
    retryPolicy: PipelineRetryPolicy;
    notifications: NotificationConfig[];
}
export interface PipelineTrigger {
    type: TriggerType;
    branch?: string;
    tag?: string;
    schedule?: string;
    webhook?: string;
}
export type TriggerType = 'push' | 'pull_request' | 'tag' | 'schedule' | 'manual' | 'webhook';
export interface Stage {
    name: string;
    jobs: Job[];
    condition?: StageCondition;
    parallel: boolean;
}
export interface StageCondition {
    branch?: string;
    status?: string[];
    manual?: boolean;
}
export interface Job {
    name: string;
    steps: Step[];
    environment: Record<string, string>;
    timeout: number;
    retries: number;
    continueOnError: boolean;
}
export interface Step {
    name: string;
    type: StepType;
    command?: string;
    script?: string;
    uses?: string;
    with?: Record<string, any>;
}
export type StepType = 'run' | 'checkout' | 'build' | 'test' | 'deploy' | 'action';
export interface PipelineRetryPolicy {
    maxAttempts: number;
    backoffMultiplier: number;
    maxBackoff: number;
}
export interface NotificationConfig {
    type: NotificationType;
    events: PipelineEvent[];
    recipients: string[];
}
export type NotificationType = 'email' | 'slack' | 'webhook' | 'sms';
export type PipelineEvent = 'started' | 'succeeded' | 'failed' | 'cancelled';
export interface PipelineRun {
    id: string;
    pipelineId: string;
    number: number;
    status: RunStatus;
    trigger: PipelineTrigger;
    stages: StageRun[];
    startedAt: Date;
    finishedAt?: Date;
    duration?: number;
    commit?: CommitInfo;
}
export type RunStatus = 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
export interface StageRun {
    name: string;
    status: RunStatus;
    jobs: JobRun[];
    startedAt?: Date;
    finishedAt?: Date;
    duration?: number;
}
export interface JobRun {
    name: string;
    status: RunStatus;
    steps: StepRun[];
    startedAt?: Date;
    finishedAt?: Date;
    duration?: number;
    logs: string[];
}
export interface StepRun {
    name: string;
    status: RunStatus;
    output?: string;
    error?: string;
    startedAt?: Date;
    finishedAt?: Date;
    duration?: number;
}
export interface CommitInfo {
    sha: string;
    message: string;
    author: string;
    timestamp: Date;
}
export declare class CICDPipeline extends EventEmitter {
    private config;
    private runs;
    private runNumber;
    constructor(config: PipelineConfig);
    trigger(trigger: PipelineTrigger, commit?: CommitInfo): Promise<PipelineRun>;
    private execute;
    private evaluateCondition;
    private executeStage;
    private executeJob;
    private executeStep;
    private runStep;
    private sendNotifications;
    private sendNotification;
    private sleep;
    private generateId;
    getRun(runId: string): PipelineRun | undefined;
    getStats(): {
        runs: number;
        successful: number;
        failed: number;
    };
}
export interface DeploymentConfig {
    strategy: DeploymentStrategy;
    environment: string;
    replicas: number;
    healthCheck: HealthCheckConfig;
    rollback: RollbackConfig;
}
export type DeploymentStrategy = 'rolling' | 'blue_green' | 'canary' | 'recreate';
export interface HealthCheckConfig {
    path: string;
    interval: number;
    timeout: number;
    healthyThreshold: number;
    unhealthyThreshold: number;
}
export interface RollbackConfig {
    autoRollback: boolean;
    threshold: number;
    window: number;
}
export interface Deployment {
    id: string;
    version: string;
    strategy: DeploymentStrategy;
    status: DeploymentStatus;
    replicas: DeploymentReplica[];
    startedAt: Date;
    finishedAt?: Date;
    rollback?: RollbackInfo;
}
export type DeploymentStatus = 'pending' | 'deploying' | 'healthy' | 'unhealthy' | 'rolled_back';
export interface DeploymentReplica {
    id: string;
    version: string;
    status: ReplicaStatus;
    health: HealthStatus;
    traffic: number;
}
export type ReplicaStatus = 'creating' | 'running' | 'stopping' | 'stopped';
export interface HealthStatus {
    checks: number;
    successes: number;
    failures: number;
    healthy: boolean;
}
export interface RollbackInfo {
    reason: string;
    triggeredAt: Date;
    completedAt?: Date;
    previousVersion: string;
}
export declare class DeploymentManager extends EventEmitter {
    private config;
    private deployments;
    private activeDeployment?;
    constructor(config: DeploymentConfig);
    deploy(version: string): Promise<Deployment>;
    private executeDeployment;
    private rollingDeployment;
    private blueGreenDeployment;
    private canaryDeployment;
    private recreateDeployment;
    private createReplica;
    private stopReplica;
    private waitForHealth;
    private checkHealth;
    private rollback;
    private sleep;
    private generateId;
    getStats(): {
        deployments: number;
        activeReplicas: number;
        healthyReplicas: number;
    };
}
export declare class CompleteCICDSystem {
    pipeline: CICDPipeline;
    deployment: DeploymentManager;
    constructor(pipelineConfig: PipelineConfig, deploymentConfig: DeploymentConfig);
    getOverallStats(): {
        pipeline: {
            runs: number;
            successful: number;
            failed: number;
        };
        deployment: {
            deployments: number;
            activeReplicas: number;
            healthyReplicas: number;
        };
    };
}
//# sourceMappingURL=MEGA_CICDPipeline.d.ts.map