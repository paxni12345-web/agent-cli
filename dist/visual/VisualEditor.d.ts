/**
 * Visual Code Editor Integration
 * Monaco editor integration, syntax highlighting, IntelliSense, and visual debugging
 */
export interface EditorConfig {
    theme: 'vs-dark' | 'vs-light' | 'hc-black';
    fontSize: number;
    fontFamily: string;
    lineNumbers: 'on' | 'off' | 'relative';
    minimap: boolean;
    wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
    tabSize: number;
    insertSpaces: boolean;
    renderWhitespace: 'none' | 'boundary' | 'selection' | 'all';
    autoSave: boolean;
    autoSaveDelay: number;
}
export interface EditorPosition {
    line: number;
    column: number;
}
export interface EditorRange {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}
export interface EditorDecoration {
    range: EditorRange;
    options: DecorationOptions;
}
export interface DecorationOptions {
    className?: string;
    hoverMessage?: string;
    glyphMarginClassName?: string;
    glyphMarginHoverMessage?: string;
    isWholeLine?: boolean;
    inlineClassName?: string;
    inlineClassNameAffectsLetterSpacing?: boolean;
}
export interface CompletionItem {
    label: string;
    kind: CompletionItemKind;
    detail?: string;
    documentation?: string;
    insertText: string;
    sortText?: string;
    filterText?: string;
    preselect?: boolean;
    commitCharacters?: string[];
}
export declare enum CompletionItemKind {
    Text = 1,
    Method = 2,
    Function = 3,
    Constructor = 4,
    Field = 5,
    Variable = 6,
    Class = 7,
    Interface = 8,
    Module = 9,
    Property = 10,
    Unit = 11,
    Value = 12,
    Enum = 13,
    Keyword = 14,
    Snippet = 15,
    Color = 16,
    File = 17,
    Reference = 18,
    Folder = 19,
    EnumMember = 20,
    Constant = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}
export interface HoverInfo {
    contents: string[];
    range?: EditorRange;
}
export interface Diagnostic {
    severity: DiagnosticSeverity;
    range: EditorRange;
    message: string;
    source?: string;
    code?: string | number;
    relatedInformation?: DiagnosticRelatedInformation[];
}
export declare enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}
export interface DiagnosticRelatedInformation {
    location: {
        uri: string;
        range: EditorRange;
    };
    message: string;
}
export interface CodeAction {
    title: string;
    kind: CodeActionKind;
    diagnostics?: Diagnostic[];
    edit?: WorkspaceEdit;
    command?: Command;
}
export declare enum CodeActionKind {
    QuickFix = "quickfix",
    Refactor = "refactor",
    RefactorExtract = "refactor.extract",
    RefactorInline = "refactor.inline",
    RefactorRewrite = "refactor.rewrite",
    Source = "source",
    SourceOrganizeImports = "source.organizeImports",
    SourceFixAll = "source.fixAll"
}
export interface WorkspaceEdit {
    changes: Record<string, TextEdit[]>;
}
export interface TextEdit {
    range: EditorRange;
    newText: string;
}
export interface Command {
    title: string;
    command: string;
    arguments?: any[];
}
export interface EditorViewState {
    cursorPosition: EditorPosition;
    scrollTop: number;
    scrollLeft: number;
    selections: EditorRange[];
}
/**
 * Visual Editor Manager
 */
export declare class VisualEditorManager {
    private editors;
    private config;
    private activeEditorId?;
    constructor(config?: Partial<EditorConfig>);
    /**
     * Create editor instance
     */
    createEditor(id: string, filePath: string, content: string, language: string): EditorInstance;
    /**
     * Get editor instance
     */
    getEditor(id: string): EditorInstance | undefined;
    /**
     * Get active editor
     */
    getActiveEditor(): EditorInstance | undefined;
    /**
     * Set active editor
     */
    setActiveEditor(id: string): void;
    /**
     * Close editor
     */
    closeEditor(id: string): void;
    /**
     * List all editors
     */
    listEditors(): EditorInstance[];
    /**
     * Update configuration
     */
    updateConfig(config: Partial<EditorConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): EditorConfig;
}
/**
 * Editor Instance
 */
