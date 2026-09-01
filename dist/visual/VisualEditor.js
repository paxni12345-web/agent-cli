"use strict";
/**
 * Visual Code Editor Integration
 * Monaco editor integration, syntax highlighting, IntelliSense, and visual debugging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeActionProvider = exports.diagnosticManager = exports.intelliSenseProvider = exports.visualEditorManager = exports.DiffEditor = exports.CodeActionProvider = exports.DiagnosticManager = exports.IntelliSenseProvider = exports.EditorInstance = exports.VisualEditorManager = exports.CodeActionKind = exports.DiagnosticSeverity = exports.CompletionItemKind = void 0;
const EventBus_1 = require("../core/EventBus");
var CompletionItemKind;
(function (CompletionItemKind) {
    CompletionItemKind[CompletionItemKind["Text"] = 1] = "Text";
    CompletionItemKind[CompletionItemKind["Method"] = 2] = "Method";
    CompletionItemKind[CompletionItemKind["Function"] = 3] = "Function";
    CompletionItemKind[CompletionItemKind["Constructor"] = 4] = "Constructor";
    CompletionItemKind[CompletionItemKind["Field"] = 5] = "Field";
    CompletionItemKind[CompletionItemKind["Variable"] = 6] = "Variable";
    CompletionItemKind[CompletionItemKind["Class"] = 7] = "Class";
    CompletionItemKind[CompletionItemKind["Interface"] = 8] = "Interface";
    CompletionItemKind[CompletionItemKind["Module"] = 9] = "Module";
    CompletionItemKind[CompletionItemKind["Property"] = 10] = "Property";
    CompletionItemKind[CompletionItemKind["Unit"] = 11] = "Unit";
    CompletionItemKind[CompletionItemKind["Value"] = 12] = "Value";
    CompletionItemKind[CompletionItemKind["Enum"] = 13] = "Enum";
    CompletionItemKind[CompletionItemKind["Keyword"] = 14] = "Keyword";
    CompletionItemKind[CompletionItemKind["Snippet"] = 15] = "Snippet";
    CompletionItemKind[CompletionItemKind["Color"] = 16] = "Color";
    CompletionItemKind[CompletionItemKind["File"] = 17] = "File";
    CompletionItemKind[CompletionItemKind["Reference"] = 18] = "Reference";
    CompletionItemKind[CompletionItemKind["Folder"] = 19] = "Folder";
    CompletionItemKind[CompletionItemKind["EnumMember"] = 20] = "EnumMember";
    CompletionItemKind[CompletionItemKind["Constant"] = 21] = "Constant";
    CompletionItemKind[CompletionItemKind["Struct"] = 22] = "Struct";
    CompletionItemKind[CompletionItemKind["Event"] = 23] = "Event";
    CompletionItemKind[CompletionItemKind["Operator"] = 24] = "Operator";
    CompletionItemKind[CompletionItemKind["TypeParameter"] = 25] = "TypeParameter";
})(CompletionItemKind || (exports.CompletionItemKind = CompletionItemKind = {}));
var DiagnosticSeverity;
(function (DiagnosticSeverity) {
    DiagnosticSeverity[DiagnosticSeverity["Error"] = 1] = "Error";
    DiagnosticSeverity[DiagnosticSeverity["Warning"] = 2] = "Warning";
    DiagnosticSeverity[DiagnosticSeverity["Information"] = 3] = "Information";
    DiagnosticSeverity[DiagnosticSeverity["Hint"] = 4] = "Hint";
})(DiagnosticSeverity || (exports.DiagnosticSeverity = DiagnosticSeverity = {}));
var CodeActionKind;
(function (CodeActionKind) {
    CodeActionKind["QuickFix"] = "quickfix";
    CodeActionKind["Refactor"] = "refactor";
    CodeActionKind["RefactorExtract"] = "refactor.extract";
    CodeActionKind["RefactorInline"] = "refactor.inline";
    CodeActionKind["RefactorRewrite"] = "refactor.rewrite";
    CodeActionKind["Source"] = "source";
    CodeActionKind["SourceOrganizeImports"] = "source.organizeImports";
    CodeActionKind["SourceFixAll"] = "source.fixAll";
})(CodeActionKind || (exports.CodeActionKind = CodeActionKind = {}));
/**
 * Visual Editor Manager
 */
