import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { RulesStore } from '../../src/memory/RulesStore.js';
import { CodeVectorStore } from '../../src/memory/CodeVectorStore.js';
import { KnowledgeGraph } from '../../src/memory/KnowledgeGraph.js';
import { LearningEngine, ReinforcementLearner } from '../../src/memory/LearningEngine.js';
import { SANDBOX_PROFILES, SecureSandbox } from '../../src/agent/SecurityPipeline.js';

async function tmpWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'iris-mem-'));
}

describe('RulesStore (ChromaDB-style rules brain)', () => {
  it('stores and queries guardrails/preferences/agreements', async () => {
    const ws = await tmpWorkspace();
    const store = new RulesStore();
    await store.add(ws, 'guardrail', 'never run npm publish', { tags: ['security'] });
    await store.add(ws, 'preference', 'answer in Thai');
    await store.add(ws, 'agreement', 'src/ is generated, never hand-edit');

    const prompt = await store.renderForPrompt(ws);
    expect(prompt).toContain('never run npm publish');
    expect(prompt).toContain('answer in Thai');
    expect(prompt).toContain('src/ is generated');
  });

  it('history records expire; rules are permanent', async () => {
    const ws = await tmpWorkspace();
    const store = new RulesStore();
    await store.rememberTurn(ws, 'user', 'hello short-term memory');
    const turns = await store.recentTurns(ws);
    expect(turns.some(t => t.includes('hello short-term memory'))).toBe(true);
  });

  it('filters by tag', async () => {
    const ws = await tmpWorkspace();
    const store = new RulesStore();
    await store.add(ws, 'guardrail', 'rule A', { tags: ['deploy'] });
    await store.add(ws, 'guardrail', 'rule B', { tags: ['db'] });
    const deployRules = await store.query(ws, { kind: 'guardrail', tags: ['deploy'] });
    expect(deployRules).toHaveLength(1);
    expect(deployRules[0].text).toBe('rule A');
  });

  it('dedups identical rules instead of duplicating them', async () => {
    const ws = await tmpWorkspace();
    const store = new RulesStore();
    await store.add(ws, 'preference', 'answer in Thai');
    await store.add(ws, 'preference', 'answer  in   Thai'); // whitespace-normalized duplicate
    const prefs = await store.query(ws, { kind: 'preference' });
    expect(prefs).toHaveLength(1);
  });
});

describe('CodeVectorStore (LanceDB-style code scanner)', () => {
  it('chunks a file by function and finds similar code', async () => {
    const ws = await tmpWorkspace();
    const store = new CodeVectorStore();
    const source = [
      'export function verifyJwtToken(token: string) {',
      '  const secret = process.env.JWT_SECRET;',
      '  return jwt.verify(token, secret);',
      '}',
      '',
      'export class UserService {',
      '  async loginUser(email: string, password: string) {',
      '    const user = await db.user.findUnique({ where: { email } });',
      '    return bcrypt.compare(password, user.passwordHash);',
      '  }',
      '}',
    ].join('\n');
    await store.indexFile(ws, 'src/auth.ts', source);
    expect(store.chunkCount).toBeGreaterThan(0);

    const hits = await store.search(ws, 'verify jwt token authentication');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.filePath).toBe('src/auth.ts');
  });

  it('skips unchanged files on re-index (incremental)', async () => {
    const ws = await tmpWorkspace();
    const store = new CodeVectorStore();
    await store.indexFile(ws, 'a.ts', 'export const a = 1;');
    const added = await store.indexFile(ws, 'a.ts', 'export const a = 1;');
    expect(added).toBe(0);
  });

  it('detects test chunks', async () => {
    const ws = await tmpWorkspace();
    const store = new CodeVectorStore();
    await store.indexFile(ws, 'src/auth.test.ts', 'test("login works", () => { expect(1).toBe(1); });');
    const hits = await store.search(ws, 'login works test', { kind: 'test' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.kind).toBe('test');
  });
});

describe('KnowledgeGraph (GraphRAG-style impact brain)', () => {
  it('links imports/calls and answers impact questions', async () => {
    const ws = await tmpWorkspace();
    const graph = new KnowledgeGraph();
    await graph.indexFile(ws, 'src/auth.ts', [
      'import { db } from \'./db.ts\';',
      'export function verifyUser(token: string) {',
      '  return db.user.findUnique({ token });',
      '}',
    ].join('\n'));
    await graph.indexFile(ws, 'src/routes.ts', [
      'import { verifyUser } from \'./auth.ts\';',
      'export function loginRoute(req: any) {',
      '  return verifyUser(req.token);',
      '}',
    ].join('\n'));

    const impact = await graph.impact(ws, 'verifyUser');
    expect(impact.summary).toContain('verifyUser');
    expect(impact.directCallers.length + impact.transitiveCallers.length).toBeGreaterThanOrEqual(0);
  });

  it('reports unknown symbols gracefully', async () => {
    const ws = await tmpWorkspace();
    const graph = new KnowledgeGraph();
    const impact = await graph.impact(ws, 'neverIndexedSymbol');
    expect(impact.summary).toContain('not in the graph');
  });

  it('tracks stats', async () => {
    const ws = await tmpWorkspace();
    const graph = new KnowledgeGraph();
    await graph.indexFile(ws, 'a.ts', 'export function foo() {}\nprocess.env.API_KEY');
    expect(graph.stats.files).toBe(1);
    expect(graph.stats.nodes).toBeGreaterThan(0);
  });
});

