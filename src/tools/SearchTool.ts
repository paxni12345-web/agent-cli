// Code Search Tool

import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolContext, ToolResult } from '../types/index.js';

export class SearchCodeTool implements Tool {
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

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
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

      const results: SearchResult[] = [];
      const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.cache'];

      await this.searchDirectory(
        searchDir,
        context.workspaceRoot,
        pattern,
        searchPattern,
        caseSensitive,
        excludeDirs,
        results,
        maxResults
      );

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
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async searchDirectory(
    dirPath: string,
    workspaceRoot: string,
    pattern: string,
    searchPattern: RegExp | null,
    caseSensitive: boolean,
    excludeDirs: string[],
    results: SearchResult[],
    maxResults: number
  ): Promise<void> {
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
          await this.searchDirectory(
            fullPath,
            workspaceRoot,
            pattern,
            searchPattern,
            caseSensitive,
            excludeDirs,
            results,
            maxResults
          );
        }
      } else if (entry.isFile()) {
        // Skip binary and large files
        const stats = await fs.stat(fullPath);
        if (stats.size > 1024 * 1024) continue; // Skip files > 1MB

        try {
          await this.searchFile(
            fullPath,
            workspaceRoot,
            pattern,
            searchPattern,
            caseSensitive,
            results,
            maxResults
          );
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  private async searchFile(
    filePath: string,
    workspaceRoot: string,
    pattern: string,
    searchPattern: RegExp | null,
    caseSensitive: boolean,
    results: SearchResult[],
    maxResults: number
  ): Promise<void> {
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
      } else {
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

  private formatResults(results: SearchResult[]): string {
    const grouped = new Map<string, Array<{ line: number; content: string }>>();

    for (const result of results) {
      if (!grouped.has(result.file)) {
        grouped.set(result.file, []);
      }
      grouped.get(result.file)!.push({
        line: result.line,
        content: result.content,
      });
    }

    const output: string[] = [];

    for (const [file, matches] of grouped) {
      output.push(`\n${file}:`);
      for (const match of matches) {
        output.push(`  ${match.line}: ${match.content}`);
      }
    }

    return output.join('\n');
  }
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
}
