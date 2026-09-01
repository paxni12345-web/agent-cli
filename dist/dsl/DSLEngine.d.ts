/**
 * Custom Domain-Specific Language (DSL) Support
 * DSL parser, compiler, interpreter, and runtime for custom automation languages
 */
export interface DSLDefinition {
    id: string;
    name: string;
    version: string;
    description: string;
    grammar: Grammar;
    semantics: SemanticRules;
    builtins: Record<string, BuiltinFunction>;
    extensions: Extension[];
}
export interface Grammar {
    tokens: TokenDefinition[];
    rules: GrammarRule[];
    operators: OperatorDefinition[];
    keywords: string[];
    comments: CommentStyle;
}
export interface TokenDefinition {
    name: string;
    pattern: string | RegExp;
    priority: number;
    skip?: boolean;
}
export interface GrammarRule {
    name: string;
    pattern: string;
    precedence?: number;
    associativity?: 'left' | 'right' | 'none';
}
export interface OperatorDefinition {
    symbol: string;
    precedence: number;
    associativity: 'left' | 'right';
    arity: 'unary' | 'binary';
}
export interface CommentStyle {
    line?: string;
    blockStart?: string;
    blockEnd?: string;
}
export interface SemanticRules {
    typeSystem: TypeSystem;
    scoping: ScopingRules;
    evaluation: EvaluationStrategy;
}
export interface TypeSystem {
    types: TypeDefinition[];
    inference: boolean;
    strict: boolean;
}
export interface TypeDefinition {
    name: string;
    kind: 'primitive' | 'composite' | 'function' | 'generic';
    properties?: Record<string, string>;
    parameters?: string[];
}
export interface ScopingRules {
    type: 'lexical' | 'dynamic';
    allowShadowing: boolean;
    hoisting: boolean;
}
export declare enum EvaluationStrategy {
    Eager = "eager",
    Lazy = "lazy",
    Hybrid = "hybrid"
}
export interface BuiltinFunction {
    name: string;
    signature: FunctionSignature;
    implementation: (...args: any[]) => any;
}
export interface FunctionSignature {
    parameters: Parameter[];
    returnType: string;
    variadic?: boolean;
}
export interface Parameter {
    name: string;
    type: string;
    optional?: boolean;
    defaultValue?: any;
}
export interface Extension {
    name: string;
    version: string;
    provides: string[];
    dependencies: string[];
}
export interface AST {
    type: string;
    value?: any;
    children: AST[];
    location: SourceLocation;
    metadata?: Record<string, any>;
}
export interface SourceLocation {
    start: Position;
    end: Position;
    source?: string;
}
export interface Position {
    line: number;
    column: number;
    offset: number;
}
export interface Token {
    type: string;
    value: string;
    location: SourceLocation;
}
export interface CompilationResult {
    success: boolean;
    ast?: AST;
    bytecode?: Bytecode;
    errors: CompilationError[];
    warnings: CompilationWarning[];
}
export interface CompilationError {
    message: string;
    location: SourceLocation;
    severity: 'error' | 'fatal';
    code?: string;
}
export interface CompilationWarning {
    message: string;
    location: SourceLocation;
    code?: string;
}
export interface Bytecode {
    instructions: Instruction[];
    constants: any[];
    symbols: SymbolTable;
}
export interface Instruction {
    opcode: Opcode;
    operands: number[];
    location?: SourceLocation;
}
export declare enum Opcode {
    PUSH = "PUSH",
    POP = "POP",
    DUP = "DUP",
    SWAP = "SWAP",
    ADD = "ADD",
    SUB = "SUB",
    MUL = "MUL",
    DIV = "DIV",
    MOD = "MOD",
    EQ = "EQ",
    NEQ = "NEQ",
    LT = "LT",
    LTE = "LTE",
    GT = "GT",
    GTE = "GTE",
    AND = "AND",
    OR = "OR",
    NOT = "NOT",
    JUMP = "JUMP",
    JUMP_IF = "JUMP_IF",
    JUMP_IF_NOT = "JUMP_IF_NOT",
    CALL = "CALL",
    RETURN = "RETURN",
    LOAD = "LOAD",
    STORE = "STORE",
    LOAD_GLOBAL = "LOAD_GLOBAL",
    STORE_GLOBAL = "STORE_GLOBAL",
    LOAD_ATTR = "LOAD_ATTR",
    STORE_ATTR = "STORE_ATTR",
    LOAD_INDEX = "LOAD_INDEX",
    STORE_INDEX = "STORE_INDEX",
    MAKE_FUNCTION = "MAKE_FUNCTION",
    MAKE_CLOSURE = "MAKE_CLOSURE",
    HALT = "HALT",
    PRINT = "PRINT"
}
export interface SymbolTable {
    symbols: Map<string, Symbol>;
    parent?: SymbolTable;
}
export interface Symbol {
    name: string;
    type: string;
    kind: 'variable' | 'function' | 'class' | 'constant';
    scope: string;
    location: SourceLocation;
}
export interface RuntimeContext {
    stack: any[];
    globals: Map<string, any>;
    locals: Map<string, any>[];
    callStack: CallFrame[];
    heap: Map<number, any>;
}
export interface CallFrame {
    function: string;
    returnAddress: number;
    locals: Map<string, any>;
}
/**
 * DSL Lexer
 */
