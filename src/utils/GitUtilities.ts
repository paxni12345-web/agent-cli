/**
 * GitUtilities — git helper functions (500-functions category E, 81-100).
 *
 * Thin, testable wrappers over the `git` CLI via execFile (argv array —
 * no shell interpolation). Every function takes an explicit `cwd`
 * (workspace root) so tests can point at temp repos. GitHub API
 * functions (createPullRequest / getPRDiff / getPRComments) go through
 * the `gh` CLI, same as the existing Tool classes.
 *
 * Unit-tested in tests/unit/GitUtilities.test.ts against real temp repos.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 10 * 1024 * 1024;
const TIMEOUT = 30_000;

export interface GitRunOptions {
  cwd: string;
  timeout?: number;
}

/** Run git with argv (never a shell string) and return trimmed stdout. */
async function runGit(args: string[], options: GitRunOptions): Promise<string> {
  if (!options.cwd) throw new Error('cwd is required');
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: options.cwd,
      maxBuffer: MAX_BUFFER,
      timeout: options.timeout ?? TIMEOUT,
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { message?: string; stderr?: string };
    throw new Error((err.stderr ?? err.message ?? 'git command failed').trim());
  }
}

/** Validate a branch/tag name against git check-ref-format rules (subset). */
function assertValidRef(name: string, what: string): void {
  if (!name || !/^[A-Za-z0-9._/-]+$/.test(name) || name.includes('..')) {
    throw new Error(`Invalid ${what} name: ${JSON.stringify(name)}`);
  }
}

/** 81. Current branch name (or 'HEAD' when detached). */
export async function getCurrentBranch(options: GitRunOptions): Promise<string> {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], options);
}

/** 82. Create a new branch (optionally from a start point) and check it out. */
export async function createBranch(
  options: GitRunOptions,
  branch: string,
  startPoint?: string,
): Promise<void> {
  assertValidRef(branch, 'branch');
  const args = startPoint ? ['checkout', '-b', branch, startPoint] : ['checkout', '-b', branch];
  await runGit(args, options);
}

/** 83. Switch to an existing branch. */
export async function checkoutBranch(options: GitRunOptions, branch: string): Promise<void> {
  assertValidRef(branch, 'branch');
  await runGit(['checkout', branch], options);
}

export interface CommitOptions extends GitRunOptions {
  message: string;
  paths?: string[];
  allowEmpty?: boolean;
}

/** 84. Stage (all or given paths) and commit with a message. Returns the new SHA. */
export async function commitWithMessage(options: CommitOptions): Promise<string> {
  if (!options.message.trim()) throw new Error('commit message must not be empty');
  if (options.paths?.length) await runGit(['add', '--', ...options.paths], options);
  else await runGit(['add', '-A'], options);
  const args = ['commit', '-m', options.message];
  if (options.allowEmpty) args.push('--allow-empty');
  await runGit(args, options);
  return runGit(['rev-parse', 'HEAD'], options);
}

/** 85. Deterministic commit-message draft from staged diff + status. */
export function generateCommitMessage(statusOut: string, diffOut: string): string {
  const files = [...statusOut.matchAll(/^\s*M\s+(.+)$/gm)].map(m => m[1].trim());
  const staged = [...statusOut.matchAll(/^M\s+(.+)$/gm)].map(m => m[1].trim());
  const touched = (staged.length ? staged : files).slice(0, 5);
  const additions = (diffOut.match(/^\+[^+]/gm) ?? []).length;
  const removals = (diffOut.match(/^-[^-]/gm) ?? []).length;
  const verb = removals > additions * 2 ? 'Refactor' : additions > removals * 2 ? 'Add' : 'Update';
  return `${verb} ${touched.length ? touched.join(', ') : 'workspace files'} (+${additions}/-${removals})`;
}

export interface UncommittedChanges {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

/** 86. Parse `git status --porcelain` into staged / unstaged / untracked lists. */
export async function getUncommittedChanges(options: GitRunOptions): Promise<UncommittedChanges> {
  const out = await runGit(['status', '--porcelain'], options);
  const result: UncommittedChanges = { staged: [], unstaged: [], untracked: [] };
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const x = line[0];
    const y = line[1];
    const file = line.slice(3).trim();
    if (x === '?' && y === '?') {
      result.untracked.push(file);
      continue;
    }
    if (x !== ' ' && x !== '?') result.staged.push(file);
    if (y !== ' ' && y !== '?') result.unstaged.push(file);
  }
  return result;
}

