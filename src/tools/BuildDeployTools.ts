import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolContext, ToolResult } from '../types/index.js';
import { runCaptured, truncateOutput } from './ShellTool.js';

/**
 * Build, Deploy & Runtime tools (group 6). Deploys are HIGH risk by default
 * (always human-gated); docker runs inherit the pipeline's container rules.
 */

type Input = Record<string, unknown>;
const str = (input: Input, key: string): string => String(input[key] ?? '');

async function allow(context: ToolContext, description: string, risk: 'low' | 'medium' | 'high'): Promise<ToolResult | null> {
  const permission = await context.permissions.check({ type: 'execute_command', description, risk });
  if (permission.allowed === false) return { success: false, error: `Permission denied: ${permission.reason}` };
  return null;
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

// 41. run_build ----------------------------------------------------------------

/** Extracts the most actionable compiler/bundler errors from build output. */
export function parseBuildErrors(text: string, max = 10): string[] {
  const errors: string[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // TS: "src/foo.ts(12,3): error TS2304: ..."
    let m = line.match(/^([^\s(]+\.[a-z]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.{0,120})/);
    if (m) { errors.push(`${m[1]}:${m[2]}:${m[3]} — ${m[4]} ${m[5]}`); continue; }
    // eslint/webpack style: "ERROR in ./src/foo.ts" or "src/foo.ts:12:3 - error"
    m = line.match(/^(?:ERROR in\s+)?(\S+\.[a-z]+):(\d+):(\d+)\s*-\s*(?:error|Error)\s*(.{0,120})/);
    if (m) { errors.push(`${m[1]}:${m[2]}:${m[3]} — ${m[4]}`); continue; }
    m = line.match(/^ERROR in\s+(\S+)/);
    if (m) { errors.push(`ERROR in ${m[1]}${lines[i + 1] ? ` — ${lines[i + 1].trim().slice(0, 120)}` : ''}`); }
  }
  return [...new Set(errors)].slice(0, max);
}

export class RunBuildTool implements Tool {
  name = 'run_build';
  description = 'Run the project build (npm run build / make / cargo build) and parse errors into file:line locations.';
  inputSchema = { type: 'object', properties: { command: { type: 'string' }, timeout: { type: 'number' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      let command = str(input, 'command');
      if (!command) {
        if (await exists(path.join(ws, 'Makefile'))) command = 'make build';
        else if (await exists(path.join(ws, 'Cargo.toml'))) command = 'cargo build';
        else command = 'npm run build';
      }
      const denied = await allow(context, `Build: ${command}`, 'low');
      if (denied) return denied;
      const r = await runCaptured(command, { cwd: ws, timeout: (Number(input.timeout) || 600) * 1000, signal: context.signal });
      const text = r.stdout + '\n' + r.stderr;
      const errors = parseBuildErrors(text);
      return { success: true, output: r.ok
        ? `Build succeeded ✓ (${command})`
        : `Build FAILED (${command}) — ${errors.length} error(s):\n${errors.join('\n') || truncateOutput(text, 40)}`,
        metadata: { exitCode: r.exitCode, errors: errors.length, parsed: errors } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 42. run_dev_server -----------------------------------------------------------

export class RunDevServerTool implements Tool {
  name = 'run_dev_server';
  description = 'Start a dev server, watch its output for a bounded time (ready/errors/URL), then leave it running or stop it — never blocks the agent loop.';
  inputSchema = { type: 'object', properties: { command: { type: 'string', description: 'default: npm run dev' }, seconds: { type: 'number', description: 'observe for N seconds, default 8, max 30' }, stop: { type: 'boolean', description: 'stop a previously started server instead' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      if (input.stop === true) {
        const killed = await runCaptured('kill $(cat .agent/dev-server.pid) 2>/dev/null; rm -f .agent/dev-server.pid', { cwd: ws, timeout: 10000 });
        return { success: true, output: killed.ok ? 'Dev server stopped ✓' : 'No running dev server found' };
      }
      const command = str(input, 'command') || 'npm run dev';
      const denied = await allow(context, `Start dev server: ${command}`, 'medium');
      if (denied) return denied;
      const seconds = Math.min(Math.max(Number(input.seconds) || 8, 2), 30);
      const { spawn } = await import('child_process');
      await fs.mkdir(path.join(ws, '.agent'), { recursive: true });
      const out = await fs.open(path.join(ws, '.agent', 'dev-server.log'), 'a');
      const child = spawn(command.split(' ')[0], command.split(' ').slice(1), { cwd: ws, stdio: ['ignore', out.fd, out.fd], detached: true });
      const pid = String(child.pid ?? 0);
      await fs.writeFile(path.join(ws, '.agent', 'dev-server.pid'), pid, 'utf-8');
      child.unref();
      // Observe the log for the ready line / errors.
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      let log = '';
      try { log = await fs.readFile(path.join(ws, '.agent', 'dev-server.log'), 'utf-8'); } catch { /* fresh log */ }
      const tail = log.slice(-3000);
      const url = tail.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+[^\s"']*/)?.[0];
      const crashed = /EADDRINUSE|EACCES|Error:|Cannot find module/.test(tail) && !url;
      return { success: !crashed, output:
        `Dev server started (pid ${pid}) — observed ${seconds}s\n` +
        (url ? `URL: ${url}\n` : '') +
        (crashed ? `⚠ Possible startup failure:\n${truncateOutput(tail, 20)}` : `Log tail:\n${truncateOutput(tail, 20)}`) +
        `\n(stop with run_dev_server stop=true; log: .agent/dev-server.log)`,
        metadata: { pid, url, crashed } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 43. check_env_vars -----------------------------------------------------------

export class CheckEnvVarsTool implements Tool {
  name = 'check_env_vars';
  description = 'Compare .env(.local) against .env.example (or code references): report missing, unused, and empty variables WITHOUT printing values.';
  inputSchema = { type: 'object', properties: {}, required: [] };

  async execute(_input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const readKeys = async (file: string): Promise<Map<string, string> | null> => {
        try {
          const content = await fs.readFile(path.join(ws, file), 'utf-8');
          const map = new Map<string, string>();
          for (const line of content.split('\n')) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (m) map.set(m[1], m[2].trim());
          }
          return map;
        } catch { return null; }
      };
      const example = await readKeys('.env.example');
      const local = (await readKeys('.env')) ?? (await readKeys('.env.local'));
      if (!example && !local) return { success: true, output: 'No .env/.env.example files found — nothing to check' };
      const exampleKeys = [...(example?.keys() ?? [])];
      const localKeys = [...(local?.keys() ?? [])];
      const missing = exampleKeys.filter(k => !localKeys.includes(k));
      const empty = localKeys.filter(k => !(local?.get(k) ?? '').length);
      const extra = localKeys.filter(k => exampleKeys.length && !exampleKeys.includes(k));
      // Names only — never values.
      return { success: missing.length === 0, output:
        `Env check (names only, values never printed):\n` +
        `  declared in .env.example: ${exampleKeys.length || '(no example file)'}\n` +
        `  present in .env: ${localKeys.length}\n` +
        (missing.length ? `\nMISSING (in example, not set): ${missing.join(', ')}` : '\nNo missing variables ✓') +
        (empty.length ? `\nEMPTY (set but blank): ${empty.join(', ')}` : '') +
        (extra.length ? `\nEXTRA (not in example): ${extra.join(', ')}` : ''),
        metadata: { missing: missing.length, empty: empty.length, extra: extra.length } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 44+45. docker_build / docker_run ---------------------------------------------

export class DockerBuildTool implements Tool {
  name = 'docker_build';
  description = 'Build a container image from a Dockerfile (docker build).';
  inputSchema = { type: 'object', properties: { tag: { type: 'string' }, dockerfile: { type: 'string', description: 'default Dockerfile' }, timeout: { type: 'number' } }, required: ['tag'] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const tag = str(input, 'tag');
      if (!/^[A-Za-z0-9._/: -]+$/.test(tag)) return { success: false, error: 'Invalid image tag' };
      const dockerfile = str(input, 'dockerfile') || 'Dockerfile';
      if (!(await exists(path.join(ws, dockerfile)))) return { success: false, error: `Dockerfile not found: ${dockerfile}` };
      const denied = await allow(context, `docker build -t ${tag}`, 'medium');
      if (denied) return denied;
      const r = await runCaptured(`docker build -f ${JSON.stringify(dockerfile)} -t ${JSON.stringify(tag)} .`, { cwd: ws, timeout: (Number(input.timeout) || 600) * 1000, signal: context.signal });
      const text = r.stdout + '\n' + r.stderr;
      return { success: r.ok, output: r.ok ? `Image built: ${tag} ✓` : truncateOutput(text, 40), metadata: { exitCode: r.exitCode } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

export class DockerRunTool implements Tool {
  name = 'docker_run';
  description = 'Run a container image (docker run) with safe defaults: no network unless allowNetwork=true, auto-remove, bounded by timeout.';
  inputSchema = { type: 'object', properties: { image: { type: 'string' }, command: { type: 'string', description: 'command inside the container' }, allowNetwork: { type: 'boolean' }, env: { type: 'array', items: { type: 'string' }, description: 'env vars as KEY=VALUE (values never logged)' }, timeout: { type: 'number' } }, required: ['image'] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const image = str(input, 'image');
      if (!/^[A-Za-z0-9._/: -]+$/.test(image)) return { success: false, error: 'Invalid image name' };
      const denied = await allow(context, `docker run ${image}`, 'high');
      if (denied) return denied;
      const parts = ['docker run --rm --memory 512m --cpus 1 --pids-limit 128 --security-opt no-new-privileges'];
      if (input.allowNetwork !== true) parts.push('--network none');
      for (const env of (Array.isArray(input.env) ? input.env : []) as string[]) {
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(env)) parts.push(`-e ${JSON.stringify(env)}`);
      }
      const inner = str(input, 'command');
      parts.push(image);
      if (inner) parts.push(inner);
      const r = await runCaptured(parts.join(' '), { cwd: ws, timeout: (Number(input.timeout) || 120) * 1000, signal: context.signal });
      return { success: r.ok, output: r.ok ? truncateOutput(r.stdout, 40) || '(no output)' : `Container failed (exit ${r.exitCode}):\n${truncateOutput(r.stderr, 30)}`, metadata: { exitCode: r.exitCode, network: input.allowNetwork === true } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 46. deploy_preview -----------------------------------------------------------

export class DeployPreviewTool implements Tool {
  name = 'deploy_preview';
  description = 'Deploy a preview/staging build. Executes the configured deploy command; ALWAYS human-gated (high risk).';
  inputSchema = { type: 'object', properties: { command: { type: 'string', description: 'deploy command, e.g. "vercel --prebuilt"' }, timeout: { type: 'number' } }, required: ['command'] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const command = str(input, 'command');
      if (!command) return { success: false, error: 'command is required (never hardcoded defaults for deploys)' };
      const denied = await allow(context, `Deploy preview: ${command}`, 'high');
      if (denied) return denied;
      const r = await runCaptured(command, { cwd: ws, timeout: (Number(input.timeout) || 600) * 1000, signal: context.signal });
      const url = (r.stdout + r.stderr).match(/https:\/\/[^\s"']+/)?.[0];
      return { success: r.ok, output: (r.ok ? 'Deploy succeeded ✓' : 'Deploy FAILED') + (url ? `\nURL: ${url}` : '') + `\n${truncateOutput((r.stdout + r.stderr).trim(), 30)}`, metadata: { exitCode: r.exitCode, url } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

// 47. rollback_deploy ----------------------------------------------------------

export class RollbackDeployTool implements Tool {
  name = 'rollback_deploy';
  description = 'Roll back a deployment. Supports Vercel (`vercel rollback`), a custom command, or docker tag re-point. Always human-gated.';
  inputSchema = { type: 'object', properties: { command: { type: 'string', description: 'platform-specific rollback command' }, dryRun: { type: 'boolean' } }, required: [] };

  async execute(input: Input, context: ToolContext): Promise<ToolResult> {
    try {
      const ws = context.workspaceRoot;
      const command = str(input, 'command');
      if (!command) return { success: false, error: 'rollback command is required — rollback is platform-specific and never guessed' };
      if (input.dryRun === true) return { success: true, output: `DRY RUN — would execute: ${command}`, metadata: { dryRun: true } };
      const denied = await allow(context, `Rollback deploy: ${command}`, 'high');
      if (denied) return denied;
      const r = await runCaptured(command, { cwd: ws, timeout: 300000 });
      return { success: r.ok, output: (r.ok ? 'Rollback succeeded ✓' : 'Rollback FAILED') + `\n${truncateOutput((r.stdout + r.stderr).trim(), 30)}`, metadata: { exitCode: r.exitCode } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  }
}

export const BUILD_DEPLOY_TOOLS: Tool[] = [
  new RunBuildTool(), new RunDevServerTool(), new CheckEnvVarsTool(),
  new DockerBuildTool(), new DockerRunTool(), new DeployPreviewTool(), new RollbackDeployTool(),
];
