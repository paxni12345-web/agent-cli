export interface ErrorPattern {
    pattern: RegExp | string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    commonCauses: string[];
    suggestedFixes: Fix[];
}
export interface Fix {
    description: string;
    action: 'retry' | 'modify_input' | 'change_approach' | 'skip' | 'rollback';
    confidence: number;
    instructions?: string;
}
export interface ErrorContext {
    error: Error | string;
    step: string;
    input: unknown;
    previousAttempts: number;
    history: Array<{
        action: string;
        result: string;
    }>;
}
export interface RecoveryStrategy {
    name: string;
    applicable: (context: ErrorContext) => boolean;
    execute: (context: ErrorContext) => Promise<RecoveryResult>;
}
export interface RecoveryResult {
    success: boolean;
    action: string;
    newInput?: unknown;
    message: string;
}
export declare class SelfHealingSystem {
    private errorPatterns;
    private recoveryStrategies;
    private errorHistory;
    private successfulFixes;
    constructor();
    private initializeErrorPatterns;
    private initializeRecoveryStrategies;
    analyzeError(context: ErrorContext): Promise<{
        pattern: ErrorPattern | null;
        recommendedFix: Fix | null;
        recoveryStrategy: RecoveryStrategy | null;
    }>;
    attemptRecovery(context: ErrorContext): Promise<RecoveryResult>;
    private modifyInput;
    recordSuccessfulFix(errorCategory: string, fix: Fix): void;
    getErrorStatistics(): {
        totalErrors: number;
        errorsByCategory: Record<string, number>;
        topErrors: Array<{
            error: string;
            count: number;
        }>;
    };
    generateErrorReport(): string;
    private getErrorKey;
    private sleep;
    clearHistory(): void;
}
export declare class AutoDebugger {
    analyzeStackTrace(stackTrace: string): Promise<{
        likelyFile: string | null;
        likelyLine: number | null;
        likelyFunction: string | null;
        suggestions: string[];
    }>;
    suggestFix(errorMessage: string, context: {
        file?: string;
        code?: string;
    }): Promise<string[]>;
}
//# sourceMappingURL=SelfHealingSystem.d.ts.map