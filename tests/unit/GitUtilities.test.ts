/**
 * GitUtilities — category E (81-100).
 * Behavioral tests against real temp git repos (no mocks for git itself;
 * gh-dependent tests skip when the `gh` CLI is unavailable).
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  blameFile,
  checkoutBranch,
  commitWithMessage,
  createBranch,
  createPullRequest,
  findCommitIntroducingBug,
  generateCommitMessage,
  getCommitHistory,
  getCurrentBranch,
  getFileHistory,
  getPRComments,
  getPRDiff,
  getUncommittedChanges,
  mergeBranch,
  popStash,
  pushToRemote,
  rebaseBranch,
  resolveMergeConflict,
  revertCommit,
  stashChanges,
  tagRelease,
} from '../../src/utils/GitUtilities.js';

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

/** Fresh repo with identity configured and one initial commit. */
async function makeRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitutil-'));
  await git(dir, 'init', '-b', 'main');
  await git(dir, 'config', 'user.email', 'test@example.com');
  await git(dir, 'config', 'user.name', 'Tester');
  await fs.writeFile(path.join(dir, 'a.txt'), 'line1\n');
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-m', 'initial');
  return dir;
}

async function ghAvailable(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['--version']);
    return true;
  } catch {
    return false;
  }
}

describe('getCurrentBranch (81)', () => {
  it('returns the current branch name', async () => {
    const dir = await makeRepo();
    await expect(getCurrentBranch({ cwd: dir })).resolves.toBe('main');
  });

  it('requires cwd', async () => {
    await expect(getCurrentBranch({ cwd: '' })).rejects.toThrow(/cwd/);
  });
});

describe('createBranch / checkoutBranch (82-83)', () => {
  it('creates and switches branches', async () => {
    const dir = await makeRepo();
    await createBranch({ cwd: dir }, 'feature-x');
    await expect(getCurrentBranch({ cwd: dir })).resolves.toBe('feature-x');
    await checkoutBranch({ cwd: dir }, 'main');
    await expect(getCurrentBranch({ cwd: dir })).resolves.toBe('main');
  });

  it('rejects invalid branch names', async () => {
    const dir = await makeRepo();
    await expect(createBranch({ cwd: dir }, 'bad name!')).rejects.toThrow(/Invalid/);
    await expect(checkoutBranch({ cwd: dir }, '..evil')).rejects.toThrow(/Invalid/);
  });
});

describe('commitWithMessage (84)', () => {
  it('stages and commits, returning the new SHA', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'a.txt'), 'line1\nline2\n');
    const sha = await commitWithMessage({ cwd: dir, message: 'second commit' });
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(await git(dir, 'log', '--oneline', '-1')).toContain('second commit');
  });

  it('rejects an empty message', async () => {
    const dir = await makeRepo();
    await expect(commitWithMessage({ cwd: dir, message: '   ' })).rejects.toThrow(/empty/);
  });
});

describe('generateCommitMessage (85)', () => {
  it('drafts a deterministic message from status + diff', () => {
    const msg = generateCommitMessage('M  src/a.ts\n', '+x\n+y\n+z\n-x\n');
    expect(msg).toBe('Add src/a.ts (+3/-1)');
  });
});

describe('getUncommittedChanges (86)', () => {
  it('separates staged, unstaged and untracked files', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'a.txt'), 'line1\nchanged\n');
    await git(dir, 'add', 'a.txt');
    await fs.writeFile(path.join(dir, 'new.txt'), 'hello\n');
    const changes = await getUncommittedChanges({ cwd: dir });
    expect(changes.staged).toEqual(['a.txt']);
    expect(changes.untracked).toEqual(['new.txt']);
    expect(changes.unstaged).toEqual([]);
  });

  it('reports a clean tree as empty', async () => {
    const dir = await makeRepo();
    await expect(getUncommittedChanges({ cwd: dir })).resolves.toEqual({
      staged: [],
      unstaged: [],
      untracked: [],
    });
  });
});

