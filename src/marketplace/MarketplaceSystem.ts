/**
 * PHASE 7: MARKETPLACE & PLUGIN ECOSYSTEM
 * Plugin management, marketplace, and extension system
 *
 * Part of 350K lines goal - PHASE 7
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type PluginCategory =
  | 'productivity'
  | 'development'
  | 'design'
  | 'analytics'
  | 'communication'
  | 'security'
  | 'ai_ml'
  | 'integration'
  | 'utility';

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

export type PermissionType =
  | 'file_system'
  | 'network'
  | 'clipboard'
  | 'notifications'
  | 'camera'
  | 'microphone'
  | 'location'
  | 'storage';

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

export type ActivationType =
  | 'onStartup'
  | 'onCommand'
  | 'onLanguage'
  | 'onFileType'
  | 'onEvent';

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

// Installed Plugins
export interface InstalledPlugin {
  plugin: Plugin;
  version: string;
  enabled: boolean;
  autoUpdate: boolean;
  installedAt: Date;
  lastUsedAt?: Date;
  settings: Record<string, any>;
}

// Reviews & Ratings
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

// Purchases & Transactions
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

// Revenue
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

// Collections
export interface Collection {
  id: string;
  name: string;
  description: string;
  plugins: string[];
  featured: boolean;
  curatorId: string;
  createdAt: Date;
}

// Plugin API
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

// ============================================================================
// Marketplace Manager
// ============================================================================

export class MarketplaceManager extends EventEmitter {
  private config: MarketplaceConfig;
  private plugins: Map<string, Plugin> = new Map();
  private installed: Map<string, InstalledPlugin> = new Map();
  private reviews: Map<string, Review[]> = new Map();
  private purchases: Map<string, Purchase[]> = new Map();
  private collections: Map<string, Collection> = new Map();
  private revenue: Map<string, Revenue> = new Map();

  constructor(config: Partial<MarketplaceConfig> = {}) {
    super();
    this.config = {
      enablePublishing: true,
      enableReviews: true,
      enablePurchases: true,
      moderationRequired: true,
      commissionRate: 0.3, // 30%
      ...config,
    };
  }

  // ========================================================================
  // Plugin Publishing
  // ========================================================================

  public async publishPlugin(plugin: Omit<Plugin, 'id' | 'statistics' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Plugin> {
    const fullPlugin: Plugin = {
      id: this.generateId(),
      ...plugin,
      statistics: {
        downloads: 0,
        activeInstalls: 0,
        rating: 0,
        reviews: 0,
        lastWeekDownloads: 0,
      },
      status: this.config.moderationRequired ? 'pending' : 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.plugins.set(fullPlugin.id, fullPlugin);
    this.reviews.set(fullPlugin.id, []);

    this.emit('plugin:published', { pluginId: fullPlugin.id });

    return fullPlugin;
  }

  public async updatePlugin(pluginId: string, updates: Partial<Plugin>): Promise<Plugin> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    Object.assign(plugin, updates);
    plugin.updatedAt = new Date();

    this.emit('plugin:updated', { pluginId });

    return plugin;
  }

  public async approvePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    plugin.status = 'published';
    plugin.updatedAt = new Date();

    this.emit('plugin:approved', { pluginId });
  }

  // ========================================================================
  // Plugin Discovery & Search
  // ========================================================================

  public searchPlugins(query: string, filters?: PluginFilters): Plugin[] {
    let results = Array.from(this.plugins.values());

    // Filter by status
    results = results.filter(p => p.status === 'published');

    // Text search
    if (query) {
      results = results.filter(
        p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        results = results.filter(p => p.category === filters.category);
      }

      if (filters.priceType) {
        results = results.filter(p => p.price.type === filters.priceType);
      }

      if (filters.minRating) {
        results = results.filter(p => p.statistics.rating >= filters.minRating);
      }
    }

    // Sort
    if (filters?.sortBy) {
      results = this.sortPlugins(results, filters.sortBy);
    }

    return results;
  }

  private sortPlugins(plugins: Plugin[], sortBy: SortOption): Plugin[] {
    switch (sortBy) {
      case 'downloads':
        return plugins.sort((a, b) => b.statistics.downloads - a.statistics.downloads);
      case 'rating':
        return plugins.sort((a, b) => b.statistics.rating - a.statistics.rating);
      case 'recent':
        return plugins.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      case 'name':
        return plugins.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return plugins;
    }
  }

  public getFeaturedPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter(p => p.status === 'published')
      .filter(p => p.statistics.rating >= 4.5)
      .slice(0, 10);
  }

  public getTrendingPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter(p => p.status === 'published')
      .sort((a, b) => b.statistics.lastWeekDownloads - a.statistics.lastWeekDownloads)
      .slice(0, 10);
  }

  // ========================================================================
  // Plugin Installation & Management
  // ========================================================================

  public async installPlugin(pluginId: string, userId: string): Promise<InstalledPlugin> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    // Check if purchase required
    if (plugin.price.type !== 'free') {
      const hasPurchase = await this.verifyPurchase(pluginId, userId);

      if (!hasPurchase) {
        throw new Error('Plugin must be purchased first');
      }
    }

    const installed: InstalledPlugin = {
      plugin,
      version: plugin.version,
      enabled: true,
      autoUpdate: true,
      installedAt: new Date(),
      settings: {},
    };

    this.installed.set(`${userId}:${pluginId}`, installed);

    // Update statistics
    plugin.statistics.downloads++;
    plugin.statistics.activeInstalls++;

    this.emit('plugin:installed', { pluginId, userId });

    return installed;
  }

  public async uninstallPlugin(pluginId: string, userId: string): Promise<void> {
    const key = `${userId}:${pluginId}`;
    const installed = this.installed.get(key);

    if (!installed) {
      throw new Error('Plugin not installed');
    }

    this.installed.delete(key);

    // Update statistics
    const plugin = this.plugins.get(pluginId);

    if (plugin) {
      plugin.statistics.activeInstalls--;
    }

    this.emit('plugin:uninstalled', { pluginId, userId });
  }

  public enablePlugin(pluginId: string, userId: string): void {
    const key = `${userId}:${pluginId}`;
    const installed = this.installed.get(key);

    if (!installed) {
      throw new Error('Plugin not installed');
    }

    installed.enabled = true;
    this.emit('plugin:enabled', { pluginId, userId });
  }

  public disablePlugin(pluginId: string, userId: string): void {
    const key = `${userId}:${pluginId}`;
    const installed = this.installed.get(key);

    if (!installed) {
      throw new Error('Plugin not installed');
    }

    installed.enabled = false;
    this.emit('plugin:disabled', { pluginId, userId });
  }

  // ========================================================================
  // Reviews & Ratings
  // ========================================================================

  public async submitReview(review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<Review> {
    const plugin = this.plugins.get(review.pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    const fullReview: Review = {
      id: this.generateId(),
      ...review,
      helpful: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.reviews.has(review.pluginId)) {
      this.reviews.set(review.pluginId, []);
    }

    this.reviews.get(review.pluginId)!.push(fullReview);

    // Update plugin statistics
    this.updatePluginRating(review.pluginId);

    this.emit('review:submitted', { reviewId: fullReview.id });

    return fullReview;
  }

  private updatePluginRating(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    const reviews = this.reviews.get(pluginId);

    if (!plugin || !reviews || reviews.length === 0) {
      return;
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    plugin.statistics.rating = totalRating / reviews.length;
    plugin.statistics.reviews = reviews.length;
  }

  public async respondToReview(reviewId: string, pluginId: string, response: string, authorId: string): Promise<void> {
    const reviews = this.reviews.get(pluginId);

    if (!reviews) {
      throw new Error('Plugin not found');
    }

    const review = reviews.find(r => r.id === reviewId);

    if (!review) {
      throw new Error('Review not found');
    }

    review.response = {
      content: response,
      authorId,
      createdAt: new Date(),
    };

    review.updatedAt = new Date();

    this.emit('review:responded', { reviewId });
  }

  // ========================================================================
  // Purchases & Revenue
  // ========================================================================

  public async purchasePlugin(pluginId: string, userId: string): Promise<Purchase> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    if (plugin.price.type === 'free') {
      throw new Error('Plugin is free');
    }

    const purchase: Purchase = {
      id: this.generateId(),
      pluginId,
      userId,
      type: 'purchase',
      amount: plugin.price.amount,
      currency: plugin.price.currency,
      status: 'completed',
      createdAt: new Date(),
    };

    if (!this.purchases.has(userId)) {
      this.purchases.set(userId, []);
    }

    this.purchases.get(userId)!.push(purchase);

    // Record revenue
    this.recordRevenue(plugin, purchase);

    this.emit('purchase:completed', { purchaseId: purchase.id });

    return purchase;
  }

  private recordRevenue(plugin: Plugin, purchase: Purchase): void {
    const key = `${plugin.id}:${plugin.author.id}`;
    let revenue = this.revenue.get(key);

    if (!revenue) {
      revenue = {
        pluginId: plugin.id,
        authorId: plugin.author.id,
        period: {
          start: new Date(),
          end: new Date(),
        },
        sales: 0,
        gross: 0,
        commission: 0,
        net: 0,
        payouts: [],
      };
      this.revenue.set(key, revenue);
    }

    revenue.sales++;
    revenue.gross += purchase.amount;
    revenue.commission = revenue.gross * this.config.commissionRate;
    revenue.net = revenue.gross - revenue.commission;
  }

  private async verifyPurchase(pluginId: string, userId: string): Promise<boolean> {
    const purchases = this.purchases.get(userId);

    if (!purchases) {
      return false;
    }

    return purchases.some(p => p.pluginId === pluginId && p.status === 'completed');
  }

  // ========================================================================
  // Collections
  // ========================================================================

  public createCollection(collection: Omit<Collection, 'id' | 'createdAt'>): Collection {
    const fullCollection: Collection = {
      id: this.generateId(),
      ...collection,
      createdAt: new Date(),
    };

    this.collections.set(fullCollection.id, fullCollection);
    this.emit('collection:created', { collectionId: fullCollection.id });

    return fullCollection;
  }

  public getFeaturedCollections(): Collection[] {
    return Array.from(this.collections.values()).filter(c => c.featured);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  public getStats() {
    return {
      totalPlugins: this.plugins.size,
      publishedPlugins: Array.from(this.plugins.values()).filter(
        p => p.status === 'published'
      ).length,
      installedPlugins: this.installed.size,
      totalReviews: Array.from(this.reviews.values()).reduce(
        (sum, reviews) => sum + reviews.length,
        0
      ),
      totalRevenue: Array.from(this.revenue.values()).reduce((sum, r) => sum + r.gross, 0),
      collections: this.collections.size,
    };
  }
}

// Helper Types
export interface PluginFilters {
  category?: PluginCategory;
  priceType?: PriceType;
  minRating?: number;
  sortBy?: SortOption;
}

export type SortOption = 'downloads' | 'rating' | 'recent' | 'name';
