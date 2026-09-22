# AI Agent System Prompt

The runtime prompt is built by `buildAgentSystemPrompt` in `src/agent/SystemPrompt.ts`. It provides the parent and ephemeral agents with the same operating rules while allowing delegation to be explicitly enabled or disabled.

The prompt requires inspection before mutation, focused edits, verification, secret protection, permission compliance, and an explicit completion report. The `delegate_task` tool is intentionally described as bounded, non-recursive, and ephemeral.

Keep this document and `AGENTS.md` aligned when changing tool names, safety rules, verification commands, or sub-agent lifecycle behavior.
