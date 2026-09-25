import { ToolRegistry } from './ToolRegistry.js';
import { ListFilesTool, ReadFileTool, WriteFileTool, EditFileTool } from './FileTools.js';
import { ShellTool } from './ShellTool.js';
import { SearchCodeTool } from './SearchTool.js';
import { GitStatusTool, GitDiffTool, GitLogTool } from './GitTools.js';
import { ProjectMapTool } from './ProjectMapTool.js';
import { ProjectMemoryTool } from './ProjectMemoryTool.js';
import { SubagentTool } from './SubagentTool.js';
import { SearchCodeMemoryTool, ImpactOfTool } from './MemoryHubTools.js';
import type { MemoryHub } from '../memory/MemoryHub.js';

export function createDefaultToolRegistry(hub?: MemoryHub): ToolRegistry {
  const registry = new ToolRegistry();
  const tools = [
    new ListFilesTool(), new ReadFileTool(), new WriteFileTool(), new EditFileTool(),
    new ShellTool(), new SearchCodeTool(),
    new GitStatusTool(), new GitDiffTool(), new GitLogTool(),
    new ProjectMapTool(), new ProjectMemoryTool(), new SubagentTool(),
  ];
  if (hub) {
    tools.push(new SearchCodeMemoryTool(hub), new ImpactOfTool(hub));
  }
  for (const tool of tools) registry.register(tool);
  return registry;
}
