import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rmdir);
const mkdirAsync = promisify(fs.mkdir);

/**
 * Buffer pool for efficient memory management
 */
class BufferPool {
  private availableBuffers: Buffer[] = [];
  private inUseBuffers: WeakSet<Buffer> = new WeakSet();
  private readonly bufferSize: number;
  private readonly maxPoolSize: number;
  private allocatedCount: number = 0;
  private registry: FinalizationRegistry<void>;

  constructor(bufferSize: number = 64 * 1024, maxPoolSize: number = 10) {
    this.bufferSize = bufferSize;
    this.maxPoolSize = maxPoolSize;

    this.registry = new FinalizationRegistry(() => {
      this.allocatedCount = Math.max(0, this.allocatedCount - 1);
    });
  }

  /**
   * Acquire a buffer from the pool
   */
  public acquire(): Buffer {
    let buffer = this.availableBuffers.pop();

    if (!buffer) {
      buffer = Buffer.allocUnsafe(this.bufferSize);
      this.allocatedCount++;
      this.registry.register(buffer, undefined, buffer);
    }

    this.inUseBuffers.add(buffer);
    return buffer;
  }

  /**
   * Release a buffer back to the pool
   */
  public release(buffer: Buffer): void {
    if (this.availableBuffers.length < this.maxPoolSize) {
      // Clear buffer for security
      buffer.fill(0);
      this.availableBuffers.push(buffer);
    } else {
      // Let buffer be garbage collected
      this.registry.unregister(buffer);
      this.allocatedCount = Math.max(0, this.allocatedCount - 1);
    }
  }

