/**
 * Language Server Protocol (LSP) Implementation
 * Code completion, hover information, diagnostics, and symbol resolution
 */

import { eventBus } from '../core/EventBus';

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

export enum TextDocumentSyncKind {
  None = 0,
  Full = 1,
  Incremental = 2,
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

export enum CompletionItemKind {
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
  TypeParameter = 25,
}

export enum InsertTextFormat {
  PlainText = 1,
  Snippet = 2,
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

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
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

export enum SymbolKind {
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
  TypeParameter = 26,
}

export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  edit?: WorkspaceEdit;
  command?: Command;
}

export interface WorkspaceEdit {
  changes?: { [uri: string]: TextEdit[] };
  documentChanges?: TextDocumentEdit[];
}

export interface TextDocumentEdit {
  textDocument: { uri: string; version: number };
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
export class LanguageServer implements LSPServer {
  private documents: Map<string, TextDocument> = new Map();
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private symbols: Map<string, SymbolInformation[]> = new Map();
  private initialized = false;

  /**
   * Initialize server
   */
  initialize(params: InitializeParams): InitializeResult {
    this.initialized = true;

    eventBus.emitSync('lsp.initialized', params, 'LanguageServer');

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
  shutdown(): void {
    this.initialized = false;
    eventBus.emitSync('lsp.shutdown', {}, 'LanguageServer');
  }

  /**
   * Exit server
   */
  exit(): void {
    process.exit(0);
  }

  /**
   * Open document
   */
  didOpenTextDocument(params: { textDocument: TextDocument }): void {
    this.documents.set(params.textDocument.uri, params.textDocument);
    this.analyzeDocument(params.textDocument);
  }

  /**
   * Change document
   */
  didChangeTextDocument(params: {
    textDocument: { uri: string; version: number };
    contentChanges: Array<{ text: string }>;
  }): void {
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
  didCloseTextDocument(params: { textDocument: { uri: string } }): void {
    this.documents.delete(params.textDocument.uri);
    this.diagnostics.delete(params.textDocument.uri);
    this.symbols.delete(params.textDocument.uri);
  }

  /**
   * Get completions
   */
  completion(params: {
    textDocument: { uri: string };
    position: Position;
  }): CompletionItem[] {
    const doc = this.documents.get(params.textDocument.uri);

    if (!doc) return [];

    const line = doc.text.split('\n')[params.position.line];
    const prefix = line.substring(0, params.position.character);

    return this.getCompletions(doc, prefix, params.position);
  }

  /**
   * Resolve completion item
   */
  completionResolve(item: CompletionItem): CompletionItem {
    // Add detailed documentation
    if (item.data) {
      item.documentation = this.getDetailedDocumentation(item.data);
    }

    return item;
  }

  /**
   * Get hover information
   */
  hover(params: {
    textDocument: { uri: string };
    position: Position;
  }): Hover | null {
    const doc = this.documents.get(params.textDocument.uri);

    if (!doc) return null;

    const symbol = this.getSymbolAtPosition(doc, params.position);

    if (!symbol) return null;

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
  signatureHelp(params: {
    textDocument: { uri: string };
    position: Position;
  }): SignatureHelp | null {
    const doc = this.documents.get(params.textDocument.uri);

    if (!doc) return null;

    const functionCall = this.getFunctionCall(doc, params.position);

    if (!functionCall) return null;

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
  definition(params: {
    textDocument: { uri: string };
    position: Position;
  }): Location | null {
    const doc = this.documents.get(params.textDocument.uri);

    if (!doc) return null;

    const symbol = this.getSymbolAtPosition(doc, params.position);

    if (!symbol || !symbol.definition) return null;

    return symbol.definition;
  }

  /**
   * Find references
   */
  references(params: {
    textDocument: { uri: string };
    position: Position;
    context: { includeDeclaration: boolean };
  }): Location[] {
    const doc = this.documents.get(params.textDocument.uri);

    if (!doc) return [];

    const symbol = this.getSymbolAtPosition(doc, params.position);

    if (!symbol) return [];

    return this.findReferences(symbol.name, params.context.includeDeclaration);
  }

  /**
   * Get document symbols
   */
  documentSymbol(params: {
    textDocument: { uri: string };
  }): SymbolInformation[] {
    return this.symbols.get(params.textDocument.uri) || [];
  }

  /**
   * Get workspace symbols
   */
  workspaceSymbol(params: { query: string }): SymbolInformation[] {
    const allSymbols: SymbolInformation[] = [];

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
  codeAction(params: {
    textDocument: { uri: string };
    range: Range;
    context: { diagnostics: Diagnostic[] };
  }): CodeAction[] {
    const actions: CodeAction[] = [];

    for (const diagnostic of params.context.diagnostics) {
      actions.push(...this.getQuickFixes(diagnostic, params.textDocument.uri));
    }

    return actions;
  }

  /**
   * Format document
   */
  formatting(params: {
    textDocument: { uri: string };
    options: { tabSize: number; insertSpaces: boolean };
  }): TextEdit[] {
    const doc = this.documents.get(params.textDocument.uri);

    if (!doc) return [];

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
  rename(params: {
    textDocument: { uri: string };
    position: Position;
    newName: string;
  }): WorkspaceEdit | null {
    const doc = this.documents.get(params.textDocument.uri);

    if (!doc) return null;

    const symbol = this.getSymbolAtPosition(doc, params.position);

    if (!symbol) return null;

    const references = this.findReferences(symbol.name, true);
    const changes: { [uri: string]: TextEdit[] } = {};

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
  getDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) || [];
  }

  // Helper methods

  private analyzeDocument(doc: TextDocument): void {
    // Parse and analyze
    const diagnostics = this.lint(doc);
    const symbols = this.extractSymbols(doc);

    this.diagnostics.set(doc.uri, diagnostics);
    this.symbols.set(doc.uri, symbols);

    eventBus.emitSync('lsp.document_analyzed', { uri: doc.uri }, 'LanguageServer');
  }

  private lint(doc: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
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

  private extractSymbols(doc: TextDocument): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];
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

  private getCompletions(doc: TextDocument, prefix: string, position: Position): CompletionItem[] {
    const completions: CompletionItem[] = [];

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

  private symbolKindToCompletionKind(kind: SymbolKind): CompletionItemKind {
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

  private getDetailedDocumentation(data: any): string {
    return 'Detailed documentation for this symbol';
  }

  private getSymbolAtPosition(doc: TextDocument, position: Position): any {
    // Mock implementation
    return null;
  }

  private formatSymbolHover(symbol: any): string {
    return `**${symbol.name}**\n\n${symbol.documentation || 'No documentation available'}`;
  }

  private getFunctionCall(doc: TextDocument, position: Position): any {
    // Mock implementation
    return null;
  }

  private findReferences(symbolName: string, includeDeclaration: boolean): Location[] {
    // Mock implementation
    return [];
  }

  private getQuickFixes(diagnostic: Diagnostic, uri: string): CodeAction[] {
    const actions: CodeAction[] = [];

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

  private formatCode(code: string, options: { tabSize: number; insertSpaces: boolean }): string {
    // Simple formatting (in production, use a proper formatter)
    return code;
  }
}

/**
 * Singleton instance
 */
export const languageServer = new LanguageServer();
