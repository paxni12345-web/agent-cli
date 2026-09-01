"use strict";
/**
 * Custom Domain-Specific Language (DSL) Support
 * DSL parser, compiler, interpreter, and runtime for custom automation languages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dslManager = exports.DSLManager = exports.DSLInterpreter = exports.DSLCompiler = exports.DSLParser = exports.DSLLexer = exports.Opcode = exports.EvaluationStrategy = void 0;
const EventBus_1 = require("../core/EventBus");
var EvaluationStrategy;
(function (EvaluationStrategy) {
    EvaluationStrategy["Eager"] = "eager";
    EvaluationStrategy["Lazy"] = "lazy";
    EvaluationStrategy["Hybrid"] = "hybrid";
})(EvaluationStrategy || (exports.EvaluationStrategy = EvaluationStrategy = {}));
var Opcode;
(function (Opcode) {
    // Stack operations
    Opcode["PUSH"] = "PUSH";
    Opcode["POP"] = "POP";
    Opcode["DUP"] = "DUP";
    Opcode["SWAP"] = "SWAP";
    // Arithmetic
    Opcode["ADD"] = "ADD";
    Opcode["SUB"] = "SUB";
    Opcode["MUL"] = "MUL";
    Opcode["DIV"] = "DIV";
    Opcode["MOD"] = "MOD";
    // Comparison
    Opcode["EQ"] = "EQ";
    Opcode["NEQ"] = "NEQ";
    Opcode["LT"] = "LT";
    Opcode["LTE"] = "LTE";
    Opcode["GT"] = "GT";
    Opcode["GTE"] = "GTE";
    // Logical
    Opcode["AND"] = "AND";
    Opcode["OR"] = "OR";
    Opcode["NOT"] = "NOT";
    // Control flow
    Opcode["JUMP"] = "JUMP";
    Opcode["JUMP_IF"] = "JUMP_IF";
    Opcode["JUMP_IF_NOT"] = "JUMP_IF_NOT";
    Opcode["CALL"] = "CALL";
    Opcode["RETURN"] = "RETURN";
    // Variables
    Opcode["LOAD"] = "LOAD";
    Opcode["STORE"] = "STORE";
    Opcode["LOAD_GLOBAL"] = "LOAD_GLOBAL";
    Opcode["STORE_GLOBAL"] = "STORE_GLOBAL";
    // Objects
    Opcode["LOAD_ATTR"] = "LOAD_ATTR";
    Opcode["STORE_ATTR"] = "STORE_ATTR";
    Opcode["LOAD_INDEX"] = "LOAD_INDEX";
    Opcode["STORE_INDEX"] = "STORE_INDEX";
    // Functions
    Opcode["MAKE_FUNCTION"] = "MAKE_FUNCTION";
    Opcode["MAKE_CLOSURE"] = "MAKE_CLOSURE";
    // Other
    Opcode["HALT"] = "HALT";
    Opcode["PRINT"] = "PRINT";
})(Opcode || (exports.Opcode = Opcode = {}));
/**
 * DSL Lexer
 */
