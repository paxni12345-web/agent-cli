"use strict";
/**
 * Data Encryption System
 * Comprehensive encryption for data at rest and in transit, key management, and HSM integration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretVaultManager = exports.certificateManager = exports.encryptionService = exports.keyManager = exports.SecretVaultManager = exports.CertificateManager = exports.EncryptionService = exports.KeyManager = exports.EncryptionOperation = exports.CertificateStatus = exports.CertificateType = exports.TLSVersion = exports.TransportProtocol = exports.TargetType = exports.HSMType = exports.KDFAlgorithm = exports.KeyOperation = exports.KeyStatus = exports.KeyPurpose = exports.EncryptionAlgorithm = void 0;
const EventBus_1 = require("../core/EventBus");
const crypto = __importStar(require("crypto"));
var EncryptionAlgorithm;
(function (EncryptionAlgorithm) {
    EncryptionAlgorithm["AES_128_GCM"] = "aes-128-gcm";
    EncryptionAlgorithm["AES_256_GCM"] = "aes-256-gcm";
    EncryptionAlgorithm["AES_128_CBC"] = "aes-128-cbc";
    EncryptionAlgorithm["AES_256_CBC"] = "aes-256-cbc";
    EncryptionAlgorithm["RSA_2048"] = "rsa-2048";
    EncryptionAlgorithm["RSA_4096"] = "rsa-4096";
    EncryptionAlgorithm["ChaCha20"] = "chacha20";
    EncryptionAlgorithm["Ed25519"] = "ed25519";
})(EncryptionAlgorithm || (exports.EncryptionAlgorithm = EncryptionAlgorithm = {}));
var KeyPurpose;
(function (KeyPurpose) {
    KeyPurpose["Encryption"] = "encryption";
    KeyPurpose["Decryption"] = "decryption";
    KeyPurpose["Signing"] = "signing";
    KeyPurpose["Verification"] = "verification";
    KeyPurpose["KeyWrapping"] = "key_wrapping";
})(KeyPurpose || (exports.KeyPurpose = KeyPurpose = {}));
var KeyStatus;
(function (KeyStatus) {
    KeyStatus["Active"] = "active";
    KeyStatus["Inactive"] = "inactive";
    KeyStatus["Compromised"] = "compromised";
    KeyStatus["Destroyed"] = "destroyed";
    KeyStatus["Archived"] = "archived";
})(KeyStatus || (exports.KeyStatus = KeyStatus = {}));
var KeyOperation;
(function (KeyOperation) {
    KeyOperation["Encrypt"] = "encrypt";
    KeyOperation["Decrypt"] = "decrypt";
    KeyOperation["Sign"] = "sign";
    KeyOperation["Verify"] = "verify";
    KeyOperation["Wrap"] = "wrap";
    KeyOperation["Unwrap"] = "unwrap";
    KeyOperation["Rotate"] = "rotate";
    KeyOperation["Delete"] = "delete";
})(KeyOperation || (exports.KeyOperation = KeyOperation = {}));
var KDFAlgorithm;
(function (KDFAlgorithm) {
    KDFAlgorithm["PBKDF2"] = "pbkdf2";
    KDFAlgorithm["HKDF"] = "hkdf";
    KDFAlgorithm["Scrypt"] = "scrypt";
    KDFAlgorithm["Argon2"] = "argon2";
})(KDFAlgorithm || (exports.KDFAlgorithm = KDFAlgorithm = {}));
var HSMType;
(function (HSMType) {
    HSMType["CloudHSM"] = "cloudhsm";
    HSMType["PKCS11"] = "pkcs11";
    HSMType["AzureKeyVault"] = "azure_key_vault";
    HSMType["AWSKMS"] = "aws_kms";
    HSMType["GoogleCloudKMS"] = "google_cloud_kms";
})(HSMType || (exports.HSMType = HSMType = {}));
var TargetType;
(function (TargetType) {
    TargetType["File"] = "file";
    TargetType["Directory"] = "directory";
    TargetType["Database"] = "database";
    TargetType["Volume"] = "volume";
    TargetType["Object"] = "object";
})(TargetType || (exports.TargetType = TargetType = {}));
var TransportProtocol;
(function (TransportProtocol) {
    TransportProtocol["HTTPS"] = "https";
    TransportProtocol["TLS"] = "tls";
    TransportProtocol["DTLS"] = "dtls";
    TransportProtocol["SSH"] = "ssh";
    TransportProtocol["QUIC"] = "quic";
})(TransportProtocol || (exports.TransportProtocol = TransportProtocol = {}));
var TLSVersion;
(function (TLSVersion) {
    TLSVersion["TLS_1_0"] = "tls_1_0";
    TLSVersion["TLS_1_1"] = "tls_1_1";
    TLSVersion["TLS_1_2"] = "tls_1_2";
    TLSVersion["TLS_1_3"] = "tls_1_3";
})(TLSVersion || (exports.TLSVersion = TLSVersion = {}));
var CertificateType;
(function (CertificateType) {
    CertificateType["SelfSigned"] = "self_signed";
    CertificateType["CA"] = "ca";
    CertificateType["Server"] = "server";
    CertificateType["Client"] = "client";
})(CertificateType || (exports.CertificateType = CertificateType = {}));
var CertificateStatus;
(function (CertificateStatus) {
    CertificateStatus["Valid"] = "valid";
    CertificateStatus["Expired"] = "expired";
    CertificateStatus["Revoked"] = "revoked";
    CertificateStatus["Pending"] = "pending";
})(CertificateStatus || (exports.CertificateStatus = CertificateStatus = {}));
var EncryptionOperation;
(function (EncryptionOperation) {
    EncryptionOperation["KeyGeneration"] = "key_generation";
    EncryptionOperation["KeyRotation"] = "key_rotation";
    EncryptionOperation["KeyDeletion"] = "key_deletion";
    EncryptionOperation["Encryption"] = "encryption";
    EncryptionOperation["Decryption"] = "decryption";
    EncryptionOperation["Signing"] = "signing";
    EncryptionOperation["Verification"] = "verification";
    EncryptionOperation["KeyExport"] = "key_export";
    EncryptionOperation["KeyImport"] = "key_import";
})(EncryptionOperation || (exports.EncryptionOperation = EncryptionOperation = {}));
/**
 * Key Manager
 */
