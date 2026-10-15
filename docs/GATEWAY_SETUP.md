# Gateway setup (v2)

Status: code is merged and tested with fakes. **Nothing here has been run against real E2B or a real model yet.**

## 1. Chat only (simplest)
Set on Render:
- `GATEWAY_V2=1`
- `GATEWAY_LLM_BASE_URL` (OpenAI-compatible, e.g. `https://.../v1`)
- `GATEWAY_LLM_MODEL`
- `GATEWAY_LLM_API_KEY` (if the provider needs one)

## 2. Code / Work / Agent (sandbox modes)
Also set:
- `E2B_API_KEY`
- `GATEWAY_PUBLIC_URL` (https URL of this server; sandboxes call its LLM proxy)
- `GATEWAY_TEMPLATE_CODE`, `GATEWAY_TEMPLATE_WORK`, `GATEWAY_TEMPLATE_AGENT` (E2B template ids; a mode without one reports "not enabled")

Build templates (needs the e2b CLI and your E2B account):
```
cd deploy/e2b/code  && e2b template build -n agent-code      # OpenCode
cd deploy/e2b/work  && e2b template build -n agent-work      # OpenClaw
cd deploy/e2b/agent && e2b template build -n agent-hermes --build-arg HERMES_REPO=<git url>  # Hermes
```
(Flags may differ by CLI version; check `e2b template build --help`.)

## 3. Optional
`GATEWAY_LLM_EXTRA_MODELS`, `GATEWAY_LLM_MAX_OUTPUT_TOKENS` (8192), `GATEWAY_SANDBOX_EGRESS=proxy-only`, `GATEWAY_DAILY_TOKENS` (200000), `GATEWAY_DAILY_COST_MICRO_USD`, `GATEWAY_PRICE_IN_MICRO_PER_MTOK`, `GATEWAY_PRICE_OUT_MICRO_PER_MTOK`, `GATEWAY_MAX_SANDBOXES` (3), `GATEWAY_RATE_PER_MINUTE` (120), `AGENT_SANDBOX_IDLE_MINUTES` (30).

## 4. Smoke test
```
GATEWAY_URL=https://your-app.onrender.com SMOKE_AUTH="Bearer <user token>" node scripts/gateway-smoke.mjs chat
node scripts/gateway-smoke.mjs chat code work agent   # same env vars
```
Each mode prints PASS/FAIL. Do chat first, then one sandbox mode at a time.

## Known unknowns
- OpenClaw: stop/abort, config keys, event payload shapes were guessed; first real run may need fixes.
- Hermes: startup GitHub update check has no off switch.
- Templates are unbuilt; Dockerfiles are unverified.
- Sandbox egress allow-list never run. State is in memory (lost on restart). Needs Node 22+.
