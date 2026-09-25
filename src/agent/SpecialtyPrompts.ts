/**
 * SpecialtyPrompts — a library of focused "burst" prompt modules.
 *
 * The main system prompt (SystemPrompt.ts) stays the stable operating
 * manual. On top of it, this router injects a handful of SHORT specialty
 * modules that are relevant RIGHT NOW (this iteration) and drops them when
 * they stop being relevant — prompts flow in and out in real time.
 *
 * Matching is deterministic (keyword scoring over the user's message plus
 * recent tool activity), so it costs nothing and never calls the model.
 */

export type SpecialtyCategory =
  | 'debugging' | 'testing' | 'git' | 'frontend' | 'backend' | 'database'
  | 'security' | 'performance' | 'dependencies' | 'devops' | 'docs'
  | 'refactoring' | 'types' | 'data' | 'workflow' | 'communication';

export interface SpecialtyPrompt {
  id: string;
  category: SpecialtyCategory;
  title: string;
  /** Keyword groups; a card scores +1 per group matched in the context. */
  keywords: RegExp[];
  /** The injected prompt body — dense, 1–4 lines. */
  prompt: string;
}

export const SPECIALTY_PROMPTS: SpecialtyPrompt[] = [
  // --- debugging -----------------------------------------------------------
  { id: 'debug-root-cause', category: 'debugging', title: 'Root cause first',
    keywords: [/debug/i, /\bbug\b/i, /\bfix\b/i, /แก้บัค/i, /ไม่ทำงาน/i],
    prompt: 'Fix the cause, not the symptom. State the root cause in one line before editing; if you cannot name it, investigate more first.' },
  { id: 'debug-read-error', category: 'debugging', title: 'Read the actual error',
    keywords: [/\berror\b/i, /exception/i, /traceback/i, /error ขึ้น/i],
    prompt: 'Quote the exact failing line to yourself, map it to code, form ONE hypothesis per attempt. Never stack multiple fixes in one round.' },
  { id: 'debug-reproduce', category: 'debugging', title: 'Reproduce before fixing',
    keywords: [/\breproduce\b/i, /cannot reproduce/i, /intermittent/i, /flaky/i],
    prompt: 'Establish a minimal reliable reproduction (command or input) before changing code. A fix you cannot trigger, you cannot verify.' },
  { id: 'debug-bisect', category: 'debugging', title: 'Bisect, don\u2019t guess',
    keywords: [/\bbisect\b/i, /\bwhere\b.{0,20}\b(broken|wrong)\b/i, /regression/i],
    prompt: 'Search space too big? Halve it: comment/checkout to isolate the change or commit that introduced the fault, then narrow.' },
  { id: 'debug-logging', category: 'debugging', title: 'Trace with temporary logging',
    keywords: [/console\.log/i, /\blog\b.{0,15}(debug|trace)/i, /print/i],
    prompt: 'When state is unclear, add temporary logs at boundaries (entry/exit/branch), run once, read, remove them before finishing.' },
  { id: 'debug-stack-trace', category: 'debugging', title: 'Stack trace bottom-up',
    keywords: [/stack\s*trace/i, /at .+ \(.*:\d+/, /\bcrash(es|ed)?\b/i],
    prompt: 'Read stack traces from YOUR code upward: first frame in this repo is where to look; frames in node_modules are context, not suspects.' },

  // --- testing -------------------------------------------------------------
  { id: 'test-write-unit', category: 'testing', title: 'Write a unit test',
    keywords: [/unit\s*test/i, /\btest\b.{0,15}\b(add|write|create)\b/i, /เขียนเทส/i],
    prompt: 'One test = one reason to fail. Arrange–Act–Assert, public behavior only, no shared mutable state, name = scenario.' },
  { id: 'test-fix-failing', category: 'testing', title: 'Fix failing test',
    keywords: [/failing\s*test/i, /test.{0,10}(fail|red)/i, /assertion/i, /เทสพัง/i],
    prompt: 'Run ONLY the failing test first. Decide honestly: code bug, test outdated, or environment issue. Never just delete the test.' },
  { id: 'test-run-narrow', category: 'testing', title: 'Run the narrow test first',
    keywords: [/npm\s+test/i, /pytest/i, /\bjest\b/i, /\bvitest\b/i, /รันเทส/i],
    prompt: 'Run the single relevant file/filter first for a tight loop; widen to the full suite only for risky or cross-cutting changes.' },
  { id: 'test-coverage-gap', category: 'testing', title: 'Cover the gap you found',
    keywords: [/coverage/i, /untested/i, /edge\s*case/i],
    prompt: 'If verification exposed an untested branch, add the smallest test that pins it — regression insurance for the next session.' },
  { id: 'test-mock-discipline', category: 'testing', title: 'Mock discipline',
    keywords: [/\bmock\b/i, /\bstub\b/i, /\bspies\b/i],
    prompt: 'Mock boundaries (network, clock, fs), not the code under test. A test mocking internals tests nothing but itself.' },

  // --- git -----------------------------------------------------------------
  { id: 'git-commit-style', category: 'git', title: 'Match commit style',
    keywords: [/commit/i, /\bgit\b.{0,10}\bcommit\b/i, /อัพเดท git/i],
    prompt: 'Check git_log for the repo\u2019s message style; write intent (why) in the subject, inventory in the body. Stage only files you touched.' },
  { id: 'git-diff-review', category: 'git', title: 'Review your own diff',
    keywords: [/\bdiff\b/i, /review.{0,12}change/i, /self.?review/i],
    prompt: 'Before claiming done: git_diff, read it as a stranger, revert anything unrelated that snuck in.' },
  { id: 'git-safe-revert', category: 'git', title: 'Safe revert path',
    keywords: [/revert/i, /undo/i, /rollback/i, /ย้อน/i],
    prompt: 'Prefer git_checkout/restore of specific files over reset --hard; never rewrite shared history.' },
  { id: 'git-archaeology', category: 'git', title: 'History archaeology',
    keywords: [/who\s+wrote/i, /when.{0,15}(introduced|added)/i, /blame/i, /git\s+log/i],
    prompt: 'git_log on the file (and blame via shell) explains WHY code looks like this — read it before judging or changing.' },

  // --- frontend ------------------------------------------------------------
  { id: 'fe-component-style', category: 'frontend', title: 'Component conventions',
    keywords: [/\bcomponent\b/i, /\bjsx\b|\btsx\b/i, /react/i, /vue/i, /svelte/i],
    prompt: 'Match the existing component style: file naming, props shape, hooks usage, styling system. Copy neighbors, don\u2019t invent.' },
  { id: 'fe-css-consistency', category: 'frontend', title: 'CSS/styling consistency',
    keywords: [/\bcss\b/i, /tailwind/i, /styled?/i, /\bstyle\b|styling/i, /ธีม/i, /สี/i],
    prompt: 'Use the project\u2019s styling tokens/variables (colors, spacing) — never hard-code values that already exist as design tokens.' },
  { id: 'fe-state', category: 'frontend', title: 'State management fit',
    keywords: [/\bstate\b/i, /\bstore\b/i, /redux|zustand|context|pinia/i],
    prompt: 'Lift state no higher than needed; local first, store only when shared. Follow the existing store patterns exactly.' },
  { id: 'fe-a11y', category: 'frontend', title: 'Accessibility basics',
    keywords: [/accessib|a11y/i, /aria-/i, /screen\s*reader/i],
    prompt: 'Semantic elements, labeled inputs, keyboard paths, focus visibility. If you add a div-with-onClick, you probably wanted a button.' },
  { id: 'fe-responsive', category: 'frontend', title: 'Responsive check',
    keywords: [/responsive/i, /mobile/i, /breakpoint/i, /viewport/i],
    prompt: 'Check the narrow viewport after UI changes: overflow, tap targets, wrapped text. Desktop-only verification is half verification.' },

  // --- backend / api -------------------------------------------------------
  { id: 'be-endpoint-contract', category: 'backend', title: 'Respect endpoint contracts',
    keywords: [/endpoint/i, /\bapi\b/i, /\broute\b/i, /controller/i],
    prompt: 'Existing request/response shapes are contracts. Extend with optional fields; breaking changes need explicit task-level intent.' },
  { id: 'be-validation', category: 'backend', title: 'Validate at the boundary',
    keywords: [/validat/i, /\bschema\b.{0,15}input/i, /zod|joi|yup/i],
    prompt: 'Validate every external input at the boundary (body, query, params) with the project\u2019s validation lib; reject early with clear errors.' },
  { id: 'be-error-responses', category: 'backend', title: 'Consistent error responses',
    keywords: [/error\s*(response|handler)/i, /status\s*code/i, /400|404|500/i],
    prompt: 'Match the existing error envelope and status-code conventions; never leak stack traces or internals to clients.' },
  { id: 'be-auth-flow', category: 'backend', title: 'Auth flow care',
    keywords: [/\bauth\b/i, /login|logout|session|jwt|token/i],
    prompt: 'Auth changes get paranoid review: which checks protect this route, what happens unauthenticated/expired. Never weaken silently.' },
  { id: 'be-pagination', category: 'backend', title: 'Pagination & limits',
    keywords: [/paginat/i, /limit.{0,10}offset/i, /\bcursor\b/i, /\blist\s*endpoint/i],
    prompt: 'List endpoints need bounded queries (limit/cursor) — unbounded selects are a production incident waiting for data.' },

  // --- database ------------------------------------------------------------
  { id: 'db-migration-safety', category: 'database', title: 'Migration safety',
    keywords: [/migration/i, /\bschema\b.{0,12}(change|alter)/i, /alter\s+table/i],
    prompt: 'Migrations must be additive-first and reversible; never drop/rename columns without an explicit task requirement and a data plan.' },
  { id: 'db-query-perf', category: 'database', title: 'Query performance',
    keywords: [/\bquery\b.{0,15}(slow|perf)/i, /\bindex\b/i, /\bexplain\b/i, /n\+1/i],
    prompt: 'Measure before optimizing (EXPLAIN/timing). Look for N+1 loops and missing indexes on filtered/joined columns.' },
  { id: 'db-schema-design', category: 'database', title: 'Schema design sense',
    keywords: [/\bmodel\b/i, /\bentity\b/i, /\btable\b.{0,15}(create|new)/i, /ความสัมพันธ์/i],
    prompt: 'Follow existing naming/casing for tables and columns; prefer explicit foreign keys and sensible constraints over app-level hope.' },
  { id: 'db-data-guard', category: 'database', title: 'Data-loss guard',
    keywords: [/delete\s+from/i, /truncate/i, /drop\s+table/i, /reset\s+database/i],
    prompt: 'Any destructive data operation requires an explicit task mandate. If tempted, stop and propose the safe alternative in your report.' },

  // --- security ------------------------------------------------------------
  { id: 'sec-secret-hygiene', category: 'security', title: 'Secret hygiene',
    keywords: [/\bsecret\b/i, /\bcredential/i, /\.env\b/i, /\btoken\b/i, /password/i],
    prompt: 'Never echo, log, commit, or memory-note secret values. Reference them by name; values stay in env/config.' },
  { id: 'sec-sanitize-input', category: 'security', title: 'Sanitize before use',
    keywords: [/inject/i, /\bxss\b/i, /escape/i, /sanitize/i],
    prompt: 'Parameterize queries, escape output, never concatenate user input into commands, SQL, or HTML.' },
  { id: 'sec-dep-audit', category: 'security', title: 'Dependency audit',
    keywords: [/vulnerab/i, /cve/i, /audit/i, /outdated.{0,10}(package|dependency)/i],
    prompt: 'After dep changes run the project\u2019s audit command; report findings instead of silently upgrading majors.' },
  { id: 'sec-least-privilege', category: 'security', title: 'Least privilege',
    keywords: [/permission/i, /\brole\b/i, /\badmin\b/i, /scope/i],
    prompt: 'Grant the narrowest permission that satisfies the requirement; default-deny anything not explicitly allowed.' },

  // --- performance ---------------------------------------------------------
  { id: 'perf-measure-first', category: 'performance', title: 'Measure before optimizing',
    keywords: [/performance/i, /\bslow\b/i, /\boptimize\b/i, /ช้า/i, /ประสิทธิภาพ/i],
    prompt: 'No optimization without a measurement. Baseline, change one thing, re-measure, report numbers — not vibes.' },
  { id: 'perf-hot-path', category: 'performance', title: 'Hot path focus',
    keywords: [/hot\s*path/i, /loop.{0,15}(slow|perf)/i, /\bbottleneck\b/i],
    prompt: 'Optimize inside loops and per-request paths first; allocation, IO, and serialization dominate — micro-syntax rarely matters.' },
  { id: 'perf-memory-leak', category: 'performance', title: 'Leak checklist',
    keywords: [/memory\s*leak/i, /grows?\s+unbounded/i, /\bram\b.{0,15}(high|full)/i],
    prompt: 'Hunt unremoved listeners, un-cleared timers, unbounded caches/maps. The runner already unrefs timers — check your own additions.' },
  { id: 'perf-cache-strategy', category: 'performance', title: 'Cache strategy',
    keywords: [/cache/i, /memo/i, /ttl/i],
    prompt: 'Cache only read-only, repeatable computations; define invalidation up front. This runner caches read-only tools by default.' },

  // --- dependencies --------------------------------------------------------
  { id: 'dep-add', category: 'dependencies', title: 'Adding a dependency',
    keywords: [/npm\s+(install|i)\b/, /yarn\s+add/, /pnpm\s+add/, /pip\s+install/],
    prompt: 'Justify in the report: name, version, why. Use the project\u2019s package manager (check the lockfile) and non-interactive flags.' },
  { id: 'dep-upgrade', category: 'dependencies', title: 'Upgrade safely',
    keywords: [/upgrade/i, /bump.{0,12}version/i, /major.{0,10}update/i],
    prompt: 'Read the changelog for breaking changes; upgrade one package at a time; run tests between steps.' },
  { id: 'dep-lockfile', category: 'dependencies', title: 'Lockfile discipline',
    keywords: [/lock\s*file/i, /package-lock/i, /pnpm-lock/i, /yarn\.lock/i],
    prompt: 'Lockfiles change only through the package manager, never by hand; commit them with the dependency change.' },

  // --- devops --------------------------------------------------------------
  { id: 'ops-docker', category: 'devops', title: 'Docker discipline',
    keywords: [/dockerfile/i, /docker\s+build/i, /compose/i, /\bimage\b.{0,12}(build|pull)/i],
    prompt: 'Layer order matters (deps before source), pin base images, .dockerignore noise. Build locally before claiming the image works.' },
  { id: 'ops-env-config', category: 'devops', title: 'Env & config',
    keywords: [/environment/i, /config/i, /\.env\.example/i, /variable/i],
    prompt: 'New env vars go in .env.example with a comment; code reads config through the existing loader, not scattered process.env.' },
  { id: 'ops-ci-green', category: 'devops', title: 'Keep CI green',
    keywords: [/\bci\b/i, /pipeline/i, /github\s*actions/i, /workflow/i],
    prompt: 'Check the CI config before touching scripts; run the same steps CI runs; a red pipeline is everyone\u2019s problem.' },
  { id: 'ops-deploy-caution', category: 'devops', title: 'Deploy caution',
    keywords: [/deploy/i, /release/i, /production/i, /โปรดักชั่น/i],
    prompt: 'Never deploy unless the task explicitly says so. Prefer dry-run/plan modes; state exactly what would ship.' },

  // --- docs ----------------------------------------------------------------
  { id: 'doc-readme-sync', category: 'docs', title: 'Keep README honest',
    keywords: [/readme/i, /documentation/i, /เอกสาร/i],
    prompt: 'If behavior/installation changed, update README in the same change; stale docs are bugs users see first.' },
  { id: 'doc-changelog', category: 'docs', title: 'Changelog entry',
    keywords: [/changelog/i, /release\s*notes/i, /\bversion\b.{0,10}(bump|note)/i],
    prompt: 'User-visible changes deserve a changelog line in the repo\u2019s existing format — concise, behavior-focused.' },
  { id: 'doc-inline', category: 'docs', title: 'Inline docs that age well',
    keywords: [/javadoc/i, /docstring/i, /comment.{0,15}(add|write)/i, /คอมเมนต์/i],
    prompt: 'Comment the WHY and the constraint, never the WHAT. Delete comments that lie; fix them when behavior changes.' },

  // --- refactoring ---------------------------------------------------------
  { id: 'ref-small-steps', category: 'refactoring', title: 'Small refactor steps',
    keywords: [/refactor/i, /restructure/i, /clean\s*up/i, /รีแฟกเตอร์/i],
    prompt: 'Each step compiles and passes tests. Move → rename → reshape, verifying between — never all at once.' },
  { id: 'ref-behavior-preserve', category: 'refactoring', title: 'Preserve behavior',
    keywords: [/refactor/i, /behavior.{0,10}(same|unchanged)/i, /pure\s*refactor/i],
    prompt: 'Pure refactors change zero behavior: same outputs, same side effects. If behavior must change, that\u2019s a feature — split the commits/steps.' },
  { id: 'ref-dead-code', category: 'refactoring', title: 'Dead code removal',
    keywords: [/dead\s*code/i, /unused.{0,12}(code|export|file)/i, /\bdelete\b.{0,15}\bcode\b/i],
    prompt: 'Verify nothing references it (search_code all call sites incl. strings/docs) before deleting; delete, don\u2019t comment out.' },
  { id: 'ref-naming', category: 'refactoring', title: 'Naming clarity',
    keywords: [/rename/i, /naming/i, /\bname\b.{0,15}(unclear|bad|better)/i],
    prompt: 'Names should say what the thing IS. Rename locally first; exported names are contracts — search all usages before touching them.' },

  // --- types ---------------------------------------------------------------
  { id: 'ts-strict-types', category: 'types', title: 'Strict typing',
    keywords: [/typescript/i, /\btype\b.{0,12}(add|fix|strict)/i, /interface/i, /คอมไพล์/i],
    prompt: 'Model the real shape: optional stays optional, unions beat booleans, narrow at boundaries. tsc --noEmit is the referee.' },
  { id: 'ts-no-any', category: 'types', title: 'No silent any',
    keywords: [/\bany\b/i, /unknown/i, /type\s*(error|issue)/i],
    prompt: 'No new `any` unless the task demands escape hatches; prefer `unknown` + narrowing at the edges.' },
  { id: 'ts-generics', category: 'types', title: 'Generics with restraint',
    keywords: [/generic/i, /\btype\s+parameter/i, /infer/i],
    prompt: 'Add generics only when a concrete type duplicates logic; over-generic code is unreadable code.' },

  // --- data / files --------------------------------------------------------
  { id: 'data-json-safety', category: 'data', title: 'JSON safety',
    keywords: [/json\.parse/i, /\bjson\b.{0,12}(read|load|parse)/i],
    prompt: 'try/catch every parse; validate shape after parsing; never trust external JSON structure.' },
  { id: 'data-large-files', category: 'data', title: 'Large file handling',
    keywords: [/\bcsv\b/i, /large\s*file/i, /\bstream\b/i, /ประมวลผลไฟล์/i],
    prompt: 'Stream or window large files (read_file line ranges); never slurp unbounded data into memory.' },
  { id: 'data-encoding', category: 'data', title: 'Encoding care',
    keywords: [/encoding/i, /utf-?8/i, /ฐานข้อมูลภาษาไทย/i, /mojibake/i],
    prompt: 'Read/write explicit utf-8; watch Thai/emoji multi-byte content in slices and regexes — never split inside a codepoint.' },

  // --- workflow ------------------------------------------------------------
  { id: 'wf-plan-first', category: 'workflow', title: 'Plan before multi-file work',
    keywords: [/multiple\s*files?/i, /หลายไฟล์/i, /feature/i, /implement/i],
    prompt: 'Multi-file task: emit the STRATEGIC/TACTICAL/OPERATIONAL plan block first, then execute it step by step.' },
  { id: 'wf-milestone-check', category: 'workflow', title: 'Milestone checkpoints',
    keywords: [/long\s*(task|run)/i, /step\s*(by|wise)/i, /ทีละขั้น/i],
    prompt: 'After each milestone, re-check the plan and queue leftover work by tier (critical → normal → background).' },
  { id: 'wf-scope-guard', category: 'workflow', title: 'Scope guard',
    keywords: [/scope\s*creep/i, /also.{0,15}(while|when)/i, /ด้วย.{0,8}นะ/i],
    prompt: 'Tempted to fix something outside the task? Note it as a queued background task or a report line — don\u2019t expand scope silently.' },
  { id: 'wf-when-stuck', category: 'workflow', title: 'When stuck',
    keywords: [/stuck/i, /\btried\s*everything\b/i, /ทำไม่ได้/i, /ติด/i],
    prompt: 'Two failed approaches = stop and reframe: re-read the requirement, check memory/notes, try the boring solution, or report precisely what blocks you.' },

  // --- communication -------------------------------------------------------
  { id: 'comm-concise-report', category: 'communication', title: 'Concise reporting',
    keywords: [/report/i, /summar/i, /สรุป/i],
    prompt: 'Lead with outcome, then changed files, then verification evidence. No filler; limitations stated plainly.' },
  { id: 'comm-assumptions', category: 'communication', title: 'State assumptions',
    keywords: [/assumption/i, /\bunclear\b/i, /ไม่ชัด/i, /กำกวม/i],
    prompt: 'When ambiguous, choose the safest reversible interpretation and declare the assumption in one line — do not block, do not guess silently.' },
];

export const SPECIALTY_BY_ID = new Map(SPECIALTY_PROMPTS.map(p => [p.id, p]));

// ---------------------------------------------------------------------------
// Real-time router
// ---------------------------------------------------------------------------

export interface SpecialtyMatch {
  card: SpecialtyPrompt;
  score: number;
}

export interface SpecialtyDiff {
  active: SpecialtyMatch[];
  entered: string[];
  exited: string[];
}

export interface SpecialtyContext {
  /** The user's task/message text. */
  userText: string;
  /** Recent activity: tool names, error texts, file paths touched. */
  recentActivity?: string;
  /** Max simultaneous cards (keeps the injected section small). */
  maxActive?: number;
}

export class SpecialtyRouter {
  private previousIds = new Set<string>();
  private readonly maxActive: number;
  private readonly minScore: number;

  constructor(options: { maxActive?: number; minScore?: number } = {}) {
    this.maxActive = Math.max(1, options.maxActive ?? 4);
    this.minScore = Math.max(1, options.minScore ?? 1);
  }

  /** Score all cards against the context (deterministic, no model calls). */
  private score(context: SpecialtyContext): SpecialtyMatch[] {
    const text = `${context.userText}\n${context.recentActivity ?? ''}`;
    const matches: SpecialtyMatch[] = [];
    for (const card of SPECIALTY_PROMPTS) {
      let score = 0;
      for (const pattern of card.keywords) if (pattern.test(text)) score++;
      if (score >= this.minScore) matches.push({ card, score });
    }
    return matches.sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
  }

  /**
   * Computes the active set for THIS moment and diffs against the previous
   * call — this is the "send in / send out" real-time behavior.
   */
  route(context: SpecialtyContext): SpecialtyDiff {
    const active = this.score(context).slice(0, this.maxActive);
    const activeIds = new Set(active.map(m => m.card.id));

    const entered = [...activeIds].filter(id => !this.previousIds.has(id));
    const exited = [...this.previousIds].filter(id => !activeIds.has(id));
    this.previousIds = activeIds;

    return { active, entered, exited };
  }

  /** Current active ids (for UI display without re-matching). */
  get activeIds(): string[] {
    return [...this.previousIds];
  }

  reset(): void {
    this.previousIds = new Set();
  }
}

/** Renders active cards for injection after the main system prompt. */
export function renderActiveSpecialties(diff: SpecialtyDiff): string {
  if (diff.active.length === 0) return '';
  const cards = diff.active
    .map(m => `◆ [${m.card.category}] ${m.card.title}\n${m.card.prompt}`)
    .join('\n');
  return `\n=== ACTIVE SPECIALTY MODULES (situational — change per iteration) ===\n${cards}\nApply these alongside the main manual; they do not override hard rules.\n`;
}
