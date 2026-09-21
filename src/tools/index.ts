import { ToolRegistry } from './ToolRegistry.js';
import { ListFilesTool, ReadFileTool, WriteFileTool, EditFileTool } from './FileTools.js';
import { ShellTool } from './ShellTool.js';
import { SearchCodeTool } from './SearchTool.js';
import { GitStatusTool, GitDiffTool, GitLogTool } from './GitTools.js';

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of [
    new ListFilesTool(),
    new ReadFileTool(),
    new WriteFileTool(),
    new EditFileTool(),
    new ShellTool(),
    new SearchCodeTool(),
    new GitStatusTool(),
    new GitDiffTool(),
    new GitLogTool(),
  ]) {
    registry.register(tool);
  }
  return registry;
}
