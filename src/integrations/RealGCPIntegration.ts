/**
 * Real GCP Integration with Google Cloud SDK
 * Cloud Storage, Firestore, Pub/Sub implementations
 */

import { EventEmitter } from 'events';
import { Storage, File, Bucket } from '@google-cloud/storage';
import { Firestore, DocumentReference, CollectionReference } from '@google-cloud/firestore';
import { PubSub, Topic, Subscription } from '@google-cloud/pubsub';

export interface GCPConfig {
  projectId: string;
  keyFilename?: string;
  credentials?: any;
}

export interface StorageUploadOptions {
  bucketName: string;
  fileName: string;
  data: Buffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface FirestoreDocument {
  collection: string;
  documentId?: string;
  data: Record<string, any>;
}

export class RealGCPIntegration extends EventEmitter {
  private storage: Storage;
  private firestore: Firestore;
  private pubsub: PubSub;
  private config: GCPConfig;

  constructor(config: GCPConfig) {
    super();
    this.config = config;

    const clientConfig = {
      projectId: config.projectId,
      keyFilename: config.keyFilename,
      credentials: config.credentials,
    };

    this.storage = new Storage(clientConfig);
    this.firestore = new Firestore(clientConfig);
    this.pubsub = new PubSub(clientConfig);
  }

  // ========================================================================
  // Cloud Storage Operations
  // ========================================================================

  async uploadToCloudStorage(options: StorageUploadOptions): Promise<string> {
    try {
      const bucket = this.storage.bucket(options.bucketName);
      const file = bucket.file(options.fileName);

      await file.save(options.data, {
        contentType: options.contentType || 'application/octet-stream',
        metadata: {
          metadata: options.metadata,
        },
      });

      const publicUrl = `https://storage.googleapis.com/${options.bucketName}/${options.fileName}`;

      this.emit('storage:uploaded', {
        bucket: options.bucketName,
        file: options.fileName,
        url: publicUrl,
      });

      return publicUrl;
    } catch (error: any) {
      this.emit('error', { operation: 'storage:upload', error: error.message });
      throw error;
    }
  }

  async downloadFromCloudStorage(bucketName: string, fileName: string): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      const [contents] = await file.download();

      this.emit('storage:downloaded', {
        bucket: bucketName,
        file: fileName,
        size: contents.length,
      });