class KeyManager {
    keys = new Map();
    keyVersions = new Map();
    /**
     * Generate encryption key
     */
    async generateKey(config) {
        const keyMaterial = await this.generateKeyMaterial(config.algorithm, config.keySize);
        const key = {
            ...config,
            id: this.generateKeyId(),
            status: KeyStatus.Active,
            version: 1,
            material: keyMaterial,
            createdAt: new Date(),
        };
        this.keys.set(key.id, key);
        // Initialize version tracking
        const versions = new Map();
        versions.set(1, key);
        this.keyVersions.set(key.id, versions);
        EventBus_1.eventBus.emitSync('encryption.key_generated', key, 'KeyManager');
        return key;
    }
    /**
     * Generate key pair (asymmetric)
     */
    async generateKeyPair(algorithm) {
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
    async rotateKey(keyId) {
        const currentKey = this.keys.get(keyId);
        if (!currentKey) {
            throw new Error(`Key not found: ${keyId}`);
        }
        // Generate new version
        const newVersion = currentKey.version + 1;
        const newMaterial = await this.generateKeyMaterial(currentKey.algorithm, currentKey.keySize);
        const newKey = {
            ...currentKey,
            version: newVersion,
            material: newMaterial,
            rotatedAt: new Date(),
        };
        // Update active key
        this.keys.set(keyId, newKey);
        // Store version
        const versions = this.keyVersions.get(keyId);
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
        EventBus_1.eventBus.emitSync('encryption.key_rotated', { keyId, oldVersion: currentKey.version, newVersion }, 'KeyManager');
        return newKey;
    }
    /**
     * Get key
     */
    getKey(keyId, version) {
        if (version !== undefined) {
            const versions = this.keyVersions.get(keyId);
            return versions?.get(version);
        }
        return this.keys.get(keyId);
    }
    /**
     * List keys
     */
    listKeys(filter) {
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
    async deleteKey(keyId) {
        const key = this.keys.get(keyId);
        if (key) {
            key.status = KeyStatus.Destroyed;
            key.material = undefined;
            EventBus_1.eventBus.emitSync('encryption.key_deleted', { keyId }, 'KeyManager');
        }
    }
    /**
     * Derive key
     */
    async deriveKey(config, password) {
        // Mock key derivation
        return crypto.pbkdf2Sync(password, config.salt, config.iterations, config.keyLength, 'sha256');
    }
    async generateKeyMaterial(algorithm, keySize) {
        // Mock key generation
        return crypto.randomBytes(keySize / 8);
    }
    generateKeyId() {
        return `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.KeyManager = KeyManager;
/**
 * Encryption Service
 */
class EncryptionService {
    keyManager;
    audits = [];
    constructor(keyManager) {
        this.keyManager = keyManager;
    }
    /**
     * Encrypt data
     */
    async encrypt(data, keyId, additionalData) {
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
        const result = {
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
    async decrypt(encryptedData) {
        const key = this.keyManager.getKey(encryptedData.context.keyId);
        if (!key || !key.material) {
            this.audit(EncryptionOperation.Decryption, encryptedData.context.keyId, false, 'Key not found');
            throw new Error(`Key not found: ${encryptedData.context.keyId}`);
        }
        // Decrypt data
        const decipher = crypto.createDecipheriv('aes-256-gcm', key.material.slice(0, 32), encryptedData.context.iv);
        decipher.setAuthTag(encryptedData.context.authTag);
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
    async sign(data, keyId) {
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
    async verify(data, signature, keyId) {
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
    async wrapKey(keyId, wrappingKeyId) {
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
    getAuditLogs(filter) {
        let logs = this.audits;
        if (filter?.keyId) {
            logs = logs.filter(log => log.keyId === filter.keyId);
        }
        if (filter?.operation) {
            logs = logs.filter(log => log.operation === filter.operation);
        }
        return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    audit(operation, keyId, success, error) {
        const audit = {
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
        EventBus_1.eventBus.emitSync('encryption.audit_logged', audit, 'EncryptionService');
    }
}
exports.EncryptionService = EncryptionService;
/**
 * Certificate Manager
 */
class CertificateManager {
    certificates = new Map();
    /**
     * Generate self-signed certificate
     */
    async generateSelfSigned(config) {
        // Mock certificate generation
        const cert = {
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
        EventBus_1.eventBus.emitSync('encryption.certificate_generated', cert, 'CertificateManager');
        return cert;
    }
    /**
     * Import certificate
     */
    importCertificate(config) {
        const cert = {
            ...config,
            id: this.generateCertId(),
            createdAt: new Date(),
        };
        this.certificates.set(cert.id, cert);
        EventBus_1.eventBus.emitSync('encryption.certificate_imported', cert, 'CertificateManager');
        return cert;
    }
    /**
     * Get certificate
     */
    getCertificate(certId) {
        return this.certificates.get(certId);
    }
    /**
     * List certificates
     */
    listCertificates(filter) {
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
    revokeCertificate(certId) {
        const cert = this.certificates.get(certId);
        if (cert) {
            cert.status = CertificateStatus.Revoked;
            EventBus_1.eventBus.emitSync('encryption.certificate_revoked', cert, 'CertificateManager');
        }
    }
    generateCertId() {
        return `cert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.CertificateManager = CertificateManager;
/**
 * Secret Vault
 */
class SecretVaultManager {
    vaults = new Map();
    encryptionService;
    constructor(encryptionService) {
        this.encryptionService = encryptionService;
    }
    /**
     * Create vault
     */
    createVault(name) {
        const vault = {
            id: this.generateVaultId(),
            name,
            secrets: new Map(),
            accessLog: [],
            createdAt: new Date(),
        };
        this.vaults.set(vault.id, vault);
        EventBus_1.eventBus.emitSync('encryption.vault_created', vault, 'SecretVaultManager');
        return vault;
    }
    /**
     * Store secret
     */
    async storeSecret(vaultId, name, value, keyId, metadata) {
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
        const secret = {
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
    async retrieveSecret(vaultId, secretId, principal) {
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
    getVault(vaultId) {
        return this.vaults.get(vaultId);
    }
    /**
     * List vaults
     */
    listVaults() {
        return Array.from(this.vaults.values());
    }
    logAccess(vault, operation, secretId, principal, success, reason) {
        vault.accessLog.push({
            timestamp: new Date(),
            principal,
            operation,
            secretId,
            success,
            reason,
        });
    }
    generateVaultId() {
        return `vault_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSecretId() {
        return `secret_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SecretVaultManager = SecretVaultManager;
/**
 * Singleton instances
 */
exports.keyManager = new KeyManager();
exports.encryptionService = new EncryptionService(exports.keyManager);
exports.certificateManager = new CertificateManager();
exports.secretVaultManager = new SecretVaultManager(exports.encryptionService);
