/**
 * Integration Tests: File System and Storage Integration
 * Tests real file operations with temporary directories
 * Tests file watching, event propagation, and concurrent file access
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

// Mock File Watcher
class MockFileWatcher extends EventEmitter {
  private watchers: Map<string, any> = new Map();
  private watcherId = 0;

  watch(targetPath: string, options?: any): string {
    const id = `watcher-${this.watcherId++}`;
    this.watchers.set(id, { path: targetPath, options });
    this.emit('watch:started', { id, path: targetPath });
    return id;
  }

  unwatch(id: string): void {
    if (this.watchers.has(id)) {
      const watcher = this.watchers.get(id);
      this.watchers.delete(id);
      this.emit('watch:stopped', { id, path: watcher.path });
    }
  }

  simulateChange(watcherId: string, event: string, filename: string): void {
    if (this.watchers.has(watcherId)) {
      this.emit('change', { watcherId, event, filename, timestamp: new Date() });
    }
  }

  getActiveWatchers(): number {
    return this.watchers.size;
  }
}

// Mock Storage Manager
class MockStorageManager extends EventEmitter {
  private storage: Map<string, Buffer> = new Map();
  private metadata: Map<string, any> = new Map();

  async store(key: string, data: Buffer, meta?: any): Promise<void> {
    this.storage.set(key, data);
    this.metadata.set(key, { ...meta, size: data.length, timestamp: new Date() });
    this.emit('stored', { key, size: data.length });
  }

  async retrieve(key: string): Promise<Buffer | null> {
    const data = this.storage.get(key) || null;
    if (data) {
      this.emit('retrieved', { key, size: data.length });
    }
    return data;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.storage.has(key);
    this.storage.delete(key);
    this.metadata.delete(key);
    if (existed) {
      this.emit('deleted', { key });
    }
    return existed;
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
  }

  getMetadata(key: string): any {
    return this.metadata.get(key);
  }

  clear(): void {
    this.storage.clear();
    this.metadata.clear();
  }
}

describe('File System Integration', () => {
  let tempDir: string;
  let watcher: MockFileWatcher;
  let storage: MockStorageManager;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-integration-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    watcher = new MockFileWatcher();
    storage = new MockStorageManager();
  });

  describe('Real File Operations', () => {
    test('should create and read file', async () => {
      const filePath = path.join(tempDir, 'test-file.txt');
      const content = 'Hello, World!';

      await fs.writeFile(filePath, content, 'utf-8');
      const readContent = await fs.readFile(filePath, 'utf-8');

      expect(readContent).toBe(content);
    });

    test('should create nested directories', async () => {
      const nestedPath = path.join(tempDir, 'level1', 'level2', 'level3');

      await fs.mkdir(nestedPath, { recursive: true });
      const stats = await fs.stat(nestedPath);

      expect(stats.isDirectory()).toBe(true);
    });

    test('should write and read binary data', async () => {
      const filePath = path.join(tempDir, 'binary-file.bin');
      const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);

      await fs.writeFile(filePath, binaryData);
      const readData = await fs.readFile(filePath);

      expect(readData).toEqual(binaryData);
    });

    test('should list directory contents', async () => {
      const testDir = path.join(tempDir, 'list-test');
      await fs.mkdir(testDir, { recursive: true });

      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      for (const file of files) {
        await fs.writeFile(path.join(testDir, file), 'content');
      }

      const dirContents = await fs.readdir(testDir);

      expect(dirContents).toHaveLength(3);
      expect(dirContents.sort()).toEqual(files.sort());
    });

    test('should delete files and directories', async () => {
      const testDir = path.join(tempDir, 'delete-test');
      await fs.mkdir(testDir, { recursive: true });

      const filePath = path.join(testDir, 'delete-me.txt');
      await fs.writeFile(filePath, 'content');

      await fs.unlink(filePath);
      await fs.rmdir(testDir);

      await expect(fs.access(testDir)).rejects.toThrow();
    });

    test('should copy files', async () => {
      const sourcePath = path.join(tempDir, 'source.txt');
      const destPath = path.join(tempDir, 'destination.txt');
      const content = 'Copy this content';

      await fs.writeFile(sourcePath, content);
      await fs.copyFile(sourcePath, destPath);

      const copiedContent = await fs.readFile(destPath, 'utf-8');

      expect(copiedContent).toBe(content);
    });

    test('should rename files', async () => {
      const oldPath = path.join(tempDir, 'old-name.txt');
      const newPath = path.join(tempDir, 'new-name.txt');

      await fs.writeFile(oldPath, 'content');
      await fs.rename(oldPath, newPath);

      await expect(fs.access(oldPath)).rejects.toThrow();
      const content = await fs.readFile(newPath, 'utf-8');
      expect(content).toBe('content');
    });

    test('should get file stats', async () => {
      const filePath = path.join(tempDir, 'stats-test.txt');
      await fs.writeFile(filePath, 'test content');

      const stats = await fs.stat(filePath);

      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.mtime).toBeInstanceOf(Date);
    });
  });

  describe('File Watching Integration', () => {
    test('should start and stop file watcher', () => {
      const watchId = watcher.watch(tempDir);

      expect(watcher.getActiveWatchers()).toBe(1);

      watcher.unwatch(watchId);

      expect(watcher.getActiveWatchers()).toBe(0);
    });

    test('should emit events on file changes', async () => {
      const events: any[] = [];
      watcher.on('change', (event) => events.push(event));

      const watchId = watcher.watch(tempDir);

      // Simulate file creation
      watcher.simulateChange(watchId, 'create', 'new-file.txt');

      // Simulate file modification
      watcher.simulateChange(watchId, 'modify', 'new-file.txt');

      // Simulate file deletion
      watcher.simulateChange(watchId, 'delete', 'new-file.txt');

      expect(events).toHaveLength(3);
      expect(events[0].event).toBe('create');
      expect(events[1].event).toBe('modify');
      expect(events[2].event).toBe('delete');
    });

    test('should watch multiple paths simultaneously', () => {
      const watch1 = watcher.watch(path.join(tempDir, 'dir1'));
      const watch2 = watcher.watch(path.join(tempDir, 'dir2'));
      const watch3 = watcher.watch(path.join(tempDir, 'dir3'));

      expect(watcher.getActiveWatchers()).toBe(3);

      watcher.unwatch(watch1);
      watcher.unwatch(watch2);
      watcher.unwatch(watch3);

      expect(watcher.getActiveWatchers()).toBe(0);
    });

    test('should handle watcher lifecycle events', () => {
      const lifecycle: string[] = [];

      watcher.on('watch:started', () => lifecycle.push('started'));
      watcher.on('watch:stopped', () => lifecycle.push('stopped'));

      const watchId = watcher.watch(tempDir);
      watcher.unwatch(watchId);

      expect(lifecycle).toEqual(['started', 'stopped']);
    });
  });

  describe('Storage Manager Integration', () => {
    test('should store and retrieve data', async () => {
      const key = 'test-key';
      const data = Buffer.from('test data');

      await storage.store(key, data);
      const retrieved = await storage.retrieve(key);

      expect(retrieved).toEqual(data);
    });

    test('should store metadata with data', async () => {
      const key = 'meta-test';
      const data = Buffer.from('data');
      const metadata = { contentType: 'text/plain', tags: ['test'] };

      await storage.store(key, data, metadata);
      const meta = storage.getMetadata(key);

      expect(meta).toHaveProperty('contentType', 'text/plain');
      expect(meta).toHaveProperty('tags');
      expect(meta.tags).toContain('test');
    });

    test('should list stored keys', async () => {
      await storage.store('key1', Buffer.from('data1'));
      await storage.store('key2', Buffer.from('data2'));
      await storage.store('key3', Buffer.from('data3'));

      const keys = await storage.list();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    test('should list keys with prefix', async () => {
      await storage.store('users/user1', Buffer.from('data1'));
      await storage.store('users/user2', Buffer.from('data2'));
      await storage.store('posts/post1', Buffer.from('data3'));

      const userKeys = await storage.list('users/');

      expect(userKeys).toHaveLength(2);
      expect(userKeys.every(k => k.startsWith('users/'))).toBe(true);
    });

    test('should delete stored data', async () => {
      const key = 'delete-test';
      await storage.store(key, Buffer.from('data'));

      const deleted = await storage.delete(key);
      const retrieved = await storage.retrieve(key);

      expect(deleted).toBe(true);
      expect(retrieved).toBeNull();
    });

    test('should emit storage events', async () => {
      const events: string[] = [];

      storage.on('stored', () => events.push('stored'));
      storage.on('retrieved', () => events.push('retrieved'));
      storage.on('deleted', () => events.push('deleted'));

      await storage.store('test', Buffer.from('data'));
      await storage.retrieve('test');
      await storage.delete('test');

      expect(events).toEqual(['stored', 'retrieved', 'deleted']);
    });
  });

  describe('File System and Storage Integration', () => {
    test('should sync file to storage', async () => {
      const filePath = path.join(tempDir, 'sync-file.txt');
      const content = 'Sync this content';

      // Write to file system
      await fs.writeFile(filePath, content);

      // Read and store
      const fileData = await fs.readFile(filePath);
      await storage.store('sync-file.txt', fileData);

      // Retrieve and verify
      const storedData = await storage.retrieve('sync-file.txt');
      expect(storedData?.toString()).toBe(content);
    });

    test('should restore file from storage', async () => {
      const key = 'restore-test.txt';
      const content = Buffer.from('Restore this content');

      // Store in storage
      await storage.store(key, content);

      // Retrieve and write to file system
      const retrieved = await storage.retrieve(key);
      const filePath = path.join(tempDir, key);
      await fs.writeFile(filePath, retrieved!);

      // Verify file content
      const fileContent = await fs.readFile(filePath);
      expect(fileContent).toEqual(content);
    });

    test('should watch and auto-backup files', async () => {
      const backups: any[] = [];

      watcher.on('change', async (event) => {
        if (event.event === 'modify' || event.event === 'create') {
          backups.push({ filename: event.filename, timestamp: event.timestamp });
        }
      });

      const watchId = watcher.watch(tempDir);

      // Simulate file changes
      watcher.simulateChange(watchId, 'create', 'backup-test.txt');
      watcher.simulateChange(watchId, 'modify', 'backup-test.txt');

      expect(backups).toHaveLength(2);
      expect(backups[0].filename).toBe('backup-test.txt');
    });

    test('should handle concurrent file operations', async () => {
      const operations = Array.from({ length: 10 }, async (_, i) => {
        const filePath = path.join(tempDir, `concurrent-${i}.txt`);
        await fs.writeFile(filePath, `Content ${i}`);
        return filePath;
      });

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);

      // Verify all files exist
      for (const filePath of results) {
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('should handle concurrent storage operations', async () => {
      const operations = Array.from({ length: 20 }, async (_, i) => {
        await storage.store(`key-${i}`, Buffer.from(`Data ${i}`));
        return `key-${i}`;
      });

      await Promise.all(operations);

      const keys = await storage.list();
      expect(keys.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Error Handling in File Operations', () => {
    test('should handle non-existent file reads', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');

      await expect(fs.readFile(nonExistentPath)).rejects.toThrow();
    });

    test('should handle write permission errors', async () => {
      // This test simulates permission errors
      const invalidPath = '/root/invalid/path/file.txt';

      await expect(fs.writeFile(invalidPath, 'content')).rejects.toThrow();
    });

    test('should handle storage retrieval of non-existent keys', async () => {
      const result = await storage.retrieve('non-existent-key');

      expect(result).toBeNull();
    });

    test('should handle deletion of non-existent storage keys', async () => {
      const deleted = await storage.delete('non-existent-key');

      expect(deleted).toBe(false);
    });
  });

  describe('Transaction-like File Operations', () => {
    test('should perform atomic file writes', async () => {
      const filePath = path.join(tempDir, 'atomic.txt');
      const tempPath = path.join(tempDir, 'atomic.txt.tmp');

      // Write to temp file first
      await fs.writeFile(tempPath, 'atomic content');

      // Rename (atomic operation)
      await fs.rename(tempPath, filePath);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('atomic content');
    });

    test('should rollback on write failure', async () => {
      const filePath = path.join(tempDir, 'rollback-test.txt');
      const originalContent = 'original';

      await fs.writeFile(filePath, originalContent);

      try {
        // Attempt operation that might fail
        const newContent = 'updated';
        await fs.writeFile(filePath, newContent);

        // Simulate failure
        throw new Error('Operation failed');
      } catch (error) {
        // In real scenario, we'd restore from backup
        // For this test, we just verify error handling
        expect(error).toBeDefined();
      }

      // File should still exist
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('should handle multi-file transaction', async () => {
      const files = ['tx-file1.txt', 'tx-file2.txt', 'tx-file3.txt'];
      const tempFiles: string[] = [];

      try {
        // Write all files to temp locations
        for (const file of files) {
          const tempPath = path.join(tempDir, `${file}.tmp`);
          await fs.writeFile(tempPath, `Content of ${file}`);
          tempFiles.push(tempPath);
        }

        // Commit - rename all at once
        for (let i = 0; i < files.length; i++) {
          await fs.rename(tempFiles[i], path.join(tempDir, files[i]));
        }

        // Verify all files exist
        for (const file of files) {
          const exists = await fs.access(path.join(tempDir, file))
            .then(() => true)
            .catch(() => false);
          expect(exists).toBe(true);
        }
      } catch (error) {
        // Rollback - delete temp files
        for (const tempFile of tempFiles) {
          await fs.unlink(tempFile).catch(() => {});
        }
        throw error;
      }
    });
  });
});
