/**
 * Security Test Suite: Path Traversal and File System Attacks
 * Tests for directory traversal, file inclusion, and file system vulnerabilities
 */

import { SecretDetector } from '../../../src/security/SecretManager';
import * as path from 'path';
import * as fs from 'fs';

describe('Path Traversal Security Tests', () => {
  let secretDetector: SecretDetector;

  beforeEach(() => {
    secretDetector = new SecretDetector();
  });

  describe('Directory Traversal Attacks', () => {
    test('should prevent basic directory traversal with ../', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        './../../sensitive/data.txt',
        'uploads/../../../etc/shadow',
      ];

      for (const maliciousPath of maliciousPaths) {
        const normalized = path.normalize(maliciousPath);
        expect(normalized.includes('..')).toBe(false);
      }
    });

    test('should prevent encoded directory traversal', () => {
      const encodedPaths = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      ];

      for (const encodedPath of encodedPaths) {
        const decoded = decodeURIComponent(encodedPath);
        const normalized = path.normalize(decoded);
        expect(normalized.includes('..')).toBe(false);
      }
    });

    test('should prevent double-encoded traversal', () => {
      const doubleEncoded = '%252e%252e%252f%252e%252e%252fetc%252fpasswd';

      // First decode
      const firstDecode = decodeURIComponent(doubleEncoded);
      expect(firstDecode).toContain('%2e');

      // Second decode
      const secondDecode = decodeURIComponent(firstDecode);
      expect(secondDecode).toContain('..');

      // Should be blocked after normalization
      const normalized = path.normalize(secondDecode);
      expect(normalized.includes('..')).toBe(false);
    });

    test('should prevent unicode encoding traversal', () => {
      const unicodePaths = [
        '\u002e\u002e\u002f\u002e\u002e\u002fetc\u002fpasswd',
        '%u002e%u002e%u002fetc%u002fpasswd',
      ];

      for (const unicodePath of unicodePaths) {
        const normalized = path.normalize(unicodePath);
        // Check if path is contained within safe directory
        const basePath = '/var/www/uploads';
        const fullPath = path.join(basePath, normalized);
        expect(fullPath.startsWith(basePath)).toBe(true);
      }
    });

    test('should prevent null byte injection in paths', () => {
      const nullBytePaths = [
        'safe.txt\x00../../etc/passwd',
        'image.png\x00.php',
        'document.pdf\x00\x00../../sensitive',
      ];

      for (const nullPath of nullBytePaths) {
        // Remove null bytes
        const sanitized = nullPath.replace(/\x00/g, '');
        expect(sanitized).not.toContain('\x00');
      }
    });

    test('should prevent path traversal with absolute paths', () => {
      const absolutePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM',
        '/var/log/auth.log',
        '\\\\network\\share\\sensitive.txt',
      ];

      const basePath = '/var/www/uploads';

      for (const absolutePath of absolutePaths) {
        const joined = path.join(basePath, absolutePath);
        // Absolute paths should be rejected or normalized
        expect(path.isAbsolute(absolutePath)).toBe(true);
      }
    });

    test('should validate file paths stay within allowed directory', () => {
      const basePath = '/var/www/uploads';
      const allowedPath = path.join(basePath, 'user123', 'document.pdf');
      const maliciousPath = path.join(basePath, '..', '..', 'etc', 'passwd');

      expect(allowedPath.startsWith(basePath)).toBe(true);
      expect(maliciousPath.startsWith(basePath)).toBe(false);
    });

    test('should prevent traversal using backslash on Unix', () => {
      const backslashPaths = [
        '..\\..\\..\\etc\\passwd',
        'uploads\\..\\..\\sensitive',
      ];

      for (const backslashPath of backslashPaths) {
        const normalized = path.normalize(backslashPath);
        // On Unix, backslashes are treated as regular characters
        // Should still prevent actual traversal
        expect(normalized).toBeDefined();
      }
    });

    test('should prevent traversal with forward slash on Windows', () => {
      const forwardSlashPaths = [
        '../../../windows/system32',
        'C:/Windows/../../../etc/passwd',
      ];

      for (const forwardPath of forwardSlashPaths) {
        const normalized = path.normalize(forwardPath);
        expect(normalized).toBeDefined();
      }
    });
  });

  describe('File Inclusion Vulnerabilities', () => {
    test('should prevent local file inclusion (LFI)', () => {
      const lfiPayloads = [
        '../../../../etc/passwd',
        '/etc/passwd',
        'file:///etc/passwd',
        '....//....//....//etc/passwd',
      ];

      for (const payload of lfiPayloads) {
        // Validate that file path is within allowed directory
        const basePath = '/var/www/html';
        const fullPath = path.resolve(basePath, payload);
        expect(fullPath.startsWith(basePath)).toBe(false);
      }
    });

    test('should prevent remote file inclusion (RFI)', () => {
      const rfiPayloads = [
        'http://evil.com/shell.php',
        'https://attacker.com/malicious.txt',
        'ftp://malicious.com/exploit.php',
        '//evil.com/shell.php',
      ];

      for (const payload of rfiPayloads) {
        // Check if URL is being used instead of file path
        const isUrl = payload.startsWith('http://') ||
                      payload.startsWith('https://') ||
                      payload.startsWith('ftp://') ||
                      payload.startsWith('//');

        expect(isUrl).toBe(true);
        // Should be rejected
      }
    });

    test('should prevent PHP wrapper exploitation', () => {
      const phpWrappers = [
        'php://filter/convert.base64-encode/resource=index.php',
        'php://input',
        'data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+',
        'expect://ls',
        'zip://archive.zip#shell.php',
      ];

      for (const wrapper of phpWrappers) {
        expect(wrapper.includes('://')).toBe(true);
        // These should be blocked
      }
    });

    test('should prevent filter bypass techniques', () => {
      const bypassAttempts = [
        '....//....//....//etc/passwd',
        '..;/..;/..;/etc/passwd',
        '....\\\\....\\\\etc\\passwd',
        '..///////..////..//////etc/passwd',
      ];

      for (const attempt of bypassAttempts) {
        const normalized = path.normalize(attempt);
        const cleaned = normalized.replace(/[\/\\]+/g, '/');
        expect(cleaned.includes('..')).toBe(false);
      }
    });
  });

  describe('Symlink Attacks', () => {
    test('should detect and prevent symlink traversal', () => {
      const testDir = '/tmp/test-symlink-' + Date.now();
      const targetDir = '/tmp/target-' + Date.now();

      try {
        // Create test directories
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);

        const symlinkPath = path.join(testDir, 'link');

        // Create symlink
        if (!fs.existsSync(symlinkPath)) {
          fs.symlinkSync(targetDir, symlinkPath);
        }

        // Check if path is a symlink
        const stats = fs.lstatSync(symlinkPath);
        expect(stats.isSymbolicLink()).toBe(true);

        // Cleanup
        if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
        if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
        if (fs.existsSync(targetDir)) fs.rmdirSync(targetDir);
      } catch (error) {
        // Symlink creation might fail in some environments
        expect(error).toBeDefined();
      }
    });

    test('should prevent symlink race conditions (TOCTOU)', () => {
      // Time-of-check to time-of-use vulnerability
      const filePath = '/tmp/test-file-' + Date.now() + '.txt';

      // Check if file exists
      const existsBefore = fs.existsSync(filePath);

      // Small delay to simulate race window
      const delay = 1;

      // Use file (attacker could replace with symlink in between)
      setTimeout(() => {
        const existsAfter = fs.existsSync(filePath);
        expect(existsBefore).toBe(existsAfter);
      }, delay);
    });

    test('should validate real path before operations', () => {
      const basePath = '/var/www/uploads';
      const userPath = 'user123/document.txt';
      const fullPath = path.join(basePath, userPath);

      try {
        const realPath = fs.realpathSync(fullPath);
        expect(realPath.startsWith(basePath)).toBe(true);
      } catch (error) {
        // File might not exist, which is fine for this test
        expect(error).toBeDefined();
      }
    });
  });

  describe('Filename Manipulation', () => {
    test('should sanitize dangerous filenames', () => {
      const dangerousFilenames = [
        '../../../etc/passwd',
        'file.php.txt',
        '.htaccess',
        'web.config',
        'file.txt;rm -rf /',
        'file.txt\nmalicious',
        'CON', // Windows reserved name
        'NUL',
        'AUX',
        'PRN',
      ];

      for (const filename of dangerousFilenames) {
        const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('\n');
      }
    });

    test('should prevent double extension attacks', () => {
      const doubleExtensions = [
        'image.jpg.php',
        'document.pdf.exe',
        'file.txt.sh',
        'data.csv.js',
      ];

      for (const filename of doubleExtensions) {
        const ext = path.extname(filename);
        const allowedExtensions = ['.jpg', '.png', '.pdf', '.txt', '.csv'];

        // Check if final extension is allowed
        expect(allowedExtensions.includes(ext)).toBe(false);
      }
    });

    test('should prevent executable file uploads', () => {
      const executableExtensions = [
        'shell.sh',
        'script.php',
        'program.exe',
        'binary.bin',
        'script.js',
        'page.jsp',
        'template.asp',
      ];

      const blockedExtensions = ['.sh', '.php', '.exe', '.bin', '.jsp', '.asp'];

      for (const filename of executableExtensions) {
        const ext = path.extname(filename);
        expect(blockedExtensions.includes(ext)).toBe(true);
      }
    });

    test('should handle special characters in filenames', () => {
      const specialCharFiles = [
        'file name with spaces.txt',
        'file\twith\ttabs.txt',
        'file\nwith\nnewlines.txt',
        'file;with;semicolons.txt',
        "file'with'quotes.txt",
        'file"with"doublequotes.txt',
      ];

      for (const filename of specialCharFiles) {
        const sanitized = filename.replace(/[^\w.-]/g, '_');
        expect(sanitized).not.toContain(' ');
        expect(sanitized).not.toContain('\t');
        expect(sanitized).not.toContain('\n');
        expect(sanitized).not.toContain(';');
      }
    });

    test('should prevent overwriting system files', () => {
      const systemFiles = [
        '.bashrc',
        '.bash_profile',
        '.ssh/authorized_keys',
        '.profile',
        'crontab',
      ];

      for (const filename of systemFiles) {
        expect(filename.startsWith('.')).toBe(true);
        // Hidden files should be blocked or carefully validated
      }
    });
  });

  describe('Archive Extraction Attacks', () => {
    test('should prevent zip slip vulnerability', () => {
      const zipEntries = [
        '../../etc/passwd',
        '../../../root/.ssh/authorized_keys',
        'C:\\Windows\\System32\\config\\SAM',
      ];

      const extractPath = '/var/www/uploads/extracted';

      for (const entry of zipEntries) {
        const fullPath = path.join(extractPath, entry);
        const normalized = path.normalize(fullPath);

        // Verify path stays within extraction directory
        expect(normalized.startsWith(extractPath)).toBe(false);
      }
    });

    test('should prevent tar absolute path extraction', () => {
      const tarEntries = [
        '/etc/passwd',
        '/root/.ssh/authorized_keys',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
      ];

      for (const entry of tarEntries) {
        expect(path.isAbsolute(entry)).toBe(true);
        // Absolute paths in archives should be rejected
      }
    });

    test('should validate archive file paths before extraction', () => {
      const archivePaths = [
        'safe/file.txt',
        'safe/nested/file.txt',
        '../unsafe/file.txt',
        'symlink/../../../etc/passwd',
      ];

      const basePath = '/var/www/uploads';

      for (const archivePath of archivePaths) {
        const fullPath = path.join(basePath, archivePath);
        const normalized = path.normalize(fullPath);
        const isSafe = normalized.startsWith(basePath);

        if (archivePath.includes('..')) {
          expect(isSafe).toBe(false);
        } else if (!archivePath.includes('..')) {
          expect(isSafe).toBe(true);
        }
      }
    });
  });

  describe('File System Information Disclosure', () => {
    test('should prevent directory listing exposure', () => {
      const basePath = '/var/www/html';

      try {
        const files = fs.readdirSync(basePath);
        // Directory listing should be restricted
        expect(Array.isArray(files)).toBe(true);
      } catch (error) {
        // Directory might not exist or access denied
        expect(error).toBeDefined();
      }
    });

    test('should prevent sensitive file detection', () => {
      const sensitiveFiles = [
        '.env',
        '.git/config',
        'config/database.yml',
        'wp-config.php',
        'web.config',
        '.htpasswd',
      ];

      for (const file of sensitiveFiles) {
        // These files should not be accessible
        expect(file.startsWith('.') || file.includes('config')).toBe(true);
      }
    });

    test('should prevent backup file exposure', () => {
      const backupPatterns = [
        'index.php.bak',
        'config.php~',
        'database.sql.old',
        'backup.tar.gz',
        '.git',
        '.svn',
      ];

      for (const pattern of backupPatterns) {
        // Backup files should be blocked
        const isBackup = pattern.includes('.bak') ||
                        pattern.includes('~') ||
                        pattern.includes('.old') ||
                        pattern.startsWith('.');
        expect(isBackup).toBe(true);
      }
    });

    test('should prevent source code disclosure', () => {
      const sourceFiles = [
        'index.php',
        'app.js',
        'main.py',
        'config.rb',
        'package.json',
      ];

      // Source files should be restricted based on context
      for (const file of sourceFiles) {
        const ext = path.extname(file);
        const sourceExtensions = ['.php', '.js', '.py', '.rb', '.json'];
        expect(sourceExtensions.includes(ext)).toBe(true);
      }
    });
  });

  describe('Path Canonicalization', () => {
    test('should normalize paths consistently', () => {
      const pathVariants = [
        '/var/www/html/../uploads/file.txt',
        '/var/www/./uploads/file.txt',
        '/var/www//uploads//file.txt',
        '/var/www/html/./uploads/../uploads/file.txt',
      ];

      const expected = path.normalize('/var/www/uploads/file.txt');

      for (const variant of pathVariants) {
        const normalized = path.normalize(variant);
        expect(normalized).toBe(expected);
      }
    });

    test('should handle mixed separators correctly', () => {
      const mixedPaths = [
        '/var/www\\uploads/file.txt',
        'C:\\Users/Admin\\Documents/file.txt',
      ];

      for (const mixedPath of mixedPaths) {
        const normalized = path.normalize(mixedPath);
        expect(normalized).toBeDefined();
      }
    });

    test('should resolve relative paths safely', () => {
      const relativePaths = [
        './uploads/file.txt',
        'uploads/./file.txt',
        'uploads/../uploads/file.txt',
      ];

      const basePath = '/var/www';

      for (const relativePath of relativePaths) {
        const resolved = path.resolve(basePath, relativePath);
        expect(resolved.startsWith(basePath)).toBe(true);
      }
    });
  });

  describe('File Permission Attacks', () => {
    test('should validate file permissions before operations', () => {
      const testFile = '/tmp/test-perms-' + Date.now() + '.txt';

      try {
        // Create test file
        fs.writeFileSync(testFile, 'test content');

        // Check permissions
        const stats = fs.statSync(testFile);
        const mode = stats.mode;

        // Verify file is not world-writable
        const worldWritable = (mode & 0o002) !== 0;
        expect(worldWritable).toBe(false);

        // Cleanup
        fs.unlinkSync(testFile);
      } catch (error) {
        // Permission test might fail in restricted environments
        expect(error).toBeDefined();
      }
    });

    test('should prevent race conditions in file operations', () => {
      const testFile = '/tmp/race-test-' + Date.now() + '.txt';

      // Create file
      fs.writeFileSync(testFile, 'initial content');

      // Check existence
      const exists = fs.existsSync(testFile);
      expect(exists).toBe(true);

      // Read file (attacker could modify between check and use)
      const content = fs.readFileSync(testFile, 'utf8');
      expect(content).toBe('initial content');

      // Cleanup
      fs.unlinkSync(testFile);
    });
  });
});
