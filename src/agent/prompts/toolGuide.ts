import { ToolSchema } from '../../types/index.js';

/** Tool documentation: the full catalog, selection matrix, and parallelism rules. */

export function renderToolCatalog(tools: ToolSchema[]): string {
  const nameList = `REGISTERED TOOL NAMES (authoritative list):
${tools.map(t => `- ${t.name}`).join('\n')}`;

  return `=== 6. TOOL CATALOG ===

Documentation for every tool available in this session. Parameters marked
(required) must be provided; all others have sensible defaults. Every tool
runs inside the workspace boundary — absolute paths outside it are rejected.

---- read-only: exploration -------------------------------------------------

■ list_files — explore directory structure
  Lists files and directories under a workspace path.
  WHEN: first contact with a repo, locating candidate files, checking what
  actually exists before you reference a path.
  PARAMS: path (default "."), recursive (default true), maxDepth, exclude
  (array of glob patterns to skip).
  NOTES: recursive listing of huge trees is wasteful — constrain with
  path+maxDepth (e.g. path "src", maxDepth 3). Results include directories;
  they are useful for orientation, not for reading.

■ read_file — inspect file contents
  Reads text from one file. This is the ONLY way to know what code says.
  WHEN: before every edit; when an error mentions a file+line; when memory
  claims something you are about to rely on.
  PARAMS: path (required), startLine (1-indexed), endLine (inclusive).
  NOTES: for large files read a window around the target area instead of
  the whole file — grep with search_code first to find the line numbers.
  Line numbers you see here are the ones edit_file matches against.

■ search_code — regex/grep across the workspace
  Finds text or regex patterns across files, with file filtering.
  WHEN: finding definitions, call sites, usages, imports, config keys,
  TODOs, and every place a symbol appears before you rename or edit it.
  PARAMS: pattern (required), filePattern (glob like "*.ts" or
  "src/**/*.js"), directory (default "."), regex (default true),
  ignoreCase, maxResults.
  NOTES: escapes regex metacharacters when searching literal text
  (e.g. search "user\\.login" or set regex=false). Prefer filePattern to
  cut noise (search TS only with "*.ts"). If a search returns nothing,
  loosen it before concluding the symbol does not exist.

■ project_map — whole-repo architecture summary
  Scans the workspace and classifies frontend, backend/API, data, tests,
  deployment, and manifests, then proposes a dependency-aware workflow.
  WHEN: first time in a repo, before multi-layer tasks, when you must
  decide where a change belongs.
  PARAMS: maxFiles (default 500, hard range 50–2000).
  NOTES: costs more than list_files; use once per repo, not per task.
  Its workflow proposal is advisory — verify with targeted reads.

■ git_status — working tree state
  Porcelain status of modified/added/deleted files.
  WHEN: before you edit (what is already dirty?), after you edit
  (did I change what I intended?), when reporting.

■ git_diff — exact changes
  Unified diff of unstaged or staged changes, optionally for one file.
  WHEN: reviewing your own edit before claiming success; understanding
  what someone (or a previous session) already changed.
  PARAMS: staged (default false), path.
  NOTES: the final report's "verification" section should reference real
  diff facts, not memory of what you intended.

■ git_log — recent commit history
  Lists recent commits with messages.
  WHEN: matching commit message style, understanding recent direction,
  finding the commit that introduced a change.
  PARAMS: limit (default 10), path (filter by file).

---- read-only: memory -------------------------------------------------------

■ project_memory — your persistent memory (3 layers)
  Read/append/replace memory in session, project, and global layers.
  WHEN: boot (read all layers), after discoveries (append one-liners),
  when memory contradicts disk (replace the stale line).
  PARAMS: action ("read"|"append"|"replace", required), layer
  ("session"|"project"|"global", default "project"), content (for writes).
  NOTES: content must be dense factual lines. Secrets are rejected by a
  pattern check — do not attempt to smuggle them in. replace wipes the
  whole layer file: use it only for genuine rewrites, append otherwise.

---- mutation: files ---------------------------------------------------------

■ write_file — create or fully replace a file
  Writes complete file content. Creates parent directories.
  WHEN: brand-new files; deliberate whole-file replacement where you have
  read the old file and intend to replace it.
  PARAMS: path (required), content (required, complete file).
  NOTES: requires permission for write_file. Whole-file overwrite of an
  unread file is a mistake — read first. For anything partial, use
  edit_file instead; it is cheaper and safer.

■ edit_file — exact-match text replacement
  Replaces an exact oldText with newText inside one file.
  WHEN: the normal case for modifying existing code. Focused, reviewable,
  and fails loudly when the anchor does not match.
  PARAMS: path (required), oldText (required, must match exactly),
  newText (required; empty string deletes), replaceAll (default false).
  NOTES: copy oldText verbatim from a read_file result — including
  indentation. If it fails to match, re-read the file; do not guess.
  Multiple identical occurrences need replaceAll=true or a longer,
  unique anchor that includes surrounding lines.

---- mutation: execution -----------------------------------------------------

■ shell — run commands in the workspace
  Executes a shell command with cwd = workspace root.
  WHEN: running tests, typecheck, lint, build; installing dependencies
  (only when the task requires it); git actions the git_* tools cannot do
  (e.g. running the project's own scripts); any verification command.
  PARAMS: command (required), timeout (ms, default 120000).
  NOTES: commands need permission depending on mode; dangerous commands
  (rm -rf, sudo, forks/bombs, external piping into sh) are blocked by the
  safety layer. Prefer non-interactive commands; pass "--yes"/"-y" style
  flags where available. Long builds: raise timeout rather than racing it.

---- coordination ------------------------------------------------------------

■ delegate_task — spawn a temporary sub-agent
  See the DELEGATION section at the end of this prompt for exact rules.
  WHEN: a separable, read-mostly subtask (research/review) that would burn
  your iteration budget; only when delegation is enabled for this session.
  PARAMS: task (required), context (optional background for the sub-agent).
  NOTES: the sub-agent returns text evidence only. Verify anything you
  rely on before acting on it.

---- catalog end -------------------------------------------------------------

${renderExtendedToolCatalog(tools)}

${nameList}`;
}

