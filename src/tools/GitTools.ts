// Git Tools

import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolContext, ToolResult } from '../types/index.js';

const execAsync = promisify(exec);

export class GitStatusTool implements Tool {
  name = 'git_status';
  description = `Get the current git status of the workspace.
Shows modified, added, deleted, and untracked files.`;

  inputSchema = {
    type: 'object',
    properties: {},
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: context.workspaceRoot,
      });

      if (!stdout.trim()) {
        return {
          success: true,
          output: 'Working tree is clean.',
        };
      }

      return {
        success: true,
        output: stdout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Not a git repository or git is not installed.',
      };
    }
  }
}

export class GitDiffTool implements Tool {
  name = 'git_diff';
  description = `Show git diff of changes in the workspace.
Use this to see what has been modified before committing.`;

  inputSchema = {
    type: 'object',
    properties: {
      staged: {
        type: 'boolean',
        description: 'Show staged changes only (default: false)',
      },
      file: {
        type: 'string',
        description: 'Specific file to show diff for (optional)',
      },
    },
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const staged = input.staged ?? false;
      const file = input.file || '';

      const command = staged
        ? `git diff --staged ${file}`
        : `git diff ${file}`;

      const { stdout } = await execAsync(command, {
        cwd: context.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (!stdout.trim()) {
        return {
          success: true,
          output: 'No changes.',
        };
      }

      // Truncate if too large
      const maxLines = 1000;
      const lines = stdout.split('\n');
      const output = lines.length > maxLines
        ? lines.slice(0, maxLines).join('\n') + `\n\n[... truncated ${lines.length - maxLines} lines ...]`
        : stdout;

      return {
        success: true,
        output,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export class GitLogTool implements Tool {
  name = 'git_log';
  description = `Show recent git commit history.
Useful for understanding recent changes and project history.`;

  inputSchema = {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Number of commits to show (default: 10)',
      },
      file: {
        type: 'string',
        description: 'Show log for specific file (optional)',
      },
    },
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const limit = input.limit ?? 10;
      const file = input.file || '';

      const command = `git log --oneline -n ${limit} ${file}`;

      const { stdout } = await execAsync(command, {
        cwd: context.workspaceRoot,
      });

      if (!stdout.trim()) {
        return {
          success: true,
          output: 'No commits found.',
        };
      }

      return {
        success: true,
        output: stdout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
