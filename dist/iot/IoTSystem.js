"use strict";
/**
 * IoT Device Management System
 * Device registration, telemetry collection, firmware updates, and fleet management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetManager = exports.firmwareUpdateManager = exports.deviceGroupManager = exports.iotDeviceManager = exports.FleetManager = exports.FirmwareUpdateManager = exports.DeviceGroupManager = exports.IoTDeviceManager = exports.PolicyEnforcement = exports.PolicyType = exports.AlertStatus = exports.AlertSeverity = exports.AlertType = exports.UpdateStatus = exports.RolloutStrategy = exports.CommandStatus = exports.ConnectivityProtocol = exports.DeviceStatus = exports.DeviceType = void 0;
const EventBus_1 = require("../core/EventBus");
var DeviceType;
(function (DeviceType) {
    DeviceType["Sensor"] = "sensor";
    DeviceType["Actuator"] = "actuator";
    DeviceType["Gateway"] = "gateway";
    DeviceType["Camera"] = "camera";
    DeviceType["Vehicle"] = "vehicle";
    DeviceType["Wearable"] = "wearable";
    DeviceType["Industrial"] = "industrial";
    DeviceType["SmartHome"] = "smart_home";
})(DeviceType || (exports.DeviceType = DeviceType = {}));
var DeviceStatus;
(function (DeviceStatus) {
    DeviceStatus["Online"] = "online";
    DeviceStatus["Offline"] = "offline";
    DeviceStatus["Sleeping"] = "sleeping";
    DeviceStatus["Maintenance"] = "maintenance";
    DeviceStatus["Error"] = "error";
})(DeviceStatus || (exports.DeviceStatus = DeviceStatus = {}));
var ConnectivityProtocol;
(function (ConnectivityProtocol) {
    ConnectivityProtocol["MQTT"] = "mqtt";
    ConnectivityProtocol["CoAP"] = "coap";
    ConnectivityProtocol["HTTP"] = "http";
    ConnectivityProtocol["WebSocket"] = "websocket";
    ConnectivityProtocol["LoRaWAN"] = "lorawan";
    ConnectivityProtocol["Zigbee"] = "zigbee";
    ConnectivityProtocol["BLE"] = "ble";
})(ConnectivityProtocol || (exports.ConnectivityProtocol = ConnectivityProtocol = {}));
var CommandStatus;
(function (CommandStatus) {
    CommandStatus["Pending"] = "pending";
    CommandStatus["Sent"] = "sent";
    CommandStatus["Acknowledged"] = "acknowledged";
    CommandStatus["Executing"] = "executing";
    CommandStatus["Completed"] = "completed";
    CommandStatus["Failed"] = "failed";
    CommandStatus["Timeout"] = "timeout";
})(CommandStatus || (exports.CommandStatus = CommandStatus = {}));
var RolloutStrategy;
(function (RolloutStrategy) {
    RolloutStrategy["Immediate"] = "immediate";
    RolloutStrategy["Gradual"] = "gradual";
    RolloutStrategy["Canary"] = "canary";
})(RolloutStrategy || (exports.RolloutStrategy = RolloutStrategy = {}));
var UpdateStatus;
(function (UpdateStatus) {
    UpdateStatus["Scheduled"] = "scheduled";
    UpdateStatus["InProgress"] = "in_progress";
    UpdateStatus["Completed"] = "completed";
    UpdateStatus["Failed"] = "failed";
    UpdateStatus["Cancelled"] = "cancelled";
})(UpdateStatus || (exports.UpdateStatus = UpdateStatus = {}));
var AlertType;
(function (AlertType) {
    AlertType["Offline"] = "offline";
    AlertType["LowBattery"] = "low_battery";
    AlertType["HighTemperature"] = "high_temperature";
    AlertType["Malfunction"] = "malfunction";
    AlertType["SecurityBreach"] = "security_breach";
    AlertType["ThresholdExceeded"] = "threshold_exceeded";
})(AlertType || (exports.AlertType = AlertType = {}));
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["Critical"] = "critical";
    AlertSeverity["High"] = "high";
    AlertSeverity["Medium"] = "medium";
    AlertSeverity["Low"] = "low";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["Active"] = "active";
    AlertStatus["Acknowledged"] = "acknowledged";
    AlertStatus["Resolved"] = "resolved";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
var PolicyType;
(function (PolicyType) {
    PolicyType["FirmwareVersion"] = "firmware_version";
    PolicyType["SecurityCompliance"] = "security_compliance";
    PolicyType["DataRetention"] = "data_retention";
    PolicyType["ConnectivityRequirement"] = "connectivity_requirement";
})(PolicyType || (exports.PolicyType = PolicyType = {}));
var PolicyEnforcement;
(function (PolicyEnforcement) {
    PolicyEnforcement["Required"] = "required";
    PolicyEnforcement["Recommended"] = "recommended";
    PolicyEnforcement["Optional"] = "optional";
})(PolicyEnforcement || (exports.PolicyEnforcement = PolicyEnforcement = {}));
/**
 * IoT Device Manager
 */
