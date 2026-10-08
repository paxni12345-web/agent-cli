# ◆ Agent

Autonomous AI coding agent with a web UI — it plans, edits files, runs commands in a sandbox, and verifies its own work before reporting back. A small HTTP server runs the agent loop and serves the chat page.

## Features

- **Agentic loop** — plans, calls tools, verifies, and iterates until the task is done
- **Native tool calling** — Anthropic (Claude) & OpenAI with automatic format translation
- **Resilience built-in** — input validation, safety checks, retry with exponential backoff, error recovery strategies, and a circuit breaker for failing tools
- **Workflow-aware automation** — maps frontend, backend, data, tests, and deployment before making cross-layer changes
- **Dependency/API support** — can install required libraries through the project package manager and integrate APIs through environment-based credentials
- **Three-layer memory** — separates temporary session notes, workspace project knowledge, and user-wide preferences; never stores secrets
- **Web UI** — chat page served by the built-in HTTP server: live tool activity, code blocks and math, dark/light theme, file attachments, provider and model settings
- **Extensible** — install skills, MCP servers and plugins from a GitHub URL through the HTTP API

## Install

Requires Node.js 20 or newer.

```bash
npm install
npm run build
```

## Usage

Start the server and open the UI:

```bash
export ANTHROPIC_API_KEY=your-key-here   # or OPENAI_API_KEY — can also be entered in the UI's settings
npm start                                # runs node dist/agent-server.js
# then open http://127.0.0.1:3000/
```

`npm run server` is the same entry point for development.

The server is **read-only by default**: the agent can inspect the workspace and answer, but cannot write files or run commands. Set `AGENT_SERVER_ALLOW_MUTATIONS=true` to allow that.

### HTTP API

You can also drive the agent without the UI. Everything under `/api/agent/` requires the token when `AGENT_SERVER_API_KEY` is set.

| Endpoint | Purpose |
|---|---|
| `POST /api/agent/run` | Run a message (`{ message, attachments? }`) and wait for the reply |
| `POST /api/agent/stop` | Stop the run in progress |
| `POST /api/agent/clear` | Forget the conversation (404 before the first run) |
| `GET /api/agent/status` | Agent status |
| `GET /api/agent/events` | Server-Sent Events: live tool activity |
| `GET`/`PUT /api/agent/settings` | Provider, model, base URL, API key, reasoning level |
| `GET`/`PUT /api/agent/profiles`, `DELETE /api/agent/profiles/:name`, `POST /api/agent/profiles/activate` | Saved provider profiles |
| `GET /api/agent/report`, `/api/agent/metrics/:toolName`, `/api/agent/export` | Tool metrics and exports |
| `POST`/`GET`/`DELETE /api/agent/files` | Uploaded files |
| `/api/agent/extensions/*` | Skills, MCP servers and plugins (see below) |
| `GET /api/health` | Liveness check (no token needed) |
| `GET /api/auth/config` | Public: which sign-in mode is active and the Firebase web config |
| `GET /api/agent/me` | The signed-in account (`null` for the static key) |

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

### Sandbox & execution isolation

Shell commands never run bare. Two isolation tiers, selected automatically:

1. **Docker tier (default)** — every `shell` command runs inside a container with:
   - `--network none` (no inbound/outbound network)
   - memory / CPU / pids caps (`--memory`, `--cpus`, `--pids-limit`)
   - disk quota via `--ulimit fsize` and a read-only rootfs with a size-capped `noexec` tmpfs at `/tmp`
   - non-root user (`--user nobody` by default), `--cap-drop ALL`, `no-new-privileges`
   - the workspace as the only host bind-mount
2. **Local tier (no Docker)** — commands are wrapped with OS guards:
   - `ulimit` caps: CPU seconds, address space, file size, process count, core dumps off
   - `unshare -n` network-namespace isolation when available
   - `setpriv` demotion from root with all capabilities dropped (when running as root)
   - pre-flight rejection of commands referencing paths outside the workspace
     (absolute system paths, `~`, `$HOME`)

Set `AGENT_SANDBOX_REQUIRE_ISOLATION=true` to **fail closed**: shell commands are refused when Docker is unavailable instead of falling back to the guarded local tier.

```bash
export AGENT_SANDBOX_DOCKER_USER=1000:1000   # container user (default nobody)
export AGENT_SANDBOX_TMPFS_MB=256            # /tmp tmpfs + fsize quota (MB)
export AGENT_SANDBOX_REQUIRE_ISOLATION=true  # no local fallback
export AGENT_SANDBOX_LOCAL_CPU=30            # local ulimit -t (seconds)
export AGENT_SANDBOX_LOCAL_MEMORY_KB=1048576 # local ulimit -v
export AGENT_SANDBOX_LOCAL_PROCS=128         # local ulimit -u
export AGENT_SANDBOX_LOCAL_ALLOW_OUTSIDE=false # strict workspace paths
```

