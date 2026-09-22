import { ToolRouter } from '../../src/agent/ToolRouter.js';
import { ToolSchema } from '../../src/types/index.js';

describe('ToolRouter', () => {
  const schemas: ToolSchema[] = [
    { name: 'read_file', description: 'Read source files', input_schema: { type: 'object', properties: {} } },
    { name: 'write_file', description: 'Write source files', input_schema: { type: 'object', properties: {} } },
    { name: 'shell', description: 'Run tests and build commands', input_schema: { type: 'object', properties: {} } },
  ];

  it('selects relevant tools and respects the limit', () => {
    const router = new ToolRouter(1);
    expect(router.select('run tests', schemas).map(tool => tool.name)).toEqual(['shell']);
  });

  it('keeps a fallback tool when there is no keyword match', () => {
    expect(new ToolRouter(2).select('ช่วยหน่อย', schemas)).toHaveLength(2);
  });
});
