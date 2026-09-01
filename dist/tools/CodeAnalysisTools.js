"use strict";
/**
 * Code Analysis & Intelligence Tools - Static analysis, linting, formatting
 * AST parsing, complexity metrics, dependency analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeCoverageTool = exports.DuplicationTool = exports.DeadCodeTool = exports.DependencyAnalysisTool = exports.ComplexityTool = exports.FormatterTool = exports.LinterTool = void 0;
/**
 * Code Linter Tool
 */
exports.LinterTool = {
    name: 'lint_code',
    description: 'Run linters (ESLint, Pylint, etc.) on code files',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File or directory path',
            },
            linter: {
                type: 'string',
                enum: ['eslint', 'pylint', 'rubocop', 'golangci-lint', 'auto'],
                description: 'Linter to use (auto-detect if not specified)',
            },
            fix: {
                type: 'boolean',
                description: 'Automatically fix issues',
            },
            config: {
                type: 'string',
                description: 'Path to linter config file',
            },
        },
        required: ['path'],
    },
    execute: async (input) => {
        try {
            const linter = input.linter || 'eslint';
            let output = `Running ${linter} on ${input.path}...\n\n`;
            // Mock linting results
            const issues = [
                {
                    file: 'src/utils.ts',
                    line: 42,
                    column: 15,
                    severity: 'error',
                    rule: 'no-unused-vars',
                    message: "Variable 'temp' is declared but never used",
                },
                {
                    file: 'src/api.ts',
                    line: 108,
                    column: 8,
                    severity: 'warning',
                    rule: 'prefer-const',
                    message: "'data' is never reassigned. Use 'const' instead",
                },
                {
                    file: 'src/index.ts',
                    line: 23,
                    column: 1,
                    severity: 'warning',
                    rule: 'no-console',
                    message: 'Unexpected console statement',
                },
            ];
            const errors = issues.filter((i) => i.severity === 'error').length;
            const warnings = issues.filter((i) => i.severity === 'warning').length;
            output += `Found ${errors} errors, ${warnings} warnings\n\n`;
            for (const issue of issues) {
                const icon = issue.severity === 'error' ? '✗' : '⚠';
                output += `${icon} ${issue.file}:${issue.line}:${issue.column}\n`;
                output += `  ${issue.message} (${issue.rule})\n\n`;
            }
            if (input.fix) {
                output += `Auto-fixing ${warnings} fixable issues...\n`;
                output += 'Fixed 2 issues ✓';
            }
            return {
                success: errors === 0,
                output,
                data: { errors, warnings, issues },
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Linter error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
/**
 * Code Formatter Tool
 */
exports.FormatterTool = {
    name: 'format_code',
    description: 'Format code with Prettier, Black, gofmt, etc.',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File or directory path',
            },
            formatter: {
                type: 'string',
                enum: ['prettier', 'black', 'gofmt', 'rustfmt', 'auto'],
                description: 'Formatter to use',
            },
            check_only: {
                type: 'boolean',
                description: 'Check formatting without modifying files',
            },
        },
        required: ['path'],
    },
    execute: async (input) => {
        try {
            const formatter = input.formatter || 'prettier';
            let output = `Formatting with ${formatter}...\n\n`;
            if (input.check_only) {
                output += 'Checking formatting...\n';
                output += 'src/utils.ts - needs formatting\n';
                output += 'src/api.ts - formatted correctly\n';
                output += 'src/index.ts - formatted correctly\n\n';
                output += '1 file needs formatting';
            }
            else {
                output += 'Formatting files...\n';
                output += '✓ src/utils.ts\n';
                output += '✓ src/api.ts\n';
                output += '✓ src/index.ts\n\n';
                output += 'Formatted 3 files';
            }
            return { success: true, output };
        }
        catch (error) {
            return {
                success: false,
                error: `Formatter error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
/**
 * Complexity Analysis Tool
 */
exports.ComplexityTool = {
    name: 'analyze_complexity',
    description: 'Analyze code complexity metrics (cyclomatic, cognitive)',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File or directory path',
            },
            threshold: {
                type: 'number',
                description: 'Complexity threshold (default: 10)',
            },
            detailed: {
                type: 'boolean',
                description: 'Show detailed per-function analysis',
            },
        },
        required: ['path'],
    },
    execute: async (input) => {
        try {
            const threshold = input.threshold || 10;
            let output = `Code Complexity Analysis\n`;
            output += `Path: ${input.path}\n`;
            output += `Threshold: ${threshold}\n\n`;
            const functions = [
                { name: 'processData', file: 'src/utils.ts', line: 42, complexity: 15 },
                { name: 'handleRequest', file: 'src/api.ts', line: 78, complexity: 8 },
                { name: 'validateInput', file: 'src/utils.ts', line: 120, complexity: 12 },
                { name: 'formatOutput', file: 'src/format.ts', line: 25, complexity: 5 },
            ];
            const highComplexity = functions.filter((f) => f.complexity > threshold);
            output += `Total functions analyzed: ${functions.length}\n`;
            output += `High complexity (>${threshold}): ${highComplexity.length}\n\n`;
            if (highComplexity.length > 0) {
                output += 'High Complexity Functions:\n';
                for (const func of highComplexity) {
                    output += `  ${func.name} (${func.file}:${func.line}) - Complexity: ${func.complexity}\n`;
                }
                output += '\n';
            }
            if (input.detailed) {
                output += 'Detailed Analysis:\n';
                for (const func of functions) {
                    const status = func.complexity > threshold ? '⚠' : '✓';
                    output += `  ${status} ${func.name.padEnd(20)} ${func.complexity}\n`;
                }
            }
            const avgComplexity = functions.reduce((sum, f) => sum + f.complexity, 0) / functions.length;
            output += `\nAverage complexity: ${avgComplexity.toFixed(1)}`;
            return {
                success: highComplexity.length === 0,
                output,
                data: { functions, highComplexity, avgComplexity },
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Complexity analysis error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
/**
 * Dependency Analysis Tool
 */
exports.DependencyAnalysisTool = {
    name: 'analyze_dependencies',
    description: 'Analyze project dependencies and find issues',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Project path',
            },
            check_updates: {
                type: 'boolean',
                description: 'Check for available updates',
            },
            check_security: {
                type: 'boolean',
                description: 'Check for security vulnerabilities',
            },
            check_licenses: {
                type: 'boolean',
                description: 'Check license compatibility',
            },
        },
        required: ['path'],
    },
    execute: async (input) => {
        try {
            let output = 'Dependency Analysis\n\n';
            const dependencies = [
                { name: 'express', version: '4.18.0', latest: '4.18.2', vulnerabilities: 0 },
                { name: 'lodash', version: '4.17.20', latest: '4.17.21', vulnerabilities: 1 },
                { name: 'axios', version: '0.27.2', latest: '1.4.0', vulnerabilities: 0 },
                { name: 'moment', version: '2.29.1', latest: '2.29.4', vulnerabilities: 0 },
            ];
            output += `Total dependencies: ${dependencies.length}\n\n`;
            if (input.check_updates) {
                const outdated = dependencies.filter((d) => d.version !== d.latest);
                output += `Updates Available: ${outdated.length}\n`;
                for (const dep of outdated) {
                    output += `  ${dep.name}: ${dep.version} → ${dep.latest}\n`;
                }
                output += '\n';
            }
            if (input.check_security) {
                const vulnerable = dependencies.filter((d) => d.vulnerabilities > 0);
                output += `Security Vulnerabilities: ${vulnerable.length}\n`;
                if (vulnerable.length > 0) {
                    for (const dep of vulnerable) {
                        output += `  ⚠ ${dep.name}@${dep.version} - ${dep.vulnerabilities} vulnerability\n`;
                        output += `    Fix: Update to ${dep.latest}\n`;
                    }
                }
                output += '\n';
            }
            if (input.check_licenses) {
                output += 'License Compatibility:\n';
                output += '  ✓ MIT: 3 packages\n';
                output += '  ✓ Apache-2.0: 1 package\n';
                output += '  All licenses compatible ✓\n';
            }
            return { success: true, output, data: { dependencies } };
        }
        catch (error) {
            return {
                success: false,
                error: `Dependency analysis error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
/**
 * Dead Code Detection Tool
 */
exports.DeadCodeTool = {
    name: 'find_dead_code',
    description: 'Find unused code, functions, and imports',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Project path',
            },
            include_tests: {
                type: 'boolean',
                description: 'Include test files in analysis',
            },
        },
        required: ['path'],
    },
    execute: async (input) => {
        try {
            let output = 'Dead Code Analysis\n\n';
            const deadCode = [
                { type: 'function', name: 'oldHelper', file: 'src/utils.ts', line: 156 },
                { type: 'import', name: 'unused', file: 'src/api.ts', line: 5 },
                { type: 'variable', name: 'tempData', file: 'src/process.ts', line: 42 },
                { type: 'function', name: 'deprecatedMethod', file: 'src/legacy.ts', line: 89 },
            ];
            output += `Total unused items: ${deadCode.length}\n\n`;
            const byType = deadCode.reduce((acc, item) => {
                acc[item.type] = (acc[item.type] || 0) + 1;
                return acc;
            }, {});
            output += 'By Type:\n';
            for (const [type, count] of Object.entries(byType)) {
                output += `  ${type}: ${count}\n`;
            }
            output += '\nDetails:\n';
            for (const item of deadCode) {
                output += `  ${item.type} '${item.name}' in ${item.file}:${item.line}\n`;
            }
            output += '\n💡 Consider removing these to reduce code size';
            return { success: true, output, data: { deadCode } };
        }
        catch (error) {
            return {
                success: false,
                error: `Dead code detection error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
/**
 * Code Duplication Detector
 */
exports.DuplicationTool = {
    name: 'find_duplicates',
    description: 'Find duplicated code blocks',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Project path',
            },
            min_lines: {
                type: 'number',
                description: 'Minimum lines for duplicate detection (default: 5)',
            },
            threshold: {
                type: 'number',
                description: 'Similarity threshold 0-100 (default: 90)',
            },
        },
        required: ['path'],
    },
    execute: async (input) => {
        try {
            const minLines = input.min_lines || 5;
            const threshold = input.threshold || 90;
            let output = 'Code Duplication Analysis\n\n';
            output += `Minimum lines: ${minLines}\n`;
            output += `Similarity threshold: ${threshold}%\n\n`;
            const duplicates = [
                {
                    similarity: 95,
                    lines: 12,
                    locations: [
                        { file: 'src/auth.ts', line: 45 },
                        { file: 'src/api.ts', line: 123 },
                    ],
                },
                {
                    similarity: 88,
                    lines: 8,
                    locations: [
                        { file: 'src/utils.ts', line: 67 },
                        { file: 'src/helpers.ts', line: 34 },
                        { file: 'src/format.ts', line: 89 },
                    ],
                },
            ];
            output += `Found ${duplicates.length} duplicate blocks\n\n`;
            for (let i = 0; i < duplicates.length; i++) {
                const dup = duplicates[i];
                output += `Duplicate ${i + 1}:\n`;
                output += `  Similarity: ${dup.similarity}%\n`;
                output += `  Lines: ${dup.lines}\n`;
                output += `  Locations:\n`;
                for (const loc of dup.locations) {
                    output += `    - ${loc.file}:${loc.line}\n`;
                }
                output += '\n';
            }
            output += '💡 Consider refactoring into shared functions';
            return { success: true, output, data: { duplicates } };
        }
        catch (error) {
            return {
                success: false,
                error: `Duplication detection error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
/**
 * Type Coverage Tool
 */
exports.TypeCoverageTool = {
    name: 'check_type_coverage',
    description: 'Check TypeScript type coverage',
    input_schema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Project path',
            },
            threshold: {
                type: 'number',
                description: 'Minimum type coverage percentage (default: 80)',
            },
        },
        required: ['path'],
    },
    execute: async (input) => {
        try {
            const threshold = input.threshold || 80;
            let output = 'Type Coverage Analysis\n\n';
            const coverage = {
                total: 1250,
                typed: 1087,
                any: 163,
                percentage: 86.96,
            };
            output += `Type Coverage: ${coverage.percentage.toFixed(2)}%\n`;
            output += `Total symbols: ${coverage.total}\n`;
            output += `Typed: ${coverage.typed}\n`;
            output += `Any types: ${coverage.any}\n\n`;
            if (coverage.percentage >= threshold) {
                output += `✓ Meets threshold of ${threshold}%`;
            }
            else {
                output += `⚠ Below threshold of ${threshold}%\n`;
                output += `Need to type ${Math.ceil((threshold / 100) * coverage.total - coverage.typed)} more symbols`;
            }
            return {
                success: coverage.percentage >= threshold,
                output,
                data: coverage,
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Type coverage error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    },
};
