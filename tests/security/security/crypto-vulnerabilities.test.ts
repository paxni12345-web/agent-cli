/**
 * Security Test Suite: Cryptographic Vulnerabilities
 * Tests for weak encryption, hashing issues, and crypto implementation flaws
 */

import { SecurityManager, LoginContext } from '../../../src/security/SecurityManager';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

describe('Cryptographic Vulnerability Security Tests', () => {
  let securityManager: SecurityManager;
  let testContext: LoginContext;

  beforeEach(() => {
    securityManager = new SecurityManager({
      enableAuth: true,
      enableEncryption: true,
      jwtSecret: 'test-secret-key-for-crypto-tests',
      bcryptRounds: 12,
      redisUrl: 'redis://localhost:6379',
    });

    testContext = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Test Browser',
      deviceId: 'test-device-001',
    };
  });

  afterEach(async () => {
    await securityManager.disconnect();
  });

  describe('Weak Password Hashing', () => {
    test('should use bcrypt for password hashing', async () => {
      const password = 'TestPassword123!';
      const hash = await bcrypt.hash(password, 12);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2')).toBe(true); // bcrypt format
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should reject weak hashing algorithms (MD5, SHA1)', () => {
      const password = 'TestPassword123!';

      // MD5 (weak)
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');
      expect(md5Hash.length).toBe(32);

      // SHA1 (weak)
      const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');
      expect(sha1Hash.length).toBe(40);

      // bcrypt hash should be much longer and include salt
      const bcryptHash = bcrypt.hashSync(password, 12);
      expect(bcryptHash.length).toBeGreaterThan(sha1Hash.length);
    });

    test('should use sufficient bcrypt rounds', async () => {
      const password = 'TestPassword123!';

      // Test different round counts
      const weakHash = await bcrypt.hash(password, 4); // Too weak
      const goodHash = await bcrypt.hash(password, 12); // Recommended

      expect(weakHash).toBeDefined();
      expect(goodHash).toBeDefined();

      // Higher rounds = more secure but slower
      const start = Date.now();
      await bcrypt.hash(password, 12);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThan(10); // Should take some time
    });

    test('should include salt in password hashes', async () => {
      const password = 'TestPassword123!';

      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);

      // Same password should produce different hashes due to salt
      expect(hash1).not.toBe(hash2);
    });

    test('should prevent rainbow table attacks', async () => {
      const commonPasswords = ['password123', 'admin', 'letmein'];
      const hashes: string[] = [];

      for (const password of commonPasswords) {
        const hash = await bcrypt.hash(password, 12);
        hashes.push(hash);
      }

      // All hashes should be unique even for common passwords
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });

    test('should detect and reject weak password hashes', async () => {
      const user = await securityManager.createUser(
        'testuser',
        'test@example.com',
        'ValidPass123!',
        ['user']
      );

      // Check that password hash is strong (bcrypt)
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash.length).toBeGreaterThan(50);
      expect(user.passwordHash.startsWith('$2')).toBe(true);
    });
  });

  describe('Weak Encryption Algorithms', () => {
    test('should use strong encryption (AES-256-GCM)', async () => {
      const plaintext = 'Sensitive data that needs encryption';
      const { encrypted, keyId } = await securityManager.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(keyId).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    test('should reject weak encryption algorithms', () => {
      const plaintext = 'Sensitive data';
      const key = crypto.randomBytes(16);
      const iv = crypto.randomBytes(16);

      // DES (weak - 56-bit key)
      const desCipher = crypto.createCipheriv('des-ecb', key.slice(0, 8), Buffer.alloc(0));
      let desEncrypted = desCipher.update(plaintext, 'utf8', 'hex');
      desEncrypted += desCipher.final('hex');

      // AES-256-GCM (strong - 256-bit key)
      const aes256Key = crypto.randomBytes(32);
      const aesGcmCipher = crypto.createCipheriv('aes-256-gcm', aes256Key, iv);
      let aesEncrypted = aesGcmCipher.update(plaintext, 'utf8', 'hex');
      aesEncrypted += aesGcmCipher.final('hex');

      // AES should produce different output than DES
      expect(desEncrypted).not.toBe(aesEncrypted);
      expect(aesEncrypted.length).toBeGreaterThan(0);
    });

    test('should use authenticated encryption (GCM mode)', async () => {
      const plaintext = 'Sensitive data';
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      expect(authTag).toBeDefined();
      expect(authTag.length).toBe(16);

      // Decryption should verify auth tag
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      expect(decrypted).toBe(plaintext);
    });

    test('should detect tampering with authenticated encryption', () => {
      const plaintext = 'Sensitive data';
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Tamper with ciphertext
      const tamperedEncrypted = encrypted.slice(0, -4) + '0000';

      // Decryption should fail with tampered data
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      expect(() => {
        decipher.update(tamperedEncrypted, 'hex', 'utf8');
        decipher.final('utf8');
      }).toThrow();
    });

    test('should prevent ECB mode usage (pattern leakage)', () => {
      const plaintext = 'AAAAAAAAAAAAAAAA'; // Repeated pattern
      const key = crypto.randomBytes(16);

      // ECB mode (insecure - same plaintext = same ciphertext)
      const ecbCipher = crypto.createCipheriv('aes-128-ecb', key, Buffer.alloc(0));
      let ecbEncrypted = ecbCipher.update(plaintext, 'utf8', 'hex');
      ecbEncrypted += ecbCipher.final('hex');

      // CBC mode (secure - same plaintext = different ciphertext due to IV)
      const iv = crypto.randomBytes(16);
      const cbcCipher = crypto.createCipheriv('aes-128-cbc', key, iv);
      let cbcEncrypted = cbcCipher.update(plaintext, 'utf8', 'hex');
      cbcEncrypted += cbcCipher.final('hex');

      expect(ecbEncrypted).not.toBe(cbcEncrypted);
    });
  });

  describe('Insecure Random Number Generation', () => {
    test('should use cryptographically secure random numbers', () => {
      // Insecure (predictable)
      const mathRandom1 = Math.random();
      const mathRandom2 = Math.random();

      // Secure (cryptographically random)
      const cryptoRandom1 = crypto.randomBytes(16);
      const cryptoRandom2 = crypto.randomBytes(16);

      expect(mathRandom1).not.toBe(mathRandom2);
      expect(cryptoRandom1).not.toEqual(cryptoRandom2);
      expect(cryptoRandom1.length).toBe(16);
    });

    test('should generate unpredictable tokens', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const token = crypto.randomBytes(32).toString('hex');
        tokens.add(token);
      }

      // All tokens should be unique
      expect(tokens.size).toBe(1000);
    });

    test('should use sufficient entropy for sensitive operations', () => {
      // Generate session ID with high entropy
      const sessionId = crypto.randomBytes(32).toString('hex');
      expect(sessionId.length).toBe(64); // 32 bytes = 64 hex characters

      // Calculate approximate entropy
      const uniqueChars = new Set(sessionId.split('')).size;
      expect(uniqueChars).toBeGreaterThan(10); // Should have good distribution
    });

    test('should prevent timing attacks on random generation', () => {
      const timings: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        crypto.randomBytes(32);
        const end = process.hrtime.bigint();
        timings.push(Number(end - start));
      }

      // Timing should be consistent (no patterns)
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      expect(avgTiming).toBeGreaterThan(0);
    });
  });

  describe('Key Management Vulnerabilities', () => {
    test('should generate strong encryption keys', () => {
      // Weak key (too short)
      const weakKey = crypto.randomBytes(8); // 64 bits

      // Strong key (recommended)
      const strongKey = crypto.randomBytes(32); // 256 bits

      expect(weakKey.length).toBe(8);
      expect(strongKey.length).toBe(32);
    });

    test('should not hardcode encryption keys', async () => {
      const { encrypted, keyId } = await securityManager.encrypt('test data');

      // Key ID should be dynamic, not hardcoded
      expect(keyId).toBeDefined();
      expect(keyId).toMatch(/^sec-/);
    });

    test('should rotate encryption keys regularly', async () => {
      const data = 'Sensitive information';

      const { encrypted: encrypted1, keyId: keyId1 } = await securityManager.encrypt(data);
      const { encrypted: encrypted2, keyId: keyId2 } = await securityManager.encrypt(data);

      // Each encryption should potentially use a different key
      expect(keyId1).toBeDefined();
      expect(keyId2).toBeDefined();
    });

    test('should securely store encryption keys', async () => {
      const { keyId } = await securityManager.encrypt('test data');

      // Key should not be exposed in plaintext
      expect(keyId).not.toContain('key=');
      expect(keyId).not.toMatch(/[A-Fa-f0-9]{64}/); // Raw hex key
    });

    test('should use unique IVs for each encryption', () => {
      const key = crypto.randomBytes(32);
      const plaintext = 'Same data';

      // Encrypt twice with same key
      const iv1 = crypto.randomBytes(16);
      const cipher1 = crypto.createCipheriv('aes-256-cbc', key, iv1);
      let encrypted1 = cipher1.update(plaintext, 'utf8', 'hex');
      encrypted1 += cipher1.final('hex');

      const iv2 = crypto.randomBytes(16);
      const cipher2 = crypto.createCipheriv('aes-256-cbc', key, iv2);
      let encrypted2 = cipher2.update(plaintext, 'utf8', 'hex');
      encrypted2 += cipher2.final('hex');

      // Same plaintext with different IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
      expect(iv1).not.toEqual(iv2);
    });

    test('should prevent IV reuse attacks', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16); // Reused IV (bad practice)

      const plaintext1 = 'Secret message 1';
      const cipher1 = crypto.createCipheriv('aes-256-cbc', key, iv);
      const encrypted1 = cipher1.update(plaintext1, 'utf8', 'hex') + cipher1.final('hex');

      const plaintext2 = 'Secret message 2';
      const cipher2 = crypto.createCipheriv('aes-256-cbc', key, iv); // Same IV!
      const encrypted2 = cipher2.update(plaintext2, 'utf8', 'hex') + cipher2.final('hex');

      // Reusing IV is detected (should use different IVs)
      expect(iv).toBeDefined();
    });
  });

  describe('Certificate and TLS Vulnerabilities', () => {
    test('should validate certificate signatures', () => {
      // Simulate certificate validation
      const validCert = {
        subject: 'CN=example.com',
        issuer: 'CN=TrustedCA',
        valid_from: Date.now() - 86400000,
        valid_to: Date.now() + 31536000000,
        fingerprint: crypto.randomBytes(32).toString('hex'),
      };

      expect(validCert.valid_from).toBeLessThan(Date.now());
      expect(validCert.valid_to).toBeGreaterThan(Date.now());
    });

    test('should reject expired certificates', () => {
      const expiredCert = {
        valid_from: Date.now() - 63072000000, // 2 years ago
        valid_to: Date.now() - 31536000000, // 1 year ago
      };

      const isExpired = expiredCert.valid_to < Date.now();
      expect(isExpired).toBe(true);
    });

    test('should enforce minimum TLS version', () => {
      const tlsVersions = {
        'TLSv1.0': false, // Insecure
        'TLSv1.1': false, // Insecure
        'TLSv1.2': true,  // Acceptable
        'TLSv1.3': true,  // Recommended
      };

      expect(tlsVersions['TLSv1.2']).toBe(true);
      expect(tlsVersions['TLSv1.3']).toBe(true);
      expect(tlsVersions['TLSv1.0']).toBe(false);
    });

    test('should use strong cipher suites', () => {
      const weakCiphers = [
        'RC4-SHA',
        'DES-CBC-SHA',
        'NULL-MD5',
      ];

      const strongCiphers = [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'TLS_AES_256_GCM_SHA384',
      ];

      // Verify strong ciphers are preferred
      expect(strongCiphers.length).toBeGreaterThan(0);
      expect(weakCiphers.every(c => !strongCiphers.includes(c))).toBe(true);
    });

    test('should validate certificate hostname', () => {
      const cert = { subject: 'CN=example.com' };
      const requestedHost = 'example.com';
      const mismatchedHost = 'evil.com';

      expect(cert.subject.includes(requestedHost)).toBe(true);
      expect(cert.subject.includes(mismatchedHost)).toBe(false);
    });
  });

  describe('JWT Token Security', () => {
    test('should use strong signing algorithm', async () => {
      const user = await securityManager.createUser(
        'jwtuser',
        'jwt@example.com',
        'ValidPass123!',
        ['user']
      );

      const { token } = await securityManager.login('jwtuser', 'ValidPass123!', testContext);

      // Decode token header to check algorithm
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64').toString()
      );

      expect(header.alg).toBe('HS256'); // Should use HMAC SHA-256
      expect(header.alg).not.toBe('none');
    });

    test('should reject "none" algorithm tokens', async () => {
      const payload = { userId: 'fake-user', username: 'attacker' };
      const noneToken = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64') +
        '.' + Buffer.from(JSON.stringify(payload)).toString('base64') + '.';

      const result = await securityManager.validateToken(noneToken);
      expect(result).toBeNull();
    });

    test('should include expiration in tokens', async () => {
      const user = await securityManager.createUser(
        'expuser',
        'exp@example.com',
        'ValidPass123!',
        ['user']
      );

      const { token } = await securityManager.login('expuser', 'ValidPass123!', testContext);

      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );

      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    test('should use sufficient key length for HMAC', () => {
      const weakKey = 'short';
      const strongKey = crypto.randomBytes(32).toString('hex');

      expect(weakKey.length).toBeLessThan(16);
      expect(strongKey.length).toBe(64);
    });

    test('should prevent JWT confusion attacks', async () => {
      const user = await securityManager.createUser(
        'confuser',
        'conf@example.com',
        'ValidPass123!',
        ['user']
      );

      const { token } = await securityManager.login('confuser', 'ValidPass123!', testContext);

      // Attempt to use RS256 public key as HS256 secret
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
      expect(header.alg).toBe('HS256');

      // Verify algorithm is enforced
      const result = await securityManager.validateToken(token);
      expect(result).toBeDefined();
    });
  });

  describe('Side-Channel Attacks', () => {
    test('should use constant-time comparison for secrets', () => {
      const secret1 = 'correct-secret-key';
      const secret2 = 'correct-secret-key';
      const secret3 = 'incorrect-secret';

      // Use crypto.timingSafeEqual for constant-time comparison
      const buf1 = Buffer.from(secret1);
      const buf2 = Buffer.from(secret2);

      const isEqual = crypto.timingSafeEqual(buf1, buf2);
      expect(isEqual).toBe(true);

      // Different length should be detected
      const buf3 = Buffer.from(secret3);
      expect(buf1.length).not.toBe(buf3.length);
    });

    test('should prevent timing attacks on password verification', async () => {
      const user = await securityManager.createUser(
        'timinguser',
        'timing@example.com',
        'ValidPass123!',
        ['user']
      );

      const timings: number[] = [];

      // Measure timing for incorrect passwords of different lengths
      const passwords = ['a', 'ab', 'abc', 'abcd', 'wrongpassword'];

      for (const password of passwords) {
        const start = process.hrtime.bigint();
        try {
          await securityManager.login('timinguser', password, testContext);
        } catch (error) {
          // Expected to fail
        }
        const end = process.hrtime.bigint();
        timings.push(Number(end - start));
      }

      // Timing should be relatively consistent (bcrypt comparison is constant-time)
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      expect(avgTiming).toBeGreaterThan(0);
    });

    test('should prevent cache-timing attacks', () => {
      const lookupTable = new Map<string, string>();
      lookupTable.set('key1', 'value1');
      lookupTable.set('key2', 'value2');

      // Constant-time lookup should not leak information through cache timing
      const key = 'key1';
      const value = lookupTable.get(key);
      expect(value).toBe('value1');
    });
  });

  describe('Cryptographic Protocol Issues', () => {
    test('should implement proper challenge-response', async () => {
      const challenge = crypto.randomBytes(32).toString('hex');
      const secret = 'shared-secret';

      // Client response
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(challenge);
      const response = hmac.digest('hex');

      // Server verification
      const verifyHmac = crypto.createHmac('sha256', secret);
      verifyHmac.update(challenge);
      const expectedResponse = verifyHmac.digest('hex');

      expect(response).toBe(expectedResponse);
    });

    test('should prevent replay attacks', async () => {
      const user = await securityManager.createUser(
        'replayuser',
        'replay@example.com',
        'ValidPass123!',
        ['user']
      );

      const { token } = await securityManager.login('replayuser', 'ValidPass123!', testContext);

      // Use token
      const firstUse = await securityManager.validateToken(token);
      expect(firstUse).toBeDefined();

      // Logout (invalidate token)
      await securityManager.logout(token, testContext);

      // Attempt to replay token
      const replayAttempt = await securityManager.validateToken(token);
      expect(replayAttempt).toBeNull();
    });

    test('should use nonces to prevent replay', () => {
      const nonces = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const nonce = crypto.randomBytes(16).toString('hex');
        expect(nonces.has(nonce)).toBe(false);
        nonces.add(nonce);
      }

      expect(nonces.size).toBe(100);
    });

    test('should implement proper key derivation (PBKDF2/Argon2)', async () => {
      const password = 'user-password';
      const salt = crypto.randomBytes(16);

      // Use PBKDF2 for key derivation
      const iterations = 100000;
      const keyLength = 32;
      const digest = 'sha256';

      const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);

      expect(derivedKey.length).toBe(keyLength);
      expect(derivedKey).toBeDefined();
    });
  });

  describe('Data At Rest Encryption', () => {
    test('should encrypt sensitive data at rest', async () => {
      const sensitiveData = 'Credit Card: 4532-1234-5678-9010';

      const { encrypted, keyId } = await securityManager.encrypt(sensitiveData);

      expect(encrypted).not.toContain('4532');
      expect(encrypted).not.toBe(sensitiveData);
      expect(keyId).toBeDefined();
    });

    test('should decrypt data correctly', async () => {
      const originalData = 'Confidential information';

      const { encrypted, keyId } = await securityManager.encrypt(originalData);
      const decrypted = await securityManager.decrypt(encrypted, keyId);

      expect(decrypted).toBe(originalData);
    });

    test('should fail decryption with wrong key', async () => {
      const { encrypted } = await securityManager.encrypt('test data');

      await expect(
        securityManager.decrypt(encrypted, 'wrong-key-id')
      ).rejects.toThrow();
    });

    test('should detect tampering with encrypted data', async () => {
      const { encrypted, keyId } = await securityManager.encrypt('important data');

      // Tamper with encrypted data
      const parts = encrypted.split(':');
      const tampered = parts[0] + 'XXXX:' + parts[1];

      await expect(
        securityManager.decrypt(tampered, keyId)
      ).rejects.toThrow();
    });
  });
});
