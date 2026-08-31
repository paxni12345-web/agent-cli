/**
 * File Watcher System
 * Real-time file system monitoring with pattern matching and change detection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { eventBus } from '../core/EventBus';

export interface WatchConfig {
  path: string;
  recursive?: boolean;
  patterns?: string[];
  ignore?: string[];
  debounce?: number;
  events?: FileSystemEvent[];
}

export type FileSystemEvent = 'create' | 'modify' | 'delete' | 'rename';

export interface FileChange {
  event: FileSystemEvent;
  path: string;
  timestamp: Date;
  stats?: FileStats;
  oldPath?: string; // For rename events
}

export interface FileStats {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modified: Date;
  created: Date;
}

export interface WatcherHandle {
  id: string;
  stop: () => void;
}

/**
 * File Watcher
 */
export class FileWatcher {
  private watchers: Map<string, WatcherInstance> = new Map();
  private watcherId = 0;

  /**
   * Watch directory or file
   */
  watch(config: WatchConfig, callback: (change: FileChange) => void): WatcherHandle {
    const id = `watcher_${++this.watcherId}`;

    const watcher = new WatcherInstance(id, config, callback);
    this.watchers.set(id, watcher);

    watcher.start();

    eventBus.emitSync('filewatcher.started', { id, config }, 'FileWatcher');

    return {
      id,
      stop: () => this.stopWatcher(id),
    };
  }

  /**
   * Stop watcher
   */
  stopWatcher(id: string): void {
    const watcher = this.watchers.get(id);
    if (watcher) {
      watcher.stop();
      this.watchers.delete(id);
      eventBus.emitSync('filewatcher.stopped', { id }, 'FileWatcher');
    }
  }

  /**
   * Stop all watchers
   */
  stopAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.stop();
    }
    this.watchers.clear();
  }

  /**
   * Get active watchers
   */
  getActiveWatchers(): Array<{ id: string; config: WatchConfig }> {
    return Array.from(this.watchers.values()).map(w => ({
      id: w.id,
      config: w.config,
    }));
  }
}

/**
 * Watcher Instance
 */
