import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CodeVectorStore — the "raw code warehouse + fast scanner" (LanceDB-style).
 *
 * Chops every source file into semantic chunks (function, class, test,
 * section) and indexes them for millisecond retrieval of similar snippets.
 *
 * Storage: one JSON index per workspace (.agent/memory/vectors/index.json)
 * — no native deps, pure TS, Rust-engine-class behavior at our scale:
 * incremental indexing (only changed files re-chunked), cheap scoring.
 *
 * "Vectors" are lightweight bag-of-tokens (word → count, normalized) which
 * support cosine similarity — a strong semantic proxy for code search
 * without embedding models. Swap point for a real embedding provider later.
 */

export type ChunkKind = 'function' | 'class' | 'test' | 'section' | 'config';

export interface CodeChunk {
  id: string;
  filePath: string;
  kind: ChunkKind;
  /** Function/class name when detected. */
  symbol?: string;
  startLine: number;
  endLine: number;
  content: string;
  /** Bag-of-tokens "vector". */
  vector: Record<string, number>;
}

interface IndexShape {
  version: 1;
  chunks: CodeChunk[];
  /** filePath → content hash, for incremental re-indexing. */
  fileHashes: Record<string, string>;
}

export class CodeVectorStore {
  private chunks: CodeChunk[] = [];
  private fileHashes: Record<string, string> = {};
  private loaded = false;
  private seq = 0;

  constructor(private readonly indexPath = '.agent/memory/vectors/index.json') {}

  private storePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, this.indexPath);
  }

  private static hash(text: string): string {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h * 31 + text.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  async load(workspaceRoot: string): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.storePath(workspaceRoot), 'utf-8');
      const parsed = JSON.parse(raw) as IndexShape;
      if (parsed.version === 1) {
        this.chunks = parsed.chunks ?? [];
        this.fileHashes = parsed.fileHashes ?? {};
      }
    } catch {
      this.chunks = [];
      this.fileHashes = {};
    }
    this.loaded = true;
  }

  private async persist(workspaceRoot: string): Promise<void> {
    const filePath = this.storePath(workspaceRoot);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload: IndexShape = { version: 1, chunks: this.chunks, fileHashes: this.fileHashes };
    await fs.writeFile(filePath, JSON.stringify(payload), 'utf-8');
  }

  // -------------------------------------------------------------------------
  // Chunking
  // -------------------------------------------------------------------------

  private static tokenize(text: string): Record<string, number> {
    const tokens: Record<string, number> = {};
    for (const raw of text.toLowerCase().split(/[^a-zA-Z0-9_$]+/)) {
      if (raw.length < 2 || raw.length > 40) continue;
      tokens[raw] = (tokens[raw] ?? 0) + 1;
    }
    // Normalize to unit-ish length so long chunks don't dominate similarity.
    const norm = Math.sqrt(Object.values(tokens).reduce((s, v) => s + v * v, 0)) || 1;
    for (const key of Object.keys(tokens)) tokens[key] = tokens[key] / norm;
    return tokens;
  }

  /** Splits one source file into semantic chunks (language-tolerant). */
  static chunkFile(filePath: string, content: string): Array<Omit<CodeChunk, 'id' | 'vector'>> {
    const lines = content.split('\n');
    const ext = path.extname(filePath);
    const chunks: Array<Omit<CodeChunk, 'id' | 'vector'>> = [];
    const isTest = /\.(test|spec)\.[jt]sx?$|(_test|_spec)\.(py|go|rs)$|__tests__/.test(filePath);

    const boundary = /^(?:export\s+)?(?:async\s+)?(function|class|def|func|fn|impl|struct|type|interface)\s+\w/m;
    let start = 0;
    for (let i = 1; i <= lines.length; i++) {
      const isBoundary = i < lines.length && boundary.test(lines[i]);
      const isEnd = i === lines.length;
      const tooBig = i - start >= 120;
      if ((isBoundary && i - start >= 3) || isEnd || tooBig) {
        const slice = lines.slice(start, isEnd && !tooBig ? lines.length : i).join('\n');
        if (slice.trim().length > 0) {
          const firstLine = lines[start];
          const symbolMatch = firstLine.match(/(?:function|class|def|func|fn|impl|struct|type|interface)\s+(\w+)/);
          const kind: ChunkKind = isTest ? 'test' : symbolMatch ? (symbolMatch[1] === 'class' || symbolMatch[1] === 'struct' || symbolMatch[1] === 'impl' || symbolMatch[1] === 'interface' ? 'class' : 'function') : /\.(json|ya?ml|toml|env)$/.test(ext) ? 'config' : 'section';
          chunks.push({
            filePath,
            kind,
            symbol: symbolMatch?.[1],
            startLine: start + 1,
            endLine: (isEnd && !tooBig ? lines.length : i),
            content: slice.slice(0, 6000),
          });
        }
        start = i;
      }
    }
    return chunks;
  }

  /** Re-indexes one file (add/update); deletes old chunks of that file first. */
  async indexFile(workspaceRoot: string, filePath: string, content: string): Promise<number> {
    await this.load(workspaceRoot);
    const hash = CodeVectorStore.hash(content);
    if (this.fileHashes[filePath] === hash) return 0; // unchanged
    this.chunks = this.chunks.filter(chunk => chunk.filePath !== filePath);
    const newChunks = CodeVectorStore.chunkFile(filePath, content).map(chunk => ({
      ...chunk,
      id: `c-${(++this.seq).toString(36)}-${hash}`,
      vector: CodeVectorStore.tokenize(chunk.content),
    }));
    this.chunks.push(...newChunks);
    this.fileHashes[filePath] = hash;
    await this.persist(workspaceRoot);
    return newChunks.length;
  }

  /** Removes a file's chunks (on file deletion). */
  async removeFile(workspaceRoot: string, filePath: string): Promise<void> {
    await this.load(workspaceRoot);
    this.chunks = this.chunks.filter(chunk => chunk.filePath !== filePath);
    delete this.fileHashes[filePath];
    await this.persist(workspaceRoot);
  }

  // -------------------------------------------------------------------------
  // Semantic search
  // -------------------------------------------------------------------------

  private static cosine(a: Record<string, number>, b: Record<string, number>): number {
    let dot = 0;
    const [small, large] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
    for (const [key, value] of Object.entries(small)) {
      const other = large[key];
      if (other) dot += value * other;
    }
    return dot; // both normalized → dot == cosine
  }

  /**
   * Vector-semantic search over all indexed chunks. Returns the most
   * similar snippets first, with precomputed previews.
   */
  async search(
    workspaceRoot: string,
    query: string,
    options: { limit?: number; kind?: ChunkKind; under?: string } = {}
  ): Promise<Array<{ chunk: CodeChunk; score: number; preview: string }>> {
    await this.load(workspaceRoot);
    const queryVector = CodeVectorStore.tokenize(query);
    const results = this.chunks
      .filter(chunk => (!options.kind || chunk.kind === options.kind) && (!options.under || chunk.filePath.startsWith(options.under)))
      .map(chunk => ({ chunk, score: CodeVectorStore.cosine(queryVector, chunk.vector) }))
      .filter(result => result.score > 0.02)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 8)
      .map(result => ({
        chunk: result.chunk,
        score: Number(result.score.toFixed(3)),
        preview: result.chunk.content.split('\n').slice(0, 6).join('\n'),
      }));
    return results;
  }

  get chunkCount(): number {
    return this.chunks.length;
  }

  get indexedFiles(): number {
    return Object.keys(this.fileHashes).length;
  }
}
