/**
 * PHASE 7: MARKETPLACE & PLUGIN ECOSYSTEM
 * Plugin management, marketplace, and extension system
 *
 * Part of 350K lines goal - PHASE 7
 */
import { EventEmitter } from 'events';
export interface MarketplaceConfig {
    enablePublishing: boolean;
    enableReviews: boolean;
    enablePurchases: boolean;
    moderationRequired: boolean;
    commissionRate: number;
}
export interface Plugin {
    id: string;
    name: string;
    version: string;
    description: string;
    author: Author;
    category: PluginCategory;
    tags: string[];
    price: Price;
    license: License;
    permissions: Permission[];
    dependencies: PluginDependency[];
    manifest: PluginManifest;
    statistics: PluginStatistics;
    status: PluginStatus;
    createdAt: Date;
    updatedAt: Date;
}
export interface Author {
    id: string;
    name: string;
    email: string;
    website?: string;
    verified: boolean;
}
export type PluginCategory = 'productivity' | 'development' | 'design' | 'analytics' | 'communication' | 'security' | 'ai_ml' | 'integration' | 'utility';
export interface Price {
    amount: number;
    currency: string;
    type: PriceType;
    trial?: TrialPeriod;
}
export type PriceType = 'free' | 'one_time' | 'subscription' | 'freemium';
export interface TrialPeriod {
    duration: number;
    unit: TimeUnit;
}
export type TimeUnit = 'days' | 'weeks' | 'months';
export interface License {
    type: LicenseType;
    url?: string;
    commercial: boolean;
    redistribution: boolean;
}
export type LicenseType = 'mit' | 'apache' | 'gpl' | 'proprietary' | 'custom';
export interface Permission {
    type: PermissionType;
    description: string;
    required: boolean;
}
export type PermissionType = 'file_system' | 'network' | 'clipboard' | 'notifications' | 'camera' | 'microphone' | 'location' | 'storage';
export interface PluginDependency {
    name: string;
    version: string;
    optional: boolean;
}
export interface PluginManifest {
    main: string;
    activationEvents: ActivationEvent[];
    contributes: Contributions;
    engines: EngineRequirement[];
}
export interface ActivationEvent {
    type: ActivationType;
    condition?: string;
}
export type ActivationType = 'onStartup' | 'onCommand' | 'onLanguage' | 'onFileType' | 'onEvent';
export interface Contributions {
    commands?: Command[];
    menus?: Menu[];
    keybindings?: Keybinding[];
    themes?: Theme[];
    languages?: LanguageSupport[];
    views?: View[];
}
export interface Command {
    id: string;
    title: string;
    category?: string;
    icon?: string;
    handler: string;
}
export interface Menu {
    id: string;
    label: string;
    items: MenuItem[];
}
export interface MenuItem {
    command: string;
    when?: string;
    group?: string;
}
export interface Keybinding {
    key: string;
    command: string;
    when?: string;
    mac?: string;
    linux?: string;
    windows?: string;
}
export interface Theme {
    id: string;
    label: string;
    type: ThemeType;
    colors: Record<string, string>;
}
export type ThemeType = 'light' | 'dark' | 'high_contrast';
export interface LanguageSupport {
    id: string;
    extensions: string[];
    aliases: string[];
    configuration?: LanguageConfig;
}
export interface LanguageConfig {
    comments?: CommentConfig;
    brackets?: BracketConfig[];
    autoClosingPairs?: AutoClosingPair[];
}
export interface CommentConfig {
    lineComment?: string;
    blockComment?: [string, string];
}
export interface BracketConfig {
    open: string;
    close: string;
}
export interface AutoClosingPair {
    open: string;
    close: string;
    notIn?: string[];
}
export interface View {
    id: string;
    name: string;
    icon?: string;
    when?: string;
}
export interface EngineRequirement {
    name: string;
    version: string;
}
export interface PluginStatistics {
    downloads: number;
    activeInstalls: number;
    rating: number;
    reviews: number;
    lastWeekDownloads: number;
}
export type PluginStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'deprecated';
export interface InstalledPlugin {
    plugin: Plugin;
    version: string;
    enabled: boolean;
    autoUpdate: boolean;
    installedAt: Date;
    lastUsedAt?: Date;
    settings: Record<string, any>;
}
export interface Review {
    id: string;
    pluginId: string;
    userId: string;
    userName: string;
    rating: number;
    title: string;
    content: string;
    helpful: number;
    verified: boolean;
    response?: ReviewResponse;
    createdAt: Date;
    updatedAt: Date;
}
export interface ReviewResponse {
    content: string;
    authorId: string;
    createdAt: Date;
}
export interface Purchase {
    id: string;
    pluginId: string;
    userId: string;
    type: PurchaseType;
    amount: number;
    currency: string;
    status: PurchaseStatus;
    receipt?: string;
    expiresAt?: Date;
    createdAt: Date;
}
export type PurchaseType = 'purchase' | 'subscription' | 'upgrade';
export type PurchaseStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export interface Revenue {
    pluginId: string;
    authorId: string;
    period: RevenuePeriod;
    sales: number;
    gross: number;
    commission: number;
    net: number;
    payouts: Payout[];
}
export interface RevenuePeriod {
    start: Date;
    end: Date;
}
export interface Payout {
    id: string;
    amount: number;
    status: PayoutStatus;
    method: PayoutMethod;
    processedAt?: Date;
}
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PayoutMethod = 'bank_transfer' | 'paypal' | 'stripe' | 'crypto';
export interface Collection {
    id: string;
    name: string;
    description: string;
    plugins: string[];
    featured: boolean;
    curatorId: string;
    createdAt: Date;
}
export interface PluginAPI {
    version: string;
    commands: APICommand[];
    events: APIEvent[];
    services: APIService[];
}
export interface APICommand {
    name: string;
    description: string;
    parameters: APIParameter[];
    returns: APIType;
}
export interface APIEvent {
    name: string;
    description: string;
    payload: APIType;
}
export interface APIService {
    name: string;
    methods: APIMethod[];
}
export interface APIMethod {
    name: string;
    description: string;
    parameters: APIParameter[];
    returns: APIType;
}
export interface APIParameter {
    name: string;
    type: APIType;
    required: boolean;
    description?: string;
}
export interface APIType {
    type: string;
    properties?: Record<string, APIType>;
}
export declare class MarketplaceManager extends EventEmitter {
    private config;
    private plugins;
    private installed;
    private reviews;
    private purchases;
    private collections;
    private revenue;
    constructor(config?: Partial<MarketplaceConfig>);
    publishPlugin(plugin: Omit<Plugin, 'id' | 'statistics' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Plugin>;
    updatePlugin(pluginId: string, updates: Partial<Plugin>): Promise<Plugin>;
    approvePlugin(pluginId: string): Promise<void>;
    searchPlugins(query: string, filters?: PluginFilters): Plugin[];
    private sortPlugins;
    getFeaturedPlugins(): Plugin[];
    getTrendingPlugins(): Plugin[];
    installPlugin(pluginId: string, userId: string): Promise<InstalledPlugin>;
    uninstallPlugin(pluginId: string, userId: string): Promise<void>;
    enablePlugin(pluginId: string, userId: string): void;
    disablePlugin(pluginId: string, userId: string): void;
    submitReview(review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<Review>;
    private updatePluginRating;
    respondToReview(reviewId: string, pluginId: string, response: string, authorId: string): Promise<void>;
    purchasePlugin(pluginId: string, userId: string): Promise<Purchase>;
    private recordRevenue;
    private verifyPurchase;
    createCollection(collection: Omit<Collection, 'id' | 'createdAt'>): Collection;
    getFeaturedCollections(): Collection[];
    private generateId;
    getStats(): {
        totalPlugins: number;
        publishedPlugins: number;
        installedPlugins: number;
        totalReviews: number;
        totalRevenue: number;
        collections: number;
    };
}
export interface PluginFilters {
    category?: PluginCategory;
    priceType?: PriceType;
    minRating?: number;
    sortBy?: SortOption;
}
export type SortOption = 'downloads' | 'rating' | 'recent' | 'name';
//# sourceMappingURL=MarketplaceSystem.d.ts.map