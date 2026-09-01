"use strict";
// Permission Manager - handles command/action authorization
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultPermissionManager = void 0;
const readline = __importStar(require("readline"));
class DefaultPermissionManager {
    mode;
    autoApproveCache = new Set();
    constructor(mode = 'normal') {
        this.mode = mode;
    }
    setMode(mode) {
        this.mode = mode;
    }
    check(action) {
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
    async requestApproval(action) {
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
                }
                else if (response === 'always') {
                    this.autoApproveCache.add(cacheKey);
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            });
        });
    }
    getCacheKey(action) {
        return `${action.type}:${action.command || action.target || ''}`;
    }
    clearCache() {
        this.autoApproveCache.clear();
    }
}
exports.DefaultPermissionManager = DefaultPermissionManager;
