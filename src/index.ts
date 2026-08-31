/**
 * Main Application Entry Point
 * Coordinates all major systems and provides unified API
 */

import { EventEmitter } from 'events';

// Import all managers
import AnalyticsManager from './analytics/AnalyticsManager';
import APIGateway from './network/APIGateway';
import DatabasePoolManager from './database/DatabasePoolManager';
import IntegrationTestFramework from './testing/IntegrationTestFramework';
import ObservabilityManager from './monitoring/ObservabilityManager';
import CodeGenerator from './codegen/CodeGenerator';
import PluginManager from './plugins/PluginManager';
import WorkflowOrchestrator from './workflow/WorkflowOrchestrator';
import EventSourcingManager from './eventsourcing/EventSourcingManager';
import MLManager from './ml/MLManager';
import BlockchainManager from './blockchain/BlockchainManager';
import SearchManager from './search/SearchManager';
import MessageQueueManager from './messaging/MessageQueueManager';
import CollaborationManager from './collaboration/CollaborationManager';
import ConfigManager from './config/ConfigManager';
import CacheManager from './caching/CacheManager';
import GraphQLServerManager from './graphql/GraphQLServerManager';
import NotificationManager from './notifications/NotificationManager';
import SchedulerManager from './scheduler/SchedulerManager';
import APIDocGenerator from './apidocs/APIDocGenerator';
import ValidationManager from './validation/ValidationManager';
import ResourceManager from './resources/ResourceManager';
import AuditManager from './audit/AuditManager';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AgentCLIConfig {
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAllModules: boolean;
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  modules: Map<string, ModuleStatus>;
  uptime: number;
  version: string;
  timestamp: number;
}

export interface ModuleStatus {
  name: string;
  enabled: boolean;
  healthy: boolean;
  stats?: any;
  lastError?: string;
}

// ============================================================================
// Main Agent CLI Application
// ============================================================================

export class AgentCLI extends EventEmitter {
  private configData: AgentCLIConfig;
  private startTime: number;
  private version: string = '1.0.0';

  // All system managers
  public analytics: AnalyticsManager;
  public apiGateway: APIGateway;
  public database: DatabasePoolManager;
  public testing: IntegrationTestFramework;
  public observability: ObservabilityManager;
  public codegen: CodeGenerator;
  public plugins: PluginManager;
  public workflow: WorkflowOrchestrator;
  public eventSourcing: EventSourcingManager;
  public ml: MLManager;
  public blockchain: BlockchainManager;
  public search: SearchManager;
  public messaging: MessageQueueManager;
  public collaboration: CollaborationManager;
  public configManager: ConfigManager;
  public cache: CacheManager;
  public graphql: GraphQLServerManager;
  public notifications: NotificationManager;
  public scheduler: SchedulerManager;
  public apiDocs: APIDocGenerator;
  public validation: ValidationManager;
  public resources: ResourceManager;
  public audit: AuditManager;

  constructor(config: Partial<AgentCLIConfig> = {}) {
    super();

    this.configData = {
      environment: 'development',
      debug: false,
      logLevel: 'info',
      enableAllModules: true,
      ...config,
    };

    this.startTime = Date.now();

    // Initialize all managers
    this.analytics = new AnalyticsManager();
    this.apiGateway = new APIGateway();
    this.database = new DatabasePoolManager();
    this.testing = new IntegrationTestFramework();
    this.observability = new ObservabilityManager();
    this.codegen = new CodeGenerator();
    this.plugins = new PluginManager();
    this.workflow = new WorkflowOrchestrator();
    this.eventSourcing = new EventSourcingManager();
    this.ml = new MLManager();
    this.blockchain = new BlockchainManager();
    this.search = new SearchManager();
    this.messaging = new MessageQueueManager();
    this.collaboration = new CollaborationManager();
    this.configManager = new ConfigManager();
    this.cache = new CacheManager();
    this.graphql = new GraphQLServerManager();
    this.notifications = new NotificationManager();
    this.scheduler = new SchedulerManager();
    this.apiDocs = new APIDocGenerator();
    this.validation = new ValidationManager();
    this.resources = new ResourceManager();
    this.audit = new AuditManager();

    this.setupEventHandlers();

    this.emit('system:initialized');
  }

  // ========================================================================
  // System Control
  // ========================================================================

  public async start(): Promise<void> {
    this.emit('system:starting');

    // Log system start
    this.audit.log(
      'system',
      'System starting',
      {
        id: 'system',
        type: 'system',
        name: 'Agent CLI',
      },
      {
        level: 'info',
        context: {
          environment: this.configData.environment,
          version: this.version,
        },
      }
    );

    this.emit('system:started');
  }

