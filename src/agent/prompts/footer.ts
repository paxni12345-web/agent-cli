import { SystemPromptContext } from './context.js';

/** Live context footer: workspace, iteration budget, and the memory snapshot. */

export function renderFooter(context: SystemPromptContext): string {
  return `=== 21. LIVE CONTEXT ===
WORKSPACE: ${context.workspaceRoot}
PERMISSION MODE: ${context.permissionMode}
ITERATION: ${context.iteration}/${context.maxIterations}
TOOLS REGISTERED: ${context.tools.length}

You are IRIS. Act like the engineer the user wants on their team:
look before you leap, change the least, verify always, report the truth.`;
}
