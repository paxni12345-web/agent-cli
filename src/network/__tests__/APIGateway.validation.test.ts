/**
 * API Gateway Validation Tests
 * Comprehensive tests for request validation, sanitization, and security
 */

import { z } from 'zod';
import {
  ValidationMiddleware,
  CommonSchemas,
  ValidationHelpers,
  Request,
} from '../APIGateway';

describe('ValidationMiddleware', () => {
  // Helper to create mock request
  const createMockRequest = (body: any = {}, query: any = {}, params: any = {}): Request => ({
    id: 'test-123',
    method: 'POST',
    path: '/test',
    headers: {},
    query,
    body,
    params,
    ip: '127.0.0.1',
    timestamp: Date.now(),
    metadata: {},
  });

  describe('Schema Validation', () => {
    it('should validate valid data against schema', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().int().min(18),
      });

      const request = createMockRequest({
        email: 'test@example.com',
        age: 25,
      });

      const result = await ValidationMiddleware.validate(request, { schema });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email format', async () => {
      const schema = z.object({
        email: CommonSchemas.email,
      });

      const request = createMockRequest({
        email: 'invalid-email',
      });

      const result = await ValidationMiddleware.validate(request, { schema });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('email');
    });

    it('should validate number ranges', async () => {
      const schema = z.object({
        age: z.number().int().min(0).max(120),
      });

      const validRequest = createMockRequest({ age: 25 });
      const invalidRequest = createMockRequest({ age: 150 });

      const validResult = await ValidationMiddleware.validate(validRequest, { schema });
      const invalidResult = await ValidationMiddleware.validate(invalidRequest, { schema });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate string length', async () => {
      const schema = z.object({
        username: z.string().min(3).max(20),
      });

      const validRequest = createMockRequest({ username: 'john' });
      const tooShortRequest = createMockRequest({ username: 'ab' });
      const tooLongRequest = createMockRequest({ username: 'a'.repeat(30) });

      const validResult = await ValidationMiddleware.validate(validRequest, { schema });
      const tooShortResult = await ValidationMiddleware.validate(tooShortRequest, { schema });
      const tooLongResult = await ValidationMiddleware.validate(tooLongRequest, { schema });

      expect(validResult.valid).toBe(true);
      expect(tooShortResult.valid).toBe(false);
      expect(tooLongResult.valid).toBe(false);
    });

    it('should validate nested objects', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          contact: z.object({
            email: CommonSchemas.email,
            phone: CommonSchemas.phone,
          }),
        }),
      });

      const request = createMockRequest({
        user: {
          name: 'John Doe',
          contact: {
            email: 'john@example.com',
            phone: '+1-555-0100',
          },
        },
      });

      const result = await ValidationMiddleware.validate(request, { schema });

      expect(result.valid).toBe(true);
    });
  });

  describe('XSS Prevention', () => {
    it('should detect script tags', async () => {
      const request = createMockRequest({
        comment: '<script>alert("XSS")</script>',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventXSS: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'XSS_DETECTED')).toBe(true);
    });

    it('should detect iframe tags', async () => {
      const request = createMockRequest({
        content: '<iframe src="evil.com"></iframe>',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventXSS: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'XSS_DETECTED')).toBe(true);
    });

    it('should detect javascript: URLs', async () => {
      const request = createMockRequest({
        link: 'javascript:alert(1)',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventXSS: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'XSS_DETECTED')).toBe(true);
    });

    it('should detect event handlers', async () => {
      const request = createMockRequest({
        html: '<img src="x" onerror="alert(1)">',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventXSS: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'XSS_DETECTED')).toBe(true);
    });

    it('should allow safe content', async () => {
      const request = createMockRequest({
        content: 'This is safe content without any scripts',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventXSS: true,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should detect SELECT statements', async () => {
      const request = createMockRequest({
        query: "admin' OR '1'='1",
      });

      const result = await ValidationMiddleware.validate(request, {
        preventSQLInjection: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SQL_INJECTION_DETECTED')).toBe(true);
    });

    it('should detect UNION attacks', async () => {
      const request = createMockRequest({
        id: "1 UNION SELECT * FROM users",
      });

      const result = await ValidationMiddleware.validate(request, {
        preventSQLInjection: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SQL_INJECTION_DETECTED')).toBe(true);
    });

    it('should detect comment syntax', async () => {
      const request = createMockRequest({
        value: "admin'--",
      });

      const result = await ValidationMiddleware.validate(request, {
        preventSQLInjection: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'SQL_INJECTION_DETECTED')).toBe(true);
    });

    it('should allow safe database queries', async () => {
      const request = createMockRequest({
        search: 'John Doe',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventSQLInjection: true,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Command Injection Prevention', () => {
    it('should detect pipe commands', async () => {
      const request = createMockRequest({
        command: 'ls | rm -rf /',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventCommandInjection: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'COMMAND_INJECTION_DETECTED')).toBe(true);
    });

    it('should detect semicolon separation', async () => {
      const request = createMockRequest({
        input: 'echo hello; rm -rf /',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventCommandInjection: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'COMMAND_INJECTION_DETECTED')).toBe(true);
    });

    it('should detect backticks', async () => {
      const request = createMockRequest({
        value: '`cat /etc/passwd`',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventCommandInjection: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'COMMAND_INJECTION_DETECTED')).toBe(true);
    });

    it('should allow safe strings', async () => {
      const request = createMockRequest({
        filename: 'document.txt',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventCommandInjection: true,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should detect double dot attacks', async () => {
      const request = createMockRequest({
        path: '../../etc/passwd',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventPathTraversal: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PATH_TRAVERSAL_DETECTED')).toBe(true);
    });

    it('should detect /etc/ access', async () => {
      const request = createMockRequest({
        file: '/etc/shadow',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventPathTraversal: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PATH_TRAVERSAL_DETECTED')).toBe(true);
    });

    it('should detect encoded traversal', async () => {
      const request = createMockRequest({
        path: '%2e%2e/sensitive',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventPathTraversal: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PATH_TRAVERSAL_DETECTED')).toBe(true);
    });

    it('should allow safe paths', async () => {
      const request = createMockRequest({
        path: 'documents/report.pdf',
      });

      const result = await ValidationMiddleware.validate(request, {
        preventPathTraversal: true,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Sanitization', () => {
    it('should sanitize HTML content', async () => {
      const schema = z.object({
        content: z.string(),
      });

      const request = createMockRequest({
        content: '<script>alert("XSS")</script>Hello',
      });

      const result = await ValidationMiddleware.validate(request, {
        schema,
        sanitize: true,
        preventXSS: false, // Allow but sanitize
      });

      expect(result.valid).toBe(true);
      expect(result.sanitized?.body.content).not.toContain('<script>');
      expect(result.sanitized?.body.content).toContain('&lt;script&gt;');
    });

    it('should trim whitespace', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const request = createMockRequest({
        name: '  John Doe  ',
      });

      const result = await ValidationMiddleware.validate(request, {
        schema,
        sanitize: true,
      });

      expect(result.valid).toBe(true);
      expect(result.sanitized?.body.name).toBe('John Doe');
    });

    it('should sanitize nested objects', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          bio: z.string(),
        }),
      });

      const request = createMockRequest({
        user: {
          name: '  John  ',
          bio: '<b>Hello</b>',
        },
      });

      const result = await ValidationMiddleware.validate(request, {
        schema,
        sanitize: true,
      });

      expect(result.valid).toBe(true);
      expect(result.sanitized?.body.user.name).toBe('John');
      expect(result.sanitized?.body.user.bio).not.toContain('<b>');
    });
  });

  describe('Custom Validators', () => {
    it('should run custom validators', async () => {
      const request = createMockRequest({
        email: 'test@blocked.com',
      });

      const result = await ValidationMiddleware.validate(request, {
        customValidators: [
          {
            field: 'body.email',
            validator: (email: string) => {
              const domain = email.split('@')[1];
              return domain !== 'blocked.com';
            },
            message: 'Email domain is blocked',
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Email domain is blocked');
    });

    it('should support async custom validators', async () => {
      const request = createMockRequest({
        username: 'taken',
      });

      const result = await ValidationMiddleware.validate(request, {
        customValidators: [
          {
            field: 'body.username',
            validator: async (username: string) => {
              // Simulate database check
              await new Promise(resolve => setTimeout(resolve, 10));
              return username !== 'taken';
            },
            message: 'Username already taken',
          },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Username already taken');
    });
  });

  describe('Common Schemas', () => {
    it('should validate email format', async () => {
      const validEmails = ['test@example.com', 'user+tag@domain.co.uk'];
      const invalidEmails = ['invalid', '@example.com', 'user@'];

      for (const email of validEmails) {
        const result = CommonSchemas.email.safeParse(email);
        expect(result.success).toBe(true);
      }

      for (const email of invalidEmails) {
        const result = CommonSchemas.email.safeParse(email);
        expect(result.success).toBe(false);
      }
    });

    it('should validate phone numbers', async () => {
      const validPhones = ['+1-555-0100', '555-0100', '(555) 0100'];
      const invalidPhones = ['abc', '123', '555'];

      for (const phone of validPhones) {
        const result = CommonSchemas.phone.safeParse(phone);
        expect(result.success).toBe(true);
      }

      for (const phone of invalidPhones) {
        const result = CommonSchemas.phone.safeParse(phone);
        expect(result.success).toBe(false);
      }
    });

    it('should validate URLs', async () => {
      const validUrls = ['https://example.com', 'http://localhost:8080'];
      const invalidUrls = ['not-a-url', 'ftp://invalid', 'javascript:alert(1)'];

      for (const url of validUrls) {
        const result = CommonSchemas.url.safeParse(url);
        expect(result.success).toBe(true);
      }

      for (const url of invalidUrls) {
        const result = CommonSchemas.url.safeParse(url);
        expect(result.success).toBe(false);
      }
    });

    it('should validate username format', async () => {
      const validUsernames = ['john_doe', 'user123', 'test-user'];
      const invalidUsernames = ['ab', 'user@name', 'user name', 'a'.repeat(50)];

      for (const username of validUsernames) {
        const result = CommonSchemas.username.safeParse(username);
        expect(result.success).toBe(true);
      }

      for (const username of invalidUsernames) {
        const result = CommonSchemas.username.safeParse(username);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('ValidationHelpers', () => {
    it('should create secure validation config', () => {
      const schema = z.object({ test: z.string() });
      const config = ValidationHelpers.createSecureValidation(schema);

      expect(config.schema).toBe(schema);
      expect(config.sanitize).toBe(true);
      expect(config.preventXSS).toBe(true);
      expect(config.preventSQLInjection).toBe(true);
      expect(config.preventCommandInjection).toBe(true);
      expect(config.preventPathTraversal).toBe(true);
    });

    it('should create rate limit configs', () => {
      const strict = ValidationHelpers.createRateLimit.strict();
      expect(strict.maxRequests).toBe(10);
      expect(strict.windowMs).toBe(60000);

      const moderate = ValidationHelpers.createRateLimit.moderate();
      expect(moderate.maxRequests).toBe(60);

      const lenient = ValidationHelpers.createRateLimit.lenient();
      expect(lenient.maxRequests).toBe(100);
    });

    it('should create custom rate limit', () => {
      const custom = ValidationHelpers.createRateLimit.custom(50, 30000, 'sliding_window');
      expect(custom.maxRequests).toBe(50);
      expect(custom.windowMs).toBe(30000);
      expect(custom.strategy).toBe('sliding_window');
    });
  });
});
