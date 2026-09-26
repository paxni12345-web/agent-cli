import { ToolSchema } from '../../types/index.js';

/** Everything the system prompt builder needs to know about this run. */
export interface SystemPromptContext {
  workspaceRoot: string;
  permissionMode: string;
  iteration: number;
  maxIterations: number;
  tools: ToolSchema[];
  subagentsEnabled?: boolean;
  /** Preloaded memory/context injected by the agent during boot. */
  memoryContext?: string;
}
