import { ToolSchema } from '../types/index.js';

interface LayaAnswer {
  noul?: number;
  choice?: string;
  confidence?: number;
}

interface LayaResponse {
  answers?: Record<string, LayaAnswer>;
}

interface OIChatResponse {
  choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string } }> } }>;
}

export type RouterMode = 'xlam' | 'chain' | 'off';

const XLAM_SYSTEM_PROMPT =
  'You are a tool-selection assistant. Given the user request and the available tools, ' +
  'select the tools most relevant to fulfilling the request. Call at most one function per ' +
  'relevant tool. Select nothing if no tool is relevant.';

/** Routes tools per user message. Modes (AGENT_TOOL_ROUTER, default "xlam"):
 *  - xlam: xLAM proposes a shortlist (the default — no other model needed)
 *  - chain: xLAM proposes, laya verifies each pick
 *  - off: no routing, every tool is passed through
 *  When a model stage is unreachable or times out the full tool list is passed
 *  through unchanged — the serving model picks tools natively, so no keyword
 *  guessing happens anywhere. */
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
      ?? 'xlam';
    this.verify = options?.verify
      ?? (process.env.AGENT_TOOL_ROUTER_VERIFY !== 'off');
    this.layaEndpoint = process.env.LAYA_ROUTER_URL ?? 'http://127.0.0.1:8000/v1/systemone';
    this.xlamEndpoint = process.env.XLAM_ROUTER_URL ?? 'http://127.0.0.1:11434/v1/chat/completions';
    this.xlamModel = process.env.XLAM_ROUTER_MODEL ?? 'xlam';
    this.timeoutMs = Number(process.env.AGENT_TOOL_ROUTER_TIMEOUT_MS ?? 1500);
  }

  async select(userMessage: string, schemas: ToolSchema[]): Promise<ToolSchema[]> {
    if (this.mode === 'off' || schemas.length <= this.maxTools) return schemas;

    const picks = await this.proposeWithXlam(userMessage, schemas);
    if (!picks) return schemas;

    if (this.mode === 'xlam' || !this.verify) return this.finalize(picks, schemas);

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

  /** xLAM proposes a shortlist via [OI]-compatible native tool calling. */
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
      const data = (await response.json()) as OIChatResponse;
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
}
