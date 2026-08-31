/**
 * Data Encryption System
 * Comprehensive encryption for data at rest and in transit, key management, and HSM integration
 */

import { eventBus } from '../core/EventBus';
import * as crypto from 'crypto';

export interface EncryptionKey {
  id: string;
  name: string;
  algorithm: EncryptionAlgorithm;
  keySize: number;
  purpose: KeyPurpose;
  status: KeyStatus;
  version: number;
  material?: Buffer;
  publicKey?: string;
  privateKey?: string;
  metadata: KeyMetadata;
  createdAt: Date;
  expiresAt?: Date;
  rotatedAt?: Date;
}

export enum EncryptionAlgorithm {
  AES_128_GCM = 'aes-128-gcm',
  AES_256_GCM = 'aes-256-gcm',
  AES_128_CBC = 'aes-128-cbc',
  AES_256_CBC = 'aes-256-cbc',
  RSA_2048 = 'rsa-2048',
  RSA_4096 = 'rsa-4096',
  ChaCha20 = 'chacha20',
  Ed25519 = 'ed25519',
}

export enum KeyPurpose {
  Encryption = 'encryption',
  Decryption = 'decryption',
  Signing = 'signing',
  Verification = 'verification',
  KeyWrapping = 'key_wrapping',
}

export enum KeyStatus {
  Active = 'active',
  Inactive = 'inactive',
  Compromised = 'compromised',
  Destroyed = 'destroyed',
  Archived = 'archived',
}

export interface KeyMetadata {
  owner: string;
  tags: string[];
  rotationPolicy?: RotationPolicy;
  accessPolicy?: AccessPolicy;
  auditEnabled: boolean;
}

export interface RotationPolicy {
  enabled: boolean;
  interval: number; // milliseconds
  autoRotate: boolean;
  retainOldVersions: number;
}

export interface AccessPolicy {
  principals: string[];
  operations: KeyOperation[];
  conditions?: AccessCondition[];
}

export enum KeyOperation {
  Encrypt = 'encrypt',
  Decrypt = 'decrypt',
  Sign = 'sign',
  Verify = 'verify',
  Wrap = 'wrap',
  Unwrap = 'unwrap',
  Rotate = 'rotate',
  Delete = 'delete',
}

export interface AccessCondition {
  field: string;
  operator: string;
  value: any;
}

export interface EncryptionContext {
  keyId: string;
  algorithm: EncryptionAlgorithm;
  iv?: Buffer;
  authTag?: Buffer;
  additionalData?: Record<string, any>;
}

export interface EncryptedData {
  ciphertext: Buffer;
  context: EncryptionContext;
  encryptedAt: Date;
}

export interface DecryptionResult {
  plaintext: Buffer;
  keyId: string;
  algorithm: EncryptionAlgorithm;
  decryptedAt: Date;
}

export interface SignatureResult {
  signature: Buffer;
  keyId: string;
  algorithm: string;
  signedAt: Date;
}

export interface VerificationResult {
  valid: boolean;
  keyId: string;
  algorithm: string;
  verifiedAt: Date;
}

export interface KeyDerivationConfig {
  algorithm: KDFAlgorithm;
  iterations: number;
  keyLength: number;
  salt: Buffer;
}

export enum KDFAlgorithm {
  PBKDF2 = 'pbkdf2',
  HKDF = 'hkdf',
  Scrypt = 'scrypt',
  Argon2 = 'argon2',
}

export interface HSMConfig {
  id: string;
  name: string;
  type: HSMType;
  endpoint: string;
  credentials: HSMCredentials;
  enabled: boolean;
  metadata: Record<string, any>;
}

export enum HSMType {
  CloudHSM = 'cloudhsm',
  PKCS11 = 'pkcs11',
  AzureKeyVault = 'azure_key_vault',
  AWSKMS = 'aws_kms',
  GoogleCloudKMS = 'google_cloud_kms',
}

export interface HSMCredentials {
  username?: string;
  password?: string;
  token?: string;
  certificatePath?: string;
}

export interface DataAtRestEncryption {
  id: string;
  name: string;
  targetType: TargetType;
  targetPath: string;
  keyId: string;
  algorithm: EncryptionAlgorithm;
  enabled: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
}

