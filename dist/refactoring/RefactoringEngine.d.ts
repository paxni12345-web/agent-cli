/**
 * Code Refactoring Engine
 * Extract methods, rename symbols, inline variables, move code, and automated refactoring
 */
export interface RefactoringOperation {
    id: string;
    type: RefactoringType;
    file: string;
    description: string;
    changes: CodeChange[];
    status: 'pending' | 'applied' | 'reverted';
    appliedAt?: Date;
    revertedAt?: Date;
}
export type RefactoringType = 'extract_method' | 'extract_variable' | 'inline_method' | 'inline_variable' | 'rename_symbol' | 'move_code' | 'change_signature' | 'introduce_parameter' | 'remove_parameter' | 'pull_up_method' | 'push_down_method' | 'extract_interface' | 'extract_class';
export interface CodeChange {
    file: string;
    startLine: number;
    endLine: number;
    oldCode: string;
    newCode: string;
    type: 'insert' | 'delete' | 'replace';
}
export interface RefactoringContext {
    file: string;
    code: string;
    selection?: {
        startLine: number;
        endLine: number;
        startColumn: number;
        endColumn: number;
    };
    symbolName?: string;
    newName?: string;
}
export interface ExtractMethodOptions {
    methodName: string;
    parameters?: string[];
    returnType?: string;
    isAsync?: boolean;
    isStatic?: boolean;
}
export interface RenameSymbolOptions {
    newName: string;
    updateReferences?: boolean;
    updateComments?: boolean;
}
export interface MoveCodeOptions {
    targetFile: string;
    targetLine?: number;
    createImports?: boolean;
}
/**
 * Refactoring Engine
 */
export declare class RefactoringEngine {
    private operations;
    private undoStack;
    private redoStack;
    /**
     * Extract method from selected code
     */
    extractMethod(context: RefactoringContext, options: ExtractMethodOptions): RefactoringOperation;
    /**
     * Extract variable from expression
     */
    extractVariable(context: RefactoringContext, variableName: string, isConst?: boolean): RefactoringOperation;
    /**
     * Inline method
     */
    inlineMethod(context: RefactoringContext): RefactoringOperation;
    /**
     * Inline variable
     */
    inlineVariable(context: RefactoringContext): RefactoringOperation;
    /**
     * Rename symbol
     */
    renameSymbol(context: RefactoringContext, options: RenameSymbolOptions): RefactoringOperation;
    /**
     * Move code to another file
     */
    moveCode(context: RefactoringContext, options: MoveCodeOptions): RefactoringOperation;
    /**
     * Apply refactoring operation
     */
    apply(operationId: string): void;
    /**
     * Revert refactoring operation
     */
    revert(operationId: string): void;
    /**
     * Undo last operation
     */
    undo(): void;
    /**
     * Redo last undone operation
     */
    redo(): void;
    /**
     * Get operation
     */
    getOperation(operationId: string): RefactoringOperation | undefined;
    /**
     * List operations
     */
    listOperations(filter?: {
        file?: string;
        status?: RefactoringOperation['status'];
    }): RefactoringOperation[];
    private getSelectedCode;
    private extractVariables;
    private isKeyword;
    private indentCode;
    private findInsertionPoint;
    private findMethodDefinition;
    private findMethodCalls;
    private inlineMethodCall;
    private findVariableDeclaration;
    private findVariableUsages;
    private findAllReferences;
    private findLocalReferences;
    private findDependencies;
    private generateImportStatement;
    private applyChange;
    private revertChange;
    private generateOperationId;
}
/**
 * Code Smell Detector
 */
export declare class CodeSmellDetector {
    /**
     * Detect code smells
     */
    detectSmells(code: string, file: string): CodeSmell[];
    private detectLongMethod;
    private detectLongParameterList;
    private detectDuplicateCode;
    private detectLargeClass;
    private detectDeadCode;
    private getLineNumber;
}
export interface CodeSmell {
    type: string;
    severity: 'low' | 'medium' | 'high';
    file: string;
    line: number;
    description: string;
    suggestion: string;
}
/**
 * Refactoring Suggester
 */
export declare class RefactoringSuggester {
    private detector;
    /**
     * Suggest refactorings for file
     */
    suggestRefactorings(code: string, file: string): RefactoringSuggestion[];
    private suggestForSmell;
}
export interface RefactoringSuggestion {
    type: RefactoringType;
    priority: 'low' | 'medium' | 'high';
    description: string;
    smell: CodeSmell;
}
/**
 * Singleton instances
 */
export declare const refactoringEngine: RefactoringEngine;
export declare const codeSmellDetector: CodeSmellDetector;
export declare const refactoringSuggester: RefactoringSuggester;
//# sourceMappingURL=RefactoringEngine.d.ts.map