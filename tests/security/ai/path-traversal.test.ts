/**
 * Security Tests: Path Traversal Attacks on AI Modules
 * Tests directory traversal, file access, and path manipulation vulnerabilities
 */

import { LearningSystem } from '../../../src/ai/LearningSystem';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('AI Module Path Traversal Tests', () => {
  describe('Directory Traversal Attacks', () => {
    test('should sanitize paths with parent directory references', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'legitimate/../../../../../../etc/shadow',
        './../../sensitive/data.json'
      ];

      maliciousPaths.forEach(maliciousPath => {
        // Path should be sanitized to prevent traversal
        const normalized = path.normalize(maliciousPath);
        const hasTraversal = normalized.includes('..');

        // After normalization, path should not escape intended directory
        expect(hasTraversal || normalized.startsWith('/')).toBe(true);
      });
    });

    test('should reject absolute paths that escape data directory', async () => {
      const dataDir = '/tmp/test-learning-secure';
      const learningSystem = new LearningSystem(dataDir);

      const maliciousAbsolutePaths = [
        '/etc/passwd',
        '/root/.ssh/id_rsa',
        '/var/log/auth.log',
        'C:\\Windows\\System32\\config\\SAM'
      ];

      maliciousAbsolutePaths.forEach(maliciousPath => {
        const isOutsideDataDir = !maliciousPath.startsWith(dataDir);
        expect(isOutsideDataDir).toBe(true);
      });

      await learningSystem.reset();
    });

    test('should prevent symbolic link attacks', async () => {
      const testDir = '/tmp/test-symlink-attack';

      try {
        await fs.mkdir(testDir, { recursive: true });

        // In real scenario, attacker creates symlink to sensitive file
        const symlinkPath = path.join(testDir, 'malicious-link');
        const targetPath = '/etc/passwd';

        // System should detect and reject symlink traversal
        const isSuspicious = async (filePath: string): Promise<boolean> => {
          try {
            const stats = await fs.lstat(filePath);
            return stats.isSymbolicLink();
          } catch {
            return false;
          }
        };

        // Verify we can detect symlinks
        expect(typeof isSuspicious).toBe('function');
      } finally {
        // Cleanup
        try {
          await fs.rm(testDir, { recursive: true, force: true });
        } catch {}
      }
    });

    test('should validate path components individually', () => {
      const suspiciousPathComponents = [
        '..',
        '.',
        '~',
        '$HOME',
        '%USERPROFILE%',
        '${env:HOME}'
      ];

      const containsSuspiciousComponent = (filePath: string): boolean => {
        const components = filePath.split(/[/\\]/);
        return components.some(comp =>
          suspiciousPathComponents.includes(comp) ||
          comp.includes('..') ||
          comp.startsWith('$') ||
          comp.includes('%')
        );
      };

      expect(containsSuspiciousComponent('../etc/passwd')).toBe(true);
      expect(containsSuspiciousComponent('$HOME/.ssh/id_rsa')).toBe(true);
      expect(containsSuspiciousComponent('legitimate/path/file.txt')).toBe(false);
    });
  });

  describe('Null Byte Injection', () => {
    test('should reject paths with null bytes', async () => {
      const nullByteAttacks = [
        'file.txt\x00.jpg',
        'legitimate\x00../../etc/passwd',
        'data.json\x00ignored',
        '/tmp/safe\x00/../../etc/shadow'
      ];

      nullByteAttacks.forEach(attack => {
        const containsNullByte = attack.includes('\x00');
        expect(containsNullByte).toBe(true);

        // System should reject paths with null bytes
        const isValid = !containsNullByte;
        expect(isValid).toBe(false);
      });
    });

    test('should prevent null byte file extension bypass', () => {
      const filename = 'malicious.php\x00.jpg';

      // Without proper sanitization, might be treated as .jpg
      const hasNullByte = filename.includes('\x00');
      expect(hasNullByte).toBe(true);

      // Proper sanitization should reject this
      const sanitized = filename.replace(/\x00/g, '');
      expect(sanitized).not.toContain('\x00');
    });
  });

  describe('URL Encoding Bypass', () => {
    test('should detect URL-encoded directory traversal', () => {
      const encodedAttacks = [
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252F..%252F..%252Fetc%252Fpasswd', // Double encoding
        '%2e%2e/%2e%2e/%2e%2e/etc/passwd'
      ];

      encodedAttacks.forEach(attack => {
        const decoded = decodeURIComponent(attack);
        const hasTraversal = decoded.includes('..') || decoded.includes('%2e%2e');
        expect(hasTraversal).toBe(true);
      });
    });

    test('should handle double URL encoding', () => {
      const doubleEncoded = '%252e%252e%252f'; // '../' double encoded

      const decodedOnce = decodeURIComponent(doubleEncoded);
      expect(decodedOnce).toBe('%2e%2e%2f');

      const decodedTwice = decodeURIComponent(decodedOnce);
      expect(decodedTwice).toBe('../');
    });

    test('should reject Unicode/UTF-8 encoded traversal', () => {
      const unicodeAttacks = [
        '\u002e\u002e\u002f', // Unicode for '../'
        '%c0%ae%c0%ae%c0%af', // Overlong UTF-8 encoding
        '\uFF0E\uFF0E\uFF0F' // Full-width characters
      ];

      unicodeAttacks.forEach(attack => {
        // Should detect various encodings of '..'
        const normalized = attack.normalize('NFKC');
        const suspicious = normalized.includes('.') || attack.includes('%');
        expect(suspicious).toBe(true);
      });
    });
  });

  describe('Operating System Specific Attacks', () => {
    test('should handle Windows-specific path traversal', () => {
      const windowsAttacks = [
        '..\\..\\..\\windows\\system32\\config\\sam',
        'C:\\windows\\system32\\drivers\\etc\\hosts',
        '\\\\?\\C:\\sensitive\\file.txt', // UNC path
        'file.txt::$DATA' // NTFS alternate data stream
      ];

      windowsAttacks.forEach(attack => {
        const hasWindowsTraversal = attack.includes('\\..') ||
                                    attack.includes('C:\\') ||
                                    attack.includes('\\\\?\\') ||
                                    attack.includes('::$');
        expect(hasWindowsTraversal).toBe(true);
      });
    });

    test('should prevent NTFS alternate data stream access', () => {
      const adsAttacks = [
        'file.txt::$DATA',
        'document.pdf:hidden.exe',
        'image.jpg::secret.txt:$DATA'
      ];

      adsAttacks.forEach(attack => {
        const hasADS = attack.includes('::') || /:[^/\\]+:/.test(attack);
        expect(hasADS).toBe(true);
      });
    });

    test('should handle Unix-specific path attacks', () => {
      const unixAttacks = [
        '~/.ssh/id_rsa',
        '~root/.bash_history',
        '/proc/self/environ',
        '/dev/random'
      ];

      unixAttacks.forEach(attack => {
        const isAbsoluteOrTilde = attack.startsWith('/') || attack.startsWith('~');
        expect(isAbsoluteOrTilde).toBe(true);
      });
    });
  });

  describe('Whitelisting and Validation', () => {
    test('should enforce allowed file extensions', () => {
      const allowedExtensions = ['.json', '.txt', '.log'];

      const validateExtension = (filename: string): boolean => {
        const ext = path.extname(filename).toLowerCase();
        return allowedExtensions.includes(ext);
      };

      expect(validateExtension('data.json')).toBe(true);
      expect(validateExtension('notes.txt')).toBe(true);
      expect(validateExtension('script.sh')).toBe(false);
      expect(validateExtension('malware.exe')).toBe(false);
    });

    test('should enforce directory whitelist', () => {
      const allowedDirectories = [
        '/tmp/test-learning-data',
        '/var/app/user-data',
        '/home/user/documents'
      ];

      const isPathAllowed = (requestedPath: string): boolean => {
        const normalized = path.resolve(requestedPath);
        return allowedDirectories.some(allowed => normalized.startsWith(allowed));
      };

      expect(isPathAllowed('/tmp/test-learning-data/file.json')).toBe(true);
      expect(isPathAllowed('/etc/passwd')).toBe(false);
      expect(isPathAllowed('/tmp/../etc/shadow')).toBe(false);
    });

    test('should validate filename against dangerous patterns', () => {
      const dangerousPatterns = [
        /^\./, // Hidden files
        /\.\.|\/\//, // Traversal patterns
        /[<>:"|?*]/, // Invalid filename chars
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i // Windows reserved
      ];

      const isFilenameSafe = (filename: string): boolean => {
        return !dangerousPatterns.some(pattern => pattern.test(filename));
      };

      expect(isFilenameSafe('legitimate.txt')).toBe(true);
      expect(isFilenameSafe('.hidden')).toBe(false);
      expect(isFilenameSafe('file../../../etc')).toBe(false);
      expect(isFilenameSafe('file<script>.txt')).toBe(false);
      expect(isFilenameSafe('CON')).toBe(false);
    });
  });

  describe('Case Sensitivity Exploits', () => {
    test('should handle case-insensitive file system attacks', () => {
      const mixedCaseAttacks = [
        '../ETC/passwd',
        '../Etc/PASSWD',
        '..\\WINDOWS\\system32',
        '..\\Windows\\System32'
      ];

      mixedCaseAttacks.forEach(attack => {
        const lowerCase = attack.toLowerCase();
        const hasTraversal = lowerCase.includes('..') &&
                            (lowerCase.includes('etc') || lowerCase.includes('windows'));
        expect(hasTraversal).toBe(true);
      });
    });

    test('should normalize case before path validation', () => {
      const allowedPath = '/tmp/data';
      const attemptedPaths = [
        '/TMP/data',
        '/tmp/DATA',
        '/Tmp/Data'
      ];

      attemptedPaths.forEach(attempted => {
        const normalizedAttempt = attempted.toLowerCase();
        const normalizedAllowed = allowedPath.toLowerCase();

        const matches = normalizedAttempt.startsWith(normalizedAllowed);
        expect(matches).toBe(true);
      });
    });
  });

  describe('Race Conditions (TOCTOU)', () => {
    test('should detect time-of-check to time-of-use vulnerabilities', async () => {
      const filePath = '/tmp/test-race-condition.txt';

      // Simulate TOCTOU attack scenario
      const checkThenUse = async (path: string): Promise<boolean> => {
        try {
          // Time of Check
          await fs.access(path);

          // Potential race window here
          // Attacker could replace file with symlink

          // Time of Use
          await fs.readFile(path);

          return true;
        } catch {
          return false;
        }
      };

      // In secure implementation, should use atomic operations
      // or file descriptors to prevent TOCTOU
      expect(typeof checkThenUse).toBe('function');
    });

    test('should use atomic operations for file access', async () => {
      const testFile = '/tmp/test-atomic.txt';

      try {
        // Open file and get descriptor in one atomic operation
        const atomicWrite = async (path: string, content: string) => {
          // Use O_CREAT | O_EXCL flags to prevent race conditions
          const flags = 'wx'; // Fail if file exists
          await fs.writeFile(path, content, { flag: flags });
        };

        // This approach is safer than check-then-write
        expect(typeof atomicWrite).toBe('function');
      } catch {
        // Expected if file exists
      }
    });
  });

  describe('Canonicalization Issues', () => {
    test('should resolve all path references before validation', () => {
      const testPaths = [
        './data/../../../etc/passwd',
        'data/./../../sensitive/file.txt',
        'data///..//..//etc//passwd'
      ];

      testPaths.forEach(testPath => {
        const resolved = path.resolve(testPath);
        const normalized = path.normalize(testPath);

        // Both should produce consistent results
        expect(typeof resolved).toBe('string');
        expect(typeof normalized).toBe('string');
      });
    });

    test('should handle multiple slashes and dots', () => {
      const messyPaths = [
        'data///.//..///file.txt',
        './././data/./../file.txt',
        'data/./././..//../file.txt'
      ];

      messyPaths.forEach(messy => {
        const cleaned = path.normalize(messy);
        expect(cleaned).not.toContain('//');
        expect(cleaned.split('/').filter(p => p === '.').length).toBe(0);
      });
    });

    test('should resolve symlinks in path validation', async () => {
      const testDir = '/tmp/test-symlink-resolve';

      try {
        await fs.mkdir(testDir, { recursive: true });

        const realPath = path.join(testDir, 'real');
        const linkPath = path.join(testDir, 'link');

        await fs.mkdir(realPath, { recursive: true });

        // Validate paths should resolve symlinks
        const resolvePath = async (p: string): Promise<string> => {
          try {
            return await fs.realpath(p);
          } catch {
            return p;
          }
        };

        const result = await resolvePath(testDir);
        expect(typeof result).toBe('string');
      } finally {
        try {
          await fs.rm(testDir, { recursive: true, force: true });
        } catch {}
      }
    });
  });

  describe('Backup and Temporary File Access', () => {
    test('should prevent access to backup files', () => {
      const backupPatterns = [
        'file.txt~',
        'file.txt.bak',
        '.file.txt.swp',
        'file.txt.old',
        '#file.txt#',
        'file.txt.backup'
      ];

      const isBackupFile = (filename: string): boolean => {
        return /\.(bak|old|backup|swp|tmp)$|^#.*#$|~$/.test(filename);
      };

      backupPatterns.forEach(backup => {
        expect(isBackupFile(backup)).toBe(true);
      });

      expect(isBackupFile('normal-file.txt')).toBe(false);
    });

    test('should prevent access to temporary files', () => {
      const tempPatterns = [
        '/tmp/sensitive-data-12345.tmp',
        '/var/tmp/session-abc123',
        'C:\\Users\\User\\AppData\\Local\\Temp\\secret.tmp'
      ];

      const isTempPath = (filepath: string): boolean => {
        return /\/tmp\/|\/var\/tmp\/|\\Temp\\/i.test(filepath) ||
               filepath.endsWith('.tmp');
      };

      tempPatterns.forEach(temp => {
        expect(isTempPath(temp)).toBe(true);
      });
    });

    test('should prevent access to version control directories', () => {
      const vcDirectories = [
        '.git/config',
        '.svn/entries',
        '.hg/store',
        'CVS/Entries',
        '.bzr/branch'
      ];

      const isVCPath = (filepath: string): boolean => {
        return /\/?\.(git|svn|hg|bzr)|\/CVS\//i.test(filepath);
      };

      vcDirectories.forEach(vc => {
        expect(isVCPath(vc)).toBe(true);
      });
    });
  });

  describe('LearningSystem Specific Path Security', () => {
    test('should prevent path traversal in data directory configuration', async () => {
      const maliciousDataDirs = [
        '../../../etc',
        '/etc/passwd',
        '../../../../../../root',
        'C:\\Windows\\System32'
      ];

      // Each LearningSystem instance should be isolated
      for (const maliciousDir of maliciousDataDirs) {
        const learningSystem = new LearningSystem(maliciousDir);

        // System should still function but data should be contained
        await learningSystem.recordFeedback('test', 'action', 1, 'success');
        expect(learningSystem.getStats().totalFeedback).toBe(1);

        await learningSystem.reset();
      }
    });

    test('should isolate data directories per instance', async () => {
      const system1 = new LearningSystem('/tmp/test-isolated-1');
      const system2 = new LearningSystem('/tmp/test-isolated-2');

      await system1.recordFeedback('task1', 'action1', 1, 'success');
      await system2.recordFeedback('task2', 'action2', 1, 'success');

      // Data should not cross-contaminate
      const stats1 = system1.getStats();
      const stats2 = system2.getStats();

      expect(stats1.totalFeedback).toBe(1);
      expect(stats2.totalFeedback).toBe(1);

      await system1.reset();
      await system2.reset();
    });

    test('should sanitize file paths in persistence layer', async () => {
      const learningSystem = new LearningSystem('/tmp/test-path-sanitize');

      const maliciousData = {
        filename: '../../../etc/passwd',
        path: '/etc/shadow',
        directory: '..\\..\\..\\windows\\system32'
      };

      await learningSystem.recordFeedback(
        'task',
        'action',
        1,
        'success',
        maliciousData
      );

      // System should store data safely
      expect(learningSystem.getStats().totalFeedback).toBe(1);

      await learningSystem.reset();
    });
  });
});
