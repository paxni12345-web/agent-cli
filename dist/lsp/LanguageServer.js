"use strict";
/**
 * Language Server Protocol (LSP) Implementation
 * Code completion, hover information, diagnostics, and symbol resolution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.languageServer = exports.LanguageServer = exports.SymbolKind = exports.DiagnosticSeverity = exports.InsertTextFormat = exports.CompletionItemKind = exports.TextDocumentSyncKind = void 0;
const EventBus_1 = require("../core/EventBus");
var TextDocumentSyncKind;
(function (TextDocumentSyncKind) {
    TextDocumentSyncKind[TextDocumentSyncKind["None"] = 0] = "None";
    TextDocumentSyncKind[TextDocumentSyncKind["Full"] = 1] = "Full";
    TextDocumentSyncKind[TextDocumentSyncKind["Incremental"] = 2] = "Incremental";
})(TextDocumentSyncKind || (exports.TextDocumentSyncKind = TextDocumentSyncKind = {}));
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
var InsertTextFormat;
(function (InsertTextFormat) {
    InsertTextFormat[InsertTextFormat["PlainText"] = 1] = "PlainText";
    InsertTextFormat[InsertTextFormat["Snippet"] = 2] = "Snippet";
})(InsertTextFormat || (exports.InsertTextFormat = InsertTextFormat = {}));
var DiagnosticSeverity;
(function (DiagnosticSeverity) {
    DiagnosticSeverity[DiagnosticSeverity["Error"] = 1] = "Error";
    DiagnosticSeverity[DiagnosticSeverity["Warning"] = 2] = "Warning";
    DiagnosticSeverity[DiagnosticSeverity["Information"] = 3] = "Information";
    DiagnosticSeverity[DiagnosticSeverity["Hint"] = 4] = "Hint";
})(DiagnosticSeverity || (exports.DiagnosticSeverity = DiagnosticSeverity = {}));
var SymbolKind;
(function (SymbolKind) {
    SymbolKind[SymbolKind["File"] = 1] = "File";
    SymbolKind[SymbolKind["Module"] = 2] = "Module";
    SymbolKind[SymbolKind["Namespace"] = 3] = "Namespace";
    SymbolKind[SymbolKind["Package"] = 4] = "Package";
    SymbolKind[SymbolKind["Class"] = 5] = "Class";
    SymbolKind[SymbolKind["Method"] = 6] = "Method";
    SymbolKind[SymbolKind["Property"] = 7] = "Property";
    SymbolKind[SymbolKind["Field"] = 8] = "Field";
    SymbolKind[SymbolKind["Constructor"] = 9] = "Constructor";
    SymbolKind[SymbolKind["Enum"] = 10] = "Enum";
    SymbolKind[SymbolKind["Interface"] = 11] = "Interface";
    SymbolKind[SymbolKind["Function"] = 12] = "Function";
    SymbolKind[SymbolKind["Variable"] = 13] = "Variable";
    SymbolKind[SymbolKind["Constant"] = 14] = "Constant";
    SymbolKind[SymbolKind["String"] = 15] = "String";
    SymbolKind[SymbolKind["Number"] = 16] = "Number";
    SymbolKind[SymbolKind["Boolean"] = 17] = "Boolean";
    SymbolKind[SymbolKind["Array"] = 18] = "Array";
    SymbolKind[SymbolKind["Object"] = 19] = "Object";
    SymbolKind[SymbolKind["Key"] = 20] = "Key";
    SymbolKind[SymbolKind["Null"] = 21] = "Null";
    SymbolKind[SymbolKind["EnumMember"] = 22] = "EnumMember";
    SymbolKind[SymbolKind["Struct"] = 23] = "Struct";
    SymbolKind[SymbolKind["Event"] = 24] = "Event";
    SymbolKind[SymbolKind["Operator"] = 25] = "Operator";
    SymbolKind[SymbolKind["TypeParameter"] = 26] = "TypeParameter";
})(SymbolKind || (exports.SymbolKind = SymbolKind = {}));
/**
 * Language Server
 */
