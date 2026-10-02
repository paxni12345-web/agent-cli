import { ToolRouter } from '../../src/agent/ToolRouter.js';
import { ToolSchema } from '../../src/types/index.js';

describe('ToolRouter', () => {
  const schemas: ToolSchema[] = [
    { name: 'read_file', description: 'Read source files', input_schema: { type: 'object', properties: {} } },
    { name: 'write_file', description: 'Write source files', input_schema: { type: 'object', properties: {} } },
    { name: 'shell', description: 'Run tests and build commands', input_schema: { type: 'object', properties: {} } },
  ];

  // Endpoints pointing at a closed port so every model stage fails fast
  // and the router passes the full tool list through unchanged.
  const dead = { xlam: 'http://127.0.0.1:1/v1/chat/completions', laya: 'http://127.0.0.1:1/v1/systemone' };

  function routerWith(maxTools: number, mode?: 'xlam' | 'chain', verify?: boolean): ToolRouter {
    process.env.LAYA_ROUTER_URL = dead.laya;
    process.env.XLAM_ROUTER_URL = dead.xlam;
    return new ToolRouter(maxTools, { mode, verify });
  }

  it('xlam mode passes the full list through when the model is unreachable', async () => {
    expect(await routerWith(1, 'xlam').select('run tests', schemas)).toEqual(schemas);
  });

  it('chain mode passes the full list through when both models are unreachable', async () => {
    expect(await routerWith(1, 'chain').select('run tests', schemas)).toEqual(schemas);
  });

  it('off mode never calls any model', async () => {
    expect(await routerWith(1, 'chain').select('anything', schemas)).toBe(schemas);
  });

  it('returns all schemas without calling any model when under the limit', async () => {
    expect(await routerWith(10, 'chain').select('anything', schemas)).toEqual(schemas);
  });
});