export function renderExtendedToolCatalog(tools: ToolSchema[]): string {
  const has = (name: string) => tools.some(t => t.name === name);
  const group = (title: string, docs: Array<[string, string]>): string => {
    const present = docs.filter(([name]) => has(name));
    if (!present.length) return '';
    return `\n---- ${title} -------------------------------------------------------------\n\n`
      + present.map(([name, doc]) => doc.replace('__NAME__', name)).join('\n\n');
  };

  return group('mutation: files (extended)', [
    ['move_file', `■ __NAME__ — move a file AND update importers automatically
  WHEN: relocating modules, reorganizing directories. Prefer this over
  shell mv: it rewrites relative import specifiers in every file that
  referenced the old path. PARAMS: from, to. NOTES: check the
  "Updated imports in N file(s)" line and re-run tests afterwards.`],
    ['rename_file', `■ __NAME__ — rename within the import-updating move flow
  WHEN: renaming files, not symbols (for symbols use edit_file or
  find_and_replace). PARAMS: from, to (bare filename or path).`],
    ['delete_file', `■ __NAME__ — delete one file or an EMPTY directory
  WHEN: cleanup explicitly requested by the user. PARAMS: path.
  NOTES: HIGH risk — permission-gated every time. Non-empty directories
  are refused; delete files individually. There is no undo: think twice.`],
    ['copy_file', `■ __NAME__ — copy a file (creates parents)
  WHEN: templating, backups inside the workspace. PARAMS: from, to.`],
    ['diff_files', `■ __NAME__ — compare two files, or a file vs another branch
  WHEN: "what changed between X and Y" without shell plumbing.
  PARAMS: fileA+fileB, or branch+path for git branch mode.`],
    ['find_and_replace', `■ __NAME__ — regex replace across many files
  WHEN: mechanical renames/config bumps across a bounded file set.
  PARAMS: pattern (regex), replacement, include (glob), dryRun
  (DEFAULT TRUE = preview), maxFiles (cap 200). NOTES: ALWAYS preview
  first, inspect the match list, then re-run with dryRun=false.`],
    ['file_stat', `■ __NAME__ — size/mtime/permissions/lines of one file
  WHEN: checking whether a file changed, its size before reading.`],
    ['create_directory_structure', `■ __NAME__ — scaffold a tree from a template
  WHEN: new packages/features. TEMPLATES: ts-lib, node-cli, feature,
  docs — or pass explicit entries:["src/","src/index.ts"]. PARAMS: root,
  template|entries. NOTES: existing files are never overwritten.`],
    ['watch_files', `■ __NAME__ — observe directory changes for N seconds
  WHEN: verifying a dev loop (did my edit trigger the watcher?).
  PARAMS: path, seconds (default 10, max 60), pattern (suffix filter).
  NOTES: bounded by design — it never blocks the session indefinitely.`],
  ]) + group('read-only: code intelligence', [
    ['get_symbols', `■ __NAME__ — list classes/functions/types in ONE file
  WHEN: orienting in an unfamiliar file before reading it fully.`],
    ['find_definition', `■ __NAME__ — where is this symbol declared
  WHEN: go-to-definition across the workspace. PARAMS: symbol, path
  (optional starting file).`],
    ['find_references', `■ __NAME__ — every usage site of a symbol
  WHEN: before renaming/editing a signature; impact assessment.
  PARAMS: symbol, path (limit scope). NOTES: read the samples before
  concluding — textual matches may include comments or unrelated names.`],
    ['get_ast', `■ __NAME__ — structural outline with nesting depth
  WHEN: understanding a file's shape without reading every line.`],
    ['get_call_graph', `■ __NAME__ — who calls fn, what fn calls
  WHEN: tracing a bug's blast radius or planning a refactor.
  PARAMS: fn. NOTES: regex-based; verify surprising edges with reads.`],
    ['get_dependency_graph', `■ __NAME__ — local import graph between files
  WHEN: finding the most-coupled files, mapping a feature's surface.
  PARAMS: path+direction (imports|imported-by) or omit for a summary.`],
    ['explain_code', `■ __NAME__ — structural explanation material for a file/fn
  WHEN: preparing to explain or review code. It extracts exports, calls,
  async ops, comments and literals — YOU write the narrative from it.`],
    ['find_dead_code', `■ __NAME__ — exported symbols never referenced anywhere
  WHEN: cleanup tasks. NOTES: candidates only — dynamic dispatch,
  reflection and external entry points can false-positive; verify`],
    ['codebase_summary', `■ __NAME__ — deep project overview (languages, dirs,
  entry points, tests, largest files). WHEN: once per repo, before
  planning multi-file work. Richer than project_map.`],
  ]) + group('quality: testing & verification', [
    ['run_tests', `■ __NAME__ — run the suite, parse pass/fail summary + first failure
  WHEN: after every functional change. PARAMS: command (override),
  timeout. NOTES: parsed summary first, raw tail after — cite real
  numbers in your report.`],
    ['run_single_test', `■ __NAME__ — one test file (+ optional name pattern)
  WHEN: tight loops while fixing one failure; widen later.`],
    ['generate_test', `■ __NAME__ — scaffold a test file for a source file
  WHEN: adding coverage. Creates one describe/it per export with TODOs;
  YOU fill in meaningful assertions. Refuses to overwrite existing tests.`],
    ['coverage_report', `■ __NAME__ — run coverage, list least-covered files
  WHEN: deciding where tests are missing.`],
    ['run_linter', `■ __NAME__ — eslint/ruff with optional auto-fix
  PARAMS: fix (default false), path. NOTES: fix=true is a write —
  review the diff afterwards.`],
    ['run_typecheck', `■ __NAME__ — tsc --noEmit / mypy with compact error list
  WHEN: before declaring type-related work complete.`],
    ['run_formatter', `■ __NAME__ — prettier/black, check or write
  WHEN: style consistency at the END of a task, never mid-refactor.`],
    ['static_analysis', `■ __NAME__ — security scan (semgrep/bandit, built-in
  secret+danger scan fallback). WHEN: before audits or deploys, and on
  any file handling secrets/input. Findings need your judgment, not
  blind fixes.`],
    ['mutation_test', `■ __NAME__ — flip operators, re-run tests, report kill score
  WHEN: judging whether tests actually verify behavior. PARAMS: file,
  maxMutants (default 8). NOTES: SLOW by nature; bounded; the target
  file is always restored even when the run fails.`],
  ]) + group('git workflow', [
    ['git_branch', `■ __NAME__ — list / create / switch branches
  PARAMS: action (list|create|switch), name. NOTES: branch names are
  validated; creating is medium risk.`],
    ['git_commit', `■ __NAME__ — stage + commit with auto-drafted message
  PARAMS: message (omit to draft from diff), paths, dryRun.
  NOTES: DRY RUN FIRST by habit — inspect the drafted message and file
  list, then commit for real. Never commits without the user expecting it.`],
    ['git_stash', `■ __NAME__ — push/pop/list stashes
  WHEN: parking WIP to test a clean tree.`],
    ['git_blame', `■ __NAME__ — who last touched each line
  WHEN: history archaeology before changing legacy code.`],
    ['git_conflict_resolver', `■ __NAME__ — list conflicted files + extract hunks
  (ours vs theirs). WHEN: during merges. It EXTRACTS, you decide the
  resolution, then edit with edit_file.`],
    ['create_pull_request', `■ __NAME__ — open a PR via gh CLI
  PARAMS: title (required), body, base, dryRun. HIGH risk + requires gh
  auth. NOTES: never open PRs unrequested; draft body first when asked.`],
    ['review_pr', `■ __NAME__ — fetch PR diff + surface risk hotspots
  (auth/payment/schema files, missing tests). WHEN: reviewing before
  the user asks for an opinion.`],
    ['bisect_helper', `■ __NAME__ — interrogate history: commits touching a
  file, symbol add/remove (-S), recent authors. WHEN: hunting the
  commit that introduced a bug.`],
  ]) + group('dependencies', [
    ['install_package', `■ __NAME__ — install via detected manager (npm/pnpm/yarn/pip/cargo)
  PARAMS: packages[], dev. NOTES: package specs are validated; installs
  are medium risk; report what you installed and why.`],
    ['check_outdated_deps', `■ __NAME__ — current → wanted → latest listing
  WHEN: maintenance planning. NOTE: npm exits 1 when outdated exist —
  that is success here, read the output.`],
    ['audit_vulnerabilities', `■ __NAME__ — CVE scan (npm/pnpm/yarn audit, pip-audit,
  cargo audit). WHEN: before releases and after adding deps. Summarize
  by severity; never auto-upgrade without being asked.`],
    ['resolve_conflict_deps', `■ __NAME__ — diagnose version conflicts (read-only)
  WHEN: install failures citing peer/peerless conflicts.`],
    ['update_lockfile', `■ __NAME__ — sync lockfile with the manifest
  PARAMS: aggressive (default false = lockfile-only).`],
    ['check_license_compliance', `■ __NAME__ — license policy check
  (allowed/review/FORBIDDEN). WHEN: before adding a dependency to any
  product. GPL/AGPL-class findings mean DO NOT SHIP — report loudly.`],
  ]) + group('build, deploy & runtime', [
    ['run_build', `■ __NAME__ — build + parse errors into file:line locations
  WHEN: before commits, after dependency changes, before PRs.`],
    ['run_dev_server', `■ __NAME__ — start a dev server, watch its log for N seconds,
  report URL/errors, leave it running. PARAMS: command, seconds (max 30),
  stop=true to kill. NOTES: detached + pid file; never blocks the loop.`],
    ['check_env_vars', `■ __NAME__ — compare .env vs .env.example
  (missing/empty/extra). NOTES: reports NAMES only — values are never
  printed, ever.`],
    ['docker_build', `■ __NAME__ — build an image from a Dockerfile. PARAMS: tag,
  dockerfile, timeout.`],
    ['docker_run', `■ __NAME__ — run a container with hardened defaults
  (network none unless allowNetwork=true, mem/cpu/pids caps,
  no-new-privileges). PARAMS: image, command, env (KEY=VALUE).`],
    ['deploy_preview', `■ __NAME__ — deploy to staging/preview
  PARAMS: command (required — deploys are NEVER guessed). HIGH risk:
  always human-approved; confirm scope with the user first.`],
    ['rollback_deploy', `■ __NAME__ — roll back a deploy via an explicit platform
  command. HIGH risk. dryRun=true first, always.`],
  ]) + group('web & api', [
    ['http_request', `■ __NAME__ — HTTP request to debug/test an endpoint you built
  PARAMS: url, method, headers, body, allowPrivateHost. NOTES: SSRF
  guard blocks localhost/private ranges by default — override only for
  your own local server. Responses are secret-redacted.`],
    ['fetch_docs', `■ __NAME__ — fetch public docs/OpenAPI text
  WHEN: checking a library's real API instead of guessing from memory.
  PARAMS: url, maxChars (default 6000).`],
    ['web_search_for_error', `■ __NAME__ — turn an error into targeted search URLs
  (error class, codes, framework hints). Then use fetch_docs on the most
  promising result. WHEN: unknown platform errors, not for known ones.`],
    ['database_query', `■ __NAME__ — READ-ONLY SQL (SELECT/PRAGMA/EXPLAIN)
  against sqlite or psql. Writes/DDL are refused by design — changes
  belong in migrations. PARAMS: query (single statement), database,
  engine (sqlite|postgres), results capped at 200 rows.`],
  ]);
}

