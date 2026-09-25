/**
 * CommandPolicy — deterministic shell-command policy for the L1 guard.
 *
 * The pre-existing `PreExecutionGuard` blocks a small blacklist of
 * catastrophic patterns. A blacklist alone is the wrong default for an
 * autonomous agent, so this module adds the missing half:
 *
 *   1. an allowlist of programs the agent may invoke at all,
 *   2. shell-metacharacter detection (the guard runs before any shell exists,
 *      so a metacharacter is a signal of intent, not a syntax error),
 *   3. network-exfiltration detection for commands that move data outward,
 *   4. ownership/permission mutation detection (chmod/chown),
 *   5. structured reasons the model can act on.
 *
 * The policy is pure and synchronous: same input, same verdict. It never
 * executes anything and never touches the filesystem.
 */

export type CommandRisk = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface CommandVerdict {
  /** True when the command may proceed to the next pipeline layer. */
  allowed: boolean;
  /** Deterministic risk class for the L2 human gate. */
  risk: CommandRisk;
  /** Machine-readable rule ids that fired (empty when clean). */
  violations: string[];
  /** Human/model-readable explanation, safe to return to the model. */
  reason: string;
  /** The program that would be spawned (first token). */
  program: string;
}

export interface CommandPolicyOptions {
  /**
   * Allowlist of executable names. When provided, any command whose program
   * is not listed is rejected. `*` entries act as suffixes (e.g. `npm-*`),
   * and `*` alone allows everything.
   */
  allowedPrograms?: readonly string[];
  /** Reject commands containing shell metacharacters (default true). */
  blockMetacharacters?: boolean;
  /** Reject commands that appear to move data off the machine (default true). */
  blockNetworkExfil?: boolean;
  /** Reject chmod/chown/ownership mutation (default true). */
  blockPermissionMutation?: boolean;
  /** Maximum accepted command length in characters (default 4000). */
  maxCommandLength?: number;
}

/**
 * Default allowlist: the toolchain a coding agent legitimately needs.
 * Anything outside this list is rejected and bounced back to the model.
 */
export const DEFAULT_ALLOWED_PROGRAMS: readonly string[] = [
  // inspection
  'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'file', 'stat', 'tree', 'find', 'grep', 'rg',
  'sed', 'awk', 'sort', 'uniq', 'cut', 'tr', 'diff', 'which', 'env', 'printenv',
  // node / js toolchain
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'tsc', 'tsx', 'jest', 'vitest', 'eslint', 'prettier',
  // other language toolchains
  'python', 'python3', 'pip', 'pip3', 'pytest', 'ruff', 'mypy', 'black',
  'go', 'gofmt', 'cargo', 'rustc', 'java', 'javac', 'mvn', 'gradle',
  // version control
  'git', 'gh',
  // containers / build
  'docker', 'docker-compose', 'make', 'cmake', 'zip', 'unzip', 'tar', 'gzip',
  // io helpers
  'echo', 'printf', 'date', 'sleep', 'true', 'false', 'test', 'mkdir', 'touch',
  'cp', 'mv', 'rm', 'rmdir', 'ln', 'readlink', 'realpath', 'basename', 'dirname',
];

/** Shell metacharacters. Presence means the model is asking for a pipeline,
 *  substitution, redirection, or sequencing — none of which the executor
 *  supports (`spawn` runs with `shell: false`), so they are rejected rather
 *  than silently mangled. */
