import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolExecution } from '../types/index.js';

/**
 * NoteSystem — structured notebook with four note kinds.
 *
 *  project    What the agent understands about THIS project: architecture,
 *             conventions, commands, naming style (auto-observed + agent
 *             written). Persistent across sessions.
 *  user       Facts about the USER and their preferences: "prefers concise
 *             reports", "wants Thai responses", "never touch .env".
 *  change     What was MODIFIED in each run: files changed, with one-line
 *             summaries. Session-scoped, appended per run.
 *  bug        Bugs and errors ENCOUNTERED: error text (truncated), likely
 *             cause, fix applied or open status. Invaluable on long runs.
 *
 * Storage layout (plain markdown the user can read/edit):
 *   .agent/memory/project.md   ← project + user notes (persistent layers)
 *   .agent/memory/notes/changes.md   ← change log (per workspace)
 *   .agent/memory/notes/bugs.md      ← bug log (per workspace)
 *
 * Secrets are rejected with the same pattern used by project_memory.
 */

export type NoteKind = 'project' | 'user' | 'change' | 'bug';

export interface Note {
  kind: NoteKind;
  content: string;
}

export interface NoteTakerOptions {
  /** Max notes appended per flush, per kind (keeps memory dense). */
  maxPerKind?: number;
}

const SECRET_PATTERN = /(api[_-]?key|access[_-]?token|secret|password|private[_-]?key)\s*[:=]/i;

const SECTION_HEADERS: Record<NoteKind, string> = {
  project: '## Project understanding',
  user: '## Notes about the user',
  change: '## Change log (auto-recorded)',
  bug: '## Bug & error log',
};

const AUTO_HEADER = '## Project conventions (auto-observed)';

export class NoteSystem {
  private readonly maxPerKind: number;
  private pending: Note[] = [];
  /** Auto-observed convention facts (deduped, written to project layer). */
  private autoFacts = new Set<string>();

  constructor(options: NoteTakerOptions = {}) {
    this.maxPerKind = Math.max(1, options.maxPerKind ?? 5);
  }

  // -------------------------------------------------------------------------
  // Agent-facing API (exposed through project_memory action="note")
  // -------------------------------------------------------------------------

  /** Record a note. Returns false when the content is invalid. */
  note(kind: NoteKind, content: string): boolean {
    const text = content.trim();
    if (!text || text.length > 500) return false;
    if (SECRET_PATTERN.test(text)) return false;
    this.pending.push({ kind, content: text });
    return true;
  }

  // -------------------------------------------------------------------------
  // Auto-observation (same signals as before, now classified)
  // -------------------------------------------------------------------------

  /** Feed every successful tool execution here (cheap, no IO). */
  observe(execution: ToolExecution): void {
    if (!execution.result?.success) return;
    const tool = execution.tool;
    const input = (execution.input ?? {}) as Record<string, unknown>;

    if (tool === 'shell') {
      this.observeShell(String(input.command ?? ''));
    } else if (tool === 'read_file' || tool === 'edit_file' || tool === 'write_file') {
      this.observeFile(String(input.path ?? ''));
    } else if (tool === 'search_code' && input.filePattern) {
      this.autoFacts.add(`Primary code language: files matched via ${String(input.filePattern)}`);
    }
  }

  /** Record a change entry (called by the Agent after edits). */
  observeChange(tool: string, filePath: string, detail: string): void {
    const file = String(filePath ?? '').replace(/\\/g, '/');
    this.pending.push({ kind: 'change', content: `${tool}: ${file} — ${detail}`.slice(0, 300) });
  }

  /** Record a bug entry (called by the Agent when tools fail). */
  observeBug(source: string, error: string, resolution?: string): void {
    const err = error.replace(/\s+/g, ' ').trim().slice(0, 160);
    this.pending.push({
      kind: 'bug',
      content: `[${source}] ${err}${resolution ? ` → fix: ${resolution}` : ' → unresolved'}`,
    });
  }

