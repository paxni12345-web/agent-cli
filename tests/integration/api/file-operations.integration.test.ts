/**
 * File Operations + API Integration Tests
 * Tests real file operations with temporary directories
 */

import { APIGateway, APIRequest, HTTPMethod } from '../../../src/api/APIGateway';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'fs';

describe('File Operations + API Integration Tests', () => {
  let gateway: APIGateway;
  let testDir: string;

  beforeAll(() => {
    testDir = join(tmpdir(), `api-file-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup temp directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    gateway = new APIGateway();
  });

  describe('Real File Operations', () => {
    it('should create file via API endpoint', async () => {
      gateway.registerEndpoint({
        path: '/api/files',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { filename, content } = request.body;
          const filepath = join(testDir, filename);

          writeFileSync(filepath, content, 'utf-8');

          return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: {
              success: true,
              filepath,
              size: content.length,
            },
          };
        },
        middleware: [],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/files',
        headers: {},
        query: {},
        params: {},
        body: {
          filename: 'test.txt',
          content: 'Hello, World!',
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify file was created
      const filepath = join(testDir, 'test.txt');
      expect(existsSync(filepath)).toBe(true);
      expect(readFileSync(filepath, 'utf-8')).toBe('Hello, World!');
    });

    it('should read file via API endpoint', async () => {
      const filename = 'read-test.txt';
      const content = 'File content for reading';
      writeFileSync(join(testDir, filename), content);

      gateway.registerEndpoint({
        path: '/api/files/:filename',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { filename } = request.params;
          const filepath = join(testDir, filename);

          if (!existsSync(filepath)) {
            return {
              statusCode: 404,
              headers: {},
              body: { error: 'File not found' },
            };
          }

          const fileContent = readFileSync(filepath, 'utf-8');

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/plain' },
            body: fileContent,
          };
        },
        middleware: [],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: `/api/files/${filename}`,
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(content);
    });

    it('should delete file via API endpoint', async () => {
      const filename = 'delete-test.txt';
      const filepath = join(testDir, filename);
      writeFileSync(filepath, 'To be deleted');

      gateway.registerEndpoint({
        path: '/api/files/:filename',
        method: HTTPMethod.DELETE,
        handler: async (request) => {
          const { filename } = request.params;
          const filepath = join(testDir, filename);

          if (!existsSync(filepath)) {
            return {
              statusCode: 404,
              headers: {},
              body: { error: 'File not found' },
            };
          }

          rmSync(filepath);

          return {
            statusCode: 200,
            headers: {},
            body: { success: true, deleted: filename },
          };
        },
        middleware: [],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.DELETE,
        path: `/api/files/${filename}`,
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(existsSync(filepath)).toBe(false);
    });

    it('should update file via API endpoint', async () => {
      const filename = 'update-test.txt';
      const filepath = join(testDir, filename);
      writeFileSync(filepath, 'Original content');

      gateway.registerEndpoint({
        path: '/api/files/:filename',
        method: HTTPMethod.PUT,
        handler: async (request) => {
          const { filename } = request.params;
          const { content } = request.body;
          const filepath = join(testDir, filename);

          writeFileSync(filepath, content, 'utf-8');

          return {
            statusCode: 200,
            headers: {},
            body: { success: true, updated: filename },
          };
        },
        middleware: [],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.PUT,
        path: `/api/files/${filename}`,
        headers: {},
        query: {},
        params: {},
        body: { content: 'Updated content' },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(readFileSync(filepath, 'utf-8')).toBe('Updated content');
    });

    it('should list files in directory via API endpoint', async () => {
      // Create test files
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      files.forEach(file => {
        writeFileSync(join(testDir, file), `Content of ${file}`);
      });

      gateway.registerEndpoint({
        path: '/api/files',
        method: HTTPMethod.GET,
        handler: async () => {
          const fileList = readdirSync(testDir);

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
              files: fileList.map(name => ({
                name,
                path: join(testDir, name),
              })),
              count: fileList.length,
            },
          };
        },
        middleware: [],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/files',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body.count).toBeGreaterThanOrEqual(3);
      expect(response.body.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'file1.txt' }),
          expect.objectContaining({ name: 'file2.txt' }),
          expect.objectContaining({ name: 'file3.txt' }),
        ])
      );
    });
  });

  describe('File Upload Simulation', () => {
    it('should handle file upload with metadata', async () => {
      gateway.registerEndpoint({
        path: '/api/upload',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { filename, content, metadata } = request.body;
          const filepath = join(testDir, filename);

          // Write file
          writeFileSync(filepath, content);

          // Write metadata
          const metaPath = `${filepath}.meta.json`;
          writeFileSync(metaPath, JSON.stringify(metadata));

          return {
            statusCode: 201,
            headers: {},
            body: {
              success: true,
              filename,
              metadata,
              size: content.length,
            },
          };
        },
        middleware: [],
        validation: {
          body: {
            type: 'object',
            properties: {
              filename: { type: 'string', minLength: 1, maxLength: 255 },
              content: { type: 'string' },
              metadata: { type: 'object' },
            },
            required: ['filename', 'content'],
          },
        },
        tags: ['upload'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/upload',
        headers: {},
        query: {},
        params: {},
        body: {
          filename: 'upload.txt',
          content: 'Uploaded content',
          metadata: {
            uploadedBy: 'user123',
            timestamp: Date.now(),
            contentType: 'text/plain',
          },
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify file and metadata
      const filepath = join(testDir, 'upload.txt');
      const metaPath = `${filepath}.meta.json`;

      expect(existsSync(filepath)).toBe(true);
      expect(existsSync(metaPath)).toBe(true);

      const metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
      expect(metadata.uploadedBy).toBe('user123');
    });
  });

  describe('Concurrent File Operations', () => {
    it('should handle concurrent file writes', async () => {
      gateway.registerEndpoint({
        path: '/api/concurrent/write',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { id, content } = request.body;
          const filepath = join(testDir, `concurrent-${id}.txt`);

          writeFileSync(filepath, content);

          return {
            statusCode: 201,
            headers: {},
            body: { success: true, id },
          };
        },
        middleware: [],
        tags: ['concurrent'],
      });

      // Make concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) => {
        const request: APIRequest = {
          method: HTTPMethod.POST,
          path: '/api/concurrent/write',
          headers: {},
          query: {},
          params: {},
          body: {
            id: i,
            content: `Content ${i}`,
          },
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      });

      const responses = await Promise.all(requests);

      // All should succeed
      expect(responses.every(r => r.statusCode === 201)).toBe(true);

      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        const filepath = join(testDir, `concurrent-${i}.txt`);
        expect(existsSync(filepath)).toBe(true);
        expect(readFileSync(filepath, 'utf-8')).toBe(`Content ${i}`);
      }
    });

    it('should handle concurrent file reads', async () => {
      // Create test file
      const filename = 'concurrent-read.txt';
      const filepath = join(testDir, filename);
      writeFileSync(filepath, 'Shared content');

      gateway.registerEndpoint({
        path: '/api/concurrent/read/:filename',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { filename } = request.params;
          const filepath = join(testDir, filename);

          const content = readFileSync(filepath, 'utf-8');

          return {
            statusCode: 200,
            headers: {},
            body: { content },
          };
        },
        middleware: [],
        tags: ['concurrent'],
      });

      // Make concurrent read requests
      const requests = Array.from({ length: 20 }, () => {
        const request: APIRequest = {
          method: HTTPMethod.GET,
          path: `/api/concurrent/read/${filename}`,
          headers: {},
          query: {},
          params: {},
          body: null,
          ip: '192.168.1.1',
        };
        return gateway.handleRequest(request);
      });

      const responses = await Promise.all(requests);

      // All should succeed
      expect(responses.every(r => r.statusCode === 200)).toBe(true);
      expect(responses.every(r => r.body.content === 'Shared content')).toBe(true);
    });
  });

  describe('Error Handling with Files', () => {
    it('should handle file not found errors', async () => {
      gateway.registerEndpoint({
        path: '/api/files/:filename',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { filename } = request.params;
          const filepath = join(testDir, filename);

          if (!existsSync(filepath)) {
            throw new Error(`File not found: ${filename}`);
          }

          return {
            statusCode: 200,
            headers: {},
            body: { content: readFileSync(filepath, 'utf-8') },
          };
        },
        middleware: [],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/files/non-existent.txt',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid file paths', async () => {
      gateway.registerEndpoint({
        path: '/api/files/:filename',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { filename } = request.params;

          // Validate filename (no path traversal)
          if (filename.includes('..') || filename.includes('/')) {
            return {
              statusCode: 400,
              headers: {},
              body: { error: 'Invalid filename' },
            };
          }

          const filepath = join(testDir, filename);
          const content = readFileSync(filepath, 'utf-8');

          return {
            statusCode: 200,
            headers: {},
            body: { content },
          };
        },
        middleware: [],
        tags: ['files'],
      });

      const request: APIRequest = {
        method: HTTPMethod.GET,
        path: '/api/files/../../../etc/passwd',
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Invalid filename');
    });
  });

  describe('File-based Caching', () => {
    it('should cache file reads', async () => {
      const filename = 'cached-file.txt';
      const filepath = join(testDir, filename);
      writeFileSync(filepath, 'Cached content');

      let readCount = 0;

      gateway.registerEndpoint({
        path: '/api/cached-files/:filename',
        method: HTTPMethod.GET,
        handler: async (request) => {
          const { filename } = request.params;
          const filepath = join(testDir, filename);

          readCount++;
          const content = readFileSync(filepath, 'utf-8');

          return {
            statusCode: 200,
            headers: {},
            body: { content, readCount },
          };
        },
        middleware: [],
        caching: {
          enabled: true,
          ttl: 5000,
        },
        tags: ['cached-files'],
      });

      // First request
      const request1: APIRequest = {
        method: HTTPMethod.GET,
        path: `/api/cached-files/${filename}`,
        headers: {},
        query: {},
        params: {},
        body: null,
        ip: '192.168.1.1',
      };

      const response1 = await gateway.handleRequest(request1);
      expect(response1.body.readCount).toBe(1);

      // Second request (should be cached)
      const response2 = await gateway.handleRequest(request1);
      expect(response2.body.readCount).toBe(1); // Same count, from cache
    });
  });

  describe('Temporary File Operations', () => {
    it('should create and clean up temporary files', async () => {
      const tempFiles: string[] = [];

      gateway.registerEndpoint({
        path: '/api/temp/create',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { content } = request.body;
          const tempFilename = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`;
          const filepath = join(testDir, tempFilename);

          writeFileSync(filepath, content);
          tempFiles.push(filepath);

          // Simulate auto-cleanup after delay
          setTimeout(() => {
            if (existsSync(filepath)) {
              rmSync(filepath);
            }
          }, 100);

          return {
            statusCode: 201,
            headers: {},
            body: { tempFile: tempFilename },
          };
        },
        middleware: [],
        tags: ['temp'],
      });

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/temp/create',
        headers: {},
        query: {},
        params: {},
        body: { content: 'Temporary content' },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.tempFile).toBeDefined();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify files were cleaned up
      tempFiles.forEach(file => {
        expect(existsSync(file)).toBe(false);
      });
    });
  });

  describe('Binary File Operations', () => {
    it('should handle binary file data', async () => {
      gateway.registerEndpoint({
        path: '/api/binary',
        method: HTTPMethod.POST,
        handler: async (request) => {
          const { filename, base64Data } = request.body;
          const filepath = join(testDir, filename);

          const buffer = Buffer.from(base64Data, 'base64');
          writeFileSync(filepath, buffer);

          return {
            statusCode: 201,
            headers: {},
            body: {
              success: true,
              filename,
              size: buffer.length,
            },
          };
        },
        middleware: [],
        tags: ['binary'],
      });

      const binaryData = Buffer.from('Binary content');
      const base64Data = binaryData.toString('base64');

      const request: APIRequest = {
        method: HTTPMethod.POST,
        path: '/api/binary',
        headers: {},
        query: {},
        params: {},
        body: {
          filename: 'binary.dat',
          base64Data,
        },
        ip: '192.168.1.1',
      };

      const response = await gateway.handleRequest(request);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify binary file
      const filepath = join(testDir, 'binary.dat');
      const savedData = readFileSync(filepath);
      expect(savedData.equals(binaryData)).toBe(true);
    });
  });
});
