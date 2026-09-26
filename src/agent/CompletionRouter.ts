import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CompletionRouter — decides whether a chore is small enough to hand to a
 * lightweight fast model (add a missing import, fix a typo, rename a local)
 * so the main agent does not burn its iteration budget on small stuff.
 */

export interface CompletionRequest {
  /** The small code task: "add missing import", "rename local var", … */
  instruction: string;
  /** File the completion applies to (workspace-relative). */
  filePath: string;
  /** Optional hint: nearby code the completion must fit with. */
  context?: string;
}

export interface CompletionRoute {
  /** 'completion-model' = tiny task routed to the fast model; 'main-agent' = keep it here. */
  target: 'completion-model' | 'main-agent';
  reason: string;
}

export type MiniCompleter = (request: CompletionRequest) => Promise<string>;

const SMALL_TASK_PATTERNS: RegExp[] = [
  /\b(missing|fix|add)\b.{0,24}\b(import|export)\b/i,
  /\b(import|export)\b.{0,24}\b(missing|add|fix)\b/i,
  /\btypo\b/i,
  /\brename\b.{0,24}\b(variable|function|local)\b/i,
  /\bfix\b.{0,24}\b(syntax|lint|warning)\b/i,
  /\b(add|write)\b.{0,24}\b(javadoc|docstring|comment|type annotation)\b/i,
  /\bformat\b.{0,20}\bfile\b/i,
  /\bremove\b.{0,24}\bunused\b/i,
];

const BIG_TASK_PATTERNS: RegExp[] = [
  /\b(refactor|rewrite|migrat|architecture|redesign|multi-?file|api|database|schema|auth)\b/i,
  /\b(test suite|integration|end-to-end)\b/i,
];

export class CompletionRouter {
  private readonly completer: MiniCompleter | null;
  private readonly maxLines: number;

  constructor(options: { completer?: MiniCompleter | null; maxLines?: number } = {}) {
    this.completer = options.completer ?? null;
    this.maxLines = options.maxLines ?? 40;
  }

  /** Classify a task: tiny completion chore or real agent work? */
  route(request: CompletionRequest): CompletionRoute {
    const text = `${request.instruction} ${request.context ?? ''}`;
    if (BIG_TASK_PATTERNS.some(p => p.test(text))) {
      return { target: 'main-agent', reason: 'task is structural — needs full agent reasoning' };
    }
    if (!SMALL_TASK_PATTERNS.some(p => p.test(text))) {
      return { target: 'main-agent', reason: 'task is not a small completion chore' };
    }
    if (!this.completer) {
      return { target: 'main-agent', reason: 'no completion model configured' };
    }
    return { target: 'completion-model', reason: 'tiny, well-scoped completion — fast model is enough' };
  }

  /**
   * Applies a small completion to a file: reads the file, asks the mini
   * model for the edited content, and returns the result. The caller (agent)
   * stays responsible for permission checks and note-taking.
   */
  async apply(request: CompletionRequest, workspaceRoot: string): Promise<{ routed: CompletionRoute; result?: string; error?: string }> {
    const routed = this.route(request);
    if (routed.target !== 'completion-model' || !this.completer) {
      return { routed };
    }
    try {
      const abs = path.join(workspaceRoot, request.filePath);
      const content = await fs.readFile(abs, 'utf-8');
      const edited = await this.completer({
        ...request,
        context: (request.context ? request.context + '\n\n' : '') + content.slice(0, 8000),
      });
      if (typeof edited !== 'string' || edited.length === 0) {
        return { routed: { ...routed, reason: routed.reason + ' (completion model returned empty)' }, error: 'empty completion result' };
      }
      return { routed, result: edited };
    } catch (error) {
      return { routed, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
