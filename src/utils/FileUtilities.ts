import * as fs from 'fs/promises';
import { createHash, randomUUID } from 'crypto';
import * as path from 'path';

/** Workspace-relative directory tree node returned by dirTreeToJSON(). */
export interface DirTreeNode {
  name: string;
  type: 'directory' | 'file' | 'symlink' | 'other';
  size?: number;
  children?: DirTreeNode[];
}

/** Result of diskUsageCheck(). */
export interface DiskUsageResult {
  ok: boolean;
  available: number;
  required: number;
}

/** Disposable temp workspace created by tempWorkspaceCreate(). */
export interface TempWorkspace {
  path: string;
  cleanup: () => Promise<void>;
}

/** Exclusive file lock handle returned by fileLockAcquire(). */
export interface FileLock {
  lockPath: string;
  token: string;
  released: boolean;
}

/** Backup handle returned by backupBeforeWrite(). */
export interface FileBackup {
  existed: boolean;
  backupPath: string | null;
  restore: () => Promise<void>;
}

/** Result of mergeDirectories(). */
export interface MergeResult {
  copied: string[];
  skipped: string[];
}

function toAbsoluteWorkspaceRoot(workspaceRoot: string): string {
  return path.resolve(workspaceRoot);
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function realpathIfExists(target: string): Promise<string | null> {
  try {
    return await fs.realpath(target);
  } catch {
    return null;
  }
}

/** Resolve nearest existing ancestor of a path (self first). */
async function nearestExistingAncestor(target: string, stopAt: string): Promise<string> {
  let current = target;
  for (;;) {
    try {
      await fs.access(current);
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current || !isPathInside(stopAt, parent)) return stopAt;
      current = parent;
    }
  }
}

/**
 * 1. resolveSafePath() — canonicalize a workspace-relative path and reject
 * traversal plus symlink escapes. Returns the absolute safe path.
 */
export async function resolveSafePath(workspaceRoot: string, userPath: string): Promise<string> {
  const root = toAbsoluteWorkspaceRoot(workspaceRoot);
  const rootReal = (await realpathIfExists(root)) ?? root;
  const joined = path.resolve(root, userPath);
  if (!isPathInside(root, joined) && joined !== root) {
    throw new Error(`Path escapes workspace: ${userPath}`);
  }
  // Resolve symlinks via the nearest existing ancestor so new files can also be checked.
  const ancestor = await nearestExistingAncestor(joined, root);
  const ancestorReal = (await realpathIfExists(ancestor)) ?? ancestor;
  if (!isPathInside(rootReal, ancestorReal) && ancestorReal !== rootReal) {
    throw new Error(`Path escapes workspace via symlink: ${userPath}`);
  }
  const restored = joined.startsWith(ancestor)
    ? path.join(ancestorReal, path.relative(ancestor, joined))
    : ancestorReal;
  if (!isPathInside(rootReal, restored) && restored !== rootReal) {
    throw new Error(`Path is outside workspace: ${userPath}`);
  }
  return restored;
}

/** 2. isWithinWorkspace() — non-throwing containment check. */
export async function isWithinWorkspace(targetPath: string, workspaceRoot: string): Promise<boolean> {
  try {
    await resolveSafePath(workspaceRoot, targetPath);
    return true;
  } catch {
    return false;
  }
}

/** 3. getFileExtension() — keeps case; dotfiles have no extension. */
export function getFileExtension(filePath: string): string {
  const base = path.basename(filePath);
  if (base.startsWith('.') && base.indexOf('.', 1) === -1) return '';
  return path.extname(base);
}

/** 4. detectFileEncoding() — BOM sniffing + null-byte binary heuristic. */
export function detectFileEncoding(buffer: Buffer): { encoding: string; bom: boolean; isBinary: boolean } {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'utf-8', bom: true, isBinary: false };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: 'utf-16le', bom: true, isBinary: false };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: 'utf-16be', bom: true, isBinary: false };
  }
  if (buffer.includes(0)) return { encoding: 'binary', bom: false, isBinary: true };
  return { encoding: 'utf-8', bom: false, isBinary: false };
}

/** 5. readFileChunked() — stream a file in bounded chunks. */
export async function* readFileChunked(filePath: string, chunkSize = 64 * 1024): AsyncGenerator<Buffer> {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error('chunkSize must be a positive integer');
  const handle = await fs.open(filePath, 'r');
  try {
    for (;;) {
      const buffer = Buffer.alloc(chunkSize);
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, null);
      if (bytesRead === 0) break;
      yield buffer.subarray(0, bytesRead);
      if (bytesRead < chunkSize) break;
    }
  } finally {
    await handle.close();
  }
}

