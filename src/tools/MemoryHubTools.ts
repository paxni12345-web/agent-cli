import { Tool, ToolContext, ToolResult } from '../types/index.js';

/**
 * Tools exposing the three-store memory hub to the agent:
 *
 *  search_code_memory — semantic snippet search over indexed source chunks
 *                       (LanceDB-style fast retrieval)
 *  impact_of          — GraphRAG-style "what breaks if I change X"
 */

interface MemoryHubLike {
  searchCode(workspaceRoot: string, query: string, limit?: number): Promise<Array<{ chunk: { filePath: string; kind: string; symbol?: string; startLine: number; endLine: number }; score: number; preview: string }>>;
  analyzeImpact(workspaceRoot: string, symbolName: string): Promise<{ summary: string; directCallers: string[]; transitiveCallers: string[]; affectedTests: string[]; affectedResources: Array<{ label: string; type: string }> }>;
}

export class SearchCodeMemoryTool implements Tool {
  name = 'search_code_memory';
  description =
    'Semantic search over the indexed codebase memory (chunked by function/class/test). Finds similar code snippets across the whole workspace in milliseconds — use before writing similar logic or locating a symbol by concept.';

  inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to look for, conceptually: "jwt token verify", "user login handler", "retry with backoff"' },
      limit: { type: 'number', description: 'Max results (default 6)' },
    },
    required: ['query'],
  };

  constructor(private hub: MemoryHubLike) {}

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const { query, limit } = input as { query?: string; limit?: number };
    if (!query?.trim()) return { success: false, error: 'query is required' };
    try {
      const results = await this.hub.searchCode(context.workspaceRoot, query, Math.min(limit ?? 6, 15));
      if (results.length === 0) return { success: true, output: '(no similar code indexed yet — run more or use search_code)' };
      const lines = results.map((r, i) =>
        `${i + 1}. [${r.score}] ${r.chunk.filePath}:${r.chunk.startLine}-${r.chunk.endLine}${r.chunk.symbol ? ` (${r.chunk.symbol})` : ''}\n${r.preview.split('\n').map(l => '   | ' + l).join('\n')}`
      );
      return { success: true, output: `Top ${results.length} similar snippets:\n\n${lines.join('\n\n')}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class ImpactOfTool implements Tool {
  name = 'impact_of';
  description =
    'Knowledge-graph impact analysis: "what breaks if I change symbol X?" Returns direct/transitive callers, affected tests, and touched resources (databases, tables, endpoints). Check this before risky edits.';

  inputSchema = {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Function/class/type name to analyze' },
    },
    required: ['symbol'],
  };

  constructor(private hub: MemoryHubLike) {}

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const { symbol } = input as { symbol?: string };
    if (!symbol?.trim()) return { success: false, error: 'symbol is required' };
    try {
      const impact = await this.hub.analyzeImpact(context.workspaceRoot, symbol.trim());
      const sections: string[] = [impact.summary];
      if (impact.directCallers.length) sections.push('DIRECT: ' + impact.directCallers.slice(0, 8).join(', '));
      if (impact.transitiveCallers.length) sections.push('TRANSITIVE: ' + impact.transitiveCallers.slice(0, 8).join(', '));
      if (impact.affectedTests.length) sections.push('TESTS: ' + impact.affectedTests.slice(0, 8).join(', '));
      if (impact.affectedResources.length) sections.push('RESOURCES: ' + impact.affectedResources.map(r => `${r.label}(${r.type})`).slice(0, 8).join(', '));
      return { success: true, output: sections.join('\n') };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
