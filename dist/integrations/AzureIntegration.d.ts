/**
 * AzureIntegration - Complete Microsoft Azure SDK Integration
 * Production-ready implementation with full Azure services support
 */
import { EventEmitter } from 'events';
export interface AzureCredentials {
    subscriptionId?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    storageAccountName?: string;
    storageAccountKey?: string;
    cosmosEndpoint?: string;
    cosmosKey?: string;
    serviceBusConnectionString?: string;
    eventHubConnectionString?: string;
    keyVaultUrl?: string;
    cognitiveServicesKey?: string;
    cognitiveServicesEndpoint?: string;
}
export interface AzureConfig {
    credentials: AzureCredentials;
    region?: string;
    timeout?: number;
    retryAttempts?: number;
    enableLogging?: boolean;
}
export interface BlobUploadOptions {
    containerName: string;
    blobName: string;
    content: Buffer | string;
    contentType?: string;
    metadata?: Record<string, string>;
    tier?: 'Hot' | 'Cool' | 'Archive';
}
export interface BlobDownloadOptions {
    containerName: string;
    blobName: string;
}
export interface CosmosDocumentOptions {
    databaseId: string;
    containerId: string;
    document: any;
    partitionKey?: string;
}
export interface CosmosQueryOptions {
    databaseId: string;
    containerId: string;
    query: string;
    parameters?: Array<{
        name: string;
        value: any;
    }>;
}
export interface FunctionDeployOptions {
    resourceGroupName: string;
    functionAppName: string;
    runtime: 'node' | 'python' | 'dotnet' | 'java';
    runtimeVersion: string;
    code: Buffer | string;
    handler?: string;
    environment?: Record<string, string>;
}
export interface ServiceBusMessageOptions {
    queueOrTopicName: string;
    message: any;
    sessionId?: string;
    messageId?: string;
    contentType?: string;
    timeToLive?: number;
}
export interface EventHubEventOptions {
    eventHubName: string;
    events: any[];
    partitionKey?: string;
}
export interface SecretOptions {
    secretName: string;
    value?: string;
    contentType?: string;
    tags?: Record<string, string>;
}
export interface ContainerInstanceOptions {
    resourceGroupName: string;
    containerGroupName: string;
    image: string;
    cpu: number;
    memoryInGb: number;
    environmentVariables?: Record<string, string>;
    ports?: number[];
    command?: string[];
}
export interface SqlDatabaseOptions {
    resourceGroupName: string;
    serverName: string;
    databaseName: string;
    edition?: string;
    requestedServiceObjectiveName?: string;
}
export interface TextAnalysisOptions {
    documents: Array<{
        id: string;
        text: string;
        language?: string;
    }>;
    operation: 'sentiment' | 'keyPhrases' | 'entities' | 'language';
}
export interface VisionAnalysisOptions {
    imageUrl?: string;
    imageBuffer?: Buffer;
    features: Array<'Categories' | 'Description' | 'Tags' | 'Faces' | 'Objects' | 'Brands'>;
}
export declare class AzureIntegration extends EventEmitter {
    private config;
    private credential;
    private blobServiceClient?;
    private cosmosClient?;
    private serviceBusClient?;
    private eventHubProducerClients;
    private secretClient?;
    private keyClient?;
    private containerInstanceClient?;
    private sqlManagementClient?;
    private textAnalyticsClient?;
    private computerVisionClient?;
    private webSiteManagementClient?;
    private serviceBusSenders;
    private serviceBusReceivers;
    private isInitialized;
    constructor(config: AzureConfig);
    /**
     * Initialize Azure services
     */
    initialize(): Promise<void>;
    /**
     * Upload blob to Azure Blob Storage
     */
    uploadBlob(options: BlobUploadOptions): Promise<{
        url: string;
        etag: string;
    }>;
    /**
     * Download blob from Azure Blob Storage
     */
    downloadBlob(options: BlobDownloadOptions): Promise<Buffer>;
    /**
     * List blobs in a container
     */
    listBlobs(containerName: string, prefix?: string): Promise<Array<{
        name: string;
        size: number;
        lastModified: Date;
    }>>;
    /**
     * Delete blob from Azure Blob Storage
     */
    deleteBlob(containerName: string, blobName: string): Promise<void>;
    /**
     * Create container
     */
    createContainer(containerName: string, access?: 'blob' | 'container'): Promise<void>;
    /**
     * Create or replace document in Cosmos DB
     */
    createDocument(options: CosmosDocumentOptions): Promise<any>;
    /**
     * Read document from Cosmos DB
     */
    readDocument(databaseId: string, containerId: string, documentId: string, partitionKey: any): Promise<any>;
    /**
     * Query documents in Cosmos DB
     */
    queryDocuments(options: CosmosQueryOptions): Promise<any[]>;
    /**
     * Update document in Cosmos DB
     */
    updateDocument(databaseId: string, containerId: string, documentId: string, partitionKey: any, updates: any): Promise<any>;
    /**
     * Delete document from Cosmos DB
     */
    deleteDocument(databaseId: string, containerId: string, documentId: string, partitionKey: any): Promise<void>;
    /**
     * Create Cosmos DB database
     */
    createDatabase(databaseId: string, throughput?: number): Promise<void>;
    /**
     * Create Cosmos DB container
     */
    createCosmosContainer(databaseId: string, containerId: string, partitionKey: string): Promise<void>;
    private getCosmosContainer;
    /**
     * Deploy Azure Function
     */
    deployFunction(options: FunctionDeployOptions): Promise<{
        id: string;
        defaultHostName: string;
    }>;
    /**
     * Invoke Azure Function
     */
    invokeFunction(resourceGroupName: string, functionAppName: string, functionName: string, data: any): Promise<any>;
    /**
     * List Azure Functions
     */
    listFunctions(resourceGroupName: string, functionAppName: string): Promise<any[]>;
    /**
     * Send message to Service Bus queue or topic
     */
    sendServiceBusMessage(options: ServiceBusMessageOptions): Promise<void>;
    /**
     * Receive messages from Service Bus queue
     */
    receiveServiceBusMessages(queueName: string, maxMessages?: number): Promise<any[]>;
    /**
     * Send events to Event Hub
     */
    sendEventHubEvents(options: EventHubEventOptions): Promise<void>;
    /**
     * Receive events from Event Hub
     */
    receiveEventHubEvents(eventHubName: string, consumerGroup: string, onEvent: (event: any) => Promise<void>, maxWaitTimeInSeconds?: number): Promise<void>;
    /**
     * Set secret in Key Vault
     */
    setSecret(options: SecretOptions): Promise<void>;
    /**
     * Get secret from Key Vault
     */
    getSecret(secretName: string): Promise<string>;
    /**
     * Delete secret from Key Vault
     */
    deleteSecret(secretName: string): Promise<void>;
    /**
     * List secrets in Key Vault
     */
    listSecrets(): Promise<Array<{
        name: string;
        enabled: boolean;
    }>>;
    /**
     * Create and start container instance
     */
    createContainerInstance(options: ContainerInstanceOptions): Promise<{
        id: string;
        ipAddress?: string;
    }>;
    /**
     * Delete container instance
     */
    deleteContainerInstance(resourceGroupName: string, containerGroupName: string): Promise<void>;
    /**
     * Get container instance status
     */
    getContainerInstanceStatus(resourceGroupName: string, containerGroupName: string): Promise<any>;
    /**
     * Create SQL Database
     */
    createSqlDatabase(options: SqlDatabaseOptions): Promise<{
        id: string;
        name: string;
    }>;
    /**
     * Delete SQL Database
     */
    deleteSqlDatabase(resourceGroupName: string, serverName: string, databaseName: string): Promise<void>;
    /**
     * List SQL Databases
     */
    listSqlDatabases(resourceGroupName: string, serverName: string): Promise<any[]>;
    /**
     * Analyze text using Text Analytics
     */
    analyzeText(options: TextAnalysisOptions): Promise<any>;
    /**
     * Analyze image using Computer Vision
     */
    analyzeImage(options: VisionAnalysisOptions): Promise<any>;
    /**
     * Extract text from image (OCR)
     */
    extractTextFromImage(imageUrl: string): Promise<string>;
    private ensureInitialized;
    private log;
    private handleError;
    /**
     * Cleanup and close all connections
     */
    shutdown(): Promise<void>;
    /**
     * Get current configuration
     */
    getConfig(): AzureConfig;
    /**
     * Check if a service is configured
     */
    isServiceConfigured(service: string): boolean;
}
export default AzureIntegration;
//# sourceMappingURL=AzureIntegration.d.ts.map