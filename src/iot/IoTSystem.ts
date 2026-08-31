/**
 * IoT Device Management System
 * Device registration, telemetry collection, firmware updates, and fleet management
 */

import { eventBus } from '../core/EventBus';

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

export enum DeviceType {
  Sensor = 'sensor',
  Actuator = 'actuator',
  Gateway = 'gateway',
  Camera = 'camera',
  Vehicle = 'vehicle',
  Wearable = 'wearable',
  Industrial = 'industrial',
  SmartHome = 'smart_home',
}

export interface FirmwareInfo {
  version: string;
  checksum: string;
  updateAvailable: boolean;
  lastUpdated: Date;
}

export enum DeviceStatus {
  Online = 'online',
  Offline = 'offline',
  Sleeping = 'sleeping',
  Maintenance = 'maintenance',
  Error = 'error',
}

export interface ConnectivityInfo {
  protocol: ConnectivityProtocol;
  signalStrength?: number;
  lastConnected?: Date;
  ip?: string;
  mac?: string;
}

export enum ConnectivityProtocol {
  MQTT = 'mqtt',
  CoAP = 'coap',
  HTTP = 'http',
  WebSocket = 'websocket',
  LoRaWAN = 'lorawan',
  Zigbee = 'zigbee',
  BLE = 'ble',
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

export enum CommandStatus {
  Pending = 'pending',
  Sent = 'sent',
  Acknowledged = 'acknowledged',
  Executing = 'executing',
  Completed = 'completed',
  Failed = 'failed',
  Timeout = 'timeout',
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

export enum RolloutStrategy {
  Immediate = 'immediate',
  Gradual = 'gradual',
  Canary = 'canary',
}

export enum UpdateStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
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

export enum AlertType {
  Offline = 'offline',
  LowBattery = 'low_battery',
  HighTemperature = 'high_temperature',
  Malfunction = 'malfunction',
  SecurityBreach = 'security_breach',
  ThresholdExceeded = 'threshold_exceeded',
}

export enum AlertSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum AlertStatus {
  Active = 'active',
  Acknowledged = 'acknowledged',
  Resolved = 'resolved',
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

export enum PolicyType {
  FirmwareVersion = 'firmware_version',
  SecurityCompliance = 'security_compliance',
  DataRetention = 'data_retention',
  ConnectivityRequirement = 'connectivity_requirement',
}

export enum PolicyEnforcement {
  Required = 'required',
  Recommended = 'recommended',
  Optional = 'optional',
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
export class IoTDeviceManager {
  private devices: Map<string, IoTDevice> = new Map();
  private telemetry: Map<string, TelemetryData[]> = new Map();
  private commands: Map<string, DeviceCommand> = new Map();
  private alerts: Map<string, DeviceAlert> = new Map();

  /**
   * Register device
   */
  registerDevice(device: Omit<IoTDevice, 'id' | 'status' | 'createdAt'>): IoTDevice {
    const fullDevice: IoTDevice = {
      ...device,
      id: this.generateDeviceId(),
      status: DeviceStatus.Offline,
      createdAt: new Date(),
    };

    this.devices.set(fullDevice.id, fullDevice);

    eventBus.emitSync('iot.device_registered', fullDevice, 'IoTDeviceManager');

    return fullDevice;
  }

  /**
   * Update device status
   */
  updateDeviceStatus(deviceId: string, status: DeviceStatus): void {
    const device = this.devices.get(deviceId);

    if (device) {
      device.status = status;
      device.lastSeen = new Date();

      eventBus.emitSync('iot.device_status_changed', { deviceId, status }, 'IoTDeviceManager');
    }
  }

  /**
   * Report telemetry
   */
  reportTelemetry(data: TelemetryData): void {
    if (!this.telemetry.has(data.deviceId)) {
      this.telemetry.set(data.deviceId, []);
    }

    const deviceTelemetry = this.telemetry.get(data.deviceId)!;
    deviceTelemetry.push(data);

    // Keep only last 1000 records
    if (deviceTelemetry.length > 1000) {
      deviceTelemetry.shift();
    }

    // Update device last seen
    const device = this.devices.get(data.deviceId);
    if (device) {
      device.lastSeen = data.timestamp;
      device.status = DeviceStatus.Online;
    }

    eventBus.emitSync('iot.telemetry_received', data, 'IoTDeviceManager');

    // Check for alerts
    this.checkAlertConditions(data);
  }

