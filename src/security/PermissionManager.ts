// Permission Manager - handles command/action authorization

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

  constructor(mode: PermissionMode = 'normal') {
    this.mode = mode;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  check(action: Action): PermissionResult {
    // In 'auto' mode, allow everything except critical risks
    if (this.mode === 'auto') {
      if (action.risk === 'critical') {
        return {
          allowed: false,
          reason: 'Critical risk actions require explicit approval even in auto mode',
        };
      }
      return { allowed: true };
    }

    // In 'safe' mode, only allow safe operations
    if (this.mode === 'safe') {
      if (action.risk === 'safe') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Safe mode: ${action.risk} risk actions are not allowed`,
      };
    }

    // In 'normal' mode, check based on risk level
    if (this.mode === 'normal') {
      if (action.risk === 'safe' || action.risk === 'low') {
        return { allowed: true };
      }

      // Medium risk for read operations are OK
      if (action.type === 'read_file' && action.risk === 'medium') {
        return { allowed: true };
      }

      // Other medium/high/critical require approval
      return {
        allowed: false,
        reason: 'Action requires approval',
      };
    }

    // In 'dangerous' mode, allow everything
    if (this.mode === 'dangerous') {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Unknown permission mode',
    };
  }

  async requestApproval(action: Action): Promise<boolean> {
    // Check cache first
    const cacheKey = this.getCacheKey(action);
    if (this.autoApproveCache.has(cacheKey)) {
      return true;
    }

    // Show warning
    console.log('\n⚠️  The agent wants to perform an action:\n');
    console.log(`Type: ${action.type}`);
    console.log(`Description: ${action.description}`);
    if (action.command) {
      console.log(`Command: ${action.command}`);
    }
    if (action.target) {
      console.log(`Target: ${action.target}`);
    }
    console.log(`Risk: ${action.risk}`);
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('Allow? [y/N/always/once]: ', (answer) => {
        rl.close();

        const response = answer.toLowerCase().trim();

        if (response === 'y' || response === 'yes' || response === 'once') {
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
