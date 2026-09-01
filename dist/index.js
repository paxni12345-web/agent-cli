"use strict";
/**
 * Main Application Entry Point
 * Coordinates all major systems and provides unified API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCLI = void 0;
const events_1 = require("events");
// Import all managers
const AnalyticsManager_1 = __importDefault(require("./analytics/AnalyticsManager"));
const APIGateway_1 = __importDefault(require("./network/APIGateway"));
const DatabasePoolManager_1 = __importDefault(require("./database/DatabasePoolManager"));
const IntegrationTestFramework_1 = __importDefault(require("./testing/IntegrationTestFramework"));
const ObservabilityManager_1 = __importDefault(require("./monitoring/ObservabilityManager"));
const CodeGenerator_1 = __importDefault(require("./codegen/CodeGenerator"));
const PluginManager_1 = __importDefault(require("./plugins/PluginManager"));
const WorkflowOrchestrator_1 = __importDefault(require("./workflow/WorkflowOrchestrator"));
const EventSourcingManager_1 = __importDefault(require("./eventsourcing/EventSourcingManager"));
const MLManager_1 = __importDefault(require("./ml/MLManager"));
const BlockchainManager_1 = __importDefault(require("./blockchain/BlockchainManager"));
const SearchManager_1 = __importDefault(require("./search/SearchManager"));
const MessageQueueManager_1 = __importDefault(require("./messaging/MessageQueueManager"));
const CollaborationManager_1 = __importDefault(require("./collaboration/CollaborationManager"));
const ConfigManager_1 = __importDefault(require("./config/ConfigManager"));
const CacheManager_1 = __importDefault(require("./caching/CacheManager"));
const GraphQLServerManager_1 = __importDefault(require("./graphql/GraphQLServerManager"));
const NotificationManager_1 = __importDefault(require("./notifications/NotificationManager"));
const SchedulerManager_1 = __importDefault(require("./scheduler/SchedulerManager"));
const APIDocGenerator_1 = __importDefault(require("./apidocs/APIDocGenerator"));
const ValidationManager_1 = __importDefault(require("./validation/ValidationManager"));
const ResourceManager_1 = __importDefault(require("./resources/ResourceManager"));
const AuditManager_1 = __importDefault(require("./audit/AuditManager"));
// ============================================================================
// Main Agent CLI Application
// ============================================================================
class AgentCLI extends events_1.EventEmitter {
    configData;
    startTime;
    version = '1.0.0';
    // All system managers
    analytics;
    apiGateway;
    database;
    testing;
    observability;
    codegen;
    plugins;
    workflow;
    eventSourcing;
    ml;
    blockchain;
    search;
    messaging;
    collaboration;
    configManager;
    cache;
    graphql;
    notifications;
    scheduler;
    apiDocs;
    validation;
    resources;
    audit;
    constructor(config = {}) {
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
        this.analytics = new AnalyticsManager_1.default();
        this.apiGateway = new APIGateway_1.default();
        this.database = new DatabasePoolManager_1.default();
        this.testing = new IntegrationTestFramework_1.default();
        this.observability = new ObservabilityManager_1.default();
        this.codegen = new CodeGenerator_1.default();
        this.plugins = new PluginManager_1.default();
        this.workflow = new WorkflowOrchestrator_1.default();
        this.eventSourcing = new EventSourcingManager_1.default();
        this.ml = new MLManager_1.default();
        this.blockchain = new BlockchainManager_1.default();
        this.search = new SearchManager_1.default();
        this.messaging = new MessageQueueManager_1.default();
        this.collaboration = new CollaborationManager_1.default();
        this.configManager = new ConfigManager_1.default();
        this.cache = new CacheManager_1.default();
        this.graphql = new GraphQLServerManager_1.default();
        this.notifications = new NotificationManager_1.default();
        this.scheduler = new SchedulerManager_1.default();
        this.apiDocs = new APIDocGenerator_1.default();
        this.validation = new ValidationManager_1.default();
        this.resources = new ResourceManager_1.default();
        this.audit = new AuditManager_1.default();
        this.setupEventHandlers();
        this.emit('system:initialized');
    }
    // ========================================================================
    // System Control
    // ========================================================================
    async start() {
        this.emit('system:starting');
        // Log system start
        this.audit.log('system', 'System starting', {
            id: 'system',
            type: 'system',
            name: 'Agent CLI',
        }, {
            level: 'info',
            context: {
                environment: this.configData.environment,
                version: this.version,
            },
        });
        this.emit('system:started');
    }
    async stop() {
        this.emit('system:stopping');
        // Log system stop
        this.audit.log('system', 'System stopping', {
            id: 'system',
            type: 'system',
            name: 'Agent CLI',
        }, {
            level: 'info',
            context: {
                uptime: this.getUptime(),
            },
        });
        this.emit('system:stopped');
    }
    async restart() {
        await this.stop();
        await this.start();
    }
    // ========================================================================
    // Health & Status
    // ========================================================================
    getStatus() {
        const modules = new Map();
        // Helper function to safely get stats
        const getStats = (manager, name) => {
            try {
                return manager.getStats ? manager.getStats() : {};
            }
            catch (error) {
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
        const status = {
            status: unhealthyModules.length === 0 ? 'healthy' :
                unhealthyModules.length < 5 ? 'degraded' : 'unhealthy',
            modules,
            uptime: this.getUptime(),
            version: this.version,
            timestamp: Date.now(),
        };
        return status;
    }
    getUptime() {
        return Date.now() - this.startTime;
    }
    // ========================================================================
    // Event Handling
    // ========================================================================
    setupEventHandlers() {
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
    getVersion() {
        return this.version;
    }
    getConfig() {
        return { ...this.configData };
    }
    getEnvironment() {
        return this.configData.environment;
    }
}
exports.AgentCLI = AgentCLI;
// ============================================================================
// Export
// ============================================================================
exports.default = AgentCLI;
