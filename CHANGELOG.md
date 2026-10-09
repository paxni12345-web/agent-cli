# Changelog

## Unreleased

### Added
- Per-user sandboxes for the code agent (`AGENT_SANDBOX=e2b`): each signed-in agent user gets
  a private E2B sandbox that runs its own copy of the agent; the main server only proxies
  `/api/agent/run|stop|events|status|clear|files`. Everything else under `/api/agent` is refused
  for signed-in users; the admin key keeps the local agent. Fails closed without `E2B_API_KEY`.
  New env: `AGENT_SANDBOX`, `E2B_API_KEY`, `E2B_TEMPLATE`, `AGENT_SANDBOX_REPO`, `AGENT_SANDBOX_REF`,
  `AGENT_SANDBOX_IDLE_MINUTES`, `AGENT_SANDBOX_MAX`
- `/terms.html` and `/privacy.html` (Thai) served with the operator's name and contact filled in from
  `PUBLIC_SERVICE_NAME` and `PUBLIC_CONTACT_EMAIL`; the login page links to them and no longer shows the
  dead "recover account" link. A warning is logged when public sign-up is on without a contact address.
- Plain chat API for signed-in users (`/api/chat/*`): per-user chat history in Supabase
  (`db/supabase.sql`), streamed replies over SSE, daily per-user token quota, a global
  daily cost cap, one reply at a time per user. The model is called without tools.
  `AGENT_PUBLIC_SIGNUP=true` admits any verified Google account to this API only; the
  agent with tools stays on the allowlist. Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CHAT_*`, `AGENT_BLOCKED_EMAILS`
- Optional Google sign-in through Firebase Auth: the server verifies ID tokens
  and only lets allowlisted, verified emails in (`FIREBASE_PROJECT_ID`,
  `AGENT_ALLOWED_EMAILS`); `/login.html` signs in and the chat page redirects
  there when signed out
- `GET /api/auth/config` and `GET /api/agent/me`
- Web UI wired to the agent server: `/api/agent/run`, `/stop`, `/clear`, live
  tool activity over `/events`, and provider/model/API-key settings saved to the
  server
- Subresource Integrity hashes on every CDN asset; the UI document's CSP now
  allows cdnjs and Google Fonts (API responses keep the strict policy)
- `tests/ui/agentUi.test.ts`: jsdom tests for the new page

### Changed
- `npm start` now runs the HTTP server; `agent-server` is the only `bin`
- The web UI no longer keeps an API key in the browser (keys saved by older
  versions are purged); the key lives on the server
- README, CONTRIBUTING, SECURITY and `.env.example` describe the server and web
  UI only
- Require Node.js 20 or newer, matching the supported CI matrix.
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
- The CLI and Ink TUI (`agent chat|run|automate|init|doctor`, `agent-ui`,
  `irissetting`) and the dependencies only they used (`chalk`, `commander`,
  `ink`, `ink-text-input`, `react`, `lucide-static`)
- The previous web UI, the vendored Mitr fonts, its tests and the icon-sprite
  script
- Unused modules: `SandboxManager` (rehearsal flow was never wired),
  `MemoryNoteTaker`, `checkpoint/DiffPreview`
- Leftover scratch files (`tool-exports.tmp`, `tool-context.patch`)
- Stale internal checklist references in comments and test names

### Fixed
- `OllamaProvider` did not match the shared provider types, which broke
  `npm run build`
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