export enum TargetType {
  File = 'file',
  Directory = 'directory',
  Database = 'database',
  Volume = 'volume',
  Object = 'object',
}

export interface DataInTransitEncryption {
  id: string;
  name: string;
  protocol: TransportProtocol;
  tlsVersion: TLSVersion;
  cipherSuites: string[];
  certificateId: string;
  enabled: boolean;
  createdAt: Date;
}

export enum TransportProtocol {
  HTTPS = 'https',
  TLS = 'tls',
  DTLS = 'dtls',
  SSH = 'ssh',
  QUIC = 'quic',
}

export enum TLSVersion {
  TLS_1_0 = 'tls_1_0',
  TLS_1_1 = 'tls_1_1',
  TLS_1_2 = 'tls_1_2',
  TLS_1_3 = 'tls_1_3',
}

export interface Certificate {
  id: string;
  name: string;
  type: CertificateType;
  subject: string;
  issuer: string;
  serialNumber: string;
  publicKey: string;
  privateKey?: string;
  chain?: string[];
  status: CertificateStatus;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
}

export enum CertificateType {
  SelfSigned = 'self_signed',
  CA = 'ca',
  Server = 'server',
  Client = 'client',
}

export enum CertificateStatus {
  Valid = 'valid',
  Expired = 'expired',
  Revoked = 'revoked',
  Pending = 'pending',
}

export interface KeyWrapResult {
  wrappedKey: Buffer;
  wrappingKeyId: string;
  algorithm: EncryptionAlgorithm;
  wrappedAt: Date;
}

export interface SecretVault {
  id: string;
  name: string;
  secrets: Map<string, Secret>;
  accessLog: AccessLog[];
  createdAt: Date;
}

export interface Secret {
  id: string;
  name: string;
  value: Buffer;
  encrypted: boolean;
  keyId?: string;
  version: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface AccessLog {
  timestamp: Date;
  principal: string;
  operation: string;
  secretId: string;
  success: boolean;
  reason?: string;
}

export interface EncryptionAudit {
  id: string;
  operation: EncryptionOperation;
  keyId: string;
  principal: string;
  success: boolean;
  error?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export enum EncryptionOperation {
  KeyGeneration = 'key_generation',
  KeyRotation = 'key_rotation',
  KeyDeletion = 'key_deletion',
  Encryption = 'encryption',
  Decryption = 'decryption',
  Signing = 'signing',
  Verification = 'verification',
  KeyExport = 'key_export',
  KeyImport = 'key_import',
}

/**
 * Key Manager
 */
export class KeyManager {
  private keys: Map<string, EncryptionKey> = new Map();
  private keyVersions: Map<string, Map<number, EncryptionKey>> = new Map();

  /**
   * Generate encryption key
   */
  async generateKey(config: Omit<EncryptionKey, 'id' | 'status' | 'version' | 'material' | 'createdAt'>): Promise<EncryptionKey> {
    const keyMaterial = await this.generateKeyMaterial(config.algorithm, config.keySize);

    const key: EncryptionKey = {
      ...config,
      id: this.generateKeyId(),
      status: KeyStatus.Active,
      version: 1,
      material: keyMaterial,
      createdAt: new Date(),
    };

    this.keys.set(key.id, key);

    // Initialize version tracking
    const versions = new Map<number, EncryptionKey>();
    versions.set(1, key);
    this.keyVersions.set(key.id, versions);

    eventBus.emitSync('encryption.key_generated', key, 'KeyManager');

    return key;
  }

  /**
   * Generate key pair (asymmetric)
   */
  async generateKeyPair(algorithm: EncryptionAlgorithm): Promise<{ publicKey: string; privateKey: string }> {
    // Mock key pair generation
    const keyPair = {
      publicKey: `-----BEGIN PUBLIC KEY-----\n${crypto.randomBytes(64).toString('base64')}\n-----END PUBLIC KEY-----`,
      privateKey: `-----BEGIN PRIVATE KEY-----\n${crypto.randomBytes(128).toString('base64')}\n-----END PRIVATE KEY-----`,
    };

    return keyPair;
  }

