import { ToolRouter } from '../../src/agent/ToolRouter.js';
import { ToolSchema } from '../../src/types/index.js';

describe('ToolRouter', () => {
  const schemas: ToolSchema[] = [
    { name: 'read_file', description: 'Read source files', input_schema: { type: 'object', properties: {} } },
    { name: 'write_file', description: 'Write source files', input_schema: { type: 'object', properties: {} } },
    { name: 'shell', description: 'Run tests and build commands', input_schema: { type: 'object', properties: {} } },
  ];

  // Endpoints pointing at a closed port so every model stage fails fast
  // and the router degrades to the keyword fallback.
  const dead = { xlam: 'http://127.0.0.1:1/v1/chat/completions', laya: 'http://127.0.0.1:1/v1/systemone' };

  function routerWith(maxTools: number, mode?: 'chain' | 'laya' | 'xlam' | 'keyword', verify?: boolean): ToolRouter {
    process.env.LAYA_ROUTER_URL = dead.laya;
    process.env.XLAM_ROUTER_URL = dead.xlam;
    return new ToolRouter(maxTools, { mode, verify });
  }

  it('selects relevant tools and respects the limit (keyword fallback)', async () => {
    const router = routerWith(1, 'keyword');
    expect((await router.select('run tests', schemas)).map(tool => tool.name)).toEqual(['shell']);
  });

  it('keeps a fallback tool when there is no keyword match', async () => {
    expect(await routerWith(2, 'keyword').select('ช่วยหน่อย', schemas)).toHaveLength(2);
  });

  it('chain mode falls back to keywords when both models are unreachable', async () => {
    const result = await routerWith(1, 'chain').select('run tests', schemas);
    expect(result).toHaveLength(1);
    expect(result.map(tool => tool.name)).toEqual(['shell']);
  });

  it('xlam mode falls back to keywords when the model is unreachable', async () => {
    const result = await routerWith(1, 'xlam').select('run tests', schemas);
    expect(result).toHaveLength(1);
  });

  it('laya mode falls back to keywords when the model is unreachable', async () => {
    const result = await routerWith(1, 'laya').select('run tests', schemas);
    expect(result).toHaveLength(1);
  });

  it('returns all schemas without calling any model when under the limit', async () => {
    expect(await routerWith(10, 'chain').select('anything', schemas)).toEqual(schemas);
  });
});
