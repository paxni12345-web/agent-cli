# Contributing to Agent CLI

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Coding Standards](#coding-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Adding New Features](#adding-new-features)

---

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect differing opinions and experiences

---

## Getting Started

### Prerequisites

- Node.js 18+ or 20+
- npm or yarn
- Git
- TypeScript knowledge

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/agent-cli.git
   cd agent-cli
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/agent-cli.git
   ```

---

## Development Setup

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Check formatting
npm run format:check

# Format code
npm run format
```

### Development Mode

```bash
# Watch mode (auto-rebuild on changes)
npm run dev
```

### Run the CLI Locally

```bash
# After building
npm start

# Or link globally
npm link
agent run
```

---

## Project Structure

```
agent-cli/
├── src/
│   ├── agent/           # Core agent logic
│   ├── providers/       # AI provider implementations
│   ├── tools/           # Tool implementations
│   ├── types/           # TypeScript type definitions
│   ├── config/          # Configuration management
│   ├── security/        # Permission management
│   ├── cli/             # CLI interface
│   └── ...              # Other modules
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── security/        # Security tests
├── docs/                # Documentation
└── examples/            # Example code
```

---

## Coding Standards

### TypeScript

- **Use strict mode**: Enabled in `tsconfig.json`
- **Type everything**: Avoid `any` when possible
- **Use interfaces** for public APIs
- **Document with JSDoc**: All public methods and classes

### Naming Conventions

- **Classes**: PascalCase (`Agent`, `ToolRegistry`)
- **Interfaces**: PascalCase (`Tool`, `Config`)
- **Variables/Functions**: camelCase (`readFile`, `toolRegistry`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_ITERATIONS`)
- **Private members**: Prefix with underscore (`_privateMethod`)

### File Organization

- **One class per file**: `Agent.ts` contains only `Agent` class
- **Grouped exports**: Use `index.ts` for module exports
- **Test files**: `*.test.ts` for unit tests, `*.integration.test.ts` for integration

### Code Style

```typescript
// Good
export class Agent {
  /**
   * Runs the agent with a user message
   * @param userMessage - The user's task
   * @returns Agent response
   */
  async run(userMessage: string): Promise<string> {
    // Implementation
  }
}

// Bad
export class agent {
  async run(msg: any) {
    // No documentation, poor types
  }
}
```

### Error Handling

```typescript
// Good - Specific error types
throw new AgentError('Max iterations exceeded', 'MAX_ITERATIONS');

// Good - Proper error handling
try {
  await tool.execute(input, context);
} catch (error) {
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}

// Bad - Generic errors
throw new Error('Something went wrong');
```

### Async/Await

```typescript
// Good
async function processFiles() {
  const files = await listFiles();
  for (const file of files) {
    await processFile(file);
  }
}

// Bad - Unhandled promises
function processFiles() {
  listFiles().then(files => {
    files.forEach(file => processFile(file));
  });
}
```

---

## Testing Guidelines

### Test Structure

```typescript
describe('ComponentName', () => {
  let component: ComponentName;

  beforeEach(() => {
    component = new ComponentName();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = component.methodName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle error cases', () => {
      expect(() => component.methodName(null)).toThrow();
    });
  });
});
```

### Test Coverage Goals

- **Unit tests**: 80%+ coverage
- **Integration tests**: Critical workflows
- **Edge cases**: Error handling, boundary conditions
- **Security tests**: Permission checks, path traversal

### Writing Good Tests

```typescript
// Good - Descriptive, isolated, single assertion
it('should return file contents when file exists', async () => {
  const tool = new ReadFileTool();
  const result = await tool.execute({ path: 'test.txt' }, context);
  expect(result.success).toBe(true);
});

// Bad - Multiple assertions, unclear purpose
it('test read', async () => {
  const result = await tool.execute({ path: 'test.txt' }, context);
  expect(result.success).toBe(true);
  expect(result.output).toBeDefined();
  expect(result.error).toBeUndefined();
});
```

### Mocking

```typescript
// Good - Mock external dependencies
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue(mockResponse)
    }
  }))
}));
```

---

## Pull Request Process

### Before Submitting

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write code following our standards
   - Add tests for new functionality
   - Update documentation

3. **Test everything**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `test:` Adding tests
   - `refactor:` Code refactoring
   - `style:` Code style changes
   - `chore:` Build process or tooling

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Template

When opening a PR, include:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. **Automated checks**: CI/CD runs tests and linting
2. **Code review**: Maintainer reviews your code
3. **Address feedback**: Make requested changes
4. **Approval**: PR is approved and merged

---

## Adding New Features

### Creating a New Tool

1. **Create tool file**: `src/tools/YourTool.ts`

```typescript
import { Tool, ToolContext, ToolResult } from '../types';

export class YourTool implements Tool {
  name = 'your_tool';
  description = 'What your tool does';
  
  inputSchema = {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' }
    },
    required: ['param1']
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      // Validate input
      if (!input.param1) {
        return { success: false, error: 'param1 is required' };
      }

      // Check permissions
      const allowed = await context.permissions.requestPermission(
        'your_tool',
        { param1: input.param1 }
      );
      if (!allowed) {
        return { success: false, error: 'Permission denied' };
      }

      // Your tool logic
      const result = doSomething(input.param1);

      return { success: true, output: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

2. **Add tests**: `tests/unit/YourTool.test.ts`

3. **Register in CLI**: Update `src/cli.ts`

4. **Document**: Add to `docs/API.md`

### Adding a New AI Provider

1. **Create provider file**: `src/providers/YourProvider.ts`

```typescript
import { BaseAIProvider } from './AIProvider';
import { ChatRequest, ChatResponse } from '../types';

export class YourProvider extends BaseAIProvider {
  name = 'your_provider';
  private client: YourClient;

  constructor(apiKey: string, options?: any) {
    super();
    this.client = new YourClient({ apiKey, ...options });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Implement chat completion
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    // Implement streaming
  }
}
```

2. **Add tests**

3. **Update CLI to support new provider**

4. **Document in README and API docs**

---

## Documentation

### JSDoc Comments

All public APIs must have JSDoc:

```typescript
/**
 * Brief description of what this does
 *
 * Longer description if needed, explaining the purpose,
 * behavior, and any important notes.
 *
 * @param paramName - Parameter description
 * @returns Description of return value
 * @throws ErrorType - When this error is thrown
 *
 * @example
 * ```typescript
 * const result = myFunction('input');
 * console.log(result);
 * ```
 */
export function myFunction(paramName: string): string {
  // ...
}
```

### README Updates

Update `README.md` for:
- New features
- Breaking changes
- Installation changes
- Usage examples

### API Documentation

Update `docs/API.md` for:
- New classes
- New methods
- New types
- Changed signatures

---

## Common Issues

### Build Errors

```bash
# Clean and rebuild
npm run clean
npm run build
```

### Test Failures

```bash
# Run specific test
npm test -- YourTest.test.ts

# Run with verbose output
npm test -- --verbose
```

### Type Errors

- Check `tsconfig.json` settings
- Ensure all dependencies have types (`@types/*`)
- Run `tsc --noEmit` to check types without building

---

## Getting Help

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community (link)
- **Email**: maintainers@agent-cli.dev

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** 🎉
