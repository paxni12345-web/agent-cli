# ◆ Agent CLI

Autonomous AI coding agent for your terminal — clean core, real tool calling, and a beautiful TUI.

## Features

- **Agentic loop** — plans, calls tools, verifies, and iterates until the task is done
- **Native tool calling** — Anthropic (Claude) & OpenAI with automatic format translation
- **Resilience built-in** — input validation, safety checks, retry with exponential backoff, error recovery strategies, and a circuit breaker for failing tools
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
```

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
