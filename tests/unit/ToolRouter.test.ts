import { ToolRouter } from '../../src/agent/ToolRouter.js';
import { ToolSchema } from '../../src/types/index.js';

describe('ToolRouter', () => {
  const schemas: ToolSchema[] = [
    { name: 'read_file', description: 'Read source files', input_schema: { type: 'object', properties: {} } },
    { name: 'write_file', description: 'Write source files', input_schema: { type: 'object', properties: {} } },
    { name: 'shell', description: 'Run tests and build commands', input_schema: { type: 'object', properties: {} } },
  ];

  it('selects relevant tools and respects the limit', async () => {
    const router = new ToolRouter(1, 'http://127.0.0.1:1/v1/systemone');
    expect((await router.select('run tests', schemas)).map(tool => tool.name)).toEqual(['shell']);
  });

  it('keeps a fallback tool when there is no keyword match', async () => {
    expect(await new ToolRouter(2, 'http://127.0.0.1:1/v1/systemone').select('ช่วยหน่อย', schemas)).toHaveLength(2);
  });
});
