# Changelog

## Unreleased

### Changed
- Safety modules (backups, secret scanner, shell safety, injection detector,
  security pipeline) moved from `agent/` into `security/`; notes moved into
  `memory/` — `tools/` and `memory/` no longer import from `agent/`
- Work orchestration split into `CompletionRouter`, `BrainstormEngine`, and
  `PlanningSystem`
- System prompt split into `agent/prompts/` modules; `SystemPrompt.ts` is now
  just the assembler
- Agent construction unified in `createAgent.ts`, used by the CLI, the TUI
  entry, and the settings flow
- Protected-path rules consolidated into `security/ProtectedPaths.ts`
  (single implementation, protection tiers kept)

### Removed
- Unused modules: `SandboxManager` (rehearsal flow was never wired),
  `MemoryNoteTaker`, `checkpoint/DiffPreview`
- Leftover scratch files (`tool-exports.tmp`, `tool-context.patch`)
- Stale internal checklist references in comments and test names

### Fixed
- `watch_files` fails on runtimes without recursive `fs.watch` support
  (Node < 20 on Linux): it now degrades to a top-level watch and reports
  which mode it used
- CI matrix now runs Node 20 and 22 (Node 18 is EOL)

## 0.2.0 — Project Cleanup & UI Overhaul

### Removed
- **~376,000 lines of dead code** — 98 auto-generated feature folders (blockchain, iot, payment, ml, video, etc.) that were never wired to the CLI and contained 843 type errors
- 60+ redundant docs (`FINAL_*.txt`, `*_SUMMARY.md`, `PLAN_*.md`, …)
- Duplicate server entries (`server.ts` with mock responses, `web.ts`), Vercel config, unused deploy workflows
- 20+ unused dependencies (aws-sdk, google-cloud, azure, bcrypt, jsonwebtoken, winston, joi, zod, …)
- Compiled `dist/` no longer committed to the repository

### Fixed
- All 843 TypeScript errors → **0** (strict mode enabled, NodeNext ESM)
- `AnthropicProvider` ignored the configured model (hardcoded to one model); now configurable via constructor + CLI flag
- `AnthropicProvider`/`OpenAIProvider` crashed when relaying tool-result content blocks between turns — now correctly formatted per provider API
- `cli.ts` called non-existent `ConfigLoader.getDefaults()` and `Agent.processMessage()` — replaced with real APIs
- ESM conversion: project now runs as pure ES modules (ink/chalk are ESM-only)
- Tool result arrays no longer lose their sanitized output during validation

### Added
- **UI wired to the real agent** — the Ink TUI now runs the actual Agent loop instead of demo mock responses
- Live tool activity feed in the TUI (tool name, status, duration, target summary)
- Token usage tracking in provider responses
- New slash commands: `/stats` (tool performance report), `/tools` (dynamic from registry), `/history` (recent tool executions), `/model <name>`
- `agent.getToolRegistry()` public accessor
- Provider test seam: inject a mock client via `new AnthropicProvider(key, { client })`
- CI workflow: typecheck + build + test on Node 18/20

### Changed
- `package.json` → ESM (`"type": "module"`), cleaned scripts, version 0.2.0
- `tsconfig.json` → strict, NodeNext, `noEmitOnError`
- ESLint config simplified to installed plugins only
- Dockerfile/start.sh/docker-compose rewritten for the ESM agent-server
- README rewritten to describe the actual project