  /**
   * Clear all buffers from pool
   */
  public clear(): void {
    for (const buffer of this.availableBuffers) {
      buffer.fill(0);
      this.registry.unregister(buffer);
    }
    this.availableBuffers = [];
    this.allocatedCount = 0;

    // Hint GC
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get pool statistics
   */
  public getStats(): { available: number; allocated: number; maxSize: number } {
    return {
      available: this.availableBuffers.length,
      allocated: this.allocatedCount,
      maxSize: this.maxPoolSize,
    };
  }
}

/**
 * Directory lock manager
 */
class DirectoryLockManager {
  private locks: Map<string, { holder: string; timestamp: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly lockTimeout: number = 30000; // 30 seconds

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Acquire a lock on a directory
   */
  public async acquireLock(dirPath: string, holder: string): Promise<boolean> {
    const absolutePath = path.resolve(dirPath);
    const existing = this.locks.get(absolutePath);

    // Check if lock exists and is still valid
    if (existing) {
      const age = Date.now() - existing.timestamp;
      if (age < this.lockTimeout) {
        return false; // Lock is held by someone else
      }
      // Lock expired, can be acquired
    }

    this.locks.set(absolutePath, {
      holder,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Release a lock on a directory
   */
  public releaseLock(dirPath: string, holder: string): boolean {
    const absolutePath = path.resolve(dirPath);
    const existing = this.locks.get(absolutePath);

    if (existing && existing.holder === holder) {
      this.locks.delete(absolutePath);
      return true;
    }

    return false;
  }

  /**
   * Check if directory is locked
   */
  public isLocked(dirPath: string): boolean {
    const absolutePath = path.resolve(dirPath);
    const existing = this.locks.get(absolutePath);

    if (!existing) {
      return false;
    }

    const age = Date.now() - existing.timestamp;
    if (age >= this.lockTimeout) {
      this.locks.delete(absolutePath);
      return false;
    }

    return true;
  }

  /**
   * Cleanup expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [dirPath, lock] of this.locks.entries()) {
      if (now - lock.timestamp >= this.lockTimeout) {
        this.locks.delete(dirPath);
      }
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
    }, 10000); // Check every 10 seconds

    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Shutdown and cleanup all locks
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.locks.clear();
  }
}

/**
 * Temporary file manager with automatic cleanup
 */
class TempFileManager {
  private tempFiles: Set<string> = new Set();
  private tempDirs: Set<string> = new Set();
  private cleanupHandlersRegistered: boolean = false;

  constructor() {
    this.registerCleanupHandlers();
  }

  /**
   * Create a temporary file
   */
  public async createTempFile(prefix: string = 'tmp', suffix: string = ''): Promise<string> {
    const tmpDir = os.tmpdir();
    const randomName = `${prefix}-${crypto.randomBytes(8).toString('hex')}${suffix}`;
    const tempPath = path.join(tmpDir, randomName);

    try {
      // Create empty file
      await fs.promises.writeFile(tempPath, '', { mode: 0o600 });
      this.tempFiles.add(tempPath);
      return tempPath;
    } catch (error) {
      throw new Error(`Failed to create temp file: ${error}`);
    }
  }

  /**
   * Create a temporary directory
   */
  public async createTempDir(prefix: string = 'tmpdir'): Promise<string> {
    const tmpDir = os.tmpdir();
    const randomName = `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
    const tempPath = path.join(tmpDir, randomName);

    try {
      await mkdirAsync(tempPath, { recursive: true, mode: 0o700 });
      this.tempDirs.add(tempPath);
      return tempPath;
    } catch (error) {
      throw new Error(`Failed to create temp directory: ${error}`);
    }
  }

  /**
   * Manually clean up a specific temp file
   */
  public async cleanupFile(filePath: string): Promise<void> {
    if (!this.tempFiles.has(filePath)) {
      return;
    }

    try {
      await unlinkAsync(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Failed to cleanup temp file ${filePath}:`, error);
      }
    } finally {
      this.tempFiles.delete(filePath);
    }
  }

  /**
   * Manually clean up a specific temp directory
   */
  public async cleanupDir(dirPath: string): Promise<void> {
    if (!this.tempDirs.has(dirPath)) {
      return;
    }

    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Failed to cleanup temp dir ${dirPath}:`, error);
      }
    } finally {
      this.tempDirs.delete(dirPath);
    }
  }

  /**
   * Clean up all temporary files and directories
   */
  public async cleanupAll(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    // Cleanup files
    for (const filePath of this.tempFiles) {
      cleanupPromises.push(
        unlinkAsync(filePath).catch((error: any) => {
          if (error.code !== 'ENOENT') {
            console.error(`Failed to cleanup ${filePath}:`, error);
          }
        })
      );
    }

    // Cleanup directories
    for (const dirPath of this.tempDirs) {
      cleanupPromises.push(
        fs.promises.rm(dirPath, { recursive: true, force: true }).catch((error: any) => {
          if (error.code !== 'ENOENT') {
            console.error(`Failed to cleanup ${dirPath}:`, error);
          }
        })
      );
    }

    await Promise.allSettled(cleanupPromises);

    this.tempFiles.clear();
    this.tempDirs.clear();

    // Hint GC
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Register cleanup handlers for process exit
   */
  private registerCleanupHandlers(): void {
    if (this.cleanupHandlersRegistered) {
      return;
    }

    const cleanupHandler = async () => {
      await this.cleanupAll();
    };

    process.once('exit', () => {
      // Synchronous cleanup on exit
      for (const filePath of this.tempFiles) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          // Ignore errors on exit
        }
      }
    });

    process.once('SIGINT', async () => {
      await cleanupHandler();
      process.exit(0);
    });

    process.once('SIGTERM', async () => {
      await cleanupHandler();
      process.exit(0);
    });

    this.cleanupHandlersRegistered = true;
  }

  /**
   * Get current temp file count
   */
  public getTempFileCount(): number {
    return this.tempFiles.size;
  }

  /**
   * Get current temp directory count
   */
  public getTempDirCount(): number {
    return this.tempDirs.size;
  }
}

/**
 * File tools with comprehensive resource management
 */
export class FileTools {
  private static bufferPool: BufferPool = new BufferPool();
  private static lockManager: DirectoryLockManager = new DirectoryLockManager();
  private static tempManager: TempFileManager = new TempFileManager();
  private static activeStreams: Set<Readable | Writable> = new Set();

  /**
   * Read file with proper handle cleanup
   */
  public static async readFile(filePath: string): Promise<Buffer> {
    let fileHandle: fs.promises.FileHandle | null = null;

    try {
      fileHandle = await fs.promises.open(filePath, 'r');
      const stats = await fileHandle.stat();
      const buffer = Buffer.allocUnsafe(stats.size);
      await fileHandle.read(buffer, 0, stats.size, 0);
      return buffer;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    } finally {
      // Always cleanup file handle
      if (fileHandle) {
        try {
          await fileHandle.close();
        } catch (closeError) {
          console.error(`Error closing file handle for ${filePath}:`, closeError);
        }
      }
    }
  }

  /**
   * Write file with proper handle cleanup
   */
  public static async writeFile(filePath: string, data: Buffer | string): Promise<void> {
    let fileHandle: fs.promises.FileHandle | null = null;

    try {
      fileHandle = await fs.promises.open(filePath, 'w');
      await fileHandle.writeFile(data);
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error}`);
    } finally {
      if (fileHandle) {
        try {
          await fileHandle.close();
        } catch (closeError) {
          console.error(`Error closing file handle for ${filePath}:`, closeError);
        }
      }
    }
  }