## Configuration

The server is configured with environment variables (`.env.example` lists them):

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Provider credential. It can also be set from the UI; it is held in memory only |
| `AGENT_PROVIDER` | `anthropic` (default) or `openai` |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` | Model name |
| `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` | Custom endpoint |
| `PORT` | Listen port (default `3000`) |
| `AGENT_SERVER_HOST` | Bind address (default `127.0.0.1`) |
| `AGENT_SERVER_API_KEY` | Token required on `/api/agent/*`. **Required when the host is not loopback** — the server answers 503 otherwise |
| `FIREBASE_PROJECT_ID` | Turns on Google sign-in through Firebase Auth (see below) |
| `FIREBASE_WEB_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_AUTH_DOMAIN` | Firebase web config served to the pages (public values; the auth domain defaults to `<project>.firebaseapp.com`) |
| `AGENT_ALLOWED_EMAILS` | Comma-separated emails allowed to sign in; an empty list admits nobody |
| `AGENT_SERVER_ORIGIN` | Comma-separated allowed CORS origins (cross-origin requests are off by default) |
| `AGENT_SERVER_ALLOW_MUTATIONS` | `true` lets the agent write files and run commands |
| `AGENT_SERVER_RATE_MAX` / `AGENT_SERVER_RATE_WINDOW_MS` | Per-IP rate limit (default 30 requests per 60 000 ms) |

Provider, model, base URL and reasoning level can also be changed at runtime from the UI (see below).

### Server safety

The HTTP server binds to `127.0.0.1` and disables cross-origin requests by default. It also runs in read-only permission mode unless mutations are explicitly enabled (see the table above).

To bind to any other address you must set `AGENT_SERVER_API_KEY`. Clients send it as `Authorization: Bearer <token>` (or `x-api-key`, or `?token=`). The web UI has a **Server token** field under Settings → API connection for this. Put TLS in front of the server and do not expose it directly to the public internet. The server requires a real provider API key; it never falls back to a demo key.

### Sign in with Google (Firebase)

Instead of sharing one token you can gate the server with Google sign-in:

1. In the Firebase console open **Authentication → Get started → Sign-in method** and enable **Google**. Under **Settings → Authorized domains** add the domain you serve the app from.
2. Set `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_APP_ID` and `AGENT_ALLOWED_EMAILS` on the server.
3. Open `/login.html`. After signing in you are sent to the chat; every API call carries your Firebase ID token and the server verifies it (signature, audience, issuer, expiry) before checking your email against the allowlist. Only verified emails on the list get in; everyone else receives 403. The chat page redirects to the login page when you are signed out.

`AGENT_SERVER_API_KEY` keeps working as an admin credential for scripts. The UI's Content-Security-Policy only allows Google/Firebase hosts when Firebase is configured.

### Web UI

The server serves a single-page chat UI at `http://127.0.0.1:3000/` (also `/agent-ui.html`). It has a collapsible sidebar with chat history (kept in the browser's `localStorage`), a dark/light theme, markdown with code blocks and math, file attachments, and live tool activity while a run is in flight.

The agent holds one conversation at a time. When you switch chats, edit a message or regenerate a reply, the UI clears the agent and replays a short transcript (the last 24 messages, up to 12 000 characters) so it keeps the context.

Provider, model, reasoning level, API key and base URL can be changed without restarting — from Settings → **Model** / **API connection**, or the model menu in the header — or directly through the API:

- `GET /api/agent/settings` → `{ model, baseUrl, hasApiKey, provider, thinkingLevel }`
- `PUT /api/agent/settings` → `{ model?, baseUrl?, apiKey?, clearApiKey?, provider?, thinkingLevel? }`

The API key is held in memory for the lifetime of the process and is never written
to disk, logged, or echoed back (only the `hasApiKey` boolean is reported).
Switching provider drops the in-memory key unless the environment already carries
one for the newly selected provider.

The non-secret half of the configuration — provider, model, base URL and reasoning
level — is persisted to `.agent/ui-settings.json` (gitignored) so a restart resumes
the same channel. That file contains no key material; the environment remains the
source of truth for the credential. Changing any setting drops the current agent so
the next request rebuilds it.

`thinkingLevel` is `off | low | medium | high`. Anthropic maps it to an extended-
thinking token budget (1024 / 4096 / 16384) and OpenAI maps it to
`reasoning_effort`; the budget is added on top of `max_tokens` as the Messages API
requires.

### Attachments

`POST /api/agent/run` accepts an optional `attachments` array:

```json
{ "message": "review these", "attachments": [{ "name": "shot.png", "mimeType": "image/png", "data": "<base64>" }] }
```

Up to 8 files, 8 MB each (12 MB request body). Images (`png`, `jpeg`, `gif`, `webp`)
are forwarded to the model as native image blocks; anything else is inlined as UTF-8
text when it decodes cleanly and under 200 KB, otherwise it is summarised by name and
size so the model can fetch it with a file tool.

### Live activity (SSE)

`GET /api/agent/events` is a Server-Sent Events stream that mirrors the agent's own
emitter: `toolStart`, `toolEnd` (with duration, retries, cache hit), `tokenUsage`,
`providerRetry`, `contextCompressed`, `specialtyRouted`, `securityAlert` and
`status`. The UI renders the tool list live while a run is in flight instead of
waiting for the reply. The last 50 events are replayed to a stream that connects
late. Payloads carry no credentials or environment values.

The page loads a few pinned libraries (marked, DOMPurify, highlight.js, KaTeX) from cdnjs, each with a Subresource Integrity hash, and its fonts from Google Fonts. The UI document's Content-Security-Policy allows only those hosts; API responses keep a strict `default-src 'none'` policy. If the CDN is unreachable the page still works: it falls back to a built-in minimal markdown renderer and system fonts, without syntax highlighting or math.

Opening the HTML file straight from disk (`file://`) runs it in mock mode, with no server. If you use a server token, it is stored in this browser's `localStorage`.

### Extensions: skills, MCP servers and plugins

The server can install and run skills, MCP servers and plugins under the workspace's `.agent/` directory. The current web UI has no hub for them yet, so manage them through the endpoints below. `POST /api/agent/extensions/install` takes a GitHub URL, downloads the folder and installs whatever it contains — the kind is sniffed from the payload:

| Payload | Installed as | Where it lands |
| --- | --- | --- |
| `SKILL.md` | skill (instructions the agent reads on demand) | `.agent/skills/<name>/` |
| `plugin.json` | plugin (a module that exports tools) | `.agent/plugins/<name>/` |
| `mcp.json` | one or more MCP servers | merged into `.agent/mcp.json` |

```
GET    /api/agent/extensions                 # skills + MCP servers + plugins + tools
GET    /api/agent/extensions/skills/:name    # raw SKILL.md for the viewer
POST   /api/agent/extensions/install         # { url, kind?, name?, overwrite? }
POST   /api/agent/extensions/mcp             # { name, command, args?, env? } -> connect
POST   /api/agent/extensions/mcp/reload      # { name? } -> reconnect one or all
POST   /api/agent/extensions/plugins/:name/load
DELETE /api/agent/extensions/:kind/:name
```

MCP servers run as local child processes and speak JSON-RPC 2.0 over stdio
(`initialize` → `tools/list` → `tools/call`). Each tool is registered as
`mcp__<server>__<tool>`, so a server can never shadow a built-in tool. A server
that fails to start is reported with its stderr tail and does not stop the
others. Plugins are imported with `await import()` and may export `tools`, a
single `tool`, or a `register(registry)` function; a plugin can never replace an
existing tool name. Installation only writes files — nothing is executed until
you load it.

Downloads go through the GitHub API (no clone, no tarball), skipping binary and
oversized files, with path-traversal checks on every written path. Set
`GITHUB_TOKEN` to raise the anonymous rate limit.

## Development

```bash
npm run dev        # typecheck & build in watch mode
npm test           # run unit tests
npm run typecheck  # tsc --noEmit
npm run server     # HTTP server + web UI
npm start          # run the built server (after npm run build)
```

## Project structure

```
src/
├── agent/          # Agent loop, routing/queue, recovery, prompt builder (prompts/)
├── memory/         # Notes, rules, code vectors, knowledge graph, learning
├── providers/      # Anthropic + OpenAI (native tool calling, streaming)
├── tools/          # File, shell, search, git, quality, build tools + registry
├── security/       # Permission modes, command policy, sandbox, scanners, backups
├── config/         # Config loader (global + project + env)
├── extensions/     # Skills, MCP client/manager, plugin store, GitHub installer
├── types/          # Shared types
├── createAgent.ts  # Wires provider + tools + permissions into an Agent
└── agent-server.ts # HTTP server + API (entry point)
public/
└── agent-ui.html   # the web UI (single file, no build step)
tests/
├── unit/
└── ui/             # jsdom tests for the web UI
```

## License

MIT
