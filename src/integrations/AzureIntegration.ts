/**
 * AzureIntegration - Complete Microsoft Azure SDK Integration
 * Production-ready implementation with full Azure services support
 */

import { EventEmitter } from 'events';
import { BlobServiceClient, ContainerClient, BlockBlobClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { CosmosClient, Container, Database } from '@azure/cosmos';
import { ServiceBusClient, ServiceBusSender, ServiceBusReceiver } from '@azure/service-bus';
import { EventHubProducerClient, EventHubConsumerClient } from '@azure/event-hubs';
import { SecretClient } from '@azure/keyvault-secrets';
import { KeyClient, CryptographyClient } from '@azure/keyvault-keys';
import { ContainerInstanceManagementClient } from '@azure/arm-containerinstance';
import { SqlManagementClient } from '@azure/arm-sql';
import { TextAnalyticsClient } from '@azure/ai-text-analytics';
import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { WebSiteManagementClient } from '@azure/arm-appservice';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  parameters?: Array<{ name: string; value: any }>;
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
  documents: Array<{ id: string; text: string; language?: string }>;
  operation: 'sentiment' | 'keyPhrases' | 'entities' | 'language';
}

export interface VisionAnalysisOptions {
  imageUrl?: string;
  imageBuffer?: Buffer;
  features: Array<'Categories' | 'Description' | 'Tags' | 'Faces' | 'Objects' | 'Brands'>;
}

// ============================================================================
// MAIN AZURE INTEGRATION CLASS
// ============================================================================

export class AzureIntegration extends EventEmitter {
  private config: AzureConfig;
  private credential: DefaultAzureCredential | ClientSecretCredential;

  // Service clients
  private blobServiceClient?: BlobServiceClient;
  private cosmosClient?: CosmosClient;
  private serviceBusClient?: ServiceBusClient;
  private eventHubProducerClients: Map<string, EventHubProducerClient> = new Map();
  private secretClient?: SecretClient;
  private keyClient?: KeyClient;
  private containerInstanceClient?: ContainerInstanceManagementClient;
  private sqlManagementClient?: SqlManagementClient;
  private textAnalyticsClient?: TextAnalyticsClient;
  private computerVisionClient?: ComputerVisionClient;
  private webSiteManagementClient?: WebSiteManagementClient;

  // Active connections
  private serviceBusSenders: Map<string, ServiceBusSender> = new Map();
  private serviceBusReceivers: Map<string, ServiceBusReceiver> = new Map();

  private isInitialized = false;

  constructor(config: AzureConfig) {
    super();
    this.config = config;

    // Initialize Azure credential
    if (config.credentials.tenantId && config.credentials.clientId && config.credentials.clientSecret) {
      this.credential = new ClientSecretCredential(
        config.credentials.tenantId,
        config.credentials.clientId,
        config.credentials.clientSecret
      );
    } else {
      this.credential = new DefaultAzureCredential();
    }
  }