  /**
   * Rotate key
   */
  async rotateKey(keyId: string): Promise<EncryptionKey> {
    const currentKey = this.keys.get(keyId);

    if (!currentKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Generate new version
    const newVersion = currentKey.version + 1;
    const newMaterial = await this.generateKeyMaterial(currentKey.algorithm, currentKey.keySize);

    const newKey: EncryptionKey = {
      ...currentKey,
      version: newVersion,
      material: newMaterial,
      rotatedAt: new Date(),
    };

    // Update active key
    this.keys.set(keyId, newKey);

    // Store version
    const versions = this.keyVersions.get(keyId)!;
    versions.set(newVersion, newKey);

    // Apply retention policy
    if (currentKey.metadata.rotationPolicy?.retainOldVersions) {
      const retain = currentKey.metadata.rotationPolicy.retainOldVersions;
      const versionNumbers = Array.from(versions.keys()).sort((a, b) => b - a);

      if (versionNumbers.length > retain) {
        const toDelete = versionNumbers.slice(retain);
        toDelete.forEach(v => versions.delete(v));
      }
    }

    eventBus.emitSync('encryption.key_rotated', { keyId, oldVersion: currentKey.version, newVersion }, 'KeyManager');

    return newKey;
  }

  /**
   * Get key
   */
  getKey(keyId: string, version?: number): EncryptionKey | undefined {
    if (version !== undefined) {
      const versions = this.keyVersions.get(keyId);
      return versions?.get(version);
    }

    return this.keys.get(keyId);
  }

  /**
   * List keys
   */
  listKeys(filter?: { purpose?: KeyPurpose; status?: KeyStatus }): EncryptionKey[] {
    let keys = Array.from(this.keys.values());

    if (filter?.purpose) {
      keys = keys.filter(k => k.purpose === filter.purpose);
    }

    if (filter?.status) {
      keys = keys.filter(k => k.status === filter.status);
    }

    return keys;
  }

  /**
   * Delete key
   */
  async deleteKey(keyId: string): Promise<void> {
    const key = this.keys.get(keyId);

    if (key) {
      key.status = KeyStatus.Destroyed;
      key.material = undefined;

      eventBus.emitSync('encryption.key_deleted', { keyId }, 'KeyManager');
    }
  }

  /**
   * Derive key
   */
  async deriveKey(config: KeyDerivationConfig, password: string): Promise<Buffer> {
    // Mock key derivation
    return crypto.pbkdf2Sync(password, config.salt, config.iterations, config.keyLength, 'sha256');
  }

  private async generateKeyMaterial(algorithm: EncryptionAlgorithm, keySize: number): Promise<Buffer> {
    // Mock key generation
    return crypto.randomBytes(keySize / 8);
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Encryption Service
 */
export class EncryptionService {
  private keyManager: KeyManager;
  private audits: EncryptionAudit[] = [];

  constructor(keyManager: KeyManager) {
    this.keyManager = keyManager;
  }

  /**
   * Encrypt data
   */
  async encrypt(data: Buffer, keyId: string, additionalData?: Record<string, any>): Promise<EncryptedData> {
    const key = this.keyManager.getKey(keyId);

    if (!key || !key.material) {
      throw new Error(`Key not found or unavailable: ${keyId}`);
    }

    if (key.status !== KeyStatus.Active) {
      throw new Error(`Key is not active: ${keyId}`);
    }

    // Generate IV
    const iv = crypto.randomBytes(16);

    // Encrypt data
    const cipher = crypto.createCipheriv('aes-256-gcm', key.material.slice(0, 32), iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const result: EncryptedData = {
      ciphertext: encrypted,
      context: {
        keyId,
        algorithm: key.algorithm,
        iv,
        authTag,
        additionalData,
      },
      encryptedAt: new Date(),
    };

    this.audit(EncryptionOperation.Encryption, keyId, true);

    return result;
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptedData): Promise<DecryptionResult> {
    const key = this.keyManager.getKey(encryptedData.context.keyId);

    if (!key || !key.material) {
      this.audit(EncryptionOperation.Decryption, encryptedData.context.keyId, false, 'Key not found');
      throw new Error(`Key not found: ${encryptedData.context.keyId}`);
    }

    // Decrypt data
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key.material.slice(0, 32),
      encryptedData.context.iv!
    );

    decipher.setAuthTag(encryptedData.context.authTag!);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData.ciphertext),
      decipher.final(),
    ]);

    this.audit(EncryptionOperation.Decryption, encryptedData.context.keyId, true);

    return {
      plaintext: decrypted,
      keyId: encryptedData.context.keyId,
      algorithm: encryptedData.context.algorithm,
      decryptedAt: new Date(),
    };
  }