export declare class DSLLexer {
    private definition;
    private tokens;
    private position;
    private line;
    private column;
    constructor(definition: DSLDefinition);
    /**
     * Tokenize source code
     */
    tokenize(source: string): Token[];
    private nextToken;
    private shouldSkip;
}
/**
 * DSL Parser
 */
export declare class DSLParser {
    private definition;
    private tokens;
    private position;
    constructor(definition: DSLDefinition);
    /**
     * Parse tokens into AST
     */
    parse(tokens: Token[]): AST;
    private parseProgram;
    private parseStatement;
    private parseKeywordStatement;
    private parseIfStatement;
    private parseWhileStatement;
    private parseForStatement;
    private parseFunctionDeclaration;
    private parseReturnStatement;
    private parseBlock;
    private parseExpression;
    private parseBinaryExpression;
    private parsePrimaryExpression;
    private match;
    private check;
    private advance;
    private isAtEnd;
    private peek;
    private previous;
    private consume;
    private getLocation;
}
/**
 * DSL Compiler
 */
export declare class DSLCompiler {
    private definition;
    private constants;
    private instructions;
    private symbols;
    constructor(definition: DSLDefinition);
    /**
     * Compile AST to bytecode
     */
    compile(ast: AST): CompilationResult;
    private compileNode;
    private compileLiteral;
    private compileIdentifier;
    private compileBinaryExpression;
    private compileIfStatement;
    private compileWhileStatement;
    private compileFunctionDeclaration;
    private compileReturnStatement;
    private emit;
    private patch;
    private addConstant;
    private getSymbolIndex;
}
/**
 * DSL Interpreter
 */
export declare class DSLInterpreter {
    private definition;
    private context;
    constructor(definition: DSLDefinition);
    /**
     * Execute bytecode
     */
    execute(bytecode: Bytecode): any;
    private executeBinaryOp;
    private registerBuiltins;
}
/**
 * DSL Manager
 */
export declare class DSLManager {
    private definitions;
    /**
     * Register DSL definition
     */
    registerDSL(definition: DSLDefinition): void;
    /**
     * Get DSL definition
     */
    getDSL(id: string): DSLDefinition | undefined;
    /**
     * Execute DSL code
     */
    executeDSL(dslId: string, source: string): Promise<any>;
    /**
     * List DSL definitions
     */
    listDSLs(): DSLDefinition[];
}
/**
 * Singleton instance
 */
export declare const dslManager: DSLManager;
//# sourceMappingURL=DSLEngine.d.ts.map