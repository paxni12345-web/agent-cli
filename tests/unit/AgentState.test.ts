import { Agent } from '../../src/agent/Agent.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { Config, PermissionManager } from '../../src/types/index.js';

describe('Agent state safety', () => {
  it('returns a deep snapshot of state', () => {
    const provider = {
      name: 'mock',
      chat: async () => ({ content: 'ok', finishReason: 'stop' as const }),
      stream: async function* () {
        yield { delta: 'ok' };
      },
    };
    const permissions: PermissionManager = { check: () => ({ allowed: true }), requestApproval: async () => true };
    const config: Config = { provider: 'mock', model: 'mock', workspaceRoot: process.cwd(), permissionMode: 'normal', maxIterations: 2, temperature: 0, debug: false };
    const agent = new Agent(provider, new ToolRegistry(), permissions, config);
    const state = agent.getState();
    state.history.push({ tool: 'x', input: {}, result: { success: true }, timestamp: new Date() });
    expect(agent.getState().history).toHaveLength(0);
  });
});
