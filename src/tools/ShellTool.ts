import { spawn } from 'child_process';
import { Tool, ToolContext, ToolResult } from '../types/index.js';

export class ShellTool implements Tool {
  name = 'shell';
  description = 'Execute a shell command in the workspace.';
  inputSchema = { type: 'object', properties: { command: { type: 'string' }, timeout: { type: 'number' } }, required: ['command'] };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const command = String(input.command || '');
      if (!command.trim()) return { success: false, error: 'Command is required' };
      const permission = await context.permissions.check({ type: 'execute_command', description: `Execute: ${command}`, command, risk: this.assessCommandRisk(command) });
      if (permission.allowed === false) return { success: false, error: `Permission denied: ${permission.reason}` };
      const result = await this.executeCommand(command, { cwd: context.workspaceRoot, timeout: Number(input.timeout) || 120000, signal: context.signal });
      return { success: true, output: this.formatOutput(result.stdout, result.stderr), metadata: { command, exitCode: result.exitCode } };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.message || String(error), metadata: { command: input.command, exitCode: error.exitCode || 1 } };
    }
  }

  private parseCommand(command: string): { program: string; args: string[] } {
    const tokens: string[] = []; let current = ''; let quote: '"' | "'" | null = null;
    for (const char of command.trim()) { if (quote) { if (char === quote) quote = null; else current += char; } else if (char === '"' || char === "'") quote = char; else if (/\s/.test(char)) { if (current) { tokens.push(current); current = ''; } } else current += char; }
    if (current) tokens.push(current); if (!tokens.length) throw new Error('Empty command');
    return { program: tokens[0], args: tokens.slice(1) };
  }

  private executeCommand(command: string, options: { cwd: string; timeout: number; signal?: AbortSignal }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { program, args } = this.parseCommand(command);
    return new Promise((resolve, reject) => {
      const child = spawn(program, args, { cwd: options.cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = ''; let settled = false; let timedOut = false;
      const finishError = (message: string, exitCode: number) => { if (settled) return; settled = true; clearTimeout(timeoutId); reject({ message, stdout, stderr, exitCode }); };
      const kill = (message: string, code: number) => { if (settled) return; timedOut = code === 124; child.kill('SIGTERM'); setTimeout(() => { if (!settled) child.kill('SIGKILL'); }, 5000); finishError(message, code); };
      const timeoutId = setTimeout(() => kill('Command timed out', 124), options.timeout);
      const onAbort = () => kill('Command cancelled', 130);
      if (options.signal?.aborted) onAbort(); else options.signal?.addEventListener('abort', onAbort, { once: true });
      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); }); child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });
      child.on('error', error => finishError(error.message, 1));
      child.on('close', code => { if (settled) return; settled = true; clearTimeout(timeoutId); options.signal?.removeEventListener('abort', onAbort); if (timedOut) reject({ message: 'Command timed out', stdout, stderr, exitCode: 124 }); else if (code !== 0) reject({ message: `Command failed with exit code ${code}`, stdout, stderr, exitCode: code || 1 }); else resolve({ stdout, stderr, exitCode: code || 0 }); });
    });
  }

  private assessCommandRisk(command: string): 'safe' | 'low' | 'medium' | 'high' | 'critical' { const cmd = command.trim().toLowerCase(); if (/rm\s+-rf\s+[\/~]|sudo|dd\s+if=|mkfs|curl.*\|\s*sh|wget.*\|\s*sh/.test(cmd)) return 'critical'; if (/^rm\s+-r|chmod\s+-R|^chown|git\s+reset\s+--hard|git\s+clean\s+-[df]|docker\s+(run|rm)|npm\s+publish|pip\s+install/.test(cmd)) return 'high'; if (/^(rm|mv|cp|chmod|npm install|yarn install|git commit|git push|git rebase)/.test(cmd)) return 'medium'; if (/^(ls|pwd|cat|echo|git status|git diff|git log|npm test|npm run|yarn test|node|python|grep|find|which)/.test(cmd)) return 'safe'; return 'low'; }
  private formatOutput(stdout: string, stderr: string): string { const parts = []; if (stdout.trim()) parts.push('STDOUT:\n' + this.truncateOutput(stdout)); if (stderr.trim()) parts.push('STDERR:\n' + this.truncateOutput(stderr)); return parts.join('\n\n') || '(no output)'; }
  private truncateOutput(output: string): string { const lines = output.split('\n'); return lines.length > 500 ? lines.slice(0, 500).join('\n') + `\n\n[... truncated ${lines.length - 500} lines ...]` : output; }
}
