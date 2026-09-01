/**
 * Data Encryption System
 * Comprehensive encryption for data at rest and in transit, key management, and HSM integration
 */
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
export declare enum EncryptionAlgorithm {
    AES_128_GCM = "aes-128-gcm",
    AES_256_GCM = "aes-256-gcm",
    AES_128_CBC = "aes-128-cbc",
    AES_256_CBC = "aes-256-cbc",
    RSA_2048 = "rsa-2048",
    RSA_4096 = "rsa-4096",
    ChaCha20 = "chacha20",
    Ed25519 = "ed25519"
}
export declare enum KeyPurpose {
    Encryption = "encryption",
    Decryption = "decryption",
    Signing = "signing",
    Verification = "verification",
    KeyWrapping = "key_wrapping"
}
export declare enum KeyStatus {
    Active = "active",
    Inactive = "inactive",
    Compromised = "compromised",
    Destroyed = "destroyed",
    Archived = "archived"
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
    interval: number;
    autoRotate: boolean;
    retainOldVersions: number;
}
export interface AccessPolicy {
    principals: string[];
    operations: KeyOperation[];
    conditions?: AccessCondition[];
}
export declare enum KeyOperation {
    Encrypt = "encrypt",
    Decrypt = "decrypt",
    Sign = "sign",
    Verify = "verify",
    Wrap = "wrap",
    Unwrap = "unwrap",
    Rotate = "rotate",
    Delete = "delete"
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
export declare enum KDFAlgorithm {
    PBKDF2 = "pbkdf2",
    HKDF = "hkdf",
    Scrypt = "scrypt",
    Argon2 = "argon2"
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
export declare enum HSMType {
    CloudHSM = "cloudhsm",
    PKCS11 = "pkcs11",
    AzureKeyVault = "azure_key_vault",
    AWSKMS = "aws_kms",
    GoogleCloudKMS = "google_cloud_kms"
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
export declare enum TargetType {
    File = "file",
    Directory = "directory",
    Database = "database",
    Volume = "volume",
    Object = "object"
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
export declare enum TransportProtocol {
    HTTPS = "https",
    TLS = "tls",
    DTLS = "dtls",
    SSH = "ssh",
    QUIC = "quic"
}
export declare enum TLSVersion {
    TLS_1_0 = "tls_1_0",
    TLS_1_1 = "tls_1_1",
    TLS_1_2 = "tls_1_2",
    TLS_1_3 = "tls_1_3"
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
export declare enum CertificateType {
    SelfSigned = "self_signed",
    CA = "ca",
    Server = "server",
    Client = "client"
}
export declare enum CertificateStatus {
    Valid = "valid",
    Expired = "expired",
    Revoked = "revoked",
    Pending = "pending"
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
export declare enum EncryptionOperation {
    KeyGeneration = "key_generation",
    KeyRotation = "key_rotation",
    KeyDeletion = "key_deletion",
    Encryption = "encryption",
    Decryption = "decryption",
    Signing = "signing",
    Verification = "verification",
    KeyExport = "key_export",
    KeyImport = "key_import"
}
/**
 * Key Manager
 */
export declare class KeyManager {
    private keys;
    private keyVersions;
    /**
     * Generate encryption key
     */
    generateKey(config: Omit<EncryptionKey, 'id' | 'status' | 'version' | 'material' | 'createdAt'>): Promise<EncryptionKey>;
    /**
     * Generate key pair (asymmetric)
     */
    generateKeyPair(algorithm: EncryptionAlgorithm): Promise<{
        publicKey: string;
        privateKey: string;
    }>;
    /**
     * Rotate key
     */
    rotateKey(keyId: string): Promise<EncryptionKey>;
    /**
     * Get key
     */
    getKey(keyId: string, version?: number): EncryptionKey | undefined;
    /**
     * List keys
     */
    listKeys(filter?: {
        purpose?: KeyPurpose;
        status?: KeyStatus;
    }): EncryptionKey[];
    /**
     * Delete key
     */
    deleteKey(keyId: string): Promise<void>;
    /**
     * Derive key
     */
    deriveKey(config: KeyDerivationConfig, password: string): Promise<Buffer>;
    private generateKeyMaterial;
    private generateKeyId;
}
/**
 * Encryption Service
 */
export declare class EncryptionService {
    private keyManager;
    private audits;
    constructor(keyManager: KeyManager);
    /**
     * Encrypt data
     */
    encrypt(data: Buffer, keyId: string, additionalData?: Record<string, any>): Promise<EncryptedData>;
    /**
     * Decrypt data
     */
    decrypt(encryptedData: EncryptedData): Promise<DecryptionResult>;
    /**
     * Sign data
     */
    sign(data: Buffer, keyId: string): Promise<SignatureResult>;
    /**
     * Verify signature
     */
    verify(data: Buffer, signature: Buffer, keyId: string): Promise<VerificationResult>;
    /**
     * Wrap key
     */
    wrapKey(keyId: string, wrappingKeyId: string): Promise<KeyWrapResult>;
    /**
     * Get audit logs
     */
    getAuditLogs(filter?: {
        keyId?: string;
        operation?: EncryptionOperation;
    }): EncryptionAudit[];
    private audit;
}
/**
 * Certificate Manager
 */
export declare class CertificateManager {
    private certificates;
    /**
     * Generate self-signed certificate
     */
    generateSelfSigned(config: {
        name: string;
        subject: string;
        validDays: number;
    }): Promise<Certificate>;
    /**
     * Import certificate
     */
    importCertificate(config: Omit<Certificate, 'id' | 'createdAt'>): Certificate;
    /**
     * Get certificate
     */
    getCertificate(certId: string): Certificate | undefined;
    /**
     * List certificates
     */
    listCertificates(filter?: {
        type?: CertificateType;
        status?: CertificateStatus;
    }): Certificate[];
    /**
     * Revoke certificate
     */
    revokeCertificate(certId: string): void;
    private generateCertId;
}
/**
 * Secret Vault
 */
export declare class SecretVaultManager {
    private vaults;
    private encryptionService;
    constructor(encryptionService: EncryptionService);
    /**
     * Create vault
     */
    createVault(name: string): SecretVault;
    /**
     * Store secret
     */
    storeSecret(vaultId: string, name: string, value: Buffer, keyId?: string, metadata?: Record<string, any>): Promise<Secret>;
    /**
     * Retrieve secret
     */
    retrieveSecret(vaultId: string, secretId: string, principal: string): Promise<Buffer>;
    /**
     * Get vault
     */
    getVault(vaultId: string): SecretVault | undefined;
    /**
     * List vaults
     */
    listVaults(): SecretVault[];
    private logAccess;
    private generateVaultId;
    private generateSecretId;
}
/**
 * Singleton instances
 */
export declare const keyManager: KeyManager;
export declare const encryptionService: EncryptionService;
export declare const certificateManager: CertificateManager;
export declare const secretVaultManager: SecretVaultManager;
//# sourceMappingURL=EncryptionSystem.d.ts.map