class VisualEditorManager {
    editors = new Map();
    config;
    activeEditorId;
    constructor(config) {
        this.config = {
            theme: 'vs-dark',
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            lineNumbers: 'on',
            minimap: true,
            wordWrap: 'off',
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
            autoSave: true,
            autoSaveDelay: 1000,
            ...config,
        };
    }
    /**
     * Create editor instance
     */
    createEditor(id, filePath, content, language) {
        const editor = new EditorInstance(id, filePath, content, language, this.config);
        this.editors.set(id, editor);
        this.activeEditorId = id;
        EventBus_1.eventBus.emitSync('editor.created', { editorId: id, filePath }, 'VisualEditorManager');
        return editor;
    }
    /**
     * Get editor instance
     */
    getEditor(id) {
        return this.editors.get(id);
    }
    /**
     * Get active editor
     */
    getActiveEditor() {
        return this.activeEditorId ? this.editors.get(this.activeEditorId) : undefined;
    }
    /**
     * Set active editor
     */
    setActiveEditor(id) {
        if (!this.editors.has(id)) {
            throw new Error(`Editor not found: ${id}`);
        }
        this.activeEditorId = id;
        EventBus_1.eventBus.emitSync('editor.activated', { editorId: id }, 'VisualEditorManager');
    }
    /**
     * Close editor
     */
    closeEditor(id) {
        const editor = this.editors.get(id);
        if (editor) {
            editor.dispose();
            this.editors.delete(id);
            if (this.activeEditorId === id) {
                this.activeEditorId = undefined;
            }
            EventBus_1.eventBus.emitSync('editor.closed', { editorId: id }, 'VisualEditorManager');
        }
    }
    /**
     * List all editors
     */
    listEditors() {
        return Array.from(this.editors.values());
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        Object.assign(this.config, config);
        // Update all editors
        for (const editor of this.editors.values()) {
            editor.updateConfig(config);
        }
        EventBus_1.eventBus.emitSync('editor.config_updated', config, 'VisualEditorManager');
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.VisualEditorManager = VisualEditorManager;
/**
 * Editor Instance
 */
class EditorInstance {
    id;
    filePath;
    language;
    config;
    content;
    isDirty = false;
    decorations = new Map();
    viewState;
    version = 0;
    autoSaveTimer;
    constructor(id, filePath, content, language, config) {
        this.id = id;
        this.filePath = filePath;
        this.language = language;
        this.content = content;
        this.config = { ...config };
        this.viewState = {
            cursorPosition: { line: 1, column: 1 },
            scrollTop: 0,
            scrollLeft: 0,
            selections: [],
        };
        this.setupAutoSave();
    }
    /**
     * Get content
     */
    getContent() {
        return this.content;
    }
    /**
     * Set content
     */
    setContent(content) {
        this.content = content;
        this.version++;
        this.markDirty();
        EventBus_1.eventBus.emitSync('editor.content_changed', {
            editorId: this.id,
            version: this.version,
        }, 'EditorInstance');
    }
    /**
     * Insert text at position
     */
    insertText(position, text) {
        const lines = this.content.split('\n');
        const line = lines[position.line - 1] || '';
        const newLine = line.slice(0, position.column - 1) + text + line.slice(position.column - 1);
        lines[position.line - 1] = newLine;
        this.setContent(lines.join('\n'));
    }
    /**
     * Replace text in range
     */
    replaceText(range, text) {
        const lines = this.content.split('\n');
        // Extract before and after content
        const beforeLine = lines[range.startLine - 1] || '';
        const afterLine = lines[range.endLine - 1] || '';
        const before = beforeLine.slice(0, range.startColumn - 1);
        const after = afterLine.slice(range.endColumn - 1);
        // Remove lines in range
        lines.splice(range.startLine - 1, range.endLine - range.startLine + 1, before + text + after);
        this.setContent(lines.join('\n'));
    }
    /**
     * Delete text in range
     */
    deleteText(range) {
        this.replaceText(range, '');
    }
    /**
     * Get text in range
     */
    getTextInRange(range) {
        const lines = this.content.split('\n');
        const selectedLines = [];
        for (let i = range.startLine - 1; i <= range.endLine - 1; i++) {
            if (i >= 0 && i < lines.length) {
                let line = lines[i];
                if (i === range.startLine - 1) {
                    line = line.slice(range.startColumn - 1);
                }
                if (i === range.endLine - 1) {
                    line = line.slice(0, range.endColumn - 1 - (i === range.startLine - 1 ? range.startColumn - 1 : 0));
                }
                selectedLines.push(line);
            }
        }
        return selectedLines.join('\n');
    }
    /**
     * Get line content
     */
    getLine(lineNumber) {
        const lines = this.content.split('\n');
        return lines[lineNumber - 1] || '';
    }
    /**
     * Get line count
     */
    getLineCount() {
        return this.content.split('\n').length;
    }
    /**
     * Add decorations
     */
    addDecorations(key, decorations) {
        this.decorations.set(key, decorations);
        EventBus_1.eventBus.emitSync('editor.decorations_changed', { editorId: this.id }, 'EditorInstance');
    }
    /**
     * Remove decorations
     */
    removeDecorations(key) {
        this.decorations.delete(key);
        EventBus_1.eventBus.emitSync('editor.decorations_changed', { editorId: this.id }, 'EditorInstance');
    }
    /**
     * Get decorations
     */
    getDecorations(key) {
        if (key) {
            return this.decorations.get(key) || [];
        }
        return Array.from(this.decorations.values()).flat();
    }
    /**
     * Set cursor position
     */
    setCursorPosition(position) {
        this.viewState.cursorPosition = position;
        EventBus_1.eventBus.emitSync('editor.cursor_changed', { editorId: this.id, position }, 'EditorInstance');
    }
    /**
     * Get cursor position
     */
    getCursorPosition() {
        return { ...this.viewState.cursorPosition };
    }
    /**
     * Set selections
     */
    setSelections(selections) {
        this.viewState.selections = selections;
        EventBus_1.eventBus.emitSync('editor.selection_changed', { editorId: this.id, selections }, 'EditorInstance');
    }
    /**
     * Get selections
     */
    getSelections() {
        return [...this.viewState.selections];
    }
    /**
     * Save view state
     */
    saveViewState() {
        return { ...this.viewState };
    }
    /**
     * Restore view state
     */
    restoreViewState(state) {
        this.viewState = { ...state };
        EventBus_1.eventBus.emitSync('editor.view_state_changed', { editorId: this.id }, 'EditorInstance');
    }
    /**
     * Is dirty
     */
    isDirtyState() {
        return this.isDirty;
    }
    /**
     * Mark dirty
     */
    markDirty() {
        this.isDirty = true;
        this.resetAutoSave();
    }
    /**
     * Mark clean
     */
    markClean() {
        this.isDirty = false;
    }
    /**
     * Save content
     */
    async save() {
        // In production, write to file system
        this.markClean();
        EventBus_1.eventBus.emitSync('editor.saved', { editorId: this.id, filePath: this.filePath }, 'EditorInstance');
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        Object.assign(this.config, config);
        this.setupAutoSave();
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get version
     */
    getVersion() {
        return this.version;
    }
    /**
     * Setup auto-save
     */
    setupAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = undefined;
        }
    }
    /**
     * Reset auto-save timer
     */
    resetAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        if (this.config.autoSave) {
            this.autoSaveTimer = setTimeout(() => {
                if (this.isDirty) {
                    this.save();
                }
            }, this.config.autoSaveDelay);
        }
    }
    /**
     * Dispose editor
     */
    dispose() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        this.decorations.clear();
    }
}
exports.EditorInstance = EditorInstance;
/**
 * IntelliSense Provider
 */
