/**
 * Custom Domain-Specific Language (DSL) Support
 * DSL parser, compiler, interpreter, and runtime for custom automation languages
 */

import { eventBus } from '../core/EventBus';

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

export enum EvaluationStrategy {
  Eager = 'eager',
  Lazy = 'lazy',
  Hybrid = 'hybrid',
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

export enum Opcode {
  // Stack operations
  PUSH = 'PUSH',
  POP = 'POP',
  DUP = 'DUP',
  SWAP = 'SWAP',

  // Arithmetic
  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  MOD = 'MOD',

  // Comparison
  EQ = 'EQ',
  NEQ = 'NEQ',
  LT = 'LT',
  LTE = 'LTE',
  GT = 'GT',
  GTE = 'GTE',

  // Logical
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // Control flow
  JUMP = 'JUMP',
  JUMP_IF = 'JUMP_IF',
  JUMP_IF_NOT = 'JUMP_IF_NOT',
  CALL = 'CALL',
  RETURN = 'RETURN',

  // Variables
  LOAD = 'LOAD',
  STORE = 'STORE',
  LOAD_GLOBAL = 'LOAD_GLOBAL',
  STORE_GLOBAL = 'STORE_GLOBAL',

  // Objects
  LOAD_ATTR = 'LOAD_ATTR',
  STORE_ATTR = 'STORE_ATTR',
  LOAD_INDEX = 'LOAD_INDEX',
  STORE_INDEX = 'STORE_INDEX',

  // Functions
  MAKE_FUNCTION = 'MAKE_FUNCTION',
  MAKE_CLOSURE = 'MAKE_CLOSURE',

