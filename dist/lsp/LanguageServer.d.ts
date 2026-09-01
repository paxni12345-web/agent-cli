/**
 * Language Server Protocol (LSP) Implementation
 * Code completion, hover information, diagnostics, and symbol resolution
 */
export interface LSPServer {
    initialize(params: InitializeParams): InitializeResult;
    shutdown(): void;
    exit(): void;
}
export interface InitializeParams {
    processId: number | null;
    rootUri: string | null;
    capabilities: ClientCapabilities;
    workspaceFolders?: WorkspaceFolder[];
}
export interface InitializeResult {
    capabilities: ServerCapabilities;
    serverInfo?: {
        name: string;
        version?: string;
    };
}
export interface ClientCapabilities {
    textDocument?: TextDocumentClientCapabilities;
    workspace?: WorkspaceClientCapabilities;
}
export interface ServerCapabilities {
    textDocumentSync?: TextDocumentSyncKind;
    completionProvider?: CompletionOptions;
    hoverProvider?: boolean;
    signatureHelpProvider?: SignatureHelpOptions;
    definitionProvider?: boolean;
    referencesProvider?: boolean;
    documentSymbolProvider?: boolean;
    workspaceSymbolProvider?: boolean;
    codeActionProvider?: boolean;
    documentFormattingProvider?: boolean;
    renameProvider?: boolean;
    diagnosticProvider?: boolean;
}
export declare enum TextDocumentSyncKind {
    None = 0,
    Full = 1,
    Incremental = 2
}
export interface CompletionOptions {
    triggerCharacters?: string[];
    resolveProvider?: boolean;
}
export interface SignatureHelpOptions {
    triggerCharacters?: string[];
}
export interface Position {
    line: number;
    character: number;
}
export interface Range {
    start: Position;
    end: Position;
}
export interface Location {
    uri: string;
    range: Range;
}
export interface TextDocument {
    uri: string;
    languageId: string;
    version: number;
    text: string;
}
export interface CompletionItem {
    label: string;
    kind?: CompletionItemKind;
    detail?: string;
    documentation?: string;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    insertTextFormat?: InsertTextFormat;
    textEdit?: TextEdit;
    additionalTextEdits?: TextEdit[];
    command?: Command;
    data?: any;
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
export declare enum InsertTextFormat {
    PlainText = 1,
    Snippet = 2
}
export interface TextEdit {
    range: Range;
    newText: string;
}
export interface Command {
    title: string;
    command: string;
    arguments?: any[];
}
export interface Hover {
    contents: string | MarkupContent;
    range?: Range;
}
export interface MarkupContent {
    kind: 'plaintext' | 'markdown';
    value: string;
}
export interface SignatureHelp {
    signatures: SignatureInformation[];
    activeSignature?: number;
    activeParameter?: number;
}
export interface SignatureInformation {
    label: string;
    documentation?: string | MarkupContent;
    parameters?: ParameterInformation[];
}
export interface ParameterInformation {
    label: string | [number, number];
    documentation?: string | MarkupContent;
}
export interface Diagnostic {
    range: Range;
    severity?: DiagnosticSeverity;
    code?: string | number;
    source?: string;
    message: string;
    relatedInformation?: DiagnosticRelatedInformation[];
}
export declare enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}
export interface DiagnosticRelatedInformation {
    location: Location;
    message: string;
}
export interface SymbolInformation {
    name: string;
    kind: SymbolKind;
    location: Location;
    containerName?: string;
}
export declare enum SymbolKind {
    File = 1,
    Module = 2,
    Namespace = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
    Constructor = 9,
    Enum = 10,
    Interface = 11,
    Function = 12,
    Variable = 13,
    Constant = 14,
    String = 15,
    Number = 16,
    Boolean = 17,
    Array = 18,
    Object = 19,
    Key = 20,
    Null = 21,
    EnumMember = 22,
    Struct = 23,
    Event = 24,
    Operator = 25,
    TypeParameter = 26
}
export interface CodeAction {
    title: string;
    kind?: string;
    diagnostics?: Diagnostic[];
    edit?: WorkspaceEdit;
    command?: Command;
}
export interface WorkspaceEdit {
    changes?: {
        [uri: string]: TextEdit[];
    };
    documentChanges?: TextDocumentEdit[];
}
export interface TextDocumentEdit {
    textDocument: {
        uri: string;
        version: number;
    };
    edits: TextEdit[];
}
export interface WorkspaceFolder {
    uri: string;
    name: string;
}
export interface TextDocumentClientCapabilities {
    completion?: {
        completionItem?: {
            snippetSupport?: boolean;
            commitCharactersSupport?: boolean;
            documentationFormat?: string[];
        };
    };
    hover?: {
        contentFormat?: string[];
    };
}
export interface WorkspaceClientCapabilities {
    applyEdit?: boolean;
    workspaceEdit?: {
        documentChanges?: boolean;
    };
}
/**
 * Language Server
 */
