/**
 * Real AWS Integration with AWS SDK v3
 * S3, DynamoDB, Lambda, SQS, KMS implementations
 */
import { EventEmitter } from 'events';
export interface AWSConfig {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
}
export interface S3UploadOptions {
    bucket: string;
    key: string;
    body: Buffer | string;
    contentType?: string;
    metadata?: Record<string, string>;
}
export interface S3DownloadOptions {
    bucket: string;
    key: string;
}
export interface DynamoDBPutOptions {
    tableName: string;
    item: Record<string, any>;
}
export interface DynamoDBGetOptions {
    tableName: string;
    key: Record<string, any>;
}
export declare class RealAWSIntegration extends EventEmitter {
    private s3Client;
    private dynamoClient;
    private lambdaClient;
    private sqsClient;
    private kmsClient;
    private config;
    constructor(config: AWSConfig);
    uploadToS3(options: S3UploadOptions): Promise<string>;
    downloadFromS3(options: S3DownloadOptions): Promise<Buffer>;
    listS3Objects(bucket: string, prefix?: string): Promise<string[]>;
    deleteFromS3(bucket: string, key: string): Promise<void>;
    putItemDynamoDB(options: DynamoDBPutOptions): Promise<void>;
    getItemDynamoDB(options: DynamoDBGetOptions): Promise<Record<string, any> | null>;
    queryDynamoDB(tableName: string, keyCondition: string, values: Record<string, any>): Promise<Record<string, any>[]>;
    invokeLambda(functionName: string, payload: any): Promise<any>;
    sendToSQS(queueUrl: string, message: string, attributes?: Record<string, string>): Promise<string>;
    receiveFromSQS(queueUrl: string, maxMessages?: number): Promise<any[]>;
    deleteFromSQS(queueUrl: string, receiptHandle: string): Promise<void>;
    encryptWithKMS(keyId: string, plaintext: string): Promise<string>;
    decryptWithKMS(ciphertext: string): Promise<string>;
    private marshallItem;
    private unmarshallItem;
    private marshallMessageAttributes;
    close(): Promise<void>;
}
export default RealAWSIntegration;
//# sourceMappingURL=RealAWSIntegration.d.ts.map