/** 87a. Stash working-tree changes. Returns the stash message line. */
export async function stashChanges(options: GitRunOptions, message?: string): Promise<string> {
  return runGit(['stash', 'push', '-m', message ?? 'agent stash'], options);
}

/** 87b. Restore the most recent stash. */
export async function popStash(options: GitRunOptions): Promise<string> {
  return runGit(['stash', 'pop'], options);
}

export interface CommitInfo {
  sha: string;
  subject: string;
  author: string;
  date: string;
}

/** 88. Recent commit history (newest first). */
export async function getCommitHistory(
  options: GitRunOptions,
  limit = 10,
): Promise<CommitInfo[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }
  const out = await runGit(
    ['log', `-n${limit}`, '--format=%H%x1f%s%x1f%an%x1f%ad', '--date=short'],
    options,
  );
  if (!out) return [];
  return out.split('\n').map(line => {
    const [sha, subject, author, date] = line.split('\x1f');
    return { sha, subject, author, date };
  });
}

export interface BlameLine {
  line: number;
  sha: string;
  author: string;
  content: string;
}

/** 89. `git blame --porcelain` parsed per line (optional 1-based range). */
export async function blameFile(
  options: GitRunOptions,
  file: string,
  range?: { from: number; to: number },
): Promise<BlameLine[]> {
  if (!file) throw new Error('file is required');
  const args = ['blame', '--porcelain'];
  if (range) {
    if (range.from < 1 || range.to < range.from) throw new Error('invalid line range');
    args.push('-L', `${range.from},${range.to}`);
  }
  args.push('--', file);
  const out = await runGit(args, options);
  const lines: BlameLine[] = [];
  let sha = '';
  let author = '';
  let lineNo = range?.from ?? 1;
  for (const line of out.split('\n')) {
    if (line.startsWith('\t')) {
      lines.push({ line: lineNo++, sha, author, content: line.slice(1) });
    } else if (/^[0-9a-f]{40} /.test(line)) {
      sha = line.slice(0, 40);
    } else if (line.startsWith('author ')) {
      author = line.slice('author '.length);
    }
  }
  return lines;
}

/** 90. Find the commit that introduced a bug via `git log -S` (bisect scaffold). */
export async function findCommitIntroducingBug(
  options: GitRunOptions,
  symbol: string,
  file?: string,
): Promise<CommitInfo[]> {
  if (!symbol.trim()) throw new Error('symbol is required');
  const args = ['log', '--all', '-S', symbol, '--oneline', '-n', '20', '--format=%H%x1f%s%x1f%an%x1f%ad', '--date=short'];
  if (file) args.push('--', file);
  const out = await runGit(args, options);
  if (!out) return [];
  return out.split('\n').map(line => {
    const [sha, subject, author, date] = line.split('\x1f');
    return { sha, subject, author, date };
  });
}

/** 91. Merge a branch into the current one. Returns merge output. */
export async function mergeBranch(
  options: GitRunOptions,
  branch: string,
  message?: string,
): Promise<string> {
  assertValidRef(branch, 'branch');
  const args = ['merge', branch];
  if (message) args.push('-m', message);
  return runGit(args, options);
}

/** 92. Rebase the current branch onto another. Returns rebase output. */
export async function rebaseBranch(options: GitRunOptions, onto: string): Promise<string> {
  assertValidRef(onto, 'branch');
  return runGit(['rebase', onto], options);
}

export interface ConflictHunk {
  file: string;
  line: number;
  ours: string[];
  theirs: string[];
}

/** 93. List conflicted files and extract ours/theirs hunks for resolution. */
export async function resolveMergeConflict(options: GitRunOptions): Promise<ConflictHunk[]> {
  const { default: fs } = await import('fs/promises');
  const { default: path } = await import('path');
  const status = await runGit(['status', '--porcelain'], options);
  const conflicted = status
    .split('\n')
    .filter(l => /^(UU|AA|DD|AU|UA|DU|UD)/.test(l))
    .map(l => l.slice(3).trim());
  const hunks: ConflictHunk[] = [];
  for (const file of conflicted.slice(0, 8)) {
    let source: string;
    try {
      source = await fs.readFile(path.resolve(options.cwd, file), 'utf-8');
    } catch {
      continue;
    }
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('<<<<<<<')) continue;
      const ours: string[] = [];
      const theirs: string[] = [];
      let mode: 'ours' | 'theirs' = 'ours';
      let j = i + 1;
      for (; j < lines.length && !lines[j].startsWith('>>>>>>>'); j++) {
        if (lines[j].startsWith('=======')) {
          mode = 'theirs';
          continue;
        }
        (mode === 'ours' ? ours : theirs).push(lines[j]);
      }
      hunks.push({ file, line: i + 1, ours, theirs });
      i = j;
      if (hunks.length >= 20) break;
    }
  }
  return hunks;
}

