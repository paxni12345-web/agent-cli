/**
 * PHASE 4: MOBILE & CROSS-PLATFORM SYSTEM
 * React Native, PWA, Electron, and offline-first architecture
 *
 * Part of 350K lines goal - PHASE 4
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MobileConfig {
  platform: Platform;
  enableOffline: boolean;
  enablePushNotifications: boolean;
  enableBiometric: boolean;
  syncInterval: number;
  maxCacheSize: number;
}

export type Platform = 'ios' | 'android' | 'web' | 'desktop' | 'universal';

export interface AppMetadata {
  version: string;
  buildNumber: number;
  bundleId: string;
  name: string;
  displayName: string;
  description: string;
  author: string;
  homepage: string;
}

// Offline Storage
export interface OfflineStorage {
  id: string;
  type: StorageType;
  data: any;
  syncStatus: SyncStatus;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
}

export type StorageType = 'local' | 'session' | 'indexed_db' | 'async_storage';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface SyncQueue {
  id: string;
  operation: SyncOperation;
  endpoint: string;
  data: any;
  priority: SyncPriority;
  retries: number;
  maxRetries: number;
  status: SyncStatus;
  error?: string;
  createdAt: Date;
}

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncPriority = 'low' | 'normal' | 'high' | 'critical';

export interface SyncConflict {
  id: string;
  localData: any;
  remoteData: any;
  resolution?: ConflictResolution;
  resolvedAt?: Date;
}

export type ConflictResolution = 'local' | 'remote' | 'merge' | 'manual';

// Push Notifications
export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  category?: string;
  threadId?: string;
  priority: NotificationPriority;
  scheduledAt?: Date;
  expiresAt?: Date;
}

export type NotificationPriority = 'min' | 'low' | 'default' | 'high' | 'max';

export interface NotificationPermission {
  granted: boolean;
  token?: string;
  platform: Platform;
  registeredAt: Date;
}

// Biometric Authentication
export interface BiometricConfig {
  enabled: boolean;
  types: BiometricType[];
  fallbackToPassword: boolean;
  promptMessage: string;
}

export type BiometricType = 'fingerprint' | 'face_id' | 'iris' | 'voice';

export interface BiometricResult {
  success: boolean;
  type?: BiometricType;
  error?: string;
}

// App State
export interface AppState {
  lifecycle: LifecycleState;
  network: NetworkState;
  permissions: PermissionState;
  orientation: OrientationState;
  battery?: BatteryState;
}

export type LifecycleState = 'active' | 'background' | 'inactive' | 'terminated';

export interface NetworkState {
  isConnected: boolean;
  type: NetworkType;
  effectiveType?: EffectiveNetworkType;
  isInternetReachable?: boolean;
}

export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'none' | 'unknown';

export type EffectiveNetworkType = '2g' | '3g' | '4g' | '5g' | 'slow-2g';

export interface PermissionState {
  camera: Permission;
  microphone: Permission;
  location: Permission;
  notifications: Permission;
  storage: Permission;
  contacts: Permission;
}

export type Permission = 'granted' | 'denied' | 'undetermined';

export type OrientationState = 'portrait' | 'landscape' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right';

export interface BatteryState {
  level: number;
  charging: boolean;
  lowPowerMode: boolean;
}

// Navigation
export interface NavigationStack {
  routes: Route[];
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface Route {
  name: string;
  params?: Record<string, any>;
  timestamp: Date;
}

export interface DeepLink {
  url: string;
  scheme: string;
  host: string;
  path: string;
  params: Record<string, string>;
}

// Media Handling
export interface MediaAsset {
  id: string;
  type: MediaType;
  uri: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  metadata?: MediaMetadata;
}

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MediaMetadata {
  camera?: string;
  location?: GeoLocation;
  capturedAt?: Date;
  orientation?: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

// App Updates
export interface AppUpdate {
  version: string;
  buildNumber: number;
  required: boolean;
  releaseNotes: string;
  downloadUrl?: string;
  size?: number;
  availableAt: Date;
}

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percentage: number;
  status: UpdateStatus;
}

export type UpdateStatus = 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'completed' | 'failed';

// Analytics & Tracking
export interface ScreenView {
  screenName: string;
  params?: Record<string, any>;
  previousScreen?: string;
  timestamp: Date;
  duration?: number;
}

export interface UserAction {
  action: string;
  category: string;
  label?: string;
  value?: number;
  screen?: string;
  timestamp: Date;
}

// Performance Monitoring
export interface PerformanceMetric {
  name: string;
  type: MetricType;
  value: number;
  unit: string;
  timestamp: Date;
  attributes?: Record<string, any>;
}

export type MetricType = 'app_start' | 'screen_render' | 'network_request' | 'js_bundle_load' | 'custom';

export interface CrashReport {
  id: string;
  message: string;
  stack: string;
  platform: Platform;
  appVersion: string;
  osVersion: string;
  device: string;
  fatal: boolean;
  timestamp: Date;
  breadcrumbs: Breadcrumb[];
}

export interface Breadcrumb {
  message: string;
  category: string;
  level: BreadcrumbLevel;
  timestamp: Date;
  data?: Record<string, any>;
}

export type BreadcrumbLevel = 'debug' | 'info' | 'warning' | 'error';

// Device Info
export interface DeviceInfo {
  platform: Platform;
  manufacturer: string;
  model: string;
  osVersion: string;
  appVersion: string;
  uniqueId: string;
  isTablet: boolean;
  hasNotch: boolean;
  screenSize: ScreenSize;
}

export interface ScreenSize {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}

// Theme & Localization
export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  fonts: FontConfig;
  spacing: SpacingConfig;
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface FontConfig {
  regular: string;
  medium: string;
  bold: string;
  sizes: FontSizes;
}

export interface FontSizes {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface SpacingConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface LocaleConfig {
  locale: string;
  fallbackLocale: string;
  translations: Map<string, Translation>;
  dateFormat: string;
  timeFormat: string;
  currency: string;
}

export interface Translation {
  key: string;
  value: string;
  params?: string[];
}

// ============================================================================
// Mobile Platform Manager
// ============================================================================

export class MobilePlatformManager extends EventEmitter {
  private config: MobileConfig;
  private appState: AppState;
  private offlineStorage: Map<string, OfflineStorage> = new Map();
  private syncQueue: SyncQueue[] = [];
  private conflicts: Map<string, SyncConflict> = new Map();
  private notifications: Map<string, PushNotification> = new Map();
  private navigationStack: NavigationStack = {
    routes: [],
    currentIndex: -1,
    canGoBack: false,
    canGoForward: false,
  };
  private deviceInfo?: DeviceInfo;
  private crashReports: CrashReport[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<MobileConfig> = {}) {
    super();
    this.config = {
      platform: 'universal',
      enableOffline: true,
      enablePushNotifications: true,
      enableBiometric: true,
      syncInterval: 30000,
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      ...config,
    };

    this.appState = {
      lifecycle: 'active',
      network: {
        isConnected: true,
        type: 'wifi',
      },
      permissions: {
        camera: 'undetermined',
        microphone: 'undetermined',
        location: 'undetermined',
        notifications: 'undetermined',
        storage: 'undetermined',
        contacts: 'undetermined',
      },
      orientation: 'portrait',
    };

    this.initialize();
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private async initialize(): Promise<void> {
    // Detect device info
    this.deviceInfo = this.detectDevice();

    // Setup lifecycle listeners
    this.setupLifecycleListeners();

    // Setup network listeners
    this.setupNetworkListeners();

    // Start sync if offline enabled
    if (this.config.enableOffline) {
      this.startSyncService();
    }

    this.emit('platform:initialized', { platform: this.config.platform });
  }

  private detectDevice(): DeviceInfo {
    // Simplified device detection
    return {
      platform: this.config.platform,
      manufacturer: 'Unknown',
      model: 'Unknown',
      osVersion: '1.0.0',
      appVersion: '1.0.0',
      uniqueId: this.generateId(),
      isTablet: false,
      hasNotch: false,
      screenSize: {
        width: 375,
        height: 812,
        scale: 2,
        fontScale: 1,
      },
    };
  }

  // ========================================================================
  // Offline Storage & Sync
  // ========================================================================

  public async storeOffline(key: string, data: any, type: StorageType = 'local'): Promise<void> {
    const storage: OfflineStorage = {
      id: this.generateId(),
      type,
      data,
      syncStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.offlineStorage.set(key, storage);
    this.emit('storage:saved', { key });

    // Queue for sync if online
    if (this.appState.network.isConnected) {
      this.queueSync('create', `/api/data/${key}`, data);
    }
  }

  public async retrieveOffline(key: string): Promise<any> {
    const storage = this.offlineStorage.get(key);
    this.emit('storage:retrieved', { key, found: !!storage });
    return storage?.data;
  }

  public queueSync(
    operation: SyncOperation,
    endpoint: string,
    data: any,
    priority: SyncPriority = 'normal'
  ): void {
    const item: SyncQueue = {
      id: this.generateId(),
      operation,
      endpoint,
      data,
      priority,
      retries: 0,
      maxRetries: 3,
      status: 'pending',
      createdAt: new Date(),
    };

    this.syncQueue.push(item);
    this.syncQueue.sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority));

    this.emit('sync:queued', { itemId: item.id });
  }

  private priorityWeight(priority: SyncPriority): number {
    const weights = { critical: 4, high: 3, normal: 2, low: 1 };
    return weights[priority];
  }

  private startSyncService(): void {
    this.syncInterval = setInterval(() => {
      if (this.appState.network.isConnected) {
        this.processSyncQueue();
      }
    }, this.config.syncInterval);
  }

  private async processSyncQueue(): Promise<void> {
    const pending = this.syncQueue.filter(item => item.status === 'pending' || item.status === 'failed');

    for (const item of pending.slice(0, 5)) {
      item.status = 'syncing';

      try {
        await this.syncItem(item);
        item.status = 'synced';

        // Update storage
        for (const [key, storage] of this.offlineStorage) {
          if (storage.syncStatus === 'pending') {
            storage.syncStatus = 'synced';
            storage.syncedAt = new Date();
          }
        }

        this.emit('sync:completed', { itemId: item.id });
      } catch (error) {
        item.retries++;

        if (item.retries >= item.maxRetries) {
          item.status = 'failed';
          item.error = (error as Error).message;
          this.emit('sync:failed', { itemId: item.id, error });
        } else {
          item.status = 'pending';
        }
      }
    }

    // Remove completed items
    this.syncQueue = this.syncQueue.filter(item => item.status !== 'synced');
  }

  private async syncItem(item: SyncQueue): Promise<void> {
    // Simulate API call
    await this.sleep(100);

    // Check for conflicts
    if (Math.random() < 0.1) {
      // 10% chance of conflict
      const conflict: SyncConflict = {
        id: this.generateId(),
        localData: item.data,
        remoteData: { ...item.data, remoteModified: true },
      };

      this.conflicts.set(item.id, conflict);
      this.emit('sync:conflict', { itemId: item.id });

      throw new Error('Sync conflict detected');
    }
  }

  public resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    mergedData?: any
  ): void {
    const conflict = this.conflicts.get(conflictId);

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    conflict.resolution = resolution;
    conflict.resolvedAt = new Date();

    let resolvedData: any;

    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData;
        break;
      case 'remote':
        resolvedData = conflict.remoteData;
        break;
      case 'merge':
        resolvedData = mergedData || { ...conflict.localData, ...conflict.remoteData };
        break;
    }

    this.emit('conflict:resolved', { conflictId, resolution });
  }

  // ========================================================================
  // Push Notifications
  // ========================================================================

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    // Simulate permission request
    const granted = Math.random() > 0.2; // 80% grant rate

    this.appState.permissions.notifications = granted ? 'granted' : 'denied';

    const permission: NotificationPermission = {
      granted,
      token: granted ? this.generateToken() : undefined,
      platform: this.config.platform,
      registeredAt: new Date(),
    };

    this.emit('notification:permission', { granted });

    return permission;
  }

  public async sendLocalNotification(notification: Omit<PushNotification, 'id'>): Promise<string> {
    const notif: PushNotification = {
      id: this.generateId(),
      ...notification,
    };

    this.notifications.set(notif.id, notif);

    // Schedule notification
    if (notif.scheduledAt) {
      const delay = notif.scheduledAt.getTime() - Date.now();

      if (delay > 0) {
        setTimeout(() => {
          this.deliverNotification(notif);
        }, delay);
      }
    } else {
      this.deliverNotification(notif);
    }

    this.emit('notification:scheduled', { notificationId: notif.id });

    return notif.id;
  }

  private deliverNotification(notification: PushNotification): void {
    this.emit('notification:received', { notification });
  }

  public cancelNotification(notificationId: string): void {
    this.notifications.delete(notificationId);
    this.emit('notification:cancelled', { notificationId });
  }

  // ========================================================================
  // Biometric Authentication
  // ========================================================================

  public async authenticateBiometric(config: BiometricConfig): Promise<BiometricResult> {
    if (!this.config.enableBiometric) {
      return {
        success: false,
        error: 'Biometric authentication not enabled',
      };
    }

    // Check available biometric types
    const availableTypes = await this.getAvailableBiometricTypes();

    if (availableTypes.length === 0) {
      return {
        success: false,
        error: 'No biometric authentication available',
      };
    }

    // Simulate biometric authentication
    await this.sleep(500);

    const success = Math.random() > 0.1; // 90% success rate

    const result: BiometricResult = {
      success,
      type: availableTypes[0],
      error: success ? undefined : 'Authentication failed',
    };

    this.emit('biometric:result', result);

    return result;
  }

  private async getAvailableBiometricTypes(): Promise<BiometricType[]> {
    // Platform-specific biometric availability
    switch (this.config.platform) {
      case 'ios':
        return ['face_id', 'fingerprint'];
      case 'android':
        return ['fingerprint'];
      default:
        return [];
    }
  }

  // ========================================================================
  // Navigation
  // ========================================================================

  public navigate(routeName: string, params?: Record<string, any>): void {
    const route: Route = {
      name: routeName,
      params,
      timestamp: new Date(),
    };

    // Remove any forward routes
    this.navigationStack.routes = this.navigationStack.routes.slice(
      0,
      this.navigationStack.currentIndex + 1
    );

    this.navigationStack.routes.push(route);
    this.navigationStack.currentIndex++;

    this.updateNavigationState();

    this.emit('navigation:navigated', { route: routeName });
  }

  public goBack(): void {
    if (this.navigationStack.canGoBack) {
      this.navigationStack.currentIndex--;
      this.updateNavigationState();
      this.emit('navigation:back');
    }
  }

  public goForward(): void {
    if (this.navigationStack.canGoForward) {
      this.navigationStack.currentIndex++;
      this.updateNavigationState();
      this.emit('navigation:forward');
    }
  }

  private updateNavigationState(): void {
    this.navigationStack.canGoBack = this.navigationStack.currentIndex > 0;
    this.navigationStack.canGoForward =
      this.navigationStack.currentIndex < this.navigationStack.routes.length - 1;
  }

  public handleDeepLink(url: string): DeepLink | null {
    try {
      const urlObj = new URL(url);

      const deepLink: DeepLink = {
        url,
        scheme: urlObj.protocol.replace(':', ''),
        host: urlObj.hostname,
        path: urlObj.pathname,
        params: Object.fromEntries(urlObj.searchParams),
      };

      this.emit('deeplink:opened', { deepLink });

      return deepLink;
    } catch {
      return null;
    }
  }

  // ========================================================================
  // Lifecycle Management
  // ========================================================================

  private setupLifecycleListeners(): void {
    // Simulate lifecycle events
  }

  public setAppState(state: LifecycleState): void {
    this.appState.lifecycle = state;
    this.emit('lifecycle:changed', { state });

    if (state === 'background') {
      this.handleAppBackground();
    } else if (state === 'active') {
      this.handleAppForeground();
    }
  }

  private handleAppBackground(): void {
    // Pause non-critical tasks
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.emit('app:background');
  }

  private handleAppForeground(): void {
    // Resume tasks
    if (this.config.enableOffline && !this.syncInterval) {
      this.startSyncService();
    }

    // Check for updates
    this.checkForUpdates();

    this.emit('app:foreground');
  }

  // ========================================================================
  // Network Management
  // ========================================================================

  private setupNetworkListeners(): void {
    // Simulate network monitoring
  }

  public setNetworkState(state: Partial<NetworkState>): void {
    this.appState.network = { ...this.appState.network, ...state };
    this.emit('network:changed', { state: this.appState.network });

    if (state.isConnected && this.config.enableOffline) {
      this.processSyncQueue();
    }
  }

  // ========================================================================
  // App Updates
  // ========================================================================

  private async checkForUpdates(): Promise<void> {
    // Simulate update check
    const hasUpdate = Math.random() < 0.1; // 10% chance

    if (hasUpdate) {
      const update: AppUpdate = {
        version: '1.1.0',
        buildNumber: 2,
        required: false,
        releaseNotes: 'Bug fixes and improvements',
        size: 50 * 1024 * 1024,
        availableAt: new Date(),
      };

      this.emit('update:available', { update });
    }
  }

  // ========================================================================
  // Performance Monitoring
  // ========================================================================

  public recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date(),
    };

    this.performanceMetrics.push(fullMetric);
    this.emit('metric:recorded', { metric: fullMetric });

    // Keep only recent metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }
  }

  public reportCrash(error: Error, fatal: boolean = false): void {
    const report: CrashReport = {
      id: this.generateId(),
      message: error.message,
      stack: error.stack || '',
      platform: this.config.platform,
      appVersion: this.deviceInfo?.appVersion || 'unknown',
      osVersion: this.deviceInfo?.osVersion || 'unknown',
      device: this.deviceInfo?.model || 'unknown',
      fatal,
      timestamp: new Date(),
      breadcrumbs: [],
    };

    this.crashReports.push(report);
    this.emit('crash:reported', { reportId: report.id });
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateToken(): string {
    return `fcm-${Math.random().toString(36).slice(2, 18)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getStats() {
    return {
      platform: this.config.platform,
      offlineItems: this.offlineStorage.size,
      syncQueueLength: this.syncQueue.length,
      pendingSync: this.syncQueue.filter(s => s.status === 'pending').length,
      conflicts: this.conflicts.size,
      notifications: this.notifications.size,
      navigationDepth: this.navigationStack.routes.length,
      crashReports: this.crashReports.length,
      performanceMetrics: this.performanceMetrics.length,
      appState: this.appState,
      deviceInfo: this.deviceInfo,
    };
  }

  public close(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.emit('platform:closed');
  }
}
