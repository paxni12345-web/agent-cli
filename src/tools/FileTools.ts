// File System Tools

import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolContext, ToolResult, ToolError, WorkspaceError } from '../types/index.js';

/**
 * Secure path validation and sanitization utility
 * Prevents path traversal attacks by canonicalizing paths and enforcing workspace boundaries
 */
class PathValidator {
  // Dangerous path patterns that should be blocked
  private static readonly DANGEROUS_PATTERNS = [
    /\.\./,           // Parent directory traversal
    /\0/,             // Null byte injection
    /%2e%2e/i,        // URL encoded ..
    /%252e/i,         // Double URL encoded .
    /%5c/i,           // URL encoded backslash
    /\.\.\\/,         // Windows-style traversal
    /\/\.\./,         // Unix-style traversal
    /\/{2,}/,         // Multiple consecutive slashes
  ];

  /**
   * Sanitizes a user-provided path by removing dangerous characters and patterns
   */
  static sanitizePath(userPath: string): string {
    if (!userPath || typeof userPath !== 'string') {
      throw new WorkspaceError('Invalid path: path must be a non-empty string');
    }

    // Decode any URL encoding attempts
    let decoded = userPath;
    try {
      // Decode up to 3 times to catch multiple encoding layers
      for (let i = 0; i < 3; i++) {
        const newDecoded = decodeURIComponent(decoded);
        if (newDecoded === decoded) break;
        decoded = newDecoded;
      }
    } catch {
      throw new WorkspaceError('Invalid path: contains malformed URL encoding');
    }

    // Check for dangerous patterns
    for (const pattern of PathValidator.DANGEROUS_PATTERNS) {
      if (pattern.test(decoded)) {
        throw new WorkspaceError(`Invalid path: contains dangerous pattern ${pattern}`);
      }
    }

    // Remove null bytes and control characters
    const sanitized = decoded.replace(/[\x00-\x1f\x7f]/g, '');

    if (sanitized !== decoded) {
      throw new WorkspaceError('Invalid path: contains control characters');
    }

    return sanitized;
  }

  /**
   * Validates that a target path is within the workspace boundary
   * Uses canonical paths (resolving symlinks) to prevent bypasses
   */
  static async validateWorkspaceBoundary(
    targetPath: string,
    workspaceRoot: string
  ): Promise<string> {
    // Ensure workspace root is absolute
    const absoluteWorkspace = path.resolve(workspaceRoot);

    // Resolve target to absolute path
    const absoluteTarget = path.resolve(absoluteWorkspace, targetPath);

    // Canonicalize both paths (resolve symlinks)
    let canonicalWorkspace: string;
    let canonicalTarget: string;

    try {
      // Get canonical workspace path
      canonicalWorkspace = await fs.realpath(absoluteWorkspace);
    } catch (error: any) {
      throw new WorkspaceError(`Workspace root is invalid: ${error.message}`);
    }

    try {
      // For target path, we need to handle non-existent files
      // Canonicalize the existing parent directory
      let pathToCheck = absoluteTarget;
      let relativeSuffix = '';

      // Walk up until we find an existing path
      while (true) {
        try {
          const exists = await fs.access(pathToCheck).then(() => true).catch(() => false);
          if (exists) {
            const canonical = await fs.realpath(pathToCheck);
            canonicalTarget = relativeSuffix
              ? path.join(canonical, relativeSuffix)
              : canonical;
            break;
          }
        } catch {
          // Path doesn't exist, continue
        }

        const parent = path.dirname(pathToCheck);
        if (parent === pathToCheck) {
          // Reached root without finding existing path
          throw new WorkspaceError('Cannot validate path: no parent directory exists');
        }

        const basename = path.basename(pathToCheck);
        relativeSuffix = relativeSuffix ? path.join(basename, relativeSuffix) : basename;
        pathToCheck = parent;
      }
    } catch (error: any) {
      if (error instanceof WorkspaceError) {
        throw error;
      }
      throw new WorkspaceError(`Cannot canonicalize path: ${error.message}`);
    }

    // Normalize to ensure consistent trailing behavior
    const normalizedWorkspace = path.normalize(canonicalWorkspace + path.sep);
    const normalizedTarget = path.normalize(canonicalTarget + path.sep);

    // Check if target is within workspace
    if (!normalizedTarget.startsWith(normalizedWorkspace)) {
      throw new WorkspaceError('Path is outside workspace boundary');
    }

    // Additional check: ensure no path segments escape the workspace
    const relativePath = path.relative(canonicalWorkspace, canonicalTarget);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new WorkspaceError('Path traversal detected');
    }

