import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ProjectMemoryTool } from '../../src/tools/ProjectMemoryTool.js';
import { AgentState, PermissionManager, ToolContext } from '../../src/types/index.js';

const state: AgentState = {
  status: 'idle', history: [], conversationMessages: [], iterationCount: 0, metadata: {},
};
const permissions: PermissionManager = {
  check: () => ({ allowed: true }),
  requestApproval: async () => true,
};

describe('ProjectMemoryTool', () => {
  it('persists non-secret decisions and refuses secret-like content', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-memory-'));
    const context: ToolContext = { workspaceRoot: workspace, permissions, currentState: state };
    const tool = new ProjectMemoryTool();

    expect((await tool.execute({ action: 'append', content: 'Use npm test before release.' }, context)).success).toBe(true);
    expect((await tool.execute({ action: 'read' }, context)).output).toContain('Use npm test before release.');
    expect((await tool.execute({ action: 'append', content: 'API_KEY: do-not-store' }, context)).success).toBe(false);
  });
});