class DSLLexer {
    definition;
    tokens;
    position = 0;
    line = 1;
    column = 1;
    constructor(definition) {
        this.definition = definition;
        this.tokens = definition.grammar.tokens.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Tokenize source code
     */
    tokenize(source) {
        this.position = 0;
        this.line = 1;
        this.column = 1;
        const tokens = [];
        while (this.position < source.length) {
            const token = this.nextToken(source);
            if (token && !this.shouldSkip(token)) {
                tokens.push(token);
            }
        }
        return tokens;
    }
    nextToken(source) {
        // Skip whitespace
        while (this.position < source.length && /\s/.test(source[this.position])) {
            if (source[this.position] === '\n') {
                this.line++;
                this.column = 1;
            }
            else {
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
    shouldSkip(token) {
        const tokenDef = this.tokens.find(t => t.name === token.type);
        return tokenDef?.skip || false;
    }
}
exports.DSLLexer = DSLLexer;
/**
 * DSL Parser
 */
class DSLParser {
    definition;
    tokens = [];
    position = 0;
    constructor(definition) {
        this.definition = definition;
    }
    /**
     * Parse tokens into AST
     */
    parse(tokens) {
        this.tokens = tokens;
        this.position = 0;
        return this.parseProgram();
    }
    parseProgram() {
        const statements = [];
        while (!this.isAtEnd()) {
            statements.push(this.parseStatement());
        }
        return {
            type: 'Program',
            children: statements,
            location: this.getLocation(),
        };
    }
    parseStatement() {
        if (this.match('KEYWORD')) {
            return this.parseKeywordStatement();
        }
        return this.parseExpression();
    }
    parseKeywordStatement() {
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
    parseIfStatement() {
        const condition = this.parseExpression();
        const thenBranch = this.parseBlock();
        let elseBranch;
        if (this.match('KEYWORD') && this.previous().value === 'else') {
            elseBranch = this.parseBlock();
        }
        return {
            type: 'IfStatement',
            children: [condition, thenBranch, ...(elseBranch ? [elseBranch] : [])],
            location: this.getLocation(),
        };
    }
    parseWhileStatement() {
        const condition = this.parseExpression();
        const body = this.parseBlock();
        return {
            type: 'WhileStatement',
            children: [condition, body],
            location: this.getLocation(),
        };
    }
    parseForStatement() {
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
    parseFunctionDeclaration() {
        const name = this.consume('IDENTIFIER');
        const parameters = [];
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
    parseReturnStatement() {
        const expression = this.parseExpression();
        return {
            type: 'ReturnStatement',
            children: [expression],
            location: this.getLocation(),
        };
    }
    parseBlock() {
        const statements = [];
        while (!this.check('END') && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }
        return {
            type: 'Block',
            children: statements,
            location: this.getLocation(),
        };
    }
    parseExpression() {
        return this.parseBinaryExpression();
    }
    parseBinaryExpression() {
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
    parsePrimaryExpression() {
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
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek()?.type === type;
    }
    advance() {
        if (!this.isAtEnd())
            this.position++;
        return this.previous();
    }
    isAtEnd() {
        return this.position >= this.tokens.length;
    }
    peek() {
        return this.tokens[this.position];
    }
    previous() {
        return this.tokens[this.position - 1];
    }
    consume(type) {
        if (this.check(type))
            return this.advance();
        throw new Error(`Expected ${type} but got ${this.peek()?.type}`);
    }
    getLocation() {
        const token = this.previous();
        return token.location;
    }
}
exports.DSLParser = DSLParser;
/**
 * DSL Compiler
 */
class DSLCompiler {
    definition;
    constants = [];
    instructions = [];
    symbols = { symbols: new Map() };
    constructor(definition) {
        this.definition = definition;
    }
    /**
     * Compile AST to bytecode
     */
    compile(ast) {
        const errors = [];
        const warnings = [];
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
        }
        catch (error) {
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
    compileNode(node) {
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
    compileLiteral(node) {
        const index = this.addConstant(node.value);
        this.emit(Opcode.PUSH, [index]);
    }
    compileIdentifier(node) {
        this.emit(Opcode.LOAD, [this.getSymbolIndex(node.value)]);
    }
    compileBinaryExpression(node) {
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
    compileIfStatement(node) {
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
    compileWhileStatement(node) {
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
    compileFunctionDeclaration(node) {
        // Simplified function compilation
        this.emit(Opcode.MAKE_FUNCTION, []);
    }
    compileReturnStatement(node) {
        this.compileNode(node.children[0]);
        this.emit(Opcode.RETURN, []);
    }
    emit(opcode, operands) {
        const instruction = { opcode, operands };
        this.instructions.push(instruction);
        return this.instructions.length - 1;
    }
    patch(index, value) {
        this.instructions[index].operands[0] = value;
    }
    addConstant(value) {
        this.constants.push(value);
        return this.constants.length - 1;
    }
    getSymbolIndex(name) {
        // Simplified symbol resolution
        return 0;
    }
}
exports.DSLCompiler = DSLCompiler;
/**
 * DSL Interpreter
 */
class DSLInterpreter {
    definition;
    context = {
        stack: [],
        globals: new Map(),
        locals: [],
        callStack: [],
        heap: new Map(),
    };
    constructor(definition) {
        this.definition = definition;
        this.registerBuiltins();
    }
    /**
     * Execute bytecode
     */
    execute(bytecode) {
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
    executeBinaryOp(op) {
        const b = this.context.stack.pop();
        const a = this.context.stack.pop();
        this.context.stack.push(op(a, b));
    }
    registerBuiltins() {
        for (const [name, builtin] of Object.entries(this.definition.builtins)) {
            this.context.globals.set(name, builtin.implementation);
        }
    }
}
exports.DSLInterpreter = DSLInterpreter;
/**
 * DSL Manager
 */
class DSLManager {
    definitions = new Map();
    /**
     * Register DSL definition
     */
    registerDSL(definition) {
        this.definitions.set(definition.id, definition);
        EventBus_1.eventBus.emitSync('dsl.registered', definition, 'DSLManager');
    }
    /**
     * Get DSL definition
     */
    getDSL(id) {
        return this.definitions.get(id);
    }
    /**
     * Execute DSL code
     */
    async executeDSL(dslId, source) {
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
    listDSLs() {
        return Array.from(this.definitions.values());
    }
}
exports.DSLManager = DSLManager;
/**
 * Singleton instance
 */
exports.dslManager = new DSLManager();
