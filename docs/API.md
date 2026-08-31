# Agent CLI - API Documentation

## Table of Contents

1. [Core Classes](#core-classes)
2. [AI Providers](#ai-providers)
3. [Tools](#tools)
4. [Types](#types)
5. [Configuration](#configuration)

---

## Core Classes

### Agent

The main autonomous agent that orchestrates task execution.

#### Constructor

```typescript
constructor(
  provider: AIProvider,
  toolRegistry: ToolRegistry,
  permissions: PermissionManager,
  config: Config
)
```

**Parameters:**
- `provider` - AI provider instance (Anthropic, OpenAI, etc.)
- `toolRegistry` - Registry containing all available tools
- `permissions` - Permission manager for controlling tool execution
- `config` - Agent configuration object

#### Methods

##### `async run(userMessage: string): Promise<string>`

Executes the agentic loop with a user message.

**Parameters:**
- `userMessage` - The user's task or question

**Returns:** Final response from the agent

**Throws:** `AgentError` if max iterations exceeded

**Example:**
```typescript
const agent = new Agent(provider, toolRegistry, permissions, config);
const response = await agent.run("Create a React component");
console.log(response);
```

##### `getState(): AgentState`

Returns a copy of the current agent state.

**Returns:** `AgentState` object containing status, history, and metadata

##### `reset(): void`

Resets the agent to initial idle state, clearing all history.

---

### ToolRegistry

Manages registration and lookup of tools.

#### Constructor

```typescript
constructor()
```

#### Methods

##### `register(tool: Tool): void`

Registers a new tool.

**Parameters:**
- `tool` - Tool instance to register

**Throws:** `ToolError` if tool name already registered

**Example:**
```typescript
const registry = new ToolRegistry();
registry.register(new ReadFileTool());
registry.register(new WriteFileTool());
```

##### `get(name: string): Tool | undefined`

Retrieves a tool by name.

**Parameters:**
- `name` - Name of the tool

**Returns:** Tool instance or undefined if not found

##### `list(): Tool[]`

Returns all registered tools.

**Returns:** Array of all tools

##### `has(name: string): boolean`

Checks if a tool is registered.

**Parameters:**
- `name` - Name of the tool

**Returns:** True if tool exists

##### `unregister(name: string): boolean`

Removes a tool from the registry.

**Parameters:**
- `name` - Name of the tool to remove

**Returns:** True if tool was removed

##### `getSchemas(): Array<{ name, description, input_schema }>`

Gets tool schemas for AI provider.

**Returns:** Array of tool schema objects

---

## AI Providers

### AnthropicProvider

Provider for Claude models from Anthropic.

#### Constructor

```typescript
constructor(apiKey: string, options?: { baseUrl?: string })
```

**Parameters:**
- `apiKey` - Anthropic API key
- `options.baseUrl` - (Optional) Custom API base URL

**Example:**
```typescript
const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
```

#### Methods

##### `async chat(request: ChatRequest): Promise<ChatResponse>`

Sends a chat completion request.

**Parameters:**
- `request` - Chat request with messages, temperature, etc.

**Returns:** Chat response with content and tool calls

##### `async *stream(request: ChatRequest): AsyncIterable<ChatChunk>`

Streams chat completion response.

**Parameters:**
- `request` - Chat request

**Yields:** Chat chunks as they arrive

---

### OpenAIProvider

Provider for GPT models from OpenAI.

#### Constructor

```typescript
constructor(apiKey: string, options?: { 
  baseUrl?: string,
  model?: string 
})
```

**Parameters:**
- `apiKey` - OpenAI API key
- `options.baseUrl` - (Optional) Custom API base URL
- `options.model` - (Optional) Model to use (default: gpt-4-turbo-preview)

**Example:**
```typescript
const provider = new OpenAIProvider(process.env.OPENAI_API_KEY, {
  model: 'gpt-4'
});
```

#### Methods

##### `async chat(request: ChatRequest): Promise<ChatResponse>`

Sends a chat completion request.

**Parameters:**
- `request` - Chat request with messages, temperature, etc.

**Returns:** Chat response with content and tool calls

##### `async *stream(request: ChatRequest): AsyncIterable<ChatChunk>`

Streams chat completion response.

**Parameters:**
- `request` - Chat request

**Yields:** Chat chunks as they arrive

---

## Tools

All tools implement the `Tool` interface:

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}
```

### ReadFileTool

Reads file contents from the workspace.

**Tool Name:** `read_file`

**Input Schema:**
```typescript
{
  path: string;      // Relative path to file
  encoding?: string; // File encoding (default: utf-8)
}
```

**Example:**
```typescript
const tool = new ReadFileTool();
const result = await tool.execute({ path: 'src/index.ts' }, context);
console.log(result.output); // File contents
```

---

### WriteFileTool

Creates or overwrites a file.

**Tool Name:** `write_file`

**Input Schema:**
```typescript
{
  path: string;    // Relative path to file
  content: string; // File content to write
}
```

**Example:**
```typescript
const tool = new WriteFileTool();
await tool.execute({
  path: 'src/new-file.ts',
  content: 'export const hello = "world";'
}, context);
```

---

### EditFileTool

Performs targeted edits on a file.

**Tool Name:** `edit_file`

**Input Schema:**
```typescript
{
  path: string;    // Relative path to file
  oldText: string; // Text to find
  newText: string; // Text to replace with
}
```

**Example:**
```typescript
const tool = new EditFileTool();
await tool.execute({
  path: 'src/config.ts',
  oldText: 'port: 3000',
  newText: 'port: 8080'
}, context);
```

---

### ListFilesTool

Lists files in a directory.

**Tool Name:** `list_files`

**Input Schema:**
```typescript
{
  path: string;        // Directory path
  recursive?: boolean; // Recursive listing (default: false)
}
```

**Example:**
```typescript
const tool = new ListFilesTool();
const result = await tool.execute({ path: 'src', recursive: true }, context);
console.log(result.output); // File listing
```

---

### ShellTool

Executes shell commands.

**Tool Name:** `shell`

**Input Schema:**
```typescript
{
  command: string; // Shell command to execute
}
```

**Example:**
```typescript
const tool = new ShellTool();
const result = await tool.execute({ command: 'npm test' }, context);
console.log(result.output); // Command output
```

---

### SearchCodeTool

Searches for code patterns using grep.

**Tool Name:** `search_code`

**Input Schema:**
```typescript
{
  pattern: string;     // Search pattern (regex)
  path?: string;       // Directory to search (default: workspace root)
  filePattern?: string; // File pattern to include (e.g., "*.ts")
}
```

**Example:**
```typescript
const tool = new SearchCodeTool();
const result = await tool.execute({
  pattern: 'TODO',
  filePattern: '*.ts'
}, context);
```

---

### GitStatusTool

Shows git status.

**Tool Name:** `git_status`

**Input Schema:**
```typescript
{} // No parameters
```

---

### GitDiffTool

Shows git diff.

**Tool Name:** `git_diff`

**Input Schema:**
```typescript
{
  path?: string; // Specific file path (optional)
}
```

---

### GitLogTool

Shows git log.

**Tool Name:** `git_log`

**Input Schema:**
```typescript
{
  limit?: number; // Number of commits (default: 10)
}
```

---

## Types

### AgentState

```typescript
interface AgentState {
  status: AgentStatus;
  currentTask?: string;
  plan?: Plan;
  history: ToolExecution[];
  conversationMessages: ChatMessage[];
  iterationCount: number;
  metadata: Record<string, unknown>;
}
```

### AgentStatus

```typescript
type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'waiting_approval'
  | 'verifying'
  | 'error_recovery'
  | 'completed'
  | 'cancelled';
```

### ChatMessage

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}
```

### ToolResult

```typescript
interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

### Config

```typescript
interface Config {
  provider: string;           // AI provider name
  model: string;              // Model identifier
  workspaceRoot: string;      // Workspace directory
  permissionMode: PermissionMode;
  maxIterations: number;      // Max agentic loop iterations
  temperature?: number;       // AI temperature (0-1)
  debug?: boolean;            // Debug mode
  baseUrl?: string;           // Custom API base URL
}
```

### PermissionMode

```typescript
type PermissionMode = 'safe' | 'normal' | 'auto' | 'dangerous';
```

- **safe**: Prompts for every action
- **normal**: Prompts for risky actions
- **auto**: Auto-approves safe actions
- **dangerous**: Auto-approves all actions (use with caution)

---

## Configuration

### Config File

Create `.agent/config.json` in your workspace:

```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "permissionMode": "normal",
  "maxIterations": 30,
  "temperature": 0.7
}
```

### Environment Variables

```bash
# Anthropic
export ANTHROPIC_API_KEY=your-key-here

# OpenAI
export OPENAI_API_KEY=your-key-here
```

### Programmatic Configuration

```typescript
import { Agent } from './agent/Agent';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { ToolRegistry } from './tools/ToolRegistry';
import { DefaultPermissionManager } from './security/PermissionManager';

const config = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  workspaceRoot: process.cwd(),
  permissionMode: 'normal',
  maxIterations: 30,
  temperature: 0.7,
  debug: false,
};

const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY!);
const toolRegistry = new ToolRegistry();
const permissions = new DefaultPermissionManager(config.permissionMode);

const agent = new Agent(provider, toolRegistry, permissions, config);
```

---

## Error Handling

### AgentError

Thrown when agent encounters critical errors.

```typescript
try {
  await agent.run("Task");
} catch (error) {
  if (error instanceof AgentError) {
    console.error('Agent error:', error.message);
    console.error('Error code:', error.code);
  }
}
```

### ToolError

Thrown when tool operations fail.

```typescript
try {
  registry.register(tool);
} catch (error) {
  if (error instanceof ToolError) {
    console.error('Tool error:', error.message);
  }
}
```

### ProviderError

Thrown when AI provider API calls fail.

```typescript
try {
  await provider.chat(request);
} catch (error) {
  if (error instanceof ProviderError) {
    console.error('Provider error:', error.message);
    console.error('Original error:', error.metadata.originalError);
  }
}
```

---

## Usage Examples

### Basic Agent Usage

```typescript
import { cli } from './cli/CLI';

// Start interactive CLI
// $ agent run
```

### Programmatic Usage

```typescript
import { Agent } from './agent/Agent';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { ToolRegistry } from './tools/ToolRegistry';
import { ReadFileTool, WriteFileTool } from './tools/FileTools';

// Setup
const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY!);
const toolRegistry = new ToolRegistry();
toolRegistry.register(new ReadFileTool());
toolRegistry.register(new WriteFileTool());

const agent = new Agent(provider, toolRegistry, permissions, config);

// Execute task
const response = await agent.run("Create a TypeScript config file");
console.log(response);
```

### Custom Tool Development

```typescript
import { Tool, ToolContext, ToolResult } from './types';

class CustomTool implements Tool {
  name = 'custom_tool';
  description = 'Does something custom';
  inputSchema = {
    type: 'object',
    properties: {
      param: { type: 'string' }
    },
    required: ['param']
  };

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      // Your tool logic here
      return {
        success: true,
        output: 'Tool executed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Register your tool
toolRegistry.register(new CustomTool());
```

---

## Best Practices

1. **Always use permission mode** - Don't default to 'dangerous' mode
2. **Implement proper error handling** - Catch and handle all errors
3. **Validate tool inputs** - Use JSON Schema validation
4. **Keep iterations bounded** - Set reasonable maxIterations
5. **Monitor token usage** - Track usage with response.usage
6. **Test tools thoroughly** - Write unit and integration tests
7. **Document custom tools** - Provide clear descriptions and schemas

---

**Version:** 0.1.0  
**License:** MIT  
**Repository:** [github.com/yourusername/agent-cli](https://github.com/yourusername/agent-cli)
