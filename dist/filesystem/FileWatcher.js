"use strict";
/**
 * File Watcher System
 * Real-time file system monitoring with pattern matching and change detection
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeHistoryTracker = exports.changeAggregator = exports.fileWatcher = exports.ChangeHistoryTracker = exports.FileWatcherPresets = exports.FilePatternMatcher = exports.ChangeAggregator = exports.FileWatcher = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const EventBus_1 = require("../core/EventBus");
/**
 * File Watcher
 */
class FileWatcher {
    watchers = new Map();
    watcherId = 0;
    /**
     * Watch directory or file
     */
    watch(config, callback) {
        const id = `watcher_${++this.watcherId}`;
        const watcher = new WatcherInstance(id, config, callback);
        this.watchers.set(id, watcher);
        watcher.start();
        EventBus_1.eventBus.emitSync('filewatcher.started', { id, config }, 'FileWatcher');
        return {
            id,
            stop: () => this.stopWatcher(id),
        };
    }
    /**
     * Stop watcher
     */
    stopWatcher(id) {
        const watcher = this.watchers.get(id);
        if (watcher) {
            watcher.stop();
            this.watchers.delete(id);
            EventBus_1.eventBus.emitSync('filewatcher.stopped', { id }, 'FileWatcher');
        }
    }
    /**
     * Stop all watchers
     */
    stopAll() {
        for (const watcher of this.watchers.values()) {
            watcher.stop();
        }
        this.watchers.clear();
    }
    /**
     * Get active watchers
     */
    getActiveWatchers() {
        return Array.from(this.watchers.values()).map(w => ({
            id: w.id,
            config: w.config,
        }));
    }
}
exports.FileWatcher = FileWatcher;
/**
 * Watcher Instance
 */
