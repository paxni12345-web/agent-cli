import { ToolRegistry } from './ToolRegistry.js';
import { ListFilesTool, ReadFileTool, WriteFileTool, EditFileTool } from './FileTools.js';
import { ShellTool } from './ShellTool.js';
import { SearchCodeTool } from './SearchTool.js';
import { GitStatusTool, GitDiffTool, GitLogTool } from './GitTools.js';
import { ProjectMapTool } from './ProjectMapTool.js';
import { ProjectMemoryTool } from './ProjectMemoryTool.js';
import { SubagentTool } from './SubagentTool.js';
import { CreateEphemeralTool } from './EphemeralTool.js';

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of [new ListFilesTool(), new ReadFileTool(), new WriteFileTool(), new EditFileTool(), new ShellTool(), new SearchCodeTool(), new GitStatusTool(), new GitDiffTool(), new GitLogTool(), new ProjectMapTool(), new ProjectMemoryTool(), new SubagentTool(), new CreateEphemeralTool(registry)]) registry.register(tool);
  return registry;
}