export declare class EditorInstance {
    readonly id: string;
    readonly filePath: string;
    readonly language: string;
    private config;
    private content;
    private isDirty;
    private decorations;
    private viewState;
    private version;
    private autoSaveTimer?;
    constructor(id: string, filePath: string, content: string, language: string, config: EditorConfig);
    /**
     * Get content
     */
    getContent(): string;
    /**
     * Set content
     */
    setContent(content: string): void;
    /**
     * Insert text at position
     */
    insertText(position: EditorPosition, text: string): void;
    /**
     * Replace text in range
     */
    replaceText(range: EditorRange, text: string): void;
    /**
     * Delete text in range
     */
    deleteText(range: EditorRange): void;
    /**
     * Get text in range
     */
    getTextInRange(range: EditorRange): string;
    /**
     * Get line content
     */
    getLine(lineNumber: number): string;
    /**
     * Get line count
     */
    getLineCount(): number;
    /**
     * Add decorations
     */
    addDecorations(key: string, decorations: EditorDecoration[]): void;
    /**
     * Remove decorations
     */
    removeDecorations(key: string): void;
    /**
     * Get decorations
     */
    getDecorations(key?: string): EditorDecoration[];
    /**
     * Set cursor position
     */
    setCursorPosition(position: EditorPosition): void;
    /**
     * Get cursor position
     */
    getCursorPosition(): EditorPosition;
    /**
     * Set selections
     */
    setSelections(selections: EditorRange[]): void;
    /**
     * Get selections
     */
    getSelections(): EditorRange[];
    /**
     * Save view state
     */
    saveViewState(): EditorViewState;
    /**
     * Restore view state
     */
    restoreViewState(state: EditorViewState): void;
    /**
     * Is dirty
     */
    isDirtyState(): boolean;
    /**
     * Mark dirty
     */
    private markDirty;
    /**
     * Mark clean
     */
    markClean(): void;
    /**
     * Save content
     */
    save(): Promise<void>;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<EditorConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): EditorConfig;
    /**
     * Get version
     */
    getVersion(): number;
    /**
     * Setup auto-save
     */
    private setupAutoSave;
    /**
     * Reset auto-save timer
     */
    private resetAutoSave;
    /**
     * Dispose editor
     */
    dispose(): void;
}
/**
 * IntelliSense Provider
 */
export declare class IntelliSenseProvider {
    private completionProviders;
    private hoverProviders;
    /**
     * Register completion provider
     */
    registerCompletionProvider(language: string, provider: CompletionProvider): void;
    /**
     * Register hover provider
     */
    registerHoverProvider(language: string, provider: HoverProvider): void;
    /**
     * Get completions
     */
    getCompletions(editor: EditorInstance, position: EditorPosition): Promise<CompletionItem[]>;
    /**
     * Get hover information
     */
    getHoverInfo(editor: EditorInstance, position: EditorPosition): Promise<HoverInfo | null>;
}
export interface CompletionProvider {
    provideCompletions(editor: EditorInstance, position: EditorPosition): Promise<CompletionItem[]>;
}
export interface HoverProvider {
    provideHover(editor: EditorInstance, position: EditorPosition): Promise<HoverInfo | null>;
}
/**
 * Diagnostic Manager
 */
export declare class DiagnosticManager {
    private diagnostics;
    /**
     * Set diagnostics for file
     */
    setDiagnostics(filePath: string, diagnostics: Diagnostic[]): void;
    /**
     * Get diagnostics for file
     */
    getDiagnostics(filePath: string): Diagnostic[];
    /**
     * Clear diagnostics for file
     */
    clearDiagnostics(filePath: string): void;
    /**
     * Get all diagnostics
     */
    getAllDiagnostics(): Record<string, Diagnostic[]>;
    /**
     * Get diagnostics count by severity
     */
    getDiagnosticCounts(): Record<DiagnosticSeverity, number>;
}
/**
 * Code Action Provider
 */
export declare class CodeActionProvider {
    /**
     * Provide code actions
     */
    provideCodeActions(editor: EditorInstance, range: EditorRange, context: {
        diagnostics: Diagnostic[];
    }): Promise<CodeAction[]>;
    private generateQuickFix;
}
/**
 * Diff Editor
 */
export declare class DiffEditor {
    private originalContent;
    private modifiedContent;
    private language;
    constructor(originalContent: string, modifiedContent: string, language: string);
    /**
     * Get differences
     */
    getDifferences(): DiffChange[];
    /**
     * Apply changes
     */
    applyChanges(): string;
    /**
     * Revert changes
     */
    revertChanges(): string;
}
export interface DiffChange {
    type: 'insert' | 'delete' | 'modify';
    originalStartLine: number;
    originalEndLine: number;
    modifiedStartLine: number;
    modifiedEndLine: number;
}
/**
 * Singleton instances
 */
export declare const visualEditorManager: VisualEditorManager;
export declare const intelliSenseProvider: IntelliSenseProvider;
export declare const diagnosticManager: DiagnosticManager;
export declare const codeActionProvider: CodeActionProvider;
//# sourceMappingURL=VisualEditor.d.ts.map