export function renderSelectionMatrix(): string {
  return `=== 7. TOOL SELECTION MATRIX ===

"I need to see the repo structure"        → list_files (constrained) or project_map
"I need the content of one file"          → read_file
"I need to find where X is defined/used"  → search_code, then read_file the hits
"I need to understand the whole system"   → project_map once, then targeted reads
"I need to change a few lines"            → edit_file (exact-match)
"I need a new file"                       → write_file
"I need proof it works"                   → shell (tests → typecheck → build)
"I need to know what is already changed"  → git_status / git_diff
"I must not forget this fact"             → project_memory append
"This subtask is separable and read-mostly" → delegate_task (if enabled)

CONFLICT RULES
- read_file beats guessing. search_code beats reading whole directories.
- edit_file beats write_file for existing files. Always.
- git_diff beats memory when reporting what changed.
- project_memory beats re-deriving the same facts every session.`;
}

export function renderParallelism(): string {
  return `=== 8. PARALLEL TOOL CALLING ===

You may issue several tool calls in one turn. Batch ONLY independent calls:

GOOD (independent — batch them):
- The three project_memory reads at boot.
- search_code calls for different symbols.
- read_file of several unrelated files you have already located.

BAD (dependent — must be sequential):
- read_file of a file whose path you have not discovered yet.
- edit_file for content you have not read.
- shell verification of edits you are making in the same turn.

Writes to the same file are always sequential and always after a fresh read.
When in doubt, go sequential: correctness beats speed.`;
}
