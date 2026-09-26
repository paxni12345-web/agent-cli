import { SystemPromptContext } from './prompts/context.js';
import { renderIdentity, renderBootAndMemory } from './prompts/identity.js';
import { renderPrinciples, renderWorkflow, renderPlanning } from './prompts/principles.js';
import { renderToolCatalog, renderSelectionMatrix, renderParallelism } from './prompts/toolGuide.js';
import { renderErrorHandling, renderSafety, renderPermissionModes } from './prompts/safety.js';
import { renderCommunication, renderCompletionContract, renderResponseFormat, renderHardLimits, renderDelegation, renderGitEtiquette } from './prompts/communication.js';
import { renderTesting, renderDependencies, renderRecipes, renderAntiPatterns } from './prompts/practices.js';
import { renderFooter } from './prompts/footer.js';

/**
 * System prompt construction for the IRIS coding agent.
 *
 * The prompt is the agent's operating manual: long, dense, and rebuilt on
 * every model call so counters (iteration, limits) stay accurate. Every
 * section is deterministic — no timestamps, no random values — which keeps
 * provider-side prompt caching effective. The section texts live in
 * ./prompts/, one module per theme.
 */

export type { SystemPromptContext } from './prompts/context.js';

/**
 * First-turn instructions the agent wraps around the user's message.
 * Tells the agent to read its own memory layers and orient itself in the
 * workspace before answering — this is the "agent reads the user's machine"
 * bootstrap that gives it built-in long-term memory.
 */
export function buildBootInstructions(userMessage: string): string {
  return `<<BOOT_SEQUENCE>>
Before answering the user below, orient yourself. Do this silently and quickly:

1. Read your memory layers (they may not exist yet — that is fine):
   - project_memory(action="read", layer="project")  → architecture, conventions, past decisions
   - project_memory(action="read", layer="session")  → context from earlier in this session
   - project_memory(action="read", layer="global")   → user-wide preferences
2. If memory is empty and the task is non-trivial, run project_map() once to
   understand the repository, then write the essentials back:
   - project_memory(action="append", layer="project", content="…") for durable facts
   - project_memory(action="append", layer="session", content="…") for task context
3. If the task names specific files or directories, list_files and read_file
   them before making any claim about their contents.
4. Never re-derive facts you already have: trust your memory if it is not
   contradicted by what you see on disk, and update memory when it is.

Only after this orientation, address the user's request.
<<END_BOOT_SEQUENCE>>

USER REQUEST:
${userMessage}`;
}

/**
 * Builds the operational system prompt shared by parent and ephemeral agents.
 */
export function buildAgentSystemPrompt(context: SystemPromptContext): string {
  const toolCatalog = renderToolCatalog(context.tools);
  const delegation = renderDelegation(context.subagentsEnabled === true);
  const memory = context.memoryContext?.trim()
    ? `\n=== CURRENT MEMORY SNAPSHOT (preloaded at boot) ===\n${context.memoryContext.trim()}\nKeep this in mind; refresh it with project_memory when it becomes stale.\n`
    : '';

  return `${renderIdentity()}
${renderBootAndMemory()}
${renderPrinciples()}
${renderWorkflow()}
${renderPlanning()}
${toolCatalog}
${renderSelectionMatrix()}
${renderParallelism()}
${renderErrorHandling()}
${renderSafety()}
${renderPermissionModes(context.permissionMode)}
${renderCommunication()}
${renderCompletionContract()}
${renderResponseFormat()}
${renderHardLimits(context.maxIterations)}
${renderGitEtiquette()}
${renderTesting()}
${renderDependencies()}
${renderRecipes()}
${renderAntiPatterns()}
${delegation}
${memory}
${renderFooter(context)}`;
}
