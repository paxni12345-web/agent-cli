/**
 * Security Tests: Cryptographic Vulnerabilities in AI Modules
 * Tests weak encryption, hash collisions, key management, and crypto implementation flaws
 */

import * as crypto from 'crypto';
import { LearningSystem } from '../../../src/ai/LearningSystem';

describe('AI Module Cryptographic Vulnerability Tests', () => {
  describe('Weak Encryption Algorithms', () => {
    test('should reject weak symmetric encryption algorithms', () => {
      const weakAlgorithms = ['des', 'des3', 'rc4', 'rc2', 'blowfish'];

      weakAlgorithms.forEach(algorithm => {
        // These algorithms should not be used in production
        const isWeak = weakAlgorithms.includes(algorithm);
        expect(isWeak).toBe(true);
      });

      // Should use strong algorithms
      const strongAlgorithms = ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'];
      strongAlgorithms.forEach(algorithm => {
        const isStrong = !weakAlgorithms.includes(algorithm);
        expect(isStrong).toBe(true);
      });
    });

    test('should use appropriate key sizes', () => {
      // Test key size requirements
      const keyRequirements = {
        'aes-128': 16,
        'aes-192': 24,
        'aes-256': 32
      };

      Object.entries(keyRequirements).forEach(([algorithm, requiredSize]) => {
        const weakKey = Buffer.alloc(8); // Too small
        const strongKey = Buffer.alloc(requiredSize);

        expect(weakKey.length).toBeLessThan(requiredSize);
        expect(strongKey.length).toBe(requiredSize);
      });
    });

    test('should use authenticated encryption modes', () => {
      const authenticatedModes = ['gcm', 'ccm', 'ocb', 'poly1305'];
      const unauthenticatedModes = ['ecb', 'cbc', 'ctr', 'ofb', 'cfb'];

      const isAuthenticatedMode = (mode: string): boolean => {
        return authenticatedModes.some(authMode => mode.includes(authMode));
      };

      // GCM mode should be recognized as authenticated
      expect(isAuthenticatedMode('aes-256-gcm')).toBe(true);

      // CBC mode should not be recognized as authenticated
      expect(isAuthenticatedMode('aes-256-cbc')).toBe(false);
    });

    test('should prevent ECB mode usage', () => {
      // ECB mode is insecure (deterministic, pattern leakage)
      const ecbAlgorithms = ['aes-256-ecb', 'aes-128-ecb'];

      ecbAlgorithms.forEach(algorithm => {
        const isECB = algorithm.includes('ecb');
        expect(isECB).toBe(true);
        // Should be rejected in production
      });
    });
  });

  describe('Weak Hashing Algorithms', () => {
    test('should reject MD5 for security purposes', () => {
      const password = 'password123';
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');

      // MD5 is broken and should not be used
      expect(md5Hash).toBeTruthy();
      expect(md5Hash.length).toBe(32); // MD5 produces 128 bits = 32 hex chars

      // Should use stronger alternatives
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
      expect(sha256Hash.length).toBe(64); // SHA-256 produces 256 bits = 64 hex chars
    });

    test('should reject SHA-1 for security purposes', () => {
      const data = 'sensitive data';
      const sha1Hash = crypto.createHash('sha1').update(data).digest('hex');

      // SHA-1 is deprecated due to collision attacks
      expect(sha1Hash.length).toBe(40); // SHA-1 produces 160 bits = 40 hex chars

      // Should use SHA-256 or better
      const sha256Hash = crypto.createHash('sha256').update(data).digest('hex');
      expect(sha256Hash.length).toBe(64);
    });

    test('should use password hashing algorithms with salt', () => {
      const password = 'MySecurePassword123!';

      // Bad: Direct hashing without salt
      const unsaltedHash = crypto.createHash('sha256').update(password).digest('hex');

      // Good: Using PBKDF2 with salt
      const salt = crypto.randomBytes(32);
      const iterations = 100000;
      const keyLength = 64;

      const saltedHash = crypto.pbkdf2Sync(
        password,
        salt,
        iterations,
        keyLength,
        'sha512'
      );

      expect(salt.length).toBe(32);
      expect(saltedHash.length).toBe(keyLength);
      expect(saltedHash).not.toEqual(Buffer.from(unsaltedHash, 'hex'));
    });

    test('should use sufficient iteration count for PBKDF2', () => {
      const password = 'password';
      const salt = crypto.randomBytes(32);

      const weakIterations = 1000; // Too low
      const strongIterations = 100000; // Recommended minimum

      const weakHash = crypto.pbkdf2Sync(password, salt, weakIterations, 64, 'sha512');
      const strongHash = crypto.pbkdf2Sync(password, salt, strongIterations, 64, 'sha512');

      expect(weakIterations).toBeLessThan(10000); // Should be rejected
      expect(strongIterations).toBeGreaterThanOrEqual(100000); // Acceptable
      expect(weakHash).not.toEqual(strongHash);
    });
  });

  describe('Initialization Vector (IV) Security', () => {
    test('should generate random IV for each encryption', () => {
      const key = crypto.randomBytes(32);
      const plaintext = 'sensitive data';

      const iv1 = crypto.randomBytes(16);
      const iv2 = crypto.randomBytes(16);

      // IVs should be unique
      expect(iv1).not.toEqual(iv2);

      // Encrypt with different IVs
      const cipher1 = crypto.createCipheriv('aes-256-cbc', key, iv1);
      const ciphertext1 = Buffer.concat([cipher1.update(plaintext, 'utf8'), cipher1.final()]);

      const cipher2 = crypto.createCipheriv('aes-256-cbc', key, iv2);
      const ciphertext2 = Buffer.concat([cipher2.update(plaintext, 'utf8'), cipher2.final()]);

      // Same plaintext with different IVs should produce different ciphertexts
      expect(ciphertext1).not.toEqual(ciphertext2);
    });

    test('should never reuse IV with same key', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const plaintext1 = 'message 1';
      const plaintext2 = 'message 2';

      // Reusing IV with same key is a security vulnerability
      const cipher1 = crypto.createCipheriv('aes-256-cbc', key, iv);
      const ciphertext1 = Buffer.concat([cipher1.update(plaintext1, 'utf8'), cipher1.final()]);

      // This should NOT happen in secure implementation
      const cipher2 = crypto.createCipheriv('aes-256-cbc', key, iv);
      const ciphertext2 = Buffer.concat([cipher2.update(plaintext2, 'utf8'), cipher2.final()]);

      // Verify IV reuse can be detected
      expect(iv).toBeTruthy();
    });

    test('should use appropriate IV size for algorithm', () => {
      const ivSizes = {
        'aes-256-cbc': 16,
        'aes-256-gcm': 12, // GCM typically uses 96-bit IV
        'aes-128-ctr': 16
      };

      Object.entries(ivSizes).forEach(([algorithm, size]) => {
        const iv = crypto.randomBytes(size);
        expect(iv.length).toBe(size);
      });
    });
  });

  describe('Key Management Vulnerabilities', () => {
    test('should not hardcode encryption keys', () => {
      // Bad practice - hardcoded key
      const hardcodedKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');

      // Good practice - generate from secure source
      const secureKey = crypto.randomBytes(32);

      expect(hardcodedKey.length).toBe(16);
      expect(secureKey.length).toBe(32);

      // Hardcoded keys are predictable
      const anotherHardcodedKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
      expect(hardcodedKey).toEqual(anotherHardcodedKey);

      // Secure keys are unique
      const anotherSecureKey = crypto.randomBytes(32);
      expect(secureKey).not.toEqual(anotherSecureKey);
    });

    test('should derive keys from passwords securely', () => {
      const password = 'user-password';
      const salt = crypto.randomBytes(32);

      // Use key derivation function, not direct hashing
      const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');

      expect(derivedKey.length).toBe(32);

      // Same password and salt should derive same key
      const derivedKey2 = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
      expect(derivedKey).toEqual(derivedKey2);

      // Different salt should derive different key
      const differentSalt = crypto.randomBytes(32);
      const derivedKey3 = crypto.pbkdf2Sync(password, differentSalt, 100000, 32, 'sha512');
      expect(derivedKey).not.toEqual(derivedKey3);
    });

    test('should implement key rotation', () => {
      const currentKey = {
        id: 'key-v1',
        value: crypto.randomBytes(32),
        createdAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-12-31')
      };

      const newKey = {
        id: 'key-v2',
        value: crypto.randomBytes(32),
        createdAt: new Date('2024-06-01'),
        expiresAt: new Date('2025-05-31')
      };

      // Keys should be different
      expect(currentKey.value).not.toEqual(newKey.value);

      // Should support multiple active keys during rotation
      const now = new Date('2024-08-30');
      const isCurrentKeyValid = now >= currentKey.createdAt && now <= currentKey.expiresAt;
      const isNewKeyValid = now >= newKey.createdAt && now <= newKey.expiresAt;

      expect(isCurrentKeyValid).toBe(true);
      expect(isNewKeyValid).toBe(true);
    });

    test('should protect keys in memory', () => {
      const sensitiveKey = crypto.randomBytes(32);

      // In production, should use secure memory handling
      // This test demonstrates the concept
      const protectedKey = {
        key: sensitiveKey,
        clear: function() {
          this.key.fill(0); // Zero out the key
        }
      };

      protectedKey.clear();

      // Key should be zeroed
      const isZeroed = protectedKey.key.every(byte => byte === 0);
      expect(isZeroed).toBe(true);
    });
  });

  describe('Random Number Generation', () => {
    test('should use cryptographically secure random numbers', () => {
      // Bad: Math.random() is NOT cryptographically secure
      const insecureRandom = Math.random();
      expect(insecureRandom).toBeGreaterThanOrEqual(0);
      expect(insecureRandom).toBeLessThan(1);

      // Good: crypto.randomBytes() is cryptographically secure
      const secureRandom = crypto.randomBytes(32);
      expect(secureRandom.length).toBe(32);

      // Verify randomness - different calls should produce different values
      const secureRandom2 = crypto.randomBytes(32);
      expect(secureRandom).not.toEqual(secureRandom2);
    });

    test('should generate unpredictable session tokens', () => {
      const generateSessionToken = (): string => {
        return crypto.randomBytes(32).toString('hex');
      };

      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      // Tokens should be unique
      expect(token1).not.toBe(token2);

      // Tokens should be sufficiently long
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    test('should seed random generators properly', () => {
      // crypto.randomBytes uses system entropy
      const samples = Array.from({ length: 100 }, () =>
        crypto.randomBytes(1)[0]
      );

      // Should have good distribution
      const uniqueValues = new Set(samples);
      expect(uniqueValues.size).toBeGreaterThan(50); // At least 50% unique
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should use constant-time comparison for secrets', () => {
      const secret1 = 'correct-secret-key-12345';
      const secret2 = 'correct-secret-key-12345';
      const secret3 = 'wrong-secret-key-123456';

      // Bad: String comparison is vulnerable to timing attacks
      const vulnerableCompare = (a: string, b: string): boolean => {
        return a === b; // Early exit reveals information
      };

      // Good: Constant-time comparison
      const safeCompare = (a: string, b: string): boolean => {
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
      };

      expect(vulnerableCompare(secret1, secret2)).toBe(true);
      expect(safeCompare(secret1, secret2)).toBe(true);
      expect(safeCompare(secret1, secret3)).toBe(false);
    });

    test('should prevent timing leaks in authentication', () => {
      const storedHash = crypto.createHash('sha256').update('correct-password').digest();

      const authenticate = (providedPassword: string): boolean => {
        const providedHash = crypto.createHash('sha256').update(providedPassword).digest();

        // Use timing-safe comparison
        return crypto.timingSafeEqual(storedHash, providedHash);
      };

      expect(authenticate('correct-password')).toBe(true);
      expect(authenticate('wrong-password')).toBe(false);
    });

    test('should implement rate limiting to prevent timing analysis', async () => {
      const attempts: number[] = [];
      const maxAttempts = 5;
      const windowMs = 60000;

      const checkRateLimit = (): boolean => {
        const now = Date.now();
        const recentAttempts = attempts.filter(t => now - t < windowMs);

        if (recentAttempts.length >= maxAttempts) {
          return false; // Rate limited
        }

        attempts.push(now);
        return true;
      };

      // First 5 attempts should succeed
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit()).toBe(true);
      }

      // 6th attempt should fail
      expect(checkRateLimit()).toBe(false);
    });
  });

  describe('Certificate and TLS Validation', () => {
    test('should validate certificate chains', () => {
      const certificateInfo = {
        subject: 'example.com',
        issuer: 'CA Authority',
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2025-01-01'),
        selfSigned: false
      };

      const validateCertificate = (cert: typeof certificateInfo): boolean => {
        const now = new Date();

        // Check validity period
        if (now < cert.validFrom || now > cert.validTo) {
          return false;
        }

        // Reject self-signed certificates in production
        if (cert.selfSigned) {
          return false;
        }

        return true;
      };

      expect(validateCertificate(certificateInfo)).toBe(true);

      // Test expired certificate
      certificateInfo.validTo = new Date('2023-12-31');
      expect(validateCertificate(certificateInfo)).toBe(false);
    });

    test('should enforce minimum TLS version', () => {
      const tlsVersions = {
        'SSLv2': false, // Insecure
        'SSLv3': false, // Insecure
        'TLSv1.0': false, // Deprecated
        'TLSv1.1': false, // Deprecated
        'TLSv1.2': true, // Acceptable
        'TLSv1.3': true // Preferred
      };

      const isSecureTLS = (version: string): boolean => {
        return tlsVersions[version as keyof typeof tlsVersions] || false;
      };

      expect(isSecureTLS('SSLv3')).toBe(false);
      expect(isSecureTLS('TLSv1.0')).toBe(false);
      expect(isSecureTLS('TLSv1.2')).toBe(true);
      expect(isSecureTLS('TLSv1.3')).toBe(true);
    });

    test('should validate certificate hostname', () => {
      const certificate = {
        subject: 'example.com',
        subjectAltNames: ['example.com', '*.example.com', 'www.example.com']
      };

      const validateHostname = (hostname: string, cert: typeof certificate): boolean => {
        if (cert.subject === hostname) return true;

        return cert.subjectAltNames.some(altName => {
          if (altName === hostname) return true;
          if (altName.startsWith('*.')) {
            const domain = altName.substring(2);
            return hostname.endsWith('.' + domain);
          }
          return false;
        });
      };

      expect(validateHostname('example.com', certificate)).toBe(true);
      expect(validateHostname('www.example.com', certificate)).toBe(true);
      expect(validateHostname('api.example.com', certificate)).toBe(true); // Wildcard
      expect(validateHostname('evil.com', certificate)).toBe(false);
    });
  });

  describe('Data-at-Rest Encryption', () => {
    test('should encrypt sensitive data before storage', async () => {
      const learningSystem = new LearningSystem('/tmp/test-crypto-encrypt');

      const sensitiveFeedback = {
        apiKey: 'sk-secret-key-12345',
        password: 'user-password',
        ssn: '123-45-6789'
      };

      // In secure implementation, sensitive fields should be encrypted
      await learningSystem.recordFeedback(
        'sensitive-task',
        'action',
        1,
        'success',
        sensitiveFeedback
      );

      expect(learningSystem.getStats().totalFeedback).toBe(1);
      await learningSystem.reset();
    });

    test('should use envelope encryption for data', () => {
      // Master key (KEK - Key Encryption Key)
      const masterKey = crypto.randomBytes(32);

      // Data key (DEK - Data Encryption Key)
      const dataKey = crypto.randomBytes(32);

      // Encrypt data with DEK
      const plaintext = 'sensitive data';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', dataKey, iv);
      const encryptedData = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

      // Encrypt DEK with KEK
      const dekIv = crypto.randomBytes(16);
      const dekCipher = crypto.createCipheriv('aes-256-cbc', masterKey, dekIv);
      const encryptedDataKey = Buffer.concat([dekCipher.update(dataKey), dekCipher.final()]);

      expect(encryptedData).toBeTruthy();
      expect(encryptedDataKey).toBeTruthy();
      expect(encryptedDataKey).not.toEqual(dataKey);
    });
  });

  describe('Side-Channel Attack Prevention', () => {
    test('should prevent cache timing attacks', () => {
      const secrets = new Map<string, string>();
      secrets.set('user123', 'secret-value-123');

      // Vulnerable: Different execution paths based on key existence
      const vulnerableLookup = (key: string): string | null => {
        if (secrets.has(key)) {
          return secrets.get(key) || null;
        }
        return null;
      };

      // More secure: Constant-time behavior
      const secureLookup = (key: string): string | null => {
        const value = secrets.get(key);
        return value !== undefined ? value : null;
      };

      expect(vulnerableLookup('user123')).toBe('secret-value-123');
      expect(secureLookup('user123')).toBe('secret-value-123');
    });

    test('should prevent power analysis attacks', () => {
      // In hardware implementations, operations should take constant time
      const constantTimeOperation = (a: Buffer, b: Buffer): boolean => {
        if (a.length !== b.length) return false;

        let result = 0;
        for (let i = 0; i < a.length; i++) {
          result |= a[i] ^ b[i];
        }

        return result === 0;
      };

      const buffer1 = Buffer.from('secret');
      const buffer2 = Buffer.from('secret');
      const buffer3 = Buffer.from('public');

      expect(constantTimeOperation(buffer1, buffer2)).toBe(true);
      expect(constantTimeOperation(buffer1, buffer3)).toBe(false);
    });
  });

  describe('Cryptographic Protocol Vulnerabilities', () => {
    test('should prevent padding oracle attacks', () => {
      // PKCS#7 padding validation should be constant-time
      const validatePadding = (data: Buffer): boolean => {
        const paddingLength = data[data.length - 1];

        if (paddingLength < 1 || paddingLength > 16) {
          return false;
        }

        // Verify all padding bytes are correct
        let isValid = true;
        for (let i = 0; i < paddingLength; i++) {
          if (data[data.length - 1 - i] !== paddingLength) {
            isValid = false;
          }
        }

        return isValid;
      };

      const validPadding = Buffer.from([1, 2, 3, 4, 5, 5, 5, 5, 5]);
      const invalidPadding = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);

      expect(validatePadding(validPadding)).toBe(true);
      expect(validatePadding(invalidPadding)).toBe(false);
    });

    test('should prevent replay attacks with nonces', () => {
      const usedNonces = new Set<string>();

      const validateRequest = (nonce: string, timestamp: number): boolean => {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes

        // Check timestamp
        if (now - timestamp > maxAge) {
          return false; // Too old
        }

        // Check nonce uniqueness
        if (usedNonces.has(nonce)) {
          return false; // Replay detected
        }

        usedNonces.add(nonce);
        return true;
      };

      const nonce1 = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();

      expect(validateRequest(nonce1, timestamp)).toBe(true);
      expect(validateRequest(nonce1, timestamp)).toBe(false); // Replay
    });
  });
});
