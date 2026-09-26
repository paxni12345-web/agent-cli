/**
 * PlanningSystem — three planning tiers: Strategic (why/what), Tactical
 * (which files and steps), Operational (the exact commands and tool calls).
 * Renders and parses the fenced ```plan block the model produces.
 */

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
