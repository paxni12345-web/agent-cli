/**
 * MemoryHub — one door to the three memory stores:
 *
 *   RulesStore      (ChromaDB-style)  rules, guardrails, preferences, agreements,
 *                                     short-term chat history — plain text, stable
 *   CodeVectorStore (LanceDB-style)   chunked source code, semantic snippet search
 *   KnowledgeGraph  (GraphRAG-style)  cross-file relations, impact analysis
 *
 * The Agent boots all three, keeps them indexed while it works, and injects
 * a combined context section into the system prompt.
 */

import { RulesStore } from './RulesStore.js';
import { CodeVectorStore } from './CodeVectorStore.js';
import { KnowledgeGraph } from './KnowledgeGraph.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.rb', '.php', '.vue', '.svelte',
]);

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage', '.agent', '.next', 'out', 'venv', '__pycache__',
]);

const MAX_FILE_BYTES = 400_000;
const MAX_FILES = 800;

export class MemoryHub {
  readonly rules = new RulesStore();
  readonly vectors = new CodeVectorStore();
  readonly graph = new KnowledgeGraph();

  private indexing = false;
  private lastIndexedAt: Date | null = null;

  /** Boot: load all stores from disk. */
  async boot(workspaceRoot: string): Promise<void> {
    await Promise.all([
      this.rules.load(workspaceRoot),
      this.vectors.load(workspaceRoot),
      this.graph.load(workspaceRoot),
    ]);
  }

  /**
   * Incrementally indexes the workspace: re-chunks changed files into the
   * vector store and refreshes graph edges. Safe to call often — unchanged
   * files are skipped via content hashes.
   */
  async indexWorkspace(workspaceRoot: string): Promise<{ files: number; chunks: number; skipped: boolean }> {
    if (this.indexing) return { files: 0, chunks: 0, skipped: true };
    this.indexing = true;
    try {
      let files = 0;
      const beforeChunks = this.vectors.chunkCount;
      const walk = async (dir: string, depth: number): Promise<void> => {
        if (depth > 8 || files >= MAX_FILES) return;
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (files >= MAX_FILES) return;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
            await walk(full, depth + 1);
          } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            try {
              const stat = await fs.stat(full);
              if (stat.size > MAX_FILE_BYTES) continue;
              const content = await fs.readFile(full, 'utf-8');
              await this.vectors.indexFile(workspaceRoot, full, content);
              await this.graph.indexFile(workspaceRoot, full, content);
              files++;
            } catch {
              /* unreadable file — skip */
            }
          }
        }
      };
      await walk(workspaceRoot, 0);
      this.lastIndexedAt = new Date();
      return { files, chunks: this.vectors.chunkCount - beforeChunks, skipped: false };
    } finally {
      this.indexing = false;
    }
  }

  /** Semantic code search (LanceDB-style snippet retrieval). */
  async searchCode(workspaceRoot: string, query: string, limit = 6) {
    return this.vectors.search(workspaceRoot, query, { limit });
  }

  /** Impact analysis (GraphRAG-style: what breaks if I change X). */
  async analyzeImpact(workspaceRoot: string, symbolName: string) {
    return this.graph.impact(workspaceRoot, symbolName);
  }

  /** Rules/preference lookup for the prompt (ChromaDB-style stability). */
  async rulesForPrompt(workspaceRoot: string): Promise<string> {
    return this.rules.renderForPrompt(workspaceRoot);
  }

  /** Short-term conversational memory. */
  async rememberTurn(workspaceRoot: string, role: 'user' | 'assistant', text: string): Promise<void> {
    await this.rules.rememberTurn(workspaceRoot, role, text);
  }

  /**
   * Combined memory section for the system prompt: rules → recent turns →
   * graph stats. (Code snippets are fetched on demand via searchCode when
   * the agent explores, not dumped wholesale.)
   */
  async contextForPrompt(workspaceRoot: string): Promise<string> {
    const [rules, turns] = await Promise.all([
      this.rules.renderForPrompt(workspaceRoot),
      this.rules.recentTurns(workspaceRoot, 5),
    ]);
    const parts: string[] = [];
    if (rules) parts.push(rules);
    if (turns.length) parts.push('RECENT TURNS (short-term memory):\n' + turns.map(t => `- ${t}`).join('\n'));
    const stats = this.graph.stats;
    if (stats.files > 0) {
      parts.push(`CODE MEMORY: ${this.vectors.chunkCount} chunks indexed across ${stats.files} files · graph ${stats.nodes} nodes/${stats.edges} edges — use search_code_memory for similar snippets and impact_of before risky edits.`);
    }
    return parts.join('\n\n').slice(0, 2600);
  }

  get stats(): { chunks: number; files: number; rules: number; lastIndexedAt: Date | null } {
    return {
      chunks: this.vectors.chunkCount,
      files: this.vectors.indexedFiles,
      rules: this.rules.size,
      lastIndexedAt: this.lastIndexedAt,
    };
  }
}
