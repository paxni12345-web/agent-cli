# ◆ Agent CLI

Autonomous AI coding agent for your terminal — clean core, real tool calling, and a beautiful TUI.

## Features

- **Agentic loop** — plans, calls tools, verifies, and iterates until the task is done
- **Native tool calling** — Anthropic (Claude) & OpenAI with automatic format translation
- **Resilience built-in** — input validation, safety checks, retry with exponential backoff, error recovery strategies, and a circuit breaker for failing tools
- **Workflow-aware automation** — maps frontend, backend, data, tests, and deployment before making cross-layer changes
- **Dependency/API support** — can install required libraries through the project package manager and integrate APIs through environment-based credentials
- **Three-layer memory** — separates temporary session notes, workspace project knowledge, and user-wide preferences; never stores secrets
- **Beautiful TUI** — live streaming output, tool activity feed, token usage bar, command history
- **Two interfaces** — classic readline REPL (`agent chat`) or Ink UI (`agent-ui`)

## Install

```bash
npm install
npm run build
```

Set your API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
# or
export OPENAI_API_KEY=your-key-here
```

## Usage

### Interactive chat (readline)

```bash
agent chat
agent chat -p openai -m gpt-4o
agent chat --permission-mode auto --max-iterations 50
```

### Beautiful TUI (Ink)

```bash
agent-ui
agent-ui -m gpt-4o --mode fast
```

### One-shot task

```bash
agent run "add error handling to src/index.ts"
agent run --permission-mode safe --max-iterations 20 "review the auth flow"
```

`agent run` supports the same permission and iteration controls as `agent chat`.
Use `safe` when you want the agent to inspect without changing files.

### Full-stack automation

Use `automate` when one prompt should drive the complete workflow: map the project,
plan the affected layers, edit frontend/backend/data/config files, then run tests and
build checks.

```bash
agent automate --workspace . \
  "เพิ่มระบบสมัครสมาชิกให้ครบทั้งหน้าเว็บ API validation database migration และ tests"
```

The automation mode uses up to 80 iterations by default. Use `--permission-mode normal`
for approval before changes, or `--permission-mode auto` only in a trusted workspace.

### Utilities

```bash
agent init     # create .agent/config.json in this project
agent doctor   # check node, git, workspace, API keys
```

## Slash commands

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/status` | Agent status, iterations, tool calls |
| `/stats` | Tool performance report (success rate, latency) |
| `/tools` | List registered tools (live from the registry) |
| `/history` | Recent tool executions |
| `/model <name>` | Switch model |
| `/config` | Show configuration |
| `/reset` | Reset agent memory |
| `/clear` | Clear screen/view |
| `/exit` | Quit |

## Tools

| Tool | Description |
|---|---|
| `list_files` | Explore workspace structure |
| `read_file` | Read files (with line ranges) |
| `write_file` | Create or overwrite files |
| `edit_file` | Exact-match text replacement |
| `shell` | Run shell commands |
| `search_code` | Regex search across the project |
| `project_map` | Architecture/workflow map across frontend, backend, data, tests, and deployment |
| `project_memory` | Read/update non-secret `session`, `project`, or `global` memory |
| `git_status` / `git_diff` / `git_log` | Git inspection |

All file tools enforce workspace boundaries (symlink-safe path canonicalization) and every tool call passes schema validation + safety checks before execution.

## Configuration

Global: `~/.agent/config.json` · Project: `.agent/config.json`

```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "permissionMode": "normal",
  "maxIterations": 30,
  "temperature": 0.7
}
```

Environment overrides: `AGENT_MODEL`, `AGENT_PROVIDER`, `AGENT_PERMISSION_MODE`, `AGENT_MAX_ITERATIONS`, `AGENT_DEBUG`.

### Server safety

The HTTP server binds to `127.0.0.1` and disables cross-origin requests by default.
It also runs in read-only permission mode unless mutations are explicitly enabled:

```bash
export ANTHROPIC_API_KEY=your-key-here
export AGENT_SERVER_ALLOW_MUTATIONS=true   # optional; enables write/command tools
export AGENT_SERVER_HOST=127.0.0.1         # optional
export AGENT_SERVER_ORIGIN=http://localhost:3000
npm run server
```

Do not expose the server directly to the public internet. Put authentication and TLS in
front of it before using a non-local bind address. The server requires a real
`ANTHROPIC_API_KEY`; it never falls back to a demo key.

## Development

```bash
npm run dev        # typecheck & build in watch mode
npm test           # run unit tests
npm run typecheck  # tsc --noEmit
npm run server     # HTTP API around the agent (POST /api/agent/run)
```

## Project structure

```
src/
├── agent/          # Agent loop, validator, recovery, circuit breaker, monitor
├── providers/      # Anthropic + OpenAI (native tool calling, streaming)
├── tools/          # File, shell, search, git tools + registry
├── ui/             # Ink TUI (header, chat, input, status bar)
├── config/         # Config loader (global + project + env)
├── security/       # Permission modes
├── types/          # Shared types
├── cli.ts          # readline entry (agent chat | run | init | doctor)
├── cli-ui.tsx      # Ink entry (agent-ui)
└── agent-server.ts # HTTP API entry (agent-server)
```

## License

MIT