  /**
   * Sign data
   */
  async sign(data: Buffer, keyId: string): Promise<SignatureResult> {
    const key = this.keyManager.getKey(keyId);

    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Mock signing
    const signature = crypto.createHmac('sha256', key.material || Buffer.alloc(32)).update(data).digest();

    this.audit(EncryptionOperation.Signing, keyId, true);

    return {
      signature,
      keyId,
      algorithm: 'hmac-sha256',
      signedAt: new Date(),
    };
  }

  /**
   * Verify signature
   */
  async verify(data: Buffer, signature: Buffer, keyId: string): Promise<VerificationResult> {
    const key = this.keyManager.getKey(keyId);

    if (!key) {
      this.audit(EncryptionOperation.Verification, keyId, false, 'Key not found');
      throw new Error(`Key not found: ${keyId}`);
    }

    // Mock verification
    const expectedSignature = crypto.createHmac('sha256', key.material || Buffer.alloc(32)).update(data).digest();
    const valid = crypto.timingSafeEqual(signature, expectedSignature);

    this.audit(EncryptionOperation.Verification, keyId, true);

    return {
      valid,
      keyId,
      algorithm: 'hmac-sha256',
      verifiedAt: new Date(),
    };
  }

  /**
   * Wrap key
   */
  async wrapKey(keyId: string, wrappingKeyId: string): Promise<KeyWrapResult> {
    const key = this.keyManager.getKey(keyId);
    const wrappingKey = this.keyManager.getKey(wrappingKeyId);

    if (!key || !wrappingKey) {
      throw new Error('Key not found');
    }

    if (!key.material || !wrappingKey.material) {
      throw new Error('Key material not available');
    }

    // Wrap key using wrapping key
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey.material.slice(0, 32), iv);
    const wrapped = Buffer.concat([cipher.update(key.material), cipher.final()]);

    return {
      wrappedKey: Buffer.concat([iv, cipher.getAuthTag(), wrapped]),
      wrappingKeyId,
      algorithm: wrappingKey.algorithm,
      wrappedAt: new Date(),
    };
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filter?: { keyId?: string; operation?: EncryptionOperation }): EncryptionAudit[] {
    let logs = this.audits;

    if (filter?.keyId) {
      logs = logs.filter(log => log.keyId === filter.keyId);
    }

    if (filter?.operation) {
      logs = logs.filter(log => log.operation === filter.operation);
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private audit(operation: EncryptionOperation, keyId: string, success: boolean, error?: string): void {
    const audit: EncryptionAudit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      operation,
      keyId,
      principal: 'system',
      success,
      error,
      metadata: {},
      timestamp: new Date(),
    };

    this.audits.push(audit);

    eventBus.emitSync('encryption.audit_logged', audit, 'EncryptionService');
  }
}

/**
 * Certificate Manager
 */
export class CertificateManager {
  private certificates: Map<string, Certificate> = new Map();

  /**
   * Generate self-signed certificate
   */
  async generateSelfSigned(config: {
    name: string;
    subject: string;
    validDays: number;
  }): Promise<Certificate> {
    // Mock certificate generation
    const cert: Certificate = {
      id: this.generateCertId(),
      name: config.name,
      type: CertificateType.SelfSigned,
      subject: config.subject,
      issuer: config.subject,
      serialNumber: crypto.randomBytes(16).toString('hex'),
      publicKey: `-----BEGIN CERTIFICATE-----\n${crypto.randomBytes(128).toString('base64')}\n-----END CERTIFICATE-----`,
      status: CertificateStatus.Valid,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + config.validDays * 86400000),
      createdAt: new Date(),
    };

    this.certificates.set(cert.id, cert);

    eventBus.emitSync('encryption.certificate_generated', cert, 'CertificateManager');

    return cert;
  }