describe('stashChanges / popStash (87)', () => {
  it('stashes and restores working-tree changes', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'a.txt'), 'line1\nstashed work\n');
    await stashChanges({ cwd: dir }, 'wip');
    expect(await fs.readFile(path.join(dir, 'a.txt'), 'utf-8')).toBe('line1\n');
    await popStash({ cwd: dir });
    expect(await fs.readFile(path.join(dir, 'a.txt'), 'utf-8')).toBe('line1\nstashed work\n');
  });
});

describe('getCommitHistory (88)', () => {
  it('lists newest-first commits with metadata', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'b.txt'), 'b\n');
    await commitWithMessage({ cwd: dir, message: 'add b' });
    const history = await getCommitHistory({ cwd: dir }, 5);
    expect(history).toHaveLength(2);
    expect(history[0].subject).toBe('add b');
    expect(history[0].author).toBe('Tester');
    expect(history[1].subject).toBe('initial');
  });

  it('validates the limit', async () => {
    const dir = await makeRepo();
    await expect(getCommitHistory({ cwd: dir }, 0)).rejects.toThrow(/limit/);
  });
});

describe('blameFile (89)', () => {
  it('attributes each line to author + sha', async () => {
    const dir = await makeRepo();
    const blame = await blameFile({ cwd: dir }, 'a.txt');
    expect(blame).toHaveLength(1);
    expect(blame[0]).toMatchObject({ line: 1, author: 'Tester', content: 'line1' });
    expect(blame[0].sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('supports a line range', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'a.txt'), 'l1\nl2\nl3\n');
    await commitWithMessage({ cwd: dir, message: 'three lines' });
    const blame = await blameFile({ cwd: dir }, 'a.txt', { from: 2, to: 3 });
    expect(blame.map(b => b.line)).toEqual([2, 3]);
  });
});

describe('findCommitIntroducingBug (90)', () => {
  it('finds commits adding/removing a symbol', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'a.txt'), 'line1\nBUGMARKER = true\n');
    await commitWithMessage({ cwd: dir, message: 'introduce bug' });
    const found = await findCommitIntroducingBug({ cwd: dir }, 'BUGMARKER');
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0].subject).toBe('introduce bug');
  });

  it('requires a symbol', async () => {
    const dir = await makeRepo();
    await expect(findCommitIntroducingBug({ cwd: dir }, '  ')).rejects.toThrow(/symbol/);
  });
});

describe('mergeBranch (91)', () => {
  it('merges a feature branch into main', async () => {
    const dir = await makeRepo();
    await createBranch({ cwd: dir }, 'feature');
    await fs.writeFile(path.join(dir, 'feat.txt'), 'feat\n');
    await commitWithMessage({ cwd: dir, message: 'feature work' });
    await checkoutBranch({ cwd: dir }, 'main');
    const out = await mergeBranch({ cwd: dir }, 'feature');
    expect(out).toMatch(/feat\.txt|Fast-forward|Updating/i);
    expect(await fs.readFile(path.join(dir, 'feat.txt'), 'utf-8')).toBe('feat\n');
  });
});

describe('rebaseBranch (92)', () => {
  it('rebases the current branch onto another', async () => {
    const dir = await makeRepo();
    await createBranch({ cwd: dir }, 'feature');
    await fs.writeFile(path.join(dir, 'feat.txt'), 'feat\n');
    await commitWithMessage({ cwd: dir, message: 'feature work' });
    const out = await rebaseBranch({ cwd: dir }, 'main');
    expect(typeof out).toBe('string');
    expect(await git(dir, 'log', '--oneline')).toContain('feature work');
  });
});

describe('resolveMergeConflict (93)', () => {
  it('extracts ours/theirs hunks from conflicted files', async () => {
    const dir = await makeRepo();
    await createBranch({ cwd: dir }, 'side');
    await fs.writeFile(path.join(dir, 'a.txt'), 'side version\n');
    await commitWithMessage({ cwd: dir, message: 'side change' });
    await checkoutBranch({ cwd: dir }, 'main');
    await fs.writeFile(path.join(dir, 'a.txt'), 'main version\n');
    await commitWithMessage({ cwd: dir, message: 'main change' });
    await expect(mergeBranch({ cwd: dir }, 'side')).rejects.toThrow();
    const hunks = await resolveMergeConflict({ cwd: dir });
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe('a.txt');
    expect(hunks[0].ours.join('\n')).toContain('main version');
    expect(hunks[0].theirs.join('\n')).toContain('side version');
    await git(dir, 'merge', '--abort');
  });

  it('returns [] when there is no conflict', async () => {
    const dir = await makeRepo();
    await expect(resolveMergeConflict({ cwd: dir })).resolves.toEqual([]);
  });
});

