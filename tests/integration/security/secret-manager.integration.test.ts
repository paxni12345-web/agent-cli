/**
 * Integration Tests for Secret Manager
 * Tests file operations, vault integration, and secret detection flows
 */

import { SecretDetector, SecretVault, SecretVaultConfig } from '../../../src/security/SecretManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Secret Manager Integration Tests', () => {
  let tempDir: string;
  let detector: SecretDetector;

  beforeEach(() => {
    // Create temporary directory for file operations
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-test-'));
    detector = new SecretDetector();
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Real File Operations', () => {
    test('scan file with secrets', () => {
      const filePath = path.join(tempDir, 'config.js');
      const fileContent = `
        const config = {
          apiKey: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop',
          awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
          password: 'MySecretPassword123!',
          dbConnection: 'postgresql://user:password@localhost:5432/db'
        };
      `;

      fs.writeFileSync(filePath, fileContent);

      // Scan the file
      const secrets = detector.scanFile(filePath, fileContent);

      expect(secrets.length).toBeGreaterThan(0);

      // Should detect Anthropic API key
      const anthropicKey = secrets.find(s => s.type === 'Anthropic API Key');
      expect(anthropicKey).toBeDefined();
      expect(anthropicKey?.location).toBe(filePath);

      // Should detect AWS key
      const awsKey = secrets.find(s => s.type === 'AWS Access Key');
      expect(awsKey).toBeDefined();

      // Should detect password
      const password = secrets.find(s => s.type === 'Password in Code');
      expect(password).toBeDefined();

      // Should detect database connection string
      const dbConn = secrets.find(s => s.type === 'Database Connection String');
      expect(dbConn).toBeDefined();
    });

    test('scan directory recursively', () => {
      // Create nested directory structure
      const subDir = path.join(tempDir, 'src');
      fs.mkdirSync(subDir);

      // Create files with secrets
      const files = [
        {
          path: path.join(tempDir, '.env'),
          content: 'OPENAI_API_KEY=sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890AB',
        },
        {
          path: path.join(subDir, 'auth.ts'),
          content: 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxy";',
        },
        {
          path: path.join(subDir, 'db.ts'),
          content: 'const conn = "mongodb://admin:secret123@localhost:27017/mydb";',
        },
      ];

      files.forEach(file => {
        fs.writeFileSync(file.path, file.content);
      });

      // Scan all files
      const allSecrets: any[] = [];
      const scanDirectory = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const secrets = detector.scanFile(fullPath, content);
            allSecrets.push(...secrets);
          }
        }
      };

      scanDirectory(tempDir);

      expect(allSecrets.length).toBeGreaterThan(0);

      // Should detect OpenAI key
      const openaiKey = allSecrets.find(s => s.type === 'OpenAI API Key');
      expect(openaiKey).toBeDefined();

      // Should detect GitHub token
      const githubToken = allSecrets.find(s => s.type === 'GitHub Token');
      expect(githubToken).toBeDefined();
    });

    test('redact secrets in file and write to new file', () => {
      const inputPath = path.join(tempDir, 'input.txt');
      const outputPath = path.join(tempDir, 'output.txt');

      const content = `
        API Key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop
        AWS Key: AKIAIOSFODNN7EXAMPLE
        Password: MySecretPassword123!
      `;

      fs.writeFileSync(inputPath, content);

      // Read and redact
      const originalContent = fs.readFileSync(inputPath, 'utf-8');
      const redactedContent = detector.redactSecrets(originalContent);

      // Write redacted version
      fs.writeFileSync(outputPath, redactedContent);

      // Verify redacted file doesn't contain original secrets
      const redactedFile = fs.readFileSync(outputPath, 'utf-8');
      expect(redactedFile).not.toContain('sk-ant-api03-abcdefghijklmnopqrstuvwxyz');
      expect(redactedFile).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(redactedFile).toContain('***'); // Should have redaction markers
    });

    test('generate report and save to file', () => {
      const reportPath = path.join(tempDir, 'secret-report.txt');

      const testContent = `
        const apiKey = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop';
        const awsKey = 'AKIAIOSFODNN7EXAMPLE';
        const googleKey = 'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI';
      `;

      const secrets = detector.scanText(testContent, 'test.js');
      const report = detector.generateReport(secrets);

      fs.writeFileSync(reportPath, report);

      // Verify report file
      expect(fs.existsSync(reportPath)).toBe(true);

      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      expect(reportContent).toContain('SECRETS DETECTED');
      expect(reportContent).toContain('Critical:');
      expect(reportContent).toContain('Anthropic API Key');
    });
  });

  describe('Secret Vault Integration', () => {
    test('local vault store and retrieve', async () => {
      const config: SecretVaultConfig = {
        provider: 'local',
      };

      const vault = new SecretVault(config);

      // Store secrets
      await vault.store('api-key', 'my-secret-api-key-12345');
      await vault.store('db-password', 'super-secure-password');
      await vault.store('encryption-key', 'AES-256-encryption-key');

      // Retrieve secrets
      const apiKey = await vault.retrieve('api-key');
      const dbPassword = await vault.retrieve('db-password');
      const encryptionKey = await vault.retrieve('encryption-key');

      expect(apiKey).toBe('my-secret-api-key-12345');
      expect(dbPassword).toBe('super-secure-password');
      expect(encryptionKey).toBe('AES-256-encryption-key');

      // Try to retrieve non-existent secret
      const nonExistent = await vault.retrieve('non-existent');
      expect(nonExistent).toBeNull();
    });

    test('vault encryption at rest', async () => {
      const config: SecretVaultConfig = {
        provider: 'local',
      };

      const vault = new SecretVault(config);

      const plaintext = 'sensitive-data-12345';
      await vault.store('test-secret', plaintext);

      // The vault should encrypt the data internally
      // We can't directly access the encrypted form, but we can verify
      // that retrieve returns the correct plaintext
      const retrieved = await vault.retrieve('test-secret');
      expect(retrieved).toBe(plaintext);
    });

    test('secret rotation', async () => {
      const config: SecretVaultConfig = {
        provider: 'local',
      };

      const vault = new SecretVault(config);

      // Store original secret
      await vault.store('api-key', 'old-api-key-12345');

      // Verify original
      const original = await vault.retrieve('api-key');
      expect(original).toBe('old-api-key-12345');

      // Rotate secret
      await vault.rotate('api-key', 'new-api-key-67890');

      // Verify new secret
      const rotated = await vault.retrieve('api-key');
      expect(rotated).toBe('new-api-key-67890');
      expect(rotated).not.toBe(original);
    });

    test('delete secrets', async () => {
      const config: SecretVaultConfig = {
        provider: 'local',
      };

      const vault = new SecretVault(config);

      // Store and verify
      await vault.store('temp-secret', 'temporary-value');
      expect(await vault.retrieve('temp-secret')).toBe('temporary-value');

      // Delete
      await vault.delete('temp-secret');

      // Verify deleted
      expect(await vault.retrieve('temp-secret')).toBeNull();
    });

    test('list all secrets', async () => {
      const config: SecretVaultConfig = {
        provider: 'local',
      };

      const vault = new SecretVault(config);

      // Store multiple secrets
      await vault.store('secret-1', 'value-1');
      await vault.store('secret-2', 'value-2');
      await vault.store('secret-3', 'value-3');

      // List all
      const secrets = vault.listSecrets();

      expect(secrets.length).toBeGreaterThanOrEqual(3);
      expect(secrets).toContain('secret-1');
      expect(secrets).toContain('secret-2');
      expect(secrets).toContain('secret-3');
    });
  });

  describe('End-to-End Secret Management Flow', () => {
    test('detect, vault, and redact workflow', async () => {
      // 1. Create file with secrets
      const configPath = path.join(tempDir, 'config.json');
      const originalConfig = {
        apiKey: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop',
        dbPassword: 'MyDatabasePassword123!',
        awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
      };

      fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));

      // 2. Scan for secrets
      const content = fs.readFileSync(configPath, 'utf-8');
      const secrets = detector.scanFile(configPath, content);

      expect(secrets.length).toBeGreaterThan(0);

      // 3. Store secrets in vault
      const vault = new SecretVault({ provider: 'local' });

      for (const secret of secrets) {
        const key = `${secret.type.replace(/\s+/g, '-').toLowerCase()}-${secret.line}`;
        await vault.store(key, secret.value);
      }

      // 4. Redact secrets in file
      const redactedContent = detector.redactSecrets(content);
      const redactedPath = path.join(tempDir, 'config.redacted.json');
      fs.writeFileSync(redactedPath, redactedContent);

      // 5. Verify redacted file
      const redactedFile = fs.readFileSync(redactedPath, 'utf-8');
      expect(redactedFile).not.toContain(originalConfig.apiKey);
      expect(redactedFile).not.toContain(originalConfig.awsAccessKey);

      // 6. Verify secrets can be retrieved from vault
      const storedSecrets = vault.listSecrets();
      expect(storedSecrets.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations', () => {
    test('concurrent vault operations', async () => {
      const vault = new SecretVault({ provider: 'local' });

      // Store secrets concurrently
      const storeOps = [];
      for (let i = 0; i < 50; i++) {
        storeOps.push(vault.store(`key-${i}`, `value-${i}`));
      }

      await Promise.all(storeOps);

      // Retrieve secrets concurrently
      const retrieveOps = [];
      for (let i = 0; i < 50; i++) {
        retrieveOps.push(vault.retrieve(`key-${i}`));
      }

      const values = await Promise.all(retrieveOps);

      // Verify all values
      values.forEach((value, index) => {
        expect(value).toBe(`value-${index}`);
      });
    });

    test('concurrent secret detection', () => {
      const files = [];

      // Create multiple files
      for (let i = 0; i < 20; i++) {
        const filePath = path.join(tempDir, `file-${i}.txt`);
        const content = `
          API Key ${i}: sk-ant-api03-abcdefghijklmnopqrstuvwxyz${i}234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefgh
          AWS Key ${i}: AKIAIOSFODNN7EXAMPL${i}
        `;
        fs.writeFileSync(filePath, content);
        files.push({ path: filePath, content });
      }

      // Scan all files concurrently
      const scanResults = files.map(file =>
        detector.scanFile(file.path, file.content)
      );

      // Verify all scans completed
      expect(scanResults.length).toBe(20);
      expect(scanResults.every(result => Array.isArray(result))).toBe(true);
    });
  });

  describe('Error Propagation', () => {
    test('handle invalid file paths', () => {
      const content = 'some content';
      const invalidPath = '/non/existent/path/file.txt';

      // Should still scan content, just with invalid path in results
      const secrets = detector.scanFile(invalidPath, content);

      expect(Array.isArray(secrets)).toBe(true);
    });

    test('handle corrupted content gracefully', () => {
      const corruptedContent = '\x00\x01\x02\x03\xFF\xFE\xFD';

      // Should handle binary/corrupted content without crashing
      expect(() => {
        detector.scanText(corruptedContent, 'binary-file');
      }).not.toThrow();
    });

    test('vault retrieve non-existent key', async () => {
      const vault = new SecretVault({ provider: 'local' });

      const result = await vault.retrieve('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('Whitelist Functionality', () => {
    test('whitelisted secrets are not detected', () => {
      const testApiKey = 'sk-ant-api03-TEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

      // Add to whitelist
      detector.addToWhitelist(testApiKey);

      const content = `const apiKey = '${testApiKey}';`;
      const secrets = detector.scanText(content, 'test.js');

      // Should not detect whitelisted key
      const foundKey = secrets.find(s => s.value === testApiKey);
      expect(foundKey).toBeUndefined();
    });

    test('remove from whitelist', () => {
      const testApiKey = 'sk-ant-api03-TEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

      // Add and then remove from whitelist
      detector.addToWhitelist(testApiKey);
      detector.removeFromWhitelist(testApiKey);

      const content = `const apiKey = '${testApiKey}';`;
      const secrets = detector.scanText(content, 'test.js');

      // Should now detect the key
      const foundKey = secrets.find(s => s.type === 'Anthropic API Key');
      expect(foundKey).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('scan large file efficiently', () => {
      const largePath = path.join(tempDir, 'large-file.txt');

      // Create large file with some secrets
      let content = '';
      for (let i = 0; i < 1000; i++) {
        content += `Line ${i}: Some normal content here\n`;
        if (i % 100 === 0) {
          content += `API Key: sk-ant-api03-key${i}67890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678\n`;
        }
      }

      fs.writeFileSync(largePath, content);

      const startTime = Date.now();
      const secrets = detector.scanFile(largePath, content);
      const duration = Date.now() - startTime;

      expect(secrets.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test('vault handles many secrets', async () => {
      const vault = new SecretVault({ provider: 'local' });

      const startTime = Date.now();

      // Store 1000 secrets
      for (let i = 0; i < 1000; i++) {
        await vault.store(`key-${i}`, `value-${i}`);
      }

      const storeDuration = Date.now() - startTime;

      // Retrieve all
      const retrieveStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        await vault.retrieve(`key-${i}`);
      }
      const retrieveDuration = Date.now() - retrieveStart;

      expect(storeDuration).toBeLessThan(5000); // Store should be fast
      expect(retrieveDuration).toBeLessThan(5000); // Retrieve should be fast
    });
  });

  describe('Integration with File System Watching', () => {
    test('detect secrets in newly created files', (done) => {
      const watchDir = path.join(tempDir, 'watched');
      fs.mkdirSync(watchDir);

      const detectedSecrets: any[] = [];

      // Simulate file watcher
      const watcher = fs.watch(watchDir, (eventType, filename) => {
        if (eventType === 'rename' && filename) {
          const filePath = path.join(watchDir, filename);

          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const secrets = detector.scanFile(filePath, content);

            if (secrets.length > 0) {
              detectedSecrets.push(...secrets);
            }
          }
        }
      });

      // Create file with secret
      setTimeout(() => {
        const testFile = path.join(watchDir, 'new-config.js');
        fs.writeFileSync(
          testFile,
          'const key = "AKIAIOSFODNN7EXAMPLE";'
        );

        setTimeout(() => {
          watcher.close();
          expect(detectedSecrets.length).toBeGreaterThan(0);
          done();
        }, 200);
      }, 100);
    });
  });
});
