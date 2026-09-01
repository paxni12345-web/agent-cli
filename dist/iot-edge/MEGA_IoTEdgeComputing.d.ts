/**
 * MEGA PHASE 14: IOT & EDGE COMPUTING SYSTEM
 * Device management, MQTT, Edge AI, Firmware OTA, Time-series optimization
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface IoTConfig {
    protocol: IoTProtocol;
    broker: BrokerConfig;
    security: IoTSecurityConfig;
    telemetry: TelemetryConfig;
    edgeComputing: EdgeConfig;
}
export type IoTProtocol = 'mqtt' | 'coap' | 'amqp' | 'websocket' | 'http';
export interface BrokerConfig {
    host: string;
    port: number;
    clientId: string;
    username?: string;
    password?: string;
    keepAlive: number;
    cleanSession: boolean;
}
export interface IoTSecurityConfig {
    tls: boolean;
    certificate?: string;
    privateKey?: string;
    caCertificate?: string;
    tokenAuth: boolean;
}
export interface TelemetryConfig {
    interval: number;
    batchSize: number;
    compression: boolean;
    qos: QoSLevel;
}
export type QoSLevel = 0 | 1 | 2;
export interface EdgeConfig {
    enabled: boolean;
    modelPath?: string;
    inferenceEngine: InferenceEngine;
    accelerator?: Accelerator;
}
export type InferenceEngine = 'tensorflow-lite' | 'onnx' | 'tflite' | 'pytorch-mobile';
export type Accelerator = 'cpu' | 'gpu' | 'npu' | 'tpu';
export interface IoTDevice {
    id: string;
    name: string;
    type: DeviceType;
    status: DeviceStatus;
    connectivity: ConnectivityInfo;
    hardware: HardwareInfo;
    firmware: FirmwareInfo;
    location?: GeoLocation;
    tags: string[];
    metadata: Map<string, any>;
    createdAt: Date;
    lastSeenAt: Date;
}
export type DeviceType = 'sensor' | 'actuator' | 'gateway' | 'edge' | 'hybrid';
export type DeviceStatus = 'online' | 'offline' | 'inactive' | 'error' | 'updating';
export interface ConnectivityInfo {
    protocol: IoTProtocol;
    ipAddress?: string;
    signalStrength?: number;
    networkType?: NetworkType;
    latency?: number;
}
export type NetworkType = 'wifi' | '4g' | '5g' | 'lora' | 'zigbee' | 'bluetooth';
export interface HardwareInfo {
    manufacturer: string;
    model: string;
    serialNumber: string;
    cpu: string;
    memory: number;
    storage: number;
    sensors: Sensor[];
    actuators: Actuator[];
}
export interface Sensor {
    type: SensorType;
    name: string;
    unit: string;
    precision: number;
    range: [number, number];
}
export type SensorType = 'temperature' | 'humidity' | 'pressure' | 'light' | 'motion' | 'proximity' | 'accelerometer' | 'gyroscope' | 'gps' | 'camera' | 'microphone';
export interface Actuator {
    type: ActuatorType;
    name: string;
    states: string[];
    currentState: string;
}
export type ActuatorType = 'relay' | 'motor' | 'servo' | 'led' | 'buzzer' | 'display';
export interface FirmwareInfo {
    version: string;
    buildDate: Date;
    updateAvailable: boolean;
    updateVersion?: string;
    updateStatus?: UpdateStatus;
}
export type UpdateStatus = 'idle' | 'downloading' | 'verifying' | 'installing' | 'rebooting' | 'failed';
export interface GeoLocation {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
}
export interface Telemetry {
    id: string;
    deviceId: string;
    timestamp: Date;
    data: Map<string, TelemetryValue>;
    metadata?: Map<string, any>;
}
export interface TelemetryValue {
    value: number | string | boolean;
    unit?: string;
    quality?: DataQuality;
}
export type DataQuality = 'good' | 'uncertain' | 'bad';
export declare class IoTDeviceManager extends EventEmitter {
    private config;
    private devices;
    private telemetry;
    private connected;
    constructor(config?: Partial<IoTConfig>);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    registerDevice(device: Omit<IoTDevice, 'id' | 'createdAt' | 'lastSeenAt'>): IoTDevice;
    publishTelemetry(deviceId: string, data: Map<string, TelemetryValue>): Promise<Telemetry>;
    subscribe(topic: string, handler: (message: any) => void): void;
    sendCommand(deviceId: string, command: DeviceCommand): Promise<void>;
    updateFirmware(deviceId: string, version: string, url: string): Promise<void>;
    getDeviceTelemetry(deviceId: string, limit?: number): Telemetry[];
    private generateDeviceId;
    private generateId;
    private sleep;
    getStats(): {
        devices: number;
        onlineDevices: number;
        telemetryPoints: number;
        connected: boolean;
    };
}
export interface DeviceCommand {
    type: CommandType;
    params?: Map<string, any>;
    timeout?: number;
}
export type CommandType = 'read' | 'write' | 'execute' | 'reset' | 'update' | 'configure';
export interface MQTTBrokerConfig {
    port: number;
    websocketPort?: number;
    maxConnections: number;
    retainedMessages: boolean;
    persistenceEnabled: boolean;
}
export interface MQTTClient {
    id: string;
    address: string;
    protocol: string;
    cleanSession: boolean;
    keepAlive: number;
    subscriptions: Map<string, QoSLevel>;
    lastActivity: Date;
    connectedAt: Date;
}
export interface MQTTMessage {
    id: string;
    topic: string;
    payload: Buffer | string;
    qos: QoSLevel;
    retain: boolean;
    timestamp: Date;
}
export interface MQTTSubscription {
    clientId: string;
    topic: string;
    qos: QoSLevel;
}
export declare class MQTTBroker extends EventEmitter {
    private config;
    private clients;
    private subscriptions;
    private retainedMessages;
    constructor(config?: Partial<MQTTBrokerConfig>);
    start(): void;
    handleConnect(clientId: string, options: any): MQTTClient;
    handleSubscribe(clientId: string, topic: string, qos?: QoSLevel): void;
    handlePublish(clientId: string, topic: string, payload: any, options?: any): void;
    private findSubscribers;
    private topicMatches;
    private deliverMessage;
    handleDisconnect(clientId: string): void;
    private generateId;
    getStats(): {
        clients: number;
        topics: number;
        retainedMessages: number;
    };
}
export interface EdgeComputeNode {
    id: string;
    name: string;
    type: NodeType;
    capacity: ComputeCapacity;
    status: NodeStatus;
    location?: GeoLocation;
    models: EdgeModel[];
    workloads: Workload[];
    createdAt: Date;
}
export type NodeType = 'gateway' | 'fog' | 'cloudlet' | 'edge_server';
export interface ComputeCapacity {
    cpu: number;
    memory: number;
    storage: number;
    gpu?: GPUInfo;
    accelerators?: string[];
}
export interface GPUInfo {
    model: string;
    memory: number;
    cores: number;
}
export type NodeStatus = 'active' | 'busy' | 'idle' | 'offline' | 'maintenance';
export interface EdgeModel {
    id: string;
    name: string;
    framework: MLFramework;
    format: ModelFormat;
    size: number;
    version: string;
    accuracy: number;
    latency: number;
    inputShape: number[];
    outputShape: number[];
}
export type MLFramework = 'tensorflow' | 'pytorch' | 'onnx' | 'tflite' | 'coreml';
export type ModelFormat = 'savedmodel' | 'onnx' | 'tflite' | 'torchscript' | 'coreml';
export interface Workload {
    id: string;
    type: WorkloadType;
    priority: number;
    resources: ResourceRequirements;
    status: WorkloadStatus;
    startedAt?: Date;
    completedAt?: Date;
}
export type WorkloadType = 'inference' | 'training' | 'preprocessing' | 'aggregation';
export interface ResourceRequirements {
    cpu: number;
    memory: number;
    gpu?: number;
}
export type WorkloadStatus = 'pending' | 'running' | 'completed' | 'failed';
export declare class EdgeComputingManager extends EventEmitter {
    private nodes;
    private workloadQueue;
    registerNode(node: Omit<EdgeComputeNode, 'id' | 'createdAt'>): EdgeComputeNode;
    deployModel(nodeId: string, model: EdgeModel): Promise<void>;
    runInference(nodeId: string, modelId: string, input: any): Promise<InferenceResult>;
    scheduleWorkload(workload: Omit<Workload, 'id' | 'status'>): Workload;
    private assignWorkloads;
    private findAvailableNode;
    private calculateUsedResources;
    private generateMockOutput;
    private sleep;
    private generateId;
    getStats(): {
        nodes: number;
        activeNodes: number;
        totalModels: number;
        pendingWorkloads: number;
    };
}
export interface InferenceResult {
    modelId: string;
    output: any;
    confidence: number;
    latency: number;
    timestamp: Date;
}
export declare class IoTEdgeComputingSystem {
    devices: IoTDeviceManager;
    mqtt: MQTTBroker;
    edge: EdgeComputingManager;
    constructor();
    getOverallStats(): {
        devices: {
            devices: number;
            onlineDevices: number;
            telemetryPoints: number;
            connected: boolean;
        };
        mqtt: {
            clients: number;
            topics: number;
            retainedMessages: number;
        };
        edge: {
            nodes: number;
            activeNodes: number;
            totalModels: number;
            pendingWorkloads: number;
        };
    };
}
//# sourceMappingURL=MEGA_IoTEdgeComputing.d.ts.map