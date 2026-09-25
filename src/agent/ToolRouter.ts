import { ToolSchema } from '../types/index.js';

/** Small keyword router that keeps irrelevant tools out of provider requests. */
export class ToolRouter {
  private readonly maxTools: number;

  constructor(maxTools = 20) {
    this.maxTools = Math.max(1, maxTools);
  }

  select(userMessage: string, schemas: ToolSchema[]): ToolSchema[] {
    if (schemas.length <= this.maxTools) return schemas;

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
      // Group boosts: surface the right specialty tools for the job.
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

    // Never send an empty tool list when the query did not match a keyword.
    return selected.some(item => item.score > 0)
      ? selected.map(item => item.schema)
      : schemas.slice(0, this.maxTools);
  }
}
