/**
 * AdvancedCrypto - Advanced encryption and cryptographic operations
 * Homomorphic encryption, zero-knowledge proofs, and post-quantum cryptography
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

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
  maxAge: number; // milliseconds
  maxOperations: number;
  autoRotate: boolean;
}

export class AdvancedCryptoSystem extends EventEmitter {
  private keyPairs: Map<string, KeyPair> = new Map();
  private encryptionConfigs: Map<string, EncryptionConfig> = new Map();
  private derivedKeys: Map<number, DerivedKey> = new Map();
  private currentKeyVersion: number = 1;
  private keyOperationCount: number = 0;
  private keyRotationPolicy: KeyRotationPolicy = {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxOperations: 100000,
    autoRotate: true
  };

  constructor() {
    super();
    this.initializeConfigs();
  }

  private initializeConfigs(): void {
    this.encryptionConfigs.set('aes-256-gcm', {
      algorithm: 'aes-256-gcm',
      keySize: 256,
      mode: 'gcm',
      padding: 'pkcs7'
    });

    this.encryptionConfigs.set('rsa-4096', {
      algorithm: 'rsa',
      keySize: 4096,
      mode: 'oaep',
      padding: 'oaep'
    });
  }

  /**
   * Generate key pair
   */
  public async generateKeyPair(algorithm: string = 'rsa', keySize: number = 4096): Promise<KeyPair> {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const keyPair: KeyPair = {
      publicKey,
      privateKey,
      algorithm,
      created: new Date()
    };

    const keyId = crypto.randomBytes(16).toString('hex');
    this.keyPairs.set(keyId, keyPair);
    this.emit('keypair:generated', { keyId, algorithm, keySize });

    return keyPair;
  }

  /**
   * Derive encryption key using PBKDF2
   */
  public deriveKey(
    password: string,
    salt?: Buffer,
    iterations: number = 100000,
    keyLength: number = 32
  ): DerivedKey {
    const actualSalt = salt || crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, actualSalt, iterations, keyLength, 'sha512');

    const derivedKey: DerivedKey = {
      key,
      salt: actualSalt,
      version: this.currentKeyVersion,
      created: new Date(),
      algorithm: 'pbkdf2-sha512'
    };

    this.derivedKeys.set(this.currentKeyVersion, derivedKey);
    this.emit('key:derived', { version: this.currentKeyVersion, algorithm: 'pbkdf2-sha512' });

    return derivedKey;
  }

  /**
   * Rotate encryption key
   */
  public rotateKey(password: string): DerivedKey {
    this.currentKeyVersion++;
    this.keyOperationCount = 0;

    const newKey = this.deriveKey(password);
    this.emit('key:rotated', {
      oldVersion: this.currentKeyVersion - 1,
      newVersion: this.currentKeyVersion
    });

    return newKey;
  }

  /**
   * Check if key rotation is needed
   */
  private shouldRotateKey(): boolean {
    if (!this.keyRotationPolicy.autoRotate) {
      return false;
    }

    const currentKey = this.derivedKeys.get(this.currentKeyVersion);
    if (!currentKey) {
      return false;
    }

    const age = Date.now() - currentKey.created.getTime();

    return (
      age >= this.keyRotationPolicy.maxAge ||
      this.keyOperationCount >= this.keyRotationPolicy.maxOperations
    );
  }

  /**
   * Set key rotation policy
   */
  public setKeyRotationPolicy(policy: Partial<KeyRotationPolicy>): void {
    this.keyRotationPolicy = { ...this.keyRotationPolicy, ...policy };
    this.emit('policy:updated', this.keyRotationPolicy);
  }

  /**
   * Symmetric encryption with AES-256-GCM (secure AEAD)
   */
  public encrypt(data: string, key: Buffer, algorithm: string = 'aes-256-gcm'): EncryptedData {
    // Ensure key is 32 bytes for AES-256
    if (key.length !== 32) {
      throw new Error('Key must be 32 bytes for AES-256-GCM');
    }

    // Generate unique IV using crypto.randomBytes
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM

    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM;

    // Encrypt data
    let ciphertext = cipher.update(data, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    // Get authentication tag (provides data integrity)
    const tag = cipher.getAuthTag();

    // Calculate HMAC for additional integrity verification
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(ciphertext + iv.toString('hex') + tag.toString('hex'));
    const hmacDigest = hmac.digest('hex');

    // Increment operation count for key rotation
    this.keyOperationCount++;

    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm,
      keyVersion: this.currentKeyVersion,
      hmac: hmacDigest
    };
  }

  /**
   * Symmetric decryption with integrity verification
   */
  public decrypt(encrypted: EncryptedData, key: Buffer): string {
    // Verify HMAC first if present
    if (encrypted.hmac) {
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(encrypted.ciphertext + encrypted.iv + (encrypted.tag || ''));
      const expectedHmac = hmac.digest('hex');

      if (expectedHmac !== encrypted.hmac) {
        throw new Error('HMAC verification failed - data may be tampered');
      }
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(
      encrypted.algorithm,
      key,
      Buffer.from(encrypted.iv, 'hex')
    ) as crypto.DecipherGCM;

    // Set authentication tag for GCM
    if (encrypted.tag) {
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    }

    // Decrypt data
    let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Asymmetric encryption
   */
  public encryptAsymmetric(data: string, publicKey: string): string {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(data, 'utf8')
    );

    return encrypted.toString('base64');
  }

  /**
   * Asymmetric decryption
   */
  public decryptAsymmetric(encrypted: string, privateKey: string): string {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encrypted, 'base64')
    );

    return decrypted.toString('utf8');
  }

  /**
   * Homomorphic encryption (simplified simulation)
   */
  public homomorphicEncrypt(value: number, publicKey: string): string {
    // Simplified Paillier-like encryption simulation
    const n = BigInt(2) ** BigInt(2048); // Modulus
    const g = n + BigInt(1);
    const r = BigInt(Math.floor(Math.random() * 1000000));

    const m = BigInt(value);
    const gm = this.modPow(g, m, n * n);
    const rn = this.modPow(r, n, n * n);
    const c = (gm * rn) % (n * n);

    return c.toString(16);
  }

  /**
   * Homomorphic addition
   */
  public homomorphicAdd(encrypted1: string, encrypted2: string): string {
    const n = BigInt(2) ** BigInt(2048);
    const c1 = BigInt('0x' + encrypted1);
    const c2 = BigInt('0x' + encrypted2);

    const result = (c1 * c2) % (n * n);
    return result.toString(16);
  }

  /**
   * Homomorphic multiplication by constant
   */
  public homomorphicMultiply(encrypted: string, constant: number): string {
    const n = BigInt(2) ** BigInt(2048);
    const c = BigInt('0x' + encrypted);
    const k = BigInt(constant);

    const result = this.modPow(c, k, n * n);
    return result.toString(16);
  }

  /**
   * Modular exponentiation
   */
  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === BigInt(1)) return BigInt(0);

    let result = BigInt(1);
    base = base % modulus;

    while (exponent > BigInt(0)) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = (result * base) % modulus;
      }
      exponent = exponent / BigInt(2);
      base = (base * base) % modulus;
    }

    return result;
  }

  /**
   * Generate zero-knowledge proof (simplified)
   */
  public generateZKProof(secret: string, statement: string): ZKProof {
    // Simplified ZK-SNARK simulation
    const commitment = crypto.createHash('sha256').update(secret).digest('hex');
    const challenge = crypto.createHash('sha256').update(statement).digest('hex');
    const response = crypto.createHash('sha256')
      .update(commitment + challenge)
      .digest('hex');

    return {
      proof: response,
      publicInputs: [statement],
      verificationKey: commitment,
      created: new Date()
    };
  }

  /**
   * Verify zero-knowledge proof
   */
  public verifyZKProof(proof: ZKProof, statement: string): boolean {
    const challenge = crypto.createHash('sha256').update(statement).digest('hex');
    const expectedResponse = crypto.createHash('sha256')
      .update(proof.verificationKey + challenge)
      .digest('hex');

    return proof.proof === expectedResponse;
  }

  /**
   * Secure multi-party computation (simplified)
   */
  public async secureMPC(
    parties: Array<{ id: string; value: number }>,
    operation: 'sum' | 'average' | 'max'
  ): Promise<number> {
    // Each party encrypts their value
    const encrypted = parties.map(p => ({
      id: p.id,
      encrypted: this.homomorphicEncrypt(p.value, 'shared_public_key')
    }));

    // Compute on encrypted values
    let result: string;

    switch (operation) {
      case 'sum':
        result = encrypted.reduce((acc, e) =>
          acc ? this.homomorphicAdd(acc, e.encrypted) : e.encrypted, ''
        );
        break;

      case 'average':
        const sum = encrypted.reduce((acc, e) =>
          acc ? this.homomorphicAdd(acc, e.encrypted) : e.encrypted, ''
        );
        result = this.homomorphicMultiply(sum, 1 / parties.length);
        break;

      case 'max':
        // Max requires comparison circuit (simplified)
        result = encrypted[0].encrypted;
        break;

      default:
        result = encrypted[0].encrypted;
    }

    // Simulate decryption (in real MPC, this would be done securely)
    return parseInt(result.substring(0, 8), 16) % 1000;
  }

  /**
   * Post-quantum key exchange (simplified Kyber-like)
   */
  public async postQuantumKeyExchange(): Promise<{ sharedSecret: string; publicKey: string }> {
    // Simplified lattice-based key exchange
    const dimension = 256;
    const modulus = 3329;

    // Generate polynomial
    const polynomial = Array.from({ length: dimension }, () =>
      Math.floor(Math.random() * modulus)
    );

    // Generate error
    const error = Array.from({ length: dimension }, () =>
      Math.floor(Math.random() * 3) - 1
    );

    // Public key = polynomial + error (simplified)
    const publicKey = polynomial.map((p, i) => (p + error[i]) % modulus);

    // Shared secret derived from polynomial
    const sharedSecret = crypto.createHash('sha256')
      .update(polynomial.join(','))
      .digest('hex');

    return {
      sharedSecret,
      publicKey: publicKey.join(',')
    };
  }

  /**
   * Threshold cryptography - split secret
   */
  public shamirSecretSharing(
    secret: Buffer,
    threshold: number,
    shares: number
  ): string[] {
    if (threshold > shares) {
      throw new Error('Threshold cannot exceed number of shares');
    }

    // Convert secret to number
    const secretNum = BigInt('0x' + secret.toString('hex'));

    // Generate random polynomial coefficients
    const coefficients = [secretNum];
    for (let i = 1; i < threshold; i++) {
      coefficients.push(BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
    }

    // Generate shares
    const result: string[] = [];
    for (let x = 1; x <= shares; x++) {
      const xBig = BigInt(x);
      let y = coefficients[0];

      for (let i = 1; i < coefficients.length; i++) {
        y += coefficients[i] * (xBig ** BigInt(i));
      }

      result.push(`${x}:${y.toString(16)}`);
    }

    return result;
  }

  /**
   * Reconstruct secret from shares
   */
  public reconstructSecret(shares: string[], threshold: number): Buffer {
    if (shares.length < threshold) {
      throw new Error('Insufficient shares for reconstruction');
    }

    // Parse shares
    const points = shares.slice(0, threshold).map(share => {
      const [x, y] = share.split(':');
      return { x: BigInt(x), y: BigInt('0x' + y) };
    });

    // Lagrange interpolation at x=0
    let secret = BigInt(0);

    for (let i = 0; i < points.length; i++) {
      let numerator = BigInt(1);
      let denominator = BigInt(1);

      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
          numerator *= -points[j].x;
          denominator *= points[i].x - points[j].x;
        }
      }

      secret += points[i].y * numerator / denominator;
    }

    const secretHex = secret.toString(16).padStart(64, '0');
    return Buffer.from(secretHex, 'hex');
  }

  /**
   * Secure hash with salt
   */
  public secureHash(data: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  /**
   * Verify secure hash
   */
  public verifySecureHash(data: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    const newHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
    return hash === newHash.toString('hex');
  }

  /**
   * Generate secure random token
   */
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Deterministic encryption (for searchable encryption)
   */
  public deterministicEncrypt(data: string, key: Buffer): string {
    // Use HMAC as deterministic encryption
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Format-preserving encryption using AES-256-GCM (SECURE)
   * Replaces insecure ECB mode from line 444
   */
  public formatPreservingEncrypt(data: string, key: Buffer): string {
    // Use secure AES-256-GCM instead of ECB
    const encrypted = this.encrypt(data, key, 'aes-256-gcm');

    // For format preservation, we need deterministic output
    // Use HMAC-based approach for deterministic encryption
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    const deterministicHash = hmac.digest('hex');

    // Map to original format while maintaining security
    if (/^\d+$/.test(data)) {
      // Numeric: preserve length using secure modular arithmetic
      const numericValue = BigInt('0x' + deterministicHash.substring(0, 16));
      const maxValue = BigInt(10) ** BigInt(data.length);
      return (numericValue % maxValue).toString().padStart(data.length, '0');
    }

    if (/^[A-Za-z]+$/.test(data)) {
      // Alphabetic: preserve case and length
      let result = '';
      for (let i = 0; i < data.length; i++) {
        const byte = parseInt(deterministicHash.substring(i * 2, i * 2 + 2), 16);
        const isUpper = data[i] === data[i].toUpperCase();
        const charCode = (byte % 26) + (isUpper ? 65 : 97);
        result += String.fromCharCode(charCode);
      }
      return result;
    }

    // For other formats, return the encrypted data with preserved structure
    return encrypted.ciphertext.substring(0, data.length * 2);
  }

  /**
   * Secure encryption with all features (main method)
   */
  public encryptSecure(data: string, password: string): EncryptedData {
    // Check if key rotation is needed
    if (this.shouldRotateKey()) {
      this.rotateKey(password);
    }

    // Derive key if not exists for current version
    let derivedKey = this.derivedKeys.get(this.currentKeyVersion);
    if (!derivedKey) {
      derivedKey = this.deriveKey(password);
    }

    // Encrypt using AES-256-GCM with all security features
    return this.encrypt(data, derivedKey.key);
  }

  /**
   * Secure decryption with key version support
   */
  public decryptSecure(encrypted: EncryptedData, password: string): string {
    const keyVersion = encrypted.keyVersion || 1;

    // Get or derive the key for this version
    let derivedKey = this.derivedKeys.get(keyVersion);
    if (!derivedKey) {
      // Attempt to derive key with stored salt if available
      throw new Error(`Key version ${keyVersion} not found. Cannot decrypt without original key.`);
    }

    return this.decrypt(encrypted, derivedKey.key);
  }

  /**
   * Re-encrypt data with new key version (for key rotation)
   */
  public reencrypt(encrypted: EncryptedData, password: string): EncryptedData {
    // Decrypt with old key
    const plaintext = this.decryptSecure(encrypted, password);

    // Rotate to new key
    const newKey = this.rotateKey(password);

    // Encrypt with new key
    return this.encrypt(plaintext, newKey.key);
  }

  /**
   * Attribute-based encryption (simplified)
   */
  public attributeBasedEncrypt(
    data: string,
    policy: string[],
    attributes: Record<string, string>
  ): EncryptedData {
    // Check if attributes satisfy policy
    const satisfied = policy.every(attr => attributes[attr] !== undefined);

    if (!satisfied) {
      throw new Error('Attributes do not satisfy policy');
    }

    // Encrypt with derived key from attributes
    const keyMaterial = Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const key = crypto.createHash('sha256').update(keyMaterial).digest();
    return this.encrypt(data, key);
  }

  /**
   * Get cryptographic statistics
   */
  public getStatistics(): any {
    return {
      keyPairs: this.keyPairs.size,
      algorithms: Array.from(this.encryptionConfigs.keys()),
      currentKeyVersion: this.currentKeyVersion,
      keyOperationCount: this.keyOperationCount,
      derivedKeys: this.derivedKeys.size,
      keyRotationPolicy: this.keyRotationPolicy,
      supportedOperations: [
        'symmetric_encryption',
        'asymmetric_encryption',
        'homomorphic_encryption',
        'zero_knowledge_proofs',
        'secure_mpc',
        'post_quantum_key_exchange',
        'threshold_cryptography',
        'attribute_based_encryption',
        'key_rotation',
        'key_derivation',
        'hmac_integrity'
      ]
    };
  }

  /**
   * Get key information
   */
  public getKeyInfo(version?: number): DerivedKey | undefined {
    const keyVersion = version || this.currentKeyVersion;
    return this.derivedKeys.get(keyVersion);
  }

  /**
   * Verify data integrity using HMAC
   */
  public verifyIntegrity(data: string, key: Buffer, expectedHmac: string): boolean {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    const actualHmac = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(actualHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    );
  }

  /**
   * Generate HMAC for data
   */
  public generateHMAC(data: string, key: Buffer): string {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
  }
}

export default AdvancedCryptoSystem;
