/**
 * IoT Device Management System
 * Device registration, telemetry collection, firmware updates, and fleet management
 */
export interface IoTDevice {
    id: string;
    name: string;
    type: DeviceType;
    model: string;
    manufacturer: string;
    firmware: FirmwareInfo;
    status: DeviceStatus;
    connectivity: ConnectivityInfo;
    location?: DeviceLocation;
    attributes: Record<string, any>;
    tags: string[];
    createdAt: Date;
    lastSeen?: Date;
}
export declare enum DeviceType {
    Sensor = "sensor",
    Actuator = "actuator",
    Gateway = "gateway",
    Camera = "camera",
    Vehicle = "vehicle",
    Wearable = "wearable",
    Industrial = "industrial",
    SmartHome = "smart_home"
}
export interface FirmwareInfo {
    version: string;
    checksum: string;
    updateAvailable: boolean;
    lastUpdated: Date;
}
export declare enum DeviceStatus {
    Online = "online",
    Offline = "offline",
    Sleeping = "sleeping",
    Maintenance = "maintenance",
    Error = "error"
}
export interface ConnectivityInfo {
    protocol: ConnectivityProtocol;
    signalStrength?: number;
    lastConnected?: Date;
    ip?: string;
    mac?: string;
}
export declare enum ConnectivityProtocol {
    MQTT = "mqtt",
    CoAP = "coap",
    HTTP = "http",
    WebSocket = "websocket",
    LoRaWAN = "lorawan",
    Zigbee = "zigbee",
    BLE = "ble"
}
export interface DeviceLocation {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    timestamp: Date;
}
export interface TelemetryData {
    deviceId: string;
    timestamp: Date;
    data: Record<string, TelemetryValue>;
    metadata?: Record<string, any>;
}
export interface TelemetryValue {
    value: number | string | boolean;
    unit?: string;
}
export interface DeviceCommand {
    id: string;
    deviceId: string;
    command: string;
    parameters: Record<string, any>;
    status: CommandStatus;
    sentAt: Date;
    acknowledgedAt?: Date;
    completedAt?: Date;
    result?: any;
    error?: string;
}
export declare enum CommandStatus {
    Pending = "pending",
    Sent = "sent",
    Acknowledged = "acknowledged",
    Executing = "executing",
    Completed = "completed",
    Failed = "failed",
    Timeout = "timeout"
}
export interface DeviceGroup {
    id: string;
    name: string;
    description?: string;
    devices: string[];
    rules: GroupRule[];
    createdAt: Date;
    updatedAt: Date;
}
export interface GroupRule {
    type: 'attribute' | 'tag' | 'location' | 'status';
    condition: string;
    value: any;
}
export interface FirmwareUpdate {
    id: string;
    version: string;
    targetDevices: string[];
    file: FirmwareFile;
    schedule?: UpdateSchedule;
    status: UpdateStatus;
    progress: UpdateProgress;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}
export interface FirmwareFile {
    url: string;
    size: number;
    checksum: string;
    releaseNotes?: string;
}
export interface UpdateSchedule {
    startTime: Date;
    endTime?: Date;
    rollout: RolloutStrategy;
}
export declare enum RolloutStrategy {
    Immediate = "immediate",
    Gradual = "gradual",
    Canary = "canary"
}
export declare enum UpdateStatus {
    Scheduled = "scheduled",
    InProgress = "in_progress",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled"
}
export interface UpdateProgress {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
}
export interface DeviceAlert {
    id: string;
    deviceId: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    data?: Record<string, any>;
    status: AlertStatus;
    triggeredAt: Date;
    acknowledgedAt?: Date;
    resolvedAt?: Date;
}
export declare enum AlertType {
    Offline = "offline",
    LowBattery = "low_battery",
    HighTemperature = "high_temperature",
    Malfunction = "malfunction",
    SecurityBreach = "security_breach",
    ThresholdExceeded = "threshold_exceeded"
}
export declare enum AlertSeverity {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low"
}
export declare enum AlertStatus {
    Active = "active",
    Acknowledged = "acknowledged",
    Resolved = "resolved"
}
export interface DeviceFleet {
    id: string;
    name: string;
    description?: string;
    groups: string[];
    policies: FleetPolicy[];
    statistics: FleetStatistics;
    createdAt: Date;
}
export interface FleetPolicy {
    type: PolicyType;
    config: Record<string, any>;
    enforcement: PolicyEnforcement;
}
export declare enum PolicyType {
    FirmwareVersion = "firmware_version",
    SecurityCompliance = "security_compliance",
    DataRetention = "data_retention",
    ConnectivityRequirement = "connectivity_requirement"
}
export declare enum PolicyEnforcement {
    Required = "required",
    Recommended = "recommended",
    Optional = "optional"
}
export interface FleetStatistics {
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    errorDevices: number;
    byType: Record<DeviceType, number>;
    byFirmware: Record<string, number>;
}
/**
 * IoT Device Manager
 */