class IntelliSenseProvider {
    completionProviders = new Map();
    hoverProviders = new Map();
    /**
     * Register completion provider
     */
    registerCompletionProvider(language, provider) {
        this.completionProviders.set(language, provider);
    }
    /**
     * Register hover provider
     */
    registerHoverProvider(language, provider) {
        this.hoverProviders.set(language, provider);
    }
    /**
     * Get completions
     */
    async getCompletions(editor, position) {
        const provider = this.completionProviders.get(editor.language);
        if (!provider) {
            return [];
        }
        return provider.provideCompletions(editor, position);
    }
    /**
     * Get hover information
     */
    async getHoverInfo(editor, position) {
        const provider = this.hoverProviders.get(editor.language);
        if (!provider) {
            return null;
        }
        return provider.provideHover(editor, position);
    }
}
exports.IntelliSenseProvider = IntelliSenseProvider;
/**
 * Diagnostic Manager
 */
class DiagnosticManager {
    diagnostics = new Map();
    /**
     * Set diagnostics for file
     */
    setDiagnostics(filePath, diagnostics) {
        this.diagnostics.set(filePath, diagnostics);
        EventBus_1.eventBus.emitSync('diagnostics.updated', { filePath, diagnostics }, 'DiagnosticManager');
    }
    /**
     * Get diagnostics for file
     */
    getDiagnostics(filePath) {
        return this.diagnostics.get(filePath) || [];
    }
    /**
     * Clear diagnostics for file
     */
    clearDiagnostics(filePath) {
        this.diagnostics.delete(filePath);
        EventBus_1.eventBus.emitSync('diagnostics.cleared', { filePath }, 'DiagnosticManager');
    }
    /**
     * Get all diagnostics
     */
    getAllDiagnostics() {
        const result = {};
        for (const [filePath, diagnostics] of this.diagnostics) {
            result[filePath] = diagnostics;
        }
        return result;
    }
    /**
     * Get diagnostics count by severity
     */
    getDiagnosticCounts() {
        const counts = {
            [DiagnosticSeverity.Error]: 0,
            [DiagnosticSeverity.Warning]: 0,
            [DiagnosticSeverity.Information]: 0,
            [DiagnosticSeverity.Hint]: 0,
        };
        for (const diagnostics of this.diagnostics.values()) {
            for (const diagnostic of diagnostics) {
                counts[diagnostic.severity]++;
            }
        }
        return counts;
    }
}
exports.DiagnosticManager = DiagnosticManager;
/**
 * Code Action Provider
 */
