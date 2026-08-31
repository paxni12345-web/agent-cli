/**
 * Path Traversal Security Tests
 * Tests for directory traversal and file path manipulation vulnerabilities
 */

import * as path from 'path';
import {
  DatabaseConnection,
  QueryBuilder
} from '../../../src/database/MEGA_DatabaseAbstraction';

describe('Path Traversal Security Tests', () => {
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

  describe('Directory Traversal Prevention', () => {
    test('should detect basic path traversal attempts', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'uploads/../../../etc/shadow',
        'data/../../config/database.yml'
      ];

      const hasTraversal = (filepath: string): boolean => {
        return filepath.includes('..') || filepath.includes('\\..\\');
      };

      for (const filepath of maliciousPaths) {
        expect(hasTraversal(filepath)).toBe(true);
      }
    });

    test('should detect encoded path traversal', () => {
      const encodedPaths = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '....//....//....//etc/passwd',
        '%252e%252e%252f', // Double encoding
        '..%c0%af..%c0%af..%c0%af'
      ];

      const decodeAndCheck = (filepath: string): boolean => {
        let decoded = decodeURIComponent(filepath);

        // Try double decoding
        try {
          decoded = decodeURIComponent(decoded);
        } catch {}

        // Normalize
        decoded = decoded.replace(/\\/g, '/');
        decoded = decoded.replace(/\/+/g, '/');

        return decoded.includes('..');
      };

      for (const filepath of encodedPaths) {
        expect(decodeAndCheck(filepath)).toBe(true);
      }
    });

    test('should detect null byte injection', () => {
      const maliciousPaths = [
        'file.txt\x00.jpg',
        '../../../etc/passwd\x00.png',
        'upload\x00/../../../config'
      ];

      const hasNullByte = (filepath: string): boolean => {
        return filepath.includes('\x00');
      };

      for (const filepath of maliciousPaths) {
        expect(hasNullByte(filepath)).toBe(true);
      }
    });

    test('should validate file paths safely', () => {
      const basePath = '/var/www/uploads';

      const isPathSafe = (filepath: string, base: string): boolean => {
        try {
          // Remove null bytes
          const sanitized = filepath.replace(/\x00/g, '');

          // Resolve absolute path
          const resolvedPath = path.resolve(base, sanitized);
          const resolvedBase = path.resolve(base);

          // Check if resolved path is within base
          return resolvedPath.startsWith(resolvedBase + path.sep) ||
                 resolvedPath === resolvedBase;
        } catch {
          return false;
        }
      };

      expect(isPathSafe('file.txt', basePath)).toBe(true);
      expect(isPathSafe('subdir/file.txt', basePath)).toBe(true);
      expect(isPathSafe('../../../etc/passwd', basePath)).toBe(false);
      expect(isPathSafe('/etc/passwd', basePath)).toBe(false);
    });

    test('should canonicalize paths before validation', () => {
      const normalizePath = (filepath: string): string => {
        // Remove null bytes
        let normalized = filepath.replace(/\x00/g, '');

        // Decode URL encoding
        try {
          normalized = decodeURIComponent(normalized);
        } catch {}

        // Normalize separators
        normalized = normalized.replace(/\\/g, '/');

        // Remove duplicate slashes
        normalized = normalized.replace(/\/+/g, '/');

        // Resolve path
        normalized = path.normalize(normalized);

        return normalized;
      };

      expect(normalizePath('../../../etc/passwd')).toContain('..');
      expect(normalizePath('normal/file.txt')).toBe('normal/file.txt');
    });
  });

  describe('Absolute Path Restrictions', () => {
    test('should reject absolute paths', () => {
      const absolutePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
        '/var/www/../../etc/shadow',
        'file:///etc/passwd'
      ];

      const isAbsolute = (filepath: string): boolean => {
        return path.isAbsolute(filepath) ||
               filepath.startsWith('file://') ||
               /^[a-zA-Z]:/.test(filepath);
      };

      for (const filepath of absolutePaths) {
        expect(isAbsolute(filepath)).toBe(true);
      }
    });

    test('should only allow relative paths within base directory', () => {
      const baseDir = '/var/www/uploads';

      const isWithinBase = (filepath: string, base: string): boolean => {
        if (path.isAbsolute(filepath)) {
          return false;
        }

        const resolved = path.resolve(base, filepath);
        const normalizedBase = path.resolve(base);

        return resolved.startsWith(normalizedBase + path.sep);
      };

      expect(isWithinBase('file.txt', baseDir)).toBe(true);
      expect(isWithinBase('subfolder/file.txt', baseDir)).toBe(true);
      expect(isWithinBase('../outside.txt', baseDir)).toBe(false);
      expect(isWithinBase('/etc/passwd', baseDir)).toBe(false);
    });
  });

  describe('Filename Sanitization', () => {
    test('should sanitize dangerous characters', () => {
      const dangerousFilenames = [
        'file<script>.txt',
        'image"; DROP TABLE files;--.jpg',
        'file|command.txt',
        'name&command.doc',
        'file$variable.txt',
        'test`whoami`.txt'
      ];

      const sanitizeFilename = (filename: string): string => {
        // Remove directory components
        let sanitized = path.basename(filename);

        // Remove null bytes
        sanitized = sanitized.replace(/\x00/g, '');

        // Remove shell metacharacters
        sanitized = sanitized.replace(/[<>:"|?*&;`$(){}[\]\\]/g, '_');

        // Remove leading dots and spaces
        sanitized = sanitized.replace(/^[.\s]+/, '');

        return sanitized;
      };

      for (const filename of dangerousFilenames) {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toMatch(/[<>:"|?*&;`$(){}[\]\\]/);
      }
    });

    test('should prevent reserved filenames', () => {
      const reservedNames = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3',
        'LPT1', 'LPT2', 'LPT3',
        '.htaccess', 'web.config'
      ];

      const isReserved = (filename: string): boolean => {
        const basename = path.basename(filename, path.extname(filename));
        return reservedNames.includes(basename.toUpperCase());
      };

      expect(isReserved('CON.txt')).toBe(true);
      expect(isReserved('COM1')).toBe(true);
      expect(isReserved('.htaccess')).toBe(true);
      expect(isReserved('normal.txt')).toBe(false);
    });

    test('should enforce maximum filename length', () => {
      const maxLength = 255;

      const longFilename = 'a'.repeat(300) + '.txt';

      const isValidLength = (filename: string): boolean => {
        return filename.length <= maxLength;
      };

      expect(isValidLength(longFilename)).toBe(false);
      expect(isValidLength('normal.txt')).toBe(true);
    });

    test('should validate file extensions', () => {
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'];

      const isAllowedExtension = (filename: string): boolean => {
        const ext = path.extname(filename).toLowerCase();
        return allowedExtensions.includes(ext);
      };

      expect(isAllowedExtension('document.pdf')).toBe(true);
      expect(isAllowedExtension('image.jpg')).toBe(true);
      expect(isAllowedExtension('malware.exe')).toBe(false);
      expect(isAllowedExtension('script.php')).toBe(false);
    });

    test('should detect double extensions', () => {
      const doubleExtensionFiles = [
        'image.jpg.exe',
        'document.pdf.php',
        'file.txt.bat'
      ];

      const hasDoubleExtension = (filename: string): boolean => {
        const parts = filename.split('.');
        return parts.length > 2;
      };

      for (const filename of doubleExtensionFiles) {
        expect(hasDoubleExtension(filename)).toBe(true);
      }

      expect(hasDoubleExtension('normal.txt')).toBe(false);
    });
  });

  describe('Symbolic Link Attacks', () => {
    test('should detect symbolic link attempts', () => {
      // Symbolic link attacks try to create links to sensitive files
      const symlinkMarkers = [
        'symlink:',
        'link:',
        '@'
      ];

      const looksLikeSymlink = (filepath: string): boolean => {
        return symlinkMarkers.some(marker => filepath.includes(marker));
      };

      expect(looksLikeSymlink('symlink:/etc/passwd')).toBe(true);
    });

    test('should prevent following symbolic links', () => {
      // In production, use fs.lstat() instead of fs.stat() to detect symlinks
      const fileInfo = {
        isSymbolicLink: true,
        path: '/uploads/link-to-etc-passwd'
      };

      const shouldReject = (info: typeof fileInfo): boolean => {
        return info.isSymbolicLink;
      };

      expect(shouldReject(fileInfo)).toBe(true);
    });
  });

  describe('Database File Path Storage', () => {
    test('should store sanitized paths in database', async () => {
      const userFilename = '../../../etc/passwd';

      const sanitizePath = (filepath: string): string => {
        // Remove directory traversal
        let sanitized = filepath.replace(/\.\./g, '');
        sanitized = sanitized.replace(/[/\\]/g, '_');
        sanitized = sanitized.replace(/\x00/g, '');
        return sanitized;
      };

      const sanitized = sanitizePath(userFilename);

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('files')
        .where('filename', '=', sanitized)
        .build();

      expect(params).toContain(sanitized);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/');
    });

    test('should validate paths retrieved from database', async () => {
      const dbPath = '../../../etc/passwd'; // Malicious data in DB

      const validateStoredPath = (storedPath: string, baseDir: string): boolean => {
        try {
          const resolved = path.resolve(baseDir, storedPath);
          const base = path.resolve(baseDir);
          return resolved.startsWith(base + path.sep);
        } catch {
          return false;
        }
      };

      const baseDir = '/var/www/uploads';
      expect(validateStoredPath(dbPath, baseDir)).toBe(false);
    });

    test('should use UUID-based filenames', () => {
      const generateSafeFilename = (originalName: string): string => {
        const ext = path.extname(originalName);
        const uuid = require('crypto').randomUUID();
        return `${uuid}${ext}`;
      };

      const filename = generateSafeFilename('../../../etc/passwd.txt');

      expect(filename).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.txt$/);
      expect(filename).not.toContain('..');
    });
  });

  describe('Archive Extraction Vulnerabilities', () => {
    test('should validate archive entry paths', () => {
      const archiveEntries = [
        'file.txt',
        'subfolder/file.txt',
        '../../../etc/passwd',
        '/etc/shadow',
        'normal/../../../../../../etc/hosts'
      ];

      const isEntryPathSafe = (entryPath: string, extractDir: string): boolean => {
        if (entryPath.includes('..')) return false;
        if (path.isAbsolute(entryPath)) return false;

        const fullPath = path.join(extractDir, entryPath);
        const normalized = path.normalize(fullPath);

        return normalized.startsWith(path.normalize(extractDir) + path.sep);
      };

      const extractDir = '/tmp/extract';

      expect(isEntryPathSafe('file.txt', extractDir)).toBe(true);
      expect(isEntryPathSafe('../../../etc/passwd', extractDir)).toBe(false);
      expect(isEntryPathSafe('/etc/shadow', extractDir)).toBe(false);
    });

    test('should prevent zip slip vulnerability', () => {
      const zipEntries = [
        { name: 'normal.txt', path: 'normal.txt' },
        { name: 'evil.txt', path: '../../../../etc/passwd' },
        { name: 'trick.txt', path: 'good/../../../bad.txt' }
      ];

      const isSafeZipEntry = (entry: { name: string; path: string }, baseDir: string): boolean => {
        const targetPath = path.join(baseDir, entry.path);
        const resolvedTarget = path.resolve(targetPath);
        const resolvedBase = path.resolve(baseDir);

        return resolvedTarget.startsWith(resolvedBase + path.sep);
      };

      const baseDir = '/tmp/unzip';

      expect(isSafeZipEntry(zipEntries[0], baseDir)).toBe(true);
      expect(isSafeZipEntry(zipEntries[1], baseDir)).toBe(false);
      expect(isSafeZipEntry(zipEntries[2], baseDir)).toBe(false);
    });

    test('should limit archive extraction depth', () => {
      const maxDepth = 10;

      const getPathDepth = (filepath: string): number => {
        return filepath.split(path.sep).filter(p => p && p !== '.').length;
      };

      expect(getPathDepth('a/b/c/d/e/f/g/h/i/j/k.txt')).toBeGreaterThan(maxDepth);
      expect(getPathDepth('normal/file.txt')).toBeLessThanOrEqual(maxDepth);
    });
  });

  describe('Configuration File Protection', () => {
    test('should prevent access to configuration files', () => {
      const configFiles = [
        '.env',
        'config.yml',
        'database.yml',
        '.htaccess',
        'web.config',
        'settings.py',
        'application.properties'
      ];

      const isConfigFile = (filename: string): boolean => {
        const basename = path.basename(filename).toLowerCase();
        return configFiles.some(cf => basename === cf || basename.startsWith('.'));
      };

      expect(isConfigFile('.env')).toBe(true);
      expect(isConfigFile('config.yml')).toBe(true);
      expect(isConfigFile('.htaccess')).toBe(true);
      expect(isConfigFile('document.pdf')).toBe(false);
    });

    test('should prevent access to hidden files', () => {
      const hiddenFiles = [
        '.git/config',
        '.svn/entries',
        '.env',
        '.bashrc',
        '.ssh/id_rsa'
      ];

      const isHiddenFile = (filepath: string): boolean => {
        return filepath.split('/').some(part => part.startsWith('.'));
      };

      for (const file of hiddenFiles) {
        expect(isHiddenFile(file)).toBe(true);
      }
    });

    test('should prevent access to backup files', () => {
      const backupPatterns = [
        /\.bak$/,
        /\.backup$/,
        /\.old$/,
        /~$/,
        /\.swp$/,
        /\.tmp$/
      ];

      const isBackupFile = (filename: string): boolean => {
        return backupPatterns.some(pattern => pattern.test(filename.toLowerCase()));
      };

      expect(isBackupFile('config.yml.bak')).toBe(true);
      expect(isBackupFile('database.yml.old')).toBe(true);
      expect(isBackupFile('file~')).toBe(true);
      expect(isBackupFile('normal.txt')).toBe(false);
    });
  });

  describe('File Upload Path Validation', () => {
    test('should validate upload directory', () => {
      const allowedUploadDirs = [
        '/var/www/uploads',
        '/tmp/uploads',
        '/data/user-files'
      ];

      const isAllowedUploadDir = (dir: string): boolean => {
        const normalized = path.normalize(dir);
        return allowedUploadDirs.some(allowed =>
          normalized.startsWith(path.normalize(allowed))
        );
      };

      expect(isAllowedUploadDir('/var/www/uploads/user123')).toBe(true);
      expect(isAllowedUploadDir('/etc/passwd')).toBe(false);
      expect(isAllowedUploadDir('/var/www/uploads/../../../etc')).toBe(false);
    });

    test('should generate safe upload paths', () => {
      const userId = 123;
      const originalFilename = '../../../etc/passwd.txt';

      const generateUploadPath = (userId: number, filename: string): string => {
        const crypto = require('crypto');
        const ext = path.extname(filename);
        const safeFilename = crypto.randomUUID() + ext;
        return path.join('/var/www/uploads', userId.toString(), safeFilename);
      };

      const uploadPath = generateUploadPath(userId, originalFilename);

      expect(uploadPath).toContain('/var/www/uploads/123/');
      expect(uploadPath).not.toContain('..');
      expect(uploadPath).toMatch(/\.txt$/);
    });

    test('should enforce per-user directory isolation', () => {
      const user1Id = 123;
      const user2Id = 456;
      const attemptedPath = `../user${user2Id}/file.txt`;

      const isUserAuthorized = (userId: number, filepath: string): boolean => {
        const userDir = path.join('/var/www/uploads', userId.toString());
        const fullPath = path.join(userDir, filepath);
        const normalized = path.normalize(fullPath);

        return normalized.startsWith(path.normalize(userDir) + path.sep);
      };

      expect(isUserAuthorized(user1Id, 'myfile.txt')).toBe(true);
      expect(isUserAuthorized(user1Id, attemptedPath)).toBe(false);
    });
  });

  describe('URL Path Traversal', () => {
    test('should validate URL paths', () => {
      const maliciousURLPaths = [
        '/api/files/../../etc/passwd',
        '/download?file=../../../etc/shadow',
        '/static/../../config/database.yml'
      ];

      const isURLPathSafe = (urlPath: string): boolean => {
        const decoded = decodeURIComponent(urlPath);
        return !decoded.includes('..');
      };

      for (const urlPath of maliciousURLPaths) {
        expect(isURLPathSafe(urlPath)).toBe(false);
      }
    });

    test('should normalize URL paths', () => {
      const normalizeURLPath = (urlPath: string): string => {
        let normalized = decodeURIComponent(urlPath);
        normalized = normalized.replace(/\\/g, '/');
        normalized = normalized.replace(/\/+/g, '/');
        normalized = normalized.replace(/\/\.\//g, '/');
        return normalized;
      };

      expect(normalizeURLPath('/api/../admin')).toContain('..');
      expect(normalizeURLPath('/api/./files')).toBe('/api/files');
    });
  });

  describe('Windows-Specific Path Issues', () => {
    test('should handle Windows path separators', () => {
      const windowsPaths = [
        'uploads\\..\\..\\..\\Windows\\System32',
        'files\\\\..\\\\config',
        'data\\..\\..\\etc'
      ];

      const hasWindowsTraversal = (filepath: string): boolean => {
        const normalized = filepath.replace(/\\/g, '/');
        return normalized.includes('..');
      };

      for (const filepath of windowsPaths) {
        expect(hasWindowsTraversal(filepath)).toBe(true);
      }
    });

    test('should prevent Windows UNC path attacks', () => {
      const uncPaths = [
        '\\\\attacker.com\\share\\file.txt',
        '//attacker.com/share/file.txt',
        '\\\\?\\C:\\Windows\\System32'
      ];

      const isUNCPath = (filepath: string): boolean => {
        return filepath.startsWith('\\\\') || filepath.startsWith('//');
      };

      for (const filepath of uncPaths) {
        expect(isUNCPath(filepath)).toBe(true);
      }
    });

    test('should prevent alternate data streams', () => {
      const adsFiles = [
        'normal.txt:hidden.exe',
        'file.doc:Zone.Identifier',
        'upload.jpg:malicious.php'
      ];

      const hasADS = (filename: string): boolean => {
        const parts = filename.split(':');
        return parts.length > 2 || (parts.length === 2 && !path.isAbsolute(filename));
      };

      for (const filename of adsFiles) {
        expect(hasADS(filename)).toBe(true);
      }
    });
  });
});