  /**
   * Send command
   */
  async sendCommand(deviceId: string, command: string, parameters: Record<string, any> = {}): Promise<DeviceCommand> {
    const device = this.devices.get(deviceId);

    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    if (device.status !== DeviceStatus.Online) {
      throw new Error(`Device is not online: ${device.status}`);
    }

    const cmd: DeviceCommand = {
      id: this.generateCommandId(),
      deviceId,
      command,
      parameters,
      status: CommandStatus.Pending,
      sentAt: new Date(),
    };

    this.commands.set(cmd.id, cmd);

    // Simulate command sending
    setTimeout(() => {
      cmd.status = CommandStatus.Sent;
      eventBus.emitSync('iot.command_sent', cmd, 'IoTDeviceManager');
    }, 100);

    return cmd;
  }

  /**
   * Acknowledge command
   */
  acknowledgeCommand(commandId: string): void {
    const cmd = this.commands.get(commandId);

    if (cmd) {
      cmd.status = CommandStatus.Acknowledged;
      cmd.acknowledgedAt = new Date();

      eventBus.emitSync('iot.command_acknowledged', cmd, 'IoTDeviceManager');
    }
  }

  /**
   * Complete command
   */
  completeCommand(commandId: string, result?: any, error?: string): void {
    const cmd = this.commands.get(commandId);

    if (cmd) {
      cmd.status = error ? CommandStatus.Failed : CommandStatus.Completed;
      cmd.completedAt = new Date();
      cmd.result = result;
      cmd.error = error;

      eventBus.emitSync('iot.command_completed', cmd, 'IoTDeviceManager');
    }
  }

  /**
   * Get device
   */
  getDevice(deviceId: string): IoTDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * List devices
   */
  listDevices(filter?: {
    status?: DeviceStatus;
    type?: DeviceType;
    tags?: string[];
  }): IoTDevice[] {
    let devices = Array.from(this.devices.values());

    if (filter?.status) {
      devices = devices.filter(d => d.status === filter.status);
    }

    if (filter?.type) {
      devices = devices.filter(d => d.type === filter.type);
    }

    if (filter?.tags) {
      devices = devices.filter(d => filter.tags!.some(tag => d.tags.includes(tag)));
    }

    return devices;
  }

  /**
   * Get telemetry
   */
  getTelemetry(deviceId: string, limit: number = 100): TelemetryData[] {
    const telemetry = this.telemetry.get(deviceId) || [];
    return telemetry.slice(-limit);
  }

  /**
   * Get device alerts
   */
  getDeviceAlerts(deviceId: string, status?: AlertStatus): DeviceAlert[] {
    let alerts = Array.from(this.alerts.values()).filter(a => a.deviceId === deviceId);

    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }

    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  /**
   * Delete device
   */
  deleteDevice(deviceId: string): void {
    this.devices.delete(deviceId);
    this.telemetry.delete(deviceId);

    eventBus.emitSync('iot.device_deleted', { deviceId }, 'IoTDeviceManager');
  }

  private checkAlertConditions(data: TelemetryData): void {
    // Check for threshold violations
    for (const [key, telemetryValue] of Object.entries(data.data)) {
      if (typeof telemetryValue.value === 'number') {
        // Example: temperature threshold
        if (key === 'temperature' && telemetryValue.value > 80) {
          this.createAlert({
            deviceId: data.deviceId,
            type: AlertType.HighTemperature,
            severity: AlertSeverity.High,
            message: `Temperature exceeded threshold: ${telemetryValue.value}°C`,
            data: { temperature: telemetryValue.value },
          });
        }
      }
    }
  }

