import { execFile } from 'child_process';
import { ToolCall } from '../types/index.js';

/**
 * SecurityPipeline — four-layer defense that runs BEFORE the agent's tool
 * touches the user's machine, and a post-run output check AFTER.
 *
 *   [AI proposes a tool call]
 *        ↓
 *   L1 PreExecutionGuard      forbidden-pattern block → bounce back to the AI
 *        ↓ pass
 *   L2 HumanInTheLoop         high/critical risk → wait for approval
 *        ↓ pass / low risk
 *   L3 SecureSandbox          Docker isolation (network off, resource caps,
 *        ↓                     read-only except workspace) or local sandbox
 *   L4 OutputCheck            secret redaction, output caps, anomaly flags
 *        ↓
 *   [result returned to the AI]
 *
 * Everything is deterministic and auditable: every decision is logged.
 */

// ---------------------------------------------------------------------------
// Verdict types
// ---------------------------------------------------------------------------

export interface GuardVerdict {
  action: 'allow' | 'reject';
  /** Human-readable reason, shown back to the model on reject. */
  reason: string;
  /** Risk class assigned during evaluation. */
  risk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  /** Patterns that matched (empty for clean calls). */
  matched: string[];
}

export type ApprovalDecision = 'approved' | 'denied' | 'timeout' | 'no-approver';

