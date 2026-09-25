import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * SandboxManager — "rehearse before you touch reality".
 *
 * A tiny sandbox directory (.agent/sandbox) that mirrors a slice of the
 * real workspace. Before mutating the real workspace, write/edit operations
 * can be rehearsed here:
 *
 *   prepare()   → snapshot the real file into the sandbox
 *   rehearse()  → apply the intended change INSIDE the sandbox
 *   verify()    → run an optional check (e.g. syntax grep) in the sandbox
 *   apply()     → copy the sandboxed result to the real file
 *   discard()   → throw the rehearsal away (failed verification / refusal)
 *
 * Every rehearsal is one small directory — cheap to create, trivial to
 * remove, and nothing outside .agent/sandbox is touched until the user
 * (human-in-the-loop) approves the apply.
 */

export interface Rehearsal {
  id: string;
  sandboxPath: string;
  realPath: string;
  relativePath: string;
  tool: string;
  /** Unified-diff-ish summary between real content and sandboxed content. */
  diffSummary: string;
  createdAt: Date;
}

export interface RehearsalCheck {
  /**
   * Return true to allow apply. Receives the sandboxed file content.
   * Throw or return false to discard the rehearsal.
   */
  (sandboxedContent: string): Promise<boolean> | boolean;
}

export class SandboxManager {
  private rehearsals = new Map<string, Rehearsal>();
  /** When true (auto mode), apply skips the human callback. */
  humanLoopEnabled = true;

  constructor(private readonly sandboxRootName = '.agent/sandbox') {}

  private sandboxRoot(workspaceRoot: string): string {
    return path.join(workspaceRoot, this.sandboxRootName);
  }

  /**
   * Rehearse a change inside the sandbox. `mutate` receives the sandbox
   * file path and performs the change there (same code path as the real
   * write, just pointed at the sandbox copy).
   */
  async rehearse(
    workspaceRoot: string,
    realPath: string,
    tool: string,
    mutate: (sandboxFilePath: string) => Promise<void>
  ): Promise<Rehearsal> {
    const relative = path.relative(workspaceRoot, realPath);
    const sandboxFile = path.join(this.sandboxRoot(workspaceRoot), relative);

    await fs.mkdir(path.dirname(sandboxFile), { recursive: true });

    // Snapshot current real content into the sandbox (no-op content if new).
    let original = '';
    try {
      original = await fs.readFile(realPath, 'utf-8');
    } catch {
      original = ''; // new file
    }
    await fs.writeFile(sandboxFile, original, 'utf-8');

    // Apply the intended change inside the sandbox only.
    await mutate(sandboxFile);

    const sandboxed = await fs.readFile(sandboxFile, 'utf-8');
    const id = crypto.randomBytes(6).toString('hex');
    const rehearsal: Rehearsal = {
      id,
      sandboxPath: sandboxFile,
      realPath,
      relativePath: relative,
      tool,
      diffSummary: this.diffSummary(original, sandboxed),
      createdAt: new Date(),
    };
    this.rehearsals.set(id, rehearsal);
    return rehearsal;
  }

  /** Run an arbitrary verification against the sandboxed content. */
  async verify(rehearsalId: string, check: RehearsalCheck): Promise<boolean> {
    const rehearsal = this.rehearsals.get(rehearsalId);
    if (!rehearsal) return false;
    try {
      const content = await fs.readFile(rehearsal.sandboxPath, 'utf-8');
      return await check(content);
    } catch {
      return false;
    }
  }

  /**
   * Human-in-the-loop gate + apply: copy sandboxed content onto the real
   * file. Returns the rehearsal on success.
   */
  async apply(
    workspaceRoot: string,
    rehearsalId: string,
    requestApproval?: (rehearsal: Rehearsal) => Promise<boolean>
  ): Promise<Rehearsal | null> {
    const rehearsal = this.rehearsals.get(rehearsalId);
    if (!rehearsal) return null;

    if (this.humanLoopEnabled && requestApproval) {
      const approved = await requestApproval(rehearsal);
      if (!approved) {
        await this.discard(rehearsalId);
        return null;
      }
    }

    const sandboxed = await fs.readFile(rehearsal.sandboxPath, 'utf-8');
    await fs.mkdir(path.dirname(rehearsal.realPath), { recursive: true });
    await fs.writeFile(rehearsal.realPath, sandboxed, 'utf-8');
    await this.discard(rehearsalId);
    return rehearsal;
  }

  /** Throw the rehearsal away and clean the sandbox slice. */
  async discard(rehearsalId: string): Promise<boolean> {
    const rehearsal = this.rehearsals.get(rehearsalId);
    if (!rehearsal) return false;
    try {
      await fs.rm(path.dirname(rehearsal.sandboxPath), { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
    this.rehearsals.delete(rehearsalId);
    return true;
  }

  /** Removes the whole sandbox directory (end of run cleanup). */
  async cleanup(workspaceRoot: string): Promise<void> {
    try {
      await fs.rm(this.sandboxRoot(workspaceRoot), { recursive: true, force: true });
    } catch {
      // best-effort
    }
    this.rehearsals.clear();
  }

  getRehearsal(id: string): Rehearsal | undefined {
    return this.rehearsals.get(id);
  }

  /** Compact, terminal-friendly before/after summary. */
  private diffSummary(before: string, after: string): string {
    if (before === after) return 'no changes';
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    const added = afterLines.filter(l => !beforeLines.includes(l)).length;
    const removed = beforeLines.filter(l => !afterLines.includes(l)).length;
    const parts: string[] = [];
    if (before === '') parts.push('new file');
    parts.push(`+${added} -${removed} lines`);
    const firstChange = afterLines.findIndex((l, i) => beforeLines[i] !== l);
    if (firstChange >= 0) parts.push(`first change at L${firstChange + 1}`);
    return parts.join(', ');
  }
}
