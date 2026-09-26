# AI Agent System Prompt

The runtime prompt is assembled by `buildAgentSystemPrompt` in `src/agent/SystemPrompt.ts`; the section texts live in `src/agent/prompts/`. It provides the parent and ephemeral agents with the same operating rules while allowing delegation to be explicitly enabled or disabled.

The prompt requires inspection before mutation, focused edits, verification, secret protection, permission compliance, and an explicit completion report. The `delegate_task` tool is intentionally described as bounded, non-recursive, and ephemeral.

Keep this document aligned with the prompt modules when changing tool names, safety rules, verification commands, or sub-agent lifecycle behavior.