class IoTDeviceManager {
    devices = new Map();
    telemetry = new Map();
    commands = new Map();
    alerts = new Map();
    /**
     * Register device
     */
    registerDevice(device) {
        const fullDevice = {
            ...device,
            id: this.generateDeviceId(),
            status: DeviceStatus.Offline,
            createdAt: new Date(),
        };
        this.devices.set(fullDevice.id, fullDevice);
        EventBus_1.eventBus.emitSync('iot.device_registered', fullDevice, 'IoTDeviceManager');
        return fullDevice;
    }
    /**
     * Update device status
     */
    updateDeviceStatus(deviceId, status) {
        const device = this.devices.get(deviceId);
        if (device) {
            device.status = status;
            device.lastSeen = new Date();
            EventBus_1.eventBus.emitSync('iot.device_status_changed', { deviceId, status }, 'IoTDeviceManager');
        }
    }
    /**
     * Report telemetry
     */
    reportTelemetry(data) {
        if (!this.telemetry.has(data.deviceId)) {
            this.telemetry.set(data.deviceId, []);
        }
        const deviceTelemetry = this.telemetry.get(data.deviceId);
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
        EventBus_1.eventBus.emitSync('iot.telemetry_received', data, 'IoTDeviceManager');
        // Check for alerts
        this.checkAlertConditions(data);
    }
    /**
     * Send command
     */
    async sendCommand(deviceId, command, parameters = {}) {
        const device = this.devices.get(deviceId);
        if (!device) {
            throw new Error(`Device not found: ${deviceId}`);
        }
        if (device.status !== DeviceStatus.Online) {
            throw new Error(`Device is not online: ${device.status}`);
        }
        const cmd = {
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
            EventBus_1.eventBus.emitSync('iot.command_sent', cmd, 'IoTDeviceManager');
        }, 100);
        return cmd;
    }
    /**
     * Acknowledge command
     */
    acknowledgeCommand(commandId) {
        const cmd = this.commands.get(commandId);
        if (cmd) {
            cmd.status = CommandStatus.Acknowledged;
            cmd.acknowledgedAt = new Date();
            EventBus_1.eventBus.emitSync('iot.command_acknowledged', cmd, 'IoTDeviceManager');
        }
    }
    /**
     * Complete command
     */
    completeCommand(commandId, result, error) {
        const cmd = this.commands.get(commandId);
        if (cmd) {
            cmd.status = error ? CommandStatus.Failed : CommandStatus.Completed;
            cmd.completedAt = new Date();
            cmd.result = result;
            cmd.error = error;
            EventBus_1.eventBus.emitSync('iot.command_completed', cmd, 'IoTDeviceManager');
        }
    }
    /**
     * Get device
     */
    getDevice(deviceId) {
        return this.devices.get(deviceId);
    }
    /**
     * List devices
     */
    listDevices(filter) {
        let devices = Array.from(this.devices.values());
        if (filter?.status) {
            devices = devices.filter(d => d.status === filter.status);
        }
        if (filter?.type) {
            devices = devices.filter(d => d.type === filter.type);
        }
        if (filter?.tags) {
            devices = devices.filter(d => filter.tags.some(tag => d.tags.includes(tag)));
        }
        return devices;
    }
    /**
     * Get telemetry
     */
    getTelemetry(deviceId, limit = 100) {
        const telemetry = this.telemetry.get(deviceId) || [];
        return telemetry.slice(-limit);
    }
    /**
     * Get device alerts
     */
    getDeviceAlerts(deviceId, status) {
        let alerts = Array.from(this.alerts.values()).filter(a => a.deviceId === deviceId);
        if (status) {
            alerts = alerts.filter(a => a.status === status);
        }
        return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
    }
    /**
     * Delete device
     */
    deleteDevice(deviceId) {
        this.devices.delete(deviceId);
        this.telemetry.delete(deviceId);
        EventBus_1.eventBus.emitSync('iot.device_deleted', { deviceId }, 'IoTDeviceManager');
    }
    checkAlertConditions(data) {
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
    createAlert(alert) {
        const fullAlert = {
            ...alert,
            id: this.generateAlertId(),
            status: AlertStatus.Active,
            triggeredAt: new Date(),
        };
        this.alerts.set(fullAlert.id, fullAlert);
        EventBus_1.eventBus.emitSync('iot.alert_created', fullAlert, 'IoTDeviceManager');
    }
    generateDeviceId() {
        return `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateCommandId() {
        return `cmd_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.IoTDeviceManager = IoTDeviceManager;
/**
 * Device Group Manager
 */
class DeviceGroupManager {
    groups = new Map();
    /**
     * Create group
     */
    createGroup(group) {
        const fullGroup = {
            ...group,
            id: this.generateGroupId(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.groups.set(fullGroup.id, fullGroup);
        EventBus_1.eventBus.emitSync('iot.group_created', fullGroup, 'DeviceGroupManager');
        return fullGroup;
    }
    /**
     * Add device to group
     */
    addDeviceToGroup(groupId, deviceId) {
        const group = this.groups.get(groupId);
        if (group && !group.devices.includes(deviceId)) {
            group.devices.push(deviceId);
            group.updatedAt = new Date();
            EventBus_1.eventBus.emitSync('iot.device_added_to_group', { groupId, deviceId }, 'DeviceGroupManager');
        }
    }
    /**
     * Remove device from group
     */
    removeDeviceFromGroup(groupId, deviceId) {
        const group = this.groups.get(groupId);
        if (group) {
            group.devices = group.devices.filter(id => id !== deviceId);
            group.updatedAt = new Date();
            EventBus_1.eventBus.emitSync('iot.device_removed_from_group', { groupId, deviceId }, 'DeviceGroupManager');
        }
    }
    /**
     * Get group
     */
    getGroup(groupId) {
        return this.groups.get(groupId);
    }
    /**
     * List groups
     */
    listGroups() {
        return Array.from(this.groups.values());
    }
    /**
     * Find groups for device
     */
    findGroupsForDevice(deviceId) {
        return Array.from(this.groups.values()).filter(g => g.devices.includes(deviceId));
    }
    generateGroupId() {
        return `group_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.DeviceGroupManager = DeviceGroupManager;
/**
 * Firmware Update Manager
 */
class FirmwareUpdateManager {
    updates = new Map();
    deviceManager;
    constructor(deviceManager) {
        this.deviceManager = deviceManager;
    }
    /**
     * Create firmware update
     */
    createUpdate(update) {
        const fullUpdate = {
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
        EventBus_1.eventBus.emitSync('iot.firmware_update_created', fullUpdate, 'FirmwareUpdateManager');
        return fullUpdate;
    }
    /**
     * Start update
     */
    async startUpdate(updateId) {
        const update = this.updates.get(updateId);
        if (!update) {
            throw new Error(`Update not found: ${updateId}`);
        }
        update.status = UpdateStatus.InProgress;
        update.startedAt = new Date();
        EventBus_1.eventBus.emitSync('iot.firmware_update_started', update, 'FirmwareUpdateManager');
        // Execute update
        this.executeUpdate(update);
    }
    /**
     * Get update
     */
    getUpdate(updateId) {
        return this.updates.get(updateId);
    }
    /**
     * List updates
     */
    listUpdates(filter) {
        let updates = Array.from(this.updates.values());
        if (filter?.status) {
            updates = updates.filter(u => u.status === filter.status);
        }
        return updates;
    }
    async executeUpdate(update) {
        const batchSize = update.schedule?.rollout === RolloutStrategy.Gradual ? 10 : update.targetDevices.length;
        for (let i = 0; i < update.targetDevices.length; i += batchSize) {
            const batch = update.targetDevices.slice(i, i + batchSize);
            for (const deviceId of batch) {
                try {
                    await this.updateDevice(deviceId, update.file);
                    update.progress.completed++;
                }
                catch (error) {
                    update.progress.failed++;
                }
                update.progress.percentage = Math.floor(((update.progress.completed + update.progress.failed) / update.progress.total) * 100);
            }
            // Wait between batches for gradual rollout
            if (update.schedule?.rollout === RolloutStrategy.Gradual && i + batchSize < update.targetDevices.length) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        update.status = update.progress.failed === 0 ? UpdateStatus.Completed : UpdateStatus.Failed;
        update.completedAt = new Date();
        EventBus_1.eventBus.emitSync('iot.firmware_update_completed', update, 'FirmwareUpdateManager');
    }
    async updateDevice(deviceId, file) {
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
            device.firmware.version = file.url.split('/').pop();
            device.firmware.lastUpdated = new Date();
            device.firmware.updateAvailable = false;
        }
    }
    generateUpdateId() {
        return `update_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FirmwareUpdateManager = FirmwareUpdateManager;
/**
 * Fleet Manager
 */
class FleetManager {
    fleets = new Map();
    deviceManager;
    groupManager;
    constructor(deviceManager, groupManager) {
        this.deviceManager = deviceManager;
        this.groupManager = groupManager;
    }
    /**
     * Create fleet
     */
    createFleet(fleet) {
        const fullFleet = {
            ...fleet,
            id: this.generateFleetId(),
            statistics: this.calculateStatistics(fleet.groups),
            createdAt: new Date(),
        };
        this.fleets.set(fullFleet.id, fullFleet);
        EventBus_1.eventBus.emitSync('iot.fleet_created', fullFleet, 'FleetManager');
        return fullFleet;
    }
    /**
     * Get fleet statistics
     */
    getFleetStatistics(fleetId) {
        const fleet = this.fleets.get(fleetId);
        if (!fleet) {
            throw new Error(`Fleet not found: ${fleetId}`);
        }
        return this.calculateStatistics(fleet.groups);
    }
    /**
     * Get fleet
     */
    getFleet(fleetId) {
        return this.fleets.get(fleetId);
    }
    /**
     * List fleets
     */
    listFleets() {
        return Array.from(this.fleets.values());
    }
    calculateStatistics(groupIds) {
        const deviceIds = new Set();
        for (const groupId of groupIds) {
            const group = this.groupManager.getGroup(groupId);
            if (group) {
                group.devices.forEach(id => deviceIds.add(id));
            }
        }
        const devices = Array.from(deviceIds).map(id => this.deviceManager.getDevice(id)).filter(d => d !== undefined);
        const stats = {
            totalDevices: devices.length,
            onlineDevices: devices.filter(d => d.status === DeviceStatus.Online).length,
            offlineDevices: devices.filter(d => d.status === DeviceStatus.Offline).length,
            errorDevices: devices.filter(d => d.status === DeviceStatus.Error).length,
            byType: {},
            byFirmware: {},
        };
        // Count by type
        for (const device of devices) {
            stats.byType[device.type] = (stats.byType[device.type] || 0) + 1;
            stats.byFirmware[device.firmware.version] = (stats.byFirmware[device.firmware.version] || 0) + 1;
        }
        return stats;
    }
    generateFleetId() {
        return `fleet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FleetManager = FleetManager;
/**
 * Singleton instances
 */
exports.iotDeviceManager = new IoTDeviceManager();
exports.deviceGroupManager = new DeviceGroupManager();
exports.firmwareUpdateManager = new FirmwareUpdateManager(exports.iotDeviceManager);
exports.fleetManager = new FleetManager(exports.iotDeviceManager, exports.deviceGroupManager);
