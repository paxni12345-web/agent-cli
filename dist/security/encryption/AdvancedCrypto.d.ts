/**
 * AdvancedCrypto - Advanced encryption and cryptographic operations
 * Homomorphic encryption, zero-knowledge proofs, and post-quantum cryptography
 */
import { EventEmitter } from 'events';
export interface EncryptionConfig {
    algorithm: string;
    keySize: number;
    mode: string;
    padding: string;
}
export interface KeyPair {
    publicKey: string;
    privateKey: string;
    algorithm: string;
    created: Date;
    expires?: Date;
}
export interface EncryptedData {
    ciphertext: string;
    iv: string;
    tag?: string;
    algorithm: string;
    metadata?: Record<string, any>;
    keyVersion?: number;
    hmac?: string;
}
export interface ZKProof {
    proof: string;
    publicInputs: string[];
    verificationKey: string;
    created: Date;
}
export interface HomomorphicOperation {
    type: 'add' | 'multiply' | 'compare';
    operands: string[];
    result: string;
}
export interface DerivedKey {
    key: Buffer;
    salt: Buffer;
    version: number;
    created: Date;
    algorithm: string;
}
export interface KeyRotationPolicy {
    maxAge: number;
    maxOperations: number;
    autoRotate: boolean;
}
export declare class AdvancedCryptoSystem extends EventEmitter {
    private keyPairs;
    private encryptionConfigs;
    private derivedKeys;
    private currentKeyVersion;
    private keyOperationCount;
    private keyRotationPolicy;
    constructor();
    private initializeConfigs;
    /**
     * Generate key pair
     */
    generateKeyPair(algorithm?: string, keySize?: number): Promise<KeyPair>;
    /**
     * Derive encryption key using PBKDF2
     */
    deriveKey(password: string, salt?: Buffer, iterations?: number, keyLength?: number): DerivedKey;
    /**
     * Rotate encryption key
     */
    rotateKey(password: string): DerivedKey;
    /**
     * Check if key rotation is needed
     */
    private shouldRotateKey;
    /**
     * Set key rotation policy
     */
    setKeyRotationPolicy(policy: Partial<KeyRotationPolicy>): void;
    /**
     * Symmetric encryption with AES-256-GCM (secure AEAD)
     */
    encrypt(data: string, key: Buffer, algorithm?: string): EncryptedData;
    /**
     * Symmetric decryption with integrity verification
     */
    decrypt(encrypted: EncryptedData, key: Buffer): string;
    /**
     * Asymmetric encryption
     */
    encryptAsymmetric(data: string, publicKey: string): string;
    /**
     * Asymmetric decryption
     */
    decryptAsymmetric(encrypted: string, privateKey: string): string;
    /**
     * Homomorphic encryption (simplified simulation)
     */
    homomorphicEncrypt(value: number, publicKey: string): string;
    /**
     * Homomorphic addition
     */
    homomorphicAdd(encrypted1: string, encrypted2: string): string;
    /**
     * Homomorphic multiplication by constant
     */
    homomorphicMultiply(encrypted: string, constant: number): string;
    /**
     * Modular exponentiation
     */
    private modPow;
    /**
     * Generate zero-knowledge proof (simplified)
     */
    generateZKProof(secret: string, statement: string): ZKProof;
    /**
     * Verify zero-knowledge proof
     */
    verifyZKProof(proof: ZKProof, statement: string): boolean;
    /**
     * Secure multi-party computation (simplified)
     */
    secureMPC(parties: Array<{
        id: string;
        value: number;
    }>, operation: 'sum' | 'average' | 'max'): Promise<number>;
    /**
     * Post-quantum key exchange (simplified Kyber-like)
     */
    postQuantumKeyExchange(): Promise<{
        sharedSecret: string;
        publicKey: string;
    }>;
    /**
     * Threshold cryptography - split secret
     */
    shamirSecretSharing(secret: Buffer, threshold: number, shares: number): string[];
    /**
     * Reconstruct secret from shares
     */
    reconstructSecret(shares: string[], threshold: number): Buffer;
    /**
     * Secure hash with salt
     */
    secureHash(data: string, salt?: string): string;
    /**
     * Verify secure hash
     */
    verifySecureHash(data: string, storedHash: string): boolean;
    /**
     * Generate secure random token
     */
    generateSecureToken(length?: number): string;
    /**
     * Deterministic encryption (for searchable encryption)
     */
    deterministicEncrypt(data: string, key: Buffer): string;
    /**
     * Format-preserving encryption using AES-256-GCM (SECURE)
     * Replaces insecure ECB mode from line 444
     */
    formatPreservingEncrypt(data: string, key: Buffer): string;
    /**
     * Secure encryption with all features (main method)
     */
    encryptSecure(data: string, password: string): EncryptedData;
    /**
     * Secure decryption with key version support
     */
    decryptSecure(encrypted: EncryptedData, password: string): string;
    /**
     * Re-encrypt data with new key version (for key rotation)
     */
    reencrypt(encrypted: EncryptedData, password: string): EncryptedData;
    /**
     * Attribute-based encryption (simplified)
     */
    attributeBasedEncrypt(data: string, policy: string[], attributes: Record<string, string>): EncryptedData;
    /**
     * Get cryptographic statistics
     */
    getStatistics(): any;
    /**
     * Get key information
     */
    getKeyInfo(version?: number): DerivedKey | undefined;
    /**
     * Verify data integrity using HMAC
     */
    verifyIntegrity(data: string, key: Buffer, expectedHmac: string): boolean;
    /**
     * Generate HMAC for data
     */
    generateHMAC(data: string, key: Buffer): string;
}
export default AdvancedCryptoSystem;
//# sourceMappingURL=AdvancedCrypto.d.ts.map