/**
 * ProtectedPaths — files that need elevated approval before the agent may
 * change them.
 *
 * Some paths are load-bearing for safety or for the user's environment:
 * `.env` files hold credentials, `.git/` holds history, CI workflows hold the
 * supply-chain trust boundary, and the agent's own security config decides how
 * much freedom the agent gets. An agent must never be able to silently loosen
 * its own constraints, so writes to these paths always need approval.
 *
 * This module classifies a path into a protection tier. The pipeline maps the
 * tier to "always ask a human" regardless of permission mode.
 */

import * as path from 'path';

export type ProtectionTier =
  /** Ordinary project file — normal risk rules apply. */
  | 'normal'
  /** Sensitive but legitimate: elevated approval required. */
  | 'protected'
  /** Security-critical: elevated approval + explicit confirmation. */
  | 'critical';

export interface ProtectedPathMatch {
  tier: ProtectionTier;
  /** Rule id that matched (empty for normal files). */
  ruleId: string;
  /** Why this path is protected, shown to the human and the model. */
  reason: string;
}

interface Rule {
  id: string;
  tier: Exclude<ProtectionTier, 'normal'>;
  reason: string;
  /** Tested against the workspace-relative POSIX-style path. */
  test: (relPath: string, basename: string) => boolean;
}

const RULES: Rule[] = [
  {
    id: 'env-file',
    tier: 'protected',
    reason: 'environment/credential file',
    test: (_rel, base) => base === '.env' || base.startsWith('.env.'),
  },
  {
    id: 'dotenv-variant',
    tier: 'protected',
    reason: 'environment variant holding secrets',
    test: (rel) => /(^|\/)\.env(\.[\w.-]+)?$/.test(rel) && rel !== '.env.example',
  },
  {
    id: 'git-internals',
    tier: 'critical',
    reason: 'git internals — history and remotes can be destroyed or rewritten',
    test: (rel) => rel === '.git' || rel.startsWith('.git/'),
  },
  {
    id: 'ci-workflow',
    tier: 'critical',
    reason: 'CI workflow — a change here runs with repository credentials',
    test: (rel) => rel.startsWith('.github/workflows/'),
  },
  {
    id: 'agent-security-config',
    tier: 'critical',
    reason: 'agent security configuration — the agent may not loosen its own constraints',
    test: (rel) =>
      rel === '.agent/config.json' ||
      rel.startsWith('.agent/security') ||
      rel === '.agent/permissions.json',
  },
  {
    id: 'ssh-material',
    tier: 'critical',
    reason: 'SSH material',
    test: (rel) => rel.startsWith('.ssh/') || /(^|\/)id_(rsa|ed25519|ecdsa|dsa)$/.test(rel),
  },
  {
    id: 'credential-store',
    tier: 'critical',
    reason: 'credential store',
    test: (_rel, base) =>
      base === '.npmrc' ||
      base === '.netrc' ||
      base === '.git-credentials' ||
      base === 'credentials.json' ||
      base === 'service-account.json',
  },
  {
    id: 'package-manifest',
    tier: 'protected',
    reason: 'dependency manifest — changes propagate to everyone who installs',
    test: (_rel, base) => base === 'package.json' || base === 'package-lock.json',
  },
  {
    id: 'container-definition',
    tier: 'protected',
    reason: 'container/deploy definition',
    test: (_rel, base) =>
      base === 'Dockerfile' || base === 'docker-compose.yml' || base === 'render.yaml' || base === 'vercel.json',
  },
  {
    id: 'security-module',
    tier: 'critical',
    reason: 'security enforcement module — weakening it would disable guardrails',
    test: (rel) => /(^|\/)src\/security\//.test(rel),
  },
  {
    id: 'tool-execution-core',
    tier: 'protected',
    reason: 'tool execution core — touches the permission and sandbox path',
    test: (rel) => /(^|\/)src\/agent\/ToolCallValidator\.ts$/.test(rel),
  },
];

export class ProtectedPaths {
  private readonly extraRules: Rule[];

  /**
   * @param extraPatterns - additional glob-ish prefixes treated as
   *   `protected`, e.g. `['infra/', 'secrets/']`.
   */
  constructor(extraPatterns: readonly string[] = []) {
    this.extraRules = extraPatterns.map((pattern, index) => ({
      id: `custom-protected-${index}`,
      tier: 'protected' as const,
      reason: `user-declared protected path (${pattern})`,
      test: (rel: string) => rel === pattern || rel.startsWith(pattern.replace(/\/?$/, '/')),
    }));
  }

  /**
   * Classify a workspace-relative or absolute path.
   *
   * @param target - the path the agent wants to touch.
   * @param workspaceRoot - used to relativise absolute paths.
   */
  classify(target: string, workspaceRoot: string): ProtectedPathMatch {
    const absoluteRoot = path.resolve(workspaceRoot);
    const absoluteTarget = path.isAbsolute(target) ? path.resolve(target) : path.resolve(absoluteRoot, target);

    let rel = path.relative(absoluteRoot, absoluteTarget).split(path.sep).join('/');
    if (rel.startsWith('../') || rel === '..') {
      // Outside the workspace: PathValidator rejects this anyway, but the
      // classification stays conservative rather than silently normal.
      rel = rel.replace(/^(\.\.\/)+/, '');
    }
    const base = rel.split('/').pop() ?? rel;

    for (const rule of [...this.extraRules, ...RULES]) {
      if (rule.test(rel, base)) {
        return { tier: rule.tier, ruleId: rule.id, reason: rule.reason };
      }
    }
    return { tier: 'normal', ruleId: '', reason: '' };
  }

  /** True when the path needs a human regardless of permission mode. */
  requiresApproval(target: string, workspaceRoot: string): boolean {
    return this.classify(target, workspaceRoot).tier !== 'normal';
  }

  /** All rule ids, for documentation and `/security` output. */
  static ruleIds(): string[] {
    return RULES.map(r => r.id);
  }

  /**
   * Convenience for the file tools: the protection reason for a
   * workspace-relative path, or null when nothing special covers it.
   */
  static check(workspaceRelativePath: string): string | null {
    const rel = workspaceRelativePath.replace(/\\/g, '/');
    const base = rel.split('/').pop() ?? rel;
    const hit = RULES.find(rule => rule.test(rel, base));
    return hit ? `${hit.reason} (${hit.id})` : null;
  }

  /** Risk level a mutation on this path should carry. */
  static riskFor(workspaceRelativePath: string): 'medium' | 'high' | 'critical' {
    return ProtectedPaths.check(workspaceRelativePath) ? 'critical' : 'medium';
  }
}
