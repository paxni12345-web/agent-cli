/**
 * File Watcher System
 * Real-time file system monitoring with pattern matching and change detection
 */
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
    oldPath?: string;
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
export declare class FileWatcher {
    private watchers;
    private watcherId;
    /**
     * Watch directory or file
     */
    watch(config: WatchConfig, callback: (change: FileChange) => void): WatcherHandle;
    /**
     * Stop watcher
     */
    stopWatcher(id: string): void;
    /**
     * Stop all watchers
     */
    stopAll(): void;
    /**
     * Get active watchers
     */
    getActiveWatchers(): Array<{
        id: string;
        config: WatchConfig;
    }>;
}
/**
 * Change Aggregator - groups rapid changes
 */
export declare class ChangeAggregator {
    private pending;
    private timers;
    /**
     * Add change to aggregation
     */
    add(key: string, change: FileChange, callback: (changes: FileChange[]) => void, delay?: number): void;
    /**
     * Flush all pending changes
     */
    flush(): void;
}
/**
 * File Pattern Matcher
 */
export declare class FilePatternMatcher {
    /**
     * Match file against patterns
     */
    static match(filePath: string, patterns: string[]): boolean;
    /**
     * Match single pattern
     */
    static matchPattern(filePath: string, pattern: string): boolean;
    /**
     * Get common patterns
     */
    static commonPatterns(): Record<string, string[]>;
}
/**
 * File Watcher Presets
 */
export declare class FileWatcherPresets {
    /**
     * Watch TypeScript files
     */
    static typescript(root: string, callback: (change: FileChange) => void): WatcherHandle;
    /**
     * Watch JavaScript files
     */
    static javascript(root: string, callback: (change: FileChange) => void): WatcherHandle;
    /**
     * Watch Python files
     */
    static python(root: string, callback: (change: FileChange) => void): WatcherHandle;
    /**
     * Watch configuration files
     */
    static config(root: string, callback: (change: FileChange) => void): WatcherHandle;
    /**
     * Watch source files (multi-language)
     */
    static source(root: string, callback: (change: FileChange) => void): WatcherHandle;
}
/**
 * Change History Tracker
 */
export declare class ChangeHistoryTracker {
    private history;
    private maxHistory;
    /**
     * Record change
     */
    record(change: FileChange): void;
    /**
     * Get history
     */
    getHistory(filter?: {
        path?: string;
        event?: FileSystemEvent;
        since?: Date;
        limit?: number;
    }): FileChange[];
    /**
     * Get recent changes
     */
    getRecent(limit?: number): FileChange[];
    /**
     * Clear history
     */
    clear(): void;
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        byEvent: Record<FileSystemEvent, number>;
        byPath: Map<string, number>;
    };
}
/**
 * Singleton instances
 */
export declare const fileWatcher: FileWatcher;
export declare const changeAggregator: ChangeAggregator;
export declare const changeHistoryTracker: ChangeHistoryTracker;
//# sourceMappingURL=FileWatcher.d.ts.map