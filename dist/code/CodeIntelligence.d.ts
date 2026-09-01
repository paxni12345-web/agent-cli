/**
 * PHASE 6: CODE INTELLIGENCE & REFACTORING SYSTEM
 * AST parsing, code analysis, and intelligent refactoring
 *
 * Part of 350K lines goal - PHASE 6
 */
import { EventEmitter } from 'events';
export interface CodeIntelligenceConfig {
    enableAnalysis: boolean;
    enableRefactoring: boolean;
    enableSearch: boolean;
    supportedLanguages: string[];
}
export interface CodeFile {
    id: string;
    path: string;
    language: Language;
    content: string;
    ast: AST;
    symbols: Symbol[];
    dependencies: Dependency[];
    metrics: CodeMetrics;
    issues: CodeIssue[];
}
export type Language = 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust' | 'cpp';
export interface AST {
    type: string;
    nodes: ASTNode[];
    root: ASTNode;
}
export interface ASTNode {
    id: string;
    type: NodeType;
    name?: string;
    value?: any;
    start: Position;
    end: Position;
    children: ASTNode[];
    parent?: string;
    metadata: NodeMetadata;
}
export type NodeType = 'program' | 'function' | 'class' | 'method' | 'variable' | 'import' | 'export' | 'expression' | 'statement' | 'block';
export interface Position {
    line: number;
    column: number;
    offset: number;
}
export interface NodeMetadata {
    scope?: string;
    modifiers?: string[];
    annotations?: Annotation[];
}
export interface Annotation {
    type: string;
    value: any;
}
export interface Symbol {
    id: string;
    name: string;
    type: SymbolType;
    scope: Scope;
    references: Reference[];
    definition: Position;
    visibility: Visibility;
}
export type SymbolType = 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface';
export interface Scope {
    type: ScopeType;
    range: Range;
    parent?: string;
}
export type ScopeType = 'global' | 'module' | 'function' | 'block' | 'class';
export interface Range {
    start: Position;
    end: Position;
}
export interface Reference {
    id: string;
    type: ReferenceType;
    location: Position;
    context: string;
}
export type ReferenceType = 'read' | 'write' | 'call' | 'type';
export type Visibility = 'public' | 'private' | 'protected' | 'internal';
export interface Dependency {
    id: string;
    type: DependencyType;
    name: string;
    version?: string;
    path?: string;
    used: boolean;
}
export type DependencyType = 'import' | 'require' | 'include' | 'reference';
export interface CodeMetrics {
    lines: number;
    linesOfCode: number;
    comments: number;
    complexity: number;
    maintainability: number;
    halstead: HalsteadMetrics;
    functions: number;
    classes: number;
}
export interface HalsteadMetrics {
    operators: number;
    operands: number;
    vocabulary: number;
    length: number;
    volume: number;
    difficulty: number;
    effort: number;
}
export interface CodeIssue {
    id: string;
    severity: IssueSeverity;
    type: IssueType;
    message: string;
    location: Range;
    suggestion?: string;
    autoFixable: boolean;
}
export type IssueSeverity = 'error' | 'warning' | 'info' | 'hint';
export type IssueType = 'syntax_error' | 'type_error' | 'unused_variable' | 'complexity' | 'security' | 'performance' | 'style';
export interface Refactoring {
    id: string;
    type: RefactoringType;
    description: string;
    changes: CodeChange[];
    safe: boolean;
    preview: string;
}
export type RefactoringType = 'rename' | 'extract_method' | 'extract_variable' | 'inline' | 'move' | 'change_signature' | 'optimize_imports';
export interface CodeChange {
    file: string;
    operation: ChangeOperation;
    range: Range;
    oldText?: string;
    newText?: string;
}
export type ChangeOperation = 'insert' | 'delete' | 'replace';
export interface SearchQuery {
    pattern: string;
    type: SearchType;
    language?: Language;
    scope?: SearchScope;
    caseSensitive: boolean;
    regex: boolean;
}
export type SearchType = 'text' | 'symbol' | 'reference' | 'type' | 'semantic';
export type SearchScope = 'file' | 'project' | 'workspace';
export interface SearchResult {
    file: string;
    matches: Match[];
    total: number;
}
export interface Match {
    range: Range;
    text: string;
    context: string;
    score: number;
}
export interface CodeCompletion {
    label: string;
    kind: CompletionKind;
    detail?: string;
    documentation?: string;
    insertText: string;
    range: Range;
    sortText?: string;
}
export type CompletionKind = 'function' | 'method' | 'variable' | 'class' | 'interface' | 'keyword' | 'snippet';
export interface SignatureHelp {
    signatures: Signature[];
    activeSignature: number;
    activeParameter: number;
}
export interface Signature {
    label: string;
    documentation?: string;
    parameters: Parameter[];
}
export interface Parameter {
    label: string;
    documentation?: string;
}
export interface Hover {
    content: string;
    range: Range;
}
export interface CodeAction {
    title: string;
    kind: CodeActionKind;
    edit?: CodeChange[];
    command?: Command;
}
export type CodeActionKind = 'quickfix' | 'refactor' | 'source';
export interface Command {
    command: string;
    arguments?: any[];
}
export declare class CodeIntelligenceManager extends EventEmitter {
    private config;
    private files;
    private symbols;
    private refactorings;
    constructor(config?: Partial<CodeIntelligenceConfig>);
    parseFile(path: string, content: string, language: Language): Promise<CodeFile>;
    private parseAST;
    private extractSymbols;
    private analyzeDependencies;
    private calculateMetrics;
    private analyzeIssues;
    rename(file: string, position: Position, newName: string): Promise<Refactoring>;
    extractMethod(file: string, range: Range, methodName: string): Promise<Refactoring>;
    applyRefactoring(refactoringId: string): Promise<void>;
    private applyChange;
    search(query: SearchQuery): Promise<SearchResult[]>;
    private searchInFile;
    getCompletions(file: string, position: Position): Promise<CodeCompletion[]>;
    private findSymbolAtPosition;
    private getTextInRange;
    private generatePreview;
    private generateId;
    getStats(): {
        files: number;
        symbols: number;
        refactorings: number;
        totalLines: number;
        totalIssues: number;
    };
}
//# sourceMappingURL=CodeIntelligence.d.ts.map