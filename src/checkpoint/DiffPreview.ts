/**
 * DiffPreview — dependency-free unified diff for approval prompts.
 *
 * Checklist items: "แสดง diff ก่อนให้ user approve การแก้ไฟล์" and
 * "write_file ต้อง diff/preview ก่อน overwrite ไฟล์เดิม".
 *
 * A human approving a write should see what actually changes, not a byte
 * count. This produces a standard unified diff (with context) that reads the
 * same way `git diff` does, without pulling in a diff library.
 */

export interface DiffOptions {
  /** Lines of unchanged context around each change (default 3). */
  context?: number;
  /** Maximum rendered lines before truncation (default 200). */
  maxLines?: number;
  /** File label shown in the `---`/`+++` header. */
  path?: string;
}

export interface DiffResult {
  /** Unified diff text (empty when there is no change). */
  text: string;
  added: number;
  removed: number;
  /** True when output was truncated to `maxLines`. */
  truncated: boolean;
  /** True when the two inputs are identical. */
  identical: boolean;
}

type Op = { type: 'equal' | 'insert' | 'delete'; line: string; aIndex: number; bIndex: number };

/**
 * Longest-common-subsequence line diff. Falls back to a whole-file replace
 * when the inputs are large enough that the quadratic table would hurt.
 */
function buildOps(a: string[], b: string[]): Op[] {
  const maxCells = 4_000_000; // ~2000x2000 lines
  if (a.length * b.length > maxCells) {
    const ops: Op[] = [];
    a.forEach((line, i) => ops.push({ type: 'delete', line, aIndex: i, bIndex: -1 }));
    b.forEach((line, i) => ops.push({ type: 'insert', line, aIndex: -1, bIndex: i }));
    return ops;
  }

  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i..], b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', line: a[i], aIndex: i, bIndex: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'delete', line: a[i], aIndex: i, bIndex: -1 });
      i++;
    } else {
      ops.push({ type: 'insert', line: b[j], aIndex: -1, bIndex: j });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'delete', line: a[i], aIndex: i++, bIndex: -1 });
  while (j < m) ops.push({ type: 'insert', line: b[j], aIndex: -1, bIndex: j++ });
  return ops;
}

/** Group ops into hunks with context, the way a unified diff is presented. */
function buildHunks(ops: Op[], context: number): Op[][] {
  const changed = ops
    .map((op, index) => ({ op, index }))
    .filter(entry => entry.op.type !== 'equal')
    .map(entry => entry.index);

  if (changed.length === 0) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  let start = Math.max(0, changed[0] - context);
  let end = Math.min(ops.length - 1, changed[0] + context);

  for (const index of changed.slice(1)) {
    if (index - context <= end + 1) {
      end = Math.min(ops.length - 1, index + context);
    } else {
      ranges.push({ start, end });
      start = Math.max(0, index - context);
      end = Math.min(ops.length - 1, index + context);
    }
  }
  ranges.push({ start, end });

  return ranges.map(range => ops.slice(range.start, range.end + 1));
}

export class DiffPreview {
  private readonly context: number;
  private readonly maxLines: number;

  constructor(options: { context?: number; maxLines?: number } = {}) {
    this.context = Math.max(0, options.context ?? 3);
    this.maxLines = Math.max(10, options.maxLines ?? 200);
  }

  /** Build a unified diff between two texts. */
  diff(before: string, after: string, options: DiffOptions = {}): DiffResult {
    const context = options.context ?? this.context;
    const maxLines = options.maxLines ?? this.maxLines;
    const label = options.path ?? 'file';

    if (before === after) {
      return { text: '', added: 0, removed: 0, truncated: false, identical: true };
    }

    const a = before.split('\n');
    const b = after.split('\n');
    const ops = buildOps(a, b);
    const hunks = buildHunks(ops, context);

    const added = ops.filter(op => op.type === 'insert').length;
    const removed = ops.filter(op => op.type === 'delete').length;

    const out: string[] = [`--- a/${label}`, `+++ b/${label}`];
    let emitted = 0;
    let truncated = false;

    for (const hunk of hunks) {
      if (emitted >= maxLines) {
        truncated = true;
        break;
      }
      const firstEqual = hunk.find(op => op.type !== 'insert' && op.aIndex >= 0);
      const firstInsert = hunk.find(op => op.bIndex >= 0);
      const aStart = (firstEqual?.aIndex ?? 0) + 1;
      const bStart = (firstInsert?.bIndex ?? 0) + 1;
      const aLen = hunk.filter(op => op.type !== 'insert').length;
      const bLen = hunk.filter(op => op.type !== 'delete').length;
      out.push(`@@ -${aStart},${aLen} +${bStart},${bLen} @@`);

      for (const op of hunk) {
        if (emitted >= maxLines) {
          truncated = true;
          break;
        }
        const prefix = op.type === 'insert' ? '+' : op.type === 'delete' ? '-' : ' ';
        out.push(prefix + op.line);
        emitted++;
      }
      if (truncated) break;
    }

    if (truncated) out.push(`… (diff truncated after ${maxLines} lines)`);

    return { text: out.join('\n'), added, removed, truncated, identical: false };
  }

  /** One-line summary for logs and tool results. */
  static summarize(result: DiffResult): string {
    if (result.identical) return 'no changes';
    const parts = [`+${result.added}`, `-${result.removed}`];
    if (result.truncated) parts.push('truncated');
    return parts.join('/');
  }

  /**
   * Preview the effect of a write: returns the diff for an existing file or a
   * "new file" summary when the target does not exist yet.
   */
  diffForWrite(before: string | null, after: string, label: string): DiffResult {
    if (before === null) {
      const lines = after.split('\n').length;
      return {
        text: `--- /dev/null\n+++ b/${label}\n@@ new file: ${lines} line${lines === 1 ? '' : 's'} @@`,
        added: lines,
        removed: 0,
        truncated: false,
        identical: false,
      };
    }
    return this.diff(before, after, { path: label });
  }
}
