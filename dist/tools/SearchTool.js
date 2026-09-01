"use strict";
// Code Search Tool
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchCodeTool = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class SearchCodeTool {
    name = 'search_code';
    description = `Search for text patterns in files within the workspace.
Use this to find function definitions, variable usage, imports, or any text pattern.
Supports regex patterns and file filtering.`;
    inputSchema = {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Text or regex pattern to search for',
            },
            filePattern: {
                type: 'string',
                description: 'File glob pattern (e.g., "*.ts", "src/**/*.js")',
            },
            directory: {
                type: 'string',
                description: 'Directory to search in (relative to workspace root, default: ".")',
            },
            regex: {
                type: 'boolean',
                description: 'Treat pattern as regex (default: false)',
            },
            caseSensitive: {
                type: 'boolean',
                description: 'Case sensitive search (default: true)',
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 100)',
            },
        },
        required: ['pattern'],
    };
    async execute(input, context) {
        try {
            const pattern = input.pattern;
            const directory = input.directory || '.';
            const isRegex = input.regex ?? false;
            const caseSensitive = input.caseSensitive ?? true;
            const maxResults = input.maxResults ?? 100;
            const searchDir = path.resolve(context.workspaceRoot, directory);
            // Validate path
            if (!searchDir.startsWith(context.workspaceRoot)) {
                return {
                    success: false,
                    error: 'Search directory is outside workspace',
                };
            }
            const searchPattern = isRegex
                ? new RegExp(pattern, caseSensitive ? 'g' : 'gi')
                : null;
            const results = [];
            const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.cache'];
            await this.searchDirectory(searchDir, context.workspaceRoot, pattern, searchPattern, caseSensitive, excludeDirs, results, maxResults);
            if (results.length === 0) {
                return {
                    success: true,
                    output: 'No matches found.',
                };
            }
            const output = this.formatResults(results);
            return {
                success: true,
                output,
                metadata: {
                    matchCount: results.length,
                    truncated: results.length >= maxResults,
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async searchDirectory(dirPath, workspaceRoot, pattern, searchPattern, caseSensitive, excludeDirs, results, maxResults) {
        if (results.length >= maxResults) {
            return;
        }
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (results.length >= maxResults) {
                break;
            }
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (!excludeDirs.includes(entry.name)) {
                    await this.searchDirectory(fullPath, workspaceRoot, pattern, searchPattern, caseSensitive, excludeDirs, results, maxResults);
                }
            }
            else if (entry.isFile()) {
                // Skip binary and large files
                const stats = await fs.stat(fullPath);
                if (stats.size > 1024 * 1024)
                    continue; // Skip files > 1MB
                try {
                    await this.searchFile(fullPath, workspaceRoot, pattern, searchPattern, caseSensitive, results, maxResults);
                }
                catch {
                    // Skip files that can't be read
                }
            }
        }
    }
    async searchFile(filePath, workspaceRoot, pattern, searchPattern, caseSensitive, results, maxResults) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(workspaceRoot, filePath);
        for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) {
                break;
            }
            const line = lines[i];
            let matches = false;
            if (searchPattern) {
                matches = searchPattern.test(line);
            }
            else {
                const searchLine = caseSensitive ? line : line.toLowerCase();
                const searchTerm = caseSensitive ? pattern : pattern.toLowerCase();
                matches = searchLine.includes(searchTerm);
            }
            if (matches) {
                results.push({
                    file: relativePath,
                    line: i + 1,
                    content: line.trim(),
                });
            }
        }
    }
    formatResults(results) {
        const grouped = new Map();
        for (const result of results) {
            if (!grouped.has(result.file)) {
                grouped.set(result.file, []);
            }
            grouped.get(result.file).push({
                line: result.line,
                content: result.content,
            });
        }
        const output = [];
        for (const [file, matches] of grouped) {
            output.push(`\n${file}:`);
            for (const match of matches) {
                output.push(`  ${match.line}: ${match.content}`);
            }
        }
        return output.join('\n');
    }
}
exports.SearchCodeTool = SearchCodeTool;