class WatcherInstance {
  private files: Map<string, FileStats> = new Map();
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    public id: string,
    public config: WatchConfig,
    private callback: (change: FileChange) => void
  ) {}

  /**
   * Start watching
   */
  async start(): Promise<void> {
    // Initial scan
    await this.scan();

    // Poll for changes
    this.poll();
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  /**
   * Scan directory
   */
  private async scan(): Promise<void> {
    try {
      const stats = await fs.stat(this.config.path);

      if (stats.isFile()) {
        await this.scanFile(this.config.path);
      } else if (stats.isDirectory()) {
        await this.scanDirectory(this.config.path);
      }
    } catch (error) {
      console.error(`Failed to scan ${this.config.path}:`, error);
    }
  }

  /**
   * Scan directory recursively
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Check ignore patterns
        if (this.shouldIgnore(fullPath)) {
          continue;
        }

        if (entry.isDirectory() && this.config.recursive) {
          await this.scanDirectory(fullPath);
        } else if (entry.isFile()) {
          await this.scanFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  /**
   * Scan single file
   */
  private async scanFile(filePath: string): Promise<void> {
    // Check patterns
    if (!this.matchesPattern(filePath)) {
      return;
    }

    try {
      const stats = await fs.stat(filePath);
      const fileStats = this.toFileStats(stats);

      const existing = this.files.get(filePath);

      if (!existing) {
        // New file
        this.files.set(filePath, fileStats);
        this.emitChange({
          event: 'create',
          path: filePath,
          timestamp: new Date(),
          stats: fileStats,
        });
      } else if (stats.mtimeMs !== existing.modified.getTime()) {
        // Modified file
        this.files.set(filePath, fileStats);
        this.emitChange({
          event: 'modify',
          path: filePath,
          timestamp: new Date(),
          stats: fileStats,
        });
      }
    } catch (error) {
      // File might have been deleted
      if (this.files.has(filePath)) {
        this.files.delete(filePath);
        this.emitChange({
          event: 'delete',
          path: filePath,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Poll for changes
   */
  private poll(): void {
    if (this.stopped) return;

    const debounce = this.config.debounce || 1000;

    this.timer = setTimeout(async () => {
      await this.detectChanges();
      this.poll();
    }, debounce);
  }

  /**
   * Detect changes
   */
  private async detectChanges(): Promise<void> {
    // Check for deleted files
    const currentFiles = new Set<string>();

    try {
      await this.collectCurrentFiles(this.config.path, currentFiles);

      // Find deleted files
      for (const [filePath, stats] of this.files) {
        if (!currentFiles.has(filePath)) {
          this.files.delete(filePath);
          this.emitChange({
            event: 'delete',
            path: filePath,
            timestamp: new Date(),
          });
        }
      }

      // Scan for new/modified files
      await this.scan();
    } catch (error) {
      console.error('Error detecting changes:', error);
    }
  }

  /**
   * Collect all current files
   */
  private async collectCurrentFiles(dirPath: string, files: Set<string>): Promise<void> {
    try {
      const stats = await fs.stat(dirPath);

      if (stats.isFile()) {
        if (this.matchesPattern(dirPath) && !this.shouldIgnore(dirPath)) {
          files.add(dirPath);
        }
        return;
      }

      if (!stats.isDirectory()) return;

      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (this.shouldIgnore(fullPath)) {
          continue;
        }

        if (entry.isDirectory() && this.config.recursive) {
          await this.collectCurrentFiles(fullPath, files);
        } else if (entry.isFile() && this.matchesPattern(fullPath)) {
          files.add(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors (file might have been deleted)
    }
  }

  /**
   * Emit file change
   */
  private emitChange(change: FileChange): void {
    // Filter by event types
    if (this.config.events && !this.config.events.includes(change.event)) {
      return;
    }

    this.callback(change);
    eventBus.emitSync('filewatcher.change', change, 'FileWatcher');
  }

  /**
   * Check if path matches patterns
   */
  private matchesPattern(filePath: string): boolean {
    if (!this.config.patterns || this.config.patterns.length === 0) {
      return true;
    }

    return this.config.patterns.some(pattern => {
      return this.matchGlob(filePath, pattern);
    });
  }

  /**
   * Check if path should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    if (!this.config.ignore) return false;

    return this.config.ignore.some(pattern => {
      return filePath.includes(pattern) || this.matchGlob(filePath, pattern);
    });
  }

  /**
   * Simple glob matching
   */
  private matchGlob(str: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`).test(str);
  }

  /**
   * Convert fs.Stats to FileStats
   */
  private toFileStats(stats: any): FileStats {
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      modified: new Date(stats.mtimeMs),
      created: new Date(stats.birthtimeMs),
    };
  }
}

/**
 * Change Aggregator - groups rapid changes
 */
export class ChangeAggregator {
  private pending: Map<string, FileChange[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Add change to aggregation
   */
  add(
    key: string,
    change: FileChange,
    callback: (changes: FileChange[]) => void,
    delay = 500
  ): void {
    // Add to pending
    if (!this.pending.has(key)) {
      this.pending.set(key, []);
    }
    this.pending.get(key)!.push(change);

    // Clear existing timer
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timer
    const timer = setTimeout(() => {
      const changes = this.pending.get(key);
      if (changes) {
        callback(changes);
        this.pending.delete(key);
        this.timers.delete(key);
      }
    }, delay);

    this.timers.set(key, timer);
  }

  /**
   * Flush all pending changes
   */
  flush(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pending.clear();
  }
}

/**
 * File Pattern Matcher
 */
export class FilePatternMatcher {
  /**
   * Match file against patterns
   */
  static match(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => this.matchPattern(filePath, pattern));
  }

  /**
   * Match single pattern
   */
  static matchPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '§§§') // Placeholder for **
      .replace(/\*/g, '[^/]*')
      .replace(/§§§/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`).test(filePath);
  }

  /**
   * Get common patterns
   */
  static commonPatterns(): Record<string, string[]> {
    return {
      typescript: ['**/*.ts', '**/*.tsx'],
      javascript: ['**/*.js', '**/*.jsx'],
      python: ['**/*.py'],
      go: ['**/*.go'],
      rust: ['**/*.rs'],
      java: ['**/*.java'],
      csharp: ['**/*.cs'],
      web: ['**/*.html', '**/*.css', '**/*.js'],
      config: ['**/*.json', '**/*.yaml', '**/*.yml', '**/*.toml'],
      docs: ['**/*.md', '**/*.txt', '**/*.pdf'],
    };
  }
}

/**
 * File Watcher Presets
 */
export class FileWatcherPresets {
  /**
   * Watch TypeScript files
   */
  static typescript(root: string, callback: (change: FileChange) => void): WatcherHandle {
    return fileWatcher.watch({
      path: root,
      recursive: true,
      patterns: ['**/*.ts', '**/*.tsx'],
      ignore: ['node_modules', 'dist', 'build'],
    }, callback);
  }

  /**
   * Watch JavaScript files
   */
  static javascript(root: string, callback: (change: FileChange) => void): WatcherHandle {
    return fileWatcher.watch({
      path: root,
      recursive: true,
      patterns: ['**/*.js', '**/*.jsx'],
      ignore: ['node_modules', 'dist', 'build'],
    }, callback);
  }

  /**
   * Watch Python files
   */
  static python(root: string, callback: (change: FileChange) => void): WatcherHandle {
    return fileWatcher.watch({
      path: root,
      recursive: true,
      patterns: ['**/*.py'],
      ignore: ['__pycache__', 'venv', '.venv', 'dist', 'build'],
    }, callback);
  }

  /**
   * Watch configuration files
   */
  static config(root: string, callback: (change: FileChange) => void): WatcherHandle {
    return fileWatcher.watch({
      path: root,
      recursive: true,
      patterns: ['**/*.json', '**/*.yaml', '**/*.yml', '**/*.toml', '**/*.env'],
      ignore: ['node_modules'],
    }, callback);
  }

  /**
   * Watch source files (multi-language)
   */
  static source(root: string, callback: (change: FileChange) => void): WatcherHandle {
    return fileWatcher.watch({
      path: root,
      recursive: true,
      patterns: [
        '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
        '**/*.py', '**/*.go', '**/*.rs', '**/*.java',
        '**/*.c', '**/*.cpp', '**/*.h', '**/*.hpp',
      ],
      ignore: ['node_modules', '__pycache__', 'dist', 'build', 'target'],
    }, callback);
  }
}

/**
 * Change History Tracker
 */
export class ChangeHistoryTracker {
  private history: FileChange[] = [];
  private maxHistory = 1000;

  /**
   * Record change
   */
  record(change: FileChange): void {
    this.history.push(change);

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    eventBus.emitSync('filehistory.recorded', change, 'ChangeHistoryTracker');
  }

  /**
   * Get history
   */
  getHistory(filter?: {
    path?: string;
    event?: FileSystemEvent;
    since?: Date;
    limit?: number;
  }): FileChange[] {
    let history = [...this.history];

    if (filter?.path) {
      history = history.filter(c => c.path.includes(filter.path!));
    }

    if (filter?.event) {
      history = history.filter(c => c.event === filter.event);
    }

    if (filter?.since) {
      history = history.filter(c => c.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Get recent changes
   */
  getRecent(limit = 20): FileChange[] {
    return this.history.slice(-limit);
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byEvent: Record<FileSystemEvent, number>;
    byPath: Map<string, number>;
  } {
    const byEvent: Record<FileSystemEvent, number> = {
      create: 0,
      modify: 0,
      delete: 0,
      rename: 0,
    };

    const byPath = new Map<string, number>();

    for (const change of this.history) {
      byEvent[change.event]++;

      const count = byPath.get(change.path) || 0;
      byPath.set(change.path, count + 1);
    }

    return {
      total: this.history.length,
      byEvent,
      byPath,
    };
  }
}

/**
 * Singleton instances
 */
export const fileWatcher = new FileWatcher();
export const changeAggregator = new ChangeAggregator();
export const changeHistoryTracker = new ChangeHistoryTracker();

// Auto-track changes in history
eventBus.on('filewatcher.change', (event) => {
  changeHistoryTracker.record(event.data as FileChange);
});
