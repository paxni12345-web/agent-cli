"use strict";
/**
 * Real AWS Integration with AWS SDK v3
 * S3, DynamoDB, Lambda, SQS, KMS implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealAWSIntegration = void 0;
const events_1 = require("events");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_lambda_1 = require("@aws-sdk/client-lambda");
const client_sqs_1 = require("@aws-sdk/client-sqs");
const client_kms_1 = require("@aws-sdk/client-kms");
class RealAWSIntegration extends events_1.EventEmitter {
    s3Client;
    dynamoClient;
    lambdaClient;
    sqsClient;
    kmsClient;
    config;
    constructor(config) {
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
        this.s3Client = new client_s3_1.S3Client(clientConfig);
        this.dynamoClient = new client_dynamodb_1.DynamoDBClient(clientConfig);
        this.lambdaClient = new client_lambda_1.LambdaClient(clientConfig);
        this.sqsClient = new client_sqs_1.SQSClient(clientConfig);
        this.kmsClient = new client_kms_1.KMSClient(clientConfig);
    }
    // ========================================================================
    // S3 Operations
    // ========================================================================
    async uploadToS3(options) {
        try {
            const command = new client_s3_1.PutObjectCommand({
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
        }
        catch (error) {
            this.emit('error', { operation: 's3:upload', error: error.message });
            throw error;
        }
    }
    async downloadFromS3(options) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: options.bucket,
                Key: options.key,
            });
            const response = await this.s3Client.send(command);
            if (!response.Body) {
                throw new Error('Empty response body');
            }
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            this.emit('s3:downloaded', { bucket: options.bucket, key: options.key, size: buffer.length });
            return buffer;
        }
        catch (error) {
            this.emit('error', { operation: 's3:download', error: error.message });
            throw error;
        }
    }
    async listS3Objects(bucket, prefix) {
        try {
            const command = new client_s3_1.ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
            });
            const response = await this.s3Client.send(command);
            const keys = (response.Contents || []).map((obj) => obj.Key).filter(Boolean);
            this.emit('s3:listed', { bucket, prefix, count: keys.length });
            return keys;
        }
        catch (error) {
            this.emit('error', { operation: 's3:list', error: error.message });
            throw error;
        }
    }
    async deleteFromS3(bucket, key) {
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            });
            await this.s3Client.send(command);
            this.emit('s3:deleted', { bucket, key });
        }
        catch (error) {
            this.emit('error', { operation: 's3:delete', error: error.message });
            throw error;
        }
    }
    // ========================================================================
    // DynamoDB Operations
    // ========================================================================
    async putItemDynamoDB(options) {
        try {
            const command = new client_dynamodb_1.PutItemCommand({
                TableName: options.tableName,
                Item: this.marshallItem(options.item),
            });
            await this.dynamoClient.send(command);
            this.emit('dynamodb:put', { tableName: options.tableName });
        }
        catch (error) {
            this.emit('error', { operation: 'dynamodb:put', error: error.message });
            throw error;
        }
    }
    async getItemDynamoDB(options) {
        try {
            const command = new client_dynamodb_1.GetItemCommand({
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
        }
        catch (error) {
            this.emit('error', { operation: 'dynamodb:get', error: error.message });
            throw error;
        }
    }
    async queryDynamoDB(tableName, keyCondition, values) {
        try {
            const command = new client_dynamodb_1.QueryCommand({
                TableName: tableName,
                KeyConditionExpression: keyCondition,
                ExpressionAttributeValues: this.marshallItem(values),
            });
            const response = await this.dynamoClient.send(command);
            const items = (response.Items || []).map((item) => this.unmarshallItem(item));
            this.emit('dynamodb:query', { tableName, count: items.length });
            return items;
        }
        catch (error) {
            this.emit('error', { operation: 'dynamodb:query', error: error.message });
            throw error;
        }
    }
    // ========================================================================
    // Lambda Operations
    // ========================================================================
    async invokeLambda(functionName, payload) {
        try {
            const command = new client_lambda_1.InvokeCommand({
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
        }
        catch (error) {
            this.emit('error', { operation: 'lambda:invoke', error: error.message });
            throw error;
        }
    }
    // ========================================================================
    // SQS Operations
    // ========================================================================
    async sendToSQS(queueUrl, message, attributes) {
        try {
            const command = new client_sqs_1.SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: message,
                MessageAttributes: attributes ? this.marshallMessageAttributes(attributes) : undefined,
            });
            const response = await this.sqsClient.send(command);
            const messageId = response.MessageId;
            this.emit('sqs:sent', { queueUrl, messageId });
            return messageId;
        }
        catch (error) {
            this.emit('error', { operation: 'sqs:send', error: error.message });
            throw error;
        }
    }
    async receiveFromSQS(queueUrl, maxMessages = 1) {
        try {
            const command = new client_sqs_1.ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: maxMessages,
                WaitTimeSeconds: 20, // Long polling
            });
            const response = await this.sqsClient.send(command);
            const messages = response.Messages || [];
            this.emit('sqs:received', { queueUrl, count: messages.length });
            return messages;
        }
        catch (error) {
            this.emit('error', { operation: 'sqs:receive', error: error.message });
            throw error;
        }
    }
    async deleteFromSQS(queueUrl, receiptHandle) {
        try {
            const command = new client_sqs_1.DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: receiptHandle,
            });
            await this.sqsClient.send(command);
            this.emit('sqs:deleted', { queueUrl });
        }
        catch (error) {
            this.emit('error', { operation: 'sqs:delete', error: error.message });
            throw error;
        }
    }
    // ========================================================================
    // KMS Operations
    // ========================================================================
    async encryptWithKMS(keyId, plaintext) {
        try {
            const command = new client_kms_1.EncryptCommand({
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
        }
        catch (error) {
            this.emit('error', { operation: 'kms:encrypt', error: error.message });
            throw error;
        }
    }
    async decryptWithKMS(ciphertext) {
        try {
            const command = new client_kms_1.DecryptCommand({
                CiphertextBlob: Buffer.from(ciphertext, 'base64'),
            });
            const response = await this.kmsClient.send(command);
            if (!response.Plaintext) {
                throw new Error('Empty plaintext');
            }
            const plaintext = Buffer.from(response.Plaintext).toString();
            this.emit('kms:decrypted', {});
            return plaintext;
        }
        catch (error) {
            this.emit('error', { operation: 'kms:decrypt', error: error.message });
            throw error;
        }
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    marshallItem(item) {
        const marshalled = {};
        for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string') {
                marshalled[key] = { S: value };
            }
            else if (typeof value === 'number') {
                marshalled[key] = { N: value.toString() };
            }
            else if (typeof value === 'boolean') {
                marshalled[key] = { BOOL: value };
            }
            else if (value === null) {
                marshalled[key] = { NULL: true };
            }
            else if (Array.isArray(value)) {
                marshalled[key] = { L: value.map((v) => this.marshallItem({ v }).v) };
            }
            else if (typeof value === 'object') {
                marshalled[key] = { M: this.marshallItem(value) };
            }
        }
        return marshalled;
    }
    unmarshallItem(item) {
        const unmarshalled = {};
        for (const [key, value] of Object.entries(item)) {
            if (value.S !== undefined) {
                unmarshalled[key] = value.S;
            }
            else if (value.N !== undefined) {
                unmarshalled[key] = parseFloat(value.N);
            }
            else if (value.BOOL !== undefined) {
                unmarshalled[key] = value.BOOL;
            }
            else if (value.NULL !== undefined) {
                unmarshalled[key] = null;
            }
            else if (value.L !== undefined) {
                unmarshalled[key] = value.L.map((v) => this.unmarshallItem({ v }).v);
            }
            else if (value.M !== undefined) {
                unmarshalled[key] = this.unmarshallItem(value.M);
            }
        }
        return unmarshalled;
    }
    marshallMessageAttributes(attributes) {
        const marshalled = {};
        for (const [key, value] of Object.entries(attributes)) {
            marshalled[key] = {
                DataType: 'String',
                StringValue: value,
            };
        }
        return marshalled;
    }
    async close() {
        this.s3Client.destroy();
        this.dynamoClient.destroy();
        this.lambdaClient.destroy();
        this.sqsClient.destroy();
        this.kmsClient.destroy();
        this.emit('closed');
    }
}
exports.RealAWSIntegration = RealAWSIntegration;
exports.default = RealAWSIntegration;
