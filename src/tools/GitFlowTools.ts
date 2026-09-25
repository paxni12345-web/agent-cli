import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolContext, ToolResult } from '../types/index.js';
import { runCaptured, truncateOutput } from './ShellTool.js';
import { SecretScanner } from '../agent/SecretScanner.js';

/**
 * Git & Version Control tools (group 4). Every mutation runs through the
 * permission manager AND the security pipeline (L1 guard blocks force push /
 * history rewrite patterns before we ever get here).
 */

type Input = Record<string, unknown>;
const str = (input: Input, key: string): string => String(input[key] ?? '');

async function allowGit(context: ToolContext, description: string, risk: 'safe' | 'low' | 'medium' | 'high'): Promise<ToolResult | null> {
  const permission = await context.permissions.check({ type: 'execute_command', description, risk });
  if (permission.allowed === false) return { success: false, error: `Permission denied: ${permission.reason}` };
  return null;
}

/** Commit-message generation from the diff (deterministic template). */
function draftCommitMessage(statusOut: string, diffOut: string): string {
  const files = [...statusOut.matchAll(/^\s*M\s+(.+)$/gm)].map(m => m[1].trim());
  const staged = [...statusOut.matchAll(/^M\s+(.+)$/gm)].map(m => m[1].trim());
  const touched = (staged.length ? staged : files).slice(0, 5);
  const additions = (diffOut.match(/^\+[^+]/gm) ?? []).length;
  const removals = (diffOut.match(/^-[^-]/gm) ?? []).length;
  const verb = removals > additions * 2 ? 'Refactor' : additions > removals * 2 ? 'Add' : 'Update';
  return `${verb} ${touched.length ? touched.join(', ') : 'workspace files'} (+${additions}/-${removals})`;
}

// 27. git_branch ---------------------------------------------------------------

