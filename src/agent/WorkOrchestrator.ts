import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * WorkOrchestrator — three cooperating subsystems:
 *
 * 1. CompletionRouter  routes TINY code-completion chores (add a missing
 *                      import, fix a typo, small refactor of one function)
 *                      to a lightweight fast model so the main agent does
 *                      not burn its iteration budget on small stuff.
 * 2. BrainstormEngine  multi-perspective ideation: spins lightweight
 *                      "advisors" that each argue one angle (safest, fastest,
 *                      most maintainable), then merges a recommendation.
 * 3. PlanningSystem    three planning tiers — Strategic (why/what),
 *                      Tactical (which files/steps), Operational (the exact
 *                      commands and tool calls).
 */

// ---------------------------------------------------------------------------
// 1. CompletionRouter
// ---------------------------------------------------------------------------

export interface CompletionRequest {
  /** The small code task: "add missing import", "rename local var", … */
  instruction: string;
  /** File the completion applies to (workspace-relative). */
  filePath: string;
  /** Optional hint: nearby code the completion must fit with. */
  context?: string;
}

export interface CompletionRoute {
  /** 'completion-model' = tiny task routed to the fast model; 'main-agent' = keep it here. */
  target: 'completion-model' | 'main-agent';
  reason: string;
}

export type MiniCompleter = (request: CompletionRequest) => Promise<string>;

const SMALL_TASK_PATTERNS: RegExp[] = [
  /\b(missing|fix|add)\b.{0,24}\b(import|export)\b/i,
  /\b(import|export)\b.{0,24}\b(missing|add|fix)\b/i,
  /\btypo\b/i,
  /\brename\b.{0,24}\b(variable|function|local)\b/i,
  /\bfix\b.{0,24}\b(syntax|lint|warning)\b/i,
  /\b(add|write)\b.{0,24}\b(javadoc|docstring|comment|type annotation)\b/i,
  /\bformat\b.{0,20}\bfile\b/i,
  /\bremove\b.{0,24}\bunused\b/i,
];

const BIG_TASK_PATTERNS: RegExp[] = [
  /\b(refactor|rewrite|migrat|architecture|redesign|multi-?file|api|database|schema|auth)\b/i,
  /\b(test suite|integration|end-to-end)\b/i,
];

export class CompletionRouter {
  private readonly completer: MiniCompleter | null;
  private readonly maxLines: number;

  constructor(options: { completer?: MiniCompleter | null; maxLines?: number } = {}) {
    this.completer = options.completer ?? null;
    this.maxLines = options.maxLines ?? 40;
  }

  /** Classify a task: tiny completion chore or real agent work? */
  route(request: CompletionRequest): CompletionRoute {
    const text = `${request.instruction} ${request.context ?? ''}`;
    if (BIG_TASK_PATTERNS.some(p => p.test(text))) {
      return { target: 'main-agent', reason: 'task is structural — needs full agent reasoning' };
    }
    if (!SMALL_TASK_PATTERNS.some(p => p.test(text))) {
      return { target: 'main-agent', reason: 'task is not a small completion chore' };
    }
    if (!this.completer) {
      return { target: 'main-agent', reason: 'no completion model configured' };
    }
    return { target: 'completion-model', reason: 'tiny, well-scoped completion — fast model is enough' };
  }

