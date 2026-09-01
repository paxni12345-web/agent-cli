"use strict";
// Shell Execution Tool
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShellTool = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ShellTool {
    name = 'shell';
    description = `Execute shell commands in the workspace.
Use this to run tests, build scripts, git commands, package managers, and other CLI tools.
Output is captured and returned. Long-running commands will timeout after 2 minutes.`;
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
    async execute(input, context) {
        try {
            const command = input.command;
            const timeout = input.timeout || 120000;
            // Check permission based on command risk
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
            // Parse command into program and arguments to prevent injection
            const { program, args } = this.parseCommand(command);
            // Execute command using spawn for better security
            const result = await this.executeWithSpawn(program, args, {
                cwd: context.workspaceRoot,
                timeout,
            });
            const output = this.formatOutput(result.stdout, result.stderr);
            return {
                success: true,
                output,
                metadata: {
                    command,
                    exitCode: result.exitCode,
                },
            };
        }
        catch (error) {
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
    /**
     * Parse command string into program and arguments
     * This prevents shell injection by avoiding shell interpretation
     */
    parseCommand(command) {
        const parts = command.trim().split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);
        // Validate program name (no path traversal or special chars)
        if (program.includes('..') || program.includes('/') && !program.startsWith('/usr/')) {
            throw new Error('Invalid program name');
        }
        return { program, args };
    }
    /**
     * Execute command using spawn instead of exec for security
     */
    executeWithSpawn(program, args, options) {
        return new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)(program, args, {
                cwd: options.cwd,
                shell: false, // IMPORTANT: Don't use shell to prevent injection
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            const timeoutId = setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
                setTimeout(() => child.kill('SIGKILL'), 5000);
            }, options.timeout);
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            child.on('error', (error) => {
                clearTimeout(timeoutId);
                reject({
                    message: error.message,
                    stdout,
                    stderr,
                    exitCode: 1,
                });
            });
            child.on('close', (code) => {
                clearTimeout(timeoutId);
                if (timedOut) {
                    reject({
                        message: 'Command timed out',
                        stdout,
                        stderr,
                        exitCode: 124,
                    });
                }
                else if (code !== 0) {
                    reject({
                        message: `Command failed with exit code ${code}`,
                        stdout,
                        stderr,
                        exitCode: code || 1,
                    });
                }
                else {
                    resolve({
                        stdout,
                        stderr,
                        exitCode: code || 0,
                    });
                }
            });
        });
    }
    assessCommandRisk(command) {
        const cmd = command.trim().toLowerCase();
        // Critical risk commands
        const criticalPatterns = [
            /rm\s+-rf\s+[\/~]/,
            /sudo/,
            /dd\s+if=/,
            /mkfs/,
            /format/,
            /curl.*\|\s*sh/,
            /wget.*\|\s*sh/,
        ];
        for (const pattern of criticalPatterns) {
            if (pattern.test(cmd)) {
                return 'critical';
            }
        }
        // High risk commands
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
        // Medium risk commands
        const mediumRiskCommands = [
            'rm', 'mv', 'cp', 'chmod', 'npm install', 'yarn install',
            'git commit', 'git push', 'git rebase'
        ];
        for (const riskCmd of mediumRiskCommands) {
            if (cmd.startsWith(riskCmd)) {
                return 'medium';
            }
        }
        // Safe commands
        const safeCommands = [
            'ls', 'pwd', 'cat', 'echo', 'git status', 'git diff',
            'git log', 'npm test', 'npm run', 'yarn test',
            'node', 'python', 'grep', 'find', 'which'
        ];
        for (const safeCmd of safeCommands) {
            if (cmd.startsWith(safeCmd)) {
                return 'safe';
            }
        }
        return 'low';
    }
    formatOutput(stdout, stderr) {
        const parts = [];
        if (stdout.trim()) {
            parts.push('STDOUT:\n' + this.truncateOutput(stdout));
        }
        if (stderr.trim()) {
            parts.push('STDERR:\n' + this.truncateOutput(stderr));
        }
        return parts.join('\n\n') || '(no output)';
    }
    truncateOutput(output) {
        const maxLines = 500;
        const lines = output.split('\n');
        if (lines.length > maxLines) {
            return lines.slice(0, maxLines).join('\n') +
                `\n\n[... truncated ${lines.length - maxLines} lines ...]`;
        }
        return output;
    }
}
exports.ShellTool = ShellTool;
