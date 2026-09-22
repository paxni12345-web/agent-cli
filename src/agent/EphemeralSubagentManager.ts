import { Agent } from './Agent.js';
import { AIProvider } from '../providers/AIProvider.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { PermissionManager, Config } from '../types/index.js';

export interface SubagentRunOptions { maxIterations?: number; }

/** Creates short-lived agents. No child is retained after runSubtask resolves. */
export class EphemeralSubagentManager {
  private readonly active = new Set<Agent>();

  constructor(
    private readonly provider: AIProvider,
    private readonly toolRegistry: ToolRegistry,
    private readonly permissions: PermissionManager,
    private readonly parentConfig: Config,
  ) {}

  async runSubtask(task: string, options: SubagentRunOptions = {}): Promise<string> {
    const maxIterations = Math.min(Math.max(Math.floor(options.maxIterations ?? this.parentConfig.subagentMaxIterations ?? 6), 1), 12);
    const childConfig: Config = {
      ...this.parentConfig,
      maxIterations,
      toolRouterMaxTools: Math.min(this.parentConfig.toolRouterMaxTools ?? 12, 8),
      toolQueueConcurrency: 1,
      enableSubagents: false,
      debug: false,
    };
    const child = new Agent(this.provider, this.toolRegistry, this.permissions, childConfig);
    this.active.add(child);
    try {
      return await child.run(task);
    } finally {
      child.reset();
      child.removeAllListeners();
      this.active.delete(child);
    }
  }

  get activeCount(): number { return this.active.size; }
}
