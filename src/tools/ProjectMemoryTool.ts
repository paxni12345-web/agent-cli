import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolContext, ToolResult } from '../types/index.js';

const MEMORY_FILE = '.agent/memory.md';
const SECRET_PATTERN = /(api[_-]?key|access[_-]?token|secret|password|private[_-]?key)\s*[:=]/i;

export class ProjectMemoryTool implements Tool {
  name = 'project_memory';
  description =
    'Read or update non-secret project memory in .agent/memory.md. Store architecture decisions, workflow conventions, known pitfalls, and verification commands; never store credentials or tokens.';

  inputSchema = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'append', 'replace'] },
      content: { type: 'string', description: 'Memory content for append or replace' },
    },
    required: ['action'],
  };

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const value = input as { action?: string; content?: string };
    const memoryPath = path.join(context.workspaceRoot, MEMORY_FILE);

    try {
      if (value.action === 'read') {
        const content = await fs.readFile(memoryPath, 'utf-8');
        return { success: true, output: content || '(project memory is empty)' };
      }

      if (value.action !== 'append' && value.action !== 'replace') {
        return { success: false, error: 'action must be read, append, or replace' };
      }
      if (typeof value.content !== 'string' || value.content.trim().length === 0) {
        return { success: false, error: 'content is required for append or replace' };
      }
      if (SECRET_PATTERN.test(value.content)) {
        return { success: false, error: 'Project memory cannot contain credentials or secret-like values' };
      }

      const permission = context.permissions.check({
        type: 'write_file',
        description: `${value.action} project memory`,
        target: MEMORY_FILE,
        risk: 'low',
      });
      if (!permission.allowed) {
        const reason = 'reason' in permission ? permission.reason : 'write was not allowed';
        return { success: false, error: `Permission denied: ${reason}` };
      }

      await fs.mkdir(path.dirname(memoryPath), { recursive: true });
      if (value.action === 'replace') {
        await fs.writeFile(memoryPath, value.content.trim() + '\n', 'utf-8');
      } else {
        await fs.appendFile(memoryPath, `\n${value.content.trim()}\n`, 'utf-8');
      }
      return { success: true, output: `Project memory updated: ${MEMORY_FILE}` };
    } catch (error: any) {
      if (value.action === 'read' && error.code === 'ENOENT') {
        return { success: true, output: '(no project memory yet)' };
      }
      return { success: false, error: error.message };
    }
  }
}
