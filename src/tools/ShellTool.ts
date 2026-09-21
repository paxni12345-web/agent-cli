import { spawn } from 'child_process';
import { Tool, ToolContext, ToolResult } from '../types/index.js';

export class ShellTool implements Tool {
  name = 'shell';
  description =
    'Execute shell commands in the workspace. Use this to run tests, build scripts, git commands, package managers, and other CLI tools. Output is captured and returned. Long-running commands will timeout after 2 minutes.';

  inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 120000 = 2 minutes)',
      },
    },
    required: ['command'],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const command = String(input.command || '');
      const timeout = input.timeout || 120000;

      if (!command.trim()) {
        return { success: false, error: 'Command is required' };
      }

      const risk = this.assessCommandRisk(command);
      const permissionResult = await context.permissions.check({
        type: 'execute_command',
        description: `Execute: ${command}`,
        command,
        risk,
      });

      if (!permissionResult.allowed) {
        return {
          success: false,
          error: `Permission denied: ${permissionResult.reason}`,
        };
      }

      const result = await this.executeCommand(command, {
        cwd: context.workspaceRoot,
        timeout,
      });

      return {
        success: true,
        output: this.formatOutput(result.stdout, result.stderr),
        metadata: {
          command,
          exitCode: result.exitCode,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message,
        metadata: {
          command: input.command,
          exitCode: error.exitCode || 1,
        },
      };
    }
  }

  private parseCommand(command: string): { program: string; args: string[] } {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;

    for (const char of command.trim()) {
      if (quote) {
        if (char === quote) {
          quote = null;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (/\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    if (tokens.length === 0) {
      throw new Error('Empty command');
    }

    return { program: tokens[0], args: tokens.slice(1) };
  }

  private executeCommand(
    command: string,
    options: { cwd: string; timeout: number }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { program, args } = this.parseCommand(command);

    return new Promise((resolve, reject) => {
      const child = spawn(program, args, {
        cwd: options.cwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
      }, options.timeout);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const fail = (message: string, exitCode: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject({ message, stdout, stderr, exitCode });
      };

      child.on('error', error => {
        fail(error.message, 1);
      });

      child.on('close', code => {
        if (settled) return;
        clearTimeout(timeoutId);

        if (timedOut) {
          fail('Command timed out', 124);
        } else if (code !== 0) {
          fail(`Command failed with exit code ${code}`, code || 1);
        } else {
          settled = true;
          resolve({ stdout, stderr, exitCode: code || 0 });
        }
      });
    });
  }

  private assessCommandRisk(command: string): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    const cmd = command.trim().toLowerCase();

    const criticalPatterns = [
      /rm\s+-rf\s+[/~]/,
      /sudo/,
      /dd\s+if=/,
      /mkfs/,
      /curl.*\|\s*sh/,
      /wget.*\|\s*sh/,
    ];

    for (const pattern of criticalPatterns) {
      if (pattern.test(cmd)) {
        return 'critical';
      }
    }

    const highRiskPatterns = [
      /^rm\s+-rf/,
      /^rm\s+-r/,
      /^chmod\s+-R/,
      /^chown/,
      /git\s+reset\s+--hard/,
      /git\s+clean\s+-[df]/,
      /docker\s+run/,
      /docker\s+rm/,
      /npm\s+publish/,
      /pip\s+install/,
    ];

    for (const pattern of highRiskPatterns) {
      if (pattern.test(cmd)) {
        return 'high';
      }
    }

    const mediumRiskCommands = [
      'rm', 'mv', 'cp', 'chmod', 'npm install', 'yarn install',
      'git commit', 'git push', 'git rebase',
    ];

    for (const riskCmd of mediumRiskCommands) {
      if (cmd.startsWith(riskCmd)) {
        return 'medium';
      }
    }

    const safeCommands = [
      'ls', 'pwd', 'cat', 'echo', 'git status', 'git diff',
      'git log', 'npm test', 'npm run', 'yarn test',
      'node', 'python', 'grep', 'find', 'which',
    ];

    for (const safeCmd of safeCommands) {
      if (cmd.startsWith(safeCmd)) {
        return 'safe';
      }
    }

    return 'low';
  }

  private formatOutput(stdout: string, stderr: string): string {
    const parts: string[] = [];

    if (stdout.trim()) {
      parts.push('STDOUT:\n' + this.truncateOutput(stdout));
    }

    if (stderr.trim()) {
      parts.push('STDERR:\n' + this.truncateOutput(stderr));
    }

    return parts.join('\n\n') || '(no output)';
  }

  private truncateOutput(output: string): string {
    const maxLines = 500;
    const lines = output.split('\n');

    if (lines.length > maxLines) {
      return (
        lines.slice(0, maxLines).join('\n') +
        `\n\n[... truncated ${lines.length - maxLines} lines ...]`
      );
    }

    return output;
  }
}
