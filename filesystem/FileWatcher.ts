import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * File watcher with comprehensive resource cleanup
 */
export class FileWatcher extends EventEmitter {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private watchedPaths: Set<string> = new Set();
  private isShuttingDown: boolean = false;
  private cleanupCallbacks: Array<() => void | Promise<void>> = [];
  private resourceRegistry: FinalizationRegistry<string>;
  private activeHandles: WeakMap<fs.FSWatcher, WeakRef<fs.FSWatcher>> = new WeakMap();

  constructor() {
    super();
    this.setupCleanupHandlers();
    this.resourceRegistry = new FinalizationRegistry((watchPath: string) => {
      // GC hint: watcher was collected, ensure cleanup
      console.log(`[GC] Watcher for ${watchPath} was garbage collected`);
      this.cleanupPath(watchPath);
    });
  }

  /**
   * Watch a file or directory
   */
  public watch(
    targetPath: string,
    options: fs.WatchOptions = { persistent: true, recursive: false }
  ): void {
    if (this.isShuttingDown) {
      throw new Error('FileWatcher is shutting down, cannot add new watchers');
    }

    const absolutePath = path.resolve(targetPath);

    // Clean up existing watcher if present
    if (this.watchers.has(absolutePath)) {
      this.unwatch(absolutePath);
    }

    try {
      const watcher = fs.watch(absolutePath, options, (eventType, filename) => {
        this.handleWatchEvent(absolutePath, eventType, filename);
      });

      // Setup error handler for the watcher
      watcher.on('error', (error) => {
        this.handleWatcherError(absolutePath, error);
      });

      // Track watcher for cleanup
      this.watchers.set(absolutePath, watcher);
      this.watchedPaths.add(absolutePath);

      // Register for GC tracking
      const weakRef = new WeakRef(watcher);
      this.activeHandles.set(watcher, weakRef);
      this.resourceRegistry.register(watcher, absolutePath, watcher);

      this.emit('watcherAdded', absolutePath);
    } catch (error) {
      this.emit('error', { path: absolutePath, error });
      throw error;
    }
  }

  /**
   * Stop watching a specific path
   */
  public unwatch(targetPath: string): void {
    const absolutePath = path.resolve(targetPath);
    this.cleanupPath(absolutePath);
  }

  /**
   * Get all watched paths
   */
  public getWatchedPaths(): string[] {
    return Array.from(this.watchedPaths);
  }

  /**
   * Check if a path is being watched
   */
  public isWatching(targetPath: string): boolean {
    const absolutePath = path.resolve(targetPath);
    return this.watchers.has(absolutePath);
  }

  /**
   * Add a cleanup callback to be executed on shutdown
   */
  public addCleanupCallback(callback: () => void | Promise<void>): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Shutdown and cleanup all watchers
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.emit('shuttingDown');

    try {
      // Close all watchers
      const closePromises: Promise<void>[] = [];

      for (const [watchPath, watcher] of this.watchers.entries()) {
        closePromises.push(
          new Promise<void>((resolve) => {
            try {
              watcher.close();
              this.resourceRegistry.unregister(watcher);
              resolve();
            } catch (error) {
              console.error(`Error closing watcher for ${watchPath}:`, error);
              resolve(); // Continue cleanup even on error
            }
          })
        );
      }

      await Promise.all(closePromises);

      // Clear tracking structures
      this.watchers.clear();
      this.watchedPaths.clear();

      // Execute cleanup callbacks
      for (const callback of this.cleanupCallbacks) {
        try {
          await Promise.resolve(callback());
        } catch (error) {
          console.error('Error executing cleanup callback:', error);
        }
      }

      this.cleanupCallbacks = [];

      // Remove all event listeners
      this.removeAllListeners();

      // Hint to GC that resources can be collected
      if (global.gc) {
        global.gc();
      }

      this.emit('shutdown');
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Cleanup a specific path's watcher
   */
  private cleanupPath(absolutePath: string): void {
    const watcher = this.watchers.get(absolutePath);

    if (watcher) {
      try {
        watcher.close();
        this.resourceRegistry.unregister(watcher);
      } catch (error) {
        console.error(`Error closing watcher for ${absolutePath}:`, error);
      } finally {
        this.watchers.delete(absolutePath);
        this.watchedPaths.delete(absolutePath);
        this.emit('watcherRemoved', absolutePath);
      }
    }
  }

  /**
   * Handle watch events
   */
  private handleWatchEvent(
    watchPath: string,
    eventType: string,
    filename: string | null
  ): void {
    if (this.isShuttingDown) {
      return;
    }

    this.emit('change', {
      path: watchPath,
      eventType,
      filename,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle watcher errors
   */
  private handleWatcherError(watchPath: string, error: Error): void {
    this.emit('error', { path: watchPath, error });

    // Cleanup the errored watcher
    this.cleanupPath(watchPath);
  }

  /**
   * Setup process cleanup handlers
   */
  private setupCleanupHandlers(): void {
    const shutdownHandler = async () => {
      await this.shutdown();
      process.exit(0);
    };

    process.once('SIGINT', shutdownHandler);
    process.once('SIGTERM', shutdownHandler);
    process.once('beforeExit', async () => {
      await this.shutdown();
    });

    // Cleanup on uncaught exceptions
    process.once('uncaughtException', async (error) => {
      console.error('Uncaught exception, cleaning up watchers:', error);
      await this.shutdown();
      process.exit(1);
    });
  }
}

/**
 * Singleton instance for global file watching
 */
let globalWatcher: FileWatcher | null = null;

export function getGlobalWatcher(): FileWatcher {
  if (!globalWatcher) {
    globalWatcher = new FileWatcher();
  }
  return globalWatcher;
}

export async function shutdownGlobalWatcher(): Promise<void> {
  if (globalWatcher) {
    await globalWatcher.shutdown();
    globalWatcher = null;
  }
}
