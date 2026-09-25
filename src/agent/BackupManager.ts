import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * BackupManager — item 26 "backup before edit" + item 25 "undo/rollback
 * after apply". Every mutating file tool records the previous content here
 * before writing, so any change can be rolled back within the session.
 *
 * Backups live in .agent/backups/<task>/… (gitignored) and never leave the
 * workspace. Memory-bounded: oldest backups are evicted first.
 */

export interface BackupRecord {
  id: string;
  /** Workspace-relative path of the file that was (or is about to be) changed. */
  relativePath: string;
  absolutePath: string;
  backupPath: string;
  existed: boolean;
  createdAt: string;
  task?: string;
}

export class BackupManager {
  private backups = new Map<string, BackupRecord[]>(); // absolutePath → records (newest last)
  private taskEditCounts = new Map<string, Set<string>>();

  constructor(
    private readonly backupDirName = '.agent/backups',
    private readonly maxPerFile = 5,
    private readonly maxTasksTracked = 50
  ) {}

  /** Snapshot the current content of a file before a mutation. */
  async beforeWrite(workspaceRoot: string, absolutePath: string, task?: string): Promise<BackupRecord> {
    const relative = path.relative(workspaceRoot, absolutePath);
    let existed = true;
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      existed = false;
      content = '';
    }
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const backupPath = path.join(workspaceRoot, this.backupDirName, stamp, relative);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    if (existed) await fs.writeFile(backupPath, content, 'utf-8');
    else await fs.writeFile(backupPath, '', 'utf-8');

    const record: BackupRecord = {
      id: stamp,
      relativePath: relative,
      absolutePath,
      backupPath,
      existed,
      createdAt: new Date().toISOString(),
      task,
    };
    const list = this.backups.get(absolutePath) ?? [];
    list.push(record);
    while (list.length > this.maxPerFile) list.shift(); // evict oldest
    this.backups.set(absolutePath, list);

    if (task) {
      let files = this.taskEditCounts.get(task);
      if (!files) {
        // Bound memory: drop the oldest task when over the cap.
        if (this.taskEditCounts.size >= this.maxTasksTracked) {
          const oldest = this.taskEditCounts.keys().next().value;
          if (oldest !== undefined) this.taskEditCounts.delete(oldest);
        }
        files = new Set();
        this.taskEditCounts.set(task, files);
      }
      files.add(absolutePath);
    }
    return record;
  }

  /**
   * Item 24 — undo: restore the most recent backup for a path.
   * Returns the restored content length, or null when nothing to undo.
   */
  async undo(workspaceRoot: string, absolutePath: string): Promise<BackupRecord | null> {
    const list = this.backups.get(absolutePath);
    if (!list || list.length === 0) return null;
    const record = list.pop()!;
    if (record.existed) {
      const content = await fs.readFile(record.backupPath, 'utf-8');
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');
    } else {
      await fs.rm(absolutePath, { force: true });
    }
    await fs.rm(path.dirname(record.backupPath), { recursive: true, force: true }).catch(() => undefined);
    return record;
  }

  /** Paths changed within one task (for the per-task file cap). */
  filesChangedInTask(task: string): number {
    return this.taskEditCounts.get(task)?.size ?? 0;
  }

  /** Absolute paths of everything currently backed up. */
  get trackedPaths(): string[] {
    return [...this.backups.keys()];
  }

  get totalBackups(): number {
    return [...this.backups.values()].reduce((sum, list) => sum + list.length, 0);
  }

  /** Remove all backups + counters (end of run). Files themselves are untouched. */
  reset(): void {
    this.backups.clear();
    this.taskEditCounts.clear();
  }
}

/**
 * ProtectedPaths — item 71-ish "never overwrite system/config files without
 * special approval": .env*, .git/, CI configs, lockfile-adjacent security
 * configs. Mutating tools call `check()` before writing; a hit forces the
 * permission call to 'critical' so a human must explicitly approve.
 */
export class ProtectedPaths {
  private static readonly PATTERNS: Array<{ id: string; test: (p: string) => boolean; why: string }> = [
    { id: 'env-file', test: p => /(^|\/)\.env(\..*)?$/.test(p), why: 'environment/secret file' },
    { id: 'git-dir', test: p => /(^|\/)\.git(\/|$)/.test(p), why: 'git internals' },
    { id: 'ci-config', test: p => /(^|\/)\.github\/workflows\//.test(p) || /(^|\/)\.gitlab-ci\.yml$/.test(p), why: 'CI pipeline config' },
    { id: 'deploy-config', test: p => /(^|\/)(render\.yaml|vercel\.json|netlify\.toml|fly\.toml|docker-compose\.ya?ml|Dockerfile)$/.test(p), why: 'deployment config' },
    { id: 'agent-config', test: p => /(^|\/)\.agent\/config\.json$/.test(p), why: 'agent security configuration' },
    { id: 'npmrc', test: p => /(^|\/)\.npmrc$/.test(p), why: 'npm registry/auth config' },
  ];

  /** Returns the protection reason, or null when the path is unprotected. */
  static check(workspaceRelativePath: string): string | null {
    const normalized = workspaceRelativePath.replace(/\\/g, '/');
    for (const rule of ProtectedPaths.PATTERNS) {
      if (rule.test(normalized)) return `${rule.why} (${rule.id})`;
    }
    return null;
  }

  /** Risk level a mutation on this path should carry. */
  static riskFor(workspaceRelativePath: string): 'medium' | 'high' | 'critical' {
    return ProtectedPaths.check(workspaceRelativePath) ? 'critical' : 'medium';
  }
}