  /**
   * Applies a small completion to a file: reads the file, asks the mini
   * model for the edited content, and returns the result. The caller (agent)
   * stays responsible for permission checks and note-taking.
   */
  async apply(request: CompletionRequest, workspaceRoot: string): Promise<{ routed: CompletionRoute; result?: string; error?: string }> {
    const routed = this.route(request);
    if (routed.target !== 'completion-model' || !this.completer) {
      return { routed };
    }
    try {
      const abs = path.join(workspaceRoot, request.filePath);
      const content = await fs.readFile(abs, 'utf-8');
      const edited = await this.completer({
        ...request,
        context: (request.context ? request.context + '\n\n' : '') + content.slice(0, 8000),
      });
      if (typeof edited !== 'string' || edited.length === 0) {
        return { routed: { ...routed, reason: routed.reason + ' (completion model returned empty)' }, error: 'empty completion result' };
      }
      return { routed, result: edited };
    } catch (error) {
      return { routed, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// ---------------------------------------------------------------------------
// 2. BrainstormEngine
// ---------------------------------------------------------------------------

export interface Idea {
  angle: 'safest' | 'fastest' | 'most-maintainable';
  proposal: string;
  tradeoff: string;
}

export interface BrainstormResult {
  topic: string;
  ideas: Idea[];
  recommendation: string;
}

export type Advisor = (angle: Idea['angle'], topic: string) => Promise<string>;

const ANGLES: Array<{ angle: Idea['angle']; lens: string }> = [
  { angle: 'safest', lens: 'minimize risk of breakage and data loss; favor reversible steps' },
  { angle: 'fastest', lens: 'minimize time-to-working-state; favor the smallest change that works' },
  { angle: 'most-maintainable', lens: 'optimize for the person reading this code in six months' },
];

export class BrainstormEngine {
  private readonly advisor: Advisor | null;
  private readonly maxIdeas: number;

  constructor(options: { advisor?: Advisor | null; maxIdeas?: number } = {}) {
    this.advisor = options.advisor ?? null;
    this.maxIdeas = options.maxIdeas ?? 3;
  }

  get available(): boolean {
    return this.advisor !== null;
  }

  /**
   * Runs the ideation round. With an advisor (a lightweight model call per
   * angle) it produces three argued proposals; without one it falls back to
   * a structured self-brainstorm the main agent can answer inline.
   */
  async brainstorm(topic: string): Promise<BrainstormResult> {
    if (!this.advisor) {
      return {
        topic,
        ideas: [],
        recommendation:
          'No brainstorm advisor configured. Weigh: safest path (reversible, minimal blast radius), fastest path (smallest working change), most-maintainable path (clear structure). Pick one and state the tradeoff.',
      };
    }
    const picked = ANGLES.slice(0, this.maxIdeas);
    const ideas = await Promise.all(
      picked.map(async ({ angle, lens }) => {
        try {
          const proposal = await this.advisor!(angle, `${topic}\n\nEvaluate strictly through this lens: ${lens}`);
          return { angle, proposal: proposal.trim().slice(0, 600), tradeoff: lens };
        } catch (error) {
          return { angle, proposal: `(advisor failed: ${error instanceof Error ? error.message : '?'})`, tradeoff: lens };
        }
      })
    );
    return {
      topic,
      ideas,
      recommendation:
        `Prefer the safest idea unless the task explicitly optimizes for speed; ` +
        `when two ideas tie, choose the more maintainable one.`,
    };
  }
}

// ---------------------------------------------------------------------------
// 3. PlanningSystem — Strategic / Tactical / Operational
// ---------------------------------------------------------------------------

export interface StrategicPlan {
  goal: string;
  why: string;
  successCriteria: string[];
  nonGoals: string[];
}

export interface TacticalPlan {
  milestone: string;
  surfaces: string[];
  approach: string;
  risks: string[];
}

export interface OperationalPlan {
  steps: Array<{
    n: number;
    action: string;
    tool: string;
    detail: string;
    verification: string;
  }>;
  verificationCommand: string;
}

export interface FullPlan {
  strategic: StrategicPlan;
  tactical: TacticalPlan[];
  operational: OperationalPlan;
}

export class PlanningSystem {
  /**
   * Builds a deterministic three-tier plan scaffold from a structured
   * breakdown. The agent (or a planning model) fills the fields; this class
   * enforces the tier discipline and renders the plan as text.
   */
  static render(plan: FullPlan): string {
    const tactical = plan.tactical
      .map((t, i) => `  T${i + 1}. ${t.milestone}\n     surfaces: ${t.surfaces.join(', ') || '—'}\n     approach: ${t.approach}\n     risks: ${t.risks.join('; ') || '—'}`)
      .join('\n');
    const steps = plan.operational.steps
      .map(s => `  ${s.n}. [${s.tool}] ${s.action} — ${s.detail} (verify: ${s.verification})`)
      .join('\n');
    return [
      `STRATEGIC PLAN — ${plan.strategic.goal}`,
      `  why: ${plan.strategic.why}`,
      `  success criteria: ${plan.strategic.successCriteria.join('; ') || '—'}`,
      `  non-goals: ${plan.strategic.nonGoals.join('; ') || '—'}`,
      ``,
      `TACTICAL PLAN`,
      tactical || '  (none)',
      ``,
      `OPERATIONAL PLAN`,
      steps || '  (none)',
      `  verification: ${plan.operational.verificationCommand || '—'}`,
    ].join('\n');
  }

  /** Validates tier discipline: strategic stays high-level, operational stays concrete. */
  static validate(plan: FullPlan): string[] {
    const issues: string[] = [];
    if (!plan.strategic.goal.trim()) issues.push('strategic.goal is required');
    if (plan.strategic.successCriteria.length === 0) issues.push('at least one success criterion is required');
    if (plan.tactical.length === 0) issues.push('at least one tactical milestone is required');
    if (plan.operational.steps.length === 0) issues.push('at least one operational step is required');
    for (const step of plan.operational.steps) {
      if (!step.verification.trim()) issues.push(`operational step ${step.n}: every step needs a verification`);
      if (!step.tool.trim()) issues.push(`operational step ${step.n}: missing tool`);
    }
    return issues;
  }

  /**
   * Parses a three-tier plan from the model's fenced block:
   *   ```plan
   *   STRATEGIC: goal | why | criteria(;) | non-goals(;)
   *   TACTICAL: milestone | surface,surface | approach | risks(;)
   *   TACTICAL: …
   *   OPERATIONAL: [tool] action — detail (verify: command)
   *   VERIFY: final verification command
   *   ```
   */
  static parse(text: string): FullPlan | null {
    const block = text.match(/```plan\s*\n([\s\S]*?)```/);
    if (!block) return null;
    const lines = block[1].split('\n').map(l => l.trim()).filter(Boolean);
    const strategic: StrategicPlan = { goal: '', why: '', successCriteria: [], nonGoals: [] };
    const tactical: TacticalPlan[] = [];
    const steps: OperationalPlan['steps'] = [];
    let verification = '';

    for (const line of lines) {
      if (line.startsWith('STRATEGIC:')) {
        const [goal = '', why = '', criteria = '', nonGoals = ''] = line.slice('STRATEGIC:'.length).split('|').map(s => s.trim());
        strategic.goal = goal;
        strategic.why = why;
        strategic.successCriteria = criteria ? criteria.split(';').map(s => s.trim()).filter(Boolean) : [];
        strategic.nonGoals = nonGoals ? nonGoals.split(';').map(s => s.trim()).filter(Boolean) : [];
      } else if (line.startsWith('TACTICAL:')) {
        const [milestone = '', surfaces = '', approach = '', risks = ''] = line.slice('TACTICAL:'.length).split('|').map(s => s.trim());
        tactical.push({
          milestone,
          surfaces: surfaces ? surfaces.split(',').map(s => s.trim()).filter(Boolean) : [],
          approach,
          risks: risks ? risks.split(';').map(s => s.trim()).filter(Boolean) : [],
        });
      } else if (line.startsWith('OPERATIONAL:')) {
        const body = line.slice('OPERATIONAL:'.length).trim();
        const m = body.match(/^\[(.+?)\]\s*(.+?)\s+—\s+(.+?)\s+\(verify:\s*(.+?)\)$/);
        if (m) {
          steps.push({ n: steps.length + 1, tool: m[1].trim(), action: m[2].trim(), detail: m[3].trim(), verification: m[4].trim() });
        }
      } else if (line.startsWith('VERIFY:')) {
        verification = line.slice('VERIFY:'.length).trim();
      }
    }
    if (!strategic.goal || steps.length === 0) return null;
    return { strategic, tactical, operational: { steps, verificationCommand: verification } };
  }
}