      return contents;
    } catch (error: any) {
      this.emit('error', { operation: 'storage:download', error: error.message });
      throw error;
    }
  }

  async listCloudStorageFiles(bucketName: string, prefix?: string): Promise<string[]> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const [files] = await bucket.getFiles({ prefix });

      const fileNames = files.map((file) => file.name);

      this.emit('storage:listed', {
        bucket: bucketName,
        prefix,
        count: fileNames.length,
      });

      return fileNames;
    } catch (error: any) {
      this.emit('error', { operation: 'storage:list', error: error.message });
      throw error;
    }
  }

  async deleteFromCloudStorage(bucketName: string, fileName: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      await file.delete();

      this.emit('storage:deleted', { bucket: bucketName, file: fileName });
    } catch (error: any) {
      this.emit('error', { operation: 'storage:delete', error: error.message });
      throw error;
    }
  }

  async createBucket(bucketName: string, location: string = 'US'): Promise<void> {
    try {
      await this.storage.createBucket(bucketName, {
        location,
        storageClass: 'STANDARD',
      });

      this.emit('storage:bucket-created', { bucket: bucketName, location });
    } catch (error: any) {
      this.emit('error', { operation: 'storage:create-bucket', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // Firestore Operations
  // ========================================================================

  async addDocumentToFirestore(options: FirestoreDocument): Promise<string> {
    try {
      const collectionRef = this.firestore.collection(options.collection);

      let docRef: DocumentReference;

      if (options.documentId) {
        docRef = collectionRef.doc(options.documentId);
        await docRef.set(options.data);
      } else {
        docRef = await collectionRef.add(options.data);
      }

      const documentId = docRef.id;

      this.emit('firestore:added', {
        collection: options.collection,
        documentId,
      });

      return documentId;
    } catch (error: any) {
      this.emit('error', { operation: 'firestore:add', error: error.message });
      throw error;
    }
  }

  async getDocumentFromFirestore(collection: string, documentId: string): Promise<Record<string, any> | null> {
    try {
      const docRef = this.firestore.collection(collection).doc(documentId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();

      this.emit('firestore:get', { collection, documentId });

      return data || null;
    } catch (error: any) {
      this.emit('error', { operation: 'firestore:get', error: error.message });
      throw error;
    }
  }

  async queryFirestore(
    collection: string,
    field: string,
    operator: FirebaseFirestore.WhereFilterOp,
    value: any
  ): Promise<Record<string, any>[]> {
    try {
      const collectionRef = this.firestore.collection(collection);
      const querySnapshot = await collectionRef.where(field, operator, value).get();

      const results: Record<string, any>[] = [];

      querySnapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      this.emit('firestore:query', {
        collection,
        field,
        operator,
        count: results.length,
      });

      return results;
    } catch (error: any) {
      this.emit('error', { operation: 'firestore:query', error: error.message });
      throw error;
    }
  }

  async updateDocumentInFirestore(
    collection: string,
    documentId: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const docRef = this.firestore.collection(collection).doc(documentId);

      await docRef.update(data);

      this.emit('firestore:updated', { collection, documentId });
    } catch (error: any) {
      this.emit('error', { operation: 'firestore:update', error: error.message });
      throw error;
    }
  }

  async deleteDocumentFromFirestore(collection: string, documentId: string): Promise<void> {
    try {
      const docRef = this.firestore.collection(collection).doc(documentId);

      await docRef.delete();

      this.emit('firestore:deleted', { collection, documentId });
    } catch (error: any) {
      this.emit('error', { operation: 'firestore:delete', error: error.message });
      throw error;
    }
  }

  async listCollections(): Promise<string[]> {
    try {
      const collections = await this.firestore.listCollections();

      const collectionNames = collections.map((col) => col.id);

      this.emit('firestore:collections-listed', { count: collectionNames.length });

      return collectionNames;
    } catch (error: any) {
      this.emit('error', { operation: 'firestore:list-collections', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // Pub/Sub Operations
  // ========================================================================

  async publishToPubSub(topicName: string, message: string, attributes?: Record<string, string>): Promise<string> {
    try {
      const topic = this.pubsub.topic(topicName);

      const messageId = await topic.publishMessage({
        data: Buffer.from(message),
        attributes,
      });

      this.emit('pubsub:published', { topic: topicName, messageId });

      return messageId;
    } catch (error: any) {
      this.emit('error', { operation: 'pubsub:publish', error: error.message });
      throw error;
    }
  }

  async subscribeToTopic(
    topicName: string,
    subscriptionName: string,
    handler: (message: any) => void
  ): Promise<void> {
    try {
      const subscription = this.pubsub.subscription(subscriptionName);

      subscription.on('message', (message) => {
        const data = message.data.toString();
        handler({
          id: message.id,
          data,
          attributes: message.attributes,
          publishTime: message.publishTime,
          ack: () => message.ack(),
          nack: () => message.nack(),
        });
      });

      subscription.on('error', (error) => {
        this.emit('error', { operation: 'pubsub:subscription', error: error.message });
      });

      this.emit('pubsub:subscribed', { topic: topicName, subscription: subscriptionName });
    } catch (error: any) {
      this.emit('error', { operation: 'pubsub:subscribe', error: error.message });
      throw error;
    }
  }

  async createTopic(topicName: string): Promise<void> {
    try {
      await this.pubsub.createTopic(topicName);

      this.emit('pubsub:topic-created', { topic: topicName });
    } catch (error: any) {
      this.emit('error', { operation: 'pubsub:create-topic', error: error.message });
      throw error;
    }
  }

  async createSubscription(topicName: string, subscriptionName: string): Promise<void> {
    try {
      const topic = this.pubsub.topic(topicName);

      await topic.createSubscription(subscriptionName);

      this.emit('pubsub:subscription-created', {
        topic: topicName,
        subscription: subscriptionName,
      });
    } catch (error: any) {
      this.emit('error', { operation: 'pubsub:create-subscription', error: error.message });
      throw error;
    }
  }

  async deleteTopic(topicName: string): Promise<void> {
    try {
      const topic = this.pubsub.topic(topicName);

      await topic.delete();

      this.emit('pubsub:topic-deleted', { topic: topicName });
    } catch (error: any) {
      this.emit('error', { operation: 'pubsub:delete-topic', error: error.message });
      throw error;
    }
  }

  async listTopics(): Promise<string[]> {
    try {
      const [topics] = await this.pubsub.getTopics();

      const topicNames = topics.map((topic) => topic.name);

      this.emit('pubsub:topics-listed', { count: topicNames.length });

      return topicNames;
    } catch (error: any) {
      this.emit('error', { operation: 'pubsub:list-topics', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      // Try to list storage buckets as health check
      await this.storage.getBuckets();
      return true;
    } catch (error) {
      return false;
    }
  }

  async close(): Promise<void> {
    // Close all connections
    await this.pubsub.close();

    this.emit('closed');
  }
}

export default RealGCPIntegration;
