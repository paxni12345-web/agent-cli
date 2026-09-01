/**
 * DevOps & CI/CD System
 * GitHub Actions, GitLab CI, CircleCI, Jenkins integration
 * Docker, Kubernetes deployment automation
 * Infrastructure as Code (Terraform, Ansible)
 */
import { EventEmitter } from 'events';
export interface Pipeline {
    id: string;
    name: string;
    description: string;
    provider: PipelineProvider;
    stages: PipelineStage[];
    triggers: PipelineTrigger[];
    environment: Record<string, string>;
    timeout: number;
    retries: number;
    status: PipelineStatus;
}
export type PipelineProvider = 'github-actions' | 'gitlab-ci' | 'circleci' | 'jenkins' | 'azure-devops';
export type PipelineStatus = 'idle' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
export interface PipelineStage {
    id: string;
    name: string;
    jobs: PipelineJob[];
    dependsOn: string[];
    condition?: string;
    parallel: boolean;
}
export interface PipelineJob {
    id: string;
    name: string;
    steps: PipelineStep[];
    environment: Record<string, string>;
    timeout: number;
    retries: number;
    continueOnError: boolean;
}
export interface PipelineStep {
    id: string;
    name: string;
    type: StepType;
    command?: string;
    script?: string;
    uses?: string;
    with?: Record<string, any>;
    condition?: string;
}
export type StepType = 'command' | 'script' | 'action' | 'docker' | 'deploy';
export interface PipelineTrigger {
    type: TriggerType;
    branches?: string[];
    tags?: string[];
    schedule?: string;
    webhookUrl?: string;
}
export type TriggerType = 'push' | 'pull_request' | 'tag' | 'schedule' | 'manual' | 'webhook';
export interface PipelineRun {
    id: string;
    pipelineId: string;
    number: number;
    status: PipelineStatus;
    triggeredBy: string;
    startedAt: number;
    completedAt?: number;
    duration?: number;
    stages: StageRun[];
    artifacts: Artifact[];
    logs: string[];
}
export interface StageRun {
    stageId: string;
    name: string;
    status: PipelineStatus;
    startedAt: number;
    completedAt?: number;
    jobs: JobRun[];
}
export interface JobRun {
    jobId: string;
    name: string;
    status: PipelineStatus;
    startedAt: number;
    completedAt?: number;
    steps: StepRun[];
    exitCode?: number;
}
export interface StepRun {
    stepId: string;
    name: string;
    status: PipelineStatus;
    startedAt: number;
    completedAt?: number;
    output: string;
    exitCode?: number;
}
export interface Artifact {
    id: string;
    name: string;
    path: string;
    size: number;
    checksum: string;
    uploadedAt: number;
}
export interface DeploymentConfig {
    id: string;
    name: string;
    environment: DeploymentEnvironment;
    strategy: DeploymentStrategy;
    target: DeploymentTarget;
    healthChecks: HealthCheck[];
    rollback: RollbackConfig;
}
export type DeploymentEnvironment = 'development' | 'staging' | 'production' | 'qa';
export type DeploymentStrategy = 'rolling' | 'blue-green' | 'canary' | 'recreate';
export interface DeploymentTarget {
    type: 'kubernetes' | 'docker' | 'vm' | 'serverless' | 'static';
    config: Record<string, any>;
}
export interface HealthCheck {
    type: 'http' | 'tcp' | 'command';
    endpoint?: string;
    expectedStatus?: number;
    command?: string;
    interval: number;
    timeout: number;
    retries: number;
}
export interface RollbackConfig {
    enabled: boolean;
    automatic: boolean;
    conditions: RollbackCondition[];
}
export interface RollbackCondition {
    type: 'health_check_failed' | 'error_rate_exceeded' | 'manual';
    threshold?: number;
}
export interface Deployment {
    id: string;
    configId: string;
    version: string;
    status: DeploymentStatus;
    strategy: DeploymentStrategy;
    startedAt: number;
    completedAt?: number;
    deployedBy: string;
    instances: DeploymentInstance[];
}
export type DeploymentStatus = 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
export interface DeploymentInstance {
    id: string;
    name: string;
    status: 'starting' | 'healthy' | 'unhealthy' | 'stopped';
    version: string;
    health: HealthStatus;
    startedAt: number;
}
export interface HealthStatus {
    healthy: boolean;
    checks: HealthCheckResult[];
    lastChecked: number;
}
export interface HealthCheckResult {
    type: string;
    passed: boolean;
    message: string;
    timestamp: number;
}
export interface Container {
    id: string;
    image: string;
    tag: string;
    name: string;
    status: ContainerStatus;
    ports: PortMapping[];
    volumes: VolumeMount[];
    environment: Record<string, string>;
    resources: ResourceLimits;
    createdAt: number;
}
export type ContainerStatus = 'creating' | 'running' | 'stopped' | 'error' | 'restarting';
export interface PortMapping {
    containerPort: number;
    hostPort: number;
    protocol: 'tcp' | 'udp';
}
export interface VolumeMount {
    source: string;
    target: string;
    readOnly: boolean;
}
export interface ResourceLimits {
    cpuLimit?: string;
    memoryLimit?: string;
    cpuRequest?: string;
    memoryRequest?: string;
}
export interface KubernetesResource {
    apiVersion: string;
    kind: string;
    metadata: {
        name: string;
        namespace?: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
    };
    spec: any;
}
export interface InfrastructureCode {
    id: string;
    name: string;
    provider: 'terraform' | 'ansible' | 'pulumi' | 'cloudformation';
    code: string;
    variables: Record<string, any>;
    state?: any;
}
export declare class DevOpsManager extends EventEmitter {
    private pipelines;
    private pipelineRuns;
    private deployments;
    private deploymentConfigs;
    private containers;
    private infrastructureCode;
    private config;
    constructor(config?: Partial<DevOpsConfig>);
    createPipeline(pipeline: Omit<Pipeline, 'id' | 'status'>): Promise<Pipeline>;
    updatePipeline(pipelineId: string, updates: Partial<Pipeline>): Promise<Pipeline>;
    deletePipeline(pipelineId: string): Promise<void>;
    getPipeline(pipelineId: string): Pipeline | undefined;
    listPipelines(): Pipeline[];
    runPipeline(pipelineId: string, triggeredBy?: string): Promise<PipelineRun>;
    private runStage;
    private runJob;
    private runStep;
    private executeCommand;
    private executeScript;
    private executeAction;
    private executeDockerStep;
    private executeDeployStep;
    private getNextRunNumber;
    createDeploymentConfig(config: Omit<DeploymentConfig, 'id'>): Promise<DeploymentConfig>;
    deploy(configId: string, version: string, deployedBy: string): Promise<Deployment>;
    private rollingDeployment;
    private blueGreenDeployment;
    private canaryDeployment;
    private recreateDeployment;
    private performHealthChecks;
    private runHealthCheck;
    rollback(deploymentId: string): Promise<void>;
    createContainer(image: string, tag: string, config: Partial<Container>): Promise<Container>;
    stopContainer(containerId: string): Promise<void>;
    removeContainer(containerId: string): Promise<void>;
    getContainer(containerId: string): Container | undefined;
    listContainers(): Container[];
    applyKubernetesResource(resource: KubernetesResource): Promise<void>;
    deleteKubernetesResource(kind: string, name: string, namespace?: string): Promise<void>;
    applyInfrastructure(code: Omit<InfrastructureCode, 'id'>): Promise<InfrastructureCode>;
    private applyTerraform;
    private applyAnsible;
    private applyPulumi;
    private applyCloudFormation;
    destroyInfrastructure(id: string): Promise<void>;
    getStats(): DevOpsStats;
    private generateId;
}
interface DevOpsConfig {
    enableCI: boolean;
    enableCD: boolean;
    enableDocker: boolean;
    enableKubernetes: boolean;
    enableMonitoring: boolean;
    defaultTimeout: number;
    maxConcurrentPipelines: number;
    retainRunsForDays: number;
}
interface DevOpsStats {
    totalPipelines: number;
    runningPipelines: number;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    activeDeployments: number;
    runningContainers: number;
}
export default DevOpsManager;
//# sourceMappingURL=DevOpsManager.d.ts.map