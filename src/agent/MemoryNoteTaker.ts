import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolExecution } from '../types/index.js';

/**
 * MemoryNoteTaker — the agent's automatic notebook.
 *
 * While the agent works, every tool execution flows through `observe()`.
 * From cheap, deterministic signals (which files were touched, which test
 * command actually ran green, which package manager a shell command used)
 * it distills durable facts about the project and writes them once, at the
 * end of the run, into the project memory layer (.agent/memory/project.md).
 *
 * Design goals:
 *   - zero extra model calls (pure pattern matching on executions)
 *   - idempotent per session (dedup against existing memory lines)
 *   - never stores secrets; only structural facts about the project
 */

export interface NoteTakerOptions {
  /** Max notes appended per run (keeps memory dense, not chatty). */
  maxNotesPerRun?: number;
}

const SECTION_HEADER = '## Project conventions (auto-observed)';

export class MemoryNoteTaker {
  private readonly maxNotesPerRun: number;
  private pending = new Set<string>();

  constructor(options: NoteTakerOptions = {}) {
    this.maxNotesPerRun = Math.max(1, options.maxNotesPerRun ?? 4);
  }

  /** Feed every finished tool execution here (cheap, no IO). */
  observe(execution: ToolExecution): void {
    if (!execution.result?.success) return;
    const tool = execution.tool;
    const input = (execution.input ?? {}) as Record<string, unknown>;

    if (tool === 'shell') {
      this.observeShell(String(input.command ?? ''));
    } else if (tool === 'read_file' || tool === 'edit_file' || tool === 'write_file') {
      this.observeFile(String(input.path ?? ''));
    } else if (tool === 'search_code' && input.filePattern) {
      this.pending.add(`Primary code language: files matched via ${String(input.filePattern)}`);
    }
  }

  private observeShell(command: string): void {
    const cmd = command.trim();
    if (!cmd) return;
    // Which command runs the tests (only when it evidently passed).
    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?test/.test(cmd)) {
      this.pending.add('Test command in use: `' + cmd.slice(0, 60) + '`');
    } else if (/\b(pytest|pytest-3)\b/.test(cmd)) {
      this.pending.add('Test command in use: `' + cmd.slice(0, 60) + '`');
    } else if (/\btsc\b/.test(cmd)) {
      this.pending.add('Typecheck command in use: `' + cmd.slice(0, 60) + '`');
    } else if (/\b(eslint|ruff|pylint)\b/.test(cmd)) {
      this.pending.add('Lint command in use: `' + cmd.slice(0, 60) + '`');
    }
    // Package manager detection.
    if (/\bpnpm\b/.test(cmd)) this.pending.add('Package manager: pnpm');
    else if (/\byarn\b/.test(cmd)) this.pending.add('Package manager: yarn');
    else if (/\bbun\b/.test(cmd)) this.pending.add('Package manager: bun');
    else if (/\bnpm (install|i|ci)\b/.test(cmd)) this.pending.add('Package manager: npm');
  }

  private observeFile(filePath: string): void {
    if (!filePath) return;
    const normalized = filePath.replace(/\\/g, '/');
    // Test layout convention.
    if (/(__tests__|\.test\.|\.spec\.)/.test(normalized)) {
      this.pending.add('Tests live next to or under tests/ using *.test.*/*_test.* naming');
    }
    // TypeScript strictness signal.
    if (/(^|\/)tsconfig\.(json|.*\.json)$/.test(normalized)) {
      this.pending.add('TypeScript project (tsconfig present)');
    }
  }

  /**
   * Writes pending notes into the project memory layer. Called once at the
   * end of a run. Deduplicates against lines already in the file.
   */
  async flush(workspaceRoot: string): Promise<string[]> {
    if (this.pending.size === 0) return [];
    const notes = Array.from(this.pending).slice(0, this.maxNotesPerRun);
    const memoryPath = path.join(workspaceRoot, '.agent', 'memory', 'project.md');

    try {
      let existing = '';
      try {
        existing = await fs.readFile(memoryPath, 'utf-8');
      } catch {
        existing = '';
      }
      // Strip bullet prefixes so stored lines compare equal to fresh notes.
      const existingLines = new Set(
        existing.split('\n').map(l => l.trim().replace(/^[-*]\s+/, '').toLowerCase())
      );
      const fresh = notes.filter(n => !existingLines.has(n.trim().toLowerCase()));
      if (fresh.length === 0) return [];

      let output = existing;
      if (!output.includes(SECTION_HEADER)) {
        output = output.trim()
          ? output.trimEnd() + `\n\n${SECTION_HEADER}\n`
          : `${SECTION_HEADER}\n`;
      }
      output = output.trimEnd() + '\n' + fresh.map(n => `- ${n}`).join('\n') + '\n';

      await fs.mkdir(path.dirname(memoryPath), { recursive: true });
      await fs.writeFile(memoryPath, output, 'utf-8');
      return fresh;
    } catch {
      return []; // memory write is best-effort; never fail the run over it
    } finally {
      this.pending.clear();
    }
  }

  /** Test hook: inspect what would be flushed without writing. */
  peekPending(): string[] {
    return Array.from(this.pending);
  }
}
