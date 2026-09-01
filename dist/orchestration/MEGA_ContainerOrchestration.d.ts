/**
 * MEGA PHASE 10: CONTAINER ORCHESTRATION & KUBERNETES
 * Complete container management, K8s orchestration, and deployment
 * Lines: 3000+
 */
import { EventEmitter } from 'events';
export interface ContainerConfig {
    runtime: ContainerRuntime;
    registry: RegistryConfig;
    networking: NetworkingConfig;
    storage: StorageConfig;
    security: SecurityConfig;
}
export type ContainerRuntime = 'docker' | 'containerd' | 'cri-o' | 'podman';
export interface RegistryConfig {
    url: string;
    username?: string;
    password?: string;
    insecure: boolean;
}
export interface NetworkingConfig {
    driver: NetworkDriver;
    subnet: string;
    gateway: string;
    dns: string[];
}
export type NetworkDriver = 'bridge' | 'host' | 'overlay' | 'macvlan' | 'none';
export interface StorageConfig {
    driver: StorageDriver;
    options: Map<string, string>;
}
export type StorageDriver = 'overlay2' | 'aufs' | 'btrfs' | 'zfs' | 'vfs';
export interface SecurityConfig {
    privileged: boolean;
    capabilities: Capability[];
    seccomp: SeccompProfile;
    apparmor: string;
    selinux: SELinuxContext;
}
export type Capability = 'CAP_CHOWN' | 'CAP_NET_ADMIN' | 'CAP_SYS_ADMIN' | 'CAP_SYS_TIME' | 'CAP_SETUID' | 'CAP_SETGID';
export interface SeccompProfile {
    type: SeccompType;
    profile?: string;
}
export type SeccompType = 'unconfined' | 'runtime_default' | 'localhost';
export interface SELinuxContext {
    user: string;
    role: string;
    type: string;
    level: string;
}
export interface Container {
    id: string;
    name: string;
    image: string;
    imageId: string;
    command: string[];
    args: string[];
    env: Map<string, string>;
    labels: Map<string, string>;
    ports: PortMapping[];
    volumes: VolumeMount[];
    networks: NetworkAttachment[];
    resources: ResourceRequirements;
    status: ContainerStatus;
    created: Date;
    started?: Date;
    finished?: Date;
}
export interface PortMapping {
    containerPort: number;
    hostPort: number;
    protocol: Protocol;
    hostIP?: string;
}
export type Protocol = 'tcp' | 'udp' | 'sctp';
export interface VolumeMount {
    name: string;
    mountPath: string;
    subPath?: string;
    readOnly: boolean;
}
export interface NetworkAttachment {
    network: string;
    ipAddress: string;
    gateway: string;
    aliases: string[];
}
export interface ResourceRequirements {
    limits: ResourceList;
    requests: ResourceList;
}
export interface ResourceList {
    cpu: string;
    memory: string;
    storage?: string;
    ephemeralStorage?: string;
}
export interface ContainerStatus {
    state: ContainerState;
    phase: ContainerPhase;
    reason?: string;
    message?: string;
    exitCode?: number;
    signal?: number;
    restartCount: number;
    health?: HealthStatus;
}
export type ContainerState = 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead';
export type ContainerPhase = 'pending' | 'running' | 'succeeded' | 'failed' | 'unknown';
export interface HealthStatus {
    status: HealthState;
    checks: number;
    failures: number;
    lastCheck: Date;
}
export type HealthState = 'healthy' | 'unhealthy' | 'starting';
export interface Image {
    id: string;
    repository: string;
    tag: string;
    digest: string;
    size: number;
    created: Date;
    labels: Map<string, string>;
    layers: Layer[];
}
export interface Layer {
    id: string;
    size: number;
    command: string;
}
export declare class ContainerManager extends EventEmitter {
    private config;
    private containers;
    private images;
    private volumes;
    private networks;
    constructor(config?: Partial<ContainerConfig>);
    createContainer(spec: ContainerSpec): Promise<Container>;
    startContainer(containerId: string): Promise<void>;
    stopContainer(containerId: string, timeout?: number): Promise<void>;
    removeContainer(containerId: string, force?: boolean): Promise<void>;
    pullImage(image: string): Promise<Image>;
    buildImage(dockerfile: string, tag: string, context: string): Promise<Image>;
    private parseDockerfile;
    private resolveImage;
    private startHealthChecks;
    exec(containerId: string, command: string[]): Promise<ExecResult>;
    logs(containerId: string, options?: LogOptions): Promise<string>;
    getStats(containerId: string): ContainerStats;
    private generateId;
}
export interface ContainerSpec {
    name: string;
    image: string;
    command?: string[];
    args?: string[];
    env?: Record<string, string>;
    labels?: Record<string, string>;
    ports?: PortMapping[];
    volumes?: VolumeMount[];
    resources?: ResourceRequirements;
}
export interface Volume {
    name: string;
    driver: string;
    mountpoint: string;
    labels: Map<string, string>;
    created: Date;
}
export interface Network {
    id: string;
    name: string;
    driver: NetworkDriver;
    subnet: string;
    gateway: string;
    containers: string[];
    created: Date;
}
export interface ExecResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
export interface LogOptions {
    follow?: boolean;
    tail?: number;
    since?: Date;
    timestamps?: boolean;
}
export interface ContainerStats {
    cpu: CPUStats;
    memory: MemoryStats;
    network: NetworkStats;
    blockIO: BlockIOStats;
}
export interface CPUStats {
    usage: number;
    limit: number;
}
export interface MemoryStats {
    usage: number;
    limit: number;
}
export interface NetworkStats {
    rxBytes: number;
    txBytes: number;
}
export interface BlockIOStats {
    readBytes: number;
    writeBytes: number;
}
export interface KubernetesConfig {
    apiServer: string;
    namespace: string;
    token?: string;
    certFile?: string;
    keyFile?: string;
    insecure: boolean;
}
export interface Pod {
    metadata: ObjectMeta;
    spec: PodSpec;
    status: PodStatus;
}
export interface ObjectMeta {
    name: string;
    namespace: string;
    uid: string;
    labels: Map<string, string>;
    annotations: Map<string, string>;
    creationTimestamp: Date;
}
export interface PodSpec {
    containers: ContainerSpec[];
    initContainers?: ContainerSpec[];
    volumes?: VolumeSpec[];
    restartPolicy: RestartPolicy;
    serviceAccountName?: string;
    nodeName?: string;
    nodeSelector?: Map<string, string>;
    affinity?: Affinity;
    tolerations?: Toleration[];
    priorityClassName?: string;
}
export type RestartPolicy = 'Always' | 'OnFailure' | 'Never';
export interface VolumeSpec {
    name: string;
    source: VolumeSource;
}
export interface VolumeSource {
    emptyDir?: EmptyDirVolumeSource;
    hostPath?: HostPathVolumeSource;
    persistentVolumeClaim?: PersistentVolumeClaimVolumeSource;
    configMap?: ConfigMapVolumeSource;
    secret?: SecretVolumeSource;
}
export interface EmptyDirVolumeSource {
    medium?: string;
    sizeLimit?: string;
}
export interface HostPathVolumeSource {
    path: string;
    type?: HostPathType;
}
export type HostPathType = 'Directory' | 'File' | 'Socket' | 'CharDevice' | 'BlockDevice';
export interface PersistentVolumeClaimVolumeSource {
    claimName: string;
    readOnly?: boolean;
}
export interface ConfigMapVolumeSource {
    name: string;
    items?: KeyToPath[];
    defaultMode?: number;
}
export interface SecretVolumeSource {
    secretName: string;
    items?: KeyToPath[];
    defaultMode?: number;
}
export interface KeyToPath {
    key: string;
    path: string;
    mode?: number;
}
export interface Affinity {
    nodeAffinity?: NodeAffinity;
    podAffinity?: PodAffinity;
    podAntiAffinity?: PodAntiAffinity;
}
export interface NodeAffinity {
    requiredDuringSchedulingIgnoredDuringExecution?: NodeSelector;
    preferredDuringSchedulingIgnoredDuringExecution?: PreferredSchedulingTerm[];
}
export interface NodeSelector {
    nodeSelectorTerms: NodeSelectorTerm[];
}
export interface NodeSelectorTerm {
    matchExpressions?: NodeSelectorRequirement[];
    matchFields?: NodeSelectorRequirement[];
}
export interface NodeSelectorRequirement {
    key: string;
    operator: SelectorOperator;
    values?: string[];
}
export type SelectorOperator = 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
export interface PreferredSchedulingTerm {
    weight: number;
    preference: NodeSelectorTerm;
}
export interface PodAffinity {
    requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
    preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}
