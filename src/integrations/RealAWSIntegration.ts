/**
 * Real AWS Integration with AWS SDK v3
 * S3, DynamoDB, Lambda, SQS, KMS implementations
 */

import { EventEmitter } from 'events';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  ScanCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  LambdaClient,
  InvokeCommand,
} from '@aws-sdk/client-lambda';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';

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

export class RealAWSIntegration extends EventEmitter {
  private s3Client: S3Client;
  private dynamoClient: DynamoDBClient;
  private lambdaClient: LambdaClient;
  private sqsClient: SQSClient;
  private kmsClient: KMSClient;
  private config: AWSConfig;

  constructor(config: AWSConfig) {
    super();
    this.config = config;

    const clientConfig = {
      region: config.region,
      credentials: config.accessKeyId && config.secretAccessKey ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      } : undefined,
    };

    this.s3Client = new S3Client(clientConfig);
    this.dynamoClient = new DynamoDBClient(clientConfig);
    this.lambdaClient = new LambdaClient(clientConfig);
    this.sqsClient = new SQSClient(clientConfig);
    this.kmsClient = new KMSClient(clientConfig);
  }

  // ========================================================================
  // S3 Operations
  // ========================================================================

  async uploadToS3(options: S3UploadOptions): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata,
      });

      await this.s3Client.send(command);

      const url = `https://${options.bucket}.s3.${this.config.region}.amazonaws.com/${options.key}`;

      this.emit('s3:uploaded', { bucket: options.bucket, key: options.key, url });

      return url;
    } catch (error: any) {
      this.emit('error', { operation: 's3:upload', error: error.message });
      throw error;
    }
  }

  async downloadFromS3(options: S3DownloadOptions): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      this.emit('s3:downloaded', { bucket: options.bucket, key: options.key, size: buffer.length });

      return buffer;
    } catch (error: any) {
      this.emit('error', { operation: 's3:download', error: error.message });
      throw error;
    }
  }

  async listS3Objects(bucket: string, prefix?: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      const keys = (response.Contents || []).map((obj) => obj.Key!).filter(Boolean);

      this.emit('s3:listed', { bucket, prefix, count: keys.length });

      return keys;
    } catch (error: any) {
      this.emit('error', { operation: 's3:list', error: error.message });
      throw error;
    }
  }

  async deleteFromS3(bucket: string, key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);

      this.emit('s3:deleted', { bucket, key });
    } catch (error: any) {
      this.emit('error', { operation: 's3:delete', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // DynamoDB Operations
  // ========================================================================

  async putItemDynamoDB(options: DynamoDBPutOptions): Promise<void> {
    try {
      const command = new PutItemCommand({
        TableName: options.tableName,
        Item: this.marshallItem(options.item),
      });

      await this.dynamoClient.send(command);

      this.emit('dynamodb:put', { tableName: options.tableName });
    } catch (error: any) {
      this.emit('error', { operation: 'dynamodb:put', error: error.message });
      throw error;
    }
  }

  async getItemDynamoDB(options: DynamoDBGetOptions): Promise<Record<string, any> | null> {
    try {
      const command = new GetItemCommand({
        TableName: options.tableName,
        Key: this.marshallItem(options.key),
      });

      const response = await this.dynamoClient.send(command);

      if (!response.Item) {
        return null;
      }

      const item = this.unmarshallItem(response.Item);

      this.emit('dynamodb:get', { tableName: options.tableName });

      return item;
    } catch (error: any) {
      this.emit('error', { operation: 'dynamodb:get', error: error.message });
      throw error;
    }
  }

  async queryDynamoDB(tableName: string, keyCondition: string, values: Record<string, any>): Promise<Record<string, any>[]> {
    try {
      const command = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: this.marshallItem(values),
      });

      const response = await this.dynamoClient.send(command);

      const items = (response.Items || []).map((item) => this.unmarshallItem(item));

      this.emit('dynamodb:query', { tableName, count: items.length });

      return items;
    } catch (error: any) {
      this.emit('error', { operation: 'dynamodb:query', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // Lambda Operations
  // ========================================================================

  async invokeLambda(functionName: string, payload: any): Promise<any> {
    try {
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
      });

      const response = await this.lambdaClient.send(command);

      if (!response.Payload) {
        throw new Error('Empty lambda response');
      }

      const result = JSON.parse(Buffer.from(response.Payload).toString());

      this.emit('lambda:invoked', { functionName, statusCode: response.StatusCode });

      return result;
    } catch (error: any) {
      this.emit('error', { operation: 'lambda:invoke', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // SQS Operations
  // ========================================================================

  async sendToSQS(queueUrl: string, message: string, attributes?: Record<string, string>): Promise<string> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: message,
        MessageAttributes: attributes ? this.marshallMessageAttributes(attributes) : undefined,
      });

      const response = await this.sqsClient.send(command);

      const messageId = response.MessageId!;

      this.emit('sqs:sent', { queueUrl, messageId });

      return messageId;
    } catch (error: any) {
      this.emit('error', { operation: 'sqs:send', error: error.message });
      throw error;
    }
  }

  async receiveFromSQS(queueUrl: string, maxMessages: number = 1): Promise<any[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // Long polling
      });

      const response = await this.sqsClient.send(command);

      const messages = response.Messages || [];

      this.emit('sqs:received', { queueUrl, count: messages.length });

      return messages;
    } catch (error: any) {
      this.emit('error', { operation: 'sqs:receive', error: error.message });
      throw error;
    }
  }

  async deleteFromSQS(queueUrl: string, receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);

      this.emit('sqs:deleted', { queueUrl });
    } catch (error: any) {
      this.emit('error', { operation: 'sqs:delete', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // KMS Operations
  // ========================================================================

  async encryptWithKMS(keyId: string, plaintext: string): Promise<string> {
    try {
      const command = new EncryptCommand({
        KeyId: keyId,
        Plaintext: Buffer.from(plaintext),
      });

      const response = await this.kmsClient.send(command);

      if (!response.CiphertextBlob) {
        throw new Error('Empty ciphertext');
      }

      const ciphertext = Buffer.from(response.CiphertextBlob).toString('base64');

      this.emit('kms:encrypted', { keyId });

      return ciphertext;
    } catch (error: any) {
      this.emit('error', { operation: 'kms:encrypt', error: error.message });
      throw error;
    }
  }

  async decryptWithKMS(ciphertext: string): Promise<string> {
    try {
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(ciphertext, 'base64'),
      });

      const response = await this.kmsClient.send(command);

      if (!response.Plaintext) {
        throw new Error('Empty plaintext');
      }

      const plaintext = Buffer.from(response.Plaintext).toString();

      this.emit('kms:decrypted', {});

      return plaintext;
    } catch (error: any) {
      this.emit('error', { operation: 'kms:decrypt', error: error.message });
      throw error;
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private marshallItem(item: Record<string, any>): Record<string, any> {
    const marshalled: Record<string, any> = {};

    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'string') {
        marshalled[key] = { S: value };
      } else if (typeof value === 'number') {
        marshalled[key] = { N: value.toString() };
      } else if (typeof value === 'boolean') {
        marshalled[key] = { BOOL: value };
      } else if (value === null) {
        marshalled[key] = { NULL: true };
      } else if (Array.isArray(value)) {
        marshalled[key] = { L: value.map((v) => this.marshallItem({ v }).v) };
      } else if (typeof value === 'object') {
        marshalled[key] = { M: this.marshallItem(value) };
      }
    }

    return marshalled;
  }

  private unmarshallItem(item: Record<string, any>): Record<string, any> {
    const unmarshalled: Record<string, any> = {};

    for (const [key, value] of Object.entries(item)) {
      if (value.S !== undefined) {
        unmarshalled[key] = value.S;
      } else if (value.N !== undefined) {
        unmarshalled[key] = parseFloat(value.N);
      } else if (value.BOOL !== undefined) {
        unmarshalled[key] = value.BOOL;
      } else if (value.NULL !== undefined) {
        unmarshalled[key] = null;
      } else if (value.L !== undefined) {
        unmarshalled[key] = value.L.map((v: any) => this.unmarshallItem({ v }).v);
      } else if (value.M !== undefined) {
        unmarshalled[key] = this.unmarshallItem(value.M);
      }
    }

    return unmarshalled;
  }

  private marshallMessageAttributes(attributes: Record<string, string>): Record<string, any> {
    const marshalled: Record<string, any> = {};

    for (const [key, value] of Object.entries(attributes)) {
      marshalled[key] = {
        DataType: 'String',
        StringValue: value,
      };
    }

    return marshalled;
  }

  async close(): Promise<void> {
    this.s3Client.destroy();
    this.dynamoClient.destroy();
    this.lambdaClient.destroy();
    this.sqsClient.destroy();
    this.kmsClient.destroy();

    this.emit('closed');
  }
}

export default RealAWSIntegration;