  /**
   * Import certificate
   */
  importCertificate(config: Omit<Certificate, 'id' | 'createdAt'>): Certificate {
    const cert: Certificate = {
      ...config,
      id: this.generateCertId(),
      createdAt: new Date(),
    };

    this.certificates.set(cert.id, cert);

    eventBus.emitSync('encryption.certificate_imported', cert, 'CertificateManager');

    return cert;
  }

  /**
   * Get certificate
   */
  getCertificate(certId: string): Certificate | undefined {
    return this.certificates.get(certId);
  }

  /**
   * List certificates
   */
  listCertificates(filter?: { type?: CertificateType; status?: CertificateStatus }): Certificate[] {
    let certs = Array.from(this.certificates.values());

    if (filter?.type) {
      certs = certs.filter(c => c.type === filter.type);
    }

    if (filter?.status) {
      certs = certs.filter(c => c.status === filter.status);
    }

    return certs;
  }

  /**
   * Revoke certificate
   */
  revokeCertificate(certId: string): void {
    const cert = this.certificates.get(certId);

    if (cert) {
      cert.status = CertificateStatus.Revoked;
      eventBus.emitSync('encryption.certificate_revoked', cert, 'CertificateManager');
    }
  }

  private generateCertId(): string {
    return `cert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Secret Vault
 */
export class SecretVaultManager {
  private vaults: Map<string, SecretVault> = new Map();
  private encryptionService: EncryptionService;

  constructor(encryptionService: EncryptionService) {
    this.encryptionService = encryptionService;
  }

  /**
   * Create vault
   */
  createVault(name: string): SecretVault {
    const vault: SecretVault = {
      id: this.generateVaultId(),
      name,
      secrets: new Map(),
      accessLog: [],
      createdAt: new Date(),
    };

    this.vaults.set(vault.id, vault);

    eventBus.emitSync('encryption.vault_created', vault, 'SecretVaultManager');

    return vault;
  }

  /**
   * Store secret
   */
  async storeSecret(
    vaultId: string,
    name: string,
    value: Buffer,
    keyId?: string,
    metadata?: Record<string, any>
  ): Promise<Secret> {
    const vault = this.vaults.get(vaultId);

    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    let secretValue = value;
    let encrypted = false;

    if (keyId) {
      const encryptedData = await this.encryptionService.encrypt(value, keyId);
      secretValue = encryptedData.ciphertext;
      encrypted = true;
    }

    const secret: Secret = {
      id: this.generateSecretId(),
      name,
      value: secretValue,
      encrypted,
      keyId,
      version: 1,
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vault.secrets.set(secret.id, secret);

    this.logAccess(vault, 'store', secret.id, 'system', true);

    return secret;
  }

  /**
   * Retrieve secret
   */
  async retrieveSecret(vaultId: string, secretId: string, principal: string): Promise<Buffer> {
    const vault = this.vaults.get(vaultId);

    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const secret = vault.secrets.get(secretId);

    if (!secret) {
      this.logAccess(vault, 'retrieve', secretId, principal, false, 'Secret not found');
      throw new Error(`Secret not found: ${secretId}`);
    }

    let value = secret.value;

    if (secret.encrypted && secret.keyId) {
      const decrypted = await this.encryptionService.decrypt({
        ciphertext: secret.value,
        context: {
          keyId: secret.keyId,
          algorithm: EncryptionAlgorithm.AES_256_GCM,
        },
        encryptedAt: secret.createdAt,
      });

      value = decrypted.plaintext;
    }

    this.logAccess(vault, 'retrieve', secretId, principal, true);

    return value;
  }

  /**
   * Get vault
   */
  getVault(vaultId: string): SecretVault | undefined {
    return this.vaults.get(vaultId);
  }

  /**
   * List vaults
   */
  listVaults(): SecretVault[] {
    return Array.from(this.vaults.values());
  }

  private logAccess(vault: SecretVault, operation: string, secretId: string, principal: string, success: boolean, reason?: string): void {
    vault.accessLog.push({
      timestamp: new Date(),
      principal,
      operation,
      secretId,
      success,
      reason,
    });
  }

  private generateVaultId(): string {
    return `vault_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSecretId(): string {
    return `secret_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const keyManager = new KeyManager();
export const encryptionService = new EncryptionService(keyManager);
export const certificateManager = new CertificateManager();
export const secretVaultManager = new SecretVaultManager(encryptionService);