export declare class LanguageServer implements LSPServer {
    private documents;
    private diagnostics;
    private symbols;
    private initialized;
    /**
     * Initialize server
     */
    initialize(params: InitializeParams): InitializeResult;
    /**
     * Shutdown server
     */
    shutdown(): void;
    /**
     * Exit server
     */
    exit(): void;
    /**
     * Open document
     */
    didOpenTextDocument(params: {
        textDocument: TextDocument;
    }): void;
    /**
     * Change document
     */
    didChangeTextDocument(params: {
        textDocument: {
            uri: string;
            version: number;
        };
        contentChanges: Array<{
            text: string;
        }>;
    }): void;
    /**
     * Close document
     */
    didCloseTextDocument(params: {
        textDocument: {
            uri: string;
        };
    }): void;
    /**
     * Get completions
     */
    completion(params: {
        textDocument: {
            uri: string;
        };
        position: Position;
    }): CompletionItem[];
    /**
     * Resolve completion item
     */
    completionResolve(item: CompletionItem): CompletionItem;
    /**
     * Get hover information
     */
    hover(params: {
        textDocument: {
            uri: string;
        };
        position: Position;
    }): Hover | null;
    /**
     * Get signature help
     */
    signatureHelp(params: {
        textDocument: {
            uri: string;
        };
        position: Position;
    }): SignatureHelp | null;
    /**
     * Go to definition
     */
    definition(params: {
        textDocument: {
            uri: string;
        };
        position: Position;
    }): Location | null;
    /**
     * Find references
     */
    references(params: {
        textDocument: {
            uri: string;
        };
        position: Position;
        context: {
            includeDeclaration: boolean;
        };
    }): Location[];
    /**
     * Get document symbols
     */
    documentSymbol(params: {
        textDocument: {
            uri: string;
        };
    }): SymbolInformation[];
    /**
     * Get workspace symbols
     */
    workspaceSymbol(params: {
        query: string;
    }): SymbolInformation[];
    /**
     * Get code actions
     */
    codeAction(params: {
        textDocument: {
            uri: string;
        };
        range: Range;
        context: {
            diagnostics: Diagnostic[];
        };
    }): CodeAction[];
    /**
     * Format document
     */
    formatting(params: {
        textDocument: {
            uri: string;
        };
        options: {
            tabSize: number;
            insertSpaces: boolean;
        };
    }): TextEdit[];
    /**
     * Rename symbol
     */
    rename(params: {
        textDocument: {
            uri: string;
        };
        position: Position;
        newName: string;
    }): WorkspaceEdit | null;
    /**
     * Get diagnostics
     */
    getDiagnostics(uri: string): Diagnostic[];
    private analyzeDocument;
    private lint;
    private extractSymbols;
    private getCompletions;
    private symbolKindToCompletionKind;
    private getDetailedDocumentation;
    private getSymbolAtPosition;
    private formatSymbolHover;
    private getFunctionCall;
    private findReferences;
    private getQuickFixes;
    private formatCode;
}
/**
 * Singleton instance
 */
export declare const languageServer: LanguageServer;
//# sourceMappingURL=LanguageServer.d.ts.map