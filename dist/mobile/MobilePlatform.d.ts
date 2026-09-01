/**
 * PHASE 4: MOBILE & CROSS-PLATFORM SYSTEM
 * React Native, PWA, Electron, and offline-first architecture
 *
 * Part of 350K lines goal - PHASE 4
 */
import { EventEmitter } from 'events';
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
export declare class MobilePlatformManager extends EventEmitter {
    private config;
    private appState;
    private offlineStorage;
    private syncQueue;
    private conflicts;
    private notifications;
    private navigationStack;
    private deviceInfo?;
    private crashReports;
    private performanceMetrics;
    private syncInterval;
    constructor(config?: Partial<MobileConfig>);
    private initialize;
    private detectDevice;
    storeOffline(key: string, data: any, type?: StorageType): Promise<void>;
    retrieveOffline(key: string): Promise<any>;
    queueSync(operation: SyncOperation, endpoint: string, data: any, priority?: SyncPriority): void;
    private priorityWeight;
    private startSyncService;
    private processSyncQueue;
    private syncItem;
    resolveConflict(conflictId: string, resolution: ConflictResolution, mergedData?: any): void;
    requestNotificationPermission(): Promise<NotificationPermission>;
    sendLocalNotification(notification: Omit<PushNotification, 'id'>): Promise<string>;
    private deliverNotification;
    cancelNotification(notificationId: string): void;
    authenticateBiometric(config: BiometricConfig): Promise<BiometricResult>;
    private getAvailableBiometricTypes;
    navigate(routeName: string, params?: Record<string, any>): void;
    goBack(): void;
    goForward(): void;
    private updateNavigationState;
    handleDeepLink(url: string): DeepLink | null;
    private setupLifecycleListeners;
    setAppState(state: LifecycleState): void;
    private handleAppBackground;
    private handleAppForeground;
    private setupNetworkListeners;
    setNetworkState(state: Partial<NetworkState>): void;
    private checkForUpdates;
    recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void;
    reportCrash(error: Error, fatal?: boolean): void;
    private generateId;
    private generateToken;
    private sleep;
    getStats(): {
        platform: Platform;
        offlineItems: number;
        syncQueueLength: number;
        pendingSync: number;
        conflicts: number;
        notifications: number;
        navigationDepth: number;
        crashReports: number;
        performanceMetrics: number;
        appState: AppState;
        deviceInfo: DeviceInfo | undefined;
    };
    close(): void;
}
//# sourceMappingURL=MobilePlatform.d.ts.map