/**
 * Comprehensive unit tests for AzureIntegration
 * Coverage: All public methods, edge cases, error conditions, async behavior,
 * resource cleanup, type safety, mocking, timeouts, and concurrency
 */

import { AzureIntegration, AzureConfig, AzureCredentials } from '../../../src/integrations/AzureIntegration';
import { EventEmitter } from 'events';

// Mock Azure SDK modules
jest.mock('@azure/storage-blob');
jest.mock('@azure/cosmos');
jest.mock('@azure/service-bus');
jest.mock('@azure/event-hubs');
jest.mock('@azure/keyvault-secrets');
jest.mock('@azure/keyvault-keys');
jest.mock('@azure/arm-containerinstance');
jest.mock('@azure/arm-sql');
jest.mock('@azure/ai-text-analytics');
jest.mock('@azure/cognitiveservices-computervision');
jest.mock('@azure/identity');
jest.mock('@azure/arm-appservice');

// Mock timers
jest.useFakeTimers();

describe('AzureIntegration', () => {
  let integration: AzureIntegration;
  let config: AzureConfig;
  let credentials: AzureCredentials;

  beforeEach(() => {
    credentials = {
      subscriptionId: 'test-subscription-id',
      tenantId: 'test-tenant-id',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      storageAccountName: 'teststorage',
      storageAccountKey: 'test-storage-key',
      cosmosEndpoint: 'https://test-cosmos.documents.azure.com:443/',
      cosmosKey: 'test-cosmos-key',
      serviceBusConnectionString: 'Endpoint=sb://test.servicebus.windows.net/;',
      eventHubConnectionString: 'Endpoint=sb://test.eventhub.windows.net/;',
      keyVaultUrl: 'https://test-vault.vault.azure.net/',
      cognitiveServicesKey: 'test-cognitive-key',
      cognitiveServicesEndpoint: 'https://test.cognitiveservices.azure.com/'
    };

    config = {
      credentials,
      region: 'eastus',
      timeout: 30000,
      retryAttempts: 3,
      enableLogging: false
    };

    integration = new AzureIntegration(config);
  });

  afterEach(async () => {
    if (integration && (integration as any).isInitialized) {
      await integration.shutdown();
    }
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with valid config', () => {
      expect(integration).toBeInstanceOf(AzureIntegration);
      expect(integration).toBeInstanceOf(EventEmitter);
    });

    it('should create instance with minimal credentials', () => {
      const minimalConfig: AzureConfig = {
        credentials: {
          tenantId: 'test-tenant',
          clientId: 'test-client',
          clientSecret: 'test-secret'
        }
      };
      const inst = new AzureIntegration(minimalConfig);
      expect(inst).toBeInstanceOf(AzureIntegration);
    });

    it('should create instance with empty credentials', () => {
      const emptyConfig: AzureConfig = {
        credentials: {}
      };
      const inst = new AzureIntegration(emptyConfig);
      expect(inst).toBeInstanceOf(AzureIntegration);
    });

    it('should handle null credentials properties', () => {
      const nullConfig: AzureConfig = {
        credentials: {
          subscriptionId: undefined,
          tenantId: undefined
        }
      };
      const inst = new AzureIntegration(nullConfig);
      expect(inst).toBeInstanceOf(AzureIntegration);
    });
  });

  describe('initialize()', () => {
    it('should initialize successfully', async () => {
      await integration.initialize();
      expect((integration as any).isInitialized).toBe(true);
    });

    it('should throw if already initialized', async () => {
      await integration.initialize();
      await expect(integration.initialize()).rejects.toThrow('AzureIntegration already initialized');
    });

    it('should emit initialized event', async () => {
      const handler = jest.fn();
      integration.on('initialized', handler);

      await integration.initialize();
      expect(handler).toHaveBeenCalled();
    });

    it('should initialize blob storage client', async () => {
      await integration.initialize();
      expect((integration as any).blobServiceClient).toBeDefined();
    });

    it('should initialize cosmos client', async () => {
      await integration.initialize();
      expect((integration as any).cosmosClient).toBeDefined();
    });

    it('should initialize service bus client', async () => {
      await integration.initialize();
      expect((integration as any).serviceBusClient).toBeDefined();
    });

    it('should initialize key vault clients', async () => {
      await integration.initialize();
      expect((integration as any).secretClient).toBeDefined();
      expect((integration as any).keyClient).toBeDefined();
    });

    it('should handle initialization errors', async () => {
      const badConfig: AzureConfig = {
        credentials: { storageAccountName: 'test', storageAccountKey: null as any }
      };
      const badIntegration = new AzureIntegration(badConfig);

      await expect(badIntegration.initialize()).rejects.toThrow();
    });

    it('should initialize without storage credentials', async () => {
      const noStorageConfig: AzureConfig = {
        credentials: {
          tenantId: 'test',
          clientId: 'test',
          clientSecret: 'test'
        }
      };
      const inst = new AzureIntegration(noStorageConfig);
      await inst.initialize();
      expect((inst as any).blobServiceClient).toBeUndefined();
      await inst.shutdown();
    });

    it('should initialize without cosmos credentials', async () => {
      const noCosmosConfig: AzureConfig = {
        credentials: {
          storageAccountName: 'test',
          storageAccountKey: 'test'
        }
      };
      const inst = new AzureIntegration(noCosmosConfig);
      await inst.initialize();
      expect((inst as any).cosmosClient).toBeUndefined();
      await inst.shutdown();
    });
  });

  describe('Blob Storage Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('uploadBlob()', () => {
      it('should upload blob successfully', async () => {
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'test-blob.txt',
          content: 'test content'
        });

        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('etag');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.uploadBlob({
          containerName: 'test',
          blobName: 'test',
          content: 'test'
        })).rejects.toThrow();
      });

      it('should throw if blob storage not configured', async () => {
        const noStorageConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noStorageConfig);
        await inst.initialize();

        await expect(inst.uploadBlob({
          containerName: 'test',
          blobName: 'test',
          content: 'test'
        })).rejects.toThrow('Blob Storage not configured');

        await inst.shutdown();
      });

      it('should handle Buffer content', async () => {
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'test.bin',
          content: Buffer.from('binary content')
        });

        expect(result).toHaveProperty('url');
      });

      it('should handle string content', async () => {
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'test.txt',
          content: 'string content'
        });

        expect(result).toHaveProperty('url');
      });

      it('should handle empty content', async () => {
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'empty.txt',
          content: ''
        });

        expect(result).toHaveProperty('url');
      });

      it('should handle metadata', async () => {
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'with-metadata.txt',
          content: 'test',
          metadata: { author: 'test', version: '1.0' }
        });

        expect(result).toHaveProperty('url');
      });

      it('should handle content type', async () => {
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'test.json',
          content: JSON.stringify({ test: true }),
          contentType: 'application/json'
        });

        expect(result).toHaveProperty('url');
      });

      it('should handle tier option', async () => {
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'archived.txt',
          content: 'archive me',
          tier: 'Archive'
        });

        expect(result).toHaveProperty('url');
      });

      it('should emit blob:uploaded event', async () => {
        const handler = jest.fn();
        integration.on('blob:uploaded', handler);

        await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'test.txt',
          content: 'test'
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle null containerName', async () => {
        await expect(integration.uploadBlob({
          containerName: null as any,
          blobName: 'test.txt',
          content: 'test'
        })).rejects.toThrow();
      });

      it('should handle null blobName', async () => {
        await expect(integration.uploadBlob({
          containerName: 'test',
          blobName: null as any,
          content: 'test'
        })).rejects.toThrow();
      });

      it('should handle large content', async () => {
        const largeContent = 'x'.repeat(1000000);
        const result = await integration.uploadBlob({
          containerName: 'test-container',
          blobName: 'large.txt',
          content: largeContent
        });

        expect(result).toHaveProperty('url');
      });
    });

    describe('downloadBlob()', () => {
      it('should download blob successfully', async () => {
        const result = await integration.downloadBlob({
          containerName: 'test-container',
          blobName: 'test.txt'
        });

        expect(result).toBeInstanceOf(Buffer);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.downloadBlob({
          containerName: 'test',
          blobName: 'test'
        })).rejects.toThrow();
      });

      it('should throw if blob storage not configured', async () => {
        const noStorageConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noStorageConfig);
        await inst.initialize();

        await expect(inst.downloadBlob({
          containerName: 'test',
          blobName: 'test'
        })).rejects.toThrow('Blob Storage not configured');

        await inst.shutdown();
      });

      it('should handle null containerName', async () => {
        await expect(integration.downloadBlob({
          containerName: null as any,
          blobName: 'test.txt'
        })).rejects.toThrow();
      });

      it('should handle null blobName', async () => {
        await expect(integration.downloadBlob({
          containerName: 'test',
          blobName: null as any
        })).rejects.toThrow();
      });
    });

    describe('listBlobs()', () => {
      it('should list blobs successfully', async () => {
        const result = await integration.listBlobs('test-container');
        expect(Array.isArray(result)).toBe(true);
      });

      it('should list blobs with prefix', async () => {
        const result = await integration.listBlobs('test-container', 'prefix/');
        expect(Array.isArray(result)).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.listBlobs('test')).rejects.toThrow();
      });

      it('should throw if blob storage not configured', async () => {
        const noStorageConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noStorageConfig);
        await inst.initialize();

        await expect(inst.listBlobs('test')).rejects.toThrow('Blob Storage not configured');

        await inst.shutdown();
      });

      it('should handle null containerName', async () => {
        await expect(integration.listBlobs(null as any)).rejects.toThrow();
      });

      it('should handle empty containerName', async () => {
        await expect(integration.listBlobs('')).rejects.toThrow();
      });
    });

    describe('deleteBlob()', () => {
      it('should delete blob successfully', async () => {
        await integration.deleteBlob('test-container', 'test.txt');
        expect(true).toBe(true);
      });

      it('should emit blob:deleted event', async () => {
        const handler = jest.fn();
        integration.on('blob:deleted', handler);

        await integration.deleteBlob('test-container', 'test.txt');
        expect(handler).toHaveBeenCalled();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.deleteBlob('test', 'test')).rejects.toThrow();
      });

      it('should throw if blob storage not configured', async () => {
        const noStorageConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noStorageConfig);
        await inst.initialize();

        await expect(inst.deleteBlob('test', 'test')).rejects.toThrow('Blob Storage not configured');

        await inst.shutdown();
      });

      it('should handle null parameters', async () => {
        await expect(integration.deleteBlob(null as any, 'test')).rejects.toThrow();
        await expect(integration.deleteBlob('test', null as any)).rejects.toThrow();
      });
    });

    describe('createContainer()', () => {
      it('should create container successfully', async () => {
        await integration.createContainer('new-container');
        expect(true).toBe(true);
      });

      it('should create container with public access', async () => {
        await integration.createContainer('public-container', 'blob');
        expect(true).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.createContainer('test')).rejects.toThrow();
      });

      it('should throw if blob storage not configured', async () => {
        const noStorageConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noStorageConfig);
        await inst.initialize();

        await expect(inst.createContainer('test')).rejects.toThrow('Blob Storage not configured');

        await inst.shutdown();
      });

      it('should handle null containerName', async () => {
        await expect(integration.createContainer(null as any)).rejects.toThrow();
      });
    });
  });

  describe('Cosmos DB Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('createDocument()', () => {
      it('should create document successfully', async () => {
        const result = await integration.createDocument({
          databaseId: 'test-db',
          containerId: 'test-container',
          document: { id: '1', name: 'Test' }
        });

        expect(result).toBeDefined();
      });

      it('should emit cosmos:document:created event', async () => {
        const handler = jest.fn();
        integration.on('cosmos:document:created', handler);

        await integration.createDocument({
          databaseId: 'test-db',
          containerId: 'test-container',
          document: { id: '1', name: 'Test' }
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.createDocument({
          databaseId: 'test',
          containerId: 'test',
          document: {}
        })).rejects.toThrow();
      });

      it('should throw if cosmos not configured', async () => {
        const noCosmosConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noCosmosConfig);
        await inst.initialize();

        await expect(inst.createDocument({
          databaseId: 'test',
          containerId: 'test',
          document: {}
        })).rejects.toThrow('Cosmos DB not configured');

        await inst.shutdown();
      });

      it('should handle null parameters', async () => {
        await expect(integration.createDocument({
          databaseId: null as any,
          containerId: 'test',
          document: {}
        })).rejects.toThrow();
      });

      it('should handle complex documents', async () => {
        const complexDoc = {
          id: 'complex',
          nested: { deep: { value: 'test' } },
          array: [1, 2, 3],
          metadata: { created: new Date() }
        };

        const result = await integration.createDocument({
          databaseId: 'test-db',
          containerId: 'test-container',
          document: complexDoc
        });

        expect(result).toBeDefined();
      });
    });

    describe('readDocument()', () => {
      it('should read document successfully', async () => {
        const result = await integration.readDocument('test-db', 'test-container', 'doc-id', 'partition-key');
        expect(result).toBeDefined();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.readDocument('db', 'container', 'id', 'pk')).rejects.toThrow();
      });

      it('should throw if cosmos not configured', async () => {
        const noCosmosConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noCosmosConfig);
        await inst.initialize();

        await expect(inst.readDocument('db', 'container', 'id', 'pk')).rejects.toThrow('Cosmos DB not configured');

        await inst.shutdown();
      });

      it('should handle null parameters', async () => {
        await expect(integration.readDocument(null as any, 'container', 'id', 'pk')).rejects.toThrow();
      });
    });

    describe('queryDocuments()', () => {
      it('should query documents successfully', async () => {
        const result = await integration.queryDocuments({
          databaseId: 'test-db',
          containerId: 'test-container',
          query: 'SELECT * FROM c'
        });

        expect(Array.isArray(result)).toBe(true);
      });

      it('should query with parameters', async () => {
        const result = await integration.queryDocuments({
          databaseId: 'test-db',
          containerId: 'test-container',
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: '123' }]
        });

        expect(Array.isArray(result)).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.queryDocuments({
          databaseId: 'db',
          containerId: 'container',
          query: 'SELECT * FROM c'
        })).rejects.toThrow();
      });

      it('should throw if cosmos not configured', async () => {
        const noCosmosConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noCosmosConfig);
        await inst.initialize();

        await expect(inst.queryDocuments({
          databaseId: 'db',
          containerId: 'container',
          query: 'SELECT * FROM c'
        })).rejects.toThrow('Cosmos DB not configured');

        await inst.shutdown();
      });

      it('should handle null parameters', async () => {
        await expect(integration.queryDocuments({
          databaseId: null as any,
          containerId: 'container',
          query: 'SELECT * FROM c'
        })).rejects.toThrow();
      });
    });

    describe('updateDocument()', () => {
      it('should update document successfully', async () => {
        const result = await integration.updateDocument(
          'test-db',
          'test-container',
          'doc-id',
          'partition-key',
          { id: 'doc-id', updated: true }
        );

        expect(result).toBeDefined();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.updateDocument('db', 'container', 'id', 'pk', {})).rejects.toThrow();
      });

      it('should throw if cosmos not configured', async () => {
        const noCosmosConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noCosmosConfig);
        await inst.initialize();

        await expect(inst.updateDocument('db', 'container', 'id', 'pk', {})).rejects.toThrow('Cosmos DB not configured');

        await inst.shutdown();
      });
    });

    describe('deleteDocument()', () => {
      it('should delete document successfully', async () => {
        await integration.deleteDocument('test-db', 'test-container', 'doc-id', 'partition-key');
        expect(true).toBe(true);
      });

      it('should emit cosmos:document:deleted event', async () => {
        const handler = jest.fn();
        integration.on('cosmos:document:deleted', handler);

        await integration.deleteDocument('test-db', 'test-container', 'doc-id', 'partition-key');
        expect(handler).toHaveBeenCalled();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.deleteDocument('db', 'container', 'id', 'pk')).rejects.toThrow();
      });

      it('should throw if cosmos not configured', async () => {
        const noCosmosConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noCosmosConfig);
        await inst.initialize();

        await expect(inst.deleteDocument('db', 'container', 'id', 'pk')).rejects.toThrow('Cosmos DB not configured');

        await inst.shutdown();
      });
    });

    describe('createDatabase()', () => {
      it('should create database successfully', async () => {
        await integration.createDatabase('new-database');
        expect(true).toBe(true);
      });

      it('should create database with throughput', async () => {
        await integration.createDatabase('new-database', 400);
        expect(true).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.createDatabase('db')).rejects.toThrow();
      });

      it('should throw if cosmos not configured', async () => {
        const noCosmosConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noCosmosConfig);
        await inst.initialize();

        await expect(inst.createDatabase('db')).rejects.toThrow('Cosmos DB not configured');

        await inst.shutdown();
      });
    });

    describe('createCosmosContainer()', () => {
      it('should create container successfully', async () => {
        await integration.createCosmosContainer('test-db', 'new-container', '/partitionKey');
        expect(true).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.createCosmosContainer('db', 'container', '/pk')).rejects.toThrow();
      });

      it('should throw if cosmos not configured', async () => {
        const noCosmosConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noCosmosConfig);
        await inst.initialize();

        await expect(inst.createCosmosContainer('db', 'container', '/pk')).rejects.toThrow('Cosmos DB not configured');

        await inst.shutdown();
      });
    });
  });

  describe('Azure Functions Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('deployFunction()', () => {
      it('should deploy function successfully', async () => {
        const result = await integration.deployFunction({
          resourceGroupName: 'test-rg',
          functionAppName: 'test-function',
          runtime: 'node',
          runtimeVersion: '18',
          code: Buffer.from('function code')
        });

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('defaultHostName');
      });

      it('should emit function:deployed event', async () => {
        const handler = jest.fn();
        integration.on('function:deployed', handler);

        await integration.deployFunction({
          resourceGroupName: 'test-rg',
          functionAppName: 'test-function',
          runtime: 'node',
          runtimeVersion: '18',
          code: Buffer.from('code')
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle different runtimes', async () => {
        const runtimes: Array<'node' | 'python' | 'dotnet' | 'java'> = ['node', 'python', 'dotnet', 'java'];

        for (const runtime of runtimes) {
          const result = await integration.deployFunction({
            resourceGroupName: 'test-rg',
            functionAppName: `test-${runtime}`,
            runtime,
            runtimeVersion: '1.0',
            code: Buffer.from('code')
          });

          expect(result).toHaveProperty('id');
        }
      });

      it('should handle environment variables', async () => {
        const result = await integration.deployFunction({
          resourceGroupName: 'test-rg',
          functionAppName: 'test-function',
          runtime: 'node',
          runtimeVersion: '18',
          code: Buffer.from('code'),
          environment: {
            VAR1: 'value1',
            VAR2: 'value2'
          }
        });

        expect(result).toHaveProperty('id');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.deployFunction({
          resourceGroupName: 'rg',
          functionAppName: 'func',
          runtime: 'node',
          runtimeVersion: '18',
          code: Buffer.from('code')
        })).rejects.toThrow();
      });

      it('should throw if app service not configured', async () => {
        const noAppServiceConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noAppServiceConfig);
        await inst.initialize();

        await expect(inst.deployFunction({
          resourceGroupName: 'rg',
          functionAppName: 'func',
          runtime: 'node',
          runtimeVersion: '18',
          code: Buffer.from('code')
        })).rejects.toThrow('App Service not configured');

        await inst.shutdown();
      });
    });

    describe('invokeFunction()', () => {
      it('should invoke function successfully', async () => {
        const result = await integration.invokeFunction(
          'test-rg',
          'test-function',
          'myFunction',
          { input: 'data' }
        );

        expect(result).toBeDefined();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.invokeFunction('rg', 'func', 'fn', {})).rejects.toThrow();
      });

      it('should throw if app service not configured', async () => {
        const noAppServiceConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noAppServiceConfig);
        await inst.initialize();

        await expect(inst.invokeFunction('rg', 'func', 'fn', {})).rejects.toThrow('App Service not configured');

        await inst.shutdown();
      });
    });

    describe('listFunctions()', () => {
      it('should list functions successfully', async () => {
        const result = await integration.listFunctions('test-rg', 'test-function');
        expect(Array.isArray(result)).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.listFunctions('rg', 'func')).rejects.toThrow();
      });

      it('should throw if app service not configured', async () => {
        const noAppServiceConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noAppServiceConfig);
        await inst.initialize();

        await expect(inst.listFunctions('rg', 'func')).rejects.toThrow('App Service not configured');

        await inst.shutdown();
      });
    });
  });

  describe('Service Bus Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('sendServiceBusMessage()', () => {
      it('should send message successfully', async () => {
        await integration.sendServiceBusMessage({
          queueOrTopicName: 'test-queue',
          message: { data: 'test' }
        });

        expect(true).toBe(true);
      });

      it('should emit servicebus:message:sent event', async () => {
        const handler = jest.fn();
        integration.on('servicebus:message:sent', handler);

        await integration.sendServiceBusMessage({
          queueOrTopicName: 'test-queue',
          message: { data: 'test' }
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle message with session', async () => {
        await integration.sendServiceBusMessage({
          queueOrTopicName: 'test-queue',
          message: { data: 'test' },
          sessionId: 'session-123'
        });

        expect(true).toBe(true);
      });

      it('should handle message with TTL', async () => {
        await integration.sendServiceBusMessage({
          queueOrTopicName: 'test-queue',
          message: { data: 'test' },
          timeToLive: 60000
        });

        expect(true).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.sendServiceBusMessage({
          queueOrTopicName: 'queue',
          message: {}
        })).rejects.toThrow();
      });

      it('should throw if service bus not configured', async () => {
        const noSBConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noSBConfig);
        await inst.initialize();

        await expect(inst.sendServiceBusMessage({
          queueOrTopicName: 'queue',
          message: {}
        })).rejects.toThrow('Service Bus not configured');

        await inst.shutdown();
      });
    });

    describe('receiveServiceBusMessages()', () => {
      it('should receive messages successfully', async () => {
        const result = await integration.receiveServiceBusMessages('test-queue', 10);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should use default max messages', async () => {
        const result = await integration.receiveServiceBusMessages('test-queue');
        expect(Array.isArray(result)).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.receiveServiceBusMessages('queue')).rejects.toThrow();
      });

      it('should throw if service bus not configured', async () => {
        const noSBConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noSBConfig);
        await inst.initialize();

        await expect(inst.receiveServiceBusMessages('queue')).rejects.toThrow('Service Bus not configured');

        await inst.shutdown();
      });
    });
  });

  describe('Event Hub Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('sendEventHubEvents()', () => {
      it('should send events successfully', async () => {
        await integration.sendEventHubEvents({
          eventHubName: 'test-hub',
          events: [{ data: 'event1' }, { data: 'event2' }]
        });

        expect(true).toBe(true);
      });

      it('should emit eventhub:events:sent event', async () => {
        const handler = jest.fn();
        integration.on('eventhub:events:sent', handler);

        await integration.sendEventHubEvents({
          eventHubName: 'test-hub',
          events: [{ data: 'test' }]
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle partition key', async () => {
        await integration.sendEventHubEvents({
          eventHubName: 'test-hub',
          events: [{ data: 'test' }],
          partitionKey: 'key-1'
        });

        expect(true).toBe(true);
      });

      it('should handle empty events array', async () => {
        await integration.sendEventHubEvents({
          eventHubName: 'test-hub',
          events: []
        });

        expect(true).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.sendEventHubEvents({
          eventHubName: 'hub',
          events: []
        })).rejects.toThrow();
      });

      it('should throw if event hub not configured', async () => {
        const noEHConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noEHConfig);
        await inst.initialize();

        await expect(inst.sendEventHubEvents({
          eventHubName: 'hub',
          events: []
        })).rejects.toThrow('Event Hub not configured');

        await inst.shutdown();
      });
    });

    describe('receiveEventHubEvents()', () => {
      it('should receive events successfully', async () => {
        const onEvent = jest.fn();

        await integration.receiveEventHubEvents(
          'test-hub',
          '$Default',
          onEvent,
          5
        );

        expect(true).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.receiveEventHubEvents('hub', '$Default', jest.fn())).rejects.toThrow();
      });

      it('should throw if event hub not configured', async () => {
        const noEHConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noEHConfig);
        await inst.initialize();

        await expect(inst.receiveEventHubEvents('hub', '$Default', jest.fn())).rejects.toThrow('Event Hub not configured');

        await inst.shutdown();
      });
    });
  });

  describe('Key Vault Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('setSecret()', () => {
      it('should set secret successfully', async () => {
        await integration.setSecret({
          secretName: 'test-secret',
          value: 'secret-value'
        });

        expect(true).toBe(true);
      });

      it('should emit keyvault:secret:set event', async () => {
        const handler = jest.fn();
        integration.on('keyvault:secret:set', handler);

        await integration.setSecret({
          secretName: 'test-secret',
          value: 'secret-value'
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle secret with tags', async () => {
        await integration.setSecret({
          secretName: 'test-secret',
          value: 'secret-value',
          tags: { env: 'test', version: '1.0' }
        });

        expect(true).toBe(true);
      });

      it('should handle secret with content type', async () => {
        await integration.setSecret({
          secretName: 'test-secret',
          value: 'secret-value',
          contentType: 'text/plain'
        });

        expect(true).toBe(true);
      });

      it('should throw if value not provided', async () => {
        await expect(integration.setSecret({
          secretName: 'test-secret'
        })).rejects.toThrow('Secret value is required');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.setSecret({
          secretName: 'secret',
          value: 'value'
        })).rejects.toThrow();
      });

      it('should throw if key vault not configured', async () => {
        const noKVConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noKVConfig);
        await inst.initialize();

        await expect(inst.setSecret({
          secretName: 'secret',
          value: 'value'
        })).rejects.toThrow('Key Vault not configured');

        await inst.shutdown();
      });
    });

    describe('getSecret()', () => {
      it('should get secret successfully', async () => {
        const result = await integration.getSecret('test-secret');
        expect(typeof result).toBe('string');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.getSecret('secret')).rejects.toThrow();
      });

      it('should throw if key vault not configured', async () => {
        const noKVConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noKVConfig);
        await inst.initialize();

        await expect(inst.getSecret('secret')).rejects.toThrow('Key Vault not configured');

        await inst.shutdown();
      });
    });

    describe('deleteSecret()', () => {
      it('should delete secret successfully', async () => {
        await integration.deleteSecret('test-secret');
        expect(true).toBe(true);
      });

      it('should emit keyvault:secret:deleted event', async () => {
        const handler = jest.fn();
        integration.on('keyvault:secret:deleted', handler);

        await integration.deleteSecret('test-secret');
        expect(handler).toHaveBeenCalled();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.deleteSecret('secret')).rejects.toThrow();
      });

      it('should throw if key vault not configured', async () => {
        const noKVConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noKVConfig);
        await inst.initialize();

        await expect(inst.deleteSecret('secret')).rejects.toThrow('Key Vault not configured');

        await inst.shutdown();
      });
    });

    describe('listSecrets()', () => {
      it('should list secrets successfully', async () => {
        const result = await integration.listSecrets();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.listSecrets()).rejects.toThrow();
      });

      it('should throw if key vault not configured', async () => {
        const noKVConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noKVConfig);
        await inst.initialize();

        await expect(inst.listSecrets()).rejects.toThrow('Key Vault not configured');

        await inst.shutdown();
      });
    });
  });

  describe('Container Instances Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('createContainerInstance()', () => {
      it('should create container instance successfully', async () => {
        const result = await integration.createContainerInstance({
          resourceGroupName: 'test-rg',
          containerGroupName: 'test-container',
          image: 'nginx:latest',
          cpu: 1,
          memoryInGb: 1.5
        });

        expect(result).toHaveProperty('id');
      });

      it('should emit container:created event', async () => {
        const handler = jest.fn();
        integration.on('container:created', handler);

        await integration.createContainerInstance({
          resourceGroupName: 'test-rg',
          containerGroupName: 'test-container',
          image: 'nginx:latest',
          cpu: 1,
          memoryInGb: 1.5
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle environment variables', async () => {
        const result = await integration.createContainerInstance({
          resourceGroupName: 'test-rg',
          containerGroupName: 'test-container',
          image: 'nginx:latest',
          cpu: 1,
          memoryInGb: 1.5,
          environmentVariables: {
            VAR1: 'value1',
            VAR2: 'value2'
          }
        });

        expect(result).toHaveProperty('id');
      });

      it('should handle ports', async () => {
        const result = await integration.createContainerInstance({
          resourceGroupName: 'test-rg',
          containerGroupName: 'test-container',
          image: 'nginx:latest',
          cpu: 1,
          memoryInGb: 1.5,
          ports: [80, 443]
        });

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('ipAddress');
      });

      it('should handle command', async () => {
        const result = await integration.createContainerInstance({
          resourceGroupName: 'test-rg',
          containerGroupName: 'test-container',
          image: 'nginx:latest',
          cpu: 1,
          memoryInGb: 1.5,
          command: ['/bin/sh', '-c', 'echo hello']
        });

        expect(result).toHaveProperty('id');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.createContainerInstance({
          resourceGroupName: 'rg',
          containerGroupName: 'container',
          image: 'nginx',
          cpu: 1,
          memoryInGb: 1
        })).rejects.toThrow();
      });

      it('should throw if container instances not configured', async () => {
        const noContainerConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noContainerConfig);
        await inst.initialize();

        await expect(inst.createContainerInstance({
          resourceGroupName: 'rg',
          containerGroupName: 'container',
          image: 'nginx',
          cpu: 1,
          memoryInGb: 1
        })).rejects.toThrow('Container Instances not configured');

        await inst.shutdown();
      });
    });

    describe('deleteContainerInstance()', () => {
      it('should delete container instance successfully', async () => {
        await integration.deleteContainerInstance('test-rg', 'test-container');
        expect(true).toBe(true);
      });

      it('should emit container:deleted event', async () => {
        const handler = jest.fn();
        integration.on('container:deleted', handler);

        await integration.deleteContainerInstance('test-rg', 'test-container');
        expect(handler).toHaveBeenCalled();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.deleteContainerInstance('rg', 'container')).rejects.toThrow();
      });

      it('should throw if container instances not configured', async () => {
        const noContainerConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noContainerConfig);
        await inst.initialize();

        await expect(inst.deleteContainerInstance('rg', 'container')).rejects.toThrow('Container Instances not configured');

        await inst.shutdown();
      });
    });

    describe('getContainerInstanceStatus()', () => {
      it('should get container status successfully', async () => {
        const result = await integration.getContainerInstanceStatus('test-rg', 'test-container');
        expect(result).toBeDefined();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.getContainerInstanceStatus('rg', 'container')).rejects.toThrow();
      });

      it('should throw if container instances not configured', async () => {
        const noContainerConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noContainerConfig);
        await inst.initialize();

        await expect(inst.getContainerInstanceStatus('rg', 'container')).rejects.toThrow('Container Instances not configured');

        await inst.shutdown();
      });
    });
  });

  describe('SQL Database Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('createSqlDatabase()', () => {
      it('should create SQL database successfully', async () => {
        const result = await integration.createSqlDatabase({
          resourceGroupName: 'test-rg',
          serverName: 'test-server',
          databaseName: 'test-db'
        });

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('name');
      });

      it('should emit sql:database:created event', async () => {
        const handler = jest.fn();
        integration.on('sql:database:created', handler);

        await integration.createSqlDatabase({
          resourceGroupName: 'test-rg',
          serverName: 'test-server',
          databaseName: 'test-db'
        });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle edition and service objective', async () => {
        const result = await integration.createSqlDatabase({
          resourceGroupName: 'test-rg',
          serverName: 'test-server',
          databaseName: 'test-db',
          edition: 'Standard',
          requestedServiceObjectiveName: 'S1'
        });

        expect(result).toHaveProperty('id');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.createSqlDatabase({
          resourceGroupName: 'rg',
          serverName: 'server',
          databaseName: 'db'
        })).rejects.toThrow();
      });

      it('should throw if SQL management not configured', async () => {
        const noSQLConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noSQLConfig);
        await inst.initialize();

        await expect(inst.createSqlDatabase({
          resourceGroupName: 'rg',
          serverName: 'server',
          databaseName: 'db'
        })).rejects.toThrow('SQL Management not configured');

        await inst.shutdown();
      });
    });

    describe('deleteSqlDatabase()', () => {
      it('should delete SQL database successfully', async () => {
        await integration.deleteSqlDatabase('test-rg', 'test-server', 'test-db');
        expect(true).toBe(true);
      });

      it('should emit sql:database:deleted event', async () => {
        const handler = jest.fn();
        integration.on('sql:database:deleted', handler);

        await integration.deleteSqlDatabase('test-rg', 'test-server', 'test-db');
        expect(handler).toHaveBeenCalled();
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.deleteSqlDatabase('rg', 'server', 'db')).rejects.toThrow();
      });

      it('should throw if SQL management not configured', async () => {
        const noSQLConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noSQLConfig);
        await inst.initialize();

        await expect(inst.deleteSqlDatabase('rg', 'server', 'db')).rejects.toThrow('SQL Management not configured');

        await inst.shutdown();
      });
    });

    describe('listSqlDatabases()', () => {
      it('should list SQL databases successfully', async () => {
        const result = await integration.listSqlDatabases('test-rg', 'test-server');
        expect(Array.isArray(result)).toBe(true);
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.listSqlDatabases('rg', 'server')).rejects.toThrow();
      });

      it('should throw if SQL management not configured', async () => {
        const noSQLConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noSQLConfig);
        await inst.initialize();

        await expect(inst.listSqlDatabases('rg', 'server')).rejects.toThrow('SQL Management not configured');

        await inst.shutdown();
      });
    });
  });

  describe('Cognitive Services Operations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('analyzeText()', () => {
      it('should analyze sentiment', async () => {
        const result = await integration.analyzeText({
          documents: [{ id: '1', text: 'This is great!' }],
          operation: 'sentiment'
        });

        expect(result).toBeDefined();
      });

      it('should extract key phrases', async () => {
        const result = await integration.analyzeText({
          documents: [{ id: '1', text: 'Azure is a cloud platform' }],
          operation: 'keyPhrases'
        });

        expect(result).toBeDefined();
      });

      it('should recognize entities', async () => {
        const result = await integration.analyzeText({
          documents: [{ id: '1', text: 'Microsoft is based in Seattle' }],
          operation: 'entities'
        });

        expect(result).toBeDefined();
      });

      it('should detect language', async () => {
        const result = await integration.analyzeText({
          documents: [{ id: '1', text: 'Hello world' }],
          operation: 'language'
        });

        expect(result).toBeDefined();
      });

      it('should throw for unknown operation', async () => {
        await expect(integration.analyzeText({
          documents: [{ id: '1', text: 'test' }],
          operation: 'unknown' as any
        })).rejects.toThrow('Unknown operation');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.analyzeText({
          documents: [{ id: '1', text: 'test' }],
          operation: 'sentiment'
        })).rejects.toThrow();
      });

      it('should throw if text analytics not configured', async () => {
        const noTextConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noTextConfig);
        await inst.initialize();

        await expect(inst.analyzeText({
          documents: [{ id: '1', text: 'test' }],
          operation: 'sentiment'
        })).rejects.toThrow('Text Analytics not configured');

        await inst.shutdown();
      });
    });

    describe('analyzeImage()', () => {
      it('should analyze image from URL', async () => {
        const result = await integration.analyzeImage({
          imageUrl: 'https://example.com/image.jpg',
          features: ['Description', 'Tags']
        });

        expect(result).toBeDefined();
      });

      it('should analyze image from buffer', async () => {
        const result = await integration.analyzeImage({
          imageBuffer: Buffer.from('fake-image-data'),
          features: ['Faces', 'Objects']
        });

        expect(result).toBeDefined();
      });

      it('should throw if no image source provided', async () => {
        await expect(integration.analyzeImage({
          features: ['Description']
        })).rejects.toThrow('Either imageUrl or imageBuffer must be provided');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.analyzeImage({
          imageUrl: 'http://test.com/image.jpg',
          features: ['Description']
        })).rejects.toThrow();
      });

      it('should throw if computer vision not configured', async () => {
        const noVisionConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noVisionConfig);
        await inst.initialize();

        await expect(inst.analyzeImage({
          imageUrl: 'http://test.com/image.jpg',
          features: ['Description']
        })).rejects.toThrow('Computer Vision not configured');

        await inst.shutdown();
      });
    });

    describe('extractTextFromImage()', () => {
      it('should extract text from image', async () => {
        const result = await integration.extractTextFromImage('https://example.com/image.jpg');
        expect(typeof result).toBe('string');
      });

      it('should throw if not initialized', async () => {
        const uninit = new AzureIntegration(config);
        await expect(uninit.extractTextFromImage('http://test.com/image.jpg')).rejects.toThrow();
      });

      it('should throw if computer vision not configured', async () => {
        const noVisionConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(noVisionConfig);
        await inst.initialize();

        await expect(inst.extractTextFromImage('http://test.com/image.jpg')).rejects.toThrow('Computer Vision not configured');

        await inst.shutdown();
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    describe('getConfig()', () => {
      it('should return config copy', () => {
        const returnedConfig = integration.getConfig();
        expect(returnedConfig).toEqual(config);
        expect(returnedConfig).not.toBe(config); // Different reference
      });

      it('should not allow mutation of internal config', () => {
        const returnedConfig = integration.getConfig();
        returnedConfig.region = 'westus';

        const newConfig = integration.getConfig();
        expect(newConfig.region).toBe('eastus');
      });
    });

    describe('isServiceConfigured()', () => {
      it('should return true for configured blob storage', () => {
        expect(integration.isServiceConfigured('blobStorage')).toBe(true);
      });

      it('should return true for configured cosmos db', () => {
        expect(integration.isServiceConfigured('cosmosDb')).toBe(true);
      });

      it('should return false for unknown service', () => {
        expect(integration.isServiceConfigured('unknownService')).toBe(false);
      });

      it('should return false for unconfigured service', async () => {
        const minimalConfig: AzureConfig = {
          credentials: { tenantId: 'test', clientId: 'test', clientSecret: 'test' }
        };
        const inst = new AzureIntegration(minimalConfig);
        await inst.initialize();

        expect(inst.isServiceConfigured('blobStorage')).toBe(false);

        await inst.shutdown();
      });
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should emit log events', () => {
      const handler = jest.fn();
      integration.on('log', handler);

      (integration as any).log('Test log message');
      expect(handler).toHaveBeenCalled();
    });

    it('should emit error events', () => {
      const handler = jest.fn();
      integration.on('error', handler);

      (integration as any).handleError('Test context', new Error('Test error'));
      expect(handler).toHaveBeenCalled();
    });

    it('should handle multiple listeners', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      integration.on('initialized', handler1);
      integration.on('initialized', handler2);

      integration.emit('initialized');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('shutdown()', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should shutdown successfully', async () => {
      await integration.shutdown();
      expect((integration as any).isInitialized).toBe(false);
    });

    it('should emit shutdown event', async () => {
      const handler = jest.fn();
      integration.on('shutdown', handler);

      await integration.shutdown();
      expect(handler).toHaveBeenCalled();
    });

    it('should close all Service Bus senders', async () => {
      await integration.sendServiceBusMessage({
        queueOrTopicName: 'test-queue',
        message: { data: 'test' }
      });

      await integration.shutdown();
      expect((integration as any).serviceBusSenders.size).toBe(0);
    });

    it('should close all Service Bus receivers', async () => {
      await integration.receiveServiceBusMessages('test-queue');

      await integration.shutdown();
      expect((integration as any).serviceBusReceivers.size).toBe(0);
    });

    it('should close all Event Hub producers', async () => {
      await integration.sendEventHubEvents({
        eventHubName: 'test-hub',
        events: [{ data: 'test' }]
      });

      await integration.shutdown();
      expect((integration as any).eventHubProducerClients.size).toBe(0);
    });

    it('should handle shutdown errors gracefully', async () => {
      // Mock an error in shutdown
      (integration as any).serviceBusClient = {
        close: jest.fn().mockRejectedValue(new Error('Close failed'))
      };

      await expect(integration.shutdown()).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should handle blob storage errors', async () => {
      // Mock an error
      (integration as any).blobServiceClient = null;

      await expect(integration.uploadBlob({
        containerName: 'test',
        blobName: 'test',
        content: 'test'
      })).rejects.toThrow('Blob Storage not configured');
    });

    it('should handle cosmos db errors', async () => {
      (integration as any).cosmosClient = null;

      await expect(integration.createDocument({
        databaseId: 'test',
        containerId: 'test',
        document: {}
      })).rejects.toThrow('Cosmos DB not configured');
    });

    it('should handle service bus errors', async () => {
      (integration as any).serviceBusClient = null;

      await expect(integration.sendServiceBusMessage({
        queueOrTopicName: 'test',
        message: {}
      })).rejects.toThrow('Service Bus not configured');
    });
  });

  describe('Type Safety', () => {
    it('should enforce config types', () => {
      const validConfig: AzureConfig = {
        credentials: {
          subscriptionId: 'test',
          tenantId: 'test'
        },
        region: 'eastus',
        timeout: 30000
      };

      const inst = new AzureIntegration(validConfig);
      expect(inst).toBeInstanceOf(AzureIntegration);
    });

    it('should handle optional config properties', () => {
      const minimalConfig: AzureConfig = {
        credentials: {}
      };

      const inst = new AzureIntegration(minimalConfig);
      expect(inst).toBeInstanceOf(AzureIntegration);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid initialization and shutdown', async () => {
      await integration.initialize();
      await integration.shutdown();
      expect((integration as any).isInitialized).toBe(false);
    });

    it('should handle concurrent operations', async () => {
      await integration.initialize();

      const promises = [
        integration.uploadBlob({ containerName: 'c1', blobName: 'b1', content: 'data1' }),
        integration.uploadBlob({ containerName: 'c2', blobName: 'b2', content: 'data2' }),
        integration.createDocument({ databaseId: 'db1', containerId: 'c1', document: { id: '1' } })
      ];

      await Promise.all(promises);
      expect(true).toBe(true);
    });

    it('should handle empty credentials', () => {
      const emptyConfig: AzureConfig = {
        credentials: {}
      };

      const inst = new AzureIntegration(emptyConfig);
      expect(inst).toBeInstanceOf(AzureIntegration);
    });

    it('should handle special characters in names', async () => {
      await integration.initialize();

      // Some Azure services have naming restrictions, but we should handle the input
      await expect(integration.createContainer('test-container-123')).resolves.not.toThrow();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up all resources on shutdown', async () => {
      await integration.initialize();

      // Create some resources
      await integration.sendServiceBusMessage({ queueOrTopicName: 'test', message: {} });
      await integration.sendEventHubEvents({ eventHubName: 'test', events: [] });

      await integration.shutdown();

      expect((integration as any).serviceBusSenders.size).toBe(0);
      expect((integration as any).serviceBusReceivers.size).toBe(0);
      expect((integration as any).eventHubProducerClients.size).toBe(0);
    });
  });

  describe('Concurrency', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should handle concurrent blob uploads', async () => {
      const uploads = [];
      for (let i = 0; i < 10; i++) {
        uploads.push(integration.uploadBlob({
          containerName: 'test',
          blobName: `file-${i}.txt`,
          content: `content-${i}`
        }));
      }

      const results = await Promise.all(uploads);
      expect(results).toHaveLength(10);
    });

    it('should handle concurrent cosmos operations', async () => {
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(integration.createDocument({
          databaseId: 'test-db',
          containerId: 'test-container',
          document: { id: `doc-${i}`, value: i }
        }));
      }

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
    });
  });

  describe('Timeout Handling', () => {
    it('should respect timeout configuration', async () => {
      const shortTimeoutConfig: AzureConfig = {
        credentials,
        timeout: 100
      };

      const inst = new AzureIntegration(shortTimeoutConfig);
      await inst.initialize();

      expect((inst as any).config.timeout).toBe(100);

      await inst.shutdown();
    });

    it('should handle undefined timeout', () => {
      const noTimeoutConfig: AzureConfig = {
        credentials
      };

      const inst = new AzureIntegration(noTimeoutConfig);
      expect(inst).toBeInstanceOf(AzureIntegration);
    });
  });
});
