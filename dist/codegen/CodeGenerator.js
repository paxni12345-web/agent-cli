"use strict";
/**
 * Advanced Code Generation & Template Engine
 * Dynamic code generation, template processing, AST manipulation
 * Multi-language support, code formatting, validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGenerator = void 0;
const events_1 = require("events");
// ============================================================================
// Code Generator
// ============================================================================
class CodeGenerator extends events_1.EventEmitter {
    config;
    templates = new Map();
    compiledTemplates = new Map();
    snippets = new Map();
    generatedCode = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            defaultLanguage: 'typescript',
            formatting: {
                indentSize: 2,
                indentStyle: 'space',
                lineWidth: 100,
                quotes: 'single',
                semicolons: true,
                trailingComma: true,
                bracketSpacing: true,
            },
            validation: true,
            autoImport: true,
            templateCache: true,
            outputDirectory: './generated',
            ...config,
        };
    }
    // ========================================================================
    // Template Management
    // ========================================================================
    registerTemplate(template) {
        const full = {
            ...template,
            id: this.generateId(),
        };
        this.templates.set(full.id, full);
        if (this.config.templateCache) {
            this.compileTemplate(full);
        }
        this.emit('template:registered', { template: full });
        return full;
    }
    compileTemplate(template) {
        const existing = this.compiledTemplates.get(template.id);
        if (existing) {
            return existing;
        }
        const compiled = {
            id: this.generateId(),
            templateId: template.id,
            fn: this.createTemplateFunction(template),
            compiledAt: Date.now(),
        };
        this.compiledTemplates.set(template.id, compiled);
        this.emit('template:compiled', { compiled });
        return compiled;
    }
    createTemplateFunction(template) {
        return (context) => {
            let result = template.content;
            // Replace variables
            for (const variable of template.variables) {
                const value = context[variable.name] ?? variable.default;
                if (variable.required && value === undefined) {
                    throw new Error(`Required variable not provided: ${variable.name}`);
                }
                if (value !== undefined && variable.validation) {
                    this.validateVariable(variable, value);
                }
                const pattern = new RegExp(`\\{\\{\\s*${variable.name}\\s*\\}\\}`, 'g');
                result = result.replace(pattern, this.formatValue(value, variable.type));
            }
            // Process conditionals
            result = this.processConditionals(result, context);
            // Process loops
            result = this.processLoops(result, context);
            return result;
        };
    }
    validateVariable(variable, value) {
        const rule = variable.validation;
        if (rule.pattern && typeof value === 'string') {
            const regex = new RegExp(rule.pattern);
            if (!regex.test(value)) {
                throw new Error(`Variable ${variable.name} does not match pattern ${rule.pattern}`);
            }
        }
        if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
            throw new Error(`Variable ${variable.name} is too short`);
        }
        if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
            throw new Error(`Variable ${variable.name} is too long`);
        }
        if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
            throw new Error(`Variable ${variable.name} is too small`);
        }
        if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
            throw new Error(`Variable ${variable.name} is too large`);
        }
        if (rule.enum && !rule.enum.includes(value)) {
            throw new Error(`Variable ${variable.name} must be one of: ${rule.enum.join(', ')}`);
        }
        if (rule.custom && !rule.custom(value)) {
            throw new Error(`Variable ${variable.name} failed custom validation`);
        }
    }
    formatValue(value, type) {
        switch (type) {
            case 'string':
                return String(value);
            case 'number':
                return String(value);
            case 'boolean':
                return String(value);
            case 'array':
                return Array.isArray(value) ? value.join(', ') : String(value);
            case 'object':
                return typeof value === 'object' ? JSON.stringify(value) : String(value);
            case 'identifier':
                return this.toIdentifier(String(value));
            case 'type':
                return this.toTypeName(String(value));
            case 'expression':
                return String(value);
            default:
                return String(value);
        }
    }
    processConditionals(content, context) {
        const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
        return content.replace(ifPattern, (match, condition, body) => {
            return context[condition] ? body : '';
        });
    }
    processLoops(content, context) {
        const eachPattern = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
        return content.replace(eachPattern, (match, arrayName, body) => {
            const array = context[arrayName];
            if (!Array.isArray(array)) {
                return '';
            }
            return array
                .map((item, index) => {
                let itemBody = body;
                itemBody = itemBody.replace(/\{\{this\}\}/g, String(item));
                itemBody = itemBody.replace(/\{\{@index\}\}/g, String(index));
                if (typeof item === 'object') {
                    for (const [key, value] of Object.entries(item)) {
                        const pattern = new RegExp(`\\{\\{this\\.${key}\\}\\}`, 'g');
                        itemBody = itemBody.replace(pattern, String(value));
                    }
                }
                return itemBody;
            })
                .join('\n');
        });
    }
    // ========================================================================
    // Code Generation
    // ========================================================================
    async generate(request) {
        const startTime = Date.now();
        let template;
        if (typeof request.template === 'string') {
            const found = this.templates.get(request.template);
            if (!found) {
                throw new Error(`Template not found: ${request.template}`);
            }
            template = found;
        }
        else {
            template = request.template;
        }
        // Compile template if needed
        let compiled = this.compiledTemplates.get(template.id);
        if (!compiled) {
            compiled = this.compileTemplate(template);
        }
        // Generate code
        let code = compiled.fn(request.context);
        // Format if requested
        let formatted = false;
        if (request.format !== false) {
            code = this.format(code, request.language || template.language, request.formatting);
            formatted = true;
        }
        // Validate if requested
        const errors = [];
        const warnings = [];
        let validated = false;
        if (request.validate !== false && this.config.validation) {
            const validationResult = this.validate(code, request.language || template.language);
            errors.push(...validationResult.errors);
            warnings.push(...validationResult.warnings);
            validated = true;
        }
        const generated = {
            id: this.generateId(),
            code,
            language: request.language || template.language,
            formatted,
            validated,
            errors,
            warnings,
            metadata: {
                templateId: template.id,
                generatedAt: Date.now(),
                variables: request.context,
                duration: Date.now() - startTime,
            },
        };
        this.generatedCode.set(generated.id, generated);
        this.emit('code:generated', { generated });
        return generated;
    }
    // ========================================================================
    // Class Generation
    // ========================================================================
    generateClass(definition, language = 'typescript') {
        switch (language) {
            case 'typescript':
                return this.generateTypeScriptClass(definition);
            case 'javascript':
                return this.generateJavaScriptClass(definition);
            case 'python':
                return this.generatePythonClass(definition);
            case 'java':
                return this.generateJavaClass(definition);
            default:
                throw new Error(`Class generation not supported for ${language}`);
        }
    }
    generateTypeScriptClass(def) {
        const lines = [];
        // Documentation
        if (def.documentation) {
            lines.push('/**');
            lines.push(` * ${def.documentation}`);
            lines.push(' */');
        }
        // Decorators
        if (def.decorators) {
            for (const decorator of def.decorators) {
                const args = decorator.arguments ? `(${decorator.arguments.join(', ')})` : '';
                lines.push(`@${decorator.name}${args}`);
            }
        }
        // Class declaration
        let declaration = '';
        if (def.isExported)
            declaration += 'export ';
        if (def.isAbstract)
            declaration += 'abstract ';
        declaration += `class ${def.name}`;
        if (def.extends)
            declaration += ` extends ${def.extends}`;
        if (def.implements && def.implements.length > 0) {
            declaration += ` implements ${def.implements.join(', ')}`;
        }
        lines.push(declaration + ' {');
        // Properties
        for (const prop of def.properties) {
            if (prop.documentation) {
                lines.push('  /**');
                lines.push(`   * ${prop.documentation}`);
                lines.push('   */');
            }
            if (prop.decorators) {
                for (const decorator of prop.decorators) {
                    const args = decorator.arguments ? `(${decorator.arguments.join(', ')})` : '';
                    lines.push(`  @${decorator.name}${args}`);
                }
            }
            let propLine = '  ';
            if (prop.visibility !== 'public')
                propLine += `${prop.visibility} `;
            if (prop.isStatic)
                propLine += 'static ';
            if (prop.isReadonly)
                propLine += 'readonly ';
            propLine += `${prop.name}: ${prop.type}`;
            if (prop.defaultValue !== undefined) {
                propLine += ` = ${JSON.stringify(prop.defaultValue)}`;
            }
            propLine += ';';
            lines.push(propLine);
            lines.push('');
        }
        // Constructor
        if (def.constructorParams && def.constructorParams.length > 0) {
            const params = def.constructorParams.map(p => {
                let param = p.name;
                if (p.optional)
                    param += '?';
                param += `: ${p.type}`;
                if (p.defaultValue !== undefined) {
                    param += ` = ${JSON.stringify(p.defaultValue)}`;
                }
                return param;
            }).join(', ');
            lines.push(`  constructor(${params}) {`);
            lines.push('    // Constructor implementation');
            lines.push('  }');
            lines.push('');
        }
        // Methods
        for (const method of def.methods) {
            if (method.documentation) {
                lines.push('  /**');
                lines.push(`   * ${method.documentation}`);
                lines.push('   */');
            }
            if (method.decorators) {
                for (const decorator of method.decorators) {
                    const args = decorator.arguments ? `(${decorator.arguments.join(', ')})` : '';
                    lines.push(`  @${decorator.name}${args}`);
                }
            }
            let methodLine = '  ';
            if (method.visibility !== 'public')
                methodLine += `${method.visibility} `;
            if (method.isStatic)
                methodLine += 'static ';
            if (method.isAsync)
                methodLine += 'async ';
            if (method.isAbstract)
                methodLine += 'abstract ';
            const params = method.parameters.map(p => {
                let param = p.isRest ? '...' : '';
                param += p.name;
                if (p.optional)
                    param += '?';
                param += `: ${p.type}`;
                if (p.defaultValue !== undefined) {
                    param += ` = ${JSON.stringify(p.defaultValue)}`;
                }
                return param;
            }).join(', ');
            methodLine += `${method.name}(${params}): ${method.returnType}`;
            if (method.isAbstract) {
                methodLine += ';';
                lines.push(methodLine);
            }
            else {
                methodLine += ' {';
                lines.push(methodLine);
                if (method.body) {
                    const bodyLines = method.body.split('\n');
                    for (const line of bodyLines) {
                        lines.push('    ' + line);
                    }
                }
                lines.push('  }');
            }
            lines.push('');
        }
        lines.push('}');
        return lines.join('\n');
    }
    generateJavaScriptClass(def) {
        // Similar to TypeScript but without types
        return this.generateTypeScriptClass(def).replace(/:\s*\w+/g, '');
    }
    generatePythonClass(def) {
        const lines = [];
        let declaration = `class ${def.name}`;
        if (def.extends) {
            declaration += `(${def.extends})`;
        }
        declaration += ':';
        lines.push(declaration);
        if (def.documentation) {
            lines.push(`    """${def.documentation}"""`);
        }
        // Constructor
        if (def.constructorParams && def.constructorParams.length > 0) {
            const params = ['self', ...def.constructorParams.map(p => p.name)].join(', ');
            lines.push(`    def __init__(${params}):`);
            for (const param of def.constructorParams) {
                lines.push(`        self.${param.name} = ${param.name}`);
            }
            lines.push('');
        }
        // Methods
        for (const method of def.methods) {
            const params = ['self', ...method.parameters.map(p => p.name)].join(', ');
            let methodLine = '    ';
            if (method.isAsync)
                methodLine += 'async ';
            methodLine += `def ${method.name}(${params}):`;
            lines.push(methodLine);
            if (method.documentation) {
                lines.push(`        """${method.documentation}"""`);
            }
            if (method.body) {
                const bodyLines = method.body.split('\n');
                for (const line of bodyLines) {
                    lines.push('        ' + line);
                }
            }
            else {
                lines.push('        pass');
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    generateJavaClass(def) {
        const lines = [];
        if (def.documentation) {
            lines.push('/**');
            lines.push(` * ${def.documentation}`);
            lines.push(' */');
        }
        let declaration = 'public ';
        if (def.isAbstract)
            declaration += 'abstract ';
        declaration += `class ${def.name}`;
        if (def.extends)
            declaration += ` extends ${def.extends}`;
        if (def.implements && def.implements.length > 0) {
            declaration += ` implements ${def.implements.join(', ')}`;
        }
        lines.push(declaration + ' {');
        // Properties
        for (const prop of def.properties) {
            let propLine = '    ';
            propLine += `${prop.visibility} `;
            if (prop.isStatic)
                propLine += 'static ';
            if (prop.isReadonly)
                propLine += 'final ';
            propLine += `${prop.type} ${prop.name}`;
            if (prop.defaultValue !== undefined) {
                propLine += ` = ${JSON.stringify(prop.defaultValue)}`;
            }
            propLine += ';';
            lines.push(propLine);
        }
        lines.push('');
        // Methods
        for (const method of def.methods) {
            let methodLine = '    ';
            methodLine += `${method.visibility} `;
            if (method.isStatic)
                methodLine += 'static ';
            if (method.isAbstract)
                methodLine += 'abstract ';
            const params = method.parameters.map(p => `${p.type} ${p.name}`).join(', ');
            methodLine += `${method.returnType} ${method.name}(${params})`;
            if (method.isAbstract) {
                methodLine += ';';
                lines.push(methodLine);
            }
            else {
                methodLine += ' {';
                lines.push(methodLine);
                if (method.body) {
                    const bodyLines = method.body.split('\n');
                    for (const line of bodyLines) {
                        lines.push('        ' + line);
                    }
                }
                lines.push('    }');
            }
            lines.push('');
        }
        lines.push('}');
        return lines.join('\n');
    }
    // ========================================================================
    // Interface Generation
    // ========================================================================
    generateInterface(definition, language = 'typescript') {
        if (language !== 'typescript' && language !== 'java' && language !== 'csharp') {
            throw new Error(`Interface generation not supported for ${language}`);
        }
        const lines = [];
        if (definition.documentation) {
            lines.push('/**');
            lines.push(` * ${definition.documentation}`);
            lines.push(' */');
        }
        let declaration = '';
        if (definition.isExported)
            declaration += 'export ';
        declaration += `interface ${definition.name}`;
        if (definition.extends && definition.extends.length > 0) {
            declaration += ` extends ${definition.extends.join(', ')}`;
        }
        lines.push(declaration + ' {');
        // Properties
        for (const prop of definition.properties) {
            if (prop.documentation) {
                lines.push('  /**');
                lines.push(`   * ${prop.documentation}`);
                lines.push('   */');
            }
            let propLine = '  ';
            if (prop.readonly)
                propLine += 'readonly ';
            propLine += prop.name;
            if (prop.optional)
                propLine += '?';
            propLine += `: ${prop.type};`;
            lines.push(propLine);
        }
        // Methods
        for (const method of definition.methods) {
            if (method.documentation) {
                lines.push('  /**');
                lines.push(`   * ${method.documentation}`);
                lines.push('   */');
            }
            const params = method.parameters.map(p => {
                let param = p.name;
                if (p.optional)
                    param += '?';
                param += `: ${p.type}`;
                return param;
            }).join(', ');
            let methodLine = `  ${method.name}`;
            if (method.optional)
                methodLine += '?';
            methodLine += `(${params}): ${method.returnType};`;
            lines.push(methodLine);
        }
        lines.push('}');
        return lines.join('\n');
    }
    // ========================================================================
    // Function Generation
    // ========================================================================
    generateFunction(definition, language = 'typescript') {
        const lines = [];
        if (definition.documentation) {
            lines.push('/**');
            lines.push(` * ${definition.documentation}`);
            lines.push(' */');
        }
        let declaration = '';
        if (definition.isExported)
            declaration += 'export ';
        if (definition.isAsync)
            declaration += 'async ';
        declaration += `function`;
        if (definition.isGenerator)
            declaration += '*';
        declaration += ` ${definition.name}`;
        const params = definition.parameters.map(p => {
            let param = p.isRest ? '...' : '';
            param += p.name;
            if (language === 'typescript') {
                if (p.optional)
                    param += '?';
                param += `: ${p.type}`;
            }
            if (p.defaultValue !== undefined) {
                param += ` = ${JSON.stringify(p.defaultValue)}`;
            }
            return param;
        }).join(', ');
        declaration += `(${params})`;
        if (language === 'typescript') {
            declaration += `: ${definition.returnType}`;
        }
        declaration += ' {';
        lines.push(declaration);
        const bodyLines = definition.body.split('\n');
        for (const line of bodyLines) {
            lines.push('  ' + line);
        }
        lines.push('}');
        return lines.join('\n');
    }
    // ========================================================================
    // Import Generation
    // ========================================================================
    generateImports(imports, language = 'typescript') {
        const lines = [];
        for (const imp of imports) {
            if (language === 'typescript' || language === 'javascript') {
                let line = 'import ';
                if (imp.isTypeOnly)
                    line += 'type ';
                if (imp.isDefault) {
                    line += imp.imports[0].name;
                    if (imp.imports.length > 1) {
                        line += ', { ';
                        line += imp.imports.slice(1).map(i => {
                            return i.alias ? `${i.name} as ${i.alias}` : i.name;
                        }).join(', ');
                        line += ' }';
                    }
                }
                else {
                    line += '{ ';
                    line += imp.imports.map(i => {
                        return i.alias ? `${i.name} as ${i.alias}` : i.name;
                    }).join(', ');
                    line += ' }';
                }
                line += ` from '${imp.module}';`;
                lines.push(line);
            }
            else if (language === 'python') {
                const names = imp.imports.map(i => {
                    return i.alias ? `${i.name} as ${i.alias}` : i.name;
                }).join(', ');
                lines.push(`from ${imp.module} import ${names}`);
            }
        }
        return lines.join('\n');
    }
    // ========================================================================
    // Formatting
    // ========================================================================
    format(code, language, customConfig) {
        const config = { ...this.config.formatting, ...customConfig };
        // Basic formatting
        let formatted = code;
        // Normalize line endings
        formatted = formatted.replace(/\r\n/g, '\n');
        // Apply indentation
        const indent = config.indentStyle === 'tab' ? '\t' : ' '.repeat(config.indentSize);
        const lines = formatted.split('\n');
        let indentLevel = 0;
        const formattedLines = [];
        for (let line of lines) {
            line = line.trim();
            if (line.endsWith('}') || line.endsWith(']')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            if (line) {
                formattedLines.push(indent.repeat(indentLevel) + line);
            }
            else {
                formattedLines.push('');
            }
            if (line.endsWith('{') || line.endsWith('[')) {
                indentLevel++;
            }
        }
        formatted = formattedLines.join('\n');
        // Apply quote style
        if (language === 'typescript' || language === 'javascript') {
            if (config.quotes === 'single') {
                formatted = formatted.replace(/"([^"]*)"/g, "'$1'");
            }
            else {
                formatted = formatted.replace(/'([^']*)'/g, '"$1"');
            }
            // Apply semicolons
            if (config.semicolons) {
                formatted = formatted.replace(/(\S)\n/g, (match, char) => {
                    if (char !== ';' && char !== '{' && char !== '}') {
                        return char + ';\n';
                    }
                    return match;
                });
            }
        }
        return formatted;
    }
    // ========================================================================
    // Validation
    // ========================================================================
    validate(code, language) {
        const errors = [];
        const warnings = [];
        // Basic syntax validation
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check for common errors
            if (language === 'typescript' || language === 'javascript') {
                // Unclosed brackets
                const openBrackets = (line.match(/\{/g) || []).length;
                const closeBrackets = (line.match(/\}/g) || []).length;
                if (openBrackets > closeBrackets + 1) {
                    warnings.push({
                        line: i + 1,
                        column: 0,
                        message: 'Possible unclosed bracket',
                    });
                }
                // Undefined variables (very basic check)
                if (line.includes('undefined')) {
                    warnings.push({
                        line: i + 1,
                        column: line.indexOf('undefined'),
                        message: 'Usage of undefined',
                        suggestion: 'Consider providing a default value',
                    });
                }
            }
        }
        return { errors, warnings };
    }
    // ========================================================================
    // Utilities
    // ========================================================================
    toIdentifier(str) {
        return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
    }
    toTypeName(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    toCamelCase(str) {
        return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
    }
    toPascalCase(str) {
        const camel = this.toCamelCase(str);
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    }
    toSnakeCase(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
    }
    generateId() {
        return `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    // ========================================================================
    // Snippet Management
    // ========================================================================
    registerSnippet(snippet) {
        const full = {
            ...snippet,
            id: this.generateId(),
        };
        this.snippets.set(full.id, full);
        this.emit('snippet:registered', { snippet: full });
        return full;
    }
    getSnippet(id) {
        return this.snippets.get(id);
    }
    searchSnippets(query) {
        let results = Array.from(this.snippets.values());
        if (query.language) {
            results = results.filter(s => s.language === query.language);
        }
        if (query.category) {
            results = results.filter(s => s.category === query.category);
        }
        if (query.tags && query.tags.length > 0) {
            results = results.filter(s => query.tags.some(t => s.tags.includes(t)));
        }
        if (query.search) {
            const searchLower = query.search.toLowerCase();
            results = results.filter(s => s.name.toLowerCase().includes(searchLower) ||
                s.description.toLowerCase().includes(searchLower) ||
                s.code.toLowerCase().includes(searchLower));
        }
        return results;
    }
    getGeneratedCode(id) {
        return this.generatedCode.get(id);
    }
    listTemplates() {
        return Array.from(this.templates.values());
    }
}
exports.CodeGenerator = CodeGenerator;
// ============================================================================
// Export
// ============================================================================
exports.default = CodeGenerator;
