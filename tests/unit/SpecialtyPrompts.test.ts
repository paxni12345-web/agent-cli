import {
  SPECIALTY_PROMPTS,
  SpecialtyRouter,
  renderActiveSpecialties,
} from '../../src/agent/SpecialtyPrompts.js';

describe('SpecialtyPrompts library', () => {
  it('has at least 50 cards across categories', () => {
    expect(SPECIALTY_PROMPTS.length).toBeGreaterThanOrEqual(50);
    const ids = new Set(SPECIALTY_PROMPTS.map(p => p.id));
    expect(ids.size).toBe(SPECIALTY_PROMPTS.length); // unique ids
  });

  it('every card has a short, dense prompt body', () => {
    for (const card of SPECIALTY_PROMPTS) {
      expect(card.prompt.length).toBeGreaterThan(30);
      expect(card.prompt.length).toBeLessThan(320);
      expect(card.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe('SpecialtyRouter (real-time in/out)', () => {
  it('activates debugging cards for a bug report', () => {
    const router = new SpecialtyRouter();
    const diff = router.route({ userText: 'the login endpoint throws an exception, fix this bug' });
    const ids = diff.active.map(m => m.card.id);
    expect(ids).toContain('debug-root-cause');
    expect(ids).toContain('debug-read-error');
  });

  it('activates frontend cards when touching tsx/styles', () => {
    const router = new SpecialtyRouter();
    const diff = router.route({
      userText: 'update the styling',
      recentActivity: 'read_file src/components/Header.tsx',
    });
    const ids = diff.active.map(m => m.card.id);
    expect(ids).toContain('fe-component-style');
    expect(ids).toContain('fe-css-consistency');
  });

  it('drops cards when the context moves on (exit)', () => {
    const router = new SpecialtyRouter();
    const first = router.route({ userText: 'fix the failing test assertion' });
    expect(first.active.length).toBeGreaterThan(0);
    expect(first.exited).toHaveLength(0); // first activation: nothing exits

    const second = router.route({ userText: 'now write the changelog entry and update readme' });
    expect(second.entered.length).toBeGreaterThan(0);
    expect(second.exited.length).toBeGreaterThan(0); // debugging cards left
    const ids = second.active.map(m => m.card.id);
    expect(ids).toContain('doc-changelog');
  });

  it('respects maxActive and scores ordering', () => {
    const router = new SpecialtyRouter({ maxActive: 2 });
    const diff = router.route({ userText: 'slow performance, write unit test, refactor cleanup, git commit, sql query slow' });
    expect(diff.active.length).toBeLessThanOrEqual(2);
  });

  it('renders a small injection section', () => {
    const router = new SpecialtyRouter();
    const diff = router.route({ userText: 'debug the crash in production' });
    const text = renderActiveSpecialties(diff);
    expect(text).toContain('ACTIVE SPECIALTY MODULES');
    expect(text.length).toBeLessThan(1600); // tiny compared to the 25K main prompt
  });

  it('renders empty string when nothing matches', () => {
    const router = new SpecialtyRouter();
    const diff = router.route({ userText: 'hello there friendly neighbor' });
    expect(renderActiveSpecialties(diff)).toBe('');
  });
});