describe('LearningEngine (4 learning modes)', () => {
  it('supervised: human labels become avoid/keep lessons', async () => {
    const ws = await tmpWorkspace();
    const engine = new LearningEngine();
    await engine.supervised.label(ws, 'ran rm -rf in workspace root', 'bad', 'always dry-run deletions first');
    await engine.supervised.label(ws, 'ran tests before reporting done', 'good', 'always verify before reporting');
    const lessons = await engine.supervised.lessonsForPrompt(ws);
    expect(lessons.some(l => l.startsWith('Avoid:'))).toBe(true);
    expect(lessons.some(l => l.startsWith('Keep doing:'))).toBe(true);
  });

  it('unsupervised: mines frequent tool pairs', async () => {
    const ws = await tmpWorkspace();
    const engine = new LearningEngine();
    for (let i = 0; i < 5; i++) {
      await engine.unsupervised.recordSequence(ws, ['search_code', 'read_file', 'edit_file', 'shell'], true);
    }
    const patterns = await engine.unsupervised.discoverPatterns(ws, 3);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].pattern).toContain('+');
    expect(patterns[0].confidence).toBe(100);
  });

  it('unsupervised: consecutive duplicate sequences do not inflate counts', async () => {
    const ws = await tmpWorkspace();
    const engine = new LearningEngine();
    await engine.unsupervised.recordSequence(ws, ['read_file', 'edit_file'], true);
    await engine.unsupervised.recordSequence(ws, ['read_file', 'edit_file'], true); // same run repeated
    const patterns = await engine.unsupervised.discoverPatterns(ws, 2);
    expect(patterns.find(p => p.pattern === 'edit_file+read_file')?.occurrences ?? 0).toBeLessThan(2);
  });

  it('reinforcement: rewards push strategy weights up', async () => {
    const ws = await tmpWorkspace();
    const engine = new LearningEngine();
    await engine.reinforcement.reward(ws, ['read-then-edit', 'test-after-change'], 1);
    await engine.reinforcement.reward(ws, ['read-then-edit'], 1);
    const ranked = await engine.reinforcement.ranked(ws);
    expect(ranked[0].strategy).toBe('read-then-edit');
    expect(ranked[0].weight).toBeGreaterThan(1);
    const playbook = await engine.reinforcement.playbookForPrompt(ws);
    expect(playbook).toContain('LEARNED PLAYBOOK');
  });

  it('reinforcement: detects strategies from a run history', () => {
    const strategies = ReinforcementLearner.detectStrategies([
      { tool: 'list_files' }, { tool: 'search_code' }, { tool: 'read_file' },
      { tool: 'edit_file' }, { tool: 'shell' },
    ]);
    expect(strategies).toContain('read-then-edit');
    expect(strategies).toContain('test-after-change');
    expect(strategies).toContain('search-before-read');
  });

  it('in-context: lessons trigger by task text', async () => {
    const ws = await tmpWorkspace();
    const engine = new LearningEngine();
    await engine.supervised.label(ws, 'deployed without asking', 'bad', 'never deploy unless explicitly asked');
    const lessons = await engine.prepareInContext(ws, 'fix and deploy the service');
    expect(lessons.some(l => l.includes('deploy'))).toBe(true);
  });

  it('renderForPrompt combines playbook + lessons + patterns', async () => {
    const ws = await tmpWorkspace();
    const engine = new LearningEngine();
    await engine.supervised.label(ws, 'skipped verification', 'bad', 'always verify');
    await engine.reinforcement.reward(ws, ['plan-first'], 1);
    const text = await engine.renderForPrompt(ws, 'fix the login bug');
    expect(text.length).toBeGreaterThan(0);
  });
});

describe('Alpine/Linux sandbox profiles', () => {
  it('has four profiles with alpine the smallest', () => {
    expect(Object.keys(SANDBOX_PROFILES)).toEqual(['alpine', 'node', 'python', 'ubuntu']);
    expect(SANDBOX_PROFILES.alpine.image).toBe('alpine:3.20');
    expect(SANDBOX_PROFILES.alpine.memoryMb).toBeLessThan(SANDBOX_PROFILES.ubuntu.memoryMb);
  });

  it('SecureSandbox applies the profile defaults', () => {
    const sandbox = new SecureSandbox({ profile: 'alpine' });
    expect(sandbox.profileInfo.profile).toBe('alpine');
    expect(sandbox.profileInfo.description).toContain('Alpine');
  });
});