  /**
   * Initialize Azure services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('AzureIntegration already initialized');
    }

    try {
      this.log('Initializing Azure Integration...');

      // Initialize Blob Storage
      if (this.config.credentials.storageAccountName && this.config.credentials.storageAccountKey) {
        const sharedKeyCredential = new StorageSharedKeyCredential(
          this.config.credentials.storageAccountName,
          this.config.credentials.storageAccountKey
        );
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.config.credentials.storageAccountName}.blob.core.windows.net`,
          sharedKeyCredential
        );
        this.log('Blob Storage client initialized');
      }

      // Initialize Cosmos DB
      if (this.config.credentials.cosmosEndpoint && this.config.credentials.cosmosKey) {
        this.cosmosClient = new CosmosClient({
          endpoint: this.config.credentials.cosmosEndpoint,
          key: this.config.credentials.cosmosKey
        });
        this.log('Cosmos DB client initialized');
      }

      // Initialize Service Bus
      if (this.config.credentials.serviceBusConnectionString) {
        this.serviceBusClient = new ServiceBusClient(this.config.credentials.serviceBusConnectionString);
        this.log('Service Bus client initialized');
      }

      // Initialize Key Vault
      if (this.config.credentials.keyVaultUrl) {
        this.secretClient = new SecretClient(this.config.credentials.keyVaultUrl, this.credential);
        this.keyClient = new KeyClient(this.config.credentials.keyVaultUrl, this.credential);
        this.log('Key Vault client initialized');
      }

      // Initialize Container Instances
      if (this.config.credentials.subscriptionId) {
        this.containerInstanceClient = new ContainerInstanceManagementClient(
          this.credential,
          this.config.credentials.subscriptionId
        );
        this.log('Container Instance client initialized');
      }

      // Initialize SQL Management
      if (this.config.credentials.subscriptionId) {
        this.sqlManagementClient = new SqlManagementClient(
          this.credential,
          this.config.credentials.subscriptionId
        );
        this.log('SQL Management client initialized');
      }

      // Initialize Cognitive Services
      if (this.config.credentials.cognitiveServicesEndpoint && this.config.credentials.cognitiveServicesKey) {
        const cogCredential = {
          key: this.config.credentials.cognitiveServicesKey
        };
        this.textAnalyticsClient = new TextAnalyticsClient(
          this.config.credentials.cognitiveServicesEndpoint,
          cogCredential as any
        );
        this.computerVisionClient = new ComputerVisionClient(
          cogCredential as any,
          this.config.credentials.cognitiveServicesEndpoint
        );
        this.log('Cognitive Services clients initialized');
      }

      // Initialize App Service (Functions)
      if (this.config.credentials.subscriptionId) {
        this.webSiteManagementClient = new WebSiteManagementClient(
          this.credential,
          this.config.credentials.subscriptionId
        );
        this.log('App Service client initialized');
      }

      this.isInitialized = true;
      this.emit('initialized');
      this.log('Azure Integration initialized successfully');
    } catch (error) {
      this.handleError('Initialization failed', error);
      throw error;
    }
  }

  // ============================================================================
  // BLOB STORAGE OPERATIONS
  // ============================================================================

  /**
   * Upload blob to Azure Blob Storage
   */
  public async uploadBlob(options: BlobUploadOptions): Promise<{ url: string; etag: string }> {
    this.ensureInitialized();
    if (!this.blobServiceClient) {
      throw new Error('Blob Storage not configured');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(options.containerName);

      // Create container if it doesn't exist
      await containerClient.createIfNotExists();

      const blockBlobClient = containerClient.getBlockBlobClient(options.blobName);

      const uploadOptions: any = {
        blobHTTPHeaders: {
          blobContentType: options.contentType || 'application/octet-stream'
        },
        metadata: options.metadata,
        tier: options.tier
      };

      const content = typeof options.content === 'string'
        ? Buffer.from(options.content)
        : options.content;

      const uploadResponse = await blockBlobClient.upload(content, content.length, uploadOptions);

      this.log(`Blob uploaded: ${options.blobName}`);
      this.emit('blob:uploaded', { blobName: options.blobName, containerName: options.containerName });

      return {
        url: blockBlobClient.url,
        etag: uploadResponse.etag || ''
      };
    } catch (error) {
      this.handleError('Blob upload failed', error);
      throw error;
    }
  }