  /**
   * Copy file with stream cleanup on error
   */
  public static async copyFile(sourcePath: string, destPath: string): Promise<void> {
    let readStream: fs.ReadStream | null = null;
    let writeStream: fs.WriteStream | null = null;

    try {
      readStream = fs.createReadStream(sourcePath);
      writeStream = fs.createWriteStream(destPath);

      this.activeStreams.add(readStream);
      this.activeStreams.add(writeStream);

      // Setup error handlers
      const errorHandler = (error: Error) => {
        throw error;
      };

      readStream.on('error', errorHandler);
      writeStream.on('error', errorHandler);

      // Use pipeline for automatic cleanup
      await pipeline(readStream, writeStream);

    } catch (error) {
      // Cleanup on error
      if (readStream && !readStream.destroyed) {
        readStream.destroy();
      }
      if (writeStream && !writeStream.destroyed) {
        writeStream.destroy();
      }

      // Remove incomplete destination file
      try {
        await unlinkAsync(destPath);
      } catch (unlinkError) {
        // Ignore if file doesn't exist
      }

      throw new Error(`Failed to copy file from ${sourcePath} to ${destPath}: ${error}`);
    } finally {
      // Ensure streams are removed from tracking
      if (readStream) {
        this.activeStreams.delete(readStream);
      }
      if (writeStream) {
        this.activeStreams.delete(writeStream);
      }

      // Hint GC for large operations
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Read file in chunks using buffer pool
   */
  public static async readFileChunked(
    filePath: string,
    chunkCallback: (chunk: Buffer, offset: number) => Promise<void>
  ): Promise<void> {
    let fileHandle: fs.promises.FileHandle | null = null;
    const buffer = this.bufferPool.acquire();

    try {
      fileHandle = await fs.promises.open(filePath, 'r');
      let offset = 0;
      let bytesRead = 0;

      do {
        const result = await fileHandle.read(buffer, 0, buffer.length, offset);
        bytesRead = result.bytesRead;

        if (bytesRead > 0) {
          const chunk = buffer.slice(0, bytesRead);
          await chunkCallback(chunk, offset);
          offset += bytesRead;
        }
      } while (bytesRead > 0);

    } catch (error) {
      throw new Error(`Failed to read file in chunks ${filePath}: ${error}`);
    } finally {
      if (fileHandle) {
        try {
          await fileHandle.close();
        } catch (closeError) {
          console.error(`Error closing file handle for ${filePath}:`, closeError);
        }
      }

      // Return buffer to pool
      this.bufferPool.release(buffer);
    }
  }

  /**
   * Create a read stream with proper cleanup tracking
   */
  public static createReadStream(filePath: string, options?: any): fs.ReadStream {
    const stream = fs.createReadStream(filePath, options);
    this.activeStreams.add(stream);

    stream.once('close', () => {
      this.activeStreams.delete(stream);
    });

    stream.once('error', (error) => {
      console.error(`Read stream error for ${filePath}:`, error);
      this.activeStreams.delete(stream);
      if (!stream.destroyed) {
        stream.destroy();
      }
    });

    return stream;
  }

  /**
   * Create a write stream with proper cleanup tracking
   */
  public static createWriteStream(filePath: string, options?: any): fs.WriteStream {
    const stream = fs.createWriteStream(filePath, options);
    this.activeStreams.add(stream);

    stream.once('close', () => {
      this.activeStreams.delete(stream);
    });

    stream.once('error', (error) => {
      console.error(`Write stream error for ${filePath}:`, error);
      this.activeStreams.delete(stream);
      if (!stream.destroyed) {
        stream.destroy();
      }
    });

    return stream;
  }

  /**
   * Cleanup all active streams
   */
  public static cleanupAllStreams(): void {
    for (const stream of this.activeStreams) {
      try {
        if (!stream.destroyed) {
          stream.destroy();
        }
      } catch (error) {
        console.error('Error destroying stream:', error);
      }
    }
    this.activeStreams.clear();
  }

  /**
   * Acquire directory lock
   */
  public static async acquireDirectoryLock(dirPath: string, holder: string): Promise<boolean> {
    return this.lockManager.acquireLock(dirPath, holder);
  }

  /**
   * Release directory lock
   */
  public static releaseDirectoryLock(dirPath: string, holder: string): boolean {
    return this.lockManager.releaseLock(dirPath, holder);
  }

  /**
   * Execute operation with directory lock
   */
  public static async withDirectoryLock<T>(
    dirPath: string,
    holder: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const acquired = await this.acquireDirectoryLock(dirPath, holder);

    if (!acquired) {
      throw new Error(`Failed to acquire lock on directory: ${dirPath}`);
    }

    try {
      return await operation();
    } finally {
      this.releaseDirectoryLock(dirPath, holder);
    }
  }

  /**
   * Create temporary file
   */
  public static async createTempFile(prefix?: string, suffix?: string): Promise<string> {
    return this.tempManager.createTempFile(prefix, suffix);
  }

  /**
   * Create temporary directory
   */
  public static async createTempDir(prefix?: string): Promise<string> {
    return this.tempManager.createTempDir(prefix);
  }

  /**
   * Cleanup specific temp file
   */
  public static async cleanupTempFile(filePath: string): Promise<void> {
    return this.tempManager.cleanupFile(filePath);
  }

  /**
   * Cleanup specific temp directory
   */
  public static async cleanupTempDir(dirPath: string): Promise<void> {
    return this.tempManager.cleanupDir(dirPath);
  }

  /**
   * Get buffer pool statistics
   */
  public static getBufferPoolStats() {
    return this.bufferPool.getStats();
  }

  /**
   * Get temp file statistics
   */
  public static getTempFileStats() {
    return {
      files: this.tempManager.getTempFileCount(),
      directories: this.tempManager.getTempDirCount(),
    };
  }

  /**
   * Complete shutdown and cleanup of all resources
   */
  public static async shutdown(): Promise<void> {
    // Cleanup all active streams
    this.cleanupAllStreams();

    // Cleanup temp files
    await this.tempManager.cleanupAll();

    // Cleanup directory locks
    this.lockManager.shutdown();

    // Clear buffer pool
    this.bufferPool.clear();

    // Force GC hint
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Setup global cleanup handlers
 */
function setupGlobalCleanupHandlers() {
  const shutdownHandler = async () => {
    await FileTools.shutdown();
  };

  process.once('SIGINT', async () => {
    await shutdownHandler();
    process.exit(0);
  });

  process.once('SIGTERM', async () => {
    await shutdownHandler();
    process.exit(0);
  });

  process.once('beforeExit', async () => {
    await shutdownHandler();
  });
}

// Auto-register cleanup handlers
setupGlobalCleanupHandlers();

export { BufferPool, DirectoryLockManager, TempFileManager };
