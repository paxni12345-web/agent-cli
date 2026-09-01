"use strict";
// Self-Healing and Advanced Error Recovery System
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoDebugger = exports.SelfHealingSystem = void 0;
class SelfHealingSystem {
    errorPatterns;
    recoveryStrategies;
    errorHistory = new Map();
    successfulFixes = new Map();
    constructor() {
        this.errorPatterns = this.initializeErrorPatterns();
        this.recoveryStrategies = this.initializeRecoveryStrategies();
    }
    initializeErrorPatterns() {
        return [
            {
                pattern: /ENOENT.*no such file or directory/i,
                category: 'file_not_found',
                severity: 'medium',
                commonCauses: [
                    'File path is incorrect',
                    'File was deleted',
                    'Wrong working directory',
                    'Typo in filename',
                ],
                suggestedFixes: [
                    {
                        description: 'Search for similar files',
                        action: 'modify_input',
                        confidence: 0.7,
                        instructions: 'Use search_code to find the correct file path',
                    },
                    {
                        description: 'Create the missing file',
                        action: 'change_approach',
                        confidence: 0.6,
                        instructions: 'Create the file if it should exist',
                    },
                ],
            },
            {
                pattern: /SyntaxError/i,
                category: 'syntax_error',
                severity: 'high',
                commonCauses: [
                    'Invalid syntax in code',
                    'Missing brackets or quotes',
                    'Incorrect indentation',
                ],
                suggestedFixes: [
                    {
                        description: 'Re-read file and fix syntax',
                        action: 'change_approach',
                        confidence: 0.8,
                        instructions: 'Read the file, identify syntax issues, and fix them',
                    },
                ],
            },
            {
                pattern: /command not found/i,
                category: 'command_not_found',
                severity: 'high',
                commonCauses: [
                    'Command not installed',
                    'Typo in command name',
                    'Command not in PATH',
                ],
                suggestedFixes: [
                    {
                        description: 'Check for typos',
                        action: 'modify_input',
                        confidence: 0.6,
                    },
                    {
                        description: 'Use alternative command',
                        action: 'change_approach',
                        confidence: 0.7,
                        instructions: 'Find an alternative way to accomplish the task',
                    },
                ],
            },
            {
                pattern: /permission denied/i,
                category: 'permission_denied',
                severity: 'high',
                commonCauses: [
                    'Insufficient permissions',
                    'File is read-only',
                    'Protected system file',
                ],
                suggestedFixes: [
                    {
                        description: 'Request permission',
                        action: 'retry',
                        confidence: 0.5,
                        instructions: 'Request elevated permissions from user',
                    },
                    {
                        description: 'Use alternative approach',
                        action: 'change_approach',
                        confidence: 0.7,
                    },
                ],
            },
            {
                pattern: /Module not found|Cannot find module/i,
                category: 'missing_dependency',
                severity: 'medium',
                commonCauses: [
                    'Dependency not installed',
                    'Import path incorrect',
                    'Package name typo',
                ],
                suggestedFixes: [
                    {
                        description: 'Install missing dependency',
                        action: 'change_approach',
                        confidence: 0.8,
                        instructions: 'Run npm install or yarn add for the missing module',
                    },
                    {
                        description: 'Fix import path',
                        action: 'modify_input',
                        confidence: 0.6,
                    },
                ],
            },
            {
                pattern: /Test.*failed|FAIL/i,
                category: 'test_failure',
                severity: 'high',
                commonCauses: [
                    'Logic error in implementation',
                    'Test expectations incorrect',
                    'Missing edge case handling',
                ],
                suggestedFixes: [
                    {
                        description: 'Analyze test output and fix code',
                        action: 'change_approach',
                        confidence: 0.75,
                        instructions: 'Read test failure details, understand the issue, and fix the implementation',
                    },
                ],
            },
            {
                pattern: /timeout|timed out/i,
                category: 'timeout',
                severity: 'medium',
                commonCauses: [
                    'Operation taking too long',
                    'Infinite loop',
                    'Network delay',
                ],
                suggestedFixes: [
                    {
                        description: 'Increase timeout',
                        action: 'modify_input',
                        confidence: 0.5,
                    },
                    {
                        description: 'Optimize operation',
                        action: 'change_approach',
                        confidence: 0.7,
                    },
                ],
            },
        ];
    }
    initializeRecoveryStrategies() {
        return [
            {
                name: 'simple_retry',
                applicable: (ctx) => ctx.previousAttempts < 2,
                execute: async (ctx) => {
                    return {
                        success: true,
                        action: 'retry',
                        message: 'Retrying with same input',
                    };
                },
            },
            {
                name: 'exponential_backoff',
                applicable: (ctx) => ctx.previousAttempts >= 2 && ctx.previousAttempts < 5,
                execute: async (ctx) => {
                    const delay = Math.pow(2, ctx.previousAttempts) * 1000;
                    await this.sleep(delay);
                    return {
                        success: true,
                        action: 'retry_with_backoff',
                        message: `Retrying after ${delay}ms delay`,
                    };
                },
            },
            {
                name: 'alternative_approach',
                applicable: (ctx) => ctx.previousAttempts >= 3,
                execute: async (ctx) => {
                    return {
                        success: true,
                        action: 'change_approach',
                        message: 'Switching to alternative approach',
                    };
                },
            },
        ];
    }
    async analyzeError(context) {
        const errorMessage = context.error instanceof Error
            ? context.error.message
            : context.error;
        // Find matching error pattern
        let matchedPattern = null;
        for (const pattern of this.errorPatterns) {
            if (typeof pattern.pattern === 'string') {
                if (errorMessage.includes(pattern.pattern)) {
                    matchedPattern = pattern;
                    break;
                }
            }
            else {
                if (pattern.pattern.test(errorMessage)) {
                    matchedPattern = pattern;
                    break;
                }
            }
        }
        // Get recommended fix
        let recommendedFix = null;
        if (matchedPattern) {
            // Check if we have a successful fix for this error before
            const previousFixes = this.successfulFixes.get(matchedPattern.category);
            if (previousFixes && previousFixes.length > 0) {
                recommendedFix = previousFixes[0];
            }
            else {
                // Use the highest confidence fix
                const fixes = matchedPattern.suggestedFixes.sort((a, b) => b.confidence - a.confidence);
                recommendedFix = fixes[0] || null;
            }
        }
        // Find applicable recovery strategy
        const recoveryStrategy = this.recoveryStrategies.find(s => s.applicable(context)) || null;
        return {
            pattern: matchedPattern,
            recommendedFix,
            recoveryStrategy,
        };
    }
    async attemptRecovery(context) {
        // Track error occurrence
        const errorKey = this.getErrorKey(context.error);
        this.errorHistory.set(errorKey, (this.errorHistory.get(errorKey) || 0) + 1);
        // Check if error is recurring too often
        if (this.errorHistory.get(errorKey) > 5) {
            return {
                success: false,
                action: 'give_up',
                message: 'Error recurring too frequently. Manual intervention required.',
            };
        }
        // Analyze the error
        const analysis = await this.analyzeError(context);
        if (!analysis.pattern) {
            // Unknown error - try generic strategies
            if (context.previousAttempts < 3) {
                return {
                    success: true,
                    action: 'retry',
                    message: 'Unknown error. Retrying with exponential backoff.',
                };
            }
            else {
                return {
                    success: false,
                    action: 'escalate',
                    message: 'Unable to recover from unknown error after multiple attempts.',
                };
            }
        }
        // Apply recommended fix
        if (analysis.recommendedFix) {
            const fix = analysis.recommendedFix;
            switch (fix.action) {
                case 'retry':
                    return {
                        success: true,
                        action: 'retry',
                        message: `${fix.description}. Confidence: ${(fix.confidence * 100).toFixed(0)}%`,
                    };
                case 'modify_input':
                    return {
                        success: true,
                        action: 'modify_input',
                        message: fix.description,
                        newInput: await this.modifyInput(context, fix),
                    };
                case 'change_approach':
                    return {
                        success: true,
                        action: 'change_approach',
                        message: `${fix.description}. ${fix.instructions || ''}`,
                    };
                case 'skip':
                    return {
                        success: true,
                        action: 'skip',
                        message: 'Skipping problematic step',
                    };
                case 'rollback':
                    return {
                        success: true,
                        action: 'rollback',
                        message: 'Rolling back to previous state',
                    };
            }
        }
        // Apply recovery strategy
        if (analysis.recoveryStrategy) {
            return await analysis.recoveryStrategy.execute(context);
        }
        return {
            success: false,
            action: 'give_up',
            message: 'No recovery strategy available',
        };
    }
    async modifyInput(context, fix) {
        // This would use AI to modify input based on the error
        // For now, return original input
        return context.input;
    }
    recordSuccessfulFix(errorCategory, fix) {
        const fixes = this.successfulFixes.get(errorCategory) || [];
        fixes.unshift(fix); // Add to front
        this.successfulFixes.set(errorCategory, fixes.slice(0, 5)); // Keep top 5
    }
    getErrorStatistics() {
        const errorsByCategory = {};
        let totalErrors = 0;
        for (const [error, count] of this.errorHistory.entries()) {
            totalErrors += count;
            // Try to categorize
            const pattern = this.errorPatterns.find(p => {
                if (typeof p.pattern === 'string') {
                    return error.includes(p.pattern);
                }
                else {
                    return p.pattern.test(error);
                }
            });
            if (pattern) {
                errorsByCategory[pattern.category] = (errorsByCategory[pattern.category] || 0) + count;
            }
            else {
                errorsByCategory['unknown'] = (errorsByCategory['unknown'] || 0) + count;
            }
        }
        const topErrors = Array.from(this.errorHistory.entries())
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            totalErrors,
            errorsByCategory,
            topErrors,
        };
    }
    generateErrorReport() {
        const stats = this.getErrorStatistics();
        let report = '🔧 Error Analysis Report\n\n';
        report += `Total Errors: ${stats.totalErrors}\n\n`;
        report += 'Errors by Category:\n';
        for (const [category, count] of Object.entries(stats.errorsByCategory)) {
            report += `  ${category}: ${count}\n`;
        }
        report += '\nTop 10 Errors:\n';
        for (const { error, count } of stats.topErrors) {
            const truncated = error.length > 60 ? error.substring(0, 60) + '...' : error;
            report += `  ${count}x: ${truncated}\n`;
        }
        return report;
    }
    getErrorKey(error) {
        const message = error instanceof Error ? error.message : error;
        // Normalize error message for tracking
        return message.substring(0, 100);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    clearHistory() {
        this.errorHistory.clear();
    }
}
exports.SelfHealingSystem = SelfHealingSystem;
class AutoDebugger {
    async analyzeStackTrace(stackTrace) {
        // Parse stack trace
        const lines = stackTrace.split('\n');
        const frameRegex = /at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/;
        let likelyFile = null;
        let likelyLine = null;
        let likelyFunction = null;
        for (const line of lines) {
            const match = line.match(frameRegex);
            if (match) {
                likelyFunction = match[1] || 'anonymous';
                likelyFile = match[2];
                likelyLine = parseInt(match[3]);
                break; // First frame is usually the issue
            }
        }
        const suggestions = [];
        if (stackTrace.includes('TypeError')) {
            suggestions.push('Check for null/undefined values');
            suggestions.push('Verify object property access');
            suggestions.push('Add type guards or optional chaining');
        }
        if (stackTrace.includes('ReferenceError')) {
            suggestions.push('Check variable is defined before use');
            suggestions.push('Verify imports are correct');
            suggestions.push('Check for typos in variable names');
        }
        if (stackTrace.includes('Async')) {
            suggestions.push('Check for missing await keywords');
            suggestions.push('Verify promise rejection handling');
            suggestions.push('Add try-catch around async operations');
        }
        return {
            likelyFile,
            likelyLine,
            likelyFunction,
            suggestions,
        };
    }
    async suggestFix(errorMessage, context) {
        const suggestions = [];
        // This would use AI to generate specific fix suggestions
        // For now, return generic suggestions based on error type
        if (errorMessage.includes('null') || errorMessage.includes('undefined')) {
            suggestions.push('Add null check: if (value !== null && value !== undefined)');
            suggestions.push('Use optional chaining: object?.property');
            suggestions.push('Provide default value: value ?? defaultValue');
        }
        return suggestions;
    }
}
exports.AutoDebugger = AutoDebugger;
