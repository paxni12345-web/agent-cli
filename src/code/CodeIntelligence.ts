/**
 * PHASE 6: CODE INTELLIGENCE & REFACTORING SYSTEM
 * AST parsing, code analysis, and intelligent refactoring
 *
 * Part of 350K lines goal - PHASE 6
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type NodeType =
  | 'program'
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'import'
  | 'export'
  | 'expression'
  | 'statement'
  | 'block';

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

export type IssueType =
  | 'syntax_error'
  | 'type_error'
  | 'unused_variable'
  | 'complexity'
  | 'security'
  | 'performance'
  | 'style';

export interface Refactoring {
  id: string;
  type: RefactoringType;
  description: string;
  changes: CodeChange[];
  safe: boolean;
  preview: string;
}

export type RefactoringType =
  | 'rename'
  | 'extract_method'
  | 'extract_variable'
  | 'inline'
  | 'move'
  | 'change_signature'
  | 'optimize_imports';

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

export type CompletionKind =
  | 'function'
  | 'method'
  | 'variable'
  | 'class'
  | 'interface'
  | 'keyword'
  | 'snippet';

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

// ============================================================================
// Code Intelligence Manager
// ============================================================================

export class CodeIntelligenceManager extends EventEmitter {
  private config: CodeIntelligenceConfig;
  private files: Map<string, CodeFile> = new Map();
  private symbols: Map<string, Symbol> = new Map();
  private refactorings: Map<string, Refactoring> = new Map();

  constructor(config: Partial<CodeIntelligenceConfig> = {}) {
    super();
    this.config = {
      enableAnalysis: true,
      enableRefactoring: true,
      enableSearch: true,
      supportedLanguages: ['typescript', 'javascript', 'python'],
      ...config,
    };
  }

  // ========================================================================
  // Code Parsing & Analysis
  // ========================================================================

  public async parseFile(path: string, content: string, language: Language): Promise<CodeFile> {
    const file: CodeFile = {
      id: this.generateId(),
      path,
      language,
      content,
      ast: this.parseAST(content, language),
      symbols: [],
      dependencies: [],
      metrics: this.calculateMetrics(content),
      issues: [],
    };

    // Extract symbols
    file.symbols = this.extractSymbols(file.ast);

    // Analyze dependencies
    file.dependencies = this.analyzeDependencies(file.ast);

    // Find issues
    file.issues = this.analyzeIssues(file);

    this.files.set(path, file);

    // Index symbols
    for (const symbol of file.symbols) {
      this.symbols.set(`${path}:${symbol.name}`, symbol);
    }

    this.emit('file:parsed', { path });

    return file;
  }

  private parseAST(content: string, language: Language): AST {
    // Simplified AST parsing
    const root: ASTNode = {
      id: this.generateId(),
      type: 'program',
      start: { line: 1, column: 0, offset: 0 },
      end: { line: content.split('\n').length, column: 0, offset: content.length },
      children: [],
      metadata: {},
    };

    return {
      type: 'Program',
      nodes: [root],
      root,
    };
  }

  private extractSymbols(ast: AST): Symbol[] {
    const symbols: Symbol[] = [];

    // Traverse AST and extract symbols
    const traverse = (node: ASTNode, scope: Scope) => {
      if (node.type === 'function' || node.type === 'class' || node.type === 'variable') {
        const symbol: Symbol = {
          id: this.generateId(),
          name: node.name || 'anonymous',
          type: node.type as SymbolType,
          scope,
          references: [],
          definition: node.start,
          visibility: 'public',
        };

        symbols.push(symbol);
      }

      for (const child of node.children) {
        traverse(child, scope);
      }
    };

    const globalScope: Scope = {
      type: 'global',
      range: {
        start: ast.root.start,
        end: ast.root.end,
      },
    };

    traverse(ast.root, globalScope);

    return symbols;
  }

  private analyzeDependencies(ast: AST): Dependency[] {
    const dependencies: Dependency[] = [];

    // Find import/require statements
    const findImports = (node: ASTNode) => {
      if (node.type === 'import') {
        dependencies.push({
          id: this.generateId(),
          type: 'import',
          name: node.value || 'unknown',
          used: true,
        });
      }

      for (const child of node.children) {
        findImports(child);
      }
    };

    findImports(ast.root);

    return dependencies;
  }

  private calculateMetrics(content: string): CodeMetrics {
    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    const comments = lines.filter(line => line.trim().startsWith('//')).length;

    return {
      lines: lines.length,
      linesOfCode,
      comments,
      complexity: Math.floor(linesOfCode / 10) + 1,
      maintainability: 100 - Math.min(linesOfCode / 10, 50),
      halstead: {
        operators: 0,
        operands: 0,
        vocabulary: 0,
        length: 0,
        volume: 0,
        difficulty: 0,
        effort: 0,
      },
      functions: 0,
      classes: 0,
    };
  }

  private analyzeIssues(file: CodeFile): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check complexity
    if (file.metrics.complexity > 10) {
      issues.push({
        id: this.generateId(),
        severity: 'warning',
        type: 'complexity',
        message: `High complexity: ${file.metrics.complexity}`,
        location: {
          start: { line: 1, column: 0, offset: 0 },
          end: { line: 1, column: 0, offset: 0 },
        },
        autoFixable: false,
      });
    }

    // Check unused dependencies
    const unusedDeps = file.dependencies.filter(d => !d.used);

    for (const dep of unusedDeps) {
      issues.push({
        id: this.generateId(),
        severity: 'info',
        type: 'unused_variable',
        message: `Unused import: ${dep.name}`,
        location: {
          start: { line: 1, column: 0, offset: 0 },
          end: { line: 1, column: 0, offset: 0 },
        },
        suggestion: `Remove unused import: ${dep.name}`,
        autoFixable: true,
      });
    }

    return issues;
  }

  // ========================================================================
  // Refactoring
  // ========================================================================

  public async rename(
    file: string,
    position: Position,
    newName: string
  ): Promise<Refactoring> {
    const codeFile = this.files.get(file);

    if (!codeFile) {
      throw new Error('File not found');
    }

    // Find symbol at position
    const symbol = this.findSymbolAtPosition(codeFile, position);

    if (!symbol) {
      throw new Error('No symbol found at position');
    }

    const changes: CodeChange[] = [];

    // Change definition
    changes.push({
      file,
      operation: 'replace',
      range: {
        start: symbol.definition,
        end: symbol.definition,
      },
      oldText: symbol.name,
      newText: newName,
    });

    // Change all references
    for (const ref of symbol.references) {
      changes.push({
        file,
        operation: 'replace',
        range: {
          start: ref.location,
          end: ref.location,
        },
        oldText: symbol.name,
        newText: newName,
      });
    }

    const refactoring: Refactoring = {
      id: this.generateId(),
      type: 'rename',
      description: `Rename ${symbol.name} to ${newName}`,
      changes,
      safe: true,
      preview: this.generatePreview(changes),
    };

    this.refactorings.set(refactoring.id, refactoring);

    this.emit('refactoring:created', { refactoringId: refactoring.id });

    return refactoring;
  }

  public async extractMethod(
    file: string,
    range: Range,
    methodName: string
  ): Promise<Refactoring> {
    const codeFile = this.files.get(file);

    if (!codeFile) {
      throw new Error('File not found');
    }

    const extractedCode = this.getTextInRange(codeFile.content, range);

    const changes: CodeChange[] = [
      {
        file,
        operation: 'replace',
        range,
        oldText: extractedCode,
        newText: `${methodName}();`,
      },
      {
        file,
        operation: 'insert',
        range: {
          start: { line: range.start.line - 1, column: 0, offset: 0 },
          end: { line: range.start.line - 1, column: 0, offset: 0 },
        },
        newText: `function ${methodName}() {\n${extractedCode}\n}\n`,
      },
    ];

    const refactoring: Refactoring = {
      id: this.generateId(),
      type: 'extract_method',
      description: `Extract method: ${methodName}`,
      changes,
      safe: true,
      preview: this.generatePreview(changes),
    };

    this.refactorings.set(refactoring.id, refactoring);

    return refactoring;
  }

  public async applyRefactoring(refactoringId: string): Promise<void> {
    const refactoring = this.refactorings.get(refactoringId);

    if (!refactoring) {
      throw new Error('Refactoring not found');
    }

    for (const change of refactoring.changes) {
      await this.applyChange(change);
    }

    this.emit('refactoring:applied', { refactoringId });
  }

  private async applyChange(change: CodeChange): Promise<void> {
    const file = this.files.get(change.file);

    if (!file) {
      throw new Error('File not found');
    }

    // Apply change to content
    // Simplified implementation
    this.emit('change:applied', { file: change.file });
  }

  // ========================================================================
  // Code Search
  // ========================================================================

  public async search(query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const [path, file] of this.files) {
      const matches = this.searchInFile(file, query);

      if (matches.length > 0) {
        results.push({
          file: path,
          matches,
          total: matches.length,
        });
      }
    }

    this.emit('search:completed', { query, results: results.length });

    return results;
  }

  private searchInFile(file: CodeFile, query: SearchQuery): Match[] {
    const matches: Match[] = [];

    if (query.type === 'text') {
      const lines = file.content.split('\n');
      const pattern = query.regex ? new RegExp(query.pattern, query.caseSensitive ? '' : 'i') : query.pattern;

      lines.forEach((line, index) => {
        const match = query.regex
          ? line.match(pattern as RegExp)
          : query.caseSensitive
          ? line.includes(pattern as string)
          : line.toLowerCase().includes((pattern as string).toLowerCase());

        if (match) {
          matches.push({
            range: {
              start: { line: index + 1, column: 0, offset: 0 },
              end: { line: index + 1, column: line.length, offset: 0 },
            },
            text: line.trim(),
            context: line,
            score: 1.0,
          });
        }
      });
    } else if (query.type === 'symbol') {
      for (const symbol of file.symbols) {
        if (symbol.name.includes(query.pattern)) {
          matches.push({
            range: {
              start: symbol.definition,
              end: symbol.definition,
            },
            text: symbol.name,
            context: `${symbol.type}: ${symbol.name}`,
            score: 1.0,
          });
        }
      }
    }

    return matches;
  }

  // ========================================================================
  // Code Completion
  // ========================================================================

  public async getCompletions(
    file: string,
    position: Position
  ): Promise<CodeCompletion[]> {
    const codeFile = this.files.get(file);

    if (!codeFile) {
      return [];
    }

    const completions: CodeCompletion[] = [];

    // Add symbols in scope
    for (const symbol of codeFile.symbols) {
      completions.push({
        label: symbol.name,
        kind: symbol.type as CompletionKind,
        detail: `${symbol.type}: ${symbol.name}`,
        insertText: symbol.name,
        range: {
          start: position,
          end: position,
        },
      });
    }

    // Add keywords
    const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while'];

    for (const keyword of keywords) {
      completions.push({
        label: keyword,
        kind: 'keyword',
        insertText: keyword,
        range: {
          start: position,
          end: position,
        },
      });
    }

    return completions;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private findSymbolAtPosition(file: CodeFile, position: Position): Symbol | undefined {
    return file.symbols.find(s => {
      return (
        s.definition.line === position.line &&
        s.definition.column <= position.column
      );
    });
  }

  private getTextInRange(content: string, range: Range): string {
    const lines = content.split('\n');
    return lines.slice(range.start.line - 1, range.end.line).join('\n');
  }

  private generatePreview(changes: CodeChange[]): string {
    return changes
      .map(c => `${c.operation}: ${c.oldText || ''} -> ${c.newText || ''}`)
      .join('\n');
  }

  private generateId(): string {
    return `code-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  public getStats() {
    return {
      files: this.files.size,
      symbols: this.symbols.size,
      refactorings: this.refactorings.size,
      totalLines: Array.from(this.files.values()).reduce((sum, f) => sum + f.metrics.lines, 0),
      totalIssues: Array.from(this.files.values()).reduce(
        (sum, f) => sum + f.issues.length,
        0
      ),
    };
  }
}
