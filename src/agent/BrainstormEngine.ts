/**
 * BrainstormEngine — multi-perspective ideation: lightweight advisors each
 * argue one angle (safest / fastest / most maintainable) and the engine
 * merges them into a recommendation.
 */

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