class LanguageServer {
    documents = new Map();
    diagnostics = new Map();
    symbols = new Map();
    initialized = false;
    /**
     * Initialize server
     */
    initialize(params) {
        this.initialized = true;
        EventBus_1.eventBus.emitSync('lsp.initialized', params, 'LanguageServer');
        return {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Full,
                completionProvider: {
                    triggerCharacters: ['.', ':'],
                    resolveProvider: true,
                },
                hoverProvider: true,
                signatureHelpProvider: {
                    triggerCharacters: ['(', ','],
                },
                definitionProvider: true,
                referencesProvider: true,
                documentSymbolProvider: true,
                workspaceSymbolProvider: true,
                codeActionProvider: true,
                documentFormattingProvider: true,
                renameProvider: true,
                diagnosticProvider: true,
            },
            serverInfo: {
                name: 'Agent CLI Language Server',
                version: '1.0.0',
            },
        };
    }
    /**
     * Shutdown server
     */
    shutdown() {
        this.initialized = false;
        EventBus_1.eventBus.emitSync('lsp.shutdown', {}, 'LanguageServer');
    }
    /**
     * Exit server
     */
    exit() {
        process.exit(0);
    }
    /**
     * Open document
     */
    didOpenTextDocument(params) {
        this.documents.set(params.textDocument.uri, params.textDocument);
        this.analyzeDocument(params.textDocument);
    }
    /**
     * Change document
     */
    didChangeTextDocument(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (doc) {
            doc.version = params.textDocument.version;
            doc.text = params.contentChanges[0].text;
            this.analyzeDocument(doc);
        }
    }
    /**
     * Close document
     */
    didCloseTextDocument(params) {
        this.documents.delete(params.textDocument.uri);
        this.diagnostics.delete(params.textDocument.uri);
        this.symbols.delete(params.textDocument.uri);
    }
    /**
     * Get completions
     */
    completion(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc)
            return [];
        const line = doc.text.split('\n')[params.position.line];
        const prefix = line.substring(0, params.position.character);
        return this.getCompletions(doc, prefix, params.position);
    }
    /**
     * Resolve completion item
     */
    completionResolve(item) {
        // Add detailed documentation
        if (item.data) {
            item.documentation = this.getDetailedDocumentation(item.data);
        }
        return item;
    }
    /**
     * Get hover information
     */
    hover(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc)
            return null;
        const symbol = this.getSymbolAtPosition(doc, params.position);
        if (!symbol)
            return null;
        return {
            contents: {
                kind: 'markdown',
                value: this.formatSymbolHover(symbol),
            },
            range: symbol.range,
        };
    }
    /**
     * Get signature help
     */
    signatureHelp(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc)
            return null;
        const functionCall = this.getFunctionCall(doc, params.position);
        if (!functionCall)
            return null;
        return {
            signatures: [
                {
                    label: functionCall.signature,
                    documentation: functionCall.documentation,
                    parameters: functionCall.parameters.map(p => ({
                        label: p.name,
                        documentation: p.documentation,
                    })),
                },
            ],
            activeSignature: 0,
            activeParameter: functionCall.activeParameter,
        };
    }
    /**
     * Go to definition
     */
    definition(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc)
            return null;
        const symbol = this.getSymbolAtPosition(doc, params.position);
        if (!symbol || !symbol.definition)
            return null;
        return symbol.definition;
    }
    /**
     * Find references
     */
    references(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc)
            return [];
        const symbol = this.getSymbolAtPosition(doc, params.position);
        if (!symbol)
            return [];
        return this.findReferences(symbol.name, params.context.includeDeclaration);
    }
    /**
     * Get document symbols
     */
    documentSymbol(params) {
        return this.symbols.get(params.textDocument.uri) || [];
    }
    /**
     * Get workspace symbols
     */
    workspaceSymbol(params) {
        const allSymbols = [];
        for (const symbols of this.symbols.values()) {
            for (const symbol of symbols) {
                if (symbol.name.toLowerCase().includes(params.query.toLowerCase())) {
                    allSymbols.push(symbol);
                }
            }
        }
        return allSymbols;
    }
    /**
     * Get code actions
     */
    codeAction(params) {
        const actions = [];
        for (const diagnostic of params.context.diagnostics) {
            actions.push(...this.getQuickFixes(diagnostic, params.textDocument.uri));
        }
        return actions;
    }
    /**
     * Format document
     */
    formatting(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc)
            return [];
        const formatted = this.formatCode(doc.text, params.options);
        return [
            {
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: doc.text.split('\n').length, character: 0 },
                },
                newText: formatted,
            },
        ];
    }
    /**
     * Rename symbol
     */
    rename(params) {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc)
            return null;
        const symbol = this.getSymbolAtPosition(doc, params.position);
        if (!symbol)
            return null;
        const references = this.findReferences(symbol.name, true);
        const changes = {};
        for (const ref of references) {
            if (!changes[ref.uri]) {
                changes[ref.uri] = [];
            }
            changes[ref.uri].push({
                range: ref.range,
                newText: params.newName,
            });
        }
        return { changes };
    }
    /**
     * Get diagnostics
     */
    getDiagnostics(uri) {
        return this.diagnostics.get(uri) || [];
    }
    // Helper methods
    analyzeDocument(doc) {
        // Parse and analyze
        const diagnostics = this.lint(doc);
        const symbols = this.extractSymbols(doc);
        this.diagnostics.set(doc.uri, diagnostics);
        this.symbols.set(doc.uri, symbols);
        EventBus_1.eventBus.emitSync('lsp.document_analyzed', { uri: doc.uri }, 'LanguageServer');
    }
    lint(doc) {
        const diagnostics = [];
        const lines = doc.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check for common issues
            if (line.includes('console.log')) {
                diagnostics.push({
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length },
                    },
                    severity: DiagnosticSeverity.Warning,
                    message: 'Unexpected console statement',
                    source: 'linter',
                });
            }
            if (line.match(/var\s+/)) {
                diagnostics.push({
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length },
                    },
                    severity: DiagnosticSeverity.Information,
                    message: "Use 'const' or 'let' instead of 'var'",
                    source: 'linter',
                });
            }
        }
        return diagnostics;
    }
    extractSymbols(doc) {
        const symbols = [];
        const lines = doc.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Extract functions
            const funcMatch = line.match(/function\s+(\w+)/);
            if (funcMatch) {
                symbols.push({
                    name: funcMatch[1],
                    kind: SymbolKind.Function,
                    location: {
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: 0 },
                            end: { line: i, character: line.length },
                        },
                    },
                });
            }
            // Extract classes
            const classMatch = line.match(/class\s+(\w+)/);
            if (classMatch) {
                symbols.push({
                    name: classMatch[1],
                    kind: SymbolKind.Class,
                    location: {
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: 0 },
                            end: { line: i, character: line.length },
                        },
                    },
                });
            }
            // Extract variables
            const varMatch = line.match(/(?:const|let|var)\s+(\w+)/);
            if (varMatch) {
                symbols.push({
                    name: varMatch[1],
                    kind: SymbolKind.Variable,
                    location: {
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: 0 },
                            end: { line: i, character: line.length },
                        },
                    },
                });
            }
        }
        return symbols;
    }
    getCompletions(doc, prefix, position) {
        const completions = [];
        // Keywords
        const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export'];
        for (const keyword of keywords) {
            if (keyword.startsWith(prefix.trim())) {
                completions.push({
                    label: keyword,
                    kind: CompletionItemKind.Keyword,
                    insertText: keyword,
                });
            }
        }
        // Symbols in current document
        const symbols = this.symbols.get(doc.uri) || [];
        for (const symbol of symbols) {
            completions.push({
                label: symbol.name,
                kind: this.symbolKindToCompletionKind(symbol.kind),
                detail: `(${SymbolKind[symbol.kind]})`,
            });
        }
        return completions;
    }
    symbolKindToCompletionKind(kind) {
        switch (kind) {
            case SymbolKind.Function:
                return CompletionItemKind.Function;
            case SymbolKind.Class:
                return CompletionItemKind.Class;
            case SymbolKind.Variable:
                return CompletionItemKind.Variable;
            default:
                return CompletionItemKind.Text;
        }
    }
    getDetailedDocumentation(data) {
        return 'Detailed documentation for this symbol';
    }
    getSymbolAtPosition(doc, position) {
        // Mock implementation
        return null;
    }
    formatSymbolHover(symbol) {
        return `**${symbol.name}**\n\n${symbol.documentation || 'No documentation available'}`;
    }
    getFunctionCall(doc, position) {
        // Mock implementation
        return null;
    }
    findReferences(symbolName, includeDeclaration) {
        // Mock implementation
        return [];
    }
    getQuickFixes(diagnostic, uri) {
        const actions = [];
        if (diagnostic.message.includes('console statement')) {
            actions.push({
                title: 'Remove console.log',
                kind: 'quickfix',
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [uri]: [
                            {
                                range: diagnostic.range,
                                newText: '',
                            },
                        ],
                    },
                },
            });
        }
        return actions;
    }
    formatCode(code, options) {
        // Simple formatting (in production, use a proper formatter)
        return code;
    }
}
exports.LanguageServer = LanguageServer;
/**
 * Singleton instance
 */
exports.languageServer = new LanguageServer();