  public async stop(): Promise<void> {
    this.emit('system:stopping');

    // Log system stop
    this.audit.log(
      'system',
      'System stopping',
      {
        id: 'system',
        type: 'system',
        name: 'Agent CLI',
      },
      {
        level: 'info',
        context: {
          uptime: this.getUptime(),
        },
      }
    );

    this.emit('system:stopped');
  }

  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  // ========================================================================
  // Health & Status
  // ========================================================================

  public getStatus(): SystemStatus {
    const modules = new Map<string, ModuleStatus>();

    // Helper function to safely get stats
    const getStats = (manager: any, name: string): any => {
      try {
        return manager.getStats ? manager.getStats() : {};
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Failed to get stats for ${name}:`, errorMessage);
        this.emit('module:stats_error', { module: name, error: errorMessage });
        return {};
      }
    };

    // Collect status from all modules
    modules.set('analytics', {
      name: 'Analytics Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.analytics, 'analytics'),
    });

    modules.set('apiGateway', {
      name: 'API Gateway',
      enabled: true,
      healthy: true,
      stats: getStats(this.apiGateway, 'apiGateway'),
    });

    modules.set('database', {
      name: 'Database Pool Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.database, 'database'),
    });

    modules.set('testing', {
      name: 'Integration Test Framework',
      enabled: true,
      healthy: true,
      stats: getStats(this.testing, 'testing'),
    });

    modules.set('observability', {
      name: 'Observability Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.observability, 'observability'),
    });

    modules.set('codegen', {
      name: 'Code Generator',
      enabled: true,
      healthy: true,
      stats: getStats(this.codegen, 'codegen'),
    });

    modules.set('plugins', {
      name: 'Plugin Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.plugins, 'plugins'),
    });

    modules.set('workflow', {
      name: 'Workflow Orchestrator',
      enabled: true,
      healthy: true,
      stats: getStats(this.workflow, 'workflow'),
    });

    modules.set('eventSourcing', {
      name: 'Event Sourcing Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.eventSourcing, 'eventSourcing'),
    });

    modules.set('ml', {
      name: 'ML Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.ml, 'ml'),
    });

    modules.set('blockchain', {
      name: 'Blockchain Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.blockchain, 'blockchain'),
    });

    modules.set('search', {
      name: 'Search Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.search, 'search'),
    });

    modules.set('messaging', {
      name: 'Message Queue Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.messaging, 'messaging'),
    });

    modules.set('collaboration', {
      name: 'Collaboration Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.collaboration, 'collaboration'),
    });

    modules.set('configManager', {
      name: 'Config Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.configManager, 'configManager'),
    });

    modules.set('cache', {
      name: 'Cache Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.cache, 'cache'),
    });

    modules.set('graphql', {
      name: 'GraphQL Server Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.graphql, 'graphql'),
    });

    modules.set('notifications', {
      name: 'Notification Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.notifications, 'notifications'),
    });

    modules.set('scheduler', {
      name: 'Scheduler Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.scheduler, 'scheduler'),
    });

    modules.set('apiDocs', {
      name: 'API Doc Generator',
      enabled: true,
      healthy: true,
      stats: getStats(this.apiDocs, 'apiDocs'),
    });

    modules.set('validation', {
      name: 'Validation Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.validation, 'validation'),
    });

    modules.set('resources', {
      name: 'Resource Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.resources, 'resources'),
    });

    modules.set('audit', {
      name: 'Audit Manager',
      enabled: true,
      healthy: true,
      stats: getStats(this.audit, 'audit'),
    });

    // Determine overall system health
    const unhealthyModules = Array.from(modules.values()).filter(m => !m.healthy);
    const status: SystemStatus = {
      status: unhealthyModules.length === 0 ? 'healthy' :
              unhealthyModules.length < 5 ? 'degraded' : 'unhealthy',
      modules,
      uptime: this.getUptime(),
      version: this.version,
      timestamp: Date.now(),
    };

    return status;
  }

  public getUptime(): number {
    return Date.now() - this.startTime;
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  private setupEventHandlers(): void {
    // Forward critical events from all managers
    const managers = [
      this.analytics,
      this.apiGateway,
      this.database,
      this.testing,
      this.observability,
      this.codegen,
      this.plugins,
      this.workflow,
      this.eventSourcing,
      this.ml,
      this.blockchain,
      this.search,
      this.messaging,
      this.collaboration,
      this.configManager,
      this.cache,
      this.graphql,
      this.notifications,
      this.scheduler,
      this.apiDocs,
      this.validation,
      this.resources,
      this.audit,
    ];

    for (const manager of managers) {
      manager.on('error', (error) => {
        this.emit('module:error', { manager: manager.constructor.name, error });
      });
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  public getVersion(): string {
    return this.version;
  }

  public getConfig(): AgentCLIConfig {
    return { ...this.configData };
  }

  public getEnvironment(): string {
    return this.configData.environment;
  }
}

// ============================================================================
// Export
// ============================================================================

export default AgentCLI;