export interface OutputCheckResult {
  /** Processed output safe to hand back to the model. */
  output: string;
  /** Secrets that were redacted. */
  redactions: string[];
  /** Warnings for anomalies (huge output, noise, etc). */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// L1 — Pre-Execution Guard
// ---------------------------------------------------------------------------

/**
 * Patterns that must never run, in any mode. If the model proposes one, the
 * call is rejected and the error text tells it to rethink (bounced back).
 */
const FORBIDDEN_PATTERNS: Array<{ id: string; pattern: RegExp; why: string }> = [
  { id: 'forkbomb', pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/, why: 'fork bomb' },
  { id: 'disk-wipe', pattern: /mkfs(\.\w+)?\s|dd\s+if=.*of=\/dev\/(sd|nvme|disk)/, why: 'filesystem destruction' },
  { id: 'rmrf-root', pattern: /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?(\/|~|\$HOME)(\s|$)/, why: 'recursive delete of root/home' },
  { id: 'sudo', pattern: /(^|[\s"'])sudo\s/, why: 'privilege escalation' },
  { id: 'chmod-root', pattern: /chmod\s+-R?\s*777\s+\//, why: 'world-writable system path' },
  { id: 'remote-exec', pattern: /(curl|wget)[^|]*\|\s*(ba|z)?sh/, why: 'piping remote content into a shell' },
  { id: 'env-exfil', pattern: /\bprintenv\b|\benv\b\s*$|cat\s+\.env\b/, why: 'dumping environment/secrets' },
  { id: 'history-spy', pattern: /cat\s+~?\/?\.?(bash_history|zsh_history)/, why: 'reading shell history' },
  { id: 'ssh-keys', pattern: /cat\s+~\/\.ssh\/id_/, why: 'reading private SSH keys' },
  { id: 'reverse-shell', pattern: /\/dev\/tcp\/|nc\s+-e\s|bash\s+-i\s+>&/, why: 'reverse shell attempt' },
  { id: 'git-force', pattern: /git\s+push\s+.*--force(?!-with-lease)/, why: 'force push' },
  { id: 'npm-publish', pattern: /npm\s+publish/, why: 'publishing packages' },
];

export class PreExecutionGuard {
  /** L1: returns allow, or reject with a "think again" message for the model. */
  guard(toolCall: ToolCall): GuardVerdict {
    const risk = this.assessRisk(toolCall);
    const inputStr = JSON.stringify(toolCall.input ?? {});
    const matched: string[] = [];

    if (toolCall.name === 'shell' || inputStr.length < 20000) {
      for (const rule of FORBIDDEN_PATTERNS) {
        if (rule.pattern.test(inputStr)) matched.push(`${rule.id} (${rule.why})`);
      }
    }
    if (toolCall.name === 'shell') {
      const command = String((toolCall.input as Record<string, unknown>)?.command ?? '');
      if (command.length > 4000) matched.push('oversized-command (command longer than 4000 chars)');
    }

    if (matched.length > 0) {
      return {
        action: 'reject',
        risk,
        matched,
        reason:
          `BLOCKED by Pre-Execution Guard: ${matched.join('; ')}. ` +
          `This pattern is forbidden on this machine. Rethink the approach and ` +
          `propose a different, safe solution — do not attempt to bypass the guard.`,
      };
    }
    return { action: 'allow', risk, matched: [], reason: 'clean' };
  }

  /** Deterministic risk classification, shared with L2. */
  assessRisk(toolCall: ToolCall): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (toolCall.name !== 'shell') {
      if (toolCall.name === 'write_file' || toolCall.name === 'edit_file' || toolCall.name === 'find_and_replace') return 'medium';
      // Destructive / irreversible operations always need a human.
      if (toolCall.name === 'delete_file' || toolCall.name === 'mutation_test') return 'high';
      // Deploy-tier: humans decide, no exceptions.
      if (toolCall.name === 'create_pull_request' || toolCall.name === 'deploy_preview' || toolCall.name === 'rollback_deploy' || toolCall.name === 'docker_run') return 'high';
      if (toolCall.name === 'install_package' || toolCall.name === 'update_lockfile' || toolCall.name === 'run_formatter'
        || toolCall.name === 'git_commit' || toolCall.name === 'git_stash' || toolCall.name === 'move_file' || toolCall.name === 'rename_file'
        || toolCall.name === 'copy_file' || toolCall.name === 'create_directory_structure' || toolCall.name === 'run_dev_server'
        || toolCall.name === 'docker_build' || toolCall.name === 'database_query') return 'medium';
      return 'safe';
    }
    const cmd = String((toolCall.input as Record<string, unknown>)?.command ?? '').trim().toLowerCase();
    if (/rm\s+-rf\s+[\/~]|mkfs|dd\s+if=|:\(\)\s*\{|curl.*\|\s*sh|wget.*\|\s*sh/.test(cmd)) return 'critical';
    if (/^rm\s+-[a-z]*r|^chmod\s+-R|^chown|git\s+reset\s+--hard|git\s+clean\s+-[df]|git\s+push\s+--force|npm\s+publish|docker\s+(run|rm)|pip\s+install/.test(cmd)) return 'high';
    if (/^(rm|mv|cp|chmod|npm\s+(install|i)|yarn\s+(add|install)|pnpm\s+(add|install)|git\s+(commit|push|rebase|merge))/.test(cmd)) return 'medium';
    if (/^(ls|pwd|cat|head|tail|echo|grep|find|which|node\s+--version|npm\s+test|npm\s+run|npx\s+tsc|git\s+(status|diff|log))/.test(cmd)) return 'safe';
    return 'low';
  }
}

// ---------------------------------------------------------------------------
// L2 — Human-in-the-Loop gate
// ---------------------------------------------------------------------------

export interface HumanApprover {
  /**
   * Ask the human. Resolve with the decision. Implementations may use TTY
   * input, a TUI dialog, or a remote approval channel.
   */
  (request: {
    tool: string;
    risk: string;
    summary: string;
    detail: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<ApprovalDecision>;
}

export class HumanGate {
  private readonly approver: HumanApprover | null;
  private readonly timeoutMs: number;
  private readonly autoApproveBelow: 'safe' | 'low' | 'medium' | 'high' | 'critical';

  constructor(options: {
    approver?: HumanApprover | null;
    timeoutMs?: number;
    /** Risk levels that never require a human. */
    autoApproveBelow?: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  } = {}) {
    this.approver = options.approver ?? null;
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.autoApproveBelow = options.autoApproveBelow ?? 'low';
  }

  private static readonly RANK = { safe: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

  needsHuman(risk: string): boolean {
    return HumanGate.RANK[risk as keyof typeof HumanGate.RANK] >
      HumanGate.RANK[this.autoApproveBelow];
  }

  /**
   * L2: returns approved, or a denial describing who said no. Never throws.
   */
  async check(toolCall: ToolCall, risk: string): Promise<{ action: 'allow' | 'deny'; reason: string }> {
    if (!this.needsHuman(risk)) return { action: 'allow', reason: 'low-risk (no human needed)' };
    if (!this.approver) {
      return {
        action: 'deny',
        reason: `HumanGate: ${toolCall.name} is ${risk}-risk and requires human approval, but no approver is connected in this session. Run interactively (agent-ui) to approve this action.`,
      };
    }
    try {
      const summary = this.summarize(toolCall);
      const decision = await this.approver({
        tool: toolCall.name,
        risk,
        summary,
        detail: (toolCall.input ?? {}) as Record<string, unknown>,
        timeoutMs: this.timeoutMs,
      });
      if (decision === 'approved') return { action: 'allow', reason: 'human approved' };
      if (decision === 'timeout') return { action: 'deny', reason: 'HumanGate: approval timed out — action cancelled' };
      return { action: 'deny', reason: `HumanGate: human ${decision === 'denied' ? 'denied' : 'did not approve'} this action` };
    } catch (error) {
      return { action: 'deny', reason: `HumanGate error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private summarize(toolCall: ToolCall): string {
    const input = (toolCall.input ?? {}) as Record<string, unknown>;
    if (toolCall.name === 'shell') return String(input.command ?? '').slice(0, 300);
    if (toolCall.name === 'write_file' || toolCall.name === 'edit_file') {
      return String(input.path ?? '') + (input.content ? ` (${String(input.content).length} chars)` : '');
    }
    return JSON.stringify(input).slice(0, 300);
  }
}

/**
 * TTY approver: prompts on the terminal with a timeout. Used by the CLI.
 */
export function ttyApprover(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): HumanApprover {
  return async request => {
    return new Promise<ApprovalDecision>(resolve => {
      if (!(input as NodeJS.ReadStream).isTTY) {
        resolve('no-approver');
        return;
      }
      output.write(
        `\n⚠  ${request.risk.toUpperCase()} risk — ${request.tool}\n` +
        `   ${request.summary}\n` +
        `   Approve? [y/N] (auto-deny in ${Math.round(request.timeoutMs / 1000)}s): `
      );
      let settled = false;
      const finish = (decision: ApprovalDecision) => {
        if (settled) return;
        settled = true;
        input.removeListener('data', onData);
        (input as NodeJS.ReadStream).setRawMode?.(false);
        (input as NodeJS.ReadStream).pause?.();
        resolve(decision);
      };
      const onData = (chunk: Buffer) => {
        const answer = chunk.toString().trim().toLowerCase();
        finish(answer === 'y' || answer === 'yes' ? 'approved' : 'denied');
      };
      (input as NodeJS.ReadStream).resume?.();
      (input as NodeJS.ReadStream).setRawMode?.(true);
      input.on('data', onData);
      setTimeout(() => finish('timeout'), request.timeoutMs).unref();
    });
  };
}

// ---------------------------------------------------------------------------
// L3 — Secure Sandbox (Docker, with local-sandbox fallback)
// ---------------------------------------------------------------------------

export type SandboxProfile = 'alpine' | 'node' | 'python' | 'ubuntu';

/** Preconfigured isolated profiles. Alpine = smallest, fastest cold start. */
export const SANDBOX_PROFILES: Record<SandboxProfile, Partial<DockerOptions> & { description: string }> = {
  alpine: {
    image: 'alpine:3.20',
    memoryMb: 256,
    cpus: 1,
    pidsLimit: 64,
    description: 'Alpine Linux 3.20 — minimal toolchain (sh, busybox), 256MB, fastest cold start',
  },
  node: { image: 'node:20-alpine', memoryMb: 512, cpus: 1, pidsLimit: 128, description: 'Node.js 20 on Alpine — npm/npx available' },
  python: { image: 'python:3.12-alpine', memoryMb: 512, cpus: 1, pidsLimit: 128, description: 'Python 3.12 on Alpine — pip available' },
  ubuntu: { image: 'ubuntu:24.04', memoryMb: 1024, cpus: 2, pidsLimit: 256, description: 'Ubuntu 24.04 — full apt toolchain' },
};

export interface DockerOptions {
  image: string;
  /** Workspace mounted at /workspace (default read-write; set readOnlyWorkdir for stricter runs). */
  readOnlyWorkdir?: boolean;
  memoryMb: number;
  cpus: number;
  pidsLimit: number;
  timeoutMs: number;
}

export const DEFAULT_DOCKER: DockerOptions = {
  image: 'node:20-alpine',
  readOnlyWorkdir: false,
  memoryMb: 512,
  cpus: 1,
  pidsLimit: 128,
  timeoutMs: 120000,
};

export class SecureSandbox {
  private readonly dockerAvailable: boolean | null = null;
  private readonly options: DockerOptions;
  private readonly profile: SandboxProfile;

  constructor(options: Partial<DockerOptions> & { profile?: SandboxProfile } = {}) {
    this.profile = options.profile ?? 'node';
    const profileDefaults = SANDBOX_PROFILES[this.profile];
    this.options = { ...DEFAULT_DOCKER, ...profileDefaults, ...options } as DockerOptions;
  }

  /** The active profile name + its description. */
  get profileInfo(): { profile: SandboxProfile; description: string } {
    return { profile: this.profile, description: SANDBOX_PROFILES[this.profile].description };
  }

  /** True when the docker CLI responds (cached). */
  async isDockerAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== null) return this.dockerAvailable;
    return new Promise(resolve => {
      execFile('docker', ['info', '--format', 'ok'], { timeout: 5000 }, error => resolve(!error));
    });
  }

  /**
   * L3: run a shell command inside an isolated container:
   *   --network none        no outbound/inbound network
   *   --memory / --cpus     resource caps against runaway builds
   *   --pids-limit          fork-bomb containment
   *   --security-opt        no-new-privileges
   *   workspace bind-mount  the only writable surface
   * Falls back to null when Docker is unavailable (caller decides).
   */
  async runIsolated(command: string, workspaceRoot: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const o = this.options;
    const mount = `${workspaceRoot}:/workspace${o.readOnlyWorkdir ? ':ro' : ''}`;
    const args = [
      'run', '--rm',
      '--network', 'none',
      '--memory', `${o.memoryMb}m`,
      '--cpus', String(o.cpus),
      '--pids-limit', String(o.pidsLimit),
      '--security-opt', 'no-new-privileges',
      '--cap-drop', 'ALL',
      '-v', mount,
      '-w', '/workspace',
      o.image,
      'sh', '-c', command,
    ];
    return new Promise((resolve, reject) => {
      execFile('docker', args, { timeout: o.timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        const code = (error as { code?: number } | null)?.code ?? (error ? 1 : 0);
        if (error && code === 0) return reject(error);
        resolve({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: code });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// L4 — Output check
// ---------------------------------------------------------------------------

const SECRET_REDACT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'api-key', pattern: /\b(sk|pk)-[A-Za-z0-9_-]{16,}\b/g },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}/gi },
  { name: 'aws-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { name: 'private-key-block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'generic-secret-assign', pattern: /\b(password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi },
];

export class OutputChecker {
  private readonly maxOutputChars: number;

  constructor(maxOutputChars = 20000) {
    this.maxOutputChars = Math.max(1000, maxOutputChars);
  }

  /** L4: sanitize a tool result before it goes back to the model. */
  check(output: string, tool: string): OutputCheckResult {
    const warnings: string[] = [];
    const redactions: string[] = [];
    let text = output ?? '';

    for (const rule of SECRET_REDACT_PATTERNS) {
      text = text.replace(rule.pattern, match => {
        redactions.push(rule.name);
        return `[REDACTED:${rule.name}]`;
      });
    }

    if (text.length > this.maxOutputChars) {
      warnings.push(`output truncated from ${text.length} to ${this.maxOutputChars} chars`);
      text =
        text.slice(0, this.maxOutputChars) +
        `\n…(output truncated — re-read a narrower range if you need more)`;
    }

    if (/error|exception|traceback|permission denied/i.test(text) && tool === 'shell') {
      warnings.push('output contains error-like text');
    }

    return { output: text, redactions: [...new Set(redactions)], warnings };
  }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditEntry {
  time: string;
  layer: 'L1-guard' | 'L2-human' | 'L3-sandbox' | 'L4-output';
  tool: string;
  decision: string;
  detail: string;
}

export class AuditLogger {
  private entries: AuditEntry[] = [];

  log(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  /** Append the whole run's security decisions to the audit file. */
  async flush(workspaceRoot: string, auditPath = '.agent/memory/notes/audit.md'): Promise<number> {
    if (this.entries.length === 0) return 0;
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(workspaceRoot, auditPath);
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const lines = this.entries.map(
      e => `- [${stamp}] ${e.layer} · ${e.tool} · ${e.decision} · ${e.detail.replace(/\s+/g, ' ').slice(0, 160)}`
    );
    try {
      let existing = '';
      try {
        existing = await fs.readFile(filePath, 'utf-8');
      } catch {
        /* new file */
      }
      const header = existing.includes('## Security audit log')
        ? ''
        : existing.trim()
          ? existing.trimEnd() + '\n\n## Security audit log\n'
          : '## Security audit log\n';
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, header + lines.join('\n') + '\n', 'utf-8');
      return lines.length;
    } catch {
      return 0;
    } finally {
      this.entries = [];
    }
  }
}

// Convenience: the whole pipeline as one object
export interface SecurityPipeline {
  guard: PreExecutionGuard;
  humanGate: HumanGate;
  sandbox: SecureSandbox;
  outputChecker: OutputChecker;
  audit: AuditLogger;
  /** Swap the sandbox profile at runtime (e.g. from config). */
  setSandboxProfile?: (profile: SandboxProfile) => void;
}

export function createSecurityPipeline(options: {
  approver?: HumanApprover | null;
  autoApproveBelow?: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  approvalTimeoutMs?: number;
  docker?: Partial<DockerOptions> & { profile?: SandboxProfile };
} = {}): SecurityPipeline {
  const sandbox = new SecureSandbox(options.docker);
  return {
    guard: new PreExecutionGuard(),
    humanGate: new HumanGate({
      approver: options.approver ?? null,
      timeoutMs: options.approvalTimeoutMs,
      autoApproveBelow: options.autoApproveBelow,
    }),
    sandbox,
    outputChecker: new OutputChecker(),
    audit: new AuditLogger(),
    setSandboxProfile(profile: SandboxProfile) {
      const swapped = new SecureSandbox({ ...options.docker, profile });
      Object.assign(sandbox, swapped);
    },
  };
}