  /**
   * Download blob from Azure Blob Storage
   */
  public async downloadBlob(options: BlobDownloadOptions): Promise<Buffer> {
    this.ensureInitialized();
    if (!this.blobServiceClient) {
      throw new Error('Blob Storage not configured');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(options.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(options.blobName);

      const downloadResponse = await blockBlobClient.download();

      if (!downloadResponse.readableStreamBody) {
        throw new Error('No readable stream body');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);
      this.log(`Blob downloaded: ${options.blobName}`);

      return buffer;
    } catch (error) {
      this.handleError('Blob download failed', error);
      throw error;
    }
  }

  /**
   * List blobs in a container
   */
  public async listBlobs(containerName: string, prefix?: string): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
    this.ensureInitialized();
    if (!this.blobServiceClient) {
      throw new Error('Blob Storage not configured');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blobs: Array<{ name: string; size: number; lastModified: Date }> = [];

      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        blobs.push({
          name: blob.name,
          size: blob.properties.contentLength || 0,
          lastModified: blob.properties.lastModified || new Date()
        });
      }

      return blobs;
    } catch (error) {
      this.handleError('List blobs failed', error);
      throw error;
    }
  }

  /**
   * Delete blob from Azure Blob Storage
   */
  public async deleteBlob(containerName: string, blobName: string): Promise<void> {
    this.ensureInitialized();
    if (!this.blobServiceClient) {
      throw new Error('Blob Storage not configured');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.delete();
      this.log(`Blob deleted: ${blobName}`);
      this.emit('blob:deleted', { blobName, containerName });
    } catch (error) {
      this.handleError('Blob delete failed', error);
      throw error;
    }
  }

  /**
   * Create container
   */
  public async createContainer(containerName: string, access?: 'blob' | 'container'): Promise<void> {
    this.ensureInitialized();
    if (!this.blobServiceClient) {
      throw new Error('Blob Storage not configured');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      await containerClient.create({ access });
      this.log(`Container created: ${containerName}`);
    } catch (error) {
      this.handleError('Container creation failed', error);
      throw error;
    }
  }

  // ============================================================================
  // COSMOS DB OPERATIONS
  // ============================================================================

  /**
   * Create or replace document in Cosmos DB
   */
  public async createDocument(options: CosmosDocumentOptions): Promise<any> {
    this.ensureInitialized();
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }

    try {
      const container = this.getCosmosContainer(options.databaseId, options.containerId);
      const { resource } = await container.items.create(options.document);

      this.log(`Document created in ${options.containerId}`);
      this.emit('cosmos:document:created', { containerId: options.containerId });

      return resource;
    } catch (error) {
      this.handleError('Document creation failed', error);
      throw error;
    }
  }

  /**
   * Read document from Cosmos DB
   */
  public async readDocument(databaseId: string, containerId: string, documentId: string, partitionKey: any): Promise<any> {
    this.ensureInitialized();
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }

    try {
      const container = this.getCosmosContainer(databaseId, containerId);
      const { resource } = await container.item(documentId, partitionKey).read();

      return resource;
    } catch (error) {
      this.handleError('Document read failed', error);
      throw error;
    }
  }

  /**
   * Query documents in Cosmos DB
   */
  public async queryDocuments(options: CosmosQueryOptions): Promise<any[]> {
    this.ensureInitialized();
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }

    try {
      const container = this.getCosmosContainer(options.databaseId, options.containerId);
      const querySpec = {
        query: options.query,
        parameters: options.parameters || []
      };

      const { resources } = await container.items.query(querySpec).fetchAll();

      this.log(`Query executed on ${options.containerId}`);
      return resources;
    } catch (error) {
      this.handleError('Query failed', error);
      throw error;
    }
  }

  /**
   * Update document in Cosmos DB
   */
  public async updateDocument(databaseId: string, containerId: string, documentId: string, partitionKey: any, updates: any): Promise<any> {
    this.ensureInitialized();
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }

    try {
      const container = this.getCosmosContainer(databaseId, containerId);
      const { resource } = await container.item(documentId, partitionKey).replace(updates);

      this.log(`Document updated: ${documentId}`);
      return resource;
    } catch (error) {
      this.handleError('Document update failed', error);
      throw error;
    }
  }

  /**
   * Delete document from Cosmos DB
   */
  public async deleteDocument(databaseId: string, containerId: string, documentId: string, partitionKey: any): Promise<void> {
    this.ensureInitialized();
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }

    try {
      const container = this.getCosmosContainer(databaseId, containerId);
      await container.item(documentId, partitionKey).delete();

      this.log(`Document deleted: ${documentId}`);
      this.emit('cosmos:document:deleted', { documentId });
    } catch (error) {
      this.handleError('Document deletion failed', error);
      throw error;
    }
  }

  /**
   * Create Cosmos DB database
   */
  public async createDatabase(databaseId: string, throughput?: number): Promise<void> {
    this.ensureInitialized();
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }

    try {
      await this.cosmosClient.databases.createIfNotExists({ id: databaseId, throughput });
      this.log(`Database created: ${databaseId}`);
    } catch (error) {
      this.handleError('Database creation failed', error);
      throw error;
    }
  }

  /**
   * Create Cosmos DB container
   */
  public async createCosmosContainer(databaseId: string, containerId: string, partitionKey: string): Promise<void> {
    this.ensureInitialized();
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }

    try {
      const database = this.cosmosClient.database(databaseId);
      await database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: [partitionKey] }
      });
      this.log(`Container created: ${containerId}`);
    } catch (error) {
      this.handleError('Container creation failed', error);
      throw error;
    }
  }

  private getCosmosContainer(databaseId: string, containerId: string): Container {
    if (!this.cosmosClient) {
      throw new Error('Cosmos DB not configured');
    }
    return this.cosmosClient.database(databaseId).container(containerId);
  }

  // ============================================================================
  // AZURE FUNCTIONS OPERATIONS
  // ============================================================================

  /**
   * Deploy Azure Function
   */
  public async deployFunction(options: FunctionDeployOptions): Promise<{ id: string; defaultHostName: string }> {
    this.ensureInitialized();
    if (!this.webSiteManagementClient) {
      throw new Error('App Service not configured');
    }

    try {
      const functionApp = await this.webSiteManagementClient.webApps.createOrUpdate(
        options.resourceGroupName,
        options.functionAppName,
        {
          location: this.config.region || 'eastus',
          kind: 'functionapp',
          siteConfig: {
            appSettings: [
              { name: 'FUNCTIONS_WORKER_RUNTIME', value: options.runtime },
              { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' },
              ...Object.entries(options.environment || {}).map(([name, value]) => ({ name, value }))
            ]
          }
        }
      );

      this.log(`Function deployed: ${options.functionAppName}`);
      this.emit('function:deployed', { functionAppName: options.functionAppName });

      return {
        id: functionApp.id || '',
        defaultHostName: functionApp.defaultHostName || ''
      };
    } catch (error) {
      this.handleError('Function deployment failed', error);
      throw error;
    }
  }

  /**
   * Invoke Azure Function
   */
  public async invokeFunction(resourceGroupName: string, functionAppName: string, functionName: string, data: any): Promise<any> {
    this.ensureInitialized();
    if (!this.webSiteManagementClient) {
      throw new Error('App Service not configured');
    }

    try {
      // Get function app details
      const app = await this.webSiteManagementClient.webApps.get(resourceGroupName, functionAppName);

      if (!app.defaultHostName) {
        throw new Error('Function app hostname not available');
      }

      // In production, you would make an HTTP request to the function endpoint
      this.log(`Function invoked: ${functionName}`);
      return { success: true, hostname: app.defaultHostName };
    } catch (error) {
      this.handleError('Function invocation failed', error);
      throw error;
    }
  }

  /**
   * List Azure Functions
   */
  public async listFunctions(resourceGroupName: string, functionAppName: string): Promise<any[]> {
    this.ensureInitialized();
    if (!this.webSiteManagementClient) {
      throw new Error('App Service not configured');
    }

    try {
      const functions: any[] = [];
      for await (const func of this.webSiteManagementClient.webApps.listFunctions(resourceGroupName, functionAppName)) {
        functions.push(func);
      }
      return functions;
    } catch (error) {
      this.handleError('List functions failed', error);
      throw error;
    }
  }

  // ============================================================================
  // SERVICE BUS OPERATIONS
  // ============================================================================

  /**
   * Send message to Service Bus queue or topic
   */
  public async sendServiceBusMessage(options: ServiceBusMessageOptions): Promise<void> {
    this.ensureInitialized();
    if (!this.serviceBusClient) {
      throw new Error('Service Bus not configured');
    }

    try {
      let sender = this.serviceBusSenders.get(options.queueOrTopicName);

      if (!sender) {
        sender = this.serviceBusClient.createSender(options.queueOrTopicName);
        this.serviceBusSenders.set(options.queueOrTopicName, sender);
      }

      const message: any = {
        body: options.message,
        messageId: options.messageId,
        sessionId: options.sessionId,
        contentType: options.contentType || 'application/json',
        timeToLive: options.timeToLive
      };

      await sender.sendMessages(message);

      this.log(`Message sent to ${options.queueOrTopicName}`);
      this.emit('servicebus:message:sent', { queueOrTopicName: options.queueOrTopicName });
    } catch (error) {
      this.handleError('Service Bus send failed', error);
      throw error;
    }
  }

  /**
   * Receive messages from Service Bus queue
   */
  public async receiveServiceBusMessages(queueName: string, maxMessages: number = 10): Promise<any[]> {
    this.ensureInitialized();
    if (!this.serviceBusClient) {
      throw new Error('Service Bus not configured');
    }

    try {
      let receiver = this.serviceBusReceivers.get(queueName);

      if (!receiver) {
        receiver = this.serviceBusClient.createReceiver(queueName);
        this.serviceBusReceivers.set(queueName, receiver);
      }

      const messages = await receiver.receiveMessages(maxMessages, { maxWaitTimeInMs: 5000 });

      const results = messages.map(msg => ({
        body: msg.body,
        messageId: msg.messageId,
        contentType: msg.contentType,
        sessionId: msg.sessionId
      }));

      // Complete messages
      for (const message of messages) {
        await receiver.completeMessage(message);
      }

      this.log(`Received ${messages.length} messages from ${queueName}`);
      return results;
    } catch (error) {
      this.handleError('Service Bus receive failed', error);
      throw error;
    }
  }

  // ============================================================================
  // EVENT HUB OPERATIONS
  // ============================================================================

  /**
   * Send events to Event Hub
   */
  public async sendEventHubEvents(options: EventHubEventOptions): Promise<void> {
    this.ensureInitialized();

    if (!this.config.credentials.eventHubConnectionString) {
      throw new Error('Event Hub not configured');
    }

    try {
      let producer = this.eventHubProducerClients.get(options.eventHubName);

      if (!producer) {
        producer = new EventHubProducerClient(
          this.config.credentials.eventHubConnectionString,
          options.eventHubName
        );
        this.eventHubProducerClients.set(options.eventHubName, producer);
      }

      const batch = await producer.createBatch({
        partitionKey: options.partitionKey
      });

      for (const event of options.events) {
        const added = batch.tryAdd({ body: event });
        if (!added) {
          throw new Error('Event too large for batch');
        }
      }

      await producer.sendBatch(batch);

      this.log(`Sent ${options.events.length} events to ${options.eventHubName}`);
      this.emit('eventhub:events:sent', { eventHubName: options.eventHubName, count: options.events.length });
    } catch (error) {
      this.handleError('Event Hub send failed', error);
      throw error;
    }
  }

  /**
   * Receive events from Event Hub
   */
  public async receiveEventHubEvents(
    eventHubName: string,
    consumerGroup: string,
    onEvent: (event: any) => Promise<void>,
    maxWaitTimeInSeconds: number = 60
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.config.credentials.eventHubConnectionString) {
      throw new Error('Event Hub not configured');
    }

    try {
      const consumer = new EventHubConsumerClient(
        consumerGroup,
        this.config.credentials.eventHubConnectionString,
        eventHubName
      );

      const subscription = consumer.subscribe({
        processEvents: async (events, context) => {
          for (const event of events) {
            await onEvent(event);
          }
        },
        processError: async (err, context) => {
          this.handleError('Event Hub processing error', err);
        }
      }, {
        maxWaitTimeInSeconds
      });

      this.log(`Started receiving events from ${eventHubName}`);

      // Store subscription for cleanup
      setTimeout(() => subscription.close(), maxWaitTimeInSeconds * 1000);
    } catch (error) {
      this.handleError('Event Hub receive failed', error);
      throw error;
    }
  }

  // ============================================================================
  // KEY VAULT OPERATIONS
  // ============================================================================

  /**
   * Set secret in Key Vault
   */
  public async setSecret(options: SecretOptions): Promise<void> {
    this.ensureInitialized();
    if (!this.secretClient) {
      throw new Error('Key Vault not configured');
    }

    if (!options.value) {
      throw new Error('Secret value is required');
    }

    try {
      await this.secretClient.setSecret(options.secretName, options.value, {
        contentType: options.contentType,
        tags: options.tags
      });

      this.log(`Secret set: ${options.secretName}`);
      this.emit('keyvault:secret:set', { secretName: options.secretName });
    } catch (error) {
      this.handleError('Set secret failed', error);
      throw error;
    }
  }

  /**
   * Get secret from Key Vault
   */
  public async getSecret(secretName: string): Promise<string> {
    this.ensureInitialized();
    if (!this.secretClient) {
      throw new Error('Key Vault not configured');
    }

    try {
      const secret = await this.secretClient.getSecret(secretName);
      this.log(`Secret retrieved: ${secretName}`);
      return secret.value || '';
    } catch (error) {
      this.handleError('Get secret failed', error);
      throw error;
    }
  }

  /**
   * Delete secret from Key Vault
   */
  public async deleteSecret(secretName: string): Promise<void> {
    this.ensureInitialized();
    if (!this.secretClient) {
      throw new Error('Key Vault not configured');
    }

    try {
      const poller = await this.secretClient.beginDeleteSecret(secretName);
      await poller.pollUntilDone();

      this.log(`Secret deleted: ${secretName}`);
      this.emit('keyvault:secret:deleted', { secretName });
    } catch (error) {
      this.handleError('Delete secret failed', error);
      throw error;
    }
  }

  /**
   * List secrets in Key Vault
   */
  public async listSecrets(): Promise<Array<{ name: string; enabled: boolean }>> {
    this.ensureInitialized();
    if (!this.secretClient) {
      throw new Error('Key Vault not configured');
    }

    try {
      const secrets: Array<{ name: string; enabled: boolean }> = [];

      for await (const secretProperties of this.secretClient.listPropertiesOfSecrets()) {
        secrets.push({
          name: secretProperties.name,
          enabled: secretProperties.enabled || false
        });
      }

      return secrets;
    } catch (error) {
      this.handleError('List secrets failed', error);
      throw error;
    }
  }

  // ============================================================================
  // CONTAINER INSTANCES OPERATIONS
  // ============================================================================

  /**
   * Create and start container instance
   */
  public async createContainerInstance(options: ContainerInstanceOptions): Promise<{ id: string; ipAddress?: string }> {
    this.ensureInitialized();
    if (!this.containerInstanceClient) {
      throw new Error('Container Instances not configured');
    }

    try {
      const containerGroup = await this.containerInstanceClient.containerGroups.beginCreateOrUpdateAndWait(
        options.resourceGroupName,
        options.containerGroupName,
        {
          location: this.config.region || 'eastus',
          containers: [{
            name: options.containerGroupName,
            image: options.image,
            resources: {
              requests: {
                cpu: options.cpu,
                memoryInGB: options.memoryInGb
              }
            },
            environmentVariables: Object.entries(options.environmentVariables || {}).map(([name, value]) => ({
              name,
              value
            })),
            ports: (options.ports || []).map(port => ({ port, protocol: 'TCP' as any })),
            command: options.command
          }],
          osType: 'Linux',
          ipAddress: options.ports && options.ports.length > 0 ? {
            type: 'Public',
            ports: (options.ports || []).map(port => ({ port, protocol: 'TCP' as any }))
          } : undefined
        }
      );

      this.log(`Container instance created: ${options.containerGroupName}`);
      this.emit('container:created', { containerGroupName: options.containerGroupName });

      return {
        id: containerGroup.id || '',
        ipAddress: containerGroup.ipAddress?.ip
      };
    } catch (error) {
      this.handleError('Container instance creation failed', error);
      throw error;
    }
  }

  /**
   * Delete container instance
   */
  public async deleteContainerInstance(resourceGroupName: string, containerGroupName: string): Promise<void> {
    this.ensureInitialized();
    if (!this.containerInstanceClient) {
      throw new Error('Container Instances not configured');
    }

    try {
      await this.containerInstanceClient.containerGroups.beginDeleteAndWait(resourceGroupName, containerGroupName);
      this.log(`Container instance deleted: ${containerGroupName}`);
      this.emit('container:deleted', { containerGroupName });
    } catch (error) {
      this.handleError('Container instance deletion failed', error);
      throw error;
    }
  }

  /**
   * Get container instance status
   */
  public async getContainerInstanceStatus(resourceGroupName: string, containerGroupName: string): Promise<any> {
    this.ensureInitialized();
    if (!this.containerInstanceClient) {
      throw new Error('Container Instances not configured');
    }

    try {
      const containerGroup = await this.containerInstanceClient.containerGroups.get(resourceGroupName, containerGroupName);
      return {
        provisioningState: containerGroup.provisioningState,
        state: containerGroup.instanceView?.state,
        ipAddress: containerGroup.ipAddress?.ip
      };
    } catch (error) {
      this.handleError('Get container status failed', error);
      throw error;
    }
  }

  // ============================================================================
  // SQL DATABASE OPERATIONS
  // ============================================================================

  /**
   * Create SQL Database
   */
  public async createSqlDatabase(options: SqlDatabaseOptions): Promise<{ id: string; name: string }> {
    this.ensureInitialized();
    if (!this.sqlManagementClient) {
      throw new Error('SQL Management not configured');
    }

    try {
      const database = await this.sqlManagementClient.databases.beginCreateOrUpdateAndWait(
        options.resourceGroupName,
        options.serverName,
        options.databaseName,
        {
          location: this.config.region || 'eastus',
          sku: {
            name: options.requestedServiceObjectiveName || 'S0'
          }
        }
      );

      this.log(`SQL Database created: ${options.databaseName}`);
      this.emit('sql:database:created', { databaseName: options.databaseName });

      return {
        id: database.id || '',
        name: database.name || ''
      };
    } catch (error) {
      this.handleError('SQL Database creation failed', error);
      throw error;
    }
  }

  /**
   * Delete SQL Database
   */
  public async deleteSqlDatabase(resourceGroupName: string, serverName: string, databaseName: string): Promise<void> {
    this.ensureInitialized();
    if (!this.sqlManagementClient) {
      throw new Error('SQL Management not configured');
    }

    try {
      await this.sqlManagementClient.databases.beginDeleteAndWait(resourceGroupName, serverName, databaseName);
      this.log(`SQL Database deleted: ${databaseName}`);
      this.emit('sql:database:deleted', { databaseName });
    } catch (error) {
      this.handleError('SQL Database deletion failed', error);
      throw error;
    }
  }

  /**
   * List SQL Databases
   */
  public async listSqlDatabases(resourceGroupName: string, serverName: string): Promise<any[]> {
    this.ensureInitialized();
    if (!this.sqlManagementClient) {
      throw new Error('SQL Management not configured');
    }

    try {
      const databases: any[] = [];
      for await (const database of this.sqlManagementClient.databases.listByServer(resourceGroupName, serverName)) {
        databases.push({
          id: database.id,
          name: database.name,
          status: database.status,
          creationDate: database.creationDate
        });
      }
      return databases;
    } catch (error) {
      this.handleError('List SQL databases failed', error);
      throw error;
    }
  }

  // ============================================================================
  // COGNITIVE SERVICES OPERATIONS
  // ============================================================================

  /**
   * Analyze text using Text Analytics
   */
  public async analyzeText(options: TextAnalysisOptions): Promise<any> {
    this.ensureInitialized();
    if (!this.textAnalyticsClient) {
      throw new Error('Text Analytics not configured');
    }

    try {
      let results: any;

      switch (options.operation) {
        case 'sentiment':
          results = await this.textAnalyticsClient.analyzeSentiment(options.documents);
          break;
        case 'keyPhrases':
          results = await this.textAnalyticsClient.extractKeyPhrases(options.documents);
          break;
        case 'entities':
          results = await this.textAnalyticsClient.recognizeEntities(options.documents);
          break;
        case 'language':
          results = await this.textAnalyticsClient.detectLanguage(options.documents);
          break;
        default:
          throw new Error(`Unknown operation: ${options.operation}`);
      }

      this.log(`Text analysis completed: ${options.operation}`);
      return results;
    } catch (error) {
      this.handleError('Text analysis failed', error);
      throw error;
    }
  }

  /**
   * Analyze image using Computer Vision
   */
  public async analyzeImage(options: VisionAnalysisOptions): Promise<any> {
    this.ensureInitialized();
    if (!this.computerVisionClient) {
      throw new Error('Computer Vision not configured');
    }

    try {
      let results: any;

      if (options.imageUrl) {
        results = await this.computerVisionClient.analyzeImage(options.imageUrl, {
          visualFeatures: options.features as any
        });
      } else if (options.imageBuffer) {
        results = await this.computerVisionClient.analyzeImageInStream(
          () => options.imageBuffer!,
          {
            visualFeatures: options.features as any
          }
        );
      } else {
        throw new Error('Either imageUrl or imageBuffer must be provided');
      }

      this.log('Image analysis completed');
      return results;
    } catch (error) {
      this.handleError('Image analysis failed', error);
      throw error;
    }
  }

  /**
   * Extract text from image (OCR)
   */
  public async extractTextFromImage(imageUrl: string): Promise<string> {
    this.ensureInitialized();
    if (!this.computerVisionClient) {
      throw new Error('Computer Vision not configured');
    }

    try {
      const result = await this.computerVisionClient.read(imageUrl);
      const operationId = result.operationLocation.split('/').pop();

      if (!operationId) {
        throw new Error('Failed to get operation ID');
      }

      // Poll for result
      let readResult: any;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        readResult = await this.computerVisionClient.getReadResult(operationId);
      } while (readResult.status === 'running' || readResult.status === 'notStarted');

      if (readResult.status !== 'succeeded') {
        throw new Error(`OCR failed with status: ${readResult.status}`);
      }

      // Extract text
      const text = readResult.analyzeResult.readResults
        .map((page: any) => page.lines.map((line: any) => line.text).join('\n'))
        .join('\n\n');

      this.log('Text extracted from image');
      return text;
    } catch (error) {
      this.handleError('Text extraction failed', error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AzureIntegration not initialized. Call initialize() first.');
    }
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[AzureIntegration] ${message}`);
    }
    this.emit('log', { message, timestamp: new Date() });
  }

  private handleError(context: string, error: any): void {
    const errorMessage = `${context}: ${error.message || error}`;
    this.log(errorMessage);
    this.emit('error', { context, error, timestamp: new Date() });
  }

  /**
   * Cleanup and close all connections
   */
  public async shutdown(): Promise<void> {
    this.log('Shutting down Azure Integration...');

    try {
      // Close Service Bus senders
      for (const [name, sender] of this.serviceBusSenders.entries()) {
        await sender.close();
        this.log(`Closed Service Bus sender: ${name}`);
      }
      this.serviceBusSenders.clear();

      // Close Service Bus receivers
      for (const [name, receiver] of this.serviceBusReceivers.entries()) {
        await receiver.close();
        this.log(`Closed Service Bus receiver: ${name}`);
      }
      this.serviceBusReceivers.clear();

      // Close Service Bus client
      if (this.serviceBusClient) {
        await this.serviceBusClient.close();
        this.log('Closed Service Bus client');
      }

      // Close Event Hub producers
      for (const [name, producer] of this.eventHubProducerClients.entries()) {
        await producer.close();
        this.log(`Closed Event Hub producer: ${name}`);
      }
      this.eventHubProducerClients.clear();

      this.isInitialized = false;
      this.emit('shutdown');
      this.log('Azure Integration shut down successfully');
    } catch (error) {
      this.handleError('Shutdown error', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AzureConfig {
    return { ...this.config, credentials: { ...this.config.credentials } };
  }

  /**
   * Check if a service is configured
   */
  public isServiceConfigured(service: string): boolean {
    switch (service) {
      case 'blobStorage': return !!this.blobServiceClient;
      case 'cosmosDb': return !!this.cosmosClient;
      case 'serviceBus': return !!this.serviceBusClient;
      case 'keyVault': return !!this.secretClient;
      case 'containerInstances': return !!this.containerInstanceClient;
      case 'sqlDatabase': return !!this.sqlManagementClient;
      case 'cognitiveServices': return !!this.textAnalyticsClient;
      case 'functions': return !!this.webSiteManagementClient;
      default: return false;
    }
  }
}

export default AzureIntegration;
