import { ToolRegistry } from './ToolRegistry.js';
import { ListFilesTool, ReadFileTool, WriteFileTool, EditFileTool } from './FileTools.js';
import { ShellTool } from './ShellTool.js';
import { SearchCodeTool } from './SearchTool.js';
import { GitStatusTool, GitDiffTool, GitLogTool } from './GitTools.js';
import { ProjectMapTool } from './ProjectMapTool.js';
import { ProjectMemoryTool } from './ProjectMemoryTool.js';
import { SubagentTool } from './SubagentTool.js';
import { SearchCodeMemoryTool, ImpactOfTool } from './MemoryHubTools.js';
import { FS_OPS_TOOLS } from './FsOpsTools.js';
import { CODE_NAV_TOOLS } from './CodeNavTools.js';
import { QUALITY_TOOLS } from './QualityTools.js';
import { GIT_FLOW_TOOLS } from './GitFlowTools.js';
import { DEPENDENCY_TOOLS } from './DependencyTools.js';
import { BUILD_DEPLOY_TOOLS } from './BuildDeployTools.js';
import { WEB_API_TOOLS } from './WebApiTools.js';
import type { MemoryHub } from '../memory/MemoryHub.js';

export function createDefaultToolRegistry(hub?: MemoryHub): ToolRegistry {
  const registry = new ToolRegistry();
  const tools = [
    new ListFilesTool(), new ReadFileTool(), new WriteFileTool(), new EditFileTool(),
    new ShellTool(), new SearchCodeTool(),
    new GitStatusTool(), new GitDiffTool(), new GitLogTool(),
    new ProjectMapTool(), new ProjectMemoryTool(), new SubagentTool(),
    ...FS_OPS_TOOLS, ...CODE_NAV_TOOLS, ...QUALITY_TOOLS,
    ...GIT_FLOW_TOOLS, ...DEPENDENCY_TOOLS, ...BUILD_DEPLOY_TOOLS, ...WEB_API_TOOLS,
  ];
  if (hub) {
    tools.push(new SearchCodeMemoryTool(hub), new ImpactOfTool(hub));
  }
  for (const tool of tools) registry.register(tool);
  return registry;
}
