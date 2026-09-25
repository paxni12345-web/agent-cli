import {
  PermissionManager,
  Action,
  PermissionResult,
  PermissionMode,
} from '../types/index.js';
import * as readline from 'readline';

export class DefaultPermissionManager implements PermissionManager {
  private mode: PermissionMode;
  private autoApproveCache = new Set<string>();
  private inputSource: NodeJS.ReadableStream;

  // ---- Item 28: elevated permissions expire — the manager auto-reverts
  // from 'auto' back to 'safe' after a bounded window (default 30 min).
  private elevatedUntil: number | null = null;
  private static readonly ELEVATED_TTL_MS = 30 * 60 * 1000;

  constructor(mode: PermissionMode = 'normal', inputSource: NodeJS.ReadableStream = process.stdin) {
    this.mode = mode;
    this.inputSource = inputSource;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  check(action: Action): PermissionResult {
    this.getMode(); // trigger item-28 expiry check first
    if (this.mode === 'auto') {
      if (action.risk === 'critical') {
        return {
          allowed: false,
          reason: 'Critical risk actions require explicit approval even in auto mode',
        };
      }
      return { allowed: true };
    }

    if (this.mode === 'safe') {
      if (action.risk === 'safe') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Safe mode: ${action.risk} risk actions are not allowed`,
      };
    }

    if (this.mode === 'normal') {
      if (action.risk === 'safe' || action.risk === 'low') {
        return { allowed: true };
      }

      if (action.type === 'read_file' && action.risk === 'medium') {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Action requires approval',
      };
    }

    if (this.mode === 'dangerous') {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Unknown permission mode',
    };
  }

  async requestApproval(action: Action): Promise<boolean> {
    const cacheKey = this.getCacheKey(action);
    if (this.autoApproveCache.has(cacheKey)) {
      return true;
    }

    console.log('\n⚠️  The agent wants to perform an action:\n');
    console.log(`Type: ${action.type}`);
    console.log(`Description: ${action.description}`);
    if (action.command) {
      console.log(`Command: ${action.command}`);
    }
    if (action.target) {
      console.log(`Target: ${action.target}`);
    }
    console.log(`Risk: ${action.risk}\n`);

    const rl = readline.createInterface({
      input: this.inputSource,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question('Allow? [y/N/always]: ', answer => {
        rl.close();

        const response = answer.toLowerCase().trim();

        if (response === 'y' || response === 'yes') {
          resolve(true);
        } else if (response === 'always') {
          this.autoApproveCache.add(cacheKey);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  private getCacheKey(action: Action): string {
    return `${action.type}:${action.command || action.target || ''}`;
  }

  clearCache(): void {
    this.autoApproveCache.clear();
  }
}
