import { ToolSchema } from '../types/index.js';

interface LayaAnswer {
  noul?: number;
  choice?: string;
  confidence?: number;
}

interface LayaResponse {
  answers?: Record<string, LayaAnswer>;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string } }> } }>;
}

export type RouterMode = 'chain' | 'laya' | 'xlam' | 'keyword';

const XLAM_SYSTEM_PROMPT =
  'You are a tool-selection assistant. Given the user request and the available tools, ' +
  'select the tools most relevant to fulfilling the request. Call at most one function per ' +
  'relevant tool. Select nothing if no tool is relevant.';

/** Routes tools per user message. Modes (AGENT_TOOL_ROUTER, default "chain"):
 *  - chain: xLAM proposes a shortlist, laya verifies each pick, keyword fallback
 *  - laya / xlam: single model only
 *  - keyword: legacy keyword heuristic
 *  Any model stage that is unreachable or times out degrades to the next stage. */
export class ToolRouter {
  private readonly maxTools: number;
  private readonly mode: RouterMode;
  private readonly verify: boolean;
  private readonly layaEndpoint: string;
  private readonly xlamEndpoint: string;
  private readonly xlamModel: string;
  private readonly timeoutMs: number;

  constructor(maxTools = 20, options?: { mode?: RouterMode; verify?: boolean }) {
    this.maxTools = Math.max(1, maxTools);
    this.mode = options?.mode
      ?? (process.env.AGENT_TOOL_ROUTER as RouterMode | undefined)
      ?? 'chain';
    this.verify = options?.verify
      ?? (process.env.AGENT_TOOL_ROUTER_VERIFY !== 'off');
    this.layaEndpoint = process.env.LAYA_ROUTER_URL ?? 'http://127.0.0.1:8000/v1/systemone';
    this.xlamEndpoint = process.env.XLAM_ROUTER_URL ?? 'http://127.0.0.1:11434/v1/chat/completions';
    this.xlamModel = process.env.XLAM_ROUTER_MODEL ?? 'xlam';
    this.timeoutMs = Number(process.env.AGENT_TOOL_ROUTER_TIMEOUT_MS ?? 1500);
  }

  async select(userMessage: string, schemas: ToolSchema[]): Promise<ToolSchema[]> {
    if (schemas.length <= this.maxTools) return schemas;

    if (this.mode === 'keyword') return this.selectByKeywords(userMessage, schemas);

    if (this.mode === 'xlam') {
      const picks = await this.proposeWithXlam(userMessage, schemas);
      if (picks) return this.finalize(picks, schemas);
      return this.selectByKeywords(userMessage, schemas);
    }

    if (this.mode === 'laya') {
      const scores = await this.scoreWithLaya(userMessage, schemas);
      if (scores) return this.finalize([...scores.keys()], schemas, scores);
      return this.selectByKeywords(userMessage, schemas);
    }

    // chain: xLAM proposes, laya verifies, keyword is the last resort.
    const picks = await this.proposeWithXlam(userMessage, schemas);
    if (!picks) return this.selectByKeywords(userMessage, schemas);

    if (!this.verify) return this.finalize(picks, schemas);

    const shortlist = schemas.filter(schema => picks.includes(schema.name));
    const scores = await this.scoreWithLaya(userMessage, shortlist);
    if (!scores) return this.finalize(picks, schemas);

    const verified = shortlist
      .filter(schema => (scores.get(schema.name) ?? 0) >= 0.5)
      .map(schema => schema.name);
    // Every xLAM pick rejected by laya: distrust the chain, fall back to laya's own ranking.
    if (verified.length === 0) return this.finalize([...scores.keys()], schemas, scores);
    return this.finalize(verified, schemas);
  }

  /** Build the final list: picked tools first, then pad from remaining schemas. */
  private finalize(picks: string[], schemas: ToolSchema[], scores?: Map<string, number>): ToolSchema[] {
    const picked = schemas.filter(schema => picks.includes(schema.name));
    const rest = schemas.filter(schema => !picks.includes(schema.name));
    if (scores) {
      rest.sort((a, b) => (scores.get(b.name) ?? 0) - (scores.get(a.name) ?? 0));
    }
    return [...picked, ...rest].slice(0, this.maxTools);
  }