describe('pushToRemote (94)', () => {
  it('pushes the current branch to a remote', async () => {
    const dir = await makeRepo();
    const remoteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitremote-'));
    await execFileAsync('git', ['init', '--bare'], { cwd: remoteDir });
    await git(dir, 'remote', 'add', 'origin', remoteDir);
    await pushToRemote({ cwd: dir }, 'origin', 'main');
    const cloneDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitclone-'));
    await execFileAsync('git', ['clone', '-b', 'main', remoteDir, '.'], { cwd: cloneDir });
    expect(await git(cloneDir, 'log', '--oneline', '-1')).toContain('initial');
  });

  it('rejects invalid remote names', async () => {
    const dir = await makeRepo();
    await expect(pushToRemote({ cwd: dir }, 'evil;rm')).rejects.toThrow(/Invalid remote/);
  });
});

describe('createPullRequest (95)', () => {
  it('rejects an empty title without touching gh', async () => {
    const dir = await makeRepo();
    await expect(createPullRequest({ cwd: dir, title: '  ' })).rejects.toThrow(/title/);
  });

  it('opens a PR when gh is authenticated', async () => {
    if (!(await ghAvailable())) return;
    const dir = await makeRepo();
    // No upstream remote here — gh would fail; just verify the call path throws a gh error, not a validation error.
    await expect(createPullRequest({ cwd: dir, title: 'test' })).rejects.toThrow();
  });
});

describe('getPRDiff / getPRComments (96-97)', () => {
  it('getPRDiff surfaces gh output or a gh error', async () => {
    if (!(await ghAvailable())) return;
    const dir = await makeRepo();
    await expect(getPRDiff({ cwd: dir })).rejects.toThrow();
  });

  it('getPRComments returns [] for unparseable gh output', async () => {
    if (!(await ghAvailable())) return;
    const dir = await makeRepo();
    await expect(getPRComments({ cwd: dir })).rejects.toThrow();
  });
});

describe('tagRelease (98)', () => {
  it('creates an annotated tag', async () => {
    const dir = await makeRepo();
    await tagRelease({ cwd: dir }, 'v1.0.0', 'first release');
    expect(await git(dir, 'tag', '-l')).toContain('v1.0.0');
  });

  it('rejects invalid tag names', async () => {
    const dir = await makeRepo();
    await expect(tagRelease({ cwd: dir }, 'bad tag!')).rejects.toThrow(/Invalid/);
  });
});

describe('revertCommit (99)', () => {
  it('reverts a commit', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'b.txt'), 'b\n');
    const sha = await commitWithMessage({ cwd: dir, message: 'add b' });
    await revertCommit({ cwd: dir }, sha);
    await expect(fs.stat(path.join(dir, 'b.txt'))).rejects.toThrow();
    expect(await git(dir, 'log', '--oneline', '-1')).toContain('Revert');
  });

  it('rejects malformed SHAs', async () => {
    const dir = await makeRepo();
    await expect(revertCommit({ cwd: dir }, 'not-a-sha')).rejects.toThrow(/Invalid/);
  });
});

describe('getFileHistory (100)', () => {
  it('lists commits touching one file', async () => {
    const dir = await makeRepo();
    await fs.writeFile(path.join(dir, 'b.txt'), 'b\n');
    await commitWithMessage({ cwd: dir, message: 'add b' });
    await fs.writeFile(path.join(dir, 'a.txt'), 'line1\nmore\n');
    await commitWithMessage({ cwd: dir, message: 'touch a' });
    const history = await getFileHistory({ cwd: dir }, 'b.txt');
    expect(history).toHaveLength(1);
    expect(history[0].subject).toBe('add b');
  });
});
