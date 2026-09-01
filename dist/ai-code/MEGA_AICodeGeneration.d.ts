/**
 * MEGA PHASE 11: AI CODE GENERATION & INTELLIGENCE
 * AI-powered code generation, completion, and analysis
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface AICodeGenConfig {
    model: AIModel;
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stopSequences: string[];
    contextWindow: number;
}
export type AIModel = 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'codex' | 'starcoder' | 'codellama' | 'custom';
export interface CodeGenerationRequest {
    prompt: string;
    language: ProgrammingLanguage;
    context?: CodeContext;
    constraints?: GenerationConstraints;
    style?: CodingStyle;
}
export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust' | 'cpp' | 'csharp' | 'ruby' | 'php' | 'swift' | 'kotlin';
export interface CodeContext {
    existingCode?: string;
    imports?: string[];
    dependencies?: string[];
    framework?: string;
    projectStructure?: ProjectStructure;
}
export interface ProjectStructure {
    files: Map<string, string>;
    structure: DirectoryNode;
}
export interface DirectoryNode {
    name: string;
    type: 'file' | 'directory';
    children?: DirectoryNode[];
    content?: string;
}
export interface GenerationConstraints {
    maxLines?: number;
    maxComplexity?: number;
    requireTests?: boolean;
    requireDocs?: boolean;
    avoidPatterns?: string[];
    usePatterns?: string[];
}
export interface CodingStyle {
    indentation: IndentationStyle;
    quotes: QuoteStyle;
    semicolons: boolean;
    trailingComma: boolean;
    bracketSpacing: boolean;
    arrowParens: ArrowParensStyle;
    namingConvention: NamingConvention;
}
export type IndentationStyle = 'spaces' | 'tabs';
export type QuoteStyle = 'single' | 'double';
export type ArrowParensStyle = 'always' | 'avoid';
export interface NamingConvention {
    variables: CaseStyle;
    functions: CaseStyle;
    classes: CaseStyle;
    constants: CaseStyle;
}
export type CaseStyle = 'camelCase' | 'PascalCase' | 'snake_case' | 'SCREAMING_SNAKE_CASE';
export interface GeneratedCode {
    id: string;
    code: string;
    language: ProgrammingLanguage;
    explanation: string;
    confidence: number;
    alternatives?: GeneratedCode[];
    tests?: string;
    documentation?: string;
    metadata: GenerationMetadata;
}
export interface GenerationMetadata {
    model: AIModel;
    tokensUsed: number;
    duration: number;
    timestamp: Date;
    version: string;
}
export interface CodeCompletion {
    id: string;
    text: string;
    position: Position;
    score: number;
    type: CompletionType;
    documentation?: string;
    insertText?: string;
    additionalTextEdits?: TextEdit[];
}
export interface Position {
    line: number;
    character: number;
}
export type CompletionType = 'function' | 'method' | 'class' | 'interface' | 'variable' | 'constant' | 'property' | 'keyword' | 'snippet';
export interface TextEdit {
    range: Range;
    newText: string;
}
export interface Range {
    start: Position;
    end: Position;
}
export declare class AICodeGenerator extends EventEmitter {
    private config;
    private generations;
    private completions;
    private cache;
    constructor(config?: Partial<AICodeGenConfig>);
    generate(request: CodeGenerationRequest): Promise<GeneratedCode>;
    private buildPrompt;
    private generateCode;
    private getTemplateCode;
    private generateTests;
    private generateDocumentation;
    private calculateConfidence;
    complete(code: string, position: Position, language: ProgrammingLanguage): Promise<CodeCompletion[]>;
    refactor(code: string, refactoringType: RefactoringType): Promise<RefactoringResult>;
    private applyRefactoring;
    private calculateComplexity;
    private identifyPatterns;
    private generateSuggestions;
    private getCacheKey;
    private estimateTokens;
    private sleep;
    private generateId;
    getStats(): {
        generations: number;
        cachedGenerations: number;
        totalCompletions: number;
    };
}
export type RefactoringType = 'extract_function' | 'extract_variable' | 'inline' | 'rename' | 'move' | 'optimize';
export interface RefactoringResult {
    id: string;
    original: string;
    refactored: string;
    type: RefactoringType;
    changes: CodeChange[];
    explanation: string;
    safe: boolean;
}
export interface CodeChange {
    type: 'insert' | 'delete' | 'replace';
    range: Range;
    oldText?: string;
    newText?: string;
}
export interface CodeExplanation {
    id: string;
    code: string;
    summary: string;
    details: string[];
    complexity: ComplexityMetrics;
    patterns: CodePattern[];
    suggestions: string[];
}
export interface ComplexityMetrics {
    cyclomatic: number;
    cognitive: number;
    lines: number;
    maintainability: number;
}
export interface CodePattern {
    name: string;
    category: string;
    description: string;
}
export interface CodeReviewConfig {
    rules: ReviewRule[];
    severity: ReviewSeverity[];
    autoFix: boolean;
}
export interface ReviewRule {
    id: string;
    name: string;
    category: ReviewCategory;
    enabled: boolean;
    severity: ReviewSeverity;
}
export type ReviewCategory = 'correctness' | 'performance' | 'security' | 'maintainability' | 'style' | 'best_practices';
export type ReviewSeverity = 'info' | 'warning' | 'error' | 'critical';
export interface CodeReview {
    id: string;
    code: string;
    issues: ReviewIssue[];
    score: number;
    timestamp: Date;
}
export interface ReviewIssue {
    id: string;
    rule: string;
    category: ReviewCategory;
    severity: ReviewSeverity;
    message: string;
    line: number;
    column: number;
    fix?: ReviewFix;
}
export interface ReviewFix {
    description: string;
    changes: CodeChange[];
    automatic: boolean;
}
export declare class AICodeReviewer extends EventEmitter {
    private config;
    private reviews;
    constructor(config?: Partial<CodeReviewConfig>);
    review(code: string, language: ProgrammingLanguage): Promise<CodeReview>;
    private findIssues;
    private calculateScore;
    private generateId;
}
export declare class AICodeIntelligence {
    generator: AICodeGenerator;
    reviewer: AICodeReviewer;
    constructor();
    getOverallStats(): {
        generation: {
            generations: number;
            cachedGenerations: number;
            totalCompletions: number;
        };
        reviews: number;
    };
}
//# sourceMappingURL=MEGA_AICodeGeneration.d.ts.map