  /** xLAM proposes a shortlist via OpenAI-compatible native tool calling. */
  private async proposeWithXlam(userMessage: string, schemas: ToolSchema[]): Promise<string[] | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(this.xlamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.xlamModel,
          messages: [
            { role: 'system', content: XLAM_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `User request: ${userMessage}\n\nSelect the most relevant tools.`,
            },
          ],
          tools: schemas.map(schema => ({
            type: 'function',
            function: { name: schema.name, description: schema.description, parameters: schema.input_schema },
          })),
          tool_choice: 'auto',
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const data = (await response.json()) as OpenAIChatResponse;
      const calls = data.choices?.[0]?.message?.tool_calls;
      if (!calls || calls.length === 0) return null;
      const names = calls
        .map(call => call.function?.name)
        .filter((name): name is string => !!name && schemas.some(schema => schema.name === name));
      return names.length > 0 ? [...new Set(names)] : null;
    } catch {
      return null;
    }
  }

  /** One laya call, one noul question per tool, all scored in a single forward pass. */
  private async scoreWithLaya(userMessage: string, schemas: ToolSchema[]): Promise<Map<string, number> | null> {
    if (schemas.length === 0) return null;
    const questions: Record<string, unknown> = {};
    for (const schema of schemas) {
      questions[schema.name] = {
        type: 'noul',
        instructions: `Is the tool "${schema.name}" (${schema.description}) the most relevant tool for the user's request?`,
      };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(this.layaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: { document: userMessage }, questions }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const data = (await response.json()) as LayaResponse;
      const answers = data.answers;
      if (!answers) return null;
      const scores = new Map<string, number>();
      for (const [name, answer] of Object.entries(answers)) {
        if (typeof answer?.noul === 'number') scores.set(name, answer.noul);
      }
      return scores.size > 0 ? scores : null;
    } catch {
      return null;
    }
  }

  /** Legacy keyword fallback, used only when the models are unavailable. */
  private selectByKeywords(userMessage: string, schemas: ToolSchema[]): ToolSchema[] {
    const query = userMessage.toLowerCase();
    const scored = schemas.map((schema, index) => {
      const text = `${schema.name} ${schema.description}`.toLowerCase();
      let score = 0;
      for (const token of query.split(/[^a-z0-9_]+/).filter(token => token.length > 2)) {
        if (text.includes(token)) score += 2;
      }
      if (/read|inspect|find|search|look|list|understand|review/.test(query) &&
          /read|list|search|status|diff|log|map/.test(schema.name)) score += 4;
      if (/write|edit|change|fix|create|delete|implement/.test(query) &&
          /write|edit|shell|git/.test(schema.name)) score += 4;
      if (/test|build|run|command|npm|yarn|pnpm/.test(query) && schema.name === 'shell') score += 8;
      if (/test|coverage|lint|format|typecheck|mutation/.test(query) && /^(run_tests|run_single_test|coverage_report|run_linter|run_typecheck|run_formatter|mutation_test)$/.test(schema.name)) score += 8;
      if (/refactor|rename|move|delete|copy|scaffold|watch/.test(query) && /^(move_file|rename_file|delete_file|copy_file|find_and_replace|create_directory_structure|watch_files)$/.test(schema.name)) score += 8;
      if (/branch|commit|stash|blame|conflict|pull request|pr|bisect|merge/.test(query) && /^(git_branch|git_commit|git_stash|git_blame|git_conflict_resolver|create_pull_request|review_pr|bisect_helper)$/.test(schema.name)) score += 8;
      if (/install|dependency|package|outdated|audit|license|lockfile/.test(query) && /^(install_package|check_outdated_deps|audit_vulnerabilities|resolve_conflict_deps|update_lockfile|check_license_compliance)$/.test(schema.name)) score += 8;
      if (/deploy|docker|build|dev server|env var|rollback|preview/.test(query) && /^(run_build|run_dev_server|check_env_vars|docker_build|docker_run|deploy_preview|rollback_deploy)$/.test(schema.name)) score += 8;
      if (/http|api|endpoint|request|docs|search|database|query|sql/.test(query) && /^(http_request|fetch_docs|web_search_for_error|database_query)$/.test(schema.name)) score += 8;
      if (/definition|references|ast|call graph|dependency graph|symbol|explain|dead code|summary/.test(query) && /^(find_definition|find_references|get_ast|get_call_graph|get_dependency_graph|get_symbols|explain_code|find_dead_code|codebase_summary)$/.test(schema.name)) score += 8;
      return { schema, score, index };
    });

    const selected = scored
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, this.maxTools);

    return selected.some(item => item.score > 0)
      ? selected.map(item => item.schema)
      : schemas.slice(0, this.maxTools);
  }
}
