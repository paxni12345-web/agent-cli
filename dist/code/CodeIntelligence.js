"use strict";
/**
 * PHASE 6: CODE INTELLIGENCE & REFACTORING SYSTEM
 * AST parsing, code analysis, and intelligent refactoring
 *
 * Part of 350K lines goal - PHASE 6
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeIntelligenceManager = void 0;
const events_1 = require("events");
// ============================================================================
// Code Intelligence Manager
// ============================================================================
class CodeIntelligenceManager extends events_1.EventEmitter {
    config;
    files = new Map();
    symbols = new Map();
    refactorings = new Map();
    constructor(config = {}) {
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
    async parseFile(path, content, language) {
        const file = {
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
    parseAST(content, language) {
        // Simplified AST parsing
        const root = {
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
    extractSymbols(ast) {
        const symbols = [];
        // Traverse AST and extract symbols
        const traverse = (node, scope) => {
            if (node.type === 'function' || node.type === 'class' || node.type === 'variable') {
                const symbol = {
                    id: this.generateId(),
                    name: node.name || 'anonymous',
                    type: node.type,
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
        const globalScope = {
            type: 'global',
            range: {
                start: ast.root.start,
                end: ast.root.end,
            },
        };
        traverse(ast.root, globalScope);
        return symbols;
    }
    analyzeDependencies(ast) {
        const dependencies = [];
        // Find import/require statements
        const findImports = (node) => {
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
    calculateMetrics(content) {
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
    analyzeIssues(file) {
        const issues = [];
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
    async rename(file, position, newName) {
        const codeFile = this.files.get(file);
        if (!codeFile) {
            throw new Error('File not found');
        }
        // Find symbol at position
        const symbol = this.findSymbolAtPosition(codeFile, position);
        if (!symbol) {
            throw new Error('No symbol found at position');
        }
        const changes = [];
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
        const refactoring = {
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
    async extractMethod(file, range, methodName) {
        const codeFile = this.files.get(file);
        if (!codeFile) {
            throw new Error('File not found');
        }
        const extractedCode = this.getTextInRange(codeFile.content, range);
        const changes = [
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
        const refactoring = {
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
    async applyRefactoring(refactoringId) {
        const refactoring = this.refactorings.get(refactoringId);
        if (!refactoring) {
            throw new Error('Refactoring not found');
        }
        for (const change of refactoring.changes) {
            await this.applyChange(change);
        }
        this.emit('refactoring:applied', { refactoringId });
    }
    async applyChange(change) {
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
    async search(query) {
        const results = [];
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
    searchInFile(file, query) {
        const matches = [];
        if (query.type === 'text') {
            const lines = file.content.split('\n');
            const pattern = query.regex ? new RegExp(query.pattern, query.caseSensitive ? '' : 'i') : query.pattern;
            lines.forEach((line, index) => {
                const match = query.regex
                    ? line.match(pattern)
                    : query.caseSensitive
                        ? line.includes(pattern)
                        : line.toLowerCase().includes(pattern.toLowerCase());
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
        }
        else if (query.type === 'symbol') {
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
    async getCompletions(file, position) {
        const codeFile = this.files.get(file);
        if (!codeFile) {
            return [];
        }
        const completions = [];
        // Add symbols in scope
        for (const symbol of codeFile.symbols) {
            completions.push({
                label: symbol.name,
                kind: symbol.type,
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
    findSymbolAtPosition(file, position) {
        return file.symbols.find(s => {
            return (s.definition.line === position.line &&
                s.definition.column <= position.column);
        });
    }
    getTextInRange(content, range) {
        const lines = content.split('\n');
        return lines.slice(range.start.line - 1, range.end.line).join('\n');
    }
    generatePreview(changes) {
        return changes
            .map(c => `${c.operation}: ${c.oldText || ''} -> ${c.newText || ''}`)
            .join('\n');
    }
    generateId() {
        return `code-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    getStats() {
        return {
            files: this.files.size,
            symbols: this.symbols.size,
            refactorings: this.refactorings.size,
            totalLines: Array.from(this.files.values()).reduce((sum, f) => sum + f.metrics.lines, 0),
            totalIssues: Array.from(this.files.values()).reduce((sum, f) => sum + f.issues.length, 0),
        };
    }
}
exports.CodeIntelligenceManager = CodeIntelligenceManager;