  // Other
  HALT = 'HALT',
  PRINT = 'PRINT',
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
export class DSLLexer {
  private tokens: TokenDefinition[];
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(private definition: DSLDefinition) {
    this.tokens = definition.grammar.tokens.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Tokenize source code
   */
  tokenize(source: string): Token[] {
    this.position = 0;
    this.line = 1;
    this.column = 1;

    const tokens: Token[] = [];

    while (this.position < source.length) {
      const token = this.nextToken(source);

      if (token && !this.shouldSkip(token)) {
        tokens.push(token);
      }
    }

    return tokens;
  }

  private nextToken(source: string): Token | null {
    // Skip whitespace
    while (this.position < source.length && /\s/.test(source[this.position])) {
      if (source[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }

      this.position++;
    }

    if (this.position >= source.length) {
      return null;
    }

    const startPosition = { line: this.line, column: this.column, offset: this.position };

    // Try to match tokens
    for (const tokenDef of this.tokens) {
      const pattern = typeof tokenDef.pattern === 'string'
        ? new RegExp(tokenDef.pattern)
        : tokenDef.pattern;

      const remaining = source.substring(this.position);
      const match = remaining.match(pattern);

      if (match && match.index === 0) {
        const value = match[0];
        this.position += value.length;
        this.column += value.length;

        return {
          type: tokenDef.name,
          value,
          location: {
            start: startPosition,
            end: { line: this.line, column: this.column, offset: this.position },
          },
        };
      }
    }

    throw new Error(`Unexpected character at ${this.line}:${this.column}: ${source[this.position]}`);
  }

  private shouldSkip(token: Token): boolean {
    const tokenDef = this.tokens.find(t => t.name === token.type);
    return tokenDef?.skip || false;
  }
}

/**
 * DSL Parser
 */
export class DSLParser {
  private tokens: Token[] = [];
  private position: number = 0;

  constructor(private definition: DSLDefinition) {}

  /**
   * Parse tokens into AST
   */
  parse(tokens: Token[]): AST {
    this.tokens = tokens;
    this.position = 0;

    return this.parseProgram();
  }

  private parseProgram(): AST {
    const statements: AST[] = [];

    while (!this.isAtEnd()) {
      statements.push(this.parseStatement());
    }

    return {
      type: 'Program',
      children: statements,
      location: this.getLocation(),
    };
  }

  private parseStatement(): AST {
    if (this.match('KEYWORD')) {
      return this.parseKeywordStatement();
    }

    return this.parseExpression();
  }

  private parseKeywordStatement(): AST {
    const keyword = this.previous();

    switch (keyword.value) {
      case 'if':
        return this.parseIfStatement();
      case 'while':
        return this.parseWhileStatement();
      case 'for':
        return this.parseForStatement();
      case 'function':
        return this.parseFunctionDeclaration();
      case 'return':
        return this.parseReturnStatement();
      default:
        throw new Error(`Unknown keyword: ${keyword.value}`);
    }
  }

  private parseIfStatement(): AST {
    const condition = this.parseExpression();
    const thenBranch = this.parseBlock();
    let elseBranch: AST | undefined;

    if (this.match('KEYWORD') && this.previous().value === 'else') {
      elseBranch = this.parseBlock();
    }

    return {
      type: 'IfStatement',
      children: [condition, thenBranch, ...(elseBranch ? [elseBranch] : [])],
      location: this.getLocation(),
    };
  }

  private parseWhileStatement(): AST {
    const condition = this.parseExpression();
    const body = this.parseBlock();

    return {
      type: 'WhileStatement',
      children: [condition, body],
      location: this.getLocation(),
    };
  }

  private parseForStatement(): AST {
    // Simplified for loop
    const init = this.parseExpression();
    const condition = this.parseExpression();
    const update = this.parseExpression();
    const body = this.parseBlock();

    return {
      type: 'ForStatement',
      children: [init, condition, update, body],
      location: this.getLocation(),
    };
  }

  private parseFunctionDeclaration(): AST {
    const name = this.consume('IDENTIFIER');
    const parameters: AST[] = [];

    // Parse parameters
    while (!this.check('ARROW') && !this.isAtEnd()) {
      parameters.push(this.parseExpression());
    }

    const body = this.parseBlock();

    return {
      type: 'FunctionDeclaration',
      value: name.value,
      children: [...parameters, body],
      location: this.getLocation(),
    };
  }

  private parseReturnStatement(): AST {
    const expression = this.parseExpression();

    return {
      type: 'ReturnStatement',
      children: [expression],
      location: this.getLocation(),
    };
  }

  private parseBlock(): AST {
    const statements: AST[] = [];

    while (!this.check('END') && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }

    return {
      type: 'Block',
      children: statements,
      location: this.getLocation(),
    };
  }

  private parseExpression(): AST {
    return this.parseBinaryExpression();
  }

  private parseBinaryExpression(): AST {
    let left = this.parsePrimaryExpression();

    while (this.match('OPERATOR')) {
      const operator = this.previous();
      const right = this.parsePrimaryExpression();

      left = {
        type: 'BinaryExpression',
        value: operator.value,
        children: [left, right],
        location: this.getLocation(),
      };
    }

    return left;
  }

  private parsePrimaryExpression(): AST {
    if (this.match('NUMBER')) {
      return {
        type: 'Literal',
        value: parseFloat(this.previous().value),
        children: [],
        location: this.getLocation(),
      };
    }

    if (this.match('STRING')) {
      return {
        type: 'Literal',
        value: this.previous().value,
        children: [],
        location: this.getLocation(),
      };
    }

    if (this.match('IDENTIFIER')) {
      return {
        type: 'Identifier',
        value: this.previous().value,
        children: [],
        location: this.getLocation(),
      };
    }

    throw new Error(`Unexpected token: ${this.peek()?.type}`);
  }

  private match(...types: string[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  private check(type: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek()?.type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.position++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.position >= this.tokens.length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private previous(): Token {
    return this.tokens[this.position - 1];
  }

  private consume(type: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`Expected ${type} but got ${this.peek()?.type}`);
  }

  private getLocation(): SourceLocation {
    const token = this.previous();
    return token.location;
  }
}

/**
 * DSL Compiler
 */
export class DSLCompiler {
  private constants: any[] = [];
  private instructions: Instruction[] = [];
  private symbols: SymbolTable = { symbols: new Map() };

  constructor(private definition: DSLDefinition) {}

  /**
   * Compile AST to bytecode
   */
  compile(ast: AST): CompilationResult {
    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];

    try {
      this.compileNode(ast);

      // Add HALT instruction
      this.emit(Opcode.HALT, []);

      return {
        success: true,
        ast,
        bytecode: {
          instructions: this.instructions,
          constants: this.constants,
          symbols: this.symbols,
        },
        errors,
        warnings,
      };
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : String(error),
        location: ast.location,
        severity: 'error',
      });

      return {
        success: false,
        ast,
        errors,
        warnings,
      };
    }
  }

  private compileNode(node: AST): void {
    switch (node.type) {
      case 'Program':
        for (const child of node.children) {
          this.compileNode(child);
        }
        break;

      case 'Literal':
        this.compileLiteral(node);
        break;

      case 'Identifier':
        this.compileIdentifier(node);
        break;

      case 'BinaryExpression':
        this.compileBinaryExpression(node);
        break;

      case 'IfStatement':
        this.compileIfStatement(node);
        break;

      case 'WhileStatement':
        this.compileWhileStatement(node);
        break;

      case 'FunctionDeclaration':
        this.compileFunctionDeclaration(node);
        break;

      case 'ReturnStatement':
        this.compileReturnStatement(node);
        break;

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private compileLiteral(node: AST): void {
    const index = this.addConstant(node.value);
    this.emit(Opcode.PUSH, [index]);
  }

  private compileIdentifier(node: AST): void {
    this.emit(Opcode.LOAD, [this.getSymbolIndex(node.value)]);
  }

  private compileBinaryExpression(node: AST): void {
    // Compile left operand
    this.compileNode(node.children[0]);

    // Compile right operand
    this.compileNode(node.children[1]);

    // Emit operator instruction
    switch (node.value) {
      case '+':
        this.emit(Opcode.ADD, []);
        break;
      case '-':
        this.emit(Opcode.SUB, []);
        break;
      case '*':
        this.emit(Opcode.MUL, []);
        break;
      case '/':
        this.emit(Opcode.DIV, []);
        break;
      case '==':
        this.emit(Opcode.EQ, []);
        break;
      case '!=':
        this.emit(Opcode.NEQ, []);
        break;
      case '<':
        this.emit(Opcode.LT, []);
        break;
      case '<=':
        this.emit(Opcode.LTE, []);
        break;
      case '>':
        this.emit(Opcode.GT, []);
        break;
      case '>=':
        this.emit(Opcode.GTE, []);
        break;
      default:
        throw new Error(`Unknown operator: ${node.value}`);
    }
  }

  private compileIfStatement(node: AST): void {
    // Compile condition
    this.compileNode(node.children[0]);

    // Jump if false
    const jumpIfFalse = this.emit(Opcode.JUMP_IF_NOT, [0]);

    // Compile then branch
    this.compileNode(node.children[1]);

    // Jump over else branch
    const jumpEnd = this.emit(Opcode.JUMP, [0]);

    // Patch jump if false
    this.patch(jumpIfFalse, this.instructions.length);

    // Compile else branch if present
    if (node.children[2]) {
      this.compileNode(node.children[2]);
    }

    // Patch jump end
    this.patch(jumpEnd, this.instructions.length);
  }

  private compileWhileStatement(node: AST): void {
    const loopStart = this.instructions.length;

    // Compile condition
    this.compileNode(node.children[0]);

    // Jump if false
    const jumpIfFalse = this.emit(Opcode.JUMP_IF_NOT, [0]);

    // Compile body
    this.compileNode(node.children[1]);

    // Jump back to start
    this.emit(Opcode.JUMP, [loopStart]);

    // Patch jump if false
    this.patch(jumpIfFalse, this.instructions.length);
  }

  private compileFunctionDeclaration(node: AST): void {
    // Simplified function compilation
    this.emit(Opcode.MAKE_FUNCTION, []);
  }

  private compileReturnStatement(node: AST): void {
    this.compileNode(node.children[0]);
    this.emit(Opcode.RETURN, []);
  }

  private emit(opcode: Opcode, operands: number[]): number {
    const instruction: Instruction = { opcode, operands };
    this.instructions.push(instruction);
    return this.instructions.length - 1;
  }

  private patch(index: number, value: number): void {
    this.instructions[index].operands[0] = value;
  }

  private addConstant(value: any): number {
    this.constants.push(value);
    return this.constants.length - 1;
  }

  private getSymbolIndex(name: string): number {
    // Simplified symbol resolution
    return 0;
  }
}

/**
 * DSL Interpreter
 */
export class DSLInterpreter {
  private context: RuntimeContext = {
    stack: [],
    globals: new Map(),
    locals: [],
    callStack: [],
    heap: new Map(),
  };

  constructor(private definition: DSLDefinition) {
    this.registerBuiltins();
  }

  /**
   * Execute bytecode
   */
  execute(bytecode: Bytecode): any {
    let ip = 0; // Instruction pointer

    while (ip < bytecode.instructions.length) {
      const instruction = bytecode.instructions[ip];

      switch (instruction.opcode) {
        case Opcode.PUSH:
          this.context.stack.push(bytecode.constants[instruction.operands[0]]);
          break;

        case Opcode.POP:
          this.context.stack.pop();
          break;

        case Opcode.ADD:
          this.executeBinaryOp((a, b) => a + b);
          break;

        case Opcode.SUB:
          this.executeBinaryOp((a, b) => a - b);
          break;

        case Opcode.MUL:
          this.executeBinaryOp((a, b) => a * b);
          break;

        case Opcode.DIV:
          this.executeBinaryOp((a, b) => a / b);
          break;

        case Opcode.EQ:
          this.executeBinaryOp((a, b) => a === b);
          break;

        case Opcode.NEQ:
          this.executeBinaryOp((a, b) => a !== b);
          break;

        case Opcode.LT:
          this.executeBinaryOp((a, b) => a < b);
          break;

        case Opcode.GT:
          this.executeBinaryOp((a, b) => a > b);
          break;

        case Opcode.JUMP:
          ip = instruction.operands[0];
          continue;

        case Opcode.JUMP_IF_NOT:
          if (!this.context.stack.pop()) {
            ip = instruction.operands[0];
            continue;
          }
          break;

        case Opcode.HALT:
          return this.context.stack.length > 0 ? this.context.stack.pop() : undefined;

        case Opcode.PRINT:
          console.log(this.context.stack.pop());
          break;

        default:
          throw new Error(`Unknown opcode: ${instruction.opcode}`);
      }

      ip++;
    }

    return this.context.stack.length > 0 ? this.context.stack.pop() : undefined;
  }

  private executeBinaryOp(op: (a: any, b: any) => any): void {
    const b = this.context.stack.pop();
    const a = this.context.stack.pop();
    this.context.stack.push(op(a, b));
  }

  private registerBuiltins(): void {
    for (const [name, builtin] of Object.entries(this.definition.builtins)) {
      this.context.globals.set(name, builtin.implementation);
    }
  }
}

/**
 * DSL Manager
 */
export class DSLManager {
  private definitions: Map<string, DSLDefinition> = new Map();

  /**
   * Register DSL definition
   */
  registerDSL(definition: DSLDefinition): void {
    this.definitions.set(definition.id, definition);
    eventBus.emitSync('dsl.registered', definition, 'DSLManager');
  }

  /**
   * Get DSL definition
   */
  getDSL(id: string): DSLDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * Execute DSL code
   */
  async executeDSL(dslId: string, source: string): Promise<any> {
    const definition = this.definitions.get(dslId);

    if (!definition) {
      throw new Error(`DSL not found: ${dslId}`);
    }

    // Lexical analysis
    const lexer = new DSLLexer(definition);
    const tokens = lexer.tokenize(source);

    // Parsing
    const parser = new DSLParser(definition);
    const ast = parser.parse(tokens);

    // Compilation
    const compiler = new DSLCompiler(definition);
    const compilationResult = compiler.compile(ast);

    if (!compilationResult.success || !compilationResult.bytecode) {
      throw new Error(`Compilation failed: ${compilationResult.errors.map(e => e.message).join(', ')}`);
    }

    // Execution
    const interpreter = new DSLInterpreter(definition);
    return interpreter.execute(compilationResult.bytecode);
  }

  /**
   * List DSL definitions
   */
  listDSLs(): DSLDefinition[] {
    return Array.from(this.definitions.values());
  }
}

/**
 * Singleton instance
 */
export const dslManager = new DSLManager();
