/**
 * LearningEngine — the agent learns from its own history, four ways:
 *
 *  1. SUPERVISED      the human labels outcomes ("that fix was wrong",
 *                     "this is the right way") → these become the highest-
 *                     priority rules and correct the agent's behavior.
 *  2. UNSUPERVISED    pattern mining over accumulated session data: which
 *                     tools co-occur, which files are hot, which commands
 *                     repeat → discovered conventions, no labels needed.
 *  3. REINFORCEMENT   strategy weights updated by reward signals (task
 *                     completed fast/clean = +reward, retries/errors =
 *                     penalty). The agent prefers high-reward strategies.
 *  4. IN-CONTEXT      distilled "lessons" injected into the prompt for the
 *                     current task — the fastest form of learning: no
 *                     weight updates, just the right context at the right
 *                     moment.
 *
 * Persistence: .agent/memory/learning/ — one JSON per store.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 1. Supervised — human-labeled corrections
// ---------------------------------------------------------------------------

export interface SupervisedExample {
  id: string;
  situation: string;
  label: 'good' | 'bad';
  correction?: string;
  createdAt: string;
}

export class SupervisedLearner {
  private examples: SupervisedExample[] = [];
  private seq = 0;
  private loaded = false;

  constructor(private readonly filePath = '.agent/memory/learning/supervised.json') {}

  private p(workspaceRoot: string) { return path.join(workspaceRoot, this.filePath); }

  async load(workspaceRoot: string): Promise<void> {
    if (this.loaded) return;
    try {
      const parsed = JSON.parse(await fs.readFile(this.p(workspaceRoot), 'utf-8'));
      if (Array.isArray(parsed?.examples)) this.examples = parsed.examples;
    } catch { this.examples = []; }
    this.loaded = true;
  }

  private async persist(workspaceRoot: string): Promise<void> {
    await fs.mkdir(path.dirname(this.p(workspaceRoot)), { recursive: true });
    await fs.writeFile(this.p(workspaceRoot), JSON.stringify({ version: 1, examples: this.examples.slice(-500) }, null, 2), 'utf-8');
  }

  /** The human marks an action/outcome as good or bad, optionally with how to fix. */
  async label(workspaceRoot: string, situation: string, verdict: 'good' | 'bad', correction?: string): Promise<SupervisedExample> {
    await this.load(workspaceRoot);
    const example: SupervisedExample = {
      id: `s-${Date.now().toString(36)}-${++this.seq}`,
      situation: situation.slice(0, 400),
      label: verdict,
      correction: correction?.slice(0, 400),
      createdAt: new Date().toISOString(),
    };
    this.examples.push(example);
    await this.persist(workspaceRoot);
    return example;
  }

  /** Lessons: bad examples become "avoid X, do Y" guidance. */
  async lessonsForPrompt(workspaceRoot: string, limit = 8): Promise<string[]> {
    await this.load(workspaceRoot);
    const lessons: string[] = [];
    for (const example of [...this.examples].reverse()) {
      if (example.label === 'bad') {
        lessons.push(`Avoid: ${example.situation}${example.correction ? ` → instead: ${example.correction}` : ''}`);
      } else if (example.correction) {
        lessons.push(`Keep doing: ${example.correction}`);
      }
      if (lessons.length >= limit) break;
    }
    return lessons;
  }
}

// ---------------------------------------------------------------------------
// 2. Unsupervised — pattern mining over session data
// ---------------------------------------------------------------------------

export interface ToolSequence {
  tools: string[];
  success: boolean;
}

export interface DiscoveredPattern {
  pattern: string;
  occurrences: number;
  confidence: number;
}

export class UnsupervisedMiner {
  private sequences: ToolSequence[] = [];
  private loaded = false;

  constructor(private readonly filePath = '.agent/memory/learning/patterns.json') {}

  private p(workspaceRoot: string) { return path.join(workspaceRoot, this.filePath); }

  async load(workspaceRoot: string): Promise<void> {
    if (this.loaded) return;
    try {
      const parsed = JSON.parse(await fs.readFile(this.p(workspaceRoot), 'utf-8'));
      if (Array.isArray(parsed?.sequences)) this.sequences = parsed.sequences;
    } catch { this.sequences = []; }
    this.loaded = true;
  }

  private async persist(workspaceRoot: string): Promise<void> {
    await fs.mkdir(path.dirname(this.p(workspaceRoot)), { recursive: true });
    await fs.writeFile(this.p(workspaceRoot), JSON.stringify({ version: 1, sequences: this.sequences.slice(-300) }), 'utf-8');
  }

