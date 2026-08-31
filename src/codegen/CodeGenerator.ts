/**
 * Advanced Code Generation & Template Engine
 * Dynamic code generation, template processing, AST manipulation
 * Multi-language support, code formatting, validation
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CodeGeneratorConfig {
  defaultLanguage: ProgrammingLanguage;
  formatting: FormattingConfig;
  validation: boolean;
  autoImport: boolean;
  templateCache: boolean;
  outputDirectory: string;
}

export type ProgrammingLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'kotlin'
  | 'swift';

export interface FormattingConfig {
  indentSize: number;
  indentStyle: 'space' | 'tab';
  lineWidth: number;
  quotes: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
  bracketSpacing: boolean;
}

export interface Template {
  id: string;
  name: string;
  language: ProgrammingLanguage;
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
  compiled?: CompiledTemplate;
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  default?: any;
  description?: string;
  validation?: ValidationRule;
}

export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'identifier'
  | 'type'
  | 'expression';

export interface ValidationRule {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: any[];
  custom?: (value: any) => boolean;
}

export interface TemplateMetadata {
  author: string;
  version: string;
  description: string;
  tags: string[];
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CompiledTemplate {
  id: string;
  templateId: string;
  fn: (context: Record<string, any>) => string;
  ast?: any;
  compiledAt: number;
}

export interface CodeGenerationRequest {
  template: string | Template;
  context: Record<string, any>;
  language?: ProgrammingLanguage;
  formatting?: Partial<FormattingConfig>;
  validate?: boolean;
  format?: boolean;
}

export interface GeneratedCode {
  id: string;
  code: string;
  language: ProgrammingLanguage;
  formatted: boolean;
  validated: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: GenerationMetadata;
  ast?: any;
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  rule?: string;
}

export interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  suggestion?: string;
}

export interface GenerationMetadata {
  templateId?: string;
  generatedAt: number;
  variables: Record<string, any>;
  duration: number;
}

export interface CodeSnippet {
  id: string;
  name: string;
  language: ProgrammingLanguage;
  code: string;
  description: string;
  tags: string[];
  category: string;
  imports: string[];
}

export interface ClassDefinition {
  name: string;
  extends?: string;
  implements?: string[];
  properties: PropertyDefinition[];
  methods: MethodDefinition[];
  constructorParams?: ParameterDefinition[];
  decorators?: DecoratorDefinition[];
  isAbstract?: boolean;
  isExported?: boolean;
  documentation?: string;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isReadonly?: boolean;
  defaultValue?: any;
  decorators?: DecoratorDefinition[];
  documentation?: string;
}

export interface MethodDefinition {
  name: string;
  returnType: string;
  parameters: ParameterDefinition[];
  visibility: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAsync?: boolean;
  isAbstract?: boolean;
  body?: string;
  decorators?: DecoratorDefinition[];
  documentation?: string;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  optional?: boolean;
  defaultValue?: any;
  isRest?: boolean;
}

export interface DecoratorDefinition {
  name: string;
  arguments?: any[];
}

export interface InterfaceDefinition {
  name: string;
  extends?: string[];
  properties: InterfaceProperty[];
  methods: InterfaceMethod[];
  isExported?: boolean;
  documentation?: string;
}

export interface InterfaceProperty {
  name: string;
  type: string;
  optional?: boolean;
  readonly?: boolean;
  documentation?: string;
}

export interface InterfaceMethod {
  name: string;
  returnType: string;
  parameters: ParameterDefinition[];
  optional?: boolean;
  documentation?: string;
}

export interface FunctionDefinition {
  name: string;
  returnType: string;
  parameters: ParameterDefinition[];
  isAsync?: boolean;
  isExported?: boolean;
  isGenerator?: boolean;
  body: string;
  documentation?: string;
}

export interface ImportStatement {
  module: string;
  imports: ImportSpecifier[];
  isTypeOnly?: boolean;
  isDefault?: boolean;
}

export interface ImportSpecifier {
  name: string;
  alias?: string;
}

export interface AST {
  type: string;
  body: ASTNode[];
  sourceType: 'module' | 'script';
}

export interface ASTNode {
  type: string;
  [key: string]: any;
}

// ============================================================================
// Code Generator
// ============================================================================

export class CodeGenerator extends EventEmitter {
  private config: CodeGeneratorConfig;
  private templates: Map<string, Template> = new Map();
  private compiledTemplates: Map<string, CompiledTemplate> = new Map();
  private snippets: Map<string, CodeSnippet> = new Map();
  private generatedCode: Map<string, GeneratedCode> = new Map();

  constructor(config: Partial<CodeGeneratorConfig> = {}) {
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

  public registerTemplate(template: Omit<Template, 'id'>): Template {
    const full: Template = {
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

  private compileTemplate(template: Template): CompiledTemplate {
    const existing = this.compiledTemplates.get(template.id);
    if (existing) {
      return existing;
    }

    const compiled: CompiledTemplate = {
      id: this.generateId(),
      templateId: template.id,
      fn: this.createTemplateFunction(template),
      compiledAt: Date.now(),
    };

    this.compiledTemplates.set(template.id, compiled);
    this.emit('template:compiled', { compiled });

    return compiled;
  }

  private createTemplateFunction(template: Template): (context: Record<string, any>) => string {
    return (context: Record<string, any>) => {
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

  private validateVariable(variable: TemplateVariable, value: any): void {
    const rule = variable.validation!;

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

  private formatValue(value: any, type: VariableType): string {
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

  private processConditionals(content: string, context: Record<string, any>): string {
    const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return content.replace(ifPattern, (match, condition, body) => {
      return context[condition] ? body : '';
    });
  }

  private processLoops(content: string, context: Record<string, any>): string {
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

  public async generate(request: CodeGenerationRequest): Promise<GeneratedCode> {
    const startTime = Date.now();

    let template: Template;
    if (typeof request.template === 'string') {
      const found = this.templates.get(request.template);
      if (!found) {
        throw new Error(`Template not found: ${request.template}`);
      }
      template = found;
    } else {
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
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let validated = false;

    if (request.validate !== false && this.config.validation) {
      const validationResult = this.validate(code, request.language || template.language);
      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);
      validated = true;
    }

    const generated: GeneratedCode = {
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

  public generateClass(definition: ClassDefinition, language: ProgrammingLanguage = 'typescript'): string {
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

  private generateTypeScriptClass(def: ClassDefinition): string {
    const lines: string[] = [];

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
    if (def.isExported) declaration += 'export ';
    if (def.isAbstract) declaration += 'abstract ';
    declaration += `class ${def.name}`;
    if (def.extends) declaration += ` extends ${def.extends}`;
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
      if (prop.visibility !== 'public') propLine += `${prop.visibility} `;
      if (prop.isStatic) propLine += 'static ';
      if (prop.isReadonly) propLine += 'readonly ';
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
        if (p.optional) param += '?';
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
      if (method.visibility !== 'public') methodLine += `${method.visibility} `;
      if (method.isStatic) methodLine += 'static ';
      if (method.isAsync) methodLine += 'async ';
      if (method.isAbstract) methodLine += 'abstract ';

      const params = method.parameters.map(p => {
        let param = p.isRest ? '...' : '';
        param += p.name;
        if (p.optional) param += '?';
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
      } else {
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

  private generateJavaScriptClass(def: ClassDefinition): string {
    // Similar to TypeScript but without types
    return this.generateTypeScriptClass(def).replace(/:\s*\w+/g, '');
  }

  private generatePythonClass(def: ClassDefinition): string {
    const lines: string[] = [];

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
      if (method.isAsync) methodLine += 'async ';
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
      } else {
        lines.push('        pass');
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private generateJavaClass(def: ClassDefinition): string {
    const lines: string[] = [];

    if (def.documentation) {
      lines.push('/**');
      lines.push(` * ${def.documentation}`);
      lines.push(' */');
    }

    let declaration = 'public ';
    if (def.isAbstract) declaration += 'abstract ';
    declaration += `class ${def.name}`;
    if (def.extends) declaration += ` extends ${def.extends}`;
    if (def.implements && def.implements.length > 0) {
      declaration += ` implements ${def.implements.join(', ')}`;
    }
    lines.push(declaration + ' {');

    // Properties
    for (const prop of def.properties) {
      let propLine = '    ';
      propLine += `${prop.visibility} `;
      if (prop.isStatic) propLine += 'static ';
      if (prop.isReadonly) propLine += 'final ';
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
      if (method.isStatic) methodLine += 'static ';
      if (method.isAbstract) methodLine += 'abstract ';

      const params = method.parameters.map(p => `${p.type} ${p.name}`).join(', ');
      methodLine += `${method.returnType} ${method.name}(${params})`;

      if (method.isAbstract) {
        methodLine += ';';
        lines.push(methodLine);
      } else {
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

  public generateInterface(definition: InterfaceDefinition, language: ProgrammingLanguage = 'typescript'): string {
    if (language !== 'typescript' && language !== 'java' && language !== 'csharp') {
      throw new Error(`Interface generation not supported for ${language}`);
    }

    const lines: string[] = [];

    if (definition.documentation) {
      lines.push('/**');
      lines.push(` * ${definition.documentation}`);
      lines.push(' */');
    }

    let declaration = '';
    if (definition.isExported) declaration += 'export ';
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
      if (prop.readonly) propLine += 'readonly ';
      propLine += prop.name;
      if (prop.optional) propLine += '?';
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
        if (p.optional) param += '?';
        param += `: ${p.type}`;
        return param;
      }).join(', ');

      let methodLine = `  ${method.name}`;
      if (method.optional) methodLine += '?';
      methodLine += `(${params}): ${method.returnType};`;
      lines.push(methodLine);
    }

    lines.push('}');

    return lines.join('\n');
  }

  // ========================================================================
  // Function Generation
  // ========================================================================

  public generateFunction(definition: FunctionDefinition, language: ProgrammingLanguage = 'typescript'): string {
    const lines: string[] = [];

    if (definition.documentation) {
      lines.push('/**');
      lines.push(` * ${definition.documentation}`);
      lines.push(' */');
    }

    let declaration = '';
    if (definition.isExported) declaration += 'export ';
    if (definition.isAsync) declaration += 'async ';
    declaration += `function`;
    if (definition.isGenerator) declaration += '*';
    declaration += ` ${definition.name}`;

    const params = definition.parameters.map(p => {
      let param = p.isRest ? '...' : '';
      param += p.name;
      if (language === 'typescript') {
        if (p.optional) param += '?';
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

  public generateImports(imports: ImportStatement[], language: ProgrammingLanguage = 'typescript'): string {
    const lines: string[] = [];

    for (const imp of imports) {
      if (language === 'typescript' || language === 'javascript') {
        let line = 'import ';
        if (imp.isTypeOnly) line += 'type ';

        if (imp.isDefault) {
          line += imp.imports[0].name;
          if (imp.imports.length > 1) {
            line += ', { ';
            line += imp.imports.slice(1).map(i => {
              return i.alias ? `${i.name} as ${i.alias}` : i.name;
            }).join(', ');
            line += ' }';
          }
        } else {
          line += '{ ';
          line += imp.imports.map(i => {
            return i.alias ? `${i.name} as ${i.alias}` : i.name;
          }).join(', ');
          line += ' }';
        }

        line += ` from '${imp.module}';`;
        lines.push(line);
      } else if (language === 'python') {
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

  private format(code: string, language: ProgrammingLanguage, customConfig?: Partial<FormattingConfig>): string {
    const config = { ...this.config.formatting, ...customConfig };

    // Basic formatting
    let formatted = code;

    // Normalize line endings
    formatted = formatted.replace(/\r\n/g, '\n');

    // Apply indentation
    const indent = config.indentStyle === 'tab' ? '\t' : ' '.repeat(config.indentSize);
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const formattedLines: string[] = [];

    for (let line of lines) {
      line = line.trim();

      if (line.endsWith('}') || line.endsWith(']')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      if (line) {
        formattedLines.push(indent.repeat(indentLevel) + line);
      } else {
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
      } else {
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

  private validate(code: string, language: ProgrammingLanguage): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

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

  private toIdentifier(str: string): string {
    return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
  }

  private toTypeName(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
  }

  private toPascalCase(str: string): string {
    const camel = this.toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  private generateId(): string {
    return `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Snippet Management
  // ========================================================================

  public registerSnippet(snippet: Omit<CodeSnippet, 'id'>): CodeSnippet {
    const full: CodeSnippet = {
      ...snippet,
      id: this.generateId(),
    };

    this.snippets.set(full.id, full);
    this.emit('snippet:registered', { snippet: full });

    return full;
  }

  public getSnippet(id: string): CodeSnippet | undefined {
    return this.snippets.get(id);
  }

  public searchSnippets(query: SnippetQuery): CodeSnippet[] {
    let results = Array.from(this.snippets.values());

    if (query.language) {
      results = results.filter(s => s.language === query.language);
    }

    if (query.category) {
      results = results.filter(s => s.category === query.category);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(s => query.tags!.some(t => s.tags.includes(t)));
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter(
        s =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower) ||
          s.code.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  public getGeneratedCode(id: string): GeneratedCode | undefined {
    return this.generatedCode.get(id);
  }

  public listTemplates(): Template[] {
    return Array.from(this.templates.values());
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface SnippetQuery {
  language?: ProgrammingLanguage;
  category?: string;
  tags?: string[];
  search?: string;
}

// ============================================================================
// Export
// ============================================================================

export default CodeGenerator;
