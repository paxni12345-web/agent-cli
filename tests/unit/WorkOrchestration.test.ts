import { CompletionRouter } from '../../src/agent/CompletionRouter.js';
import { BrainstormEngine } from '../../src/agent/BrainstormEngine.js';
import { PlanningSystem, FullPlan } from '../../src/agent/PlanningSystem.js';
import { TaskPriorityEngine } from '../../src/agent/TaskPriorityEngine.js';

describe('TaskPriorityEngine (three-tier queue)', () => {
  it('classifies tasks automatically', () => {
    const q = new TaskPriorityEngine();
    expect(q.classify('URGENT fix production outage')).toBe('critical');
    expect(q.classify('polish readme docs')).toBe('background');
    expect(q.classify('add user authentication')).toBe('normal');
  });

  it('drains in tier order: critical → normal → background', () => {
    const q = new TaskPriorityEngine({ maxBackgroundPerRun: 10 });
    q.add('polish docs', async () => 'docs');
    q.add('URGENT security patch', async () => 'sec');
    q.add('normal task', async () => 'normal');
    const order: string[] = [];
    while (q.hasWork()) {
      const t = q.next();
      if (!t) break;
      order.push(t.tier);
    }
    expect(order).toEqual(['critical', 'normal', 'background']);
  });

  it('caps background tasks per run', () => {
    const q = new TaskPriorityEngine({ maxBackgroundPerRun: 1 });
    q.add('cleanup a', async () => 'a');
    q.add('cleanup b', async () => 'b');
    const first = q.next();
    expect(first?.tier).toBe('background');
    expect(q.next()).toBeNull(); // second background blocked by cap
    q.startRun(false);
    expect(q.next()?.tier).toBe('background'); // available next run
  });

  it('promotes background work on demand', () => {
    const q = new TaskPriorityEngine({ maxBackgroundPerRun: 0 });
    q.add('cleanup a', async () => 'a');
    expect(q.next()).toBeNull(); // background blocked by cap
    expect(q.promoteBackground()).toBe(1);
    expect(q.next()?.tier).toBe('normal');
  });
});

describe('CompletionRouter', () => {
  it('routes tiny chores to the completion model when configured', async () => {
    const router = new CompletionRouter({ completer: async () => 'fixed' });
    const route = router.route({ instruction: 'add missing import for User type', filePath: 'a.ts' });
    expect(route.target).toBe('completion-model');
  });

  it('keeps structural work on the main agent', () => {
    const router = new CompletionRouter({ completer: async () => 'x' });
    expect(router.route({ instruction: 'refactor the auth architecture', filePath: 'a.ts' }).target).toBe('main-agent');
  });

  it('falls back to main agent without a completer', () => {
    const router = new CompletionRouter();
    expect(router.route({ instruction: 'fix typo in function name', filePath: 'a.ts' }).target).toBe('main-agent');
  });

  it('apply returns error for unreadable files', async () => {
    const router = new CompletionRouter({ completer: async () => 'x' });
    const result = await router.apply({ instruction: 'fix typo in function name', filePath: 'definitely/missing/file.ts' }, '/tmp');
    expect(result.error).toBeDefined();
  });
});

describe('BrainstormEngine', () => {
  it('runs three advisor perspectives', async () => {
    const bs = new BrainstormEngine({ advisor: async angle => `idea:${angle}` });
    const result = await bs.brainstorm('caching layer');
    expect(result.ideas).toHaveLength(3);
    expect(result.ideas.map(i => i.angle)).toEqual(['safest', 'fastest', 'most-maintainable']);
  });

  it('falls back to guidance without an advisor', async () => {
    const bs = new BrainstormEngine();
    const result = await bs.brainstorm('anything');
    expect(result.ideas).toHaveLength(0);
    expect(result.recommendation).toContain('safest');
  });
});

describe('PlanningSystem (Strategic/Tactical/Operational)', () => {
  const planText = [
    '```plan',
    'STRATEGIC: Add auth | security requirement | users can log in | no OAuth',
    'TACTICAL: login endpoint | src/api/auth.ts | JWT flow | token leak',
    'OPERATIONAL: [read_file] read auth handler — locate login logic (verify: file read)',
    'OPERATIONAL: [edit_file] add JWT check — sign and verify (verify: unit test)',
    'VERIFY: npm test -- auth',
    '```',
  ].join('\n');

  it('parses a three-tier plan block', () => {
    const plan = PlanningSystem.parse(planText);
    expect(plan).not.toBeNull();
    expect(plan!.strategic.goal).toBe('Add auth');
    expect(plan!.tactical).toHaveLength(1);
    expect(plan!.operational.steps).toHaveLength(2);
    expect(plan!.operational.verificationCommand).toBe('npm test -- auth');
  });

  it('validates tier discipline', () => {
    const plan = PlanningSystem.parse(planText)!;
    expect(PlanningSystem.validate(plan)).toEqual([]);
    const bad = { strategic: { goal: '', why: '', successCriteria: [], nonGoals: [] }, tactical: [], operational: { steps: [], verificationCommand: '' } } as unknown as FullPlan;
    expect(PlanningSystem.validate(bad).length).toBeGreaterThan(0);
  });

  it('renders a readable plan', () => {
    const plan = PlanningSystem.parse(planText)!;
    const text = PlanningSystem.render(plan);
    expect(text).toContain('STRATEGIC PLAN — Add auth');
    expect(text).toContain('TACTICAL PLAN');
    expect(text).toContain('OPERATIONAL PLAN');
  });

  it('returns null for non-plan text', () => {
    expect(PlanningSystem.parse('just talking, no plan here')).toBeNull();
  });
});