  private observeShell(command: string): void {
    const cmd = command.trim();
    if (!cmd) return;
    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?test/.test(cmd) || /\bpytest\b/.test(cmd)) {
      this.autoFacts.add('Test command in use: `' + cmd.slice(0, 60) + '`');
    } else if (/\btsc\b/.test(cmd)) {
      this.autoFacts.add('Typecheck command in use: `' + cmd.slice(0, 60) + '`');
    } else if (/\b(eslint|ruff|pylint)\b/.test(cmd)) {
      this.autoFacts.add('Lint command in use: `' + cmd.slice(0, 60) + '`');
    }
    if (/\bpnpm\b/.test(cmd)) this.autoFacts.add('Package manager: pnpm');
    else if (/\byarn\b/.test(cmd)) this.autoFacts.add('Package manager: yarn');
    else if (/\bbun\b/.test(cmd)) this.autoFacts.add('Package manager: bun');
    else if (/\bnpm (install|i|ci)\b/.test(cmd)) this.autoFacts.add('Package manager: npm');
  }

  private observeFile(filePath: string): void {
    if (!filePath) return;
    const normalized = filePath.replace(/\\/g, '/');
    if (/(__tests__|\.test\.|\.spec\.)/.test(normalized)) {
      this.autoFacts.add('Tests live next to or under tests/ using *.test.*/*_test.* naming');
    }
    if (/(^|\/)tsconfig\.(json|.*\.json)$/.test(normalized)) {
      this.autoFacts.add('TypeScript project (tsconfig present)');
    }
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Writes all pending notes and auto-facts. Safe to call multiple times;
   * only new lines are appended. Returns what was actually written.
   */
  async flush(workspaceRoot: string): Promise<string[]> {
    const written: string[] = [];
    const memoryDir = path.join(workspaceRoot, '.agent', 'memory');

    // Auto-observed conventions → project layer.
    if (this.autoFacts.size > 0) {
      const facts = Array.from(this.autoFacts).slice(0, 4);
      const appended = await this.appendLines(
        path.join(memoryDir, 'project.md'),
        AUTO_HEADER,
        facts
      );
      written.push(...appended.map(f => `project(auto): ${f}`));
    }
    this.autoFacts.clear();

    // Group pending notes by kind.
    const byKind: Record<NoteKind, string[]> = { project: [], user: [], change: [], bug: [] };
    for (const note of this.pending) byKind[note.kind].push(note.content);

    // project + user → persistent layer files.
    const projectNotes = byKind.project.slice(0, this.maxPerKind);
    if (projectNotes.length) {
      const appended = await this.appendLines(
        path.join(memoryDir, 'project.md'),
        SECTION_HEADERS.project,
        projectNotes
      );
      written.push(...appended.map(f => `project: ${f}`));
    }
    const userNotes = byKind.user.slice(0, this.maxPerKind);
    if (userNotes.length) {
      const appended = await this.appendLines(
        path.join(memoryDir, 'project.md'),
        SECTION_HEADERS.user,
        userNotes
      );
      written.push(...appended.map(f => `user: ${f}`));
    }

    // change + bug → dedicated log files.
    const changeNotes = byKind.change.slice(0, this.maxPerKind * 2);
    if (changeNotes.length) {
      const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const lines = changeNotes.map(c => `- [${stamp}] ${c}`);
      const appended = await this.appendLines(
        path.join(memoryDir, 'notes', 'changes.md'),
        SECTION_HEADERS.change,
        lines,
        { dedupe: false }
      );
      written.push(...appended.map(f => `change: ${f}`));
    }
    const bugNotes = byKind.bug.slice(0, this.maxPerKind * 2);
    if (bugNotes.length) {
      const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const lines = bugNotes.map(c => `- [${stamp}] ${c}`);
      const appended = await this.appendLines(
        path.join(memoryDir, 'notes', 'bugs.md'),
        SECTION_HEADERS.bug,
        lines,
        { dedupe: false }
      );
      written.push(...appended.map(f => `bug: ${f}`));
    }

    this.pending = [];
    return written;
  }

  /**
   * Reads every layer for the boot-time snapshot injected into the system
   * prompt (project understanding, user notes, recent changes, recent bugs).
   */
  async readForBoot(workspaceRoot: string, maxChars = 4000): Promise<string> {
    const memoryDir = path.join(workspaceRoot, '.agent', 'memory');
    const parts: string[] = [];
    const add = async (label: string, filePath: string) => {
      try {
        const content = (await fs.readFile(filePath, 'utf-8')).trim();
        if (content) parts.push(`[${label}]\n${content}`);
      } catch {
        /* absent file is fine */
      }
    };
    await add('project memory', path.join(memoryDir, 'project.md'));
    await add('change log (recent)', path.join(memoryDir, 'notes', 'changes.md'));
    await add('bug log (recent)', path.join(memoryDir, 'notes', 'bugs.md'));

    try {
      const home = process.env.HOME || process.env.USERPROFILE || '/root';
      const globalContent = (
        await fs.readFile(path.join(home, '.agent', 'memory', 'global.md'), 'utf-8')
      ).trim();
      if (globalContent) parts.push(`[global memory]\n${globalContent}`);
    } catch {
      /* absent is fine */
    }

    return parts.join('\n\n').slice(0, maxChars);
  }

  private async appendLines(
    filePath: string,
    sectionHeader: string,
    lines: string[],
    options: { dedupe?: boolean } = {}
  ): Promise<string[]> {
    const dedupe = options.dedupe !== false;
    let existing = '';
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      existing = '';
    }
    const existingLines = new Set(
      existing
        .split('\n')
        .map(l => l.trim().replace(/^[-*]\s+/, '').toLowerCase())
    );
    const fresh = dedupe
      ? lines.filter(l => {
          const key = l.replace(/^-\s*\[[^\]]*\]\s*/, '').trim().toLowerCase();
          return !existingLines.has(key) && !existingLines.has(l.trim().toLowerCase());
        })
      : lines;
    if (fresh.length === 0) return [];

    let output = existing;
    if (!output.includes(sectionHeader)) {
      output = output.trim() ? output.trimEnd() + `\n\n${sectionHeader}\n` : `${sectionHeader}\n`;
    }
    output = output.trimEnd() + '\n' + fresh.join('\n') + '\n';

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, output, 'utf-8');
      return fresh;
    } catch {
      return [];
    }
  }

  /** Test hook. */
  peekPending(): string[] {
    return this.pending.map(n => `${n.kind}: ${n.content}`);
  }
}
