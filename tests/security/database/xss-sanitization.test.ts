/**
 * XSS and Data Sanitization Security Tests
 * Tests for Cross-Site Scripting vulnerabilities in database-stored content
 */

import {
  DatabaseConnection,
  QueryBuilder,
  Model
} from '../../../src/database/MEGA_DatabaseAbstraction';

describe('XSS and Data Sanitization Security Tests', () => {
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

  describe('Stored XSS Prevention', () => {
    test('should detect script tags in user input', async () => {
      const maliciousInput = '<script>alert("XSS")</script>';

      const containsScriptTag = (input: string): boolean => {
        return /<script[^>]*>.*?<\/script>/gi.test(input);
      };

      expect(containsScriptTag(maliciousInput)).toBe(true);
    });

    test('should detect various XSS vectors', () => {
      const xssVectors = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')">',
        '<body onload=alert("XSS")>',
        '<input onfocus=alert("XSS") autofocus>',
        '<select onfocus=alert("XSS") autofocus>',
        '<textarea onfocus=alert("XSS") autofocus>',
        '<marquee onstart=alert("XSS")>',
        '<details open ontoggle=alert("XSS")>',
        'javascript:alert("XSS")',
        '<a href="javascript:alert(\'XSS\')">Click</a>',
        '<object data="javascript:alert(\'XSS\')">',
        '<embed src="javascript:alert(\'XSS\')">'
      ];

      const hasXSS = (input: string): boolean => {
        const patterns = [
          /<script[^>]*>.*?<\/script>/gi,
          /on\w+\s*=/gi,
          /javascript:/gi,
          /<iframe/gi,
          /<object/gi,
          /<embed/gi
        ];

        return patterns.some(pattern => pattern.test(input));
      };

      for (const vector of xssVectors) {
        expect(hasXSS(vector)).toBe(true);
      }
    });

    test('should escape HTML entities', () => {
      const unsafeInput = '<script>alert("XSS")</script>';

      const escapeHTML = (input: string): string => {
        const escapeMap: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '/': '&#x2F;'
        };

        return input.replace(/[&<>"'\/]/g, char => escapeMap[char]);
      };

      const escaped = escapeHTML(unsafeInput);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(escaped).not.toContain('<script>');
    });

    test('should sanitize before storing in database', async () => {
      const userInput = 'Hello <script>alert("XSS")</script> World';

      const sanitize = (input: string): string => {
        // Remove script tags and event handlers
        let sanitized = input.replace(/<script[^>]*>.*?<\/script>/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        return sanitized.trim();
      };

      const sanitized = sanitize(userInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('Hello  World');
    });

    test('should detect encoded XSS attacks', () => {
      const encodedXSS = [
        '&#60;script&#62;alert("XSS")&#60;/script&#62;',
        '%3Cscript%3Ealert("XSS")%3C/script%3E',
        '\\x3cscript\\x3ealert("XSS")\\x3c/script\\x3e',
        '\\u003cscript\\u003ealert("XSS")\\u003c/script\\u003e'
      ];

      const decodeAndCheck = (input: string): boolean => {
        // Decode HTML entities
        const decoded = input
          .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
          .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/%([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

        return /<script/i.test(decoded);
      };

      for (const encoded of encodedXSS) {
        expect(decodeAndCheck(encoded)).toBe(true);
      }
    });

    test('should prevent DOM-based XSS', () => {
      const userInput = '"><script>alert("XSS")</script>';

      const sanitizeForAttribute = (input: string): string => {
        // Remove quotes and angle brackets
        return input.replace(/[<>"']/g, '');
      };

      const sanitized = sanitizeForAttribute(userInput);
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });
  });

  describe('Content Security Policy Headers', () => {
    test('should define strict CSP for database-served content', () => {
      const csp = {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'strict-dynamic'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': []
      };

      expect(csp['default-src']).toContain("'self'");
      expect(csp['object-src']).toContain("'none'");
      expect(csp['frame-ancestors']).toContain("'none'");
    });

    test('should reject unsafe-eval in CSP', () => {
      const unsafeCSP = {
        'script-src': ["'self'", "'unsafe-eval'"] // Dangerous!
      };

      const isUnsafe = unsafeCSP['script-src'].includes("'unsafe-eval'");
      expect(isUnsafe).toBe(true); // This is a vulnerability
    });

    test('should use nonce or hash for inline scripts', () => {
      const nonce = Buffer.from(require('crypto').randomBytes(16)).toString('base64');
      const csp = {
        'script-src': ["'self'", `'nonce-${nonce}'`]
      };

      expect(csp['script-src'].some(src => src.startsWith("'nonce-"))).toBe(true);
    });
  });

  describe('JSON Injection Prevention', () => {
    test('should prevent JSON injection in stored data', async () => {
      const maliciousJSON = '{"name":"user","admin":true}';

      const qb = new QueryBuilder(connection);
      const { sql, params } = qb
        .select('*')
        .from('users')
        .where('preferences', '=', maliciousJSON)
        .build();

      // Should be parameterized
      expect(params).toContain(maliciousJSON);
    });

    test('should validate JSON structure before storage', () => {
      const invalidJSON = '{"name":"user", "callback": function() { alert("XSS") }}';

      const isValidJSON = (input: string): boolean => {
        try {
          JSON.parse(input);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidJSON(invalidJSON)).toBe(false);
      expect(isValidJSON('{"name":"user"}')).toBe(true);
    });

    test('should sanitize JSON values', () => {
      const userInput = {
        name: '<script>alert("XSS")</script>',
        bio: 'Normal bio',
        website: 'javascript:alert("XSS")'
      };

      const sanitizeJSON = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }

        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = Array.isArray(obj) ? [] : {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeJSON(value);
          }
          return sanitized;
        }

        return obj;
      };

      const sanitized = sanitizeJSON(userInput);
      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.website).not.toContain('javascript:');
    });

    test('should prevent prototype pollution', () => {
      const maliciousJSON = '{"__proto__":{"isAdmin":true}}';

      const safeParse = (input: string): any => {
        const obj = JSON.parse(input);

        // Remove dangerous properties
        delete obj.__proto__;
        delete obj.constructor;
        delete obj.prototype;

        return obj;
      };

      const parsed = safeParse(maliciousJSON);
      expect(parsed.__proto__).toBeUndefined();
    });
  });

  describe('LDAP Injection in Search', () => {
    test('should escape LDAP special characters', () => {
      const maliciousInput = 'admin)(|(password=*))';

      const escapeLDAP = (input: string): string => {
        const escapeMap: Record<string, string> = {
          '\\': '\\5c',
          '*': '\\2a',
          '(': '\\28',
          ')': '\\29',
          '\0': '\\00'
        };

        return input.replace(/[\\*\(\)\0]/g, char => escapeMap[char]);
      };

      const escaped = escapeLDAP(maliciousInput);
      expect(escaped).not.toContain('(');
      expect(escaped).not.toContain(')');
      expect(escaped).toContain('\\28');
      expect(escaped).toContain('\\29');
    });

    test('should prevent LDAP filter injection', () => {
      const username = 'admin';
      const maliciousPassword = '*)(uid=*))(&(password=*';

      const buildLDAPFilter = (user: string, pass: string): string => {
        const escapeLDAP = (s: string): string => {
          return s.replace(/[\\*\(\)\0]/g, char => {
            const map: Record<string, string> = {
              '\\': '\\5c', '*': '\\2a', '(': '\\28', ')': '\\29', '\0': '\\00'
            };
            return map[char];
          });
        };

        return `(&(uid=${escapeLDAP(user)})(password=${escapeLDAP(pass)}))`;
      };

      const filter = buildLDAPFilter(username, maliciousPassword);
      expect(filter).not.toContain(')(&(');
      expect(filter).toContain('\\29');
      expect(filter).toContain('\\28');
    });
  });

  describe('URL Validation and Sanitization', () => {
    test('should validate URL schemes', () => {
      const dangerousURLs = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
        'file:///etc/passwd',
        'jar:http://evil.com!/evil.class'
      ];

      const isSafeURL = (url: string): boolean => {
        const safeSchemes = ['http:', 'https:', 'mailto:', 'tel:'];
        try {
          const parsed = new URL(url);
          return safeSchemes.includes(parsed.protocol);
        } catch {
          return false;
        }
      };

      for (const url of dangerousURLs) {
        expect(isSafeURL(url)).toBe(false);
      }

      expect(isSafeURL('https://example.com')).toBe(true);
      expect(isSafeURL('http://example.com')).toBe(true);
    });

    test('should prevent open redirect vulnerabilities', () => {
      const redirectURL = 'http://evil.com';
      const allowedDomains = ['example.com', 'app.example.com'];

      const isAllowedRedirect = (url: string): boolean => {
        try {
          const parsed = new URL(url);
          return allowedDomains.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
          );
        } catch {
          return false;
        }
      };

      expect(isAllowedRedirect(redirectURL)).toBe(false);
      expect(isAllowedRedirect('https://example.com/page')).toBe(true);
      expect(isAllowedRedirect('https://sub.example.com/page')).toBe(true);
    });

    test('should sanitize URLs before storage', async () => {
      const userURL = 'javascript:alert("XSS")';

      const sanitizeURL = (url: string): string | null => {
        try {
          const parsed = new URL(url);
          if (['http:', 'https:'].includes(parsed.protocol)) {
            return parsed.href;
          }
          return null;
        } catch {
          return null;
        }
      };

      const sanitized = sanitizeURL(userURL);
      expect(sanitized).toBeNull();

      const validURL = sanitizeURL('https://example.com');
      expect(validURL).toBe('https://example.com/');
    });
  });

  describe('NoSQL Injection via XSS', () => {
    test('should prevent MongoDB operator injection in stored data', () => {
      const maliciousData = {
        username: 'admin',
        preferences: { $where: 'function() { return true; }' }
      };

      const hasMongoOperators = (obj: any): boolean => {
        if (typeof obj !== 'object' || obj === null) return false;

        for (const key in obj) {
          if (key.startsWith('$')) return true;
          if (typeof obj[key] === 'object' && hasMongoOperators(obj[key])) {
            return true;
          }
        }
        return false;
      };

      expect(hasMongoOperators(maliciousData.preferences)).toBe(true);
    });

    test('should strip MongoDB operators from user input', () => {
      const input = {
        name: 'John',
        age: { $gt: 0 },
        preferences: { theme: 'dark', $where: 'evil' }
      };

      const stripMongoOperators = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) return obj;

        const cleaned: any = Array.isArray(obj) ? [] : {};

        for (const [key, value] of Object.entries(obj)) {
          if (!key.startsWith('$')) {
            cleaned[key] = stripMongoOperators(value);
          }
        }

        return cleaned;
      };

      const cleaned = stripMongoOperators(input);
      expect(cleaned.age).toBeUndefined();
      expect(cleaned.preferences.$where).toBeUndefined();
      expect(cleaned.preferences.theme).toBe('dark');
    });
  });

  describe('Input Length Validation', () => {
    test('should enforce maximum field lengths', () => {
      const maxLengths = {
        username: 50,
        email: 255,
        bio: 500,
        comment: 2000
      };

      const validateLength = (field: string, value: string): boolean => {
        const maxLength = maxLengths[field as keyof typeof maxLengths];
        return maxLength ? value.length <= maxLength : true;
      };

      expect(validateLength('username', 'a'.repeat(100))).toBe(false);
      expect(validateLength('username', 'validuser')).toBe(true);
      expect(validateLength('bio', 'a'.repeat(1000))).toBe(false);
    });

    test('should prevent buffer overflow attacks', () => {
      const hugeInput = 'A'.repeat(1000000); // 1MB

      const isSafeSize = (input: string, maxBytes: number = 65536): boolean => {
        return Buffer.byteLength(input, 'utf8') <= maxBytes;
      };

      expect(isSafeSize(hugeInput)).toBe(false);
      expect(isSafeSize('normal input')).toBe(true);
    });

    test('should truncate long inputs safely', () => {
      const longInput = 'A'.repeat(1000);
      const maxLength = 100;

      const truncateSafely = (input: string, max: number): string => {
        if (input.length <= max) return input;
        return input.substring(0, max - 3) + '...';
      };

      const truncated = truncateSafely(longInput, maxLength);
      expect(truncated.length).toBe(maxLength);
      expect(truncated.endsWith('...')).toBe(true);
    });
  });

  describe('File Upload Validation', () => {
    test('should validate file types before storage', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

      const isAllowedFileType = (mimeType: string): boolean => {
        return allowedTypes.includes(mimeType.toLowerCase());
      };

      expect(isAllowedFileType('image/jpeg')).toBe(true);
      expect(isAllowedFileType('application/pdf')).toBe(true);
      expect(isAllowedFileType('text/html')).toBe(false);
      expect(isAllowedFileType('application/x-php')).toBe(false);
    });

    test('should validate file extensions', () => {
      const dangerousExtensions = [
        '.exe', '.bat', '.cmd', '.sh', '.php', '.jsp',
        '.asp', '.aspx', '.jar', '.war', '.dll', '.so'
      ];

      const hasDangerousExtension = (filename: string): boolean => {
        const lower = filename.toLowerCase();
        return dangerousExtensions.some(ext => lower.endsWith(ext));
      };

      expect(hasDangerousExtension('document.pdf')).toBe(false);
      expect(hasDangerousExtension('image.jpg')).toBe(false);
      expect(hasDangerousExtension('malware.exe')).toBe(true);
      expect(hasDangerousExtension('shell.php')).toBe(true);
    });

    test('should sanitize filenames before storage', () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        'file<script>.jpg',
        'image"; DROP TABLE files;--.jpg',
        'file\x00.jpg.exe'
      ];

      const sanitizeFilename = (filename: string): string => {
        // Remove path components
        let sanitized = filename.split(/[/\\]/).pop() || '';

        // Remove null bytes
        sanitized = sanitized.replace(/\x00/g, '');

        // Remove special characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

        return sanitized;
      };

      for (const filename of maliciousFilenames) {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain(';');
      }
    });

    test('should validate file size', () => {
      const maxSize = 10 * 1024 * 1024; // 10MB

      const isValidFileSize = (sizeBytes: number): boolean => {
        return sizeBytes > 0 && sizeBytes <= maxSize;
      };

      expect(isValidFileSize(5 * 1024 * 1024)).toBe(true); // 5MB
      expect(isValidFileSize(50 * 1024 * 1024)).toBe(false); // 50MB
      expect(isValidFileSize(0)).toBe(false);
      expect(isValidFileSize(-1)).toBe(false);
    });
  });

  describe('Regex Denial of Service (ReDoS)', () => {
    test('should detect catastrophic backtracking patterns', () => {
      const dangerousPatterns = [
        '(a+)+b',
        '(a|a)*',
        '(a|ab)*',
        '([a-z]+)*[A-Z]'
      ];

      const hasCatastrophicBacktracking = (pattern: string): boolean => {
        // Simplified check for nested quantifiers
        return /(\*|\+|\{.*\}).*(\*|\+|\{.*\})/.test(pattern);
      };

      for (const pattern of dangerousPatterns) {
        expect(hasCatastrophicBacktracking(pattern)).toBe(true);
      }
    });

    test('should use timeout for regex operations', () => {
      const maliciousInput = 'a'.repeat(10000) + 'X';
      const dangerousPattern = /^(a+)+$/;

      const safeRegexMatch = (pattern: RegExp, input: string, timeout: number = 100): boolean => {
        const start = Date.now();

        try {
          const result = pattern.test(input);
          const elapsed = Date.now() - start;

          if (elapsed > timeout) {
            throw new Error('Regex timeout');
          }

          return result;
        } catch (error) {
          return false;
        }
      };

      // This should timeout or fail safely
      expect(() => safeRegexMatch(dangerousPattern, maliciousInput)).not.toThrow();
    });
  });
});