  async recordSequence(workspaceRoot: string, tools: string[], success: boolean): Promise<void> {
    await this.load(workspaceRoot);
    const sequence = tools.slice(0, 20);
    // Dedup: identical tool sequence + outcome just refreshes the last entry
    // (repeated runs of the same workflow shouldn't inflate pattern counts).
    const key = sequence.join(',') + '|' + (success ? 1 : 0);
    const last = this.sequences[this.sequences.length - 1];
    if (last && last.tools.join(',') + '|' + (last.success ? 1 : 0) === key) return;
    this.sequences.push({ tools: sequence, success });
    await this.persist(workspaceRoot);
  }

  /** Mines frequent tool pairs (co-occurrence) and success-associated sequences. */
  async discoverPatterns(workspaceRoot: string, minOccurrences = 3): Promise<DiscoveredPattern[]> {
    await this.load(workspaceRoot);
    const pairs = new Map<string, number>();
    const successful = new Map<string, number>();
    for (const seq of this.sequences) {
      const unique = [...new Set(seq.tools)];
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const key = [unique[i], unique[j]].sort().join('+');
          pairs.set(key, (pairs.get(key) ?? 0) + 1);
          if (seq.success) successful.set(key, (successful.get(key) ?? 0) + 1);
        }
      }
    }
    const patterns: DiscoveredPattern[] = [];
    for (const [pattern, occurrences] of pairs) {
      if (occurrences < minOccurrences) continue;
      const confidence = Math.round(((successful.get(pattern) ?? 0) / occurrences) * 100);
      patterns.push({ pattern, occurrences, confidence });
    }
    return patterns.sort((a, b) => b.occurrences - a.occurrences).slice(0, 8);
  }

  /** Hot files across recorded sessions (by mention frequency in sequences is not tracked; uses graph/vector later). */
  get sampleCount(): number {
    return this.sequences.length;
  }
}

// ---------------------------------------------------------------------------
// 3. Reinforcement — strategy weights updated by reward
// ---------------------------------------------------------------------------

export type Strategy = 'read-then-edit' | 'plan-first' | 'test-after-change' | 'small-batches' | 'search-before-read';

export interface StrategyWeight {
  strategy: Strategy;
  weight: number; // starts at 1.0, reward > 0 pushes up, < 0 down
  uses: number;
  totalReward: number;
}

const ALL_STRATEGIES: Strategy[] = ['read-then-edit', 'plan-first', 'test-after-change', 'small-batches', 'search-before-read'];

export class ReinforcementLearner {
  private weights = new Map<Strategy, StrategyWeight>();
  private loaded = false;
  private readonly learningRate: number;

  constructor(options: { learningRate?: number } = {}) {
    this.learningRate = options.learningRate ?? 0.15;
  }

  private filePath(workspaceRoot: string) { return path.join(workspaceRoot, '.agent/memory/learning/reinforcement.json'); }

  async load(workspaceRoot: string): Promise<void> {
    if (this.loaded) return;
    for (const strategy of ALL_STRATEGIES) {
      this.weights.set(strategy, { strategy, weight: 1, uses: 0, totalReward: 0 });
    }
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath(workspaceRoot), 'utf-8'));
      if (Array.isArray(parsed?.weights)) {
        for (const w of parsed.weights as StrategyWeight[]) {
          if (this.weights.has(w.strategy)) this.weights.set(w.strategy, w);
        }
      }
    } catch { /* first run */ }
    this.loaded = true;
  }

  private async persist(workspaceRoot: string): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath(workspaceRoot)), { recursive: true });
    const payload = { version: 1, weights: [...this.weights.values()] };
    await fs.writeFile(this.filePath(workspaceRoot), JSON.stringify(payload, null, 2), 'utf-8');
  }

  /** Applies a reward to strategies the agent used during a task. */
  async reward(workspaceRoot: string, strategies: Strategy[], delta: number): Promise<void> {
    await this.load(workspaceRoot);
    for (const strategy of strategies) {
      const w = this.weights.get(strategy);
      if (!w) continue;
      w.uses++;
      w.totalReward += delta;
      // Bounded update: weight stays in [0.2, 3]
      w.weight = Math.min(3, Math.max(0.2, w.weight + this.learningRate * delta));
    }
    await this.persist(workspaceRoot);
  }

  /** Ranked strategies — the agent follows the top-ranked playbook by default. */
  async ranked(workspaceRoot: string): Promise<StrategyWeight[]> {
    await this.load(workspaceRoot);
    return [...this.weights.values()].sort((a, b) => b.weight - a.weight);
  }

  /** Renders the current playbook for prompt injection. */
  async playbookForPrompt(workspaceRoot: string, limit = 3): Promise<string> {
    const ranked = await this.ranked(workspaceRoot);
    const top = ranked.slice(0, limit).filter(w => w.uses > 0);
    if (top.length === 0) return '';
    return `LEARNED PLAYBOOK (reinforcement, reward-weighted):\n${top.map(w => `- ${w.strategy} (w=${w.weight.toFixed(2)}, n=${w.uses})`).join('\n')}\nPrefer these strategies on this workspace.`;
  }

  /** Detects which strategies a run actually used, from its tool history. */
  static detectStrategies(history: Array<{ tool: string }>): Strategy[] {
    const tools = history.map(h => h.tool);
    const used: Strategy[] = [];
    const firstEdit = tools.findIndex(t => t === 'edit_file' || t === 'write_file');
    if (firstEdit > 0 && tools.slice(0, firstEdit).some(t => t === 'read_file' || t === 'search_code' || t === 'list_files')) used.push('read-then-edit');
    if (tools.includes('project_map') || tools.includes('list_files')) used.push('plan-first');
    if (firstEdit >= 0 && tools.slice(firstEdit + 1).includes('shell')) used.push('test-after-change');
    if (tools.filter(t => t === 'edit_file').length > 0 && tools.filter(t => t === 'edit_file').length <= 3) used.push('small-batches');
    if (tools.indexOf('search_code') < tools.indexOf('read_file') && tools.includes('search_code') && tools.includes('read_file')) used.push('search-before-read');
    return [...new Set(used)];
  }
}

