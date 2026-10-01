import { ToolSchema } from '../types/index.js';

interface LayaAnswer {
  noul?: number;
  choice?: string;
  confidence?: number;
}

interface LayaResponse {
  answers?: Record<string, LayaAnswer>;
}

/** Routes tools per user message. Prefers a small local decision model
 *  (laya-serve, Jev-compatible POST /v1/systemone); falls back to a
 *  keyword heuristic when the model endpoint is unreachable. */
export class ToolRouter {
  private readonly maxTools: number;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(maxTools = 20, endpoint?: string, timeoutMs = 1500) {
    this.maxTools = Math.max(1, maxTools);
    this.endpoint = endpoint ?? process.env.LAYA_ROUTER_URL ?? 'http://127.0.0.1:8000/v1/systemone';
    this.timeoutMs = timeoutMs;
  }

  async select(userMessage: string, schemas: ToolSchema[]): Promise<ToolSchema[]> {
    if (schemas.length <= this.maxTools) return schemas;

    const modelScores = await this.scoreWithModel(userMessage, schemas);
    if (modelScores) {
      const ranked = schemas
        .map((schema, index) => ({ schema, index, score: modelScores.get(schema.name) ?? 0 }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = ranked.slice(0, this.maxTools).map(item => item.schema);
      // Keep at least one tool the model actually considered relevant.
      if (modelScores.size > 0) return selected;
    }
    return this.selectByKeywords(userMessage, schemas);
  }

  /** One laya call, one noul question per tool, all scored in a single forward pass. */
  private async scoreWithModel(userMessage: string, schemas: ToolSchema[]): Promise<Map<string, number> | null> {
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
      const response = await fetch(this.endpoint, {
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

  /** Legacy keyword fallback, used only when the decision model is unreachable. */
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