  private createAlert(alert: Omit<DeviceAlert, 'id' | 'status' | 'triggeredAt'>): void {
    const fullAlert: DeviceAlert = {
      ...alert,
      id: this.generateAlertId(),
      status: AlertStatus.Active,
      triggeredAt: new Date(),
    };

    this.alerts.set(fullAlert.id, fullAlert);

    eventBus.emitSync('iot.alert_created', fullAlert, 'IoTDeviceManager');
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Device Group Manager
 */
export class DeviceGroupManager {
  private groups: Map<string, DeviceGroup> = new Map();

  /**
   * Create group
   */
  createGroup(group: Omit<DeviceGroup, 'id' | 'createdAt' | 'updatedAt'>): DeviceGroup {
    const fullGroup: DeviceGroup = {
      ...group,
      id: this.generateGroupId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.groups.set(fullGroup.id, fullGroup);

    eventBus.emitSync('iot.group_created', fullGroup, 'DeviceGroupManager');

    return fullGroup;
  }

  /**
   * Add device to group
   */
  addDeviceToGroup(groupId: string, deviceId: string): void {
    const group = this.groups.get(groupId);

    if (group && !group.devices.includes(deviceId)) {
      group.devices.push(deviceId);
      group.updatedAt = new Date();

      eventBus.emitSync('iot.device_added_to_group', { groupId, deviceId }, 'DeviceGroupManager');
    }
  }

  /**
   * Remove device from group
   */
  removeDeviceFromGroup(groupId: string, deviceId: string): void {
    const group = this.groups.get(groupId);

    if (group) {
      group.devices = group.devices.filter(id => id !== deviceId);
      group.updatedAt = new Date();

      eventBus.emitSync('iot.device_removed_from_group', { groupId, deviceId }, 'DeviceGroupManager');
    }
  }

  /**
   * Get group
   */
  getGroup(groupId: string): DeviceGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * List groups
   */
  listGroups(): DeviceGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Find groups for device
   */
  findGroupsForDevice(deviceId: string): DeviceGroup[] {
    return Array.from(this.groups.values()).filter(g => g.devices.includes(deviceId));
  }

  private generateGroupId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Firmware Update Manager
 */
export class FirmwareUpdateManager {
  private updates: Map<string, FirmwareUpdate> = new Map();
  private deviceManager: IoTDeviceManager;

  constructor(deviceManager: IoTDeviceManager) {
    this.deviceManager = deviceManager;
  }

  /**
   * Create firmware update
   */
  createUpdate(update: Omit<FirmwareUpdate, 'id' | 'status' | 'progress' | 'createdAt'>): FirmwareUpdate {
    const fullUpdate: FirmwareUpdate = {
      ...update,
      id: this.generateUpdateId(),
      status: UpdateStatus.Scheduled,
      progress: {
        total: update.targetDevices.length,
        completed: 0,
        failed: 0,
        percentage: 0,
      },
      createdAt: new Date(),
    };

    this.updates.set(fullUpdate.id, fullUpdate);

    eventBus.emitSync('iot.firmware_update_created', fullUpdate, 'FirmwareUpdateManager');

    return fullUpdate;
  }

  /**
   * Start update
   */
  async startUpdate(updateId: string): Promise<void> {
    const update = this.updates.get(updateId);

    if (!update) {
      throw new Error(`Update not found: ${updateId}`);
    }

    update.status = UpdateStatus.InProgress;
    update.startedAt = new Date();

    eventBus.emitSync('iot.firmware_update_started', update, 'FirmwareUpdateManager');

    // Execute update
    this.executeUpdate(update);
  }

  /**
   * Get update
   */
  getUpdate(updateId: string): FirmwareUpdate | undefined {
    return this.updates.get(updateId);
  }

  /**
   * List updates
   */
  listUpdates(filter?: { status?: UpdateStatus }): FirmwareUpdate[] {
    let updates = Array.from(this.updates.values());

    if (filter?.status) {
      updates = updates.filter(u => u.status === filter.status);
    }

    return updates;
  }

  private async executeUpdate(update: FirmwareUpdate): Promise<void> {
    const batchSize = update.schedule?.rollout === RolloutStrategy.Gradual ? 10 : update.targetDevices.length;

    for (let i = 0; i < update.targetDevices.length; i += batchSize) {
      const batch = update.targetDevices.slice(i, i + batchSize);

      for (const deviceId of batch) {
        try {
          await this.updateDevice(deviceId, update.file);

          update.progress.completed++;
        } catch (error) {
          update.progress.failed++;
        }

        update.progress.percentage = Math.floor(
          ((update.progress.completed + update.progress.failed) / update.progress.total) * 100
        );
      }

      // Wait between batches for gradual rollout
      if (update.schedule?.rollout === RolloutStrategy.Gradual && i + batchSize < update.targetDevices.length) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    update.status = update.progress.failed === 0 ? UpdateStatus.Completed : UpdateStatus.Failed;
    update.completedAt = new Date();

    eventBus.emitSync('iot.firmware_update_completed', update, 'FirmwareUpdateManager');
  }

  private async updateDevice(deviceId: string, file: FirmwareFile): Promise<void> {
    // Send update command
    await this.deviceManager.sendCommand(deviceId, 'firmware_update', {
      url: file.url,
      checksum: file.checksum,
    });

    // Mock update process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update device firmware info
    const device = this.deviceManager.getDevice(deviceId);

    if (device) {
      device.firmware.version = file.url.split('/').pop()!;
      device.firmware.lastUpdated = new Date();
      device.firmware.updateAvailable = false;
    }
  }

  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Fleet Manager
 */
export class FleetManager {
  private fleets: Map<string, DeviceFleet> = new Map();
  private deviceManager: IoTDeviceManager;
  private groupManager: DeviceGroupManager;

  constructor(deviceManager: IoTDeviceManager, groupManager: DeviceGroupManager) {
    this.deviceManager = deviceManager;
    this.groupManager = groupManager;
  }

  /**
   * Create fleet
   */
  createFleet(fleet: Omit<DeviceFleet, 'id' | 'statistics' | 'createdAt'>): DeviceFleet {
    const fullFleet: DeviceFleet = {
      ...fleet,
      id: this.generateFleetId(),
      statistics: this.calculateStatistics(fleet.groups),
      createdAt: new Date(),
    };

    this.fleets.set(fullFleet.id, fullFleet);

    eventBus.emitSync('iot.fleet_created', fullFleet, 'FleetManager');

    return fullFleet;
  }

  /**
   * Get fleet statistics
   */
  getFleetStatistics(fleetId: string): FleetStatistics {
    const fleet = this.fleets.get(fleetId);

    if (!fleet) {
      throw new Error(`Fleet not found: ${fleetId}`);
    }

    return this.calculateStatistics(fleet.groups);
  }

  /**
   * Get fleet
   */
  getFleet(fleetId: string): DeviceFleet | undefined {
    return this.fleets.get(fleetId);
  }

  /**
   * List fleets
   */
  listFleets(): DeviceFleet[] {
    return Array.from(this.fleets.values());
  }

  private calculateStatistics(groupIds: string[]): FleetStatistics {
    const deviceIds = new Set<string>();

    for (const groupId of groupIds) {
      const group = this.groupManager.getGroup(groupId);

      if (group) {
        group.devices.forEach(id => deviceIds.add(id));
      }
    }

    const devices = Array.from(deviceIds).map(id => this.deviceManager.getDevice(id)).filter(d => d !== undefined) as IoTDevice[];

    const stats: FleetStatistics = {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === DeviceStatus.Online).length,
      offlineDevices: devices.filter(d => d.status === DeviceStatus.Offline).length,
      errorDevices: devices.filter(d => d.status === DeviceStatus.Error).length,
      byType: {} as Record<DeviceType, number>,
      byFirmware: {},
    };

    // Count by type
    for (const device of devices) {
      stats.byType[device.type] = (stats.byType[device.type] || 0) + 1;
      stats.byFirmware[device.firmware.version] = (stats.byFirmware[device.firmware.version] || 0) + 1;
    }

    return stats;
  }

  private generateFleetId(): string {
    return `fleet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const iotDeviceManager = new IoTDeviceManager();
export const deviceGroupManager = new DeviceGroupManager();
export const firmwareUpdateManager = new FirmwareUpdateManager(iotDeviceManager);
export const fleetManager = new FleetManager(iotDeviceManager, deviceGroupManager);
