// Basic unit tests for core components

import { ToolRegistry } from '../src/tools/ToolRegistry';
import { Tool, ToolContext, ToolResult } from '../src/types/index';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  test('should register a tool', () => {
    const mockTool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      execute: async () => ({ success: true }),
    };

    registry.register(mockTool);
    expect(registry.has('test_tool')).toBe(true);
  });

  test('should get a registered tool', () => {
    const mockTool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      execute: async () => ({ success: true }),
    };

    registry.register(mockTool);
    const retrieved = registry.get('test_tool');
    expect(retrieved).toBe(mockTool);
  });

  test('should list all tools', () => {
    const tool1: Tool = {
      name: 'tool1',
      description: 'Tool 1',
      inputSchema: { type: 'object' },
      execute: async () => ({ success: true }),
    };

    const tool2: Tool = {
      name: 'tool2',
      description: 'Tool 2',
      inputSchema: { type: 'object' },
      execute: async () => ({ success: true }),
    };

    registry.register(tool1);
    registry.register(tool2);

    const tools = registry.list();
    expect(tools).toHaveLength(2);
  });

  test('should prevent duplicate registration', () => {
    const mockTool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      execute: async () => ({ success: true }),
    };

    registry.register(mockTool);
    expect(() => registry.register(mockTool)).toThrow();
  });

  test('should unregister a tool', () => {
    const mockTool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      execute: async () => ({ success: true }),
    };

    registry.register(mockTool);
    expect(registry.has('test_tool')).toBe(true);

    registry.unregister('test_tool');
    expect(registry.has('test_tool')).toBe(false);
  });
});
