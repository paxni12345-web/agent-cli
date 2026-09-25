import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Agent } from '../../src/agent/Agent.js';
import { AIProvider } from '../../src/providers/AIProvider.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { PermissionManager, Config, ChatRequest, ChatResponse } from '../../src/types/index.js';
import { NoteSystem } from '../../src/agent/NoteSystem.js';

/** Provider whose chat() fails N times before succeeding — simulates
 *  rate limits / network blips / 5xx without a real API. */
class FlakyProvider implements AIProvider {
  name = 'flaky';
  calls = 0;
  constructor(
    private readonly failTimes: number,
    private readonly sleepMs = () => {}, // no real waiting in tests
  ) {}

  async chat(_request: ChatRequest): Promise<ChatResponse> {
    this.calls++;
    if (this.calls <= this.failTimes) {
      const e = new Error('429 rate_limited: too many requests') as Error & { status?: number };
      e.status = 429;
      throw e;
    }
    return { content: 'recovered fine', finishReason: 'stop' };
  }

  async *stream(): AsyncIterable<any> { yield { delta: 'x' }; }
}

/** Provider that always fails — proves the run ends in a defined error state. */
class DeadProvider implements AIProvider {
  name = 'dead';
  calls = 0;
  async chat(): Promise<ChatResponse> {
    this.calls++;
    throw new Error('ECONNREFUSED');
  }
  async *stream(): AsyncIterable<any> { yield { delta: 'x' }; }
}

class MockPermissionManager implements PermissionManager {
  check(_action: any): { allowed: true } { return { allowed: true }; }
  async requestApproval(): Promise<boolean> { return true; }
}

function baseConfig(ws: string): Config {
  return {
    provider: 'mock', model: 'm', workspaceRoot: ws, permissionMode: 'normal',
    maxIterations: 5, temperature: 0.5, debug: false,
    providerRetries: 3,
    contextWindowTokens: 100000, compressorKeepRecent: 12,
  };
}

async function tmpWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'iris-stab-'));
}

describe('Agent core-loop stability', () => {
  it('survives transient provider failures via bounded retry', async () => {
    const ws = await tmpWorkspace();
    const provider = new FlakyProvider(2);
    const agent = new Agent(provider, new ToolRegistry(), new MockPermissionManager(), baseConfig(ws));

    const retries: number[] = [];
    agent.on('providerRetry', (info: { attempt: number }) => retries.push(info.attempt));

    const response = await agent.run('do a thing');
    expect(response).toBe('recovered fine');
    expect(provider.calls).toBe(3); // 2 failures + 1 success
    expect(retries).toEqual([1, 2]);
    expect(agent.getState().status).toBe('completed');
  });

  it('throws a defined error (not a hang) when the provider is down', async () => {
    const ws = await tmpWorkspace();
    const provider = new DeadProvider();
    const agent = new Agent(provider, new ToolRegistry(), new MockPermissionManager(), baseConfig(ws));

    await expect(agent.run('do a thing')).rejects.toThrow('ECONNREFUSED');
    expect(provider.calls).toBe(4); // 1 + providerRetries(3)
  });

  it('a crashed run still flushes notes and resets cleanly for the next run', async () => {
    const ws = await tmpWorkspace();
    const provider = new DeadProvider();
    const agent = new Agent(provider, new ToolRegistry(), new MockPermissionManager(), baseConfig(ws));

    await expect(agent.run('first task')).rejects.toThrow();

    // crash-time observations must exist on disk even though the run failed
    const bugLog = await fs.readFile(path.join(ws, '.agent/memory/notes/bugs.md'), 'utf-8');
    expect(bugLog).toContain('[agent.run]');

    // a fresh run starts clean: no leftovers in the conversation
    const provider2 = new FlakyProvider(0);
    const agent2 = provider2 ? new Agent(provider2, new ToolRegistry(), new MockPermissionManager(), baseConfig(ws)) : null;
    agent2!.on('message', () => {}); // keep listener for parity
    const reply = await agent2!.run('second task');
    expect(reply).toBe('recovered fine');
    const state = agent2!.getState();
    expect(state.status).toBe('completed');
    // conversation starts from just the boot message, not residue
    expect(state.conversationMessages.length).toBeLessThanOrEqual(3);
  });

  it('bug log is capped and deduped per run (error loop cannot flood it)', async () => {
    const ws = await tmpWorkspace();
    const notes = new NoteSystem();
    notes.startRun();
    for (let i = 0; i < 50; i++) notes.observeBug('shell', 'exit code 1'); // identical error repeated
    notes.observeBug('shell', 'different error A');
    notes.observeBug('shell', 'different error B');
    notes.endRun();
    await notes.flush(ws);
    const bugLog = await fs.readFile(path.join(ws, '.agent/memory/notes/bugs.md'), 'utf-8');
    const bugLines = bugLog.split('\n').filter(l => l.includes('[shell]'));
    expect(bugLines.length).toBe(3); // 1 unique + 2 distinct
  });

  it('auto-facts cap at the configured maximum', async () => {
    const ws = await tmpWorkspace();
    const notes = new NoteSystem();
    notes.startRun();
    for (let i = 0; i < 30; i++) notes.observe({ tool: 'read_file', input: { path: `src/file_${i}.ts` }, result: { success: true, output: 'ok' } } as any);
    expect((notes as any).autoFacts.size).toBeLessThanOrEqual(8);
    notes.endRun();
    await notes.flush(ws);
  });
});