/** 94. Push the current branch to a remote (never with --force). */
export async function pushToRemote(
  options: GitRunOptions,
  remote = 'origin',
  branch?: string,
): Promise<string> {
  if (!/^[A-Za-z0-9._-]+$/.test(remote)) throw new Error(`Invalid remote: ${JSON.stringify(remote)}`);
  const target = branch ?? (await getCurrentBranch(options));
  assertValidRef(target, 'branch');
  return runGit(['push', remote, target], options);
}

async function runGh(args: string[], options: GitRunOptions): Promise<string> {
  if (!options.cwd) throw new Error('cwd is required');
  try {
    const { stdout } = await execFileAsync('gh', args, {
      cwd: options.cwd,
      maxBuffer: MAX_BUFFER,
      timeout: options.timeout ?? TIMEOUT,
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { message?: string; stderr?: string };
    throw new Error((err.stderr ?? err.message ?? 'gh command failed').trim());
  }
}

export interface PROptions extends GitRunOptions {
  title: string;
  body?: string;
  base?: string;
}

/** 95. Open a pull request via the GitHub CLI. Returns the PR URL. */
export async function createPullRequest(options: PROptions): Promise<string> {
  if (!options.title.trim()) throw new Error('PR title must not be empty');
  const args = ['pr', 'create', '--title', options.title, '--body', options.body ?? '(no description provided)'];
  if (options.base) args.push('--base', options.base);
  const out = await runGh(args, options);
  const url = out.match(/https:\/\/github\.com\/\S+/)?.[0];
  return url ?? out;
}

/** 96. Fetch a PR diff via `gh pr diff`. */
export async function getPRDiff(options: GitRunOptions, number?: string): Promise<string> {
  const args = number ? ['pr', 'diff', number] : ['pr', 'diff'];
  return runGh(args, options);
}

export interface PRComment {
  author: string;
  body: string;
  path?: string;
}

/** 97. List review comments on a PR via `gh pr view --json`. */
export async function getPRComments(options: GitRunOptions, number?: string): Promise<PRComment[]> {
  const args = ['pr', 'view', ...(number ? [number] : []), '--json', 'reviews,comments', '--jq', '.'];
  const out = await runGh(args, options);
  try {
    const data = JSON.parse(out) as {
      reviews?: Array<{ author?: { login?: string }; body?: string }>;
      comments?: Array<{ author?: { login?: string }; body?: string; path?: string }>;
    };
    const comments: PRComment[] = [];
    for (const r of data.reviews ?? []) {
      if (r.body?.trim()) comments.push({ author: r.author?.login ?? 'unknown', body: r.body });
    }
    for (const c of data.comments ?? []) {
      comments.push({ author: c.author?.login ?? 'unknown', body: c.body ?? '', path: c.path });
    }
    return comments;
  } catch {
    return [];
  }
}

/** 98. Create an annotated tag for a release. */
export async function tagRelease(
  options: GitRunOptions,
  tag: string,
  message?: string,
): Promise<void> {
  assertValidRef(tag, 'tag');
  await runGit(['tag', '-a', tag, '-m', message ?? `Release ${tag}`], options);
}

/** 99. Revert a commit by SHA (no commit body editing). */
export async function revertCommit(options: GitRunOptions, sha: string): Promise<string> {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error(`Invalid commit SHA: ${JSON.stringify(sha)}`);
  return runGit(['revert', '--no-edit', sha], options);
}

/** 100. Commit history for a single file (newest first). */
export async function getFileHistory(
  options: GitRunOptions,
  file: string,
  limit = 10,
): Promise<CommitInfo[]> {
  if (!file) throw new Error('file is required');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }
  const out = await runGit(
    ['log', `-n${limit}`, '--format=%H%x1f%s%x1f%an%x1f%ad', '--date=short', '--', file],
    options,
  );
  if (!out) return [];
  return out.split('\n').map(line => {
    const [sha, subject, author, date] = line.split('\x1f');
    return { sha, subject, author, date };
  });
}