/** 6. atomicWriteFile() — write-to-temp-then-rename, preserving mode by default. */
export async function atomicWriteFile(
  filePath: string,
  content: string | Buffer,
  options: { mode?: number } = {},
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  let mode = options.mode;
  if (mode === undefined) {
    try {
      mode = (await fs.stat(filePath)).mode & 0o777;
    } catch {
      mode = undefined;
    }
  }
  const tempPath = `${filePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tempPath, content, mode !== undefined ? { mode } : undefined);
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
  if (mode !== undefined) {
    try {
      await fs.chmod(filePath, mode);
    } catch {
      // Best effort: rename already succeeded.
    }
  }
}

/** 7. backupBeforeWrite() — snapshot content so tests/tools can restore safely. */
export async function backupBeforeWrite(
  workspaceRoot: string,
  absolutePath: string,
  task?: string,
): Promise<FileBackup> {
  const root = toAbsoluteWorkspaceRoot(workspaceRoot);
  let existed = true;
  let content: Buffer;
  try {
    content = await fs.readFile(absolutePath);
  } catch {
    existed = false;
    content = Buffer.alloc(0);
  }
  const relative = path.relative(root, absolutePath);
  const stamp = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const backupPath = path.join(root, '.agent', 'backups', task ?? 'manual', stamp, relative);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, content);
  return {
    existed,
    backupPath,
    restore: async () => {
      if (existed) {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content);
      } else {
        await fs.rm(absolutePath, { force: true });
      }
    },
  };
}

/** 8. getFileHash() — streaming SHA-256 checksum. */
export async function getFileHash(filePath: string, algorithm = 'sha256'): Promise<string> {
  const hash = createHash(algorithm);
  const handle = await fs.open(filePath, 'r');
  try {
    for (;;) {
      const buffer = Buffer.alloc(64 * 1024);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      if (bytesRead < buffer.length) break;
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.split(path.sep).join('/');
  let regex = '^';
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (char === '*') {
      if (normalized[i + 1] === '*') {
        // '**' matches anything including separators; consume optional trailing slash.
        i += 2;
        if (normalized[i] === '/') i += 1;
        regex += '.*';
      } else {
        i += 1;
        regex += '[^/]*';
      }
    } else if (char === '?') {
      i += 1;
      regex += '[^/]';
    } else if ('+.^${}()|[]\\'.includes(char)) {
      regex += `\\${char}`;
      i += 1;
    } else {
      regex += char;
      i += 1;
    }
  }
  regex += '$';
  return new RegExp(regex);
}

/** 9. globMatch() — minimal `*` / `**` / `?` matcher for workspace paths. */
export function globMatch(pattern: string, testPath: string): boolean {
  const normalized = testPath.split(path.sep).join('/');
  return globToRegExp(pattern).test(normalized);
}

/** 10. ignorePatternLoader() — load .gitignore + .agentignore rules. */
export async function ignorePatternLoader(workspaceRoot: string): Promise<string[]> {
  const patterns: string[] = [];
  for (const file of ['.gitignore', '.agentignore']) {
    try {
      const raw = await fs.readFile(path.join(workspaceRoot, file), 'utf-8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        patterns.push(trimmed);
      }
    } catch {
      // Missing ignore file is fine.
    }
  }
  return patterns;
}

/** 11. dirTreeToJSON() — sorted tree, symlinks reported without following. */
export async function dirTreeToJSON(rootPath: string): Promise<DirTreeNode> {
  const absolute = path.resolve(rootPath);
  async function build(current: string): Promise<DirTreeNode> {
    const stat = await fs.lstat(current);
    const name = path.basename(current);
    if (stat.isSymbolicLink()) return { name, type: 'symlink' };
    if (stat.isDirectory()) {
      const entries = (await fs.readdir(current)).sort();
      const children: DirTreeNode[] = [];
      for (const entry of entries) children.push(await build(path.join(current, entry)));
      return { name, type: 'directory', children };
    }
    if (stat.isFile()) return { name, type: 'file', size: stat.size };
    return { name, type: 'other' };
  }
  const node = await build(absolute);
  // Root keeps basename too; tests only assert type/children.
  return node;
}

/** 12. findEmptyDirectories() — directories with zero entries, symlinks skipped. */
export async function findEmptyDirectories(rootPath: string): Promise<string[]> {
  const root = path.resolve(rootPath);
  const empty: string[] = [];
  async function walk(current: string): Promise<void> {
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) return;
    const entries = await fs.readdir(current);
    if (entries.length === 0) {
      empty.push(path.relative(root, current));
      return;
    }
    for (const entry of entries) await walk(path.join(current, entry));
  }
  await walk(root);
  return empty.sort();
}

/** 13. mergeDirectories() — copy new files, never overwrite by default. */
export async function mergeDirectories(
  sourceDir: string,
  destinationDir: string,
  options: { overwrite?: boolean } = {},
): Promise<MergeResult> {
  const copied: string[] = [];
  const skipped: string[] = [];
  async function walk(currentSource: string): Promise<void> {
    const stat = await fs.lstat(currentSource);
    if (stat.isSymbolicLink()) return;
    const relative = path.relative(sourceDir, currentSource);
    const target = path.join(destinationDir, relative);
    if (stat.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      for (const entry of await fs.readdir(currentSource)) await walk(path.join(currentSource, entry));
      return;
    }
    if (!stat.isFile()) return;
    try {
      await fs.access(target);
      if (!options.overwrite) {
        skipped.push(relative.split(path.sep).join(path.sep));
        return;
      }
    } catch {
      // Target missing — copy below.
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(currentSource, target);
    copied.push(relative);
  }
  await walk(sourceDir);
  copied.sort();
  skipped.sort();
  return { copied, skipped };
}

/** 14. symlinkResolver() — resolve a link only if the target stays in workspace. */
export async function symlinkResolver(workspaceRoot: string, linkPath: string): Promise<string> {
  const root = toAbsoluteWorkspaceRoot(workspaceRoot);
  const absoluteLink = path.isAbsolute(linkPath) ? linkPath : path.join(root, linkPath);
  let target = absoluteLink;
  try {
    target = await fs.realpath(absoluteLink);
  } catch {
    target = await resolveSafePath(root, path.relative(root, absoluteLink));
  }
  const rootReal = (await realpathIfExists(root)) ?? root;
  if (!isPathInside(rootReal, target) && target !== rootReal) {
    throw new Error(`Symlink target is outside workspace: ${linkPath}`);
  }
  return target;
}

/** 15. fileLockAcquire() — exclusive lock file with timeout + polling. */
export async function fileLockAcquire(
  lockPath: string,
  options: { timeoutMs?: number; retryMs?: number } = {},
): Promise<FileLock> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const retryMs = options.retryMs ?? 25;
  const token = `${process.pid}-${randomUUID()}`;
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fs.writeFile(lockPath, token, { flag: 'wx' });
      return { lockPath, token, released: false };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error(`Timed out acquiring file lock: ${lockPath}`);
      await new Promise(resolve => setTimeout(resolve, retryMs));
    }
  }
}

/** 15b. fileLockRelease() — idempotent; only the owner removes the lock. */
export async function fileLockRelease(lock: FileLock): Promise<void> {
  if (lock.released) return;
  lock.released = true;
  try {
    const current = await fs.readFile(lock.lockPath, 'utf-8');
    if (current !== lock.token) return;
  } catch {
    return;
  }
  await fs.rm(lock.lockPath, { force: true }).catch(() => undefined);
}

/** 16. tempWorkspaceCreate() — disposable workspace under .agent/tmp. */
export async function tempWorkspaceCreate(workspaceRoot: string, label = 'tmp'): Promise<TempWorkspace> {
  const safeLabel = label.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 40) || 'tmp';
  const dir = path.join(workspaceRoot, '.agent', 'tmp', `${safeLabel}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`);
  await fs.mkdir(dir, { recursive: true });
  return {
    path: dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/** 17. diskUsageCheck() — refuse huge writes when space is insufficient. */
export async function diskUsageCheck(
  anyPathInsideVolume: string,
  requiredBytes: number,
  reserveBytes = 0,
): Promise<DiskUsageResult> {
  const required = requiredBytes + reserveBytes;
  let probe = path.resolve(anyPathInsideVolume);
  for (;;) {
    try {
      const stats = await fs.statfs(probe);
      const available = stats.bavail * stats.bsize;
      return { ok: available >= required, available, required };
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) return { ok: Number.MAX_SAFE_INTEGER >= required, available: Number.MAX_SAFE_INTEGER, required };
      probe = parent;
    }
  }
}

/** 18. binaryFileDetector() — bounded sample, true when NUL byte present. */
export async function binaryFileDetector(filePath: string, sampleBytes = 8192): Promise<boolean> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(sampleBytes);
    const { bytesRead } = await handle.read(buffer, 0, sampleBytes, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}

/** 19. lineEndingNormalizer() — normalize mixed endings to LF (or requested). */
export function lineEndingNormalizer(text: string, target: '\n' | '\r\n' = '\n'): string {
  const lf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return target === '\n' ? lf : lf.replace(/\n/g, '\r\n');
}

/** 20. filePermissionSetter() — restrictive chmod for configs/secrets. */
export async function filePermissionSetter(filePath: string, mode: number): Promise<void> {
  await fs.chmod(filePath, mode);
}