class WatcherInstance {
    id;
    config;
    callback;
    files = new Map();
    timer;
    stopped = false;
    constructor(id, config, callback) {
        this.id = id;
        this.config = config;
        this.callback = callback;
    }
    /**
     * Start watching
     */
    async start() {
        // Initial scan
        await this.scan();
        // Poll for changes
        this.poll();
    }
    /**
     * Stop watching
     */
    stop() {
        this.stopped = true;
        if (this.timer) {
            clearTimeout(this.timer);
        }
    }
    /**
     * Scan directory
     */
    async scan() {
        try {
            const stats = await fs.stat(this.config.path);
            if (stats.isFile()) {
                await this.scanFile(this.config.path);
            }
            else if (stats.isDirectory()) {
                await this.scanDirectory(this.config.path);
            }
        }
        catch (error) {
            console.error(`Failed to scan ${this.config.path}:`, error);
        }
    }
    /**
     * Scan directory recursively
     */
    async scanDirectory(dirPath) {
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
                }
                else if (entry.isFile()) {
                    await this.scanFile(fullPath);
                }
            }
        }
        catch (error) {
            console.error(`Failed to scan directory ${dirPath}:`, error);
        }
    }
    /**
     * Scan single file
     */
    async scanFile(filePath) {
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
            }
            else if (stats.mtimeMs !== existing.modified.getTime()) {
                // Modified file
                this.files.set(filePath, fileStats);
                this.emitChange({
                    event: 'modify',
                    path: filePath,
                    timestamp: new Date(),
                    stats: fileStats,
                });
            }
        }
        catch (error) {
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
    poll() {
        if (this.stopped)
            return;
        const debounce = this.config.debounce || 1000;
        this.timer = setTimeout(async () => {
            await this.detectChanges();
            this.poll();
        }, debounce);
    }
    /**
     * Detect changes
     */
    async detectChanges() {
        // Check for deleted files
        const currentFiles = new Set();
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
        }
        catch (error) {
            console.error('Error detecting changes:', error);
        }
    }
    /**
     * Collect all current files
     */
    async collectCurrentFiles(dirPath, files) {
        try {
            const stats = await fs.stat(dirPath);
            if (stats.isFile()) {
                if (this.matchesPattern(dirPath) && !this.shouldIgnore(dirPath)) {
                    files.add(dirPath);
                }
                return;
            }
            if (!stats.isDirectory())
                return;
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (this.shouldIgnore(fullPath)) {
                    continue;
                }
                if (entry.isDirectory() && this.config.recursive) {
                    await this.collectCurrentFiles(fullPath, files);
                }
                else if (entry.isFile() && this.matchesPattern(fullPath)) {
                    files.add(fullPath);
                }
            }
        }
        catch (error) {
            // Ignore errors (file might have been deleted)
        }
    }
    /**
     * Emit file change
     */
    emitChange(change) {
        // Filter by event types
        if (this.config.events && !this.config.events.includes(change.event)) {
            return;
        }
        this.callback(change);
        EventBus_1.eventBus.emitSync('filewatcher.change', change, 'FileWatcher');
    }
    /**
     * Check if path matches patterns
     */
    matchesPattern(filePath) {
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
    shouldIgnore(filePath) {
        if (!this.config.ignore)
            return false;
        return this.config.ignore.some(pattern => {
            return filePath.includes(pattern) || this.matchGlob(filePath, pattern);
        });
    }
    /**
     * Simple glob matching
     */
    matchGlob(str, pattern) {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`).test(str);
    }
    /**
     * Convert fs.Stats to FileStats
     */
    toFileStats(stats) {
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
class ChangeAggregator {
    pending = new Map();
    timers = new Map();
    /**
     * Add change to aggregation
     */
    add(key, change, callback, delay = 500) {
        // Add to pending
        if (!this.pending.has(key)) {
            this.pending.set(key, []);
        }
        this.pending.get(key).push(change);
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
    flush() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.pending.clear();
    }
}
exports.ChangeAggregator = ChangeAggregator;
/**
 * File Pattern Matcher
 */
class FilePatternMatcher {
    /**
     * Match file against patterns
     */
    static match(filePath, patterns) {
        return patterns.some(pattern => this.matchPattern(filePath, pattern));
    }
    /**
     * Match single pattern
     */
    static matchPattern(filePath, pattern) {
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
    static commonPatterns() {
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
exports.FilePatternMatcher = FilePatternMatcher;
/**
 * File Watcher Presets
 */
class FileWatcherPresets {
    /**
     * Watch TypeScript files
     */
    static typescript(root, callback) {
        return exports.fileWatcher.watch({
            path: root,
            recursive: true,
            patterns: ['**/*.ts', '**/*.tsx'],
            ignore: ['node_modules', 'dist', 'build'],
        }, callback);
    }
    /**
     * Watch JavaScript files
     */
    static javascript(root, callback) {
        return exports.fileWatcher.watch({
            path: root,
            recursive: true,
            patterns: ['**/*.js', '**/*.jsx'],
            ignore: ['node_modules', 'dist', 'build'],
        }, callback);
    }
    /**
     * Watch Python files
     */
    static python(root, callback) {
        return exports.fileWatcher.watch({
            path: root,
            recursive: true,
            patterns: ['**/*.py'],
            ignore: ['__pycache__', 'venv', '.venv', 'dist', 'build'],
        }, callback);
    }
    /**
     * Watch configuration files
     */
    static config(root, callback) {
        return exports.fileWatcher.watch({
            path: root,
            recursive: true,
            patterns: ['**/*.json', '**/*.yaml', '**/*.yml', '**/*.toml', '**/*.env'],
            ignore: ['node_modules'],
        }, callback);
    }
    /**
     * Watch source files (multi-language)
     */
    static source(root, callback) {
        return exports.fileWatcher.watch({
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
exports.FileWatcherPresets = FileWatcherPresets;
/**
 * Change History Tracker
 */
class ChangeHistoryTracker {
    history = [];
    maxHistory = 1000;
    /**
     * Record change
     */
    record(change) {
        this.history.push(change);
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
        EventBus_1.eventBus.emitSync('filehistory.recorded', change, 'ChangeHistoryTracker');
    }
    /**
     * Get history
     */
    getHistory(filter) {
        let history = [...this.history];
        if (filter?.path) {
            history = history.filter(c => c.path.includes(filter.path));
        }
        if (filter?.event) {
            history = history.filter(c => c.event === filter.event);
        }
        if (filter?.since) {
            history = history.filter(c => c.timestamp >= filter.since);
        }
        if (filter?.limit) {
            history = history.slice(-filter.limit);
        }
        return history;
    }
    /**
     * Get recent changes
     */
    getRecent(limit = 20) {
        return this.history.slice(-limit);
    }
    /**
     * Clear history
     */
    clear() {
        this.history = [];
    }
    /**
     * Get statistics
     */
    getStats() {
        const byEvent = {
            create: 0,
            modify: 0,
            delete: 0,
            rename: 0,
        };
        const byPath = new Map();
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
exports.ChangeHistoryTracker = ChangeHistoryTracker;
/**
 * Singleton instances
 */
exports.fileWatcher = new FileWatcher();
exports.changeAggregator = new ChangeAggregator();
exports.changeHistoryTracker = new ChangeHistoryTracker();
// Auto-track changes in history
EventBus_1.eventBus.on('filewatcher.change', (event) => {
    exports.changeHistoryTracker.record(event.data);
});