    return canonicalTarget;
  }

  /**
   * Complete path validation: sanitize, resolve, and validate workspace boundary
   */
  static async validatePath(
    userPath: string,
    workspaceRoot: string
  ): Promise<string> {
    // Step 1: Sanitize input
    const sanitized = PathValidator.sanitizePath(userPath);

    // Step 2: Validate workspace boundary
    const validated = await PathValidator.validateWorkspaceBoundary(sanitized, workspaceRoot);

    return validated;
  }
}

export class ListFilesTool implements Tool {
  name = 'list_files';
  description = `List files and directories in the workspace.
Use this to explore the project structure and find relevant files.
Supports recursive listing with depth control and exclude patterns.`;

  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path from workspace root (default: ".")',
      },
      recursive: {
        type: 'boolean',
        description: 'List files recursively',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth for recursive listing (default: 10)',
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns to exclude (e.g., "node_modules", ".git")',
      },
    },
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const targetPath = input.path || '.';
      const recursive = input.recursive ?? true;
      const maxDepth = input.maxDepth ?? 10;
      const excludePatterns = input.excludePatterns || [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        '.cache',
        '.tmp',
        '.DS_Store',
      ];

      const fullPath = this.resolvePath(context.workspaceRoot, targetPath);
      await this.validatePath(fullPath, context.workspaceRoot);

      const files = await this.listDirectory(
        fullPath,
        context.workspaceRoot,
        recursive,
        maxDepth,
        excludePatterns,
        0
      );

      return {
        success: true,
        output: files.join('\n'),
        metadata: { count: files.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async listDirectory(
    dirPath: string,
    workspaceRoot: string,
    recursive: boolean,
    maxDepth: number,
    excludePatterns: string[],
    currentDepth: number
  ): Promise<string[]> {
    if (currentDepth > maxDepth) {
      return [];
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const relativePath = path.relative(workspaceRoot, path.join(dirPath, entry.name));

      // Check exclude patterns
      if (excludePatterns.some(pattern => relativePath.includes(pattern) || entry.name === pattern)) {
        continue;
      }

      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        if (recursive) {
          const subFiles = await this.listDirectory(
            path.join(dirPath, entry.name),
            workspaceRoot,
            recursive,
            maxDepth,
            excludePatterns,
            currentDepth + 1
          );
          results.push(...subFiles);
        }
      } else {
        results.push(relativePath);
      }
    }

    return results.sort();
  }

  private resolvePath(workspaceRoot: string, targetPath: string): string {
    const resolved = path.resolve(workspaceRoot, targetPath);
    return resolved;
  }

  private async validatePath(targetPath: string, workspaceRoot: string): Promise<void> {
    // Use secure path validator
    await PathValidator.validatePath(targetPath, workspaceRoot);

    // Check if path exists
    try {
      await fs.access(targetPath);
    } catch {
      throw new ToolError(`Path does not exist: ${path.relative(workspaceRoot, targetPath)}`);
    }
  }
}