class CodeActionProvider {
    /**
     * Provide code actions
     */
    async provideCodeActions(editor, range, context) {
        const actions = [];
        // Quick fixes for diagnostics
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.severity === DiagnosticSeverity.Error) {
                actions.push({
                    title: `Fix: ${diagnostic.message}`,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    edit: this.generateQuickFix(editor, diagnostic),
                });
            }
        }
        // Refactoring actions
        const selectedText = editor.getTextInRange(range);
        if (selectedText && selectedText.length > 0) {
            actions.push({
                title: 'Extract to variable',
                kind: CodeActionKind.RefactorExtract,
                command: {
                    title: 'Extract to variable',
                    command: 'refactor.extractVariable',
                    arguments: [editor.id, range],
                },
            });
            actions.push({
                title: 'Extract to function',
                kind: CodeActionKind.RefactorExtract,
                command: {
                    title: 'Extract to function',
                    command: 'refactor.extractFunction',
                    arguments: [editor.id, range],
                },
            });
        }
        // Source actions
        actions.push({
            title: 'Organize imports',
            kind: CodeActionKind.SourceOrganizeImports,
            command: {
                title: 'Organize imports',
                command: 'source.organizeImports',
                arguments: [editor.id],
            },
        });
        actions.push({
            title: 'Fix all auto-fixable problems',
            kind: CodeActionKind.SourceFixAll,
            command: {
                title: 'Fix all',
                command: 'source.fixAll',
                arguments: [editor.id],
            },
        });
        return actions;
    }
    generateQuickFix(editor, diagnostic) {
        // Simple mock quick fix
        return {
            changes: {
                [editor.filePath]: [
                    {
                        range: diagnostic.range,
                        newText: '',
                    },
                ],
            },
        };
    }
}
exports.CodeActionProvider = CodeActionProvider;
/**
 * Diff Editor
 */
class DiffEditor {
    originalContent;
    modifiedContent;
    language;
    constructor(originalContent, modifiedContent, language) {
        this.originalContent = originalContent;
        this.modifiedContent = modifiedContent;
        this.language = language;
    }
    /**
     * Get differences
     */
    getDifferences() {
        const originalLines = this.originalContent.split('\n');
        const modifiedLines = this.modifiedContent.split('\n');
        const changes = [];
        // Simple line-by-line diff
        const maxLines = Math.max(originalLines.length, modifiedLines.length);
        for (let i = 0; i < maxLines; i++) {
            const originalLine = originalLines[i];
            const modifiedLine = modifiedLines[i];
            if (originalLine === undefined) {
                changes.push({
                    type: 'insert',
                    originalStartLine: i,
                    originalEndLine: i,
                    modifiedStartLine: i + 1,
                    modifiedEndLine: i + 1,
                });
            }
            else if (modifiedLine === undefined) {
                changes.push({
                    type: 'delete',
                    originalStartLine: i + 1,
                    originalEndLine: i + 1,
                    modifiedStartLine: i,
                    modifiedEndLine: i,
                });
            }
            else if (originalLine !== modifiedLine) {
                changes.push({
                    type: 'modify',
                    originalStartLine: i + 1,
                    originalEndLine: i + 1,
                    modifiedStartLine: i + 1,
                    modifiedEndLine: i + 1,
                });
            }
        }
        return changes;
    }
    /**
     * Apply changes
     */
    applyChanges() {
        return this.modifiedContent;
    }
    /**
     * Revert changes
     */
    revertChanges() {
        return this.originalContent;
    }
}
exports.DiffEditor = DiffEditor;
/**
 * Singleton instances
 */
exports.visualEditorManager = new VisualEditorManager();
exports.intelliSenseProvider = new IntelliSenseProvider();
exports.diagnosticManager = new DiagnosticManager();
exports.codeActionProvider = new CodeActionProvider();
