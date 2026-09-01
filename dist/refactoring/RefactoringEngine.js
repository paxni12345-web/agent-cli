"use strict";
/**
 * Code Refactoring Engine
 * Extract methods, rename symbols, inline variables, move code, and automated refactoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.refactoringSuggester = exports.codeSmellDetector = exports.refactoringEngine = exports.RefactoringSuggester = exports.CodeSmellDetector = exports.RefactoringEngine = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * Refactoring Engine
 */
class RefactoringEngine {
    operations = new Map();
    undoStack = [];
    redoStack = [];
    /**
     * Extract method from selected code
     */
    extractMethod(context, options) {
        if (!context.selection) {
            throw new Error('Selection is required for extract method');
        }
        const selectedCode = this.getSelectedCode(context);
        const variables = this.extractVariables(selectedCode);
        const parameters = options.parameters || variables.used;
        const returnValue = variables.modified.length > 0 ? variables.modified[0] : undefined;
        // Build method signature
        const paramList = parameters.join(', ');
        const returnType = options.returnType || (returnValue ? 'any' : 'void');
        const asyncKeyword = options.isAsync ? 'async ' : '';
        const staticKeyword = options.isStatic ? 'static ' : '';
        // Build method code
        const methodCode = `
${staticKeyword}${asyncKeyword}${options.methodName}(${paramList}): ${returnType} {
${this.indentCode(selectedCode, 2)}
${returnValue ? `  return ${returnValue};` : ''}
}`.trim();
        // Build method call
        const awaitKeyword = options.isAsync ? 'await ' : '';
        const methodCall = returnValue
            ? `const ${returnValue} = ${awaitKeyword}this.${options.methodName}(${parameters.join(', ')});`
            : `${awaitKeyword}this.${options.methodName}(${parameters.join(', ')});`;
        const changes = [
            {
                file: context.file,
                startLine: context.selection.startLine,
                endLine: context.selection.endLine,
                oldCode: selectedCode,
                newCode: methodCall,
                type: 'replace',
            },
            {
                file: context.file,
                startLine: this.findInsertionPoint(context),
                endLine: this.findInsertionPoint(context),
                oldCode: '',
                newCode: methodCode,
                type: 'insert',
            },
        ];
        const operation = {
            id: this.generateOperationId(),
            type: 'extract_method',
            file: context.file,
            description: `Extract method: ${options.methodName}`,
            changes,
            status: 'pending',
        };
        this.operations.set(operation.id, operation);
        EventBus_1.eventBus.emitSync('refactoring.extract_method', operation, 'RefactoringEngine');
        return operation;
    }
    /**
     * Extract variable from expression
     */
    extractVariable(context, variableName, isConst = true) {
        if (!context.selection) {
            throw new Error('Selection is required for extract variable');
        }
        const selectedCode = this.getSelectedCode(context);
        const keyword = isConst ? 'const' : 'let';
        const declaration = `${keyword} ${variableName} = ${selectedCode};`;
        const changes = [
            {
                file: context.file,
                startLine: context.selection.startLine - 1,
                endLine: context.selection.startLine - 1,
                oldCode: '',
                newCode: declaration,
                type: 'insert',
            },
            {
                file: context.file,
                startLine: context.selection.startLine,
                endLine: context.selection.endLine,
                oldCode: selectedCode,
                newCode: variableName,
                type: 'replace',
            },
        ];
        const operation = {
            id: this.generateOperationId(),
            type: 'extract_variable',
            file: context.file,
            description: `Extract variable: ${variableName}`,
            changes,
            status: 'pending',
        };
        this.operations.set(operation.id, operation);
        EventBus_1.eventBus.emitSync('refactoring.extract_variable', operation, 'RefactoringEngine');
        return operation;
    }
    /**
     * Inline method
     */
    inlineMethod(context) {
        if (!context.symbolName) {
            throw new Error('Symbol name is required for inline method');
        }
        // Find method definition
        const methodDef = this.findMethodDefinition(context);
        if (!methodDef) {
            throw new Error(`Method not found: ${context.symbolName}`);
        }
        // Find all method calls
        const calls = this.findMethodCalls(context, context.symbolName);
        const changes = [
            // Remove method definition
            {
                file: context.file,
                startLine: methodDef.startLine,
                endLine: methodDef.endLine,
                oldCode: methodDef.code,
                newCode: '',
                type: 'delete',
            },
            // Replace all calls with method body
            ...calls.map(call => ({
                file: context.file,
                startLine: call.line,
                endLine: call.line,
                oldCode: call.code,
                newCode: this.inlineMethodCall(methodDef.body, call.args),
                type: 'replace',
            })),
        ];
        const operation = {
            id: this.generateOperationId(),
            type: 'inline_method',
            file: context.file,
            description: `Inline method: ${context.symbolName}`,
            changes,
            status: 'pending',
        };
        this.operations.set(operation.id, operation);
        EventBus_1.eventBus.emitSync('refactoring.inline_method', operation, 'RefactoringEngine');
        return operation;
    }
    /**
     * Inline variable
     */
    inlineVariable(context) {
        if (!context.symbolName) {
            throw new Error('Symbol name is required for inline variable');
        }
        // Find variable declaration
        const varDef = this.findVariableDeclaration(context, context.symbolName);
        if (!varDef) {
            throw new Error(`Variable not found: ${context.symbolName}`);
        }
        // Find all variable usages
        const usages = this.findVariableUsages(context, context.symbolName);
        const changes = [
            // Remove variable declaration
            {
                file: context.file,
                startLine: varDef.line,
                endLine: varDef.line,
                oldCode: varDef.code,
                newCode: '',
                type: 'delete',
            },
            // Replace all usages with value
            ...usages.map(usage => ({
                file: context.file,
                startLine: usage.line,
                endLine: usage.line,
                oldCode: context.symbolName,
                newCode: varDef.value,
                type: 'replace',
            })),
        ];
        const operation = {
            id: this.generateOperationId(),
            type: 'inline_variable',
            file: context.file,
            description: `Inline variable: ${context.symbolName}`,
            changes,
            status: 'pending',
        };
        this.operations.set(operation.id, operation);
        EventBus_1.eventBus.emitSync('refactoring.inline_variable', operation, 'RefactoringEngine');
        return operation;
    }
    /**
     * Rename symbol
     */
    renameSymbol(context, options) {
        if (!context.symbolName) {
            throw new Error('Symbol name is required for rename');
        }
        const references = options.updateReferences
            ? this.findAllReferences(context, context.symbolName)
            : this.findLocalReferences(context, context.symbolName);
        const changes = references.map(ref => ({
            file: ref.file,
            startLine: ref.line,
            endLine: ref.line,
            oldCode: context.symbolName,
            newCode: options.newName,
            type: 'replace',
        }));
        const operation = {
            id: this.generateOperationId(),
            type: 'rename_symbol',
            file: context.file,
            description: `Rename: ${context.symbolName} → ${options.newName}`,
            changes,
            status: 'pending',
        };
        this.operations.set(operation.id, operation);
        EventBus_1.eventBus.emitSync('refactoring.rename_symbol', operation, 'RefactoringEngine');
        return operation;
    }
    /**
     * Move code to another file
     */
    moveCode(context, options) {
        if (!context.selection) {
            throw new Error('Selection is required for move code');
        }
        const selectedCode = this.getSelectedCode(context);
        const dependencies = this.findDependencies(selectedCode);
        const changes = [
            // Remove from source file
            {
                file: context.file,
                startLine: context.selection.startLine,
                endLine: context.selection.endLine,
                oldCode: selectedCode,
                newCode: '',
                type: 'delete',
            },
            // Add to target file
            {
                file: options.targetFile,
                startLine: options.targetLine || 0,
                endLine: options.targetLine || 0,
                oldCode: '',
                newCode: selectedCode,
                type: 'insert',
            },
        ];
        // Add imports if needed
        if (options.createImports && dependencies.length > 0) {
            const importStatement = this.generateImportStatement(dependencies, context.file, options.targetFile);
            changes.push({
                file: options.targetFile,
                startLine: 0,
                endLine: 0,
                oldCode: '',
                newCode: importStatement,
                type: 'insert',
            });
        }
        const operation = {
            id: this.generateOperationId(),
            type: 'move_code',
            file: context.file,
            description: `Move code to ${options.targetFile}`,
            changes,
            status: 'pending',
        };
        this.operations.set(operation.id, operation);
        EventBus_1.eventBus.emitSync('refactoring.move_code', operation, 'RefactoringEngine');
        return operation;
    }
    /**
     * Apply refactoring operation
     */
    apply(operationId) {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new Error(`Operation not found: ${operationId}`);
        }
        if (operation.status === 'applied') {
            throw new Error('Operation already applied');
        }
        // Apply all changes
        for (const change of operation.changes) {
            this.applyChange(change);
        }
        operation.status = 'applied';
        operation.appliedAt = new Date();
        this.undoStack.push(operation);
        this.redoStack = []; // Clear redo stack
        EventBus_1.eventBus.emitSync('refactoring.applied', operation, 'RefactoringEngine');
    }
    /**
     * Revert refactoring operation
     */
    revert(operationId) {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new Error(`Operation not found: ${operationId}`);
        }
        if (operation.status !== 'applied') {
            throw new Error('Operation not applied');
        }
        // Revert all changes in reverse order
        for (const change of operation.changes.reverse()) {
            this.revertChange(change);
        }
        operation.status = 'reverted';
        operation.revertedAt = new Date();
        EventBus_1.eventBus.emitSync('refactoring.reverted', operation, 'RefactoringEngine');
    }
    /**
     * Undo last operation
     */
    undo() {
        const operation = this.undoStack.pop();
        if (!operation) {
            throw new Error('Nothing to undo');
        }
        this.revert(operation.id);
        this.redoStack.push(operation);
    }
    /**
     * Redo last undone operation
     */
    redo() {
        const operation = this.redoStack.pop();
        if (!operation) {
            throw new Error('Nothing to redo');
        }
        this.apply(operation.id);
    }
    /**
     * Get operation
     */
    getOperation(operationId) {
        return this.operations.get(operationId);
    }
    /**
     * List operations
     */
    listOperations(filter) {
        let operations = Array.from(this.operations.values());
        if (filter?.file) {
            operations = operations.filter(op => op.file === filter.file);
        }
        if (filter?.status) {
            operations = operations.filter(op => op.status === filter.status);
        }
        return operations;
    }
    // Helper methods
    getSelectedCode(context) {
        if (!context.selection)
            return '';
        const lines = context.code.split('\n');
        return lines
            .slice(context.selection.startLine - 1, context.selection.endLine)
            .join('\n');
    }
    extractVariables(code) {
        // Simple variable extraction (in production, use proper AST parsing)
        const used = [];
        const modified = [];
        const varPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
        let match;
        while ((match = varPattern.exec(code)) !== null) {
            const varName = match[1];
            if (!used.includes(varName) && !this.isKeyword(varName)) {
                used.push(varName);
            }
        }
        return { used, modified };
    }
    isKeyword(word) {
        const keywords = ['const', 'let', 'var', 'function', 'if', 'else', 'for', 'while', 'return'];
        return keywords.includes(word);
    }
    indentCode(code, spaces) {
        const indent = ' '.repeat(spaces);
        return code.split('\n').map(line => indent + line).join('\n');
    }
    findInsertionPoint(context) {
        // Find end of current method/class
        return context.selection ? context.selection.endLine + 2 : 0;
    }
    findMethodDefinition(context) {
        // Mock implementation
        return null;
    }
    findMethodCalls(context, methodName) {
        // Mock implementation
        return [];
    }
    inlineMethodCall(methodBody, args) {
        // Mock implementation
        return methodBody;
    }
    findVariableDeclaration(context, varName) {
        // Mock implementation
        return null;
    }
    findVariableUsages(context, varName) {
        // Mock implementation
        return [];
    }
    findAllReferences(context, symbolName) {
        // Mock implementation
        return [];
    }
    findLocalReferences(context, symbolName) {
        // Mock implementation
        return [];
    }
    findDependencies(code) {
        // Mock implementation
        return [];
    }
    generateImportStatement(dependencies, sourceFile, targetFile) {
        return `import { ${dependencies.join(', ')} } from '${sourceFile}';\n`;
    }
    applyChange(change) {
        // Mock implementation - in production, actually modify files
        console.log('Applying change:', change);
    }
    revertChange(change) {
        // Mock implementation - in production, revert file changes
        console.log('Reverting change:', change);
    }
    generateOperationId() {
        return `refactor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.RefactoringEngine = RefactoringEngine;
/**
 * Code Smell Detector
 */
class CodeSmellDetector {
    /**
     * Detect code smells
     */
    detectSmells(code, file) {
        const smells = [];
        smells.push(...this.detectLongMethod(code, file));
        smells.push(...this.detectLongParameterList(code, file));
        smells.push(...this.detectDuplicateCode(code, file));
        smells.push(...this.detectLargeClass(code, file));
        smells.push(...this.detectDeadCode(code, file));
        return smells;
    }
    detectLongMethod(code, file) {
        const smells = [];
        const lines = code.split('\n');
        let inMethod = false;
        let methodStart = 0;
        let braceCount = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/^\s*(function|async\s+function|.*\(.*\)\s*{)/)) {
                inMethod = true;
                methodStart = i;
                braceCount = 1;
            }
            else if (inMethod) {
                braceCount += (line.match(/{/g) || []).length;
                braceCount -= (line.match(/}/g) || []).length;
                if (braceCount === 0) {
                    const methodLength = i - methodStart;
                    if (methodLength > 50) {
                        smells.push({
                            type: 'long_method',
                            severity: 'medium',
                            file,
                            line: methodStart + 1,
                            description: `Method is too long (${methodLength} lines)`,
                            suggestion: 'Consider extracting methods',
                        });
                    }
                    inMethod = false;
                }
            }
        }
        return smells;
    }
    detectLongParameterList(code, file) {
        const smells = [];
        const functionPattern = /function\s+\w+\((.*?)\)/g;
        let match;
        while ((match = functionPattern.exec(code)) !== null) {
            const params = match[1].split(',').filter(p => p.trim());
            if (params.length > 5) {
                smells.push({
                    type: 'long_parameter_list',
                    severity: 'low',
                    file,
                    line: this.getLineNumber(code, match.index),
                    description: `Function has too many parameters (${params.length})`,
                    suggestion: 'Consider using parameter object',
                });
            }
        }
        return smells;
    }
    detectDuplicateCode(code, file) {
        // Mock implementation
        return [];
    }
    detectLargeClass(code, file) {
        const lines = code.split('\n').length;
        if (lines > 500) {
            return [{
                    type: 'large_class',
                    severity: 'high',
                    file,
                    line: 1,
                    description: `Class is too large (${lines} lines)`,
                    suggestion: 'Consider splitting into multiple classes',
                }];
        }
        return [];
    }
    detectDeadCode(code, file) {
        // Mock implementation
        return [];
    }
    getLineNumber(code, index) {
        return code.substring(0, index).split('\n').length;
    }
}
exports.CodeSmellDetector = CodeSmellDetector;
/**
 * Refactoring Suggester
 */
class RefactoringSuggester {
    detector = new CodeSmellDetector();
    /**
     * Suggest refactorings for file
     */
    suggestRefactorings(code, file) {
        const smells = this.detector.detectSmells(code, file);
        const suggestions = [];
        for (const smell of smells) {
            suggestions.push(...this.suggestForSmell(smell));
        }
        return suggestions;
    }
    suggestForSmell(smell) {
        const suggestions = [];
        switch (smell.type) {
            case 'long_method':
                suggestions.push({
                    type: 'extract_method',
                    priority: 'medium',
                    description: 'Extract parts of this method into smaller methods',
                    smell,
                });
                break;
            case 'long_parameter_list':
                suggestions.push({
                    type: 'introduce_parameter',
                    priority: 'low',
                    description: 'Introduce parameter object',
                    smell,
                });
                break;
            case 'large_class':
                suggestions.push({
                    type: 'extract_class',
                    priority: 'high',
                    description: 'Extract class to split responsibilities',
                    smell,
                });
                break;
        }
        return suggestions;
    }
}
exports.RefactoringSuggester = RefactoringSuggester;
/**
 * Singleton instances
 */
exports.refactoringEngine = new RefactoringEngine();
exports.codeSmellDetector = new CodeSmellDetector();
exports.refactoringSuggester = new RefactoringSuggester();
