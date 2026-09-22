import { Tool, ToolContext, ToolResult } from '../types/index.js';

/** Ephemeral tool used by the parent agent to delegate an isolated subtask. */
export class SubagentTool implements Tool {
  name = 'delegate_task';
  description = 'Delegate a focused research, analysis, test, or implementation subtask to a temporary sub-agent. The sub-agent is destroyed after returning its result.';
  inputSchema = {
    type: 'object',
    properties: {
      task: { type: 'string', minLength: 1, maxLength: 20000, description: 'A focused, self-contained task for the temporary sub-agent' },
      maxIterations: { type: 'number', minimum: 1, maximum: 12, description: 'Optional iteration limit for the sub-agent' },
    },
    required: ['task'],
  };

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const value = input as { task?: unknown; maxIterations?: unknown };
    if (typeof value.task !== 'string' || !value.task.trim()) {
      return { success: false, error: 'delegate_task requires a non-empty task' };
    }
    if (!context.spawnSubagent) {
      return { success: false, error: 'Temporary sub-agents are disabled for this agent' };
    }
    try {
      const output = await context.spawnSubagent(value.task.trim(), {
        maxIterations: typeof value.maxIterations === 'number' ? value.maxIterations : undefined,
      });
      return { success: true, output, metadata: { ephemeral: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), retryable: false };
    }
  }
}