// ---------------------------------------------------------------------------
// 4. In-Context Learning — lessons injected for the current task
// ---------------------------------------------------------------------------

export interface Lesson {
  trigger: RegExp;
  lesson: string;
  source: 'supervised' | 'mined' | 'manual';
}

export class InContextLearner {
  private lessons: Lesson[] = [];

  /** Registers a lesson with a trigger condition. */
  add(lesson: string, trigger: RegExp, source: Lesson['source'] = 'manual'): void {
    this.lessons.push({ trigger, lesson, source });
  }

  /** Loads supervised lessons as in-context triggers (bad → avoid patterns). */
  async loadFromSupervised(workspaceRoot: string, learner: SupervisedLearner): Promise<void> {
    const lessons = await learner.lessonsForPrompt(workspaceRoot, 12);
    for (const lesson of lessons) {
      // Trigger broadly: any debug/fix/code task gets human-correction lessons.
      this.add(lesson, /(fix|debug|error|bug|refactor|implement|แก้|เขียน)/i, 'supervised');
    }
  }

  /** Selects lessons relevant to the current task text. */
  select(taskText: string, limit = 4): string[] {
    const selected = this.lessons.filter(l => l.trigger.test(taskText)).map(l => l.lesson);
    return selected.slice(0, limit);
  }

  get size(): number {
    return this.lessons.length;
  }
}

// ---------------------------------------------------------------------------
// Facade
// ---------------------------------------------------------------------------

export class LearningEngine {
  readonly supervised = new SupervisedLearner();
  readonly unsupervised = new UnsupervisedMiner();
  readonly reinforcement = new ReinforcementLearner();
  readonly inContext = new InContextLearner();

  /** Full learning pass after a run: mine patterns, reward strategies. */
  async learnFromRun(
    workspaceRoot: string,
    options: {
      toolSequence: string[];
      success: boolean;
      durationMs: number;
      retryCount: number;
      usedStrategies: Strategy[];
    }
  ): Promise<{ patterns: DiscoveredPattern[]; rewarded: Strategy[] }> {
    await this.unsupervised.recordSequence(workspaceRoot, options.toolSequence, options.success);
    const patterns = await this.unsupervised.discoverPatterns(workspaceRoot);

    // Reward signal: fast clean success > slow success > failure.
    let delta = options.success ? 0.5 : -0.5;
    if (options.success && options.durationMs < 60000 && options.retryCount === 0) delta = 1;
    await this.reinforcement.reward(workspaceRoot, options.usedStrategies, delta);
    return { patterns, rewarded: options.usedStrategies };
  }

  /** Loads all in-context lessons (supervised + manual) for a task. */
  async prepareInContext(workspaceRoot: string, taskText: string, limit = 4): Promise<string[]> {
    await this.inContext.loadFromSupervised(workspaceRoot, this.supervised);
    return this.inContext.select(taskText, limit);
  }

  /** Boot-time rendering of learned knowledge for the system prompt. */
  async renderForPrompt(workspaceRoot: string, taskText: string): Promise<string> {
    const [playbook, lessons, patterns] = await Promise.all([
      this.reinforcement.playbookForPrompt(workspaceRoot),
      this.prepareInContext(workspaceRoot, taskText),
      this.unsupervised.discoverPatterns(workspaceRoot, 5),
    ]);
    const parts: string[] = [];
    if (playbook) parts.push(playbook);
    if (lessons.length) parts.push('LESSONS FROM HUMAN FEEDBACK:\n' + lessons.map(l => `- ${l}`).join('\n'));
    if (patterns.length) {
      parts.push('DISCOVERED WORKFLOWS (frequent tool combos):\n' + patterns.slice(0, 3).map(p => `- ${p.pattern} (×${p.occurrences}, ${p.confidence}% success)`).join('\n'));
    }
    return parts.join('\n\n').slice(0, 1600);
  }
}