export class ReadFileTool implements Tool {
  name = 'read_file';
  description = `Read text content from a file inside the current workspace.
Use when you need to inspect source code, configuration, or documentation.
Supports reading specific line ranges to avoid loading large files entirely.`;

  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file from workspace root',
      },
      startLine: {
        type: 'number',
        description: 'Starting line number (1-indexed, optional)',
      },
      endLine: {
        type: 'number',
        description: 'Ending line number (inclusive, optional)',
      },
    },
    required: ['path'],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(context.workspaceRoot, input.path);
      const validatedPath = await PathValidator.validatePath(input.path, context.workspaceRoot);

      // Check if it's a binary file
      if (await this.isBinaryFile(validatedPath)) {
        return {
          success: false,
          error: 'Cannot read binary file. Use appropriate tools for binary content.',
        };
      }

      let content = await fs.readFile(validatedPath, 'utf-8');

      // Handle line range if specified
      if (input.startLine !== undefined || input.endLine !== undefined) {
        const lines = content.split('\n');
        const start = (input.startLine || 1) - 1;
        const end = input.endLine || lines.length;
        content = lines.slice(start, end).join('\n');
      }

      // Truncate if too large
      const maxSize = 100000; // ~100KB
      if (content.length > maxSize) {
        content = content.substring(0, maxSize) + '\n\n[... truncated ...]';
      }

      return {
        success: true,
        output: content,
        metadata: {
          path: input.path,
          size: content.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async validatePath(targetPath: string, workspaceRoot: string): Promise<void> {
    const validatedPath = await PathValidator.validatePath(targetPath, workspaceRoot);

    try {
      const stat = await fs.stat(validatedPath);
      if (!stat.isFile()) {
        throw new ToolError('Path is not a file');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new ToolError('File does not exist');
      }
      throw error;
    }
  }

  private async isBinaryFile(filePath: string): Promise<boolean> {
    const buffer = Buffer.alloc(512);
    const fd = await fs.open(filePath, 'r');
    try {
      await fd.read(buffer, 0, 512, 0);
      // Simple heuristic: check for null bytes
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      return false;
    } finally {
      await fd.close();
    }
  }
}

export class WriteFileTool implements Tool {
  name = 'write_file';
  description = `Create a new file or overwrite an existing file with new content.
Use when you need to create new files or completely replace file contents.
For partial modifications, use edit_file instead.`;

  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file from workspace root',
      },
      content: {
        type: 'string',
        description: 'Full content to write to the file',
      },
    },
    required: ['path', 'content'],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const validatedPath = await PathValidator.validatePath(input.path, context.workspaceRoot);

      // Check permission
      const permissionResult = await context.permissions.check({
        type: 'write_file',
        description: `Write file: ${input.path}`,
        target: input.path,
        risk: 'medium',
      });

      if (!permissionResult.allowed) {
        return {
          success: false,
          error: `Permission denied: ${permissionResult.reason}`,
        };
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(validatedPath), { recursive: true });

      // Write file
      await fs.writeFile(validatedPath, input.content, 'utf-8');

      return {
        success: true,
        output: `File written successfully: ${input.path}`,
        metadata: {
          path: input.path,
          size: input.content.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async validatePath(targetPath: string, workspaceRoot: string): Promise<void> {
    await PathValidator.validatePath(targetPath, workspaceRoot);
  }
}

export class EditFileTool implements Tool {
  name = 'edit_file';
  description = `Edit specific parts of a file by replacing old content with new content.
You must provide the exact old text to be replaced - this ensures accuracy.
If the old text doesn't match exactly, the operation will fail to prevent incorrect edits.`;

  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file from workspace root',
      },
      oldText: {
        type: 'string',
        description: 'Exact text to replace (must match exactly)',
      },
      newText: {
        type: 'string',
        description: 'New text to insert in place of old text',
      },
      replaceAll: {
        type: 'boolean',
        description: 'Replace all occurrences (default: false, requires unique match)',
      },
    },
    required: ['path', 'oldText', 'newText'],
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const validatedPath = await PathValidator.validatePath(input.path, context.workspaceRoot);

      // Check permission
      const permissionResult = await context.permissions.check({
        type: 'write_file',
        description: `Edit file: ${input.path}`,
        target: input.path,
        risk: 'medium',
      });

      if (!permissionResult.allowed) {
        return {
          success: false,
          error: `Permission denied: ${permissionResult.reason}`,
        };
      }

      // Read current content
      const content = await fs.readFile(validatedPath, 'utf-8');

      // Check if old text exists
      const occurrences = content.split(input.oldText).length - 1;

      if (occurrences === 0) {
        return {
          success: false,
          error: 'Old text not found in file. Cannot edit.',
        };
      }

      if (occurrences > 1 && !input.replaceAll) {
        return {
          success: false,
          error: `Old text appears ${occurrences} times. Use replaceAll: true or provide more specific text.`,
        };
      }

      // Perform replacement
      const newContent = input.replaceAll
        ? content.replaceAll(input.oldText, input.newText)
        : content.replace(input.oldText, input.newText);

      // Write back
      await fs.writeFile(validatedPath, newContent, 'utf-8');

      return {
        success: true,
        output: `File edited successfully: ${input.path} (${occurrences} replacement${occurrences > 1 ? 's' : ''})`,
        metadata: {
          path: input.path,
          replacements: occurrences,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async validatePath(targetPath: string, workspaceRoot: string): Promise<void> {
    const validatedPath = await PathValidator.validatePath(targetPath, workspaceRoot);

    try {
      const stat = await fs.stat(validatedPath);
      if (!stat.isFile()) {
        throw new ToolError('Path is not a file');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new ToolError('File does not exist');
      }
      throw error;
    }
  }
}
