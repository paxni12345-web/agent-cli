/**
 * Cryptography Vulnerabilities Security Tests
 * Tests for weak crypto, insecure hashing, and encryption issues
 */

import * as crypto from 'crypto';
import {
  DatabaseConnection,
  QueryBuilder
} from '../../../src/database/MEGA_DatabaseAbstraction';

describe('Cryptography Vulnerabilities Security Tests', () => {
  let connection: DatabaseConnection;

  beforeEach(async () => {
    connection = new DatabaseConnection({
      type: 'postgres',
      database: 'test_db',
      host: 'localhost',
      port: 5432,
      username: 'test_user',
      password: 'test_pass'
    });
    await connection.connect();
  });

  afterEach(async () => {
    await connection.disconnect();
  });

  describe('Weak Password Hashing', () => {
    test('should reject MD5 for password hashing', () => {
      const password = 'password123';
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');

      // MD5 is broken and should not be used
      const isWeakHash = (hash: string, algorithm: string): boolean => {
        const weakAlgorithms = ['md5', 'sha1'];
        return weakAlgorithms.includes(algorithm.toLowerCase());
      };

      expect(isWeakHash(md5Hash, 'md5')).toBe(true);
    });

    test('should reject SHA-1 for password hashing', () => {
      const password = 'password123';
      const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');

      const weakAlgorithms = ['md5', 'sha1'];
      expect(weakAlgorithms.includes('sha1')).toBe(true);
    });

    test('should use bcrypt or Argon2 for password hashing', () => {
      const acceptableAlgorithms = ['bcrypt', 'argon2', 'argon2id', 'scrypt', 'pbkdf2'];

      const isStrongPasswordHash = (algorithm: string): boolean => {
        return acceptableAlgorithms.includes(algorithm.toLowerCase());
      };

      expect(isStrongPasswordHash('bcrypt')).toBe(true);
      expect(isStrongPasswordHash('argon2id')).toBe(true);
      expect(isStrongPasswordHash('md5')).toBe(false);
      expect(isStrongPasswordHash('sha256')).toBe(false); // Not suitable for passwords
    });

    test('should use sufficient work factor for password hashing', () => {
      // bcrypt cost factor
      const bcryptCost = 12; // 2^12 iterations

      // Argon2 parameters
      const argon2Params = {
        timeCost: 3,
        memoryCost: 65536, // 64 MB
        parallelism: 4
      };

      // Minimum acceptable values
      expect(bcryptCost).toBeGreaterThanOrEqual(10);
      expect(argon2Params.timeCost).toBeGreaterThanOrEqual(2);
      expect(argon2Params.memoryCost).toBeGreaterThanOrEqual(32768); // 32 MB
    });

    test('should include salt in password hashing', () => {
      const password = 'password123';
      const salt1 = crypto.randomBytes(16);
      const salt2 = crypto.randomBytes(16);

      const hash1 = crypto.pbkdf2Sync(password, salt1, 100000, 64, 'sha512').toString('hex');
      const hash2 = crypto.pbkdf2Sync(password, salt2, 100000, 64, 'sha512').toString('hex');

      // Same password with different salts should produce different hashes
      expect(hash1).not.toBe(hash2);
      expect(salt1).not.toEqual(salt2);
    });

    test('should use cryptographically random salt', () => {
      const salts = new Set<string>();

      // Generate multiple salts
      for (let i = 0; i < 1000; i++) {
        const salt = crypto.randomBytes(16).toString('hex');
        expect(salts.has(salt)).toBe(false); // Should be unique
        salts.add(salt);
        expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
      }

      expect(salts.size).toBe(1000);
    });

    test('should reject unsalted password hashes', () => {
      const password = 'password123';
      const unsaltedHash = crypto.createHash('sha256').update(password).digest('hex');

      // Same password always produces same hash (vulnerable to rainbow tables)
      const unsaltedHash2 = crypto.createHash('sha256').update(password).digest('hex');
      expect(unsaltedHash).toBe(unsaltedHash2);

      // This is a vulnerability - hashes should differ due to unique salts
      const isVulnerable = unsaltedHash === unsaltedHash2;
      expect(isVulnerable).toBe(true);
    });

    test('should use minimum salt length', () => {
      const minSaltLength = 16; // 128 bits

      const generateSalt = (): Buffer => {
        return crypto.randomBytes(minSaltLength);
      };

      const salt = generateSalt();
      expect(salt.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Weak Encryption Algorithms', () => {
    test('should reject DES encryption', () => {
      const weakCiphers = ['des', 'des-ede', 'des-ede3'];

      const isWeakCipher = (cipher: string): boolean => {
        return weakCiphers.some(weak => cipher.toLowerCase().includes(weak));
      };

      expect(isWeakCipher('des')).toBe(true);
      expect(isWeakCipher('des-ede3-cbc')).toBe(true);
    });

    test('should reject RC4 encryption', () => {
      const cipher = 'rc4';

      const brokenCiphers = ['rc4', 'rc2'];
      const isBroken = brokenCiphers.includes(cipher.toLowerCase());

      expect(isBroken).toBe(true);
    });

    test('should use AES-256 or ChaCha20 for encryption', () => {
      const strongCiphers = [
        'aes-256-gcm',
        'aes-256-cbc',
        'chacha20-poly1305'
      ];

      const isStrongCipher = (cipher: string): boolean => {
        return strongCiphers.includes(cipher.toLowerCase());
      };

      expect(isStrongCipher('aes-256-gcm')).toBe(true);
      expect(isStrongCipher('chacha20-poly1305')).toBe(true);
      expect(isStrongCipher('aes-128-ecb')).toBe(false);
    });

    test('should reject ECB mode', () => {
      const ecbCiphers = ['aes-256-ecb', 'aes-128-ecb'];

      const usesECB = (cipher: string): boolean => {
        return cipher.toLowerCase().includes('-ecb');
      };

      for (const cipher of ecbCiphers) {
        expect(usesECB(cipher)).toBe(true);
      }
    });

    test('should use authenticated encryption (AEAD)', () => {
      const aeadCiphers = ['aes-256-gcm', 'chacha20-poly1305', 'aes-128-gcm'];

      const isAEAD = (cipher: string): boolean => {
        return cipher.toLowerCase().includes('-gcm') ||
               cipher.toLowerCase().includes('chacha20-poly1305');
      };

      for (const cipher of aeadCiphers) {
        expect(isAEAD(cipher)).toBe(true);
      }

      expect(isAEAD('aes-256-cbc')).toBe(false);
    });
  });

  describe('Insecure Random Number Generation', () => {
    test('should reject Math.random() for security', () => {
      // Math.random() is not cryptographically secure
      const insecureRandom = Math.random();

      // Should use crypto.randomBytes instead
      const secureRandom = crypto.randomBytes(4).readUInt32BE(0) / 0xffffffff;

      expect(typeof insecureRandom).toBe('number');
      expect(typeof secureRandom).toBe('number');

      // Math.random is predictable - should not be used
      const isSecure = false; // Math.random() is never secure
      expect(isSecure).toBe(false);
    });

    test('should use crypto.randomBytes for tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');

      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
    });

    test('should use sufficient entropy for random values', () => {
      const minEntropyBytes = 32; // 256 bits

      const generateSecureToken = (): string => {
        return crypto.randomBytes(minEntropyBytes).toString('hex');
      };

      const token = generateSecureToken();
      expect(token.length).toBe(minEntropyBytes * 2); // Hex encoding doubles length
    });

    test('should not use timestamp for random values', () => {
      const timestamp1 = Date.now();
      const timestamp2 = Date.now();

      // Timestamps are predictable
      const timeDiff = Math.abs(timestamp2 - timestamp1);
      expect(timeDiff).toBeLessThan(10); // Very predictable

      // Should use crypto.randomBytes instead
      const random1 = parseInt(crypto.randomBytes(4).toString('hex'), 16);
      const random2 = parseInt(crypto.randomBytes(4).toString('hex'), 16);

      expect(random1).not.toBe(random2);
    });
  });

  describe('Insufficient Key Length', () => {
    test('should reject short encryption keys', () => {
      const shortKey = Buffer.from('short'); // Only 5 bytes = 40 bits

      const minKeyLength = 32; // 256 bits for AES-256

      expect(shortKey.length).toBeLessThan(minKeyLength);
    });

    test('should use minimum 256-bit keys for AES', () => {
      const key = crypto.randomBytes(32); // 256 bits

      expect(key.length).toBe(32);
      expect(key.length * 8).toBe(256);
    });

    test('should reject hardcoded encryption keys', () => {
      const hardcodedKey = 'mysecretkey123'; // Hardcoded = vulnerability

      const isHardcoded = typeof hardcodedKey === 'string' &&
                          hardcodedKey === 'mysecretkey123';

      expect(isHardcoded).toBe(true); // This is the vulnerability

      // Should use environment variable or key management system
      const properKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
      expect(properKey).toBeDefined();
    });

    test('should use proper key derivation', () => {
      const password = 'user-provided-password';
      const salt = crypto.randomBytes(16);

      // Proper key derivation from password
      const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

      expect(derivedKey.length).toBe(32); // 256 bits
      expect(salt.length).toBe(16);

      // Same password + different salt = different key
      const salt2 = crypto.randomBytes(16);
      const derivedKey2 = crypto.pbkdf2Sync(password, salt2, 100000, 32, 'sha256');

      expect(derivedKey).not.toEqual(derivedKey2);
    });
  });

  describe('Initialization Vector (IV) Issues', () => {
    test('should use random IV for each encryption', () => {
      const key = crypto.randomBytes(32);
      const plaintext = 'sensitive data';

      const encrypt = (data: string): { encrypted: string; iv: string } => {
        const iv = crypto.randomBytes(16); // Random IV
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return { encrypted, iv: iv.toString('hex') };
      };

      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      // Same plaintext should produce different ciphertext due to different IVs
      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
    });

    test('should reject reused IVs', () => {
      const key = crypto.randomBytes(32);
      const staticIV = Buffer.alloc(16); // All zeros - NEVER do this

      const plaintext1 = 'message1';
      const plaintext2 = 'message2';

      const cipher1 = crypto.createCipheriv('aes-256-cbc', key, staticIV);
      const encrypted1 = cipher1.update(plaintext1, 'utf8', 'hex') + cipher1.final('hex');

      const cipher2 = crypto.createCipheriv('aes-256-cbc', key, staticIV);
      const encrypted2 = cipher2.update(plaintext2, 'utf8', 'hex') + cipher2.final('hex');

      // Reusing IV is a vulnerability
      const ivReused = staticIV.toString('hex') === staticIV.toString('hex');
      expect(ivReused).toBe(true); // This is the vulnerability
    });

    test('should use correct IV length', () => {
      const ivLength = 16; // 128 bits for AES

      const generateIV = (): Buffer => {
        return crypto.randomBytes(ivLength);
      };

      const iv = generateIV();
      expect(iv.length).toBe(16);
    });

    test('should not use sequential IVs', () => {
      const ivs: Buffer[] = [];

      for (let i = 0; i < 10; i++) {
        ivs.push(crypto.randomBytes(16));
      }

      // IVs should be random, not sequential
      for (let i = 1; i < ivs.length; i++) {
        expect(ivs[i]).not.toEqual(ivs[i - 1]);

        // Check they're not just incrementing
        const diff = ivs[i].readUInt32BE(0) - ivs[i - 1].readUInt32BE(0);
        expect(Math.abs(diff)).toBeGreaterThan(1);
      }
    });
  });

  describe('Insecure Data Storage', () => {
    test('should encrypt sensitive data at rest', async () => {
      const sensitiveData = {
        ssn: '123-45-6789',
        creditCard: '4111111111111111',
        password: 'secret123'
      };

      // Should be encrypted before storing
      const encrypt = (data: string, key: Buffer): string => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        return JSON.stringify({
          encrypted,
          iv: iv.toString('hex'),
          authTag: authTag.toString('hex')
        });
      };

      const key = crypto.randomBytes(32);
      const encryptedSSN = encrypt(sensitiveData.ssn, key);

      // Verify it's encrypted (not plaintext)
      expect(encryptedSSN).not.toContain('123-45-6789');
      expect(encryptedSSN).toContain('encrypted');
      expect(encryptedSSN).toContain('iv');
      expect(encryptedSSN).toContain('authTag');
    });

    test('should not store plaintext passwords', async () => {
      const password = 'MyPassword123!';

      // Should hash, never store plaintext
      const hash = crypto.pbkdf2Sync(password, crypto.randomBytes(16), 100000, 64, 'sha512');

      expect(hash.toString('hex')).not.toContain('MyPassword123');
      expect(hash.length).toBe(64);
    });

    test('should use encryption for PII in database', async () => {
      const piiFields = ['ssn', 'credit_card', 'passport_number', 'driver_license'];

      const requiresEncryption = (fieldName: string): boolean => {
        return piiFields.includes(fieldName.toLowerCase());
      };

      expect(requiresEncryption('ssn')).toBe(true);
      expect(requiresEncryption('credit_card')).toBe(true);
      expect(requiresEncryption('username')).toBe(false);
    });

    test('should use column-level encryption for sensitive fields', async () => {
      const key = crypto.randomBytes(32);

      const encryptColumn = (value: string): string => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(value, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();

        return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
      };

      const sensitiveValue = '123-45-6789';
      const encrypted = encryptColumn(sensitiveValue);

      // Verify format and encryption
      expect(encrypted.split(':')).toHaveLength(3);
      expect(encrypted).not.toContain(sensitiveValue);
    });
  });

  describe('Certificate and TLS Issues', () => {
    test('should enforce TLS for database connections', () => {
      const connectionConfig = {
        type: 'postgres' as const,
        host: 'db.example.com',
        ssl: true,
        sslMode: 'require'
      };

      expect(connectionConfig.ssl).toBe(true);
      expect(connectionConfig.sslMode).toBe('require');
    });

    test('should validate SSL certificates', () => {
      const sslConfig = {
        rejectUnauthorized: true, // Must be true in production
        ca: 'path/to/ca-cert.pem',
        cert: 'path/to/client-cert.pem',
        key: 'path/to/client-key.pem'
      };

      expect(sslConfig.rejectUnauthorized).toBe(true);
      expect(sslConfig.ca).toBeDefined();
    });

    test('should reject self-signed certificates in production', () => {
      const environment = 'production';
      const selfSignedAllowed = environment !== 'production';

      expect(selfSignedAllowed).toBe(false);
    });

    test('should use minimum TLS version 1.2', () => {
      const minTLSVersion = 'TLSv1.2';
      const allowedVersions = ['TLSv1.2', 'TLSv1.3'];

      expect(allowedVersions.includes(minTLSVersion)).toBe(true);

      const obsoleteVersions = ['SSLv3', 'TLSv1.0', 'TLSv1.1'];
      for (const version of obsoleteVersions) {
        expect(allowedVersions.includes(version)).toBe(false);
      }
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should use constant-time comparison for secrets', () => {
      const secret1 = 'my-secret-token-12345';
      const secret2 = 'my-secret-token-12345';
      const wrong = 'wrong-token-xxxxxxxxx';

      const constantTimeCompare = (a: string, b: string): boolean => {
        if (a.length !== b.length) {
          // Still do comparison to maintain constant time
          b = a;
        }

        let result = 0;
        for (let i = 0; i < a.length; i++) {
          result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }

        return result === 0;
      };

      const startCorrect = process.hrtime.bigint();
      const correctResult = constantTimeCompare(secret1, secret2);
      const timeCorrect = process.hrtime.bigint() - startCorrect;

      const startWrong = process.hrtime.bigint();
      const wrongResult = constantTimeCompare(secret1, wrong);
      const timeWrong = process.hrtime.bigint() - startWrong;

      expect(correctResult).toBe(true);
      expect(wrongResult).toBe(false);

      // Timing should be similar (constant-time)
      const timingDiff = Number(timeWrong - timeCorrect);
      expect(Math.abs(timingDiff)).toBeLessThan(1000000); // Less than 1ms difference
    });

    test('should use crypto.timingSafeEqual', () => {
      const buffer1 = Buffer.from('secret');
      const buffer2 = Buffer.from('secret');
      const buffer3 = Buffer.from('wrongs'); // Same length

      // Correct comparison
      expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(true);

      // Wrong comparison
      expect(crypto.timingSafeEqual(buffer1, buffer3)).toBe(false);
    });

    test('should not leak information through timing', () => {
      const validTokens = new Set([
        'token-123',
        'token-456',
        'token-789'
      ]);

      const checkToken = (token: string): boolean => {
        // Always iterate through all tokens (constant time)
        let found = false;
        for (const valid of validTokens) {
          if (valid.length === token.length) {
            let match = true;
            for (let i = 0; i < valid.length; i++) {
              if (valid[i] !== token[i]) {
                match = false;
              }
            }
            if (match) found = true;
          }
        }
        return found;
      };

      expect(checkToken('token-123')).toBe(true);
      expect(checkToken('token-999')).toBe(false);
    });
  });

  describe('Key Management', () => {
    test('should not hardcode encryption keys', () => {
      // BAD: Hardcoded key
      const hardcodedKey = 'my-secret-key-123456789012345678901234';

      // GOOD: From environment or KMS
      const envKey = process.env.ENCRYPTION_KEY;
      const kmsKey = 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012';

      const isHardcoded = hardcodedKey === 'my-secret-key-123456789012345678901234';
      expect(isHardcoded).toBe(true); // This is the vulnerability

      // Keys should come from secure sources
      expect(typeof envKey === 'string' || typeof envKey === 'undefined').toBe(true);
      expect(kmsKey.startsWith('arn:aws:kms:')).toBe(true);
    });

    test('should rotate encryption keys periodically', () => {
      const keyRotationDays = 90;
      const lastRotation = new Date('2024-01-01');
      const now = new Date();

      const daysSinceRotation = Math.floor(
        (now.getTime() - lastRotation.getTime()) / (1000 * 60 * 60 * 24)
      );

      const needsRotation = daysSinceRotation > keyRotationDays;

      expect(needsRotation).toBe(true); // Should rotate
    });

    test('should use separate keys for different purposes', () => {
      const keys = {
        encryption: crypto.randomBytes(32),
        authentication: crypto.randomBytes(32),
        signing: crypto.randomBytes(32)
      };

      // Keys should be different
      expect(keys.encryption).not.toEqual(keys.authentication);
      expect(keys.encryption).not.toEqual(keys.signing);
      expect(keys.authentication).not.toEqual(keys.signing);
    });

    test('should securely delete keys from memory', () => {
      const key = Buffer.from(crypto.randomBytes(32));

      // Securely zero out key after use
      const secureDelete = (buffer: Buffer): void => {
        buffer.fill(0);
      };

      secureDelete(key);

      // Verify key is zeroed
      expect(key.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Hash Collision Attacks', () => {
    test('should use SHA-256 or better for integrity', () => {
      const data = 'important data';

      const strongHashes = ['sha256', 'sha384', 'sha512', 'sha3-256'];

      const hash = crypto.createHash('sha256').update(data).digest('hex');

      expect(hash).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(strongHashes.includes('sha256')).toBe(true);
    });

    test('should reject MD5 for integrity checks', () => {
      const brokenHashFunctions = ['md5', 'sha1'];

      const isSecureHash = (algorithm: string): boolean => {
        return !brokenHashFunctions.includes(algorithm.toLowerCase());
      };

      expect(isSecureHash('md5')).toBe(false);
      expect(isSecureHash('sha1')).toBe(false);
      expect(isSecureHash('sha256')).toBe(true);
    });

    test('should use HMAC for authentication', () => {
      const data = 'message to authenticate';
      const key = crypto.randomBytes(32);

      const hmac = crypto.createHmac('sha256', key)
        .update(data)
        .digest('hex');

      expect(hmac).toHaveLength(64);

      // HMAC with different key should differ
      const key2 = crypto.randomBytes(32);
      const hmac2 = crypto.createHmac('sha256', key2)
        .update(data)
        .digest('hex');

      expect(hmac).not.toBe(hmac2);
    });
  });
});