export declare class IoTDeviceManager {
    private devices;
    private telemetry;
    private commands;
    private alerts;
    /**
     * Register device
     */
    registerDevice(device: Omit<IoTDevice, 'id' | 'status' | 'createdAt'>): IoTDevice;
    /**
     * Update device status
     */
    updateDeviceStatus(deviceId: string, status: DeviceStatus): void;
    /**
     * Report telemetry
     */
    reportTelemetry(data: TelemetryData): void;
    /**
     * Send command
     */
    sendCommand(deviceId: string, command: string, parameters?: Record<string, any>): Promise<DeviceCommand>;
    /**
     * Acknowledge command
     */
    acknowledgeCommand(commandId: string): void;
    /**
     * Complete command
     */
    completeCommand(commandId: string, result?: any, error?: string): void;
    /**
     * Get device
     */
    getDevice(deviceId: string): IoTDevice | undefined;
    /**
     * List devices
     */
    listDevices(filter?: {
        status?: DeviceStatus;
        type?: DeviceType;
        tags?: string[];
    }): IoTDevice[];
    /**
     * Get telemetry
     */
    getTelemetry(deviceId: string, limit?: number): TelemetryData[];
    /**
     * Get device alerts
     */
    getDeviceAlerts(deviceId: string, status?: AlertStatus): DeviceAlert[];
    /**
     * Delete device
     */
    deleteDevice(deviceId: string): void;
    private checkAlertConditions;
    private createAlert;
    private generateDeviceId;
    private generateCommandId;
    private generateAlertId;
}
/**
 * Device Group Manager
 */
export declare class DeviceGroupManager {
    private groups;
    /**
     * Create group
     */
    createGroup(group: Omit<DeviceGroup, 'id' | 'createdAt' | 'updatedAt'>): DeviceGroup;
    /**
     * Add device to group
     */
    addDeviceToGroup(groupId: string, deviceId: string): void;
    /**
     * Remove device from group
     */
    removeDeviceFromGroup(groupId: string, deviceId: string): void;
    /**
     * Get group
     */
    getGroup(groupId: string): DeviceGroup | undefined;
    /**
     * List groups
     */
    listGroups(): DeviceGroup[];
    /**
     * Find groups for device
     */
    findGroupsForDevice(deviceId: string): DeviceGroup[];
    private generateGroupId;
}
/**
 * Firmware Update Manager
 */
export declare class FirmwareUpdateManager {
    private updates;
    private deviceManager;
    constructor(deviceManager: IoTDeviceManager);
    /**
     * Create firmware update
     */
    createUpdate(update: Omit<FirmwareUpdate, 'id' | 'status' | 'progress' | 'createdAt'>): FirmwareUpdate;
    /**
     * Start update
     */
    startUpdate(updateId: string): Promise<void>;
    /**
     * Get update
     */
    getUpdate(updateId: string): FirmwareUpdate | undefined;
    /**
     * List updates
     */
    listUpdates(filter?: {
        status?: UpdateStatus;
    }): FirmwareUpdate[];
    private executeUpdate;
    private updateDevice;
    private generateUpdateId;
}
/**
 * Fleet Manager
 */
export declare class FleetManager {
    private fleets;
    private deviceManager;
    private groupManager;
    constructor(deviceManager: IoTDeviceManager, groupManager: DeviceGroupManager);
    /**
     * Create fleet
     */
    createFleet(fleet: Omit<DeviceFleet, 'id' | 'statistics' | 'createdAt'>): DeviceFleet;
    /**
     * Get fleet statistics
     */
    getFleetStatistics(fleetId: string): FleetStatistics;
    /**
     * Get fleet
     */
    getFleet(fleetId: string): DeviceFleet | undefined;
    /**
     * List fleets
     */
    listFleets(): DeviceFleet[];
    private calculateStatistics;
    private generateFleetId;
}
/**
 * Singleton instances
 */
export declare const iotDeviceManager: IoTDeviceManager;
export declare const deviceGroupManager: DeviceGroupManager;
export declare const firmwareUpdateManager: FirmwareUpdateManager;
export declare const fleetManager: FleetManager;
//# sourceMappingURL=IoTSystem.d.ts.map