export class GitBranchTool implements Tool {
  name = 'git_branch';
  description = 'Create, switch, or list git branches. action: "list" (default) | "create" | "switch".';
  inputSchema = { type: 'object', properties: { action: { type: 'string' }, name: { type: 'string' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const action = str(input, 'action') || 'list';
      if (action === 'list') {
        const r = await runCaptured('git branch -a --sort=-committerdate', { cwd: ws, timeout: 15000 });
        return { success: r.ok, output: truncateOutput(r.stdout.trim() || r.stderr.trim(), 40), metadata: { exitCode: r.exitCode } };
      }
      const name = str(input, 'name');
      if (!name) return { success: false, error: 'name is required for create/switch' };
      if (!/^[A-Za-z0-9._\-/]+$/.test(name)) return { success: false, error: 'Invalid branch name' };
      const command = action === 'create' ? `git checkout -b ${name}` : `git checkout ${name}`;
      const denied = await allowGit(context, command, action === 'create' ? 'medium' : 'low');
      if (denied) return denied;
      const r = await runCaptured(command, { cwd: ws, timeout: 15000 });
      return { success: r.ok, output: r.ok ? `Branch '${name}' ${action === 'create' ? 'created and checked out' : 'checked out'} ✓` : truncateOutput(r.stderr, 20), metadata: { exitCode: r.exitCode } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 28. git_commit ---------------------------------------------------------------

export class GitCommitTool implements Tool {
  name = 'git_commit';
  description = 'Stage and commit changes. Generates a commit message from the diff when none is provided (dryRun=true previews it).';
  inputSchema = { type: 'object', properties: { message: { type: 'string', description: 'omit to auto-generate' }, paths: { type: 'array', items: { type: 'string' }, description: 'stage only these paths (default: all changes)' }, dryRun: { type: 'boolean' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const denied = await allowGit(context, 'Create a git commit', 'medium');
      if (denied) return denied;
      const paths = Array.isArray(input.paths) ? (input.paths as unknown[]).map(String) : null;
      if (paths?.length) {
        const add = await runCaptured(`git add ${paths.map(p => `"${p}"`).join(' ')}`, { cwd: ws, timeout: 15000 });
        if (!add.ok) return { success: false, error: truncateOutput(add.stderr, 15) };
      } else {
        const add = await runCaptured('git add -A', { cwd: ws, timeout: 15000 });
        if (!add.ok) return { success: false, error: truncateOutput(add.stderr, 15) };
      }
      const status = await runCaptured('git status --short', { cwd: ws, timeout: 15000 });
      const diff = await runCaptured('git diff --cached --stat', { cwd: ws, timeout: 15000 });
      if (!status.stdout.trim()) return { success: true, output: 'Nothing to commit (working tree clean after staging)' };
      const message = str(input, 'message') || draftCommitMessage(status.stdout, diff.stdout);
      if (input.dryRun === true) {
        return { success: true, output: `DRY RUN — would commit:\n\n${message}\n\nStaged files:\n${truncateOutput(status.stdout, 20)}`, metadata: { dryRun: true, message } };
      }
      // ---- Item 31: secret scanning before every real commit.
      const scanner = new SecretScanner();
      const staged = await runCaptured('git diff --cached --name-only', { cwd: ws, timeout: 15000 });
      const stagedFiles = staged.stdout.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 100);
      const contents: Array<{ path: string; content: string }> = [];
      for (const rel of stagedFiles) {
        try {
          const abs = path.resolve(ws, rel);
          if (!abs.startsWith(path.resolve(ws))) continue; // workspace-only
          const stat = await fs.stat(abs);
          if (stat.size > 400_000) continue; // skip huge files
          contents.push({ path: rel, content: await fs.readFile(abs, 'utf-8') });
        } catch { /* unreadable — skip */ }
      }
      const blockers = await scanner.scanFilesForCommit(contents);
      if (blockers.length) {
        return { success: false, error: `COMMIT BLOCKED — suspected secrets in staged changes:\n${blockers.slice(0, 10).join('\n')}\nRemove the secrets (or add legitimate values via environment variables) and try again.`, metadata: { blocked: 'secret-scan', count: blockers.length } };
      }
      const r = await runCaptured(`git commit -m ${JSON.stringify(message)}`, { cwd: ws, timeout: 30000 });
      return { success: r.ok, output: r.ok ? `Committed ✓\n\n${message}` : truncateOutput(r.stderr, 20), metadata: { exitCode: r.exitCode, message } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 29. git_stash ----------------------------------------------------------------

export class GitStashTool implements Tool {
  name = 'git_stash';
  description = 'Stash or pop working-directory changes. action: "push" | "pop" | "list".';
  inputSchema = { type: 'object', properties: { action: { type: 'string' }, message: { type: 'string' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const action = str(input, 'action') || 'push';
      const command = action === 'pop' ? 'git stash pop' : action === 'list' ? 'git stash list' : `git stash push -m ${JSON.stringify(str(input, 'message') || 'agent stash')}`;
      const denied = await allowGit(context, command, action === 'pop' ? 'medium' : 'low');
      if (denied) return denied;
      const r = await runCaptured(command, { cwd: ws, timeout: 30000 });
      return { success: r.ok, output: truncateOutput((r.stdout + '\n' + r.stderr).trim() || '(empty)', 40), metadata: { exitCode: r.exitCode } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 30. git_blame ----------------------------------------------------------------

export class GitBlameTool implements Tool {
  name = 'git_blame';
  description = 'Show who last modified each line of a file (git blame), optionally limited to a line range.';
  inputSchema = { type: 'object', properties: { path: { type: 'string' }, from: { type: 'number' }, to: { type: 'number' } }, required: ['path'] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const file = str(input, 'path');
      const range = input.from && input.to ? ` -L ${Number(input.from)},${Number(input.to)}` : '';
      const r = await runCaptured(`git blame${range} -- ${JSON.stringify(file)}`, { cwd: ws, timeout: 20000 });
      return { success: r.ok, output: truncateOutput((r.stdout || r.stderr).trim(), 80), metadata: { exitCode: r.exitCode } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 31. git_conflict_resolver ----------------------------------------------------

export class GitConflictResolverTool implements Tool {
  name = 'git_conflict_resolver';
  description = 'List files with merge conflicts and extract each conflict hunk (ours vs theirs) so the agent can decide the resolution.';
  inputSchema = { type: 'object', properties: {}, required: [] };

  async execute(_input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const status = await runCaptured('git status --short', { cwd: ws, timeout: 15000 });
      const conflicted = status.stdout.split('\n').filter(l => /^(UU|AA|DD|AU|UA|DU|UD)/.test(l)).map(l => l.slice(3).trim());
      if (!conflicted.length) return { success: true, output: 'No merge conflicts in progress ✓' };
      const report: string[] = [`Conflicted files (${conflicted.length}): ${conflicted.join(', ')}`];
      for (const file of conflicted.slice(0, 8)) {
        let source: string;
        try { source = await fs.readFile(path.resolve(ws, file), 'utf-8'); } catch { continue; }
        const lines = source.split('\n');
        let hunks = 0;
        for (let i = 0; i < lines.length && hunks < 5; i++) {
          if (!lines[i].startsWith('<<<<<<<')) continue;
          const ours: string[] = []; const theirs: string[] = [];
          let mode: 'ours' | 'theirs' = 'ours';
          let j = i + 1;
          for (; j < lines.length && !lines[j].startsWith('>>>>>>>'); j++) {
            if (lines[j].startsWith('=======')) { mode = 'theirs'; continue; }
            (mode === 'ours' ? ours : theirs).push(lines[j]);
          }
          report.push(`\n${file} hunk at line ${i + 1}:\n  OURS:\n${ours.slice(0, 8).map(l => '    ' + l).join('\n') || '    (empty)'}\n  THEIRS:\n${theirs.slice(0, 8).map(l => '    ' + l).join('\n') || '    (empty)'}`);
          i = j; hunks++;
        }
      }
      return { success: true, output: report.join('\n').slice(0, 4000), metadata: { files: conflicted.length } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 32. create_pull_request ------------------------------------------------------

export class CreatePullRequestTool implements Tool {
  name = 'create_pull_request';
  description = 'Open a pull request via the GitHub CLI (gh). Requires gh to be authenticated. dryRun prints the PR body instead.';
  inputSchema = { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, base: { type: 'string', description: 'target branch, default repository default' }, dryRun: { type: 'boolean' } }, required: ['title'] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const title = str(input, 'title');
      const body = str(input, 'body') || '(no description provided)';
      if (input.dryRun === true) {
        return { success: true, output: `DRY RUN — PR body:\n\nTitle: ${title}\n\n${body}`, metadata: { dryRun: true } };
      }
      const denied = await allowGit(context, `Open pull request "${title}"`, 'high');
      if (denied) return denied;
      const ghCheck = await runCaptured('gh auth status', { cwd: ws, timeout: 15000 });
      if (!ghCheck.ok) return { success: false, error: 'GitHub CLI (gh) is not installed or not authenticated — run `gh auth login` first' };
      const base = str(input, 'base');
      const args = ['gh', 'pr', 'create', '--title', title, '--body', body];
      if (base) args.push('--base', base);
      const { parseCommand, runShellCommand } = await import('./ShellTool.js');
      const r = await runShellCommand(parseCommand(args.map(a => JSON.stringify(a)).join(' ')).program ? args.join(' ') : args.join(' '), { cwd: ws, timeout: 60000 });
      void parseCommand;
      const url = r.stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
      return { success: true, output: url ? `PR created: ${url}` : truncateOutput((r.stdout + r.stderr).trim(), 20), metadata: { url } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 33. review_pr ----------------------------------------------------------------

export class ReviewPrTool implements Tool {
  name = 'review_pr';
  description = 'Fetch a pull request diff (gh pr diff) and surface hotspots: large files, likely risk areas, missing tests.';
  inputSchema = { type: 'object', properties: { number: { type: 'string', description: 'PR number (uses current branch PR when omitted)' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const number = str(input, 'number');
      const command = number ? `gh pr diff ${number}` : 'gh pr diff';
      const r = await runCaptured(command, { cwd: ws, timeout: 30000 });
      if (!r.ok) return { success: false, error: truncateOutput(r.stderr, 15) };
      const diff = r.stdout;
      const files = [...new Set([...diff.matchAll(/^diff --git a\/(\S+)/gm)].map(m => m[1]))];
      const additions = (diff.match(/^\+[^+]/gm) ?? []).length;
      const removals = (diff.match(/^-[^-]/gm) ?? []).length;
      const risky = files.filter(f => /auth|security|payment|migration|schema|deploy|config|env/i.test(f));
      const testsTouched = files.some(f => /\.test\.|\.spec\.|__tests__/i.test(f));
      return { success: true, output:
        `PR diff: ${files.length} file(s), +${additions}/-${removals}\n\nFiles:\n${files.slice(0, 25).map(f => '  ' + f).join('\n')}` +
        (risky.length ? `\n\n⚠ Risk-sensitive files touched: ${risky.join(', ')}` : '') +
        (testsTouched ? '' : '\n\n⚠ No test files touched by this PR') +
        `\n\nDiff head:\n${truncateOutput(diff, 60)}`,
        metadata: { files: files.length, additions, removals } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 34. bisect_helper ------------------------------------------------------------

export class BisectHelperTool implements Tool {
  name = 'bisect_helper';
  description = 'Interrogate git history: commits touching a file, authors, or the last commit that changed a symbol. (Guided git bisect scaffold.)';
  inputSchema = { type: 'object', properties: { path: { type: 'string', description: 'limit history to a file' }, symbol: { type: 'string', description: 'find commits where this symbol appeared/disappeared' }, maxCommits: { type: 'number' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const max = Math.min(Number(input.maxCommits) || 20, 100);
      const file = str(input, 'path');
      const base = `git log --oneline -n ${max}${file ? ` -- ${JSON.stringify(file)}` : ''}`;
      const r = await runCaptured(base, { cwd: ws, timeout: 20000 });
      if (!r.ok) return { success: false, error: truncateOutput(r.stderr, 15) };
      let output = `Recent commits${file ? ` touching ${file}` : ''}:\n${truncateOutput(r.stdout.trim(), max)}`;
      const symbol = str(input, 'symbol');
      if (symbol) {
        const pick = await runCaptured(`git log --all -S ${JSON.stringify(symbol)} --oneline -n ${max}`, { cwd: ws, timeout: 30000 });
        output += `\n\nCommits adding/removing '${symbol}':\n` + truncateOutput(pick.stdout.trim() || '(none)', max);
      }
      return { success: true, output, metadata: { commits: r.stdout.trim().split('\n').length } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

export const GIT_FLOW_TOOLS: Tool[] = [
  new GitBranchTool(), new GitCommitTool(), new GitStashTool(), new GitBlameTool(),
  new GitConflictResolverTool(), new CreatePullRequestTool(), new ReviewPrTool(), new BisectHelperTool(),
];
