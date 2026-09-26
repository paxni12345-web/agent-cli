/**
 * CodeAnalysis — AST & code analysis helpers (500-functions category C).
 *
 * Dependency-free, line/structure-based analysis for TS/JS/Python/Go/Rust
 * sources. These are pure functions (input text in, data out) shared by
 * agent tools, reviews and reports. Unit-tested in
 * tests/unit/CodeAnalysis.test.ts.
 *
 * Heuristic note: this is a sketch parser, not a compiler frontend. Braces
 * inside string literals can skew depth tracking; analysis tools should treat
 * results as advisory, exactly like the existing regex-based CodeNavTools.
 */

import * as path from 'path';

/** 41. Structural node produced by parseToAST(). */
export interface AstNode {
  kind: string;
  name: string;
  line: number;
  endLine: number;
  depth: number;
  signature?: string;
  children: AstNode[];
}

interface Pattern {
  kind: string;
  re: RegExp;
}

const SYMBOL_PATTERNS: Pattern[] = [
  { kind: 'py-class', re: /^\s*class\s+([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*:/ },
  { kind: 'class', re: /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'interface', re: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'enum', re: /^\s*(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'function', re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/ },
  { kind: 'method', re: /^\s+(?:public|private|protected|static|readonly|override|abstract|async|\s)*\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[\w<>[\]|,.\s]+)?\s*\{/ },
  { kind: 'const-fn', re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/ },
  { kind: 'arrow-fn', re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/ },
  { kind: 'type', re: /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/ },
  { kind: 'py-def', re: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/ },
];

const FUNCTION_KINDS = new Set(['function', 'method', 'const-fn', 'arrow-fn', 'py-def']);

function countChar(line: string, ch: string): number {
  let n = 0;
  for (const c of line) if (c === ch) n++;
  return n;
}

/** 41. Parse source into a nested structural tree (dependency-free AST sketch). */
export function parseToAST(source: string): AstNode[] {
  const roots: AstNode[] = [];
  const stack: Array<{ node: AstNode; entryDepth: number }> = [];
  let depth = 0;
  source.split('\n').forEach((line, idx) => {
    const lineNo = idx + 1;
    const stripped = line.trim();
    if (stripped && !stripped.startsWith('//') && !stripped.startsWith('*')) {
      for (const { kind, re } of SYMBOL_PATTERNS) {
        const match = line.match(re);
        if (match) {
          while (stack.length > 0 && stack[stack.length - 1].entryDepth > depth) {
            const popped = stack.pop();
            if (popped) popped.node.endLine = lineNo - 1;
          }
          const node: AstNode = {
            kind,
            name: match[1],
            line: lineNo,
            endLine: lineNo,
            depth,
            signature: stripped.slice(0, 160),
            children: [],
          };
          const parent = stack.length > 0 ? stack[stack.length - 1].node : undefined;
          if (parent) parent.children.push(node);
          else roots.push(node);
          stack.push({ node, entryDepth: depth });
          break;
        }
      }
    }
    const opens = countChar(line, '{') + countChar(line, '[') + countChar(line, '(');
    const closes = countChar(line, '}') + countChar(line, ']') + countChar(line, ')');
    depth = Math.max(0, depth + opens - closes);
    while (stack.length > 0 && stack[stack.length - 1].entryDepth >= depth) {
      const popped = stack.pop();
      if (popped) popped.node.endLine = lineNo;
    }
  });
  return roots;
}

/** Flatten a parseToAST() tree depth-first. */
export function flattenAST(nodes: AstNode[]): AstNode[] {
  const out: AstNode[] = [];
  const visit = (node: AstNode): void => {
    out.push(node);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return out;
}

/** 42. List function/method signatures with parameter lists and line numbers. */
export interface FunctionSignature {
  name: string;
  kind: string;
  params: string;
  line: number;
}

export function getFunctionSignatures(source: string): FunctionSignature[] {
  const out: FunctionSignature[] = [];
  source.split('\n').forEach((line, idx) => {
    const patterns: Array<{ kind: string; re: RegExp }> = [
      { kind: 'function', re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/ },
      { kind: 'method', re: /^\s+(?:[\w\s]*?)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\{/ },
      { kind: 'const-fn', re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?\(([^)]*)\)/ },
      { kind: 'arrow-fn', re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/ },
      { kind: 'py-def', re: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/ },
    ];
    for (const { kind, re } of patterns) {
      const match = line.match(re);
      if (match) {
        const params = (match[2] ?? match[3] ?? '').trim();
        out.push({ name: match[1], kind, params, line: idx + 1 });
        break;
      }
    }
  });
  return out;
}

/** 43. List exported symbols (name + kind + line). */
export interface ExportedSymbol {
  name: string;
  kind: string;
  line: number;
}

export function getExportedSymbols(source: string): ExportedSymbol[] {
  const out: ExportedSymbol[] = [];
  source.split('\n').forEach((line, idx) => {
    const match = line.match(
      /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:(function|class|interface|type|enum|const|let|var|abstract)\s+)?([A-Za-z_$][\w$]*)/,
    );
    if (match) out.push({ name: match[2], kind: match[1] ?? 're-export', line: idx + 1 });
  });
  return out;
}

/** 44. Parse import/require statements of a single file. */
export interface ImportEdge {
  raw: string;
  specifier: string;
  names: string[];
}

export function getImportGraph(source: string): ImportEdge[] {
  const edges: ImportEdge[] = [];
  const fromRe = /import\s+(.*?)\s+from\s+(['"])([^'"]+)\2/g;
  const sideEffectRe = /^\s*import\s+(['"])([^'"]+)\1\s*;?\s*$/gm;
  const requireRe = /(?:const|let|var)\s+(?:(\{[^}]*\}|[A-Za-z_$][\w$]*)|\*\s*as\s+([A-Za-z_$][\w$]*))\s*=\s*require\s*\(\s*(['"])([^'"]+)\3\s*\)/g;
  const exportFromRe = /export\s+(?:\*\s*(?:as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s+from\s+(['"])([^'"]+)\1/g;
  let match: RegExpExecArray | null;
  while ((match = fromRe.exec(source)) !== null) {
    const clause = match[1].trim();
    const names: string[] = [];
    const defaultMatch = clause.match(/^([A-Za-z_$][\w$]*)(?:\s*,|$)/);
    if (defaultMatch) names.push(defaultMatch[1]);
    const nsMatch = clause.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
    if (nsMatch) names.push(nsMatch[1]);
    const namedMatch = clause.match(/\{([^}]*)\}/);
    if (namedMatch) {
      for (const part of namedMatch[1].split(',')) {
        const alias = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (alias) names.push(alias);
      }
    }
    edges.push({ raw: match[0].trim().slice(0, 160), specifier: match[3], names });
  }
  while ((match = sideEffectRe.exec(source)) !== null) {
    edges.push({ raw: match[0].trim().slice(0, 160), specifier: match[2], names: [] });
  }
  while ((match = requireRe.exec(source)) !== null) {
    const names: string[] = [];
    if (match[2]) names.push(match[2]);
    else if (match[1]) {
      const clause = match[1].trim();
      if (clause.startsWith('{')) {
        for (const part of clause.slice(1, -1).split(',')) {
          const alias = part.trim().split(/\s*:\s*/).pop()?.trim();
          if (alias) names.push(alias);
        }
      } else names.push(clause);
    }
    edges.push({ raw: match[0].trim().slice(0, 160), specifier: match[4], names });
  }
  while ((match = exportFromRe.exec(source)) !== null) {
    edges.push({ raw: match[0].trim().slice(0, 160), specifier: match[2], names: [] });
  }
  return edges;
}

/** 45. Find imported names never referenced outside their import statements. */
export function findUnusedImports(source: string): string[] {
  const edges = getImportGraph(source);
  const codeLines = source
    .split('\n')
    .filter(line => !/^\s*(import|export)\s/.test(line) && !/require\s*\(/.test(line));
  const code = codeLines.join('\n');
  const unused: string[] = [];
  for (const edge of edges) {
    for (const name of edge.names) {
      const useRe = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (!useRe.test(code) && !unused.includes(name)) unused.push(name);
    }
  }
  return unused;
}

/** Resolve a relative import specifier against in-memory file keys. */
function resolveLocalImport(fromFile: string, specifier: string, files: Record<string, string>): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.js`,
  ];
  const normalizedKeys = new Map<string, string>();
  for (const key of Object.keys(files)) normalizedKeys.set(path.posix.normalize(key), key);
  for (const candidate of candidates) {
    const hit = normalizedKeys.get(candidate);
    if (hit) return hit;
  }
  return undefined;
}

/** 46. Detect circular local imports across in-memory sources. */
export function findCircularImports(files: Record<string, string>): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const [file, source] of Object.entries(files)) {
    const targets: string[] = [];
    for (const edge of getImportGraph(source)) {
      const resolved = resolveLocalImport(file, edge.specifier, files);
      if (resolved && resolved !== file && !targets.includes(resolved)) targets.push(resolved);
    }
    adjacency.set(file, targets);
  }
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const visit = (node: string, stack: string[]): void => {
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const idx = stack.indexOf(next);
      if (idx >= 0) {
        const cycle = stack.slice(idx);
        const key = [...cycle].sort().join('→');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else {
        visit(next, stack);
      }
    }
    stack.pop();
  };
  for (const file of adjacency.keys()) visit(file, []);
  return cycles;
}

/** Strip string literals so punctuation inside them is not miscounted. */
function stripStringLiterals(code: string): string {
  return code
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/** 47. Cyclomatic complexity per function (1 + decision points). */
export interface FunctionComplexity {
  name: string;
  line: number;
  complexity: number;
}

export function getFunctionComplexity(source: string, name?: string): FunctionComplexity[] {
  const lines = source.split('\n');
  const tree = flattenAST(parseToAST(source));
  const out: FunctionComplexity[] = [];
  for (const node of tree) {
    if (!FUNCTION_KINDS.has(node.kind)) continue;
    if (name && node.name !== name) continue;
    const body = stripStringLiterals(lines.slice(node.line - 1, node.endLine).join('\n'));
    const noNullish = body.replace(/\?\?/g, ' ');
    const noOptionalChain = noNullish.replace(/\?\./g, ' ');
    // Optional params/props (`a?:`, `a?,`, `a?)`): the `?` is immediately
    // followed by `:`, `,` or `)` so it never collides with a ternary `?`,
    // which is always followed by the true-branch expression.
    const cleaned = noOptionalChain.replace(/([A-Za-z_$][\w$]*)\?(?=\s*[:,)\]])/g, '$1 ');
    const keywordHits = cleaned.match(/\b(if|for|while|case|catch)\b/g) ?? [];
    const andHits = cleaned.match(/&&/g) ?? [];
    const orHits = cleaned.match(/\|\|/g) ?? [];
    const ternaryHits = cleaned.match(/\?/g) ?? [];
    out.push({
      name: node.name,
      line: node.line,
      complexity: 1 + keywordHits.length + andHits.length + orHits.length + ternaryHits.length,
    });
  }
  return out;
}

/** 48. Extract doc comments (JSDoc blocks + Python docstrings) attached to symbols. */
export interface DocComment {
  symbol: string;
  line: number;
  comment: string;
}

export function extractDocComments(source: string): DocComment[] {
  const out: DocComment[] = [];
  const lines = source.split('\n');
  let block: string[] | undefined;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('/**')) {
      const closeIdx = trimmed.indexOf('*/');
      if (closeIdx >= 0 && trimmed.length > 4) {
        // Single-line JSDoc: attach to the symbol on the next line.
        const text = trimmed.slice(3, closeIdx).replace(/^\*\s?/, '').trim();
        const nextLine = lines[idx + 1] ?? '';
        const symbolMatch = nextLine.match(
          /(?:function|class|interface|type|enum|const|let|var|def)\s+([A-Za-z_$][\w$]*)/,
        );
        if (symbolMatch && text) out.push({ symbol: symbolMatch[1], line: idx + 2, comment: text });
        return;
      }
      block = [];
      return;
    }
    if (block) {
      if (trimmed.includes('*/')) {
        const before = trimmed.slice(0, trimmed.indexOf('*/')).replace(/^\*\s?/, '').trim();
        if (before) block.push(before);
        const text = block.filter(Boolean).join(' ');
        const nextLine = lines[idx + 1] ?? '';
        const symbolMatch = nextLine.match(
          /(?:function|class|interface|type|enum|const|let|var|def)\s+([A-Za-z_$][\w$]*)/,
        );
        if (symbolMatch && text) out.push({ symbol: symbolMatch[1], line: idx + 2, comment: text });
        block = undefined;
      } else {
        const cleaned = trimmed.replace(/^\*\s?/, '').trim();
        if (cleaned) block.push(cleaned);
      }
      return;
    }
    const pyMatch = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/);
    if (pyMatch) {
      const nextLine = (lines[idx + 1] ?? '').trim();
      const docMatch = nextLine.match(/^("""|''')(.+?)\1/);
      if (docMatch) out.push({ symbol: pyMatch[1], line: idx + 1, comment: docMatch[2].trim() });
    }
  });
  return out;
}

/** 49. Rename a symbol across in-memory files (word-boundary, returns changed files only). */
export function renameSymbolAcrossFiles(
  files: Record<string, string>,
  oldName: string,
  newName: string,
): Record<string, string> {
  if (!oldName || !newName) throw new Error('oldName and newName are required');
  const re = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  const changed: Record<string, string> = {};
  for (const [file, source] of Object.entries(files)) {
    if (!re.test(source)) continue;
    re.lastIndex = 0;
    changed[file] = source.replace(re, newName);
  }
  return changed;
}

/** 50. Class hierarchy (extends / implements) per class declaration. */
export interface ClassInfo {
  name: string;
  line: number;
  extends?: string;
  implements: string[];
}

export function getClassHierarchy(source: string): ClassInfo[] {
  const out: ClassInfo[] = [];
  source.split('\n').forEach((line, idx) => {
    const match = line.match(
      /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?(?:\s+implements\s+([A-Za-z_$][\w$,\s]*))?/,
    );
    if (match) {
      out.push({
        name: match[1],
        line: idx + 1,
        extends: match[2],
        implements: match[3] ? match[3].split(',').map(s => s.trim()).filter(Boolean) : [],
      });
    }
  });
  return out;
}

/** 51. Find TODO / FIXME / HACK / XXX markers with line numbers. */
export interface TodoComment {
  tag: string;
  line: number;
  text: string;
}

export function findTODOComments(source: string): TodoComment[] {
  const out: TodoComment[] = [];
  source.split('\n').forEach((line, idx) => {
    const match = line.match(/\b(TODO|FIXME|HACK|XXX)\b\s*:?\s*(.*)/);
    if (match) out.push({ tag: match[1], line: idx + 1, text: match[2].trim().slice(0, 200) });
  });
  return out;
}

/** 52. Detect duplicated code blocks (normalized sliding-window hashing). */
export interface DuplicateBlock {
  lineCount: number;
  occurrences: number;
  startLines: number[];
  sample: string;
}

function normalizeCodeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export function detectDuplicateCode(source: string, minLines = 3): DuplicateBlock[] {
  if (!Number.isInteger(minLines) || minLines < 2) throw new Error('minLines must be an integer >= 2');
  const lines = source.split('\n');
  const norm = lines.map(normalizeCodeLine);
  const windows = new Map<string, number[]>();
  for (let start = 0; start + minLines <= norm.length; start++) {
    const window = norm.slice(start, start + minLines);
    if (window.every(l => l === '')) continue;
    const key = window.join('\n');
    const starts = windows.get(key) ?? [];
    starts.push(start + 1);
    windows.set(key, starts);
  }
  const out: DuplicateBlock[] = [];
  for (const [key, starts] of windows) {
    const nonOverlapping = starts.filter((s, i) => i === 0 || s >= starts[i - 1] + minLines);
    if (nonOverlapping.length >= 2) {
      out.push({
        lineCount: minLines,
        occurrences: nonOverlapping.length,
        startLines: nonOverlapping,
        sample: key.split('\n')[0].slice(0, 120),
      });
    }
  }
  return out.sort((a, b) => b.occurrences - a.occurrences || a.startLines[0] - b.startLines[0]);
}

/** 53. List type-level definitions (interfaces, type aliases, enums). */
export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  line: number;
}

export function getTypeDefinitions(source: string): TypeDefinition[] {
  const out: TypeDefinition[] = [];
  source.split('\n').forEach((line, idx) => {
    const match = line.match(/^\s*(?:export\s+)?(interface|type|(?:const\s+)?enum)\s+([A-Za-z_$][\w$]*)/);
    if (match) {
      out.push({
        name: match[2],
        kind: match[1].includes('enum') ? 'enum' : (match[1] as 'interface' | 'type'),
        line: idx + 1,
      });
    }
  });
  return out;
}

/** 54. Quick syntax check: balanced brackets outside strings/comments. */
export interface SyntaxCheck {
  valid: boolean;
  errors: string[];
}

export function validateSyntax(source: string): SyntaxCheck {
  const errors: string[] = [];
  const pairs: Record<string, string> = { ')': '(', '}': '{', ']': '[' };
  const stack: Array<{ ch: string; line: number }> = [];
  let inBlockComment = false;
  let inString: string | undefined;
  const lines = source.split('\n');
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      const next = line[i + 1] ?? '';
      if (inString) {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === inString) inString = undefined;
        i++;
        continue;
      }
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (ch === '/' && next === '/') break;
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        i++;
        continue;
      }
      if (ch === '(' || ch === '{' || ch === '[') stack.push({ ch, line: lineNo });
      else if (ch === ')' || ch === '}' || ch === ']') {
        const top = stack.pop();
        if (!top) errors.push(`Unmatched '${ch}' at L${lineNo}`);
        else if (top.ch !== pairs[ch]) errors.push(`Mismatched '${top.ch}' (L${top.line}) closed by '${ch}' at L${lineNo}`);
      }
      i++;
    }
  });
  for (const unclosed of stack) errors.push(`Unclosed '${unclosed.ch}' opened at L${unclosed.line}`);
  if (inBlockComment) errors.push('Unclosed block comment');
  if (inString) errors.push('Unclosed string literal');
  return { valid: errors.length === 0, errors };
}

/** 55. Serialize a parseToAST() tree back to a normalized outline (structural reverse). */
export function astToSourceCode(nodes: AstNode[]): string {
  const lines: string[] = [];
  const visit = (node: AstNode): void => {
    lines.push(`${'  '.repeat(node.depth)}${node.kind} ${node.name} // L${node.line}-${node.endLine}`);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return lines.join('\n');
}

/** 56. Largest functions by line span, descending. */
export interface FunctionSize {
  name: string;
  line: number;
  endLine: number;
  lines: number;
}

export function findLargestFunctions(source: string, topN = 5): FunctionSize[] {
  if (!Number.isInteger(topN) || topN < 1) throw new Error('topN must be a positive integer');
  return flattenAST(parseToAST(source))
    .filter(node => FUNCTION_KINDS.has(node.kind))
    .map(node => ({ name: node.name, line: node.line, endLine: node.endLine, lines: node.endLine - node.line + 1 }))
    .sort((a, b) => b.lines - a.lines || a.line - b.line)
    .slice(0, topN);
}

/** 57. Line counts split into code / comment / blank. */
export interface FileLOC {
  total: number;
  code: number;
  comment: number;
  blank: number;
}

export function getFileLOC(source: string): FileLOC {
  if (source === '') return { total: 0, code: 0, comment: 0, blank: 0 };
  const loc: FileLOC = { total: 0, code: 0, comment: 0, blank: 0 };
  let inBlock = false;
  const rawLines = source.split('\n');
  // A trailing newline terminates the last line; it is not a phantom extra line.
  if (source.endsWith('\n')) rawLines.pop();
  for (const line of rawLines) {
    loc.total++;
    const trimmed = line.trim();
    if (trimmed === '') {
      loc.blank++;
      continue;
    }
    if (inBlock) {
      loc.comment++;
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      loc.comment++;
      if (trimmed.startsWith('/*') && !trimmed.includes('*/')) inBlock = true;
      continue;
    }
    loc.code++;
    if (trimmed.includes('/*') && !trimmed.includes('*/')) inBlock = true;
  }
  return loc;
}

/** 58. Local functions/classes never referenced elsewhere in the same source. */
export interface DeadSymbol {
  name: string;
  line: number;
  kind: string;
}

export function detectDeadCode(source: string): DeadSymbol[] {
  const lines = source.split('\n');
  const decls: Array<{ name: string; line: number; kind: string; declText: string }> = [];
  lines.forEach((line, idx) => {
    const match = line.match(
      /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:(function)\s+([A-Za-z_$][\w$]*)|(class)\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?[\w(])/,
    );
    if (match) {
      const name = match[2] ?? match[4] ?? match[5];
      const kind = match[2] ? 'function' : match[4] ? 'class' : 'variable';
      if (name && !['index', 'main'].includes(name)) decls.push({ name, line: idx + 1, kind, declText: match[0] });
    }
  });
  const dead: DeadSymbol[] = [];
  for (const decl of decls) {
    const useRe = new RegExp(`\\b${decl.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const rest = lines.filter((_, idx) => idx + 1 !== decl.line).join('\n');
    if (!useRe.test(rest)) dead.push({ name: decl.name, line: decl.line, kind: decl.kind });
  }
  return dead;
}

/** 59. Locate a symbol's declarations across in-memory files. */
export interface SymbolLocation {
  file: string;
  line: number;
  kind: string;
}

export function mapSymbolToFile(symbol: string, files: Record<string, string>): SymbolLocation[] {
  if (!symbol) throw new Error('symbol is required');
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declRe = new RegExp(
    `^\\s*(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function|class|interface|type|enum|const|let|var)\\s+${escaped}\\b`,
  );
  const out: SymbolLocation[] = [];
  for (const [file, source] of Object.entries(files)) {
    source.split('\n').forEach((line, idx) => {
      const kindMatch = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum|const|let|var)\b/);
      if (kindMatch && declRe.test(line)) out.push({ file, line: idx + 1, kind: kindMatch[1] });
    });
  }
  return out;
}

/** 60. Compare structural symbol sets before/after an edit. */
export interface ASTStructureDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export function diffASTStructure(before: string, after: string): ASTStructureDiff {
  const toMap = (source: string): Map<string, string> => {
    const map = new Map<string, string>();
    for (const node of flattenAST(parseToAST(source))) {
      map.set(`${node.kind}:${node.name}`, node.signature ?? `${node.kind} ${node.name}`);
    }
    return map;
  };
  const beforeMap = toMap(before);
  const afterMap = toMap(after);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [key, sig] of afterMap) {
    if (!beforeMap.has(key)) added.push(key);
    else if (beforeMap.get(key) !== sig) changed.push(key);
  }
  for (const key of beforeMap.keys()) {
    if (!afterMap.has(key)) removed.push(key);
  }
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}