export interface PodAntiAffinity {
    requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
    preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
}
export interface PodAffinityTerm {
    labelSelector?: LabelSelector;
    namespaces?: string[];
    topologyKey: string;
}
export interface WeightedPodAffinityTerm {
    weight: number;
    podAffinityTerm: PodAffinityTerm;
}
export interface LabelSelector {
    matchLabels?: Map<string, string>;
    matchExpressions?: LabelSelectorRequirement[];
}
export interface LabelSelectorRequirement {
    key: string;
    operator: SelectorOperator;
    values?: string[];
}
export interface Toleration {
    key?: string;
    operator?: TolerationOperator;
    value?: string;
    effect?: TaintEffect;
    tolerationSeconds?: number;
}
export type TolerationOperator = 'Exists' | 'Equal';
export type TaintEffect = 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
export interface PodStatus {
    phase: PodPhase;
    conditions: PodCondition[];
    hostIP?: string;
    podIP?: string;
    startTime?: Date;
    containerStatuses?: ContainerStatus[];
    initContainerStatuses?: ContainerStatus[];
}
export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
export interface PodCondition {
    type: PodConditionType;
    status: ConditionStatus;
    lastProbeTime?: Date;
    lastTransitionTime?: Date;
    reason?: string;
    message?: string;
}
export type PodConditionType = 'PodScheduled' | 'Ready' | 'Initialized' | 'ContainersReady';
export type ConditionStatus = 'True' | 'False' | 'Unknown';
export interface Deployment {
    metadata: ObjectMeta;
    spec: DeploymentSpec;
    status: DeploymentStatus;
}
export interface DeploymentSpec {
    replicas: number;
    selector: LabelSelector;
    template: PodTemplateSpec;
    strategy: DeploymentStrategy;
    minReadySeconds?: number;
    revisionHistoryLimit?: number;
    paused?: boolean;
    progressDeadlineSeconds?: number;
}
export interface PodTemplateSpec {
    metadata: ObjectMeta;
    spec: PodSpec;
}
export interface DeploymentStrategy {
    type: DeploymentStrategyType;
    rollingUpdate?: RollingUpdateDeployment;
}
export type DeploymentStrategyType = 'RollingUpdate' | 'Recreate';
export interface RollingUpdateDeployment {
    maxUnavailable?: number | string;
    maxSurge?: number | string;
}
export interface DeploymentStatus {
    observedGeneration?: number;
    replicas?: number;
    updatedReplicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
    conditions?: DeploymentCondition[];
}
export interface DeploymentCondition {
    type: DeploymentConditionType;
    status: ConditionStatus;
    lastUpdateTime?: Date;
    lastTransitionTime?: Date;
    reason?: string;
    message?: string;
}
export type DeploymentConditionType = 'Available' | 'Progressing' | 'ReplicaFailure';
export interface Service {
    metadata: ObjectMeta;
    spec: ServiceSpec;
    status: ServiceStatus;
}
export interface ServiceSpec {
    type: ServiceType;
    selector: Map<string, string>;
    ports: ServicePort[];
    clusterIP?: string;
    externalIPs?: string[];
    sessionAffinity?: SessionAffinity;
    loadBalancerIP?: string;
    loadBalancerSourceRanges?: string[];
    externalName?: string;
}
export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
export interface ServicePort {
    name?: string;
    protocol: Protocol;
    port: number;
    targetPort: number | string;
    nodePort?: number;
}
export type SessionAffinity = 'None' | 'ClientIP';
export interface ServiceStatus {
    loadBalancer?: LoadBalancerStatus;
}
export interface LoadBalancerStatus {
    ingress?: LoadBalancerIngress[];
}
export interface LoadBalancerIngress {
    ip?: string;
    hostname?: string;
}
export declare class KubernetesOrchestrator extends EventEmitter {
    private config;
    private pods;
    private deployments;
    private services;
    constructor(config?: Partial<KubernetesConfig>);
    createPod(spec: PodSpec, metadata?: Partial<ObjectMeta>): Promise<Pod>;
    private schedulePod;
    createDeployment(spec: DeploymentSpec, metadata?: Partial<ObjectMeta>): Promise<Deployment>;
    private reconcileDeployment;
    private podMatchesDeployment;
    createService(spec: ServiceSpec, metadata?: Partial<ObjectMeta>): Promise<Service>;
    private allocateClusterIP;
    private allocateExternalIP;
    deletePod(uid: string): Promise<void>;
    scaleDeployment(uid: string, replicas: number): Promise<void>;
    private sleep;
    private generateId;
    private generateName;
    getStats(): {
        pods: number;
        deployments: number;
        services: number;
        runningPods: number;
    };
}
export declare class ContainerOrchestrationSystem {
    containers: ContainerManager;
    kubernetes: KubernetesOrchestrator;
    constructor();
    getOverallStats(): {
        containers: ContainerManager;
        kubernetes: {
            pods: number;
            deployments: number;
            services: number;
            runningPods: number;
        };
    };
}
//# sourceMappingURL=MEGA_ContainerOrchestration.d.ts.map