const METACHARACTER_RULES: Array<{ id: string; pattern: RegExp; why: string }> = [
  { id: 'cmd-seq-semicolon', pattern: /;/, why: 'command sequencing (;)' },
  { id: 'cmd-pipe', pattern: /\|/, why: 'pipe or logical or (|, ||)' },
  { id: 'cmd-and', pattern: /&&/, why: 'command chaining (&&)' },
  { id: 'cmd-subshell', pattern: /[`]|\$\(/, why: 'command substitution (backtick, $())' },
  { id: 'cmd-redirect', pattern: /(^|[^0-9])[<>]/, why: 'redirection (<, >)' },
  { id: 'cmd-background', pattern: /(^|\s)&\s*$/, why: 'backgrounding (&)' },
  { id: 'cmd-variable-expansion', pattern: /\$\{?[A-Za-z_]/, why: 'variable expansion ($VAR)' },
];

/** Commands whose primary purpose is moving bytes off the machine. */
const EXFIL_RULES: Array<{ id: string; pattern: RegExp; why: string }> = [
  { id: 'net-curl-upload', pattern: /\bcurl\b[^|;]*(\s-T\s|\s--upload-file\b|\s-d\s|\s--data\b|\s-F\s|\s--form\b)/, why: 'curl upload of local data' },
  { id: 'net-wget-post', pattern: /\bwget\b[^|;]*--post-(data|file)\b/, why: 'wget POST of local data' },
  { id: 'net-nc', pattern: /(^|[\s;|])n[c]?\s/, why: 'netcat use' },
  { id: 'net-scp-rsync', pattern: /(^|[\s;|])(scp|rsync)\s/, why: 'remote copy' },
  { id: 'net-ssh', pattern: /(^|[\s;|])ssh\s/, why: 'outbound ssh' },
  { id: 'net-telnet', pattern: /(^|[\s;|])telnet\s/, why: 'telnet' },
  { id: 'net-dig', pattern: /(^|[\s;|])(dig|nslookup|host)\s/, why: 'DNS lookup (tunnelling vector)' },
  { id: 'net-webhook', pattern: /\b(webhook|hooks\.slack|discord\.com\/api\/webhooks|api\.telegram\.org)\b/i, why: 'webhook endpoint' },
];

/** Ownership / permission mutation. */
const PERMISSION_RULES: Array<{ id: string; pattern: RegExp; why: string }> = [
  { id: 'perm-chmod-777', pattern: /\bchmod\b[^|;]*\b777\b/, why: 'world-writable permission' },
  { id: 'perm-chmod-recursive', pattern: /\bchmod\b[^|;]*(-R|--recursive)\b/, why: 'recursive permission change' },
  { id: 'perm-chown', pattern: /\bchown\b/, why: 'ownership change' },
  { id: 'perm-chgrp', pattern: /\bchgrp\b/, why: 'group ownership change' },
  { id: 'perm-setuid', pattern: /\bchmod\b[^|;]*\b[ug]?\+s\b/, why: 'setuid/setgid bit' },
];

/**
 * Parse a command string into program + args using the same quote-aware,
 * shell-free rules as the executor, so policy and execution agree.
 */
export function parseCommandLine(command: string): { program: string; args: string[] } {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const char of command.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else current += char;
  }
  if (current) tokens.push(current);
  return { program: tokens[0] ?? '', args: tokens.slice(1) };
}

/** Does `program` match an allowlist entry (`*` wildcard at the end)? */
function matchesAllowlist(program: string, allowed: readonly string[]): boolean {
  if (allowed.includes('*')) return true;
  return allowed.some(entry => {
    if (entry === program) return true;
    if (entry.endsWith('*')) return program.startsWith(entry.slice(0, -1));
    return false;
  });
}

export class CommandPolicy {
  private readonly allowedPrograms: readonly string[];
  private readonly blockMetacharacters: boolean;
  private readonly blockNetworkExfil: boolean;
  private readonly blockPermissionMutation: boolean;
  private readonly maxCommandLength: number;

  constructor(options: CommandPolicyOptions = {}) {
    this.allowedPrograms = options.allowedPrograms ?? DEFAULT_ALLOWED_PROGRAMS;
    this.blockMetacharacters = options.blockMetacharacters ?? true;
    this.blockNetworkExfil = options.blockNetworkExfil ?? true;
    this.blockPermissionMutation = options.blockPermissionMutation ?? true;
    this.maxCommandLength = Math.max(64, options.maxCommandLength ?? 4000);
  }

  /** Rules that must never fire: a violation here is an outright reject. */
  private static readonly HARD_RULES: Array<{ id: string; pattern: RegExp; why: string }> = [
    { id: 'forkbomb', pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/, why: 'fork bomb' },
    { id: 'disk-wipe', pattern: /\bmkfs(\.\w+)?\s|\bdd\b[^|;]*\bof=\/dev\/(sd|nvme|disk|hd)/, why: 'disk destruction' },
    { id: 'rm-root', pattern: /\brm\s+(-[a-zA-Z]*\s+)*(-[a-zA-Z]*[rf][a-zA-Z]*\s+)*(\/|~|\$HOME)(\s|$)/, why: 'recursive delete of root/home' },
    { id: 'priv-escalation', pattern: /(^|[\s"'])(sudo|doas|su)\s/, why: 'privilege escalation' },
    { id: 'remote-pipe-shell', pattern: /\b(curl|wget)\b[^|;]*\|\s*(ba|z|k)?sh\b/, why: 'piping remote content into a shell' },
    { id: 'env-dump', pattern: /\bprintenv\b|\benv\b\s*$|\bcat\s+\.env\b/, why: 'dumping environment/secrets' },
    { id: 'history-read', pattern: /\bcat\s+~?\/?\.?(bash_history|zsh_history|python_history)/, why: 'reading shell history' },
    { id: 'ssh-key-read', pattern: /\bcat\s+~?\/?\.ssh\/id_/, why: 'reading private SSH keys' },
    { id: 'reverse-shell', pattern: /\/dev\/tcp\/|\bnc\s+-e\s|\bbash\s+-i\s+>&/, why: 'reverse shell' },
    { id: 'git-force-push', pattern: /\bgit\s+push\b[^|;]*--force(?!-with-lease)/, why: 'force push' },
    { id: 'npm-publish', pattern: /\bnpm\s+publish\b/, why: 'publishing a package' },
  ];

  /**
   * Evaluate one shell command. Never throws; a malformed command is a
   * `critical` reject, not an exception.
   */
  evaluate(command: string): CommandVerdict {
    const raw = typeof command === 'string' ? command : String(command ?? '');
    const violations: string[] = [];

    if (!raw.trim()) {
      return { allowed: false, risk: 'low', violations: ['empty-command'], reason: 'Command is empty.', program: '' };
    }
    if (raw.length > this.maxCommandLength) {
      return {
        allowed: false,
        risk: 'medium',
        violations: ['oversized-command'],
        reason: `Command is ${raw.length} characters, over the ${this.maxCommandLength} limit. Split it into smaller steps.`,
        program: '',
      };
    }

    const { program } = parseCommandLine(raw);

    // 1. hard rules — never allowed, in any permission mode
    for (const rule of CommandPolicy.HARD_RULES) {
      if (rule.pattern.test(raw)) violations.push(`${rule.id} (${rule.why})`);
    }

    // 2. structural rules
    if (this.blockMetacharacters) {
      for (const rule of METACHARACTER_RULES) {
        if (rule.pattern.test(raw)) violations.push(`${rule.id} (${rule.why})`);
      }
    }
    if (this.blockPermissionMutation) {
      for (const rule of PERMISSION_RULES) {
        if (rule.pattern.test(raw)) violations.push(`${rule.id} (${rule.why})`);
      }
    }
    if (this.blockNetworkExfil) {
      for (const rule of EXFIL_RULES) {
        if (rule.pattern.test(raw)) violations.push(`${rule.id} (${rule.why})`);
      }
    }

    // 3. allowlist
    if (program && !matchesAllowlist(program, this.allowedPrograms)) {
      violations.push(`program-not-allowed ('${program}' is not on the command allowlist)`);
    }

    if (violations.length === 0) {
      return { allowed: true, risk: this.classify(raw), violations: [], reason: 'clean', program };
    }

    const hard = violations.some(v => CommandPolicy.HARD_RULES.some(r => v.startsWith(r.id)));
    return {
      allowed: false,
      risk: hard ? 'critical' : 'high',
      violations,
      reason:
        `BLOCKED by CommandPolicy: ${violations.join('; ')}. ` +
        'Rethink the approach and propose a command that stays within the allowed toolchain — do not attempt to bypass this policy.',
      program,
    };
  }

  /** Risk classification for commands that passed the policy. */
  classify(command: string): CommandRisk {
    const cmd = command.trim().toLowerCase();
    if (/^\s*(rm|mv)\b/.test(cmd)) return 'high';
    if (/^\s*(cp|mkdir|touch|ln|tar|unzip|zip)\b/.test(cmd)) return 'medium';
    if (/^\s*(npm|pnpm|yarn)\s+(install|i|add|remove|update)\b/.test(cmd)) return 'medium';
    if (/^\s*(git)\s+(commit|push|merge|rebase|reset|checkout|switch|stash)\b/.test(cmd)) return 'medium';
    if (/^\s*(docker|docker-compose)\b/.test(cmd)) return 'medium';
    if (/^\s*(ls|pwd|cat|head|tail|wc|file|stat|grep|rg|find|which|echo|printf|date|git\s+(status|diff|log|show|blame)|npm\s+(test|run)|node\s+--version)\b/.test(cmd)) {
      return 'safe';
    }
    return 'low';
  }

  /** True when a program name is on the allowlist (for UI/preflight checks). */
  isProgramAllowed(program: string): boolean {
    return matchesAllowlist(program, this.allowedPrograms);
  }

  /** The active allowlist, for display in `/security` style commands. */
  get allowlist(): readonly string[] {
    return this.allowedPrograms;
  }
}
