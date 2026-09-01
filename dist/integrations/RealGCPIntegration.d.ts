/**
 * Real GCP Integration with Google Cloud SDK
 * Cloud Storage, Firestore, Pub/Sub implementations
 */
import { EventEmitter } from 'events';
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
export declare class RealGCPIntegration extends EventEmitter {
    private storage;
    private firestore;
    private pubsub;
    private config;
    constructor(config: GCPConfig);
    uploadToCloudStorage(options: StorageUploadOptions): Promise<string>;
    downloadFromCloudStorage(bucketName: string, fileName: string): Promise<Buffer>;
    listCloudStorageFiles(bucketName: string, prefix?: string): Promise<string[]>;
    deleteFromCloudStorage(bucketName: string, fileName: string): Promise<void>;
    createBucket(bucketName: string, location?: string): Promise<void>;
    addDocumentToFirestore(options: FirestoreDocument): Promise<string>;
    getDocumentFromFirestore(collection: string, documentId: string): Promise<Record<string, any> | null>;
    queryFirestore(collection: string, field: string, operator: FirebaseFirestore.WhereFilterOp, value: any): Promise<Record<string, any>[]>;
    updateDocumentInFirestore(collection: string, documentId: string, data: Record<string, any>): Promise<void>;
    deleteDocumentFromFirestore(collection: string, documentId: string): Promise<void>;
    listCollections(): Promise<string[]>;
    publishToPubSub(topicName: string, message: string, attributes?: Record<string, string>): Promise<string>;
    subscribeToTopic(topicName: string, subscriptionName: string, handler: (message: any) => void): Promise<void>;
    createTopic(topicName: string): Promise<void>;
    createSubscription(topicName: string, subscriptionName: string): Promise<void>;
    deleteTopic(topicName: string): Promise<void>;
    listTopics(): Promise<string[]>;
    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
}
export default RealGCPIntegration;
//# sourceMappingURL=RealGCPIntegration.d.ts.map