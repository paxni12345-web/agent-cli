import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ProjectMapTool } from '../../src/tools/ProjectMapTool.js';
import { AgentState, PermissionManager, ToolContext } from '../../src/types/index.js';

const permissions: PermissionManager = {
  check: () => ({ allowed: true }),
  requestApproval: async () => true,
};

const state: AgentState = {
  status: 'idle',
  history: [],
  conversationMessages: [],
  iterationCount: 0,
  metadata: {},
};

describe('ProjectMapTool', () => {
  it('detects full-stack areas and excludes secrets from manifest output', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-project-map-'));
    await fs.mkdir(path.join(workspace, 'frontend'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'api'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'prisma'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'tests'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'package.json'), '{"scripts":{"test":"jest"}}');
    await fs.writeFile(path.join(workspace, '.env.example'), 'API_KEY=placeholder');
    await fs.writeFile(path.join(workspace, 'frontend', 'App.tsx'), 'export default function App() {}');
    await fs.writeFile(path.join(workspace, 'api', 'users.route.ts'), 'export const users = [];');
    await fs.writeFile(path.join(workspace, 'prisma', 'schema.prisma'), 'datasource db {}');
    await fs.writeFile(path.join(workspace, 'tests', 'users.test.ts'), 'test("users", () => {});');

    const context: ToolContext = { workspaceRoot: workspace, permissions, currentState: state };
    const result = await new ProjectMapTool().execute({}, context);

    expect(result.success).toBe(true);
    expect(result.output).toContain('Frontend');
    expect(result.output).toContain('Backend / API');
    expect(result.output).toContain('Data / persistence');
    expect(result.output).toContain('Tests');
    expect(result.output).toContain('Dependency-aware workflow');
    expect(result.output).not.toContain('API_KEY=placeholder');
  });
});
