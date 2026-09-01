/**
 * Main Application Entry Point
 * Coordinates all major systems and provides unified API
 */
import { EventEmitter } from 'events';
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
export declare class AgentCLI extends EventEmitter {
    private configData;
    private startTime;
    private version;
    analytics: AnalyticsManager;
    apiGateway: APIGateway;
    database: DatabasePoolManager;
    testing: IntegrationTestFramework;
    observability: ObservabilityManager;
    codegen: CodeGenerator;
    plugins: PluginManager;
    workflow: WorkflowOrchestrator;
    eventSourcing: EventSourcingManager;
    ml: MLManager;
    blockchain: BlockchainManager;
    search: SearchManager;
    messaging: MessageQueueManager;
    collaboration: CollaborationManager;
    configManager: ConfigManager;
    cache: CacheManager;
    graphql: GraphQLServerManager;
    notifications: NotificationManager;
    scheduler: SchedulerManager;
    apiDocs: APIDocGenerator;
    validation: ValidationManager;
    resources: ResourceManager;
    audit: AuditManager;
    constructor(config?: Partial<AgentCLIConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    getStatus(): SystemStatus;
    getUptime(): number;
    private setupEventHandlers;
    getVersion(): string;
    getConfig(): AgentCLIConfig;
    getEnvironment(): string;
}
export default AgentCLI;
//# sourceMappingURL=index.d.ts.map